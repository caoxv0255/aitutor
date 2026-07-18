import { getDb } from '../core/db.js';
import { llm, MODELS } from '../../services/llm.js';
import { logger } from '../core/logger.js';

const LEARNING_PATH_PROMPT = (subjectName, kpData, weakPoints, masteryData) => `你是一位专业的${subjectName}学科学习规划师和知识图谱专家。

请根据以下知识图谱和学生掌握度数据，为学生生成个性化的动态学习路径：

【知识点数据】
${kpData}

【薄弱知识点】
${weakPoints.length > 0 ? weakPoints.join('\n') : '无'}

【当前掌握度】
${masteryData}

请严格按照以下JSON格式返回（必须是有效的JSON，不要有多余的换行符和转义字符）：

{
  "plan_title": "学习路径标题",
  "total_duration": "总时长",
  "learning_goals": ["目标1", "目标2", "目标3"],
  "path_segments": [
    {
      "segment_number": 阶段序号(1开始),
      "duration": "阶段时长",
      "focus_knowledge_points": ["知识点1", "知识点2"],
      "prerequisites": ["前置知识点1", "前置知识点2"],
      "tasks": [
        {
          "type": "task类型（如：review/practice/exercise/summary）",
          "content": "任务描述",
          "duration_minutes": 预计时长(分钟),
          "resources": ["资源1", "资源2"],
          "mastery_target": 目标掌握度(0-100)
        }
      ],
      "assessment": {
        "type": "评估方式",
        "description": "评估说明",
        "pass_criteria": "通过标准"
      },
      "estimated_progress": 预计进度(0-100)
    }
  ],
  "recommended_practice": [
    {
      "knowledge_point": "知识点名称",
      "question_count": 推荐练习数,
      "difficulty_range": "难度范围",
      "practice_type": "练习类型"
    }
  ],
  "knowledge_graph_insights": {
    "key_prerequisites": ["关键前置知识点"],
    "knowledge_gaps": ["知识缺口"],
    "optimal_order": ["最佳学习顺序"]
  },
  "milestones": [
    {
      "name": "里程碑名称",
      "description": "里程碑描述",
      "achievement_condition": "达成条件"
    }
  ]
}

要求：
- path_segments至少包含3个阶段
- 优先安排薄弱知识点的学习
- 考虑知识图谱的先决关系（必须先学前置知识）
- tasks必须具体可执行
- recommended_practice必须针对薄弱点
- 所有字段必须填写完整`;

const KNOWLEDGE_GRAPH_RELATIONS = {
  math: {
    '函数': ['集合与常用逻辑用语'],
    '导数': ['函数', '极限'],
    '积分': ['导数', '极限'],
    '三角函数': ['函数', '三角恒等变换'],
    '数列': ['函数'],
    '立体几何': ['空间向量', '平面几何'],
    '解析几何': ['直线与圆', '圆锥曲线'],
    '概率统计': ['排列组合'],
    '不等式': ['函数'],
    '向量': ['三角函数'],
    '矩阵': ['向量'],
    '复数': ['代数运算'],
    '极限': ['函数']
  },
  physics: {
    '力学': ['运动学'],
    '电磁学': ['力学', '静电场'],
    '热学': ['分子动理论'],
    '光学': ['波动'],
    '原子物理': ['电磁学'],
    '波动': ['运动学'],
    '动量': ['力学'],
    '能量': ['力学', '动量'],
    '静电场': ['力学'],
    '恒定电流': ['静电场'],
    '磁场': ['恒定电流']
  },
  chemistry: {
    '物质结构': ['原子结构'],
    '化学反应原理': ['化学平衡'],
    '有机化学': ['烃类'],
    '无机化学': ['元素周期律'],
    '化学平衡': ['化学反应速率'],
    '电化学': ['氧化还原反应'],
    '溶液': ['化学平衡']
  },
  biology: {
    '细胞': ['生物大分子'],
    '遗传': ['细胞分裂'],
    '代谢': ['细胞'],
    '生态': ['种群'],
    '调节': ['细胞']
  },
  english: {
    '词汇': [],
    '语法': ['词汇'],
    '阅读': ['词汇', '语法'],
    '写作': ['词汇', '语法'],
    '听力': ['词汇']
  },
  chinese: {
    '文言文': ['实词虚词'],
    '现代文': ['阅读理解'],
    '写作': ['素材积累'],
    '诗词': ['文言文']
  },
  history: {
    '古代史': [],
    '近代史': ['古代史'],
    '现代史': ['近代史'],
    '世界史': ['古代史']
  },
  geography: {
    '自然地理': ['地球运动'],
    '人文地理': ['自然地理'],
    '区域地理': ['自然地理', '人文地理']
  },
  politics: {
    '经济': [],
    '政治': [],
    '哲学': ['政治'],
    '法治': ['政治']
  }
};

