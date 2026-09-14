# TD-005 — Batch02 题干残缺 + file_path 溯源缺失（Tech Debt）

**Date:** 2026-09-14 (初版) / 2026-09-14 (v1.1 — 加入"题干残缺"作为核心修复动机)
**Type:** Tech Debt (非 P0 阻塞, 独立 backlog)
**Status:** 🟡 OPEN — 待后续空闲处理
**前置:** D090 + stage33b 分层抽样 (45 题) 暴露的"题干残缺"现象

---

## 1. 核心修复动机（v1.1 更新）

### 1.1 抽样证据

D090 完成 KP 覆盖率 9.91% → 57.52% 后，对剩余 2642 题用 `pg_trgm` 兜底做分层抽样（9 学科各 5 题），用户审阅后结论：

> **0% 通过率**（远低于 60% 底线），彻底放弃剩余题 KP 匹配，正式锁定 57.52%。

### 1.2 根因（不是算法缺陷，是上游数据问题）

抽样暴露的"题干残缺"是比 `file_path IS NULL` **更致命**的问题——题目在前端不可读、不可用：

| 现象 | 示例 | 占比估计 |
|---|---|---|
| **纯数字/乱码残留** | biology Q6285 stem = `"98"` / math Q5007 stem = `"98"` / physics Q8686 stem = `"5"` | ~5%（LaTeX/图片题被完全抽空）|
| **卷头说明混入** | math Q5165 / physics Q8659 stem = `"考试结束后，本试卷和答题卡一并交回..."` | ~3% |
| **匹配结果荒谬** | politics 题全匹配到"法律常识" / chinese 题全匹配到"沁园春·长沙" | trgm fallback 100% 失效 |
| **公式/图片题题干损坏** | 公式被 LaTeX 抽空成空 stem | 不可量化 |

**逻辑闭环**：正是因为 `file_path IS NULL`（5494 题 / 88.4%），我们**无法回溯源 `.docx` 重新提取这些残缺的题干和图片**。

```
file_path IS NULL (88.4% 题)
        ↓ 无法定位源 docx
        ↓ 无法从 docx 重新提取
题干残缺 / 图片丢失 / 公式抽空 (2642 题)
        ↓ 前端不可读、不可用
用户被迫放弃这部分题目（锁定 57.52%）
```

**修复 TD-005 是解锁剩余 2642 题（可能再 +40% 覆盖率）的唯一前置条件。**

---

## 2. 背景（v1.0 原版）

D090 跑 stage32 时，按 `file_path` 是否非 NULL 分组观察到：

```
D088 beijing pilot (has fp)         | total=  725 | with_kp= 230 | coverage=31.72%
batch02 (NULL fp)                   | total= 5494 | with_kp= 386 | coverage=7.03%
```

**5494 题 (88.4%) 的 `exam_questions.file_path` 为 NULL** —— 这些题目无法反向追溯到原始 docx/pdf 源文件 (P0-QB-12 不通过)。

---

## 3. 影响矩阵

