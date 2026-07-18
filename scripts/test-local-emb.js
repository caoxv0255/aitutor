import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

const resp = await fetch('http://localhost:8000/v1/embeddings', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    input: '导数 函数单调性 极值 三次函数',
    model: 'shibing624/text2vec-base-chinese'
  })
});
const data = await resp.json();
console.log('状态:', resp.status);
console.log('向量维度:', data.data?.[0]?.embedding?.length);
console.log('前10个值:', data.data?.[0]?.embedding?.slice(0, 10));
console.log('模型:', data.model);