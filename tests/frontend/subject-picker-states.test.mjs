// 选科策略页验收：六态 + 学科卡（AISubjects 单一数据源）+ 上限联动 + 保存契约 + 错误分类
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const DIR = 'frontend-v2';
const html = fs.readFileSync(`${DIR}/subject-picker.html`, 'utf8');
const uiJs = fs.readFileSync(`${DIR}/assets/js/ui.js`, 'utf8');
const apiJs = fs.readFileSync(`${DIR}/assets/js/api.js`, 'utf8');
const subjectsJs = fs.readFileSync(`${DIR}/assets/js/subjects.js`, 'utf8');
const pageJs = fs.readFileSync(`${DIR}/assets/js/subject-picker.js`, 'utf8');

const inlined = html
  .replace(/<script src="[^"]*ui\.js"><\/script>/, `<script>${uiJs}</script>`)
  .replace(/<script src="[^"]*api\.js"><\/script>/, `<script>${apiJs}</script>`)
  .replace(/<script src="[^"]*subjects\.js"><\/script>/, `<script>${subjectsJs}</script>`)
  .replace(/<script src="[^"]*subject-picker\.js"><\/script>/, `<script>${pageJs}</script>`);

const dom = new JSDOM(inlined, {
  runScripts: 'dangerously',
  url: 'https://x.dev/subject-picker.html',
  pretendToBeVisual: true,
});
const { window } = dom;
window.fetch = () => Promise.reject(new Error('no network in test'));
window.localStorage.setItem('authToken', 'stub-token');
await new Promise((res) => window.addEventListener('load', res));

const P = window.SubjectPicker;
const results = [];
const check = (name, got, want) => results.push({ ok: got === want, name, got, want });
const doc = window.document;
const $ = (id) => doc.getElementById(id);
const visible = () => doc.querySelectorAll('.state.is-on').length;
const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));

// 后端真实形状：GET /api/user/subjects → { data:[{subject_code,is_main,…}] }
const ROWS = [
  { subject_code: 'chinese', is_main: true, subject_name: '语文' },
  { subject_code: 'math', is_main: true, subject_name: '数学' },
  { subject_code: 'english', is_main: true, subject_name: '英语' },
  { subject_code: 'physics', is_main: false, subject_name: '物理' },
  { subject_code: 'chemistry', is_main: false, subject_name: '化学' },
  { subject_code: 'history', is_main: false, subject_name: '历史' },
];

let lastPath = '';
let lastOptions = null;
window.AIAPI.request = (path, options) => {
  lastPath = path;
  lastOptions = options || null;
  if (path === '/api/user/subjects') return Promise.resolve({ data: ROWS });
  if (path === '/api/user/profile') {
    return Promise.resolve({ data: { initialized: true, exam_level: 'gaokao' } });
  }
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
  return Promise.resolve({ data: ROWS });
};
await P.load();
check('离线 → offline', P.getState(), 'offline');
check('离线不发请求', calls, 0);
Object.defineProperty(window.navigator, 'onLine', { value: true, configurable: true });

// 4. 空选科 → empty 态 + 默认组合出口
window.AIAPI.request = (path) => {
  if (path === '/api/user/subjects') return Promise.resolve({ data: [] });
  return Promise.resolve({ data: { initialized: true, exam_level: 'gaokao' } });
};
await P.load();
check('空选科 → empty', P.getState(), 'empty');
$('empty-start-btn').click();
check('默认组合出口 → success', P.getState(), 'success');
check('默认组合 6 科', $('subject-count').textContent, '6');

// 5. 有选科 → success，学科卡来自 AISubjects（9 科、顺序即 PM §B.2）
window.AIAPI.request = (path) => {
  lastPath = path;
  if (path === '/api/user/subjects') return Promise.resolve({ data: ROWS });
  if (path === '/api/user/profile') {
    return Promise.resolve({ data: { initialized: true, exam_level: 'gaokao' } });
  }
  return Promise.resolve({});
};
await P.load();
await tick(0);
check('有选科 → success', P.getState(), 'success');
const cards = [...doc.querySelectorAll('#subject-grid .pick-card')];
check('学科卡数量 9', cards.length, 9);
check(
  '学科卡顺序来自 AISubjects',
  cards.map((b) => b.dataset.subject).join(','),
  window.AISubjects.LIST.map((s) => s.code).join(',')
);
check('主科锁定 3 张', doc.querySelectorAll('#subject-grid .pick-card--locked').length, 3);
check('已选回填 6 科', $('subject-count').textContent, '6');
check('高考上限提示', $('subject-limit').textContent, '（高考最多 6 科）');

