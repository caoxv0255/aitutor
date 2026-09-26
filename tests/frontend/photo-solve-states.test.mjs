// 阶段 2 切片验收：用 jsdom 真跑页面脚本，驱动六态 + 接口错误分类
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const DIR = 'frontend-v2';
const html = fs.readFileSync(`${DIR}/photo-solve.html`, 'utf8');
const uiJs = fs.readFileSync(`${DIR}/assets/js/ui.js`, 'utf8');
const apiJs = fs.readFileSync(`${DIR}/assets/js/api.js`, 'utf8');
const subjectsJs = fs.readFileSync(`${DIR}/assets/js/subjects.js`, 'utf8');
const pageJs = fs.readFileSync(`${DIR}/assets/js/photo-solve.js`, 'utf8');
// KaTeX 自托管在 assets/vendor/katex/（零境外请求）；jsdom 不加载外链，同样内联
const katexJs = fs.readFileSync(`${DIR}/assets/vendor/katex/katex.min.js`, 'utf8');

// 外链脚本改成内联，jsdom 不加载本地相对路径
//
// ⚠️ 替换串必须用**函数形式**：String.replace 的替换串里 `$` 是特殊符号
//    （`$'` = 匹配之后的部分、`$&` = 整个匹配…），而 photo-solve.js 里有
//    `'$'` 这种字面量，直接拼模板串会把源码啃坏（报 SyntaxError: Invalid or
//    unexpected token，且症状是脚本"看起来加载了但对象没挂上"）。
const inlined = html
  .replace(/<script src="[^"]*katex\.min\.js"><\/script>/, () => `<script>${katexJs}</script>`)
  .replace(/<script src="[^"]*ui\.js"><\/script>/, () => `<script>${uiJs}</script>`)
  .replace(/<script src="[^"]*api\.js"><\/script>/, () => `<script>${apiJs}</script>`)
  .replace(/<script src="[^"]*subjects\.js"><\/script>/, () => `<script>${subjectsJs}</script>`)
  .replace(/<script src="[^"]*photo-solve\.js"><\/script>/, () => `<script>${pageJs}</script>`);

const dom = new JSDOM(inlined, {
  runScripts: 'dangerously',
  url: 'https://x.dev/photo-solve.html',
  pretendToBeVisual: true
});
const { window } = dom;

// jsdom 未实现的浏览器 API
window.URL.createObjectURL = () => 'blob:stub';
window.FileReader = class {
  readAsDataURL() { this.result = 'data:image/png;base64,AAAA'; this.onload && this.onload(); }
};
window.fetch = () => Promise.reject(new Error('no network in test'));

await new Promise((res) => window.addEventListener('load', res));

const PS = window.PhotoSolve;
const results = [];
const check = (name, got, want) => results.push({ ok: got === want, name, got, want });
const visibleCount = () => window.document.querySelectorAll('.state.is-on').length;

// 1. 六态面板齐备
const panels = [...window.document.querySelectorAll('[data-state]')].map((n) => n.getAttribute('data-state'));
check('六态面板', panels.sort().join(','), PS.STATES.slice().sort().join(','));

// 2. 初始态
check('初始态', PS.getState(), 'empty');
check('初始仅一个面板可见', visibleCount(), 1);

// 3. 逐个切换六态，且互斥
for (const s of PS.STATES) {
  PS.setState(s);
  check(`setState(${s})`, PS.getState(), s);
  check(`setState(${s}) 互斥`, visibleCount(), 1);
}

// 4. 未选择图片 → empty（no-image 文案）
PS.setState('empty');
PS.setFiles([]);
await PS.submit();
check('无图提交 → empty', PS.getState(), 'empty');
check('无图文案', /先添加一张题目照片/.test(window.document.getElementById('empty-copy').textContent), true);

// 5. 离线 → offline
Object.defineProperty(window.navigator, 'onLine', { value: false, configurable: true });
PS.setFiles([{ size: 100 }]);
await PS.submit();
check('离线提交 → offline', PS.getState(), 'offline');
Object.defineProperty(window.navigator, 'onLine', { value: true, configurable: true });

// 6. 无 token → auth
window.localStorage.removeItem('authToken');
await PS.submit();
check('无 token → auth', PS.getState(), 'auth');

