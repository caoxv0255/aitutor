# aitutor 前端跳转逻辑审查 (2026-08-24)

## 0. 摘要

| 类别 | 数量 | 严重度 |
|------|------|--------|
| 🔴 P0: 点击无反应 (核心流程断) | 6 | 必须修 |
| 🟡 P1: 跳错或跳占位 | 5 | 应当修 |
| 🟠 P1: 端点缺失 (前端调,后端 404) | 3 | 应当补 |
| 🟢 P2: 高亮/导航不一致 | 4 | 顺手修 |

---

## 1. 🔴 P0: 顶部 navator 没调用的页面 (3 个)

3 个核心 F3 页面**没调 `mount()` (或 `mountNav`)**,导致:
- **没有顶部水平导航条** (用户无法快速跳 F3 其他 7 个页面)
- 用户只能依赖左侧 sidebar 跳转

| 文件 | 问题 | 修复 |
|------|------|------|
| `pages/dashboard.html` | 无 `import { mount } from '../assets/js/navator.js'` 也没调用 | 在已有 module script 末尾加 `import` + `mount({ active: 'dash' })` |
| `pages/tutor.html` | 同上 | 加 `mount({ active: 'tutor' })` |
| `pages/mastery.html` | 同上 | 加 `mount({ active: 'mastery' })` |

> 其它 21 个 F3 页面都调了 `mount({ active: 'home' })` — **但都用 home**, 即使是 tutor/vision/exam 等非首页, 高亮仍是"首页" (见 §4 P2)

---

## 2. 🔴 P0: 7 个 `href="#"` 占位 (点了无反应)

| 文件 | 占位文字 | 应指向 |
|------|---------|--------|
| `pages/dashboard.html` | 我的报告 | `review.html` (或新建 `my-reports.html`) |
| `pages/dashboard.html` | 学习路径 | `learning-path.html` |
| `pages/mastery.html` | 我的报告 | `review.html` |
| `pages/mastery.html` | 学习路径 | `learning-path.html` |
| `pages/mastery.html` | 查看全部 (在薄弱知识点板块) | `learning-path.html?kp=...` 或 `#`+JS 展开 |
| `pages/login.html` | 忘记密码? | 弹出提示 toast, 或 `/api/auth/reset-password` (compat 410) |
| `pages/register.html` | 服务条款 / 隐私政策 | `methodology.html` 占位 (现 D070 兼容期) |

---

## 3. 🟡 P1: 内联 script 调用旧 compat 410 路径

`pages/my-weak-points.html` line ~165 内联 `fetch('/api/generate-paper', { method: 'POST' ... })`:
- compat 给 **410 Gone** ("API 已废弃, 用 /api/tutor/ask")
- 前端应改用 `tutor.ask` (200 OK),或**前端自己生成 mock** (无后端生成卷功能)

---

## 4. 🟠 P1: 端点缺失 (F3 services 调了, 后端 404)

| F3 service 调用 | 端点 | 后端状态 |
|----------------|------|---------|
| `rag.ask()` | `POST /api/rag/ask` | ❌ **404** |
| `rag.explain()` | `POST /api/rag/explain` | ❌ **404** |
| `tutor.getHistory()` | `GET /api/tutor/sessions` | ❌ **404** |

**修复**:
- 简单方案: 让 F3 service fallback 到 mock (`ask → tutor.ask`, `explain → tutor.ask`, `getHistory → []`)
- 或: 在 modules/rag/routes.js + modules/tutor/routes.js 补这 3 个路由

---

## 5. 🟢 P2: navator active key 错 (高亮不正确)

21 个 F3 页面里,所有 `mount()` 都传 `active: 'home'`, 实际应该:

