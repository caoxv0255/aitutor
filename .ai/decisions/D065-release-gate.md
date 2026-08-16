# D065 — 发布质量门禁 (npm run gate)

> **日期**: 2026-08-15
> **阶段**: Phase 4 发布准备
> **影响范围**: 全部 (vitest / contract / BCT / docker / health)

## 问题

项目到产品化阶段, 之前缺乏**自动化发布门禁**:
- 241 个 Vitest 测试没人保证 commit 前跑过
- 前端 contract test (38) 与 mock 文件同步 — 改 backend 字段忘改 mock 会跑过 vitest 但前端炸
- 后端 contract (BCT) 必须真后端跑, 没有 CI 集成
- Docker 构建失败 / health 退化上线后才发

## 决策

建立 `scripts/release-gate.sh` + `npm run gate` + **pre-commit hook**:

### 5 项自动门禁

```bash
npm run gate
├── 1/5 Vitest (单元)        # npx vitest run
├── 2/5 contract (mock)      # node tests/contract.test.js
├── 3/5 BCT (真后端)         # BCT_URL=... node tests/backend-contract.test.js
├── 4/5 docker build         # docker compose build app
└── 5/5 health check         # curl /api/health dbReady=true
```

### 跳过开关

- `SKIP_BCT=1` (无后端 CI)
- `SKIP_DOCKER=1` (无 docker CI)

### Pre-commit hook (下一步)

`.git/hooks/pre-commit`: `npm run gate` 失败 → 拒绝 commit.

### GitHub Actions (下一步)

`.github/workflows/gate.yml`: PR 必须 gate 全绿.

## 备选方案

| 方案 | 否决理由 |
|------|----------|
| 每次 commit 跑全套 gate | 太慢 (docker build 2-5min), 用 pre-commit 太重; 用 GitHub Actions PR gate 合适 |
| 只跑 Vitest | 不足以覆盖 mock/real 契约 |
| 只跑 BCT | 单元逻辑无法覆盖 |
| **✅ 全套 5 项 + 可跳过开关** | 选定 |

## 后果

- 新代码 commit 前自动验证 5 项
- 失败时 `[Seed] 跳过` / `❌ BCT 失败` 等可读错误
- 退出码 0/1 可被 CI 消费
- 已知遗留 (docs/v1.0_RELEASE_GATE.md):
  - lint 基线 2445 项**不**作为硬门禁 (新代码零新增已验证)
  - Lighthouse / 安全扫描为**人工**门禁

## 变更文件

| 文件 | 改动 |
|------|------|
| `scripts/release-gate.sh` | **新增** (5 项 gate) |
| `package.json` | `"gate": "bash scripts/release-gate.sh"` |
| `tests/backend-contract.test.js` | **新增** (19 项) |
| `docs/v1.0_RELEASE_GATE.md` | **新增** (自动 + 人工门禁清单) |

## 验证

```bash
npm run gate
# → ✅ 发布门禁全部通过 — 可进入 v1.0 发布流程

SKIP_DOCKER=1 BCT_URL=http://localhost:3002 npm run gate
# 5/5 ✅
```

## 下一步 (P0 backlog)

- [ ] pre-commit hook
- [ ] GitHub Actions workflow
- [ ] Lighthouse CI
- [ ] 依赖漏洞扫描 (`npm audit`)