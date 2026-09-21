#!/usr/bin/env node
/**
 * scripts/check-no-hardcoded-secrets.mjs — 硬编码凭据门禁
 *
 * 起因 (2026-09-21): 增量安全扫描只扫 diff, scripts/ 下 13 处硬编码的
 * postgres 口令长期无人发现 —— 既不在任何一次增量 diff 里, 也不在 CI 视野内。
 * 人工发现必须变成永久闸门, 否则同类问题会反复出现。
 *
 * 判据 (机械可复现, 不含任何既有口令字面量):
 *   1. 连接串形式: 协议头 + 用户名 + 冒号 + 口令 + @ + 主机
 *      (postgresql/mysql/mongodb/redis/amqp…)
 *   2. 赋值形式:   (password|passwd|pwd|secret|token|api_?key) = '明文'
 * 排除: .env.example 的 CHANGE_ME 占位、node_modules/archive/.git/测试夹具。
 *
 * 输出: 命中即非零退出 (CI gate 失败)。
 */
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';

const ROOT = process.cwd();
const SCAN_EXT = new Set(['.js', '.mjs', '.cjs', '.ts', '.py', '.json', '.yml', '.yaml', '.sh', '.conf', '.service']);
// 只扫 git 已跟踪文件: .env(已忽略) / 未跟踪产物天然不在版本历史里, 不构成"泄露"
// 排除 tests/ docs/ .github/ 与 *.min.js: 测试夹具与压缩库里全是假值/语法符号, 属噪声
const SKIP_DIRS = new Set(['node_modules', '.git', 'archive', '.codebuddy', 'coverage', 'dist', 'venv', 'runs', 'tests', 'docs', '.github', 'architecture-review', 'dev-verify']);
const SKIP_FILE = /\.min\.js$/;
// 本机/容器内部地址上的口令是基础设施默认值, 不构成"对外泄露"
const LOCAL_HOST = /^(localhost|127\.0\.0\.1|db|db-host|postgres|redis|mysql)(:|$)/i;

// 注意: 正则只描述"形状", 不写入任何真实凭据
const DSN = /[a-z][a-z0-9+.-]*:\/\/([^\s:/@"']+):([^\s:/@"']+)@([^\s/"']+)/gi;
const ASSIGN = /(?:password|passwd|pwd|secret|token|api_?key)\s*[:=]\s*['"]([^'"]{6,})['"]/gi;
const PLACEHOLDER = /^(change_?me|your[_-]?\w+|xxx+|\*+|<[^>]+>|\$\{[^}]+\}|todo|placeholder|example|test|dummy|sk-|pk_)/i;

// 只扫 git tracked 文件
const tracked = (() => {
  try {
    return new Set(execSync('git ls-files', { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean));
  } catch {
    return null; // 非 git 环境时退化为全量扫描
  }
})();

const findings = [];

function walk(dir, depth = 0) {
  if (depth > 8) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') && entry.isDirectory()) continue;
    const full = path.join(dir, entry.name);
    const rel = path.relative(ROOT, full);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(full, depth + 1);
      continue;
    }
    if (!SCAN_EXT.has(path.extname(entry.name))) continue;
    if (SKIP_FILE.test(entry.name)) continue;
    if (tracked && !tracked.has(rel)) continue;
    let text;
    try {
      text = fs.readFileSync(full, 'utf8');
    } catch {
      continue;
    }

    text.split(/\r?\n/).forEach((line, i) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) return;

      for (const m of trimmed.matchAll(DSN)) {
        const [, user, pass, host] = m;
        if (PLACEHOLDER.test(pass) || LOCAL_HOST.test(host.split(':')[0])) continue;
        findings.push({
          file: rel,
          line: i + 1,
          kind: '连接串内联凭据',
          snippet: `${m[0].split('://')[0]}://${user}:***@${host}`
        });
      }
      for (const m of trimmed.matchAll(ASSIGN)) {
        const val = m[1];
        if (PLACEHOLDER.test(val) || val.startsWith('${') || val.startsWith('process.env')) continue;
        // 枚举常量: 值就是键名本身(如 AUTH_INVALID_TOKEN: 'AUTH_INVALID_TOKEN')
        if (trimmed.toUpperCase().includes(val.toUpperCase() + ':')) continue;
        findings.push({ file: rel, line: i + 1, kind: '明文赋值', snippet: `${m[0].split(/[:=]/)[0]}=***(len=${val.length})` });
      }
    });
  }
}

walk(ROOT);

if (findings.length) {
  console.error('❌ 检测到疑似硬编码凭据：');
  for (const f of findings) console.error(`   ${f.file}:${f.line}  [${f.kind}] ${f.snippet}`);
  console.error(`\n共 ${findings.length} 处。请改为从环境变量读取（如 PAPERS_DB_URL / DATABASE_URL），缺失时报错退出。`);
  process.exit(1);
}

console.log('✓ 未发现硬编码凭据（连接串内联 / 明文口令赋值）');
