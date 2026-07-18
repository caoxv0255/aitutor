const fs = require('fs');
const path = require('path');

const filePath = '6. 北京高考生物2008-2025\\2025高考北京卷生物真题试卷（原卷版）.docx';
const provinceName = '北京高考';

const baseDirs = [
  path.join('database', '高考真题', provinceName),
  path.join('database', '高考真题'),
  'database',
  'uploads',
  '.'
];

console.log('搜索文件:', filePath);
console.log('');

let foundFilePath = null;
for (const baseDir of baseDirs) {
  const fullPath = path.join('D:', 'Desktop', 'aitutor', baseDir, filePath);
  const exists = fs.existsSync(fullPath);
  console.log(`${fullPath} -> ${exists}`);
  if (exists) {
    foundFilePath = fullPath;
    break;
  }
}

if (foundFilePath) {
  console.log('');
  console.log('找到文件:', foundFilePath);
  console.log('文件大小:', fs.statSync(foundFilePath).size);
  
  const answerFilePath = foundFilePath.replace('原卷版', '解析版');
  console.log('解析版路径:', answerFilePath);
  console.log('解析版存在:', fs.existsSync(answerFilePath));
} else {
  console.log('');
  console.log('文件未找到！');
}