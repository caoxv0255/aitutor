#!/usr/bin/env node
// scripts/qb2/stage31-kp-relink.mjs
// Dispatch 011 Action 1 · 规则引擎 KP Relink
//
// 设计原则：
//   - 完全本地化：不调 LLM / 不调 embedding / 不需要 API key
//   - 利用 pg_trgm (1.6) + ILIKE 关键词 + KP 名称字典 做规则匹配
//   - 单事务 + 幂等 (ON CONFLICT DO NOTHING)
//   - 仅修改 question_knowledge_points；绝不触碰 exam_questions / question_vectors / 任何核心表
//   - 所有写入通过 canonical_migration_ledger 留痕 (run_label='stage31-kp-relink')
//   - relevance_score 反映置信度 (0.50 弱匹配 ~ 1.00 精确匹配)

import { Pool } from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RUN_LABEL = 'stage31-kp-relink';
const TIMESTAMP = new Date().toISOString();

// ─── DB ────────────────────────────────────────────────────
function loadDatabaseUrl() {
  const envPath = path.resolve(__dirname, '..', '..', '.env');
  const text = fs.readFileSync(envPath, 'utf8');
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*DATABASE_URL\s*=\s*(.+?)\s*$/);
    if (m) return m[1];
  }
  throw new Error('[stage31] DATABASE_URL missing in .env');
}
const pool = new Pool({ connectionString: loadDatabaseUrl() });

// ─── 学科 → 规则集 ─────────────────────────────────────────
// 每条规则: { kw: 关键词数组 (任一命中), kp_id: 目标 KP id, score: 置信度, why: 备注 }
// 关键词全部用小写 + 去除空白后再比对
const RULES = {
  chinese: [
    // ── 文言文 ──
    { kw: ['文言文', '加点词', '加点词语', '虚词', '实词', '通假字', '古今异义', '词类活用'], kp: 'CHN-Z0-002', score: 0.95, why: '文言文阅读信号' },
    // ── 现代文阅读 ──
    { kw: ['现代文', '散文', '理解与赏析', '文中语句', '文意', '涵义', '画线句', '识士', '根据材料', '根据文意', '解读', '赏析', '理解与推断', '对文中', '对文章'], kp: 'CHN-Z0-003', score: 0.80, why: '现代文阅读信号' },
    // ── 名著阅读 ──
    { kw: ['红楼梦', '三国演义', '水浒传', '西游记', '林黛玉', '宝玉', '诸葛亮', '马诗', '诗三首'], kp: 'CHN-Z0-005', score: 0.92, why: '名著阅读信号' },
    // ── 写作 ──
    { kw: ['议论文', '记叙文', '抒情文字', '写一首', '写一篇', '题目', '观点和理由', '宣传语', '不超过150字', '研学活动', '班会'], kp: 'CHN-Z0-004', score: 0.90, why: '写作信号' },
    // ── 基础知识运用 ──
    { kw: ['语言文字基础', '基础知识', '成语', '古诗文名句', '原句', '默写', '修辞', '黄河大合唱', '音乐'], kp: 'CHN-Z0-001', score: 0.70, why: '基础知识运用信号' }
  ],
  history: [
    // ── 古代中国 ──
    { kw: ['古代中国', '商王', '汉谟拉比', '古代两河流域', '古代希腊罗马', '古代中国经济', '古代中国的政治制度', '古代中国的科学技术与文化', '西汉', '唐代', '唐代铨选', '龙筋凤髓判', '隋唐', '秦汉', '先秦'], kp: 'HIS-Z0-001', score: 0.92, why: '中国古代史信号' },
    // ── 近代中国 ──
    { kw: ['近代中国', '列强侵略', '鸦片战争', '近代中国的民主革命', '中国共产党的成立', '抗日战争', '解放战争', '国民党', '共产党', '毛泽东', '1920年', '1937年', '上海机器工会', '陈独秀'], kp: 'HIS-Z0-002', score: 0.90, why: '中国近代史信号' },
    // ── 世界史 ──
    { kw: ['世界史', '苏联', '罗斯福新政', '欧洲', '希腊', '罗马', '拜占庭', '新航路', '资本主义世界市场', '透视法', '日心说', '伽利略', '哥白尼', '机器人', '马克思主义', '全球化', '1955年', '2008年', '15世纪', '印度'], kp: 'HIS-Z0-003', score: 0.86, why: '世界史信号' },
    // ── 现代中国 政治建设 ──
    { kw: ['现代中国', '中法建交', '周恩来', '两个中国', '祖国统一', '一国两制', '中国特色社会主义', '改革开放', '新中国', '经略海洋'], kp: 'HIST-G0-293', score: 0.78, why: '现代中国政治信号' },
    // ── 现代中国 对外关系 ──
    { kw: ['对外关系', '领海', '国际法', '万国公法', '联合国', '霸权'], kp: 'HIST-G0-294', score: 0.78, why: '对外关系信号' },
    // ── 近代中国经济 ──
    { kw: ['经济结构', '资本主义', '东印度公司', '英国与印度', '田赋', '徭役', '地丁'], kp: 'HIST-G0-300', score: 0.80, why: '近代中国经济信号' },
    // ── 传统文化主流思想 ──
    { kw: ['孔子', '儒家', '仁', '礼', '君子', '修身', '国学', '玉器', '理想人格'], kp: 'HIST-G0-307', score: 0.85, why: '传统文化思想信号' },
    // ── 古代科技文化 ──
    { kw: ['永乐大典', '古书', '辑录', '圣王之治', '古籍', '史记', '尚书', '甲骨'], kp: 'HIST-G0-308', score: 0.80, why: '古代科技文化信号' },
    // ── 现代科技文化 ──
    { kw: ['人工智能', '数字化', '数字闪耀', '20世纪', '信息'], kp: 'HIST-G0-310', score: 0.72, why: '现代科技信号' }
  ]
};

