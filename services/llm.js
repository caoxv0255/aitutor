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
 *   MINIMAX_API_KEY      — MiniMax CN API 密钥（备选; api.minimaxi.com, OpenAI 兼容）
 *   LLM_DEFAULT_MODEL    — 默认模型覆盖（未设置时按已配置的 Key 自动选择）
 *   LLM_MAX_RETRIES      — 最大重试次数（默认 2）
 *   LLM_BUDGET_DAILY     — 每日预算（元，默认 100）
 */

const DEFAULT_DASHSCOPE_COMPATIBLE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1';
const DEFAULT_DASHSCOPE_NATIVE_URL = 'https://dashscope.aliyuncs.com/api/v1';
const DEEPSEEK_ENDPOINT = 'https://api.deepseek.com/v1/chat/completions';
// MiniMax CN 开放平台 (2026 实测): OpenAI 兼容 /v1/chat/completions, Bearer 认证,
// 支持 response_format json_object; 思考内容以 <think> 标签混入 content (safeParseLLMJson 已剥离)
const MINIMAX_ENDPOINT = process.env.MINIMAX_BASE_URL || 'https://api.minimaxi.com/v1/chat/completions';
// 本地 Ollama (OpenAI 兼容 /v1). 用于视觉模型兜底 (MiniMax CN 无 VL 模型)
const OLLAMA_ENDPOINT = ((process.env.OLLAMA_URL || '').replace(/\/$/, '') || 'http://127.0.0.1:11434') + '/v1/chat/completions';

// Phase-B-fix (2026-08-24): 引入 ai_trace 统一埋点 (B1)
// - recordAiTrace 异步 fire-and-forget, 写入失败不抛
// - services/* 同层, 无循环依赖 (lazy import api/core/db.js)
import { recordAiTraceAsync, generateTraceId } from './aiTrace.js';

// 2026-09-25: 私有 MaaS 视觉通路需要读取 ~/.secrets 凭据 + 用 sharp 读图片尺寸
// (校验 qwen3-vl 最小边约束)。sharp 已是本仓依赖 (api/handlers/upload/imageHandler.js
// 在用), 此处不新增依赖。
import { readFileSync } from 'node:fs';
import { join as joinPath } from 'node:path';
import { homedir } from 'node:os';
import sharp from 'sharp';

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

// 模型定义单一真相源: endpoint / keyEnv / mode / 单价. /api/proxy 的白名单与 key 映射
// 也从这里派生 (见 api/handlers/proxy.js), 避免两处模型表各自漂移.
export const MODEL_CONFIGS = {
  'qwen-plus': { endpoint: DASHSCOPE_ENDPOINT, keyEnv: 'DASHSCOPE_API_KEY', mode: DASHSCOPE_API_MODE, costPerMillionTokens: 0.8 },
  'qwen-max': { endpoint: DASHSCOPE_ENDPOINT, keyEnv: 'DASHSCOPE_API_KEY', mode: DASHSCOPE_API_MODE, costPerMillionTokens: 2.4 },
  'qwen-turbo': { endpoint: DASHSCOPE_ENDPOINT, keyEnv: 'DASHSCOPE_API_KEY', mode: DASHSCOPE_API_MODE, costPerMillionTokens: 0.4 },
  'qwen-vl-max': { endpoint: DASHSCOPE_ENDPOINT, keyEnv: 'DASHSCOPE_API_KEY', mode: DASHSCOPE_API_MODE, costPerMillionTokens: 12 },
  'qwen-vl-plus': { endpoint: DASHSCOPE_ENDPOINT, keyEnv: 'DASHSCOPE_API_KEY', mode: DASHSCOPE_API_MODE, costPerMillionTokens: 6 },
  'deepseek-chat': { endpoint: DEEPSEEK_ENDPOINT, keyEnv: 'DEEPSEEK_API_KEY', mode: 'compatible', costPerMillionTokens: 0.14 },
  'deepseek-reasoner': { endpoint: DEEPSEEK_ENDPOINT, keyEnv: 'DEEPSEEK_API_KEY', mode: 'compatible', costPerMillionTokens: 2.0 },
  // MiniMax CN (2026-08 实测可用; costPerMillionTokens 为混合进出近似价)
  'MiniMax-M2.7': { endpoint: MINIMAX_ENDPOINT, keyEnv: 'MINIMAX_API_KEY', mode: 'compatible', costPerMillionTokens: 3 },
  'MiniMax-M2.7-highspeed': { endpoint: MINIMAX_ENDPOINT, keyEnv: 'MINIMAX_API_KEY', mode: 'compatible', costPerMillionTokens: 2 },
  'MiniMax-M2': { endpoint: MINIMAX_ENDPOINT, keyEnv: 'MINIMAX_API_KEY', mode: 'compatible', costPerMillionTokens: 2 },
  // 本地 Ollama llava — 视觉兜底 (本地推理, 成本 0); key=上游真实模型名
  'llava': { endpoint: OLLAMA_ENDPOINT, keyEnv: 'OLLAMA_API_KEY', mode: 'compatible', costPerMillionTokens: 0 },
};

