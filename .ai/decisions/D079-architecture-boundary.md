# D079 — aitutor 与 Hermes / DSH / AI OS 架构边界

> **类型**: 架构边界 (Architecture Boundary) — 永久性
> **触发**: 用户明确纠正"aitutor 部署在学校服务器，与开发基础设施无关"
> **配合**: D078 (Learning Loop v1 冻结)
> **状态**: ✅ 立即生效

---

## 0. 决策摘要

**aitutor 是独立部署在学校服务器上的教育产品。**
**Hermes / DSH / AI OS 是开发该产品的基础设施。**

两者**不共享运行链路**、**不共享代码路径**、**不共享依赖**、**不共享配置文件**。

---

## 1. 边界图

```
┌─────────────────────────────────────────────────────────┐
│                aitutor 产品 (生产环境)                    │
│  ┌─────────────────────────────────────────────────┐    │
│  │  ai-tutor-frontend/    (F3 前端)                │    │
│  │  api/                  (后端 + modules)          │    │
│  │  database/             (题库 / 知识点)           │    │
│  │  scripts/              (数据导入)                │    │
│  │  tests/                (vitest + contract)      │    │
│  │  deploy/               (systemd / docker)       │    │
│  │  docs/                 (用户文档)                │    │
│  └─────────────────────────────────────────────────┘    │
│           │                                              │
│           ▼                                              │
│  学校服务器: aitutor.uibe.online                         │
│  PostgreSQL + pgvector + Apache AGE                      │
│  Redis (cache)                                           │
│  DashScope / DeepSeek LLM                                │
└─────────────────────────────────────────────────────────┘

═══════════════════════════════════════════════════════════════
                       边界 (本 ADR 强约束)
═══════════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────────┐
│              开发基础设施 (本地 / 云开发机)                │
│  ┌─────────────────────────────────────────────────┐    │
│  │  Hermes / DSH / AI OS                           │    │
│  │  - agent 编排                                    │    │
│  │  - status yaml (开发机)                          │    │
│  │  - TUI 调试工具                                  │    │
│  │  - .ai/decisions/ (本 ADR 也是基础设施的一部分)  │    │
│  │  - gitnexus MCP                                  │    │
│  └─────────────────────────────────────────────────┘    │
│           │                                              │
│           ▼                                              │
│  本地 Mac / WSL / 云开发机                                │
│  Cursor / Claude Code / DeepSeek-Harness 调用入口         │
└─────────────────────────────────────────────────────────┘
```

---

## 2. 严格边界规则

### 2.1 aitutor 代码不能依赖开发基础设施

❌ **禁止**:
- aitutor 任何代码 `import` 或 `require` Hermes / DSH / AI OS 模块
- aitutor 任何代码读取 `.ai/status/*.yaml` 文件作为运行时数据
- aitutor 任何代码调用 gitnexus MCP / OpenWiki 作为运行时服务
- aitutor `package.json` 不允许添加 Hermes / DSH / AI OS 相关依赖
- aitutor Docker 镜像**不打包** Hermes / DSH / AI OS 相关文件

✅ **允许**:
- `.ai/` 目录可作为**开发期文档**留在仓库 (作为 agent 上下文)
- `.ai/decisions/*.md` 可在开发机读取，作为开发期决策记录
- `.ai/architecture/*.md` 可在开发机读取，作为开发期架构图

### 2.2 开发基础设施不能写 aitutor 运行时文件

❌ **禁止**:
- Hermes / DSH / AI OS 任何 agent 在 aitutor 运行时**自动写入** `/f3/pages/*` / `api/routes/*` / `database/*` 业务文件
- Hermes / DSH 任何 status yaml 在生产环境 (`aitutor.uibe.online`) 被实时访问
- AI OS 自动提交代码到 aitutor 主分支 (绕过 D065 gate)

✅ **允许**:
- 人类开发者使用 Hermes / DSH / AI OS 作为**对话式开发助手**，手工复制结果到仓库
- 任何 agent 必须遵守 D062 / D063 / D065 红线
- `.ai/decisions/*.md` 可被 agent 在开发机读取 (作为上下文)，但**不能**被 aitutor 运行时读取

### 2.3 配置文件边界

