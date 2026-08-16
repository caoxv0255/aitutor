# D066: aitutor .ai/status/ 入库策略

> 决策时间: 2026-08-17
> 决策状态: ACCEPTED
> 影响范围: aitutor .ai/status/*.yaml 入 git 历史; .ai/architecture/operations/agents/runbooks 仍 gitignored

## 背景

`.ai/status/*.yaml` 当前在 `.gitignore` (line 83: `.ai/`)。参考 ae142107 commit message:

> 私有 (gitignored, agent 运行时可见):
>   .ai/architecture/  .ai/operations/  .ai/agents/  .ai/runbooks/  .ai/status/

意思是 aitutor 把 `.ai/status/` 当成 agent 运行时生成的快照, 不入库. 但这导致:

1. 别人 clone aitutor 后, 跑 `bash scripts/emit-status.sh` 才会有 status YAML
2. emit 依赖 docker daemon, 无 docker 环境 clone → status 为空 → schema-validate 看到 7 个空文件 (实际是目录不存在, exit 3)
3. "reference implementation" 失去意义 — 别人看不到真实 status 是什么样

## 决策

**只入库 `.ai/status/*.yaml`, 其他 .ai/ 子目录保持 gitignored.**

理由:
- status YAML 是结构化 schema 契约 (`schema_version` + `generated_at` + 业务字段), 跟 decisions/architecture 一样是"协议级文档", 不是"运行时私有"
- 入库让 aitutor 成为可被 clone 复制的 reference implementation
- 其他子目录 (architecture/operations/agents/runbooks) 仍 gitignored, 因为含项目私有决策和运行配置

## 实施

1. `.gitignore` line 83 从 `.ai/` 改为 `.ai/architecture/\n.ai/operations/\n.ai/agents/\n.ai/runbooks/\n.ai/known-bugs.md\n.ai/runbook.md\n.ai/architecture.md\n.ai/decisions.md\n.ai/decisions/legacy/\n`
   (把 `.ai/status/` 从 ignore 中排除)

2. emit-status.sh 跑一次, 把 `.ai/status/*.yaml` 写到 working tree

3. `git add -f .ai/status/` + `git add scripts/emit-status.sh` + `git add .gitignore`

4. 单一 commit: `feat: D066 .ai/status/ 入库 — aitutor 成为 alpha reference`

## 影响

- aitutor clone 后立即有 7 个 status YAML, schema-validate 7/7 clean
- "alpha reference" 实至名归
- emit-status.sh 重构 (A3) 一并入库

## 后续

- D067 待定: emit-status.sh 是否需要 cron / pre-commit / manual 触发策略
- D068 待定: 7 YAML 中 placeholder (rag/backlog/recent-runs) 何时由人工填实