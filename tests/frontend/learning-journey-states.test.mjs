// 学习闭环页验收：六态 + 闭环总览/阶段/下一步（G8 映射）/薄弱点/分布 + 错误分类
// 规格出处：PM-BRIEF B.1:144-147（dev-only）/ SPEC-ROUTES:58
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const DIR = 'frontend-v2';
const html = fs.readFileSync(`${DIR}/learning-journey.html`, 'utf8');
const uiJs = fs.readFileSync(`${DIR}/assets/js/ui.js`, 'utf8');
const apiJs = fs.readFileSync(`${DIR}/assets/js/api.js`, 'utf8');
const subjectsJs = fs.readFileSync(`${DIR}/assets/js/subjects.js`, 'utf8');
const pageJs = fs.readFileSync(`${DIR}/assets/js/learning-journey.js`, 'utf8');

const inlined = html
  .replace(/<script src="[^"]*ui\.js"><\/script>/, `<script>${uiJs}</script>`)
  .replace(/<script src="[^"]*api\.js"><\/script>/, `<script>${apiJs}</script>`)
  .replace(/<script src="[^"]*subjects\.js"><\/script>/, `<script>${subjectsJs}</script>`)
  .replace(/<script src="[^"]*learning-journey\.js"><\/script>/, `<script>${pageJs}</script>`);

const dom = new JSDOM(inlined, {
  runScripts: 'dangerously',
  url: 'https://x.dev/learning-journey.html',
  pretendToBeVisual: true,
});
const { window } = dom;
window.fetch = () => Promise.reject(new Error('no network in test'));
window.localStorage.setItem('authToken', 'stub-token');
await new Promise((res) => window.addEventListener('load', res));

const P = window.LearningJourney;
const results = [];
const check = (name, got, want) => results.push({ ok: got === want, name, got, want });
const doc = window.document;
const $ = (id) => doc.getElementById(id);
const visible = () => doc.querySelectorAll('.state.is-on').length;
const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));

// 后端真实形状（AIAPI.request 已解包 data）：
// GET /api/analytics/learning-path → learning-path/current 同款
const PATH = {
  subject: 'math',
  global_progress_pct: 55,
  recommendation_reason: '基于近 30 天练习与 SM2 队列生成',
  stages: [
    { id: 's1', name: '诊断', status: 'completed', description: '拍照入库 12 题', progress_pct: 100 },
    { id: 's2', name: '专项练习', status: 'current', description: '薄弱点精练', progress_pct: 40 },
    { id: 's3', name: '综合应用', status: 'pending', description: '', progress_pct: 0 },
    { id: 's4', name: '冲刺', status: 'pending', description: '', progress_pct: 0 },
  ],
  today_task: { id: 't1', title: '导数与切线 · 精练 5 题', target_url: '/review.html?kp=kp1' },
};
// GET /api/loop/summary → loop/routes.js:188 data
const SUMMARY = {
  date: '2026-09-22',
  streak_days: 5,
  stats: {
    overall_score: 78, overall_score_delta: 0,
    weak_points_total: 24, weak_points_delta: 0,
    today_questions_done: 12, today_questions_target: 40,
    today_minutes_done: 25, today_minutes_target: 60,
  },
  subject_distribution: [
    { subject: '数学', subject_code: 'math', count: 12, level: 'high' },
    { subject: '英语', subject_code: 'english', count: 4, level: 'mid' },
  ],
  hot_kps: [
    { kp_id: 'kp1', name: '导数与切线', subject: '数学', subject_code: 'math', weight: 8.4, mastery_score: 40 },
  ],
  next_actions: [
    { id: 'na_001', kind: 'start_practice', title: '开始今日练习', desc: '10 道精选题', href: '/f3/pages/exam-simulation.html?mode=today' },
    { id: 'na_003', kind: 'ai_tutor', title: 'AI 讲题', desc: '拍照或文字提问', href: '/f3/pages/tutor.html' },
  ],
  today_tasks: [],
};

let lastPaths = [];
window.AIAPI.request = (path) => {
  lastPaths.push(path);
  if (path === '/api/analytics/learning-path') return Promise.resolve(PATH);
  if (path === '/api/loop/summary') return Promise.resolve(SUMMARY);
  return Promise.resolve({});
};

// 1. 六态面板齐备且互斥
const panels = [...doc.querySelectorAll('[data-state]')].map((n) => n.getAttribute('data-state'));
check('六态面板', panels.sort().join(','), P.STATES.slice().sort().join(','));
for (const s of P.STATES) {
  P.setState(s);
  check(`setState(${s})`, P.getState(), s);
  check(`setState(${s}) 互斥`, visible(), 1);
}

// 2. 无 token → auth
window.localStorage.removeItem('authToken');
await P.load();
check('无 token → auth', P.getState(), 'auth');
window.localStorage.setItem('authToken', 'stub-token');

