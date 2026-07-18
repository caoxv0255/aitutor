# 更正各省 2008-2025 年高考真题命题来源信息

## Context

当前 `exam_papers` 表没有 `paper_type`（命题来源）字段，命题信息仅在导入脚本内存中判断，未持久化到数据库。现有 `PROVINCE_PAPER_EVOLUTION` 映射存在多处严重错误（山东/广东/湖北/湖南/重庆误标为全国卷而非自主命题；安徽/江西等改革年份错误；新疆/西藏未改革但误标为已改革）。`math_type` 字段已存在但部分记录不正确。用户提供了 31 个省份的准确命题来源表，需要据此全面更正数据库。

## 实施步骤

### 步骤 1：创建共享试卷演进映射模块

**新建文件** `scripts/lib/paper-evolution.js`

提取为单一数据源，消除当前 7 个文件中的重复定义。数据结构需支持按 `(province, year, subject)` 查询，区分主科（语数英）和选考科（物化生政史地）的不同命题来源。

核心数据结构——每个时间段包含 `{ start, end, main, minor, comp, mathSplit }`：
- `main`: 语数英的 paper_type
- `minor`: 物化生政史地的 paper_type
- `comp`: 文综/理综的 paper_type（新高考为 null）
- `mathSplit`: true=文理数学, false=统一数学

**31 省份修正后的完整映射**（关键修正点加 `★`）：

