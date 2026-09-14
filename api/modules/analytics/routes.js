/**
 * analytics 模块路由 (D-Bug-D v2, 2026-08-23)
 *
 * 背景: 之前 routes.js 是空 router, 导入 handler 但未挂载 (e2e fail 4 个之二)
 *
 * 设计:
 *   - 挂载 5 个 handler: learning-path / reports / class-analysis / teacher-dashboard / class-detail
 *   - 路径前缀 /api/analytics/* (F3 等新前端可调)
 *   - 旧路径 /api/learning-path /api/reports 仍走 compat 层 (向后兼容)
 *
 * 注意:
 *   - server.js 已挂载 /api/adaptive-difficulty (直挂, 不在本路由)
 *   - server.js 已挂载 /api/province-stats /province-trends (直挂, 不在本路由)
 */
import express from 'express';
import learningPathRouter from '../../handlers/learning-path.js';
import reportsHandler from '../../handlers/reports.js';
import { getClassAnalysis, getTeacherDashboard, getClassDetail } from '../../handlers/class-analysis.js';
import { authMiddleware } from '../../core/auth.js';
import { getDb } from '../../core/db.js';

const router = express.Router();

router.get('/learning-path', authMiddleware, learningPathRouter); // /api/analytics/learning-path
router.get('/reports', authMiddleware, reportsHandler);             // /api/analytics/reports
router.get('/class/analysis', authMiddleware, getClassAnalysis);
router.get('/class/teacher', authMiddleware, getTeacherDashboard);
router.get('/class/detail', authMiddleware, getClassDetail);

// D089-front-loop-2026-09-14: 系统宏观统计 (题库原子化成果展示)
//   - 不需 auth: 公开数据 (题库规模 / KP 覆盖率等)
//   - 路径 /api/analytics/system/stats
//   - 用于 Dashboard + exam-*.html "题库浏览" 卡片
router.get('/system/stats', async (req, res) => {
  try {
    const pool = await getDb();
    // 单次查询聚合 (1 round-trip)
    const r = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM exam_papers) AS exam_papers,
        (SELECT COUNT(*) FROM exam_questions) AS exam_questions,
        (SELECT COUNT(*) FROM exam_questions WHERE file_path IS NOT NULL) AS questions_with_file_path,
        (SELECT COUNT(*) FROM exam_questions WHERE paper_id IS NOT NULL) AS questions_with_paper,
        (SELECT COUNT(*) FROM knowledge_points) AS knowledge_points,
        (SELECT COUNT(*) FROM knowledge_points WHERE level='gaokao') AS kp_gaokao,
        (SELECT COUNT(*) FROM knowledge_points WHERE level='zhongkao') AS kp_zhongkao,
        (SELECT COUNT(*) FROM question_knowledge_points) AS qkp_links,
        (SELECT COUNT(DISTINCT question_id) FROM question_knowledge_points) AS questions_with_kp,
        (SELECT COUNT(DISTINCT knowledge_point_id) FROM question_knowledge_points) AS kps_used,
        (SELECT COUNT(DISTINCT province_code) FROM exam_papers WHERE province_code IS NOT NULL) AS provinces,
        (SELECT MIN(year) FROM exam_papers) AS min_year,
        (SELECT MAX(year) FROM exam_papers) AS max_year
    `);
    const row = r.rows[0];
    const coveragePct = row.exam_questions > 0
      ? Number((row.questions_with_kp / row.exam_questions * 100).toFixed(2))
      : 0;
    const fpCoveragePct = row.exam_questions > 0
      ? Number((row.questions_with_file_path / row.exam_questions * 100).toFixed(2))
      : 0;
    // 按学科分布
    const subjR = await pool.query(`
      SELECT subject_code, COUNT(*) AS n
      FROM exam_questions GROUP BY subject_code ORDER BY n DESC
    `);
    res.json({
      success: true,
      data: {
        exam_papers: Number(row.exam_papers),
        exam_questions: Number(row.exam_questions),
        questions_with_file_path: Number(row.questions_with_file_path),
        questions_with_paper: Number(row.questions_with_paper),
        file_path_coverage_pct: fpCoveragePct,
        knowledge_points: Number(row.knowledge_points),
        kp_gaokao: Number(row.kp_gaokao),
        kp_zhongkao: Number(row.kp_zhongkao),
        qkp_links: Number(row.qkp_links),
        questions_with_kp: Number(row.questions_with_kp),
        kps_used: Number(row.kps_used),
        kp_coverage_pct: coveragePct,
        provinces: Number(row.provinces),
        year_min: Number(row.min_year),
        year_max: Number(row.max_year),
        subject_breakdown: subjR.rows.map(s => ({
          subject_code: s.subject_code,
          count: Number(s.n)
        })),
        generated_at: new Date().toISOString()
      }
    });
  } catch (e) {
    console.error('[system/stats] error:', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

export default router;