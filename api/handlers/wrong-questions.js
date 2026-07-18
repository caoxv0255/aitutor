import { getDb } from '../core/db.js';
import { successResponse, errorResponse } from '../utils/response.js';
import PDFDocument from 'pdfkit';

export async function getWrongQuestions(req, res) {
  const { email } = req.user;
  const { page = 1, page_size = 10, subject, knowledge_point_id, error_category, reviewed } = req.query;

  try {
    const pool = await getDb();
    
    let query = `
      SELECT wq.*, sc.name as subject_name, kp.name as knowledge_point_name, wc.name as category_name
      FROM wrong_questions wq
      LEFT JOIN subjects sc ON wq.subject_code = sc.code
      LEFT JOIN knowledge_points kp ON wq.knowledge_point_id = kp.id
      LEFT JOIN wrong_question_categories wc ON wq.error_category = wc.code
      WHERE wq.user_email = $1
    `;
    
    const params = [email];
    let paramIdx = 2;

    if (subject) {
      query += ` AND wq.subject_code = $${paramIdx++}`;
      params.push(subject);
    }

    if (knowledge_point_id) {
      query += ` AND wq.knowledge_point_id = $${paramIdx++}`;
      params.push(knowledge_point_id);
    }

    if (error_category) {
      query += ` AND wq.error_category = $${paramIdx++}`;
      params.push(error_category);
    }

    if (reviewed !== undefined) {
      query += ` AND wq.reviewed = $${paramIdx++}`;
      params.push(reviewed === 'true');
    }

    query += ' ORDER BY wq.created_at DESC';

    const offset = (parseInt(page) - 1) * parseInt(page_size);
    query += ` LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`;
    params.push(parseInt(page_size), offset);

    const result = await pool.query(query, params);

    const countQuery = query.replace(/SELECT.*FROM/, 'SELECT COUNT(*) FROM').replace(/ORDER BY.*/, '').replace(/LIMIT.*/, '');
    const countResult = await pool.query(countQuery, params.slice(0, -2));

    return res.json(successResponse({
      questions: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      page_size: parseInt(page_size)
    }, '获取错题列表成功'));
  } catch (error) {
    console.error('[WrongQuestions] 获取错题列表失败:', error.message);
    return res.status(500).json(errorResponse('获取错题列表失败'));
  }
}

export async function addWrongQuestion(req, res) {
  const { email } = req.user;
  const { content, subject_code, knowledge_point_id, knowledge_point_name,
          difficulty, question_type, correct_answer, error_analysis,
          error_types, error_category } = req.body;

  if (!content || !subject_code) {
    return res.status(400).json(errorResponse('缺少必填字段: content, subject_code'));
  }

  try {
    const pool = await getDb();

    const result = await pool.query(`
      INSERT INTO wrong_questions (
        user_email, content, subject_code, knowledge_point_id, knowledge_point_name,
        difficulty, question_type, correct_answer, error_analysis, error_types, error_category
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id, created_at
    `, [email, content, subject_code, knowledge_point_id, knowledge_point_name,
        difficulty || 3, question_type || 'other', correct_answer, error_analysis,
        JSON.stringify(error_types || []), error_category || 'unknown']);

    return res.json(successResponse({
      id: result.rows[0].id,
      created_at: result.rows[0].created_at
    }, '添加错题成功'));
  } catch (error) {
    console.error('[WrongQuestions] 添加错题失败:', error.message);
    return res.status(500).json(errorResponse('添加错题失败'));
  }
}

export async function updateWrongQuestion(req, res) {
  const { email } = req.user;
  const { id } = req.params;
  const { reviewed, review_count, error_category, analysis_note } = req.body;

  try {
    const pool = await getDb();

    let query = 'UPDATE wrong_questions SET ';
    const params = [];
    let paramIdx = 1;

    if (reviewed !== undefined) {
      query += `reviewed = $${paramIdx++}, `;
      params.push(reviewed);
    }

    if (review_count !== undefined) {
      query += `review_count = $${paramIdx++}, `;
      params.push(review_count);
    }

    if (error_category) {
      query += `error_category = $${paramIdx++}, `;
      params.push(error_category);
    }

    if (analysis_note) {
      query += `analysis_note = $${paramIdx++}, `;
      params.push(analysis_note);
    }

    query += 'updated_at = NOW() WHERE id = $' + paramIdx + ' AND user_email = $' + (paramIdx + 1);
    params.push(id, email);

    const result = await pool.query(query, params);

    if (result.rowCount === 0) {
      return res.status(404).json(errorResponse('错题不存在或无权访问'));
    }

    return res.json(successResponse({}, '更新错题成功'));
  } catch (error) {
    console.error('[WrongQuestions] 更新错题失败:', error.message);
    return res.status(500).json(errorResponse('更新错题失败'));
  }
}

export async function deleteWrongQuestion(req, res) {
  const { email } = req.user;
  const { id } = req.params;

  try {
    const pool = await getDb();

    const result = await pool.query(
      'DELETE FROM wrong_questions WHERE id = $1 AND user_email = $2',
      [id, email]
    );

    if (result.rowCount === 0) {
      return res.status(404).json(errorResponse('错题不存在或无权访问'));
    }

    return res.json(successResponse({}, '删除错题成功'));
  } catch (error) {
    console.error('[WrongQuestions] 删除错题失败:', error.message);
    return res.status(500).json(errorResponse('删除错题失败'));
  }
}

