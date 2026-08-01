# aitutor 前端迁移 PLAN v0.2 — 6 阶段 User Journey

> **版本**: v0.2 (整合 8 月 1 日用户反馈)
> **配套**: [SPEC.md](./SPEC.md)
> **关键变更**: 6 阶段 (Foundation → Service Layer → Feature Migration → Vision Epic → Testing → Cutover) + Service Layer + Mock + Contract Test + DoD

---

## 0. 用户拍板 (v0.2)

| # | 项 | 拍板 |
|---|----|------|
| 1 | 配色: CSS tokens + Tailwind theme 注入 | ✅ 默认 |
| 2 | ai-tutor-redesign 归档 | ✅ 默认 |
| 3 | frontend/ 冻结 (Freeze, 不归档) | ✅ 默认 |
| 4 | Vision 拆独立 Epic (F4) | ✅ 默认 |
| 5 | 启动时间 | ⏳ 待 |
| 6 | 1 人顺序 / 2 人并联 | ⏳ 待 |

---

## 1. 阶段 F1: Foundation (Day 1-3, 2.5 天)

> 目标: 基础设施 + Design Token + Tailwind theme 注入. 0 page 工作.

### 1.1 任务

- [ ] **F1.1**: 写 `assets/css/tokens.css` (从 `frontend/assets/css/tokens.css` 复制 1,152 行)
- [ ] **F1.2**: 写 `assets/css/tailwind-theme.css` (Tailwind 4 `@theme` 注入, 引用 tokens)
- [ ] **F1.3**: 写 `assets/css/aitutor.css` (基础 layout + utility, 引用 tokens)
- [ ] **F1.4**: 写 `assets/js/api/client.js` (fetch wrapper + token + 401 重定向)
- [ ] **F1.5**: 写 `assets/js/api/services/auth.js` (login/register/guestLogin)
- [ ] **F1.6**: 写 `assets/js/api/services/user.js` (dashboard/provinces/userProvince)
- [ ] **F1.7**: 写 `assets/js/api/services/exam.js` (questions, session start/submit, exam-pdf)
- [ ] **F1.8**: 写 `assets/js/api/services/rag.js` (RAG search + multi + similarQuestions)
- [ ] **F1.9**: 写 `assets/js/api/services/knowledge.js` (mastery, kp-detail)
- [ ] **F1.10**: 写 `assets/js/api/services/review.js` (reports, session-history)
- [ ] **F1.11**: 写 `assets/js/api/services/vision.js` (parse, ingest)
- [ ] **F1.12**: 写 `assets/js/api/mock/` 10 个 JSON (用后端真实响应 1 次, 存为 mock)
- [ ] **F1.13**: 写 `assets/js/api/USE_MOCK.js` (从 `?mock=true` URL 参数 / `localStorage` 读)
- [ ] **F1.14**: 写 `assets/js/auth.js` (token 存 localStorage + 401 跳 login)
- [ ] **F1.15**: 写 `assets/js/toast.js` (全局 toast)
- [ ] **F1.16**: 写 `assets/js/router.js` (SPA 路由, navbar/bottom-nav 统一)
- [ ] **F1.17**: 写 `tests/api-contract/` (10 page 调 API 字段校验)

**总代码量**: ~2,000 行 + 10 mock JSON.

### 1.2 验收 (DoD)

- [ ] 10 service 跑通 mock 模式 (`USE_MOCK=true`)
- [ ] `USE_MOCK=false` 真实后端工作 (1 个 service 验证)
- [ ] tokens.css 引用 + Tailwind theme 注入工作
- [ ] 暗色主题 `.dark` 全局生效
- [ ] Contract Test 跑通 (1 个 API 字段校验 demo)

---

## 2. 阶段 F2: Service Layer 强化 (Day 4-5, 2.5 天)

> 目标: Service Layer 完整 + Contract Test 覆盖 + Playwright 框架.

### 2.1 任务

- [ ] **F2.1**: 7 个 service 完整实现 (错误处理 + 重试 + timeout)
- [ ] **F2.2**: Mock 数据完整覆盖 (10 page 调的所有 API)
- [ ] **F2.3**: Contract Test 覆盖 20 个 API 端点 (§5 表格)
  - 每个 API: 请求 schema + 响应 schema 校验
  - 防后端字段变更 (改字段 → 测试 fail → 前端报警)
- [ ] **F2.4**: Playwright config 完整 (`playwright.config.cjs`)
- [ ] **F2.5**: Playwright 1 个 happy path E2E (login → dashboard)
- [ ] **F2.6**: USE_MOCK 切换测试 (true 离线 / false 真实)
- [ ] **F2.7**: 错误处理 toast 测试 (401 / 5xx / 网络断开)

