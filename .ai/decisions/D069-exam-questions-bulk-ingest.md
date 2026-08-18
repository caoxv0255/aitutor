# D069: exam_questions 批量灌入 (P2-1)

**日期**: 2026-08-18
**状态**: 已实施
**相关**: D068 (RAG), P2-1

## 背景

P2-1: `exam_questions` 仅 50 条 (sim 数据), 不足以支撑真实用户场景。  
`database/parsed-examples/` 含 45 个 JSON 文件, ~20,000 条解析后的真题 (9 学科 × 2021-2025)。

## 决策

### 1. 数据源
- `database/parsed-examples/{subject}_{year}.json` — 45 个文件
- 9 学科: math/physics/chemistry/biology/chinese/english/geography/history/politics
- 5 年: 2021-2025
- 格式: `{ questions: [{ id, stem, options, answer, analysis, ... }] }`

### 2. UID 生成策略 (parsed 数据中 `question_uid=""`)
- 使用 `${subject}_${id}_${sha1_hash.slice(0,8)}` 模式
- `id` 来自 parsed JSON 的 `id` 字段 (数据库原始 ID)
- 避免与已存在 exam_questions.question_uid 冲突

### 3. 数据映射
- `subject_code`: 映射 9 学科 (chinese/english/math...)
- `year`: 来自文件名 (e.g. math_2024.json → 2024)
- `province_code`: 中文 → 拼音 (北京→beijing, 全国甲→national_a)
- `difficulty`: clamp 到 [1,5] (CHECK 约束)
- `knowledge_points`: JSON.stringify (数组 → TEXT)

### 4. 灌入脚本 (scripts/ingest-exam-questions.mjs)
- 增量 upsert (ON CONFLICT (question_uid) DO UPDATE)
- 批量查询已有 UID (避免单条查询 N+1)
- 错误处理: 每批错误独立计数, 不中断后续文件

## 影响

- `exam_questions`: 50 → **19,813 题** (388x 增长)
- 9 学科全覆盖: math(2,997) chinese(2,202) english(10,862) physics(1,027) chemistry(1,224) biology(399) history(415) geography(100) politics(587)
- exam_questions 与 rag_questions 解耦: P2-1 只灌 exam_questions (RAG 仍 50 题)

## 验证

```bash
node scripts/ingest-exam-questions.mjs
# 19,813 成功 / 0 失败 / 1.3 秒

DB 状态:
  total: 19,813
  subjects: 9
  years: 2021-2025
```