import { errorResponse } from '../utils/response.js';
// Phase-B-fix (2026-08-24): B10 — 改用 services/aiTrace.js 统一埋点 (request_id / cost 自动算)
import { recordAiTraceAsync } from '../../services/aiTrace.js';
// 2026-09-22 (路径 A): 模型表单一真相源 — 白名单 / key 映射派生自 services/llm.js 的 MODEL_CONFIGS.
import { MODEL_CONFIGS } from '../../services/llm.js';

const MAX_TOKENS_LIMIT = 4000;
const MAX_MESSAGES_LENGTH = 20;
const FETCH_TIMEOUT_MS = 30000;

// 上游 endpoint 仍是 /api/proxy 自身的固定策略 (OpenAI 兼容端点), 不随 llm.js 的
// DASHSCOPE_API_MODE / *_BASE_URL 覆盖而变, 以保持既有代理行为不变.
const PROXY_PROVIDERS = [
  {
    name: 'qwen',
    endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    keyEnv: 'DASHSCOPE_API_KEY'
  },
  {
    name: 'deepseek',
    endpoint: 'https://api.deepseek.com/v1/chat/completions',
    keyEnv: 'DEEPSEEK_API_KEY'
  },
  // MiniMax CN 开放平台 (2026-08 实测): OpenAI 兼容 /v1/chat/completions
  {
    name: 'minimax',
    endpoint: 'https://api.minimaxi.com/v1/chat/completions',
    keyEnv: 'MINIMAX_API_KEY'
  }
];

// 白名单 = MODEL_CONFIGS 中 keyEnv 落在上述三个远程 provider 的模型 (本地 Ollama 兜底
// llava 的 keyEnv=OLLAMA_API_KEY 不在表中, 自动被排除, 与旧白名单一致).
const API_CONFIGS = {};
for (const provider of PROXY_PROVIDERS) {
  API_CONFIGS[provider.name] = {
    endpoint: provider.endpoint,
    keyEnv: provider.keyEnv,
    models: Object.keys(MODEL_CONFIGS).filter((m) => MODEL_CONFIGS[m].keyEnv === provider.keyEnv)
  };
}

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
  const tProvider = apiConfig.endpoint.includes('deepseek') ? 'deepseek'
    : apiConfig.endpoint.includes('minimax') ? 'minimax'
    : 'dashscope';

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

    // Phase-B-fix (2026-08-24): B10 — ai_trace 改用统一 recordAiTrace (含 request_id / cost)
    const tUsage = data.usage || {};
    const tLatency = Date.now() - tStart;
    recordAiTraceAsync({
      request_id: req.traceId,
      user_id: req.user?.email,
      task_type: 'chat',
      provider: tProvider,
      model,
      prompt_tokens: tUsage.prompt_tokens || 0,
      completion_tokens: tUsage.completion_tokens || 0,
      latency_ms: tLatency,
      cost_cny: ((tUsage.total_tokens || 0) / 1_000_000) * 0.8, // 近似: qwen-plus 单价
      success: response.ok,
      error_message: response.ok ? null : (data.error?.message || `HTTP ${response.status}`),
    });

    if (data.usage) {
      console.log(`[Proxy] user=${req.user.email} model=${model} tokens=${data.usage.total_tokens || 'N/A'} latency=${tLatency}ms`);
    }

    res.status(response.status).json(data);
  } catch (error) {
    // Phase-B-fix (2026-08-24): B10 — 异常路径也写 ai_trace (success=false)
    recordAiTraceAsync({
      request_id: req.traceId,
      user_id: req.user?.email,
      task_type: 'chat',
      provider: tProvider,
      model,
      latency_ms: Date.now() - tStart,
      success: false,
      error_message: error.message,
    });
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
