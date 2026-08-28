# D076 — F3 首页生产 CSP 三档化（2026-08-27）

> **类型**: P0 线上修复 (P1 长期收口建议)
> **触发**: 用户访问 `https://aitutor.uibe.online/` 报告"裸文本骨架"
> **范围**: `api/middleware/security.js` CSP 分支（一处，+16 / -4）
> **状态**: ✅ 本地修复已验证（1280×800 / 2048×1080 都完美渲染），待生产部署

---

## 0. 触发背景

2026-08-27 用户截图：F3 首页所有结构化卡片、数据指标、可信度佐证图标、轮播图都没渲染，控制台全是 CSP violation：

```
[error] Loading the script 'https://cdn.jsdelivr.net/.../tailwindcss@4/...' violates
        the following Content Security Policy directive: "script-src 'self'".
[error] Loading the script 'https://unpkg.com/lucide@1.8.0/dist/umd/lucide.min.js'
        violates ... "script-src 'self'".
[error] Executing inline script violates ... 'script-src 'self''.
```

**根因**：`api/middleware/security.js` 的生产 CSP 是 `script-src 'self'`，但 F3 (`ai-tutor-frontend/`) 依赖：
1. `https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4/...` （Tailwind 浏览器版 CDN）
2. `https://unpkg.com/lucide@.../lucide.min.js` （lucide 图标 CDN）
3. 内联 `<script>`（`lucide.createIcons()`、`navator.mount()`）

三个全部被拦截 → 45 个 `i[data-lucide]` 保持原始文本、所有 `bg-primary-*` `text-foreground` 失效。

---

## 1. 修复要点

把 CSP 二元分支改为三档：

```js
//   - dev                  → 旧版宽松 (unsafe-inline + jsdelivr + unpkg)
//   - prod + SERVE_F3=true → 显式 opt-in 放宽 (F3 必需)
//   - prod + SERVE_F3!=true → 'self' only (旧严格行为, 不破坏)
const isProd = process.env.NODE_ENV === 'production';
const F3_ENABLED = isProd ? process.env.SERVE_F3 === 'true' : true;
```

**关键不变量**：
- 默认（不设 `SERVE_F3`）行为**逐字节不变** — 仍走 `'self' only`
- 显式 opt-in 需同时满足 `NODE_ENV=production` + `SERVE_F3=true`
- `docker-compose.prod.yml` 已含 `SERVE_F3=true`，部署 0 额外配置

---

## 2. 安全分析

| 维度 | 评估 |
|------|------|
| 默认收紧 | ✅ 不变（不设 `SERVE_F3` 与旧版完全一致） |
| 显式 opt-in | ✅ 需 `SERVE_F3=true` 同时 `NODE_ENV=production` |
| 来源白名单 | ✅ 仅 +jsdelivr/unpkg 两个 F3 真依赖的 CDN |
| `unsafe-inline` | ⚠️ Tailwind browser CDN 内部就是 inline style，必须放行 |
| 与 D067 兼容 | ✅ D067 是防 `DEV_AUTH_BYPASS` 残留；本次是显式声明，环境变量名不冲突 |
| 与 D069/D075 兼容 | ✅ `.env.prod` 已经设了 `SERVE_F3=true`，发布门禁不破坏 |

**风险等级**：LOW（默认路径无变化 + 显式 opt-in + 来源白名单 + 与现有配置文件自洽）

---

## 3. 验证结果

| 测试 | 结果 |
|------|------|
| 本地 `node server.js` + curl CSP header | ✅ 含 `'unsafe-inline' https://cdn.jsdelivr.net https://unpkg.com` |
| Playwright 1280×800 | ✅ docHeight 6633→3569, 45 SVG, 0 raw `<i>`, 卡片 padding=48px |
| Playwright 2048×1080 | ✅ 红色 hero banner + 4 卡片统计 + 4 卡片可信度 + 3 卡片样例报告 + 17 省选择器 + 8 卡片核心功能 + 3 卡片新手入门 + 6 科预测模拟卷 + 6 科 2026 趋势预测 |
| `bash scripts/release-gate.sh` | ✅ vitest 全绿 + contract 全绿 + health dbReady=true |
| Console errors | ✅ 0 CSP violation, 0 failed requests |

---

## 4. 部署

详见 `deploy/fix-f3-csp-now.sh` + `deploy/fix-f3-csp.README.md`。

