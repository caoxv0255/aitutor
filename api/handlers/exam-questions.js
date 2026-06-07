import { getDb } from '../core/db.js';
import { errorResponse } from '../utils/response.js';

export async function getExamQuestions(req, res) {
  const pool = await getDb();
  const { paperId } = req.params;
  const { type, difficulty, knowledge_point, limit = 100, offset = 0 } = req.query;

  try {
    const paperResult = await pool.query('SELECT * FROM exam_papers WHERE id = $1', [paperId]);

    if (paperResult.rows.length === 0) {
      return res.status(404).json(errorResponse('试卷不存在'));
    }

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

    if (conditions.length > 0) {
      query += ' AND ' + conditions.join(' AND ');
    }

    query += ' ORDER BY eq.question_number';

    params.push(parseInt(limit));
    query += ` LIMIT $${paramIdx++}`;
    params.push(parseInt(offset));
    query += ` OFFSET $${paramIdx}`;

    const rows = await pool.query(query, params);

    const countResult = await pool.query('SELECT COUNT(*) as count FROM exam_questions WHERE paper_id = $1', [paperId]);

    res.json({
      success: true,
      paper: paperResult.rows[0],
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
