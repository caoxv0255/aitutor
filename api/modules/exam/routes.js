import express from 'express';
import { getExamPapers, getExamPaperById, createExamPaper } from '../../handlers/exam-papers.js';
import {
  getExamQuestions,
  createExamQuestion,
  batchCreateQuestions,
  getSimilarQuestionsByV2Kp,
  getQuestionById,
} from '../../handlers/exam-questions.js';
import { startExamSession, submitExamSession, getExamHistory } from '../../handlers/exam-session.js';
import generatePaperRouter from '../../handlers/generate-paper.js';
import { generateExamPdf } from '../../handlers/exam-pdf.js';
import questionsRouter from '../../handlers/questions.js';
import explainQuestionRouter from '../../handlers/explain-question.js';
import { getDb } from '../../core/db.js';
import { requireAdmin } from '../../core/auth.js';
import { errorResponse, successResponse } from '../../utils/response.js';
import { enrichQuestionsWithTables } from '../../services/questionTables.js';

const router = express.Router();

router.get('/papers', getExamPapers);
router.get('/papers/:id', getExamPaperById);
// C2-fix: 创建试卷含「先 DELETE 同学科同年试卷再 INSERT」的破坏性写,
// 且 paper_file_path 会进入文件系统读路径, 必须 admin-only.
router.post('/papers', requireAdmin, createExamPaper);

router.post('/questions', createExamQuestion);
router.post('/questions/batch', batchCreateQuestions);

// D091-front-loop-2026-09-14: 同类题推荐 (基于 v2 KP ID 精确匹配, 比 RAG 文本匹配更准)
router.get('/questions/similar', getSimilarQuestionsByV2Kp);

// P0-fix (2026-08-24): Phase D — D2
// F3 (ai-tutor-frontend) 调 /api/exam/questions (query: subject/year/paper_type/page/page_size).
// 老 handler 要 :paperId; 给 / 加一个无参版本, 支持分页查询.
// :paperId 详情版仍保留以兼容旧调用.
//
// P0-fix (2026-09-17): 题库原子化寻址补齐 — 支持「年份 / 省份 / 试卷类型 / 学科 / 题号」五维精确提取.
//   修前缺陷: province / question_number 不在参数表里, 传了被【静默忽略】并返回全量数据.
//     (实测: subject=math&year=2024&paper_type=independent 返回 63 条;
//      province_code=beijing 期望 21 条, 实际仍 63 条 — 前端 question-bank.html 省份筛选因此完全无效)
//   修后: 五维全部生效; 非法参数值 / 未知参数名一律报错, 不再静默降级.
const QB_SUBJECTS = [
  'chinese',
  'math',
  'english',
  'physics',
  'chemistry',
  'biology',
  'politics',
  'history',
  'geography',
];
// 与 exam_papers.ck_exam_papers_paper_type CHECK 约束保持一致
const QB_PAPER_TYPES = [
  'independent',
  'national_i',
  'national_ii',
  'national_iii',
  'national_a',
  'national_b',
  'new_gaokao_i',
  'new_gaokao_ii',
  'national_legacy',
  'unknown',
  'national_outline',
  'national_new',
  'new_gaokao_regional',
];
const QB_PARAM_ALIASES = { province: 'province_code', prov: 'province_code' };
// 前端/监控常带的噪声参数, 不参与校验也不参与过滤
const QB_IGNORED_PARAMS = new Set(['_t', '_', 'callback', 'format', 'ts']);

class QueryParamError extends Error {
  constructor(message, code = 'VALIDATION_INVALID_FORMAT') {
    super(message);
    this.errorCode = code;
  }
}

function qbParseInt(raw, field, { min, max } = {}) {
  if (raw === undefined || raw === null || raw === '') return null;
  if (!/^-?\d+$/.test(String(raw).trim())) {
    throw new QueryParamError(`${field} 必须是整数, 收到: ${raw}`);
  }
  const n = parseInt(String(raw).trim(), 10);
  if (min !== undefined && n < min) {
    throw new QueryParamError(`${field} 不能小于 ${min}, 收到: ${n}`, 'VALIDATION_OUT_OF_RANGE');
  }
  if (max !== undefined && n > max) {
    throw new QueryParamError(`${field} 不能大于 ${max}, 收到: ${n}`, 'VALIDATION_OUT_OF_RANGE');
  }
  return n;
}

