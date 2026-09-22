# 凭据轮换清单与位置报告

> 生成日期：2026-09-22
> 范围：`/home/flaskappuser/Desktop/NewDisk_2T/aitutor`（git 仓库，382 commits，远端 `origin` = 本地裸仓，`github` = 公共 GitHub）
> 约定：**本报告不粘贴任何明文口令**，只用「前若干位指纹 + 长度 + 位置」定位。
> 处置原则：**只轮换，不重写历史，不 force push**（用户 2026-09-22 明确选择）。

---

## 0. 一句话结论（先看这里）

**当前工作树里仍有 5 处活跃明文凭据，其中 3 处是能直接调用外部付费 LLM 服务的 API Key，且已经推送到公共 GitHub 仓库。**
上一轮（2026-09-21, `e8221b6`）清掉的 16 处历史凭据**只是从代码里移除了，从未轮换**，旧值在 git 对象和 GitHub 上仍然可读。

**最紧急的一步：立刻去各家后台吊销两个 `sk-` API Key**（见 §5 操作清单第 1、2 步）。这两个 key 至今有效、公网可读、按量计费。

---

## 1. 暴露范围（决定了优先级）

| 项目 | 状态 |
|---|---|
| 明文是否已推送到**公共 GitHub** | **是**。`github` 远端 = `https://github.com/caoxv0255/aitutor.git`，`github/main` 为 `6fe9e0d`（2026-09-20） |
| 凭据提交是否在 `github/main` 可达范围内 | **全部是**。已逐一验证 `git merge-base --is-ancestor`：<br>`1026a42` ✅ / `e47462e` ✅ / `62c8d1e` ✅ / `72edbe3` ✅ / `83f2856` ✅ / `de9dcf5` ✅ |
| 清理提交 `e8221b6` 是否已推送 | **否**。本地 `main` 领先 `github/main` 28 个提交 |
| 公共暴露起始时间 | 最早 2026-07-18（postgres 口令、两个 `sk-` key、obsidian token）；OS 口令 2026-07-30 |
| `.env` / `.env.prod` 是否曾入库 | **否**。已验证 `git log --diff-filter=A`：历史中唯一的 `.env*` 文件是 `.env.example`（纯占位模板）。这是本次排查唯一的好消息 |

> ⚠️ 注意：即使把 `e8221b6` 推上去，GitHub 的对象库里旧 blob 依然存在（且可能已被 fork / clone / 第三方索引缓存）。
> **轮换是唯一能让旧值失效的手段。**

---

## 2. 当前工作树残留（真正紧急的部分）

以下 5 项 **现在就能从仓库里读到明文**，且 `scripts/` 下 3 项已确认存在于 `github/main`。

| # | 用途 | 位置 | 类型 | 指纹 | 是否入库 | 优先级 |
|---|---|---|---|---|---|---|
| **L1** | DeepSeek 对话 API 调用（`api.deepseek.com/v1/chat/completions`） | `scripts/test-deepseek.js:3` | 外部 LLM API Key | `sk-22aeb7…`（32 位十六进制） | **已入库，且在 github/main** | **P0** |
| **L2** | 模型列表探测（OpenAI 兼容端点） | `scripts/list-models.js:3` | 外部 LLM API Key | `sk-df8Z1p…`（48 位，字母数字混合） | **已入库，且在 github/main** | **P0** |
| **L3** | GraphRAG 服务 API Key | `scripts/setup_graphrag.sh:41` | 外部 LLM API Key | `sk-df8Z1p…`（**与 L2 同一个 key**） | **已入库，且在 github/main** | **P0** |
| **L4** | JWT 签名密钥兜底默认值 | `docker-compose.design-v2.yml:24` | JWT signing secret | `phase2_fix_verify_jwt…`（字面量硬编码为 `${JWT_SECRET:-...}` 的默认值） | 未入库（untracked） | P1 |
| **L5** | E2E 验证脚本的测试账号口令 | `scripts/dev-verify/screenshot-frontend-loop.mjs:16` | 测试账号口令 | `verifyPass…` | 已入库 | P2 |

### 逐条说明

**L1 / L2 / L3 — 外部 LLM API Key（P0，最高优先级）**

