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
      // 空态文案两类（以后端 batch-parse 实际返回的字段为据，不编字段）：
      //   - no-image   ：还没选图（submit 前置拦截）→ 引导添加
      //   - zero-result：OCR 已跑完但 questions 为空 → 「未解析出题目」→ 引导换图
      //
      // 第三类「解析成功但无相似题」不在这里：它属于解析成功态，由下方
      // similar-by-text 的相似题区按后端 similarNotice 原文展示（见 renderSimilar），
      // 与「没解析出题」是两回事，不混进 empty 面板。
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

  /* ── 题库占位符 token（P4 多模态读端，2026-09-25） ─────────────────────
   * 题库题面里结构化内容被替换成占位符：⟦IMG:rIdN⟧(图片) / ⟦F:rIdN⟧(公式)。
   * 后端随题下发 media[]（见 api/services/questionTables.js 的
   * enrichQuestionsWithMedia），本页只按 token 取资产、不解析 rId。
   * 安全：仍只走 DOM API（createElement/createTextNode/appendChild），图片是受控
   * <img src>（src 来自后端 media[].url，非用户输入），**不引入 innerHTML**。
   * 降级：取不到资产 → 「图片暂缺」/「公式暂缺」占位，绝不把裸 token 显示给用户。
   * ──────────────────────────────────────────────────────────────────────── */
  function findMedia(media, token) {
    if (!Array.isArray(media)) return null;
    for (let i = 0; i < media.length; i++) {
      if (media[i] && media[i].token === token) return media[i];
    }
    return null;
  }

  function renderMediaToken(target, kind, rid, media) {
    const rec = findMedia(media, kind + ':' + rid);
    // 可渲染资产优先；wmf/emf 已在后端映射为 png_rel（ext 已被置为 .png）
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
    const ph = global.document.createElement('span');
    ph.className = 'q-media-missing';
    ph.textContent = kind === 'IMG' ? '图片暂缺' : '公式暂缺';
    target.appendChild(ph);
  }

  /** 文本 + $行内$ + $$独立$$ + ⟦IMG/F⟧ token 混排：公式段走 KaTeX，token 走资产，其余纯文本 */
  function renderMixed(target, text, media) {
    const src = String(text || '');
    const re = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$|⟦(IMG|F):([^⟧]+)⟧/g;
    let last = 0;
    let m;
    while ((m = re.exec(src)) !== null) {
      if (m.index > last) {
        target.appendChild(global.document.createTextNode(src.slice(last, m.index)));
      }
      if (m[3]) {
        renderMediaToken(target, m[3], m[4], media);
      } else {
        renderFormula(target, m[0]);
      }
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

  /* ── 相似题（解析成功后按题干文本检索） ──────────────────────────────────
   * 纯检索端点 /api/vision/similar-by-text：只做「文本 → pgvector cosine」，
   * 不重传图片、不跑 OCR / LLM。此前若要相似题只能走 /api/vision/search，
   * 会二次 OCR + 两段 LLM，本页因此一直没接相似题。
   *
   * 三类空态各自可区分，不互相冒充：
   *   - no-image   ：还没选图（submit 前置拦截）→ empty 面板
   *   - zero-result：OCR 跑完 questions 为空 → empty 面板
   *   - no-similar ：解析成功、题干也拿到了，但后端阈值内无题 / 向量服务不可用
   *                  → 本区展示后端 similarNotice 原文（不编造）
   *
   * HTML 不在本切片可改范围，容器由脚本创建；复用同页既有类（.results/.q-card/
   * .tag/.q-body/.q-analysis），不写内联样式，也不改 system.css。
   * ──────────────────────────────────────────────────────────────────────── */
  function buildSimilarRegion() {
    const card =
      (els.results && els.results.closest && els.results.closest('.state-card')) || els.region;

    const box = global.document.createElement('section');
    box.id = 'similar-questions';
    box.className = 'similar-questions';
    box.hidden = true;

    const title = global.document.createElement('h3');
    title.className = 'similar-title';
    title.textContent = '相似题';

    const list = global.document.createElement('ul');
    list.id = 'similar-list';
    list.className = 'results';

    const notice = global.document.createElement('p');
    notice.id = 'similar-notice';
    notice.className = 'similar-notice';
    notice.hidden = true;

    box.appendChild(title);
    box.appendChild(list);
    box.appendChild(notice);
    card.appendChild(box);

    els.similarBox = box;
    els.similarList = list;
    els.similarNotice = notice;
  }

  function resetSimilar() {
    if (!els.similarBox) return;
    // 静态清空（'' 为字面量，不携带动态内容）
    els.similarList.innerHTML = '';
    els.similarNotice.textContent = '';
    els.similarNotice.hidden = true;
    els.similarBox.hidden = true;
  }

  function showSimilarNotice(text) {
    els.similarList.innerHTML = '';
    els.similarNotice.textContent = text;
    els.similarNotice.hidden = false;
    els.similarBox.hidden = false;
  }

  function renderSimilar(data) {
    const list = (data && data.similarQuestions) || [];
    if (!list.length) {
      // 诚实空态：文案一律取后端 similarNotice 原文，不编造"没有相似题"的原因
      showSimilarNotice((data && data.similarNotice) || '题库中暂未找到相似题。');
      return;
    }

    els.similarList.innerHTML = '';
    els.similarNotice.hidden = true;

    list.forEach(function (q, i) {
      const li = global.document.createElement('li');
      li.className = 'q-card';

      const head = global.document.createElement('div');
      head.className = 'q-head';

      const idx = global.document.createElement('span');
      idx.className = 'q-index';
      idx.textContent = i + 1;
      head.appendChild(idx);

      const tags = [
        q.subject_code || '',
        q.difficulty ? '难度 ' + q.difficulty : '',
        typeof q.similarity === 'number' ? '相似度 ' + Math.round(q.similarity * 100) + '%' : '',
        q.question_type || '',
      ].filter(Boolean);
      tags.forEach(function (t) {
        const tag = global.document.createElement('span');
        tag.className = 'tag';
        tag.textContent = t;
        head.appendChild(tag);
      });

      const body = global.document.createElement('p');
      body.className = 'q-body';
      renderMixed(body, q.content || q.stem || '（无题干）', q.media);

      li.appendChild(head);
      li.appendChild(body);

      if (q.answer) {
        const ans = global.document.createElement('p');
        ans.className = 'q-analysis';
        renderMixed(ans, '答案：' + q.answer, q.media);
        li.appendChild(ans);
      }

      els.similarList.appendChild(li);
    });

    els.similarBox.hidden = false;
  }

  /**
   * 解析成功后取首题题干查相似题。失败只降级相似题区，不改动主成功态：
   *   - 未登录/离线（401/403/网络）→ 隐藏相似题区，如实降级
   *   - 其余错误 → 给一句如实的失败提示（不伪造相似题）
   */
  function loadSimilar(text, subject) {
    resetSimilar();
    if (!text) return global.Promise.resolve();
    return global.AIAPI.similarByText(text, subject ? { subject: subject } : undefined)
      .then(function (data) {
        renderSimilar(data);
      })
      .catch(function (err) {
        const mapped = global.AIUI.mapError(err);
        if (mapped === 'auth' || mapped === 'offline') {
          resetSimilar();
          return;
        }
        showSimilarNotice('相似题暂时取不到，稍后可再试。');
      });
  }

  /* ── 存错题本 ───────────────────────────────────────────────────────── */
  /**
   * 未关联知识点时，在后端"已存入"回执旁追加一条可见提示（复用 .tag 样式，不改 CSS）。
   * 后端以 knowledge_point_missing 显式回告 —— 此前是静默落 NULL，用户以为存好了，
   * 直到复习时报"未关联知识点"才发现。
   */
  function showKpMissingNote(btn, text) {
    if (!btn || !btn.parentNode) return;
    const note = global.document.createElement('span');
    note.className = 'tag';
    note.textContent = text;
    btn.parentNode.appendChild(note);
  }

  function saveToWrongBook(q, btn) {
    const payload = {
      content: itemContent(q),
      subject_code: q.subject_code || q.subject || els.subject.value,
      difficulty: q.difficulty || null,
      question_type: q.question_type || null,
      // 解析结果可能只有 inferred_kp_*（未经校验的推断名），一并兜底，避免有名字却丢成 NULL
      knowledge_point_id: q.knowledge_point_id || q.inferred_kp_id || null,
      knowledge_point_name: q.knowledge_point_name || q.inferred_kp_name || null,
      error_analysis: q.analysis || q.error_analysis || null,
    };

    btn.disabled = true;
    btn.textContent = '存入中…';

    return global.AIAPI.addWrongQuestion(payload)
      .then(function (data) {
        btn.textContent = '已存入';
        btn.disabled = true;
        if (data && data.knowledge_point_missing) {
          showKpMissingNote(btn, '未识别到知识点，暂不会进入复习队列；请到错题本补充知识点。');
        }
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
        const questions = (data && data.questions) || [];
        if (!questions.length) {
          return setState('empty', { reason: 'zero-result' });
        }
        resetSimilar();
        renderResults(data);
        setState('success', {
          successCount: data.success_count || questions.length,
          failedCount: data.failed_count || (data.failed || []).length,
        });
        // 相似题是增强信息：单独检索，失败也不回退主成功态
        const first = questions[0];
        return loadSimilar(
          itemContent(first),
          first.subject_code || first.subject || els.subject.value
        );
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

    // 学科下拉统一到 9 科（单一数据源 subjects.js）。
    // 必须显式 selected:'math'：PM-BRIEF 新顺序语文排第一，不指定的话默认学科会静默变成语文。
    global.AISubjects.fillSelect(els.subject, { selected: 'math' });

    els.parseBtn = $('parse-btn');
    els.cancelBtn = $('cancel-btn');
    els.emptyCopy = $('empty-copy');
    els.loadingTitle = $('loading-title');
    els.errorCopy = $('error-copy');
    els.successTitle = $('success-title');
    els.results = $('results');
    els.failed = $('failed');
    els.resultImages = $('result-images');

    buildSimilarRegion();

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
