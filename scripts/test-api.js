import 'dotenv/config';
import { chatCompletion } from '../services/llm.js';

console.log('DASHSCOPE_API_KEY:', process.env.DASHSCOPE_API_KEY?.substring(0, 10));
console.log('DEEPSEEK_API_KEY:', process.env.DEEPSEEK_API_KEY?.substring(0, 10));

console.log('\n测试 DeepSeek...');
try {
  const r = await chatCompletion(
    '你是数学教师',
    '简单描述函数f(x)=x³的单调区间',
    { model: 'deepseek-chat', temperature: 0.3, max_tokens: 200, jsonMode: false }
  );
  console.log('DeepSeek 结果:', r.content);
} catch (e) {
  console.error('DeepSeek 失败:', e.message);
}

console.log('\n测试 DashScope...');
try {
  const r = await chatCompletion(
    '你是数学教师',
    '简单描述函数f(x)=x³的单调区间',
    { model: 'qwen-plus', temperature: 0.3, max_tokens: 200, jsonMode: false }
  );
  console.log('qwen-plus 结果:', r.content);
} catch (e) {
  console.error('qwen-plus 失败:', e.message);
}
