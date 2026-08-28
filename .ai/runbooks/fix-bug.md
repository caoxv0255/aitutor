# Runbook: 修 Bug

> **触发**: 生产 bug / 测试失败 / 行为异常 / 性能问题
> **配合**: `agents/coding.md` (DSH 协议) + `agents/testing.md` (测试验证) + `agents/review.md` (审查)
> **本仓库特殊**: 见 CLAUDE.md §8 + context.md §8

---

## 0. Bug 分类

| 类型 | 例子 | 紧急度 |
|---|---|---|
| **P0 Security** | DEV_AUTH_BYPASS guard 失效 / SQL injection / 密钥泄露 | 立即修 |
| **P0 Functional** | 登录失败 / 错题上传失败 / 学习数据丢失 | 立即修 |
| **P1 Functional** | 边缘 case 失败 / UI 错位 / mock 残 | 本周 |
| **P2 Cosmetic** | 文案错 / 颜色 / 间距 | 排 backlog |
| **P3 Tech Debt** | pre-existing failure / lint 债 | 排 backlog |

---

## 1. 完整流程

### Step 1: 接收 Bug

```
输入:
- 用户报告 / 监控告警 / 测试失败 / git diff 暴露
- 复现条件 (URL / 操作 / 浏览器 / DB 状态)
```

### Step 2: 查已知坑

```bash
# 先查 .ai/known-bugs.md, 避免重复踩坑
cat .ai/known-bugs.md
```

**如果已知坑有记录**: 按已知坑的"修法"走, 不重新诊断。

**如果未知**: 进入 Step 3。

### Step 3: SCAN (DSH EXECUTION REPORT §2)

必须扫描:

```bash
# 1. 当前 git 状态
git status
git diff --stat

# 2. 找相关代码
grep -rn "关键词" --include="*.js" --include="*.html" --include="*.sql"
# 或用 gitnexus_query (AGENTS.md 推荐)

# 3. 找调用链
gitnexus_impact({target: "functionName", direction: "upstream"})
# 看 blast radius

# 4. 查相关 ADR
ls .ai/decisions/ | grep -i "关键词"
cat .ai/decisions/D0NN-xxx.md | head -50
```

### Step 4: 复现 (L4 - Real Evidence)

```bash
# 启动后端 (本地或 docker)
npm run dev    # 或 docker compose up -d app

# 复现
curl ... / API 调用 / 浏览器操作

# DB 验证
PGPASSWORD=... psql -c "..."
```

**如果不能复现**: 报告"unable to reproduce", 等用户提供更多上下文。

**如果能复现**: 记录 expected vs actual。

### Step 5: 根因分析

区分:

- **REAL FAILURE** — 代码 bug
- **ENVIRONMENT FAILURE** — DB 没起 / 端口占用 / 配置错误
- **PRE-EXISTING FAILURE** — Sprint 之前就有的失败 (git blame 验证)

### Step 6: 最小修复

按 DSH Operating Protocol §3 最小变更原则:

- 只改必要代码
- 不顺手 refactor
- 不扩大 scope
- 保持 backward compatibility

### Step 7: 加回归测试

每个 bug fix 必须有:
- 一个失败的测试用例 (在 fix 之前会失败)
- fix 之后这个测试 pass
- 防止以后 regression

### Step 8: 验证

```bash
# 1. 新测试 pass
npm run test  # vitest
node tests/contract.test.js  # contract

# 2. 现有测试不 regression
git stash && npm run test && git stash pop
# 对比 pre-existing failure 没增加

# 3. 真后端验证 (如适用)
BCT_URL=http://localhost:3002 node tests/backend-contract.test.js

# 4. DB 验证
PGPASSWORD=... psql -c "..."
```

### Step 9: 报告

按 `agents/coding.md` §14 DSH EXECUTION REPORT 模板, 必须包含:

- §2 CURRENT STATE — bug 复现条件
- §4 IMPLEMENTATION — 修复代码 + 回归测试
- §5 VALIDATION — 测试输出
- §6 EVIDENCE — git diff + DB 输出 + curl 输出
- §8 REGRESSION AUDIT — 明确无其他破坏
- §9 KNOWN ISSUES — 如有遗留

### Step 10: 已知坑入库 (P0/P1)

```bash
# 修改 .ai/known-bugs.md, 添加新坑
# 格式见 .ai/known-bugs.md 现有条目

vim .ai/known-bugs.md
```

⚠️ **修改 .ai/known-bugs.md 不需要 ADR 授权**, 这是记录性文件, 不算决策。

---

## 2. 本仓库特殊修法

### 2.1 DEV_AUTH_BYPASS 相关

- 见 D067 + `.ai/known-bugs.md` §2026-08
- 修法已标准化: `authMiddleware` 检测 + `server.js` 启动检测
- 不要绕过这条规则 (即使是"调试需要")

### 2.2 Hybrid RAG 一致性问题

- 见 `.ai/known-bugs.md` §2026-04
- pgvector vs AGE 不同步
- 短期修法: embedding + AGE 串联
- 长期: Python 微服务 + outbox 模式 (Day-3+ 决策)

### 2.3 SSE 截断

- 见 `.ai/known-bugs.md` §2026-04
- nginx `proxy_buffering off`
- 部署前必查 `deploy/nginx.conf`

### 2.4 pgvector HNSW vs IVFFlat

- 见 `.ai/known-bugs.md` §2026-04
- 1K 以下用 IVFFlat, 1K 以上用 HNSW
- 在 `database/init/03-pgvector.sql` 切换

### 2.5 DashScope URL

- 见 `.ai/known-bugs.md` §2026-04
- 必须用 `/compatible-mode/v1/chat/completions`
- **不要新建 `fetch()` 直连 DashScope**, 都走 `services/llm.js`

---

## 3. 反模式（禁止）

❌ 直接改测试让它 pass
❌ 跳过复现直接猜原因
❌ "理论应该可以" 作为验证
❌ 顺手 refactor
❌ 改 ADR 来"证明"实现是对的
❌ 把 pre-existing failure 算成自己的成功

---

## 4. 输出 checklist

修完一个 bug, EXECUTION REPORT 必须:

- [ ] §0 STATUS: COMPLETE
- [ ] §2 CURRENT STATE: bug 复现条件 + DB/code 状态
- [ ] §4 IMPLEMENTATION: 修复代码 + 新增/修改的测试
- [ ] §5 VALIDATION: PASS/FAIL 四层
- [ ] §6 EVIDENCE: 真实 git diff + test 输出
- [ ] §8 REGRESSION AUDIT: NO 或明确列出
- [ ] §9 BLOCKERS: None / 上报
- [ ] §11 NEXT ACTION: STOP FOR REVIEW 或 CONTINUE

---

## 5. Escalation

| 触发条件 | 上报对象 |
|---|---|
| 发现产品规则冲突 | Product Decision Required → L1 |
| 需要扩 scope | Product Decision Required → L1 |
| 需要改冻结架构 (D079) | Product Decision Required → L0 |
| 安全漏洞 (P0 Security) | 立即通知 L0 + L1 |
| 数据可能污染 | Product Decision Required → L1 |

---

**文档结束 — fix-bug runbook v1.0 (2026-08-28)**