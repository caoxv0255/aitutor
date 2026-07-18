import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

const apiKey = process.env.DASHSCOPE_API_KEY;
const baseUrl = 'https://dashscope.aliyuncs.com/compatible-mode/v1';

console.log('测试DashScope Embedding API...');
try {
  const resp = await fetch(`${baseUrl}/embeddings`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'text-embedding-v3',
      input: '测试向量生成',
      dimensions: 1536
    })
  });
  const data = await resp.json();
  console.log('HTTP状态:', resp.status);
  if (data.data && data.data[0]) {
    console.log('向量维度:', data.data[0].embedding?.length);
    console.log('前5个值:', data.data[0].embedding?.slice(0, 5));
  } else {
    console.log('响应:', JSON.stringify(data).substring(0, 500));
  }
} catch (e) {
  console.error('失败:', e.message);
}
