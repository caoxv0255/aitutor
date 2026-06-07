import { getDb } from '../core/db.js';
import { SUBJECT_MAP, KEYWORD_MAP, resolveSubjectName, matchWeakPoint } from '../utils/subjectMap.js';
import { getUserAbilityForSubject } from './adaptive-difficulty.js';
import { errorResponse } from '../utils/response.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json(errorResponse('Method not allowed'));
  }

  const email = req.user.email;
  const pool = await getDb();
  const { subject = 'math', difficulty: requestedDifficulty, timeLimit = 120, focusWeakPoints = true, adaptive = true } = req.body;

  let difficulty = requestedDifficulty;
  if (adaptive && !requestedDifficulty) {
    const abilityResult = await getUserAbilityForSubject(email, subject);
    difficulty = abilityResult.adaptiveDifficulty;
  }
  if (!difficulty) difficulty = 3.5;

  const subjectName = resolveSubjectName(subject) || subject;

  const wrongQuestionsResult = await pool.query(
    'SELECT id, data, timestamp FROM wrong_questions WHERE user_email = $1 ORDER BY timestamp DESC',
    [email]
  );
  const wrongQuestions = wrongQuestionsResult.rows;

  const allKPResult = await pool.query(
    'SELECT * FROM knowledge_points WHERE subject = $1 OR subject = $2 ORDER BY difficulty DESC',
    [subject, subjectName]
  );
  const allKP = allKPResult.rows;

  if (allKP.length === 0) {
    return res.status(400).json(errorResponse(`${subjectName}学科暂无知识点数据，无法生成试卷`));
  }

  const weakKPIds = [];
  const weakKPScores = {};

  for (const kp of allKP) {
    let kpScore = 0;
    for (const wq of wrongQuestions) {
      let wqData;
      try {
        wqData = typeof wq.data === 'string' ? JSON.parse(wq.data) : wq.data;
      } catch {
        continue;
      }
      const result = matchWeakPoint(wqData, kp.id);
      if (result.matched) {
        kpScore += result.score;
      }
    }
    if (kpScore > 0) {
      weakKPIds.push(kp.id);
      weakKPScores[kp.id] = kpScore;
    }
  }

  const weakKPs = allKP.filter(kp => weakKPIds.includes(kp.id));
  const remainingKPs = allKP.filter(kp => !weakKPIds.includes(kp.id));
  
  const targetKPs = [...weakKPs, ...remainingKPs];
  const weakPointsCovered = weakKPs.map(kp => kp.name);

  const distribution = calculateDistribution(difficulty, timeLimit, targetKPs.length);

  const selectionScore = 5;
  const fillScore = 5;
  const fillCount = 4;
  const solutionScores = [12, 12, 14];
  const selectionTotal = distribution.total - fillCount - solutionScores.length;

  const paper = {
    title: `${subjectName}个性化预测卷`,
    subject,
    subject_name: subjectName,
    generated_at: new Date().toISOString(),
    is_personalized: weakKPs.length > 0,
    weak_points_targeted: weakPointsCovered,
    metadata: {
      difficulty: parseFloat(difficulty) || 3.5,
      timeEstimate: `${Math.round(timeLimit * 0.83)}分钟`,
      timeLimit: parseInt(timeLimit) || 120,
      questionCount: distribution.total,
      weakPointsCovered,
      distribution: {
        '基础题': distribution.easy,
        '中档题': distribution.medium,
        '压轴题': distribution.hard
      }
    },
    sections: []
  };

  const selectionQuestions = [];
  for (let i = 0; i < selectionTotal; i++) {
    const kp = targetKPs[i % targetKPs.length];
    const difficultyLevel = getDifficultyForIndex(i, distribution);
    const isWeak = weakKPIds.includes(kp.id);
    const q = generateSelectionQuestion(subject, kp, i + 1, difficultyLevel, isWeak);
    selectionQuestions.push(q);
  }

  const selectionTotalScore = selectionTotal * selectionScore;
  paper.sections.push({
    section_name: '一、选择题',
    description: `本题共${selectionTotal}小题，每小题${selectionScore}分，共${selectionTotalScore}分。`,
    questions: selectionQuestions
  });

  const fillQuestions = [];
  for (let i = 0; i < fillCount; i++) {
    const kp = targetKPs[(i + selectionTotal) % targetKPs.length];
    const difficultyLevel = i < 2 ? 'easy' : 'medium';
    const isWeak = weakKPIds.includes(kp.id);
    const q = generateFillQuestion(subject, kp, i + 1, difficultyLevel, isWeak);
    fillQuestions.push(q);
  }

  const fillTotalScore = fillCount * fillScore;
  paper.sections.push({
    section_name: '二、填空题',
    description: `本题共${fillCount}小题，每小题${fillScore}分，共${fillTotalScore}分。`,
    questions: fillQuestions
  });

  const solutionQuestions = [];
  for (let i = 0; i < solutionScores.length; i++) {
    const kp = targetKPs[(i + selectionTotal + fillCount) % targetKPs.length];
    const difficultyLevel = i === solutionScores.length - 1 ? 'hard' : 'medium';
    const isWeak = weakKPIds.includes(kp.id);
    const q = generateSolutionQuestion(subject, kp, i + 1, difficultyLevel, solutionScores[i], isWeak);
    solutionQuestions.push(q);
  }

  const solutionTotalScore = solutionScores.reduce((a, b) => a + b, 0);
  paper.sections.push({
    section_name: '三、解答题',
    description: `本题共${solutionScores.length}小题，共${solutionTotalScore}分。`,
    questions: solutionQuestions
  });

  paper.metadata.totalScore = selectionTotalScore + fillTotalScore + solutionTotalScore;

  await pool.query(
    'INSERT INTO personalized_papers (user_email, subject, data) VALUES ($1, $2, $3)',
    [email, subject, JSON.stringify(paper)]
  );

  return res.json(paper);
}

