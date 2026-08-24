import dotenv from 'dotenv';
import { PROMPTS } from '../utils/prompts.js';
import { parseExplainResponse } from '../utils/llmParser.js';
import { errorResponse } from '../utils/response.js';
// Phase-B-fix (2026-08-24): B10 — 改用 services/aiTrace.js 统一埋点
import { recordAiTraceAsync } from '../../services/aiTrace.js';
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

  const tStart = Date.now();
  try {
    const apiKey = process.env.DASHSCOPE_API_KEY;
    if (!apiKey) {
      return res.status(500).json(errorResponse('AI服务未配置'));
    }

    const response = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: promptConfig.model,
        messages: [{
          role: 'user',
          content: prompt
        }],
        temperature: promptConfig.temperature,
        max_tokens: promptConfig.maxTokens
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error('LLM API error:', data);
      return res.status(500).json(errorResponse(data.error?.message || 'AI生成失败'));
    }

    const content = data.choices[0].message.content;
    const { parsed, isFallback, quality } = parseExplainResponse(content);

    // Phase-B-fix (2026-08-24): B10 — ai_trace 改用统一 recordAiTrace
    const tLatency = Date.now() - tStart;
    recordAiTraceAsync({
      request_id: req.traceId,
      user_id: req.user?.email,
      task_type: 'explain_question',
      provider: 'dashscope',
      model: promptConfig.model,
      prompt_tokens: data.usage?.prompt_tokens || 0,
      completion_tokens: data.usage?.completion_tokens || 0,
      latency_ms: tLatency,
      cost_cny: ((data.usage?.total_tokens || 0) / 1_000_000) * 0.8,
      success: response.ok,
      error_message: response.ok ? null : (data.error?.message || 'API error'),
    });

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
    // Phase-B-fix (2026-08-24): B10 — 异常路径 ai_trace
    recordAiTraceAsync({
      request_id: req.traceId,
      user_id: req.user?.email,
      task_type: 'explain_question',
      provider: 'dashscope',
      latency_ms: Date.now() - tStart,
      success: false,
      error_message: error.message,
    });
    console.error('Explain question error:', error);
    return res.status(500).json(errorResponse('生成讲解失败，请重试'));
  }
}
