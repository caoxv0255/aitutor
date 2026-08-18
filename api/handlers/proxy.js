import { errorResponse } from '../utils/response.js';
import { getDb } from '../core/db.js';

const MAX_TOKENS_LIMIT = 4000;
const MAX_MESSAGES_LENGTH = 20;
const FETCH_TIMEOUT_MS = 30000;

const API_CONFIGS = {
  qwen: {
    endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    keyEnv: 'DASHSCOPE_API_KEY',
    models: ['qwen3-vl-plus', 'qwen-plus', 'qwen-max', 'qwen-turbo']
  },
  deepseek: {
    endpoint: 'https://api.deepseek.com/v1/chat/completions',
    keyEnv: 'DEEPSEEK_API_KEY',
    models: ['deepseek-v4-pro', 'deepseek-chat', 'deepseek-coder']
  }
};

function getAPIConfig(model) {
  for (const [provider, config] of Object.entries(API_CONFIGS)) {
    if (config.models.includes(model)) {
      const apiKey = process.env[config.keyEnv];
      if (!apiKey) {
        return { ...config, apiKey: null, missingKey: true };
      }
      return { ...config, apiKey };
    }
  }
  return null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json(errorResponse('Method not allowed'));
  }

  if (!req.user || !req.user.email) {
    return res.status(401).json(errorResponse('请先登录'));
  }

  const { model, messages, temperature, max_tokens } = req.body;

  if (!model || typeof model !== 'string') {
    return res.status(400).json(errorResponse('缺少有效的 model 参数'));
  }

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json(errorResponse('缺少有效的 messages 参数'));
  }

  if (messages.length > MAX_MESSAGES_LENGTH) {
    return res.status(400).json(errorResponse(`messages 数组长度不能超过 ${MAX_MESSAGES_LENGTH}`));
  }

  const apiConfig = getAPIConfig(model);
  if (!apiConfig) {
    return res.status(400).json(errorResponse(`不支持的模型: ${model}`));
  }

  if (apiConfig.missingKey) {
    console.error(`API Key missing for provider: ${apiConfig.keyEnv}`);
    return res.status(503).json(errorResponse('AI 服务暂不可用，请稍后重试'));
  }

  const safeMaxTokens = Math.min(Math.max(max_tokens || 2000, 100), MAX_TOKENS_LIMIT);
  const safeTemperature = Math.min(Math.max(temperature || 0.7, 0), 2);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  const tStart = Date.now();
  const tProvider = apiConfig.endpoint.includes('deepseek') ? 'deepseek' : 'dashscope';

  try {
    const response = await fetch(apiConfig.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiConfig.apiKey}`
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: safeTemperature,
        max_tokens: safeMaxTokens
      }),
      signal: controller.signal
    });

    const data = await response.json();

    // D069 (2026-08-17): ai_trace — 异步写入 LLM 调用追踪
    const tUsage = data.usage || {};
    const tLatency = Date.now() - tStart;
    try {
      const tp = getDb();
      tp.then(p => p.query(
        `INSERT INTO ai_trace (user_email, provider, model, task_type, prompt_tokens, completion_tokens, latency_ms, success)
         VALUES ($1, $2, $3, 'chat', $4, $5, $6, $7)`,
        [req.user?.email || null, tProvider, model, tUsage.prompt_tokens||0, tUsage.completion_tokens||0, tLatency, response.ok]
      )).catch(()=>{});
    } catch {}

    if (data.usage) {
      console.log(`[Proxy] user=${req.user.email} model=${model} tokens=${data.usage.total_tokens || 'N/A'} latency=${tLatency}ms`);
    }

    res.status(response.status).json(data);
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error(`[Proxy] Timeout: user=${req.user.email} model=${model}`);
      return res.status(504).json(errorResponse('AI 服务响应超时，请稍后重试'));
    }
    console.error('[Proxy] Error:', error.message);
    res.status(500).json(errorResponse('API 请求失败'));
  } finally {
    clearTimeout(timeoutId);
  }
}
