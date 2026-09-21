// 今日复习验收：六态 + 队列渲染 + 提交参数 + 防重复提交
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const DIR = 'frontend-v2';
const html = fs.readFileSync(`${DIR}/review-session.html`, 'utf8');
const uiJs = fs.readFileSync(`${DIR}/assets/js/ui.js`, 'utf8');
const apiJs = fs.readFileSync(`${DIR}/assets/js/api.js`, 'utf8');
const pageJs = fs.readFileSync(`${DIR}/assets/js/review-session.js`, 'utf8');

const inlined = html
  .replace(/<script src="[^"]*ui\.js"><\/script>/, `<script>${uiJs}</script>`)
  .replace(/<script src="[^"]*api\.js"><\/script>/, `<script>${apiJs}</script>`)
  .replace(/<script src="[^"]*review-session\.js"><\/script>/, `<script>${pageJs}</script>`);

const dom = new JSDOM(inlined, {
  runScripts: 'dangerously',
  url: 'https://x.dev/review-session.html',
  pretendToBeVisual: true,
});
const { window } = dom;
window.fetch = () => Promise.reject(new Error('no network in test'));
window.localStorage.setItem('authToken', 'stub-token');

await new Promise((res) => window.addEventListener('load', res));

const R = window.ReviewSession;
const results = [];
const check = (name, got, want) => results.push({ ok: got === want, name, got, want });
const doc = window.document;
const visible = () => doc.querySelectorAll('.state.is-on').length;
const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));

const QUEUE = [
  {
    wrong_id: 101,
    subject_code: 'math',
    kp_id: 'kp1',
    kp_name: '一元二次方程',
    stem: '解方程 x²-5x+6=0',
    user_answer: 'x=1',
    correct_answer: 'x=2 或 x=3',
    mastery_score: 30,
    is_weak: true,
  },
  {
    wrong_id: 102,
    subject_code: 'physics',
    kp_name: '牛顿第二定律',
    stem: '求物体加速度',
    mastery_score: 70,
    is_weak: false,
  },
];

// 基线 stub：队列非空、统计正常
window.AIAPI.srsQueue = () => Promise.resolve({ queue: QUEUE, total: 2 });
window.AIAPI.srsStats = () => Promise.resolve({ due_count: 2, today_reviews: 1, total_reviews: 9 });

// 1. 六态面板与互斥
const panels = [...doc.querySelectorAll('[data-state]')].map((n) => n.getAttribute('data-state'));
check('六态面板', panels.sort().join(','), R.STATES.slice().sort().join(','));
for (const s of R.STATES) {
  R.setState(s);
  check(`setState(${s})`, R.getState(), s);
  check(`setState(${s}) 互斥`, visible(), 1);
}

// 2. 无 token → auth
window.localStorage.removeItem('authToken');
await R.load();
check('无 token → auth', R.getState(), 'auth');
window.localStorage.setItem('authToken', 'stub-token');

// 3. 离线 → offline（且不发请求）
Object.defineProperty(window.navigator, 'onLine', { value: false, configurable: true });
let queueCalled = 0;
window.AIAPI.srsQueue = () => {
  queueCalled += 1;
  return Promise.resolve({ queue: QUEUE, total: 2 });
};
await R.load();
check('离线 → offline', R.getState(), 'offline');
check('离线不发请求', queueCalled, 0);
Object.defineProperty(window.navigator, 'onLine', { value: true, configurable: true });

// 4. 队列空 → empty(none)，文案指路错题本
window.AIAPI.srsQueue = () => Promise.resolve({ queue: [], total: 0 });
await R.load();
check('空队列 → empty', R.getState(), 'empty');
check('空队列文案', doc.getElementById('empty-title').textContent, '今日没有待复习的错题');

// 5. 有队列 → success，渲染题干/知识点/标签/进度
window.AIAPI.srsQueue = () => Promise.resolve({ queue: QUEUE, total: 2 });
await R.load();
await tick(0);
check('有队列 → success', R.getState(), 'success');
check('渲染题干', doc.getElementById('stem').textContent, '解方程 x²-5x+6=0');
check('知识点标签', doc.getElementById('kp-label').textContent, '一元二次方程');
check('学科标签', doc.getElementById('subject-tag').textContent, '数学');
check('掌握度标签', doc.getElementById('mastery-tag').textContent, '掌握度 30%');
check('薄弱标记显示', doc.getElementById('weak-tag').hidden, false);
check('进度文案', doc.getElementById('progress').textContent, '第 1 / 2 组');
check('统计 chip 数', doc.querySelectorAll('#stat-region .stat-chip').length, 3);

// 6. 提交参数：wrong_id / quality / time_spent_ms 必须是数字
let sent = null;
window.AIAPI.srsReview = (payload) => {
  sent = payload;
  return Promise.resolve({ new_interval: 3, mastery_delta: 0.08, group_bonus: 0 });
};
const btn = doc.querySelector('button[data-quality="4"]');
btn.dispatchEvent(new window.Event('click', { bubbles: true }));
await tick(30);
check('提交 wrong_id', sent && sent.wrong_id, 101);
check('提交 quality', sent && sent.quality, 4);
check('time_spent_ms 为数字', typeof (sent && sent.time_spent_ms), 'number');
// 页面刻意留 800ms 展示反馈后再翻组
check('反馈已显示', doc.getElementById('feedback').hidden, false);
check('反馈含下次间隔', /3/.test(doc.getElementById('feedback').textContent), true);
await tick(900);
check('进入下一组', R.getIndex(), 1);
check('下一组题干已更新', doc.getElementById('stem').textContent, '求物体加速度');
check('第二组标签', doc.getElementById('subject-tag').textContent, '物理');
check('薄弱标记隐藏', doc.getElementById('weak-tag').hidden, true);

