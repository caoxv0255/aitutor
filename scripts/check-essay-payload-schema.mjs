#!/usr/bin/env node
/**
 * scripts/check-essay-payload-schema.mjs — 前端 payload 键 ∈ 后端 Zod schema 永久闸门
 *
 * 起因 (2026-09-26 真实事故):
 *   frontend-v2 作文模式给 POST /api/essay/analyze 发的 payload 里带了 `title_image`,
 *   但后端 AnalyzeRequestSchema 当时没有该键 —— Zod 默认丢弃未知键, `title_image`
 *   被**静默丢掉**, `essay_title` 恒为「未命名」, 题目图白传。mock 单测全绿 (mock 不校验
 *   schema), 线上却失效。这类「前端发了字段、后端 schema 没有」的错在 review 与 mock
 *   单测里都看不出来, 必须机械化拦截。
 *
 * 射程 (严格限定, 不得越界):
 *   - **只覆盖 `POST /api/essay/analyze` 一个端点**, 不做全仓字段推导;
 *   - **只做单向检查**: 前端 payload 里出现、而 schema 里没有的键 → 失败。
 *     反向 (schema 有、前端没发) **不检查** —— 可选字段本就允许不发;
 *   - **纯静态推导, 不做运行时校验**; 不引入新依赖 (AST 用仓库已有的 acorn, 与
 *     check-no-err-message-echo.mjs / check-logger-error-meta.mjs 同款用法);
 *   - schema 来源固定为 `api/handlers/essay/analyzeService.js`; 前端来源为若干前端
 *     源目录 (见 FRONTEND_DIRS) 下含端点多用途字样的 .js/.mjs/.cjs。
 *
 * 提取方法:
 *   - **schema 键**: acorn 解析 analyzeService.js, 定位「被 .safeParse() 使用的标识符」
 *     对应的 `z.object({...})` 对象字面量, 取其顶层键。允许键集合等价的顶层
 *     `.strict()` / `.strip()` 修饰; 若 schema 被 spread、或调用 `.passthrough()` /
 *     `.catchall()` (会让「schema 没有的键」照样通过 → 本门禁失去意义), 或不是
 *     `z.object({...})` 直接字面量 (extend/merge/pick 派生等), **一律判红并报出**,
 *     绝不静默放过。
 *   - **前端 payload 键**: 遍历所有前端源文件, 命中「首实参为字面量 `/api/essay/analyze`
 *     的调用」即为一个调用点 (不限定是否 photo-solve.js)。取第二实参 (请求选项对象),
 *     优先用其 `body` 属性值; 无 `body` 但有 method/headers/signal 等传输键 → 视为无体;
 *     否则该选项对象即 payload (axios/fetch 直传 data 的写法)。`body` / 选项对象 /
 *     payload 若为**分步赋值**的标识符, 沿**同文件、按词法作用域**查找其唯一声明并回代
 *     (循环引用/同作用域重复声明即判红)。
 *   - **无法静态判定 (computed key、spread、非字面量/多跳别名、解析失败) → 判红并逐条列出
 *     file:line 与原因**, 不得跳过。
 *
 * 空扫描保护 (仓库既有约定): 「schema 键集合 = 0」或「扫描范围内一个调用点都没找到」
 *   一律**判红**, 绝不静默通过 —— 否则文件搬走/端点改名时闸门会静默失效。
 *   脚本另含 selfTest() 自检: 用内存夹具验证 schema 提取 / payload 提取 / passthrough /
 *   spread 四类判据, 任一失效即判红。
 *
 * ALLOW: **本脚本刻意不设 ALLOW 清单**。单向判据下不存在「前端合法多发一个 schema 不吃
 *   的键」的情况 —— 若真出现, 说明要么后端 schema 该补该键, 要么前端不该发, 都应由人工
 *   拍板, 而不是用白名单掩盖。故本脚本无「登记即放行」通道。
 *
 * 明确不覆盖 (需人工兜底): 把端点路径拼出来的动态 URL (如 '/api/essay/' + 'analyze');
 *   跨文件/跨模块的数据流 (payload 由上层的参数传入); HTML 内联 <script> 里的调用
 *   (只扫 .js/.mjs/.cjs); 通过 api.js 再包装 (如 AIAPI.xxx) 且路径非字面量的调用。
 *
 * 输出: 存在「前端多出的键」/「无法静态判定」/「空扫描」→ 非零退出。
 */
