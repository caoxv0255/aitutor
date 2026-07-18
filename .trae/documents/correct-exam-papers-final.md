# 高考真题数据库最终修正计划

## 概述

基于用户提供的各省2008-2025年高考试卷演进表，对 `exam_papers` 表进行系统性修正。前序会话已完成 paper_type 回填和部分占位文件修复，本计划聚焦剩余问题。

## 当前状态分析

### 数据库状态 (5,149条记录)

| 维度 | 状态 | 待修复 |
|------|------|--------|
| paper_type | 115条NULL（全部为北京中考，非高考，NULL正确） | 0 |
| math_type | 106条NULL（22中考正确 + 84条非北京2020-2025高考数学应为unified） | 84 |
| paper_file_path | 0条NULL，但1,307条为跨省占位文件 | ~1,307 |
| question_count | 2,664条为0/NULL（52%，主要为占位文件无法解析） | 2,664 |
| science数学 | 仅12条（应约360条，old gaokao各省理科数学大量缺失） | 数据导入缺口 |

### 已完成工作
1. **paper_type回填**: backfill-paper-types.js 已执行，5,034条高考记录均有paper_type
2. **占位修复Phase 1**: fix-placeholder-paths.js 修复37条自主命题占位
3. **占位修复Phase 2**: fix-all-placeholder-paths.js 修复61条（8 Layer1 + 53 Layer2），1,248条保留
4. **math_type标记**: fix-math-papers.js 标记北京12条arts/science

### 关键发现
1. **115条NULL paper_type**: 全部为北京中考记录（exam_level='zhongkao'），paper_type对中考不适用，NULL正确
2. **84条NULL math_type**: 非北京省份2020-2025高考数学，均为新高考改革后数学不分文理，应为'unified'，但当前指向北京占位文件
3. **1,307条跨省占位**: 大部分指向北京空白卷文件，无法解析题目
4. **science数学仅12条**: old gaokao各省理科数学试卷大量未导入（数据缺口，非修正范围）
5. **UIBE Git服务器**: 本机不可达，无法从服务器获取缺失文件

## 实施方案

### Phase 1: 修正84条NULL math_type (新高考unified数学)

**文件**: `scripts/fix-math-type-unified.js` (新建)

**逻辑**:
1. 查询所有 `subject='math' AND math_type IS NULL AND exam_level='gaokao'` 的记录
2. 对每条记录，使用 `getMathSplit(province_code, year)` 检查是否分文理
3. 如果 `mathSplit === false`（新高考改革后），设置 `math_type = 'unified'`
4. 如果 `mathSplit === true`（老高考），保持NULL（置空待修复，等找到正确文件）

**预期结果**: 84条记录设为'unified'，22条中考记录不动

**验证**: 查询确认 `math NULL AND exam_level='gaokao'` 记录数为0（或仅剩mathSplit=true的老高考记录）

### Phase 2: 验证paper_type正确性

**文件**: `scripts/verify-paper-types-v2.js` (新建)

**逻辑**:
1. 查询所有 `exam_level='gaokao'` 的记录
2. 对每条记录，使用 `getPaperType(province_code, year, subject)` 计算期望的paper_type
3. 对比数据库中的paper_type与期望值
4. 输出不一致的记录列表

**处理**:
- 如果发现不一致，创建修正脚本 `scripts/fix-paper-type-mismatches.js` 批量更新
- 重点关注：主科（语数英）使用main，物化生政史地使用minor，综合卷使用comp

### Phase 3: 修复跨省占位文件（最终轮）

**文件**: `scripts/fix-placeholders-final.js` (新建)

**策略**（基于用户已批准的"全国卷共享文件"方案）:

1. **识别所有占位文件**: 查询paper_file_path中省份名与province_code不匹配的记录
2. **Layer 1 - 本省文件搜索**: 在本省目录中搜索正确文件（年份+学科+math_type匹配）
3. **Layer 2 - 全国卷共享**: 对于NATIONAL_TYPES的记录，从同paper_type+year+subject的其他省份共享
4. **Layer 3 - 标记为占位**: 无法修复的记录，设置 `paper_file_path` 保留但标记 `question_count = -1`（表示占位文件，不可解析）

**关键规则**:
- NATIONAL_TYPES = ['national_i', 'national_ii', 'national_iii', 'national_a', 'national_b', 'new_gaokao_i', 'new_gaokao_ii']
- 自主命题（independent）省份不共享文件
- 2025年数学: 18个省份有"新课标全国I/II卷"文件，可修复2025数学占位

