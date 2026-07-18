import fs from 'fs';
const dir = 'd:\\Desktop\\aitutor\\ai-tutor-redesign\\pages\\';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.html'));
const linkTag = '<link rel="stylesheet" href="../assets/enhancements.css">';

function makeBottomNav(f) {
  const a = (href, label, svg) => `<a href="${href}" class="bottom-nav-item${f===href?' active':''}">${svg}\n        <span>${label}</span>\n      </a>`;
  return `\n    <nav class="bottom-nav">\n      ${a('home.html','首页','<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>')}\n      ${a('exam-simulation.html','做题','<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>')}\n      ${a('wrong-book.html','错题','<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/></svg>')}\n      ${a('ai-tutor-chat.html','AI讲题','<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>')}\n      ${a('dashboard.html','我的','<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>')}\n    </nav>\n    <div class="bottom-nav-spacer"></div>`;
}

for (const f of files) {
  let c = fs.readFileSync(dir + f, 'utf8');
  if (!c.includes('enhancements.css')) {
    c = c.replace(/(<link rel="stylesheet" href="[^"]*components\.css">)/, '$1\n    ' + linkTag);
  }
  if (!c.includes('bottom-nav')) {
    c = c.replace('</body>', makeBottomNav(f) + '\n</body>');
  }
  fs.writeFileSync(dir + f, c);
  console.log(f + ': enhanced');
}
console.log('All done');
