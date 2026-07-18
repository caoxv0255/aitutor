/**
 * parse-docx-knowledge.cjs
 * 解析本地 DOCX/DOC 知识点文档，提取结构化知识内容
 * 
 * 数据源优先级：
 * P0: 《高中新教材知识点归纳》中的 DOCX/DOC (按册次组织的结构化知识点)
 * P0: 《教材帮》PDF (按课时组织的辅导内容)
 * P1: 《一本涂书》PDF (标注式教辅)
 */
const fs = require('fs');
const path = require('path');
const mammoth = require('mammoth');
const WordExtractor = require('word-extractor');

const ROOT = path.join(__dirname, '..');
const RESOURCES_DIR = path.join(ROOT, 'database', 'textbooks');
const INDEX_FILE = path.join(RESOURCES_DIR, 'resource-index.json');
const OUTPUT_DIR = path.join(RESOURCES_DIR, 'parsed');

// 学科标识
const SUBJECTS = {
  chemistry: '化学', physics: '物理', math: '数学',
  biology: '生物', politics: '政治', history: '历史',
  geography: '地理', english: '英语', chinese: '语文',
};

// 册次代码映射
const VOLUME_CODES = {
  required_1: { label: '必修第一册', code: 'B1', difficulty: 2 },
  required_2: { label: '必修第二册', code: 'B2', difficulty: 2 },
  required_3: { label: '必修第三册', code: 'B3', difficulty: 3 },
  required_4: { label: '必修第四册', code: 'B4', difficulty: 3 },
  selective_1: { label: '选择性必修第一册', code: 'X1', difficulty: 4 },
  selective_2: { label: '选择性必修第二册', code: 'X2', difficulty: 4 },
  selective_3: { label: '选择性必修第三册', code: 'X3', difficulty: 5 },
};

// ============ 文本分段与层级识别 ============

// 章标题模式：第X章/第一单元/模块X
const CHAPTER_PATTERNS = [
  /^第[一二三四五六七八九十百千\d]+章[ \s]+(.+)/,
  /^第[一二三四五六七八九十百千\d]+单元[ \s]*(.*)/,
  /^模块[一二三四五六七八九十\d]+[ \s]*(.*)/,
  /^专题[一二三四五六七八九十\d]+[ \s]*(.*)/,
];

// 节标题模式：第X节/第X课/第X课时/第X讲
const SECTION_PATTERNS = [
  /^第[一二三四五六七八九十百千\d]+节[ \s]+(.+)/,
  /^第[一二三四五六七八九十百千\d]+课[ \s]+(.+)/,
  /^第[一二三四五六七八九十百千\d]+课时[ \s]*(.*)/,
  /^第[一二三四五六七八九十百千\d]+讲[ \s]*(.*)/,
  /^Unit\s*\d+[ \s]*(.*)/i,
  /^Lesson\s*\d+[ \s]*(.*)/i,
];

// 知识点标记
const KNOWLEDGE_POINT_PATTERN = /^知识点[一二三四五六七八九十\d]+[：: \s]*(.*)/;

// 典例标记
const EXAMPLE_PATTERN = /^(?:【)?典例\s*\d+/;

// 判断是否为目录行（含 tab + 页码 的行）
function isTOCLine(line) {
  const t = line.trim();
  if (!t) return false;
  // TOC行特征：末尾是 tab + 数字，或整行含 tab 且 tab 后是数字
  return /\t\d{1,4}$/.test(t) || /\t\s*\d{1,4}\s*$/.test(t);
}

// 检测 TOC 区域结束位置
function findTOCEnd(lines) {
  // 扫描前300行，找到连续的非TOC区域
  let lastTocIdx = -1;
  let consecutiveNonToc = 0;
  for (let i = 0; i < Math.min(lines.length, 300); i++) {
    if (isTOCLine(lines[i])) {
      lastTocIdx = i;
      consecutiveNonToc = 0;
    } else {
      consecutiveNonToc++;
      // 如果连续5行以上非TOC（含空行），认为TOC结束
      if (consecutiveNonToc >= 5 && lastTocIdx >= 0) {
        // 返回TOC后第一个非空行
        let end = lastTocIdx + 1;
        while (end < lines.length && lines[end].trim() === '') end++;
        return end;
      }
    }
  }
  return 0; // 没有检测到TOC
}

