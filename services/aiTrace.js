/**
 * services/aiTrace.js — ai_trace 统一埋点工具 (Phase B, 2026-08-24)
 *
 * 设计要点:
 *   1. 与 services/llm.js 同层, 供 services/* + api/* 调用, 不破坏分层.
 *   2. 异步 fire-and-forget: 调用方不等待 DB 写入, 失败静默.
 *   3. lazy import api/core/db.js: 仅在第一次写入时 require, 避免循环依赖.
 *   4. 统一 schema:
 *      - request_id       VARCHAR(64)  UUID v4 (前端 X-Trace-Id 或后端生成)
 *      - user_email       VARCHAR(255) caller context (req.user.email / 'system')
 *      - task_type        VARCHAR(50)  'chat' | 'embedding' | 'vision_parse' | ...
 *      - provider         VARCHAR(50)  'dashscope' | 'deepseek' | 'local' | 'ollama' | 'remote'
 *      - model            VARCHAR(100) 'qwen-plus' | 'bge-m3' | ...
 *      - prompt_tokens    INTEGER
 *      - completion_tokens INTEGER
 *      - latency_ms       INTEGER
 *      - cost_cny         NUMERIC(10,6)
 *      - success          BOOLEAN
 *      - error_message    TEXT
 *
 * 兼容 D069 (2026-08-17) 已有的 3 处埋点 (proxy.js / explain-question.js / taskWorker.js)
 * - 列名保持 user_email / provider / model / task_type / prompt_tokens /
 *   completion_tokens / latency_ms / success 不变, 新增 request_id / error_message /
 *   cost_cny / session_id. 现有 3 处埋点的 SQL 仍 work.
 *
 * 用法:
 *   import { recordAiTrace } from './aiTrace.js';
 *   const tStart = Date.now();
 *   try {
 *     const result = await call(...);
 *     recordAiTrace({ request_id, user_id, task_type: 'chat', provider, model,
 *                     latency_ms: Date.now()-tStart, success: true,
 *                     prompt_tokens: result.usage?.prompt_tokens||0,
 *                     completion_tokens: result.usage?.completion_tokens||0 });
 *   } catch (err) {
 *     recordAiTrace({ ..., success: false, error_message: err.message });
 *     throw err;
 *   }
 */

// ────────────────────────────────────────────────────────────────────────
// UUID v4 (无外部依赖, 浏览器+Node 双端可用; crypto.randomUUID 兜底)
// ────────────────────────────────────────────────────────────────────────

function uuidv4() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try { return crypto.randomUUID(); } catch (_) { /* fall through */ }
  }
  // RFC 4122 v4 fallback
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0'));
  return `${hex.slice(0,4).join('')}-${hex.slice(4,6).join('')}-${hex.slice(6,8).join('')}-${hex.slice(8,10).join('')}-${hex.slice(10,16).join('')}`;
}

// ────────────────────────────────────────────────────────────────────────
// Lazy DB loader (避免循环依赖: services/* → api/core/db.js)
// api/core/db.js 不会 import services/*, 所以单向安全.
// ────────────────────────────────────────────────────────────────────────

let _dbPromise = null;
async function getPool() {
  if (_dbPromise) return _dbPromise;
  // Phase B (2026-08-24): 动态 import — 仅在第一次写入时才解析依赖图,
  // 防止 services/llm.js / services/embedding.js 启动时强行加载 api/core/db.js
  // (那些模块本身是方案 B/C 的纯计算, 不应依赖 api/* 运行时).
  _dbPromise = import('../api/core/db.js').then((m) => m.getDb());
  return _dbPromise;
}

// ────────────────────────────────────────────────────────────────────────
// 成本估算 (与 services/llm.js MODEL_CONFIGS 对齐, 单价 元/百万 tokens)
// ────────────────────────────────────────────────────────────────────────

const COST_TABLE = {
  // DashScope (元/百万 tokens)
  'qwen-plus': 0.8,
  'qwen-max': 2.4,
  'qwen-turbo': 0.4,
  'qwen-vl-max': 12,
  'qwen-vl-plus': 6,
  // DeepSeek
  'deepseek-chat': 0.14,
  'deepseek-reasoner': 2.0,
  // Embedding (remote DashScope text-embedding-v3)
  'text-embedding-v3': 0.7,
  // Embedding local/ollama (本地免费, 标记 0)
  'bge-m3': 0,
  'BAAI/bge-base-en-v1.5': 0,
};

function estimateCostCny(model, promptTokens, completionTokens) {
  const perMillion = COST_TABLE[model];
  if (perMillion === undefined) return 0;
  const total = (promptTokens || 0) + (completionTokens || 0);
  return (total / 1_000_000) * perMillion;
}

