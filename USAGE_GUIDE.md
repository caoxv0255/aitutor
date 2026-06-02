# AI Tutor 使用指南

## 一、快速开始

### 1.1 环境要求

- **操作系统**：Windows 10/11
- **Node.js**：v18+（推荐 v20+）
- **浏览器**：Chrome / Edge / Firefox 最新版

### 1.2 安装与启动

**方式一：双击启动脚本**

双击项目根目录下的 `start.bat` 文件，脚本将自动安装依赖并启动服务。

**方式二：命令行启动**

```bash
# 安装依赖
npm install

# 启动服务
npm start
```

启动成功后，浏览器访问 http://localhost:3002

### 1.3 首次使用

1. 打开浏览器，访问 http://localhost:3002
2. 点击右上角「登录」按钮
3. 点击「注册」创建账号（填写邮箱、密码、年级）
4. 注册成功后自动登录，进入个人中心

---

## 二、功能模块

### 2.1 首页

首页是平台入口，包含以下区域：

| 区域 | 说明 |
|------|------|
| 省份选择器 | 选择高考/中考地区，查看该省份的试卷和趋势数据 |
| 命题趋势 | 展示各学科最新命题趋势分析 |
| 政策解读 | 2026年高考政策变化要点 |
| 方法论 | 学习方法论介绍 |
| 样例报告 | 学生/家长/教师三种视角的诊断报告样例 |

### 2.2 省份详情页

从首页选择省份后进入，展示：

- **省份概览**：考试类型、命题方式、地区信息
- **统计数据**：覆盖年份、学科数量、试卷数量
- **命题特色**：该省份命题特点描述
- **知识点考查频次**：近5年高频知识点图表和表格
- **题型分布**：选择题/填空题/解答题等占比
- **难度分布**：各难度等级题目数量
- **高频知识点 TOP10**：横向柱状图展示
- **趋势摘要**：命题趋势分析和备考建议
- **试卷列表**：该省份所有真题试卷，点击可查看详情

### 2.3 试卷详情页

从省份详情页点击「查看试卷」进入，展示：

- **试卷信息**：省份、年份、学科、考试类型
- **统计概览**：总题数、总分、平均难度
- **题目列表**：每道题的题号、题型、难度、分值
- **答案与解析**：点击「显示答案」/「显示解析」一键查看
- **知识点标签**：每道题关联的知识点

### 2.4 个人中心

登录后访问，包含：

| 功能 | 说明 |
|------|------|
| 学习统计 | 错题总数、已生成报告、薄弱知识点数 |
| 考试省份 | 设置你的高考/中考省份 |
| 错题本 | 查看通过拍照上传的错题记录 |
| 诊断报告 | 查看已生成的学科诊断报告 |
| 薄弱知识点 | 查看各学科薄弱知识点分析 |
| 个性化试卷 | 基于错题生成针对性练习卷 |
| 题目讲解 | AI 讲解错题解题思路 |
| 学习路径 | 个性化学习计划推荐 |

### 2.5 错题本

管理所有错题记录：

- **按学科筛选**：数学/语文/英语/物理/化学/政治
- **拍照上传**：通过手机扫码拍照上传错题
- **AI 讲解**：对错题进行 AI 智能讲解
- **同类题推荐**：推荐相似题目进行巩固练习

### 2.6 诊断报告

支持多学科诊断报告：

| 学科 | 报告页面 |
|------|---------|
| 数学 | math-report.html |
| 语文 | chinese-report.html |
| 英语 | english-report.html |
| 物理 | physics-report.html |
| 化学 | chemistry-report.html |
| 政治 | politics-report.html |

报告包含：知识点掌握度雷达图、薄弱环节分析、提分建议、同类题推荐。

### 2.7 学科试卷页面

提供各学科专项试卷练习：

| 学科 | 页面 |
|------|------|
| 数学 | math-exam.html |
| 语文 | chinese-exam.html |
| 英语 | english-exam.html |
| 物理 | physics-exam.html |
| 化学 | chemistry-exam.html |
| 政治 | politics-exam.html |

### 2.8 真题训练模式

通过 API 支持限时训练：

```
POST /api/exam-session/start
Body: { "subject": "math", "province_code": "beijing", "time_limit": 120, "question_count": 20 }
```

