/**
 * services/embedding.js — Embedding 向量服务
 *
 * 封装文本 Embedding API 调用，返回浮点数向量数组。
 * 支持 3 种模式:
 *   1. local:    本地 sentence-transformers (embedding_server.py, 768 dim)
 *   2. ollama:   本地 Ollama /api/embeddings (nomic-embed-text, 768 dim)
 *   3. remote:   OpenAI 兼容 / DashScope (text-embedding-v3, 1536 dim)
 *
 * 通过 EMBEDDING_PROVIDER=local|ollama|remote 控制
 *
 * 架构边界：属于方案 B（微观向量检索）的数据入口，不涉及图谱（方案A）或推理（方案C）。
 *
 * 环境变量:
 *   EMBEDDING_PROVIDER — 提供方: "local" / "ollama" / "remote"
 *   EMBEDDING_API_KEY  — API 密钥（本地/ollama 不需要）
 *   EMBEDDING_BASE_URL — API 基础地址
 *   EMBEDDING_MODEL    — 模型名称
 *   EMBEDDING_DIMS     — 向量维度
 *   OLLAMA_URL         — Ollama 端点 (默认 http://localhost:11434)
 */

import axios from 'axios';

const EMBEDDING_PROVIDER = process.env.EMBEDDING_PROVIDER || 'remote';
const EMBEDDING_API_KEY = process.env.EMBEDDING_API_KEY || process.env.DASHSCOPE_API_KEY || '';

// 各 provider 默认 endpoint + model + dim
const PROVIDER_DEFAULTS = {
  local:  { base_url: 'http://localhost:8000/v1',   model: 'shibing624/text2vec-base-chinese', dim: 768  },
  ollama: { base_url: 'http://localhost:11434',     model: 'nomic-embed-text',                  dim: 768  },
  remote: { base_url: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'text-embedding-v3', dim: 1536 },
};

const DEFAULTS = PROVIDER_DEFAULTS[EMBEDDING_PROVIDER] || PROVIDER_DEFAULTS.remote;
const EMBEDDING_BASE_URL = process.env.EMBEDDING_BASE_URL || DEFAULTS.base_url;
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || DEFAULTS.model;
const EMBEDDING_DIMS = parseInt(process.env.EMBEDDING_DIMS || DEFAULTS.dim, 10);
const REQUEST_TIMEOUT_MS = (EMBEDDING_PROVIDER === 'remote') ? 15000 : 30000;
const NEEDS_AUTH = EMBEDDING_PROVIDER === 'remote';

console.log(`[Embedding] provider=${EMBEDDING_PROVIDER} url=${EMBEDDING_BASE_URL} model=${EMBEDDING_MODEL} dim=${EMBEDDING_DIMS}`);

/**
 * 获取文本的 Embedding 向量
 * @param {string} text - 输入文本
 * @returns {Promise<number[]>} 浮点数向量数组
 */
export async function getEmbedding(text) {
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    throw new Error('Embedding 输入文本不能为空');
  }
  if (NEEDS_AUTH && !EMBEDDING_API_KEY) {
    throw new Error('Embedding API Key 未配置，请设置 EMBEDDING_API_KEY 或 DASHSCOPE_API_KEY 环境变量');
  }

  try {
    let body, endpoint, headers = { 'Content-Type': 'application/json' };

    if (EMBEDDING_PROVIDER === 'ollama') {
      // Ollama 原生 /api/embeddings: prompt 单数, response.embedding
      endpoint = `${EMBEDDING_BASE_URL}/api/embeddings`;
      body = { model: EMBEDDING_MODEL, prompt: text.slice(0, 8000) };
    } else {
      // OpenAI 兼容: input, data[].embedding
      endpoint = `${EMBEDDING_BASE_URL}/embeddings`;
      body = { model: EMBEDDING_MODEL, input: text };
      if (EMBEDDING_PROVIDER === 'remote') body.dimensions = EMBEDDING_DIMS;
      if (NEEDS_AUTH) headers.Authorization = `Bearer ${EMBEDDING_API_KEY}`;
    }

    const response = await axios.post(endpoint, body, { headers, timeout: REQUEST_TIMEOUT_MS });

    let embedding;
    if (EMBEDDING_PROVIDER === 'ollama') {
      embedding = response.data?.embedding;
    } else {
      embedding = response.data?.data?.[0]?.embedding;
    }

    if (!embedding || !Array.isArray(embedding)) {
      throw new Error(`Embedding API 返回格式异常: ${JSON.stringify(response.data).slice(0, 200)}`);
    }

    if (embedding.length !== EMBEDDING_DIMS) {
      console.warn(`Embedding 维度不匹配: 期望 ${EMBEDDING_DIMS}，实际 ${embedding.length}`);
    }

    return embedding;
  } catch (err) {
    if (axios.isAxiosError(err)) {
      const status = err.response?.status;
      const apiMsg = err.response?.data?.error?.message || err.message;
      throw new Error(`Embedding API 请求失败 [${status || 'NETWORK'}] (${EMBEDDING_PROVIDER}): ${apiMsg}`);
    }
    throw err;
  }
}

/**
 * 批量获取 Embedding 向量
 * @param {string[]} texts - 文本数组
 * @returns {Promise<number[][]>} 向量数组的数组
 */
export async function getBatchEmbeddings(texts) {
  if (!Array.isArray(texts) || texts.length === 0) {
    throw new Error('批量 Embedding 输入不能为空数组');
  }
  if (NEEDS_AUTH && !EMBEDDING_API_KEY) {
    throw new Error('Embedding API Key 未配置');
  }

  const BATCH_LIMIT = (EMBEDDING_PROVIDER === 'ollama') ? 1 : (EMBEDDING_PROVIDER === 'local' ? 32 : 25);
  // 注意: Ollama 原生 /api/embeddings 不支持 batch (单 prompt), 串行调
  const results = [];

  for (let i = 0; i < texts.length; i += BATCH_LIMIT) {
    const batch = texts.slice(i, i + BATCH_LIMIT);

    for (const t of batch) {
      if (EMBEDDING_PROVIDER === 'ollama') {
        // 串行调 (Ollama /api/embeddings 单 prompt)
        results.push(await getEmbedding(t));
      } else {
        // OpenAI 兼容 batch
        const body = { model: EMBEDDING_MODEL, input: batch };
        if (EMBEDDING_PROVIDER === 'remote') body.dimensions = EMBEDDING_DIMS;
        const headers = { 'Content-Type': 'application/json' };
        if (NEEDS_AUTH) headers.Authorization = `Bearer ${EMBEDDING_API_KEY}`;

        const response = await axios.post(`${EMBEDDING_BASE_URL}/embeddings`, body, {
          headers,
          timeout: REQUEST_TIMEOUT_MS * 2,
        });
        const embeddings = response.data?.data;
        if (!Array.isArray(embeddings)) throw new Error('批量 Embedding API 返回格式异常');
        const sorted = embeddings.sort((a, b) => a.index - b.index);
        results.push(...sorted.map((item) => item.embedding));
        break;  // batch 跑完
      }
    }
  }

  return results;
}

export { EMBEDDING_MODEL, EMBEDDING_DIMS, EMBEDDING_PROVIDER };