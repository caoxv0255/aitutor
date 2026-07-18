import { getDb } from '../core/db.js';
import { llm, MODELS } from '../../services/llm.js';
import { successResponse, errorResponse } from '../utils/response.js';

const PLAN_GENERATION_PROMPT = (subjectName, weakPoints, targetScore, hoursPerDay) => `你是一位专业的${subjectName}学科学习规划师。

请根据以下信息为学生制定个性化学习计划：

【薄弱知识点】
${weakPoints.map((p, i) => `${i + 1}. ${p.name} (掌握度: ${p.score}%)`).join('\n')}

【目标分数】${targetScore}分
【每日学习时间】${hoursPerDay}小时

请严格按照以下JSON格式返回（必须是有效的JSON，不要有多余的换行符和转义字符）：

{
  "plan_title": "学习计划标题",
  "duration": "计划时长（如：7天）",
  "total_hours": 预计总学习时长,
  "daily_tasks": [
    {
      "day": 1,
      "focus_knowledge_point": "当天重点知识点",
      "tasks": [
        {"type": "review", "content": "复习内容描述", "duration": 30},
        {"type": "practice", "content": "练习内容描述", "duration": 45},
        {"type": "summary", "content": "总结要求", "duration": 15}
      ],
      "total_duration": 90
    }
  ],
  "key_concepts": ["核心概念1", "核心概念2"],
  "practice_recommendations": ["推荐练习类型1", "推荐练习类型2"],
  "expected_outcome": "预期学习效果描述"
}

要求：
- daily_tasks至少包含5天的学习计划
- 优先安排薄弱知识点的复习和练习
- 任务内容具体可执行，包含预计时长（分钟）
- 每天总时长不超过${hoursPerDay * 60}分钟`;

const EXAM_GENERATION_PROMPT = (subjectName, weakPoints, questionCount) => `你是一位专业的${subjectName}学科命题专家。

请根据以下薄弱知识点生成一套模拟试卷：

【薄弱知识点】
${weakPoints.map((p, i) => `${i + 1}. ${p.name} (掌握度: ${p.score}%)`).join('\n')}

【题目数量】${questionCount}道

请严格按照以下JSON格式返回（必须是有效的JSON，不要有多余的换行符和转义字符）：

{
  "exam_title": "模拟试卷标题",
  "subject": "${subjectName}",
  "total_questions": ${questionCount},
  "total_score": 100,
  "questions": [
    {
      "id": 1,
      "type": "题目类型（选择题/填空题/解答题）",
      "knowledge_point": "考查知识点",
      "difficulty": 难度等级(1-5),
      "score": 分值,
      "content": "题目内容",
      "options": ["选项A", "选项B", "选项C", "选项D"],
      "answer": "正确答案",
      "analysis": "答案解析"
    }
  ]
}

要求：
- 题目覆盖所有薄弱知识点
- 难度分布合理（简单:中等:困难 = 3:5:2）
- 题目内容符合高中${subjectName}学科考试要求`;

