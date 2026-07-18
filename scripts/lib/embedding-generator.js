/**
 * Embedding文本生成器
 * 
 * 专门用于向量检索的优化文本生成
 * 不使用完整Markdown内容进行Embedding，而是生成优化后的检索文本
 * 
 * embedding.txt文件包含：
 * - 核心知识点标签
 * - 题目类型描述
 * - 关键解题方法
 * - 题目特征说明（如图像内容描述）
 * - 涉及的数学/物理/化学概念
 * - 典型题型分类
 */
import { getSubjectFeatures, QUESTION_TYPE_CN, SUBJECT_CN } from './multimodal-question.js';

const DIFFICULTY_LEVELS = ['', '简单', '较易', '中等', '较难', '困难'];

const MATH_CONCEPT_MAP = {
  '函数': ['函数定义', '函数性质', '函数图像', '函数零点'],
  '导数': ['导数定义', '导数公式', '导数应用', '极值', '最值'],
  '三角函数': ['三角恒等式', '三角函数图像', '三角方程'],
  '数列': ['等差数列', '等比数列', '递推数列', '数列求和'],
  '立体几何': ['空间向量', '线面关系', '体积计算', '角度计算'],
  '解析几何': ['直线方程', '圆的方程', '椭圆', '双曲线', '抛物线'],
  '概率': ['概率计算', '期望', '方差', '统计'],
  '不等式': ['不等式证明', '不等式求解', '均值不等式'],
};

const PHYSICS_CONCEPT_MAP = {
  '力学': ['牛顿运动定律', '动量守恒', '能量守恒', '圆周运动'],
  '电磁学': ['电场', '磁场', '电磁感应', '电路分析'],
  '热学': ['热力学定律', '分子运动', '理想气体'],
  '光学': ['几何光学', '波动光学', '光的反射折射'],
  '原子物理': ['原子结构', '原子核', '量子力学']
};

const CHEMISTRY_CONCEPT_MAP = {
  '化学反应': ['反应速率', '化学平衡', '氧化还原', '离子反应'],
  '有机化学': ['烃类', '烃的衍生物', '有机合成', '有机物结构'],
  '元素化合物': ['金属元素', '非金属元素', '化合物性质'],
  '化学实验': ['实验操作', '实验设计', '实验数据处理'],
  '化学计算': ['物质的量', '溶液浓度', '化学计量']
};

const CHINESE_CONCEPT_MAP = {
  '文言文': ['实词', '虚词', '词类活用', '特殊句式', '断句'],
  '诗词': ['诗歌意象', '表现手法', '修辞手法', '情感表达'],
  '现代文': ['主旨概括', '段落分析', '写作手法', '语言特色'],
  '作文': ['立意', '结构', '论证', '语言表达', '素材运用'],
  '文学常识': ['作家作品', '文学流派', '文体知识']
};

const ENGLISH_CONCEPT_MAP = {
  '词汇': ['核心词汇', '近义词辨析', '固定搭配', '词性转换'],
  '语法': ['时态', '语态', '从句', '非谓语动词', '倒装'],
  '阅读理解': ['主旨大意', '细节理解', '推理判断', '词义猜测'],
  '完形填空': ['语境理解', '词汇辨析', '逻辑关系', '固定搭配'],
  '写作': ['文章结构', '论点论证', '连接词', '高级句型'],
  '听力': ['语音语调', '关键词', '信息提取', '推理判断']
};

const HISTORY_CONCEPT_MAP = {
  '中国古代史': ['朝代更迭', '政治制度', '经济发展', '文化传承'],
  '中国近现代史': ['列强侵华', '近代化探索', '革命历程', '改革开放'],
  '世界史': ['古代文明', '资本主义发展', '两次世界大战', '冷战格局'],
  '史料分析': ['史料类型', '史料价值', '史料解读', '史证结合'],
  '历史人物': ['历史评价', '时代背景', '历史贡献']
};

const GEOGRAPHY_CONCEPT_MAP = {
  '自然地理': ['地球运动', '大气运动', '水体运动', '地质作用'],
  '人文地理': ['人口', '城市', '农业', '工业', '交通'],
  '区域地理': ['区域特征', '区域发展', '区域差异', '区域联系'],
  '地图': ['等高线', '经纬网', '比例尺', '方向判读'],
  '地理计算': ['时间计算', '距离计算', '坡度计算', '人口计算']
};