// 6b. 空态两类文案（F3 尾巴 P8）：zero-result 分支 = 「未解析出题目」
//     batch-parse 只返回 {questions, failed, *_count}，不做题库匹配 ——
//     「解析成功但题库无匹配/无相似题」无法据此区分，故只断言可区分的两类：
//       no-image（上文 §4 已断言）/ zero-result（本节）。
window.localStorage.setItem('authToken', 'stub-token');
window.AIAPI.batchParse = () =>
  Promise.resolve({ questions: [], failed: [{ pageIndex: 1, error: 'OCR 识别失败' }], success_count: 0, failed_count: 1 });
await PS.submit();
check('空 questions → empty', PS.getState(), 'empty');
check('未解析出题目文案', /这几张图没有解析出题目/.test(window.document.getElementById('empty-copy').textContent), true);

// 7. 有 token + 接口成功 → success，并渲染卡片
window.localStorage.setItem('authToken', 'stub-token');
window.AIAPI.batchParse = () =>
  Promise.resolve({
    questions: [{ pageIndex: 1, content: '已知 x=2，求 x²', subject_code: 'math', difficulty: 3 }],
    failed: [{ pageIndex: 2, error: 'image.data 缺失' }],
    success_count: 1,
    failed_count: 1
  });
await PS.submit();
check('接口成功 → success', PS.getState(), 'success');
check('渲染题目卡片数', window.document.querySelectorAll('#results .q-card').length, 1);
check('渲染失败项', window.document.querySelectorAll('#failed li').length, 1);

// 7b. 收编 pwa-photo / vision-result 后新增的两项（2026-09-22 两页下线）
//     学科下拉 = 原 9 科 + 语文/英语各拆两档（除作文/作文），共 11 项（2026-09-26 修正）；
//     结果区回显真实原图（只回显照片，不造置信度/耗时）
const subjectCodes = [...window.document.querySelectorAll('#subject-select option')].map((o) => o.value);
check(
  '学科下拉 11 项且顺序',
  subjectCodes.join(','),
  'chinese,chinese_essay,math,english,english_essay,physics,chemistry,biology,history,geography,politics'
);
check('结果区回显原图数', window.document.querySelectorAll('#result-images .thumb').length, 1);

// 7c. LaTeX 渲染（2026-09-22 用户反馈：公式以 $...$ 原文出现）
//     mock 用实测 batch-parse 的真实字段形状（raw_text + latex_formulas）
window.AIAPI.batchParse = () =>
  Promise.resolve({
    questions: [{
      pageIndex: 1,
      raw_text: 'Solve x^2 + 2x - 3 = 0',
      latex_formulas: ['$x^2 + 2x - 3 = 0$', '$$S = \\pi \\cdot r^2$$'],
      subject_code: 'math'
    }],
    success_count: 1
  });
await PS.submit();
check('公式渲染成 KaTeX 节点', window.document.querySelectorAll('#results .q-card .katex').length, 2);
check('独立公式独占一块', window.document.querySelectorAll('#results .formula--block').length, 1);
check('题干不重复【公式】段', /【公式】/.test(window.document.getElementById('results').textContent), false);

// 7d. 公式链路的注入面：恶意串走文本节点，不产生元素
window.AIAPI.batchParse = () =>
  Promise.resolve({
    questions: [{
      pageIndex: 1,
      raw_text: '<img src=x onerror="window.__pwned=1">',
      latex_formulas: ['$\\href{javascript:alert(1)}{x}$'],
      analysis: '<script>window.__pwned=1</script>'
    }],
    success_count: 1
  });
await PS.submit();
check('恶意题干未生成元素', window.document.querySelectorAll('#results img').length, 0);
check('恶意分析未生成元素', window.document.querySelectorAll('#results script').length, 0);
check('未执行注入脚本', window.__pwned, undefined);
check('\\href 未被 KaTeX 放行', window.document.querySelectorAll('#results a').length, 0);

// 7e. 结果区可滚动（容器 + 键盘可达）
const scroll = window.document.getElementById('results-scroll');
check('结果区滚动容器存在', !!scroll, true);
check('滚动容器可聚焦', scroll.getAttribute('tabindex'), '0');