// ────────────────────────────────────────────────────────────────────────
// Provider 推断 (model name → 'dashscope' / 'deepseek' / 'local' / 'ollama' / 'remote')
// ────────────────────────────────────────────────────────────────────────

function inferProvider(model, explicitProvider) {
  if (explicitProvider) return explicitProvider;
  if (!model) return 'unknown';
  if (model.startsWith('qwen-')) return 'dashscope';
  if (model.startsWith('deepseek-')) return 'deepseek';
  if (model.includes('bge') || model.includes('embedding')) return 'remote'; // 远程 DashScope
  return 'unknown';
}

// ────────────────────────────────────────────────────────────────────────
// recordAiTrace — 异步 fire-and-forget 写入 ai_trace
// 返回: Promise<void> (调用方应 .catch 或 await 都可, 失败永远不抛)
// ────────────────────────────────────────────────────────────────────────

/**
 * 异步写入 ai_trace 表. fire-and-forget, 不阻塞主流程.
 *
 * @param {object} record
 * @param {string} [record.request_id]   - UUID v4; 不传则自动生成
 * @param {string} [record.user_id]      - 用户邮箱 / 'system'
 * @param {string} [record.session_id]   - 会话 ID (可选)
 * @param {string} record.task_type      - 必填: 'chat' | 'embedding' | 'vision_parse' | ...
 * @param {string} [record.provider]     - 'dashscope' | 'deepseek' | 'local' | 'ollama' | 'remote'
 * @param {string} [record.model]
 * @param {number} [record.prompt_tokens]
 * @param {number} [record.completion_tokens]
 * @param {number} [record.latency_ms]
 * @param {number} [record.cost_cny]     - 不传则按 COST_TABLE 估算
 * @param {boolean} [record.success=true]
 * @param {string} [record.error_message]
 */
export async function recordAiTrace(record) {
  if (!record || typeof record !== 'object') return;

  const request_id = record.request_id || uuidv4();
  const user_email = record.user_id || record.user_email || 'system';
  const task_type = record.task_type || 'unknown';
  const provider = inferProvider(record.model, record.provider);
  const model = record.model || 'unknown';
  const prompt_tokens = record.prompt_tokens || 0;
  const completion_tokens = record.completion_tokens || 0;
  const latency_ms = record.latency_ms || 0;
  const success = record.success !== false;
  const error_message = success ? null : (record.error_message || 'unknown error');
  const session_id = record.session_id || null;
  const cost_cny = (typeof record.cost_cny === 'number')
    ? record.cost_cny
    : estimateCostCny(model, prompt_tokens, completion_tokens);

  try {
    const pool = await getPool();
    // Phase B (2026-08-24): request_id 列在迁移 010 中新增, 已存在 ai_trace 表需先 ALTER.
    // 用 INSERT ... ON CONFLICT 不行 (无 unique 约束), 直接写; 列缺失会被 PG 报错,
    // 我们 catch 静默 (与 D069 风格一致: ai_trace 写入失败不抛).
    // Phase B (2026-08-24): 普通 INSERT (request_id 无 UNIQUE 约束, 不需要 ON CONFLICT).
    // 若迁移 010 已 ALTER 加列, 此 SQL 一次成功; 否则列缺失会抛错被 catch 静默.
    await pool.query(
      `INSERT INTO ai_trace
         (request_id, user_email, session_id, provider, model, task_type,
          prompt_tokens, completion_tokens, latency_ms, cost_cny, success, error_message)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        String(request_id).slice(0, 64),
        user_email,
        session_id,
        provider,
        model,
        task_type,
        prompt_tokens,
        completion_tokens,
        latency_ms,
        cost_cny,
        success,
        error_message,
      ]
    );
  } catch (err) {
    // ai_trace 写入失败静默 — 业务优先, 不阻塞
    if (process.env.AI_TRACE_DEBUG === '1') {
      console.warn(`[aiTrace] 写入失败: ${err.message}`);
    }
  }
}

/**
 * 同步 fire-and-forget 包装 (无 await, 不返回 Promise; 适合 try-finally 中调用).
 * Phase B (2026-08-24): 推荐用法 — 主流程不 await, 但保证事件循环触发写入.
 */
export function recordAiTraceAsync(record) {
  // 不 await, 不 .catch — 让 Node 进程自行处理 unhandled rejection
  // (我们已在内部 catch, 此处不会 throw)
  recordAiTrace(record).catch(() => {});
}

/**
 * 工具: 生成 UUID v4 (供 middleware / 调用方复用).
 */
export function generateTraceId() {
  return uuidv4();
}

export default {
  recordAiTrace,
  recordAiTraceAsync,
  generateTraceId,
};
