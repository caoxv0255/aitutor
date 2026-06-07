# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository purpose

AI Tutor (`aitutor.uibe.online`) — 高考/中考错题诊断与预测学习平台。用户通过 PWA 拍照上传错题，系统自动识别题目、归类学科与知识点，生成个性化诊断报告、预测卷和强化学习方案。

本目录是可运行的完整 Web 应用（Express.js 后端 + 前端静态页面 + PWA），上层目录还包含北京高考/中考历年真题资料（doc/docx/pdf），属于内容归档。

## 开发环境与启动

```bash
# 必须使用 Node.js，项目为 ESM 模块
node --version   # 要求 Node 18+

# 安装依赖
npm install

# 启动开发（默认端口 3001）
node server.js
# 生产环境 systemd 服务使用 PORT=3002

# Nginx 会反向代理 /aitutor 前缀到后端
# 本地直接访问 http://localhost:3001
```

**没有**测试框架、lint 命令或构建步骤。项目是纯 Node.js + 静态 HTML，无编译流程。

## 关键配置

环境变量在 `.env` 中（已被 `.gitignore` 排除），核心变量：

```
DATABASE_URL=postgresql://...    # PostgreSQL 连接串
JWT_SECRET=...                   # JWT 签名密钥
ALLOWED_ORIGINS=...              # CORS 允许的域名
```

admin 用户硬编码在 `api/handlers/register.js` 中（邮箱 `admin@uibe.edu.cn`），密码通过 bcrypt 哈希存储。

## 架构概览

```
server.js                  # Express 入口，路由注册、静态文件、中间件
├── api/                   # 后端 API
│   ├── core/              # 核心基础设施
│   │   ├── db.js          # PostgreSQL 连接池 + 自动建表
│   │   ├── auth.js        # JWT 认证中间件
│   │   ├── swagger.js     # API 文档
│   │   └── taskWorker.js  # 后台任务消费者
│   ├── handlers/          # 请求处理函数
│   │   ├── login.js       # 登录
│   │   ├── register.js    # 注册（含 admin 特殊逻辑）
│   │   ├── questions.js   # 错题 CRUD
│   │   ├── reports.js     # 诊断报告 CRUD
│   │   ├── generate-paper.js  # 个性化试卷生成
│   │   ├── explain-question.js # AI 题目讲解
│   │   ├── learning-path.js   # 学习路径规划
│   │   ├── knowledge-points.js # 知识点 + 薄弱点分析
│   │   ├── tasks.js       # 异步任务管理
│   │   ├── proxy.js       # LLM API 代理
│   │   ├── guest-login.js # 游客登录
│   │   ├── reset-password.js  # 密码重置
│   │   └── ...            # exam-*, province-*, class-analysis 等
│   ├── routes/            # Express Router 模块
│   │   ├── graphrag.js    # GraphRAG 图谱查询
│   │   ├── rag-search.js  # RAG 向量搜索
│   │   ├── tutor-agent.js # AI Tutor 对话代理
│   │   └── learning-loop.js # 学习闭环
│   ├── middleware/         # Express 中间件
│   └── utils/             # 工具函数
├── frontend/              # PC 端页面（AI Tutor 品牌主站）
│   ├── index.html         # 首页
│   ├── assets/            # 静态资源
│   │   ├── css/           # style.css, brand.css
│   │   └── js/            # components.js, qr.js, theme-utils.js 等
│   ├── zhongkao.html      # 中考专区
│   ├── dashboard.html     # 个人中心
│   ├── login.html / register.html
│   └── ...                # 各科 exam/report 页面
├── public/                # PWA 手机端
├── database/              # 题库数据
├── scripts/               # 工具脚本和数据导入
├── services/              # LLM 和 Embedding 服务
├── deploy/                # 部署配置
└── docs/                  # 文档
```

## 统一组件系统

所有 PC 端页面通过 `components.js` 动态渲染统一的导航和页脚：

- **未登录导航**：首页 | 高考专区 | 中考专区 | 政策解读 | 方法论 | 登录
- **已登录导航**：首页 | 高考专区 | 中考专区 | 个人中心 | 我的报告 | 退出
- **QR码入口**：导航栏右侧"扫码使用"按钮，点击弹出 QR 码（链接 `aitutor.uibe.online`，UA 检测自动分流到 PWA）
- **统一 Footer**：品牌名 + 平台说明 + 导航链接 + 免责声明