- 三个位置，实际是 **2 个不同的 key**：`sk-22aeb7…`（DeepSeek）与 `sk-df8Z1p…`（出现在 `list-models.js` 和 `setup_graphrag.sh`，同一值）。
- 判为 P0 的理由：能**直接调用外部付费服务**，无需任何中间跳板；`sk-` 前缀的 key 被自动化扫描器（GitHub secret scanning、TruffleHog、各类爬虫）高频抓取，公共仓库里的存活时间通常以**分钟**计。
- 风险后果：额度盗刷 / 被用于违规内容生成导致账号封禁 / 通过 OpenAI 兼容端点探测到关联的其它服务。
- 轮换方式：去对应服务商控制台**吊销**旧 key、签发新 key，写入 `.env` 的 `DEEPSEEK_API_KEY` / `GRAPHRAG_API_KEY`，**不要把新值写回脚本**。

**L4 — JWT 默认密钥（P1）**

- `docker-compose.design-v2.yml:24` 写成 `${JWT_SECRET:-<明文兜底值>}`（指纹 `phase2_fix_verify_jwt…`，完整值见该文件第 24 行，此处不复制）。
- 该文件当前 **untracked**，所以未进入 git 历史 —— 但一旦部署时没有注入 `JWT_SECRET` 环境变量，容器就会用这个字面量默认值为所有登录令牌签名。
- 后果：任何人可伪造任意用户的 JWT（含管理员）。
- 处置：改为无默认值（缺则启动失败），或直接删掉该 fallback。

**L5 — 测试账号口令（P2）**

- `scripts/dev-verify/screenshot-frontend-loop.mjs:16` 的 `TEST_PWD`。
- 若该账号只存在于本地/预发数据库，影响有限；若曾用于生产环境注册，需一并改密。

### 已知非问题（排查过，确认无害）

- CI 工作流（`.github/workflows/*.yml`）中的 `JWT_SECRET: ci-test-secret-key-...`、`DASHSCOPE_API_KEY: test-key` 均为固定假值，真实值走 `${{ secrets.* }}`。
- `deploy/uibe.conf`、`deploy/nginx-gray-cutover.conf` 无凭据。
- `deploy/*.service` 用 `EnvironmentFile=` 指向 `.env`，未内联明文。
- 全仓无 `Authorization: Basic/Bearer <明文>` 内联、无 `*.pem` / `id_rsa` 等私钥文件。
- `database/preflight/*.json` 里的 64 位十六进制串是题库内容 SHA-256 哈希，**不是 token**。

---

## 3. 仅存在于 git 历史（代码已清理，旧值未轮换）

上一轮提交 **`e8221b6`（2026-09-21）`security(scripts): 移除硬编码凭据 + 新增凭据门禁`** 把这些从代码里删掉了，改为读环境变量。
**但旧值从未吊销 —— 它们在 git 对象和 GitHub 上仍然可读。**

共 **16 处**，分 3 组：

### H1 — PostgreSQL 超级用户口令（13 处，即「13 处硬编码明文凭据」的由来）

- 形态：`postgresql://postgres:***@localhost:5432/aitutor`（DSN 内联口令）
- 涉及 13 个文件（全部在 `scripts/`）：

  | 文件 | |
  |---|---|
  | `scripts/batch-parse-papers.js` | `scripts/enhance-question-analysis.js` |
  | `scripts/ingest_local_embedding.py` | `scripts/parse-2024-2025.js` |
  | `scripts/parse-chemistry-2025.js` | `scripts/parse-doc-format.js` |
  | `scripts/parse-doc-retry.js` | `scripts/parse-pdf-pipeline.js` |
  | `scripts/parse-remaining-papers.js` | `scripts/retry-failed-papers.js` |
  | `scripts/retry-missing-papers.js` | `scripts/storage-service.js` |
  | `scripts/test-vector-search.py` | |

- 首次出现：**2026-07-18**（`1026a42`、`e47462e`、`62c8d1e`、`72edbe3`、`83f2856` 等一批批量导入脚本的提交）
- 最后出现 / 移除：**2026-09-21**（`e8221b6`）
- 现况：已改为 `env.PAPERS_DB_URL || env.DATABASE_URL`，缺失时报错退出。
- 优先级：**P1（需先验证）**。代码注释（`scripts/batch-parse-papers.js:415`）称「该口令对现有实例无效」，且本机 `postgres` 角色按记忆**故意不设口令**（`pg_hba` 走 peer）。
  → **请先确认**：历史上这个口令是否曾用于任何仍在线的 DB 实例（如 `localhost:5433`、`aitutor_db`）。若从未生效，此项可降级为 P3「仅记录」；若曾生效，升为 P0。

