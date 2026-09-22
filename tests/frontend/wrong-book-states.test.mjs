// 错题本验收：六态 + 筛选/翻页参数 + 接口错误分类
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const DIR = 'frontend-v2';
const html = fs.readFileSync(`${DIR}/wrong-book.html`, 'utf8');
const uiJs = fs.readFileSync(`${DIR}/assets/js/ui.js`, 'utf8');
const apiJs = fs.readFileSync(`${DIR}/assets/js/api.js`, 'utf8');
const subjectsJs = fs.readFileSync(`${DIR}/assets/js/subjects.js`, 'utf8');
const pageJs = fs.readFileSync(`${DIR}/assets/js/wrong-book.js`, 'utf8');

const inlined = html
  .replace(/<script src="[^"]*ui\.js"><\/script>/, `<script>${uiJs}</script>`)
  .replace(/<script src="[^"]*api\.js"><\/script>/, `<script>${apiJs}</script>`)
  .replace(/<script src="[^"]*subjects\.js"><\/script>/, `<script>${subjectsJs}</script>`)
  .replace(/<script src="[^"]*wrong-book\.js"><\/script>/, `<script>${pageJs}</script>`);

const dom = new JSDOM(inlined, {
  runScripts: 'dangerously',
  url: 'https://x.dev/wrong-book.html',
  pretendToBeVisual: true
});
const { window } = dom;
window.fetch = () => Promise.reject(new Error('no network in test'));

await new Promise((res) => window.addEventListener('load', res));

const WB = window.WrongBook;
const results = [];
const check = (name, got, want) => results.push({ ok: got === want, name, got, want });
const doc = window.document;
const visible = () => doc.querySelectorAll('.state.is-on').length;

// 1. 六态面板齐备
const panels = [...doc.querySelectorAll('[data-state]')].map((n) => n.getAttribute('data-state'));
check('六态面板', panels.sort().join(','), WB.STATES.slice().sort().join(','));

// 2. 逐个切换且互斥
for (const s of WB.STATES) {
  WB.setState(s);
  check(`setState(${s})`, WB.getState(), s);
  check(`setState(${s}) 互斥`, visible(), 1);
}

// 3. 无 token → auth
window.localStorage.removeItem('authToken');
await WB.load();
check('无 token → auth', WB.getState(), 'auth');

// 4. 离线 → offline
window.localStorage.setItem('authToken', 'stub');
Object.defineProperty(window.navigator, 'onLine', { value: false, configurable: true });
await WB.load();
check('离线 → offline', WB.getState(), 'offline');
Object.defineProperty(window.navigator, 'onLine', { value: true, configurable: true });

// 5. 有数据 → success 并渲染条目
let capturedQuery = null;
window.AIAPI.getWrongQuestions = (q) => {
  capturedQuery = q;
  return Promise.resolve({
    questions: [
      {
        id: 1,
        content: '已知 x=2，求 x²',
        subject_code: 'math',
        subject_name: '数学',
        category_name: '计算错误',
        difficulty: 3,
        reviewed: 0,
        created_at: '2026-09-21T02:00:00.000Z'
      }
    ],
    total: 12,
    page: q.page, // 后端会把请求的页码回填
    page_size: 10
  });
};
window.AIAPI.getWrongQuestionStats = () =>
  Promise.resolve({ total_count: 12, reviewed_count: 4, unreviewed_count: 8 });

await WB.load();
check('有数据 → success', WB.getState(), 'success');
check('渲染条目数', doc.querySelectorAll('#list .q-card').length, 1);
check('分页文案', doc.getElementById('page-info').textContent, '第 1 / 2 页 · 共 12 条');
check('上一页禁用（首页）', doc.getElementById('prev-btn').disabled, true);
check('下一页可用', doc.getElementById('next-btn').disabled, false);
check('统计 chip 数', doc.querySelectorAll('#stat-region .stat-chip').length, 3);
check('学科标签', doc.querySelector('#list .tag').textContent, '数学');

// 6. 筛选参数要真的传给后端
doc.getElementById('subject-filter').value = 'physics';
doc.getElementById('reviewed-filter').value = 'false';
await WB.load();
check('筛选透传 subject', capturedQuery.subject, 'physics');
check('筛选透传 reviewed', capturedQuery.reviewed, 'false');

// 7. 翻页
await (async () => {
  doc.getElementById('next-btn').dispatchEvent(new window.Event('click'));
  await new Promise((r) => setTimeout(r, 0));
})();
check('翻到第 2 页', WB.getPage(), 2);
check('第 2 页后上一页可用', doc.getElementById('prev-btn').disabled, false);

// 8. 空数据 → empty（区分"筛选后为空"）
window.AIAPI.getWrongQuestions = () => Promise.resolve({ questions: [], total: 0, page: 1, page_size: 10 });
await WB.load();
check('空列表 → empty', WB.getState(), 'empty');
check('筛选态文案', /当前筛选条件下没有错题/.test(doc.getElementById('empty-copy').textContent), true);

