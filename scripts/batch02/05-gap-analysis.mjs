#!/usr/bin/env node
// scripts/batch02/05-gap-analysis.mjs
// Dispatch 018 · 全国全量题库缺口侦察 (Data Gap Matrix)
//
// 设计原则：
//   1. 严格只读：仅 SELECT 查询 + 本地 JSON 写入，0 INSERT/UPDATE
//   2. 优先级打分：时间权重 × 级别权重 × 地域权重 × 科目权重
//   3. Top 20 高优先级缺口给用户投喂指引
//   4. 完整缺口矩阵写入 docs/audits/data-gap-matrix.json
//   5. 诚实反映覆盖率（不要为了好看而美化）
//
// 理论矩阵：
//   - 年份: 2008-2025 (18 年)
//   - 级别: gaokao (9 科) + zhongkao (7 科)
//   - 省份: 31 个省级行政区 + 全国卷/新高考卷 (作为"特殊省份")
//
// 优先级权重:
//   - 时间: 2020-2025 → 10, 2015-2019 → 5, 2008-2014 → 1
//   - 级别: gaokao → 5, zhongkao → 2
//   - 地域: 全国卷/新高考I/II → 10, 教育大省(京/沪/浙/苏/粤/鄂/湘/川/鲁) → 5, 其他 → 2
//   - 科目: 语数英 → 5, 物理/历史 → 3, 其他 → 1

import { Pool } from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..', '..');

const RUN_LABEL = 'batch02-05-gap-analysis';

// ─── 理论全量矩阵定义 ──────────────────────────────────
const YEARS = [];
for (let y = 2008; y <= 2025; y++) YEARS.push(y);

const GAOKAO_SUBJECTS = ['chinese', 'math', 'english', 'physics', 'chemistry', 'biology', 'politics', 'history', 'geography'];
const ZHONGKAO_SUBJECTS = ['chinese', 'math', 'english', 'physics', 'chemistry', 'politics', 'history'];

// 31 个省级行政区（按 GB/T 2260 简化版）
const ALL_PROVINCES = [
  'beijing', 'tianjin', 'shanghai', 'chongqing',
  'hebei', 'shanxi', 'inner_mongolia', 'liaoning', 'jilin', 'heilongjiang',
  'jiangsu', 'zhejiang', 'anhui', 'fujian', 'jiangxi', 'shandong',
  'henan', 'hubei', 'hunan', 'guangdong', 'guangxi', 'hainan',
  'sichuan', 'guizhou', 'yunnan', 'tibet', 'shaanxi', 'gansu',
  'qinghai', 'ningxia', 'xinjiang'
];

// 特殊 "全国卷" / 新高考卷 (作为"虚拟省份"对待, 共 6 个)
const NATIONAL_PAPERS = [
  'national_a',         // 全国甲卷
  'national_b',         // 全国乙卷
  'national_new_1',     // 新高考I卷
  'national_new_2',     // 新高考II卷
  'national_proprietary'// 自主命题全国通用 (罕见, 保留位)
];

// 教育大省 (8 个) - 自命题重点省份
const KEY_PROVINCES = new Set(['beijing', 'shanghai', 'jiangsu', 'zhejiang', 'guangdong', 'hubei', 'hunan', 'sichuan']);

// ─── 优先级权重函数 ─────────────────────────────────────
function yearWeight(year) {
  if (year >= 2020) return 10;
  if (year >= 2015) return 5;
  return 1;
}

function levelWeight(level) {
  return level === 'gaokao' ? 5 : 2;
}

function regionWeight(province) {
  if (NATIONAL_PAPERS.includes(province)) return 10;
  if (KEY_PROVINCES.has(province)) return 5;
  return 2;
}

function subjectWeight(subject) {
  if (['chinese', 'math', 'english'].includes(subject)) return 5;
  if (['physics', 'history'].includes(subject)) return 3;
  return 1;
}

function priorityScore(year, level, province, subject) {
  return yearWeight(year) * levelWeight(level) * regionWeight(province) * subjectWeight(subject);
}

// ─── DB ─────────────────────────────────────────────────
function loadDatabaseUrl() {
  const text = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*DATABASE_URL\s*=\s*(.+?)\s*$/);
    if (m) return m[1];
  }
  throw new Error('[gap-analysis] DATABASE_URL missing');
}
const pool = new Pool({ connectionString: loadDatabaseUrl() });

