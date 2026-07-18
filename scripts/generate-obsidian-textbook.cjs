/**
 * generate-obsidian-textbook.cjs
 * 从 textbook_knowledge.json 生成 Obsidian Markdown 知识点文件
 * 
 * 用法: node scripts/generate-obsidian-textbook.cjs
 * 
 * 输入: database/graphify-gaokao-knowledge/textbook_knowledge.json
 * 输出: database/knowledge-points/{subject}/*.md + MOC + 索引
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const INPUT_FILE = path.join(ROOT, 'database', 'graphify-gaokao-knowledge', 'textbook_knowledge.json');
const SEED_PATH = path.join(ROOT, 'database', 'OLD', 'seed_knowledge_points.json');
const OUTPUT_DIR = path.join(ROOT, 'database', 'knowledge-points');

const SUBJECT_CN = {
  math: '数学', chinese: '语文', english: '英语', physics: '物理',
  chemistry: '化学', biology: '生物', politics: '政治', history: '历史', geography: '地理',
};
const SUBJECT_EMOJI = {
  math: '📐', chinese: '📖', english: '🔤', physics: '⚡',
  chemistry: '🧪', biology: '🧬', politics: '⚖️', history: '📜', geography: '🌍',
};

// ============ 辅助函数 ============

// 生成真题索引段落
function generateExamIndex(kp, seedPoints) {
  const subjectSeeds = seedPoints.filter(s => s.subject === kp.subject);
  const matches = subjectSeeds.filter(seed => {
    return kp.name.includes(seed.name) || seed.name.includes(kp.name) ||
      (seed.subtopics || []).some(sub => kp.name.includes(sub) || sub.includes(kp.name));
  });

  if (matches.length === 0) {
    return `> 该知识点在历年高考中的出现频率待标注。可通过 LLM 分析真题 PDF 后自动关联。`;
  }

  const lines = [];
  let maxFreq = 'low';
  const freqOrder = { low: 0, medium: 1, high: 2 };
  for (const m of matches) {
    if (freqOrder[m.frequency] > freqOrder[maxFreq]) maxFreq = m.frequency;
  }
  const freqLabel = { high: '🔴 高频', medium: '🟡 中频', low: '🟢 低频' }[maxFreq];
  lines.push(`**考频等级**: ${freqLabel}`);
  lines.push('');
  lines.push('**关联考点**:');
  for (const m of matches) {
    lines.push(`- **${m.name}** (${m.description})`);
    if (m.subtopics && m.subtopics.length > 0) {
      lines.push(`  - 子考点: ${m.subtopics.join('、')}`);
    }
  }
  return lines.join('\n');
}

// 构建简单链接（同模块前后 + 同主题相关）
function buildLinks(kp, allKPs) {
  const links = [];
  const sameModule = allKPs.filter(p => p.subject === kp.subject && p.module === kp.module);
  const myIdx = sameModule.findIndex(p => p.id === kp.id);
  
  if (myIdx > 0) links.push({ name: sameModule[myIdx - 1].name, type: 'prerequisite' });
  if (myIdx >= 0 && myIdx < sameModule.length - 1) links.push({ name: sameModule[myIdx + 1].name, type: 'successor' });
  
  // 关键词相关（同科不同模块，标题有共同字）
  const titleChars = new Set(kp.name.split(''));
  const candidates = allKPs
    .filter(p => p.subject === kp.subject && p.id !== kp.id && p.module !== kp.module)
    .map(p => {
      const overlap = p.name.split('').filter(c => titleChars.has(c) && c.length > 1).length;
      return { kp: p, score: overlap };
    })
    .filter(x => x.score >= 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
  
  for (const { kp: linked } of candidates) {
    if (!links.some(l => l.name === linked.name)) {
      links.push({ name: linked.name, type: 'related' });
    }
  }
  
  // 跨学科（简单规则：物理↔数学，化学↔物理，生物↔化学）
  const crossPairs = [
    { a: 'physics', b: 'math', keywords: ['函数', '向量', '坐标', '导数'] },
    { a: 'chemistry', b: 'physics', keywords: ['能量', '电', '原子', '电子'] },
    { a: 'biology', b: 'chemistry', keywords: ['蛋白质', '酶', '有机物', '氧化'] },
    { a: 'politics', b: 'history', keywords: ['革命', '制度', '改革', '思想'] },
    { a: 'geography', b: 'physics', keywords: ['力', '运动', '大气', '地球'] },
  ];
  
  for (const pair of crossPairs) {
    if (kp.subject === pair.a || kp.subject === pair.b) {
      const otherSubject = kp.subject === pair.a ? pair.b : pair.a;
      for (const kw of pair.keywords) {
        if (kp.name.includes(kw)) {
          const target = allKPs.find(p => p.subject === otherSubject && p.name.includes(kw));
          if (target && !links.some(l => l.name === target.name)) {
            links.push({ name: target.name, type: 'cross-subject' });
          }
          break;
        }
      }
    }
  }
  
  return links;
}

// 格式化内容（清理多余空行，保留结构）
function formatContent(content) {
  if (!content) return '> 内容待补充';
  const fourNewlines = /\n{4,}/g;
  const threeNewlines = '\n\n\n';
  return content
    .replace(fourNewlines, threeNewlines)
    .replace(/\*\*\s*\*\*/g, '')
    .trim();
}

