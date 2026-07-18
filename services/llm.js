/**
 * services/llm.js — LLM 推理服务封装
 *
 * 封装 DashScope / DeepSeek 的 OpenAI 兼容 Chat Completion API 调用。
 * 支持模型回退机制、成本控制、JSON 模式输出。
 *
 * 架构边界：供方案 C（全局推理与学情）调用，不直接操作数据库或图谱。
 *
 * 环境变量:
 *   DASHSCOPE_API_KEY    — DashScope API 密钥（主要）
 *   DASHSCOPE_BASE_URL   — DashScope 自定义 Base URL
 *   DASHSCOPE_API_MODE   — API 模式: "compatible" 或 "native"
 *   DEEPSEEK_API_KEY     — DeepSeek API 密钥（备选）
 *   LLM_MAX_RETRIES      — 最大重试次数（默认 2）
 *   LLM_BUDGET_DAILY     — 每日预算（元，默认 100）
 */

const DEFAULT_DASHSCOPE_COMPATIBLE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1';
const DEFAULT_DASHSCOPE_NATIVE_URL = 'https://dashscope.aliyuncs.com/api/v1';
const DEEPSEEK_ENDPOINT = 'https://api.deepseek.com/v1/chat/completions';

function buildEndpoint(baseUrl, path) {
  const normalizedBase = baseUrl.replace(/\/$/, '');
  return `${normalizedBase}${path}`;
}

const DASHSCOPE_API_MODE = process.env.DASHSCOPE_API_MODE || 'compatible';
const DASHSCOPE_BASE_URL = process.env.DASHSCOPE_BASE_URL || 
  (DASHSCOPE_API_MODE === 'native' ? DEFAULT_DASHSCOPE_NATIVE_URL : DEFAULT_DASHSCOPE_COMPATIBLE_URL);

const DASHSCOPE_ENDPOINT = DASHSCOPE_API_MODE === 'native' 
  ? buildEndpoint(DASHSCOPE_BASE_URL, '/chat/completions')
  : buildEndpoint(DASHSCOPE_BASE_URL, '/chat/completions');

const isCustomMaaS = process.env.DASHSCOPE_BASE_URL && 
  process.env.DASHSCOPE_BASE_URL.includes('maas.aliyuncs.com') &&
  process.env.DASHSCOPE_API_MODE === 'compatible';

const MODEL_CONFIGS = {
  'qwen-plus': { endpoint: DASHSCOPE_ENDPOINT, keyEnv: 'DASHSCOPE_API_KEY', mode: DASHSCOPE_API_MODE, costPerMillionTokens: 0.8 },
  'qwen-max': { endpoint: DASHSCOPE_ENDPOINT, keyEnv: 'DASHSCOPE_API_KEY', mode: DASHSCOPE_API_MODE, costPerMillionTokens: 2.4 },
  'qwen-turbo': { endpoint: DASHSCOPE_ENDPOINT, keyEnv: 'DASHSCOPE_API_KEY', mode: DASHSCOPE_API_MODE, costPerMillionTokens: 0.4 },
  'qwen-vl-max': { endpoint: DASHSCOPE_ENDPOINT, keyEnv: 'DASHSCOPE_API_KEY', mode: DASHSCOPE_API_MODE, costPerMillionTokens: 12 },
  'qwen-vl-plus': { endpoint: DASHSCOPE_ENDPOINT, keyEnv: 'DASHSCOPE_API_KEY', mode: DASHSCOPE_API_MODE, costPerMillionTokens: 6 },
  'deepseek-chat': { endpoint: DEEPSEEK_ENDPOINT, keyEnv: 'DEEPSEEK_API_KEY', mode: 'compatible', costPerMillionTokens: 0.06 },
  'deepseek-v4-pro': { endpoint: DEEPSEEK_ENDPOINT, keyEnv: 'DEEPSEEK_API_KEY', mode: 'compatible', costPerMillionTokens: 1.2 },
};

const FALLBACK_MATRIX = {
  'qwen-plus': ['qwen-turbo', 'deepseek-chat'],
  'qwen-max': ['qwen-plus', 'qwen-turbo'],
  'qwen-turbo': ['deepseek-chat'],
  'qwen-vl-max': ['qwen-vl-plus'],
  'qwen-vl-plus': ['qwen-vl-max'],
  'deepseek-chat': [],
};