// 7f. 相似题区（P8 2026-09-23）：解析成功 → 取首题题干调 /api/vision/similar-by-text
//     （纯检索端点，本页不再走 /api/vision/search 的二次 OCR + LLM）
window.AIAPI.batchParse = () =>
  Promise.resolve({
    questions: [{ pageIndex: 1, raw_text: '已知函数 f(x)=x^2-2x+1，求其最小值', subject_code: 'math' }],
    success_count: 1
  });
let similarCall = null;
window.AIAPI.similarByText = function (text, options) {
  similarCall = { text: text, options: options };
  return Promise.resolve({
    similarQuestions: [{
      id: 'q-1',
      content: '已知函数 g(x)=x^2+2x+3，求其最小值',
      answer: 'B',
      subject_code: 'math',
      difficulty: 3,
      question_type: 'choice',
      similarity: 0.8123
    }],
    similarNotice: null
  });
};
await PS.submit();
check('解析成功 → success', PS.getState(), 'success');
check('有相似题 → 相似题区可见', window.document.getElementById('similar-questions').hidden, false);
check('相似题卡片数', window.document.querySelectorAll('#similar-list .q-card').length, 1);
check('用解析出的首题题干查询', similarCall && similarCall.text, '已知函数 f(x)=x^2-2x+1，求其最小值');
check('透传学科', similarCall && similarCall.options && similarCall.options.subject, 'math');
check('相似度标签', /相似度 81%/.test(window.document.getElementById('similar-list').textContent), true);

// 7g. 解析成功但无相似题 → 展示后端 similarNotice 原文（三类空态的第三类；不编造）
const SIMILAR_NOTICE = '题库中暂未找到达到相似度阈值的题目';
window.AIAPI.similarByText = () =>
  Promise.resolve({ similarQuestions: [], similarNotice: SIMILAR_NOTICE });
await PS.submit();
check('无相似题 → 区仍可见（区别于"没解析出题"）', window.document.getElementById('similar-questions').hidden, false);
check('无相似题 → 列表为空', window.document.querySelectorAll('#similar-list .q-card').length, 0);
check('similarNotice 用后端原文', window.document.getElementById('similar-notice').textContent, SIMILAR_NOTICE);
check('similarNotice 可见', window.document.getElementById('similar-notice').hidden, false);

// 7h. 相似题端点 401 → 如实降级：隐藏相似题区，不改动主成功态
window.AIAPI.similarByText = () => Promise.reject(window.AIAPI.ApiError('未授权', { status: 401 }));
await PS.submit();
check('相似题 401 不影响主成功态', PS.getState(), 'success');
check('相似题 401 → 隐藏相似题区', window.document.getElementById('similar-questions').hidden, true);

// 7i. 题面媒体 token 渲染（P4 多模态读端对接，2026-09-25）
//     batch-parse 的 OCR 题面不含 token；相似题来自题库，stem 里带 ⟦IMG:rIdN⟧ / ⟦F:rIdN⟧
//     占位符，后端随 similarQuestions[].media 下发资产。修复前 token 被当纯文本显示，
//     就是用户看到的"怪符号"。本段锁死：token 必须变成 DOM 节点或可读占位，绝不出现在文本里。
window.AIAPI.similarByText = () =>
  Promise.resolve({
    similarQuestions: [
      {
        id: 'm1',
        // 同一题面混排：图片 + 公式，均带可渲染资产（wmf 已在后端映射到 png_rel）
        content: '如图所示⟦IMG:rId4⟧，且⟦F:rId11⟧。',
        answer: 'A',
        media: [
          { token: 'IMG:rId4', kind: 'figure', ext: '.png', renderable: true, url: '/qb-media-png/ab/ab8e.png' },
          { token: 'F:rId11', kind: 'formula', ext: '.png', renderable: true, url: '/qb-media-png/10/107d.png' },
        ],
      },
      {
        id: 'm2',
        // 取不到资产 → 占位，不显示裸 token
        content: '缺图⟦IMG:rIdX⟧与缺式⟦F:rIdY⟧',
        answer: 'B',
        media: [],
      },
      {
        id: 'm3',
        // 公式无媒体图片但有 latex → 走 KaTeX 兜底
        content: '公式⟦F:rIdZ⟧',
        answer: '',
        media: [{ token: 'F:rIdZ', latex: '$x^2$' }],
      },
    ],
    similarNotice: null,
  });
