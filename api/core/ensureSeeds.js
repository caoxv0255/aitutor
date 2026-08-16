// api/core/ensureSeeds.js — 启动时幂等 seed (Phase 3, 2026-08-15)
//
// 用户要求: "docker compose up 自动 migration → seed → ready, 不要人工插".
// 做法: 应用启动时检查 knowledge_points, 为空则自动导入教材知识点
//       (database/graphify-gaokao-knowledge/textbook_knowledge.json, 381 条, 幂等 upsert).
// 后续可扩展: provinces / subjects / 中考知识点 等 seed.
import { execFileSync } from 'node:child_process';
import { getDb } from './db.js';
import { logger } from './logger.js';

/**
 * 启动 seed 检查. 幂等: knowledge_points 非空即跳过.
 * @returns {Promise<{seeded: boolean, count?: number, reason?: string}>}
 */
export async function ensureSeeds() {
  try {
    const pool = await getDb();
    const r = await pool.query('SELECT COUNT(*)::int AS n FROM knowledge_points');
    if (r.rows[0].n > 0) {
      return { seeded: false, reason: `knowledge_points 已有 ${r.rows[0].n} 条, 跳过` };
    }
  } catch (e) {
    return { seeded: false, reason: `检查 knowledge_points 失败: ${e.message}` };
  }

  logger.info('[Seed] knowledge_points 为空, 执行教材知识点自动导入…');
  try {
    execFileSync(process.execPath, ['scripts/seed-textbook-knowledge.js'], {
      stdio: 'inherit',
      cwd: process.cwd(),
      env: process.env,
    });
    const pool = await getDb();
    const r = await pool.query('SELECT COUNT(*)::int AS n FROM knowledge_points');
    return { seeded: true, count: r.rows[0].n };
  } catch (e) {
    logger.error('[Seed] 自动导入失败', { error: e.message });
    return { seeded: false, reason: e.message };
  }
}