// 9. HTTP 500 → error
window.AIAPI.getWrongQuestions = () => Promise.reject(window.AIAPI.ApiError('获取错题列表失败', { status: 500 }));
await WB.load();
check('HTTP 500 → error', WB.getState(), 'error');
check('错误文案', doc.getElementById('error-copy').textContent, '获取错题列表失败');

// 10. 网络失败 → offline
window.AIAPI.getWrongQuestions = () => Promise.reject(window.AIAPI.ApiError('网络连接不可用', { kind: 'network' }));
await WB.load();
check('网络失败 → offline', WB.getState(), 'offline');

// 11. 401 → auth
window.AIAPI.getWrongQuestions = () => Promise.reject(window.AIAPI.ApiError('未授权', { status: 401 }));
await WB.load();
check('401 → auth', WB.getState(), 'auth');

// 12. 统计接口失败不影响列表
window.AIAPI.getWrongQuestions = () =>
  Promise.resolve({ questions: [{ id: 2, content: '第二题', subject_code: 'math' }], total: 1, page: 1, page_size: 10 });
window.AIAPI.getWrongQuestionStats = () => Promise.reject(window.AIAPI.ApiError('统计挂了', { status: 500 }));
await WB.load();
check('统计失败不拖垮列表', WB.getState(), 'success');

// ── G1 闭环：标记复习 / 删除 ─────────────────────────────────────────────
// 起一屏干净数据
window.AIAPI.getWrongQuestions = () =>
  Promise.resolve({
    questions: [{ id: 7, content: '待处理题', subject_code: 'math', reviewed: 0 }],
    total: 1,
    page: 1,
    page_size: 10
  });
window.AIAPI.getWrongQuestionStats = () => Promise.resolve({ total_count: 1, reviewed_count: 0, unreviewed_count: 1 });
await WB.load();

check('渲染出操作按钮', doc.querySelectorAll('#list .q-actions button').length, 2);
check('未复习时按钮文案', doc.querySelectorAll('#list .q-actions button')[0].textContent, '标记已复习');

// 标记复习：应带上 reviewed=1 且成功后刷新列表
let updateArgs = null;
window.AIAPI.updateWrongQuestion = (id, payload) => {
  updateArgs = { id, payload };
  return Promise.resolve({});
};
doc.querySelectorAll('#list .q-actions button')[0].dispatchEvent(new window.Event('click'));
await new Promise((r) => setTimeout(r, 0));
check('PUT 目标 id', updateArgs && updateArgs.id, 7);
check('PUT 提交 reviewed=1', updateArgs && updateArgs.payload.reviewed, 1);
check('更新后仍在 success 态', WB.getState(), 'success');

// 删除
let deleteId = null;
window.AIAPI.deleteWrongQuestion = (id) => {
  deleteId = id;
  return Promise.resolve({});
};
doc.querySelectorAll('#list .q-actions button')[1].dispatchEvent(new window.Event('click'));
await new Promise((r) => setTimeout(r, 0));
check('DELETE 目标 id', deleteId, 7);

// 写操作 401 → auth
window.AIAPI.updateWrongQuestion = () => Promise.reject(window.AIAPI.ApiError('认证失败，请重新登录', { status: 401 }));
doc.querySelectorAll('#list .q-actions button')[0].dispatchEvent(new window.Event('click'));
await new Promise((r) => setTimeout(r, 0));
check('写操作 401 → auth', WB.getState(), 'auth');

// 写操作网络失败 → offline
WB.setState('success');
window.AIAPI.updateWrongQuestion = () => Promise.reject(window.AIAPI.ApiError('网络连接不可用', { kind: 'network' }));
doc.querySelectorAll('#list .q-actions button')[0].dispatchEvent(new window.Event('click'));
await new Promise((r) => setTimeout(r, 0));
check('写操作网络失败 → offline', WB.getState(), 'offline');

// 写操作 404（已被删/不属于你）→ error 并带后端文案
WB.setState('success');
window.AIAPI.updateWrongQuestion = () => Promise.reject(window.AIAPI.ApiError('错题不存在或无权访问', { status: 404 }));
doc.querySelectorAll('#list .q-actions button')[0].dispatchEvent(new window.Event('click'));
await new Promise((r) => setTimeout(r, 0));
check('写操作 404 → error', WB.getState(), 'error');
check('404 文案透传', doc.getElementById('error-copy').textContent, '错题不存在或无权访问');

// 失败后按钮要恢复可用（不能卡在 disabled）
check('失败后按钮恢复', doc.querySelectorAll('#list .q-actions button')[0].disabled, false);

for (const r of results) {
  console.log(`${r.ok ? 'OK  ' : 'FAIL'} ${r.name.padEnd(26)} 实际=${JSON.stringify(r.got)}` + (r.ok ? '' : ` 期望=${JSON.stringify(r.want)}`));
}
const bad = results.filter((r) => !r.ok).length;
console.log(bad ? `\n❌ ${bad} 项不符` : `\n✅ ${results.length} 项全部通过`);
process.exit(bad ? 1 : 0);