### H2 — OS 用户口令（2 处）

- 位置：`scripts/push_to_uibe.sh` 的两个 git 远端 URL 常量 `LAN_HTTP` / `PUB_HTTPS`，口令以 URL 编码形式内联。
- 首次出现：**2026-07-30**（`de9dcf5`）；移除：**2026-09-21**（`e8221b6`）
- 现况：改为读 `${LAN_REMOTE:?...}` / `${PUB_REMOTE:?...}`，缺则报错退出。
- 优先级：**P0**。这是**主机/服务的登录口令**，直接等于服务器访问权，且口令同时是 Git 服务（`origin` = `/home/git/repos/aitutor.git`，`github`）的认证凭据。
- 额外暴露面：该口令在本项目此前的**对话记录中被回显过**（含一次误用 `sed` 打印），泄露范围不限于 git。

### H3 — Obsidian 同步 token（1 处）

- 位置：`scripts/sync-knowledge-to-obsidian.js` 的 `API_TOKEN` 常量，64 位十六进制，用于 `Authorization: Bearer`。
- 首次出现：**2026-07-18**（`72edbe3`）；移除：**2026-09-21**（`e8221b6`）
- 现况：改为读 `OBSIDIAN_API_TOKEN` / `SYNC_API_TOKEN`，缺失时报错退出。
- 优先级：**P1**。取决于 Obsidian 同步服务的暴露面；若该 token 还能访问知识库内容，应尽快吊销。

---

## 4. 为什么历史里的明文必须当作已泄露？为什么用轮换替代重写历史？

### 4.1 历史明文 = 已泄露，理由

1. **git 是不可变对象库。** 提交一旦产生，blob 就永久存在于 `.git/objects`。`e8221b6` 只是新增了一个「不含口令」的新版本，**没有删除旧 blob** —— `git show 1026a42:scripts/parse-pdf-pipeline.js` 至今能把口令打出来。
2. **已经推送到远端。** 这些提交都在 `github/main` 可达范围内（§1 已逐一验证）。任何 clone 过该仓库的人都持有一份完整历史，包括 fork、CI 缓存、镜像站、代码搜索索引。
3. **自动化扫描是即时的。** `sk-` 这类高识别度前缀会被 GitHub secret scanning 与第三方爬虫在推送后极短时间内捕获并进入公开索引/暗网数据集。**「没人注意就是没泄露」是错误假设。**
4. **泄露窗口已经很长。** 最早 2026-07-18 起算，到本报告已超过两个月。
5. **处置只改了「新增」，没撤销「既有」。** 改成读环境变量是正确的防新增措施，但对已泄露的旧值没有任何效力。

### 4.2 为什么不重写历史（用户已选，这里补充理由）

| 重写历史（`filter-repo` / `BFG` + force push） | 轮换 |
|---|---|
| 只影响你这一份 clone；**已推送的 GitHub 对象、他人 clone、fork、缓存全部不受影响** | 旧值在服务端失效，**无论有多少份副本都无害** |
| force push 会**打断另一个正在提交的 worker**，可能覆盖其改动 | 无协作风险 |
| 重写 382 个提交的 SHA，**所有本地未推送工作、tag、PR、CI 缓存全部失效** | 不动历史，协作不受影响 |
| 即使重写成功，旧对象仍可能通过 GitHub API（`refs/pull/*`、unreferenced object）访问 | —— |
| 工程量与回滚风险都高 | 各家后台点几下的事 |

**结论：轮换是唯一真正收敛风险的动作；重写历史在这个场景下是无效的高风险操作。**
轮换完成后，git 历史里的那串字符就退化成「一段无意义的随机字符串」，与公开一个失效的验证码等价。

---

## 5. 操作清单（按依赖顺序，照着做）

> 顺序原则：先断外部扣费入口 → 再断主机登录 → 再断数据/同步 → 最后补模板与门禁。
> 每一步做完在右侧勾选框打勾。

