import express from 'express';
import visionParseRouter from '../../routes/vision-parse.js';
import { VisionSearchService } from '../../services/visionSearchService.js';
import { authMiddleware } from '../../core/auth.js';
import { successResponse, errorResponse } from '../../utils/response.js';

const router = express.Router();

router.use('/parse', visionParseRouter);

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
      learningPlan: result.learningPlan,
      ingest: result.ingest ? { success: true } : { success: false }
    }, '拍照搜题完成'));
  } catch (err) {
    console.error('[Vision Search] 拍照搜题失败:', err.message);
    return res.status(500).json(errorResponse(`搜题失败: ${err.message}`));
  }
});

export default router;
