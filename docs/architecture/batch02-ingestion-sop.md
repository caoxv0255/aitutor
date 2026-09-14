# Batch-02 Ingestion Pipeline · 标准作业程序 (SOP)

> **Dispatch**: 011 Action 2 · **Status**: Blueprint Draft (v0.1) · **Last Updated**: 2026-09-10

---

## 一、目标与边界

**目标**：将全国各省市的真实中高考真题，以**可审计、可重跑、可中断**的方式批量接入题库。

**严格边界**：
1. ❌ **绝不直接写入 `public.exam_questions`**（任何对核心表的写操作必须经 dispatch 授权）
2. ✅ **只写入 `qb_recovery.*`**（staging + ledger）
3. ❌ **不调用任何 LLM**（默认模式），除非显式 `--with-llm`
4. ❌ **不触碰除 staging 之外的任何文件**

---

## 二、目录结构

```
database/incoming/                          # 原始数据入站区（用户/Qwen 投放）
├── gaokao/                                 # 高考
│   ├── chinese/
│   │   ├── 2024/
│   │   │   ├── beijing.json
│   │   │   └── shanghai.json
│   │   └── 2025/...
│   ├── math/...
│   ├── english/...
│   ├── physics/...
│   ├── chemistry/...
│   ├── biology/...
│   ├── history/...
│   ├── geography/...
│   └── politics/...
└── zhongkao/                                # 中考（结构相同）

database/preflight/batch02-staging/         # 文件式 staging 落地（脚本自动生成）
├── chinese/2026/chinese_2026_beijing_001_q001_<hash12>.json
└── ...
```

**入站文件命名建议**：`<province_code>.json` 或 `<province_code>_<paper_uid>.json`

---

## 三、JSON Schema（入站文件标准）

每个文件**必须**是以下两种之一：

### 形式 A：单题对象 / 题目数组

```json
{
  "metadata": {
    "source": "北京教育考试院",
    "ingest_batch": "batch02-001",
    "ocr_engine": "paddleocr",
    "verified_by": "wang@example.com"
  },
  "questions": [
    {
      "paper_uid":      "chinese_2026_beijing",          // 必填，paper_uid
      "question_number": 1,                              // 必填
      "subject":         "chinese",                       // 必填
      "year":            2026,                            // 必填
      "province_code":   "beijing",                       // 必填
      "exam_level":      "gaokao",                        // 必填 (gaokao/zhongkao)
      "stem":            "请以《春归》为题...",            // 必填
      "options":         null,                            // 可选，string 或 JSON
      "answer":          null,                            // 可选
      "analysis":        null,                            // 可选
      "question_type":   "essay",                         // 可选
      "difficulty":      3,                               // 可选 1-5
      "score":           50                               // 可选
    }
  ]
}
```

### 形式 B：JSONL（每行一个题目）

```jsonl
{"paper_uid":"chinese_2026_beijing","question_number":1,"subject":"chinese",...}
{"paper_uid":"chinese_2026_beijing","question_number":2,"subject":"chinese",...}
```

---

## 四、流水线阶段

```
┌──────────────────────────────────────────────────────────────────┐
│  Stage A · Discovery      扫描 database/incoming/ 找新文件       │
│  Stage B · Parse          .json/.jsonl → question 对象数组      │
│  Stage C · Hash           SHA-256(stem) 生成 dedup key          │
│  Stage D · Validate       D063 UID 格式 + 必填字段校验          │
│  Stage E · Stage          写入文件 staging + ledger (--commit) │
│  Stage F · Audit          生成 docs/audits/batch02-ingest-run.json │
└──────────────────────────────────────────────────────────────────┘
```

### 4.1 dedup 策略

`(paper_uid, question_number, stem_hash)` 三元组视为唯一键：
- 命中已有 staging 文件 → 跳过（不重写、不重记 ledger）
- 新键 → 写入 `database/preflight/batch02-staging/<subject>/<year>/...`

### 4.2 错误处理

- **JSON 解析失败** → 整个文件跳过，summary 记录
- **缺必填字段** → 该题跳过，summary 记录前 5 个错误
- **DB 错误** → 事务回滚，后续题继续

---

## 五、运行命令

```bash
# 1) 干跑（只扫描 + 校验，不写）
node scripts/batch02/01-ingest-pipeline.mjs

# 2) 真写入（文件 staging + ledger）
node scripts/batch02/01-ingest-pipeline.mjs --commit

# 3) 启用 LLM（材料题拆分 / KP 映射 / OCR 兜底；需 DASHSCOPE_API_KEY）
node scripts/batch02/01-ingest-pipeline.mjs --commit --with-llm

# 4) 限速（前 N 个文件）
node scripts/batch02/01-ingest-pipeline.mjs --limit 5

# 5) 验证幂等（再跑一次，应该全部 ⊘ duplicate）
node scripts/batch02/01-ingest-pipeline.mjs --commit
```

---

## 六、产出物 (Outputs)

