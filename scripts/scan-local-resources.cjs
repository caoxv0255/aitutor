/**
 * scan-local-resources.js
 * 扫描本地"预习复习资料大礼包"目录，建立资源索引
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const BASE_DIR = 'C:\\Users\\CaoXv\\Documents\\aitutor\\预习复习资料大礼包（高中）';
const OUTPUT_DIR = path.join(__dirname, '..', 'database', 'textbooks');
const INDEX_FILE = path.join(OUTPUT_DIR, 'resource-index.json');

// 学科关键词映射
const SUBJECT_KEYWORDS = {
  chemistry: ['化学'],
  history: ['历史'],
  geography: ['地理'],
  politics: ['政治'],
  math: ['数学'],
  physics: ['物理'],
  biology: ['生物', '生物学'],
  english: ['英语'],
  chinese: ['语文', '中文'],
};

// 册次关键词
const VOLUME_KEYWORDS = {
  required_1: ['必修 第一册', '必修一', '必修1', '必修第一册'],
  required_2: ['必修 第二册', '必修二', '必修2', '必修第二册'],
  required_3: ['必修 第三册', '必修三', '必修3', '必修第三册'],
  required_4: ['必修 第四册', '必修四', '必修4', '必修第四册'],
  selective_1: ['选择性必修 第一册', '选择性必修1', '选择性必修一', '选修1'],
  selective_2: ['选择性必修 第二册', '选择性必修2', '选择性必修二', '选修2'],
  selective_3: ['选择性必修 第三册', '选择性必修3', '选择性必修三', '选修3'],
};

// 年级关键词 (for 教材帮 zip structure)
const GRADE_KEYWORDS = {
  grade10: ['高一', '高1'],
  grade11: ['高二', '高2'],
  grade12: ['高三', '高3'],
};

function detectSubject(filename) {
  for (const [subject, keywords] of Object.entries(SUBJECT_KEYWORDS)) {
    for (const kw of keywords) {
      if (filename.includes(kw)) return subject;
    }
  }
  return null;
}

function detectVolume(filename) {
  for (const [vol, keywords] of Object.entries(VOLUME_KEYWORDS)) {
    for (const kw of keywords) {
      if (filename.includes(kw)) return vol;
    }
  }
  return null;
}

function detectGrade(filename) {
  for (const [grade, keywords] of Object.entries(GRADE_KEYWORDS)) {
    for (const kw of keywords) {
      if (filename.includes(kw)) return grade;
    }
  }
  return null;
}

function scanDir(dir, depth = 0, maxDepth = 5) {
  const results = [];
  if (depth > maxDepth) return results;
  try {
    const items = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
      const fullPath = path.join(dir, item.name);
      if (item.isDirectory()) {
        results.push({ path: fullPath, name: item.name, type: 'dir', depth });
        results.push(...scanDir(fullPath, depth + 1, maxDepth));
      } else {
        const ext = path.extname(item.name).toLowerCase();
        const stat = fs.statSync(fullPath);
        results.push({
          path: fullPath, name: item.name, type: 'file',
          ext, size: stat.size, depth,
        });
      }
    }
  } catch (e) {
    console.error(`  [WARN] Cannot scan: ${dir} - ${e.message}`);
  }
  return results;
}

// 解压 ZIP 文件到目标目录
function extractZip(zipPath, destDir) {
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
  try {
    // Use PowerShell Expand-Archive (built-in, no 7z needed)
    const cmd = `powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${destDir}' -Force"`;
    execSync(cmd, { timeout: 120000, stdio: 'pipe' });
    return true;
  } catch (e) {
    console.error(`  [WARN] Failed to extract: ${path.basename(zipPath)} - ${e.message.slice(0, 100)}`);
    return false;
  }
}

function main() {
  console.log('=== 扫描本地资源 ===');
  console.log(`Base: ${BASE_DIR}\n`);

  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const extractDir = path.join(OUTPUT_DIR, 'extracted');
  if (!fs.existsSync(extractDir)) fs.mkdirSync(extractDir, { recursive: true });

  // 初始化资源索引
  const index = {};
  for (const subject of Object.keys(SUBJECT_KEYWORDS)) {
    index[subject] = {
      textbook_summaries: [],  // P0: 新教材知识点归纳 (DOCX/DOC)
      jiaocaibang: [],         // P0: 教材帮 (PDF)
      yibentshu: null,         // P1: 一本涂书 (PDF)
      curriculum_standard: null,// P1: 课程标准 (PDF)
      review_lectures: [],     // P1: 一轮复习讲义
      passbook: [],            // P2: 通关宝典 (PDF)
      mindmaps: [],            // P2: 思维导图
      notes: null,             // P3: 学霸笔记 (PDF)
      extra: [],               // 其他补充
    };
  }

  // ====== 1. 扫描《高中新教材知识点归纳》 ======
  console.log('[1/7] 扫描《高中新教材知识点归纳》...');
  const xjcdDir = path.join(BASE_DIR, '《高中新教材知识点归纳》');
  if (fs.existsSync(xjcdDir)) {
    const files = scanDir(xjcdDir, 0, 3).filter(f => f.type === 'file');
    let docCount = 0;
    for (const f of files) {
      if (!['.docx', '.doc'].includes(f.ext)) continue;
      const subject = detectSubject(f.name);
      if (!subject) continue;
      const volume = detectVolume(f.name);
      index[subject].textbook_summaries.push({
        path: f.path,
        filename: f.name,
        size: f.size,
        volume: volume,
        source_dir: path.dirname(f.path).split(path.sep).pop(),
      });
      docCount++;
    }
    console.log(`  Found ${docCount} DOCX/DOC files across 9 subjects`);
  }

  // ====== 2. 扫描《教材帮》 ======
  console.log('[2/7] 扫描《教材帮》...');
  const jcbDir = path.join(BASE_DIR, '《教材帮》');
  if (fs.existsSync(jcbDir)) {
    // First level: direct PDFs
    const pdfs = fs.readdirSync(jcbDir).filter(f => f.toLowerCase().endsWith('.pdf'));
    for (const pdf of pdfs) {
      const subject = detectSubject(pdf);
      if (subject) {
        const volume = detectVolume(pdf);
        index[subject].jiaocaibang.push({
          path: path.join(jcbDir, pdf),
          filename: pdf,
          volume,
        });
      }
    }
    // ZIPs organized by grade
    const zips = fs.readdirSync(jcbDir).filter(f => f.toLowerCase().endsWith('.zip'));
    for (const zip of zips) {
      const subject = detectSubject(zip);
      const grade = detectGrade(zip);
      if (subject) {
        const zipPath = path.join(jcbDir, zip);
        const destDir = path.join(extractDir, 'jiaocaibang', `${grade || 'unknown'}_${subject}`);
        if (!fs.existsSync(destDir)) {
          console.log(`  Extracting: ${zip}`);
          extractZip(zipPath, destDir);
        }
        // Scan extracted contents
        if (fs.existsSync(destDir)) {
          const extracted = scanDir(destDir, 0, 2).filter(f => f.type === 'file' && ['.pdf', '.docx', '.doc'].includes(f.ext));
          for (const ef of extracted) {
            index[subject].jiaocaibang.push({
              path: ef.path,
              filename: ef.name,
              volume: detectVolume(ef.name),
              grade,
              extracted: true,
            });
          }
        }
      }
    }
    const totalJCB = Object.values(index).reduce((s, v) => s + v.jiaocaibang.length, 0);
    console.log(`  Found ${totalJCB} 教材帮 resources`);
  }

  // ====== 3. 扫描《一本涂书》 ======
  console.log('[3/7] 扫描《一本涂书》...');
  const ybsDir = path.join(BASE_DIR, '《一本涂书》');
  if (fs.existsSync(ybsDir)) {
    const pdfs = fs.readdirSync(ybsDir).filter(f => f.toLowerCase().endsWith('.pdf'));
    for (const pdf of pdfs) {
      const subject = detectSubject(pdf);
      if (subject) {
        index[subject].yibentshu = path.join(ybsDir, pdf);
      }
    }
    console.log(`  Found ${pdfs.length} PDF files`);
  }

  // ====== 4. 扫描《课程标准》 ======
  console.log('[4/7] 扫描《课程标准》...');
  const kbzDir = path.join(BASE_DIR, '《课程标准》');
  if (fs.existsSync(kbzDir)) {
    const pdfs = fs.readdirSync(kbzDir).filter(f => f.toLowerCase().endsWith('.pdf') && f.includes('普通高中'));
    for (const pdf of pdfs) {
      const subject = detectSubject(pdf);
      if (subject) {
        index[subject].curriculum_standard = path.join(kbzDir, pdf);
      }
    }
    console.log(`  Found ${pdfs.length} curriculum standard PDFs`);
  }

  // ====== 5. 扫描《2024一轮复习讲义》 ======
  console.log('[5/7] 扫描《2024一轮复习讲义》...');
  const ylfxDir = path.join(BASE_DIR, '《2024一轮复习讲义》');
  if (fs.existsSync(ylfxDir)) {
    const zips = fs.readdirSync(ylfxDir).filter(f => f.toLowerCase().endsWith('.zip'));
    for (const zip of zips) {
      const subject = detectSubject(zip);
      if (subject) {
        const zipPath = path.join(ylfxDir, zip);
        const destDir = path.join(extractDir, 'review', subject);
        if (!fs.existsSync(destDir)) {
          console.log(`  Extracting: ${zip}`);
          extractZip(zipPath, destDir);
        }
        if (fs.existsSync(destDir)) {
          const extracted = scanDir(destDir, 0, 2).filter(f => f.type === 'file' && ['.pdf', '.docx', '.doc'].includes(f.ext));
          for (const ef of extracted) {
            index[subject].review_lectures.push({
              path: ef.path, filename: ef.name, size: ef.size,
            });
          }
        }
      }
    }
    const totalReview = Object.values(index).reduce((s, v) => s + v.review_lectures.length, 0);
    console.log(`  Found ${totalReview} review lecture files`);
  }

  // ====== 6. 扫描《高中全科通关宝典》 ======
  console.log('[6/7] 扫描《高中全科通关宝典》...');
  const tgbDir = path.join(BASE_DIR, '《高中全科通关宝典》');
  if (fs.existsSync(tgbDir)) {
    const pdfs = fs.readdirSync(tgbDir).filter(f => f.toLowerCase().endsWith('.pdf'));
    for (const pdf of pdfs) {
      const subject = detectSubject(pdf);
      if (subject) {
        index[subject].passbook.push({ path: path.join(tgbDir, pdf), filename: pdf });
      }
    }
    console.log(`  Found ${pdfs.length} passbook PDFs`);
  }

  // ====== 7. 扫描《高中各科思维导图》+《清北学霸笔记》 ======
  console.log('[7/7] 扫描《高中各科思维导图》和《高中全科清北学霸笔记》...');
  const swdtDir = path.join(BASE_DIR, '《高中各科思维导图》');
  if (fs.existsSync(swdtDir)) {
    const pdfs = fs.readdirSync(swdtDir).filter(f => f.toLowerCase().endsWith('.pdf') && f.includes('高中') && f.includes('思维导图'));
    for (const pdf of pdfs) {
      const subject = detectSubject(pdf);
      if (subject) {
        index[subject].mindmaps.push({ path: path.join(swdtDir, pdf), filename: pdf });
      }
    }
  }
  const xxbjDir = path.join(BASE_DIR, '《高中全科清北学霸笔记》');
  if (fs.existsSync(xxbjDir)) {
    const pdfs = fs.readdirSync(xxbjDir).filter(f => f.toLowerCase().endsWith('.pdf'));
    for (const pdf of pdfs) {
      const subject = detectSubject(pdf);
      if (subject) {
        index[subject].notes = path.join(xxbjDir, pdf);
      }
    }
  }

  // ====== 输出索引 ======
  fs.writeFileSync(INDEX_FILE, JSON.stringify(index, null, 2), 'utf-8');
  console.log(`\n=== 资源索引已保存: ${INDEX_FILE} ===`);

  // 统计摘要
  console.log('\n=== 各学科资源统计 ===');
  for (const [subject, resources] of Object.entries(index)) {
    const counts = {
      textbook_summaries: resources.textbook_summaries.length,
      jiaocaibang: resources.jiaocaibang.length,
      yibentshu: resources.yibentshu ? 1 : 0,
      curriculum_standard: resources.curriculum_standard ? 1 : 0,
      review_lectures: resources.review_lectures.length,
      passbook: resources.passbook.length,
      mindmaps: resources.mindmaps.length,
      notes: resources.notes ? 1 : 0,
    };
    const total = Object.values(counts).reduce((s, v) => s + v, 0);
    console.log(`  ${subject.padEnd(12)} : ${total} resources | ${JSON.stringify(counts)}`);
  }
}

main();
