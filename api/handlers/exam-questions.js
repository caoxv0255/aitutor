import { getDb } from '../core/db.js';
import { errorResponse, successResponse } from '../utils/response.js';

export async function getExamQuestions(req, res) {
  const pool = await getDb();
  const { paperId } = req.params;
  const { type, difficulty, knowledge_point, v2_kp, limit = 100, offset = 0 } = req.query;

  const SUBJECT_MAP = {
    'chinese': '语文',
    'math': '数学',
    'english': '英语',
    'physics': '物理',
    'chemistry': '化学',
    'biology': '生物',
    'politics': '政治',
    'history': '历史',
    'geography': '地理',
    'science': '理综',
    'liberal_arts': '文综',
    'comprehensive': '综合'
  };

  try {
    const paperResult = await pool.query('SELECT * FROM exam_papers WHERE id = $1', [paperId]);

    if (paperResult.rows.length === 0) {
      return res.status(404).json(errorResponse('试卷不存在'));
    }

    const paper = paperResult.rows[0];
    paper.title = `${paper.year}年${SUBJECT_MAP[paper.subject] || paper.subject}试卷`;
    paper.name = paper.title;

    let query = `
      SELECT
        eq.*,
        p.name as province_name
      FROM exam_questions eq
      JOIN exam_papers ep ON eq.paper_id = ep.id
      LEFT JOIN provinces p ON ep.province_code = p.code
      WHERE eq.paper_id = $1
    `;
    const conditions = [];
    const params = [paperId];
    let paramIdx = 2;

    if (type) {
      params.push(type);
      conditions.push(`eq.question_type = $${paramIdx++}`);
    }

    if (difficulty) {
      params.push(parseInt(difficulty));
      conditions.push(`eq.difficulty = $${paramIdx++}`);
    }

    if (knowledge_point) {
      params.push(knowledge_point);
      conditions.push(`eq.id IN (SELECT question_id FROM question_knowledge_points WHERE knowledge_point_id = $${paramIdx++})`);
    }

    if (v2_kp) {
      // D091-front-loop-2026-09-14: v2 KP ID 精确筛选 (基于 question_kp_v2 表)
      params.push(v2_kp);
      conditions.push(`eq.id IN (SELECT question_id FROM question_kp_v2 WHERE kp_id = $${paramIdx++})`);
    }

    if (conditions.length > 0) {
      query += ' AND ' + conditions.join(' AND ');
    }

    query += ' ORDER BY eq.question_number';

    params.push(parseInt(limit));
    query += ` LIMIT $${paramIdx++}`;
    params.push(parseInt(offset));
    query += ` OFFSET $${paramIdx}`;

    const rows = await pool.query(query, params);

    // D091: 同时查 v1 + v2 KP (合并返回)
    const questionIds = rows.rows.map(r => r.id);
    let v1KpsByQ = {}, v2KpsByQ = {};
    if (questionIds.length > 0) {
      const v1Res = await pool.query(`
        SELECT qkp.question_id, kp.id AS kp_id, kp.name AS kp_name
        FROM question_knowledge_points qkp
        JOIN knowledge_points kp ON kp.id = qkp.knowledge_point_id
        WHERE qkp.question_id = ANY($1::int[])
      `, [questionIds]);
      for (const r of v1Res.rows) {
        if (!v1KpsByQ[r.question_id]) v1KpsByQ[r.question_id] = [];
        v1KpsByQ[r.question_id].push({ kp_id: r.kp_id, name: r.kp_name, source: 'v1' });
      }
      const v2Res = await pool.query(`
        SELECT q.question_id, kp.kp_id, kp.name, kp.dimension_type, q.confidence, q.reasoning
        FROM question_kp_v2 q
        JOIN knowledge_points_v2 kp ON kp.kp_id = q.kp_id
        WHERE q.question_id = ANY($1::int[])
        ORDER BY q.confidence DESC NULLS LAST
      `, [questionIds]);
      for (const r of v2Res.rows) {
        if (!v2KpsByQ[r.question_id]) v2KpsByQ[r.question_id] = [];
        v2KpsByQ[r.question_id].push({
          kp_id: r.kp_id, name: r.name, dimension_type: r.dimension_type,
          confidence: r.confidence, reasoning: r.reasoning, source: 'v2'
        });
      }
    }
    for (const r of rows.rows) {
      r.knowledge_points_v1 = v1KpsByQ[r.id] || [];
      r.knowledge_points_v2 = v2KpsByQ[r.id] || [];
    }

    const countResult = await pool.query('SELECT COUNT(*) as count FROM exam_questions WHERE paper_id = $1', [paperId]);

    res.json({
      success: true,
      paper: paper,
      data: rows.rows,
      total: parseInt(countResult.rows[0]?.count || 0),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('获取试卷题目失败:', error.message);
    res.status(500).json(errorResponse('获取试卷题目失败'));
  }
}

// D091-front-loop-2026-09-14: 同类题推荐 (基于 v2 KP ID 精确匹配)
// GET /api/exam/questions/similar?v2_kp=XXX&limit=20
// 与 RAG 文本匹配相比, v2 KP 精确匹配准确率大幅提升
export async function getSimilarQuestionsByV2Kp(req, res) {
  const pool = await getDb();
  const { v2_kp, limit = 20, offset = 0 } = req.query;
  if (!v2_kp) {
    return res.status(400).json(errorResponse('请提供 v2_kp 参数'));
  }
  try {
    const sql = `
      SELECT eq.id, eq.question_number, eq.question_type, eq.stem, eq.options,
             eq.answer, eq.analysis, eq.score, eq.difficulty, eq.subject_code,
             eq.file_path, ep.year, p.code AS province_code, p.name AS province_name
      FROM question_kp_v2 q
      JOIN exam_questions eq ON eq.id = q.question_id
      JOIN exam_papers ep ON eq.paper_id = ep.id
      LEFT JOIN provinces p ON ep.province_code = p.code
      WHERE q.kp_id = $1
      ORDER BY q.confidence DESC NULLS LAST, ep.year DESC
      LIMIT $2 OFFSET $3
    `;
    const rows = await pool.query(sql, [v2_kp, parseInt(limit), parseInt(offset)]);
    // 加 v2 KP 详情 (避免 N+1)
    const ids = rows.rows.map(r => r.id);
    const kpMap = new Map();
    if (ids.length > 0) {
      const kpRes = await pool.query(`
        SELECT q.question_id, kp.kp_id, kp.name, kp.dimension_type, q.confidence
        FROM question_kp_v2 q
        JOIN knowledge_points_v2 kp ON kp.kp_id = q.kp_id
        WHERE q.question_id = ANY($1::int[])
      `, [ids]);
      for (const r of kpRes.rows) {
        if (!kpMap.has(r.question_id)) kpMap.set(r.question_id, []);
        kpMap.get(r.question_id).push({ kp_id: r.kp_id, name: r.name, dimension_type: r.dimension_type, confidence: r.confidence });
      }
    }
    for (const r of rows.rows) {
      r.knowledge_points_v2 = kpMap.get(r.id) || [];
    }
    const countR = await pool.query('SELECT COUNT(*)::int AS c FROM question_kp_v2 WHERE kp_id = $1', [v2_kp]);
    return res.json(successResponse({
      v2_kp, total: countR.rows[0].c, data: rows.rows, limit: parseInt(limit), offset: parseInt(offset)
    }, '同类题推荐成功'));
  } catch (e) {
    console.error('[similar-v2] error:', e.message);
    return res.status(500).json(errorResponse('同类题推荐失败'));
  }
}

export async function createExamQuestion(req, res) {
  const pool = await getDb();
  const {
    paper_id,
    question_number,
    question_type,
    stem,
    options,
    answer,
    analysis,
    knowledge_points,
    difficulty,
    ability_tags,
    score
  } = req.body;

  if (!paper_id || !question_number || !question_type || !stem) {
    return res.status(400).json(errorResponse('请提供完整信息'));
  }

  try {
    const paperResult = await pool.query('SELECT * FROM exam_papers WHERE id = $1', [paper_id]);

    if (paperResult.rows.length === 0) {
      return res.status(404).json(errorResponse('试卷不存在'));
    }

    const paper = paperResult.rows[0];
    const optionsJson = options ? JSON.stringify(options) : null;
    const knowledgeJson = knowledge_points ? JSON.stringify(knowledge_points) : null;
    const tagsJson = ability_tags ? JSON.stringify(ability_tags) : null;

    const result = await pool.query(`
      INSERT INTO exam_questions (
        paper_id, question_number, question_type, stem, options,
        answer, analysis, knowledge_points, difficulty, ability_tags, score,
        subject_code, province_code, year
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING id
    `, [
      paper_id,
      question_number,
      question_type,
      stem,
      optionsJson,
      answer || null,
      analysis || null,
      knowledgeJson,
      difficulty || null,
      tagsJson,
      score || null,
      paper.subject,
      paper.province_code,
      paper.year
    ]);

    if (knowledge_points && Array.isArray(knowledge_points)) {
      for (const kp of knowledge_points) {
        const kpId = typeof kp === 'string' ? kp : kp?.id;
        if (kpId) {
          await pool.query(
            'INSERT INTO question_knowledge_points (question_id, knowledge_point_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [result.rows[0].id, kpId]
          );
        }
      }
    }

    const countResult = await pool.query(
      'SELECT COUNT(*) as count FROM exam_questions WHERE paper_id = $1',
      [paper_id]
    );

    await pool.query(
      'UPDATE exam_papers SET question_count = $1 WHERE id = $2',
      [countResult.rows[0].count, paper_id]
    );

    const newQuestion = await pool.query(
      'SELECT * FROM exam_questions WHERE paper_id = $1 AND question_number = $2',
      [paper_id, question_number]
    );

    res.json({
      success: true,
      data: newQuestion.rows[0]
    });
  } catch (error) {
    console.error('创建题目失败:', error.message);
    res.status(500).json(errorResponse('创建题目失败'));
  }
}

export async function batchCreateQuestions(req, res) {
  const pool = await getDb();
  const { paper_id, questions } = req.body;

  if (!paper_id || !questions || !Array.isArray(questions)) {
    return res.status(400).json(errorResponse('请提供完整信息'));
  }

  try {
    const paperResult = await pool.query('SELECT * FROM exam_papers WHERE id = $1', [paper_id]);

    if (paperResult.rows.length === 0) {
      return res.status(404).json(errorResponse('试卷不存在'));
    }

    const paper = paperResult.rows[0];

    const created = [];

    for (const q of questions) {
      const result = await pool.query(`
        INSERT INTO exam_questions (
          paper_id, question_number, question_type, stem, options,
          answer, analysis, knowledge_points, difficulty, ability_tags, score,
          subject_code, province_code, year
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING id
      `, [
        paper_id,
        q.question_number,
        q.question_type,
        q.stem,
        q.options ? JSON.stringify(q.options) : null,
        q.answer || null,
        q.analysis || null,
        q.knowledge_points ? JSON.stringify(q.knowledge_points) : null,
        q.difficulty || null,
        q.ability_tags ? JSON.stringify(q.ability_tags) : null,
        q.score || null,
        paper.subject,
        paper.province_code,
        paper.year
      ]);

      if (q.knowledge_points && Array.isArray(q.knowledge_points)) {
        for (const kp of q.knowledge_points) {
          const kpId = typeof kp === 'string' ? kp : kp?.id;
          if (kpId) {
            await pool.query(
              'INSERT INTO question_knowledge_points (question_id, knowledge_point_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
              [result.rows[0].id, kpId]
            );
          }
        }
      }

      created.push(q.question_number);
    }

    const countResult = await pool.query(
      'SELECT COUNT(*) as count, AVG(difficulty) as avg_difficulty FROM exam_questions WHERE paper_id = $1 AND difficulty IS NOT NULL',
      [paper_id]
    );

    await pool.query(
      'UPDATE exam_papers SET question_count = $1, difficulty_avg = $2 WHERE id = $3',
      [countResult.rows[0].count, countResult.rows[0].avg_difficulty, paper_id]
    );

    res.json({
      success: true,
      created_count: created.length,
      questions: created
    });
  } catch (error) {
    console.error('批量创建题目失败:', error.message);
    res.status(500).json(errorResponse('批量创建题目失败'));
  }
}
