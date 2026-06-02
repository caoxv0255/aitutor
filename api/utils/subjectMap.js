export const SUBJECT_MAP = {
  'math': '数学',
  'chinese': '语文',
  'english': '英语',
  'physics': '物理',
  'chemistry': '化学',
  'politics': '政治',
  'biology': '生物',
  'history': '历史',
  'geography': '地理'
};

export const SUBJECT_MAP_REVERSE = Object.fromEntries(
  Object.entries(SUBJECT_MAP).map(([k, v]) => [v, k])
);

export function resolveSubjectName(subject) {
  return SUBJECT_MAP[subject] || subject;
}

export function resolveSubjectKey(subject) {
  return SUBJECT_MAP_REVERSE[subject] || subject;
}

export const KEYWORD_MAP = {
  'MATH-001': ['函数', '导数', '单调性', '极值', '切线', '零点', '切线斜率', '极限'],
  'MATH-002': ['解析几何', '椭圆', '双曲线', '抛物线', '圆锥曲线', '韦达', '直线与曲线'],
  'MATH-003': ['数列', '等差', '等比', '递推', '求和', '数学归纳法'],
  'MATH-004': ['概率', '统计', '二项分布', '正态分布', '古典概型', '随机变量'],
  'MATH-005': ['立体几何', '空间向量', '三视图', '体积', '线面', '面面'],
  'MATH-006': ['集合', '充分条件', '必要条件', '命题', '交并补'],
  'MATH-007': ['向量', '平面向量', '数量积', '夹角', '共线', '垂直'],
  'MATH-008': ['复数', '复数模', '共轭'],
  'MATH-009': ['三角函数', '诱导公式', '解三角形', '正弦定理', '余弦定理'],
  'MATH-010': ['不等式', '基本不等式', '线性规划', '绝对值'],
  'MATH-011': ['排列组合', '二项式', '排列', '组合', '通项'],
  'MATH-012': ['程序框图', '算法', '流程图'],
  'MATH-013': ['极坐标', '参数方程'],
  'MATH-014': ['函数图像', '对称', '平移', '伸缩变换'],
  'MATH-015': ['分段函数', '绝对值函数'],
  'MATH-016': ['指数函数', '对数函数', '幂函数'],
  'MATH-017': ['二次函数', '顶点', '对称轴', '判别式'],
  'MATH-018': ['导数应用', '最值', '优化问题', '恒成立'],
  'MATH-019': ['定积分', '微积分基本定理', '曲边梯形'],
  'MATH-020': ['直线方程', '斜率', '截距', '点到直线距离'],
  'MATH-021': ['圆的方程', '圆心', '半径', '切线方程'],
  'MATH-022': ['条件概率', '独立事件', '全概率公式', '贝叶斯'],
  'MATH-023': ['回归分析', '相关系数', '散点图', '最小二乘法'],
  'MATH-024': ['独立性检验', '卡方', '列联表'],
  'MATH-025': ['空间直角坐标系', '空间距离', '空间角'],
  'MATH-026': ['二倍角', '半角', '和差化积', '积化和差'],
  'MATH-027': ['反证法', '数学归纳', '放缩法'],
  'MATH-028': ['离散型随机变量', '期望', '方差'],
  'MATH-029': ['逻辑联结词', '全称量词', '存在量词'],
  'MATH-030': ['线性回归', '正态曲线'],

  'CHINESE-001': ['现代文', '阅读', '散文', '小说', '文本分析'],
  'CHINESE-002': ['文言文', '翻译', '实词', '虚词', '断句'],
  'CHINESE-003': ['古诗', '鉴赏', '意象', '手法', '情感'],
  'CHINESE-004': ['作文', '审题', '立意', '议论文', '记叙文'],
  'CHINESE-005': ['语言文字', '成语', '病句', '语序'],
  'CHINESE-006': ['默写', '背诵', '古诗文'],
  'CHINESE-007': ['实用类文本', '新闻', '传记', '科普'],
  'CHINESE-008': ['论述类文本', '论证', '论点', '论据', '逻辑推断'],
  'CHINESE-009': ['文学类文本', '人物形象', '环境描写', '主题'],
  'CHINESE-010': ['文言实词', '一词多义', '古今异义', '词类活用'],
  'CHINESE-011': ['文言虚词', '之乎者也', '而', '以', '于'],
  'CHINESE-012': ['文言句式', '判断句', '被动句', '倒装句', '省略句'],
  'CHINESE-013': ['诗歌表达技巧', '比喻', '拟人', '借代', '对比', '衬托'],
  'CHINESE-014': ['诗歌思想感情', '思乡', '怀古', '边塞', '山水'],
  'CHINESE-015': ['材料作文', '任务驱动', '情境作文', '演讲稿'],
  'CHINESE-016': ['标点符号', '冒号', '分号', '破折号', '省略号'],
  'CHINESE-017': ['词语运用', '近义词', '语境', '搭配'],
  'CHINESE-018': ['压缩语段', '扩展语句', '仿写'],
  'CHINESE-019': ['图文转换', '表格', '徽标', '漫画'],
  'CHINESE-020': ['名篇名句', '高考必背', '古文默写'],

  'ENGLISH-001': ['阅读', '阅读理解', '细节', '主旨', '推理'],
  'ENGLISH-002': ['完形填空', '完形', '语境'],
  'ENGLISH-003': ['语法填空', '语法', '时态', '语态', '非谓语'],
  'ENGLISH-004': ['写作', '作文', '书信', '应用文', '续写'],
  'ENGLISH-005': ['听力', '听音'],
  'ENGLISH-006': ['七选五', '七选五阅读', '逻辑'],
  'ENGLISH-007': ['短文改错', '改错'],
  'ENGLISH-008': ['定语从句', '关系代词', '关系副词', '限制性'],
  'ENGLISH-009': ['名词性从句', '主语从句', '宾语从句', '表语从句'],
  'ENGLISH-010': ['状语从句', '时间', '条件', '原因', '让步'],
  'ENGLISH-011': ['虚拟语气', 'if条件句', 'wish', 'suggest'],
  'ENGLISH-012': ['非谓语动词', '动名词', '分词', '不定式'],
  'ENGLISH-013': ['时态', '现在完成时', '过去进行时', '将来完成时'],
  'ENGLISH-014': ['被动语态', 'be done', 'get done'],
  'ENGLISH-015': ['倒装句', '部分倒装', '完全倒装', 'only'],
  'ENGLISH-016': ['强调句', 'it is...that', 'do强调'],
  'ENGLISH-017': ['读后续写', '续写', '情节', '情感描写'],
  'ENGLISH-018': ['概要写作', 'summary', '主旨概括'],
  'ENGLISH-019': ['词汇辨析', '近义词', '形近词', '搭配'],
  'ENGLISH-020': ['主谓一致', '代词一致', '平行结构'],

  'PHYSICS-001': ['力学', '牛顿', '运动', '摩擦', '受力'],
  'PHYSICS-002': ['电磁学', '电场', '磁场', '电磁感应', '安培力', '洛伦兹力'],
  'PHYSICS-003': ['能量', '动量', '动能', '机械能', '碰撞'],
  'PHYSICS-004': ['近代物理', '光电效应', '原子', '核反应'],
  'PHYSICS-005': ['机械振动', '机械波', '振动', '波动', '干涉', '衍射'],
  'PHYSICS-006': ['热学', '分子动理论', '内能', '热力学'],
  'PHYSICS-007': ['天体', '万有引力', '卫星', '开普勒'],
  'PHYSICS-008': ['电学实验', '伏安法', '电阻'],
  'PHYSICS-009': ['交变电流', '变压器', '远距离输电'],
  'PHYSICS-010': ['匀变速直线运动', '加速度', '位移', '速度'],
  'PHYSICS-011': ['自由落体', '竖直上抛', '抛体运动'],
  'PHYSICS-012': ['牛顿第二定律', 'F=ma', '超重', '失重'],
  'PHYSICS-013': ['圆周运动', '向心力', '向心加速度', '角速度'],
  'PHYSICS-014': ['平抛运动', '斜抛', '运动合成与分解'],
  'PHYSICS-015': ['库仑定律', '电场强度', '电势', '电势能'],
  'PHYSICS-016': ['电容', '电容器', '平行板', '充放电'],
  'PHYSICS-017': ['闭合电路', '欧姆定律', '电动势', '内阻'],
  'PHYSICS-018': ['法拉第电磁感应', '楞次定律', '感应电动势', '磁通量'],
  'PHYSICS-019': ['动量守恒', '冲量', '反冲', '爆炸'],
  'PHYSICS-020': ['玻尔模型', '能级', '跃迁', '光谱'],
  'PHYSICS-021': ['光学', '折射', '全反射', '干涉', '衍射光栅'],
  'PHYSICS-022': ['力学实验', '验证牛顿', '验证动量', '单摆'],
  'PHYSICS-023': ['传感器', '霍尔效应', '压电效应'],

  'CHEMISTRY-001': ['化学平衡', '反应速率', '勒夏特列', '平衡常数'],
  'CHEMISTRY-002': ['氧化还原', '原电池', '电解池', '电子转移'],
  'CHEMISTRY-003': ['有机化学', '烃', '醇', '醛', '酸', '酯', '高分子'],
  'CHEMISTRY-004': ['物质结构', '元素周期', '电子排布', '化学键', '晶体'],
  'CHEMISTRY-005': ['离子反应', '离子方程式', '离子共存', '电解质'],
  'CHEMISTRY-006': ['化学实验', '气体制备', '物质检验', '实验设计'],
  'CHEMISTRY-007': ['水溶液', '电离', '水解', '沉淀', 'pH'],
  'CHEMISTRY-008': ['元素', '金属', '非金属', '氧化物'],
  'CHEMISTRY-009': ['化学计算', '物质的量', '摩尔'],
  'CHEMISTRY-010': ['钠及其化合物', 'Na', 'NaOH', 'Na2CO3', 'NaHCO3'],
  'CHEMISTRY-011': ['铝及其化合物', 'Al', 'Al2O3', 'Al(OH)3', '两性'],
  'CHEMISTRY-012': ['铁及其化合物', 'Fe', 'Fe2O3', 'Fe3+', 'Fe2+'],
  'CHEMISTRY-013': ['铜及其化合物', 'Cu', 'CuSO4', '铜绿'],
  'CHEMISTRY-014': ['卤素', '氯', 'Cl2', 'HCl', '漂白'],
  'CHEMISTRY-015': ['硫及其化合物', 'S', 'SO2', 'H2SO4', '硫酸'],
  'CHEMISTRY-016': ['氮及其化合物', 'N2', 'NH3', 'NO', 'HNO3'],
  'CHEMISTRY-017': ['硅及其化合物', 'Si', 'SiO2', '硅酸盐'],
  'CHEMISTRY-018': ['烷烃', '烯烃', '炔烃', '加成', '取代'],
  'CHEMISTRY-019': ['苯', '芳香烃', '硝化', '磺化'],
  'CHEMISTRY-020': ['卤代烃', '醇', '酚', '消去反应'],
  'CHEMISTRY-021': ['醛', '酮', '羧酸', '酯化反应', '缩聚'],
  'CHEMISTRY-022': ['糖类', '油脂', '蛋白质', '氨基酸'],
  'CHEMISTRY-023': ['化学键', '共价键', '离子键', '金属键', '配位键'],
  'CHEMISTRY-024': ['分子间作用力', '氢键', '范德华力'],
  'CHEMISTRY-025': ['盖斯定律', '反应热', '焓变', '熵变'],

  'POLITICS-001': ['经济生活', '货币', '价格', '消费', '生产', '企业'],
  'POLITICS-002': ['政治生活', '公民', '政府', '人大'],
  'POLITICS-003': ['文化生活', '文化', '中华文化', '文化创新'],
  'POLITICS-004': ['哲学', '唯物论', '认识论', '辩证法', '历史唯物主义'],
  'POLITICS-005': ['法律', '民法典', '劳动法', '合同'],
  'POLITICS-006': ['时事', '时事政治', '热点'],
  'POLITICS-007': ['逻辑思维', '创新思维', '推理'],
  'POLITICS-008': ['价值规律', '供求', '市场调节', '宏观调控'],
  'POLITICS-009': ['财政', '税收', '国债', '货币政策'],
  'POLITICS-010': ['社会主义市场经济', '公有制', '非公有制', '分配制度'],
  'POLITICS-011': ['对外开放', '贸易', '一带一路', '经济全球化'],
  'POLITICS-012': ['人民代表大会', '人大代表', '立法权', '监督权'],
  'POLITICS-013': ['政党制度', '中国共产党', '多党合作', '政协'],
  'POLITICS-014': ['民族区域自治', '宗教政策', '主权'],
  'POLITICS-015': ['国际关系', '联合国', '和平发展', '外交政策'],
  'POLITICS-016': ['文化传承', '传统文化', '文化自信', '文化交融'],
  'POLITICS-017': ['唯物辩证法', '联系', '发展', '矛盾', '量变质变'],
  'POLITICS-018': ['认识论', '实践', '真理', '认识过程'],
  'POLITICS-019': ['社会历史观', '社会存在', '社会意识', '人民群众'],
  'POLITICS-020': ['人生价值观', '价值判断', '价值选择', '奉献'],

  'BIOLOGY-001': ['细胞', '细胞膜', '细胞器', '细胞核', '原核', '真核'],
  'BIOLOGY-002': ['细胞代谢', '酶', 'ATP', '呼吸作用', '光合作用'],
  'BIOLOGY-003': ['细胞生命历程', '有丝分裂', '减数分裂', '凋亡', '衰老'],
  'BIOLOGY-004': ['遗传分子基础', 'DNA', 'RNA', '复制', '转录', '翻译'],
  'BIOLOGY-005': ['遗传规律', '孟德尔', '分离定律', '自由组合', '伴性遗传'],
  'BIOLOGY-006': ['变异', '基因突变', '基因重组', '染色体变异'],
  'BIOLOGY-007': ['进化', '自然选择', '种群', '基因频率', '物种形成'],
  'BIOLOGY-008': ['植物激素', '生长素', '赤霉素', '乙烯', '脱落酸'],
  'BIOLOGY-009': ['神经调节', '反射', '突触', '神经递质', '兴奋传导'],
  'BIOLOGY-010': ['体液调节', '激素', '甲状腺', '胰岛素', '血糖'],
  'BIOLOGY-011': ['免疫', '特异性免疫', '非特异性免疫', '抗体', '疫苗'],
  'BIOLOGY-012': ['内环境稳态', '内环境', '渗透压', '酸碱度'],
  'BIOLOGY-013': ['种群', '群落', '种群密度', 'K值', 'S型曲线'],
  'BIOLOGY-014': ['生态系统', '食物网', '能量流动', '物质循环', '信息传递'],
  'BIOLOGY-015': ['生态保护', '生物多样性', '可持续发展', '生态工程'],
  'BIOLOGY-016': ['微生物培养', '培养基', '灭菌', '接种', '菌落'],
  'BIOLOGY-017': ['基因工程', '限制酶', '载体', 'PCR', '转基因'],
  'BIOLOGY-018': ['细胞工程', '植物组织培养', '动物细胞培养', '体细胞杂交'],
  'BIOLOGY-019': ['胚胎工程', '体外受精', '胚胎移植', '干细胞'],
  'BIOLOGY-020': ['生物实验', '显微镜', '染色', '同位素标记'],

  'HISTORY-001': ['古代中国政治', '专制主义', '中央集权', '科举', '郡县制'],
  'HISTORY-002': ['古代中国经济', '农业', '手工业', '商业', '重农抑商'],
  'HISTORY-003': ['古代中国文化', '儒学', '道家', '佛教', '科举制'],
  'HISTORY-004': ['近代中国反侵略', '鸦片战争', '甲午', '八国联军', '不平等条约'],
  'HISTORY-005': ['近代中国救亡', '洋务运动', '戊戌变法', '辛亥革命', '新文化运动'],
  'HISTORY-006': ['新民主主义革命', '五四运动', '共产党', '长征', '抗战'],
  'HISTORY-007': ['现代中国', '新中国成立', '改革开放', '社会主义建设'],
  'HISTORY-008': ['一国两制', '港澳回归', '两岸关系'],
  'HISTORY-009': ['古代希腊罗马', '民主政治', '罗马法', '公民法'],
  'HISTORY-010': ['西方人文主义', '文艺复兴', '宗教改革', '启蒙运动'],
  'HISTORY-011': ['资本主义确立', '英国革命', '美国独立', '法国大革命'],
  'HISTORY-012': ['工业革命', '蒸汽机', '电气化', '城市化'],
  'HISTORY-013': ['两次世界大战', '一战', '二战', '凡尔赛', '雅尔塔'],
  'HISTORY-014': ['冷战', '美苏对峙', '北约', '华约', '两极格局'],
  'HISTORY-015': ['多极化趋势', '欧盟', '全球化', '区域集团化'],
  'HISTORY-016': ['近代中国经济', '洋务', '民族资本主义', '官僚资本'],
  'HISTORY-017': ['近代中国思想', '西学东渐', '中体西用', '三民主义'],
  'HISTORY-018': ['现代中国外交', '和平共处', '万隆', '中美建交'],
  'HISTORY-019': ['世界经济体系', '布雷顿森林', 'WTO', 'IMF'],
  'HISTORY-020': ['史料实证', '史料', '史学方法', '历史解释'],

  'GEOGRAPHY-001': ['地球运动', '自转', '公转', '黄赤交角', '昼夜长短'],
  'GEOGRAPHY-002': ['大气', '对流层', '天气系统', '气压', '风'],
  'GEOGRAPHY-003': ['气候', '季风', '降水', '气温', '气候类型'],
  'GEOGRAPHY-004': ['水文', '河流', '湖泊', '洋流', '水循环'],
  'GEOGRAPHY-005': ['地貌', '流水地貌', '风沙地貌', '喀斯特', '海岸'],
  'GEOGRAPHY-006': ['植被与土壤', '自然带', '垂直分异', '地域分异'],
  'GEOGRAPHY-007': ['自然灾害', '地震', '台风', '洪涝', '干旱'],
  'GEOGRAPHY-008': ['人口', '人口增长', '人口迁移', '人口容量'],
  'GEOGRAPHY-009': ['城市', '城市化', '城市功能分区', '城市群'],
  'GEOGRAPHY-010': ['农业', '农业区位', '农业地域类型', '粮食安全'],
  'GEOGRAPHY-011': ['工业', '工业区位', '产业转移', '工业园区'],
  'GEOGRAPHY-012': ['交通', '交通运输', '铁路', '港口', '航空'],
  'GEOGRAPHY-013': ['可持续发展', '生态农业', '循环经济', '低碳'],
  'GEOGRAPHY-014': ['区域发展', '西部开发', '东北振兴', '中部崛起'],
  'GEOGRAPHY-015': ['世界地理', '亚洲', '欧洲', '非洲', '美洲'],
  'GEOGRAPHY-016': ['中国地理', '北方', '南方', '西北', '青藏'],
  'GEOGRAPHY-017': ['海洋地理', '海洋资源', '海洋权益', '海岸带'],
  'GEOGRAPHY-018': ['环境保护', '污染', '生态破坏', '治理'],
  'GEOGRAPHY-019': ['地理信息技术', 'GIS', 'RS', 'GPS', '数字地球'],
  'GEOGRAPHY-020': ['旅游地理', '旅游资源', '旅游规划', '文化遗产'],

  'ZK-BIOLOGY-001': ['细胞', '分裂', '分化', '组织'],
  'ZK-BIOLOGY-002': ['光合作用', '呼吸作用', '蒸腾'],
  'ZK-BIOLOGY-003': ['消化', '循环', '呼吸', '泌尿'],
  'ZK-BIOLOGY-004': ['遗传', '基因', 'DNA', '变异'],
  'ZK-BIOLOGY-005': ['生态', '食物链', '生态系统'],

  'ZK-HISTORY-001': ['古代', '秦汉', '唐宋', '明清'],
  'ZK-HISTORY-002': ['近代', '鸦片战争', '辛亥', '革命', '抗战'],
  'ZK-HISTORY-003': ['世界', '文艺复兴', '工业革命', '世界大战'],

  'ZK-GEOGRAPHY-001': ['经纬', '等高线', '地图', '地球'],
  'ZK-GEOGRAPHY-002': ['世界地理', '大洲', '气候'],
  'ZK-GEOGRAPHY-003': ['中国地理', '地形', '河流'],
  'ZK-GEOGRAPHY-004': ['北京', '城市']
};

