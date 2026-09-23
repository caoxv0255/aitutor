// tests/frontend/province-page-xss.test.js — 旧树 province.html 内联 onclick XSS 回归
//
// 波次4 债1: frontend/assets/js/pages/province-page.js:479 原为
//   <button class="btn" onclick="viewPaper('${paper.id}')">
//   paper.id 来自服务端，直接拼进 HTML 属性 + JS 字符串 → 可注入。
// 修法: 改 data-paper-id（值经 SecurityUtils.escapeHTML）+ 事件委托调用 window.viewPaper。
// 本用例在 jsdom 里加载真实脚本，覆盖真实 renderPapers / bindFilterEvents / viewPaper：
//   1) 渲染产物无内联 onclick，恶意 paper.id 不能逃逸属性；
//   2) 点击经委托传入与旧版一致的 id（功能等价）。
// 跑: npx vitest run tests/frontend/province-page-xss.test.js

import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const PAGE_SRC = fs.readFileSync(path.join(ROOT, 'frontend/assets/js/pages/province-page.js'), 'utf8');
const SEC_SRC = fs.readFileSync(path.join(ROOT, 'frontend/assets/js/utils/security.js'), 'utf8');

function makeWindow() {
  const dom = new JSDOM(
    '<!doctype html><html><body><div id="papers-list"></div><div id="type-chart"></div></body></html>',
    { runScripts: 'outside-only' }
  );
  const { window } = dom;
  window.skeleton = { render() {}, hide() {} };
  window.toast = { error() {} };
  window.eval(SEC_SRC);
  // 同一 eval 内捕获 class（class 是词法作用域，不挂 window）
  window.eval(`${PAGE_SRC}\n;window.__PP = ProvincePage;`);
  return window;
}

describe('旧树 province-page.js 内联 onclick XSS 修复', () => {
  it('源文件已无任何内联事件处理器', () => {
    expect(PAGE_SRC).not.toMatch(/\son(click|change|mouseover|mouseout|input|submit|focus|blur)\s*=/);
  });

  it('renderPapers 输出 data-paper-id、无 onclick；恶意 paper.id 不能逃逸属性', () => {
    const w = makeWindow();
    const pp = new w.__PP();
    const malicious = 'x" onmouseover="alert(1)';
    const html = pp.renderPapers([{ id: malicious, year: 2020, subject: 'math', title: 'T' }]);

    expect(html).not.toMatch(/\sonclick\s*=/);
    expect(html).toContain('data-paper-id="');
    // 双引号被实体化 → 无法闭合属性注入 onmouseover
    expect(html).not.toContain('onmouseover="alert(1)"');
    expect(html).toContain('&quot; onmouseover=&quot;alert(1)');
  });

  it('点击「查看详情」经委托调用 viewPaper，传入与旧 onclick 完全一致的 id', () => {
    const w = makeWindow();
    const pp = new w.__PP();
    const id = 'abc-123';
    w.document.getElementById('papers-list').innerHTML = pp.renderPapers([{ id, year: 2020, subject: 'math' }]);

    let openedUrl = null;
    w.open = (url) => {
      openedUrl = url;
    };
    pp.bindFilterEvents();

    const btn = w.document.querySelector('#papers-list button[data-paper-id]');
    btn.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true }));

    // 旧行为: onclick="viewPaper('abc-123')" → window.open('/api/exam-pdf/abc-123')
    expect(openedUrl).toBe(`/api/exam-pdf/${id}`);
  });
});
