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
    'database',
    'uploads',
    '.'
  ];

  for (const baseDir of baseDirs) {
    const fullPath = path.join('D:', 'Desktop', 'aitutor', baseDir, filePath);
    if (fs.existsSync(fullPath)) {
      return fullPath;
    }
  }

  return null;
}

async function checkAllPapers() {
  console.log('获取所有试卷...');
  const data = await fetchJson('http://localhost:3002/api/exam-papers?page_size=200');
  const papers = data.data;
  
  console.log(`共 ${papers.length} 份试卷`);
  console.log('');
  
  let withFile = 0;
  let withoutFile = 0;
  let pdfFiles = 0;
  let docxFiles = 0;
  let missingFiles = [];
  
  papers.forEach(paper => {
    if (paper.paper_file_path && paper.paper_file_path.trim() && paper.paper_file_path !== 'undefined') {
      const found = findFile(paper.paper_file_path.trim(), paper.province_code);
      if (found) {
        withFile++;
        if (found.toLowerCase().endsWith('.pdf')) pdfFiles++;
        if (found.toLowerCase().endsWith('.docx') || found.toLowerCase().endsWith('.doc')) docxFiles++;
      } else {
        withoutFile++;
        missingFiles.push({
          id: paper.id,
          province: paper.province_code,
          year: paper.year,
          subject: paper.subject,
          path: paper.paper_file_path.trim()
        });
      }
    } else {
      withoutFile++;
    }
  });
  
  console.log(`有文件: ${withFile} (PDF: ${pdfFiles}, DOCX: ${docxFiles})`);
  console.log(`无文件: ${withoutFile}`);
  console.log('');
  
  if (missingFiles.length > 0) {
    console.log('找不到文件的试卷 (前10个):');
    missingFiles.slice(0, 10).forEach(p => {
      console.log(`  [${p.id}] ${p.province} ${p.year} ${p.subject}: ${p.path}`);
    });
    if (missingFiles.length > 10) {
      console.log(`  ... 还有 ${missingFiles.length - 10} 份`);
    }
  }
  
  // 按省份统计
  const byProvince = {};
  papers.forEach(p => {
    const key = p.province_code || 'unknown';
    if (!byProvince[key]) byProvince[key] = { total: 0, withFile: 0 };
    byProvince[key].total++;
    if (p.paper_file_path && p.paper_file_path.trim() && p.paper_file_path !== 'undefined' && findFile(p.paper_file_path.trim(), p.province_code)) {
      byProvince[key].withFile++;
    }
  });
  
  console.log('');
  console.log('按省份统计:');
  Object.keys(byProvince).sort().forEach(prov => {
    const s = byProvince[prov];
    console.log(`  ${prov}: ${s.withFile}/${s.total}`);
  });
}

checkAllPapers().catch(e => console.error(e));