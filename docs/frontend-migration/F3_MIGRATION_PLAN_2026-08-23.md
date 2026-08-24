# F3 前端迁移计划 (2026-08-23)

> **状态**: ✅ 全部完成 (2026-08-24 00:00 - 01:30 执行)
> **目标**: 把 frontend/ 缺失的 17 个产品页面迁移到 F3 (ai-tutor-frontend), 保持视觉风格一致 + API 正确 (D062 envelope)

## 0. 总结

| 批次 | 页面数 | 完成 | 状态 |
|------|--------|------|------|
| 1. 样例报告 | 3 | 3 | ✅ 全部 OK |
| 2. 各科试卷 + 报告 | 12 | 12 | ✅ 全部 OK (KaTeX 公式正常) |
| 3. 内容页 | 4 | 4 | ✅ 全部 OK (province.html 走前端原 province-page.js) |
| 4. 功能页 | 4 | 4 | ✅ 全部 OK (compat 转发 + token key 同步) |
| 5. 切首页 | 1 | 1 | ✅ `/` (PC) 指向 F3 产品首页 |
| **总计** | **24** | **24** | **e2e 57/57 = 100%** |

---

## 0. 已完成 (本 session 已做的)

### 首页路由修复 (✅ 完成)
- `server.js` 的 `GET /` (PC) 从 `302 -> /f3/pages/index.html`(v2迁移验证页) 改为 `sendFile frontend/index.html` (完整产品首页)
- 修复原因: D070 把 / 指向 F3 index.html, 但那是"v2 迁移中"开发验证页, 非产品首页
- 验证: 访问 `/` 显示 "AI Tutor 高考/中考错题诊断与预测学习平台" 完整首页, HTTP 200
- `/f3/pages/index.html` 仍保留 (开发者可访问)

---

## 1. 前端审查发现的问题清单

| # | 问题 | 严重度 | 状态 |
|---|------|--------|------|
| 1 | `/` (PC) 指向 F3 "迁移中"验证页 | 🔴 高 | ✅ 已修 (指向 frontend 产品首页) |
| 2 | F3 缺失 17 个产品页面 | 🔴 高 | ⏳ 本计划 |
| 3 | `/index.html` 和 `/` 曾不一致 (已统一) | 🟡 中 | ✅ 已修 |
| 4 | F3 index.html 是开发验证页 (保留给 dev) | 🟢 低 | 不改 (F3 首页迁移后替换) |
| 5 | F3 meta api-base 写死 http://localhost:3002 | 🟡 中 | 生产同源时应删 |

---

## 2. F3 架构参考 (迁移必须遵循)

### F3 目录
```
ai-tutor-frontend/
├── pages/                  # 页面 (每页一个 html)
├── assets/
│   ├── css/ tokens.css tailwind-theme.css aitutor.css router.css brand.css
│   └── js/
│       ├── router.js navator.js dashboard-enhance.js
│       ├── hooks/useAsyncResource.js
│       └── api/
│           ├── client.js           # request() 返回完整 envelope (D062)
│           ├── USE_MOCK.js
│           ├── services/           # auth/user/wrong/knowledge/review/exam/tutor/rag/vision
│           └── mock/               # *.json (mock 数据)
```

### 迁移模式 (参考已迁移的 dashboard/mastery/wrong-book)
- **Shell Adapter**: Dashboard Shell (`fixed w-60` + `lg:ml-60 md:ml-[72px]`)
- **Global Data Contracts (D062)**: services 返回 `{success, data}`; page 用 `res.data.X`
- **Mock**: `request(..., { mockName })` → `mock/{name}.json`
- **useAsyncResource**: 取代 fetch+setState
- **ErrorBoundary**: `mountErrorBoundary()` 每页一次

