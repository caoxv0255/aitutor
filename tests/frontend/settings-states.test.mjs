// 设置页验收：六态 + 7 tab 互斥 + 档案回填 + 保存契约 + 偏好持久化 + 错误分类
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const DIR = 'frontend-v2';
const html = fs.readFileSync(`${DIR}/settings.html`, 'utf8');
const uiJs = fs.readFileSync(`${DIR}/assets/js/ui.js`, 'utf8');
const apiJs = fs.readFileSync(`${DIR}/assets/js/api.js`, 'utf8');
const pageJs = fs.readFileSync(`${DIR}/assets/js/settings.js`, 'utf8');

const inlined = html
  .replace(/<script src="[^"]*ui\.js"><\/script>/, `<script>${uiJs}</script>`)
  .replace(/<script src="[^"]*api\.js"><\/script>/, `<script>${apiJs}</script>`)
  .replace(/<script src="[^"]*settings\.js"><\/script>/, `<script>${pageJs}</script>`);

const dom = new JSDOM(inlined, {
  runScripts: 'dangerously',
  url: 'https://x.dev/settings.html',
  pretendToBeVisual: true,
});
const { window } = dom;
window.fetch = () => Promise.reject(new Error('no network in test'));
window.localStorage.setItem('authToken', 'stub-token');
await new Promise((res) => window.addEventListener('load', res));

const S = window.Settings;
const results = [];
const check = (name, got, want) => results.push({ ok: got === want, name, got, want });
const doc = window.document;
const $ = (id) => doc.getElementById(id);
const visible = () => doc.querySelectorAll('.state.is-on').length;
const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));

// 后端真实形状：GET /api/user/profile（handlers/user-profile.js）
const PROFILE = {
  initialized: true,
  grade_code: 'grade_10',
  province_code: 'beijing',
  exam_level: 'gaokao',
  target_score: 650,
  study_hours_per_day: 2.5,
  weak_subjects: ['math'],
  preferences: { notifications: { review: true, weekly: false }, privacy: { leaderboard: false } },
};
const ME = { email: 'stu@x.dev', name: '小明', grade: 'grade_10' };
const PROVINCES = [
  { code: 'beijing', name: '北京', exam_type: 'gaokao' },
  { code: 'hebei', name: '河北', exam_type: 'gaokao' },
];

let lastPath = '';
let lastOptions = null;
window.AIAPI.request = (path, options) => {
  lastPath = path;
  lastOptions = options || null;
  if (path === '/api/auth/me') return Promise.resolve({ data: ME });
  if (path === '/api/user/profile') return Promise.resolve({ data: PROFILE });
  if (path.startsWith('/api/user/provinces')) return Promise.resolve({ data: PROVINCES });
  if (path === '/api/auth/logout') return Promise.resolve({ success: true });
  return Promise.resolve({});
};

// 1. 六态面板齐备且互斥
const panels = [...doc.querySelectorAll('[data-state]')].map((n) => n.getAttribute('data-state'));
check('六态面板', panels.sort().join(','), S.STATES.slice().sort().join(','));
for (const s of S.STATES) {
  S.setState(s);
  check(`setState(${s})`, S.getState(), s);
  check(`setState(${s}) 互斥`, visible(), 1);
}

// 2. 无 token → auth
window.localStorage.removeItem('authToken');
await S.load();
check('无 token → auth', S.getState(), 'auth');
window.localStorage.setItem('authToken', 'stub-token');

// 3. 离线 → offline 且不发请求
Object.defineProperty(window.navigator, 'onLine', { value: false, configurable: true });
let calls = 0;
window.AIAPI.request = () => {
  calls += 1;
  return Promise.resolve({ data: PROFILE });
};
await S.load();
check('离线 → offline', S.getState(), 'offline');
check('离线不发请求', calls, 0);
Object.defineProperty(window.navigator, 'onLine', { value: true, configurable: true });

// 4. 未初始化档案 → empty（后端 initialized:false 的真实空态）
window.AIAPI.request = (path) => {
  lastPath = path;
  if (path === '/api/user/profile') return Promise.resolve({ data: { initialized: false } });
  return Promise.resolve({ data: [] });
};
await S.load();
check('未初始化 → empty', S.getState(), 'empty');

// 5. 正常加载 → success，档案回填
window.AIAPI.request = (path, options) => {
  lastPath = path;
  lastOptions = options || null;
  if (path === '/api/auth/me') return Promise.resolve({ data: ME });
  if (path === '/api/user/profile') return Promise.resolve({ data: PROFILE });
  if (path.startsWith('/api/user/provinces')) return Promise.resolve({ data: PROVINCES });
  if (path === '/api/auth/logout') return Promise.resolve({ success: true });
  return Promise.resolve({});
};
await S.load();
await tick(0);
check('正常加载 → success', S.getState(), 'success');
check('me 拉取路径', lastPath, '/api/user/provinces?exam_level=gaokao');
check('账号 email 回填', $('me-email').textContent, 'stu@x.dev');
check('账号昵称回填', $('me-name').textContent, '小明');
check('年级下拉条数', $('grade-select').options.length, 6);
check('年级回填 grade_10', $('grade-select').value, 'grade_10');
check('省份回填 beijing', $('province-select').value, 'beijing');
check('目标分回填', $('target-score').value, '650');
check('时长回填', $('study-hours').value, '2.5');

