# AITUTOR Git 同步操作手册 (SYNC-SOP)

> **目的**: 让"本地 commit → GitHub 推送"成为日常动作，无需每次询问凭证或诊断。

---

## 1. 仓库布局（避免混淆）

| Remote 名称 | URL | 角色 | 何时用 |
|---|---|---|---|
| `github` | `git@github.com:caoxv0255/aitutor.git` | **远程权威仓库**（对外） | 所有正式 release、PR、tag |
| `origin` | `/home/git/repos/aitutor.git` | **本地 bare 镜像** | 仅做 local diff / 内部引用 |

**规则**：
- ✅ `git push github <branch>` — 把工作同步到 GitHub
- ❌ `git push origin <branch>` — 不要推，会让 origin/main 与 github/main 分裂
- 如果发现 origin/main 与 github/main 不同步，**不要尝试让它们同步**，只用 github 作为唯一权威

---

## 2. 凭证机制

### 2.1 已配置的 SSH Deploy Key

```
Public key: ~/.ssh/id_rsa.pub
Fingerprint: SHA256:znRXBKki9ImE1BGL4z8cQONCMrAcv/nUF/EgcpU96rA
Type: RSA 4096
Comment: ningning.liu@uibe.edu.cn
GitHub: caoxv0255/aitutor (deploy key, Allow write access ✓)
```

### 2.2 为什么不用 PAT

测试过的 PAT：
- Round 1: `github_pat_11BZ...` (fine-grained v2) — 无 write scope
- Round 2: `ghp_Txtn...` (classic format) — 无 write scope

**结论**：本环境的 GitHub 账户对 `caoxv0255/aitutor` 没有 create fine-grained write PAT 的权限（可能不是 repo owner），但**SSH deploy key 已正确配置为 write-enabled**。所以：

✅ **用 SSH key，不要用 PAT**。

### 2.3 凭证清理规范

每次 push 完成后：
- ssh-agent 自动 kill（`scripts/dev/push-github.sh` 内置 `trap` 处理）
- 私钥仍在 `~/.ssh/id_rsa`（合法长生命周期 key）
- 临时 PAT（如曾用过）必须 `unset GH_TOKEN; history -c; history -w`

---

## 3. 日常 push 流程

### 3.1 一行命令推送到 GitHub

```bash
# 当前在 main 分支 + working tree clean + 有新 commits
scripts/dev/push-github.sh

# 当前在 feature/xxx 分支
scripts/dev/push-github.sh

# push 多个 commits + 所有 tags
scripts/dev/push-github.sh --tags

# 只检查不真推
scripts/dev/push-github.sh --dry-run

# 推送到不同名的远端分支
scripts/dev/push-github.sh feature/xxx:develop
```

### 3.2 脚本会自动做的事

1. ✅ Working tree clean 检查（modified / staged 都禁止 push）
2. ✅ 检查 ahead-of-remote（无 commit 可推就拒绝）
3. ✅ 启动 ssh-agent + ssh-add `~/.ssh/id_rsa`（sub-shell-safe）
4. ✅ `ssh -T git@github.com` 验证认证
5. ✅ 推送到 `git@github.com:caoxv0255/aitutor.git`
6. ✅ `git fetch github --prune` 同步远端 refs
7. ✅ 打印最终 SHA 对比
8. ✅ EXIT trap 杀 ssh-agent

### 3.3 脚本的 STOP 条件

| 触发 | 表现 | 解决 |
|---|---|---|
| working tree 不 clean | "Working tree has tracked modifications" | `git commit` 或 `git stash` |
| 当前 branch 不在 | "current is detached HEAD" | `git checkout <branch>` |
| 无 commit 可推 | "Local and remote HEAD are identical" | 无需 push |
| ssh-add 失败 | "ssh-add failed" | 检查 `~/.ssh/id_rsa` 存在 |
| ssh 认证失败 | (script 继续, push 失败) | 检查 deploy key 是否仍 active |

---

## 4. commit 前的检查清单

每次 `git commit` 前：

```bash
# 1. 看 working tree
git status

# 2. 看要 stage 的内容
git diff --cached

# 3. 扫 secret (避免误推)
git diff --cached | grep -E '(sk-[a-zA-Z0-9]{20,}|test_pg_[a-f0-9]{32}|ghp_[a-zA-Z0-9]{36})' && echo "❌ SECRET LEAK" || echo "✓ no secret"

# 4. 确认 .gitignore 已覆盖大文件
git status --ignored | grep -E '(database\.tar|hermes_pack|lost_exam_pack|database/incoming|database/assets|database/backups|\.gitnexus/lbug)' && echo "⚠️  WARNING: large file not ignored" || echo "✓ large files ignored"

# 5. 写好 commit message (用 feat/fix/chore/docs/refactor/test 前缀)
git commit -m "feat: ..."
```