| 省份 | 时间段 | main | minor/comp | mathSplit | 修正说明 |
|------|--------|------|-----------|-----------|---------|
| 北京 | 2008-2019 | independent | independent | true | — |
| 北京 | 2020-2025 | independent | independent | false | — |
| 天津 | 2008-2019 | independent | independent | true | — |
| 天津 | 2020-2025 | independent | independent | false | — |
| 上海 | 2008-2016 | independent | independent | true | — |
| 上海 | 2017-2025 | independent | independent | false | — |
| 浙江 | 2008-2016 | independent | independent | true | — |
| 浙江 | 2017-2022 | independent | independent | false | ★ 2017起数学不分文理 |
| 浙江 | 2023-2025 | new_gaokao_i | independent | false | ★ 2023起语数英改用新高考I卷 |
| ★山东 | 2008-2019 | independent | independent | true | ★ 修正：原误标为全国I卷 |
| 山东 | 2020-2025 | new_gaokao_i | independent | false | — |
| 海南 | 2008-2019 | national_ii | national_ii | true | — |
| 海南 | 2020-2025 | new_gaokao_ii | independent | false | ★ 修正：改革年份2020非2021 |
| 河北 | 2008-2020 | national_i | national_i | true | — |
| 河北 | 2021-2025 | new_gaokao_i | independent | false | — |
| ★江苏 | 2008-2020 | independent | independent | true | — |
| 江苏 | 2021-2025 | new_gaokao_i | independent | false | — |
| 福建 | 2008-2020 | national_i | national_i | true | — |
| 福建 | 2021-2025 | new_gaokao_i | independent | false | — |
| ★湖北 | 2008-2020 | independent | independent | true | ★ 修正：原误标为全国I卷 |
| 湖北 | 2021-2025 | new_gaokao_i | independent | false | — |
| ★湖南 | 2008-2020 | independent | independent | true | ★ 修正：原误标为全国I卷 |
| 湖南 | 2021-2025 | new_gaokao_i | independent | false | — |
| ★广东 | 2008-2020 | independent | independent | true | ★ 修正：原误标为全国I卷 |
| 广东 | 2021-2025 | new_gaokao_i | independent | false | — |
| 辽宁 | 2008-2020 | national_ii | national_ii | true | — |
| 辽宁 | 2021-2025 | new_gaokao_ii | independent | false | — |
| ★重庆 | 2008-2020 | independent | independent | true | ★ 修正：原误标为全国II卷 |
| 重庆 | 2021-2025 | new_gaokao_ii | independent | false | — |
| ★安徽 | 2008-2015 | independent | independent | true | ★ 修正：原误标为全国I卷 |
| 安徽 | 2016-2021 | national_i | national_i | true | — |
| 安徽 | 2022-2023 | national_b | national_b | true | — |
| 安徽 | 2024-2025 | new_gaokao_i | independent | false | ★ 修正：改革年份2024非2021 |
| 江西 | 2008-2021 | national_i | national_i | true | — |
| 江西 | 2022-2023 | national_b | national_b | true | — |
| 江西 | 2024-2025 | new_gaokao_i | independent | false | ★ 修正：改革年份2024 |
| 吉林 | 2008-2021 | national_ii | national_ii | true | — |
| 吉林 | 2022-2023 | national_b | national_b | true | — |
| 吉林 | 2024-2025 | new_gaokao_ii | independent | false | ★ 修正：改革年份2024 |
| 黑龙江 | 2008-2021 | national_ii | national_ii | true | — |
| 黑龙江 | 2022-2023 | national_b | national_b | true | — |
| 黑龙江 | 2024-2025 | new_gaokao_ii | independent | false | ★ 修正：改革年份2024 |
| 广西 | 2008-2015 | national_ii | national_ii | true | — |
| 广西 | 2016-2021 | national_iii | national_iii | true | — |
| 广西 | 2022-2023 | national_a | national_a | true | — |
| 广西 | 2024-2025 | new_gaokao_ii | independent | false | ★ 修正：改革年份2024 |
| 贵州 | 2008-2015 | national_ii | national_ii | true | — |
| 贵州 | 2016-2021 | national_iii | national_iii | true | — |
| 贵州 | 2022-2023 | national_a | national_a | true | — |
| 贵州 | 2024-2025 | new_gaokao_ii | independent | false | ★ 修正：改革年份2024 |
| 甘肃 | 2008-2021 | national_ii | national_ii | true | — |
| 甘肃 | 2022-2023 | national_b | national_b | true | — |
| 甘肃 | 2024-2025 | new_gaokao_ii | independent | false | ★ 修正：改革年份2024 |
| 山西 | 2008-2021 | national_i | national_i | true | — |
| 山西 | 2022-2024 | national_b | national_b | true | — |
| 山西 | 2025 | new_gaokao_ii | independent | false | ★ 修正：改革年份2025 |
| 河南 | 2008-2021 | national_i | national_i | true | — |
| 河南 | 2022-2024 | national_b | national_b | true | — |
| 河南 | 2025 | new_gaokao_i | independent | false | ★ 修正：改革年份2025 |
| 陕西 | 2008-2021 | national_ii | national_ii | true | — |
| 陕西 | 2022-2024 | national_b | national_b | true | — |
| 陕西 | 2025 | new_gaokao_ii | independent | false | ★ 修正：改革年份2025 |
| 四川 | 2008-2015 | national_ii | national_ii | true | — |
| 四川 | 2016-2021 | national_iii | national_iii | true | — |
| 四川 | 2022-2024 | national_a | national_a | true | — |
| 四川 | 2025 | new_gaokao_ii | independent | false | ★ 修正：改革年份2025 |
| 云南 | 2008-2015 | national_ii | national_ii | true | — |
| 云南 | 2016-2021 | national_iii | national_iii | true | — |
| 云南 | 2022-2024 | national_a | national_a | true | — |
| 云南 | 2025 | new_gaokao_ii | independent | false | ★ 修正：改革年份2025 |
| 内蒙古 | 2008-2021 | national_ii | national_ii | true | — |
| 内蒙古 | 2022-2024 | national_b | national_b | true | — |
| 内蒙古 | 2025 | new_gaokao_ii | independent | false | ★ 修正：改革年份2025 |
| 宁夏 | 2008-2021 | national_ii | national_ii | true | — |
| 宁夏 | 2022-2024 | national_b | national_b | true | — |
| 宁夏 | 2025 | new_gaokao_ii | independent | false | ★ 修正：改革年份2025 |
| 青海 | 2008-2021 | national_ii | national_ii | true | — |
| 青海 | 2022-2024 | national_b | national_b | true | — |
| 青海 | 2025 | new_gaokao_ii | independent | false | ★ 修正：改革年份2025 |
| ★新疆 | 2008-2021 | national_ii | national_ii | true | — |
| ★新疆 | 2022-2024 | national_b | national_b | true | — |
| ★新疆 | 2025 | new_gaokao_ii | national_b | true | ★ 仍分文理数学+文理综 |
| ★西藏 | 2008-2015 | national_ii | national_ii | true | — |
| ★西藏 | 2016-2021 | national_iii | national_iii | true | — |
| ★西藏 | 2022-2024 | national_a | national_a | true | — |
| ★西藏 | 2025 | new_gaokao_ii | national_a | true | ★ 仍分文理数学+文理综 |

模块导出函数：
- `getPaperType(provinceCode, year, subject)` → 返回 paper_type 字符串
- `getMathSplit(provinceCode, year)` → 返回 true/false
- `getSubjectMode(provinceCode, year)` → 返回 'comprehensive'/'single'/'mixed'
- `PAPER_TYPE_LABELS` → 类型→中文标签映射

### 步骤 2：Schema 迁移

**修改文件** `api/core/db.js`

1. 在 `exam_papers` 的 `CREATE TABLE` 语句（L186-199）中添加 `paper_type VARCHAR(30)` 列
2. 在 `alterStatements` 数组（L457 附近）追加幂等迁移：
   ```javascript
   `ALTER TABLE exam_papers ADD COLUMN IF NOT EXISTS math_type VARCHAR(10)`,
   `ALTER TABLE exam_papers ADD COLUMN IF NOT EXISTS paper_type VARCHAR(30)`,
   ```

