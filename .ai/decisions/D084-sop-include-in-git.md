# D084 — 让 AI Agent SOP 文件入 Git (D066 Deviation Proposal)

> **类型**: Architecture / Process Decision (D066 的偏离提案)
> **触发**: D083 (AGENT-SOP-COMPLETE) 创建 18 个 SOP 文件, 但全在 .gitignore 中
> **状态**: ⏸️ **PROPOSED** — 等 L0/L1 批准
> **配合**: D066 (aitutor-status-yaml-track) + D083 (AGENT-SOP-COMPLETE) + DSH Operating Protocol v1.0
> **协议依据**: DSH Operating Protocol §13 (Deviation Proposal 机制)

---

## 0. 偏离背景

**D066 (2026-08-17)** 的入库策略:
```
.ai/architecture/      → gitignore (项目私有决策)
.ai/operations/        → gitignore
.ai/agents/            → gitignore
.ai/runbooks/          → gitignore
.ai/status/            → 入库 (alpha reference)
.ai/decisions/         → 部分入 (D061-D068 原子决策入, legacy/ gitignore)
.ai/integrations/      → 入库 (Hermes 协议契约 + 建议)
```

**D066 的设计理由**: "其他子目录 (architecture/operations/agents/runbooks) 仍 gitignore, 因为含项目私有决策和运行配置"

**D066 当时的现实**: 这些目录**不存在**, 所以 gitignore 不会丢东西。

**D083 (2026-08-28) 的现实**:
- `.ai/agents/`、`runbooks/`、`architecture/`、`operations/` 现在**有 18 个真实 SOP 文件**
- 内容是 **DSH Operating Protocol v1.0** (用户的长期协议) + **review/testing/migration agent SOP** + **runbooks** + **architecture docs**
- 这些 SOP **不是** "项目私有决策和运行配置", 而是 **跨开发机通用的工程 SOP**

**这是一个 D066 当时未预见的事实变化**, 因此需要 Deviation Proposal。

---

## 1. 提议内容

### 1.1 修改 .gitignore

**当前** (.gitignore line 100-103):
```
.ai/architecture/
.ai/operations/
.ai/agents/
.ai/runbooks/
```

**提议** (移除这 4 行):
```
# .ai/architecture/    # D084 让 SOP 入库 (D066 Deviation)
# .ai/operations/      # D084 让 SOP 入库 (D066 Deviation)
# .ai/agents/          # D084 让 SOP 入库 (D066 Deviation)
# .ai/runbooks/        # D084 让 SOP 入库 (D066 Deviation)
```

### 1.2 不动的部分

```
.ai/known-bugs.md       → 仍 gitignore (私密 bug 记录)
.ai/runbook.md          → 仍 gitignore (旧 runbook, 已废)
.ai/architecture.md     → 仍 gitignore (旧架构, 已废)
.ai/decisions.md        → 仍 gitignore (旧决策索引, 已废)
.ai/decisions/legacy/   → 仍 gitignore (历史归档)
```

### 1.3 入库策略总结 (提议后)

```
.ai/status/             → 入库
.ai/decisions/          → 部分入 (legacy/ gitignore)
.ai/integrations/       → 入库
.ai/agents/             → 入库 (新, D084)
.ai/runbooks/           → 入库 (新, D084)
.ai/architecture/       → 入库 (新, D084)
.ai/operations/         → 入库 (新, D084)
.ai/known-bugs.md       → gitignore
.ai/runbook.md          → gitignore
.ai/architecture.md     → gitignore
.ai/decisions.md        → gitignore
.ai/decisions/legacy/   → gitignore
```

---

## 2. 偏离 D066 的理由

### 2.1 D066 当时的设计依据（已变化）

| D066 假设 | D084 现实 |
|---|---|
| architecture/operations/agents/runbooks "含项目私有决策" | 这些目录现在是 **DSH 通用 SOP**, 不是私有决策 |
| 这些目录 "运行时配置" | 是 SOP 文档, 不是配置 |
| gitignore 可接受 | **DSH 协议要求** coding agent 进入项目时按角色读 SOP, 跨机器必须一致 |

### 2.2 不入库的代价（已浮现）

1. **跨机器失效**: 其他开发机 clone 仓库后, `.ai/agents/coding.md` 不存在 → DSH 协议**无法生效**
2. **Hermes TUI 失效**: Hermes 在其他机器读不到 SOP, 协作断裂
3. **CI/CD 缺失**: 镜像 / CI runner 里没有 SOP, agent 在 CI 环境**无规则可循**
4. **新人 onboarding 失效**: 新开发者 clone 后只看到 status YAML, 看不到架构/agent SOP
5. **DSH Operating Protocol v1.0 失效**: 你给的长期协议**物理上**只在本机生效

