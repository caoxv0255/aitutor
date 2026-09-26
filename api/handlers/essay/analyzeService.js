/* ============================================================================
 * analyzeService.js — 作文智能批改「analyze」编排 (2026-09-25)
 *
 * 职责: 一张图片 → OCR(私有 MaaS 视觉) → 批改(Stage B) → 落库 essay_reports。
 *       **复用**现有 V1.0 两阶段能力, 不新增第二套契约:
 *         - 转录 prompt / 解析 / Zod / line_no 推断 → transcribeService.js
 *         - 批改 prompt / rubric / 锚定 / 输出 Schema → gradeService.js
 *         - 落库 → essayStorage.js ; 报告 ID → essayReconcile.newReportId
 *         - 图片落盘 → upload/imageHandler.saveImageFromBase64 (同一存储方案)
 *         - 视觉通路 → services/llm.js maasVisionChatCompletion (私有 MaaS qwen3-vl)
 *
 * 与既有 V0 (essayService.js, /api/essay/grade) 的关系:
 *   V0 仍在役、frontend-v2 在消费, 本模块**不改动**它; analyze 是走 V1.0 服务的新入口。
 *
 * ── 2026-09-26: 改异步 (根治 48.5s 同步等待) ──────────────────────────────
 *   startAnalyze()  只做「入参校验 + 建 pending 行」, 立即返回 (实测 < 1s);
 *   runAnalyzeJob() 在**后台**跑 图片落盘 → 转录 → 批改 → 写回结果
 *                   (completed / failed), 不占用请求连接。
 *   前端改轮询 /api/essay/report/:reviewId 读 status (pending → completed)。
 *
 *   为什么**不引入进程内队列**: analyze 已有 analyzeLimiter 5/min/用户, 单实例
 *   在飞任务上界由限流器决定; 加队列只会把失败延迟化, 且队列本身随进程重启丢失
 *   (与下面的孤儿恢复机制冲突)。并发只做可观测 (日志打 in_flight), 堆积由孤儿
 *   回收 + 5/min 限流共同兜底。
 *
 *   孤儿恢复: startPendingReclaimer() 在进程启动时扫一次 + 之后每 60s 扫一次,
 *   把「创建超过 PENDING_TIMEOUT_MS 仍是 pending」的行标 failed(pending_timeout)。
 *   这样服务重启后不会留下永远 pending 的悬空行。
 *
 * 校验失败重试: 批改输出 Schema 校验失败 → 打印原始返回 + 重试一次;
 *   两次仍失败 → 该行标 failed (error_message 用**固定错误码**, 不回显 err.message)。
 * ============================================================================ */

'use strict';

import { z } from 'zod';
import { logger } from '../../core/logger.js';
import { EssayError } from './errors.js';
import { ErrorCode } from '../../utils/errorCodes.js';
import { isAllowedImageUrl } from './imageHostPolicy.js';
import { buildTranscribePrompt, parseAndValidateTranscript } from './transcribeService.js';
import { gradeEssay as gradeEssayStageB } from './gradeService.js';
import {
  insertEssayReport,
  updateEssayReportResult,
  markEssayFailed,
  reclaimStalePending,
  PENDING_TIMEOUT_MS,
} from './essayStorage.js';
import { newReportId } from './essayReconcile.js';
import { saveImageFromBase64 } from '../upload/imageHandler.js';
import { maasVisionChatCompletion } from '../../../services/llm.js';

const DEFAULT_ESSAY_TITLE = '未命名';
const PROMPT_VERSION = '3.1.0'; // 与 prompts/grade.v1.txt 的 prompt_version 对齐 (批次 2 扩展)

// essay_title 列 VARCHAR(255), GradeRequestSchema.essay_title 亦 max(255) —— 题目
// 文本按此上限截断, 保证「写入 DB 的标题」与「喂进 prompt 的题目」是同一个字符串。
const MAX_ESSAY_TITLE_LEN = 255;

/** 孤儿回收扫描间隔 (进程内定时, unref 不阻止退出) */
const RECLAIM_INTERVAL_MS = 60_000;

/** 后台在飞任务计数 (只做可观测, 不做排队/拒绝) */
let inFlight = 0;