| 维度 | 影响 | 严重度 |
|---|---|---|
| **P0-QB-12 (省份/年份/学科溯源)** | 88.4% 题无 `file_path`，无法反向定位源文件 | 🔴 |
| **P0-QB-15 (源 → DB 一致)** | 无法双向追溯 | 🔴 |
| **P0-QB-16 (双向可追溯)** | 抽样验证大概率失败 | 🔴 |
| **题干可读性** | 2642 题 stem 残缺（纯数字/卷头说明），前端不可读 | 🔴 P0 |
| **公式/图片题** | 5494 题无源文件，无法执行 docx→word/media/* 抽取 | 🔴 |
| **KP 覆盖率封顶** | 57.52% 是当前可解的上限，剩余题只能等 TD-005 | 🟡 |
| **wrong_questions 闭环** | 不受影响（独立路径） | 🟢 |

---

## 4. 根因（推测，待诊断验证）

1. **batch02 灌入时未填 file_path**：stage32-canonical-write.mjs 写入路径可能用了空字符串或 NULL
2. **上游 parsed-examples JSON 没有 file_path 字段**：源语料本身不带路径，需要 manifest 补
3. **Docx→parsed 中间产物遗失链接**：从 docx 到 JSON 的 pipeline 把文件路径丢了
4. **docx 解析时抽取破坏**：从 docx 转 JSON 时公式 / 图片 / 表格未保留为原始引用，被破坏为纯文本

---

## 5. 修复路径（待立项执行）

### Phase 1 — 诊断 (2-3h)
1. 跑 SQL：`SELECT file_path, COUNT(*) FROM exam_questions WHERE file_path IS NULL GROUP BY 1;`
2. 检查 batch02 灌入脚本 (`scripts/batch02/`) 的写入逻辑
3. 对比 batch02 之前的 D088 stage16 写入路径
4. **关键诊断**：对比 `database/parsed-examples/*.json` 与 `database/question-bank/` 中原始 docx 的位置，定位 file_path 来源
5. 抽样 50 题（10 题 × 5 学科）核对当前 stem 与 docx 中原始题目的差异

### Phase 2 — file_path 回填 (2-4h)
1. 从数据库反向定位 `paper_id → provinces + year + subject` → 数据库 `exam_papers.paper_file_path`（如果存在）
2. 用 `paper_file_path` 反向填充 `exam_questions.file_path`（每张试卷下所有 question 共享源路径）
3. 验收：`file_path` NULL 比例从 88.4% → <5%（剩余异常单独 case-by-case）

### Phase 3 — 题干重提取 (4-6h, **依赖 Phase 2**)
1. 基于已回填的 file_path，从 docx 重新提取题干
2. 处理 LaTeX 公式：保留为公式字符串 / MathML / image reference
3. 处理图片：从 `word/media/*` 抽取并存到 `question_images`
4. 处理卷头说明：通过位置标记 / 模板匹配剔除
5. 验收：抽样 100 题，与源 docx 对比，题干可读率 ≥ 95%

### Phase 4 — 防再犯 (1h)
1. db.js 或写入 handler 增加 file_path NOT NULL 约束（已写入数据迁移问题，需谨慎）
2. 灌入脚本加 file_path 必填断言
3. 加 docx 解析校验：若 docx 抽出纯数字 / 卷头说明则报警
4. qb-acceptance.mjs 加 P0-QB-12 严格检查 + 题干质量抽样检查

### Phase 5 — (可选) KP 覆盖率再冲刺
1. 在题干修复后，重新跑 stage32 跑全量（预计可再 +30~40% 覆盖率）
2. 终极目标：覆盖率 90%+

---

## 6. 估算

| Phase | 工作量 | 优先级 |
|---|---|---|
| 1 - 诊断 | 2-3h | P1 |
| 2 - file_path 回填 | 2-4h | P1 |
| 3 - 题干重提取 | 4-6h | **P0** (用户感知最直接) |
| 4 - 防再犯 | 1h | P2 |
| 5 - KP 再冲刺 | 3-5h | P2 (依赖 1-3) |
| 总计 | 12-19h | backlog |

---

## 7. 阻塞依赖

- **生产 DB 验证（任务 B）暂缓**：在生产 DB 上验证此问题可能更高效（用户已暂缓）
- **source docx 恢复**（gate-b-recovery-design-v2 §5 决策 2-1）：若 `.Trash-1000/files/北京高考题库/` 恢复，原 file_path 可推断 + docx 可重新解析
- **knowledge_points_v2 整合**（独立工作流）：v2 表 1558 KP 尚未被 question_knowledge_points 利用，需评估是否迁移（架构决策待立项）

---

## 8. 不阻塞当前主线的依据

1. **KP 覆盖率已达 57.52% 远超 30% 目标**（D090）—— 不依赖 file_path
2. **已锁定的"好数据"部分可用**：3577 题（57.52%）有 KP 链接，可驱动错题诊断/薄弱点分析
3. **生产功能可继续**：用户拍照搜题 → 错题库走的是 `wrong_questions` + `task_queue`（与 exam_questions.file_path 无关）
4. **P0-QB-12 验收是架构层面问题**：影响未来 image 抽取 / re-ingest，但当前 v1.0 已发布
5. **题干残缺不影响后端逻辑**：只是前端展示问题，可暂时用占位符或隐藏

---

## 9. 后续动作

- [x] 立项登记（v1.0 — 2026-09-14）
- [x] 加入"题干残缺"核心修复动机（v1.1 — 2026-09-14）
- [ ] 在 `backlog.yaml` 登记此 TD
- [ ] 等待生产 DB 验证（任务 B）解冻后，优先 Phase 1 诊断
- [ ] 评估 source docx 恢复（gate-b-recovery-design-v2 §5 决策 2-1）的影响

---

## 10. 已知未决策项（待用户裁决）

1. **`knowledge_points_v2` (1558 KP) 是否整合进 qkp 链路？**
   - 当前 qkp.knowledge_point_id FK 指向 `knowledge_points.id` (426 行)
   - v2 表字段独立 (kp_id/dimension_type/parent_id/origin)，未与 qkp 建立 FK
   - 选项 A：保持现状，仅在 v1 上做修复（最低风险）
   - 选项 B：扩展 qkp schema 加 `kp_v2_id`，双轨并行（中等风险）
   - 选项 C：迁移 qkp 到 v2 表（高风险，需重新跑全量）
   - **建议**：暂不决策，等 TD-005 修复后再评估（v2 是另一工作流产物，与题干残缺修复解耦）

2. **是否启动任务 B（生产 DB 验证）来加速此 TD 的诊断？**
   - 生产 DB 可能与本地不同（更完整或更残缺）
   - 验证后再做诊断可避免重复劳动
   - **当前判**：暂缓生产冷启动验证
