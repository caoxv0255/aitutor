#!/usr/bin/env node
/**
 * seed-textbook-knowledge.js
 * 将 textbook_knowledge.json 中的 381 个教材知识点幂等导入 knowledge_points 表
 *
 * 用法:
 *   node scripts/seed-textbook-knowledge.js
 *
 * 输入: database/graphify-gaokao-knowledge/textbook_knowledge.json
 * 输出: knowledge_points 表（新增/更新，不删除旧数据）
 *
 * 前置条件:
 *   1. PostgreSQL 已启动，DATABASE_URL 已配置
 *   2. api/core/db.js 的 initTables() 已执行（含 ALTER TABLE 迁移）
 */

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const INPUT_FILE = join(ROOT, 'database', 'graphify-gaokao-knowledge', 'textbook_knowledge.json');

async function main() {
  console.log('=== 教材知识点入库脚本 ===\n');

  if (!process.env.DATABASE_URL) {
    console.error('❌ 环境变量 DATABASE_URL 未配置，请检查 .env 文件');
    process.exit(1);
  }

  // 读取数据
  console.log(`📂 读取: ${INPUT_FILE}`);
  const data = JSON.parse(readFileSync(INPUT_FILE, 'utf-8'));
  console.log(`   共 ${data.length} 条教材知识点\n`);

  // 连接数据库
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

  try {
    // 确保新列存在（幂等迁移，与 db.js initTables 同步）
    const alterStatements = [
      `ALTER TABLE knowledge_points ADD COLUMN IF NOT EXISTS module VARCHAR(200)`,
      `ALTER TABLE knowledge_points ADD COLUMN IF NOT EXISTS textbook VARCHAR(100)`,
      `ALTER TABLE knowledge_points ADD COLUMN IF NOT EXISTS volume VARCHAR(50)`,
      `ALTER TABLE knowledge_points ADD COLUMN IF NOT EXISTS volume_code VARCHAR(10)`,
      `ALTER TABLE knowledge_points ADD COLUMN IF NOT EXISTS content TEXT`,
      `ALTER TABLE knowledge_points ADD COLUMN IF NOT EXISTS source VARCHAR(200)`,
      `ALTER TABLE knowledge_points ADD COLUMN IF NOT EXISTS tags TEXT DEFAULT '[]'`,
    ];
    for (const sql of alterStatements) {
      try { await pool.query(sql); } catch { /* 忽略已存在错误 */ }
    }

    // 统计
    const stats = { inserted: 0, updated: 0, failed: 0 };

    // 查询已有 ID 集合（用于区分新增/更新）
    const existingResult = await pool.query('SELECT id FROM knowledge_points');
    const existingIds = new Set(existingResult.rows.map(r => r.id));
    console.log(`📊 数据库现有知识点: ${existingIds.size} 条\n`);

    // 逐条幂等写入
    console.log(`📤 开始导入 ${data.length} 条教材知识点...\n`);

    for (let i = 0; i < data.length; i++) {
      const kp = data[i];
      try {
        const isNew = !existingIds.has(kp.id);

        await pool.query(
          `INSERT INTO knowledge_points
            (id, subject, name, subtopics, difficulty, frequency, description, level,
             module, textbook, volume, volume_code, content, source, tags)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
           ON CONFLICT (id) DO UPDATE SET
             subject = EXCLUDED.subject,
             name = EXCLUDED.name,
             subtopics = EXCLUDED.subtopics,
             difficulty = EXCLUDED.difficulty,
             frequency = EXCLUDED.frequency,
             description = EXCLUDED.description,
             level = EXCLUDED.level,
             module = EXCLUDED.module,
             textbook = EXCLUDED.textbook,
             volume = EXCLUDED.volume,
             volume_code = EXCLUDED.volume_code,
             content = EXCLUDED.content,
             source = EXCLUDED.source,
             tags = EXCLUDED.tags,
             updated_at = NOW()`,
          [
            kp.id,
            kp.subject,
            kp.name,
            JSON.stringify([]),          // subtopics（教材数据无子主题）
            kp.difficulty || 3,
            kp.frequency || 'medium',
            kp.summary || kp.content?.slice(0, 300) || '',  // description = summary
            kp.level || 'gaokao',
            kp.module || '',
            kp.textbook || '',
            kp.volume || '',
            kp.volume_code || '',
            kp.content || '',
            kp.source || '',
            JSON.stringify(kp.tags || []),
          ]
        );

        if (isNew) {
          stats.inserted++;
        } else {
          stats.updated++;
        }

        // 进度输出
        if ((i + 1) % 50 === 0 || i === data.length - 1) {
          console.log(`   进度: ${i + 1}/${data.length}`);
        }
      } catch (err) {
        stats.failed++;
        if (stats.failed <= 5) {
          console.error(`   ❌ ${kp.id} 失败: ${err.message}`);
        }
      }
    }

    // 最终统计
    console.log('\n╔══════════════════════════════════════╗');
    console.log('║          入库统计报告                ║');
    console.log('╠══════════════════════════════════════╣');
    console.log(`║  新增:     ${String(stats.inserted).padStart(6)} 条              ║`);
    console.log(`║  更新:     ${String(stats.updated).padStart(6)} 条              ║`);
    console.log(`║  失败:     ${String(stats.failed).padStart(6)} 条              ║`);
    console.log(`║  总计:     ${String(data.length).padStart(6)} 条              ║`);
    console.log('╚══════════════════════════════════════╝');

    // 验证总数
    const finalResult = await pool.query('SELECT COUNT(*) as count FROM knowledge_points');
    console.log(`\n📊 数据库当前知识点总数: ${finalResult.rows[0].count} 条`);

    // 按学科统计
    const bySubject = await pool.query(
      'SELECT subject, COUNT(*) as count FROM knowledge_points GROUP BY subject ORDER BY subject'
    );
    console.log('\n📚 各学科分布:');
    for (const row of bySubject.rows) {
      console.log(`   ${row.subject}: ${row.count} 条`);
    }
  } catch (err) {
    console.error(`\n❌ 脚本执行失败: ${err.message}`);
    process.exit(1);
  } finally {
    await pool.end();
    console.log('\n🔌 数据库连接已关闭');
  }
}

main();
