// 学习路径验收：六态 + 标度（0..100 直显）+ 跨树 URL 映射（G8）+ 空态由后端驱动
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const DIR = 'frontend-v2';
const html = fs.readFileSync(`${DIR}/learning-path.html`, 'utf8');
const uiJs = fs.readFileSync(`${DIR}/assets/js/ui.js`, 'utf8');
const apiJs = fs.readFileSync(`${DIR}/assets/js/api.js`, 'utf8');
const subjectsJs = fs.readFileSync(`${DIR}/assets/js/subjects.js`, 'utf8');
const pageJs = fs.readFileSync(`${DIR}/assets/js/learning-path.js`, 'utf8');

const inlined = html
  .replace(/<script src="[^"]*ui\.js"><\/script>/, `<script>${uiJs}</script>`)
  .replace(/<script src="[^"]*api\.js"><\/script>/, `<script>${apiJs}</script>`)
  .replace(/<script src="[^"]*subjects\.js"><\/script>/, `<script>${subjectsJs}</script>`)
  .replace(/<script src="[^"]*learning-path\.js"><\/script>/, `<script>${pageJs}</script>`);

const dom = new JSDOM(inlined, {
  runScripts: 'dangerously',
  url: 'https://x.dev/learning-path.html',
  pretendToBeVisual: true,
});
const { window } = dom;
window.fetch = () => Promise.reject(new Error('no network in test'));
window.localStorage.setItem('authToken', 'stub-token');
await new Promise((res) => window.addEventListener('load', res));

const L = window.LearningPath;
const results = [];
const check = (name, got, want) => results.push({ ok: got === want, name, got, want });
const doc = window.document;
const visible = () => doc.querySelectorAll('.state.is-on').length;

// 后端真实形状（global_progress_pct / stage.progress_pct 均为 0..100）
const DATA = {
  subject: 'math',
  recommendation_reason: '近 7 天你在「导数与切线」错了 4 次，先固化这一块。',
  cited_stats: [{ icon: 'alert-triangle', label: '近 7 天 4 次错' }, { icon: 'clock', label: '共 12 条错题' }],
  global_progress_pct: 62,
  stages: [
    { id: 'basic', name: '基础巩固', status: 'completed', description: '夯实基础概念' },
    { id: 'method', name: '方法训练', status: 'current', description: '掌握典型题型', progress_pct: 48 },
    { id: 'variant', name: '变式应用', status: 'pending', description: '含参动点等变式' },
    { id: 'comprehensive', name: '综合提升', status: 'pending', description: '跨章节综合' },
  ],
  today_task: {
    id: 't-1',
    title: '复习「导数与切线」相关错题',
    reason: '这些题到了复习时间。',
    topic: '导数与切线',
    target_url: '/review.html?session=auto&kp=kp_dt',
  },
};

window.AIAPI.learningPath = () => Promise.resolve(DATA);

// 1. 六态与互斥
const panels = [...doc.querySelectorAll('[data-state]')].map((n) => n.getAttribute('data-state'));
check('六态面板', panels.sort().join(','), L.STATES.slice().sort().join(','));
for (const s of L.STATES) {
  L.setState(s);
  check(`setState(${s})`, L.getState(), s);
  check(`setState(${s}) 互斥`, visible(), 1);
}

// 2. 跨树 URL 映射（G8：后端给的路径有两个生产 404，不得直接渲染）
check('review.html → review-session', L.resolveTarget('/review.html?session=auto&kp=kp_dt'), '/review-session.html?session=auto&kp=kp_dt');
check('photo-search → photo-solve', L.resolveTarget('/photo-search.html'), '/photo-solve.html');
check('onboarding → photo-solve', L.resolveTarget('/onboarding.html?step=diagnose'), '/photo-solve.html?step=diagnose');
check('已知路径保留 query', L.resolveTarget('/wrong-book.html?a=1'), '/wrong-book.html?a=1');
check('未知路径返回 null（不放死链）', L.resolveTarget('/unknown-page.html'), null);
check('空值返回 null', L.resolveTarget(null), null);

// 3. 无 token → auth；离线不发请求
window.localStorage.removeItem('authToken');
await L.load();
check('无 token → auth', L.getState(), 'auth');
window.localStorage.setItem('authToken', 'stub-token');

Object.defineProperty(window.navigator, 'onLine', { value: false, configurable: true });
let called = 0;
window.AIAPI.learningPath = () => { called += 1; return Promise.resolve(DATA); };
await L.load();
check('离线 → offline', L.getState(), 'offline');
check('离线不发请求', called, 0);
Object.defineProperty(window.navigator, 'onLine', { value: true, configurable: true });

// 4. 空态由后端 empty_state 驱动
window.AIAPI.learningPath = () =>
  Promise.resolve({
    subject: 'math',
    empty_state: {
      scenario: 'newUser',
      title: '学习路径还没准备好',
      description: '先做几道诊断题，aitutor 就能为你定制专属学习路径。',
      primary_action: { label: '去诊断一下', target_url: '/onboarding.html?step=diagnose' },
      secondary_action: { label: '去拍照录题', target_url: '/photo-search.html' },
    },
  });
