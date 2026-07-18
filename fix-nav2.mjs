import fs from 'fs';
const dir = 'd:\\Desktop\\aitutor\\ai-tutor-redesign\\pages\\';

const navMap = {
  'home.html': [
    ['首页', 'nav-home', 'home.html', true],
    ['学习驾驶舱', 'nav-dashboard', 'dashboard.html', false],
    ['模拟考场', 'nav-exam', 'exam-simulation.html', false],
    ['错题本', 'nav-wrong', 'wrong-book.html', false],
    ['AI讲题', 'nav-ai', 'ai-tutor-chat.html', false],
    ['学习旅程', 'nav-path', 'learning-journey.html', false],
  ],
  'home-exam.html': [
    ['首页', 'nav-home', 'home.html', true],
    ['学习驾驶舱', 'nav-dashboard', 'dashboard.html', false],
    ['模拟考场', 'nav-exam', 'exam-simulation.html', false],
    ['错题本', 'nav-wrong', 'wrong-book.html', false],
    ['AI讲题', 'nav-ai', 'ai-tutor-chat.html', false],
    ['学习旅程', 'nav-path', 'learning-journey.html', false],
  ],
  'home-report.html': [
    ['首页', 'nav-home', 'home.html', true],
    ['学习驾驶舱', 'nav-dashboard', 'dashboard.html', false],
    ['模拟考场', 'nav-exam', 'exam-simulation.html', false],
    ['错题本', 'nav-wrong', 'wrong-book.html', false],
    ['AI讲题', 'nav-ai', 'ai-tutor-chat.html', false],
    ['学习旅程', 'nav-path', 'learning-journey.html', false],
  ],
  'dashboard.html': [
    ['首页', 'nav-home', 'home.html', false],
    ['学习驾驶舱', 'nav-dashboard', 'dashboard.html', true],
    ['模拟考场', 'nav-exam', 'exam-simulation.html', false],
    ['错题本', 'nav-wrong', 'wrong-book.html', false],
    ['AI讲题', 'nav-ai', 'ai-tutor-chat.html', false],
    ['学习旅程', 'nav-path', 'learning-journey.html', false],
  ],
  'exam-simulation.html': [
    ['首页', 'nav-home', 'home.html', false],
    ['学习驾驶舱', 'nav-dashboard', 'dashboard.html', false],
    ['模拟考场', 'nav-exam', 'exam-simulation.html', true],
    ['错题本', 'nav-wrong', 'wrong-book.html', false],
    ['AI讲题', 'nav-ai', 'ai-tutor-chat.html', false],
    ['学习旅程', 'nav-path', 'learning-journey.html', false],
  ],
  'wrong-book.html': [
    ['首页', 'nav-home', 'home.html', false],
    ['学习驾驶舱', 'nav-dashboard', 'dashboard.html', false],
    ['模拟考场', 'nav-exam', 'exam-simulation.html', false],
    ['错题本', 'nav-wrong', 'wrong-book.html', true],
    ['AI讲题', 'nav-ai', 'ai-tutor-chat.html', false],
    ['学习旅程', 'nav-path', 'learning-journey.html', false],
  ],
  'ai-tutor-chat.html': [
    ['首页', 'nav-home', 'home.html', false],
    ['学习驾驶舱', 'nav-dashboard', 'dashboard.html', false],
    ['模拟考场', 'nav-exam', 'exam-simulation.html', false],
    ['错题本', 'nav-wrong', 'wrong-book.html', false],
    ['AI讲题', 'nav-ai', 'ai-tutor-chat.html', true],
    ['学习旅程', 'nav-path', 'learning-journey.html', false],
  ],
  'learning-journey.html': [
    ['首页', 'nav-home', 'home.html', false],
    ['学习驾驶舱', 'nav-dashboard', 'dashboard.html', false],
    ['模拟考场', 'nav-exam', 'exam-simulation.html', false],
    ['错题本', 'nav-wrong', 'wrong-book.html', false],
    ['AI讲题', 'nav-ai', 'ai-tutor-chat.html', false],
    ['学习旅程', 'nav-path', 'learning-journey.html', true],
  ],
};

function buildNavLinks(pageFile) {
  const items = navMap[pageFile] || navMap['home.html'];
  return items.map(([text, id, href, active]) =>
    '<li><a class="navbar-link' + (active ? ' active' : '') + '" href="' + href + '" data-dom-id="' + id + '">' + text + '</a></li>'
  ).join('\n          ');
}

const files = fs.readdirSync(dir).filter(f => f.endsWith('.html'));
for (const f of files) {
  let c = fs.readFileSync(dir + f, 'utf8');

  // Match <ul class="navbar-links ...>...</ul>
  const re = /(<ul\s+class="navbar-links[^"]*">)([\s\S]*?)(<\/ul>)/;
  const match = c.match(re);
  if (match) {
    const replacement = match[1] + '\n          ' + buildNavLinks(f) + '\n        ' + match[3];
    c = c.replace(match[0], replacement);
    fs.writeFileSync(dir + f, c);
    
    // Verify
    const verify = fs.readFileSync(dir + f, 'utf8');
    const hasDashboard = verify.includes('data-dom-id="nav-dashboard"');
    const hasWrong = verify.includes('data-dom-id="nav-wrong"');
    console.log(f + ': ' + (hasDashboard && hasWrong ? 'OK' : 'STILL MISSING'));
  } else {
    console.log(f + ': NO MATCH for navbar-links ul');
  }
}
