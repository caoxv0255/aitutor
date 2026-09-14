# Runbook — Canonical Question Bank Gate (QB-P0-AUDIT / Gate B)

**适用范围:** 本地开发 DB 或生产 DB (PostgreSQL, 需能执行 migration + 有 DATABASE_URL)
**一次性前置:** 本 repo 已含构建产物 `database/canonical/`。若上游题库文件更新, 先重新 `qb:build`。

## 1. Schema 迁移

```bash
# 本地 Docker DB
docker exec -i aitutor-db-1 psql -U aitutor -d aitutor_db < database/migrations/017_canonical_question_bank.sql
# 或生产 (连上目标库后)
psql "$DATABASE_URL" -f database/migrations/017_canonical_question_bank.sql
```

迁移 017 幂等可重复: 加 `UNIQUE (paper_id, question_number)`、删冗余普通索引、
清理空分区父表 `exam_questions_partitioned` (CASCADE, 仅当分区全空)。

> ⚠️ `api/core/db.js` 第 ~588 行在应用启动时会重建普通索引 `idx_exam_questions_paper_number`
> (与 uq 约束重复, 仅性能冗余)。待并发改动结束后删除该行 (D088-9)。

## 2. 校验规则 / 单测

```bash
npx vitest run tests/api/qb-questionBank.test.js tests/api/qb-validate.test.js \
  tests/api/qb-parsers.test.js tests/api/qb-kp-map.test.js tests/api/qb-dedupe.test.js
```

## 3. 构建 canonical 清单 (无 DB 写, 只读 kp 节点)

```bash
npm run qb:build
# 输出 database/canonical/{ingest,rejected}.ndjson + census.json + kp-unmapped.json
```

人工检查 census: 每卷 subject/year/province/valid/rejected 数与来源。rejected 必须可解释
(编码损坏 / 悬空图 / merge / split / 卷内重复)。

## 4. 灌入

```bash
npm run qb:ingest        # dry-run (不写)
npm run qb:ingest -- --commit      # 执行 (per-paper 幂等 replace)
```

前置自动确保 uq_exam_questions_paper_number 存在 (若 017 漏跑)。重跑安全: 卷内先删本 pipeline
旧行再插入, manifest == DB。

## 5. 验收 (P0-QB-01..17)

```bash
npm run qb:accept
# 期望: 16 PASS + Q13 PARTIAL 或更好; FAIL=0 时 exit 0
```

## 6. 写入 handler smoke (可选)

```bash
node scripts/qb/smoke-handlers.mjs   # 自清理, 验证 uid + ON CONFLICT + KP
```

## 7. 服务重启 (让运行中的 app 加载新 handler)

```bash
sudo systemctl restart uibe-tutor      # systemd 部署
docker compose restart app             # docker-compose 部署
curl -s localhost:3002/api/health      # 期待 dbReady:true
```

> handler 修复前运行中的 app 仍执行旧代码 (create/batch 会 500)。重启后:
> `POST /api/exam-questions/:id` 与 batch 均写入 question_uid 并幂等。

## 8. 生产注意事项 (如未来对生产执行)

1. 生产 DB 与本地 DB 是不同实例 — 本 runbook 的验收结果只代表本地。
2. 先 `017` 迁移 → 再 `qb:ingest --commit` (在能连到生产 DATABASE_URL 的机器上)。
3. 生产灌入前确认 `exam_questions`/`exam_papers` 为空或与 canonical 无冲突 (delete-then-insert
   只删 file_path 带 `parsed:/question-bank:/single-paper:` 前缀的行)。
4. 运行 `qb:accept` 并保留输出作为 Gate 证据。

## 回滚 (仅本地, 经确认)

```bash
docker exec aitutor-db-1 psql -U aitutor -d aitutor_db -c \
  "ALTER TABLE exam_questions DROP CONSTRAINT IF EXISTS uq_exam_questions_paper_number;"
# 如需清空 canonical 数据 (危险):
# TRUNCATE question_knowledge_points, exam_questions, exam_papers RESTART IDENTITY;
```
