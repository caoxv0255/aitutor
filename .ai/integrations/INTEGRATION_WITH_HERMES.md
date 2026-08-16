# INTEGRATION WITH HERMES — aitutor × Hermes 协议

> **目的**: 让 Hermes（或任何 AI agent）能 **零成本接入** aitutor 项目.
>
> **协议方向**: Hermes → aitutor (读取 `.ai/`, 不反向依赖 Hermes).
>
> **最后更新**: 2026-08-15

---

## 1. Hermes 进入 aitutor 的标准流程

```bash
# Step 1: 进入项目
cd ~/aitutor

# Step 2: 读 context (5 分钟)
cat .ai/context.md

# Step 3: 读相关子目录 (按需)
cat .ai/architecture/backend.md      # 改后端才读
cat .ai/decisions/D-NNN.md           # 找相关历史决策
cat .ai/runbooks/fix-bug.md          # 找对应剧本
cat .ai/agents/coding.md             # 自己角色

# Step 4: 读实时状态
cat .ai/status/version.yaml          # git / commits
cat .ai/status/gate-status.yaml      # 最近 gate 结果
cat .ai/status/docker-health.yaml     # 容器健康
cat .ai/status/rag-components.yaml    # RAG 组件状态
cat .ai/status/database.yaml          # DB schema 状态
cat .ai/status/recent-runs.yaml      # 最近 agent runs
cat .ai/status/backlog.yaml           # P0/P1/P2 backlog

# Step 5: 执行任务 (按 runbook)
```

---

## 2. .ai/ 目录结构 (Hermes 期望的)

```
.ai/
├── context.md                       # ⚠️ 第一站 (必读)
├── architecture/
│   ├── backend.md
│   ├── frontend.md
│   ├── rag.md
│   └── database.md
├── decisions/
│   ├── decisions.md                 # 索引
│   ├── D0NN-xxx.md                  # 原子决策
│   └── legacy/                      # 历史归档
├── operations/
│   ├── index.md
│   ├── deploy.md
│   ├── backup-recovery.md
│   ├── security.md
│   └── observability.md
├── agents/
│   ├── index.md
│   ├── coding.md
│   ├── review.md
│   ├── testing.md
│   └── migration.md
├── runbooks/
│   ├── index.md
│   ├── fix-bug.md
│   ├── add-api.md
│   └── db-migration.md
├── status/                          # ⭐ Hermes TUI 数据源
│   ├── version.yaml
│   ├── gate-status.yaml
│   ├── docker-health.yaml
│   ├── rag-components.yaml
│   ├── database.yaml
│   ├── recent-runs.yaml
│   └── backlog.yaml
├── known-bugs.md                    # 历史已知坑
├── runbook.md                       # 旧 runbook (被 runbooks/ 替代, 保留过渡)
├── architecture.md                  # 旧架构 (被拆分, 保留过渡)
└── decisions.md                     # 旧决策索引 (已被新 decisions/ 替代, 保留过渡)
```

---

## 3. status YAML Schema (Hermes 渲染契约)

每个 status YAML **必须**包含:

```yaml
schema_version: "1.0"           # 协议版本
generated_at: "ISO-8601"        # 生成时间
# ... 业务字段 ...
alerts: []                      # 严重度列表 (空 = 健康)
```

**Alert 严重度**:
- `critical` — 阻塞发布 / 服务不可用
- `medium` — 数据缺失 / 性能降级
- `low` — backlog / 待优化

---

## 4. Hermes TUI 推荐布局

```
╭──── aitutor Agent Console ────╮
│                                │
│  Release:       v1.0 RC1      │ ← version.yaml + git.tag
│  Head:          d7c0205f      │
│  Test:          241/241 ✅     │ ← gate-status.yaml
│  Contract:      57/57 ✅      │
│  Docker:        healthy        │ ← docker-health.yaml
│  DB:            34 tables      │ ← database.yaml
│                                │
│  RAG:                           │
│  ├─ vision        ✅           │ ← rag-components.yaml
│  ├─ embedding     ✅           │
│  ├─ pgvector      ✅           │
│  ├─ AGE           ✅           │
│  └─ LLM           ✅           │
│                                │
│  Recent Agent Runs:             │
│  ├─ ✓ phase-4-hardening        │ ← recent-runs.yaml
│  │    35 files, gate ✅        │
│  ├─ ✓ f3-vision-migration      │
│  │    7 files                  │
│  └─ ...                        │
│                                │
│  ⚠️  P0:                       │ ← backlog.yaml
│  ├─ ai_trace 表未建             │
│  └─ pre-commit gate 未焊死      │
│                                │
╰────────────────────────────────╯
```

**数据全部从 `.ai/status/*.yaml` 渲染** — Hermes **不需要**直接调 docker / git / DB.

---

## 5. Hermes 写入路径 (反向)

Hermes **可以**写回 `.ai/`, 但**只限两类操作**:

1. **更新 `recent-runs.yaml`** (追加新 run 记录)
2. **更新 `backlog.yaml`** (标记 P0/P1 为完成)

**禁止**写:
- `*.md` (architecture / decisions / runbooks / agents) — 由人工或 coding agent 维护
- `gate-status.yaml` / `docker-health.yaml` / `database.yaml` / `rag-components.yaml` — 自动化脚本 (`emit-status.sh`) 写入

**冲突解决**: Hermes 写回时**保留** `schema_version` 和 `generated_at`, 不重置已有 alerts.

---

## 6. Hermes 与 `npm run gate` 的关系

**Hermes 必须遵守**: 在 aitutor 内做任何代码改动 → 触发 `npm run gate` → 通过才 commit.

```
Hermes 改动代码
   ↓
npm run gate (5 项)
   ├─ vitest 241
   ├─ contract 38
   ├─ BCT 19 (需运行后端)
   ├─ docker build
   └─ health
   ↓ 失败
回退 + 修
   ↓ 通过
emit-status.sh (刷 .ai/status/)
   ↓
git commit
```

**Hermes TUI 可加按钮**: "Run Gate" → 在 aitutor 仓库内执行 `npm run gate`.

---

## 7. aitutor 对 Hermes 的期望 (v1.0)

- ✅ **进入项目** → 自动加载 `.ai/context.md` (5 分钟恢复)
- ✅ **TUI 渲染** → 从 `.ai/status/*.yaml` 拉数据 (不直接 docker/git)
- ✅ **改动代码** → 跑 `npm run gate` 验证 (Hermes 自带 task runner)
- ✅ **commit 后** → Hermes 可调用 `bash scripts/emit-status.sh` 刷新状态
- ✅ **TUI 任务跳转** → 从 `recent-runs.yaml` 跳到对应 D-NNN 文档
- ⏳ **可选**: TUI 内直接跑 agent (Hermes 自带 workflow)

---

## 8. 不在协议范围内 (Hermes 不要做)

- ❌ 修改 `.ai/` 文档 (交回 coding agent / 人工)
- ❌ 绕过 `npm run gate` 直接 commit
- ❌ 直接调 docker / git 命令 (用 emit-status.sh)
- ❌ 改 backend 业务逻辑 (除非有 runbook + 测试覆盖)
- ❌ 跳过 review agent 检查

---

## 9. 协议版本

**当前**: 1.0 (2026-08-15)

**演进规则**:
- schema_version 递增表示 breaking change
- 新增字段不递增 (向后兼容)
- 移除字段**必须**递增 major 版本

---

## 10. 一句话总结

> **Hermes 把 `.ai/` 当成 aitutor 的 "API": 只读 + 约定写入路径. 渲染 `.ai/status/*.yaml` 给用户看, 改动代码必须过 `npm run gate`.**