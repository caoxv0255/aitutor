import pandas as pd

entities = pd.read_parquet('graphrag_workspace/indexes/beijing_gaokao/output/entities.parquet')
rels = pd.read_parquet('graphrag_workspace/indexes/beijing_gaokao/output/relationships.parquet')
text_units = pd.read_parquet('graphrag_workspace/indexes/beijing_gaokao/output/text_units.parquet')

print('=== GraphRAG 索引统计 ===')
print(f'实体总数: {len(entities)}')
print(f'关系总数: {len(rels)}')
print(f'文本单元数: {len(text_units)}')
print(f'\n实体类型分布:')
print(entities['type'].value_counts())
print(f'\n关系类型分布:')
print(rels['relationship'].value_counts())
