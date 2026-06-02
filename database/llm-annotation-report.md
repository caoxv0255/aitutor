# LLM 知识点标注报告

## 标注概况
- **模型**: kimi-k2.6 (https://mydamoxing.cn/v1)
- **标注对象**: 北京中考真题 50 道题目 (数学/物理/化学/语文/英语 各10道)
- **知识点来源**: 高中知识点归纳汇总 (每学科取前30个知识点作为候选)
- **输出文件**: `graphify-zhongkao-beijing/knowledge_annotations_full.json`

## 标注质量统计

| 学科 | 题目数 | 成功匹配 | 匹配率 | 平均关联知识点数 |
|------|--------|----------|--------|------------------|
| 化学 | 10 | 10 | 100% | 2.0 |
| 数学 | 10 | 6 | 60% | 1.7 |
| 物理 | 10 | 5 | 50% | 1.6 |
| 英语 | 10 | 6 | 60% | 1.7 |
| 语文 | 10 | 3 | 30% | 2.3 |

## 标注示例

### 化学 (高匹配率)
- 题目: "下列物质在O2中燃烧，火星四射，生成黑色固体的是"
- 关联知识点: [13, 16, 19] → "第一部分 化学基本概念和基本理论 > 13. 金属性"
- 理由: 考查金属在氧气中燃烧的性质

### 数学
- 题目: "下面几何体中，是圆锥的为"
- 关联知识点: [1, 2, 3] → "高中数学 必修2 > 1.1柱、锥、台、球的结构特征"
- 理由: 考查立体几何中圆锥的识别

## 生成的图谱文件

- `graphify-zhongkao-beijing/graph_annotations.cypher` — Question → KnowledgePoint 关联边 (66条)
- 可与其他 Cypher 文件合并导入 Neo4j

## 使用建议

1. **扩大标注规模**: 当前仅标注50题，可扩展到全部2,828道题目
2. **优化候选知识点**: 当前每学科只取前30个知识点，可构建更完整的候选池
3. **多模型投票**: 使用多个模型标注取交集，提高准确性
4. **人工校验**: 对关键题目（如易错题、高频考点）做人工校验

## 导入命令

```bash
# 导入基础图谱
cat graphify-gaokao-knowledge/graph_optimized.cypher | cypher-shell -u neo4j -p password
cat graphify-zhongkao-beijing/graph_optimized.cypher | cypher-shell -u neo4j -p password

# 导入 LLM 标注关联
cat graphify-zhongkao-beijing/graph_annotations.cypher | cypher-shell -u neo4j -p password
```

## 查询示例

```cypher
// 查询某知识点关联的所有题目
MATCH (kp:KnowledgePoint {name: '第一部分 化学基本概念和基本理论 > 13. 金属性'})<-[:TESTS_KNOWLEDGE]-(q:Question)
RETURN q.title, q.subject

// 查询某题目的关联知识点
MATCH (q:Question {id: 'annotated_化学_xxx'})-[:TESTS_KNOWLEDGE]->(kp:KnowledgePoint)
RETURN q.title, collect(kp.name) as knowledge_points
```