// 清理标题末尾的 tab + 页码
function cleanTitle(title) {
  return title.replace(/\t\s*\d{1,4}\s*$/, '').trim();
}

// 检测行类型
function classifyLine(line) {
  const trimmed = line.trim();
  if (!trimmed) return { type: 'empty' };
  
  // 跳过明显的 TOC 行
  if (isTOCLine(line)) return { type: 'toc_skip' };
  
  for (const pat of CHAPTER_PATTERNS) {
    const m = trimmed.match(pat);
    if (m) return { type: 'chapter', title: cleanTitle(trimmed), name: cleanTitle(m[1] || trimmed) };
  }
  
  for (const pat of SECTION_PATTERNS) {
    const m = trimmed.match(pat);
    if (m) return { type: 'section', title: cleanTitle(trimmed), name: cleanTitle(m[1] || trimmed) };
  }
  
  const kp = trimmed.match(KNOWLEDGE_POINT_PATTERN);
  if (kp) return { type: 'knowledge_point', title: cleanTitle(trimmed), name: cleanTitle(kp[1] || trimmed) };
  
  if (EXAMPLE_PATTERN.test(trimmed)) return { type: 'example', title: trimmed };
  if (/^\[解析\]/.test(trimmed) || /^解析[：:]/.test(trimmed)) return { type: 'analysis' };
  if (/^\[答案\]/.test(trimmed) || /^答案[：:]/.test(trimmed)) return { type: 'answer' };
  if (/^规律总结/.test(trimmed) || /^方法总结/.test(trimmed) || /^解题方法/.test(trimmed)) return { type: 'summary' };
  if (/^重点难点/.test(trimmed) || /^重难点/.test(trimmed)) return { type: 'key_difficulty' };
  if (/^注意[：:]/.test(trimmed) || /^提示[：:]/.test(trimmed)) return { type: 'note' };
  
  return { type: 'content' };
}

// ============ 主解析函数 ============

function parseTextToStructure(text, filename) {
  const lines = text.split('\n').map(l => l.trimEnd());
  
  // 检测并跳过目录区域
  const tocEnd = findTOCEnd(lines);
  let startIdx = tocEnd;
  if (tocEnd > 0) {
    // 跳过目录后的空行
    while (startIdx < lines.length && lines[startIdx].trim() === '') startIdx++;
  }
  
  // 构建层级结构
  const chapters = [];
  let currentChapter = null;
  let currentSection = null;
  let currentKnowledgePoint = null;
  let contentBuffer = [];
  
  function flushContent() {
    const content = contentBuffer.join('\n').trim();
    if (content) {
      if (currentKnowledgePoint) {
        currentKnowledgePoint.content += (currentKnowledgePoint.content ? '\n' : '') + content;
      } else if (currentSection) {
        currentSection.content += (currentSection.content ? '\n' : '') + content;
      } else if (currentChapter) {
        currentChapter.content += (currentChapter.content ? '\n' : '') + content;
      }
    }
    contentBuffer = [];
  }
  
  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i];
    const cls = classifyLine(line);
    
    switch (cls.type) {
      case 'chapter':
        flushContent();
        currentChapter = {
          title: cls.title,
          sections: [],
          content: '',
        };
        chapters.push(currentChapter);
        currentSection = null;
        currentKnowledgePoint = null;
        break;
        
      case 'section':
        flushContent();
        if (!currentChapter) {
          currentChapter = { title: '(未分章)', sections: [], content: '' };
          chapters.push(currentChapter);
        }
        currentSection = {
          title: cls.title,
          knowledge_points: [],
          content: '',
        };
        currentChapter.sections.push(currentSection);
        currentKnowledgePoint = null;
        break;
        
      case 'knowledge_point':
        flushContent();
        if (!currentSection) {
          if (!currentChapter) {
            currentChapter = { title: '(未分章)', sections: [], content: '' };
            chapters.push(currentChapter);
          }
          currentSection = { title: '(未分节)', knowledge_points: [], content: '' };
          currentChapter.sections.push(currentSection);
        }
        currentKnowledgePoint = {
          title: cls.title,
          name: cls.name,
          content: '',
        };
        currentSection.knowledge_points.push(currentKnowledgePoint);
        break;
        
      case 'example':
        contentBuffer.push('\n**' + line.trim() + '**');
        break;
        
      case 'analysis':
      case 'answer':
      case 'summary':
      case 'key_difficulty':
      case 'note':
        contentBuffer.push('\n*' + line.trim() + '*');
        break;
        
      case 'empty':
        if (contentBuffer.length > 0) contentBuffer.push('');
        break;
        
      case 'content':
      default:
        contentBuffer.push(line);
        break;
        
      case 'toc_skip':
        // 跳过目录行
        break;
    }
  }
  
  flushContent();
  
  return chapters;
}

