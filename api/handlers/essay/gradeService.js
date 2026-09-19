/* ============================================================================
 * gradeService.js — D086 §12 L4 V1.0 · Stage B 作文批改
 *
 * 职责: 接收 Stage A 的转录结果, 调用文本模型 (qwen-plus) 严格按 JSON Schema
 *       输出批注 (含 anchor.quote) + 4 维评分 + 总评 + rubric_id.
 *
 * 设计要点:
 *   - 强 Zod 校验, 失败抛 EssayError(ESSAY_GRADE_PARSE_FAILED), 报告 status=failed
 *   - Patch 3: formatTranscriptForPrompt() 把转录结果压成 [段落 X] 格式,
 *     大幅省 token + 提升 LLM 注意力 (避免 JSON.stringify 的元字符噪音)
 *   - Rubric 配置化: api/handlers/essay/rubrics/<subject>_<exam_level>_v1.json
 *   - 锚定走 essayReconcile.reconcile()
 *
 * 调用方: api/handlers/essay/index.js#gradeHandler
 * ============================================================================ */

'use strict';

import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { z } from 'zod';
import { logger } from '../../core/logger.js';
import { EssayError } from './errors.js';
import { ErrorCode } from '../../utils/errorCodes.js';
import { loadRubric, renderRubricTable } from './rubricLoader.js';
import { reconcile, newReportId } from './essayReconcile.js';

// ────────────────────────────────────────────────────────────────────────────
// 当前文件所在目录 (用于读 prompts/*.txt)
// ────────────────────────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROMPTS_DIR = join(__dirname, 'prompts');

// ────────────────────────────────────────────────────────────────────────────
// 入参 Schema
// ────────────────────────────────────────────────────────────────────────────

const TranscriptResultSchema = z.object({
  paragraphs: z.array(
    z.object({
      paragraph_index: z.number().int().nonnegative(),
      lines: z.array(
        z.object({
          line_no: z.number().int().default(-1),
          text: z.string().min(1),
          uncertain_chars: z.array(z.string()).optional().default([]),
        })
      ),
    })
  ),
  confidence: z.number().min(0).max(1).optional(),
  uncertain_total: z.number().int().nonnegative().optional().default(0),
});

const GradeRequestSchema = z.object({
  transcript: TranscriptResultSchema,
  essay_title: z.string().min(1).max(255),
  exam_level: z.enum(['gaokao', 'zhongkao']),
  grade: z.enum(['初一', '初二', '初三', '高一', '高二', '高三']),
  subject: z.enum(['chinese', 'english']),
  request_token: z.string().min(1).max(128),
});

// ────────────────────────────────────────────────────────────────────────────
// 输出 Schema (与规格书 §1.3 严格对齐)
// ────────────────────────────────────────────────────────────────────────────

const AnnotationTypeSchema = z.enum([
  'highlight',
  'masterstroke',
  'grammar_error',
  'advanced_vocab',
  'logic_issue',
]);

const AnchorSchema = z.object({
  paragraph_index: z.number().int().nonnegative(),
  quote: z.string().min(2, 'quote 至少 2 字符').max(200, 'quote 过长, 怀疑引用错误'),
  line_no: z.number().int().nonnegative().optional(),
});

const AnnotationSchema = z.object({
  id: z.string().optional(),
  type: AnnotationTypeSchema,
  anchor: AnchorSchema,
  comment: z.string().min(2, 'comment 至少 2 字符').max(500, 'comment 过长'),
  anchor_failed: z.boolean().optional(),
});

const ScoresSchema = z
  .object({
    content: z.number().int().min(0).max(20),
    language: z.number().int().min(0).max(20),
    structure: z.number().int().min(0).max(20),
    development: z.number().int().min(0).max(20),
    total: z.number().int().min(0).max(80),
  })
  .refine((s) => s.total === s.content + s.language + s.structure + s.development, {
    message: 'scores.total 必须严格等于 content+language+structure+development',
    path: ['total'],
  });

const AnchorMetricsSchema = z.object({
  raw_count: z.number().int().nonnegative(),
  anchor_success_count: z.number().int().nonnegative(),
  anchor_rate: z.number().min(0).max(1),
  final_valid_count: z.number().int().nonnegative(),
});

