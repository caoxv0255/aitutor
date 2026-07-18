# 高中学习辅助系统开发计划

## 一、项目现状分析

### 1.1 已有架构
| 层级 | 技术栈 | 状态 |
|------|--------|------|
| 后端框架 | Express.js + Node.js 22 | ✅ 已搭建 |
| 数据库 | PostgreSQL + Apache AGE + pgvector | ✅ 已搭建 |
| AI能力 | DashScope (qwen-vl-max / text-embedding-v3) | ✅ 已集成 |
| 前端 | Vanilla JS + Tailwind CSS + 响应式设计 | ✅ 已搭建 |
| 核心能力 | Hybrid RAG、SRS引擎、Vision RAG | ✅ 已实现 |

### 1.2 现有功能模块
| 模块 | 文件位置 | 状态 |
|------|----------|------|
| 用户认证 | `api/handlers/login.js`, `api/handlers/register.js` | ✅ 基础登录/注册 |
| 错题管理 | `api/handlers/questions.js` | ✅ CRUD操作 |
| 学习循环 | `api/routes/learning-loop.js` | ✅ 掌握度更新+图谱涟漪 |
| 省份趋势 | `api/handlers/province-trends.js` | ✅ 高考趋势分析 |
| AI讲题 | `api/routes/tutor-agent.js` | ✅ SSE流式讲解 |
| 智能组卷 | `api/handlers/generate-paper.js` | ✅ 基础组卷 |
| 拍照识别 | `api/routes/vision-parse.js` | ✅ 多模态解析 |

### 1.3 需要新增/完善的功能
| 用户需求 | 现有状态 | 需做工作 |
|----------|----------|----------|
| 用户初始化（年级/地区/选科） | 仅支持年级 | 新增地区选择、选科配置、初始化流程 |
| 考试趋势分析（中考+高考） | 仅高考 | 扩展中考支持、增强可视化 |
| 拍照搜题 | 基础识别 | 增加图像预处理、相似度排序、云端降级 |
| 错题记录与分析 | 基础CRUD | 增加错误原因分类、多维度筛选、PDF导出 |
| 知识掌握画像 | 数据层完成 | 前端可视化知识图谱、个性化建议 |
| 学习计划生成 | 无 | 新增学习计划推荐算法、进度跟踪 |

---

## 二、数据库设计

### 2.1 新增表结构

#### 表1: `user_subjects`（用户选科关系表）
```sql
CREATE TABLE IF NOT EXISTS user_subjects (
  id SERIAL PRIMARY KEY,
  user_email VARCHAR(255) NOT NULL,
  subject_code VARCHAR(20) NOT NULL REFERENCES subjects(code),
  is_main BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_email, subject_code)
);

CREATE INDEX idx_user_subjects_user ON user_subjects(user_email);
CREATE INDEX idx_user_subjects_subject ON user_subjects(subject_code);
```

#### 表2: `user_profiles`（用户完整档案）
```sql
CREATE TABLE IF NOT EXISTS user_profiles (
  id SERIAL PRIMARY KEY,
  user_email VARCHAR(255) UNIQUE NOT NULL,
  grade_code VARCHAR(20) REFERENCES grades(code),
  province_code VARCHAR(20) REFERENCES provinces(code),
  exam_level VARCHAR(10),
  target_score INTEGER,
  study_hours_per_day INTEGER DEFAULT 2,
  weak_subjects TEXT DEFAULT '[]',
  preferences JSONB DEFAULT '{}',
  initialized BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_profiles_email ON user_profiles(user_email);
CREATE INDEX idx_user_profiles_province ON user_profiles(province_code);
CREATE INDEX idx_user_profiles_exam_level ON user_profiles(exam_level);
```