await L.load();
check('empty_state → empty 态', L.getState(), 'empty');
check('空态标题来自后端', doc.getElementById('empty-title').textContent, '学习路径还没准备好');
check('空态描述来自后端', /先做几道诊断题/.test(doc.getElementById('empty-copy').textContent), true);
check('空态动作数 2', doc.querySelectorAll('#empty-actions a').length, 2);
check('主动作已映射', doc.querySelector('#empty-actions a').getAttribute('href'), '/photo-solve.html?step=diagnose');

// 5. 有数据 → success，标度直显（不得再乘）
window.AIAPI.learningPath = () => Promise.resolve(DATA);
await L.load();
check('有数据 → success', L.getState(), 'success');
check('progress 直显 62', doc.getElementById('progress-value').textContent, '62');
check('progress 未重复乘', doc.getElementById('progress-value').textContent === '6200' ? 'BAD' : '62', '62');
check('meta 已完成阶段 1/4', /已完成阶段 1 \/ 4/.test(doc.getElementById('progress-meta').textContent), true);
check('引用 chips 2 个', doc.querySelectorAll('#cited-stats .chip').length, 2);
check('chip 文案', doc.querySelector('#cited-stats .chip').textContent, '近 7 天 4 次错');
check('推荐理由显示', /导数与切线/.test(doc.getElementById('reason').textContent), true);

// 6. 四阶段时间轴
check('阶段数 4', doc.querySelectorAll('#stage-list .stage').length, 4);
check('首阶段 completed', doc.querySelector('#stage-list .stage').className, 'stage stage--completed');
check('次阶段 current', doc.querySelectorAll('#stage-list .stage')[1].className, 'stage stage--current');
check('末阶段 pending', doc.querySelectorAll('#stage-list .stage')[3].className, 'stage stage--pending');
check('current 阶段有进度条', doc.querySelectorAll('#stage-list .bar-fill').length, 1);
check('current 阶段进度宽度 48%', doc.querySelector('#stage-list .bar-fill').style.width, '48%');
check('阶段名', doc.querySelector('#stage-list .stage-name').textContent, '基础巩固');

// 7. 今日任务 + 目标链接已翻译
check('任务区可见', doc.getElementById('task-block').hidden, false);
check('任务标题', doc.getElementById('task-title').textContent, '复习「导数与切线」相关错题');
check('任务主题', doc.getElementById('task-topic').textContent, '导数与切线');
check('任务链接已映射且保留参数', doc.querySelector('#task-action a').getAttribute('href'), '/review-session.html?session=auto&kp=kp_dt');

// 8. 未知目标 URL → 不渲染死链，改文字说明
window.AIAPI.learningPath = () =>
  Promise.resolve({ ...DATA, today_task: { title: '某任务', target_url: '/legacy-only.html' } });
await L.load();
check('未知目标不渲染 <a>', doc.querySelectorAll('#task-action a').length, 0);
check('未知目标给出说明', /尚未在新版中提供/.test(doc.getElementById('task-action').textContent), true);

// 9. 无今日任务 → 任务区隐藏
window.AIAPI.learningPath = () => Promise.resolve({ ...DATA, today_task: null });
await L.load();
check('无任务隐藏任务区', doc.getElementById('task-block').hidden, true);

// 10. 错误分类
window.AIAPI.learningPath = () => Promise.reject(window.AIAPI.ApiError('获取学习路径失败', { status: 500 }));
await L.load();
check('500 → error', L.getState(), 'error');
check('500 文案透传', doc.getElementById('error-copy').textContent, '获取学习路径失败');

window.AIAPI.learningPath = () => Promise.reject(window.AIAPI.ApiError('未授权', { status: 401 }));
await L.load();
check('401 → auth', L.getState(), 'auth');

window.AIAPI.learningPath = () => Promise.reject(window.AIAPI.ApiError('网络连接不可用', { kind: 'network' }));
await L.load();
check('网络失败 → offline', L.getState(), 'offline');

// 11. 防御性：字段缺失不崩
window.AIAPI.learningPath = () => Promise.resolve({ subject: 'math' });
await L.load();
check('字段缺失仍成功', L.getState(), 'success');
check('缺失 progress 显示 0', doc.getElementById('progress-value').textContent, '0');
check('缺失阶段时间为空列表', doc.querySelectorAll('#stage-list .stage').length, 0);
check('缺失任务隐藏', doc.getElementById('task-block').hidden, true);

for (const r of results) {
  console.log(`${r.ok ? 'OK  ' : 'FAIL'} ${r.name.padEnd(30)} 实际=${JSON.stringify(r.got)}` + (r.ok ? '' : ` 期望=${JSON.stringify(r.want)}`));
}
const bad = results.filter((r) => !r.ok).length;
console.log(bad ? `\n❌ ${bad} 项不符` : `\n✅ ${results.length} 项全部通过`);
process.exit(bad ? 1 : 0);
