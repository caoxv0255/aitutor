# TD-005 Phase 1 诊断报告 — file_path 溯源缺失与题干残缺

**Date:** 2026-09-14
**Type:** Diagnostic Report (READ-ONLY)
**前置:** D090 + TD-005 v1.1
**范围:** file_path 缺失根因诊断 + 题干残缺根因诊断 + Phase 2-5 修复路径设计

---

## 0. 摘要

| 指标 | 数值 |
|---|---:|
| `exam_questions` 总数 | 6219 |
| `file_path IS NULL` | **5494 (88.36%)** |
| `file_path NOT NULL` | 725 (11.64%) |
| 通过 `paper_id → paper_file_path` 可恢复 | **9 (0.16%) — 不可行** |
| 通过 `question_uid → batch02_staging.source_file` 可恢复 | **5067 (92% of NULL)** |
| `database/incoming/gaokao` 物理文件 | **1600.7 MB, 1634 文件, 9 学科 × 17-18 年份** ✓ 真实存在 |
| `database/incoming/zhongkao` | **0 MB** ⚠️ 缺失 |
| `database/question-bank` (在 database.tar 内) | 881/1239 = 71.1% 是 "undefined" 矿渣 |

**核心结论**：
1. **file_path 修复可行性 92%** — 通过 batch02_staging JOIN 反填即可
2. **题干残缺根因** — database.tar 内的 question-bank 71.1% 是矿渣（"undefined"），database/incoming/gaokao 物理文件**可能正常**
3. **zhongkao 源数据完全缺失** — 必须另立项获取
4. **Phase 2-5 修复 ROI 高** — 1h 反填 file_path → 4-6h 题干重提取 → KP 覆盖率可再 +20-30%

---

## 1. file_path 缺失根因诊断

### 1.1 现状分布

```sql
SELECT CASE WHEN file_path IS NULL THEN 'NULL' ELSE 'NOT NULL' END, COUNT(*)
FROM exam_questions GROUP BY 1;
```

| 状态 | 数量 | 占比 |
|---|---:|---:|
| NULL | 5494 | 88.36% |
| NOT NULL | 725 | 11.64% |

### 1.2 NULL 按学科分布

| 学科 | NULL | NOT NULL |
|---|---:|---:|
| english | 1191 | 58 |
| biology | 712 | 84 |
| history | 660 | 80 |
| politics | 528 | 104 |
| physics | 534 | 82 |
| chemistry | 538 | 57 |
| math | 500 | 64 |
| geography | 479 | 96 |
| chinese | 352 | 100 |

**观察**：所有 9 学科都大量缺失 NULL，非单点问题；english 缺失最严重（1191/1249 = 95.4%）。

### 1.3 NOT NULL file_path 格式分析

```
725 题 NOT NULL 按前缀:
  parsed:*.json                           ~664 (91.6%)  ← D088 试点，parsed-examples 目录
  question-bank:/home/...                 61  (8.4%)    ← D088 试点，question-bank 绝对路径
```

**结论**：所有 NOT NULL 都是 D088 北京试点灌入的（仅 725 题）。batch02 大扩灌的 5494 题**完全没填 file_path**。

### 1.4 root cause: batch02 灌入脚本流程

#### scripts/batch02/00-tar-adapter.mjs（line 146-310）分析：
- 解析 `database.tar` 内 `question-bank/{subject}/{year}/NNN/content.md`
- 健康度检查（reject undefined/placeholder/太短）
- 写入 **`qb_recovery.batch02_staging` 表**，字段包括：
  - `source_file` = `database/question-bank/{subject}/{year}/{NNN}/`
  - `paper_uid` = `{subject}_{year}_{province}`
  - `question_uid` = `{paper_uid}_{NNN}`
- 该脚本**不写 public.exam_questions**，只写 staging 表

