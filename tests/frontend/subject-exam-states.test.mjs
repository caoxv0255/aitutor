// 学科卷模板页验收：六态 + ?subject= 参数化（9 科白名单）+ 试卷/报告双视图 + 错误分类
// 规格出处：SPEC-ROUTES:73（模板化 12→1）/ PLAN-v2-migration:104 / PM-BRIEF B.3:179 参数风格
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const DIR = 'frontend-v2';
const html = fs.readFileSync(`${DIR}/subject-exam.html`, 'utf8');
const uiJs = fs.readFileSync(`${DIR}/assets/js/ui.js`, 'utf8');
const apiJs = fs.readFileSync(`${DIR}/assets/js/api.js`, 'utf8');
const subjectsJs = fs.readFileSync(`${DIR}/assets/js/subjects.js`, 'utf8');
const pageJs = fs.readFileSync(`${DIR}/assets/js/subject-exam.js`, 'utf8');
const qbRenderJs = fs.readFileSync(`${DIR}/assets/js/qb-render.js`, 'utf8');

const inlined = html
  .replace(/<script src="[^"]*ui\.js"><\/script>/, `<script>${uiJs}</script>`)
  .replace(/<script src="[^"]*api\.js"><\/script>/, `<script>${apiJs}</script>`)
  .replace(/<script src="[^"]*subjects\.js"><\/script>/, `<script>${subjectsJs}</script>`)
  .replace(/<script src="[^"]*qb-render\.js"><\/script>/, () => `<script>${qbRenderJs}</script>`)
  .replace(/<script src="[^"]*subject-exam\.js"><\/script>/, `<script>${pageJs}</script>`);

// 后端真实形状（AIAPI.request 已解包 data）：
const PAPERS = [
  { id: 21, title: '2024年物理试卷', year: 2024, subject: 'physics', province_name: '全国', paper_type_label: '全国乙卷', question_count: 20, total_score: 110 },
  { id: 22, title: '2023年物理试卷', year: 2023, subject: 'physics', province_name: '北京', paper_type_label: '', question_count: 20, total_score: 110 },
];
const QUESTIONS = {
  paper: PAPERS[0],
  data: [
    { id: 1, question_number: 1, question_type: '单选', stem: '物理题一', options: ['A．x', 'B．y', 'C．z', 'D．w'], answer: 'C', analysis: '由公式得。', difficulty: 3, score: 4 },
    { id: 2, question_number: 2, question_type: '单选', stem: '物理题二', options: null, answer: null, analysis: null, difficulty: 3, score: 4 },
    { id: 3, question_number: 3, question_type: '填空', stem: '物理题三', options: null, answer: '10 m/s', analysis: null, difficulty: 4, score: 5 },
  ],
};
// GET /api/exam/session/history → data[{...exam_sessions 行}]（含 subject 列）
const HISTORY = {
  data: [
    { id: 's1', subject: 'physics', accuracy: '82.5', score: 90, total_score: 110, correct_count: 16, question_count: 20, status: 'completed', started_at: '2026-09-20T08:00:00Z', completed_at: '2026-09-20T09:30:00Z' },
    { id: 's2', subject: 'math', accuracy: '70.0', score: 105, total_score: 150, correct_count: 14, question_count: 22, status: 'completed', started_at: '2026-09-19T08:00:00Z', completed_at: '2026-09-19T09:00:00Z' },
  ],
};

function boot(url) {
  const dom = new JSDOM(inlined, { runScripts: 'dangerously', url, pretendToBeVisual: true });
  const w = dom.window;
  w.fetch = () => Promise.reject(new Error('no network in test'));
  w.localStorage.setItem('authToken', 'stub-token');
  return new Promise((res) => w.addEventListener('load', () => res(w)));
}

const results = [];
const check = (name, got, want) => results.push({ ok: got === want, name, got, want });
const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));

const window = await boot('https://x.dev/subject-exam.html?subject=physics');
const P = window.SubjectExam;
const doc = window.document;
const $ = (id) => doc.getElementById(id);
const visible = () => doc.querySelectorAll('.state.is-on').length;

