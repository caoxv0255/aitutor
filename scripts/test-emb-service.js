import { getDb } from '../api/core/db.js';
import { getEmbedding, getBatchEmbeddings, EMBEDDING_MODEL, EMBEDDING_DIMS, IS_LOCAL } from '../services/embedding.js';

async function main() {
  console.log('=== 本地 Embedding 测试 ===');
  console.log('本地模式:', IS_LOCAL);
  console.log('模型:', EMBEDDING_MODEL);
  console.log('维度:', EMBEDDING_DIMS);
  console.log();

  const texts = [
    '导数函数的单调性与极值问题',
    '牛顿第二定律与圆周运动',
    '氧化还原反应与电化学',
    '圆锥曲线的离心率与渐近线',
    '楞次定律与电磁感应',
  ];

  console.log('单条测试:');
  const t0 = Date.now();
  const emb = await getEmbedding(texts[0]);
  console.log(`  耗时: ${Date.now() - t0}ms`);
  console.log(`  向量维度: ${emb.length}`);
  console.log(`  前5个值: [${emb.slice(0, 5).join(', ')}]`);
  console.log();

  console.log('批量测试 (5条):');
  const t1 = Date.now();
  const embs = await getBatchEmbeddings(texts);
  console.log(`  总耗时: ${Date.now() - t1}ms`);
  console.log(`  平均每条: ${Math.round((Date.now() - t1) / texts.length)}ms`);
  console.log(`  返回向量数: ${embs.length}`);
  console.log();

  console.log('余弦相似度测试:');
  const cosSim = (a, b) => {
    let dot = 0, na = 0, nb = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      na += a[i] * a[i];
      nb += b[i] * b[i];
    }
    return dot / (Math.sqrt(na) * Math.sqrt(nb));
  };

  for (let i = 1; i < texts.length; i++) {
    console.log(`  题1 vs 题${i+1}: ${cosSim(embs[0], embs[i]).toFixed(4)}`);
  }

  console.log('\n=== 测试通过 ===');
}

main().catch(console.error);