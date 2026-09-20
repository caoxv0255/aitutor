# aitutor 架构评审（2026-09-20）

**评审范围**：仓库整体架构 —— 后端 / 前端 / 部署 / 数据 / 脚本 / 测试 / 可观测 / 仓库卫生
**方法**：只读实测，命令与实测值见 §5；本次评审**不修改任何代码**
**状态**：分析完成。§3 的 10 项优化方向**均未实施**；其中第 5 项（legacy `frontend/` 去留）待负责人拍板，其余 1–4 项可直接开工

---

## 0. 一句话结论

**功能架构成型、工程架构在腐烂。**

Hybrid RAG 三方案 + 数据飞轮的领域设计是清晰的；但"仓库层面"的一致性已经出现结构性裂缝：**一次 `git clone` 之后，F3 的 11 个 tracked 页面会因 barrel 解析失败而全部打不开**（原因见 R1）。当前最大的架构风险不是"选错了技术"，而是**四套前端/部署变体并行 + 运行时闭包未入库 + 工作区噪音淹没真实改动**。

---

## 1. 现状画像（实测）

| 层 | 实测 | 评价 |
|---|---|---|
| 后端 | `server.js` 448 LOC + `api/` 22,017 LOC / 97 files（handlers 8,986/43、routes 3,657/7、services 2,742/7、utils 2,049/10、modules 1,996/16、core 1,995/8） | 三层路由并存，边界模糊 |
| 前端 | **3 套在库**：`ai-tutor-frontend`(F3, 3.9M) / `frontend`(legacy, 3.4M) / `public`(PWA, 1.8M)；**外加 design-v2** 部署变体 | 31 个同名页面在两棵树里 |
| 部署 | 3× `docker-compose*.yml`、3× `Dockerfile*`、2× `server*.js`、2× `playwright.config.*`、3× systemd unit | 变体爆炸 |
| 数据层 | `database/` **8.7 GB / 420,728 文件**（preflight 6.6G、incoming 1.7G） | 管线 scratch 与真源混放 |
| 脚本 | `scripts/` **319 个文件**（.js 132 / .mjs 82 / .py 56 / .sh 21 / .cjs 12） | 无目录约定，已在 OpenWiki backlog 挂账 |
| 测试 | 31× `*.test.js` + 8× `*.spec.*`；contract/BCT；gate 5 项 | 骨架不错，缺覆盖率闸门 |
| 可观测 | `ai_trace` + traceId 中间件已落地；`monitoring/` 仅 2 个文件 | 埋点有，聚合/告警没有 |
| 仓库卫生 | `git status` **203 条**；`.git` 目录 2.8G（pack 1.22 GiB，另有 loose/garbage） | 噪音淹没信号 |

---

## 2. 关键风险（有机械证据）

### R1 · 干净 clone 跑不起来（不可逆）— 最严重

`git status` 里有 **24 个未跟踪的 `.js/.mjs/.cjs`**（完整清单见 §6），其中 **4 个被 tracked 文件在运行时引用**：

| 未跟踪资源 | tracked 运行时引用方 |
|---|---|
| `frontend/assets/js/auth-nav.js` | `frontend/login.html:124`、`frontend/register.html:86`（`<script src>`） |
| `frontend/assets/js/components/emptyState.js` | `frontend/learning-path.html:493`、`frontend/wrong-book.html:55`（`<script src>`） |
| `ai-tutor-frontend/assets/js/api/services/loop.js` | `ai-tutor-frontend/assets/js/api/services/index.js:23`（ESM re-export） |
| `ai-tutor-frontend/assets/js/api/services/essay.js` | `ai-tutor-frontend/assets/js/api/services/index.js:21`（ESM re-export） |

**后半项比前半项严重得多**：`services/index.js` 是 F3 的 barrel，被 **11 个 tracked 页面** import（`cross-subject` / `exam-simulation` / `login` / `mastery` / `register` / `review` / `student-progress` / `teacher-dashboard` / `tutor` / `vision` / `wrong-book`）。ESM 解析缺失的 re-export 目标会直接抛错，**barrel 一挂，这 11 个页面全挂**。

