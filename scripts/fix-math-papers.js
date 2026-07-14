import { getDb } from '../api/core/db.js';
import { existsSync, readdirSync } from 'fs';
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

async function run() {
  const db = await getDb();
  
  let updateCount = 0;
  let insertCount = 0;
  
  for (const [provinceDir, provinceCode] of Object.entries(PROVINCE_DIR_MAP)) {
    const searchPath = join(ROOT, 'database', '高考真题', provinceDir);
    if (!existsSync(searchPath)) continue;
    
    const dirs = readdirSync(searchPath);
    const mathDir = dirs.find(d => d.includes('数学'));
    if (!mathDir) continue;
    
    const mathPath = join(searchPath, mathDir);
    const files = readdirSync(mathPath);
    
    for (let year = 2008; year <= 2025; year++) {
      const yearStr = year.toString();
      
      const artsFile = files.find(f => f.includes(yearStr) && f.includes('文科') && !f.includes('解析') && (f.endsWith('.pdf') || f.endsWith('.doc') || f.endsWith('.docx')));
      const scienceFile = files.find(f => f.includes(yearStr) && f.includes('理科') && !f.includes('解析') && (f.endsWith('.pdf') || f.endsWith('.doc') || f.endsWith('.docx')));
      const unifiedFile = files.find(f => f.includes(yearStr) && !f.includes('解析') && !f.includes('文科') && !f.includes('理科') && (f.endsWith('.pdf') || f.endsWith('.doc') || f.endsWith('.docx')));
      
      if (year <= 2019 && artsFile && scienceFile) {
        const artsPath = `database/高考真题/${provinceDir}/${mathDir}/${artsFile}`;
        const sciencePath = `database/高考真题/${provinceDir}/${mathDir}/${scienceFile}`;
        
        const existing = await db.query(`
          SELECT id, math_type FROM exam_papers 
          WHERE province_code = $1 AND year = $2 AND subject = 'math' AND exam_level = 'gaokao'
        `, [provinceCode, year]);
        
        if (existing.rows.length === 0) {
          await db.query(`
            INSERT INTO exam_papers (province_code, year, subject, exam_level, paper_file_path, math_type)
            VALUES ($1, $2, 'math', 'gaokao', $3, 'arts'), ($1, $2, 'math', 'gaokao', $4, 'science')
          `, [provinceCode, year, artsPath, sciencePath]);
          insertCount += 2;
          console.log(`新增: ${provinceCode} ${year} arts + science`);
        } else if (existing.rows.length === 1) {
          const existingId = existing.rows[0].id;
          await db.query(`
            UPDATE exam_papers SET paper_file_path = $1, math_type = 'arts' WHERE id = $2
          `, [artsPath, existingId]);
          await db.query(`
            INSERT INTO exam_papers (province_code, year, subject, exam_level, paper_file_path, math_type)
            VALUES ($1, $2, 'math', 'gaokao', $3, 'science')
          `, [provinceCode, year, sciencePath]);
          updateCount++;
          insertCount++;
          console.log(`更新+新增: ${provinceCode} ${year} arts -> arts + science`);
        } else {
          for (const row of existing.rows) {
            let targetPath = null;
            let targetType = null;
            if (row.math_type === 'arts' || row.math_type === null) {
              targetPath = artsPath;
              targetType = 'arts';
            } else if (row.math_type === 'science') {
              targetPath = sciencePath;
              targetType = 'science';
            }
            if (targetPath) {
              await db.query(`UPDATE exam_papers SET paper_file_path = $1, math_type = $2 WHERE id = $3`, 
                            [targetPath, targetType, row.id]);
              updateCount++;
            }
          }
        }
      } else if ((year > 2019 || unifiedFile) && !artsFile && !scienceFile) {
        const targetFile = unifiedFile || artsFile || scienceFile;
        if (!targetFile) continue;
        
        const targetPath = `database/高考真题/${provinceDir}/${mathDir}/${targetFile}`;
        
        const existing = await db.query(`
          SELECT id FROM exam_papers 
          WHERE province_code = $1 AND year = $2 AND subject = 'math' AND exam_level = 'gaokao'
        `, [provinceCode, year]);
        
        if (existing.rows.length > 0) {
          await db.query(`
            UPDATE exam_papers SET paper_file_path = $1, math_type = 'unified' 
            WHERE province_code = $2 AND year = $3 AND subject = 'math' AND exam_level = 'gaokao'
          `, [targetPath, provinceCode, year]);
          updateCount++;
        }
      }
    }
  }
  
  console.log('\n=== 完成 ===');
  console.log(`更新: ${updateCount} 条`);
  console.log(`新增: ${insertCount} 条`);
}

run().catch(console.error);