const GradeOutputSchema = z.object({
  annotations: z.array(AnnotationSchema).min(1, '至少 1 条批注').max(50, '最多 50 条'),
  scores: ScoresSchema,
  comment: z.string().min(10, '总评至少 10 字符').max(1000, '总评过长'),
  rubric_id: z.string().min(1),
  meta: z.object({
    model: z.string(),
    anchor_metrics: AnchorMetricsSchema,
    prompt_version: z.string(),
  }),
});

// ────────────────────────────────────────────────────────────────────────────
// Patch 3: formatTranscriptForPrompt
// ────────────────────────────────────────────────────────────────────────────

/**
 * 把 TranscriptResult 压成 "[段落 X]\n..." 格式, 喂给 Stage B prompt.
 *
 * 设计动机 (Patch 3):
 *   - JSON.stringify 会产生大量元字符 (引号/逗号/转义), 浪费 token + 分散 LLM 注意力
 *   - 段落分隔符 `[段落 N]` 与 prompt 中的说明对齐, 让 LLM 直接做"引用哪段"
 *   - 节省约 40% token
 *
 * @param {object} transcript
 * @returns {string}
 */
export function formatTranscriptForPrompt(transcript) {
  if (!transcript || !Array.isArray(transcript.paragraphs)) return '';
  return transcript.paragraphs
    .map((p) => {
      const lines = (p.lines || []).map((l) => l.text || '').join('\n');
      return `[段落 ${p.paragraph_index}]\n${lines}`;
    })
    .join('\n\n');
}

// ────────────────────────────────────────────────────────────────────────────
// Prompt 模板 (Stage B · Grade) — fallback 模板, 实际优先读 prompts/grade.v1.txt
// ────────────────────────────────────────────────────────────────────────────

const GRADE_PROMPT_TEMPLATE = `你是一位拥有 20 年教学经验的{{SUBJECT_CN}}特级教师，专注高考/中考作文批改。
你将收到一篇已经转录好的学生作文（带段落编号），请你严格按以下要求输出 JSON 批改结果。

[输入格式]
原文以 [段落 X] 格式提供，每段之间空行分隔。例如:
[段落 0]
第一行文字
第二行文字

[段落 1]
...

**你的 anchor.paragraph_index 必须对应这些编号（0, 1, 2, ...）。**

[批注类型枚举 — 必须严格使用]
- "highlight"        : 好词好句 (用词准确 / 修辞巧妙)
- "masterstroke"     : 点睛之笔 (整段或整句的文眼, 让文章立意升华)
- "grammar_error"    : 语病 (错别字、搭配不当、成分残缺、标点误用)
- "advanced_vocab"   : 高级词汇 (超出{{GRADE}}水平的表达, 值得学习)
- "logic_issue"      : 逻辑/结构问题 (论证跳跃、前后矛盾、详略不当)

[输出 JSON 结构 — 不要包含任何 markdown 标记]
{
  "annotations": [
    {
      "id": "uuid (后端生成, 你可以留空字符串)",
      "type": "highlight" | "masterstroke" | "grammar_error" | "advanced_vocab" | "logic_issue",
      "anchor": {
        "paragraph_index": 0,                  // 引用段号, 必须能在 [段落 X] 列表中找到
        "quote": "原文子串, 必须在对应段落的文本中精确存在",
        "line_no": 1                           // 可选, 但建议提供
      },
      "comment": "1-2 句中文点评"
    }
  ],
  "scores": {
    "content":     0-20 的整数,
    "language":    0-20 的整数,
    "structure":   0-20 的整数,
    "development": 0-20 的整数,
    "total":       content+language+structure+development (必须严格相等)
  },
  "comment": "总评 3-5 句中文",
  "rubric_id": "{{RUBRIC_ID}}",
  "meta": {
    "model": "你正在运行的模型名",
    "anchor_metrics": {
      "raw_count": annotations.length,
      "anchor_success_count": 你自己估计的精确匹配数,
      "anchor_rate": 0.0-1.0,
      "final_valid_count": 你自己估计的有效数
    },
    "prompt_version": "3.0.0"
  }
}

[类型覆盖强制要求]
- 必须至少 1 条 highlight
- 必须至少 1 条 masterstroke
- grammar_error + logic_issue 总和 ≥ 1
- 总 annotations 数量控制在 5-12 条

[评分 Rubric — {{RUBRIC_ID}}]
{{RUBRIC_TABLE}}

[锚定严格约束 — 这是最重要的规则]
- anchor.quote 必须能在对应段落的文本中找到 (字符串完全匹配, 允许忽略首尾空白)
- 不允许"概括"或"意译" — 必须引用原句
- 如果一个亮点跨越多行, 用整段最长代表性那句
- 如果找不到合适的 quote, **宁可不写这条**, 也不要伪造

[作文元信息]
- 标题: {{ESSAY_TITLE}}
- 学段: {{EXAM_LEVEL_CN}}
- 年级: {{GRADE}}
- 学科: {{SUBJECT_CN}}

[原文]
{{TRANSCRIPT}}

[自检清单]
□ annotations 是 JSON 数组, 不是 markdown 列表
□ 每条 annotation 的 anchor.quote 都能在对应段落文本中找到
□ scores.total 严格 = content+language+structure+development
□ type 取值严格在 5 个枚举内
□ 总评 comment ≥ 3 句
□ paragraph_index 严格对应 [段落 X] 编号`;

