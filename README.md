# AI Tutor - 智启AI导师

基于 Hybrid RAG 架构的中高考智能辅导系统，融合知识图谱（Apache AGE）、向量检索（pgvector）与 LLM 推理，提供拍照搜题、SSE 流式教学、间隔复习引擎、学情可视化等完整学习闭环。

## 架构总览

```
┌─────────────────────────────────────────────────────────────────┐
│                        前端 (Vanilla JS + PWA)                   │
│  PWA 拍照 → KaTeX 流式渲染 → 知识图谱可视化 → SRS 复习面板       │
└───────────────────────────┬─────────────────────────────────────┘
                            │ SSE / REST
┌───────────────────────────┼─────────────────────────────────────┐
│                     Express.js 后端                              │
│                                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────────┐  │
│  │ 方案 A    │  │ 方案 B    │  │ 方案 C    │  │ 数据飞轮 / SRS │  │
│  │ AGE 图谱  │←→│ pgvector │←→│ LLM 推理 │←→│ 掌握度 + SM-2  │  │
│  └──────────┘  └──────────┘  └──────────┘  └────────────────┘  │
│                                                                  │
│  ┌──────────────┐  ┌──────────────────────────────────────────┐ │
│  │ Vision RAG   │  │ 基础服务 (Auth / Proxy / Tasks / Exam)   │ │
│  │ 多模态解析    │  │                                          │ │
│  └──────────────┘  └──────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
                            │
          ┌─────────────────┼─────────────────┐
          │     PostgreSQL + 扩展              │
          │  Apache AGE (图) + pgvector (向量) │
          └───────────────────────────────────┘
```

## Hybrid RAG Triad

| 层         | 模块                                          | 职责                      | 关键技术                  |
| ---------- | --------------------------------------------- | ------------------------- | ------------------------- |
| **方案 A** | `scripts/sync-obsidian-to-age.js`             | 知识图谱构建与查询        | Apache AGE, Cypher        |
| **方案 B** | `api/routes/rag-search.js` + `services/embedding.js` | 语义向量检索              | pgvector, HNSW 索引       |
| **方案 C** | `api/routes/tutor-agent.js` + `services/llm.js`      | LLM 教学推理 + 防跳跃机制 | DashScope, JSON Mode, SSE |

**数据飞轮**：`api/routes/learning-loop.js` — 学习反馈 → 掌握度更新 → 图谱涟漪效应 → 闭环

**Vision RAG**：`api/routes/vision-parse.js` — 拍照 → Qwen-VL 多模态解析 → 拍照即入库

**SRS 引擎**：`api/routes/srs-engine.js` — SM-2 间隔重复算法 + 艾宾浩斯遗忘曲线 → 每日复习任务

## 项目结构

```
aitutor/
├── api/                          # Express.js 后端 API
│   ├── core/                    # 核心基础设施 (db, auth, swagger, taskWorker)
│   ├── handlers/                # 请求处理函数 (login, questions, reports, exam...)
│   ├── routes/                  # Express Router (graphrag, rag, tutor, loop...)
│   ├── middleware/               # 认证、安全、错误处理
│   └── utils/                   # 响应格式、Prompt 模板、验证器
├── services/                    # 独立服务层
│   ├── llm.js                   # LLM 封装 (文本 + 流式 + 多模态)
│   └── embedding.js             # DashScope Embedding API
├── frontend-v2/                 # 现行主前端树 (v2)：/v2/ 全量 + 已接管页根路径
├── ai-tutor-frontend/           # F3 前端 (/f3/*，旧树兜底)
├── public/                      # PWA 移动端 (SPA)
│   ├── src/
│   │   ├── js/
│   │   │   ├── mastery-graph.js # 知识图谱可视化 (Cytoscape.js)
│   │   │   ├── tutor-stream.js  # SSE 流式解析器
│   │   │   └── katex-stream.js  # KaTeX 流式公式渲染 + PWA 拍照
│   │   ├── components/          # 图片裁剪等 UI 组件
│   │   └── app.js               # SPA 入口
│   └── manifest.json            # PWA 配置
├── frontend/                    # 旧树 PC 多页应用 (MPA，冻结后 301 → /f3，仅作回滚)
│   ├── assets/
│   │   ├── css/                 # style.css, brand.css
│   │   └── js/                  # components.js, exam-mode.js, qr.js 等
│   ├── dashboard.html           # 个人中心
│   └── *-exam/report.html       # 各学科考试/报告页
├── scripts/                     # 运维脚本与数据导入
├── graphrag_service/            # GraphRAG Python 微服务
├── tests/                       # Vitest 测试套件 (200 tests)
├── deploy/                      # systemd / Nginx / Docker 部署
├── docs/                        # 项目文档
├── server.js                    # Express 入口
└── docker-compose.yml           # Docker Compose 编排
```