// 6. 7 tab 与页面树一致，且互斥
check('tab 数量', S.TABS.length, 7);
check(
  'tab 清单',
  S.TABS.join(','),
  'account,password,study,notifications,privacy,billing,about'
);
S.showTab('study');
check('showTab(study) 当前', S.getTab(), 'study');
check('study 面板可见', $('panel-study').hidden, false);
check('account 面板隐藏', $('panel-account').hidden, true);
check('study tab 高亮', $('tab-study').classList.contains('tab--on'), true);
check('billing tab 不高亮', $('tab-billing').classList.contains('tab--on'), false);

// 7. 缺口 tab：密码 / 订阅只做说明，不渲染假表单
check('密码 tab 无输入', $('panel-password').querySelectorAll('input').length, 0);
check('订阅 tab 无输入', $('panel-billing').querySelectorAll('input').length, 0);
check('密码 tab 有缺口说明', /尚未提供/.test($('panel-password').textContent), true);
check('订阅 tab 有缺口说明', /尚未提供/.test($('panel-billing').textContent), true);

// 8. 通知/隐私开关回填（F.10 形状 + 缺省 fallback）
S.showTab('notifications');
check('通知 review 回填 true', $('ntf-review').checked, true);
check('通知 weekly 回填 false', $('ntf-weekly').checked, false);
check('隐私 leaderboard 回填 false', $('prv-leaderboard').checked, false);
check('隐私 parent_view 默认 false', $('prv-parent-view').checked, false);

// 9. 保存学习档案：路径 / 方法 / body
S.showTab('study');
$('grade-select').value = 'grade_11';
$('province-select').value = 'hebei';
$('target-score').value = '660';
$('study-hours').value = '3';
let body = null;
window.AIAPI.request = (path, options) => {
  lastPath = path;
  lastOptions = options || null;
  body = options && options.body;
  return Promise.resolve({ success: true, message: '用户档案更新成功' });
};
const studyOutcome = await S.saveStudy();
check('保存学习档案路径', lastPath, '/api/user/profile');
check('保存学习档案方法', lastOptions && lastOptions.method, 'POST');
check('body.grade_code', body.grade_code, 'grade_11');
check('body.province_code', body.province_code, 'hebei');
check('body.target_score', body.target_score, 660);
check('body.study_hours_per_day', body.study_hours_per_day, 3);
check('保存成功提示', $('study-saved').hidden, false);
check('保存返回 saved', studyOutcome, 'saved');

// 10. 保存通知偏好：preferences.notifications 写入
S.showTab('notifications');
$('ntf-weekly').checked = true;
lastPath = '';
body = null;
await S.savePrefs('notifications');
check('保存通知路径', lastPath, '/api/user/profile');
check('body.preferences.notifications.review', body.preferences.notifications.review, true);
check('body.preferences.notifications.weekly 被改动', body.preferences.notifications.weekly, true);

// 11. 保存隐私偏好：preferences.privacy 写入
S.showTab('privacy');
$('prv-parent-view').checked = true;
body = null;
await S.savePrefs('privacy');
check('body.preferences.privacy.parent_view', body.preferences.privacy.parent_view, true);

// 12. 保存失败分类
window.AIAPI.request = () => Promise.reject(window.AIAPI.ApiError('更新用户档案失败', { status: 500 }));
const studyErr = await S.saveStudy();
check('500 → 行内错误（仍是 success 态）', S.getState(), 'success');
check('500 文案透传', /更新用户档案失败/.test($('study-error').textContent), true);
check('保存返回 error', studyErr, 'error');

window.AIAPI.request = () => Promise.reject(window.AIAPI.ApiError('未授权', { status: 401 }));
await S.saveStudy();
check('401 → auth', S.getState(), 'auth');

window.AIAPI.request = () => Promise.reject(window.AIAPI.ApiError('网络连接不可用', { kind: 'network' }));
await S.saveStudy();
check('网络失败 → offline', S.getState(), 'offline');

// 13. 加载失败分类（整页）
window.AIAPI.request = () => Promise.reject(window.AIAPI.ApiError('获取用户档案失败', { status: 500 }));
await S.load();
check('加载 500 → error', S.getState(), 'error');
check('加载 500 文案透传', $('error-copy').textContent, '获取用户档案失败');

// 14. 退出登录：先调端点再清 token
window.localStorage.setItem('authToken', 'stub-token');
let logoutCalled = false;
window.AIAPI.request = (path, options) => {
  lastPath = path;
  lastOptions = options || null;
  if (path === '/api/auth/logout') {
    logoutCalled = true;
    return Promise.resolve({ success: true });
  }
  return Promise.resolve({ data: PROFILE });
};
// 阻断真实跳转，只验证清 token 与端点调用（jsdom 不实现导航，href 不会变）
await S.logout();
check('logout 调用端点', lastPath, '/api/auth/logout');
check('logout 方法 POST', lastOptions && lastOptions.method, 'POST');
check('logout 清 token', window.localStorage.getItem('authToken'), null);

for (const r of results) {
  console.log(
    `${r.ok ? 'OK  ' : 'FAIL'} ${r.name.padEnd(26)} 实际=${JSON.stringify(r.got)}` + (r.ok ? '' : ` 期望=${JSON.stringify(r.want)}`)
  );
}
const bad = results.filter((r) => !r.ok).length;
console.log(bad ? `\n❌ ${bad} 项不符` : `\n✅ ${results.length} 项全部通过`);
process.exit(bad ? 1 : 0);