// P0-fix (2026-08-24): 删除 'deepseek-v4-pro' (DeepSeek 官方无此模型),
// 添加 'deepseek-reasoner' (DeepSeek 官方推理模型) 作为替代.
const FALLBACK_MATRIX = {
  'qwen-plus': ['qwen-turbo', 'deepseek-chat', 'MiniMax-M2.7-highspeed'],
  'qwen-max': ['qwen-plus', 'qwen-turbo', 'MiniMax-M2.7'],
  'qwen-turbo': ['deepseek-chat', 'MiniMax-M2.7-highspeed'],
  'qwen-vl-max': ['qwen-vl-plus', 'llava'],
  'qwen-vl-plus': ['qwen-vl-max', 'llava'],
  'deepseek-chat': ['MiniMax-M2.7-highspeed'],
  'deepseek-reasoner': ['deepseek-chat'],
  'MiniMax-M2.7': ['MiniMax-M2.7-highspeed', 'MiniMax-M2'],
  'MiniMax-M2.7-highspeed': ['MiniMax-M2'],
  'MiniMax-M2': [],
};

// 默认模型自动选择 (2026-08-25): 按已配置的 API Key 决定主模型,
// 未设置任何 Key 时保持 qwen-plus 以便错误信息与历史行为一致.
function resolveDefaultModel() {
  const override = process.env.LLM_DEFAULT_MODEL;
  if (override && MODEL_CONFIGS[override]) return override;
  if (process.env.DASHSCOPE_API_KEY) return 'qwen-plus';
  if (process.env.MINIMAX_API_KEY) return 'MiniMax-M2.7';
  if (process.env.DEEPSEEK_API_KEY) return 'deepseek-chat';
  return 'qwen-plus';
}

const DEFAULT_MODEL = resolveDefaultModel();

