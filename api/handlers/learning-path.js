import { getDb } from '../core/db.js';
import { errorResponse } from '../utils/response.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json(errorResponse('Method not allowed'));
  }

  const email = req.user.email;
  const { subject = 'math' } = req.query;

  const pool = await getDb();

  const wrongQuestionsResult = await pool.query(
    'SELECT id, data, timestamp FROM wrong_questions WHERE user_email = $1 ORDER BY timestamp DESC',
    [email]
  );
  const wrongQuestions = wrongQuestionsResult.rows;

  const knowledgePointsResult = await pool.query(
    'SELECT * FROM knowledge_points WHERE subject = $1 ORDER BY difficulty DESC',
    [subject]
  );
  const knowledgePoints = knowledgePointsResult.rows;

  const subjectMap = {
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
  const subjectName = subjectMap[subject] || subject;

  const weakAnalysis = analyzeWeakPoints(wrongQuestions, knowledgePoints, subject);

  const phases = generateLearningPhases(weakAnalysis, subjectName);

  const totalWeeks = phases.length;

  const weakCount = weakAnalysis.weakPoints.length;
  const strongCount = weakAnalysis.strongPoints.length;
  const recommendation = generateRecommendation(
    weakCount,
    strongCount,
    totalWeeks,
    subjectName,
    wrongQuestions.length
  );

  return res.json({
    subject,
    subjectName,
    totalWeeks,
    phases,
    recommendation,
    analysis: {
      weakPoints: weakAnalysis.weakPoints.map(wp => ({
        name: wp.name,
        count: wp.wrongCount,
        difficulty: wp.difficulty
      })),
      strongPoints: weakAnalysis.strongPoints.map(sp => ({
        name: sp.name,
        difficulty: sp.difficulty
      })),
      totalWrongQuestions: wrongQuestions.length,
      totalKnowledgePoints: knowledgePoints.length
    }
  });
}

function analyzeWeakPoints(wrongQuestions, knowledgePoints, subject) {
  const keywordsMap = getKeywordsForSubject(subject);
  
  const kpWeakness = {};
  
  for (const kp of knowledgePoints) {
    const keywords = keywordsMap[kp.id] || [];
    let wrongCount = 0;
    
    for (const wq of wrongQuestions) {
      const wqData = typeof wq.data === 'string' ? JSON.parse(wq.data) : wq.data;
      const content = JSON.stringify(wqData || {}).toLowerCase();
      const matched = keywords.some(kw => content.includes(kw.toLowerCase()));
      if (matched) wrongCount++;
    }
    
    kpWeakness[kp.id] = {
      id: kp.id,
      name: kp.name,
      wrongCount,
      difficulty: kp.difficulty,
      subtopics: kp.subtopics ? JSON.parse(kp.subtopics) : [],
      frequency: kp.frequency || 'medium'
    };
  }

  const sorted = Object.values(kpWeakness).sort((a, b) => {
    if (b.wrongCount !== a.wrongCount) return b.wrongCount - a.wrongCount;
    return b.difficulty - a.difficulty;
  });

  const weakPoints = sorted.filter(kp => kp.wrongCount > 0);
  const strongPoints = sorted.filter(kp => kp.wrongCount === 0);

  return { weakPoints, strongPoints };
}

function generateLearningPhases(weakAnalysis, subjectName) {
  const phases = [];
  const weakPoints = weakAnalysis.weakPoints;

  if (weakPoints.length === 0) {
    phases.push({
      week: 1,
      focus: `${subjectName}综合复习`,
      topics: ['查漏补缺', '强化基础'],
      dailyGoal: '每天完成10道综合题',
      difficulty: 'medium'
    });
    phases.push({
      week: 2,
      focus: `${subjectName}能力提升`,
      topics: ['难题攻克', '速度训练'],
      dailyGoal: '每天完成5道难题，限时训练',
      difficulty: 'hard'
    });
    return phases;
  }

  const easyWeak = weakPoints.filter(kp => kp.difficulty <= 3);
  if (easyWeak.length > 0) {
    phases.push({
      week: 1,
      focus: '基础巩固',
      topics: easyWeak.slice(0, 3).map(kp => kp.name),
      dailyGoal: `掌握${easyWeak.slice(0, 3).map(kp => kp.name).join('、')}等基础概念`,
      difficulty: 'easy'
    });
  }

  const mediumWeak = weakPoints.filter(kp => kp.difficulty >= 3 && kp.difficulty <= 4);
  if (mediumWeak.length > 0) {
    phases.push({
      week: 2,
      focus: '核心知识强化',
      topics: mediumWeak.slice(0, 3).map(kp => kp.name),
      dailyGoal: `完成${mediumWeak.slice(0, 3).map(kp => kp.name).join('、')}综合题型训练`,
      difficulty: 'medium'
    });
  }

  const hardWeak = weakPoints.filter(kp => kp.difficulty >= 4);
  if (hardWeak.length > 0) {
    phases.push({
      week: 3,
      focus: '难点突破',
      topics: hardWeak.slice(0, 2).map(kp => kp.name),
      dailyGoal: `攻克${hardWeak.slice(0, 2).map(kp => kp.name).join('、')}高难度题型`,
      difficulty: 'hard'
    });
  }

  phases.push({
    week: phases.length + 1,
    focus: '综合训练与模拟',
    topics: weakPoints.slice(0, 5).map(kp => kp.name),
    dailyGoal: '完成全套模拟题，限时训练',
    difficulty: 'comprehensive'
  });

  return phases;
}

