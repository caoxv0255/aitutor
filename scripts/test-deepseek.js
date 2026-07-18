import axios from 'axios';

const API_KEY = 'sk-22aeb75bda054d3cb6c56548ea81f146';
const BASE_URL = 'https://api.deepseek.com/v1';

async function testChat() {
  try {
    const resp = await axios.post(`${BASE_URL}/chat/completions`, {
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: '你好，测试一下' }],
      max_tokens: 50,
    }, {
      headers: { Authorization: `Bearer ${API_KEY}` }
    });
    console.log('✅ Chat 成功:', resp.data.choices[0].message.content);
    return true;
  } catch (err) {
    console.error('❌ Chat 失败:', err.response?.status, err.response?.data?.error || err.message);
    return false;
  }
}

async function testEmbedding() {
  try {
    const resp = await axios.post(`${BASE_URL}/embeddings`, {
      model: 'text-embedding-3-small',
      input: '测试文本',
    }, {
      headers: { Authorization: `Bearer ${API_KEY}` }
    });
    console.log(`✅ Embedding 成功，维度: ${resp.data.data[0].embedding.length}`);
    return true;
  } catch (err) {
    console.error('❌ Embedding 失败:', err.response?.status, err.response?.data?.error || err.message);
    return false;
  }
}

async function listModels() {
  try {
    const resp = await axios.get(`${BASE_URL}/models`, {
      headers: { Authorization: `Bearer ${API_KEY}` }
    });
    console.log('DeepSeek 可用模型:');
    resp.data.data.forEach(m => console.log(`  - ${m.id}`));
  } catch (err) {
    console.error('❌ 获取模型列表失败:', err.message);
  }
}

async function main() {
  console.log('测试 DeepSeek API...\n');
  
  await testChat();
  console.log('');
  await listModels();
}

main();
