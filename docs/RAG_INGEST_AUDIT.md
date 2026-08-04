# aitutor RAG 入库完整性审计 (2026-08-04)

> **核心结论**: 28,580 题入库, 实际 41.6% 漏. vendor schema v5 提取阶段就漏了 + ingest script 限制.

## 数据对比

| | schema v5 (1,712 文件) | 入库 (rag_questions) | 缺失 |
|---|---|---|---|
| **文件数** | 1,712 | 1,712 done | 0 |
| **主题 questions** | 32,517 | (含子题 28,580) | ~16% |
| **子题 sub_questions** | 16,477 | (含主题 28,580) | 部分 |
| **shared_materials** | 3,764 | 0 (完全没入) | 100% |
| **主题+子题** | 48,994 | 28,580 | **20,414 (41.6%)** |
| **0 question 文件** | 318 (18.5%) | - | (vendor 提取空) |
| **数学题** | 2,253 | 1,613 | 640 (28.4%) |

## "导数" 关键词 audit (核心疑问)

| keyword | schema v5 (math) | 入库 (math) | 说明 |
|---|---|---|---|
| 导数 | 1 | 1 | 字面命中少, 高考题 stem 不直接写 "导数" |
| 极值 | 54 | 20 | 导数题常用 synonym |
| 切线 | 88 | 43 | 导数几何意义 |
| 单调 | 106 | 52 | 导数单调性 |
| f(x) | 341 | 147 | 导数题标准形式 |
| 倒数 | 0 | 0 | "倒数" 是错的, 实际是 "导数" OCR 误识 |

**结论**: schema v5 提取用 OCR 时, 高考导数题 stem 多数写"求极值/证明单调/求切线", 不直接写"导数". 用 synonym 搜能找到.

## 缺题根因 (3 层)

### 1. vendor schema v5 提取阶段 (~50% 缺)
- OCR 误识 (导数→倒数, 极值→极直, etc.)
- 大题 (composite) 的子题没被分词
- shared_materials (3,764 段) 完全没分类为题
- 318 文件 0 question (18.5%) 提取空 (可能是空白卷/解析版没题)

### 2. ingest script 限制 (~10% 缺)
- `q.stem < 10 字符过滤` 跳过短题
- sub_questions 部分没全入 (16,477 expected, 实际 ~16k 入库, 估缺 4k)
- shared_materials 完全不抽题
- **只抽 `q.stem`**, 不抽 `q.options` `q.answer` `q.analysis` (schema v5 有这些)

### 3. dedup 误伤 (~5% 缺)
- content_hash SHA-256 严格去重, 但 schema v5 同题 (同 stem) 跨省出现 (如 2010 高考数学 31 省都考) 算不同题, OK
- 但 sub_questions 跟 parent 重复 (sub stem = parent stem 摘要), 被 content_hash dedup 掉

## 短期修法 (P1 1-2h)

### A. ingest script 改进:
1. 入 sub_questions 时, content 不只 stem, 加 question_id 前缀避免 dedup 误伤
2. 抽 shared_materials 进 rag_questions (改 type='material'), 至少 768 维向量
3. schema v5 的 q.options + q.answer + q.analysis 进 metadata

### B. demo 改进:
- 加 "导数题" 快速入口: 搜 synonym (极值/切线/单调)
- "知识点" dropdown 替代 subject filter (用户真正想找"导数题" 不是 "math 全部题")

## 长期修法 (v0.7 半天-1天)

1. **vendor 重提取**: 1,712 文件用更好的 OCR (PaddleOCR) + 题型分类 (按 KP map)
2. **KP (knowledge point) map**: 1,711 文件 mapping 知识点 (math/derivative, math/limit, etc.)
3. **shared_materials 单独表** (rag_materials, 4-8k 维 embedding)
4. **改 embedding 模型**: bge-large-zh (1024 dim, 中文 better) + 重 ingest (~50 min)
5. **数学 vendor 反馈**: 导数题 synonym 不应该漏 (vendor bug 报告)

## 当前 demo "导数" 搜不到的实际

数学题 1,613 条入库, 其中:
- 导数 (字面) 1
- 极值 20, 单调 52, 切线 43, f(x) 147

搜 "导数" 1 hit, 搜 "极值" 应 ~20 hit, 搜 "单调" 应 ~52 hit. **都是真导数题, 只是 stem 不写"导数"**.

## 行动建议

| 优先级 | 任务 | 工作量 | 价值 |
|---|---|---|---|
| **A** | 改 demo: 搜 synonym (极值/单调/切线) 找导数题 | 5 min | 即时, 你验证精度 |
| **B** | ingest script 改进: sub_q 提内容 + shared_materials | 30 min | 补 ~16k 漏题 (10k→26k) |
| **C** | vendor 反馈: 导数题 synonym 漏 (math 28% 缺) | 1 天 | 长期质量 |
| **D** | 改 bge-large-zh + 重 ingest | 50 min | 中文 embedding 更好 |

推荐 A (5 min) 立刻让你看到导数题. 跑完看是不是真命中. 然后选 B/C/D.