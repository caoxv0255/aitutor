/* ==========================================================================
 * 作文智能批改 · 批次 4 · 解析气泡 / 移动端抽屉（essay-bubble.js）
 *
 * 页面：/v2/essay-review.html?id=<report_id>
 * 触发：essay-connector.js 的 onActivate(payload) —— 点连线中点按钮（桌面）
 *       或点侧边标记（<768px）后，由本模块给出解析。
 *
 * ── 内容来源 ────────────────────────────────────────────────────────────
 *   正文 = 批注的解析文字。契约里这一字段是 `comment`（批次 2 扩展键只有
 *   revised_text / severity / knowledge_points / bbox，并无 explanation）——
 *   这里优先取 `explanation`（若将来新增该键），否则取 `comment`。
 *   标签 = change_type 显示名（沿用批次 3 写在句元素上的 data-type-label）
 *         + knowledge_points 列表。
 *
 * ── Markdown 合规渲染 ───────────────────────────────────────────────────
 *   正文是 LLM 产出（不可信输入），必须走 Markdown → HTML → 消毒 → DOM 挂载。
 *   复用批次 3 已实现的 EssayReview.renderMarkdown（DOMPurify.sanitize(marked.parse)
 *   → DOMParser → importNode + appendChild，全程不碰 innerHTML），不另造一套。
 *
 * ── 定位 ────────────────────────────────────────────────────────────────
 *   positionAt() 为纯函数：默认放锚点上方，空间不足翻到下方，四边按 12px 边距
 *   收敛，气泡比视口还宽/高时退化为贴边距 —— 保证绝不溢出视口。
 *   元素用 position: fixed（相对视口绝对定位），随 scroll/resize 重算。
 *   同屏只允许一个气泡；再点同一按钮切换关闭。
 * ========================================================================== */
