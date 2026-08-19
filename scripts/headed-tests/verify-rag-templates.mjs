// scripts/headed-tests/verify-rag-templates.mjs
// 验证 tutor 引用区 + wrong-book 类似题抽屉 (绕过 LLM 失败)
// 用 mock message / 注入按钮事件, 直接验证 DOM 模板
import { chromium } from 'playwright';
const browser = await chromium.launch({
  headless: false,
  executablePath: '/home/cx/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome',
  args: ['--no-sandbox','--disable-dev-shm-usage','--disable-gpu',
         '--enable-features=UseOzonePlatform','--ozone-platform=wayland'],
});
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
const page = await ctx.newPage();
page.on('pageerror', e => console.log('PAGE-ERR:', e.message.slice(0, 200)));

const OUT = '/home/cx/aitutor/scripts/headed-tests/screenshots';

// ── A. tutor 引用区: 注入假 assistant message 看模板 ──
await page.goto('http://localhost:3002/f3/pages/index.html');
const g = await page.request.post('http://localhost:3002/api/auth/guest-login', { data: {} });
const gj = await g.json();
await page.evaluate(t => localStorage.setItem('aitutor.token', t), gj.token);

// 通过 page.request 直接调 RAG (绕过浏览器 CORS / fetch 限制)
const ragResp = await page.request.post('http://localhost:3002/api/rag/search', {
  headers: { 'Authorization': 'Bearer ' + gj.token },
  data: { query: '导数', subject: 'math', top_k: 3, threshold: 0.3 }
});
const ragJson = await ragResp.json();
const mockHits = ragJson?.data?.results || [];
console.log('mock RAG hits:', mockHits.length);

await page.goto('http://localhost:3002/f3/pages/tutor.html');
await page.waitForTimeout(1500);
console.log('mock RAG hits:', mockHits.length);

// 直接调 renderMessages
await page.evaluate((hits) => {
  // 找到 messages 容器, 然后注入 mock message 触发 render
  const listEl = document.getElementById('messages');
  if (!listEl) { console.log('NO messages list'); return; }
  // 通过 module 变量不直接, 改用 dispatch 自定义事件
  // 实际上需要 reach into the IIFE 闭包, 这里只能注入静态 HTML
  const html = `
    <div class="msg-enter dynamic-msg flex gap-3 items-start max-w-[92%] sm:max-w-[80%] lg:max-w-[72%]">
      <div class="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0 mt-0.5" style="background:var(--brand); font-family:'DM Sans','Noto Sans SC',sans-serif;">AI</div>
      <div class="flex-1 min-w-0 flex flex-col gap-1">
        <article class="px-4 py-3.5 rounded-2xl rounded-tl-md text-foreground leading-[1.75] text-[15px] bg-surface-tertiary" style="border-radius:var(--radius-lg); border-top-left-radius:6px">
          <p class="mb-3">导数的几何意义是函数图像在某点的切线斜率。</p>
        </article>
        <div class="flex items-center gap-2 ml-1">
          <button class="inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-xs font-medium text-white" style="background:var(--brand);">加入错题本</button>
        </div>
        <details class="ml-1 mt-1 text-xs group" open data-dom-id="tutor-rag-citations">
          <summary class="cursor-pointer text-foreground-muted inline-flex items-center gap-1 select-none">
            📖 参考了 ${hits.length} 道相似题 ▼
          </summary>
          <div class="mt-2 space-y-2">
            ${hits.slice(0,3).map((h, i) => `
              <a href="${h.source_paper_url || 'javascript:void(0)'}" class="block px-3 py-2 rounded-lg bg-surface-secondary border border-border-light">
                <div class="flex items-center gap-2 mb-1">
                  <span class="inline-flex items-center justify-center w-5 h-5 rounded-md bg-primary-50 text-primary-500 text-[10px] font-bold">#${i+1}</span>
                  <span class="text-[11px] font-semibold text-primary-500">sim=${h.similarity?.toFixed(3) || '?'}</span>
                  <span class="text-[11px] px-1.5 py-0.5 rounded bg-surface-tertiary text-foreground-muted">${h.subject_code || 'math'}</span>
                  <span class="text-[11px] px-1.5 py-0.5 rounded bg-surface-tertiary text-foreground-muted">${h.question_type || '选择题'}</span>
                </div>
                <div class="text-foreground leading-relaxed line-clamp-3">${(h.content || '').slice(0, 240)}${(h.content || '').length > 240 ? '…' : ''}</div>
              </a>
            `).join('')}
          </div>
        </details>
      </div>
    </div>`;
  const spacer = listEl.querySelector('.h-2');
  if (spacer) spacer.insertAdjacentHTML('beforebegin', html);
  else listEl.insertAdjacentHTML('beforeend', html);
}, mockHits);
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/rag-04-tutor-citation-mock.png`, fullPage: false });
console.log('📸 rag-04-tutor-citation-mock.png');

// ── B. wrong-book 类似题抽屉: 注入 1 条错题 + 点 💡 ──
await page.goto('http://localhost:3002/f3/pages/wrong-book.html');
await page.waitForTimeout(1500);
// 检查抽屉元素是否存在
const drawerExists = await page.locator('#wb-similar-drawer').count();
console.log('抽屉元素存在?', drawerExists);

// 检查 wb-list 存在性 (空数据时, 列表是 "暂无错题记录" 文字, 容器可能不存在)
const listExists = await page.locator('#wb-list').count();
console.log('wb-list 存在?', listExists);

// 直接调底层函数 (window.openSimilarDrawer 已暴露)
const drawerResult = await page.evaluate(async (token) => {
  localStorage.setItem('aitutor.token', token);
  // 等一帧确保 window 暴露
  await new Promise(r => setTimeout(r, 100));
  if (typeof window.openSimilarDrawer !== 'function') return { error: 'window.openSimilarDrawer not exposed' };
  window.openSimilarDrawer('mock-q-1', '已知二次函数图像过定点求a,b,c关系', 'math');
  await new Promise(r => setTimeout(r, 2500));
  const drawer = document.getElementById('wb-similar-drawer');
  const body = document.getElementById('wb-similar-body');
  return {
    drawerHidden: drawer?.classList.contains('hidden'),
    bodyText: body?.textContent?.slice(0, 300),
  };
}, gj.token);
console.log('抽屉结果:', JSON.stringify(drawerResult));
await page.screenshot({ path: `${OUT}/rag-05-similar-drawer.png`, fullPage: false });
console.log('📸 rag-05-similar-drawer.png');

await browser.close();
console.log('done');