#### 表3: `wrong_question_categories`（错题分类原因）
```sql
CREATE TABLE IF NOT EXISTS wrong_question_categories (
  id SERIAL PRIMARY KEY,
  code VARCHAR(30) UNIQUE NOT NULL,
  name VARCHAR(50) NOT NULL,
  description TEXT,
  icon VARCHAR(50),
  sort_order INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1
);

INSERT INTO wrong_question_categories (code, name, description, icon) VALUES
  ('concept', '概念不清', '对基本概念、定义理解不透彻', 'brain'),
  ('calculation', '计算失误', '计算过程中出现错误', 'calculator'),
  ('misread', '审题偏差', '理解题意时出现偏差', 'eye'),
  ('method', '方法不当', '解题方法选择不合适', 'lightbulb'),
  ('careless', '粗心大意', '因疏忽导致的错误', 'alert-circle'),
  ('time', '时间不足', '考试时间紧张导致未完成', 'clock'),
  ('knowledge', '知识漏洞', '相关知识点掌握不牢固', 'book-open'),
  ('other', '其他原因', '其他未分类的错误原因', 'more-horizontal')
ON CONFLICT (code) DO NOTHING;
```

#### 表4: `learning_plans`（学习计划）
```sql
CREATE TABLE IF NOT EXISTS learning_plans (
  id SERIAL PRIMARY KEY,
  user_email VARCHAR(255) NOT NULL,
  plan_type VARCHAR(20) NOT NULL, -- daily, weekly, monthly
  title VARCHAR(200) NOT NULL,
  description TEXT,
  target_knowledge_points TEXT DEFAULT '[]',
  tasks JSONB DEFAULT '[]',
  start_date DATE NOT NULL,
  end_date DATE,
  completion_rate NUMERIC(4,2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'active', -- active, completed, paused
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_learning_plans_user ON learning_plans(user_email);
CREATE INDEX idx_learning_plans_status ON learning_plans(status);
CREATE INDEX idx_learning_plans_date ON learning_plans(start_date);
```

#### 表5: `learning_tasks`（学习任务）
```sql
CREATE TABLE IF NOT EXISTS learning_tasks (
  id SERIAL PRIMARY KEY,
  plan_id INTEGER REFERENCES learning_plans(id) ON DELETE CASCADE,
  user_email VARCHAR(255) NOT NULL,
  task_type VARCHAR(20) NOT NULL, -- practice, review, video, quiz
  subject_code VARCHAR(20),
  knowledge_point_id VARCHAR(20),
  title VARCHAR(200) NOT NULL,
  description TEXT,
  target_count INTEGER DEFAULT 1,
  completed_count INTEGER DEFAULT 0,
  duration_minutes INTEGER,
  status VARCHAR(20) DEFAULT 'pending', -- pending, in_progress, completed, skipped
  priority INTEGER DEFAULT 3, -- 1-5
  due_date DATE,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_learning_tasks_plan ON learning_tasks(plan_id);
CREATE INDEX idx_learning_tasks_user ON learning_tasks(user_email);
CREATE INDEX idx_learning_tasks_status ON learning_tasks(status);
```

### 2.2 现有表扩展

#### `wrong_questions` 表扩展
```sql
ALTER TABLE wrong_questions ADD COLUMN IF NOT EXISTS error_category VARCHAR(30);
ALTER TABLE wrong_questions ADD COLUMN IF NOT EXISTS analysis_note TEXT;
ALTER TABLE wrong_questions ADD COLUMN IF NOT EXISTS reviewed INTEGER DEFAULT 0;
ALTER TABLE wrong_questions ADD COLUMN IF NOT EXISTS review_count INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_wrong_questions_category ON wrong_questions(error_category);
CREATE INDEX IF NOT EXISTS idx_wrong_questions_reviewed ON wrong_questions(reviewed);
```

---

## 三、后端API设计

### 3.1 用户初始化模块

| API端点 | 方法 | 描述 | 文件位置 |
|---------|------|------|----------|
| `/api/user/profile` | GET | 获取用户档案 | `api/handlers/user-profile.js` |
| `/api/user/profile` | POST | 更新用户档案 | `api/handlers/user-profile.js` |
| `/api/user/subjects` | GET | 获取用户选科 | `api/handlers/user-subjects.js` |
| `/api/user/subjects` | POST | 设置用户选科 | `api/handlers/user-subjects.js` |
| `/api/user/initialize` | POST | 完成初始化流程 | `api/handlers/user-initialize.js` |
| `/api/provinces` | GET | 获取省份列表 | `api/handlers/provinces.js` (已存在) |
| `/api/subjects` | GET | 获取学科列表 | `api/handlers/subjects.js` (新建) |

### 3.2 考试趋势分析模块