// ────────────────────────────────────────────────────────────────────────────
// 入参 Schema
// ────────────────────────────────────────────────────────────────────────────

const SPECIFIC_GRADES = ['初一', '初二', '初三', '高一', '高二', '高三'];

const AnalyzeRequestSchema = z.object({
  image: z.string().min(1, 'image 必填'),
  // 2026-09-26: 作文题目图 (可选)。校验语义与 image 一致 (base64/dataURL/白名单 URL,
  // 由 resolveImage 逐分支处理); shape 照抄 image, 不自创类型。
  title_image: z.string().min(1).optional(),
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

/**
 * resolveImage 的「不抛错」包装: 把归一失败翻成 {ok:false, errorCode}。
 * 内容图与题目图共用同一套错误映射 (EssayError.code 优先, 其次 uploadCode),
 * 保证两条路径的失败码语义完全一致。
 *
 * @returns {Promise<{ok:true, visionImage:object, imageUrl:string}
 *                  | {ok:false, errorCode:string}>}
 */
async function resolveImageOrFail(job, image, label) {
  try {
    const { visionImage, imageUrl } = await resolveImage(image, { email: job.email });
    return { ok: true, visionImage, imageUrl };
  } catch (e) {
    if (e instanceof EssayError) return { ok: false, errorCode: e.code };
    if (e && e.uploadCode) return { ok: false, errorCode: e.uploadCode }; // imageHandler 错误码
    logger.error(`[essay.analyze] ${label}图片处理未知异常`, { error: e, reportId: job.reportId });
    return { ok: false, errorCode: 'image_error' };
  }
}

/**
 * 把题目图 (Stage A 同一套视觉转录链路) 的转录结果压成一行题目文本。
 * 纯函数, 便于单测。
 *
 * @param {object} transcript parseAndValidateTranscript 产出的 transcript
 * @returns {string} 折叠空白后 ≤ MAX_ESSAY_TITLE_LEN 的单行文本 (无内容 → '')
 */
export function deriveEssayTitleFromTranscript(transcript) {
  if (!transcript || !Array.isArray(transcript.paragraphs)) return '';
  const parts = [];
  for (const p of transcript.paragraphs) {
    for (const l of p.lines || []) {
      if (l && typeof l.text === 'string' && l.text.trim()) parts.push(l.text.trim());
    }
  }
  return parts.join(' ').replace(/\s+/g, ' ').trim().slice(0, MAX_ESSAY_TITLE_LEN);
}

/**
 * 题目图 → 题目文本。复用 Stage A 的转录 prompt + 解析/Zod 校验 + 私有 MaaS
 * 视觉通路 (qwen3-vl), **不新增任何第三方依赖, 不改 services/llm.js 的 MaaS 分支**。
 * 与内容图同源, 仅 task_type 区分为 essay_transcribe_title (可观测)。
 *
 * @throws {EssayError} 视觉调用/解析失败时抛出 (调用方决定是否致命)
 */
async function transcribeTitleText({ visionImage, subject, email, requestId }) {
  const visionRes = await maasVisionChatCompletion({
    userText: buildTranscribePrompt(subject),
    images: [visionImage],
    options: {
      jsonMode: true,
      temperature: 0.1,
      max_tokens: 3000,
      task_type: 'essay_transcribe_title',
      user_id: email,
      request_id: requestId,
    },
  });
  const { transcript } = parseAndValidateTranscript(visionRes.content);
  return deriveEssayTitleFromTranscript(transcript);
}

// ────────────────────────────────────────────────────────────────────────────
// Stage B 产出 → meta 映射 (增量兼容 V0)
//
// 缺口 (批次 3 发现): V0 (essayService.js) 落库时写 meta.scores(对象) + meta.summary
// (字符串), 而 V1 的 graded.scores / graded.comment **没进 meta** → 新链路
// POST /api/essay/report/:reviewId 只回 essay_reports 行, 故取不到总分/总评。
//
// 映射 (键名对齐 V0, 不改任何既有键):
//   graded.scores  → meta.scores   同 V0: 对象 { content, language, structure,
//                                    development, total } (含 total, 供总分)
//   graded.comment → meta.summary  同 V0: 字符串 (V0 的总评键名就是 summary)
//
// 只在字段真实存在时写入: 模型未给 (或为空) 则不写该键, 保持缺失, 让前端继续
// 如实标注「未包含」——**绝不造占位**。
// ────────────────────────────────────────────────────────────────────────────

/**
 * @param {object} graded Stage B (gradeService.gradeEssay) 的产出
 * @returns {object} 仅含真实存在的 scores / summary (可能为 {})
 */
export function mapGradedToMeta(graded) {
  const out = {};
  if (graded && graded.scores && typeof graded.scores === 'object') {
    out.scores = graded.scores;
  }
  if (graded && typeof graded.comment === 'string' && graded.comment.trim()) {
    out.summary = graded.comment;
  }
  return out;
}

/**
 * 组装落库用 meta (analyze 成功路径的唯一来源, 供落库与验证复用)。
 * = Stage B meta + V0 兼容的 scores/summary + 图片/学科/prompt 元信息。
 * @param {object} graded Stage B 产出
 * @param {{imageUrl:string, subject:string}} extra
 * @returns {object}
 */
export function buildReportMeta(graded, { imageUrl, subject, titleImageUrl = null }) {
  const meta = {
    ...(graded && graded.meta),
    ...mapGradedToMeta(graded),
    image_url: imageUrl,
    subject,
    prompt_version: PROMPT_VERSION,
  };
  // 题目图存在时才加该键 —— 不传 title_image 的老调用方 meta 形状不变。
  if (titleImageUrl) meta.title_image_url = titleImageUrl;
  return meta;
}

// ────────────────────────────────────────────────────────────────────────────
// 主入口
// ────────────────────────────────────────────────────────────────────────────

/**
 * 异步入口: 只做入参校验 + 建 pending 行, **立即返回**。
 *
 * 返回码沿用仓库现状 —— successJson 恒 200 (api/utils/response.js), 全仓无 202
 * 先例; AIAPI.request 对 2xx 一视同仁 (res.ok 判据), 异步语义由 data.status
 * 表达, 不靠 HTTP 码。
 *
 * @param {object} args
 * @param {object} args.req  Express request (取 user.email / authorization / traceId)
 * @param {function} [args.dispatch] 后台派发器 (默认 fire-and-forget runAnalyzeJob;
 *        测试可注入以单测「同步路径不碰重活」)
 * @returns {Promise<{report_id:string, status:'pending'}>}
 * @throws {EssayError}
 */
export async function startAnalyze({ req, dispatch }) {
  const email = req?.user?.email;
  if (!email) {
    throw new EssayError(ErrorCode.AUTH_NOT_LOGIN, '请先登录', null);
  }
  const authHeader = req?.headers?.authorization;
  if (!authHeader) {
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
  const { image, title_image, subject, grade: rawGrade, essay_title, exam_level } = parsed.data;
  const essayTitle = essay_title || DEFAULT_ESSAY_TITLE;
  const { exam_level: resolvedLevel, grade } = resolveExamLevel(rawGrade, exam_level);

  // ─── 2. 建 pending 行 (唯一一次 DB 写, 毫秒级) ───
  const reportId = newReportId();
  try {
    await insertEssayReport({
      report_id: reportId,
      user_email: email,
      essay_title: essayTitle,
      exam_level: resolvedLevel,
      grade,
      transcript: { paragraphs: [] },
      annotations: [],
      meta: { subject, prompt_version: PROMPT_VERSION, stage: 'pending' },
      status: 'pending',
    });
  } catch (e) {
    logger.error('[essay.analyze] pending 行落库失败', { error: e, reportId });
    throw new EssayError(ErrorCode.INTERNAL_ERROR, '报告创建失败', null);
  }

  // ─── 3. 后台跑 (不 await; 请求已可返回) ───
  // 注意: 只把**字符串** authHeader 带进后台, 不持有 req (响应结束后 req 即失效)。
  const job = {
    reportId,
    email,
    authHeader,
    image,
    // 题目图 base64 必须在后台任务存活期内可用 —— 与 image 同一机制 (随 job 闭包),
    // 不置于请求作用域。
    titleImage: title_image || null,
    subject,
    essayTitle,
    examLevel: resolvedLevel,
    grade,
    requestId: req.traceId || req.requestId || null,
  };
  const kick = typeof dispatch === 'function' ? dispatch : (j) => { void runAnalyzeJob(j); };
  kick(job);

  return { report_id: reportId, status: 'pending' };
}

/**
 * 后台任务: 图片落盘 → 转录 → 批改 → 写回结果。
 *
 * **永不抛错** —— 任何失败都落到该行的 status='failed' + 固定 error_message
 * (错误码字符串, 绝不写 err.message —— 第 11 段)。
 *
 * @param {object} job
 * @returns {Promise<{status: 'completed'|'failed'}>}
 */
export async function runAnalyzeJob(job) {
  inFlight += 1;
  try {
    // ─── 1. 图片归一 (落盘在此, 不阻塞 analyze 的返回) ───
    const contentImg = await resolveImageOrFail(job, job.image, '内容');
    if (!contentImg.ok) return fail(job, contentImg.errorCode);
    const visionImage = contentImg.visionImage;
    const imageUrl = contentImg.imageUrl;

    // ─── 1b. 题目图归一 (可选; 与内容图同一落盘/校验机制) ───
    //   题目图非法规格 (非 base64 / 解码为空 / 过小) 会在此或视觉调用处暴露 →
    //   整篇标 failed, 不回显 err.message (与内容图同一错误码映射)。
    let titleVisionImage = null;
    let titleImageUrl = null;
    if (job.titleImage) {
      const titleImg = await resolveImageOrFail(job, job.titleImage, '题目');
      if (!titleImg.ok) return fail(job, titleImg.errorCode);
      titleVisionImage = titleImg.visionImage;
      titleImageUrl = titleImg.imageUrl;
    }

    // ─── 2. Stage A: 私有 MaaS 视觉 OCR ───
    let visionRes;
    try {
      visionRes = await maasVisionChatCompletion({
        userText: buildTranscribePrompt(job.subject),
        images: [visionImage],
        options: {
          jsonMode: true,
          temperature: 0.1,
          max_tokens: 3000,
          task_type: 'essay_transcribe',
          user_id: job.email,
          request_id: job.requestId,
        },
      });
    } catch (e) {
      logger.error('[essay.analyze] MaaS 视觉调用失败', { error: e, reportId: job.reportId });
      return fail(job, ErrorCode.ESSAY_LLM_UPSTREAM_ERROR);
    }

    let transcript;
    let request_token;
    try {
      ({ transcript, request_token } = parseAndValidateTranscript(visionRes.content));
    } catch (e) {
      if (e instanceof EssayError) return fail(job, e.code); // 已含 ESSAY_TRANSCRIBE_PARSE_FAILED
      return fail(job, ErrorCode.ESSAY_TRANSCRIBE_PARSE_FAILED);
    }

    // ─── 2b. 题目图 → 题目文本 (复用同一转录链路) ───
    //   题目文本是「写入 essay_title」与「喂进批改 prompt」的同一份字符串。
    //   题目图存在但转写失败 → 标 failed (同内容图口径); 不传 title_image 时这段
    //   整体跳过, 标题与 prompt 与改动前完全一致 (向后兼容)。
    let titleText = '';
    if (titleVisionImage) {
      try {
        titleText = await transcribeTitleText({
          visionImage: titleVisionImage,
          subject: job.subject,
          email: job.email,
          requestId: job.requestId,
        });
      } catch (e) {
        if (e instanceof EssayError) return fail(job, e.code);
        logger.error('[essay.analyze] 题目图转写失败', { error: e, reportId: job.reportId });
        return fail(job, ErrorCode.ESSAY_LLM_UPSTREAM_ERROR);
      }
    }
    // 题目图给出文本时以它为准; 否则回落既有逻辑 (显式 essay_title 或默认「未命名」)
    const finalTitle = titleText || job.essayTitle;

    // ─── 3. Stage B: 批改 (Schema 校验失败重试一次) ───
    const gradeArgs = {
      user_email: job.email,
      transcript,
      essay_title: finalTitle,
      // 题目缺失 (老调用方) → undefined (不能传 null: GradeRequestSchema 是
      // z.string().optional()，null 会校验失败) → gradeService 不展开题目槽位, prompt 不变
      essay_requirement: titleText || undefined,
      exam_level: job.examLevel,
      grade: job.grade,
      subject: job.subject,
      request_token,
      // gradeService 只用它取 headers.authorization 转发给 /api/proxy
      req: { headers: { authorization: job.authHeader } },
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
            reportId: job.reportId,
            raw_excerpt: e.details?.raw_excerpt || null,
            zod_issues: e.details?.zod_issues || null,
          });
          continue;
        }
        break;
      }
    }

    if (!graded) {
      if (lastErr instanceof EssayError) return fail(job, lastErr.code);
      logger.error('[essay.analyze] 批改阶段未知异常', { error: lastErr, reportId: job.reportId });
      return fail(job, ErrorCode.ESSAY_LLM_UPSTREAM_ERROR);
    }

    // ─── 4. 写回结果 (含顶层 score, 与 meta.scores.total 同源) ───
    const meta = buildReportMeta(graded, {
      imageUrl,
      subject: job.subject,
      titleImageUrl,
    });
    try {
      await updateEssayReportResult(job.reportId, {
        transcript,
        annotations: graded.annotations,
        meta,
        status: 'completed',
        score: graded.scores?.total ?? null,
        // 有题目文本才覆盖 pending 行的默认标题; 无 (老调用方) → null → COALESCE 保留原值
        essay_title: titleText || null,
      });
    } catch (e) {
      logger.error('[essay.analyze] 结果写回失败', { error: e, reportId: job.reportId });
      return fail(job, ErrorCode.INTERNAL_ERROR);
    }

    logger.info(`[essay.analyze] 批改完成: ${job.reportId}, score=${graded.scores?.total ?? 'null'}, in_flight=${inFlight}`, {
      reportId: job.reportId,
      score: graded.scores?.total ?? null,
      in_flight: inFlight,
    });
    return { status: 'completed' };
  } finally {
    inFlight -= 1;
  }
}

