# 更正各省高考真题命题来源 — 剩余实施计划（步骤 4-7）

## Context

步骤 1-3 已完成：
- ✅ `scripts/lib/paper-evolution.js` — 共享映射模块（31 省份，按 main/minor/comp/mathSplit 区分）
- ✅ `api/core/db.js` — 已添加 `paper_type VARCHAR(30)` 和 `math_type VARCHAR(10)` 列
- ✅ `scripts/backfill-paper-types.js` — 已执行，5034 条 paper_type 更新，434 条 math_type 更新

剩余工作：更新 7 个脚本的引用、API 处理器、前端展示、验证脚本。

## 关键发现

### 旧 `getPaperTypeForYear(provinceCode, year)` → 新模块的映射

旧函数返回 `{ type, name }`，新模块拆分为两个函数：
- `getPaperType(provinceCode, year, subject)` → 返回 type 字符串（**需要 subject 参数**）
- `getEvolutionInfo(provinceCode, year)` → 返回完整 period 对象 `{ start, end, main, minor, comp, mathSplit }`
- `PAPER_TYPE_LABELS[type]` → 返回中文标签（替代旧 `.name`）

### 各脚本的使用模式

| 脚本 | 旧函数 | 使用场景 | 新函数替换方案 |
|------|--------|---------|---------------|
| import-papers.js | `getPaperTypeForYear(code, year)` → `.type` | 全国卷分配：比较 expectedType === paperType | `getEvolutionInfo(code, year)?.main`（主科代表） |
| generate-paper-type-list.js | `getPaperTypeForYear(code, year)` → `.name`, `.type` | 展示每年试卷类型 | `getEvolutionInfo(code, year)` + `PAPER_TYPE_LABELS[period.main]` |
| parse-questions-v3.js | `getPaperTypeForYear(code, year)` → `.type`, `.name` | 智能去重键 | `getPaperType(code, year, subject)` + `PAPER_TYPE_LABELS`（有 subject 上下文） |
| retry-failed-papers.js | `getPaperTypeForYear(code, year)` → `.type`, `.name` | 智能去重键 | 同上 |
| restore-papers.js | `getPaperTypeForYear(code, year)` → `.type` | 去重/分配 | `getEvolutionInfo(code, year)?.main` |
| paper-distribution-report.js | 自定义 `getPaperType(code, year)` | 报告展示 | `getEvolutionInfo(code, year)` + `PAPER_TYPE_LABELS` |
| copy-papers.js | 自定义 `getPaperType(code)` 无年份 | 按当前类型复制 | `getEvolutionInfo(code, 2025)?.main`（用最新年份） |

## 实施步骤

### 步骤 4：更新 7 个脚本引用共享模块

#### 4.1 `scripts/generate-paper-type-list.js`

**当前**：L3-12 本地 `PROVINCE_NAME_MAP`，L20-31 本地 `PAPER_TYPE_LABELS`，L33-200 本地 `PROVINCE_PAPER_EVOLUTION`，L202-216 本地 `getPaperTypeForYear`。

**修改**：
1. 删除 L3-216 的所有本地定义
2. 添加导入：
   ```javascript
   import {
     PROVINCE_NAME_MAP,
     PAPER_TYPE_LABELS,
     getEvolutionInfo
   } from './lib/paper-evolution.js';
   ```
3. L227 `getPaperTypeForYear(code, year)` → `getEvolutionInfo(code, year)`
4. L229 `paperInfo.name` → `PAPER_TYPE_LABELS[period.main]`，`paperInfo.type` → `period.main`
5. L244 同理修改统计部分

#### 4.2 `scripts/import-papers.js`

**当前**：L17-26 本地 `PROVINCE_NAME_MAP`，L37-183 本地 `PROVINCE_PAPER_EVOLUTION`，L197-211 本地 `getPaperTypeForYear`，L403 使用 `getPaperTypeForYear(targetProvinceCode, year)` 返回 `.type`。

**修改**：
1. 删除 L17-26 的 `PROVINCE_NAME_MAP` 和 L37-211 的 `PROVINCE_PAPER_EVOLUTION` + `getPaperTypeForYear`
2. 添加导入：
   ```javascript
   import { PROVINCE_NAME_MAP, getEvolutionInfo } from './lib/paper-evolution.js';
   ```
3. L403 `getPaperTypeForYear(targetProvinceCode, year)` → `getEvolutionInfo(targetProvinceCode, year)`
4. L404 `expectedType === paperType` → `expectedType?.main === paperType`（比较主科类型）

