import { getDb } from '../core/db.js';
import { errorResponse, successResponse } from '../utils/response.js';
import { enrichQuestionsWithTables } from '../services/questionTables.js';

// D092-front-loop-2026-09-14: 拆分为按 paperId 与按 questionId 两端点
//   getExamQuestions(req, res)   路由 /questions/:paperId  (保留原行为, 试卷级题目列表)
//   getQuestionById(req, res)    路由 /questions/detail/:qid  (新增, 题目级单题详情)

// === 试卷级题目列表 (保持原行为, 兼容旧调用) ===
export async function getExamQuestions(req, res) {
  const pool = await getDb();
  const { paperId } = req.params;
  const { type, difficulty, knowledge_point, v2_kp, limit = 100, offset = 0 } = req.query;

  const SUBJECT_MAP = {
    'chinese': '语文', 'math': '数学', 'english': '英语', 'physics': '物理',
    'chemistry': '化学', 'biology': '生物', 'politics': '政治',
    'history': '历史', 'geography': '地理'
  };

  try {
    const paperResult = await pool.query('SELECT * FROM exam_papers WHERE id = $1', [paperId]);
    if (paperResult.rows.length === 0) {
      return res.status(404).json(errorResponse('试卷不存在'));
    }
    const paper = paperResult.rows[0];
    paper.title = `${paper.year}年${SUBJECT_MAP[paper.subject] || paper.subject}试卷`;
    paper.name = paper.title;

    const conditions = ['eq.paper_id = $1'];
    const params = [paperId];
    let idx = 2;
    if (type) { conditions.push(`eq.question_type = $${idx++}`); params.push(type); }
    if (difficulty) { conditions.push(`eq.difficulty = $${idx++}`); params.push(parseInt(difficulty)); }
    if (knowledge_point) {
      conditions.push(`eq.id IN (SELECT question_id FROM question_knowledge_points WHERE knowledge_point_id = $${idx++})`);
      params.push(knowledge_point);
    }
    if (v2_kp) {
      conditions.push(`eq.id IN (SELECT question_id FROM question_kp_v2 WHERE kp_id = $${idx++})`);
      params.push(v2_kp);
    }
    const where = 'WHERE ' + conditions.join(' AND ');
    params.push(parseInt(limit));
    const limitIdx = idx++;
    params.push(parseInt(offset));
    const offsetIdx = idx++;

    const rows = await pool.query(
      `SELECT eq.*, p.name AS province_name
         FROM exam_questions eq
         JOIN exam_papers ep ON eq.paper_id = ep.id
         LEFT JOIN provinces p ON ep.province_code = p.code
         ${where}
         ORDER BY eq.question_number
         LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      params
    );

    // D091: 加载 v1 + v2 KP
    const ids = rows.rows.map(r => r.id);
    const v1Map = new Map(), v2Map = new Map();
    if (ids.length > 0) {
      const v1Res = await pool.query(
        `SELECT qkp.question_id, kp.id AS kp_id, kp.name AS kp_name
         FROM question_knowledge_points qkp
         JOIN knowledge_points kp ON kp.id = qkp.knowledge_point_id
         WHERE qkp.question_id = ANY($1::int[])`, [ids]);
      for (const r of v1Res.rows) {
        if (!v1Map.has(r.question_id)) v1Map.set(r.question_id, []);
        v1Map.get(r.question_id).push({ kp_id: r.kp_id, name: r.kp_name, source: 'v1' });
      }
      const v2Res = await pool.query(
        `SELECT q.question_id, kp.kp_id, kp.name, kp.dimension_type, q.confidence, q.reasoning
         FROM question_kp_v2 q
         JOIN knowledge_points_v2 kp ON kp.kp_id = q.kp_id
         WHERE q.question_id = ANY($1::int[])
         ORDER BY q.confidence DESC NULLS LAST`, [ids]);
      for (const r of v2Res.rows) {
        if (!v2Map.has(r.question_id)) v2Map.set(r.question_id, []);
        v2Map.get(r.question_id).push({ kp_id: r.kp_id, name: r.name, dimension_type: r.dimension_type, confidence: r.confidence, reasoning: r.reasoning, source: 'v2' });
      }
    }
    for (const r of rows.rows) {
      r.knowledge_points_v1 = v1Map.get(r.id) || [];
      r.knowledge_points_v2 = v2Map.get(r.id) || [];
    }
    // P4-c 治本: 把 ⟦TABLE:n⟧ 富化成结构化 tables (见 services/questionTables.js)
    await enrichQuestionsWithTables(pool, rows.rows);

    const countResult = await pool.query('SELECT COUNT(*) AS count FROM exam_questions WHERE paper_id = $1', [paperId]);
    res.json({
      success: true, paper, data: rows.rows,
      total: parseInt(countResult.rows[0]?.count || 0),
      limit: parseInt(limit), offset: parseInt(offset)
    });
  } catch (error) {
    console.error('[getExamQuestions] 失败:', error.message);
    res.status(500).json(errorResponse('获取试卷题目失败'));
  }
}

// === 题目级单题详情 (新增, D092 修复) ===
// GET /api/exam/questions/detail/:qid?include_kp=true
export async function getQuestionById(req, res) {
  const pool = await getDb();
  const { qid } = req.params;
  const { include_kp = 'true' } = req.query;
  if (!qid || isNaN(parseInt(qid, 10))) {
    return res.status(400).json(errorResponse('题目 ID 必填且为整数'));
  }
  try {
    const r = await pool.query(
      `SELECT eq.*, ep.id AS paper_id, ep.year, ep.paper_type,
              p.name AS province_name, p.code AS province_code
         FROM exam_questions eq
         JOIN exam_papers ep ON eq.paper_id = ep.id
         LEFT JOIN provinces p ON ep.province_code = p.code
         WHERE eq.id = $1`, [parseInt(qid, 10)]);
    if (r.rows.length === 0) {
      return res.status(404).json(errorResponse('题目不存在'));
    }
    const q = r.rows[0];
    if (include_kp === 'true') {
      const v1Res = await pool.query(
        `SELECT kp.id AS kp_id, kp.name
         FROM question_knowledge_points qkp
         JOIN knowledge_points kp ON kp.id = qkp.knowledge_point_id
         WHERE qkp.question_id = $1`, [q.id]);
      q.knowledge_points_v1 = v1Res.rows.map(r => ({ kp_id: r.kp_id, name: r.name, source: 'v1' }));
      const v2Res = await pool.query(
        `SELECT kp.kp_id, kp.name, kp.dimension_type, q.confidence, q.reasoning
         FROM question_kp_v2 q
         JOIN knowledge_points_v2 kp ON kp.kp_id = q.kp_id
         WHERE q.question_id = $1
         ORDER BY q.confidence DESC NULLS LAST`, [q.id]);
      q.knowledge_points_v2 = v2Res.rows.map(r => ({ kp_id: r.kp_id, name: r.name, dimension_type: r.dimension_type, confidence: r.confidence, reasoning: r.reasoning, source: 'v2' }));
    }
    // P4-c 治本: ⟦TABLE:n⟧ → 结构化 tables
    await enrichQuestionsWithTables(pool, [q]);
    return res.json(successResponse({ data: q }, '获取题目详情成功'));
  } catch (e) {
    console.error('[getQuestionById] 失败:', e.message);
    return res.status(500).json(errorResponse('获取题目详情失败'));
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
             eq.file_path, eq.table_refs, ep.year, p.code AS province_code, p.name AS province_name
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
    // P4-c 治本: ⟦TABLE:n⟧ → 结构化 tables
    await enrichQuestionsWithTables(pool, rows.rows);
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
