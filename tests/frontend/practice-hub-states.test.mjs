// 练习中心验收：六态 + 组卷/交卷入参 + 标度（accuracy 已是百分比）+ 选项三种形态
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const DIR = 'frontend-v2';
const html = fs.readFileSync(`${DIR}/practice-hub.html`, 'utf8');
const uiJs = fs.readFileSync(`${DIR}/assets/js/ui.js`, 'utf8');
const apiJs = fs.readFileSync(`${DIR}/assets/js/api.js`, 'utf8');
const subjectsJs = fs.readFileSync(`${DIR}/assets/js/subjects.js`, 'utf8');
const pageJs = fs.readFileSync(`${DIR}/assets/js/practice-hub.js`, 'utf8');
const qbRenderJs = fs.readFileSync(`${DIR}/assets/js/qb-render.js`, 'utf8');

const inlined = html
  .replace(/<script src="[^"]*ui\.js"><\/script>/, `<script>${uiJs}</script>`)
  .replace(/<script src="[^"]*api\.js"><\/script>/, `<script>${apiJs}</script>`)
  .replace(/<script src="[^"]*subjects\.js"><\/script>/, `<script>${subjectsJs}</script>`)
  .replace(/<script src="[^"]*qb-render\.js"><\/script>/, () => `<script>${qbRenderJs}</script>`)
  .replace(/<script src="[^"]*practice-hub\.js"><\/script>/, `<script>${pageJs}</script>`);

const dom = new JSDOM(inlined, {
  runScripts: 'dangerously',
  url: 'https://x.dev/practice-hub.html',
  pretendToBeVisual: true,
});
const { window } = dom;
window.fetch = () => Promise.reject(new Error('no network in test'));
window.localStorage.setItem('authToken', 'stub-token');
await new Promise((res) => window.addEventListener('load', res));

const P = window.PracticeHub;
const results = [];
const check = (name, got, want) => results.push({ ok: got === want, name, got, want });
const doc = window.document;
const visible = () => doc.querySelectorAll('.state.is-on').length;
const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));

const SESSION = {
  sessionId: 'sess-1',
  totalQuestions: 3,
  timeLimit: 120,
  subject: 'math',
  questions: [
    { id: 1, stem: '题干一', options: ['甲', '乙', '丙'], question_type: '单选', year: 2024, province_name: '北京' },
    { id: 2, stem: '题干二', options: [{ key: 'A', text: '选项A' }, { key: 'B', text: '选项B' }] },
    { id: 3, stem: '主观题干', options: null },
  ],
};
// accuracy 是后端算好的百分比字符串，且按得分加权
const RESULT = {
  sessionId: 'sess-1',
  totalQuestions: 3,
  correctCount: 2,
  accuracy: '82.5',
  earnedScore: 8.25,
  totalScore: 10,
  results: [
    { questionId: 1, isCorrect: true, correctAnswer: '甲' },
    { questionId: 2, isCorrect: true, correctAnswer: 'A' },
    { questionId: 3, isCorrect: false, correctAnswer: '答案三' },
  ],
};

window.AIAPI.practiceHistory = () => Promise.resolve({ sessions: [{ subject: 'math', started_at: '2026-09-20T10:00:00Z', accuracy: '70.0' }], total: 1 });
window.AIAPI.startPractice = () => Promise.resolve(SESSION);
window.AIAPI.submitPractice = () => Promise.resolve(RESULT);

// 学科下拉统一到 9 科（subjects.js fillSelect，subject 必填无「全部」，默认数学）
const subjectCodes = [...doc.querySelectorAll('#subject-select option')].map((o) => o.value);
check('学科下拉 9 科', subjectCodes.join(','), 'chinese,math,english,physics,chemistry,biology,history,geography,politics');
check('学科下拉默认数学', doc.getElementById('subject-select').value, 'math');
check('组卷入口无「全部」项', subjectCodes.includes(''), false);

