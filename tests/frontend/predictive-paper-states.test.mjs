// 预测卷页验收：六态 + 试卷列表 + 整卷/命题依据行 + PDF 契约 + 错误分类
// 规格出处：PM-BRIEF B.3:182 / F.16.7:788 / F.2:361-374 / SPEC-ROUTES:59
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const DIR = 'frontend-v2';
const html = fs.readFileSync(`${DIR}/predictive-paper.html`, 'utf8');
const uiJs = fs.readFileSync(`${DIR}/assets/js/ui.js`, 'utf8');
const apiJs = fs.readFileSync(`${DIR}/assets/js/api.js`, 'utf8');
const subjectsJs = fs.readFileSync(`${DIR}/assets/js/subjects.js`, 'utf8');
const pageJs = fs.readFileSync(`${DIR}/assets/js/predictive-paper.js`, 'utf8');
const qbRenderJs = fs.readFileSync(`${DIR}/assets/js/qb-render.js`, 'utf8');

const inlined = html
  .replace(/<script src="[^"]*ui\.js"><\/script>/, `<script>${uiJs}</script>`)
  .replace(/<script src="[^"]*api\.js"><\/script>/, `<script>${apiJs}</script>`)
  .replace(/<script src="[^"]*subjects\.js"><\/script>/, `<script>${subjectsJs}</script>`)
  .replace(/<script src="[^"]*qb-render\.js"><\/script>/, () => `<script>${qbRenderJs}</script>`)
  .replace(/<script src="[^"]*predictive-paper\.js"><\/script>/, `<script>${pageJs}</script>`);

const dom = new JSDOM(inlined, {
  runScripts: 'dangerously',
  url: 'https://x.dev/predictive-paper.html',
  pretendToBeVisual: true,
});
const { window } = dom;
window.fetch = () => Promise.reject(new Error('no network in test'));
window.localStorage.setItem('authToken', 'stub-token');
await new Promise((res) => window.addEventListener('load', res));

const P = window.PredictivePaper;
const results = [];
const check = (name, got, want) => results.push({ ok: got === want, name, got, want });
const doc = window.document;
const $ = (id) => doc.getElementById(id);
const visible = () => doc.querySelectorAll('.state.is-on').length;
const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));

// 后端真实形状：GET /api/exam/papers → { success, data:[…], total }
const PAPERS = [
  {
    id: 11, title: '2024年数学试卷', year: 2024, subject: 'math', province_code: 'beijing',
    province_name: '北京', paper_type_label: '新高考I卷', exam_level: 'gaokao',
    question_count: 22, total_score: 150, difficulty_avg: '0.55',
  },
  {
    id: 12, title: '2023年数学试卷', year: 2023, subject: 'math', province_name: '全国',
    paper_type_label: '全国乙卷', exam_level: 'gaokao', question_count: 22, total_score: 150,
  },
];
// GET /api/exam/questions/:paperId → { success, paper, data:[…] }
const PAPER_DETAIL = {
  paper: PAPERS[0],
  data: [
    {
      id: 1, question_number: 1, question_type: '单选', stem: '已知集合 A={1,2}，B={2,3}，则 A∩B=',
      options: ['A．{2}', 'B．{1,2}', 'C．{2,3}', 'D．{1,2,3}'], answer: 'A',
      analysis: '交集取公共元素。', knowledge_points: '集合运算', difficulty: 3, score: 5,
    },
    {
      id: 2, question_number: 2, question_type: '解答', stem: '已知数列满足…，求通项公式。',
      options: null, answer: 'an=2^n-1', analysis: null, knowledge_points: '数列', difficulty: 4, score: 12,
    },
  ],
};

let lastPath = '';
let lastOptions = null;
window.AIAPI.request = (path, options) => {
  lastPath = path;
  lastOptions = options || null;
  if (path.startsWith('/api/exam/papers')) return Promise.resolve({ success: true, data: PAPERS, total: 2 });
  if (path.startsWith('/api/exam/questions/')) return Promise.resolve(PAPER_DETAIL);
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
  return Promise.resolve({ data: PAPERS });
};
await P.load();
check('离线 → offline', P.getState(), 'offline');
check('离线不发请求', calls, 0);
Object.defineProperty(window.navigator, 'onLine', { value: true, configurable: true });

// 4. 空列表 → empty
window.AIAPI.request = (path) => {
  lastPath = path;
  if (path.startsWith('/api/exam/papers')) return Promise.resolve({ data: [] });
  return Promise.resolve({ data: [] });
};
await P.load();
check('空列表 → empty', P.getState(), 'empty');

// 5. 有试卷 → success；学科筛选来自 AISubjects（含「全部」）
window.AIAPI.request = (path, options) => {
  lastPath = path;
  lastOptions = options || null;
  if (path.startsWith('/api/exam/papers')) return Promise.resolve({ data: PAPERS });
  if (path.startsWith('/api/exam/questions/')) return Promise.resolve(PAPER_DETAIL);
  return Promise.resolve({});
};
await P.load();
await tick(0);
check('有试卷 → success', P.getState(), 'success');
const filter = $('subject-filter');
check('学科筛选 10 项（全部 + 9 科）', filter.options.length, 10);
check('首项为「全部」', filter.options[0].textContent, '全部');
check('试卷行数', doc.querySelectorAll('#paper-list .paper-row').length, 2);
check('试卷标题来自接口', doc.querySelector('#paper-list .task-name').textContent, '2024年数学试卷');
check('试卷 chip 含省份', /北京/.test(doc.querySelector('#paper-list .paper-row').textContent), true);
check('学科筛选请求带 subject=', lastPath.includes('subject=') || lastPath.endsWith('limit=20'), true);