const CORE_KEYWORDS = new Set([
  '导数', '椭圆', '数列', '概率', '立体几何', '集合', '向量', '复数',
  '三角函数', '不等式', '排列组合', '极坐标', '定积分', '二次函数',
  '文言文', '古诗', '作文', '语言文字', '默写', '论述类文本',
  '完形填空', '语法填空', '七选五', '短文改错', '读后续写',
  '电磁学', '动量', '光电效应', '机械振动', '热学', '万有引力',
  '牛顿第二定律', '法拉第电磁感应', '楞次定律',
  '化学平衡', '氧化还原', '有机化学', '离子反应', '化学实验',
  '钠', '铝', '铁', '卤素', '苯', '酯化反应',
  '经济生活', '政治生活', '哲学', '法律', '唯物辩证法',
  '细胞', '遗传', '光合作用', '减数分裂', '基因工程', '免疫',
  '专制主义', '辛亥革命', '冷战', '工业革命', '文艺复兴',
  '气候', '洋流', '城市化', '农业区位', '可持续发展'
]);

export function getKeywordsForKP(kpId) {
  return KEYWORD_MAP[kpId] || [];
}

export function matchWeakPoint(questionData, kpId) {
  const keywords = KEYWORD_MAP[kpId];
  if (!keywords || keywords.length === 0) return { matched: false, score: 0, matchedKeywords: [] };

  const searchFields = extractSearchFields(questionData);
  const matchedKeywords = [];
  let score = 0;

  for (const kw of keywords) {
    const isCore = CORE_KEYWORDS.has(kw);
    const kwLower = kw.toLowerCase();

    for (const field of searchFields) {
      if (field.includes(kwLower)) {
        matchedKeywords.push(kw);
        score += isCore ? 2 : 1;
        break;
      }
    }
  }

  return {
    matched: matchedKeywords.length > 0,
    score,
    matchedKeywords,
    confidence: Math.min(matchedKeywords.length / keywords.length, 1)
  };
}