// 1. 六态与互斥
const panels = [...doc.querySelectorAll('[data-state]')].map((n) => n.getAttribute('data-state'));
check('六态面板', panels.sort().join(','), P.STATES.slice().sort().join(','));
for (const s of P.STATES) {
  P.setState(s);
  check(`setState(${s})`, P.getState(), s);
  check(`setState(${s}) 互斥`, visible(), 1);
}

// 2. options 三种形态
check('字符串数组', P.normalizeOptions(['甲', '乙']).map((o) => o.value).join(','), 'A,B');
check('对象数组', P.normalizeOptions([{ key: 'A', text: 'x' }])[0].label, 'A. x');
check('null → 空', P.normalizeOptions(null).length, 0);
check('JSON 字符串', P.normalizeOptions('["甲"]')[0].value, 'A');

// 3. 无 token → auth；离线不发请求
window.localStorage.removeItem('authToken');
await P.start();
check('无 token → auth', P.getState(), 'auth');
window.localStorage.setItem('authToken', 'stub-token');

Object.defineProperty(window.navigator, 'onLine', { value: false, configurable: true });
let startCalls = 0;
window.AIAPI.startPractice = () => { startCalls += 1; return Promise.resolve(SESSION); };
await P.start();
check('离线 → offline', P.getState(), 'offline');
check('离线不发请求', startCalls, 0);
Object.defineProperty(window.navigator, 'onLine', { value: true, configurable: true });

// 4. 组卷入参 + 进入答题视图
let sentStart = null;
window.AIAPI.startPractice = (payload) => { sentStart = payload; return Promise.resolve(SESSION); };
doc.getElementById('subject-select').value = 'physics';
doc.getElementById('count-select').value = '10';
await P.start();
check('组卷 subject', sentStart && sentStart.subject, 'physics');
check('组卷 question_count 为数字', typeof (sentStart && sentStart.question_count), 'number');
check('组卷题量值', sentStart && sentStart.question_count, 10);
check('组卷带 time_limit', sentStart && sentStart.time_limit, 120);
check('进入答题视图', doc.getElementById('view-quiz').hidden, false);
check('组卷视图隐藏', doc.getElementById('view-setup').hidden, true);
check('进度文案', doc.getElementById('quiz-progress').textContent, '第 1 / 3 题');
check('题干显示', doc.getElementById('quiz-stem').textContent, '题干一');
check('选项渲染 3 个', doc.querySelectorAll('#quiz-options button').length, 3);
check('无匹配题目 meta 含省市年份', /北京 · 2024年 · 单选/.test(doc.getElementById('quiz-meta').textContent), true);

// 5. 选项点击记录答案 + 下一题
doc.querySelectorAll('#quiz-options button')[1].dispatchEvent(new window.Event('click', { bubbles: true }));
await tick(0);
check('已作答 1 题', P.getAnswersSize(), 1);
check('提示文案', doc.getElementById('answer-hint').textContent, '已作答 1 / 3 题');
doc.getElementById('next-btn').dispatchEvent(new window.Event('click'));
await tick(0);
check('翻到第 2 题', P.getIndex(), 1);
check('对象型选项渲染', doc.querySelectorAll('#quiz-options button').length, 2);
check('对象型选项文案', doc.querySelectorAll('#quiz-options button')[0].textContent, 'A. 选项A');
doc.querySelectorAll('#quiz-options button')[0].dispatchEvent(new window.Event('click', { bubbles: true }));
await tick(0);

// 6. 主观题用输入框
doc.getElementById('next-btn').dispatchEvent(new window.Event('click'));
await tick(0);
check('第 3 题显示输入框', doc.getElementById('quiz-text-wrap').hidden, false);
check('第 3 题无选项按钮', doc.querySelectorAll('#quiz-options button').length, 0);
const input = doc.getElementById('quiz-text');
input.value = '我的答案';
input.dispatchEvent(new window.Event('input', { bubbles: true }));
await tick(0);
check('主观题计入作答数', P.getAnswersSize(), 3);