## 技术栈

| 层           | 技术                                                               |
| ------------ | ------------------------------------------------------------------ |
| **运行时**   | Node.js ≥ 22 (ES Modules)                                          |
| **后端框架** | Express.js                                                         |
| **数据库**   | PostgreSQL + Apache AGE (图) + pgvector (向量)                     |
| **AI 模型**  | DashScope (qwen-plus / qwen-vl-max / text-embedding-v3) · DeepSeek |
| **前端**     | Vanilla JS · Cytoscape.js · KaTeX · Marked.js · DOMPurify          |
| **测试**     | Vitest                                                             |
| **工程化**   | ESLint 9 · Prettier · GitHub Actions CI/CD                         |
| **部署**     | Docker · systemd service                                           |

### 前端主树（frontend-v2）与页面接管

`frontend-v2/` 是现行主前端树；旧树（`frontend/` legacy、`ai-tutor-frontend/` F3、`public/` PWA）只作兜底与回滚。

- **路由**：`/v2/` 始终提供新树全部页面；根路径按 `server.js` 的 `DEFAULT_NEW_TREE_PAGES` 接管已重建页（旧树同名页被优先遮蔽），其余路径仍走旧树。新树资源走独立命名空间 `/assets/v2/`，与 legacy 资源零撞名。
- **接管进度**：根路径接管 **20** 页（`server.js` 的 `DEFAULT_NEW_TREE_PAGES`）；另有 **5** 个 v2 原型页（`hero.html`、`landing.html`、`error-404.html`、`practice-hub-v2.html`、`teacher-dashboard.html`）有意不接管，仅经 `/v2/` 预览。`frontend-v2/` 顶层共 25 个页面。
- **回滚**：改环境变量 + 重启即可，不动代码 —— `NEW_TREE=off` 让全部路径回到旧树（新页仍可从 `/v2/` 访问）；`NEW_TREE_PAGES=a.html,b.html` 缩小接管射程。
- **门禁**：`scripts/check-new-tree-routing.mjs`（校验接管路由）、`scripts/check-ui-standard.mjs`（视觉标准，`MIGRATED` 清单当前 10 页）。迁移计划与批次见 `docs/spec/PLAN-v2-migration.md`，视觉规格见 `docs/spec/SPEC-UI.md`。

### 前端自托管依赖（零境外请求）

`frontend-v2`（现行唯一前端框架）不引用任何境外 CDN，第三方资产全部自托管：

| 资产 | 路径 | 说明 |
| --- | --- | --- |
| 字体 | `frontend-v2/assets/fonts/` | DM Sans / Noto Sans SC / Serif SC / JetBrains Mono（woff2） |
| KaTeX 0.18.7 | `frontend-v2/assets/vendor/katex/` | 拍照解题的公式渲染，MIT，含 fonts + LICENSE |

公式按 `$...$`（行内）/ `$$...$$`（独立）解析，文本段一律走 `createTextNode`，
KaTeX 以 `trust: false` + `maxExpand` 上限渲染；结果区由 `.results-scroll` 承载滚动
（移动端限高、桌面随页滚、容器可键盘聚焦）。详见 `docs/spec/SPEC-UI.md` §5.5.4。

## 快速开始

### 环境要求

- Node.js >= 22
- PostgreSQL >= 15 (需安装 Apache AGE + pgvector 扩展)
- npm >= 8

### 安装

```bash
git clone https://github.com/caoxv0255/aitutor.git
cd aitutor
npm install
```

### 配置环境变量

```bash
cp .env.example .env
```

```env
# 必填
DATABASE_URL=postgresql://user:password@localhost:5432/aitutor
JWT_SECRET=your-secret-key-at-least-32-characters-long
EMBEDDING_BASE_URL=http://host.docker.internal:11434
EMBEDDING_MODEL=bge-m3

# 可选
DASHSCOPE_API_KEY=your-dashscope-api-key
DEEPSEEK_API_KEY=your-deepseek-api-key
GRAPHRAG_API_KEY=your-graphrag-api-key
PG_POOL_MAX=20
PORT=3002
```

