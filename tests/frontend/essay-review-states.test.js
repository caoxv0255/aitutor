// 作文智能批改 · 批次 3：批改报告阅读器（essay-review.html + essay-review.js）
//
// 覆盖（本批验收项）：
//   1. 纯函数 bbox 0–1000 → 像素（批次 4 画连线的地基）+ 锚点/视口换算
//   2. 段落切分与批注文本锚定（含 revised_text 替换、重叠丢弃）
//   3. 报告数据 → DOM 渲染（含 change_type 着色 class）
//   4. 容错：缺 revised_text/severity/knowledge_points/bbox 的老数据 + V0 形态
//   5. 错误态：empty / auth / offline / error 四类可读错误态
//   6. Markdown 渲染走 DOMPurify 消毒 + DOM 挂载；源码不得出现 innerHTML 赋值
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

/**
 * jsdom 不加载外链脚本 → 把页面用到的脚本按 src 名内联。
 * ⚠️ 替换串必须用函数形式：源码含 `$$`/`$'` 等序列，String.replace 会啃坏源码。
 * 顺序与 essay-review.html 一致（marked 必须先于页面脚本）。
 */
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
  return dom.window;
}

function apiError(w, message, opts) {
  return w.AIAPI.ApiError(message, opts);
}

/** 模拟 <img> 加载完成（jsdom 不真的取图） */
function fireImageLoad(w, naturalWidth, naturalHeight) {
  const img = w.document.getElementById('essay-image');
  Object.defineProperty(img, 'naturalWidth', { value: naturalWidth, configurable: true });
  Object.defineProperty(img, 'naturalHeight', { value: naturalHeight, configurable: true });
  img.dispatchEvent(new w.Event('load'));
}

const REPORT = {
  report_id: 'r-1',
  essay_title: '我的母亲',
  created_at: '2026-09-25T08:00:00Z',
  grade: '初三',
  subject: 'chinese',
  transcript: {
    paragraphs: [
      {
        paragraph_index: 0,
        lines: [
          { line_no: 0, text: '春天来了。' },
          { line_no: 1, text: '小树发芽了。' },
        ],
      },
      { paragraph_index: 1, lines: [{ line_no: 0, text: '第二段文字。' }] },
    ],
  },
  annotations: [
    {
      type: 'highlight',
      anchor: { paragraph_index: 0, quote: '春天来了。' },
      comment: '开场点题，好。',
      revised_text: '春日已至。',
      severity: 'minor',
      knowledge_points: ['修辞'],
      bbox: { x: 58, y: 113, w: 520, h: 207 },
    },
    { type: 'grammar_error', anchor: { paragraph_index: 1, quote: '第二段文字。' }, comment: '主谓搭配不当。' },
  ],
  meta: {
    image_url: '/uploads/essay/2026/09/a.jpg',
    summary: '总评：**立意清晰**，论据可再充实。',
    scores: { total: 51 },
  },
  image_url: '/uploads/essay/2026/09/a.jpg',
};