/**
 * 标记失败 (写 error_message = 错误码字符串, 不写 err.message)。
 * 返回统一形状, 便于调用方与测试断言。
 */
async function fail(job, errorCode) {
  try {
    await markEssayFailed(job.reportId, errorCode || ErrorCode.INTERNAL_ERROR);
  } catch (e) {
    logger.error('[essay.analyze] failed 状态写回失败', { error: e, reportId: job.reportId });
  }
  return { status: 'failed', error_code: errorCode || ErrorCode.INTERNAL_ERROR };
}

/**
 * 挂上孤儿回收: 调用时刻立刻扫一次, 之后每 RECLAIM_INTERVAL_MS 扫一次。
 *
 * 由 api/routes/essay-review.js 在模块加载时调用 —— 该模块被 server.js 启动时
 * import, 等价于「进程启动即回收」, 不需要改 server.js 的挂载区。
 *
 * @param {object} [opts]
 * @returns {function} 停止函数 (供测试收尾)
 */
export function startPendingReclaimer(opts = {}) {
  const timeoutMs = opts.timeoutMs || PENDING_TIMEOUT_MS;
  const intervalMs = opts.intervalMs || RECLAIM_INTERVAL_MS;
  const run = opts.reclaim || reclaimStalePending;

  const tick = async () => {
    try {
      const reclaimed = await run(timeoutMs);
      if (Array.isArray(reclaimed) && reclaimed.length > 0) {
        // 注: logger.js 只透传白名单 meta 键 (error/user/requestId/...), 本处的
        // count/report_ids 不会进日志行 —— 故把条数与阈值并进 message, 保证可见。
        logger.warn(`[essay.analyze] 回收超时未完成的 pending 报告: ${reclaimed.length} 条, timeout=${timeoutMs}ms`, {
          count: reclaimed.length,
          report_ids: reclaimed,
          timeout_ms: timeoutMs,
        });
      }
    } catch (e) {
      logger.error('[essay.analyze] pending 回收扫描失败', { error: e });
    }
  };

  void tick();
  const timer = setInterval(() => void tick(), intervalMs);
  if (typeof timer.unref === 'function') timer.unref(); // 不阻止进程退出
  return () => clearInterval(timer);
}
