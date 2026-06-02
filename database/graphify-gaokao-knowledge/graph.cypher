// 高中知识点归纳汇总知识图谱 - 自动导入
// 共 9 个PDF文件（九科）

MERGE (:Root {name: '高中知识点归纳汇总'})

MERGE (:Subject {name: '物理', level: 'gaokao', type: '知识点归纳'})
MATCH (root:Root {name: '高中知识点归纳汇总'}), (s:Subject {name: '物理', level: 'gaokao', type: '知识点归纳'}) MERGE (root)-[:HAS_SUBJECT]->(s)
MERGE (:Document {name: '（超详）高中物理知识点归纳汇总.pdf', subject: '物理', path: '高中知识点归纳汇总/（超详）高中物理知识点归纳汇总.pdf', level: 'gaokao'})
MATCH (s:Subject {name: '物理', level: 'gaokao', type: '知识点归纳'}), (d:Document {name: '（超详）高中物理知识点归纳汇总.pdf'}) MERGE (s)-[:HAS_DOCUMENT]->(d)

MERGE (:Subject {name: '生物', level: 'gaokao', type: '知识点归纳'})
MATCH (root:Root {name: '高中知识点归纳汇总'}), (s:Subject {name: '生物', level: 'gaokao', type: '知识点归纳'}) MERGE (root)-[:HAS_SUBJECT]->(s)
MERGE (:Document {name: '（超详）高中生物知识点归纳汇总.pdf', subject: '生物', path: '高中知识点归纳汇总/（超详）高中生物知识点归纳汇总.pdf', level: 'gaokao'})
MATCH (s:Subject {name: '生物', level: 'gaokao', type: '知识点归纳'}), (d:Document {name: '（超详）高中生物知识点归纳汇总.pdf'}) MERGE (s)-[:HAS_DOCUMENT]->(d)

MERGE (:Subject {name: '英语', level: 'gaokao', type: '知识点归纳'})
MATCH (root:Root {name: '高中知识点归纳汇总'}), (s:Subject {name: '英语', level: 'gaokao', type: '知识点归纳'}) MERGE (root)-[:HAS_SUBJECT]->(s)
MERGE (:Document {name: '（超详）高中英语知识点归纳汇总.pdf', subject: '英语', path: '高中知识点归纳汇总/（超详）高中英语知识点归纳汇总.pdf', level: 'gaokao'})
MATCH (s:Subject {name: '英语', level: 'gaokao', type: '知识点归纳'}), (d:Document {name: '（超详）高中英语知识点归纳汇总.pdf'}) MERGE (s)-[:HAS_DOCUMENT]->(d)

MERGE (:Subject {name: '数学', level: 'gaokao', type: '知识点归纳'})
MATCH (root:Root {name: '高中知识点归纳汇总'}), (s:Subject {name: '数学', level: 'gaokao', type: '知识点归纳'}) MERGE (root)-[:HAS_SUBJECT]->(s)
MERGE (:Document {name: '（超详）高中数学知识点归纳汇总.pdf', subject: '数学', path: '高中知识点归纳汇总/（超详）高中数学知识点归纳汇总.pdf', level: 'gaokao'})
MATCH (s:Subject {name: '数学', level: 'gaokao', type: '知识点归纳'}), (d:Document {name: '（超详）高中数学知识点归纳汇总.pdf'}) MERGE (s)-[:HAS_DOCUMENT]->(d)

MERGE (:Subject {name: '历史', level: 'gaokao', type: '知识点归纳'})
MATCH (root:Root {name: '高中知识点归纳汇总'}), (s:Subject {name: '历史', level: 'gaokao', type: '知识点归纳'}) MERGE (root)-[:HAS_SUBJECT]->(s)
MERGE (:Document {name: '（超详）高中历史知识点归纳汇总.pdf', subject: '历史', path: '高中知识点归纳汇总/（超详）高中历史知识点归纳汇总.pdf', level: 'gaokao'})
MATCH (s:Subject {name: '历史', level: 'gaokao', type: '知识点归纳'}), (d:Document {name: '（超详）高中历史知识点归纳汇总.pdf'}) MERGE (s)-[:HAS_DOCUMENT]->(d)

MERGE (:Subject {name: '化学', level: 'gaokao', type: '知识点归纳'})
MATCH (root:Root {name: '高中知识点归纳汇总'}), (s:Subject {name: '化学', level: 'gaokao', type: '知识点归纳'}) MERGE (root)-[:HAS_SUBJECT]->(s)
MERGE (:Document {name: '（超详）高中化学知识点归纳汇总.pdf', subject: '化学', path: '高中知识点归纳汇总/（超详）高中化学知识点归纳汇总.pdf', level: 'gaokao'})
MATCH (s:Subject {name: '化学', level: 'gaokao', type: '知识点归纳'}), (d:Document {name: '（超详）高中化学知识点归纳汇总.pdf'}) MERGE (s)-[:HAS_DOCUMENT]->(d)

MERGE (:Subject {name: '语文', level: 'gaokao', type: '知识点归纳'})
MATCH (root:Root {name: '高中知识点归纳汇总'}), (s:Subject {name: '语文', level: 'gaokao', type: '知识点归纳'}) MERGE (root)-[:HAS_SUBJECT]->(s)
MERGE (:Document {name: '（超详）高中语文知识点归纳汇总.pdf', subject: '语文', path: '高中知识点归纳汇总/（超详）高中语文知识点归纳汇总.pdf', level: 'gaokao'})
MATCH (s:Subject {name: '语文', level: 'gaokao', type: '知识点归纳'}), (d:Document {name: '（超详）高中语文知识点归纳汇总.pdf'}) MERGE (s)-[:HAS_DOCUMENT]->(d)

MERGE (:Subject {name: '政治', level: 'gaokao', type: '知识点归纳'})
MATCH (root:Root {name: '高中知识点归纳汇总'}), (s:Subject {name: '政治', level: 'gaokao', type: '知识点归纳'}) MERGE (root)-[:HAS_SUBJECT]->(s)
MERGE (:Document {name: '（超详）高中政治知识点归纳汇总.pdf', subject: '政治', path: '高中知识点归纳汇总/（超详）高中政治知识点归纳汇总.pdf', level: 'gaokao'})
MATCH (s:Subject {name: '政治', level: 'gaokao', type: '知识点归纳'}), (d:Document {name: '（超详）高中政治知识点归纳汇总.pdf'}) MERGE (s)-[:HAS_DOCUMENT]->(d)

MERGE (:Subject {name: '地理', level: 'gaokao', type: '知识点归纳'})
MATCH (root:Root {name: '高中知识点归纳汇总'}), (s:Subject {name: '地理', level: 'gaokao', type: '知识点归纳'}) MERGE (root)-[:HAS_SUBJECT]->(s)
MERGE (:Document {name: '（超详）高中地理知识点归纳汇总.pdf', subject: '地理', path: '高中知识点归纳汇总/（超详）高中地理知识点归纳汇总.pdf', level: 'gaokao'})
MATCH (s:Subject {name: '地理', level: 'gaokao', type: '知识点归纳'}), (d:Document {name: '（超详）高中地理知识点归纳汇总.pdf'}) MERGE (s)-[:HAS_DOCUMENT]->(d)
