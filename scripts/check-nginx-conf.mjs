#!/usr/bin/env node
/**
 * scripts/check-nginx-conf.mjs — 门禁 6/6 子项: 部署 nginx 配置模板校验
 *
 * 背景（2026-09-20 架构评审）: 2026-09-17 给 deploy/uibe.conf 加事故警告头时
 * 误留一行重复的 `upstream tutor_server {`, 使第二个 upstream 嵌套进第一个 ——
 * `nginx -t` 报 [emerg] "upstream" directive is not allowed here, 但**没人发现**,
 * 因为 deploy/*.conf 是模板, 既不参与构建也不参与任何门禁。本脚本把这类错误变成门禁项。
 *
 * 检查三层:
 *   1. 静态 ── 花括号平衡; upstream 块重名
 *   2. 语法 ── 本机有 nginx 时: 用 events{}+http{} 包一层, ssl 证书路径打桩成临时自签证书,
 *             pid/error_log 重定向到临时目录, 跑 `nginx -t`（避免依赖部署机的证书与权限）
 *   3. 降级 ── 无 nginx 或无 openssl 时只跑静态检查, 并显式打印 SKIP, 不伪装成通过
 *
 * 校验对象: `git ls-files 'deploy/*.conf'`（只看已入库的, 未跟踪模板不参与门禁）
 * 用法: node scripts/check-nginx-conf.mjs        退出码 0 = 通过, 1 = 有错
 */
import { execFileSync, execSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

function sh(cmd) {
  try {
    return { ok: true, out: execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) };
  } catch (e) {
    return { ok: false, out: `${e.stdout || ''}${e.stderr || ''}` };
  }
}

// ── 1. 静态检查 ────────────────────────────────────────────────
function staticCheck(file, src) {
  const problems = [];

  const open = (src.match(/\{/g) || []).length;
  const close = (src.match(/\}/g) || []).length;
  if (open !== close) problems.push(`花括号不平衡: ${open} 个 '{' vs ${close} 个 '}'`);

  const seen = new Map();
  const re = /^[ \t]*upstream[ \t]+([A-Za-z0-9_.-]+)[ \t]*\{/gm;
  let m;
  while ((m = re.exec(src)) !== null) {
    const name = m[1];
    const line = src.slice(0, m.index).split('\n').length;
    if (seen.has(name)) problems.push(`upstream '${name}' 重复定义 (line ${seen.get(name)} 与 line ${line})`);
    else seen.set(name, line);
  }

  return problems;
}

// ── 2. nginx -t（打桩）─────────────────────────────────────────
function nginxCheck(file, src, dir) {
  const hasNginx = sh('command -v nginx').ok;
  if (!hasNginx) return { status: 'skip', detail: '未安装 nginx' };

  const cert = path.join(dir, 'stub.crt');
  const key = path.join(dir, 'stub.key');
  const gen = sh(
    `openssl req -x509 -newkey rsa:2048 -nodes -keyout ${key} -out ${cert} -days 1 -subj "/CN=stub.local"`,
  );
  if (!gen.ok) return { status: 'skip', detail: 'openssl 不可用, 无法为 ssl_certificate 打桩' };

  // 打桩: 证书路径 + 日志路径都指向临时目录。
  // 模板里的 access_log/error_log 指向部署机上别的项目目录, 本机既无权限也非本仓,
  // 不打桩会让 nginx -t 报 [emerg] open() ... Permission denied, 掩盖真正的语法问题。
  const stub = src
    .replace(/^([ \t]*ssl_certificate[ \t]+)\S+;/gm, `$1${cert};`)
    .replace(/^([ \t]*ssl_certificate_key[ \t]+)\S+;/gm, `$1${key};`)
    .replace(/^([ \t]*ssl_trusted_certificate[ \t]+)\S+;/gm, `$1${cert};`)
    .replace(/^([ \t]*access_log[ \t]+)\S+[^;]*;/gm, `$1${path.join(dir, 'access.log')};`)
    .replace(/^([ \t]*error_log[ \t]+)\S+[^;]*;/gm, `$1${path.join(dir, 'error.log')};`);
  const stubPath = path.join(dir, 'stub.conf');
  writeFileSync(stubPath, stub);

  const wrapperPath = path.join(dir, 'wrapper.conf');
  writeFileSync(
    wrapperPath,
    // access_log off 覆盖 nginx 内置默认值 (/var/log/nginx/access.log),
    // 否则非 root 跑 -t 会因默认日志不可写而 [emerg]。
    `pid ${path.join(dir, 'nginx.pid')};\n` +
      `error_log ${path.join(dir, 'error.log')};\n` +
      `events {}\n` +
      `http {\n  access_log off;\n  include ${stubPath};\n}\n`,
  );

  const res = sh(`nginx -t -c ${wrapperPath} -p ${dir}`);
  const lines = (res.out || '')
    .split('\n')
    .filter((l) => !/could not open error log file/.test(l))
    .map((l) => l.replace(/^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2} /, '').trim())
    .filter(Boolean);

  // 判据: nginx 认为**配置本身**错时, emerg 一定带 `.conf:行号` 引用;
  //   而 bind() / open() 那类权限型 [emerg] 不带行号 —— 那是「本机不是部署机」的环境噪音
  //   (非 root 不能绑 443; /var/log/nginx 不可写)。这类不该算配置错误。
  const cfgErrors = lines.filter((l) => /\[emerg\]/.test(l) && /\.conf:\d+/.test(l));
  const envErrors = lines.filter((l) => /\[emerg\]/.test(l) && !/\.conf:\d+/.test(l));
  const syntaxOk = lines.some((l) => /syntax is ok/.test(l));

  if (cfgErrors.length === 0 && syntaxOk) {
    return { status: 'pass', detail: '', env: envErrors.length };
  }
  return {
    status: 'fail',
    detail: (cfgErrors.length ? cfgErrors : lines).slice(0, 4).join('\n          '),
  };
}