import fs from 'node:fs';
import path from 'node:path';
import * as acorn from 'acorn';

const ROOT = process.cwd();
const ENDPOINT = '/api/essay/analyze';
const SCHEMA_FILE = 'api/handlers/essay/analyzeService.js';

// 前端源目录 (全前端目录扫一遍)。node_modules/.git/archive 等由 SKIP_DIR 跳过。
const FRONTEND_DIRS = ['frontend-v2', 'frontend', 'frontend-legacy', 'public', 'ai-tutor-frontend', 'aitutor-demo'];
const SCAN_EXT = new Set(['.js', '.mjs', '.cjs']);
const SKIP_DIR = /(^|\/)(node_modules|\.git|archive|dist|build|coverage|__tests__|tests?)(\/|$)/;

const sorted = (set) => [...set].sort();

function die(msg) {
  console.error(msg);
  process.exit(1);
}

function parseAst(text) {
  const opts = {
    ecmaVersion: 'latest',
    locations: true,
    allowHashBang: true,
    allowAwaitOutsideFunction: true,
    allowReturnOutsideFunction: true,
  };
  try {
    return acorn.parse(text, { ...opts, sourceType: 'module' });
  } catch {
    return acorn.parse(text, { ...opts, sourceType: 'script' });
  }
}

/** 通用 AST 遍历 */
function walk(node, visit) {
  if (!node || typeof node.type !== 'string') return;
  visit(node);
  for (const key of Object.keys(node)) {
    if (key === 'loc' || key === 'start' || key === 'end') continue;
    const val = node[key];
    if (Array.isArray(val)) {
      for (const c of val) if (c && typeof c.type === 'string') walk(c, visit);
    } else if (val && typeof val.type === 'string') {
      walk(val, visit);
    }
  }
}

/** 属性名 (非计算键); 取不到返回 null */
function propKey(p) {
  if (p.type !== 'Property' || p.computed) return null;
  const k = p.key;
  if (k.type === 'Identifier') return k.name;
  if (k.type === 'Literal') return String(k.value);
  return null;
}

/** 取对象字面量的顶层键; spread / computed / 非常规键记入 problems (调用方据此判红) */
function objectLiteralKeys(obj) {
  const keys = new Set();
  const problems = [];
  for (const p of obj.properties) {
    if (p.type === 'SpreadElement') {
      problems.push('spread (...obj)');
      continue;
    }
    if (p.type !== 'Property') {
      problems.push(`非属性节点 ${p.type}`);
      continue;
    }
    if (p.computed) {
      problems.push('computed key ([expr])');
      continue;
    }
    const k = p.key;
    if (k.type === 'Identifier') keys.add(k.name);
    else if (k.type === 'Literal') keys.add(String(k.value));
    else problems.push(`键形态无法判定 (${k.type})`);
  }
  return { keys, problems };
}

/** 是否 `z.object({...})` 直接对象字面量 (允许键集合等价的 .strict()/.strip() 顶层修饰) */
function zodObjectLiteral(init) {
  let node = init;
  for (let i = 0; i < 5; i++) {
    if (
      node &&
      node.type === 'CallExpression' &&
      node.callee.type === 'MemberExpression' &&
      !node.callee.computed &&
      node.callee.property.type === 'Identifier' &&
      ['strict', 'strip'].includes(node.callee.property.name)
    ) {
      node = node.callee.object;
      continue;
    }
    break;
  }
  if (
    node &&
    node.type === 'CallExpression' &&
    node.callee.type === 'MemberExpression' &&
    !node.callee.computed &&
    node.callee.object.type === 'Identifier' &&
    node.callee.object.name === 'z' &&
    node.callee.property.type === 'Identifier' &&
    node.callee.property.name === 'object'
  ) {
    const arg = node.arguments[0];
    if (arg && arg.type === 'ObjectExpression') return arg;
  }
  return null;
}

/**
 * 从源码文本推导 analyze 端点 Zod schema 的键集合。
 * @returns {{ok:true, keys:Set<string>, name:string} | {ok:false, error:string}}
 */