| 路径 | 性质 | 说明 |
|---|---|---|
| `database/preflight/batch02-staging/<subject>/<year>/<paper_uid>_qNNN_<hash12>.json` | 落盘 staging | 每题一个 JSON 文件，含全部解析后字段 + `stem_hash` + `source_file` |
| `qb_recovery.canonical_migration_ledger` | ledger 记录 | 每次 `--commit` 成功插入都会写一条 `run_label='batch02-01-ingest-pipeline'` 的 STAGED 记录 |
| `docs/audits/batch02-ingest-run.json` | 运行报告 | 本次运行的 summary（files/parsed/valid/inserted/duplicates） |

---

## 七、安全 / 防篡改约束

1. **可重跑性**：相同输入多次跑，结果幂等（duplicate 数 = 之前 inserted 数）
2. **可中断**：每个文件单独 transaction，单题失败不影响其他题
3. **可审计**：所有写入 ledger 留痕；可通过 `SELECT * FROM qb_recovery.canonical_migration_ledger WHERE run_label='batch02-01-ingest-pipeline'` 反查
4. **零误伤**：pipeline 不修改 `public.exam_papers` / `public.exam_questions` / `public.question_knowledge_points` / 任何核心表

---

## 八、Schema 升级（✅ Dispatch 012 Task 1 已交付）

**Migration 021 已执行**：创建 `qb_recovery.batch02_staging` 专用表。

✅ 已落地字段：
- 三元组唯一去重 `(paper_uid, question_number, stem_hash)`
- `content_json` (JSONB) 保留原始解析结果
- `ingest_status` (状态机: parsed/validated/llm_enriched/failed/committed) + CHECK 约束
- 6 个 btree 索引 (paper_uid / subject / year / status / question_uid / subject+year)
- 自动 `updated_at` 触发器 (`trg_batch02_touch`)
- 外键 `paper_id_ref → public.exam_papers(id)` 与 `region_code → public.exam_regions(code)`（与 020 migration 联动）
- Ledger 留痕: `migration-021-batch02-staging` × 2 (SCHEMA_CREATED + TRIGGER_CREATED)

✅ Pipeline 已从文件式 staging **切换为 DB 模式**：
- `stageOneQuestion()` 现在直接 `INSERT INTO qb_recovery.batch02_staging`
- `content_json` 自动记录 `parse_engine` + `parsed_at` + `raw_input_keys`
- 幂等性通过 ON CONFLICT 三元组约束保证

📂 文件位置: `database/migrations/021_batch02_staging.sql`

---

## 九、与现有系统的对接

| 现有能力 | Batch-02 如何复用 |
|---|---|
| `services/embedding.js` (3 providers) | Batch-02 LLM 模式 (`--with-llm`) 启用后，对每题 stem 调一次 embedding，写入 `question_vectors` |
| `api/services/p03Adapter.js` | 拍题匹配仍可命中 Batch-02 入库的题目（一旦升级为 public.exam_questions） |
| `qb_recovery.canonical_migration_ledger` | Batch-02 复用同 ledger，仅 `entity_type='batch02_staging'` + `action='STAGED'` |
| `scripts/qb2/stage29-final-re-audit.mjs` | 未来扩展加入 batch02-staging 行数 + dedup 唯一性探针 |

---

## 十、当前实现状态（v0.2 · Dispatch 012 升级后）

✅ 已实现：
- Stage A/B/C/D/E/F 全流程
- `.json` / `.jsonl` 解析
- **`.docx` 解析** (mammoth.extractRawText + 启发式题号切分)
- D063 UID 自动派生
- dedup (`paper_uid + question_number + stem_hash`) — DB 级 UNIQUE 约束
- **DB staging** (`qb_recovery.batch02_staging`) — Dispatch 012 升级
- ledger 留痕（action='STAGED'，含 staging_id）
- 幂等性（重跑全 duplicate，零额外写入）
- dry-run 与 commit 双模式
- content_json 自动记录 parse_engine + parsed_at

⏳ 未来增强（待 Qwen 授权）：
- LLM 模式接入（KP 映射 / 材料题拆分）— 需 DASHSCOPE_API_KEY
- .docx 选项/答案自动归类（当前按行级启发式，未来可升级为段落结构解析）
- region_code / paper_id_ref 自动 lookup（020 表已就绪）

📦 **已交付**：
- `scripts/batch02/01-ingest-pipeline.mjs` (~360 行，含 mammoth 集成)
- `scripts/batch02/_make-fixture-docx.mjs` (测试用 .docx 生成器)
- `database/migrations/021_batch02_staging.sql` (专用 staging 表)
- `database/incoming/gaokao/chinese/2026/fixture-sample.json` (.json fixture)
- `database/incoming/gaokao/chinese/2026/beijing_2026_chinese_gaokao.docx` (.docx fixture)
- `qb_recovery.batch02_staging` (DB 表，6 行测试数据)

---

**DSH 立场**：SOP 已升级到 DB 模式 + .docx 解析 + 端到端验证；任何对核心表 schema 的进一步升级都必须经 Qwen 显式 dispatch。
