const fs = require('fs');
const path = require('path');

const provinces = ['北京高考', '山东高考', '安徽高考'];
const subjects = ['语文', '数学', '英语', '物理', '化学', '生物'];

provinces.forEach(prov => {
  console.log(`\n=== ${prov} ===`);
  const provDir = path.join('D:', 'Desktop', 'aitutor', 'database', '高考真题', prov);
  if (!fs.existsSync(provDir)) {
    console.log('  目录不存在');
    return;
  }
  
  const dirs = fs.readdirSync(provDir).filter(d => !d.startsWith('.') && !d.startsWith('10.'));
  dirs.slice(0, 3).forEach(dir => {
    const subDir = path.join(provDir, dir);
    if (fs.statSync(subDir).isDirectory()) {
      console.log(`  ${dir}:`);
      const files = fs.readdirSync(subDir).slice(0, 5);
      files.forEach(f => console.log(`    ${f}`));
    }
  });
});