| API端点 | 方法 | 描述 | 文件位置 |
|---------|------|------|----------|
| `/api/trends/province/:code` | GET | 获取省份趋势 | `api/handlers/province-trends.js` (扩展) |
| `/api/trends/comparison` | GET | 多省份对比 | `api/handlers/province-trends.js` (已存在) |
| `/api/trends/subject/:subject` | GET | 学科趋势分析 | `api/handlers/subject-trends.js` (新建) |
| `/api/trends/expert-summary` | GET | 专家总结评价 | `api/handlers/trend-summary.js` (新建) |

### 3.3 拍照搜题模块

| API端点 | 方法 | 描述 | 文件位置 |
|---------|------|------|----------|
| `/api/vision/parse` | POST | 图像解析 | `api/routes/vision-parse.js` (扩展) |
| `/api/vision/search` | POST | 相似度搜索 | `api/handlers/vision-search.js` (新建) |
| `/api/vision/preprocess` | POST | 图像预处理 | `api/handlers/vision-preprocess.js` (新建) |

### 3.4 错题记录与分析模块

| API端点 | 方法 | 描述 | 文件位置 |
|---------|------|------|----------|
| `/api/questions` | GET | 错题列表(筛选) | `api/handlers/questions.js` (扩展) |
| `/api/questions` | POST | 添加错题 | `api/handlers/questions.js` (扩展) |
| `/api/questions/:id` | PUT | 更新错题 | `api/handlers/questions.js` (扩展) |
| `/api/questions/categories` | GET | 错误原因分类 | `api/handlers/question-categories.js` (新建) |
| `/api/questions/export` | GET | 导出PDF | `api/handlers/question-export.js` (新建) |
| `/api/questions/analysis` | GET | 错题分析统计 | `api/handlers/question-analysis.js` (新建) |

### 3.5 知识掌握画像模块

| API端点 | 方法 | 描述 | 文件位置 |
|---------|------|------|----------|
| `/api/loop/mastery` | GET | 掌握度概览 | `api/routes/learning-loop.js` (已存在) |
| `/api/loop/graph` | GET | 知识图谱 | `api/routes/learning-loop.js` (已存在) |
| `/api/profile/portrait` | GET | 用户画像 | `api/handlers/profile-portrait.js` (新建) |
| `/api/profile/weak-points` | GET | 薄弱知识点 | `api/handlers/weak-points.js` (新建) |
| `/api/profile/suggestions` | GET | 学习建议 | `api/handlers/learning-suggestions.js` (新建) |

### 3.6 学习计划模块

| API端点 | 方法 | 描述 | 文件位置 |
|---------|------|------|----------|
| `/api/plans` | GET | 获取学习计划 | `api/handlers/learning-plans.js` (新建) |
| `/api/plans` | POST | 创建学习计划 | `api/handlers/learning-plans.js` (新建) |
| `/api/plans/:id` | PUT | 更新学习计划 | `api/handlers/learning-plans.js` (新建) |
| `/api/plans/:id` | DELETE | 删除学习计划 | `api/handlers/learning-plans.js` (新建) |
| `/api/plans/generate` | POST | 智能生成计划 | `api/handlers/generate-plan.js` (新建) |
| `/api/tasks` | GET | 获取任务列表 | `api/handlers/learning-tasks.js` (新建) |
| `/api/tasks/:id/status` | PUT | 更新任务状态 | `api/handlers/learning-tasks.js` (新建) |

---

## 四、前端页面设计

### 4.1 新增页面

#### 页面1: 用户初始化页面 (`frontend/redesign/onboarding.html`)
- 步骤1: 年级选择（高一/高二/高三）
- 步骤2: 地区选择（全国各省/直辖市）
- 步骤3: 选科配置（符合新高考3+1+2/3+3模式）
- 进度指示器

#### 页面2: 考试趋势分析页面 (`frontend/redesign/trends-analysis.html`)
- 省份/学科选择器
- 题型分布图表（折线图）
- 难度系数变化曲线（面积图）
- 专家总结评价卡片
- 多维度筛选

#### 页面3: 拍照搜题页面 (`frontend/redesign/photo-search.html`)
- 相机/相册上传入口
- 图像预览与裁剪工具
- 识别结果展示
- 相似题目列表
- 知识点解析

#### 页面4: 知识掌握画像页面 (`frontend/redesign/mastery-portrait.html`)
- 知识图谱可视化
- 掌握度雷达图
- 薄弱点分析
- 个性化学习建议

