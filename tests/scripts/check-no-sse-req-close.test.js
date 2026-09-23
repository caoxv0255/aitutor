// tests/scripts/check-no-sse-req-close.test.js — SSE 禁 req.on('close') 门禁的回归用例
//
// 被测量: scripts/check-no-sse-req-close.mjs
// 背景: 2026-09-23 实测 —— api/routes/tutor-agent.js 的 /ask/stream 原用
//       req.on('close') 判客户端断连。Node 22 下请求体被 express.json 读完即触发
//       req 'close', 导致整条 SSE 流为空。改用 res.on('close') 修复。
//       这里用临时目录夹具反向验证: 门禁拦得住流式场景的 req.on('close'),
//       又不会误杀非流式请求的清理逻辑; 再用仓库本体验证修复后是绿的。
//       (fixture 全部是构造的假路由, 不含真实业务代码。)
//
// 运行: npx vitest run tests/scripts/check-no-sse-req-close.test.js
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const CHECKER = path.join(ROOT, 'scripts/check-no-sse-req-close.mjs');

// 每个夹具目录都自带一个"正确写法"的 SSE 路由(res.on('close')):
// 否则检查器的空转防护(扫描范围内必须有流式 handler)会先报红, 掩盖真正的用例结论。
const BASE = {
  'api/routes/stream-ok.js': [
    "router.post('/ask/stream', authMiddleware, async (req, res) => {",
    "  res.setHeader('Content-Type', 'text/event-stream');",
    '  res.flushHeaders?.();',
    '  let closed = false;',
    '  res.on(\'close\', () => { closed = true; });',
    "  res.write('event: done\\ndata: {}\\n\\n');",
    '  res.end();',
    '});',
    '',
  ].join('\n'),
};

// 在临时目录里跑检查器: 返回 { code, out }
// withBase=false 时不写入 BASE (用于测空转防护)
function runOn(files, cwd = null, { withBase = true } = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), 'no-sse-req-close-'));
  try {
    for (const [rel, body] of Object.entries(withBase ? { ...BASE, ...files } : files)) {
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

describe('check-no-sse-req-close (SSE/流式禁 req.on(\'close\') 闸门)', () => {
  // ── 必须红 ──
  it('SSE 路由里 req.on(\'close\') → 拦截, 并给出 file:line 与流式上下文', () => {
    const { code, out } = runOn({
      'api/routes/bad-stream.js': [
        "router.post('/ask/stream', authMiddleware, async (req, res) => {",
        "  res.setHeader('Content-Type', 'text/event-stream');",
        '  let closed = false;',
        "  req.on('close', () => { closed = true; });",
        '  res.end();',
        '});',
        '',
      ].join('\n'),
    });
    expect(code).toBe(1);
    expect(out).toMatch(/api\/routes\/bad-stream\.js:4/);
    expect(out).toMatch(/text\/event-stream/);
  });

  it('req.once(\'close\') / addListener 变体同样拦截', () => {
    const { code, out } = runOn({
      'api/routes/bad-once.js': [
        "router.post('/ask/stream', authMiddleware, async (req, res) => {",
        "  res.setHeader('Content-Type', 'text/event-stream');",
        "  req.once('close', () => {});",
        '  res.end();',
        '});',
        '',
      ].join('\n'),
    });
    expect(code).toBe(1);
    expect(out).toMatch(/api\/routes\/bad-once\.js:3/);
  });

  it('chunked 流式响应里的 req.on(\'close\') → 拦截', () => {
    const { code, out } = runOn({
      'api/routes/bad-chunked.js': [
        "router.get('/export', authMiddleware, async (req, res) => {",
        "  res.setHeader('Transfer-Encoding', 'chunked');",
        "  req.on('close', () => {});",
        '  res.end();',
        '});',
        '',
      ].join('\n'),
    });
    expect(code).toBe(1);
    expect(out).toMatch(/api\/routes\/bad-chunked\.js:3/);
  });

  // ── 必须绿 (不误杀) ──
  it('非流式路由的 req.on(\'close\') 清理逻辑 → 放行, 且如实列出', () => {
    const { code, out } = runOn({
      'api/routes/normal.js': [
        "router.get('/mastery', authMiddleware, async (req, res) => {",
        "  req.on('close', () => { cleanup(); });",
        '  return res.json({ ok: true });',
        '});',
        '',
      ].join('\n'),
    });
    expect(code).toBe(0);
    expect(out).toMatch(/放行/);
    expect(out).toMatch(/api\/routes\/normal\.js:2/);
  });

  it('注释里提到 req.on(\'close\') → 不算命中', () => {
    const { code, out } = runOn({
      'api/routes/commented.js': [
        "router.get('/mastery', authMiddleware, async (req, res) => {",
        "  // 2026-09-23 修正: 原用 req.on('close'), Node 22 下请求体读完即触发",
        '  return res.json({ ok: true });',
        '});',
        '',
      ].join('\n'),
    });
    expect(code).toBe(0);
    expect(out).not.toMatch(/api\/routes\/commented\.js:2/);
  });

  it('扫描范围内没有流式 handler → 空转防护报红 (不静默失效)', () => {
    const { code, out } = runOn(
      { 'api/routes/plain.js': "router.get('/x', auth, async (req, res) => res.json({}));\n" },
      null,
      { withBase: false }
    );
    expect(code).toBe(1);
    expect(out).toMatch(/闸门空转/);
  });

  it('仓库本体: 修复后门禁为绿, 且确实扫到流式 handler', () => {
    const { code, out } = runOn({}, ROOT);
    expect(code).toBe(0);
    expect(out).toMatch(/扫描 \d+ 个流式 handler/);
    expect(out).not.toMatch(/扫描 0 个流式 handler/);
  });
});