function extractSearchFields(data) {
  const fields = [];

  if (typeof data === 'string') {
    fields.push(data.toLowerCase());
    return fields;
  }

  if (!data || typeof data !== 'object') return fields;

  const priorityFields = ['analysis', 'solution', 'clue', 'metadata', 'question', 'subject'];
  for (const key of priorityFields) {
    if (data[key]) {
      const val = typeof data[key] === 'string' ? data[key] : JSON.stringify(data[key]);
      fields.push(val.toLowerCase());
    }
  }

  if (data.metadata && typeof data.metadata === 'object') {
    if (Array.isArray(data.metadata.keywords)) {
      fields.push(data.metadata.keywords.join(' ').toLowerCase());
    }
  }

  return fields;
}

export function findWeakKPIds(wrongQuestions, allKP) {
  const results = [];

  for (const kp of allKP) {
    let totalScore = 0;
    let totalConfidence = 0;
    let matchCount = 0;
    const allMatchedKeywords = new Set();

    for (const wq of wrongQuestions) {
      let wqData;
      try {
        wqData = typeof wq.data === 'string' ? JSON.parse(wq.data) : wq.data;
      } catch {
        continue;
      }

      const result = matchWeakPoint(wqData, kp.id);
      if (result.matched) {
        totalScore += result.score;
        totalConfidence += result.confidence;
        matchCount++;
        result.matchedKeywords.forEach(kw => allMatchedKeywords.add(kw));
      }
    }

    if (matchCount > 0) {
      results.push({
        kpId: kp.id,
        kpName: kp.name,
        errorCount: matchCount,
        score: totalScore,
        avgConfidence: totalConfidence / matchCount,
        matchedKeywords: [...allMatchedKeywords],
        weaknessIndex: totalScore * (kp.difficulty / 3) * getFrequencyWeight(kp.frequency)
      });
    }
  }

  return results.sort((a, b) => b.weaknessIndex - a.weaknessIndex);
}

const FREQUENCY_WEIGHTS = {
  'high': 1.5,
  'medium': 1.0,
  'low': 0.7,
  '高': 1.5,
  '中': 1.0,
  '低': 0.7
};

function getFrequencyWeight(frequency) {
  return FREQUENCY_WEIGHTS[frequency] || 1.0;
}
