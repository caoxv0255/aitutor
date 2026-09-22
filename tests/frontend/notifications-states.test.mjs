// 通知中心验收：六态 + 类型筛选 + feed 渲染 + actions 死链防护 + 错误分类
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const DIR = 'frontend-v2';
const html = fs.readFileSync(`${DIR}/notifications.html`, 'utf8');
const uiJs = fs.readFileSync(`${DIR}/assets/js/ui.js`, 'utf8');
const apiJs = fs.readFileSync(`${DIR}/assets/js/api.js`, 'utf8');
const subjectsJs = fs.readFileSync(`${DIR}/assets/js/subjects.js`, 'utf8');
const pageJs = fs.readFileSync(`${DIR}/assets/js/notifications.js`, 'utf8');

const inlined = html
  .replace(/<script src="[^"]*ui\.js"><\/script>/, `<script>${uiJs}</script>`)
  .replace(/<script src="[^"]*api\.js"><\/script>/, `<script>${apiJs}</script>`)
  .replace(/<script src="[^"]*subjects\.js"><\/script>/, `<script>${subjectsJs}</script>`)
  .replace(/<script src="[^"]*notifications\.js"><\/script>/, `<script>${pageJs}</script>`);

const dom = new JSDOM(inlined, {
  runScripts: 'dangerously',
  url: 'https://x.dev/notifications.html',
  pretendToBeVisual: true,
});
const { window } = dom;
window.fetch = () => Promise.reject(new Error('no network in test'));
window.localStorage.setItem('authToken', 'stub-token');
await new Promise((res) => window.addEventListener('load', res));

const N = window.Notifications;
const results = [];
const check = (name, got, want) => results.push({ ok: got === want, name, got, want });
const doc = window.document;
const $ = (id) => doc.getElementById(id);
const visible = () => doc.querySelectorAll('.state.is-on').length;
const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));

// 后端真实形状：GET /api/loop/feed → { data:{ items:[…] } }（api/modules/loop/routes.js:232）
const FEED = {
  items: [
    { id: 'review-2', kind: 'review', subject: null, text: '复习完成: 导数与切线', ts: '2026-09-22T08:00:00Z', time: '16:00' },
    { id: 'wrong-1', kind: 'wrong', subject: 'math', text: '加入错题: 三角函数图像', ts: '2026-09-22T06:30:00Z', time: '14:30' },
    { id: 'wrong-2', kind: 'wrong', subject: 'physics', text: '加入错题: 电磁感应', ts: '2026-09-22T05:00:00Z', time: '13:00' },
  ],
};
// GET /api/loop/actions → buildNextActions()（routes.js:58）
const ACTIONS = [
  { id: 'na_001', kind: 'start_practice', title: '开始今日练习', desc: '10 道精选题', href: '/f3/pages/exam-simulation.html?mode=today' },
  { id: 'na_002', kind: 'generate_paper', title: '生成预测卷', desc: '按薄弱点组卷', href: '/f3/pages/personalized-paper.html' },
  { id: 'na_005', kind: 'photo', title: '拍照解题', desc: '拍照上传解析', href: '/f3/pages/vision.html' },
];

let lastPath = '';
let feedPath = '';
window.AIAPI.request = (path) => {
  lastPath = path;
  if (path.startsWith('/api/loop/feed')) {
    feedPath = path;
    return Promise.resolve({ data: FEED });
  }
  if (path === '/api/loop/actions') return Promise.resolve({ data: ACTIONS });
  return Promise.resolve({ data: [] });
};

// 1. 六态面板齐备且互斥
const panels = [...doc.querySelectorAll('[data-state]')].map((n) => n.getAttribute('data-state'));
check('六态面板', panels.sort().join(','), N.STATES.slice().sort().join(','));
for (const s of N.STATES) {
  N.setState(s);
  check(`setState(${s})`, N.getState(), s);
  check(`setState(${s}) 互斥`, visible(), 1);
}

// 2. 无 token → auth
window.localStorage.removeItem('authToken');
await N.load();
check('无 token → auth', N.getState(), 'auth');
window.localStorage.setItem('authToken', 'stub-token');

// 3. 离线 → offline 且不发请求
Object.defineProperty(window.navigator, 'onLine', { value: false, configurable: true });
let calls = 0;
window.AIAPI.request = () => {
  calls += 1;
  return Promise.resolve({ data: FEED });
};
await N.load();
check('离线 → offline', N.getState(), 'offline');
check('离线不发请求', calls, 0);
Object.defineProperty(window.navigator, 'onLine', { value: true, configurable: true });

// 4. feed 请求带 limit，正常加载 → success
window.AIAPI.request = (path) => {
  lastPath = path;
  if (path.startsWith('/api/loop/feed')) {
    feedPath = path;
    return Promise.resolve({ data: FEED });
  }
  if (path === '/api/loop/actions') return Promise.resolve({ data: ACTIONS });
  return Promise.resolve({ data: [] });
};
await N.load();
await tick(0);
check('feed 路径带 limit', feedPath, '/api/loop/feed?limit=20');
check('有 feed → success', N.getState(), 'success');

