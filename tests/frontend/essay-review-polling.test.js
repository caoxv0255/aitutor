// 作文智能批改 · 轮询（2026-09-26：analyze 改异步后，报告先 pending 后 completed）
//
// 覆盖：
//   1. 轮询参数：退避递增 + 封顶 + 有终点（覆盖 qwen-plus ~41.5s 的实测耗时）
//   2. pending → completed：停在 loading（文案「AI 正在批改中…」）→ 完成后 success
//   3. pending 超过上限 → error（不无限轮询，也不假装成功）
//   4. status=failed → error（固定文案，不回显后端错误码）
//   5. 老数据没有 status 字段 → 直接渲染（不进轮询）
//   6. 重复 load 不叠加定时器
//
// 用 vitest（environment=node）+ jsdom，纳入 `npm test`（门禁第 1 段）。
import fs from 'node:fs';
import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';

const DIR = 'frontend-v2';
const read = (p) => fs.readFileSync(`${DIR}/${p}`, 'utf8');

const htmlSrc = read('essay-review.html');
const pageJs = read('assets/js/essay-review.js');
const markedJs = read('assets/vendor/marked/marked.umd.js');
const purifyJs = read('assets/vendor/dompurify/purify.min.js');
const uiJs = read('assets/js/ui.js');
const apiJs = read('assets/js/api.js');

function bootstrap(url) {
  const inlined = htmlSrc
    .replace(/<script src="[^"]*marked\.umd\.js"><\/script>/, () => `<script>${markedJs}</script>`)
    .replace(/<script src="[^"]*purify\.min\.js"><\/script>/, () => `<script>${purifyJs}</script>`)
    .replace(/<script src="[^"]*ui\.js"><\/script>/, () => `<script>${uiJs}</script>`)
    .replace(/<script src="[^"]*api\.js"><\/script>/, () => `<script>${apiJs}</script>`)
    .replace(/<script src="[^"]*essay-review\.js"><\/script>/, () => `<script>${pageJs}</script>`);
  return new JSDOM(inlined, { runScripts: 'dangerously', url, pretendToBeVisual: true });
}

async function loadPage(url = 'https://x.dev/v2/essay-review.html?id=r-1') {
  const dom = bootstrap(url);
  dom.window.fetch = () => Promise.reject(new Error('no network in test'));
  await new Promise((res) => dom.window.addEventListener('load', res));
  dom.window.localStorage.setItem('authToken', 't');
  return dom.window;
}

const COMPLETED = {
  report_id: 'r-1',
  essay_title: '我的母亲',
  status: 'completed',
  score: 58,
  subject: 'chinese',
  transcript: { paragraphs: [{ paragraph_index: 0, lines: [{ line_no: 0, text: '春天来了。' }] }] },
  annotations: [{ type: 'highlight', anchor: { paragraph_index: 0, quote: '春天来了。' }, comment: '开场好。' }],
  meta: { scores: { total: 58 }, summary: '总评。' },
};

const PENDING = { report_id: 'r-1', status: 'pending', meta: {}, annotations: [], transcript: { paragraphs: [] } };

/**
 * 驱动一次带轮询的 load：先发第一次请求，之后每次被调度的回调都立刻执行
 * （不真等定时器），直到 promise 落定。
 *
 * @param {object} w jsdom window
 * @param {function} responder (n) => 第 n 次请求返回的数据
 * @returns {Promise<{calls:number, delays:number[]}>}
 */
const tick = () => new Promise((r) => setTimeout(r, 0));

async function driveLoad(w, responder) {
  const delays = [];
  let calls = 0;
  const queue = [];
  w.AIAPI.request = () => {
    calls += 1;
    return Promise.resolve(responder(calls));
  };
  const p = w.EssayReview.load({ scheduler: (fn, ms) => { delays.push(ms); queue.push(fn); } });
  let settled = false;
  p.then(() => { settled = true; }, () => { settled = true; });
  let guard = 0;
  while (!settled && guard < 2000) {
    await tick(); // 先让在飞的响应落地
    while (queue.length) queue.shift()();
    guard += 1;
  }
  await p;
  return { calls, delays };
}