function stemLower(s) {
  return (s || '').toLowerCase().replace(/\s+/g, '');
}

function matchRules(subject, stem) {
  const rules = RULES[subject] || [];
  const norm = stemLower(stem);
  const hits = [];
  for (const r of rules) {
    for (const kw of r.kw) {
      if (norm.includes(kw.toLowerCase().replace(/\s+/g, ''))) {
        hits.push({ kp_id: r.kp, score: r.score, kw, why: r.why });
        break; // 每条规则只计一次
      }
    }
  }
  return hits;
}

// ─── PG-trgm 备用匹配 (知识兜底) ───────────────────────────
async function trgmBackupMatch(subject, stem, topN = 3) {
  // 用 question 类型相似的 KP 名称做 trgm 相似度排序
  const sql = `
    SELECT id, name, similarity(name, $1) AS sim
    FROM public.knowledge_points
    WHERE subject = $2 AND name NOT LIKE '%....%'
    ORDER BY sim DESC
    LIMIT $3
  `;
  // 截取题干前 32 字作为"题目话题"
  const topic = stem.replace(/\s+/g, '').slice(0, 32);
  const r = await pool.query(sql, [topic, subject, topN]);
  return r.rows.filter((row) => Number(row.sim) >= 0.25).map((row) => ({
    kp_id: row.id,
    score: Math.min(0.6, Number(row.sim)),
    kw: `<trgm:${row.name}>`,
    why: 'pg_trgm 兜底'
  }));
}

