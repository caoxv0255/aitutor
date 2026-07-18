/**
 * structure-textbook-knowledge.cjs
 * 将解析后的 DOCX/DOC 知识点转换为标准知识库格式
 * 
 * 输入: database/textbooks/parsed/*.json
 * 输出: database/graphify-gaokao-knowledge/textbook_knowledge.json
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PARSED_DIR = path.join(ROOT, 'database', 'textbooks', 'parsed');
const SEED_PATH = path.join(ROOT, 'database', 'OLD', 'seed_knowledge_points.json');
const OUTPUT_FILE = path.join(ROOT, 'database', 'graphify-gaokao-knowledge', 'textbook_knowledge.json');

// 学科标识
const SUBJECTS_EN = {
  '化学': 'chemistry', '物理': 'physics', '数学': 'math',
  '生物': 'biology', '政治': 'politics', '历史': 'history',
  '地理': 'geography', '英语': 'english', '语文': 'chinese',
};
const SUBJECT_PREFIX = {
  math: 'MATH', chinese: 'CHIN', english: 'ENG', physics: 'PHYS',
  chemistry: 'CHEM', biology: 'BIO', politics: 'POL', history: 'HIST', geography: 'GEO',
};

// 册次代码
const VOLUME_CODES = {
  required_1: { label: '必修第一册', code: 'B1', difficulty: 2 },
  required_2: { label: '必修第二册', code: 'B2', difficulty: 2 },
  required_3: { label: '必修第三册', code: 'B3', difficulty: 3 },
  required_4: { label: '必修第四册', code: 'B4', difficulty: 3 },
  selective_1: { label: '选择性必修第一册', code: 'X1', difficulty: 4 },
  selective_2: { label: '选择性必修第二册', code: 'X2', difficulty: 4 },
  selective_3: { label: '选择性必修第三册', code: 'X3', difficulty: 5 },
};

// 加载种子考频数据
function loadSeedPoints() {
  try {
    return JSON.parse(fs.readFileSync(SEED_PATH, 'utf-8'));
  } catch { return []; }
}

// 匹配考频
function matchFrequency(subject, kpName, seedPoints) {
  const subjectSeeds = seedPoints.filter(s => s.subject === subject);
  for (const seed of subjectSeeds) {
    // 名称部分匹配
    if (kpName.includes(seed.name) || seed.name.includes(kpName)) {
      return { frequency: seed.frequency, seed };
    }
    // 子考点匹配
    for (const sub of (seed.subtopics || [])) {
      if (kpName.includes(sub) || sub.includes(kpName)) {
        return { frequency: seed.frequency, seed };
      }
    }
  }
  return { frequency: null, seed: null };
}

// 从内容提取摘要（前200字）
function extractSummary(content) {
  if (!content) return '';
  // 去除 markdown 标记
  const clean = content.replace(/\*\*/g, '').replace(/\*/g, '').replace(/\[.*?\]/g, '').trim();
  return clean.substring(0, 200).replace(/\n/g, ' ');
}

