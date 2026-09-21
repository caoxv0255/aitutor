// 注册页验收：状态互斥 + 密码强度预检 + 年级枚举 + 错误分类
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const DIR = 'frontend-v2';
const html = fs.readFileSync(`${DIR}/register.html`, 'utf8');
const uiJs = fs.readFileSync(`${DIR}/assets/js/ui.js`, 'utf8');
const apiJs = fs.readFileSync(`${DIR}/assets/js/api.js`, 'utf8');
const pageJs = fs.readFileSync(`${DIR}/assets/js/register.js`, 'utf8');

const inlined = html
  .replace(/<script src="[^"]*ui\.js"><\/script>/, `<script>${uiJs}</script>`)
  .replace(/<script src="[^"]*api\.js"><\/script>/, `<script>${apiJs}</script>`)
  .replace(/<script src="[^"]*register\.js"><\/script>/, `<script>${pageJs}</script>`);

const dom = new JSDOM(inlined, {
  runScripts: 'dangerously',
  url: 'https://x.dev/register.html',
  pretendToBeVisual: true,
});
const { window } = dom;
window.fetch = () => Promise.reject(new Error('no network in test'));
try {
  window.location.assign = () => undefined;
} catch {
  /* ignore */
}

await new Promise((res) => window.addEventListener('load', res));

const R = window.Register;
const results = [];
const check = (name, got, want) => results.push({ ok: got === want, name, got, want });
const doc = window.document;
const visible = () => doc.querySelectorAll('.state.is-on').length;

// 1. 状态面板与互斥
const panels = [...doc.querySelectorAll('[data-state]')].map((n) => n.getAttribute('data-state'));
check('状态面板', panels.sort().join(','), R.STATES.slice().sort().join(','));
check('初始态', R.getState(), 'form');
for (const s of R.STATES) {
  R.setState(s);
  check(`setState(${s})`, R.getState(), s);
  check(`setState(${s}) 互斥`, visible(), 1);
}
R.setState('form');

// 2. 密码强度预检必须与服务端 strict 规则一致（≥8 / 大小写 / 数字）
check('太短被拒', R.precheckPassword('Ab1'), '密码至少 8 位');
check('无大写被拒', R.precheckPassword('abcd1234'), '密码需含大小写字母');
check('无数字被拒', R.precheckPassword('Abcdefgh'), '密码需含数字');
check('合规通过', R.precheckPassword('Abcdef12'), null);

// 3. 年级选项必须与后端 VALID_GRADES 对齐（缺一个就会在服务端 400）
const gradeValues = [...doc.getElementById('grade').options]
  .map((o) => o.value)
  .filter(Boolean)
  .sort();
const VALID_GRADES = [
  '小学', '初中', '高中',
  '小一', '小二', '小三', '小四', '小五', '小六',
  '初一', '初二', '初三',
  '高一', '高二', '高三',
].sort();
check('年级枚举与后端一致', gradeValues.join(','), VALID_GRADES.join(','));

// 4. 必填校验：缺年级不得发请求
doc.getElementById('email').value = 'a@b.com';
doc.getElementById('password').value = 'Abcdef12';
doc.getElementById('grade').value = '';
let called = false;
window.AIAPI.register = () => {
  called = true;
  return Promise.resolve({});
};
await R.submit();
check('缺年级 → form', R.getState(), 'form');
check('缺年级不发请求', called, false);
check('缺年级有提示', doc.getElementById('form-error').hidden, false);

// 5. 弱密码在本地就被拦（不发请求）
doc.getElementById('grade').value = '初二';
doc.getElementById('password').value = 'abcdefgh';
await R.submit();
check('弱密码 → form', R.getState(), 'form');
check('弱密码不发请求', called, false);
check('弱密码提示', doc.getElementById('form-error').textContent, '密码需含大小写字母');

// 6. 离线
doc.getElementById('password').value = 'Abcdef12';
Object.defineProperty(window.navigator, 'onLine', { value: false, configurable: true });
await R.submit();
check('离线 → offline', R.getState(), 'offline');
check('离线不发请求', called, false);
Object.defineProperty(window.navigator, 'onLine', { value: true, configurable: true });

// 7. 注册成功 → success + 落盘 + 跳引导页
let sent = null;
window.AIAPI.register = (payload) => {
  sent = payload;
  return Promise.resolve({ token: 'new-tok', user: { email: 'a@b.com', grade: '初二' } });
};
await R.submit();
check('成功 → success', R.getState(), 'success');
check('提交 email', sent && sent.email, 'a@b.com');
check('提交 grade', sent && sent.grade, '初二');
check('提交 password', sent && sent.password, 'Abcdef12');
check('token 落盘', window.localStorage.getItem('authToken'), 'new-tok');
check('跳转目标（onboarding 未接管 → 根路径）', R.getLastTarget(), '/');

// 8. 邮箱已注册（400）→ error，透传后端文案
window.AIAPI.register = () => Promise.reject(window.AIAPI.ApiError('该邮箱已注册', { status: 400 }));
await R.submit();
check('400 → error', R.getState(), 'error');
check('已注册文案透传', doc.getElementById('error-copy').textContent, '该邮箱已注册');

// 9. 网络失败 → offline；500 → error
window.AIAPI.register = () => Promise.reject(window.AIAPI.ApiError('网络连接不可用', { kind: 'network' }));
await R.submit();
check('网络失败 → offline', R.getState(), 'offline');

window.AIAPI.register = () => Promise.reject(window.AIAPI.ApiError('注册失败', { status: 500 }));
await R.submit();
check('500 → error', R.getState(), 'error');

for (const r of results) {
  console.log(`${r.ok ? 'OK  ' : 'FAIL'} ${r.name.padEnd(30)} 实际=${JSON.stringify(r.got)}` + (r.ok ? '' : ` 期望=${JSON.stringify(r.want)}`));
}
const bad = results.filter((r) => !r.ok).length;
console.log(bad ? `\n❌ ${bad} 项不符` : `\n✅ ${results.length} 项全部通过`);
process.exit(bad ? 1 : 0);
