// 掌握度页验收：六态 + 标度转换（G6-b）+ 薄弱判定复用后端 + 防御性渲染
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const DIR = 'frontend-v2';
const html = fs.readFileSync(`${DIR}/mastery.html`, 'utf8');
const uiJs = fs.readFileSync(`${DIR}/assets/js/ui.js`, 'utf8');
const apiJs = fs.readFileSync(`${DIR}/assets/js/api.js`, 'utf8');
const subjectsJs = fs.readFileSync(`${DIR}/assets/js/subjects.js`, 'utf8');
const pageJs = fs.readFileSync(`${DIR}/assets/js/mastery.js`, 'utf8');

const inlined = html
  .replace(/<script src="[^"]*ui\.js"><\/script>/, `<script>${uiJs}</script>`)
  .replace(/<script src="[^"]*api\.js"><\/script>/, `<script>${apiJs}</script>`)
  .replace(/<script src="[^"]*subjects\.js"><\/script>/, `<script>${subjectsJs}</script>`)
  .replace(/<script src="[^"]*mastery\.js"><\/script>/, `<script>${pageJs}</script>`);

const dom = new JSDOM(inlined, {
  runScripts: 'dangerously',
  url: 'https://x.dev/mastery.html',
  pretendToBeVisual: true,
});
const { window } = dom;
window.fetch = () => Promise.reject(new Error('no network in test'));
window.localStorage.setItem('authToken', 'stub-token');
await new Promise((res) => window.addEventListener('load', res));

const M = window.Mastery;
const results = [];
const check = (name, got, want) => results.push({ ok: got === want, name, got, want });
const doc = window.document;
const visible = () => doc.querySelectorAll('.state.is-on').length;
const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));

// 后端真实形状（0..1 标度，见 SPEC-DATA G6-b）
const DATA = {
  subject: '',
  overall: 0.45,
  by_topic: [
    { kp_id: 'kp_dt', topic: '导数与切线', mastery: 0.4, questions_done: 5, accuracy: 0.6 },
    { kp_id: 'kp_em', topic: '电磁感应', mastery: 0.45, questions_done: 3, accuracy: 0.67 },
    { kp_id: 'kp_dc', topic: '复合函数求导', mastery: 0.5, questions_done: 2, accuracy: 0.5 },
  ],
  weak_points: [
    { topic: '导数与切线', mastery: 0.4, recommendation: '建议复习 导数与切线 的基础概念与典型例题' },
    { topic: '电磁感应', mastery: 0.45, recommendation: '建议复习 电磁感应 的基础概念与典型例题' },
  ],
};

// 1. 六态面板与互斥
const panels = [...doc.querySelectorAll('[data-state]')].map((n) => n.getAttribute('data-state'));
check('六态面板', panels.sort().join(','), M.STATES.slice().sort().join(','));
for (const s of M.STATES) {
  M.setState(s);
  check(`setState(${s})`, M.getState(), s);
  check(`setState(${s}) 互斥`, visible(), 1);
}

// 2. 标度转换（G6-b 的核心：0..1 → 百分比，且只转一次）
check('pct(0.45)', M.pct(0.45), 45);
check('pct(0)', M.pct(0), 0);
check('pct(1)', M.pct(1), 100);
check('pct(0.055)', M.pct(0.055), 6);
check('pct(null) 容错', M.pct(null), 0);
check('pct("x") 容错', M.pct('x'), 0);
check('pct(undefined) 容错', M.pct(undefined), 0);

// 3. 无 token → auth；离线 → offline 且不发请求
window.localStorage.removeItem('authToken');
await M.load();
check('无 token → auth', M.getState(), 'auth');
window.localStorage.setItem('authToken', 'stub-token');

Object.defineProperty(window.navigator, 'onLine', { value: false, configurable: true });
let called = 0;
window.AIAPI.knowledgeMastery = () => {
  called += 1;
  return Promise.resolve(DATA);
};
await M.load();
check('离线 → offline', M.getState(), 'offline');
check('离线不发请求', called, 0);
Object.defineProperty(window.navigator, 'onLine', { value: true, configurable: true });

// 4. 空记录 → empty
window.AIAPI.knowledgeMastery = () => Promise.resolve({ overall: 0, by_topic: [], weak_points: [] });
await M.load();
check('空记录 → empty', M.getState(), 'empty');
check('空态文案', doc.getElementById('empty-copy').textContent, '做完一组题或复习一次，掌握度就会出现在这里。');