function extractSchema(text) {
  let ast;
  try {
    ast = parseAst(text);
  } catch (e) {
    return { ok: false, error: `无法解析 ${SCHEMA_FILE}: ${e.message}` };
  }

  const decls = new Map(); // name -> { init, count, line }
  const safeParseRefs = [];
  walk(ast, (node) => {
    if (node.type === 'VariableDeclarator' && node.id.type === 'Identifier') {
      const prev = decls.get(node.id.name);
      if (prev) prev.count += 1;
      else decls.set(node.id.name, { init: node.init, count: 1, line: node.loc.start.line });
    }
    if (
      node.type === 'CallExpression' &&
      node.callee.type === 'MemberExpression' &&
      !node.callee.computed &&
      node.callee.object.type === 'Identifier' &&
      node.callee.property.type === 'Identifier' &&
      node.callee.property.name === 'safeParse'
    ) {
      safeParseRefs.push(node.callee.object.name);
    }
  });

  // 定位 schema 变量: 优先取被 .safeParse() 使用的标识符; 退回唯一的 z.object 声明。
  let name = null;
  for (const ref of safeParseRefs) {
    if (decls.has(ref)) {
      name = ref;
      break;
    }
  }
  if (!name) {
    const zodNames = [];
    for (const [n, info] of decls) {
      if (info.count === 1 && zodObjectLiteral(info.init)) zodNames.push(n);
    }
    if (zodNames.length === 1) name = zodNames[0];
    else {
      return {
        ok: false,
        error:
          `无法定位 analyze 的 Zod schema 变量 (被 .safeParse() 引用的标识符: [${safeParseRefs.join(', ')}]; ` +
          `可识别的 z.object 声明: [${zodNames.join(', ')}]) —— 判据已失效, 不能静默通过`,
      };
    }
  }

  const info = decls.get(name);
  if (info.count !== 1) {
    return { ok: false, error: `schema 变量 "${name}" 在 ${SCHEMA_FILE} 内被声明 ${info.count} 次, 无法静态确定` };
  }
  if (!info.init) {
    return { ok: false, error: `schema 变量 "${name}" 无初始化值, 无法枚举键` };
  }

  // passthrough / catchall: 未知键不再被丢弃 → 本门禁失去意义, 必须判红。
  let forbidden = null;
  walk(info.init, (node) => {
    if (forbidden) return;
    if (
      node.type === 'CallExpression' &&
      node.callee.type === 'MemberExpression' &&
      !node.callee.computed &&
      node.callee.property.type === 'Identifier' &&
      ['passthrough', 'catchall'].includes(node.callee.property.name)
    ) {
      forbidden = node.callee.property.name;
    }
  });
  if (forbidden) {
    return {
      ok: false,
      error: `schema "${name}" 调用了 .${forbidden}() —— 未知键不会被丢弃, 本门禁失去意义 (必须暴露)`,
    };
  }

  const obj = zodObjectLiteral(info.init);
  if (!obj) {
    return {
      ok: false,
      error:
        `schema "${name}" 不是可直接枚举的 z.object({...}) 字面量 ` +
        `(可能是 extend/merge/pick/omit 派生或经变量中转), 无法静态枚举键`,
    };
  }

  const { keys, problems } = objectLiteralKeys(obj);
  if (problems.length) {
    return { ok: false, error: `schema "${name}" 对象字面量含无法静态枚举的项: ${problems.join('; ')}` };
  }
  return { ok: true, keys, name };
}

/**
 * 扫描单个前端文件, 收集所有 `/api/essay/analyze` 调用点及其 payload 顶层键。
 * 作用域感知: 标识符沿词法作用域栈查找唯一声明并回代。
 * @returns {{error:string} | {sites:Array, unresolvable:Array}}
 */