// ────────────────────────────────────────────────────────────────────────────
// Prompt 模板加载 (cache)
// ────────────────────────────────────────────────────────────────────────────

let promptTemplateCache = null;

async function loadGradeTemplate() {
  if (promptTemplateCache) return promptTemplateCache;
  const path = join(PROMPTS_DIR, 'grade.v1.txt');
  try {
    promptTemplateCache = await readFile(path, 'utf-8');
  } catch (e) {
    logger.warn('[essay.grade] grade.v1.txt 加载失败, 使用内置 fallback', { error: e.message });
    promptTemplateCache = GRADE_PROMPT_TEMPLATE;
  }
  return promptTemplateCache;
}

// ────────────────────────────────────────────────────────────────────────────
// Prompt 装配
// ────────────────────────────────────────────────────────────────────────────

async function buildGradePrompt({ transcript, essay_title, subject, exam_level, grade }) {
  const tpl = await loadGradeTemplate();

  const rubric = await loadRubric(subject, exam_level);
  if (!rubric) {
    throw new EssayError(
      ErrorCode.ESSAY_RUBRIC_NOT_FOUND,
      `未找到 rubric 配置: ${subject}_${exam_level}_v1`,
      { subject, exam_level }
    );
  }

  const subjectCN = subject === 'chinese' ? '语文' : '英语';
  const examLevelCN = exam_level === 'gaokao' ? '高考' : '中考';

  // Patch 3: 用 formatTranscriptForPrompt 替换 JSON.stringify
  const transcriptStr = formatTranscriptForPrompt(transcript);

  return tpl
    .replace(/\{\{SUBJECT_CN\}\}/g, subjectCN)
    .replace(/\{\{GRADE\}\}/g, grade)
    .replace(/\{\{EXAM_LEVEL_CN\}\}/g, examLevelCN)
    .replace(/\{\{RUBRIC_ID\}\}/g, rubric.id)
    .replace(/\{\{RUBRIC_TABLE\}\}/g, renderRubricTable(rubric))
    .replace(/\{\{ESSAY_TITLE\}\}/g, essay_title)
    .replace(/\{\{TRANSCRIPT\}\}/g, transcriptStr);
}

// ────────────────────────────────────────────────────────────────────────────
// LLM 调用 (复用 /api/proxy, 文本模型)
// ────────────────────────────────────────────────────────────────────────────

async function callLLMText({ messages, authHeader, proto, host, task_type = 'essay_grade' }) {
  const url = `${proto}://${host}/api/proxy`;
  const model = 'qwen-plus';
  const temperature = 0.4;
  const max_tokens = 3500;

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
        '批改模型响应超时 (>30s), 请重试',
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
      ErrorCode.ESSAY_GRADE_PARSE_FAILED,
      'LLM 返回内容为空',
      { raw_excerpt: JSON.stringify(body.data).slice(0, 500) }
    );
  }

  return content;
}

// ────────────────────────────────────────────────────────────────────────────
// JSON 解析
// ────────────────────────────────────────────────────────────────────────────

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
// 主函数: gradeEssay
// ────────────────────────────────────────────────────────────────────────────

/**
 * Stage B 入口: 转录结果 → 批改报告.
 *
 * @param {object} args
 * @param {string} args.user_email
 * @param {object} args.transcript
 * @param {string} args.essay_title
 * @param {'gaokao'|'zhongkao'} args.exam_level
 * @param {string} args.grade
 * @param {'chinese'|'english'} args.subject
 * @param {string} args.request_token
 * @param {object} [args.req]
 * @returns {Promise<object>}
 * @throws {EssayError}
 */
