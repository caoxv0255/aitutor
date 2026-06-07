/**
 * katex-stream.js — KaTeX 流式公式渲染器
 *
 * 解决 SSE 流式接收 AI 回复时，LaTeX 公式可能被拆分为多个 chunk 的问题。
 * 核心策略：缓冲未闭合公式，闭合后批量渲染。
 *
 * 支持的 LaTeX 格式：
 *   $...$     — 行内公式
 *   $$...$$   — 独立公式块
 *
 * 使用示例：
 *   import { KatexStreamRenderer } from './katex-stream.js';
 *
 *   const renderer = new KatexStreamRenderer(document.getElementById('output'));
 *   renderer.append('解方程 $x^2 + ');
 *   renderer.append('2x + 1 = 0$，得 $x = -1$');
 *   renderer.flush();
 *
 * 依赖：KaTeX (CDN: https://cdn.jsdelivr.net/npm/katex)
 */

/** KaTeX 渲染选项 */
const KATEX_OPTIONS = {
  throwOnError: false,
  trust: false,
  strict: false,
  output: 'html',
};

export class KatexStreamRenderer {
  /**
   * @param {HTMLElement} container - 渲染容器
   * @param {object} [options]
   * @param {number} [options.batchMs=32] - 批量渲染间隔（ms）
   * @param {boolean} [options.autoScroll=true] - 是否自动滚动到底部
   */
  constructor(container, options = {}) {
    this.container = container;
    this.batchMs = options.batchMs ?? 32;
    this.autoScroll = options.autoScroll ?? true;

    // 内部状态
    this._buffer = ''; // 未处理的累积文本
    this._rendered = ''; // 已渲染的 HTML
    this._timer = null; // 防抖定时器
    this._isComplete = false;

    // 绑定 KaTeX（从全局或 CDN 加载）
    this._katex = window.katex || null;
    if (!this._katex) {
      this._loadKatex();
    }
  }

  /** 动态加载 KaTeX（如果未通过 CDN 引入） */
  _loadKatex() {
    if (window.katex) {
      this._katex = window.katex;
      return;
    }

    // 加载 CSS
    if (!document.querySelector('link[href*="katex"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css';
      document.head.appendChild(link);
    }

    // 加载 JS
    if (!document.querySelector('script[src*="katex"]')) {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js';
      script.onload = () => {
        this._katex = window.katex;
        this._scheduleRender();
      };
      document.head.appendChild(script);
    }
  }

  /**
   * 追加文本 delta（从 SSE 流接收）
   * @param {string} delta - 文本片段
   */
  append(delta) {
    this._buffer += delta;
    this._scheduleRender();
  }

  /** 标记流结束，立即刷新所有缓冲 */
  complete() {
    this._isComplete = true;
    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = null;
    }
    this._render();
  }

  /** 获取完整的纯文本（不含 HTML 标签） */
  getPlainText() {
    return this._rendered + this._buffer;
  }

