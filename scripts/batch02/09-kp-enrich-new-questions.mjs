#!/usr/bin/env node
// scripts/batch02/09-kp-enrich-new-questions.mjs
// Dispatch 022 后置 · 给所有新题自动挂载 KP
//
// 复用 stage31 的 RULES 关键词引擎, 但目标从 MVP paper 改成全量 paper.
// 注意: 仅 insert 不 update (UPSERT 风格, 不会重复关联)

import { Pool } from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..', '..');
const RUN_LABEL = 'batch02-09-kp-enrich-new';

function loadDatabaseUrl() {
  const text = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*DATABASE_URL\s*=\s*(.+?)\s*$/);
    if (m) return m[1];
  }
  throw new Error('[09] DATABASE_URL missing');
}
const pool = new Pool({ connectionString: loadDatabaseUrl() });

// 复用 stage31 的 RULES
const RULES = {
  chinese: [
    { kw: ['文言文', '加点词', '加点词语', '虚词', '实词', '通假字', '古今异义', '词类活用'], kp: 'CHN-Z0-002', score: 0.95, why: '文言文阅读信号' },
    { kw: ['现代文', '散文', '理解与赏析', '文中语句', '文意', '涵义', '画线句', '识士', '根据材料', '根据文意', '解读', '赏析', '理解与推断', '对文中', '对文章', '原文', '材料', '下列', '对材料', '翻译', '依次填入', '加点字'], kp: 'CHN-Z0-003', score: 0.80, why: '现代文阅读信号' },
    { kw: ['红楼梦', '三国演义', '水浒传', '西游记', '林黛玉', '宝玉', '诸葛亮', '马诗', '诗三首', '诗词', '诗两首'], kp: 'CHN-Z0-005', score: 0.92, why: '名著/诗词信号' },
    { kw: ['议论文', '记叙文', '抒情文字', '写一首', '写一篇', '题目', '观点和理由', '宣传语', '不超过150字', '研学活动', '班会'], kp: 'CHN-Z0-004', score: 0.90, why: '写作信号' },
    { kw: ['语言文字基础', '基础知识', '成语', '古诗文名句', '原句', '默写', '修辞', '黄河大合唱', '音乐'], kp: 'CHN-Z0-001', score: 0.70, why: '基础知识运用信号' }
  ],
  history: [
    { kw: ['古代中国', '商王', '汉谟拉比', '古代两河流域', '古代希腊罗马', '古代中国经济', '古代中国的政治制度', '古代中国的科学技术与文化', '西汉', '唐代', '唐代铨选', '龙筋凤髓判', '隋唐', '秦汉', '先秦', '科举', '古代', '古建筑', '丝绸之路', '京西古道'], kp: 'HIS-Z0-001', score: 0.92, why: '中国古代史信号' },
    { kw: ['近代中国', '列强侵略', '鸦片战争', '近代中国的民主革命', '中国共产党的成立', '抗日战争', '解放战争', '国民党', '共产党', '毛泽东', '1920年', '1937年', '上海机器工会', '陈独秀', '中国共产党'], kp: 'HIS-Z0-002', score: 0.90, why: '中国近代史信号' },
    { kw: ['世界史', '苏联', '罗斯福新政', '欧洲', '希腊', '罗马', '拜占庭', '新航路', '资本主义世界市场', '透视法', '日心说', '伽利略', '哥白尼', '机器人', '马克思主义', '全球化', '1955年', '2008年', '15世纪', '印度', '俄国', '英国', '欧盟', '纳米技术'], kp: 'HIS-Z0-003', score: 0.86, why: '世界史信号' },
    { kw: ['现代中国', '中法建交', '周恩来', '两个中国', '祖国统一', '一国两制', '中国特色社会主义', '改革开放', '新中国', '经略海洋'], kp: 'HIST-G0-293', score: 0.78, why: '现代中国政治信号' },
    { kw: ['对外关系', '领海', '国际法', '万国公法', '联合国', '霸权', '经济全球化'], kp: 'HIST-G0-294', score: 0.78, why: '对外关系信号' },
    { kw: ['经济结构', '资本主义', '东印度公司', '英国与印度', '田赋', '徭役', '地丁'], kp: 'HIST-G0-300', score: 0.80, why: '近代中国经济信号' },
    { kw: ['孔子', '儒家', '仁', '礼', '君子', '修身', '国学', '玉器', '理想人格'], kp: 'HIST-G0-307', score: 0.85, why: '传统文化思想信号' },
    { kw: ['永乐大典', '古书', '辑录', '圣王之治', '古籍', '史记', '尚书', '甲骨'], kp: 'HIST-G0-308', score: 0.80, why: '古代科技文化信号' },
    { kw: ['人工智能', '数字化', '数字闪耀', '20世纪', '信息'], kp: 'HIST-G0-310', score: 0.72, why: '现代科技信号' }
  ]
};

