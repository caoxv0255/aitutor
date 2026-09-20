# Frontend-Hygiene-Loop — 问题诊断与修复计划书

**生成时间:** 2026-09-17
**审计员:** DeepSeek Harness (frontend-hygiene-loop)
**范围:** 全部 frontend/ + docs/design/ 22 页前端, 重点 register/login
**总评级:** ⭐⭐☆☆☆ Pre-MVP (UI 已 OK, 业务逻辑漏洞多)

---

## 0. 现状快照

| 文件 | 路径 | 注册方式 | 确认密码 | 路由处理 | 评级 |
|------|------|---------|---------|---------|------|
| `frontend/register.html` (生产 v1) | `/login` 后端邮箱+密码+年级 | ❌ 无 | 硬编码 `dashboard.html` | ⭐⭐⭐ |
| `frontend/login.html` (生产 v1) | 邮箱+密码, 游客模式 | n/a | 同上 | ⭐⭐⭐ |
| `docs/design/register.html` (v2 设计稿) | **手机号(默认)+微信+邮箱 三 tab** | ❌ 无 | **3 个 alert() mock** | ⭐ |
| `docs/design/login.html` (v2 设计稿) | 邮箱+密码, 微信/Apple/手机 social-row | n/a | 同 v1 | ⭐⭐ |
| `frontend/assets/css/style.css` | `.btn` 样式 | n/a | n/a | ⭐⭐ (缺 justify-center / line-height) |
| `frontend/assets/js/components.js` | 公共 header/footer | n/a | 跳转 `login.html` 硬编码 | ⭐⭐ (无 next 参数) |
| `api/handlers/register.js` | 后端邮箱注册 | ❌ | n/a | ⭐⭐⭐ (规范) |
| `api/handlers/login.js` | 后端邮箱登录 | n/a | n/a | ⭐⭐⭐ |
| `api/handlers/guest-login.js` | 游客模式 | n/a | 写 `dashboard.html` | ⭐⭐ (无 next) |

**关键发现:**
1. ❌ **设计稿 `docs/design/register.html` 把"手机号"放成默认 tab, 但后端 `api/handlers/` 无任何 sms / otp 路由** (查 `ls api/handlers/ | grep -iE "phone|sms|otp|verify"` 为空). 用户点"获取验证码"进入 60s 倒计时, 然后 alert "注册成功" — 整个流程是 mock, 没有任何后端调用.
2. ❌ 两个 register 页面都 **缺"确认密码"输入框**, 容易误输.
3. ❌ **所有跳转都是硬编码 `dashboard.html`**, 没有任何 `?next=` 或 `?redirect=` 参数支持. 用户从 `learning-path.html?locked=true` 跳去登录, 登完直接去 dashboard, 失去了原始 context.
4. ❌ `components.js` logout 后跳 `login.html` 也不带 next.
5. ⚠️ `.btn` 用了 `display: inline-flex; align-items: center` 但 **没 `justify-content: center`** → 单行短文字居中, 但多行或带图标时偏左. R16/R19 在 hero.html 已修过, 但 `frontend/assets/css/style.css` 全站仍是同问题.
6. ⚠️ `.btn` 没 `line-height` → 跨字体 (DM Sans vs Noto Sans SC) 垂直中心略漂.

---

## Phase 1 — UI / UI-UX 卫生

### 1.1 按钮文字垂直水平居中 (全站)

**问题:** `frontend/assets/css/style.css:179-188` `.btn` 缺 `justify-content: center` 和 `line-height`.

**修复:**

```css
.btn {
  display: inline-flex;
  align-items: center;       /* 已有 */
  justify-content: center;   /* 新增 — 水平居中, 配合图标+文字 */
  line-height: 1.2;          /* 新增 — 跨字体垂直稳定 */
  gap: 6px;
  padding: 8px 18px;
  border-radius: var(--radius-pill);
  font-size: .8rem;
  font-weight: 600;
  border: none;
  cursor: pointer;
  transition: var(--transition);
  text-decoration: none;
  white-space: nowrap;       /* 新增 — 防止按钮文字意外换行 */
}
.btn:disabled,
.btn[aria-disabled="true"] {  /* 新增 — disabled 视觉 */
  opacity: .5;
  cursor: not-allowed;
  pointer-events: none;
}
```