### 阶段 A：立即（今天）—— 切断活跃的外部付费/登录入口

- [ ] **A1. 吊销 `sk-df8Z1p…`（GraphRAG / OpenAI 兼容端点）**
      去该 key 的签发平台控制台 → API Keys → Revoke。
      同时影响 `scripts/list-models.js` 与 `scripts/setup_graphrag.sh`（同一个 key）。
      签发新 key 后只写入 `.env`：`GRAPHRAG_API_KEY=<新值>`。

- [ ] **A2. 吊销 `sk-22aeb7…`（DeepSeek）**
      DeepSeek 开放平台 → API Keys → 删除。
      新 key 写入 `.env`：`DEEPSEEK_API_KEY=<新值>`。

- [ ] **A3. 轮换 OS 用户口令**（`flaskappuser`，本机 + 任何用同一口令的主机/服务）
      `passwd flaskappuser`
      然后更新所有嵌入该口令的 git 远端 URL（`LAN_REMOTE` / `PUB_REMOTE`），以及任何记住凭据的 `git credential` 存储：`git credential reject`。
      ⚠️ 换 OS 口令会影响 SSH/sudo/其它自动化任务，先确认没有脚本依赖旧口令做免密。

- [ ] **A4. 吊销 Obsidian 同步 token**
      在 Obsidian 同步服务端吊销旧 token；新 token 写入 `.env`：`OBSIDIAN_API_TOKEN=<新值>`。

### 阶段 B：验证与收尾（本周）

- [ ] **B1. 验证 H1 的 postgres 口令是否曾对任何在线实例生效**
      检查 `localhost:5432` / `localhost:5433` / `aitutor_db` 各实例的 `pg_hba.conf` 与角色口令。
      - 若从未生效 → 记录为 P3，仅归档。
      - 若曾生效 → 立即改密，并同步 `.env` 的 `DATABASE_URL` / `PAPERS_DB_URL` 与 `docker-compose.yml` 的 `POSTGRES_PASSWORD`。

- [ ] **B2. 去掉 JWT 密钥兜底默认值**
      `docker-compose.design-v2.yml:24` 的 `${JWT_SECRET:-phase2_fix_verify_jwt_secret_...}` → 改为无默认值，缺失即启动失败。
      同时确认**当前生产环境的 `JWT_SECRET` 不是这个值**；若是，生成新值（`openssl rand -hex 32`）并轮换（会使所有已登录用户登出，安排在 low-traffic 时段）。

- [ ] **B3. 处理测试账号口令（L5）**
      确认 L5（`verifyPass…`，完整值见 `scripts/dev-verify/screenshot-frontend-loop.mjs:16`）对应的账号是否只存在于本地/预发；
      如涉及生产账号则改密，并把该脚本改为从环境变量读取。

- [ ] **B4. 收紧 `docker-compose` 的弱默认口令**
      `docker-compose.yml:17,54` 的 `aitutor_password` 是字面量默认值。若生产曾用 compose 原样部署，这就是真实的 DB 口令 → 改掉并改读 `${POSTGRES_PASSWORD}`（无默认值）。

### 阶段 C：防复发（完成后）

- [ ] **C1. 用新模板重填 `.env` / `.env.prod`**（见 §6）
- [ ] **C2. 修 `scripts/check-no-hardcoded-secrets.mjs` 的三个漏网口径**（见 §7）—— 必须做，否则同类 key 会继续溜过门禁
- [ ] **C3. 在 GitHub 仓库开启 secret scanning / push protection**
- [ ] **C4. 复核** `git log -S` 历史里没有新类型的凭据遗漏（建议季度一次）

---

## 6. 模板与 `.gitignore` 加固（本次已改）

### 已改动

1. **`.gitignore`** — 新增规则，堵住验证出来的漏洞：

   | 之前 | 之后 |
   |---|---|
   | 只忽略 `.env` / `.env.local` / `.env.*.local` / `.env.*.bak` / `.env.prod` | 改为忽略 `.env.*` 并 `!.env.example` 放行模板 |
   | `.env.staging` / `.env.uat` / `.env.production` **不被忽略** ✅实测 | 全部忽略 |
   | `*.pem` / `*.key` / `id_rsa` / `secrets.json` **不被忽略** ✅实测 | 全部忽略 |