#### 页面5: 学习计划页面 (`frontend/redesign/learning-plan.html`)
- 计划列表（日/周/月）
- 任务进度追踪
- 智能生成按钮
- 完成度统计

### 4.2 现有页面优化

| 页面 | 优化内容 |
|------|----------|
| `login.html` | 登录后判断是否已初始化，未初始化跳转至onboarding |
| `dashboard.html` | 集成用户档案信息、学习计划入口、薄弱点提醒 |
| `wrong-book.html` | 增加错误原因分类、多维度筛选、PDF导出按钮 |
| `exam-simulation.html` | 基于用户选科和薄弱点生成试卷 |

---

## 五、开发进度安排

### 阶段1: 需求分析与系统设计（1周）
- ✅ 完成需求文档（本计划）
- ✅ 完成数据库设计
- ✅ 完成API设计

### 阶段2: 用户初始化模块（2周）
| 任务 | 预计时间 | 负责人 |
|------|----------|--------|
| 创建 `user_profiles` 表 | 0.5天 | 开发 |
| 创建 `user_subjects` 表 | 0.5天 | 开发 |
| 实现用户档案API | 1天 | 开发 |
| 实现用户选科API | 1天 | 开发 |
| 创建初始化前端页面 | 2天 | 开发 |
| 集成登录后初始化判断 | 1天 | 开发 |

### 阶段3: 考试趋势分析模块（2周）
| 任务 | 预计时间 | 负责人 |
|------|----------|--------|
| 扩展省份趋势API支持中考 | 1天 | 开发 |
| 创建学科趋势API | 1天 | 开发 |
| 创建专家总结API | 1天 | 开发 |
| 创建趋势分析前端页面 | 3天 | 开发 |
| 集成ECharts图表库 | 1天 | 开发 |

### 阶段4: 拍照搜题模块（2周）
| 任务 | 预计时间 | 负责人 |
|------|----------|--------|
| 创建图像预处理API | 1天 | 开发 |
| 创建相似度搜索API | 2天 | 开发 |
| 扩展Vision解析API | 1天 | 开发 |
| 创建拍照搜题前端页面 | 3天 | 开发 |
| 实现图像裁剪/旋转功能 | 1天 | 开发 |

### 阶段5: 错题记录与分析模块（2周）
| 任务 | 预计时间 | 负责人 |
|------|----------|--------|
| 创建错误原因分类表 | 0.5天 | 开发 |
| 扩展错题表结构 | 0.5天 | 开发 |
| 实现错题分类API | 1天 | 开发 |
| 实现错题分析统计API | 1天 | 开发 |
| 实现PDF导出API | 1天 | 开发 |
| 优化错题本前端页面 | 3天 | 开发 |

### 阶段6: 知识掌握画像模块（2周）
| 任务 | 预计时间 | 负责人 |
|------|----------|--------|
| 创建用户画像API | 1天 | 开发 |
| 创建薄弱点API | 1天 | 开发 |
| 创建学习建议API | 1天 | 开发 |
| 创建画像前端页面 | 3天 | 开发 |
| 集成知识图谱可视化 | 1天 | 开发 |
| 实现雷达图展示 | 1天 | 开发 |

### 阶段7: 学习计划模块（2周）
| 任务 | 预计时间 | 负责人 |
|------|----------|--------|
| 创建学习计划表 | 0.5天 | 开发 |
| 创建学习任务表 | 0.5天 | 开发 |
| 实现计划CRUD API | 1天 | 开发 |
| 实现任务管理API | 1天 | 开发 |
| 实现智能生成算法 | 2天 | 开发 |
| 创建学习计划前端页面 | 3天 | 开发 |

### 阶段8: 集成测试与优化（2周）
| 任务 | 预计时间 | 负责人 |
|------|----------|--------|
| 模块间集成测试 | 2天 | 测试 |
| 功能测试 | 2天 | 测试 |
| 性能优化 | 2天 | 开发 |
| Bug修复 | 2天 | 开发 |

---

## 六、技术依赖与资源