| 文件 / 目录 | 属于 | 运行时可读？ |
|-------------|------|------------|
| `ai-tutor-frontend/` | aitutor | ✅ (生产) |
| `api/` | aitutor | ✅ (生产) |
| `database/` | aitutor | ✅ (生产) |
| `deploy/` | aitutor | ✅ (生产) |
| `tests/` | aitutor | ✅ (生产构建期) |
| `docs/` (用户文档) | aitutor | ✅ (生产静态托管) |
| `.ai/` | 开发基础设施 | ❌ (生产部署**排除**) |
| `.ai/status/*.yaml` | 开发基础设施 | ❌ |
| `.ai/decisions/*.md` | 开发基础设施 | ❌ |
| `.claude/skills/` | 开发基础设施 | ❌ |
| `openwiki/` | 开发基础设施 | ❌ |
| `.gitnexus/` | 开发基础设施 | ❌ |

### 2.4 Docker 构建边界 (D070 / D069 配合)

`deploy/setup-prod.sh` / `docker-compose.prod.yml` 必须:
- `.dockerignore` 排除 `.ai/` / `.claude/` / `openwiki/` / `.gitnexus/`
- 镜像构建**不打包**任何开发基础设施文件
- 运行时 `curl http://aitutor/api/health` 不能访问 `.ai/` 任何内容

---

## 3. aitutor 与开发基础设施的合法交互点

开发基础设施 (Hermes / DSH / AI OS) 对 aitutor 的合法干预**只有 3 个入口**:

### 3.1 代码贡献入口

```
开发者 (人)
  ↓ 用 Cursor / Claude Code / DeepSeek-Harness 对话
  ↓ agent 生成代码 patch
  ↓ 人工 review
  ↓ git commit
  ↓ pre-commit hook 触发 D065 gate
  ↓ gate 5/5 通过后 push
```

**agent 不能直接 push 到 main**——必须有 D065 gate + 人工 review。

### 3.2 决策记录入口

```
开发者或 agent 发现需要新决策
  ↓ 写 .ai/decisions/D-NNN-*.md
  ↓ 引用既有决策 (D062-D079)
  ↓ 提交 PR
  ↓ 人工 review + merge
```

**新决策 ADR 不超过本冻结 (D078 §2.1) 范围**。

### 3.3 文档入口

```
开发者或 agent 写 docs/*.md
  ↓ 用户文档 / 内部文档 / audit 文档
  ↓ 提交 PR
  ↓ 人工 review
```

---

## 4. 已有违规风险清单

以下目录/文件存在于 aitutor 仓库，**当前**不是问题，但需持续监控：

| 路径 | 当前风险 | 处理 |
|------|---------|------|
| `.ai/` | 文档，含 §2.3 表格中的开发期文件 | D069 已通过 `.dockerignore` 排除，需在 CI 验证 |
| `.ai/status/*.yaml` | 机器可读 status | 不进入生产镜像 |
| `.ai/decisions/*.md` | 决策记录 | 不进入生产镜像 |
| `.ai/decisions/D070-production-deployment.md` | 与生产部署同名 | 内容**是** aitutor 生产部署决策，**不是**开发基础设施 |
| `.ai/architecture/` | 部分内容是 aitutor 架构，部分是 AI OS 架构 | D069 + 本 ADR 共同约束 |
| `openwiki/` | OpenWiki 自动生成文档 | D069 已通过 `.dockerignore` 排除 |
| `.claude/skills/` | Claude Code 技能 | D069 已通过 `.dockerignore` 排除 |
| `.gitnexus/` | gitnexus 索引 | D069 已通过 `.dockerignore` 排除 |

**Sprint 1 verification 步骤**:
```bash
# 验证 .ai/ 不进入生产镜像
docker compose -f docker-compose.prod.yml build app
docker run --rm aitutor-prod-app ls -la /app/ | grep -E "\.ai|openwiki|\.claude|\.gitnexus"
# 期望: 无输出 (或仅显示 .airc 等无害文件)
```

---

## 5. 与 D066 的边界

D066 (aitutor status yaml track) 定义的 `.ai/status/*.yaml` 是开发机使用的状态文件，**不进入**生产环境。D066 与本 ADR (D079) 一致——`.ai/status/` 是开发基础设施，不是 aitutor 运行时一部分。

