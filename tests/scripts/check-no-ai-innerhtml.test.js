// tests/scripts/check-no-ai-innerhtml.test.js — AI 输出禁入 innerHTML 门禁的回归用例
//
// 被测量: scripts/check-no-ai-innerhtml.mjs
// 背景: 2026-09-23 安全评审 M-4 —— public/src/js/tutor-stream.js:208 把 LLM SSE
//       delta 未消毒拼进 innerHTML (`container.innerHTML += pending`)。当前是死代码,
//       但接线即 Critical。这里用临时目录夹具反向验证门禁拦得住未消毒注入,
//       再用仓库本体验证修完之后(全部已登记或静态)是绿的。
//       (fixture 全部是构造的假值, 不含真实数据。)
//
// 运行: npx vitest run tests/scripts/check-no-ai-innerhtml.test.js
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const CHECKER = path.join(ROOT, 'scripts/check-no-ai-innerhtml.mjs');

// 在临时目录里跑检查器 (临时目录非仓库 → 扫描该目录下的三个前端源码目录):
// 返回 { code, out }
function runOn(files, cwd = null) {
  const dir = mkdtempSync(path.join(tmpdir(), 'no-ai-innerhtml-'));
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

describe('check-no-ai-innerhtml (AI 输出禁入 innerHTML 门禁)', () => {
  // ── 必须红 ──
  it('innerHTML += delta (LLM delta 直拼) → 拦截, 并给出 file:line', () => {
    const { code, out } = runOn({
      'frontend-v2/assets/js/vuln.js': 'function f(delta){ container.innerHTML += delta; }\n',
    });
    expect(code).toBe(1);
    expect(out).toMatch(/frontend-v2\/assets\/js\/vuln\.js:1/);
    expect(out).toMatch(/innerHTML \+=/);
  });

  it('innerHTML = 变量 (非静态) → 拦截', () => {
    const { code, out } = runOn({
      'public/src/js/vuln2.js': 'el.innerHTML = payload;\n',
    });
    expect(code).toBe(1);
    expect(out).toMatch(/public\/src\/js\/vuln2\.js:1/);
  });

  it('innerHTML = 含 ${} 的模板字符串 → 拦截', () => {
    const { code, out } = runOn({
      'frontend/assets/js/vuln3.js': 'el.innerHTML = `<b>${html}</b>`;\n',
    });
    expect(code).toBe(1);
    expect(out).toMatch(/frontend\/assets\/js\/vuln3\.js:1/);
  });

  it('insertAdjacentHTML → 拦截', () => {
    const { code, out } = runOn({
      'frontend-v2/assets/js/vuln4.js': "el.insertAdjacentHTML('beforeend', delta);\n",
    });
    expect(code).toBe(1);
    expect(out).toMatch(/insertAdjacentHTML/);
  });

  it('document.write → 拦截', () => {
    const { code, out } = runOn({
      'frontend-v2/assets/js/vuln5.js': 'document.write(html);\n',
    });
    expect(code).toBe(1);
    expect(out).toMatch(/document\.write/);
  });

  it('innerHTML = 静态串 + 变量 拼接 → 拦截', () => {
    const { code } = runOn({
      'frontend-v2/assets/js/vuln6.js': "el.innerHTML = '<h3>' + title + '</h3>';\n",
    });
    expect(code).toBe(1);
  });

  // ── 必须绿 ──
  it('innerHTML = \'\' 清空 → 放行', () => {
    const { code } = runOn({
      'frontend-v2/assets/js/safe.js': "els.list.innerHTML = '';\n",
    });
    expect(code).toBe(0);
  });

  it('innerHTML = 纯静态字符串文案 → 放行', () => {
    const { code } = runOn({
      'frontend-v2/assets/js/safe2.js': "select.innerHTML = '<option value=\"\">请选择</option>';\n",
    });
    expect(code).toBe(0);
  });

  it('innerHTML = 不含 ${} 的静态模板字符串 → 放行', () => {
    const { code } = runOn({
      'frontend-v2/assets/js/safe3.js': 'el.innerHTML = `<div class="box">静态</div>`;\n',
    });
    expect(code).toBe(0);
  });

  // 修完之后仓库必须是绿的: 这条同时是 M-4 门禁的验收。
  it('仓库本体当前通过 (现存站点已全部登记/为静态)', () => {
    const { code, out } = runOn({}, ROOT);
    expect(code).toBe(0);
    expect(out).toContain('✓');
  });
});