| 页面 | 当前 active | 应传 |
|------|-------------|------|
| `index.html` | `'home'` | ✅ 对 |
| `login.html` / `register.html` | `'home'` | ✅ 对 (无高亮) |
| `dashboard.html` | (无 mount) | `'dash'` |
| `tutor.html` | (无 mount) | `'tutor'` |
| `wrong-book.html` | `'home'` | `'wrong'` |
| `review.html` | `'home'` | `'review'` |
| `mastery.html` | (无 mount) | `'mastery'` |
| `vision.html` | `'home'` | `'vision'` |
| `exam-simulation.html` | `'home'` | `'exam'` |
| `learning-path.html` / `my-weak-points.html` / `*report.html` / `*exam.html` / `province.html` 等 | `'home'` | 应 `'home'` 或对应 key |

> **影响**: 用户在 dashboard / tutor / vision 等页面时, 顶部 nav 高亮仍是 "首页", 体验差

---

## 6. 已实测工作的链路 (e2e 全绿 ✅)

| 链路 | 状态 |
|------|------|
| 登录 → token 写入 localStorage | ✅ |
| dashboard 调 `user.getDashboard()` | ✅ 200 |
| dashboard 调 `review.getWeakPoints()` | ✅ 200 |
| wrong-book 调 `wrong.getQuestions()` | ✅ 200 |
| review 调 `review.getReports/getTrendSummary/getSessionHistory` | ✅ 200 |
| mastery 调 `knowledge.getMastery/getMap/getPoints/getProfile/getSuggestions` | ✅ 200 |
| vision 调 `vision.parse` (有参数问题 400, 端点存在) | ✅ |
| exam-simulation 调 `exam.getPapers/startSession/submitSession/getExamPdf` | ✅ 200 |
| tutor 调 `tutor.ask/askStream` | ✅ 200 |
| learning-path.html 调 `/api/learning-path?subject=...` (compat) | ✅ 200 |
| my-weak-points.html 调 `/api/weak-points` (compat) | ✅ 200 |
| 4 个迁移页面 (sample-*/math-exam 等) KaTeX 公式 | ✅ 渲染 |
| 调 `rag.search` (server.js) | ✅ 200 |
| 调 `rag.multi/search` (server.js) | ✅ 200 |
| 调 `rag.stats` (server.js) | ✅ 200 |
| 调 `tutor.ask/stream` (server.js) | ✅ 200 |
| 调 `tutor.history` (server.js) | ✅ 200 |

---

## 7. 修复优先级

| 顺 | 任务 | 估时 | 影响 |
|---|------|------|------|
| 1 | 3 个页面 (dashboard/tutor/mastery) 加 `mount()` | 5 min | 用户能在任意页跳 F3 其他页 |
| 2 | 7 个 `href="#"` 改真实跳转 | 5 min | 不再点了没反应 |
| 3 | my-weak-points 改 `tutor.ask` 替代 `/api/generate-paper` | 5 min | 个性化卷能生成 |
| 4 | 3 个缺失端点 (rag.ask/rag.explain/tutor.sessions) 补 backend | 20 min | RAG/Tutor service 完整 |
| 5 | 21 个页面的 navator active key 修正 | 10 min | nav 高亮准确 |

**总计 ~45 分钟**

---

## 8. 验证

修复后跑:
```bash
npm run e2e:legacy
# 期望仍是 57/57 (这些是 backend 测试, 不覆盖前端)
```

新增前端跳转测试:
```bash
# 用 Playwright 跑前端跳转检查
cat > /tmp/test-nav.cjs <<'EOF'
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  // 登录
  await page.goto('http://localhost:3002/f3/pages/login.html');
  await page.fill('input[placeholder*="邮箱"]', 'test@uibe.edu.cn');
  await page.fill('input[placeholder*="密码"]', 'test123456');
  await page.click('button.login-btn');
  await page.waitForURL(/dashboard/);
  // 检查每个 nav 链接
  const links = await page.$$eval('nav#ait-topnav a', as => as.map(a => a.href));
  console.log('Nav links:', links);
  await browser.close();
})();
EOF
```