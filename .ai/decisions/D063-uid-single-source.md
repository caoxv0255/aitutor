# D063 — question UID 单一来源

> **日期**: 2026-08-15
> **阶段**: Phase 3 数据完整性
> **影响范围**: 3 个 UID 生成点 (parse / migration / backfill)

## 问题

UID 生成规则散落三处, 已经出现分歧:

| 位置 | 规则 |
|------|------|
| `scripts/parse-questions-v4.js` `generateQuestionUID` | `${subject}_${year}_${provinceCode}_${questionNumber}` (Rule A) |
| `database/migrations/008_*.sql` | 同 Rule A (SQL 内联) |
| `scripts/backfill-question-uid.js` (未提交改动) | **Rule B**: `subject_year_paperId_qn` 优先 (跟 Rule A 不一致!) |

后果:
- 同一题在不同 pipeline 写入数据库时, 可能得到不同 UID
- 反查 (question_uid → question_id) 错位
- 数据分裂灾难

## 决策

建立 `api/core/questionUid.js` 作为**唯一来源**:

```js
export function generateQuestionUid({ subject, year, provinceCode, questionNumber, paperId, id } = {}) {
  if (subject && year != null && questionNumber != null) {
    return `${subject}_${year}_${provinceCode || 'xx'}_${questionNumber}`;
  }
  if (paperId != null && questionNumber != null) {
    return `q_${paperId}_${questionNumber}`;
  }
  if (id != null) {
    return `legacy_${id}`;
  }
  return null;
}
```

- **Rule A 主规则** (subject_year_province_qn) — 与 parse + migration 008 对齐
- 兜底 paperId_qn + legacy_id (保留 backfill 的安全链)
- backfill-question-uid.js 回退到 Rule A (撤销未提交的 Rule B 改动)

## 备选方案

| 方案 | 否决理由 |
|------|----------|
| 改 Rule B 为统一规则 (subject_year_paperId_qn) | paper_id 缺失时退化不稳定; migration 008 SQL 无法改 (历史) |
| Rule A vs Rule B 二选一, 不留兜底 | edge case (缺字段) 会生成 null UID → 业务错 |
| 在 migration 008 改 SQL 注释 + 加 trigger 强制生成 | SQL 与 JS 同步难维护 |

## 后果

- `parse-questions-v4.js` 删除内联 `generateQuestionUID`, import 共享
- `backfill-question-uid.js` 撤销 Rule B, import 共享
- migration 008 SQL 保持 Rule A (SQL 无法 import JS, 但规则由 JS 权威定义, SQL 是历史落地)
- UID 格式: `math_2025_beijing_3` (与 parse 输出一致)

## 验证

```js
import { generateQuestionUid } from './api/core/questionUid.js';
generateQuestionUid({ subject:'math', year:2025, provinceCode:'beijing', questionNumber:3 })
// → 'math_2025_beijing_3'  (与 migration 008 SQL 一致)
```

## 变更文件

| 文件 | 改动 |
|------|------|
| `api/core/questionUid.js` | **新增** |
| `scripts/parse-questions-v4.js` | 内联函数 → import (5 行) |
| `scripts/backfill-question-uid.js` | Rule B → 共享函数 (20 行) |