/* ============================================================================
 * essay-anchor-highlight.js — D086 §12 L4 V1.0 · 原文锚定高亮渲染引擎
 *
 * 职责: 把后端的 transcript.paragraphs + 锚定后的 annotations 渲染为
 *       "原文 + 行内高亮 span + 段末降级卡片"的 DOM 结构.
 *
 * 核心不变量 (前端消费契约):
 *   F1. 同段内所有高亮区间绝不重叠 (后端 resolveOverlaps 已保证)
 *   F2. 原文文本使用 join('\n') 拼接, 索引与后端 start/end 一致
 *   F3. 所有 LLM 输出 (comment, quote) 必须 escapeHtml
 *   F4. 永不直接 innerHTML 注入未转义内容
 *
 * ⚠️ 架构师警告: 必须 join('\n') + white-space:pre-wrap,
 *    否则换行符丢失, 索引错位, 视觉上段落变成一坨.
 *
 * 配套 CSS: assets/css/essay.css (待 B5 引入)
 * ============================================================================ */

'use strict';

import { escapeHtml, escapeAttr } from '../utils/safe-text.js';

// ────────────────────────────────────────────────────────────────────────────
// CSS 类常量 (集中管理, 便于主题切换)
// 注: 不使用 const CSS = ... 以免遮蔽浏览器全局 CLS.escape()
// ────────────────────────────────────────────────────────────────────────────

const CLS = Object.freeze({
  ROOT: 'ess-source',
  PARA: 'ess-para',
  PARA_TEXT: 'ess-para-text',
  ANNO: 'ess-anno',
  ANNO_FALLBACK: 'ess-anno-fallback',
  ANNO_ACTIVE: 'ess-anno--active',
  TAG: 'ess-tag',
  TAG_FALLBACK: 'ess-tag--fallback',
  FALLBACK_QUOTE: 'ess-fallback-quote',
  FALLBACK_COMMENT: 'ess-fallback-comment',
});

// 批注类型 → CSS 类 (与 Design Token v1 对应)
const TYPE_CSS = Object.freeze({
  highlight: 'ess-anno--highlight',
  masterstroke: 'ess-anno--masterstroke',
  grammar_error: 'ess-anno--grammar-error',
  advanced_vocab: 'ess-anno--advanced-vocab',
  logic_issue: 'ess-anno--logic-issue',
});

// 类型中文标签
const TYPE_LABEL = Object.freeze({
  highlight: '好词好句',
  masterstroke: '点睛之笔',
  grammar_error: '语病',
  advanced_vocab: '高级词汇',
  logic_issue: '逻辑/结构',
});

// ────────────────────────────────────────────────────────────────────────────
// EssaySourceView — 原文 + 锚定高亮
// ────────────────────────────────────────────────────────────────────────────

/**
 * @class EssaySourceView
 * @description 渲染原文 + 行内高亮 + 段末降级卡片
 *
 * @example
 *   const view = new EssaySourceView(document.getElementById('source'), {
 *     paragraphs: [{ paragraph_index: 0, lines: [...] }],
 *     annotations: [...],
 *     onAnnotationClick: (id) => console.log('clicked', id),
 *   });
 *   view.render();
 *   view.setActive('anno_abc_0');
 */
