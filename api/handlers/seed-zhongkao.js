// api/handlers/seed-zhongkao.js — 中考知识点入库 (D068, 2026-08-17)
//
// 将 database/seed_knowledge_points_zhongkao.json 中的 45 个中考知识点
// 幂等导入 knowledge_points 表 (level='zhongkao')
//
// 用法: node -e "import('./api/handlers/seed-zhongkao.js').then(m => m.seedZhongkao())"
//   或 被 ensureSeeds.js 调用

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDb } from '../core/db.js';
import { logger } from '../core/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const INPUT_FILE = join(ROOT, 'database', 'seed_knowledge_points_zhongkao.json');

/**
 * 幂等导入中考知识点. 只在 level='zhongkao' 行为 0 时执行.
 * @returns {Promise<{seeded: boolean, count?: number, reason?: string}>}
 */
export async function seedZhongkao() {
  const pool = await getDb();

  // 检查是否已有中考知识点
  const r = await pool.query("SELECT COUNT(*)::int AS n FROM knowledge_points WHERE level = 'zhongkao'");
  if (r.rows[0].n > 0) {
    return { seeded: false, reason: `中考知识点已有 ${r.rows[0].n} 条, 跳过` };
  }

  logger.info('[Seed] 中考知识点为空, 执行自动导入…');
  const data = JSON.parse(readFileSync(INPUT_FILE, 'utf-8'));
  logger.info(`[Seed] 读取: ${INPUT_FILE} (${data.length} 条)`);

  // 确保扩展列存在 (与 seed-textbook-knowledge.js 同步)
  const alterStatements = [
    'ALTER TABLE knowledge_points ADD COLUMN IF NOT EXISTS module VARCHAR(200)',
    'ALTER TABLE knowledge_points ADD COLUMN IF NOT EXISTS textbook VARCHAR(100)',
    'ALTER TABLE knowledge_points ADD COLUMN IF NOT EXISTS volume VARCHAR(50)',
    'ALTER TABLE knowledge_points ADD COLUMN IF NOT EXISTS volume_code VARCHAR(10)',
    'ALTER TABLE knowledge_points ADD COLUMN IF NOT EXISTS content TEXT',
    'ALTER TABLE knowledge_points ADD COLUMN IF NOT EXISTS source VARCHAR(200)',
    'ALTER TABLE knowledge_points ADD COLUMN IF NOT EXISTS tags TEXT DEFAULT \'[]\'',
  ];
  for (const sql of alterStatements) {
    try { await pool.query(sql); } catch { /* 忽略已存在错误 */ }
  }

  let inserted = 0, failed = 0;
  for (const kp of data) {
    try {
      await pool.query(
        `INSERT INTO knowledge_points
          (id, subject, name, subtopics, difficulty, frequency, description, level, module, tags)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (id) DO UPDATE SET
          subject = EXCLUDED.subject, name = EXCLUDED.name, level = EXCLUDED.level,
          difficulty = EXCLUDED.difficulty, frequency = EXCLUDED.frequency,
          module = EXCLUDED.module, tags = EXCLUDED.tags, updated_at = NOW()`,
        [
          kp.id, kp.subject, kp.name, JSON.stringify([]),
          kp.difficulty || 3, kp.frequency || 'medium',
          kp.summary || '', kp.level || 'zhongkao',
          kp.module || '', JSON.stringify(kp.tags || []),
        ]
      );
      inserted++;
    } catch (err) {
      failed++;
      if (failed <= 3) logger.error(`[Seed] ${kp.id} 失败: ${err.message}`);
    }
  }

  logger.info(`[Seed] 中考知识点导入完成: 新增 ${inserted}, 失败 ${failed}`);
  return { seeded: true, count: inserted };
}
