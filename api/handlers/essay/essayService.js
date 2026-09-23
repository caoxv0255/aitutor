/* ============================================================================
 * essayService.js — D086 §12 L4 · 作文批改主流程
 *
 * 流程：
 *   1. 接收 images[] + essay_title + exam_level + grade
 *   2. 调用 ESSAY_GRADING Prompt + qwen-vl-plus 视觉模型（OCR + 批改）
 *   3. 解析模型返回的 JSON（容忍多种格式）
 *   4. 调用 reconcile 把"原文引用"对齐到段落字符偏移
 *   5. 持久化到 essay_reports
 *
 * 设计：
 *   - LLM 调用复用现有 /api/proxy（auth + rate limit 已就绪）
 *   - 容错：模型返回格式异常时降级为部分结果（不中断）
 *   - 测试友好：导出 _internalLLMCall 便于 mock
 * ============================================================================ */

'use strict';

import { logger } from '../../core/logger.js';
import { PROMPTS, PROMPT_VERSION } from '../../utils/prompts.js';
import { reconcile, newReportId } from './essayReconcile.js';
import { insertEssayReport } from './essayStorage.js';
import { isAllowedImageUrl } from './imageHostPolicy.js';

const VALID_GRADES = new Set([
  '初一', '初二', '初三',
  '高一', '高二', '高三',
]);

const VALID_LEVELS = new Set(['gaokao', 'zhongkao']);

// 服务端自调用基址 (2026-09-22 SSRF 修复):
//   内部 fetch 的目标只能取自配置或本进程监听端口, 不得取自 req 的 Host /
//   X-Forwarded-Host / protocol —— 那些由客户端可控, 会把携带调用方 JWT 的
//   服务端请求引到任意主机。写法与 api/routes/rag-search.js 的内部自调用一致。
const SELF_BASE_URL = process.env.SELF_BASE_URL || `http://127.0.0.1:${process.env.PORT || 3002}`;

// M-3 (2026-09-23): 图片 URL 宿主白名单 —— 逻辑在 ./imageHostPolicy.js (transcribeService
//   共用同一份实现)。配置优先级: ESSAY_IMAGE_HOSTS > (回退) ALLOWED_ORIGINS,
//   loopback 与 SELF_BASE_URL 的 host 恒定放行。详见该文件的头注释。
// ────────────────────────────────────────────────────────────────────────────

/**
 * LLM 调用（可被 mock）
 * 通过 fetch /api/proxy 走统一网关
 * @returns {Promise<{success, data, model, fallback_used, raw}>}
 */
export async function _internalLLMCall({ images, essay_title, exam_level, grade, req }) {
  // 由调用方注入 req（如有）
  const authHeader = req && req.headers && req.headers.authorization;
  if (!authHeader) {
    return { success: false, error: 'NO_AUTH' };
  }

  const promptCfg = PROMPTS.IMAGE_RECOGNITION;
  const model = promptCfg.model; // 'qwen-vl-plus'
  const temperature = promptCfg.temperature;
  const maxTokens = promptCfg.maxTokens;

  // 构造 messages
  const userText = promptCfg.build('作文', grade);
  const messages = [
    {
      role: 'user',
      content: [
        { type: 'text', text: userText + `\n\n作文标题：${essay_title || '未命名'}` },
        ...images.map(url => ({ type: 'image_url', image_url: { url } })),
      ],
    },
  ];

  // 调用 /api/proxy (自身基址, 非请求头)
  const url = `${SELF_BASE_URL}/api/proxy`;

  let resp, body;
  try {
    resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // 保留转发调用者自己的 JWT (2026-09-22 链路分析):
        //   /api/proxy 挂在 authMiddleware + per-user 限流之后 (server.js:468),
        //   handler 依赖 req.user 归账 ai_trace —— 不带 JWT 会直接 401, grading 即坏。
        //   该 JWT 只发往固定 loopback, 且本就是调用者自己的凭证 (他本可直接调
        //   /api/proxy), 转发不新增任何权限; SSRF 风险在"目的地址客户端可控",
        //   已由 SELF_BASE_URL 消除。引入内部服务凭证需改全局 authMiddleware,
        //   超出本次修复射程。
        'Authorization': authHeader,
      },
      body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens }),
    });
    body = await resp.json();
  } catch (e) {
    logger.error?.('[essay] LLM call failed', { error: e.message });
    return { success: false, error: 'LLM_CALL_FAILED' };
  }

  // 2026-09-21 (G10): /api/proxy 成功时返回原生 OpenAI 格式(choices/usage)，
  // 没有 success 字段 —— 旧判定 body.success 恒为 falsy，导致 LLM 调用即使成功
  // 也被当作 LLM_ERROR（essay 上线以来从未真正出过报告的根因，E2E 实测）。
  if (!resp.ok) {
    return { success: false, error: body.message || body.error?.message || 'LLM_ERROR' };
  }

  return {
    success: true,
    data: body.data,
    model: body.data?.model || model,
    fallback_used: body.data?.fallback_used === true,
  };
}

/**
 * 解析 LLM 返回的 JSON
 * 模型可能返回：
 *   (1) 标准 JSON 字符串
 *   (2) ```json ... ``` markdown 包裹
 *   (3) 自由文本 + JSON
 * 容错策略：尽量提取，失败时返回 null
 */