**含义**：生产上跑着的前端，其运行时闭包**不在 git 里**。工作区一丢，这些页面永久性损坏。这是 memory 里"真实风险是已跑进库的管线脚本还留在 untracked"的升级版 —— 现在不只是脚本，**是运行时资产**。`103865d`（"补齐未入库的运行时闭包"）只补了一部分。

### R2 · 前端多副本并行编辑

`frontend/` 在 `.ai/context.md` 里被声明为"已冻结，只读"，但：

- 两棵树 **31 个同名 HTML**，且 `wrong-book`(187 vs 1372 LOC)、`mastery`(237 vs 1175)、`dashboard`(614 vs 1336) 已**实质性分叉**；
- 工作区 203 条变更里 **62 条落在两棵前端树上**（`frontend/` 30 + `ai-tutor-frontend/` 32），其中 **3 个同名页面在两棵树里同时被改**（`mastery.html` / `review.html` / `wrong-book.html`）；
- `185ac5b feat(frontend): D093 Design System` **同时改了 `frontend/` 和 `ai-tutor-frontend/`** —— 说明"冻结"没有任何机制保障，设计系统改动被人工同步了两遍。

再叠加 `server-design-v2.js` / `Dockerfile.design-v2` / `docker-compose.design-v2.yml` / `deploy/nginx-gray-cutover.conf` / `deploy/uibe-design-v2.service`，等于**第 4 个前端变体**在灰度和生产并存。

### R3 · 后端三层路由与重复路径

`api/handlers`(server.js 直挂) + `api/routes` + `api/modules` 三套约定；路径字面量重复 **17 处**：`/stats`×4、`/subjects`×3、`/search`×3、`/mastery`、`/questions`、`/papers`、`/explain`、`/ask`、`/reports`… 各×2。重复挂载点是"改对了 A 忘了 B"的温床。`scripts/release-gate.sh:103` 的直挂端点闸门（≤12）说明已经有人踩过。另有 `api/services/`(7 files) 与顶层 `services/`(5 files) 两个同名目录并存，加深分层歧义。

### R4 · D079 边界未闭环（成本极低、可立刻修）

ADR D079 §2.4/§9 明文要求 `.dockerignore` 排除 `.ai/`、`openwiki/`、`.claude/`、`.gitnexus/`。实测 `.dockerignore:34-36` 只有 `.claude/`、`.aider*`、`.gitnexus/` —— **`.ai/` 和 `openwiki/` 缺失**（2026-09-20 复测仍缺失），且 CI 里没有对应的验证步骤。这是一个**已记录但未执行的合规缺口**。

### R5 · 质量闸门被债务侵蚀

ESLint 实测 **3162 errors + 146 warnings（共 3308 problems，144 文件）**，而文档基线是 2445 —— 债务在涨，没有 ratchet 机制。`.ai/context.md:165` 说"不改既有债务"，但没有机制阻止它增长。

### R6 · 工作区噪音 / 数据与代码混放

`database/preflight` 6.6G、`incoming` 1.7G、`docs/design` 80M（**全部未跟踪**，`git ls-files docs/design` 返回 0）与真源混在同一棵树。后果：`git status` 203 条里绝大多数是噪音，**真改动看不见** —— 这是所有其他风险被延迟发现的元凶。另外 git 对象库里还躺着 `.git/objects/0d/tmp_obj_*` 之类的 garbage 与一次性产物。

---

## 3. 优化方向（按 收益率/成本 由高到低）

> 收益 = 风险消除 × 可验证性；成本 = 人时 + 引入风险。前 4 项加起来 < 1 人天。

