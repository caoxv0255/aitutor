// 阶段验收：AI 导师讲题页（tutor.html）接地三字段 → 说明横幅，jsdom 真跑页面脚本。
//
// 覆盖（对齐波次 2 任务）：
//   - grounded=false 且有 groundingNotice → 横幅出现且文案与后端原文**逐字一致**
//   - grounded=true → 无横幅（citations 非空时轻量展示出处）
//   - grounded=false 但 notice=null → 不崩、不显示空横幅
//   - 字段缺失（后端未下发）→ 视为未知，不显示、不伪造
//   - 流式 meta 事件：横幅一次性确定，流过程中不反复闪动
//   - 渲染路径未使用非静态 innerHTML（AI 输出禁入）
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const DIR = 'frontend-v2';
const html = fs.readFileSync(`${DIR}/tutor.html`, 'utf8');
const uiJs = fs.readFileSync(`${DIR}/assets/js/ui.js`, 'utf8');
const apiJs = fs.readFileSync(`${DIR}/assets/js/api.js`, 'utf8');
const subjectsJs = fs.readFileSync(`${DIR}/assets/js/subjects.js`, 'utf8');
const pageJs = fs.readFileSync(`${DIR}/assets/js/tutor.js`, 'utf8');
const pageSrc = pageJs;

// 外链脚本改成内联，jsdom 不加载本地相对路径（替换串必须用函数形式）
const inlined = html
  .replace(/<script src="[^"]*ui\.js"><\/script>/, () => `<script>${uiJs}</script>`)
  .replace(/<script src="[^"]*api\.js"><\/script>/, () => `<script>${apiJs}</script>`)
  .replace(/<script src="[^"]*subjects\.js"><\/script>/, () => `<script>${subjectsJs}</script>`)
  .replace(/<script src="[^"]*tutor\.js"><\/script>/, () => `<script>${pageJs}</script>`);

const dom = new JSDOM(inlined, {
  runScripts: 'dangerously',
  url: 'https://x.dev/v2/tutor.html',
  pretendToBeVisual: true,
});
const { window } = dom;

window.fetch = () => Promise.reject(new Error('no network in test'));
// 强制走非流式路径（jsdom 无 TextDecoderStream 时页面会自动回落，这里显式钉死）
window.TextDecoderStream = undefined;

await new Promise((res) => window.addEventListener('load', res));

const Tutor = window.Tutor;
const doc = window.document;
const NOTICE = doc.getElementById('grounding-notice');

const results = [];
const check = (name, got, want) => results.push({ ok: got === want, name, got, want });
const visibleCount = () => doc.querySelectorAll('.state.is-on').length;

// 后端原文（api/routes/tutor-agent.js 的 UNGROUNDED_NOTICE；测试逐字对齐）
const BACKEND_NOTICE = '本次回答未依据题库内容，仅供参考';

// 1. 六态面板齐备 + 初始态
const panels = [...doc.querySelectorAll('[data-state]')].map((n) => n.getAttribute('data-state'));
check('六态面板', panels.sort().join(','), Tutor.STATES.slice().sort().join(','));
check('初始态', Tutor.getState(), 'empty');
check('初始仅一个面板可见', visibleCount(), 1);
check('初始无横幅', NOTICE.hidden, true);

// 2. grounded=false + notice → 横幅出现，文案逐字为后端原文
Tutor.applyGrounding({ grounded: false, citations: [], groundingNotice: BACKEND_NOTICE });
check('未接地 → 横幅可见', NOTICE.hidden, false);
check('未接地 → 文案逐字等于后端原文', NOTICE.textContent, BACKEND_NOTICE);
check('未接地 → 无出处区', doc.getElementById('tutor-citations').hidden, true);

// 3. grounded=true → 无横幅；citations 非空 → 轻量展示出处
Tutor.applyGrounding({
  grounded: true,
  citations: [{ question_id: 12, similarity: 0.8123 }, { question_id: 15, similarity: 0.6 }],
  groundingNotice: null,
});
check('已接地 → 无横幅', NOTICE.hidden, true);
check('已接地 → 横幅清空', NOTICE.textContent, '');
const cites = doc.getElementById('tutor-citations');
check('已接地 → 出处置于可见', cites.hidden, false);
check('出处含题号 12/15', /题号 12/.test(cites.textContent) && /题号 15/.test(cites.textContent), true);

// 4. grounded=true 且 citations 为空 → 无横幅也无出处
Tutor.applyGrounding({ grounded: true, citations: [], groundingNotice: null });
check('已接地空引用 → 无横幅', NOTICE.hidden, true);
check('已接地空引用 → 无出处', doc.getElementById('tutor-citations').hidden, true);

// 5. grounded=false 但 notice=null → 不崩、不显示空横幅
let threw = false;
try {
  Tutor.applyGrounding({ grounded: false, citations: [], groundingNotice: null });
} catch (e) {
  threw = true;
}
check('notice=null 不抛异常', threw, false);
check('notice=null → 无横幅', NOTICE.hidden, true);
check('notice=null → 横幅无文本', NOTICE.textContent, '');

