// 仪表盘验收：六态 + 标度（后端已算百分比，不再乘）+ 部分失败不拖垮 + 防御性
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const DIR = 'frontend-v2';
const html = fs.readFileSync(`${DIR}/dashboard.html`, 'utf8');
const uiJs = fs.readFileSync(`${DIR}/assets/js/ui.js`, 'utf8');
const apiJs = fs.readFileSync(`${DIR}/assets/js/api.js`, 'utf8');
const subjectsJs = fs.readFileSync(`${DIR}/assets/js/subjects.js`, 'utf8');
const pageJs = fs.readFileSync(`${DIR}/assets/js/dashboard.js`, 'utf8');

const inlined = html
  .replace(/<script src="[^"]*ui\.js"><\/script>/, `<script>${uiJs}</script>`)
  .replace(/<script src="[^"]*api\.js"><\/script>/, `<script>${apiJs}</script>`)
  .replace(/<script src="[^"]*subjects\.js"><\/script>/, `<script>${subjectsJs}</script>`)
  .replace(/<script src="[^"]*dashboard\.js"><\/script>/, `<script>${pageJs}</script>`);

const dom = new JSDOM(inlined, {
  runScripts: 'dangerously',
  url: 'https://x.dev/dashboard.html',
  pretendToBeVisual: true,
});
const { window } = dom;
window.fetch = () => Promise.reject(new Error('no network in test'));
window.localStorage.setItem('authToken', 'stub-token');
await new Promise((res) => window.addEventListener('load', res));

const D = window.Dashboard;
const results = [];
const check = (name, got, want) => results.push({ ok: got === want, name, got, want });
const doc = window.document;
const visible = () => doc.querySelectorAll('.state.is-on').length;
const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));

// 后端真实形状：accuracy/percentage 已是百分比字符串（G6-b 同类，方向相反）
const DASH = {
  user: { email: 'a@b.com', grade: '初二' },
  overview: { total_wrong_questions: 12, total_practice: 30, avg_accuracy: '73.3', study_days: 5 },
  subject_distribution: [
    { subject: 'math', count: 8, percentage: '66.7' },
    { subject: 'physics', count: 4, percentage: '33.3' },
  ],
  weak_points: [
    { id: 'kp_dt', name: '导数与切线', subject: 'math', wrong_count: 4, practice_count: 5, accuracy: '60.0', level: 'high' },
    { id: 'kp_em', name: '电磁感应', subject: 'physics', wrong_count: 3, practice_count: 3, accuracy: 'N/A', level: 'mid' },
  ],
};
const TODAY = { date: '2026-09-21', streak_days: 3, tasks: [{ knowledge_point_name: '复合函数求导', status: 'pending' }] };

// 1. 六态与互斥
const panels = [...doc.querySelectorAll('[data-state]')].map((n) => n.getAttribute('data-state'));
check('六态面板', panels.sort().join(','), D.STATES.slice().sort().join(','));
for (const s of D.STATES) {
  D.setState(s);
  check(`setState(${s})`, D.getState(), s);
  check(`setState(${s}) 互斥`, visible(), 1);
}

// 2. 标度：后端已是百分比 → 不再乘（这是本页最容易犯的 G6 类错误）
check('pctText("73.3")', D.pctText('73.3'), '73.3%');
check('pctText 不重复乘', D.pctText('73.3') === '7330.0%' ? 'BAD' : '73.3%', '73.3%');
check('pctText("N/A")', D.pctText('N/A'), '—');
check('pctText(null)', D.pctText(null), '—');

// 3. 无 token → auth；离线不发请求
window.localStorage.removeItem('authToken');
await D.load();
check('无 token → auth', D.getState(), 'auth');
window.localStorage.setItem('authToken', 'stub-token');

Object.defineProperty(window.navigator, 'onLine', { value: false, configurable: true });
let called = 0;
window.AIAPI.userDashboard = () => {
  called += 1;
  return Promise.resolve(DASH);
};
window.AIAPI.todayTasks = () => Promise.resolve(TODAY);
await D.load();
check('离线 → offline', D.getState(), 'offline');
check('离线不发请求', called, 0);
Object.defineProperty(window.navigator, 'onLine', { value: true, configurable: true });

// 4. 零数据 → empty
window.AIAPI.userDashboard = () =>
  Promise.resolve({ user: {}, overview: { total_wrong_questions: 0, total_practice: 0, avg_accuracy: '0.0', study_days: 0 }, weak_points: [] });
await D.load();
check('零数据 → empty', D.getState(), 'empty');
check('空态文案', doc.getElementById('empty-copy').textContent, '先拍一张卷子，或从今日复习开始。');