### 2.2 验收

- [ ] Contract Test 20 个端点全 pass
- [ ] Playwright 1 个 E2E pass
- [ ] USE_MOCK 切换工作

---

## 3. 阶段 F3: Feature Migration (Day 6-12, 6 天) ⭐核心

> 目标: 按 **User Journey** 顺序迁移, 不是按 HTML 排. 每 page 满足 DoD.

### 3.1 User Journey 顺序 (严格单向)

```
[Day 6]   F3.1  Auth
            ├── login.html
            └── register.html

[Day 7]   F3.2  Dashboard
            ├── dashboard.html
            └── (内嵌 province picker)

[Day 8]   F3.3  Question
            └── (在 dashboard 内, 调 exam.questions)

[Day 9]   F3.4  Tutor
            ├── tutor.html
            └── (question → tutor 流)

[Day 10]  F3.5  WrongBook
            ├── wrong-book.html
            └── (tutor → wrongbook 闭环)

[Day 11]  F3.6  Review + Mastery
            ├── review.html
            └── mastery.html

[Day 12]  F3.7  Exam Simulation + 整合
            ├── exam-simulation.html
            └── 10 page 联调
```

### 3.2 每个 page 任务清单 (DoD 强约束)

```
DoD 必填 9 项:
[ ] 1. code 写完
[ ] 2. lint 0 error
[ ] 3. console 0 error
[ ] 4. mobile 320px 可看
[ ] 5. Playwright happy path 1 个 pass
[ ] 6. API Contract Test 字段对齐 pass
[ ] 7. loading/error/empty 3 态
[ ] 8. USE_MOCK=true 能跑通
[ ] 9. docs 更新
```

### 3.3 F3.1 Auth (Day 6)

- [ ] **F3.1.1**: `login.html` 调 `auth.login` + `auth.guestLogin`
- [ ] **F3.1.2**: `register.html` 调 `auth.register`
- [ ] **F3.1.3**: 拿 token 存 localStorage, 跳 dashboard
- [ ] **F3.1.4**: 401 自动跳回 login
- [ ] **F3.1.5**: Playwright E2E (login → dashboard)
- [ ] **F3.1.6**: 7 个 service 在登录页隐藏 (401 触发前不暴露)

### 3.4 F3.2 Dashboard (Day 7)

- [ ] **F3.2.1**: `dashboard.html` 调 `user.dashboard` + `user.provinces` + `user.userProvince`
- [ ] **F3.2.2**: 显示用户数据 (姓名/邮箱/省份/学科)
- [ ] **F3.2.3**: 省份选择器 (调 `user.userProvince` POST)
- [ ] **F3.2.4**: 学科卡片 (调后续 service)
- [ ] **F3.2.5**: 9 个 User Journey 入口卡片 (Auth 后才能进)

### 3.5 F3.3 Question (Day 8)

- [ ] **F3.3.1**: `dashboard.html` 内嵌 Question 列表 (调 `exam.questions`)
- [ ] **F3.3.2**: 学科/年份/卷类 过滤
- [ ] **F3.3.3**: 题目详情 (stem + options + answer + analysis)
- [ ] **F3.3.4**: "问 Tutor" 按钮 → 跳 tutor.html
- [ ] **F3.3.5**: "加入错题本" 按钮

### 3.6 F3.4 Tutor (Day 9)

- [ ] **F3.4.1**: `tutor.html` 调 `rag.explain` + `rag.ask`
- [ ] **F3.4.2**: 流式显示 (Server-Sent Events)
- [ ] **F3.4.3**: 追问 (历史 session 上下文)
- [ ] **F3.4.4**: "加入错题本" 自动跳 wrong-book
- [ ] **F3.4.5**: Markdown 渲染 (latex + code)

### 3.7 F3.5 WrongBook (Day 10)

- [ ] **F3.5.1**: `wrong-book.html` 调 `exam.questions` (错题列表)
- [ ] **F3.5.2**: "相似题推荐" 调 `rag.similarQuestions`
- [ ] **F3.5.3**: 点击错题 → 跳 tutor (闭环)
- [ ] **F3.5.4**: 错题分类 (按学科/知识点)
- [ ] **F3.5.5**: 标记掌握 (调 `knowledge`)

### 3.8 F3.6 Review + Mastery (Day 11)

- [ ] **F3.6.1**: `review.html` 调 `review.reports` + `review.sessionHistory`
- [ ] **F3.6.2**: 报告列表 + 详情 (分数/正确率/薄弱点)
- [ ] **F3.6.3**: `mastery.html` 调 `knowledge.mastery`
- [ ] **F3.6.4**: 知识图谱 (radar / bar chart)
- [ ] **F3.6.5**: 点击知识点 → 详情 (调 `knowledge.kpDetail`)

