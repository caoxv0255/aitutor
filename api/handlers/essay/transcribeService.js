/* ============================================================================
 * transcribeService.js — D086 §12 L4 V1.0 · Stage A 作文转录
 *
 * 职责: 接收图片 URL 数组, 调用视觉模型 (qwen-vl-max) 逐字转录,
 *       输出结构化 TranscriptResult (含段落/行号/不确定字符).
 *
 * 设计要点 (相对 D086 L4 现状):
 *   - 强 Zod 校验, 失败抛 EssayError(ESSAY_TRANSCRIBE_PARSE_FAILED)
 *   - Patch 1: line_no 弱化, 改为 optional + default(-1), 软警告而非硬失败
 *   - Patch 1: 缺失/异常的 line_no 由 inferLineNumbers() 后处理推断
 *   - Patch 2: 入参 images 改为 URL 数组, 强制走 /api/upload/image 预上传
 *   - 不静默降级: 解析失败 → 422 + ErrorCode, 报告 status=failed
 *
 * 调用方: api/handlers/essay/index.js#transcribeHandler
 * 输出: TranscriptResult, 落库由 handler 调 essayStorage 负责
 * ============================================================================ */

'use strict';

import { z } from 'zod';
import { logger } from '../../core/logger.js';
import { EssayError } from './errors.js';
import { ErrorCode } from '../../utils/errorCodes.js';

// ────────────────────────────────────────────────────────────────────────────
// Patch 2: 入参 Schema
// images 改为 URL 数组, 强制前端先调 /api/upload/image
// 注: z.string().url() 在 Node 22 下会接受 data: URL, 因此用 .refine 强约束 http/https
// ────────────────────────────────────────────────────────────────────────────

const ImageUrlSchema = z
  .string()
  .url({ message: 'images 必须是合法 URL' })
  .refine((val) => /^https?:\/\//i.test(val), {
    message: '图片 URL 必须是 http(s) 协议 (请先调用 /api/upload/image 上传)',
  });

const TranscribeRequestSchema = z.object({
  images: z.array(ImageUrlSchema).min(1, '至少 1 张图片').max(5, '最多 5 张图片'),
  subject: z.enum(['chinese', 'english'], {
    errorMap: () => ({ message: 'subject 必须是 chinese | english' }),
  }),
});

// ────────────────────────────────────────────────────────────────────────────
// Patch 1: 输出 Schema — line_no 弱化为 optional + default(-1)
// 业务层不再硬校验 line_no 连续性, 改为 soft-warn 日志
// ────────────────────────────────────────────────────────────────────────────

const TranscriptLineSchema = z.object({
  line_no: z
    .number()
    .int()
    .optional()
    .default(-1),
  text: z.string().min(1, 'text 不能为空'),
  uncertain_chars: z.array(z.string()).optional().default([]),
});

const TranscriptParagraphSchema = z.object({
  paragraph_index: z.number().int().nonnegative(),
  lines: z.array(TranscriptLineSchema).min(1, '每段至少 1 行'),
});

/**
 * Stage A 输出的根 Schema. paragraph_index 强校验 (段号必须 0 起连续, 因为
 * 前端渲染时用 paragraph_index 做锚点), line_no 弱化.
 */
const TranscribeOutputSchema = z.object({
  paragraphs: z.array(TranscriptParagraphSchema).min(1, '至少 1 个段落'),
  confidence: z.number().min(0).max(1).optional().default(0.5),
  uncertain_total: z.number().int().nonnegative().optional().default(0),
});

// ────────────────────────────────────────────────────────────────────────────
// Patch 1: line_no 推断工具
// ────────────────────────────────────────────────────────────────────────────

/**
 * 推断缺失/异常的 line_no.
 * 规则: 按段落内文本, 在句末标点 (。！？!?\n) 处切分, 重新分配 0,1,2,...
 *      若 paragraph 已有所有 line 的有效 line_no (>=0), 跳过.
 *
 * @param {Array<{paragraph_index:number, lines:Array<{line_no:number, text:string, uncertain_chars:string[]}>}>} paragraphs
 * @returns {Array} 返回新数组 (不修改入参)
 */
export function inferLineNumbers(paragraphs) {
  if (!Array.isArray(paragraphs)) return [];

  return paragraphs.map((para) => {
    if (!Array.isArray(para.lines) || para.lines.length === 0) return para;

    const allValid = para.lines.every((l) => typeof l.line_no === 'number' && l.line_no >= 0);
    if (allValid) return para;

    const fullText = para.lines.map((l) => l.text || '').join('');
    const segments = splitBySentenceEnd(fullText);

    if (segments.length === 0) {
      return {
        ...para,
        lines: para.lines.map((l, i) => ({
          line_no: typeof l.line_no === 'number' && l.line_no >= 0 ? l.line_no : i,
          text: l.text,
          uncertain_chars: l.uncertain_chars || [],
        })),
      };
    }

    return {
      ...para,
      lines: segments.map((text, i) => ({
        line_no: i,
        text,
        uncertain_chars: [],
      })),
    };
  });
}