await PS.submit();
const simList = window.document.getElementById('similar-list');
check('IMG/F token → 图片节点', simList.querySelectorAll('.q-card img').length, 2);
check('公式 latex 兜底 → KaTeX 节点', simList.querySelectorAll('.katex').length >= 1, true);
check('输入框 token 不出现在文本里(IMG)', simList.textContent.includes('⟦IMG:'), false);
check('输入框 token 不出现在文本里(F)', simList.textContent.includes('⟦F:'), false);
check('取不到图片 → 「图片暂缺」占位', simList.textContent.includes('图片暂缺'), true);
check('取不到公式 → 「公式暂缺」占位', simList.textContent.includes('公式暂缺'), true);
const simImg = simList.querySelector('.q-card img');
check('图片有 alt', !!simImg && !!simImg.getAttribute('alt'), true);
check('图片 loading=lazy', !!simImg && simImg.getAttribute('loading'), 'lazy');
check('wmf 走 png_rel 资产', !!simImg && simImg.getAttribute('src').startsWith('/qb-media-png/'), true);

// 8. HTTP 500 → error（带后端 message）
window.AIAPI.batchParse = () => Promise.reject(window.AIAPI.ApiError('整卷解析失败: LLM 超时', { status: 500 }));
await PS.submit();
check('HTTP 500 → error', PS.getState(), 'error');
check('错误文案透传', window.document.getElementById('error-copy').textContent, '整卷解析失败: LLM 超时');

// 9. 网络失败 → offline（不是 error）
window.AIAPI.batchParse = () => Promise.reject(window.AIAPI.ApiError('网络连接不可用', { kind: 'network' }));
await PS.submit();
check('网络失败 → offline', PS.getState(), 'offline');

// 10. 401/403 → auth
window.AIAPI.batchParse = () => Promise.reject(window.AIAPI.ApiError('未授权', { status: 401 }));
await PS.submit();
check('401 → auth', PS.getState(), 'auth');

// 11. 存错题本成功
window.AIAPI.addWrongQuestion = () => Promise.resolve({ id: 1 });
const btn = window.document.createElement('button');
await PS.saveToWrongBook({ content: '1+1=?', subject_code: 'math', difficulty: 1 }, btn);
check('存入成功按钮态', btn.textContent, '已存入');

// 12. 存错题本 403 → 切 auth
window.AIAPI.addWrongQuestion = () => Promise.reject(window.AIAPI.ApiError('未授权', { status: 403 }));
await PS.saveToWrongBook({ content: '1+1=?', subject_code: 'math' }, btn);
check('存入 403 → auth', PS.getState(), 'auth');

// 13. 学科下拉 11 项（原 9 科 + 语文/英语各拆「除作文/作文」）+ 默认数学
//     文案用中文原样；非作文项保持单图，作文项出现两张上传卡
const subjSel = window.document.getElementById('subject-select');
check(
  '学科 11 项文案原样且顺序',
  [...subjSel.querySelectorAll('option')].map((o) => o.textContent).join(','),
  '语文（除作文）,语文作文,数学,英语（除作文）,英语作文,物理,化学,生物,历史,地理,政治'
);
check('默认数学 math', subjSel.value, 'math');
check('非作文：隐藏作文题目卡', window.document.getElementById('title-upload').hidden, true);
check('非作文：隐藏学段', window.document.getElementById('stage-field').hidden, true);
check('非作文：内容卡多选', window.document.getElementById('photo-input').multiple, true);