### 3.9 F3.7 Exam Simulation (Day 12)

- [ ] **F3.7.1**: `exam-simulation.html` 调 `exam.startSession` / `exam.submitSession` / `exam.examPdf`
- [ ] **F3.7.2**: 考试流程 (启动 → 答题 → 计时 → 交卷)
- [ ] **F3.7.3**: 答错自动入错题本
- [ ] **F3.7.4**: 考试结果 PDF 下载
- [ ] **F3.7.5**: 10 page 联调 (E2E: Auth → Dashboard → Question → Tutor → WrongBook → Review → Exam)

---

## 4. 阶段 F4: Vision Epic (Day 8-10, 2.5 天, **独立并联**)

> 关键: 跟 F3 并联, 不阻塞主线.

### 4.1 任务

- [ ] **F4.1**: `vision.html` 调 `vision.parse` + `vision.ingest`
- [ ] **F4.2**: 图片上传 (drag-drop + click)
- [ ] **F4.3**: OCR 结果显示 (LaTeX + 公式)
- [ ] **F4.4**: 解析后入库 (调 `vision.ingest`)
- [ ] **F4.5**: Vision 流程 E2E (上传 → OCR → 入库 → 跳 Question)
- [ ] **F4.6**: 错误处理 (图片太大/格式不对/OCR 失败)

### 4.2 验收

- [ ] Vision E2E pass
- [ ] 跟 F3 集成 (Vision 流程结尾跳 Question page)

---

## 5. 阶段 F5: Testing (Day 13-14, 2 天)

### 5.1 任务

- [ ] **F5.1**: Playwright 10 page 截图测试 (desktop + mobile)
- [ ] **F5.2**: Playwright 关键 E2E (Auth → Question → Tutor → WrongBook → Review)
- [ ] **F5.3**: API Contract Test 20+ 端点全 pass
- [ ] **F5.4**: Lighthouse Performance > 85, Accessibility > 90
- [ ] **F5.5**: Visual Regression (Playwright 截图对比)
- [ ] **F5.6**: Mock 数据一致性 (USE_MOCK=true 时, 跟真实响应字段一致)
- [ ] **F5.7**: 跨浏览器 (Chrome / Firefox / Safari / Mobile Safari)

### 5.2 验收

- [ ] Playwright 10 page 全 pass
- [ ] Contract Test 全 pass
- [ ] Lighthouse > 85
- [ ] 0 lint error
- [ ] 0 console error

---

## 6. 阶段 F6: Cutover (Day 15, 1 天)

> 关键变更: 不立即归档, 而是 **Freeze** (冻结), 2-3 周观察后再归档.

### 6.1 任务

- [ ] **F6.1**: 改 `server.js` 静态根
  ```js
  // 新 (2 套: 主 + legacy)
  app.use(express.static('ai-tutor-frontend'));  // 主
  app.use('/legacy', express.static('frontend'));   // 冻结
  ```
- [ ] **F6.2**: 归档 `ai-tutor-redesign` + `frontend/redesign` + `aitutor-demo`:
  ```bash
  mkdir -p _archive/frontend-old
  mv ai-tutor-redesign _archive/frontend-old/
  mv frontend/redesign _archive/frontend-old/  # 因为 frontend/ 整体冻结
  mv aitutor-demo _archive/frontend-old/
  ```
- [ ] **F6.3**: 改 `package.json` scripts (删 frontend 相关, 保留新)
- [ ] **F6.4**: 更新 README (启动方式, 新路径)
- [ ] **F6.5**: git commit + tag (v2.0.0)
- [ ] **F6.6**: `frontend/` 加 `DEPRECATED.md` (说明冻结, 2-3 周后归档)
- [ ] **F6.7**: 删 `server.js` 的 `/redesign` 配

### 6.2 验收

- [ ] `node server.js` 启动, `http://localhost:3002/` 显示 ai-tutor-frontend/pages/index.html
- [ ] `http://localhost:3002/legacy/index.html` 仍可访问老 frontend
- [ ] ai-tutor-redesign 归档
- [ ] git 干净

### 6.3 Freeze 监控 (2-3 周后)

- [ ] 监控 `/legacy/*` 访问日志 (nginx/access.log)
- [ ] 连续 2-3 周无访问 → 归档 frontend/ 到 `_archive/`
- [ ] 归档前 1 周发通知 (PR / 邮件)
- [ ] 归档后 `server.js` 删 `/legacy` 配

---

## 7. 时间线 (6 阶段, 2 人并联)

