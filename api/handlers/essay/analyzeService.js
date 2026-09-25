/* ============================================================================
 * analyzeService.js — 作文智能批改「analyze」编排 (2026-09-25)
 *
 * 职责: 一张图片 → OCR(私有 MaaS 视觉) → 批改(Stage B) → 落库 essay_reports
 *       → 返回统一报告。**复用**现有 V1.0 两阶段能力, 不新增第二套契约:
 *         - 转录 prompt / 解析 / Zod / line_no 推断 → transcribeService.js
 *         - 批改 prompt / rubric / 锚定 / 输出 Schema → gradeService.js
 *         - 落库 → essayStorage.js ; 报告 ID → essayReconcile.newReportId
 *         - 图片落盘 → upload/imageHandler.saveImageFromBase64 (同一存储方案)
 *         - 视觉通路 → services/llm.js maasVisionChatCompletion (私有 MaaS qwen3-vl)
 *
 * 与既有 V0 (essayService.js, /api/essay/grade) 的关系:
 *   V0 仍在役、frontend-v2 在消费, 本模块**不改动**它; analyze 是走 V1.0 服务的新入口。
 *
 * 校验失败重试 (本批要求): 批改输出 Schema 校验失败 → 打印原始返回 + 重试一次;
 *   两次仍失败 → 落一条 status='failed' 的报告并抛出**固定文案**错误 (不回显 err.message)。
 * ============================================================================ */

'use strict';

import { z } from 'zod';
import { logger } from '../../core/logger.js';
import { EssayError } from './errors.js';
import { ErrorCode } from '../../utils/errorCodes.js';
import { isAllowedImageUrl } from './imageHostPolicy.js';
import { buildTranscribePrompt, parseAndValidateTranscript } from './transcribeService.js';
import { gradeEssay as gradeEssayStageB } from './gradeService.js';
import { insertEssayReport } from './essayStorage.js';
import { newReportId } from './essayReconcile.js';
import { saveImageFromBase64 } from '../upload/imageHandler.js';
import { maasVisionChatCompletion } from '../../../services/llm.js';

const DEFAULT_ESSAY_TITLE = '未命名';
const PROMPT_VERSION = '3.1.0'; // 与 prompts/grade.v1.txt 的 prompt_version 对齐 (批次 2 扩展)

// ────────────────────────────────────────────────────────────────────────────
// 入参 Schema
// ────────────────────────────────────────────────────────────────────────────

const SPECIFIC_GRADES = ['初一', '初二', '初三', '高一', '高二', '高三'];

const AnalyzeRequestSchema = z.object({
  image: z.string().min(1, 'image 必填'),
  subject: z.enum(['chinese', 'english']),
  // 规格: grade ∈ {junior, senior}; 兼容既有 V1.0 的具体年级写法。
  grade: z.enum(['junior', 'senior', ...SPECIFIC_GRADES]),
  essay_title: z.string().min(1).max(255).optional(),
  exam_level: z.enum(['gaokao', 'zhongkao']).optional(),
});

/**
 * junior/senior → exam_level + 具体年级; 具体年级则按学段推断 exam_level。
 * @returns {{exam_level:'gaokao'|'zhongkao', grade:string}}
 */
function resolveExamLevel(grade, examLevel) {
  if (grade === 'junior' || grade === 'senior') {
    const derived = grade === 'senior' ? 'gaokao' : 'zhongkao';
    return { exam_level: examLevel || derived, grade: grade === 'senior' ? '高三' : '初三' };
  }
  const derived = ['初一', '初二', '初三'].includes(grade) ? 'zhongkao' : 'gaokao';
  return { exam_level: examLevel || derived, grade };
}

// ────────────────────────────────────────────────────────────────────────────
// 图片归一: http(s) URL 直传; base64 → MaaS 用原图字节 (触发最小边校验) + 落盘取 URL
// ────────────────────────────────────────────────────────────────────────────

async function resolveImage(image, { email }) {
  if (/^https?:\/\//i.test(image)) {
    if (!isAllowedImageUrl(image)) {
      throw new EssayError(
        ErrorCode.VALIDATION_REQUIRED_FIELD,
        '图片地址不在白名单内 (请先调用 /api/upload/image 上传)',
        null
      );
    }
    return { visionImage: { url: image }, imageUrl: image };
  }

  // base64 / dataURL: 视觉调用直接用原始字节 (qwen3-vl 最小边 > 10px 的守卫在此生效)
  const visionImage = { base64: image };
  // 复用统一存储方案落盘, 供报告返回可访问的图片 URL
  const saved = await saveImageFromBase64(image, { purpose: 'essay', email });
  return { visionImage, imageUrl: saved.url };
}

// ────────────────────────────────────────────────────────────────────────────
// 主入口
// ────────────────────────────────────────────────────────────────────────────

/**
 * @param {object} args
 * @param {object} args.req  Express request (取 user.email / authorization / traceId)
 * @returns {Promise<object>} 统一报告体
 * @throws {EssayError}
 */
