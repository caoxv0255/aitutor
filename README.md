# AI Tutor - 智启AI导师

基于 AI 的高中/中考智能辅导系统，支持拍照搜题、错题管理、智能组卷、学情分析等功能。

## 🌟 项目特点

- **AI 驱动**: 集成 DashScope 和 DeepSeek 大模型，提供智能解题和分析能力
- **多端支持**: PWA 移动端 + PC 端双架构设计
- **新高考适配**: 支持 3+1+2 / 3+3 / 传统文理三种选科模式
- **GraphRAG 增强**: 基于知识图谱的智能问答和知识点关联

## 📁 项目架构

```
aitutor/
├── api/                    # Express.js 后端 API
│   ├── middleware/          # 中间件（认证、安全、错误处理）
│   ├── utils/              # 工具模块（响应格式、学科映射、Prompt、验证器）
│   ├── auth.js             # JWT 认证中间件
│   ├── db.js               # SQLite 数据库初始化
│   ├── proxy.js            # AI 代理（DashScope/DeepSeek）
│   ├── taskWorker.js       # 异步任务队列（图片识别）
│   ├── generate-paper.js   # 智能组卷引擎
│   ├── exam-session.js     # 考试会话管理
│   ├── class-analysis.js   # 学情分析（学生+教师+班级）
│   ├── knowledge-points.js # 知识点管理
│   └── ...                 # 其他 API 模块
├── public/                 # PWA 移动端（SPA）
│   ├── src/                # 源码（app.js、组件、服务、工具）
│   ├── icons/              # PWA 图标
│   ├── vendor/             # 第三方库（KaTeX、Marked、DOMPurify）
│   └── manifest.json       # PWA 配置
├── frontend/               # PC 端多页应用
│   ├── *.html              # 各学科考试/报告页面
│   └── *.js                # 前端逻辑模块
├── graphrag_workspace/     # GraphRAG Python 微服务（端口 8100）
├── database/               # 数据库种子与归档
├── scripts/                # 运维与数据导入脚本
├── tests/                  # Vitest 测试套件
├── deploy/                 # 部署配置（systemd service）
├── server.js               # Express 入口
├── Dockerfile              # Docker 容器化
├── docker-compose.yml      # Docker Compose 编排
└── .github/workflows/      # CI/CD 流水线
```

## ✨ 核心功能

| 功能 | 描述 |
|------|------|
| 拍照搜题 | 上传题目图片，AI 提供启发式解答（非直接给答案） |
| 错题本 | 自动保存解题记录，支持按学科/知识点筛选 |
| 智能组卷 | 基于薄弱知识点自动生成试卷，支持 9 学科 |
| 考试模式 | 限时答题、防切屏、自动交卷、成绩统计 |
| 学情分析 | 学生偏科预警、薄弱知识点追踪、进步趋势 |
| 班级分析 | 教师仪表盘、群体薄弱点聚合、成绩分布 |
| 作文评分 | 四维评分（内容/语言/结构/发展等级），对标高考标准 |
| 新高考适配 | 支持 3+1+2 / 3+3 / 传统文理三种模式 |
| PWA 离线 | Service Worker 缓存，支持离线访问 |

## 🛠️ 技术栈

**后端：** Node.js + Express + SQLite (WAL) + JWT

**AI：** DashScope (qwen3-vl-plus, qwen-plus) + DeepSeek + GraphRAG

**前端：** 原生 JavaScript (SPA + MPA 双架构) + KaTeX + Marked.js

**测试：** Vitest (200 项测试)

**工程化：** ESLint 9 + Prettier + GitHub Actions CI/CD + Docker

## 🚀 快速开始

### 环境要求

- Node.js >= 18
- npm >= 8
- Git

### 安装步骤

```bash
# 克隆仓库
git clone https://github.com/caoxv0255/aitutor.git
cd aitutor

# 安装依赖
npm install
```

### 配置环境变量

复制环境变量模板并填写必要的配置：

```bash
cp .env.example .env
```

`.env` 必填项：

```env
JWT_SECRET=your-secret-key-at-least-32-characters-long
DASHSCOPE_API_KEY=your-dashscope-api-key
```

可选配置：

```env
DEEPSEEK_API_KEY=your-deepseek-api-key
PORT=3000
```

### 启动服务

```bash
npm start
```

访问 `http://localhost:3000`

### Docker 部署

```bash
docker compose up -d
```

## 🔌 API 概览

| 端点 | 方法 | 描述 |
|------|------|------|
| `/api/register` | POST | 用户注册 |
| `/api/login` | POST | 用户登录 |
| `/api/guest-login` | POST | 游客登录 |
| `/api/proxy` | POST | AI 对话代理 |
| `/api/questions` | GET/POST | 错题管理 |
| `/api/generate-paper` | POST | 智能组卷 |
| `/api/exam-session` | POST/GET | 考试会话 |
| `/api/class-analysis` | GET | 学生学情分析 |
| `/api/teacher-dashboard` | GET | 教师仪表盘 |
| `/api/class-detail` | GET | 班级详情分析 |
| `/api/knowledge-points` | GET/POST | 知识点管理 |
| `/api/send-reset-code` | POST | 密码重置验证码 |
| `/api/reset-password` | POST | 重置密码 |

所有 API 使用统一响应格式：

```json
{
  "success": true,
  "message": "操作成功",
  "data": {}
}
```

## 🧪 测试

```bash
npm test                # 运行全部测试
npm run test:watch      # 监听模式
npm run test:coverage   # 生成覆盖率报告
```

## ✨ 代码规范

```bash
npm run lint            # 检查代码规范
npm run lint:fix        # 自动修复
npm run format          # 格式化代码
npm run format:check    # 检查格式
```

## 📊 知识点覆盖

覆盖 9 学科 213 个知识点：

| 学科 | 高考知识点 | 中考知识点 |
|------|-----------|-----------|
| 数学 | 30 | - |
| 语文 | 20 | - |
| 英语 | 20 | - |
| 物理 | 23 | - |
| 化学 | 25 | - |
| 政治 | 20 | - |
| 生物 | 20 | 5 |
| 历史 | 20 | 3 |
| 地理 | 20 | 4 |

## 📋 新高考选科组合

| 模式 | 组合数 | 适用省份 |
|------|--------|----------|
| 3+1+2 | 12 种 | 广东、江苏、河北、湖南等 |
| 3+3 | 20 种 | 北京、上海、天津、浙江等 |
| 传统文理 | 2 种 | 其他省份 |

## 📁 目录结构说明

```
aitutor/
├── .github/              # GitHub 配置（CI/CD 工作流）
├── .qoder/               # Qoder MCP 配置
├── api/                  # 后端 API 模块
├── database/             # 数据库相关文件
│   ├── graphify-*/       # GraphRAG 图数据
│   └── 北京中考真题/      # 中考真题数据
├── frontend/             # PC 端前端页面
├── public/               # PWA 移动端资源
├── tests/                # 测试文件
├── AGENTS.md             # GitNexus 智能代理配置
├── CLAUDE.md             # Claude AI 配置
├── PWA_GUIDE.md          # PWA 开发指南
├── USAGE_GUIDE.md        # 使用指南
└── server.js             # 应用入口
```

## 📄 License

MIT License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📞 联系方式

如有问题或建议，请通过以下方式联系：
- GitHub Issues: https://github.com/caoxv0255/aitutor/issues
