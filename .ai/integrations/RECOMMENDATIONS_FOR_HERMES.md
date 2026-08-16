# Recommendations for Hermes — 来自外部 harness (DeepSeek) 的视角

> **目的**: 本文档从 aitutor 项目的外部 DeepSeek harness 视角，给 Hermes 项目本身提产品/架构建议。
> 它不是协议（那是 [`INTEGRATION_WITH_HERMES.md`](INTEGRATION_WITH_HERMES.md) 的工作），
> 而是"如果我是 Hermes 的设计者，我会怎么想"的思考记录。
>
> **读者**: Hermes 的设计者/维护者。
>
> **日期**: 2026-08-15

---

## 1. 战略定位：Hermes 应是"协议"而非"工具"

**观察**: 现在市场上已有通用 AI agent 工具（Claude Code / Cursor / DeepSeek 等），如果 Hermes 也做通用 TUI 界面，会陷入同质化竞争。

**建议**: Hermes 的护城河 = **"AI Memory Schema" 成为行业协议**。

类似：
- **MCP** (Model Context Protocol, Anthropic) — 工具调用协议
- **Skills** (Anthropic) — agent 能力描述
- **AGENTS.md** (社区) — 项目级 agent 入门

**具体**:
- 定义 `.ai/` 目录结构标准（context.md / decisions / status / agents / runbooks / integrations）
- 定义 status YAML schema（`schema_version` + `generated_at` + 业务字段 + `alerts[]`）
- 定义 envelope 契约（`{success, data}` 风格）
- **任何** AI agent 都能消费这套 schema——Hermes 不是唯一受益者

**结果**: Hermes 从"一个 TUI"变成"AI 工程层的协议标准"——生态地位远比工具本身值钱。

---

## 2. TUI 定位：从"通用界面"到"项目 dashboard 渲染器"

**现在**(我猜):
```
╭──── Hermes Console ────╮
│ 输入任务...
│ 状态: thinking...
╰────────────────────────╯
```

**建议**(你画的 mock 就是对的):
```
╭──── aitutor Agent Console ────╮
│ Release: v0.8.0-engineering
│ Tests: 241/241
│ BCT: 19/19
│ Docker: healthy
│ RAG: vision ✅ embedding ✅ pgvector ✅ AGE ✅ LLM ✅
│ ⚠️ P0: 3 项
│ Recent: phase-4-engineering (59 files)
╰────────────────────────────────╯
```

**价值对比**:
- 通用 TUI: 任何项目都长一样，需要用户解释项目状态
- Dashboard 渲染器: 直接读 `.ai/status/*.yaml`，**用户一打开就知道项目在哪**

**实现**:
- Hermes 进入项目 → 自动 `ls .ai/status/*.yaml`
- 渲染层 = YAML → TUI (简单的 parser 即可)
- **不依赖** docker / git / DB 直接调用（避免耦合）

---

## 3. aitutor 数据源协议（已实现，可作模板）

我已经在 aitutor 实现了 7 个 status YAML + emit-status.sh + hermes-consume-test.cjs。

**这套可以提取成 Hermes 的标准**:

```
.ai/status/
├── version.yaml           # git: head/commit/diff status
├── gate-status.yaml       # 最近 gate 结果 (vitest/contract/BCT/...)
├── docker-health.yaml     # 容器健康
├── rag-components.yaml    # 业务组件健康 (RAG 4 层)
├── database.yaml          # schema 状态
├── recent-runs.yaml       # 最近 agent runs
└── backlog.yaml           # P0/P1/P2 待办
```

**Hermes 标准化的 3 步**:
1. 文档化 schema（已写在 aitutor 的 INTEGRATION_WITH_HERMES.md §3，可提取）
2. 提供 emit 工具参考（aitutor 的 emit-status.sh 可作 template）
3. 提供 consume 工具参考（aitutor 的 hermes-consume-test.cjs 0 依赖 yaml parser）

**给 Hermes 的建议**:
- 提供 `hermes-init` 命令: `hermes init /path/to/project` 自动建 `.ai/` 骨架
- 提供 schema validator: `hermes validate /path/to/.ai/status/` 校验所有 YAML schema
- 提供 dashboard generator: `hermes dashboard --project aitutor` 输出 TUI 友好文本

---

## 4. 多 agent 协作 = 角色化 token 优化

**当前问题**: AI agent 进入项目**全文加载**所有文档 → token 爆炸

**建议** (aitutor 已落地):
```
.ai/agents/
├── coding.md    # 改后端/前端时读
├── review.md    # PR 审查时读
├── testing.md   # 写/跑测试时读
└── migration.md # DB 变更时读
```

每个角色读**自己需要的子目录**，**不读**不相关的。

**Hermes 应该支持**:
- `hermes role coding <project>` — 自动只 load `.ai/agents/coding.md` + `.ai/runbooks/` + 相关 decisions
- `hermes role review <project>` — 只 load `.ai/agents/review.md` + `.ai/decisions/` + `.ai/known-bugs.md`
- **不要** load architecture（除非审查性能）

**token 节省**: 通常 60-80%（一份完整 .ai/ 上下文 3000+ 行 → 角色化 600 行）。

---

## 5. Gate 协议 = agent 写代码的"合同"

