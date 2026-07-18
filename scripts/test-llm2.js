import { chatCompletion } from '../services/llm.js';

console.log('测试1: jsonMode=false (语义描述)...');
try {
  const r = await chatCompletion(
    '你是一位专业的学科教师，擅长用简洁的语言总结题目。',
    '请用简洁的语言描述这道数学题的核心内容和考察意图。\n\n题目：已知函数f(x)=x³-3ax²+2，求函数的单调区间。',
    { model: 'qwen-plus', temperature: 0.3, max_tokens: 500, jsonMode: false }
  );
  console.log('结果:', r.content);
} catch (e) {
  console.error('失败:', e.message);
}

console.log('\n测试2: jsonMode=true (结构化)...');
try {
  const r = await chatCompletion(
    '请输出JSON格式的数学题目结构化信息。',
    '分析题目：已知函数f(x)=x³-3ax²+2，求函数的单调区间。请输出JSON：{"function_types":[], "formulas":[], "techniques":[]}',
    { model: 'qwen-plus', temperature: 0.2, max_tokens: 1000, jsonMode: true }
  );
  console.log('结果:', r.content);
} catch (e) {
  console.error('失败:', e.message);
}

console.log('\n测试3: 直接用fetch调用DashScope...');
try {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  const baseUrl = process.env.DASHSCOPE_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1';
  const endpoint = baseUrl.replace(/\/$/, '') + '/chat/completions';
  console.log('Endpoint:', endpoint);
  console.log('Key存在:', !!apiKey, 'Key前6位:', apiKey?.substring(0, 6));

  const resp = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'qwen-plus',
      messages: [
        { role: 'system', content: '你是数学教师' },
        { role: 'user', content: '简单描述：函数f(x)=x³-3ax²+2的单调区间' }
      ],
      temperature: 0.3,
      max_tokens: 200
    })
  });
  const data = await resp.json();
  console.log('HTTP状态:', resp.status);
  console.log('返回:', JSON.stringify(data).substring(0, 500));
} catch (e) {
  console.error('直接fetch失败:', e.message);
}