const BIOLOGY_CONCEPT_MAP = {
  '细胞': ['细胞结构', '细胞代谢', '细胞分裂', '细胞分化'],
  '遗传': ['DNA', 'RNA', '基因表达', '遗传定律', '生物变异'],
  '生态': ['生态系统', '种群', '群落', '生态平衡'],
  '代谢': ['光合作用', '呼吸作用', '酶', 'ATP'],
  '调节': ['神经调节', '体液调节', '免疫调节']
};

const POLITICS_CONCEPT_MAP = {
  '经济': ['商品', '货币', '价值规律', '市场经济', '宏观调控'],
  '政治': ['国家性质', '政党制度', '人民代表大会', '公民权利'],
  '文化': ['文化传承', '文化创新', '文化多样性', '文化自信'],
  '哲学': ['唯物论', '辩证法', '认识论', '历史唯物主义'],
  '时政': ['政策解读', '社会热点', '国际形势', '理论创新']
};

const CONCEPT_MAPS = {
  math: MATH_CONCEPT_MAP,
  physics: PHYSICS_CONCEPT_MAP,
  chemistry: CHEMISTRY_CONCEPT_MAP,
  biology: BIOLOGY_CONCEPT_MAP,
  chinese: CHINESE_CONCEPT_MAP,
  english: ENGLISH_CONCEPT_MAP,
  history: HISTORY_CONCEPT_MAP,
  geography: GEOGRAPHY_CONCEPT_MAP,
  politics: POLITICS_CONCEPT_MAP
};

export function generateEmbeddingText(questionData) {
  const parts = [];

  addKnowledgePoints(parts, questionData);
  addQuestionType(parts, questionData);
  addSubject(parts, questionData);
  addDifficulty(parts, questionData);
  addSolvingMethods(parts, questionData);
  addImageDescriptions(parts, questionData);
  addConcepts(parts, questionData);
  addTypicalCategory(parts, questionData);
  addKeyFeatures(parts, questionData);

  return parts.join('。');
}

function addKnowledgePoints(parts, questionData) {
  if (questionData.knowledge_points && questionData.knowledge_points.length > 0) {
    const kpStr = questionData.knowledge_points.join('、');
    parts.push(`核心知识点: ${kpStr}`);
  }
}

function addQuestionType(parts, questionData) {
  if (questionData.question_type) {
    const typeCN = QUESTION_TYPE_CN[questionData.question_type] || questionData.question_type;
    parts.push(`题目类型: ${typeCN}`);
    
    const typeFeatures = getQuestionTypeFeatures(questionData.question_type);
    if (typeFeatures) {
      parts.push(typeFeatures);
    }
  }
}

function getQuestionTypeFeatures(type) {
  const features = {
    choice: '考查基础知识和基本技能的掌握程度',
    fill: '考查对概念、公式的理解和应用能力',
    solve: '考查综合运用知识解决问题的能力',
    reading: '考查阅读理解和信息提取能力',
    cloze: '考查语言知识和上下文理解能力',
    essay: '考查语言表达和综合分析能力'
  };
  return features[type];
}

function addSubject(parts, questionData) {
  if (questionData.subject) {
    const subjectCN = SUBJECT_CN[questionData.subject] || questionData.subject;
    parts.push(`学科: ${subjectCN}`);
    
    const subjectFeatures = getSubjectFeatures(questionData.subject);
    if (subjectFeatures && subjectFeatures.typical_categories) {
      parts.push(`典型题型: ${subjectFeatures.typical_categories.join('、')}`);
    }
  }
}

function addDifficulty(parts, questionData) {
  if (questionData.difficulty && questionData.difficulty >= 1 && questionData.difficulty <= 5) {
    const difficultyCN = DIFFICULTY_LEVELS[questionData.difficulty];
    parts.push(`难度: ${difficultyCN}`);
    
    const difficultyFeatures = getDifficultyFeatures(questionData.difficulty);
    if (difficultyFeatures) {
      parts.push(difficultyFeatures);
    }
  }
}

function getDifficultyFeatures(difficulty) {
  const features = {
    1: '适合基础巩固和入门练习',
    2: '适合基础知识强化训练',
    3: '适合中等难度综合训练',
    4: '适合提高能力和拓展思维',
    5: '适合挑战难题和冲刺复习'
  };
  return features[difficulty];
}