// ─── 加载当前 DB 真实存量 ──────────────────────────────
async function loadCurrentInventory() {
  // 同时取 papers + questions
  const r = await pool.query(`
    SELECT
      p.id, p.year, p.subject, p.province_code, p.exam_level, p.paper_uid,
      (SELECT count(*) FROM public.exam_questions q WHERE q.paper_id = p.id) AS questions
    FROM public.exam_papers p
  `);
  const papers = r.rows;
  // 一些省份可能在 exam_questions 中存在但 exam_papers 没有 (孤儿), 也算
  const orphanR = await pool.query(`
    SELECT count(*) FROM public.exam_questions q
    LEFT JOIN public.exam_papers p ON q.paper_id = p.id
    WHERE p.id IS NULL
  `);
  return { papers, orphan_questions: Number(orphanR.rows[0].count) };
}

// ─── 主流程 ─────────────────────────────────────────────
async function main() {
  console.log('='.repeat(78));
  console.log(`  Dispatch 018 · 全国全量题库缺口侦察 · ${new Date().toISOString()}`);
  console.log('='.repeat(78));

  // 1) 加载当前存量
  const inventory = await loadCurrentInventory();
  console.log(`\n[1] 当前 DB 真实存量:`);
  console.log(`    exam_papers:    ${inventory.papers.length} 张`);
  console.log(`    orphan_q (无 paper): ${inventory.orphan_questions}`);
  console.log(`    exam_questions (总计): ${inventory.papers.reduce((s, p) => s + Number(p.questions), 0)} 题`);

  // 2) 构建已存在集合 (paper_uid-style key)
  const existingSet = new Set();
  const provinceStats = {};
  const subjectStats = {};
  const yearStats = {};
  for (const p of inventory.papers) {
    const key = `${p.year}|${p.subject}|${p.province_code}|${p.exam_level}`;
    existingSet.add(key);
    const ps = `${p.province_code}/${p.exam_level}`;
    provinceStats[ps] = (provinceStats[ps] || 0) + 1;
    subjectStats[p.subject] = (subjectStats[p.subject] || 0) + 1;
    yearStats[p.year] = (yearStats[p.year] || 0) + 1;
  }

  // 3) 构建理论全量矩阵
  const universe = [];
  for (const level of ['gaokao', 'zhongkao']) {
    const subjects = level === 'gaokao' ? GAOKAO_SUBJECTS : ZHONGKAO_SUBJECTS;
    const regions = [...ALL_PROVINCES, ...NATIONAL_PAPERS];
    for (const year of YEARS) {
      for (const province of regions) {
        for (const subject of subjects) {
          const key = `${year}|${subject}|${province}|${level}`;
          const exists = existingSet.has(key);
          const score = priorityScore(year, level, province, subject);
          universe.push({
            year, level, province, subject,
            exists,
            priority_score: score,
            expected_questions: 20  // 估算
          });
        }
      }
    }
  }

  // 4) 缺口 = 不存在的项
  const missing = universe.filter((u) => !u.exists).sort((a, b) => b.priority_score - a.priority_score);
  const present = universe.filter((u) => u.exists);

  console.log(`\n[2] 理论全量矩阵: ${universe.length} 项`);
  console.log(`    已存在: ${present.length} (${(present.length / universe.length * 100).toFixed(2)}%)`);
  console.log(`    缺失:   ${missing.length} (${(missing.length / universe.length * 100).toFixed(2)}%)`);

  // 5) 覆盖率统计 (按维度)
  const coverage = {
    by_year: {},
    by_subject: {},
    by_province: {},
    by_level: {}
  };

  // 按 year
  for (const year of YEARS) {
    const total = GAOKAO_SUBJECTS.length * (ALL_PROVINCES.length + NATIONAL_PAPERS.length) +
                  ZHONGKAO_SUBJECTS.length * (ALL_PROVINCES.length + NATIONAL_PAPERS.length);
    // 简化: 按 (gaokao + zhongkao) 一起算
    const have = present.filter((u) => u.year === year).length;
    coverage.by_year[year] = {
      present: have,
      total,
      pct: total > 0 ? Number(((have / total) * 100).toFixed(2)) : 0
    };
  }

  // 按 subject (跨所有 year + level + province)
  const allSubjects = [...new Set([...GAOKAO_SUBJECTS, ...ZHONGKAO_SUBJECTS])];
  for (const subject of allSubjects) {
    const total = YEARS.length * 2 * (ALL_PROVINCES.length + NATIONAL_PAPERS.length);  // 2 levels
    const have = present.filter((u) => u.subject === subject).length;
    coverage.by_subject[subject] = {
      present: have,
      total,
      pct: total > 0 ? Number(((have / total) * 100).toFixed(2)) : 0
    };
  }

  // 按 province
  const allRegions = [...ALL_PROVINCES, ...NATIONAL_PAPERS];
  for (const province of allRegions) {
    const total = YEARS.length * GAOKAO_SUBJECTS.length + YEARS.length * ZHONGKAO_SUBJECTS.length;
    const have = present.filter((u) => u.province === province).length;
    coverage.by_province[province] = {
      present: have,
      total,
      pct: total > 0 ? Number(((have / total) * 100).toFixed(2)) : 0
    };
  }

  // 按 level
  for (const level of ['gaokao', 'zhongkao']) {
    const subjects = level === 'gaokao' ? GAOKAO_SUBJECTS : ZHONGKAO_SUBJECTS;
    const total = YEARS.length * subjects.length * (ALL_PROVINCES.length + NATIONAL_PAPERS.length);
    const have = present.filter((u) => u.level === level).length;
    coverage.by_level[level] = {
      present: have,
      total,
      pct: total > 0 ? Number(((have / total) * 100).toFixed(2)) : 0
    };
  }

  console.log(`\n[3] 覆盖率统计 (按维度):`);
  console.log(`    按年份: ${Object.entries(coverage.by_year).map(([y, c]) => `${y}:${c.pct}%`).join(', ')}`);
  console.log(`    按学科: ${Object.entries(coverage.by_subject).map(([s, c]) => `${s}:${c.pct}%`).join(', ')}`);
  console.log(`    按级别: ${Object.entries(coverage.by_level).map(([l, c]) => `${l}:${c.pct}%`).join(', ')}`);
  console.log(`    按省份 (Top 5 + Bottom 5):`);
  const sortedProv = Object.entries(coverage.by_province).sort((a, b) => b[1].pct - a[1].pct);
  console.log(`      Top: ${sortedProv.slice(0, 5).map(([p, c]) => `${p}:${c.pct}%`).join(', ')}`);
  console.log(`      Bottom: ${sortedProv.slice(-5).map(([p, c]) => `${p}:${c.pct}%`).join(', ')}`);

  // 6) Top 20 高优先级缺口
  const top20 = missing.slice(0, 20);
  console.log(`\n[4] 🔥 高优先级缺口 Top ${top20.length} (请用户优先投放):`);
  top20.forEach((m, i) => {
    console.log(`    ${String(i + 1).padStart(2, ' ')}. [P:${m.priority_score}] ${m.year} | ${m.level} | ${m.province} | ${m.subject}`);
  });

  // 7) 用户投喂指引
  const userGuide = {
    directory_pattern: `database/incoming/{exam_level}/{subject}/{year}/`,
    naming_recommendation: '{year}_{province}_{exam_level}_{subject}.docx 或 .json',
    example: 'database/incoming/gaokao/math/2024/beijing_2024_gaokao_math.docx',
    priority_tiers: [
      { tier: 'TIER 1 (P>=500)', description: '全国卷/新高考I-II × 主科 × 近 6 年', action: '优先投放' },
      { tier: 'TIER 2 (P>=125)', description: '教育大省主科 × 近 6 年', action: '次优先' },
      { tier: 'TIER 3 (P>=50)',  description: '主科 × 2015-2019 / 副科 × 近 6 年', action: '按需投放' },
      { tier: 'TIER 4 (P<50)',    description: '其他省份 × 2008-2014', action: '资源充裕时补全' }
    ]
  };

  console.log(`\n[5] 👤 致用户投喂指引:`);
  console.log(`    目录模板: ${userGuide.directory_pattern}`);
  console.log(`    文件命名: ${userGuide.naming_recommendation}`);
  console.log(`    示例:     ${userGuide.example}`);

  // 8) 写报告
  const report = {
    run_label: RUN_LABEL,
    timestamp: new Date().toISOString(),
    current_inventory: {
      papers: inventory.papers.length,
      orphan_questions: inventory.orphan_questions,
      total_questions: inventory.papers.reduce((s, p) => s + Number(p.questions), 0),
      by_year: yearStats,
      by_subject: subjectStats,
      by_province_level: provinceStats
    },
    theoretical_universe: {
      total: universe.length,
      present: present.length,
      missing: missing.length,
      coverage_pct: Number(((present.length / universe.length) * 100).toFixed(4))
    },
    coverage_stats: coverage,
    missing_papers: missing,  // 全量缺失 (共 ~14,290 项)
    top_20_priority_gaps: top20,
    user_upload_guide: userGuide,
    weights: {
      year: { '2020-2025': 10, '2015-2019': 5, '2008-2014': 1 },
      level: { gaokao: 5, zhongkao: 2 },
      region: { national_papers: 10, key_provinces: 5, others: 2 },
      subject: { main_3: 5, physics_history: 3, others: 1 }
    }
  };

  const outDir = path.join(ROOT, 'docs', 'audits');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'data-gap-matrix.json');
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(`\n[6] 报告 → ${outPath} (${(JSON.stringify(report).length / 1024).toFixed(1)} KB)`);

  await pool.end();
}

main().catch(async (e) => {
  console.error('[gap-analysis] FATAL', e);
  await pool.end().catch(() => {});
  process.exit(2);
});
