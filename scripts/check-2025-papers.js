import { getDb } from '../api/core/db.js';
import { existsSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

const PROVINCE_DIR_MAP = {
  '北京高考': 'beijing', '上海高考': 'shanghai', '天津高考': 'tianjin',
  '山东高考': 'shandong', '广东高考': 'guangdong', '浙江高考': 'zhejiang',
  '江苏高考': 'jiangsu', '河南高考': 'henan', '四川高考': 'sichuan',
  '河北高考': 'hebei', '湖北高考': 'hubei', '湖南高考': 'hunan',
  '福建高考': 'fujian', '安徽高考': 'anhui', '辽宁高考': 'liaoning',
  '重庆高考': 'chongqing', '江西高考': 'jiangxi', '贵州高考': 'guizhou',
  '广西高考': 'guangxi', '云南高考': 'yunnan', '山西高考': 'shanxi',
  '陕西高考': 'shaanxi', '甘肃高考': 'gansu', '黑龙江高考': 'heilongjiang',
  '吉林高考': 'jilin', '内蒙古高考': 'neimenggu', '青海高考': 'qinghai',
  '宁夏高考': 'ningxia', '海南高考': 'hainan', '新疆高考': 'xinjiang',
  '西藏高考': 'xizang',
};

const REVERSE_PROVINCE_MAP = Object.fromEntries(Object.entries(PROVINCE_DIR_MAP).map(([k, v]) => [v, k]));

const SUBJECT_DIR_MAP = {
  chinese: '1.', math: '2.', english: '3.', physics: '4.',
  chemistry: '5.', biology: '6.', history: '7.', politics: '8.', geography: '9.'
};

async function run() {
  const db = await getDb();
  
  const subjects = ['chinese', 'history', 'politics', 'geography'];
  const year = 2025;
  
  for (const subject of subjects) {
    const res = await db.query(`SELECT id, province_code, paper_file_path FROM exam_papers 
                               WHERE year = $1 AND subject = $2 AND exam_level = 'gaokao'`, 
                               [year, subject]);
    
    for (const paper of res.rows) {
      const provinceDir = REVERSE_PROVINCE_MAP[paper.province_code];
      const subjectPrefix = SUBJECT_DIR_MAP[subject];
      
      const searchPath = join(ROOT, 'database', '高考真题', provinceDir, `${subjectPrefix} ${provinceDir}${SUBJECT_CN[subject]}2008-2025`);
      
      let actualPath = null;
      if (existsSync(searchPath)) {
        const files = readdirSync(searchPath);
        const targetFile = files.find(f => f.includes('2025') && !f.includes('解析') && !f.includes('答案') && (f.endsWith('.pdf') || f.endsWith('.docx')));
        if (targetFile) {
          actualPath = `database/高考真题/${provinceDir}/${subjectPrefix} ${provinceDir}${SUBJECT_CN[subject]}2008-2025/${targetFile}`;
        }
      }
      
      if (!actualPath) {
        const altPath = join(ROOT, 'database', '高考真题', provinceDir);
        if (existsSync(altPath)) {
          const files = readdirSync(altPath);
          for (const dir of files) {
            if (dir.includes(SUBJECT_CN[subject])) {
              const fullDir = join(altPath, dir);
              const subFiles = readdirSync(fullDir);
              const targetFile = subFiles.find(f => f.includes('2025') && !f.includes('解析') && !f.includes('答案') && (f.endsWith('.pdf') || f.endsWith('.docx')));
              if (targetFile) {
                actualPath = `database/高考真题/${provinceDir}/${dir}/${targetFile}`;
                break;
              }
            }
          }
        }
      }
      
      if (actualPath) {
        const fullPath = join(ROOT, actualPath);
        if (existsSync(fullPath)) {
          await db.query(`UPDATE exam_papers SET paper_file_path = $1 WHERE id = $2`, [actualPath, paper.id]);
          console.log(`修复: ${paper.id} ${paper.province_code} ${subject} -> ${actualPath}`);
        }
      }
    }
  }
  
  console.log('\n=== 修复完成 ===');
}

const SUBJECT_CN = {
  chinese: '语文', math: '数学', english: '英语',
  physics: '物理', chemistry: '化学', biology: '生物',
  politics: '政治', history: '历史', geography: '地理',
};

run().catch(console.error);