// 5. 有数据 → success
window.AIAPI.userDashboard = () => Promise.resolve(DASH);
window.AIAPI.todayTasks = () => Promise.resolve(TODAY);
await D.load();
await tick(0);
check('有数据 → success', D.getState(), 'success');
check('统计格数', doc.querySelectorAll('#stat-grid .stat-cell').length, 4);
const statTexts = [...doc.querySelectorAll('#stat-grid .stat-cell')].map((c) => c.textContent);
check('错题总数显示', statTexts.some((t) => t.includes('12') && t.includes('错题总数')), true);
check('平均正确率显示 73.3%', statTexts.some((t) => t.includes('73.3%')), true);
check('问候语含年级', doc.getElementById('greeting').textContent, '初二 · 看看今天的任务与最近的练习情况。');

// 6. 今日任务（次要信息）
check('任务行数', doc.querySelectorAll('#task-list .task-row').length, 1);
check('任务名', doc.querySelector('#task-list .task-name').textContent, '复合函数求导');
check('任务状态', doc.querySelector('#task-list .task-status').textContent, '待完成');

// 7. 薄弱知识点
check('薄弱行数', doc.querySelectorAll('#weak-list .topic-row').length, 2);
check('薄弱首行', doc.querySelector('#weak-list .topic-name').textContent, '导数与切线');
check('薄弱正确率', doc.querySelector('#weak-list .topic-pct').textContent, '60.0%');
check('N/A → 破折号', doc.querySelectorAll('#weak-list .topic-pct')[1].textContent, '—');
check('薄弱副信息含学科与次数', /数学 · 错 4 次 · 练 5 次/.test(doc.querySelector('#weak-list .topic-sub').textContent), true);

// 8. 学科分布（条形宽度按最大值归一化）
check('分布行数', doc.querySelectorAll('#dist-list .dist-row').length, 2);
check('首行学科', doc.querySelector('#dist-list .dist-label').textContent, '数学');
check('首行条形宽度 100%', doc.querySelector('#dist-list .bar-fill').style.width, '100%');
check('第二行条形宽度 50%', doc.querySelectorAll('#dist-list .bar-fill')[1].style.width, '50%');

// 9. 今日任务失败不拖垮仪表盘（部分失败策略）
window.AIAPI.todayTasks = () => Promise.reject(window.AIAPI.ApiError('今日任务挂了', { status: 500 }));
await D.load();
await tick(0);
check('任务失败仍 success', D.getState(), 'success');
check('任务区降级提示', /今天还没有生成任务/.test(doc.getElementById('task-list').textContent), true);

// 10. 错误分类
window.AIAPI.userDashboard = () => Promise.reject(window.AIAPI.ApiError('获取学习仪表盘数据失败', { status: 500 }));
await D.load();
check('500 → error', D.getState(), 'error');
check('500 文案透传', doc.getElementById('error-copy').textContent, '获取学习仪表盘数据失败');

window.AIAPI.userDashboard = () => Promise.reject(window.AIAPI.ApiError('未授权', { status: 401 }));
await D.load();
check('401 → auth', D.getState(), 'auth');

window.AIAPI.userDashboard = () => Promise.reject(window.AIAPI.ApiError('网络连接不可用', { kind: 'network' }));
await D.load();
check('网络失败 → offline', D.getState(), 'offline');

// 11. 防御性：字段缺失不崩
window.AIAPI.userDashboard = () =>
  Promise.resolve({ overview: { total_practice: 1 }, weak_points: [{ id: 'x' }], subject_distribution: [{ subject: 'x', count: 1 }] });
window.AIAPI.todayTasks = () => Promise.resolve({ tasks: [{}] });
await D.load();
await tick(0);
check('字段缺失仍渲染', D.getState(), 'success');
check('缺失名称回落', doc.querySelector('#weak-list .topic-name').textContent, '未命名知识点');
check('缺失 accuracy 显示破折号', doc.querySelector('#weak-list .topic-pct').textContent, '—');
check('缺失任务名回落', doc.querySelector('#task-list .task-name').textContent, '学习任务');
check('未知学科回落原值', doc.querySelector('#dist-list .dist-label').textContent, 'x');

for (const r of results) {
  console.log(`${r.ok ? 'OK  ' : 'FAIL'} ${r.name.padEnd(30)} 实际=${JSON.stringify(r.got)}` + (r.ok ? '' : ` 期望=${JSON.stringify(r.want)}`));
}
const bad = results.filter((r) => !r.ok).length;
console.log(bad ? `\n❌ ${bad} 项不符` : `\n✅ ${results.length} 项全部通过`);
process.exit(bad ? 1 : 0);