  /** 重置渲染器 */
  reset() {
    this._buffer = '';
    this._rendered = '';
    this._isComplete = false;
    this.container.innerHTML = '';
    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = null;
    }
  }

  /** 调度渲染（防抖） */
  _scheduleRender() {
    if (this._timer) return;
    this._timer = setTimeout(() => {
      this._timer = null;
      this._render();
    }, this.batchMs);
  }

  /**
   * 核心渲染逻辑
   *
   * 将缓冲区文本分为三部分：
   *   1. 已闭合的安全区域 → 渲染为 HTML
   *   2. 未闭合的公式区域 → 保留在缓冲区
   *   3. 纯文本区域 → 直接输出
   */
  _render() {
    if (!this._buffer && this._isComplete) return;

    const text = this._buffer;
    if (!text) return;

    const html = this._parseAndRender(text);

    this._rendered += text;
    this._buffer = '';

    // 更新 DOM
    this.container.innerHTML = html;

    if (this.autoScroll) {
      this.container.scrollTop = this.container.scrollHeight;
    }
  }

  /**
   * 解析文本中的 LaTeX 公式并渲染为 HTML
   *
   * 算法：
   *   1. 扫描文本，找到 $ 和 $$ 定界符
   *   2. $$ 优先于 $（块级优先于行内）
   *   3. 已闭合的公式用 KaTeX 渲染
   *   4. 未闭合的公式保留原始文本（等待后续 chunk）
   *   5. 普通文本进行基本的 Markdown 转换
   */
  _parseAndRender(text) {
    if (!this._katex) {
      // KaTeX 未加载，返回纯文本
      return this._escapeHtml(text);
    }

    let result = '';
    let i = 0;
    const len = text.length;

    while (i < len) {
      // 检查 $$ 块级公式
      if (text[i] === '$' && text[i + 1] === '$') {
        const closeIdx = text.indexOf('$$', i + 2);
        if (closeIdx !== -1) {
          // 完整块级公式
          const formula = text.slice(i + 2, closeIdx);
          result += this._renderBlockFormula(formula);
          i = closeIdx + 2;
          continue;
        }
        // 未闭合的块级公式 → 保留在缓冲区
        this._buffer = text.slice(i);
        break;
      }

      // 检查 $ 行内公式（排除 $$）
      if (text[i] === '$' && text[i + 1] !== '$') {
        const closeIdx = this._findInlineClose(text, i + 1);
        if (closeIdx !== -1) {
          // 完整行内公式
          const formula = text.slice(i + 1, closeIdx);
          result += this._renderInlineFormula(formula);
          i = closeIdx + 1;
          continue;
        }
        // 未闭合的行内公式 → 保留在缓冲区
        this._buffer = text.slice(i);
        break;
      }

      // 普通文本 → 处理换行和基本格式
      let nextSpecial = text.indexOf('$', i + 1);
      if (nextSpecial === -1) nextSpecial = len;

      const plainText = text.slice(i, nextSpecial);
      result += this._renderPlainText(plainText);
      i = nextSpecial;
    }

    return result;
  }

  /**
   * 查找行内公式的闭合位置
   * 避免匹配到 $$ 和转义的 \$
   */
  _findInlineClose(text, start) {
    for (let i = start; i < text.length; i++) {
      if (text[i] === '\\' && i + 1 < text.length) {
        i++; // 跳过转义字符
        continue;
      }
      if (text[i] === '$' && text[i + 1] !== '$') {
        return i;
      }
    }
    return -1;
  }

  /** 渲染行内公式 */
  _renderInlineFormula(formula) {
    try {
      return this._katex.renderToString(formula.trim(), {
        ...KATEX_OPTIONS,
        displayMode: false,
      });
    } catch {
      return `<code class="katex-fallback">${this._escapeHtml(formula)}</code>`;
    }
  }

  /** 渲染块级公式 */
  _renderBlockFormula(formula) {
    try {
      return `<div class="katex-block">${this._katex.renderToString(formula.trim(), {
        ...KATEX_OPTIONS,
        displayMode: true,
      })}</div>`;
    } catch {
      return `<div class="katex-fallback-block"><code>${this._escapeHtml(formula)}</code></div>`;
    }
  }

  /** 渲染普通文本（基本 Markdown 支持） */
  _renderPlainText(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/`(.+?)`/g, '<code>$1</code>');
  }

  /** HTML 转义 */
  _escapeHtml(text) {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PWA 相机拍照辅助组件
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 触发设备相机拍照或选择图片
 *
 * @param {object} [options]
 * @param {boolean} [options.preferCamera=true] - 优先调用相机
 * @param {number} [options.maxSize=4096] - 最大图片尺寸（px）
 * @returns {Promise<string>} Base64 编码的图片数据（不含 data: 前缀）
 */
export async function capturePhoto(options = {}) {
  const { preferCamera = true, maxSize = 4096 } = options;

  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';

    if (preferCamera) {
      input.capture = 'environment'; // 优先后置相机
    }

    input.onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) {
        reject(new Error('未选择图片'));
        return;
      }

      try {
        const base64 = await fileToBase64(file, maxSize);
        resolve(base64);
      } catch (err) {
        reject(err);
      }
    };

    input.oncancel = () => reject(new Error('拍照已取消'));
    input.click();
  });
}

/**
 * 将 File 对象转为压缩后的 Base64
 */
function fileToBase64(file, maxSize) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        // 压缩到 maxSize
        let w = img.width;
        let h = img.height;
        if (w > maxSize || h > maxSize) {
          const ratio = Math.min(maxSize / w, maxSize / h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);

        // 转为 JPEG base64
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');
        resolve(base64);
      };
      img.onerror = () => reject(new Error('图片加载失败'));
      img.src = reader.result;
    };
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsDataURL(file);
  });
}