// 7. 最后一组提交后 → empty(done)
await tick(900);
window.AIAPI.srsReview = () => Promise.resolve({ new_interval: 7, mastery_delta: 0.12 });
doc.querySelector('button[data-quality="5"]').dispatchEvent(new window.Event('click', { bubbles: true }));
await tick(1000);
check('全部复习完 → empty', R.getState(), 'empty');
check('完成文案', doc.getElementById('empty-title').textContent, '今日复习完成');

// 8. 防重复提交：提交中再点不得产生第二次请求（review 会改 mastery，重复=刷分）
let reviewCalls = 0;
let release;
window.AIAPI.srsQueue = () => Promise.resolve({ queue: QUEUE, total: 2 });
await R.load();
await tick(0);
window.AIAPI.srsReview = () => {
  reviewCalls += 1;
  return new Promise((res) => {
    release = res;
  });
};
const q3 = doc.querySelector('button[data-quality="3"]');
q3.dispatchEvent(new window.Event('click', { bubbles: true }));
await tick(10);
q3.dispatchEvent(new window.Event('click', { bubbles: true }));
doc.querySelector('button[data-quality="5"]').dispatchEvent(new window.Event('click', { bubbles: true }));
await tick(10);
check('并发点击只发一次请求', reviewCalls, 1);
check('提交中按钮禁用', q3.disabled, true);
release({ new_interval: 4, mastery_delta: 0.04 });
await tick(900);

// 9. 队列接口 500 → error 透传
window.AIAPI.srsQueue = () => Promise.reject(window.AIAPI.ApiError('队列查询失败: db down', { status: 500 }));
await R.load();
check('500 → error', R.getState(), 'error');
check('错误文案透传', doc.getElementById('error-copy').textContent, '队列查询失败: db down');

// 10. 队列 401 → auth；网络失败 → offline
window.AIAPI.srsQueue = () => Promise.reject(window.AIAPI.ApiError('未授权', { status: 401 }));
await R.load();
check('401 → auth', R.getState(), 'auth');

window.AIAPI.srsQueue = () => Promise.reject(window.AIAPI.ApiError('网络连接不可用', { kind: 'network' }));
await R.load();
check('网络失败 → offline', R.getState(), 'offline');

// 11. 提交时 404（错题不属于当前用户）→ error 并透传
window.AIAPI.srsQueue = () => Promise.resolve({ queue: QUEUE, total: 2 });
await R.load();
await tick(0);
window.AIAPI.srsReview = () =>
  Promise.reject(window.AIAPI.ApiError('错题不存在或不属于当前用户', { status: 404 }));
doc.querySelector('button[data-quality="2"]').dispatchEvent(new window.Event('click', { bubbles: true }));
await tick(20);
check('提交 404 → error', R.getState(), 'error');
check('404 文案透传', doc.getElementById('error-copy').textContent, '错题不存在或不属于当前用户');

// 12. 统计接口失败不拖垮复习
window.AIAPI.srsQueue = () => Promise.resolve({ queue: QUEUE, total: 2 });
window.AIAPI.srsStats = () => Promise.reject(window.AIAPI.ApiError('统计挂了', { status: 500 }));
await R.load();
await tick(0);
check('统计失败不影响复习', R.getState(), 'success');

// 13. 接口返回非数值时不得进入 HTML 路径（防注入 / 防错渲染）
window.AIAPI.srsQueue = () => Promise.resolve({ queue: QUEUE, total: 2 });
await R.load();
await tick(0);
window.AIAPI.srsReview = () =>
  Promise.resolve({
    new_interval: '<img src=x onerror="window.__pwned=1">',
    mastery_delta: '0.08',
    group_bonus: '<script>window.__pwned=1</script>',
  });
doc.querySelector('button[data-quality="4"]').dispatchEvent(new window.Event('click', { bubbles: true }));
await tick(30);
const fb = doc.getElementById('feedback');
check('恶意字符串未生成元素', fb.querySelectorAll('img, script').length, 0);
check('未执行注入脚本', window.__pwned, undefined);
check('字符串被降级为 ?', /下次复习：\? 天后/.test(fb.textContent), true);
check('非数值 delta 被忽略', /掌握度/.test(fb.textContent), false);
await tick(900);

for (const r of results) {
  console.log(`${r.ok ? 'OK  ' : 'FAIL'} ${r.name.padEnd(26)} 实际=${JSON.stringify(r.got)}` + (r.ok ? '' : ` 期望=${JSON.stringify(r.want)}`));
}
const bad = results.filter((r) => !r.ok).length;
console.log(bad ? `\n❌ ${bad} 项不符` : `\n✅ ${results.length} 项全部通过`);
process.exit(bad ? 1 : 0);