export async function getWrongQuestionStats(req, res) {
  const { email } = req.user;

  try {
    const pool = await getDb();

    const statsResult = await pool.query(`
      SELECT 
        COUNT(*) as total_count,
        SUM(CASE WHEN reviewed = true THEN 1 ELSE 0 END) as reviewed_count,
        SUM(CASE WHEN reviewed = false THEN 1 ELSE 0 END) as unreviewed_count
      FROM wrong_questions WHERE user_email = $1
    `, [email]);

    const subjectStatsResult = await pool.query(`
      SELECT subject_code, COUNT(*) as count
      FROM wrong_questions WHERE user_email = $1
      GROUP BY subject_code
      ORDER BY count DESC
    `, [email]);

    const categoryStatsResult = await pool.query(`
      SELECT error_category, COUNT(*) as count
      FROM wrong_questions WHERE user_email = $1
      GROUP BY error_category
      ORDER BY count DESC
    `, [email]);

    const monthStatsResult = await pool.query(`
      SELECT DATE_TRUNC('month', created_at) as month, COUNT(*) as count
      FROM wrong_questions WHERE user_email = $1 AND created_at >= NOW() - INTERVAL '12 months'
      GROUP BY DATE_TRUNC('month', created_at)
      ORDER BY month
    `, [email]);

    return res.json(successResponse({
      overall: statsResult.rows[0],
      by_subject: subjectStatsResult.rows,
      by_category: categoryStatsResult.rows,
      by_month: monthStatsResult.rows
    }, '获取错题统计成功'));
  } catch (error) {
    console.error('[WrongQuestions] 获取错题统计失败:', error.message);
    return res.status(500).json(errorResponse('获取错题统计失败'));
  }
}

export async function exportWrongQuestions(req, res) {
  const { email } = req.user;
  const { subject, error_category, format = 'json' } = req.query;

  try {
    const pool = await getDb();

    let query = `
      SELECT wq.*, sc.name as subject_name, kp.name as knowledge_point_name, wc.name as category_name
      FROM wrong_questions wq
      LEFT JOIN subjects sc ON wq.subject_code = sc.code
      LEFT JOIN knowledge_points kp ON wq.knowledge_point_id = kp.id
      LEFT JOIN wrong_question_categories wc ON wq.error_category = wc.code
      WHERE wq.user_email = $1
    `;
    
    const params = [email];
    let paramIdx = 2;

    if (subject) {
      query += ` AND wq.subject_code = $${paramIdx++}`;
      params.push(subject);
    }

    if (error_category) {
      query += ` AND wq.error_category = $${paramIdx++}`;
      params.push(error_category);
    }

    query += ' ORDER BY wq.subject_code, wq.created_at DESC';

    const result = await pool.query(query, params);

    const questions = result.rows.map(q => ({
      id: q.id,
      content: q.content,
      subject: q.subject_name || q.subject_code,
      knowledge_point: q.knowledge_point_name || q.knowledge_point_id,
      question_type: q.question_type,
      difficulty: q.difficulty,
      correct_answer: q.correct_answer,
      error_analysis: q.error_analysis,
      error_category: q.category_name || q.error_category,
      error_types: q.error_types ? JSON.parse(q.error_types) : [],
      created_at: q.created_at,
      reviewed: q.reviewed
    }));

    if (format === 'pdf') {
      return exportAsPDF(res, questions);
    }

    return res.json(successResponse({ questions }, '导出错题成功'));
  } catch (error) {
    console.error('[WrongQuestions] 导出错题失败:', error.message);
    return res.status(500).json(errorResponse('导出错题失败'));
  }
}

function exportAsPDF(res, questions) {
  const doc = new PDFDocument({
    size: 'A4',
    margin: 50,
    font: 'Helvetica'
  });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="错题集_${new Date().toISOString().split('T')[0]}.pdf"`);
  
  doc.pipe(res);

  doc.fontSize(20).text('错题集', { align: 'center' });
  doc.fontSize(12).text(`生成日期：${new Date().toLocaleDateString('zh-CN')}`, { align: 'center' });
  doc.fontSize(12).text(`错题总数：${questions.length} 道`, { align: 'center' });
  doc.moveDown(2);

  let currentSubject = '';
  questions.forEach((q, index) => {
    if (q.subject !== currentSubject) {
      currentSubject = q.subject;
      doc.fontSize(16).font('Helvetica-Bold').text(`【${currentSubject}】`);
      doc.moveDown(1);
    }

    doc.fontSize(14).font('Helvetica-Bold').text(`${index + 1}. ${q.content}`);
    
    if (q.knowledge_point) {
      doc.fontSize(10).font('Helvetica-Oblique').text(`知识点：${q.knowledge_point}`);
    }
    
    if (q.question_type) {
      doc.fontSize(10).font('Helvetica-Oblique').text(`题型：${q.question_type}`);
    }
    
    if (q.difficulty) {
      doc.fontSize(10).font('Helvetica-Oblique').text(`难度：${q.difficulty}星`);
    }

    if (q.correct_answer) {
      doc.fontSize(12).font('Helvetica').text('正确答案：');
      doc.fontSize(12).text(q.correct_answer);
    }

    if (q.error_analysis) {
      doc.fontSize(12).font('Helvetica').text('错误分析：');
      doc.fontSize(12).text(q.error_analysis);
    }

    if (q.error_category) {
      doc.fontSize(10).font('Helvetica-Oblique').text(`错误类型：${q.error_category}`);
    }

    if (q.error_types && q.error_types.length > 0) {
      doc.fontSize(10).font('Helvetica-Oblique').text(`错误标签：${q.error_types.join('、')}`);
    }

    doc.moveDown(2);
  });

  doc.end();
}