// 6. 三字段缺失（后端尚未下发）→ 视为未知，不显示、不伪造
Tutor.applyGrounding({});
Tutor.applyGrounding(undefined);
check('字段缺失 → 无横幅', NOTICE.hidden, true);
check('字段缺失 → 无出处', doc.getElementById('tutor-citations').hidden, true);

// 7. 流式：metadata 一次性确定横幅；随后 content 不得改变（防闪动）
Tutor.applyGrounding({});
Tutor.onStreamEvent({ event: 'metadata', data: { grounded: false, citations: [], groundingNotice: BACKEND_NOTICE } });
check('流式 metadata → 状态 success', Tutor.getState(), 'success');
check('流式 metadata → 横幅出现', NOTICE.hidden, false);
check('流式 metadata → 横幅文案逐字', NOTICE.textContent, BACKEND_NOTICE);
Tutor.onStreamEvent({ event: 'content', data: { delta: '先求导，' } });
Tutor.onStreamEvent({ event: 'content', data: { delta: '再令导数为零。' } });
check('流式 content 不改变横幅可见性（无闪动）', NOTICE.hidden, false);
check('流式 content 不改变横幅文案（无闪动）', NOTICE.textContent, BACKEND_NOTICE);
check('流式回答已累积', /先求导，再令导数为零。/.test(doc.getElementById('tutor-answer').textContent), true);

// 8. 流式 metadata 已接地 → 无横幅
Tutor.onStreamEvent({ event: 'metadata', data: { grounded: true, citations: [{ question_id: 3, similarity: 0.9 }], groundingNotice: null } });
check('流式已接地 → 无横幅', NOTICE.hidden, true);
check('流式已接地 → 出处可见', doc.getElementById('tutor-citations').hidden, false);

// 9. 非流式集成：submit → askTutor 响应带未接地字段
window.localStorage.setItem('authToken', 'stub-token');
Object.defineProperty(window.navigator, 'onLine', { value: true, configurable: true });
window.AIAPI.askTutor = () =>
  Promise.resolve({ response: '由通用知识作答。', grounded: false, citations: [], groundingNotice: BACKEND_NOTICE });
Tutor.setQuestion('如何求函数极值？');
await Tutor.submit();
check('非流式提交 → success', Tutor.getState(), 'success');
check('非流式回答渲染', doc.getElementById('tutor-answer').textContent, '由通用知识作答。');
check('非流式未接地 → 横幅逐字', NOTICE.textContent, BACKEND_NOTICE);

// 10. 非流式接地 → 无横幅
window.AIAPI.askTutor = () =>
  Promise.resolve({ response: '依据题库第 7 题作答。', grounded: true, citations: [{ question_id: 7, similarity: 0.77 }], groundingNotice: null });
await Tutor.submit();
check('非流式已接地 → 无横幅', NOTICE.hidden, true);

// 11. 降级：网络失败 → offline，且不伪造横幅
window.AIAPI.askTutor = () => Promise.reject(window.AIAPI.ApiError('网络连接不可用', { kind: 'network' }));
await Tutor.submit();
check('网络失败 → offline', Tutor.getState(), 'offline');
check('网络失败 → 不显示横幅', NOTICE.hidden, true);

// 12. 降级：401 → auth，且不伪造横幅
window.AIAPI.askTutor = () => Promise.reject(window.AIAPI.ApiError('未授权', { status: 401 }));
await Tutor.submit();
check('401 → auth', Tutor.getState(), 'auth');
check('401 → 不显示横幅', NOTICE.hidden, true);

// 13. 注入面：恶意 groundingNotice / 回答文本走文本节点，不产生元素
window.AIAPI.askTutor = () =>
  Promise.resolve({
    response: '<img src=x onerror="window.__pwned=1">',
    grounded: false,
    citations: [],
    groundingNotice: '<script>window.__pwned=1</script>本次未接地',
  });
await Tutor.submit();
const successPanel = doc.querySelector('[data-state="success"]');
check('恶意 notice 未生成 script 元素', successPanel.querySelectorAll('script').length, 0);
check('恶意回答未生成 img 元素', successPanel.querySelectorAll('img').length, 0);
check('未执行注入脚本', window.__pwned, undefined);
check('notice 仍按原文纯文本呈现', NOTICE.textContent, '<script>window.__pwned=1</script>本次未接地');

// 14. 渲染路径不含非静态 innerHTML（AI 输出禁入 innerHTML 永久闸门同款判据）
check('tutor.js 无非静态 innerHTML 赋值', /\.innerHTML\s*(?:\+=|=)/.test(pageSrc), false);
check('tutor.js 无 insertAdjacentHTML', /insertAdjacentHTML\s*\(/.test(pageSrc), false);
check('tutor.js 无 document.write', /document\s*\.\s*write\s*\(/.test(pageSrc), false);
check('tutor.js 使用 textContent', /\.textContent/.test(pageSrc), true);

for (const r of results) {
  console.log(`${r.ok ? 'OK  ' : 'FAIL'} ${r.name.padEnd(34)} 实际=${JSON.stringify(r.got)}` + (r.ok ? '' : ` 期望=${JSON.stringify(r.want)}`));
}
const bad = results.filter((r) => !r.ok).length;
console.log(bad ? `\n❌ ${bad} 项不符` : `\n✅ ${results.length} 项全部通过`);
process.exit(bad ? 1 : 0);