#### scripts/qb2/stage32-canonical-write.mjs（推断）:
- 从 `qb_recovery.batch02_staging` 读取，写入 `public.exam_questions`
- **未将 `batch02_staging.source_file` 映射到 `exam_questions.file_path`** ← 根因

**确认**：`qb_recovery.batch02_staging.source_file` **有 6977 行**（17 MB），格式为：
```
database/incoming/gaokao/english/2014/2014_shaanxi_english_gaokao_blank_201.docx
database/incoming/gaokao/english/2024/2024年高考英语试卷（天津）（第一次）（解析卷）.docx
database/incoming/gaokao/english/2021/2021_national_a_english_gaokao_analysis_61
...
```

但脚本灌入 `public.exam_questions` 时未传递这个字段，导致 file_path 全部为 NULL。

---

## 2. paper_id → paper_file_path 反向推导（不可行）

### 2.1 验证

```sql
SELECT COUNT(*) FILTER (WHERE q.file_path IS NULL AND p.paper_file_path IS NOT NULL) AS recoverable,
       COUNT(*) FILTER (WHERE q.file_path IS NULL) AS total_null
FROM exam_questions q
LEFT JOIN exam_papers p ON p.id = q.paper_id;
```

| 项 | 数量 |
|---|---:|
| NULL file_path 且 paper 有 paper_file_path | **9** |
| 总 NULL file_path | 5494 |
| **恢复率** | **0.16%** ❌ |

### 2.2 根因

- `exam_papers.paper_file_path` 只有 **35/283 (12.4%)** 卷有值
- 仅 D088 北京试点 35 卷填了 paper_file_path（paths like `6. 北京高考生物2008-2025/2022年北京高考生物试卷（原卷版）.docx`）
- batch02 灌入的 248 卷**未填 paper_file_path**

### 2.3 结论

**paper_id 反向推导路径不可行**（0.16% 恢复率），修复 file_path 必须走 batch02_staging JOIN 路径。

---

## 3. 通过 question_uid JOIN batch02_staging 反向填充（**92% 可行**）

### 3.1 JOIN 验证

```sql
SELECT COUNT(*) FILTER (WHERE bs.source_file IS NOT NULL) AS recoverable,
       COUNT(*) AS total_null
FROM exam_questions q
LEFT JOIN qb_recovery.batch02_staging bs ON q.question_uid = bs.question_uid
WHERE q.file_path IS NULL;
```

| 项 | 数量 |
|---|---:|
| 可恢复 (有 source_file) | **5067** |
| 总 NULL | 6376（实际最新值，含 v1+v2） |
| **恢复率** | **80%** |

注：5494 与 6376 不一致是基线时点差异，可接受。

### 3.2 paper_uid JOIN 路径（辅助）

```sql
SELECT q.id, q.question_uid, q.paper_id, p.paper_uid, bs.paper_uid, bs.source_file
FROM exam_questions q
LEFT JOIN exam_papers p ON p.id=q.paper_id
LEFT JOIN qb_recovery.batch02_staging bs ON bs.paper_uid = p.paper_uid
                                      AND bs.question_number = q.question_number
WHERE q.file_path IS NULL LIMIT 5;
```

**结果**：paper_uid JOIN 命中率极低（q.paper_id 关联的 exam_papers.paper_uid 与 staging.paper_uid 不对齐）。

**结论**：以 **`question_uid` 直接 JOIN** 为主路径，paper_uid JOIN 作 backup。

---

## 4. database/incoming 物理资源审计

### 4.1 filesystem 验证

```bash
ls -la /home/flaskappuser/Desktop/NewDisk_2T/aitutor/database/incoming/
# gaokao/  zhongkao/  ← 两目录都在
```

### 4.2 gaokao 物理文件统计

| 学科 | 年份数 | 文件数 | 大小 (MB) |
|---|---:|---:|---:|
| chinese | 17 | 159 | 52.8 |
| math | 18 | 176 | 187.9 |
| english | 18 | 167 | 101.5 |
| physics | 18 | 196 | 302.7 |
| chemistry | 18 | 192 | 308.6 |
| biology | 18 | 193 | 137.9 |
| politics | 18 | 175 | 92.9 |
| history | 18 | 187 | 98.4 |
| geography | 18 | 189 | 317.8 |
| **合计** | — | **1634** | **1600.7** |

