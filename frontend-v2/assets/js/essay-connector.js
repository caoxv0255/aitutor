/* ==========================================================================
 * 作文智能批改 · 批次 4 · 连线层（essay-connector.js）
 *
 * 页面：/v2/essay-review.html?id=<report_id>
 * 依赖：window.EssayReview 的只读访问器（批次 3 交付，本文件不改动它）
 *       getImageMetrics / getAnchors / getSentenceElements / onLayoutChange / onImageReady
 *
 * ── 锚点基调（批次 2 实测结论，勿改）────────────────────────────────────
 *   qwen3-vl 的 bbox 是 0–1000 归一化坐标，实测：
 *     左上角 (x, y) → 可靠（±1 行）        ← 连线端点只用它
 *     h            → 系统性偏大（常多 1–2 行）
 *     w            → 偏窄
 *   故本层**只**在 (x, y) 画端点 + 悬停小圆点，**不**用 w/h 画精确高亮矩形。
 *   w/h 的估算值只由批次 3 的 getAnchors().estimate 暴露，本层不消费。
 *
 * ── 坐标与清晰度 ────────────────────────────────────────────────────────
 *   端点 = 图片像素锚点 → 视口坐标（accessor 负责）→ 减 .reader-grid 原点 → SVG 本地坐标。
 *   两个方向都做 0.5px 取整（roundToHalfPixel）：1px 描边落在像素中心，避免模糊。
 *   SVG 用 CSS `position:absolute; inset:0; overflow:visible` 覆盖分屏容器，
 *   本身不滚动（滚动由页面/图片容器负责）。
 *
 * ── 重算时机 ────────────────────────────────────────────────────────────
 *   图片 onload（onImageReady）、缩放/平移（onLayoutChange）、scroll、resize 都只
 *   调 scheduleRefresh()：requestAnimationFrame 合并一帧内的多次触发。resize 额外
 *   重建 IntersectionObserver（观察 #reader-grid，离屏时不重算）。
 *
 * ── 移动端（<768px）────────────────────────────────────────────────────
 *   不画连线；改为左右两侧的标记点（图上锚点 1 个 + 文本侧 1 个），
 *   点标记 → 由 essay-bubble.js 弹全屏底部抽屉（mode: 'drawer'）。
 * ========================================================================== */