const DEFAULT_MODEL = 'qwen-plus';
const REQUEST_TIMEOUT_MS = 120000;
const MAX_RETRIES = parseInt(process.env.LLM_MAX_RETRIES) || 3;
const DAILY_BUDGET = parseFloat(process.env.LLM_BUDGET_DAILY) || 100;

const FEATURE_BUDGETS = {
  diagnosis_report: parseFloat(process.env.LLM_BUDGET_DIAGNOSIS) || 5,
  learning_path: parseFloat(process.env.LLM_BUDGET_LEARNING_PATH) || 3,
  vision_search: parseFloat(process.env.LLM_BUDGET_VISION) || 2,
  vision_multimodal: parseFloat(process.env.LLM_BUDGET_VISION_MM) || 4,
  paper_generation: parseFloat(process.env.LLM_BUDGET_PAPER) || 2,
  explain_question: parseFloat(process.env.LLM_BUDGET_EXPLAIN) || 1,
  chat: parseFloat(process.env.LLM_BUDGET_CHAT) || 50,
  other: parseFloat(process.env.LLM_BUDGET_OTHER) || 30,
};

let todayUsage = { total: 0 };
let lastResetDate = new Date().toDateString();

function resetDailyBudget() {
  const today = new Date().toDateString();
  if (today !== lastResetDate) {
    todayUsage = { total: 0 };
    for (const feature of Object.keys(FEATURE_BUDGETS)) {
      todayUsage[feature] = 0;
    }
    lastResetDate = today;
  }
}

function calculateCost(model, totalTokens) {
  const config = MODEL_CONFIGS[model];
  if (!config) return 0;
  return (totalTokens / 1000000) * config.costPerMillionTokens;
}

async function checkBudget(model, estimatedTokens, feature = 'other') {
  resetDailyBudget();
  
  const estimatedCost = calculateCost(model, estimatedTokens);
  
  if (todayUsage.total + estimatedCost > DAILY_BUDGET) {
    return false;
  }
  
  const featureBudget = FEATURE_BUDGETS[feature] || FEATURE_BUDGETS.other;
  const currentFeatureUsage = todayUsage[feature] || 0;
  
  return currentFeatureUsage + estimatedCost <= featureBudget;
}

async function recordUsage(model, totalTokens, feature = 'other') {
  const cost = calculateCost(model, totalTokens);
  todayUsage.total += cost;
  
  if (!todayUsage[feature]) {
    todayUsage[feature] = 0;
  }
  todayUsage[feature] += cost;
  
  return cost;
}

async function callWithFallback(systemPrompt, userPrompt, options, callFn) {
  const { model = DEFAULT_MODEL, retries = MAX_RETRIES, feature = 'other' } = options;
  
  let currentModel = model;
  const fallbackChain = [...FALLBACK_MATRIX[model] || []];
  let attempt = 0;

  while (attempt <= retries) {
    try {
      if (!await checkBudget(currentModel, options.max_tokens || 3000, feature)) {
        throw new Error(`${feature}功能每日预算已耗尽`);
      }

      const result = await callFn(systemPrompt, userPrompt, { ...options, model: currentModel });
      const cost = await recordUsage(currentModel, result.usage?.total_tokens || 0, feature);
      
      return {
        ...result,
        cost,
        usedFallback: currentModel !== model,
        originalModel: model,
        feature,
      };
    } catch (err) {
      attempt++;
      
      if (attempt > retries || fallbackChain.length === 0) {
        throw err;
      }
      
      currentModel = fallbackChain.shift();
      console.warn(`[LLM] 模型 ${model} 失败，回退到 ${currentModel}: ${err.message}`);
    }
  }
  
  throw new Error('所有模型均调用失败');
}