export function parseLLMJsonOutput(rawContent) {
  if (!rawContent) return null;
  let text = String(rawContent).trim();

  // 去除 markdown 包裹
  const codeBlock = text.match(/```(?:json)?\s*([\s\S]+?)\s*```/i);
  if (codeBlock) text = codeBlock[1].trim();

  // 提取首个 { ... } JSON 对象
  const braceStart = text.indexOf('{');
  const braceEnd   = text.lastIndexOf('}');
  if (braceStart < 0 || braceEnd < 0) return null;
  const candidate = text.slice(braceStart, braceEnd + 1);

  try {
    return JSON.parse(candidate);
  } catch (_) {
    // 尝试容错：替换中文标点为英文
    const fixed = candidate
      .replace(/，/g, ',')
      .replace(/：/g, ':')
      .replace(/；/g, ';')
      .replace(/（/g, '(')
      .replace(/）/g, ')');
    try { return JSON.parse(fixed); } catch (_) { return null; }
  }
}

/**
 * 主入口：gradeEssay
 * @param {object} params
 *   - user_email
 *   - images: string[] (data: URL)
 *   - essay_title, exam_level, grade
 *   - req: Express request（用于透传 auth header 到 /api/proxy）
 * @returns {Promise<{success, data, reportId}>}
 */
export async function gradeEssay({ user_email, images, essay_title, exam_level, grade, req }) {
  // 0. 校验
  if (!Array.isArray(images) || images.length === 0) {
    return { success: false, message: 'images 必填' };
  }
  // M-3: 宿主白名单 —— 拒绝任意站点的图片地址 (含 data: / ftp: / 内网地址)
  if (images.some((u) => !isAllowedImageUrl(u))) {
    // 不落 image 原文: 可能带 query token / 用户上传文件名
    logger.warn?.('[essay] image host rejected', { reason: 'not in image host whitelist' });
    return { success: false, message: 'images 只接受本站上传的 http(s) 图片地址 (请先调用 /api/upload/image)' };
  }
  if (!VALID_LEVELS.has(exam_level)) {
    return { success: false, message: 'exam_level 非法' };
  }
  if (!VALID_GRADES.has(grade)) {
    return { success: false, message: 'grade 非法' };
  }

  // 1. 调用 LLM
  const llmRes = await _internalLLMCall({ images, essay_title, exam_level, grade, req });
  if (!llmRes.success) {
    return { success: false, message: `LLM 调用失败：${llmRes.error || '未知'}` };
  }

  // 2. 解析 JSON
  //    llmRes.data 可能是 { choices: [{ message: { content: '...' } }] }（OpenAI 格式）
  //    或已经直接是 essay JSON
  let content;
  if (llmRes.data && llmRes.data.choices && llmRes.data.choices[0]) {
    content = llmRes.data.choices[0].message?.content;
  } else if (typeof llmRes.data === 'string') {
    content = llmRes.data;
  } else {
    content = llmRes.data?.content;
  }

  const parsed = parseLLMJsonOutput(content) || { clue: [], solution: [], analysis: [], metadata: { scores: {} } };

  // 3. OCR 段落提取（简化：用模型返回的 transcript 或 fallback 切句）
  const paragraphs = extractParagraphs(parsed, content);

  // 4. reconcile
  const { annotations, metrics } = reconcile(paragraphs, parsed);

  // 5. 报告 ID + 持久化
  const reportId = newReportId();
  const meta = {
    requested_model: PROMPTS.IMAGE_RECOGNITION.model,
    model:           llmRes.model,
    fallback_used:   llmRes.fallback_used === true,
    confidence:      Math.min(0.99, 0.7 + metrics.anchor_rate * 0.3),
    prompt_version:  PROMPT_VERSION,
    scores:          parsed.metadata?.scores || parsed.scores || {},
    summary:         parsed.summary || '',
  };
  try {
    await insertEssayReport({
      report_id:   reportId,
      user_email,
      essay_title, exam_level, grade,
      transcript:  { paragraphs },
      annotations,
      meta,
      status: 'completed',
    });
  } catch (e) {
    logger.error?.('[essay] insert failed', { error: e.message, reportId });
    return { success: false, message: '持久化失败', reportId };
  }

  return {
    success: true,
    data: {
      meta,
      transcript: { paragraphs },
      annotations,
      scores:     meta.scores,
      summary:    meta.summary,
    },
    reportId,
  };
}

/**
 * OCR 段落提取（简版）
 * 优先用 LLM 返回的 transcript.paragraphs，否则从 LLM content 抽取段落
 */
export function extractParagraphs(parsed, content) {
  if (Array.isArray(parsed.transcript?.paragraphs) && parsed.transcript.paragraphs.length > 0) {
    return parsed.transcript.paragraphs;
  }
  // 退化：从 LLM content 抽取（按段落 / 换行 / 句号 切）
  if (!content) {
    return [{ id: 'p1', text: '' }];
  }
  // 简化：按换行 + 中文句号切
  const raw = String(content).replace(/【[^】]*】/g, '').trim();
  const segments = raw.split(/[\n\r。]+/).map(s => s.trim()).filter(s => s.length > 2);
  if (segments.length === 0) return [{ id: 'p1', text: raw }];
  return segments.map((text, i) => ({ id: `p${i + 1}`, text }));
}
