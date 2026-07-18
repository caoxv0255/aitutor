/**
 * test-parse.cjs - 测试解析一个 DOCX 文件看内容结构
 */
const mammoth = require('mammoth');
const path = require('path');

const testFile = path.join(
  'C:\\Users\\CaoXv\\Documents\\aitutor\\预习复习资料大礼包（高中）',
  '《高中新教材知识点归纳》',
  '2022高中化学新教材知识点梳理',
  '新教材-人教版高中化学必修第一册全册各章节知识点考点重点难点提炼汇总（135页）.docx'
);

async function main() {
  console.log(`Parsing: ${path.basename(testFile)}`);
  const result = await mammoth.extractRawText({ path: testFile });
  const text = result.value;
  
  // Write to file for inspection
  const fs = require('fs');
  const outPath = path.join(__dirname, '..', 'database', 'textbooks', 'test_output.txt');
  fs.writeFileSync(outPath, text, 'utf-8');
  console.log(`Text length: ${text.length} chars`);
  console.log(`Written to: ${outPath}`);
  
  // Show first 3000 chars
  console.log('\n=== First 3000 chars ===');
  console.log(text.substring(0, 3000));
  console.log('\n=== Last 1000 chars ===');
  console.log(text.substring(text.length - 1000));
}

main().catch(console.error);