---

## 5. 紧急跳过 gate 的 SOP

仓库的 pre-commit hook 跑 `npm run gate`（vitest/contract/docker/health）。环境缺 pg/Docker 时会失败。

### 5.1 是否可以 --no-verify？

**只有以下条件全部满足才能用**：

1. commit 信息显式说明 `--no-verify` 原因
2. 不引入新代码 bug（仅 doc/config/migration）
3. `npm run gate` 失败原因已知是环境问题（不是代码 regression）
4. 本地 `/api/health` 通过（gate 5/5）

### 5.2 --no-verify 的命令模式

```bash
# 临时禁用 hook (脚本已内置)
mv .git/hooks/pre-commit .git/hooks/pre-commit.disabled
git commit -m "..."
mv .git/hooks/pre-commit.disabled .git/hooks/pre-commit
```

或 `git commit --no-verify`（已 D065 ADR 允许）。

---

## 6. branch 策略

| 分支 | 用途 | 何时 push 到 GitHub |
|---|---|---|
| `main` | 已发布版本 | ✅ 每次 release |
| `feature/*` | 在开发功能 | 仅当完成且通过 gate |
| `hotfix/*` | 紧急修复 | 立即 |
| `exp/*` | 实验性 | ❌ 不推 |

**关键**：**不要把含 secret 的 commit 推到 GitHub**。本地 fine-grained PAT 测试已证实：
- PAT push（无 write scope）= 失败
- SSH deploy key（read-only）= 失败
- SSH deploy key（Allow write access）= ✅

---

## 7. 当前未推送内容（state at 2026-09-10）

### Stash（未推送也不打算推）

```
stash@{0}: Phase6 B1 work (belongs to feature/sprint2-today):
  - scripts/batch02/33c-b1-run-one.mjs: max_tokens 200 -> 600
  - services/llm.js: single-quote heuristic preprocessing (2026-09-14)
```

**操作**：切到 `feature/sprint2-today` 后 `git stash pop` 恢复，然后在该分支 commit + push。

### Local-only untracked（不推，留作审计记录）

```
.ai/audits/    (9 reports, 2026-09-10 前生成的,有些是 Tier-A 红线 audit)
.ai/decisions/D087, D088
.ai/runbooks/qb-canonical-ingest.md
ai-tutor-architecture-audit-final.json (本会话产物)
ai-tutor-release-manifest-v2..v6.json (本会话审计轨迹)
ai-tutor-release-readiness-2026-09-10.json (原版,含 secret refs,**不要推**)
```

### 已加固的 .gitignore (commit af33d33)

```
/database.tar                (157 MB)
/hermes_pack/                (16 GB)
/lost_exam_pack_2026-09-10/  (672 MB)
/database/incoming/          (1.6 GB)
/database/assets/            (183 MB)
/database/backups/           (137 MB)
/!database/canonical/        (allowlist exception)
/!database/preflight/        (allowlist exception)
/.gitnexus/lbug              (114 MB ladybugdb index)
/.gitnexus/parse-cache/
```

---

## 8. Rollback 已发布版本

```bash
# 看最近 5 commits
git log --oneline -5

# 如果刚推的 commit 有问题, revert
git revert HEAD                   # 创建新 commit 反向操作
git push github HEAD:main         # 推 revert

# 或强推 (危险, 会覆盖历史)
git push github HEAD:main --force-with-lease   # 推荐 (如远端无新 commit)

# 灾难恢复
git reset --hard 88f2a72         # 回到 GitHub 推送前的状态
git push github HEAD:main --force-with-lease
```

**原则**：能用 `revert` 就不要 `reset --hard`。

---

## 9. 紧急联系信息

- GitHub repo: https://github.com/caoxv0255/aitutor
- Deploy key 管理: https://github.com/caoxv0255/aitutor/settings/keys
- 个人 SSH keys: https://github.com/settings/keys
- 本机 SSH key 指纹: `SHA256:znRXBKki9ImE1BGL4z8cQONCMrAcv/nUF/EgcpU96rA`

---

## 10. 一句话总结

```bash
# 95% 的情况只需要:
git commit -m "feat: ..."
scripts/dev/push-github.sh
```

如果 `scripts/dev/push-github.sh` 拒绝，先 `git status` 看原因（多为 uncommitted 改动或无新 commit）。