**未来禁止**:
- 把 `.ai/status/*.yaml` 改造为"aitutor 运行时读取的状态"——这是范畴错误
- 给 aitutor 添加读取 yaml 配置的功能——aitutor 运行时只用 env vars + DB

---

## 6. 与 D070 (production deployment) 的关系

D070-frontend-version-cleanup.md 和 D070-production-deployment.md 是 aitutor 自身生产部署决策。命名重复是巧合，**两个 D070 内容不冲突**：

| 文件 | 主题 |
|------|------|
| `.ai/decisions/D070-frontend-version-cleanup.md` | aitutor 前端版本号清理 |
| `.ai/decisions/D070-production-deployment.md` | aitutor Docker 生产部署 |

两者都是 aitutor 自身决策 (在 `.ai/decisions/` 但内容是 aitutor 产品)。本 ADR (D079) 不重新编号——保留历史。

---

## 7. AI OS 范畴错误清单 (历史教训)

以下情况是**范畴错误**——把开发基础设施错认为 aitutor 运行时：

1. ❌ "aitutor 应该能读取 Hermes status yaml 来决定今天给用户推荐什么"  
   → 范畴错误。aitutor 运行时只能读 DB / env vars。
2. ❌ "我们应该让 agent 自动 patch 错题本代码并部署"  
   → 范畴错误。agent 只能 patch + 提交 + 走 CI + 人工 review。
3. ❌ "aitutor 应该给学校管理员提供 AI OS 仪表盘"  
   → 范畴错误。学校管理员用 aitutor 内置 dashboard，不是 AI OS。
4. ❌ "我们应该在 aitutor 里加 TUI 给开发者调试"  
   → 范畴错误。开发者用 `npm run dev` + 本地 console，不是 aitutor 运行时 TUI。

---

## 8. 例外情况

如果确实需要在 aitutor 中引用开发基础设施（例如 agent 调试模式），必须满足：

1. **不影响生产路径** — 任何开发基础设施引用必须在 `if (process.env.NODE_ENV === 'development')` 分支内
2. **不影响生产 bundle** — 前端不能 import 开发基础设施模块
3. **不影响生产镜像** — Dockerfile 必须显式 exclude
4. **不影响生产性能** — 不能引入冷启动开销

**当前 aitutor 不存在此类例外**。如有新需求，先创建 D-NNN ADR 评估。

---

## 9. 验证清单 (CI 必须)

`.github/workflows/release-gate.yml` (D065) 必须新增以下检查:

```yaml
- name: Verify architecture boundary (D079)
  run: |
    # 1. .ai/ 不进入生产镜像
    test -z "$(docker run --rm $IMAGE ls -la /app/ 2>/dev/null | grep -E '\.ai|openwiki|\.claude|\.gitnexus')"
    
    # 2. package.json 不含 Hermes / DSH / AI OS 依赖
    ! grep -E "(hermes|dsh|ai-os)" package.json
    
    # 3. .dockerignore 必须排除开发基础设施
    grep -E "^\.ai/" .dockerignore
    grep -E "^openwiki/" .dockerignore
    grep -E "^\.claude/" .dockerignore
    grep -E "^\.gitnexus/" .dockerignore
    
    # 4. 生产镜像运行后 /api/health 不暴露 .ai/
    docker run --rm -d --name test-app -p 3002:3002 $IMAGE
    sleep 10
    ! curl -sf http://localhost:3002/.ai/decisions/D079-architecture-boundary.md | grep -q "D079"
    docker stop test-app
```

---

## 10. 反向提议 (Revocation)

本 ADR 是**架构边界**，撤销成本极高。撤销必须满足：

1. 引用 D079 并明确指出**变更理由**
2. 创建 D-NNN (N >= 080) 详细描述新边界
3. 人工 review + 用户产品决策层批准

**不接受**的反向提议:
- "为了开发效率让 aitutor 读取 .ai/status yaml" → 违反 §2.1，拒绝
- "agent 应该能直接部署到生产" → 违反 §3.1 + D065，拒绝
- "我们应该把 Hermes 集成进 aitutor" → 违反 §0 整体目标，拒绝

---

**文档结束**
