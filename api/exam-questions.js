import { getDb } from './db.js';
import { errorResponse } from './utils/response.js';

export async function getExamQuestions(req, res) {
  const db = await getDb();
  const { paperId } = req.params;
  const { type, difficulty, knowledge_point, limit = 100, offset = 0 } = req.query;

  try {
    const paperResult = await db.all('SELECT * FROM exam_papers WHERE id = ?', [paperId]);

    if (paperResult.length === 0) {
      return res.status(404).json(errorResponse('试卷不存在'));
    }

    let query = `
      SELECT
        eq.*,
        ep.province_code,
        ep.year,
        ep.subject,
        p.name as province_name
      FROM exam_questions eq
      JOIN exam_papers ep ON eq.paper_id = ep.id
      LEFT JOIN provinces p ON ep.province_code = p.code
      WHERE eq.paper_id = ?
    `;
    const conditions = [];
    const params = [paperId];

    if (type) {
      params.push(type);
      conditions.push(`eq.question_type = ?`);
    }

    if (difficulty) {
      params.push(parseInt(difficulty));
      conditions.push(`eq.difficulty = ?`);
    }

    if (knowledge_point) {
      params.push(knowledge_point);
      conditions.push(`eq.knowledge_points LIKE ?`);
    }

    if (conditions.length > 0) {
      query += ' AND ' + conditions.join(' AND ');
    }

    query += ' ORDER BY eq.question_number';

    params.push(parseInt(limit));
    query += ' LIMIT ?';
    params.push(parseInt(offset));
    query += ' OFFSET ?';

    const rows = await db.all(query, params);

    let countQuery = 'SELECT COUNT(*) as count FROM exam_questions WHERE paper_id = ?';
    const countResult = await db.all(countQuery, [paperId]);

    res.json({
      success: true,
      paper: paperResult[0],
      data: rows,
      total: parseInt(countResult[0]?.count || 0),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('获取试卷题目失败:', error.message);
    res.status(500).json(errorResponse('获取试卷题目失败'));
  }
}

export async function createExamQuestion(req, res) {
  const db = await getDb();
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
    const paperResult = await db.all('SELECT * FROM exam_papers WHERE id = ?', [paper_id]);

    if (paperResult.length === 0) {
      return res.status(404).json(errorResponse('试卷不存在'));
    }

    const optionsJson = options ? JSON.stringify(options) : null;
    const knowledgeJson = knowledge_points ? JSON.stringify(knowledge_points) : null;
    const tagsJson = ability_tags ? JSON.stringify(ability_tags) : null;

    const stmt = await db.prepare(`
      INSERT INTO exam_questions (
        paper_id, question_number, question_type, stem, options,
        answer, analysis, knowledge_points, difficulty, ability_tags, score
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    await stmt.run([
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
      score || null
    ]);

    const countResult = await db.all(
      'SELECT COUNT(*) as count FROM exam_questions WHERE paper_id = ?',
      [paper_id]
    );

    await db.run(
      'UPDATE exam_papers SET question_count = ? WHERE id = ?',
      [countResult[0].count, paper_id]
    );

    const newQuestion = await db.all(
      'SELECT * FROM exam_questions WHERE paper_id = ? AND question_number = ?',
      [paper_id, question_number]
    );

    res.json({
      success: true,
      data: newQuestion[0]
    });
  } catch (error) {
    console.error('创建题目失败:', error.message);
    res.status(500).json(errorResponse('创建题目失败'));
  }
}

export async function batchCreateQuestions(req, res) {
  const db = await getDb();
  const { paper_id, questions } = req.body;

  if (!paper_id || !questions || !Array.isArray(questions)) {
    return res.status(400).json(errorResponse('请提供完整信息'));
  }

  try {
    const paperResult = await db.all('SELECT * FROM exam_papers WHERE id = ?', [paper_id]);

    if (paperResult.length === 0) {
      return res.status(404).json(errorResponse('试卷不存在'));
    }

    const created = [];
    const stmt = await db.prepare(`
      INSERT INTO exam_questions (
        paper_id, question_number, question_type, stem, options,
        answer, analysis, knowledge_points, difficulty, ability_tags, score
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const q of questions) {
      await stmt.run([
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
        q.score || null
      ]);
      created.push(q.question_number);
    }

    const countResult = await db.all(
      'SELECT COUNT(*) as count, AVG(difficulty) as avg_difficulty FROM exam_questions WHERE paper_id = ? AND difficulty IS NOT NULL',
      [paper_id]
    );

    await db.run(
      'UPDATE exam_papers SET question_count = ?, difficulty_avg = ? WHERE id = ?',
      [countResult[0].count, countResult[0].avg_difficulty, paper_id]
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