### 步骤 3：编写回填脚本

**新建文件** `scripts/backfill-paper-types.js`

脚本逻辑：
1. 调用 `getDb()` 连接数据库
2. 查询所有 `exam_papers` 记录（按 province_code, year 排序）
3. 对每条记录：
   - 调用 `getPaperType(province_code, year, subject)` 获取正确的 paper_type
   - 调用 `getMathSplit(province_code, year)` 判断数学是否分文理
   - 对数学记录：若 mathSplit=true 且 math_type 为 NULL → 根据 paper_file_path 中的"文科"/"理科"推断；若 mathSplit=false 且 math_type 为 'arts'/'science' → 改为 'unified'
   - 对 paper_file_path：校验文件是否存在，若不存在尝试在同目录查找匹配年份+学科的文件
4. 批量 UPDATE（每 500 条提交一次）
5. 输出统计报告：更新数、跳过数、异常数

同时处理 PDF 文件路径修正：
- 对全国卷省份，确保 paper_file_path 指向正确卷别的文件（如河南应指向"全国I卷"文件而非"全国II卷"）
- 对自主命题省份，确保文件名包含省份标识
- 对数学文理分科，确保 arts 记录指向"文科"文件，science 记录指向"理科"文件

### 步骤 4：更新现有脚本的映射引用

将以下文件中的 `PROVINCE_PAPER_EVOLUTION` 替换为从 `scripts/lib/paper-evolution.js` 导入：
- `scripts/import-papers.js`（L37-183）
- `scripts/generate-paper-type-list.js`（L33-200）
- `scripts/paper-distribution-report.js`
- `scripts/parse-questions-v3.js`
- `scripts/retry-failed-papers.js`
- `scripts/restore-papers.js`
- `scripts/copy-papers.js`

### 步骤 5：更新 API 处理器

**修改文件** `api/handlers/exam-papers.js`

1. `getExamPapers`（L36）：SELECT 语句添加 `paper_type, math_type` 字段
2. `getExamPaperById`（L110）：已使用 `SELECT ep.*`，确认返回 paper_type
3. `createExamPaper`（L166）：INSERT 语句支持 paper_type 参数
4. 在 SUBJECT_MAP 旁添加 PAPER_TYPE_LABELS 映射，用于返回中文标签

### 步骤 6：更新前端展示

**修改文件** `frontend/assets/js/pages/province-page.js`

1. `renderPapers`（L450）：在试卷卡片中显示 paper_type 标签（如"自主命题"/"新高考I卷"/"全国甲卷"）
2. 添加 `getPaperTypeLabel(type)` 函数，将 paper_type 代码转为中文
3. 在试卷列表的 info 行追加命题来源标签

### 步骤 7：编写验证脚本

**新建文件** `scripts/verify-paper-types.js`

验证内容：
1. 遍历所有 `exam_papers` 记录，调用 `getPaperType()` 计算期望值，对比数据库实际值
2. 输出不一致记录清单（按省份分组）
3. 专项抽查：山东2008-2019(应=independent)、新疆2025(math_type应=arts/science)、安徽2022(应=national_b)
4. 统计各 paper_type 的记录数分布
5. 验证 math_type 与 mathSplit 的一致性

## 关键文件清单

| 文件 | 操作 |
|------|------|
| `scripts/lib/paper-evolution.js` | **新建** - 共享映射模块 |
| `api/core/db.js` | **修改** - 添加 paper_type 列 |
| `scripts/backfill-paper-types.js` | **新建** - 回填脚本 |
| `scripts/verify-paper-types.js` | **新建** - 验证脚本 |
| `api/handlers/exam-papers.js` | **修改** - API 返回 paper_type |
| `frontend/assets/js/pages/province-page.js` | **修改** - 前端展示 paper_type |
| `scripts/import-papers.js` | **修改** - 引用共享模块 |
| `scripts/generate-paper-type-list.js` | **修改** - 引用共享模块 |
| 其他 5 个脚本文件 | **修改** - 引用共享模块 |

## 验证方案

1. 运行 `node scripts/backfill-paper-types.js` 执行回填
2. 运行 `node scripts/verify-paper-types.js` 验证一致性
3. 启动 API 服务，调用 `/api/exam-papers?province=shandong&year=2015` 确认返回 paper_type=independent
4. 访问 `frontend/province.html?province=shandong` 确认前端正确显示命题来源标签
5. 抽查新疆2025数学记录：应有两行（arts+science），paper_type=new_gaokao_ii
6. 抽查安徽2022语文记录：paper_type 应为 national_b