// ============ 主流程 ============
function main() {
  console.log('=== 生成 Obsidian Markdown (教材版) ===\n');
  
  // 读取数据
  const knowledgePoints = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf-8'));
  const seedPoints = JSON.parse(fs.readFileSync(SEED_PATH, 'utf-8'));
  console.log(`读取 ${knowledgePoints.length} 个知识点, ${seedPoints.length} 个种子考点\n`);
  
  // 清空旧输出（保留目录结构）
  if (fs.existsSync(OUTPUT_DIR)) {
    const oldFiles = fs.readdirSync(OUTPUT_DIR);
    for (const dir of oldFiles) {
      const dirPath = path.join(OUTPUT_DIR, dir);
      if (fs.statSync(dirPath).isDirectory()) {
        fs.rmSync(dirPath, { recursive: true, force: true });
      }
    }
  }
  
  // 按学科分组
  const bySubject = {};
  for (const kp of knowledgePoints) {
    if (!bySubject[kp.subject]) bySubject[kp.subject] = [];
    bySubject[kp.subject].push(kp);
  }
  
  let totalFiles = 0;
  const subjectStats = {};
  
  // 为每个学科生成文件
  for (const [subject, kps] of Object.entries(bySubject)) {
    const subjectCn = SUBJECT_CN[subject] || subject;
    const emoji = SUBJECT_EMOJI[subject] || '📚';
    const subjectDir = path.join(OUTPUT_DIR, subjectCn);
    fs.mkdirSync(subjectDir, { recursive: true });
    
    console.log(`${emoji} [${subjectCn}] ${kps.length} 个知识点`);
    
    // 按模块分组
    const byModule = {};
    for (const kp of kps) {
      const mod = kp.module || '综合';
      if (!byModule[mod]) byModule[mod] = [];
      byModule[mod].push(kp);
    }
    
    // 生成知识点文件
    for (const kp of kps) {
      const links = buildLinks(kp, knowledgePoints);
      const examIndex = generateExamIndex(kp, seedPoints);
      const content = formatContent(kp.content);
      const freqEmoji = { high: '🔴', medium: '🟡', low: '🟢' }[kp.frequency] || '⚪';
      
      // 分类链接
      const linkTexts = [];
      for (const l of links) {
        const icon = { prerequisite: '⬅️', successor: '➡️', related: '🔗', 'cross-subject': '🌐' }[l.type] || '•';
        linkTexts.push(`- ${icon} [[${l.name}]]`);
      }
      
      // 册次标签
      const volumeTag = kp.volume_code ? kp.volume_code.toLowerCase() : 'general';
      
      const mdContent = `---
id: "${kp.id}"
name: "${kp.name}"
subject: "${subject}"
module: "${kp.module}"
difficulty: ${kp.difficulty}
frequency: "${kp.frequency}"
source: "${kp.source}"
textbook: "${kp.textbook}"
volume: "${kp.volume}"
level: "gaokao"
tags:
  - ${subject}
  - ${volumeTag}
  - ${kp.frequency}-frequency
---

# ${kp.name}

> ${freqEmoji} 高考频率: **${kp.frequency}** | 难度: ${'⭐'.repeat(kp.difficulty)} | 册次: ${kp.volume}

## 核心内容

${content}

## 真题索引

${examIndex}

## 关联知识点

${linkTexts.length > 0 ? linkTexts.join('\n') : '- 暂无关联'}

## 教材来源

- 教材: ${kp.textbook}
- 册次: ${kp.volume}
- 模块: ${kp.module}
- 来源文件: ${kp.source}
- ID: ${kp.id}
`;
      
      const safeName = kp.name.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '_').slice(0, 60);
      const filepath = path.join(subjectDir, `${kp.id}_${safeName}.md`);
      fs.writeFileSync(filepath, mdContent, 'utf-8');
      totalFiles++;
    }
    
    // 生成学科 MOC
    const mocLines = [`---`, `subject: "${subject}"`, `type: "moc"`, `---`, '', `# ${emoji} ${subjectCn}知识点总览`, ''];
    mocLines.push(`> 共 ${kps.length} 个知识点，覆盖 ${Object.keys(byModule).length} 个模块\n`);
    
    for (const [mod, modKPs] of Object.entries(byModule)) {
      mocLines.push(`## ${mod}\n`);
      for (const kp of modKPs) {
        const freqEmoji = { high: '🔴', medium: '🟡', low: '🟢' }[kp.frequency] || '⚪';
        const safeName = kp.name.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '_').slice(0, 60);
        mocLines.push(`- ${freqEmoji} [[${kp.id}_${safeName}|${kp.name}]]`);
      }
      mocLines.push('');
    }
    
    fs.writeFileSync(path.join(subjectDir, `00_${subjectCn}_MOC.md`), mocLines.join('\n'), 'utf-8');
    totalFiles++;
    
    subjectStats[subject] = { count: kps.length, modules: Object.keys(byModule).length };
  }
  
  // 生成根索引
  console.log('\n📋 生成根索引...');
  const rootLines = [`---`, `type: "index"`, `---`, '', '# 📚 高考知识点知识库（教材版）', ''];
  rootLines.push(`> 基于新教材教辅资料生成的结构化知识库\n`);
  rootLines.push(`> 总计 **${knowledgePoints.length}** 个知识点，覆盖 **9** 大学科\n`);
  rootLines.push('## 学科导航\n');
  rootLines.push('| 学科 | 知识点数 | 模块数 | 入口 |');
  rootLines.push('|------|---------|--------|------|');
  for (const [subject, stats] of Object.entries(subjectStats)) {
    const cn = SUBJECT_CN[subject] || subject;
    const emoji = SUBJECT_EMOJI[subject] || '📚';
    rootLines.push(`| ${emoji} ${cn} | ${stats.count} | ${stats.modules} | [[00_${cn}_MOC]] |`);
  }
  
  fs.writeFileSync(path.join(OUTPUT_DIR, '00_根索引.md'), rootLines.join('\n'), 'utf-8');
  totalFiles++;
  
  console.log(`\n=== 生成完成 ===`);
  console.log(`  总文件: ${totalFiles}`);
  console.log(`  输出目录: ${OUTPUT_DIR}`);
}

main();
