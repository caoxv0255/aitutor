import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

const apiKey = process.env.DASHSCOPE_API_KEY;
const baseUrl = 'https://llm-ecz0dfm8sux9p8y6.cn-beijing.maas.aliyuncs.com/api/v1';

// 分页获取所有模型
console.log('获取所有可用模型...');
let allModels = [];
let pageNo = 1;

while (true) {
  const resp = await fetch(`${baseUrl}/models?page_no=${pageNo}&page_size=50`, {
    headers: { 'Authorization': `Bearer ${apiKey}` }
  });
  const data = await resp.json();
  if (!data.output?.models || data.output.models.length === 0) break;
  
  allModels = allModels.concat(data.output.models);
  console.log(`  第${pageNo}页: ${data.output.models.length}个模型`);
  
  if (data.output.total <= allModels.length) break;
  pageNo++;
}

console.log(`\n总计: ${allModels.length}个模型`);

// 筛选关键模型
const chatModels = allModels.filter(m => m.model.includes('qwen') || m.model.includes('chat'));
const embeddingModels = allModels.filter(m => m.model.includes('embedding') || m.model.includes('vector'));

console.log('\n=== Chat模型 ===');
chatModels.slice(0, 10).forEach(m => console.log(`  ${m.model}: ${m.name}`));

console.log('\n=== Embedding模型 ===');
embeddingModels.forEach(m => console.log(`  ${m.model}: ${m.name}`));

// 测试找到的embedding模型
if (embeddingModels.length > 0) {
  console.log('\n=== 测试Embedding ===');
  const embModel = embeddingModels[0];
  console.log(`使用模型: ${embModel.model}`);
  
  try {
    const resp = await fetch(`${baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: embModel.model,
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
}

// 测试Chat模型
if (chatModels.length > 0) {
  console.log('\n=== 测试Chat ===');
  const chatModel = chatModels[0];
  console.log(`使用模型: ${chatModel.model}`);
  
  try {
    const resp = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: chatModel.model,
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
}