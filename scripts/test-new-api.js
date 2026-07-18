import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

console.log('测试新的阿里云MaaS API配置...');
console.log('DASHSCOPE_API_KEY:', process.env.DASHSCOPE_API_KEY?.substring(0, 20));
console.log('DASHSCOPE_BASE_URL:', process.env.DASHSCOPE_BASE_URL);
console.log('EMBEDDING_API_KEY:', process.env.EMBEDDING_API_KEY?.substring(0, 20));
console.log('EMBEDDING_BASE_URL:', process.env.EMBEDDING_BASE_URL);

// 测试Chat API
console.log('\n=== 测试Chat API ===');
try {
  const resp = await fetch(`${process.env.DASHSCOPE_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.DASHSCOPE_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'qwen-plus',
      messages: [{ role: 'user', content: '简单描述函数f(x)=x³的单调区间' }],
      temperature: 0.3,
      max_tokens: 200
    })
  });
  const data = await resp.json();
  console.log('HTTP状态:', resp.status);
  if (data.choices?.[0]?.message?.content) {
    console.log('成功:', data.choices[0].message.content);
  } else {
    console.log('响应:', JSON.stringify(data).substring(0, 500));
  }
} catch (e) {
  console.error('Chat失败:', e.message);
}

// 测试Embedding API
console.log('\n=== 测试Embedding API ===');
try {
  const resp = await fetch(`${process.env.EMBEDDING_BASE_URL}/embeddings`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.EMBEDDING_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'text-embedding-v3',
      input: '导数 函数单调性 极值',
      dimensions: 1536
    })
  });
  const data = await resp.json();
  console.log('HTTP状态:', resp.status);
  if (data.data?.[0]?.embedding) {
    console.log('向量维度:', data.data[0].embedding.length);
    console.log('前5个值:', data.data[0].embedding.slice(0, 5));
  } else {
    console.log('响应:', JSON.stringify(data).substring(0, 500));
  }
} catch (e) {
  console.error('Embedding失败:', e.message);
}