// 13b. 逐个切换 11 项：仅两个作文档 → 题目卡 + 学段可见（2 卡）；其余 9 项 → 均隐藏（1 卡）
//      逐项落断言，防止某个中文学科值被误判成作文档
const PHOTO_ITEMS = [
  { code: 'chinese', essay: false },
  { code: 'chinese_essay', essay: true },
  { code: 'math', essay: false },
  { code: 'english', essay: false },
  { code: 'english_essay', essay: true },
  { code: 'physics', essay: false },
  { code: 'chemistry', essay: false },
  { code: 'biology', essay: false },
  { code: 'history', essay: false },
  { code: 'geography', essay: false },
  { code: 'politics', essay: false },
];
for (const it of PHOTO_ITEMS) {
  subjSel.value = it.code;
  subjSel.dispatchEvent(new window.Event('change'));
  const titleHidden = window.document.getElementById('title-upload').hidden;
  const stageHidden = window.document.getElementById('stage-field').hidden;
  const multiple = window.document.getElementById('photo-input').multiple;
  check(`切换 ${it.code}：题目卡${it.essay ? '可见' : '隐藏'}`, titleHidden, !it.essay);
  check(`切换 ${it.code}：学段${it.essay ? '可见' : '隐藏'}`, stageHidden, !it.essay);
  check(`切换 ${it.code}：内容卡${it.essay ? '单张' : '多选'}`, multiple, !it.essay);
}

// 13c. 非作文 payload 仍是原形状（走 batchParse，非 essay analyze）
//      语文（除作文）/数学 各取一条：images[].subject 与 options.default_subject 均为原学科值
let solveCall = null;
window.AIAPI.batchParse = function (images, options) {
  solveCall = { images, options };
  return Promise.resolve({ questions: [{ pageIndex: 1, raw_text: 'x', subject_code: 'math' }], success_count: 1 });
};
window.localStorage.setItem('authToken', 'stub-token');
for (const code of ['chinese', 'math']) {
  subjSel.value = code;
  subjSel.dispatchEvent(new window.Event('change'));
  PS.setFiles([{ size: 100 }]);
  solveCall = null;
  await PS.submit();
  check(`非作文 ${code}：走 batchParse（非 analyze）`, !!solveCall, true);
  check(`非作文 ${code}：images[0].subject=${code}`, solveCall && solveCall.images[0].subject, code);
  check(`非作文 ${code}：default_subject=${code}`, solveCall && solveCall.options && solveCall.options.default_subject, code);
}

// 14. 切「语文作文」→ 两张上传卡 + 学段下拉
subjSel.value = 'chinese_essay';
subjSel.dispatchEvent(new window.Event('change'));
check('作文：显示作文题目卡', window.document.getElementById('title-upload').hidden, false);
check('作文：显示学段', window.document.getElementById('stage-field').hidden, false);
check('作文：内容卡单张', window.document.getElementById('photo-input').multiple, false);
check('作文：内容卡文案', window.document.getElementById('content-title').textContent, '上传我写的作文内容');
check('作文：按钮改「开始批改」', window.document.getElementById('parse-btn').textContent, '开始批改');
check('学段默认初中 junior', window.document.getElementById('stage-select').value, 'junior');

// 15. 缺任一图 → empty 且文案可区分（不是笼统的「先添加一张」）
PS.setFiles([]);
PS.setTitleFiles([]);
await PS.submit();
check('缺作文题目 → empty', PS.getState(), 'empty');
check('缺题目文案', /作文题目/.test(window.document.getElementById('empty-copy').textContent), true);
PS.setTitleFiles([{ size: 100 }]);
PS.setFiles([]);
await PS.submit();
check('缺正文文案', /我写的作文内容/.test(window.document.getElementById('empty-copy').textContent), true);