### Phase 4: PDF文件命名标准化

**文件**: `scripts/standardize-file-names.js` (已创建，待执行)

**步骤**:
1. 先运行 `--dry-run` 预览变更
2. 检查输出，修复任何异常
3. 运行实际执行（去掉--dry-run）
4. 验证数据库路径已正确更新

**标准命名格式**:
```
{年份}年{省份/卷型}高考{学科}试卷（{版本}）.{ext}
数学分科: {年份}年{省份/卷型}高考数学试卷（文科/理科）（{版本}）.{ext}
```

**清理规则**:
- 删除临时文件: `.cache.*`, `~$*`, `._*`, `Thumbs.db`, `.DS_Store`

### Phase 5: 文件内容验证

**文件**: `scripts/verify-file-content.js` (新建)

**验证内容**:
1. **文件存在性**: 检查所有paper_file_path对应的文件是否存在
2. **文件有效性**: 验证PDF/DOC/DOCX文件可正常读取
3. **内容-文件名匹配**: 抽样检查文件内容关键词（年份、学科、省份）与文件名一致性
4. **异常检测**:
   - 文件大小异常（<10KB可能为空，>50MB可能为合集）
   - 重复文件检测（相同内容不同文件名）
5. **北京政治2008检查**: 验证是否包含生物文件（已知问题）

**工具**: 使用 `pdf-parse` 提取PDF文本，`mammoth` 提取DOCX文本

### Phase 6: 重新解析占位试卷

**文件**: 使用现有 `scripts/parse-questions.js`

**范围**: 
- 7条question_count IS NULL的高考记录
- 修复文件路径后可解析的占位记录（Phase 3修复的Layer 1/2记录）

**注意**: 
- 仅重新解析Phase 3修复后文件路径正确的记录
- 2,664条0/NULL记录中，大部分仍指向占位文件，无法解析，标记跳过

### Phase 7: 生成最终修正报告

**文件**: `scripts/generate-final-report.js` (新建)

**报告内容**:

1. **数据库修正统计**
   - paper_type验证结果（一致/不一致/已修正）
   - math_type修正统计（84条设为unified）
   - 占位文件修复统计（Layer1/Layer2/Layer3）
   - 文件命名标准化统计（重命名/删除临时文件）

2. **文件验证结果**
   - 文件存在性检查结果
   - 异常文件列表
   - 内容-文件名不匹配列表

3. **数据质量现状**
   - 各省×学科×年份覆盖矩阵
   - 缺失文件清单（按省份×学科×年份）
   - science数学缺口分析（仅12条，预期~360条）

4. **后续建议**
   - 需要手动获取的文件清单
   - science数学试卷导入建议
   - UIBE Git服务器可获取文件（需网络可达时操作）

## 假设与决策

1. **115条NULL paper_type**: 为北京中考记录，paper_type对中考不适用，保持NULL正确，不修改
2. **84条NULL math_type**: 非北京2020-2025高考数学，新高考改革后数学不分文理，设为'unified'
3. **老高考NULL math_type**: mathSplit=true但无法确定arts/science的记录，保持NULL（用户决策：置空待修复）
4. **全国卷共享**: 同paper_type+year+subject的省份共享同一文件路径（用户已批准）
5. **自主命题不共享**: independent省份各有独立试卷，不共享文件
6. **science数学缺口**: 数据导入层面缺失，非本计划修正范围，在报告中记录
7. **UIBE Git服务器**: 本机不可达，不作为文件获取来源
8. **文件重命名**: 使用原子重命名，保留原→新文件名映射，同步更新数据库

## 验证步骤

1. **Phase 1验证**: 查询 `math_type NULL AND exam_level='gaokao'` 确认仅剩mathSplit=true的老高考记录
2. **Phase 2验证**: 查询paper_type不一致记录数为0
3. **Phase 3验证**: 查询跨省占位记录数减少，Layer3标记记录可追溯
4. **Phase 4验证**: 运行 `scripts/verify-papers.js` 验证文件路径与数据库一致
5. **Phase 5验证**: 检查异常文件报告，确认无遗漏
6. **Phase 6验证**: 检查修复后记录的question_count已填充
7. **Phase 7验证**: 检查报告内容完整性和准确性

## 执行顺序

```
Phase 1 (math_type修正) → Phase 2 (paper_type验证) → Phase 3 (占位修复)
→ Phase 4 (命名标准化) → Phase 5 (内容验证) → Phase 6 (重新解析) → Phase 7 (报告)
```

每个Phase完成后运行验证，确认无误后再进入下一Phase。
