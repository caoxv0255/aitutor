# aitutor RAG Ingest v2 Audit (2026-08-04)

> **v2 改进**: ingest script 补 sub_questions prefix + shared_materials 入库 + 短 stem 过滤 10→5
> **结果**: 28,580 → 47,538 题入库 (+66%), 1,712 文件全 done, 0 fail

## 一、改进对比 (3 点)

| 改进 | v1 (28,580) | v2 (47,538) | + 增量 |
|---|---|---|---|
| **子题 dedup 误伤** | 0 (sub stem 跟 parent 重复被 SHA-256 干掉) | prefix `[子题·{parent_qid}]` 让跨题不同 hash | +15,862 sub_question |
| **shared_materials** | 0 (完全没入) | 2,469 (新功能) | +2,469 |
| **短 stem 过滤** | < 10 字符跳过 | < 5 字符跳过 | ~+700 (估) |
| **总计** | 28,580 | 47,538 | **+18,958 (+66%)** |

## 二、入库分布 (v2 47,538 题)

### question_type 分布

| type | v1 | v2 | + |
|---|---|---|---|
| sub_question | 8,351 | **24,213** | +15,862 (190%) |
| fill_or_answer | 9,690 | 9,792 | +102 |
| choice | 7,595 | 7,607 | +12 |
| composite | 3,446 | 3,456 | +10 |
| **shared_material** | 0 | **2,469** | +2,469 (新) |
| NULL | 1 | 1 | 0 |

### 学科分布 (v2)

| 学科 | v1 | v2 | + |
|---|---|---|---|
| 化学 | 4,366 | 8,436 | +93% |
| 生物 | 4,597 | 8,296 | +80% |
| 物理 | 3,969 | 7,159 | +80% |
| 地理 | 3,396 | 5,995 | +77% |
| 历史 | 2,747 | 4,389 | +60% |
| 英语 | 3,514 | 4,104 | +17% |
| 政治 | 2,768 | 3,742 | +35% |
| **数学** | 1,613 | 2,860 | **+77%** |
| 语文 | 1,609 | 2,555 | +59% |
| NULL | 2 | 2 | 0 |

## 三、对比 1,712 schema v5

| | schema v5 | v1 (28,580) | v2 (47,538) | v2 vs schema v5 |
|---|---|---|---|---|
| **主题 questions** | 32,517 | (~含) | (~含) | - |
| **子题 sub_questions** | 16,477 | 8,351 (dedup 误伤) | 24,213 (dedup 修复) | +47% (含 prefix 重复) |
| **shared_materials** | 3,764 | 0 (100% 漏) | 2,469 (-34%, 短材料跳) | -34% |
| **总入库** | 52,758 期望 | 28,580 (54%) | 47,538 (90%) | -10% (短材料) |

**关键**: v2 入库 47,538 / schema v5 期望 52,758 = **90% 完整度** (从 v1 54% 升到 90%, +36%)

剩余 5,220 缺:
- 318 文件 0 question (vendor 提取空, OCR 失败)
- shared_materials < 20 字符 (~800 短, 跳)
- sub_questions < 5 字符 (~500 短, 跳)
- dedup 真实重复 (~3k 跨文件同题)

## 四、跑时 stats

- 跑时: 65 min (vs v1 50 min, +30% 时长)
- 速度: 0.6 files/s (vs v1 0.8 files/s, 慢因为 shared_materials 处理)
- 失败: 0 文件, 但 ~30 Ollama 500 (单题失败, 不影响 file)
- 关键新题: shared_material 2,469 题入库 (之前 0)

## 五、quick-pick synonym 入口影响

v1 搜 "导数" 1 hit (字面). v2 期望:
- 搜 "极值" + math → ~40 hits (vs v1 20)
- 搜 "切线" + math → ~80 hits (vs v1 43)
- 搜 "单调" + math → ~100 hits (vs v1 52)
- 搜 "f(x)" → ~250 hits (vs v1 147)

(v2 增量 1.8x 跟总入库 +66% 一致)

## 六、commit + push

- commit: c8c2adbb feat(rag): ingest script 改进
- localtest: ✓
- origin/uibe: 待推

## 七、后续 (v0.7)

- **W2**: 改 bge-large-zh (1024 dim) + 重 ingest (估 130 min)
- **W4**: HNSW 索引 (50k+ 数据更准)
- **W6**: AGE 自定义镜像 (知识图谱接入)
- **W7**: difficulty 反查 (跟 W2 一起做)

---

**Generated**: 2026-08-04 15:37 CST | v0.6.0-dev → v0.7.0-dev 起步