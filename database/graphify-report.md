# Graphify 知识图谱化报告

## 1. 高考真题 (graphify-gaokao/)
- **来源**: 全国31省高考真题 2008-2025
- **文件数**: 11,277 PDF + 1,474 MP3 + 其他
- **元数据**: 11,277 条 (省份/学科/年份/卷别/类型)
- **图谱结构**: Province → Subject → Year → Paper
- **节点统计**:
  - Province: 31
  - Subject: 240 (31省 × 9科，部分省份缺科)
  - Year: 3,573 组合
  - Paper: 11,277
- **输出文件**:
  - `metadata.jsonl` — 结构化元数据
  - `graph.cypher` — Neo4j Cypher 导入脚本 (5.7 MB, 30,265行)

## 2. 北京中考真题 (graphify-zhongkao-beijing/)
- **来源**: 北京中考真题 2008-2025
- **文件数**: 209 (doc/docx)
- **元数据**: 209 条 (学科/年份/类型)
- **图谱结构**: Root(北京中考真题) → Subject → Year → Paper
- **节点统计**:
  - Subject: 9
  - Year: 124 组合
  - Paper: 209
- **输出文件**:
  - `metadata.jsonl`
  - `graph.cypher` (111 KB, 693行)

## 3. 高中知识点归纳汇总 (graphify-gaokao-knowledge/)
- **来源**: 高中九科知识点归纳汇总 PDF
- **文件数**: 9 PDF
- **元数据**: 9 条
- **图谱结构**: Root(高中知识点归纳汇总) → Subject → Document
- **节点统计**:
  - Subject: 9
  - Document: 9
- **输出文件**:
  - `metadata.jsonl`
  - `graph.cypher` (5.6 KB, 50行)

## 导入方式

### Neo4j 导入
```bash
# 高考真题 (分批执行，避免内存问题)
cat graphify-gaokao/graph.cypher | cypher-shell -u neo4j -p password

# 北京中考真题
cat graphify-zhongkao-beijing/graph.cypher | cypher-shell -u neo4j -p password

# 高中知识点
cat graphify-gaokao-knowledge/graph.cypher | cypher-shell -u neo4j -p password
```

### GitNexus 导入 (如支持 Cypher)
```bash
gitnexus import cypher graphify-gaokao/graph.cypher
```

## 后续深化建议
1. **高考真题**: 对重点省份（北京/上海/江苏/浙江）的 PDF 做 OCR + 题目结构化，建立 Paper → Question → KnowledgePoint 的细粒度图谱
2. **北京中考真题**: 209 个 doc/docx 文件可用 python-docx 提取文本，做题目级结构化
3. **高中知识点**: 9 个 PDF 可用 marker-pdf 或 pymupdf 提取文本，建立 Subject → Chapter → Section → KnowledgePoint 层级
