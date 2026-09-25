// 作文智能批改 · 批次 4：连线层（essay-connector.js）+ 气泡/抽屉（essay-bubble.js）
//
// 覆盖（本批验收项）：
//   1. 静态合规：两个新模块零 innerHTML / insertAdjacentHTML / document.write；页面无内联 <style>/CDN
//   2. 连线数学：0.5px 取整、跨行 union、锚点→端点、贝塞尔中点、severity→线宽/虚实
//   3. 气泡定位算法：视口四边防溢出（含"气泡比视口还宽"的退化边界）
//   4. jsdom 集成：假报告 → 画线数 == 句子数；点中点按钮出气泡；点空白关闭；再点同一按钮切换关闭
//   5. 移动端：<768px 不画线、出左右标记点、点标记弹底部抽屉
//
// 用 vitest（environment=node）+ jsdom，纳入 `npm test`（门禁第 1 段）。
import fs from 'node:fs';
import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';

const DIR = 'frontend-v2';
const read = (p) => fs.readFileSync(`${DIR}/${p}`, 'utf8');

const htmlSrc = read('essay-review.html');
const connectorJs = read('assets/js/essay-connector.js');
const bubbleJs = read('assets/js/essay-bubble.js');
const cssSrc = read('assets/css/essay-review.css');
const pageJs = read('assets/js/essay-review.js');
const markedJs = read('assets/vendor/marked/marked.umd.js');
const purifyJs = read('assets/vendor/dompurify/purify.min.js');
const uiJs = read('assets/js/ui.js');
const apiJs = read('assets/js/api.js');

/** 去掉块注释与行注释，只留下代码（用于"零注入入口"断言） */
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, ''))
    .join('\n');
}

/**
 * jsdom 不加载外链脚本 → 把页面用到的脚本按 src 名内联（顺序与 HTML 一致）。
 * ⚠️ 替换串必须用函数形式：源码含 `$$`/`$'` 等序列，String.replace 会啃坏源码。
 */
function bootstrap(url) {
  const inlined = htmlSrc
    .replace(/<script src="[^"]*marked\.umd\.js"><\/script>/, () => `<script>${markedJs}</script>`)
    .replace(/<script src="[^"]*purify\.min\.js"><\/script>/, () => `<script>${purifyJs}</script>`)
    .replace(/<script src="[^"]*ui\.js"><\/script>/, () => `<script>${uiJs}</script>`)
    .replace(/<script src="[^"]*api\.js"><\/script>/, () => `<script>${apiJs}</script>`)
    .replace(/<script src="[^"]*essay-review\.js"><\/script>/, () => `<script>${pageJs}</script>`)
    .replace(/<script src="[^"]*essay-connector\.js"><\/script>/, () => `<script>${connectorJs}</script>`)
    .replace(/<script src="[^"]*essay-bubble\.js"><\/script>/, () => `<script>${bubbleJs}</script>`);
  return new JSDOM(inlined, { runScripts: 'dangerously', url, pretendToBeVisual: true });
}

async function loadPage(url = 'https://x.dev/v2/essay-review.html?id=r-1') {
  const dom = bootstrap(url);
  dom.window.fetch = () => Promise.reject(new Error('no network in test'));
  await new Promise((res) => dom.window.addEventListener('load', res));
  return dom.window;
}

/** 模拟 <img> 加载完成（jsdom 不真的取图） */
function fireImageLoad(w, naturalWidth, naturalHeight) {
  const img = w.document.getElementById('essay-image');
  Object.defineProperty(img, 'naturalWidth', { value: naturalWidth, configurable: true });
  Object.defineProperty(img, 'naturalHeight', { value: naturalHeight, configurable: true });
  img.dispatchEvent(new w.Event('load'));
}

/** 强制 <768px 移动端（jsdom 的 matchMedia 恒 false，这里按查询串模拟） */
function forceMobile(w, matches) {
  w.matchMedia = (query) => ({
    matches: matches && String(query).indexOf('max-width') !== -1,
    media: String(query),
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent() {
      return false;
    },
  });
}

function clickOn(w, el) {
  el.dispatchEvent(new w.Event('click', { bubbles: true, cancelable: true }));
}