function collectCallSites(rel, text) {
  let ast;
  try {
    ast = parseAst(text);
  } catch (e) {
    return { error: `${rel}: 无法解析 (${e.message})` };
  }

  const sites = [];
  const unresolvable = [];
  const scopeStack = [new Map()];

  function lookup(name) {
    for (let i = scopeStack.length - 1; i >= 0; i--) {
      const sc = scopeStack[i];
      if (sc.has(name)) {
        const e = sc.get(name);
        if (e.count > 1) return { error: `同一作用域内重复声明 "${name}", 无法确定用哪个` };
        return { init: e.init, line: e.line };
      }
    }
    return { error: `未找到标识符 "${name}" 的声明` };
  }

  function resolveObject(expr, seen) {
    if (!expr) return { error: '缺少表达式' };
    if (expr.type === 'ObjectExpression') return { node: expr };
    if (expr.type === 'Identifier') {
      if (seen.has(expr.name)) return { error: `标识符 "${expr.name}" 循环引用` };
      const hit = lookup(expr.name);
      if (hit.error) return { error: hit.error };
      if (!hit.init) return { error: `标识符 "${expr.name}" 无初始化值` };
      seen.add(expr.name);
      return resolveObject(hit.init, seen);
    }
    return { error: `非对象字面量形态 (${expr.type})` };
  }

  function recordCall(node) {
    const a0 = node.arguments[0];
    let url = null;
    if (a0 && a0.type === 'Literal' && typeof a0.value === 'string') url = a0.value;
    else if (a0 && a0.type === 'TemplateLiteral' && a0.expressions.length === 0) {
      url = a0.quasis[0].value.cooked;
    }
    if (url !== ENDPOINT) return;

    const line = node.loc.start.line;
    const a1 = node.arguments[1];
    if (!a1) {
      sites.push({ file: rel, line, keys: [], source: '无第二实参 (无可枚举 payload)' });
      return;
    }
    const opts = resolveObject(a1, new Set());
    if (opts.error) {
      unresolvable.push({ file: rel, line, reason: `请求选项对象不可静态确定: ${opts.error}` });
      return;
    }

    const obj = opts.node;
    const TRANSPORT = new Set([
      'method',
      'headers',
      'signal',
      'credentials',
      'mode',
      'cache',
      'redirect',
      'referrer',
      'integrity',
      'keepalive',
    ]);
    const bad = [];
    let hasBody = false;
    let bodyValue = null;
    let hasTransport = false;
    for (const p of obj.properties) {
      if (p.type === 'SpreadElement') {
        bad.push('spread (...opts)');
        continue;
      }
      if (p.type !== 'Property') {
        bad.push(`非属性节点 ${p.type}`);
        continue;
      }
      if (p.computed) {
        bad.push('computed key');
        continue;
      }
      const key = propKey(p);
      if (key === null) {
        bad.push('键形态无法判定');
        continue;
      }
      if (key === 'body') {
        hasBody = true;
        bodyValue = p.value;
      } else if (TRANSPORT.has(key)) {
        hasTransport = true;
      }
    }
    if (bad.length) {
      unresolvable.push({ file: rel, line, reason: `请求选项对象含 ${bad.join('; ')}` });
      return;
    }

    let payloadExpr;
    let source;
    if (hasBody) {
      payloadExpr = bodyValue;
      source = 'body';
    } else if (hasTransport) {
      sites.push({ file: rel, line, keys: [], source: '无 body (非携体请求)' });
      return;
    } else {
      payloadExpr = obj; // axios/fetch 直传 data 的写法: 第二实参即 payload
      source = 'direct (第二实参即 payload)';
    }

    const payload = resolveObject(payloadExpr, new Set());
    if (payload.error) {
      unresolvable.push({ file: rel, line, reason: `payload 不可静态确定: ${payload.error}` });
      return;
    }
    const { keys, problems } = objectLiteralKeys(payload.node);
    if (problems.length) {
      unresolvable.push({ file: rel, line, reason: `payload 对象含无法静态枚举的项: ${problems.join('; ')}` });
      return;
    }
    sites.push({ file: rel, line, keys: sorted(keys), source });
  }

  function visit(node) {
    if (!node || typeof node.type !== 'string') return;
    const opened = node.type === 'BlockStatement' || node.type === 'Program';
    if (opened) scopeStack.push(new Map());

    if (node.type === 'VariableDeclarator' && node.id.type === 'Identifier') {
      const sc = scopeStack[scopeStack.length - 1];
      const prev = sc.get(node.id.name);
      if (prev) prev.count += 1;
      else sc.set(node.id.name, { init: node.init, count: 1, line: node.loc.start.line });
    }
    if (node.type === 'CallExpression') recordCall(node);

    for (const key of Object.keys(node)) {
      if (key === 'loc' || key === 'start' || key === 'end') continue;
      const val = node[key];
      if (Array.isArray(val)) {
        for (const c of val) if (c && typeof c.type === 'string') visit(c);
      } else if (val && typeof val.type === 'string') {
        visit(val);
      }
    }

    if (opened) scopeStack.pop();
  }

  visit(ast);
  return { sites, unresolvable };
}

