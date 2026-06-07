/**
 * services/llm.js — LLM 推理服务封装
 *
 * 封装 DashScope / DeepSeek 的 OpenAI 兼容 Chat Completion API 调用。
 * 支持 JSON 模式输出（response_format: { type: "json_object" }）。
 *
 * 架构边界：供方案 C（全局推理与学情）调用，不直接操作数据库或图谱。
 *
 * 环境变量:
 *   DASHSCOPE_API_KEY — DashScope API 密钥（主要）
 *   DEEPSEEK_API_KEY  — DeepSeek API 密钥（备选）
 */

const DASHSCOPE_ENDPOINT = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
const DEEPSEEK_ENDPOINT = 'https://api.deepseek.com/v1/chat/completions';

const MODEL_CONFIGS = {
  'qwen-plus': { endpoint: DASHSCOPE_ENDPOINT, keyEnv: 'DASHSCOPE_API_KEY' },
  'qwen-max': { endpoint: DASHSCOPE_ENDPOINT, keyEnv: 'DASHSCOPE_API_KEY' },
  'qwen-turbo': { endpoint: DASHSCOPE_ENDPOINT, keyEnv: 'DASHSCOPE_API_KEY' },
  'qwen-vl-max': { endpoint: DASHSCOPE_ENDPOINT, keyEnv: 'DASHSCOPE_API_KEY' },
  'qwen-vl-plus': { endpoint: DASHSCOPE_ENDPOINT, keyEnv: 'DASHSCOPE_API_KEY' },
  'deepseek-chat': { endpoint: DEEPSEEK_ENDPOINT, keyEnv: 'DEEPSEEK_API_KEY' },
  'deepseek-v4-pro': { endpoint: DEEPSEEK_ENDPOINT, keyEnv: 'DEEPSEEK_API_KEY' },
};

const DEFAULT_MODEL = 'qwen-plus';
const REQUEST_TIMEOUT_MS = 60000;

/**
 * 调用 LLM Chat Completion API
 *
 * @param {string} systemPrompt - System 角色提示
 * @param {string} userPrompt - User 角色输入
 * @param {object} [options] - 可选配置
 * @param {string} [options.model] - 模型名称（默认 qwen-plus）
 * @param {number} [options.temperature] - 温度（默认 0.3，推理场景偏低）
 * @param {number} [options.max_tokens] - 最大输出 token 数（默认 3000）
 * @param {boolean} [options.jsonMode] - 是否启用 JSON 输出模式（默认 true）
 * @returns {Promise<{content: string, usage: object}>} LLM 返回内容和 token 统计
 */
export async function chatCompletion(systemPrompt, userPrompt, options = {}) {
  const { model = DEFAULT_MODEL, temperature = 0.3, max_tokens = 3000, jsonMode = true } = options;

  // ── 解析模型配置 ──
  const config = MODEL_CONFIGS[model];
  if (!config) {
    throw new Error(`不支持的模型: ${model}`);
  }

  const apiKey = process.env[config.keyEnv];
  if (!apiKey) {
    throw new Error(`API Key 未配置: ${config.keyEnv}`);
  }

  // ── 构建请求体 ──
  const body = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: Math.min(Math.max(temperature, 0), 2),
    max_tokens: Math.min(Math.max(max_tokens, 100), 8000),
  };

  // 强制 JSON 输出模式
  if (jsonMode) {
    body.response_format = { type: 'json_object' };
  }

  // ── 发送请求 ──
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

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
      throw new Error(`LLM API 错误: ${errMsg}`);
    }

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('LLM 返回内容为空');
    }

    return {
      content,
      usage: data.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      model: data.model || model,
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

/**
 * 安全解析 LLM 返回的 JSON 内容
 * 处理常见的格式问题：Markdown 代码块包裹、尾部逗号、think 标签等
 *
 * @param {string} content - LLM 返回的原始文本
 * @returns {object} 解析后的 JSON 对象
 * @throws {Error} 解析失败时抛出
 */
export function safeParseLLMJson(content) {
  if (!content || typeof content !== 'string') {
    throw new Error('LLM 返回内容为空');
  }

  // 清理 think 标签（某些模型会输出思考过程）
  let cleaned = content.replace(/<think[\s\S]*?<\/think>/g, '').trim();

  // 清理 Markdown 代码块标记
  cleaned = cleaned
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();

  // 尝试直接解析
  try {
    return JSON.parse(cleaned);
  } catch {
    // 继续尝试修复
  }

  // 提取最外层 JSON 对象
  const braceMatch = cleaned.match(/\{[\s\S]*\}/);
  if (braceMatch) {
    try {
      return JSON.parse(braceMatch[0]);
    } catch {
      // 继续尝试修复
    }

    // 修复尾部逗号
    try {
      const fixed = braceMatch[0].replace(/,\s*([}\]])/g, '$1');
      return JSON.parse(fixed);
    } catch {
      // 放弃
    }
  }

  throw new Error(`无法解析 LLM 返回的 JSON: ${cleaned.slice(0, 200)}...`);
}

/**
 * 流式调用 LLM Chat Completion API（SSE 支持）
 *
 * 返回 async generator，每次 yield 一个文本 delta 片段。
 * 适用于 SSE 流式推送场景（方案 C 教学 Agent）。
 *
 * @param {string} systemPrompt
 * @param {string} userPrompt
 * @param {object} [options] - 同 chatCompletion
 * @param {object} [options.signal] - AbortSignal 用于客户端断开时取消
 * @yields {string} 文本 delta 片段
 */
export async function* streamChatCompletion(systemPrompt, userPrompt, options = {}) {
  const {
    model = DEFAULT_MODEL,
    temperature = 0.3,
    max_tokens = 3000,
    jsonMode = false, // 流式模式不开启 JSON mode
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
    max_tokens: Math.min(Math.max(max_tokens, 100), 8000),
  };

  if (jsonMode) {
    body.response_format = { type: 'json_object' };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  // 允许外部 signal 也能取消
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

    // 解析 SSE 流
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop(); // 保留未完整的行

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
          // 忽略非 JSON 行
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

export { DEFAULT_MODEL };

/**
 * 多模态视觉调用 LLM（Vision Chat Completion）
 *
 * 支持图片 + 文本的多模态输入，适用于试卷/错题图片解析。
 *
 * @param {string} systemPrompt - System 角色提示
 * @param {string} userText - 用户文本提示
 * @param {string} imageBase64 - Base64 编码的图片数据（不含 data:image 前缀）
 * @param {object} [options]
 * @param {string} [options.model] - 模型名称（默认 qwen-vl-max）
 * @param {number} [options.temperature] - 温度
 * @param {number} [options.max_tokens] - 最大输出 token
 * @param {boolean} [options.jsonMode] - 是否启用 JSON 输出模式
 * @returns {Promise<{content: string, usage: object}>}
 */
export async function visionChatCompletion(systemPrompt, userText, imageBase64, options = {}) {
  const { model = 'qwen-vl-max', temperature = 0.2, max_tokens = 4000, jsonMode = true } = options;

  const config = MODEL_CONFIGS[model];
  if (!config) throw new Error(`不支持的模型: ${model}`);

  const apiKey = process.env[config.keyEnv];
  if (!apiKey) throw new Error(`API Key 未配置: ${config.keyEnv}`);

  // 构建多模态消息
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
    max_tokens: Math.min(Math.max(max_tokens, 100), 8000),
  };

  if (jsonMode) {
    body.response_format = { type: 'json_object' };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS * 2); // 视觉模型较慢

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
