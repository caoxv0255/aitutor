# Runbooks — 执行剧本索引

> **目的**: Coding Agent 在执行常见任务时按本目录剧本走, 避免重新发明轮子。
> **最后更新**: 2026-08-28 (D083 补全)

---

## 1. Runbook 清单

| Runbook | 文件 | 何时使用 |
|---|---|---|
| **修 Bug** | [`fix-bug.md`](./fix-bug.md) | 生产 bug / 测试失败 / 行为异常 |
| **加 API** | [`add-api.md`](./add-api.md) | 新增 endpoint / 修改现有 endpoint |
| **DB Migration** | [`db-migration.md`](./db-migration.md) | 加表 / 加字段 / 数据回填 |

---

## 2. 通用步骤

任何 runbook 都遵循:

```
1. READ    — 读 ADR + 现有代码
2. SCAN    — git status / 目录 / 相关文件
3. PLAN    — 拆 block, 写 DSH EXECUTION REPORT §3
4. CODE    — 按 block 实现
5. TEST    — 跑相关测试
6. EVIDENCE — 收集证据 (test 输出 / SQL / curl / git diff)
7. REPORT  — 输出完整 EXECUTION REPORT
8. REVIEW  — 等 Product Review Agent 审查
```

---

## 3. Runbook × ADR 交叉引用

| 任务 | 主 runbook | 相关 ADR |
|---|---|---|
| 加一个 user endpoint | add-api | D062 (envelope), D067 (auth), D082 (Sprint 2 example) |
| 加一张 learning 表 | db-migration | D063 (uid), D081 (today_task_log), D064 (auto-seed) |
| 修 auth bypass 问题 | fix-bug | D067 (DEV_AUTH_BYPASS guard) |
| 改 client.js (envelope) | fix-bug | D062 (envelope unify) |
| 加 LLM 调用观测 | add-api | D069 (ai_trace table) |
| 修复 pre-existing failure | fix-bug | (看 git blame 历史) |

---

## 4. 不在本目录范围

- ❌ Sprint 启动流程 → 见 `agents/coding.md` §18
- ❌ 测试策略 → 见 `agents/testing.md`
- ❌ 审查策略 → 见 `agents/review.md`
- ❌ 数据库迁移细节 → 见 `agents/migration.md`

---

**文档结束**