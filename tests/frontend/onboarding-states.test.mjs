// 初始化引导页验收：六态 + 5 步向导 + 年级/省份/选科联动 + 提交契约 + 错误分类
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const DIR = 'frontend-v2';
const html = fs.readFileSync(`${DIR}/onboarding.html`, 'utf8');
const uiJs = fs.readFileSync(`${DIR}/assets/js/ui.js`, 'utf8');
const apiJs = fs.readFileSync(`${DIR}/assets/js/api.js`, 'utf8');
const subjectsJs = fs.readFileSync(`${DIR}/assets/js/subjects.js`, 'utf8');
const pageJs = fs.readFileSync(`${DIR}/assets/js/onboarding.js`, 'utf8');

const inlined = html
  .replace(/<script src="[^"]*ui\.js"><\/script>/, `<script>${uiJs}</script>`)
  .replace(/<script src="[^"]*api\.js"><\/script>/, `<script>${apiJs}</script>`)
  .replace(/<script src="[^"]*subjects\.js"><\/script>/, `<script>${subjectsJs}</script>`)
  .replace(/<script src="[^"]*onboarding\.js"><\/script>/, `<script>${pageJs}</script>`);

const dom = new JSDOM(inlined, {
  runScripts: 'dangerously',
  url: 'https://x.dev/onboarding.html',
  pretendToBeVisual: true,
});
const { window } = dom;
window.fetch = () => Promise.reject(new Error('no network in test'));
window.localStorage.setItem('authToken', 'stub-token');
await new Promise((res) => window.addEventListener('load', res));

const O = window.Onboarding;
const results = [];
const check = (name, got, want) => results.push({ ok: got === want, name, got, want });
const doc = window.document;
const $ = (id) => doc.getElementById(id);
const visible = () => doc.querySelectorAll('.state.is-on').length;
const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));

// 后端真实形状：GET /api/user/provinces → { data:[{code,name,exam_type,…}], total }
const GAOKAO = [
  { code: 'beijing', name: '北京', exam_type: 'gaokao' },
  { code: 'hebei', name: '河北', exam_type: 'gaokao' },
  { code: 'liaoning', name: '辽宁', exam_type: 'gaokao' },
];
const ZHONGKAO = [{ code: 'shenyang_zhongkao', name: '沈阳中考', exam_type: 'zhongkao' }];

let lastPath = '';
let lastOptions = null;
window.AIAPI.request = (path, options) => {
  lastPath = path;
  lastOptions = options || null;
  return Promise.resolve({ data: GAOKAO, total: GAOKAO.length });
};

// 1. 六态面板齐备且互斥
const panels = [...doc.querySelectorAll('[data-state]')].map((n) => n.getAttribute('data-state'));
check('六态面板', panels.sort().join(','), O.STATES.slice().sort().join(','));
for (const s of O.STATES) {
  O.setState(s);
  check(`setState(${s})`, O.getState(), s);
  check(`setState(${s}) 互斥`, visible(), 1);
}

// 2. 无 token → auth
window.localStorage.removeItem('authToken');
await O.load();
check('无 token → auth', O.getState(), 'auth');
window.localStorage.setItem('authToken', 'stub-token');

// 3. 离线 → offline 且不发请求
Object.defineProperty(window.navigator, 'onLine', { value: false, configurable: true });
let calls = 0;
window.AIAPI.request = () => {
  calls += 1;
  return Promise.resolve({ data: GAOKAO });
};
await O.load();
check('离线 → offline', O.getState(), 'offline');
check('离线不发请求', calls, 0);
Object.defineProperty(window.navigator, 'onLine', { value: true, configurable: true });

// 4. 空省份列表 → empty
window.AIAPI.request = () => Promise.resolve({ data: [], total: 0 });
await O.load();
check('空省份 → empty', O.getState(), 'empty');
check('空态文案', $('empty-copy').textContent, '该考试类型下没有可选的省份，换个年级试试。');

// 5. 有省份 → success，省份下拉按后端数据填充
window.AIAPI.request = (path) => {
  lastPath = path;
  return Promise.resolve({ data: GAOKAO, total: GAOKAO.length });
};
await O.load();
await tick(0);
check('有省份 → success', O.getState(), 'success');
check('默认按高考区取省份', lastPath, '/api/user/provinces?exam_level=gaokao');
check('省份下拉条数', $('province').options.length, 3);
check('省份下拉首项 code', $('province').value, 'beijing');

// 6. 年级卡：与后端 VALID_GRADE_CODES 对齐（6 个）
const gradeCards = [...doc.querySelectorAll('#grade-grid .pick-card')];
check('年级卡数量', gradeCards.length, 6);
check('年级卡 code 对齐后端', gradeCards.map((b) => b.dataset.grade).join(','), 'grade_7,grade_8,grade_9,grade_10,grade_11,grade_12');
check('默认选中高一', doc.querySelector('#grade-grid .pick-card--on').dataset.grade, 'grade_10');

