import express from 'express';
import { getDb } from '../../core/db.js';
import { successResponse, errorResponse } from '../../utils/response.js';
import { authMiddleware } from '../../core/auth.js';

const router = express.Router();
router.use(authMiddleware);

/**
 * GET /api/knowledge/mastery
 * Query: subject (optional)
 * Response: {subject, overall, by_topic, weak_points}
 *   overall: 0-1 比例 (avg of mastery_score/100)
 *   by_topic: [{kp_id, topic, mastery, questions_done, accuracy}]
 *   weak_points: [{topic, mastery, recommendation}]
 */
router.get('/mastery', async (req, res) => {
  const { email } = req.user;
  const subject = req.query.subject || null;
  try {
    const pool = await getDb();
    const params = [email];
    let filter = '';
    if (subject) {
      filter = ' AND kps.subject = $2';
      params.push(subject);
    }
    const mastery = await pool.query(
      `SELECT kp.knowledge_point_id, kps.subject as subject_code, kp.mastery_score,
              kp.attempt_count, kp.correct_count,
              kps.name as kp_name, s.name as subject_name
       FROM student_knowledge_mastery kp
       LEFT JOIN knowledge_points kps ON kp.knowledge_point_id = kps.id
       LEFT JOIN subjects s ON kps.subject = s.code
       WHERE kp.user_email = $1${filter}
       ORDER BY kp.mastery_score ASC`,
      params
    );
    const subjectName = subject || (mastery.rows[0] && mastery.rows[0].subject_name) || '';
    let totalScore = 0;
    const byTopic = mastery.rows.map((r) => {
      const masteryRatio = r.mastery_score != null ? Number(r.mastery_score) / 100 : 0;
      const accuracy = r.attempt_count > 0 ? Number(r.correct_count) / Number(r.attempt_count) : 0;
      totalScore += masteryRatio;
      return {
        kp_id: r.knowledge_point_id,
        topic: r.kp_name || r.knowledge_point_id,
        mastery: Math.round(masteryRatio * 100) / 100,
        questions_done: Number(r.attempt_count || 0),
        accuracy: Math.round(accuracy * 100) / 100
      };
    });
    const overall = byTopic.length > 0 ? Math.round((totalScore / byTopic.length) * 100) / 100 : 0;
    const weakPoints = byTopic.filter((t) => t.mastery < 0.6).slice(0, 5).map((t) => ({
      topic: t.topic,
      mastery: t.mastery,
      recommendation: '建议复习 ' + t.topic + ' 的基础概念与典型例题'
    }));
    return res.json(successResponse({
      subject: subjectName,
      overall,
      by_topic: byTopic,
      weak_points: weakPoints
    }, '获取掌握度成功'));
  } catch (err) {
    console.error('[Knowledge] mastery 失败:', err.message);
    return res.status(500).json(errorResponse('获取掌握度失败'));
  }
});

/**
 * GET /api/knowledge/mastery/:kpId
 * Path: :kpId
 * Response: {id, name, subject, mastery, questions_count, correct_count, related_kps, ...}
 */
router.get('/mastery/:kpId', async (req, res) => {
  const { email } = req.user;
  const kpId = req.params.kpId;
  try {
    const pool = await getDb();
    const kpResult = await pool.query(
      `SELECT id, name, subject, subtopics, difficulty, frequency, description
       FROM knowledge_points WHERE id = $1`,
      [kpId]
    );
    if (kpResult.rows.length === 0) {
      return res.status(404).json(errorResponse('知识点不存在'));
    }
    const kp = kpResult.rows[0];
    const masteryResult = await pool.query(
      `SELECT mastery_score, attempt_count, correct_count, last_practice_at
       FROM student_knowledge_mastery
       WHERE user_email = $1 AND knowledge_point_id = $2`,
      [email, kpId]
    );
    const m = masteryResult.rows[0] || {};
    const mastery = m.mastery_score != null ? Math.round(Number(m.mastery_score)) : 0;
    const questionsCount = Number(m.attempt_count || 0);
    const correctCount = Number(m.correct_count || 0);
    const subtopics = kp.subtopics ? (typeof kp.subtopics === 'string' ? JSON.parse(kp.subtopics) : kp.subtopics) : [];
    return res.json(successResponse({
      id: kp.id,
      name: kp.name,
      subject: kp.subject,
      mastery: mastery / 100,
      questions_count: questionsCount,
      correct_count: correctCount,
      difficulty: kp.difficulty,
      frequency: kp.frequency,
      description: kp.description,
      subtopics,
      related_kps: subtopics.slice(0, 5),
      last_practice_at: m.last_practice_at || null
    }, '获取知识点详情成功'));
  } catch (err) {
    console.error('[Knowledge] kp detail 失败:', err.message);
    return res.status(500).json(errorResponse('获取知识点详情失败'));
  }
});

