#!/usr/bin/env node
/**
 * scripts/reembed-question-vectors.mjs — 用 remote provider 全量/增量重嵌入向量
 *
 * 背景 (2026-09-23 事故):
 *   question_vectors.q_embedding (5834 行) 是 ollama/bge-m3 产物, metadata 记录
 *   model=bge-m3/provider=ollama。查询侧 env 被切到 remote/text-embedding-v3 后,
 *   跨模型 cosine 仅 ≈0.635, 而 services/embedding.js 的维度校验「只 warn 不拦」,
 *   于是页面静默返回一片 0.6 附近的垃圾相似度。
 *
 * 本脚本: 用 remote (DashScope text-embedding-v3, compatible-mode) 逐批重算,
 *   并把 metadata 溯源字段改写为真实值, 让溯源不再撒谎。
 *
 * 设计约束:
 *   - 幂等 / 可断点续跑: 只处理「metadata.model != text-embedding-v3」的行;
 *     已改写的行下次自动跳过 (--dry-run 可先看 pending 数)。
 *   - 批处理 + 限流 + 指数退避重试; 批失败自动降级为逐条补救, 单条失败不整批回滚,
 *     最终失败清单落盘 docs/audits/reembed-question-vectors-failures.json。
 *   - 文本来源以实际 schema 为准: question_vectors 用 q_text; rag_questions 用 content。
 *   - 不改动目标 model 之外的任何既有 metadata 键。
 *
 * 用法:
 *   node scripts/reembed-question-vectors.mjs --dry-run
 *   node scripts/reembed-question-vectors.mjs --limit 5
 *   node scripts/reembed-question-vectors.mjs
 *   node scripts/reembed-question-vectors.mjs --table question_vectors
 *
 * 参数: --dry-run / --limit N / --batch-size N / --table all|question_vectors|rag_questions
 *       / --min-interval-ms N
 */

// 先加载 .env (side-effect import 在其它 import 之前执行), 使 services/embedding.js
// 在被 import 时看到的是真实运行配置, 而不是默认值。
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import axios from 'axios';
import dotenv from 'dotenv';
import { PROVIDER_DEFAULTS } from '../services/embedding.js';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');

// ── 目标溯源三元组 (非机密) ────────────────────────────────────────────────
export const TARGET = {
  provider: 'remote',
  model: 'text-embedding-v3',
  dim: 1024,
  source: 'reembed-2026-09-23',
};

// 判定「还是旧产物/未处理」的谓词: metadata 里记录的 model 不等于目标 model。
// NULL metadata / 无 model 键 都算 pending (IS DISTINCT FROM 天然处理 NULL)。
export const PENDING_PREDICATE = "metadata->>'model' IS DISTINCT FROM $1";

const VECTOR_TABLES = {
  question_vectors: { textColumn: 'q_text', vectorColumn: 'q_embedding' },
  rag_questions: { textColumn: 'content', vectorColumn: 'embedding' },
};

// ── 纯函数 (可单测, 不触外部) ──────────────────────────────────────────────