// 7. 点初三年级 → 切中考区并重新取省份
gradeCards[2].click();
await tick(0);
check('初三 → 省份按中考区重取', lastPath, '/api/user/provinces?exam_level=zhongkao');
check('初三 → 选科模式', O.strategy(), '9 科全开');
check('中考区提示文案', /中考区：9 科全开/.test($('strategy-hint').textContent), true);

// 8. 学科卡来自 AISubjects（9 个、顺序即 PM §B.2 顺序）
const subjCards = [...doc.querySelectorAll('#subject-grid .pick-card')];
check('学科卡数量', subjCards.length, 9);
check(
  '学科卡顺序来自 AISubjects',
  subjCards.map((b) => b.dataset.subject).join(','),
  window.AISubjects.LIST.map((s) => s.code).join(',')
);
check('主科锁定数量', doc.querySelectorAll('#subject-grid .pick-card--locked').length, 3);

// 9. 中考区 9 科全开
check('中考区已选 9 科', $('subject-count').textContent, '9');

// 10. 切回高考区：选满 6 科后再选第 7 科被拒（PM §F.3 E8）
const g10 = doc.querySelector('#grade-grid .pick-card[data-grade="grade_10"]');
g10.click();
await tick(0);
window.AIAPI.request = (path) => {
  lastPath = path;
  return Promise.resolve({ data: GAOKAO, total: GAOKAO.length });
};
await O.load();
await tick(0);
check('高考区默认 6 科', $('subject-count').textContent, '6');
doc.querySelector('#subject-grid .pick-card[data-subject="history"]').click();
check('第 7 科被拒', $('subject-count').textContent, '6');
check('超限提示', /高考只能选 6 科/.test($('step-error').textContent), true);
check('超限提示可见', $('step-error').hidden, false);

// 11. 选科模式按 PM §F.8 判定
O.data.level = 'gaokao';
O.data.provinceName = '北京';
check('北京 → 3+3', O.strategy(), '3+3');
O.data.provinceName = '河北';
check('河北 → 3+1+2', O.strategy(), '3+1+2');

// 12. 步骤切换：面板互斥 + 步骤条
O.showStep(2);
check('showStep(2) 当前步', O.getStep(), 2);
check('step 2 面板可见', $('panel-2').hidden, false);
check('step 1 面板隐藏', $('panel-1').hidden, true);
check('步骤条 5 格', doc.querySelectorAll('#step-bar .loop__step').length, 5);
check('步骤 eyebrow', $('step-eyebrow').textContent, 'STEP 2 / 5');

// 13. 提交契约：path / method / body
O.showStep(5);
let body = null;
window.AIAPI.request = (path, options) => {
  lastPath = path;
  lastOptions = options || null;
  body = options && options.body;
  return Promise.resolve({ initialized: true });
};
await O.finish();
check('提交路径', lastPath, '/api/user/initialize');
check('提交方法 POST', lastOptions && lastOptions.method, 'POST');
check('body.grade_code', body.grade_code, 'grade_10');
check('body.province_code', body.province_code, 'beijing');
check('body.subjects 数量', body.subjects.length, 6);
check('主科 is_main', body.subjects.filter((s) => s.is_main).length, 3);
check('提交后隐藏向导', $('wizard').hidden, true);
check('提交后显示完成区', $('done-block').hidden, false);

// 14. 错误分类（提交失败）
window.AIAPI.request = () => Promise.reject(window.AIAPI.ApiError('请选择有效的年级', { status: 400 }));
$('wizard').hidden = false;
await O.finish();
check('400 → 行内错误（仍是 success 态）', O.getState(), 'success');
check('400 文案透传', /请选择有效的年级/.test($('step-error').textContent), true);

window.AIAPI.request = () => Promise.reject(window.AIAPI.ApiError('未授权', { status: 401 }));
await O.finish();
check('401 → auth', O.getState(), 'auth');

window.AIAPI.request = () => Promise.reject(window.AIAPI.ApiError('网络连接不可用', { kind: 'network' }));
await O.finish();
check('网络失败 → offline', O.getState(), 'offline');

// 15. 加载失败分类
window.AIAPI.request = () => Promise.reject(window.AIAPI.ApiError('获取省份列表失败', { status: 500 }));
await O.load();
check('500 → error', O.getState(), 'error');
check('500 文案透传', $('error-copy').textContent, '获取省份列表失败');

for (const r of results) {
  console.log(
    `${r.ok ? 'OK  ' : 'FAIL'} ${r.name.padEnd(26)} 实际=${JSON.stringify(r.got)}` + (r.ok ? '' : ` 期望=${JSON.stringify(r.want)}`)
  );
}
const bad = results.filter((r) => !r.ok).length;
console.log(bad ? `\n❌ ${bad} 项不符` : `\n✅ ${results.length} 项全部通过`);
process.exit(bad ? 1 : 0);
