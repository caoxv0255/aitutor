#!/usr/bin/env node
/* katex-check.cjs —— KaTeX 严格模式批量检查器 (JSONL in → JSONL out)。
 *
 * 输入(每行): {"id": <任意>, "latex": "..."}
 * 输出(每行): {"id": <同>, "ok": true|false, "err": "..."}
 *
 * 用法: node katex-check.cjs <in.jsonl> <out.jsonl>
 * 说明: 严格模式 (strict:'error', throwOnError:true) —— 中文标点/未配对括号都会报错,
 *       这正是我们要抓的坏资产。
 */
const fs = require('fs');
const katex = require('katex');

const [inF, outF] = process.argv.slice(2);
if (!inF || !outF) {
  console.error('用法: node katex-check.cjs <in.jsonl> <out.jsonl>');
  process.exit(2);
}
/* 两档判据 —— 必须分开报, 否则把"渲染没问题的告警"当坏资产 (实测教训):
     ok_strict : strict:'error' —— 严格, 中文标点/Unicode√∪ 之类都算失败
     ok_render : 默认模式(throwOnError:true, strict:'warn') —— **能不能真的渲染出来**
                 与应用实际渲染口径一致, 这才是"坏不坏"的判据
   KaTeX 的 strict:'error' 是 lint 级别的严格度, 不等于生产环境渲染失败。 */
const render1 = (latex, strict) => {
  try {
    katex.renderToString(latex, { throwOnError: true, strict, displayMode: true });
    return [true, ''];
  } catch (e) {
    return [false, String(e.message || e).replace(/\s+/g, ' ').slice(0, 140)];
  }
};

const lines = fs.readFileSync(inF, 'utf8').split('\n').filter(s => s.trim());
const out = [];
for (const L of lines) {
  let rec;
  try { rec = JSON.parse(L); } catch (e) { out.push({ id: null, ok: false, ok_strict: false, err: 'bad json input' }); continue; }
  const s = String(rec.latex ?? '');
  const [okStrict, errStrict] = render1(s, 'error');
  const [okRender, errRender] = render1(s, 'warn');
  out.push({
    id: rec.id, ok: okRender, ok_strict: okStrict,
    err: okRender ? '' : errRender,
    err_strict: okStrict ? '' : errStrict,
  });
}
fs.writeFileSync(outF, out.map(o => JSON.stringify(o)).join('\n'));
const nBad = out.filter(o => !o.ok).length;
const nStrict = out.filter(o => !o.ok_strict).length;
console.log(`检查 ${out.length} 条: 可渲染 ${out.length - nBad}, **渲染失败 ${nBad}**, 严格模式失败 ${nStrict}`);
process.exit(0);