/** 把数组切成 size 大小的块 */
export function chunk(arr, size) {
  if (!Number.isInteger(size) || size < 1) throw new Error('size 必须为正整数');
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** 幂等判定: metadata 记录的 model 是否已等于目标 model */
export function isUpToDate(metadata, targetModel = TARGET.model) {
  return !!metadata && typeof metadata === 'object' && !Array.isArray(metadata)
    && metadata.model === targetModel;
}

/** 合并溯源字段: 保留既有其它键, 覆盖 dim/model/provider/source */
export function mergeProvenanceMetadata(existing, prov = TARGET) {
  const base = existing && typeof existing === 'object' && !Array.isArray(existing) ? existing : {};
  return { ...base, dim: prov.dim, model: prov.model, provider: prov.provider, source: prov.source };
}

/** 维度校验: 不符即抛 (与 services/embedding.js「只 warn 不拦」形成对比, 这里必须拦) */
export function assertVectorDim(vec, expectedDim = TARGET.dim) {
  if (!Array.isArray(vec)) throw new Error(`embedding 非数组: ${typeof vec}`);
  if (vec.length !== expectedDim) {
    throw new Error(`embedding 维度不符: 期望 ${expectedDim}, 实际 ${vec.length}`);
  }
  return true;
}

/** 指数退避 (ms), 封顶 maxMs */
export function backoffMs(attempt, baseMs = 1000, maxMs = 30000) {
  const n = Math.max(1, attempt);
  return Math.min(maxMs, baseMs * 2 ** (n - 1));
}

/** 从 axios 错误里提取 status / code / 服务端 message (诊断用, 不含凭据) */
export function describeAxiosError(e) {
  const status = e?.response?.status;
  const body = e?.response?.data;
  return {
    status,
    code: body?.error?.code || body?.code || null,
    apiMsg: body?.error?.message || body?.message || e?.message || String(e),
  };
}

/** 把 axios 错误转成携带 status/code/服务端 message 的 Error (保留可读诊断) */
export function toRichError(e) {
  const { status, code, apiMsg } = describeAxiosError(e);
  const parts = [];
  if (status) parts.push(`HTTP ${status}`);
  if (code) parts.push(code);
  if (apiMsg) parts.push(apiMsg);
  const err = new Error(parts.join(' ') || String(e));
  err.status = status;
  err.code = code;
  return err;
}

/**
 * 账号级致命错误 (欠费/停用): 重试无意义, 应立即中止整轮, 否则会把剩余
 * 上千行全部打一遍注定失败的请求。识别 DashScope 的 Arrearage / overdue-payment。
 */
export function isFatalAccountError(e) {
  return /Arrearage|overdue-payment|Access denied/i.test(String(e?.message || e));
}

/** 构造 pending 查询 (question_vectors 用 q_text, rag_questions 用 content) */
export function buildPendingQuery(table, { model = TARGET.model, limit = null } = {}) {
  const meta = VECTOR_TABLES[table];
  if (!meta) throw new Error(`未知表: ${table}`);
  const limitClause = limit ? ' LIMIT $2' : '';
  return {
    sql: `SELECT id, ${meta.textColumn} AS text, metadata
            FROM public.${table}
           WHERE ${meta.textColumn} IS NOT NULL AND btrim(${meta.textColumn}) <> ''
             AND ${PENDING_PREDICATE}
           ORDER BY id${limitClause}`,
    params: limit ? [model, limit] : [model],
  };
}

/** 构造单行 UPDATE (写向量 + 合并溯源 metadata) */
export function buildUpdateSql(table) {
  const meta = VECTOR_TABLES[table];
  if (!meta) throw new Error(`未知表: ${table}`);
  return `UPDATE public.${table}
             SET ${meta.vectorColumn} = $2::vector,
                 metadata = COALESCE(metadata, '{}'::jsonb) || $3::jsonb,
                 updated_at = now()
           WHERE id = $1`;
}

/** CLI 参数解析 (--key value / --flag) */
export function parseArgs(argv = []) {
  const opts = { dryRun: false, limit: null, batchSize: 20, table: 'all', minIntervalMs: 0 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--limit') opts.limit = parseInt(argv[++i], 10);
    else if (a === '--batch-size') opts.batchSize = parseInt(argv[++i], 10);
    else if (a === '--table') opts.table = argv[++i];
    else if (a === '--min-interval-ms') opts.minIntervalMs = parseInt(argv[++i], 10);
    else if (a === '--help' || a === '-h') opts.help = true;
    else throw new Error(`未知参数: ${a}`);
  }
  if (opts.limit !== null && (!Number.isInteger(opts.limit) || opts.limit < 1)) {
    throw new Error('--limit 必须为正整数');
  }
  if (!Number.isInteger(opts.batchSize) || opts.batchSize < 1 || opts.batchSize > 25) {
    throw new Error('--batch-size 必须为 1..25 (DashScope 单请求上限 25)');
  }
  if (!['all', ...Object.keys(VECTOR_TABLES)].includes(opts.table)) {
    throw new Error(`--table 必须为 all|${Object.keys(VECTOR_TABLES).join('|')}`);
  }
  return opts;
}

/** 从 OpenAI 兼容响应里取第 i 个 embedding (按 index 排序) */
export function pickEmbedding(data, i = 0) {
  const arr = [...(data?.data || [])].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  const item = arr[i];
  return item?.embedding;
}

/** 取 token 用量: 优先响应 usage.total_tokens, 否则按字符数/2 估算 */
export function extractTokens(data, texts) {
  const t = data?.usage?.total_tokens;
  if (typeof t === 'number' && t > 0) return t;
  return (texts || []).reduce((s, x) => s + Math.ceil((x?.length || 0) / 2), 0);
}

/**
 * 逐条重试调用 post(texts) (单请求, 带退避重试)。成功返回 data, 失败抛最后一错。
 * post: (texts) => Promise<data>; retryOn(status) 决定哪些 HTTP 码可重试。
 */
export async function callWithRetry(texts, ctx) {
  const {
    post, maxAttempts = 5, baseBackoffMs = 1000, maxBackoffMs = 30000,
    sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
    retryOn = (status) => status === 429 || (status >= 500 && status < 600),
  } = ctx;
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await post(texts);
    } catch (e) {
      lastErr = e;
      const status = e?.response?.status;
      const rich = toRichError(e);
      // 账号级欠费/停用: 立即抛, 不浪费退避重试
      if (isFatalAccountError(rich)) throw rich;
      const retryable = status === undefined ? true : retryOn(status);
      if (attempt >= maxAttempts || !retryable) throw rich;
      await sleep(backoffMs(attempt, baseBackoffMs, maxBackoffMs));
    }
  }
  throw lastErr;
}

