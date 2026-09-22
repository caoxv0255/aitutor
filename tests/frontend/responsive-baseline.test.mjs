// 响应式基线验收：断点规范 + 各页合规（静态可核部分）
//
// 边界声明：jsdom 没有布局引擎，**测不到**真实尺寸 / 触控实测 / 对比度。
// 本测试只验证"规范已落地且各页遵守"，渲染层结论仍需真浏览器（见 SPEC-UI §6）。
import fs from 'node:fs';
import path from 'node:path';

const DIR = 'frontend-v2';
const results = [];
const check = (name, got, want) => results.push({ ok: got === want, name, got, want });

const css = fs.readFileSync(`${DIR}/assets/css/app.css`, 'utf8');
const pages = fs.readdirSync(DIR).filter((f) => f.endsWith('.html')).sort();

// ── 1. 断点规范（判据是"只允许这三档 + 减少动效"，而不是"恰好几块"） ──
// 同一断点可在多个区块复用（如 480 另加一处 .quality-grid 调整），块数不是不变量。
const bp = [...css.matchAll(/@media\s*\(([^)]+)\)/g)].map((m) => m[1].replace(/\s+/g, ' '));
const widthBps = bp
  .filter((b) => b.includes('max-width'))
  .map((b) => Number(b.replace(/[^0-9]/g, '')));
const ALLOWED = [1023, 767, 480];
check('含平板 1023', widthBps.includes(1023), true);
check('含手机 767', widthBps.includes(767), true);
check('含小屏 480', widthBps.includes(480), true);
check('含减少动效', bp.some((b) => b.includes('prefers-reduced-motion')), true);
check('无自造断点', widthBps.every((v) => ALLOWED.includes(v)), true);
check('不再有旧断点 560', widthBps.includes(560), false);

// ── 2. 全局防溢出 ──
check('text-size-adjust 已设', /-webkit-text-size-adjust:\s*100%/.test(css), true);
check('overflow-wrap 已设', /overflow-wrap:\s*anywhere/.test(css), true);
check('媒体元素自适应', /img,\s*canvas,\s*video\s*\{[^}]*max-width:\s*100%/.test(css), true);

// ── 3. 触控目标与输入字号（静态规则落地） ──
check('按钮最小高度 44px', /\.btn\s*\{[^}]*min-height:\s*44px/.test(css), true);
const inputRule = css.match(/\.form-field input,\s*\.form-field select\s*\{[^}]*\}/s);
check('表单输入 16px', Boolean(inputRule && /font-size:\s*16px/.test(inputRule[0])), true);

// ── 4. 每页：viewport 声明 + 无内联样式 + 无境外 CDN ──
const badViewport = [];
const inlineStyle = [];
const cdnPages = [];
for (const p of pages) {
  const html = fs.readFileSync(path.join(DIR, p), 'utf8');
  if (!/<meta\s+name="viewport"[^>]*width=device-width/.test(html)) badViewport.push(p);
  if (/<style[^>]*>/.test(html)) inlineStyle.push(p);
  if (/googleapis|jsdelivr|unpkg/.test(html)) cdnPages.push(p);
}
check('全部页面有 viewport', badViewport.length, 0);
// 下面两条是"目标状态"，未迁移的原型页会命中 —— 单独报告，不当作基线回归失败
// 新架构页判据：引用共享层的真实路径（/assets/v2/js/*）。此前写成 'assets/js/ui.js'，
// 与实际引用 '/assets/v2/js/ui.js' 不匹配，导致本组检查恒空转（2026-09-22 修正）。
const newArchPages = pages.filter((p) => {
  const html = fs.readFileSync(path.join(DIR, p), 'utf8');
  return html.includes('assets/v2/js/ui.js') && html.includes('assets/v2/js/api.js');
});
const newWithInline = inlineStyle.filter((p) => newArchPages.includes(p));
const newWithCdn = cdnPages.filter((p) => newArchPages.includes(p));
check('新架构页无内联样式', newWithInline.length, 0);
check('新架构页无境外 CDN', newWithCdn.length, 0);

// ── 5. 已建新页引用了共享样式表（而非各写一套） ──
const noSharedCss = newArchPages.filter(
  (p) => !fs.readFileSync(path.join(DIR, p), 'utf8').includes('assets/v2/css/app.css')
);
check('新架构页引用 app.css', noSharedCss.length, 0);

// ── 6. 页面内不得直接 fetch（必须走 api.js） ──
const directFetch = newArchPages.filter((p) => /\bfetch\(/.test(fs.readFileSync(path.join(DIR, p), 'utf8')));
check('新架构页无直接 fetch', directFetch.length, 0);

for (const r of results) {
  console.log(`${r.ok ? 'OK  ' : 'FAIL'} ${r.name.padEnd(24)} 实际=${JSON.stringify(r.got)}` + (r.ok ? '' : ` 期望=${JSON.stringify(r.want)}`));
}
console.log(`\n统计: frontend-v2 共 ${pages.length} 页；已接新架构 ${newArchPages.length} 页；` +
  `仍未迁移(含内联样式/CDN) ${pages.length - newArchPages.length} 页`);
const bad = results.filter((r) => !r.ok).length;
console.log(bad ? `\n❌ ${bad} 项不符` : `\n✅ ${results.length} 项全部通过（渲染层未验证，见 SPEC-UI §6）`);
process.exit(bad ? 1 : 0);