function matchRules(subject, stem) {
  const rules = RULES[subject] || [];
  const norm = (stem || '').toLowerCase().replace(/\s+/g, '');
  const hits = [];
  for (const r of rules) {
    for (const kw of r.kw) {
      if (norm.includes(kw.toLowerCase().replace(/\s+/g, ''))) {
        hits.push({ kp_id: r.kp, score: r.score, kw, why: r.why });
        break;
      }
    }
  }
  return hits;
}

async function main() {
  console.log('='.repeat(78));
  console.log(`  Batch-02 KP 富化 (新题) · ${new Date().toISOString()}`);
  console.log('='.repeat(78));

  // 1) 加载所有无 KP 的 question
  const candidates = await pool.query(`
    SELECT q.id, q.question_uid, q.subject_code, q.stem
    FROM public.exam_questions q
    LEFT JOIN public.question_knowledge_points qkp ON qkp.question_id = q.id
    WHERE qkp.question_id IS NULL
      AND q.subject_code IN ('chinese', 'history')
      AND q.stem IS NOT NULL
      AND length(q.stem) >= 6
  `);
  console.log(`\n[1] 待 KP 富化候选 (chinese + history, 无 KP): ${candidates.rowCount}`);

  if (candidates.rowCount === 0) {
    await pool.end();
    return;
  }

  // 2) 规则匹配 + UPSERT
  const client = await pool.connect();
  let inserted = 0, skipped = 0;
  const by_kp = {};
  try {
    for (const q of candidates.rows) {
      const matches = matchRules(q.subject_code, q.stem);
      if (matches.length === 0) continue;
      for (const m of matches) {
        try {
          await client.query('BEGIN');
          const ins = await client.query(
            `INSERT INTO public.question_knowledge_points (question_id, knowledge_point_id, relevance_score, source)
             VALUES ($1, $2, $3, 'rule')
             ON CONFLICT (question_id, knowledge_point_id) DO NOTHING
             RETURNING id`,
            [q.id, m.kp_id, m.score]
          );
          if (ins.rowCount === 0) {
            await client.query('ROLLBACK');
            skipped++;
          } else {
            await client.query('COMMIT');
            inserted++;
            by_kp[m.kp_id] = (by_kp[m.kp_id] || 0) + 1;
          }
        } catch (e) {
          await client.query('ROLLBACK').catch(() => {});
        }
      }
    }
  } finally {
    client.release();
  }

  console.log(`\n[2] 结果:`);
  console.log(`    inserted: ${inserted}`);
  console.log(`    skipped (duplicate): ${skipped}`);
  console.log(`    按 KP 分布:`);
  for (const [k, v] of Object.entries(by_kp).sort((a, b) => b[1] - a[1])) {
    console.log(`      ${k}: ${v}`);
  }

  // 3) 验证
  const after = await pool.query(`
    SELECT count(*) FILTER (WHERE qkp.question_id IS NOT NULL) AS with_kp,
           count(*) AS total
    FROM public.exam_questions q
    LEFT JOIN public.question_knowledge_points qkp ON qkp.question_id = q.id
    WHERE q.subject_code IN ('chinese', 'history')
  `);
  const { with_kp, total } = after.rows[0];
  console.log(`\n[3] chinese+history 题 KP 覆盖率: ${with_kp}/${total} = ${((with_kp/total)*100).toFixed(2)}%`);

  await pool.end();
}

main().catch(async (e) => {
  console.error('[09] FATAL', e);
  await pool.end().catch(() => {});
  process.exit(2);
});
