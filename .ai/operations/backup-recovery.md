# Backup & Recovery — 备份与恢复

> **最后更新**: 2026-08-28 (D083 补全)

---

## 1. 当前状态

⚠️ **仓库无自动化备份脚本** (audit 2026-08-17 未提及, D083 范围内不创建)。

**生产 DB**:
- PostgreSQL 16 + Apache AGE + pgvector
- 数据: 用户、错题、mastery、SRS、知识点、题目、RAG 向量

**风险**:
- ❌ 无定时备份
- ❌ 无灾难恢复演练
- ❌ 无异地备份

**P0 建议** (尚未做):
1. 每日 `pg_dump` 全量 + WAL 增量
2. 异地 OSS / S3 上传
3. 恢复演练每季度一次

---

## 2. 手动备份 (应急)

```bash
# 全量备份
docker exec aitutor-prod-db-1 pg_dump -U aitutor aitutor > /backup/aitutor-$(date +%Y%m%d).sql

# 压缩
gzip /backup/aitutor-$(date +%Y%m%d).sql

# 上传 OSS (示例, 需 aws cli 配置)
aws s3 cp /backup/aitutor-$(date +%Y%m%d).sql.gz s3://aitutor-backups/db/
```

---

## 3. 手动恢复

```bash
# 1. 停服务
docker compose -f docker-compose.prod.yml down

# 2. 删 DB volume (慎用!)
docker volume rm aitutor_pg-data

# 3. 重启 DB (会自动 init)
docker compose -f docker-compose.prod.yml up -d db
sleep 30  # 等待 init 完成

# 4. 灌入备份
gunzip -c /backup/aitutor-20260828.sql.gz | docker exec -i aitutor-prod-db-1 psql -U aitutor -d aitutor

# 5. 重启 app
docker compose -f docker-compose.prod.yml up -d app
```

---

## 4. 关键表的数据风险分级

| 表 | 数据风险 | 备份优先级 | 备份方式 |
|---|---|---|---|
| `users` | 不可重建 | P0 | 全量 |
| `student_knowledge_mastery` | 不可重建 | P0 | 全量 (Sprint 1 真实写入) |
| `srs_review_log` | 不可重建 | P0 | 全量 (Sprint 1 真实写入) |
| `wrong_questions` | 不可重建 | P0 | 全量 |
| `today_task_log` | 可重建 (Sprint 2+) | P1 | 全量 |
| `knowledge_points` | seed 重建 | P2 | seed JSON |
| `exam_questions` | seed 重建 | P2 | seed JSON |
| `rag_questions` | 重灌入 | P2 | 重灌入 |
| `ai_trace` | 可丢 | P3 | 不备份 |

---

## 5. 数据不可重建的表

以下表的真实数据如果丢失, **不可重建**:
- `users` (用户行为)
- `student_knowledge_mastery` (学习进度)
- `srs_review_log` (复习历史)
- `wrong_questions` (用户错题)

⚠️ 这些表**必须**备份。

---

## 6. 备份策略建议 (待落地)

### 6.1 每日全量 + WAL 增量

```bash
# cron (每天凌晨 3 点)
0 3 * * * /opt/aitutor/scripts/backup-daily.sh
```

`backup-daily.sh` (示例):
```bash
#!/bin/bash
set -e
BACKUP_DIR=/backup/aitutor
DATE=$(date +%Y%m%d)
mkdir -p $BACKUP_DIR

# 全量
docker exec aitutor-prod-db-1 pg_dump -U aitutor aitutor | gzip > $BACKUP_DIR/full-$DATE.sql.gz

# 清理 30 天前
find $BACKUP_DIR -name "full-*.sql.gz" -mtime +30 -delete

# 上传 OSS
aws s3 cp $BACKUP_DIR/full-$DATE.sql.gz s3://aitutor-backups/db/
```

### 6.2 WAL 增量 (Point-in-Time Recovery)

需要在 `postgresql.conf` 配置:
```
wal_level = replica
archive_mode = on
archive_command = 'aws s3 cp %p s3://aitutor-backups/wal/%f'
```

⚠️ 当前未配置, 需要 DBA 介入。

---

## 7. 灾难恢复演练

每季度一次:
1. 选一个非生产环境 (staging)
2. 从最新备份恢复
3. 验证关键功能:
   - 用户能登录
   - 错题能查
   - mastery 数值正确
   - today_task_log 数据正确
4. 记录恢复时间 (RTO) + 数据丢失 (RPO)

⚠️ **当前未做演练**, 这是 P0 风险。

---

## 8. 数据迁移的备份要求

任何 irreversible migration **必须**先备份:

```bash
# 1. 备份
docker exec aitutor-prod-db-1 pg_dump -U aitutor aitutor | gzip > /tmp/pre-migration.sql.gz

# 2. 跑 migration
psql -f 017_today_task_log.sql

# 3. 验证
psql -c "\dt today_task_log"
# ... 业务验证

# 4. 如有问题, 回滚
gunzip -c /tmp/pre-migration.sql.gz | docker exec -i aitutor-prod-db-1 psql -U aitutor -d aitutor
```

---

## 9. 已知风险 (P0)

| 风险 | 影响 | 缓解 |
|---|---|---|
| 无自动化备份 | 数据丢失无解 | 加 cron + OSS |
| 无异地备份 | 机房故障 → 全丢 | OSS / S3 跨区 |
| 无恢复演练 | 真出事不会恢复 | 季度演练 |
| 无 WAL PITR | 只能恢复到备份时间点 | 配置 archive_mode |

---

## 10. 不在 backup scope

- ❌ 备份脚本创建 (D083 范围内不创建, 仅文档化 SOP)
- ❌ OSS / S3 配置 (运维决策)
- ❌ DB schema 修改 → 见 `architecture/database.md`

---

**文档结束 — backup-recovery v1.0 (2026-08-28)**