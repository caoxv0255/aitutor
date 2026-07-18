import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

const apiKey = process.env.DASHSCOPE_API_KEY;
const baseUrl = process.env.DASHSCOPE_BASE_URL;

console.log('测试新配置...');
console.log('Base URL:', baseUrl);

// 测试Chat（compatible mode）
console.log('\n=== 测试Chat (compatible) ===');
try {
  const resp = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'qwen3.7-plus',
      messages: [{ role: 'user', content: '简单描述函数f(x)=x³的单调区间' }],
      temperature: 0.3,
      max_tokens: 200
    })
  });
  const text = await resp.text();
  console.log('HTTP状态:', resp.status);
  console.log('响应:', text.substring(0, 600));
} catch (e) {
  console.error('失败:', e.message);
}

// 测试Embedding（compatible mode）
console.log('\n=== 测试Embedding (compatible) ===');
try {
  const resp = await fetch(`${baseUrl}/embeddings`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'text-embedding-v4',
      input: '导数 函数单调性',
      dimensions: 1536
    })
  });
  const text = await resp.text();
  console.log('HTTP状态:', resp.status);
  console.log('响应:', text.substring(0, 600));
} catch (e) {
  console.error('失败:', e.message);
}

// 测试native模式
console.log('\n=== 测试Chat (native) ===');
try {
  const nativeUrl = baseUrl.replace('/compatible-mode/v1', '/api/v1');
  console.log('Native URL:', nativeUrl);
  
  const resp = await fetch(`${nativeUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'X-DashScope-APIKey': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'qwen3.7-plus',
      messages: [{ role: 'user', content: '简单描述函数f(x)=x³的单调区间' }],
      temperature: 0.3,
      max_tokens: 200
    })
  });
  const text = await resp.text();
  console.log('HTTP状态:', resp.status);
  console.log('响应:', text.substring(0, 800));
} catch (e) {
  console.error('失败:', e.message);
}