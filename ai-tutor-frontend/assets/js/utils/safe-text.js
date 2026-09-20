/* ============================================================================
 * safe-text.js — AI Tutor F3 · 文本安全工具
 *
 * 用途: 防止 LLM 输出直接注入 DOM, 所有"用户/AI 不可信文本"必经此工具.
 *
 * 核心原则:
 *   - 永不直接 innerHTML = 任何 LLM 输出
 *   - 文本一律 escapeHtml
 *   - Markdown 渲染后必须 DOMPurify.sanitize
 *
 * 调用方: essay-anchor-highlight.js, essay-annotation-card.js,
 *         EmptyState 组件, Toast, 任何渲染 LLM 输出的页面
 * ============================================================================ */

'use strict';

// ────────────────────────────────────────────────────────────────────────────
// 字符映射 (与 React 的 escape 规则一致)
// ────────────────────────────────────────────────────────────────────────────

const HTML_ESCAPE_MAP = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
  '`': '&#x60;',
  '=': '&#x3D;',
};

/**
 * HTML 实体编码: 把 5 个危险字符转为实体引用.
 * 这是 XSS 防护的第一道关.
 *
 * @param {*} s 任意值
 * @returns {string} 安全字符串
 */
export function escapeHtml(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/[&<>"'`=]/g, (c) => HTML_ESCAPE_MAP[c]);
}

/**
 * 给 HTML 属性加引号转义 (更严格, 适用于 data-*, aria-* 等属性值).
 * 比 escapeHtml 额外处理 `"` 字符, 防止 "><img onerror> 注入.
 *
 * @param {*} s
 * @returns {string}
 */
export function escapeAttr(s) {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ────────────────────────────────────────────────────────────────────────────
// 安全 Markdown 渲染 (可选, V1.1 用)
// ────────────────────────────────────────────────────────────────────────────

/**
 * 把 Markdown 文本安全地渲染为 HTML.
 * 走 marked.parse + DOMPurify.sanitize 双保险.
 *
 * 注意: marked / DOMPurify 必须在 window 上可用. SSR / 老浏览器降级到纯文本.
 *
 * @param {string} md
 * @returns {string} 安全的 HTML 字符串
 */
export function safeRenderMarkdown(md) {
  if (!md) return '';
  if (typeof window === 'undefined' || !window.marked || !window.DOMPurify) {
    // 浏览器外或依赖缺失 → 降级为纯文本 + <br>
    return `<p>${escapeHtml(String(md)).replace(/\n/g, '<br>')}</p>`;
  }
  try {
    const html = window.marked.parse(String(md));
    return window.DOMPurify.sanitize(html, {
      ALLOWED_TAGS: [
        'p', 'br', 'strong', 'em', 'u', 's',
        'ul', 'ol', 'li',
        'code', 'pre',
        'blockquote', 'a',
        'h1', 'h2', 'h3', 'h4',
      ],
      ALLOWED_ATTR: ['href', 'title', 'rel', 'target'],
    });
  } catch (e) {
    // 渲染失败 → 纯文本兜底
    return `<p>${escapeHtml(String(md))}</p>`;
  }
}

// ────────────────────────────────────────────────────────────────────────────
// 长度截断 (UI 防御)
// ────────────────────────────────────────────────────────────────────────────

/**
 * 安全截断字符串 (用于卡片标题, 避免超长撑破 UI).
 *
 * @param {string} s
 * @param {number} [max=200]
 * @param {string} [suffix='…']
 * @returns {string}
 */
export function truncate(s, max = 200, suffix = '…') {
  const str = String(s || '');
  if (str.length <= max) return str;
  return str.slice(0, max - suffix.length) + suffix;
}

// ────────────────────────────────────────────────────────────────────────────
// 默认导出
// ────────────────────────────────────────────────────────────────────────────

export default {
  escapeHtml,
  escapeAttr,
  safeRenderMarkdown,
  truncate,
};
