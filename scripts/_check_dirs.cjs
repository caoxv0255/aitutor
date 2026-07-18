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

async function check() {
  console.log('获取所有试卷...');
  const data = await fetchJson('http://localhost:3002/api/exam-papers?page_size=50');
  const papers = data.data;
  
  console.log('');
  console.log('打印几个试卷的paper_file_path:');
  papers.slice(0, 5).forEach(p => {
    console.log(`  [${p.id}] ${p.province_code} ${p.year} ${p.subject}: "${p.paper_file_path}"`);
  });
  
  // 检查北京高考目录
  console.log('');
  console.log('北京高考目录内容:');
  const beijingDir = path.join('D:', 'Desktop', 'aitutor', 'database', '高考真题', '北京高考');
  if (fs.existsSync(beijingDir)) {
    const dirs = fs.readdirSync(beijingDir);
    dirs.forEach(d => console.log('  ' + d));
  } else {
    console.log('  目录不存在');
  }
  
  // 检查山东高考目录
  console.log('');
  console.log('山东高考目录内容:');
  const shandongDir = path.join('D:', 'Desktop', 'aitutor', 'database', '高考真题', '山东高考');
  if (fs.existsSync(shandongDir)) {
    const dirs = fs.readdirSync(shandongDir);
    dirs.forEach(d => console.log('  ' + d));
  } else {
    console.log('  目录不存在');
  }
  
  // 检查database/高考真题下有什么
  console.log('');
  console.log('database/高考真题 目录内容:');
  const baseDir = path.join('D:', 'Desktop', 'aitutor', 'database', '高考真题');
  if (fs.existsSync(baseDir)) {
    const dirs = fs.readdirSync(baseDir);
    dirs.forEach(d => console.log('  ' + d));
  } else {
    console.log('  目录不存在');
  }
}

check().catch(e => console.error(e));