| # | 方向 | 成本 | 收益 | ROI |
|---|---|---|---|---|
| **1** | **补齐运行时闭包入库 + gate 加"引用存在性"检查** | 1–2h | 消除不可逆丢失；恢复可克隆性 | ★★★★★ |
| **2** | **`.dockerignore` 补 `.ai/`+`openwiki/`，CI 加 D079 边界校验** | 15min | 关闭已记录合规缺口；缩小构建上下文 | ★★★★★ |
| **3** | **工作区去噪**：`preflight`/`incoming`/`docs-design`/`tmp-*` 明确进 gitignore 或移出仓库 | 1–2h | 让 203→可见的少数真改动；消除误提交 | ★★★★★ |
| **4** | **删冗余变体配置**：双 playwright config、`uibe.conf.bak.*`、`__pycache__`；统一 lint 入口 | 30min | 消除歧义 | ★★★★☆ |
| **5** | **给 legacy `frontend/` 加机械护栏**（CI 禁改 + 明确 /legacy 只读），并决定 design-v2 去留 | 0.5–1d | 终止 62 文件双写分叉 | ★★★★☆ |
| **6** | **后端路由收敛路线图**：封新增（handlers 只减不增）→ 按重复路径清单逐个迁 modules | 3–5d | 消除 17 处重复挂载、恢复可预测性 | ★★★☆☆ |
| **7** | **按热区（非行数）拆分超长文件**：`api/core/db.js` 997、`api/services/visionSearchService.js` 912、`api/routes/rag-search.js` 905、`api/routes/tutor-agent.js` 770、`services/llm.js` 704 | 2–4d | 可测性/可维护性 | ★★★☆☆ |
| **8** | **ESLint ratchet**：引入 baseline 文件，只允许下降不允许上升 | 0.5d | 止血 3162 errors 增长 | ★★★☆☆ |
| **9** | **可观测落地**：`ai_trace` → 指标聚合 + Sentry 实接 + 看板 | 2–3d | 生产可观测性 | ★★☆☆☆ |
| **10** | **`scripts/` 编目归档 + git 历史瘦身**（filter-repo 移除 21MB 级 blob） | 2–3d（高风险） | 仓库体积/清晰度 | ★☆☆☆☆ |

### 为什么是这个顺序

**1–4 的共同点：机械可验证、零架构决策、当天见效。** 它们不改任何领域逻辑，只把"仓库真实状态"和"声明的状态"对齐。第 3 项尤其关键 —— 它是 1、4 的**前置**：不先降噪，就无法可靠判断哪些是"真改动"。

第 5 项是**唯一需要拍板的**：`frontend/` 是真冻结（则加护栏、停止双写、清理 31 个副本），还是仍在并行维护（则撤销"冻结"声明、改走共享组件）？现状两者都不是 —— **声明冻结但实际双写**，这是最坏组合。

第 6、7 项应当**跟着业务热区走**，不要为了"架构整洁"做全量迁移 —— `.ai/context.md:52` 的红线（"不要重构后端"）依然成立。只对"下次要改的模块"做收敛。

第 10 项 ROI 最低：历史瘦身需要 `filter-repo` + 全员重新 clone，属于高破坏性操作，除非仓库体积成为真实痛点，否则**不做**。

### 明确不建议做

换前端框架、换数据库、拆微服务、引入 agent swarm —— 与 `.ai/context.md:52-57` 的红线一致，当前没有任何证据支持这些投入的收益。

---

## 4. 建议的第一步（可直接开工）

只做 **1 + 2**，两步都可机械验证：

1. 把 4 个**运行时缺口**资产（`auth-nav.js`、`emptyState.js`、`loop.js`、`essay.js`）连同其余未跟踪代码文件入库，并在 `scripts/release-gate.sh` 增加第 6 项：**"tracked 文件引用的本地资源必须全部 tracked"** —— 把这次的人工发现变成永久闸门。（§6 清单已按"硬运行时缺口 / 仅文档引用 / 孤儿"三档分类，可据此决定哪些入库、哪些删除。）
2. `.dockerignore` 补两行 `.ai/`、`openwiki/`，并在 `.github/workflows/release-gate.yml` 加 D079 §9 的校验。

---

## 5. 复现命令与实测值（2026-09-20）

