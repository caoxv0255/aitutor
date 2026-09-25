// 学科大屏页验收：六态 + 4 tab + 圆环标度（G6-b 0..1 → ×100 一次）+ 知识点/错题/跨学科 + 错误分类
// 规格出处：PM-BRIEF B.3:179 / F.4:403 / SPEC-ROUTES:55
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const DIR = 'frontend-v2';
const html = fs.readFileSync(`${DIR}/subject-detail.html`, 'utf8');
const uiJs = fs.readFileSync(`${DIR}/assets/js/ui.js`, 'utf8');
const apiJs = fs.readFileSync(`${DIR}/assets/js/api.js`, 'utf8');
const subjectsJs = fs.readFileSync(`${DIR}/assets/js/subjects.js`, 'utf8');
const pageJs = fs.readFileSync(`${DIR}/assets/js/subject-detail.js`, 'utf8');
const qbRenderJs = fs.readFileSync(`${DIR}/assets/js/qb-render.js`, 'utf8');

const inlined = html
  .replace(/<script src="[^"]*ui\.js"><\/script>/, `<script>${uiJs}</script>`)
  .replace(/<script src="[^"]*api\.js"><\/script>/, `<script>${apiJs}</script>`)
  .replace(/<script src="[^"]*subjects\.js"><\/script>/, `<script>${subjectsJs}</script>`)
  .replace(/<script src="[^"]*qb-render\.js"><\/script>/, () => `<script>${qbRenderJs}</script>`)
  .replace(/<script src="[^"]*subject-detail\.js"><\/script>/, `<script>${pageJs}</script>`);

const dom = new JSDOM(inlined, {
  runScripts: 'dangerously',
  url: 'https://x.dev/subject-detail.html?subject=math',
  pretendToBeVisual: true,
});
const { window } = dom;
window.fetch = () => Promise.reject(new Error('no network in test'));
window.localStorage.setItem('authToken', 'stub-token');
await new Promise((res) => window.addEventListener('load', res));

const P = window.SubjectDetail;
const results = [];
const check = (name, got, want) => results.push({ ok: got === want, name, got, want });
const doc = window.document;
const $ = (id) => doc.getElementById(id);
const visible = () => doc.querySelectorAll('.state.is-on').length;
const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));

// 后端真实形状：
// GET /api/knowledge/mastery → { subject, overall(0..1), by_topic[], weak_points[] }（G6-b）
const MASTERY = {
  subject: '数学',
  overall: 0.62,
  by_topic: [
    { kp_id: 'kp1', topic: '导数与切线', mastery: 0.4, questions_done: 12, accuracy: 0.5 },
    { kp_id: 'kp2', topic: '三角函数', mastery: 0.84, questions_done: 20, accuracy: 0.9 },
  ],
  weak_points: [{ topic: '导数与切线', mastery: 0.4, recommendation: '建议复习 导数与切线 的基础概念与典型例题' }],
};
// GET /api/knowledge/points → data[{id,name,subject,difficulty,frequency,mastery(0..100 整数)}]
const POINTS = {
  data: [
    { id: 'kp1', name: '导数与切线', subject: 'math', difficulty: 4, frequency: 'high', mastery: 40 },
    { id: 'kp2', name: '三角函数', subject: 'math', difficulty: 3, frequency: 'medium', mastery: 84 },
  ],
};
// GET /api/user/wrong-questions?subject=&page_size=10
const WRONG = { data: [{ id: 'w1', content: '错题一', created_at: '2026-09-20T10:00:00Z', reviewed: false }] };
// GET /api/knowledge/cross-subject-impact?subject=（AIAPI.request 已解包 data）
const CROSS = { subject: 'math', root_causes: [{ kp_id: 'p1', name: '集合运算', subject: 'chinese', mastery_score: 30 }], note: '基于知识图谱' };