export async function gradeEssay({
  user_email,
  transcript,
  essay_title,
  exam_level,
  grade,
  subject,
  request_token,
  req,
}) {
  // ─── 1. 入参 Zod 校验 ───
  const reqParse = GradeRequestSchema.safeParse({
    transcript,
    essay_title,
    exam_level,
    grade,
    subject,
    request_token,
  });
  if (!reqParse.success) {
    const issue = reqParse.error.issues[0];
    throw new EssayError(
      ErrorCode.VALIDATION_REQUIRED_FIELD,
      `请求参数校验失败: ${issue.path.join('.')} - ${issue.message}`,
      { zod_issues: reqParse.error.issues }
    );
  }
  const validReq = reqParse.data;

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

  // ─── 3. 装配 prompt ───
  const promptText = await buildGradePrompt({
    transcript: validReq.transcript,
    essay_title: validReq.essay_title,
    subject: validReq.subject,
    exam_level: validReq.exam_level,
    grade: validReq.grade,
  });

  const messages = [
    {
      role: 'user',
      content: [{ type: 'text', text: promptText }],
    },
  ];

  // ─── 4. 调 LLM ───
  let content;
  try {
    content = await callLLMText({ messages, authHeader, proto, host, task_type: 'essay_grade' });
  } catch (e) {
    if (e instanceof EssayError) throw e;
    throw new EssayError(
      ErrorCode.ESSAY_LLM_UPSTREAM_ERROR,
      `批改模型调用异常: ${e.message}`,
      { stack: e.stack }
    );
  }

  // ─── 5. 解析 JSON ───
  const parsed = parseJsonFromLLM(content);
  if (!parsed) {
    logger.error('[essay.grade] JSON 解析失败', { content_excerpt: content.slice(0, 500) });
    throw new EssayError(
      ErrorCode.ESSAY_GRADE_PARSE_FAILED,
      'AI 老师暂时无法理解这篇作文 (JSON 解析失败), 请重试',
      { raw_excerpt: content.slice(0, 500) }
    );
  }

  // ─── 6. Zod 强校验 ───
  const zodResult = GradeOutputSchema.safeParse(parsed);
  if (!zodResult.success) {
    logger.error('[essay.grade] Zod 校验失败', {
      issues: zodResult.error.issues,
      parsed_excerpt: JSON.stringify(parsed).slice(0, 500),
    });
    throw new EssayError(
      ErrorCode.ESSAY_GRADE_PARSE_FAILED,
      `AI 输出不符合批改 Schema: ${zodResult.error.issues[0]?.message}`,
      { zod_issues: zodResult.error.issues }
    );
  }

  const llmOutput = zodResult.data;

  // ─── 7. 业务校验: 类型覆盖 ───
  const typeCount = llmOutput.annotations.reduce((acc, a) => {
    acc[a.type] = (acc[a.type] || 0) + 1;
    return acc;
  }, {});

  if (!typeCount.highlight || typeCount.highlight < 1) {
    logger.warn('[essay.grade] 缺少 highlight 批注, 建议 prompt 强化', { typeCount });
  }
  if (!typeCount.masterstroke || typeCount.masterstroke < 1) {
    logger.warn('[essay.grade] 缺少 masterstroke 批注, 建议 prompt 强化', { typeCount });
  }
  if ((typeCount.grammar_error || 0) + (typeCount.logic_issue || 0) < 1) {
    logger.warn('[essay.grade] 缺少 grammar_error/logic_issue 批注, 建议 prompt 强化', { typeCount });
  }

  // ─── 8. 锚定 ───
  const annotationsWithId = llmOutput.annotations.map((a, i) => ({
    ...a,
    id: a.id && a.id.length >= 8 ? a.id : `anno_${request_token.slice(-8)}_${i}`,
  }));

  const { resolved, metrics: anchorMetrics } = reconcile(
    validReq.transcript.paragraphs,
    annotationsWithId
  );

  // ─── 9. 组装最终输出 ───
  const reportId = newReportId();

  return {
    report_id: reportId,
    annotations: resolved,
    scores: llmOutput.scores,
    comment: llmOutput.comment,
    rubric_id: llmOutput.rubric_id,
    meta: {
      ...llmOutput.meta,
      anchor_metrics: anchorMetrics,
      server_metrics: {
        model: 'qwen-plus',
        task_type: 'essay_grade',
        user_email,
        request_token,
        stage_b_input_tokens_estimate: Math.ceil(promptText.length / 2),
      },
    },
  };
}
