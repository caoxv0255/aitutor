/* ==========================================================================
 * 作文智能批改 · 批改报告阅读器（批次 3）
 *
 * 路由：/v2/essay-review.html?id=<report_id>
 * 数据：POST /api/essay/report/:reviewId（AIAPI.request，Bearer 走 api.js）
 *
 * ── 本批边界（批次 4 才做）────────────────────────────────────────────
 *   本文件**不画连线、不做气泡、不写 essay-review.css**。只做：
 *     骨架渲染 + 图片缩放平移 + 对外暴露"只读访问器"，让批次 4 能算连线。
 *
 * ── 锚点基调（批次 2 实测结论，勿改）──────────────────────────────────
 *   qwen3-vl 返回的 bbox 是 0–1000 归一化坐标，但实测：
 *     左上角 (x, y) → 可靠（±1 行）        ← 只用它做行/段级锚点
 *     h            → 系统性偏大（常多 1–2 行）
 *     w            → 偏窄
 *   故：**不得**用 w/h 画"精确高亮矩形"。w/h 只在 estimate 里作粗粒度提示。
 *
 * ── Markdown 渲染 vs 永久闸门 check-no-ai-innerhtml.mjs ──────────────
 *   总体评语是 LLM 产出（= 不可信输入），必须走 Markdown 渲染 → 必然产出 HTML。
 *   但本仓闸门禁止 `innerHTML =`（非静态）/ `innerHTML +=` / `insertAdjacentHTML`
 *   / `document.write`。合规路径（DOMPurify 消毒后走 DOM 挂载，全程不碰 innerHTML）：
 *     DOMPurify.sanitize(marked.parse(md))  →  HTML 字符串
 *       → DOMParser().parseFromString(html, 'text/html')  → 文档
 *       → document.importNode(node, true) + appendChild  → 纯 DOM
 *   marked / DOMPurify 自托管于 /assets/v2/vendor/（见 essay-review.html 注释）；
 *   两者缺失时**降级**为纯文本 + 段落，并在 UI 上标注「Markdown 未渲染」。
 *
 * ── 容错（老数据）────────────────────────────────────────────────────
 *   annotations 的 revised_text / severity / knowledge_points / bbox 是批次 2
 *   新增的 **optional** 键，老数据没有 → 任何缺失都必须照常渲染，不得崩。
 *   bbox 缺失 → 该批注不进 getAnchors()，但文本仍着色。
 *
 * ── 轮询（2026-09-26：analyze 改异步）────────────────────────────────
 *   /api/essay/analyze 建 pending 行后立即返回，后台跑批改。本页读到
 *   status='pending' 就停在 loading 态（文案「AI 正在批改中…」）并按 POLL 退避
 *   重试，直到 completed → success / failed → error；超过 maxAttempts 仍 pending
 *   也落 error（有终点，不无限轮询）。**复用现有六态**，不新增状态名。
 * ========================================================================== */