describe('essay-review 静态合规', () => {
  it('页面无境外 CDN、无内联 <style>、无直接 fetch', () => {
    expect(/googleapis|jsdelivr|unpkg/.test(htmlSrc)).toBe(false);
    expect(/<style[^>]*>/.test(htmlSrc)).toBe(false);
    expect(/\bfetch\(/.test(htmlSrc)).toBe(false);
    expect(/\bfetch\(/.test(pageJs)).toBe(false);
  });

  it('essay-review.js 不含 innerHTML / insertAdjacentHTML / document.write', () => {
    // 门禁 scripts/check-no-ai-innerhtml.mjs 是本条的机械判据（含 ALLOW 登记机制）；
    // 此处再收紧为"代码（去注释后）里零出现"。
    // 去注释：先删块注释，再按行删 `//` 之后的内容。本文件字符串字面量不含 `//`
    // （无 URL / 无正则），故该剥离对本文件是安全的。
    const code = pageJs
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n')
      .map((line) => line.replace(/\/\/.*$/, ''))
      .join('\n');
    expect(/innerHTML/.test(code)).toBe(false);
    expect(/insertAdjacentHTML/.test(code)).toBe(false);
    expect(/document\s*\.\s*write\s*\(/.test(code)).toBe(false);
  });

  it('自托管 vendor 存在且被页面引用（marked 先于 DOMPurify）', () => {
    expect(fs.existsSync(`${DIR}/assets/vendor/marked/marked.umd.js`)).toBe(true);
    expect(fs.existsSync(`${DIR}/assets/vendor/dompurify/purify.min.js`)).toBe(true);
    const iMarked = htmlSrc.indexOf('marked.umd.js');
    const iPurify = htmlSrc.indexOf('purify.min.js');
    expect(iMarked).toBeGreaterThan(-1);
    expect(iPurify).toBeGreaterThan(iMarked);
  });
});

describe('bbox 0–1000 → 像素（批次 4 地基）', () => {
  it('x/y 用宽高各自换算，非方形图片也正确', async () => {
    const w = await loadPage();
    const px = w.EssayReview.bboxToPixels({ x: 100, y: 200, w: 300, h: 50 }, 1000, 2000);
    expect(px).toEqual({ x: 100, y: 400, w: 300, h: 100, right: 400, bottom: 500 });
  });

  it('锚点只取左上角', async () => {
    const w = await loadPage();
    expect(w.EssayReview.bboxAnchorToPixels({ x: 58, y: 113, w: 520, h: 207 }, 800, 1600)).toEqual({
      x: 46.4,
      y: 180.8,
    });
  });

  it('bbox 越界/类型非法/尺寸非法 → null（与后端 BboxSchema 同判据）', async () => {
    const w = await loadPage();
    const f = w.EssayReview.bboxToPixels;
    expect(f({ x: 900, y: 0, w: 200, h: 10 }, 1000, 1000)).toBeNull(); // x+w>1000
    expect(f({ x: 0, y: 950, w: 10, h: 100 }, 1000, 1000)).toBeNull(); // y+h>1000
    expect(f({ x: -1, y: 0, w: 10, h: 10 }, 1000, 1000)).toBeNull();
    expect(f({ x: 0, y: 0, w: 10 }, 1000, 1000)).toBeNull(); // 缺 h
    expect(f({ x: '0', y: 0, w: 10, h: 10 }, 1000, 1000)).toBeNull(); // 字符串不算数
    expect(f(null, 1000, 1000)).toBeNull();
    expect(f({ x: 0, y: 0, w: 10, h: 10 }, 0, 1000)).toBeNull(); // 空图
    expect(f({ x: 0, y: 0, w: 10, h: 10 }, 1000, NaN)).toBeNull();
  });

  it('图片像素 → 视口坐标（含缩放/平移）；未就绪 → null', async () => {
    const w = await loadPage();
    const metrics = {
      ready: true,
      naturalWidth: 1000,
      naturalHeight: 1000,
      scale: 2,
      offsetX: 10,
      offsetY: 20,
      viewport: { left: 100, top: 50, width: 400, height: 400 },
    };
    expect(w.EssayReview.imagePointToViewport({ x: 30, y: 40 }, metrics)).toEqual({
      x: 100 + 10 + 60,
      y: 50 + 20 + 80,
    });
    expect(w.EssayReview.imagePointToViewport({ x: 30, y: 40 }, { ...metrics, ready: false })).toBeNull();
    expect(w.EssayReview.imagePointToViewport(null, metrics)).toBeNull();
  });
});

describe('segmentParagraph：文本锚定与切句', () => {
  it('无批注时按句切分（含中英文终止符与换行）', async () => {
    const w = await loadPage();
    const segs = w.EssayReview.segmentParagraph('第一句。第二句！换行\n第三句？', []);
    expect(segs.map((s) => s.text)).toEqual(['第一句。', '第二句！', '换行\n', '第三句？']);
    expect(segs.every((s) => s.annotationIndex === null)).toBe(true);
  });

  it('quote 命中 → 该片段带 annotationIndex；有 revised_text 则替换显示', async () => {
    const w = await loadPage();
    const segs = w.EssayReview.segmentParagraph('春天来了。小树发芽了。', [
      { index: 0, quote: '春天来了。', revisedText: '春日已至。' },
    ]);
    expect(segs).toEqual([
      { text: '春日已至。', annotationIndex: 0, revised: true, quote: '春天来了。' },
      { text: '小树发芽了。', annotationIndex: null, revised: false, quote: '' },
    ]);
  });

  it('显式字符偏移优先，但切片必须等于 quote（防老数据偏移错位）', async () => {
    const w = await loadPage();
    const ok = w.EssayReview.segmentParagraph('春天来了。小树发芽了。', [
      { index: 0, quote: '小树发芽了。', start: 5, end: 11 },
    ]);
    expect(ok[0].annotationIndex).toBe(null);
    expect(ok[1].annotationIndex).toBe(0);

    const mismatch = w.EssayReview.segmentParagraph('春天来了。小树发芽了。', [
      { index: 0, quote: '小树发芽了。', start: 0, end: 6 }, // 偏移指向"春天来了。"，与 quote 不符
    ]);
    expect(mismatch.some((s) => s.annotationIndex === 0)).toBe(true); // 回退到文本查找
  });

  it('重叠批注丢弃后者、定位不到的丢弃（确定性）', async () => {
    const w = await loadPage();
    const segs = w.EssayReview.segmentParagraph('甲乙丙丁。', [
      { index: 0, quote: '甲乙丙' },
      { index: 1, quote: '丙丁' }, // 与 0 重叠
      { index: 2, quote: '不存在的句子' },
    ]);
    const annotated = segs.filter((s) => s.annotationIndex !== null).map((s) => s.annotationIndex);
    expect(annotated).toEqual([0]);
  });

  it('空文本 → 空数组', async () => {
    const w = await loadPage();
    expect(w.EssayReview.segmentParagraph('', [{ index: 0, quote: 'x' }])).toEqual([]);
    expect(w.EssayReview.segmentParagraph(null, [])).toEqual([]);
  });

  it('paragraphText 兼容 V1(lines[].text) 与 V0(text)', async () => {
    const w = await loadPage();
    const f = w.EssayReview.paragraphText;
    expect(f({ paragraph_index: 0, lines: [{ text: '甲' }, { text: '乙' }] })).toBe('甲乙');
    expect(f({ id: 3, text: '整段文本' })).toBe('整段文本');
    expect(f(null)).toBe('');
  });
});

describe('报告数据 → DOM 渲染', () => {
  it('标题/总分徽章/段落/句子 class/修订文本', async () => {
    const w = await loadPage();
    w.EssayReview.renderReport(REPORT);
    const doc = w.document;

    expect(doc.getElementById('essay-title').textContent).toBe('我的母亲');
    const badge = doc.getElementById('score-badge');
    expect(badge.hidden).toBe(false);
    expect(badge.textContent).toBe('51 分');

    expect(doc.querySelectorAll('#revised-text .para').length).toBe(2);
    const sents = [...doc.querySelectorAll('#revised-text .sent')];
    expect(sents.length).toBe(3);
    // change_type → class（非内联 style）
    expect(sents[0].className).toContain('sent--highlight');
    expect(sents[0].className).toContain('sent--severity-minor');
    expect(sents[0].className).toContain('sent--revised');
    expect(sents[2].className).toContain('sent--grammar-error');
    expect(sents[1].className.trim()).toBe('sent');
    // revised_text 替换了原文
    expect(sents[0].textContent).toBe('春日已至。');
    expect(sents.some((s) => s.textContent === '春天来了。')).toBe(false);
    // 每句都没被写内联 style
    expect(sents.every((s) => !s.getAttribute('style'))).toBe(true);
    expect(doc.getElementById('report-meta').textContent).toContain('2 条批注');
  });

  it('总体评语按 Markdown 渲染，且经 DOMPurify 消毒', async () => {
    const w = await loadPage();
    w.EssayReview.renderReport(REPORT);
    expect(w.document.querySelectorAll('#summary-left strong').length).toBe(1);
    expect(w.document.querySelectorAll('#summary-right strong').length).toBe(1);

    const target = w.document.getElementById('summary-left');
    w.EssayReview.renderMarkdown(target, '正文 <img src=x onerror="alert(1)"> <script>alert(2)</script>');
    expect(target.querySelectorAll('script').length).toBe(0);
    const img = target.querySelector('img');
    expect(img === null || !img.hasAttribute('onerror')).toBe(true);
  });

  it('marked/DOMPurify 缺失 → 降级纯文本并标注「Markdown 未渲染」', async () => {
    const w = await loadPage();
    const target = w.document.getElementById('summary-left');
    const savedMarked = w.marked;
    const savedPurify = w.DOMPurify;
    w.marked = undefined;
    w.DOMPurify = undefined;
    try {
      const ok = w.EssayReview.renderMarkdown(target, '第一段\n\n**第二段**');
      expect(ok).toBe(false);
      expect(target.dataset.markdown).toBe('plain');
      expect(target.textContent).toContain('Markdown 未渲染');
      expect(target.querySelectorAll('p').length).toBe(3); // 2 段正文 + 1 条标注
    } finally {
      w.marked = savedMarked;
      w.DOMPurify = savedPurify;
    }
  });

  it('学科未知时不硬编：徽章/评语仍渲染，学科按默认显示但不冒充已知', async () => {
    const w = await loadPage();
    w.EssayReview.renderReport({ ...REPORT, subject: undefined, meta: { ...REPORT.meta, subject: undefined } });
    expect(w.document.getElementById('subject-select').value).toBe('chinese');
    expect(w.document.getElementById('subject-caption').textContent).toContain('学科未知');
  });
});

describe('容错：缺键老数据', () => {
  it('老 annotations（无 revised_text/severity/knowledge_points/bbox）照常渲染', async () => {
    const w = await loadPage();
    w.EssayReview.renderReport({
      essay_title: '老报告',
      transcript: { paragraphs: [{ paragraph_index: 0, lines: [{ text: '老句子。' }] }] },
      annotations: [{ type: 'logic_issue', anchor: { paragraph_index: 0, quote: '老句子。' }, comment: '跳跃' }],
      meta: {},
    });
    const sent = w.document.querySelector('#revised-text [data-annotation-index]');
    expect(sent).not.toBeNull();
    expect(sent.textContent).toBe('老句子。'); // 无 revised_text → 显示原文
    expect(sent.className).toContain('sent--logic-issue');
    expect(sent.className).not.toContain('severity');
    expect(sent.className).not.toContain('revised');
    expect(w.document.getElementById('score-badge').hidden).toBe(true);
    expect(w.document.getElementById('report-meta').textContent).toContain('未包含总分');
    expect(w.document.getElementById('summary-left').textContent).toContain('未包含总体评语');
    expect(w.EssayReview.getAnchors().length).toBe(0); // 无 bbox → 不进锚点表
  });

  it('V0 形态（段落 text + 顶层 quote/original）也能锚定', async () => {
    const w = await loadPage();
    w.EssayReview.renderReport({
      title: 'V0 报告',
      transcript: { paragraphs: [{ id: 0, text: '整段文字。' }] },
      annotations: [{ paragraph_id: 0, original: '整段文字。', type: 'highlight', comment: '好' }],
      meta: {},
    });
    const sent = w.document.querySelector('#revised-text [data-annotation-index]');
    expect(sent).not.toBeNull();
    expect(sent.className).toContain('sent--highlight');
    expect(w.document.getElementById('essay-title').textContent).toBe('V0 报告');
  });

  it('无 transcript → 显示"未包含作文文本"，不白屏', async () => {
    const w = await loadPage();
    w.EssayReview.renderReport({ essay_title: '空壳', meta: {} });
    expect(w.EssayReview.getState()).toBe('success');
    expect(w.document.getElementById('text-empty').hidden).toBe(false);
    expect(w.document.querySelectorAll('#revised-text .para').length).toBe(0);
  });

  it('未知 change_type → sent--unknown（不崩、不丢句）', async () => {
    const w = await loadPage();
    w.EssayReview.renderReport({
      transcript: { paragraphs: [{ paragraph_index: 0, lines: [{ text: '甲。' }] }] },
      annotations: [{ type: 'brand_new_type', anchor: { paragraph_index: 0, quote: '甲。' }, comment: 'x' }],
      meta: {},
    });
    const sent = w.document.querySelector('#revised-text [data-annotation-index]');
    expect(sent.className).toContain('sent--unknown');
  });
});

describe('批次 4 只读访问器', () => {
  it('图片未 onload 前 ready=false，锚点为空；onload 后可换算', async () => {
    const w = await loadPage();
    w.EssayReview.renderReport(REPORT);
    expect(w.EssayReview.getImageMetrics().ready).toBe(false);
    expect(w.EssayReview.getAnchors()[0].anchor).toBeNull();

    fireImageLoad(w, 800, 1600);
    const m = w.EssayReview.getImageMetrics();
    expect(m.ready).toBe(true);
    expect(m.naturalWidth).toBe(800);
    expect(m.naturalHeight).toBe(1600);
    const anchor = w.EssayReview.getAnchors().find((a) => a.annotationIndex === 0);
    expect(anchor.anchor).toEqual({ x: 46.4, y: 180.8 });
    expect(anchor.estimate.w).toBeGreaterThan(0); // 粗粒度提示存在，但不得当精确高亮
    expect(anchor.viewport).not.toBeNull();
  });

  it('getSentenceElements 只返回被批注句子，并带 annotationIndex', async () => {
    const w = await loadPage();
    w.EssayReview.renderReport(REPORT);
    const items = w.EssayReview.getSentenceElements();
    expect(items.map((s) => s.annotationIndex)).toEqual([0, 1]);
    expect(items[0].type).toBe('highlight');
    expect(items[0].element.textContent).toBe('春日已至。');
  });

  it('onLayoutChange 在缩放/重置时触发，可取消订阅', async () => {
    const w = await loadPage();
    w.EssayReview.renderReport(REPORT);
    fireImageLoad(w, 800, 1600);
    let calls = 0;
    const off = w.EssayReview.onLayoutChange(() => {
      calls += 1;
    });
    w.EssayReview.resetView();
    expect(calls).toBeGreaterThan(0);
    const before = calls;
    off();
    w.EssayReview.resetView();
    expect(calls).toBe(before);
  });

  it('onImageReady 在已就绪时立即回调', async () => {
    const w = await loadPage();
    w.EssayReview.renderReport(REPORT);
    fireImageLoad(w, 800, 1600);
    let ready = null;
    w.EssayReview.onImageReady((m) => {
      ready = m;
    });
    expect(ready).not.toBeNull();
    expect(ready.ready).toBe(true);
  });
});

describe('错误态（可读，不白屏）', () => {
  it('缺 id → empty', async () => {
    const w = await loadPage('https://x.dev/v2/essay-review.html');
    w.localStorage.setItem('authToken', 't');
    await w.EssayReview.load();
    expect(w.EssayReview.getState()).toBe('empty');
  });

  it('无 token → auth（且不发请求）', async () => {
    const w = await loadPage();
    w.localStorage.removeItem('authToken');
    let called = 0;
    w.AIAPI.request = () => {
      called += 1;
      return Promise.resolve(null);
    };
    await w.EssayReview.load();
    expect(w.EssayReview.getState()).toBe('auth');
    expect(called).toBe(0);
  });

  it('离线 → offline（且不发请求）', async () => {
    const w = await loadPage();
    w.localStorage.setItem('authToken', 't');
    Object.defineProperty(w.navigator, 'onLine', { value: false, configurable: true });
    let called = 0;
    w.AIAPI.request = () => {
      called += 1;
      return Promise.resolve(null);
    };
    await w.EssayReview.load();
    expect(w.EssayReview.getState()).toBe('offline');
    expect(called).toBe(0);
  });

  it('HTTP 500 → error，文案透传', async () => {
    const w = await loadPage();
    w.localStorage.setItem('authToken', 't');
    w.AIAPI.request = () => Promise.reject(apiError(w, '报告保存失败', { status: 500 }));
    await w.EssayReview.load();
    expect(w.EssayReview.getState()).toBe('error');
    expect(w.document.getElementById('error-copy').textContent).toBe('报告保存失败');
  });

  it('401 → auth；网络失败 → offline', async () => {
    const w = await loadPage();
    w.localStorage.setItem('authToken', 't');
    w.AIAPI.request = () => Promise.reject(apiError(w, '未授权', { status: 401 }));
    await w.EssayReview.load();
    expect(w.EssayReview.getState()).toBe('auth');

    w.AIAPI.request = () => Promise.reject(apiError(w, '网络连接不可用', { kind: 'network' }));
    await w.EssayReview.load();
    expect(w.EssayReview.getState()).toBe('offline');
  });

  it('成功路径：POST /api/essay/report/:id（id 已编码）', async () => {
    const w = await loadPage('https://x.dev/v2/essay-review.html?id=r%2F1');
    w.localStorage.setItem('authToken', 't');
    const seen = [];
    w.AIAPI.request = (path, opts) => {
      seen.push({ path, method: opts && opts.method });
      return Promise.resolve(REPORT);
    };
    await w.EssayReview.load();
    expect(seen).toEqual([{ path: '/api/essay/report/r%2F1', method: 'POST' }]);
    expect(w.EssayReview.getState()).toBe('success');
    expect(w.EssayReview.getReport()).toBe(REPORT);
  });

  it('六态互斥，每次只有一个面板显示', async () => {
    const w = await loadPage();
    for (const s of w.EssayReview.STATES) {
      w.EssayReview.setState(s);
      expect(w.document.querySelectorAll('.state.is-on').length).toBe(1);
      expect(w.EssayReview.getState()).toBe(s);
    }
  });
});