/**
 * 自检: 用内存夹具验证四类判据仍成立。任一失效 → 返回失败原因 (空扫描保护的一部分:
 * 即便实仓扫描恰好什么都没命中, 也能证明判据本身没有失效)。
 */
function selfTest() {
  const fails = [];
  const s1 = extractSchema('const S = z.object({ a: z.string(), b: z.string().min(1) });\nS.safeParse(x);');
  if (!s1.ok || s1.keys.size !== 2 || !s1.keys.has('a') || !s1.keys.has('b')) {
    fails.push('schema 键提取自检失败');
  }
  const s2 = extractSchema('const S = z.object({ a: z.string() }).passthrough();\nS.safeParse(x);');
  if (s2.ok || !/passthrough/.test(s2.error || '')) fails.push('passthrough 探测自检失败 (应判红)');
  const s3 = extractSchema('const S = z.object({ a: z.string() }).catchall(z.string());\nS.safeParse(x);');
  if (s3.ok || !/catchall/.test(s3.error || '')) fails.push('catchall 探测自检失败 (应判红)');
  const s4 = extractSchema('const S = z.object({ ...base, a: z.string() });\nS.safeParse(x);');
  if (s4.ok) fails.push('schema spread 自检失败 (应判红)');

  const p1 = collectCallSites(
    'fixture.js',
    "AIAPI.request('/api/essay/analyze', { method: 'POST', body: { image: 1, title_image: 2 } });"
  );
  if (
    p1.error ||
    !p1.sites ||
    p1.sites.length !== 1 ||
    p1.sites[0].keys.length !== 2 ||
    !p1.sites[0].keys.includes('title_image')
  ) {
    fails.push('payload 键提取自检失败');
  }
  const p2 = collectCallSites(
    'fixture.js',
    "const p = { ...base, image: 1 };\nAIAPI.request('/api/essay/analyze', { body: p });"
  );
  if (p2.error || !p2.unresolvable || p2.unresolvable.length !== 1) {
    fails.push('payload spread 自检失败 (应判无法静态确定)');
  }
  return fails;
}

// ── 0. 自检 ────────────────────────────────────────────────────────────────
const selfFails = selfTest();
if (selfFails.length) {
  die(
    '❌ 闸门自检失败 —— 判据已失效, 不能继续 (宁可判红也不静默通过):\n' +
      selfFails.map((f) => `   - ${f}`).join('\n') +
      '\n   请修复 scripts/check-essay-payload-schema.mjs 的提取/判定逻辑。'
  );
}

// ── 1. 推导 schema 键 ──────────────────────────────────────────────────────
const schemaAbs = path.join(ROOT, SCHEMA_FILE);
if (!fs.existsSync(schemaAbs)) {
  die(`❌ 未找到 schema 文件 ${SCHEMA_FILE} —— 判据路径失效, 判红。`);
}
const schema = extractSchema(fs.readFileSync(schemaAbs, 'utf8'));
if (!schema.ok) {
  die(
    `❌ 无法从 ${SCHEMA_FILE} 静态枚举 analyze schema 键:\n   ${schema.error}\n` +
      '   (schema 必须可静态枚举; passthrough/catchall/spread/派生 schema 会让本门禁失效, 必须暴露)'
  );
}
if (schema.keys.size === 0) {
  die(`❌ 闸门空转: ${SCHEMA_FILE} 的 schema "${schema.name}" 键集合为空 —— 判据已失效, 判红。`);
}

// ── 2. 扫描前端所有调用点 ──────────────────────────────────────────────────
function collectFiles(dir, out) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const relDir = path.relative(ROOT, full).split(path.sep).join('/');
    if (entry.isDirectory()) {
      if (SKIP_DIR.test(relDir)) continue;
      collectFiles(full, out);
      continue;
    }
    if (!SCAN_EXT.has(path.extname(entry.name))) continue;
    if (SKIP_DIR.test(relDir)) continue;
    let text;
    try {
      text = fs.readFileSync(full, 'utf8');
    } catch {
      continue;
    }
    // 先按端点多用途字样预筛 (避免解析无关的遗留大文件); 命中才纳入候选并解析。
    if (!text.includes(ENDPOINT)) continue;
    out.push({ rel: relDir, text });
  }
}