// 16. 两图齐 → analyze payload（image/title_image/subject/grade）→ 轮询 pending×2 → completed → 跳转
window.localStorage.setItem('authToken', 'stub-token');
let analyzeBody = null;
let reportCalls = 0;
window.AIAPI.request = function (url, options) {
  if (url === '/api/essay/analyze') {
    analyzeBody = options.body;
    return Promise.resolve({ report_id: 'r-9', status: 'pending' });
  }
  if (url === '/api/essay/report/r-9') {
    reportCalls += 1;
    return Promise.resolve(reportCalls < 3 ? { status: 'pending' } : { report_id: 'r-9', status: 'completed' });
  }
  return Promise.reject(new Error('unexpected ' + url));
};
PS.setFiles([{ size: 100 }]);
PS.setTitleFiles([{ size: 100 }]);
let navTo = null;
PS.setNavigator(function (u) { navTo = u; });
const pollDelays = [];
const queue = [];
const pEssay = PS.submitEssay({ scheduler: function (fn, ms) { pollDelays.push(ms); queue.push(fn); } });
let settled = false;
pEssay.then(() => { settled = true; }, () => { settled = true; });
let guard = 0;
while (!settled && guard < 2000) {
  await new Promise((r) => setTimeout(r, 0));
  while (queue.length) queue.shift()();
  guard += 1;
}
await pEssay;
// FileReader stub 返回 'data:image/png;base64,AAAA'，toBase64 去前缀 → 'AAAA'（断言截断展示）
check('analyze payload 已发出', !!analyzeBody, true);
check('payload.image = 正文 base64', analyzeBody && analyzeBody.image, 'AAAA');
check('payload.title_image 按契约发出', analyzeBody && analyzeBody.title_image, 'AAAA');
check('payload.subject 映射为 chinese', analyzeBody && analyzeBody.subject, 'chinese');
check('payload.grade 来自学段', analyzeBody && analyzeBody.grade, 'junior');
check('轮询次数 3（2 pending→completed）', reportCalls, 3);
check('轮询退避 1500/2250', pollDelays.join(','), '1500,2250');
check('完成后跳转阅读器', navTo, '/essay-review.html?id=r-9');

// 17. status=failed → error，固定文案，不回显后端错误码
window.AIAPI.request = function (url) {
  if (url === '/api/essay/analyze') return Promise.resolve({ report_id: 'r-f', status: 'pending' });
  return Promise.resolve({ report_id: 'r-f', status: 'failed', error_message: 'grading_validation_failed' });
};
PS.setFiles([{ size: 100 }]);
PS.setTitleFiles([{ size: 100 }]);
await PS.submitEssay({ scheduler: function (fn) { fn(); } });
check('failed → error', PS.getState(), 'error');
const failCopy = window.document.getElementById('error-copy').textContent;
check('failed 文案固定且不泄露错误码', /未能完成/.test(failCopy) && !/grading_validation_failed/.test(failCopy), true);

// 18. 单张 > 3MB → 可操作文案，且不入列（作文单图限制）
const photoInput = window.document.getElementById('photo-input');
Object.defineProperty(photoInput, 'files', {
  value: [{ size: 4 * 1024 * 1024, name: 'big.jpg' }],
  configurable: true,
});
photoInput.dispatchEvent(new window.Event('change'));
const uploadErr = window.document.getElementById('upload-error');
check('超 3MB 提示可见', uploadErr.hidden, false);
check('超限文案含上限与实际大小', /超过 3\.0MB/.test(uploadErr.textContent) && /4\.0MB/.test(uploadErr.textContent), true);
check('超限图不入列', PS.getFilesSize(), 0);

// 19. 轮询超上限仍 pending → error（有终点，不无限轮询）
let reportCalls2 = 0;
window.AIAPI.request = function (url) {
  if (url === '/api/essay/analyze') return Promise.resolve({ report_id: 'r-p', status: 'pending' });
  reportCalls2 += 1;
  return Promise.resolve({ status: 'pending' });
};
PS.setFiles([{ size: 100 }]);
PS.setTitleFiles([{ size: 100 }]);
const queue2 = [];
const p2 = PS.submitEssay({ scheduler: function (fn) { queue2.push(fn); } });
let settled2 = false;
p2.then(() => { settled2 = true; }, () => { settled2 = true; });
let guard2 = 0;
while (!settled2 && guard2 < 5000) {
  await new Promise((r) => setTimeout(r, 0));
  while (queue2.length) queue2.shift()();
  guard2 += 1;
}
await p2;
check('轮询有上限 → error', PS.getState(), 'error');
check('轮询次数 = maxAttempts', reportCalls2, PS.POLL.maxAttempts);

for (const r of results) {
  console.log(`${r.ok ? 'OK  ' : 'FAIL'} ${r.name.padEnd(28)} 实际=${JSON.stringify(r.got)}` + (r.ok ? '' : ` 期望=${JSON.stringify(r.want)}`));
}
const bad = results.filter((r) => !r.ok).length;
console.log(bad ? `\n❌ ${bad} 项不符` : `\n✅ ${results.length} 项全部通过`);
process.exit(bad ? 1 : 0);
