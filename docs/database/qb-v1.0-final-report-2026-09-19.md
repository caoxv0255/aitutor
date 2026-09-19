# QB v1.0 收官报告（2026-09-19）

> 状态: **本轮执行完毕**
> 上承: `docs/database/qb-v1.0-acceptance-verdict-2026-09-18.md` §4 执行顺序第 4–5 项
> 批次: `exam_papers.created_at::date = 2026-09-17`，1634 卷 / 35262 题（active）

---

## 1. 本轮做了什么

| # | 事项 | 结果 |
|---|---|---|
| 4 | `029_llm_answer_grading.sql` 落地（LLM 答案按学科分级） | ✅ 已执行，幂等已验证 |
| 5 | 复跑 G1–G17 确认无回归 | ✅ 17 PASS / 0 FAIL |
| 附 | D093 §3 判据落地（此前只改了文档注释，代码没改） | ✅ 已补齐，双向验证通过 |
| 附 | `030_formula_known_issue_tickets.sql`（K1 逐条建工单） | ✅ 5 条工单，幂等已验证 |

---

## 2. 029 答案分级执行结果

| 段 | 动作 | 行数 |
|---|---|---:|
| §2 | chinese / geography 撤出答案位 | **0** |
| §3 | ≥70% 学科写实测准确率进 `answer_provenance` | 2034 |
| §4 | CONFLICT 作废 → `MISSING_SOURCE`（两值都不采纳） | 103 |
| §5 | 冲突逐条建工单 | 103 |
| §6 | ledger 留痕 BEGIN / ANSWER_GRADED / COMMIT | 3 |

**§2 为 0 行的原因（不是漏跑）**：`12-llm-answer-fill.py:126` 在补答案阶段已按学科排除 chinese / geography，
库内 `answer_source='llm_websearch'` 的 2034 条**全部属于 ≥70% 学科**。裁决 §3.2 要求撤出的两科
本就没有 LLM 答案写入，故无值可撤 —— 结论未变，只是没有实际搬运。

**状态迁移**（本批 active 题）：

```
answer_status   执行前 → 执行后
PRESENT         25625  → 25625
MISSING_SOURCE   7500  →  7603   (+103 = CONFLICT 作废)
LLM_PROPOSED     2034  →  2034   (答案位不变, 仅补 provenance 准确率)
CONFLICT          103  →     0
```

**幂等验证**：重跑一遍，§2/§3/§4/§5 全部 0 行，ledger 三条 `INSERT 0 0`。

---

## 3. G1–G17 复跑结果

产物：`database/preflight/qb-extract/logs/qb-coverage-20260919-103856.json`
基线：`database/preflight/qb-extract/logs/qb-coverage-20260918-160207.json`

**汇总: PASS 17 / PARTIAL 0 / FAIL 0**（基线 16 PASS / 1 PARTIAL / 0 FAIL）

与基线逐条比对，**只有两条发生变化**：

| Gate | 基线 → 现在 | 变化性质 |
|---|---|---|
| G8 | ②客观题可判 21250/23335 = **91.1%** → 21204/23335 = **90.9%** | 029 的直接后果，预期内 |
| G11 | PARTIAL → PASS | **判据落地，不是数据变好** |

### G8 变化说明

CONFLICT 103 条按裁决 §3.3 转 `MISSING_SOURCE` 后不再计入"可判"，故可判数 −46。
裁决 §2 已把 G8 基线阈值定为 **≥90%**，现 90.9% **仍在阈值内**。①③ 无变化（标注率 100%、有答案无溯源 0）。

### G11 变化说明（避免误读）

残留仍是那 **5 条**不可渲染公式，数据一行没改。变化的是判据：
D093 ③ 早已裁决「达标线 = 可渲染率 ≥99.5%」，但 `20-formula-gate.py` 的代码仍按 `F0=0` 判定，
`08-acceptance.py` 仍按残留数判 PARTIAL —— **文档说一套、代码做一套**。本轮把代码对齐到裁决：

- `20-formula-gate.py`: `ok = (total - 不可渲染数) / total >= --min-rate`（默认 0.995），
  保留独立复验（翻标记骗不过），新增标记漂移 warning（库内 F0 与复验数不一致时打印，但不据标记判定）
- `08-acceptance.py` G11 段: 同判据，detail 继续带 F0/F1/F2 分布 + 残留条数 +
  「方案A自评口径，非规范 F2 判定」

**实测可渲染率 11034/11039 = 99.95%**（修复前 99.81%，两口径均 ≥99.5%）。

**双向验证**（闸门不能是"永远返回 0 的假闸门"）：

```
python3 20-formula-gate.py             → PASS, exit 0
python3 20-formula-gate.py --min-rate 1.0 → FAIL, exit 1   (零缺陷口径, 只看残留)
```

---

## 4. known-issues 状态

| # | 问题 | 状态 |
|---|---|---|
| K1 | 5 条不可渲染公式 | 工单已建（`030`，`FORMULA_UNRENDERABLE` ×5，含 formula_id 与原文），不硬修 |
| K2 | G11 方案 B（OMML 结构比对）未做 | backlog `G11-PLAN-B` 已登记 |
| K3 | 既有 `llm_b2` 引用注册表外 kp_id 6387 条 | 既有缺口，另案 |
| K4 | 英语 KP 覆盖 0%（词表无 ENG 单元） | 待词表扩充 |
| K5 | LLM 补答案约 16.7% 错误率 | 已按 §3 分级隔离，永不判分 |
| K6 | CONFLICT 103 条 | 已转 MISSING_SOURCE + 103 条工单待人工回原卷裁决 |

---

## 5. 遗留（不属本轮，已登记）

- **前端徽标**：≥70% 学科的答案位需展示「AI 补·未核验」。数据源已就绪
  （`answer_provenance.subject_accuracy`），徽标渲染**单独派单**，不阻塞 v1.0。
- **G11 方案 B**：`.ai/status/backlog.yaml` → `G11-PLAN-B`。
- **103 条冲突工单** / **5 条公式工单**：待人工回原卷裁决后回填。

---

## 6. 产物清单

```
database/migrations/029_llm_answer_grading.sql          答案分级 + 冲突作废 + ledger
database/migrations/030_formula_known_issue_tickets.sql K1 逐条建工单
scripts/qb-extract/20-formula-gate.py                   G11 闸门 (可渲染率判据 + 独立复验)
scripts/qb-extract/08-acceptance.py                     G11 段同步判据
database/preflight/qb-extract/logs/qb-coverage-20260919-103856.json   复跑报告
qb_recovery.canonical_migration_ledger                 run_label = qb-v1.0-answer-grading
```

---

*原则复述：本轮所有判定只在「有机械判据」的范围内下结论。G11 的 PASS 是**方案 A 自评口径**下的
通过 —— 规范 F2 阈值（外部 §24）仍缺失这一事实，不因判据落地而改变，已写进 gate detail。*
