/* ============================================================================
 * rubricLoader.js — D086 §12 L4 V1.0 · 评分标准配置加载器
 *
 * 职责: 根据 (subject, exam_level) 加载对应 rubric JSON, 注入到 Stage B prompt.
 * 缓存: 进程级 LRU (V1.0: 简单 Map, 4 份配置总共不到 10KB).
 *
 * 调用方: api/handlers/essay/gradeService.js#buildGradePrompt
 * ============================================================================ */

'use strict';

import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../../core/logger.js';

// ────────────────────────────────────────────────────────────────────────────
// 路径解析
// ────────────────────────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const RUBRICS_DIR = join(__dirname, 'rubrics');

// ────────────────────────────────────────────────────────────────────────────
// 缓存
// ────────────────────────────────────────────────────────────────────────────

const cache = new Map();

/**
 * 清空缓存 (测试 / 热重载用, 不导出避免生产误用)
 */
export function _clearRubricCache() {
  cache.clear();
}

// ────────────────────────────────────────────────────────────────────────────
// 公开 API
// ────────────────────────────────────────────────────────────────────────────

/**
 * 加载指定 (subject, exam_level) 的 rubric 配置.
 *
 * @param {'chinese'|'english'} subject
 * @param {'gaokao'|'zhongkao'} exam_level
 * @returns {Promise<object|null>} rubric 对象, 不存在时返回 null (由 service 抛 ErrorCode)
 */
export async function loadRubric(subject, exam_level) {
  const key = `${subject}_${exam_level}_v1`;

  // 1. 命中缓存
  if (cache.has(key)) return cache.get(key);

  // 2. 读文件
  const filePath = join(RUBRICS_DIR, `${key}.json`);
  let raw;
  try {
    raw = await readFile(filePath, 'utf-8');
  } catch (e) {
    if (e.code === 'ENOENT') {
      logger.warn(`[rubricLoader] rubric 不存在: ${key} (path: ${filePath})`);
      return null;
    }
    logger.error(`[rubricLoader] rubric 读取失败: ${key}`, { error: e });
    throw e;
  }

  // 3. parse + 二次校验
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    logger.error(`[rubricLoader] rubric JSON 解析失败: ${key}`, { error: e });
    return null;
  }

  // 4. 业务校验: 关键字段必须存在
  if (!parsed.id || !Array.isArray(parsed.dimensions) || parsed.dimensions.length === 0) {
    logger.error(`[rubricLoader] rubric 结构不合法: ${key}`, { parsed });
    return null;
  }

  // 5. 缓存 + 返回
  cache.set(key, parsed);
  logger.info(`[rubricLoader] rubric 已加载: ${key} (v${parsed.version})`);
  return parsed;
}

/**
 * 把 rubric 渲染为 markdown 表格, 注入到 prompt {{RUBRIC_TABLE}} 占位.
 *
 * 输出格式:
 *   | 维度 | 满分 | 评分标准 |
 *   |------|------|----------|
 *   | 内容 | 20分 | 17-20: ... |
 *   | 内容 | 20分 | 13-16: ... |
 *   | 语言 | 20分 | 17-20: ... |
 *   ...
 *
 * @param {object} rubric
 * @returns {string}
 */
export function renderRubricTable(rubric) {
  if (!rubric || !Array.isArray(rubric.dimensions)) return '(rubric 不可用)';
  const lines = ['| 维度 | 满分 | 评分标准 |', '|------|------|----------|'];
  for (const dim of rubric.dimensions) {
    for (const c of dim.criteria || []) {
      const [lo, hi] = c.range || [0, dim.max];
      lines.push(`| ${dim.name_cn} | ${dim.max}分 | ${lo}-${hi}: ${c.desc} |`);
    }
  }
  return lines.join('\n');
}