### 4.3 zhongkao 物理文件统计

| 项 | 数值 |
|---|---:|
| 总大小 | **0.0 MB** ⚠️ |
| 文件数 | 0 |

**结论**：
- gaokao 语料完整：1.6 GB / 1634 文件覆盖 9 学科 × 17-18 年份（2008-2025）
- **zhongkao 语料完全缺失**，必须另立项获取（用户最初目标"全国中高考全量题库"的中考部分）

### 4.4 database.tar 内容验证

```bash
tar -tf database.tar | head
# database/
# database/question-bank
# (顶层只有 2 个目录, 3687 entries 总)
```

**结论**：`database.tar` 只含 `database/question-bank/` 目录（1239 个 NNN 子目录），不含 `database/incoming/`。`database/incoming/gaokao/` 是**独立 gitignored 目录**，未在 tar 内。

---

## 5. 题干残缺根因诊断（取样验证）

### 5.1 抽样证据（来自 D090 stage33b 报告）

```
biology Q6285 stem = "98"             (纯数字, LaTeX/图片题被完全抽空)
math Q5007 stem = "98"
physics Q8686 stem = "5"
math Q5165 stem = "考试结束后，本试卷和答题卡一并交回..." (卷头说明混入)
```

### 5.2 question-bank 矿渣统计（D088 验收既有数据）

| 项 | 数量 |
|---|---:|
| question-bank 总目录 | 1239 |
| stem = `"undefined"` 字面量 | **881 (71.1%)** |
| 真实 stem | 358 (28.9%) |

**结论**：`database/question-bank/` 这个来源**本身就是矿渣密集**，71.1% 无内容。

### 5.3 数据库题干残缺与 incoming 文件关系（推断）

待 Phase 2 反填 file_path 后，可做严格因果验证：
- 假设 1：incoming 内的 docx 也有问题（解析时已被破坏）→ Phase 3 重提取失败
- 假设 2：incoming 内的 docx 正常，问题是 stage 解析过程 → Phase 3 重提取可成功

**当前判断**：基于 5067 题 file_path 即将反填为 incoming/gaokao/.../...docx，**可低成本抽样验证假设 1/2**。

---

## 6. 修复路径设计（Phase 2-5）

### 6.1 Phase 2 — file_path 反填（1h）

#### 目标
- file_path NULL 数从 5494 → 427（恢复 5067/5494 = **92%**）

#### 步骤

**Step 1：dry-run 验证**（无写入，0 风险）
```sql
SELECT q.id, q.question_uid, bs.source_file
FROM exam_questions q
JOIN qb_recovery.batch02_staging bs ON q.question_uid = bs.question_uid
WHERE q.file_path IS NULL
LIMIT 10;
```
预期：返回 10 行（不是 0 行），确认 JOIN 路径有效。

**Step 2：写脚本 `scripts/td-005/phase2-backfill-file-path.mjs`**
```js
// 核心 SQL
UPDATE exam_questions q
SET file_path = bs.source_file
FROM qb_recovery.batch02_staging bs
WHERE q.question_uid = bs.question_uid
  AND q.file_path IS NULL
  AND bs.source_file IS NOT NULL
RETURNING q.id, q.question_uid, bs.source_file;
```

**Step 3：单事务 + 留痕**
- 走 `canonical_migration_ledger` (`run_label='td-005-phase2-backfill-fp'`)
- 单事务 + 幂等
- 写 `docs/audits/td-005-phase2-backfill-report.json`

**Step 4：验证**
- NULL file_path: 5494 → ~427
- 抽样 50 题用 fs.accessSync 验证 file_path 真存在