### 1.2 设计稿 `.submit` / `.method-tab` / `.social-btn` 居中复查

`docs/design/register.html:384-397` `.submit` 用了 `height: 52px` 固定高度 + 文字, 但缺 `display: flex`/`align-items`. 实际渲染: `button` 默认 inline-block, 文字 baseline 对齐, 偏上. 修:

```css
.submit {
  display: inline-flex;       /* 新增 */
  align-items: center;         /* 新增 */
  justify-content: center;     /* 新增 */
  gap: 8px;                    /* 新增 */
  /* 原 height/gradient/shadow 保留 */
}
.method-tab {
  /* 已有 display: inline-flex; justify-content: center, OK */
}
.social-btn {
  /* 已有 display: inline-flex; align-items: center; justify-content: center, OK */
}
```

### 1.3 通用 layout 间距

设计稿 `.form { gap: 14px }` + `.form-card { padding: 24px 20px }` 已经合理. 无需调整.

---

## Phase 2 — 业务逻辑重构

### 2.1 注册流程: 邮箱为唯一默认, 移除手机号/微信入口

**问题:** `docs/design/register.html:546-560` 三个 tab (手机/微信/邮箱), 手机是默认. 后端无 SMS 能力.

**修复方案:** 删除手机号和微信两个 tab + 两个表单, 只保留邮箱. 删 .phone / .otp / .wechat 样式 + 对应 HTML + 对应 JS (otpSendBtn 倒计时, form-phone/wechat submit). 但保留 **wechat 和 phone 的 CSS 类** (其他地方可能引用, 不删避免连带). 只改 HTML + JS 默认逻辑.

### 2.2 邮箱注册: 增加"确认密码"输入框 + 实时校验

**两处都改:**
- `frontend/register.html` (生产)
- `docs/design/register.html` (设计稿 v2)

**校验逻辑:**

```js
// 客户端校验
function validatePwdConfirm(pwd, confirm) {
  if (!confirm) return { ok: false, msg: '请再次输入密码' };
  if (pwd !== confirm) return { ok: false, msg: '两次密码不一致' };
  if (pwd.length < 8) return { ok: false, msg: '密码至少 8 位' };
  if (!/[A-Z]/.test(pwd) || !/[a-z]/.test(pwd)) return { ok: false, msg: '密码需含大小写字母' };
  if (!/\d/.test(pwd)) return { ok: false, msg: '密码需含数字' };
  return { ok: true };
}
```

**后端:** `api/utils/validator.js` 当前只校验长度 ≥ 6. 改成 ≥ 8 且必须含大小写+数字 (与 design v2 文档的 placeholder "8+ 字符, 含大小写+数字" 一致). 注意: 这是 **breaking change** — 旧用户 6 位密码登不进. 需在 validator 加向后兼容: 老密码 hash 不重新校验, 只新注册时强制. (鉴于本项目还在 MVP, 直接强制新规, 老用户用 reset-password 重置.)

### 2.3 路由: `?next=` 跳转参数支持

**现状:** 所有 `location.href = 'dashboard.html'` 硬编码.

**修复方案:** 抽公共 `navigateAfterAuth()` 工具:

```js
// frontend/assets/js/auth-nav.js (新文件)
window.AIT_AUTH_NAV = {
  getNext() {
    const params = new URLSearchParams(location.search);
    const next = params.get('next');
    // 安全: 只允许相对路径 (不跳外站)
    if (next && /^\/[A-Za-z0-9._/-]*\.html$/.test(next)) return next;
    return null;
  },
  goAfterAuth() {
    const next = this.getNext();
    location.href = next || 'dashboard.html';
  },
  attachNextToLinks() {
    const next = this.getNext();
    if (!next) return;
    document.querySelectorAll('a[data-preserve-next]').forEach(a => {
      const url = new URL(a.href, location.href);
      url.searchParams.set('next', next);
      a.href = url.toString();
    });
  }
};
```

