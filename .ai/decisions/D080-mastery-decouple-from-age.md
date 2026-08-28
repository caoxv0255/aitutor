# D080 — Mastery 写入与 AGE 涟漪解耦（解冻 R-AGE 修复）

> **类型**: 架构解冻 (Unfreeze) — 临时允许修改 learning-loop.js
> **触发**: Sprint 1 DoD #11 / #12 验证阻塞 (R-AGE)
> **配合**: D078 §4.5
> **状态**: ✅ 立即生效

---

## 0. 解冻背景

D078 §4.5 禁止修改 `api/routes/learning-loop.js`，目的是保护"接通而不是重写"的范围纪律。但 Sprint 1 真实验收发现：

**根因**:
- `processSingleFeedback` 把 mastery UPSERT (SQL) 和 ripple effect (AGE Cypher) 包在**同一事务**
- 后端 Cypher 调用 `cypher(graph, query, [string])` 类型不匹配 — AGE 1.6.0 不接受 string 作为参数 (`function cypher(unknown, unknown, text[]) does not exist`)
- Cypher 失败 → 事务进入 aborted state → 必须 ROLLBACK → **mastery 也不写**
- 结果: submitFeedback 返回 200 success 但 DB 0 行

**这违反 D078 §0 的核心目标**:
> 让学生完成一次学习行为之后，系统把这个行为转化成下一次更好的学习行为。

如果 mastery 永远不写，SRS 永远不调度，**"完成一次学习行为" 等于没发生**。

## 1. 解冻范围

**允许**修改 `api/routes/learning-loop.js` 的**仅这部分**:

1. 把 mastery 写入 (Step 3 UPSERT) 从 processSingleFeedback 的 AGE 事务中**剥离**
2. mastery 走独立 SQL 事务
3. ripple effect 单独事务，失败仅 warn，不影响 mastery
4. srs_review_log 写入与 mastery **同事务**

**禁止**:
- ❌ 重写 prompt / 算法
- ❌ 改 mastery delta 计算公式 (CORRECT_NO_HINT=15, CORRECT_WITH_HINT=5, INCORRECT=-20)
- ❌ 改 SM-2 算法
- ❌ 引入新 npm 依赖
- ❌ 改 Cypher 调用本身 (这是真实后端 bug, 留待 D081 处理)

## 2. 解冻理由

按 D078 §10:
> 1. 引用本 ADR (D078) 并明确指出**解冻理由**
> 2. 证明该变更**不会破坏** Sprint 1-4 任一验证标准
> 3. 创建 D-NNN (N >= 080) 撤销本 ADR 的部分条款

**本 ADR 满足**:
- ✅ 引用 D078
- ✅ 解冻理由: R-AGE 是 Sprint 1 DoD #11/#12 阻塞, 不修复 = 学习闭环 0/1
- ✅ 不会破坏后续 Sprint: 仍然维护 ripple effect 逻辑 (即使降级为 best-effort)

## 3. 修复原则

**核心原则 (来自用户产品判断)**:
> 宁可只记录高置信度的学习行为, 也不要为了覆盖率制造错误学习数据。

- mastery UPSERT + srs_review_log = **强信号, 必须写入**
- ripple effect = **增强信号, 失败仅 warn**

## 4. 解冻后状态

D078 §4.5 第 1 条 "❌ 重写 api/routes/learning-loop.js" **部分解冻**:
- "重写" 仍禁止
- "解耦 mastery 与 ripple" **允许**
- 其他 4 条禁令继续生效

## 5. 与 D078 的关系

本 ADR 不撤销 D078。后续 Sprint 仍按 D078 §3 路线执行:
- Sprint 1: 修复 R-AGE → 真学习闭环 (本 ADR 解冻范围)
- Sprint 2: Today Recommendation
- Sprint 3: Learning Path state machine
- Sprint 4: 真人验证

## 6. 后续 D081 (待定)

Cypher 函数签名 bug 修复可能需要:
- 后端传 agtype 参数而非 string
- 或者改 Cypher 调用语法

这是**单独的修复**, 不在本 ADR 范围。

---

**文档结束**