### 6.1 新增依赖
| 依赖 | 用途 | 版本 |
|------|------|------|
| `echarts` | 数据可视化图表 | ^5.5.0 |
| `jspdf` | PDF生成 | ^2.5.2 |
| `jspdf-autotable` | PDF表格 | ^3.8.2 |
| `cropperjs` | 图像裁剪 | ^1.6.2 |
| `html2canvas` | HTML转图片 | ^1.4.1 |

### 6.2 API密钥
- DashScope API Key (已有)
- 可选：阿里云OCR服务（增强图像识别）

### 6.3 数据资源
- 省份数据：`database/seed_provinces.json` (已有)
- 知识点数据：`database/knowledge-points/` (已有)
- 考试真题数据：`database/高考真题/` (已有)

---

## 七、风险与应对

| 风险 | 影响 | 应对措施 |
|------|------|----------|
| 图像识别准确率不足 | 搜题功能体验差 | 引入图像预处理、多模型融合、人工审核机制 |
| 数据量过大导致性能下降 | 页面加载慢 | 实现分页、缓存策略、数据库索引优化 |
| 新高考选科组合复杂 | 选科逻辑复杂 | 预定义选科组合、动态验证规则 |
| 学习计划算法效果不佳 | 用户体验差 | 基于薄弱点生成、A/B测试优化算法 |
| PDF导出格式兼容性 | 导出失败 | 使用成熟库、支持多浏览器测试 |

---

## 八、验收标准

### 8.1 功能验收
- [ ] 用户可完成完整的初始化流程（年级/地区/选科）
- [ ] 考试趋势分析支持近3-5年数据，包含题型分布、难度系数、专家总结
- [ ] 拍照搜题支持图像裁剪、旋转，结果按相似度排序
- [ ] 错题本支持按知识点、题型、错误类型多维度筛选，支持PDF导出
- [ ] 知识掌握画像展示可视化知识图谱和个性化学习建议
- [ ] 学习计划支持智能生成、进度跟踪、完成度统计

### 8.2 性能验收
- [ ] 页面加载时间 < 2秒
- [ ] API响应时间 < 500ms
- [ ] 图像识别响应时间 < 3秒

### 8.3 兼容性验收
- [ ] 支持PC端（Chrome/Firefox/Safari/Edge）
- [ ] 支持移动端（iOS Safari/Android Chrome）
- [ ] 支持深色/浅色主题切换

---

## 九、文件清单

### 新增文件
```
├── api/handlers/
│   ├── user-profile.js
│   ├── user-subjects.js
│   ├── user-initialize.js
│   ├── subjects.js
│   ├── subject-trends.js
│   ├── trend-summary.js
│   ├── vision-search.js
│   ├── vision-preprocess.js
│   ├── question-categories.js
│   ├── question-export.js
│   ├── question-analysis.js
│   ├── profile-portrait.js
│   ├── weak-points.js
│   ├── learning-suggestions.js
│   ├── learning-plans.js
│   ├── learning-tasks.js
│   └── generate-plan.js
├── api/modules/
│   ├── user/
│   │   └── routes.js
│   ├── trends/
│   │   └── routes.js
│   └── plans/
│       └── routes.js
└── frontend/redesign/
    ├── onboarding.html
    ├── trends-analysis.html
    ├── photo-search.html
    ├── mastery-portrait.html
    └── learning-plan.html
```

### 修改文件
```
├── api/handlers/
│   ├── register.js
│   ├── login.js
│   ├── questions.js
│   └── province-trends.js
├── api/core/
│   └── db.js
├── api/modules/
│   └── index.js
├── frontend/redesign/
│   ├── login.html
│   ├── dashboard.html
│   ├── wrong-book.html
│   └── exam-simulation.html
└── server.js
```

---

## 十、项目启动

### 10.1 前置条件
- Node.js >= 22
- PostgreSQL >= 15（含Apache AGE + pgvector扩展）
- npm >= 8

### 10.2 安装命令
```bash
cd aitutor
npm install
npm install echarts jspdf jspdf-autotable cropperjs html2canvas
```

### 10.3 数据库初始化
```bash
# 确保数据库已创建并配置好环境变量
cp .env.example .env
# 启动服务器后自动初始化表结构
```

### 10.4 启动命令
```bash
npm start
# 访问 http://localhost:3002
```

---

**文档版本**: v1.0  
**创建日期**: 2026-07-15  
**适用项目**: aitutor 高中学习辅助系统