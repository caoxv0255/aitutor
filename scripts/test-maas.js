import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

const apiKey = process.env.DASHSCOPE_API_KEY;
const dashScopeUrl = 'https://llm-ecz0dfm8sux9p8y6.cn-beijing.maas.aliyuncs.com/api/v1';

console.log('测试阿里云MaaS dashScope模式...');

// 测试聊天
console.log('\n=== 测试Chat API ===');
try {
  const resp = await fetch(`${dashScopeUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
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
  console.log('响应:', JSON.stringify(data).substring(0, 600));
} catch (e) {
  console.error('失败:', e.message);
}

// 测试embedding（dashScope格式）
console.log('\n=== 测试Embedding API ===');
try {
  const resp = await fetch(`${dashScopeUrl}/embeddings`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'text-embedding-v3',
      input: '导数 函数单调性',
      dimensions: 1536
    })
  });
  const data = await resp.json();
  console.log('HTTP状态:', resp.status);
  console.log('响应:', JSON.stringify(data).substring(0, 600));
} catch (e) {
  console.error('失败:', e.message);
}

// 列出可用模型
console.log('\n=== 列出模型 ===');
try {
  const resp = await fetch(`${dashScopeUrl}/models`, {
    headers: { 'Authorization': `Bearer ${apiKey}` }
  });
  const data = await resp.json();
  console.log('HTTP状态:', resp.status);
  console.log('响应:', JSON.stringify(data).substring(0, 800));
} catch (e) {
  console.error('失败:', e.message);
}