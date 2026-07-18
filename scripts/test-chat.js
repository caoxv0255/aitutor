import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

import { chatCompletion } from '../services/llm.js';

console.log('测试chatCompletion...');
const result = await chatCompletion(
  '你是一位专业的学科教师，擅长用简洁的语言总结题目。',
  '请用简洁的语言描述这道数学题的核心内容和考察意图。\n\n题目：函数f(x)=x³的单调区间',
  { model: 'qwen3.7-plus', temperature: 0.3, max_tokens: 500, jsonMode: false }
);
console.log('完整结果:', JSON.stringify(result, null, 2));
console.log('content:', result.content);
console.log('content长度:', result.content?.length);