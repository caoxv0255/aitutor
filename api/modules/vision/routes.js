import express from 'express';
import { z } from 'zod';
import visionParseRouter from '../../routes/vision-parse.js';
import { VisionSearchService } from '../../services/visionSearchService.js';
import { authMiddleware } from '../../core/auth.js';
import { getDb } from '../../core/db.js';
import { successResponse, errorResponse } from '../../utils/response.js';

const router = express.Router();

// 挂载到 / (而非 /parse): vision-parse.js 内部已定义 /parse 与 /knowledge-points,
// 双重 /parse 前缀会得到 /api/vision/parse/parse (与 README + F3 service 契约不符).
// 修正后: POST /api/vision/parse, GET /api/vision/knowledge-points
router.use('/', visionParseRouter);

router.post('/search', authMiddleware, async (req, res) => {
  try {
    const { image, subject, knowledge_point_id, student_answer, include_similar, generate_plan } = req.body;

    if (!image || typeof image !== 'string') {
      return res.status(400).json(errorResponse('缺少必填字段: image (Base64 字符串)'));
    }

    const base64Data = image.replace(/^data:image\/\w+;base64,/, '');

    const result = await VisionSearchService.search(base64Data, {
      subject,
      knowledge_point_id,
      studentAnswer: student_answer,
      includeSimilarQuestions: include_similar !== false,
      generateLearningPlan: generate_plan !== false,
      autoIngest: true
    });

    if (!result.success) {
      return res.status(500).json(errorResponse(result.error || '拍照搜题失败'));
    }

    if (req.user?.email && result.parse && result.errorAnalysis && result.similarQuestions) {
      await VisionSearchService.saveWrongQuestion(
        req.user.email,
        result.parse,
        result.errorAnalysis,
        result.similarQuestions
      );
    }

    return res.json(successResponse({
      parse: result.parse,
      errorAnalysis: result.errorAnalysis,
      similarQuestions: result.similarQuestions,
      // F3-fix (2026-09-22): 增量字段 — 相似题为空时说明原因 (embedding 不可用/无过阈值结果), 前端可展示诚实空态
      similarNotice: result.similarNotice || null,
      learningPlan: result.learningPlan,
      ingest: result.ingest ? { success: true } : { success: false }
    }, '拍照搜题完成'));
  } catch (err) {
    console.error('[Vision Search] 拍照搜题失败:', err.message);
    return res.status(500).json(errorResponse('拍照搜题失败，请稍后重试'));
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// P8 (2026-09-23): 按题干文本查相似题 — 纯检索, 不跑 OCR / 不调 LLM
//
// 背景: photo-solve 已用 batch-parse 拿到题干文本, 再要相似题时若走
//   POST /api/vision/search 会强制重传 image 并跑第二遍完整管线
//   (二次 OCR visionSearchService.js:189 + errorAnalysis LLM :223 + learningPlan LLM :269),
//   既慢又浪费算力。本端点只做「文本 → pgvector cosine 检索」。
//
// 复用 F3 的 VisionSearchService.findSimilarQuestions: 同一阈值
//   (SIMILAR_QUESTIONS_MIN_SIMILARITY, 默认 0.60) + 同一 similarNotice 口径,
//   返回字段与 POST /search 的相似题部分一致, 便于前端复用渲染。
// ─────────────────────────────────────────────────────────────────────────────
const MAX_SIMILAR_TEXT_LENGTH = 2000;

const SimilarByTextSchema = z.object({
  // 题干过短 (<10) 与 findSimilarQuestions 的诚实空态判据保持一致
  text: z
    .string({ required_error: '缺少必填字段: text (题干文本)' })
    .trim()
    .min(10, '题干文本过短，至少 10 个字才能计算语义相似度')
    .max(MAX_SIMILAR_TEXT_LENGTH, `题干文本过长，上限 ${MAX_SIMILAR_TEXT_LENGTH} 字`),
  subject: z.string().trim().max(32).optional(),
  limit: z.number().int().min(1).max(20).optional(),
});

router.post('/similar-by-text', authMiddleware, async (req, res) => {
  try {
    const parsed = SimilarByTextSchema.safeParse(req.body || {});
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message || '入参校验失败';
      return res.status(400).json(errorResponse(msg));
    }

    const { text, subject, limit } = parsed.data;

    // 纯检索: 只触及 embedding + question_vectors/exam_questions JOIN 查询;
    // 不调用 parseImageToQuestion (OCR) / llm.chat (errorAnalysis / learningPlan) /
    // ingestQuestion。embedding 不可用或无过阈值结果时, findSimilarQuestions 返回
    // 空数组 + notice (诚实空态), 本端点原样透传, 不静默失败也不伪造结果。
    const result = await VisionSearchService.findSimilarQuestions(getDb(), text, {
      subjectCode: subject,
      limit,
      requestId: req.traceId,
      userId: req.user?.email,
    });

    return res.json(successResponse({
      similarQuestions: result.questions,
      similarNotice: result.notice || null,
    }, '相似题检索完成'));
  } catch (err) {
    console.error('[Vision similar-by-text] 失败:', err.message);
    return res.status(500).json(errorResponse('相似题检索失败，请稍后重试'));
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Phase E (2026-08-24): 整卷 OCR 批量解析 + 批量入库
//
//   POST /api/vision/batch-parse  — 多图/PDF 批量 OCR (返回每题结构化结果)
//   POST /api/vision/batch-ingest — 批量入库 (错题 + mastery -10 + SRS 调度)
//
// 设计原则: 单题失败不影响整批, 由 caller 聚合展示 (核心 UX)
// ─────────────────────────────────────────────────────────────────────────────

const MAX_BATCH_SIZE = 20; // 单次最多 20 张图片 (避免单请求超时)
const MAX_BATCH_BYTES_PER_IMAGE = 10 * 1024 * 1024; // 单图 ≤ 10MB

router.post('/batch-parse', authMiddleware, async (req, res) => {
  try {
    const { images, user_hint, options } = req.body || {};

    // ── 入参校验 ──
    if (!Array.isArray(images) || images.length === 0) {
      return res.status(400).json(errorResponse('缺少必填字段: images (非空数组)'));
    }
    if (images.length > MAX_BATCH_SIZE) {
      return res.status(400).json(errorResponse(`批量解析上限 ${MAX_BATCH_SIZE} 张, 当前 ${images.length} 张`));
    }

    // ── 数据规范化: 剥离 data URL 前缀, 校验单图大小 ──
    const normalized = images.map((img, i) => {
      if (!img || typeof img !== 'object') {
        return { data: '', subject: null, pageIndex: i + 1, _invalid: true };
      }
      const raw = typeof img.data === 'string' ? img.data : '';
      const clean = raw.replace(/^data:image\/\w+;base64,/, '');
      return {
        data: clean,
        subject: img.subject || null,
        pageIndex: typeof img.pageIndex === 'number' ? img.pageIndex : (i + 1),
        knowledge_point_id: img.knowledge_point_id || null,
        _invalid: !clean || clean.length > MAX_BATCH_BYTES_PER_IMAGE * 1.4, // base64 膨胀 ~33%
      };
    });

    // 把非法项直接归入 failed, 不阻塞其他题
    const validImages = normalized.filter((n) => !n._invalid);
    const invalidFailed = normalized
      .filter((n) => n._invalid)
      .map((n) => ({ success: false, pageIndex: n.pageIndex, error: 'image.data 缺失或超过 10MB' }));

    // ── 调用 service ──
    const result = await VisionSearchService.batchParse(validImages, {
      user_email: req.user?.email || 'system',
      request_id: req.traceId,
      default_subject: user_hint?.default_subject,
    }, {
      concurrency: (options && options.concurrency) || 3,
      mock: (options && options.mock === true) || process.env.USE_MOCK === 'true',
    });

    // 合并非法项 → failed
    const allFailed = [...result.failed, ...invalidFailed].sort((a, b) => (a.pageIndex || 0) - (b.pageIndex || 0));
    const finalQuestions = [...result.questions].sort((a, b) => (a.pageIndex || 0) - (b.pageIndex || 0));

    return res.json(successResponse({
      questions: finalQuestions,
      failed: allFailed,
      total_count: result.total_count,
      success_count: result.success_count,
      failed_count: result.failed_count,
    }, '整卷解析完成'));
  } catch (err) {
    console.error('[Vision batch-parse] 失败:', err.message);
    return res.status(500).json(errorResponse('整卷解析失败，请稍后重试'));
  }
});

router.post('/batch-ingest', authMiddleware, async (req, res) => {
  try {
    const { questions, options } = req.body || {};

    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json(errorResponse('缺少必填字段: questions (非空数组)'));
    }
    if (questions.length > MAX_BATCH_SIZE) {
      return res.status(400).json(errorResponse(`批量入库上限 ${MAX_BATCH_SIZE} 题, 当前 ${questions.length} 题`));
    }

    const result = await VisionSearchService.batchIngest(questions, req.user?.email, {
      request_id: req.traceId,
      source: (options && options.source) || 'vision_batch_parse',
    });

    return res.json(successResponse(result, '批量入库完成'));
  } catch (err) {
    console.error('[Vision batch-ingest] 失败:', err.message);
    return res.status(500).json(errorResponse('批量入库失败，请稍后重试'));
  }
});

export default router;
