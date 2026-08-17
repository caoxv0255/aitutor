# D068: 中考知识点 Seed 补齐

**日期**: 2026-08-17
**状态**: 已实施
**相关**: D066 (gate 体系), AGENTS.md (P2-1)

## 背景

CLAUDE.md 声明 `database/seed_knowledge_points_zhongkao.json` 包含 42 条中考知识点，
但文件从未创建（`ls` 确认不存在）。`.status/database.yaml` 显示 `level_zhongkao: 0`。

## 决策

### 1. 创建 seed 文件
- `database/seed_knowledge_points_zhongkao.json`: 45 条中考知识点（9科 × 覆盖核心考点）
- 学科: math(9), physics(8), chemistry(7), biology(5), chinese(5), english(5), history(3), politics(3)
- 格式与 gaokao seed 一致: `id, subject, name, difficulty, frequency, level='zhongkao'`

### 2. 独立 seed handler
- `api/handlers/seed-zhongkao.js`: 独立函数 `seedZhongkao()`，幂等 upsert
- 只检测 `level='zhongkao'` 的行数，不影响 gaokao 数据
- 被 `ensureSeeds()` 调用

### 3. 集成到 ensureSeeds
- 启动时: 先检查 gaokao（全空则导入），再检查 zhongkao（level=0 则导入）
- 两处独立幂等，互不影响

## 影响

- DB 现在有 gaokao(381) + zhongkao(45) = 426 知识点
- 中考用户可以使用知识点过滤 / weak-points / trend-summary 功能
