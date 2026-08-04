// scripts/test_rag_e2e.mjs — RAG search 端到端
import 'dotenv/config';
import { searchSimilarQuestions, getIngestStats } from '../api/routes/rag-search.js';
import { EMBEDDING_MODEL, EMBEDDING_DIMS } from '../services/embedding.js';

console.log(`[test] embedding: provider=ollama model=${EMBEDDING_MODEL} dim=${EMBEDDING_DIMS}`);

const stats = await getIngestStats();
console.log(`\n=== Ingest Stats ===`);
console.log(`  total: ${stats.total}, subjects: ${stats.subjects}, embedded: ${stats.embedded}`);

async function testQuery(q, opts, expected) {
  const start = Date.now();
  const r = await searchSimilarQuestions(q, { top_k: 3, threshold: 0.5, ...opts });
  const ms = Date.now() - start;
  console.log(`\n=== "${q}"  expect=${expected}  (${ms}ms, ${r.length} hits) ===`);
  for (const x of r) {
    console.log(`  sim=${x.similarity?.toFixed(4)}  ${x.subject_code || '?'}  ${(x.content || '').slice(0, 70)}...`);
  }
  return r;
}

await testQuery('软锰矿制备高锰酸钾的化学方程式', {}, 'chemistry');
await testQuery('导数的几何意义', { subject_code: 'math' }, 'math/导数');
await testQuery('牛顿第二定律的应用', { subject_code: 'physics' }, 'physics/力学');
await testQuery('离子反应', {}, 'chemistry/离子');

console.log(`\n✓ RAG end-to-end OK`);