- 支持按学科、省份、年份筛选题目
- 可设置限时（分钟）和题目数量
- 提交后自动评分，错题自动录入错题本
- 完成练习可获得积分奖励

### 2.9 学习激励系统

| 功能 | API | 说明 |
|------|-----|------|
| 每日打卡 | POST /api/checkin | 连续打卡奖励递增，每日5+连续天数积分 |
| 打卡状态 | GET /api/checkin/status | 查看今日是否已打卡、连续天数 |
| 积分历史 | GET /api/points | 查看积分获取记录 |
| 徽章系统 | GET /api/badges | 查看已获得和待解锁的徽章 |

**徽章列表：**

| 徽章 | 名称 | 解锁条件 |
|------|------|---------|
| 🌟 | 初来乍到 | 首次登录 |
| 🔥 | 坚持一周 | 连续打卡7天 |
| 👑 | 月度之星 | 连续打卡30天 |
| 📝 | 不怕犯错 | 记录第一道错题 |
| 📚 | 错题达人 | 累计记录50道错题 |
| ⚔️ | 百炼成钢 | 累计记录200道错题 |
| ✏️ | 初试锋芒 | 完成第一次练习 |
| 📖 | 勤学苦练 | 完成10次练习 |
| 🎓 | 题海战术 | 完成50次练习 |
| 🎯 | 精准射手 | 单次练习正确率≥80% |
| 💯 | 满分选手 | 单次练习正确率≥95% |
| 🪙 | 积分新手 | 累计获得100积分 |
| 🏆 | 积分达人 | 累计获得1000积分 |
| 🌈 | 全科选手 | 练习覆盖所有学科 |

### 2.10 学情分析

| 功能 | API | 说明 |
|------|-----|------|
| 学生学情 | GET /api/class-analysis | 学科分布、偏科预警、知识点分布 |
| 教师仪表盘 | GET /api/teacher-dashboard | 用户统计、学科分布、难度分布 |

---

## 三、API 文档

启动服务后，访问 http://localhost:3002/api-docs 查看完整的 Swagger API 文档。

### 3.1 认证方式

大部分 API 需要在请求头中携带 JWT Token：

```
Authorization: Bearer <token>
```

Token 在登录/注册成功后返回。

### 3.2 主要 API 端点

| 端点 | 方法 | 说明 | 认证 |
|------|------|------|------|
| /api/login | POST | 用户登录 | 否 |
| /api/register | POST | 用户注册 | 否 |
| /api/provinces | GET | 省份列表 | 否 |
| /api/provinces/:code | GET | 省份详情 | 否 |
| /api/province-trends/:code | GET | 省份趋势 | 否 |
| /api/exam-papers | GET | 试卷列表 | 否 |
| /api/exam-questions/:paperId | GET | 试卷题目 | 否 |
| /api/questions | GET/POST | 错题管理 | 是 |
| /api/reports | GET/POST | 诊断报告 | 是 |
| /api/learning-dashboard | GET | 学习仪表盘 | 是 |
| /api/exam-session/start | POST | 开始练习 | 是 |
| /api/exam-session/submit | POST | 提交练习 | 是 |
| /api/checkin | POST | 每日打卡 | 是 |
| /api/badges | GET | 徽章列表 | 是 |
| /api/points | GET | 积分历史 | 是 |
| /api/class-analysis | GET | 学情分析 | 是 |
| /api/teacher-dashboard | GET | 教师仪表盘 | 是 |

### 3.3 通用响应格式

**成功响应：**
```json
{
  "success": true,
  "data": { ... }
}
```

**错误响应：**
```json
{
  "success": false,
  "message": "错误描述"
}
```

---

## 四、配置说明

### 4.1 环境变量

复制 `.env.example` 为 `.env` 并修改：

```bash
# 服务器端口
PORT=3002

# 允许的跨域来源
ALLOWED_ORIGINS=http://localhost:3002,http://127.0.0.1:3002

# 数据库路径（SQLite）
DATABASE_URL=sqlite://./database/example_db.sqlite

# JWT 密钥（生产环境务必更换）
JWT_SECRET=your-secret-key-here-please-change-in-production

# JWT 过期时间
JWT_EXPIRES_IN=7d
```

### 4.2 数据库

项目使用 SQLite 数据库，数据文件位于 `database/example_db.sqlite`。

数据库表结构：