const tick = (w) => new Promise((res) => w.setTimeout(res, 0));
/** 每条被批注句都有 bbox → 期望"画线数 == 被批注句数" */
const REPORT = {
  report_id: 'r-1',
  essay_title: '我的母亲',
  subject: 'chinese',
  transcript: {
    paragraphs: [
      { paragraph_index: 0, lines: [{ text: '春天来了。' }] },
      { paragraph_index: 1, lines: [{ text: '小树发芽了。' }] },
    ],
  },
  annotations: [
    {
      type: 'highlight',
      anchor: { paragraph_index: 0, quote: '春天来了。' },
      comment: '开场点题，**好**。',
      revised_text: '春日已至。',
      severity: 'minor',
      knowledge_points: ['修辞', '开头'],
      bbox: { x: 58, y: 113, w: 520, h: 207 },
    },
    {
      type: 'grammar_error',
      anchor: { paragraph_index: 1, quote: '小树发芽了。' },
      comment: '主谓搭配不当。',
      severity: 'major',
      knowledge_points: ['主谓'],
      bbox: { x: 100, y: 500, w: 200, h: 100 },
    },
  ],
  meta: { image_url: '/uploads/essay/a.jpg', summary: '总评。', scores: { total: 51 } },
  image_url: '/uploads/essay/a.jpg',
};

/** 渲染报告 + 图片就绪 + 强制连线层重算（jsdom 无布局，显式触发确定性） */
function renderWithLayout(w, report = REPORT) {
  w.EssayReview.renderReport(report);
  fireImageLoad(w, 800, 1600);
  w.EssayConnector.refresh();
}