function addSolvingMethods(parts, questionData) {
  if (questionData.solving_methods && questionData.solving_methods.length > 0) {
    parts.push(`解题方法: ${questionData.solving_methods.join('、')}`);
  } else {
    const methods = inferSolvingMethods(questionData);
    if (methods && methods.length > 0) {
      parts.push(`解题方法: ${methods.join('、')}`);
    }
  }
}

function inferSolvingMethods(questionData) {
  const methods = [];
  
  if (!questionData.subject) return [];
  
  const subjectMethods = {
    math: {
      choice: ['排除法', '代入法', '特殊值法', '数形结合'],
      fill: ['公式法', '数形结合', '分类讨论', '等价转化'],
      solve: ['综合法', '分析法', '数学归纳法', '反证法'],
      proof: ['综合法', '分析法', '反证法', '数学归纳法'],
      calculation: ['公式法', '分步计算', '验算']
    },
    physics: {
      choice: ['公式法', '分析法', '排除法'],
      fill: ['公式推导', '单位分析', '图像分析'],
      solve: ['受力分析', '能量分析', '动量分析', '电路分析'],
      experiment: ['实验设计', '数据分析', '误差分析'],
      calculation: ['公式法', '单位换算', '分步计算']
    },
    chemistry: {
      choice: ['排除法', '守恒法', '关系式法'],
      fill: ['守恒法', '关系式法', '差量法'],
      solve: ['化学方程式配平', '溶液计算', '实验设计'],
      experiment: ['实验操作', '现象观察', '数据处理'],
      calculation: ['物质的量计算', '浓度计算', '化学计量']
    },
    biology: {
      choice: ['排除法', '概念辨析', '推理法'],
      fill: ['概念填空', '过程描述', '数据填写'],
      solve: ['遗传分析', '实验设计', '数据分析'],
      experiment: ['实验设计', '对照实验', '变量控制'],
      short_answer: ['概念解释', '过程描述', '推理分析']
    },
    chinese: {
      reading: ['主旨概括', '细节查找', '推理判断', '语境理解'],
      choice: ['排除法', '语境分析法', '指代分析法'],
      fill: ['记忆检索', '语境推断', '语法分析'],
      short_answer: ['要点提炼', '文本分析', '语言表达'],
      essay: ['立意构思', '结构安排', '素材运用', '论证展开'],
      translation: ['逐词翻译', '句式调整', '语境还原']
    },
    english: {
      reading: ['主旨大意', '细节理解', '推理判断', '词义猜测'],
      cloze: ['语境理解', '词汇辨析', '逻辑分析', '固定搭配'],
      grammar_fill: ['语法分析', '时态判断', '句型分析'],
      choice: ['排除法', '语法判断', '语义辨析'],
      writing: ['结构规划', '论点论证', '语言组织', '连接词使用'],
      translation: ['准确理解', '句式调整', '符合目标语言'],
      listening: ['关键词提取', '语境推断', '信息整合']
    },
    politics: {
      choice: ['概念辨析', '排除法', '原理应用'],
      fill: ['概念填写', '原理表述', '政策关键词'],
      short_answer: ['原理阐述', '材料分析', '观点论证'],
      essay: ['理论框架', '案例分析', '论证结构', '时政联系'],
      analysis: ['材料解读', '原理应用', '逻辑推理', '结论提炼']
    },
    history: {
      choice: ['时序判断', '因果分析', '史料解读', '排除法'],
      fill: ['时间线记忆', '事件描述', '人物填写'],
      short_answer: ['事件分析', '因果推理', '史料运用'],
      essay: ['论点提炼', '史料支撑', '论证结构', '历史评价'],
      analysis: ['史料解读', '因果分析', '历史解释', '对比分析']
    },
    geography: {
      choice: ['图表分析', '排除法', '空间定位'],
      fill: ['数据填写', '地理术语', '计算结果'],
      solve: ['地理计算', '综合分析', '区域评价'],
      short_answer: ['图表描述', '原理应用', '分析论述'],
      analysis: ['图表解读', '数据处理', '综合分析', '区域比较']
    }
  };
  
  const subjectMap = subjectMethods[questionData.subject];
  if (subjectMap && questionData.question_type) {
    methods.push(...(subjectMap[questionData.question_type] || []));
  }
  
  return methods;
}

