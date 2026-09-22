// tests/scripts/check-no-hardcoded-secrets.test.js — 凭据门禁的回归用例
//
// 被测量: scripts/check-no-hardcoded-secrets.mjs
// 背景: 2026-09-22 该门禁对 3 个真实 sk- key 全部放行 (输出"未发现"、退出码 0),
//       完整分析见 docs/security/credential-rotation.md §7。三个成因:
//         1. PLACEHOLDER 正则把 sk- 前缀整体当占位符;
//         2. 赋值正则要求引号, shell 的 KEY=sk-... 无引号形态不匹配;
//         3. SKIP_DIRS 含 dev-verify, 目录内明文口令不可见。
//       这里用临时目录夹具反向验证它仍然拦得住, 并用仓库本体验证修完之后是绿的。
//       (fixture 里的 key 全部是按真实形状构造的假值, 不含任何真实凭据。)
//
// 运行: npx vitest run tests/scripts/check-no-hardcoded-secrets.test.js
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const CHECKER = path.join(ROOT, 'scripts/check-no-hardcoded-secrets.mjs');

// 在临时目录里跑检查器 (临时目录非 git 仓库 → 检查器退化为全量扫描): 返回 { code, out }
function runOn(files, cwd = null) {
  const dir = mkdtempSync(path.join(tmpdir(), 'secrets-case-'));
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

// 按真实形状构造的假 key (sk- + 32/48 位字母数字), 与真实凭据无关
const FAKE_SK_32 = 'sk-22aeb7f9c0d1e2f3a4b5c6d7e8f9a0b1';
const FAKE_SK_48 = 'sk-df8Zfake0fake1fake2fake3fake4fake5fake6fake7';

describe('check-no-hardcoded-secrets (凭据门禁)', () => {
  // ── 必须红 ──
  it('JS 明文 sk- key (带引号) → 拦截, 并给出 file:line', () => {
    const { code, out } = runOn({
      'scripts/vuln.js': `const API_KEY = '${FAKE_SK_32}';\n`,
    });
    expect(code).toBe(1);
    expect(out).toMatch(/scripts\/vuln\.js:1/);
    expect(out).toMatch(/明文赋值/);
  });

  it('shell 无引号 KEY=sk-... 形态 → 拦截 (§7 成因 2)', () => {
    const { code, out } = runOn({
      'scripts/vuln.sh': `GRAPHRAG_API_KEY=${FAKE_SK_48}\n`,
    });
    expect(code).toBe(1);
    expect(out).toMatch(/scripts\/vuln\.sh:1/);
    expect(out).toMatch(/无引号/);
  });

  it('dev-verify 目录内明文口令 → 拦截 (§7 成因 3: 目录不再整跳过)', () => {
    const { code, out } = runOn({
      'scripts/dev-verify/loop.mjs': `const TEST_PWD = 'verifyPass123!';\n`,
    });
    expect(code).toBe(1);
    expect(out).toMatch(/dev-verify\/loop\.mjs:1/);
  });

  it('连接串内联外部凭据 → 拦截', () => {
    const { code } = runOn({
      'scripts/vuln2.js': `const url = 'postgresql://user:p4ssw0rd_not_local@example.com:5432/db';\n`,
    });
    expect(code).toBe(1);
  });

  // ── 必须绿 ──
  it('process.env.X 读取 (修复后写法) → 放行', () => {
    const { code } = runOn({
      'scripts/safe.js': 'const API_KEY = process.env.DEEPSEEK_API_KEY;\n',
    });
    expect(code).toBe(0);
  });

  it('shell ${VAR:?} / ${VAR:-} 引用 → 放行', () => {
    const { code } = runOn({
      'scripts/safe.sh': ': "${LAN_REMOTE:?missing}"\nKEY="${GRAPHRAG_API_KEY:-}"\n',
    });
    expect(code).toBe(0);
  });

  it('sk- 后跟明显占位形态 (sk-xxxxxx) → 放行', () => {
    const { code } = runOn({
      'scripts/placeholder.js': "const API_KEY = 'sk-xxxxxx';\n",
    });
    expect(code).toBe(0);
  });

  // 修完之后仓库必须是绿的: 这条同时是凭据门禁修复的验收。
  // 全仓扫描一次 ~5s (vitest 默认 5s 超时不够), 显式放宽到 30s。
  it('仓库本体当前通过 (明文已全部改为环境变量读取)', () => {
    const { code, out } = runOn({}, ROOT);
    expect(code).toBe(0);
    expect(out).toContain('✓');
  }, 30000);
});
