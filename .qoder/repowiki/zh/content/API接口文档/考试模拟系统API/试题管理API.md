# 试题管理API

<cite>
**本文档引用的文件**
- [questions.js](file://api/questions.js)
- [exam-questions.js](file://api/exam-questions.js)
- [knowledge-points.js](file://api/knowledge-points.js)
- [db.js](file://api/db.js)
- [validator.js](file://api/utils/validator.js)
- [response.js](file://api/utils/response.js)
- [errorHandler.js](file://api/middleware/errorHandler.js)
- [swagger.js](file://api/swagger.js)
- [subjectMap.js](file://api/utils/subjectMap.js)
- [subjectCombinations.js](file://api/utils/subjectCombinations.js)
- [llmParser.js](file://api/utils/llmParser.js)
- [prompts.js](file://api/utils/prompts.js)
- [cache.js](file://api/utils/cache.js)
- [tasks.js](file://api/tasks.js)
- [taskWorker.js](file://api/taskWorker.js)
- [explain-question.js](file://api/explain-question.js)
- [generate-paper.js](file://api/generate-paper.js)
- [adaptive-difficulty.js](file://api/adaptive-difficulty.js)
- [seed-papers.cjs](file://seed-papers.cjs)
- [import-all.sh](file://database/import_all.sh)
- [parse-questions.js](file://scripts/parse-questions.js)
- [build_subject_indexes.py](file://scripts/build_subject_indexes.py)
- [convert_documents.py](file://scripts/convert_documents.py)
- [split_by_subject.py](file://scripts/split_by_subject.py)
- [run_graphrag_index.py](file://scripts/run_graphrag_index.py)
- [setup_graphrag.sh](file://scripts/init_graphrag_service.sh)
- [graphrag_service/main.py](file://graphrag_service/main.py)
- [graphrag_service/config.py](file://graphrag_service/config.py)
- [graphrag_service/indexer.py](file://graphrag_service/indexer.py)
- [graphrag_service/db.py](file://graphrag_service/db.py)
</cite>

## 目录
1. [简介](#简介)
2. [项目结构](#项目结构)
3. [核心组件](#核心组件)
4. [架构概览](#架构概览)
5. [详细组件分析](#详细组件分析)
6. [依赖分析](#依赖分析)
7. [性能考虑](#性能考虑)
8. [故障排除指南](#故障排除指南)
9. [结论](#结论)
10. [附录](#附录)

## 简介
AI家教项目的试题管理API是整个教育平台的核心功能模块，负责管理各类题目的全生命周期。该系统支持多种学科、题目类型和难度等级，提供完整的试题增删改查、批量操作和关联管理功能。

本API系统具有以下关键特性：
- 多学科支持：数学、物理、化学、生物、语文、英语、政治、历史等
- 智能解析：基于LLM的内容解析和答案生成
- 知识点关联：与知识图谱系统的深度集成
- 批量处理：支持大规模试题的导入导出
- 版本控制：试题的版本管理和变更追踪
- 自适应难度：根据学生表现动态调整题目难度

## 项目结构
试题管理API采用模块化设计，主要分布在api目录下，与数据库层、工具层和业务逻辑层分离：

```mermaid
graph TB
subgraph "API层"
Q[questions.js<br/>试题主控制器]
EQ[exam-questions.js<br/>试卷试题关联]
KP[knowledge-points.js<br/>知识点管理]
EP[exam-papers.js<br/>试卷管理]
EX[explain-question.js<br/>题目解析]
GP[generate-paper.js<br/>试卷生成]
AD[adaptive-difficulty.js<br/>自适应难度]
end
subgraph "工具层"
V[validator.js<br/>数据验证]
R[response.js<br/>响应处理]
EH[errorHandler.js<br/>错误处理]
LLM[llmParser.js<br/>LLM解析器]
P[prompts.js<br/>提示模板]
S[subjectMap.js<br/>学科映射]
SC[subjectCombinations.js<br/>学科组合]
C[cache.js<br/>缓存管理]
end
subgraph "数据库层"
DB[db.js<br/>数据库连接]
TSK[tasks.js<br/>任务队列]
TSW[taskWorker.js<br/>任务执行器]
end
subgraph "脚本层"
PQ[parse-questions.js<br/>试题解析]
BI[build_subject_indexes.py<br/>学科索引]
CD[convert_documents.py<br/>文档转换]
SB[split_by_subject.py<br/>按学科分割]
RG[run_graphrag_index.py<br/>RAG索引]
SG[setup_graphrag.sh<br/>服务初始化]
end
Q --> V
Q --> R
Q --> DB
Q --> LLM
Q --> C
EQ --> DB
KP --> DB
EX --> LLM
GP --> DB
AD --> DB
V --> S
V --> SC
TSK --> TSW
TSW --> DB
```

**图表来源**
- [questions.js](file://api/questions.js)
- [db.js](file://api/db.js)
- [validator.js](file://api/utils/validator.js)
- [llmParser.js](file://api/utils/llmParser.js)

**章节来源**
- [questions.js](file://api/questions.js)
- [db.js](file://api/db.js)
- [validator.js](file://api/utils/validator.js)

## 核心组件
试题管理API由多个相互协作的组件构成，每个组件都有明确的职责分工：

### 主控制器组件
- **questions.js**: 核心试题管理控制器，处理所有试题相关的HTTP请求
- **exam-questions.js**: 管理试题与试卷的关联关系
- **knowledge-points.js**: 维护知识点标签系统

### 工具组件
- **validator.js**: 数据验证和格式检查
- **response.js**: 统一的API响应格式处理
- **errorHandler.js**: 错误处理和异常管理
- **llmParser.js**: 基于大语言模型的试题解析
- **prompts.js**: 提示词模板管理

### 数据库组件
- **db.js**: 数据库连接和事务管理
- **tasks.js**: 异步任务队列管理
- **taskWorker.js**: 后台任务执行器

**章节来源**
- [questions.js](file://api/questions.js)
- [exam-questions.js](file://api/exam-questions.js)
- [knowledge-points.js](file://api/knowledge-points.js)
- [validator.js](file://api/utils/validator.js)
- [response.js](file://api/utils/response.js)
- [errorHandler.js](file://api/middleware/errorHandler.js)

## 架构概览
试题管理API采用分层架构设计，确保了良好的可维护性和扩展性：

```mermaid
graph TB
subgraph "表示层"
Client[客户端应用]
WebUI[Web界面]
Mobile[移动端应用]
end
subgraph "控制层"
Auth[认证中间件]
Validator[数据验证]
ErrorHandler[错误处理]
end
subgraph "业务逻辑层"
QuestionService[试题服务]
ExamQuestionService[试卷试题服务]
KnowledgePointService[知识点服务]
PaperService[试卷服务]
end
subgraph "数据访问层"
QuestionDAO[试题DAO]
ExamQuestionDAO[试卷试题DAO]
KnowledgePointDAO[知识点DAO]
PaperDAO[试卷DAO]
end
subgraph "外部服务"
LLM[大语言模型]
Cache[缓存系统]
GraphRAG[知识图谱RAG]
end
Client --> Auth
WebUI --> Auth
Mobile --> Auth
Auth --> Validator
Validator --> QuestionService
QuestionService --> QuestionDAO
QuestionService --> ExamQuestionService
QuestionService --> KnowledgePointService
ExamQuestionService --> ExamQuestionDAO
KnowledgePointService --> KnowledgePointDAO
QuestionService --> LLM
QuestionService --> Cache
QuestionService --> GraphRAG
QuestionDAO --> DB[(数据库)]
ExamQuestionDAO --> DB
KnowledgePointDAO --> DB
PaperDAO --> DB
```

**图表来源**
- [questions.js](file://api/questions.js)
- [db.js](file://api/db.js)
- [llmParser.js](file://api/utils/llmParser.js)
- [cache.js](file://api/utils/cache.js)

### 数据流图
试题管理系统的核心数据流包括试题创建、更新、查询和删除等操作：

```mermaid
sequenceDiagram
participant Client as 客户端
participant API as API控制器
participant Service as 业务服务
participant Validator as 验证器
participant DB as 数据库
participant LLM as LLM解析器
Client->>API : 创建试题请求
API->>Validator : 验证输入数据
Validator-->>API : 验证结果
API->>Service : 处理业务逻辑
Service->>LLM : 解析试题内容
LLM-->>Service : 解析结果
Service->>DB : 保存到数据库
DB-->>Service : 保存成功
Service-->>API : 返回结果
API-->>Client : 响应结果
```

**图表来源**
- [questions.js](file://api/questions.js)
- [validator.js](file://api/utils/validator.js)
- [llmParser.js](file://api/utils/llmParser.js)
- [db.js](file://api/db.js)

## 详细组件分析

### 试题主控制器 (questions.js)
试题主控制器是整个API的核心入口，负责处理所有与试题相关的操作：

#### 核心功能
- **CRUD操作**: 完整的创建、读取、更新、删除功能
- **批量操作**: 支持批量导入、导出和更新
- **搜索过滤**: 多维度的搜索和过滤功能
- **分页查询**: 高效的分页和排序机制

#### 数据模型
```mermaid
classDiagram
class Question {
+uuid id
+string content
+string subject
+string type
+string difficulty
+array options
+string answer
+string explanation
+array knowledgePoints
+object metadata
+datetime createdAt
+datetime updatedAt
}
class QuestionInput {
+string content
+string subject
+string type
+string difficulty
+array options
+string answer
+string explanation
+array knowledgePoints
+object metadata
}
class QuestionFilter {
+string subject
+string type
+string difficulty
+array knowledgePoints
+datetime createdAt
+number page
+number limit
+string sortBy
+string sortOrder
}
QuestionInput --> Question : creates
QuestionFilter --> Question : filters
```

**图表来源**
- [questions.js](file://api/questions.js)

#### API端点设计
系统提供RESTful风格的API端点：

| 方法 | 端点 | 描述 | 权限 |
|------|------|------|------|
| GET | `/api/questions` | 获取试题列表 | 任意用户 |
| GET | `/api/questions/{id}` | 获取单个试题 | 任意用户 |
| POST | `/api/questions` | 创建新试题 | 教师/管理员 |
| PUT | `/api/questions/{id}` | 更新试题 | 教师/管理员 |
| DELETE | `/api/questions/{id}` | 删除试题 | 教师/管理员 |
| POST | `/api/questions/batch` | 批量操作 | 教师/管理员 |
| GET | `/api/questions/search` | 搜索试题 | 任意用户 |

**章节来源**
- [questions.js](file://api/questions.js)

### 试卷试题关联管理 (exam-questions.js)
该组件专门处理试题与试卷之间的关联关系：

#### 关联关系模型
```mermaid
erDiagram
EXAM_PAPER {
uuid id PK
string title
array questionIds
number totalScore
datetime createdAt
}
QUESTION {
uuid id PK
string content
string subject
string type
string difficulty
array knowledgePoints
}
EXAM_QUESTION_ASSOCIATION {
uuid examPaperId FK
uuid questionId FK
number order
number score
datetime assignedAt
}
EXAM_PAPER ||--o{ EXAM_QUESTION_ASSOCIATION : contains
QUESTION ||--o{ EXAM_QUESTION_ASSOCIATION : assigned_to
```

**图表来源**
- [exam-questions.js](file://api/exam-questions.js)

#### 核心功能
- **关联创建**: 将试题添加到指定试卷
- **关联移除**: 从试卷中移除试题
- **顺序管理**: 控制试题在试卷中的显示顺序
- **分数分配**: 为每道试题分配分值

**章节来源**
- [exam-questions.js](file://api/exam-questions.js)

### 知识点管理系统 (knowledge-points.js)
知识点系统是AI家教的重要组成部分，提供智能的知识点标签和关联：

#### 知识点层次结构
```mermaid
graph TD
Subject[学科] --> Topic[主题]
Topic --> Subtopic[子主题]
Subtopic --> KnowledgePoint[知识点]
Mathematics[数学] --> Algebra[代数]
Mathematics --> Geometry[几何]
Mathematics --> Calculus[微积分]
Physics[物理] --> Mechanics[力学]
Physics --> Thermodynamics[热力学]
Physics --> Electromagnetism[电磁学]
Chemistry[化学] --> OrganicChemistry[有机化学]
Chemistry --> InorganicChemistry[无机化学]
Chemistry --> PhysicalChemistry[物理化学]
```

**图表来源**
- [knowledge-points.js](file://api/knowledge-points.js)

#### 功能特性
- **层级管理**: 支持多级知识点组织
- **智能关联**: 自动关联相关知识点
- **标签系统**: 提供灵活的标签管理
- **搜索优化**: 支持基于知识点的智能搜索

**章节来源**
- [knowledge-points.js](file://api/knowledge-points.js)

### 数据验证系统 (validator.js)
数据验证是确保系统稳定性的关键组件：

#### 验证规则
```mermaid
flowchart TD
Start([开始验证]) --> ValidateInput["验证输入参数"]
ValidateInput --> CheckRequired{"检查必填字段"}
CheckRequired --> |缺失| ReturnError["返回验证错误"]
CheckRequired --> |完整| CheckFormat["检查数据格式"]
CheckFormat --> CheckSubject{"学科验证"}
CheckSubject --> |无效| ReturnSubjectError["返回学科错误"]
CheckSubject --> |有效| CheckType{"题目类型验证"}
CheckType --> |无效| ReturnTypeError["返回类型错误"]
CheckType --> |有效| CheckDifficulty{"难度等级验证"}
CheckDifficulty --> |无效| ReturnDifficultyError["返回难度错误"]
CheckDifficulty --> |有效| CheckKnowledge{"知识点验证"}
CheckKnowledge --> |无效| ReturnKnowledgeError["返回知识点错误"]
CheckKnowledge --> |有效| CheckContent["检查内容长度"]
CheckContent --> CheckContentValid{"内容有效?"}
CheckContentValid --> |否| ReturnContentError["返回内容错误"]
CheckContentValid --> |是| ReturnSuccess["返回验证通过"]
```

**图表来源**
- [validator.js](file://api/utils/validator.js)

#### 验证策略
- **必填字段检查**: 确保关键字段不为空
- **格式验证**: 检查数据格式的正确性
- **范围限制**: 限制数值和字符串长度
- **业务规则**: 验证符合业务逻辑的约束

**章节来源**
- [validator.js](file://api/utils/validator.js)

### LLM解析系统 (llmParser.js)
基于大语言模型的智能解析能力是AI家教的核心技术：

#### 解析流程
```mermaid
sequenceDiagram
participant Client as 客户端
participant Parser as LLM解析器
participant Model as 大语言模型
participant Cache as 缓存系统
Client->>Parser : 上传试题内容
Parser->>Cache : 检查缓存
Cache-->>Parser : 缓存状态
Parser->>Model : 发送解析请求
Model->>Model : 分析题目类型
Model->>Model : 提取关键信息
Model->>Model : 生成答案和解析
Model-->>Parser : 返回解析结果
Parser->>Cache : 存储解析结果
Parser-->>Client : 返回解析完成
```

**图表来源**
- [llmParser.js](file://api/utils/llmParser.js)
- [prompts.js](file://api/utils/prompts.js)

#### 解析能力
- **题目类型识别**: 自动识别选择题、填空题、解答题等
- **答案提取**: 从文本中提取标准答案
- **解析生成**: 生成详细的解题过程和思路
- **知识点标注**: 自动标注相关知识点

**章节来源**
- [llmParser.js](file://api/utils/llmParser.js)
- [prompts.js](file://api/utils/prompts.js)

## 依赖分析

### 外部依赖关系
```mermaid
graph TB
subgraph "核心依赖"
Express[Express.js]
Sequelize[Sequelize ORM]
JWT[jwt-simple]
Crypto[crypto-js]
end
subgraph "AI相关"
OpenAI[OpenAI SDK]
Llama[Llama.cpp]
Transformers[Transformers.js]
end
subgraph "数据库"
PostgreSQL[PostgreSQL]
Redis[Redis]
Neo4j[Neo4j]
end
subgraph "工具库"
Moment[Moment.js]
Lodash[Lodash]
Axios[Axios]
end
QuestionsAPI --> Express
QuestionsAPI --> Sequelize
QuestionsAPI --> JWT
QuestionsAPI --> Crypto
QuestionsAPI --> OpenAI
QuestionsAPI --> Llama
QuestionsAPI --> Transformers
QuestionsAPI --> PostgreSQL
QuestionsAPI --> Redis
QuestionsAPI --> Neo4j
QuestionsAPI --> Moment
QuestionsAPI --> Lodash
QuestionsAPI --> Axios
```

**图表来源**
- [questions.js](file://api/questions.js)
- [db.js](file://api/db.js)

### 内部模块依赖
系统内部模块之间存在清晰的依赖关系：

```mermaid
graph LR
QuestionsAPI[试题API] --> Validator[验证器]
QuestionsAPI --> Response[响应处理器]
QuestionsAPI --> ErrorHandler[错误处理器]
QuestionsAPI --> DB[数据库层]
QuestionsAPI --> LLM[LLM解析器]
ExamQuestionsAPI[试卷试题API] --> DB
KnowledgePointsAPI[知识点API] --> DB
KnowledgePointsAPI --> LLM
Validator --> SubjectMap[学科映射]
Validator --> SubjectCombinations[学科组合]
LLM --> Prompts[提示模板]
LLM --> Cache[缓存系统]
DB --> Tasks[任务队列]
Tasks --> TaskWorker[任务执行器]
```

**图表来源**
- [questions.js](file://api/questions.js)
- [validator.js](file://api/utils/validator.js)
- [db.js](file://api/db.js)

**章节来源**
- [questions.js](file://api/questions.js)
- [validator.js](file://api/utils/validator.js)
- [db.js](file://api/db.js)

## 性能考虑
试题管理API在设计时充分考虑了性能优化：

### 缓存策略
- **多级缓存**: 内存缓存 + Redis缓存 + 文件缓存
- **智能过期**: 基于访问频率的动态过期策略
- **预加载机制**: 常用数据的预加载和预热

### 数据库优化
- **索引优化**: 为常用查询字段建立复合索引
- **连接池管理**: 动态调整数据库连接数量
- **查询优化**: 使用原生SQL进行复杂查询

### 异步处理
- **批量操作**: 大规模数据处理使用异步队列
- **后台任务**: 耗时操作如LLM解析放入后台执行
- **并发控制**: 限制同时处理的任务数量

## 故障排除指南

### 常见问题及解决方案
| 问题类型 | 症状 | 可能原因 | 解决方案 |
|----------|------|----------|----------|
| 验证失败 | 400 Bad Request | 输入数据格式错误 | 检查数据格式和必填字段 |
| 数据库连接 | 连接超时 | 数据库负载过高 | 检查连接池配置和数据库性能 |
| LLM解析失败 | 解析超时 | 模型API不可用 | 检查网络连接和API密钥 |
| 缓存失效 | 查询缓慢 | 缓存未命中 | 检查缓存键和过期时间设置 |

### 错误处理机制
系统实现了完善的错误处理机制：

```mermaid
flowchart TD
Request[请求到达] --> Try[尝试处理]
Try --> Success{处理成功?}
Success --> |是| ReturnResponse[返回成功响应]
Success --> |否| CatchError[捕获错误]
CatchError --> LogError[记录错误日志]
LogError --> CheckType{检查错误类型}
CheckType --> |验证错误| ReturnValidationError[返回验证错误]
CheckType --> |数据库错误| ReturnDBError[返回数据库错误]
CheckType --> |业务逻辑错误| ReturnBusinessError[返回业务错误]
CheckType --> |系统错误| ReturnSystemError[返回系统错误]
ReturnValidationError --> End[结束]
ReturnDBError --> End
ReturnBusinessError --> End
ReturnSystemError --> End
ReturnResponse --> End
```

**图表来源**
- [errorHandler.js](file://api/middleware/errorHandler.js)
- [response.js](file://api/utils/response.js)

**章节来源**
- [errorHandler.js](file://api/middleware/errorHandler.js)
- [response.js](file://api/utils/response.js)

## 结论
AI家教项目的试题管理API是一个功能完善、架构合理的系统。它不仅提供了完整的试题生命周期管理功能，还集成了先进的AI技术和智能算法。

### 主要优势
- **模块化设计**: 清晰的模块划分便于维护和扩展
- **智能化功能**: 基于LLM的智能解析和知识点标注
- **高性能架构**: 多级缓存和异步处理确保系统性能
- **完善的验证**: 全面的数据验证和错误处理机制

### 技术特色
- **多学科支持**: 支持8个主要学科的试题管理
- **智能关联**: 与知识图谱系统的深度集成
- **批量处理**: 高效的大规模数据处理能力
- **版本控制**: 完善的试题版本管理和变更追踪

## 附录

### API使用示例
由于代码库中包含完整的API实现，建议参考以下文件获取具体的使用方法：
- [questions.js](file://api/questions.js) - 主要API端点实现
- [swagger.js](file://api/swagger.js) - API文档定义
- [test-flow.sh](file://test-flow.sh) - 测试流程示例

### 最佳实践
1. **数据验证**: 始终在前端和后端进行双重验证
2. **错误处理**: 实现统一的错误处理和用户友好的错误消息
3. **性能优化**: 合理使用缓存和异步处理
4. **安全考虑**: 实施适当的权限控制和数据加密

### 扩展建议
1. **监控系统**: 添加APM监控和性能指标收集
2. **测试覆盖**: 增加单元测试和集成测试覆盖率
3. **文档更新**: 保持API文档与代码同步更新
4. **安全审计**: 定期进行安全漏洞扫描和修复