// ai_trace provider 归属: MiniMax-* → minimax, deepseek-* → deepseek, 其余(默认 qwen) → dashscope
function providerOf(model) {
  if (typeof model === 'string' && model.startsWith('MiniMax-')) return 'minimax';
  if (typeof model === 'string' && model.startsWith('deepseek-')) return 'deepseek';
  return 'dashscope';
}
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
  // budgetEnforce (2026-09-22, 默认 true 保持现状): false 时预算超额不抛错、照常调用,
  // 但 recordUsage 与 ai_trace 记账照常 (「只观测不拦」). 仅由调用点显式传入生效.
  const { model = DEFAULT_MODEL, retries = MAX_RETRIES, feature = 'other', budgetEnforce = true } = options;

  let currentModel = model;
  const fallbackChain = [...FALLBACK_MATRIX[model] || []];
  let attempt = 0;

  while (attempt <= retries) {
    try {
      const budgetOk = await checkBudget(currentModel, options.max_tokens || 3000, feature);
      if (!budgetOk) {
        if (budgetEnforce) {
          throw new Error(`${feature}功能每日预算已耗尽`);
        }
        console.warn(`[LLM] 预算已超额, 按观测模式放行: feature=${feature} model=${currentModel}`);
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
  // Phase-B-fix (2026-08-24): ai_trace 埋点 — B1 (services/llm.js 三大出口之一)
  // - request_id / user_id / task_type 来自 options (caller 注入)
  // - 优先 task_type (caller 显式), 否则用 feature (兼容旧 feature budget)
  // - try-finally 保证异常路径也记录
  const tStart = Date.now();
  const request_id = options.request_id || generateTraceId();
  const user_id = options.user_id || 'system';
  const task_type = options.task_type || options.feature || 'chat';
  let currentModel = options.model || DEFAULT_MODEL;
  let result;
  let errorMsg = null;
  try {
    result = await callWithFallback(systemPrompt, userPrompt, options, callModel);
    currentModel = result.model || currentModel;
    return result;
  } catch (err) {
    errorMsg = err.message || String(err);
    throw err;
  } finally {
    const usage = result?.usage || {};
    const cost = (typeof result?.cost === 'number')
      ? result.cost
      : ((usage.total_tokens || 0) / 1_000_000) * (MODEL_CONFIGS[currentModel]?.costPerMillionTokens || 0);
    recordAiTraceAsync({
      request_id,
      user_id,
      session_id: options.session_id,
      task_type,
      provider: providerOf(currentModel),
      model: currentModel,
      prompt_tokens: usage.prompt_tokens || 0,
      completion_tokens: usage.completion_tokens || 0,
      latency_ms: Date.now() - tStart,
      cost_cny: cost,
      success: !errorMsg,
      error_message: errorMsg,
    });
  }
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
  // Phase-B-fix (2026-08-24): ai_trace 埋点 — B1 (services/llm.js 三大出口之二)
  // 流式: 在外层 generator 的 finally 中记录; usage 仅 final usage 时记录,
  //   prompt_tokens 由上游拼 system+user 长度估算 (无最终 token 报告),
  //   completion_tokens = 累计 yield 字符数近似
  const tStart = Date.now();
  const request_id = options.request_id || generateTraceId();
  const user_id = options.user_id || 'system';
  const task_type = options.task_type || options.feature || 'chat_stream';
  const initialModel = options.model || DEFAULT_MODEL;
  let currentModel = initialModel;
  let completionChars = 0;
  let lastErrMsg = null;
  let resolvedModel = initialModel;
  let promptTokensEstimate = 0;

  // 粗略估算 prompt tokens (中英文 1 token ≈ 1.5-2 字符)
  try {
    promptTokensEstimate = Math.ceil(((systemPrompt?.length || 0) + (userPrompt?.length || 0)) / 2);
  } catch (_) { /* ignore */ }

  try {
    const { model = DEFAULT_MODEL, retries = MAX_RETRIES } = options;
    const fallbackChain = [...FALLBACK_MATRIX[model] || []];
    let attempt = 0;

    while (attempt <= retries) {
      try {
        if (!await checkBudget(currentModel, options.max_tokens || 3000)) {
          throw new Error('每日预算已耗尽');
        }

        for await (const chunk of streamCallModel(systemPrompt, userPrompt, { ...options, model: currentModel })) {
          completionChars += (chunk?.length || 0);
          yield chunk;
        }
        resolvedModel = currentModel;
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
  } catch (err) {
    lastErrMsg = err.message || String(err);
    throw err;
  } finally {
    const completionTokensEstimate = Math.ceil(completionChars / 2);
    const totalTokens = promptTokensEstimate + completionTokensEstimate;
    const cost = (totalTokens / 1_000_000) * (MODEL_CONFIGS[resolvedModel]?.costPerMillionTokens || 0);
    recordAiTraceAsync({
      request_id,
      user_id,
      session_id: options.session_id,
      task_type,
      provider: providerOf(resolvedModel),
      model: resolvedModel,
      prompt_tokens: promptTokensEstimate,
      completion_tokens: completionTokensEstimate,
      latency_ms: Date.now() - tStart,
      cost_cny: cost,
      success: !lastErrMsg,
      error_message: lastErrMsg,
    });
  }
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
  // Phase-B-fix (2026-08-24): ai_trace 埋点 — B1 (services/llm.js 三大出口之三)
  const tStart = Date.now();
  const request_id = options.request_id || generateTraceId();
  const user_id = options.user_id || 'system';
  const task_type = options.task_type || options.feature || 'vision_chat';
  let currentModel = options.model || 'qwen-vl-max';
  let result;
  let errorMsg = null;
  try {
    result = await callWithFallback(
      systemPrompt,
      { userText, imageBase64 },
      options,
      (sys, payload, opts) => visionCallModel(sys, payload.userText, payload.imageBase64, opts)
    );
    currentModel = result.model || currentModel;
    return result;
  } catch (err) {
    errorMsg = err.message || String(err);
    throw err;
  } finally {
    const usage = result?.usage || {};
    const cost = (typeof result?.cost === 'number')
      ? result.cost
      : ((usage.total_tokens || 0) / 1_000_000) * (MODEL_CONFIGS[currentModel]?.costPerMillionTokens || 0);
    recordAiTraceAsync({
      request_id,
      user_id,
      session_id: options.session_id,
      task_type,
      provider: providerOf(currentModel),
      model: currentModel,
      prompt_tokens: usage.prompt_tokens || 0,
      completion_tokens: usage.completion_tokens || 0,
      latency_ms: Date.now() - tStart,
      cost_cny: cost,
      success: !errorMsg,
      error_message: errorMsg,
    });
  }
}

// ────────────────────────────────────────────────────────────────────────────
// 私有 MaaS 视觉通路 (2026-09-25) — provider 分支: 'maas' / qwen3-vl
//
// 为什么新增 (实测结论, 不是推测):
//   - MiniMax-M2.7 + image_url → HTTP 200 但**静默丢图**; MiniMax 全族无 VL 模型.
//   - DashScope qwen-vl-* (现有 visionCallModel 唯一通路) 实测 400 欠费.
//   - 阿里私有 MaaS (OpenAI 兼容) 的 qwen3-vl-flash 同格式 200 且答对看图题.
//
// 凭据 (只读取; 绝不写进日志 / 响应体):
//   env ALIYUN_MAAS_BASE_URL / ALIYUN_MAAS_API_KEY 优先 (便于轮换);
//   否则读 ~/.secrets/aliyun_maas_base 与 ~/.secrets/aliyun_maas_key.
//
// 约束: qwen3-vl 要求图片**最小边 > 10px**, 否则上游 400 (8×8 实测被拒).
//   本模块在能拿到图片字节 (base64) 时前置拦截并抛出可读错误; 传 URL 时无法
//   在不额外拉取的前提下量尺寸, 交由上游兜底 —— 该局限已在注释中写明.
// ────────────────────────────────────────────────────────────────────────────

const MAAS_DEFAULT_MODEL = 'qwen3-vl-flash';
const MAAS_SECRETS_DIR = joinPath(homedir(), '.secrets');
const MAAS_MIN_IMAGE_EDGE = 10; // px, 严格大于该值
const MAAS_MAX_IMAGE_EDGE = 8000; // px, 与 imageHandler 上限一致

/** 读取一个凭据: env 优先, 其次 ~/.secrets/<name>. 返回 trim 后的字符串或 null. */
function readCredential(name, envName) {
  const fromEnv = process.env[envName];
  if (fromEnv && String(fromEnv).trim()) return String(fromEnv).trim();
  try {
    const raw = readFileSync(joinPath(MAAS_SECRETS_DIR, name), 'utf-8').trim();
    return raw || null;
  } catch (_) {
    return null; // 文件缺失/不可读 → 视为未配置
  }
}

/**
 * 解析当前生效的私有 MaaS 配置. 不缓存 —— 便于测试改 env 后立即生效.
 * @returns {{baseUrl: string|null, apiKey: string|null, configured: boolean}}
 */
export function resolveMaasConfig() {
  const baseUrl = readCredential('aliyun_maas_base', 'ALIYUN_MAAS_BASE_URL');
  const apiKey = readCredential('aliyun_maas_key', 'ALIYUN_MAAS_API_KEY');
  return { baseUrl, apiKey, configured: Boolean(baseUrl && apiKey) };
}

/** 去掉可能存在的 `data:image/...;base64,` 前缀 */
function stripDataUrlPrefix(input) {
  return String(input).replace(/^data:image\/[\w.+-]+;base64,/i, '');
}

/**
 * 前置校验图片尺寸 (仅在有字节时可用). 违反最小边约束时抛出可读错误,
 * 避免上游返回含糊的 400。
 */
async function assertImageEdges(buffer) {
  let meta;
  try {
    meta = await sharp(buffer).metadata();
  } catch (e) {
    throw new Error(`无法解码图片: ${e.message}`);
  }
  const w = meta.width || 0;
  const h = meta.height || 0;
  if (w === 0 || h === 0) {
    throw new Error('图片尺寸不可读 (宽或高为 0)');
  }
  const minEdge = Math.min(w, h);
  if (minEdge <= MAAS_MIN_IMAGE_EDGE) {
    throw new Error(
      `图片最小边 ${minEdge}px 必须大于 ${MAAS_MIN_IMAGE_EDGE}px (qwen3-vl 约束, 当前 ${w}x${h})`
    );
  }
  if (w > MAAS_MAX_IMAGE_EDGE || h > MAAS_MAX_IMAGE_EDGE) {
    throw new Error(
      `图片尺寸过大 ${w}x${h} (上限 ${MAAS_MAX_IMAGE_EDGE}x${MAAS_MAX_IMAGE_EDGE})`
    );
  }
}

/**
 * 构造 OpenAI 兼容 content 数组: 文本 + 每张图一个 image_url 项.
 * @param {string} userText
 * @param {Array<{base64?:string, url?:string}>} images
 * @returns {Promise<Array>}
 */
async function buildMaasContent(userText, images) {
  const content = [];
  if (userText) content.push({ type: 'text', text: userText });

  for (const img of images || []) {
    if (!img || typeof img !== 'object') continue;

    if (typeof img.base64 === 'string' && img.base64.trim()) {
      const buffer = Buffer.from(stripDataUrlPrefix(img.base64), 'base64');
      if (buffer.length === 0) throw new Error('图片 base64 解码后为空');
      await assertImageEdges(buffer); // 有字节 → 前置尺寸校验
      content.push({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${buffer.toString('base64')}` } });
    } else if (typeof img.url === 'string' && /^https?:\/\//i.test(img.url)) {
      content.push({ type: 'image_url', image_url: { url: img.url } });
    } else {
      throw new Error('图片必须是 http(s) URL 或 base64 (data URL 亦可)');
    }
  }

  if (!content.some((c) => c.type === 'image_url')) {
    throw new Error('至少需要 1 张图片');
  }
  return content;
}

/**
 * 私有 MaaS 视觉调用 (qwen3-vl). 不对现有 DashScope / MiniMax 路径做任何改动。
 *
 * @param {object} args
 * @param {string} [args.systemText]  system 指令 (可为空)
 * @param {string} [args.userText]    user 文本
 * @param {Array<{base64?:string,url?:string}>} args.images
 * @param {object} [args.options]     { model, temperature, max_tokens, jsonMode,
 *                                      task_type, user_id, request_id }
 * @returns {Promise<{content:string, usage:object, model:string, provider:string}>}
 */
export async function maasVisionChatCompletion({ systemText = '', userText = '', images = [], options = {} } = {}) {
  const tStart = Date.now();
  const {
    model = MAAS_DEFAULT_MODEL,
    temperature = 0.2,
    max_tokens = 4000,
    jsonMode = true,
    task_type = options.feature || 'vision_maas',
    user_id = 'system',
  } = options;
  const request_id = options.request_id || generateTraceId();

  const { baseUrl, apiKey, configured } = resolveMaasConfig();
  let errorMsg = null;
  let usage = {};

  try {
    if (!configured) {
      throw new Error(
        '私有 MaaS 视觉通路未配置: 需 ALIYUN_MAAS_BASE_URL/ALIYUN_MAAS_API_KEY 或 ~/.secrets/aliyun_maas_{base,key}'
      );
    }

    const content = await buildMaasContent(userText, images);
    const messages = [];
    if (systemText) messages.push({ role: 'system', content: systemText });
    messages.push({ role: 'user', content });

    const body = {
      model,
      messages,
      temperature: Math.min(Math.max(temperature, 0), 2),
      max_tokens: Math.min(Math.max(max_tokens, 100), 32000),
    };
    if (jsonMode) body.response_format = { type: 'json_object' };

    const endpoint = `${baseUrl.replace(/\/$/, '')}/chat/completions`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS * 2);

    let response;
    let data;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      data = await response.json().catch(() => ({}));
    } catch (e) {
      if (e.name === 'AbortError') {
        throw new Error(`私有 MaaS 视觉请求超时 (${REQUEST_TIMEOUT_MS * 2}ms)`);
      }
      throw e;
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const errMsg = data.error?.message || data.message || `HTTP ${response.status}`;
      throw new Error(`私有 MaaS 视觉 API 错误: ${errMsg}`);
    }

    const out = data.choices?.[0]?.message?.content;
    if (!out) throw new Error('私有 MaaS 视觉返回内容为空');

    usage = data.usage || {};
    return { content: out, usage, model: data.model || model, provider: 'maas' };
  } catch (err) {
    errorMsg = err.message || String(err);
    throw err;
  } finally {
    const cost = ((usage.total_tokens || 0) / 1_000_000) * 0; // 私有 MaaS 无公开单价, 记 0
    recordAiTraceAsync({
      request_id,
      user_id,
      session_id: options.session_id,
      task_type,
      provider: 'maas',
      model,
      prompt_tokens: usage.prompt_tokens || 0,
      completion_tokens: usage.completion_tokens || 0,
      latency_ms: Date.now() - tStart,
      cost_cny: cost,
      success: !errorMsg,
      error_message: errorMsg,
    });
  }
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
  // 2026-09-25: 私有 MaaS (qwen3-vl) 视觉通路 — 与 visionChat 并列, 不改动后者
  maasVision: maasVisionChatCompletion,
  getBudgetStats,
};

export const MODELS = {
  QWEN_PLUS: 'qwen-plus',
  QWEN_MAX: 'qwen-max',
  QWEN_TURBO: 'qwen-turbo',
  QWEN_VL_MAX: 'qwen-vl-max',
  QWEN_VL_PLUS: 'qwen-vl-plus',
  DEEPSEEK_CHAT: 'deepseek-chat',
  // P0-fix (2026-08-24): DeepSeek 官方无 'deepseek-v4-pro', 改用官方推理模型 'deepseek-reasoner'
  DEEPSEEK_REASONER: 'deepseek-reasoner',
  // MiniMax CN (2026-08-25 接入)
  MINIMAX_M27: 'MiniMax-M2.7',
  MINIMAX_M27_HS: 'MiniMax-M2.7-highspeed',
  MINIMAX_M2: 'MiniMax-M2',
  // 私有 MaaS (2026-09-25 接入) — 仅供 llm.maasVision 使用, 不进 /api/proxy 白名单
  MAAS_VL_FLASH: 'qwen3-vl-flash',
  MAAS_VL_PLUS: 'qwen3-vl-plus',
};

export default {
  chat: chatCompletion,
  streamChat: streamChatCompletion,
  visionChat: visionChatCompletion,
  maasVision: maasVisionChatCompletion,
  getBudgetStats,
};