// 清理章节标题
function cleanChapterTitle(title) {
  return title
    .replace(/^\(未分章\)\s*/, '')
    .replace(/\t\s*\d+\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ============ 主流程 ============
function main() {
  console.log('=== 知识点结构化转换 ===\n');

  const seedPoints = loadSeedPoints();
  console.log(`加载 ${seedPoints.length} 个种子考点\n`);

  // 读取所有学科的解析结果
  const subjects = {};
  const parsedFiles = fs.readdirSync(PARSED_DIR).filter(f => f.endsWith('.json'));
  
  for (const file of parsedFiles) {
    const subject = file.replace('.json', '');
    const data = JSON.parse(fs.readFileSync(path.join(PARSED_DIR, file), 'utf-8'));
    subjects[subject] = data;
  }

  // 转换为标准格式
  const output = []; // 与 structured_knowledge.json 格式兼容
  const knowledgePoints = []; // 扁平化知识点列表
  let globalId = 0;

  for (const [subject, data] of Object.entries(subjects)) {
    const subjectCn = data.subject_cn;
    const prefix = SUBJECT_PREFIX[subject] || subject.toUpperCase().slice(0, 4);
    
    console.log(`[${subject}] 处理 ${data.textbooks.length} 册教材...`);

    for (const textbook of data.textbooks) {
      const volume = textbook.volume;
      const volInfo = volume ? VOLUME_CODES[volume] : null;
      const volCode = volInfo ? volInfo.code : 'G0'; // G0 = general
      const volLabel = volInfo ? volInfo.label : '综合';
      const baseDifficulty = volInfo ? volInfo.difficulty : 3;

      for (const chapter of textbook.chapters) {
        const chapterTitle = cleanChapterTitle(chapter.title);
        // 跳过真正的空章（无节无内容）
        if (!chapterTitle && (!chapter.sections || chapter.sections.length === 0) && !chapter.content) continue;
        const effectiveChapterTitle = chapterTitle || textbook.title || '综合';

        // 如果有节（sections），每个节/课时生成一个知识点
        if (chapter.sections && chapter.sections.length > 0) {
          for (const section of chapter.sections) {
            const sectionTitle = cleanChapterTitle(section.title);
            if (!sectionTitle) continue;

            // 如果有知识点，每个知识点单独生成
            if (section.knowledge_points && section.knowledge_points.length > 0) {
              for (const kp of section.knowledge_points) {
                globalId++;
                const id = `${prefix}-${volCode}-${String(globalId).padStart(3, '0')}`;
                const kpName = kp.name || kp.title;
                const { frequency } = matchFrequency(subject, kpName, seedPoints);

                const point = {
                  id,
                  name: kpName,
                  subject,
                  subject_cn: subjectCn,
                  textbook: textbook.title,
                  volume: volLabel,
                  volume_code: volCode,
                  module: effectiveChapterTitle,
                  section: sectionTitle,
                  difficulty: baseDifficulty,
                  frequency: frequency || (baseDifficulty >= 4 ? 'high' : 'medium'),
                  source: textbook.source_file,
                  level: 'gaokao',
                  content: kp.content || '',
                  summary: extractSummary(kp.content),
                  tags: [volCode.toLowerCase(), subject],
                };
                knowledgePoints.push(point);
              }
            } else {
              // 节没有知识点，用节内容作为一个知识点
              const content = section.content || '';
              if (!content.trim() && (!section.knowledge_points || section.knowledge_points.length === 0)) {
                // 跳过空节
                continue;
              }

              globalId++;
              const id = `${prefix}-${volCode}-${String(globalId).padStart(3, '0')}`;
              const { frequency } = matchFrequency(subject, sectionTitle, seedPoints);

              knowledgePoints.push({
                id,
                name: sectionTitle,
                subject,
                subject_cn: subjectCn,
                textbook: textbook.title,
                volume: volLabel,
                volume_code: volCode,
                module: effectiveChapterTitle,
                section: sectionTitle,
                difficulty: baseDifficulty,
                frequency: frequency || (baseDifficulty >= 4 ? 'high' : 'medium'),
                source: textbook.source_file,
                level: 'gaokao',
                content,
                summary: extractSummary(content),
                tags: [volCode.toLowerCase(), subject],
              });
            }
          }
        } else if (chapter.content && chapter.content.trim()) {
          // 章没有节，直接用章内容
          globalId++;
          const id = `${prefix}-${volCode}-${String(globalId).padStart(3, '0')}`;
          const { frequency } = matchFrequency(subject, chapterTitle, seedPoints);

          knowledgePoints.push({
            id,
            name: chapterTitle || effectiveChapterTitle,
            subject,
            subject_cn: subjectCn,
            textbook: textbook.title,
            volume: volLabel,
            volume_code: volCode,
            module: effectiveChapterTitle,
            section: chapterTitle || effectiveChapterTitle,
            difficulty: baseDifficulty,
            frequency: frequency || (baseDifficulty >= 4 ? 'high' : 'medium'),
            source: textbook.source_file,
            level: 'gaokao',
            content: chapter.content,
            summary: extractSummary(chapter.content),
            tags: [volCode.toLowerCase(), subject],
          });
        }
      }
    }

    // 统计
    const subjectPoints = knowledgePoints.filter(p => p.subject === subject);
    const volumes = [...new Set(subjectPoints.map(p => p.volume))];
    const modules = [...new Set(subjectPoints.map(p => p.module))];
    console.log(`  -> ${subjectPoints.length} 知识点, ${volumes.length} 册, ${modules.length} 模块`);
  }

  // 输出
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(knowledgePoints, null, 2), 'utf-8');
  console.log(`\n=== 结构化完成 ===`);
  console.log(`  总知识点: ${knowledgePoints.length}`);
  console.log(`  输出文件: ${OUTPUT_FILE}`);

  // 按学科统计
  console.log('\n=== 各学科统计 ===');
  for (const subject of Object.keys(SUBJECT_PREFIX)) {
    const points = knowledgePoints.filter(p => p.subject === subject);
    const highFreq = points.filter(p => p.frequency === 'high').length;
    const medFreq = points.filter(p => p.frequency === 'medium').length;
    console.log(`  ${subject.padEnd(12)}: ${String(points.length).padStart(4)} 知识点 (高:${highFreq} 中:${medFreq})`);
  }
}

main();