完整变量清单与「必填/可选」标注以 `.env.example` 为准；凭据轮换与泄露处置见 `docs/security/credential-rotation.md`。

### 启动

```bash
npm start
# 访问 http://localhost:3002
```

### Docker 部署

```bash
docker compose up -d
```

## API 概览

### Hybrid RAG 核心接口

| 端点                       | 方法 | 描述                            |
| -------------------------- | ---- | ------------------------------- |
| `/api/tutor/ask`           | POST | 教学 Agent 推理 (JSON 完整返回) |
| `/api/tutor/ask/stream`    | POST | 教学 Agent 推理 (**SSE 流式**)  |
| `/api/tutor/mastery/:kpId` | GET  | 单知识点学情诊断                |
| `/api/rag/ingest`          | POST | 题目向量化入库                  |
| `/api/rag/search`          | POST | 语义检索 + 图谱节点过滤         |
| `/api/loop/feedback`       | POST | 学习反馈 + 图谱涟漪效应         |
| `/api/loop/batch`          | POST | 批量反馈                        |
| `/api/loop/graph`          | GET  | 知识图谱拓扑 (Cytoscape 格式)   |
| `/api/loop/mastery`        | GET  | 掌握度概览                      |

### Vision RAG & SRS

| 端点                           | 方法 | 描述                        |
| ------------------------------ | ---- | --------------------------- |
| `/api/vision/parse`            | POST | 多模态图片解析 + 拍照即入库 |
| `/api/vision/knowledge-points` | GET  | 可用知识点列表              |
| `/api/srs/daily-tasks`         | GET  | 今日必复习任务 (SM-2 排序)  |
| `/api/srs/complete`            | POST | 完成复习 → 更新 SRS 参数    |
| `/api/srs/stats`               | GET  | SRS 复习统计概览            |

### 基础服务

| 端点                    | 方法     | 描述        |
| ----------------------- | -------- | ----------- |
| `/api/register`         | POST     | 用户注册    |
| `/api/login`            | POST     | 用户登录    |
| `/api/guest-login`      | POST     | 游客登录    |
| `/api/proxy`            | POST     | AI 对话代理 |
| `/api/questions`        | GET/POST | 错题管理    |
| `/api/generate-paper`   | POST     | 智能组卷    |
| `/api/exam-session`     | POST/GET | 考试会话    |
| `/api/class-analysis`   | GET      | 学情分析    |
| `/api/knowledge-points` | GET/POST | 知识点管理  |

所有 API 统一响应格式：

```json
{
  "success": true,
  "message": "操作成功",
  "data": {}
}
```

## SSE 流式协议

`POST /api/tutor/ask/stream` 使用 Server-Sent Events 推送教学回复：

```
event: metadata    → 结构化诊断数据（前置依赖、薄弱点、学习路径）
event: content     → LLM 教学文本 delta（流式追加，打字机效果）
event: done        → 流结束统计
event: error       → 错误信息
```

## 测试 & 代码规范

```bash
npm test                # 运行测试
npm run test:frontend   # 前端 v2 状态机 / 响应式用例 (node 直跑)
npm run test:watch      # 监听模式
npm run test:coverage   # 覆盖率报告
npm run lint            # ESLint 检查
npm run lint:fix        # 自动修复
npm run format          # Prettier 格式化
npm run gate            # 发布门禁 (release-gate.sh，含路由/视觉/凭据等静态检查)
```

## 知识点覆盖

覆盖 9 学科 213 个知识点：

| 学科 | 高考 | 中考 |
| ---- | ---- | ---- |
| 数学 | 30   | -    |
| 语文 | 20   | -    |
| 英语 | 20   | -    |
| 物理 | 23   | -    |
| 化学 | 25   | -    |
| 政治 | 20   | -    |
| 生物 | 20   | 5    |
| 历史 | 20   | 3    |
| 地理 | 20   | 4    |

## 新高考选科组合

| 模式     | 组合数 | 适用省份                 |
| -------- | ------ | ------------------------ |
| 3+1+2    | 12 种  | 广东、江苏、河北、湖南等 |
| 3+3      | 20 种  | 北京、上海、天津、浙江等 |
| 传统文理 | 2 种   | 其他省份                 |

## License

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！

## 联系方式

- GitHub Issues: https://github.com/caoxv0255/aitutor/issues

AI Agent 体系见 `.ai/` 目录（架构 / 决策 / runbook / known-bugs）。