describe('轮询参数', () => {
  it('退避递增且封顶 4000ms', async () => {
    const w = await loadPage();
    expect(w.EssayReview.POLL).toEqual({ baseMs: 1500, factor: 1.5, maxMs: 4000, maxAttempts: 30 });
    expect(w.EssayReview.pollDelay(0)).toBe(1500);
    expect(w.EssayReview.pollDelay(1)).toBe(2250);
    expect(w.EssayReview.pollDelay(2)).toBeCloseTo(3375, 5);
    expect(w.EssayReview.pollDelay(3)).toBe(4000); // 5062.5 → 封顶
    expect(w.EssayReview.pollDelay(20)).toBe(4000);
  });

  it('30 次重试的总覆盖窗口 > 90s（能盖住 qwen-plus ~41.5s 的实测耗时）', async () => {
    const w = await loadPage();
    let total = 0;
    for (let i = 0; i < w.EssayReview.POLL.maxAttempts; i += 1) total += w.EssayReview.pollDelay(i);
    expect(total).toBeGreaterThan(90_000);
    expect(total).toBeLessThan(180_000); // 与后端 PENDING_TIMEOUT_MS=180s 同量级, 不超限太多
  });
});

describe('pending → completed 状态机', () => {
  it('先 pending 再 completed：停在 loading 显示「AI 正在批改中…」，完成后 success', async () => {
    const w = await loadPage();
    const { calls, delays } = await driveLoad(w, (n) => (n < 3 ? PENDING : COMPLETED));

    expect(calls).toBe(3);
    expect(delays).toEqual([1500, 2250]); // 两次等待后第三次拿到 completed
    expect(w.EssayReview.getState()).toBe('success');
    expect(w.EssayReview.getReport().status).toBe('completed');
    // 总分：resolveScore 候选取 meta.scores.total 与顶层 score（遗留 2 已同值写入）
    expect(w.document.getElementById('score-badge').textContent).toBe('58 分');
  });

  it('pending 期间停在 loading，文案是「AI 正在批改中…」（复用现有六态，不新增状态）', async () => {
    const w = await loadPage();
    const queue = [];
    w.AIAPI.request = () => Promise.resolve(PENDING);
    const p = w.EssayReview.load({ scheduler: (fn) => queue.push(fn) });
    await tick();

    expect(w.EssayReview.getState()).toBe('loading');
    expect(w.document.getElementById('loading-title').textContent).toBe('AI 正在批改中…');
    expect(queue.length).toBe(1); // 已排好下一次重试

    // 收尾：让后续请求返回 completed，避免悬挂 promise
    w.AIAPI.request = () => Promise.resolve(COMPLETED);
    queue.shift()();
    await p;
    expect(w.EssayReview.getState()).toBe('success');
  });

  it('超过 maxAttempts 仍 pending → error（有终点，不无限轮询）', async () => {
    const w = await loadPage();
    const { calls } = await driveLoad(w, () => PENDING);

    expect(calls).toBe(w.EssayReview.POLL.maxAttempts);
    expect(w.EssayReview.getState()).toBe('error');
    expect(w.document.getElementById('error-copy').textContent).toMatch(/仍在批改中/);
  });

  it('status=failed → error，文案固定（不把后端错误码当文案显示）', async () => {
    const w = await loadPage();
    const { calls } = await driveLoad(w, () => ({
      report_id: 'r-1', status: 'failed', error_message: 'grading_validation_failed',
      meta: {}, annotations: [], transcript: { paragraphs: [] },
    }));

    expect(calls).toBe(1);
    expect(w.EssayReview.getState()).toBe('error');
    const copy = w.document.getElementById('error-copy').textContent;
    expect(copy).toMatch(/未能完成/);
    expect(copy).not.toMatch(/grading_validation_failed/);
  });
});

describe('轮询的兼容与生命周期', () => {
  it('老数据没有 status 字段 → 直接渲染，不进轮询', async () => {
    const w = await loadPage();
    const legacy = { ...COMPLETED };
    delete legacy.status;
    const { calls, delays } = await driveLoad(w, () => legacy);

    expect(calls).toBe(1);
    expect(delays).toEqual([]);
    expect(w.EssayReview.getState()).toBe('success');
  });

  it('重复 load 不叠加定时器（第二次 load 只走自己的链）', async () => {
    const w = await loadPage();
    let calls = 0;
    const queue = [];
    w.AIAPI.request = () => {
      calls += 1;
      return Promise.resolve(calls < 2 ? PENDING : COMPLETED);
    };
    const p1 = w.EssayReview.load({ scheduler: (fn) => queue.push(fn) });
    await tick();
    const p2 = w.EssayReview.load({ scheduler: (fn) => queue.push(fn) }); // 重新加载
    let guard = 0;
    while (guard < 2000) {
      await tick();
      while (queue.length) queue.shift()();
      guard += 1;
      if (w.EssayReview.getState() === 'success') break;
    }
    await Promise.all([p1, p2]);
    expect(w.EssayReview.getState()).toBe('success');
  });

  it('后端返回空 → empty（不轮询）', async () => {
    const w = await loadPage();
    const { calls } = await driveLoad(w, () => null);
    expect(calls).toBe(1);
    expect(w.EssayReview.getState()).toBe('empty');
  });
});