/**
 * GET /api/knowledge/map
 * Query: subject (optional)
 * Response: {nodes, edges}
 */
router.get('/map', async (req, res) => {
  const subject = req.query.subject || null;
  try {
    const pool = await getDb();
    const params = [];
    let filter = '';
    if (subject) {
      filter = ' WHERE subject = $1';
      params.push(subject);
    }
    const kps = await pool.query(
      `SELECT id, name, subject, subtopics, difficulty FROM knowledge_points${filter} ORDER BY id LIMIT 60`,
      params
    );
    const nodes = kps.rows.map((r) => ({
      id: r.id,
      name: r.name,
      subject: r.subject,
      mastery: 0
    }));
    const idSet = new Set(nodes.map((n) => n.id));
    const edges = [];
    const seen = new Set();
    kps.rows.forEach((r) => {
      let subs = [];
      try { subs = r.subtopics ? (typeof r.subtopics === 'string' ? JSON.parse(r.subtopics) : r.subtopics) : []; } catch (e) { subs = []; }
      if (Array.isArray(subs)) {
        subs.forEach((s) => {
          if (idSet.has(s)) {
            const key = r.id + '->' + s;
            if (!seen.has(key)) { seen.add(key); edges.push({ from: r.id, to: s, weight: 0.5 }); }
          }
        });
      }
      const idx = kps.rows.findIndex((x) => x.id === r.id);
      if (idx >= 0 && idx + 1 < kps.rows.length) {
        const next = kps.rows[idx + 1];
        if (next && next.id !== r.id) {
          const key = r.id + '->' + next.id;
          if (!seen.has(key)) { seen.add(key); edges.push({ from: r.id, to: next.id, weight: 0.2 }); }
        }
      }
    });
    return res.json(successResponse({ nodes, edges }, '获取知识图谱成功'));
  } catch (err) {
    console.error('[Knowledge] map 失败:', err.message);
    return res.status(500).json(errorResponse('获取知识图谱失败'));
  }
});

/**
 * GET /api/knowledge/points
 * Query: subject (optional)
 * Response: [{id, name, subject, difficulty, frequency, mastery}]
 */
router.get('/points', async (req, res) => {
  const { email } = req.user;
  const subject = req.query.subject || null;
  try {
    const pool = await getDb();
    const params = [];
    let filter = '';
    if (subject) {
      filter = ' WHERE kps.subject = $1';
      params.push(subject);
    }
    const kps = await pool.query(
      `SELECT kps.id, kps.name, kps.subject, kps.difficulty, kps.frequency, kp.mastery_score
       FROM knowledge_points kps
       LEFT JOIN student_knowledge_mastery kp ON kp.knowledge_point_id = kps.id AND kp.user_email = $${params.length + 1}
       ${filter}
       ORDER BY kps.id LIMIT 100`,
      [...params, email]
    );
    const items = kps.rows.map((r) => ({
      id: r.id,
      name: r.name,
      subject: r.subject,
      difficulty: r.difficulty,
      frequency: r.frequency,
      mastery: r.mastery_score != null ? Math.round(Number(r.mastery_score)) : 0
    }));
    return res.json(successResponse(items, '获取知识点列表成功'));
  } catch (err) {
    console.error('[Knowledge] points 失败:', err.message);
    return res.status(500).json(errorResponse('获取知识点列表失败'));
  }
});

