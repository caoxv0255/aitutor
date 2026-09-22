// 知识星图验收：六态 + 双视图切换 + 学科钻取 + 热力矩阵 + 薄弱标度（G6: 0..100）+ 错误分类
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const DIR = 'frontend-v2';
const html = fs.readFileSync(`${DIR}/knowledge-star.html`, 'utf8');
const uiJs = fs.readFileSync(`${DIR}/assets/js/ui.js`, 'utf8');
const apiJs = fs.readFileSync(`${DIR}/assets/js/api.js`, 'utf8');
const subjectsJs = fs.readFileSync(`${DIR}/assets/js/subjects.js`, 'utf8');
const pageJs = fs.readFileSync(`${DIR}/assets/js/knowledge-star.js`, 'utf8');

const inlined = html
  .replace(/<script src="[^"]*ui\.js"><\/script>/, `<script>${uiJs}</script>`)
  .replace(/<script src="[^"]*api\.js"><\/script>/, `<script>${apiJs}</script>`)
  .replace(/<script src="[^"]*subjects\.js"><\/script>/, `<script>${subjectsJs}</script>`)
  .replace(/<script src="[^"]*knowledge-star\.js"><\/script>/, `<script>${pageJs}</script>`);

const dom = new JSDOM(inlined, {
  runScripts: 'dangerously',
  url: 'https://x.dev/knowledge-star.html',
  pretendToBeVisual: true,
});
const { window } = dom;
window.fetch = () => Promise.reject(new Error('no network in test'));
window.localStorage.setItem('authToken', 'stub-token');
await new Promise((res) => window.addEventListener('load', res));

const K = window.KnowledgeStar;
const results = [];
const check = (name, got, want) => results.push({ ok: got === want, name, got, want });
const doc = window.document;
const $ = (id) => doc.getElementById(id);
const visible = () => doc.querySelectorAll('.state.is-on').length;
const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));

// 后端真实形状：GET /api/knowledge/star-map（api/modules/knowledge/routes.js:324）
// G6：mastery 0..100，is_weak = mastery < 50
const STARMAP = {
  subjects: [
    { code: 'chinese', name: '语文', color: '#c2410c' },
    { code: 'math', name: '数学', color: '#d71920' },
    { code: 'physics', name: '物理', color: '#2563eb' },
    { code: 'politics', name: '政治', color: '#be185d' },
  ],
  nodes: [
    { kp_id: 'kp1', name: '导数与切线', subject_code: 'math', mastery: 82, is_weak: false, attempt_count: 12 },
    { kp_id: 'kp2', name: '三角函数图像', subject_code: 'math', mastery: 32, is_weak: true, attempt_count: 5 },
    { kp_id: 'kp3', name: '受力分析', subject_code: 'physics', mastery: 61, is_weak: false, attempt_count: 3 },
    { kp_id: 'kp4', name: '未练知识点', subject_code: 'politics', mastery: null, is_weak: false, attempt_count: 0 },
  ],
  edges: [{ from: 'kp1', to: 'kp2', strength: 0.6, type: 'subtopic' }],
  // 后端契约：9 学科 × 6 类别 全量初始化（routes.js:346-354），未练为 null
  heatmap: {
    chinese: { 基础概念: null, 方法应用: null, 综合运用: null, 计算: null, 推理: null, 案例: null },
    math: { 基础概念: 72, 方法应用: 32, 综合运用: null, 计算: 55, 推理: null, 案例: null },
    physics: { 基础概念: 61, 方法应用: null, 综合运用: null, 计算: null, 推理: null, 案例: null },
    politics: { 基础概念: null, 方法应用: null, 综合运用: null, 计算: null, 推理: null, 案例: null },
  },
  generated_at: '2026-09-22T00:00:00Z',
};

let starMapPath = '';
window.AIAPI.request = (path) => {
  if (path === '/api/knowledge/star-map') {
    starMapPath = path;
    return Promise.resolve({ data: STARMAP });
  }
  return Promise.resolve({ data: {} });
};

// 1. 六态面板齐备且互斥
const panels = [...doc.querySelectorAll('[data-state]')].map((n) => n.getAttribute('data-state'));
check('六态面板', panels.sort().join(','), K.STATES.slice().sort().join(','));
for (const s of K.STATES) {
  K.setState(s);
  check(`setState(${s})`, K.getState(), s);
  check(`setState(${s}) 互斥`, visible(), 1);
}

// 2. 无 token → auth
window.localStorage.removeItem('authToken');
await K.load();
check('无 token → auth', K.getState(), 'auth');
window.localStorage.setItem('authToken', 'stub-token');