/* global window, document */
(function (global) {
  'use strict';

  const STATES = ['empty', 'loading', 'success', 'error', 'auth', 'offline'];
  const BBOX_MAX = 1000;

  /**
   * 轮询参数 (2026-09-26: analyze 改异步后, 报告是「先 pending 后 completed」)。
   *
   * 取值依据: qwen-plus 批改实测 ~41.5s, 转录再加 ~10s。退避 1.5s→…→4s 上限,
   * 累计 30 次 ≈ 115s 的覆盖窗口 —— 正常一次 (~50s) 只用十几轮, 异常时也有明确
   * 终点 (不会无限轮询打服务端)。
   */
  const POLL = { baseMs: 1500, factor: 1.5, maxMs: 4000, maxAttempts: 30 };
  const MIN_SCALE = 0.5;
  const MAX_SCALE = 6;

  /** change_type（现有 5 枚举）→ CSS 类后缀；未登记的类型 → unknown（仍渲染，不崩） */
  const TYPE_CLASS = {
    highlight: 'highlight',
    masterstroke: 'masterstroke',
    grammar_error: 'grammar-error',
    advanced_vocab: 'advanced-vocab',
    logic_issue: 'logic-issue',
  };

  /** 批注类型显示名：只换标签文案，不改动报告数据（无"换学科重批"接口） */
  const TYPE_LABEL = {
    chinese: {
      highlight: '好词好句',
      masterstroke: '点睛之笔',
      grammar_error: '语病',
      advanced_vocab: '高级词汇',
      logic_issue: '逻辑结构',
    },
    english: {
      highlight: 'Good phrase',
      masterstroke: 'Highlight',
      grammar_error: 'Grammar',
      advanced_vocab: 'Advanced word',
      logic_issue: 'Logic',
    },
  };

  const SUBJECT_LABEL = { chinese: '语文', english: '英语' };

  const els = {};
  let machine = null;
  const state = {
    report: null,
    annotations: [],
    transcript: null,
    subject: 'chinese',
    subjectKnown: false,
    imageReady: false,
    naturalWidth: 0,
    naturalHeight: 0,
    unanchored: 0,
  };
  const view = { scale: 1, tx: 0, ty: 0 };
  const layoutListeners = [];
  const imageReadyListeners = [];
  let dragging = null;
  let pollTimer = null;

  function $(id) {
    return global.document.getElementById(id);
  }

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  function isFiniteNum(v) {
    return typeof v === 'number' && Number.isFinite(v);
  }

  /* ══════════════════════════════════════════════════════════════════════
   * 纯函数区（无 DOM 依赖 —— 单测直接调用）
   * ══════════════════════════════════════════════════════════════════════ */

  /**
   * 归一化 bbox(0–1000) 校验/归一。与后端 BboxSchema 同判据（含越界检查）。
   * @returns {{x:number,y:number,w:number,h:number}|null} 非法 → null
   */
  function normalizeBbox(bbox) {
    if (!bbox || typeof bbox !== 'object') return null;
    const x = bbox.x;
    const y = bbox.y;
    const w = bbox.w;
    const h = bbox.h;
    if (![x, y, w, h].every(isFiniteNum)) return null;
    if (x < 0 || y < 0 || w < 0 || h < 0) return null;
    if (x > BBOX_MAX || y > BBOX_MAX || w > BBOX_MAX || h > BBOX_MAX) return null;
    if (x + w > BBOX_MAX || y + h > BBOX_MAX) return null;
    return { x: x, y: y, w: w, h: h };
  }

  /**
   * 归一化 bbox(0–1000) → 像素矩形（批次 4 的地基）。
   *
   * ⚠️ 返回值是"按图片自然尺寸线性换算"的结果。由于 h 系统性偏大 / w 偏窄，
   *    **只有 x/y 可直接用作行/段级锚点**；w/h 仅供粗粒度提示，不得据此画精确高亮。
   *
   * @param {{x,y,w,h}} bbox 0–1000 归一化坐标
   * @param {number} width  图片像素宽（naturalWidth）
   * @param {number} height 图片像素高（naturalHeight）
   * @returns {{x,y,w,h,right,bottom}|null} bbox 非法或尺寸非法 → null
   */
  function bboxToPixels(bbox, width, height) {
    const b = normalizeBbox(bbox);
    if (!b) return null;
    if (!isFiniteNum(width) || !isFiniteNum(height) || width <= 0 || height <= 0) return null;
    const x = (b.x * width) / BBOX_MAX;
    const y = (b.y * height) / BBOX_MAX;
    const w = (b.w * width) / BBOX_MAX;
    const h = (b.h * height) / BBOX_MAX;
    return { x: x, y: y, w: w, h: h, right: x + w, bottom: y + h };
  }

  /**
   * 行/段级锚点：只取左上角 (x, y) 换算成像素。
   * 这是批次 4 画连线端点应当使用的量。
   * @returns {{x:number,y:number}|null}
   */
  function bboxAnchorToPixels(bbox, width, height) {
    const px = bboxToPixels(bbox, width, height);
    return px ? { x: px.x, y: px.y } : null;
  }

  /**
   * 图片像素坐标 → 视口坐标（含当前缩放/平移）。批次 4 用它对齐连线端点。
   * @param {{x:number,y:number}|null} point 图片像素坐标
   * @param {object} metrics getImageMetrics() 的返回值
   * @returns {{x:number,y:number}|null}
   */
  function imagePointToViewport(point, metrics) {
    const m = metrics || getImageMetrics();
    if (!point || !m || !m.ready || !m.viewport) return null;
    if (!isFiniteNum(point.x) || !isFiniteNum(point.y)) return null;
    return {
      x: m.viewport.left + m.offsetX + point.x * m.scale,
      y: m.viewport.top + m.offsetY + point.y * m.scale,
    };
  }

  /** 逗号分隔的文本 → 逐句切分（保留终止符；换行也算断句） */
  function splitSentences(text) {
    const src = typeof text === 'string' ? text : '';
    const out = [];
    let buf = '';
    for (const ch of src) {
      buf += ch;
      if (
        ch === '。' ||
        ch === '！' ||
        ch === '？' ||
        ch === '；' ||
        ch === '\n' ||
        ch === '!' ||
        ch === '?' ||
        ch === ';'
      ) {
        out.push(buf);
        buf = '';
      }
    }
    if (buf) out.push(buf);
    return out;
  }

  function pushPlainSegments(out, raw) {
    splitSentences(raw).forEach(function (s) {
      out.push({ text: s, annotationIndex: null, revised: false, quote: '' });
    });
  }

  /**
   * 把一段文本切成渲染片段（纯函数）：
   *   - anchors 命中的区间 → 该片段带 annotationIndex（显示 revised_text，无则显示 quote 原文）
   *   - 其余文本按句切分为普通片段
   * 重叠批注保留先出现者（确定性），定位不到的批注被丢弃（由调用方计数）。
   *
   * @param {string} text
   * @param {Array<{index:number,quote:string,start?:number,revisedText?:string}>} anchors
   * @returns {Array<{text:string,annotationIndex:number|null,revised:boolean,quote:string}>}
   */
  function segmentParagraph(text, anchors) {
    const src = typeof text === 'string' ? text : '';
    if (!src) return [];
    const resolved = [];
    (Array.isArray(anchors) ? anchors : []).forEach(function (a) {
      if (!a || typeof a.quote !== 'string' || !a.quote) return;
      let from = null;
      let to = null;
      // 1) 显式字符偏移（且切片确实等于 quote）优先
      if (isFiniteNum(a.start) && isFiniteNum(a.end) && a.start >= 0 && a.end <= src.length && a.end > a.start) {
        if (src.slice(a.start, a.end) === a.quote) {
          from = a.start;
          to = a.end;
        }
      }
      // 2) 文本查找（V1 的文本锚定主路径）
      if (from === null) {
        const pos = src.indexOf(a.quote);
        if (pos !== -1) {
          from = pos;
          to = pos + a.quote.length;
        }
      }
      // 3) 去空白后再试一次（老数据 quote 可能带首尾空白）
      if (from === null) {
        const t = a.quote.trim();
        if (t) {
          const pos2 = src.indexOf(t);
          if (pos2 !== -1) {
            from = pos2;
            to = pos2 + t.length;
          }
        }
      }
      if (from === null) return;
      resolved.push({ from: from, to: to, index: a.index, quote: a.quote, revisedText: a.revisedText || '' });
    });

    resolved.sort(function (a, b) {
      return a.from - b.from || a.to - b.to;
    });

    const out = [];
    let cursor = 0;
    resolved.forEach(function (r) {
      if (r.from < cursor) return; // 与已渲染区间重叠 → 丢弃
      if (r.from > cursor) pushPlainSegments(out, src.slice(cursor, r.from));
      out.push({
        text: r.revisedText || r.quote,
        annotationIndex: r.index,
        revised: !!r.revisedText,
        quote: r.quote,
      });
      cursor = r.to;
    });
    if (cursor < src.length) pushPlainSegments(out, src.slice(cursor));
    return out;
  }

  /** 段落文本：兼容 V1（lines[].text）与 V0（text）两种转录形态 */
  function paragraphText(p) {
    if (!p || typeof p !== 'object') return '';
    if (typeof p.text === 'string' && p.text) return p.text;
    if (Array.isArray(p.lines)) {
      return p.lines
        .map(function (l) {
          return l && typeof l.text === 'string' ? l.text : '';
        })
        .join('');
    }
    return '';
  }

  /** 批注类型（change_type）；老数据走同一 `type` 键 */
  function annotationType(a) {
    return a && typeof a.type === 'string' && a.type ? a.type : null;
  }

  function typeClass(type) {
    return type && TYPE_CLASS[type] ? TYPE_CLASS[type] : null;
  }

  function sentClassName(annotation, revised) {
    const cls = ['sent'];
    const tc = typeClass(annotationType(annotation));
    cls.push(tc ? 'sent--' + tc : 'sent--unknown');
    if (annotation && typeof annotation.severity === 'string') cls.push('sent--severity-' + annotation.severity);
    if (revised) cls.push('sent--revised');
    return cls.join(' ');
  }

  /**
   * 把批注的锚点信息归一（兼容 V1 anchor.{paragraph_index,quote,start,end}
   * 与 V0 顶层 quote/original/paragraph_id/start/end）。
   * @returns {{paragraphIndex:number|null,quote:string,start:number|null,end:number|null}|null}
   */
  function resolveAnchor(a) {
    if (!a || typeof a !== 'object') return null;
    const an = a.anchor && typeof a.anchor === 'object' ? a.anchor : null;
    const quote = String((an && an.quote) || a.quote || a.original || '');
    if (!quote) return null;
    let paragraphIndex = null;
    if (an && isFiniteNum(an.paragraph_index)) paragraphIndex = an.paragraph_index;
    else if (isFiniteNum(a.paragraph_index)) paragraphIndex = a.paragraph_index;
    else if (isFiniteNum(a.paragraph_id)) paragraphIndex = a.paragraph_id;
    let start = null;
    let end = null;
    if (an && isFiniteNum(an.start)) start = an.start;
    else if (isFiniteNum(a.start)) start = a.start;
    if (an && isFiniteNum(an.end)) end = an.end;
    else if (isFiniteNum(a.end)) end = a.end;
    return { paragraphIndex: paragraphIndex, quote: quote, start: start, end: end };
  }

  /** 总分：后端各路径落库位置不一，逐个候选取第一个数值，取不到 → null */
  function resolveScore(data) {
    const m = data && data.meta;
    const candidates = [
      m && m.scores && m.scores.total,
      data && data.scores && data.scores.total,
      data && data.overall_score,
      data && data.total_score,
      data && data.score,
    ];
    for (const c of candidates) {
      if (isFiniteNum(c)) return c;
    }
    return null;
  }

  /** 总评：V0 落 meta.summary；其余候选兜底；取不到 → ''（绝不编造文案） */
  function resolveComment(data) {
    const m = data && data.meta;
    const candidates = [m && m.summary, data && data.summary, data && data.comment, m && m.comment];
    for (const c of candidates) {
      if (typeof c === 'string' && c.trim()) return c;
    }
    return '';
  }

  /** 学科：只认 chinese/english，未知 → null（不硬编成语文） */
  function resolveSubject(data) {
    const s = (data && (data.subject || (data.meta && data.meta.subject))) || '';
    return s === 'english' ? 'english' : s === 'chinese' ? 'chinese' : null;
  }

  function typeLabel(type, subject) {
    const map = TYPE_LABEL[subject] || TYPE_LABEL.chinese;
    if (!type) return '批注';
    return map[type] || type;
  }

  /* ══════════════════════════════════════════════════════════════════════
   * 渲染区
   * ══════════════════════════════════════════════════════════════════════ */

  function setState(name, ctx) {
    return machine.set(name, ctx);
  }

  function renderState(name, ctx) {
    ctx = ctx || {};
    if (name === 'error' && els.errorCopy) {
      els.errorCopy.textContent = ctx.message || '报告加载失败，请稍后重试。';
    }
    if (name === 'loading' && els.loadingTitle) {
      els.loadingTitle.textContent = ctx.title || '正在加载报告…';
    }
  }

  /**
   * Markdown → DOM（合规路径，全程不碰 innerHTML / insertAdjacentHTML）。
   * @returns {boolean} true = Markdown 已渲染；false = 降级为纯文本（并已标注）
   */
  function renderMarkdown(target, md) {
    if (!target) return false;
    const text = String(md == null ? '' : md).trim();
    target.textContent = '';
    delete target.dataset.markdown;
    if (!text) {
      target.appendChild(global.AIUI.el('p', 'form-hint', '本次报告未包含总体评语。'));
      return false;
    }
    const markedLib = global.marked;
    const purifyLib = global.DOMPurify;
    if (!markedLib || typeof markedLib.parse !== 'function' || !purifyLib || typeof purifyLib.sanitize !== 'function') {
      renderPlainText(target, text);
      return false;
    }
    let html;
    try {
      html = purifyLib.sanitize(markedLib.parse(text), { USE_PROFILES: { html: true } });
    } catch (e) {
      renderPlainText(target, text);
      return false;
    }
    const parsed = new global.DOMParser().parseFromString(String(html), 'text/html');
    const body = parsed && parsed.body;
    const nodes = body ? Array.prototype.slice.call(body.childNodes) : [];
    nodes.forEach(function (node) {
      target.appendChild(global.document.importNode(node, true));
    });
    return true;
  }

  /** 降级渲染：纯文本 + 空行分段，并显式标注「Markdown 未渲染」 */
  function renderPlainText(target, text) {
    target.textContent = '';
    target.dataset.markdown = 'plain';
    const blocks = String(text).split(/\n{2,}/);
    blocks.forEach(function (block) {
      const t = block.trim();
      if (!t) return;
      target.appendChild(global.AIUI.el('p', null, t));
    });
    target.appendChild(global.AIUI.el('p', 'form-hint markdown-fallback', 'Markdown 未渲染（当前按纯文本显示）。'));
  }

  /**
   * 渲染右栏「AI 修改后的文本」：按段落排版，句子以 <span class="sent"> 包裹，
   * 按 change_type 着色（class，非内联 style）。
   * @returns {number} 未能在文本中定位的批注条数
   */
  function renderRevisedText(container, transcript, annotations) {
    if (!container) return 0;
    container.textContent = '';
    const list = Array.isArray(annotations) ? annotations : [];
    const tp = transcript && Array.isArray(transcript.paragraphs) ? transcript.paragraphs : [];

    const paras = tp.map(function (p, i) {
      return { key: p && isFiniteNum(p.paragraph_index) ? p.paragraph_index : i, text: paragraphText(p) };
    });

    const byKey = new Map();
    paras.forEach(function (p) {
      byKey.set(p.key, []);
    });
    list.forEach(function (a, ai) {
      const r = resolveAnchor(a);
      if (!r) return;
      const entry = {
        index: ai,
        quote: r.quote,
        start: r.start,
        end: r.end,
        revisedText: a && typeof a.revised_text === 'string' ? a.revised_text : '',
      };
      let key = null;
      if (r.paragraphIndex !== null && byKey.has(r.paragraphIndex)) key = r.paragraphIndex;
      if (key === null) {
        for (const p of paras) {
          if (p.text && p.text.indexOf(r.quote) !== -1) {
            key = p.key;
            break;
          }
        }
      }
      if (key === null) return;
      byKey.get(key).push(entry);
    });

    const used = new Set();
    paras.forEach(function (p) {
      if (!p.text) return;
      const segs = segmentParagraph(p.text, byKey.get(p.key) || []);
      const para = global.AIUI.el('div', 'para');
      para.setAttribute('data-paragraph-index', String(p.key));
      segs.forEach(function (s) {
        if (s.annotationIndex === null) {
          para.appendChild(global.AIUI.el('span', 'sent', s.text));
          return;
        }
        const annotation = list[s.annotationIndex];
        const span = global.AIUI.el('span', sentClassName(annotation, s.revised), s.text);
        span.setAttribute('data-annotation-index', String(s.annotationIndex));
        const type = annotationType(annotation);
        if (type) span.setAttribute('data-change-type', type);
        if (annotation && typeof annotation.severity === 'string')
          span.setAttribute('data-severity', annotation.severity);
        if (type) {
          span.setAttribute('data-type-label', typeLabel(type, state.subject));
        }
        para.appendChild(span);
        used.add(s.annotationIndex);
      });
      container.appendChild(para);
    });

    return list.length - used.size;
  }

  function buildMetaLine(data, score, subject) {
    const parts = ['作文批改报告'];
    const created = String((data && (data.created_at || data.graded_at)) || '').slice(0, 10);
    if (created) parts.push(created);
    const grade = (data && (data.grade || data.exam_level)) || '';
    if (grade) parts.push(String(grade));
    if (state.annotations.length) parts.push(state.annotations.length + ' 条批注');
    if (state.unanchored > 0) parts.push(state.unanchored + ' 条批注未能在文本中定位');
    if (score === null) parts.push('本次报告未包含总分');
    if (subject) parts.push('学科：' + SUBJECT_LABEL[subject]);
    return parts.join(' · ');
  }

  function updateSubjectCaption() {
    if (!els.subjectCaption) return;
    if (!state.subjectKnown) {
      els.subjectCaption.textContent =
        '学科未知（报告未标注），当前按' + SUBJECT_LABEL[state.subject] + '显示批注标签。';
      return;
    }
    els.subjectCaption.textContent =
      '学科：' + SUBJECT_LABEL[state.subject] + '（切换只改变批注标签的显示名；报告内容来自本次批改，不会重新批改）。';
  }

  /** 应用当前缩放/平移（内联 transform 由 JS 写，页面 HTML 无内联 style） */
  function applyTransform() {
    if (!els.image) return;
    els.image.style.transformOrigin = '0 0';
    els.image.style.transform = 'translate(' + view.tx + 'px,' + view.ty + 'px) scale(' + view.scale + ')';
    notifyLayout();
  }

  function resetView() {
    view.scale = 1;
    view.tx = 0;
    view.ty = 0;
    applyTransform();
  }

  function notifyLayout() {
    const metrics = getImageMetrics();
    layoutListeners.forEach(function (cb) {
      try {
        cb(metrics);
      } catch (e) {
        /* 监听者异常不得影响页面；批次 4 自行处理 */
      }
    });
  }

  function notifyImageReady() {
    const metrics = getImageMetrics();
    imageReadyListeners.forEach(function (cb) {
      try {
        cb(metrics);
      } catch (e) {
        /* 同上 */
      }
    });
  }

  function onImageLoad() {
    const img = els.image;
    if (!img) return;
    state.imageReady = true;
    state.naturalWidth = img.naturalWidth || 0;
    state.naturalHeight = img.naturalHeight || 0;
    if (els.placeholder) els.placeholder.hidden = true;
    img.hidden = false;
    applyTransform();
    notifyImageReady();
  }

  function onImageError() {
    state.imageReady = false;
    state.naturalWidth = 0;
    state.naturalHeight = 0;
    if (els.placeholder) {
      els.placeholder.hidden = false;
      els.placeholder.textContent = '作文原图加载失败（报告仍可阅读）。';
    }
    notifyLayout();
  }

  /**
   * 挂载原图。**坐标计算以 onload 为准** —— 批次 4 依赖 naturalWidth/Height，
   * 在此之前 getImageMetrics().ready 恒为 false。
   */
  function setImage(url) {
    const img = els.image;
    if (!img) return;
    if (!url) {
      state.imageReady = false;
      img.hidden = true;
      if (img.getAttribute('src')) img.removeAttribute('src');
      if (els.placeholder) {
        els.placeholder.hidden = false;
        els.placeholder.textContent = '本次报告未包含作文原图。';
      }
      notifyLayout();
      return;
    }
    img.hidden = false;
    if (els.placeholder) els.placeholder.hidden = true;
    // 用属性赋值（而非 addEventListener）：重复渲染时不会被叠加成多个监听器
    img.onload = onImageLoad;
    img.onerror = onImageError;
    img.src = url; // 相对路径由浏览器按页面 origin 解析；不直接 fetch
    // 缓存命中时 load 可能已错过 → 主动补一次
    if (img.complete && img.naturalWidth > 0) onImageLoad();
  }

  function renderReport(data) {
    state.report = data || null;
    state.annotations = data && Array.isArray(data.annotations) ? data.annotations : [];
    state.transcript = (data && data.transcript) || null;

    const title = (data && (data.essay_title || data.title)) || '作文批改报告';
    if (els.title) els.title.textContent = title;
    global.document.title = title + ' · 智启AI导师';

    const score = resolveScore(data);
    if (els.scoreBadge) {
      if (score === null) {
        els.scoreBadge.hidden = true;
        els.scoreBadge.textContent = '';
      } else {
        els.scoreBadge.hidden = false;
        els.scoreBadge.textContent = score + ' 分';
      }
    }

    const subject = resolveSubject(data);
    state.subjectKnown = !!subject;
    state.subject = subject || 'chinese';
    if (els.subjectSelect) els.subjectSelect.value = state.subject;

    const comment = resolveComment(data);
    renderMarkdown(els.summaryLeft, comment);
    renderMarkdown(els.summaryRight, comment);

    state.unanchored = renderRevisedText(els.revisedText, state.transcript, state.annotations);
    if (els.textEmpty) els.textEmpty.hidden = !!(els.revisedText && els.revisedText.childNodes.length > 0);

    updateSubjectCaption();
    if (els.meta) els.meta.textContent = buildMetaLine(data, score, subject);

    setImage((data && (data.image_url || (data.meta && data.meta.image_url))) || '');

    setState('success');
    notifyLayout();
    return state;
  }

  /* ══════════════════════════════════════════════════════════════════════
   * 缩放 / 平移（纯 JS，无库）
   * ══════════════════════════════════════════════════════════════════════ */

  function onWheel(e) {
    if (!state.imageReady) return;
    if (typeof e.preventDefault === 'function') e.preventDefault();
    const rect = els.canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    const next = clamp(view.scale * factor, MIN_SCALE, MAX_SCALE);
    const k = next / view.scale;
    view.tx = cx - k * (cx - view.tx);
    view.ty = cy - k * (cy - view.ty);
    view.scale = next;
    applyTransform();
  }

  function onPointerDown(e) {
    if (!state.imageReady) return;
    dragging = { x: e.clientX, y: e.clientY, tx: view.tx, ty: view.ty };
    if (els.canvas.setPointerCapture) {
      try {
        els.canvas.setPointerCapture(e.pointerId);
      } catch (err) {
        /* jsdom / 旧浏览器不支持 → 忽略 */
      }
    }
  }

  function onPointerMove(e) {
    if (!dragging) return;
    view.tx = dragging.tx + (e.clientX - dragging.x);
    view.ty = dragging.ty + (e.clientY - dragging.y);
    applyTransform();
  }

  function onPointerUp(e) {
    if (!dragging) return;
    dragging = null;
    if (els.canvas.releasePointerCapture) {
      try {
        els.canvas.releasePointerCapture(e.pointerId);
      } catch (err) {
        /* 同上 */
      }
    }
  }

  function onKeyDown(e) {
    if (!state.imageReady) return;
    const step = 40;
    let handled = true;
    if (e.key === 'ArrowLeft') view.tx -= step;
    else if (e.key === 'ArrowRight') view.tx += step;
    else if (e.key === 'ArrowUp') view.ty -= step;
    else if (e.key === 'ArrowDown') view.ty += step;
    else if (e.key === '+' || e.key === '=') view.scale = clamp(view.scale * 1.1, MIN_SCALE, MAX_SCALE);
    else if (e.key === '-' || e.key === '_') view.scale = clamp(view.scale / 1.1, MIN_SCALE, MAX_SCALE);
    else if (e.key === '0') {
      resetView();
      return;
    } else handled = false;
    if (handled) {
      if (typeof e.preventDefault === 'function') e.preventDefault();
      applyTransform();
    }
  }

  /* ══════════════════════════════════════════════════════════════════════
   * 批次 4 只读接口（本批不实现连线/气泡）
   * ══════════════════════════════════════════════════════════════════════ */

  /** 当前图片度量：未 onload 前 ready=false，坐标调用方须据此判空 */
  function getImageMetrics() {
    const rect = els.canvas && els.canvas.getBoundingClientRect ? els.canvas.getBoundingClientRect() : null;
    return {
      ready: state.imageReady,
      naturalWidth: state.naturalWidth,
      naturalHeight: state.naturalHeight,
      scale: view.scale,
      offsetX: view.tx,
      offsetY: view.ty,
      viewport: rect ? { left: rect.left, top: rect.top, width: rect.width, height: rect.height } : null,
    };
  }

  /** 已渲染的"被批注句子"元素（含 annotationIndex），供批次 4 画连线起点 */
  function getSentenceElements() {
    if (!els.revisedText) return [];
    const nodes = els.revisedText.querySelectorAll('[data-annotation-index]');
    return Array.prototype.map.call(nodes, function (node) {
      return {
        annotationIndex: Number(node.getAttribute('data-annotation-index')),
        element: node,
        type: node.getAttribute('data-change-type') || null,
        severity: node.getAttribute('data-severity') || null,
      };
    });
  }

  /**
   * 批注锚点（只读）。anchor = 行/段级端点（左上角像素）；
   * estimate = w/h 的粗粒度换算（h 偏大 / w 偏窄，**不得**用于精确高亮）。
   */
  function getAnchors() {
    const m = getImageMetrics();
    const out = [];
    state.annotations.forEach(function (a, i) {
      const b = normalizeBbox(a && a.bbox);
      if (!b) return;
      const px = m.ready ? bboxToPixels(b, m.naturalWidth, m.naturalHeight) : null;
      out.push({
        annotationIndex: i,
        type: annotationType(a),
        severity: (a && a.severity) || null,
        knowledgePoints: (a && a.knowledge_points) || [],
        bbox: b,
        anchor: px ? { x: px.x, y: px.y } : null,
        estimate: px,
        viewport: px ? imagePointToViewport({ x: px.x, y: px.y }, m) : null,
      });
    });
    return out;
  }

  function getAnnotations() {
    return state.annotations.slice();
  }

  function getReport() {
    return state.report;
  }

  /** 布局/缩放变化订阅（返回取消函数）；批次 4 借此重画连线 */
  function onLayoutChange(cb) {
    if (typeof cb !== 'function') return function () {};
    layoutListeners.push(cb);
    return function unsubscribe() {
      const i = layoutListeners.indexOf(cb);
      if (i !== -1) layoutListeners.splice(i, 1);
    };
  }

  /** 原图 onload 订阅：批次 4 只能在此之后做坐标换算 */
  function onImageReady(cb) {
    if (typeof cb !== 'function') return function () {};
    if (state.imageReady) {
      cb(getImageMetrics());
      return function () {};
    }
    imageReadyListeners.push(cb);
    return function unsubscribe() {
      const i = imageReadyListeners.indexOf(cb);
      if (i !== -1) imageReadyListeners.splice(i, 1);
    };
  }

  /* ══════════════════════════════════════════════════════════════════════
   * 生命周期
   * ══════════════════════════════════════════════════════════════════════ */

  function getReportId() {
    let search = '';
    try {
      search = global.location && global.location.search ? global.location.search : '';
    } catch (e) {
      search = '';
    }
    const params = new global.URLSearchParams(search);
    return params.get('id') || params.get('reviewId') || '';
  }

  /** 第 attempt 次重试前的等待毫秒 (attempt 从 0 起; 指数退避, 封顶 POLL.maxMs) */
  function pollDelay(attempt) {
    return Math.min(POLL.baseMs * Math.pow(POLL.factor, Math.max(0, attempt)), POLL.maxMs);
  }

  function clearPoll() {
    if (pollTimer !== null && typeof global.clearTimeout === 'function') global.clearTimeout(pollTimer);
    pollTimer = null;
  }

  function fetchReport(id) {
    return global.AIAPI.request('/api/essay/report/' + encodeURIComponent(id), { method: 'POST' });
  }

  /**
   * 等到 delay 后重试。opts.scheduler 用于单测注入 (不真等定时器)。
   */
  function waitAndRetry(id, attempt, scheduler) {
    const ms = pollDelay(attempt);
    return new Promise(function (resolve) {
      const run = function () {
        resolve(pollUntilDone(id, attempt + 1, scheduler));
      };
      if (typeof scheduler === 'function') {
        scheduler(run, ms);
        return;
      }
      pollTimer = global.setTimeout(run, ms);
    });
  }

  /**
   * 取一次报告并决定: 渲染 / 继续轮询 / 报错。
   * status 只有 'pending' 才继续等; 其余 (含老数据没有 status 字段) 一律按完成渲染。
   */
  function pollUntilDone(id, attempt, scheduler) {
    return fetchReport(id)
      .then(function (data) {
        if (!data) return setState('empty');
        if (data.status === 'pending') {
          if (attempt + 1 >= POLL.maxAttempts) {
            // 有明确终点: 不无限轮询, 也不假装成功
            return setState('error', { message: 'AI 仍在批改中，请稍后刷新页面查看。' });
          }
          setState('loading', { title: 'AI 正在批改中…' });
          return waitAndRetry(id, attempt, scheduler);
        }
        if (data.status === 'failed') {
          return setState('error', { message: '本次批改未能完成，请重新提交作文。' });
        }
        renderReport(data);
        return 'success';
      })
      .catch(function (err) {
        const mapped = global.AIUI.mapError(err);
        if (mapped !== 'error') return setState(mapped);
        return setState('error', { message: (err && err.message) || '报告加载失败' });
      });
  }

  /**
   * @param {object} [opts] opts.scheduler: (fn, ms) => void, 供单测驱动轮询
   */
  function load(opts) {
    const options = opts || {};
    clearPoll(); // 重试/重复加载时不叠加上一轮的定时器
    if (global.navigator && global.navigator.onLine === false) return Promise.resolve(setState('offline'));
    const id = getReportId();
    if (!id) return Promise.resolve(setState('empty'));
    if (!global.AIAPI.getToken()) return Promise.resolve(setState('auth'));
    setState('loading', { title: '正在加载报告…' });
    return pollUntilDone(id, 0, options.scheduler);
  }

  function bindEvents() {
    if (els.subjectSelect) {
      els.subjectSelect.addEventListener('change', function () {
        state.subject = els.subjectSelect.value === 'english' ? 'english' : 'chinese';
        updateSubjectCaption();
        // 标签文案随学科变化 → 重渲染文本（数据不变）
        state.unanchored = renderRevisedText(els.revisedText, state.transcript, state.annotations);
        notifyLayout();
      });
    }
    if (els.zoomReset) els.zoomReset.addEventListener('click', resetView);
    if (els.canvas) {
      els.canvas.addEventListener('wheel', onWheel, { passive: false });
      els.canvas.addEventListener('pointerdown', onPointerDown);
      els.canvas.addEventListener('pointermove', onPointerMove);
      els.canvas.addEventListener('pointerup', onPointerUp);
      els.canvas.addEventListener('pointercancel', onPointerUp);
      els.canvas.addEventListener('keydown', onKeyDown);
    }
    if (els.retryBtn)
      els.retryBtn.addEventListener('click', function () {
        load();
      });
    if (els.offlineRetryBtn)
      els.offlineRetryBtn.addEventListener('click', function () {
        load();
      });
    if (global.addEventListener) global.addEventListener('resize', notifyLayout);
  }

  function boot() {
    els.region = $('state-region');
    els.title = $('essay-title');
    els.scoreBadge = $('score-badge');
    els.subjectSelect = $('subject-select');
    els.subjectCaption = $('subject-caption');
    els.meta = $('report-meta');
    els.summaryLeft = $('summary-left');
    els.summaryRight = $('summary-right');
    els.revisedText = $('revised-text');
    els.textEmpty = $('text-empty');
    els.canvas = $('essay-canvas');
    els.image = $('essay-image');
    els.placeholder = $('image-placeholder');
    els.zoomReset = $('zoom-reset');
    els.errorCopy = $('error-copy');
    els.loadingTitle = $('loading-title');
    els.retryBtn = $('retry-btn');
    els.offlineRetryBtn = $('offline-retry-btn');
    els.loginLink = $('login-link');
    els.backLink = $('back-link');

    if (!els.region) return; // 非本页（或被裁剪的 DOM）→ 不启动

    machine = global.AIUI.createStateMachine(els.region, STATES, { render: renderState });

    const id = getReportId();
    if (els.loginLink) {
      const next = 'essay-review.html' + (id ? '?id=' + encodeURIComponent(id) : '');
      els.loginLink.href = '/login.html?next=' + encodeURIComponent(next);
    }
    if (els.backLink) els.backLink.href = '/essay.html';

    bindEvents();
    load();
  }

  global.EssayReview = {
    STATES: STATES,
    TYPE_CLASS: TYPE_CLASS,

    // 纯函数（单测直接调用）
    normalizeBbox: normalizeBbox,
    bboxToPixels: bboxToPixels,
    bboxAnchorToPixels: bboxAnchorToPixels,
    imagePointToViewport: imagePointToViewport,
    splitSentences: splitSentences,
    segmentParagraph: segmentParagraph,
    paragraphText: paragraphText,
    resolveAnchor: resolveAnchor,
    pollDelay: pollDelay,
    annotationType: annotationType,
    resolveScore: resolveScore,
    resolveComment: resolveComment,
    resolveSubject: resolveSubject,
    getReportId: getReportId,
    POLL: POLL,

    // 渲染（单测直接调用）
    renderReport: renderReport,
    renderMarkdown: renderMarkdown,
    renderPlainText: renderPlainText,
    renderRevisedText: renderRevisedText,
    renderState: renderState,
    setImage: setImage,

    // 批次 4 只读访问器
    getImageMetrics: getImageMetrics,
    getSentenceElements: getSentenceElements,
    getAnchors: getAnchors,
    getAnnotations: getAnnotations,
    getReport: getReport,
    onLayoutChange: onLayoutChange,
    onImageReady: onImageReady,

    // 生命周期 / 测试辅助
    load: load,
    resetView: resetView,
    setState: setState,
    getState: function () {
      return machine ? machine.get() : null;
    },
    getSubject: function () {
      return state.subject;
    },
    getUnanchoredCount: function () {
      return state.unanchored;
    },
  };

  if (global.document.readyState === 'loading') {
    global.document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window);