**关键**：本会话修改在 `/home/flaskappuser/Desktop/NewDisk_2T/aitutor/`，但生产 server 跑的是另一份 working copy。要让 `aitutor.uibe.online` 修复，需：

```bash
sudo bash deploy/fix-f3-csp-now.sh   # 一键打 patch + 校验 .env + 重启
# 或手动:
cd <生产仓库>
git apply deploy/fix-f3-csp.security.js.patch
sudo systemctl restart uibe-tutor
curl -sI https://aitutor.uibe.online/ | grep -i 'content-security'   # 验证
```

---

## 5. 已知缺口（建议 D077 收口）

- **D077-NO-CDN**：把 Tailwind 改成 `@tailwindcss/cli` 预编译产物，把 lucide 改成 `import` 本地资源或 npm 打包；这样 CSP 可永久收紧到 `script-src 'self' style-src 'self'`，不需要 `'unsafe-inline'`、不需要 CDN 白名单 → 防御力更强

---

## 6. 部署实战记录 (2026-08-27, 当天)

生产 server (`pid=3516589`, cwd=`/home/flaskappuser/Desktop/NewDisk_2T/aitutor`, systemd `uibe-tutor.service` 自 8/24 起 `inactive (dead)`——非 systemd 托管) 通过以下步骤零停机替换：

1. 双跑：在 3003 端口起 patched 实例 → 自检 CSP 含 `'unsafe-inline' https://cdn.jsdelivr.net https://unpkg.com` ✓ → kill 3003 测试实例
2. `kill -TERM 3516589` 优雅停旧（实际 1s 内退出）→ 端口 3002 释放
3. `setsid PORT=3002 SERVE_F3=true NODE_ENV=production node server.js` 起新（pid=3951806）→ `dbReady: true`
4. Playwright 在 `https://aitutor.uibe.online/f3/pages/index.html` 验证：lucide 45 个 SVG 全部渲染，0 console error

**额外发现**：Cloudflare 边缘自动注入 `https://static.cloudflareinsights.com/beacon.min.js/v4513...` 用于 Web Analytics。被 CSP `script-src` 默认拦截，已加入白名单：
```diff
- script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://unpkg.com
+ script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://unpkg.com https://static.cloudflareinsights.com
- connect-src 'self' https://dashscope.aliyuncs.com
+ connect-src 'self' https://dashscope.aliyuncs.com https://cloudflareinsights.com
```

**回滚路径**（如需）：
```bash
# 1. 反向 patch
cd /home/flaskappuser/Desktop/NewDisk_2T/aitutor
git checkout api/middleware/security.js
# 2. 重启
PID=$(ss -tnlp | grep ':3002 ' | grep -oP 'pid=\K[0-9]+'); kill -TERM $PID
sleep 1
PORT=3002 SERVE_F3=true NODE_ENV=production setsid node server.js > .ait-page-shell/server-3002.log 2>&1 < /dev/null &
```

**当前状态**：✅ 已生效，`https://aitutor.uibe.online/` 与 `https://aitutor.uibe.online/f3/pages/index.html` 全部正常渲染。

---

## 7. 二次修复 (同 2026-08-27, Dashboard 省份无法选择)

### 现象
- 用户报告：`https://aitutor.uibe.online/dashboard.html` 选择省份无选项
- 真实多 bug 叠加，不是单一原因

### Playwright 复现链
1. 浏览器 console: `"undefined" is not valid JSON`
2. dashboard.html 内联 IIFE 第一行 `JSON.parse(localStorage.getItem('user') || '{}')` 抛错 → 后续 `loadProvinces()` `loadUserProvince()` 永远不跑
3. `localStorage.token === "undefined"`（**字符串**），`localStorage.user === "undefined"`
4. DB `provinces` 表 0 行 → 即使跑 `loadProvinces` 也返回空

### 根因

**bug 1: envelope 升级未迁移前端**（D074/D075 后端改成 `{success, message, data: {token, user}}`，但 `frontend/login.html` 与 `frontend/register.html` 还读 `data.token`）→ 写进 localStorage 的是 `"undefined"`（字符串）

**bug 2: seed 启动失败** — 之前 server 启动日志显示 `[Seed] 省份自动导入失败`；DB `provinces` 表 0 行；前端 `/api/provinces` 返回 `data: []`

### 修复

