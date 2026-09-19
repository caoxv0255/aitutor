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

const VALID_GRADES = new Set([
  '初一', '初二', '初三',
  '高一', '高二', '高三',
]);

const VALID_LEVELS = new Set(['gaokao', 'zhongkao']);

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

  // 调用 /api/proxy
  const proto = (req && req.protocol) || 'http';
  const host  = (req && req.get && req.get('host')) || 'localhost:3002';
  const url = `${proto}://${host}/api/proxy`;

  let resp, body;
  try {
    resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens }),
    });
    body = await resp.json();
  } catch (e) {
    logger.error?.('[essay] LLM call failed', { error: e.message });
    return { success: false, error: 'LLM_CALL_FAILED' };
  }

  if (!resp.ok || !body.success) {
    return { success: false, error: body.message || 'LLM_ERROR' };
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