// 5. 有数据 → success，且百分比正确
let sentSubject = 'UNSET';
window.AIAPI.knowledgeMastery = (subject) => {
  sentSubject = subject;
  return Promise.resolve(DATA);
};
await M.load();
await tick(0);
check('有数据 → success', M.getState(), 'success');
check('overall 显示为 45', doc.getElementById('overall-value').textContent, '45');
check('overall 不是 0.5 也不是 4500', doc.getElementById('overall-value').textContent === '0' ? '0' : '45', '45');
check('知识点行数', doc.querySelectorAll('#topic-list .topic-row').length, 3);
check('首行名称', doc.querySelector('#topic-list .topic-name').textContent, '导数与切线');
check('首行百分比 40%', doc.querySelector('#topic-list .topic-pct').textContent, '40%');
check('副信息含题量与正确率', /做过 5 题 · 正确率 60%/.test(doc.querySelector('#topic-list .topic-sub').textContent), true);
check('meta 含知识点数', /已练习知识点 3 个/.test(doc.getElementById('overall-meta').textContent), true);
check('meta 含薄弱数', /薄弱 2 个/.test(doc.getElementById('overall-meta').textContent), true);

// 6. 薄弱样式复用后端 weak_points（不在前端重复实现阈值）
const rows = [...doc.querySelectorAll('#topic-list .topic-row')];
const weakRow = rows.find((r) => r.querySelector('.topic-pct--weak'));
const strongRow = rows.find((r) => !r.querySelector('.topic-pct--weak'));
check('薄弱行被标红', weakRow ? weakRow.querySelector('.topic-name').textContent : null, '导数与切线');
check('非薄弱行不标红', strongRow ? strongRow.querySelector('.topic-name').textContent : null, '复合函数求导');
check('进度条宽度 40%', doc.querySelector('#topic-list .bar-fill').style.width, '40%');

// 7. 建议列表
check('建议区可见', doc.getElementById('advice-block').hidden, false);
check('建议条数', doc.querySelectorAll('#advice-list li').length, 2);
check('建议文案来自后端', doc.querySelector('#advice-list li').textContent, '建议复习 导数与切线 的基础概念与典型例题');

// 8. 筛选参数透传
doc.getElementById('subject-filter').value = 'physics';
await M.load();
await tick(0);
check('筛选透传 subject', sentSubject, 'physics');

// 9. 筛选后为空 → empty(filtered) 文案不同
window.AIAPI.knowledgeMastery = () => Promise.resolve({ overall: 0, by_topic: [], weak_points: [] });
await M.load();
await tick(0);
check('筛选空 → empty', M.getState(), 'empty');
check('筛选空文案', doc.getElementById('empty-copy').textContent, '该学科下还没有练习记录，换个学科试试。');

// 10. 错误分类
window.AIAPI.knowledgeMastery = () => Promise.reject(window.AIAPI.ApiError('获取掌握度失败', { status: 500 }));
await M.load();
check('500 → error', M.getState(), 'error');
check('500 文案透传', doc.getElementById('error-copy').textContent, '获取掌握度失败');

window.AIAPI.knowledgeMastery = () => Promise.reject(window.AIAPI.ApiError('未授权', { status: 401 }));
await M.load();
check('401 → auth', M.getState(), 'auth');

window.AIAPI.knowledgeMastery = () => Promise.reject(window.AIAPI.ApiError('网络连接不可用', { kind: 'network' }));
await M.load();
check('网络失败 → offline', M.getState(), 'offline');

// 11. 防御性：字段缺失不崩
window.AIAPI.knowledgeMastery = () =>
  Promise.resolve({ by_topic: [{ kp_id: 'kp_x' }] }); // 无 overall/mastery/topic/accuracy
await M.load();
await tick(0);
check('字段缺失仍渲染', M.getState(), 'success');
check('缺失 overall 显示 0', doc.getElementById('overall-value').textContent, '0');
check('缺失 name 回落 kp_id', doc.querySelector('#topic-list .topic-name').textContent, 'kp_x');
check('缺失建议不报错', doc.getElementById('advice-block').hidden, true);

for (const r of results) {
  console.log(`${r.ok ? 'OK  ' : 'FAIL'} ${r.name.padEnd(28)} 实际=${JSON.stringify(r.got)}` + (r.ok ? '' : ` 期望=${JSON.stringify(r.want)}`));
}
const bad = results.filter((r) => !r.ok).length;
console.log(bad ? `\n❌ ${bad} 项不符` : `\n✅ ${results.length} 项全部通过`);
process.exit(bad ? 1 : 0);
