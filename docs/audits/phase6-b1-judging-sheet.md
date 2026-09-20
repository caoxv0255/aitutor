# B1 试点 102 题判读报告（待人工核验）

**日期**: 2026-09-14  
**run_label**: plan_b_v1  
**结果文件**: `database/b1_results_all.jsonl` (102 行)

## 总体统计

| 指标 | 值 |
|---|---|
| 题目数 | 102 |
| JSON 解析成功 | 99 (97.1%) |
| 解析失败 (宽松正则兜底) | 2 |
| 完全失败 | 1 |
| 总 token | 148,975 |
| 总成本 | ¥0.1192 |
| 平均成本 | ¥0.0012/题 |
| no_match=true 题数 | 14 |
| 总 picks 数 | 225 (平均 2.21/题) |

## 9 学科分布

| 学科 | 题数 | 占比 |
|---|---|---|
| chinese | 12 | 11.8% |
| math | 12 | 11.8% |
| english | 12 | 11.8% |
| physics | 11 | 10.8% |
| chemistry | 11 | 10.8% |
| biology | 11 | 10.8% |
| history | 11 | 10.8% |
| geography | 11 | 10.8% |
| politics | 11 | 10.8% |

## 102 题明细 (待人工判读)

> 判读口径: ✅正确 / ⚠️部分 (含父级概念, 如选"力学"但题考"牛顿第二定律") / ❌错误 / 🚫no_match

