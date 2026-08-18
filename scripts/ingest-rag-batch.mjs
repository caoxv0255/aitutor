#!/usr/bin/env node
/**
 * ingest-rag-batch.mjs — 批量灌入 exam_questions → rag_questions (bge-m3 embedding)
 *
 * 用法 (在 Docker 容器内):
 *   docker exec aitutor-app-1 node /app/scripts/ingest-rag-batch.mjs [--limit N]
 *
 * 前置: Ollama 可达 (需 Windows 主机 IP)
 */
import pg from 'pg';
import crypto from 'node:crypto';

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://172.21.144.1:11434';
const EMBED_MODEL = 'bge-m3';
const EMBED_DIM = 1024;

const args = process.argv.slice(2);
const getArg = (name) => {
  const idx = args.indexOf(name);
  return idx >= 0 && args[idx + 1] ? parseInt(args[idx + 1]) : 0;
};
const LIMIT = getArg('--limit') || 0;

function contentHash(text) {
  return crypto.createHash('sha256').update(text).digest('hex').slice(0, 32);
}

async function getEmbedding(text) {
  const res = await fetch(`${OLLAMA_URL}/api/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: EMBED_MODEL, prompt: text.slice(0, 8000) }),
    signal: AbortSignal.timeout(30000)
  });
  if (!res.ok) throw new Error(`Ollama ${res.status}`);
  const d = await res.json();
  const emb = d.embedding || [];
  if (emb.length !== EMBED_DIM) throw new Error(`dim ${emb.length} != ${EMBED_DIM}`);
  return emb;
}

async function main() {
  console.log('=== RAG Batch Ingest ===');
  console.log(`Ollama: ${OLLAMA_URL} | Model: ${EMBED_MODEL} | Dim: ${EMBED_DIM}`);
  console.log(`Limit: ${LIMIT || 'all'}`);

  // 测试 Ollama
  try {
    const emb = await getEmbedding('test');
    console.log(`✅ Ollama OK, dim=${emb.length}`);
  } catch (e) {
    console.error(`❌ Ollama: ${e.message}`);
    process.exit(1);
  }

  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

  const limitClause = LIMIT ? `LIMIT ${LIMIT}` : '';
  const { rows } = await pool.query(`
    SELECT id, question_uid, subject_code, question_type,
           COALESCE(difficulty::int, 3) as difficulty,
           COALESCE(stem,'') as stem, COALESCE(options,'') as options,
           COALESCE(answer,'') as answer, COALESCE(analysis,'') as analysis,
           COALESCE(knowledge_points,'') as knowledge_points,
           COALESCE(year::int, 2024) as year,
           COALESCE(province_code,'cn') as province
    FROM exam_questions
    WHERE stem IS NOT NULL AND stem != ''
    ORDER BY id ${limitClause}
  `);

  console.log(`📊 待灌入: ${rows.length} 题\n`);

  let success = 0, skipped = 0, failed = 0;

  for (let i = 0; i < rows.length; i++) {
    const q = rows[i];
    let content = q.stem;
    if (q.options && q.options !== '[]' && q.options !== 'null') {
      content += '\n选项: ' + q.options;
    }
    if (q.answer) content += '\n答案: ' + q.answer;
    if (q.analysis) content += '\n解析: ' + q.analysis;
    content = content.slice(0, 8000);

    // 用 question_id + content 双字段生成唯一 hash
    const hash = contentHash(`${q.id}:${content}`);

    // 检查已存在
    const exists = await pool.query('SELECT 1 FROM rag_questions WHERE content_hash = $1', [hash]);
    if (exists.rows.length > 0) {
      skipped++;
      if ((i + 1) % 10 === 0) console.log(`  进度: ${i+1}/${rows.length} | ✅${success} ⏭${skipped} ❌${failed}`);
      continue;
    }

    // 获取 embedding
    let emb;
    try {
      emb = await getEmbedding(content);
    } catch (e) {
      failed++;
      if (failed <= 5) console.error(`  ❌ [${q.id}] ${e.message}`);
      continue;
    }

    // 解析 KP ID
    let kpId = null;
    if (q.knowledge_points && q.knowledge_points !== '[]' && q.knowledge_points !== 'null') {
      try {
        const kps = JSON.parse(q.knowledge_points);
        if (Array.isArray(kps) && kps.length) kpId = String(kps[0]);
      } catch { kpId = q.knowledge_points.split(',')[0].trim(); }
    }

    // 插入
    try {
      const vecStr = '[' + emb.join(',') + ']';
      await pool.query(`
        INSERT INTO rag_questions
          (content, content_hash, embedding, knowledge_point_id, subject_code,
           difficulty, question_type, source_paper_id, source_year, source_region,
           source_subject, metadata)
        VALUES ($1, $2, $3::vector, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb)
        ON CONFLICT (content_hash) DO UPDATE SET
          embedding = EXCLUDED.embedding, updated_at = NOW()
      `, [
        content, hash, vecStr, kpId, q.subject_code, q.difficulty, q.question_type,
        q.question_uid || `eq_${q.id}`, q.year, q.province, q.subject_code,
        JSON.stringify({ exam_id: q.id })
      ]);
      success++;
    } catch (e) {
      failed++;
      if (failed <= 3) console.error(`  ❌ [${q.id}] ${e.message}`);
    }

    if ((i + 1) % 10 === 0 || i === rows.length - 1) {
      console.log(`  进度: ${i+1}/${rows.length} | ✅${success} ⏭${skipped} ❌${failed}`);
    }
    await new Promise(r => setTimeout(r, 100));
  }

  const { rows: [{ count }] } = await pool.query('SELECT COUNT(*) FROM rag_questions');
  console.log(`\n📊 rag_questions 总量: ${count} 条`);

  // 验证搜索
  try {
    const testEmb = await getEmbedding('函数与导数');
    const testVec = '[' + testEmb.join(',') + ']';
    const { rows: results } = await pool.query(`
      SELECT id, LEFT(content,60), subject_code, ROUND((1-(embedding <=> $1::vector))::numeric, 4) as similarity
      FROM rag_questions ORDER BY embedding <=> $1::vector LIMIT 3
    `, [testVec]);
    console.log('\n🔍 搜索 "函数与导数" 结果:');
    results.forEach(r => console.log(`  [${r.id}] sim=${r.similarity} ${r.subject_code}: ${r.left}`));
  } catch (e) {
    console.error(`搜索验证: ${e.message}`);
  }

  await pool.end();
  console.log(`\n✅ 完成: ${success} 成功 / ${skipped} 跳过 / ${failed} 失败`);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
