// P4 多模态读端 — 题面 token 渲染（共享模块 + 3 个代表页面）
//
// 起因（2026-09-25，承接 fd3db94）：exam_questions.stem 含 ⟦IMG/F/TABLE/OMML⟧ 占位符。
// photo-solve 相似题已接通；本文件锁死「共享模块 + 其余 v2 页面」不得把裸 token 直出，
// 且能渲染时必须变成 <img>/KaTeX 节点。修复前这些页面直出 stem → token 以「怪符号」显示。
//
// 用 vitest（environment=node）+ jsdom，纳入 `npm test` 与门禁第 1 段。
import fs from 'node:fs';
import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';

const DIR = 'frontend-v2';
const read = (p) => fs.readFileSync(`${DIR}/${p}`, 'utf8');

const katexJs = read('assets/vendor/katex/katex.min.js');
const qbRenderJs = read('assets/js/qb-render.js');

/** jsdom 不加载外链脚本 → 把页面用到的脚本按 src 名内联。
 *  ⚠️ 替换串必须用函数形式：源码含 `$$`/`$'` 等序列，String.replace 会啃坏源码。 */
function bootstrap(pageName) {
  const html = read(`${pageName}.html`);
  const inlined = html
    .replace(/<script src="[^"]*katex\.min\.js"><\/script>/, () => `<script>${katexJs}</script>`)
    .replace(/<script src="[^"]*ui\.js"><\/script>/, () => `<script>${read('assets/js/ui.js')}</script>`)
    .replace(/<script src="[^"]*api\.js"><\/script>/, () => `<script>${read('assets/js/api.js')}</script>`)
    .replace(/<script src="[^"]*subjects\.js"><\/script>/, () => `<script>${read('assets/js/subjects.js')}</script>`)
    .replace(/<script src="[^"]*qb-render\.js"><\/script>/, () => `<script>${qbRenderJs}</script>`)
    .replace(
      new RegExp(`<script src="[^"]*${pageName.replace(/[-/]/g, '\\$&')}\\.js"></script>`),
      () => `<script>${read(`assets/js/${pageName}.js`)}</script>`
    );
  const dom = new JSDOM(inlined, {
    runScripts: 'dangerously',
    url: `https://x.dev/${pageName}.html`,
    pretendToBeVisual: true,
  });
  dom.window.fetch = () => Promise.reject(new Error('no network in test'));
  return dom;
}

async function loadPage(pageName) {
  const dom = bootstrap(pageName);
  await new Promise((res) => dom.window.addEventListener('load', res));
  return dom.window;
}

function unitWindow() {
  const dom = new JSDOM('<!doctype html><body></body>', { runScripts: 'dangerously' });
  dom.window.eval(katexJs);
  dom.window.eval(qbRenderJs);
  return dom.window;
}

const IMG_REC = { token: 'IMG:rId4', kind: 'figure', ext: '.png', renderable: true, url: '/qb-media-png/ab/ab8e.png' };
const F_REC = { token: 'F:rId11', kind: 'formula', ext: '.png', renderable: true, url: '/qb-media-png/10/107d.png' };

describe('QBRender 共享模块', () => {
  it('IMG/F token → <img>，且 token 不出现在文本里', () => {
    const w = unitWindow();
    const t = w.document.createElement('div');
    w.QBRender.renderInto(t, '如图⟦IMG:rId4⟧，且⟦F:rId11⟧。', [IMG_REC, F_REC]);
    expect(t.querySelectorAll('img').length).toBe(2);
    expect(t.textContent.includes('⟦IMG:')).toBe(false);
    expect(t.textContent.includes('⟦F:')).toBe(false);
    const img = t.querySelector('img');
    expect(img.getAttribute('loading')).toBe('lazy');
    expect(!!img.getAttribute('alt')).toBe(true);
    expect(img.getAttribute('src')).toBe('/qb-media-png/ab/ab8e.png');
  });

  it('F token 无渲染图但有 latex → KaTeX 节点', () => {
    const w = unitWindow();
    const t = w.document.createElement('div');
    w.QBRender.renderInto(t, '公式⟦F:rIdZ⟧', [{ token: 'F:rIdZ', latex: '$x^2$' }]);
    expect(t.querySelectorAll('.katex').length).toBeGreaterThanOrEqual(1);
    expect(t.textContent.includes('⟦F:')).toBe(false);
  });

  it('取不到资产 → 「图片暂缺」/「公式暂缺」，不泄漏 token', () => {
    const w = unitWindow();
    const t = w.document.createElement('div');
    w.QBRender.renderInto(t, '缺图⟦IMG:rIdX⟧与缺式⟦F:rIdY⟧', []);
    expect(t.textContent.includes('图片暂缺')).toBe(true);
    expect(t.textContent.includes('公式暂缺')).toBe(true);
    expect(t.textContent.includes('⟦')).toBe(false);
  });

  it('TABLE/OMML token → 可读占位，不泄漏 token', () => {
    const w = unitWindow();
    const t = w.document.createElement('div');
    w.QBRender.renderInto(t, '见表⟦TABLE:1⟧与式⟦OMML:abc⟧', []);
    expect(t.textContent.includes('表格暂缺')).toBe(true);
    expect(t.textContent.includes('公式暂缺')).toBe(true);
    expect(t.textContent.includes('⟦')).toBe(false);
  });

  it('恶意文本走文本节点，不生成元素', () => {
    const w = unitWindow();
    w.__pwned = undefined;
    const t = w.document.createElement('div');
    w.QBRender.renderInto(t, '<img src=x onerror="window.__pwned=1">⟦IMG:rId1⟧', []);
    expect(t.querySelectorAll('img').length).toBe(0);
    expect(w.__pwned).toBeUndefined();
  });

  it('findMedia 对非数组/缺 token 返回 null', () => {
    const w = unitWindow();
    expect(w.QBRender.findMedia(undefined, 'IMG:x')).toBe(null);
    expect(w.QBRender.findMedia([IMG_REC], 'IMG:zzz')).toBe(null);
  });
});

