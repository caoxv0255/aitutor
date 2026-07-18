import axios from 'axios';

const API_KEY = 'sk-df8Z1pBQemztkHgcwnttSoVuWz1cjNfGmDAkU4nlpTvQH9jd';
const BASE_URL = 'https://mydamoxing.cn/v1';

async function listModels() {
  try {
    const resp = await axios.get(`${BASE_URL}/models`, {
      headers: { Authorization: `Bearer ${API_KEY}` }
    });
    console.log('完整响应:', JSON.stringify(resp.data, null, 2).slice(0, 3000));
  } catch (err) {
    console.error('错误:', err.response?.data || err.message);
  }
}

listModels();
