#!/usr/bin/env node
/**
 * sync-knowledge-to-obsidian.js — 将知识点 Markdown 文件同步到 Obsidian Vault
 *
 * 通过 Obsidian Local REST API (HTTP 27123) 上传文件
 * 用法: node scripts/sync-knowledge-to-obsidian.js
 *
 * 输入: database/knowledge-points/{subject}/*.md
 * 输出: Obsidian Vault 中的 高考知识点知识库/{subject}/*.md
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const SOURCE_DIR = join(ROOT, 'database', 'knowledge-points');
const VAULT_PREFIX = '高考知识点知识库';
const API_HOST = '127.0.0.1';
const API_PORT = 27123;
const API_TOKEN = '32fc3ca1890097538cc75e39b7c590e17dc8cbee420f22364842dde7aff42835';

/**
 * 发送 HTTP PUT 请求上传文件到 Obsidian Vault
 */
function uploadFile(vaultPath, content) {
  return new Promise((resolve, reject) => {
    const encodedPath = encodeURIComponent(vaultPath).replace(/%2F/g, '/');
    const req = http.request({
      hostname: API_HOST,
      port: API_PORT,
      path: `/vault/${encodedPath}`,
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'text/markdown; charset=utf-8',
      },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.statusCode);
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data.substring(0, 200)}`));
        }
      });
    });
    req.on('error', reject);
    req.write(content, 'utf-8');
    req.end();
  });
}

/**
 * 递归扫描目录下所有 .md 文件
 */
function scanFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      files.push(...scanFiles(fullPath));
    } else if (entry.endsWith('.md')) {
      files.push(fullPath);
    }
  }
  return files;
}

/**
 * 延迟函数（避免 API 限流）
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║   Obsidian Vault 同步工具 (知识点 → Vault)              ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  // 扫描源文件
  console.log(`📂 扫描源目录: ${SOURCE_DIR}`);
  const files = scanFiles(SOURCE_DIR);
  console.log(`   发现 ${files.length} 个 Markdown 文件\n`);

  if (files.length === 0) {
    console.log('⚠️  未找到文件，请先运行 generate-obsidian-knowledge.js');
    return;
  }

  const stats = { uploaded: 0, failed: 0, skipped: 0, errors: [] };
  const startTime = Date.now();

  for (let i = 0; i < files.length; i++) {
    const filepath = files[i];
    const relPath = relative(SOURCE_DIR, filepath).replace(/\\/g, '/');
    const vaultPath = `${VAULT_PREFIX}/${relPath}`;

    try {
      const content = readFileSync(filepath, 'utf-8');
      await uploadFile(vaultPath, content);
      stats.uploaded++;

      if ((i + 1) % 50 === 0 || i === files.length - 1) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`   📤 进度: ${i + 1}/${files.length} (${elapsed}s) — ${vaultPath}`);
      }

      // 每上传 10 个文件暂停 100ms，避免 API 限流
      if ((i + 1) % 10 === 0) {
        await delay(100);
      }
    } catch (err) {
      stats.failed++;
      stats.errors.push(`${vaultPath}: ${err.message}`);
      if (stats.failed <= 5) {
        console.log(`   ❌ 失败: ${vaultPath} — ${err.message}`);
      }
    }
  }

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║              同步统计报告                            ║');
  console.log('╠══════════════════════════════════════════════════════╣');
  console.log(`║  总文件数:   ${String(files.length).padStart(6)} 个                            ║`);
  console.log(`║  上传成功:   ${String(stats.uploaded).padStart(6)} 个                            ║`);
  console.log(`║  上传失败:   ${String(stats.failed).padStart(6)} 个                            ║`);
  console.log(`║  耗时:       ${String(totalTime).padStart(6)} 秒                            ║`);
  console.log('╚══════════════════════════════════════════════════════╝');

  if (stats.errors.length > 0) {
    console.log('\n❌ 失败详情 (前10条):');
    stats.errors.slice(0, 10).forEach(e => console.log(`   • ${e}`));
  }

  console.log(`\n📂 Vault 路径: ${VAULT_PREFIX}/`);
  console.log('✅ 同步完成！可在 Obsidian 中查看知识库。');
}

main().catch(err => {
  console.error('❌ 同步失败:', err.message);
  process.exit(1);
});
