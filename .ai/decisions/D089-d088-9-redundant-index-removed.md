# D089 — D088-9 冗余索引清理（2026-09-14）

**Date:** 2026-09-14
**Status:** 🟢 EXECUTED — 闭环
**前置:** `.ai/decisions/D088-canonical-question-bank-gate.md` §D088-9 (待并发结束后删除)
**范围:** DB 索引清理 + db 初始化脚本同步

---

## 背景

D088-3 已创建 `UNIQUE (paper_id, question_number)` 约束，但 `idx_exam_questions_paper_number` 普通 btree 索引（与约束列完全重合）未删：

- 浪费写性能（每次 INSERT/UPDATE 需维护两份索引）
- 占磁盘空间
- 容易误导维护者（让人以为是 UNIQUE）
- 017 迁移 line 59 已 `DROP INDEX IF EXISTS`（幂等安全），但 db.js:552 + db-migrate.js:458 仍在 `CREATE INDEX IF NOT EXISTS`，下次启动会重新建

---

## 执行

### 1. DROP 现存冗余索引（一次性）
```sql
DROP INDEX IF EXISTS public.idx_exam_questions_paper_number;
```

### 2. 删 db.js:552
```diff
     CREATE INDEX IF NOT EXISTS idx_exam_questions_paper ON exam_questions(paper_id);
-    CREATE INDEX IF NOT EXISTS idx_exam_questions_paper_number ON exam_questions(paper_id, question_number);
+    -- D088-9: idx_exam_questions_paper_number removed (uq_exam_questions_paper_number 已替代)
     CREATE INDEX IF NOT EXISTS idx_exam_questions_difficulty ON exam_questions(difficulty);
```

### 3. 删 db-migrate.js:458
```diff
         'CREATE INDEX IF NOT EXISTS idx_exam_questions_year ON exam_questions(year)',
-        'CREATE INDEX IF NOT EXISTS idx_exam_questions_paper_number ON exam_questions(paper_id, question_number)',
+        // D088-9: idx_exam_questions_paper_number removed (uq_exam_questions_paper_number 已替代)
```

---

## 验证

### V1 - 启动 db.js 不重建
调用 `getDb()` 触发 schema 初始化 → 验证 `idx_exam_questions_paper_number` **不存在**，7 个业务索引完整：

```
idx_exam_questions_archive
idx_exam_questions_difficulty
idx_exam_questions_paper
idx_exam_questions_province
idx_exam_questions_subject
idx_exam_questions_type
idx_exam_questions_year
+ exam_questions_pkey
+ exam_questions_question_uid_key
+ uq_exam_questions_paper_number
```

### V2 - npm test 不退化
| | 修改前 | 修改后 |
|---|---|---|
| Test Files | 7 failed / 12 passed | **7 failed / 12 passed**（一致）|
| Tests | 6 failed / 245 passed | **6 failed / 245 passed**（一致）|
| Duration | 1.05s | 1.05s |

失败用例**全部 pre-existing**：mock JSON 缺失（tutor_loop_*）+ graphrag settings.yaml 缺失，与 db 索引无关。

### V3 - git diff 最小
```
api/core/db.js        | 2 +-
scripts/db-migrate.js | 2 +-
2 files changed, 2 insertions(+), 2 deletions(-)
```

---

## 已知限制

- **生产 DB（systemd 托管的 aitutor.service）未执行 DROP**：用户决定暂缓生产冷启动验证（D089 收尾后，下一轮由任务 B 处理）。
- **ai-tutor-frontend 6 个 mock JSON 缺失**与本决策无关，已纳入 pre-existing failures 清单。

---

## 产物

- `api/core/db.js`（552 行已更新）
- `scripts/db-migrate.js`（458 行已更新）
- 本决策文档 `D089-d088-9-redundant-index-removed.md`
