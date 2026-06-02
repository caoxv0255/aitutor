#!/bin/bash
# Graphify 知识图谱合并导入脚本
# 使用: bash import_all.sh <neo4j_password>

PASSWORD=${1:-password}
NEO4J_HOST=${2:-bolt://localhost:7687}

echo '========================================'
echo 'Graphify 知识图谱导入 Neo4j'
echo '========================================'

echo '[1/6] 导入高中知识点基础图谱...'
cat graphify-gaokao-knowledge/graph.cypher | cypher-shell -u neo4j -p $PASSWORD -a $NEO4J_HOST

echo '[2/6] 导入高中知识点细粒度图谱...'
cat graphify-gaokao-knowledge/graph_optimized.cypher | cypher-shell -u neo4j -p $PASSWORD -a $NEO4J_HOST

echo '[3/6] 导入高考真题全量图谱...'
cat graphify-gaokao/graph_full.cypher | cypher-shell -u neo4j -p $PASSWORD -a $NEO4J_HOST

echo '[4/6] 导入高考真题抽样细粒度图谱...'
cat graphify-gaokao/graph_detailed_sample.cypher | cypher-shell -u neo4j -p $PASSWORD -a $NEO4J_HOST

echo '[5/6] 导入北京中考真题图谱...'
cat graphify-zhongkao-beijing/graph_optimized.cypher | cypher-shell -u neo4j -p $PASSWORD -a $NEO4J_HOST

echo '[6/6] 导入LLM知识点标注关联...'
# 合并版标注（北京中考240题 + 高考80题）
if [ -f graph_annotations_merged.cypher ]; then
    cat graph_annotations_merged.cypher | cypher-shell -u neo4j -p $PASSWORD -a $NEO4J_HOST
    echo '  合并版标注导入完成'
else
    # 回退到旧版
    cat graphify-zhongkao-beijing/graph_annotations.cypher | cypher-shell -u neo4j -p $PASSWORD -a $NEO4J_HOST 2>/dev/null || echo '  标注文件不存在，跳过'
fi

echo ''
echo '========================================'
echo '导入完成!'
echo '========================================'

# 统计节点数
echo '节点统计:'
cypher-shell -u neo4j -p $PASSWORD -a $NEO4J_HOST --format plain <<'EOF'
MATCH (n) RETURN labels(n)[0] as type, count(n) as count ORDER BY count DESC;
EOF