```bash
# R1 未跟踪代码文件
git status --porcelain | grep '^??' | sed 's/^?? //' | grep -E '\.(js|mjs|cjs|ts)$'   # → 24

# R1 运行时引用是否存在
git ls-files --error-unmatch frontend/assets/js/auth-nav.js        # → 报错 = UNTRACKED
grep -n 'auth-nav' frontend/login.html frontend/register.html       # → 124 / 86 行 <script src>
sed -n '21,23p' ai-tutor-frontend/assets/js/api/services/index.js   # → essay.js / loop.js re-export
git grep -lF 'services/index.js' -- '*.js' '*.html' | wc -l         # → 18 (含 test/自身), tracked 页面 11

# R1 反例（避免误判）：这些不是运行时引用
grep -n 'auth-nav' frontend/assets/js/components.js server.js       # → 均在注释里
grep -n 'loop\.js' api/routes/learning-loop.js                      # → 实为 learning-loop.js 子串
sed -n '13,14p' vitest.config.js                                    # → 在 exclude[]，未跟踪不会致 vitest 失败

# R2 前端多副本
du -sh ai-tutor-frontend frontend public                            # → 3.9M / 3.4M / 1.8M
comm -12 <(find frontend -name '*.html' -printf '%f\n'|sort -u) \
         <(find ai-tutor-frontend -name '*.html' -printf '%f\n'|sort -u) | wc -l   # → 31 同名 HTML
git status --porcelain | sed 's/^...//' | grep -c '^frontend/'                     # → 30
git status --porcelain | sed 's/^...//' | grep -c '^ai-tutor-frontend/'            # → 32
git status --porcelain | sed 's/^...//' | grep -E '^(frontend|ai-tutor-frontend)/' \
  | awk -F/ '{print $NF}' | sort | uniq -d              # → mastery.html review.html wrong-book.html

# R4 D079 边界
grep -n '\.ai/\|openwiki' .dockerignore                             # → 无匹配（缺失）

# R5 ESLint
npm run lint 2>&1 | tail -3                                         # → 3308 problems (3162 errors, 146 warnings)

# R6 仓库卫生
git status --porcelain | wc -l                                      # → 203
du -sh database database/preflight database/incoming                # → 8.7G / 6.6G / 1.7G
find database -type f | wc -l                                       # → 420728
du -sh docs/design ; git ls-files docs/design | wc -l               # → 80M / 0

# 其它画像数字
wc -l server.js                                                     # → 448
find api -name '*.js' -exec cat {} + | wc -l ; find api -name '*.js' | wc -l   # → 22017 / 97
find scripts -type f | wc -l                                        # → 319
find tests -name '*.test.js' | wc -l ; find tests -name '*.spec.*' | wc -l      # → 31 / 8
git count-objects -vH | grep size-pack                              # → 1.22 GiB
wc -l api/core/db.js api/services/visionSearchService.js \
       api/routes/rag-search.js api/routes/tutor-agent.js services/llm.js       # → 997 / 912 / 905 / 770 / 704
find api -type d -name services ; ls -d services                    # → api/services 与顶层 services/ 并存
```

---

## 6. 附录 A：未跟踪代码文件清单（24）

分类口径：**A** = 被 tracked 的 HTML/JS 在运行时直接加载或 re-export，缺了会坏；**B** = 只被文档/注释/清单文本提到；**C** = 无任何 tracked 引用。

### A. 硬运行时缺口（4）— 建议优先入库

| # | 文件 | tracked 引用点 |
|---|---|---|
| 1 | `frontend/assets/js/auth-nav.js` | `frontend/login.html:124`、`frontend/register.html:86` |
| 2 | `frontend/assets/js/components/emptyState.js` | `frontend/learning-path.html:493`、`frontend/wrong-book.html:55` |
| 3 | `ai-tutor-frontend/assets/js/api/services/loop.js` | `ai-tutor-frontend/assets/js/api/services/index.js:23` |
| 4 | `ai-tutor-frontend/assets/js/api/services/essay.js` | `ai-tutor-frontend/assets/js/api/services/index.js:21` |

### B. 仅文档/注释/清单引用（12）— 说明"已声明但未入库"，不构成运行时缺口