// 3. 离线 → offline 且不发请求
Object.defineProperty(window.navigator, 'onLine', { value: false, configurable: true });
let calls = 0;
window.AIAPI.request = () => {
  calls += 1;
  return Promise.resolve({});
};
await P.load();
check('离线 → offline', P.getState(), 'offline');
check('离线不发请求', calls, 0);
Object.defineProperty(window.navigator, 'onLine', { value: true, configurable: true });

// 4. SPEC-ROUTES:58 的两个端点都被请求
window.AIAPI.request = (path) => {
  lastPaths.push(path);
  if (path === '/api/analytics/learning-path') return Promise.resolve(PATH);
  if (path === '/api/loop/summary') return Promise.resolve(SUMMARY);
  return Promise.resolve({});
};
lastPaths = [];
await P.load();
check('成功态', P.getState(), 'success');
check('请求 analytics/learning-path', lastPaths.includes('/api/analytics/learning-path'), true);
check('请求 loop/summary', lastPaths.includes('/api/loop/summary'), true);

// 5. 闭环总览统计
check('stat 格子 4 个', doc.querySelectorAll('#loop-stats .stat-cell').length, 4);
check('综合得分 78', /78/.test(doc.querySelector('#loop-stats .stat-cell').textContent), true);
check('薄弱点 24', /24/.test(doc.querySelector('#loop-stats').textContent), true);

// 6. 路径阶段 4 个 + 状态语义
check('阶段 4 个', doc.querySelectorAll('#stage-list .stage').length, 4);
check('已完成阶段标记', doc.querySelectorAll('#stage-list .stage--completed').length, 1);
check('进行中阶段标记', doc.querySelectorAll('#stage-list .stage--current').length, 1);
check('推荐语透传', $('path-reason').textContent, '基于近 30 天练习与 SM2 队列生成');

// 7. G8 映射：认识的旧树 URL → 新树；不认识的 → 不可点文字
const actionLinks = [...doc.querySelectorAll('#action-list a')];
check('可跳转 1 条（exam-simulation → practice-hub）', actionLinks.length, 1);
check('映射到新树', actionLinks[0].getAttribute('href'), '/practice-hub.html?mode=today');
check(
  '不认识的 URL 渲染为文字不放死链',
  /尚未在新版提供/.test(doc.querySelector('#action-list').textContent) &&
    !doc.querySelector('#action-list a[href*="tutor"]'),
  true
);
check('resolveTarget 直接可复用', P.resolveTarget('/f3/pages/wrong-book.html'), '/wrong-book.html');
check('resolveTarget 保留 query', P.resolveTarget('/review.html?kp=kp1'), '/review-session.html?kp=kp1');
check('resolveTarget 未知返回 null', P.resolveTarget('/f3/pages/tutor.html'), null);

// 8. 薄弱点与学科分布
check('薄弱知识点 1 行', doc.querySelectorAll('#kp-list .topic-row').length, 1);
check('薄弱指数渲染', /8.4/.test($('kp-list').textContent), true);
check('学科分布 2 行', doc.querySelectorAll('#dist-list .dist-row').length, 2);
check('分布条已设宽', doc.querySelector('#dist-list .bar-fill').style.width, '75%');

// 9. 学习路径自带空态 → 页面空态透传
window.AIAPI.request = (path) => {
  if (path === '/api/analytics/learning-path') {
    return Promise.resolve({ empty_state: { scenario: 'no_data', title: '先拍第一题', description: '拍一道题入库后这里会出现闭环。' } });
  }
  return Promise.resolve(SUMMARY);
};
await P.load();
check('empty_state → 页面空态', P.getState(), 'empty');
check('空态标题透传', $('empty-title').textContent, '先拍第一题');
check('空态文案透传', $('empty-copy').textContent, '拍一道题入库后这里会出现闭环。');

// 10. 加载失败分类
window.AIAPI.request = () => Promise.reject(window.AIAPI.ApiError('获取闭环数据失败', { status: 500 }));
await P.load();
check('加载 500 → error', P.getState(), 'error');
check('加载 500 文案透传', $('error-copy').textContent, '获取闭环数据失败');
window.AIAPI.request = () => Promise.reject(window.AIAPI.ApiError('未授权', { status: 401 }));
await P.load();
check('加载 401 → auth', P.getState(), 'auth');
window.AIAPI.request = () => Promise.reject(window.AIAPI.ApiError('网络连接不可用', { kind: 'network' }));
await P.load();
check('加载网络失败 → offline', P.getState(), 'offline');

for (const r of results) {
  console.log(
    `${r.ok ? 'OK  ' : 'FAIL'} ${r.name.padEnd(32)} 实际=${JSON.stringify(r.got)}` + (r.ok ? '' : ` 期望=${JSON.stringify(r.want)}`)
  );
}
const bad = results.filter((r) => !r.ok).length;
console.log(bad ? `\n❌ ${bad} 项不符` : `\n✅ ${results.length} 项全部通过`);
process.exit(bad ? 1 : 0);