function generateRecommendation(weakCount, strongCount, totalWeeks, subjectName, wrongTotal) {
  let timePerDay = '1小时';
  let emphasis = '';
  
  if (weakCount === 0) {
    timePerDay = '40分钟';
    emphasis = `没有发现明显薄弱点（无错题记录），建议每周做2-3套模拟卷保持状态。`;
  } else if (weakCount <= 3) {
    timePerDay = '1小时';
    emphasis = `有${weakCount}个薄弱点需要重点突破，建议集中精力先解决最基础的薄弱知识点。`;
  } else if (weakCount <= 6) {
    timePerDay = '1.5小时';
    emphasis = `发现${weakCount}个薄弱点，建议采用"每天1个薄弱点"的策略，循序渐进。`;
  } else {
    timePerDay = '2小时';
    emphasis = `薄弱点较多（${weakCount}个），建议按难度从低到高逐个攻克，不要贪多求快。`;
  }
  
  if (wrongTotal === 0) {
    return `首次为${subjectName}制定学习计划，建议先完成一些错题记录，以便生成更精准的个性化学习路径。推荐每天投入${timePerDay}进行针对性练习。`;
  }
  
  return `共分析了${wrongTotal}条错题记录，发现${weakCount}个薄弱知识点。${emphasis}建议每天投入${timePerDay}，重点突破弱项。`;
}

function getKeywordsForSubject(subject) {
  const keywordMap = {
    'math': {
      'MATH-001': ['函数', '导数', '单调性', '极值', '切线'],
      'MATH-002': ['解析几何', '椭圆', '双曲线', '抛物线', '圆锥曲线'],
      'MATH-003': ['数列', '等差', '等比', '递推'],
      'MATH-004': ['概率', '统计', '二项分布', '随机'],
      'MATH-005': ['立体几何', '空间向量', '体积', '三视图'],
      'MATH-006': ['集合', '充分条件', '命题'],
      'MATH-007': ['向量', '数量积', '垂直'],
      'MATH-008': ['复数', '复数模'],
      'MATH-009': ['三角函数', '解三角形', '正弦', '余弦'],
      'MATH-010': ['不等式'],
      'MATH-011': ['排列组合', '二项式'],
      'MATH-012': ['程序框图', '算法'],
      'MATH-013': ['极坐标', '参数方程']
    },
    'chinese': {
      'CHINESE-001': ['现代文', '阅读'],
      'CHINESE-002': ['文言文', '翻译'],
      'CHINESE-003': ['古诗', '鉴赏'],
      'CHINESE-004': ['作文', '审题'],
      'CHINESE-005': ['语言文字', '成语', '病句'],
      'CHINESE-006': ['默写', '背诵'],
      'CHINESE-007': ['实用类', '新闻']
    },
    'english': {
      'ENGLISH-001': ['阅读理解', '阅读'],
      'ENGLISH-002': ['完形填空'],
      'ENGLISH-003': ['语法填空'],
      'ENGLISH-004': ['写作', '作文'],
      'ENGLISH-005': ['听力'],
      'ENGLISH-006': ['七选五'],
      'ENGLISH-007': ['短文改错']
    },
    'physics': {
      'PHYSICS-001': ['力学', '牛顿', '运动'],
      'PHYSICS-002': ['电磁学', '电场', '磁场'],
      'PHYSICS-003': ['能量', '动量'],
      'PHYSICS-004': ['近代物理', '光电效应'],
      'PHYSICS-005': ['机械振动', '波'],
      'PHYSICS-006': ['热学', '分子'],
      'PHYSICS-007': ['天体', '万有引力'],
      'PHYSICS-008': ['电学实验'],
      'PHYSICS-009': ['交变电流']
    },
    'chemistry': {
      'CHEMISTRY-001': ['化学平衡', '反应速率'],
      'CHEMISTRY-002': ['氧化还原', '原电池'],
      'CHEMISTRY-003': ['有机化学', '有机'],
      'CHEMISTRY-004': ['物质结构', '周期'],
      'CHEMISTRY-005': ['离子反应', '离子'],
      'CHEMISTRY-006': ['实验'],
      'CHEMISTRY-007': ['水溶液', '电离', '水解'],
      'CHEMISTRY-008': ['元素', '金属'],
      'CHEMISTRY-009': ['计算', '摩尔']
    },
    'politics': {
      'POLITICS-001': ['经济生活', '经济'],
      'POLITICS-002': ['政治生活', '政治'],
      'POLITICS-003': ['文化生活', '文化'],
      'POLITICS-004': ['哲学'],
      'POLITICS-005': ['法律'],
      'POLITICS-006': ['时事', '热点'],
      'POLITICS-007': ['逻辑']
    },
    'biology': {
      'ZK-BIOLOGY-001': ['细胞', '分裂', '分化', '组织'],
      'ZK-BIOLOGY-002': ['光合作用', '呼吸作用', '蒸腾'],
      'ZK-BIOLOGY-003': ['消化', '循环', '呼吸', '泌尿'],
      'ZK-BIOLOGY-004': ['遗传', '基因', 'DNA', '变异'],
      'ZK-BIOLOGY-005': ['生态', '食物链', '生态系统']
    },
    'history': {
      'ZK-HISTORY-001': ['古代', '秦汉', '唐宋', '明清'],
      'ZK-HISTORY-002': ['近代', '鸦片战争', '辛亥', '革命', '抗战'],
      'ZK-HISTORY-003': ['世界', '文艺复兴', '工业革命', '世界大战']
    },
    'geography': {
      'ZK-GEOGRAPHY-001': ['经纬', '等高线', '地图', '地球'],
      'ZK-GEOGRAPHY-002': ['世界地理', '大洲', '气候'],
      'ZK-GEOGRAPHY-003': ['中国地理', '地形', '河流'],
      'ZK-GEOGRAPHY-004': ['北京', '城市']
    }
  };

  return keywordMap[subject] || {};
}