// 6. 中考区上限放宽到 9（exam_level=zhongkao）
window.AIAPI.request = (path) => {
  if (path === '/api/user/subjects') {
    return Promise.resolve({
      data: window.AISubjects.LIST.map((s) => ({ subject_code: s.code, is_main: false })),
    });
  }
  if (path === '/api/user/profile') {
    return Promise.resolve({ data: { initialized: true, exam_level: 'zhongkao' } });
  }
  return Promise.resolve({});
};
await P.load();
check('中考区 9 科全开', $('subject-count').textContent, '9');
check('中考区上限提示', $('subject-limit').textContent, '（中考 9 科全开）');

// 7. 高考区第 7 科被拒（上限来自档案 exam_level，不伪造）
window.AIAPI.request = (path) => {
  if (path === '/api/user/subjects') return Promise.resolve({ data: ROWS });
  if (path === '/api/user/profile') {
    return Promise.resolve({ data: { initialized: true, exam_level: 'gaokao' } });
  }
  return Promise.resolve({});
};
await P.load();
doc.querySelector('#subject-grid .pick-card[data-subject="biology"]').click();
check('第 7 科被拒', $('subject-count').textContent, '6');
check('超限提示可见', $('picker-error').hidden, false);
check('超限文案', /高考只能选 6 科/.test($('picker-error').textContent), true);

// 8. 取消一科后可再选
doc.querySelector('#subject-grid .pick-card[data-subject="history"]').click();
check('取消后 5 科', $('subject-count').textContent, '5');
doc.querySelector('#subject-grid .pick-card[data-subject="biology"]').click();
check('再选后 6 科', $('subject-count').textContent, '6');
check('超限提示已清除', $('picker-error').hidden, true);

// 9. 保存契约：路径 / 方法 / body（按 AISubjects 顺序，主科 is_main）
let body = null;
window.AIAPI.request = (path, options) => {
  lastPath = path;
  lastOptions = options || null;
  body = options && options.body;
  return Promise.resolve({ success: true });
};
const outcome = await P.save();
check('保存路径', lastPath, '/api/user/subjects');
check('保存方法', lastOptions && lastOptions.method, 'POST');
check('body.subjects 数量', body.subjects.length, 6);
check('主科 is_main 3 门', body.subjects.filter((s) => s.is_main).length, 3);
check(
  'body 学科顺序与 AISubjects 一致',
  body.subjects.map((s) => s.code).join(','),
  window.AISubjects.LIST.filter((s) => P.data.selected.has(s.code)).map((s) => s.code).join(',')
);
check('保存成功提示', $('picker-saved').hidden, false);
check('保存返回 saved', outcome, 'saved');

// 10. 保存失败分类
window.AIAPI.request = () => Promise.reject(window.AIAPI.ApiError('无效的学科代码: xxx', { status: 400 }));
const errOutcome = await P.save();
check('400 → 行内错误（仍是 success 态）', P.getState(), 'success');
check('400 文案透传', /无效的学科代码/.test($('picker-error').textContent), true);
check('保存返回 error', errOutcome, 'error');

window.AIAPI.request = () => Promise.reject(window.AIAPI.ApiError('未授权', { status: 401 }));
await P.save();
check('401 → auth', P.getState(), 'auth');

window.AIAPI.request = () => Promise.reject(window.AIAPI.ApiError('网络连接不可用', { kind: 'network' }));
await P.save();
check('网络失败 → offline', P.getState(), 'offline');

// 11. 加载失败分类（整页）
window.AIAPI.request = () => Promise.reject(window.AIAPI.ApiError('获取用户选科失败', { status: 500 }));
await P.load();
check('加载 500 → error', P.getState(), 'error');
check('加载 500 文案透传', $('error-copy').textContent, '获取用户选科失败');

// 12. 档案拉取失败不拖垮整页（按高考兜底）
window.AIAPI.request = (path) => {
  if (path === '/api/user/subjects') return Promise.resolve({ data: ROWS });
  return Promise.reject(window.AIAPI.ApiError('获取用户档案失败', { status: 500 }));
};
await P.load();
check('profile 失败 → 仍 success', P.getState(), 'success');
check('profile 失败 → 高考兜底上限', P.data.maxSubjects, 6);

for (const r of results) {
  console.log(
    `${r.ok ? 'OK  ' : 'FAIL'} ${r.name.padEnd(26)} 实际=${JSON.stringify(r.got)}` + (r.ok ? '' : ` 期望=${JSON.stringify(r.want)}`)
  );
}
const bad = results.filter((r) => !r.ok).length;
console.log(bad ? `\n❌ ${bad} 项不符` : `\n✅ ${results.length} 项全部通过`);
process.exit(bad ? 1 : 0);
