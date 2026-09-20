/* ============================================================================
 * essay-annotation-card.js — D086 §12 L4 V1.0 · 旁注卡片渲染引擎
 *
 * 职责: 把 annotations 渲染为右侧"旁注卡片流", 支持与 EssaySourceView 双向联动.
 *
 * 设计原则:
 *   - 全部走 Design Token v1 语义色 (5 类 type 对应 5 种背景)
 *   - 卡片按 anchor.paragraph_index 顺序排列, 段内按 start 顺序
 *   - setActive(id) 切高亮边框, 不重渲染
 *   - 点击卡片 → onAnchorClick(id) → EssaySourceView.setActive + scrollIntoView
 *   - 渲染 anchor_failed 批注为"段末降级"样式 (虚线边框 + 浅色背景)
 *
 * 配套 CSS: assets/css/essay.css (待 B5 引入)
 * 联动组件: essay-anchor-highlight.js (B2)
 * ============================================================================ */

'use strict';

import { escapeHtml, escapeAttr } from '../utils/safe-text.js';

// ────────────────────────────────────────────────────────────────────────────
// 常量
// ────────────────────────────────────────────────────────────────────────────

const CLS = Object.freeze({
  ROOT: 'ess-sidebar',
  LIST: 'ess-card-list',
  CARD: 'ess-card',
  CARD_ACTIVE: 'ess-card--active',
  CARD_FALLBACK: 'ess-card--fallback',
  CARD_HEADER: 'ess-card__hdr',
  CARD_BODY: 'ess-card__body',
  CARD_FOOTER: 'ess-card__footer',
  TAG: 'ess-tag',
  TAG_FALLBACK: 'ess-tag--fallback',
  QUOTE: 'ess-card__quote',
  COMMENT: 'ess-card__comment',
  META: 'ess-card__meta',
});

// 批注类型 → CSS 类 (与 B2 一致)
const TYPE_CSS = Object.freeze({
  highlight: 'ess-tag--highlight',
  masterstroke: 'ess-tag--masterstroke',
  grammar_error: 'ess-tag--grammar-error',
  advanced_vocab: 'ess-tag--advanced-vocab',
  logic_issue: 'ess-tag--logic-issue',
});

const TYPE_LABEL = Object.freeze({
  highlight: '好词好句',
  masterstroke: '点睛之笔',
  grammar_error: '语病',
  advanced_vocab: '高级词汇',
  logic_issue: '逻辑/结构',
});

const FAILURE_LABEL = Object.freeze({
  quote_not_found: '未对齐',
  paragraph_index_out_of_range: '越界',
  quote_too_short: '引用过短',
  overlap_evicted: '区间冲突',
});

// ────────────────────────────────────────────────────────────────────────────
// EssayAnnotationView
// ────────────────────────────────────────────────────────────────────────────

/**
 * @class EssayAnnotationView
 * @description 旁注卡片流 + 双向联动
 *
 * @example
 *   const view = new EssayAnnotationView(document.getElementById('sidebar'), {
 *     annotations: [...],
 *     onAnchorClick: (id) => {
 *       sourceView.setActive(id);
 *       sourceView.scrollToAnno(id);
 *     },
 *   });
 *   view.render();
 *   view.setActive('anno_abc_0');
 */
