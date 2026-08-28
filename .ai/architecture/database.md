# Database Architecture — aitutor

> **目的**: 改 DB schema / 加表 / 加字段前先读本文件。配合 `runbooks/db-migration.md`。
> **最后更新**: 2026-08-28 (D083 补全)
> **当前状态**: 36 表, 426 知识点 (gaokao 381 + zhongkao 45)

---

## 1. 总览

**数据库**: PostgreSQL 16 + Apache AGE + pgvector

**自动建表机制** (无专门 migration 工具):
- `database/init/*.sql` — 容器首次启动自动跑 (extensions / partitions / pgvector)
- `api/core/db.js` `initTables()` — Express 启动时跑 (Sprint 加表快速路径)
- `database/migrations/*.sql` — 历史 decision 要求迁移到此目录

**Seed 机制**:
- `api/core/ensureSeeds.js` — 启动时 auto-seed 知识点 (D064)

---

## 2. 完整表清单 (36 表)

### 2.1 用户 & 学习状态 (Sprint 1+ 核心)

| 表 | 字段类型 | 用途 | Sprint 1 写入? |
|---|---|---|---|
| `users` | 关系字段 | 用户账号 (email, bcrypt password, grade) | — |
| `student_knowledge_mastery` | 关系字段 | 学生掌握度 (user_email, kp_id, mastery_score, attempt_count) | ✅ 写入 |
| `srs_review_log` | 关系字段 | SRS 复习日志 (user_email, kp_id, is_correct, review_quality) | ✅ 写入 |
| `wrong_questions` | `data JSONB` | 错题 (按 user_email) | — |
| `reports` | `data JSONB` | 诊断报告 | — |
| `task_queue` | 关系字段 + `result JSONB` | 异步任务 (图片识别) | — |
| `similar_questions` | `data JSONB` | 相似题推荐 | — |
| `personalized_papers` | `data JSONB` | 个性化试卷 | — |

### 2.2 知识点 & 题目

| 表 | 字段类型 | 用途 | 行数 |
|---|---|---|---|
| `knowledge_points` | 关系字段 + `subtopics JSONB` + `level` | 知识点 (gaokao/zhongkao) | 426 |
| `exam_questions` | 关系字段 + `data JSONB` | 题目 | 50 ⚠️ 偏少 |
| `exam_papers` | 关系字段 | 试卷 | 0 ⚠️ 未灌入 |

### 2.3 RAG / 向量

| 表 | 字段类型 | 用途 | 行数 |
|---|---|---|---|
| `rag_questions` | 关系字段 + `embedding vector(1024)` | 题目向量 (BGE-M3) | 0 ❌ 空表 |

### 2.4 AI / LLM

| 表 | 字段类型 | 用途 | 行数 |
|---|---|---|---|
| `ai_trace` | 关系字段 | LLM 调用追踪 (D069) | 0 ⚠️ 表建了未接入 |
| `ai_feedback` | 关系字段 | AI 反馈 | — |

### 2.5 Sprint 2 新增

| 表 | 用途 | 状态 |
|---|---|---|
| `today_task_log` | 今日任务日志 (Sprint 2) | 待建 (D082 B4) |

### 2.6 其他

| 表 | 用途 |
|---|---|
| `provinces` | 省份 (D068 seed 未调用, P0-3) |
| `class_*` | 班级分析 |
| `subject_*` | 学科分析 |
| `province_trends` | 省份趋势 |
| `trend_summary` | 趋势汇总 |
| `question_type_audit` | 题目类型审计 |
| `task_metrics` | 任务指标 |
| `users_initialized` | 用户初始化标记 |
| ... | 共 36 表 |

---

## 3. Schema 创建路径

来自 `agents/migration.md` §7:

```
路径 A: database/init/*.sql
   └─ 容器冷启动自动跑 (DBA 路径)
   └─ 用于 extensions / partitions / pgvector

路径 B: api/core/db.js initTables()
   └─ Express 启动自动跑 (应用路径)
   └─ 用于 Sprint 快速加表 (不重建镜像)

路径 C: database/migrations/*.sql
   └─ 历史 decision 要求迁移到此目录
   └─ 用于已稳定的 migration

路径 D: scripts/*.js (backfill)
   └─ 数据回填 (D063, D064 等)
```

---

## 4. Migration 编号规则

```
database/migrations/
├── 005_rag_questions.sql
├── 006_bge_m3_1024.sql
├── 007_derivative_knowledge_points.sql
├── 008_question_uid_and_type_enums.sql
├── 009_ai_trace.sql
├── 010_ai_trace_request_id.sql
├── 011_task_metrics_fk.sql
├── 012_ai_feedback.sql
├── 013_drop_partitioned.sql
├── 014_kp_foreign-keys.sql
├── 015_task_queue_check.sql
├── 016_question_uid_notnull.sql
└── 017_today_task_log.sql    ← Sprint 2 新增 (D082 B4)
```

**规则**:
- `NNN_descriptive_name.sql` (3 位序号 + 下划线 + 简短描述)
- 序号连续递增
- 每个文件**只做一件事**
- `IF NOT EXISTS` / `IF EXISTS` 保证 idempotent