2. **`.env.example`** — 补上轮改造后新引入但模板里缺失的变量：`PAPERS_DB_URL`、`OBSIDIAN_API_TOKEN`、`LAN_REMOTE` / `PUB_REMOTE`、`GRAPHRAG_API_KEY`、`MINIMAX_API_KEY`、`OLLAMA_API_KEY`。
   同时补一段「轮换须知」，把本报告的路径写进模板，避免下一个人重新踩坑。

### 仍需人工完成

- 用 `cp .env.example .env` 重新生成，并**逐项填真值**（旧 `.env` 里的值可能已过期）。
- 已存在的 `.env` / `.env.prod` 从未入库（§1 已验证），无需额外处理。

---

## 7. 门禁脚本的漏网口径（重要，需另行修复）

`scripts/check-no-hardcoded-secrets.mjs` **当前对本次发现的 3 个 `sk-` key 全部放行**（已实测：脚本输出 `✓ 未发现硬编码凭据`，退出码 0）。
本轮按约束未改动该脚本，在此记录三个原因：

1. **`PLACEHOLDER` 正则把 `sk-` 当占位符**（`scripts/check-no-hardcoded-secrets.mjs:33`）
   ```js
   const PLACEHOLDER = /^(change_?me|...|dummy|sk-|pk_)/i;
   ```
   本意是排除 `sk-xxxxxxxx` 这种占位写法，结果把**所有真实 `sk-` key 一并排除**。
   应改为只排除「`sk-` 后面全是同一字符或纯 `x`」的占位形态，例如 `^sk-[xX*]{6,}$`。

2. **赋值正则要求引号**（同文件 `:32`）
   ```js
   const ASSIGN = /(?:password|...|api_?key)\s*[:=]\s*['"]([^'"]{6,})['"]/gi;
   ```
   `scripts/setup_graphrag.sh:41` 的 `GRAPHRAG_API_KEY=sk-df8Z...` **没有引号**，直接不匹配。
   应放宽为 `['"]?` 并额外排除 shell 变量引用 `${...}` / `$VAR`。

3. **`SKIP_DIRS` 含 `dev-verify`**（同文件 `:25`）
   `scripts/dev-verify/screenshot-frontend-loop.mjs` 整个目录被跳过，L5 因此不可见。
   建议移除该跳过项，改为靠 PLACEHOLDER 规则过滤噪声。

> 建议把「修复门禁」单独开一个提交，并补一条回归用例：把本节 3 个真实形态（带引号 `sk-`、不带引号 `sk-`、`dev-verify` 目录内）做成夹具，断言门禁**必须报错**。

---

## 8. 附：本次排查的复核命令（只读，可重复执行）

```bash
# 工作树：连接串内联口令
grep -rnEi '(postgres(ql)?|mysql|mongodb|redis|amqp)://[^:]+:[^@]+@' --include='*.js' --include='*.py' --include='*.sh' --include='*.yml' .

# 工作树：明文赋值
grep -rnEi '(password|passwd|pwd|secret|token|api_?key)\s*[:=]\s*['"'"'"][^'"'"'"'${}\s]{12,}['"'"'"]' .

# 工作树：高识别度前缀 key
grep -rnEo 'sk-[A-Za-z0-9]{16,}|ghp_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{10,}' .

# 历史：哪些提交引入/删除过某凭据（只读）
git log --all --format='%h %ad %s' --date=short -S'<pattern>' --pickaxe-regex --name-only

# 历史：某提交是否已推送到公共远端（只读）
git merge-base --is-ancestor <commit> github/main && echo IN || echo NOT_IN

# 确认 .env 类文件从未入库
git log --all --oneline --diff-filter=A --name-only | grep -E '^\.env' | sort -u
```

---

## 9. 汇总数字

| 分类 | 条目数 |
|---|---|
| **工作树现存明文（活跃）** | **5**（L1–L5） |
| 　其中 P0 | 3（L1/L2/L3，实为 2 个不同的 key） |
| **仅存在于 git 历史（代码已清理、旧值未轮换）** | **16 处**（H1: 13 + H2: 2 + H3: 1） |
| **已确认推送到公共 GitHub 的** | L1、L2、L3、L5、H1、H2、H3 |
| 从未入库（安全） | `.env`、`.env.prod` |