/* global window, document */
(function (global) {
  'use strict';

  const MARGIN = 12;
  const GAP = 14;

  let current = null; // { kind:'bubble'|'drawer', annotationIndex, el, backdrop, anchor }
  let outsideArmed = false;
  let keyBound = false;
  let closeUnsub = null;

  function isFiniteNum(v) {
    return typeof v === 'number' && Number.isFinite(v);
  }

  function mk(tag, className, text) {
    const ui = global.AIUI;
    if (ui && typeof ui.el === 'function') return ui.el(tag, className, text);
    const node = global.document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  /* ══════════════════════════════════════════════════════════════════════
   * 纯函数区（无 DOM 依赖 —— 单测直接调用）
   * ══════════════════════════════════════════════════════════════════════ */

  /**
   * 计算气泡左上角，保证不溢出视口。
   * @param {{x:number,y:number}} anchor  锚点（视口坐标，通常是被点按钮的中心）
   * @param {{width:number,height:number}} size 气泡尺寸
   * @param {{width:number,height:number}} viewport 视口尺寸
   * @returns {{left:number,top:number,placement:'top'|'bottom'}}
   */
  function positionAt(anchor, size, viewport) {
    const vw = viewport && isFiniteNum(viewport.width) ? viewport.width : 0;
    const vh = viewport && isFiniteNum(viewport.height) ? viewport.height : 0;
    const w = size && isFiniteNum(size.width) ? size.width : 0;
    const h = size && isFiniteNum(size.height) ? size.height : 0;
    const ax = anchor && isFiniteNum(anchor.x) ? anchor.x : 0;
    const ay = anchor && isFiniteNum(anchor.y) ? anchor.y : 0;

    let placement = 'top';
    let top = ay - GAP - h;
    if (top < MARGIN) {
      placement = 'bottom';
      top = ay + GAP;
    }
    const maxTop = Math.max(MARGIN, vh - MARGIN - h);
    if (top > maxTop) top = maxTop;
    if (top < MARGIN) top = MARGIN;

    let left = ax - w / 2;
    const maxLeft = Math.max(MARGIN, vw - MARGIN - w);
    if (left > maxLeft) left = maxLeft;
    if (left < MARGIN) left = MARGIN;

    return { left: left, top: top, placement: placement };
  }

  /** 解析正文：优先 explanation，其次 comment（契约实际字段）；都没有 → '' */
  function resolveText(annotation) {
    if (!annotation) return '';
    if (typeof annotation.explanation === 'string' && annotation.explanation.trim()) return annotation.explanation;
    if (typeof annotation.comment === 'string') return annotation.comment;
    return '';
  }

  /** 知识点标签列表：只接受非空字符串，去首尾空白 */
  function resolveKnowledgePoints(annotation) {
    const kp = annotation && annotation.knowledge_points;
    if (!Array.isArray(kp)) return [];
    return kp
      .filter(function (k) {
        return typeof k === 'string' && k.trim();
      })
      .map(function (k) {
        return k.trim();
      });
  }

  /* ══════════════════════════════════════════════════════════════════════
   * 内容构建
   * ══════════════════════════════════════════════════════════════════════ */

  function reviewAnnotations() {
    const review = global.EssayReview;
    if (review && typeof review.getAnnotations === 'function') return review.getAnnotations();
    return [];
  }

  function sentenceElementFor(annotationIndex) {
    const review = global.EssayReview;
    if (!review || typeof review.getSentenceElements !== 'function') return null;
    const list = review.getSentenceElements();
    for (let i = 0; i < list.length; i += 1) {
      if (list[i] && list[i].annotationIndex === annotationIndex) return list[i].element;
    }
    return null;
  }

  function typeLabelFor(annotationIndex, annotation) {
    const sent = sentenceElementFor(annotationIndex);
    const label = sent && sent.getAttribute ? sent.getAttribute('data-type-label') : null;
    if (label) return label;
    if (annotation && typeof annotation.type === 'string' && annotation.type) return annotation.type;
    return '批注';
  }

  /** Markdown → DOM：复用 EssayReview.renderMarkdown（合规路径）；缺失则纯文本降级 */
  function renderMarkdownInto(target, text) {
    target.textContent = '';
    const src = String(text == null ? '' : text).trim();
    if (!src) {
      target.appendChild(mk('p', 'essay-bubble__empty', '本次批注未包含解析文字。'));
      return false;
    }
    const review = global.EssayReview;
    if (review && typeof review.renderMarkdown === 'function') return review.renderMarkdown(target, src);
    const p = mk('p', null, src);
    target.appendChild(p);
    return false;
  }

  function buildTags(annotation) {
    const kps = resolveKnowledgePoints(annotation);
    if (!kps.length) return null;
    const ul = mk('ul', 'essay-bubble__tags');
    ul.setAttribute('aria-label', '涉及知识点');
    kps.forEach(function (k) {
      ul.appendChild(mk('li', 'bubble-tag', k));
    });
    return ul;
  }

  /** 把「类型标签 + 正文 + 知识点」填进容器（气泡与抽屉共用） */
  function fillContent(container, annotationIndex) {
    const list = reviewAnnotations();
    const annotation = list[annotationIndex] || null;

    const head = mk('div', 'essay-bubble__head');
    head.appendChild(mk('span', 'essay-bubble__type', String(typeLabelFor(annotationIndex, annotation))));
    const closeBtn = mk('button', 'essay-bubble__close', '关闭');
    closeBtn.type = 'button';
    closeBtn.addEventListener('click', close);
    head.appendChild(closeBtn);

    const body = mk('div', 'essay-bubble__body');
    renderMarkdownInto(body, resolveText(annotation));

    container.appendChild(head);
    container.appendChild(body);
    const tags = buildTags(annotation);
    if (tags) container.appendChild(tags);
    return container;
  }

  /* ══════════════════════════════════════════════════════════════════════
   * 打开 / 定位 / 关闭
   * ══════════════════════════════════════════════════════════════════════ */

  function viewportSize() {
    return { width: global.innerWidth || 0, height: global.innerHeight || 0 };
  }

  function place(el, anchorPoint) {
    const vp = viewportSize();
    if (!vp.width || !vp.height) return;
    const anchor = anchorPoint || { x: vp.width / 2, y: vp.height / 2 };
    const pos = positionAt(anchor, { width: el.offsetWidth || 0, height: el.offsetHeight || 0 }, vp);
    el.style.left = pos.left + 'px';
    el.style.top = pos.top + 'px';
    el.setAttribute('data-placement', pos.placement);
  }

  function reposition() {
    if (!current || current.kind !== 'bubble') return;
    place(current.el, current.anchor);
  }

  function close() {
    if (!current) return false;
    const el = current.el;
    const backdrop = current.backdrop;
    if (el && el.parentNode) el.parentNode.removeChild(el);
    if (backdrop && backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
    current = null;
    disarmOutsideClose();
    if (global.removeEventListener) {
      global.removeEventListener('scroll', reposition);
      global.removeEventListener('resize', reposition);
    }
    return true;
  }

  function armOutsideClose() {
    if (outsideArmed) return;
    outsideArmed = true;
    // 延后一帧：避免"打开气泡的这一次点击"立刻被自己关掉
    global.setTimeout(function () {
      if (!current) {
        outsideArmed = false;
        return;
      }
      global.document.addEventListener('click', onDocumentClick);
    }, 0);
  }

  function disarmOutsideClose() {
    if (!outsideArmed) return;
    outsideArmed = false;
    global.document.removeEventListener('click', onDocumentClick);
  }

  function onDocumentClick(event) {
    if (!current) return;
    const target = event && event.target;
    if (current.el && target && current.el.contains(target)) return;
    if (current.backdrop && target === current.backdrop) return; // 遮罩有自己的处理
    close();
  }

  function onKeyDown(event) {
    if (event && event.key === 'Escape') close();
  }

  /**
   * 打开解析气泡（桌面）。同一按钮再点一次 → 关闭。
   * @param {number} annotationIndex
   * @param {{x:number,y:number}|null} anchorPoint 锚点视口坐标（按钮中心）
   * @returns {Element|null}
   */
  function open(annotationIndex, anchorPoint) {
    const idx = Number(annotationIndex);
    if (!Number.isFinite(idx)) return null;
    if (current && current.kind === 'bubble' && current.annotationIndex === idx) {
      close();
      return null;
    }
    close();

    const el = mk('div', 'essay-bubble');
    el.setAttribute('data-annotation-index', String(idx));
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', '第 ' + (idx + 1) + ' 条批注解析');
    fillContent(el, idx);
    el.style.visibility = 'hidden';
    global.document.body.appendChild(el);
    place(el, anchorPoint);
    el.style.visibility = '';

    current = { kind: 'bubble', annotationIndex: idx, el: el, backdrop: null, anchor: anchorPoint || null };
    if (global.addEventListener) {
      global.addEventListener('scroll', reposition, { passive: true });
      global.addEventListener('resize', reposition);
    }
    armOutsideClose();
    return el;
  }

  /**
   * 打开移动端底部抽屉（<768px 的替代形态）。再次点同一标记 → 关闭。
   * @returns {Element|null}
   */
  function openDrawer(annotationIndex) {
    const idx = Number(annotationIndex);
    if (!Number.isFinite(idx)) return null;
    if (current && current.kind === 'drawer' && current.annotationIndex === idx) {
      close();
      return null;
    }
    close();

    const backdrop = mk('div', 'essay-drawer-backdrop');
    const el = mk('aside', 'essay-drawer');
    el.setAttribute('data-annotation-index', String(idx));
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', '第 ' + (idx + 1) + ' 条批注解析');
    fillContent(el, idx);
    backdrop.addEventListener('click', close);

    global.document.body.appendChild(backdrop);
    global.document.body.appendChild(el);
    current = { kind: 'drawer', annotationIndex: idx, el: el, backdrop: backdrop, anchor: null };
    armOutsideClose();
    return el;
  }

  /** 连线层 onActivate 的订阅者：按 payload.mode 决定气泡或抽屉 */
  function handleActivate(payload) {
    if (!payload || !Number.isFinite(payload.annotationIndex)) return null;
    if (payload.mode === 'drawer') return openDrawer(payload.annotationIndex);
    return open(payload.annotationIndex, payload.viewport);
  }

  function init() {
    if (!keyBound) {
      keyBound = true;
      global.document.addEventListener('keydown', onKeyDown);
    }
    const connector = global.EssayConnector;
    if (!closeUnsub && connector && typeof connector.onActivate === 'function') {
      closeUnsub = connector.onActivate(handleActivate);
    }
    return true;
  }

  function destroy() {
    close();
    if (closeUnsub) {
      try {
        closeUnsub();
      } catch (e) {
        /* 忽略 */
      }
      closeUnsub = null;
    }
    if (keyBound) {
      keyBound = false;
      global.document.removeEventListener('keydown', onKeyDown);
    }
  }

  global.EssayBubble = {
    // 纯函数（单测直接调用）
    positionAt: positionAt,
    resolveText: resolveText,
    resolveKnowledgePoints: resolveKnowledgePoints,

    // 生命周期
    init: init,
    destroy: destroy,
    handleActivate: handleActivate,
    open: open,
    openDrawer: openDrawer,
    close: close,
    isOpen: function () {
      return !!current;
    },
    getCurrentIndex: function () {
      return current ? current.annotationIndex : null;
    },
    getCurrentKind: function () {
      return current ? current.kind : null;
    },
  };

  if (global.document.readyState === 'loading') {
    global.document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
