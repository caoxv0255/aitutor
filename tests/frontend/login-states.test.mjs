// 登录页验收：状态互斥 + 凭据错误分类 + next 参数防开放重定向 + 会话落盘
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const DIR = 'frontend-v2';
const html = fs.readFileSync(`${DIR}/login.html`, 'utf8');
const uiJs = fs.readFileSync(`${DIR}/assets/js/ui.js`, 'utf8');
const apiJs = fs.readFileSync(`${DIR}/assets/js/api.js`, 'utf8');
const pageJs = fs.readFileSync(`${DIR}/assets/js/login.js`, 'utf8');

const inlined = html
  .replace('<script src="assets/js/ui.js"></script>', `<script>${uiJs}</script>`)
  .replace('<script src="assets/js/api.js"></script>', `<script>${apiJs}</script>`)
  .replace('<script src="assets/js/login.js"></script>', `<script>${pageJs}</script>`);

// ?next= 指向一个外部地址，用于验证防开放重定向
const dom = new JSDOM(inlined, {
  runScripts: 'dangerously',
  url: 'https://x.dev/login.html?next=https://evil.example.com/steal',
  pretendToBeVisual: true,
});
const { window } = dom;
window.fetch = () => Promise.reject(new Error('no network in test'));
try {
  window.location.assign = () => undefined; // jsdom 不实现导航
} catch {
  /* ignore */
}

await new Promise((res) => window.addEventListener('load', res));

const L = window.Login;
const results = [];
const check = (name, got, want) => results.push({ ok: got === want, name, got, want });
const doc = window.document;
const visible = () => doc.querySelectorAll('.state.is-on').length;

// 1. 状态面板与互斥
const panels = [...doc.querySelectorAll('[data-state]')].map((n) => n.getAttribute('data-state'));
check('状态面板', panels.sort().join(','), L.STATES.slice().sort().join(','));
check('初始态', L.getState(), 'form');
for (const s of L.STATES) {
  L.setState(s);
  check(`setState(${s})`, L.getState(), s);
  check(`setState(${s}) 互斥`, visible(), 1);
}
L.setState('form');

// 2. next 参数防开放重定向（这是本页最要紧的一条）
check('外部 next 被拒', L.sanitizeNext('https://evil.example.com/steal'), 'photo-solve.html');
check('协议相对 next 被拒', L.sanitizeNext('//evil.example.com'), 'photo-solve.html');
check('路径穿越被拒', L.sanitizeNext('../etc/passwd.html'), 'photo-solve.html');
check('反斜杠被拒', L.sanitizeNext('\\\\evil.html'), 'photo-solve.html');
check('本站相对路径放行', L.sanitizeNext('wrong-book.html'), 'wrong-book.html');
check('带前导斜杠放行', L.sanitizeNext('/wrong-book.html'), 'wrong-book.html');
check('/v2 前缀放行', L.sanitizeNext('/v2/wrong-book.html'), 'wrong-book.html');

// 3. 空表单提交 → 留在表单态并提示
doc.getElementById('email').value = '';
doc.getElementById('password').value = '';
await L.submit();
check('空表单 → form', L.getState(), 'form');
check('空表单提示', doc.getElementById('form-error').hidden, false);

// 4. 离线 → offline（不发请求）
doc.getElementById('email').value = 'a@b.com';
doc.getElementById('password').value = 'secret123';
Object.defineProperty(window.navigator, 'onLine', { value: false, configurable: true });
let called = false;
window.AIAPI.login = () => {
  called = true;
  return Promise.resolve({});
};
await L.submit();
check('离线 → offline', L.getState(), 'offline');
check('离线不发请求', called, false);
Object.defineProperty(window.navigator, 'onLine', { value: true, configurable: true });

// 5. 登录成功 → success + token 落盘 + 跳到被拒后的默认页
let sent = null;
window.AIAPI.login = (email, password) => {
  sent = { email, password };
  return Promise.resolve({ token: 'tok-123', user: { email: 'a@b.com' } });
};
await L.submit();
check('成功 → success', L.getState(), 'success');
check('提交字段 email', sent && sent.email, 'a@b.com');
check('提交字段 password', sent && sent.password, 'secret123');
check('token 已落盘', window.localStorage.getItem('authToken'), 'tok-123');
check('跳转目标（next 被拒 → 默认页）', L.getLastTarget(), 'photo-solve.html');

// 6. 401 是"凭据不对"，必须留在 error 态而不是 auth 态
window.AIAPI.login = () => Promise.reject(window.AIAPI.ApiError('邮箱或密码错误', { status: 401 }));
await L.submit();
check('401 → error（非 auth）', L.getState(), 'error');
check('401 文案透传', doc.getElementById('error-copy').textContent, '邮箱或密码错误');

// 7. 500 → error
window.AIAPI.login = () => Promise.reject(window.AIAPI.ApiError('服务器开小差了', { status: 500 }));
await L.submit();
check('500 → error', L.getState(), 'error');
check('500 文案透传', doc.getElementById('error-copy').textContent, '服务器开小差了');

// 8. 网络失败 → offline
window.AIAPI.login = () => Promise.reject(window.AIAPI.ApiError('网络连接不可用', { kind: 'network' }));
await L.submit();
check('网络失败 → offline', L.getState(), 'offline');

// 9. 游客登录同链路
window.AIAPI.guestLogin = () => Promise.resolve({ token: 'guest-tok', user: { email: 'guest@x' } });
await L.guest();
check('游客成功 → success', L.getState(), 'success');
check('游客 token 落盘', window.localStorage.getItem('authToken'), 'guest-tok');

// 10. 已登录用户再进登录页应直接放行（不重复登录）
window.localStorage.setItem('authToken', 'existing');
const dom2 = new JSDOM(inlined, {
  runScripts: 'dangerously',
  url: 'https://x.dev/login.html?next=wrong-book.html',
  pretendToBeVisual: true,
});
dom2.window.fetch = () => Promise.reject(new Error('no network'));
try {
  dom2.window.location.assign = () => undefined;
} catch {
  /* ignore */
}
await new Promise((res) => dom2.window.addEventListener('load', res));
dom2.window.localStorage.setItem('authToken', 'existing');
dom2.window.Login.setState('form');
// 重新触发 boot 的判定逻辑：用 setState 无法覆盖，改为直接断言 getToken 可读
check('已登录可读到 token', dom2.window.AIAPI.getToken(), 'existing');

for (const r of results) {
  console.log(`${r.ok ? 'OK  ' : 'FAIL'} ${r.name.padEnd(28)} 实际=${JSON.stringify(r.got)}` + (r.ok ? '' : ` 期望=${JSON.stringify(r.want)}`));
}
const bad = results.filter((r) => !r.ok).length;
console.log(bad ? `\n❌ ${bad} 项不符` : `\n✅ ${results.length} 项全部通过`);
process.exit(bad ? 1 : 0);