/**
 * 按句末标点切分字符串, 保留标点 (中文 。！？ + 英文 .!? + 换行).
 */
function splitBySentenceEnd(text) {
  if (!text) return [];
  const re = /[^。！？.!?\n]+[。！？.!?]?/g;
  const matches = text.match(re) || [];
  return matches.map((s) => s.trim()).filter((s) => s.length > 0);
}

// ────────────────────────────────────────────────────────────────────────────
// LLM 调用 (内部 helper, 复用 /api/proxy)
// ────────────────────────────────────────────────────────────────────────────

/**
 * 调视觉模型.
 * @param {object} args
 * @param {Array<{type:string, text?:string, image_url?:{url:string}}>} args.messages
 * @param {string} args.authHeader
 * @param {string} args.proto
 * @param {string} args.host
 * @param {string} [args.task_type='essay_transcribe']
 * @returns {Promise<string>} 原始 LLM content
 */
async function callVLM({ messages, authHeader, proto, host, task_type = 'essay_transcribe' }) {
  const url = `${proto}://${host}/api/proxy`;
  const model = 'qwen-vl-max';
  const temperature = 0.1;
  const max_tokens = 3000;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30_000);

  let resp;
  try {
    resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      body: JSON.stringify({ model, messages, temperature, max_tokens }),
      signal: controller.signal,
    });
  } catch (e) {
    clearTimeout(timeoutId);
    if (e.name === 'AbortError') {
      throw new EssayError(
        ErrorCode.ESSAY_LLM_TIMEOUT,
        '视觉模型响应超时 (>30s), 请重试',
        { task_type, model }
      );
    }
    throw new EssayError(
      ErrorCode.ESSAY_LLM_UPSTREAM_ERROR,
      `无法连接 LLM 网关: ${e.message}`,
      { task_type, model }
    );
  }
  clearTimeout(timeoutId);

  let body;
  try {
    body = await resp.json();
  } catch (e) {
    throw new EssayError(
      ErrorCode.ESSAY_LLM_UPSTREAM_ERROR,
      `LLM 网关返回非 JSON: ${e.message}`,
      { status: resp.status }
    );
  }

  if (!resp.ok || !body.success) {
    const msg = body.message || body.error?.message || `HTTP ${resp.status}`;
    throw new EssayError(
      resp.status >= 500 ? ErrorCode.ESSAY_LLM_UPSTREAM_ERROR : ErrorCode.INTERNAL_ERROR,
      `LLM 网关调用失败: ${msg}`,
      { status: resp.status, task_type, model }
    );
  }

  const content =
    body.data?.choices?.[0]?.message?.content ||
    body.data?.content ||
    (typeof body.data === 'string' ? body.data : null);

  if (!content) {
    throw new EssayError(
      ErrorCode.ESSAY_TRANSCRIBE_PARSE_FAILED,
      'LLM 返回内容为空',
      { raw_excerpt: JSON.stringify(body.data).slice(0, 500) }
    );
  }

  return content;
}

// ────────────────────────────────────────────────────────────────────────────
// JSON 解析 + Zod 校验
// ────────────────────────────────────────────────────────────────────────────

/**
 * 从 LLM 输出中提取 JSON 对象 (兼容 markdown fence + 自由文本).
 */