function addImageDescriptions(parts, questionData) {
  if (questionData.image_descriptions && questionData.image_descriptions.length > 0) {
    parts.push(`图像内容描述: ${questionData.image_descriptions.join('；')}`);
  }
  
  if (questionData.physics_structure && Object.keys(questionData.physics_structure).length > 0) {
    const structureDesc = describePhysicsStructure(questionData.physics_structure);
    if (structureDesc) {
      parts.push(structureDesc);
    }
  }
  
  if (questionData.chemistry_structure && Object.keys(questionData.chemistry_structure).length > 0) {
    const structureDesc = describeChemistryStructure(questionData.chemistry_structure);
    if (structureDesc) {
      parts.push(structureDesc);
    }
  }
  
  if (questionData.math_structure && Object.keys(questionData.math_structure).length > 0) {
    const structureDesc = describeMathStructure(questionData.math_structure);
    if (structureDesc) {
      parts.push(structureDesc);
    }
  }
}

function describePhysicsStructure(structure) {
  const parts = [];
  if (structure.diagram_type) {
    parts.push(`物理图类型: ${structure.diagram_type}`);
  }
  if (structure.components && structure.components.length > 0) {
    parts.push(`包含组件: ${structure.components.join('、')}`);
  }
  if (structure.measurements) {
    parts.push(`测量数据: ${JSON.stringify(structure.measurements)}`);
  }
  return parts.length > 0 ? `物理结构: ${parts.join('；')}` : null;
}

function describeChemistryStructure(structure) {
  const parts = [];
  if (structure.equation) {
    parts.push(`化学反应式: ${structure.equation}`);
  }
  if (structure.apparatus && structure.apparatus.length > 0) {
    parts.push(`实验装置: ${structure.apparatus.join('、')}`);
  }
  if (structure.substances && structure.substances.length > 0) {
    parts.push(`涉及物质: ${structure.substances.join('、')}`);
  }
  return parts.length > 0 ? `化学结构: ${parts.join('；')}` : null;
}

function describeMathStructure(structure) {
  const parts = [];
  if (structure.formula_type) {
    parts.push(`公式类型: ${structure.formula_type}`);
  }
  if (structure.figure_type) {
    parts.push(`图形类型: ${structure.figure_type}`);
  }
  if (structure.conditions) {
    parts.push(`题设条件: ${structure.conditions}`);
  }
  return parts.length > 0 ? `数学结构: ${parts.join('；')}` : null;
}

function addConcepts(parts, questionData) {
  if (questionData.concepts && questionData.concepts.length > 0) {
    parts.push(`涉及概念: ${questionData.concepts.join('、')}`);
  } else {
    const concepts = inferConcepts(questionData);
    if (concepts && concepts.length > 0) {
      parts.push(`涉及概念: ${concepts.join('、')}`);
    }
  }
}

function inferConcepts(questionData) {
  if (!questionData.subject || !questionData.knowledge_points) return [];
  
  const conceptMap = CONCEPT_MAPS[questionData.subject];
  if (!conceptMap) return [];
  
  const concepts = new Set();
  
  for (const kp of questionData.knowledge_points) {
    for (const [key, values] of Object.entries(conceptMap)) {
      if (kp.includes(key)) {
        values.forEach(v => concepts.add(v));
      }
    }
  }
  
  return Array.from(concepts);
}

function addTypicalCategory(parts, questionData) {
  if (questionData.typical_category) {
    parts.push(`典型题型分类: ${questionData.typical_category}`);
  } else if (questionData.subject && questionData.question_type) {
    const category = inferTypicalCategory(questionData);
    if (category) {
      parts.push(`典型题型分类: ${category}`);
    }
  }
}

