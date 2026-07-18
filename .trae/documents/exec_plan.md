# 高考真题数据修正综合执行计划

## 概述

本计划合并执行两个相互依赖的任务：
1. **命题来源信息修正** - 更正 31 省份 2008-2025 年高考真题的 `paper_type` 和 `math_type`
2. **文件路径与命名标准化** - 修复占位文件路径，标准化文件命名

## 执行顺序

```
阶段1 → 阶段2 → 阶段3 → 阶段4 → 阶段5 → 阶段6
```

---

## 阶段1：创建共享试卷演进映射模块

**目标**: 创建单一数据源，消除重复定义

**文件**: `scripts/lib/paper-evolution.js` (新建)

**步骤**:
1. 定义核心数据结构：每个时间段包含 `{ start, end, main, minor, comp, mathSplit }`
2. 编写 31 省份的完整命题演进映射
3. 导出函数：`getPaperType()`, `getMathSplit()`, `getSubjectMode()`, `PAPER_TYPE_LABELS`

**关键修正点**:
- 山东/广东/湖北/湖南/重庆：2008-2020 应为自主命题（independent）
- 安徽/江西：改革年份为 2024（非 2021）
- 新疆/西藏：2025 仍分文理数学+文理综

---

## 阶段2：Schema 迁移

**目标**: 在 `exam_papers` 表中添加 `paper_type` 列

**文件**: `api/core/db.js` (修改)

**步骤**:
1. 在 `CREATE TABLE` 语句中添加 `paper_type VARCHAR(30)` 列
2. 在 `alterStatements` 数组中追加幂等迁移语句

---

## 阶段3：编写并执行回填脚本

**目标**: 根据正确的命题演进映射，回填 `paper_type` 和修正 `math_type`

**文件**: `scripts/backfill-paper-types.js` (新建)

**步骤**:
1. 连接数据库，查询所有 `exam_papers` 记录
2. 对每条记录调用 `getPaperType()` 获取正确的 paper_type
3. 修正 math_type：
   - mathSplit=true 且 math_type=NULL → 根据文件名推断
   - mathSplit=false 且 math_type=arts/science → 改为 unified
4. 批量 UPDATE（每 500 条提交一次）
5. 输出统计报告

---

## 阶段4：修复占位文件路径

**目标**: 修复 1346 条占位文件记录，实现全国卷文件共享策略

**文件**: `scripts/fix-all-placeholder-paths.js` (新建)

**步骤**:
1. 修复现有 `fix-placeholder-paths.js` 的年份匹配 Bug（提取文件名再过滤）
2. 扩展修复到所有 paper_type（不只是 independent）
3. 三层修复策略：
   - Layer 1: 在本省目录搜索正确文件
   - Layer 2: 同 paper_type+年份+学科的其他省份共享文件
   - Layer 3: 无法修复的记录保留原路径，记录到报告
4. 特殊处理：2025 年数学新课标全国卷文件

---

## 阶段5：文件命名标准化

**目标**: 对所有 PDF/DOC/DOCX 文件实施统一命名规范

**文件**: `scripts/standardize-file-names.js` (新建)

**步骤**:
1. 扫描所有文件，解析当前文件名提取关键信息
2. 生成标准化文件名：`{年份}年{省份}高考{学科}试卷（{卷型}）（{版本}）.{ext}`
3. 检查目标文件名是否已存在（避免冲突）
4. 重命名文件，更新数据库中的 `paper_file_path`
5. 清理临时文件（`.cache.*`, `~$*`）

---

## 阶段6：验证与报告

**目标**: 验证所有修正结果，生成详细报告

**文件**: `scripts/verify-paper-types.js` (新建), `scripts/verify-file-content.js` (新建), `scripts/generate-correction-report.js` (新建)

**步骤**:
1. **命题来源验证**: 遍历所有记录，对比 `getPaperType()` 期望值与数据库实际值
2. **文件内容验证**: 验证 PDF/DOC/DOCX 文件完整性，检查文件名与内容匹配
3. **重新解析**: 重新解析 7 条未解析试卷
4. **生成报告**: 包含数据库修正统计、文件命名变更记录、缺失文件清单

---

## 关键文件清单

| 文件 | 操作 | 所属阶段 |
|------|------|---------|
| `scripts/lib/paper-evolution.js` | 新建 | 阶段1 |
| `api/core/db.js` | 修改 | 阶段2 |
| `scripts/backfill-paper-types.js` | 新建 | 阶段3 |
| `scripts/fix-placeholder-paths.js` | 修改 | 阶段4 |
| `scripts/fix-all-placeholder-paths.js` | 新建 | 阶段4 |
| `scripts/standardize-file-names.js` | 新建 | 阶段5 |
| `scripts/verify-paper-types.js` | 新建 | 阶段6 |
| `scripts/verify-file-content.js` | 新建 | 阶段6 |
| `scripts/generate-correction-report.js` | 新建 | 阶段6 |

---

## 验证方案

| 验证点 | 方法 |
|--------|------|
| 命题来源正确性 | 运行 `verify-paper-types.js`，抽查山东2015(应=independent)、新疆2025(math_type应=arts/science) |
| 文件路径修复 | 运行 `fix-all-placeholder-paths.js --dry-run`，检查修复数量 |
| 文件命名标准化 | 检查重命名后文件是否存在，数据库路径是否更新 |
| API 返回 | 调用 `/api/exam-papers?province=shandong&year=2015` 确认返回 paper_type |
| 前端展示 | 访问 `province.html?province=shandong` 确认显示命题来源标签 |
| 未解析试卷 | 检查 7 条试卷的 question_count 是否已填充 |

---

## 风险与应对

| 风险 | 应对策略 |
|------|---------|
| 文件重命名导致路径失效 | 使用 `--dry-run` 模式先验证，保留映射记录 |
| 数据库更新失败 | 批量提交（每 500 条），失败回滚 |
| math_type 推断错误 | 仅根据文件名中的"文科"/"理科"关键词推断，无法判断的保持 NULL |
| 全国卷共享策略冲突 | 优先选择本省文件，其次选择同卷型其他省份文件 |

---

## 执行记录

| 阶段 | 状态 | 执行时间 | 备注 |
|------|------|---------|------|
| 阶段1 | 待执行 | - | - |
| 阶段2 | 待执行 | - | - |
| 阶段3 | 待执行 | - | - |
| 阶段4 | 待执行 | - | - |
| 阶段5 | 待执行 | - | - |
| 阶段6 | 待执行 | - | - |
