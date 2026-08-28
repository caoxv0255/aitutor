# Agents — AI Agent 角色定义

> **目的**: 不同类型的 AI agent（Claude Code / Cursor / Hermes / DeepSeek 等）进入本项目时, 先读本文件, 然后按当前角色读对应子文件。
>
> **最后更新**: 2026-08-28 (D083 补全)
> **配合**: `.ai/context.md` (5 分钟入口) + `.ai/decisions/` (决策历史)

---

## 1. 角色清单

| 角色 | 文件 | 何时使用 |
|---|---|---|
| **coding agent** | [`coding.md`](./coding.md) | 写新代码 / 改代码 / 修 bug / 加 API |
| **review agent** | [`review.md`](./review.md) | 审查 PR / 审查 DSH EXECUTION REPORT / 验收 DoD |
| **testing agent** | [`testing.md`](./testing.md) | 补测试 / 跑 gate / 分析覆盖率 |
| **migration agent** | [`migration.md`](./migration.md) | DB schema 变更 / 数据迁移 / backward compat |

---

## 2. 角色 × 任务映射

| 我要... | 角色 | 主文件 | 必读 |
|---|---|---|---|
| 修一个生产 bug | coding → testing | `runbooks/fix-bug.md` | `known-bugs.md` |
| 加一个新 API endpoint | coding → review | `runbooks/add-api.md` | D062 (envelope) + D067 (auth) |
| 改 DB schema | migration → coding | `runbooks/db-migration.md` | `architecture/database.md` |
| 审查一个 sprint 的实现 | review | (本目录 coding.md + review.md) | `decisions/` 最新 ADR |
| 跑发布前 5 项门禁 | testing | (本目录 testing.md) | `status/gate-status.yaml` |
| 数据迁移 / 回填 | migration | `runbooks/db-migration.md` | `architecture/database.md` + D063 (uid) |

---

## 3. 通用约束（所有角色适用）

来自 `CLAUDE.md` §8 与 `context.md` §8:

1. **改任何 symbol 前** 先跑 `gitnexus_impact` (如可用) 或读 `architecture/` 找到 callers
2. **改 client.js 后** 必须验证: `npm test` + BCT + `git diff --stat` 看波及页面
3. **改 auth / security 后** 必须重建 docker 镜像验证容器端
4. **改迁移前** 必须验证: 全新 DB + 已存在 DB 两种情况
5. **commit 前** 必须 `npm run gate` 全绿（或 `SKIP_DOCKER=1` 在 WSL 下）
6. **不要改既有 lint 债务** (基线 2445 项); 新代码必须 lint 干净
7. **不要修改 `.ai/decisions/`** (除非收到 Deviation Proposal 授权)

---

## 4. 决策权层级 (Authority Model)

```
L0 — Human Product Owner (用户本人)
L1 — Product Decision Agent (ChatGPT / 战略审查)
L2 — DSH / Coding Agent (实现) ← 我们当前角色
L3 — Hermes / Memory Plane (辅助上下文, 不决策)
```

**Coding Agent 不得**:
- 因"自己觉得更好"改变已冻结的 ADR
- 在 Product Decision Required 节点擅自选择方案
- 跳过 review agent 的验收直接宣称完成

---

## 5. DSH 执行报告模板 (必读)

所有角色在交付时必须使用 `DSH EXECUTION REPORT` 模板（见 `coding.md` §14）。

---

## 6. 与 Hermes 的边界

- Hermes = Memory Plane，**只读** `.ai/decisions/` + `.ai/status/`
- Coding Agent = Execution Plane，**写代码 + 写 ADR + 写 runbook**
- Hermes **不得**直接修改 `.ai/` 文档（见 `INTEGRATION_WITH_HERMES.md` §5）
- Coding Agent **不得**绕过 `npm run gate`（见 `INTEGRATION_WITH_HERMES.md` §6）

---

## 7. 不在本目录范围

- ❌ Hermes TUI 实现细节 → 见 Hermes 仓库
- ❌ AI agent 框架选型（LangGraph / AutoGen / CrewAI）→ 见 D079 (architecture boundary)
- ❌ AI OS / 多 agent swarm → **明确禁止**进入 aitutor (D079)

---

**文档结束**