const candidates = [];
for (const d of FRONTEND_DIRS) collectFiles(path.join(ROOT, d), candidates);

const sites = [];
const unresolvable = [];
const parseErrors = [];
for (const f of candidates) {
  const r = collectCallSites(f.rel, f.text);
  if (r.error) {
    parseErrors.push(r.error);
    continue;
  }
  sites.push(...r.sites);
  unresolvable.push(...r.unresolvable);
}

// ── 3. 空扫描保护 ──────────────────────────────────────────────────────────
if (candidates.length === 0) {
  die(
    `❌ 闸门空转: 前端扫描范围内未出现端点多用途字样 "${ENDPOINT}" —— 扫描范围已失效或端点被改名/搬走。\n` +
      `   当前扫描目录: ${FRONTEND_DIRS.join(', ')}\n` +
      '   请修正 scripts/check-essay-payload-schema.mjs 的扫描范围, 不要让闸门静默通过。'
  );
}
if (sites.length + unresolvable.length === 0) {
  die(
    `❌ 闸门空转: 扫到 ${candidates.length} 个含端点多用途字样的文件, 但未发现任何对 ${ENDPOINT} 的调用点。\n` +
      '   判据已失效 (调用被包装/路径被拼接), 请修正 scripts/check-essay-payload-schema.mjs 的判据, 不得静默通过。'
  );
}

// ── 4. 汇总前端键 + 单向比对 ───────────────────────────────────────────────
const frontendKeys = new Set();
const keyOrigin = new Map();
for (const s of sites) {
  for (const k of s.keys) {
    frontendKeys.add(k);
    if (!keyOrigin.has(k)) keyOrigin.set(k, `${s.file}:${s.line}`);
  }
}
const schemaKeys = schema.keys;
const extra = sorted(new Set(sorted(frontendKeys).filter((k) => !schemaKeys.has(k))));

const order = (a, b) => (a.file === b.file ? a.line - b.line : a.file.localeCompare(b.file));
sites.sort(order);
unresolvable.sort(order);

const problems = [];
if (parseErrors.length) problems.push(`${parseErrors.length} 个候选文件无法解析`);
if (unresolvable.length) problems.push(`${unresolvable.length} 处无法静态判定`);
if (extra.length) problems.push(`${extra.length} 个前端键不在 schema 中`);

if (problems.length) {
  console.error('❌ 前端 essay/analyze payload 与后端 Zod schema 不一致:');
  if (parseErrors.length) {
    console.error('   ── 解析失败 (无法验证, 判红) ──');
    for (const p of parseErrors) console.error(`   ✗ ${p}`);
  }
  if (unresolvable.length) {
    console.error('   ── 无法静态判定 (computed key / spread / 非字面量, 判红) ──');
    for (const u of unresolvable) console.error(`   ✗ ${u.file}:${u.line}  ${u.reason}`);
  }
  console.error('   ── 并排比对 ──');
  console.error(`   前端键集合 (${frontendKeys.size}): [${sorted(frontendKeys).join(', ')}]`);
  console.error(`   schema 键集合 (${schemaKeys.size}): [${sorted(schemaKeys).join(', ')}]`);
  if (extra.length) {
    console.error(`   多出的键 (前端有 / schema 无, 会被 Zod 静默丢弃): [${extra.join(', ')}]`);
    for (const k of extra) console.error(`      · ${k}  ← ${keyOrigin.get(k)}`);
  }
  console.error(
    '\n   修复: 前端不该发的键请删除; 确需的键请在 analyzeService.js 的 AnalyzeRequestSchema 中补上。' +
      ' (本闸门无 ALLOW 通道 —— 不存在「合法多发一个 schema 不吃的键」的情况。)'
  );
  process.exit(1);
}

console.log(
  `✓ 前端 essay/analyze payload 键均存在于后端 Zod schema (扫描 ${candidates.length} 个候选文件 / ${sites.length} 个调用点)`
);
for (const s of sites) {
  console.log(`   · ${s.file}:${s.line}  [${s.source}] keys=[${s.keys.join(', ')}]`);
}
console.log(`   前端键集合 (${frontendKeys.size}): [${sorted(frontendKeys).join(', ')}]`);
console.log(`   schema 键集合 ${schema.name} (${schemaKeys.size}): [${sorted(schemaKeys).join(', ')}]`);