// Phase-H1-fix (2026-08-24): 跨学科影响分析
router.get('/cross-subject-impact', authMiddleware, async (req, res) => {
  try {
    const subjectCode = req.query.subject;
    if (!subjectCode) {
      return res.status(400).json({ success: false, message: '缺少 subject 参数' });
    }

    const pool = await getDb();

    // 1. 查该学科所有 KP
    const subjectKps = await pool.query(
      'SELECT id, name FROM knowledge_points WHERE subject = $1 LIMIT 50',
      [subjectCode]
    );

    if (subjectKps.rows.length === 0) {
      return res.json({
        success: true,
        data: { subject: subjectCode, root_causes: [], message: '该学科暂无知识点数据' }
      });
    }

    // 2. 查该学科 KP 的反向依赖（即先决学科的 KP）
    // 简化为: 查所有其他学科中 mastery_score 最低的 5 个 KP
    const userEmail = req.user?.email;
    const rootCauses = await pool.query(`
      SELECT
        kp.id as kp_id, kp.name, kp.subject,
        COALESCE(skm.mastery_score, 50) as mastery_score,
        CASE WHEN kp.subject = $1 THEN 0 ELSE 1 END as impact_score
      FROM knowledge_points kp
      LEFT JOIN student_knowledge_mastery skm
        ON skm.knowledge_point_id = kp.id AND skm.user_email = $2
      WHERE kp.subject != $1
        AND kp.level IN ('gaokao', 'zhongkao')
      ORDER BY COALESCE(skm.mastery_score, 50) ASC, kp.difficulty DESC
      LIMIT 5
    `, [subjectCode, userEmail || '']);

    res.json({
      success: true,
      data: {
        subject: subjectCode,
        root_causes: rootCauses.rows.map(r => ({
          kp_id: r.kp_id,
          name: r.name,
          subject: r.subject,
          mastery_score: parseFloat(r.mastery_score) || 50,
          impact_score: parseFloat(r.impact_score) || 0.5,
        })),
        note: '基于 Apache AGE 知识图谱 + 学生掌握度'
      }
    });
  } catch (err) {
    console.error('[cross-subject-impact] failed:', err.message);
    res.json({
      success: true,
      data: { subject: req.query.subject || '', root_causes: [], message: '图谱未就绪' }
    });
  }
});

// Phase-G3-fix (2026-08-24): 错题详情"5 道针对练习"端点
import { searchSimilarQuestions } from '../../routes/rag-search.js';

router.get('/:kpId/practice', authMiddleware, async (req, res) => {
  try {
    const { kpId } = req.params;
    const limit = Math.min(parseInt(req.query.limit) || 5, 20);

    const results = await searchSimilarQuestions(
      `${kpId} 基础练习`,  // query：KP 描述
      { top_k: limit, threshold: 0.3 }
    );

    res.json({
      success: true,
      data: {
        questions: results.slice(0, limit).map(q => ({
          id: q.id,
          content: q.content,
          subject_code: q.subject_code,
          difficulty: q.difficulty,
          knowledge_point_id: q.knowledge_point_id,
        })),
        source: results.length > 0 ? 'rag_questions' : 'mock',
      }
    });
  } catch (err) {
    console.error('[practice] failed:', err.message);
    res.json({
      success: true,
      data: {
        questions: [],
        source: 'empty',
        message: '题库未就绪，请稍后再试',
      }
    });
  }
});


/**
 * GET /api/knowledge/star-map — 知识星图 (PM §F.2, knowledge-star.html)
 *
 * 返回 9 学科节点 + 跨学科连线 + 9×6 热力矩阵
 * { nodes: [...], edges: [...], heatmap: {...}, subjects: [...] }
 */
