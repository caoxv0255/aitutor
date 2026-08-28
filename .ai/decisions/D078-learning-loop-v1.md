# D078 — AITutor Learning Loop v1（冻结未来 4 周唯一主线）

> **类型**: 战略冻结 (Strategic Freeze) — 范围 / 时长 / 禁令
> **触发**: 2026-Q4 用户使用闭环审议 (`docs/audit/2026-Q4-user-loop-review.md`)
> **生效范围**: 2026-Q4 至 2027-Q1（4 周）
> **状态**: ✅ 立即生效
> **作者**: DeepSeek-Harness (基于用户产品判断起草)

---

## 0. 决策摘要

**未来 4 周 aitutor 项目唯一主题**: **Learning Loop v1**。

**核心目标**: 让一个真实学生连续使用 10 次之后，系统真的越来越了解他。

**核心追问 (取代"还能加什么 AI 能力")**:
> 一个真实学生今天打开 aitutor 后，我能不能让他在 30 秒内知道为什么现在应该做这件事；做完之后，系统能不能因此更了解他，并自动告诉他下一件最值得做的事？

---

## 1. 项目当前定级（基于 D078 起草前审议）

| 维度 | 等级 | 说明 |
|------|------|------|
| 知识 / 内容能力 | 9/10 | 426 知识点 + 19,713 题 + 57 papers |
| AI Tutor 推理 | 8/10 | 防跳跃 / 薄弱前置检测 / hybrid RAG |
| Hybrid RAG | 8/10 | pgvector + AGE + LLM 三层 |
| 知识图谱 | 7/10 | DEPENDS_ON 拓扑 + 涟漪效应 |
| SRS / 学习模型 | 7/10 | SM-2 算法 + 优先级排序 |
| **用户任务设计** | **3/10** | 首页是营销页，dashboard 是数据展示 |
| **学习反馈闭环** | **2/10** | `/api/tutor/loop/feedback` 后端存在但前端不调用 |
| **个性化驱动前端** | **3/10** | LLM 输出 learning_path 但前端丢弃 |
| **下一步行动** | **2/10** | 系统生成但消费链路断裂 |

**结论**: **技术能力已超过产品闭环能力**。
继续在 RAG / GraphRAG / Agent / 模型方向扩张，**不是**最优投资。

---

## 2. 冻结事项 (Hard Freeze)

未来 4 周，**禁止**在以下方向做任何新工作（除非有 P0 数据安全问题）：

### 2.1 能力扩张禁令

- ❌ 新增 GraphRAG 节点 / 算法 / 可视化
- ❌ 升级 Agent / 多 Agent / Multi-Agent
- ❌ 替换 LLM 模型 / Embedding 模型 / 数据库
- ❌ 重构后端架构
- ❌ 换前端框架 (React / Vue / Svelte)
- ❌ 新增知识图谱功能
- ❌ 新增 Dashboard 图表 / KPI / 指标
- ❌ 新增 Gamification 机制
- ❌ 新增 AI OS / Hermes / DSH 相关功能
- ❌ 新增 .ai/decisions/D-NNN-*.md（除 D079 / D080 与本冻结直接相关）

### 2.2 工程债允许清理 (不在禁令内)

如果某个 P0 学习闭环改造必须顺手清理某项工程债 (例如修改 service envelope、改 client.js)，**允许**——但必须遵守 D062 / D063 / D065。

### 2.3 数据质量允许清理

`wrong_questions=4` / `rag_questions=0` / `ai_trace=0` 这些空表问题**不阻塞**本主线，但 Sprint 1 的 verification 步骤会暴露这些问题，需要列出但不修复。

---

## 3. Learning Loop v1 Sprint 路线

| Sprint | 主题 | 关键产出 | 验证标准 |
|--------|------|---------|---------|
| **Sprint 0** | **基线 (已完成)** | D078 + D079 + SPEC.md + 5 个 P0 断点审计 (`docs/audit/2026-Q4-user-loop-review.md`) | 文档落地 + 断点列表 |
| **Sprint 1** | **Feedback + Today + Path (合并启动)** | `learning-loop.js` + 5 个页面接通 + Dashboard 今日任务 + `?kp=` 跳转 + `learning_path` 展示 | `student_knowledge_mastery` 真实写入 + srs_review_log 真实增长 + Dashboard 列表 day-over-day 变化 + `npm run gate` 5/5 |
| **Test 0** | **你自己扮演学生** | 完整跑一遍注册→首页→发现今日任务→开始→答题→反馈→mastery 更新→下一任务→退出→重入 | 你能在 30-60 秒内理解"现在应该干什么" |
| **Test 1** | **1 个真实学生** | 10 分钟观察录屏 | 学生主动完成至少 1 轮学习 OR 暴露明确 UX 断点 |
| **Sprint 2** | **Today Loop** | `GET /api/user/today` endpoint + Dashboard 顶部 "今日任务" block | 真人学生 < 30 秒能看到 "今天最值得做的事" + 一键开始 |
| **Sprint 3** | **Learning Path** | tutor.html 渲染后端 `learning_path` 为 state machine (不是文本) | 学生答错 → 系统给出下一步 → 完成 → 下一步 |
| **Sprint 4** | **真实学生验证 (5-10 人)** | 7 天留存测试 | D078 §5 五项指标达标 |