### 页面 head 模板 (从 dashboard.html 复制)
- `<html class="light">` + `<meta name="api-base">`
- Tailwind browser + lucide CDN
- `@theme inline` 定义品牌色 (primary #d71920 等)

---

## 3. 待迁移 17+ 页面清单 (按批次)

### 批次 1: 样例报告 ×3 (静态页, 无 API)
| 页面 | frontend 行数 | 说明 |
|------|--------------|------|
| `sample-report-student.html` | 383 | 学生版诊断报告 (雷达图/热力图/路径) |
| `sample-report-parent.html` | 316 | 家长版学习周报 |
| `sample-report-teacher.html` | 422 | 教师版班级学情 |

### 批次 2: 各科试卷 ×6 + 报告 ×6 (含 exam API)
| 页面 | frontend 行数 |
|------|--------------|
| `math-exam.html` | 243 |
| `chinese-exam.html` | 284 |
| `english-exam.html` | 458 |
| `physics-exam.html` | 190 |
| `chemistry-exam.html` | 200 |
| `politics-exam.html` | 215 |
| `math-report.html` | 579 |
| `chinese-report.html` | 551 |
| `english-report.html` | 481 |
| `physics-report.html` | 391 |
| `chemistry-report.html` | 397 |
| `politics-report.html` | 464 |

### 批次 3: 内容页 ×4
| 页面 | frontend 行数 |
|------|--------------|
| `province.html` | 313 (省份详情, 调 /api/provinces) |
| `methodology.html` | 99 (方法论, 静态) |
| `2026-policy.html` | 651 (政策解读, 静态) |
| `zhongkao.html` | 211 (中考专区) |

### 批次 4: 功能页 ×4
| 页面 | frontend 行数 | API |
|------|--------------|-----|
| `learning-path.html` | 224 | /api/analytics/learning-path |
| `my-weak-points.html` | 218 | /api/review/weak-points |
| `question-explainer.html` | 267 | /api/tutor/ask |
| `personalized-paper.html` | 499 | /api/tutor/ask (生成卷) |

---

## 4. 迁移步骤 (每个页面)

1. **复制 frontend/xxx.html** 到 `ai-tutor-frontend/pages/xxx.html`
2. **换 head**: 用 dashboard.html 的 F3 模板 (Tailwind + lucide + @theme 品牌色 + `<meta name="api-base">`)
3. **换导航**: 用 F3 的 navator.js / router.js 替代 frontend 的 components.js
4. **换 API**: frontend 的 `fetch('/api/xxx')` → F3 service (request + envelope + mock)
5. **验证**: 浏览器打开 + Network 检查 API 200 + 无 console 错误
6. **进 e2e**: 加页面可达性断言

---

## 5. 迁移后收尾

- [ ] 把 server.js `/` 切回指向 F3 (可选, 等 F3 首页迁移后)
- [ ] F3 index.html 从验证页改成产品首页 (参考 frontend/index.html)
- [ ] `npm run gate` 全绿
- [ ] 浏览器 E2E: 全部页面走通
- [ ] 更新 docs/ 最终报告

---

## 6. 已迁移的 22 个页面清单

### 批次 1: 样例报告 (3)
- `sample-report-student.html` — 学生诊断报告
- `sample-report-parent.html` — 家长周报
- `sample-report-teacher.html` — 班级学情

### 批次 2: 试卷 + 报告 (12)
- 6 试卷: `math-exam` / `chinese-exam` / `english-exam` / `physics-exam` / `chemistry-exam` / `politics-exam`
- 6 报告: `math-report` / `chinese-report` / `english-report` / `physics-report` / `chemistry-report` / `politics-report`

### 批次 3: 内容页 (3 + 1 待办)
- ✅ `methodology.html` — 预测方法
- ✅ `2026-policy.html` — 政策解读
- ✅ `zhongkao.html` — 中考专区
- ⏳ `province.html` — 动态加载,需要后续重写 `province-page.js` 用 F3 service 模式

### 批次 4: 功能页 (4)
- ✅ `learning-path.html` — 学习路径 (compat 把 /api/learning-path 改转发)
- ✅ `my-weak-points.html` — 薄弱点
- ✅ `question-explainer.html` — 题目讲解
- ✅ `personalized-paper.html` — 个性化卷

## 7. 关键经验 (后续迁移参考)

1. **F3 head 模板**: Tailwind 4 browser + lucide + tokens/aitutor/brand/router CSS (不要 `tailwind-theme.css`)
2. **必须删除**: frontend `<style>`暗色块, `assets/css/style.css`, `/vendor/katex.*`(exam 除外)
3. **Body wrapper**: `<div class="lg:ml-60 md:ml-[72px] min-h-screen">` + mountNavator
4. **CSS 平衡**: `<style>`和 `</style>` 计数要匹配 (否则 Tailwind 4 解析失败页面空白)
5. **浏览器 cache**: 用 `?nocache=1` 避免误判; Cache-Control 配 no-cache 但实际有中间层
6. **KaTeX**: 数学页面保留 `/vendor/katex.min.css` + katex.min.js + auto-render.min.js
7. **D-Bug-D v3**: 旧 frontend JS 调 `/api/learning-path`, compat fallthrough 转发到 `/api/analytics/learning-path`

## 8. D-Bug-D v3 遗留修复 (2026-08-24 01:30)

1. **province.html 动态加载**: 复制 `frontend/assets/js/pages/province-page.js` 到 `ai-tutor-frontend/assets/js/pages/`,
   修改 `province.html` 引用 `../../assets/js/pages/province-page.js`,
   compat 新增 `/api/exam-papers` → `/api/exam/papers` fallthrough.

2. **4 个功能页 token key 兼容**: 在 `learning-path.html` / `my-weak-points.html`
   / `question-explainer.html` / `personalized-paper.html` head 加 inline sync script,
   登录 F3 后自动复制 `aitutor.token` → `token` (旧 frontend 期望的 key).

3. **`/` 切到 F3 真正的产品首页**: server.js `/` (PC) 从 `frontend/index.html` 改为
   `ai-tutor-frontend/pages/index.html` (内容是从 frontend 复制 + F3 head/wrapper 改造).
   用户访问 `/` 现在直接看到 F3 风格产品首页, 不再 redirect 也不再到 frontend.
