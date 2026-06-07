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
| **方案 B** | `api/rag-search.js` + `services/embedding.js` | 语义向量检索              | pgvector, HNSW 索引       |
| **方案 C** | `api/tutor-agent.js` + `services/llm.js`      | LLM 教学推理 + 防跳跃机制 | DashScope, JSON Mode, SSE |

**数据飞轮**：`api/learning-loop.js` — 学习反馈 → 掌握度更新 → 图谱涟漪效应 → 闭环

**Vision RAG**：`api/vision-parse.js` — 拍照 → Qwen-VL 多模态解析 → 拍照即入库

**SRS 引擎**：`api/srs-engine.js` — SM-2 间隔重复算法 + 艾宾浩斯遗忘曲线 → 每日复习任务

## 项目结构

```
aitutor/
├── api/                          # Express.js 后端 API
│   ├── middleware/               # 认证、安全、错误处理
│   ├── utils/                   # 响应格式、Prompt 模板、验证器
│   ├── db.js                    # PostgreSQL + pgvector + AGE 初始化
│   ├── tutor-agent.js           # 方案 C: 教学 Agent (SSE 流式)
│   ├── rag-search.js            # 方案 B: 向量检索 + 混合检索
│   ├── learning-loop.js         # 数据飞轮: 反馈 + 涟漪 + 图谱拓扑
│   ├── vision-parse.js          # Vision RAG: 多模态图片解析
│   ├── srs-engine.js            # SRS: SM-2 间隔重复引擎
│   ├── proxy.js                 # AI 代理 (DashScope / DeepSeek)
│   ├── generate-paper.js        # 智能组卷
│   ├── class-analysis.js        # 班级学情分析
│   └── ...                      # Auth / Exam / Tasks / Reports
├── services/                    # 独立服务层
│   ├── llm.js                   # LLM 封装 (文本 + 流式 + 多模态)
│   └── embedding.js             # DashScope Embedding API
├── public/                      # PWA 移动端 (SPA)
│   ├── src/
│   │   ├── js/
│   │   │   ├── mastery-graph.js # 知识图谱可视化 (Cytoscape.js)
│   │   │   ├── tutor-stream.js  # SSE 流式解析器
│   │   │   └── katex-stream.js  # KaTeX 流式公式渲染 + PWA 拍照
│   │   ├── components/          # 图片裁剪等 UI 组件
│   │   └── app.js               # SPA 入口
│   └── manifest.json            # PWA 配置
├── frontend/                    # PC 端多页应用 (MPA)
│   ├── dashboard.html           # 个人中心
│   ├── mastery-dashboard.html   # 知识图谱仪表盘 (PC 版)
│   └── *-exam/report.html       # 各学科考试/报告页
├── scripts/                     # 运维脚本
│   ├── sync-obsidian-to-age.js  # 方案 A: Obsidian → AGE 同步
│   ├── benchmark-db.js          # 数据库性能基准测试
│   └── ...                      # 数据导入/迁移脚本
├── graphrag_service/            # GraphRAG Python 微服务
├── tests/                       # Vitest 测试套件
├── deploy/                      # systemd / Docker 部署
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
DASHSCOPE_API_KEY=your-dashscope-api-key

# 可选
DEEPSEEK_API_KEY=your-deepseek-api-key
PG_POOL_MAX=20
PORT=3000
```

### 启动

```bash
npm start
# 访问 http://localhost:3000
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
npm run test:watch      # 监听模式
npm run test:coverage   # 覆盖率报告
npm run lint            # ESLint 检查
npm run lint:fix        # 自动修复
npm run format          # Prettier 格式化
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
