// 高考真题 - 抽样细粒度知识图谱 (375份试卷)
// 共 375 份抽样试卷

MERGE (:Root {name: '高考真题题库'})

MERGE (p:Paper {name: '2014年高考化学试卷（新课标Ⅰ）（空白卷）.pdf', province: '湖南', subject: '化学', year: '2014', type: '空白卷', volume: '空白卷', preview: '2014 年全国统一高考化学试卷（新课标Ⅰ）
一、选择题（本题共 7小题，每小题 6分，共 42分）
1．（6分）下列化合物中同分异构体数目最少的是（ ）
A．戊烷 B．戊醇 C．戊烯 D．乙酸乙酯
2．（6分）化学与社会、生活密切相关，对下列现象或事实的解释正确的是（ ）
选项 现象或事实 解释
', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '湖南'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '化学', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '湖南_化学_2014_1', title: '一、选择题（本题共 7小题，每小题 6分，共 42分）', subject: '化学', year: '2014', province: '湖南'})
WITH q MATCH (p:Paper {name: '2014年高考化学试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_化学_2014_2', title: '1．（6分）下列化合物中同分异构体数目最少的是（ ）', subject: '化学', year: '2014', province: '湖南'})
WITH q MATCH (p:Paper {name: '2014年高考化学试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_化学_2014_3', title: '2．（6分）化学与社会、生活密切相关，对下列现象或事实的解释正确的是（ ）', subject: '化学', year: '2014', province: '湖南'})
WITH q MATCH (p:Paper {name: '2014年高考化学试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_化学_2014_4', title: '3．（6分）已知分解1mol H O 放出热量98kJ，在含少量I﹣的溶液中，H O 分解', subject: '化学', year: '2014', province: '湖南'})
WITH q MATCH (p:Paper {name: '2014年高考化学试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2016年高考化学试卷（新课标Ⅰ）（空白卷）.pdf', province: '湖南', subject: '化学', year: '2016', type: '空白卷', volume: '空白卷', preview: '2016 年全国统一高考化学试卷（新课标Ⅰ）
一、选择题（共 7小题，每小题 6分，满分 42分）
1．（6分）化学与生活密切相关，下列有关说法错误的是（ ）
A．用灼烧的方法可以区分蚕丝和人造纤维
B．食用油反复加热会产生稠环芳香烃等有害物质
C．加热能杀死流感病毒是因为蛋白质受热变性
D．医用消', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '湖南'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '化学', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '湖南_化学_2016_1', title: '一、选择题（共 7小题，每小题 6分，满分 42分）', subject: '化学', year: '2016', province: '湖南'})
WITH q MATCH (p:Paper {name: '2016年高考化学试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_化学_2016_2', title: '1．（6分）化学与生活密切相关，下列有关说法错误的是（ ）', subject: '化学', year: '2016', province: '湖南'})
WITH q MATCH (p:Paper {name: '2016年高考化学试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_化学_2016_3', title: '2．（6分）设N 为阿伏加德罗常数值．下列有关叙述正确的是（ ）', subject: '化学', year: '2016', province: '湖南'})
WITH q MATCH (p:Paper {name: '2016年高考化学试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_化学_2016_4', title: '3．（6分）下列关于有机化合物的说法正确的是（ ）', subject: '化学', year: '2016', province: '湖南'})
WITH q MATCH (p:Paper {name: '2016年高考化学试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_化学_2016_5', title: '4．（6分）下列实验操作能达到实验目的是（ ）', subject: '化学', year: '2016', province: '湖南'})
WITH q MATCH (p:Paper {name: '2016年高考化学试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2024年高考化学试卷（湖南）（解析卷）.pdf', province: '湖南', subject: '化学', year: '2024', type: '解析卷', volume: '解析卷', preview: '化学试题
可能用到的相对原子质量：H 1 C 12 N 14 O 16 Cl 35.5 Cu 64
一、选择题：本题共 14小题，每小题 3分，共 42分。在每小题给出的四个选项中，只有一
项是符合题目要求的。
1. 近年来，我国新能源产业得到了蓬勃发展，下列说法错误的是
A. 理想的新能源应具有资', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '湖南'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '化学', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '湖南_化学_2024_1', title: '一、选择题：本题共 14小题，每小题 3分，共 42分。在每小题给出的四个选项中，只有一', subject: '化学', year: '2024', province: '湖南'})
WITH q MATCH (p:Paper {name: '2024年高考化学试卷（湖南）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_化学_2024_2', title: '1. 近年来，我国新能源产业得到了蓬勃发展，下列说法错误的是', subject: '化学', year: '2024', province: '湖南'})
WITH q MATCH (p:Paper {name: '2024年高考化学试卷（湖南）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_化学_2024_3', title: '2. 下列化学用语表述错误的是', subject: '化学', year: '2024', province: '湖南'})
WITH q MATCH (p:Paper {name: '2024年高考化学试卷（湖南）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2022年高考化学试卷（湖南）（解析卷）.pdf', province: '湖南', subject: '化学', year: '2022', type: '解析卷', volume: '解析卷', preview: '湖南省 2022 年普通高中学业水平选择性考试
化学
注意事项：
1.答卷前，考生务必将自己的姓名、准考证号填写在本试卷和答题卡上。
2.回答选择题时，选出每小题答案后，用铅笔把答题卡上对应题目的答案标号涂黑。如需改
动，用橡皮擦干净后，再选涂其他答案标号。回答非选择题时，将答案写在答题卡上，写在
', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '湖南'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '化学', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '湖南_化学_2022_1', title: '1.答卷前，考生务必将自己的姓名、准考证号填写在本试卷和答题卡上。', subject: '化学', year: '2022', province: '湖南'})
WITH q MATCH (p:Paper {name: '2022年高考化学试卷（湖南）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_化学_2022_2', title: '2.回答选择题时，选出每小题答案后，用铅笔把答题卡上对应题目的答案标号涂黑。如需改', subject: '化学', year: '2022', province: '湖南'})
WITH q MATCH (p:Paper {name: '2022年高考化学试卷（湖南）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_化学_2022_3', title: '动，用橡皮擦干净后，再选涂其他答案标号。回答非选择题时，将答案写在答题卡上，写在', subject: '化学', year: '2022', province: '湖南'})
WITH q MATCH (p:Paper {name: '2022年高考化学试卷（湖南）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_化学_2022_4', title: '3.考试结束后，将本试卷和答题卡一并交回。', subject: '化学', year: '2022', province: '湖南'})
WITH q MATCH (p:Paper {name: '2022年高考化学试卷（湖南）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_化学_2022_5', title: '一、选择题：本题共 10小题，每小题 3分，共 30 分。在每小题给出的四个选项中，只有一', subject: '化学', year: '2022', province: '湖南'})
WITH q MATCH (p:Paper {name: '2022年高考化学试卷（湖南）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2009年高考化学试卷（全国卷Ⅰ）（空白卷）.pdf', province: '湖南', subject: '化学', year: '2009', type: '空白卷', volume: '全国卷Ⅰ', preview: '2009 年全国统一高考化学试卷（全国卷Ⅰ）
一、选择题（共 8小题，每小题 5分，满分 40分）
1．（5 分）下列各组离子，在溶液中能大量共存、加入 NaOH 溶液后加热既有
气体放出又有沉淀生成的一组是（ ）
A．Ba2+、NO ﹣、NH +、Cl﹣ B．Ca2+、HCO ﹣、NH +、AlO', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '湖南'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '化学', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '湖南_化学_2009_1', title: '一、选择题（共 8小题，每小题 5分，满分 40分）', subject: '化学', year: '2009', province: '湖南'})
WITH q MATCH (p:Paper {name: '2009年高考化学试卷（全国卷Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_化学_2009_2', title: '1．（5 分）下列各组离子，在溶液中能大量共存、加入 NaOH 溶液后加热既有', subject: '化学', year: '2009', province: '湖南'})
WITH q MATCH (p:Paper {name: '2009年高考化学试卷（全国卷Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_化学_2009_3', title: '2．（5分）将15mL 2mol•L﹣1 Na CO 溶液逐滴加入到40mL 0.5mol•L﹣1 MCl 盐', subject: '化学', year: '2009', province: '湖南'})
WITH q MATCH (p:Paper {name: '2009年高考化学试卷（全国卷Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_化学_2009_4', title: '3．（5分）下列表示溶液中发生反应的化学方程式错误的是（ ）', subject: '化学', year: '2009', province: '湖南'})
WITH q MATCH (p:Paper {name: '2009年高考化学试卷（全国卷Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_化学_2009_5', title: '7．（5分）有关下图所示化合物的说法不正确的是 （ ）', subject: '化学', year: '2009', province: '湖南'})
WITH q MATCH (p:Paper {name: '2009年高考化学试卷（全国卷Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2008年高考化学试卷（全国卷Ⅰ）（解析卷）.pdf', province: '湖南', subject: '化学', year: '2008', type: '解析卷', volume: '全国卷Ⅰ', preview: '2008年全国统一高考化学试卷（全国卷Ⅰ）
参考答案与试题解析
一、第Ⅰ卷选择题（在每小题给出的四个选项中，只有一项是符合题目要求的．
）
1．（3分）在溶液中加入足量Na O 后仍能大量共存的离子组是（ ）
2 2
A．NH +、Ba2+、Cl﹣、NO ﹣ B．K+、AlO ﹣、Cl﹣、SO 2﹣', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '湖南'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '化学', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '湖南_化学_2008_1', title: '一、第Ⅰ卷选择题（在每小题给出的四个选项中，只有一项是符合题目要求的．', subject: '化学', year: '2008', province: '湖南'})
WITH q MATCH (p:Paper {name: '2008年高考化学试卷（全国卷Ⅰ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_化学_2008_2', title: '1．（3分）在溶液中加入足量Na O 后仍能大量共存的离子组是（ ）', subject: '化学', year: '2008', province: '湖南'})
WITH q MATCH (p:Paper {name: '2008年高考化学试卷（全国卷Ⅰ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2013年高考化学试卷（新课标Ⅰ）（解析卷）.pdf', province: '湖南', subject: '化学', year: '2013', type: '解析卷', volume: '解析卷', preview: '2013 年全国统一高考化学试卷（新课标Ⅰ）
参考答案与试题解析
一、选择题
1．（6分）化学无处不在，与化学有关的说法不正确的是（ ）
A．侯氏制碱法的工艺过程中应用了物质溶解度的差异
B．可用蘸浓盐酸的棉棒检验输送氨气的管道是否漏气
C．碘是人体必需微量元素，所以要多吃富含高碘酸的食物
D．黑火', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '湖南'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '化学', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '湖南_化学_2013_1', title: '一、选择题', subject: '化学', year: '2013', province: '湖南'})
WITH q MATCH (p:Paper {name: '2013年高考化学试卷（新课标Ⅰ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_化学_2013_2', title: '1．（6分）化学无处不在，与化学有关的说法不正确的是（ ）', subject: '化学', year: '2013', province: '湖南'})
WITH q MATCH (p:Paper {name: '2013年高考化学试卷（新课标Ⅰ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_化学_2013_3', title: '2．（6 分）香叶醇是合成玫瑰香油的主要原料，其结构简式如图所示：下列有', subject: '化学', year: '2013', province: '湖南'})
WITH q MATCH (p:Paper {name: '2013年高考化学试卷（新课标Ⅰ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2017年高考化学试卷（新课标Ⅰ）（解析卷）.pdf', province: '湖南', subject: '化学', year: '2017', type: '解析卷', volume: '解析卷', preview: '2017 年全国统一高考化学试卷（新课标Ⅰ）
参考答案与试题解析
一、选择题：本题共 7 个小题，每小题 6 分．在每小题给出的四个选项中，只
有一项是符合题目要求的．
1．（6分）下列生活用品中主要由合成纤维制造的是（ ）
A．尼龙绳 B．宣纸 C．羊绒衫 D．棉衬衣
【考点】L3：常用合成高分子', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '湖南'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '化学', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '湖南_化学_2017_1', title: '一、选择题：本题共 7 个小题，每小题 6 分．在每小题给出的四个选项中，只', subject: '化学', year: '2017', province: '湖南'})
WITH q MATCH (p:Paper {name: '2017年高考化学试卷（新课标Ⅰ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_化学_2017_2', title: '1．（6分）下列生活用品中主要由合成纤维制造的是（ ）', subject: '化学', year: '2017', province: '湖南'})
WITH q MATCH (p:Paper {name: '2017年高考化学试卷（新课标Ⅰ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_化学_2017_3', title: '2．（6分）《本草衍义》中对精制砒霜过程有如下叙述：“取砒之法，将生砒就', subject: '化学', year: '2017', province: '湖南'})
WITH q MATCH (p:Paper {name: '2017年高考化学试卷（新课标Ⅰ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2010年高考化学试卷（全国卷Ⅰ）（解析卷）.pdf', province: '湖南', subject: '化学', year: '2010', type: '解析卷', volume: '全国卷Ⅰ', preview: '2010年全国统一高考化学试卷（全国卷Ⅰ）
参考答案与试题解析
一、选择题
1．（3分）下列判断错误的是（ ）
A．熔点：Si N ＞NaCl＞SiI
3 4 4
B．沸点：NH ＞PH ＞AsH
3 3 3
C．酸性：HClO ＞H SO ＞H PO
4 2 4 3 4
D．碱性：NaOH＞Mg（', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '湖南'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '化学', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '湖南_化学_2010_1', title: '一、选择题', subject: '化学', year: '2010', province: '湖南'})
WITH q MATCH (p:Paper {name: '2010年高考化学试卷（全国卷Ⅰ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_化学_2010_2', title: '1．（3分）下列判断错误的是（ ）', subject: '化学', year: '2010', province: '湖南'})
WITH q MATCH (p:Paper {name: '2010年高考化学试卷（全国卷Ⅰ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2020年高考化学试卷（新课标Ⅰ）（空白卷）.pdf', province: '湖南', subject: '化学', year: '2020', type: '空白卷', volume: '空白卷', preview: '2020 年全国统一高考化学试卷（新课标Ⅰ）
一、选择题：本题共7小题，每小题6分，共42分。在每小题给出的四个选项中，只有一
项是符合题目要求的。
1．（6分）国家卫健委公布的新型冠状病毒肺炎诊疗方案指出，乙醚、75%乙醇、含氯消毒
剂、过氧乙酸（CH COOOH）、氯仿等均可有效灭活病毒。对于上', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '湖南'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '化学', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '湖南_化学_2020_1', title: '一、选择题：本题共7小题，每小题6分，共42分。在每小题给出的四个选项中，只有一', subject: '化学', year: '2020', province: '湖南'})
WITH q MATCH (p:Paper {name: '2020年高考化学试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_化学_2020_2', title: '1．（6分）国家卫健委公布的新型冠状病毒肺炎诊疗方案指出，乙醚、75%乙醇、含氯消毒', subject: '化学', year: '2020', province: '湖南'})
WITH q MATCH (p:Paper {name: '2020年高考化学试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_化学_2020_3', title: '2．（6分）紫花前胡醇（ ）可从中药材当归和白芷中提取得到，能', subject: '化学', year: '2020', province: '湖南'})
WITH q MATCH (p:Paper {name: '2020年高考化学试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_化学_2020_4', title: '3．（6分）下列气体去除杂质的方法中，不能实现目的的是（ ）', subject: '化学', year: '2020', province: '湖南'})
WITH q MATCH (p:Paper {name: '2020年高考化学试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2012年高考化学试卷（新课标）（空白卷）.pdf', province: '湖南', subject: '化学', year: '2012', type: '空白卷', volume: '空白卷', preview: '2012 年全国统一高考化学试卷（新课标）
一、选择题（每小题 6 分．在每小题给出的四个选项中，只有一项是符合题目
要求的）
1．（6分）下列叙述中正确的是（ ）
A．液溴易挥发，在存放液溴的试剂瓶中应加水封
B．能使润湿的淀粉KI试纸变成蓝色的物质一定是Cl
2
C．某溶液中加入CCl ，CCl', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '湖南'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '化学', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '湖南_化学_2012_1', title: '一、选择题（每小题 6 分．在每小题给出的四个选项中，只有一项是符合题目', subject: '化学', year: '2012', province: '湖南'})
WITH q MATCH (p:Paper {name: '2012年高考化学试卷（新课标）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_化学_2012_2', title: '1．（6分）下列叙述中正确的是（ ）', subject: '化学', year: '2012', province: '湖南'})
WITH q MATCH (p:Paper {name: '2012年高考化学试卷（新课标）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_化学_2012_3', title: '2．（6分）下列说法正确的是（ ）', subject: '化学', year: '2012', province: '湖南'})
WITH q MATCH (p:Paper {name: '2012年高考化学试卷（新课标）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_化学_2012_4', title: '3．（6分）用N 表示阿伏加德罗常数的值，下列叙述中不正确的是（ ）', subject: '化学', year: '2012', province: '湖南'})
WITH q MATCH (p:Paper {name: '2012年高考化学试卷（新课标）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_化学_2012_5', title: '6．（6分）分析下表中各项的排布规律，按此规律排布第26项应为（ ）', subject: '化学', year: '2012', province: '湖南'})
WITH q MATCH (p:Paper {name: '2012年高考化学试卷（新课标）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2019年高考化学试卷（新课标Ⅰ）（空白卷）.pdf', province: '湖南', subject: '化学', year: '2019', type: '空白卷', volume: '空白卷', preview: '2019 年全国统一高考化学试卷（新课标Ⅰ）
一、选择题：共7小题，每小题6分，满分42分。在每小题给出的四个选项中，只有一项
是符合题目要求的。
1．（6分）陶瓷是火与土的结晶，是中华文明的象征之一，其形成、性质与化学有着密切的
关系。下列说法错误的是（ ）
A．“雨过天晴云破处”所描述的瓷器青色', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '湖南'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '化学', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '湖南_化学_2019_1', title: '一、选择题：共7小题，每小题6分，满分42分。在每小题给出的四个选项中，只有一项', subject: '化学', year: '2019', province: '湖南'})
WITH q MATCH (p:Paper {name: '2019年高考化学试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_化学_2019_2', title: '1．（6分）陶瓷是火与土的结晶，是中华文明的象征之一，其形成、性质与化学有着密切的', subject: '化学', year: '2019', province: '湖南'})
WITH q MATCH (p:Paper {name: '2019年高考化学试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_化学_2019_3', title: '2．（6分）关于化合物2﹣苯基丙烯（ ），下列说法正确的是（ ）', subject: '化学', year: '2019', province: '湖南'})
WITH q MATCH (p:Paper {name: '2019年高考化学试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_化学_2019_4', title: '3．（6分）实验室制备溴苯的反应装置如图所示，关于实验操作或叙述错误的是（ ）', subject: '化学', year: '2019', province: '湖南'})
WITH q MATCH (p:Paper {name: '2019年高考化学试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_化学_2019_5', title: '4．（6分）固体界面上强酸的吸附和离解是多相化学在环境、催化、材料科学等领域研究的', subject: '化学', year: '2019', province: '湖南'})
WITH q MATCH (p:Paper {name: '2019年高考化学试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2011年高考化学试卷（新课标）（解析卷）.pdf', province: '湖南', subject: '化学', year: '2011', type: '解析卷', volume: '解析卷', preview: '2011年全国统一高考化学试卷（新课标）
参考答案与试题解析
一、选择题
1．下列叙述正确的是（ ）
A．1.00molNaCl中含有6.02×1023个NaCl分子
B．1.00molNaCl中，所有Na+的最外层电子总数为8×6.02×1023
C．欲配置1.00L，1.00mol．L﹣1的Na', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '湖南'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '化学', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '湖南_化学_2011_1', title: '一、选择题', subject: '化学', year: '2011', province: '湖南'})
WITH q MATCH (p:Paper {name: '2011年高考化学试卷（新课标）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_化学_2011_2', title: '1．下列叙述正确的是（ ）', subject: '化学', year: '2011', province: '湖南'})
WITH q MATCH (p:Paper {name: '2011年高考化学试卷（新课标）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2021年高考化学试卷（湖南）（解析卷）.pdf', province: '湖南', subject: '化学', year: '2021', type: '解析卷', volume: '解析卷', preview: '湖南省 2021 年普通高中学业水平选择性考试
化学
注意事项：
1.答卷前，考生务必将自己的姓名、准考证号填写在本试卷和答题卡上。
2.回答选择题时，选出每小题答案后，用铅笔把答题卡上对应题目的答案标号涂黑。如需改动，
用橡皮擦干净后，再选涂其他答案标号。回答非选择题时，将答案写在答题卡上。写在本', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '湖南'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '化学', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '湖南_化学_2021_1', title: '1.答卷前，考生务必将自己的姓名、准考证号填写在本试卷和答题卡上。', subject: '化学', year: '2021', province: '湖南'})
WITH q MATCH (p:Paper {name: '2021年高考化学试卷（湖南）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_化学_2021_2', title: '2.回答选择题时，选出每小题答案后，用铅笔把答题卡上对应题目的答案标号涂黑。如需改动，', subject: '化学', year: '2021', province: '湖南'})
WITH q MATCH (p:Paper {name: '2021年高考化学试卷（湖南）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_化学_2021_3', title: '用橡皮擦干净后，再选涂其他答案标号。回答非选择题时，将答案写在答题卡上。写在本试', subject: '化学', year: '2021', province: '湖南'})
WITH q MATCH (p:Paper {name: '2021年高考化学试卷（湖南）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_化学_2021_4', title: '3.考试结束后，将本试卷和答题卡一并交回。', subject: '化学', year: '2021', province: '湖南'})
WITH q MATCH (p:Paper {name: '2021年高考化学试卷（湖南）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_化学_2021_5', title: '一、选择题：本题共 10小题，每小题 3分，共 30 分。在每小题给出的四个选项中，只有一', subject: '化学', year: '2021', province: '湖南'})
WITH q MATCH (p:Paper {name: '2021年高考化学试卷（湖南）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2015年高考化学试卷（新课标Ⅰ）（空白卷）.pdf', province: '湖南', subject: '化学', year: '2015', type: '空白卷', volume: '空白卷', preview: '2015 年全国统一高考化学试卷（新课标Ⅰ）
一、选择题（共 7小题，每小题 6分，满分 42分）
1．（6分）我国清代《本草纲目拾遗》中记叙无机药物335种，其中“强水”条目
下写道：“性最烈，能蚀五金…其水甚强，五金八石皆能穿第，惟玻璃可
盛。”这里的“强水”是指（ ）
A．氨水 B．硝酸 C．', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '湖南'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '化学', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '湖南_化学_2015_1', title: '一、选择题（共 7小题，每小题 6分，满分 42分）', subject: '化学', year: '2015', province: '湖南'})
WITH q MATCH (p:Paper {name: '2015年高考化学试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_化学_2015_2', title: '1．（6分）我国清代《本草纲目拾遗》中记叙无机药物335种，其中“强水”条目', subject: '化学', year: '2015', province: '湖南'})
WITH q MATCH (p:Paper {name: '2015年高考化学试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_化学_2015_3', title: '2．（6分）N 为阿伏伽德罗常数的值。下列说法正确的是（ ）', subject: '化学', year: '2015', province: '湖南'})
WITH q MATCH (p:Paper {name: '2015年高考化学试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_化学_2015_4', title: '3．（6分）乌洛托品在合成、医药、染料等工业中有广泛用途，其结构式如图所', subject: '化学', year: '2015', province: '湖南'})
WITH q MATCH (p:Paper {name: '2015年高考化学试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_化学_2015_5', title: '4．（6 分）下列实验中，对应的现象以及结论都正确且两者具有因果关系的是', subject: '化学', year: '2015', province: '湖南'})
WITH q MATCH (p:Paper {name: '2015年高考化学试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2018年高考化学试卷（新课标Ⅰ）（空白卷）.pdf', province: '湖南', subject: '化学', year: '2018', type: '空白卷', volume: '空白卷', preview: '2018 年全国统一高考化学试卷（新课标Ⅰ）
一、选择题（共 7小题，每小题 6分，满分 42分）
1．（6分）磷酸亚铁锂（LiFePO ）电池是新能源汽车的动力电池之一，采用湿法
4
冶金工艺回收废旧磷酸亚铁锂电池正极片中的金属，其流程如下：
下列叙述错误的是（ ）
A．合理处理废旧电池有利于保护', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '湖南'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '化学', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '湖南_化学_2018_1', title: '一、选择题（共 7小题，每小题 6分，满分 42分）', subject: '化学', year: '2018', province: '湖南'})
WITH q MATCH (p:Paper {name: '2018年高考化学试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_化学_2018_2', title: '1．（6分）磷酸亚铁锂（LiFePO ）电池是新能源汽车的动力电池之一，采用湿法', subject: '化学', year: '2018', province: '湖南'})
WITH q MATCH (p:Paper {name: '2018年高考化学试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_化学_2018_3', title: '2．（6分）下列说法错误的是（ ）', subject: '化学', year: '2018', province: '湖南'})
WITH q MATCH (p:Paper {name: '2018年高考化学试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_化学_2018_4', title: '3．（6 分）在生成和纯化乙酸乙酯的实验过程中，下列操作未涉及的是（ ）', subject: '化学', year: '2018', province: '湖南'})
WITH q MATCH (p:Paper {name: '2018年高考化学试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_化学_2018_5', title: '4．（6分）N 是阿伏加德罗常数的值，下列说法正确的是（ ）', subject: '化学', year: '2018', province: '湖南'})
WITH q MATCH (p:Paper {name: '2018年高考化学试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2023年高考化学试卷（湖南）（空白卷）.pdf', province: '湖南', subject: '化学', year: '2023', type: '空白卷', volume: '空白卷', preview: '2023 年湖南卷化学高考真题
一、选择题：本题共 14小题，每小题 3分，共 42分。在每小题给出的四个选项中，只有一
项是符合题目要求的。
1. 中华文化源远流长，化学与文化传承密不可分。下列说法错误的是
A. 青铜器“四羊方尊”的主要材质为合金
B. 长沙走马楼出土的竹木简牍主要成分是纤维素
', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '湖南'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '化学', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '湖南_化学_2023_1', title: '一、选择题：本题共 14小题，每小题 3分，共 42分。在每小题给出的四个选项中，只有一', subject: '化学', year: '2023', province: '湖南'})
WITH q MATCH (p:Paper {name: '2023年高考化学试卷（湖南）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_化学_2023_2', title: '1. 中华文化源远流长，化学与文化传承密不可分。下列说法错误的是', subject: '化学', year: '2023', province: '湖南'})
WITH q MATCH (p:Paper {name: '2023年高考化学试卷（湖南）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_化学_2023_3', title: '2. 下列化学用语表述错误的是', subject: '化学', year: '2023', province: '湖南'})
WITH q MATCH (p:Paper {name: '2023年高考化学试卷（湖南）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_化学_2023_4', title: '3. 下列玻璃仪器在相应实验中选用不合理的是', subject: '化学', year: '2023', province: '湖南'})
WITH q MATCH (p:Paper {name: '2023年高考化学试卷（湖南）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_化学_2023_5', title: '4. 下列有关物质结构和性质的说法错误的是', subject: '化学', year: '2023', province: '湖南'})
WITH q MATCH (p:Paper {name: '2023年高考化学试卷（湖南）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2024年高考英语试卷（新课标Ⅱ卷）（空白卷）.pdf', province: '湖南', subject: '英语', year: '2024', type: '空白卷', volume: '新课标Ⅱ卷', preview: '绝密★启用前
2024 年普通高等学校招生全国统一考试
英语
本试卷共 12页。考试结束后, 将本试卷和答题卡一并交回。
注意事项: 1. 答题前, 考生先将自己的姓名、准考证号码填写清楚, 将条形码准确粘贴在考生
信息条形码粘贴区。
2. 选择题必须使用 2B 铅笔填涂; 非选择题必须使用 0.5', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '湖南'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '英语', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '湖南_英语_2024_1', title: '2. 选择题必须使用 2B 铅笔填涂; 非选择题必须使用 0.5 毫米黑色字迹的签字笔书写, 字体', subject: '英语', year: '2024', province: '湖南'})
WITH q MATCH (p:Paper {name: '2024年高考英语试卷（新课标Ⅱ卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_英语_2024_2', title: '3. 请按照题号顺序在答题卡各题目的答题区域内作答, 超出答题区域书写的答案无效; 在草', subject: '英语', year: '2024', province: '湖南'})
WITH q MATCH (p:Paper {name: '2024年高考英语试卷（新课标Ⅱ卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_英语_2024_3', title: '4. 作图可先使用铅笔画出, 确定后必须用黑色字迹的签字笔描黑。', subject: '英语', year: '2024', province: '湖南'})
WITH q MATCH (p:Paper {name: '2024年高考英语试卷（新课标Ⅱ卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_英语_2024_4', title: '5. 保持卡面清洁, 不要折叠, 不要弄破、弄皱, 不准使用涂改液、修正带、刮纸刀。', subject: '英语', year: '2024', province: '湖南'})
WITH q MATCH (p:Paper {name: '2024年高考英语试卷（新课标Ⅱ卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_英语_2024_5', title: '5. What is Alex doing?', subject: '英语', year: '2024', province: '湖南'})
WITH q MATCH (p:Paper {name: '2024年高考英语试卷（新课标Ⅱ卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2011年高考英语试卷（新课标）（解析卷）.pdf', province: '湖南', subject: '英语', year: '2011', type: '解析卷', volume: '解析卷', preview: '2011年高考英语试卷（新课标卷）
参考答案与试题解析
第一部分 听力（共两节，满分30分）
做题时，先将答案标在试卷上，录音结束后，你将有两分钟的时间将试卷
上的答案转涂到答题卡上。
第一节 （共5小题，每小题1.5分，满分7.5分）
听下面5段对话。每段对话后有一个小题，从题中所给的A、B、C三', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '湖南'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '英语', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '湖南_英语_2011_1', title: '1. What does the man like about the play?', subject: '英语', year: '2011', province: '湖南'})
WITH q MATCH (p:Paper {name: '2011年高考英语试卷（新课标）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_英语_2011_2', title: '2. Which place are the speakers trying to find?', subject: '英语', year: '2011', province: '湖南'})
WITH q MATCH (p:Paper {name: '2011年高考英语试卷（新课标）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_英语_2011_3', title: '3. At what time will the two speakers meet?', subject: '英语', year: '2011', province: '湖南'})
WITH q MATCH (p:Paper {name: '2011年高考英语试卷（新课标）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_英语_2011_4', title: '6. Where is Ben?', subject: '英语', year: '2011', province: '湖南'})
WITH q MATCH (p:Paper {name: '2011年高考英语试卷（新课标）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_英语_2011_5', title: '7. What will the children in the afternoon?', subject: '英语', year: '2011', province: '湖南'})
WITH q MATCH (p:Paper {name: '2011年高考英语试卷（新课标）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2016年高考英语试卷（新课标Ⅲ卷）（解析卷）.pdf', province: '湖南', subject: '英语', year: '2016', type: '解析卷', volume: '新课标Ⅲ卷', preview: '2016年高考英语试卷（新课标Ⅲ）
第一部分 听力（共两节，满分30分）
做题时，先将答案标在试卷上，录音结束后，你将有两分钟的时间将试卷
上的答案转涂到答题卡上。
第一节 （共5小题，每小题1.5分，满分7.5分）
听下面5段对话。每段对话后有一个小题，从题中所给的A、B、C三个选项
中选出最佳答', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '湖南'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '英语', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '湖南_英语_2016_1', title: '1. What will Lucy do at 11:30 tomorrow?', subject: '英语', year: '2016', province: '湖南'})
WITH q MATCH (p:Paper {name: '2016年高考英语试卷（新课标Ⅲ卷）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_英语_2016_2', title: '2. What is the weather like now?', subject: '英语', year: '2016', province: '湖南'})
WITH q MATCH (p:Paper {name: '2016年高考英语试卷（新课标Ⅲ卷）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_英语_2016_3', title: '3. Why does the man talk to Dr. Simpson?', subject: '英语', year: '2016', province: '湖南'})
WITH q MATCH (p:Paper {name: '2016年高考英语试卷（新课标Ⅲ卷）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_英语_2016_4', title: '6. What time is it now?', subject: '英语', year: '2016', province: '湖南'})
WITH q MATCH (p:Paper {name: '2016年高考英语试卷（新课标Ⅲ卷）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_英语_2016_5', title: '7. What will the man do?', subject: '英语', year: '2016', province: '湖南'})
WITH q MATCH (p:Paper {name: '2016年高考英语试卷（新课标Ⅲ卷）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2020年高考英语试卷（新高考Ⅰ卷）（山东）（空白卷）.pdf', province: '湖南', subject: '英语', year: '2020', type: '空白卷', volume: '新高考Ⅰ卷', preview: '2020 年普通高等学校招生全国统一考试·新高考Ⅰ卷
英语
注意事项:
1.答卷前, 考生务必将自己的姓名、准考证号填写在答题卡上。
2.回答选择题时, 选出每小题答案后, 用铅笔把答题卡上对应题目的答案标号涂黑。如需改动,
用橡皮擦干净后, 再选涂其他答案标号。回答非选择题时, 将答案写在答题卡上', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '湖南'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '英语', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '湖南_英语_2020_1', title: '1.答卷前, 考生务必将自己的姓名、准考证号填写在答题卡上。', subject: '英语', year: '2020', province: '湖南'})
WITH q MATCH (p:Paper {name: '2020年高考英语试卷（新高考Ⅰ卷）（山东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_英语_2020_2', title: '2.回答选择题时, 选出每小题答案后, 用铅笔把答题卡上对应题目的答案标号涂黑。如需改动,', subject: '英语', year: '2020', province: '湖南'})
WITH q MATCH (p:Paper {name: '2020年高考英语试卷（新高考Ⅰ卷）（山东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_英语_2020_3', title: '用橡皮擦干净后, 再选涂其他答案标号。回答非选择题时, 将答案写在答题卡上, 写在本试卷', subject: '英语', year: '2020', province: '湖南'})
WITH q MATCH (p:Paper {name: '2020年高考英语试卷（新高考Ⅰ卷）（山东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_英语_2020_4', title: '3.考试结束后, 将本试卷和答题卡一并交回。', subject: '英语', year: '2020', province: '湖南'})
WITH q MATCH (p:Paper {name: '2020年高考英语试卷（新高考Ⅰ卷）（山东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_英语_2020_5', title: '2. What will each of the honorable mention winners get?', subject: '英语', year: '2020', province: '湖南'})
WITH q MATCH (p:Paper {name: '2020年高考英语试卷（新高考Ⅰ卷）（山东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2013年高考英语试卷（新课标Ⅰ卷）（空白卷）.pdf', province: '湖南', subject: '英语', year: '2013', type: '空白卷', volume: '新课标Ⅰ卷', preview: '2013年高考英语试卷（新课标I）
第一部分 听力（共两节，满分30分）
做题时，先将答案标在试卷上，录音结束后，你将有两分钟的时间将试卷
上的答案转涂到答题卡上。
第一节 （共5小题，每小题1.5分，满分7.5分）
听下面5段对话。每段对话后有一个小题，从题中所给的A、B、C三个选项
中选出最佳答', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '湖南'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '英语', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '湖南_英语_2013_1', title: '1. What does the man want to do?', subject: '英语', year: '2013', province: '湖南'})
WITH q MATCH (p:Paper {name: '2013年高考英语试卷（新课标Ⅰ卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_英语_2013_2', title: '2. What are the speakers talking about?', subject: '英语', year: '2013', province: '湖南'})
WITH q MATCH (p:Paper {name: '2013年高考英语试卷（新课标Ⅰ卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_英语_2013_3', title: '3. Where is the man now?', subject: '英语', year: '2013', province: '湖南'})
WITH q MATCH (p:Paper {name: '2013年高考英语试卷（新课标Ⅰ卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_英语_2013_4', title: '6. What is Sara going to do?', subject: '英语', year: '2013', province: '湖南'})
WITH q MATCH (p:Paper {name: '2013年高考英语试卷（新课标Ⅰ卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_英语_2013_5', title: '7. What does the man think of Sara’s plan?', subject: '英语', year: '2013', province: '湖南'})
WITH q MATCH (p:Paper {name: '2013年高考英语试卷（新课标Ⅰ卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2017年高考英语试卷（新课标Ⅲ卷）（空白卷）.pdf', province: '湖南', subject: '英语', year: '2017', type: '空白卷', volume: '新课标Ⅲ卷', preview: '2017年高考英语试卷（新课标Ⅲ卷）
第一部分 听力（共两节，满分30分）
做题时，先将答案标在试卷上，录音结束后，你将有两分钟的时间将试卷
上的答案转涂到答题卡上。
第一节 （共5小题，每小题1.5分，满分7.5分）
听下面5段对话。每段对话后有一个小题，从题中所给的A、B、C三个选项
中选出最佳', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '湖南'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '英语', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '湖南_英语_2017_1', title: '1. What will the woman do this afternoon?', subject: '英语', year: '2017', province: '湖南'})
WITH q MATCH (p:Paper {name: '2017年高考英语试卷（新课标Ⅲ卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_英语_2017_2', title: '2. Why does the woman call the man?', subject: '英语', year: '2017', province: '湖南'})
WITH q MATCH (p:Paper {name: '2017年高考英语试卷（新课标Ⅲ卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_英语_2017_3', title: '3. How much more does David need fo', subject: '英语', year: '2017', province: '湖南'})
WITH q MATCH (p:Paper {name: '2017年高考英语试卷（新课标Ⅲ卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_英语_2017_4', title: '7. Where does the conversation probably take place?', subject: '英语', year: '2017', province: '湖南'})
WITH q MATCH (p:Paper {name: '2017年高考英语试卷（新课标Ⅲ卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_英语_2017_5', title: '8. What does Richard do?', subject: '英语', year: '2017', province: '湖南'})
WITH q MATCH (p:Paper {name: '2017年高考英语试卷（新课标Ⅲ卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2019年高考英语试卷（新课标Ⅰ卷）（空白卷）.pdf', province: '湖南', subject: '英语', year: '2019', type: '空白卷', volume: '新课标Ⅰ卷', preview: '2019年普通高等学校招生全国统一考试(新课标I)
英 语
注意事项:
1.答卷前，考生务必将自己的姓名、准考证号填写在答题卡上。
2.回答选择题时，选出每小题答案后，用铅笔把答题卡上对应题目的答案标号涂黑。如需改
动，用橡皮擦干净后，再选涂其他答案标号。回答非选择题时，将答案写在答题卡上，写在
本', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '湖南'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '英语', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '湖南_英语_2019_1', title: '1.答卷前，考生务必将自己的姓名、准考证号填写在答题卡上。', subject: '英语', year: '2019', province: '湖南'})
WITH q MATCH (p:Paper {name: '2019年高考英语试卷（新课标Ⅰ卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_英语_2019_2', title: '2.回答选择题时，选出每小题答案后，用铅笔把答题卡上对应题目的答案标号涂黑。如需改', subject: '英语', year: '2019', province: '湖南'})
WITH q MATCH (p:Paper {name: '2019年高考英语试卷（新课标Ⅰ卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_英语_2019_3', title: '动，用橡皮擦干净后，再选涂其他答案标号。回答非选择题时，将答案写在答题卡上，写在', subject: '英语', year: '2019', province: '湖南'})
WITH q MATCH (p:Paper {name: '2019年高考英语试卷（新课标Ⅰ卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_英语_2019_4', title: '3.考试结束后，将本试卷和答题卡一并交回。', subject: '英语', year: '2019', province: '湖南'})
WITH q MATCH (p:Paper {name: '2019年高考英语试卷（新课标Ⅰ卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_英语_2019_5', title: '1.Where does this conversation take place?', subject: '英语', year: '2019', province: '湖南'})
WITH q MATCH (p:Paper {name: '2019年高考英语试卷（新课标Ⅰ卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2021年高考英语试卷（全国乙卷）（新课标Ⅰ）（空白卷）.pdf', province: '湖南', subject: '英语', year: '2021', type: '空白卷', volume: '全国乙卷', preview: '2021 年普通高等学校招生全国统一考试（全国乙卷）
英 语
注意事项:
1．答卷前,考生务必将自己的姓名、准考证号填写在答题卡上。
2．回答选择题时，选出每小题答案后，用铅笔把答题卡上对应题目的答案标号
涂黑。如需改动，用橡皮擦干净后，再选涂其他答案标号。回答非选择题时，将
答案写在答题卡上,写在', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '湖南'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '英语', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '湖南_英语_2021_1', title: '1．答卷前,考生务必将自己的姓名、准考证号填写在答题卡上。', subject: '英语', year: '2021', province: '湖南'})
WITH q MATCH (p:Paper {name: '2021年高考英语试卷（全国乙卷）（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_英语_2021_2', title: '2．回答选择题时，选出每小题答案后，用铅笔把答题卡上对应题目的答案标号', subject: '英语', year: '2021', province: '湖南'})
WITH q MATCH (p:Paper {name: '2021年高考英语试卷（全国乙卷）（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_英语_2021_3', title: '涂黑。如需改动，用橡皮擦干净后，再选涂其他答案标号。回答非选择题时，将', subject: '英语', year: '2021', province: '湖南'})
WITH q MATCH (p:Paper {name: '2021年高考英语试卷（全国乙卷）（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_英语_2021_4', title: '3.考试结束后,将本试卷和答题卡一并交回。', subject: '英语', year: '2021', province: '湖南'})
WITH q MATCH (p:Paper {name: '2021年高考英语试卷（全国乙卷）（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_英语_2021_5', title: '1.What is the man doing?', subject: '英语', year: '2021', province: '湖南'})
WITH q MATCH (p:Paper {name: '2021年高考英语试卷（全国乙卷）（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2022年高考英语试卷（全国甲卷）（解析卷）.pdf', province: '湖南', subject: '英语', year: '2022', type: '解析卷', volume: '全国甲卷', preview: '2022 年普通高等学校招生全国统一考试
英语
注意事项：
1. 答卷前，考生务必将自己的姓名、准考证号填写在答题卡上。
2. 回答选择题时，选出每小题答案后，用铅笔把答题卡上对应题目的答案标号涂黑。如需改
动，用橡皮擦干净后，再选涂其他答案标号。回答非选择题时，将答案写在答题卡上，写在
本试卷上无', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '湖南'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '英语', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '湖南_英语_2022_1', title: '1. 答卷前，考生务必将自己的姓名、准考证号填写在答题卡上。', subject: '英语', year: '2022', province: '湖南'})
WITH q MATCH (p:Paper {name: '2022年高考英语试卷（全国甲卷）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_英语_2022_2', title: '2. 回答选择题时，选出每小题答案后，用铅笔把答题卡上对应题目的答案标号涂黑。如需改', subject: '英语', year: '2022', province: '湖南'})
WITH q MATCH (p:Paper {name: '2022年高考英语试卷（全国甲卷）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_英语_2022_3', title: '动，用橡皮擦干净后，再选涂其他答案标号。回答非选择题时，将答案写在答题卡上，写在', subject: '英语', year: '2022', province: '湖南'})
WITH q MATCH (p:Paper {name: '2022年高考英语试卷（全国甲卷）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_英语_2022_4', title: '3. 考试结束后，将本试卷和答题卡一并交回。', subject: '英语', year: '2022', province: '湖南'})
WITH q MATCH (p:Paper {name: '2022年高考英语试卷（全国甲卷）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_英语_2022_5', title: '1. What does the man want to do?', subject: '英语', year: '2022', province: '湖南'})
WITH q MATCH (p:Paper {name: '2022年高考英语试卷（全国甲卷）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2015年高考英语试卷（新课标Ⅰ卷）（解析卷）.pdf', province: '湖南', subject: '英语', year: '2015', type: '解析卷', volume: '新课标Ⅰ卷', preview: '2015年高考英语试卷（新课标Ⅰ）
参考答案与试题解析
第一部分 听力（共两节，满分30分）
做题时，先将答案标在试卷上，录音结束后，你将有两分钟的时间将试卷
上的答案转涂到答题卡上。
第一节 （共5小题，每小题1.5分，满分7.5分）
听下面5段对话。每段对话后有一个小题，从题中所给的A、B、C三', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '湖南'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '英语', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '湖南_英语_2015_1', title: '1. What time is it now?', subject: '英语', year: '2015', province: '湖南'})
WITH q MATCH (p:Paper {name: '2015年高考英语试卷（新课标Ⅰ卷）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_英语_2015_2', title: '2. What does the woman think of the weather?', subject: '英语', year: '2015', province: '湖南'})
WITH q MATCH (p:Paper {name: '2015年高考英语试卷（新课标Ⅰ卷）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_英语_2015_3', title: '3. What will the man do?', subject: '英语', year: '2015', province: '湖南'})
WITH q MATCH (p:Paper {name: '2015年高考英语试卷（新课标Ⅰ卷）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_英语_2015_4', title: '4. What', subject: '英语', year: '2015', province: '湖南'})
WITH q MATCH (p:Paper {name: '2015年高考英语试卷（新课标Ⅰ卷）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_英语_2015_5', title: '6. How long did Michael stay in China?', subject: '英语', year: '2015', province: '湖南'})
WITH q MATCH (p:Paper {name: '2015年高考英语试卷（新课标Ⅰ卷）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2023年高考英语试卷（全国乙卷）（空白卷）.pdf', province: '湖南', subject: '英语', year: '2023', type: '空白卷', volume: '全国乙卷', preview: '2023 年普通高等学校招生全国统一考试(全国乙卷)
英语学科
注意事项：
1.答卷前，考生务必将自己的姓名、准考证号填写在答题卡上，并将自己的姓名、准考
证号、座位号填写在本试卷上。
2.回答选择题时,选出每小题答案后,用 2B 铅笔把答题卡上对应题目的答案标号涂黑;如
需改动，用橡皮擦干净后，再', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '湖南'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '英语', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '湖南_英语_2023_1', title: '1.答卷前，考生务必将自己的姓名、准考证号填写在答题卡上，并将自己的姓名、准考', subject: '英语', year: '2023', province: '湖南'})
WITH q MATCH (p:Paper {name: '2023年高考英语试卷（全国乙卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_英语_2023_2', title: '2.回答选择题时,选出每小题答案后,用 2B 铅笔把答题卡上对应题目的答案标号涂黑;如', subject: '英语', year: '2023', province: '湖南'})
WITH q MATCH (p:Paper {name: '2023年高考英语试卷（全国乙卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_英语_2023_3', title: '3.作答非选择题时，将答案书写在答题卡上，书写在本试卷上无效。', subject: '英语', year: '2023', province: '湖南'})
WITH q MATCH (p:Paper {name: '2023年高考英语试卷（全国乙卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_英语_2023_4', title: '4．考试结束后，将本试卷和答题卡一并交回。', subject: '英语', year: '2023', province: '湖南'})
WITH q MATCH (p:Paper {name: '2023年高考英语试卷（全国乙卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_英语_2023_5', title: '1. 【此处可播放相关音频，请去附件查看】', subject: '英语', year: '2023', province: '湖南'})
WITH q MATCH (p:Paper {name: '2023年高考英语试卷（全国乙卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2008年高考英语试卷（全国Ⅰ卷）（空白卷）.pdf', province: '湖南', subject: '英语', year: '2008', type: '空白卷', volume: '全国Ⅰ卷', preview: '2008年高考英语试卷（全国卷I）
第一部分 听力（共两节，满分30分）
做题时，先将答案标在试卷上，录音结束后，你将有两分钟的时间将试卷
上的答案转涂到答题卡上。
第一节 （共5小题，每小题1.5分，满分7.5分）
听下面5段对话。每段对话后有一个小题，从题中所给的A、B、C三个选项
中选出最佳答', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '湖南'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '英语', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '湖南_英语_2008_1', title: '1. What is the weather like?', subject: '英语', year: '2008', province: '湖南'})
WITH q MATCH (p:Paper {name: '2008年高考英语试卷（全国Ⅰ卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_英语_2008_2', title: '2. Who will go to China next month?', subject: '英语', year: '2008', province: '湖南'})
WITH q MATCH (p:Paper {name: '2008年高考英语试卷（全国Ⅰ卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_英语_2008_3', title: '3. What are the speakers talking about?', subject: '英语', year: '2008', province: '湖南'})
WITH q MATCH (p:Paper {name: '2008年高考英语试卷（全国Ⅰ卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_英语_2008_4', title: '4. Where wi', subject: '英语', year: '2008', province: '湖南'})
WITH q MATCH (p:Paper {name: '2008年高考英语试卷（全国Ⅰ卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_英语_2008_5', title: '7. How old was the baby when the woman left New York?', subject: '英语', year: '2008', province: '湖南'})
WITH q MATCH (p:Paper {name: '2008年高考英语试卷（全国Ⅰ卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2014年高考英语试卷（新课标Ⅰ卷）（空白卷）.pdf', province: '湖南', subject: '英语', year: '2014', type: '空白卷', volume: '新课标Ⅰ卷', preview: '2014年高考英语试卷（新课标Ⅰ）
第一部分 听力（共两节，满分30分）
做题时，先将答案标在试卷上，录音结束后，你将有两分钟的时间将试卷
上的答案转涂到答题卡上。
第一节 （共5小题，每小题1.5分，满分7.5分）
听下面5段对话。每段对话后有一个小题，从题中所给的A、B、C三个选项
中选出最佳答', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '湖南'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '英语', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '湖南_英语_2014_1', title: '1. What does the woman want to do?', subject: '英语', year: '2014', province: '湖南'})
WITH q MATCH (p:Paper {name: '2014年高考英语试卷（新课标Ⅰ卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_英语_2014_2', title: '2. What will the man do for the woman?', subject: '英语', year: '2014', province: '湖南'})
WITH q MATCH (p:Paper {name: '2014年高考英语试卷（新课标Ⅰ卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_英语_2014_3', title: '3. Who might Mr. Peterson be?', subject: '英语', year: '2014', province: '湖南'})
WITH q MATCH (p:Paper {name: '2014年高考英语试卷（新课标Ⅰ卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_英语_2014_4', title: '7. What will the woman probably do next?', subject: '英语', year: '2014', province: '湖南'})
WITH q MATCH (p:Paper {name: '2014年高考英语试卷（新课标Ⅰ卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_英语_2014_5', title: '8. When will the man be home from work?', subject: '英语', year: '2014', province: '湖南'})
WITH q MATCH (p:Paper {name: '2014年高考英语试卷（新课标Ⅰ卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2012年高考英语试卷（新课标）（空白卷）.pdf', province: '湖南', subject: '英语', year: '2012', type: '空白卷', volume: '空白卷', preview: '2012年高考英语试卷（新课标版）
第一部分 听力（共两节，满分30分）
做题时，先将答案标在试卷上，录音结束后，你将有两分钟的时间将试卷
上的答案转涂到答题卡上。
第一节 （共5小题，每小题1.5分，满分7.5分）
听下面5段对话。每段对话后有一个小题，从题中所给的A、B、C三个选项
中选出最佳答', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '湖南'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '英语', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '湖南_英语_2012_1', title: '1. Where does this conversation probably take place?', subject: '英语', year: '2012', province: '湖南'})
WITH q MATCH (p:Paper {name: '2012年高考英语试卷（新课标）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_英语_2012_2', title: '2. At what time will the film begin?', subject: '英语', year: '2012', province: '湖南'})
WITH q MATCH (p:Paper {name: '2012年高考英语试卷（新课标）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_英语_2012_3', title: '3. What are the two speakers mainly talking about?', subject: '英语', year: '2012', province: '湖南'})
WITH q MATCH (p:Paper {name: '2012年高考英语试卷（新课标）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_英语_2012_4', title: '6. Whose CD is broken?', subject: '英语', year: '2012', province: '湖南'})
WITH q MATCH (p:Paper {name: '2012年高考英语试卷（新课标）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_英语_2012_5', title: '7. What does the boy promise to do for the girl?', subject: '英语', year: '2012', province: '湖南'})
WITH q MATCH (p:Paper {name: '2012年高考英语试卷（新课标）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2018年高考英语试卷（新课标Ⅰ卷）（空白卷）.pdf', province: '湖南', subject: '英语', year: '2018', type: '空白卷', volume: '新课标Ⅰ卷', preview: '2018年高考英语试卷（新课标Ⅰ卷）
第一部分 听力（共两节，满分30分）
做题时，先将答案标在试卷上，录音结束后，你将有两分钟的时间将试卷
上的答案转涂到答题卡上。
第一节 （共5小题，每小题1.5分，满分7.5分）
听下面5段对话。每段对话后有一个小题，从题中所给的A、B、C三个选项
中选出最佳', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '湖南'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '英语', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '湖南_英语_2018_1', title: '1. What will James do tomorrow?', subject: '英语', year: '2018', province: '湖南'})
WITH q MATCH (p:Paper {name: '2018年高考英语试卷（新课标Ⅰ卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_英语_2018_2', title: '2. What can we say about the woman?', subject: '英语', year: '2018', province: '湖南'})
WITH q MATCH (p:Paper {name: '2018年高考英语试卷（新课标Ⅰ卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_英语_2018_3', title: '3. When does the train leave?', subject: '英语', year: '2018', province: '湖南'})
WITH q MATCH (p:Paper {name: '2018年高考英语试卷（新课标Ⅰ卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_英语_2018_4', title: '7. What is the woman interested in studying now?', subject: '英语', year: '2018', province: '湖南'})
WITH q MATCH (p:Paper {name: '2018年高考英语试卷（新课标Ⅰ卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_英语_2018_5', title: '8. What is the man?', subject: '英语', year: '2018', province: '湖南'})
WITH q MATCH (p:Paper {name: '2018年高考英语试卷（新课标Ⅰ卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2009年高考英语试卷（全国Ⅱ卷）（空白卷）.pdf', province: '湖南', subject: '英语', year: '2009', type: '空白卷', volume: '全国Ⅱ卷', preview: '2009年高考英语试卷（全国卷II）
第一部分 听力（共两节，满分30分）
做题时，先将答案标在试卷上，录音结束后，你将有两分钟的时间将试卷
上的答案转涂到答题卡上。
第一节 （共5小题，每小题1.5分，满分7.5分）
听下面5段对话。每段对话后有一个小题，从题中所给的A、B、C三个选项
中选出最佳', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '湖南'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '英语', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '湖南_英语_2009_1', title: '1. What do the speakers need to buy?', subject: '英语', year: '2009', province: '湖南'})
WITH q MATCH (p:Paper {name: '2009年高考英语试卷（全国Ⅱ卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_英语_2009_2', title: '2. Where are the speakers?', subject: '英语', year: '2009', province: '湖南'})
WITH q MATCH (p:Paper {name: '2009年高考英语试卷（全国Ⅱ卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_英语_2009_3', title: '3. What does the woman mean?', subject: '英语', year: '2009', province: '湖南'})
WITH q MATCH (p:Paper {name: '2009年高考英语试卷（全国Ⅱ卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_英语_2009_4', title: '6. What is the man doing?', subject: '英语', year: '2009', province: '湖南'})
WITH q MATCH (p:Paper {name: '2009年高考英语试卷（全国Ⅱ卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_英语_2009_5', title: '7. What is the woman’s seat number?', subject: '英语', year: '2009', province: '湖南'})
WITH q MATCH (p:Paper {name: '2009年高考英语试卷（全国Ⅱ卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2025年高考新课标1英语真题及答案（版本1）.pdf', province: '湖南', subject: '英语', year: '2025', type: '未知', volume: '', preview: '', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '湖南'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '英语', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)

MERGE (p:Paper {name: '2010年高考英语试卷（新课标Ⅰ卷）（空白卷）.pdf', province: '湖南', subject: '英语', year: '2010', type: '空白卷', volume: '新课标Ⅰ卷', preview: '2010年高考英语试卷（新课标Ⅰ卷）
第一部分 听力（共两节，满分30分）
做题时，先将答案标在试卷上，录音结束后，你将有两分钟的时间将试卷
上的答案转涂到答题卡上。
第一节 （共5小题，每小题1.5分，满分7.5分）
听下面5段对话。每段对话后有一个小题，从题中所给的A、B、C三个选项
中选出最佳', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '湖南'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '英语', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '湖南_英语_2010_1', title: '1. What will Dorothy do on the weekend?', subject: '英语', year: '2010', province: '湖南'})
WITH q MATCH (p:Paper {name: '2010年高考英语试卷（新课标Ⅰ卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_英语_2010_2', title: '2. What was the normal price of the T-shirt?', subject: '英语', year: '2010', province: '湖南'})
WITH q MATCH (p:Paper {name: '2010年高考英语试卷（新课标Ⅰ卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_英语_2010_3', title: '3. What has the woman decided to do on Sunday afternoon?', subject: '英语', year: '2010', province: '湖南'})
WITH q MATCH (p:Paper {name: '2010年高考英语试卷（新课标Ⅰ卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_英语_2010_4', title: '7. What is good about the flat?', subject: '英语', year: '2010', province: '湖南'})
WITH q MATCH (p:Paper {name: '2010年高考英语试卷（新课标Ⅰ卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_英语_2010_5', title: '8. Where has Barbara been?', subject: '英语', year: '2010', province: '湖南'})
WITH q MATCH (p:Paper {name: '2010年高考英语试卷（新课标Ⅰ卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2010年高考历史试卷（全国卷Ⅰ）（空白卷）.pdf', province: '湖南', subject: '历史', year: '2010', type: '空白卷', volume: '全国卷Ⅰ', preview: '2010年全国高考历史试卷（全国卷Ⅰ）
一、在每题给出的四个选项中，只有一项是符合题目要求的．
1．（4分）中国古代常用五行相生相克解释朝代更替，称作“五德”。每个朝代
在“五德”中都有相应的次序。曹魏被定为“土德”，通过“禅让”代魏的西晋应
为（ ）
A．金德 B．木德 C．水德 D．火德
2．（', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '湖南'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '历史', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '湖南_历史_2010_1', title: '一、在每题给出的四个选项中，只有一项是符合题目要求的．', subject: '历史', year: '2010', province: '湖南'})
WITH q MATCH (p:Paper {name: '2010年高考历史试卷（全国卷Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_历史_2010_2', title: '1．（4分）中国古代常用五行相生相克解释朝代更替，称作“五德”。每个朝代', subject: '历史', year: '2010', province: '湖南'})
WITH q MATCH (p:Paper {name: '2010年高考历史试卷（全国卷Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_历史_2010_3', title: '2．（4分）欧阳修上疏说：“京城近有雕印文集二十卷，名为《宋文》者，多是', subject: '历史', year: '2010', province: '湖南'})
WITH q MATCH (p:Paper {name: '2010年高考历史试卷（全国卷Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_历史_2010_4', title: '3．（4分）表1 1885～1892年田赋、厘金、关税占清政府年收入百分比', subject: '历史', year: '2010', province: '湖南'})
WITH q MATCH (p:Paper {name: '2010年高考历史试卷（全国卷Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_历史_2010_5', title: '5．（4分）国民党《中央日报》就国共关系某一事件的影响评论道：“这一结果', subject: '历史', year: '2010', province: '湖南'})
WITH q MATCH (p:Paper {name: '2010年高考历史试卷（全国卷Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2009年高考历史试卷（全国卷Ⅰ）（空白卷）.pdf', province: '湖南', subject: '历史', year: '2009', type: '空白卷', volume: '全国卷Ⅰ', preview: '2009年全国统一高考历史试卷（全国卷Ⅰ）
一、选择题（共12小题，每小题4分，满分48分）
1．（4分）古人在分析姓氏起源时说：“氏于国，则齐鲁秦吴……氏于字，则盂
孙叔孙；氏于居，则东门北郭。”由此推论，司马、司徒等姓氏应源自（
）
A．官名 B．爵位 C．谥号 D．行业
2．（4分）“四面楚歌', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '湖南'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '历史', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '湖南_历史_2009_1', title: '一、选择题（共12小题，每小题4分，满分48分）', subject: '历史', year: '2009', province: '湖南'})
WITH q MATCH (p:Paper {name: '2009年高考历史试卷（全国卷Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_历史_2009_2', title: '1．（4分）古人在分析姓氏起源时说：“氏于国，则齐鲁秦吴……氏于字，则盂', subject: '历史', year: '2009', province: '湖南'})
WITH q MATCH (p:Paper {name: '2009年高考历史试卷（全国卷Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_历史_2009_3', title: '2．（4分）“四面楚歌”典出楚汉战争。西汉初期，“楚歌”在社会上风行一时。', subject: '历史', year: '2009', province: '湖南'})
WITH q MATCH (p:Paper {name: '2009年高考历史试卷（全国卷Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_历史_2009_4', title: '3．（4分）南朝秀美灵动，北朝刚健雄浑，南北文化共同孕育了唐代文化的新', subject: '历史', year: '2009', province: '湖南'})
WITH q MATCH (p:Paper {name: '2009年高考历史试卷（全国卷Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_历史_2009_5', title: '4．（4分）如表汉至宋南北方户数变化表（单位：万户）', subject: '历史', year: '2009', province: '湖南'})
WITH q MATCH (p:Paper {name: '2009年高考历史试卷（全国卷Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2011年高考历史试卷（新课标）（空白卷）.pdf', province: '湖南', subject: '历史', year: '2011', type: '空白卷', volume: '空白卷', preview: '2011年全国统一高考历史试卷（新课标）
一、选择题（共12小题，每小题2分，满分24分）
1．（2分）董仲舒认为孔子撰《春秋》的目的是尊天子、抑诸侯、崇周制而“大
一统”，以此为汉武帝加强中央集权服务，从而将周代历史与汉代政治联系
起来。西周时代对于秦汉统一的重要历史影响在于（ ）
A．构建了中央', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '湖南'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '历史', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '湖南_历史_2011_1', title: '一、选择题（共12小题，每小题2分，满分24分）', subject: '历史', year: '2011', province: '湖南'})
WITH q MATCH (p:Paper {name: '2011年高考历史试卷（新课标）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_历史_2011_2', title: '1．（2分）董仲舒认为孔子撰《春秋》的目的是尊天子、抑诸侯、崇周制而“大', subject: '历史', year: '2011', province: '湖南'})
WITH q MATCH (p:Paper {name: '2011年高考历史试卷（新课标）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_历史_2011_3', title: '2．（2分）如图是依据《隋书•食货志》等制作的南北朝时期各地区货币使用情', subject: '历史', year: '2011', province: '湖南'})
WITH q MATCH (p:Paper {name: '2011年高考历史试卷（新课标）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_历史_2011_4', title: '3．（2分）黄宗羲在《明夷待访录》中说：“使朝廷之上，闾阎之细，渐摩濡染', subject: '历史', year: '2011', province: '湖南'})
WITH q MATCH (p:Paper {name: '2011年高考历史试卷（新课标）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_历史_2011_5', title: '4．（2分）苏格拉底在受审时申辩说：“打一个可笑的比', subject: '历史', year: '2011', province: '湖南'})
WITH q MATCH (p:Paper {name: '2011年高考历史试卷（新课标）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2014年高考历史试卷（新课标Ⅰ）（解析卷）.pdf', province: '湖南', subject: '历史', year: '2014', type: '解析卷', volume: '解析卷', preview: '2014 年全国统一高考历史试卷（新课标Ⅰ）
参考答案与试题解析
一、选择题（共 12小题，每小题 4分，满分 48分）
1．（4 分）中国古代，“天”被尊为最高神。秦汉以后，以“天子”自居的皇帝举行
祭天大典，表明自己“承天”而“子民”，官员、百姓则祭拜自己的祖先。这反映
了秦汉以后（ ）
A．君', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '湖南'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '历史', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '湖南_历史_2014_1', title: '一、选择题（共 12小题，每小题 4分，满分 48分）', subject: '历史', year: '2014', province: '湖南'})
WITH q MATCH (p:Paper {name: '2014年高考历史试卷（新课标Ⅰ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_历史_2014_2', title: '1．（4 分）中国古代，“天”被尊为最高神。秦汉以后，以“天子”自居的皇帝举行', subject: '历史', year: '2014', province: '湖南'})
WITH q MATCH (p:Paper {name: '2014年高考历史试卷（新课标Ⅰ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2018年高考历史试卷（新课标Ⅰ）（解析卷）.pdf', province: '湖南', subject: '历史', year: '2018', type: '解析卷', volume: '解析卷', preview: '2018 年全国统一高考历史试卷（新课标Ⅰ）
参考答案与试题解析
一、选择题：本题共 12 小题，每小题 4 分，共 48 分。在每小题给出的四个选
项中，只有一项是符合题目要求的。
1．（4分）《墨子》中有关于“圆”“直线”“正方形”“倍”的定义，对杠杆原理、声音
传播、小孔成像等也有论述，还有机', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '湖南'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '历史', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '湖南_历史_2018_1', title: '一、选择题：本题共 12 小题，每小题 4 分，共 48 分。在每小题给出的四个选', subject: '历史', year: '2018', province: '湖南'})
WITH q MATCH (p:Paper {name: '2018年高考历史试卷（新课标Ⅰ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_历史_2018_2', title: '1．（4分）《墨子》中有关于“圆”“直线”“正方形”“倍”的定义，对杠杆原理、声音', subject: '历史', year: '2018', province: '湖南'})
WITH q MATCH (p:Paper {name: '2018年高考历史试卷（新课标Ⅰ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2020年高考历史试卷（新课标Ⅰ）（解析卷）.pdf', province: '湖南', subject: '历史', year: '2020', type: '解析卷', volume: '解析卷', preview: '2020 年全国统一高考历史试卷（新课标Ⅰ）
参考答案与试题解析
一、选择题：本题共12小题，每小题4分，共48分。在每小题给出的四个选项中，只有
一项是符合题目要求的。
1．（4分）据《史记》记载，春秋时期，楚国国君熊通要求提升爵位等级，遭到周桓王拒绝。
熊通怒称现在周边地区都归附了楚国，“而王不', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '湖南'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '历史', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '湖南_历史_2020_1', title: '一、选择题：本题共12小题，每小题4分，共48分。在每小题给出的四个选项中，只有', subject: '历史', year: '2020', province: '湖南'})
WITH q MATCH (p:Paper {name: '2020年高考历史试卷（新课标Ⅰ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_历史_2020_2', title: '1．（4分）据《史记》记载，春秋时期，楚国国君熊通要求提升爵位等级，遭到周桓王拒绝。', subject: '历史', year: '2020', province: '湖南'})
WITH q MATCH (p:Paper {name: '2020年高考历史试卷（新课标Ⅰ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2022年高考历史试卷（湖南）（空白卷）.pdf', province: '湖南', subject: '历史', year: '2022', type: '空白卷', volume: '空白卷', preview: '湖南省 2022 年历史高考真题
注意事项：
1．答卷前，考生务必将自己的姓名、准考证号填写在本试卷和答题卡上。
2．回答选择题时，选出每小题答案后，用铅笔把答题卡上对应题目的答案标号涂黑。如需
改动，用橡皮擦干净后，再选涂其他答案标号。回答非选择题时，将答案写在答题卡上。写
在本试卷上无效。
3．', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '湖南'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '历史', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '湖南_历史_2022_1', title: '1．答卷前，考生务必将自己的姓名、准考证号填写在本试卷和答题卡上。', subject: '历史', year: '2022', province: '湖南'})
WITH q MATCH (p:Paper {name: '2022年高考历史试卷（湖南）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_历史_2022_2', title: '2．回答选择题时，选出每小题答案后，用铅笔把答题卡上对应题目的答案标号涂黑。如需', subject: '历史', year: '2022', province: '湖南'})
WITH q MATCH (p:Paper {name: '2022年高考历史试卷（湖南）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_历史_2022_3', title: '改动，用橡皮擦干净后，再选涂其他答案标号。回答非选择题时，将答案写在答题卡上。写', subject: '历史', year: '2022', province: '湖南'})
WITH q MATCH (p:Paper {name: '2022年高考历史试卷（湖南）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_历史_2022_4', title: '3．考试结束后，将本试卷和答题卡一并交回。', subject: '历史', year: '2022', province: '湖南'})
WITH q MATCH (p:Paper {name: '2022年高考历史试卷（湖南）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_历史_2022_5', title: '一、选择题：本题共 16 小题，每小题 3 分，共 48 分，在每小题给出的四个选项中，只有一', subject: '历史', year: '2022', province: '湖南'})
WITH q MATCH (p:Paper {name: '2022年高考历史试卷（湖南）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2012年高考历史试卷（新课标）（解析卷）.pdf', province: '湖南', subject: '历史', year: '2012', type: '解析卷', volume: '解析卷', preview: '2012 年全国统一高考历史试卷（新课标）
参考答案与试题解析
一、选择题
1．（2 分）汉武帝设置十三州刺史以监察地方，并将豪强大族“田宅逾制”作为
重要的监察内容，各地财产达 300 万钱的豪族被迁到长安附近集中居住。这
表明（ ）
A．政权的政治与经济支柱是豪强大族
B．政治权力与经济势力出现', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '湖南'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '历史', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '湖南_历史_2012_1', title: '一、选择题', subject: '历史', year: '2012', province: '湖南'})
WITH q MATCH (p:Paper {name: '2012年高考历史试卷（新课标）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_历史_2012_2', title: '1．（2 分）汉武帝设置十三州刺史以监察地方，并将豪强大族“田宅逾制”作为', subject: '历史', year: '2012', province: '湖南'})
WITH q MATCH (p:Paper {name: '2012年高考历史试卷（新课标）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2017年高考历史试卷（新课标Ⅰ）（解析卷）.pdf', province: '湖南', subject: '历史', year: '2017', type: '解析卷', volume: '解析卷', preview: '2017 年全国统一高考历史试卷（新课标Ⅰ）
参考答案与试题解析
一、选择题：本题共 12小题，每小题 4分．在每小题给出第四个选项中，只有
一项是符合题目要求的．
1．（4分）周灭商之后，推行分封制，如封武王弟康叔于卫，都朝歌（今河南淇
县）；封周公长子伯禽于鲁，都奄（今山东曲阜）；封召公奭于燕，', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '湖南'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '历史', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '湖南_历史_2017_1', title: '一、选择题：本题共 12小题，每小题 4分．在每小题给出第四个选项中，只有', subject: '历史', year: '2017', province: '湖南'})
WITH q MATCH (p:Paper {name: '2017年高考历史试卷（新课标Ⅰ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_历史_2017_2', title: '1．（4分）周灭商之后，推行分封制，如封武王弟康叔于卫，都朝歌（今河南淇', subject: '历史', year: '2017', province: '湖南'})
WITH q MATCH (p:Paper {name: '2017年高考历史试卷（新课标Ⅰ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_历史_2017_3', title: '2．（4分）读表：', subject: '历史', year: '2017', province: '湖南'})
WITH q MATCH (p:Paper {name: '2017年高考历史试卷（新课标Ⅰ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2021年高考历史试卷（湖南）（空白卷）.pdf', province: '湖南', subject: '历史', year: '2021', type: '空白卷', volume: '空白卷', preview: '湖南省 2021 年普通高中学业水平选择性考试历史
一、选择题
1. 有学者对《诗经》风、雅、颂的时代与内容进行考察，其发现如表所示，据此可知，西周初年至春秋中
叶
多数诗篇的形成时代 整体上对“天”的态度
《周颂》 西周初年 颂天
《大雅》 西周中期至西周晚期 疑天
《小雅》 西周晚期至东周初年 ', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '湖南'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '历史', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '湖南_历史_2021_1', title: '一、选择题', subject: '历史', year: '2021', province: '湖南'})
WITH q MATCH (p:Paper {name: '2021年高考历史试卷（湖南）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_历史_2021_2', title: '1. 有学者对《诗经》风、雅、颂的时代与内容进行考察，其发现如表所示，据此可知，西周初年至春秋中', subject: '历史', year: '2021', province: '湖南'})
WITH q MATCH (p:Paper {name: '2021年高考历史试卷（湖南）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_历史_2021_3', title: '2. 汉初，丞相陈平、太尉周勃与宗室大臣平定“诸吕之乱”后，商议新帝人选，经再三讨论，认为代王刘', subject: '历史', year: '2021', province: '湖南'})
WITH q MATCH (p:Paper {name: '2021年高考历史试卷（湖南）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_历史_2021_4', title: '3. 西晋的占田制、南朝刘宋的占山护泽令均规定，官员可按品级高低占有数目不等的农田、山地，助长了', subject: '历史', year: '2021', province: '湖南'})
WITH q MATCH (p:Paper {name: '2021年高考历史试卷（湖南）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_历史_2021_5', title: '6. 如图再现了每年冬至节清宫例行的八旗官兵滑冰活动的场景。这一作品', subject: '历史', year: '2021', province: '湖南'})
WITH q MATCH (p:Paper {name: '2021年高考历史试卷（湖南）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2024年高考历史试卷（湖南）（空白卷）.pdf', province: '湖南', subject: '历史', year: '2024', type: '空白卷', volume: '空白卷', preview: '2024 年湖南省普通高中学业水平选择性考试
历史
一、选择题：本题共 16 小题，每小题 3 分，共 48 分。在每小题给出的四个选项中，只有一
项是符合题目要求的。
1. 西周时期，国人可以对军国大事发表意见，甚至能够影响国君废立，但不能改变宗主世袭制，更换国君
不过是更换宗主。这说明西周（ ）', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '湖南'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '历史', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '湖南_历史_2024_1', title: '一、选择题：本题共 16 小题，每小题 3 分，共 48 分。在每小题给出的四个选项中，只有一', subject: '历史', year: '2024', province: '湖南'})
WITH q MATCH (p:Paper {name: '2024年高考历史试卷（湖南）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_历史_2024_2', title: '1. 西周时期，国人可以对军国大事发表意见，甚至能够影响国君废立，但不能改变宗主世袭制，更换国君', subject: '历史', year: '2024', province: '湖南'})
WITH q MATCH (p:Paper {name: '2024年高考历史试卷（湖南）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_历史_2024_3', title: '2. 据史料记载，秦人“畏有司而顺”，楚人“好游侠”“易发怒”。秦末，六国旧地都出现了反秦斗争，其', subject: '历史', year: '2024', province: '湖南'})
WITH q MATCH (p:Paper {name: '2024年高考历史试卷（湖南）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_历史_2024_4', title: '3. 下表为史籍所载东汉至南朝时期官府掌握的湖南地区户口数和人口数。其变化的主要原因是（ ）', subject: '历史', year: '2024', province: '湖南'})
WITH q MATCH (p:Paper {name: '2024年高考历史试卷（湖南）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_历史_2024_5', title: '7. 清朝新科进士任职意愿向来“以吏、户二部为优选”，而癸卯（1903）、甲辰（1904）两科进士的选择已', subject: '历史', year: '2024', province: '湖南'})
WITH q MATCH (p:Paper {name: '2024年高考历史试卷（湖南）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2013年高考历史试卷（新课标Ⅰ）（空白卷）.pdf', province: '湖南', subject: '历史', year: '2013', type: '空白卷', volume: '空白卷', preview: '2013 年全国统一高考历史试卷（新课标Ⅰ）
一、选择题（4×12分）
1．（4分）在周代分封制下，墓葬有严格的等级规定。考古显示，战国时期，秦
国地区君王墓葬规模宏大，其余墓葬无明显等级差别；在经济发达的东方六
国地区，君王、卿大夫、士的墓葬等级差别明显。这表明（ ）
A．经济发展是分封制度得以维', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '湖南'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '历史', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '湖南_历史_2013_1', title: '一、选择题（4×12分）', subject: '历史', year: '2013', province: '湖南'})
WITH q MATCH (p:Paper {name: '2013年高考历史试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_历史_2013_2', title: '1．（4分）在周代分封制下，墓葬有严格的等级规定。考古显示，战国时期，秦', subject: '历史', year: '2013', province: '湖南'})
WITH q MATCH (p:Paper {name: '2013年高考历史试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_历史_2013_3', title: '2．（4分）自汉至唐，儒学被奉为“周（公）孔之道”，宋代以后儒学多被称作“孔', subject: '历史', year: '2013', province: '湖南'})
WITH q MATCH (p:Paper {name: '2013年高考历史试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_历史_2013_4', title: '3．（4分）有学者说，在古代雅典，“政治领袖和演说家根本就是同义语”。这一', subject: '历史', year: '2013', province: '湖南'})
WITH q MATCH (p:Paper {name: '2013年高考历史试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_历史_2013_5', title: '4．（4 分）1688 年，英国议会迎立荷兰执政威廉为国王，并拥立他的妻子玛丽', subject: '历史', year: '2013', province: '湖南'})
WITH q MATCH (p:Paper {name: '2013年高考历史试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2019年高考历史试卷（新课标Ⅰ）（解析卷）.pdf', province: '湖南', subject: '历史', year: '2019', type: '解析卷', volume: '解析卷', preview: '2019 年全国统一高考历史试卷（新课标Ⅰ）
参考答案与试题解析
一、选择题：本题共12小题，每小题4分，共48分。在每小题给出的四个选项中，只有
一项是符合题目要求的。
1．（4分）据学者考订，商朝产生了17代30位王，多为兄终弟及；而西周产生了11代12
位王。这反映出（ ）
A．禅让制度的长期', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '湖南'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '历史', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '湖南_历史_2019_1', title: '一、选择题：本题共12小题，每小题4分，共48分。在每小题给出的四个选项中，只有', subject: '历史', year: '2019', province: '湖南'})
WITH q MATCH (p:Paper {name: '2019年高考历史试卷（新课标Ⅰ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_历史_2019_2', title: '1．（4分）据学者考订，商朝产生了17代30位王，多为兄终弟及；而西周产生了11代12', subject: '历史', year: '2019', province: '湖南'})
WITH q MATCH (p:Paper {name: '2019年高考历史试卷（新课标Ⅰ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_历史_2019_3', title: '2．（4分）汉武帝时，朝廷制作出许多一尺见方的白鹿皮，称为“皮币”，', subject: '历史', year: '2019', province: '湖南'})
WITH q MATCH (p:Paper {name: '2019年高考历史试卷（新课标Ⅰ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_历史_2019_4', title: '3．（4分）唐代之前，荆楚民间存在一种祈求丰收的“牵钩之戏”，至唐代称作“拔河”，广', subject: '历史', year: '2019', province: '湖南'})
WITH q MATCH (p:Paper {name: '2019年高考历史试卷（新课标Ⅰ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2015年高考历史试卷（新课标Ⅰ）（空白卷）.pdf', province: '湖南', subject: '历史', year: '2015', type: '空白卷', volume: '空白卷', preview: '2015 年全国统一高考历史试卷（新课标Ⅰ）
一、选择题
1．（3分）《吕氏春秋•上农》在描述农耕之利时不无夸张地说：一个农夫耕种肥
沃的土地可以养活九口人，耕种一般的土地也能养活五口人。战国时期农业
收益的增加（ ）
A．导致畜力与铁制农具的使用 B．抑制了手工业和商业的发展
C．促进了个体小农经', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '湖南'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '历史', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '湖南_历史_2015_1', title: '一、选择题', subject: '历史', year: '2015', province: '湖南'})
WITH q MATCH (p:Paper {name: '2015年高考历史试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_历史_2015_2', title: '1．（3分）《吕氏春秋•上农》在描述农耕之利时不无夸张地说：一个农夫耕种肥', subject: '历史', year: '2015', province: '湖南'})
WITH q MATCH (p:Paper {name: '2015年高考历史试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_历史_2015_3', title: '2．（3分）两汉时期，皇帝的舅舅、外祖父按例封侯；若皇帝幼小，执政大臣也', subject: '历史', year: '2015', province: '湖南'})
WITH q MATCH (p:Paper {name: '2015年高考历史试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_历史_2015_4', title: '3．（3分）宋代东南沿海地区出现了一些民间崇拜，如后来被视为海上保护神的', subject: '历史', year: '2015', province: '湖南'})
WITH q MATCH (p:Paper {name: '2015年高考历史试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_历史_2015_5', title: '4．（3分）下表呈现的变化反映了（ ）', subject: '历史', year: '2015', province: '湖南'})
WITH q MATCH (p:Paper {name: '2015年高考历史试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2016年高考历史试卷（新课标Ⅰ）（空白卷）.pdf', province: '湖南', subject: '历史', year: '2016', type: '空白卷', volume: '空白卷', preview: '2016 年全国统一高考历史试卷（新课标Ⅰ）
一、选择题（共 12小题，每小题 4分，满分 48分）
1．（4分）孔子是儒家学派的创始人，汉代崇尚儒学，尊《尚书》等五部书为经
典，记录孔子言论的《论语》却不在“五经”之中，对此合理的解释是（ ）
A．“五经”为阐发孔子儒学思想而作
B．汉代儒学背离了', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '湖南'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '历史', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '湖南_历史_2016_1', title: '一、选择题（共 12小题，每小题 4分，满分 48分）', subject: '历史', year: '2016', province: '湖南'})
WITH q MATCH (p:Paper {name: '2016年高考历史试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_历史_2016_2', title: '1．（4分）孔子是儒家学派的创始人，汉代崇尚儒学，尊《尚书》等五部书为经', subject: '历史', year: '2016', province: '湖南'})
WITH q MATCH (p:Paper {name: '2016年高考历史试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_历史_2016_3', title: '2．（4分）如图为汉代画像砖中的农事图。此图可以用来说明当时（ ）', subject: '历史', year: '2016', province: '湖南'})
WITH q MATCH (p:Paper {name: '2016年高考历史试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_历史_2016_4', title: '3．（4 分）史载，宋太祖某日闷闷不乐，有人问他原因，他说：“尔谓帝王可容', subject: '历史', year: '2016', province: '湖南'})
WITH q MATCH (p:Paper {name: '2016年高考历史试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_历史_2016_5', title: '4．（4分）明初废行省，地方分设三司，分别掌管一地民政与财政、司法、军事，', subject: '历史', year: '2016', province: '湖南'})
WITH q MATCH (p:Paper {name: '2016年高考历史试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2023年高考历史试卷（湖南）（解析卷）.pdf', province: '湖南', subject: '历史', year: '2023', type: '解析卷', volume: '解析卷', preview: '2023 年湖南省普通高中学业水平选择性考试
历史试题
本试卷满分 100 分，考试时间 75 分钟。
一、选择题：本题共 16 小题，每小题 3 分，共 48 分。在每小题给出的四个选项中，只有一
项是符合题目要求的。
1. 湖南澧县城头山古城遗址距今约6000年，是中国迄今已知最早的新石器时代城', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '湖南'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '历史', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '湖南_历史_2023_1', title: '一、选择题：本题共 16 小题，每小题 3 分，共 48 分。在每小题给出的四个选项中，只有一', subject: '历史', year: '2023', province: '湖南'})
WITH q MATCH (p:Paper {name: '2023年高考历史试卷（湖南）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_历史_2023_2', title: '1. 湖南澧县城头山古城遗址距今约6000年，是中国迄今已知最早的新石器时代城址。城址内外发掘出大', subject: '历史', year: '2023', province: '湖南'})
WITH q MATCH (p:Paper {name: '2023年高考历史试卷（湖南）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_历史_2023_3', title: '【详解】本题是单类型单项选择题。据本题设问词可知是本质题。据本题时间信息可知准确时空：约6000', subject: '历史', year: '2023', province: '湖南'})
WITH q MATCH (p:Paper {name: '2023年高考历史试卷（湖南）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_历史_2023_4', title: '【详解】本题是单类型单项选择题。据本题设问词可知是本质题。据本题时间信息可知准确时空：南北朝', subject: '历史', year: '2023', province: '湖南'})
WITH q MATCH (p:Paper {name: '2023年高考历史试卷（湖南）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_历史_2023_5', title: '4. 宋仁宗下诏废郭皇后。御史中丞孔道辅、谏官范仲淹等以“后无过不可废”，跪求奏对。仁宗遣宰相吕', subject: '历史', year: '2023', province: '湖南'})
WITH q MATCH (p:Paper {name: '2023年高考历史试卷（湖南）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2008年高考历史试卷（全国卷Ⅰ）（空白卷）.pdf', province: '湖南', subject: '历史', year: '2008', type: '空白卷', volume: '全国卷Ⅰ', preview: '2008年普通高等学校招生全国统一考试(全国卷Ⅰ)
文科综合（历史部分）
本试卷分第Ⅰ卷（选择题）和第Ⅱ卷两部分。第Ⅰ卷l至7页，第Ⅱ卷8至12页，共300分。
考生注意：
1．答题前，考生务必将自己的准考证号、姓名填写在答题卡上。考生要认真核对
答题卡上粘贴的条形码的“准考证号、姓名、考试科目”与', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '湖南'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '历史', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '湖南_历史_2008_1', title: '本试卷分第Ⅰ卷（选择题）和第Ⅱ卷两部分。第Ⅰ卷l至7页，第Ⅱ卷8至12页，共300分。', subject: '历史', year: '2008', province: '湖南'})
WITH q MATCH (p:Paper {name: '2008年高考历史试卷（全国卷Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_历史_2008_2', title: '1．答题前，考生务必将自己的准考证号、姓名填写在答题卡上。考生要认真核对', subject: '历史', year: '2008', province: '湖南'})
WITH q MATCH (p:Paper {name: '2008年高考历史试卷（全国卷Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_历史_2008_3', title: '2．第Ⅰ卷每小题选出答案后，用2B铅笔把答题卡上对应题目的答案标号涂黑，如需', subject: '历史', year: '2008', province: '湖南'})
WITH q MATCH (p:Paper {name: '2008年高考历史试卷（全国卷Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_历史_2008_4', title: '3．考试结束，监考员将试题卷、答题卡一并收回。', subject: '历史', year: '2008', province: '湖南'})
WITH q MATCH (p:Paper {name: '2008年高考历史试卷（全国卷Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_历史_2008_5', title: '（选择题）', subject: '历史', year: '2008', province: '湖南'})
WITH q MATCH (p:Paper {name: '2008年高考历史试卷（全国卷Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2023年高考生物试卷（湖南）（解析卷）.pdf', province: '湖南', subject: '生物', year: '2023', type: '解析卷', volume: '解析卷', preview: '2023 年普通高中学业水平选择性考试（湖南卷）生物
一、选择题：本题共 12小题，在每小题给出的四个选项中，只有一项是符合题目要求的。
1. 南极雌帝企鹅产蛋后，由雄帝企鹅负责孵蛋，孵蛋期间不进食。下列叙述错误的是（ ）
A. 帝企鹅蛋的卵清蛋白中N元素的质量分数高于C元素
B. 帝企鹅的核酸、多', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '湖南'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '生物', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '湖南_生物_2023_1', title: '一、选择题：本题共 12小题，在每小题给出的四个选项中，只有一项是符合题目要求的。', subject: '生物', year: '2023', province: '湖南'})
WITH q MATCH (p:Paper {name: '2023年高考生物试卷（湖南）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_生物_2023_2', title: '1. 南极雌帝企鹅产蛋后，由雄帝企鹅负责孵蛋，孵蛋期间不进食。下列叙述错误的是（ ）', subject: '生物', year: '2023', province: '湖南'})
WITH q MATCH (p:Paper {name: '2023年高考生物试卷（湖南）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_生物_2023_3', title: '2. 关于细胞结构与功能，下列叙述错误的是（ ）', subject: '生物', year: '2023', province: '湖南'})
WITH q MATCH (p:Paper {name: '2023年高考生物试卷（湖南）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_生物_2023_4', title: '3. 酗酒危害人类健康。乙醇在人体内先转化为乙醛，在乙醛脱氢酶2（ALDH2）作用下再转化为乙酸，最', subject: '生物', year: '2023', province: '湖南'})
WITH q MATCH (p:Paper {name: '2023年高考生物试卷（湖南）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2017年高考生物试卷（新课标Ⅰ）（空白卷）.pdf', province: '湖南', subject: '生物', year: '2017', type: '空白卷', volume: '空白卷', preview: '2017 年全国统一高考生物试卷（新课标Ⅰ）
一、选择题：本题共 6个小题，每小题 6分，共 36分。在每小题给出的四个选
项中，只有一项是符合题目要求的。
1．（6分）细胞间信息交流的方式有多种。在哺乳动物卵巢细胞分泌的雌激素作
用于乳腺细胞的过程中，以及精子进入卵细胞的过程中，细胞间信息交流的
', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '湖南'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '生物', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '湖南_生物_2017_1', title: '一、选择题：本题共 6个小题，每小题 6分，共 36分。在每小题给出的四个选', subject: '生物', year: '2017', province: '湖南'})
WITH q MATCH (p:Paper {name: '2017年高考生物试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_生物_2017_2', title: '1．（6分）细胞间信息交流的方式有多种。在哺乳动物卵巢细胞分泌的雌激素作', subject: '生物', year: '2017', province: '湖南'})
WITH q MATCH (p:Paper {name: '2017年高考生物试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_生物_2017_3', title: '2．（6分）下列关于细胞结构与成分的叙述，错误的是（ ）', subject: '生物', year: '2017', province: '湖南'})
WITH q MATCH (p:Paper {name: '2017年高考生物试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_生物_2017_4', title: '3．（6分）通常，叶片中叶绿素含量下降可作为其衰老的检测指标．为研究激素', subject: '生物', year: '2017', province: '湖南'})
WITH q MATCH (p:Paper {name: '2017年高考生物试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_生物_2017_5', title: '5．（6分）假设某草原上散养的某种家畜种群呈S型增长，该种群的增长率随种', subject: '生物', year: '2017', province: '湖南'})
WITH q MATCH (p:Paper {name: '2017年高考生物试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2012年高考生物试卷（新课标）（解析卷）.pdf', province: '湖南', subject: '生物', year: '2012', type: '解析卷', volume: '解析卷', preview: '2012 年全国统一高考生物试卷（新课标）
参考答案与试题解析
一、选择题：每小题 6分，共 36分
1．（6 分）同一物种的两类细胞各产生一种分泌蛋白，组成这两种蛋白质的各
种氨基酸含量相同，但排列顺序不同。其原因是参与这两种蛋白质合成的
（ ）
A．tRNA 种类不同
B．mRNA碱基序列不同
', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '湖南'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '生物', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '湖南_生物_2012_1', title: '一、选择题：每小题 6分，共 36分', subject: '生物', year: '2012', province: '湖南'})
WITH q MATCH (p:Paper {name: '2012年高考生物试卷（新课标）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_生物_2012_2', title: '1．（6 分）同一物种的两类细胞各产生一种分泌蛋白，组成这两种蛋白质的各', subject: '生物', year: '2012', province: '湖南'})
WITH q MATCH (p:Paper {name: '2012年高考生物试卷（新课标）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_生物_2012_3', title: '2．（6分）下列关于细胞癌变的叙述，错误的是（ ）', subject: '生物', year: '2012', province: '湖南'})
WITH q MATCH (p:Paper {name: '2012年高考生物试卷（新课标）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2009年高考生物试卷（全国卷Ⅰ）（空白卷）.pdf', province: '湖南', subject: '生物', year: '2009', type: '空白卷', volume: '全国卷Ⅰ', preview: '2009 年全国统一高考生物试卷（全国卷Ⅰ）
一、选择题（本题共 5 小题．在每小题给出的四个选项中，只有一项是符合题
目要求的）
1．下列关于人类遗传病的叙述，错误的是（ ）
A．单基因突变可以导致遗传病
B．染色体结构的改变可以导致遗传病
C．近亲婚配可增加隐性遗传病的发病风险
D．环境因素对多', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '湖南'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '生物', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '湖南_生物_2009_1', title: '一、选择题（本题共 5 小题．在每小题给出的四个选项中，只有一项是符合题', subject: '生物', year: '2009', province: '湖南'})
WITH q MATCH (p:Paper {name: '2009年高考生物试卷（全国卷Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_生物_2009_2', title: '1．下列关于人类遗传病的叙述，错误的是（ ）', subject: '生物', year: '2009', province: '湖南'})
WITH q MATCH (p:Paper {name: '2009年高考生物试卷（全国卷Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_生物_2009_3', title: '2．如图所示是某种微生物体内某一物质代谢过程的示意图．下列有关酶活性调', subject: '生物', year: '2009', province: '湖南'})
WITH q MATCH (p:Paper {name: '2009年高考生物试卷（全国卷Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_生物_2009_4', title: '3．下列关于通过发酵工程生产谷氨酸的叙述，错误的是（ ）', subject: '生物', year: '2009', province: '湖南'})
WITH q MATCH (p:Paper {name: '2009年高考生物试卷（全国卷Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_生物_2009_5', title: '4．下列关于体细胞杂交或植物细胞质遗传的叙述，错误的是（ ）', subject: '生物', year: '2009', province: '湖南'})
WITH q MATCH (p:Paper {name: '2009年高考生物试卷（全国卷Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2015年高考生物试卷（新课标Ⅰ）（空白卷）.pdf', province: '湖南', subject: '生物', year: '2015', type: '空白卷', volume: '空白卷', preview: '2015 年全国统一高考生物试卷（新课标Ⅰ）
一、选择题（每小题 6分）
1．（6分）下列叙述错误的是（ ）
A．DNA与ATP中所含元素的种类相同
B．一个tRNA分子中只有一个反密码子
C．T 噬菌体的核酸由脱氧核糖核苷酸组成
2
D．控制细菌性状的基因位于拟核和线粒体中的DNA上
2．（6分）', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '湖南'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '生物', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '湖南_生物_2015_1', title: '一、选择题（每小题 6分）', subject: '生物', year: '2015', province: '湖南'})
WITH q MATCH (p:Paper {name: '2015年高考生物试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_生物_2015_2', title: '1．（6分）下列叙述错误的是（ ）', subject: '生物', year: '2015', province: '湖南'})
WITH q MATCH (p:Paper {name: '2015年高考生物试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_生物_2015_3', title: '2．（6分）下列关于植物生长素的叙述，错误的是（ ）', subject: '生物', year: '2015', province: '湖南'})
WITH q MATCH (p:Paper {name: '2015年高考生物试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_生物_2015_4', title: '3．（6分）某同学给健康实验兔静脉滴注0.9%的NaCl 溶液（生理盐水）20mL后，', subject: '生物', year: '2015', province: '湖南'})
WITH q MATCH (p:Paper {name: '2015年高考生物试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_生物_2015_5', title: '4．（6 分）下列关于初生演替中草本阶段和灌木阶段的叙述，正确的是（ ）', subject: '生物', year: '2015', province: '湖南'})
WITH q MATCH (p:Paper {name: '2015年高考生物试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2021年高考生物试卷（湖南）（解析卷）.pdf', province: '湖南', subject: '生物', year: '2021', type: '解析卷', volume: '解析卷', preview: '湖南省 2021 年普通高中学业水平选择性考试
生物
一、选择题
1. 关于下列微生物的叙述，正确的是（ ）
A. 蓝藻细胞内含有叶绿体，能进行光合作用
B. 酵母菌有细胞壁和核糖体，属于单细胞原核生物
C. 破伤风杆菌细胞内不含线粒体，只能进行无氧呼吸
D. 支原体属于原核生物，细胞内含有染色质和', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '湖南'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '生物', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '湖南_生物_2021_1', title: '一、选择题', subject: '生物', year: '2021', province: '湖南'})
WITH q MATCH (p:Paper {name: '2021年高考生物试卷（湖南）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_生物_2021_2', title: '1. 关于下列微生物的叙述，正确的是（ ）', subject: '生物', year: '2021', province: '湖南'})
WITH q MATCH (p:Paper {name: '2021年高考生物试卷（湖南）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_生物_2021_3', title: '2. 以下生物学实验的部分操作过程，正确的是（ ）', subject: '生物', year: '2021', province: '湖南'})
WITH q MATCH (p:Paper {name: '2021年高考生物试卷（湖南）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2011年高考生物试卷（新课标）（解析卷）.pdf', province: '湖南', subject: '生物', year: '2011', type: '解析卷', volume: '解析卷', preview: '2011年全国统一高考生物试卷（新课标）
参考答案与试题解析
一、选择题：本大题共6小题，每小题6分．在每小题给出的四个选项中，只有
一项是符合题目要求的．
1．（6分）将人的红细胞放入4℃蒸馏水中，一段时间后红细胞破裂，主要原因
是（ ）
A．红细胞具有水溶性 B．红细胞的液泡体积增大
C．蒸馏水', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '湖南'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '生物', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '湖南_生物_2011_1', title: '一、选择题：本大题共6小题，每小题6分．在每小题给出的四个选项中，只有', subject: '生物', year: '2011', province: '湖南'})
WITH q MATCH (p:Paper {name: '2011年高考生物试卷（新课标）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_生物_2011_2', title: '1．（6分）将人的红细胞放入4℃蒸馏水中，一段时间后红细胞破裂，主要原因', subject: '生物', year: '2011', province: '湖南'})
WITH q MATCH (p:Paper {name: '2011年高考生物试卷（新课标）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_生物_2011_3', title: '2．（6分）', subject: '生物', year: '2011', province: '湖南'})
WITH q MATCH (p:Paper {name: '2011年高考生物试卷（新课标）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2024年高考生物试卷（湖南）（解析卷）.pdf', province: '湖南', subject: '生物', year: '2024', type: '解析卷', volume: '解析卷', preview: '机密★启用前
2024 年湖南省普通高中学业水平选择性考试生物学
本试卷共 8页，22题。全卷满分 100分。考试用时 75分钟。
注意事项：
1.答题前，先将自己的姓名、准考证号、考场号、座位号填写在试卷和答题卡上，并认真核
准准考证号条形码上的以上信息，将条形码粘贴在答题卡上的指定位置。
2.请', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '湖南'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '生物', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '湖南_生物_2024_1', title: '1.答题前，先将自己的姓名、准考证号、考场号、座位号填写在试卷和答题卡上，并认真核', subject: '生物', year: '2024', province: '湖南'})
WITH q MATCH (p:Paper {name: '2024年高考生物试卷（湖南）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_生物_2024_2', title: '2.请按题号顺序在答题卡上各题目的答题区域内作答，写在试卷、草稿纸和答题卡上的非答', subject: '生物', year: '2024', province: '湖南'})
WITH q MATCH (p:Paper {name: '2024年高考生物试卷（湖南）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_生物_2024_3', title: '3.选择题用 2B 铅笔在答题卡上把所选答案的标号涂黑；非选择题用黑色签字笔在答题卡上作', subject: '生物', year: '2024', province: '湖南'})
WITH q MATCH (p:Paper {name: '2024年高考生物试卷（湖南）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_生物_2024_4', title: '4.考试结束后，请将试卷和答题卡一并上交。', subject: '生物', year: '2024', province: '湖南'})
WITH q MATCH (p:Paper {name: '2024年高考生物试卷（湖南）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_生物_2024_5', title: '一、选择题：本题共 12小题，每小题 2分，共 24分。在每小题组出的四个选项中只有一项', subject: '生物', year: '2024', province: '湖南'})
WITH q MATCH (p:Paper {name: '2024年高考生物试卷（湖南）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2008年高考生物试卷（全国卷Ⅰ）（解析卷）.pdf', province: '湖南', subject: '生物', year: '2008', type: '解析卷', volume: '全国卷Ⅰ', preview: '2008年全国统一高考生物试卷（全国卷Ⅰ）
参考答案与试题解析
一、选择题（本题共5小题，在每小题给出的四个选项中，只有一项是符合题
目要求的．）
1．（6分）为了验证胰岛素具有降低血糖含量的作用，在设计实验方案时，如
果以正常小鼠每次注射药物前后小鼠症状的变化为观察指标，则下列对实验
组小鼠注射药', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '湖南'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '生物', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '湖南_生物_2008_1', title: '一、选择题（本题共5小题，在每小题给出的四个选项中，只有一项是符合题', subject: '生物', year: '2008', province: '湖南'})
WITH q MATCH (p:Paper {name: '2008年高考生物试卷（全国卷Ⅰ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_生物_2008_2', title: '1．（6分）为了验证胰岛素具有降低血糖含量的作用，在设计实验方案时，如', subject: '生物', year: '2008', province: '湖南'})
WITH q MATCH (p:Paper {name: '2008年高考生物试卷（全国卷Ⅰ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_生物_2008_3', title: '2．（6分）某水池有浮游动物和藻类两个种群，其种群密度随时间变化的趋势', subject: '生物', year: '2008', province: '湖南'})
WITH q MATCH (p:Paper {name: '2008年高考生物试卷（全国卷Ⅰ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2022年高考生物试卷（湖南）（空白卷）.pdf', province: '湖南', subject: '生物', year: '2022', type: '空白卷', volume: '空白卷', preview: '湖南省 2022 年普通高中学业水平选择性考试
生物
注意事项:
1.答卷前，考生务必将自己的姓名、准考证号填写在本试卷和答题卡上。
2.回答选择题时，选出每小题答案后，用铅笔把答题卡上对应题目的答案标号涂黑。如需改
动，用橡皮擦干净后，再选涂其他答案标号。回答非选择题时，将答案写在答题卡上。写在
', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '湖南'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '生物', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '湖南_生物_2022_1', title: '1.答卷前，考生务必将自己的姓名、准考证号填写在本试卷和答题卡上。', subject: '生物', year: '2022', province: '湖南'})
WITH q MATCH (p:Paper {name: '2022年高考生物试卷（湖南）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_生物_2022_2', title: '2.回答选择题时，选出每小题答案后，用铅笔把答题卡上对应题目的答案标号涂黑。如需改', subject: '生物', year: '2022', province: '湖南'})
WITH q MATCH (p:Paper {name: '2022年高考生物试卷（湖南）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_生物_2022_3', title: '动，用橡皮擦干净后，再选涂其他答案标号。回答非选择题时，将答案写在答题卡上。写在', subject: '生物', year: '2022', province: '湖南'})
WITH q MATCH (p:Paper {name: '2022年高考生物试卷（湖南）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_生物_2022_4', title: '3.考试结束后，将本试卷和答题卡一并交回。', subject: '生物', year: '2022', province: '湖南'})
WITH q MATCH (p:Paper {name: '2022年高考生物试卷（湖南）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_生物_2022_5', title: '一、选择题:本题共 12小题，在每小题给出的四个选项中，只有一项是符合题目要求的。', subject: '生物', year: '2022', province: '湖南'})
WITH q MATCH (p:Paper {name: '2022年高考生物试卷（湖南）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2010年高考生物试卷（全国卷Ⅰ）（解析卷）.pdf', province: '湖南', subject: '生物', year: '2010', type: '解析卷', volume: '全国卷Ⅰ', preview: '2010年全国统一高考生物试卷（全国卷Ⅰ）
参考答案与试题解析
一、选择题（共5小题，每小题3分，满分15分）
1．（3分）下列过程中，不直接依赖细胞膜的流动性就能完成的是（ ）
A．胰岛B细胞分泌胰岛素
B．吞噬细胞对抗原的摄取
C．mRNA与游离核糖体的结合
D．植物体细胞杂交中原生质体融合
【', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '湖南'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '生物', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '湖南_生物_2010_1', title: '一、选择题（共5小题，每小题3分，满分15分）', subject: '生物', year: '2010', province: '湖南'})
WITH q MATCH (p:Paper {name: '2010年高考生物试卷（全国卷Ⅰ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_生物_2010_2', title: '1．（3分）下列过程中，不直接依赖细胞膜的流动性就能完成的是（ ）', subject: '生物', year: '2010', province: '湖南'})
WITH q MATCH (p:Paper {name: '2010年高考生物试卷（全国卷Ⅰ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_生物_2010_3', title: '2．（3分）光照条件下，给C 植物和C 植物叶片提供14CO ，然后检测叶片中的', subject: '生物', year: '2010', province: '湖南'})
WITH q MATCH (p:Paper {name: '2010年高考生物试卷（全国卷Ⅰ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2014年高考生物试卷（新课标Ⅰ）（空白卷）.pdf', province: '湖南', subject: '生物', year: '2014', type: '空白卷', volume: '空白卷', preview: '2014 年全国统一高考生物试卷（新课标Ⅰ）
一、选择题（本题共 6小题，每小题 6分，共 36分）
1．（6分）关于细胞膜结构和功能叙述，错误的是（ ）
A．脂质和蛋白质是组成细胞膜的主要物质
B．当细胞衰老时，其细胞膜的通透性会发生改变
C．甘油是极性分子，所以不能以自由扩散的方式通过细胞膜
D', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '湖南'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '生物', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '湖南_生物_2014_1', title: '一、选择题（本题共 6小题，每小题 6分，共 36分）', subject: '生物', year: '2014', province: '湖南'})
WITH q MATCH (p:Paper {name: '2014年高考生物试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_生物_2014_2', title: '1．（6分）关于细胞膜结构和功能叙述，错误的是（ ）', subject: '生物', year: '2014', province: '湖南'})
WITH q MATCH (p:Paper {name: '2014年高考生物试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_生物_2014_3', title: '2．（6 分）正常生长的绿藻，照光培养一段时间后，用黑布迅速将培养瓶罩上，', subject: '生物', year: '2014', province: '湖南'})
WITH q MATCH (p:Paper {name: '2014年高考生物试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_生物_2014_4', title: '3．（6分）内环境稳定是维持机体正常生命活动的必要条件，下列叙述错误的是', subject: '生物', year: '2014', province: '湖南'})
WITH q MATCH (p:Paper {name: '2014年高考生物试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_生物_2014_5', title: '4．（6分）下列关于植物细胞质壁分离实验的叙述，错误的是（ ）', subject: '生物', year: '2014', province: '湖南'})
WITH q MATCH (p:Paper {name: '2014年高考生物试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2019年高考生物试卷（新课标Ⅰ）（空白卷）.pdf', province: '湖南', subject: '生物', year: '2019', type: '空白卷', volume: '空白卷', preview: '2019 年全国统一高考生物试卷（新课标Ⅰ）
一、选择题：本题共6小题，每小题6分，共36分。在每小题给出的四个选项中，只有一
项是符合题目要求的。
1．（6分）细胞凋亡是细胞死亡的一种类型。下列关于人体中细胞凋亡的叙述，正确的是
（ ）
A．胎儿手的发育过程中不会发生细胞凋亡
B．小肠上皮细胞的自', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '湖南'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '生物', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '湖南_生物_2019_1', title: '一、选择题：本题共6小题，每小题6分，共36分。在每小题给出的四个选项中，只有一', subject: '生物', year: '2019', province: '湖南'})
WITH q MATCH (p:Paper {name: '2019年高考生物试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_生物_2019_2', title: '1．（6分）细胞凋亡是细胞死亡的一种类型。下列关于人体中细胞凋亡的叙述，正确的是', subject: '生物', year: '2019', province: '湖南'})
WITH q MATCH (p:Paper {name: '2019年高考生物试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_生物_2019_3', title: '2．（6分）用体外实验的方法可合成多肽链。已知苯丙氨酸的密码子是UUU，若要在体外', subject: '生物', year: '2019', province: '湖南'})
WITH q MATCH (p:Paper {name: '2019年高考生物试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_生物_2019_4', title: '3．（6分）将一株质量为20g的黄瓜幼苗栽种在光照等适宜的环境中，一段时间后植株达到', subject: '生物', year: '2019', province: '湖南'})
WITH q MATCH (p:Paper {name: '2019年高考生物试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_生物_2019_5', title: '4．（6分）动物受到惊吓刺激时，兴', subject: '生物', year: '2019', province: '湖南'})
WITH q MATCH (p:Paper {name: '2019年高考生物试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2013年高考生物试卷（新课标Ⅰ）（解析卷）.pdf', province: '湖南', subject: '生物', year: '2013', type: '解析卷', volume: '解析卷', preview: '2013 年全国统一高考生物试卷（新课标Ⅰ）
参考答案与试题解析
一、选择题（共 6小题）
1．（6分）关于蛋白质生物合成的叙述，正确的是（ ）
A．一种tRNA 可以携带多种氨基酸
B．DNA聚合酶是在细胞核中合成的
C．反密码子是位于mRNA上相邻的三个碱基
D．线粒体中的DNA能控制某些蛋白质', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '湖南'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '生物', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '湖南_生物_2013_1', title: '一、选择题（共 6小题）', subject: '生物', year: '2013', province: '湖南'})
WITH q MATCH (p:Paper {name: '2013年高考生物试卷（新课标Ⅰ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_生物_2013_2', title: '1．（6分）关于蛋白质生物合成的叙述，正确的是（ ）', subject: '生物', year: '2013', province: '湖南'})
WITH q MATCH (p:Paper {name: '2013年高考生物试卷（新课标Ⅰ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2018年高考生物试卷（新课标Ⅰ）（空白卷）.pdf', province: '湖南', subject: '生物', year: '2018', type: '空白卷', volume: '空白卷', preview: '2018 年全国统一高考生物试卷（新课标Ⅰ）
一、选择题（共 6小题，每小题 6分，满分 36分）
1．（6分）生物膜的结构与功能存在密切的联系，下列有关叙述错误的是（ ）
A．叶绿体的类囊体膜上存在催化ATP合成的酶
B．溶酶体膜破裂后释放出的酶会造成细胞结构的破坏
C．细胞的核膜是双层膜结构，核', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '湖南'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '生物', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '湖南_生物_2018_1', title: '一、选择题（共 6小题，每小题 6分，满分 36分）', subject: '生物', year: '2018', province: '湖南'})
WITH q MATCH (p:Paper {name: '2018年高考生物试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_生物_2018_2', title: '1．（6分）生物膜的结构与功能存在密切的联系，下列有关叙述错误的是（ ）', subject: '生物', year: '2018', province: '湖南'})
WITH q MATCH (p:Paper {name: '2018年高考生物试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_生物_2018_3', title: '2．（6 分）生物体内的 DNA 常与蛋白质结合，以 DNA﹣蛋白质复合物的形式存', subject: '生物', year: '2018', province: '湖南'})
WITH q MATCH (p:Paper {name: '2018年高考生物试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_生物_2018_4', title: '3．（6分）下列有关植物根系吸收利用营养元素的叙述，错误的是（ ）', subject: '生物', year: '2018', province: '湖南'})
WITH q MATCH (p:Paper {name: '2018年高考生物试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_生物_2018_5', title: '5．（6分）种群密度是种群的数量特征之一。下列叙述错误的是（ ）', subject: '生物', year: '2018', province: '湖南'})
WITH q MATCH (p:Paper {name: '2018年高考生物试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2016年高考生物试卷（新课标Ⅰ）（解析卷）.pdf', province: '湖南', subject: '生物', year: '2016', type: '解析卷', volume: '解析卷', preview: '2016 年全国统一高考生物试卷（新课标Ⅰ）
参考答案与试题解析
一、选择题（共 6小题，每小题 6分，满分 36分）
1．（6分）下列与细胞相关的叙述，正确的是（ ）
A．核糖体、溶酶体都是具有膜结构的细胞器
B．酵母菌的细胞核内含有DNA和RNA两类核酸
C．蓝藻细胞的能量来源于其线粒体有氧呼吸', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '湖南'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '生物', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '湖南_生物_2016_1', title: '一、选择题（共 6小题，每小题 6分，满分 36分）', subject: '生物', year: '2016', province: '湖南'})
WITH q MATCH (p:Paper {name: '2016年高考生物试卷（新课标Ⅰ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_生物_2016_2', title: '1．（6分）下列与细胞相关的叙述，正确的是（ ）', subject: '生物', year: '2016', province: '湖南'})
WITH q MATCH (p:Paper {name: '2016年高考生物试卷（新课标Ⅰ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_生物_2016_3', title: '2．（6分）离子泵是一种具有ATP水解酶活性的载体蛋白，能利用水解ATP释放', subject: '生物', year: '2016', province: '湖南'})
WITH q MATCH (p:Paper {name: '2016年高考生物试卷（新课标Ⅰ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2020年高考生物试卷（新课标Ⅰ）（解析卷）.pdf', province: '湖南', subject: '生物', year: '2020', type: '解析卷', volume: '解析卷', preview: '2020 年全国统一高考生物试卷（新课标Ⅰ）
参考答案与试题解析
一、选择题：本题共6小题，每小题6分，共36分。在每小题给出的四个选项中，只有一
项是符合题目要求的。
1．（6分）新冠肺炎疫情警示人们要养成良好的生活习惯，提高公共卫生安全意识。下列相
关叙述错误的是（ ）
A．戴口罩可以减少病原微', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '湖南'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '生物', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '湖南_生物_2020_1', title: '一、选择题：本题共6小题，每小题6分，共36分。在每小题给出的四个选项中，只有一', subject: '生物', year: '2020', province: '湖南'})
WITH q MATCH (p:Paper {name: '2020年高考生物试卷（新课标Ⅰ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_生物_2020_2', title: '1．（6分）新冠肺炎疫情警示人们要养成良好的生活习惯，提高公共卫生安全意识。下列相', subject: '生物', year: '2020', province: '湖南'})
WITH q MATCH (p:Paper {name: '2020年高考生物试卷（新课标Ⅰ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2025年高考数学新课标全国Ⅰ卷真题+答案（版本3）.pdf', province: '湖南', subject: '数学', year: '2025', type: '未知', volume: '', preview: '', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '湖南'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '数学', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)

MERGE (p:Paper {name: '2018年高考语文试卷（新课标Ⅲ卷）（空白卷）.pdf', province: '湖南', subject: '语文', year: '2018', type: '空白卷', volume: '新课标Ⅲ卷', preview: '', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '湖南'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '语文', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)

MERGE (p:Paper {name: '2008年高考语文试卷（全国Ⅰ卷）（解析卷）.pdf', province: '湖南', subject: '语文', year: '2008', type: '解析卷', volume: '全国Ⅰ卷', preview: '', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '湖南'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '语文', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)

MERGE (p:Paper {name: '2023年高考语文试卷（新课标Ⅱ卷）（解析卷）.pdf', province: '湖南', subject: '语文', year: '2023', type: '解析卷', volume: '新课标Ⅱ卷', preview: '', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '湖南'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '语文', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)

MERGE (p:Paper {name: '2017年高考语文试卷（新课标Ⅱ卷）（空白卷）.pdf', province: '湖南', subject: '语文', year: '2017', type: '空白卷', volume: '新课标Ⅱ卷', preview: '', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '湖南'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '语文', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)

MERGE (p:Paper {name: '2020年高考语文试卷（新高考Ⅱ卷）（海南）（空白卷）.pdf', province: '湖南', subject: '语文', year: '2020', type: '空白卷', volume: '新高考Ⅱ卷', preview: '', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '湖南'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '语文', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)

MERGE (p:Paper {name: '2022年高考语文试卷（全国甲卷）（解析卷）.pdf', province: '湖南', subject: '语文', year: '2022', type: '解析卷', volume: '全国甲卷', preview: '', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '湖南'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '语文', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)

MERGE (p:Paper {name: '2009年高考语文试卷（全国Ⅰ卷）（空白卷）.pdf', province: '湖南', subject: '语文', year: '2009', type: '空白卷', volume: '全国Ⅰ卷', preview: '', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '湖南'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '语文', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)

MERGE (p:Paper {name: '2010年高考语文试卷（新课标）（解析卷）.pdf', province: '湖南', subject: '语文', year: '2010', type: '解析卷', volume: '解析卷', preview: '', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '湖南'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '语文', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)

MERGE (p:Paper {name: '2021年高考语文试卷（全国乙卷）（空白卷）.pdf', province: '湖南', subject: '语文', year: '2021', type: '空白卷', volume: '全国乙卷', preview: '', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '湖南'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '语文', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)

MERGE (p:Paper {name: '2014年高考语文试卷（新课标Ⅱ卷）（解析卷）.pdf', province: '湖南', subject: '语文', year: '2014', type: '解析卷', volume: '新课标Ⅱ卷', preview: '', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '湖南'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '语文', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)

MERGE (p:Paper {name: '2013年高考语文试卷（新课标Ⅱ卷）（空白卷）.pdf', province: '湖南', subject: '语文', year: '2013', type: '空白卷', volume: '新课标Ⅱ卷', preview: '', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '湖南'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '语文', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)

MERGE (p:Paper {name: '2015年高考语文试卷（新课标Ⅱ卷）（解析卷）.pdf', province: '湖南', subject: '语文', year: '2015', type: '解析卷', volume: '新课标Ⅱ卷', preview: '', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '湖南'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '语文', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)

MERGE (p:Paper {name: '2012年高考语文试卷（大纲版）（解析卷）.pdf', province: '湖南', subject: '语文', year: '2012', type: '解析卷', volume: '解析卷', preview: '', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '湖南'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '语文', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)

MERGE (p:Paper {name: '2011年高考语文试卷（新课标）（解析卷）.pdf', province: '湖南', subject: '语文', year: '2011', type: '解析卷', volume: '解析卷', preview: '', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '湖南'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '语文', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)

MERGE (p:Paper {name: '2024年高考语文试卷（全国甲卷）（空白卷）.pdf', province: '湖南', subject: '语文', year: '2024', type: '空白卷', volume: '全国甲卷', preview: '', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '湖南'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '语文', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)

MERGE (p:Paper {name: '2016年高考语文试卷（新课标Ⅱ卷）（空白卷）.pdf', province: '湖南', subject: '语文', year: '2016', type: '空白卷', volume: '新课标Ⅱ卷', preview: '', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '湖南'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '语文', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)

MERGE (p:Paper {name: '2025年高考语文全国卷创新试题及解析.pdf', province: '湖南', subject: '语文', year: '2025', type: '未知', volume: '', preview: '', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '湖南'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '语文', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)

MERGE (p:Paper {name: '2019年高考语文试卷（新课标Ⅰ卷）（空白卷）.pdf', province: '湖南', subject: '语文', year: '2019', type: '空白卷', volume: '新课标Ⅰ卷', preview: '', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '湖南'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '语文', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)

MERGE (p:Paper {name: '2015年高考物理试卷（新课标Ⅰ）（空白卷）.pdf', province: '湖南', subject: '物理', year: '2015', type: '空白卷', volume: '空白卷', preview: '2015 年全国统一高考物理试卷（新课标Ⅰ）
一、选择题（本题共 8小题，每小题 6分，在每小题给出的四个选项中，第 1-5
题只有一项符合题目要求。第 6-8 题有多项符合题目要求。全部选对的得 6
分，选对但不全的得 3分，有选错的得 0分）
1．（6分）两相邻匀强磁场区域的磁感应强度大小不同、', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '湖南'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '物理', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '湖南_物理_2015_1', title: '一、选择题（本题共 8小题，每小题 6分，在每小题给出的四个选项中，第 1-5', subject: '物理', year: '2015', province: '湖南'})
WITH q MATCH (p:Paper {name: '2015年高考物理试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_物理_2015_2', title: '1．（6分）两相邻匀强磁场区域的磁感应强度大小不同、方向平行。一速度方向', subject: '物理', year: '2015', province: '湖南'})
WITH q MATCH (p:Paper {name: '2015年高考物理试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_物理_2015_3', title: '2．（6 分）如图，直线 a、b 和 c、d 是处于匀强电场中的两组平行线，M、N、', subject: '物理', year: '2015', province: '湖南'})
WITH q MATCH (p:Paper {name: '2015年高考物理试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_物理_2015_4', title: '3．（6分）一理想变压器的原，副线圈的匝数比为3：', subject: '物理', year: '2015', province: '湖南'})
WITH q MATCH (p:Paper {name: '2015年高考物理试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_物理_2015_5', title: '4．（6 分）如图，一半径为 R，粗糙程度处处相同的半圆形轨道竖直固定放置，', subject: '物理', year: '2015', province: '湖南'})
WITH q MATCH (p:Paper {name: '2015年高考物理试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2021年高考物理试卷（湖南）（解析卷）.pdf', province: '湖南', subject: '物理', year: '2021', type: '解析卷', volume: '解析卷', preview: '湖南省 2021 年普通高中学业水平选择性考试
物理
注意事项：
1.答卷前，考生务必将自己的姓名、准考证号填写在本试卷和答题卡上。
2.回答选择题时，选出每小题答案后，用铅笔把答题卡上对应题目的答案标号涂黑。如需改动，
用橡皮擦干净后，再选涂其他答案标号。回答非选择题时，将答案写在答题卡上。写在本', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '湖南'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '物理', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '湖南_物理_2021_1', title: '1.答卷前，考生务必将自己的姓名、准考证号填写在本试卷和答题卡上。', subject: '物理', year: '2021', province: '湖南'})
WITH q MATCH (p:Paper {name: '2021年高考物理试卷（湖南）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_物理_2021_2', title: '2.回答选择题时，选出每小题答案后，用铅笔把答题卡上对应题目的答案标号涂黑。如需改动，', subject: '物理', year: '2021', province: '湖南'})
WITH q MATCH (p:Paper {name: '2021年高考物理试卷（湖南）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_物理_2021_3', title: '用橡皮擦干净后，再选涂其他答案标号。回答非选择题时，将答案写在答题卡上。写在本试', subject: '物理', year: '2021', province: '湖南'})
WITH q MATCH (p:Paper {name: '2021年高考物理试卷（湖南）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_物理_2021_4', title: '3.考试结束后，将本试卷和答题卡一并交回。', subject: '物理', year: '2021', province: '湖南'})
WITH q MATCH (p:Paper {name: '2021年高考物理试卷（湖南）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_物理_2021_5', title: '一、选择题：本题共 6小题，每小题 4分，共 24 分。在每小题给出的四个选项中，只有一项', subject: '物理', year: '2021', province: '湖南'})
WITH q MATCH (p:Paper {name: '2021年高考物理试卷（湖南）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2023年高考物理试卷（湖南）（解析卷）.pdf', province: '湖南', subject: '物理', year: '2023', type: '解析卷', volume: '解析卷', preview: '湖南省 2023 年普通高中学业水平选择性考试
物理
注意事项：
1．答卷前，考生务必将自己的姓名、准考证号填写在本试卷和答题卡上．
2．回答选择题时，选出每小题答案后，用铅笔把答题卡上对应题目的答案标号涂黑．如需
改动，用橡皮擦干净后，再选涂其他答案标号．回答非选择题时，将答案写在答题卡上．写
在', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '湖南'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '物理', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '湖南_物理_2023_1', title: '1．答卷前，考生务必将自己的姓名、准考证号填写在本试卷和答题卡上．', subject: '物理', year: '2023', province: '湖南'})
WITH q MATCH (p:Paper {name: '2023年高考物理试卷（湖南）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_物理_2023_2', title: '2．回答选择题时，选出每小题答案后，用铅笔把答题卡上对应题目的答案标号涂黑．如需', subject: '物理', year: '2023', province: '湖南'})
WITH q MATCH (p:Paper {name: '2023年高考物理试卷（湖南）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_物理_2023_3', title: '改动，用橡皮擦干净后，再选涂其他答案标号．回答非选择题时，将答案写在答题卡上．写', subject: '物理', year: '2023', province: '湖南'})
WITH q MATCH (p:Paper {name: '2023年高考物理试卷（湖南）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_物理_2023_4', title: '3．考试结束后，将本试卷和答题卡一并交回．', subject: '物理', year: '2023', province: '湖南'})
WITH q MATCH (p:Paper {name: '2023年高考物理试卷（湖南）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_物理_2023_5', title: '一、选择题：本题共 6小题，每小题 4分，共 24分．在每小题给出的四个选项中，只有一', subject: '物理', year: '2023', province: '湖南'})
WITH q MATCH (p:Paper {name: '2023年高考物理试卷（湖南）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2017年高考物理试卷（新课标Ⅰ）（解析卷）.pdf', province: '湖南', subject: '物理', year: '2017', type: '解析卷', volume: '解析卷', preview: '2017 年全国统一高考物理试卷（新课标Ⅰ）
参考答案与试题解析
一、选择题：本大题共 8 小题，每小题 6 分．在每小题给出的四个选项中，第
1～5 题只有一项是符合题目要求，第 6～8 题有多项符合题目要求．全部选
对的得 6分，选对但不全的得 3分．有选错的得 0分．
1．（6分）将质量为1.', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '湖南'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '物理', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '湖南_物理_2017_1', title: '一、选择题：本大题共 8 小题，每小题 6 分．在每小题给出的四个选项中，第', subject: '物理', year: '2017', province: '湖南'})
WITH q MATCH (p:Paper {name: '2017年高考物理试卷（新课标Ⅰ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_物理_2017_2', title: '1．（6分）将质量为1.00kg的模型火箭点火升空，50g燃烧的燃气以大小为600m/s', subject: '物理', year: '2017', province: '湖南'})
WITH q MATCH (p:Paper {name: '2017年高考物理试卷（新课标Ⅰ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2016年高考物理试卷（新课标Ⅰ）（解析卷）.pdf', province: '湖南', subject: '物理', year: '2016', type: '解析卷', volume: '解析卷', preview: '2016 年全国统一高考物理试卷（新课标Ⅰ）
参考答案与试题解析
二、选择题：本大题共 8 小题，每小题 6 分．在每小题给出的四个选项中，第
1～4 题只有一项是符合题目要求，第 5～8 题有多项符合题目要求．全部选
对的得 6分，选对但不全的得 3分．有选错的得 0分．
1．（6分）一平行电容器', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '湖南'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '物理', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '湖南_物理_2016_1', title: '二、选择题：本大题共 8 小题，每小题 6 分．在每小题给出的四个选项中，第', subject: '物理', year: '2016', province: '湖南'})
WITH q MATCH (p:Paper {name: '2016年高考物理试卷（新课标Ⅰ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_物理_2016_2', title: '1．（6分）一平行电容器两极板之间充满云母介质，接在恒压直流电源上，若将', subject: '物理', year: '2016', province: '湖南'})
WITH q MATCH (p:Paper {name: '2016年高考物理试卷（新课标Ⅰ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_物理_2016_3', title: '2．（6分）现代质谱仪可用来分析比质子重很多的离子，其示意图如图所示，其', subject: '物理', year: '2016', province: '湖南'})
WITH q MATCH (p:Paper {name: '2016年高考物理试卷（新课标Ⅰ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2011年高考物理试卷（新课标）（空白卷）.pdf', province: '湖南', subject: '物理', year: '2011', type: '空白卷', volume: '空白卷', preview: '2011 年全国统一高考物理试卷（新课标）
一、选择题：本题共 8小题，每小题 6分，共 48分．在每小题给出的四个选项
中，有的只有一个选项正确，有的有多个选项正确，全部选对的得 6 分，选
对但不全的得 3分，有选错的得 0分．
1．（6 分）为了解释地球的磁性，19 世纪安培假设：地球的磁场是', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '湖南'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '物理', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '湖南_物理_2011_1', title: '一、选择题：本题共 8小题，每小题 6分，共 48分．在每小题给出的四个选项', subject: '物理', year: '2011', province: '湖南'})
WITH q MATCH (p:Paper {name: '2011年高考物理试卷（新课标）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_物理_2011_2', title: '1．（6 分）为了解释地球的磁性，19 世纪安培假设：地球的磁场是由绕过地心', subject: '物理', year: '2011', province: '湖南'})
WITH q MATCH (p:Paper {name: '2011年高考物理试卷（新课标）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_物理_2011_3', title: '2．（6 分）质点开始时做匀速直线运动，从某时刻起受到一恒力作用．此后，', subject: '物理', year: '2011', province: '湖南'})
WITH q MATCH (p:Paper {name: '2011年高考物理试卷（新课标）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_物理_2011_4', title: '3．（6 分）一蹦极运动员身系弹性蹦极绳从水面上方的高台下落，到最低点时', subject: '物理', year: '2011', province: '湖南'})
WITH q MATCH (p:Paper {name: '2011年高考物理试卷（新课标）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_物理_2011_5', title: '5．（6 分）电磁轨道炮工作原理如图所示。待发射弹体可在两平行轨道之间自', subject: '物理', year: '2011', province: '湖南'})
WITH q MATCH (p:Paper {name: '2011年高考物理试卷（新课标）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2018年高考物理试卷（新课标Ⅰ）（空白卷）.pdf', province: '湖南', subject: '物理', year: '2018', type: '空白卷', volume: '空白卷', preview: '2018 年全国统一高考物理试卷（新课标Ⅰ）
一、选择题：本题共 8小题，每小题 6分，共 48分.在每小题给出的四个选项中，
第 1～5题只有一顶符合题目要求，第 6～8题有多项符合题目要求.全部选对
的得 6分，选对但不全的得 3分，有选错的得 0分．
1．（6分）高铁列车在启动阶段的运动可看作', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '湖南'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '物理', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '湖南_物理_2018_1', title: '一、选择题：本题共 8小题，每小题 6分，共 48分.在每小题给出的四个选项中，', subject: '物理', year: '2018', province: '湖南'})
WITH q MATCH (p:Paper {name: '2018年高考物理试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_物理_2018_2', title: '1．（6分）高铁列车在启动阶段的运动可看作初速度为零的匀加速直线运动，在', subject: '物理', year: '2018', province: '湖南'})
WITH q MATCH (p:Paper {name: '2018年高考物理试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_物理_2018_3', title: '2．（6 分）如图，轻弹簧的下端固定在水平桌面上，上端放有物块 P，系统处于', subject: '物理', year: '2018', province: '湖南'})
WITH q MATCH (p:Paper {name: '2018年高考物理试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_物理_2018_4', title: '3．（6 分）如图，三个固定的带电小球 a，b 和 c，相互间的距离分别为 ab=5cm，', subject: '物理', year: '2018', province: '湖南'})
WITH q MATCH (p:Paper {name: '2018年高考物理试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_物理_2018_5', title: '4．（6分）如图，导体轨道OPQS 固定，其中PQS是半圆弧，Q为半圆弧的中点，', subject: '物理', year: '2018', province: '湖南'})
WITH q MATCH (p:Paper {name: '2018年高考物理试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2010年高考物理试卷（全国卷Ⅰ）（解析卷）.pdf', province: '湖南', subject: '物理', year: '2010', type: '解析卷', volume: '全国卷Ⅰ', preview: '2010年全国统一高考物理试卷（全国卷Ⅰ）
参考答案与试题解析
一、选择题（在每小题给出的四个选项中，有的只有一个选项正确，有的有多
个选项正确，全部选对的得6分，选对但不全的得3分，有选错的得0分．）
1．（6分）原子核 U经放射性衰变①变为原子 Th，继而经放射性衰变
②变为原子核 Pa，再经放', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '湖南'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '物理', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '湖南_物理_2010_1', title: '一、选择题（在每小题给出的四个选项中，有的只有一个选项正确，有的有多', subject: '物理', year: '2010', province: '湖南'})
WITH q MATCH (p:Paper {name: '2010年高考物理试卷（全国卷Ⅰ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_物理_2010_2', title: '1．（6分）原子核 U经放射性衰变①变为原子 Th，继而经放射性衰变', subject: '物理', year: '2010', province: '湖南'})
WITH q MATCH (p:Paper {name: '2010年高考物理试卷（全国卷Ⅰ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_物理_2010_3', title: '2．（6分）如图，轻弹簧上端与一质量为m的木块1相连，下端与另一质量为M', subject: '物理', year: '2010', province: '湖南'})
WITH q MATCH (p:Paper {name: '2010年高考物理试卷（全国卷Ⅰ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2024年高考物理试卷（湖南）（解析卷）.pdf', province: '湖南', subject: '物理', year: '2024', type: '解析卷', volume: '解析卷', preview: '2024 年普通高中学业水平选择性考试（湖南卷）
物理试题本试卷共 100分，考试时间 75分钟．
一、选择题：本题共 6小题，每小题 4分，共 24分。在每小题给出的四个选项中，只有一
项是符合题目要求的。
1. 量子技术是当前物理学应用研究的热点，下列关于量子论的说法正确的是（ ）
A. 普朗克', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '湖南'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '物理', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '湖南_物理_2024_1', title: '一、选择题：本题共 6小题，每小题 4分，共 24分。在每小题给出的四个选项中，只有一', subject: '物理', year: '2024', province: '湖南'})
WITH q MATCH (p:Paper {name: '2024年高考物理试卷（湖南）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_物理_2024_2', title: '1. 量子技术是当前物理学应用研究的热点，下列关于量子论的说法正确的是（ ）', subject: '物理', year: '2024', province: '湖南'})
WITH q MATCH (p:Paper {name: '2024年高考物理试卷（湖南）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2008年高考物理试卷（全国卷Ⅰ）（空白卷）.pdf', province: '湖南', subject: '物理', year: '2008', type: '空白卷', volume: '全国卷Ⅰ', preview: '2008 年全国统一高考物理试卷（全国卷Ⅰ）
一、选择题（本题共 8 小题，在每小题给出的四个选项中，有的只有一个选项
正确，有的有多个选项正确，全部选对的得 6 分，选对但不全的得 3 分，有
选错的得 0分）
1．（6 分）如图所示，一物体自倾角为 θ 的固定斜面顶端沿水平方向抛出后落
在斜面上', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '湖南'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '物理', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '湖南_物理_2008_1', title: '一、选择题（本题共 8 小题，在每小题给出的四个选项中，有的只有一个选项', subject: '物理', year: '2008', province: '湖南'})
WITH q MATCH (p:Paper {name: '2008年高考物理试卷（全国卷Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_物理_2008_2', title: '1．（6 分）如图所示，一物体自倾角为 θ 的固定斜面顶端沿水平方向抛出后落', subject: '物理', year: '2008', province: '湖南'})
WITH q MATCH (p:Paper {name: '2008年高考物理试卷（全国卷Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_物理_2008_3', title: '2．（6 分）如图，一辆有动力驱动的小车上有一水平放置的弹簧，其左端固定', subject: '物理', year: '2008', province: '湖南'})
WITH q MATCH (p:Paper {name: '2008年高考物理试卷（全国卷Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_物理_2008_4', title: '3．（6分）一列简谐横波沿x轴传播，周期为T，t=0时的波形如图所示，此时', subject: '物理', year: '2008', province: '湖南'})
WITH q MATCH (p:Paper {name: '2008年高考物理试卷（全国卷Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_物理_2008_5', title: '4．（6分）已知太阳到地球与地球到月球的距离的比值约为390，月球绕地球旋', subject: '物理', year: '2008', province: '湖南'})
WITH q MATCH (p:Paper {name: '2008年高考物理试卷（全国卷Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2019年高考物理试卷（新课标Ⅰ）（空白卷）.pdf', province: '湖南', subject: '物理', year: '2019', type: '空白卷', volume: '空白卷', preview: '2019 年全国统一高考物理试卷（新课标Ⅰ）
一、选择题：本题共8小题，每小题6分，共48分。在每小题给出的四个选项中，第1～5
题只有一项符合题目要求，第6～8题有多项符合题目要求。全部选对的得6分，选对但不
全的得3分，有选错的得0分。
1．（6分）氢原子能级示意图如图所示。光子能量在1.63e', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '湖南'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '物理', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '湖南_物理_2019_1', title: '一、选择题：本题共8小题，每小题6分，共48分。在每小题给出的四个选项中，第1～5', subject: '物理', year: '2019', province: '湖南'})
WITH q MATCH (p:Paper {name: '2019年高考物理试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_物理_2019_2', title: '1．（6分）氢原子能级示意图如图所示。光子能量在1.63eV～3.10eV的光为可见光。要使', subject: '物理', year: '2019', province: '湖南'})
WITH q MATCH (p:Paper {name: '2019年高考物理试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_物理_2019_3', title: '2．（6分）如图，空间存在一方向水平向右的匀强电场，两个带电小球P和Q用相同的绝缘', subject: '物理', year: '2019', province: '湖南'})
WITH q MATCH (p:Paper {name: '2019年高考物理试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_物理_2019_4', title: '3．（6分）最近，我国为“长征九号”研制的大推力新型火箭发动机联试成功，这标志着我', subject: '物理', year: '2019', province: '湖南'})
WITH q MATCH (p:Paper {name: '2019年高考物理试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_物理_2019_5', title: '5．（6 分）如图，篮球架下的运动员原地垂直起跳扣篮，离地后重心上升的最大高度为', subject: '物理', year: '2019', province: '湖南'})
WITH q MATCH (p:Paper {name: '2019年高考物理试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2022年高考物理试卷（湖南）（解析卷）.pdf', province: '湖南', subject: '物理', year: '2022', type: '解析卷', volume: '解析卷', preview: '湖南省 2022 年普通高中学业水平选择性考试
物理
注意事项：
1．答卷前，考生务必将自己的姓名、准考证号填写在本试卷和答题卡上。
2．回答选择题时，选出每小题答案后，用铅笔把答题卡上对应题目的答案标号涂黑。如需
改动，用橡皮擦干净后，再选涂其他答案标号。回答非选择题时，将答案写在答题卡上。写
在', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '湖南'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '物理', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '湖南_物理_2022_1', title: '1．答卷前，考生务必将自己的姓名、准考证号填写在本试卷和答题卡上。', subject: '物理', year: '2022', province: '湖南'})
WITH q MATCH (p:Paper {name: '2022年高考物理试卷（湖南）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_物理_2022_2', title: '2．回答选择题时，选出每小题答案后，用铅笔把答题卡上对应题目的答案标号涂黑。如需', subject: '物理', year: '2022', province: '湖南'})
WITH q MATCH (p:Paper {name: '2022年高考物理试卷（湖南）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_物理_2022_3', title: '改动，用橡皮擦干净后，再选涂其他答案标号。回答非选择题时，将答案写在答题卡上。写', subject: '物理', year: '2022', province: '湖南'})
WITH q MATCH (p:Paper {name: '2022年高考物理试卷（湖南）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_物理_2022_4', title: '3．考试结束后，将本试卷和答题卡一并交回。', subject: '物理', year: '2022', province: '湖南'})
WITH q MATCH (p:Paper {name: '2022年高考物理试卷（湖南）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_物理_2022_5', title: '一、选择题：本题共 6小题，每小题 4分，共 24 分。在每小题给出的四个选项中，只有一', subject: '物理', year: '2022', province: '湖南'})
WITH q MATCH (p:Paper {name: '2022年高考物理试卷（湖南）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2014年高考物理试卷（新课标Ⅰ）（解析卷）.pdf', province: '湖南', subject: '物理', year: '2014', type: '解析卷', volume: '解析卷', preview: '2014 年全国统一高考物理试卷（新课标Ⅰ）
参考答案与试题解析
一、选择题：本题共 8小题，每小题 6分，在每题给出的四个选项中，第 14-18
题只有一项符合题目要求，第 19-21题有多项符合题目要求。全部选对的得 6
分，选对但不全的得 3分，有选错的得 0分。
1．（6 分）在法拉第时代，', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '湖南'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '物理', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '湖南_物理_2014_1', title: '一、选择题：本题共 8小题，每小题 6分，在每题给出的四个选项中，第 14-18', subject: '物理', year: '2014', province: '湖南'})
WITH q MATCH (p:Paper {name: '2014年高考物理试卷（新课标Ⅰ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_物理_2014_2', title: '1．（6 分）在法拉第时代，下列验证“由磁产生电”设想的实验中，能观察到感', subject: '物理', year: '2014', province: '湖南'})
WITH q MATCH (p:Paper {name: '2014年高考物理试卷（新课标Ⅰ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_物理_2014_3', title: '2．（6分）关于通电直导线在匀强磁场中所受的安培力，下列说法正确的是（ ）', subject: '物理', year: '2014', province: '湖南'})
WITH q MATCH (p:Paper {name: '2014年高考物理试卷（新课标Ⅰ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2013年高考物理试卷（新课标Ⅰ）（空白卷）.pdf', province: '湖南', subject: '物理', year: '2013', type: '空白卷', volume: '空白卷', preview: '2013 年全国统一高考物理试卷（新课标Ⅰ）
一、选择题：本题共 8小题，每小题 6分．在每小题给出的四个选项中，第 1～
5题只有一项符合题目要求，第 6-8题有多项符合题目要求．全部选对的得 6
分，选对但不全的得 3分，有选错的得 0分．
1．（6 分）如图是伽利略 1604 年做斜面实验时的', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '湖南'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '物理', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '湖南_物理_2013_1', title: '一、选择题：本题共 8小题，每小题 6分．在每小题给出的四个选项中，第 1～', subject: '物理', year: '2013', province: '湖南'})
WITH q MATCH (p:Paper {name: '2013年高考物理试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_物理_2013_2', title: '1．（6 分）如图是伽利略 1604 年做斜面实验时的一页手稿照片，照片左上角的', subject: '物理', year: '2013', province: '湖南'})
WITH q MATCH (p:Paper {name: '2013年高考物理试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_物理_2013_3', title: '2．（6分）如图，一半径为R的圆盘上均匀分布着电荷量为Q的电荷，在垂直于', subject: '物理', year: '2013', province: '湖南'})
WITH q MATCH (p:Paper {name: '2013年高考物理试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_物理_2013_4', title: '3．（6 分）一水平放置的平行板电容器的两极板间距为 d，极板分别与电池两极', subject: '物理', year: '2013', province: '湖南'})
WITH q MATCH (p:Paper {name: '2013年高考物理试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2025年高考湖南卷物理真题-47d06f3e23af.pdf', province: '湖南', subject: '物理', year: '2025', type: '未知', volume: '', preview: '湖南省 2025 年普通高中学业水平选择性考试
物理
限时75分钟 满分 100分
一、选择题：本题共 6小题，每小题 4分，共 24分。在每小题给出的四个选项中，只有一项
是符合题目要求的。
的
1. 关于原子核衰变，下列说法正确 是（ ）
A. 原子核衰变后生成新核并释放能量，新核总质量等于原核', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '湖南'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '物理', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '湖南_物理_2025_1', title: '一、选择题：本题共 6小题，每小题 4分，共 24分。在每小题给出的四个选项中，只有一项', subject: '物理', year: '2025', province: '湖南'})
WITH q MATCH (p:Paper {name: '2025年高考湖南卷物理真题-47d06f3e23af.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_物理_2025_2', title: '1. 关于原子核衰变，下列说法正确 是（ ）', subject: '物理', year: '2025', province: '湖南'})
WITH q MATCH (p:Paper {name: '2025年高考湖南卷物理真题-47d06f3e23af.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_物理_2025_3', title: '2. 如图，物块以某一初速度滑上足够长的固定光滑斜面，物块的水平位移、竖直位移、水平速度、竖直速', subject: '物理', year: '2025', province: '湖南'})
WITH q MATCH (p:Paper {name: '2025年高考湖南卷物理真题-47d06f3e23af.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_物理_2025_4', title: '3. 如图，ABC为半圆柱体透明介质的横截面，AC为直径，B为ABC的中点。真空中一束单色光从AC边', subject: '物理', year: '2025', province: '湖南'})
WITH q MATCH (p:Paper {name: '2025年高考湖南卷物理真题-47d06f3e23af.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_物理_2025_5', title: '4. 我国研制的“天问二号”探测器，任务是对伴地小行星及彗星交会等进行多目标探测。某同学提出探究', subject: '物理', year: '2025', province: '湖南'})
WITH q MATCH (p:Paper {name: '2025年高考湖南卷物理真题-47d06f3e23af.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2020年高考物理试卷（新课标Ⅰ）（空白卷）.pdf', province: '湖南', subject: '物理', year: '2020', type: '空白卷', volume: '空白卷', preview: '2020 年全国统一高考物理试卷（新课标Ⅰ）
一、选择题：本题共8小题，每小题6分，共48分。在每小题给出的四个选项中，第1~5
题只有一项符合题目要求，第6~8题有多项符合题目要求。全部选对的得6分，选对但不
全的得3分，有选错的得0分。
1．（6分）行驶中的汽车如果发生剧烈碰撞，车内的安全气囊会', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '湖南'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '物理', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '湖南_物理_2020_1', title: '一、选择题：本题共8小题，每小题6分，共48分。在每小题给出的四个选项中，第1~5', subject: '物理', year: '2020', province: '湖南'})
WITH q MATCH (p:Paper {name: '2020年高考物理试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_物理_2020_2', title: '1．（6分）行驶中的汽车如果发生剧烈碰撞，车内的安全气囊会被弹出并瞬间充满气体。若', subject: '物理', year: '2020', province: '湖南'})
WITH q MATCH (p:Paper {name: '2020年高考物理试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_物理_2020_3', title: '2．（6分）火星的质量约为地球质量的 ，半径约为地球半径的 ，则同一物体在火星表', subject: '物理', year: '2020', province: '湖南'})
WITH q MATCH (p:Paper {name: '2020年高考物理试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_物理_2020_4', title: '3．（6分）如图，一同学表演荡秋千。已知秋千的两根绳长均为10m，该同学和秋千踏板的', subject: '物理', year: '2020', province: '湖南'})
WITH q MATCH (p:Paper {name: '2020年高考物理试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_物理_2020_5', title: '5．（6分）一匀强磁场的磁感应强度大小为B，方向垂直于纸面向外，其边界如图中虚线所', subject: '物理', year: '2020', province: '湖南'})
WITH q MATCH (p:Paper {name: '2020年高考物理试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2012年高考物理试卷（新课标）（空白卷）.pdf', province: '湖南', subject: '物理', year: '2012', type: '空白卷', volume: '空白卷', preview: '2012 年全国统一高考物理试卷（新课标）
一．选择题
1．（3分）伽利略根据小球在斜面上运动的实验和理想实验，提出了惯性的概念，
从而奠定了牛顿力学的基础．早期物理学家关于惯性有下列说法，其中正确
的是（ ）
A．物体抵抗运动状态变化的性质是惯性
B．没有力作用，物体只能处于静止状态
C．行星在圆', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '湖南'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '物理', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '湖南_物理_2012_1', title: '一．选择题', subject: '物理', year: '2012', province: '湖南'})
WITH q MATCH (p:Paper {name: '2012年高考物理试卷（新课标）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_物理_2012_2', title: '1．（3分）伽利略根据小球在斜面上运动的实验和理想实验，提出了惯性的概念，', subject: '物理', year: '2012', province: '湖南'})
WITH q MATCH (p:Paper {name: '2012年高考物理试卷（新课标）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_物理_2012_3', title: '2．（3分）如图，x轴在水平地面内，y 轴沿竖直方向。图中画出了从y轴上沿x', subject: '物理', year: '2012', province: '湖南'})
WITH q MATCH (p:Paper {name: '2012年高考物理试卷（新课标）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_物理_2012_4', title: '3．（3分）如图，一小球放置在木板与竖直墙面之间。设墙面对球的压力大小为', subject: '物理', year: '2012', province: '湖南'})
WITH q MATCH (p:Paper {name: '2012年高考物理试卷（新课标）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2009年高考物理试卷（全国卷Ⅰ）（解析卷）.pdf', province: '湖南', subject: '物理', year: '2009', type: '解析卷', volume: '全国卷Ⅰ', preview: '2009年全国统一高考物理试卷（全国卷Ⅰ）
参考答案与试题解析
一、选择题（本题共8小题，在每小题给出的四个选项中，有的只有一个选项
正确，有的有多个选项正确，全部选对的得6分，选对但不全的得3分，有选
错的得0分）
1．（6分）下列说法正确的是（ ）
A．气体对器壁的压强大小等于大量气体分子作用在', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '湖南'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '物理', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '湖南_物理_2009_1', title: '一、选择题（本题共8小题，在每小题给出的四个选项中，有的只有一个选项', subject: '物理', year: '2009', province: '湖南'})
WITH q MATCH (p:Paper {name: '2009年高考物理试卷（全国卷Ⅰ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_物理_2009_2', title: '1．（6分）下列说法正确的是（ ）', subject: '物理', year: '2009', province: '湖南'})
WITH q MATCH (p:Paper {name: '2009年高考物理试卷（全国卷Ⅰ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_物理_2009_3', title: '2．（6分）某物体左右两侧各有一竖直放置的平面镜，两平面镜相互平行，物', subject: '物理', year: '2009', province: '湖南'})
WITH q MATCH (p:Paper {name: '2009年高考物理试卷（全国卷Ⅰ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2015年高考地理试卷（新课标Ⅰ）（解析卷）.pdf', province: '湖南', subject: '地理', year: '2015', type: '解析卷', volume: '解析卷', preview: '2015 年全国统一高考地理试卷（新课标Ⅰ）
参考答案与试题解析
一、选择题（每小题 0分）
雨水花园是一种模仿自然界雨水汇集、渗漏而建设的浅凹绿地，主要用于汇聚并
吸收来自屋顶或地面的雨水，并通过植物及各填充层的综合作用使渗漏的雨
水得到净化．净化后的雨水不仅可以补给地下水，也可以作为城市景观用水', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '湖南'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '地理', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '湖南_地理_2015_1', title: '一、选择题（每小题 0分）', subject: '地理', year: '2015', province: '湖南'})
WITH q MATCH (p:Paper {name: '2015年高考地理试卷（新课标Ⅰ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_地理_2015_2', title: '1．（4分）铺设树皮覆盖层的主要目的是（ ）', subject: '地理', year: '2015', province: '湖南'})
WITH q MATCH (p:Paper {name: '2015年高考地理试卷（新课标Ⅰ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_地理_2015_3', title: '2．（4分）对下', subject: '地理', year: '2015', province: '湖南'})
WITH q MATCH (p:Paper {name: '2015年高考地理试卷（新课标Ⅰ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2009年高考地理试卷（全国卷Ⅰ）（解析卷）.pdf', province: '湖南', subject: '地理', year: '2009', type: '解析卷', volume: '全国卷Ⅰ', preview: '2009年全国统一考试地理试卷（全国卷Ⅰ）
一、选择题：在每题给出的四个选项中，只有一项是符合题目要求的．
甲市2008年户籍人口出生9.67万人，出生率为0.699%；死亡10.7万人，死亡率为
0.773%．甲市户籍人口这种自然增长态势已持续14年．图上显示四个地区的
人口出生率和死亡率．据此完', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '湖南'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '地理', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '湖南_地理_2009_1', title: '一、选择题：在每题给出的四个选项中，只有一项是符合题目要求的．', subject: '地理', year: '2009', province: '湖南'})
WITH q MATCH (p:Paper {name: '2009年高考地理试卷（全国卷Ⅰ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_地理_2009_2', title: '0.773%．甲市户籍人口这种自然增长态势已持续14年．图上显示四个地区的', subject: '地理', year: '2009', province: '湖南'})
WITH q MATCH (p:Paper {name: '2009年高考地理试卷（全国卷Ⅰ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_地理_2009_3', title: '1．（4分）甲市可能是（ ）', subject: '地理', year: '2009', province: '湖南'})
WITH q MATCH (p:Paper {name: '2009年高考地理试卷（全国卷Ⅰ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_地理_2009_4', title: '2．（4分）①②③④四个地区中，人口再生产与甲市处于同一类型的地区是（', subject: '地理', year: '2009', province: '湖南'})
WITH q MATCH (p:Paper {name: '2009年高考地理试卷（全国卷Ⅰ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_地理_2009_5', title: '3．（4分）N地风向为（ ）', subject: '地理', year: '2009', province: '湖南'})
WITH q MATCH (p:Paper {name: '2009年高考地理试卷（全国卷Ⅰ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2011年高考地理试卷（新课标）（空白卷）.pdf', province: '湖南', subject: '地理', year: '2011', type: '空白卷', volume: '空白卷', preview: '2011年全国统一高考地理试卷（新课标）
一、选择题
日本某汽车公司在中国建有多个整车生产厂和零件生产厂．2011年3月11日东日
本大地震及随后的海啸、核辐射灾难，使该公司在灾区的工厂停产．受其影
响，该公司在中国的整车生产厂也被迫减产．据此完成1～2题．
1．（4分）该公司在中国建零部件生产厂，', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '湖南'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '地理', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '湖南_地理_2011_1', title: '一、选择题', subject: '地理', year: '2011', province: '湖南'})
WITH q MATCH (p:Paper {name: '2011年高考地理试卷（新课标）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_地理_2011_2', title: '1．（4分）该公司在中国建零部件生产厂，主要目的是（ ）', subject: '地理', year: '2011', province: '湖南'})
WITH q MATCH (p:Paper {name: '2011年高考地理试卷（新课标）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_地理_2011_3', title: '2．（4分）中国整车生产厂被迫减产是由于该公司在灾区有（ ）', subject: '地理', year: '2011', province: '湖南'})
WITH q MATCH (p:Paper {name: '2011年高考地理试卷（新课标）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_地理_2011_4', title: '6．（4分）图示区域内最大高差可能为（ ）', subject: '地理', year: '2011', province: '湖南'})
WITH q MATCH (p:Paper {name: '2011年高考地理试卷（新课标）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_地理_2011_5', title: '7．（4分）图中①②③④附近河水流速最快的是（ ）', subject: '地理', year: '2011', province: '湖南'})
WITH q MATCH (p:Paper {name: '2011年高考地理试卷（新课标）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2019年高考地理试卷（新课标Ⅰ）（解析卷）.pdf', province: '湖南', subject: '地理', year: '2019', type: '解析卷', volume: '解析卷', preview: '2019 年全国统一高考地理试卷（新课标Ⅰ）
参考答案与试题解析
一、选择题：本题共4小题，每小题12分，共44分．在每小题给出的四个选项中，只有
一项是符合题目要求的．
20世纪80年代开始，长江三角洲地区某县村办企业涌现，形成“村村冒烟”现象。2016
年该县开始实施村集体经济“抱团飞地”发展模', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '湖南'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '地理', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '湖南_地理_2019_1', title: '一、选择题：本题共4小题，每小题12分，共44分．在每小题给出的四个选项中，只有', subject: '地理', year: '2019', province: '湖南'})
WITH q MATCH (p:Paper {name: '2019年高考地理试卷（新课标Ⅰ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_地理_2019_2', title: '1．“村村冒烟”主要指的是当时该县村办企业（ ）', subject: '地理', year: '2019', province: '湖南'})
WITH q MATCH (p:Paper {name: '2019年高考地理试卷（新课标Ⅰ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_地理_2019_3', title: '3．“抱团飞地”发展模式，主要体现了（ ）', subject: '地理', year: '2019', province: '湖南'})
WITH q MATCH (p:Paper {name: '2019年高考地理试卷（新课标Ⅰ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2017年高考地理试卷（新课标Ⅰ）（解析卷）.pdf', province: '湖南', subject: '地理', year: '2017', type: '解析卷', volume: '解析卷', preview: '2017 年全国统一高考地理试卷（新课标Ⅰ）
参考答案与试题解析
一、选择题：本大题 11 小题，每个小题 4 分，满分 44 分．在每小题给出第四
个选项中，只有一项是符合题目要求的．
如图为我国东部地区某城市街道机动车道与两侧非机动车道绿化隔离带的景观
对比照片，拍摄于 2017 年 3 月 2', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '湖南'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '地理', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '湖南_地理_2017_1', title: '一、选择题：本大题 11 小题，每个小题 4 分，满分 44 分．在每小题给出第四', subject: '地理', year: '2017', province: '湖南'})
WITH q MATCH (p:Paper {name: '2017年高考地理试卷（新课标Ⅰ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_地理_2017_2', title: '1．当地的自然植被属于（ ）', subject: '地理', year: '2017', province: '湖南'})
WITH q MATCH (p:Paper {name: '2017年高考地理试卷（新课标Ⅰ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_地理_2017_3', title: '2．造成图示绿化隔离带景观差异的原因可能是该街道两侧（ ）', subject: '地理', year: '2017', province: '湖南'})
WITH q MATCH (p:Paper {name: '2017年高考地理试卷（新课标Ⅰ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2023年高考地理试卷（湖南）（解析卷）.pdf', province: '湖南', subject: '地理', year: '2023', type: '解析卷', volume: '解析卷', preview: '2023 湖南高考地理真题
一.选择题
服装制造商可以在全球范围内选择分包商，产品残次率是影响其选择的重要因素之一。在交货期允许
的情况下，洛杉矾时尚区内的韩国制造商更倾向选择代工厂位于东南亚的韩国分包商，而不是代工厂位于
拉丁美洲的分包商。东南亚服装生产所需的面料大多产自中国，面料生产所需的棉花来', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '湖南'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '地理', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '湖南_地理_2023_1', title: '一.选择题', subject: '地理', year: '2023', province: '湖南'})
WITH q MATCH (p:Paper {name: '2023年高考地理试卷（湖南）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_地理_2023_2', title: '1. 东南亚服装生产所需的面料大多产自中国，是因为中国（ ）', subject: '地理', year: '2023', province: '湖南'})
WITH q MATCH (p:Paper {name: '2023年高考地理试卷（湖南）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_地理_2023_3', title: '2. 时尚区内的韩国制造商更倾向选择代工厂位于东南亚的韩国分包商，最可能考虑的是（ ）', subject: '地理', year: '2023', province: '湖南'})
WITH q MATCH (p:Paper {name: '2023年高考地理试卷（湖南）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_地理_2023_4', title: '3. 海岛港口地域组合演变阶段的顺序是（ ）', subject: '地理', year: '2023', province: '湖南'})
WITH q MATCH (p:Paper {name: '2023年高考地理试卷（湖南）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_地理_2023_5', title: '4. 图中④示意的阶段，岛域内港口（ ）', subject: '地理', year: '2023', province: '湖南'})
WITH q MATCH (p:Paper {name: '2023年高考地理试卷（湖南）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2020年高考地理试卷（新课标Ⅰ）（解析卷）.pdf', province: '湖南', subject: '地理', year: '2020', type: '解析卷', volume: '解析卷', preview: '2020 年全国统一高考地理试卷（新课标Ⅰ）
参考答案与试题解析
一、选择题：本题共4小题，共44分。在每小题给出的四个选项中，只有一项是符合题目
要求的。
治沟造地是陕西省延安市对黄土高原的丘陵沟壑区，在传统打坝淤地的基础上，集耕地
营造、坝系修复、生态建设和新农村发展为一体的“田水路林村”综合整', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '湖南'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '地理', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '湖南_地理_2020_1', title: '一、选择题：本题共4小题，共44分。在每小题给出的四个选项中，只有一项是符合题目', subject: '地理', year: '2020', province: '湖南'})
WITH q MATCH (p:Paper {name: '2020年高考地理试卷（新课标Ⅰ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_地理_2020_2', title: '1．与传统的打坝淤地工程相比，治沟造地更加关注（ ）', subject: '地理', year: '2020', province: '湖南'})
WITH q MATCH (p:Paper {name: '2020年高考地理试卷（新课标Ⅰ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_地理_2020_3', title: '2．治沟造地对当地生产条件的改善主要体现在（ ）', subject: '地理', year: '2020', province: '湖南'})
WITH q MATCH (p:Paper {name: '2020年高考地理试卷（新课标Ⅰ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2014年高考地理试卷（新课标Ⅰ）（解析卷）.pdf', province: '湖南', subject: '地理', year: '2014', type: '解析卷', volume: '解析卷', preview: '2014 年全国统一高考地理试卷（新课标Ⅰ）
参考答案与试题解析
一、本卷共 4 小题．每小题 0 分．在每个小题给出的四个选项中，只有一项是
符合题目要求的．
太阳能光热电站（如图）通过数以十万计的反光版聚焦太阳能，给高塔顶端的锅
炉加热，产生蒸汽，驱动发电机发电．据此完成1﹣3题．
1．（4分）', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '湖南'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '地理', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '湖南_地理_2014_1', title: '一、本卷共 4 小题．每小题 0 分．在每个小题给出的四个选项中，只有一项是', subject: '地理', year: '2014', province: '湖南'})
WITH q MATCH (p:Paper {name: '2014年高考地理试卷（新课标Ⅰ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_地理_2014_2', title: '1．（4分）我国下列地区中，资源条件最适宜建太阳能光热电站的是（ ）', subject: '地理', year: '2014', province: '湖南'})
WITH q MATCH (p:Paper {name: '2014年高考地理试卷（新课标Ⅰ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2013年高考地理试卷（新课标Ⅰ）（解析卷）.pdf', province: '湖南', subject: '地理', year: '2013', type: '解析卷', volume: '解析卷', preview: '2013 年全国统一高考地理试卷（新课标Ⅰ）
参考答案与试题解析
一、选择题（共 4小题，每小题 0分，满分 0分）
哥伦比亚已经成为世界重要的鲜切花生产国．读图，完成1～3题．
1．（4 分）每年情人节（2 月 14 日），在美国销售的鲜切玫瑰花多来自哥伦比
亚．与美国相比，在此期间，哥伦比亚生产', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '湖南'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '地理', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '湖南_地理_2013_1', title: '一、选择题（共 4小题，每小题 0分，满分 0分）', subject: '地理', year: '2013', province: '湖南'})
WITH q MATCH (p:Paper {name: '2013年高考地理试卷（新课标Ⅰ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_地理_2013_2', title: '1．（4 分）每年情人节（2 月 14 日），在美国销售的鲜切玫瑰花多来自哥伦比', subject: '地理', year: '2013', province: '湖南'})
WITH q MATCH (p:Paper {name: '2013年高考地理试卷（新课标Ⅰ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_地理_2013_3', title: '2．（4分）哥伦比亚向美国运送鲜切玫瑰花宜采用（ ）', subject: '地理', year: '2013', province: '湖南'})
WITH q MATCH (p:Paper {name: '2013年高考地理试卷（新课标Ⅰ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2021年高考地理试卷（湖南）（空白卷）.pdf', province: '湖南', subject: '地理', year: '2021', type: '空白卷', volume: '空白卷', preview: '2021 年普通高中学业水平考试选择性考试
地理
一、选择题：本题共 16 小题，每小题 3 分，共 48 分，在每小题给出的四个选项中，只有一
项是符合题目要求的。
永久迁移是指户籍发生改变的人口迁移类型；务工迁移是指离开户籍地外出务工的人口迁移类型（不
包括永久迁移）。下图示意1990~2005', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '湖南'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '地理', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '湖南_地理_2021_1', title: '一、选择题：本题共 16 小题，每小题 3 分，共 48 分，在每小题给出的四个选项中，只有一', subject: '地理', year: '2021', province: '湖南'})
WITH q MATCH (p:Paper {name: '2021年高考地理试卷（湖南）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_地理_2021_2', title: '1. 下列叙述正确的是（ ）', subject: '地理', year: '2021', province: '湖南'})
WITH q MATCH (p:Paper {name: '2021年高考地理试卷（湖南）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_地理_2021_3', title: '2. 2010年后务工迁移人数明显下降的主要原因是（ ）', subject: '地理', year: '2021', province: '湖南'})
WITH q MATCH (p:Paper {name: '2021年高考地理试卷（湖南）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_地理_2021_4', title: '3. 调查发现,开封夜市摊贩一般具有“短距离流动”的特征,主要考虑（ ）', subject: '地理', year: '2021', province: '湖南'})
WITH q MATCH (p:Paper {name: '2021年高考地理试卷（湖南）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_地理_2021_5', title: '4. 大量摊贩经营活动集聚于夜市,可以（ ）', subject: '地理', year: '2021', province: '湖南'})
WITH q MATCH (p:Paper {name: '2021年高考地理试卷（湖南）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2012年高考地理试卷（新课标）（解析卷）.pdf', province: '湖南', subject: '地理', year: '2012', type: '解析卷', volume: '解析卷', preview: '2012 年全国统一高考地理试卷（新课标）
参考答案与试题解析
一、选择题（共 5小题，每小题 0分，满分 0分）
随着工业化、城市化的飞速发展，耕地不断被挤占，但 2004 年以来，我国粮食
总量仍连续增长．据此完成1～3题．
1．（4分）近年来，我国粮食总产量连续增长的主要原因是（ ）
A．扩大', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '湖南'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '地理', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '湖南_地理_2012_1', title: '一、选择题（共 5小题，每小题 0分，满分 0分）', subject: '地理', year: '2012', province: '湖南'})
WITH q MATCH (p:Paper {name: '2012年高考地理试卷（新课标）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_地理_2012_2', title: '1．（4分）近年来，我国粮食总产量连续增长的主要原因是（ ）', subject: '地理', year: '2012', province: '湖南'})
WITH q MATCH (p:Paper {name: '2012年高考地理试卷（新课标）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_地理_2012_3', title: '2．（4 分）改革开放以来，下列粮食主要产区在全国商品粮食生产中的地位下', subject: '地理', year: '2012', province: '湖南'})
WITH q MATCH (p:Paper {name: '2012年高考地理试卷（新课标）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_地理_2012_4', title: '3．（4 分）河南省和黑龙江省都是我国产粮大省．两省相比，黑龙江省粮食商', subject: '地理', year: '2012', province: '湖南'})
WITH q MATCH (p:Paper {name: '2012年高考地理试卷（新课标）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2010年高考地理试卷（全国卷Ⅰ）（解析卷）.pdf', province: '湖南', subject: '地理', year: '2010', type: '解析卷', volume: '全国卷Ⅰ', preview: '2010年全国统一高考地理试卷（全国卷Ⅰ）
一、选择题（共4小题，每小题0分，满分0分）
江苏北部沿海滩涂围垦，需要经过筑堤、挖渠等工程措施和种植适应性植物等
生物措施改造，4～5年后才能种植粮食作物．据此完成1～2题．
1．（4分）改造滩涂所种植的适应性植物应（ ）
A．耐湿 B．耐旱 C．耐盐 ', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '湖南'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '地理', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '湖南_地理_2010_1', title: '一、选择题（共4小题，每小题0分，满分0分）', subject: '地理', year: '2010', province: '湖南'})
WITH q MATCH (p:Paper {name: '2010年高考地理试卷（全国卷Ⅰ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_地理_2010_2', title: '1．（4分）改造滩涂所种植的适应性植物应（ ）', subject: '地理', year: '2010', province: '湖南'})
WITH q MATCH (p:Paper {name: '2010年高考地理试卷（全国卷Ⅰ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_地理_2010_3', title: '2．（4分）若缩短滩涂改造时间，需投入更多的（ ）', subject: '地理', year: '2010', province: '湖南'})
WITH q MATCH (p:Paper {name: '2010年高考地理试卷（全国卷Ⅰ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_地理_2010_4', title: '3．（4分）王女士此次购买的衬衣，在M公司员工完成的环节是（ ）', subject: '地理', year: '2010', province: '湖南'})
WITH q MATCH (p:Paper {name: '2010年高考地理试卷（全国卷Ⅰ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_地理_2010_5', title: '4．（4分）M公司的产品销售依靠（ ）', subject: '地理', year: '2010', province: '湖南'})
WITH q MATCH (p:Paper {name: '2010年高考地理试卷（全国卷Ⅰ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2022年高考地理试卷（湖南）（解析卷）.pdf', province: '湖南', subject: '地理', year: '2022', type: '解析卷', volume: '解析卷', preview: '湖南省 2022 年普通高中学业水平选择性考试
地理
注意事项：
1．答卷前，考生务必格自己的姓名、准考证号填写在本试卷和答题卡上。
2．回答选择题时，选出每小题答案后，用铅笔把答题卡上对应题目的答案标号涂黑。如需
改动，用橡皮擦干净后，再选涂其他答案标号，回答非选择题时，将答案写在答题卡上。写
在', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '湖南'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '地理', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '湖南_地理_2022_1', title: '1．答卷前，考生务必格自己的姓名、准考证号填写在本试卷和答题卡上。', subject: '地理', year: '2022', province: '湖南'})
WITH q MATCH (p:Paper {name: '2022年高考地理试卷（湖南）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_地理_2022_2', title: '2．回答选择题时，选出每小题答案后，用铅笔把答题卡上对应题目的答案标号涂黑。如需', subject: '地理', year: '2022', province: '湖南'})
WITH q MATCH (p:Paper {name: '2022年高考地理试卷（湖南）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_地理_2022_3', title: '改动，用橡皮擦干净后，再选涂其他答案标号，回答非选择题时，将答案写在答题卡上。写', subject: '地理', year: '2022', province: '湖南'})
WITH q MATCH (p:Paper {name: '2022年高考地理试卷（湖南）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_地理_2022_4', title: '3．考试结束后，将本试卷和答题卡一并交回。', subject: '地理', year: '2022', province: '湖南'})
WITH q MATCH (p:Paper {name: '2022年高考地理试卷（湖南）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_地理_2022_5', title: '一、选择题：本题共 16 小题，每小题 3 分，共 48 分。在每小题给出的四个选项中，只有一', subject: '地理', year: '2022', province: '湖南'})
WITH q MATCH (p:Paper {name: '2022年高考地理试卷（湖南）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2024年高考地理试卷（湖南）（空白卷）.pdf', province: '湖南', subject: '地理', year: '2024', type: '空白卷', volume: '空白卷', preview: '湖南省 2024 年普通高中学业水平选择性考试
地理
本试卷满分 100分，考试时间 75分钟。
一、选择题：本题共 16 小题，每小题 3 分，共 48 分。在每小题给出的四个选项中，只有一
项是符合题目要求的。
石牌镇地处汉江之滨，古时商贾云集，舟楫繁忙，南来北往的人们路过这里都会吃上一碗豆腐。', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '湖南'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '地理', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '湖南_地理_2024_1', title: '一、选择题：本题共 16 小题，每小题 3 分，共 48 分。在每小题给出的四个选项中，只有一', subject: '地理', year: '2024', province: '湖南'})
WITH q MATCH (p:Paper {name: '2024年高考地理试卷（湖南）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_地理_2024_2', title: '1. 古时石牌镇豆腐声名远播，主要得益于（ ）', subject: '地理', year: '2024', province: '湖南'})
WITH q MATCH (p:Paper {name: '2024年高考地理试卷（湖南）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_地理_2024_3', title: '2. 当前有些“石牌豆腐郎”将豆制品加工企业迁回家乡发展，看重的是该镇的（ ）', subject: '地理', year: '2024', province: '湖南'})
WITH q MATCH (p:Paper {name: '2024年高考地理试卷（湖南）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_地理_2024_4', title: '3. 随着产业规模的扩大，为保障“石牌豆腐”品质，可采取的有效举措是（ ）', subject: '地理', year: '2024', province: '湖南'})
WITH q MATCH (p:Paper {name: '2024年高考地理试卷（湖南）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_地理_2024_5', title: '5. 图示统计人口的年龄结构可能会给乡村振兴带来的影响是（ ）', subject: '地理', year: '2024', province: '湖南'})
WITH q MATCH (p:Paper {name: '2024年高考地理试卷（湖南）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2008年高考地理试卷（全国卷Ⅰ）（空白卷）.pdf', province: '湖南', subject: '地理', year: '2008', type: '空白卷', volume: '全国卷Ⅰ', preview: '2008年普通高等学校招生全国统一考试(全国卷Ⅰ)
文科综合（地理部分）
本试卷分第Ⅰ卷（选择题）和第Ⅱ卷两部分。第Ⅰ卷l至7页，第Ⅱ卷8至12页，共300分。
考生注意：
1．答题前，考生务必将自己的准考证号、姓名填写在答题卡上。考生要认真核对
答题卡上粘贴的条形码的“准考证号、姓名、考试科目”与', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '湖南'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '地理', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '湖南_地理_2008_1', title: '本试卷分第Ⅰ卷（选择题）和第Ⅱ卷两部分。第Ⅰ卷l至7页，第Ⅱ卷8至12页，共300分。', subject: '地理', year: '2008', province: '湖南'})
WITH q MATCH (p:Paper {name: '2008年高考地理试卷（全国卷Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_地理_2008_2', title: '1．答题前，考生务必将自己的准考证号、姓名填写在答题卡上。考生要认真核对', subject: '地理', year: '2008', province: '湖南'})
WITH q MATCH (p:Paper {name: '2008年高考地理试卷（全国卷Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_地理_2008_3', title: '2．第Ⅰ卷每小题选出答案后，用2B铅笔把答题卡上对应题目的答案标号涂黑，如需', subject: '地理', year: '2008', province: '湖南'})
WITH q MATCH (p:Paper {name: '2008年高考地理试卷（全国卷Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_地理_2008_4', title: '3．考试结束，监考员将试题卷、答题卡一并收回。', subject: '地理', year: '2008', province: '湖南'})
WITH q MATCH (p:Paper {name: '2008年高考地理试卷（全国卷Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_地理_2008_5', title: '（选择题）', subject: '地理', year: '2008', province: '湖南'})
WITH q MATCH (p:Paper {name: '2008年高考地理试卷（全国卷Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2016年高考地理试卷（新课标Ⅰ）（空白卷）.pdf', province: '湖南', subject: '地理', year: '2016', type: '空白卷', volume: '空白卷', preview: '2016 年全国统一高考地理试卷（新课标Ⅰ）
一、本卷 11 个小题，每题 4 分，满 44 分．在每小题给出的四个选项中，只有
一项是符合题目要求的．
我国是世界闻名的陶瓷古国，明清时期，“瓷都”景德镇是全国的瓷业中心，产品
远销海内外，20世纪80年代初，广东省佛山市率先引进国外现代化陶瓷生产
', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '湖南'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '地理', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '湖南_地理_2016_1', title: '一、本卷 11 个小题，每题 4 分，满 44 分．在每小题给出的四个选项中，只有', subject: '地理', year: '2016', province: '湖南'})
WITH q MATCH (p:Paper {name: '2016年高考地理试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_地理_2016_2', title: '1．（4分）与景德镇相比，20世纪80年代佛山瓷业迅速发展的主要原因是（ ）', subject: '地理', year: '2016', province: '湖南'})
WITH q MATCH (p:Paper {name: '2016年高考地理试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_地理_2016_3', title: '2．（4分）促使佛山陶瓷产业向外转移的主要原因是佛山（ ）', subject: '地理', year: '2016', province: '湖南'})
WITH q MATCH (p:Paper {name: '2016年高考地理试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_地理_2016_4', title: '3．（4分）景德镇吸引佛山陶瓷产业转移的主要优势是（ ）', subject: '地理', year: '2016', province: '湖南'})
WITH q MATCH (p:Paper {name: '2016年高考地理试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_地理_2016_5', title: '7．（4分）在任一条贝壳堤的形成过程中，海岸线（ ）', subject: '地理', year: '2016', province: '湖南'})
WITH q MATCH (p:Paper {name: '2016年高考地理试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2018年高考地理试卷（新课标Ⅰ）（解析卷）.pdf', province: '湖南', subject: '地理', year: '2018', type: '解析卷', volume: '解析卷', preview: '2018 年全国统一高考地理试卷（新课标Ⅰ）
参考答案与试题解析
一、选择题：本题共 4 小题，每小题 12 分，共 44 分．在每小题给出的四个选
项中，只有一项是符合题目要求的．
近年来，世界上出现了将精密机械设备的组装或加工工厂建在地下的现象。例如，
日本岐阜某激光加工机组装企业和我国大连某数', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '湖南'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '地理', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '湖南_地理_2018_1', title: '一、选择题：本题共 4 小题，每小题 12 分，共 44 分．在每小题给出的四个选', subject: '地理', year: '2018', province: '湖南'})
WITH q MATCH (p:Paper {name: '2018年高考地理试卷（新课标Ⅰ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '湖南_地理_2018_2', title: '1．将生产精密机械设备的工厂建在地下有利于（ ）', subject: '地理', year: '2018', province: '湖南'})
WITH q MATCH (p:Paper {name: '2018年高考地理试卷（新课标Ⅰ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2017年高考生物试卷（新课标Ⅲ）（解析卷）.pdf', province: '贵州', subject: '生物', year: '2017', type: '解析卷', volume: '解析卷', preview: '2017 年全国高考统一生物试卷（新课标Ⅲ）
参考答案与试题解析
一、选择题：本题共 6个小题，每小题 6分，共 36分．在每小题给出的四个选
项中，只有一项是符合题目要求的．
1．（6分）下列关于真核细胞中转录的叙述，错误的是（ ）
A．tRNA、rRNA和mRNA都从DNA转录而来
B．同一细胞', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '贵州'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '生物', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '贵州_生物_2017_1', title: '一、选择题：本题共 6个小题，每小题 6分，共 36分．在每小题给出的四个选', subject: '生物', year: '2017', province: '贵州'})
WITH q MATCH (p:Paper {name: '2017年高考生物试卷（新课标Ⅲ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_生物_2017_2', title: '1．（6分）下列关于真核细胞中转录的叙述，错误的是（ ）', subject: '生物', year: '2017', province: '贵州'})
WITH q MATCH (p:Paper {name: '2017年高考生物试卷（新课标Ⅲ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_生物_2017_3', title: '2．（6分）下列与细胞相关的叙述，错误的是（ ）', subject: '生物', year: '2017', province: '贵州'})
WITH q MATCH (p:Paper {name: '2017年高考生物试卷（新课标Ⅲ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2012年高考生物试卷（大纲版）（空白卷）.pdf', province: '贵州', subject: '生物', year: '2012', type: '空白卷', volume: '空白卷', preview: '2012 年全国统一高考生物试卷（大纲版）
一、选择题（共 5小题）
1．下列关于膝跳反射的叙述，错误的是（ ）
A．反射活动由一定的刺激引起
B．反射活动中兴奋在突触处双向传递
C．反射活动的发生需要反射弧结构完整
D．反射活动中需要神经递质参与兴奋的传递
2．下列关于叶绿体和线粒体的叙述，正确的', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '贵州'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '生物', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '贵州_生物_2012_1', title: '一、选择题（共 5小题）', subject: '生物', year: '2012', province: '贵州'})
WITH q MATCH (p:Paper {name: '2012年高考生物试卷（大纲版）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_生物_2012_2', title: '1．下列关于膝跳反射的叙述，错误的是（ ）', subject: '生物', year: '2012', province: '贵州'})
WITH q MATCH (p:Paper {name: '2012年高考生物试卷（大纲版）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_生物_2012_3', title: '2．下列关于叶绿体和线粒体的叙述，正确的是（ ）', subject: '生物', year: '2012', province: '贵州'})
WITH q MATCH (p:Paper {name: '2012年高考生物试卷（大纲版）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_生物_2012_4', title: '3．一块农田中有豌豆、杂草、田鼠和土壤微生物等生物，其中属于竞争关系的', subject: '生物', year: '2012', province: '贵州'})
WITH q MATCH (p:Paper {name: '2012年高考生物试卷（大纲版）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_生物_2012_5', title: '4．下列关于森林群落垂直结构的叙述错误的是（ ）', subject: '生物', year: '2012', province: '贵州'})
WITH q MATCH (p:Paper {name: '2012年高考生物试卷（大纲版）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2023年高考生物试卷（全国甲卷）（空白卷）.pdf', province: '贵州', subject: '生物', year: '2023', type: '空白卷', volume: '全国甲卷', preview: '2023 年普通高等学校招生全国统一考试·全国甲卷
理科综合（生物部分）
一、选择题
1. 物质输入和输出细胞都需要经过细胞膜。下列有关人体内物质跨膜运输的叙述，正确的是（ ）
A. 乙醇是有机物，不能通过自由扩散方式跨膜进入细胞
B. 血浆中的K+进入红细胞时需要载体蛋白并消耗ATP
C. 抗体在', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '贵州'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '生物', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '贵州_生物_2023_1', title: '一、选择题', subject: '生物', year: '2023', province: '贵州'})
WITH q MATCH (p:Paper {name: '2023年高考生物试卷（全国甲卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_生物_2023_2', title: '1. 物质输入和输出细胞都需要经过细胞膜。下列有关人体内物质跨膜运输的叙述，正确的是（ ）', subject: '生物', year: '2023', province: '贵州'})
WITH q MATCH (p:Paper {name: '2023年高考生物试卷（全国甲卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_生物_2023_3', title: '2. 植物激素是一类由植物体产生的，对植物的生长发育有显著影响的微量有机物，下列关于植物激素的叙', subject: '生物', year: '2023', province: '贵州'})
WITH q MATCH (p:Paper {name: '2023年高考生物试卷（全国甲卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_生物_2023_4', title: '3. 中枢神经系统对维持人体内环境的稳态具有重要作用。下列关于人体中枢的叙述，错误的是（ ）', subject: '生物', year: '2023', province: '贵州'})
WITH q MATCH (p:Paper {name: '2023年高考生物试卷（全国甲卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_生物_2023_5', title: '5. 在生态系统中，生产者所固定的能量可以沿着食物链传递，食物链中的每个环节即为一个营养级。下列', subject: '生物', year: '2023', province: '贵州'})
WITH q MATCH (p:Paper {name: '2023年高考生物试卷（全国甲卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2010年高考生物试卷（全国卷Ⅱ）（解析卷）.pdf', province: '贵州', subject: '生物', year: '2010', type: '解析卷', volume: '全国卷Ⅱ', preview: '2010年全国统一高考生物试卷（全国卷Ⅱ）
参考答案与试题解析
一、选择题（共5小题，每小题3分，满分15分）
1．（3分）下列关于高尔基体的叙述，错误的是（ ）
A．高尔基体膜具有流动性
B．抗体从合成到分泌不经过高尔基体
C．高尔基体膜主要由磷脂和蛋白质构成
D．高尔基体具有对蛋白质进行加工的功', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '贵州'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '生物', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '贵州_生物_2010_1', title: '一、选择题（共5小题，每小题3分，满分15分）', subject: '生物', year: '2010', province: '贵州'})
WITH q MATCH (p:Paper {name: '2010年高考生物试卷（全国卷Ⅱ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_生物_2010_2', title: '1．（3分）下列关于高尔基体的叙述，错误的是（ ）', subject: '生物', year: '2010', province: '贵州'})
WITH q MATCH (p:Paper {name: '2010年高考生物试卷（全国卷Ⅱ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2014年高考生物试卷（新课标Ⅱ）（解析卷）.pdf', province: '贵州', subject: '生物', year: '2014', type: '解析卷', volume: '解析卷', preview: '2014 年全国统一高考生物试卷（新课标Ⅱ）
参考答案与试题解析
一、选择题：本题共 6 小题，每小题 6 分，在每小题给出的四个选项中，只有
一项是符合题目要求的．
1．（6分）关于细胞的叙述，错误的是（ ）
A．植物细胞的胞间连丝具有物质运输的作用
B．动物细胞间的黏着性与细胞膜上的糖蛋白有关
', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '贵州'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '生物', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '贵州_生物_2014_1', title: '一、选择题：本题共 6 小题，每小题 6 分，在每小题给出的四个选项中，只有', subject: '生物', year: '2014', province: '贵州'})
WITH q MATCH (p:Paper {name: '2014年高考生物试卷（新课标Ⅱ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_生物_2014_2', title: '1．（6分）关于细胞的叙述，错误的是（ ）', subject: '生物', year: '2014', province: '贵州'})
WITH q MATCH (p:Paper {name: '2014年高考生物试卷（新课标Ⅱ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2009年高考生物试卷（全国卷Ⅱ）（空白卷）.pdf', province: '贵州', subject: '生物', year: '2009', type: '空白卷', volume: '全国卷Ⅱ', preview: '2009 年全国统一高考生物试卷（全国卷Ⅱ）
一、选择题（本题共 5 小题．在每小题给出的四个选项中，只有一项是符合题
目要求的．）
1．（6分）下列关于细胞呼吸的叙述，错误的是（ ）
A．细胞呼吸必须在酶的催化下进行
B．人体硬骨组织细胞也进行呼吸
C．酵母菌可以进行有氧呼吸和无氧呼吸
D．叶肉细', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '贵州'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '生物', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '贵州_生物_2009_1', title: '一、选择题（本题共 5 小题．在每小题给出的四个选项中，只有一项是符合题', subject: '生物', year: '2009', province: '贵州'})
WITH q MATCH (p:Paper {name: '2009年高考生物试卷（全国卷Ⅱ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_生物_2009_2', title: '1．（6分）下列关于细胞呼吸的叙述，错误的是（ ）', subject: '生物', year: '2009', province: '贵州'})
WITH q MATCH (p:Paper {name: '2009年高考生物试卷（全国卷Ⅱ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_生物_2009_3', title: '2．（6 分）人体甲状旁腺分泌甲状旁腺素，当人体血钙浓度下降时，甲状旁腺', subject: '生物', year: '2009', province: '贵州'})
WITH q MATCH (p:Paper {name: '2009年高考生物试卷（全国卷Ⅱ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_生物_2009_4', title: '3．（6分）下列有关哺乳动物个体发育的叙述，错误的是（ ）', subject: '生物', year: '2009', province: '贵州'})
WITH q MATCH (p:Paper {name: '2009年高考生物试卷（全国卷Ⅱ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_生物_2009_5', title: '4．（6分）为防止甲型H1N1', subject: '生物', year: '2009', province: '贵州'})
WITH q MATCH (p:Paper {name: '2009年高考生物试卷（全国卷Ⅱ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2019年高考生物试卷（新课标Ⅲ）（解析卷）.pdf', province: '贵州', subject: '生物', year: '2019', type: '解析卷', volume: '解析卷', preview: '2019 年全国统一高考生物试卷（新课标Ⅲ）
参考答案与试题解析
一、选择题：本题共6个小题，每小题6分，共36分。在每小题给出的四个选项中，只有
一项是符合题目要求的。
1．（6分）下列有关高尔基体、线粒体和叶绿体的叙述，正确的是（ ）
A．三者都存在于蓝藻中
B．三者都含有DNA
C．三者都是A', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '贵州'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '生物', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '贵州_生物_2019_1', title: '一、选择题：本题共6个小题，每小题6分，共36分。在每小题给出的四个选项中，只有', subject: '生物', year: '2019', province: '贵州'})
WITH q MATCH (p:Paper {name: '2019年高考生物试卷（新课标Ⅲ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_生物_2019_2', title: '1．（6分）下列有关高尔基体、线粒体和叶绿体的叙述，正确的是（ ）', subject: '生物', year: '2019', province: '贵州'})
WITH q MATCH (p:Paper {name: '2019年高考生物试卷（新课标Ⅲ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_生物_2019_3', title: '2．（6分）下列与真核生物细胞核有关的叙述，错误的是（ ）', subject: '生物', year: '2019', province: '贵州'})
WITH q MATCH (p:Paper {name: '2019年高考生物试卷（新课标Ⅲ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2022年高考生物试卷（全国甲卷）（解析卷）.pdf', province: '贵州', subject: '生物', year: '2022', type: '解析卷', volume: '全国甲卷', preview: '2022 年普通高等学校招生全国统一考试
理科综合能力测试
一、选择题
1. 钙在骨骼生长和肌肉收缩等过程中发挥重要作用。晒太阳有助于青少年骨骼生长，预防老年人骨质疏
松。下列叙述错误的是（ ）
A. 细胞中有以无机离子形式存在的钙
B. 人体内Ca2+可自由通过细胞膜的磷脂双分子层
C. 适当补充', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '贵州'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '生物', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '贵州_生物_2022_1', title: '一、选择题', subject: '生物', year: '2022', province: '贵州'})
WITH q MATCH (p:Paper {name: '2022年高考生物试卷（全国甲卷）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_生物_2022_2', title: '1. 钙在骨骼生长和肌肉收缩等过程中发挥重要作用。晒太阳有助于青少年骨骼生长，预防老年人骨质疏', subject: '生物', year: '2022', province: '贵州'})
WITH q MATCH (p:Paper {name: '2022年高考生物试卷（全国甲卷）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_生物_2022_3', title: '2. 植物成熟叶肉细胞的', subject: '生物', year: '2022', province: '贵州'})
WITH q MATCH (p:Paper {name: '2022年高考生物试卷（全国甲卷）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2018年高考生物试卷（新课标Ⅲ）（解析卷）.pdf', province: '贵州', subject: '生物', year: '2018', type: '解析卷', volume: '解析卷', preview: '2018 年全国统一高考生物试卷（新课标Ⅲ）
参考答案与试题解析
一、选择题:本题共 6题,每小题 6分,共 36分。在每小题给出的四个选项中,只有
一项是符合题目要求的
1．（6分）下列研究工作中由我国科学家完成的是（ ）
A．以豌豆为材料发现性状遗传规律的实验
B．用小球藻发现光合作用暗反应途径', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '贵州'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '生物', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '贵州_生物_2018_1', title: '一、选择题:本题共 6题,每小题 6分,共 36分。在每小题给出的四个选项中,只有', subject: '生物', year: '2018', province: '贵州'})
WITH q MATCH (p:Paper {name: '2018年高考生物试卷（新课标Ⅲ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_生物_2018_2', title: '1．（6分）下列研究工作中由我国科学家完成的是（ ）', subject: '生物', year: '2018', province: '贵州'})
WITH q MATCH (p:Paper {name: '2018年高考生物试卷（新课标Ⅲ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2008年高考生物试卷（全国卷Ⅱ）（解析卷）.pdf', province: '贵州', subject: '生物', year: '2008', type: '解析卷', volume: '全国卷Ⅱ', preview: '2008年全国统一高考生物试卷（全国卷Ⅱ）
参考答案与试题解析
一、选择题（本题共5小题．在每小题给出的四个选项中，只有一项是符合题
目要求的．）
1．（6分）为了确定某种矿质元素是否是植物的必需元素，应采用的方法是（
）
A．检测正常叶片中该矿质元素的含量
B．分析根系对该矿质元素的吸收过程
C．', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '贵州'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '生物', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '贵州_生物_2008_1', title: '一、选择题（本题共5小题．在每小题给出的四个选项中，只有一项是符合题', subject: '生物', year: '2008', province: '贵州'})
WITH q MATCH (p:Paper {name: '2008年高考生物试卷（全国卷Ⅱ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_生物_2008_2', title: '1．（6分）为了确定某种矿质元素是否是植物的必需元素，应采用的方法是（', subject: '生物', year: '2008', province: '贵州'})
WITH q MATCH (p:Paper {name: '2008年高考生物试卷（全国卷Ⅱ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2011年高考生物试卷（大纲版，全国Ⅱ卷）（解析卷）.pdf', province: '贵州', subject: '生物', year: '2011', type: '解析卷', volume: '大纲版，全国Ⅱ卷', preview: '2011年全国统一高考生物试卷（大纲版）
参考答案与试题解析
一、选择题
1．（6分）下列能说明某细胞已经发生分化的是（ ）
A．进行ATP的合成 B．进行mRNA的合成
C．存在血红蛋白 D．存在纤维蛋白原基因
【考点】51：细胞的分化．
菁优网版权所有
【分析】细胞分化是指在个体发育中，由一个或', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '贵州'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '生物', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '贵州_生物_2011_1', title: '一、选择题', subject: '生物', year: '2011', province: '贵州'})
WITH q MATCH (p:Paper {name: '2011年高考生物试卷（大纲版，全国Ⅱ卷）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_生物_2011_2', title: '1．（6分）下列能说明某细胞已经发生分化的是（ ）', subject: '生物', year: '2011', province: '贵州'})
WITH q MATCH (p:Paper {name: '2011年高考生物试卷（大纲版，全国Ⅱ卷）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2020年高考生物试卷（新课标Ⅲ）（空白卷）.pdf', province: '贵州', subject: '生物', year: '2020', type: '空白卷', volume: '空白卷', preview: '2020 年全国统一高考生物试卷（新课标Ⅲ）
一、选择题：本题共6小题，每小题6分，共36分。在每小题给出的四个选项中，只有一
项是符合题目要求的。
1．（6分）关于真核生物的遗传信息及其传递的叙述，错误的是 （ ）
A．遗传信息可以从DNA流向RNA，也可以从RNA流向蛋白质
B．细胞中以DNA的', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '贵州'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '生物', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '贵州_生物_2020_1', title: '一、选择题：本题共6小题，每小题6分，共36分。在每小题给出的四个选项中，只有一', subject: '生物', year: '2020', province: '贵州'})
WITH q MATCH (p:Paper {name: '2020年高考生物试卷（新课标Ⅲ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_生物_2020_2', title: '1．（6分）关于真核生物的遗传信息及其传递的叙述，错误的是 （ ）', subject: '生物', year: '2020', province: '贵州'})
WITH q MATCH (p:Paper {name: '2020年高考生物试卷（新课标Ⅲ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_生物_2020_3', title: '2．（6分）取燕麦胚芽鞘切段，随机分成三组，第1组置于一定浓度的蔗糖（Suc）溶液中', subject: '生物', year: '2020', province: '贵州'})
WITH q MATCH (p:Paper {name: '2020年高考生物试卷（新课标Ⅲ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_生物_2020_4', title: '3．（6分）细胞', subject: '生物', year: '2020', province: '贵州'})
WITH q MATCH (p:Paper {name: '2020年高考生物试卷（新课标Ⅲ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_生物_2020_5', title: '4．（6分）下列有关人体免疫调节的叙述，合理的是（ ）', subject: '生物', year: '2020', province: '贵州'})
WITH q MATCH (p:Paper {name: '2020年高考生物试卷（新课标Ⅲ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2021年高考生物试卷（全国甲卷）（空白卷）.pdf', province: '贵州', subject: '生物', year: '2021', type: '空白卷', volume: '全国甲卷', preview: '2021年普通高等学校招生全国统一考试
理科综合能力测试·生物部分
注意事项：
1．答卷前，考生务必将自己的姓名、准考证号填写在答题卡上。
2．回答选择题时，选出每小题答案后，用铅笔把答题卡上对应题目的答案标号涂黑。如需改动，用橡皮
擦干净后，再选涂其他答案标号。回答非选择题时，将答案写在答题卡上。', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '贵州'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '生物', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '贵州_生物_2021_1', title: '1．答卷前，考生务必将自己的姓名、准考证号填写在答题卡上。', subject: '生物', year: '2021', province: '贵州'})
WITH q MATCH (p:Paper {name: '2021年高考生物试卷（全国甲卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_生物_2021_2', title: '2．回答选择题时，选出每小题答案后，用铅笔把答题卡上对应题目的答案标号涂黑。如需改动，用橡皮', subject: '生物', year: '2021', province: '贵州'})
WITH q MATCH (p:Paper {name: '2021年高考生物试卷（全国甲卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_生物_2021_3', title: '擦干净后，再选涂其他答案标号。回答非选择题时，将答案写在答题卡上。写在本试卷上无效。', subject: '生物', year: '2021', province: '贵州'})
WITH q MATCH (p:Paper {name: '2021年高考生物试卷（全国甲卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_生物_2021_4', title: '3．考试结束后，将本试卷和答题卡一并交回。', subject: '生物', year: '2021', province: '贵州'})
WITH q MATCH (p:Paper {name: '2021年高考生物试卷（全国甲卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_生物_2021_5', title: '一、选择题：本题共13小题，每小题6分，共78分。在每小题给出的四个选项中，只有一项', subject: '生物', year: '2021', province: '贵州'})
WITH q MATCH (p:Paper {name: '2021年高考生物试卷（全国甲卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2015年高考生物试卷（新课标Ⅱ）（解析卷）.pdf', province: '贵州', subject: '生物', year: '2015', type: '解析卷', volume: '解析卷', preview: '2015 年全国统一高考生物试卷（新课标Ⅱ）
参考答案与试题解析
一、选择题（本题共 6 小题，每小题 6 分，在每小题给出的四个选项中，只有
一项是符合题目要求的）
1．（6分）将三组生理状态相同的某植物幼根分别培养在含有相同培养液的密闭
培养瓶中，一段时间后，测定根吸收某一矿质元素离子的量。培养', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '贵州'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '生物', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '贵州_生物_2015_1', title: '一、选择题（本题共 6 小题，每小题 6 分，在每小题给出的四个选项中，只有', subject: '生物', year: '2015', province: '贵州'})
WITH q MATCH (p:Paper {name: '2015年高考生物试卷（新课标Ⅱ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_生物_2015_2', title: '1．（6分）将三组生理状态相同的某植物幼根分别培养在含有相同培养液的密闭', subject: '生物', year: '2015', province: '贵州'})
WITH q MATCH (p:Paper {name: '2015年高考生物试卷（新课标Ⅱ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2016年高考生物试卷（新课标Ⅲ）（空白卷）.pdf', province: '贵州', subject: '生物', year: '2016', type: '空白卷', volume: '空白卷', preview: '2016 年全国统一高考生物试卷（新课标Ⅲ）
一、选择题（共 6小题，每小题 3分，满分 18分）
1．（3分）下列有关细胞膜的叙述，正确的是（ ）
A．细胞膜两侧的离子浓度差是通过自由扩散实现的
B．细胞膜与线粒体膜、核膜中所含蛋白质的功能相同
C．分泌蛋白分泌到细胞外的过程存在膜脂的流动现象
D', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '贵州'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '生物', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '贵州_生物_2016_1', title: '一、选择题（共 6小题，每小题 3分，满分 18分）', subject: '生物', year: '2016', province: '贵州'})
WITH q MATCH (p:Paper {name: '2016年高考生物试卷（新课标Ⅲ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_生物_2016_2', title: '1．（3分）下列有关细胞膜的叙述，正确的是（ ）', subject: '生物', year: '2016', province: '贵州'})
WITH q MATCH (p:Paper {name: '2016年高考生物试卷（新课标Ⅲ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_生物_2016_3', title: '2．（3分）在前人进行的下列研究中，采用的核心技术相同（或相似）的一组是', subject: '生物', year: '2016', province: '贵州'})
WITH q MATCH (p:Paper {name: '2016年高考生物试卷（新课标Ⅲ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_生物_2016_4', title: '3．（3分）下列有关动物水盐平衡调节的叙述，错误的是（ ）', subject: '生物', year: '2016', province: '贵州'})
WITH q MATCH (p:Paper {name: '2016年高考生物试卷（新课标Ⅲ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_生物_2016_5', title: '4．（3 分）为了探究生长素的作用，将去尖端的玉米胚芽鞘切段随机', subject: '生物', year: '2016', province: '贵州'})
WITH q MATCH (p:Paper {name: '2016年高考生物试卷（新课标Ⅲ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2013年高考生物试卷（新课标Ⅱ）（解析卷）.pdf', province: '贵州', subject: '生物', year: '2013', type: '解析卷', volume: '解析卷', preview: '2013 年全国统一高考生物试卷（新课标Ⅱ）
参考答案与试题解析
一、选择题（共 6小题，每小题 6分，满分 36分）
1．（6分）关于DNA和RNA的叙述，正确的是（ ）
A．DNA有氢键，RNA没有氢键
B．一种病毒同时含有DNA和RNA
C．大肠杆菌和酵母菌中既有DNA 也有RNA
D．叶绿体', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '贵州'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '生物', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '贵州_生物_2013_1', title: '一、选择题（共 6小题，每小题 6分，满分 36分）', subject: '生物', year: '2013', province: '贵州'})
WITH q MATCH (p:Paper {name: '2013年高考生物试卷（新课标Ⅱ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_生物_2013_2', title: '1．（6分）关于DNA和RNA的叙述，正确的是（ ）', subject: '生物', year: '2013', province: '贵州'})
WITH q MATCH (p:Paper {name: '2013年高考生物试卷（新课标Ⅱ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2008年高考物理试卷（全国卷Ⅱ）（空白卷）.pdf', province: '贵州', subject: '物理', year: '2008', type: '空白卷', volume: '全国卷Ⅱ', preview: '2008 年全国统一高考物理试卷（全国卷Ⅱ）
一、选择题（本题共 8 小题，在每小题给出的四个选项中，有的只有一个选项
正确，有的有多个选项正确，全部选对的得 6 分，选对但不全的得 3 分，有
选错的得 0分）
1．（6分）对一定量的气体，下列说法正确的是（ ）
A．气体的体积是所有气体分子的体积', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '贵州'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '物理', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '贵州_物理_2008_1', title: '一、选择题（本题共 8 小题，在每小题给出的四个选项中，有的只有一个选项', subject: '物理', year: '2008', province: '贵州'})
WITH q MATCH (p:Paper {name: '2008年高考物理试卷（全国卷Ⅱ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_物理_2008_2', title: '1．（6分）对一定量的气体，下列说法正确的是（ ）', subject: '物理', year: '2008', province: '贵州'})
WITH q MATCH (p:Paper {name: '2008年高考物理试卷（全国卷Ⅱ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_物理_2008_3', title: '2．（6 分）一束单色光斜射到一厚平板玻璃的一个表面上，经两次折射后从玻', subject: '物理', year: '2008', province: '贵州'})
WITH q MATCH (p:Paper {name: '2008年高考物理试卷（全国卷Ⅱ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_物理_2008_4', title: '3．（6分）如图，一固定斜面上两个质量相同的小滑块A和B紧挨着匀速下滑，', subject: '物理', year: '2008', province: '贵州'})
WITH q MATCH (p:Paper {name: '2008年高考物理试卷（全国卷Ⅱ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_物理_2008_5', title: '6．（6 分）一平行板电容器的两个极板水平放置，两极板间有一带电量不变的', subject: '物理', year: '2008', province: '贵州'})
WITH q MATCH (p:Paper {name: '2008年高考物理试卷（全国卷Ⅱ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2010年高考物理试卷（全国卷Ⅱ）（空白卷）.pdf', province: '贵州', subject: '物理', year: '2010', type: '空白卷', volume: '全国卷Ⅱ', preview: '2010 年全国统一高考物理试卷（全国卷Ⅱ）
一、选择题（共 8小题，每小题 6分，满分 48分）
1．（6 分）原子核 AX 与氘核 2H 反应生成一个 α 粒子和一个质子．由此可知
Z 1
（ ）
A．A=2，Z=1 B．A=2，Z=2 C．A=3，Z=3 D．A=3，Z=2
2．（6 分）一简', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '贵州'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '物理', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '贵州_物理_2010_1', title: '一、选择题（共 8小题，每小题 6分，满分 48分）', subject: '物理', year: '2010', province: '贵州'})
WITH q MATCH (p:Paper {name: '2010年高考物理试卷（全国卷Ⅱ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_物理_2010_2', title: '1．（6 分）原子核 AX 与氘核 2H 反应生成一个 α 粒子和一个质子．由此可知', subject: '物理', year: '2010', province: '贵州'})
WITH q MATCH (p:Paper {name: '2010年高考物理试卷（全国卷Ⅱ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_物理_2010_3', title: '2．（6 分）一简谐横波以 4m/s 的波速沿 x 轴正方向传播．已知 t=0 时的波形如', subject: '物理', year: '2010', province: '贵州'})
WITH q MATCH (p:Paper {name: '2010年高考物理试卷（全国卷Ⅱ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_物理_2010_4', title: '3．（6 分）如图，一绝热容器被隔板 K 隔开 a、b 两部分．已知 a 内有一定量', subject: '物理', year: '2010', province: '贵州'})
WITH q MATCH (p:Paper {name: '2010年高考物理试卷（全国卷Ⅱ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_物理_2010_5', title: '4．（6 分）在雷雨云下沿竖直方向的电场强度为 104V/m，已知一半径为 1mm', subject: '物理', year: '2010', province: '贵州'})
WITH q MATCH (p:Paper {name: '2010年高考物理试卷（全国卷Ⅱ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2011年高考物理试卷（全国Ⅱ卷，大纲版）（解析卷）.pdf', province: '贵州', subject: '物理', year: '2011', type: '解析卷', volume: '全国Ⅱ卷，大纲版', preview: '2011年全国统一高考物理试卷（全国卷Ⅱ）
参考答案与试题解析
一、选择题（本题共8小题．在每小题给出的四个选项中，有的只有一个选项
正确，有的有多个选项正确，全部选对的得6分，选对但不全的得3分，有选
错的得0分．共48分）
1．（6分）关于一定量的气体，下列叙述正确的是（ ）
A．气体吸收的热量', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '贵州'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '物理', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '贵州_物理_2011_1', title: '一、选择题（本题共8小题．在每小题给出的四个选项中，有的只有一个选项', subject: '物理', year: '2011', province: '贵州'})
WITH q MATCH (p:Paper {name: '2011年高考物理试卷（全国Ⅱ卷，大纲版）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_物理_2011_2', title: '1．（6分）关于一定量的气体，下列叙述正确的是（ ）', subject: '物理', year: '2011', province: '贵州'})
WITH q MATCH (p:Paper {name: '2011年高考物理试卷（全国Ⅱ卷，大纲版）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_物理_2011_3', title: '2．（6分）如图，两根相互', subject: '物理', year: '2011', province: '贵州'})
WITH q MATCH (p:Paper {name: '2011年高考物理试卷（全国Ⅱ卷，大纲版）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2012年高考物理试卷（大纲版）（解析卷）.pdf', province: '贵州', subject: '物理', year: '2012', type: '解析卷', volume: '解析卷', preview: '2012 年全国统一高考物理试卷（大纲版）
参考答案与试题解析
一、选择题：本题共 8 题．在每小题给出的四个选项中，有的只有一个选项符
合题目要求，有的有多个选项符合题目要求．全部选对的得 6 分，选对但选
不全的得 3分，有选错的得 0分．
1．（6分）下列关于布朗运动的说法，正确的是（ ）
A', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '贵州'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '物理', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '贵州_物理_2012_1', title: '一、选择题：本题共 8 题．在每小题给出的四个选项中，有的只有一个选项符', subject: '物理', year: '2012', province: '贵州'})
WITH q MATCH (p:Paper {name: '2012年高考物理试卷（大纲版）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_物理_2012_2', title: '1．（6分）下列关于布朗运动的说法，正确的是（ ）', subject: '物理', year: '2012', province: '贵州'})
WITH q MATCH (p:Paper {name: '2012年高考物理试卷（大纲版）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_物理_2012_3', title: '2．（', subject: '物理', year: '2012', province: '贵州'})
WITH q MATCH (p:Paper {name: '2012年高考物理试卷（大纲版）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2015年高考物理试卷（新课标Ⅱ）（解析卷）.pdf', province: '贵州', subject: '物理', year: '2015', type: '解析卷', volume: '解析卷', preview: '2015 年全国统一高考物理试卷（新课标Ⅱ）
参考答案与试题解析
一、选择题：本题共 8小题，每小题 6分．在每小题给出的四个选项中，第 1～
4题只有一项符合题目要求，第 5～8题有多项符合题目要求．全部选对的得
6分，选对但不全的得 3分，有选错的得 0分．
1．（6分）如图，两平行的带电金属板', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '贵州'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '物理', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '贵州_物理_2015_1', title: '一、选择题：本题共 8小题，每小题 6分．在每小题给出的四个选项中，第 1～', subject: '物理', year: '2015', province: '贵州'})
WITH q MATCH (p:Paper {name: '2015年高考物理试卷（新课标Ⅱ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_物理_2015_2', title: '1．（6分）如图，两平行的带电金属板水平放置。若在两板中间a点从静止释放', subject: '物理', year: '2015', province: '贵州'})
WITH q MATCH (p:Paper {name: '2015年高考物理试卷（新课标Ⅱ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_物理_2015_3', title: '2．（6分）如图，直角三角形金属框abc放置在匀强磁场中，磁感应强度大小为', subject: '物理', year: '2015', province: '贵州'})
WITH q MATCH (p:Paper {name: '2015年高考物理试卷（新课标Ⅱ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2019年高考物理试卷（新课标Ⅲ）（解析卷）.pdf', province: '贵州', subject: '物理', year: '2019', type: '解析卷', volume: '解析卷', preview: '2019 年全国统一高考物理试卷（新课标Ⅲ）
参考答案与试题解析
一、选择题：本题共8小题，每小题6分，共48分。在每小题给出的四个选项中，第1～5
题只有一项符合题目要求，第6～8题有多项符合题目要求。全部选对的得6分，选对但不
全的得3分，有选错的得0分。
1．（6分）楞次定律是下列哪个定律在电', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '贵州'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '物理', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '贵州_物理_2019_1', title: '一、选择题：本题共8小题，每小题6分，共48分。在每小题给出的四个选项中，第1～5', subject: '物理', year: '2019', province: '贵州'})
WITH q MATCH (p:Paper {name: '2019年高考物理试卷（新课标Ⅲ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_物理_2019_2', title: '1．（6分）楞次定律是下列哪个定律在电磁感应现象中的具体体现？（ ）', subject: '物理', year: '2019', province: '贵州'})
WITH q MATCH (p:Paper {name: '2019年高考物理试卷（新课标Ⅲ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_物理_2019_3', title: '3．（6分）用卡车运输质量为m的匀质圆筒状工件，为使工件保持固定，将其置于两光滑斜', subject: '物理', year: '2019', province: '贵州'})
WITH q MATCH (p:Paper {name: '2019年高考物理试卷（新课标Ⅲ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2017年高考物理试卷（新课标Ⅲ）（解析卷）.pdf', province: '贵州', subject: '物理', year: '2017', type: '解析卷', volume: '解析卷', preview: '2017 年全国高考统一物理试卷（新课标Ⅲ）
参考答案与试题解析
一、选择题：本题共 8小题，每小题 6分，共 48分．在每小题给出的四个选项
中，第 1～5 题只有一项符合题目要求，第 6～7 题有多项符合题目要求．全
部选对的得 6分，选对但不全的得 3分，有选错的得 0分．
1．（6分）201', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '贵州'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '物理', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '贵州_物理_2017_1', title: '一、选择题：本题共 8小题，每小题 6分，共 48分．在每小题给出的四个选项', subject: '物理', year: '2017', province: '贵州'})
WITH q MATCH (p:Paper {name: '2017年高考物理试卷（新课标Ⅲ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_物理_2017_2', title: '1．（6分）2017年4月，我国成功发射的天舟一号货运飞船与天宫二号空间实验', subject: '物理', year: '2017', province: '贵州'})
WITH q MATCH (p:Paper {name: '2017年高考物理试卷（新课标Ⅲ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2018年高考物理试卷（新课标Ⅲ）（空白卷）.pdf', province: '贵州', subject: '物理', year: '2018', type: '空白卷', volume: '空白卷', preview: '2018 年全国统一高考物理试卷（新课标Ⅲ）
一、选择题：本题共 8个小题，每题 6分，共 48分。在每个小题给出的四个选
项中，第 1-4题只有一项符合题目要求，第 5-8题有多项符合题目要求。全部
选对的得 6分，选对不全的得 3分，有选错的得 0分。
1．（6分）1934年，约里奥﹣居里夫妇用', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '贵州'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '物理', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '贵州_物理_2018_1', title: '一、选择题：本题共 8个小题，每题 6分，共 48分。在每个小题给出的四个选', subject: '物理', year: '2018', province: '贵州'})
WITH q MATCH (p:Paper {name: '2018年高考物理试卷（新课标Ⅲ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_物理_2018_2', title: '1．（6分）1934年，约里奥﹣居里夫妇用α粒子轰击铝核 Al，产生了第一个', subject: '物理', year: '2018', province: '贵州'})
WITH q MATCH (p:Paper {name: '2018年高考物理试卷（新课标Ⅲ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_物理_2018_3', title: '2．（6 分）为了探测引力波，“天琴计划”预计发射地球卫星 P，其轨道半径约为', subject: '物理', year: '2018', province: '贵州'})
WITH q MATCH (p:Paper {name: '2018年高考物理试卷（新课标Ⅲ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_物理_2018_4', title: '3．（6 分）一电阻接到方波交流电源上，在一个周期内产生的热量为 Q ；若该', subject: '物理', year: '2018', province: '贵州'})
WITH q MATCH (p:Paper {name: '2018年高考物理试卷（新课标Ⅲ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_物理_2018_5', title: '4．（6分）在一斜面顶端，将', subject: '物理', year: '2018', province: '贵州'})
WITH q MATCH (p:Paper {name: '2018年高考物理试卷（新课标Ⅲ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2013年高考物理试卷（新课标Ⅱ）（解析卷）.pdf', province: '贵州', subject: '物理', year: '2013', type: '解析卷', volume: '解析卷', preview: '2013 年全国统一高考物理试卷（新课标Ⅱ）
参考答案与试题解析
一、选择题：本题共 8小题，每小题 6分．在每小题给出的四个选项中，第 1～
5题只有一项符合题目要求，第 6～8题有多项符合题目要求．全部选对的得
6分，选对但不全的得 3分，有选错的得 0分．
1．（6分）一物块静止在粗糙的水平桌', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '贵州'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '物理', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '贵州_物理_2013_1', title: '一、选择题：本题共 8小题，每小题 6分．在每小题给出的四个选项中，第 1～', subject: '物理', year: '2013', province: '贵州'})
WITH q MATCH (p:Paper {name: '2013年高考物理试卷（新课标Ⅱ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_物理_2013_2', title: '1．（6分）一物块静止在粗糙的水平桌面上。从某时刻开始，物块受到一方向不', subject: '物理', year: '2013', province: '贵州'})
WITH q MATCH (p:Paper {name: '2013年高考物理试卷（新课标Ⅱ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_物理_2013_3', title: '【点评】对于此类图象选择题，最好是根据牛顿第二定律找出两个物理量之间的', subject: '物理', year: '2013', province: '贵州'})
WITH q MATCH (p:Paper {name: '2013年高考物理试卷（新课标Ⅱ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_物理_2013_4', title: '2．（6 分）如图，在固定斜面上的一物块受到一外力 F 的作用，F 平行于斜面向', subject: '物理', year: '2013', province: '贵州'})
WITH q MATCH (p:Paper {name: '2013年高考物理试卷（新课标Ⅱ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2016年高考物理试卷（新课标Ⅲ）（空白卷）.pdf', province: '贵州', subject: '物理', year: '2016', type: '空白卷', volume: '空白卷', preview: '2016 年全国高考统一物理试卷（新课标Ⅲ）
一、选择题
1．（6分）关于行星运动的规律，下列说法符合史实的是（ ）
A．开普勒在牛顿定律的基础上，导出了行星运动的规律
B．开普勒在天文观测数据的基础上，总结出了行星运动的规律
C．开普勒总结出了行星运动的规律，找出了行星按照这些规律运动的原因
D．', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '贵州'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '物理', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '贵州_物理_2016_1', title: '一、选择题', subject: '物理', year: '2016', province: '贵州'})
WITH q MATCH (p:Paper {name: '2016年高考物理试卷（新课标Ⅲ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_物理_2016_2', title: '1．（6分）关于行星运动的规律，下列说法符合史实的是（ ）', subject: '物理', year: '2016', province: '贵州'})
WITH q MATCH (p:Paper {name: '2016年高考物理试卷（新课标Ⅲ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_物理_2016_3', title: '2．（6分）关于静电场的等势面，下列说法正确的是（ ）', subject: '物理', year: '2016', province: '贵州'})
WITH q MATCH (p:Paper {name: '2016年高考物理试卷（新课标Ⅲ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_物理_2016_4', title: '3．（6 分）一质点做速度逐渐增大的匀加速直线运动，在时间间隔 t 内位移为 s，', subject: '物理', year: '2016', province: '贵州'})
WITH q MATCH (p:Paper {name: '2016年高考物理试卷（新课标Ⅲ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_物理_2016_5', title: '4．（6分）如图，两个轻环a和b套在位于竖直面内的一段固定圆弧上：一细线', subject: '物理', year: '2016', province: '贵州'})
WITH q MATCH (p:Paper {name: '2016年高考物理试卷（新课标Ⅲ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2014年高考物理试卷（新课标Ⅱ）（解析卷）.pdf', province: '贵州', subject: '物理', year: '2014', type: '解析卷', volume: '解析卷', preview: '2014 年全国统一高考物理试卷（新课标Ⅱ）
参考答案与试题解析
二、选择题：本题共 8小题，每小题 6分，在每小题给出的四个选项中，第 14～
18 题只有一项符合题目要求，第 19～21 题有多项符合题目要求．全部选对
的得 6分，选对但不全的得 3分，有选错的得 0分．
1．（6 分）甲乙两汽', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '贵州'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '物理', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '贵州_物理_2014_1', title: '二、选择题：本题共 8小题，每小题 6分，在每小题给出的四个选项中，第 14～', subject: '物理', year: '2014', province: '贵州'})
WITH q MATCH (p:Paper {name: '2014年高考物理试卷（新课标Ⅱ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_物理_2014_2', title: '1．（6 分）甲乙两汽车在一平直公路上同向行驶，在 t=0 到 t=t 的时间内，它们', subject: '物理', year: '2014', province: '贵州'})
WITH q MATCH (p:Paper {name: '2014年高考物理试卷（新课标Ⅱ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_物理_2014_3', title: '2．（6分）取水平地面为重力势能零点，一物块从某一高度水平抛出，在抛出点', subject: '物理', year: '2014', province: '贵州'})
WITH q MATCH (p:Paper {name: '2014年高考物理试卷（新课标Ⅱ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2023年高考物理试卷（全国甲卷）（解析卷）.pdf', province: '贵州', subject: '物理', year: '2023', type: '解析卷', volume: '全国甲卷', preview: '全国甲卷物理
1. 一同学将铅球水平推出，不计空气阻力和转动的影响，铅球在平抛运动过程中（ ）
A. 机械能一直增加 B. 加速度保持不变 C. 速度大小保持不变 D. 被推出后瞬间动能最大
【答案】B
【解析】
【详解】A．铅球做平抛运动，仅受重力，故机械能守恒，A错误；
B．铅球的加速度恒为重力', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '贵州'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '物理', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '贵州_物理_2023_1', title: '1. 一同学将铅球水平推出，不计空气阻力和转动的影响，铅球在平抛运动过程中（ ）', subject: '物理', year: '2023', province: '贵州'})
WITH q MATCH (p:Paper {name: '2023年高考物理试卷（全国甲卷）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_物理_2023_2', title: '2. 在下列两个核反应方程中X+14N®Y+17 O、Y+7 Li®2X，X和Y代表两种不同的原子核，以Z', subject: '物理', year: '2023', province: '贵州'})
WITH q MATCH (p:Paper {name: '2023年高考物理试卷（全国甲卷）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2020年高考物理试卷（新课标Ⅲ）（解析卷）.pdf', province: '贵州', subject: '物理', year: '2020', type: '解析卷', volume: '解析卷', preview: '2020 年全国统一高考物理试卷（新课标Ⅲ）
参考答案与试题解析
一、选择题：本题共8小题，每小题6分，共48分。在每小题给出的四个选项中，第1～5
题只有一项符合题目要求，第6～8题有多项符合题目要求。全部选对的得6分，选对但不
全的得3分，有选错的得0分。
1．（6分）如图，水平放置的圆柱形光滑', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '贵州'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '物理', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '贵州_物理_2020_1', title: '一、选择题：本题共8小题，每小题6分，共48分。在每小题给出的四个选项中，第1～5', subject: '物理', year: '2020', province: '贵州'})
WITH q MATCH (p:Paper {name: '2020年高考物理试卷（新课标Ⅲ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_物理_2020_2', title: '1．（6分）如图，水平放置的圆柱形光滑玻璃棒左边绕有一线圈，右边套有一金属圆环。圆', subject: '物理', year: '2020', province: '贵州'})
WITH q MATCH (p:Paper {name: '2020年高考物理试卷（新课标Ⅲ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2009年高考物理试卷（全国卷Ⅱ）（解析卷）.pdf', province: '贵州', subject: '物理', year: '2009', type: '解析卷', volume: '全国卷Ⅱ', preview: '2009年全国统一高考物理试卷（全国卷Ⅱ）
参考答案与试题解析
一、选择题（本题共8小题．在每小题给出的四个选项中，有的只有一个选项
正确，有的有多个选项正确．全部选对的得6分，选对但不全的得3分，有选
错的得0分）
1．（6分）下列关于简谐振动和简谐波的说法，正确的是（ ）
A．媒质中质点振动的周', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '贵州'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '物理', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '贵州_物理_2009_1', title: '一、选择题（本题共8小题．在每小题给出的四个选项中，有的只有一个选项', subject: '物理', year: '2009', province: '贵州'})
WITH q MATCH (p:Paper {name: '2009年高考物理试卷（全国卷Ⅱ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_物理_2009_2', title: '1．（6分）下列关于简谐振动和简谐波的说法，正确的是（ ）', subject: '物理', year: '2009', province: '贵州'})
WITH q MATCH (p:Paper {name: '2009年高考物理试卷（全国卷Ⅱ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2022年高考物理试卷（全国甲卷）（空白卷）.pdf', province: '贵州', subject: '物理', year: '2022', type: '空白卷', volume: '全国甲卷', preview: '2022 年全国高考甲卷物理试题
二、选择题
1. 北京2022年冬奥会首钢滑雪大跳台局部示意图如图所示。运动员从a处由静止自由滑下，到b处起
跳，c点为a、b之间的最低点，a、c两处的高度差为h。要求运动员经过c点时对滑雪板的压力不大于自
身所受重力的k倍，运动过程中将运动员视为质点并忽略所有阻力', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '贵州'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '物理', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '贵州_物理_2022_1', title: '二、选择题', subject: '物理', year: '2022', province: '贵州'})
WITH q MATCH (p:Paper {name: '2022年高考物理试卷（全国甲卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_物理_2022_2', title: '1. 北京2022年冬奥会首钢滑雪大跳台局部示意图如图所示。运动员从a处由静止自由滑下，到b处起', subject: '物理', year: '2022', province: '贵州'})
WITH q MATCH (p:Paper {name: '2022年高考物理试卷（全国甲卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_物理_2022_3', title: '2. 长为l的高速列车在平直轨道上正常行驶，速率为v ，要通过前方一长为L的隧道，当列车的任一部分', subject: '物理', year: '2022', province: '贵州'})
WITH q MATCH (p:Paper {name: '2022年高考物理试卷（全国甲卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_物理_2022_4', title: '3. 三个用同样的细导线做成的刚性闭合线框，正方形线框的边长与圆线框的直径相等，圆线框的半径与正', subject: '物理', year: '2022', province: '贵州'})
WITH q MATCH (p:Paper {name: '2022年高考物理试卷（全国甲卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_物理_2022_5', title: '6. 如图，质量相等的两滑块P、Q置于水平桌面上，二者用一轻弹簧水平连接，两滑块与桌面间的动摩擦', subject: '物理', year: '2022', province: '贵州'})
WITH q MATCH (p:Paper {name: '2022年高考物理试卷（全国甲卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2021年高考物理试卷（全国甲卷）（空白卷）.pdf', province: '贵州', subject: '物理', year: '2021', type: '空白卷', volume: '全国甲卷', preview: '2021 年普通高等学校招生全国统一考试（甲卷）
理科综合能力测试·物理部分
二、选择题：本题共 8小题，每小题 6分，共 8分。在每小题给出的四个选项中，第 1～5题
只有一项符合题目要求，第 6～8题有多项符合题目要求。全部选对的得 6分，选对但不全的
得 3分，有选错的得 0分。
1. 如图，', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '贵州'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '物理', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '贵州_物理_2021_1', title: '二、选择题：本题共 8小题，每小题 6分，共 8分。在每小题给出的四个选项中，第 1～5题', subject: '物理', year: '2021', province: '贵州'})
WITH q MATCH (p:Paper {name: '2021年高考物理试卷（全国甲卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_物理_2021_2', title: '1. 如图，将光滑长平板的下端置于铁架台水平底座上的挡板P处，上部架在横杆上。横杆的位置可在竖直', subject: '物理', year: '2021', province: '贵州'})
WITH q MATCH (p:Paper {name: '2021年高考物理试卷（全国甲卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_物理_2021_3', title: '2. “旋转纽扣”是一种传统游戏。如图，先将纽扣绕几圈，使穿过纽扣的两股细绳拧在一起，然后用力反', subject: '物理', year: '2021', province: '贵州'})
WITH q MATCH (p:Paper {name: '2021年高考物理试卷（全国甲卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_物理_2021_4', title: '3. 两足够长', subject: '物理', year: '2021', province: '贵州'})
WITH q MATCH (p:Paper {name: '2021年高考物理试卷（全国甲卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_物理_2021_5', title: '4. 如图，一个原子核X经图中所示的一系列a、b衰变后，生成稳定的原子核Y，在此过程中放射出电子', subject: '物理', year: '2021', province: '贵州'})
WITH q MATCH (p:Paper {name: '2021年高考物理试卷（全国甲卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2024年高考英语试卷（新课标Ⅱ卷）（空白卷）.pdf', province: '贵州', subject: '英语', year: '2024', type: '空白卷', volume: '新课标Ⅱ卷', preview: '绝密★启用前
2024 年普通高等学校招生全国统一考试
英语
本试卷共 12页。考试结束后, 将本试卷和答题卡一并交回。
注意事项: 1. 答题前, 考生先将自己的姓名、准考证号码填写清楚, 将条形码准确粘贴在考生
信息条形码粘贴区。
2. 选择题必须使用 2B 铅笔填涂; 非选择题必须使用 0.5', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '贵州'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '英语', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '贵州_英语_2024_1', title: '2. 选择题必须使用 2B 铅笔填涂; 非选择题必须使用 0.5 毫米黑色字迹的签字笔书写, 字体', subject: '英语', year: '2024', province: '贵州'})
WITH q MATCH (p:Paper {name: '2024年高考英语试卷（新课标Ⅱ卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_英语_2024_2', title: '3. 请按照题号顺序在答题卡各题目的答题区域内作答, 超出答题区域书写的答案无效; 在草', subject: '英语', year: '2024', province: '贵州'})
WITH q MATCH (p:Paper {name: '2024年高考英语试卷（新课标Ⅱ卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_英语_2024_3', title: '4. 作图可先使用铅笔画出, 确定后必须用黑色字迹的签字笔描黑。', subject: '英语', year: '2024', province: '贵州'})
WITH q MATCH (p:Paper {name: '2024年高考英语试卷（新课标Ⅱ卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_英语_2024_4', title: '5. 保持卡面清洁, 不要折叠, 不要弄破、弄皱, 不准使用涂改液、修正带、刮纸刀。', subject: '英语', year: '2024', province: '贵州'})
WITH q MATCH (p:Paper {name: '2024年高考英语试卷（新课标Ⅱ卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_英语_2024_5', title: '5. What is Alex doing?', subject: '英语', year: '2024', province: '贵州'})
WITH q MATCH (p:Paper {name: '2024年高考英语试卷（新课标Ⅱ卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2011年高考英语试卷（新课标）（解析卷）.pdf', province: '贵州', subject: '英语', year: '2011', type: '解析卷', volume: '解析卷', preview: '2011年高考英语试卷（新课标卷）
参考答案与试题解析
第一部分 听力（共两节，满分30分）
做题时，先将答案标在试卷上，录音结束后，你将有两分钟的时间将试卷
上的答案转涂到答题卡上。
第一节 （共5小题，每小题1.5分，满分7.5分）
听下面5段对话。每段对话后有一个小题，从题中所给的A、B、C三', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '贵州'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '英语', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '贵州_英语_2011_1', title: '1. What does the man like about the play?', subject: '英语', year: '2011', province: '贵州'})
WITH q MATCH (p:Paper {name: '2011年高考英语试卷（新课标）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_英语_2011_2', title: '2. Which place are the speakers trying to find?', subject: '英语', year: '2011', province: '贵州'})
WITH q MATCH (p:Paper {name: '2011年高考英语试卷（新课标）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_英语_2011_3', title: '3. At what time will the two speakers meet?', subject: '英语', year: '2011', province: '贵州'})
WITH q MATCH (p:Paper {name: '2011年高考英语试卷（新课标）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_英语_2011_4', title: '6. Where is Ben?', subject: '英语', year: '2011', province: '贵州'})
WITH q MATCH (p:Paper {name: '2011年高考英语试卷（新课标）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_英语_2011_5', title: '7. What will the children in the afternoon?', subject: '英语', year: '2011', province: '贵州'})
WITH q MATCH (p:Paper {name: '2011年高考英语试卷（新课标）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2016年高考英语试卷（新课标Ⅲ卷）（解析卷）.pdf', province: '贵州', subject: '英语', year: '2016', type: '解析卷', volume: '新课标Ⅲ卷', preview: '2016年高考英语试卷（新课标Ⅲ）
第一部分 听力（共两节，满分30分）
做题时，先将答案标在试卷上，录音结束后，你将有两分钟的时间将试卷
上的答案转涂到答题卡上。
第一节 （共5小题，每小题1.5分，满分7.5分）
听下面5段对话。每段对话后有一个小题，从题中所给的A、B、C三个选项
中选出最佳答', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '贵州'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '英语', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '贵州_英语_2016_1', title: '1. What will Lucy do at 11:30 tomorrow?', subject: '英语', year: '2016', province: '贵州'})
WITH q MATCH (p:Paper {name: '2016年高考英语试卷（新课标Ⅲ卷）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_英语_2016_2', title: '2. What is the weather like now?', subject: '英语', year: '2016', province: '贵州'})
WITH q MATCH (p:Paper {name: '2016年高考英语试卷（新课标Ⅲ卷）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_英语_2016_3', title: '3. Why does the man talk to Dr. Simpson?', subject: '英语', year: '2016', province: '贵州'})
WITH q MATCH (p:Paper {name: '2016年高考英语试卷（新课标Ⅲ卷）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_英语_2016_4', title: '6. What time is it now?', subject: '英语', year: '2016', province: '贵州'})
WITH q MATCH (p:Paper {name: '2016年高考英语试卷（新课标Ⅲ卷）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_英语_2016_5', title: '7. What will the man do?', subject: '英语', year: '2016', province: '贵州'})
WITH q MATCH (p:Paper {name: '2016年高考英语试卷（新课标Ⅲ卷）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2020年高考英语试卷（新高考Ⅰ卷）（山东）（空白卷）.pdf', province: '贵州', subject: '英语', year: '2020', type: '空白卷', volume: '新高考Ⅰ卷', preview: '2020 年普通高等学校招生全国统一考试·新高考Ⅰ卷
英语
注意事项:
1.答卷前, 考生务必将自己的姓名、准考证号填写在答题卡上。
2.回答选择题时, 选出每小题答案后, 用铅笔把答题卡上对应题目的答案标号涂黑。如需改动,
用橡皮擦干净后, 再选涂其他答案标号。回答非选择题时, 将答案写在答题卡上', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '贵州'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '英语', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '贵州_英语_2020_1', title: '1.答卷前, 考生务必将自己的姓名、准考证号填写在答题卡上。', subject: '英语', year: '2020', province: '贵州'})
WITH q MATCH (p:Paper {name: '2020年高考英语试卷（新高考Ⅰ卷）（山东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_英语_2020_2', title: '2.回答选择题时, 选出每小题答案后, 用铅笔把答题卡上对应题目的答案标号涂黑。如需改动,', subject: '英语', year: '2020', province: '贵州'})
WITH q MATCH (p:Paper {name: '2020年高考英语试卷（新高考Ⅰ卷）（山东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_英语_2020_3', title: '用橡皮擦干净后, 再选涂其他答案标号。回答非选择题时, 将答案写在答题卡上, 写在本试卷', subject: '英语', year: '2020', province: '贵州'})
WITH q MATCH (p:Paper {name: '2020年高考英语试卷（新高考Ⅰ卷）（山东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_英语_2020_4', title: '3.考试结束后, 将本试卷和答题卡一并交回。', subject: '英语', year: '2020', province: '贵州'})
WITH q MATCH (p:Paper {name: '2020年高考英语试卷（新高考Ⅰ卷）（山东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_英语_2020_5', title: '2. What will each of the honorable mention winners get?', subject: '英语', year: '2020', province: '贵州'})
WITH q MATCH (p:Paper {name: '2020年高考英语试卷（新高考Ⅰ卷）（山东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2013年高考英语试卷（新课标Ⅰ卷）（空白卷）.pdf', province: '贵州', subject: '英语', year: '2013', type: '空白卷', volume: '新课标Ⅰ卷', preview: '2013年高考英语试卷（新课标I）
第一部分 听力（共两节，满分30分）
做题时，先将答案标在试卷上，录音结束后，你将有两分钟的时间将试卷
上的答案转涂到答题卡上。
第一节 （共5小题，每小题1.5分，满分7.5分）
听下面5段对话。每段对话后有一个小题，从题中所给的A、B、C三个选项
中选出最佳答', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '贵州'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '英语', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '贵州_英语_2013_1', title: '1. What does the man want to do?', subject: '英语', year: '2013', province: '贵州'})
WITH q MATCH (p:Paper {name: '2013年高考英语试卷（新课标Ⅰ卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_英语_2013_2', title: '2. What are the speakers talking about?', subject: '英语', year: '2013', province: '贵州'})
WITH q MATCH (p:Paper {name: '2013年高考英语试卷（新课标Ⅰ卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_英语_2013_3', title: '3. Where is the man now?', subject: '英语', year: '2013', province: '贵州'})
WITH q MATCH (p:Paper {name: '2013年高考英语试卷（新课标Ⅰ卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_英语_2013_4', title: '6. What is Sara going to do?', subject: '英语', year: '2013', province: '贵州'})
WITH q MATCH (p:Paper {name: '2013年高考英语试卷（新课标Ⅰ卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_英语_2013_5', title: '7. What does the man think of Sara’s plan?', subject: '英语', year: '2013', province: '贵州'})
WITH q MATCH (p:Paper {name: '2013年高考英语试卷（新课标Ⅰ卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2017年高考英语试卷（新课标Ⅲ卷）（空白卷）.pdf', province: '贵州', subject: '英语', year: '2017', type: '空白卷', volume: '新课标Ⅲ卷', preview: '2017年高考英语试卷（新课标Ⅲ卷）
第一部分 听力（共两节，满分30分）
做题时，先将答案标在试卷上，录音结束后，你将有两分钟的时间将试卷
上的答案转涂到答题卡上。
第一节 （共5小题，每小题1.5分，满分7.5分）
听下面5段对话。每段对话后有一个小题，从题中所给的A、B、C三个选项
中选出最佳', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '贵州'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '英语', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '贵州_英语_2017_1', title: '1. What will the woman do this afternoon?', subject: '英语', year: '2017', province: '贵州'})
WITH q MATCH (p:Paper {name: '2017年高考英语试卷（新课标Ⅲ卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_英语_2017_2', title: '2. Why does the woman call the man?', subject: '英语', year: '2017', province: '贵州'})
WITH q MATCH (p:Paper {name: '2017年高考英语试卷（新课标Ⅲ卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_英语_2017_3', title: '3. How much more does David need fo', subject: '英语', year: '2017', province: '贵州'})
WITH q MATCH (p:Paper {name: '2017年高考英语试卷（新课标Ⅲ卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_英语_2017_4', title: '7. Where does the conversation probably take place?', subject: '英语', year: '2017', province: '贵州'})
WITH q MATCH (p:Paper {name: '2017年高考英语试卷（新课标Ⅲ卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_英语_2017_5', title: '8. What does Richard do?', subject: '英语', year: '2017', province: '贵州'})
WITH q MATCH (p:Paper {name: '2017年高考英语试卷（新课标Ⅲ卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2019年高考英语试卷（新课标Ⅰ卷）（空白卷）.pdf', province: '贵州', subject: '英语', year: '2019', type: '空白卷', volume: '新课标Ⅰ卷', preview: '2019年普通高等学校招生全国统一考试(新课标I)
英 语
注意事项:
1.答卷前，考生务必将自己的姓名、准考证号填写在答题卡上。
2.回答选择题时，选出每小题答案后，用铅笔把答题卡上对应题目的答案标号涂黑。如需改
动，用橡皮擦干净后，再选涂其他答案标号。回答非选择题时，将答案写在答题卡上，写在
本', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '贵州'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '英语', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '贵州_英语_2019_1', title: '1.答卷前，考生务必将自己的姓名、准考证号填写在答题卡上。', subject: '英语', year: '2019', province: '贵州'})
WITH q MATCH (p:Paper {name: '2019年高考英语试卷（新课标Ⅰ卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_英语_2019_2', title: '2.回答选择题时，选出每小题答案后，用铅笔把答题卡上对应题目的答案标号涂黑。如需改', subject: '英语', year: '2019', province: '贵州'})
WITH q MATCH (p:Paper {name: '2019年高考英语试卷（新课标Ⅰ卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_英语_2019_3', title: '动，用橡皮擦干净后，再选涂其他答案标号。回答非选择题时，将答案写在答题卡上，写在', subject: '英语', year: '2019', province: '贵州'})
WITH q MATCH (p:Paper {name: '2019年高考英语试卷（新课标Ⅰ卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_英语_2019_4', title: '3.考试结束后，将本试卷和答题卡一并交回。', subject: '英语', year: '2019', province: '贵州'})
WITH q MATCH (p:Paper {name: '2019年高考英语试卷（新课标Ⅰ卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_英语_2019_5', title: '1.Where does this conversation take place?', subject: '英语', year: '2019', province: '贵州'})
WITH q MATCH (p:Paper {name: '2019年高考英语试卷（新课标Ⅰ卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2021年高考英语试卷（全国乙卷）（新课标Ⅰ）（空白卷）.pdf', province: '贵州', subject: '英语', year: '2021', type: '空白卷', volume: '全国乙卷', preview: '2021 年普通高等学校招生全国统一考试（全国乙卷）
英 语
注意事项:
1．答卷前,考生务必将自己的姓名、准考证号填写在答题卡上。
2．回答选择题时，选出每小题答案后，用铅笔把答题卡上对应题目的答案标号
涂黑。如需改动，用橡皮擦干净后，再选涂其他答案标号。回答非选择题时，将
答案写在答题卡上,写在', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '贵州'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '英语', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '贵州_英语_2021_1', title: '1．答卷前,考生务必将自己的姓名、准考证号填写在答题卡上。', subject: '英语', year: '2021', province: '贵州'})
WITH q MATCH (p:Paper {name: '2021年高考英语试卷（全国乙卷）（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_英语_2021_2', title: '2．回答选择题时，选出每小题答案后，用铅笔把答题卡上对应题目的答案标号', subject: '英语', year: '2021', province: '贵州'})
WITH q MATCH (p:Paper {name: '2021年高考英语试卷（全国乙卷）（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_英语_2021_3', title: '涂黑。如需改动，用橡皮擦干净后，再选涂其他答案标号。回答非选择题时，将', subject: '英语', year: '2021', province: '贵州'})
WITH q MATCH (p:Paper {name: '2021年高考英语试卷（全国乙卷）（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_英语_2021_4', title: '3.考试结束后,将本试卷和答题卡一并交回。', subject: '英语', year: '2021', province: '贵州'})
WITH q MATCH (p:Paper {name: '2021年高考英语试卷（全国乙卷）（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_英语_2021_5', title: '1.What is the man doing?', subject: '英语', year: '2021', province: '贵州'})
WITH q MATCH (p:Paper {name: '2021年高考英语试卷（全国乙卷）（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2022年高考英语试卷（全国甲卷）（解析卷）.pdf', province: '贵州', subject: '英语', year: '2022', type: '解析卷', volume: '全国甲卷', preview: '2022 年普通高等学校招生全国统一考试
英语
注意事项：
1. 答卷前，考生务必将自己的姓名、准考证号填写在答题卡上。
2. 回答选择题时，选出每小题答案后，用铅笔把答题卡上对应题目的答案标号涂黑。如需改
动，用橡皮擦干净后，再选涂其他答案标号。回答非选择题时，将答案写在答题卡上，写在
本试卷上无', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '贵州'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '英语', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '贵州_英语_2022_1', title: '1. 答卷前，考生务必将自己的姓名、准考证号填写在答题卡上。', subject: '英语', year: '2022', province: '贵州'})
WITH q MATCH (p:Paper {name: '2022年高考英语试卷（全国甲卷）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_英语_2022_2', title: '2. 回答选择题时，选出每小题答案后，用铅笔把答题卡上对应题目的答案标号涂黑。如需改', subject: '英语', year: '2022', province: '贵州'})
WITH q MATCH (p:Paper {name: '2022年高考英语试卷（全国甲卷）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_英语_2022_3', title: '动，用橡皮擦干净后，再选涂其他答案标号。回答非选择题时，将答案写在答题卡上，写在', subject: '英语', year: '2022', province: '贵州'})
WITH q MATCH (p:Paper {name: '2022年高考英语试卷（全国甲卷）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_英语_2022_4', title: '3. 考试结束后，将本试卷和答题卡一并交回。', subject: '英语', year: '2022', province: '贵州'})
WITH q MATCH (p:Paper {name: '2022年高考英语试卷（全国甲卷）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_英语_2022_5', title: '1. What does the man want to do?', subject: '英语', year: '2022', province: '贵州'})
WITH q MATCH (p:Paper {name: '2022年高考英语试卷（全国甲卷）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2015年高考英语试卷（新课标Ⅰ卷）（解析卷）.pdf', province: '贵州', subject: '英语', year: '2015', type: '解析卷', volume: '新课标Ⅰ卷', preview: '2015年高考英语试卷（新课标Ⅰ）
参考答案与试题解析
第一部分 听力（共两节，满分30分）
做题时，先将答案标在试卷上，录音结束后，你将有两分钟的时间将试卷
上的答案转涂到答题卡上。
第一节 （共5小题，每小题1.5分，满分7.5分）
听下面5段对话。每段对话后有一个小题，从题中所给的A、B、C三', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '贵州'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '英语', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '贵州_英语_2015_1', title: '1. What time is it now?', subject: '英语', year: '2015', province: '贵州'})
WITH q MATCH (p:Paper {name: '2015年高考英语试卷（新课标Ⅰ卷）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_英语_2015_2', title: '2. What does the woman think of the weather?', subject: '英语', year: '2015', province: '贵州'})
WITH q MATCH (p:Paper {name: '2015年高考英语试卷（新课标Ⅰ卷）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_英语_2015_3', title: '3. What will the man do?', subject: '英语', year: '2015', province: '贵州'})
WITH q MATCH (p:Paper {name: '2015年高考英语试卷（新课标Ⅰ卷）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_英语_2015_4', title: '4. What', subject: '英语', year: '2015', province: '贵州'})
WITH q MATCH (p:Paper {name: '2015年高考英语试卷（新课标Ⅰ卷）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_英语_2015_5', title: '6. How long did Michael stay in China?', subject: '英语', year: '2015', province: '贵州'})
WITH q MATCH (p:Paper {name: '2015年高考英语试卷（新课标Ⅰ卷）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2023年高考英语试卷（全国乙卷）（空白卷）.pdf', province: '贵州', subject: '英语', year: '2023', type: '空白卷', volume: '全国乙卷', preview: '2023 年普通高等学校招生全国统一考试(全国乙卷)
英语学科
注意事项：
1.答卷前，考生务必将自己的姓名、准考证号填写在答题卡上，并将自己的姓名、准考
证号、座位号填写在本试卷上。
2.回答选择题时,选出每小题答案后,用 2B 铅笔把答题卡上对应题目的答案标号涂黑;如
需改动，用橡皮擦干净后，再', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '贵州'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '英语', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '贵州_英语_2023_1', title: '1.答卷前，考生务必将自己的姓名、准考证号填写在答题卡上，并将自己的姓名、准考', subject: '英语', year: '2023', province: '贵州'})
WITH q MATCH (p:Paper {name: '2023年高考英语试卷（全国乙卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_英语_2023_2', title: '2.回答选择题时,选出每小题答案后,用 2B 铅笔把答题卡上对应题目的答案标号涂黑;如', subject: '英语', year: '2023', province: '贵州'})
WITH q MATCH (p:Paper {name: '2023年高考英语试卷（全国乙卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_英语_2023_3', title: '3.作答非选择题时，将答案书写在答题卡上，书写在本试卷上无效。', subject: '英语', year: '2023', province: '贵州'})
WITH q MATCH (p:Paper {name: '2023年高考英语试卷（全国乙卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_英语_2023_4', title: '4．考试结束后，将本试卷和答题卡一并交回。', subject: '英语', year: '2023', province: '贵州'})
WITH q MATCH (p:Paper {name: '2023年高考英语试卷（全国乙卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_英语_2023_5', title: '1. 【此处可播放相关音频，请去附件查看】', subject: '英语', year: '2023', province: '贵州'})
WITH q MATCH (p:Paper {name: '2023年高考英语试卷（全国乙卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2008年高考英语试卷（全国Ⅰ卷）（空白卷）.pdf', province: '贵州', subject: '英语', year: '2008', type: '空白卷', volume: '全国Ⅰ卷', preview: '2008年高考英语试卷（全国卷I）
第一部分 听力（共两节，满分30分）
做题时，先将答案标在试卷上，录音结束后，你将有两分钟的时间将试卷
上的答案转涂到答题卡上。
第一节 （共5小题，每小题1.5分，满分7.5分）
听下面5段对话。每段对话后有一个小题，从题中所给的A、B、C三个选项
中选出最佳答', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '贵州'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '英语', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '贵州_英语_2008_1', title: '1. What is the weather like?', subject: '英语', year: '2008', province: '贵州'})
WITH q MATCH (p:Paper {name: '2008年高考英语试卷（全国Ⅰ卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_英语_2008_2', title: '2. Who will go to China next month?', subject: '英语', year: '2008', province: '贵州'})
WITH q MATCH (p:Paper {name: '2008年高考英语试卷（全国Ⅰ卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_英语_2008_3', title: '3. What are the speakers talking about?', subject: '英语', year: '2008', province: '贵州'})
WITH q MATCH (p:Paper {name: '2008年高考英语试卷（全国Ⅰ卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_英语_2008_4', title: '4. Where wi', subject: '英语', year: '2008', province: '贵州'})
WITH q MATCH (p:Paper {name: '2008年高考英语试卷（全国Ⅰ卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_英语_2008_5', title: '7. How old was the baby when the woman left New York?', subject: '英语', year: '2008', province: '贵州'})
WITH q MATCH (p:Paper {name: '2008年高考英语试卷（全国Ⅰ卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2014年高考英语试卷（新课标Ⅰ卷）（空白卷）.pdf', province: '贵州', subject: '英语', year: '2014', type: '空白卷', volume: '新课标Ⅰ卷', preview: '2014年高考英语试卷（新课标Ⅰ）
第一部分 听力（共两节，满分30分）
做题时，先将答案标在试卷上，录音结束后，你将有两分钟的时间将试卷
上的答案转涂到答题卡上。
第一节 （共5小题，每小题1.5分，满分7.5分）
听下面5段对话。每段对话后有一个小题，从题中所给的A、B、C三个选项
中选出最佳答', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '贵州'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '英语', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '贵州_英语_2014_1', title: '1. What does the woman want to do?', subject: '英语', year: '2014', province: '贵州'})
WITH q MATCH (p:Paper {name: '2014年高考英语试卷（新课标Ⅰ卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_英语_2014_2', title: '2. What will the man do for the woman?', subject: '英语', year: '2014', province: '贵州'})
WITH q MATCH (p:Paper {name: '2014年高考英语试卷（新课标Ⅰ卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_英语_2014_3', title: '3. Who might Mr. Peterson be?', subject: '英语', year: '2014', province: '贵州'})
WITH q MATCH (p:Paper {name: '2014年高考英语试卷（新课标Ⅰ卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_英语_2014_4', title: '7. What will the woman probably do next?', subject: '英语', year: '2014', province: '贵州'})
WITH q MATCH (p:Paper {name: '2014年高考英语试卷（新课标Ⅰ卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_英语_2014_5', title: '8. When will the man be home from work?', subject: '英语', year: '2014', province: '贵州'})
WITH q MATCH (p:Paper {name: '2014年高考英语试卷（新课标Ⅰ卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2012年高考英语试卷（新课标）（空白卷）.pdf', province: '贵州', subject: '英语', year: '2012', type: '空白卷', volume: '空白卷', preview: '2012年高考英语试卷（新课标版）
第一部分 听力（共两节，满分30分）
做题时，先将答案标在试卷上，录音结束后，你将有两分钟的时间将试卷
上的答案转涂到答题卡上。
第一节 （共5小题，每小题1.5分，满分7.5分）
听下面5段对话。每段对话后有一个小题，从题中所给的A、B、C三个选项
中选出最佳答', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '贵州'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '英语', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '贵州_英语_2012_1', title: '1. Where does this conversation probably take place?', subject: '英语', year: '2012', province: '贵州'})
WITH q MATCH (p:Paper {name: '2012年高考英语试卷（新课标）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_英语_2012_2', title: '2. At what time will the film begin?', subject: '英语', year: '2012', province: '贵州'})
WITH q MATCH (p:Paper {name: '2012年高考英语试卷（新课标）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_英语_2012_3', title: '3. What are the two speakers mainly talking about?', subject: '英语', year: '2012', province: '贵州'})
WITH q MATCH (p:Paper {name: '2012年高考英语试卷（新课标）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_英语_2012_4', title: '6. Whose CD is broken?', subject: '英语', year: '2012', province: '贵州'})
WITH q MATCH (p:Paper {name: '2012年高考英语试卷（新课标）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_英语_2012_5', title: '7. What does the boy promise to do for the girl?', subject: '英语', year: '2012', province: '贵州'})
WITH q MATCH (p:Paper {name: '2012年高考英语试卷（新课标）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2018年高考英语试卷（新课标Ⅰ卷）（空白卷）.pdf', province: '贵州', subject: '英语', year: '2018', type: '空白卷', volume: '新课标Ⅰ卷', preview: '2018年高考英语试卷（新课标Ⅰ卷）
第一部分 听力（共两节，满分30分）
做题时，先将答案标在试卷上，录音结束后，你将有两分钟的时间将试卷
上的答案转涂到答题卡上。
第一节 （共5小题，每小题1.5分，满分7.5分）
听下面5段对话。每段对话后有一个小题，从题中所给的A、B、C三个选项
中选出最佳', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '贵州'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '英语', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '贵州_英语_2018_1', title: '1. What will James do tomorrow?', subject: '英语', year: '2018', province: '贵州'})
WITH q MATCH (p:Paper {name: '2018年高考英语试卷（新课标Ⅰ卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_英语_2018_2', title: '2. What can we say about the woman?', subject: '英语', year: '2018', province: '贵州'})
WITH q MATCH (p:Paper {name: '2018年高考英语试卷（新课标Ⅰ卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_英语_2018_3', title: '3. When does the train leave?', subject: '英语', year: '2018', province: '贵州'})
WITH q MATCH (p:Paper {name: '2018年高考英语试卷（新课标Ⅰ卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_英语_2018_4', title: '7. What is the woman interested in studying now?', subject: '英语', year: '2018', province: '贵州'})
WITH q MATCH (p:Paper {name: '2018年高考英语试卷（新课标Ⅰ卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_英语_2018_5', title: '8. What is the man?', subject: '英语', year: '2018', province: '贵州'})
WITH q MATCH (p:Paper {name: '2018年高考英语试卷（新课标Ⅰ卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2009年高考英语试卷（全国Ⅱ卷）（空白卷）.pdf', province: '贵州', subject: '英语', year: '2009', type: '空白卷', volume: '全国Ⅱ卷', preview: '2009年高考英语试卷（全国卷II）
第一部分 听力（共两节，满分30分）
做题时，先将答案标在试卷上，录音结束后，你将有两分钟的时间将试卷
上的答案转涂到答题卡上。
第一节 （共5小题，每小题1.5分，满分7.5分）
听下面5段对话。每段对话后有一个小题，从题中所给的A、B、C三个选项
中选出最佳', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '贵州'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '英语', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '贵州_英语_2009_1', title: '1. What do the speakers need to buy?', subject: '英语', year: '2009', province: '贵州'})
WITH q MATCH (p:Paper {name: '2009年高考英语试卷（全国Ⅱ卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_英语_2009_2', title: '2. Where are the speakers?', subject: '英语', year: '2009', province: '贵州'})
WITH q MATCH (p:Paper {name: '2009年高考英语试卷（全国Ⅱ卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_英语_2009_3', title: '3. What does the woman mean?', subject: '英语', year: '2009', province: '贵州'})
WITH q MATCH (p:Paper {name: '2009年高考英语试卷（全国Ⅱ卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_英语_2009_4', title: '6. What is the man doing?', subject: '英语', year: '2009', province: '贵州'})
WITH q MATCH (p:Paper {name: '2009年高考英语试卷（全国Ⅱ卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_英语_2009_5', title: '7. What is the woman’s seat number?', subject: '英语', year: '2009', province: '贵州'})
WITH q MATCH (p:Paper {name: '2009年高考英语试卷（全国Ⅱ卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2010年高考英语试卷（新课标Ⅰ卷）（空白卷）.pdf', province: '贵州', subject: '英语', year: '2010', type: '空白卷', volume: '新课标Ⅰ卷', preview: '2010年高考英语试卷（新课标Ⅰ卷）
第一部分 听力（共两节，满分30分）
做题时，先将答案标在试卷上，录音结束后，你将有两分钟的时间将试卷
上的答案转涂到答题卡上。
第一节 （共5小题，每小题1.5分，满分7.5分）
听下面5段对话。每段对话后有一个小题，从题中所给的A、B、C三个选项
中选出最佳', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '贵州'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '英语', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '贵州_英语_2010_1', title: '1. What will Dorothy do on the weekend?', subject: '英语', year: '2010', province: '贵州'})
WITH q MATCH (p:Paper {name: '2010年高考英语试卷（新课标Ⅰ卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_英语_2010_2', title: '2. What was the normal price of the T-shirt?', subject: '英语', year: '2010', province: '贵州'})
WITH q MATCH (p:Paper {name: '2010年高考英语试卷（新课标Ⅰ卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_英语_2010_3', title: '3. What has the woman decided to do on Sunday afternoon?', subject: '英语', year: '2010', province: '贵州'})
WITH q MATCH (p:Paper {name: '2010年高考英语试卷（新课标Ⅰ卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_英语_2010_4', title: '7. What is good about the flat?', subject: '英语', year: '2010', province: '贵州'})
WITH q MATCH (p:Paper {name: '2010年高考英语试卷（新课标Ⅰ卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_英语_2010_5', title: '8. Where has Barbara been?', subject: '英语', year: '2010', province: '贵州'})
WITH q MATCH (p:Paper {name: '2010年高考英语试卷（新课标Ⅰ卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2022年高考地理试卷（全国甲卷）（解析卷）.pdf', province: '贵州', subject: '地理', year: '2022', type: '解析卷', volume: '全国甲卷', preview: '2022 年普通高等学校招生全国统一考试（全国甲卷）地理
一、选择题：本题共 11 小题，每小题 4 分，共 44 分。在每小题给出的四个选项中，只有一
项是符合题目要求的。
浙江S集团是一家研发和生产空调控制元件和零部件的企业，其生产的零部件占全球智能空调配件市
场60%以上的份额。至2017年，', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '贵州'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '地理', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '贵州_地理_2022_1', title: '一、选择题：本题共 11 小题，每小题 4 分，共 44 分。在每小题给出的四个选项中，只有一', subject: '地理', year: '2022', province: '贵州'})
WITH q MATCH (p:Paper {name: '2022年高考地理试卷（全国甲卷）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_地理_2022_2', title: '1. 影响S集团在美国、墨西哥、波兰等国家建厂的主要区位因素是（ ）', subject: '地理', year: '2022', province: '贵州'})
WITH q MATCH (p:Paper {name: '2022年高考地理试卷（全国甲卷）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_地理_2022_3', title: '2. 与国内建厂相比，S集团选择在越南建厂，可以（ ）', subject: '地理', year: '2022', province: '贵州'})
WITH q MATCH (p:Paper {name: '2022年高考地理试卷（全国甲卷）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_地理_2022_4', title: '3. 推测入驻越南的S集团在自建厂房的同时租用厂房的主要目的是（ ）', subject: '地理', year: '2022', province: '贵州'})
WITH q MATCH (p:Paper {name: '2022年高考地理试卷（全国甲卷）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_地理_2022_5', title: '4. 导致吉林、河南两省年秸秆产量差异的主要因素是（ ）', subject: '地理', year: '2022', province: '贵州'})
WITH q MATCH (p:Paper {name: '2022年高考地理试卷（全国甲卷）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2008年高考地理试卷（全国卷Ⅱ）（解析卷）.pdf', province: '贵州', subject: '地理', year: '2008', type: '解析卷', volume: '全国卷Ⅱ', preview: '2008年全国统一高考地理试卷（全国卷Ⅱ）
一、选择题（共4小题，每小题0分，满分0分）
读图．完成1～2题．
1．（4分）①、②、③、④四地段中平均坡度最大的为（ ）
A．① B．② C．③ D．④
2．（4分）海拔低于400米的区域面积约为（ ）
A．0.05 km2 B．0.5km2 C．5 ', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '贵州'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '地理', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '贵州_地理_2008_1', title: '一、选择题（共4小题，每小题0分，满分0分）', subject: '地理', year: '2008', province: '贵州'})
WITH q MATCH (p:Paper {name: '2008年高考地理试卷（全国卷Ⅱ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_地理_2008_2', title: '1．（4分）①、②、③、④四地段中平均坡度最大的为（ ）', subject: '地理', year: '2008', province: '贵州'})
WITH q MATCH (p:Paper {name: '2008年高考地理试卷（全国卷Ⅱ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_地理_2008_3', title: '2．（4分）海拔低于400米的区域面积约为（ ）', subject: '地理', year: '2008', province: '贵州'})
WITH q MATCH (p:Paper {name: '2008年高考地理试卷（全国卷Ⅱ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_地理_2008_4', title: '3．（4分）图中a、b、c分别代表（ ）', subject: '地理', year: '2008', province: '贵州'})
WITH q MATCH (p:Paper {name: '2008年高考地理试卷（全国卷Ⅱ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_地理_2008_5', title: '4．（4分）该生态工业园区中（ ）', subject: '地理', year: '2008', province: '贵州'})
WITH q MATCH (p:Paper {name: '2008年高考地理试卷（全国卷Ⅱ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2010年高考地理试卷（全国卷Ⅱ）（解析卷）.pdf', province: '贵州', subject: '地理', year: '2010', type: '解析卷', volume: '全国卷Ⅱ', preview: '2010年全国统一高考地理试卷（全国卷Ⅱ）
一、选择题（共4小题，每小题0分，满分0分）
如图是2010年3月中旬发生在我国的沙尘暴的一幅遥感影像．图中色调由浅到深
依次是云层、被卷到空中的沙尘和陆地表面．读图完成1～3题．
1．（3分）该沙尘暴发生地位于（ ）
A．副极地低压带 B．西风带 C．副', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '贵州'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '地理', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '贵州_地理_2010_1', title: '一、选择题（共4小题，每小题0分，满分0分）', subject: '地理', year: '2010', province: '贵州'})
WITH q MATCH (p:Paper {name: '2010年高考地理试卷（全国卷Ⅱ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_地理_2010_2', title: '1．（3分）该沙尘暴发生地位于（ ）', subject: '地理', year: '2010', province: '贵州'})
WITH q MATCH (p:Paper {name: '2010年高考地理试卷（全国卷Ⅱ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_地理_2010_3', title: '2．（3分）导致该沙尘暴的天气系统是（ ）', subject: '地理', year: '2010', province: '贵州'})
WITH q MATCH (p:Paper {name: '2010年高考地理试卷（全国卷Ⅱ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_地理_2010_4', title: '3．（3分）影像中部显示的是该沙尘暴的（ ）', subject: '地理', year: '2010', province: '贵州'})
WITH q MATCH (p:Paper {name: '2010年高考地理试卷（全国卷Ⅱ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_地理_2010_5', title: '4．（3分）图中信息表明该河流（ ）', subject: '地理', year: '2010', province: '贵州'})
WITH q MATCH (p:Paper {name: '2010年高考地理试卷（全国卷Ⅱ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2020年高考地理试卷（新课标Ⅲ）（解析卷）.pdf', province: '贵州', subject: '地理', year: '2020', type: '解析卷', volume: '解析卷', preview: '2020 年全国统一高考地理试卷（新课标Ⅲ）
参考答案与试题解析
一、选择题：本题共4小题，共44分。在每小题给出的四个选项中，只有一项是符合题目
要求的。
自20世纪90年代，在经济全球化浪潮下，一些国家之间签订自由贸易协定，降低甚至
取消彼此间部分商品的贸易关税，促进商品的自由贸易。如图示意汽车', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '贵州'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '地理', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '贵州_地理_2020_1', title: '一、选择题：本题共4小题，共44分。在每小题给出的四个选项中，只有一项是符合题目', subject: '地理', year: '2020', province: '贵州'})
WITH q MATCH (p:Paper {name: '2020年高考地理试卷（新课标Ⅲ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_地理_2020_2', title: '1．汽车企业将组装厂由甲国转移至乙国的主要目的是（ ）', subject: '地理', year: '2020', province: '贵州'})
WITH q MATCH (p:Paper {name: '2020年高考地理试卷（新课标Ⅲ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_地理_2020_3', title: '3．该产业布局调整导致甲国汽车的（ ）', subject: '地理', year: '2020', province: '贵州'})
WITH q MATCH (p:Paper {name: '2020年高考地理试卷（新课标Ⅲ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2009年高考地理试卷（全国卷Ⅱ）（解析卷）.pdf', province: '贵州', subject: '地理', year: '2009', type: '解析卷', volume: '全国卷Ⅱ', preview: '2009年全国统一考试地理试卷（全国卷Ⅱ）
一、本卷共4小题，每小题0分，共44分。在每题给出的四个选项中，只有一项
是符合题目要求的。
近期研制出利用玉米叶片加工、编织购物袋的技术，这种购物袋易分解且物美
价廉．据此完成1～3题．
1．（4分）该种购物袋的生产厂应该近（ ）
A．原料产地 B．销售', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '贵州'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '地理', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '贵州_地理_2009_1', title: '一、本卷共4小题，每小题0分，共44分。在每题给出的四个选项中，只有一项', subject: '地理', year: '2009', province: '贵州'})
WITH q MATCH (p:Paper {name: '2009年高考地理试卷（全国卷Ⅱ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_地理_2009_2', title: '1．（4分）该种购物袋的生产厂应该近（ ）', subject: '地理', year: '2009', province: '贵州'})
WITH q MATCH (p:Paper {name: '2009年高考地理试卷（全国卷Ⅱ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_地理_2009_3', title: '2．（4分）以该种购物袋替代目前广泛使用的同类产品，对环境保护的直接作', subject: '地理', year: '2009', province: '贵州'})
WITH q MATCH (p:Paper {name: '2009年高考地理试卷（全国卷Ⅱ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_地理_2009_4', title: '3．（4分）该种购物袋的生产原料在我国的最大产地是（ ）', subject: '地理', year: '2009', province: '贵州'})
WITH q MATCH (p:Paper {name: '2009年高考地理试卷（全国卷Ⅱ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_地理_2009_5', title: '4．（4分）1951﹣﹣2000年，该国（ ）', subject: '地理', year: '2009', province: '贵州'})
WITH q MATCH (p:Paper {name: '2009年高考地理试卷（全国卷Ⅱ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2012年高考地理试卷（大纲卷）（解析卷）.pdf', province: '贵州', subject: '地理', year: '2012', type: '解析卷', volume: '大纲卷', preview: '2012 年全国统一高考地理试卷（大纲卷）
参考答案与试题解析
一、第 I卷共 5小题，每小题 0分，共 140分．在每题给出的四个选项中，只有
一项是符合题目要求的．
如图示意 2008 年中国、美国、印度、日本四个国家的煤炭生产量和消费量．读
图并根据所学知识，完成1～2题．
1．（4分）图示四', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '贵州'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '地理', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '贵州_地理_2012_1', title: '一、第 I卷共 5小题，每小题 0分，共 140分．在每题给出的四个选项中，只有', subject: '地理', year: '2012', province: '贵州'})
WITH q MATCH (p:Paper {name: '2012年高考地理试卷（大纲卷）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_地理_2012_2', title: '1．（4分）图示四个国家中，人均煤炭消费量最高的是（ ）', subject: '地理', year: '2012', province: '贵州'})
WITH q MATCH (p:Paper {name: '2012年高考地理试卷（大纲卷）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_地理_2012_3', title: '2．（4分）借助图示资料可以大致推算出相应国家的（ ）', subject: '地理', year: '2012', province: '贵州'})
WITH q MATCH (p:Paper {name: '2012年高考地理试卷（大纲卷）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2019年高考地理试卷（新课标Ⅲ）（空白卷）.pdf', province: '贵州', subject: '地理', year: '2019', type: '空白卷', volume: '空白卷', preview: '2019 年全国统一高考地理试卷（新课标Ⅲ）
一、选择题：本题共4小题，每小题8分，共44分．在每小题给出的四个选项中，只有一
项是符合题目要求的．
我国人口众多，生活垃圾产生量巨大，迫切需要对垃圾进行无害化、资源化处理。近些
年，某企业开发了厨余垃圾自动处理系统，并在全国很多城市推广。如图示意该厨', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '贵州'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '地理', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '贵州_地理_2019_1', title: '一、选择题：本题共4小题，每小题8分，共44分．在每小题给出的四个选项中，只有一', subject: '地理', year: '2019', province: '贵州'})
WITH q MATCH (p:Paper {name: '2019年高考地理试卷（新课标Ⅲ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_地理_2019_2', title: '1．厨余垃圾是图示自动处理系统中的（ ）', subject: '地理', year: '2019', province: '贵州'})
WITH q MATCH (p:Paper {name: '2019年高考地理试卷（新课标Ⅲ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_地理_2019_3', title: '2．符合图示自动处理系统局部工艺流程的是（ ）', subject: '地理', year: '2019', province: '贵州'})
WITH q MATCH (p:Paper {name: '2019年高考地理试卷（新课标Ⅲ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_地理_2019_4', title: '3．已不再成为我国主要稻谷余粮区的是（ ）', subject: '地理', year: '2019', province: '贵州'})
WITH q MATCH (p:Paper {name: '2019年高考地理试卷（新课标Ⅲ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_地理_2019_5', title: '4．与安徽省相比，黑龙江省稻谷供需盈余的主要条件是（ ）', subject: '地理', year: '2019', province: '贵州'})
WITH q MATCH (p:Paper {name: '2019年高考地理试卷（新课标Ⅲ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2017年高考地理试卷（新课标Ⅲ）（解析卷）.pdf', province: '贵州', subject: '地理', year: '2017', type: '解析卷', volume: '解析卷', preview: '2017 年全国统一高考地理试卷（新课标Ⅲ）
参考答案与试题解析
一、选择题：本题 11小题，每题 4分，满 44分．在每小题给出的四个选项中，
只有一项是符合题目要求的．
剪纸是中国传统民间艺术，2009 年 9 月入选联合国教科文组织人类非物质文化
遗产代表作名录．剪纸表现的内容丰富多彩，反映人', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '贵州'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '地理', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '贵州_地理_2017_1', title: '一、选择题：本题 11小题，每题 4分，满 44分．在每小题给出的四个选项中，', subject: '地理', year: '2017', province: '贵州'})
WITH q MATCH (p:Paper {name: '2017年高考地理试卷（新课标Ⅲ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_地理_2017_2', title: '1．如图剪纸所反映的景观主要分布于我国（ ）', subject: '地理', year: '2017', province: '贵州'})
WITH q MATCH (p:Paper {name: '2017年高考地理试卷（新课标Ⅲ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_地理_2017_3', title: '2．形成这种景观特征的自然条件有（ ）', subject: '地理', year: '2017', province: '贵州'})
WITH q MATCH (p:Paper {name: '2017年高考地理试卷（新课标Ⅲ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2011年高考地理试卷（大纲卷，全国卷Ⅱ）（解析卷）.pdf', province: '贵州', subject: '地理', year: '2011', type: '解析卷', volume: '大纲卷，全国卷Ⅱ', preview: '2011年全国统一高考地理试卷（大纲卷）
一、选择题．第I卷共4小题，每小题0分，共140分．在媒体给出的四个选项中
，只有一项是复合题目要求的．
读图，完成1～2题．
1．（4分）组成该山体岩石的矿物直接来自（ ）
A．地表 B．地壳上部 C．地壳下部 D．地幔
2．（4分）在岩石圈物质循环过程中', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '贵州'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '地理', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '贵州_地理_2011_1', title: '一、选择题．第I卷共4小题，每小题0分，共140分．在媒体给出的四个选项中', subject: '地理', year: '2011', province: '贵州'})
WITH q MATCH (p:Paper {name: '2011年高考地理试卷（大纲卷，全国卷Ⅱ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_地理_2011_2', title: '1．（4分）组成该山体岩石的矿物直接来自（ ）', subject: '地理', year: '2011', province: '贵州'})
WITH q MATCH (p:Paper {name: '2011年高考地理试卷（大纲卷，全国卷Ⅱ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_地理_2011_3', title: '2．（4分）在岩石圈物质循环过程中，该山体岩石在地球表层可转化为（', subject: '地理', year: '2011', province: '贵州'})
WITH q MATCH (p:Paper {name: '2011年高考地理试卷（大纲卷，全国卷Ⅱ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_地理_2011_4', title: '3．（4分）1848年后，芝加哥成为美国中西部农产品集散中心的主导区位条件', subject: '地理', year: '2011', province: '贵州'})
WITH q MATCH (p:Paper {name: '2011年高考地理试卷（大纲卷，全国卷Ⅱ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_地理_2011_5', title: '4．（4分）20世纪之前，芝加哥的工业活动主要联系（ ）', subject: '地理', year: '2011', province: '贵州'})
WITH q MATCH (p:Paper {name: '2011年高考地理试卷（大纲卷，全国卷Ⅱ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2015年高考地理试卷（新课标Ⅱ）（空白卷）.pdf', province: '贵州', subject: '地理', year: '2015', type: '空白卷', volume: '空白卷', preview: '2015 年全国统一高考地理试卷（新课标Ⅱ）
一、选择题．每小题 0分，共 44分，在每个小题给出的四个选项中，只有一项
是符合题目要求的．
桑基、蔗基、果基鱼塘是珠江三角洲地区传统的农业景观和被联合国推介的典型
生态循环农业模式．改革开放以来，随着工业化和城镇化的快速发展，传统
的基塘农业用地大部', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '贵州'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '地理', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '贵州_地理_2015_1', title: '一、选择题．每小题 0分，共 44分，在每个小题给出的四个选项中，只有一项', subject: '地理', year: '2015', province: '贵州'})
WITH q MATCH (p:Paper {name: '2015年高考地理试卷（新课标Ⅱ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_地理_2015_2', title: '1．（4分）该地基塘转变为建设用地对局地气候的影响是（ ）', subject: '地理', year: '2015', province: '贵州'})
WITH q MATCH (p:Paper {name: '2015年高考地理试卷（新课标Ⅱ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_地理_2015_3', title: '2．（4分）农民用花基、菜基鱼塘取代桑基、蔗基鱼塘的直接目的是（ ）', subject: '地理', year: '2015', province: '贵州'})
WITH q MATCH (p:Paper {name: '2015年高考地理试卷（新课标Ⅱ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_地理_2015_4', title: '3．（4 分）桑基、蔗基鱼塘被保留的很少，反映了该生态循环农业模式（ ）', subject: '地理', year: '2015', province: '贵州'})
WITH q MATCH (p:Paper {name: '2015年高考地理试卷（新课标Ⅱ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_地理_2015_5', title: '4．（4分）强沙尘', subject: '地理', year: '2015', province: '贵州'})
WITH q MATCH (p:Paper {name: '2015年高考地理试卷（新课标Ⅱ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2023年高考地理试卷（全国甲卷）（解析卷）.pdf', province: '贵州', subject: '地理', year: '2023', type: '解析卷', volume: '全国甲卷', preview: '地理
一、选择题。
2005年前后，福建泉州开始购买国外优良而昂贵的胡萝卜种子，在沿海沙质土地进行大规模种植。产
品主要出口东亚、东南亚国家，成为全国重要的胡萝卜出口基地。2020年，泉州与中国农业科学院合作培
育的胡萝卜种子已接近国际先进水平，替代了进口种子，当地海关也助力胡萝卜出口基地发展，全程', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '贵州'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '地理', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '贵州_地理_2023_1', title: '一、选择题。', subject: '地理', year: '2023', province: '贵州'})
WITH q MATCH (p:Paper {name: '2023年高考地理试卷（全国甲卷）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_地理_2023_2', title: '1. 泉州成为全国重要胡萝卜出口基地的主要原因是（ ）', subject: '地理', year: '2023', province: '贵州'})
WITH q MATCH (p:Paper {name: '2023年高考地理试卷（全国甲卷）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_地理_2023_3', title: '2. 实现进口种子替代对泉州胡萝卜产业发展的重要作用是（ ）', subject: '地理', year: '2023', province: '贵州'})
WITH q MATCH (p:Paper {name: '2023年高考地理试卷（全国甲卷）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_地理_2023_4', title: '3. 泉州海关助力胡萝卜出口基地发展，重点关注胡萝卜的（ ）', subject: '地理', year: '2023', province: '贵州'})
WITH q MATCH (p:Paper {name: '2023年高考地理试卷（全国甲卷）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_地理_2023_5', title: '4. 影响1790~1870年美国人口分布变化趋势的主要因素是（ ）', subject: '地理', year: '2023', province: '贵州'})
WITH q MATCH (p:Paper {name: '2023年高考地理试卷（全国甲卷）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2018年高考地理试卷（新课标Ⅲ）（解析卷）.pdf', province: '贵州', subject: '地理', year: '2018', type: '解析卷', volume: '解析卷', preview: '2018 年全国统一高考地理试卷（新课标Ⅲ）
参考答案与试题解析
一、选择题：本题共 4小题，每小题 8分，共 44分。在每小题给出的四个选项
中，只有一项是符合题目要求的。
油纸伞是我国非物质文化遗产，采用传统方法、全手工制作，油纸伞以竹为骨，
以纸或丝绸为面，刷桐油以增强韧性并防水，但长期置于干', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '贵州'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '地理', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '贵州_地理_2018_1', title: '一、选择题：本题共 4小题，每小题 8分，共 44分。在每小题给出的四个选项', subject: '地理', year: '2018', province: '贵州'})
WITH q MATCH (p:Paper {name: '2018年高考地理试卷（新课标Ⅲ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_地理_2018_2', title: '1．与现代钢骨布面伞相比，油纸伞走俏国际市场依赖的主要优势是（ ）', subject: '地理', year: '2018', province: '贵州'})
WITH q MATCH (p:Paper {name: '2018年高考地理试卷（新课标Ⅲ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2014年高考地理试卷（新课标Ⅱ）（空白卷）.pdf', province: '贵州', subject: '地理', year: '2014', type: '空白卷', volume: '空白卷', preview: '2014 年全国统一高考地理试卷（新课标Ⅱ）
一、选择题：共 44分．在每个小题给出的四个选项中，只有一项是符合题目要
求的．
珠江三角洲某中心城市周边的农民竞相在自家的宅基地建起了“握手楼”（如图）
据此完成1～2题．
1．（4分）农民建“握手楼”的直接目的是（ ）
A．吸引外来人口定居 B．吸引', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '贵州'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '地理', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '贵州_地理_2014_1', title: '一、选择题：共 44分．在每个小题给出的四个选项中，只有一项是符合题目要', subject: '地理', year: '2014', province: '贵州'})
WITH q MATCH (p:Paper {name: '2014年高考地理试卷（新课标Ⅱ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_地理_2014_2', title: '1．（4分）农民建“握手楼”的直接目的是（ ）', subject: '地理', year: '2014', province: '贵州'})
WITH q MATCH (p:Paper {name: '2014年高考地理试卷（新课标Ⅱ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_地理_2014_3', title: '2．（4分）“握手楼”的修建反映该中心城市（ ）', subject: '地理', year: '2014', province: '贵州'})
WITH q MATCH (p:Paper {name: '2014年高考地理试卷（新课标Ⅱ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_地理_2014_4', title: '3．（4分）甲国位于（ ）', subject: '地理', year: '2014', province: '贵州'})
WITH q MATCH (p:Paper {name: '2014年高考地理试卷（新课标Ⅱ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_地理_2014_5', title: '4．（4 分）2011 年 6 月 21 日，该定单的首批产品从徐州发货．这一日，徐州与', subject: '地理', year: '2014', province: '贵州'})
WITH q MATCH (p:Paper {name: '2014年高考地理试卷（新课标Ⅱ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2021年高考地理试卷（全国甲卷）（解析卷）.pdf', province: '贵州', subject: '地理', year: '2021', type: '解析卷', volume: '全国甲卷', preview: '2021 年普通高等学校招生全国统一考试(甲卷)
地理试题
医用注射剂瓶和用于加工它的玻璃管的生产过程对水、空气等环境条件要求严苛。世界最大的高端玻
璃管生产企业德国某公司,通过对浙江丽水、四川成都、江苏无锡等地比较,最终选定在具有相关产业和生
态环境优良的丽水某山间小镇建生产厂;2017年,从德国', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '贵州'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '地理', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '贵州_地理_2021_1', title: '1. 该公司选择在中国建生产厂,主要是因为中国（ ）', subject: '地理', year: '2021', province: '贵州'})
WITH q MATCH (p:Paper {name: '2021年高考地理试卷（全国甲卷）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_地理_2021_2', title: '2. 该公司最终选定在丽水建生产厂,看中的主要人文地理条件是（ ）', subject: '地理', year: '2021', province: '贵州'})
WITH q MATCH (p:Paper {name: '2021年高考地理试卷（全国甲卷）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_地理_2021_3', title: '3. 丽水山间小镇的生态环境也是吸引该公司投资的重要条件。这说明与大城市相比,该公司在山间小镇建生', subject: '地理', year: '2021', province: '贵州'})
WITH q MATCH (p:Paper {name: '2021年高考地理试卷（全国甲卷）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_地理_2021_4', title: '4. 图中所示这一天所在的月份是（ ）', subject: '地理', year: '2021', province: '贵州'})
WITH q MATCH (p:Paper {name: '2021年高考地理试卷（全国甲卷）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_地理_2021_5', title: '5. 随着光伏发电量的增加,电力净需求量（ ）', subject: '地理', year: '2021', province: '贵州'})
WITH q MATCH (p:Paper {name: '2021年高考地理试卷（全国甲卷）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2016年高考地理试卷（新课标Ⅲ）（空白卷）.pdf', province: '贵州', subject: '地理', year: '2016', type: '空白卷', volume: '空白卷', preview: '2016 年全国统一高考地理试卷（新课标Ⅲ）
一、选择题
目前，我国为保护棉农利益，控制国际棉花进口，国内的棉花价格约比国际市场
高 ；我国纺织行业工人工资一般为美国的 ，是越南、巴基斯坦等国的 3
倍．我国一些纺织企业为利用国际市场棉花，在国外建纺纱厂，并将产品（纱
线）运回国内加工，在我国同行业', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '贵州'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '地理', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '贵州_地理_2016_1', title: '一、选择题', subject: '地理', year: '2016', province: '贵州'})
WITH q MATCH (p:Paper {name: '2016年高考地理试卷（新课标Ⅲ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_地理_2016_2', title: '1．（6 分）如果 K 企业将纺纱厂建在越南、巴基斯坦等国，利润比建在美国高，', subject: '地理', year: '2016', province: '贵州'})
WITH q MATCH (p:Paper {name: '2016年高考地理试卷（新课标Ⅲ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_地理_2016_3', title: '2．（6分）K 企业舍弃越南、巴基斯坦等国而选择在美国建纺纱厂，考虑的主要', subject: '地理', year: '2016', province: '贵州'})
WITH q MATCH (p:Paper {name: '2016年高考地理试卷（新课标Ⅲ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_地理_2016_4', title: '3．（6分）该案例表明，随着工业技术水平的提高，我国纺纱业已大幅度降低了', subject: '地理', year: '2016', province: '贵州'})
WITH q MATCH (p:Paper {name: '2016年高考地理试卷（新课标Ⅲ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_地理_2016_5', title: '6．（6分）今后，上海市引进产业从业人员将主要分布在（ ）', subject: '地理', year: '2016', province: '贵州'})
WITH q MATCH (p:Paper {name: '2016年高考地理试卷（新课标Ⅲ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2013年高考地理试卷（新课标Ⅱ）（空白卷）.pdf', province: '贵州', subject: '地理', year: '2013', type: '空白卷', volume: '空白卷', preview: '2013 年全国统一高考地理试卷（新课标Ⅱ）
一、（每题 4分，共 44分）
如图表示我国部分省级行政区域 2005﹣2010 年间迁移人口比重．迁移人口以青
壮年为主．读图1并结合相关知识，完成1～2题．
1．（4分）2005﹣2010年（ ）
A．迁出人口数量贵州多于四川
B．迁入人口数量上海多', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '贵州'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '地理', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '贵州_地理_2013_1', title: '一、（每题 4分，共 44分）', subject: '地理', year: '2013', province: '贵州'})
WITH q MATCH (p:Paper {name: '2013年高考地理试卷（新课标Ⅱ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_地理_2013_2', title: '1．（4分）2005﹣2010年（ ）', subject: '地理', year: '2013', province: '贵州'})
WITH q MATCH (p:Paper {name: '2013年高考地理试卷（新课标Ⅱ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_地理_2013_3', title: '2．（4分）2005﹣2010年，省级行政区域间的人口迁移（ ）', subject: '地理', year: '2013', province: '贵州'})
WITH q MATCH (p:Paper {name: '2013年高考地理试卷（新课标Ⅱ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_地理_2013_4', title: '3．（4分）我国大部分地区使用地膜覆盖主要在（ ）', subject: '地理', year: '2013', province: '贵州'})
WITH q MATCH (p:Paper {name: '2013年高考地理试卷（新课标Ⅱ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_地理_2013_5', title: '4．（4 分）下列地区相比较，地膜覆盖的保温、保湿、保土作用最显著的是（ ）', subject: '地理', year: '2013', province: '贵州'})
WITH q MATCH (p:Paper {name: '2013年高考地理试卷（新课标Ⅱ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2010年高考化学试卷（全国卷Ⅱ）（空白卷）.pdf', province: '贵州', subject: '化学', year: '2010', type: '空白卷', volume: '全国卷Ⅱ', preview: '2010 年全国统一高考化学试卷（全国卷Ⅱ）
一、选择题
1．（3分）下列反应中，可用离子方程式H++OH﹣=H O表示的是（ ）
2
A．NH Cl+NaOH NaCl+NH ↑+H O
4 3 2
B．Mg（OH） +2HCl=MgCl +2H O
2 2 2
C．NaOH+NaHCO =Na ', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '贵州'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '化学', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '贵州_化学_2010_1', title: '一、选择题', subject: '化学', year: '2010', province: '贵州'})
WITH q MATCH (p:Paper {name: '2010年高考化学试卷（全国卷Ⅱ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_化学_2010_2', title: '1．（3分）下列反应中，可用离子方程式H++OH﹣=H O表示的是（ ）', subject: '化学', year: '2010', province: '贵州'})
WITH q MATCH (p:Paper {name: '2010年高考化学试卷（全国卷Ⅱ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_化学_2010_3', title: '2．（3分）下面均是正丁烷与氧气反应的热化学方程式（25°，101kPa）：', subject: '化学', year: '2010', province: '贵州'})
WITH q MATCH (p:Paper {name: '2010年高考化学试卷（全国卷Ⅱ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_化学_2010_4', title: '5．（3分）若（NH ） SO 在强热时分解的产物是SO 、N 、NH 和H O，则该', subject: '化学', year: '2010', province: '贵州'})
WITH q MATCH (p:Paper {name: '2010年高考化学试卷（全国卷Ⅱ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_化学_2010_5', title: '6．（3 分）在一定温度、压强下，向 100mLCH 和 Ar 的混合气体中通入', subject: '化学', year: '2010', province: '贵州'})
WITH q MATCH (p:Paper {name: '2010年高考化学试卷（全国卷Ⅱ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2023年高考化学试卷（全国甲卷）（解析卷）.pdf', province: '贵州', subject: '化学', year: '2023', type: '解析卷', volume: '全国甲卷', preview: '2023 年普通高等学校招生全国统一考试
理科综合能力测试化学部分(全国甲卷)
可能用到的相对原子质量：F 19 Al 27
一、选择题：本题共 13小题，每小题 6分，共 78分。在每小题给出的四个选项中，只有一
项是符合题目要求的。(化学部分为第 7～13题)
1. 化学与生活密切相关，下列说法', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '贵州'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '化学', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '贵州_化学_2023_1', title: '一、选择题：本题共 13小题，每小题 6分，共 78分。在每小题给出的四个选项中，只有一', subject: '化学', year: '2023', province: '贵州'})
WITH q MATCH (p:Paper {name: '2023年高考化学试卷（全国甲卷）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_化学_2023_2', title: '1. 化学与生活密切相关，下列说法正确的是', subject: '化学', year: '2023', province: '贵州'})
WITH q MATCH (p:Paper {name: '2023年高考化学试卷（全国甲卷）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_化学_2023_3', title: '3. 实验室将粗盐提纯并配制0.1000mol×L-1的NaCl溶液。下列仪器中，本实验必须用到的有', subject: '化学', year: '2023', province: '贵州'})
WITH q MATCH (p:Paper {name: '2023年高考化学试卷（全国甲卷）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2011年高考化学试卷（大纲卷，全国Ⅱ卷）（解析卷）.pdf', province: '贵州', subject: '化学', year: '2011', type: '解析卷', volume: '大纲卷，全国Ⅱ卷', preview: '2011年全国统一高考化学试卷（大纲卷）
参考答案与试题解析
一、选择题
1．等浓度的下列稀溶液：①乙酸、②苯酚、③碳酸、④乙醇，它们的pH由小
到大排列正确的是（ ）
A．④②③① B．③①②④ C．①②③④ D．①③②④
【考点】D8：溶液pH的定义．
菁优网版权所有
【专题】51G：电离平衡与', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '贵州'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '化学', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '贵州_化学_2011_1', title: '一、选择题', subject: '化学', year: '2011', province: '贵州'})
WITH q MATCH (p:Paper {name: '2011年高考化学试卷（大纲卷，全国Ⅱ卷）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_化学_2011_2', title: '1．等浓度的下列稀溶液：①乙酸、②苯酚、③碳酸、④乙醇，它们的pH由小', subject: '化学', year: '2011', province: '贵州'})
WITH q MATCH (p:Paper {name: '2011年高考化学试卷（大纲卷，全国Ⅱ卷）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_化学_2011_3', title: '2．下列叙述错误的是（ ）', subject: '化学', year: '2011', province: '贵州'})
WITH q MATCH (p:Paper {name: '2011年高考化学试卷（大纲卷，全国Ⅱ卷）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2012年高考化学试卷（大纲版）（空白卷）.pdf', province: '贵州', subject: '化学', year: '2012', type: '空白卷', volume: '空白卷', preview: '2012 年全国统一高考化学试卷（大纲版）
一、选择题
1．下列关于化学键的叙述，正确的一项是（ ）
A．离子化合物中一定含有离子键
B．单质分子中均不存在化学键
C．含有极性键的分子一定是极性分子
D．含有共价键的化合物一定是共价化合物
2．能正确表示下列反应的离子方程式是（ ）
A．硫酸铝溶液中', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '贵州'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '化学', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '贵州_化学_2012_1', title: '一、选择题', subject: '化学', year: '2012', province: '贵州'})
WITH q MATCH (p:Paper {name: '2012年高考化学试卷（大纲版）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_化学_2012_2', title: '1．下列关于化学键的叙述，正确的一项是（ ）', subject: '化学', year: '2012', province: '贵州'})
WITH q MATCH (p:Paper {name: '2012年高考化学试卷（大纲版）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_化学_2012_3', title: '2．能正确表示下列反应的离子方程式是（ ）', subject: '化学', year: '2012', province: '贵州'})
WITH q MATCH (p:Paper {name: '2012年高考化学试卷（大纲版）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_化学_2012_4', title: '3．合成氨所需的氢气可用煤和水作原料经多步反应制得，其中的一步反应为：', subject: '化学', year: '2012', province: '贵州'})
WITH q MATCH (p:Paper {name: '2012年高考化学试卷（大纲版）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_化学_2012_5', title: '4．反应 A+B→C（△H＜0）分两步进行 ①A+B→X （△H＞0）②X→C（△H', subject: '化学', year: '2012', province: '贵州'})
WITH q MATCH (p:Paper {name: '2012年高考化学试卷（大纲版）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2015年高考化学试卷（新课标Ⅱ）（解析卷）.pdf', province: '贵州', subject: '化学', year: '2015', type: '解析卷', volume: '解析卷', preview: '2015 年全国统一高考化学试卷（新课标Ⅱ）
参考答案与试题解析
一、选择题（共 7小题，每小题 6分，满分 42分）
1．（6 分）食品干燥剂应无毒、无味、无腐蚀性及环境友好．下列说法错误的
是（ ）
A．硅胶可用作食品干燥剂
B．P O 不可用作食品干燥剂
2 5
C．六水合氯化钙可用作食品干燥', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '贵州'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '化学', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '贵州_化学_2015_1', title: '一、选择题（共 7小题，每小题 6分，满分 42分）', subject: '化学', year: '2015', province: '贵州'})
WITH q MATCH (p:Paper {name: '2015年高考化学试卷（新课标Ⅱ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_化学_2015_2', title: '1．（6 分）食品干燥剂应无毒、无味、无腐蚀性及环境友好．下列说法错误的', subject: '化学', year: '2015', province: '贵州'})
WITH q MATCH (p:Paper {name: '2015年高考化学试卷（新课标Ⅱ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2017年高考化学试卷（新课标Ⅲ）（解析卷）.pdf', province: '贵州', subject: '化学', year: '2017', type: '解析卷', volume: '解析卷', preview: '2017 年全国统一高考化学试卷（新课标Ⅲ）
参考答案与试题解析
一、选择题：本题共 7个小题，每小题 6分，共 42分．在每小题给出的四个选
项中，只有一项是符合题目要求的．
1．（6分）化学与生活密切相关。下列说法错误的是（ ）
A．PM2.5是指粒径不大于2.5μm的可吸入悬浮颗粒物
B．绿色', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '贵州'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '化学', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '贵州_化学_2017_1', title: '一、选择题：本题共 7个小题，每小题 6分，共 42分．在每小题给出的四个选', subject: '化学', year: '2017', province: '贵州'})
WITH q MATCH (p:Paper {name: '2017年高考化学试卷（新课标Ⅲ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_化学_2017_2', title: '1．（6分）化学与生活密切相关。下列说法错误的是（ ）', subject: '化学', year: '2017', province: '贵州'})
WITH q MATCH (p:Paper {name: '2017年高考化学试卷（新课标Ⅲ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_化学_2017_3', title: '2．（6分）下列说法正确的是（ ）', subject: '化学', year: '2017', province: '贵州'})
WITH q MATCH (p:Paper {name: '2017年高考化学试卷（新课标Ⅲ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2019年高考化学试卷（新课标Ⅲ）（空白卷）.pdf', province: '贵州', subject: '化学', year: '2019', type: '空白卷', volume: '空白卷', preview: '2019 年全国统一高考化学试卷（新课标Ⅲ）
一、选择题：本题共7个小题，每小题6分。共42分。在每小题给出的四个选项中，只有
一项是符合题目要求的。
1．（6分）化学与生活密切相关。下列叙述错误的是（ ）
A．高纯硅可用于制作光感电池 B．铝合金大量用于高铁建设
C．活性炭具有除异味和杀菌作用 D', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '贵州'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '化学', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '贵州_化学_2019_1', title: '一、选择题：本题共7个小题，每小题6分。共42分。在每小题给出的四个选项中，只有', subject: '化学', year: '2019', province: '贵州'})
WITH q MATCH (p:Paper {name: '2019年高考化学试卷（新课标Ⅲ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_化学_2019_2', title: '1．（6分）化学与生活密切相关。下列叙述错误的是（ ）', subject: '化学', year: '2019', province: '贵州'})
WITH q MATCH (p:Paper {name: '2019年高考化学试卷（新课标Ⅲ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_化学_2019_3', title: '2．（6分）下列化合物的分子中，所有原子可能共平面的是（ ）', subject: '化学', year: '2019', province: '贵州'})
WITH q MATCH (p:Paper {name: '2019年高考化学试卷（新课标Ⅲ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_化学_2019_4', title: '3．（6分）X、Y、Z均为短周期主族元素，它们原子的最外层电子数之和是10．X与Z同', subject: '化学', year: '2019', province: '贵州'})
WITH q MATCH (p:Paper {name: '2019年高考化学试卷（新课标Ⅲ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_化学_2019_5', title: '4．（6分）离子交换法净化水过程如图所示。下列说法中错误的是（ ）', subject: '化学', year: '2019', province: '贵州'})
WITH q MATCH (p:Paper {name: '2019年高考化学试卷（新课标Ⅲ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2014年高考化学试卷（新课标Ⅱ）（解析卷）.pdf', province: '贵州', subject: '化学', year: '2014', type: '解析卷', volume: '解析卷', preview: '2014 年全国统一高考化学试卷（新课标Ⅱ）
参考答案与试题解析
一、选择题：本题共 7 小题，每小题 6 分，在每小题给出的四个选项中，只有
一项是符合题目要求的．
1．（6分）下列过程没有发生化学反应的是（ ）
A．用活性炭去除冰箱中的异味
B．用热碱水清除炊具上残留的油污
C．用浸泡过高锰酸钾', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '贵州'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '化学', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '贵州_化学_2014_1', title: '一、选择题：本题共 7 小题，每小题 6 分，在每小题给出的四个选项中，只有', subject: '化学', year: '2014', province: '贵州'})
WITH q MATCH (p:Paper {name: '2014年高考化学试卷（新课标Ⅱ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_化学_2014_2', title: '1．（6分）下列过程没有发生化学反应的是（ ）', subject: '化学', year: '2014', province: '贵州'})
WITH q MATCH (p:Paper {name: '2014年高考化学试卷（新课标Ⅱ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_化学_2014_3', title: '2．（6分）四联苯 的一氯代物有（ ）', subject: '化学', year: '2014', province: '贵州'})
WITH q MATCH (p:Paper {name: '2014年高考化学试卷（新课标Ⅱ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2018年高考化学试卷（新课标Ⅲ）（解析卷）.pdf', province: '贵州', subject: '化学', year: '2018', type: '解析卷', volume: '解析卷', preview: '2018 年全国统一高考化学试卷（新课标Ⅲ）
参考答案与试题解析
一、选择题
1．（6分）化学与生活密切相关。下列说法错误的是（ ）
A．泡沫灭火器可用于一般的起火，也适用于电器起火
B．疫苗一般应冷藏存放，以避免蛋白质变性
C．家庭装修时用水性漆替代传统的油性漆，有利于健康及环境
D．电热水器用镁', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '贵州'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '化学', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '贵州_化学_2018_1', title: '一、选择题', subject: '化学', year: '2018', province: '贵州'})
WITH q MATCH (p:Paper {name: '2018年高考化学试卷（新课标Ⅲ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_化学_2018_2', title: '1．（6分）化学与生活密切相关。下列说法错误的是（ ）', subject: '化学', year: '2018', province: '贵州'})
WITH q MATCH (p:Paper {name: '2018年高考化学试卷（新课标Ⅲ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_化学_2018_3', title: '2．（6分）下列叙述正确的是（ ）', subject: '化学', year: '2018', province: '贵州'})
WITH q MATCH (p:Paper {name: '2018年高考化学试卷（新课标Ⅲ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2016年高考化学试卷（新课标Ⅲ）（解析卷）.pdf', province: '贵州', subject: '化学', year: '2016', type: '解析卷', volume: '解析卷', preview: '2016 年全国统一高考化学试卷（新课标Ⅲ）
参考答案与试题解析
一、选择题.
1．（3分）化学在生活中有着广泛的应用，下列对应关系错误的是（ ）
选项 化学性质 实际应用
A ClO 具有强氧化性 自来水消毒杀菌
2
B SO 具有还原性 用作漂白剂
2
C NaHCO 受热易分解并且生成气体 焙', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '贵州'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '化学', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '贵州_化学_2016_1', title: '一、选择题.', subject: '化学', year: '2016', province: '贵州'})
WITH q MATCH (p:Paper {name: '2016年高考化学试卷（新课标Ⅲ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_化学_2016_2', title: '1．（3分）化学在生活中有着广泛的应用，下列对应关系错误的是（ ）', subject: '化学', year: '2016', province: '贵州'})
WITH q MATCH (p:Paper {name: '2016年高考化学试卷（新课标Ⅲ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2013年高考化学试卷（新课标Ⅱ）（解析卷）.pdf', province: '贵州', subject: '化学', year: '2013', type: '解析卷', volume: '解析卷', preview: '2013 年全国统一高考化学试卷（新课标Ⅱ）
参考答案与试题解析
一、选择题：本题共 7 小题，每小题 6 分．在每小题给出的四个选项中，只有
一项是符合题目要求的．
1．（6 分）在一定条件下，动植物油脂与醇反应可制备生物柴油，化学方程式
如图所示：
下列叙述错误的是（ ）
A．生物柴油由可再生资', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '贵州'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '化学', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '贵州_化学_2013_1', title: '一、选择题：本题共 7 小题，每小题 6 分．在每小题给出的四个选项中，只有', subject: '化学', year: '2013', province: '贵州'})
WITH q MATCH (p:Paper {name: '2013年高考化学试卷（新课标Ⅱ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_化学_2013_2', title: '1．（6 分）在一定条件下，动植物油脂与醇反应可制备生物柴油，化学方程式', subject: '化学', year: '2013', province: '贵州'})
WITH q MATCH (p:Paper {name: '2013年高考化学试卷（新课标Ⅱ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2008年高考化学试卷（全国卷Ⅱ）（空白卷）.pdf', province: '贵州', subject: '化学', year: '2008', type: '空白卷', volume: '全国卷Ⅱ', preview: '2008 年全国统一高考化学试卷（全国卷Ⅱ）
一、选择题（共 8小题，每小题 5分，满分 40分）
1．（5 分）2008 年北京奥运会的“祥云”火炬所用燃料的主要成分是丙烷，下列
有关丙烷的叙述中不正确的是（ ）
A．分子中碳原子不在一条直线上
B．光照下能够发生取代反应
C．比丁烷更易液化
D．', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '贵州'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '化学', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '贵州_化学_2008_1', title: '一、选择题（共 8小题，每小题 5分，满分 40分）', subject: '化学', year: '2008', province: '贵州'})
WITH q MATCH (p:Paper {name: '2008年高考化学试卷（全国卷Ⅱ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_化学_2008_2', title: '1．（5 分）2008 年北京奥运会的“祥云”火炬所用燃料的主要成分是丙烷，下列', subject: '化学', year: '2008', province: '贵州'})
WITH q MATCH (p:Paper {name: '2008年高考化学试卷（全国卷Ⅱ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_化学_2008_3', title: '2．（5分）实验室现有3种酸碱指示剂，其pH的变色范围如下：甲基橙：3.1～', subject: '化学', year: '2008', province: '贵州'})
WITH q MATCH (p:Paper {name: '2008年高考化学试卷（全国卷Ⅱ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_化学_2008_4', title: '4.4、石蕊：5.0～8.0、酚酞：8.2～10.0 用 0.1000mol•L﹣1NaOH 溶液滴定未知', subject: '化学', year: '2008', province: '贵州'})
WITH q MATCH (p:Paper {name: '2008年高考化学试卷（全国卷Ⅱ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_化学_2008_5', title: '3．（5分）对于ⅣA 族元素，下列叙述中不正确的是（ ）', subject: '化学', year: '2008', province: '贵州'})
WITH q MATCH (p:Paper {name: '2008年高考化学试卷（全国卷Ⅱ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2021年高考化学试卷（全国甲卷）（空白卷）.pdf', province: '贵州', subject: '化学', year: '2021', type: '空白卷', volume: '全国甲卷', preview: '绝密★考试启用前
2021年普通高等学校招生全国统一考试（甲卷）
理科综合能力测试·化学
可能用到的相对原子质量：H 1 C 12 N 14 O 16 S 32 Cu 64 Zr 91
一、选择题
1. 化学与人体健康及环境保护息息相关。下列叙述正确的是
A. 食品加工时不可添加任何防腐剂
B. 掩', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '贵州'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '化学', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '贵州_化学_2021_1', title: '一、选择题', subject: '化学', year: '2021', province: '贵州'})
WITH q MATCH (p:Paper {name: '2021年高考化学试卷（全国甲卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_化学_2021_2', title: '1. 化学与人体健康及环境保护息息相关。下列叙述正确的是', subject: '化学', year: '2021', province: '贵州'})
WITH q MATCH (p:Paper {name: '2021年高考化学试卷（全国甲卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_化学_2021_3', title: '2. N 为阿伏加德罗常数的值。下列叙述正确的是', subject: '化学', year: '2021', province: '贵州'})
WITH q MATCH (p:Paper {name: '2021年高考化学试卷（全国甲卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_化学_2021_4', title: '3. 实验室制备下列气体的方法可行的是', subject: '化学', year: '2021', province: '贵州'})
WITH q MATCH (p:Paper {name: '2021年高考化学试卷（全国甲卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2022年高考化学试卷（全国甲卷）（空白卷）.pdf', province: '贵州', subject: '化学', year: '2022', type: '空白卷', volume: '全国甲卷', preview: '一、选择题
1. 化学与生活密切相关。下列叙述正确的是
A. 漂白粉与盐酸可混合使用以提高消毒效果 B. 温室气体是形成酸雨的主要物质
C. 棉花、麻和蚕丝均为碳水化合物 D. 干冰可用在舞台上制造“云雾”
2. 辅酶Q 具有预防动脉硬化的功效，其结构简式如下。下列有关辅酶Q 的说法正确的是
10 ', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '贵州'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '化学', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '贵州_化学_2022_1', title: '一、选择题', subject: '化学', year: '2022', province: '贵州'})
WITH q MATCH (p:Paper {name: '2022年高考化学试卷（全国甲卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_化学_2022_2', title: '1. 化学与生活密切相关。下列叙述正确的是', subject: '化学', year: '2022', province: '贵州'})
WITH q MATCH (p:Paper {name: '2022年高考化学试卷（全国甲卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_化学_2022_3', title: '2. 辅酶Q 具有预防动脉硬化的功效，其结构简式如下。下列有关辅酶Q 的说法正确的是', subject: '化学', year: '2022', province: '贵州'})
WITH q MATCH (p:Paper {name: '2022年高考化学试卷（全国甲卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_化学_2022_4', title: '3. 能正确表示下列反应的离子方程式为', subject: '化学', year: '2022', province: '贵州'})
WITH q MATCH (p:Paper {name: '2022年高考化学试卷（全国甲卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_化学_2022_5', title: '4. 一种水性电解液Zn-MnO 离子选择双隔膜电池如图所示(KOH溶液中，Zn2+', subject: '化学', year: '2022', province: '贵州'})
WITH q MATCH (p:Paper {name: '2022年高考化学试卷（全国甲卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2020年高考化学试卷（新课标Ⅲ）（解析卷）.pdf', province: '贵州', subject: '化学', year: '2020', type: '解析卷', volume: '解析卷', preview: '2020 年全国统一高考化学试卷（新课标Ⅲ）
参考答案与试题解析
一、选择题：本题共7小题，每小题6分，共42分。在每小题给出的四个选项中，只有一
项是符合题目要求的．
1．（6分）宋代《千里江山图）描绘了山清水秀的美丽景色，历经千年色彩依然，其中绿色
来自孔雀石颜料（主要成分
为Cu（OH） •C', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '贵州'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '化学', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '贵州_化学_2020_1', title: '一、选择题：本题共7小题，每小题6分，共42分。在每小题给出的四个选项中，只有一', subject: '化学', year: '2020', province: '贵州'})
WITH q MATCH (p:Paper {name: '2020年高考化学试卷（新课标Ⅲ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_化学_2020_2', title: '1．（6分）宋代《千里江山图）描绘了山清水秀的美丽景色，历经千年色彩依然，其中绿色', subject: '化学', year: '2020', province: '贵州'})
WITH q MATCH (p:Paper {name: '2020年高考化学试卷（新课标Ⅲ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_化学_2020_3', title: '2．（6分）金丝桃苷是从中药材中提取的一种具有抗病毒作用的黄酮类化合物，结构式如图：', subject: '化学', year: '2020', province: '贵州'})
WITH q MATCH (p:Paper {name: '2020年高考化学试卷（新课标Ⅲ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2009年高考化学试卷（全国卷Ⅱ）（解析卷）.pdf', province: '贵州', subject: '化学', year: '2009', type: '解析卷', volume: '全国卷Ⅱ', preview: '2009年全国统一高考化学试卷（全国卷Ⅱ）
参考答案与试题解析
一、选择题
1．（3分）物质的量之比为2：5的锌与稀硝酸反应，若硝酸被还原的产物为N
2
O，反应结束后锌没有剩余，则该反应中被还原的硝酸与未被还原的硝酸的
物质的量之比是（ ）
A．1：4 B．1：5 C．2：3 D．2：5
【考点】', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '贵州'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '化学', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '贵州_化学_2009_1', title: '一、选择题', subject: '化学', year: '2009', province: '贵州'})
WITH q MATCH (p:Paper {name: '2009年高考化学试卷（全国卷Ⅱ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_化学_2009_2', title: '1．（3分）物质的量之比为2：5的锌与稀硝酸反应，若硝酸被还原的产物为N', subject: '化学', year: '2009', province: '贵州'})
WITH q MATCH (p:Paper {name: '2009年高考化学试卷（全国卷Ⅱ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2014年高考历史试卷（新课标Ⅱ）（空白卷）.pdf', province: '贵州', subject: '历史', year: '2014', type: '空白卷', volume: '空白卷', preview: '2014 年全国统一高考历史试卷（新课标Ⅱ）
一、选择题（共 12小题，每小题 3分，满分 36分）
1．（3 分）周代分封制下，各封国贵族按“周礼”行事，学说统一的“雅言”，促进
了各地文化的整合。周代的“雅言”最早应起源于现在的（ ）
A．河南 B．河北 C．陕西 D．山东
2．（3分）秦朝法律', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '贵州'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '历史', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '贵州_历史_2014_1', title: '一、选择题（共 12小题，每小题 3分，满分 36分）', subject: '历史', year: '2014', province: '贵州'})
WITH q MATCH (p:Paper {name: '2014年高考历史试卷（新课标Ⅱ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_历史_2014_2', title: '1．（3 分）周代分封制下，各封国贵族按“周礼”行事，学说统一的“雅言”，促进', subject: '历史', year: '2014', province: '贵州'})
WITH q MATCH (p:Paper {name: '2014年高考历史试卷（新课标Ⅱ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_历史_2014_3', title: '2．（3分）秦朝法律规定，私拿养子财物以偷盗罪论处，私拿亲子财物无罪；西', subject: '历史', year: '2014', province: '贵州'})
WITH q MATCH (p:Paper {name: '2014年高考历史试卷（新课标Ⅱ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_历史_2014_4', title: '3．（3 分）北宋中期，“蜀民以铁钱重，私为券，谓之交子，以便贸易，富民十', subject: '历史', year: '2014', province: '贵州'})
WITH q MATCH (p:Paper {name: '2014年高考历史试卷（新课标Ⅱ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_历史_2014_5', title: '4．（3分）明初废丞相、设顾问性质的内阁大学士，严防权臣乱政。明中后期严', subject: '历史', year: '2014', province: '贵州'})
WITH q MATCH (p:Paper {name: '2014年高考历史试卷（新课标Ⅱ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2019年高考历史试卷（新课标Ⅲ）（空白卷）.pdf', province: '贵州', subject: '历史', year: '2019', type: '空白卷', volume: '空白卷', preview: '2019 年全国统一高考历史试卷（新课标Ⅲ）
一、选择题：本题共12小题，每小题4分，共48分。在每小题给出的四个选项中，只有
一项是符合题目要求的。
1．（4分）“教民亲爱，莫善于孝；教民礼顺，莫善于悌；移风易俗，莫善于乐；安上治民，
莫善于礼。”这一思想产生的制度渊源是（ ）
A．宗法制 B．禅', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '贵州'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '历史', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '贵州_历史_2019_1', title: '一、选择题：本题共12小题，每小题4分，共48分。在每小题给出的四个选项中，只有', subject: '历史', year: '2019', province: '贵州'})
WITH q MATCH (p:Paper {name: '2019年高考历史试卷（新课标Ⅲ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_历史_2019_2', title: '1．（4分）“教民亲爱，莫善于孝；教民礼顺，莫善于悌；移风易俗，莫善于乐；安上治民，', subject: '历史', year: '2019', province: '贵州'})
WITH q MATCH (p:Paper {name: '2019年高考历史试卷（新课标Ⅲ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_历史_2019_3', title: '2．（4分）在今新疆和甘肃地区保存的佛教早期造像很多衣衫单薄，甚至裸身，面部表情生', subject: '历史', year: '2019', province: '贵州'})
WITH q MATCH (p:Paper {name: '2019年高考历史试卷（新课标Ⅲ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_历史_2019_4', title: '3．（4分）北宋实行募兵制，兵士待遇较为优厚，应募者以此养家糊口，兵员最多时达120', subject: '历史', year: '2019', province: '贵州'})
WITH q MATCH (p:Paper {name: '2019年高考历史试卷（新课标Ⅲ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_历史_2019_5', title: '4．（4分）乾隆时江南地主“所居在城或他州异县，地亩山场皆委之佃户”。苏州甚至出现', subject: '历史', year: '2019', province: '贵州'})
WITH q MATCH (p:Paper {name: '2019年高考历史试卷（新课标Ⅲ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2022年高考历史试卷（全国甲卷）（空白卷）.pdf', province: '贵州', subject: '历史', year: '2022', type: '空白卷', volume: '全国甲卷', preview: '2022 年高考全国甲卷历史真题
1. 汉晋时期有多种文本记载，帝尧之时，“天下太和，百姓无事”。有老者“击壤”而戏，围观者称颂帝
尧。老者歌云：“吾日出而作，日入而息，凿井而饮，耕地而食，帝何德于我哉！”上述记载所体现的政
治理念最接近（ ）
A. 孔子 B. 老子 C. 韩非 D. 墨子
2. ', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '贵州'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '历史', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '贵州_历史_2022_1', title: '1. 汉晋时期有多种文本记载，帝尧之时，“天下太和，百姓无事”。有老者“击壤”而戏，围观者称颂帝', subject: '历史', year: '2022', province: '贵州'})
WITH q MATCH (p:Paper {name: '2022年高考历史试卷（全国甲卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_历史_2022_2', title: '2. 西晋至唐初，皇子皇弟封王开府，坐镇地方，手握重权。唐玄宗在京城专门修建一座大宅邸，集中安置', subject: '历史', year: '2022', province: '贵州'})
WITH q MATCH (p:Paper {name: '2022年高考历史试卷（全国甲卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_历史_2022_3', title: '3. 宋朝海外贸易中，输出的商品主要是丝织品、瓷器、漆器、铁器等，输入的商品以香料、犀角、象牙、', subject: '历史', year: '2022', province: '贵州'})
WITH q MATCH (p:Paper {name: '2022年高考历史试卷（全国甲卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_历史_2022_4', title: '4. 康熙年间，多次令各地举荐山林隐逸，又令官员推举博学鸿儒，吸收学行兼优之士。开设明史馆，召集', subject: '历史', year: '2022', province: '贵州'})
WITH q MATCH (p:Paper {name: '2022年高考历史试卷（全国甲卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_历史_2022_5', title: '8. 图3为1978年和1987年全国社会商品零售总额中各经济成分所占比重图。图示占比变化反映出', subject: '历史', year: '2022', province: '贵州'})
WITH q MATCH (p:Paper {name: '2022年高考历史试卷（全国甲卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2017年高考历史试卷（新课标Ⅲ）（解析卷）.pdf', province: '贵州', subject: '历史', year: '2017', type: '解析卷', volume: '解析卷', preview: '2017 年全国统一高考历史试卷（新课标Ⅲ）
参考答案与试题解析
一、选择题：本题共 12 小题，每小题 4 分，满分 48 分．在每小题给出的四个
选项中，只有一项是符合题目要求的．
1．（4 分）如图是西周与战国两个时期相同文字的不同写法，反映出字形发生
了变化，促成这一变化的主要因素是（ ）
', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '贵州'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '历史', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '贵州_历史_2017_1', title: '一、选择题：本题共 12 小题，每小题 4 分，满分 48 分．在每小题给出的四个', subject: '历史', year: '2017', province: '贵州'})
WITH q MATCH (p:Paper {name: '2017年高考历史试卷（新课标Ⅲ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_历史_2017_2', title: '1．（4 分）如图是西周与战国两个时期相同文字的不同写法，反映出字形发生', subject: '历史', year: '2017', province: '贵州'})
WITH q MATCH (p:Paper {name: '2017年高考历史试卷（新课标Ⅲ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_历史_2017_3', title: '2．（4 分）《史记》记载，西汉前期，从事农牧业、采矿业、手工业和商业的', subject: '历史', year: '2017', province: '贵州'})
WITH q MATCH (p:Paper {name: '2017年高考历史试卷（新课标Ⅲ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2008年高考历史试卷（全国卷Ⅱ）（解析卷）.pdf', province: '贵州', subject: '历史', year: '2008', type: '解析卷', volume: '全国卷Ⅱ', preview: '2008年普通高等学校招生全国统一考试(全国卷Ⅱ)
文科综合（历史部分）
13．太平天国运动对中国近代化产生了一定影响．这主要表现在它
A．否定了封建土地所有制
B．动摇了清朝的统治基础
C．打击了外国侵略势力
D．实施了发展资本主义的方案
14．冯桂芬在《校邠庐抗议》中提出：“以中国之伦常名教为原', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '贵州'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '历史', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '贵州_历史_2008_1', title: '13．太平天国运动对中国近代化产生了一定影响．这主要表现在它', subject: '历史', year: '2008', province: '贵州'})
WITH q MATCH (p:Paper {name: '2008年高考历史试卷（全国卷Ⅱ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_历史_2008_2', title: '14．冯桂芬在《校邠庐抗议》中提出：“以中国之伦常名教为原本，辅以诸国富强之术。”', subject: '历史', year: '2008', province: '贵州'})
WITH q MATCH (p:Paper {name: '2008年高考历史试卷（全国卷Ⅱ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_历史_2008_3', title: '15．在清末，革命派与维新派的根本分歧在于', subject: '历史', year: '2008', province: '贵州'})
WITH q MATCH (p:Paper {name: '2008年高考历史试卷（全国卷Ⅱ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_历史_2008_4', title: '16．列宁在评论近代中国的某一事件时指出，标榜“自由”、“民主”、“共和”的欧洲资产阶级', subject: '历史', year: '2008', province: '贵州'})
WITH q MATCH (p:Paper {name: '2008年高考历史试卷（全国卷Ⅱ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_历史_2008_5', title: '17．改革开放加速了中国的城市化进程。1978年我国城市数量为l93个，l997年为668个。其', subject: '历史', year: '2008', province: '贵州'})
WITH q MATCH (p:Paper {name: '2008年高考历史试卷（全国卷Ⅱ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2010年高考历史试卷（全国卷Ⅱ）（空白卷）.pdf', province: '贵州', subject: '历史', year: '2010', type: '空白卷', volume: '全国卷Ⅱ', preview: '2010年全国高考历史试卷（全国卷Ⅱ）
一、选择题（共11小题，每小题4分，满分44分）
1．（4分）中国古代常用五行相生相克解释朝代更替，称作“五德”，每个朝代
在“五德”中都有相应的次序。汉代被定为“火德”，通过“禅让”代汉的曹魏应
为（ ）
A．金德 B．木德 C．水德 D．土德
2．（4分）', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '贵州'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '历史', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '贵州_历史_2010_1', title: '一、选择题（共11小题，每小题4分，满分44分）', subject: '历史', year: '2010', province: '贵州'})
WITH q MATCH (p:Paper {name: '2010年高考历史试卷（全国卷Ⅱ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_历史_2010_2', title: '1．（4分）中国古代常用五行相生相克解释朝代更替，称作“五德”，每个朝代', subject: '历史', year: '2010', province: '贵州'})
WITH q MATCH (p:Paper {name: '2010年高考历史试卷（全国卷Ⅱ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_历史_2010_3', title: '2．（4分）唐高祖废汉代以来通行的五铢钱，改行“开元通宝”钱。此后，“开元', subject: '历史', year: '2010', province: '贵州'})
WITH q MATCH (p:Paper {name: '2010年高考历史试卷（全国卷Ⅱ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_历史_2010_4', title: '3．（4分）南朝梁昭明太子萧统编纂的文学总集《文选》在唐代倍受青睐。宋', subject: '历史', year: '2010', province: '贵州'})
WITH q MATCH (p:Paper {name: '2010年高考历史试卷（全国卷Ⅱ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_历史_2010_5', title: '4．（4分）宋人刑昺上疏称：“大臣时业儒，观学徒能具经疏者百不一二，盖传', subject: '历史', year: '2010', province: '贵州'})
WITH q MATCH (p:Paper {name: '2010年高考历史试卷（全国卷Ⅱ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2018年高考历史试卷（新课标Ⅲ）（空白卷）.pdf', province: '贵州', subject: '历史', year: '2018', type: '空白卷', volume: '空白卷', preview: '2018 年全国统一高考历史试卷（新课标Ⅲ）
一、选择题（共 12小题，每小题 4分，满分 48分）
1．（4分）据考古报告，从数十处战国以前的墓葬中发现了铁器实物，这些铁器
不少是自然陨铁制作而成，发现地分布情况见图。据此可知，战国以前（ ）
A．铁制农具得到普遍使用
B．新疆地区与中原联系紧密
', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '贵州'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '历史', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '贵州_历史_2018_1', title: '一、选择题（共 12小题，每小题 4分，满分 48分）', subject: '历史', year: '2018', province: '贵州'})
WITH q MATCH (p:Paper {name: '2018年高考历史试卷（新课标Ⅲ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_历史_2018_2', title: '1．（4分）据考古报告，从数十处战国以前的墓葬中发现了铁器实物，这些铁器', subject: '历史', year: '2018', province: '贵州'})
WITH q MATCH (p:Paper {name: '2018年高考历史试卷（新课标Ⅲ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_历史_2018_3', title: '2．（4分）表 宋代宰相祖辈任官情况表', subject: '历史', year: '2018', province: '贵州'})
WITH q MATCH (p:Paper {name: '2018年高考历史试卷（新课标Ⅲ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_历史_2018_4', title: '3．（4 分）我国第一部药学专书《神农本草经》大约成书于汉代，《唐本草》是', subject: '历史', year: '2018', province: '贵州'})
WITH q MATCH (p:Paper {name: '2018年高考历史试卷（新课标Ⅲ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_历史_2018_5', title: '4．（4分）明朝中期以后，京城及江南地区，雕印出版个人著作之风盛行，有人', subject: '历史', year: '2018', province: '贵州'})
WITH q MATCH (p:Paper {name: '2018年高考历史试卷（新课标Ⅲ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2021年高考历史试卷（全国甲卷）（空白卷）.pdf', province: '贵州', subject: '历史', year: '2021', type: '空白卷', volume: '全国甲卷', preview: '2021 年普通高等学校招生全国统一考试（全国甲卷）文综历史试题
一、选择题
1. 老子认为，“失道而后德，失德而后仁，失仁而后义，失义而后礼”。孔子则说，“不学礼，无以立”，
要“非礼勿视，非礼勿听，非礼勿言，非礼勿动”。这反映出，当时他们
A. 反思西周的礼乐文化 B. 迎合封建贵族政治诉求
C', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '贵州'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '历史', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '贵州_历史_2021_1', title: '一、选择题', subject: '历史', year: '2021', province: '贵州'})
WITH q MATCH (p:Paper {name: '2021年高考历史试卷（全国甲卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_历史_2021_2', title: '1. 老子认为，“失道而后德，失德而后仁，失仁而后义，失义而后礼”。孔子则说，“不学礼，无以立”，', subject: '历史', year: '2021', province: '贵州'})
WITH q MATCH (p:Paper {name: '2021年高考历史试卷（全国甲卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_历史_2021_3', title: '2. 汉代，中央各部门长官与地方各郡太守自行辟召属官，曾一度出现“名公巨卿，以能致贤才为高；而英', subject: '历史', year: '2021', province: '贵州'})
WITH q MATCH (p:Paper {name: '2021年高考历史试卷（全国甲卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_历史_2021_4', title: '3. 宋代盛行婚姻论财，遭到一些士大夫的批评。南宋理学家张弑认为，“婚姻结好，岂为财物？”甚至表', subject: '历史', year: '2021', province: '贵州'})
WITH q MATCH (p:Paper {name: '2021年高考历史试卷（全国甲卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_历史_2021_5', title: '4. 明代，在浙江桐乡县，地方官员若出身进士，当地的秀才就“不胜谄事”，若出身举', subject: '历史', year: '2021', province: '贵州'})
WITH q MATCH (p:Paper {name: '2021年高考历史试卷（全国甲卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2023年高考历史试卷（全国甲卷）（空白卷）.pdf', province: '贵州', subject: '历史', year: '2023', type: '空白卷', volume: '全国甲卷', preview: '2023 年普通高等学校招生全国统一考试（全国甲卷）
历史
1. 西周分封制下，诸侯国君爵位由高到低称为公。侯，伯，子、男。楚国先祖在西周初被封以“子男之
田”春秋时期，楚国国君自称为王，称霸中原，争当华夏盟主，孔子编撰《春秋》仍坚持称楚王为“楚
子”孔子此举目的是（ ）
A. 实录历史事实 B. ', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '贵州'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '历史', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '贵州_历史_2023_1', title: '1. 西周分封制下，诸侯国君爵位由高到低称为公。侯，伯，子、男。楚国先祖在西周初被封以“子男之', subject: '历史', year: '2023', province: '贵州'})
WITH q MATCH (p:Paper {name: '2023年高考历史试卷（全国甲卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_历史_2023_2', title: '2. 在中国古代，自然环境、社会生产状况、国家政策、灾害以及战乱，都会对人口的区域布局产生影响。', subject: '历史', year: '2023', province: '贵州'})
WITH q MATCH (p:Paper {name: '2023年高考历史试卷（全国甲卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_历史_2023_3', title: '3. 民众日常生活能够反映时代特点，下列情景中，可能出现于北宋都城市民日常生活中的是（ ）', subject: '历史', year: '2023', province: '贵州'})
WITH q MATCH (p:Paper {name: '2023年高考历史试卷（全国甲卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_历史_2023_4', title: '4. 明代很多熟读儒经而从事商业活动的人，秉持“虽终日作买卖，不害其为圣为贤”的信条。尽心于实践', subject: '历史', year: '2023', province: '贵州'})
WITH q MATCH (p:Paper {name: '2023年高考历史试卷（全国甲卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_历史_2023_5', title: '7. 中国共产党在成立之初就注重增强阶级基础。中共一大在讨论今后的工作时，“决定集中我们的全部精', subject: '历史', year: '2023', province: '贵州'})
WITH q MATCH (p:Paper {name: '2023年高考历史试卷（全国甲卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2009年高考历史试卷（全国卷Ⅱ）（空白卷）.pdf', province: '贵州', subject: '历史', year: '2009', type: '空白卷', volume: '全国卷Ⅱ', preview: '2009年全国统一高考历史试卷（全国卷Ⅱ）
一、选择题（共12小题，每小题3分，满分36分）
1．（3分）关于中国姓氏起源，唐人柳芳说：“氏于国，则齐鲁秦吴；氏于谥，
则文武成宣……氏于事，则巫乙匠陶。”由此类推，王、侯、公孙等姓氏应
源自（ ）
A．族号 B．邑号 C．爵号 D．官号
2．（3分）', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '贵州'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '历史', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '贵州_历史_2009_1', title: '一、选择题（共12小题，每小题3分，满分36分）', subject: '历史', year: '2009', province: '贵州'})
WITH q MATCH (p:Paper {name: '2009年高考历史试卷（全国卷Ⅱ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_历史_2009_2', title: '1．（3分）关于中国姓氏起源，唐人柳芳说：“氏于国，则齐鲁秦吴；氏于谥，', subject: '历史', year: '2009', province: '贵州'})
WITH q MATCH (p:Paper {name: '2009年高考历史试卷（全国卷Ⅱ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_历史_2009_3', title: '2．（3分）隋唐时期商业经济较之前代有很大的发展，但仍有许多阻碍其进一', subject: '历史', year: '2009', province: '贵州'})
WITH q MATCH (p:Paper {name: '2009年高考历史试卷（全国卷Ⅱ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_历史_2009_4', title: '3．（3分）如图所示战役是（ ）', subject: '历史', year: '2009', province: '贵州'})
WITH q MATCH (p:Paper {name: '2009年高考历史试卷（全国卷Ⅱ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_历史_2009_5', title: '4．（3分）表1 1978、1997年我国工业总产值中各种经济成分比重表（%）', subject: '历史', year: '2009', province: '贵州'})
WITH q MATCH (p:Paper {name: '2009年高考历史试卷（全国卷Ⅱ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2020年高考历史试卷（新课标Ⅲ）（解析卷）.pdf', province: '贵州', subject: '历史', year: '2020', type: '解析卷', volume: '解析卷', preview: '2020 年全国统一高考历史试卷（新课标Ⅲ）
参考答案与试题解析
一、选择题：本题共12小题，每小题4分，共48分。在每小题给出的四个选项中，只有
一项是符合题目要求的。
1．（4分）如图为不同时期的部分货币，据图可知，其形制变化的共同原因是（ ）
A．铸铁技术的进步 B．商品交易的需要
C．审美观', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '贵州'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '历史', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '贵州_历史_2020_1', title: '一、选择题：本题共12小题，每小题4分，共48分。在每小题给出的四个选项中，只有', subject: '历史', year: '2020', province: '贵州'})
WITH q MATCH (p:Paper {name: '2020年高考历史试卷（新课标Ⅲ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_历史_2020_2', title: '1．（4分）如图为不同时期的部分货币，据图可知，其形制变化的共同原因是（ ）', subject: '历史', year: '2020', province: '贵州'})
WITH q MATCH (p:Paper {name: '2020年高考历史试卷（新课标Ⅲ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_历史_2020_3', title: '2．（4分）东汉末年，曹操在许下和各地置田官，大力发展屯田，以解决军粮供应、田亩荒', subject: '历史', year: '2020', province: '贵州'})
WITH q MATCH (p:Paper {name: '2020年高考历史试卷（新课标Ⅲ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_历史_2020_4', title: '3．（4分）唐代书法家张旭曾说：“始吾闻公主与担夫争路，而得笔法之意。后见公孙氏舞', subject: '历史', year: '2020', province: '贵州'})
WITH q MATCH (p:Paper {name: '2020年高考历史试卷（新课标Ⅲ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2016年高考历史试卷（新课标Ⅲ）（空白卷）.pdf', province: '贵州', subject: '历史', year: '2016', type: '空白卷', volume: '空白卷', preview: '2016 年全国统一高考历史试卷（新课标Ⅲ）
一、选择题（共 12小题，每小题 4分，满分 48分）
1．（4分）周代青铜器上的铭文与商代相比，字数越来越多，语句也愈加格式化。
这些铭文大都记述个人业绩，追颂祖先功德，希冀子孙保用。这表明西周时
（ ）
A．创造了一种全新的文字体系 B．形成了重视历', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '贵州'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '历史', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '贵州_历史_2016_1', title: '一、选择题（共 12小题，每小题 4分，满分 48分）', subject: '历史', year: '2016', province: '贵州'})
WITH q MATCH (p:Paper {name: '2016年高考历史试卷（新课标Ⅲ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_历史_2016_2', title: '1．（4分）周代青铜器上的铭文与商代相比，字数越来越多，语句也愈加格式化。', subject: '历史', year: '2016', province: '贵州'})
WITH q MATCH (p:Paper {name: '2016年高考历史试卷（新课标Ⅲ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_历史_2016_3', title: '2．（4 分）东汉王充在《论衡》中说：“萧何入秦，收拾文书（国家档案文献），', subject: '历史', year: '2016', province: '贵州'})
WITH q MATCH (p:Paper {name: '2016年高考历史试卷（新课标Ⅲ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_历史_2016_4', title: '3．（4 分）唐太宗对南朝后期竞相模仿萧子云书法的风气表示不屑，认为其“仅', subject: '历史', year: '2016', province: '贵州'})
WITH q MATCH (p:Paper {name: '2016年高考历史试卷（新课标Ⅲ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_历史_2016_5', title: '6．（4分）1903年，张之洞等拟《奏定学堂章程》，其中规定禁止使用“团体”“膨', subject: '历史', year: '2016', province: '贵州'})
WITH q MATCH (p:Paper {name: '2016年高考历史试卷（新课标Ⅲ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2012年高考历史试卷（大纲版）（解析卷）.pdf', province: '贵州', subject: '历史', year: '2012', type: '解析卷', volume: '解析卷', preview: '2012 年全国统一高考历史试卷（大纲版）
参考答案与试题解析
一、选择题
1．（3 分）秦汉而后，官府下层文职人员俗称“刀笔吏”，这一称谓起因于秦汉
时期此类人员的（ ）
A．工作器具 B．工作内容 C．工作职责 D．工作性质
【考点】ZA：历史文化常识．
菁优网版权所有
【分析】本题主要考查秦汉', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '贵州'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '历史', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '贵州_历史_2012_1', title: '一、选择题', subject: '历史', year: '2012', province: '贵州'})
WITH q MATCH (p:Paper {name: '2012年高考历史试卷（大纲版）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_历史_2012_2', title: '1．（3 分）秦汉而后，官府下层文职人员俗称“刀笔吏”，这一称谓起因于秦汉', subject: '历史', year: '2012', province: '贵州'})
WITH q MATCH (p:Paper {name: '2012年高考历史试卷（大纲版）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_历史_2012_3', title: '2．（3分）唐太宗说：“工商杂色之流…止可厚给财物，必不可超授官秩，与朝', subject: '历史', year: '2012', province: '贵州'})
WITH q MATCH (p:Paper {name: '2012年高考历史试卷（大纲版）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_历史_2012_4', title: '3．（3分）王国维《宋元戏曲考》称：“凡一代有一代之文学……唐之诗、宋之', subject: '历史', year: '2012', province: '贵州'})
WITH q MATCH (p:Paper {name: '2012年高考历史试卷（大纲版）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2013年高考历史试卷（新课标Ⅱ）（解析卷）.pdf', province: '贵州', subject: '历史', year: '2013', type: '解析卷', volume: '解析卷', preview: '2013 年全国统一高考历史试卷（新课标Ⅱ）
参考答案与试题解析
一、选择题（共 12小题，每小题 4分，满分 48分）
1．（4分）司马迁著《史记》时，文献关于黄帝的记述内容不一甚至荒诞，有人
据以否定黄帝的真实性。司马迁游历各地，常常遇到人们传颂黄帝的事迹。
有鉴于此，他从文献中“择其言尤雅者”', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '贵州'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '历史', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '贵州_历史_2013_1', title: '一、选择题（共 12小题，每小题 4分，满分 48分）', subject: '历史', year: '2013', province: '贵州'})
WITH q MATCH (p:Paper {name: '2013年高考历史试卷（新课标Ⅱ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_历史_2013_2', title: '1．（4分）司马迁著《史记》时，文献关于黄帝的记述内容不一甚至荒诞，有人', subject: '历史', year: '2013', province: '贵州'})
WITH q MATCH (p:Paper {name: '2013年高考历史试卷（新课标Ⅱ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2015年高考历史试卷（新课标Ⅱ）（解析卷）.pdf', province: '贵州', subject: '历史', year: '2015', type: '解析卷', volume: '解析卷', preview: '2015 年全国统一高考历史试卷（新课标Ⅱ）
参考答案与试题解析
一、选择题
1．（3分）古代儒家学者批评现实政治，往往称颂夏、商、周“三代”之美，甚至
希望君主像尧、舜一样圣明。这表明了儒者（ ）
A．不能适应现实政治 B．反对进行社会变革
C．理想化的政治诉求 D．以复古为政治目标
【考点】38', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '贵州'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '历史', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '贵州_历史_2015_1', title: '一、选择题', subject: '历史', year: '2015', province: '贵州'})
WITH q MATCH (p:Paper {name: '2015年高考历史试卷（新课标Ⅱ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '贵州_历史_2015_2', title: '1．（3分）古代儒家学者批评现实政治，往往称颂夏、商、周“三代”之美，甚至', subject: '历史', year: '2015', province: '贵州'})
WITH q MATCH (p:Paper {name: '2015年高考历史试卷（新课标Ⅱ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2018年高考语文试卷（新课标Ⅲ卷）（空白卷）.pdf', province: '贵州', subject: '语文', year: '2018', type: '空白卷', volume: '新课标Ⅲ卷', preview: '', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '贵州'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '语文', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)

MERGE (p:Paper {name: '2008年高考语文试卷（全国Ⅰ卷）（解析卷）.pdf', province: '贵州', subject: '语文', year: '2008', type: '解析卷', volume: '全国Ⅰ卷', preview: '', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '贵州'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '语文', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)

MERGE (p:Paper {name: '2023年高考语文试卷（新课标Ⅱ卷）（解析卷）.pdf', province: '贵州', subject: '语文', year: '2023', type: '解析卷', volume: '新课标Ⅱ卷', preview: '', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '贵州'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '语文', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)

MERGE (p:Paper {name: '2017年高考语文试卷（新课标Ⅱ卷）（空白卷）.pdf', province: '贵州', subject: '语文', year: '2017', type: '空白卷', volume: '新课标Ⅱ卷', preview: '', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '贵州'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '语文', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)

MERGE (p:Paper {name: '2020年高考语文试卷（新高考Ⅱ卷）（海南）（空白卷）.pdf', province: '贵州', subject: '语文', year: '2020', type: '空白卷', volume: '新高考Ⅱ卷', preview: '', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '贵州'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '语文', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)

MERGE (p:Paper {name: '2022年高考语文试卷（全国甲卷）（解析卷）.pdf', province: '贵州', subject: '语文', year: '2022', type: '解析卷', volume: '全国甲卷', preview: '', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '贵州'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '语文', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)

MERGE (p:Paper {name: '2009年高考语文试卷（全国Ⅰ卷）（空白卷）.pdf', province: '贵州', subject: '语文', year: '2009', type: '空白卷', volume: '全国Ⅰ卷', preview: '', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '贵州'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '语文', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)

MERGE (p:Paper {name: '2010年高考语文试卷（新课标）（解析卷）.pdf', province: '贵州', subject: '语文', year: '2010', type: '解析卷', volume: '解析卷', preview: '', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '贵州'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '语文', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)

MERGE (p:Paper {name: '2021年高考语文试卷（全国乙卷）（空白卷）.pdf', province: '贵州', subject: '语文', year: '2021', type: '空白卷', volume: '全国乙卷', preview: '', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '贵州'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '语文', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)

MERGE (p:Paper {name: '2014年高考语文试卷（新课标Ⅱ卷）（解析卷）.pdf', province: '贵州', subject: '语文', year: '2014', type: '解析卷', volume: '新课标Ⅱ卷', preview: '', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '贵州'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '语文', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)

MERGE (p:Paper {name: '2013年高考语文试卷（新课标Ⅱ卷）（空白卷）.pdf', province: '贵州', subject: '语文', year: '2013', type: '空白卷', volume: '新课标Ⅱ卷', preview: '', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '贵州'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '语文', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)

MERGE (p:Paper {name: '2015年高考语文试卷（新课标Ⅱ卷）（解析卷）.pdf', province: '贵州', subject: '语文', year: '2015', type: '解析卷', volume: '新课标Ⅱ卷', preview: '', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '贵州'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '语文', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)

MERGE (p:Paper {name: '2012年高考语文试卷（大纲版）（解析卷）.pdf', province: '贵州', subject: '语文', year: '2012', type: '解析卷', volume: '解析卷', preview: '', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '贵州'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '语文', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)

MERGE (p:Paper {name: '2011年高考语文试卷（新课标）（解析卷）.pdf', province: '贵州', subject: '语文', year: '2011', type: '解析卷', volume: '解析卷', preview: '', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '贵州'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '语文', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)

MERGE (p:Paper {name: '2024年高考语文试卷（全国甲卷）（空白卷）.pdf', province: '贵州', subject: '语文', year: '2024', type: '空白卷', volume: '全国甲卷', preview: '', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '贵州'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '语文', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)

MERGE (p:Paper {name: '2016年高考语文试卷（新课标Ⅱ卷）（空白卷）.pdf', province: '贵州', subject: '语文', year: '2016', type: '空白卷', volume: '新课标Ⅱ卷', preview: '', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '贵州'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '语文', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)

MERGE (p:Paper {name: '2019年高考语文试卷（新课标Ⅰ卷）（空白卷）.pdf', province: '贵州', subject: '语文', year: '2019', type: '空白卷', volume: '新课标Ⅰ卷', preview: '', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '贵州'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '语文', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)

MERGE (p:Paper {name: '2024年高考英语试卷（新课标Ⅱ卷）（空白卷）.pdf', province: '广东', subject: '英语', year: '2024', type: '空白卷', volume: '新课标Ⅱ卷', preview: '绝密★启用前
2024 年普通高等学校招生全国统一考试
英语
本试卷共 12页。考试结束后, 将本试卷和答题卡一并交回。
注意事项: 1. 答题前, 考生先将自己的姓名、准考证号码填写清楚, 将条形码准确粘贴在考生
信息条形码粘贴区。
2. 选择题必须使用 2B 铅笔填涂; 非选择题必须使用 0.5', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '广东'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '英语', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '广东_英语_2024_1', title: '2. 选择题必须使用 2B 铅笔填涂; 非选择题必须使用 0.5 毫米黑色字迹的签字笔书写, 字体', subject: '英语', year: '2024', province: '广东'})
WITH q MATCH (p:Paper {name: '2024年高考英语试卷（新课标Ⅱ卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_英语_2024_2', title: '3. 请按照题号顺序在答题卡各题目的答题区域内作答, 超出答题区域书写的答案无效; 在草', subject: '英语', year: '2024', province: '广东'})
WITH q MATCH (p:Paper {name: '2024年高考英语试卷（新课标Ⅱ卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_英语_2024_3', title: '4. 作图可先使用铅笔画出, 确定后必须用黑色字迹的签字笔描黑。', subject: '英语', year: '2024', province: '广东'})
WITH q MATCH (p:Paper {name: '2024年高考英语试卷（新课标Ⅱ卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_英语_2024_4', title: '5. 保持卡面清洁, 不要折叠, 不要弄破、弄皱, 不准使用涂改液、修正带、刮纸刀。', subject: '英语', year: '2024', province: '广东'})
WITH q MATCH (p:Paper {name: '2024年高考英语试卷（新课标Ⅱ卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_英语_2024_5', title: '5. What is Alex doing?', subject: '英语', year: '2024', province: '广东'})
WITH q MATCH (p:Paper {name: '2024年高考英语试卷（新课标Ⅱ卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2011年高考英语试卷（新课标）（解析卷）.pdf', province: '广东', subject: '英语', year: '2011', type: '解析卷', volume: '解析卷', preview: '2011年高考英语试卷（新课标卷）
参考答案与试题解析
第一部分 听力（共两节，满分30分）
做题时，先将答案标在试卷上，录音结束后，你将有两分钟的时间将试卷
上的答案转涂到答题卡上。
第一节 （共5小题，每小题1.5分，满分7.5分）
听下面5段对话。每段对话后有一个小题，从题中所给的A、B、C三', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '广东'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '英语', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '广东_英语_2011_1', title: '1. What does the man like about the play?', subject: '英语', year: '2011', province: '广东'})
WITH q MATCH (p:Paper {name: '2011年高考英语试卷（新课标）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_英语_2011_2', title: '2. Which place are the speakers trying to find?', subject: '英语', year: '2011', province: '广东'})
WITH q MATCH (p:Paper {name: '2011年高考英语试卷（新课标）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_英语_2011_3', title: '3. At what time will the two speakers meet?', subject: '英语', year: '2011', province: '广东'})
WITH q MATCH (p:Paper {name: '2011年高考英语试卷（新课标）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_英语_2011_4', title: '6. Where is Ben?', subject: '英语', year: '2011', province: '广东'})
WITH q MATCH (p:Paper {name: '2011年高考英语试卷（新课标）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_英语_2011_5', title: '7. What will the children in the afternoon?', subject: '英语', year: '2011', province: '广东'})
WITH q MATCH (p:Paper {name: '2011年高考英语试卷（新课标）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2016年高考英语试卷（新课标Ⅲ卷）（解析卷）.pdf', province: '广东', subject: '英语', year: '2016', type: '解析卷', volume: '新课标Ⅲ卷', preview: '2016年高考英语试卷（新课标Ⅲ）
第一部分 听力（共两节，满分30分）
做题时，先将答案标在试卷上，录音结束后，你将有两分钟的时间将试卷
上的答案转涂到答题卡上。
第一节 （共5小题，每小题1.5分，满分7.5分）
听下面5段对话。每段对话后有一个小题，从题中所给的A、B、C三个选项
中选出最佳答', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '广东'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '英语', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '广东_英语_2016_1', title: '1. What will Lucy do at 11:30 tomorrow?', subject: '英语', year: '2016', province: '广东'})
WITH q MATCH (p:Paper {name: '2016年高考英语试卷（新课标Ⅲ卷）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_英语_2016_2', title: '2. What is the weather like now?', subject: '英语', year: '2016', province: '广东'})
WITH q MATCH (p:Paper {name: '2016年高考英语试卷（新课标Ⅲ卷）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_英语_2016_3', title: '3. Why does the man talk to Dr. Simpson?', subject: '英语', year: '2016', province: '广东'})
WITH q MATCH (p:Paper {name: '2016年高考英语试卷（新课标Ⅲ卷）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_英语_2016_4', title: '6. What time is it now?', subject: '英语', year: '2016', province: '广东'})
WITH q MATCH (p:Paper {name: '2016年高考英语试卷（新课标Ⅲ卷）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_英语_2016_5', title: '7. What will the man do?', subject: '英语', year: '2016', province: '广东'})
WITH q MATCH (p:Paper {name: '2016年高考英语试卷（新课标Ⅲ卷）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2020年高考英语试卷（新高考Ⅰ卷）（山东）（空白卷）.pdf', province: '广东', subject: '英语', year: '2020', type: '空白卷', volume: '新高考Ⅰ卷', preview: '2020 年普通高等学校招生全国统一考试·新高考Ⅰ卷
英语
注意事项:
1.答卷前, 考生务必将自己的姓名、准考证号填写在答题卡上。
2.回答选择题时, 选出每小题答案后, 用铅笔把答题卡上对应题目的答案标号涂黑。如需改动,
用橡皮擦干净后, 再选涂其他答案标号。回答非选择题时, 将答案写在答题卡上', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '广东'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '英语', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '广东_英语_2020_1', title: '1.答卷前, 考生务必将自己的姓名、准考证号填写在答题卡上。', subject: '英语', year: '2020', province: '广东'})
WITH q MATCH (p:Paper {name: '2020年高考英语试卷（新高考Ⅰ卷）（山东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_英语_2020_2', title: '2.回答选择题时, 选出每小题答案后, 用铅笔把答题卡上对应题目的答案标号涂黑。如需改动,', subject: '英语', year: '2020', province: '广东'})
WITH q MATCH (p:Paper {name: '2020年高考英语试卷（新高考Ⅰ卷）（山东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_英语_2020_3', title: '用橡皮擦干净后, 再选涂其他答案标号。回答非选择题时, 将答案写在答题卡上, 写在本试卷', subject: '英语', year: '2020', province: '广东'})
WITH q MATCH (p:Paper {name: '2020年高考英语试卷（新高考Ⅰ卷）（山东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_英语_2020_4', title: '3.考试结束后, 将本试卷和答题卡一并交回。', subject: '英语', year: '2020', province: '广东'})
WITH q MATCH (p:Paper {name: '2020年高考英语试卷（新高考Ⅰ卷）（山东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_英语_2020_5', title: '2. What will each of the honorable mention winners get?', subject: '英语', year: '2020', province: '广东'})
WITH q MATCH (p:Paper {name: '2020年高考英语试卷（新高考Ⅰ卷）（山东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2013年高考英语试卷（新课标Ⅰ卷）（空白卷）.pdf', province: '广东', subject: '英语', year: '2013', type: '空白卷', volume: '新课标Ⅰ卷', preview: '2013年高考英语试卷（新课标I）
第一部分 听力（共两节，满分30分）
做题时，先将答案标在试卷上，录音结束后，你将有两分钟的时间将试卷
上的答案转涂到答题卡上。
第一节 （共5小题，每小题1.5分，满分7.5分）
听下面5段对话。每段对话后有一个小题，从题中所给的A、B、C三个选项
中选出最佳答', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '广东'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '英语', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '广东_英语_2013_1', title: '1. What does the man want to do?', subject: '英语', year: '2013', province: '广东'})
WITH q MATCH (p:Paper {name: '2013年高考英语试卷（新课标Ⅰ卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_英语_2013_2', title: '2. What are the speakers talking about?', subject: '英语', year: '2013', province: '广东'})
WITH q MATCH (p:Paper {name: '2013年高考英语试卷（新课标Ⅰ卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_英语_2013_3', title: '3. Where is the man now?', subject: '英语', year: '2013', province: '广东'})
WITH q MATCH (p:Paper {name: '2013年高考英语试卷（新课标Ⅰ卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_英语_2013_4', title: '6. What is Sara going to do?', subject: '英语', year: '2013', province: '广东'})
WITH q MATCH (p:Paper {name: '2013年高考英语试卷（新课标Ⅰ卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_英语_2013_5', title: '7. What does the man think of Sara’s plan?', subject: '英语', year: '2013', province: '广东'})
WITH q MATCH (p:Paper {name: '2013年高考英语试卷（新课标Ⅰ卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2017年高考英语试卷（新课标Ⅲ卷）（空白卷）.pdf', province: '广东', subject: '英语', year: '2017', type: '空白卷', volume: '新课标Ⅲ卷', preview: '2017年高考英语试卷（新课标Ⅲ卷）
第一部分 听力（共两节，满分30分）
做题时，先将答案标在试卷上，录音结束后，你将有两分钟的时间将试卷
上的答案转涂到答题卡上。
第一节 （共5小题，每小题1.5分，满分7.5分）
听下面5段对话。每段对话后有一个小题，从题中所给的A、B、C三个选项
中选出最佳', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '广东'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '英语', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '广东_英语_2017_1', title: '1. What will the woman do this afternoon?', subject: '英语', year: '2017', province: '广东'})
WITH q MATCH (p:Paper {name: '2017年高考英语试卷（新课标Ⅲ卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_英语_2017_2', title: '2. Why does the woman call the man?', subject: '英语', year: '2017', province: '广东'})
WITH q MATCH (p:Paper {name: '2017年高考英语试卷（新课标Ⅲ卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_英语_2017_3', title: '3. How much more does David need fo', subject: '英语', year: '2017', province: '广东'})
WITH q MATCH (p:Paper {name: '2017年高考英语试卷（新课标Ⅲ卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_英语_2017_4', title: '7. Where does the conversation probably take place?', subject: '英语', year: '2017', province: '广东'})
WITH q MATCH (p:Paper {name: '2017年高考英语试卷（新课标Ⅲ卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_英语_2017_5', title: '8. What does Richard do?', subject: '英语', year: '2017', province: '广东'})
WITH q MATCH (p:Paper {name: '2017年高考英语试卷（新课标Ⅲ卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2019年高考英语试卷（新课标Ⅰ卷）（空白卷）.pdf', province: '广东', subject: '英语', year: '2019', type: '空白卷', volume: '新课标Ⅰ卷', preview: '2019年普通高等学校招生全国统一考试(新课标I)
英 语
注意事项:
1.答卷前，考生务必将自己的姓名、准考证号填写在答题卡上。
2.回答选择题时，选出每小题答案后，用铅笔把答题卡上对应题目的答案标号涂黑。如需改
动，用橡皮擦干净后，再选涂其他答案标号。回答非选择题时，将答案写在答题卡上，写在
本', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '广东'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '英语', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '广东_英语_2019_1', title: '1.答卷前，考生务必将自己的姓名、准考证号填写在答题卡上。', subject: '英语', year: '2019', province: '广东'})
WITH q MATCH (p:Paper {name: '2019年高考英语试卷（新课标Ⅰ卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_英语_2019_2', title: '2.回答选择题时，选出每小题答案后，用铅笔把答题卡上对应题目的答案标号涂黑。如需改', subject: '英语', year: '2019', province: '广东'})
WITH q MATCH (p:Paper {name: '2019年高考英语试卷（新课标Ⅰ卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_英语_2019_3', title: '动，用橡皮擦干净后，再选涂其他答案标号。回答非选择题时，将答案写在答题卡上，写在', subject: '英语', year: '2019', province: '广东'})
WITH q MATCH (p:Paper {name: '2019年高考英语试卷（新课标Ⅰ卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_英语_2019_4', title: '3.考试结束后，将本试卷和答题卡一并交回。', subject: '英语', year: '2019', province: '广东'})
WITH q MATCH (p:Paper {name: '2019年高考英语试卷（新课标Ⅰ卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_英语_2019_5', title: '1.Where does this conversation take place?', subject: '英语', year: '2019', province: '广东'})
WITH q MATCH (p:Paper {name: '2019年高考英语试卷（新课标Ⅰ卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2021年高考英语试卷（全国乙卷）（新课标Ⅰ）（空白卷）.pdf', province: '广东', subject: '英语', year: '2021', type: '空白卷', volume: '全国乙卷', preview: '2021 年普通高等学校招生全国统一考试（全国乙卷）
英 语
注意事项:
1．答卷前,考生务必将自己的姓名、准考证号填写在答题卡上。
2．回答选择题时，选出每小题答案后，用铅笔把答题卡上对应题目的答案标号
涂黑。如需改动，用橡皮擦干净后，再选涂其他答案标号。回答非选择题时，将
答案写在答题卡上,写在', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '广东'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '英语', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '广东_英语_2021_1', title: '1．答卷前,考生务必将自己的姓名、准考证号填写在答题卡上。', subject: '英语', year: '2021', province: '广东'})
WITH q MATCH (p:Paper {name: '2021年高考英语试卷（全国乙卷）（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_英语_2021_2', title: '2．回答选择题时，选出每小题答案后，用铅笔把答题卡上对应题目的答案标号', subject: '英语', year: '2021', province: '广东'})
WITH q MATCH (p:Paper {name: '2021年高考英语试卷（全国乙卷）（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_英语_2021_3', title: '涂黑。如需改动，用橡皮擦干净后，再选涂其他答案标号。回答非选择题时，将', subject: '英语', year: '2021', province: '广东'})
WITH q MATCH (p:Paper {name: '2021年高考英语试卷（全国乙卷）（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_英语_2021_4', title: '3.考试结束后,将本试卷和答题卡一并交回。', subject: '英语', year: '2021', province: '广东'})
WITH q MATCH (p:Paper {name: '2021年高考英语试卷（全国乙卷）（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_英语_2021_5', title: '1.What is the man doing?', subject: '英语', year: '2021', province: '广东'})
WITH q MATCH (p:Paper {name: '2021年高考英语试卷（全国乙卷）（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2022年高考英语试卷（全国甲卷）（解析卷）.pdf', province: '广东', subject: '英语', year: '2022', type: '解析卷', volume: '全国甲卷', preview: '2022 年普通高等学校招生全国统一考试
英语
注意事项：
1. 答卷前，考生务必将自己的姓名、准考证号填写在答题卡上。
2. 回答选择题时，选出每小题答案后，用铅笔把答题卡上对应题目的答案标号涂黑。如需改
动，用橡皮擦干净后，再选涂其他答案标号。回答非选择题时，将答案写在答题卡上，写在
本试卷上无', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '广东'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '英语', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '广东_英语_2022_1', title: '1. 答卷前，考生务必将自己的姓名、准考证号填写在答题卡上。', subject: '英语', year: '2022', province: '广东'})
WITH q MATCH (p:Paper {name: '2022年高考英语试卷（全国甲卷）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_英语_2022_2', title: '2. 回答选择题时，选出每小题答案后，用铅笔把答题卡上对应题目的答案标号涂黑。如需改', subject: '英语', year: '2022', province: '广东'})
WITH q MATCH (p:Paper {name: '2022年高考英语试卷（全国甲卷）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_英语_2022_3', title: '动，用橡皮擦干净后，再选涂其他答案标号。回答非选择题时，将答案写在答题卡上，写在', subject: '英语', year: '2022', province: '广东'})
WITH q MATCH (p:Paper {name: '2022年高考英语试卷（全国甲卷）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_英语_2022_4', title: '3. 考试结束后，将本试卷和答题卡一并交回。', subject: '英语', year: '2022', province: '广东'})
WITH q MATCH (p:Paper {name: '2022年高考英语试卷（全国甲卷）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_英语_2022_5', title: '1. What does the man want to do?', subject: '英语', year: '2022', province: '广东'})
WITH q MATCH (p:Paper {name: '2022年高考英语试卷（全国甲卷）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2015年高考英语试卷（新课标Ⅰ卷）（解析卷）.pdf', province: '广东', subject: '英语', year: '2015', type: '解析卷', volume: '新课标Ⅰ卷', preview: '2015年高考英语试卷（新课标Ⅰ）
参考答案与试题解析
第一部分 听力（共两节，满分30分）
做题时，先将答案标在试卷上，录音结束后，你将有两分钟的时间将试卷
上的答案转涂到答题卡上。
第一节 （共5小题，每小题1.5分，满分7.5分）
听下面5段对话。每段对话后有一个小题，从题中所给的A、B、C三', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '广东'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '英语', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '广东_英语_2015_1', title: '1. What time is it now?', subject: '英语', year: '2015', province: '广东'})
WITH q MATCH (p:Paper {name: '2015年高考英语试卷（新课标Ⅰ卷）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_英语_2015_2', title: '2. What does the woman think of the weather?', subject: '英语', year: '2015', province: '广东'})
WITH q MATCH (p:Paper {name: '2015年高考英语试卷（新课标Ⅰ卷）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_英语_2015_3', title: '3. What will the man do?', subject: '英语', year: '2015', province: '广东'})
WITH q MATCH (p:Paper {name: '2015年高考英语试卷（新课标Ⅰ卷）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_英语_2015_4', title: '4. What', subject: '英语', year: '2015', province: '广东'})
WITH q MATCH (p:Paper {name: '2015年高考英语试卷（新课标Ⅰ卷）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_英语_2015_5', title: '6. How long did Michael stay in China?', subject: '英语', year: '2015', province: '广东'})
WITH q MATCH (p:Paper {name: '2015年高考英语试卷（新课标Ⅰ卷）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2023年高考英语试卷（全国乙卷）（空白卷）.pdf', province: '广东', subject: '英语', year: '2023', type: '空白卷', volume: '全国乙卷', preview: '2023 年普通高等学校招生全国统一考试(全国乙卷)
英语学科
注意事项：
1.答卷前，考生务必将自己的姓名、准考证号填写在答题卡上，并将自己的姓名、准考
证号、座位号填写在本试卷上。
2.回答选择题时,选出每小题答案后,用 2B 铅笔把答题卡上对应题目的答案标号涂黑;如
需改动，用橡皮擦干净后，再', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '广东'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '英语', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '广东_英语_2023_1', title: '1.答卷前，考生务必将自己的姓名、准考证号填写在答题卡上，并将自己的姓名、准考', subject: '英语', year: '2023', province: '广东'})
WITH q MATCH (p:Paper {name: '2023年高考英语试卷（全国乙卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_英语_2023_2', title: '2.回答选择题时,选出每小题答案后,用 2B 铅笔把答题卡上对应题目的答案标号涂黑;如', subject: '英语', year: '2023', province: '广东'})
WITH q MATCH (p:Paper {name: '2023年高考英语试卷（全国乙卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_英语_2023_3', title: '3.作答非选择题时，将答案书写在答题卡上，书写在本试卷上无效。', subject: '英语', year: '2023', province: '广东'})
WITH q MATCH (p:Paper {name: '2023年高考英语试卷（全国乙卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_英语_2023_4', title: '4．考试结束后，将本试卷和答题卡一并交回。', subject: '英语', year: '2023', province: '广东'})
WITH q MATCH (p:Paper {name: '2023年高考英语试卷（全国乙卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_英语_2023_5', title: '1. 【此处可播放相关音频，请去附件查看】', subject: '英语', year: '2023', province: '广东'})
WITH q MATCH (p:Paper {name: '2023年高考英语试卷（全国乙卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2008年高考英语试卷（全国Ⅰ卷）（空白卷）.pdf', province: '广东', subject: '英语', year: '2008', type: '空白卷', volume: '全国Ⅰ卷', preview: '2008年高考英语试卷（全国卷I）
第一部分 听力（共两节，满分30分）
做题时，先将答案标在试卷上，录音结束后，你将有两分钟的时间将试卷
上的答案转涂到答题卡上。
第一节 （共5小题，每小题1.5分，满分7.5分）
听下面5段对话。每段对话后有一个小题，从题中所给的A、B、C三个选项
中选出最佳答', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '广东'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '英语', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '广东_英语_2008_1', title: '1. What is the weather like?', subject: '英语', year: '2008', province: '广东'})
WITH q MATCH (p:Paper {name: '2008年高考英语试卷（全国Ⅰ卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_英语_2008_2', title: '2. Who will go to China next month?', subject: '英语', year: '2008', province: '广东'})
WITH q MATCH (p:Paper {name: '2008年高考英语试卷（全国Ⅰ卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_英语_2008_3', title: '3. What are the speakers talking about?', subject: '英语', year: '2008', province: '广东'})
WITH q MATCH (p:Paper {name: '2008年高考英语试卷（全国Ⅰ卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_英语_2008_4', title: '4. Where wi', subject: '英语', year: '2008', province: '广东'})
WITH q MATCH (p:Paper {name: '2008年高考英语试卷（全国Ⅰ卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_英语_2008_5', title: '7. How old was the baby when the woman left New York?', subject: '英语', year: '2008', province: '广东'})
WITH q MATCH (p:Paper {name: '2008年高考英语试卷（全国Ⅰ卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2014年高考英语试卷（新课标Ⅰ卷）（空白卷）.pdf', province: '广东', subject: '英语', year: '2014', type: '空白卷', volume: '新课标Ⅰ卷', preview: '2014年高考英语试卷（新课标Ⅰ）
第一部分 听力（共两节，满分30分）
做题时，先将答案标在试卷上，录音结束后，你将有两分钟的时间将试卷
上的答案转涂到答题卡上。
第一节 （共5小题，每小题1.5分，满分7.5分）
听下面5段对话。每段对话后有一个小题，从题中所给的A、B、C三个选项
中选出最佳答', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '广东'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '英语', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '广东_英语_2014_1', title: '1. What does the woman want to do?', subject: '英语', year: '2014', province: '广东'})
WITH q MATCH (p:Paper {name: '2014年高考英语试卷（新课标Ⅰ卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_英语_2014_2', title: '2. What will the man do for the woman?', subject: '英语', year: '2014', province: '广东'})
WITH q MATCH (p:Paper {name: '2014年高考英语试卷（新课标Ⅰ卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_英语_2014_3', title: '3. Who might Mr. Peterson be?', subject: '英语', year: '2014', province: '广东'})
WITH q MATCH (p:Paper {name: '2014年高考英语试卷（新课标Ⅰ卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_英语_2014_4', title: '7. What will the woman probably do next?', subject: '英语', year: '2014', province: '广东'})
WITH q MATCH (p:Paper {name: '2014年高考英语试卷（新课标Ⅰ卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_英语_2014_5', title: '8. When will the man be home from work?', subject: '英语', year: '2014', province: '广东'})
WITH q MATCH (p:Paper {name: '2014年高考英语试卷（新课标Ⅰ卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2012年高考英语试卷（新课标）（空白卷）.pdf', province: '广东', subject: '英语', year: '2012', type: '空白卷', volume: '空白卷', preview: '2012年高考英语试卷（新课标版）
第一部分 听力（共两节，满分30分）
做题时，先将答案标在试卷上，录音结束后，你将有两分钟的时间将试卷
上的答案转涂到答题卡上。
第一节 （共5小题，每小题1.5分，满分7.5分）
听下面5段对话。每段对话后有一个小题，从题中所给的A、B、C三个选项
中选出最佳答', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '广东'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '英语', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '广东_英语_2012_1', title: '1. Where does this conversation probably take place?', subject: '英语', year: '2012', province: '广东'})
WITH q MATCH (p:Paper {name: '2012年高考英语试卷（新课标）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_英语_2012_2', title: '2. At what time will the film begin?', subject: '英语', year: '2012', province: '广东'})
WITH q MATCH (p:Paper {name: '2012年高考英语试卷（新课标）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_英语_2012_3', title: '3. What are the two speakers mainly talking about?', subject: '英语', year: '2012', province: '广东'})
WITH q MATCH (p:Paper {name: '2012年高考英语试卷（新课标）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_英语_2012_4', title: '6. Whose CD is broken?', subject: '英语', year: '2012', province: '广东'})
WITH q MATCH (p:Paper {name: '2012年高考英语试卷（新课标）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_英语_2012_5', title: '7. What does the boy promise to do for the girl?', subject: '英语', year: '2012', province: '广东'})
WITH q MATCH (p:Paper {name: '2012年高考英语试卷（新课标）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2018年高考英语试卷（新课标Ⅰ卷）（空白卷）.pdf', province: '广东', subject: '英语', year: '2018', type: '空白卷', volume: '新课标Ⅰ卷', preview: '2018年高考英语试卷（新课标Ⅰ卷）
第一部分 听力（共两节，满分30分）
做题时，先将答案标在试卷上，录音结束后，你将有两分钟的时间将试卷
上的答案转涂到答题卡上。
第一节 （共5小题，每小题1.5分，满分7.5分）
听下面5段对话。每段对话后有一个小题，从题中所给的A、B、C三个选项
中选出最佳', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '广东'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '英语', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '广东_英语_2018_1', title: '1. What will James do tomorrow?', subject: '英语', year: '2018', province: '广东'})
WITH q MATCH (p:Paper {name: '2018年高考英语试卷（新课标Ⅰ卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_英语_2018_2', title: '2. What can we say about the woman?', subject: '英语', year: '2018', province: '广东'})
WITH q MATCH (p:Paper {name: '2018年高考英语试卷（新课标Ⅰ卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_英语_2018_3', title: '3. When does the train leave?', subject: '英语', year: '2018', province: '广东'})
WITH q MATCH (p:Paper {name: '2018年高考英语试卷（新课标Ⅰ卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_英语_2018_4', title: '7. What is the woman interested in studying now?', subject: '英语', year: '2018', province: '广东'})
WITH q MATCH (p:Paper {name: '2018年高考英语试卷（新课标Ⅰ卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_英语_2018_5', title: '8. What is the man?', subject: '英语', year: '2018', province: '广东'})
WITH q MATCH (p:Paper {name: '2018年高考英语试卷（新课标Ⅰ卷）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2013年高考历史试卷（广东）（空白卷）.pdf', province: '广东', subject: '历史', year: '2013', type: '空白卷', volume: '空白卷', preview: '2013 年广东省高考历史试卷
一、选择题
1．（4分）战国以前，“百姓”是对贵族的总称；战国以后，“百姓”成为民众的通称。导致
这一变化的主要原因是
（ ）
A．分封制的加强 B．宗法制的衰落
C．百家争鸣局面的出现 D．井田制的推行
2．（4分）东汉初年桓谭上书说：“（重本抑末）此所以抑并兼、长', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '广东'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '历史', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '广东_历史_2013_1', title: '一、选择题', subject: '历史', year: '2013', province: '广东'})
WITH q MATCH (p:Paper {name: '2013年高考历史试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_历史_2013_2', title: '1．（4分）战国以前，“百姓”是对贵族的总称；战国以后，“百姓”成为民众的通称。导致', subject: '历史', year: '2013', province: '广东'})
WITH q MATCH (p:Paper {name: '2013年高考历史试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_历史_2013_3', title: '2．（4分）东汉初年桓谭上书说：“（重本抑末）此所以抑并兼、长廉耻也。今富商大贾，多', subject: '历史', year: '2013', province: '广东'})
WITH q MATCH (p:Paper {name: '2013年高考历史试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_历史_2013_4', title: '3．（4分）有位古代思想家认为：通过读书等外在手段来明理自然是好，但“不识一个字，', subject: '历史', year: '2013', province: '广东'})
WITH q MATCH (p:Paper {name: '2013年高考历史试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_历史_2013_5', title: '4．（4分）“革命，革命，剪掉辫子反朝廷；独立，独立，中国岂是鞑子的！”这首歌谣反映', subject: '历史', year: '2013', province: '广东'})
WITH q MATCH (p:Paper {name: '2013年高考历史试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2009年高考历史试卷（广东）（解析卷）.pdf', province: '广东', subject: '历史', year: '2009', type: '解析卷', volume: '解析卷', preview: '2009年全国高考广东历史单科试题
历 史
本试卷共6页，32小题，满分150分。考试用时120分钟。
一、选择题：满分75分。本大题共25小题，每小题3分。在每小题列出的四个选项中，只有
一项符合题目要求。
1. 下列文献中，有较多反映西周时期平民社会生活内容的是
A.《老子》 B.甲骨卜辞 C.', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '广东'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '历史', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '广东_历史_2009_1', title: '一、选择题：满分75分。本大题共25小题，每小题3分。在每小题列出的四个选项中，只有', subject: '历史', year: '2009', province: '广东'})
WITH q MATCH (p:Paper {name: '2009年高考历史试卷（广东）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_历史_2009_2', title: '1. 下列文献中，有较多反映西周时期平民社会生活内容的是', subject: '历史', year: '2009', province: '广东'})
WITH q MATCH (p:Paper {name: '2009年高考历史试卷（广东）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_历史_2009_3', title: '2.“封建社会”的概念是近代引入中国的。右图所示柳宗元的文章的主题', subject: '历史', year: '2009', province: '广东'})
WITH q MATCH (p:Paper {name: '2009年高考历史试卷（广东）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_历史_2009_4', title: '3.', subject: '历史', year: '2009', province: '广东'})
WITH q MATCH (p:Paper {name: '2009年高考历史试卷（广东）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_历史_2009_5', title: '4. 中国古代，朝廷有时将不在户口册且因此不纳税的人成为“盗贼”。这反映当时朝廷', subject: '历史', year: '2009', province: '广东'})
WITH q MATCH (p:Paper {name: '2009年高考历史试卷（广东）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2018年高考历史试卷（新课标Ⅰ）（解析卷）.pdf', province: '广东', subject: '历史', year: '2018', type: '解析卷', volume: '解析卷', preview: '2018 年全国统一高考历史试卷（新课标Ⅰ）
参考答案与试题解析
一、选择题：本题共 12 小题，每小题 4 分，共 48 分。在每小题给出的四个选
项中，只有一项是符合题目要求的。
1．（4分）《墨子》中有关于“圆”“直线”“正方形”“倍”的定义，对杠杆原理、声音
传播、小孔成像等也有论述，还有机', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '广东'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '历史', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '广东_历史_2018_1', title: '一、选择题：本题共 12 小题，每小题 4 分，共 48 分。在每小题给出的四个选', subject: '历史', year: '2018', province: '广东'})
WITH q MATCH (p:Paper {name: '2018年高考历史试卷（新课标Ⅰ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_历史_2018_2', title: '1．（4分）《墨子》中有关于“圆”“直线”“正方形”“倍”的定义，对杠杆原理、声音', subject: '历史', year: '2018', province: '广东'})
WITH q MATCH (p:Paper {name: '2018年高考历史试卷（新课标Ⅰ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2020年高考历史试卷（新课标Ⅰ）（解析卷）.pdf', province: '广东', subject: '历史', year: '2020', type: '解析卷', volume: '解析卷', preview: '2020 年全国统一高考历史试卷（新课标Ⅰ）
参考答案与试题解析
一、选择题：本题共12小题，每小题4分，共48分。在每小题给出的四个选项中，只有
一项是符合题目要求的。
1．（4分）据《史记》记载，春秋时期，楚国国君熊通要求提升爵位等级，遭到周桓王拒绝。
熊通怒称现在周边地区都归附了楚国，“而王不', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '广东'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '历史', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '广东_历史_2020_1', title: '一、选择题：本题共12小题，每小题4分，共48分。在每小题给出的四个选项中，只有', subject: '历史', year: '2020', province: '广东'})
WITH q MATCH (p:Paper {name: '2020年高考历史试卷（新课标Ⅰ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_历史_2020_2', title: '1．（4分）据《史记》记载，春秋时期，楚国国君熊通要求提升爵位等级，遭到周桓王拒绝。', subject: '历史', year: '2020', province: '广东'})
WITH q MATCH (p:Paper {name: '2020年高考历史试卷（新课标Ⅰ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2017年高考历史试卷（新课标Ⅰ）（解析卷）.pdf', province: '广东', subject: '历史', year: '2017', type: '解析卷', volume: '解析卷', preview: '2017 年全国统一高考历史试卷（新课标Ⅰ）
参考答案与试题解析
一、选择题：本题共 12小题，每小题 4分．在每小题给出第四个选项中，只有
一项是符合题目要求的．
1．（4分）周灭商之后，推行分封制，如封武王弟康叔于卫，都朝歌（今河南淇
县）；封周公长子伯禽于鲁，都奄（今山东曲阜）；封召公奭于燕，', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '广东'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '历史', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '广东_历史_2017_1', title: '一、选择题：本题共 12小题，每小题 4分．在每小题给出第四个选项中，只有', subject: '历史', year: '2017', province: '广东'})
WITH q MATCH (p:Paper {name: '2017年高考历史试卷（新课标Ⅰ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_历史_2017_2', title: '1．（4分）周灭商之后，推行分封制，如封武王弟康叔于卫，都朝歌（今河南淇', subject: '历史', year: '2017', province: '广东'})
WITH q MATCH (p:Paper {name: '2017年高考历史试卷（新课标Ⅰ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_历史_2017_3', title: '2．（4分）读表：', subject: '历史', year: '2017', province: '广东'})
WITH q MATCH (p:Paper {name: '2017年高考历史试卷（新课标Ⅰ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2021年高考历史试卷（广东）（空白卷）.pdf', province: '广东', subject: '历史', year: '2021', type: '空白卷', volume: '空白卷', preview: '2021 年广东省普通高中学业水平选择性考试历史
一、选择题
1. 今河南平顶山应国墓地、陕西长安张家坡及普渡村墓地等处出土了一批具有长江中下游风格的西周青铜
器。这说明西周时期
A. 中原文化向周边传播 B. 各诸侯国维护周礼
C. 宗法制度分崩离析 D. 南北文化相互交流
2. 汉代设尚书台，其', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '广东'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '历史', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '广东_历史_2021_1', title: '一、选择题', subject: '历史', year: '2021', province: '广东'})
WITH q MATCH (p:Paper {name: '2021年高考历史试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_历史_2021_2', title: '1. 今河南平顶山应国墓地、陕西长安张家坡及普渡村墓地等处出土了一批具有长江中下游风格的西周青铜', subject: '历史', year: '2021', province: '广东'})
WITH q MATCH (p:Paper {name: '2021年高考历史试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_历史_2021_3', title: '2. 汉代设尚书台，其首领是尚书令、尚书仆射。魏晋时期，“事无大小，咸归令、仆”。这一现象说明', subject: '历史', year: '2021', province: '广东'})
WITH q MATCH (p:Paper {name: '2021年高考历史试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_历史_2021_4', title: '3. 安史之乱时，唐玄宗逃奔成都，途中发生兵变，杨贵妃死于马嵬坡。以下为若干记载。有学生以下述材', subject: '历史', year: '2021', province: '广东'})
WITH q MATCH (p:Paper {name: '2021年高考历史试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_历史_2021_5', title: '5. 在明代，庶民袖小衣短，“去地五寸”；生员袖大衣长，“去地一寸”，体现斯文之气，且其服饰颜色和', subject: '历史', year: '2021', province: '广东'})
WITH q MATCH (p:Paper {name: '2021年高考历史试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2024年高考历史试卷（广东）（解析卷）.pdf', province: '广东', subject: '历史', year: '2024', type: '解析卷', volume: '解析卷', preview: '广东省 2024 年普通高中学业水平等级考试
历史
注意事项:
1.答卷前，考生务必用黑色字迹钢笔或答字笔将自己的姓名、考生号、考场号和座位号填写
在答题卡上。用 2B 铅笔将试卷类型(A)填涂在答题卡相应位置上。将条形码横贴任答题卡右
上角“条形码粘贴处”
2.作答选择题时，选出每小题答案后,用 ', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '广东'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '历史', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '广东_历史_2024_1', title: '1.答卷前，考生务必用黑色字迹钢笔或答字笔将自己的姓名、考生号、考场号和座位号填写', subject: '历史', year: '2024', province: '广东'})
WITH q MATCH (p:Paper {name: '2024年高考历史试卷（广东）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_历史_2024_2', title: '2.作答选择题时，选出每小题答案后,用 2B铅笔把答题卡上对应题目选项的答案信息点涂黑;', subject: '历史', year: '2024', province: '广东'})
WITH q MATCH (p:Paper {name: '2024年高考历史试卷（广东）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_历史_2024_3', title: '3.非选择题必须用黑色字迹钢笔或签字笔作答,答案必须写在答题卡各题目指定区域内相应位', subject: '历史', year: '2024', province: '广东'})
WITH q MATCH (p:Paper {name: '2024年高考历史试卷（广东）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_历史_2024_4', title: '4.考生必须保持答题卡整洁。考试结束后，将试卷和答题卡一并交回。', subject: '历史', year: '2024', province: '广东'})
WITH q MATCH (p:Paper {name: '2024年高考历史试卷（广东）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_历史_2024_5', title: '一、选择题：本题共 16小题，每小题 3分，共 48分。在每小题列出的四个选项中，只有一', subject: '历史', year: '2024', province: '广东'})
WITH q MATCH (p:Paper {name: '2024年高考历史试卷（广东）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2023年高考历史试卷（广东）（空白卷）.pdf', province: '广东', subject: '历史', year: '2023', type: '空白卷', volume: '空白卷', preview: '2023 年普通高中学业水平选择性考试（广东卷）
历史
本试卷满分 100分，考试时间 75分钟。
一、选择题：本题共 16小题，每小题 3分，共 48分。在每小题列出的四个选项中，只有一
项符合题目要求。
1. 有学者认为西周时期周王能干预诸侯国的内政，下列史料支持这一观点的是（ ）
A. 《礼记', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '广东'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '历史', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '广东_历史_2023_1', title: '一、选择题：本题共 16小题，每小题 3分，共 48分。在每小题列出的四个选项中，只有一', subject: '历史', year: '2023', province: '广东'})
WITH q MATCH (p:Paper {name: '2023年高考历史试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_历史_2023_2', title: '1. 有学者认为西周时期周王能干预诸侯国的内政，下列史料支持这一观点的是（ ）', subject: '历史', year: '2023', province: '广东'})
WITH q MATCH (p:Paper {name: '2023年高考历史试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_历史_2023_3', title: '2. 汉初儒家代表人物陆贾的《新语》云：“昔舜治天下也，弹五弦之琴，歌南风之诗，寂若无治国之意，', subject: '历史', year: '2023', province: '广东'})
WITH q MATCH (p:Paper {name: '2023年高考历史试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_历史_2023_4', title: '3. 两晋时期参预中央决策的官员出身统计表', subject: '历史', year: '2023', province: '广东'})
WITH q MATCH (p:Paper {name: '2023年高考历史试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_历史_2023_5', title: '7. 晚清洋务派创办各种新式企业；日本明治政府推行“殖产兴业”政策。二者的共同点是（ ）', subject: '历史', year: '2023', province: '广东'})
WITH q MATCH (p:Paper {name: '2023年高考历史试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2014年高考历史试卷（广东）（空白卷）.pdf', province: '广东', subject: '历史', year: '2014', type: '空白卷', volume: '空白卷', preview: '12、“宗”是一个会意字。在甲骨文中，宗字作“ ”， “ ”像宫室屋宇之形，“ ”可能表
示
A．祖先牌位 B.皇帝宝座 C.青铜兵器 D铁制农具.
[来源:学.科.网Z.X.X.K]
13、唐代某诏令批评当时存在“恣行吞并，莫惧章程”和“口分永业（国家授予的田地）违法买卖”的现
象，这表明当时
A', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '广东'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '历史', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)

MERGE (p:Paper {name: '2019年高考历史试卷（新课标Ⅰ）（解析卷）.pdf', province: '广东', subject: '历史', year: '2019', type: '解析卷', volume: '解析卷', preview: '2019 年全国统一高考历史试卷（新课标Ⅰ）
参考答案与试题解析
一、选择题：本题共12小题，每小题4分，共48分。在每小题给出的四个选项中，只有
一项是符合题目要求的。
1．（4分）据学者考订，商朝产生了17代30位王，多为兄终弟及；而西周产生了11代12
位王。这反映出（ ）
A．禅让制度的长期', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '广东'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '历史', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '广东_历史_2019_1', title: '一、选择题：本题共12小题，每小题4分，共48分。在每小题给出的四个选项中，只有', subject: '历史', year: '2019', province: '广东'})
WITH q MATCH (p:Paper {name: '2019年高考历史试卷（新课标Ⅰ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_历史_2019_2', title: '1．（4分）据学者考订，商朝产生了17代30位王，多为兄终弟及；而西周产生了11代12', subject: '历史', year: '2019', province: '广东'})
WITH q MATCH (p:Paper {name: '2019年高考历史试卷（新课标Ⅰ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_历史_2019_3', title: '2．（4分）汉武帝时，朝廷制作出许多一尺见方的白鹿皮，称为“皮币”，', subject: '历史', year: '2019', province: '广东'})
WITH q MATCH (p:Paper {name: '2019年高考历史试卷（新课标Ⅰ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_历史_2019_4', title: '3．（4分）唐代之前，荆楚民间存在一种祈求丰收的“牵钩之戏”，至唐代称作“拔河”，广', subject: '历史', year: '2019', province: '广东'})
WITH q MATCH (p:Paper {name: '2019年高考历史试卷（新课标Ⅰ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2025高考广东历史答案-1597608f0b60.pdf', province: '广东', subject: '历史', year: '未知', type: '未知', volume: '', preview: '', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '广东'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '历史', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)

MERGE (p:Paper {name: '2016年高考历史试卷（新课标Ⅰ）（空白卷）.pdf', province: '广东', subject: '历史', year: '2016', type: '空白卷', volume: '空白卷', preview: '2016 年全国统一高考历史试卷（新课标Ⅰ）
一、选择题（共 12小题，每小题 4分，满分 48分）
1．（4分）孔子是儒家学派的创始人，汉代崇尚儒学，尊《尚书》等五部书为经
典，记录孔子言论的《论语》却不在“五经”之中，对此合理的解释是（ ）
A．“五经”为阐发孔子儒学思想而作
B．汉代儒学背离了', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '广东'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '历史', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '广东_历史_2016_1', title: '一、选择题（共 12小题，每小题 4分，满分 48分）', subject: '历史', year: '2016', province: '广东'})
WITH q MATCH (p:Paper {name: '2016年高考历史试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_历史_2016_2', title: '1．（4分）孔子是儒家学派的创始人，汉代崇尚儒学，尊《尚书》等五部书为经', subject: '历史', year: '2016', province: '广东'})
WITH q MATCH (p:Paper {name: '2016年高考历史试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_历史_2016_3', title: '2．（4分）如图为汉代画像砖中的农事图。此图可以用来说明当时（ ）', subject: '历史', year: '2016', province: '广东'})
WITH q MATCH (p:Paper {name: '2016年高考历史试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_历史_2016_4', title: '3．（4 分）史载，宋太祖某日闷闷不乐，有人问他原因，他说：“尔谓帝王可容', subject: '历史', year: '2016', province: '广东'})
WITH q MATCH (p:Paper {name: '2016年高考历史试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_历史_2016_5', title: '4．（4分）明初废行省，地方分设三司，分别掌管一地民政与财政、司法、军事，', subject: '历史', year: '2016', province: '广东'})
WITH q MATCH (p:Paper {name: '2016年高考历史试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2022年高考历史试卷（广东）（解析卷）.pdf', province: '广东', subject: '历史', year: '2022', type: '解析卷', volume: '解析卷', preview: '2022 年广东省高考真题历史试题
一、选择题
1. 考古材料是研究历史的重要依据。下列选项中，材料与结论之间逻辑关系正确的是
材料 结论
A 内蒙古克什克腾旗出土商朝的青铜器 商朝 的 统治范围到达内蒙古地区
B 山西晋国都邑遗址出土春秋早期的铁器残片 春秋早期已经使用铁器
C 湖北大冶铜矿冶遗址', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '广东'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '历史', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '广东_历史_2022_1', title: '一、选择题', subject: '历史', year: '2022', province: '广东'})
WITH q MATCH (p:Paper {name: '2022年高考历史试卷（广东）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_历史_2022_2', title: '1. 考古材料是研究历史的重要依据。下列选项中，材料与结论之间逻辑关系正确的是', subject: '历史', year: '2022', province: '广东'})
WITH q MATCH (p:Paper {name: '2022年高考历史试卷（广东）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_历史_2022_3', title: '3. 如图为南北朝时期的北齐到隋唐政府机构变化示意图，这一变化', subject: '历史', year: '2022', province: '广东'})
WITH q MATCH (p:Paper {name: '2022年高考历史试卷（广东）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_历史_2022_4', title: '4. 魏晋以来佛教、道教广泛传播，宋人李觏认为原因在于“儒失其守，教化坠于地”；张载认为佛道追求', subject: '历史', year: '2022', province: '广东'})
WITH q MATCH (p:Paper {name: '2022年高考历史试卷（广东）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2011年高考历史试卷（广东）（空白卷）.pdf', province: '广东', subject: '历史', year: '2011', type: '空白卷', volume: '空白卷', preview: '绝密★启用前 试卷类型：A
2011年普通高等学校招生全国统一考试（广东卷）
文科综合历史部分试题
12．“夫仁政，必自经界（土地的分界）始，……经界既正，分田制禄，可坐而定也。”孟
子的这段话认为
A．轻徭薄赋是实施仁政的手段 B．均贫富是实施仁政的障碍
C．解决土地问题是实施仁政的前提 D．贵民', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '广东'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '历史', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '广东_历史_2011_1', title: '12．“夫仁政，必自经界（土地的分界）始，……经界既正，分田制禄，可坐而定也。”孟', subject: '历史', year: '2011', province: '广东'})
WITH q MATCH (p:Paper {name: '2011年高考历史试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_历史_2011_2', title: '13．隋唐以前，官府设有谱局，考定父祖官爵、门第。此后该现象逐步消失，主要原因是', subject: '历史', year: '2011', province: '广东'})
WITH q MATCH (p:Paper {name: '2011年高考历史试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_历史_2011_3', title: '14．“虎溪三笑”讲的是儒者陶渊明、道士陆修静、僧人慧远一起品茗畅谈、乐而忘返的故', subject: '历史', year: '2011', province: '广东'})
WITH q MATCH (p:Paper {name: '2011年高考历史试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_历史_2011_4', title: '15．清末有舆论说：“中兴名臣曾国藩仅赏侯爵，李鸿章不过伯爵，其余百战功臣，竟有望', subject: '历史', year: '2011', province: '广东'})
WITH q MATCH (p:Paper {name: '2011年高考历史试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_历史_2011_5', title: '18．图6是某杂志的封面。从中获取的历史信息是，当时', subject: '历史', year: '2011', province: '广东'})
WITH q MATCH (p:Paper {name: '2011年高考历史试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2008年高考历史试卷（广东）（解析卷）.pdf', province: '广东', subject: '历史', year: '2008', type: '解析卷', volume: '解析卷', preview: '2008年普通高等学校招生全国统一考试(广东)
历 史
本试卷共6页，满分150分。考试用时120分钟。
一、选择题：满分75分。本大题共25小题，每小题3分。在每小题列出的四个选项中只有
一一项符合题目要求。
1．右图是明清古建筑中的一幅牌扁，与它有关联的中国古代
政治制度是
A．分封制 B．宗法', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '广东'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '历史', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '广东_历史_2008_1', title: '一、选择题：满分75分。本大题共25小题，每小题3分。在每小题列出的四个选项中只有', subject: '历史', year: '2008', province: '广东'})
WITH q MATCH (p:Paper {name: '2008年高考历史试卷（广东）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_历史_2008_2', title: '1．右图是明清古建筑中的一幅牌扁，与它有关联的中国古代', subject: '历史', year: '2008', province: '广东'})
WITH q MATCH (p:Paper {name: '2008年高考历史试卷（广东）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_历史_2008_3', title: '2．符合右图所示农业生产分布状况的朝代是', subject: '历史', year: '2008', province: '广东'})
WITH q MATCH (p:Paper {name: '2008年高考历史试卷（广东）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_历史_2008_4', title: '3．某思想家说：“我之出而仕也，为天下……为万民，', subject: '历史', year: '2008', province: '广东'})
WITH q MATCH (p:Paper {name: '2008年高考历史试卷（广东）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_历史_2008_5', title: '4．齐国管帅说：“凡为国之急者，必先禁宋作文巧。未作文巧禁，则民无所游食，无民所', subject: '历史', year: '2008', province: '广东'})
WITH q MATCH (p:Paper {name: '2008年高考历史试卷（广东）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2010年高考历史试卷（广东）（空白卷）.pdf', province: '广东', subject: '历史', year: '2010', type: '空白卷', volume: '空白卷', preview: '2010高考广东文综(历史)试题解析
一、选择题
12.在中国古代“家国一体”的社会中，忠孝观念源远流长，其源头是
A.宗法制 B郡县制 C君主专制 D中央集权制
13．北魏均田制实行后，文献中出现了“庄园”一词，被指圈占的成片土地。唐代均田制实行后，“庄园”一
词的使用更普遍。这反映了均田制实行后', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '广东'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '历史', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '广东_历史_2010_1', title: '一、选择题', subject: '历史', year: '2010', province: '广东'})
WITH q MATCH (p:Paper {name: '2010年高考历史试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_历史_2010_2', title: '12.在中国古代“家国一体”的社会中，忠孝观念源远流长，其源头是', subject: '历史', year: '2010', province: '广东'})
WITH q MATCH (p:Paper {name: '2010年高考历史试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_历史_2010_3', title: '13．北魏均田制实行后，文献中出现了“庄园”一词，被指圈占的成片土地。唐代均田制实行后，“庄园”一', subject: '历史', year: '2010', province: '广东'})
WITH q MATCH (p:Paper {name: '2010年高考历史试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_历史_2010_4', title: '14.唐代和宋代都有谏官。唐代谏官由宰相荐举，主要评议皇帝得失；宋代谏官由皇帝选拔，主要评议宰', subject: '历史', year: '2010', province: '广东'})
WITH q MATCH (p:Paper {name: '2010年高考历史试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_历史_2010_5', title: '15．“人人自有定盘针，万化根源总在心。却笑从前颠倒见，枝枝叶叶外头寻。”这首诗反映了', subject: '历史', year: '2010', province: '广东'})
WITH q MATCH (p:Paper {name: '2010年高考历史试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2015年高考历史试卷（广东）（空白卷）.pdf', province: '广东', subject: '历史', year: '2015', type: '空白卷', volume: '空白卷', preview: '一、选择题（每题4分，共12题，48分）
12．有古代学者论述某字体的形成时说：“（官员）奏事繁多，篆字难成，即令隶人（即胥吏）佐书。”据此
推断，该字体是（ ）
A．小篆 B．隶书 C．行书 D．草书
13．针对皇帝频频越过中书省直接向六部官员下达诏令的现象，有朝臣说：“事不出中书，是为乱政。”由', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '广东'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '历史', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '广东_历史_2015_1', title: '一、选择题（每题4分，共12题，48分）', subject: '历史', year: '2015', province: '广东'})
WITH q MATCH (p:Paper {name: '2015年高考历史试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_历史_2015_2', title: '12．有古代学者论述某字体的形成时说：“（官员）奏事繁多，篆字难成，即令隶人（即胥吏）佐书。”据此', subject: '历史', year: '2015', province: '广东'})
WITH q MATCH (p:Paper {name: '2015年高考历史试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_历史_2015_3', title: '13．针对皇帝频频越过中书省直接向六部官员下达诏令的现象，有朝臣说：“事不出中书，是为乱政。”由', subject: '历史', year: '2015', province: '广东'})
WITH q MATCH (p:Paper {name: '2015年高考历史试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_历史_2015_4', title: '14．史载：明代江南昆山县的农家，“麻耧机之事，则男子素习焉，妇人或不如也”，但乡村妇女“凡耕耘、', subject: '历史', year: '2015', province: '广东'})
WITH q MATCH (p:Paper {name: '2015年高考历史试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_历史_2015_5', title: '15．毛泽东主张用事实反击敌人的毁谤：“敌人说：‘广东共产’，我们说：‘请看事实’……敌人说：‘广州', subject: '历史', year: '2015', province: '广东'})
WITH q MATCH (p:Paper {name: '2015年高考历史试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2012年高考历史试卷（广东）（解析卷）.pdf', province: '广东', subject: '历史', year: '2012', type: '解析卷', volume: '解析卷', preview: '绝密★启用前 试卷类型：A
本试卷共10页，41小题，满分300分.考试用时150分钟。
注意事项：
1．答卷前，考生务必用黑色字迹的钢笔或签字笔将自己的姓名和考生号、试室号、座位号
填写在答题卡上。用2B铅笔将试卷类型（A）填涂在答题卡相应位置上。将条形码横贴在答
题卡右上角“条形码粘贴处”。
2', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '广东'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '历史', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '广东_历史_2012_1', title: '1．答卷前，考生务必用黑色字迹的钢笔或签字笔将自己的姓名和考生号、试室号、座位号', subject: '历史', year: '2012', province: '广东'})
WITH q MATCH (p:Paper {name: '2012年高考历史试卷（广东）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_历史_2012_2', title: '2．选择题每小题选出答案后，用2B铅笔把答题卡上对应题目选项的答案信息点涂黑，如需', subject: '历史', year: '2012', province: '广东'})
WITH q MATCH (p:Paper {name: '2012年高考历史试卷（广东）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_历史_2012_3', title: '3．非选择题必须用黑色字迹钢笔或签字笔作答，答案必须写在答题卡各题目指定区域内相', subject: '历史', year: '2012', province: '广东'})
WITH q MATCH (p:Paper {name: '2012年高考历史试卷（广东）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_历史_2012_4', title: '4．考生必须保持答题卡的整洁。考试结束后，将试卷和答题卡一并交回。', subject: '历史', year: '2012', province: '广东'})
WITH q MATCH (p:Paper {name: '2012年高考历史试卷（广东）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_历史_2012_5', title: '一、选择题：本大题共35小题，每小题4分，共140分。在每小题列出的四个选项中， 只', subject: '历史', year: '2012', province: '广东'})
WITH q MATCH (p:Paper {name: '2012年高考历史试卷（广东）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2022年高考地理试卷（广东）（解析卷）.pdf', province: '广东', subject: '地理', year: '2022', type: '解析卷', volume: '解析卷', preview: '2022 年广东省普通高中学业水平选择性考试
地理
本试卷共 6 页，20 小题，满分 100 分。考试用时 75 分钟。
注意事项:
1.答卷前，考生务必用黑色字迹钢笔或签字笔将自己的姓名、考生号、考场号和座位号填写
在答题卡上。用 2B 铅笔将试卷类型（B）填涂在答题卡相应位置上。将条形码横贴在', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '广东'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '地理', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '广东_地理_2022_1', title: '1.答卷前，考生务必用黑色字迹钢笔或签字笔将自己的姓名、考生号、考场号和座位号填写', subject: '地理', year: '2022', province: '广东'})
WITH q MATCH (p:Paper {name: '2022年高考地理试卷（广东）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_地理_2022_2', title: '2.作答选择题时，选出每小题答案后，用 2B 铅笔把答题卡上对应题目选项的答案信息点涂', subject: '地理', year: '2022', province: '广东'})
WITH q MATCH (p:Paper {name: '2022年高考地理试卷（广东）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_地理_2022_3', title: '3.非选择题必须用黑色字迹钢笔或签字笔作答，答案必须写在答题卡各题目指定区域内相应', subject: '地理', year: '2022', province: '广东'})
WITH q MATCH (p:Paper {name: '2022年高考地理试卷（广东）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_地理_2022_4', title: '4.作答选考题时，请先用 2B 铅笔填涂选做题的题号对应的信息点，再作答。漏涂、错涂、', subject: '地理', year: '2022', province: '广东'})
WITH q MATCH (p:Paper {name: '2022年高考地理试卷（广东）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_地理_2022_5', title: '5.考生必须保持答题卡的整洁。考试结束后，将试卷和答题卡一并交回。', subject: '地理', year: '2022', province: '广东'})
WITH q MATCH (p:Paper {name: '2022年高考地理试卷（广东）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2023年高考地理试卷（广东）（解析卷）.pdf', province: '广东', subject: '地理', year: '2023', type: '解析卷', volume: '解析卷', preview: '2023 年普通高中学业水平选择性考试（广东卷）
地理
本试卷满分 100 分，考试时间 75 分钟。
一、选择题：本大题共 16 小题，每小题 3 分，共 48 分。在每小题列出的四个选项中，只有
一项符合题目要求。
进入21世纪，长江下游跨江桥隧建设发展迅速。有研究统计，2000年长江下游公路跨', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '广东'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '地理', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '广东_地理_2023_1', title: '一、选择题：本大题共 16 小题，每小题 3 分，共 48 分。在每小题列出的四个选项中，只有', subject: '地理', year: '2023', province: '广东'})
WITH q MATCH (p:Paper {name: '2023年高考地理试卷（广东）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_地理_2023_2', title: '1. 与2000—2008年相比，2008—2016年期间长江下游两岸不同直线距离区间车辆平均跨江耗时的缩减量', subject: '地理', year: '2023', province: '广东'})
WITH q MATCH (p:Paper {name: '2023年高考地理试卷（广东）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_地理_2023_3', title: '2. 由图中信息可判断，长江下游南岸市县比北岸市县（ ）', subject: '地理', year: '2023', province: '广东'})
WITH q MATCH (p:Paper {name: '2023年高考地理试卷（广东）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_地理_2023_4', title: '3. 此次降水过程呈现的天气变化依次是（ ）', subject: '地理', year: '2023', province: '广东'})
WITH q MATCH (p:Paper {name: '2023年高考地理试卷（广东）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2013年高考地理试卷（广东）（解析卷）.pdf', province: '广东', subject: '地理', year: '2013', type: '解析卷', volume: '解析卷', preview: '【学科网试卷总评】
2013年广东省高考文综卷，总体难度适中。全卷11道选择题，其中自然地理部分5道------1、3、4、6考查
了地壳运动与地质作用、自然带、气候特征与天气系统、时间计算、等知识点；环境题一道------10题考查植被
对气候的影响；人文、区域地理部分5道-------2、5、7', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '广东'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '地理', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '广东_地理_2013_1', title: '2013年广东省高考文综卷，总体难度适中。全卷11道选择题，其中自然地理部分5道------1、3、4、6考查', subject: '地理', year: '2013', province: '广东'})
WITH q MATCH (p:Paper {name: '2013年高考地理试卷（广东）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_地理_2013_2', title: '点。与城市相关的试题选择题有3题-----考查城市交通与城市发展、城市化的影响、城市的空间形态变化；综合', subject: '地理', year: '2013', province: '广东'})
WITH q MATCH (p:Paper {name: '2013年高考地理试卷（广东）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_地理_2013_3', title: '2.开心果耐旱怕涝。在西亚伊朗，品质最好的开心果产自环境恶劣的高原沙漠地区。这种现象表明', subject: '地理', year: '2013', province: '广东'})
WITH q MATCH (p:Paper {name: '2013年高考地理试卷（广东）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_地理_2013_4', title: '3.图2为我国某省区植被覆盖度（数值越大，表示植被覆盖状况越好）沿经度变化示意图。', subject: '地理', year: '2013', province: '广东'})
WITH q MATCH (p:Paper {name: '2013年高考地理试卷（广东）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2012年高考地理试卷（广东）（空白卷）.pdf', province: '广东', subject: '地理', year: '2012', type: '空白卷', volume: '空白卷', preview: '一、选择题：本大题共35小题，每小题4分，共140分。在每小题列出的四个选项中，只
有一项是符合题目要求的。
1．剧烈太阳活动产生的太阳风吹袭地球，可能引起（ ）
A．人口迁移加快 B．风力电厂增产
C．生活耗能降低 D．卫星导航失效
2．海洋浮游植物通过光合作用与呼吸作用能够对大气中的CO 浓度进', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '广东'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '地理', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '广东_地理_2012_1', title: '一、选择题：本大题共35小题，每小题4分，共140分。在每小题列出的四个选项中，只', subject: '地理', year: '2012', province: '广东'})
WITH q MATCH (p:Paper {name: '2012年高考地理试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_地理_2012_2', title: '1．剧烈太阳活动产生的太阳风吹袭地球，可能引起（ ）', subject: '地理', year: '2012', province: '广东'})
WITH q MATCH (p:Paper {name: '2012年高考地理试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_地理_2012_3', title: '2．海洋浮游植物通过光合作用与呼吸作用能够对大气中的CO 浓度进行调节，有人称之为', subject: '地理', year: '2012', province: '广东'})
WITH q MATCH (p:Paper {name: '2012年高考地理试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_地理_2012_4', title: '4．地球大气与海洋是相互作用的。下列作用过程及其结构符合事实的是（ ）', subject: '地理', year: '2012', province: '广东'})
WITH q MATCH (p:Paper {name: '2012年高考地理试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_地理_2012_5', title: '5．图1所示为我国东南部某地出现的灾害现场，其灾害类型是（ ）', subject: '地理', year: '2012', province: '广东'})
WITH q MATCH (p:Paper {name: '2012年高考地理试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2015年高考地理试卷（广东）（空白卷）.pdf', province: '广东', subject: '地理', year: '2015', type: '空白卷', volume: '空白卷', preview: '第Ⅰ卷
本卷共35小题。每小题4分，共140分。在每个小题给出的四个选项中，只有一项是符合题目要求的。
[来源:Z。xx。k.Com]
一、选择题：本大题共35小题，每小题4分，共140分。在每小题列出的四个选项中，只有一项是符合题
目要求的。
1．数字高程模型是对地貌形态的虚拟表示，可描述地面高程', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '广东'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '地理', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '广东_地理_2015_1', title: '一、选择题：本大题共35小题，每小题4分，共140分。在每小题列出的四个选项中，只有一项是符合题', subject: '地理', year: '2015', province: '广东'})
WITH q MATCH (p:Paper {name: '2015年高考地理试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_地理_2015_2', title: '1．数字高程模型是对地貌形态的虚拟表示，可描述地面高程信息。图1为某旅游区的数字高程模型图，图', subject: '地理', year: '2015', province: '广东'})
WITH q MATCH (p:Paper {name: '2015年高考地理试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_地理_2015_3', title: '2．大规模的火山爆发可能造成地表温度下降。其合理的解释是火山爆发导致（ ）', subject: '地理', year: '2015', province: '广东'})
WITH q MATCH (p:Paper {name: '2015年高考地理试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_地理_2015_4', title: '3．有文献表述：“地带性就是地球形状和地球的运动特征引起地球上太阳辐射分布不均而产生有规律的分', subject: '地理', year: '2015', province: '广东'})
WITH q MATCH (p:Paper {name: '2015年高考地理试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2025年高考广东地理 参考答案.pdf', province: '广东', subject: '地理', year: '2025', type: '未知', volume: '', preview: '', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '广东'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '地理', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)

MERGE (p:Paper {name: '2019年高考地理试卷（新课标Ⅰ）（解析卷）.pdf', province: '广东', subject: '地理', year: '2019', type: '解析卷', volume: '解析卷', preview: '2019 年全国统一高考地理试卷（新课标Ⅰ）
参考答案与试题解析
一、选择题：本题共4小题，每小题12分，共44分．在每小题给出的四个选项中，只有
一项是符合题目要求的．
20世纪80年代开始，长江三角洲地区某县村办企业涌现，形成“村村冒烟”现象。2016
年该县开始实施村集体经济“抱团飞地”发展模', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '广东'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '地理', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '广东_地理_2019_1', title: '一、选择题：本题共4小题，每小题12分，共44分．在每小题给出的四个选项中，只有', subject: '地理', year: '2019', province: '广东'})
WITH q MATCH (p:Paper {name: '2019年高考地理试卷（新课标Ⅰ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_地理_2019_2', title: '1．“村村冒烟”主要指的是当时该县村办企业（ ）', subject: '地理', year: '2019', province: '广东'})
WITH q MATCH (p:Paper {name: '2019年高考地理试卷（新课标Ⅰ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_地理_2019_3', title: '3．“抱团飞地”发展模式，主要体现了（ ）', subject: '地理', year: '2019', province: '广东'})
WITH q MATCH (p:Paper {name: '2019年高考地理试卷（新课标Ⅰ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2017年高考地理试卷（新课标Ⅰ）（解析卷）.pdf', province: '广东', subject: '地理', year: '2017', type: '解析卷', volume: '解析卷', preview: '2017 年全国统一高考地理试卷（新课标Ⅰ）
参考答案与试题解析
一、选择题：本大题 11 小题，每个小题 4 分，满分 44 分．在每小题给出第四
个选项中，只有一项是符合题目要求的．
如图为我国东部地区某城市街道机动车道与两侧非机动车道绿化隔离带的景观
对比照片，拍摄于 2017 年 3 月 2', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '广东'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '地理', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '广东_地理_2017_1', title: '一、选择题：本大题 11 小题，每个小题 4 分，满分 44 分．在每小题给出第四', subject: '地理', year: '2017', province: '广东'})
WITH q MATCH (p:Paper {name: '2017年高考地理试卷（新课标Ⅰ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_地理_2017_2', title: '1．当地的自然植被属于（ ）', subject: '地理', year: '2017', province: '广东'})
WITH q MATCH (p:Paper {name: '2017年高考地理试卷（新课标Ⅰ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_地理_2017_3', title: '2．造成图示绿化隔离带景观差异的原因可能是该街道两侧（ ）', subject: '地理', year: '2017', province: '广东'})
WITH q MATCH (p:Paper {name: '2017年高考地理试卷（新课标Ⅰ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2010年高考地理试卷（广东）（解析卷）.pdf', province: '广东', subject: '地理', year: '2010', type: '解析卷', volume: '解析卷', preview: '2010 年普通高等学校招生全国统一考试(广东卷)
文科综合
1．利用作物秸杆等农副产品发展农区畜牧业，有利于
A．改善局地气候 B．综合利用资源
C．防止水土流失 D．保护农田作物
2．我国甲、乙两地均位于29°N附近。读“1971～2000年甲、乙两地各月气温和降水分布
图”（图1），可知
A．', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '广东'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '地理', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '广东_地理_2010_1', title: '1．利用作物秸杆等农副产品发展农区畜牧业，有利于', subject: '地理', year: '2010', province: '广东'})
WITH q MATCH (p:Paper {name: '2010年高考地理试卷（广东）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_地理_2010_2', title: '2．我国甲、乙两地均位于29°N附近。读“1971～2000年甲、乙两地各月气温和降水分布', subject: '地理', year: '2010', province: '广东'})
WITH q MATCH (p:Paper {name: '2010年高考地理试卷（广东）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_地理_2010_3', title: '3．卫星遥感监测显示，1999～2008年青藏高原上的色林错湖面积扩大了约20%，主要原因', subject: '地理', year: '2010', province: '广东'})
WITH q MATCH (p:Paper {name: '2010年高考地理试卷（广东）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_地理_2010_4', title: '4．下列关于河流的叙述，正确的是', subject: '地理', year: '2010', province: '广东'})
WITH q MATCH (p:Paper {name: '2010年高考地理试卷（广东）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_地理_2010_5', title: '5．人口数量最多，经济总量最大的区域是', subject: '地理', year: '2010', province: '广东'})
WITH q MATCH (p:Paper {name: '2010年高考地理试卷（广东）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2020年高考地理试卷（新课标Ⅰ）（解析卷）.pdf', province: '广东', subject: '地理', year: '2020', type: '解析卷', volume: '解析卷', preview: '2020 年全国统一高考地理试卷（新课标Ⅰ）
参考答案与试题解析
一、选择题：本题共4小题，共44分。在每小题给出的四个选项中，只有一项是符合题目
要求的。
治沟造地是陕西省延安市对黄土高原的丘陵沟壑区，在传统打坝淤地的基础上，集耕地
营造、坝系修复、生态建设和新农村发展为一体的“田水路林村”综合整', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '广东'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '地理', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '广东_地理_2020_1', title: '一、选择题：本题共4小题，共44分。在每小题给出的四个选项中，只有一项是符合题目', subject: '地理', year: '2020', province: '广东'})
WITH q MATCH (p:Paper {name: '2020年高考地理试卷（新课标Ⅰ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_地理_2020_2', title: '1．与传统的打坝淤地工程相比，治沟造地更加关注（ ）', subject: '地理', year: '2020', province: '广东'})
WITH q MATCH (p:Paper {name: '2020年高考地理试卷（新课标Ⅰ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_地理_2020_3', title: '2．治沟造地对当地生产条件的改善主要体现在（ ）', subject: '地理', year: '2020', province: '广东'})
WITH q MATCH (p:Paper {name: '2020年高考地理试卷（新课标Ⅰ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2024年高考地理试卷（广东）（空白卷）.pdf', province: '广东', subject: '地理', year: '2024', type: '空白卷', volume: '空白卷', preview: '2024 年广东省普通高中学业水平选择性考试
地理
本试卷共 6页，19小题，满分 100分。考试用时 75分钟。
注意事项：1．答题前，考生务必用黑色字迹的钢笔或签字笔将自己的姓名、考生号、考场号
和座位号填写在答题卡上。用 2B 铅笔将试卷类型（A）填涂在答题卡相应位置上。将条形码
横贴在答题卡', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '广东'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '地理', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '广东_地理_2024_1', title: '2．作答选择题时，选出每小题答案后，用 2B 铅笔把答题卡上对应题目选项的答案信息点涂', subject: '地理', year: '2024', province: '广东'})
WITH q MATCH (p:Paper {name: '2024年高考地理试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_地理_2024_2', title: '3．非选择题必须用黑色字迹的钢笔或签字笔作答，答案必须写在答题卡各题目指定区域内相', subject: '地理', year: '2024', province: '广东'})
WITH q MATCH (p:Paper {name: '2024年高考地理试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_地理_2024_3', title: '4．考生必须保持答题卡的整洁。考试结束后，将试卷和答题卡一并交回。', subject: '地理', year: '2024', province: '广东'})
WITH q MATCH (p:Paper {name: '2024年高考地理试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_地理_2024_4', title: '一、选择题：本大题共 16 小题，每小题 3 分，共 48 分。在每小题列出的四个选项中，只有', subject: '地理', year: '2024', province: '广东'})
WITH q MATCH (p:Paper {name: '2024年高考地理试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_地理_2024_5', title: '3. 与7—9月相比，2—4月西双版纳热带季雨林林冠层之上的大气逆辐射值较低，主要是因为2—4月期', subject: '地理', year: '2024', province: '广东'})
WITH q MATCH (p:Paper {name: '2024年高考地理试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2009年高考地理试卷（广东）（解析卷）.pdf', province: '广东', subject: '地理', year: '2009', type: '解析卷', volume: '解析卷', preview: '试卷类型：A
2009年普通高等学校招生全国统一考试（广东卷）
地 理
一、单选题：本大题共20小题，每小题2分，共40分。在每小题给出的四个选项中。只有
一项是符合题目要求的。
水循环包括自然循环和社会循环。读图1，
回答1～2.
1. 图中①②③④分别为
A. 蒸发、地表径流、跨流域调水、降水
', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '广东'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '地理', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '广东_地理_2009_1', title: '一、单选题：本大题共20小题，每小题2分，共40分。在每小题给出的四个选项中。只有', subject: '地理', year: '2009', province: '广东'})
WITH q MATCH (p:Paper {name: '2009年高考地理试卷（广东）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_地理_2009_2', title: '1. 图中①②③④分别为', subject: '地理', year: '2009', province: '广东'})
WITH q MATCH (p:Paper {name: '2009年高考地理试卷（广东）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_地理_2009_3', title: '2. 在水资源的社会循环个环节中，下列做法不够恰当的是', subject: '地理', year: '2009', province: '广东'})
WITH q MATCH (p:Paper {name: '2009年高考地理试卷（广东）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_地理_2009_4', title: '3.', subject: '地理', year: '2009', province: '广东'})
WITH q MATCH (p:Paper {name: '2009年高考地理试卷（广东）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_地理_2009_5', title: '4.', subject: '地理', year: '2009', province: '广东'})
WITH q MATCH (p:Paper {name: '2009年高考地理试卷（广东）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2021年高考地理试卷（广东）（解析卷）.pdf', province: '广东', subject: '地理', year: '2021', type: '解析卷', volume: '解析卷', preview: '2021 年广东省普通高中学业水平选择性考试地理
本试卷共 6 页，20 小题，满分 100 分。考试用时 75 分钟。
注意事项：1．答卷前，考生务必用黑色字迹的钢笔或签字笔将自己的姓名、考生号、考场号
和座位号填写在答题卡上。用 2B 铅笔将试卷类型（A）填涂在答题卡相应位置上。将条形码
横贴在', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '广东'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '地理', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '广东_地理_2021_1', title: '2．作答选择题时，选出每小题答案后，用 2B 铅笔把答题卡上对应题目选项的答案信息点涂', subject: '地理', year: '2021', province: '广东'})
WITH q MATCH (p:Paper {name: '2021年高考地理试卷（广东）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_地理_2021_2', title: '3．非选择题必须用黑色字迹钢笔或签字笔作答，答案必须写在答题卡各题目指定区域内相应', subject: '地理', year: '2021', province: '广东'})
WITH q MATCH (p:Paper {name: '2021年高考地理试卷（广东）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_地理_2021_3', title: '4．作答选考题时，请先用 2B 铅笔填涂选做题的题号对应的信息点，再作答。漏涂、错涂、', subject: '地理', year: '2021', province: '广东'})
WITH q MATCH (p:Paper {name: '2021年高考地理试卷（广东）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_地理_2021_4', title: '5．考生必须保持答题卡的整洁。考试结束后，将试卷和答题卡一并交回。', subject: '地理', year: '2021', province: '广东'})
WITH q MATCH (p:Paper {name: '2021年高考地理试卷（广东）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_地理_2021_5', title: '一、选择题：本大题共 16 小题，每小题 3 分，共 48 分。在每小题列出的四个选项中，只有', subject: '地理', year: '2021', province: '广东'})
WITH q MATCH (p:Paper {name: '2021年高考地理试卷（广东）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2014年高考地理试卷（广东）（解析卷）.pdf', province: '广东', subject: '地理', year: '2014', type: '解析卷', volume: '解析卷', preview: '第Ⅰ卷
本卷共35小题。每小题4分，共140分。在每个小题给出的四个选项中，只有一项是符合题目要求的。
一、选择题：本大题共35小题，每小题4分，共140分。在每小题列出的四个选项中，只有一项是符合题
目要求的。
1、图1为某年许昌与周边部分城市的高速公路日均流量图，根据流量大小分为五个等级。下列城', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '广东'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '地理', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '广东_地理_2014_1', title: '一、选择题：本大题共35小题，每小题4分，共140分。在每小题列出的四个选项中，只有一项是符合题', subject: '地理', year: '2014', province: '广东'})
WITH q MATCH (p:Paper {name: '2014年高考地理试卷（广东）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_地理_2014_2', title: '4.由图可知，下列描述符合该地乡村聚落数量空间分布特点的是', subject: '地理', year: '2014', province: '广东'})
WITH q MATCH (p:Paper {name: '2014年高考地理试卷（广东）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2011年高考地理试卷（广东）（空白卷）.pdf', province: '广东', subject: '地理', year: '2011', type: '空白卷', volume: '空白卷', preview: '2011 年普通高等学校招生全国统一考试（广东卷）文科综合
一、选择题：本大题共35小题，每小题4分，共140分。在每小题列出的四个选项中，只
有一项是符合题目要求的。
1．读“某区域地质剖面简图”（图1），图中甲、乙、丙三处的地质构造分别是
A．断层、向斜、背斜 B．断层、背斜、向斜
C．向斜、断', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '广东'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '地理', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '广东_地理_2011_1', title: '一、选择题：本大题共35小题，每小题4分，共140分。在每小题列出的四个选项中，只', subject: '地理', year: '2011', province: '广东'})
WITH q MATCH (p:Paper {name: '2011年高考地理试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_地理_2011_2', title: '1．读“某区域地质剖面简图”（图1），图中甲、乙、丙三处的地质构造分别是', subject: '地理', year: '2011', province: '广东'})
WITH q MATCH (p:Paper {name: '2011年高考地理试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_地理_2011_3', title: '2．研究发现，长江干流江苏段河床在1985年前后平均冲淤状态发生了明显的转变，由淤积', subject: '地理', year: '2011', province: '广东'})
WITH q MATCH (p:Paper {name: '2011年高考地理试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_地理_2011_4', title: '3．1996～2006年，我国城镇人口数量年均增长4.46%，城镇建成区面积年均增长5.23%，', subject: '地理', year: '2011', province: '广东'})
WITH q MATCH (p:Paper {name: '2011年高考地理试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_地理_2011_5', title: '4．与全国平均水平相比，人均GDP高、人均CO', subject: '地理', year: '2011', province: '广东'})
WITH q MATCH (p:Paper {name: '2011年高考地理试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2016年高考地理试卷（新课标Ⅰ）（空白卷）.pdf', province: '广东', subject: '地理', year: '2016', type: '空白卷', volume: '空白卷', preview: '2016 年全国统一高考地理试卷（新课标Ⅰ）
一、本卷 11 个小题，每题 4 分，满 44 分．在每小题给出的四个选项中，只有
一项是符合题目要求的．
我国是世界闻名的陶瓷古国，明清时期，“瓷都”景德镇是全国的瓷业中心，产品
远销海内外，20世纪80年代初，广东省佛山市率先引进国外现代化陶瓷生产
', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '广东'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '地理', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '广东_地理_2016_1', title: '一、本卷 11 个小题，每题 4 分，满 44 分．在每小题给出的四个选项中，只有', subject: '地理', year: '2016', province: '广东'})
WITH q MATCH (p:Paper {name: '2016年高考地理试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_地理_2016_2', title: '1．（4分）与景德镇相比，20世纪80年代佛山瓷业迅速发展的主要原因是（ ）', subject: '地理', year: '2016', province: '广东'})
WITH q MATCH (p:Paper {name: '2016年高考地理试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_地理_2016_3', title: '2．（4分）促使佛山陶瓷产业向外转移的主要原因是佛山（ ）', subject: '地理', year: '2016', province: '广东'})
WITH q MATCH (p:Paper {name: '2016年高考地理试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_地理_2016_4', title: '3．（4分）景德镇吸引佛山陶瓷产业转移的主要优势是（ ）', subject: '地理', year: '2016', province: '广东'})
WITH q MATCH (p:Paper {name: '2016年高考地理试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_地理_2016_5', title: '7．（4分）在任一条贝壳堤的形成过程中，海岸线（ ）', subject: '地理', year: '2016', province: '广东'})
WITH q MATCH (p:Paper {name: '2016年高考地理试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2008年高考地理试卷（广东）（空白卷）.pdf', province: '广东', subject: '地理', year: '2008', type: '空白卷', volume: '空白卷', preview: '绝密★启用前
试卷类型：B
2008年普通高等学校招生全国统一考试（广东卷）
地 理
本试卷共12页，37小题，满分150分。考试时间120分钟。
注意事项：1.
答卷前，考生务必用黑色字迹的钢笔或签字笔将自己的姓名和考生号、试室
号、座位号填写在答题卡上，用2B铅笔将试卷类型（B）
填涂在答题卡相', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '广东'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '地理', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '广东_地理_2008_1', title: '2.', subject: '地理', year: '2008', province: '广东'})
WITH q MATCH (p:Paper {name: '2008年高考地理试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_地理_2008_2', title: '选择题每小题选出答案后，用2B铅笔把答题卡上对应题目选项答案信息点', subject: '地理', year: '2008', province: '广东'})
WITH q MATCH (p:Paper {name: '2008年高考地理试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_地理_2008_3', title: '3．非选择题必须用黑色字迹的钢笔或签字笔作答，答案必须写在答题卡各题目', subject: '地理', year: '2008', province: '广东'})
WITH q MATCH (p:Paper {name: '2008年高考地理试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_地理_2008_4', title: '4．作答选做题时，请先用2B铅笔填涂选做题的题号（或题组号）对应的信息点', subject: '地理', year: '2008', province: '广东'})
WITH q MATCH (p:Paper {name: '2008年高考地理试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_地理_2008_5', title: '5. 考生必须保持答题卡的整洁。考试结束后，将试卷和答题卡一并交回。', subject: '地理', year: '2008', province: '广东'})
WITH q MATCH (p:Paper {name: '2008年高考地理试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2025年高考数学新课标全国Ⅰ卷真题+答案（版本3）.pdf', province: '广东', subject: '数学', year: '2025', type: '未知', volume: '', preview: '', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '广东'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '数学', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)

MERGE (p:Paper {name: '2024年高考化学试卷（广东）（解析卷）.pdf', province: '广东', subject: '化学', year: '2024', type: '解析卷', volume: '解析卷', preview: '2024 年普通高中学业水平选择性考试(广东卷)
化学
本卷满分 100分，考试用时 75分钟。
可能用到的相对原子质量：H 1 C 12 O 16 Na 23 S 32 Cl 35.5 Ca 40 Fe 56
一、选择题：本大题共 16小题，共 44分。第 1-题，每小题 2分；第 11-16小题', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '广东'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '化学', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '广东_化学_2024_1', title: '一、选择题：本大题共 16小题，共 44分。第 1-题，每小题 2分；第 11-16小题，每小题 4', subject: '化学', year: '2024', province: '广东'})
WITH q MATCH (p:Paper {name: '2024年高考化学试卷（广东）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_化学_2024_2', title: '1. 龙是中华民族重要的精神象征和文化符号。下列与龙有关的历史文物中，主要材质为有机高分子的是', subject: '化学', year: '2024', province: '广东'})
WITH q MATCH (p:Paper {name: '2024年高考化学试卷（广东）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_化学_2024_3', title: '2. “极地破冰”“太空养鱼”等彰显了我国科技发展的巨大成就。下列说法正确的是', subject: '化学', year: '2024', province: '广东'})
WITH q MATCH (p:Paper {name: '2024年高考化学试卷（广东）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_化学_2024_4', title: '3. 嘀嗒嘀嗒，时间都去哪儿了！计时器的发展史铭刻着化学的贡献。下列说法不正确的是', subject: '化学', year: '2024', province: '广东'})
WITH q MATCH (p:Paper {name: '2024年高考化学试卷（广东）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2016年高考化学试卷（新课标Ⅰ）（空白卷）.pdf', province: '广东', subject: '化学', year: '2016', type: '空白卷', volume: '空白卷', preview: '2016 年全国统一高考化学试卷（新课标Ⅰ）
一、选择题（共 7小题，每小题 6分，满分 42分）
1．（6分）化学与生活密切相关，下列有关说法错误的是（ ）
A．用灼烧的方法可以区分蚕丝和人造纤维
B．食用油反复加热会产生稠环芳香烃等有害物质
C．加热能杀死流感病毒是因为蛋白质受热变性
D．医用消', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '广东'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '化学', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '广东_化学_2016_1', title: '一、选择题（共 7小题，每小题 6分，满分 42分）', subject: '化学', year: '2016', province: '广东'})
WITH q MATCH (p:Paper {name: '2016年高考化学试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_化学_2016_2', title: '1．（6分）化学与生活密切相关，下列有关说法错误的是（ ）', subject: '化学', year: '2016', province: '广东'})
WITH q MATCH (p:Paper {name: '2016年高考化学试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_化学_2016_3', title: '2．（6分）设N 为阿伏加德罗常数值．下列有关叙述正确的是（ ）', subject: '化学', year: '2016', province: '广东'})
WITH q MATCH (p:Paper {name: '2016年高考化学试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_化学_2016_4', title: '3．（6分）下列关于有机化合物的说法正确的是（ ）', subject: '化学', year: '2016', province: '广东'})
WITH q MATCH (p:Paper {name: '2016年高考化学试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_化学_2016_5', title: '4．（6分）下列实验操作能达到实验目的是（ ）', subject: '化学', year: '2016', province: '广东'})
WITH q MATCH (p:Paper {name: '2016年高考化学试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2021年高考化学试卷（广东）（解析卷）.pdf', province: '广东', subject: '化学', year: '2021', type: '解析卷', volume: '解析卷', preview: '一、选择题：本题共 16小题，共 44分。第 1~10 小题，每小题 2分；第 11~16小题，每小题
4分。在每小题给出的四个选项中，只有一项是符合题目要求的。
1. 今年五一假期，人文考古游持续成为热点。很多珍贵文物都记载着中华文明的灿烂成就，具有深邃的文
化寓意和极高的学术价值。下列国宝级文物', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '广东'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '化学', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '广东_化学_2021_1', title: '一、选择题：本题共 16小题，共 44分。第 1~10 小题，每小题 2分；第 11~16小题，每小题', subject: '化学', year: '2021', province: '广东'})
WITH q MATCH (p:Paper {name: '2021年高考化学试卷（广东）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_化学_2021_2', title: '1. 今年五一假期，人文考古游持续成为热点。很多珍贵文物都记载着中华文明的灿烂成就，具有深邃的文', subject: '化学', year: '2021', province: '广东'})
WITH q MATCH (p:Paper {name: '2021年高考化学试卷（广东）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_化学_2021_3', title: '2. 广东有众多国家级非物质文化遗产，如广东剪纸、粤绣、潮汕工夫茶艺和香云纱染整技艺等。下列说法', subject: '化学', year: '2021', province: '广东'})
WITH q MATCH (p:Paper {name: '2021年高考化学试卷（广东）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2025年高考广东化学卷.pdf', province: '广东', subject: '化学', year: '2025', type: '未知', volume: '', preview: '', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '广东'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '化学', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)

MERGE (p:Paper {name: '2012年高考化学试卷（广东）（空白卷）.pdf', province: '广东', subject: '化学', year: '2012', type: '空白卷', volume: '空白卷', preview: '2012 年广东高考理综化学部分试卷解析
学生版
8 、在水溶液中能大量共存的一组是
A
Fe2+ Al3+ ClO- Cl-
B
K+ Cu2+ OH- NO-
3
C
NH+ Na+ Br- SO2-
D
Mg2+ H+ SiO2- SO2-
4 4 3 4
10 、下列应用不涉及氧化还原反应的', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '广东'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '化学', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '广东_化学_2012_1', title: '22.图7是部分周期元素化合价与原子序数的关系图，下列说法正确的是', subject: '化学', year: '2012', province: '广东'})
WITH q MATCH (p:Paper {name: '2012年高考化学试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_化学_2012_2', title: '30.（14分）过渡金属催化的新型碳-碳偶联反应是近年来有机合成的研究热点之一，如反应', subject: '化学', year: '2012', province: '广东'})
WITH q MATCH (p:Paper {name: '2012年高考化学试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2017年高考化学试卷（新课标Ⅰ）（解析卷）.pdf', province: '广东', subject: '化学', year: '2017', type: '解析卷', volume: '解析卷', preview: '2017 年全国统一高考化学试卷（新课标Ⅰ）
参考答案与试题解析
一、选择题：本题共 7 个小题，每小题 6 分．在每小题给出的四个选项中，只
有一项是符合题目要求的．
1．（6分）下列生活用品中主要由合成纤维制造的是（ ）
A．尼龙绳 B．宣纸 C．羊绒衫 D．棉衬衣
【考点】L3：常用合成高分子', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '广东'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '化学', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '广东_化学_2017_1', title: '一、选择题：本题共 7 个小题，每小题 6 分．在每小题给出的四个选项中，只', subject: '化学', year: '2017', province: '广东'})
WITH q MATCH (p:Paper {name: '2017年高考化学试卷（新课标Ⅰ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_化学_2017_2', title: '1．（6分）下列生活用品中主要由合成纤维制造的是（ ）', subject: '化学', year: '2017', province: '广东'})
WITH q MATCH (p:Paper {name: '2017年高考化学试卷（新课标Ⅰ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_化学_2017_3', title: '2．（6分）《本草衍义》中对精制砒霜过程有如下叙述：“取砒之法，将生砒就', subject: '化学', year: '2017', province: '广东'})
WITH q MATCH (p:Paper {name: '2017年高考化学试卷（新课标Ⅰ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2010年高考化学试卷（广东）（解析卷）.pdf', province: '广东', subject: '化学', year: '2010', type: '解析卷', volume: '解析卷', preview: '2010年广东省高考化学试卷
参考答案与试题解析
一、解答题（共6小题，满分24分）
1．（4分）（2010•广东）能在溶液中大量共存的一组离子是（ ）
A．NH +、Ag+、PO 3﹣、Cl﹣ B．Fe3+、H+、I﹣、HCO ﹣
4 4 3
C．K+、Na+、NO ﹣、MnO ﹣ D．Al3+、', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '广东'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '化学', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '广东_化学_2010_1', title: '一、解答题（共6小题，满分24分）', subject: '化学', year: '2010', province: '广东'})
WITH q MATCH (p:Paper {name: '2010年高考化学试卷（广东）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_化学_2010_2', title: '1．（4分）（2010•广东）能在溶液中大量共存的一组离子是（ ）', subject: '化学', year: '2010', province: '广东'})
WITH q MATCH (p:Paper {name: '2010年高考化学试卷（广东）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2020年高考化学试卷（新课标Ⅰ）（空白卷）.pdf', province: '广东', subject: '化学', year: '2020', type: '空白卷', volume: '空白卷', preview: '2020 年全国统一高考化学试卷（新课标Ⅰ）
一、选择题：本题共7小题，每小题6分，共42分。在每小题给出的四个选项中，只有一
项是符合题目要求的。
1．（6分）国家卫健委公布的新型冠状病毒肺炎诊疗方案指出，乙醚、75%乙醇、含氯消毒
剂、过氧乙酸（CH COOOH）、氯仿等均可有效灭活病毒。对于上', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '广东'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '化学', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '广东_化学_2020_1', title: '一、选择题：本题共7小题，每小题6分，共42分。在每小题给出的四个选项中，只有一', subject: '化学', year: '2020', province: '广东'})
WITH q MATCH (p:Paper {name: '2020年高考化学试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_化学_2020_2', title: '1．（6分）国家卫健委公布的新型冠状病毒肺炎诊疗方案指出，乙醚、75%乙醇、含氯消毒', subject: '化学', year: '2020', province: '广东'})
WITH q MATCH (p:Paper {name: '2020年高考化学试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_化学_2020_3', title: '2．（6分）紫花前胡醇（ ）可从中药材当归和白芷中提取得到，能', subject: '化学', year: '2020', province: '广东'})
WITH q MATCH (p:Paper {name: '2020年高考化学试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_化学_2020_4', title: '3．（6分）下列气体去除杂质的方法中，不能实现目的的是（ ）', subject: '化学', year: '2020', province: '广东'})
WITH q MATCH (p:Paper {name: '2020年高考化学试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2013年高考化学试卷（广东）（解析卷）.pdf', province: '广东', subject: '化学', year: '2013', type: '解析卷', volume: '解析卷', preview: '学科网试卷总评
第1页 | 共20页 本试卷共10页，36小题，满分300分。考试用时150分钟。
可能用到的相对原子质量：H 1 C 12 N 14 O 16 Na 23 Al 27 S 32 Cl 35.5 Cu 63.5
第I卷（选择题 共36分）
本解析为学科网名师解析团队原创，授权学科网独', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '广东'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '化学', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '广东_化学_2013_1', title: '第I卷（选择题 共36分）', subject: '化学', year: '2013', province: '广东'})
WITH q MATCH (p:Paper {name: '2013年高考化学试卷（广东）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_化学_2013_2', title: '一、单项选择题：本大题共 6小题，每小题 4分，共 24分。在每小题给出的四个', subject: '化学', year: '2013', province: '广东'})
WITH q MATCH (p:Paper {name: '2013年高考化学试卷（广东）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_化学_2013_3', title: '7．下列说法正确的是', subject: '化学', year: '2013', province: '广东'})
WITH q MATCH (p:Paper {name: '2013年高考化学试卷（广东）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_化学_2013_4', title: '8．水溶液中能大量共存的一组离子是', subject: '化学', year: '2013', province: '广东'})
WITH q MATCH (p:Paper {name: '2013年高考化学试卷（广东）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2019年高考化学试卷（新课标Ⅰ）（空白卷）.pdf', province: '广东', subject: '化学', year: '2019', type: '空白卷', volume: '空白卷', preview: '2019 年全国统一高考化学试卷（新课标Ⅰ）
一、选择题：共7小题，每小题6分，满分42分。在每小题给出的四个选项中，只有一项
是符合题目要求的。
1．（6分）陶瓷是火与土的结晶，是中华文明的象征之一，其形成、性质与化学有着密切的
关系。下列说法错误的是（ ）
A．“雨过天晴云破处”所描述的瓷器青色', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '广东'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '化学', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '广东_化学_2019_1', title: '一、选择题：共7小题，每小题6分，满分42分。在每小题给出的四个选项中，只有一项', subject: '化学', year: '2019', province: '广东'})
WITH q MATCH (p:Paper {name: '2019年高考化学试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_化学_2019_2', title: '1．（6分）陶瓷是火与土的结晶，是中华文明的象征之一，其形成、性质与化学有着密切的', subject: '化学', year: '2019', province: '广东'})
WITH q MATCH (p:Paper {name: '2019年高考化学试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_化学_2019_3', title: '2．（6分）关于化合物2﹣苯基丙烯（ ），下列说法正确的是（ ）', subject: '化学', year: '2019', province: '广东'})
WITH q MATCH (p:Paper {name: '2019年高考化学试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_化学_2019_4', title: '3．（6分）实验室制备溴苯的反应装置如图所示，关于实验操作或叙述错误的是（ ）', subject: '化学', year: '2019', province: '广东'})
WITH q MATCH (p:Paper {name: '2019年高考化学试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_化学_2019_5', title: '4．（6分）固体界面上强酸的吸附和离解是多相化学在环境、催化、材料科学等领域研究的', subject: '化学', year: '2019', province: '广东'})
WITH q MATCH (p:Paper {name: '2019年高考化学试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2009年高考化学试卷（广东）（空白卷）.pdf', province: '广东', subject: '化学', year: '2009', type: '空白卷', volume: '空白卷', preview: '2009年普通高等学校招生全国统一考试（广东卷）
化 学
本试卷共10页，27小题，满分150分。考试用时120分钟。
注意事项：1.答卷前，考生务必用黑色字迹的钢笔或签字笔将自己的姓名和考生号、试室号、座位号填写在答题
卡上，用2B铅笔将试卷类型（B）填涂在答题卡相应位置上。将条形码横贴在答题卡右', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '广东'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '化学', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '广东_化学_2009_1', title: '2.选择题每小题选出答案后，用2B铅笔把答题卡上对应题目选项的信息点涂黑，如需改动，用橡皮擦干净后，再', subject: '化学', year: '2009', province: '广东'})
WITH q MATCH (p:Paper {name: '2009年高考化学试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_化学_2009_2', title: '3.非选择题必须用黑色字迹钢笔或签字笔作答，答案必须写在答题卡各题目指定区域内相应位置上；如需改动，', subject: '化学', year: '2009', province: '广东'})
WITH q MATCH (p:Paper {name: '2009年高考化学试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_化学_2009_3', title: '4.作答选做题时，请先用2B铅笔填涂选做题的题号对应的信息点，再作答。漏涂、错涂、多涂的，答案无效。', subject: '化学', year: '2009', province: '广东'})
WITH q MATCH (p:Paper {name: '2009年高考化学试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_化学_2009_4', title: '5.考生必须保持答题卡的整洁。考试结束后，将试卷和答题卡一并交回。', subject: '化学', year: '2009', province: '广东'})
WITH q MATCH (p:Paper {name: '2009年高考化学试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_化学_2009_5', title: '6.设n 代表阿伏加德罗常数（N ）的数值，下列说法正确的是', subject: '化学', year: '2009', province: '广东'})
WITH q MATCH (p:Paper {name: '2009年高考化学试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2022年高考化学试卷（广东）（解析卷）.pdf', province: '广东', subject: '化学', year: '2022', type: '解析卷', volume: '解析卷', preview: '2022 年广东省普通高中学业水平选择性考试
化学
本试卷共 8页，21小题，满分 100分，考试用时 75分钟。
注意事项：
1.答卷前，考生务必用黑色字迹钢笔或签字笔将自己的姓名、考生号、考场号和座位号填写
在答题卡上。用 2B铅笔将试卷类型(A)填涂在答题卡相应位置上。将条形码横贴在答题卡右
', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '广东'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '化学', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '广东_化学_2022_1', title: '1.答卷前，考生务必用黑色字迹钢笔或签字笔将自己的姓名、考生号、考场号和座位号填写', subject: '化学', year: '2022', province: '广东'})
WITH q MATCH (p:Paper {name: '2022年高考化学试卷（广东）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_化学_2022_2', title: '2.作答选择题时，选出每小题答案后，用 2B 铅笔把答题卡上对应题目选项的答案信息点涂', subject: '化学', year: '2022', province: '广东'})
WITH q MATCH (p:Paper {name: '2022年高考化学试卷（广东）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_化学_2022_3', title: '3.非选择题必须用黑色字迹钢笔或签字笔作答，答案必须写在答题卡各题目指定区域内相应', subject: '化学', year: '2022', province: '广东'})
WITH q MATCH (p:Paper {name: '2022年高考化学试卷（广东）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_化学_2022_4', title: '4.作答选考题时，请先用 2B铅笔填涂选做题的题号对应的信息点，再作答。漏涂、错涂、多', subject: '化学', year: '2022', province: '广东'})
WITH q MATCH (p:Paper {name: '2022年高考化学试卷（广东）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_化学_2022_5', title: '5.考生必须保持答题卡的整洁。考试结束后，将试卷和答题卡一并交回。', subject: '化学', year: '2022', province: '广东'})
WITH q MATCH (p:Paper {name: '2022年高考化学试卷（广东）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2015年高考化学试卷（广东）（空白卷）.pdf', province: '广东', subject: '化学', year: '2015', type: '空白卷', volume: '空白卷', preview: '7．化学是你，化学是我，化学深入我们生活，下列说法正确的是（ ）
A．木材纤维和土豆淀粉遇碘水均显蓝色
B．食用花生油和鸡蛋清都能发生水解反应
[来源:学§科§网]
C．包装用材料聚乙烯和聚氯乙烯都属于烃
D．PX项目的主要产品对二甲苯属于饱和烃
8．水溶液中能大量共存的一组离子是（ ）
A．NH ', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '广东'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '化学', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '广东_化学_2015_1', title: '7．化学是你，化学是我，化学深入我们生活，下列说法正确的是（ ）', subject: '化学', year: '2015', province: '广东'})
WITH q MATCH (p:Paper {name: '2015年高考化学试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_化学_2015_2', title: '8．水溶液中能大量共存的一组离子是（ ）', subject: '化学', year: '2015', province: '广东'})
WITH q MATCH (p:Paper {name: '2015年高考化学试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_化学_2015_3', title: '9．下列叙述Ⅰ和Ⅱ均正确并有因果关系的是（ ）', subject: '化学', year: '2015', province: '广东'})
WITH q MATCH (p:Paper {name: '2015年高考化学试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_化学_2015_4', title: '10．设n 为阿伏伽德罗常数的数值，下列说法正确的是（ ）', subject: '化学', year: '2015', province: '广东'})
WITH q MATCH (p:Paper {name: '2015年高考化学试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_化学_2015_5', title: '12．准确移取20.00mL某待测HCl溶液于锥形瓶中，用0.1000mol·L-1NaOH溶液滴定，下列说法正确的是', subject: '化学', year: '2015', province: '广东'})
WITH q MATCH (p:Paper {name: '2015年高考化学试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2014年高考化学试卷（广东）（空白卷）.pdf', province: '广东', subject: '化学', year: '2014', type: '空白卷', volume: '空白卷', preview: '【试卷总评】
一、单选题
7．生活中处处有化学。下列说法正确的是A．制饭勺、饭盒、高压锅等的不锈钢是合金
B．做衣服的棉和麻均与淀粉互为同分异构体
C．煎炸食物的花生油和牛油都是可皂化的饱和酯类
D．磨豆浆的大豆富含蛋白质，豆浆煮沸后蛋白质变成了氨基酸
9．下列叙述I和II均正确并有因果关系的是
选', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '广东'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '化学', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '广东_化学_2014_1', title: '一、单选题', subject: '化学', year: '2014', province: '广东'})
WITH q MATCH (p:Paper {name: '2014年高考化学试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_化学_2014_2', title: '7．生活中处处有化学。下列说法正确的是A．制饭勺、饭盒、高压锅等的不锈钢是合金', subject: '化学', year: '2014', province: '广东'})
WITH q MATCH (p:Paper {name: '2014年高考化学试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_化学_2014_3', title: '9．下列叙述I和II均正确并有因果关系的是', subject: '化学', year: '2014', province: '广东'})
WITH q MATCH (p:Paper {name: '2014年高考化学试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_化学_2014_4', title: '10．设N 为阿伏伽德罗常数的数值。下列说法正确的是', subject: '化学', year: '2014', province: '广东'})
WITH q MATCH (p:Paper {name: '2014年高考化学试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_化学_2014_5', title: '二、双选题', subject: '化学', year: '2014', province: '广东'})
WITH q MATCH (p:Paper {name: '2014年高考化学试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2008年高考化学试卷（广东）（解析卷）.pdf', province: '广东', subject: '化学', year: '2008', type: '解析卷', volume: '解析卷', preview: '2008 年普通高等学校招生全国统一考试（广东卷）
化 学
可能用到的相对原子质量：H1 C12 N14 O16 Na23 Mg24 Al27 P31 S32
Cl35.5 K39 Ca40 Fe56 Cu63.5 Sn119
一、 选择题（本题包括9小题，每小题3分，共27分。每小题只有一个选项符', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '广东'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '化学', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '广东_化学_2008_1', title: '一、 选择题（本题包括9小题，每小题3分，共27分。每小题只有一个选项符合题意）', subject: '化学', year: '2008', province: '广东'})
WITH q MATCH (p:Paper {name: '2008年高考化学试卷（广东）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_化学_2008_2', title: '1.2007年诺贝尔化学奖得主Gerhard Ertl对金属Pt表面催化CO氧化反应的模型进行了深入研究。下列', subject: '化学', year: '2008', province: '广东'})
WITH q MATCH (p:Paper {name: '2008年高考化学试卷（广东）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_化学_2008_3', title: '2.海水是一个巨大的化学资源库，下列有关海水综合利用的说法正确的是', subject: '化学', year: '2008', province: '广东'})
WITH q MATCH (p:Paper {name: '2008年高考化学试卷（广东）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_化学_2008_4', title: '6.相同质量的下列物质分别与等浓度的NaOH溶液反应，至体系中均无固体物质，消耗碱量最多的是', subject: '化学', year: '2008', province: '广东'})
WITH q MATCH (p:Paper {name: '2008年高考化学试卷（广东）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2018年高考化学试卷（新课标Ⅰ）（空白卷）.pdf', province: '广东', subject: '化学', year: '2018', type: '空白卷', volume: '空白卷', preview: '2018 年全国统一高考化学试卷（新课标Ⅰ）
一、选择题（共 7小题，每小题 6分，满分 42分）
1．（6分）磷酸亚铁锂（LiFePO ）电池是新能源汽车的动力电池之一，采用湿法
4
冶金工艺回收废旧磷酸亚铁锂电池正极片中的金属，其流程如下：
下列叙述错误的是（ ）
A．合理处理废旧电池有利于保护', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '广东'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '化学', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '广东_化学_2018_1', title: '一、选择题（共 7小题，每小题 6分，满分 42分）', subject: '化学', year: '2018', province: '广东'})
WITH q MATCH (p:Paper {name: '2018年高考化学试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_化学_2018_2', title: '1．（6分）磷酸亚铁锂（LiFePO ）电池是新能源汽车的动力电池之一，采用湿法', subject: '化学', year: '2018', province: '广东'})
WITH q MATCH (p:Paper {name: '2018年高考化学试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_化学_2018_3', title: '2．（6分）下列说法错误的是（ ）', subject: '化学', year: '2018', province: '广东'})
WITH q MATCH (p:Paper {name: '2018年高考化学试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_化学_2018_4', title: '3．（6 分）在生成和纯化乙酸乙酯的实验过程中，下列操作未涉及的是（ ）', subject: '化学', year: '2018', province: '广东'})
WITH q MATCH (p:Paper {name: '2018年高考化学试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_化学_2018_5', title: '4．（6分）N 是阿伏加德罗常数的值，下列说法正确的是（ ）', subject: '化学', year: '2018', province: '广东'})
WITH q MATCH (p:Paper {name: '2018年高考化学试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2011年高考化学试卷（广东）（解析卷）.pdf', province: '广东', subject: '化学', year: '2011', type: '解析卷', volume: '解析卷', preview: '2011 年广东化学试题
一、单选题
7. 下列说法正确的是
A.纤维素和淀粉遇碘水均显蓝色
B.蛋白质、乙酸和葡萄糖均属电解质
C.溴乙烷与NaOH乙醇溶液共热生成乙烯
D.乙酸乙酯和食用植物油均可水解生成乙醇
8. 能在水溶液中大量共存的一组离子是
A. H＋、I―、NO―、SiO2－ B. A', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '广东'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '化学', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '广东_化学_2011_1', title: '一、单选题', subject: '化学', year: '2011', province: '广东'})
WITH q MATCH (p:Paper {name: '2011年高考化学试卷（广东）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_化学_2011_2', title: '7. 下列说法正确的是', subject: '化学', year: '2011', province: '广东'})
WITH q MATCH (p:Paper {name: '2011年高考化学试卷（广东）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_化学_2011_3', title: '8. 能在水溶液中大量共存的一组离子是', subject: '化学', year: '2011', province: '广东'})
WITH q MATCH (p:Paper {name: '2011年高考化学试卷（广东）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_化学_2011_4', title: '9.设n 为阿伏伽德罗常数的数值，下列说法正确的是', subject: '化学', year: '2011', province: '广东'})
WITH q MATCH (p:Paper {name: '2011年高考化学试卷（广东）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2024年高考生物试卷（广东）（解析卷）.pdf', province: '广东', subject: '生物', year: '2024', type: '解析卷', volume: '解析卷', preview: '2024 年广东省普通高中学业水平选择性考试生物
1. “碳汇渔业”，又称“不投饵渔业”，是指充分发挥生物碳汇功能，通过收获水产品直接或间接减少CO
2
的渔业生产活动，是我国实现“双碳”目标、践行“大食物观”的举措之一。下列生产活动属于“碳汇渔
业”的是（ ）
A. 开发海洋牧场，发展深海渔业
B', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '广东'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '生物', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '广东_生物_2024_1', title: '1. “碳汇渔业”，又称“不投饵渔业”，是指充分发挥生物碳汇功能，通过收获水产品直接或间接减少CO', subject: '生物', year: '2024', province: '广东'})
WITH q MATCH (p:Paper {name: '2024年高考生物试卷（广东）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_生物_2024_2', title: '3. 银杏是我国特有的珍稀植物，其叶片变黄后极具观赏价值。某同学用纸层析法探究银杏绿叶和黄叶的色', subject: '生物', year: '2024', province: '广东'})
WITH q MATCH (p:Paper {name: '2024年高考生物试卷（广东）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2017年高考生物试卷（新课标Ⅰ）（空白卷）.pdf', province: '广东', subject: '生物', year: '2017', type: '空白卷', volume: '空白卷', preview: '2017 年全国统一高考生物试卷（新课标Ⅰ）
一、选择题：本题共 6个小题，每小题 6分，共 36分。在每小题给出的四个选
项中，只有一项是符合题目要求的。
1．（6分）细胞间信息交流的方式有多种。在哺乳动物卵巢细胞分泌的雌激素作
用于乳腺细胞的过程中，以及精子进入卵细胞的过程中，细胞间信息交流的
', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '广东'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '生物', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '广东_生物_2017_1', title: '一、选择题：本题共 6个小题，每小题 6分，共 36分。在每小题给出的四个选', subject: '生物', year: '2017', province: '广东'})
WITH q MATCH (p:Paper {name: '2017年高考生物试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_生物_2017_2', title: '1．（6分）细胞间信息交流的方式有多种。在哺乳动物卵巢细胞分泌的雌激素作', subject: '生物', year: '2017', province: '广东'})
WITH q MATCH (p:Paper {name: '2017年高考生物试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_生物_2017_3', title: '2．（6分）下列关于细胞结构与成分的叙述，错误的是（ ）', subject: '生物', year: '2017', province: '广东'})
WITH q MATCH (p:Paper {name: '2017年高考生物试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_生物_2017_4', title: '3．（6分）通常，叶片中叶绿素含量下降可作为其衰老的检测指标．为研究激素', subject: '生物', year: '2017', province: '广东'})
WITH q MATCH (p:Paper {name: '2017年高考生物试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_生物_2017_5', title: '5．（6分）假设某草原上散养的某种家畜种群呈S型增长，该种群的增长率随种', subject: '生物', year: '2017', province: '广东'})
WITH q MATCH (p:Paper {name: '2017年高考生物试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2023年高考生物试卷（广东）（空白卷）.pdf', province: '广东', subject: '生物', year: '2023', type: '空白卷', volume: '空白卷', preview: '2023 年普通高等学校招生全国统一考试高考真题广东生物试题
一、选择题：
1. 中国制茶工艺源远流长。红茶制作包括萎凋、揉捻、发酵、高温干燥等工序，其间多酚氧化酶催化茶多
酚生成适量茶黄素是红茶风味形成的关键。下列叙述错误的是（ ）
A. 揉捻能破坏细胞结构使多酚氧化酶与茶多酚接触
B. 发酵时保', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '广东'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '生物', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '广东_生物_2023_1', title: '一、选择题：', subject: '生物', year: '2023', province: '广东'})
WITH q MATCH (p:Paper {name: '2023年高考生物试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_生物_2023_2', title: '1. 中国制茶工艺源远流长。红茶制作包括萎凋、揉捻、发酵、高温干燥等工序，其间多酚氧化酶催化茶多', subject: '生物', year: '2023', province: '广东'})
WITH q MATCH (p:Paper {name: '2023年高考生物试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_生物_2023_3', title: '2. 中外科学家经多年合作研究，发现circDNMT1（一种RNA分子）通过与抑癌基因p53表达的蛋白结合', subject: '生物', year: '2023', province: '广东'})
WITH q MATCH (p:Paper {name: '2023年高考生物试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_生物_2023_4', title: '3. 科学家采用体外受精技术获得紫羚羊胚胎，并将其移植到长角羚羊体内，使后者成功妊娠并产仔，该工', subject: '生物', year: '2023', province: '广东'})
WITH q MATCH (p:Paper {name: '2023年高考生物试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_生物_2023_5', title: '7. 在游泳过程中，参与呼吸作用并在线粒体内膜上作为反应物的是（ ）', subject: '生物', year: '2023', province: '广东'})
WITH q MATCH (p:Paper {name: '2023年高考生物试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2015年高考生物试卷（广东）（空白卷）.pdf', province: '广东', subject: '生物', year: '2015', type: '空白卷', volume: '空白卷', preview: '一、单项选择题
1.下列各组细胞器均具单层膜的是 （ ）
A 液泡和核糖体 B 中心体和叶绿体 C 溶酶体和高尔基体 D内质网和线粒体
2.关于人胰岛素的叙述，正确的是 （ ）
①以碳链为基本骨架②与双缩脲试剂反应呈蓝色
③促进肝糖原分解④由胰岛B细胞合成、分泌
A ①③ B ①④ C ②③ D ③', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '广东'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '生物', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '广东_生物_2015_1', title: '一、单项选择题', subject: '生物', year: '2015', province: '广东'})
WITH q MATCH (p:Paper {name: '2015年高考生物试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_生物_2015_2', title: '1.下列各组细胞器均具单层膜的是 （ ）', subject: '生物', year: '2015', province: '广东'})
WITH q MATCH (p:Paper {name: '2015年高考生物试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_生物_2015_3', title: '2.关于人胰岛素的叙述，正确的是 （ ）', subject: '生物', year: '2015', province: '广东'})
WITH q MATCH (p:Paper {name: '2015年高考生物试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_生物_2015_4', title: '3.关于DNA的实验，叙述正确的是 （ ）', subject: '生物', year: '2015', province: '广东'})
WITH q MATCH (p:Paper {name: '2015年高考生物试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_生物_2015_5', title: '4.图1表示在一个10ml的密闭培养体系中酵母菌细胞数量的动态变化，关于酵母菌数量的叙述，正确的是', subject: '生物', year: '2015', province: '广东'})
WITH q MATCH (p:Paper {name: '2015年高考生物试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2008年高考生物试卷（广东）（空白卷）.pdf', province: '广东', subject: '生物', year: '2008', type: '空白卷', volume: '空白卷', preview: '2008 年高考广东卷--生物
一、单项选择题：本题共20小题。每小题2分。共40分。每小题给出的四个选项中。只有一个选项最符
合题目要求。
1．具有细胞壁的选项是
A．花粉 B．红细胞 C．胰岛A细胞 D．流感病毒
2．甲、乙两种物质分别依赖自由扩散（简单扩散）和协助扩散进入细胞，如果以人工合成的', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '广东'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '生物', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '广东_生物_2008_1', title: '一、单项选择题：本题共20小题。每小题2分。共40分。每小题给出的四个选项中。只有一个选项最符', subject: '生物', year: '2008', province: '广东'})
WITH q MATCH (p:Paper {name: '2008年高考生物试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_生物_2008_2', title: '1．具有细胞壁的选项是', subject: '生物', year: '2008', province: '广东'})
WITH q MATCH (p:Paper {name: '2008年高考生物试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_生物_2008_3', title: '2．甲、乙两种物质分别依赖自由扩散（简单扩散）和协助扩散进入细胞，如果以人工合成的无蛋白磷脂双', subject: '生物', year: '2008', province: '广东'})
WITH q MATCH (p:Paper {name: '2008年高考生物试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_生物_2008_4', title: '3．观察在0.3g／mL蔗糖溶液中的洋葱表皮细胞，发现中央液泡逐渐变小，说明', subject: '生物', year: '2008', province: '广东'})
WITH q MATCH (p:Paper {name: '2008年高考生物试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_生物_2008_5', title: '4．关于叶肉细胞在光照条件下产生ATP的描述，正确的是', subject: '生物', year: '2008', province: '广东'})
WITH q MATCH (p:Paper {name: '2008年高考生物试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2011年高考生物试卷（广东）（空白卷）.pdf', province: '广东', subject: '生物', year: '2011', type: '空白卷', volume: '空白卷', preview: '2011年广东高考理科综合生物部分
单项选择题
1．小陈在观察成熟叶肉细胞的亚显微结构照片后得出如下结论，不正确的是
A．叶绿体和线粒体都有双层膜 B．核糖体附着在高尔基体上
C．内质网与核膜相连 D．液泡是最大的细胞器
2．艾弗里和同事用R型和S型肺炎双球菌进行实验，结果如下表，从表可知
实验组号', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '广东'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '生物', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '广东_生物_2011_1', title: '单项选择题', subject: '生物', year: '2011', province: '广东'})
WITH q MATCH (p:Paper {name: '2011年高考生物试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_生物_2011_2', title: '1．小陈在观察成熟叶肉细胞的亚显微结构照片后得出如下结论，不正确的是', subject: '生物', year: '2011', province: '广东'})
WITH q MATCH (p:Paper {name: '2011年高考生物试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_生物_2011_3', title: '2．艾弗里和同事用R型和S型肺炎双球菌进行实验，结果如下表，从表可知', subject: '生物', year: '2011', province: '广东'})
WITH q MATCH (p:Paper {name: '2011年高考生物试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_生物_2011_4', title: '3．华南虎是国家一级保护动物，可采用试管动物技术进行人工繁殖，该技术包括的环节', subject: '生物', year: '2011', province: '广东'})
WITH q MATCH (p:Paper {name: '2011年高考生物试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_生物_2011_5', title: '25．最近，可以抵抗多数抗生素的“超级细菌”引人关注，这类细菌含有超强耐药性基因ND', subject: '生物', year: '2011', province: '广东'})
WITH q MATCH (p:Paper {name: '2011年高考生物试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2014年高考生物试卷（广东）（解析卷）.pdf', province: '广东', subject: '生物', year: '2014', type: '解析卷', volume: '解析卷', preview: '【命题特点】
1、以下细胞结构中，RNA是其结构组成的是（ ）
A、液泡 B、核糖体 C、高尔基体 D、溶酶体
2、以下过程一定存在反馈调节的是（ ）
①胰岛素分泌量对血糖浓度的影响
②运动强度对汗腺分泌的影响
③降雨量对土壤动物存活率的影响
④害虫数量对其天敌鸟类数量的影响
A、①② B、②③ C', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '广东'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '生物', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)

MERGE (p:Paper {name: '2021年高考生物试卷（广东）（解析卷）.pdf', province: '广东', subject: '生物', year: '2021', type: '解析卷', volume: '解析卷', preview: '2021 年广东省普通高中学业水平选择性考试
生物学
一、选择题：
1. 我国新冠疫情防控已取得了举世瞩目的成绩，但全球疫情形势仍然严峻。为更有效地保护人民身体健康，
我国政府正在大力实施全民免费接种新冠疫苗计划，充分体现了党和国家对人民的关爱。目前接种的新冠
疫苗主要是灭活疫苗，下列叙述正确的是（', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '广东'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '生物', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '广东_生物_2021_1', title: '一、选择题：', subject: '生物', year: '2021', province: '广东'})
WITH q MATCH (p:Paper {name: '2021年高考生物试卷（广东）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_生物_2021_2', title: '1. 我国新冠疫情防控已取得了举世瞩目的成绩，但全球疫情形势仍然严峻。为更有效地保护人民身体健康，', subject: '生物', year: '2021', province: '广东'})
WITH q MATCH (p:Paper {name: '2021年高考生物试卷（广东）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_生物_2021_3', title: '3. 近年来我国生态文明建设卓有成效，粤港澳大湾区的生态环境也持续改善。研究人员对该地区的水鸟进', subject: '生物', year: '2021', province: '广东'})
WITH q MATCH (p:Paper {name: '2021年高考生物试卷（广东）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2019年高考生物试卷（新课标Ⅰ）（空白卷）.pdf', province: '广东', subject: '生物', year: '2019', type: '空白卷', volume: '空白卷', preview: '2019 年全国统一高考生物试卷（新课标Ⅰ）
一、选择题：本题共6小题，每小题6分，共36分。在每小题给出的四个选项中，只有一
项是符合题目要求的。
1．（6分）细胞凋亡是细胞死亡的一种类型。下列关于人体中细胞凋亡的叙述，正确的是
（ ）
A．胎儿手的发育过程中不会发生细胞凋亡
B．小肠上皮细胞的自', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '广东'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '生物', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '广东_生物_2019_1', title: '一、选择题：本题共6小题，每小题6分，共36分。在每小题给出的四个选项中，只有一', subject: '生物', year: '2019', province: '广东'})
WITH q MATCH (p:Paper {name: '2019年高考生物试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_生物_2019_2', title: '1．（6分）细胞凋亡是细胞死亡的一种类型。下列关于人体中细胞凋亡的叙述，正确的是', subject: '生物', year: '2019', province: '广东'})
WITH q MATCH (p:Paper {name: '2019年高考生物试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_生物_2019_3', title: '2．（6分）用体外实验的方法可合成多肽链。已知苯丙氨酸的密码子是UUU，若要在体外', subject: '生物', year: '2019', province: '广东'})
WITH q MATCH (p:Paper {name: '2019年高考生物试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_生物_2019_4', title: '3．（6分）将一株质量为20g的黄瓜幼苗栽种在光照等适宜的环境中，一段时间后植株达到', subject: '生物', year: '2019', province: '广东'})
WITH q MATCH (p:Paper {name: '2019年高考生物试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_生物_2019_5', title: '4．（6分）动物受到惊吓刺激时，兴', subject: '生物', year: '2019', province: '广东'})
WITH q MATCH (p:Paper {name: '2019年高考生物试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2012年高考生物试卷（广东）（空白卷）.pdf', province: '广东', subject: '生物', year: '2012', type: '空白卷', volume: '空白卷', preview: '1.有关生物膜结构与功能的叙述，正确的是
A.膜载体蛋白的合成不需要ATP
B.葡萄糖跨膜运输不需要载体蛋白
C.线粒体外膜与内膜的主要功能不同
D.变形虫和草履虫的细胞膜基本组成成分不同
2.培育草莓脱毒苗所采用的主要技术是
[来源:学*科*网Z*X*X*K]
A.组织培养 B.细胞杂交 C.显微', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '广东'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '生物', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '广东_生物_2012_1', title: '1.有关生物膜结构与功能的叙述，正确的是', subject: '生物', year: '2012', province: '广东'})
WITH q MATCH (p:Paper {name: '2012年高考生物试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_生物_2012_2', title: '2.培育草莓脱毒苗所采用的主要技术是', subject: '生物', year: '2012', province: '广东'})
WITH q MATCH (p:Paper {name: '2012年高考生物试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_生物_2012_3', title: '3.分析下表，可推测', subject: '生物', year: '2012', province: '广东'})
WITH q MATCH (p:Paper {name: '2012年高考生物试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_生物_2012_4', title: '三、非选择题：本大题共11小题，共182分。按题目要求作答。解答题应写出必要的文字', subject: '生物', year: '2012', province: '广东'})
WITH q MATCH (p:Paper {name: '2012年高考生物试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_生物_2012_5', title: '27.（16分）', subject: '生物', year: '2012', province: '广东'})
WITH q MATCH (p:Paper {name: '2012年高考生物试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2013年高考生物试卷（广东）（空白卷）.pdf', province: '广东', subject: '生物', year: '2013', type: '空白卷', volume: '空白卷', preview: '一、单项选择题：本大题共16小题，每小题4分，满分64分.在每小题给出的四个选项中，只有一项是符合
题目要求的.选对的得4分，选错或不答的得0分。
1.有关糖的叙述，正确的是（ ）
A.葡萄糖在线粒体中合成 B.葡萄糖遇碘变为蓝色
C.纤维素由葡萄糖组成 D.胰岛素促进糖原分解
2.1953年Wat', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '广东'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '生物', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '广东_生物_2013_1', title: '一、单项选择题：本大题共16小题，每小题4分，满分64分.在每小题给出的四个选项中，只有一项是符合', subject: '生物', year: '2013', province: '广东'})
WITH q MATCH (p:Paper {name: '2013年高考生物试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_生物_2013_2', title: '1.有关糖的叙述，正确的是（ ）', subject: '生物', year: '2013', province: '广东'})
WITH q MATCH (p:Paper {name: '2013年高考生物试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_生物_2013_3', title: '2.1953年Watson和Crick构建了DNA双螺旋结构模型，其重要意义在于', subject: '生物', year: '2013', province: '广东'})
WITH q MATCH (p:Paper {name: '2013年高考生物试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_生物_2013_4', title: '4.图1为去顶芽对拟南芥主根生长影响的实验结果，分析正确的是（ ）', subject: '生物', year: '2013', province: '广东'})
WITH q MATCH (p:Paper {name: '2013年高考生物试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_生物_2013_5', title: '5.图2所示某湖泊的食物网，其中鱼a、鱼b为两种小型土著鱼，若引入一种以中小型鱼类为食的鲈鱼，将出', subject: '生物', year: '2013', province: '广东'})
WITH q MATCH (p:Paper {name: '2013年高考生物试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2010年高考生物试卷（广东）（空白卷）.pdf', province: '广东', subject: '生物', year: '2010', type: '空白卷', volume: '空白卷', preview: '2010 年普通高等学校招生全国统一考试（广东卷）
理科综合
本试卷共10页，36小题，满分300分。考试用时150分钟。
可能用到的相对原子量：H 1 Li 7 B 11 C 12 N 14 O16 Na 23
一、单项选择题：本大题共16小题，每小题4分。共64分。在每小题给出的四个选项中，
只', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '广东'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '生物', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '广东_生物_2010_1', title: '一、单项选择题：本大题共16小题，每小题4分。共64分。在每小题给出的四个选项中，', subject: '生物', year: '2010', province: '广东'})
WITH q MATCH (p:Paper {name: '2010年高考生物试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_生物_2010_2', title: '1. 图1是植物从土壤中吸收某矿物质离子示意图。据图判断，', subject: '生物', year: '2010', province: '广东'})
WITH q MATCH (p:Paper {name: '2010年高考生物试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_生物_2010_3', title: '2. 谚语“苗多欺草，草多欺苗”反映的种间关系是( )', subject: '生物', year: '2010', province: '广东'})
WITH q MATCH (p:Paper {name: '2010年高考生物试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_生物_2010_4', title: '3. 骨髓移植是治疗白血病常用的有效方法之一，最主要的原因是移植骨髓中的造血干细胞', subject: '生物', year: '2010', province: '广东'})
WITH q MATCH (p:Paper {name: '2010年高考生物试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_生物_2010_5', title: '4. 下列叙述正确的是( )', subject: '生物', year: '2010', province: '广东'})
WITH q MATCH (p:Paper {name: '2010年高考生物试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2018年高考生物试卷（新课标Ⅰ）（空白卷）.pdf', province: '广东', subject: '生物', year: '2018', type: '空白卷', volume: '空白卷', preview: '2018 年全国统一高考生物试卷（新课标Ⅰ）
一、选择题（共 6小题，每小题 6分，满分 36分）
1．（6分）生物膜的结构与功能存在密切的联系，下列有关叙述错误的是（ ）
A．叶绿体的类囊体膜上存在催化ATP合成的酶
B．溶酶体膜破裂后释放出的酶会造成细胞结构的破坏
C．细胞的核膜是双层膜结构，核', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '广东'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '生物', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '广东_生物_2018_1', title: '一、选择题（共 6小题，每小题 6分，满分 36分）', subject: '生物', year: '2018', province: '广东'})
WITH q MATCH (p:Paper {name: '2018年高考生物试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_生物_2018_2', title: '1．（6分）生物膜的结构与功能存在密切的联系，下列有关叙述错误的是（ ）', subject: '生物', year: '2018', province: '广东'})
WITH q MATCH (p:Paper {name: '2018年高考生物试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_生物_2018_3', title: '2．（6 分）生物体内的 DNA 常与蛋白质结合，以 DNA﹣蛋白质复合物的形式存', subject: '生物', year: '2018', province: '广东'})
WITH q MATCH (p:Paper {name: '2018年高考生物试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_生物_2018_4', title: '3．（6分）下列有关植物根系吸收利用营养元素的叙述，错误的是（ ）', subject: '生物', year: '2018', province: '广东'})
WITH q MATCH (p:Paper {name: '2018年高考生物试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_生物_2018_5', title: '5．（6分）种群密度是种群的数量特征之一。下列叙述错误的是（ ）', subject: '生物', year: '2018', province: '广东'})
WITH q MATCH (p:Paper {name: '2018年高考生物试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2022年高考生物试卷（广东）（解析卷）.pdf', province: '广东', subject: '生物', year: '2022', type: '解析卷', volume: '解析卷', preview: '2022 年广东省普通高中学业水平选择性考试
生物学
一、选择题：
1. 2022年4月，习近平总书记在海南省考察时指出，热带雨林国家公园是国宝，是水库、粮库、钱库，更
是碳库，要充分认识其对国家的战略意义。从生态学的角度看，海南热带雨林的直接价值体现在其
（ ）
A. 具有保持水土、涵养水源和净化', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '广东'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '生物', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '广东_生物_2022_1', title: '一、选择题：', subject: '生物', year: '2022', province: '广东'})
WITH q MATCH (p:Paper {name: '2022年高考生物试卷（广东）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_生物_2022_2', title: '1. 2022年4月，习近平总书记在海南省考察时指出，热带雨林国家公园是国宝，是水库、粮库、钱库，更', subject: '生物', year: '2022', province: '广东'})
WITH q MATCH (p:Paper {name: '2022年高考生物试卷（广东）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_生物_2022_3', title: '3. 在2022年的北京冬奥会上，我国运动健儿取得了骄人的成绩。在运动员的科学训练和比赛期间需要监', subject: '生物', year: '2022', province: '广东'})
WITH q MATCH (p:Paper {name: '2022年高考生物试卷（广东）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2009年高考生物试卷（广东）（解析卷）.pdf', province: '广东', subject: '生物', year: '2009', type: '解析卷', volume: '解析卷', preview: '2009年普通高等学校招生统一考试广东A卷
生物
本试卷共10页，39小题，满分150分，。考试用时120分钟。
注意事项：1.答卷前，考生务必用黑色字迹的钢笔或签字笔将自己的姓名和考生号、试室号
、座位号填写在答题卡上。用2B铅笔将试卷类型（A）填涂在答题卡相应位置上。将条形码横
贴在答题卡右上角', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '广东'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '生物', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '广东_生物_2009_1', title: '2.选择题每小题选出答案后，用2B铅笔把答题卡上对应题目选项的答案信息点涂黑，如', subject: '生物', year: '2009', province: '广东'})
WITH q MATCH (p:Paper {name: '2009年高考生物试卷（广东）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_生物_2009_2', title: '3．非选择题必须用黑色字迹钢笔或签字笔作答，答案必须写在答题卡各题目指定区域内', subject: '生物', year: '2009', province: '广东'})
WITH q MATCH (p:Paper {name: '2009年高考生物试卷（广东）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_生物_2009_3', title: '4.作答选做题时，请先用2B铅笔填涂选做题的题号对应的信息点，再作答。漏涂、错涂', subject: '生物', year: '2009', province: '广东'})
WITH q MATCH (p:Paper {name: '2009年高考生物试卷（广东）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_生物_2009_4', title: '一、单项选择题：本题共20小题，每小题2分，共40分。每小题给出的四个选项中，只', subject: '生物', year: '2009', province: '广东'})
WITH q MATCH (p:Paper {name: '2009年高考生物试卷（广东）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_生物_2009_5', title: '1.右图所示的细胞可能是', subject: '生物', year: '2009', province: '广东'})
WITH q MATCH (p:Paper {name: '2009年高考生物试卷（广东）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2016年高考生物试卷（新课标Ⅰ）（解析卷）.pdf', province: '广东', subject: '生物', year: '2016', type: '解析卷', volume: '解析卷', preview: '2016 年全国统一高考生物试卷（新课标Ⅰ）
参考答案与试题解析
一、选择题（共 6小题，每小题 6分，满分 36分）
1．（6分）下列与细胞相关的叙述，正确的是（ ）
A．核糖体、溶酶体都是具有膜结构的细胞器
B．酵母菌的细胞核内含有DNA和RNA两类核酸
C．蓝藻细胞的能量来源于其线粒体有氧呼吸', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '广东'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '生物', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '广东_生物_2016_1', title: '一、选择题（共 6小题，每小题 6分，满分 36分）', subject: '生物', year: '2016', province: '广东'})
WITH q MATCH (p:Paper {name: '2016年高考生物试卷（新课标Ⅰ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_生物_2016_2', title: '1．（6分）下列与细胞相关的叙述，正确的是（ ）', subject: '生物', year: '2016', province: '广东'})
WITH q MATCH (p:Paper {name: '2016年高考生物试卷（新课标Ⅰ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_生物_2016_3', title: '2．（6分）离子泵是一种具有ATP水解酶活性的载体蛋白，能利用水解ATP释放', subject: '生物', year: '2016', province: '广东'})
WITH q MATCH (p:Paper {name: '2016年高考生物试卷（新课标Ⅰ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2020年高考生物试卷（新课标Ⅰ）（解析卷）.pdf', province: '广东', subject: '生物', year: '2020', type: '解析卷', volume: '解析卷', preview: '2020 年全国统一高考生物试卷（新课标Ⅰ）
参考答案与试题解析
一、选择题：本题共6小题，每小题6分，共36分。在每小题给出的四个选项中，只有一
项是符合题目要求的。
1．（6分）新冠肺炎疫情警示人们要养成良好的生活习惯，提高公共卫生安全意识。下列相
关叙述错误的是（ ）
A．戴口罩可以减少病原微', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '广东'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '生物', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '广东_生物_2020_1', title: '一、选择题：本题共6小题，每小题6分，共36分。在每小题给出的四个选项中，只有一', subject: '生物', year: '2020', province: '广东'})
WITH q MATCH (p:Paper {name: '2020年高考生物试卷（新课标Ⅰ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_生物_2020_2', title: '1．（6分）新冠肺炎疫情警示人们要养成良好的生活习惯，提高公共卫生安全意识。下列相', subject: '生物', year: '2020', province: '广东'})
WITH q MATCH (p:Paper {name: '2020年高考生物试卷（新课标Ⅰ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2018年高考语文试卷（新课标Ⅲ卷）（空白卷）.pdf', province: '广东', subject: '语文', year: '2018', type: '空白卷', volume: '新课标Ⅲ卷', preview: '', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '广东'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '语文', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)

MERGE (p:Paper {name: '2008年高考语文试卷（全国Ⅰ卷）（解析卷）.pdf', province: '广东', subject: '语文', year: '2008', type: '解析卷', volume: '全国Ⅰ卷', preview: '', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '广东'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '语文', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)

MERGE (p:Paper {name: '2023年高考语文试卷（新课标Ⅱ卷）（解析卷）.pdf', province: '广东', subject: '语文', year: '2023', type: '解析卷', volume: '新课标Ⅱ卷', preview: '', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '广东'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '语文', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)

MERGE (p:Paper {name: '2017年高考语文试卷（新课标Ⅱ卷）（空白卷）.pdf', province: '广东', subject: '语文', year: '2017', type: '空白卷', volume: '新课标Ⅱ卷', preview: '', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '广东'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '语文', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)

MERGE (p:Paper {name: '2020年高考语文试卷（新高考Ⅱ卷）（海南）（空白卷）.pdf', province: '广东', subject: '语文', year: '2020', type: '空白卷', volume: '新高考Ⅱ卷', preview: '', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '广东'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '语文', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)

MERGE (p:Paper {name: '2022年高考语文试卷（全国甲卷）（解析卷）.pdf', province: '广东', subject: '语文', year: '2022', type: '解析卷', volume: '全国甲卷', preview: '', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '广东'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '语文', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)

MERGE (p:Paper {name: '2009年高考语文试卷（全国Ⅰ卷）（空白卷）.pdf', province: '广东', subject: '语文', year: '2009', type: '空白卷', volume: '全国Ⅰ卷', preview: '', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '广东'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '语文', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)

MERGE (p:Paper {name: '2010年高考语文试卷（新课标）（解析卷）.pdf', province: '广东', subject: '语文', year: '2010', type: '解析卷', volume: '解析卷', preview: '', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '广东'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '语文', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)

MERGE (p:Paper {name: '2021年高考语文试卷（全国乙卷）（空白卷）.pdf', province: '广东', subject: '语文', year: '2021', type: '空白卷', volume: '全国乙卷', preview: '', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '广东'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '语文', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)

MERGE (p:Paper {name: '2014年高考语文试卷（新课标Ⅱ卷）（解析卷）.pdf', province: '广东', subject: '语文', year: '2014', type: '解析卷', volume: '新课标Ⅱ卷', preview: '', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '广东'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '语文', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)

MERGE (p:Paper {name: '2013年高考语文试卷（新课标Ⅱ卷）（空白卷）.pdf', province: '广东', subject: '语文', year: '2013', type: '空白卷', volume: '新课标Ⅱ卷', preview: '', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '广东'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '语文', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)

MERGE (p:Paper {name: '2015年高考语文试卷（新课标Ⅱ卷）（解析卷）.pdf', province: '广东', subject: '语文', year: '2015', type: '解析卷', volume: '新课标Ⅱ卷', preview: '', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '广东'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '语文', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)

MERGE (p:Paper {name: '2012年高考语文试卷（大纲版）（解析卷）.pdf', province: '广东', subject: '语文', year: '2012', type: '解析卷', volume: '解析卷', preview: '', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '广东'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '语文', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)

MERGE (p:Paper {name: '2011年高考语文试卷（新课标）（解析卷）.pdf', province: '广东', subject: '语文', year: '2011', type: '解析卷', volume: '解析卷', preview: '', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '广东'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '语文', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)

MERGE (p:Paper {name: '2024年高考语文试卷（全国甲卷）（空白卷）.pdf', province: '广东', subject: '语文', year: '2024', type: '空白卷', volume: '全国甲卷', preview: '', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '广东'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '语文', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)

MERGE (p:Paper {name: '2017年高考物理试卷（新课标Ⅰ）（解析卷）.pdf', province: '广东', subject: '物理', year: '2017', type: '解析卷', volume: '解析卷', preview: '2017 年全国统一高考物理试卷（新课标Ⅰ）
参考答案与试题解析
一、选择题：本大题共 8 小题，每小题 6 分．在每小题给出的四个选项中，第
1～5 题只有一项是符合题目要求，第 6～8 题有多项符合题目要求．全部选
对的得 6分，选对但不全的得 3分．有选错的得 0分．
1．（6分）将质量为1.', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '广东'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '物理', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '广东_物理_2017_1', title: '一、选择题：本大题共 8 小题，每小题 6 分．在每小题给出的四个选项中，第', subject: '物理', year: '2017', province: '广东'})
WITH q MATCH (p:Paper {name: '2017年高考物理试卷（新课标Ⅰ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_物理_2017_2', title: '1．（6分）将质量为1.00kg的模型火箭点火升空，50g燃烧的燃气以大小为600m/s', subject: '物理', year: '2017', province: '广东'})
WITH q MATCH (p:Paper {name: '2017年高考物理试卷（新课标Ⅰ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2025年高考广东物理-bf07a7d06a97.pdf', province: '广东', subject: '物理', year: '2025', type: '未知', volume: '', preview: '', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '广东'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '物理', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)

MERGE (p:Paper {name: '2016年高考物理试卷（新课标Ⅰ）（解析卷）.pdf', province: '广东', subject: '物理', year: '2016', type: '解析卷', volume: '解析卷', preview: '2016 年全国统一高考物理试卷（新课标Ⅰ）
参考答案与试题解析
二、选择题：本大题共 8 小题，每小题 6 分．在每小题给出的四个选项中，第
1～4 题只有一项是符合题目要求，第 5～8 题有多项符合题目要求．全部选
对的得 6分，选对但不全的得 3分．有选错的得 0分．
1．（6分）一平行电容器', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '广东'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '物理', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '广东_物理_2016_1', title: '二、选择题：本大题共 8 小题，每小题 6 分．在每小题给出的四个选项中，第', subject: '物理', year: '2016', province: '广东'})
WITH q MATCH (p:Paper {name: '2016年高考物理试卷（新课标Ⅰ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_物理_2016_2', title: '1．（6分）一平行电容器两极板之间充满云母介质，接在恒压直流电源上，若将', subject: '物理', year: '2016', province: '广东'})
WITH q MATCH (p:Paper {name: '2016年高考物理试卷（新课标Ⅰ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_物理_2016_3', title: '2．（6分）现代质谱仪可用来分析比质子重很多的离子，其示意图如图所示，其', subject: '物理', year: '2016', province: '广东'})
WITH q MATCH (p:Paper {name: '2016年高考物理试卷（新课标Ⅰ）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2024年高考物理试卷（广东）（解析卷）.pdf', province: '广东', subject: '物理', year: '2024', type: '解析卷', volume: '解析卷', preview: '2024 年普通高中学业水平选择性考试（广东卷）
物理
木试卷满分 100分，考试时间 75分钟
一、单项选择题（本题共 7小题，每小题 4分，共 28分。在每小题列出的四个选项中，只
有一项符合题目要求）
50W
1. 将阻值为 的电阻接在正弦式交流电源上。电阻两端电压随时间的变化规律如图所示。下', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '广东'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '物理', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '广东_物理_2024_1', title: '一、单项选择题（本题共 7小题，每小题 4分，共 28分。在每小题列出的四个选项中，只', subject: '物理', year: '2024', province: '广东'})
WITH q MATCH (p:Paper {name: '2024年高考物理试卷（广东）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_物理_2024_2', title: '1. 将阻值为 的电阻接在正弦式交流电源上。电阻两端电压随时间的变化规律如图所示。下列说法正', subject: '物理', year: '2024', province: '广东'})
WITH q MATCH (p:Paper {name: '2024年高考物理试卷（广东）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2018年高考物理试卷（新课标Ⅰ）（空白卷）.pdf', province: '广东', subject: '物理', year: '2018', type: '空白卷', volume: '空白卷', preview: '2018 年全国统一高考物理试卷（新课标Ⅰ）
一、选择题：本题共 8小题，每小题 6分，共 48分.在每小题给出的四个选项中，
第 1～5题只有一顶符合题目要求，第 6～8题有多项符合题目要求.全部选对
的得 6分，选对但不全的得 3分，有选错的得 0分．
1．（6分）高铁列车在启动阶段的运动可看作', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '广东'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '物理', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '广东_物理_2018_1', title: '一、选择题：本题共 8小题，每小题 6分，共 48分.在每小题给出的四个选项中，', subject: '物理', year: '2018', province: '广东'})
WITH q MATCH (p:Paper {name: '2018年高考物理试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_物理_2018_2', title: '1．（6分）高铁列车在启动阶段的运动可看作初速度为零的匀加速直线运动，在', subject: '物理', year: '2018', province: '广东'})
WITH q MATCH (p:Paper {name: '2018年高考物理试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_物理_2018_3', title: '2．（6 分）如图，轻弹簧的下端固定在水平桌面上，上端放有物块 P，系统处于', subject: '物理', year: '2018', province: '广东'})
WITH q MATCH (p:Paper {name: '2018年高考物理试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_物理_2018_4', title: '3．（6 分）如图，三个固定的带电小球 a，b 和 c，相互间的距离分别为 ab=5cm，', subject: '物理', year: '2018', province: '广东'})
WITH q MATCH (p:Paper {name: '2018年高考物理试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_物理_2018_5', title: '4．（6分）如图，导体轨道OPQS 固定，其中PQS是半圆弧，Q为半圆弧的中点，', subject: '物理', year: '2018', province: '广东'})
WITH q MATCH (p:Paper {name: '2018年高考物理试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2013年高考物理试卷（广东）（空白卷）.pdf', province: '广东', subject: '物理', year: '2013', type: '空白卷', volume: '空白卷', preview: '一、单项选择题：本大题共16小题，每小题4分，满分64分.在每小题给出的四个选
项中，只有一项是符合题目要求的.选对的得4分，选错或不答的得0分。
13.某航母跑道长200m飞机在航母上滑行的最大加速度为6m/s2，起飞需要的最低速度
为50m/s。那么，飞机在滑行前，需要借助弹射系统获得的最小初速', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '广东'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '物理', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '广东_物理_2013_1', title: '一、单项选择题：本大题共16小题，每小题4分，满分64分.在每小题给出的四个选', subject: '物理', year: '2013', province: '广东'})
WITH q MATCH (p:Paper {name: '2013年高考物理试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_物理_2013_2', title: '13.某航母跑道长200m飞机在航母上滑行的最大加速度为6m/s2，起飞需要的最低速度', subject: '物理', year: '2013', province: '广东'})
WITH q MATCH (p:Paper {name: '2013年高考物理试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_物理_2013_3', title: '14.如图所示，甲、乙两颗卫星以相同的轨道半径分别绕质量为M和2M的行星做匀速', subject: '物理', year: '2013', province: '广东'})
WITH q MATCH (p:Paper {name: '2013年高考物理试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_物理_2013_4', title: '15.喷墨打印机的简化模型如图所示，重力可忽略的墨汁微滴，经带电室带负电后，以', subject: '物理', year: '2013', province: '广东'})
WITH q MATCH (p:Paper {name: '2013年高考物理试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_物理_2013_5', title: '16.如图，理想变压器原、副线圈匝数比n ∶n =2∶1，V和A均为理想电表，灯泡光电', subject: '物理', year: '2013', province: '广东'})
WITH q MATCH (p:Paper {name: '2013年高考物理试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2022年高考物理试卷（广东）（空白卷）.pdf', province: '广东', subject: '物理', year: '2022', type: '空白卷', volume: '空白卷', preview: '2022 年广东省普通高中学业水平选择性考试
物理
本试卷共 7页，16小题，满分 100分，考试用时 75分钟。
注意事项：
1、答卷前，考生务必用黑色字迹钢笔或签字笔将自己的姓名、考生号、考场号和座位号填
写在答题卡上。用 2B铅笔将试卷类型（A）填涂在答题卡相应位置上。将条形码横贴在答题
卡右', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '广东'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '物理', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '广东_物理_2022_1', title: '2、作答选择题时，选出每小题答案后，用 2B铅笔把答题卡上对应题目选项的答案信息点涂', subject: '物理', year: '2022', province: '广东'})
WITH q MATCH (p:Paper {name: '2022年高考物理试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_物理_2022_2', title: '3、非选择题必须用黑色字迹钢笔或签字笔作答，答案必须写在答题卡各题目指定区域内相', subject: '物理', year: '2022', province: '广东'})
WITH q MATCH (p:Paper {name: '2022年高考物理试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_物理_2022_3', title: '一、单项选择题：本题共 7小题，每小题 4分，共 28分。在每小题给出的四个选项中，只', subject: '物理', year: '2022', province: '广东'})
WITH q MATCH (p:Paper {name: '2022年高考物理试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_物理_2022_4', title: '1. 图是可用来制作豆腐的石磨。木柄AB', subject: '物理', year: '2022', province: '广东'})
WITH q MATCH (p:Paper {name: '2022年高考物理试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_物理_2022_5', title: '4. 图是简化的某种旋转磁极式发电机原理图。定子是仅匝数n不同的两线圈，n >n ，二者轴线在同一', subject: '物理', year: '2022', province: '广东'})
WITH q MATCH (p:Paper {name: '2022年高考物理试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2008年高考物理试卷（广东）（解析卷）.pdf', province: '广东', subject: '物理', year: '2008', type: '解析卷', volume: '解析卷', preview: '2008 年普通高等学校招生全国统一考试（广东卷）
物理答案
1 2 3 4 5 6 7 8 9 10 11 12
B BD A AD D BC A AD AC BD A C
13、（1）大，引力．（2）扩散，无规则运动，增加．
14、（1）速度 频率 （2）全反射 光疏介质 临界角
15．(1）图', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '广东'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '物理', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '广东_物理_2008_1', title: '15．(1）图略', subject: '物理', year: '2008', province: '广东'})
WITH q MATCH (p:Paper {name: '2008年高考物理试卷（广东）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_物理_2008_2', title: '16．（1）②接通电源、释放小车 断开开关', subject: '物理', year: '2008', province: '广东'})
WITH q MATCH (p:Paper {name: '2008年高考物理试卷（广东）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_物理_2008_3', title: '17．（1）解析：v 72km/h  20m/s，由P  Fv得', subject: '物理', year: '2008', province: '广东'})
WITH q MATCH (p:Paper {name: '2008年高考物理试卷（广东）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_物理_2008_4', title: '18．解析：', subject: '物理', year: '2008', province: '广东'})
WITH q MATCH (p:Paper {name: '2008年高考物理试卷（广东）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2023年高考物理试卷（广东）（解析卷）.pdf', province: '广东', subject: '物理', year: '2023', type: '解析卷', volume: '解析卷', preview: '2023 年广东省普通高中学业水平选择性考试
物理
本试卷满分 100分，考试时间 75分钟
一、单项选择题（本题共 7小题，每小题 4分，共 28分在每小题给出的四个选项中，只有一
项是符合题目要求的）
12C+Y®16 O
1. 理论认为，大质量恒星塌缩成黑洞的过程，受核反应6 8 的影响。下列', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '广东'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '物理', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '广东_物理_2023_1', title: '一、单项选择题（本题共 7小题，每小题 4分，共 28分在每小题给出的四个选项中，只有一', subject: '物理', year: '2023', province: '广东'})
WITH q MATCH (p:Paper {name: '2023年高考物理试卷（广东）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_物理_2023_2', title: '1. 理论认为，大质量恒星塌缩成黑洞的过程，受核反应6 8 的影响。下列说法正确的是（ ）', subject: '物理', year: '2023', province: '广东'})
WITH q MATCH (p:Paper {name: '2023年高考物理试卷（广东）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_物理_2023_3', title: '2. 如图所示，可视为质点的机器人通过磁铁吸附在船舷外壁面检测船体。壁面可视为斜面，与竖直方向夹', subject: '物理', year: '2023', province: '广东'})
WITH q MATCH (p:Paper {name: '2023年高考物理试卷（广东）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2019年高考物理试卷（新课标Ⅰ）（空白卷）.pdf', province: '广东', subject: '物理', year: '2019', type: '空白卷', volume: '空白卷', preview: '2019 年全国统一高考物理试卷（新课标Ⅰ）
一、选择题：本题共8小题，每小题6分，共48分。在每小题给出的四个选项中，第1～5
题只有一项符合题目要求，第6～8题有多项符合题目要求。全部选对的得6分，选对但不
全的得3分，有选错的得0分。
1．（6分）氢原子能级示意图如图所示。光子能量在1.63e', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '广东'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '物理', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '广东_物理_2019_1', title: '一、选择题：本题共8小题，每小题6分，共48分。在每小题给出的四个选项中，第1～5', subject: '物理', year: '2019', province: '广东'})
WITH q MATCH (p:Paper {name: '2019年高考物理试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_物理_2019_2', title: '1．（6分）氢原子能级示意图如图所示。光子能量在1.63eV～3.10eV的光为可见光。要使', subject: '物理', year: '2019', province: '广东'})
WITH q MATCH (p:Paper {name: '2019年高考物理试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_物理_2019_3', title: '2．（6分）如图，空间存在一方向水平向右的匀强电场，两个带电小球P和Q用相同的绝缘', subject: '物理', year: '2019', province: '广东'})
WITH q MATCH (p:Paper {name: '2019年高考物理试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_物理_2019_4', title: '3．（6分）最近，我国为“长征九号”研制的大推力新型火箭发动机联试成功，这标志着我', subject: '物理', year: '2019', province: '广东'})
WITH q MATCH (p:Paper {name: '2019年高考物理试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_物理_2019_5', title: '5．（6 分）如图，篮球架下的运动员原地垂直起跳扣篮，离地后重心上升的最大高度为', subject: '物理', year: '2019', province: '广东'})
WITH q MATCH (p:Paper {name: '2019年高考物理试卷（新课标Ⅰ）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2015年高考物理试卷（广东）（空白卷）.pdf', province: '广东', subject: '物理', year: '2015', type: '空白卷', volume: '空白卷', preview: '13．甲、乙两人同时同地出发骑自行车做直线运动，前1小时内的位移-时间图像如图3所示，下列表
述正确的是
A．0.2～0.5小时内，甲的加速度比乙的大 B．0.2～0.5小时内，甲的速度比乙的大
C．0.6～0.8小时内，甲的位移比乙的小 D．0.8小时内，甲、乙骑车的路程相等
14．如图4所示，帆', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '广东'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '物理', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '广东_物理_2015_1', title: '13．甲、乙两人同时同地出发骑自行车做直线运动，前1小时内的位移-时间图像如图3所示，下列表', subject: '物理', year: '2015', province: '广东'})
WITH q MATCH (p:Paper {name: '2015年高考物理试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_物理_2015_2', title: '14．如图4所示，帆板在海面上以速度v朝正西方向运动，帆船以速度v朝正北方向航行，以帆板为参', subject: '物理', year: '2015', province: '广东'})
WITH q MATCH (p:Paper {name: '2015年高考物理试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_物理_2015_3', title: '15．图5为气流加热装置的示意图，使用电阻丝加热导气管，视变压器为理想变压器，原线圈接入电', subject: '物理', year: '2015', province: '广东'})
WITH q MATCH (p:Paper {name: '2015年高考物理试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_物理_2015_4', title: '16．在同一匀强磁场中，α粒子(4He)和质子(2H )做匀速圆周运动，若它们的动量大小相等，则α粒子', subject: '物理', year: '2015', province: '广东'})
WITH q MATCH (p:Paper {name: '2015年高考物理试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_物理_2015_5', title: '17．图6为某实验器材的结构示意图，金属内筒和隔热外筒间封闭了一定体积的空气，内筒中有水，', subject: '物理', year: '2015', province: '广东'})
WITH q MATCH (p:Paper {name: '2015年高考物理试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2010年高考物理试卷（广东）（空白卷）.pdf', province: '广东', subject: '物理', year: '2010', type: '空白卷', volume: '空白卷', preview: '2010年普通高等学校招生全国统一考试（广东卷物理）
一、单项选择题：本大题共4小题，每小题4分。共16分。在每小题给出的四个选项中，只有
一个选项符合题目要求，选对的得4分，选错或不答的得0分。
13.
图2为节日里悬挂灯笼的一种方式，A,B点等高，O为结点，轻绳AO、BO长度相等，拉力分别
为F', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '广东'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '物理', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '广东_物理_2010_1', title: '一、单项选择题：本大题共4小题，每小题4分。共16分。在每小题给出的四个选项中，只有', subject: '物理', year: '2010', province: '广东'})
WITH q MATCH (p:Paper {name: '2010年高考物理试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_物理_2010_2', title: '13.', subject: '物理', year: '2010', province: '广东'})
WITH q MATCH (p:Paper {name: '2010年高考物理试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_物理_2010_3', title: '13. 图2为节日里悬挂灯笼的一种方式，A、B点等高，O为结点，', subject: '物理', year: '2010', province: '广东'})
WITH q MATCH (p:Paper {name: '2010年高考物理试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_物理_2010_4', title: '14. 图3是密闭的气缸，外力推动活塞P压缩气体，对缸内气体', subject: '物理', year: '2010', province: '广东'})
WITH q MATCH (p:Paper {name: '2010年高考物理试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_物理_2010_5', title: '15.', subject: '物理', year: '2010', province: '广东'})
WITH q MATCH (p:Paper {name: '2010年高考物理试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2009年高考物理试卷（广东）（空白卷）.pdf', province: '广东', subject: '物理', year: '2009', type: '空白卷', volume: '空白卷', preview: '秘密★启用前
★★★★★★
2009年普通高等学校招生全国统一考试（广东卷）
物理
本试卷共8页，20小题，满分150分。考试用时120分钟。
注意事项：1.答卷前，考生务必用黑色字迹的钢笔或签字笔将自己的姓名和考生号、试室号、座位号填写在答
题卡上。用2B铅笔将试卷类型（A）填涂在答题卡相应位置上', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '广东'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '物理', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '广东_物理_2009_1', title: '2.选择题每小题选出答案后，用2B铅笔把答题卡上对应题目选项的答案信息点涂黑，如需改动用橡', subject: '物理', year: '2009', province: '广东'})
WITH q MATCH (p:Paper {name: '2009年高考物理试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_物理_2009_2', title: '3.非选择题必须用黑色字迹的钢笔或签字笔作答。答案必须写在答题卡各题目指定区域内相应的位', subject: '物理', year: '2009', province: '广东'})
WITH q MATCH (p:Paper {name: '2009年高考物理试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_物理_2009_3', title: '4．作答选做题时，请先用2B铅笔填涂选做题的题号对应的信息点，再作答。漏涂、错涂、多涂的', subject: '物理', year: '2009', province: '广东'})
WITH q MATCH (p:Paper {name: '2009年高考物理试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_物理_2009_4', title: '5.考生必须保持答题卡的整洁。考试结束后，将试卷和答题卡一并交回。', subject: '物理', year: '2009', province: '广东'})
WITH q MATCH (p:Paper {name: '2009年高考物理试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_物理_2009_5', title: '一、选择题：本大题共12小题，每小题4分，共48分。在每小题给出的四个选项中，有一个或一个以上选项符', subject: '物理', year: '2009', province: '广东'})
WITH q MATCH (p:Paper {name: '2009年高考物理试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '广东历史.pdf', province: '广东', subject: '物理', year: '未知', type: '未知', volume: '', preview: '', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '广东'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '物理', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)

MERGE (p:Paper {name: '2021年高考物理试卷（广东）（空白卷）.pdf', province: '广东', subject: '物理', year: '2021', type: '空白卷', volume: '空白卷', preview: '2021 年广东省普通高中学业水平选择性考试
物理
一、单项选择题：本题共 7小题，每小题 4分，共 28分。在每小题给出的四个选项中，只有
一项是符合题目要求的。
1. 科学家发现银河系中存在大量的放射性同位素铝26，铝26的半衰期为72万年，其衰变方程为
26Al®26 Mg+Y，下列说法正确的', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '广东'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '物理', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '广东_物理_2021_1', title: '一、单项选择题：本题共 7小题，每小题 4分，共 28分。在每小题给出的四个选项中，只有', subject: '物理', year: '2021', province: '广东'})
WITH q MATCH (p:Paper {name: '2021年高考物理试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_物理_2021_2', title: '1. 科学家发现银河系中存在大量的放射性同位素铝26，铝26的半衰期为72万年，其衰变方程为', subject: '物理', year: '2021', province: '广东'})
WITH q MATCH (p:Paper {name: '2021年高考物理试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_物理_2021_3', title: '2. 2021年4月，我国自主研发的空间站“天和”核心舱成功发射并入轨运行，若核心舱绕地球的运行可视', subject: '物理', year: '2021', province: '广东'})
WITH q MATCH (p:Paper {name: '2021年高考物理试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_物理_2021_4', title: '3. 唐代《耒耜经》记载了曲辕犁相对直辕犁的优势之一是起土省力，设牛用大小相等的拉力F通过耕索分', subject: '物理', year: '2021', province: '广东'})
WITH q MATCH (p:Paper {name: '2021年高考物理试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_物理_2021_5', title: '5. 截面为正方形的绝缘弹性长管中心有一固定长直导线，长管外表面固定着对称分布的四根平行长直导线，', subject: '物理', year: '2021', province: '广东'})
WITH q MATCH (p:Paper {name: '2021年高考物理试卷（广东）（空白卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2012年高考物理试卷（广东）（解析卷）.pdf', province: '广东', subject: '物理', year: '2012', type: '解析卷', volume: '解析卷', preview: '【试卷总评】2012年广东卷试题严格按照2012年考试说明来命题，注重基础知识和物理方
法的考查，和实际联系比较紧密，有一定的区分度。考查内容包括了物体的平衡、牛顿运动
定律、曲线运动、万有引力、功能关系、电场、磁场、电磁感应、交变电流、、热学和动量
等相关知识。试题设计科学严谨、自然完整，很好地体', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '广东'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '物理', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '广东_物理_2012_1', title: '单项选择题（每小题 4 分）', subject: '物理', year: '2012', province: '广东'})
WITH q MATCH (p:Paper {name: '2012年高考物理试卷（广东）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_物理_2012_2', title: '13． 清晨 ，草叶上的露珠是由空气中的水汽凝结成的水珠。这一物理过程中，水分子间的', subject: '物理', year: '2012', province: '广东'})
WITH q MATCH (p:Paper {name: '2012年高考物理试卷（广东）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_物理_2012_3', title: '14．景颇族的祖先发明的点火器如图1所示，用牛角做套筒，木质推杆前端粘着艾绒。猛推', subject: '物理', year: '2012', province: '广东'})
WITH q MATCH (p:Paper {name: '2012年高考物理试卷（广东）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_物理_2012_4', title: '15．质量和电量都相等的带电粒子M和N，以不同的速度率经小孔S垂直进入匀强磁场，', subject: '物理', year: '2012', province: '广东'})
WITH q MATCH (p:Paper {name: '2012年高考物理试卷（广东）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '广东_物理_2012_5', title: '16．如图3所示，两根等长的轻绳将日光灯悬挂在天花板上，两绳与竖直方向的夹角都为', subject: '物理', year: '2012', province: '广东'})
WITH q MATCH (p:Paper {name: '2012年高考物理试卷（广东）（解析卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2025年高考数学新课标全国Ⅰ卷真题+答案（版本3）.pdf', province: '福建', subject: '数学', year: '2025', type: '未知', volume: '', preview: '', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '福建'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '数学', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)

MERGE (p:Paper {name: '2025年高考山东政治-f076af308182.pdf', province: '山东', subject: '政治', year: '2025', type: '未知', volume: '', preview: '', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '山东'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '政治', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)

MERGE (p:Paper {name: '2025年高考数学新课标全国Ⅰ卷真题+答案（版本3）.pdf', province: '山东', subject: '数学', year: '2025', type: '未知', volume: '', preview: '', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '山东'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '数学', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)

MERGE (p:Paper {name: '2025年高考数学新课标全国Ⅱ卷真题+答案（参考2）.pdf', province: '云南', subject: '数学', year: '2025', type: '未知', volume: '', preview: '2025 年全国统一高考数学试卷（新高考Ⅱ）
参考答案
一、选择题：本题共8小题，每小题5分，共40分，在每小题给出的四个选项中，只有一
项是符合题目要求的。
1. 2，8，14，16，20 平均数为（ ）
A. 8 B. 9 C. 12 D. 18
【答案】C
28141620
【解答】x', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '云南'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '数学', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '云南_数学_2025_1', title: '一、选择题：本题共8小题，每小题5分，共40分，在每小题给出的四个选项中，只有一', subject: '数学', year: '2025', province: '云南'})
WITH q MATCH (p:Paper {name: '2025年高考数学新课标全国Ⅱ卷真题+答案（参考2）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '云南_数学_2025_2', title: '1. 2，8，14，16，20 平均数为（ ）', subject: '数学', year: '2025', province: '云南'})
WITH q MATCH (p:Paper {name: '2025年高考数学新课标全国Ⅱ卷真题+答案（参考2）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '云南_数学_2025_3', title: '2. z 1i， （ ）', subject: '数学', year: '2025', province: '云南'})
WITH q MATCH (p:Paper {name: '2025年高考数学新课标全国Ⅱ卷真题+答案（参考2）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '云南_数学_2025_4', title: '3. A{4,0,1,2,8} B {x|x3  x}，AB （ ）', subject: '数学', year: '2025', province: '云南'})
WITH q MATCH (p:Paper {name: '2025年高考数学新课标全国Ⅱ卷真题+答案（参考2）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '云南_数学_2025_5', title: '4. 2解集是（ ）', subject: '数学', year: '2025', province: '云南'})
WITH q MATCH (p:Paper {name: '2025年高考数学新课标全国Ⅱ卷真题+答案（参考2）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2025年高考政治真题及答案.pdf', province: '重庆', subject: '政治', year: '2025', type: '未知', volume: '', preview: '', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '重庆'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '政治', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)

MERGE (p:Paper {name: '2025年高考数学新课标全国Ⅱ卷真题+答案（参考2）.pdf', province: '重庆', subject: '数学', year: '2025', type: '未知', volume: '', preview: '2025 年全国统一高考数学试卷（新高考Ⅱ）
参考答案
一、选择题：本题共8小题，每小题5分，共40分，在每小题给出的四个选项中，只有一
项是符合题目要求的。
1. 2，8，14，16，20 平均数为（ ）
A. 8 B. 9 C. 12 D. 18
【答案】C
28141620
【解答】x', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '重庆'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '数学', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '重庆_数学_2025_1', title: '一、选择题：本题共8小题，每小题5分，共40分，在每小题给出的四个选项中，只有一', subject: '数学', year: '2025', province: '重庆'})
WITH q MATCH (p:Paper {name: '2025年高考数学新课标全国Ⅱ卷真题+答案（参考2）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '重庆_数学_2025_2', title: '1. 2，8，14，16，20 平均数为（ ）', subject: '数学', year: '2025', province: '重庆'})
WITH q MATCH (p:Paper {name: '2025年高考数学新课标全国Ⅱ卷真题+答案（参考2）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '重庆_数学_2025_3', title: '2. z 1i， （ ）', subject: '数学', year: '2025', province: '重庆'})
WITH q MATCH (p:Paper {name: '2025年高考数学新课标全国Ⅱ卷真题+答案（参考2）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '重庆_数学_2025_4', title: '3. A{4,0,1,2,8} B {x|x3  x}，AB （ ）', subject: '数学', year: '2025', province: '重庆'})
WITH q MATCH (p:Paper {name: '2025年高考数学新课标全国Ⅱ卷真题+答案（参考2）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '重庆_数学_2025_5', title: '4. 2解集是（ ）', subject: '数学', year: '2025', province: '重庆'})
WITH q MATCH (p:Paper {name: '2025年高考数学新课标全国Ⅱ卷真题+答案（参考2）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2025年高考数学新课标全国Ⅱ卷真题+答案（参考2）.pdf', province: '黑龙江', subject: '数学', year: '2025', type: '未知', volume: '', preview: '2025 年全国统一高考数学试卷（新高考Ⅱ）
参考答案
一、选择题：本题共8小题，每小题5分，共40分，在每小题给出的四个选项中，只有一
项是符合题目要求的。
1. 2，8，14，16，20 平均数为（ ）
A. 8 B. 9 C. 12 D. 18
【答案】C
28141620
【解答】x', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '黑龙江'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '数学', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '黑龙江_数学_2025_1', title: '一、选择题：本题共8小题，每小题5分，共40分，在每小题给出的四个选项中，只有一', subject: '数学', year: '2025', province: '黑龙江'})
WITH q MATCH (p:Paper {name: '2025年高考数学新课标全国Ⅱ卷真题+答案（参考2）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '黑龙江_数学_2025_2', title: '1. 2，8，14，16，20 平均数为（ ）', subject: '数学', year: '2025', province: '黑龙江'})
WITH q MATCH (p:Paper {name: '2025年高考数学新课标全国Ⅱ卷真题+答案（参考2）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '黑龙江_数学_2025_3', title: '2. z 1i， （ ）', subject: '数学', year: '2025', province: '黑龙江'})
WITH q MATCH (p:Paper {name: '2025年高考数学新课标全国Ⅱ卷真题+答案（参考2）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '黑龙江_数学_2025_4', title: '3. A{4,0,1,2,8} B {x|x3  x}，AB （ ）', subject: '数学', year: '2025', province: '黑龙江'})
WITH q MATCH (p:Paper {name: '2025年高考数学新课标全国Ⅱ卷真题+答案（参考2）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '黑龙江_数学_2025_5', title: '4. 2解集是（ ）', subject: '数学', year: '2025', province: '黑龙江'})
WITH q MATCH (p:Paper {name: '2025年高考数学新课标全国Ⅱ卷真题+答案（参考2）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2025年高考数学新课标全国Ⅱ卷真题+答案（参考2）.pdf', province: '安徽', subject: '数学', year: '2025', type: '未知', volume: '', preview: '2025 年全国统一高考数学试卷（新高考Ⅱ）
参考答案
一、选择题：本题共8小题，每小题5分，共40分，在每小题给出的四个选项中，只有一
项是符合题目要求的。
1. 2，8，14，16，20 平均数为（ ）
A. 8 B. 9 C. 12 D. 18
【答案】C
28141620
【解答】x', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '安徽'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '数学', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '安徽_数学_2025_1', title: '一、选择题：本题共8小题，每小题5分，共40分，在每小题给出的四个选项中，只有一', subject: '数学', year: '2025', province: '安徽'})
WITH q MATCH (p:Paper {name: '2025年高考数学新课标全国Ⅱ卷真题+答案（参考2）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '安徽_数学_2025_2', title: '1. 2，8，14，16，20 平均数为（ ）', subject: '数学', year: '2025', province: '安徽'})
WITH q MATCH (p:Paper {name: '2025年高考数学新课标全国Ⅱ卷真题+答案（参考2）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '安徽_数学_2025_3', title: '2. z 1i， （ ）', subject: '数学', year: '2025', province: '安徽'})
WITH q MATCH (p:Paper {name: '2025年高考数学新课标全国Ⅱ卷真题+答案（参考2）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '安徽_数学_2025_4', title: '3. A{4,0,1,2,8} B {x|x3  x}，AB （ ）', subject: '数学', year: '2025', province: '安徽'})
WITH q MATCH (p:Paper {name: '2025年高考数学新课标全国Ⅱ卷真题+答案（参考2）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '安徽_数学_2025_5', title: '4. 2解集是（ ）', subject: '数学', year: '2025', province: '安徽'})
WITH q MATCH (p:Paper {name: '2025年高考数学新课标全国Ⅱ卷真题+答案（参考2）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2025年高考数学新课标全国Ⅰ卷真题+答案（版本3）.pdf', province: '浙江', subject: '数学', year: '2025', type: '未知', volume: '', preview: '', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '浙江'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '数学', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)

MERGE (p:Paper {name: '2025年高考数学新课标全国Ⅱ卷真题+答案（参考2）.pdf', province: '吉林', subject: '数学', year: '2025', type: '未知', volume: '', preview: '2025 年全国统一高考数学试卷（新高考Ⅱ）
参考答案
一、选择题：本题共8小题，每小题5分，共40分，在每小题给出的四个选项中，只有一
项是符合题目要求的。
1. 2，8，14，16，20 平均数为（ ）
A. 8 B. 9 C. 12 D. 18
【答案】C
28141620
【解答】x', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '吉林'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '数学', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '吉林_数学_2025_1', title: '一、选择题：本题共8小题，每小题5分，共40分，在每小题给出的四个选项中，只有一', subject: '数学', year: '2025', province: '吉林'})
WITH q MATCH (p:Paper {name: '2025年高考数学新课标全国Ⅱ卷真题+答案（参考2）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '吉林_数学_2025_2', title: '1. 2，8，14，16，20 平均数为（ ）', subject: '数学', year: '2025', province: '吉林'})
WITH q MATCH (p:Paper {name: '2025年高考数学新课标全国Ⅱ卷真题+答案（参考2）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '吉林_数学_2025_3', title: '2. z 1i， （ ）', subject: '数学', year: '2025', province: '吉林'})
WITH q MATCH (p:Paper {name: '2025年高考数学新课标全国Ⅱ卷真题+答案（参考2）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '吉林_数学_2025_4', title: '3. A{4,0,1,2,8} B {x|x3  x}，AB （ ）', subject: '数学', year: '2025', province: '吉林'})
WITH q MATCH (p:Paper {name: '2025年高考数学新课标全国Ⅱ卷真题+答案（参考2）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '吉林_数学_2025_5', title: '4. 2解集是（ ）', subject: '数学', year: '2025', province: '吉林'})
WITH q MATCH (p:Paper {name: '2025年高考数学新课标全国Ⅱ卷真题+答案（参考2）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2025年高考数学新课标全国Ⅰ卷真题+答案（版本3）.pdf', province: '河北', subject: '数学', year: '2025', type: '未知', volume: '', preview: '', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '河北'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '数学', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)

MERGE (p:Paper {name: '2025年高考政治真题及答案.pdf', province: '河北', subject: '政治', year: '2025', type: '未知', volume: '', preview: '', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '河北'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '政治', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)

MERGE (p:Paper {name: '2025年高考数学真题及答案（天津卷）.pdf', province: '天津', subject: '数学', year: '2025', type: '未知', volume: '天津卷', preview: '2025年普通高等学校招生全国统一考试（天津卷）
数学
★祝大家学习生活愉快★
注意事项：
1．答卷前，考生务必用黑色字迹的钢笔或签字笔将自己的姓名和考生号，试室号，座位号填写在答题
卡上。用2B铅笔将试卷类型和考生号填涂在答题卡相应位置上。
2．选择题每小题选出答案后，用2B铅笔把答题卡上对应的题', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '天津'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '数学', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '天津_数学_2025_1', title: '1．答卷前，考生务必用黑色字迹的钢笔或签字笔将自己的姓名和考生号，试室号，座位号填写在答题', subject: '数学', year: '2025', province: '天津'})
WITH q MATCH (p:Paper {name: '2025年高考数学真题及答案（天津卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '天津_数学_2025_2', title: '2．选择题每小题选出答案后，用2B铅笔把答题卡上对应的题目选项的答案信息点涂黑；如需改动，用', subject: '数学', year: '2025', province: '天津'})
WITH q MATCH (p:Paper {name: '2025年高考数学真题及答案（天津卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '天津_数学_2025_3', title: '3．非选择题必须用黑色字迹的钢笔或签字笔作答，答案必须写在答题卡各题目指定区域内相应位置', subject: '数学', year: '2025', province: '天津'})
WITH q MATCH (p:Paper {name: '2025年高考数学真题及答案（天津卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '天津_数学_2025_4', title: '一、单选题：每小题给出的四个选项中，每小题只有一个选项符合要求', subject: '数学', year: '2025', province: '天津'})
WITH q MATCH (p:Paper {name: '2025年高考数学真题及答案（天津卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '天津_数学_2025_5', title: '1.集合U=1,2,3,4,5A=1,3B=2,3,5，则C (A∪B)= ( )', subject: '数学', year: '2025', province: '天津'})
WITH q MATCH (p:Paper {name: '2025年高考数学真题及答案（天津卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2025年高考数学新课标全国Ⅱ卷真题+答案（参考2）.pdf', province: '山西', subject: '数学', year: '2025', type: '未知', volume: '', preview: '2025 年全国统一高考数学试卷（新高考Ⅱ）
参考答案
一、选择题：本题共8小题，每小题5分，共40分，在每小题给出的四个选项中，只有一
项是符合题目要求的。
1. 2，8，14，16，20 平均数为（ ）
A. 8 B. 9 C. 12 D. 18
【答案】C
28141620
【解答】x', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '山西'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '数学', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '山西_数学_2025_1', title: '一、选择题：本题共8小题，每小题5分，共40分，在每小题给出的四个选项中，只有一', subject: '数学', year: '2025', province: '山西'})
WITH q MATCH (p:Paper {name: '2025年高考数学新课标全国Ⅱ卷真题+答案（参考2）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '山西_数学_2025_2', title: '1. 2，8，14，16，20 平均数为（ ）', subject: '数学', year: '2025', province: '山西'})
WITH q MATCH (p:Paper {name: '2025年高考数学新课标全国Ⅱ卷真题+答案（参考2）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '山西_数学_2025_3', title: '2. z 1i， （ ）', subject: '数学', year: '2025', province: '山西'})
WITH q MATCH (p:Paper {name: '2025年高考数学新课标全国Ⅱ卷真题+答案（参考2）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '山西_数学_2025_4', title: '3. A{4,0,1,2,8} B {x|x3  x}，AB （ ）', subject: '数学', year: '2025', province: '山西'})
WITH q MATCH (p:Paper {name: '2025年高考数学新课标全国Ⅱ卷真题+答案（参考2）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '山西_数学_2025_5', title: '4. 2解集是（ ）', subject: '数学', year: '2025', province: '山西'})
WITH q MATCH (p:Paper {name: '2025年高考数学新课标全国Ⅱ卷真题+答案（参考2）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2025年高考数学真题（上海卷）.pdf', province: '上海', subject: '数学', year: '2025', type: '未知', volume: '上海卷', preview: '2025年普通高等学校招生全国统一考试（上海卷）
数学
★祝大家学习生活愉快★
注意事项：
1．答卷前，考生务必用黑色字迹的钢笔或签字笔将自己的姓名和考生号，试室号，座位号填写在答题
卡上。用2B铅笔将试卷类型和考生号填涂在答题卡相应位置上。
2．选择题每小题选出答案后，用2B铅笔把答题卡上对应的题', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '上海'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '数学', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '上海_数学_2025_1', title: '1．答卷前，考生务必用黑色字迹的钢笔或签字笔将自己的姓名和考生号，试室号，座位号填写在答题', subject: '数学', year: '2025', province: '上海'})
WITH q MATCH (p:Paper {name: '2025年高考数学真题（上海卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '上海_数学_2025_2', title: '2．选择题每小题选出答案后，用2B铅笔把答题卡上对应的题目选项的答案信息点涂黑；如需改动，用', subject: '数学', year: '2025', province: '上海'})
WITH q MATCH (p:Paper {name: '2025年高考数学真题（上海卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '上海_数学_2025_3', title: '3．非选择题必须用黑色字迹的钢笔或签字笔作答，答案必须写在答题卡各题目指定区域内相应位置', subject: '数学', year: '2025', province: '上海'})
WITH q MATCH (p:Paper {name: '2025年高考数学真题（上海卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '上海_数学_2025_4', title: '一、填空题（本大题共12题，第1∼6题每题4分，第7∼12题每题5分，共54分。考生应在答题纸的相应', subject: '数学', year: '2025', province: '上海'})
WITH q MATCH (p:Paper {name: '2025年高考数学真题（上海卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '上海_数学_2025_5', title: '1.已知全集U={x|2≤x≤5,x∈R}，集合A={x|2≤x<4,x∈R}，则A= ．', subject: '数学', year: '2025', province: '上海'})
WITH q MATCH (p:Paper {name: '2025年高考数学真题（上海卷）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2025年高考江苏政治试题.pdf', province: '江苏', subject: '政治', year: '2025', type: '未知', volume: '', preview: '2025 年普通高中学业水平选择性考试（江苏卷）
思想政治
本试卷满分 100 分 考试时间 75分钟
一、单项选择题：共 15 题，每题 3分，共 45分。每题只有一个选项最符合题意。
1. 如下图所示，中国共产党在不同的历史时期，提出了自己的文化纲领、目标和政策，引领文化建设不断
取得新成就。材', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '江苏'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '政治', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '江苏_政治_2025_1', title: '一、单项选择题：共 15 题，每题 3分，共 45分。每题只有一个选项最符合题意。', subject: '政治', year: '2025', province: '江苏'})
WITH q MATCH (p:Paper {name: '2025年高考江苏政治试题.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '江苏_政治_2025_2', title: '1. 如下图所示，中国共产党在不同的历史时期，提出了自己的文化纲领、目标和政策，引领文化建设不断', subject: '政治', year: '2025', province: '江苏'})
WITH q MATCH (p:Paper {name: '2025年高考江苏政治试题.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '江苏_政治_2025_3', title: '2. 党的十八大以来，以习近平同志为核心的党中央在全面深化改革中不断推进理论创新，及时总结新鲜经', subject: '政治', year: '2025', province: '江苏'})
WITH q MATCH (p:Paper {name: '2025年高考江苏政治试题.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '江苏_政治_2025_4', title: '4.2025年3月《政府工作报告》提出，创新和丰富消费场景，加快数字、绿色、智能等新型消费发展。随', subject: '政治', year: '2025', province: '江苏'})
WITH q MATCH (p:Paper {name: '2025年高考江苏政治试题.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2025年高考数学新课标全国Ⅰ卷真题+答案（版本3）.pdf', province: '江苏', subject: '数学', year: '2025', type: '未知', volume: '', preview: '', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '江苏'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '数学', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)

MERGE (p:Paper {name: '2025年高考数学新课标全国Ⅱ卷真题+答案（参考2）.pdf', province: '辽宁', subject: '数学', year: '2025', type: '未知', volume: '', preview: '2025 年全国统一高考数学试卷（新高考Ⅱ）
参考答案
一、选择题：本题共8小题，每小题5分，共40分，在每小题给出的四个选项中，只有一
项是符合题目要求的。
1. 2，8，14，16，20 平均数为（ ）
A. 8 B. 9 C. 12 D. 18
【答案】C
28141620
【解答】x', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '辽宁'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '数学', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '辽宁_数学_2025_1', title: '一、选择题：本题共8小题，每小题5分，共40分，在每小题给出的四个选项中，只有一', subject: '数学', year: '2025', province: '辽宁'})
WITH q MATCH (p:Paper {name: '2025年高考数学新课标全国Ⅱ卷真题+答案（参考2）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '辽宁_数学_2025_2', title: '1. 2，8，14，16，20 平均数为（ ）', subject: '数学', year: '2025', province: '辽宁'})
WITH q MATCH (p:Paper {name: '2025年高考数学新课标全国Ⅱ卷真题+答案（参考2）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '辽宁_数学_2025_3', title: '2. z 1i， （ ）', subject: '数学', year: '2025', province: '辽宁'})
WITH q MATCH (p:Paper {name: '2025年高考数学新课标全国Ⅱ卷真题+答案（参考2）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '辽宁_数学_2025_4', title: '3. A{4,0,1,2,8} B {x|x3  x}，AB （ ）', subject: '数学', year: '2025', province: '辽宁'})
WITH q MATCH (p:Paper {name: '2025年高考数学新课标全国Ⅱ卷真题+答案（参考2）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '辽宁_数学_2025_5', title: '4. 2解集是（ ）', subject: '数学', year: '2025', province: '辽宁'})
WITH q MATCH (p:Paper {name: '2025年高考数学新课标全国Ⅱ卷真题+答案（参考2）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)

MERGE (p:Paper {name: '2025年高考数学新课标全国Ⅰ卷真题+答案（版本3）.pdf', province: '湖北', subject: '数学', year: '2025', type: '未知', volume: '', preview: '', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '湖北'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '数学', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)

MERGE (p:Paper {name: '政治-2025年高考考前最后一课.pdf', province: '北京', subject: '政治', year: '未知', type: '未知', volume: '', preview: '{#{QQABIQQUggiIAAIAABgCUwFyCEKQkAAAASoOQEAQMAABAANABAA=}#} 以青春之名，赴梦想之约
——致即将奔赴考场的你
亲爱的同学们：
当凤凰花开满枝头，当蝉鸣唤醒盛夏，你们将执笔为剑，在考场上书写青春的答卷。这三
年，你们见过彼此晨光熹微时的早读身影，', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '北京'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '政治', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)

MERGE (p:Paper {name: '2024年普通高等学校招生全国统一考试(北京卷)答案.pdf', province: '北京', subject: '数学', year: '2024', type: '未知', volume: '', preview: '!"!#%&’()*+,-./01"2
!786"
$!+!*{–0(cid:226)|g%(I=3##$"%’#$##$!
!!+!*st(%’#-!%$)-"#$)-!
’!.!N,0(cid:155)(cid:156)"(cid:147)}(cid:155)(cid:156)%(!$%$"!(', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '北京'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '数学', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)

MERGE (p:Paper {name: '2025年高考数学考前最后一课.pdf', province: '北京', subject: '数学', year: '2025', type: '未知', volume: '', preview: '{#{QQABBQIAggCgABAAABhCAwWQCgOQkBCCAYoGgFAYMAIAgQNABCA=}#} 以青春之名，赴梦想之约
——致即将奔赴考场的你
亲爱的同学们：
当凤凰花开满枝头，当蝉鸣唤醒盛夏，你们将执笔为剑，在考场上书写青春的答卷。这三
年，你们见过彼此晨光熹微时的早读身影，', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '北京'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '数学', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)

MERGE (p:Paper {name: '2025年高考数学新课标全国Ⅱ卷真题+答案（参考2）.pdf', province: '海南', subject: '数学', year: '2025', type: '未知', volume: '', preview: '2025 年全国统一高考数学试卷（新高考Ⅱ）
参考答案
一、选择题：本题共8小题，每小题5分，共40分，在每小题给出的四个选项中，只有一
项是符合题目要求的。
1. 2，8，14，16，20 平均数为（ ）
A. 8 B. 9 C. 12 D. 18
【答案】C
28141620
【解答】x', level: 'gaokao'})
WITH p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PAPER]->(p)
MERGE (prov:Province {name: '海南'})
WITH prov, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_PROVINCE]->(prov)
WITH prov, p MERGE (prov)-[:HAS_PAPER]->(p)
MERGE (s:Subject {name: '数学', level: 'gaokao'})
WITH s, p MATCH (r:Root {name: '高考真题题库'}) MERGE (r)-[:HAS_SUBJECT]->(s)
WITH s, p MERGE (s)-[:HAS_PAPER]->(p)
MERGE (q:Question {id: '海南_数学_2025_1', title: '一、选择题：本题共8小题，每小题5分，共40分，在每小题给出的四个选项中，只有一', subject: '数学', year: '2025', province: '海南'})
WITH q MATCH (p:Paper {name: '2025年高考数学新课标全国Ⅱ卷真题+答案（参考2）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '海南_数学_2025_2', title: '1. 2，8，14，16，20 平均数为（ ）', subject: '数学', year: '2025', province: '海南'})
WITH q MATCH (p:Paper {name: '2025年高考数学新课标全国Ⅱ卷真题+答案（参考2）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '海南_数学_2025_3', title: '2. z 1i， （ ）', subject: '数学', year: '2025', province: '海南'})
WITH q MATCH (p:Paper {name: '2025年高考数学新课标全国Ⅱ卷真题+答案（参考2）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '海南_数学_2025_4', title: '3. A{4,0,1,2,8} B {x|x3  x}，AB （ ）', subject: '数学', year: '2025', province: '海南'})
WITH q MATCH (p:Paper {name: '2025年高考数学新课标全国Ⅱ卷真题+答案（参考2）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
MERGE (q:Question {id: '海南_数学_2025_5', title: '4. 2解集是（ ）', subject: '数学', year: '2025', province: '海南'})
WITH q MATCH (p:Paper {name: '2025年高考数学新课标全国Ⅱ卷真题+答案（参考2）.pdf'}) MERGE (p)-[:HAS_QUESTION]->(q)