export async function analyzeEssay({ req }) {
  const email = req?.user?.email;
  if (!email) {
    throw new EssayError(ErrorCode.AUTH_NOT_LOGIN, '请先登录', null);
  }
  if (!req?.headers?.authorization) {
    throw new EssayError(ErrorCode.AUTH_NOT_LOGIN, '缺少 Authorization 头', null);
  }

  // ─── 1. 入参校验 ───
  const parsed = AnalyzeRequestSchema.safeParse(req.body || {});
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new EssayError(
      ErrorCode.VALIDATION_REQUIRED_FIELD,
      `请求参数校验失败: ${issue.path.join('.')}`,
      { zod_issues: parsed.error.issues }
    );
  }
  const { image, subject, grade: rawGrade, essay_title, exam_level } = parsed.data;
  const essayTitle = essay_title || DEFAULT_ESSAY_TITLE;
  const { exam_level: resolvedLevel, grade } = resolveExamLevel(rawGrade, exam_level);

  // ─── 2. 图片归一 (存储复用) ───
  let visionImage;
  let imageUrl;
  try {
    ({ visionImage, imageUrl } = await resolveImage(image, { email }));
  } catch (e) {
    if (e instanceof EssayError) throw e;
    // imageHandler 抛的是带 uploadCode 的 Error
    if (e && e.uploadCode) {
      throw new EssayError(e.uploadCode, '图片处理失败', { upload_code: e.uploadCode });
    }
    throw e;
  }

  // ─── 3. Stage A: 私有 MaaS 视觉 OCR (复用转录 prompt 与校验) ───
  let visionRes;
  try {
    visionRes = await maasVisionChatCompletion({
      userText: buildTranscribePrompt(subject),
      images: [visionImage],
      options: {
        jsonMode: true,
        temperature: 0.1,
        max_tokens: 3000,
        task_type: 'essay_transcribe',
        user_id: email,
        request_id: req.traceId,
      },
    });
  } catch (e) {
    logger.error('[essay.analyze] MaaS 视觉调用失败', { error: e, requestId: req.requestId });
    throw new EssayError(ErrorCode.ESSAY_LLM_UPSTREAM_ERROR, '视觉服务暂不可用', null);
  }

  let transcript;
  let request_token;
  try {
    ({ transcript, request_token } = parseAndValidateTranscript(visionRes.content));
  } catch (e) {
    if (e instanceof EssayError) throw e; // 已含固定文案 (ESSAY_TRANSCRIBE_PARSE_FAILED)
    throw new EssayError(ErrorCode.ESSAY_TRANSCRIBE_PARSE_FAILED, '转录结果解析失败', null);
  }

  // ─── 4. Stage B: 批改 (Schema 校验失败重试一次) ───
  const gradeArgs = {
    user_email: email,
    transcript,
    essay_title: essayTitle,
    exam_level: resolvedLevel,
    grade,
    subject,
    request_token,
    req,
  };

  let graded = null;
  let lastErr = null;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      graded = await gradeEssayStageB(gradeArgs);
      break;
    } catch (e) {
      lastErr = e;
      const isParseFailure = e instanceof EssayError && e.code === ErrorCode.ESSAY_GRADE_PARSE_FAILED;
      if (isParseFailure && attempt === 1) {
        // 打印原始返回 (detail 内的 raw_excerpt) + 重试一次
        logger.warn('[essay.analyze] 批改输出校验失败, 重试一次', {
          attempt,
          raw_excerpt: e.details?.raw_excerpt || null,
          zod_issues: e.details?.zod_issues || null,
        });
        continue;
      }
      break;
    }
  }

  if (!graded) {
    // 两次仍失败 (或非解析类失败) → 落 failed 报告, 抛固定文案
    if (lastErr instanceof EssayError && lastErr.code === ErrorCode.ESSAY_GRADE_PARSE_FAILED) {
      await markAnalyzeFailed({ email, essayTitle, resolvedLevel, grade, transcript, imageUrl });
      throw new EssayError(
        ErrorCode.ESSAY_GRADE_PARSE_FAILED,
        'AI 老师暂时无法完成这次批改，请稍后重试',
        null
      );
    }
    if (lastErr instanceof EssayError) throw lastErr;
    logger.error('[essay.analyze] 批改阶段未知异常', { error: lastErr, requestId: req.requestId });
    throw new EssayError(ErrorCode.ESSAY_LLM_UPSTREAM_ERROR, '批改服务异常', null);
  }

  // ─── 5. 落库 (复用 essay_reports) ───
  const meta = {
    ...graded.meta,
    image_url: imageUrl,
    subject,
    prompt_version: PROMPT_VERSION,
  };
  try {
    await insertEssayReport({
      report_id: graded.report_id,
      user_email: email,
      essay_title: essayTitle,
      exam_level: resolvedLevel,
      grade,
      transcript,
      annotations: graded.annotations,
      meta,
      status: 'completed',
    });
  } catch (e) {
    logger.error('[essay.analyze] 报告落库失败', { error: e, reportId: graded.report_id });
    throw new EssayError(ErrorCode.INTERNAL_ERROR, '报告保存失败', null);
  }

  return {
    report_id: graded.report_id,
    transcript,
    annotations: graded.annotations,
    scores: graded.scores,
    comment: graded.comment,
    rubric_id: graded.rubric_id,
    meta,
    image_url: imageUrl,
    subject,
    request_token,
  };
}

/**
 * 两次校验失败后落一条 failed 报告 (便于用户/客服排查, 与列表 status 语义一致)。
 * 该函数本身不再抛错 —— 落库失败只记录日志。
 */
async function markAnalyzeFailed({ email, essayTitle, resolvedLevel, grade, transcript, imageUrl }) {
  const reportId = newReportId();
  try {
    await insertEssayReport({
      report_id: reportId,
      user_email: email,
      essay_title: essayTitle,
      exam_level: resolvedLevel,
      grade,
      transcript,
      annotations: [],
      meta: { image_url: imageUrl, stage: 'grade', prompt_version: PROMPT_VERSION },
      status: 'failed',
      error_message: 'grading_validation_failed',
    });
  } catch (e) {
    logger.error('[essay.analyze] failed 报告落库失败', { error: e, reportId });
  }
  return reportId;
}