/**
 * 批量嵌入 [{id, text}] → { vectors: Map<id, number[]>, failed: [{id, error}], tokens, requests }
 * 批失败自动降级逐条补救; 单条失败只记录, 不整批回滚。
 *
 * onBatch: 每批成功入库前的回调 async (successes:[{id, vector, text}]) => void,
 *   供 main 立即落库 (断点续跑: 崩了也不丢已完成批次)。
 * 账号级致命错误 (欠费/停用) 直接抛出, 不再逐条补救 —— 中止整轮。
 */
export async function embedItems(items, ctx) {
  const { dim = TARGET.dim, batchSize = 20, onBatch } = ctx;
  const vectors = new Map();
  const failed = [];
  let tokens = 0;
  let requests = 0;

  const take = async (data, batch) => {
    tokens += extractTokens(data, batch.map((b) => b.text));
    requests += 1;
    const successes = [];
    batch.forEach((it, i) => {
      const vec = pickEmbedding(data, i);
      try {
        assertVectorDim(vec, dim);
        vectors.set(it.id, vec);
        successes.push({ id: it.id, vector: vec, text: it.text });
      } catch (e) {
        failed.push({ id: it.id, error: e.message });
      }
    });
    if (onBatch && successes.length) await onBatch(successes);
  };

  for (const batch of chunk(items, batchSize)) {
    try {
      const data = await callWithRetry(batch.map((b) => b.text), ctx);
      await take(data, batch);
    } catch (batchErr) {
      if (isFatalAccountError(batchErr)) throw batchErr; // 欠费/停用 → 中止整轮
      // 整批失败 → 逐条补救
      for (const it of batch) {
        try {
          const data = await callWithRetry([it.text], ctx);
          await take(data, [it]);
        } catch (e) {
          if (isFatalAccountError(e)) throw e;
          requests += 1;
          failed.push({ id: it.id, error: `批失败后逐条仍失败: ${e.message}` });
        }
      }
    }
  }
  return { vectors, failed, tokens, requests };
}

// ── main (仅直接执行时跑, 便于被测试 import 纯函数) ────────────────────────

function loadDatabaseUrl() {
  dotenv.config({ path: path.join(ROOT, '.env'), quiet: true });
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL 缺失 (.env)');
  return url;
}