export class EssayAnnotationView {
  /**
   * @param {HTMLElement} rootEl
   * @param {Object} options
   * @param {Array<Object>} options.annotations
   * @param {Function} [options.onAnchorClick] - (annoId) => void
   * @param {Function} [options.onAnchorHover] - (annoId) => void (可选: hover 联动)
   */
  constructor(rootEl, { annotations = [], onAnchorClick = null, onAnchorHover = null } = {}) {
    if (!rootEl) throw new Error('EssayAnnotationView: rootEl 必填');
    this.rootEl = rootEl;
    this.annotations = annotations;
    this.onAnchorClick = onAnchorClick;
    this.onAnchorHover = onAnchorHover;
    this._activeId = null;

    this.rootEl.classList.add(CLS.ROOT);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 公共 API
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * 全量重渲染
   */
  render() {
    // 排序: 按 paragraph_index asc, 段内按 start asc (失败项放最后)
    const sorted = [...this.annotations].sort((a, b) => {
      if (a.paragraph_index !== b.paragraph_index) {
        return a.paragraph_index - b.paragraph_index;
      }
      // 失败项放每段末尾
      if (a.anchor_failed && !b.anchor_failed) return 1;
      if (!a.anchor_failed && b.anchor_failed) return -1;
      // 都成功: 按 start
      if (a.anchor_failed && b.anchor_failed) return 0;
      return (a.start ?? 0) - (b.start ?? 0);
    });

    this.rootEl.innerHTML = sorted.map((a) => this.renderCard(a)).join('');
    this.bindEvents();
  }

  /**
   * 增量更新
   */
  update({ annotations } = {}) {
    if (annotations && annotations !== this.annotations) {
      this.annotations = annotations;
      this.render();
    }
  }

  /**
   * 标记某卡片为 active (联动用, 不重渲染)
   * @param {string|null} annoId
   */
  setActive(annoId) {
    this._activeId = annoId;
    const cards = this.rootEl.querySelectorAll(`.${CLS.CARD}`);
    cards.forEach((card) => {
      if (card.dataset.annoId === annoId) {
        card.classList.add(CLS.CARD_ACTIVE);
      } else {
        card.classList.remove(CLS.CARD_ACTIVE);
      }
    });
  }

  /**
   * 滚动到指定卡片 (联动用, 移动端 Drawer 也可用)
   * @param {string} annoId
   * @param {Object} [opts]
   * @param {boolean} [opts.block='center']
   */
  scrollToCard(annoId, { block = 'center' } = {}) {
    const el = this.rootEl.querySelector(`[data-anno-id="${CSS_ESC(annoId)}"]`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 渲染核心
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * 渲染单张卡片
   * @param {Object} anno
   * @returns {string} HTML
   */
  renderCard(anno) {
    const isFailed = anno.anchor_failed === true;
    const typeClass = TYPE_CSS[anno.type] || '';
    const typeLabel = TYPE_LABEL[anno.type] || anno.type || '批注';
    const annoId = escapeAttr(anno.id || '');
    const annoType = escapeAttr(anno.type || '');
    const failureLabel = isFailed
      ? (FAILURE_LABEL[anno.failure_reason] || anno.failure_reason || '未对齐')
      : '';

    // 引用片段: 成功时用 original, 失败时用 quote (原始输入)
    const quote = isFailed
      ? (anno.quote || '')
      : (anno.original || anno.quote || '');

    const headerHtml = `
      <header class="${CLS.CARD_HEADER}">
        <span class="${CLS.TAG} ${typeClass}">${escapeHtml(typeLabel)}</span>
        ${isFailed ? `<span class="${CLS.TAG} ${CLS.TAG_FALLBACK}">未对齐 · ${escapeHtml(failureLabel)}</span>` : ''}
        <span class="${CLS.META}">第 ${escapeAttr(anno.paragraph_index ?? '?')} 段</span>
      </header>
    `;

    const bodyHtml = `
      <div class="${CLS.CARD_BODY}">
        <blockquote class="${CLS.QUOTE}">"${escapeHtml(quote)}"</blockquote>
        <p class="${CLS.COMMENT}">${escapeHtml(anno.comment || '')}</p>
      </div>
    `;

    const footerHtml = ''; // V1.0 暂不显示 "修改建议" 按钮 (B5 阶段加)

    const cardClass = `${CLS.CARD} ${isFailed ? CLS.CARD_FALLBACK : ''}`.trim();

    return (
      `<article class="${cardClass}" ` +
        `data-anno-id="${annoId}" ` +
        `data-type="${annoType}" ` +
        `data-anchor-failed="${isFailed}" ` +
        `data-para-index="${escapeAttr(anno.paragraph_index ?? '?')}" ` +
        `data-start="${escapeAttr(anno.start ?? -1)}" ` +
        `data-end="${escapeAttr(anno.end ?? -1)}" ` +
        `tabindex="0" role="button" aria-label="批注: ${escapeAttr(typeLabel)}">` +
        headerHtml +
        bodyHtml +
        footerHtml +
      `</article>`
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 事件绑定 (事件委托)
  // ──────────────────────────────────────────────────────────────────────────

  bindEvents() {
    if (this._onClick) this.rootEl.removeEventListener('click', this._onClick);
    if (this._onMouseOver) this.rootEl.removeEventListener('mouseover', this._onMouseOver);
    if (this._onKeyDown) this.rootEl.removeEventListener('keydown', this._onKeyDown);

    this._onClick = (e) => {
      const card = e.target.closest(`.${CLS.CARD}`);
      if (!card) return;
      const annoId = card.dataset.annoId;
      if (!annoId) return;
      this.setActive(annoId);
      if (typeof this.onAnchorClick === 'function') this.onAnchorClick(annoId);
    };

    this._onMouseOver = (e) => {
      const card = e.target.closest(`.${CLS.CARD}`);
      if (!card) return;
      const annoId = card.dataset.annoId;
      if (annoId && typeof this.onAnchorHover === 'function') this.onAnchorHover(annoId);
    };

    this._onKeyDown = (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const card = e.target.closest(`.${CLS.CARD}`);
      if (!card) return;
      e.preventDefault();
      const annoId = card.dataset.annoId;
      if (!annoId) return;
      this.setActive(annoId);
      if (typeof this.onAnchorClick === 'function') this.onAnchorClick(annoId);
    };

    this.rootEl.addEventListener('click', this._onClick);
    this.rootEl.addEventListener('mouseover', this._onMouseOver);
    this.rootEl.addEventListener('keydown', this._onKeyDown);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 销毁
  // ──────────────────────────────────────────────────────────────────────────

  destroy() {
    if (this._onClick) this.rootEl.removeEventListener('click', this._onClick);
    if (this._onMouseOver) this.rootEl.removeEventListener('mouseover', this._onMouseOver);
    if (this._onKeyDown) this.rootEl.removeEventListener('keydown', this._onKeyDown);
    this.rootEl.innerHTML = '';
  }
}

// CSS.escape polyfill (Node 18+ / 现代浏览器都有)
function CSS_ESC(s) {
  if (typeof CSS !== 'undefined' && CSS.escape) return CSS.escape(s);
  return String(s).replace(/[^a-zA-Z0-9_-]/g, '\\$&');
}

export default EssayAnnotationView;
