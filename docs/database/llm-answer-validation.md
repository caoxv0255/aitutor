# LLM 补答案 —— 本库真题盲测验证报告

生成时间: 2026-09-18 11:21　模型: `deepseek-v3.2`（`enable_search=True`）　样本: 300 道

## 方法

从库中随机抽取**已有经核验答案**的选择题，用与补答案**完全相同**的 prompt 问模型，把「源答案」与「LLM 答案」并列比对。源答案来自试卷原文解析，独立于模型。

## 一、总体准确率

**250 / 300 = 83.3%**（无作答 0 道）

即：LLM 补的每条答案，**约 16.7% 的概率是错的**。按当前库内 2782 条 LLM 兜底答案推算，**约 463 条不正确**。

## 二、按学科

| 学科 | 样本 | 答对 | 准确率 |
|---|---:|---:|---:|
| biology | 34 | 32 | 94.1% |
| physics | 22 | 20 | 90.9% |
| politics | 43 | 39 | 90.7% |
| math | 17 | 15 | 88.2% |
| history | 48 | 42 | 87.5% |
| chemistry | 32 | 26 | 81.2% |
| english | 75 | 57 | 76.0% |
| geography | 22 | 15 | 68.2% |
| chinese | 7 | 4 | 57.1% |

## 三、按年份

| 年份 | 样本 | 答对 | 准确率 |
|---|---:|---:|---:|
| 2025 | 4 | 3 | 75.0% |
| 2024 | 20 | 17 | 85.0% |
| 2023 | 24 | 20 | 83.3% |
| 2022 | 28 | 22 | 78.6% |
| 2021 | 15 | 13 | 86.7% |
| 2020 | 23 | 21 | 91.3% |
| 2019 | 13 | 12 | 92.3% |
| 2018 | 11 | 9 | 81.8% |
| 2017 | 12 | 10 | 83.3% |
| 2016 | 13 | 12 | 92.3% |
| 2015 | 17 | 16 | 94.1% |
| 2014 | 13 | 10 | 76.9% |
| 2013 | 19 | 16 | 84.2% |
| 2012 | 16 | 13 | 81.2% |
| 2011 | 12 | 8 | 66.7% |
| 2010 | 24 | 19 | 79.2% |
| 2009 | 15 | 13 | 86.7% |
| 2008 | 21 | 16 | 76.2% |

## 四、错例明细（源答案 vs LLM 答案）

### 2010 年 · english · national · 第 62 题

- 来源卷：`2010年高考英语试卷（新课标Ⅰ卷）（解析卷）.docx`
- **源答案 = B　LLM 答案 = C** ❌

题干：We know from the text that Ginger Gray     .

- A. manages the Dixie PIT program in Kenton County
- B. sees that the drinks meet health standards
- C. teaches at Dixie Heights High School
- D. owns the school’s coffee shop

---

### 2014 年 · english · anhui · 第 72 题

- 来源卷：`2014年高考英语试卷（安徽）（解析卷）.docx`
- **源答案 = A　LLM 答案 = D** ❌

题干：Which of the following could be the best title for the passage?

- A. Cltungemakers
- B. Businessmen
- C. Social Conditions
- D. Rubbish Problem

---

### 2014 年 · history · beijing · 第 11 题

- 来源卷：`2014年高考历史试卷（北京）（解析卷）.docx`
- **源答案 = C　LLM 答案 = B** ❌

题干：（4分）19世纪以来，一些阿拉伯国家进行了近代化改革，其中以埃及的穆罕默德•阿里改革和土耳其的凯末尔改革最具代表性。这两次改革相同之处有（  ）①废除哈里发制度  ②进行军事改革    ③建立近代工业    ④实行教育改革。

- A. ①②
- B. ②③
- C. ③④
- D. ①④

---

### 2016 年 · english · tianjin · 第 13 题

- 来源卷：`2016年高考英语试卷（天津）（解析卷）.docx`
- **源答案 = D　LLM 答案 = C** ❌

题干：（1分）You are waiting at a wrong place．It is at the hotel ____ the coach picks up tourists．（  ）

- A. who
- B. which
- C. where
- D. that

---

### 2008 年 · english · zhejiang · 第 60 题

- 来源卷：`2008年高考英语试卷（浙江）（解析卷）.docx`
- **源答案 = C　LLM 答案 = A** ❌

题干：What is mainly discussed in the text?