function parseJsonFromLLM(raw) {
  if (!raw) return null;
  let text = String(raw).trim();

  const fence = text.match(/```(?:json)?\s*([\s\S]+?)\s*```/i);
  if (fence) text = fence[1].trim();

  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end < 0) return null;
  const candidate = text.slice(start, end + 1);

  try {
    return JSON.parse(candidate);
  } catch (_) {
    const fixed = candidate
      .replace(/，/g, ',')
      .replace(/：/g, ':')
      .replace(/；/g, ';')
      .replace(/（/g, '(')
      .replace(/）/g, ')');
    try {
      return JSON.parse(fixed);
    } catch (_) {
      return null;
    }
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Prompt 模板 (Stage A)
// ────────────────────────────────────────────────────────────────────────────

const TRANSCRIBE_PROMPT_CN = `你是一位严谨的中文 OCR 转录员。**你的唯一职责是把图片中的文字逐字转录为结构化 JSON。**
你不是老师，不评价、不修改、不补全任何文字。

[角色边界]
- 你看到的每一个字都必须原样输出，包括错别字、涂改、模糊字。
- 如果某个字模糊看不清，用 [?] 单字符标记，并在该行的 uncertain_chars 数组中列出这些字符。

[严禁行为 — 违反任何一条即视为任务失败]
1. 禁止改正错别字 (如把 "退想" 改成 "遐想")
2. 禁止补全未写完的句子 (如学生只写 "春天来了"，不得补 "万物复苏")
3. 禁止规范化标点 (如把英文逗号 "," 改成中文逗号 "，")
4. 禁止合并段落或拆分段落
5. 禁止删除任何重复行或重写字

[输出结构]
你必须输出以下 JSON 格式，不要包含任何其他文字、markdown 标记或解释:
{
  "paragraphs": [
    {
      "paragraph_index": 0,
      "lines": [
        { "line_no": 0, "text": "完整的一行文字", "uncertain_chars": [] },
        { "line_no": 1, "text": "[?]在草地上奔跑", "uncertain_chars": ["草"] }
      ]
    }
  ],
  "confidence": 0.0 至 1.0,
  "uncertain_total": 不确定字符总数
}

[规则]
- paragraph_index 从 0 开始，必须连续 (0, 1, 2, ...)
- line_no 在每段内从 0 开始。如你无法判断行数，可省略 line_no 字段，由后端自动推断
- 段与段之间用空行分隔 (图片中可见的空行)
- confidence 是你对自己转录准确度的自评 (1.0 = 完全确信, 0.5 = 一半模糊)
- uncertain_total 是不确定字符的总数，用于统计
- 图片如果是多页，按顺序合并 paragraphs，不重新编号

[自检清单 — 输出前必过]
□ 我是否改正了错别字? → 如有，撤回改正
□ 我是否补全了未写完的句子? → 如有，删除补全部分
□ 我是否把图片的标点改了? → 如有，还原
□ uncertain_chars 是否穷举了所有 [?] 位置?
□ paragraph_index 是否从 0 连续递增? (line_no 允许省略)`;

const TRANSCRIBE_PROMPT_EN = `You are a strict OCR transcriber. **Your ONLY job is to transcribe the text in the image verbatim into structured JSON.**
You are not a teacher — do NOT evaluate, correct, or complete any text.

[Role boundary]
- Every character you see must be output as-is, including typos, scribbles, and unclear characters.
- If a character is illegible, mark it with [?] and list it in uncertain_chars.

[STRICTLY FORBIDDEN — violating any = task failure]
1. Do NOT correct typos
2. Do NOT complete unfinished sentences
3. Do NOT normalize punctuation
4. Do NOT merge or split paragraphs
5. Do NOT delete duplicate lines

[Output structure — must be valid JSON, no markdown]
{
  "paragraphs": [
    {
      "paragraph_index": 0,
      "lines": [
        { "line_no": 0, "text": "complete line text", "uncertain_chars": [] }
      ]
    }
  ],
  "confidence": 0.0-1.0,
  "uncertain_total": total uncertain character count
}

[Rules]
- paragraph_index starts at 0, must be consecutive
- line_no starts at 0 within each paragraph. You may omit line_no; backend will infer.
- confidence: 1.0 = fully confident, 0.5 = half unclear`;

// ────────────────────────────────────────────────────────────────────────────
// 主函数: transcribeEssay
// ────────────────────────────────────────────────────────────────────────────

/**
 * Stage A 入口: 图片 → 转录.
 *
 * @param {object} args
 * @param {string[]} args.images      URL 数组 (Patch 2: 已上传到 /api/upload/image)
 * @param {'chinese'|'english'} args.subject
 * @param {object} [args.req]         Express request, 用于透传 auth + proto/host
 * @returns {Promise<{
 *   transcript: {
 *     paragraphs: Array<{paragraph_index:number, lines:Array<{line_no:number, text:string, uncertain_chars:string[]}>}>,
 *     confidence: number,
 *     uncertain_total: number
 *   },
 *   raw_metrics: { prompt_tokens?: number, completion_tokens?: number, model: string, task_type: string }
 * }>}
 * @throws {EssayError}
 */
export async function transcribeEssay({ images, subject, req }) {
  // ─── 1. 入参 Zod 校验 ───
  const reqParse = TranscribeRequestSchema.safeParse({ images, subject });
  if (!reqParse.success) {
    const issue = reqParse.error.issues[0];
    throw new EssayError(
      ErrorCode.VALIDATION_REQUIRED_FIELD,
      `请求参数校验失败: ${issue.path.join('.')} - ${issue.message}`,
      { zod_issues: reqParse.error.issues }
    );
  }

  // ─── 2. 准备 LLM 调用上下文 ───
  const authHeader = req?.headers?.authorization;
  if (!authHeader) {
    throw new EssayError(
      ErrorCode.AUTH_NOT_LOGIN,
      '缺少 Authorization 头 (无法转发到 /api/proxy)',
      null
    );
  }
  const proto = req?.protocol || 'http';
  const host = (req?.get && req.get('host')) || 'localhost:3002';

  const promptText = subject === 'english' ? TRANSCRIBE_PROMPT_EN : TRANSCRIBE_PROMPT_CN;
  const messages = [
    {
      role: 'user',
      content: [
        { type: 'text', text: promptText },
        ...images.map((url) => ({ type: 'image_url', image_url: { url } })),
      ],
    },
  ];

  // ─── 3. 调 VLM ───
  let content;
  try {
    content = await callVLM({ messages, authHeader, proto, host, task_type: 'essay_transcribe' });
  } catch (e) {
    if (e instanceof EssayError) throw e;
    throw new EssayError(
      ErrorCode.ESSAY_LLM_UPSTREAM_ERROR,
      `VLM 调用异常: ${e.message}`,
      { stack: e.stack }
    );
  }

  // ─── 4. 解析 JSON ───
  const parsed = parseJsonFromLLM(content);
  if (!parsed) {
    logger.error('[essay.transcribe] JSON 解析失败', {
      content_excerpt: content.slice(0, 500),
    });
    throw new EssayError(
      ErrorCode.ESSAY_TRANSCRIBE_PARSE_FAILED,
      'AI 老师暂时无法理解这张作文图片 (JSON 解析失败), 请重新拍摄或换张图片',
      { raw_excerpt: content.slice(0, 500) }
    );
  }

  // ─── 5. Zod 强校验 ───
  const zodResult = TranscribeOutputSchema.safeParse(parsed);
  if (!zodResult.success) {
    logger.error('[essay.transcribe] Zod 校验失败', {
      issues: zodResult.error.issues,
      parsed_excerpt: JSON.stringify(parsed).slice(0, 500),
    });
    throw new EssayError(
      ErrorCode.ESSAY_TRANSCRIBE_PARSE_FAILED,
      `AI 输出不符合转录 Schema: ${zodResult.error.issues[0]?.message}`,
      { zod_issues: zodResult.error.issues }
    );
  }

  const data = zodResult.data;

  // ─── 6. 业务校验 ───
  // 6.1 paragraph_index 必须从 0 起连续 (前端锚点, 硬性约束)
  for (let i = 0; i < data.paragraphs.length; i++) {
    if (data.paragraphs[i].paragraph_index !== i) {
      throw new EssayError(
        ErrorCode.ESSAY_TRANSCRIBE_PARSE_FAILED,
        `paragraph_index 不连续: 期望 ${i}, 实际 ${data.paragraphs[i].paragraph_index}`,
        { got: data.paragraphs[i].paragraph_index, expected: i }
      );
    }
  }

  // 6.2 line_no 连续性: Patch 1 弱化, 仅 soft-warn
  for (let i = 0; i < data.paragraphs.length; i++) {
    const para = data.paragraphs[i];
    const lineNos = para.lines.map((l) => l.line_no);
    const hasAnyValid = lineNos.some((n) => n >= 0);
    if (hasAnyValid) {
      const sortedNos = [...lineNos].filter((n) => n >= 0).sort((a, b) => a - b);
      const isContinuous = sortedNos.every((n, i) => n === i);
      if (!isContinuous) {
        logger.warn('[essay.transcribe] line_no 不连续, 将由 inferLineNumbers 修复', {
          paragraph_index: i,
          line_nos: lineNos,
        });
      }
    } else {
      logger.info('[essay.transcribe] line_no 全部缺失, 走 inferLineNumbers', {
        paragraph_index: i,
        line_count: para.lines.length,
      });
    }
  }

  // ─── 7. Patch 1: 推断缺失/异常的 line_no ───
  const normalizedParagraphs = inferLineNumbers(data.paragraphs);

  // ─── 8. 重新计算 uncertain_total ───
  const uncertain_total = normalizedParagraphs.reduce(
    (sum, p) => sum + p.lines.reduce((s, l) => s + (l.uncertain_chars?.length || 0), 0),
    0
  );

  // ─── 9. 组装返回 ───
  // request_token: 透传给 Stage B 做 idempotency, 防止双击导致重复批改
  // 格式: tx_<ts36>_<rand8> (与 newReportId 同风格)
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  const request_token = `tx_${ts}_${rand}`;

  return {
    transcript: {
      paragraphs: normalizedParagraphs,
      confidence: data.confidence,
      uncertain_total,
    },
    request_token,
    raw_metrics: {
      model: 'qwen-vl-max',
      task_type: 'essay_transcribe',
      original_paragraph_count: data.paragraphs.length,
      normalized_paragraph_count: normalizedParagraphs.length,
    },
  };
}
