# AI家教学习辅助系统 - 实现计划

## [x] Task 1: 修复 `student_knowledge_mastery` 表 mastery_score 范围不一致问题
- **Priority**: high
- **Depends On**: None
- **Description**: 
  - 修改 `db.js` 中 `student_knowledge_mastery` 表的 `mastery_score` 字段定义，将范围从 0-1 改为 0-100
  - 确保 `knowledge-profile.js` 中的计算逻辑与数据库定义一致
- **Acceptance Criteria Addressed**: AC-5
- **Test Requirements**:
  - `programmatic` TR-1.1: POST /api/knowledge-profile/update 成功更新 mastery_score，值在 0-100 范围内
  - `programmatic` TR-1.2: GET /api/knowledge-profile 返回的 mastery_score 值在 0-100 范围内
- **Notes**: 需要检查所有引用 mastery_score 的代码，确保一致性

## [x] Task 2: 修复 `learning_plans` 表与 `study-plan.js` 处理程序列名不一致问题
- **Priority**: high
- **Depends On**: None
- **Description**: 
  - 统一 `learning_plans` 表结构与 `study-plan.js` 中的列名引用
  - 表中使用 `title`、`plan_type`、`tasks`、`completion_rate`，处理程序使用 `plan_title`、`subject_code`、`plan_data`、`completed_tasks`、`total_tasks`
  - 需要决定以哪套命名为准并统一
- **Acceptance Criteria Addressed**: AC-7
- **Test Requirements**:
  - `programmatic` TR-2.1: POST /api/study-plan/generate 成功保存学习计划到数据库
  - `programmatic` TR-2.2: GET /api/study-plan/plans 返回完整的学习计划数据
- **Notes**: 建议以表结构为准，修改处理程序代码

## [x] Task 3: 修复 `wrong_questions` 表双模式问题
- **Priority**: high
- **Depends On**: None
- **Description**: 
  - 统一 `wrong_questions` 表的访问模式，选择使用结构化列（`content`、`knowledge_point_name`、`error_category`等）还是 `data TEXT` 列
  - 修改 `generate-paper.js`、`visionSearchService.js` 等使用旧模式的代码
- **Acceptance Criteria Addressed**: AC-4, AC-8
- **Test Requirements**:
  - `programmatic` TR-3.1: 拍照搜题后错题正确保存到数据库
  - `programmatic` TR-3.2: GET /api/wrong-questions 返回完整的错题数据（包含错误分类）
- **Notes**: 建议迁移到结构化列，便于查询和统计

## [x] Task 4: 实现错题PDF导出功能
- **Priority**: high
- **Depends On**: Task 3
- **Description**: 
  - 在 `wrong-questions.js` 中添加 PDF 导出功能
  - 使用 PDF 生成库（如 pdfkit 或 puppeteer）生成错题集
  - PDF 包含题目内容、答案、解析、错误分类等信息
- **Acceptance Criteria Addressed**: AC-8
- **Test Requirements**:
  - `programmatic` TR-4.1: GET /api/wrong-questions/export?format=pdf 返回有效的 PDF 文件
  - `human-judgment` TR-4.2: PDF 内容排版清晰，包含题目、答案和解析
- **Notes**: 需要安装 PDF 生成依赖包

## [x] Task 5: 实现拍照搜题图像预处理功能
- **Priority**: medium
- **Depends On**: None
- **Description**: 
  - 在前端添加图片裁剪、旋转、亮度调整功能
  - 使用 Canvas API 实现图片处理
  - 处理后的图片重新提交进行识别
- **Acceptance Criteria Addressed**: AC-3, AC-9
- **Test Requirements**:
  - `human-judgment` TR-5.1: 用户可以裁剪、旋转和调整图片亮度
  - `programmatic` TR-5.2: 处理后的图片成功上传并识别
- **Notes**: 需要在 vision.html 或相关页面添加图片编辑功能

## [x] Task 6: 集成图表可视化库（ECharts）
- **Priority**: medium
- **Depends On**: None
- **Description**: 
  - 在前端集成 ECharts 图表库
  - 为考试趋势分析页面实现题型分布图表、难度系数曲线
  - 为知识掌握画像页面实现知识图谱可视化
- **Acceptance Criteria Addressed**: AC-2, AC-5
- **Test Requirements**:
  - `human-judgment` TR-6.1: 考试趋势分析页面展示清晰的图表
  - `human-judgment` TR-6.2: 知识掌握画像页面展示可视化知识图谱
- **Notes**: 使用 CDN 引入 ECharts，避免增加打包体积

## [x] Task 7: 实现学习计划进度跟踪与完成度统计
- **Priority**: medium
- **Depends On**: Task 2
- **Description**: 
  - 在 `learning_plans` 和 `learning_tasks` 表中添加完成度统计字段
  - 在 `study-plan.js` 中实现完成度计算逻辑
  - 前端展示学习计划完成进度条和统计数据
- **Acceptance Criteria Addressed**: AC-7
- **Test Requirements**:
  - `programmatic` TR-7.1: 更新任务状态后，完成度正确计算
  - `human-judgment` TR-7.2: 前端展示学习计划完成进度条
- **Notes**: 需要确保学习任务的状态更新能正确反映到计划完成度

## [ ] Task 8: 前端目录整合与响应式优化
- **Priority**: medium
- **Depends On**: None
- **Description**: 
  - 选择 `ai-tutor-redesign/` 作为主要前端目录
  - 将其他目录的有用功能迁移到主目录
  - 优化现有页面的响应式布局，确保在手机端显示良好
- **Acceptance Criteria Addressed**: AC-10
- **Test Requirements**:
  - `human-judgment` TR-8.1: 主要页面在手机、平板、PC端布局合理
  - `human-judgment` TR-8.2: 交互流畅，无明显布局错乱
- **Notes**: 逐步整合，优先确保核心功能页面的响应式适配

## [ ] Task 9: 优化 API 响应性能
- **Priority**: medium
- **Depends On**: None
- **Description**: 
  - 优化数据库查询，添加必要索引
  - 实现缓存策略，减少重复查询
  - 压缩 API 响应数据
- **Acceptance Criteria Addressed**: NFR-2
- **Test Requirements**:
  - `programmatic` TR-9.1: API 响应时间 < 500ms
  - `programmatic` TR-9.2: 页面加载时间 < 2秒
- **Notes**: 使用 Chrome DevTools 进行性能分析

## [ ] Task 10: 完善用户初始化流程前端页面
- **Priority**: low
- **Depends On**: None
- **Description**: 
  - 创建或完善用户初始化页面（年级、地区、选科选择）
  - 添加表单验证和错误提示
  - 确保与后端 API 的数据格式一致
- **Acceptance Criteria Addressed**: AC-1
- **Test Requirements**:
  - `programmatic` TR-10.1: POST /api/user/initialize 成功完成用户初始化
  - `human-judgment` TR-10.2: 用户初始化流程清晰，表单验证友好
- **Notes**: 需要检查现有初始化页面是否存在，可能在 login.html 或 dashboard.html 中