- A. Clothesline drying: a way to save energy and money.
- B. Clothesline drying: a lost art rediscovered.
- C. Opposite opinions on clothesline drying.
- D. Different varieties of clotheslines.第二节：Molly信箱是一个报刊栏目，主持人Molly回答读者提出的各种问题。第61至65题是五位读者的来信。请从A、B、C、D、E和F中为每封来信

---

### 2013 年 · politics · jiangsu · 第 30 题

- 来源卷：`2013年高考政治试卷（江苏）（解析卷）.docx`
- **源答案 = C　LLM 答案 = B** ❌

题干：（2分）如图，漫画《如此修理》给人们的哲学启示是（  ）⟦IMG:rId8⟧

- A. 意识活动具有创造性
- B. 要坚持一切从实际出发
- C. 要着重抓住事物的主要矛盾
- D. 要着重把握矛盾的主要方面

---

### 2017 年 · english · beijing · 第 61 题

- 来源卷：`2017年高考英语试卷（北京）（解析卷）.docx`
- **源答案 = D　LLM 答案 = B** ❌

题干：How much should you pay if you make a 12-mouth subscription to TOKNOW with gift pack from China?

- A. £55.
- B. £60.
- C. £65.
- D. £70.

---

### 2022 年 · history · beijing · 第 2 题

- 来源卷：`2022年高考历史试卷（北京）（解析卷）.docx`
- **源答案 = D　LLM 答案 = B** ❌

题干：汉代某地区“地广人稀”，到南北朝时期逐渐发展为“民多田少”。这一地区位于右侧示意图中的⟦IMG:rId6⟧

- A. ①
- B. ②
- C. ③
- D. ④

---

### 2011 年 · english · sichuan · 第 51 题

- 来源卷：`2011年高考英语试卷（四川）（解析卷）.docx`
- **源答案 = A　LLM 答案 = D** ❌

题干：Which of the following is true of the LoB when it opens?a. It offers better learning toolsb. It reaches users in different waysc. It provides users with smart phoned. It allows users to enrich its materiale. It gives non-stop physical and digital services

- A. a, b, d
- B. a, c ,e
- C. b, c, d
- D. b, d, e

---

### 2013 年 · english · tianjin · 第 39 题

- 来源卷：`2013年高考英语试卷（天津）（解析卷）.docx`
- **源答案 = D　LLM 答案 = B** ❌

题干：A student can rent a locker in the library if he D

- A. can afford the rental fee
- B. attends certain coursed
- C. has nowhere to put his books
- D. has earned the required credits

---

### 2012 年 · history · jiangsu · 第 3 题

- 来源卷：`2012年高考历史试卷（江苏）（解析卷卷）   .docx`
- **源答案 = D　LLM 答案 = C** ❌

题干：（2.5分）以下关于“市”的材料中，最符合图中场景的是（  ）⟦IMG:rId2⟧

- A. “…立九市，其六市在道西，三市在道东。”
- B. “凡江淮草市，尽近水际。”
- C. “千竹夜市喧”；“蛮声喧夜市”
- D. “大街两边民户铺席…约十余里。”

---

### 2020 年 · physics · shandong · 第 8 题

- 来源卷：`2020年高考物理试卷（山东）（解析卷）.docx`
- **源答案 = C　LLM 答案 = A** ❌

题干：如图所示，一轻质光滑定滑轮固定在倾斜木板上，质量分别为m和2m的物块A、B，通过不可伸长的轻绳跨过滑轮连接，A、B间的接触面和轻绳均与木板平行。A与B间、B与木板间的动摩擦因数均为μ，设最大静摩擦力等于滑动摩擦力。当木板与水平面的夹角为45°时，物块A、B刚好要滑动，则μ的值为（  ）⟦IMG:rId178⟧

- A. ⟦F:rId180⟧
- B. ⟦F:rId182⟧
- C. ⟦F:rId184⟧
- D. ⟦F:rId186⟧

---

### 2019 年 · chemistry · beijing · 第 3 题

- 来源卷：`2019年高考化学试卷（北京）（解析卷）.docx`
- **源答案 = D　LLM 答案 = B** ❌

题干：（6分）2019年是元素周期表发表150周年，期间科学家为完善周期表做出了不懈努力。中国科学院院士张青莲教授曾主持测定了铟（49In）等9种元素相对原子质量的新值，被采用为国际新标准。铟与铷（37Rb）同周期。下列说法不正确的是（  ）

