# D088 — Canonical Question Bank Gate (QB-P0-AUDIT 修复 / Gate B)

**Date:** 2026-09-03
**Status:** 已执行 (本地 Docker DB `aitutor_db` @ `aitutor-db-1:55432`)
**前置:** `.ai/audits/QB-P0-AUDIT-2026-09-03.md` (FROZEN) — 🔴 NOT ATOMIC / NOT INGESTED
**范围:** Gate B — DB 约束 + canonical 构建/灌入/验收 + 写入 handler 修复。
**不做:** 不重建被毁内容 / 不灌无出处推断样本 / 不改 generate-paper 真题模式 / 不碰 zhongkao / 不验证线上生产 DB。

## 背景

审计证明 `exam_questions` 从未被灌入 (sequence NULL + n_tup_ins=0), 上游语料 88.6% 冗余、
merge/split/编码损坏, `question-bank/` 71.1% `undefined`, ingest 硬编码 `paper_id=NULL`,
create/batch handler 漏写 NOT NULL 的 `question_uid` (必然 500)。

## 决策

| ID | 决策 | 依据 |
|---|---|---|
| D088-1 | v1 只灌 provenance 可证明的北京 gaokao 语料 (parsed Tier-A/B + question-bank 真实目录), 其余进 rejected.ndjson | 用户拍板; P0-QB-12/15/16 需干净通过 |
| D088-2 | `question_uid` 沿用 D063 Rule A (`api/core/questionUid.js`), 新代码一律 import, 禁手写拼接 | D063 / migration 008 |
| D088-3 | 新增 `UNIQUE (paper_id, question_number)` (迁移 017), 删除冗余普通索引 | P0-QB-05; 审计三重验证现状为普通索引 |
| D088-4 | 清理分区父表 `exam_questions_partitioned` CASCADE (9 分区全空, 业务 0 引用); 审计原判 "无父表" 方向有误 → 分区属此父表 | 013 意图落地; pg_inherits 实测 |
| D088-5 | 跨源去重按 (paper, qn) 归一化 stem 聚类; 卷内跨 qn 同 stem → 后续 qn 判 DUPLICATE_WITHIN_PAPER 剔除 | 内容塌缩伪影 (英语 passage/cloze + 数学 LaTeX 抽空) 需守卫 |
| D088-6 | 损坏/不可复原记录一律排除 (rejected.ndjson + reason code), 不降级入库: MOJIBAKE / DANGLING_IMAGE_REF / MULTI_OPTION_SET_MERGE / EMPTY_OPTION_LABELS / LATEX_STRIPPED_SHORT_STEM / OPTION_ONLY_FRAGMENT / UNDEFINED_STEM / DUPLICATE_WITHIN_PAPER | 无原始 docx/pdf, 被毁内容无法修复 |
| D088-7 | KP 映射 = 确定性 (exact → 规范化 → name/subtopic 关键词包含), 未命中不强灌; raw 标签存 `exam_questions.knowledge_points`, 命中 id 存 `question_knowledge_points` | 1,309 标签 vs 426 节点确定性全匹配不可达 (Q14 > Q13) |
| D088-8 | 灌入幂等 replace: 每卷事务内先删本 pipeline 行 (file_path 前缀 parsed:/question-bank:/single-paper:) 再插入; paper 按 UK upsert | manifest == DB 收敛, 可重跑 |
| D088-9 | 不改 db.js / server.js / proxy.js / llm.js / essay (并发 agent 占用); db.js:588 会在下次启动重建冗余索引 idx_exam_questions_paper_number — 待 db.js 空档期删除 (记录于 runbook) | 并发工作区保护 |
| D088-10 | 修复 `createExamQuestion` / `batchCreateQuestions`: 补 question_uid (D063) + `ON CONFLICT ON CONSTRAINT uq_exam_questions_paper_number DO UPDATE` + KP 先清后插; batch 原缺 RETURNING id 一并修复 | NOT NULL 必炸 + Q17 前提 |
| D088-11 | Q13 (KP 覆盖率) v1 目标 ≥30%; 实测 14% → PARTIAL 上报 (确定性匹配极限, 见 kp-unmapped.json); 建议后续 LLM 辅助映射 + 人工审校 (类 migration 008 question_type_audit 先例) | 诚实度量, 不自定义 PASS |
| D088-12 | 验收 harness 逐条 P0-QB-01..17 (qb-acceptance.mjs), 退出码非 0 当 FAIL | Gate B 验收可复现 |

## 验收结果 (2026-09-03, 本地 DB)

```
16 PASS / 1 PARTIAL / 0 FAIL
P0-QB-01..12,14..17 PASS; P0-QB-13 PARTIAL (95/679 = 14% KP 链接, target >=30%)
exam_papers=35 (beijing gaokao 2019-2025 各卷, 含部分卷), exam_questions=679,
question_uid 全唯一, paper_id 无 NULL, provenance 无错配, rejected=423 (可追溯)
```

## 已知限制 / 后续

- **全 2021 卷被排除**: 源码整年 UTF-8 损坏 (MOJIBAKE), 需原始 docx/pdf 才能恢复。
- **图片题被排除**: `[图片N]` 引用悬空 (无原图文件), 恢复需原图或重新解析。
- **英语/数学覆盖偏低**: english cloze 共享 passage 文本 + math LaTeX 抽空 → 部分题源不可用。
- **KP 覆盖 14%**: 确定性匹配已达上限; 需 LLM 辅助映射 + 人工审校 提升 (建议 Gate B.2)。
- **生产 DB 未验证**: 本交付针对本地 Docker DB; 生产执行见 runbook (017 + ingest + acceptance)。
- **db.js:588** 待并发结束后删除 (与 uq 约束重复)。

## 产物

- `database/migrations/017_canonical_question_bank.sql`
- `api/core/questionBank.js` + `api/handlers/exam-questions.js` (修复)
- `scripts/qb/{qb-build,qb-ingest,qb-acceptance,smoke-handlers}.mjs` + `scripts/qb/lib/*.js`
- `database/canonical/{ingest,rejected}.ndjson + census.json + kp-unmapped.json`
- `tests/api/qb-*.test.js` (38 单测)