**核心原则 (2026-Q4 用户反馈修正)**:

> **确定性工程缺陷直接修**。P0-4 (feedback 写不进去) / P0-3 (`?kp=` 死链) / `learning_path` 丢弃 — 这些是 grep 能证明的 bug, 不需要真人验证。
>
> **不确定的用户体验用真人验证**。"今日任务这个文案学生会不会自然接受" — 这种问题代码给不出答案。

**Sprint 1 不需要等真人测试**。Test 0 / Test 1 是 Sprint 1 跑通**之后**的验证环节, 不是 Sprint 1 启动**之前**的前置条件。

---

## 4. Sprint 1 详细约束

### 4.1 范围

仅做"接通"——不改后端、不改后端 schema、不改 prompt、不改算法。

### 4.2 必须接通 (P0, 基于子代理架构扫描修正)

> **修正说明**: 2026-Q4 子代理扫描 5 个 F3 页面后, 发现原计划"4 个页面接通"中 3 个**当前架构不可行**:
> - tutor.html: SSE 流式 AI 教学, done 事件无 kp_id/is_correct (R3)
> - review.html: 只读 dashboard, 无答题回调 (R4)
> - vision.html: 后端已写 mastery, 接 Loop 会双重写入 (R6)
>
> 真实可行范围: **2 个页面 + 1 个前置 bug 修复**.

| 文件 | 接通目标 |
|------|---------|
| 新建 `ai-tutor-frontend/assets/js/api/services/learning-loop.js` | 包装 `POST /api/tutor/loop/feedback` / `POST /api/tutor/loop/batch` / `GET /api/tutor/loop/mastery` (3 个 endpoint, 不含 graph) |
| `ai-tutor-frontend/pages/exam-simulation.html` | **R2 前置修复**: line 280 字段名 `is_correct` → `isCorrect`, `question_id` → `questionId` (后端真返 camelCase). 然后整卷提交后批量 `submitBatch([...feedbacks])` |
| `ai-tutor-frontend/pages/wrong-book.html` | `.wb-card-mastered` 标记掌握回调 (line 767 后) → `submitFeedback({ is_correct: true })` 强信号 |
| **不接** tutor.html | R3: 无 KP id / is_correct 来源, 强行接入会假数据 |
| **不接** review.html | R4: 只读 dashboard, 无答题语义 |
| **不接** vision.html | R6: 后端 `api/services/visionSearchService.js` line 845-866 已写 mastery -10, 双重写入风险 |

详细接入契约见 `docs/learning-loop-v1/SPEC.md` §1 / §4.

### 4.3 必须验证 (验收)

Sprint 1 完成的标志**不是**"代码 merge 进 main"，而是以下 SQL 在真后端跑通：

```sql
-- 1. 反馈覆盖率 (目标: >95%)
SELECT 
  COUNT(*) FILTER (WHERE last_practice_at >= NOW() - INTERVAL '7 days') AS recent_practice,
  COUNT(*) AS total
FROM student_knowledge_mastery;

-- 2. SRS 调度真实发生 (目标: 列表 day-over-day 变化)
SELECT DATE_TRUNC('day', reviewed_at), COUNT(*) 
FROM srs_review_log 
GROUP BY 1 
ORDER BY 1 DESC LIMIT 7;

-- 3. Dashboard API 真实数据 (目标: 不是 mock)
SELECT * FROM srs_engine_daily_tasks_for_user('<test_user>') LIMIT 5;
```

### 4.4 测试必须

- ✅ vitest 单元测试: 至少 1 个测试 `learning-loop.js service` mock 后端响应
- ✅ contract 测试: 至少 1 个测试覆盖 `POST /api/tutor/loop/feedback` envelope (D062 兼容)
- ✅ BCT (Backend Contract Test): 真实后端跑通 `POST /api/tutor/loop/feedback` 一次写入
- ✅ gate 全绿 (D065): `npm run gate` 必须 5/5 通过

