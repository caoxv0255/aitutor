/**
 * services/embedding.js — Embedding 向量服务
 *
 * 封装文本 Embedding API 调用，返回浮点数向量数组。
 * 支持 3 种模式 (默认 1024 dim, 与 db.js rag_questions/question_vectors schema 一致):
 *   1. local:    本地 sentence-transformers (embedding_server.py, 768 dim)
 *   2. ollama:   本地 Ollama /api/embeddings (bge-m3, 1024 dim, BAAI 多语言)
 *   3. remote:   OpenAI 兼容 / DashScope (text-embedding-v3, 1024 dim, 显式传 dimensions)
 *
 * P0-fix (2026-08-24): 统一 dim 到 1024
 *   - 历史: local 768 / ollama 768 (nomic-embed-text) / remote 1536
 *   - v0.7: 全部改 1024, 跟 db.js vector(1024) schema + migration 006 一致
 *   - 旧 768 dim 数据需 migrate-multimodal-questions.js / migration 006 重建
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
 *   EMBEDDING_DIMS     — 向量维度 (默认 1024)
 *   OLLAMA_URL         — Ollama 端点 (默认 http://localhost:11434)
 */

import axios from 'axios';
// Phase-B-fix (2026-08-24): B5 — Embedding 埋点 (record provider/model/dim)
// services/aiTrace.js 同层, lazy DB, fire-and-forget
import { recordAiTraceAsync, generateTraceId } from './aiTrace.js';

const EMBEDDING_PROVIDER = process.env.EMBEDDING_PROVIDER || 'remote';
const EMBEDDING_API_KEY = process.env.EMBEDDING_API_KEY || process.env.DASHSCOPE_API_KEY || '';

// P0-fix (2026-08-24): 全部 provider dim 统一为 1024, 跟 db.js schema 一致
//   local 原 768 (shibing624/text2vec-base-chinese) → 1024 (改用同 dim 的多语言模型, 例如 BAAI/bge-base-en-v1.5 或 sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2 的 1024 变体)
//   remote 原 1536 (text-embedding-v3) → 1024 (v3 支持 dimensions 参数)
//   注意: local 切换模型需重启 embedding_server.py; remote 通过 dimensions=1024 显式传参
const PROVIDER_DEFAULTS = {
  local:  { base_url: 'http://localhost:8000/v1',   model: 'BAAI/bge-base-en-v1.5',          dim: 1024 },
  ollama: { base_url: 'http://localhost:11434',     model: 'bge-m3',                          dim: 1024 },
  remote: { base_url: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'text-embedding-v3', dim: 1024 },
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
 * @param {object} [opts] - 透传选项 (Phase B 2026-08-24)
 * @param {string} [opts.request_id] - 调用方 trace_id
 * @param {string} [opts.user_id]    - 调用方 user_id
 * @returns {Promise<number[]>} 浮点数向量数组
 */
export async function getEmbedding(text, opts = {}) {
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    throw new Error('Embedding 输入文本不能为空');
  }
  if (NEEDS_AUTH && !EMBEDDING_API_KEY) {
    throw new Error('Embedding API Key 未配置，请设置 EMBEDDING_API_KEY 或 DASHSCOPE_API_KEY 环境变量');
  }

  // Phase-B-fix (2026-08-24): B5 — ai_trace 埋点
  const tStart = Date.now();
  const request_id = opts.request_id || generateTraceId();
  const user_id = opts.user_id || 'system';
  let embeddingLen = 0;
  let errorMsg = null;
  // 粗略估算 prompt tokens: text 字符数 / 2 (中英文均值), 与 llm.js 流式估算一致
  const promptTokensEstimate = Math.ceil((text?.length || 0) / 2);

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
    embeddingLen = embedding.length;

    return embedding;
  } catch (err) {
    if (axios.isAxiosError(err)) {
      const status = err.response?.status;
      const apiMsg = err.response?.data?.error?.message || err.message;
      errorMsg = `Embedding API 请求失败 [${status || 'NETWORK'}] (${EMBEDDING_PROVIDER}): ${apiMsg}`;
    } else {
      errorMsg = err.message || String(err);
    }
    throw new Error(errorMsg);
  } finally {
    // Phase-B-fix (2026-08-24): B5 — 写 ai_trace, provider/model/dim 显式记录
    // 特殊字段: provider (local/ollama/remote), model, dim — 通过 session_id 或
    //   error_message 字段塞 dim (避免改 schema). 严格说应加列, 但 Phase B 不破坏表.
    //   这里用 session_id 存 dim (后续 Phase C 可加专用列).
    recordAiTraceAsync({
      request_id,
      user_id,
      session_id: `dim=${embeddingLen || EMBEDDING_DIMS}`,
      task_type: 'embedding',
      provider: EMBEDDING_PROVIDER,
      model: EMBEDDING_MODEL,
      prompt_tokens: promptTokensEstimate,
      completion_tokens: 0, // embedding 无 completion
      latency_ms: Date.now() - tStart,
      // 不传 cost_cny → aiTrace.js 用 COST_TABLE[model] 估算 (text-embedding-v3=0.7/百万)
      success: !errorMsg,
      error_message: errorMsg,
    });
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