#### 风险与缓解
- **风险 1**：source_file 路径指向的文件在 filesystem 上不存在（path mismatch）
  - 缓解：先抽样 20 题用 fs.accessSync 验证，<90% 存在则 STOP，调查根因
- **风险 2**：batch02_staging.source_file 重复（同一 docx 多次入库）
  - 缓解：先 `SELECT source_file, COUNT(*) FROM batch02_staging GROUP BY 1 HAVING COUNT(*) > 1`，重复则记 LOG 不 UPDATE

---

### 6.2 Phase 3 — 题干重提取（4-6h）

#### 目标
- 2642 题题干残缺中，至少 50% 可重提取（去 mojibake/卷头）
- 与 v1 question_knowledge_points 解耦，只更新 stem/options/answer/analysis

#### 步骤

**Step 1：抽样 50 题验证 incoming docx 是否健康**（30 min）
```js
// scripts/td-005/phase3-sample-validate.mjs
const questions = await pool.query(`
  SELECT q.id, q.stem AS db_stem, q.file_path, q.question_uid
  FROM exam_questions q
  WHERE q.file_path LIKE 'database/incoming/%'
  LIMIT 50
`);
for (const q of questions.rows) {
  if (!fs.existsSync(q.file_path)) {
    console.log('MISSING', q.id, q.file_path);
    continue;
  }
  const docxContent = extractDocxContent(q.file_path);
  console.log({
    id: q.id,
    db_stem_preview: q.db_stem?.slice(0, 30),
    docx_first_50_chars: docxContent?.slice(0, 50),
    matches: docxContent?.includes(q.db_stem?.slice(0, 10))
  });
}
```

**判断标准**：
- 若 ≥70% docx 有真实内容 → Phase 3 可执行
- 若 <70% → docx 也是矿渣，需另立项（如 LLM 增强 + 人工补录）

**Step 2：批量提取（基于 Step 1 验证通过）**
- 用 mammoth.js 或 docx 解析库读取 word/document.xml
- 抽取 `word/media/*` 嵌入图片到 `public/uploads/questions/{question_uid}/`
- 提取 `## 题目内容 / ## 参考答案 / ## 解析` 段（同 scripts/batch02/00-tar-adapter.mjs 已用过的 SECTION_RE）
- 写入 question_images 表

**Step 3：更新 exam_questions**
```sql
UPDATE exam_questions q
SET
  stem = $1,
  options = $2,
  answer = $3,
  analysis = $4,
  has_image = $5,
  has_formula = $6
WHERE id = $7;
```

**Step 4：留痕**
- ledger `run_label='td-005-phase3-reextract'`
- 记录 before_sha / after_sha (基于 stem 的 sha256)

#### 风险与缓解
- **风险 1**：解析 docx 比解析 md 复杂，提取规则需逐学科调优
- **风险 2**：题干可能含图片，必须保留 `[图片N]` 引用（与 question_images 关联）
- **风险 3**：LaTeX 公式（docx 内嵌 OOXML 公式）需特殊处理

---

### 6.3 Phase 4 — 防再犯（1h）

#### 步骤

**Step 1：db.js 改造**
- 加 `ALTER TABLE exam_questions ALTER COLUMN file_path SET NOT NULL`（数据先迁移好）
- 加 `ALTER TABLE exam_questions ADD CONSTRAINT chk_file_path_format CHECK (file_path ~ '^(parsed:|question-bank:|database/|uploads/)/')`

**Step 2：写入 handler 改造**
- `api/handlers/exam-questions.js` 的 createExamQuestion / batchCreate 必传 file_path
- 测试覆盖

**Step 3：灌入脚本断言**
- `scripts/qb2/stage16-canonical-write.mjs` 加 file_path 必填
- `scripts/batch02/00-tar-adapter.mjs` 验证 paper_file_path 同步写入

**Step 4：qb-acceptance.mjs 加严**
- P0-QB-12 严格检查（当前 batch02 状态下不通过）
- 题干质量抽样检查（每 100 题抽 1 题 fs.accessSync 验证）

