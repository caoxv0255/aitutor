import dotenv from 'dotenv';
dotenv.config();

const API_KEY = process.env.DASHSCOPE_API_KEY;
const WORKSPACE_ID = 'llm-ecz0dfm8sux9p8y6';
const APP_ID = '6089483';

async function testAppAPI() {
  console.log('测试阿里云百炼应用 API 连接...');
  console.log(`Workspace ID: ${WORKSPACE_ID}`);
  console.log(`App ID: ${APP_ID}`);
  console.log(`API_KEY: ${API_KEY ? '已配置 (' + API_KEY.length + ' 字符)' : '未配置'}`);
  console.log('');

  const endpoints = [
    `https://dashscope.aliyuncs.com/api/v2/apps/agent/${APP_ID}/compatible-mode/v1/responses`,
    `https://${WORKSPACE_ID}.cn-beijing.maas.aliyuncs.com/api/v2/apps/agent/${APP_ID}/compatible-mode/v1/responses`,
  ];

  for (const endpoint of endpoints) {
    console.log(`\n=== 尝试 Endpoint: ${endpoint} ===`);

    const body = {
      input: {
        messages: [
          { role: 'system', content: '你是一位经验丰富的AI导师，精通新高考全科教学。' },
          { role: 'user', content: '请简单介绍一下你自己。' },
        ],
      },
      stream: false,
    };

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`,
    };

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      console.log(`HTTP 状态码: ${response.status}`);
      
      let data;
      try {
        data = await response.json();
        console.log('响应:', JSON.stringify(data).substring(0, 1000));
      } catch {
        data = await response.text();
        console.log('响应:', data.substring(0, 1000));
      }

      if (response.ok) {
        const content = data.output?.text || data.output?.choices?.[0]?.message?.content || data.output?.content;
        if (content) {
          console.log('');
          console.log('✅ API 调用成功！');
          console.log('=== 返回内容 ===');
          console.log(content);
          return;
        }
      }
    } catch (error) {
      console.error('请求异常:', error.message);
    }
  }

  console.log('');
  console.log('=== 尝试标准 Chat Completions 模式 ===');
  
  const chatEndpoint = `https://${WORKSPACE_ID}.cn-beijing.maas.aliyuncs.com/compatible-mode/v1/chat/completions`;
  console.log(`Endpoint: ${chatEndpoint}`);

  const models = ['qwen-plus', 'qwen-max', 'qwen-turbo'];
  
  for (const model of models) {
    console.log(`\n--- 尝试模型: ${model} ---`);

    const body = {
      model,
      messages: [
        { role: 'system', content: '你是一位经验丰富的AI导师，精通新高考全科教学。' },
        { role: 'user', content: '请简单介绍一下你自己。' },
      ],
      temperature: 0.5,
      max_tokens: 500,
    };

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`,
    };

    try {
      const response = await fetch(chatEndpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      console.log(`HTTP 状态码: ${response.status}`);
      
      let data;
      try {
        data = await response.json();
        console.log('响应:', JSON.stringify(data).substring(0, 500));
      } catch {
        data = await response.text();
        console.log('响应:', data.substring(0, 500));
      }

      if (response.ok) {
        const content = data.choices?.[0]?.message?.content;
        if (content) {
          console.log('');
          console.log('✅ API 调用成功！');
          console.log('=== 返回内容 ===');
          console.log(content);
          return;
        }
      }
    } catch (error) {
      console.error('请求异常:', error.message);
    }
  }

  console.log('');
  console.log('❌ 所有尝试均失败');
  process.exit(1);
}

testAppAPI();