```
人 A (主迁移):                人 B (Vision + Service Layer):
─────────────────────        ─────────────────────
Day 1  ████ F1.1-1.10         ████ F1.1-1.10 (并)
Day 2  ████ F1.11-1.17        ████ F1.11-1.17
Day 3  ████ F2.1-2.3          ████ F2.4-2.7
Day 4  ████ F2.1-2.3          ████ F4.1-4.3
Day 5  ████ F3.1 Auth         ████ F4.4-4.6
Day 6  ████ F3.1 Auth         ████ F4 (完成)
Day 7  ████ F3.2 Dashboard
Day 8  ████ F3.3 Question
Day 9  ████ F3.4 Tutor
Day 10 ████ F3.5 WrongBook
Day 11 ████ F3.6 Review+Mastery
Day 12 ████ F3.7 Exam
Day 13 ████ F5 Testing
Day 14 ████ F5 Testing
Day 15 ████ F6 Cutover
```

**1 人顺序**: 16.5 天
**2 人并联**: **10 天**

---

## 8. 风险 + 缓解 (v0.2 强化)

| 风险 | 概率 | 影响 | 缓解 |
|------|------|------|------|
| R8.1 后端 API 缺 | 中 | 高 | §5 Compatibility Matrix + F1.12 mock + 后端先补 |
| R8.2 Contract 字段变更 | 中 | 高 | F2.3 Contract Test 覆盖 20 端点 |
| R8.3 Tailwind theme 注入失败 | 中 | 中 | F1.1-F1.3 PoC 验证 |
| R8.4 User Journey 顺序有循环依赖 | 中 | 中 | 严格单向: Auth → Dashboard → Question → Tutor → WrongBook → Review |
| R8.5 Vision 拖累主线 | 中 | 中 | **F4 独立**, 人 B 并联, 2.5 天 |
| R8.6 frontend/ 31 page 隐藏功能 | 中 | 中 | F5.5 Visual Regression + 用户测试 |
| R8.7 Mock 数据跟真实不一致 | 中 | 中 | F1.12 真实响应 → mock |
| R8.8 冻结 frontend/ 后用户找不到 | 低 | 中 | `/legacy` 保留 + 通知 |
| R8.9 DoD 不执行, 出现"半成品" | 中 | 中 | F1 阶段 1 起, 每个 Task 必填 9 项 DoD |
| R8.10 现有 `frontend/` 30+ 老用户路径断 | 低 | 高 | 2-3 周观察期, 1 周前通知 |

---

## 9. 验收总表 (v0.2 强化)

| 阶段 | 验收 | 测试命令 |
|------|------|----------|
| F1 | 10 service + mock + token 工作 | `npm test` |
| F2 | Contract Test 20 端点 + Playwright 1 E2E | `npx playwright test` |
| F3 | 10 page 接 API + 满足 DoD | `npx playwright test` + 手测 |
| F4 | Vision 流程 + 不阻塞 F3 | `npx playwright test vision.spec.js` |
| F5 | 10 page 截图 + Lighthouse > 85 | `npx lhci autorun` |
| F6 | 部署 + /legacy 工作 + 归档 | `node server.js` + `curl localhost:3002/legacy/` |

---

## 10. 依赖

```
F1 (基础 + Service Layer)        F4 (Vision) [并联]
  ↓
F2 (Service 强化 + Contract)     F4 [继续]
  ↓
F3 (User Journey 迁移)            F4 [完成]
  ↓                                ↓
F5 (Testing) ←────────────────────┘
  ↓
F6 (Cutover + Freeze)
```

**关键路径**: F1 → F2 → F3 → F5 → F6 = 13 天 (1 人)
**Vision 旁路**: F4 = 2.5 天 (人 B 并联, 节省 2.5 天)
**总**: 1 人 16.5 天, 2 人 10 天

---

## 11. 用户拍板后变更记录

- [ ] 用户拍板 §0 的 5 项 (TBD)
- [ ] 启动时间: TBD
- [ ] 1 人 / 2 人
- [ ] 冻结 frontend/ 的观察期: 2 周 / 3 周
- [ ] Mock 数据生成策略: 录真实响应 / 手写 mock / 从日志生成

---

## 12. 配套文档

- [SPEC.md](./SPEC.md) — v0.2 spec (8.8/10 → 9.6/10)
- [TODO.md](./TODO.md) — 详细 DoD checklist
- [API_COMPAT.md](./API_COMPAT.md) — §5 完整版 (后端实现状态)
- [MOCK_PLAN.md](./MOCK_PLAN.md) — Mock 数据生成策略
- [CONTRACT_TEST.md](./CONTRACT_TEST.md) — Contract Test 规范
- [DEPRECATED.md](./DEPRECATED.md) — frontend/ 冻结通知