// 5. feed 渲染：全部 3 条、kind 标签与学科名
check('feed 条数', $('feed-list').children.length, 3);
check(
  'feed 文案顺序（ts 倒序）',
  [...$('feed-list').querySelectorAll('.stage-name')].map((n) => n.textContent).join('|'),
  '复习完成: 导数与切线|加入错题: 三角函数图像|加入错题: 电磁感应'
);
check('学科中文名来自 AISubjects', /数学/.test($('feed-list').textContent), true);
check('review 节点绿色标记', $('feed-list').querySelectorAll('.stage--completed').length, 1);

// 6. 类型筛选：只按真实 kind 提供 tab（缺口：5 类通知无后端）
const tabKinds = [...doc.querySelectorAll('#kind-tabs .tab')].map((b) => b.dataset.kind).join(',');
check('筛选 tab 只按真实 kind', tabKinds, 'all,wrong,review');
N.setKind('wrong');
check('setKind(wrong) 当前', N.getKind(), 'wrong');
check('wrong 筛选条数', $('feed-list').children.length, 2);
N.setKind('review');
check('review 筛选条数', $('feed-list').children.length, 1);
N.setKind('all');
check('setKind(all) 恢复', $('feed-list').children.length, 3);

// 7. 无任何通知 → empty 态
window.AIAPI.request = (path) => {
  if (path.startsWith('/api/loop/feed')) return Promise.resolve({ data: { items: [] } });
  return Promise.resolve({ data: ACTIONS });
};
N.setKind('all');
await N.load();
check('无任何通知 → empty', N.getState(), 'empty');
check('空态文案', /暂无通知|没有新消息/.test($('empty-copy').textContent), true);
window.AIAPI.request = (path) => {
  if (path.startsWith('/api/loop/feed')) return Promise.resolve({ data: FEED });
  return Promise.resolve({ data: ACTIONS });
};
await N.load();
N.setKind('review');
// 用真实数据 + 只剩 wrong 的场景：直接重载只有 wrong 的 feed
window.AIAPI.request = (path) => {
  if (path.startsWith('/api/loop/feed')) {
    return Promise.resolve({ data: { items: FEED.items.filter((i) => i.kind === 'wrong') } });
  }
  return Promise.resolve({ data: ACTIONS });
};
await N.load();
N.setKind('review');
check('筛选空 → 仍是 success 态', N.getState(), 'success');
check('筛选空 → 行内提示', /该类型下暂时没有动态/.test($('feed-list').textContent), true);
N.setKind('all');

// 9. actions 渲染：认识的 URL 映射新树，不认识的不可点（G8）
const cards = [...$('actions-grid').querySelectorAll('.pick-card')];
check('actions 卡片数', cards.length, 3);
const practiceCard = cards.find((c) => c.textContent === '开始今日练习');
check('认识的 URL → 新树链接', practiceCard.getAttribute('href'), '/practice-hub.html');
const paperCard = cards.find((c) => c.textContent === '生成预测卷');
check('不认识的 URL → 不可点', paperCard.tagName, 'SPAN');
check('不认识的 URL 无 href', paperCard.getAttribute('href'), null);
check('不可点卡片带锁定样式', paperCard.classList.contains('pick-card--locked'), true);

// 10. actions 失败不拖垮整页
window.AIAPI.request = (path) => {
  if (path.startsWith('/api/loop/feed')) return Promise.resolve({ data: FEED });
  return Promise.reject(window.AIAPI.ApiError('获取行动列表失败', { status: 500 }));
};
await N.load();
check('actions 失败 → 仍 success', N.getState(), 'success');

// 11. feed 失败分类
window.AIAPI.request = () => Promise.reject(window.AIAPI.ApiError('获取通知失败', { status: 500 }));
await N.load();
check('feed 500 → error', N.getState(), 'error');
check('500 文案透传', $('error-copy').textContent, '获取通知失败');

window.AIAPI.request = () => Promise.reject(window.AIAPI.ApiError('未授权', { status: 401 }));
await N.load();
check('401 → auth', N.getState(), 'auth');

window.AIAPI.request = () => Promise.reject(window.AIAPI.ApiError('网络连接不可用', { kind: 'network' }));
await N.load();
check('网络失败 → offline', N.getState(), 'offline');

for (const r of results) {
  console.log(
    `${r.ok ? 'OK  ' : 'FAIL'} ${r.name.padEnd(26)} 实际=${JSON.stringify(r.got)}` + (r.ok ? '' : ` 期望=${JSON.stringify(r.want)}`)
  );
}
const bad = results.filter((r) => !r.ok).length;
console.log(bad ? `\n❌ ${bad} 项不符` : `\n✅ ${results.length} 项全部通过`);
process.exit(bad ? 1 : 0);
