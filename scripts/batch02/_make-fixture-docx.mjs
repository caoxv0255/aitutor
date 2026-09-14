#!/usr/bin/env node
// scripts/batch02/_make-fixture-docx.mjs
// 生成一个最小可用的 .docx fixture (北京高考语文 2026 模拟题)
// 不依赖 docx 库，纯 JSZip + 最小 OOXML 结构
import JSZip from 'jszip';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, '..', '..', 'database', 'incoming', 'gaokao', 'chinese', '2026', 'beijing_2026_chinese_gaokao.docx');

const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

const paragraphs = [
  '北京高考语文 2026 真题（模拟）',
  '',
  '一、现代文阅读（20分）',
  '',
  '1. 下列对加点词的解释，不正确的一项是（  ）',
  'A. 学而时习之  时：按时',
  'B. 不耻下问  耻：以...为耻',
  'C. 教学相长  长：长久',
  'D. 敏而好学  敏：敏捷',
  '',
  '2. 根据材料一，下列理解不正确的一项是（  ）',
  '材料一：论述学习的本质在于实践，知行合一乃中华传统哲学之精髓。',
  '',
  '3. 请结合全文，分析"教学相长"的现代教育意义。',
  '',
  '4. 下列对四首诗的解读，不正确的一项是（  ）',
  '甲：《登高》杜甫',
  '乙：《春望》杜甫',
  '丙：《茅屋为秋风所破歌》杜甫',
  '丁：《兵车行》杜甫',
  '',
  '答案：D',
  '解析：本题考查文言文实词理解。"长久"为引申义，此处"长"应读 zhǎng，意为"成长"。'
];

const docXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
${paragraphs.map((p) => `    <w:p><w:r><w:t xml:space="preserve">${escapeXml(p)}</w:t></w:r></w:p>`).join('\n')}
  </w:body>
</w:document>`;

function escapeXml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const zip = new JSZip();
zip.file('[Content_Types].xml', contentTypes);
zip.folder('_rels').file('.rels', rels);
zip.folder('word').file('document.xml', docXml);

const buf = await zip.generateAsync({ type: 'nodebuffer' });
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, buf);
console.log(`✓ docx written: ${path.relative(process.cwd(), OUT)} (${buf.length} bytes)`);