router.get('/questions', async (req, res) => {
  try {
    const pool = await getDb();
    const {
      subject,
      subject_code: subjectCode,
      year,
      province,
      province_code: provinceCode,
      paper_type,
      paperType,
      question_number,
      qno,
      type,
      question_type: questionType,
      difficulty,
      knowledge_point,
      v2_kp,
      page = 1,
      page_size = 20,
      pageSize,
      limit,
      offset,
    } = req.query;

    // ---- 未知参数一律报错 (修「静默忽略」这一类缺陷) ----
    const supported = new Set([
      'subject',
      'subject_code',
      'year',
      'province',
      'province_code',
      'prov',
      'paper_type',
      'paperType',
      'question_number',
      'qno',
      'type',
      'question_type',
      'difficulty',
      'knowledge_point',
      'v2_kp',
      'page',
      'page_size',
      'pageSize',
      'limit',
      'offset',
    ]);
    const unknown = Object.keys(req.query).filter((k) => !supported.has(k) && !QB_IGNORED_PARAMS.has(k));
    if (unknown.length > 0) {
      throw new QueryParamError(
        `不支持的查询参数: ${unknown.join(', ')}。合法参数: ${[...supported].sort().join(', ')}`
      );
    }

    // ---- 参数值校验 (非法值报错, 不静默降级为无过滤) ----
    const subj = subjectCode || subject;
    if (subj && !QB_SUBJECTS.includes(subj)) {
      throw new QueryParamError(`无效的学科: ${subj}。合法值: ${QB_SUBJECTS.join(', ')}`, 'VALIDATION_INVALID_ENUM');
    }
    const safeYear = qbParseInt(year, 'year', { min: 1900, max: 2100 });
    const pt = paper_type || paperType;
    if (pt && !QB_PAPER_TYPES.includes(pt)) {
      throw new QueryParamError(
        `无效的试卷类型: ${pt}。合法值: ${QB_PAPER_TYPES.join(', ')}`,
        'VALIDATION_INVALID_ENUM'
      );
    }
    let prov = provinceCode || province;
    if (prov && QB_PARAM_ALIASES[prov]) prov = QB_PARAM_ALIASES[prov];
    const safeQno = qbParseInt(question_number ?? qno, 'question_number', { min: 1 });
    const safeDifficulty = qbParseInt(difficulty, 'difficulty', { min: 1, max: 5 });
    const qType = questionType || type;

    const safeLimit = Math.min(
      Math.max(qbParseInt(limit ?? page_size ?? pageSize, 'page_size', { min: 1 }) ?? 20, 1),
      200
    );
    const safePage = Math.max(qbParseInt(page, 'page', { min: 1 }) ?? 1, 1);
    const safeOffset = Math.max(qbParseInt(offset, 'offset', { min: 0 }) ?? (safePage - 1) * safeLimit, 0);

    if (prov) {
      const provRow = await pool.query('SELECT 1 FROM provinces WHERE code = $1', [prov]);
      if (provRow.rowCount === 0) {
        throw new QueryParamError(
          `未知的省份代码: ${prov} (province/province_code 取 provinces.code, 如 beijing)`,
          'VALIDATION_INVALID_ENUM'
        );
      }
    }

    const conditions = [];
    const params = [];
    let idx = 1;
    // 只返回 active 题。被「原卷原子化」新管线取代的旧题会被标为 archived_legacy
    // (见 scripts/qb-extract/05-ingest.py 的归档逻辑): 归档是为了保住挂在旧题上的
    // 派生数据 (question_knowledge_points / question_kp_v2 / question_vectors /
    // question_images / exam_sub_questions —— 删除旧题会 CASCADE 掉它们),
    // 但归档题不应再出现在读端结果里, 否则同一个五维地址会返回新旧两份。
    conditions.push(`eq.archive_state = 'active'`);
    // 英语听力题恒定排除 (用户指令 2026-09-18「跳过英语听力题」):
    // 听力题的答案在**音频**里, 纯文本文档印不出答案 —— 服务出去只会是"永远做不对的题"。
    // 标记见 database/migrations/026_is_listening.sql (1526 道, 已与提取产物独立对账)。
    // 注: 这是**产品口径**决定, 不是为了抬统计数字 —— 实测该子集答案率 83.03%,
    //     反而**高于**全库 79.60%, 从统计分母里拿掉它会让指标变差 0.24pp。
    conditions.push(`NOT eq.is_listening`);
    if (subj) {
      conditions.push(`eq.subject_code = $${idx++}`);
      params.push(subj);
    }
    if (safeYear !== null) {
      conditions.push(`ep.year = $${idx++}`);
      params.push(safeYear);
    }
    // P0-fix: 省份过滤 (经 exam_papers.province_code → provinces.code)
    if (prov) {
      conditions.push(`ep.province_code = $${idx++}`);
      params.push(prov);
    }
    if (pt) {
      conditions.push(`ep.paper_type = $${idx++}`);
      params.push(pt);
    }
    if (qType) {
      conditions.push(`eq.question_type = $${idx++}`);
      params.push(qType);
    }
    if (safeDifficulty !== null) {
      conditions.push(`eq.difficulty = $${idx++}`);
      params.push(safeDifficulty);
    }
    // P0-fix: 题号过滤 (卷内题号, 与 paper_id 组合才是全库唯一; 单独用时按各卷同名题号返回)
    if (safeQno !== null) {
      conditions.push(`eq.question_number = $${idx++}`);
      params.push(safeQno);
    }
    if (knowledge_point) {
      conditions.push(
        `eq.id IN (SELECT question_id FROM question_knowledge_points WHERE knowledge_point_id = $${idx++})`
      );
      params.push(knowledge_point);
    }
    // D091: v2 KP 精确筛选
    if (v2_kp) {
      conditions.push(`eq.id IN (SELECT question_id FROM question_kp_v2 WHERE kp_id = $${idx++})`);
      params.push(v2_kp);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(safeLimit);
    params.push(safeOffset);

    const rows = await pool.query(
      `SELECT eq.id, eq.question_uid, eq.question_number, eq.question_type, eq.stem, eq.options, eq.answer, eq.analysis, eq.score,
              eq.difficulty, eq.subject_code, eq.knowledge_points, eq.file_path, eq.table_refs,
              ep.id AS paper_id, ep.year, ep.paper_type,
              p.name AS province_name, p.code AS province_code
       FROM exam_questions eq
       JOIN exam_papers ep ON eq.paper_id = ep.id
       LEFT JOIN provinces p ON ep.province_code = p.code
       ${where}
       ORDER BY ep.year DESC, eq.paper_id, eq.question_number
       LIMIT $${idx++} OFFSET $${idx}`,
      params
    );
    const totalRow = await pool.query(
      `SELECT COUNT(*)::int AS c
       FROM exam_questions eq
       JOIN exam_papers ep ON eq.paper_id = ep.id
       ${where}`,
      params.slice(0, params.length - 2)
    );
    // D091: 加载 v2 KP (按 question_id 聚合)
    const questionIds = rows.rows.map((r) => r.id);
    const v2Map = new Map();
    if (questionIds.length > 0) {
      const v2Res = await pool.query(
        `
        SELECT q.question_id, kp.kp_id, kp.name, kp.dimension_type, q.confidence
        FROM question_kp_v2 q
        JOIN knowledge_points_v2 kp ON kp.kp_id = q.kp_id
        WHERE q.question_id = ANY($1::int[])
        ORDER BY q.confidence DESC NULLS LAST
      `,
        [questionIds]
      );
      for (const r of v2Res.rows) {
        if (!v2Map.has(r.question_id)) v2Map.set(r.question_id, []);
        v2Map
          .get(r.question_id)
          .push({ kp_id: r.kp_id, name: r.name, dimension_type: r.dimension_type, confidence: r.confidence });
      }
    }
    for (const r of rows.rows) r.knowledge_points_v2 = v2Map.get(r.id) || [];
    // P4-c 治本: ⟦TABLE:n⟧ → 结构化 tables
    await enrichQuestionsWithTables(pool, rows.rows);
    return res.json(
      successResponse(
        {
          data: rows.rows,
          total: totalRow.rows[0]?.c || 0,
          page: safePage,
          page_size: safeLimit,
          limit: safeLimit,
          offset: safeOffset,
        },
        '题目列表获取成功'
      )
    );
  } catch (err) {
    if (err instanceof QueryParamError) {
      // P0-fix: 非法参数显式报错 (400 + ErrorCode), 不再静默忽略后返回全量数据.
      // 注: 沿用 errorCodes.js 既有约定 (VALIDATION_* → 400), 未引入 422, 以保持客户端契约一致.
      return res.status(400).json({
        success: false,
        code: err.errorCode,
        message: err.message,
        status: err.errorCode,
      });
    }
    console.error('[exam/questions] 列表查询失败:', err.message);
    return res.status(500).json(errorResponse('题目列表获取失败'));
  }
});
router.get('/questions/:paperId', getExamQuestions);
// D092-front-loop-2026-09-14: 题目级详情 (按 question_id 而非 paper_id)
router.get('/questions/detail/:qid', getQuestionById);

router.post('/session/start', startExamSession);
router.post('/session/submit', submitExamSession);

// P0-fix (2026-08-24): Phase D — D2
// PM 报告列出 4 个 404 端点, 其中两个走 getExamHistory:
//   GET /api/exam/session/history  → 当前用户历史 (alias)
//   GET /api/exam/sessions         → 当前用户历史 (alias)
router.get('/session/history', getExamHistory);
router.get('/sessions', getExamHistory);

// 2026-08-20 DSH: 之前 router.post('/pdf/generate', ...) 没声明 :paperId 占位符,
// 但 generateExamPdf 用 req.params.paperId. 一直 404. 修法: 加 :paperId.
router.post('/pdf/generate/:paperId', generateExamPdf);

export default router;
