// tests/scripts/check-no-host-header-ssrf.test.js — 门禁第 6/7 项子检查的回归用例
//
// 被测量: scripts/check-no-host-header-ssrf.mjs
// 背景: 2026-09-22 全仓安全扫描 F1–F3 —— api/handlers/essay 三处用
//       `req.get('host')` + `req.protocol` 拼内部自调用地址, 并把调用方 JWT
//       转发出去。纯正则的静态闸门最容易"静默退化" (改一行正则就不再命中),
//       因此这里用**真实故障**夹具反向验证它仍然拦得住, 并用仓库本体验证
//       修完之后是绿的。
//
// 运行: npx vitest run tests/scripts/check-no-host-header-ssrf.test.js
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const CHECKER = path.join(ROOT, 'scripts/check-no-host-header-ssrf.mjs');

// 在临时目录里跑检查器 (SCAN_ROOTS 相对 cwd): 返回 { code, out }
function runOn(files, cwd = null) {
  const dir = mkdtempSync(path.join(tmpdir(), 'ssrf-case-'));
  try {
    for (const [rel, body] of Object.entries(files)) {
      const full = path.join(dir, rel);
      mkdirSync(path.dirname(full), { recursive: true });
      writeFileSync(full, body);
    }
    try {
      const out = execFileSync('node', [CHECKER], {
        cwd: cwd ?? dir,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      return { code: 0, out };
    } catch (e) {
      return { code: e.status ?? 1, out: `${e.stdout || ''}${e.stderr || ''}` };
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// 故障夹具 1: 原始故障形态 (变量分别取自 req, 再拼 URL, 再 fetch)
const VULN_INDIRECT = `export async function call(req) {
  const authHeader = req.headers.authorization;
  const proto = (req && req.protocol) || 'http';
  const host = (req && req.get && req.get('host')) || 'localhost:3002';
  const url = \`\${proto}://\${host}/api/proxy\`;
  const resp = await fetch(url, { headers: { Authorization: authHeader } });
  return resp;
}
`;

// 故障夹具 2: 内联形态 (同一行里读头 + 拼 URL + 外发)
const VULN_INLINE = `export async function call(req) {
  return fetch(\`\${req.protocol}://\${req.get('host')}/api/proxy\`, { method: 'POST' });
}
`;

// 故障夹具 3: 解构 req.headers + 字符串拼接 + axios
const VULN_DESTR = `export async function call(req) {
  const { host } = req.headers;
  const url = 'http://' + host + '/api/proxy';
  return axios.post(url, {});
}
`;

// 放行夹具: 配置化/本机常量基址 (修复后的写法)
const SAFE = `const SELF_BASE_URL = process.env.SELF_BASE_URL || \`http://127.0.0.1:\${process.env.PORT || 3002}\`;
export async function call(authHeader) {
  return fetch(\`\${SELF_BASE_URL}/api/proxy\`, { headers: { Authorization: authHeader } });
}
`;

// 放行夹具: 只解析/比对请求头 (CSRF 同源校验), 不外发
const SAFE_PARSE_ONLY = `export function sameOrigin(req) {
  const origin = req.headers.origin;
  const originUrl = new URL(origin);
  return originUrl.origin === 'http://localhost:3002';
}
`;

describe('check-no-host-header-ssrf (门禁 6/7 子项)', () => {
  it('变量取自 req 的 host/protocol 再拼 URL → 拦截, 并给出 file:line', () => {
    const { code, out } = runOn({ 'api/vuln1.js': VULN_INDIRECT });
    expect(code).toBe(1);
    expect(out).toMatch(/api\/vuln1\.js:5/);
  });

  it('内联形态: 同一行读头 + 拼 URL + 外发 → 拦截', () => {
    const { code, out } = runOn({ 'api/vuln2.js': VULN_INLINE });
    expect(code).toBe(1);
    expect(out).toMatch(/api\/vuln2\.js:2/);
  });

  it('解构 req.headers + 字符串拼接 + axios → 拦截', () => {
    const { code, out } = runOn({ 'api/vuln3.js': VULN_DESTR });
    expect(code).toBe(1);
    expect(out).toMatch(/api\/vuln3\.js:3/);
  });

  it('配置化自身基址 (修复后写法) → 放行', () => {
    const { code, out } = runOn({ 'api/safe.js': SAFE });
    expect(code).toBe(0);
    expect(out).toContain('✓');
  });

  it('仅解析/比对请求头 (CSRF) → 放行 (不外发, 非 SSRF)', () => {
    const { code } = runOn({ 'api/safe-parse.js': SAFE_PARSE_ONLY });
    expect(code).toBe(0);
  });

  // 修完之后仓库必须是绿的: 这条同时是【1】的验收
  it('仓库本体当前通过 (SSRF 已修复)', () => {
    const { code, out } = runOn({}, ROOT);
    expect(code).toBe(0);
    expect(out).toContain('✓');
  });
});