### 2.3 入库的收益

1. ✅ **跨机器一致**: 任何 clone 都有 SOP
2. ✅ **Hermes 集成顺畅**: Hermes TUI 在任何机器都能渲染 `.ai/` 全景
3. ✅ **CI/CD 可用**: agent 在 CI 也有 SOP 可读
4. ✅ **新人 onboarding 完整**: 一键 clone = 完整项目文档
5. ✅ **DSH 协议真正生效**: 你的 v1.0 协议跨机器可执行

---

## 3. 与 D066 的关系

D066 设计时是正确的（当时这些目录不存在）。
D084 是 D066 的**事实触发型 Deviation**: 当假设变化时, 偏离原本决策。

**未来类似情况**:
- 如果 `.ai/decisions/legacy/` 重新启用, 走同样的 Deviation Proposal 流程
- 如果 `.ai/status/` 需要扩充, 走 D066 原文

---

## 4. 影响范围

### 4.1 受影响的文件

- `.gitignore` — 移除 4 行 (line 100-103)
- `.ai/agents/*.md` (5 文件) — 第一次进 git
- `.ai/runbooks/*.md` (4 文件) — 第一次进 git
- `.ai/architecture/*.md` (4 文件) — 第一次进 git
- `.ai/operations/*.md` (5 文件) — 第一次进 git

### 4.2 不受影响的文件

- 所有现有 git 跟踪文件
- 所有 `.ai/decisions/*.md` (已独立入库策略)
- 所有 `.ai/status/*.yaml` (已入库)
- 所有代码 / 测试 / 配置

### 4.3 与 Sprint 2 的关系

- **D084 应在 Sprint 2 启动前落地** — 否则:
  - D082 的代码改动在新分支上
  - 但 SOP 文档还是 gitignore 状态
  - git history 不一致
- D084 + D082 启动顺序: **D084 先 commit**, 然后 D082 coding

---

## 5. 实施步骤

1. ✅ 创建本 ADR (D084-DP01)
2. ⏸️ 等 L0/L1 批准
3. 修改 `.gitignore` 移除 4 行
4. `git add .ai/{agents,runbooks,architecture,operations}/`
5. `git commit -m "feat(.ai): D084 让 SOP 文件入库 (D066 Deviation)"`
6. 跑 `npm run gate` (5 项) 验证未破
7. 报告

---

## 6. 风险评估

| 风险 | 概率 | 影响 | 缓解 |
|---|---|---|---|
| SOP 质量不高被入库 | 低 | 中 | D083 已基于真实代码 + 已批准 ADR, 引用真实 ADR D061-D082 |
| 其他开发者拒绝 | 低 | 中 | D083 内容是 DSH 协议 + runbook, 不引入业务规则争议 |
| 入库后难以回滚 | 极低 | 低 | 可以再 gitignore, 旧 commit 历史仍在 |
| 与现有文档冲突 | 极低 | 低 | D083 SOP 是新增, 不改现有 |

---

## 7. 替代方案（已否决）

### 方案 B: 只入库 DSH 协议本身 (`.ai/agents/coding.md`)

- ❌ 不一致: 4 个目录 4 种入库策略难维护
- ❌ Hermes TUI 在其他机器读不到其他 agent SOP
- ❌ 新人 onboarding 不完整

### 方案 C: 把 SOP 内容合并到 `INTEGRATION_WITH_HERMES.md`

- ❌ 单文件膨胀, 难维护
- ❌ 违反目录分离原则
- ❌ Hermes 集成文档与 DSH SOP 角色混淆

---

## 8. 时间敏感性

**应当与 Sprint 2 启动同时或之前完成**, 因为:
1. Sprint 2 启动后会有大量新 commit
2. SOP 入库应在新分支建立前
3. 否则 git history 会出现"Sprint 2 期间才补 SOP"的尴尬时间线

---

## 9. ⏸️ 状态

**PROPOSED — 等 L0/L1 批准**

批准后:
- 修改 .gitignore
- commit 18 个 SOP 文件
- 进入 Sprint 2 启动流程

---

## 10. 与协议 §13 (DSH Operating Protocol) 的对齐

按 DSH Operating Protocol v1.0 §13:

```
DSH 发现问题 (D083 后 gitignore 不合时宜)
       ↓
Deviation Proposal (D084-DP01)  ← 本文件
       ↓
ChatGPT 产品/工程审查 (L1)
       ↓
用户批准 (L0)
       ↓
DSH 继续 (修改 .gitignore + commit)
```

✅ 完全符合协议流程。

---

**文档结束 — D084 Deviation Proposal**