export async function generateStudyPlan(req, res) {
  const { email } = req.user;
  const { subject_code, target_score, study_hours_per_day } = req.body;

  try {
    const pool = await getDb();

    const weakPointsResult = await pool.query(`
      SELECT kps.name, kp.mastery_score, kp.knowledge_point_id
      FROM student_knowledge_mastery kp
      LEFT JOIN knowledge_points kps ON kp.knowledge_point_id = kps.id
      WHERE kp.user_email = $1 AND kp.subject_code = $2 AND kp.mastery_score < 70
      ORDER BY kp.mastery_score ASC
      LIMIT 8
    `, [email, subject_code]);

    const profileResult = await pool.query(`
      SELECT target_score, study_hours_per_day FROM user_profiles WHERE user_email = $1
    `, [email]);

    const targetScore = target_score || profileResult.rows[0]?.target_score || 90;
    const hoursPerDay = study_hours_per_day || profileResult.rows[0]?.study_hours_per_day || 2;

    const subjectMap = {
      math: '数学', physics: '物理', chemistry: '化学', biology: '生物',
      chinese: '语文', english: '英语', history: '历史', geography: '地理', politics: '政治'
    };
    const subjectName = subjectMap[subject_code] || subject_code;

    const weakPoints = weakPointsResult.rows.map(r => ({
      name: r.name || '未知知识点',
      score: r.mastery_score,
      id: r.knowledge_point_id
    }));

    if (weakPoints.length === 0) {
      return res.json(successResponse({
        plan_title: `${subjectName}巩固计划`,
        duration: '3天',
        total_hours: 6,
        daily_tasks: [],
        key_concepts: [],
        practice_recommendations: ['保持复习频率，定期进行模拟测试'],
        expected_outcome: '保持现有知识水平，防止遗忘'
      }, '生成学习计划成功'));
    }

    const prompt = PLAN_GENERATION_PROMPT(subjectName, weakPoints, targetScore, hoursPerDay);
    const response = await llm.chat(prompt, {
      model: MODELS.QWEN_TURBO,
      temperature: 0.5,
      maxTokens: 3000
    });

    let planData;
    try {
      planData = JSON.parse(response.content);
    } catch {
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          planData = JSON.parse(jsonMatch[0]);
        } catch {
          planData = { plan_title: `${subjectName}学习计划`, duration: '7天' };
        }
      } else {
        planData = { plan_title: `${subjectName}学习计划`, duration: '7天' };
      }
    }

    await pool.query(`
      INSERT INTO learning_plans (user_email, subject_code, plan_title, plan_data, duration, status)
      VALUES ($1, $2, $3, $4, $5, 'active')
    `, [email, subject_code, planData.plan_title, JSON.stringify(planData), planData.duration]);

    return res.json(successResponse(planData, '生成学习计划成功'));
  } catch (error) {
    console.error('[StudyPlan] 生成学习计划失败:', error.message);
    return res.status(500).json(errorResponse('生成学习计划失败'));
  }
}

export async function generateMockExam(req, res) {
  const { email } = req.user;
  const { subject_code, question_count = 10 } = req.body;

  try {
    const pool = await getDb();

    const weakPointsResult = await pool.query(`
      SELECT kps.name, kp.mastery_score, kp.knowledge_point_id
      FROM student_knowledge_mastery kp
      LEFT JOIN knowledge_points kps ON kp.knowledge_point_id = kps.id
      WHERE kp.user_email = $1 AND kp.subject_code = $2 AND kp.mastery_score < 80
      ORDER BY kp.mastery_score ASC
      LIMIT 10
    `, [email, subject_code]);

    const subjectMap = {
      math: '数学', physics: '物理', chemistry: '化学', biology: '生物',
      chinese: '语文', english: '英语', history: '历史', geography: '地理', politics: '政治'
    };
    const subjectName = subjectMap[subject_code] || subject_code;

    const weakPoints = weakPointsResult.rows.map(r => ({
      name: r.name || '未知知识点',
      score: r.mastery_score,
      id: r.knowledge_point_id
    }));

    const prompt = EXAM_GENERATION_PROMPT(subjectName, weakPoints, question_count);
    const response = await llm.chat(prompt, {
      model: MODELS.QWEN_TURBO,
      temperature: 0.3,
      maxTokens: 4000
    });

    let examData;
    try {
      examData = JSON.parse(response.content);
    } catch {
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          examData = JSON.parse(jsonMatch[0]);
        } catch {
          examData = { exam_title: `${subjectName}模拟试卷`, subject: subjectName, questions: [] };
        }
      } else {
        examData = { exam_title: `${subjectName}模拟试卷`, subject: subjectName, questions: [] };
      }
    }

    return res.json(successResponse(examData, '生成模拟试卷成功'));
  } catch (error) {
    console.error('[StudyPlan] 生成模拟试卷失败:', error.message);
    return res.status(500).json(errorResponse('生成模拟试卷失败'));
  }
}