| 表名 | 说明 |
|------|------|
| users | 用户信息 |
| wrong_questions | 错题记录 |
| reports | 诊断报告 |
| task_queue | 任务队列 |
| provinces | 省份数据 |
| exam_papers | 试卷数据 |
| exam_questions | 试卷题目 |
| exam_sessions | 练习会话 |
| user_checkins | 打卡记录 |
| user_points | 积分流水 |
| user_badges | 徽章记录 |
| user_province_prefs | 用户省份偏好 |

---

## 五、项目结构

```
aitutor/
├── api/                          # 后端 API
│   ├── db.js                     # 数据库连接与表创建
│   ├── auth.js                   # JWT 认证中间件
│   ├── login.js                  # 登录接口
│   ├── register.js               # 注册接口
│   ├── questions.js              # 错题管理接口
│   ├── reports.js                # 诊断报告接口
│   ├── provinces.js              # 省份数据接口
│   ├── province-trends.js        # 省份趋势接口
│   ├── exam-papers.js            # 试卷接口
│   ├── exam-questions.js         # 题目接口
│   ├── exam-session.js           # 练习会话接口
│   ├── class-analysis.js         # 学情分析接口
│   ├── gamification.js           # 激励系统接口
│   ├── learning-dashboard.js     # 学习仪表盘接口
│   ├── learning-path.js          # 学习路径接口
│   ├── knowledge-points.js       # 知识点接口
│   ├── generate-paper.js         # 生成试卷接口
│   ├── explain-question.js       # 题目讲解接口
│   ├── graphrag.js               # GraphRAG AI 接口
│   ├── swagger.js                # API 文档
│   ├── middleware/
│   │   ├── errorHandler.js       # 错误处理中间件
│   │   └── security.js           # 安全中间件
│   └── utils/
│       ├── validator.js          # 输入验证
│       ├── response.js           # 统一响应
│       └── cache.js              # 缓存工具
├── frontend/                     # 桌面端前端
│   ├── index.html                # 首页
│   ├── login.html                # 登录页
│   ├── register.html             # 注册页
│   ├── dashboard.html            # 个人中心
│   ├── province.html             # 省份详情
│   ├── exam-view.html            # 试卷详情
│   ├── wrong-book.html           # 错题本
│   ├── my-reports.html           # 我的报告
│   ├── my-weak-points.html       # 薄弱知识点
│   ├── learning-path.html        # 学习路径
│   ├── personalized-paper.html   # 个性化试卷
│   ├── question-explainer.html   # 题目讲解
│   ├── *-exam.html               # 各学科试卷页
│   ├── *-report.html             # 各学科报告页
│   ├── style.css                 # 全局样式
│   ├── components.js             # 导航/页脚组件
│   ├── theme-utils.js            # 主题切换
│   └── qr.js                     # 二维码工具
├── public/                       # PWA 移动端前端
├── database/                     # SQLite 数据库文件
├── server.js                     # Express 服务器入口
├── start.bat                     # Windows 启动脚本
├── .env                          # 环境变量配置
├── .env.example                  # 环境变量模板
└── package.json                  # 项目依赖
```

---

## 六、常见问题

### Q: 启动时提示端口被占用

```bash
# 查找占用 3002 端口的进程
netstat -ano | findstr :3002

# 终止进程（替换 PID）
taskkill /PID <PID> /F
```

### Q: 省份选择器加载为空

访问 http://localhost:3002/api/provinces/seed 触发种子数据导入。

### Q: 试卷详情页显示"暂无题目"

需要确保数据库中有对应的试卷和题目数据。检查 `exam_papers` 和 `exam_questions` 表。

### Q: 忘记密码

使用密码重置功能：POST /api/reset-password

### Q: 深色/浅色主题切换

点击导航栏右侧的主题切换按钮（太阳/月亮图标）即可切换。

---

## 七、技术栈

| 层级 | 技术 |
|------|------|
| 前端 | HTML5 + CSS3 + Vanilla JavaScript |
| 后端 | Node.js + Express |
| 数据库 | SQLite |
| 认证 | JWT (jsonwebtoken) |
| 密码加密 | bcryptjs |
| 缓存 | 内存缓存 / Redis（可选） |
| AI 引擎 | GraphRAG + LiteLLM（可选） |
| API 文档 | Swagger / OpenAPI 3.0 |