#### 4.3 `scripts/parse-questions-v3.js`

**当前**：L55 本地 `PROVINCE_PAPER_EVOLUTION`，L197 本地 `getPaperTypeForYear`，L727 使用返回 `.type` 和 `.name` 做去重。

**修改**：
1. 删除 L55 和 L197 的本地定义
2. 添加导入：
   ```javascript
   import { getPaperType, PAPER_TYPE_LABELS } from './lib/paper-evolution.js';
   ```
3. L727 `getPaperTypeForYear(province_code, year)` → `getPaperType(province_code, year, subject)`
   - 注意：`subject` 在 L725 已从 paper 对象解构
4. L728 `paperTypeInfo?.type` → `paperTypeInfo` (直接就是 type 字符串)
5. L735 `paperTypeInfo?.name` → `PAPER_TYPE_LABELS[paperType]`

#### 4.4 `scripts/retry-failed-papers.js`

**当前**：L25 本地 `PROVINCE_PAPER_EVOLUTION`，L216 本地 `getPaperTypeForYear`，L556 使用返回 `.type` 和 `.name`。

**修改**：同 4.3 模式
1. 删除本地定义，添加导入
2. L556 `getPaperTypeForYear(paper.province_code, paper.year)` → `getPaperType(paper.province_code, paper.year, paper.subject)`
3. 调整 `.type` / `.name` 的访问方式

#### 4.5 `scripts/restore-papers.js`

**当前**：L18 本地 `PROVINCE_PAPER_EVOLUTION`，L181 本地 `getPaperTypeForYear`，L226 使用返回 `.type`。

**修改**：
1. 删除本地定义，添加导入 `getEvolutionInfo`
2. L226 `getPaperTypeForYear(provinceCode, year)` → `getEvolutionInfo(provinceCode, year)`
3. 调整 `.type` → `.main`

#### 4.6 `scripts/paper-distribution-report.js`

**当前**：L3-12 本地 `PROVINCES`，L14-23 本地 `PAPER_TYPE_MAP`，L25-75 自定义 `getPaperType(provinceCode, year)` 逻辑有多处错误（如山东误标全国I卷）。

**修改**：
1. 删除 L3-75 的本地定义
2. 添加导入：
   ```javascript
   import { PROVINCE_NAME_MAP, PAPER_TYPE_LABELS, getEvolutionInfo } from './lib/paper-evolution.js';
   ```
3. L99 `getPaperType(code, year)` → `getEvolutionInfo(code, year)?.main`
4. L115 `getPaperType(code, 2025)` → `getEvolutionInfo(code, 2025)?.main`
5. 调整 `PAPER_TYPE_MAP` 引用 → `PAPER_TYPE_LABELS`

#### 4.7 `scripts/copy-papers.js`

**当前**：L4-13 本地 `PROVINCE_NAME_MAP`，L15-21 本地 `PAPER_TYPE_MAP`，L23-30 自定义 `getPaperType(provinceCode)` 无年份参数。

**修改**：
1. 删除 L4-30 的本地定义
2. 添加导入：
   ```javascript
   import { PROVINCE_NAME_MAP, PAPER_TYPE_LABELS, getEvolutionInfo } from './lib/paper-evolution.js';
   ```
3. L23 `getPaperType(provinceCode)` → `getEvolutionInfo(provinceCode, 2025)?.main`（用2025年代表当前类型）
4. L90 调用处自动生效
5. L86 `PAPER_TYPE_MAP` → `PAPER_TYPE_LABELS`

### 步骤 5：更新 API 处理器

**文件** `api/handlers/exam-papers.js`

1. **L36 SELECT 语句**：添加 `paper_type, math_type` 字段
   ```sql
   SELECT id, province_code, year, subject, exam_level, question_count, total_score, difficulty_avg, created_at, paper_file_path, paper_type, math_type
   ```

2. **L70 data mapping**：在返回对象中添加 `paper_type_label`
   ```javascript
   const PAPER_TYPE_LABELS = {
     'independent': '自主命题',
     'new_gaokao_i': '新高考I卷',
     'new_gaokao_ii': '新高考II卷',
     'national_a': '全国甲卷',
     'national_b': '全国乙卷',
     'national_i': '全国I卷',
     'national_ii': '全国II卷',
     'national_iii': '全国III卷'
   };
   // 在 map 中添加:
   paper_type_label: PAPER_TYPE_LABELS[r.paper_type] || r.paper_type || ''
   ```