export async function getLearningPlans(req, res) {
  const { email } = req.user;
  const { subject_code, status } = req.query;

  try {
    const pool = await getDb();

    let query = 'SELECT * FROM learning_plans WHERE user_email = $1';
    const params = [email];
    let paramIdx = 2;

    if (subject_code) {
      query += ` AND subject_code = $${paramIdx++}`;
      params.push(subject_code);
    }

    if (status) {
      query += ` AND status = $${paramIdx++}`;
      params.push(status);
    }

    query += ' ORDER BY created_at DESC';

    const result = await pool.query(query, params);

    return res.json(successResponse({
      plans: result.rows.map(p => ({
        id: p.id,
        plan_title: p.plan_title,
        subject_code: p.subject_code,
        duration: p.duration,
        status: p.status,
        plan_data: p.plan_data ? JSON.parse(p.plan_data) : {},
        created_at: p.created_at,
        completed_tasks: p.completed_tasks || 0,
        total_tasks: p.total_tasks || 0
      }))
    }, '获取学习计划成功'));
  } catch (error) {
    console.error('[StudyPlan] 获取学习计划失败:', error.message);
    return res.status(500).json(errorResponse('获取学习计划失败'));
  }
}

export async function updateLearningPlan(req, res) {
  const { email } = req.user;
  const { id } = req.params;
  const { status, completed_tasks, total_tasks } = req.body;

  try {
    const pool = await getDb();

    let query = 'UPDATE learning_plans SET updated_at = NOW()';
    const params = [];
    let paramIdx = 1;

    if (status) {
      query += `, status = $${paramIdx++}`;
      params.push(status);
    }

    if (completed_tasks !== undefined) {
      query += `, completed_tasks = $${paramIdx++}`;
      params.push(completed_tasks);
    }

    if (total_tasks !== undefined) {
      query += `, total_tasks = $${paramIdx++}`;
      params.push(total_tasks);
    }

    query += ` WHERE id = $${paramIdx++} AND user_email = $${paramIdx}`;
    params.push(id, email);

    const result = await pool.query(query, params);

    if (result.rowCount === 0) {
      return res.status(404).json(errorResponse('学习计划不存在或无权访问'));
    }

    return res.json(successResponse({}, '更新学习计划成功'));
  } catch (error) {
    console.error('[StudyPlan] 更新学习计划失败:', error.message);
    return res.status(500).json(errorResponse('更新学习计划失败'));
  }
}

export async function deleteLearningPlan(req, res) {
  const { email } = req.user;
  const { id } = req.params;

  try {
    const pool = await getDb();

    const result = await pool.query(
      'DELETE FROM learning_plans WHERE id = $1 AND user_email = $2',
      [id, email]
    );

    if (result.rowCount === 0) {
      return res.status(404).json(errorResponse('学习计划不存在或无权访问'));
    }

    return res.json(successResponse({}, '删除学习计划成功'));
  } catch (error) {
    console.error('[StudyPlan] 删除学习计划失败:', error.message);
    return res.status(500).json(errorResponse('删除学习计划失败'));
  }
}

export async function getDailyTasks(req, res) {
  const { email } = req.user;

  try {
    const pool = await getDb();

    const today = new Date().toISOString().split('T')[0];

    const result = await pool.query(`
      SELECT * FROM learning_tasks 
      WHERE user_email = $1 AND scheduled_date = $2
      ORDER BY priority DESC
    `, [email, today]);

    return res.json(successResponse({
      tasks: result.rows.map(t => ({
        id: t.id,
        content: t.content,
        type: t.type,
        duration: t.duration,
        priority: t.priority,
        completed: t.completed,
        plan_id: t.plan_id,
        subject_code: t.subject_code,
        knowledge_point_id: t.knowledge_point_id
      }))
    }, '获取今日任务成功'));
  } catch (error) {
    console.error('[StudyPlan] 获取今日任务失败:', error.message);
    return res.status(500).json(errorResponse('获取今日任务失败'));
  }
}

export async function updateTaskStatus(req, res) {
  const { email } = req.user;
  const { id } = req.params;
  const { completed } = req.body;

  try {
    const pool = await getDb();

    const taskResult = await pool.query(
      'SELECT plan_id FROM learning_tasks WHERE id = $1 AND user_email = $2',
      [id, email]
    );

    if (taskResult.rowCount === 0) {
      return res.status(404).json(errorResponse('任务不存在或无权访问'));
    }

    const planId = taskResult.rows[0].plan_id;

    const now = new Date().toISOString();
    const result = await pool.query(
      'UPDATE learning_tasks SET completed = $1, completed_at = CASE WHEN $1 = true THEN NOW() ELSE NULL END, updated_at = NOW() WHERE id = $2 AND user_email = $3',
      [completed, id, email]
    );

    if (planId) {
      await updatePlanCompletionRate(pool, planId);
    }

    return res.json(successResponse({}, '更新任务状态成功'));
  } catch (error) {
    console.error('[StudyPlan] 更新任务状态失败:', error.message);
    return res.status(500).json(errorResponse('更新任务状态失败'));
  }
}

