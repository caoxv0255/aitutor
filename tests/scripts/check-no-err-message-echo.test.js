// tests/scripts/check-no-err-message-echo.test.js — 错误回显收口门禁的回归用例
//
// 被测量: scripts/check-no-err-message-echo.mjs (M-2b, 波次4)
// 背景: 多个路由把 err.message 直接拼进返回客户端的错误文案, 泄露 SQL 片段/文件路径/
//       上游报错原文。先例 79897e2 手工修过 3 处 (M-2a), 同类写法散布 27+ 处。
//       这里用临时目录夹具反向验证: 门禁拦得住"拼进响应体"的 err.message,
//       又不会误杀只进日志/只判状态码/注释/字符串文本; 再用仓库本体验证修复后是绿的。
//       (fixture 全部是构造的假路由, 不含真实业务代码。)
//
// 运行: npx vitest run tests/scripts/check-no-err-message-echo.test.js
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const CHECKER = path.join(ROOT, 'scripts/check-no-err-message-echo.mjs');

// 每个夹具目录都自带一个"正常"路由(含 res.json / errorResponse sink):
// 否则检查器的空转防护(扫描范围内必须有响应体 sink)会先报红, 掩盖真正的用例结论。
const BASE = {
  'api/routes/base.js': [
    "router.get('/ok', auth, async (req, res) => {",
    '  try {',
    '    return res.json(successResponse({ ok: true }));',
    '  } catch (err) {',
    "    return res.status(500).json(errorResponse('查询失败，请稍后重试'));",
    '  }',
    '});',
    '',
  ].join('\n'),
};

// 在临时目录里跑检查器: 返回 { code, out }
// withBase=false 时不写入 BASE (用于测空转防护)
function runOn(files, cwd = null, { withBase = true } = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), 'no-err-echo-'));
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

describe('check-no-err-message-echo (err.message 禁入响应体闸门)', () => {
  // ── 必须红: 拼进响应体 ──
  it('errorResponse 模板串里插 ${err.message} → 拦截, 并给出 file:line 与 sink', () => {
    const { code, out } = runOn({
      'api/routes/bad-tpl.js': [
        "router.post('/x', auth, async (req, res) => {",
        '  try {',
        '    return res.json(successResponse({}));',
        '  } catch (err) {',
        "    console.error('bad:', err.message);",
        '    return res.status(500).json(errorResponse(`失败: ${err.message}`));',
        '  }',
        '});',
        '',
      ].join('\n'),
    });
    expect(code).toBe(1);
    expect(out).toMatch(/api\/routes\/bad-tpl\.js:6/);
    expect(out).toMatch(/errorResponse\(/);
  });

  it("字符串拼接 '...: ' + err.message 进 errorResponse → 拦截", () => {
    const { code, out } = runOn({
      'api/routes/bad-concat.js': [
        "router.post('/y', auth, async (req, res) => {",
        '  try {',
        '    return res.json(successResponse({}));',
        '  } catch (err) {',
        "    return res.status(500).json(errorResponse('代理失败: ' + err.message));",
        '  }',
        '});',
        '',
      ].join('\n'),
    });
    expect(code).toBe(1);
    expect(out).toMatch(/api\/routes\/bad-concat\.js:5/);
  });

  it('跨行对象字面量 res.json({ …, message: err.message }) → 拦截', () => {
    const { code, out } = runOn({
      'api/routes/bad-obj.js': [
        "router.get('/z', auth, async (req, res) => {",
        '  try {',
        '    return res.json(successResponse({}));',
        '  } catch (err) {',
        '    res.status(500).json({',
        '      success: false,',
        '      message: err.message,',
        '    });',
        '  }',
        '});',
        '',
      ].join('\n'),
    });
    expect(code).toBe(1);
    expect(out).toMatch(/api\/routes\/bad-obj\.js:7/);
  });

  // ── 必须绿: 不误杀 ──
  it('只给 logger.error 的 err.message → 放行, 且如实列出', () => {
    const { code, out } = runOn({
      'api/routes/log-only.js': [
        "router.get('/log', auth, async (req, res) => {",
        '  try {',
        '    return res.json(successResponse({}));',
        '  } catch (err) {',
        "    logger.error('查询失败', { error: err.message });",
        '    return res.json(errorResponse("固定文案"));',
        '  }',
        '});',
        '',
      ].join('\n'),
    });
    expect(code).toBe(0);
    expect(out).toMatch(/放行/);
    expect(out).toMatch(/api\/routes\/log-only\.js:5/);
  });

  it('只用于状态码判断的 err.message.includes(...) → 放行', () => {
    const { code, out } = runOn({
      'api/routes/status-only.js': [
        "router.post('/s', auth, async (req, res) => {",
        '  try {',
        '    return res.json(successResponse({}));',
        '  } catch (err) {',
        "    const status = err.message.includes('API Key') ? 503 : 500;",
        "    return res.status(status).json(errorResponse('固定文案'));",
        '  }',
        '});',
        '',
      ].join('\n'),
    });
    expect(code).toBe(0);
    expect(out).toMatch(/api\/routes\/status-only\.js:5/);
  });

  it('注释里的 err.message → 不算命中', () => {
    const { code, out } = runOn({
      'api/routes/commented.js': [
        "router.get('/c', auth, async (req, res) => {",
        '  // 2026-09-23 M-2b: 原写 errorResponse(`失败: ${err.message}`) 已改为固定文案',
        '  return res.json(successResponse({}));',
        '});',
        '',
      ].join('\n'),
    });
    expect(code).toBe(0);
    expect(out).not.toMatch(/api\/routes\/commented\.js:2/);
  });

  it('字符串字面量里的 "err.message" 文本 → 不算命中 (AST 精确, 非字符串匹配)', () => {
    const { code, out } = runOn({
      'api/routes/literal.js': [
        "router.get('/l', auth, async (req, res) => {",
        "  return res.status(400).json(errorResponse('err.message 只是文案，不该命中'));",
        '});',
        '',
      ].join('\n'),
    });
    expect(code).toBe(0);
    expect(out).not.toMatch(/api\/routes\/literal\.js:2/);
  });

  // ── 空转防护 ──
  it('扫描范围内一个文件都没有 → 空转防护报红 (不静默通过)', () => {
    const { code, out } = runOn({}, null, { withBase: false });
    expect(code).toBe(1);
    expect(out).toMatch(/闸门空转/);
  });

  it('有文件但没有任何响应体 sink → 空转防护报红', () => {
    const { code, out } = runOn({ 'api/routes/plain.js': 'export default {};\n' }, null, { withBase: false });
    expect(code).toBe(1);
    expect(out).toMatch(/闸门空转/);
  });

  it('仓库本体: 收口后门禁为绿, 且确实扫到响应体 sink', () => {
    const { code, out } = runOn({}, ROOT);
    expect(code).toBe(0);
    expect(out).toMatch(/扫描 \d+ 个文件 \/ \d+ 个响应体 sink/);
    expect(out).not.toMatch(/扫描 \d+ 个文件 \/ 0 个响应体 sink/);
  });
});