function makeDashscopePost() {
  const apiKey = process.env.EMBEDDING_API_KEY || process.env.DASHSCOPE_API_KEY || '';
  if (!apiKey) throw new Error('EMBEDDING_API_KEY / DASHSCOPE_API_KEY 未配置');
  const baseUrl = PROVIDER_DEFAULTS.remote.base_url;
  return async (texts) => {
    const resp = await axios.post(
      `${baseUrl}/embeddings`,
      { model: TARGET.model, input: texts, dimensions: TARGET.dim },
      {
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        timeout: 30000,
      }
    );
    return resp.data;
  };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log('用法: node scripts/reembed-question-vectors.mjs [--dry-run] [--limit N] [--batch-size N] [--table all|question_vectors|rag_questions] [--min-interval-ms N]');
    return;
  }

  const { Pool } = await import('pg');
  const pool = new Pool({ connectionString: loadDatabaseUrl() });
  const tables = opts.table === 'all' ? Object.keys(VECTOR_TABLES) : [opts.table];

  const report = {
    run_at: new Date().toISOString(),
    target: TARGET,
    dry_run: opts.dryRun,
    tables: {},
  };

  try {
    for (const table of tables) {
      const { sql, params } = buildPendingQuery(table, { limit: opts.limit });
      const { rows } = await pool.query(sql, params);
      console.log(`\n[${table}] pending (metadata.model != ${TARGET.model}): ${rows.length}${opts.limit ? ` (limit ${opts.limit})` : ''}`);
      report.tables[table] = { pending: rows.length, updated: 0, failed: 0, tokens: 0, requests: 0 };
      if (opts.dryRun || rows.length === 0) continue;

      const post = makeDashscopePost();
      const items = rows.map((r) => ({ id: r.id, text: String(r.text) }));
      const metaById = new Map(rows.map((r) => [r.id, r.metadata]));
      const updateSql = buildUpdateSql(table);
      const t0 = Date.now();
      let updated = 0;
      const dbFailures = [];

      // 断点续跑: 每批算完立即落库, 中断也不丢已完成批次。
      const onBatch = async (successes) => {
        for (const { id, vector } of successes) {
          const provenance = mergeProvenanceMetadata(metaById.get(id), TARGET);
          try {
            await pool.query(updateSql, [id, `[${vector.join(',')}]`, JSON.stringify(provenance)]);
            updated += 1;
          } catch (e) {
            dbFailures.push({ id, error: `DB 更新失败: ${e.message}` });
          }
        }
      };

      let failed = [];
      let tokens = 0;
      let requests = 0;
      let aborted = null;
      try {
        const r = await embedItems(items, {
          post,
          dim: TARGET.dim,
          batchSize: opts.batchSize,
          minIntervalMs: opts.minIntervalMs,
          sleep: (ms) => new Promise((res) => setTimeout(res, ms)),
          onBatch,
        });
        failed = r.failed;
        tokens = r.tokens;
        requests = r.requests;
      } catch (e) {
        // 账号级致命错误 (欠费/停用): 中止本轮, 已落库批次保留, 修好后重跑即续。
        aborted = e.message;
        console.error(`[${table}] 已中止: ${e.message}`);
      }

      const allFailed = [...failed, ...dbFailures];
      report.tables[table] = {
        pending: rows.length,
        updated,
        failed: allFailed.length,
        tokens,
        requests,
        elapsed_s: Number(((Date.now() - t0) / 1000).toFixed(1)),
        aborted,
        failures: allFailed,
      };
      console.log(`[${table}] updated=${updated} failed=${allFailed.length} tokens=${tokens} requests=${requests} elapsed=${report.tables[table].elapsed_s}s${aborted ? ` [aborted: ${aborted}]` : ''}`);
      if (allFailed.length) {
        const failPath = path.join(ROOT, 'docs', 'audits', `reembed-question-vectors-failures-${table}.json`);
        fs.mkdirSync(path.dirname(failPath), { recursive: true });
        fs.writeFileSync(failPath, JSON.stringify(allFailed, null, 2));
        console.log(`  失败清单 → ${path.relative(ROOT, failPath)}`);
      }
    }
  } finally {
    await pool.end();
  }

  const reportPath = path.join(ROOT, 'docs', 'audits', 'reembed-question-vectors-report.json');
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n报告 → ${path.relative(ROOT, reportPath)}`);
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  main().catch((e) => {
    console.error('[reembed] FATAL', e.message);
    process.exit(2);
  });
}
