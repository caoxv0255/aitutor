/**
 * services/embedding.js — Embedding 向量服务
 *
 * 封装文本 Embedding API 调用，返回浮点数向量数组。
 * 支持两种模式：
 *   1. 本地模式：本地 sentence-transformers 模型（embedding_server.py）
 *   2. 在线模式：OpenAI 兼容接口（DashScope 等）
 *
 * 通过 EMBEDDING_PROVIDER=local|remote 控制
 *
 * 架构边界：属于方案 B（微观向量检索）的数据入口，不涉及图谱（方案A）或推理（方案C）。
 *
 * 环境变量:
 *   EMBEDDING_PROVIDER — 提供方: "local" (本地模型) 或 "remote" (在线API)
 *   EMBEDDING_API_KEY  — API 密钥（本地模式不需要）
 *   EMBEDDING_BASE_URL — API 基础地址
 *   EMBEDDING_MODEL    — 模型名称
 *   EMBEDDING_DIMS     — 向量维度
 */

import axios from 'axios';

const EMBEDDING_PROVIDER = process.env.EMBEDDING_PROVIDER || 'remote';
const EMBEDDING_API_KEY = process.env.EMBEDDING_API_KEY || process.env.DASHSCOPE_API_KEY || '';
const EMBEDDING_BASE_URL = process.env.EMBEDDING_BASE_URL ||
  (EMBEDDING_PROVIDER === 'local' ? 'http://localhost:8000/v1' : 'https://dashscope.aliyuncs.com/compatible-mode/v1');
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL ||
  (EMBEDDING_PROVIDER === 'local' ? 'shibing624/text2vec-base-chinese' : 'text-embedding-v3');
const EMBEDDING_DIMS = parseInt(process.env.EMBEDDING_DIMS ||
  (EMBEDDING_PROVIDER === 'local' ? '768' : '1536'), 10);
const REQUEST_TIMEOUT_MS = process.env.EMBEDDING_PROVIDER === 'local' ? 30000 : 15000;
const IS_LOCAL = EMBEDDING_PROVIDER === 'local';

if (IS_LOCAL) {
  console.log(`[Embedding] 本地模式: ${EMBEDDING_BASE_URL}, 模型: ${EMBEDDING_MODEL}, 维度: ${EMBEDDING_DIMS}`);
} else {
  console.log(`[Embedding] 在线模式: ${EMBEDDING_BASE_URL}, 模型: ${EMBEDDING_MODEL}, 维度: ${EMBEDDING_DIMS}`);
}

/**
 * 获取文本的 Embedding 向量
 * @param {string} text - 输入文本
 * @returns {Promise<number[]>} 浮点数向量数组
 * @throws {Error} 当 API 调用失败或返回维度不匹配时
 */
export async function getEmbedding(text) {
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    throw new Error('Embedding 输入文本不能为空');
  }

  if (!IS_LOCAL && !EMBEDDING_API_KEY) {
    throw new Error('Embedding API Key 未配置，请设置 EMBEDDING_API_KEY 或 DASHSCOPE_API_KEY 环境变量');
  }

  try {
    const body = {
      model: EMBEDDING_MODEL,
      input: text,
    };
    if (!IS_LOCAL) {
      body.dimensions = EMBEDDING_DIMS;
    }

    const headers = { 'Content-Type': 'application/json' };
    if (!IS_LOCAL) {
      headers.Authorization = `Bearer ${EMBEDDING_API_KEY}`;
    }

    const response = await axios.post(`${EMBEDDING_BASE_URL}/embeddings`, body, {
      headers,
      timeout: REQUEST_TIMEOUT_MS,
    });

    const embedding = response.data?.data?.[0]?.embedding;

    if (!embedding || !Array.isArray(embedding)) {
      throw new Error('Embedding API 返回格式异常：缺少 data[0].embedding');
    }

    if (embedding.length !== EMBEDDING_DIMS) {
      console.warn(`Embedding 维度不匹配: 期望 ${EMBEDDING_DIMS}，实际 ${embedding.length}`);
    }

    return embedding;
  } catch (err) {
    if (axios.isAxiosError(err)) {
      const status = err.response?.status;
      const apiMsg = err.response?.data?.error?.message || err.message;
      throw new Error(`Embedding API 请求失败 [${status || 'NETWORK'}]: ${apiMsg}`);
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

  if (!IS_LOCAL && !EMBEDDING_API_KEY) {
    throw new Error('Embedding API Key 未配置，请设置 EMBEDDING_API_KEY 或 DASHSCOPE_API_KEY 环境变量');
  }

  const BATCH_LIMIT = IS_LOCAL ? 32 : 25;
  const results = [];

  for (let i = 0; i < texts.length; i += BATCH_LIMIT) {
    const batch = texts.slice(i, i + BATCH_LIMIT);

    try {
      const body = { model: EMBEDDING_MODEL, input: batch };
      if (!IS_LOCAL) body.dimensions = EMBEDDING_DIMS;

      const headers = { 'Content-Type': 'application/json' };
      if (!IS_LOCAL) headers.Authorization = `Bearer ${EMBEDDING_API_KEY}`;

      const response = await axios.post(`${EMBEDDING_BASE_URL}/embeddings`, body, {
        headers,
        timeout: REQUEST_TIMEOUT_MS * 2,
      });

      const embeddings = response.data?.data;
      if (!Array.isArray(embeddings)) {
        throw new Error('批量 Embedding API 返回格式异常');
      }

      const sorted = embeddings.sort((a, b) => a.index - b.index);
      results.push(...sorted.map((item) => item.embedding));
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const status = err.response?.status;
        const apiMsg = err.response?.data?.error?.message || err.message;
        throw new Error(`批量 Embedding API 请求失败 [${status || 'NETWORK'}]: ${apiMsg}`);
      }
      throw err;
    }
  }

  return results;
}

export { EMBEDDING_MODEL, EMBEDDING_DIMS, IS_LOCAL };