`login.html` / `register.html` / `components.js` 都改用 `AIT_AUTH_NAV.goAfterAuth()`. `register.html` 跳到 `login.html?next=...` 时, 用 `data-preserve-next`.

### 2.4 components.js logout: 保留当前页面 next

```js
// handleLogout 改为
handleLogout() {
  localStorage.removeItem('token');
  localStorage.removeItem('username');
  localStorage.removeItem('user_id');
  const cur = location.pathname.split('/').pop();
  const nextParam = cur && cur !== 'login.html' ? `?next=${encodeURIComponent(cur)}` : '';
  window.location.href = 'login.html' + nextParam;
}
```

### 2.5 mock 提交替换为真后端调用

`docs/design/register.html:784-796` 3 个 alert mock 替换为:

```js
document.getElementById('form-email').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = e.target.querySelector('input[type=email]').value.trim();
  const pwd = e.target.querySelector('.pwd').value;
  const confirm = e.target.querySelector('.pwd-confirm').value;
  const grade = '高三'; // 默认, 真 onboarding 时改
  
  const v = validatePwdConfirm(pwd, confirm);
  if (!v.ok) return showError(v.msg);
  
  setLoading(submitBtn, true);
  try {
    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: pwd, grade })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || '注册失败');
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    AIT_AUTH_NAV.goAfterAuth();
  } catch (err) {
    showError(err.message);
    setLoading(submitBtn, false);
  }
});
```

---

## Phase 3 — 代码质量与注释

每个改动文件加:
- 文件顶部 banner: 修改日期 + 改动目的
- 关键决策加 inline 注释
- 引用 design system 的 token 名 (e.g. `--p-500`, `--surface`)

---

## 修复优先级 (Impact × Effort)

| ID | 项目 | 影响 | 难度 | 优先级 |
|----|------|------|------|--------|
| P1 | 移除手机/微信 tab, 邮箱唯一 | 用户立刻撞 mock 死路 | 🟢 易 | **P0** |
| P2 | 加确认密码 + 实时校验 | 误输风险 | 🟢 易 | **P0** |
| P3 | 修 `.btn` justify-center + line-height | UI 一致性 | 🟢 易 | **P1** |
| P4 | `?next=` 跳转支持 | UX 体验 | 🟡 中 | **P1** |
| P5 | validator 升级 ≥ 8 位含大小写+数字 | 安全 | 🟡 中 | **P1** |
| P6 | 设计稿 register.html alert → 真 API | 串通真后端 | 🟡 中 | **P2** |
| P7 | components.js logout 带 next | UX | 🟢 易 | **P2** |
| P8 | 代码注释 + banner | 可维护性 | 🟢 易 | **P3** |

---

## 不做的事 (避免 scope creep)

- 不动 PWA `public/` 端 (不在本次范围)
- 不动后端其他 handler (login.js 已规范, 不重写)
- 不重构 dashboard.html 等 22 页其他页面 (只确保它们跳登录时带 next)
- 不引入前端框架 (vanilla JS 保持)
- 不改品牌色 token (`--p-500` 等已校准)

---

## 验证脚本 (Phase 4 — 集成测试)

修完跑以下用户路径, 模拟挑剔测试工程师:

1. 打开 `/register.html` → 不输任何东西点注册 → 应阻止 (HTML5 required)
2. 输入邮箱 + 8 位无大小写密码 → 强度提示"弱"
3. 输入 8 位含大小写+数字 → 强度"强"
4. 密码和确认不一致 → 阻止 + 错误提示
5. 一致 → 调 `/api/register` → 写入 token + user → 跳 dashboard
6. 已登录状态访问 `/register.html` → 自动跳 dashboard (现有逻辑保留)
7. 访问 `/learning-path.html` (假设存在, 需登录) → 跳 `/login.html?next=learning-path.html`
8. 登录成功 → 跳回 learning-path.html
9. 点 logout → 回 login.html (无 next)
10. 视觉: 截 dark + light 模式, 验证按钮文字居中 + 表单对齐