/* global window, document */
(function (global) {
  'use strict';

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const MOBILE_QUERY = '(max-width: 767px)';
  const TONE_COUNT = 6;
  const MIN_CTRL_DX = 24;

  /** severity → 线宽/虚实；未登记的类型一律走 unknown 兜底（仍画，不崩） */
  const SEVERITY_STYLE = {
    major: { key: 'major', width: 2.6, dash: null },
    moderate: { key: 'moderate', width: 2, dash: null },
    minor: { key: 'minor', width: 1.6, dash: '6 4' },
  };
  const SEVERITY_FALLBACK = { key: 'unknown', width: 1.4, dash: '2 4' };

  const els = {};
  const activators = [];
  const unsubs = [];
  let layout = [];
  let rafId = null;
  let observer = null;
  let boundReview = null;
  let markersEl = null;
  let hoverBound = false;

  function $(id) {
    return global.document.getElementById(id);
  }

  function isFiniteNum(v) {
    return typeof v === 'number' && Number.isFinite(v);
  }

  function rectOf(el) {
    if (!el || typeof el.getBoundingClientRect !== 'function') return null;
    try {
      return el.getBoundingClientRect();
    } catch (e) {
      return null;
    }
  }

  function isMobile() {
    try {
      if (typeof global.matchMedia !== 'function') return false;
      const mq = global.matchMedia(MOBILE_QUERY);
      return !!(mq && mq.matches);
    } catch (e) {
      return false;
    }
  }

  /* ══════════════════════════════════════════════════════════════════════
   * 纯函数区（无 DOM 依赖 —— 单测直接调用）
   * ══════════════════════════════════════════════════════════════════════ */

  /**
   * 0.5px 取整：先取整再加 0.5。
   * 1px 描边的垂直线落在 x.5 上，恰好铺满一个像素列而不被抗锯齿抹到两列 —— 这是
   * SVG/canvas 上"避免模糊"的常规做法（"取整后加 0.5"）。
   */
  function roundToHalfPixel(value) {
    return Math.round(value) + 0.5;
  }

  function snapPoint(point) {
    return { x: roundToHalfPixel(point.x), y: roundToHalfPixel(point.y) };
  }

  /**
   * 外接矩形 union（右栏句子跨行时取多行 rect 的并集）。
   * @param {Array<{left:number,top:number,width:number,height:number}>} rects
   * @returns {{left,top,width,height,right,bottom}|null} 空/全非法 → null
   */
  function unionRect(rects) {
    if (!Array.isArray(rects)) return null;
    let left = Infinity;
    let top = Infinity;
    let right = -Infinity;
    let bottom = -Infinity;
    let n = 0;
    rects.forEach(function (r) {
      if (!r) return;
      const l = r.left;
      const t = r.top;
      const w = r.width;
      const h = r.height;
      if (![l, t, w, h].every(isFiniteNum)) return;
      left = Math.min(left, l);
      top = Math.min(top, t);
      right = Math.max(right, l + w);
      bottom = Math.max(bottom, t + h);
      n += 1;
    });
    if (!n) return null;
    return { left: left, top: top, width: right - left, height: bottom - top, right: right, bottom: bottom };
  }

  /** 水平控制点的三次贝塞尔控制点（左出右入，跨列时呈 S 形） */
  function bezierControls(from, to) {
    const dx = Math.max(MIN_CTRL_DX, Math.abs(to.x - from.x) * 0.5);
    return { c1: { x: from.x + dx, y: from.y }, c2: { x: to.x - dx, y: to.y } };
  }

  function bezierPath(from, to) {
    const c = bezierControls(from, to);
    return (
      'M ' +
      from.x +
      ' ' +
      from.y +
      ' C ' +
      c.c1.x +
      ' ' +
      c.c1.y +
      ', ' +
      c.c2.x +
      ' ' +
      c.c2.y +
      ', ' +
      to.x +
      ' ' +
      to.y
    );
  }

  /** t = 0.5 的曲线点（按钮落在这里）：(P0 + 3P1 + 3P2 + P3) / 8 */
  function bezierMidpoint(from, to) {
    const c = bezierControls(from, to);
    return {
      x: (from.x + 3 * c.c1.x + 3 * c.c2.x + to.x) / 8,
      y: (from.y + 3 * c.c1.y + 3 * c.c2.y + to.y) / 8,
    };
  }

  function severityStyle(severity) {
    return SEVERITY_STYLE[severity] || SEVERITY_FALLBACK;
  }

  /** 同段落用同色系：优先按段落号选色，退化到批注序号；超出 6 档循环 */
  function toneIndexFor(annotationIndex, paragraphIndex) {
    const base = isFiniteNum(paragraphIndex) ? paragraphIndex : annotationIndex;
    return ((Math.trunc(base) % TONE_COUNT) + TONE_COUNT) % TONE_COUNT;
  }

  /**
   * 连线几何（纯函数）：锚点视口坐标 + 句子 rect 列表 → 端点/中点/线型。
   *
   * @param {object} input
   *   gridRect   {{left,top}}                        分屏容器原点（视口坐标）
   *   anchors    {Array<{annotationIndex:number, viewport:{x,y}|null}>}
   *   sentences  {Array<{annotationIndex:number, rects:Array<DOMRect-like>}>}
   *   paragraphOf {Object<number, number>}            批注序号 → 段落号（选色用）
   *   severityOf  {Object<number, string>}            批注序号 → severity
   * @returns {Array<{annotationIndex,from,to,mid,tone,severity,width,dash,path}>} 按序号升序
   */
  function computeLayout(input) {
    const opts = input || {};
    const origin = opts.gridRect || {};
    const ox = isFiniteNum(origin.left) ? origin.left : 0;
    const oy = isFiniteNum(origin.top) ? origin.top : 0;
    const paragraphOf = opts.paragraphOf || {};
    const severityOf = opts.severityOf || {};

    const rectsByIndex = new Map();
    (Array.isArray(opts.sentences) ? opts.sentences : []).forEach(function (s) {
      if (s && isFiniteNum(s.annotationIndex)) rectsByIndex.set(s.annotationIndex, s.rects);
    });

    const out = [];
    (Array.isArray(opts.anchors) ? opts.anchors : []).forEach(function (a) {
      if (!a || !isFiniteNum(a.annotationIndex)) return;
      const vp = a.viewport;
      if (!vp || !isFiniteNum(vp.x) || !isFiniteNum(vp.y)) return;
      if (!rectsByIndex.has(a.annotationIndex)) return;
      const u = unionRect(rectsByIndex.get(a.annotationIndex));
      if (!u) return;

      const from = snapPoint({ x: vp.x - ox, y: vp.y - oy });
      const to = snapPoint({ x: u.left - ox, y: u.top + u.height / 2 - oy });
      const mid = snapPoint(bezierMidpoint(from, to));
      const severity = severityOf[a.annotationIndex] || null;
      const style = severityStyle(severity);
      out.push({
        annotationIndex: a.annotationIndex,
        from: from,
        to: to,
        mid: mid,
        tone: toneIndexFor(a.annotationIndex, paragraphOf[a.annotationIndex]),
        severity: severity,
        width: style.width,
        dash: style.dash,
        path: bezierPath(from, to),
      });
    });
    out.sort(function (a, b) {
      return a.annotationIndex - b.annotationIndex;
    });
    return out;
  }

  /* ══════════════════════════════════════════════════════════════════════
   * DOM 渲染
   * ══════════════════════════════════════════════════════════════════════ */

  function svgEl(tag) {
    return global.document.createElementNS(SVG_NS, tag);
  }

  function elementRects(el) {
    if (!el) return [];
    let list = null;
    try {
      list = typeof el.getClientRects === 'function' ? el.getClientRects() : null;
    } catch (e) {
      list = null;
    }
    if (list && list.length) return Array.prototype.slice.call(list);
    const r = rectOf(el);
    return r ? [r] : [];
  }

  function paragraphIndexOf(el) {
    let node = el;
    let guard = 0;
    while (node && node !== els.grid && guard < 40) {
      if (
        node.getAttribute &&
        node.classList &&
        node.classList.contains('para') &&
        node.getAttribute('data-paragraph-index') !== null
      ) {
        const v = Number(node.getAttribute('data-paragraph-index'));
        return Number.isFinite(v) ? v : null;
      }
      node = node.parentNode;
      guard += 1;
    }
    return null;
  }

  function findSentenceElement(annotationIndex) {
    const review = global.EssayReview;
    if (!review || typeof review.getSentenceElements !== 'function') return null;
    const list = review.getSentenceElements();
    for (let i = 0; i < list.length; i += 1) {
      if (list[i] && list[i].annotationIndex === annotationIndex) return list[i].element;
    }
    return null;
  }

  /** 悬停高亮：连线/锚点小圆点 + 右栏句子背景（class 驱动，不写内联 style） */
  function setHighlight(annotationIndex, on) {
    if (els.svg) {
      const item = els.svg.querySelector('.connector-item[data-annotation-index="' + annotationIndex + '"]');
      if (item) item.classList.toggle('is-hl', !!on);
    }
    const sent = findSentenceElement(annotationIndex);
    if (sent && sent.classList) sent.classList.toggle('is-hl', !!on);
  }

  /** 触发一次"打开解析"：把按钮/标记的视口中心交给订阅者（气泡或抽屉） */
  function activate(annotationIndex, source, refEl) {
    const idx = Number(annotationIndex);
    if (!Number.isFinite(idx)) return null;
    const r = rectOf(refEl);
    const viewport = r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
    const payload = {
      annotationIndex: idx,
      source: source || 'line',
      mode: isMobile() ? 'drawer' : 'bubble',
      viewport: viewport,
    };
    activators.forEach(function (cb) {
      try {
        cb(payload);
      } catch (e) {
        /* 订阅者异常不得影响连线层 */
      }
    });
    return payload;
  }

  function onActivate(cb) {
    if (typeof cb !== 'function') return function () {};
    activators.push(cb);
    return function unsubscribe() {
      const i = activators.indexOf(cb);
      if (i !== -1) activators.splice(i, 1);
    };
  }

  function renderLines() {
    const review = global.EssayReview;
    if (!review) return;
    const metrics = typeof review.getImageMetrics === 'function' ? review.getImageMetrics() : null;
    // 首帧硬前提：图片已 onload 且自然尺寸可用，否则坐标无意义
    if (!metrics || !metrics.ready || !(metrics.naturalWidth > 0) || !(metrics.naturalHeight > 0)) return;

    const gridRect = rectOf(els.grid) || { left: 0, top: 0 };
    const anchors = typeof review.getAnchors === 'function' ? review.getAnchors() : [];
    const sentences = typeof review.getSentenceElements === 'function' ? review.getSentenceElements() : [];

    const sentenceInput = [];
    const paragraphOf = {};
    const severityOf = {};
    sentences.forEach(function (s) {
      if (!s || !s.element || !Number.isFinite(s.annotationIndex)) return;
      sentenceInput.push({ annotationIndex: s.annotationIndex, rects: elementRects(s.element) });
      if (s.severity) severityOf[s.annotationIndex] = s.severity;
      const para = paragraphIndexOf(s.element);
      if (para !== null) paragraphOf[s.annotationIndex] = para;
    });

    layout = computeLayout({
      gridRect: gridRect,
      anchors: anchors,
      sentences: sentenceInput,
      paragraphOf: paragraphOf,
      severityOf: severityOf,
    });

    const frag = global.document.createDocumentFragment();
    layout.forEach(function (line) {
      const g = svgEl('g');
      // tone 类挂在 <g> 上：path 描边与按钮描边都用 currentColor，保证同色系
      g.setAttribute('class', 'connector-item connector-tone-' + line.tone);
      g.setAttribute('data-annotation-index', String(line.annotationIndex));

      const path = svgEl('path');
      path.setAttribute('class', 'connector-line');
      path.setAttribute('d', line.path);
      path.setAttribute('stroke-width', String(line.width));
      if (line.dash) path.setAttribute('stroke-dasharray', line.dash);
      g.appendChild(path);

      // 左栏 (x, y) 处的锚点标记（悬停时显现；不是高亮矩形）
      const dot = svgEl('circle');
      dot.setAttribute('class', 'connector-anchor-dot');
      dot.setAttribute('cx', String(line.from.x));
      dot.setAttribute('cy', String(line.from.y));
      dot.setAttribute('r', '6');
      g.appendChild(dot);

      const btn = svgEl('g');
      btn.setAttribute('class', 'connector-btn');
      btn.setAttribute('data-annotation-index', String(line.annotationIndex));
      btn.setAttribute('role', 'button');
      btn.setAttribute('tabindex', '0');
      btn.setAttribute('aria-label', '查看第 ' + (line.annotationIndex + 1) + ' 条批注解析');
      const hit = svgEl('circle');
      hit.setAttribute('class', 'connector-btn__hit');
      hit.setAttribute('cx', String(line.mid.x));
      hit.setAttribute('cy', String(line.mid.y));
      hit.setAttribute('r', '14');
      btn.appendChild(hit);
      const label = svgEl('text');
      label.setAttribute('class', 'connector-btn__label');
      label.setAttribute('x', String(line.mid.x));
      label.setAttribute('y', String(line.mid.y));
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('dominant-baseline', 'central');
      label.textContent = '解析';
      btn.appendChild(label);
      g.appendChild(btn);

      g.addEventListener('mouseenter', function () {
        setHighlight(line.annotationIndex, true);
      });
      g.addEventListener('mouseleave', function () {
        setHighlight(line.annotationIndex, false);
      });
      const fire = function (event) {
        if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
        activate(line.annotationIndex, 'line', btn);
      };
      btn.addEventListener('click', fire);
      btn.addEventListener('keydown', function (event) {
        if (event && (event.key === 'Enter' || event.key === ' ')) fire(event);
      });

      frag.appendChild(g);
    });
    els.svg.appendChild(frag);
  }

  function addMarker(annotationIndex, kind, localX, localY) {
    if (!markersEl) return;
    const btn = global.AIUI.el('button', 'connector-marker connector-marker--' + kind, String(annotationIndex + 1));
    btn.type = 'button';
    btn.setAttribute('data-annotation-index', String(annotationIndex));
    btn.setAttribute('aria-label', '查看第 ' + (annotationIndex + 1) + ' 条批注解析');
    btn.style.left = roundToHalfPixel(localX) + 'px';
    btn.style.top = roundToHalfPixel(localY) + 'px';
    btn.addEventListener('click', function (event) {
      if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
      activate(annotationIndex, 'marker', btn);
    });
    markersEl.appendChild(btn);
  }

  function renderMobileMarkers() {
    const review = global.EssayReview;
    if (!review || !markersEl) return;
    const gridRect = rectOf(els.grid) || { left: 0, top: 0 };
    const anchors = typeof review.getAnchors === 'function' ? review.getAnchors() : [];
    const sentences = typeof review.getSentenceElements === 'function' ? review.getSentenceElements() : [];
    const byIndex = new Map();
    sentences.forEach(function (s) {
      if (s && Number.isFinite(s.annotationIndex)) byIndex.set(s.annotationIndex, s);
    });

    anchors.forEach(function (a) {
      if (!a || !Number.isFinite(a.annotationIndex)) return;
      const vp = a.viewport;
      if (vp && isFiniteNum(vp.x) && isFiniteNum(vp.y)) {
        addMarker(a.annotationIndex, 'image', vp.x - gridRect.left, vp.y - gridRect.top);
      }
      const s = byIndex.get(a.annotationIndex);
      if (s && s.element) {
        const u = unionRect(elementRects(s.element));
        if (u) {
          addMarker(a.annotationIndex, 'text', u.left - gridRect.left, u.top + u.height / 2 - gridRect.top);
        }
      }
    });
  }

  /** 清空并按当前断点重画（桌面连线 / 移动端标记） */
  function render() {
    if (!els.svg) return layout;
    els.svg.textContent = '';
    if (markersEl) markersEl.textContent = '';
    layout = [];
    if (isMobile()) {
      renderMobileMarkers();
      return layout;
    }
    renderLines();
    return layout;
  }

  function scheduleRefresh() {
    if (rafId !== null) return;
    const raf =
      typeof global.requestAnimationFrame === 'function'
        ? global.requestAnimationFrame
        : function (fn) {
            return global.setTimeout(fn, 16);
          };
    rafId = raf(function () {
      rafId = null;
      render();
    });
  }

  function teardownObserver() {
    if (!observer) return;
    try {
      observer.disconnect();
    } catch (e) {
      /* 忽略 */
    }
    observer = null;
  }

  function setupObserver() {
    teardownObserver();
    if (typeof global.IntersectionObserver !== 'function' || !els.grid) return;
    observer = new global.IntersectionObserver(function (entries) {
      if (!entries || !entries.length) return;
      const anyVisible = entries.some(function (e) {
        return e && e.isIntersecting;
      });
      if (anyVisible) scheduleRefresh();
    });
    try {
      observer.observe(els.grid);
    } catch (e) {
      /* 观察失败不影响 scroll/layout 重算 */
    }
  }

  function onResize() {
    setupObserver();
    scheduleRefresh();
  }

  function onScrollOrLayout() {
    scheduleRefresh();
  }

  function bindReview() {
    const review = global.EssayReview;
    if (!review || boundReview === review) return;
    boundReview = review;
    if (typeof review.onLayoutChange === 'function') unsubs.push(review.onLayoutChange(onScrollOrLayout));
    if (typeof review.onImageReady === 'function') unsubs.push(review.onImageReady(onScrollOrLayout));
  }

  /** 句子是批次 3 渲染的，且会因学科切换整段重建 → 用事件委托，避免监听器失效 */
  function bindHover() {
    if (hoverBound || !els.revisedText) return;
    hoverBound = true;
    const resolve = function (event) {
      const target = event && event.target;
      if (!target || typeof target.closest !== 'function') return null;
      const hit = target.closest('[data-annotation-index]');
      if (!hit || !els.revisedText.contains(hit)) return null;
      const idx = Number(hit.getAttribute('data-annotation-index'));
      return Number.isFinite(idx) ? idx : null;
    };
    els.revisedText.addEventListener('mouseover', function (event) {
      const idx = resolve(event);
      if (idx !== null) setHighlight(idx, true);
    });
    els.revisedText.addEventListener('mouseout', function (event) {
      const idx = resolve(event);
      if (idx !== null) setHighlight(idx, false);
    });
  }

  function isMounted() {
    return !!els.svg;
  }

  function mount() {
    els.svg = $('connector-layer');
    els.grid = $('reader-grid');
    els.revisedText = $('revised-text');
    if (!els.svg || !els.grid) return false;

    // width/height 的 0 尺寸只是批次 3 的占位；交给 CSS inset:0 铺满容器
    els.svg.removeAttribute('width');
    els.svg.removeAttribute('height');

    if (!markersEl) {
      markersEl = global.document.createElement('div');
      markersEl.className = 'connector-markers';
      els.grid.appendChild(markersEl);
    }

    bindReview();
    bindHover();
    global.addEventListener('scroll', onScrollOrLayout, { passive: true });
    global.addEventListener('resize', onResize);
    setupObserver();
    scheduleRefresh();
    return true;
  }

  /** 测试/换页用：卸订阅、拆监听、清空图层 */
  function reset() {
    unsubs.splice(0).forEach(function (off) {
      try {
        off();
      } catch (e) {
        /* 忽略 */
      }
    });
    boundReview = null;
    teardownObserver();
    if (global.removeEventListener) {
      global.removeEventListener('scroll', onScrollOrLayout);
      global.removeEventListener('resize', onResize);
    }
    activators.splice(0);
    if (els.svg) els.svg.textContent = '';
    if (markersEl && markersEl.parentNode) markersEl.parentNode.removeChild(markersEl);
    markersEl = null;
    hoverBound = false;
    layout = [];
    els.svg = null;
    els.grid = null;
    els.revisedText = null;
  }

  global.EssayConnector = {
    // 纯函数（单测直接调用）
    roundToHalfPixel: roundToHalfPixel,
    unionRect: unionRect,
    bezierPath: bezierPath,
    bezierMidpoint: bezierMidpoint,
    severityStyle: severityStyle,
    toneIndexFor: toneIndexFor,
    computeLayout: computeLayout,

    // 生命周期 / 访问器
    mount: mount,
    reset: reset,
    refresh: render,
    isMounted: isMounted,
    isMobile: isMobile,
    setHighlight: setHighlight,
    onActivate: onActivate,
    activate: activate,
    getLayout: function () {
      return layout.slice();
    },
  };

  if (global.document.readyState === 'loading') {
    global.document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})(window);