export class LearningPathService {
  static async generateLearningPath(email, subject, targetMastery = 80) {
    const pool = await getDb();
    
    const [masteryResult, kpResult, wrongResult] = await Promise.all([
      pool.query(`
        SELECT skm.*, kp.name as kp_name, kp.difficulty as kp_difficulty, kp.subtopics
        FROM student_knowledge_mastery skm
        LEFT JOIN knowledge_points kp ON skm.knowledge_point_id = kp.id
        WHERE skm.user_email = $1 AND kp.subject = $2
        ORDER BY skm.mastery_score ASC
      `, [email, subject]),
      pool.query(`
        SELECT id, name, difficulty, frequency, description, subtopics, module
        FROM knowledge_points 
        WHERE subject = $1 
        ORDER BY frequency DESC
      `, [subject]),
      pool.query(`
        SELECT knowledge_point_id, COUNT(*) as error_count
        FROM wrong_questions 
        WHERE user_email = $1 AND subject_code = $2
        GROUP BY knowledge_point_id
        ORDER BY error_count DESC
        LIMIT 10
      `, [email, subject])
    ]);
    
    const masteryData = masteryResult.rows;
    const allKP = kpResult.rows;
    const wrongKP = wrongResult.rows;
    
    const weakPoints = masteryData.filter(m => (m.mastery_score || 0) < targetMastery);
    const completedPoints = masteryData.filter(m => (m.mastery_score || 0) >= targetMastery);
    
    const prereqMap = KNOWLEDGE_GRAPH_RELATIONS[subject] || {};
    
    const sortedKP = this.topologicalSort(allKP, prereqMap, masteryData);
    
    const kpSummary = sortedKP.map(kp => {
      const mastery = masteryData.find(m => m.knowledge_point_id === kp.id);
      const errors = wrongKP.find(w => w.knowledge_point_id === kp.id);
      return `- ${kp.name} (难度${kp.difficulty}, 频率${kp.frequency}, 掌握度${mastery ? Math.round(mastery.mastery_score || 0) : 0}%, 错题${errors ? errors.error_count : 0}次)`;
    }).join('\n');
    
    const weakPointNames = weakPoints.map(m => `- ${m.kp_name}: 掌握度${Math.round(m.mastery_score || 0)}%`);
    
    const masterySummary = completedPoints.map(m => `${m.kp_name}: ${Math.round(m.mastery_score || 0)}%`).join(', ') || '无';
    
    const subjectMap = {
      math: '数学', physics: '物理', chemistry: '化学',
      biology: '生物', chinese: '语文', english: '英语',
      history: '历史', geography: '地理', politics: '政治'
    };
    const subjectName = subjectMap[subject] || subject;
    
    const prompt = LEARNING_PATH_PROMPT(subjectName, kpSummary, weakPointNames, masterySummary);
    
    try {
      const response = await llm.chat(prompt, {
        model: MODELS.QWEN_PLUS,
        temperature: 0.4,
        maxTokens: 4000,
        feature: 'learning_path'
      });
      
      const path = JSON.parse(response.content);
      
      path.generated_at = new Date().toISOString();
      path.subject = subject;
      path.user_email = email;
      path.weak_points_count = weakPoints.length;
      path.completed_points_count = completedPoints.length;
      
      await this.saveLearningPath(pool, email, subject, path);
      
      return {
        success: true,
        path,
        cost: response.cost,
        tokens: response.usage?.total_tokens || 0
      };
    } catch (error) {
      logger.error(`[LearningPath] 生成学习路径失败: ${error.message}`);
      return {
        success: false,
        message: `生成学习路径失败: ${error.message}`
      };
    }
  }
  
