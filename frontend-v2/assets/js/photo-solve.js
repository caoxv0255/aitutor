/* global window, document, FileReader */
/* ==========================================================================
 * 拍照解题（阶段 2 垂直切片）
 *
 * 这条链路被选为切片，是因为它会一次性压出六个问题：
 *   鉴权（batch-parse 需 Bearer）· 大载荷超时 · 部分失败（questions[]+failed[]）
 *   数据契约（解析结果 → 错题本字段）· 离线 · 空态
 *
 * 状态机：empty / loading / success / error / auth / offline
 * 每个状态对应一个 [data-state] section，同一时刻只有一个可见。
 * ========================================================================== */
(function (global) {
  'use strict';

  const MAX_IMAGES = 20;
  const MAX_BYTES = 10 * 1024 * 1024;

  const STATES = ['empty', 'loading', 'success', 'error', 'auth', 'offline'];

  const els = {};
  let files = [];
  let controller = null;
  let machine = null;

  function $(id) {
    return global.document.getElementById(id);
  }

  /* ── 状态机（互斥显示的实现抽到 assets/js/ui.js，供各页复用） ────────── */
  function setState(name, ctx) {
    return machine.set(name, ctx);
  }

  function renderState(name, ctx) {
    ctx = ctx || {};
    if (name === 'empty' && els.emptyCopy) {
      els.emptyCopy.textContent =
        ctx.reason === 'zero-result'
          ? '这几张图没有解析出题目，换一张更清晰的试试。'
          : '先添加一张题目照片，解析结果会出现在这里。';
    }
    if (name === 'loading' && els.loadingTitle) {
      els.loadingTitle.textContent = ctx.title || '正在解析…';
    }
    if (name === 'error' && els.errorCopy) {
      els.errorCopy.textContent = ctx.message || '服务暂时不可用。';
    }
    if (name === 'success' && els.successTitle) {
      els.successTitle.textContent =
        '解析完成 · 成功 ' +
        (ctx.successCount || 0) +
        ' 题' +
        (ctx.failedCount ? ' · 失败 ' + ctx.failedCount + ' 张' : '');
    }
    els.cancelBtn.hidden = name !== 'loading';
    els.parseBtn.disabled = name === 'loading';
  }

  /* ── 缩略图 ─────────────────────────────────────────────────────────── */
  function renderThumbs() {
    els.thumbs.innerHTML = '';
    files.forEach(function (file, i) {
      const li = global.document.createElement('li');
      li.className = 'thumb';
      li.style.animationDelay = i * 40 + 'ms';

      const img = global.document.createElement('img');
      img.alt = '待解析的第 ' + (i + 1) + ' 张题目照片';
      img.src = global.URL.createObjectURL(file);

      const rm = global.document.createElement('button');
      rm.type = 'button';
      rm.setAttribute('aria-label', '移除第 ' + (i + 1) + ' 张照片');
      rm.textContent = '×';
      rm.addEventListener('click', function () {
        files.splice(i, 1);
        renderThumbs();
      });

      li.appendChild(img);
      li.appendChild(rm);
      els.thumbs.appendChild(li);
    });
  }

  function onPick(e) {
    const picked = Array.prototype.slice.call(e.target.files || []);
    const accepted = picked.filter(function (f) {
      return f.size <= MAX_BYTES;
    });
    files = files.concat(accepted).slice(0, MAX_IMAGES);
    renderThumbs();
    e.target.value = '';
  }

  /* ── 读取为 base64 ──────────────────────────────────────────────────── */
  function toBase64(file) {
    return new global.Promise(function (resolve, reject) {
      const reader = new global.FileReader();
      reader.onload = function () {
        resolve(String(reader.result).replace(/^data:image\/\w+;base64,/, ''));
      };
      reader.onerror = function () {
        reject(new Error('读取图片失败'));
      };
      reader.readAsDataURL(file);
    });
  }

  /* ── 结果区原图对照 ─────────────────────────────────────────────────────
   * 收编自 pwa-photo.html / vision-result.html（2026-09-22 两页下线）：
   * 原型里的"OCR 原图对照"是唯一不需要新接口就能落地的一块 —— 原图就在本地 files 里。
   * 刻意没搬的：置信度 98% / 耗时 2.4s / "12 个同学标记为正确" —— 原型里是硬编码假数据，
   * 后端不返回这些字段，搬到接线页里就是造假。
   * ──────────────────────────────────────────────────────────────────── */
  function renderResultImages() {
    if (!els.resultImages) return;
    els.resultImages.innerHTML = '';
    files.forEach(function (file, i) {
      const li = global.document.createElement('li');
      li.className = 'thumb';

      const img = global.document.createElement('img');
      img.alt = '第 ' + (i + 1) + ' 张原题照片';
      img.src = global.URL.createObjectURL(file);

      li.appendChild(img);
      els.resultImages.appendChild(li);
    });
  }

  /* ── LaTeX 渲染（KaTeX，自托管） ───────────────────────────────────────
   * 后端 parseImageToQuestion 明确返回 latex_formulas —— 实测（2026-09-22，/api/vision/batch-parse）
   * 拿到的是 ['$x^2 + 2x - 3 = 0$', '$S = \pi \cdot r^2$', '$(a+b)^2 - (a-b)^2$']，
   * 此前一律 textContent，公式就以 $...$ 原文出现在页面上。
   *
   * 安全（这条链路修过注入，别再开回去）：
   *   - 文本段走 createTextNode，永不 innerHTML
   *   - 公式段交给 KaTeX render()，且 trust:false（禁 \href/\url/\includegraphics）、
   *     maxExpand 上限（防恶意宏展开把页面卡死）
   *   - 渲染失败退回原文，不静默丢内容
   * ──────────────────────────────────────────────────────────────────── */
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
      span.textContent = String(raw); // 未加载 KaTeX 就退回原文
    }
    target.appendChild(span);
  }

  /** 文本 + $行内$ + $$独立$$ 混排渲染：公式段交给 KaTeX，其余一律纯文本节点 */
  function renderMixed(target, text) {
    const src = String(text || '');
    const re = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g;
    let last = 0;
    let m;
    while ((m = re.exec(src)) !== null) {
      if (m.index > last) {
        target.appendChild(global.document.createTextNode(src.slice(last, m.index)));
      }
      renderFormula(target, m[0]);
      last = m.index + m[0].length;
    }
    if (last < src.length) {
      target.appendChild(global.document.createTextNode(src.slice(last)));
    }
  }

  /* ── 结果渲染 ───────────────────────────────────────────────────────── */
  function itemContent(q) {
    // raw_text 优先：full_content = raw_text + "【公式】" + 公式原文，
    // 直接显示会把公式再抄一遍（实测 2026-09-22）。公式由 latex_formulas 单独渲染。
    return q.raw_text || q.content || q.question || q.text || q.full_content || '（无题干）';
  }

  function renderResults(data) {
    const questions = data.questions || [];
    els.results.innerHTML = '';
    els.failed.innerHTML = '';
    renderResultImages();

    questions.forEach(function (q, i) {
      const li = global.document.createElement('li');
      li.className = 'q-card';
      li.style.animationDelay = i * 60 + 'ms';

      const head = global.document.createElement('div');
      head.className = 'q-head';

      const idx = global.document.createElement('span');
      idx.className = 'q-index';
      idx.textContent = q.pageIndex || i + 1;

      const tags = [
        q.subject_code || q.subject || '',
        q.difficulty ? '难度 ' + q.difficulty : '',
        q.knowledge_point_name || q.inferred_kp_name || '',
      ].filter(Boolean);

      head.appendChild(idx);
      tags.forEach(function (t) {
        const tag = global.document.createElement('span');
        tag.className = 'tag';
        tag.textContent = t;
        head.appendChild(tag);
      });

      const body = global.document.createElement('p');
      body.className = 'q-body';
      renderMixed(body, itemContent(q));

      li.appendChild(head);
      li.appendChild(body);

      // 公式区：后端单独给的 latex_formulas（实测字段存在且带 $ 定界符）
      const formulas = Array.isArray(q.latex_formulas) ? q.latex_formulas : [];
      if (formulas.length) {
        const box = global.document.createElement('div');
        box.className = 'formula-list';
        formulas.forEach(function (f) {
          renderFormula(box, f);
        });
        li.appendChild(box);
      }

      if (q.analysis || q.error_analysis) {
        const ana = global.document.createElement('p');
        ana.className = 'q-analysis';
        renderMixed(ana, q.analysis || q.error_analysis);
        li.appendChild(ana);
      }

      const actions = global.document.createElement('div');
      actions.className = 'q-actions';

      const save = global.document.createElement('button');
      save.type = 'button';
      save.className = 'btn btn-ghost';
      save.textContent = '存入错题本';
      save.addEventListener('click', function () {
        saveToWrongBook(q, save);
      });

      actions.appendChild(save);
      li.appendChild(actions);
      els.results.appendChild(li);
    });

    (data.failed || []).forEach(function (f) {
      const li = global.document.createElement('li');
      li.textContent = '第 ' + (f.pageIndex || '?') + ' 张解析失败：' + (f.error || '未知原因');
      els.failed.appendChild(li);
    });
  }

  /* ── 存错题本 ───────────────────────────────────────────────────────── */
  function saveToWrongBook(q, btn) {
    const payload = {
      content: itemContent(q),
      subject_code: q.subject_code || q.subject || els.subject.value,
      difficulty: q.difficulty || null,
      question_type: q.question_type || null,
      knowledge_point_id: q.knowledge_point_id || q.inferred_kp_id || null,
      knowledge_point_name: q.knowledge_point_name || null,
      error_analysis: q.analysis || q.error_analysis || null,
    };

    btn.disabled = true;
    btn.textContent = '存入中…';

    return global.AIAPI.addWrongQuestion(payload)
      .then(function () {
        btn.textContent = '已存入';
        btn.disabled = true;
      })
      .catch(function (err) {
        btn.disabled = false;
        btn.textContent = '重试存入';
        const mapped = global.AIUI.mapError(err);
        if (mapped === 'auth' || mapped === 'offline') {
          setState(mapped);
        } else {
          btn.title = err && err.message ? err.message : '存入失败';
        }
      });
  }

  /* ── 主流程 ─────────────────────────────────────────────────────────── */
  function submit() {
    if (!files.length) return setState('empty', { reason: 'no-image' });
    if (global.navigator && global.navigator.onLine === false) return setState('offline');
    if (!global.AIAPI.getToken()) return setState('auth');

    setState('loading', { title: '正在解析 ' + files.length + ' 张照片…' });
    controller = new global.AbortController();

    return global.Promise.all(files.map(toBase64))
      .then(function (base64s) {
        const images = base64s.map(function (b, i) {
          return { data: b, subject: els.subject.value, pageIndex: i + 1 };
        });
        return global.AIAPI.batchParse(images, { default_subject: els.subject.value }, controller.signal);
      })
      .then(function (data) {
        controller = null;
        if (!((data && data.questions) || []).length) {
          return setState('empty', { reason: 'zero-result' });
        }
        renderResults(data);
        return setState('success', {
          successCount: data.success_count || (data.questions || []).length,
          failedCount: data.failed_count || (data.failed || []).length,
        });
      })
      .catch(function (err) {
        controller = null;
        if (err && err.name === 'AbortError') {
          return setState('empty', { reason: 'no-image' });
        }
        const mapped = global.AIUI.mapError(err);
        if (mapped !== 'error') return setState(mapped);
        return setState('error', { message: (err && err.message) || '解析失败' });
      });
  }

  /* ── 装配 ───────────────────────────────────────────────────────────── */
  function init() {
    els.region = $('state-region');
    els.thumbs = $('thumbs');
    els.subject = $('subject-select');
    els.parseBtn = $('parse-btn');
    els.cancelBtn = $('cancel-btn');
    els.emptyCopy = $('empty-copy');
    els.loadingTitle = $('loading-title');
    els.errorCopy = $('error-copy');
    els.successTitle = $('success-title');
    els.results = $('results');
    els.failed = $('failed');
    els.resultImages = $('result-images');

    $('photo-input').addEventListener('change', onPick);
    $('solve-form').addEventListener('submit', function (e) {
      e.preventDefault();
      submit();
    });
    $('retry-btn').addEventListener('click', function () {
      submit();
    });
    $('offline-retry-btn').addEventListener('click', function () {
      submit();
    });
    els.cancelBtn.addEventListener('click', function () {
      if (controller) controller.abort();
    });

    setState('empty');
  }

  function boot() {
    els.region = $('state-region');
    machine = global.AIUI.createStateMachine(els.region, STATES, { render: renderState });
    init();
  }

  // 供 jsdom 验收驱动（浏览器里同样可调试）
  global.PhotoSolve = {
    STATES: STATES,
    setState: setState,
    submit: submit,
    saveToWrongBook: saveToWrongBook,
    setFiles: function (list) {
      files = list;
      renderThumbs();
    },
    getState: function () {
      return machine.get();
    },
  };

  if (global.document.readyState === 'loading') {
    global.document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window);
