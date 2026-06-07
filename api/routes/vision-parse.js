/**
 * api/vision-parse.js — 多模态视觉解析 (Vision-to-Graph)
 *
 * 将学生拍摄的试卷/错题图片转化为结构化数据：
 *   1. Vision LLM (Qwen-VL) → 提取纯文本 + LaTeX 公式 + 推断知识点
 *   2. 知识点校验 → 确认 inferred_kp_id 存在于图谱（严禁捏造新节点）
 *   3. 拍照即入库 → 调用方案 B 的 ingestQuestion() 存入向量库
 *
 * 架构边界：
 *   - 仅消费方案 A 的知识点列表做校验（只读）
 *   - 写入方案 B 的 rag_questions 表（向量入库）
 *   - 不修改方案 A 的图谱拓扑
 */

import express from 'express';
import { getDb } from '../core/db.js';
import { visionChatCompletion, safeParseLLMJson } from '../../services/llm.js';
import { ingestQuestion } from './rag-search.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { authMiddleware } from '../core/auth.js';

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────────────────────────────────────

/** Vision 模型 */
const VISION_MODEL = 'qwen-vl-max';

/** Base64 图片最大大小 (10MB) */
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

/** Vision 解析 System Prompt — 严格约束输出格式 */
const VISION_SYSTEM_PROMPT = `你是一位专业的中高考试卷 OCR 与知识点识别专家。你的任务是分析学生上传的试卷/习题图片，并输出严格的结构化 JSON。

## 输出规则（必须严格遵守）

1. **raw_text**: 提取图片中的所有题目文本（不含题号、选项标记等格式字符）。多道题用换行分隔。
2. **latex_formulas**: 提取图片中所有数学/物理/化学公式，转换为标准 LaTeX 格式。
   - 行内公式用 $...$ 包裹，如 $x^2 + y^2 = r^2$
   - 独立公式用 $$...$$ 包裹
   - 化学方程式用 LaTeX 化学式，如 $\\ce{2H2 + O2 -> 2H2O}$
3. **subject**: 推断学科（中文：数学/物理/化学/生物/语文/英语/历史/地理/政治）
4. **difficulty**: 推断难度 1-5（1=基础概念，3=综合应用，5=竞赛级）
5. **question_type**: 推断题型（choice/fill/short_answer/calculation/proof/experiment/essay/reading）
6. **inferred_kp_id**: 推断最匹配的知识点 ID，格式为 "kp_学科_序号"（如 kp_math_015）。
   - 如果你无法确定具体 ID，设为 null，**严禁捏造不存在的 ID**。
7. **inferred_kp_name**: 推断的知识点名称（中文，如"二次函数的图像与性质"）

## 严格输出 JSON 格式

{
  "raw_text": "提取的完整题目文本...",
  "latex_formulas": ["$公式1$", "$$公式2$$"],
  "subject": "数学",
  "difficulty": 3,
  "question_type": "short_answer",
  "inferred_kp_id": "kp_math_015",
  "inferred_kp_name": "二次函数的图像与性质"
}

如果图片中包含多道独立题目，只解析第一道题（最清晰的）。`;

const VISION_USER_PROMPT = `请仔细分析这张试卷/习题图片，提取题目文本和公式，并推断知识点。严格按照要求的 JSON 格式输出。`;

// ─────────────────────────────────────────────────────────────────────────────
// 知识点校验（确保不捏造新节点）
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 校验知识点 ID 是否存在于 knowledge_points 表
 * 如果不存在，返回 null（Fallback：允许存储但不关联图谱节点）
 */
async function validateKnowledgePointId(kpId) {
  if (!kpId || typeof kpId !== 'string') return null;

  try {
    const pool = await getDb();
    const result = await pool.query(`SELECT id, name, subject FROM knowledge_points WHERE id = $1 LIMIT 1`, [kpId]);

    if (result.rows.length > 0) {
      return result.rows[0];
    }

    // Fallback: 尝试模糊匹配名称
    return null;
  } catch {
    return null;
  }
}

/**
 * 通过知识点名称模糊查找（当 ID 不存在时的 Fallback）
 */