// 3. 离线 → offline 且不发请求
Object.defineProperty(window.navigator, 'onLine', { value: false, configurable: true });
let calls = 0;
window.AIAPI.request = () => {
  calls += 1;
  return Promise.resolve({ data: STARMAP });
};
await K.load();
check('离线 → offline', K.getState(), 'offline');
check('离线不发请求', calls, 0);
Object.defineProperty(window.navigator, 'onLine', { value: true, configurable: true });

// 4. 空星图 → empty（真实空态：一个节点都没有）
window.AIAPI.request = (path) => {
  if (path === '/api/knowledge/star-map') return Promise.resolve({ data: { subjects: [], nodes: [], edges: [], heatmap: {} } });
  return Promise.resolve({ data: {} });
};
await K.load();
check('空星图 → empty', K.getState(), 'empty');
check('空态文案', /拍照第一道题|点亮/.test($('empty-copy').textContent), true);

// 5. 有节点 → success
window.AIAPI.request = (path) => {
  if (path === '/api/knowledge/star-map') {
    starMapPath = path;
    return Promise.resolve({ data: STARMAP });
  }
  return Promise.resolve({ data: {} });
};
await K.load();
await tick(0);
check('有节点 → success', K.getState(), 'success');
check('请求路径', starMapPath, '/api/knowledge/star-map');

// 6. 星图视图：4 节点 + 学科 tab 按 subjects 重建 + 薄弱红圈
check('节点数', $('star-sky').querySelectorAll('.star-node').length, 4);
check(
  '学科 tab 数（全部 + 4 科）',
  $('subject-tabs').querySelectorAll('.tab').length,
  5
);
check('薄弱节点红圈', $('star-sky').querySelectorAll('.star-node--weak').length, 1);
check('空节点样式', $('star-sky').querySelectorAll('.star-node--empty').length, 1);
check('连线 SVG 存在', $('star-sky').querySelectorAll('svg.star-edges line').length, 1);

// 7. 学科钻取：选数学只留 2 节点，连线仍在
K.setSubject('math');
check('钻取当前学科', K.getSubject(), 'math');
check('钻取后节点数', $('star-sky').querySelectorAll('.star-node').length, 2);
check('钻取后 tab 高亮', $('subject-tabs').querySelector('.tab--on').dataset.subject, 'math');
K.setSubject('');
check('恢复全部', $('star-sky').querySelectorAll('.star-node').length, 4);

// 8. 钻取到无节点学科 → 行内提示，不落 empty 态
K.setSubject('chinese');
check('空学科 → 仍 success', K.getState(), 'success');
check('空学科提示', /暂无知识点/.test($('star-sky').textContent), true);
K.setSubject('');

// 9. 双视图切换互斥
K.setView('heat');
check('setView(heat) 当前', K.getView(), 'heat');
check('heat 面板可见', $('heat-view').hidden, false);
check('node 面板隐藏', $('node-view').hidden, true);
K.setView('node');
check('切回 node', $('node-view').hidden, false);
check('heat 面板隐藏', $('heat-view').hidden, true);

// 10. 热力矩阵：表头 + 4 行 × 6 列，null 显示 —，薄弱高红
K.setView('heat');
const cells = [...$('heat-grid').querySelectorAll('.heat-cell')];
check('热力单元格数（4 科 × 6 类）', cells.length, 24);
check('null → —', cells.filter((c) => c.textContent === '—').length, 20);
check('数值取整显示', cells.some((c) => c.textContent === '32'), true);
check('薄弱格染红', cells.some((c) => /rgba\(215,\s*25,\s*32/.test(c.style.background)), true);
check('学科行名来自后端', /语文/.test($('heat-grid').textContent), true);

// 11. 摘要行
check('摘要节点数', /共 4 个知识点/.test($('summary-line').textContent), true);
check('薄弱摘要', /薄弱预警 1 个/.test($('weak-line').textContent), true);

// 12. 失败分类
window.AIAPI.request = () => Promise.reject(window.AIAPI.ApiError('星图查询失败: db', { status: 500 }));
await K.load();
check('500 → error', K.getState(), 'error');
check('500 文案透传', $('error-copy').textContent, '星图查询失败: db');

window.AIAPI.request = () => Promise.reject(window.AIAPI.ApiError('未授权', { status: 401 }));
await K.load();
check('401 → auth', K.getState(), 'auth');

window.AIAPI.request = () => Promise.reject(window.AIAPI.ApiError('网络连接不可用', { kind: 'network' }));
await K.load();
check('网络失败 → offline', K.getState(), 'offline');

for (const r of results) {
  console.log(
    `${r.ok ? 'OK  ' : 'FAIL'} ${r.name.padEnd(26)} 实际=${JSON.stringify(r.got)}` + (r.ok ? '' : ` 期望=${JSON.stringify(r.want)}`)
  );
}
const bad = results.filter((r) => !r.ok).length;
console.log(bad ? `\n❌ ${bad} 项不符` : `\n✅ ${results.length} 项全部通过`);
process.exit(bad ? 1 : 0);
