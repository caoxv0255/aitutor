/**
 * scripts/benchmark-db.js — 数据库性能基准测试
 *
 * 测试场景：
 *   1. 方案 B: pgvector 向量检索 (1000 次)
 *   2. 方案 C: Apache AGE 2 跳图谱查询 (100 次)
 *   3. EXPLAIN ANALYZE 慢查询分析
 *
 * 用法: node scripts/benchmark-db.js
 *
 * 环境变量: DATABASE_URL (必须)
 */

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// ─────────────────────────────────────────────────────────────────────────────
// 配置
// ─────────────────────────────────────────────────────────────────────────────

const VECTOR_ITERATIONS = 1000;
const GRAPH_ITERATIONS = 100;
const WARMUP_ROUNDS = 5;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 10000,
  statement_timeout: 60000,
  application_name: 'aitutor-benchmark',
});

// ─────────────────────────────────────────────────────────────────────────────
// 工具函数
// ─────────────────────────────────────────────────────────────────────────────

function generateFakeEmbedding(dim = 1536) {
  const parts = [];
  for (let i = 0; i < dim; i++) {
    parts.push((Math.random() * 2 - 1).toFixed(6));
  }
  return `[${parts.join(',')}]`;
}

function percentile(arr, p) {
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function stats(times) {
  const sum = times.reduce((a, b) => a + b, 0);
  return {
    count: times.length,
    avg: (sum / times.length).toFixed(2),
    min: Math.min(...times).toFixed(2),
    max: Math.max(...times).toFixed(2),
    p50: percentile(times, 50).toFixed(2),
    p95: percentile(times, 95).toFixed(2),
    p99: percentile(times, 99).toFixed(2),
  };
}

function printResult(name, s) {
  console.log(`\n  ${name}:`);
  console.log(`    次数=${s.count}  平均=${s.avg}ms  最小=${s.min}ms  最大=${s.max}ms`);
  console.log(`    P50=${s.p50}ms  P95=${s.p95}ms  P99=${s.p99}ms`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 基准 1: 方案 B — pgvector 向量检索
// ─────────────────────────────────────────────────────────────────────────────

async function benchmarkVectorSearch() {
  console.log('\n' + '═'.repeat(60));
  console.log('  方案 B: pgvector 向量检索基准测试');
  console.log('═'.repeat(60));

  // 先检查表是否有数据
  const countResult = await pool.query('SELECT COUNT(*) FROM rag_questions');
  const rowCount = parseInt(countResult.rows[0].count);
  console.log(`  rag_questions 表行数: ${rowCount}`);

  if (rowCount === 0) {
    console.log('  ⚠️  表为空，将使用随机向量进行基准测试（不含实际检索结果）');
  }

  // EXPLAIN ANALYZE（单次）
  console.log('\n  ── EXPLAIN ANALYZE ──');
  const testEmbedding = generateFakeEmbedding();
  const explainResult = await pool.query(
    `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
     SELECT id, content, knowledge_point_id,
            1 - (embedding <=> $1::vector) AS similarity
     FROM rag_questions
     WHERE embedding IS NOT NULL
     ORDER BY embedding <=> $1::vector
     LIMIT 5`,
    [testEmbedding]
  );

  const plan = explainResult.rows[0]['QUERY PLAN']?.[0];
  if (plan) {
    const node = plan.Plan;
    console.log(`    节点类型: ${node['Node Type']}`);
    console.log(`    执行时间: ${plan['Execution Time']?.toFixed(2)}ms`);
    console.log(`    规划时间: ${plan['Planning Time']?.toFixed(2)}ms`);

    // 检查是否使用了索引
    const planText = JSON.stringify(plan);
    if (planText.includes('Index') || planText.includes('Custom Scan')) {
      console.log('    ✅ 使用了索引扫描');
    } else if (planText.includes('Seq Scan')) {
      console.log('    ⚠️  全表扫描！建议检查 HNSW 索引是否已创建。');
      console.log('    修复: CREATE INDEX ON rag_questions USING hnsw (embedding vector_cosine_ops)');
    }
  }

  // 批量性能测试
  console.log(`\n  ── 批量性能测试 (${VECTOR_ITERATIONS} 次) ──`);

  // 预热
  console.log(`    预热 ${WARMUP_ROUNDS} 轮...`);
  for (let i = 0; i < WARMUP_ROUNDS; i++) {
    await pool.query(`SELECT id FROM rag_questions ORDER BY embedding <=> $1::vector LIMIT 5`, [
      generateFakeEmbedding(),
    ]);
  }

  const times = [];
  const batchSize = 100;
  for (let batch = 0; batch < VECTOR_ITERATIONS; batch += batchSize) {
    const end = Math.min(batch + batchSize, VECTOR_ITERATIONS);
    for (let i = batch; i < end; i++) {
      const start = performance.now();
      await pool.query(
        `SELECT id, 1 - (embedding <=> $1::vector) AS similarity
         FROM rag_questions
         WHERE embedding IS NOT NULL
         ORDER BY embedding <=> $1::vector
         LIMIT 5`,
        [generateFakeEmbedding()]
      );
      times.push(performance.now() - start);
    }
    process.stdout.write(`    进度: ${end}/${VECTOR_ITERATIONS}\r`);
  }

  printResult('向量检索 (Top-5)', stats(times));

  // 带 knowledge_point_id 过滤的检索
  const filterTimes = [];
  const sampleKpId = 'kp_math_001';
  console.log(`\n  ── 带知识图谱过滤的检索 (${Math.min(200, VECTOR_ITERATIONS)} 次) ──`);
  for (let i = 0; i < Math.min(200, VECTOR_ITERATIONS); i++) {
    const start = performance.now();
    await pool.query(
      `SELECT id, 1 - (embedding <=> $1::vector) AS similarity
       FROM rag_questions
       WHERE embedding IS NOT NULL AND knowledge_point_id = $2
       ORDER BY embedding <=> $1::vector
       LIMIT 5`,
      [generateFakeEmbedding(), sampleKpId]
    );
    filterTimes.push(performance.now() - start);
  }
  printResult('向量检索 + kp_id 过滤', stats(filterTimes));

  // ef_search 调优建议
  console.log('\n  ── HNSW ef_search 调优建议 ──');
  console.log('    当前: SET hnsw.ef_search = 40 (默认)');
  console.log('    建议: SET hnsw.ef_search = 100 (提高召回率，略增延迟)');
  console.log('    用法: 在查询前执行 SET LOCAL hnsw.ef_search = 100');
}

// ─────────────────────────────────────────────────────────────────────────────
// 基准 2: 方案 C — Apache AGE 2 跳图谱查询
// ─────────────────────────────────────────────────────────────────────────────

async function benchmarkGraphQueries() {
  console.log('\n' + '═'.repeat(60));
  console.log('  方案 C: Apache AGE 2 跳图谱查询基准测试');
  console.log('═'.repeat(60));

  const client = await pool.connect();
  try {
    await client.query(`LOAD 'age'; SET search_path = ag_catalog, "$user", public;`);

    // 检查图是否存在
    let graphExists = false;
    try {
      const graphCheck = await client.query(`SELECT * FROM ag_catalog.ag_graph WHERE name = 'knowledge_graph'`);
      graphExists = graphCheck.rows.length > 0;
    } catch {
      // AGE 可能未安装
    }

    if (!graphExists) {
      console.log('  ⚠️  Apache AGE 图 knowledge_graph 不存在或 AGE 未安装');
      console.log('  跳过图谱查询基准测试。');
      console.log('  建议: 运行 scripts/sync-obsidian-to-age.js 初始化图谱数据');
      return;
    }

    // 查询一个示例节点 ID
    let sampleKpId = 'test_node';
    try {
      const nodeCheck = await client.query(
        `SELECT * FROM cypher('knowledge_graph', $$
           MATCH (kp:KnowledgePoint) RETURN kp.id LIMIT 1
         $$) AS (id agtype)`
      );
      if (nodeCheck.rows.length > 0) {
        sampleKpId = JSON.parse(nodeCheck.rows[0].id) || sampleKpId;
      }
    } catch {
      console.log('  ⚠️  无法查询示例节点，将使用默认 ID');
    }

    console.log(`  示例知识点 ID: ${sampleKpId}`);

    // 1 跳查询
    console.log(`\n  ── 1 跳前置查询 (${GRAPH_ITERATIONS} 次) ──`);
    const hop1Times = [];
    for (let i = 0; i < GRAPH_ITERATIONS; i++) {
      const start = performance.now();
      try {
        await client.query(
          `SELECT * FROM cypher('knowledge_graph', $$
             MATCH (kp:KnowledgePoint {id: $1})-[:DEPENDS_ON]->(pre:KnowledgePoint)
             RETURN pre.id, pre.name
           $$) AS (id agtype, name agtype)`,
          [sampleKpId]
        );
      } catch {
        // 节点可能不存在
      }
      hop1Times.push(performance.now() - start);
    }
    printResult('1 跳前置查询', stats(hop1Times));

    // 2 跳查询
    console.log(`\n  ── 2 跳前置查询 (${GRAPH_ITERATIONS} 次) ──`);
    const hop2Times = [];
    for (let i = 0; i < GRAPH_ITERATIONS; i++) {
      const start = performance.now();
      try {
        await client.query(
          `SELECT * FROM cypher('knowledge_graph', $$
             MATCH (kp:KnowledgePoint {id: $1})-[:DEPENDS_ON]->(mid:KnowledgePoint)-[:DEPENDS_ON]->(pre:KnowledgePoint)
             RETURN pre.id, pre.name
           $$) AS (id agtype, name agtype)`,
          [sampleKpId]
        );
      } catch {
        // 忽略
      }
      hop2Times.push(performance.now() - start);
    }
    printResult('2 跳前置查询', stats(hop2Times));

    // 调优建议
    console.log('\n  ── AGE 查询调优建议 ──');
    console.log('    1. 确保 KnowledgePoint.id 属性有索引:');
    console.log('       CREATE INDEX ON ag_catalog."KnowledgePoint"(id)');
    console.log('    2. 如查询频率高，考虑缓存热点节点的前置依赖到 Redis');
    console.log('    3. 合并 1 跳和 2 跳查询为单次 Cypher (如果 AGE 版本支持 *1..2 语法)');
  } finally {
    client.release();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 基准 3: 连接池压力测试
// ─────────────────────────────────────────────────────────────────────────────

async function benchmarkConnectionPool() {
  console.log('\n' + '═'.repeat(60));
  console.log('  连接池并发压力测试');
  console.log('═'.repeat(60));

  const concurrentQueries = 20;
  console.log(`  并发查询数: ${concurrentQueries}`);

  const start = performance.now();
  const promises = [];

  for (let i = 0; i < concurrentQueries; i++) {
    promises.push(pool.query('SELECT pg_sleep(0.1) AS result').catch((err) => ({ error: err.message })));
  }

  await Promise.all(promises);
  const totalMs = (performance.now() - start).toFixed(2);

  console.log(`  总耗时: ${totalMs}ms`);
  console.log(`  预期: ~100ms（并发执行，所有查询同时开始）`);

  const elapsed = parseFloat(totalMs);
  if (elapsed > 500) {
    console.log('  ⚠️  耗时过长，可能连接池不足或存在连接泄漏');
    console.log(`  当前池状态: total=${pool.totalCount}, idle=${pool.idleCount}, waiting=${pool.waitingCount}`);
  } else {
    console.log('  ✅ 连接池并发正常');
  }

  console.log(`\n  当前连接池配置:`);
  console.log(`    max=${pool.options.max}, idleTimeout=${pool.options.idleTimeoutMillis}ms`);
  console.log(`    connectionTimeout=${pool.options.connectionTimeoutMillis}ms`);
  console.log(`    statement_timeout=${pool.options.statement_timeout}ms`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 主入口
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║       aitutor 数据库性能基准测试 v1.0                   ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(`  DATABASE_URL: ${process.env.DATABASE_URL?.slice(0, 50)}...`);
  console.log(`  时间: ${new Date().toISOString()}`);

  try {
    // 验证连接
    await pool.query('SELECT 1');
    console.log('  ✅ 数据库连接成功\n');

    await benchmarkVectorSearch();
    await benchmarkGraphQueries();
    await benchmarkConnectionPool();

    console.log('\n' + '═'.repeat(60));
    console.log('  基准测试完成');
    console.log('═'.repeat(60));
  } catch (err) {
    console.error('\n  ❌ 基准测试失败:', err.message);
  } finally {
    await pool.end();
    console.log('  连接池已关闭\n');
  }
}

main();