async function findKnowledgePointByName(name, subject) {
  if (!name || typeof name !== 'string') return null;

  try {
    const pool = await getDb();
    const conditions = ['name ILIKE $1'];
    const params = [`%${name}%`];

    if (subject) {
      conditions.push('subject = $2');
      params.push(subject);
    }

    const result = await pool.query(
      `SELECT id, name, subject FROM knowledge_points WHERE ${conditions.join(' AND ')} LIMIT 5`,
      params
    );

    return result.rows.length > 0 ? result.rows[0] : null;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 学科代码映射
// ─────────────────────────────────────────────────────────────────────────────

const SUBJECT_MAP = {
  数学: 'math',
  物理: 'physics',
  化学: 'chemistry',
  生物: 'biology',
  语文: 'chinese',
  英语: 'english',
  历史: 'history',
  地理: 'geography',
  政治: 'politics',
};

// ─────────────────────────────────────────────────────────────────────────────
// 核心解析函数
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 解析图片为结构化题目数据
 *
 * @param {string} imageBase64 - Base64 编码的图片（不含 data: 前缀）
 * @param {object} [userHint] - 用户可选的辅助信息
 * @param {string} [userHint.subject] - 用户指定的学科
 * @param {string} [userHint.knowledge_point_id] - 用户指定的知识点
 * @returns {Promise<object>} 解析结果
 */
async function parseImageToQuestion(imageBase64, userHint = {}) {
  // ── Step 1: 调用 Vision LLM ──
  const llmResult = await visionChatCompletion(VISION_SYSTEM_PROMPT, VISION_USER_PROMPT, imageBase64, {
    model: VISION_MODEL,
    temperature: 0.2,
    max_tokens: 4000,
    jsonMode: true,
  });

  // ── Step 2: 解析 JSON 输出 ──
  let parsed;
  try {
    parsed = safeParseLLMJson(llmResult.content);
  } catch (err) {
    throw new Error(`Vision LLM 输出解析失败: ${err.message}`);
  }

  // ── Step 3: 知识点校验（架构核心防护）──
  let validatedKpId = null;
  let validatedKpName = parsed.inferred_kp_name || null;
  const subjectCode = SUBJECT_MAP[userHint.subject] || SUBJECT_MAP[parsed.subject] || userHint.subject_code || null;

  // 优先使用用户指定的知识点
  if (userHint.knowledge_point_id) {
    const kp = await validateKnowledgePointId(userHint.knowledge_point_id);
    if (kp) {
      validatedKpId = kp.id;
      validatedKpName = kp.name;
    }
  }

  // Fallback 1: 校验 Vision 推断的 kp_id
  if (!validatedKpId && parsed.inferred_kp_id) {
    const kp = await validateKnowledgePointId(parsed.inferred_kp_id);
    if (kp) {
      validatedKpId = kp.id;
      validatedKpName = kp.name;
    }
  }

  // Fallback 2: 通过知识点名称模糊匹配
  if (!validatedKpId && validatedKpName) {
    const kp = await findKnowledgePointByName(validatedKpName, parsed.subject);
    if (kp) {
      validatedKpId = kp.id;
      validatedKpName = kp.name;
    }
  }

  // ── Step 4: 组装结构化内容（文本 + LaTeX 合并）──
  const contentParts = [parsed.raw_text || ''];
  if (parsed.latex_formulas && parsed.latex_formulas.length > 0) {
    contentParts.push('\n\n【公式】\n' + parsed.latex_formulas.join('\n'));
  }
  const fullContent = contentParts.join('').trim();

  return {
    raw_text: parsed.raw_text || '',
    latex_formulas: parsed.latex_formulas || [],
    subject_code: subjectCode,
    difficulty: parsed.difficulty || 3,
    question_type: parsed.question_type || 'short_answer',
    inferred_kp_id: validatedKpId,
    inferred_kp_name: validatedKpName,
    full_content: fullContent,
    llm_usage: llmResult.usage,
    kp_validated: validatedKpId !== null, // 告知前端知识点是否经过验证
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Express 路由
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/vision/parse — 多模态图片解析 + 拍照即入库
 *
 * 请求体: { image: "base64...", subject?, knowledge_point_id?, auto_ingest? }
 */
router.post('/parse', authMiddleware, async (req, res) => {
  try {
    const { image, subject, knowledge_point_id, auto_ingest } = req.body;

    if (!image || typeof image !== 'string') {
      return res.status(400).json(errorResponse('缺少必填字段: image (Base64 字符串)'));
    }

    // 清理 data URL 前缀
    const base64Data = image.replace(/^data:image\/\w+;base64,/, '');

    if (base64Data.length > MAX_IMAGE_SIZE) {
      return res.status(400).json(errorResponse('图片大小超过 10MB 限制'));
    }

    // ── 调用 Vision 解析 ──
    const parseResult = await parseImageToQuestion(base64Data, {
      subject,
      knowledge_point_id,
    });

    // ── 拍照即入库（方案 B 协同）──
    let ingestResult = null;
    const shouldIngest = auto_ingest !== false; // 默认自动入库

    if (shouldIngest && parseResult.full_content.length >= 10) {
      try {
        ingestResult = await ingestQuestion({
          content: parseResult.full_content,
          knowledge_point_id: parseResult.inferred_kp_id,
          subject_code: parseResult.subject_code,
          difficulty: parseResult.difficulty,
          question_type: parseResult.question_type,
          metadata: {
            source: 'vision_parse',
            latex_formulas: parseResult.latex_formulas,
            raw_text: parseResult.raw_text,
            kp_validated: parseResult.kp_validated,
          },
        });
      } catch (ingestErr) {
        console.warn(`[Vision] 自动入库失败: ${ingestErr.message}`);
        // 入库失败不影响解析结果返回
      }
    }

    return res.json(
      successResponse(
        {
          parse: parseResult,
          ingest: ingestResult
            ? { success: true, rag_id: ingestResult.id }
            : { success: false, reason: ingestResult === null ? '未触发入库' : '入库失败' },
        },
        '图片解析完成'
      )
    );
  } catch (err) {
    console.error('[Vision] 图片解析失败:', err.message);
    const status = err.message.includes('API Key') ? 503 : 500;
    return res.status(status).json(errorResponse(`解析失败: ${err.message}`));
  }
});

/**
 * GET /api/vision/knowledge-points — 获取可用知识点列表（供前端下拉选择）
 */
router.get('/knowledge-points', authMiddleware, async (req, res) => {
  try {
    const pool = await getDb();
    const { subject } = req.query;

    const conditions = [];
    const params = [];

    if (subject) {
      conditions.push('subject = $1');
      params.push(subject);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(200); // limit

    const result = await pool.query(
      `SELECT id, name, subject, difficulty FROM knowledge_points ${whereClause} ORDER BY subject, name LIMIT $${params.length}`,
      params
    );

    return res.json(successResponse({ items: result.rows, total: result.rows.length }));
  } catch (err) {
    console.error('[Vision] 知识点列表查询失败:', err.message);
    return res.status(500).json(errorResponse(`查询失败: ${err.message}`));
  }
});

export { parseImageToQuestion };
export default router;
