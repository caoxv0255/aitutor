const fs = require('fs');
const path = require('path');

function countFiles(dir, stats) {
  if (!fs.existsSync(dir)) return;
  
  const items = fs.readdirSync(dir);
  items.forEach(item => {
    if (item.startsWith('.') || item === 'node_modules') return;
    
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      countFiles(fullPath, stats);
    } else {
      const ext = path.extname(fullPath).toLowerCase();
      if (ext === '.pdf') {
        stats.pdf++;
      } else if (ext === '.docx' || ext === '.doc') {
        stats.doc++;
        stats.docFiles.push(fullPath);
      } else if (ext === '.mp3' || ext === '.wav') {
        stats.audio++;
      }
    }
  });
}

const baseDir = path.join('D:', 'Desktop', 'aitutor', 'database', '高考真题');
const stats = { pdf: 0, doc: 0, audio: 0, docFiles: [] };

console.log('扫描目录:', baseDir);
countFiles(baseDir, stats);

console.log('');
console.log(`PDF 文件: ${stats.pdf}`);
console.log(`DOCX/DOC 文件: ${stats.doc}`);
console.log(`音频文件: ${stats.audio}`);
console.log('');
console.log('需要转换的 DOCX/DOC 文件:');
stats.docFiles.slice(0, 20).forEach(f => {
  console.log('  ' + f.replace(baseDir, ''));
});
if (stats.docFiles.length > 20) {
  console.log(`  ... 还有 ${stats.docFiles.length - 20} 个`);
}