---

## 5. Init SQL (容器首次)

```
database/init/
├── 01-extensions.sql           pgvector, AGE, pgcrypto 等
├── 02-partitions.sql           分区表 (按日期)
└── 03-performance.sql          HNSW 索引 / GUC 配置
```

⚠️ 当前 git status 显示 `database/init/01-extensions.sql` modified (D082 之前的状态)。

---

## 6. 关键约束 & 索引

### 6.1 核心 unique 约束

```sql
-- users
email UNIQUE

-- student_knowledge_mastery
UNIQUE(user_email, knowledge_point_id)

-- srs_review_log
UNIQUE(user_email, knowledge_point_id, review_at)
-- 或 (id, ...) 由 schema 决定

-- knowledge_points
id UNIQUE (D063 uid)
level IN ('gaokao', 'zhongkao')

-- Sprint 2 today_task_log
UNIQUE(user_email, task_date, knowledge_point_id, kind)
```

### 6.2 关键索引

```sql
-- student_knowledge_mastery
INDEX (user_email)
INDEX (mastery_score) WHERE mastery_score < 0.5  -- Sprint 2 薄弱点查询

-- srs_review_log
INDEX (user_email, knowledge_point_id)
INDEX (next_review_at) WHERE next_review_at <= NOW()  -- SRS 过期查询

-- knowledge_points
INDEX (level)

-- Sprint 2 today_task_log
INDEX (user_email, task_date DESC)
```

### 6.3 Foreign Key

```
D014: knowledge_points FK CASCADE
D011: task_metrics FK
D015: task_queue CHECK
D016: question_uid NOT NULL
```

---

## 7. 时区 (D081 §5)

**业务日期统一使用 `Asia/Shanghai`** (学校服务器所在地)。

```js
// 后端唯一权威 helper
function todayDateShanghai() {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric', month: '2-digit', day: '2-digit',
  });
  return fmt.format(new Date());
}
```

⚠️ **不要用 `WHERE task_date = CURRENT_DATE`** (依赖 DB timezone, 不可移植)。

⚠️ **验收 SQL 用 `'2026-08-28'`** (shell 注入 Shanghai 日期)。

---

## 8. UID 规则 (D063)

```
格式: q-{subject}-{hash}-{short}
例: q-math-a3b8f1-2c
```

**生成**: `api/core/questionUid.js` 的 `generateQuestionUid(subject, source, externalId)`

⚠️ **不要手写 uid 拼接**。

---

## 9. 修改 DB 的流程

1. 读 ADR
2. 选择路径 (A/B/C/D)
3. 验证两种场景 (全新 DB + 已存在 DB)
4. 跑 idempotent 重跑
5. 加测试 (`tests/api/<table>.test.js`)
6. 加 backfill (如有)
7. 跑 `npm run gate`
8. 输出 MIGRATION REPORT

详细: [`runbooks/db-migration.md`](../runbooks/db-migration.md) + [`agents/migration.md`](../agents/migration.md)

---

## 10. Sprint 2 (D082) DB 改动

### B4: `api/core/db.js` 加 `today_task_log`

```sql
CREATE TABLE IF NOT EXISTS today_task_log (
  id SERIAL PRIMARY KEY,
  user_email VARCHAR(255) NOT NULL,
  task_date DATE NOT NULL,
  knowledge_point_id VARCHAR(20) NOT NULL,
  kind VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  reason TEXT,
  estimated_minutes INTEGER DEFAULT 10,
  start_url TEXT,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  UNIQUE(user_email, task_date, knowledge_point_id, kind)
);

CREATE INDEX IF NOT EXISTS idx_today_task_log_user_date
  ON today_task_log (user_email, task_date DESC);
```

**三阶段生命周期**:
```
generated_at  → 系统推荐时间
started_at    → 学生点击 [开始] (DoD 3 关键)
completed_at  → status → completed
```

---

## 11. 已知 DB 问题

| 问题 | 来源 |
|---|---|
| `rag_questions` 空表 | P1-1 (audit 2026-08-17) |
| `provinces` 表未 seed | P0-3 (audit 2026-08-17) |
| `ai_trace` 表空壳 | P0-1 (audit 2026-08-17) |
| `exam_papers` 空表 | (RAG 灌入) |
| `exam_questions` 仅 50 条 | P2-1 (题库不足) |
| 错题表 4 行 | 偏少 (生产数据) |
| pgvector HNSW vs IVFFlat | known-bugs.md §2026-04 |
| Hybrid RAG 不同步 | known-bugs.md §2026-04 |

---

## 12. 不在 DB scope

- ❌ 加 GraphRAG 节点 (RAG scope)
- ❌ 加 ai_trace 写入 (Sprint 4+, 等 ai_trace 接入 P0-1)
- ❌ 换数据库 / 换 schema migration 工具 (CLAUDE.md 红线)
- ❌ 改 RAG embedding model (D068)

---

**文档结束 — database architecture v1.0 (2026-08-28)**