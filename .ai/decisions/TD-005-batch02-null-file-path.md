# TD-005 — Batch02 灌入题 NULL file_path 溯源缺失（Tech Debt）

**Date:** 2026-09-14
**Type:** Tech Debt (非 P0 阻塞, 独立 backlog)
**Status:** 🟡 OPEN — 待后续空闲处理
**前置:** D090 报告（KP 覆盖率提升时观察到）

---

## 背景

D090 跑 stage32 时，按 `file_path` 是否非 NULL 分组观察到：

```
D088 beijing pilot (has fp)         | total=  725 | with_kp= 230 | coverage=31.72%
batch02 (NULL fp)                   | total= 5494 | with_kp= 386 | coverage=7.03%
```

**5494 题 (88.4%) 的 `exam_questions.file_path` 为 NULL**——这意味着这些题目无法反向追溯到原始 docx/pdf 源文件 (P0-QB-12 不通过)。

## 影响

| 维度 | 影响 |
|---|---|
| **P0-QB-12 (省份/年份/学科溯源)** | 88.4% 题无 `file_path`，无法反向定位源文件 |
| **P0-QB-15 (源 → DB 一致)** | 无法双向追溯 |
| **P0-QB-16 (双向可追溯)** | 抽样验证大概率失败 |
| **后续 re-ingest / 修复** | 无法定位损坏/缺失图片 / LaTeX 抽空的具体源文件 |
| **image 抽取** | 5494 题无源文件，无法执行 docx→word/media/* 抽取 |

## 根因（推测，待验证）

1. **batch02 灌入时未填 file_path**：stage32-canonical-write.mjs 写入路径可能用了空字符串或 NULL
2. **上游 parsed-examples JSON 没有 file_path 字段**：源语料本身不带路径，需要 manifest 补
3. **Docx→parsed 中间产物遗失链接**：从 docx 到 JSON 的 pipeline 把文件路径丢了

## 修复路径（待立项执行）

### Phase 1 — 诊断 (1-2h)
1. 跑 SQL：`SELECT file_path, COUNT(*) FROM exam_questions WHERE file_path IS NULL GROUP BY 1;`
2. 检查 batch02 灌入脚本 (scripts/batch02/) 的写入逻辑
3. 对比 batch02 之前的 D088 stage16 写入路径

### Phase 2 — 修补 (2-4h)
1. 从数据库反向定位 paper_id → `provinces + year + subject` → 数据库 `exam_papers.paper_file_path`（如果存在）
2. 用 paper_file_path 反向填充 exam_questions.file_path（每张试卷下所有 question 共享源路径）
3. 验收：file_path NULL 比例从 88.4% → <5%（剩余异常单独 case-by-case）

### Phase 3 — 防再犯 (1h)
1. db.js 或写入 handler 增加 NOT NULL 约束（但要谨慎，已写入数据迁移问题）
2. 灌入脚本加 file_path 必填断言
3. qb-acceptance.mjs 加 P0-QB-12 严格检查

## 阻塞依赖

- **生产 DB 验证（任务 B）暂缓**：在生产 DB 上验证此问题可能更高效（用户已暂缓）
- **source docx 恢复（gate-b-recovery-design-v2 §5 决策 2-1）**：若 `.Trash-1000/files/北京高考题库/` 恢复，原 file_path 可推断

## 估算

| Phase | 工作量 | 优先级 |
|---|---|---|
| 1 - 诊断 | 1-2h | P1 |
| 2 - 修补 | 2-4h | P1 |
| 3 - 防再犯 | 1h | P2 |
| 总计 | 4-7h | backlog |

## 不阻塞当前主线的依据

1. **KP 覆盖率已达 57.52% 远超 30% 目标**（D090）—— 不依赖 file_path
2. **题库基本可用** —— 用户查询/练习/薄弱点分析功能不依赖 file_path
3. **生产功能可继续**：用户拍照搜题 → 错题库走的是 `wrong_questions` + `task_queue`（与 exam_questions.file_path 无关）
4. **P0-QB-12 验收是架构层面问题**：影响未来 image 抽取 / re-ingest，但当前 v1.0 已发布

## 后续动作

- [ ] 在 backlog.yaml 登记此 TD
- [ ] 等待生产 DB 验证（任务 B）解冻后，优先修复
- [ ] 如有 image 抽取需求，必须先修此 TD
