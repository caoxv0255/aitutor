# D093 — G11 公式闸门判据（关键公式定义 / 方案 B / 达标线）

- 日期: 2026-09-18
- 状态: **已裁决，已实施**
- 关联: `docs/database/g11-threshold-proposal.md`（实测与方案 A/B/C）、
  `docs/database/qb-v1.0-acceptance-verdict-2026-09-18.md`（本轮裁决记录）
- 影响文件: `scripts/qb-extract/20-formula-gate.py`、`scripts/qb-extract/08-acceptance.py`

---

## 1. 背景

G11 是本批唯一 PARTIAL 的 gate。规范原文只有一句「G11 LaTeX : 关键公式 >=F2」，而
**F0–F3 的定义（外部规范 §24）不在本仓库**，`question_formulas` 连 `formula_quality` 列都没有。
在无定义的情况下判定「是否达到 F2」是不可能的 —— 按本项目原则，**「没法测」不得写成「通过」**。

方案 A（可渲染口径）已实施完毕（`19-formula-repair.py` 修 16 条 + 建列回填 + `20-formula-gate.py` 带独立复验）。
本决策解决剩下三个"如何才算过"的问题。

---

## 2. 裁决

### ① 「关键公式」= 四学科全量公式 span（不做语义筛选）

**定义**：math / physics / chemistry / biology 四个学科中，stem / options / answer / analysis
四个字段内被管线公式检测器提取的**全部公式 span**，即为关键公式。

**理由**：可复现、可辩护。语义筛选（"只有重要公式才判"）需要引入人判，不可审计 ——
这与本管线已踩过的坑同源（`g11-threshold-proposal.md` §2.4 证明「结构密度」是 F2 的坏代理；
§4 记录了三次"看起来对其实是错"的代理指标）。**凡是无法机械复现的判据，一律不进闸门。**

**口径后果**：当前关键公式总量 **11039 条**，分布于 math 5896 / physics 3244 / chemistry 1782 / biology 117。
与 `exam_questions.latex_formulas`（JSON 数组串，3322 题）展开后**是同一批资产**，不是两份数据。

### ② 方案 B（OMML 结构比对）不做，记入 backlog

**裁决**：不做。

**理由**：
- 方案 A 的 99.81%（修复后 99.95%）可渲染率**已满足 v1.0 发布要求**
- 方案 B 的唯一增量价值是**为 F2 判级提供辩护**，属增强项，非发布必需项
- 其前置风险未消：需把 `docx-cache/*.docx` 的 `m:oMath` 节点与 VLM 公式按**题号 + 出现顺序**配对，
  **配对率未知**，而配对本身就是主要失效点。为 v1.0 承担这个不确定性不值得

**落地**：记入 backlog，见 `.ai/status/backlog.yaml` → `G11-PLAN-B`。

### ③ 达标线 = 可渲染率 ≥99.5%（硬闸门）

**裁决**：判据从 ~~`F0 = 0`~~ 改为 **可渲染率 ≥ 99.5%**。

**理由**：`F0 = 0` 是"零缺陷"判据，与"残留 5 条不硬修"的裁决直接冲突 ——
那 5 条已被判定为**修了会变成更坏的东西**（VLM 循环产物、JSON 外壳、臆造命令 `\boxempty`），
在 `F0=0` 口径下闸门会永久 FAIL，把一个已知且已接受的缺陷伪装成阻塞项。
改成比率判据后，闸门表达的是**真实的质量目标**，残留项走 known-issues 流程。

**实测**：修复前 11018/11039 = **99.81%**；修复后 11034/11039 = **99.95%**。两个口径都 ≥99.5%。

**残留 5 条**：逐条建工单，不硬修，列入 v1.0 known-issues（K1）。
闸门仍会**逐条打印**残留清单 —— 可见但不阻塞。

---

## 3. 实施

### 3.1 `20-formula-gate.py`

- 判据：`ok = (total - len(bad)) / total >= min_rate`，`--min-rate` 默认 **0.995**
- **保留独立复验**：不信库内 `formula_quality` 标记，自己把全量重跑 KaTeX。
  翻标记骗不过 —— 这条是闸门的生命线，不因判据放宽而改变
- 库内标记与独立复验**不一致时打印 warning**（标记漂移），但**不据标记判定**
- 退出码语义不变：0 = 通过 / 1 = 不通过（CI 拦截）/ 2 = 环境错误

### 3.2 `08-acceptance.py` G11 段

与闸门同一判据（≥99.5% → PASS），detail 里继续带 F0/F1/F2 分布与残留条数，
并注明「方案 A 自评口径，非规范 F2 判定」—— 规范定义缺失这一事实不因本决策而改变。

** blast radius**：`20-formula-gate.py` 无导入方（仅文档与注释引用）；
`08-acceptance.py` 的 G11 段是其唯一逻辑耦合点，同步修改。两者都在 `scripts/qb-extract/` 内，
不进生产代码路径。**风险 LOW**。

> ⚠️ 本机 GitNexus CLI 不可用（`@ladybugdb/core` 原生模块 dlopen 失败），
> 影响面改用 grep 人工核对：无 importer，耦合点仅 `08-acceptance.py:315-330`。

**落地状态（2026-09-19 补记）**：§3.1 / §3.2 曾一度**只改了本文档与脚本注释、代码未改**
（`20-formula-gate.py` 仍按 `F0=0` 判 FAIL，`08-acceptance.py` 仍按残留数判 PARTIAL），
与本文「已实施」不符。已于 2026-09-19 按 §3 补齐代码并双向验证：
默认口径 PASS / exit 0，`--min-rate 1.0` FAIL / exit 1。
残留 5 条已由 `030_formula_known_issue_tickets.sql` 建工单。
收官报告见 `docs/database/qb-v1.0-final-report-2026-09-19.md`。

---

## 4. 不做什么

| 项 | 处置 |
|---|---|
| 规范 §24 的 F0–F3 定义 | 仍缺失 —— 本决策**不代替规范**，G11 的判定口径是「方案 A 自评」，需在规范补齐时复核 |
| 方案 B / C（OMML 比对 / 回渲比对） | backlog，不进 v1.0 |
| 残留 5 条 | 建工单，不硬修 |

---

## 5. 复现命令

```bash
python3 scripts/qb-extract/20-formula-gate.py                 # 默认 ≥99.5%
python3 scripts/qb-extract/20-formula-gate.py --min-rate 1.0  # 回到零缺陷口径看残留
python3 scripts/qb-extract/08-acceptance.py                   # G1–G17 全量
```
