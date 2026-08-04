// scripts/test_embedding.mjs — 测 embedding.js 3 种 provider
import { getEmbedding, EMBEDDING_MODEL, EMBEDDING_DIMS, EMBEDDING_PROVIDER } from '../services/embedding.js';

console.log(`[test] provider=${EMBEDDING_PROVIDER} model=${EMBEDDING_MODEL} dims=${EMBEDDING_DIMS}`);

try {
  const emb = await getEmbedding('测试中文 embedding 端到端验证');
  console.log(`✓ getEmbedding OK, dim=${emb.length}`);
  console.log(`  前 5 维: ${emb.slice(0, 5).map(n => n.toFixed(4)).join(', ')}`);
} catch (e) {
  console.log(`✗ getEmbedding fail: ${e.message}`);
  process.exit(1);
}