// tests/scripts/check-nginx-conf.test.js — 门禁第 6 项子检查的回归用例
//
// 被测量: scripts/check-nginx-conf.mjs
// 背景: 2026-09-17 deploy/uibe.conf 误留一行重复的 `upstream tutor_server {`,
//       nginx -t 早已报 [emerg], 却存活 3 天 —— 因为 deploy/*.conf 既不参与构建,
//       也不参与任何门禁。该脚本把这类错误变成长效拦截, 本文件保证它不会退化。
//
// 用例设计: 每个用例注入一个**真实故障**(前 3 个不依赖 nginx, 最后 1 个需要 nginx)。
// 运行: npx vitest run tests/scripts/check-nginx-conf.test.js
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CHECKER = fileURLToPath(new URL('../../scripts/check-nginx-conf.mjs', import.meta.url));

function toolAvailable(cmd) {
  try {
    execFileSync('bash', ['-c', `command -v ${cmd}`], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// 拼写错误这类「静态看不出来」的错误只有 nginx 能判; 缺 nginx/openssl 时该用例跳过
const NGINX_READY = toolAvailable('nginx') && toolAvailable('openssl');
const itWithNginx = NGINX_READY ? it : it.skip;

// 跑一次检查器, 返回 { code, out }
function runChecker(conf) {
  const dir = mkdtempSync(path.join(tmpdir(), 'ngx-case-'));
  try {
    const fixture = path.join(dir, 'case.conf');
    writeFileSync(fixture, conf);
    try {
      const out = execFileSync('node', [CHECKER, fixture], { encoding: 'utf8' });
      return { code: 0, out };
    } catch (e) {
      return { code: e.status ?? 1, out: `${e.stdout || ''}${e.stderr || ''}` };
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// 最小合法配置: listen 8080 用非特权端口, 避免非 root 下的 bind 噪音
const VALID = `upstream demo_up {
    server 127.0.0.1:3002;
    keepalive 64;
}
server {
    listen 8080;
    location / { return 200; }
}
`;

describe('check-nginx-conf (门禁 6/6 子项)', () => {
  it('合法配置 → 通过 (退出码 0)', () => {
    const { code, out } = runChecker(VALID);
    expect(code).toBe(0);
    expect(out).toContain('nginx 模板校验通过');
  });

  it('重复 upstream 块 → 拦截 (2026-09-17 uibe.conf 原样故障)', () => {
    const { code, out } = runChecker(
      VALID.replace('upstream demo_up {', 'upstream demo_up {\n\nupstream demo_up {'),
    );
    expect(code).toBe(1);
    expect(out).toMatch(/upstream 'demo_up' 重复定义/);
  });

  it('花括号不平衡 → 拦截', () => {
    const { code, out } = runChecker(`${VALID}\nserver {\n`);
    expect(code).toBe(1);
    expect(out).toMatch(/花括号不平衡/);
  });

  itWithNginx('指令拼写错误 (keepalive → keepaliv) → 拦截', () => {
    const { code, out } = runChecker(VALID.replace('keepalive 64;', 'keepaliv 64;'));
    expect(code).toBe(1);
    expect(out).toMatch(/unknown directive "keepaliv"/);
  });
});