async function callModel(systemPrompt, userPrompt, options) {
  const { model = DEFAULT_MODEL, temperature = 0.3, max_tokens = 3000, jsonMode = true } = options;

  const config = MODEL_CONFIGS[model];
  if (!config) {
    throw new Error(`不支持的模型: ${model}`);
  }

  const apiKey = process.env[config.keyEnv];
  if (!apiKey) {
    throw new Error(`API Key 未配置: ${config.keyEnv}`);
  }

  const body = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: Math.min(Math.max(temperature, 0), 2),
    max_tokens: Math.min(Math.max(max_tokens, 100), 32000),
  };

  if (jsonMode) {
    body.response_format = { type: 'json_object' };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const isNativeMode = config.mode === 'native';
    const headers = {
      'Content-Type': 'application/json',
    };

    if (isNativeMode) {
      headers['X-DashScope-APIKey'] = apiKey;
    } else {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const response = await fetch(config.endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const data = await response.json();

    if (!response.ok) {
      const errMsg = data.error?.message || data.message || `HTTP ${response.status}`;
      throw new Error(`LLM API 错误: ${errMsg}`);
    }

    let content, usage, responseModel;

    if (isNativeMode) {
      content = data.output?.choices?.[0]?.message?.content;
      usage = data.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
      responseModel = data.model || model;
    } else {
      content = data.choices?.[0]?.message?.content;
      usage = data.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
      responseModel = data.model || model;
    }

    if (!content) {
      throw new Error('LLM 返回内容为空');
    }

    return {
      content,
      usage,
      model: responseModel,
    };
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error(`LLM 请求超时 (${REQUEST_TIMEOUT_MS}ms)`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function chatCompletion(systemPrompt, userPrompt, options = {}) {
  return callWithFallback(systemPrompt, userPrompt, options, callModel);
}

export function safeParseLLMJson(content) {
  if (!content || typeof content !== 'string') {
    throw new Error('LLM 返回内容为空');
  }

  let cleaned = content.replace(/<think[\s\S]*?<\/think>/g, '').trim();

  cleaned = cleaned
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
  }

  const braceMatch = cleaned.match(/\{[\s\S]*\}/);
  if (braceMatch) {
    try {
      return JSON.parse(braceMatch[0]);
    } catch {
    }

    try {
      const fixed = braceMatch[0].replace(/,\s*([}\]])/g, '$1');
      return JSON.parse(fixed);
    } catch {
    }
  }

  throw new Error(`无法解析 LLM 返回的 JSON: ${cleaned.slice(0, 200)}...`);
}

async function* streamCallModel(systemPrompt, userPrompt, options) {
  const {
    model = DEFAULT_MODEL,
    temperature = 0.3,
    max_tokens = 3000,
    jsonMode = false,
    signal,
  } = options;

  const config = MODEL_CONFIGS[model];
  if (!config) throw new Error(`不支持的模型: ${model}`);

  const apiKey = process.env[config.keyEnv];
  if (!apiKey) throw new Error(`API Key 未配置: ${config.keyEnv}`);

  const body = {
    model,
    stream: true,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: Math.min(Math.max(temperature, 0), 2),
    max_tokens: Math.min(Math.max(max_tokens, 100), 32000),
  };

  if (jsonMode) {
    body.response_format = { type: 'json_object' };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  if (signal) {
    signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  try {
    const response = await fetch(config.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(`LLM API 错误: ${errData.error?.message || `HTTP ${response.status}`}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data:')) continue;

        const data = trimmed.slice(5).trim();
        if (data === '[DONE]') return;

        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) yield delta;
        } catch {
        }
      }
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error(`LLM 流式请求超时 (${REQUEST_TIMEOUT_MS}ms)`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function* streamChatCompletion(systemPrompt, userPrompt, options = {}) {
  const { model = DEFAULT_MODEL, retries = MAX_RETRIES } = options;
  
  let currentModel = model;
  const fallbackChain = [...FALLBACK_MATRIX[model] || []];
  let attempt = 0;

  while (attempt <= retries) {
    try {
      if (!await checkBudget(currentModel, options.max_tokens || 3000)) {
        throw new Error('每日预算已耗尽');
      }

      yield* streamCallModel(systemPrompt, userPrompt, { ...options, model: currentModel });
      return;
    } catch (err) {
      attempt++;
      
      if (attempt > retries || fallbackChain.length === 0) {
        throw err;
      }
      
      currentModel = fallbackChain.shift();
      console.warn(`[LLM] 流式模型 ${model} 失败，回退到 ${currentModel}: ${err.message}`);
    }
  }
  
  throw new Error('所有模型均调用失败');
}

export { DEFAULT_MODEL };

async function visionCallModel(systemPrompt, userText, imageBase64, options) {
  const { model = 'qwen-vl-max', temperature = 0.2, max_tokens = 4000, jsonMode = true } = options;

  const config = MODEL_CONFIGS[model];
  if (!config) throw new Error(`不支持的模型: ${model}`);

  const apiKey = process.env[config.keyEnv];
  if (!apiKey) throw new Error(`API Key 未配置: ${config.keyEnv}`);

  const imageUrl = `data:image/jpeg;base64,${imageBase64}`;
  const body = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: imageUrl } },
          { type: 'text', text: userText },
        ],
      },
    ],
    temperature: Math.min(Math.max(temperature, 0), 2),
    max_tokens: Math.min(Math.max(max_tokens, 100), 32000),
  };

  if (jsonMode) {
    body.response_format = { type: 'json_object' };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS * 2);

  try {
    const response = await fetch(config.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const data = await response.json();

    if (!response.ok) {
      const errMsg = data.error?.message || `HTTP ${response.status}`;
      throw new Error(`Vision LLM API 错误: ${errMsg}`);
    }

    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('Vision LLM 返回内容为空');

    return {
      content,
      usage: data.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      model: data.model || model,
    };
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error(`Vision LLM 请求超时 (${REQUEST_TIMEOUT_MS * 2}ms)`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function visionChatCompletion(systemPrompt, userText, imageBase64, options = {}) {
  return callWithFallback(
    systemPrompt,
    { userText, imageBase64 },
    options,
    (sys, payload, opts) => visionCallModel(sys, payload.userText, payload.imageBase64, opts)
  );
}

export function getBudgetStats(feature = null) {
  resetDailyBudget();
  
  if (feature) {
    const featureBudget = FEATURE_BUDGETS[feature] || FEATURE_BUDGETS.other;
    const currentUsage = todayUsage[feature] || 0;
    return {
      feature,
      todayUsage: parseFloat(currentUsage.toFixed(2)),
      dailyBudget: featureBudget,
      remaining: parseFloat((featureBudget - currentUsage).toFixed(2)),
      usagePercent: parseFloat(((currentUsage / featureBudget) * 100).toFixed(2)),
    };
  }
  
  const featureStats = {};
  for (const [featureName, budget] of Object.entries(FEATURE_BUDGETS)) {
    const usage = todayUsage[featureName] || 0;
    featureStats[featureName] = {
      todayUsage: parseFloat(usage.toFixed(2)),
      dailyBudget: budget,
      remaining: parseFloat((budget - usage).toFixed(2)),
      usagePercent: parseFloat(((usage / budget) * 100).toFixed(2)),
    };
  }
  
  return {
    total: {
      todayUsage: parseFloat(todayUsage.total.toFixed(2)),
      dailyBudget: DAILY_BUDGET,
      remaining: parseFloat((DAILY_BUDGET - todayUsage.total).toFixed(2)),
      usagePercent: parseFloat(((todayUsage.total / DAILY_BUDGET) * 100).toFixed(2)),
    },
    features: featureStats,
  };
}

export { FEATURE_BUDGETS };

export const llm = {
  chat: chatCompletion,
  streamChat: streamChatCompletion,
  visionChat: visionChatCompletion,
  getBudgetStats,
};

export const MODELS = {
  QWEN_PLUS: 'qwen-plus',
  QWEN_MAX: 'qwen-max',
  QWEN_TURBO: 'qwen-turbo',
  QWEN_VL_MAX: 'qwen-vl-max',
  QWEN_VL_PLUS: 'qwen-vl-plus',
  DEEPSEEK_CHAT: 'deepseek-chat',
  DEEPSEEK_V4_PRO: 'deepseek-v4-pro',
};

export default {
  chat: chatCompletion,
  streamChat: streamChatCompletion,
  visionChat: visionChatCompletion,
  getBudgetStats,
};