// ─── 主流程 ──────────────────────────────────────────────
async function main() {
  console.log('='.repeat(78));
  console.log(`  Stage 31 · KP Relink · ${TIMESTAMP}`);
  console.log('='.repeat(78));

  // 1) 加载 MVP 题目
  const mvpRes = await pool.query(
    `SELECT q.id, q.question_uid, q.subject_code, q.question_number, q.paper_id, q.stem
     FROM public.exam_questions q
     WHERE q.paper_id IN (10, 11, 20) AND q.stem IS NOT NULL
     ORDER BY q.paper_id, q.question_number`
  );
  const questions = mvpRes.rows;
  console.log(`[1] 加载 MVP 题目: ${questions.length}`);

  // 2) 加载现有 KP 关联 (用于幂等跳过)
  const existingRes = await pool.query(
    `SELECT qkp.question_id, qkp.knowledge_point_id
     FROM public.question_knowledge_points qkp
     JOIN public.exam_questions q ON qkp.question_id = q.id
     WHERE q.paper_id IN (10, 11, 20)`
  );
  const existingSet = new Set(existingRes.rows.map((r) => `${r.question_id}:${r.knowledge_point_id}`));
  console.log(`[2] 已有关联 (MVP): ${existingRes.rows.length} 条 → 跳过集合大小 ${existingSet.size}`);

  // 3) 对每题跑规则
  const plan = [];
  const ruleHit = [];
  const trgmHit = [];
  const noHit = [];

  for (const q of questions) {
    const subject = q.subject_code;
    const stem = q.stem;
    const ruleMatches = matchRules(subject, stem);
    let chosen = ruleMatches;

    if (ruleMatches.length === 0) {
      // 兜底: trgm
      try {
        const backup = await trgmBackupMatch(subject, stem, 3);
        chosen = backup;
        if (backup.length > 0) trgmHit.push(q.id);
      } catch (e) {
        // 忽略兜底失败
      }
    } else {
      ruleHit.push(q.id);
    }

    if (chosen.length === 0) {
      noHit.push(q.id);
      continue;
    }

    for (const m of chosen) {
      const key = `${q.id}:${m.kp_id}`;
      if (existingSet.has(key)) continue; // 跳过已存在
      plan.push({
        question_id: q.id,
        question_uid: q.question_uid,
        kp_id: m.kp_id,
        score: m.score,
        kw: m.kw,
        why: m.why,
        source: m.why.startsWith('pg_trgm') ? 'trgm' : 'rule'
      });
      existingSet.add(key);
    }
  }

  console.log(`[3] 规则命中题数: ${ruleHit.length}; trgm 兜底命中题数: ${trgmHit.length}; 未命中: ${noHit.length}`);
  console.log(`[4] 待写入新关联 (plan): ${plan.length}`);

  // 4) 写入 + Ledger
  const client = await pool.connect();
  let inserted = 0;
  let skipped = 0;
  const ledgerOps = [];
  try {
    await client.query('BEGIN');

    for (const p of plan) {
      const beforeRes = await client.query(
        `SELECT knowledge_point_id FROM public.question_knowledge_points
         WHERE question_id = $1 AND knowledge_point_id = $2`,
        [p.question_id, p.kp_id]
      );
      const beforeSha = beforeRes.rows.length > 0
        ? crypto.createHash('sha256').update(`exists:${p.question_id}:${p.kp_id}`).digest('hex')
        : null;

      const insRes = await client.query(
        `INSERT INTO public.question_knowledge_points
           (question_id, knowledge_point_id, relevance_score, source)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (question_id, knowledge_point_id) DO NOTHING
         RETURNING id`,
        [p.question_id, p.kp_id, p.score, p.source]
      );

      if (insRes.rowCount === 0) {
        skipped++;
        continue;
      }
      inserted++;

      const afterSha = crypto.createHash('sha256')
        .update(`${p.question_id}:${p.kp_id}:${p.score}:${p.source}`)
        .digest('hex');

      ledgerOps.push([
        RUN_LABEL, 'qkp', p.kp_id, p.question_id, 'UPDATED',
        beforeSha, afterSha,
        JSON.stringify({
          question_uid: p.question_uid,
          kp_id: p.kp_id,
          relevance_score: p.score,
          source: p.source,
          matched_kw: p.kw,
          reason: p.why
        })
      ]);
    }

    // 批量写 ledger (避免数百次 round-trip)
    if (ledgerOps.length > 0) {
      const BATCH = 100;
      for (let i = 0; i < ledgerOps.length; i += BATCH) {
        const slice = ledgerOps.slice(i, i + BATCH);
        const values = [];
        const placeholders = [];
        let idx = 1;
        for (const op of slice) {
          placeholders.push(`($${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++}::jsonb)`);
          values.push(...op);
        }
        await client.query(
          `INSERT INTO qb_recovery.canonical_migration_ledger
            (run_label, entity_type, canonical_uid, canonical_id, action, before_sha, after_sha, detail)
           VALUES ${placeholders.join(',')}`,
          values
        );
      }
    }

    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[FATAL]', e.message);
    throw e;
  } finally {
    client.release();
  }

  // 5) 复跑 KP 覆盖率 + 写审计 artifact
  const cov = await pool.query(
    `SELECT
       (SELECT count(DISTINCT question_id) FROM public.question_knowledge_points qkp
        JOIN public.exam_questions q ON qkp.question_id=q.id
        WHERE q.paper_id IN (10,11,20)) AS questions_with_kp,
       (SELECT count(*) FROM public.question_knowledge_points qkp
        JOIN public.exam_questions q ON qkp.question_id=q.id
        WHERE q.paper_id IN (10,11,20)) AS total_links`
  );
  const { questions_with_kp, total_links } = cov.rows[0];

  const result = {
    run_label: RUN_LABEL,
    timestamp: TIMESTAMP,
    mvp_total: questions.length,
    rule_hit_questions: ruleHit.length,
    trgm_backup_questions: trgmHit.length,
    no_hit_questions: noHit.length,
    inserted,
    skipped,
    coverage: {
      questions_with_kp: Number(questions_with_kp),
      total_links: Number(total_links),
      coverage_pct: Number(((Number(questions_with_kp) / questions.length) * 100).toFixed(2))
    },
    sample_plan: plan.slice(0, 10)
  };

  // 写入报告
  const outDir = path.resolve(__dirname, '..', '..', 'docs', 'audits');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'stage31-kp-relink-report.json');
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2));

  console.log('\n=== 结果 ===');
  console.log(JSON.stringify(result, null, 2));
  console.log(`\n报告 → ${outPath}`);

  await pool.end();
}

main().catch(async (e) => {
  console.error('[stage31] FATAL', e);
  await pool.end().catch(() => {});
  process.exit(2);
});