**观察**: Hermes 调度 agent 改代码，但 agent 改完直接 commit → 没有质量门禁。

**建议**: Hermes 与项目 gate 协议集成:
```
Hermes 调度 agent 改代码
   ↓
agent 改完本地跑 npm run gate (or project-specific gate)
   ↓ 失败 → 回退 + 修
   ↓ 通过 → agent 调用 emit-status.sh 刷新 .ai/status/
   ↓
Hermes TUI 拉新 status 显示 ✅
   ↓
agent commit + push
```

**Hermes 可提供**:
- 标准 gate 命令名（`hermes gate`）→ 委托给项目自己的 gate 脚本
- gate 失败的语义化错误提示（让 Hermes TUI 能展示）
- 自动 commit + push（如果用户授权）

**aitutor 已实现**: `npm run gate` (5 项) + pre-commit hook 焊死。Hermes 只需识别这个模式。

---

## 6. 未来扩展方向（基于 aitutor 实践）

如果 Hermes 成为协议标准，可自然化生长:

### 6.1 ai_trace 集成

aitutor 准备建 `ai_trace` 表（vision/embedding/rag/llm 各阶段耗时 + 检索文档 + token）。**Hermes 可消费**这个 trace 做:
- TUI 显示"为什么答错"（OCR 95% 准 → 向量召回 3 个 → 图谱缺二级关系 → LLM 幻觉）
- 按 trace 找最慢链路，建议优化

### 6.2 数据质量流水线

aitutor 准备建 `scripts/data-quality/` 4 个 check。Hermes 可:
- 每天定时跑，emit 到 `backlog.yaml` 的 alerts
- TUI 顶部显示红色告警

### 6.3 安全/性能扫描

`npm audit` / Lighthouse / Sentry — Hermes 可统一调度，emit 到 `.ai/status/security.yaml` 等。

### 6.4 跨项目聚合

Hermes 可管理**多个项目**（aitutor + 别的），统一 dashboard:
```
╭──── Hermes Multi-Project Console ────╮
│ aitutor        v0.8 ✅ 241/241  ✅
│ project-x      v1.2 ⚠️  89/95  🔴 (P0: 2)
│ project-y      v0.3 ✅  12/12  ✅
╰─────────────────────────────────────╯
```

---

## 7. 给 Hermes 设计者的具体建议 (5 条 actionable)

### 7.1 不要重写 agent runtime

AI agent runtime 已有 Claude Code / Cursor 等成熟方案。Hermes 的价值在**项目级 orchestration + dashboard**，不要抢 agent runtime 的活。

### 7.2 优先实现 `.ai/` Schema validator

Schema validator 是 Hermes 价值的核心入口。先做这个，比做 TUI 更重要:
- `hermes schema validate /path/to/.ai/status/*.yaml` — 校验 schema_version + 必需字段
- 提供修复建议（哪个 YAML 缺 `generated_at`）

### 7.3 TUI 做成"读模式"而非"写模式"

Hermes TUI 应该是**只读 dashboard** + 操作委托:
- 显示: `.ai/status/*.yaml` 内容
- 操作: 触发项目自己的命令（`npm run gate`, `bash scripts/emit-status.sh`）
- **不要** TUI 直接改 `.ai/` 文档（让项目 coding agent 做）

### 7.4 提供 "项目 fingerprint" 命令

`hermes fingerprint <project>` 输出项目特征:
- 语言/框架
- 测试套件大小
- 是否有 Docker
- AI 工程层 (`.ai/`) 完整度

这让 Hermes 能自适应不同项目（不是只支持 aitutor）。

### 7.5 与 CI 集成

Hermes 可监听 GitHub Actions / GitLab CI 的 gate 结果，直接同步到 `.ai/status/gate-status.yaml`（比本地 emit 更准）。

---

## 8. aitutor 给 Hermes 留的"验证场"

aitutor 是 Hermes 的早期采用者（early adopter）:
- 我已建 `.ai/` 完整骨架（context / architecture / decisions / operations / agents / runbooks / status / integrations）
- 我已建 emit + consume 工具链
- 我已验证 gate 协议 (npm run gate 5/5)
- 我已建模拟消费脚本 (hermes-consume-test.cjs)

**Hermes 可以用 aitutor 做端到端验证**:
- 用 hermes-consume-test.cjs 的方式开发你的 parser
- 用 emit-status.sh 的输出做你的 dashboard 输入
- 用 D061-D065 决策格式做你的 schema 标准

**这是双向价值**: aitutor 用 Hermes 渲染，Hermes 用 aitutor 验证。

---

## 9. 不在 Hermes 范围内（避免做）

❌ 重做 AI agent runtime (Hermes 不该抢 Claude Code 的活)
❌ 重做 TUI 通用界面 (Hermes 该是渲染器不是编辑器)
❌ 锁定单一 LLM provider (Hermes 是协议层，不是模型层)
❌ 锁死单一项目类型 (aitutor 是众多项目之一)

---

## 10. 一句话

> **Hermes 应该把自己定位成"AI 工程层的协议 + 项目 dashboard 渲染器", 不是"另一个 AI agent 工具"。
> aitutor 已用 `.ai/` 标准 + status YAML + emit/consume 工具链验证了这个路径, 欢迎 Hermes 把它变成行业标准。**