function calculateDistribution(targetDifficulty, timeLimit, kpCount) {
  let easy, medium, hard;
  
  if (targetDifficulty <= 2) {
    easy = 12; medium = 6; hard = 2;
  } else if (targetDifficulty <= 3) {
    easy = 8; medium = 8; hard = 4;
  } else if (targetDifficulty <= 4) {
    easy = 5; medium = 8; hard = 7;
  } else {
    easy = 3; medium = 6; hard = 11;
  }

  const timeFactor = timeLimit / 120;
  if (timeFactor < 0.8) {
    easy = Math.max(4, Math.floor(easy * 0.7));
    medium = Math.max(3, Math.floor(medium * 0.7));
    hard = Math.max(1, Math.floor(hard * 0.7));
  } else if (timeFactor > 1.2) {
    easy = Math.floor(easy * 1.2);
    medium = Math.floor(medium * 1.2);
  }

  return {
    easy: Math.max(2, easy),
    medium: Math.max(2, medium),
    hard: Math.max(1, hard),
    total: easy + medium + hard + 4 + 3
  };
}

function getDifficultyForIndex(index, distribution) {
  if (index < distribution.easy) return 'easy';
  if (index < distribution.easy + distribution.medium) return 'medium';
  return 'hard';
}

function generateSelectionQuestion(subject, kp, num, difficultyLevel, isWeakPoint) {
  const templates = getQuestionTemplates(subject);
  const topicQuestions = templates.selection[kp.id] || templates.selection['default'] || [];

  if (topicQuestions.length > 0) {
    const q = topicQuestions[num % topicQuestions.length];
    return {
      id: `S${num}`,
      ...q,
      knowledge_point: kp.name,
      kp_id: kp.id,
      is_weak_point: isWeakPoint,
      difficulty: difficultyLevel
    };
  }

  return {
    id: `S${num}`,
    content: `【${kp.name}】第${num}题 - 请基于${kp.name}知识点作答`,
    options: ['A. 选项A', 'B. 选项B', 'C. 选项C', 'D. 选项D'],
    answer: 'A',
    explanation: `考查${kp.name}相关知识`,
    knowledge_point: kp.name,
    kp_id: kp.id,
    is_weak_point: isWeakPoint,
    difficulty: difficultyLevel
  };
}

