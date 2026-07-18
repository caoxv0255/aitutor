import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import { env } from 'process';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

dotenv.config({ path: path.join(ROOT, '.env') });

const { Pool } = pg;

const SUBJECT_MAP = {
  chinese: { name: '语文', dir: '1. 北京高考语文2008-2025' },
  math: { name: '数学', dir: '2. 北京高考数学2008-2025' },
  english: { name: '英语', dir: '3. 北京高考英语2008-2025' },
  physics: { name: '物理', dir: '4. 北京高考物理2008-2025' },
  chemistry: { name: '化学', dir: '5. 北京高考化学2008-2025' },
  biology: { name: '生物', dir: '6. 北京高考生物2008-2025' },
  history: { name: '历史', dir: '7. 北京高考历史2008-2025' },
  politics: { name: '政治', dir: '8. 北京高考政治2008-2025' },
  geography: { name: '地理', dir: '9. 北京高考地理2008-2025' }
};

const BASE_DATA_DIR = path.join(ROOT, 'database', 'question-bank');

function getQuestionCount(subject, year) {
  const dir = path.join(BASE_DATA_DIR, subject, year.toString());
  if (!fs.existsSync(dir)) return 0;
  const questionDirs = fs.readdirSync(dir).filter(d => 
    fs.statSync(path.join(dir, d)).isDirectory() && /^\d{3}$/.test(d)
  );
  return questionDirs.length;
}

function needsRetry(subject, year) {
  const count = getQuestionCount(subject, year);
  const expectedMin = {
    chinese: 20, math: 20, english: 10,
    physics: 15, chemistry: 15, biology: 15,
    history: 15, geography: 15, politics: 15
  };
  return count < expectedMin[subject] || count === 0;
}

async function main() {
  console.log('============================================================');
  console.log('🔄 重试缺失试卷处理');
  console.log('============================================================');

  const dbUrl = env.DATABASE_URL || 'postgresql://postgres:cxclementine102365@localhost:5432/aitutor';
  const url = new URL(dbUrl);
  
  const pool = new Pool({
    host: url.hostname,
    port: parseInt(url.port || '5432'),
    user: url.username,
    password: url.password,
    database: url.pathname.substring(1),
    max: 10
  });
  
  await pool.query('SELECT 1');
  console.log('✅ PostgreSQL 数据库连接成功');

  const years = [2019, 2020, 2021, 2022, 2023];
  const subjects = Object.keys(SUBJECT_MAP);
  
  const missingPapers = [];
  
  for (const subject of subjects) {
    for (const year of years) {
      if (needsRetry(subject, year)) {
        missingPapers.push({ subject, year, current_count: getQuestionCount(subject, year) });
      }
    }
  }

  console.log(`\n发现 ${missingPapers.length} 份需要重试的试卷:`);
  missingPapers.forEach(p => {
    console.log(`  - ${SUBJECT_MAP[p.subject].name} ${p.year}年 (当前: ${p.current_count}题)`);
  });

  if (missingPapers.length === 0) {
    console.log('🎉 所有试卷数据完整，无需重试');
    await pool.end();
    return;
  }

  console.log('\n开始重试处理...');
  
  const { processSinglePaper, generatePaperIndex, generateIndexPage } = await import('./parse-pdf-pipeline.js');
  
  for (const { subject, year } of missingPapers) {
    await new Promise(r => setTimeout(r, 3000));
    const result = await processSinglePaper(subject, year, pool);
    if (result.success) {
      console.log(`✅ ${SUBJECT_MAP[subject].name} ${year}年 处理成功: ${result.question_count}题`);
    } else {
      console.log(`❌ ${SUBJECT_MAP[subject].name} ${year}年 处理失败: ${result.error}`);
    }
  }

  await pool.end();

  console.log('\n📊 生成索引页面...');
  generateIndexPage();
  for (const subject of subjects) {
    for (const year of years) {
      generatePaperIndex(subject, year);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 重试结果汇总');
  console.log('='.repeat(60));

  let successCount = 0;
  for (const { subject, year } of missingPapers) {
    const count = getQuestionCount(subject, year);
    const status = count > 0 ? '✅' : '❌';
    if (count > 0) successCount++;
    console.log(`${status} ${SUBJECT_MAP[subject].name} ${year}年: ${count}题`);
  }

  console.log(`\n成功: ${successCount}/${missingPapers.length}`);
  console.log(`📁 数据目录: ${BASE_DATA_DIR}`);
}

if (import.meta.url === `file://${process.argv[1]}` || import.meta.url.replace('\\', '/').endsWith(path.basename(__filename))) {
  main().catch(console.error);
}