# D092 — TD-006 handler 拆分 (试卷级 vs 题目级)

**Date:** 2026-09-14
**Type:** Bug fix
**Status:** 🟡 待用户重启后端验证
**前置:** D091 (TD-006 v2 整合) - commit b929635 用户验收发现两处缺陷

---

## 1. 缺陷描述

### 缺陷 1：列表路径隐患
- `api/handlers/exam-questions.js` 的 `getExamQuestions(req, res)` 强制要求 `req.params.paperId`
- 调用路径 `/api/exam/questions/:paperId` 是**试卷级**题目列表
- 实际前端调 `/api/exam/questions`（无参）是**全库级**列表，路由到 `modules/exam/routes.js` 内联 SQL（不走 handler）
- 但**老代码结构混乱**：handler 的强制 paperId 校验容易让新代码误用

### 缺陷 2：详情 404
- 前端 `question-bank.html` 详情弹窗调 `/api/exam/questions/:id`
- **`:id` 是 `exam_questions.id` 而非 `exam_papers.id`**
- 路由匹配 `/questions/:paperId` → 调 handler → handler 查 `exam_papers WHERE id = :paperId` → **0 行 → 404 "试卷不存在"**
- 错误信息让用户误以为是数据问题，实际是 ID 类型错配

---

## 2. 修复

### 拆分 handler 命名清晰化

| 函数 | 路由 | 用途 |
|---|---|---|
| `getExamQuestions` | `GET /api/exam/questions/:paperId` | **试卷级**列表（按 paperId 查某卷下所有题） |
| `getQuestionById` | `GET /api/exam/questions/detail/:qid` | **题目级**单题详情（按 questionId 查单题） |

### 修复代码

**`api/handlers/exam-questions.js`**：
- 保留 `getExamQuestions`（按 paperId，行为不变）
- 新增 `getQuestionById`（按 qid，校验 `isNaN(parseInt(qid))` 防止注入）
- 两函数职责清晰：handler 内不再有 404 误用风险

**`api/modules/exam/routes.js`**：
- 保留 `router.get('/questions/:paperId', getExamQuestions)`
- 新增 `router.get('/questions/detail/:qid', getQuestionById)`
- 列表路由 `/questions`（无参）继续走内联 SQL，逻辑不变

**`ai-tutor-frontend/pages/question-bank.html`**：
- 详情弹窗 fetch URL：`/api/exam/questions/${qid}` → **`/api/exam/questions/detail/${qid}`**

---

## 3. 验证

### 后端验证 (DB 端)
```
题目 id=123: 不存在 (说明 ID 是 exam_questions.id 范围, 需要查实际 id)
题目 123 的 v2 KP: (空) - 123 不存在
```

### 前端验证
- 列表接口 `/api/exam/questions?subject=math&limit=2` 走 modules/exam/routes.js 内联 SQL
- 列表数据可见（截图确认 "20/564"）
- **详情弹窗待后端 systemd 重启后才显示染色 v2 KP chip**

### 测试
- `npm test`: 245/251 PASS（与 baseline 一致，无回归）

---

## 4. 已知限制 / 后续

| 项 | 状态 |
|---|---|
| 后端 systemd 重启 | 🟡 **需用户执行 `sudo systemctl restart aitutor`** 才能让新端点生效 |
| 类似题推荐 (`/questions/similar`) | 同上 |
| 路径混淆 (列表/详情) | ✅ 已修复 |

---

## 5. 影响

- **TD-006 验收** → 需用户重启后端后重新截图验收
- **前两轮的类似隐患** → `/api/exam/papers/:id` (getExamPaperById) 已正确用 paperId，无此问题
- **D091 总结**：教训 — 加新端点时必须明确 ID 类型语义，路由命名要消除歧义