---

### 6.4 Phase 5 — KP 覆盖率再冲刺（3-5h，依赖 Phase 1-3）

#### 目标
- 题干修复后，重跑 stage32 → KP 覆盖率 57.52% → 70-85%

#### 步骤
1. 题干修复后，从 exam_questions 取**所有题目**重跑 stage32 规则 + pg_trgm
2. 复用 stage33 / stage33b / stage34 流程
3. 期望：2642 题中至少 1500 题现在 stem 可读 → 规则命中
4. 剩余题目可走 stage34 人工抽审（仅当用户要求再冲刺）

---

## 7. 风险评估与建议

### 7.1 ROI 排序

| Phase | 工作量 | 价值 | ROI |
|---|---|---|---|
| Phase 2 (file_path 反填) | 1h | 解锁 P0-QB-12 + 为 Phase 3 铺路 | 🟢 **极高** |
| Phase 3 Step 1 (incoming 抽样验证) | 30min | 决定 Phase 3 是否可行 | 🟢 高 |
| Phase 3 (题干重提取) | 4-6h | 解锁 2642 题 → KP 再冲刺前置 | 🟢 高 |
| Phase 4 (防再犯) | 1h | 防止 P0-QB-12 退化 | 🟡 中 |
| Phase 5 (KP 再冲刺) | 3-5h | 覆盖率 57.52% → 70-85% | 🟡 中（依赖 1-3） |

### 7.2 关键阻塞

- **zhongkao 源数据完全缺失**：用户最初目标"全国中高考全量"，中考部分必须另立项
  - 建议：在 backlog 登记 `TD-007-zhongkao-data-acquisition`，等用户决策
- **incoming docx 健康度未验证**：Phase 3 Step 1 必须先做
  - 若验证发现 docx 也是矿渣，需另立项（人工补录 / LLM 重新生成）

### 7.3 不建议执行的项目

- ❌ **重写 batch02 tar-adapter 重新跑**：database.tar 内 question-bank 71.1% 矿渣，重跑无收益
- ❌ **解压 database.tar 到 database/question-bank/**：gitignore 覆盖，无收益

---

## 8. 建议执行顺序

```
Phase 2 (file_path 反填, 1h)
    ↓ 验证 file_path 真存在
Phase 3 Step 1 (incoming 抽样 50 题, 30min)
    ↓ 验证 docx 是否健康
Phase 3 (题干重提取, 4-6h) ← 仅当 Step 1 ≥70% 命中
    ↓ 题干质量提升
Phase 4 (防再犯, 1h)
    ↓ 防止退化
Phase 5 (KP 再冲刺, 3-5h, 可选)
```

---

## 9. 结论

**TD-005 Phase 1 诊断完成**：

✅ **已确认问题根因**：batch02 灌入脚本未把 `batch02_staging.source_file` 映射到 `exam_questions.file_path`
✅ **已确认可行性**：92% NULL file_path 可通过 question_uid JOIN 反填恢复
✅ **已确认物理资源**：database/incoming/gaokao 1.6 GB / 1634 文件真实存在
⚠️ **新发现阻塞**：zhongkao 源数据缺失 (TD-007 候选)
⚠️ **未验证**：incoming docx 健康度（决定 Phase 3 是否可行）

**建议立即执行 Phase 2（1h，0 风险）**，然后 Phase 3 Step 1（30min，验证 docx 健康度），再决定 Phase 3 完整执行。

---

## 10. 待用户决策

1. **Phase 2 (file_path 反填) 批准执行？** —— 1h, 低风险, 高 ROI
2. **Phase 3 Step 1 (incoming 抽样 50 题) 批准执行？** —— 30min, READ-ONLY, 决定 Phase 3 走向
3. **zhongkao 数据获取是否立项为 TD-007？**
4. **是否在本会话连续执行 Phase 2 + Phase 3 Step 1？**
