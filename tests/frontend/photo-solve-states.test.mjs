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
//     学科下拉补齐 9 科（PM-BRIEF §A.3）；结果区回显真实原图（只回显照片，不造置信度/耗时）
const subjectCodes = [...window.document.querySelectorAll('#subject-select option')].map((o) => o.value);
check('学科下拉 9 科', subjectCodes.join(','), 'chinese,math,english,physics,chemistry,biology,history,geography,politics');
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

for (const r of results) {
  console.log(`${r.ok ? 'OK  ' : 'FAIL'} ${r.name.padEnd(28)} 实际=${JSON.stringify(r.got)}` + (r.ok ? '' : ` 期望=${JSON.stringify(r.want)}`));
}
const bad = results.filter((r) => !r.ok).length;
console.log(bad ? `\n❌ ${bad} 项不符` : `\n✅ ${results.length} 项全部通过`);
process.exit(bad ? 1 : 0);
