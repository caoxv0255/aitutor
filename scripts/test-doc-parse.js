#!/usr/bin/env node
// 测试.doc文件提取和LLM解析
import { config } from 'dotenv';
config();
import { execSync } from 'child_process';
import { writeFileSync, unlinkSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const filePath = 'D:\\Desktop\\aitutor\\database\\高考真题\\北京高考\\1. 北京高考语文2008-2025\\2008年北京市高考语文试卷（原卷版）.doc';

// Step 1: Extract text
const script = `# -*- coding: utf-8 -*-
import sys, win32com.client, pythoncom
pythoncom.CoInitialize()
word = win32com.client.Dispatch('Word.Application')
word.Visible = False
doc = word.Documents.Open(r"""${filePath}""", ReadOnly=True)
text = doc.Content.Text
doc.Close(False)
word.Application.Quit(-1)
text = text.replace('\\r\\n', '\\n').replace('\\r', '\\n')
sys.stdout.buffer.write(text.encode('utf-8'))
`;

const tmpScript = join(tmpdir(), 'test_doc_extract.py');
writeFileSync(tmpScript, script, 'utf-8');
const out = execSync(`python "${tmpScript}"`, { encoding: 'buffer', timeout: 120000, maxBuffer: 50 * 1024 * 1024 });
try { unlinkSync(tmpScript); } catch {}
const content = out.toString('utf-8');
console.log('=== 提取结果 ===');
console.log('Content length:', content.length);
console.log('First 500 chars:', content.substring(0, 500));
console.log('---');

// Step 2: Call LLM
const apiKey = process.env.DEEPSEEK_API_KEY || process.env.GRAPHRAG_API_KEY;
console.log('\n=== 调用LLM ===');
console.log('API Key:', apiKey ? '已配置' : '未配置');

const prompt = `这是一份语文高考试卷。语文题包括现代文阅读、古诗文、语言运用和作文题。

请从以下高考试卷内容中提取所有题目，按以下JSON格式返回：
{"questions": [{"number": 1, "type": "choice", "stem": "题干", "options": ["A.x","B.x"], "answer": "", "analysis": "", "knowledge_points": [], "difficulty": 3, "score": 5}]}
type: choice, multi_choice, fill, solve
difficulty: 1-5

以下是试卷内容：
${content.substring(0, 4000)}`;

const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'deepseek-chat',
    messages: [
      { role: 'system', content: '你是高考试卷题目提取助手，严格按JSON格式输出。' },
      { role: 'user', content: prompt }
    ],
    temperature: 0.1, max_tokens: 6000
  })
});

const result = await response.json();
if (result.error) {
  console.log('LLM错误:', JSON.stringify(result.error));
} else {
  const llmOutput = result.choices[0].message.content;
  console.log('LLM输出长度:', llmOutput.length);
  console.log('LLM输出前500字符:', llmOutput.substring(0, 500));
  
  // 尝试解析JSON
  const jsonMatch = llmOutput.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const data = JSON.parse(jsonMatch[0]);
      console.log('\n解析到题目数:', data.questions?.length || 0);
      if (data.questions?.length > 0) {
        console.log('第1题:', JSON.stringify(data.questions[0]).substring(0, 200));
      }
    } catch (e) {
      console.log('JSON解析失败:', e.message);
    }
  }
}
