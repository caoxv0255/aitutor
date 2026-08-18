import dotenv from 'dotenv';
import { PROMPTS } from '../utils/prompts.js';
import { parseExplainResponse } from '../utils/llmParser.js';
import { errorResponse } from '../utils/response.js';
import { getDb } from '../core/db.js';
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

    // D069 (2026-08-17): ai_trace — 异步写入 LLM 调用追踪
    try {
      const tLatency = Date.now() - tStart;
      getDb().then(p => p.query(
        `INSERT INTO ai_trace (user_email, provider, model, task_type, prompt_tokens, completion_tokens, latency_ms, success)
         VALUES ($1, 'dashscope', $2, 'explain_question', $3, $4, $5, $6)`,
        [req.user?.email||null, promptConfig.model, data.usage?.prompt_tokens||0, data.usage?.completion_tokens||0, tLatency, response.ok]
      )).catch(()=>{});
    } catch {}

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
    return res.status(500).json(errorResponse('生成讲解失败，请重试'));
  }
}