export class EssaySourceView {
  /**
   * @param {HTMLElement} rootEl
   * @param {Object} options
   * @param {Array<{paragraph_index:number, lines:Array<{line_no:number, text:string, uncertain_chars?:string[]}>}>} options.paragraphs
   * @param {Array<{id:string, type:string, paragraph_index:number, start:number, end:number, quote:string, comment:string, anchor_failed?:boolean, failure_reason?:string}>} options.annotations
   * @param {Function} [options.onAnnotationClick] - (annoId) => void
   */
  constructor(rootEl, { paragraphs = [], annotations = [], onAnnotationClick = null } = {}) {
    if (!rootEl) throw new Error('EssaySourceView: rootEl 必填');
    this.rootEl = rootEl;
    this.paragraphs = paragraphs;
    this.annotations = annotations;
    this.onAnnotationClick = onAnnotationClick;
    this._activeId = null;

    // 防御: 设置 rootEl 基础类
    this.rootEl.classList.add(CLS.ROOT);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 公共 API
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * 全量重渲染. 会清空 rootEl 内容.
   * 生产环境慎用: 频繁调用会重置所有 DOM 状态 (滚动位置, focus 等).
   * 优先使用 update() 做增量.
   */
  render() {
    this.rootEl.innerHTML = this.paragraphs.map((p) => this.renderParagraph(p)).join('');
    this.bindEvents();
  }

  /**
   * 增量更新: 仅在 paragraphs/annotations 引用变化时重渲染.
   * @param {Object} newState
   * @param {Array} [newState.paragraphs]
   * @param {Array} [newState.annotations]
   */
  update({ paragraphs, annotations } = {}) {
    let changed = false;
    if (paragraphs && paragraphs !== this.paragraphs) {
      this.paragraphs = paragraphs;
      changed = true;
    }
    if (annotations && annotations !== this.annotations) {
      this.annotations = annotations;
      changed = true;
    }
    if (changed) this.render();
  }

  /**
   * 标记某个 annotation 为 active (联动用).
   * 不重渲染, 仅切换 class, 性能 O(n).
   * @param {string|null} annoId
   */
  setActive(annoId) {
    this._activeId = annoId;
    const els = this.rootEl.querySelectorAll(`.${CLS.ANNO}, .${CLS.ANNO_FALLBACK}`);
    els.forEach((el) => {
      if (el.dataset.annoId === annoId) {
        el.classList.add(CLS.ANNO_ACTIVE);
      } else {
        el.classList.remove(CLS.ANNO_ACTIVE);
      }
    });
  }

  /**
   * 滚动到指定 annotation (联动用).
   * @param {string} annoId
   * @param {Object} [opts]
   * @param {boolean} [opts.block='center']
   */
  scrollToAnno(annoId, { block = 'center' } = {}) {
    const el = this.rootEl.querySelector(`[data-anno-id="${CLS.escape(annoId)}"]`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 渲染核心
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * 渲染单个段落.
   *
   * V1.0.1 算法 (P0 索引对齐修复):
   *   1. 全文 join('') — 与后端 findQuoteInParagraph 一致, start/end 索引零偏差
   *   2. 计算 lineBreaks Set — 每行结束的字符位置, 渲染时插入 <br>
   *   3. 线性扫描切分: [正常, 高亮, 正常, ...] — 支持跨行高亮 (LCS 兜底场景)
   *   4. 段末追加 failed 降级卡片
   *
   * 与 V1.0.0 区别:
   *   - 旧: join('\n') + white-space: pre-wrap → 索引与后端差 1 字符/每行
   *   - 新: join('') + <br> 显式断点 → 索引精确对齐, 视觉换行不变
   *
   * @param {{paragraph_index:number, lines:Array<{line_no:number, text:string}>}} para
   * @returns {string} HTML 字符串
   */
  renderParagraph(para) {
    // 1. 拼接全文 (与后端 findQuoteInParagraph 完全一致, 索引零偏差)
    const fullText = para.lines.map((l) => l.text || '').join('');

    // 2. 计算换行断点 (Set 存储断点索引 = 下一行起始位置)
    // 例: ["abc", "de", "f"] → 断点 {3, 5}, 全文 "abcdef"
    const lineBreaks = new Set();
    let runningLen = 0;
    for (let i = 0; i < para.lines.length - 1; i++) {
      runningLen += (para.lines[i].text || '').length;
      lineBreaks.add(runningLen);
    }

    // 3. 提取本段批注, 分类
    const validAnnos = this.annotations
      .filter(
        (a) =>
          a.paragraph_index === para.paragraph_index &&
          !a.anchor_failed &&
          typeof a.start === 'number' &&
          a.start >= 0 &&
          typeof a.end === 'number' &&
          a.end > a.start
      )
      .sort((a, b) => a.start - b.start);

    const failedAnnos = this.annotations.filter(
      (a) => a.paragraph_index === para.paragraph_index && a.anchor_failed
    );

    // 4. 辅助函数: 渲染 [start, end) 区间的纯文本, 遇断点插入 <br>
    // 字符逐个处理以保证转义和无 <br> 错位
    const renderTextWithBreaks = (start, end) => {
      let out = '';
      for (let i = start; i < end; i++) {
        out += escapeHtml(fullText[i] || '');
        if (lineBreaks.has(i + 1)) {
          out += '<br>';
        }
      }
      return out;
    };

    // 5. 线性扫描切分算法 (支持跨行高亮)
    let html = '';
    let lastIndex = 0;

    for (const anno of validAnnos) {
      // 边界防御: 跳过 start < lastIndex 的退化区间
      if (anno.start < lastIndex) continue;

      // 5a. 截取 [lastIndex, anno.start] 普通文本
      if (anno.start > lastIndex) {
        html += renderTextWithBreaks(lastIndex, anno.start);
      }

      // 5b. 截取 [anno.start, anno.end] 高亮文本 (含跨行 <br>)
      const typeClass = TYPE_CSS[anno.type] || '';
      const annoId = escapeAttr(anno.id || '');
      const annoType = escapeAttr(anno.type || '');
      const annoStart = escapeAttr(anno.start);
      const annoEnd = escapeAttr(anno.end);
      html += `<span class="${CLS.ANNO} ${typeClass}" data-anno-id="${annoId}" data-type="${annoType}" data-start="${annoStart}" data-end="${annoEnd}">`;
      html += renderTextWithBreaks(anno.start, anno.end);
      html += `</span>`;

      lastIndex = anno.end;
    }

    // 5c. 段尾普通文本
    if (lastIndex < fullText.length) {
      html += renderTextWithBreaks(lastIndex, fullText.length);
    }

    // 6. 段末降级卡片 (锚定失败的批注)
    let fallbackHtml = '';
    if (failedAnnos.length > 0) {
      fallbackHtml = failedAnnos.map((a) => this.renderFallbackCard(a)).join('');
    }

    // 7. 段落容器: <br> 显式断点, 无需 white-space 特殊处理
    return (
      `<section class="${CLS.PARA}" data-para-index="${escapeAttr(para.paragraph_index)}">` +
        `<p class="${CLS.PARA_TEXT}">${html}</p>` +
        fallbackHtml +
      `</section>`
    );
  }

  /**
   * 渲染段末降级卡片 (锚定失败的批注).
   * @param {Object} anno
   * @returns {string}
   */
  renderFallbackCard(anno) {
    const typeLabel = TYPE_LABEL[anno.type] || '批注';
    const annoId = escapeAttr(anno.id || '');
    const annoType = escapeAttr(anno.type || '');
    const reasonText = anno.failure_reason ? `（${anno.failure_reason}）` : '';
    return (
      `<div class="${CLS.ANNO_FALLBACK}" data-anno-id="${annoId}" data-type="${annoType}" data-anchor-failed="true">` +
        `<div class="${CLS.TAG} ${CLS.TAG_FALLBACK}">${escapeHtml(typeLabel)} · 未对齐 ${escapeHtml(reasonText)}</div>` +
        `<blockquote class="${CLS.FALLBACK_QUOTE}">"${escapeHtml(anno.quote || '')}"</blockquote>` +
        `<p class="${CLS.FALLBACK_COMMENT}">${escapeHtml(anno.comment || '')}</p>` +
      `</div>`
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 事件绑定
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * 绑定点击事件. 使用事件委托减少监听器数量.
   */
  bindEvents() {
    // 防御: 重复绑定会重复触发, 先移除旧监听器
    if (this._onClick) {
      this.rootEl.removeEventListener('click', this._onClick);
    }
    this._onClick = (e) => {
      const target = e.target.closest(`[data-anno-id]`);
      if (!target) return;
      const annoId = target.dataset.annoId;
      if (!annoId) return;
      this.setActive(annoId);
      if (typeof this.onAnnotationClick === 'function') {
        this.onAnnotationClick(annoId);
      }
    };
    this.rootEl.addEventListener('click', this._onClick);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 销毁
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * 清理事件监听器, 用于组件卸载.
   */
  destroy() {
    if (this._onClick) {
      this.rootEl.removeEventListener('click', this._onClick);
      this._onClick = null;
    }
    this.rootEl.innerHTML = '';
  }
}

export default EssaySourceView;