async function updatePlanCompletionRate(pool, planId) {
  const statsResult = await pool.query(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN completed = true THEN 1 ELSE 0 END) as completed
    FROM learning_tasks WHERE plan_id = $1
  `, [planId]);

  const { total, completed } = statsResult.rows[0];
  const completionRate = total > 0 ? (completed / total) * 100 : 0;

  await pool.query(`
    UPDATE learning_plans 
    SET completion_rate = $1, completed_tasks = $2, total_tasks = $3, updated_at = NOW()
    WHERE id = $4
  `, [completionRate, completed, total, planId]);
}

export async function getPlanStats(req, res) {
  const { email } = req.user;

  try {
    const pool = await getDb();

    const planStatsResult = await pool.query(`
      SELECT 
        COUNT(*) as total_plans,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_plans,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_plans,
        AVG(completion_rate) as avg_completion_rate
      FROM learning_plans WHERE user_email = $1
    `, [email]);

    const taskStatsResult = await pool.query(`
      SELECT 
        COUNT(*) as total_tasks,
        SUM(CASE WHEN completed = true THEN 1 ELSE 0 END) as completed_tasks,
        SUM(CASE WHEN scheduled_date <= NOW() THEN 1 ELSE 0 END) as overdue_tasks
      FROM learning_tasks WHERE user_email = $1
    `, [email]);

    const weeklyStatsResult = await pool.query(`
      SELECT 
        DATE_TRUNC('week', completed_at) as week,
        COUNT(*) as completed_count
      FROM learning_tasks 
      WHERE user_email = $1 AND completed = true AND completed_at >= NOW() - INTERVAL '8 weeks'
      GROUP BY DATE_TRUNC('week', completed_at)
      ORDER BY week
    `, [email]);

    const planStats = planStatsResult.rows[0];
    const taskStats = taskStatsResult.rows[0];

    const weeklyProgress = weeklyStatsResult.rows.map(r => ({
      week: r.week.toISOString().split('T')[0],
      completed_count: r.completed_count
    }));

    const avgCompletionRate = parseFloat(planStats.avg_completion_rate || 0).toFixed(1);
    const taskCompletionRate = taskStats.total_tasks > 0 
      ? ((taskStats.completed_tasks / taskStats.total_tasks) * 100).toFixed(1)
      : '0.0';

    let learningEffect = '需努力';
    let effectScore = 0;
    if (parseFloat(taskCompletionRate) >= 80) {
      learningEffect = '优秀';
      effectScore = 90;
    } else if (parseFloat(taskCompletionRate) >= 60) {
      learningEffect = '良好';
      effectScore = 70;
    } else if (parseFloat(taskCompletionRate) >= 40) {
      learningEffect = '一般';
      effectScore = 50;
    }

    return res.json(successResponse({
      plans: {
        total: planStats.total_plans,
        completed: planStats.completed_plans,
        active: planStats.active_plans,
        avg_completion_rate: avgCompletionRate
      },
      tasks: {
        total: taskStats.total_tasks,
        completed: taskStats.completed_tasks,
        overdue: taskStats.overdue_tasks,
        completion_rate: taskCompletionRate
      },
      weekly_progress: weeklyProgress,
      learning_effect: {
        level: learningEffect,
        score: effectScore,
        description: generateEffectDescription(effectScore)
      }
    }, '获取学习计划统计成功'));
  } catch (error) {
    console.error('[StudyPlan] 获取学习计划统计失败:', error.message);
    return res.status(500).json(errorResponse('获取学习计划统计失败'));
  }
}

function generateEffectDescription(score) {
  if (score >= 90) {
    return '学习积极性高，任务完成率优秀，继续保持！';
  } else if (score >= 70) {
    return '学习状态良好，任务完成率较高，建议适当增加学习强度。';
  } else if (score >= 50) {
    return '学习状态一般，任务完成率有待提高，建议制定更合理的学习计划。';
  } else {
    return '学习积极性较低，任务完成率不足，建议调整学习方法和时间安排。';
  }
}