// ============ 从文件名推断卷次 ============
function inferVolume(filename) {
  const name = filename.replace(/\.docx?$/i, '');
  
  // 选择性必修优先检测（避免被"必修"匹配）
  if (/选择性必修\s*[1一]/.test(name) || /选修\s*1/.test(name)) return 'selective_1';
  if (/选择性必修\s*[2二]/.test(name) || /选修\s*2/.test(name)) return 'selective_2';
  if (/选择性必修\s*[3三]/.test(name) || /选修\s*3/.test(name)) return 'selective_3';
  if (/必修\s*第一册|必修\s*[一1]/.test(name)) return 'required_1';
  if (/必修\s*第二册|必修\s*[二2]/.test(name)) return 'required_2';
  if (/必修\s*第三册|必修\s*[三3]/.test(name)) return 'required_3';
  if (/必修\s*第四册|必修\s*[四4]/.test(name)) return 'required_4';
  
  // 从内容推断
  if (/必修上/.test(name)) return 'required_1';
  if (/必修下/.test(name)) return 'required_2';
  
  return null;
}

// 从文件名推断教材标题
function inferTextbookTitle(filename, subject) {
  const cnSubject = SUBJECTS[subject];
  const vol = inferVolume(filename);
  const volInfo = vol ? VOLUME_CODES[vol] : null;
  
  if (volInfo) {
    return `${cnSubject} ${volInfo.label}`;
  }
  return `${cnSubject} 综合`;
}

// ============ 文档解析入口（同时支持 .docx 和 .doc） ============
const extractor = new WordExtractor();

async function parseDocx(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  try {
    if (ext === '.docx') {
      const result = await mammoth.extractRawText({ path: filePath });
      return result.value;
    } else if (ext === '.doc') {
      const result = await extractor.extract(filePath);
      return result.getBody();
    } else {
      console.error(`  [WARN] Unknown format: ${ext} - ${path.basename(filePath)}`);
      return null;
    }
  } catch (e) {
    console.error(`  [ERROR] Cannot parse ${path.basename(filePath)}: ${e.message.slice(0, 120)}`);
    return null;
  }
}

