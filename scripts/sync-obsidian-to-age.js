#!/usr/bin/env node
/**
 * sync-obsidian-to-age.js — 方案A：宏观知识图谱同步脚本
 *
 * 将 Obsidian Markdown 知识点文件同步到 PostgreSQL Apache AGE 图数据库。
 * 解析 YAML Frontmatter 元数据 + [[ ]] 双向链接，幂等创建 KnowledgePoint 节点和 DEPENDS_ON 关系。
 *
 * 架构边界：仅属于方案 A（Macro Graph），不涉及向量检索（方案B）或 GraphRAG 推理（方案C）。
 *
 * 用法:
 *   node scripts/sync-obsidian-to-age.js [知识点目录路径]
 *   node scripts/sync-obsidian-to-age.js ./knowledge-points
 *
 * 前置条件:
 *   1. PostgreSQL 已安装并启用 Apache AGE 扩展
 *   2. DATABASE_URL 已在 .env 中配置
 *   3. 知识点 Markdown 文件包含 YAML Frontmatter (id, name, subject, module, difficulty)
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, extname, basename } from 'node:path';
import { parse as parseYAML } from 'yaml';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// ─────────────────────────────────────────────────────────────────────────────
// 常量配置
// ─────────────────────────────────────────────────────────────────────────────

const GRAPH_NAME = 'knowledge_graph';
const BATCH_SIZE = 100;

/** Apache AGE 初始化 SQL（每次连接必须执行） */
const AGE_INIT_SQL = `
  CREATE EXTENSION IF NOT EXISTS age;
  LOAD 'age';
  SET search_path = ag_catalog, "$user", public;
`;

/** 创建图的 Cypher（仅首次执行） */
const CREATE_GRAPH_SQL = `SELECT create_graph('${GRAPH_NAME}')`;

// ─────────────────────────────────────────────────────────────────────────────
// 数据库连接
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 创建已初始化 Apache AGE 的数据库客户端。
 * 每次调用返回独立客户端，调用方负责释放。
 */
async function createAgeClient() {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  await client.query(AGE_INIT_SQL);
  return client;
}

/**
 * 确保 Apache AGE 图已创建（幂等操作）
 */
async function ensureGraphExists(client) {
  try {
    await client.query(CREATE_GRAPH_SQL);
    console.log(`  ✅ 图 "${GRAPH_NAME}" 创建成功`);
  } catch (err) {
    // graph "xxx" already exists → 正常，忽略
    if (err.message.includes('already exists')) {
      console.log(`  ℹ️  图 "${GRAPH_NAME}" 已存在，跳过创建`);
    } else {
      throw err;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Markdown 解析工具
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 从 Markdown 文本中提取 YAML Frontmatter 对象
 * @param {string} content - 文件完整内容
 * @returns {object|null} 解析后的元数据对象，无 Frontmatter 时返回 null
 */
function extractFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;
  try {
    return parseYAML(match[1]);
  } catch (err) {
    throw new Error(`YAML 解析失败: ${err.message}`);
  }
}

/**
 * 解析单个 Markdown 文件，返回知识点元数据和原始链接
 * @param {string} filepath - 文件绝对路径
 * @returns {{ meta: object, rawLinks: string[] } | null}
 */
function parseKnowledgeFile(filepath) {
  const content = readFileSync(filepath, 'utf-8');
  const frontmatter = extractFrontmatter(content);

  if (!frontmatter || !frontmatter.id || !frontmatter.name) {
    console.warn(`  ⚠️  跳过 (缺少 id 或 name): ${basename(filepath)}`);
    return null;
  }

  const meta = {
    id: String(frontmatter.id),
    name: String(frontmatter.name),
    subject: String(frontmatter.subject || '未知'),
    module: String(frontmatter.module || '未知'),
    difficulty: Number(frontmatter.difficulty) || 3,
  };

  // 提取 [[ ]] 双向链接（去除重复目标）
  const linkRegex = /\[\[([^\]|]+?)(?:\|[^\]]+?)?\]\]/g;
  const rawLinks = [...content.matchAll(linkRegex)]
    .map((m) => m[1].trim())
    .filter((link, idx, arr) => arr.indexOf(link) === idx);

  return { meta, rawLinks };
}

/**
 * 递归扫描目录下所有 .md 文件
 * @param {string} dir - 目录路径
 * @returns {string[]} 文件绝对路径数组
 */
function scanMarkdownFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      files.push(...scanMarkdownFiles(fullPath));
    } else if (extname(entry).toLowerCase() === '.md') {
      files.push(fullPath);
    }
  }
  return files;
}

