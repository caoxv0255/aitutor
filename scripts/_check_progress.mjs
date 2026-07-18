import { getDb } from '../api/core/db.js';

async function check() {
  const p = await getDb();

  // 安徽题型分布
  const r1 = await p.query(`
    SELECT question_type, COUNT(*) as cnt, AVG(difficulty) as avg_diff
    FROM exam_questions WHERE province_code = 'anhui' GROUP BY question_type ORDER BY cnt DESC
  `);
  console.log('=== 安徽题型分布 ===');
  r1.rows.forEach(x => console.log(`  ${x.question_type}: ${x.cnt}题 avg_diff=${parseFloat(x.avg_diff || 0).toFixed(2)}`));

  // 安徽难度分布
  const r2 = await p.query(`
    SELECT difficulty, COUNT(*) as cnt FROM exam_questions
    WHERE province_code = 'anhui' GROUP BY difficulty ORDER BY difficulty
  `);
  console.log('\n=== 安徽难度分布 ===');
  r2.rows.forEach(x => console.log(`  难度${x.difficulty}: ${x.cnt}题`));

  // 北京对比
  const r3 = await p.query(`
    SELECT question_type, COUNT(*) as cnt FROM exam_questions
    WHERE province_code = 'beijing' GROUP BY question_type ORDER BY cnt DESC
  `);
  console.log('\n=== 北京题型分布 ===');
  r3.rows.forEach(x => console.log(`  ${x.question_type}: ${x.cnt}题`));

  // 全局统计
  const r4 = await p.query('SELECT COUNT(*) as total FROM exam_questions');
  const r5 = await p.query('SELECT COUNT(*) as cnt FROM exam_papers WHERE question_count > 0');
  console.log(`\n=== 全局: ${r4.rows[0].total}题 / ${r5.rows[0].cnt}套试卷已解析 ===`);

  await p.end();
}
check().catch(e => console.error(e.message));
