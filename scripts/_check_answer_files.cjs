const fs = require('fs');
const path = require('path');
const http = require('http');

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

const PROVINCE_MAP = {
  'beijing': '北京高考', 'shanghai': '上海高考', 'tianjin': '天津高考', 'chongqing': '重庆高考',
  'hebei': '河北高考', 'shanxi': '山西高考', 'neimenggu': '内蒙古高考', 'liaoning': '辽宁高考',
  'jilin': '吉林高考', 'heilongjiang': '黑龙江高考', 'jiangsu': '江苏高考', 'zhejiang': '浙江高考',
  'anhui': '安徽高考', 'fujian': '福建高考', 'jiangxi': '江西高考', 'shandong': '山东高考',
  'henan': '河南高考', 'hubei': '湖北高考', 'hunan': '湖南高考', 'guangdong': '广东高考',
  'guangxi': '广西高考', 'hainan': '海南高考', 'sichuan': '四川高考', 'guizhou': '贵州高考',
  'yunnan': '云南高考', 'xizang': '西藏高考', 'shaanxi': '陕西高考', 'gansu': '甘肃高考',
  'qinghai': '青海高考', 'ningxia': '宁夏高考', 'xinjiang': '新疆高考'
};

function findFile(filePath, provinceCode) {
  const provinceName = PROVINCE_MAP[provinceCode] || provinceCode;
  const baseDirs = [
    path.join('database', '高考真题', provinceName),
    path.join('database', '高考真题'),
    'database', 'uploads', '.'
  ];
  for (const baseDir of baseDirs) {
    const fullPath = path.join('D:', 'Desktop', 'aitutor', baseDir, filePath);
    if (fs.existsSync(fullPath)) return fullPath;
  }
  return null;
}

async function check() {
  const data = await fetchJson('http://localhost:3002/api/exam-papers?page_size=200');
  const papers = data.data;
  
  let hasAnswerFile = 0;
  let noAnswerFile = 0;
  let answerFileMissing = [];
  
  papers.forEach(paper => {
    if (!paper.paper_file_path || paper.paper_file_path === 'undefined') return;
    
    const originalPath = paper.paper_file_path.trim();
    const found = findFile(originalPath, paper.province_code);
    if (!found) return;
    
    // 尝试找解析版/答案版文件
    const dir = path.dirname(found);
    const basename = path.basename(found);
    const ext = path.extname(found);
    const nameWithoutExt = basename.slice(0, -ext.length);
    
    let answerPath = null;
    
    // 尝试各种命名模式
    const patterns = [
      nameWithoutExt.replace('原卷版', '解析版') + ext,
      nameWithoutExt.replace('原卷版', '含解析版') + ext,
      nameWithoutExt.replace('空白卷', '解析卷') + ext,
      nameWithoutExt.replace('（原卷版）', '（解析版）') + ext,
    ];
    
    for (const p of patterns) {
      const full = path.join(dir, p);
      if (fs.existsSync(full)) {
        answerPath = full;
        break;
      }
    }
    
    if (answerPath) {
      hasAnswerFile++;
    } else {
      noAnswerFile++;
      answerFileMissing.push({
        province: paper.province_code,
        subject: paper.subject,
        year: paper.year,
        file: basename
      });
    }
  });
  
  console.log(`有解析版文件: ${hasAnswerFile}`);
  console.log(`无解析版文件: ${noAnswerFile}`);
  console.log('');
  
  if (answerFileMissing.length > 0) {
    console.log('找不到解析版的试卷 (前10个):');
    answerFileMissing.slice(0, 10).forEach(p => {
      console.log(`  ${p.province} ${p.year} ${p.subject}: ${p.file}`);
    });
  }
}

check().catch(e => console.error(e));