// ============ 主流程 ============
async function main() {
  console.log('=== 解析 DOCX/DOC 知识点文档 ===\n');
  
  // 读取资源索引
  const index = JSON.parse(fs.readFileSync(INDEX_FILE, 'utf-8'));
  
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  
  const results = {};
  let totalFiles = 0;
  let totalChapters = 0;
  let totalSections = 0;
  let totalKPs = 0;
  
  for (const [subject, resources] of Object.entries(index)) {
    console.log(`\n[${subject}] 开始解析...`);
    
    const textbooks = [];
    const summaries = resources.textbook_summaries || [];
    
    // 过滤优先处理新教材知识点归纳（排除"旧教材"和"(超详)"的旧版）
    const newTextbookFiles = summaries.filter(s => {
      const dir = s.source_dir || '';
      const name = s.filename;
      // 优先：来自"2022"目录 或 文件名含"新教材"
      // 排除：旧教材知识点归纳汇总 中的文件（这些就是现有数据源）
      if (dir.includes('旧教材')) return false;
      if (name.includes('（超详）')) return false; // 跳过旧版归纳
      return true;
    });
    
    // 按卷次分组
    const byVolume = {};
    for (const file of newTextbookFiles) {
      const vol = inferVolume(file.filename) || 'general';
      if (!byVolume[vol]) byVolume[vol] = [];
      byVolume[vol].push(file);
    }
    
    // 如果有"全册"大文件，优先用它；否则用分册文件
    for (const [vol, files] of Object.entries(byVolume)) {
      // 优先选最大的文件（通常内容最完整）
      files.sort((a, b) => (b.size || 0) - (a.size || 0));
      const bestFile = files[0];
      
      console.log(`  解析: ${bestFile.filename} (${(bestFile.size / 1024).toFixed(0)} KB)`);
      const text = await parseDocx(bestFile.path);
      if (!text) continue;
      
      const chapters = parseTextToStructure(text, bestFile.filename);
      const textbookTitle = inferTextbookTitle(bestFile.filename, subject);
      
      let secCount = 0, kpCount = 0;
      for (const ch of chapters) {
        secCount += ch.sections.length;
        for (const sec of ch.sections) {
          kpCount += sec.knowledge_points.length;
        }
      }
      
      textbooks.push({
        title: textbookTitle,
        volume: vol === 'general' ? null : vol,
        source_file: bestFile.filename,
        source_path: bestFile.path,
        chapters,
        stats: { chapters: chapters.length, sections: secCount, knowledge_points: kpCount },
      });
      
      totalFiles++;
      totalChapters += chapters.length;
      totalSections += secCount;
      totalKPs += kpCount;
      
      console.log(`    -> ${chapters.length} 章, ${secCount} 节, ${kpCount} 知识点`);
      
      // 如果有补充文件（同卷次的小文件），也解析并合并
      for (let fi = 1; fi < files.length; fi++) {
        if (files[fi].size < bestFile.size * 0.3) {
          console.log(`  补充: ${files[fi].filename} (${(files[fi].size / 1024).toFixed(0)} KB)`);
          const supText = await parseDocx(files[fi].path);
          if (supText) {
            const supChapters = parseTextToStructure(supText, files[fi].filename);
            // 合并到同一册次
            const existing = textbooks.find(t => t.volume === (vol === 'general' ? null : vol));
            if (existing) {
              existing.chapters.push(...supChapters);
              existing.stats.chapters += supChapters.length;
            }
          }
        }
      }
    }
    
    // 如果没有新教材文件，使用"更多知识点归纳"中的文件
    if (textbooks.length === 0) {
      const moreFiles = summaries.filter(s => {
        const dir = s.source_dir || '';
        return !dir.includes('旧教材') && !s.filename.includes('（超详）');
      });
      
      for (const file of moreFiles) {
        console.log(`  解析(补充): ${file.filename}`);
        const text = await parseDocx(file.path);
        if (!text) continue;
        
        const chapters = parseTextToStructure(text, file.filename);
        const vol = inferVolume(file.filename);
        
        textbooks.push({
          title: inferTextbookTitle(file.filename, subject),
          volume: vol,
          source_file: file.filename,
          source_path: file.path,
          chapters,
          stats: { chapters: chapters.length, sections: chapters.reduce((s, c) => s + c.sections.length, 0), knowledge_points: 0 },
        });
        
        totalFiles++;
        totalChapters += chapters.length;
      }
    }
    
    results[subject] = {
      subject_cn: SUBJECTS[subject],
      textbooks,
    };
    
    console.log(`  [${subject}] 共 ${textbooks.length} 册`);
  }
  
  // 保存解析结果
  for (const [subject, data] of Object.entries(results)) {
    const outFile = path.join(OUTPUT_DIR, `${subject}.json`);
    fs.writeFileSync(outFile, JSON.stringify(data, null, 2), 'utf-8');
  }
  
  console.log('\n=== 解析完成 ===');
  console.log(`  总文件数: ${totalFiles}`);
  console.log(`  总章节数: ${totalChapters}`);
  console.log(`  总小节数: ${totalSections}`);
  console.log(`  总知识点: ${totalKPs}`);
  console.log(`  输出目录: ${OUTPUT_DIR}`);
}

main().catch(console.error);