function generateFillQuestion(subject, kp, num, difficultyLevel, isWeakPoint) {
  return {
    id: `F${num}`,
    content: `【${kp.name}】第${num}题 - 填空题（考查${kp.name}）`,
    answer: '（略）',
    explanation: `考查${kp.name}相关知识`,
    knowledge_point: kp.name,
    kp_id: kp.id,
    is_weak_point: isWeakPoint,
    difficulty: difficultyLevel
  };
}

function generateSolutionQuestion(subject, kp, num, difficultyLevel, score, isWeakPoint) {
  return {
    id: `J${num}`,
    content: `【${kp.name}】第${num}题 - 解答题（考查${kp.name}）`,
    answer: '（详细解答过程）',
    explanation: `考查${kp.name}的综合应用能力`,
    knowledge_point: kp.name,
    kp_id: kp.id,
    is_weak_point: isWeakPoint,
    difficulty: difficultyLevel,
    score
  };
}

function getQuestionTemplates(subject) {
  const templates = {
    'math': {
      selection: {
        'MATH-001': [
          { content: '已知函数 f(x) = x³ - 3x + 1，则 f(x) 在 x=1 处的切线斜率为（　　）', options: ['A. -3', 'B. 0', 'C. 3', 'D. 6'], answer: 'B', explanation: "f'(x) = 3x² - 3，f'(1) = 0" },
          { content: '函数 f(x) = ln(x) - 1/x 的单调递增区间为（　　）', options: ['A. (0,1)', 'B. (1,+∞)', 'C. (0,+∞)', 'D. (-∞,0)'], answer: 'B', explanation: "f'(x) = 1/x + 1/x² > 0 恒成立" }
        ],
        'MATH-002': [
          { content: '已知椭圆 x²/4 + y²/3 = 1 的离心率为（　　）', options: ['A. 1/2', 'B. √3/2', 'C. √7/2', 'D. 1/4'], answer: 'A', explanation: 'c = √(a²-b²) = 1，e = c/a = 1/2' },
          { content: '抛物线 y² = 4x 的焦点到准线的距离为（　　）', options: ['A. 1', 'B. 2', 'C. 4', 'D. 8'], answer: 'B', explanation: 'p = 2，焦点(1,0)，准线 x=-1' }
        ],
        'MATH-003': [
          { content: '等差数列 {aₙ} 中，a₁ = 2，a₅ = 10，则公差 d =（　　）', options: ['A. 1', 'B. 2', 'C. 3', 'D. 4'], answer: 'B', explanation: 'd = (a₅ - a₁)/4 = 2' }
        ],
        'MATH-004': [
          { content: '随机变量 X 服从二项分布 B(6, 1/2)，则 P(X=3) =（　　）', options: ['A. 5/16', 'B. 3/8', 'C. 1/2', 'D. 15/32'], answer: 'A', explanation: 'P(X=3) = C(6,3)·(1/2)³·(1/2)³ = 5/16' }
        ],
        'MATH-009': [
          { content: '在△ABC中，a=2，b=√3，B=π/3，则A=（　　）', options: ['A. π/6', 'B. π/4', 'C. π/3', 'D. π/2'], answer: 'D', explanation: '由正弦定理 a/sinA = b/sinB，sinA = 1，A = π/2' }
        ],
        'MATH-006': [
          { content: '设集合A={x|x²-3x+2=0}，B={x|x²-2x=0}，则A∩B=（　　）', options: ['A. {0}', 'B. {2}', 'C. {0,2}', 'D. {1,2}'], answer: 'B', explanation: 'A={1,2}，B={0,2}，A∩B={2}' }
        ],
        'MATH-007': [
          { content: '已知向量a=(1,2)，b=(2,-1)，则a·b =（　　）', options: ['A. 0', 'B. 4', 'C. 5', 'D. -4'], answer: 'A', explanation: 'a·b = 1×2 + 2×(-1) = 0' }
        ],
        'MATH-010': [
          { content: '若正数x,y满足x+2y=1，则xy的最大值为（　　）', options: ['A. 1/8', 'B. 1/4', 'C. 1/2', 'D. 1'], answer: 'A', explanation: 'xy = x·2y/2 ≤ (x+2y)²/8 = 1/8' }
        ],
        'default': []
      },
      fill: {
        'MATH-001': [{ content: '函数 f(x) = x³ - 3x 的极大值为______', answer: '2', explanation: "f'(x)=3x²-3=0, x=-1时f(-1)=2" }],
        'MATH-003': [{ content: '等比数列{aₙ}中，a₁=1，公比q=2，则S₅=______', answer: '31', explanation: 'S₅ = 1(2⁵-1)/(2-1) = 31' }],
        'MATH-009': [{ content: 'sin75°的值为______', answer: '(√6+√2)/4', explanation: 'sin75° = sin(45°+30°) = (√6+√2)/4' }],
        'default': [{ content: '请计算______', answer: '略', explanation: '请根据知识点作答' }]
      },
      solution: {
        'MATH-001': [{ content: '已知函数f(x)=x³-3x²+4。(1)求f(x)的单调递减区间；(2)求f(x)在[-1,4]上的最大值和最小值。', answer: '(1)单调递减区间为(0,2)；(2)最大值f(4)=20，最小值f(0)=4', explanation: "f'(x)=3x²-6x=3x(x-2)，令f'(x)<0得0<x<2" }],
        'MATH-002': [{ content: '已知椭圆C: x²/a²+y²/b²=1(a>b>0)的离心率为√2/2，且过点(1,√2/2)。(1)求椭圆C的方程；(2)求过点P(0,1)的直线l与椭圆C交于A,B两点，求|AB|的最大值。', answer: '(1)x²/2+y²=1；(2)略', explanation: '由e=c/a=√2/2和过点条件联立' }],
        'default': [{ content: '请根据知识点完成解答题。', answer: '略', explanation: '请写出详细解题过程' }]
      }
    },
    'chinese': {
      selection: {
        'CHINESE-001': [
          { content: '阅读下面的文段，回答问题。（略）', options: ['A. 正确', 'B. 错误', 'C. 无法判断', 'D. 部分正确'], answer: 'A', explanation: '根据文本内容分析' }
        ],
        'CHINESE-005': [
          { content: '下列各句中，没有语病的一项是（　　）', options: ['A. 通过这次学习，使我受益匪浅', 'B. 能否坚持学习是取得进步的关键', 'C. 我们要养成勤于思考的习惯', 'D. 为了防止不再发生类似事故，我们加强了管理'], answer: 'C', explanation: 'A缺主语，B两面对一面，D否定不当' }
        ],
        'CHINESE-010': [
          { content: '下列加点词的解释，不正确的一项是（　　）', options: ['A. 乃重修岳阳楼（修建）', 'B. 微斯人，吾谁与归（没有）', 'C. 属予作文以记之（嘱托）', 'D. 前人之述备矣（准备）'], answer: 'D', explanation: '备：详尽' }
        ],
        'default': []
      },
      fill: {
        'CHINESE-006': [{ content: '补写出下列句子中的空缺部分：落霞与孤鹜齐飞，______。', answer: '秋水共长天一色', explanation: '王勃《滕王阁序》' }],
        'default': [{ content: '请默写相关名句。', answer: '略', explanation: '请根据记忆填写' }]
      },
      solution: {
        'CHINESE-003': [{ content: '阅读下面这首唐诗，完成后面的问题。（诗歌略）请分析这首诗的意境和表达技巧。', answer: '略', explanation: '从意象、手法、情感三方面分析' }],
        'default': [{ content: '请根据要求完成赏析。', answer: '略', explanation: '请写出详细分析' }]
      }
    },
    'english': {
      selection: {
        'ENGLISH-001': [
          { content: 'Read the following passage and answer the question...', options: ['A. Option A', 'B. Option B', 'C. Option C', 'D. Option D'], answer: 'C', explanation: 'Reading comprehension' }
        ],
        'ENGLISH-008': [
          { content: 'The book ____ I borrowed from the library is very interesting.', options: ['A. which', 'B. who', 'C. whom', 'D. what'], answer: 'A', explanation: '定语从句，先行词为物，用which' }
        ],
        'ENGLISH-011': [
          { content: 'If I ____ you, I would study harder.', options: ['A. am', 'B. was', 'C. were', 'D. be'], answer: 'C', explanation: '虚拟语气，与现在事实相反，用were' }
        ],
        'default': []
      },
      fill: {
        'ENGLISH-003': [{ content: 'She ____ (study) English for three years by the time she graduates.', answer: 'will have studied', explanation: '将来完成时' }],
        'default': [{ content: 'Please fill in the blank with the correct form.', answer: '略', explanation: 'Grammar exercise' }]
      },
      solution: {
        'ENGLISH-004': [{ content: 'Write an essay of about 100 words on the given topic.', answer: '略', explanation: 'Writing exercise' }],
        'default': [{ content: 'Please complete the writing task.', answer: '略', explanation: 'Writing exercise' }]
      }
    },
    'physics': {
      selection: {
        'PHYSICS-001': [
          { content: '一个物体受到三个共点力作用处于平衡状态，其中两个力的大小分别为3N和4N，则第三个力的大小为（　　）', options: ['A. 1N', 'B. 5N', 'C. 7N', 'D. 12N'], answer: 'B', explanation: '根据力的合成，第三个力为5N' }
        ],
        'PHYSICS-010': [
          { content: '一物体做匀加速直线运动，初速度为2m/s，加速度为1m/s²，则3s末的速度为（　　）', options: ['A. 3m/s', 'B. 5m/s', 'C. 6m/s', 'D. 8m/s'], answer: 'B', explanation: 'v = v₀ + at = 2 + 1×3 = 5m/s' }
        ],
        'PHYSICS-015': [
          { content: '在真空中，两个点电荷之间的距离增大为原来的2倍，则它们之间的库仑力变为原来的（　　）', options: ['A. 2倍', 'B. 1/2', 'C. 4倍', 'D. 1/4'], answer: 'D', explanation: 'F = kq₁q₂/r²，r变为2r，F变为1/4' }
        ],
        'default': []
      },
      fill: {
        'PHYSICS-003': [{ content: '质量为2kg的物体，速度由3m/s增大到5m/s，其动能增加了______J', answer: '16', explanation: 'ΔEk = ½mv₂² - ½mv₁² = 25-9 = 16J' }],
        'default': [{ content: '请计算物理量。', answer: '略', explanation: '请根据公式计算' }]
      },
      solution: {
        'PHYSICS-002': [{ content: '如图所示，一导体棒在磁场中运动...(略)求感应电动势的大小和方向。', answer: '略', explanation: '由法拉第电磁感应定律计算' }],
        'default': [{ content: '请完成物理计算题。', answer: '略', explanation: '请写出详细解题过程' }]
      }
    },
    'chemistry': {
      selection: {
        'CHEMISTRY-001': [
          { content: '在一定温度下的密闭容器中，反应 N₂ + 3H₂ ⇌ 2NH₃ 达到平衡，下列措施能提高 N₂ 转化率的是（　　）', options: ['A. 加入催化剂', 'B. 增大压强', 'C. 增加 N₂ 浓度', 'D. 降低温度'], answer: 'B', explanation: '增大压强平衡正向移动' }
        ],
        'CHEMISTRY-002': [
          { content: '下列反应中，属于氧化还原反应的是（　　）', options: ['A. CaCO₃→CaO+CO₂', 'B. 2H₂+O₂→2H₂O', 'C. NaOH+HCl→NaCl+H₂O', 'D. BaCl₂+Na₂SO₄→BaSO₄↓+2NaCl'], answer: 'B', explanation: '氢气燃烧有化合价变化' }
        ],
        'CHEMISTRY-010': [
          { content: '下列关于钠的叙述正确的是（　　）', options: ['A. 钠在空气中燃烧生成白色固体', 'B. 钠与水反应生成NaOH和H₂', 'C. 钠的密度大于水', 'D. 钠应保存在水中'], answer: 'B', explanation: '钠燃烧生成淡黄色Na₂O₂，密度小于水，应保存在煤油中' }
        ],
        'default': []
      },
      fill: {
        'CHEMISTRY-009': [{ content: '0.5mol H₂SO₄的质量为______g', answer: '49', explanation: 'M(H₂SO₄)=98g/mol，m=0.5×98=49g' }],
        'default': [{ content: '请计算化学量。', answer: '略', explanation: '请根据化学方程式计算' }]
      },
      solution: {
        'CHEMISTRY-003': [{ content: '某有机物A的分子式为C₂H₆O...(略)请推断A的结构简式并写出相关反应方程式。', answer: '略', explanation: '有机推断题' }],
        'default': [{ content: '请完成化学计算题。', answer: '略', explanation: '请写出详细解题过程' }]
      }
    },
    'politics': {
      selection: {
        'POLITICS-008': [
          { content: '价值规律的基本内容是（　　）', options: ['A. 商品的价值量由社会必要劳动时间决定', 'B. 商品交换以价值量为基础实行等价交换', 'C. 价格围绕价值上下波动', 'D. A和B都是'], answer: 'D', explanation: '价值规律包括商品价值决定和等价交换' }
        ],
        'POLITICS-017': [
          { content: '唯物辩证法的实质和核心是（　　）', options: ['A. 质量互变规律', 'B. 对立统一规律', 'C. 否定之否定规律', 'D. 联系的观点'], answer: 'B', explanation: '对立统一规律是唯物辩证法的实质和核心' }
        ],
        'default': []
      },
      fill: { 'default': [{ content: '请填写相关政治术语。', answer: '略', explanation: '请根据教材内容填写' }] },
      solution: { 'default': [{ content: '请运用所学知识分析材料。', answer: '略', explanation: '请结合材料分析' }] }
    },
    'biology': {
      selection: {
        'BIOLOGY-001': [
          { content: '下列关于细胞膜的叙述，不正确的是（　　）', options: ['A. 细胞膜具有选择透过性', 'B. 细胞膜的主要成分是磷脂分子和蛋白质', 'C. 细胞膜只由磷脂双分子层构成', 'D. 功能越复杂的细胞膜，蛋白质种类越多'], answer: 'C', explanation: '细胞膜还含有蛋白质、糖类等' }
        ],
        'BIOLOGY-005': [
          { content: '孟德尔分离定律的实质是（　　）', options: ['A. F₂出现3:1的性状分离比', 'B. F₁产生两种配子，比例为1:1', 'C. 等位基因随同源染色体分开而分离', 'D. 测交后代比例为1:1'], answer: 'C', explanation: '等位基因随同源染色体分离是分离定律的实质' }
        ],
        'default': []
      },
      fill: { 'default': [{ content: '请填写生物学名词。', answer: '略', explanation: '请根据教材内容填写' }] },
      solution: { 'default': [{ content: '请完成生物实验分析题。', answer: '略', explanation: '请写出详细分析过程' }] }
    },
    'history': {
      selection: {
        'HISTORY-001': [
          { content: '秦朝建立的中央集权制度的核心是（　　）', options: ['A. 皇帝制度', 'B. 三公九卿制', 'C. 郡县制', 'D. 丞相制度'], answer: 'A', explanation: '皇帝制度是中央集权的核心' }
        ],
        'default': []
      },
      fill: { 'default': [{ content: '请填写历史事件。', answer: '略', explanation: '请根据史实填写' }] },
      solution: { 'default': [{ content: '请分析历史材料。', answer: '略', explanation: '请结合史实分析' }] }
    },
    'geography': {
      selection: {
        'GEOGRAPHY-003': [
          { content: '影响气候的主要因素不包括（　　）', options: ['A. 纬度位置', 'B. 海陆位置', 'C. 地形地势', 'D. 人口密度'], answer: 'D', explanation: '人口密度不影响气候' }
        ],
        'default': []
      },
      fill: { 'default': [{ content: '请填写地理术语。', answer: '略', explanation: '请根据教材内容填写' }] },
      solution: { 'default': [{ content: '请分析地理现象。', answer: '略', explanation: '请结合地理原理分析' }] }
    }
  };

  return templates[subject] || { selection: { 'default': [] } };
}
