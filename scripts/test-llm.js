import { generateSemanticDescription, generateSolutionDescription, parseMathStructure } from '../services/subject-parser.js';

const testStem = '已知函数f(x)=x³-3ax²+2，求函数的单调区间。';

console.log('测试语义描述生成...');
try {
  const sem = await generateSemanticDescription(testStem, 'math');
  console.log('结果:', sem);
  console.log('长度:', sem?.length);
  console.log('类型:', typeof sem);
  console.log('是否为空:', !sem || sem.trim() === '');
} catch (e) {
  console.error('失败:', e.message);
}

console.log('\n测试解法描述生成...');
try {
  const sol = await generateSolutionDescription(testStem, '单调区间为(-∞,0)∪(2a,+∞)', '对f(x)求导得f\'(x)=3x²-6ax', 'math');
  console.log('结果:', sol);
  console.log('长度:', sol?.length);
} catch (e) {
  console.error('失败:', e.message);
}

console.log('\n测试数学结构解析...');
try {
  const mathStruct = await parseMathStructure(testStem);
  console.log('结果:', JSON.stringify(mathStruct, null, 2));
} catch (e) {
  console.error('失败:', e.message);
}