- A. In是第五周期第ⅢA族元素
- B. ⟦IMG:rId11⟧In的中子数与电子数的差值为17
- C. 原子半径：In＞Al
- D. 碱性：In（OH）3＞RbOH

---

### 2010 年 · english · national · 第 44 题

- 来源卷：`2010年高考英语试卷（新课标Ⅱ卷）（解析卷）.docx`
- **源答案 = A　LLM 答案 = C** ❌

题干：Some people got frightened by Brownie when she     .

- A. smiled
- B. barked
- C. rushed to thhem
- D. tried to be funny

---

### 2008 年 · math · shaanxi · 第 8 题

- 来源卷：`2008年高考数学试卷（文）（陕西）（解析卷）.docx`
- **源答案 = C　LLM 答案 = A** ❌

题干：（5分）（2008•陕西）长方体ABCD﹣A1B1C1D1的各顶点都在半径为1的球面上，其中AB：AD：AA1=2：1：⟦IMG:rId29⟧，则两A，B点的球面距离为（  ）⟦IMG:rId30⟧

- A. ⟦IMG:rId31⟧
- B. ⟦IMG:rId32⟧
- C. ⟦IMG:rId33⟧
- D. ⟦IMG:rId34⟧

---

### 2010 年 · english · national · 第 71 题

- 来源卷：`2010年高考英语试卷（新课标Ⅰ卷）（解析卷）.docx`
- **源答案 = D　LLM 答案 = B** ❌

题干：The author expected the train trip to be     .

- A. adventurous
- B. pleasant
- C. exciting
- D. dull

---

### 2018 年 · english · national · 第 21 题

- 来源卷：`2018年高考英语试卷（新课标Ⅰ卷）（解析卷）.docx`
- **源答案 = A　LLM 答案 = B** ❌

题干：Which tour do you need to book in advance?

- A. Cherry Blossom like Tour in Washington, D.C.
- B. Washington capital Monuments Bicycle Tour.
- C. Capital City Bike Tour in Washington,
- D. C.D. Washington Capital Sites at Night Bicycle Tour.

---

### 2025 年 · biology · national · 第 13 题

- 来源卷：`2025年高考生物试卷（黑吉辽蒙卷）（解析卷）.docx`
- **源答案 = D　LLM 答案 = B** ❌

题干：光照、植物激素EBR、脱落酸和赤霉素均参与调节拟南芥种子的萌发，部分作用关系如下图。下列叙述正确的是（    ）⟦IMG:rId16⟧

- A. 光敏色素是一类含有色素的脂质化合物
- B. 图中激素①是赤霉素，激素②是脱落酸
- C. EBR和赤霉素是相抗衡的关系
- D. 红光和EBR均能诱导拟南芥种子萌发

---

### 2012 年 · chinese · hunan · 第 5 题

- 来源卷：`2012年高考语文试卷（湖南）（解析卷）.docx`
- **源答案 = D　LLM 答案 = C** ❌

题干：对下列句子中加点的词的解释，不正确的一项是（   ）

- A. 不敢一毫越理犯分        分：本分遗善为闾里传                 为焦仲卿母所遣
- B. 谲佞残妒，塞于胸间      谲：诡诈
- C. 使得时则以势劫之矣      劫：劫持
- D. 期为君子之归            期：希望⟦IMG:rId14⟧6．下列各组句子中，加点的词的意义和用法不相同的一组是（  ）B．其惧人之拒我也               夫人之相与，俯仰一世C．妄以言议人，则几于小

---

### 2020 年 · geography · national · 第 7 题

- 来源卷：`2020年高考地理试卷（新课标Ⅲ）（解析卷）.docx`
- **源答案 = D　LLM 答案 = C** ❌

题干：①②③④中最先形成的是（  ）

- A. ①
- B. ②
- C. ③
- D. ④

---


## 五、结论与建议

- 实测准确率 **83.3%**（对照 30 题小样本的 83.3%）。
- 所有 LLM 答案标 `answer_status=LLM_PROPOSED`，**不计入经核验口径**。
- 整类回滚：`UPDATE exam_questions SET answer=NULL, answer_source=NULL, answer_status='MISSING_SOURCE' WHERE answer_source='llm_websearch';`
- 已排除非官方原文卷（回忆版/网友版/估分/预测）。