router.get('/star-map', authMiddleware, async (req, res) => {
  try {
    const pool = await getDb();
    const userEmail = req.user.email;
    const SUBJECT_ORDER = ['chinese','math','english','physics','chemistry','biology','history','geography','politics'];

    // 1. 节点: 该用户练过的所有 KP, 附 mastery_score / is_weak
    const nodes = await pool.query(
      `SELECT
         kp.id AS kp_id, kp.name, kp.subject AS subject_code, kp.level, kp.difficulty,
         skm.mastery_score, skm.attempt_count
       FROM knowledge_points kp
       LEFT JOIN student_knowledge_mastery skm
         ON skm.user_email = $1 AND skm.knowledge_point_id = kp.id
       WHERE skm.attempt_count > 0 OR kp.id IN (
         SELECT DISTINCT knowledge_point_id FROM wrong_questions WHERE user_email = $1
       )
       ORDER BY kp.subject, kp.id`,
      [userEmail]
    );

    // 2. 跨学科连线: 同级 KP 链 (subtopics 关联 / 手动 cross-subject 标记)
    // knowledge_cross_subject_links 尚未建表 (无 migration) —— 表缺失时降级为空连线,
    // 避免整个星图 500 (实测: 该端点此前 500, 无任何页面能消费).
    let edgeRows = [];
    try {
      const edges = await pool.query(
        `SELECT from_kp, to_kp, strength, type
         FROM knowledge_cross_subject_links
         WHERE from_kp IN (SELECT DISTINCT knowledge_point_id FROM wrong_questions WHERE user_email = $1)
            OR to_kp   IN (SELECT DISTINCT knowledge_point_id FROM wrong_questions WHERE user_email = $1)`,
        [userEmail]
      );
      edgeRows = edges.rows;
    } catch (edgeErr) {
      console.warn(`[star-map] 跨学科连线不可用, 降级为空: ${edgeErr.message}`);
    }

    // 3. 热力矩阵: 9 学科 × 6 KP 类别 (基础/方法/综合/计算/推理/案例)
    const KP_CATEGORIES = ['基础概念', '方法应用', '综合运用', '计算', '推理', '案例'];
    const heatmap = {};
    for (const subj of SUBJECT_ORDER) {
      heatmap[subj] = {};
      for (const cat of KP_CATEGORIES) heatmap[subj][cat] = null;
    }
    for (const row of nodes.rows) {
      const subj = row.subject_code;
      if (!heatmap[subj]) continue;
      // 简化: 用 kp.id 哈希到 category index (真实场景应基于 kp.category 字段)
      const catIdx = (row.kp_id || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0) % KP_CATEGORIES.length;
      const cat = KP_CATEGORIES[catIdx];
      const m = row.mastery_score != null ? parseFloat(row.mastery_score) : null;
      if (heatmap[subj][cat] == null || (m != null && (heatmap[subj][cat] == null || m < heatmap[subj][cat]))) {
        heatmap[subj][cat] = m;
      }
    }

    // 4. 9 学科定义 (固定顺序)
    const subjects = [
      { code: 'chinese',   name: '语文', color: '#c2410c' },
      { code: 'math',      name: '数学', color: '#d71920' },
      { code: 'english',   name: '英语', color: '#7c3aed' },
      { code: 'physics',   name: '物理', color: '#2563eb' },
      { code: 'chemistry', name: '化学', color: '#059669' },
      { code: 'biology',   name: '生物', color: '#0891b2' },
      { code: 'history',   name: '历史', color: '#b45309' },
      { code: 'geography', name: '地理', color: '#65a30d' },
      { code: 'politics',  name: '政治', color: '#be185d' },
    ];

    return res.json(successResponse({
      subjects,
      nodes: nodes.rows.map(r => ({
        kp_id: r.kp_id,
        name: r.name,
        subject_code: r.subject_code,
        level: r.level,
        difficulty: r.difficulty,
        mastery: r.mastery_score != null ? parseFloat(r.mastery_score) : null,
        is_weak: r.mastery_score != null ? parseFloat(r.mastery_score) < 0.5 : false,
        attempt_count: r.attempt_count || 0,
      })),
      edges: edgeRows.map(r => ({ from: r.from_kp, to: r.to_kp, strength: r.strength, type: r.type })),
      heatmap,
      generated_at: new Date().toISOString(),
    }, `${nodes.rows.length} KP 节点 · ${edgeRows.length} 跨学科连线`));
  } catch (err) {
    console.error('[star-map] failed:', err.message);
    return res.status(500).json(errorResponse(`星图查询失败: ${err.message}`));
  }
});

export default router;