describe('review-session 页面（优先）', () => {
  it('题面 token → 图片/公式，不泄漏 token', async () => {
    const w = await loadPage('review-session');
    w.localStorage.setItem('authToken', 't');
    w.AIAPI.srsStats = () => Promise.resolve({});
    w.AIAPI.srsQueue = () =>
      Promise.resolve({
        queue: [
          {
            wrong_id: 1,
            subject_code: 'math',
            kp_name: '函数',
            stem: '如图⟦IMG:rId4⟧，求⟦F:rId11⟧',
            media: [IMG_REC, F_REC],
            mastery_score: 30,
          },
        ],
        total: 1,
      });
    await w.ReviewSession.load();
    const stem = w.document.getElementById('stem');
    expect(stem.querySelectorAll('img').length).toBe(2);
    expect(stem.textContent.includes('⟦')).toBe(false);
  });

  it('无资产 → 占位，不泄漏 token', async () => {
    const w = await loadPage('review-session');
    w.localStorage.setItem('authToken', 't');
    w.AIAPI.srsStats = () => Promise.resolve({});
    w.AIAPI.srsQueue = () =>
      Promise.resolve({
        queue: [{ wrong_id: 1, subject_code: 'math', stem: '缺图⟦IMG:rIdX⟧', media: [], mastery_score: 10 }],
        total: 1,
      });
    await w.ReviewSession.load();
    const stem = w.document.getElementById('stem');
    expect(stem.textContent.includes('图片暂缺')).toBe(true);
    expect(stem.textContent.includes('⟦')).toBe(false);
  });
});

describe('practice-hub 页面', () => {
  it('题面 token → 图片；TABLE 降级为占位，不泄漏 token', async () => {
    const w = await loadPage('practice-hub');
    w.localStorage.setItem('authToken', 't');
    w.AIAPI.practiceHistory = () => Promise.resolve({ sessions: [] });
    w.AIAPI.startPractice = () =>
      Promise.resolve({
        sessionId: 's1',
        questions: [
          {
            id: 1,
            stem: '⟦IMG:rId4⟧ + ⟦TABLE:1⟧',
            options: null,
            media: [IMG_REC],
            tables: [{ n: 1, headers: ['a'], rows: [['1']] }],
          },
        ],
      });
    await w.PracticeHub.start();
    const stem = w.document.getElementById('quiz-stem');
    expect(stem.querySelectorAll('img').length).toBe(1);
    expect(stem.textContent.includes('表格暂缺')).toBe(true);
    expect(stem.textContent.includes('⟦')).toBe(false);
  });
});

describe('predictive-paper 页面', () => {
  it('整卷题面 token → 图片，不泄漏 token', async () => {
    const w = await loadPage('predictive-paper');
    w.localStorage.setItem('authToken', 't');
    w.AIAPI.request = (path) => {
      if (path.indexOf('/api/exam/questions/') === 0) {
        return Promise.resolve({
          paper: { id: 1, title: '测试卷' },
          data: [{ question_number: 1, question_type: '解答', stem: '如图⟦IMG:rId4⟧', media: [IMG_REC] }],
        });
      }
      return Promise.resolve({ data: [{ id: 1, title: '测试卷' }] });
    };
    await w.PredictivePaper.load();
    await w.PredictivePaper.openPaper(1);
    const list = w.document.getElementById('question-list');
    expect(list.querySelectorAll('img').length).toBe(1);
    expect(list.textContent.includes('⟦')).toBe(false);
  });
});