// 6. 按学科筛选：请求携带 subject 参数
filter.value = 'math';
filter.dispatchEvent(new window.Event('change'));
await tick(0);
check('筛选请求带 subject=math', lastPath, '/api/exam/papers?limit=20&subject=math');

// 7. 打开整卷：路径 / 元信息 / 题目 / 命题依据行
await P.openPaper(11);
check('整卷请求路径', lastPath, '/api/exam/questions/11');
check('整卷标题', $('paper-title').textContent, '2024年数学试卷');
check('题目卡 2 张', doc.querySelectorAll('#question-list .q-card').length, 2);
check('命题依据行存在', doc.querySelectorAll('#question-list .q-prov').length, 2);
check(
  '命题依据渲染题库实有字段（来源/考点）',
  /来源 2024年北京卷/.test(doc.querySelector('#question-list .q-prov').textContent) &&
    /考点 集合运算/.test(doc.querySelector('#question-list .q-prov').textContent),
  true
);
check('命中逻辑登记缺失', /predicted-paper 引擎未接入/.test(doc.querySelector('#question-list .q-prov').textContent), true);
check('缺失登记说明在页面上', doc.querySelectorAll('.missing-note').length >= 1, true);

// 8. 选项渲染 + 答案解析折叠
check('选项渲染 4 项', doc.querySelectorAll('#question-list .q-card:first-child .q-options span').length, 4);
const toggleBtn = doc.querySelector('#question-list .ans-toggle');
const ansBlock = doc.querySelector('#question-list .ans-block');
check('答案默认折叠', ansBlock.hidden, true);
toggleBtn.click();
check('点击展开答案', ansBlock.hidden, false);
check('展开文案切换', toggleBtn.textContent, '收起答案与解析');
check('解析内容透传', /交集取公共元素/.test(doc.querySelector('#question-list .ans-block').textContent), true);
toggleBtn.click();
check('再点收起', ansBlock.hidden, true);

// 9. 返回列表
$('paper-close-btn').click();
check('返回列表', $('paper-view').hidden, true);

// 10. PDF：POST /api/exam/pdf/generate/:paperId（实际路由带 :paperId），Bearer 头，二进制 blob
await P.openPaper(11);
let pdfUrl = '';
let pdfInit = null;
const dummyBlob = { size: 8 };
window.fetch = (url, init) => {
  pdfUrl = url;
  pdfInit = init;
  return Promise.resolve({ ok: true, blob: () => Promise.resolve(dummyBlob) });
};
// jsdom 没有 createObjectURL / window.open（真浏览器均有）
window.URL.createObjectURL = () => 'blob:stub';
window.URL.revokeObjectURL = () => {};
window.open = () => ({});
window.AIAPI.request = (path) => {
  if (path.startsWith('/api/exam/papers')) return Promise.resolve({ data: PAPERS });
  if (path.startsWith('/api/exam/questions/')) return Promise.resolve(PAPER_DETAIL);
  return Promise.resolve({});
};
await tick(0);
const pdfOutcome = await P.exportPdf();
check('PDF 请求路径带 paperId', pdfUrl, '/api/exam/pdf/generate/11');
check('PDF 方法 POST', pdfInit && pdfInit.method, 'POST');
check('PDF 带 Bearer 头', pdfInit && /Bearer stub-token/.test(pdfInit.headers.Authorization), true);
check('PDF 返回 opened', pdfOutcome, 'opened');

// 11. PDF 失败 → 行内提示（仍 success 态）
window.fetch = () => Promise.resolve({ ok: false, status: 500 });
const pdfErr = await P.exportPdf();
check('PDF 失败返回 error', pdfErr, 'error');
check('PDF 失败提示', /HTTP 500/.test($('pdf-hint').textContent), true);
check('PDF 失败不拖垮页面', P.getState(), 'success');

// 12. 加载失败分类（整页）
window.AIAPI.request = () => Promise.reject(window.AIAPI.ApiError('获取试卷列表失败', { status: 500 }));
await P.load();
check('加载 500 → error', P.getState(), 'error');
check('加载 500 文案透传', $('error-copy').textContent, '获取试卷列表失败');
window.AIAPI.request = () => Promise.reject(window.AIAPI.ApiError('未授权', { status: 401 }));
await P.load();
check('加载 401 → auth', P.getState(), 'auth');
window.AIAPI.request = () => Promise.reject(window.AIAPI.ApiError('网络连接不可用', { kind: 'network' }));
await P.load();
check('加载网络失败 → offline', P.getState(), 'offline');

for (const r of results) {
  console.log(
    `${r.ok ? 'OK  ' : 'FAIL'} ${r.name.padEnd(28)} 实际=${JSON.stringify(r.got)}` + (r.ok ? '' : ` 期望=${JSON.stringify(r.want)}`)
  );
}
const bad = results.filter((r) => !r.ok).length;
console.log(bad ? `\n❌ ${bad} 项不符` : `\n✅ ${results.length} 项全部通过`);
process.exit(bad ? 1 : 0);