function inferTypicalCategory(questionData) {
  const categories = {
    math: {
      choice: ['集合与常用逻辑用语', '函数概念与性质', '三角函数', '数列', '不等式', '立体几何', '解析几何', '概率统计'],
      fill: ['函数与导数', '三角函数', '数列', '立体几何', '解析几何', '概率统计'],
      solve: ['函数与导数', '三角函数', '数列', '立体几何', '解析几何', '概率统计'],
      proof: ['立体几何证明', '不等式证明', '数列证明'],
      calculation: ['函数计算', '数列计算', '概率计算']
    },
    physics: {
      choice: ['力学', '电磁学', '热学', '光学', '原子物理'],
      fill: ['力学', '电磁学', '热学'],
      solve: ['力学综合', '电磁学综合', '实验题'],
      experiment: ['力学实验', '电学实验', '光学实验'],
      calculation: ['力学计算', '电磁学计算', '能量计算']
    },
    chemistry: {
      choice: ['化学基本概念', '化学反应原理', '有机化学', '元素化合物'],
      fill: ['化学反应原理', '有机化学'],
      solve: ['化学反应原理', '有机化学', '化学实验', '工艺流程'],
      experiment: ['化学实验', '物质检验', '溶液配制'],
      calculation: ['物质的量计算', '溶液浓度计算', '化学平衡计算']
    },
    biology: {
      choice: ['细胞生物学', '遗传学', '生态学', '代谢', '生命调节'],
      fill: ['细胞结构', '遗传基础', '生态系统'],
      solve: ['遗传分析', '实验设计', '数据分析'],
      experiment: ['细胞实验', '遗传实验', '生态实验'],
      short_answer: ['概念解释', '过程描述', '推理分析']
    },
    chinese: {
      reading: ['现代文阅读', '古诗文阅读', '文言文阅读'],
      choice: ['语言文字运用', '文学常识', '文言文虚词'],
      fill: ['名句默写', '文言文实词', '标点运用'],
      short_answer: ['现代文阅读', '古诗文阅读', '文言文翻译'],
      essay: ['记叙文', '议论文', '说明文', '材料作文'],
      translation: ['文言文翻译', '古诗词翻译']
    },
    english: {
      reading: ['阅读理解', '七选五', '阅读理解推断'],
      cloze: ['完形填空', '语法填空', '短文改错'],
      grammar_fill: ['语法填空', '时态填空', '词性填空'],
      choice: ['语法选择', '词汇辨析', '完形填空'],
      writing: ['应用文写作', '读后续写', '概要写作'],
      translation: ['英译汉', '汉译英'],
      listening: ['听力理解', '听力填空']
    },
    politics: {
      choice: ['经济生活', '政治生活', '文化生活', '哲学'],
      fill: ['经济生活', '政治生活', '哲学'],
      short_answer: ['经济分析', '政治分析', '哲学分析'],
      essay: ['经济生活', '政治生活', '文化生活', '哲学'],
      analysis: ['材料分析', '政策分析', '时政分析']
    },
    history: {
      choice: ['中国古代史', '中国近现代史', '世界史'],
      fill: ['时间线', '事件填写', '人物填写'],
      short_answer: ['事件分析', '因果推理', '史料运用'],
      essay: ['中国古代史', '中国近现代史', '世界史', '历史论证'],
      analysis: ['史料分析', '历史解释', '对比分析']
    },
    geography: {
      choice: ['自然地理', '人文地理', '区域地理'],
      fill: ['地理计算', '地理术语', '数据填写'],
      solve: ['地理计算', '综合分析', '区域评价'],
      short_answer: ['图表描述', '原理应用', '分析论述'],
      analysis: ['图表解读', '数据处理', '综合分析']
    }
  };
  
  const subjectMap = categories[questionData.subject];
  if (subjectMap && questionData.question_type) {
    return subjectMap[questionData.question_type]?.[0] || null;
  }
  return null;
}

function addKeyFeatures(parts, questionData) {
  if (questionData.key_features) {
    parts.push(`题目特征: ${questionData.key_features}`);
  } else {
    const features = inferKeyFeatures(questionData);
    if (features) {
      parts.push(`题目特征: ${features}`);
    }
  }
}

function inferKeyFeatures(questionData) {
  const features = [];
  
  if (questionData.has_image) {
    features.push('包含图像信息');
  }
  if (questionData.has_formula) {
    features.push('包含公式推导');
  }
  if (questionData.question_type === 'solve') {
    features.push('需要综合运用多个知识点');
  }
  
  return features.length > 0 ? features.join('、') : null;
}

export function optimizeEmbeddingText(text) {
  let result = text;
  
  result = result.replace(/。{2,}/g, '。');
  
  result = result.replace(/、{2,}/g, '、');
  
  result = result.replace(/；{2,}/g, '；');
  
  result = result.trim();
  
  if (!result.endsWith('。')) {
    result += '。';
  }
  
  return result;
}

export function generateEmbeddingForVectorDB(questionData) {
  const rawText = generateEmbeddingText(questionData);
  return optimizeEmbeddingText(rawText);
}
