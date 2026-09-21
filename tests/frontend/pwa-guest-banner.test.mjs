// B2 验收：用 jsdom 真跑一遍提示条的显隐（不联网，纯本地文件）
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const html = fs.readFileSync('public/index.html', 'utf8');
const css = fs.readFileSync('public/styles.css', 'utf8');

const dom = new JSDOM(html.replace('</head>', `<style>${css}</style></head>`), {
  runScripts: 'outside-only'
});
const { window } = dom;
const banner = window.document.getElementById('guest-data-banner');

const results = [];
const check = (name, got, want) => {
  const ok = got === want;
  results.push({ ok, name, got, want });
};

// 1. 初始必须不可见（旧代码因为 .hidden 未定义而是可见的）
const initial = window.getComputedStyle(banner).display;
check('初始 display', initial, 'none');

// 2. JS 加上 --visible 后必须可见（app.js 的 classList.add 路径）
banner.classList.add('guest-banner--visible');
const shown = window.getComputedStyle(banner).display;
check('add(--visible) 后 display', shown, 'block');

// 3. 移除后再次不可见（8 秒后自动收起的路径）
banner.classList.remove('guest-banner--visible');
const hidden = window.getComputedStyle(banner).display;
check('remove(--visible) 后 display', hidden, 'none');

// 4. HTML 里不得再出现未定义的 Tailwind 类
const cls = banner.getAttribute('class');
check('banner 类名', cls, 'guest-banner');

for (const r of results) {
  console.log(`${r.ok ? 'OK  ' : 'FAIL'} ${r.name.padEnd(28)} 实际=${r.got}` + (r.ok ? '' : `  期望=${r.want}`));
}
const bad = results.filter(r => !r.ok).length;
console.log(bad ? `❌ ${bad} 项不符` : '✅ 提示条显隐行为正确');
process.exit(bad ? 1 : 0);