| # | 学科 | uid | 题干(40字) | LLM picks | 现有归因 | 待判读 |
|---|---|---|---|---|---|---|
| 1 | chinese | chinese_2025_fujian_023 | 阅读下面的材料，根据要求写作。（60 分） 他想要给孩子们唱上一段，可是心里直翻 | (空) | (none) [] |  |
| 2 | chinese | chinese_2025_hebei_007 | 关于文本一中方宝庆这个人物，下列说法不正确的一项是（3分） （ ） | (空) | (none) [] |  |
| 3 | chinese | chinese_2022_new_gaokao_i_018 | 请在文中横线处填入恰当的成语。 | (空) | (none) [] |  |
| 4 | chinese | chinese_2025_new_gaokao_ii_021 | 文中有多处错别字，请找出两处含错别字的词语并改正。 | (空) | (none) [] |  |
| 5 | chinese | chinese_2025_shandong_013 | 把材料中画横线的句子翻译成现代汉语。（8分） （1）今鲁君老悖，太子少愚，愚伪日 | (空) | (none) [] |  |
| 6 | chinese | chinese_2025_shandong_003 | ①地势比平地稍高   ②泥土与根系相和洽  ③不利于植株的呼吸 4．根据上下文， | (空) | (none) [] |  |
| 7 | chinese | chinese_2019_shanghai_002 | 按要求选择。（5 分) (1）小王遇到挫折，一蹶不振，朋友用一句话激励他，以下合 | CHI_A_0001 | (none) [] |  |
| 8 | chinese | chinese_2025_hubei_007 | 关于文本一中方宝庆这个人物，下列说法不正确的一项是（3分） （ ） | (空) | (none) [] |  |
| 9 | chinese | chinese_2023_beijing_7 | 下列各组语句中，加点词的意义和用法都相同的一组是 | (空) | (none) [] |  |
| 10 | chinese | chinese_2023_beijing_18 | 文章第四段写古镇的榕树，请指出该段包含哪些比喻，并分析它们各自的用意。 | (空) | (none) [] |  |
| 11 | chinese | chinese_2025_jiangsu_001 | 下列对原文相关内容的理解和分析，正确的一项是（3分）(   ) | (空) | (none) [] |  |
| 12 | chinese | chinese_2025_beijing_016 | 下列对文中加点词语的解说，不正确的一项是（   ） | CHI_H_0006 | (none) [] |  |
| 13 | math | math_2024_tianjin_007 | 已知函数的最小正周期为．则函数在的最小值是（   ） | MAT_C_0045 / MAT_C_0030 / MAT_H_0013 | (none) [] |  |
| 14 | math | math_2018_beijing_zk_013 | 如图，在矩形中，是边的中点，连接交对角线于点，若，，则的长为________． | MAT_C_0008 / MAT_H_0007 / MAT_H_0006 | (none) [] |  |
| 15 | math | math_2018_shanghai_005 | 已知是等差数列，若，则____________ | MAT_C_0001 | (none) [] |  |
| 16 | math | math_2025_shandong_014 | 若一个正项等比数列的前4项和为4，前8项和为68，则该等比数列的公比为_____ | MAT_C_0003 / MAT_C_0076 | (none) [] |  |
| 17 | math | math_2010_zhejiang_007 | （2010•浙江）若实数x，y满足不等式组合则x+y的最大值为（　　） | MAT_C_0108 / MAT_C_0124 | (none) [] |  |
| 18 | math | math_2024_shanghai_003 | 已知则不等式的解集为______． | MAT_C_0017 / MAT_C_0124 | (none) [] |  |
| 19 | math | math_2025_anhui_001 | 样本数据2，8，14，16，20的平均数为（   ） | MAT_H_0010 | (none) [] |  |
| 20 | math | math_2025_hunan_012 | 已知的面积为，若，则（   ） 三、填空题：本大题共3小题，每小题5分，共计15 | MAT_C_0008 / MAT_H_0002 / MAT_H_0013 /  | (none) [] |  |
| 21 | math | math_2010_zhejiang_010 | （2010•浙江）设O为坐标原点，F1，F2是双曲线﹣=1（a＞0，b＞0）的焦 | MAT_C_0053 / MAT_C_0051 / MAT_C_0054 | (none) [] |  |
| 22 | math | math_2017_shanghai_008 | 已知数列的通项公式为，则        ； | (空) | (none) [] |  |
| 23 | math | math_2021_national_b_013 | 已知双曲线的一条渐近线为，则C的焦距为_________． | MAT_C_0053 / MAT_C_0054 / MAT_C_0052 | (none) [] |  |
| 24 | math | math_2023_beijing_6 | 已知函数 ( ) sin( ) f x x w j = + 在区间 π 2π , | MAT_H_0013 / MAT_C_0002 / MAT_C_0006 | (none) [] |  |
| 25 | english | english_2019_beijing_zk_004 | — Lily, _____ you finish the letter in t | ENG_A_0010 / ENG_A_0014 | (none) [] |  |
| 26 | english | english_2024_zhejiang_046 | 请你写一篇短文向校英文报“Sports and Health”栏目投稿，向同学们 | ENG_A_0004 / ENG_A_0014 / ENG_U_0007 | (none) [] |  |
| 27 | english | english_2024_zhejiang_010 | Why does Dr. Doswell mention the tornado | ENG_A_0019 / ENG_A_0020 / ENG_A_0025 | (none) [] |  |
| 28 | english | english_2012_shaanxi_045 | A. pain         	    B. shock      	     | (空) | (none) [] |  |
| 29 | english | english_2025_anhui_046 | 假定你是校英文报编辑李华，外教Chris上个月答应写一篇介绍加拿大体育运动的文章 | ENG_A_0004 / ENG_A_0014 / ENG_A_0009 | (none) [] |  |
| 30 | english | english_2013_shaanxi_051 | Which of the following did Gordon do acc | ENG_A_0002 / ENG_A_0005 | (none) [] |  |
| 31 | english | english_2025_zhejiang_049 | A. replaces	B. tastes	C. orders	D. pairs | ENG_A_0019 / ENG_A_0011 | (none) [] |  |
| 32 | english | english_2025_zhejiang_066 | 你将参加英语课上的“一分钟演讲”活动。请你针对部分同学在校园内用手机拍摄短视频的 | ENG_A_0004 / ENG_A_0009 / ENG_A_0014 | (none) [] |  |
| 33 | english | english_2021_beijing_005 | Recent research suggests that if an argu | ENG_U_0013 / ENG_U_0007 | (none) [] |  |
| 34 | english | english_2024_tianjin_048 | A. when	B. why	C. where	D. how | ENG_A_0002 / ENG_A_0011 / ENG_A_0019 | (none) [] |  |
| 35 | english | english_2016_sichuan_057 | A.more clearly       B.longer      C. lo | ENG_U_0013 | (none) [] |  |
| 36 | english | english_2025_anhui_032 | A. accepted	B. shared	C. expected	D. cel | ENG_A_0019 / ENG_A_0011 / ENG_U_0027 | (none) [] |  |
| 37 | physics | physics_2024_chongqing_015 | 如图所示，M、N两个钉子固定于相距a的两点，M的正下方有不可伸长的轻质细绳，一端 | PHY_C_0164 / PHY_C_0002 / PHY_C_0007 | (none) [] |  |
| 38 | physics | physics_2024_hebei_010 | 如图，真空区域有同心正方形ABCD和abcd，其各对应边平行，ABCD的边长一定 | PHY_C_0183 / PHY_H_0009 / PHY_H_0007 /  | (none) [] |  |
| 39 | physics | physics_2024_guangxi_012 | 某同学为探究电容器充、放电过程，设计了图甲实验电路。器材如下：电容器，电源E（电 | PHY_C_0150 / PHY_C_0149 / PHY_H_0017 | (none) [] |  |
| 40 | physics | physics_2024_anhui_011 | 某实验小组做“测量玻璃的折射率”及拓展探究实验． （1）为测量玻璃的折射率，按如 | PHY_C_0035 / PHY_C_0021 / PHY_C_0001 | (none) [] |  |
| 41 | physics | physics_2024_chongqing_004 | 活检针可用于活体组织取样，如图所示。取样时，活检针的针蕊和针鞘被瞬间弹出后仅受阻 | PHY_H_0001 / PHY_C_0004 / PHY_H_0010 | (none) [] |  |
| 42 | physics | physics_2018_beijing_zk_016 | 如图所示，盛有水杯子静止在水平桌面上．杯子重1N，高9cm，底面积30cm2；杯 | PHY_H_0011 / PHY_H_0019 / PHY_H_0008 | (none) [] |  |
| 43 | physics | physics_2024_fujian_016 | 如图，木板A放置在光滑水平桌面上，通过两根相同的水平轻弹簧M、N与桌面上的两个固 | PHY_C_0091 / PHY_C_0018 / PHY_H_0005 | (none) [] |  |
| 44 | physics | physics_2018_beijing_zk_024 | （1）如图1所示，体温计的示数为_______℃． （2）如图2所示，弹簧到力计 | (空) | (none) [] |  |
| 45 | physics | physics_2021_zhejiang_011 | 一辆汽车在水平高速公路上以80km/h的速度匀速行驶，其1s内能量分配情况如图所 | PHY_H_0012 / PHY_C_0004 | (none) [] |  |
| 46 | physics | physics_2024_jiangxi_016 | 如图（a）所示，轨道左侧斜面倾斜角满足sinθ1 = 0.6，摩擦因数，足够长的 | PHY_C_0003 / PHY_C_0137 / PHY_H_0018 | (none) [] |  |
| 47 | physics | physics_2024_beijing_6 | 如图所示，线圈M和线圈P绕在同一个铁芯上，下列说法正确的是（   ） | PHY_C_0119 / PHY_C_0118 / PHY_H_0007 | (none) [] |  |
| 48 | chemistry | chemistry_2025_shandong_017 | 单质及其化合物应用广泛。回答下列问题： （1）在元素周期表中， 位于第_____ | CHE_C_0005 / CHE_C_0082 / CHE_C_0080 | (none) [] |  |
| 49 | chemistry | chemistry_2024_guangdong_012 | 一种可为运动员补充能量的物质，其分子结构式如图。已知R、W、Z、X、Y为原子序数 | CHE_C_0146 / CHE_C_0163 / CHE_H_0008 /  | (none) [] |  |
| 50 | chemistry | chemistry_2024_guangdong_015 | 对反应(I为中间产物)，相同条件下：①加入催化剂，反应达到平衡所需时间大幅缩短； | CHE_H_0017 / CHE_C_0164 | (none) [] |  |
| 51 | chemistry | chemistry_2021_beijing_zk_017 | 远古时期火法炼铜的原料是孔雀石【主要成分为Cu2（OH）2CO3】，组成Cu2（ | CHE_H_0026 | (none) [] |  |
| 52 | chemistry | chemistry_2024_chongqing_018 | 高辛烷值的汽油可提升发动机的抗爆震性能，异构烷烃具有较高的辛烷值。 （1）在密闭 | CHE_C_0149 / CHE_C_0066 / CHE_H_0017 | (none) [] |  |
| 53 | chemistry | chemistry_2025_hebei_003 | 高分子材料在生产、生活中得到广泛应用。下列说法错误的是 | CHE_H_0042 / CHE_C_0169 / CHE_C_0170 | (none) [] |  |
| 54 | chemistry | chemistry_2024_hainan_010 | 根据下列实验及现象，所得结论错误的是 选项 实验及现象 结论 A 将通入溴水至过 | CHE_C_0057 / CHE_C_0027 / CHE_H_0021 | (none) [] |  |
| 55 | chemistry | chemistry_2025_beijing_19 | 化学反应平衡常数对认识化学反应的方向和限度具有指导意义。实验小组研究测定“”平衡 | CHE_C_0149 / CHE_C_0066 / CHE_H_0007 | (none) [] |  |
| 56 | chemistry | chemistry_2024_jiangxi_005 | 某新材料阳离子为W36X18Y2Z6M+。W、X、Y、Z和M是原子序数依次增大的 | CHE_H_0008 / CHE_H_0020 | (none) [] |  |
| 57 | chemistry | chemistry_2024_zhejiang_009 | 关于有机物检测，下列说法正确的是 | CHE_H_0004 / CHE_H_0029 / CHE_H_0003 | (none) [] |  |
| 58 | chemistry | chemistry_2024_beijing_019 | 利用黄铜矿(主要成分为，含有等杂质)生产纯铜，流程示意图如下。（1）矿石在焙烧前 | CHE_C_0043 / CHE_C_0067 / CHE_H_0019 | (none) [] |  |
| 59 | biology | biology_2024_tianjin_006 | 环境因素可通过下图所示途径影响生物性状。有关叙述错误的是（    ） | BIO_H_0007 / BIO_C_0006 / BIO_C_0008 | (none) [] |  |
| 60 | biology | biology_2024_beijing_12 | 五彩缤纷月季装点着美丽的京城，其中变色月季“光谱”备受青睐。“光谱”月季变色的主 | BIO_C_0066 / BIO_C_0024 / BIO_C_0008 | (none) [] |  |
| 61 | biology | biology_2024_zhejiang_008 | 某快递小哥跳入冰冷刺骨的河水勇救落水者时，体内会发生系列变化。下列叙述正确的是（ | BIO_H_0001 / BIO_H_0017 | (none) [] |  |
| 62 | biology | biology_2019_shanghai_022 | （2分）湿垃圾被降解后才能被植物利用，是因为根毛细胞难以吸收__________ | BIO_H_0006 / BIO_H_0004 | (none) [] |  |
| 63 | biology | biology_2024_jiangxi_019 | 福寿螺是一种外来入侵物种，因其食性广泛、繁殖力强，给输入地的生态系统造成不利影响 | BIO_C_0048 / BIO_H_0003 / BIO_C_0007 | (none) [] |  |
| 64 | biology | biology_2015_guangdong_008 | 由苯丙氨酸羟化酶基因突变引起的苯丙酮尿症是常染色体隐性遗传病，我国部分地市对新生 | BIO_H_0015 / BIO_H_0010 | (none) [] |  |
| 65 | biology | biology_2024_hainan_013 | 某种鸟的卵黄蛋白原基因的启动子部分区域存在甲基化修饰。成熟雌鸟产生的雌激素可将此 | BIO_C_0009 / BIO_C_0005 / BIO_H_0019 /  | (none) [] |  |
| 66 | biology | biology_2024_fujian_020 | 脂肪酸和甘油合成脂肪存储于脂滴中。糖类代谢异常时，脂肪可分解为脂肪酸为机体供能。 | BIO_H_0002 / BIO_C_0044 / BIO_H_0014 | (none) [] |  |
| 67 | biology | biology_2009_zhejiang_002 | （18分）正常小鼠体内常染色体上的B基因编码胱硫醚γ—裂解酶（G酶），体液中的H | BIO_H_0019 / BIO_H_0010 / BIO_C_0041 | (none) [] |  |
| 68 | biology | biology_2021_shanghai_040 | （4分）在Ⅱ中，培养基上发出绿色荧光的受体细胞中，一定含有的基因是     （填 | BIO_C_0002 / BIO_H_0018 / BIO_H_0015 | (none) [] |  |
| 69 | biology | biology_2024_guangdong_004 | 原因：群落中物种之间以及生物与环境间协同进化的结果。 | BIO_H_0003 / BIO_H_0008 / BIO_C_0007 | (none) [] |  |
| 70 | history | history_2024_hainan_004 | 隋末起义的领导者成分复杂，大致可分为乡民，贵胄大族、豪族官吏三类,起自民间者不占 | HIS_H_0001 | (none) [] |  |
| 71 | history | history_2024_jiangsu_007 | 1924年2月，周恩来等人决定，将旅欧共产主义青年团在巴黎创办的机关刊物改名为《 | HIS_H_0004 / HIS_H_0006 / HIS_H_0020 | (none) [] |  |
| 72 | history | history_2025_sichuan_014 | 1838 年，英国利物浦港卸载的美棉占进口总量的五分之四。1850 年后，英国  | HIS_H_0014 | (none) [] |  |
| 73 | history | history_2024_jiangxi_019 | 阅读材料，完成下列要求。 材料一：17世纪中期，荷兰海上势力扩展至全球，被称为“ | HIS_H_0014 / HIS_H_0008 | (none) [] |  |
| 74 | history | history_2024_jiangsu_013 | 近代非洲文学以使用欧洲语言创作为主流。19世纪末，埃塞俄比亚政府鼓励作家使用阿姆 | HIS_C_0172 / HIS_C_0002 / HIS_C_0003 | (none) [] |  |
| 75 | history | history_2025_sichuan_009 | 1936 年，毛泽东代表中国共产党致电美国黑人运动组织指出，“你们远在非洲的兄弟 | HIS_H_0004 / HIS_H_0020 / HIS_H_0012 | (none) [] |  |
| 76 | history | history_2021_beijing_13 | 1829-1841��䣬����ʫ�������з�����һϵ�й���181 | HIS_H_0006 / HIS_H_0008 | (none) [] |  |
| 77 | history | history_2021_beijing_12 | 18���ͣ�Ӣ���ط���ѧ���Ŵ������֣��¹����ǵ��ʹ�� | HIS_H_0009 / HIS_C_0005 / HIS_C_0003 | (none) [] |  |
| 78 | history | history_2024_beijing_020 | 端午故事材料一  端午节由来已久，其起源有纪念屈原、吴越民族图腾祭、恶月恶日避毒 | HIS_C_0039 / HIS_C_0165 / HIS_C_0002 | (none) [] |  |
| 79 | history | history_2024_national_a_009 | 在14世纪之前，人们把时间寄托给上帝，时间是“走向永恒过渡”。而在文艺复兴时代， | HIS_C_0099 / HIS_H_0005 | (none) [] |  |
| 80 | history | history_2009_sichuan_008 | 图6是某博物馆藏民国时期四川一女子小学发给学生的毕业纪念品——木兰彩瓷笔筒。从图 | HIS_H_0004 / HIS_C_0158 / HIS_H_0020 | (none) [] |  |
| 81 | geography | geography_2024_anhui_019 | 阅读图文材料，完成下列要求。 南美洲的卡西基亚雷河（以下简称“卡河”）是奥里诺科 | GEO_H_0006 / GEO_H_0009 / GEO_H_0021 | (none) [] |  |
| 82 | geography | geography_2024_chongqing_017 | 阅读图文材料，完成下列问题。 厦门岛位于厦门市中心城区，用地紧张。观音山沙滩位于 | GEO_H_0009 / GEO_H_0008 / GEO_H_0028 | (none) [] |  |
| 83 | geography | geography_2024_chongqing_013 | 根据城市轨道交通出行分担率的特征，推测冬季影响莫斯科地面交通的主要气候因素是（  | GEO_H_0011 / GEO_H_0005 | (none) [] |  |
| 84 | geography | geography_2024_hainan_008 | 中国海警执法船在元旦期间从永暑礁出发到曾母暗沙执行公务。下列叙述正确的是（    | GEO_H_0020 / GEO_H_0028 / GEO_C_0001 | (none) [] |  |
| 85 | geography | geography_2023_chongqing_007 | 为促进筑地场外市场与丰洲市场协作， 需要采取的举措是（   ） 美国夏威夷地区瓦 | (空) | (none) [] |  |
| 86 | geography | geography_2024_national_a_001 | 中新合作区的工业区对商业区形成强力支撑的原因是工业区带动了（    ） ①人口集 | GEO_C_0033 / GEO_C_0012 / GEO_C_0135 | (none) [] |  |
| 87 | geography | geography_2024_anhui_012 | 浮标获取的数据显示，在200～500m深度，甲海区海水年均盐度高于乙海区，主要原 | GEO_H_0007 | (none) [] |  |
| 88 | geography | geography_2024_tianjin_008 | 上图所示时段，该市最有可能经历的天气过程是（   ） A 疾风骤雨气压升高	B. | GEO_H_0005 / GEO_H_0011 | (none) [] |  |
| 89 | geography | geography_2024_tianjin_009 | 官洲岛吸引大批海外知名医药企业研发机构入驻的有利条件有（   ） ①医药研发原料 | GEO_H_0020 / GEO_H_0024 / GEO_C_0001 | (none) [] |  |
| 90 | geography | geography_2018_beijing_zk_001 | 文中表现的聚落类型及判断理由是 | GEO_H_0017 | (none) [] |  |
| 91 | geography | geography_2023_beijing_16 | 某校中学生赴蛇鱼川流域进行野外研学。左图为该流域示意图，右图为某同学撰写考察报告 | GEO_C_0095 / GEO_H_0022 / GEO_H_0025 | (none) [] |  |
| 92 | politics | politics_2024_shandong_004 | 山东某市运用数字化技术打造新型智慧医疗服务体系。激活医疗数据资源，建立基于健康管 | POL_C_0150 | (none) [] |  |
| 93 | politics | politics_2025_guangdong_004 | 针对产品同质化、市场供需失衡、产品价格走低、行业平均利润率持续下滑等现象，某行业 | POL_H_0002 / POL_C_0001 | (none) [] |  |
| 94 | politics | politics_2022_national_b_004 | 2022年，我国财政赤字率(财政赤字/GDP)拟按2.8%左右安排，比2021年 | POL_C_0015 | (none) [] |  |
| 95 | politics | politics_2024_guangdong_019 | 阅读材料，完成下列要求。 高二某学习小组就“聚焦中国故事，探究中国智慧”主题整理 | POL_H_0004 / POL_H_0008 / POL_C_0006 | (none) [] |  |
| 96 | politics | politics_2024_fujian_009 | 2023年全国演出市场总体经济规模达739.94亿元，创历史新高。大型演出热度不 | POL_C_0079 / POL_C_0073 / POL_C_0083 | (none) [] |  |
| 97 | politics | politics_2024_jiangsu_015 | 《中华人民共和国民法典》规定：“一方利用对方处于危困状态缺乏判断能力等情形，致使 | POL_C_0010 / POL_H_0007 / POL_H_0020 | (none) [] |  |
| 98 | politics | politics_2021_beijing_11 | “职业培训券1000万张在路上！”职业培训券是人力资源和社会保障部门对符合条件的 | POL_C_0150 / POL_C_0029 / POL_C_0037 | (none) [] |  |
| 99 | politics | politics_2024_tianjin_007 | 在当今动荡变革的世界中，中国同欧盟之间的全面战略伙伴关系一直保持稳定。中国坚持中 | POL_H_0008 / POL_H_0011 / POL_C_0006 | (none) [] |  |
| 100 | politics | politics_2024_guangxi_006 | 广西民族文化多元且繁荣，壮族的歌、瑶族的舞、苗族的节、京族的琴、汉族的戏等汇集于 | POL_C_0090 / POL_H_0004 / POL_C_0053 | (none) [] |  |
| 101 | politics | politics_2024_tianjin_003 | 没有哪个政党能像中国共产党这样，敢于大刀阔斧、刀刃向内，以巨大的政治勇气全面深化 | POL_C_0054 / POL_C_0023 / POL_H_0024 | (none) [] |  |
| 102 | politics | politics_2024_chongqing_005 | 习近平强调，在五千多年中华文明深厚基础上开辟和发展中国特色社会主义，把马克思主义 | POL_C_0026 / POL_C_0123 / POL_H_0004 | (none) [] |  |
