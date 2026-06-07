/**
 * services/embedding.js — Embedding 向量服务
 *
 * 封装文本 Embedding API 调用，返回浮点数向量数组。
 * 默认使用 DashScope（阿里云）的 OpenAI 兼容接口，支持 text-embedding-v3 模型。
 *
 * 架构边界：属于方案 B（微观向量检索）的数据入口，不涉及图谱（方案A）或推理（方案C）。
 *
 * 环境变量:
 *   EMBEDDING_API_KEY  — API 密钥（默认读取 DASHSCOPE_API_KEY）
 *   EMBEDDING_BASE_URL — API 基础地址（默认 DashScope）
 *   EMBEDDING_MODEL    — 模型名称（默认 text-embedding-v3）
 *   EMBEDDING_DIMS     — 向量维度（默认 1536）
 */

import axios from 'axios';

const EMBEDDING_API_KEY = process.env.EMBEDDING_API_KEY || process.env.DASHSCOPE_API_KEY || '';
const EMBEDDING_BASE_URL = process.env.EMBEDDING_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1';
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || 'text-embedding-v3';
const EMBEDDING_DIMS = parseInt(process.env.EMBEDDING_DIMS || '1536', 10);
const REQUEST_TIMEOUT_MS = 15000;

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

  if (!EMBEDDING_API_KEY) {
    throw new Error('Embedding API Key 未配置，请设置 EMBEDDING_API_KEY 或 DASHSCOPE_API_KEY 环境变量');
  }

  try {
    const response = await axios.post(
      `${EMBEDDING_BASE_URL}/embeddings`,
      {
        model: EMBEDDING_MODEL,
        input: text,
        dimensions: EMBEDDING_DIMS,
      },
      {
        headers: {
          Authorization: `Bearer ${EMBEDDING_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: REQUEST_TIMEOUT_MS,
      }
    );

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
 * 批量获取 Embedding 向量（DashScope 支持批量输入）
 * @param {string[]} texts - 文本数组
 * @returns {Promise<number[][]>} 向量数组的数组
 */
export async function getBatchEmbeddings(texts) {
  if (!Array.isArray(texts) || texts.length === 0) {
    throw new Error('批量 Embedding 输入不能为空数组');
  }

  if (!EMBEDDING_API_KEY) {
    throw new Error('Embedding API Key 未配置，请设置 EMBEDDING_API_KEY 或 DASHSCOPE_API_KEY 环境变量');
  }

  // DashScope 单次最多 25 条，超出则分批
  const BATCH_LIMIT = 25;
  const results = [];

  for (let i = 0; i < texts.length; i += BATCH_LIMIT) {
    const batch = texts.slice(i, i + BATCH_LIMIT);

    try {
      const response = await axios.post(
        `${EMBEDDING_BASE_URL}/embeddings`,
        {
          model: EMBEDDING_MODEL,
          input: batch,
          dimensions: EMBEDDING_DIMS,
        },
        {
          headers: {
            Authorization: `Bearer ${EMBEDDING_API_KEY}`,
            'Content-Type': 'application/json',
          },
          timeout: REQUEST_TIMEOUT_MS * 2,
        }
      );

      const embeddings = response.data?.data;
      if (!Array.isArray(embeddings)) {
        throw new Error('批量 Embedding API 返回格式异常');
      }

      // 按 index 排序确保顺序正确
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

export { EMBEDDING_MODEL, EMBEDDING_DIMS };