// ── main ──────────────────────────────────────────────────────
let files;
try {
  files = execFileSync('git', ['ls-files', 'deploy/*.conf'], { encoding: 'utf8' })
    .split('\n')
    .filter(Boolean);
} catch {
  files = [];
}

if (files.length === 0) {
  console.log('  ✓ nginx 模板校验: deploy/ 下无已入库的 *.conf (跳过)');
  process.exit(0);
}

let failed = 0;
let skipped = 0;
const dir = mkdtempSync(path.join(tmpdir(), 'ngx-conf-'));

try {
  for (const file of files) {
    const src = readFileSync(file, 'utf8');

    const problems = staticCheck(file, src);
    const ngx = nginxCheck(file, src, dir);

    if (ngx.status === 'skipped' || ngx.status === 'skip') skipped += 1;

    if (problems.length === 0 && ngx.status !== 'fail') {
      const suffix =
        ngx.status === 'pass'
          ? `静态 + nginx -t${ngx.env ? ` (语法 ok; 忽略 ${ngx.env} 条环境错误)` : ''}`
          : `静态 (nginx -t SKIP: ${ngx.detail})`;
      console.log(`    ✓ ${file} — ${suffix}`);
    } else {
      failed += 1;
      console.log(`    ✗ ${file}`);
      for (const p of problems) console.log(`        - ${p}`);
      if (ngx.status === 'fail') console.log(`        - nginx -t 失败:\n          ${ngx.detail}`);
    }
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}

if (failed === 0) {
  console.log(
    `  ✓ nginx 模板校验通过 (${files.length} 个文件${skipped ? `, ${skipped} 个仅静态检查` : ''})`,
  );
  process.exit(0);
}
console.log('');
console.log('  部署模板坏了不会在任何构建里暴露, 所以在这里拦。修完重跑 npm run gate。');
process.exit(1);