let lastPaths = [];
window.AIAPI.request = (path) => {
  lastPaths.push(path);
  if (path.startsWith('/api/knowledge/mastery')) return Promise.resolve(MASTERY);
  if (path.startsWith('/api/knowledge/points')) return Promise.resolve(POINTS);
  if (path.startsWith('/api/user/wrong-questions')) return Promise.resolve(WRONG);
  if (path.startsWith('/api/knowledge/cross-subject-impact')) return Promise.resolve(CROSS);
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

// 4. ?subject=math 参数生效 + success
window.AIAPI.request = (path) => {
  lastPaths.push(path);
  if (path.startsWith('/api/knowledge/mastery')) return Promise.resolve(MASTERY);
  if (path.startsWith('/api/knowledge/points')) return Promise.resolve(POINTS);
  if (path.startsWith('/api/user/wrong-questions')) return Promise.resolve(WRONG);
  if (path.startsWith('/api/knowledge/cross-subject-impact')) return Promise.resolve(CROSS);
  return Promise.resolve({});
};
lastPaths = [];
await P.load();
check('成功态', P.getState(), 'success');
check('subject 参数来自 URL', P.data.subject, 'math');
check('mastery 请求带 subject', lastPaths.some((p) => p === '/api/knowledge/mastery?subject=math'), true);
check('points 请求带 subject', lastPaths.some((p) => p === '/api/knowledge/points?subject=math'), true);
check('错题请求带 subject', lastPaths.some((p) => p === '/api/user/wrong-questions?subject=math&page_size=10'), true);
check('跨学科请求带 subject', lastPaths.some((p) => p === '/api/knowledge/cross-subject-impact?subject=math'), true);

// 5. 圆环标度：overall 0..1 → 62%（G6-b，只在页面乘一次）
check('圆环数值 62', $('overall-value').textContent, '62');
check('圆环 --ring-pct 已设', $('overall-ring').style.getPropertyValue('--ring-pct'), '62');

// 6. tabs：概览/知识点/错题/趋势，默认概览
check('tab 数量 4', doc.querySelectorAll('#detail-tabs .tab').length, 4);
check('默认概览可见', $('tab-overview').hidden, false);
check('其余 tab 隐藏', $('tab-points').hidden && $('tab-wrong').hidden && $('tab-trend').hidden, true);
doc.querySelector('#detail-tabs .tab[data-tab="points"]').click();
check('切到知识点 tab', $('tab-points').hidden, false);
check('知识点行数 2', doc.querySelectorAll('#points-list .topic-row').length, 2);
check('知识点 mastery 0..100 直显', /84%/.test(doc.querySelector('#points-list').textContent), true);
doc.querySelector('#detail-tabs .tab[data-tab="wrong"]').click();
check('切到错题 tab', $('tab-wrong').hidden, false);
check('错题行渲染', doc.querySelectorAll('#wrong-list .task-row').length, 1);
doc.querySelector('#detail-tabs .tab[data-tab="trend"]').click();
check('切到趋势 tab', $('tab-trend').hidden, false);
check('趋势为说明态登记', /缺失登记/.test($('tab-trend').textContent), true);
check('趋势不伪造曲线', $('tab-trend').querySelectorAll('.skeleton').length, 0);

// 7. 薄弱点与跨学科联动
doc.querySelector('#detail-tabs .tab[data-tab="overview"]').click();
check('薄弱点行渲染', doc.querySelectorAll('#weak-points .topic-row').length, 1);
check('薄弱点红标', /40%/.test($('weak-points').textContent), true);
check('跨学科说明可见', $('cross-note').hidden, false);
check('跨学科文案含学科名', /集合运算/.test($('cross-copy').textContent), true);

// 8. 学科切换：select 来自 AISubjects 9 科 + URL 同步
const sel = $('subject-select');
check('学科下拉 9 项', sel.options.length, 9);
sel.value = 'physics';
sel.dispatchEvent(new window.Event('change'));
await tick(0);
check('切学科后仍 success', P.getState(), 'success');
check('切学科请求带 subject=physics', lastPaths.some((p) => p === '/api/knowledge/mastery?subject=physics'), true);
check('URL 已同步', window.location.search, '?subject=physics');

// 9. 空态：无知识点练习 + 无错题 → 「本学科暂未练习」
window.AIAPI.request = (path) => {
  if (path.startsWith('/api/knowledge/mastery')) return Promise.resolve({ subject: '物理', overall: 0, by_topic: [], weak_points: [] });
  if (path.startsWith('/api/knowledge/points')) return Promise.resolve({ data: [] });
  if (path.startsWith('/api/user/wrong-questions')) return Promise.resolve({ data: [] });
  return Promise.resolve({ data: { root_causes: [] } });
};
await P.load();
check('未练习 → empty', P.getState(), 'empty');
check('空态文案', /暂未练习|暂无/.test($('empty-title').textContent + $('empty-copy').textContent), true);

// 10. 跨学科接口失败不拖垮整页
window.AIAPI.request = (path) => {
  if (path.startsWith('/api/knowledge/mastery')) return Promise.resolve(MASTERY);
  if (path.startsWith('/api/knowledge/points')) return Promise.resolve(POINTS);
  if (path.startsWith('/api/user/wrong-questions')) return Promise.resolve(WRONG);
  if (path.startsWith('/api/knowledge/cross-subject-impact')) {
    return Promise.reject(window.AIAPI.ApiError('图谱未就绪', { status: 500 }));
  }
  return Promise.resolve({});
};
await P.load();
check('跨学科失败 → 仍 success', P.getState(), 'success');
check('跨学科说明回退隐藏', $('cross-note').hidden, true);

// 11. 加载失败分类
window.AIAPI.request = () => Promise.reject(window.AIAPI.ApiError('获取学科诊断失败', { status: 500 }));
await P.load();
check('加载 500 → error', P.getState(), 'error');
check('加载 500 文案透传', $('error-copy').textContent, '获取学科诊断失败');
window.AIAPI.request = () => Promise.reject(window.AIAPI.ApiError('未授权', { status: 401 }));
await P.load();
check('加载 401 → auth', P.getState(), 'auth');
window.AIAPI.request = () => Promise.reject(window.AIAPI.ApiError('网络连接不可用', { kind: 'network' }));
await P.load();
check('加载网络失败 → offline', P.getState(), 'offline');

// 12. 未知 ?subject= 回退 math（不伪造）
const dom2 = new JSDOM(inlined, {
  runScripts: 'dangerously',
  url: 'https://x.dev/subject-detail.html?subject=hack',
  pretendToBeVisual: true,
});
const w2 = dom2.window;
w2.fetch = () => Promise.reject(new Error('no network'));
w2.localStorage.setItem('authToken', 't');
await new Promise((res) => w2.addEventListener('load', res));
w2.AIAPI.request = (path) => {
  if (path.startsWith('/api/knowledge/mastery')) return Promise.resolve(MASTERY);
  if (path.startsWith('/api/knowledge/points')) return Promise.resolve(POINTS);
  if (path.startsWith('/api/user/wrong-questions')) return Promise.resolve(WRONG);
  return Promise.resolve({ data: { root_causes: [] } });
};
await w2.SubjectDetail.load();
check('未知学科回退 math', w2.SubjectDetail.data.subject, 'math');

for (const r of results) {
  console.log(
    `${r.ok ? 'OK  ' : 'FAIL'} ${r.name.padEnd(28)} 实际=${JSON.stringify(r.got)}` + (r.ok ? '' : ` 期望=${JSON.stringify(r.want)}`)
  );
}
const bad = results.filter((r) => !r.ok).length;
console.log(bad ? `\n❌ ${bad} 项不符` : `\n✅ ${results.length} 项全部通过`);
process.exit(bad ? 1 : 0);
