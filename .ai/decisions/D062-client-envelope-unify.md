# D062 — client.js 解包统一 (envelope-only)

> **日期**: 2026-08-15
> **阶段**: Phase 2 契约治理
> **影响范围**: client.js, 9 个 service, 10 个页面, 38 个 mock

## 问题

`client.js` 历史上:
- mock 路径返回**整个 mock 文件** (`{success, data, ...}`)
- real 路径 (`realFetch`) **解包 envelope** → 返回内层 `data`

结果:
- F3 页面消费 `res.data.X` (envelope style) 在 mock 下 OK, real 下挂
- 个别页面 (`wrong-book`) 反过来消费 `res.X` (unwrapped) 在 real 下 OK, mock 下挂
- review.html 未提交改动用 `data.items` 想"兼容两边", 但实际哪边都不对

## 决策

**realFetch 不再解包**, 双路径同构都返回**完整 envelope**.

理由:
1. 与 F3 文档化约定对齐 (`operations/spec.md §5`: "Service Envelope: services return `{success, data}`; page does `res.data.X`")
2. 与 wrong.js comment 对齐 ("不拆信封, page 层做 res.data / res.pagination")
3. 减少代码量 (删除 tryOnce 里的 unwrap 块)
4. mock-contract test 自然有意义 (mock shape == backend shape)

## 备选方案 & 否选理由

| 方案 | 否选理由 |
|------|----------|
| mock 也解包 → 服务端永远返回 unwrapped | 违反 F3 文档化约定; auth/guest 返回 `{success, token, user}` (无 data 键) 解包会丢字段 |
| 加 "isMock" 判断做两套 | 复杂度上升, 测试覆盖率下降 |
| 在 service 层归一化 (loadMock/realFetch 都返回 unwrapped) | contract.test.js 38 项断言 `r.data.X` 全要改成 `r.X`, ripple 太大 |
| **✅ 两路径都返回 envelope** | 选定 |

## 后果

### 改坏的页面 (已修)

- `wrong-book.html`: `data.questions` → 加 `normalizeListData()` helper (后端 `data:{questions,total}` 无 pagination 对象, 客户端算分页)
- `dashboard.html`: setUseMock(true) → (false), 加 `esc()`, `w.topic` → `w.kp_name || w.topic`, weak list 字段兼容
- `tutor.html`: setUseMock(true) → (false), `tutor.getHistory()` 改读 localStorage (D56 决策)
- `review.html`: 回退未提交的 `data.items` 改动

### 加的服务

- `user.js` `getDashboard()`: 后端 `overview` → 页面 `stats` 字段适配
- `tutor.js` `getHistory()`: localStorage adapter

### 补齐的后端端点

- `api/modules/user/routes.js` 加 `/dashboard` 路由 (原 404)
- `api/modules/vision/routes.js` 挂载点 `/parse` → `/` (原 `/api/vision/parse/parse` 双重前缀 bug)

### Mock 对齐

- `wrong_questions.json`: `data:[...]` → `data:{questions:[...],total}`
- `mock-contract.test.js`: 断言更新

## 验证

```bash
node tests/contract.test.js          # 38 passed (mock 模式 envelope)
BCT_URL=http://localhost:3002 node tests/backend-contract.test.js  # 19 passed (real 模式 envelope)
npm test                              # 241 passed
```

## 变更文件 (主)

| 文件 | 改动 |
|------|------|
| `ai-tutor-frontend/assets/js/api/client.js` | 移除 tryOnce unwrap (4 行) |
| `ai-tutor-frontend/assets/js/api/services/user.js` | dashboard adapter |
| `ai-tutor-frontend/assets/js/api/services/tutor.js` | history localStorage adapter |
| `ai-tutor-frontend/pages/{dashboard,review,tutor,wrong-book,vision}.html` | normalize 消费 |
| `ai-tutor-frontend/assets/js/api/mock/wrong_questions.json` | 对齐后端 |
| `api/modules/user/routes.js` | 加 /dashboard |
| `api/modules/vision/routes.js` | mount / → (was /parse) |
| `tests/mock-contract.test.js` | 断言更新 |