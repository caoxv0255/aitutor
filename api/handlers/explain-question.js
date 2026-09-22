import dotenv from 'dotenv';
import { PROMPTS } from '../utils/prompts.js';
import { parseExplainResponse } from '../utils/llmParser.js';
import { errorResponse } from '../utils/response.js';
// 2026-09-22 (路径 A): 统一走 services/llm.js 封装 (Key 校验 / 超时 / 回退 / 预算 / ai_trace
// 全部由封装负责), 不再直连 DashScope 兼容端点.
import { chatCompletion } from '../../services/llm.js';
dotenv.config();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json(errorResponse('Method not allowed'));
  }

  const { question, subject, knowledgePoint } = req.body;

  if (!question || typeof question !== 'string') {
    return res.status(400).json(errorResponse('请提供题目内容'));
  }

  const subjectMap = {
    'math': '数学',
    'chinese': '语文',
    'english': '英语',
    'physics': '物理',
    'chemistry': '化学',
    'politics': '政治'
  };

  const subjectName = subjectMap[subject] || subject || '数学';

  const promptConfig = PROMPTS.QUESTION_EXPLAIN;
  const prompt = promptConfig.build(subjectName, question, knowledgePoint);

  try {
    // 保留原对外错误语义: 未配置 Key 仍返回 500 'AI服务未配置'
    const apiKey = process.env.DASHSCOPE_API_KEY;
    if (!apiKey) {
      return res.status(500).json(errorResponse('AI服务未配置'));
    }

    // 调用参数与原旁路逐项对齐: model=qwen-plus / temperature=0.7 / max_tokens=3000 /
    // 不带 response_format (jsonMode: false). ai_trace 由 services/llm.js 统一写入.
    const result = await chatCompletion('', prompt, {
      model: promptConfig.model,
      temperature: promptConfig.temperature,
      max_tokens: promptConfig.maxTokens,
      jsonMode: false,
      feature: 'explain_question',
      task_type: 'explain_question',
      request_id: req.traceId,
      user_id: req.user?.email,
    });

    const { parsed, isFallback, quality } = parseExplainResponse(result.content);

    if (isFallback || quality < 30) {
      console.warn(`[Explain] Low quality response for question (quality=${quality}, fallback=${isFallback})`);
    }

    return res.json({
      success: true,
      question,
      subject: subjectName,
      knowledgePoint,
      ...parsed
    });

  } catch (error) {
    console.error('Explain question error:', error);
    // 保留原错误语义: 上游 API 错误直接透出其 message. llm.js 统一封装为 'LLM API 错误: <msg>',
    // 此处剥掉前缀还原上游原文; 其余异常仍走通用兜底文案 (状态码一律 500, 与原实现一致).
    const upstream = /^LLM API 错误: (.*)$/.exec(error.message || '');
    return res.status(500).json(errorResponse(upstream ? upstream[1] || 'AI生成失败' : '生成讲解失败，请重试'));
  }
}