  static topologicalSort(kpList, prereqMap, masteryData) {
    const inDegree = new Map();
    const adjList = new Map();
    
    kpList.forEach(kp => {
      inDegree.set(kp.name, 0);
      adjList.set(kp.name, []);
    });
    
    for (const [kpName, prereqs] of Object.entries(prereqMap)) {
      prereqs.forEach(prereq => {
        if (adjList.has(prereq)) {
          adjList.get(prereq).push(kpName);
          inDegree.set(kpName, (inDegree.get(kpName) || 0) + 1);
        }
      });
    }
    
    const queue = [];
    const result = [];
    
    for (const [name, degree] of inDegree) {
      if (degree === 0) {
        queue.push(name);
      }
    }
    
    while (queue.length > 0) {
      const current = queue.shift();
      
      const currentKP = kpList.find(kp => kp.name === current);
      if (currentKP) {
        const mastery = masteryData.find(m => m.knowledge_point_id === currentKP.id);
        const masteryScore = mastery ? (mastery.mastery_score || 0) : 0;
        
        const insertIndex = result.findIndex(kp => {
          const kpMastery = masteryData.find(m => m.knowledge_point_id === kp.id);
          return (kpMastery ? (kpMastery.mastery_score || 0) : 0) > masteryScore;
        });
        
        if (insertIndex === -1) {
          result.push(currentKP);
        } else {
          result.splice(insertIndex, 0, currentKP);
        }
      }
      
      adjList.get(current)?.forEach(neighbor => {
        inDegree.set(neighbor, inDegree.get(neighbor) - 1);
        if (inDegree.get(neighbor) === 0) {
          queue.push(neighbor);
        }
      });
    }
    
    const remaining = kpList.filter(kp => !result.includes(kp));
    remaining.forEach(kp => {
      const mastery = masteryData.find(m => m.knowledge_point_id === kp.id);
      const masteryScore = mastery ? (mastery.mastery_score || 0) : 0;
      
      const insertIndex = result.findIndex(kp2 => {
        const kpMastery = masteryData.find(m => m.knowledge_point_id === kp2.id);
        return (kpMastery ? (kpMastery.mastery_score || 0) : 0) > masteryScore;
      });
      
      if (insertIndex === -1) {
        result.push(kp);
      } else {
        result.splice(insertIndex, 0, kp);
      }
    });
    
    return result;
  }
  
  static async saveLearningPath(pool, email, subject, path) {
    try {
      await pool.query(
        'INSERT INTO learning_paths (user_email, subject, data, created_at) VALUES ($1, $2, $3, NOW())',
        [email, subject, JSON.stringify(path)]
      );
    } catch (error) {
      logger.warn(`[LearningPath] 保存学习路径失败: ${error.message}`);
    }
  }
  
  static async getHistoryPaths(pool, email, subject, limit = 5) {
    const result = await pool.query(`
      SELECT * FROM learning_paths 
      WHERE user_email = $1 AND subject = $2 
      ORDER BY created_at DESC LIMIT $3
    `, [email, subject, limit]);
    
    return result.rows.map(r => ({
      ...r,
      data: JSON.parse(r.data)
    }));
  }
  
  static async getRecommendations(email, subject, limit = 5) {
    const pool = await getDb();
    
    const masteryResult = await pool.query(`
      SELECT skm.*, kp.name as kp_name
      FROM student_knowledge_mastery skm
      LEFT JOIN knowledge_points kp ON skm.knowledge_point_id = kp.id
      WHERE skm.user_email = $1 AND kp.subject = $2
      ORDER BY skm.mastery_score ASC
      LIMIT $3
    `, [email, subject, limit]);
    
    const weakPoints = masteryResult.rows;
    const prereqMap = KNOWLEDGE_GRAPH_RELATIONS[subject] || {};
    
    const recommendations = weakPoints.map(kp => {
      const prereqs = prereqMap[kp.kp_name] || [];
      return {
        knowledge_point_id: kp.knowledge_point_id,
        name: kp.kp_name,
        current_mastery: Math.round(kp.mastery_score || 0),
        prerequisites: prereqs,
        recommendation_type: 'priority',
        estimated_time_hours: Math.ceil((80 - (kp.mastery_score || 0)) / 20 * 3)
      };
    });
    
    return { success: true, recommendations };
  }
}

export { LEARNING_PATH_PROMPT, KNOWLEDGE_GRAPH_RELATIONS };