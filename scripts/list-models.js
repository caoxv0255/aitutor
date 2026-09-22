import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import axios from 'axios';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
dotenv.config({ path: path.join(ROOT, '.env') });

// mydamoxing.cn 网关的凭据走 GRAPHRAG_API_KEY (与 graphrag_service/config.py 一致)
const API_KEY = process.env.GRAPHRAG_API_KEY;
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