页面只需在 `<body>` 后引入 `qr.js` + `components.js`，无需手动编写 header/footer。

## 数据库设计

使用 PostgreSQL，通过 `api/core/db.js` 自动建表（无迁移工具）。核心表：

| 表名 | 存储方式 | 用途 |
|------|---------|------|
| `users` | 关系字段 | 用户账号（email, bcrypt password, grade） |
| `wrong_questions` | `data JSONB` | 错题，按 user_email 关联 |
| `reports` | `data JSONB` | 诊断报告 |
| `task_queue` | 关系字段 + `result JSONB` | 异步图片识别任务 |
| `similar_questions` | `data JSONB` | 相似题推荐 |
| `knowledge_points` | 关系字段 + `subtopics JSONB` + `level` | 知识点体系（gaokao/zhongkao） |
| `personalized_papers` | `data JSONB` | 个性化试卷 |

`knowledge_points` 表有 `level` 字段区分高考（`gaokao`）和中考（`zhongkao`）。

## 双端架构（PC + PWA）

`server.js` 根据 User-Agent 自动分流：

- **手机端**：访问 `/` → `public/index.html`（PWA 拍照搜题应用）
- **PC 端**：访问 `/` → `frontend/index.html`（AI Tutor 品牌主站）

静态文件挂载顺序：`public/` 优先于 `frontend/`，两者共享 `/api/*` 后端接口。

## 知识点与薄弱点分析

### 知识点数据结构

高考知识点（47个）：`database/seed_knowledge_points.json`
中考知识点（42个）：`database/seed_knowledge_points_zhongkao.json`

每个知识点包含：id, subject, name, subtopics, difficulty(1-5), frequency(low/medium/high), description, level(gaokao/zhongkao)

### 薄弱点加权评分

`api/handlers/knowledge-points.js` 的薄弱点分析使用加权评分：

```
weakness_index = error_count × (difficulty/3) × frequency_weight
```

其中 frequency_weight: high=1.5, medium=1.0, low=0.7

### API 端点

- `GET /api/knowledge-points?subject=math&level=zhongkao` — 查询知识点（支持 level 过滤）
- `POST /api/knowledge-points/seed` — 导入高考知识点（`action: "seed"`）或中考知识点（`action: "seed_zhongkao"`）
- `GET /api/weak-points` — 用户薄弱点分析（加权排序）
- `POST /api/generate-paper` — 生成个性化试卷（支持九科）
- `GET /api/learning-path?subject=math` — 学习路径规划（支持九科）

## 样式体系

`frontend/style.css` 是全站共享样式（v4），使用 CSS 变量定义深色主题。`brand.css` 定义跨端品牌变量。

新增页面必须使用这些 CSS 变量，保持视觉一致性。PWA 端（`public/`）有自己的浅色主题样式。

## 部署

```bash
# 一键部署（需要 sudo）
sudo bash deploy/setup.sh

# 服务管理
sudo systemctl status uibe-tutor
sudo systemctl restart uibe-tutor
sudo journalctl -u uibe-tutor -f
```

生产环境：Nginx (443/SSL) → systemd (`PORT=3002`) → PostgreSQL。

## 编码约定

- **模块系统**：ESM (`"type": "module"`)，所有文件使用 `import/export`
- **API Handler 模式**：每个 `api/*.js` 导出一个 `async (req, res)` 函数
- **页面组件化**：PC 端页面通过 `components.js` 动态注入 header/footer/QR，不手动编写
- **认证**：受保护路由需在 `server.js` 中显式添加 `authMiddleware`
- **数据操作**：直接用 `pg` 库的 `pool.query()`，参数化查询防注入
- **LLM 调用**：通过 `api/handlers/proxy.js` 代理，前端不直接调用外部 API

## 安全注意事项

- `api/handlers/register.js` 中包含硬编码的 admin 密码哈希
- `.env` 包含数据库密码和 JWT 密钥，已被 gitignore
- API 有速率限制：auth 路由 20次/15分钟，proxy 路由 10次/分钟

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **aitutor** (10260 symbols, 11793 relationships, 133 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/aitutor/context` | Codebase overview, check index freshness |
| `gitnexus://repo/aitutor/clusters` | All functional areas |
| `gitnexus://repo/aitutor/processes` | All execution flows |
| `gitnexus://repo/aitutor/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