let lastPaths = [];
window.AIAPI.request = (path) => {
  lastPaths.push(path);
  if (path.startsWith('/api/exam/papers')) return Promise.resolve({ data: PAPERS });
  if (path.startsWith('/api/exam/questions/')) return Promise.resolve(QUESTIONS);
  if (path.startsWith('/api/exam/session/history')) return Promise.resolve(HISTORY);
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

// 4. ?subject=physics 生效，试卷 + 报告两个端点都被请求
window.AIAPI.request = (path) => {
  lastPaths.push(path);
  if (path.startsWith('/api/exam/papers')) return Promise.resolve({ data: PAPERS });
  if (path.startsWith('/api/exam/questions/')) return Promise.resolve(QUESTIONS);
  if (path.startsWith('/api/exam/session/history')) return Promise.resolve(HISTORY);
  return Promise.resolve({});
};
lastPaths = [];
await P.load();
check('成功态', P.getState(), 'success');
check('subject 参数来自 URL', P.data.subject, 'physics');
check('papers 请求带 subject', lastPaths.includes('/api/exam/papers?limit=20&subject=physics'), true);
check('history 请求发出', lastPaths.includes('/api/exam/session/history?limit=50'), true);
check('页面标题带学科', $('exam-title').textContent, '物理卷');

// 5. 模板学科下拉：AISubjects 9 科
const sel = $('subject-select');
check('学科下拉 9 项（9 科复用）', sel.options.length, 9);
check('当前学科 physics', sel.value, 'physics');

// 6. 试卷 tab：列表渲染
check('默认试卷 tab', $('tab-paper').hidden, false);
check('试卷行 2 条', doc.querySelectorAll('#paper-list .paper-row').length, 2);
check('试卷标题来自接口', doc.querySelector('#paper-list .task-name').textContent, '2024年物理试卷');

// 7. 打开整卷：按题型分段 + 答案折叠（answer/analysis 缺失则不出折叠按钮）
await P.openPaper(21);
check('整卷请求路径', lastPaths[lastPaths.length - 1], '/api/exam/questions/21');
check('题型分段标题', [...doc.querySelectorAll('#question-list .section-title')].map((n) => n.textContent).join('|'), '单选题|填空题');
check('题目卡 3 张', doc.querySelectorAll('#question-list .q-card').length, 3);
check('答案折叠按钮只在有答案的题', doc.querySelectorAll('#question-list .ans-toggle').length, 2);
const t1 = doc.querySelector('#question-list .ans-toggle');
const b1 = doc.querySelector('#question-list .ans-block');
t1.click();
check('展开答案与解析', b1.hidden, false);
check('解析透传', /由公式得/.test(b1.textContent), true);

// 8. 报告 tab：按当前学科客户端过滤（不显示 math 的会话）
doc.querySelector('#exam-tabs .tab[data-tab="report"]').click();
check('报告 tab 可见', $('tab-report').hidden, false);
check('只显示 physics 会话 1 条', doc.querySelectorAll('#report-list .task-row').length, 1);
check('报告含得分/正确率', /得分 90\/110/.test($('report-list').textContent) && /正确率 82.5%/.test($('report-list').textContent), true);

// 9. 切学科 → URL 同步 + 重取
lastPaths = [];
sel.value = 'chemistry';
sel.dispatchEvent(new window.Event('change'));
await tick(0);
check('切学科后请求 subject=chemistry', lastPaths.includes('/api/exam/papers?limit=20&subject=chemistry'), true);
check('URL 已同步', window.location.search, '?subject=chemistry');
check('标题切为化学卷', $('exam-title').textContent, '化学卷');

// 10. 该学科无试卷 → empty
window.AIAPI.request = (path) => {
  if (path.startsWith('/api/exam/papers')) return Promise.resolve({ data: [] });
  return Promise.resolve({ data: [] });
};
await P.load();
check('无试卷 → empty', P.getState(), 'empty');
check('空态不伪造', $('empty-note').hidden, true);

// 11. 未知 ?subject= → 空态说明 + 不发请求（不伪造数据）
let invalidCalls = 0;
const w2 = await boot('https://x.dev/subject-exam.html?subject=hack');
w2.AIAPI.request = () => {
  invalidCalls += 1;
  return Promise.resolve({});
};
await tick(0);
check('未知学科 → 空态', w2.SubjectExam.getState(), 'empty');
check('未知学科不发请求', invalidCalls, 0);
check('参数说明可见', w2.document.getElementById('empty-note').hidden, false);
check('说明列出可用学科', /chinese \/ math \/ english/.test(w2.document.getElementById('empty-note-copy').textContent), true);

// 12. 加载失败分类
window.AIAPI.request = () => Promise.reject(window.AIAPI.ApiError('获取学科卷失败', { status: 500 }));
await P.load();
check('加载 500 → error', P.getState(), 'error');
check('加载 500 文案透传', $('error-copy').textContent, '获取学科卷失败');
window.AIAPI.request = () => Promise.reject(window.AIAPI.ApiError('未授权', { status: 401 }));
await P.load();
check('加载 401 → auth', P.getState(), 'auth');
window.AIAPI.request = () => Promise.reject(window.AIAPI.ApiError('网络连接不可用', { kind: 'network' }));
await P.load();
check('加载网络失败 → offline', P.getState(), 'offline');

for (const r of results) {
  console.log(
    `${r.ok ? 'OK  ' : 'FAIL'} ${r.name.padEnd(30)} 实际=${JSON.stringify(r.got)}` + (r.ok ? '' : ` 期望=${JSON.stringify(r.want)}`)
  );
}
const bad = results.filter((r) => !r.ok).length;
console.log(bad ? `\n❌ ${bad} 项不符` : `\n✅ ${results.length} 项全部通过`);
process.exit(bad ? 1 : 0);