// ─────────────────────────────────────────────────────────────────────────────
// Apache AGE 操作（参数化查询）
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 执行 Cypher 查询（参数化），返回结果行
 * Apache AGE 的 cypher() 函数不支持命名参数，须使用 $1/$2 等占位符
 * @param {pg.Client} client
 * @param {string} cypherQuery - Cypher 语句
 * @param {any[]} params - 参数数组
 * @param {string} resultDef - AS 子句中的列定义，如 "result agtype"
 */
async function execCypher(client, cypherQuery, params = [], resultDef = 'result agtype') {
  const sql = `SELECT * FROM cypher('${GRAPH_NAME}', $$ ${cypherQuery} $$) AS (${resultDef})`;
  return client.query(sql, params);
}

/**
 * 幂等创建/更新 KnowledgePoint 节点（MERGE by id，SET 所有属性）
 */
async function upsertNode(client, { id, name, subject, module, difficulty }) {
  await execCypher(
    client,
    `MERGE (kp:KnowledgePoint {id: $1})
     SET kp.name = $2, kp.subject = $3, kp.module = $4, kp.difficulty = $5
     RETURN kp`,
    [id, name, subject, module, difficulty],
    'kp agtype'
  );
}

/**
 * 批量创建 DEPENDS_ON 关系（MERGE 防重复边）
 * @param {pg.Client} client
 * @param {Array<{fromId: string, toId: string}>} edges
 */
async function createEdges(client, edges) {
  for (const { fromId, toId } of edges) {
    try {
      await execCypher(
        client,
        `MATCH (a:KnowledgePoint {id: $1}), (b:KnowledgePoint {id: $2})
         MERGE (a)-[:DEPENDS_ON]->(b)`,
        [fromId, toId],
        'result agtype'
      );
    } catch (err) {
      console.warn(`  ⚠️  边创建失败 (${fromId} → ${toId}): ${err.message}`);
    }
  }
}

/**
 * 查询图中所有 KnowledgePoint 的 id 和 name，用于链接解析
 * @param {pg.Client} client
 * @returns {Map<string, string>} name → id 映射
 */
async function getNodeNameMap(client) {
  const result = await execCypher(
    client,
    `MATCH (kp:KnowledgePoint) RETURN kp.name AS name, kp.id AS id`,
    [],
    'name agtype, id agtype'
  );

  const map = new Map();
  for (const row of result.rows) {
    try {
      const name = JSON.parse(row.name);
      const id = JSON.parse(row.id);
      map.set(name, id);
    } catch {
      // 跳过无法解析的行
    }
  }
  return map;
}