describe('批次 4 静态合规', () => {
  it('页面接入 essay-review.css 与两个新脚本（连在 essay-review.js 之后）', () => {
    expect(htmlSrc).toContain('<link rel="stylesheet" href="/assets/v2/css/essay-review.css">');
    const order = [...htmlSrc.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);
    const iReview = order.findIndex((s) => s.endsWith('/essay-review.js'));
    const iConn = order.findIndex((s) => s.endsWith('/essay-connector.js'));
    const iBubble = order.findIndex((s) => s.endsWith('/essay-bubble.js'));
    expect(iReview).toBeGreaterThan(-1);
    expect(iConn).toBeGreaterThan(iReview);
    expect(iBubble).toBeGreaterThan(iConn);
  });

  it('两个新模块（去注释后）零 innerHTML / insertAdjacentHTML / document.write', () => {
    for (const src of [connectorJs, bubbleJs]) {
      const code = stripComments(src);
      expect(/innerHTML/.test(code)).toBe(false);
      expect(/insertAdjacentHTML/.test(code)).toBe(false);
      expect(/document\s*\.\s*write\s*\(/.test(code)).toBe(false);
    }
  });

  it('新模块无直接 fetch、无境外 CDN、无内联 <style>', () => {
    for (const src of [connectorJs, bubbleJs]) {
      expect(/googleapis|jsdelivr|unpkg/.test(src)).toBe(false);
      expect(/\bfetch\(/.test(stripComments(src))).toBe(false);
    }
    expect(/<style[^>]*>/.test(htmlSrc)).toBe(false);
  });

  it('essay-review.css 不引 CDN 字体、且用共享层变量（不重定义一套色板）', () => {
    expect(/@import\s+url\(\s*['"]?https?:/i.test(cssSrc)).toBe(false);
    expect(/googleapis|jsdelivr|unpkg/i.test(cssSrc)).toBe(false);
    expect(/var\(--ink\)/.test(cssSrc)).toBe(true);
    expect(/var\(--surface\)/.test(cssSrc)).toBe(true);
  });
});

describe('连线数学（纯函数）', () => {
  it('0.5px 取整：先取整再加 0.5（1px 描边落在像素中心，避免模糊）', async () => {
    const w = await loadPage();
    const f = w.EssayConnector.roundToHalfPixel;
    expect(f(100)).toBe(100.5);
    expect(f(100.4)).toBe(100.5);
    expect(f(100.6)).toBe(101.5);
    expect(f(-0.4)).toBe(0.5); // Math.round(-0.4) = -0 → -0 + 0.5 = 0.5
  });

  it('跨行 union：取外接矩形（含空/非法输入 → null）', async () => {
    const w = await loadPage();
    const u = w.EssayConnector.unionRect;
    expect(
      u([
        { left: 10, top: 20, width: 30, height: 10 },
        { left: 12, top: 40, width: 40, height: 12 },
      ])
    ).toEqual({ left: 10, top: 20, width: 42, height: 32, right: 52, bottom: 52 });
    expect(u([])).toBeNull();
    expect(u(null)).toBeNull();
    expect(u([{ left: NaN, top: 0, width: 1, height: 1 }])).toBeNull();
  });

  it('锚点→端点：视口坐标减容器原点，并 0.5px 取整；跨行句子取 union 左中', async () => {
    const w = await loadPage();
    const lines = w.EssayConnector.computeLayout({
      gridRect: { left: 5, top: 7 },
      anchors: [{ annotationIndex: 0, viewport: { x: 45.4, y: 187.8 } }],
      sentences: [
        {
          annotationIndex: 0,
          rects: [
            { left: 300, top: 60, width: 100, height: 20 },
            { left: 300, top: 80, width: 60, height: 20 },
          ],
        },
      ],
      paragraphOf: { 0: 2 },
      severityOf: { 0: 'minor' },
    });
    expect(lines.length).toBe(1);
    // from = (45.4-5, 187.8-7) = (40.4, 180.8) → snap → (40.5, 181.5)
    expect(lines[0].from).toEqual({ x: 40.5, y: 181.5 });
    // union = {left:300, top:60, width:100, height:40} → 左中 (300-5, 60+20-7) = (295, 73) → snap
    expect(lines[0].to).toEqual({ x: 295.5, y: 73.5 });
    expect(lines[0].tone).toBe(2); // 段落号决定色系
    expect(lines[0].severity).toBe('minor');
    expect(lines[0].width).toBeLessThan(2); // minor 线更细
    expect(lines[0].dash).toBeTruthy(); // minor 虚线
    expect(lines[0].path).toMatch(/^M 40\.5 181\.5 C /);
  });

  it('缺锚点 / 缺句子 / 空 rects → 该条不画；结果按 annotationIndex 升序', async () => {
    const w = await loadPage();
    const lines = w.EssayConnector.computeLayout({
      gridRect: { left: 0, top: 0 },
      anchors: [
        { annotationIndex: 2, viewport: { x: 10, y: 10 } },
        { annotationIndex: 0, viewport: null },
        { annotationIndex: 1, viewport: { x: 20, y: 20 } },
        { annotationIndex: 3, viewport: { x: 30, y: 30 } },
      ],
      sentences: [
        { annotationIndex: 2, rects: [{ left: 100, top: 100, width: 10, height: 10 }] },
        { annotationIndex: 1, rects: [{ left: 100, top: 100, width: 10, height: 10 }] },
        { annotationIndex: 3, rects: [] },
      ],
    });
    expect(lines.map((l) => l.annotationIndex)).toEqual([1, 2]);
  });

  it('贝塞尔：中点 y 恒为两端 y 的均值（横置控制点）', async () => {
    const w = await loadPage();
    const m = w.EssayConnector.bezierMidpoint({ x: 0, y: 10 }, { x: 100, y: 30 });
    expect(m.y).toBe(20);
    expect(m.x).toBeGreaterThan(0);
    expect(m.x).toBeLessThan(100);
  });

  it('severity → 线宽/虚实：major 最粗实线、moderate 中、minor 虚线、未知有兜底', async () => {
    const w = await loadPage();
    const s = w.EssayConnector.severityStyle;
    expect(s('major').width).toBeGreaterThan(s('moderate').width);
    expect(s('moderate').width).toBeGreaterThan(s('minor').width);
    expect(s('major').dash).toBeNull();
    expect(s('minor').dash).toBeTruthy();
    expect(s(undefined).key).toBe('unknown');
    expect(s('brand_new').key).toBe('unknown');
  });
});

describe('气泡定位算法（避免溢出视口）', () => {
  const V = { width: 1000, height: 800 };
  const S = { width: 240, height: 160 };

  it('默认放在锚点上方，水平居中', async () => {
    const w = await loadPage();
    const p = w.EssayBubble.positionAt({ x: 500, y: 400 }, S, V);
    expect(p.placement).toBe('top');
    expect(p.left).toBe(380);
    expect(p.top).toBe(400 - 14 - 160);
  });

  it('上方空间不足 → 翻到下方', async () => {
    const w = await loadPage();
    const p = w.EssayBubble.positionAt({ x: 500, y: 30 }, S, V);
    expect(p.placement).toBe('bottom');
    expect(p.top).toBe(30 + 14);
  });

  it('右侧溢出 → 左移贴边（不越过右边距）', async () => {
    const w = await loadPage();
    const p = w.EssayBubble.positionAt({ x: 990, y: 400 }, S, V);
    expect(p.left).toBe(1000 - 12 - 240);
  });

  it('左侧溢出 → 贴左边距', async () => {
    const w = await loadPage();
    const p = w.EssayBubble.positionAt({ x: 5, y: 400 }, S, V);
    expect(p.left).toBe(12);
  });

  it('下方也放不下（贴底）→ top 收敛到视口内，绝不溢出', async () => {
    const w = await loadPage();
    const p = w.EssayBubble.positionAt({ x: 500, y: 795 }, S, V);
    expect(p.top + S.height).toBeLessThanOrEqual(V.height);
    expect(p.top).toBeGreaterThanOrEqual(12);
  });

  it('气泡比视口还宽/高 → 退化为贴左/贴上边距（仍不产生负坐标）', async () => {
    const w = await loadPage();
    const p = w.EssayBubble.positionAt({ x: 500, y: 400 }, { width: 2000, height: 2000 }, V);
    expect(p.left).toBe(12);
    expect(p.top).toBe(12);
  });
});

describe('jsdom 集成：报告 → 连线 → 气泡', () => {
  it('画线数 == 被批注句数（每条都有 bbox 时）', async () => {
    const w = await loadPage();
    renderWithLayout(w);
    const items = w.document.querySelectorAll('#connector-layer .connector-item');
    expect(items.length).toBe(2);
    const sentences = w.EssayReview.getSentenceElements();
    expect(sentences.length).toBe(2);
    expect(items.length).toBe(sentences.length);
    // 每条线都有可点击中点按钮
    expect(w.document.querySelectorAll('#connector-layer .connector-btn').length).toBe(2);
    // 色系按段落挂在连线组上（<path> 与按钮靠 currentColor 继承同色）
    expect(items[0].classList.contains('connector-tone-0')).toBe(true);
    expect(items[1].classList.contains('connector-tone-1')).toBe(true);
    expect(items[0].querySelector('.connector-line').getAttribute('class')).toBe('connector-line');
  });

  it('图片未 onload → 不画线（坐标为空的硬前提）', async () => {
    const w = await loadPage();
    w.EssayReview.renderReport(REPORT);
    w.EssayConnector.refresh();
    expect(w.document.querySelectorAll('#connector-layer .connector-item').length).toBe(0);
    expect(w.EssayReview.getImageMetrics().ready).toBe(false);
  });

  it('点中点按钮 → 出气泡；内容含 comment 与知识点标签；点空白关闭', async () => {
    const w = await loadPage();
    renderWithLayout(w);
    const btn = w.document.querySelector('#connector-layer [data-annotation-index="0"] .connector-btn');
    clickOn(w, btn);

    const bubble = w.document.querySelector('.essay-bubble');
    expect(bubble).not.toBeNull();
    expect(bubble.getAttribute('data-annotation-index')).toBe('0');
    expect(bubble.textContent).toContain('开场点题');
    expect(bubble.querySelector('.essay-bubble__type').textContent).toBe('好词好句');
    const tags = [...bubble.querySelectorAll('.bubble-tag')].map((t) => t.textContent);
    expect(tags).toEqual(['修辞', '开头']);
    expect(bubble.querySelector('strong')).not.toBeNull(); // Markdown 已渲染

    await tick(w);
    clickOn(w, w.document.body);
    expect(w.document.querySelector('.essay-bubble')).toBeNull();
  });

  it('再次点同一按钮 → 切换关闭（同屏只一个气泡）', async () => {
    const w = await loadPage();
    renderWithLayout(w);
    const btn = w.document.querySelector('#connector-layer [data-annotation-index="0"] .connector-btn');
    clickOn(w, btn);
    expect(w.document.querySelectorAll('.essay-bubble').length).toBe(1);
    clickOn(w, btn);
    expect(w.document.querySelectorAll('.essay-bubble').length).toBe(0);
  });

  it('点另一条线的按钮 → 仍只有一个气泡，且切到新条目', async () => {
    const w = await loadPage();
    renderWithLayout(w);
    clickOn(w, w.document.querySelector('#connector-layer [data-annotation-index="0"] .connector-btn'));
    clickOn(w, w.document.querySelector('#connector-layer [data-annotation-index="1"] .connector-btn'));
    const bubbles = w.document.querySelectorAll('.essay-bubble');
    expect(bubbles.length).toBe(1);
    expect(bubbles[0].getAttribute('data-annotation-index')).toBe('1');
  });

  it('悬停连线 → 对应句子与锚点标记高亮', async () => {
    const w = await loadPage();
    renderWithLayout(w);
    const item = w.document.querySelector('#connector-layer [data-annotation-index="0"]');
    item.dispatchEvent(new w.Event('mouseenter'));
    expect(item.classList.contains('is-hl')).toBe(true);
    const sent = w.document.querySelector('#revised-text [data-annotation-index="0"]');
    expect(sent.className).toContain('is-hl');
    item.dispatchEvent(new w.Event('mouseleave'));
    expect(item.classList.contains('is-hl')).toBe(false);
    expect(sent.className).not.toContain('is-hl');
  });

  it('气泡正文缺 comment/explanation → 显示固定提示，不渲染空壳', async () => {
    const w = await loadPage();
    renderWithLayout(w, {
      ...REPORT,
      annotations: REPORT.annotations.map((a) => ({ ...a, comment: undefined })),
    });
    clickOn(w, w.document.querySelector('#connector-layer [data-annotation-index="0"] .connector-btn'));
    expect(w.document.querySelector('.essay-bubble').textContent).toContain('未包含解析');
  });

  it('气泡渲染不可信 Markdown 时经 DOMPurify 消毒（无 script / 无 onerror）', async () => {
    const w = await loadPage();
    renderWithLayout(w, {
      ...REPORT,
      annotations: REPORT.annotations.map((a) => ({
        ...a,
        comment: '正文 <script>alert(1)</script> <img src=x onerror="alert(2)">',
      })),
    });
    clickOn(w, w.document.querySelector('#connector-layer [data-annotation-index="0"] .connector-btn'));
    const bubble = w.document.querySelector('.essay-bubble');
    expect(bubble.querySelectorAll('script').length).toBe(0);
    const img = bubble.querySelector('img');
    expect(img === null || !img.hasAttribute('onerror')).toBe(true);
  });
});

describe('移动端（<768px）：不画线，出标记点 + 底部抽屉', () => {
  it('匹配 <768px → 无连线，出现左右标记点', async () => {
    const w = await loadPage();
    renderWithLayout(w);
    expect(w.document.querySelectorAll('#connector-layer .connector-item').length).toBe(2);

    forceMobile(w, true);
    w.EssayConnector.refresh();
    expect(w.document.querySelectorAll('#connector-layer .connector-item').length).toBe(0);
    const markers = w.document.querySelectorAll('.connector-marker');
    expect(markers.length).toBe(4); // 每条批注：图上 1 个 + 文本侧 1 个
    expect(w.document.querySelectorAll('.connector-marker--image').length).toBe(2);
    expect(w.document.querySelectorAll('.connector-marker--text').length).toBe(2);
  });

  it('点标记 → 弹全屏底部抽屉（含关闭按钮）；点遮罩关闭', async () => {
    const w = await loadPage();
    renderWithLayout(w);
    forceMobile(w, true);
    w.EssayConnector.refresh();

    clickOn(w, w.document.querySelector('.connector-marker--image'));
    const drawer = w.document.querySelector('.essay-drawer');
    expect(drawer).not.toBeNull();
    expect(drawer.getAttribute('role')).toBe('dialog');
    expect(drawer.textContent).toContain('开场点题');
    const backdrop = w.document.querySelector('.essay-drawer-backdrop');
    expect(backdrop).not.toBeNull();

    clickOn(w, backdrop);
    expect(w.document.querySelector('.essay-drawer')).toBeNull();
    expect(w.document.querySelector('.essay-drawer-backdrop')).toBeNull();
  });

  it('切回桌面断点 → 标记点清空、恢复连线', async () => {
    const w = await loadPage();
    renderWithLayout(w);
    forceMobile(w, true);
    w.EssayConnector.refresh();
    expect(w.document.querySelectorAll('.connector-marker').length).toBe(4);

    forceMobile(w, false);
    w.EssayConnector.refresh();
    expect(w.document.querySelectorAll('.connector-marker').length).toBe(0);
    expect(w.document.querySelectorAll('#connector-layer .connector-item').length).toBe(2);
  });
});
