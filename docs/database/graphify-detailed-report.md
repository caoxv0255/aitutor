# Graphify 细粒度知识图谱构建报告

## 完成内容

### 1. 高考真题 (graphify-gaokao/)
**基础元数据图谱:**
- `metadata.jsonl` — 11,277 条 PDF 记录
- `graph.cypher` — Province → Subject → Year → Paper (30,265行, 5.7MB)

**细粒度抽样图谱:**
- `structured_papers_sample.json` — 375 份抽样试卷内容提取
- `graph_detailed_sample.cypher` — Paper → Question 细粒度图谱 (5,932行)
  - Paper: 375 节点
  - Question: ~1,276 节点
  - Province/Subject 关联

### 2. 北京中考真题 (graphify-zhongkao-beijing/)
**基础元数据图谱:**
- `metadata.jsonl` — 209 条记录
- `graph.cypher` — Root → Subject → Year → Paper (693行, 111KB)

**细粒度题目图谱:**
- `structured_papers_full.json` — 75 份 docx 试卷题目结构化
- `structured_papers.json` — 10 份抽样详细提取
- `graph_detailed.cypher` — Paper → Question 细粒度图谱 (2,705行)
  - Paper: 75 节点
  - Question: ~1,125 节点
  - 总题目数: 2,828 道

### 3. 高中知识点归纳汇总 (graphify-gaokao-knowledge/)
**基础文档图谱:**
- `metadata.jsonl` — 9 条记录
- `graph.cypher` — Root → Subject → Document (50行, 5.6KB)

**细粒度知识点图谱:**
- `structured_knowledge.json` — 9 学科章节结构化
- `graph_detailed.cypher` — Subject → Chapter → KnowledgePoint (29,981行)
  - Subject: 9 节点
  - Chapter: 1,583 节点
  - KnowledgePoint: 12,600 节点

## 文件清单

```
graphify-gaokao/
  ├── metadata.jsonl                    # 11,277 条元数据
  ├── graph.cypher                      # 基础层级图谱
  ├── structured_papers_sample.json     # 375 份抽样内容
  └── graph_detailed_sample.cypher      # 细粒度抽样图谱

graphify-zhongkao-beijing/
  ├── metadata.jsonl                    # 209 条元数据
  ├── graph.cypher                      # 基础层级图谱
  ├── structured_papers_full.json       # 75 份 docx 题目结构
  ├── structured_papers.json            # 10 份抽样详细
  └── graph_detailed.cypher             # 细粒度题目图谱

graphify-gaokao-knowledge/
  ├── metadata.jsonl                    # 9 条元数据
  ├── graph.cypher                      # 基础文档图谱
  ├── structured_knowledge.json         # 9 学科章节结构
  └── graph_detailed.cypher             # 细粒度知识点图谱
```

## 导入命令

```bash
# Neo4j 导入 (需安装 cypher-shell)
cat graphify-gaokao/graph.cypher | cypher-shell -u neo4j -p password
cat graphify-gaokao/graph_detailed_sample.cypher | cypher-shell -u neo4j -p password
cat graphify-zhongkao-beijing/graph.cypher | cypher-shell -u neo4j -p password
cat graphify-zhongkao-beijing/graph_detailed.cypher | cypher-shell -u neo4j -p password
cat graphify-gaokao-knowledge/graph.cypher | cypher-shell -u neo4j -p password
cat graphify-gaokao-knowledge/graph_detailed.cypher | cypher-shell -u neo4j -p password
```

## 后续可深化方向
1. **高考真题全量 OCR**: 对 11,277 个 PDF 做批量 OCR + 题目切割，生成完整 Paper → Question → Option → Answer 图谱
2. **知识点关联**: 将高考真题 Question 与高中知识点 KnowledgePoint 做关联（需要 LLM 标注）
3. **北京中考 .doc 处理**: 安装 antiword 转换剩余 134 个 .doc 文件
4. **向量嵌入**: 对 Question 和 KnowledgePoint 做文本嵌入，支持语义搜索