| # | 文件 | 引用来源 |
|---|---|---|
| 5 | `ai-tutor-frontend/assets/js/components/essay-anchor-highlight.js` | `.ai/decisions/D086-essay-v1.md` |
| 6 | `ai-tutor-frontend/assets/js/components/essay-annotation-card.js` | `.ai/decisions/D086-essay-v1.md` |
| 7 | `ai-tutor-frontend/assets/js/hooks/useEssayFlow.js` | `.ai/decisions/D086-essay-v1.md` |
| 8 | `ai-tutor-frontend/assets/js/utils/safe-text.js` | `.ai/decisions/D086-essay-v1.md` |
| 9 | `tests/e2e/essay-v1.spec.cjs` | `.ai/decisions/D086-essay-v1.md` |
| 10 | `tests/integration/essay-v1-bct.mjs` | `.ai/decisions/D086-essay-v1.md` |
| 11 | `scripts/td-005/phase3-reextract-stems.mjs` | `scripts/td-005/phase4-prevent-regression.mjs:120`（字符串清单） |
| 12 | `scripts/td-005/phase3-rollback-bad.mjs` | `.ai/decisions/TD-005-batch02-null-file-path.md` |
| 13 | `scripts/td-005/phase3-validate.mjs` | `.ai/decisions/TD-005-batch02-null-file-path.md` |
| 14 | `server-design-v2.js` | `server.js:123`（注释）— 第 4 个 server 变体，实际是孤儿 |
| 15 | `tests/loop-endpoints.test.js` | `vitest.config.js:13`（**exclude** 列表，非 include） |
| 16 | `tests/e2e/design-quality.test.js` | `vitest.config.js:14`（**exclude** 列表，非 include） |

### C. 无 tracked 引用（8）— 需逐个判断"删除 or 入库"

| # | 文件 |
|---|---|
| 17 | `frontend/assets/js/components/coach-mark-v1.js` |
| 18 | `scripts/batch02/33d-b1-run-batch.mjs` |
| 19 | `scripts/batch02/33e-b1-merge-and-report.mjs` |
| 20 | `scripts/e2e-deployment-test.js` |
| 21 | `tests/e2e/_dbg3.test.cjs` |
| 22 | `tests/e2e/coach-mark.spec.cjs` |
| 23 | `tests/e2e/empty-state-integration.spec.cjs` |
| 24 | `tests/e2e/learning-path.spec.cjs` |

> 注 1：`essay.html` / `practice-hub.html` 等**页面本身**也未跟踪（不在本清单，本清单只统计代码文件），因此 Essay 功能的运行时闭包是"整条链都不在 git 里"。
> 注 2：C 档里 `tests/e2e/*.spec.cjs` 多为 playwright 用例，被 `playwright.config.cjs` 以目录 glob 收集 —— glob 不构成"文件级引用"，故仍归 C。

---

## 7. 附录 B：本文档相对首轮口头评审的修正

首轮评审（2026-09-20 对话）结论与排序不变，以下三处按机械复测结果**收紧了口径**，避免文档与事实两套口径：

1. **"被 tracked 引用"需区分运行时与注释**：首轮 R1 表里的引用计数偏高 —— `components.js:105`、`server.js:127` 对 `auth-nav.js` 的提及都在**注释**里；`loop.js` 的 26 个文本命中里绝大多数是 `learning-loop.js` 的**子串误匹配**或文档描述。收紧后硬运行时缺口恰为 **4 个**（与首轮表一致），但计数应为 2/2/1/1 而非 3/2/4/1。
2. **`tests/loop-endpoints.test.js`、`tests/e2e/design-quality.test.js` 不是缺口**：它们在 `vitest.config.js` 的 `exclude[]` 里（"手动跑"/"需 design server"），未跟踪不会让 `npm run gate` 变红。
3. **严重度上调**：`services/index.js` 是 11 个 tracked F3 页面的 barrel，缺 `essay.js`/`loop.js` 会让 barrel 解析失败 → **11 页全挂**，不止首轮说的"登录页"。
4. **措辞纠正**：首轮"62 个文件同时落在两棵树上"有歧义 —— 实测是"两棵前端树合计 62 条工作区变更（30+32）"，两棵树里**同名同时被改**的只有 3 个（`mastery.html`/`review.html`/`wrong-book.html`）。§2 R2 已按后者改写。

另：画像数字按 2026-09-20 复测更新 —— `api/` 22,017 LOC、`scripts/` 319 文件、`tests` 31 test + 8 spec（首轮口头数字 21.9k / 291 / 36+8 与此有口径与时点差异）。
