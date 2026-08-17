// api/core/ensureSeeds.js — 启动时幂等 seed (Phase 3, 2026-08-15)
//
// 用户要求: "docker compose up 自动 migration → seed → ready, 不要人工插".
// 做法: 应用启动时检查 knowledge_points, 为空则自动导入教材知识点
//       (database/graphify-gaokao-knowledge/textbook_knowledge.json, 381 条, 幂等 upsert).
// D068 (2026-08-17): 新增中考知识点自动导入
//       (database/seed_knowledge_points_zhongkao.json, 45 条, 幂等 upsert).
import { execFileSync } from 'node:child_process';
import { getDb } from './db.js';
import { logger } from './logger.js';
import { seedZhongkao } from '../handlers/seed-zhongkao.js';

/**
 * 启动 seed 检查. 幂等:
 *   1. 高考知识点: 全空则导入 (381 条)
 *   2. 中考知识点: level='zhongkao' 为 0 则导入 (45 条)
 * @returns {Promise<{seeded: boolean, count?: number, reason?: string}>}
 */
export async function ensureSeeds() {
  const results = [];

  // ── 1. 高考知识点 (整体为空时导入) ──
  try {
    const pool = await getDb();
    const r = await pool.query('SELECT COUNT(*)::int AS n FROM knowledge_points');
    if (r.rows[0].n > 0) {
      logger.info(`[Seed] 跳过: knowledge_points 已有 ${r.rows[0].n} 条, 跳过高考导入`);
    } else {
      logger.info('[Seed] knowledge_points 为空, 执行教材知识点自动导入…');
      execFileSync(process.execPath, ['scripts/seed-textbook-knowledge.js'], {
        stdio: 'inherit',
        cwd: process.cwd(),
        env: process.env,
      });
      results.push('高考知识点导入完成');
    }
  } catch (e) {
    logger.error('[Seed] 高考知识点自动导入失败', { error: e.message });
  }

  // ── 2. 中考知识点 (level='zhongkao' 为 0 时导入, D068) ──
  try {
    const result = await seedZhongkao();
    if (result.seeded) {
      results.push(`中考知识点导入完成 (${result.count} 条)`);
    } else {
      logger.info(`[Seed] 跳过: ${result.reason}`);
    }
  } catch (e) {
    logger.error('[Seed] 中考知识点自动导入失败', { error: e.message });
  }

  // 返回最终状态
  try {
    const pool = await getDb();
    const r = await pool.query('SELECT COUNT(*)::int AS n FROM knowledge_points');
    return { seeded: results.length > 0, count: r.rows[0].n, details: results };
  } catch {
    return { seeded: results.length > 0, details: results };
  }
}