// 7. 交卷入参
let sentSubmit = null;
window.AIAPI.submitPractice = (payload) => { sentSubmit = payload; return Promise.resolve(RESULT); };
doc.getElementById('submit-paper-btn').dispatchEvent(new window.Event('click', { bubbles: true }));
await tick(20);
check('交卷 sessionId', sentSubmit && sentSubmit.sessionId, 'sess-1');
check('交卷答案条数', sentSubmit && sentSubmit.answers.length, 3);
check('答案含 questionId', sentSubmit && sentSubmit.answers[0].questionId, 1);
check('答案含 answer', sentSubmit && typeof sentSubmit.answers[0].answer, 'string');

// 8. 结果：标度不得重复乘（G6 类错误）
check('结果视图可见', doc.getElementById('view-result').hidden, false);
check('accuracy 直接显示', doc.getElementById('result-score').textContent, '82.5');
check('accuracy 未重复乘', doc.getElementById('result-score').textContent === '8250.0' ? 'BAD' : '82.5', '82.5');
check('meta 含答对题数', /答对 2 \/ 3 题/.test(doc.getElementById('result-meta').textContent), true);
check('meta 说明是加权分', /按得分加权/.test(doc.getElementById('result-meta').textContent), true);
check('逐题结果条数', doc.querySelectorAll('#result-list .topic-row').length, 3);
check('错题显示正确答案', /正确答案：答案三/.test(doc.getElementById('result-list').textContent), true);

// 9. 无匹配题目 → empty（后端 404 语义是"空"不是"错误"）
window.AIAPI.startPractice = () => Promise.reject(window.AIAPI.ApiError('没有找到符合条件的题目', { status: 404 }));
await P.start();
check('404 → empty', P.getState(), 'empty');
check('空态文案', doc.getElementById('empty-copy').textContent, '该学科下暂时没有匹配的题目，换个学科试试。');

// 10. 错误分类
window.AIAPI.startPractice = () => Promise.reject(window.AIAPI.ApiError('创建考试会话失败', { status: 500 }));
await P.start();
check('500 → error', P.getState(), 'error');
check('500 文案透传', doc.getElementById('error-copy').textContent, '创建考试会话失败');

window.AIAPI.startPractice = () => Promise.reject(window.AIAPI.ApiError('未授权', { status: 401 }));
await P.start();
check('401 → auth', P.getState(), 'auth');

window.AIAPI.startPractice = () => Promise.reject(window.AIAPI.ApiError('网络连接不可用', { kind: 'network' }));
await P.start();
check('网络失败 → offline', P.getState(), 'offline');

// 11. 防重复交卷（会真实写入 practice_records / wrong_questions）
window.AIAPI.startPractice = () => Promise.resolve(SESSION);
await P.start();
await tick(0);
let submitCalls = 0;
let release;
window.AIAPI.submitPractice = () => {
  submitCalls += 1;
  return new Promise((res) => { release = res; });
};
const btn = doc.getElementById('submit-paper-btn');
btn.dispatchEvent(new window.Event('click', { bubbles: true }));
await tick(10);
btn.dispatchEvent(new window.Event('click', { bubbles: true }));
await tick(10);
check('并发交卷只发一次', submitCalls, 1);
check('交卷中按钮禁用', btn.disabled, true);
release(RESULT);
await tick(20);

for (const r of results) {
  console.log(`${r.ok ? 'OK  ' : 'FAIL'} ${r.name.padEnd(30)} 实际=${JSON.stringify(r.got)}` + (r.ok ? '' : ` 期望=${JSON.stringify(r.want)}`));
}
const bad = results.filter((r) => !r.ok).length;
console.log(bad ? `\n❌ ${bad} 项不符` : `\n✅ ${results.length} 项全部通过`);
process.exit(bad ? 1 : 0);
