# AI Tutor 智启AI导师 — PM与技术团队沟通桥梁文档

**版本**: v1.0  
**日期**: 2026-07-15  
**状态**: 正式版  
**适用范围**: 产品经理、技术团队、项目管理者

---

## 目录

1. [需求分析与梳理](#1-需求分析与梳理)
2. [技术架构设计](#2-技术架构设计)
3. [详细方案制定](#3-详细方案制定)
4. [实施计划与质量保障](#4-实施计划与质量保障)
5. [沟通与协作机制](#5-沟通与协作机制)
6. [附录](#6-附录)

---

## 1. 需求分析与梳理

### 1.1 项目背景与目标用户

| 维度 | 描述 |
|------|------|
| **项目名称** | AI Tutor 智启AI导师 |
| **核心定位** | 面向初高中学生的智能学习辅助系统 |
| **目标用户** | 初一至高三学生（12-18岁） |
| **使用场景** | 课后作业辅导、错题复习、模拟考试、知识点巩固 |
| **业务目标** | 提升学生学习效率、精准定位薄弱环节、个性化学习推荐 |

### 1.2 核心功能需求（用户故事）

#### 模块一：用户初始化

| 用户故事 | 优先级 | 功能点 | 状态 |
|---------|--------|--------|------|
| 作为新用户，我希望注册后完成年级、地区、选科的配置，以便系统为我提供个性化内容 | P0 | 年级选择（高一/高二/高三/初一-初三） | ✅ 已实现 |
| 作为新用户，我希望选择所在省份，以便获取本地化考试数据 | P0 | 地区选择（全国34个省市自治区） | ✅ 已实现 |
| 作为新高考地区用户，我希望选择3+1+2或3+3选科组合 | P0 | 选科功能（符合新高考模式） | ✅ 已实现 |
| 作为用户，我希望修改个人配置，以便适应学习阶段变化 | P1 | 配置修改与更新 | ✅ 已实现 |

#### 模块二：考试趋势分析

| 用户故事 | 优先级 | 功能点 | 状态 |
|---------|--------|--------|------|
| 作为高三学生，我希望查看近5年高考数学题型分布变化 | P0 | 题型分布趋势图表 | ✅ 已实现 |
| 作为学生，我希望了解各知识点难度系数变化趋势 | P0 | 难度系数分析曲线 | ✅ 已实现 |
| 作为学生，我希望获取专家对考试趋势的总结评价 | P1 | 专家总结文本与标签 | ✅ 已实现 |
| 作为学生，我希望对比不同省份的考试趋势差异 | P1 | 跨省趋势对比 | ✅ 已实现 |

#### 模块三：拍照搜题

| 用户故事 | 优先级 | 功能点 | 状态 |
|---------|--------|--------|------|
| 作为学生，我希望拍照上传题目获取解析 | P0 | 图像识别与OCR | ✅ 已实现 |
| 作为学生，我希望系统自动分析错误原因 | P0 | 错误类型分类与分析 | ✅ 已实现 |
| 作为学生，我希望获取相似题目练习 | P0 | 相似题目推荐 | ✅ 已实现 |
| 作为学生，我希望对图片进行裁剪旋转优化识别 | P1 | 图像预处理功能 | ✅ 已实现 |

#### 模块四：错题记录与分析

| 用户故事 | 优先级 | 功能点 | 状态 |
|---------|--------|--------|------|
| 作为学生，我希望自动或手动添加错题到错题本 | P0 | 错题收集机制 | ✅ 已实现 |
| 作为学生，我希望按知识点/题型/错误类型筛选错题 | P0 | 多维度筛选 | ✅ 已实现 |
| 作为学生，我希望生成PDF错题集便于打印 | P1 | 错题导出功能 | ✅ 已实现 |
| 作为学生，我希望查看错题统计分析报告 | P1 | 错误原因统计 | ✅ 已实现 |

#### 模块五：知识掌握画像

| 用户故事 | 优先级 | 功能点 | 状态 |
|---------|--------|--------|------|
| 作为学生，我希望看到各知识点的掌握程度评分 | P0 | 掌握度量化评分 | ✅ 已实现 |
| 作为学生，我希望通过可视化图表了解薄弱环节 | P0 | 知识图谱可视化 | ✅ 已实现 |
| 作为学生，我希望获取针对性学习建议 | P1 | 个性化学习建议 | ✅ 已实现 |
| 作为学生，我希望跟踪学习进度变化 | P1 | 动态更新画像 | ✅ 已实现 |

#### 模块六：模拟卷与学习计划

| 用户故事 | 优先级 | 功能点 | 状态 |
|---------|--------|--------|------|
| 作为学生，我希望根据薄弱点生成个性化试卷 | P0 | 智能组卷 | ✅ 已实现 |
| 作为学生，我希望系统推荐学习计划 | P0 | 学习计划生成 | ✅ 已实现 |
| 作为学生，我希望调整学习计划并跟踪进度 | P1 | 计划调整与跟踪 | ✅ 已实现 |
| 作为学生，我希望查看学习效果评估 | P1 | 完成度统计 | ✅ 已实现 |

### 1.3 需求追溯矩阵

| 需求编号 | 需求描述 | API Handler | 前端页面 | 数据库表 |
|---------|---------|-------------|---------|---------|
| REQ-001 | 用户注册/登录 | login.js, register.js | login.html | users |
| REQ-002 | 用户初始化（年级/地区/选科） | user-initialize.js, user-profile.js, user-subjects.js | onboarding.html | user_profiles, user_subjects |
| REQ-003 | 考试趋势分析 | province-trends.js, subject-trends.js, trend-summary.js | trends-analysis.html | exam_papers, province_knowledge_stats |
| REQ-004 | 拍照搜题 | visionSearchService.js (vision/routes.js) | photo-search.html | rag_questions, question_vectors |
| REQ-005 | 错题管理 | wrong-questions.js | wrong-book.html | wrong_questions, wrong_question_categories |
| REQ-006 | 知识掌握画像 | knowledge-profile.js, learning-loop.js | knowledge-profile.html | student_knowledge_mastery |
| REQ-007 | 学习计划生成 | study-plan.js | study-plan.html | learning_plans, learning_tasks |
| REQ-008 | 模拟卷生成 | generate-paper.js | exam-simulation.html | personalized_papers |

---

## 2. 技术架构设计

### 2.1 前端架构

#### 当前前端技术栈

| 技术 | 用途 | 版本 |
|------|------|------|
| Vanilla JS | 核心逻辑 | ES Modules |
| Tailwind CSS | 样式框架 | 4.3.1 |
| Lucide Icons | 图标库 | 1.8.0 |
| KaTeX | 数学公式渲染 | 0.16.33 |
| Cytoscape.js | 知识图谱可视化 | - |
| ECharts | 图表可视化 | - |

#### 前端代码库现状（技术债务警示）

**问题**: 项目存在三个平行的前端代码库：

| 目录 | 用途 | 状态 |
|------|------|------|
| `frontend/` | 原始PC端多页应用（MPA） | 维护中 |
| `frontend/redesign/` | 重新设计的PC端页面 | **当前主力** |
| `ai-tutor-frontend/` | 旧版前端框架 | 已废弃 |
| `ai-tutor-redesign/` | 旧版重设计 | 已废弃 |

**风险**: 代码重复、样式不一致、维护成本高

**建议**: 制定前端代码库整合计划，逐步将所有页面迁移至 `frontend/redesign/`

#### 组件架构

```
frontend/redesign/
├── assets/
│   ├── css/
│   │   ├── tokens.css          # 设计令牌（颜色、字体、间距）
│   │   ├── components.css      # 组件样式
│   │   ├── enhancements.css    # 增强样式
│   │   └── router.css          # 路由样式
│   └── js/
│       ├── components/
│       │   ├── skeleton.js     # 骨架屏
│       │   └── toast.js        # Toast提示
│       ├── utils/
│       │   └── security.js     # 安全工具
│       ├── router.js           # 路由管理
│       └── theme-utils.js      # 主题工具
└── pages/
    ├── dashboard.html          # 学习驾驶舱
    ├── wrong-book.html         # 错题本
    ├── photo-search.html       # 拍照搜题
    ├── knowledge-profile.html  # 知识画像
    ├── study-plan.html         # 学习计划
    └── trends-analysis.html    # 趋势分析
```

#### 状态管理方案

| 方案 | 适用场景 | 当前采用 |
|------|---------|---------|
| LocalStorage | 用户偏好、主题设置 | ✅ |
| SessionStorage | 临时数据、登录状态 | ✅ |
| JWT Token | 认证授权 | ✅ |
| URL参数 | 页面间数据传递 | ✅ |

### 2.2 后端架构

#### 后端技术栈

| 技术 | 用途 | 版本 |
|------|------|------|
| Node.js | 运行时 | ≥ 22 |
| Express.js | 后端框架 | 4.22.1 |
| PostgreSQL | 关系型数据库 | ≥ 15 |
| Apache AGE | 图数据库扩展 | - |
| pgvector | 向量数据库扩展 | - |
| JWT | 认证授权 | 9.0.3 |

#### API架构

```
server.js (入口)
├── middleware/
│   ├── security.js         # XSS/CORS/CSRF防护
│   └── errorHandler.js     # 全局错误处理
├── core/
│   ├── db.js               # 数据库连接池
│   ├── auth.js             # JWT鉴权中间件
│   ├── logger.js           # 日志系统
│   └── swagger.js          # API文档
├── modules/                # 模块化路由
│   ├── user/               # 用户管理
│   ├── trends/             # 考试趋势
│   ├── vision/             # 视觉搜题
│   ├── exam/               # 考试管理
│   ├── tutor/              # AI导师
│   ├── srs/                # 间隔复习
│   └── rag/                # 向量检索
├── handlers/               # 请求处理函数
├── routes/                 # 核心业务路由
├── services/               # 独立服务层
└── utils/                  # 工具函数
```

#### API接口规范

**统一响应格式**:
```json
{
  "success": true,
  "message": "操作成功",
  "data": {}
}
```

**认证机制**:
- JWT Token 放在 `Authorization: Bearer <token>` 头
- 所有受保护接口需通过 `authMiddleware`
- Token有效期：7天

#### 业务逻辑层架构

```
请求 → 路由 → 中间件（鉴权/安全）→ Handler → Service → Database
                    ↓
               统一响应格式
```

### 2.3 数据库设计

#### 核心数据表结构

| 表名 | 核心字段 | 用途 |
|------|---------|------|
| `users` | id, email, password, grade, province | 用户基础信息 |
| `user_profiles` | user_email, grade_code, province_code, exam_level, initialized | 用户完整档案 |
| `user_subjects` | user_email, subject_code, is_main | 用户选科关系 |
| `exam_papers` | province_code, year, subject, exam_level, math_type | 试卷信息 |
| `exam_questions` | question_uid, stem, options, answer, analysis, knowledge_points | 题目详情 |
| `wrong_questions` | user_email, data, subject_code, error_category | 错题记录 |
| `student_knowledge_mastery` | user_email, knowledge_point_id, mastery_score, ease_factor | 掌握度追踪 |
| `learning_plans` | user_email, title, tasks, completion_rate | 学习计划 |
| `learning_tasks` | plan_id, task_type, status, completed_count | 学习任务 |

#### 索引策略

- **复合索引**: `exam_papers(province_code, year, subject)`
- **向量索引**: `question_vectors(q_embedding)` 使用 HNSW 算法
- **用户索引**: `wrong_questions(user_email, subject_code)`
- **掌握度索引**: `student_knowledge_mastery(user_email, knowledge_point_id)`

#### 查询优化方案

| 优化点 | 方案 |
|--------|------|
| 慢查询检测 | statement_timeout: 30s |
| 连接池管理 | max: 20, min: 2, idleTimeout: 30s |
| 向量检索 | HNSW索引（m=16, ef_construction=64） |
| 分页查询 | LIMIT + OFFSET 或 Keyset分页 |

### 2.4 部署架构

#### 环境配置

| 环境 | 配置 | 用途 |
|------|------|------|
| 开发环境 | Node.js + PostgreSQL（本地） | 日常开发 |
| 测试环境 | Docker Compose | 集成测试 |
| 生产环境 | Docker + Nginx + systemd | 正式运行 |

#### 部署流程

```
开发 → Git提交 → GitHub Actions CI → Docker镜像构建 → 测试环境部署 → 灰度发布 → 生产环境
```

#### 当前部署配置

- **Dockerfile**: 构建Node.js应用镜像
- **docker-compose.yml**: 编排API服务与PostgreSQL数据库
- **deploy/uibe.conf**: Nginx配置
- **deploy/uibe-tutor.service**: systemd服务配置

---

## 3. 详细方案制定

### 3.1 功能模块划分

#### 用户模块

```
用户模块
├── 用户认证
│   ├── 注册 (POST /api/auth/register)
│   ├── 登录 (POST /api/auth/login)
│   ├── 游客登录 (POST /api/auth/guest-login)
│   └── 密码重置 (POST /api/auth/reset-password)
├── 用户档案
│   ├── 获取档案 (GET /api/user/profile)
│   ├── 更新档案 (PUT /api/user/profile)
│   └── 初始化配置 (POST /api/user/initialize)
└── 用户选科
    ├── 获取选科 (GET /api/user/subjects)
    └── 设置选科 (POST /api/user/subjects)
```

#### 考试趋势模块

```
考试趋势模块
├── 省份趋势 (GET /api/trends/province/:code)
├── 趋势对比 (GET /api/trends/province/compare)
├── 学科趋势 (GET /api/trends/subject/:subject)
└── 专家总结 (GET /api/trends/expert-summary)
```

#### 视觉搜题模块

```
视觉搜题模块
├── 图片解析 (POST /api/vision/parse)
├── 拍照搜题 (POST /api/vision/search)
├── 图像分析 (POST /api/vision/analyze)
├── 公式解析 (POST /api/vision/formula)
└── 图表分析 (POST /api/vision/diagram)
```

#### 错题管理模块

```
错题管理模块
├── 获取错题列表 (GET /api/wrong-questions)
├── 获取单个错题 (GET /api/wrong-questions/:id)
├── 添加错题 (POST /api/wrong-questions)
├── 更新错题 (PUT /api/wrong-questions/:id)
├── 删除错题 (DELETE /api/wrong-questions/:id)
├── 错题统计 (GET /api/wrong-questions/stats)
└── 导出错题 (GET /api/wrong-questions/export)
```

#### 知识画像模块

```
知识画像模块
├── 获取知识画像 (GET /api/knowledge/profile)
├── 掌握度概览 (GET /api/loop/mastery)
├── 知识图谱 (GET /api/loop/graph)
├── 学习反馈 (POST /api/loop/feedback)
└── 学习建议 (GET /api/knowledge/suggestions)
```

#### 学习计划模块

```
学习计划模块
├── 获取学习计划 (GET /api/study-plan)
├── 创建学习计划 (POST /api/study-plan)
├── 更新学习计划 (PUT /api/study-plan/:id)
├── 删除学习计划 (DELETE /api/study-plan/:id)
├── 获取学习任务 (GET /api/study-plan/tasks)
├── 完成学习任务 (POST /api/study-plan/tasks/:id/complete)
└── 生成模拟卷 (POST /api/generate-paper)
```

### 3.2 界面交互设计

#### 设计规范

| 规范项 | 值 |
|--------|------|
| 主色调 | `#d71920`（红色） |
| 辅助色 | `#2563eb`（蓝色） |
| 标题字体 | DM Sans |
| 正文字体 | Noto Sans SC |
| 圆角 | 8px / 14px / 16px / 9999px |
| 间距系统 | 4px 网格（space-1~space-8） |

#### 交互流程

**用户初始化流程**:
```
注册/登录 → 检查是否初始化 → 未初始化 → 选择年级 → 选择地区 → 选择学科 → 设置目标 → 完成初始化 → 进入首页
```

**拍照搜题流程**:
```
点击拍照 → 上传图片 → 图片预览 → 开始扫描 → OCR识别 → 错误分析 → 相似题推荐 → 添加错题/生成计划
```

**错题复习流程**:
```
进入错题本 → 筛选条件（学科/知识点/错误类型） → 查看错题详情 → 标记已复习 → 查看解析 → 练习相似题
```

### 3.3 数据流程设计

#### 用户数据流程

```
用户操作 → 前端请求 → API路由 → Handler → Service → 数据库操作 → 返回响应
```

#### 拍照搜题数据流程

```
图片上传 → Base64编码 → /api/vision/search
    ↓
VisionSearchService.search()
    ├── parseImageToQuestion() → OCR识别
    ├── llm.chat() → 错误分析
    ├── findSimilarQuestions() → 相似题检索
    ├── llm.chat() → 学习计划生成
    └── saveWrongQuestion() → 保存错题
    ↓
返回解析结果
```

#### 学习反馈数据流程

```
用户答题 → /api/loop/feedback
    ↓
learning-loop.js
    ├── 更新student_knowledge_mastery表
    ├── 更新SRS参数（ease_factor, interval_days）
    ├── 计算新掌握度分数
    └── 触发图谱涟漪效应
    ↓
返回更新后的掌握度
```

### 3.4 技术选型说明

#### 前端技术选型

| 技术 | 选择理由 |
|------|---------|
| Vanilla JS | 轻量、无框架依赖、加载快，适合教育类应用 |
| Tailwind CSS | 原子化CSS、快速原型开发、响应式设计 |
| KaTeX | 高性能数学公式渲染、支持流式渲染 |
| Cytoscape.js | 强大的图可视化能力、支持知识图谱 |
| ECharts | 丰富的图表类型、响应式、交互友好 |

#### 后端技术选型

| 技术 | 选择理由 |
|------|---------|
| Express.js | 成熟稳定、生态丰富、学习曲线平缓 |
| PostgreSQL | 强大的关系型数据库、支持JSONB、扩展性强 |
| Apache AGE | 图数据库扩展、支持Cypher查询、适合知识图谱 |
| pgvector | 向量数据库扩展、支持HNSW索引、适合语义检索 |
| JWT | 无状态认证、跨域友好、性能优秀 |

#### AI技术选型

| 技术 | 选择理由 |
|------|---------|
| DashScope API | 国内稳定、支持多模态（Qwen-VL）、性价比高 |
| qwen-vl-max | 强大的图像理解能力、支持数学公式识别 |
| text-embedding-v3 | 高质量文本向量、适合语义检索 |

### 3.5 性能优化策略

#### 前端优化

| 优化项 | 策略 |
|--------|------|
| 页面加载 | 代码分割、懒加载、资源压缩 |
| 图片优化 | WebP格式、响应式图片、CDN缓存 |
| 缓存策略 | HTTP缓存、Service Worker、LocalStorage |
| 渲染优化 | 虚拟列表、骨架屏、防抖节流 |

#### 后端优化

| 优化项 | 策略 |
|--------|------|
| 数据库连接 | 连接池（max=20）、TCP keepalive |
| 查询优化 | 复合索引、HNSW向量索引、查询缓存 |
| 响应时间 | 语句超时（30s）、异步任务队列 |
| 限流保护 | express-rate-limit、防暴力破解 |

#### AI服务优化

| 优化项 | 策略 |
|--------|------|
| 模型选择 | 根据场景选择不同模型（turbo/plus/max） |
| 缓存机制 | 相似题检索缓存、解析结果缓存 |
| 异步处理 | 复杂任务放入task_queue异步执行 |
| 成本控制 | 限制token数量、使用合适temperature |

### 3.6 安全策略

#### 前端安全

| 安全项 | 策略 |
|--------|------|
| XSS防护 | DOMPurify净化输入、Content-Security-Policy头 |
| CSRF防护 | 同源策略、Referer校验、Token验证 |
| 输入验证 | 前端表单验证、类型检查、长度限制 |
| 敏感信息 | 不存储密码明文、HTTPS传输 |

#### 后端安全

| 安全项 | 策略 |
|--------|------|
| 认证授权 | JWT Token、角色权限检查 |
| 输入验证 | 参数校验、SQL注入防护、DOMPurify |
| 安全头 | X-Frame-Options、X-XSS-Protection、CORS白名单 |
| 速率限制 | 登录/注册限流（每分钟10次）、通用接口限流 |
| 日志审计 | 操作日志记录、异常日志追踪 |

#### 数据安全

| 安全项 | 策略 |
|--------|------|
| 数据加密 | 密码bcrypt加密、敏感字段加密存储 |
| 备份策略 | 定期数据库备份、增量备份 |
| 访问控制 | 最小权限原则、数据库用户隔离 |
| 传输加密 | HTTPS/TLS、WSS加密 |

---

## 4. 实施计划与质量保障

### 4.1 开发里程碑

#### 第一阶段：基础功能完善（2周）

| 任务 | 描述 | 负责人 | 交付物 |
|------|------|--------|--------|
| 前端代码库整合 | 将frontend/redesign作为唯一前端代码库 | 前端开发 | 统一的前端目录结构 |
| 文档更新 | 更新架构文档，修正SQLite→PostgreSQL描述 | 技术文档 | 更新后的架构设计文档 |
| 单元测试补充 | 为新增API编写单元测试 | 后端开发 | 测试用例、覆盖率报告 |

#### 第二阶段：功能增强（4周）

| 任务 | 描述 | 负责人 | 交付物 |
|------|------|--------|--------|
| 错题本PDF导出优化 | 支持自定义导出范围、样式美化 | 全栈开发 | 优化的导出功能 |
| 知识图谱可视化升级 | 支持交互操作、动态更新 | 前端开发 | 增强的知识图谱组件 |
| 学习计划日历视图 | 提供日历视图展示学习任务 | 前端开发 | 日历组件 |

#### 第三阶段：性能优化（2周）

| 任务 | 描述 | 负责人 | 交付物 |
|------|------|--------|--------|
| 前端性能优化 | 代码分割、懒加载、资源优化 | 前端开发 | 优化后的前端代码 |
| 后端性能优化 | 缓存策略、索引优化、查询优化 | 后端开发 | 性能优化报告 |
| 数据库优化 | 清理冗余数据、优化索引配置 | DBA | 数据库优化方案 |

#### 第四阶段：测试与上线（2周）

| 任务 | 描述 | 负责人 | 交付物 |
|------|------|--------|--------|
| 集成测试 | 模块间集成测试、端到端测试 | 测试工程师 | 集成测试报告 |
| 用户验收测试 | UAT测试、用户反馈收集 | 产品经理 | UAT报告 |
| 灰度发布 | 小范围发布、监控告警 | DevOps | 灰度发布方案 |

### 4.2 测试策略

#### 测试类型

| 测试类型 | 工具 | 覆盖率目标 | 频率 |
|---------|------|-----------|------|
| 单元测试 | Vitest | ≥ 80% | 每次提交 |
| 集成测试 | Vitest + Supertest | ≥ 70% | 每日构建 |
| API测试 | Vitest | 100%核心接口 | 每周 |
| 系统测试 | 手动测试 | - | 里程碑 |
| 用户验收测试 | 用户测试 | - | 上线前 |

#### 测试用例设计

**用户认证测试**:
- 正常注册/登录流程
- 密码错误登录失败
- Token过期处理
- 游客登录流程

**拍照搜题测试**:
- 正常图片识别
- 模糊图片处理
- 无结果处理
- 并发请求处理

**错题管理测试**:
- 添加/删除/修改错题
- 多维度筛选
- 导出功能
- 统计分析

#### 测试环境

| 环境 | 配置 |
|------|------|
| 测试数据库 | PostgreSQL（独立实例） |
| 测试API | localhost:3000 |
| 测试账号 | 测试用户账号（预创建） |

### 4.3 文档规范

#### API文档

- **格式**: Swagger/OpenAPI 3.0
- **位置**: `/api/docs`
- **更新频率**: 每次API变更后更新
- **内容**: 接口描述、参数说明、响应示例、认证要求

#### 用户手册

- **格式**: Markdown/PDF
- **位置**: `docs/USAGE_GUIDE.md`
- **内容**: 功能介绍、使用流程、常见问题

#### 开发文档

- **架构设计**: `docs/architecture/`
- **数据库设计**: `docs/database/`
- **API参考**: `docs/api/`
- **代码规范**: ESLint + Prettier 配置

#### 维护文档

- **部署指南**: `docs/deployment.md`
- **故障排除**: `docs/troubleshooting.md`
- **监控告警**: `docs/monitoring.md`

### 4.4 上线流程

#### 灰度发布

| 阶段 | 范围 | 时间 | 监控指标 |
|------|------|------|---------|
| 内部测试 | 开发团队 | 1天 | 无 |
| 小范围灰度 | 10%用户 | 3天 | 错误率、响应时间 |
| 中等范围灰度 | 50%用户 | 3天 | 错误率、响应时间、用户反馈 |
| 全量发布 | 100%用户 | 持续 | 所有指标 |

#### 监控告警

| 监控项 | 告警阈值 | 通知方式 |
|--------|---------|---------|
| API错误率 | > 5% | 飞书通知 |
| API响应时间 | > 2s | 飞书通知 |
| 数据库连接数 | > 90% | 飞书通知 |
| 服务器负载 | > 80% | 飞书通知 |

#### 回滚机制

```
发现问题 → 确认影响范围 → 执行回滚 → 通知相关人员 → 分析根因 → 修复后重新发布
```

**回滚步骤**:
1. 切换Nginx到旧版本
2. 停止新版本容器
3. 启动旧版本容器
4. 验证服务正常

---

## 5. 沟通与协作机制

### 5.1 需求变更管理流程

#### 变更请求

| 步骤 | 操作 | 责任人 |
|------|------|--------|
| 1 | 提出变更请求（描述、原因、影响） | 产品经理/用户 |
| 2 | 评估变更影响（技术复杂度、时间成本、风险） | 技术负责人 |
| 3 | 优先级排序（P0-P3） | 产品经理 |
| 4 | 变更审批（确认是否执行） | 项目负责人 |
| 5 | 执行变更（开发、测试、部署） | 技术团队 |
| 6 | 变更验证（验收测试） | 产品经理 |
| 7 | 文档更新（更新相关文档） | 技术文档 |

#### 变更类型

| 类型 | 描述 | 审批级别 |
|------|------|---------|
| P0 | 紧急修复、影响核心功能 | 项目负责人 |
| P1 | 重要功能增强、用户体验提升 | 技术负责人 |
| P2 | 一般功能改进、非核心需求 | 产品经理 |
| P3 | 优化建议、低优先级需求 | 产品经理 |

### 5.2 技术团队与非技术团队沟通计划

#### 日常沟通

| 频率 | 形式 | 参与人员 | 内容 |
|------|------|---------|------|
| 每日 | 站会（15分钟） | 技术团队 | 进度同步、阻塞问题 |
| 每周 | 周会（1小时） | 全团队 | 本周总结、下周计划 |
| 每两周 | 迭代评审 | 产品+技术 | 功能演示、反馈收集 |

#### 非技术团队沟通

| 对象 | 频率 | 形式 | 内容 |
|------|------|------|------|
| 产品经理 | 每日 | 即时沟通 | 需求澄清、进度同步 |
| 运营团队 | 每周 | 周会 | 数据报表、用户反馈 |
| 客户/用户 | 每两周 | 问卷/访谈 | 用户体验、功能建议 |

#### 沟通工具

| 工具 | 用途 |
|------|------|
| 飞书 | 即时沟通、文档协作 |
| GitHub | 代码管理、Issue追踪 |
| 飞书文档 | 需求文档、设计文档 |
| 飞书会议 | 远程会议、评审 |

### 5.3 用户反馈收集与处理流程

#### 反馈收集渠道

| 渠道 | 方式 | 适用场景 |
|------|------|---------|
| 应用内反馈 | 反馈表单 | 功能问题、建议 |
| 客服邮箱 | email | 详细问题描述 |
| 用户访谈 | 一对一 | 深度需求调研 |
| 数据分析 | 行为分析 | 使用模式、痛点 |

#### 反馈处理流程

```
收集反馈 → 分类整理 → 优先级评估 → 开发排期 → 功能实现 → 用户通知
```

| 步骤 | 操作 | 责任人 |
|------|------|--------|
| 1 | 收集反馈 | 运营/客服 |
| 2 | 分类标签（bug/feature/improvement） | 产品经理 |
| 3 | 优先级排序 | 产品经理 |
| 4 | 纳入需求池 | 产品经理 |
| 5 | 排期开发 | 技术团队 |
| 6 | 功能上线 | DevOps |
| 7 | 通知用户 | 运营团队 |

#### 反馈响应时间

| 反馈类型 | 响应时间 | 解决时间 |
|----------|---------|---------|
| 紧急bug | 2小时内 | 24小时内 |
| 一般bug | 1个工作日 | 7个工作日 |
| 功能建议 | 3个工作日 | 视排期而定 |
| 优化建议 | 1周内 | 视排期而定 |

---

## 6. 附录

### 6.1 现有API接口列表

#### 用户模块

| 接口 | 方法 | 描述 |
|------|------|------|
| `/api/auth/register` | POST | 用户注册 |
| `/api/auth/login` | POST | 用户登录 |
| `/api/auth/guest-login` | POST | 游客登录 |
| `/api/user/profile` | GET/PUT | 用户档案 |
| `/api/user/initialize` | POST | 用户初始化 |
| `/api/user/subjects` | GET/POST | 用户选科 |

#### 考试趋势模块

| 接口 | 方法 | 描述 |
|------|------|------|
| `/api/trends/province/:code` | GET | 省份趋势 |
| `/api/trends/province/compare` | GET | 趋势对比 |
| `/api/trends/subject/:subject` | GET | 学科趋势 |
| `/api/trends/expert-summary` | GET | 专家总结 |

#### 视觉搜题模块

| 接口 | 方法 | 描述 |
|------|------|------|
| `/api/vision/parse` | POST | 图片解析 |
| `/api/vision/search` | POST | 拍照搜题 |

#### 错题管理模块

| 接口 | 方法 | 描述 |
|------|------|------|
| `/api/wrong-questions` | GET/POST | 错题列表/添加 |
| `/api/wrong-questions/:id` | GET/PUT/DELETE | 错题详情/更新/删除 |
| `/api/wrong-questions/stats` | GET | 错题统计 |

#### 知识画像模块

| 接口 | 方法 | 描述 |
|------|------|------|
| `/api/knowledge/profile` | GET | 知识画像 |
| `/api/loop/mastery` | GET | 掌握度概览 |
| `/api/loop/graph` | GET | 知识图谱 |
| `/api/loop/feedback` | POST | 学习反馈 |

#### 学习计划模块

| 接口 | 方法 | 描述 |
|------|------|------|
| `/api/study-plan` | GET/POST | 学习计划列表/创建 |
| `/api/study-plan/:id` | GET/PUT/DELETE | 计划详情/更新/删除 |
| `/api/generate-paper` | POST | 生成模拟卷 |

### 6.2 数据库表关系图

```
users ──── user_profiles ──── user_subjects
    │            │                    │
    │            │                    └── subjects
    │            │
    │            └── provinces
    │
    ├── wrong_questions ──── wrong_question_categories
    │
    ├── practice_records ──── exam_questions
    │                              │
    │                              ├── exam_papers
    │                              ├── knowledge_points
    │                              └── question_knowledge_points
    │
    ├── student_knowledge_mastery ──── srs_review_log
    │
    └── learning_plans ──── learning_tasks
```

### 6.3 技术债务清单

| 编号 | 债务描述 | 严重程度 | 建议处理时间 |
|------|---------|---------|------------|
| TD-001 | 前端代码库存在三个平行版本（frontend/, frontend/redesign/, ai-tutor-frontend/） | 高 | 2周内启动整合 |
| TD-002 | 架构文档（.qoder/repowiki）仍引用SQLite，实际使用PostgreSQL | 中 | 1周内更新文档 |
| TD-003 | 部分API缺乏单元测试覆盖 | 中 | 4周内补充 |
| TD-004 | 数据库表结构存在冗余字段（如users与user_profiles） | 低 | 后续迭代优化 |
| TD-005 | 日志系统缺乏统一管理，仅使用console.log | 中 | 3周内升级 |

### 6.3.1 前端代码库整合计划

#### 当前代码库分析

| 代码库 | 路径 | 状态 | 页面数量 | 特点 |
|--------|------|------|---------|------|
| frontend/ | `frontend/` | 维护中 | 28个页面 | 原始PC端MPA，包含各学科考试/报告页 |
| frontend/redesign/ | `frontend/redesign/` | **主力** | 16个页面 | 重新设计，统一设计规范，响应式布局 |
| ai-tutor-frontend/ | `ai-tutor-frontend/` | 已废弃 | 8个页面 | 旧版框架，不再维护 |

#### 整合目标

- 将所有页面统一到 `frontend/redesign/` 作为唯一前端代码库
- 保持URL路径不变，确保向后兼容
- 统一设计规范，消除样式不一致问题
- 减少代码重复，降低维护成本

#### 整合步骤

| 阶段 | 时间 | 任务 | 交付物 |
|------|------|------|--------|
| 第一阶段 | 第1周 | 页面清单梳理，确定迁移优先级 | 页面迁移优先级清单 |
| 第二阶段 | 第2周 | 迁移考试/报告页面（数学/物理/化学/语文/英语/政治） | 迁移后的学科页面 |
| 第三阶段 | 第3周 | 迁移政策/专题页面（2026-policy、methodology等） | 迁移后的专题页面 |
| 第四阶段 | 第4周 | 清理废弃代码库，更新服务器配置 | 清理后的代码库 |
| 第五阶段 | 第5周 | 回归测试，修复兼容性问题 | 测试报告 |

#### 页面迁移优先级

| 优先级 | 页面 | 来源 | 目标 | 理由 |
|--------|------|------|------|------|
| P0 | math-exam.html | frontend/ | redesign/math-exam.html | 高频使用 |
| P0 | physics-exam.html | frontend/ | redesign/physics-exam.html | 高频使用 |
| P0 | chemistry-exam.html | frontend/ | redesign/chemistry-exam.html | 高频使用 |
| P0 | chinese-exam.html | frontend/ | redesign/chinese-exam.html | 高频使用 |
| P0 | english-exam.html | frontend/ | redesign/english-exam.html | 高频使用 |
| P1 | politics-exam.html | frontend/ | redesign/politics-exam.html | 中等使用 |
| P1 | math-report.html | frontend/ | redesign/math-report.html | 高频使用 |
| P1 | physics-report.html | frontend/ | redesign/physics-report.html | 高频使用 |
| P1 | chemistry-report.html | frontend/ | redesign/chemistry-report.html | 高频使用 |
| P1 | chinese-report.html | frontend/ | redesign/chinese-report.html | 高频使用 |
| P2 | english-report.html | frontend/ | redesign/english-report.html | 中等使用 |
| P2 | politics-report.html | frontend/ | redesign/politics-report.html | 中等使用 |
| P2 | exam-view.html | frontend/ | redesign/exam-view.html | 中等使用 |
| P2 | learning-path.html | frontend/ | redesign/learning-path.html | 中等使用 |
| P2 | province.html | frontend/ | redesign/province.html | 中等使用 |
| P3 | 2026-policy.html | frontend/ | redesign/2026-policy.html | 低频使用 |
| P3 | zhongkao-policy.html | frontend/ | redesign/zhongkao-policy.html | 低频使用 |
| P3 | methodology.html | frontend/ | redesign/methodology.html | 低频使用 |

#### 技术方案

1. **样式迁移**: 使用design tokens（tokens.css）统一颜色、字体、间距
2. **组件复用**: 提取通用组件（Card、Button、Input、Tag）到公共目录
3. **路由统一**: 使用统一的router.js管理页面导航
4. **响应式适配**: 使用Tailwind CSS实现响应式布局
5. **渐进式迁移**: 先迁移核心页面，再迁移次要页面

#### 风险与应对

| 风险 | 概率 | 影响 | 应对策略 |
|------|------|------|---------|
| 页面样式不一致 | 高 | 中 | 使用design tokens强制统一 |
| JavaScript功能回归 | 中 | 高 | 详细测试用例，回归测试 |
| URL路径变更 | 中 | 高 | 保持原有URL路径，重定向支持 |
| 开发时间超预期 | 中 | 中 | 分阶段迁移，优先核心页面 |

### 6.4 风险登记册

| 风险编号 | 风险描述 | 发生概率 | 影响程度 | 应对策略 |
|---------|---------|---------|---------|---------|
| R-001 | AI服务调用超时影响用户体验 | 中 | 高 | 设置超时时间、异步处理 |
| R-002 | 数据库连接池耗尽 | 低 | 高 | 监控连接数、自动扩容 |
| R-003 | 用户上传恶意图片 | 中 | 中 | 图片安全检查、文件大小限制 |
| R-004 | API被恶意攻击 | 中 | 中 | 速率限制、WAF防护 |
| R-005 | 向量索引构建时间过长 | 低 | 中 | 异步构建、增量更新 |
| R-006 | 前端代码库整合导致功能回归 | 高 | 中 | 充分测试、灰度发布 |

---

**文档版本历史**:

| 版本 | 日期 | 修改内容 | 修改人 |
|------|------|---------|--------|
| v1.0 | 2026-07-15 | 初始版本 | AI Tutor团队 |