### 4.5 明确不允许

- ❌ 重写 `api/routes/learning-loop.js`
- ❌ 改 schema / 加表 / 加字段
- ❌ 改 `buildSystemPrompt` / LLM 调用
- ❌ 重构 `tutor-agent.js` / `rag-search.js`
- ❌ 引入新的依赖 (npm package)

---

## 5. 验证指标 (Sprint 4 用)

| 指标 | 定义 | 目标 | 数据来源 |
|------|------|------|---------|
| **首次行动时间** | 打开 → 开始学习 | < 30 秒 | telemetry / 真人测试 |
| **任务完成率** | 推荐任务 → 完成 | > 60% | `telemetry.action_started` vs `telemetry.action_completed` |
| **反馈覆盖率** | 学习行为 → 进入 student model | > 95% | `learning_events` / `student_knowledge_mastery.last_practice_at` |
| **次日回访率** | Day 1 → Day 2 | > 40% | `users.last_login_at` |
| **推荐采纳率** | 系统推荐 → 学生执行 | > 50% | `learning_events.recommendation_offered` vs `learning_events.recommendation_accepted` |

注: 真实采集需要新建 `learning_events` 表——**Sprint 2 才做**。Sprint 1 用 SQL 近似验证 (D078 §4.3)。

---

## 6. 架构边界 (与 D079 配合)

本项目**独立部署**在学校服务器，与开发基础设施 (Hermes / DSH / AI OS) 无运行链路耦合：

```
aitutor (生产)
├── Git 仓库 (本仓库)
├── Docker Compose
├── CI / Release Gate (D065)
├── 学校服务器部署
└── 真人用户

Hermes / DSH / AI OS (开发基础设施)
└── 不进入 aitutor 产品代码
└── 不进入学校服务器运行链路
```

详细架构边界见 **D079**。

---

## 7. 解冻条件

D078 在以下情况可被部分或全部解冻：

1. **Sprint 4 完成后** — 学习闭环 5 项指标全部达标 → 进入 v1.1 路线，可重新评估能力扩张
2. **数据安全问题** — P0 安全漏洞修复不受本禁令约束
3. **用户明确重新决策** — 通过新的 ADR 撤销本禁令

---

## 8. 与现有决策的兼容性

| 现有决策 | 兼容性 |
|---------|--------|
| D062 client envelope unify | ✅ 兼容 — learning-loop.js 必须遵守 |
| D063 question_uid single source | ✅ 兼容 — 反馈必须用 `api/core/questionUid.js` |
| D064 auto seed knowledge points | ✅ 兼容 — 不影响 |
| D065 release gate | ✅ 兼容 — Sprint 1 必须 gate 5/5 |
| D066 status yaml track | ✅ 兼容 — 状态可继续记录但**不增加新 status 文件** |
| D067 dev auth bypass guard | ✅ 兼容 — 反馈提交必须经过 authMiddleware |
| D068 RAG ingest | ✅ 不影响 — Sprint 0/1/2 不动 RAG |
| D069 ai trace table | ✅ 兼容 — 反馈提交时可选写 ai_trace (但非必须) |
| D070-D077 | ✅ 兼容 — 本决策是后续 |

---

## 9. Sprint 0 交付物 (本 ADR 同批)

- ✅ 本 ADR (D078) — 战略冻结
- ✅ D079 — 架构边界
- ✅ `docs/learning-loop-v1/SPEC.md` — Sprint 1 接口契约 + Sprint 1 后验证脚本 (Test 0/1/2)

**Sprint 0 完成后立即停止 `.ai/` 后续建设。**

---

## 10. 反向提议 (Revocation)

如果你 / 后续 agent 想反向提议 (例如"应该恢复 RAG 升级")，必须满足：

1. 引用本 ADR (D078) 并明确指出**解冻理由**
2. 证明该变更**不会破坏** Sprint 1-4 任一验证标准
3. 创建 D-NNN (N >= 080) 撤销本 ADR 的部分条款

**不接受**的反向提议：
- "GraphRAG 升级能提升 RAG 召回" → 与本冻结冲突，拒绝
- "新增 KPI 图表能帮助产品决策" → 违反 §2.1，禁止
- "AI OS 状态能帮助 agent 调试" → 违反 §6 + D079，禁止

---

**文档结束**
