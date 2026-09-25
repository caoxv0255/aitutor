/* ==========================================================================
 * qb-render.js — 题库题面「文本 + 公式 + 多模态占位符」混排渲染（共享模块）
 *
 * 起因（2026-09-25，承接 fd3db94）：
 *   exam_questions.stem 里结构化内容被替换成管线占位符 —— ⟦IMG:rIdN⟧(图片)、
 *   ⟦F:rIdN⟧(公式)、⟦TABLE:n⟧(表格)、⟦OMML⟧(公式变形)。后端随题下发 media[]
 *   （见 api/services/questionTables.js 的 enrichQuestionsWithMedia）。photo-solve
 *   相似题已接通；本模块把同一套实现抽出来，供其余 v2 页面复用，避免逐页复制。
 *
 * 安全（与 photo-solve 同纪律，别再开回去）：
 *   - 文本段走 createTextNode，**永不 innerHTML/insertAdjacentHTML**（闸门 M-4 硬约束）
 *   - 公式段交给 KaTeX render()，trust:false、maxExpand 上限（防 \href / 宏展开）
 *   - 图片是受控 <img src>（src 来自后端 media[].url，非用户输入），alt + loading=lazy
 *
 * 降级（绝不把裸 token 显示给用户）：
 *   - ⟦IMG⟧ 取不到资产 → 「图片暂缺」
 *   - ⟦F⟧  取不到资产但有 latex → KaTeX；都没有 → 「公式暂缺」
 *   - ⟦TABLE:n⟧  → 「表格暂缺」（表格结构化渲染需新样式，本期只降级，见交付说明）
 *   - ⟦OMML…⟧   → 「公式暂缺」（无 OMML→资产通路）
 * ========================================================================== */
/* global window, document */
(function (global) {
  'use strict';

  const KATEX_OPTS = { throwOnError: false, trust: false, strict: false, maxExpand: 1000 };

  function stripDelims(raw) {
    const s = String(raw || '').trim();
    if (s.length > 4 && s.slice(0, 2) === '$$' && s.slice(-2) === '$$') {
      return { tex: s.slice(2, -2), display: true };
    }
    if (s.length > 2 && s.charAt(0) === '$' && s.charAt(s.length - 1) === '$') {
      return { tex: s.slice(1, -1), display: false };
    }
    return { tex: s, display: false };
  }

  /** LaTeX 段 → KaTeX 节点；未加载 KaTeX 或渲染失败 → 退回原文（不静默丢内容） */
  function renderFormula(target, raw) {
    const f = stripDelims(raw);
    if (!f.tex) return;
    const span = global.document.createElement('span');
    span.className = 'formula' + (f.display ? ' formula--block' : '');
    if (global.katex && typeof global.katex.render === 'function') {
      try {
        global.katex.render(f.tex, span, {
          throwOnError: KATEX_OPTS.throwOnError,
          trust: KATEX_OPTS.trust,
          strict: KATEX_OPTS.strict,
          maxExpand: KATEX_OPTS.maxExpand,
          displayMode: f.display,
        });
      } catch (e) {
        span.textContent = String(raw);
      }
    } else {
      span.textContent = String(raw);
    }
    target.appendChild(span);
  }

  function findMedia(media, token) {
    if (!Array.isArray(media)) return null;
    for (let i = 0; i < media.length; i++) {
      if (media[i] && media[i].token === token) return media[i];
    }
    return null;
  }

  function renderMissing(target, text) {
    const ph = global.document.createElement('span');
    ph.className = 'q-media-missing';
    ph.textContent = text;
    target.appendChild(ph);
  }

  function renderMediaToken(target, kind, rid, media) {
    const rec = findMedia(media, kind + ':' + rid);
    // 可渲染资产优先（wmf/emf 后端已映射到 png_rel，ext 置为 .png）
    if (rec && rec.url && rec.renderable !== false) {
      const img = global.document.createElement('img');
      img.className = 'q-media';
      img.src = rec.url;
      img.alt = kind === 'IMG' ? '题目插图' : '公式';
      img.setAttribute('loading', 'lazy');
      target.appendChild(img);
      return;
    }
    // 公式兜底：无渲染图但有 latex → KaTeX（与既有公式链路同一渲染器）
    if (kind === 'F' && rec && rec.latex) {
      renderFormula(target, rec.latex);
      return;
    }
    renderMissing(target, kind === 'IMG' ? '图片暂缺' : '公式暂缺');
  }

  /**
   * 文本 + $行内$ + $$独立$$ + ⟦IMG/F⟧ + ⟦TABLE:n⟧ + ⟦OMML⟧ 混排。
   * 公式段走 KaTeX，IMG/F 走资产，TABLE/OMML 降级为可读占位，其余纯文本。
   */
  function renderMixed(target, text, media) {
    const src = String(text || '');
    const re = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$|⟦(IMG|F):([^⟧]+)⟧|⟦TABLE:(\d+)⟧|⟦OMML:?([^⟧]*)⟧/g;
    let last = 0;
    let m;
    while ((m = re.exec(src)) !== null) {
      if (m.index > last) {
        target.appendChild(global.document.createTextNode(src.slice(last, m.index)));
      }
      if (m[3]) {
        renderMediaToken(target, m[3], m[4], media);
      } else if (m[5] !== undefined) {
        renderMissing(target, '表格暂缺');
      } else if (m[6] !== undefined) {
        renderMissing(target, '公式暂缺');
      } else {
        renderFormula(target, m[0]);
      }
      last = m.index + m[0].length;
    }
    if (last < src.length) {
      target.appendChild(global.document.createTextNode(src.slice(last)));
    }
  }

  /** 便捷入口：清空容器后按混排渲染（容器可为 <p>/<div>/<span>） */
  function renderInto(target, text, media) {
    if (!target) return;
    target.textContent = '';
    renderMixed(target, text, media);
  }

  global.QBRender = {
    stripDelims: stripDelims,
    renderFormula: renderFormula,
    findMedia: findMedia,
    renderMediaToken: renderMediaToken,
    renderMixed: renderMixed,
    renderInto: renderInto,
  };
})(window);