// ─────────────────────────────────────────────────────────────────────────────
// 主同步流程（三阶段）
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const targetDir = args[0] || join(process.cwd(), 'database', 'knowledge-points');

  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║   方案A · 宏观知识图谱 · Obsidian → AGE 同步工具    ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  // ── 前置校验 ──────────────────────────────────────────────
  if (!process.env.DATABASE_URL) {
    console.error('❌ 错误: 环境变量 DATABASE_URL 未配置，请检查 .env 文件');
    process.exit(1);
  }

  if (!existsSync(targetDir)) {
    console.error(`❌ 错误: 目标目录不存在 → ${targetDir}`);
    console.error('   用法: node scripts/sync-obsidian-to-age.js <知识点目录路径>');
    process.exit(1);
  }

  const stats = {
    scanned: 0,
    parsed: 0,
    nodesCreated: 0,
    edgesCreated: 0,
    unresolved: [],
    errors: [],
  };

  const client = await createAgeClient();

  try {
    await ensureGraphExists(client);

    // ── Phase 1: 扫描 & 解析 ──────────────────────────────
    console.log(`\n📂 Phase 1: 扫描目录 → ${targetDir}`);
    const mdFiles = scanMarkdownFiles(targetDir);
    stats.scanned = mdFiles.length;
    console.log(`   发现 ${mdFiles.length} 个 .md 文件`);

    if (mdFiles.length === 0) {
      console.log('\n⚠️  未找到任何 Markdown 文件，同步终止。');
      return;
    }

    /** @type {Array<{ filepath: string, meta: object, rawLinks: string[] }>} */
    const parsedFiles = [];

    for (const filepath of mdFiles) {
      try {
        const result = parseKnowledgeFile(filepath);
        if (result) {
          parsedFiles.push({ filepath, ...result });
          stats.parsed++;
        }
      } catch (err) {
        const msg = `解析失败 ${basename(filepath)}: ${err.message}`;
        console.error(`  ❌ ${msg}`);
        stats.errors.push(msg);
      }
    }

    console.log(`   ✅ 成功解析 ${stats.parsed} / ${stats.scanned} 个文件`);

    // 预构建 name → id 映射（内存中，用于 Phase 3 的链接解析）
    const nameToId = new Map();
    for (const { meta } of parsedFiles) {
      nameToId.set(meta.name, meta.id);
    }

    // ── Phase 2: 幂等创建节点 ─────────────────────────────
    console.log(`\n🔷 Phase 2: 创建 KnowledgePoint 节点 (${parsedFiles.length} 个)`);
    await client.query('BEGIN');

    try {
      for (let i = 0; i < parsedFiles.length; i += BATCH_SIZE) {
        const batch = parsedFiles.slice(i, i + BATCH_SIZE);
        for (const { meta } of batch) {
          await upsertNode(client, meta);
          stats.nodesCreated++;
        }
        console.log(`   进度 ${Math.min(i + BATCH_SIZE, parsedFiles.length)} / ${parsedFiles.length}`);
      }
      await client.query('COMMIT');
      console.log(`   ✅ 节点同步完成: ${stats.nodesCreated} 个`);
    } catch (err) {
      await client.query('ROLLBACK');
      throw new Error(`节点批量创建失败，已回滚: ${err.message}`);
    }

    // ── Phase 3: 解析链接 & 创建 DEPENDS_ON 关系 ──────────
    console.log(`\n🔗 Phase 3: 解析前置依赖，创建 DEPENDS_ON 关系`);

    // 从数据库查询当前所有节点的 name → id（含历史数据）
    const dbNameMap = await getNodeNameMap(client);
    // 合并本次解析的映射（优先数据库已有值）
    for (const [name, id] of nameToId) {
      if (!dbNameMap.has(name)) {
        dbNameMap.set(name, id);
      }
    }

    /** @type {Array<{fromId: string, toId: string}>} */
    const edges = [];

    for (const { meta, rawLinks } of parsedFiles) {
      for (const linkName of rawLinks) {
        const targetId = dbNameMap.get(linkName);
        if (targetId) {
          edges.push({ fromId: meta.id, toId: targetId });
        } else {
          stats.unresolved.push(`${meta.id} → [[${linkName}]]`);
        }
      }
    }

    console.log(`   找到 ${edges.length} 条可解析的依赖关系`);
    if (stats.unresolved.length > 0) {
      console.log(`   ⚠️  ${stats.unresolved.length} 条链接目标未找到对应知识点`);
    }

    if (edges.length > 0) {
      await client.query('BEGIN');
      try {
        for (let i = 0; i < edges.length; i += BATCH_SIZE) {
          const batch = edges.slice(i, i + BATCH_SIZE);
          await createEdges(client, batch);
          stats.edgesCreated += batch.length;
          console.log(`   进度 ${Math.min(i + BATCH_SIZE, edges.length)} / ${edges.length}`);
        }
        await client.query('COMMIT');
        console.log(`   ✅ 依赖关系创建完成: ${stats.edgesCreated} 条`);
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`关系批量创建失败，已回滚: ${err.message}`);
      }
    }

    // ── 完成 ─────────────────────────────────────────────
    console.log('\n╔══════════════════════════════════════╗');
    console.log('║          同步统计报告                ║');
    console.log('╠══════════════════════════════════════╣');
    console.log(`║  扫描文件:   ${String(stats.scanned).padStart(6)} 个              ║`);
    console.log(`║  解析成功:   ${String(stats.parsed).padStart(6)} 个              ║`);
    console.log(`║  节点同步:   ${String(stats.nodesCreated).padStart(6)} 个              ║`);
    console.log(`║  依赖边:     ${String(stats.edgesCreated).padStart(6)} 条              ║`);
    console.log(`║  未解析链接: ${String(stats.unresolved.length).padStart(6)} 条              ║`);
    console.log(`║  解析错误:   ${String(stats.errors.length).padStart(6)} 个              ║`);
    console.log('╚══════════════════════════════════════╝');

    if (stats.unresolved.length > 0 && stats.unresolved.length <= 20) {
      console.log('\n📋 未解析链接示例（前20条）:');
      for (const link of stats.unresolved.slice(0, 20)) {
        console.log(`   • ${link}`);
      }
    }

    if (stats.errors.length > 0) {
      console.log('\n❌ 解析错误:');
      for (const err of stats.errors.slice(0, 10)) {
        console.log(`   • ${err}`);
      }
    }
  } catch (err) {
    console.error(`\n❌ 同步失败: ${err.message}`);
    if (process.env.DEBUG) console.error(err.stack);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n🔌 数据库连接已关闭');
  }
}

main();