3. **L166 createExamPaper**：INSERT 语句添加 `paper_type` 支持
   ```javascript
   const { province_code, year, subject, exam_level, paper_file_path, total_score, paper_type } = req.body;
   // INSERT 添加 paper_type
   ```

### 步骤 6：更新前端展示

**文件** `frontend/assets/js/pages/province-page.js`

**L450 `renderPapers` 方法**：在试卷卡片中显示 paper_type 标签

```javascript
renderPapers(papers) {
  const PAPER_TYPE_LABELS = {
    'independent': '自主命题',
    'new_gaokao_i': '新高考I卷',
    'new_gaokao_ii': '新高考II卷',
    'national_a': '全国甲卷',
    'national_b': '全国乙卷',
    'national_i': '全国I卷',
    'national_ii': '全国II卷',
    'national_iii': '全国III卷'
  };
  
  return papers.map(paper => {
    const subjectName = SUBJECT_MAP[paper.subject] || paper.subject || '';
    const mathType = paper.math_type === 'arts' ? '文科' : paper.math_type === 'science' ? '理科' : '';
    const paperTypeLabel = PAPER_TYPE_LABELS[paper.paper_type] || '';
    // ... 在 info 行追加 paperTypeLabel
    return `
      <div class="paper-card">
        <div class="year">${paper.year || '-'}</div>
        <div class="title">${title}</div>
        <div class="info">
          ${subjectName}${mathType ? ' · ' + mathType : ''} · ${paper.exam_level || ''}
          ${paperTypeLabel ? ' · <span class="paper-type-tag">' + paperTypeLabel + '</span>' : ''}
        </div>
        <div class="question-count">PDF版</div>
        <div class="btn-group">
          <button class="btn" onclick="viewPaper('${paper.id}')">查看详情</button>
        </div>
      </div>
    `;
  }).join('');
}
```

### 步骤 7：创建验证脚本

**新建文件** `scripts/verify-paper-types.js`

验证内容：
1. 遍历所有 `exam_papers` 记录，调用 `getPaperType(province_code, year, subject)` 计算期望值
2. 对比数据库实际 `paper_type`，输出不一致记录清单（按省份分组）
3. 专项抽查：
   - 山东 2008-2019 数学 → paper_type 应为 `independent`
   - 新疆 2025 数学 → math_type 应为 `arts`/`science`（非 unified）
   - 安徽 2022 语文 → paper_type 应为 `national_b`
   - 浙江 2023 英语 → paper_type 应为 `new_gaokao_i`
4. 统计各 `paper_type` 的记录数分布
5. 验证 `math_type` 与 `getMathSplit()` 的一致性

## 关键文件清单

| 文件 | 操作 | 状态 |
|------|------|------|
| `scripts/lib/paper-evolution.js` | 已完成 | ✅ |
| `api/core/db.js` | 已完成 | ✅ |
| `scripts/backfill-paper-types.js` | 已完成 | ✅ |
| `scripts/generate-paper-type-list.js` | 修改 — 引用共享模块 | 待做 |
| `scripts/import-papers.js` | 修改 — 引用共享模块 | 待做 |
| `scripts/parse-questions-v3.js` | 修改 — 引用共享模块 | 待做 |
| `scripts/retry-failed-papers.js` | 修改 — 引用共享模块 | 待做 |
| `scripts/restore-papers.js` | 修改 — 引用共享模块 | 待做 |
| `scripts/paper-distribution-report.js` | 修改 — 引用共享模块 | 待做 |
| `scripts/copy-papers.js` | 修改 — 引用共享模块 | 待做 |
| `api/handlers/exam-papers.js` | 修改 — API 返回 paper_type | 待做 |
| `frontend/assets/js/pages/province-page.js` | 修改 — 前端展示标签 | 待做 |
| `scripts/verify-paper-types.js` | 新建 — 验证脚本 | 待做 |

## 验证方案

1. 运行 `node scripts/verify-paper-types.js` 验证数据库一致性
2. 运行 `node scripts/generate-paper-type-list.js` 确认输出正确（山东应为自主命题）
3. 启动 API 服务，调用 `/api/exam-papers?province=shandong&year=2015` 确认返回 `paper_type=independent`
4. 访问 `frontend/province.html?province=shandong` 确认前端显示"自主命题"标签
5. 抽查新疆2025数学：应有两行（arts+science），paper_type=new_gaokao_ii
6. 抽查安徽2022语文：paper_type 应为 national_b
