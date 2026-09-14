import express from 'express';
import { getExamPapers, getExamPaperById, createExamPaper } from '../../handlers/exam-papers.js';
import { getExamQuestions, createExamQuestion, batchCreateQuestions } from '../../handlers/exam-questions.js';
import { startExamSession, submitExamSession, getExamHistory } from '../../handlers/exam-session.js';
import generatePaperRouter from '../../handlers/generate-paper.js';
import { generateExamPdf } from '../../handlers/exam-pdf.js';
import questionsRouter from '../../handlers/questions.js';
import explainQuestionRouter from '../../handlers/explain-question.js';
import { getDb } from '../../core/db.js';
import { errorResponse, successResponse } from '../../utils/response.js';

const router = express.Router();

router.get('/papers', getExamPapers);
router.get('/papers/:id', getExamPaperById);
router.post('/papers', createExamPaper);

router.post('/questions', createExamQuestion);
router.post('/questions/batch', batchCreateQuestions);

// P0-fix (2026-08-24): Phase D — D2
// F3 (ai-tutor-frontend) 调 /api/exam/questions (query: subject/year/paper_type/page/page_size).
// 老 handler 要 :paperId; 给 / 加一个无参版本, 支持分页查询.
// :paperId 详情版仍保留以兼容旧调用.
router.get('/questions', async (req, res) => {
  try {
    const pool = await getDb();
    const {
      subject,
      year,
      paper_type,
      paperType,
      page = 1,
      page_size = 20,
      pageSize,
      limit,
      offset,
      type,
      difficulty,
      knowledge_point,
    } = req.query;
    const safeLimit = Math.min(Math.max(parseInt(limit ?? page_size ?? pageSize) || 20, 1), 200);
    const safePage = Math.max(parseInt(page) || 1, 1);
    const safeOffset = Math.max(parseInt(offset) || (safePage - 1) * safeLimit, 0);
    const pt = paper_type || paperType;

    const conditions = [];
    const params = [];
    let idx = 1;
    if (subject) { conditions.push(`eq.subject_code = $${idx++}`); params.push(subject); }
    if (year) { conditions.push(`ep.year = $${idx++}`); params.push(parseInt(year)); }
    if (pt) { conditions.push(`ep.paper_type = $${idx++}`); params.push(pt); }
    if (type) { conditions.push(`eq.question_type = $${idx++}`); params.push(type); }
    if (difficulty) { conditions.push(`eq.difficulty = $${idx++}`); params.push(parseInt(difficulty)); }
    if (knowledge_point) {
      conditions.push(`eq.id IN (SELECT question_id FROM question_knowledge_points WHERE knowledge_point_id = $${idx++})`);
      params.push(knowledge_point);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(safeLimit);
    params.push(safeOffset);

    const rows = await pool.query(
      `SELECT eq.id, eq.question_number, eq.question_type, eq.stem, eq.options, eq.answer, eq.analysis, eq.score,
              eq.difficulty, eq.subject_code, eq.knowledge_points, eq.file_path,
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
    return res.json(successResponse({
      data: rows.rows,
      total: totalRow.rows[0]?.c || 0,
      page: safePage,
      page_size: safeLimit,
      limit: safeLimit,
      offset: safeOffset,
    }, '题目列表获取成功'));
  } catch (err) {
    console.error('[exam/questions] 列表查询失败:', err.message);
    return res.status(500).json(errorResponse('题目列表获取失败'));
  }
});
router.get('/questions/:paperId', getExamQuestions);

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
