// tests/scripts/check-logger-error-meta.test.js — 日志详情收口门禁的回归用例
//
// 被测量: scripts/check-logger-error-meta.mjs (2026-09-24, M-2b 余波)
// 背景: 多处 logger.<m>(msg, { error: e.message }) 传的是字符串, 而 logger.js 按
//       meta.error.message / meta.error.stack 取详情 —— 字符串两者皆 undefined,
//       err.message 静默丢失。这里用临时目录夹具反向验证门禁拦得住字符串形态,
//       又不会误杀传对象形态; 再用仓库本体验证修复后是绿的。
//       (fixture 全部是构造的假代码, 不含真实业务代码。)
//
// 运行: npx vitest run tests/scripts/check-logger-error-meta.test.js
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const CHECKER = path.join(ROOT, 'scripts/check-logger-error-meta.mjs');

// 每个夹具目录都带一个"正常"的 logger 调用 (空转防护要求扫描范围内必须有 logger 调用)。
const BASE = {
  'api/routes/base.js': [
    "import { logger } from '../../core/logger.js';",
    'export function base(e) {',
    "  logger.error('[t] ok', { error: e });",
    '}',
    '',
  ].join('\n'),
};

function runOn(files, cwd = null, { withBase = true } = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), 'logger-meta-'));
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

describe('check-logger-error-meta (logger meta.error 必须传对象)', () => {
  // ── 必须红 ──
  it('{ error: e.message } → 拦截, 给出 file:line', () => {
    const { code, out } = runOn({
      'api/routes/bad-msg.js': [
        "import { logger } from '../../core/logger.js';",
        'export function bad(e) {',
        "  logger.error('[x] failed', { error: e.message });",
        '}',
        '',
      ].join('\n'),
    });
    expect(code).toBe(1);
    expect(out).toMatch(/api\/routes\/bad-msg\.js:3/);
    expect(out).toMatch(/logger\.error/);
  });

  it('模板串 error: `…${e.message}` → 拦截', () => {
    const { code, out } = runOn({
      'api/routes/bad-tpl.js': [
        "import { logger } from '../../core/logger.js';",
        'export function bad(e) {',
        "  logger.warn('[x] failed', { error: `detail: ${e.message}` });",
        '}',
        '',
      ].join('\n'),
    });
    expect(code).toBe(1);
    expect(out).toMatch(/api\/routes\/bad-tpl\.js:3/);
  });

  it('String(e) → 拦截', () => {
    const { code, out } = runOn({
      'api/routes/bad-str.js': [
        "import { logger } from '../../core/logger.js';",
        'export function bad(e) {',
        "  logger.error('[x] failed', { error: String(e) });",
        '}',
        '',
      ].join('\n'),
    });
    expect(code).toBe(1);
    expect(out).toMatch(/api\/routes\/bad-str\.js:3/);
  });

  it('跨行对象字面量 { …, error: err.message } → 拦截', () => {
    const { code, out } = runOn({
      'api/routes/bad-multiline.js': [
        "import { logger } from '../../core/logger.js';",
        'export function bad(err) {',
        "  logger.error('[x] failed', {",
        '    requestId: 1,',
        '    error: err.message,',
        '  });',
        '}',
        '',
      ].join('\n'),
    });
    expect(code).toBe(1);
    expect(out).toMatch(/api\/routes\/bad-multiline\.js:5/);
  });

  // ── 必须绿 ──
  it('{ error: e } (传对象) → 放行', () => {
    const { code, out } = runOn({
      'api/routes/good-obj.js': [
        "import { logger } from '../../core/logger.js';",
        'export function good(e) {',
        "  logger.error('[x] failed', { error: e, ext: 'jpeg' });",
        '}',
        '',
      ].join('\n'),
    });
    expect(code).toBe(0);
    expect(out).toMatch(/api\/routes\/good-obj\.js:3/);
  });

  it('meta 无 error 字段 / 注释里的 error: e.message → 不算命中', () => {
    const { code, out } = runOn({
      'api/routes/clean.js': [
        "import { logger } from '../../core/logger.js';",
        'export function clean(e) {',
        '  // 2026-09-24: 原为 { error: e.message }, 已改为 { error: e }',
        "  logger.info('[x] ok', { user: 'a' });",
        '}',
        '',
      ].join('\n'),
    });
    expect(code).toBe(0);
    expect(out).not.toMatch(/api\/routes\/clean\.js:3/);
  });

  it('formatObsFields({ error: err.message }) 拼进 message 字符串 → 不在射程, 放行', () => {
    const { code, out } = runOn({
      'api/routes/obs.js': [
        "import { logger } from '../../core/logger.js';",
        'export function obs(err) {',
        "  logger.error(`failed ${{ error: err.message }}`, { user: 'a' });",
        '}',
        '',
      ].join('\n'),
    });
    expect(code).toBe(0);
    expect(out).not.toMatch(/api\/routes\/obs\.js:3/);
  });

  // ── 空转防护 ──
  it('扫描范围内一个文件都没有 → 空转防护报红 (不静默通过)', () => {
    const { code, out } = runOn({}, null, { withBase: false });
    expect(code).toBe(1);
    expect(out).toMatch(/闸门空转/);
  });

  it('有文件但没有任何 logger 调用 → 空转防护报红', () => {
    const { code, out } = runOn({ 'api/routes/plain.js': 'export default {};\n' }, null, { withBase: false });
    expect(code).toBe(1);
    expect(out).toMatch(/闸门空转/);
  });

  it('仓库本体: 收口后门禁为绿, 且确实扫到 logger 调用', () => {
    const { code, out } = runOn({}, ROOT);
    expect(code).toBe(0);
    expect(out).toMatch(/扫描 \d+ 个文件 \/ \d+ 个 logger 调用/);
    expect(out).not.toMatch(/扫描 \d+ 个文件 \/ 0 个 logger 调用/);
  });
});
