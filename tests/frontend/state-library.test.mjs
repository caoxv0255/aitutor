// 状态库页冒烟：SPEC-ROUTES:64「无接口（静态），SPEC-UI 的可执行附录」
// 判据：可加载 + 关键陈列区存在 + 无 console error + 无境外 CDN + 无内联 <style>
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const DIR = 'frontend-v2';
const html = fs.readFileSync(`${DIR}/state-library.html`, 'utf8');

const results = [];
const check = (name, got, want) => results.push({ ok: got === want, name, got, want });

const errors = [];
const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  url: 'https://x.dev/state-library.html',
  pretendToBeVisual: true,
});
dom.window.addEventListener('error', (e) => errors.push(String(e.message)));
await new Promise((res) => dom.window.addEventListener('load', res));
await new Promise((r) => setTimeout(r, 0));

const doc = dom.window.document;

// 1. 页面骨架
check('标题', doc.title.includes('状态库'), true);
check('有 viewport', !!doc.querySelector('meta[name="viewport"]'), true);
check('六态陈列区（SIX STATES）', doc.body.textContent.includes('SIX STATES'), true);
check('组件陈列区（COMPONENTS）', doc.body.textContent.includes('COMPONENTS'), true);

// 2. 六态各态样张齐备（本页是陈列页：每态以 state-card 样张出现，不跑互斥机）
check('空态样张', /empty（空态）/.test(doc.body.textContent), true);
check('加载态样张', /loading（加载态）/.test(doc.body.textContent), true);
check('成功态样张', /success（成功态）/.test(doc.body.textContent), true);
check('错误态样张', /error（错误态）/.test(doc.body.textContent), true);
check('未登录态样张', /auth（未登录/.test(doc.body.textContent), true);
check('离线态样张', /offline（离线）/.test(doc.body.textContent), true);
check('state-card 样张 ≥ 4（empty/error/auth/offline）', doc.querySelectorAll('.state-card').length >= 4, true);
check('error/auth/offline 色调包裹层', doc.querySelectorAll('.state--error, .state--auth, .state--offline').length >= 3, true);
check('skeleton 样张存在', doc.querySelectorAll('.skeleton').length >= 3, true);

// 3. 组件样张
check('chips 样张', doc.querySelectorAll('.chip').length >= 3, true);
check('tabs 样张', doc.querySelectorAll('#state-region ~ * .tab, .tabs .tab').length >= 3, true);
check('按钮样张（btn/cta）', doc.querySelectorAll('.btn').length >= 2 && doc.querySelectorAll('.cta-primary, .cta-secondary').length >= 2, true);
check('q-card 样张', doc.querySelectorAll('.q-card').length >= 1, true);
check('missing-note 样张（缺接口登记规范）', doc.querySelectorAll('.missing-note').length >= 1, true);

// 4. 约束
check('无内联 <style>', /<style[^>]*>/.test(html), false);
check('无境外 CDN（googleapis/jsdelivr/unpkg）', /googleapis|jsdelivr|unpkg/.test(html), false);
check('静态页不接业务接口（无 api.js 引用）', html.includes('/assets/v2/js/api.js'), false);
check('无 console error', errors.length, 0);

for (const r of results) {
  console.log(
    `${r.ok ? 'OK  ' : 'FAIL'} ${r.name.padEnd(36)} 实际=${JSON.stringify(r.got)}` + (r.ok ? '' : ` 期望=${JSON.stringify(r.want)}`)
  );
}
const bad = results.filter((r) => !r.ok).length;
console.log(bad ? `\n❌ ${bad} 项不符` : `\n✅ ${results.length} 项全部通过`);
process.exit(bad ? 1 : 0);
