/**
 * generate-keyword-map.cjs
 * 从 textbook_knowledge.json 自动生成 TEXTBOOK_KEYWORD_MAP
 * 输出到 api/utils/textbookKeywords.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const INPUT = path.join(ROOT, 'database', 'graphify-gaokao-knowledge', 'textbook_knowledge.json');
const OUTPUT = path.join(ROOT, 'api', 'utils', 'textbookKeywords.js');

const data = JSON.parse(fs.readFileSync(INPUT, 'utf-8'));
console.log(`读取 ${data.length} 条教材知识点`);

const entries = [];

for (const kp of data) {
  const keywords = new Set();
  
  // 从 name 提取关键词（按标点/空格分割，过滤长度<2的）
  const nameParts = (kp.name || '').split(/[\s,，、;；：:。.!！?？()（）\[\]【】{}\/|第章节课]+/).filter(s => s.length >= 2);
  nameParts.forEach(p => keywords.add(p));
  
  // 从 module 提取
  const modParts = (kp.module || '').split(/[\s,，、;；：:。.!！?？()（）\[\]【】{}\/|第章节课]+/).filter(s => s.length >= 2);
  modParts.forEach(p => keywords.add(p));
  
  // 从 content 提取前 200 字中的关键术语（简单启发式：2-4字中文词）
  const contentSample = (kp.content || '').slice(0, 200);
  const termMatches = contentSample.match(/[\u4e00-\u9fa5]{2,4}/g) || [];
  // 高频词统计
  const wordFreq = {};
  for (const w of termMatches) {
    wordFreq[w] = (wordFreq[w] || 0) + 1;
  }
  // 取出现2次以上的词（去停用词）
  const stopWords = new Set(['可以', '通过', '进行', '其中', '以及', '因为', '所以', '但是', '如果', '这些', '那些', '已经', '需要', '不同', '相同', '具有', '包括', '属于', '对于', '关于', '由于', '因此', '同时', '或者', '并且', '不是', '就是', '还是', '只是', '只有', '没有', '什么', '怎么', '一个', '这个', '那个', '我们', '它们', '他们']);
  const hotWords = Object.entries(wordFreq)
    .filter(([w, c]) => c >= 2 && !stopWords.has(w))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([w]) => w);
  hotWords.forEach(w => keywords.add(w));
  
  // 限制每个知识点最多 10 个关键词
  const kwArray = [...keywords].slice(0, 10);
  if (kwArray.length > 0) {
    entries.push({ id: kp.id, keywords: kwArray });
  }
}

console.log(`生成 ${entries.length} 个知识点的关键词映射`);

// 输出为 ES Module
const lines = [
  '/**',
  ' * textbookKeywords.js',
  ' * 教材知识点关键词映射（自动生成，勿手动编辑）',
  ' * 从 textbook_knowledge.json 提取，用于薄弱知识点检测',
  ' */',
  '',
  'export const TEXTBOOK_KEYWORD_MAP = {',
];

for (const { id, keywords } of entries) {
  const kwStr = keywords.map(k => `'${k}'`).join(', ');
  lines.push(`  '${id}': [${kwStr}],`);
}

lines.push('};');
lines.push('');

fs.writeFileSync(OUTPUT, lines.join('\n'), 'utf-8');
console.log(`已写入: ${OUTPUT} (${lines.length} 行)`);