**文件 1: `frontend/login.html` (2 处: loginForm + guestBtn)**
```diff
- localStorage.setItem('token', data.token);
- localStorage.setItem('user', JSON.stringify(data.user));
+ // D076-fix: 后端 v1.0 envelope 是 {success, message, data: {token, user}}
+ // 老代码读 data.token → undefined, 写进 localStorage 后 dashboard JSON.parse 抛错
+ // 兼容双路径: data.data?.token || data.token
+ const payload = data.data || data;
+ localStorage.setItem('token', payload.token);
+ localStorage.setItem('user', JSON.stringify(payload.user));
```

**文件 2: `frontend/register.html` (1 处)** —— 同样 patch。

**操作 3: DB seed** —— `POST /api/provinces/seed`（admin 端点），返回 `count: 44`；随后 `POST /api/cache/clear-provinces` 清 cache service 内的 stale 内存缓存。

**操作 4: 重启 node 进程** 让 `login.html` / `register.html` 静态资源新版本上线。

### Playwright e2e 验证
```bash
node .ait-page-shell/repro-dash-final.cjs
# SELECT RESULT: { selected: "北京 (自主命题)", value: "beijing", totalOptions: 32 }
# AFTER SAVE: { provinceNameDisplay: "北京", provinceShowDisplay: "flex", provinceSelectBoxDisplay: "none" }
```

### 防范措施（建议 D077 + D078）
- **D077-API-CONTRACT-MIG**: 一旦后端 envelope 改动，grep `data\.(token|user|id|email)` 找所有未迁移前端；纳入 `.ai/decisions/D062` 强制检查
- **D078-LOCALSTORAGE-TYPED**: 写 `localStorage.setItem('token', value)` 前必须有 `typeof value === 'string' && value` guard，否则会写字符串 "undefined"，引发级联 bug

---

## 8. 三次修复 (2026-08-27, 下拉框浅深色适配)

用户反馈：「省份选择器在深色模式下文字看不清」。

### 现状（截图）
- 浅色: 卡片背景 `#f1f1f5` + 文字 `#1a1a22` → 可读
- 深色: 卡片 `#1a1d27` + 文字 `#a0a0b0` → 勉强；下拉面板是 chrome UA 浅蓝+白字 → 与深色背景冲突

### 修复要点
1. **全局 `color-scheme: light dark`**（`style.css`）— 告诉浏览器原生 select 下拉面板跟随系统主题
2. **`.province-selector select` 重写**：拆掉合并 background，改用 `background-color` + `background-image` 分开写
3. **`:has(option:checked:not([value=""]))` 选中态**：accent 边框 + 6%/18% 红底 + 加粗
4. **`option[value=""]:not([disabled])` placeholder 项**：灰字斜体，与正常选项区分
5. **`[data-theme="dark"]` 覆写**：bg → `#1a1d27`，color → `#e8ecf1`，border → `#2a2d38`，箭头变亮红 `#ff686d`
6. **全局表单元素 fallback**：任何后续页面的 `select / input / textarea` 也有深浅主题感知

### 修改文件
- `frontend/assets/css/style.css`:
  - `:root { color-scheme: light dark; }` + `html { color-scheme: light dark; }`
  - 全局 `select, input, textarea` 暗色 + 暗色覆写
- `frontend/dashboard.html`: `.province-selector select` 整套样式替换（含 closed / hover / focus / checked / disabled / dark 覆写）

### Playwright e2e 验证（截图见 `.ait-page-shell/select-{light,dark}-{closed,selected}.png`）
| 状态 | light | dark |
|------|-------|------|
| closed bg | `rgb(241, 241, 245)` | `rgb(26, 29, 39)` |
| closed fg | `rgb(26, 26, 34)` | `rgb(232, 236, 241)` |
| closed border | `rgb(226, 226, 232)` | `rgb(42, 45, 56)` |
| selected bg | `rgba(215, 25, 32, 0.06)` | `rgba(215, 25, 32, 0.18)` |
| selected border | `rgb(215, 25, 32)` 红 | `rgb(255, 104, 109)` 亮红 |
| selected weight | 600 | 600 |
| `color-scheme` | `light dark` | `light dark` |

**注**：native `<select>` 打开后的 OS panel 由浏览器 UA 渲染（非我们的 DOM），但因为设置了 `color-scheme: light dark`，OS 主题会自动决定面板配色——浅色系统看浅色面板，深色系统看深色面板。
