/* ==========================================================================
 * 作文批改（批次 3 第三页）
 *
 * 链路（两步，不是文档里的三步 —— 见下）:
 *   1. POST /api/upload/image  { image: dataURL, purpose: 'essay' } → { url }（**相对路径**）
 *   2. POST /api/essay/grade   { images: [绝对URL], essay_title, exam_level, grade } → 报告
 *
 * ⚠️ 两个必须记住的坑：
 *   a) 上传返回的是相对 URL（/uploads/...），而 grade 的 images 要交给 LLM 抓取，
 *      必须是绝对地址 —— 必须 resolveUploadUrl() 转一次。漏了会得到一个
 *      模型侧抓不到图的静默失败。
 *   b) /api/essay/transcribe 尚未注册（server.js:451「待 Phase 1 单测通过后注册」），
 *      所以现在是「上传 → 单次 LLM 批改」；F3 服务层文档里的三步链路对今天不成立。
 *      已记为 SPEC-DATA G7。
 *
 * 长耗时：一次批改是一次完整 LLM 调用（30–60s）。loading 文案要按阶段推进，
 * 并做防重复提交 —— 重复提交会真的跑第二次模型调用（花钱 + 写重复报告）。
 * ========================================================================== */
/* global window, document */
(function (global) {
  'use strict';

  const STATES = ['empty', 'loading', 'success', 'error', 'auth', 'offline'];
  const MAX_IMAGES = 5;
  const MAX_BYTES = 10 * 1024 * 1024;

  const els = {};
  let machine = null;
  let files = [];
  let busy = false;

  function $(id) {
    return global.document.getElementById(id);
  }

  function setState(name, ctx) {
    return machine.set(name, ctx);
  }

  function renderState(name, ctx) {
    ctx = ctx || {};
    if (name === 'error' && els.errorCopy) {
      els.errorCopy.textContent = ctx.message || '服务暂时不可用。';
    }
    if (name === 'loading' && els.loadingTitle) {
      els.loadingTitle.textContent = ctx.title || '正在处理…';
    }
  }

  function toggleView(view) {
    els.viewSetup.hidden = view !== 'setup';
    els.viewResult.hidden = view !== 'result';
    setState('success');
  }

  /** 相对上传路径 → 绝对地址（LLM 要抓取，必须绝对） */
  function resolveUploadUrl(url) {
    if (!url) return url;
    try {
      return new global.URL(url, global.location.origin).href;
    } catch {
      return url;
    }
  }

  /* ── 选图 ───────────────────────────────────────────────────────────── */
  function renderThumbs() {
    els.thumbs.innerHTML = '';
    files.forEach(function (file, i) {
      const li = global.AIUI.el('li', 'thumb');
      const img = global.document.createElement('img');
      img.alt = `第 ${i + 1} 页作文照片`;
      img.src = global.URL.createObjectURL(file);
      const rm = global.document.createElement('button');
      rm.type = 'button';
      rm.setAttribute('aria-label', `移除第 ${i + 1} 张照片`);
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
    files = files
      .concat(
        picked.filter(function (f) {
          return f.size <= MAX_BYTES;
        })
      )
      .slice(0, MAX_IMAGES);
    renderThumbs();
    e.target.value = '';
  }

  function toBase64(file) {
    return new global.Promise(function (resolve, reject) {
      const reader = new global.FileReader();
      reader.onload = function () {
        resolve(String(reader.result));
      }; // 保留 data: 前缀，上传接口要求
      reader.onerror = function () {
        reject(new Error('读取图片失败'));
      };
      reader.readAsDataURL(file);
    });
  }

  /* ── 批改 ───────────────────────────────────────────────────────────── */
  function grade() {
    if (busy) return global.Promise.resolve('busy');
    if (!files.length) return global.Promise.resolve(setState('empty'));
    if (global.navigator && global.navigator.onLine === false) return global.Promise.resolve(setState('offline'));
    if (!global.AIAPI.getToken()) return global.Promise.resolve(setState('auth'));

    busy = true;
    els.gradeBtn.disabled = true;

    const fail = function (err) {
      busy = false;
      els.gradeBtn.disabled = false;
      const mapped = global.AIUI.mapError(err);
      if (mapped !== 'error') return setState(mapped);
      return setState('error', { message: (err && err.message) || '批改失败' });
    };

    setState('loading', { title: `正在上传 ${files.length} 张照片…` });

    return global.Promise.all(files.map(toBase64))
      .then(function (dataUrls) {
        // 逐张上传（后端单图接口），保留顺序
        return dataUrls.reduce(function (chain, dataUrl, i) {
          return chain.then(function (urls) {
            setState('loading', { title: `正在上传 ${i + 1} / ${dataUrls.length} 张…` });
            return global.AIAPI.uploadImage(dataUrl, 'essay').then(function (res) {
              return urls.concat([resolveUploadUrl(res && res.url)]);
            });
          });
        }, global.Promise.resolve([]));
      })
      .then(function (imageUrls) {
        setState('loading', { title: '正在批改，通常需要 30–60 秒…' });
        return global.AIAPI.gradeEssay({
          images: imageUrls,
          essay_title: (els.essayTitle.value || '').trim(),
          exam_level: els.examLevel.value,
          grade: els.gradeSelect.value,
        });
      })
      .then(function (res) {
        busy = false;
        els.gradeBtn.disabled = false;
        // 后端成功体形如 { success, data:{ meta, transcript, annotations, scores, summary }, reportId }
        const data = (res && res.data) || {};
        renderResult(data, (res && res.reportId) || data.meta?.report_id);
        loadHistory();
        return 'result';
      })
      .catch(fail);
  }

  /* ── 结果渲染 ───────────────────────────────────────────────────────── */
  function renderResult(data, reportId) {
    els.resultTitle.textContent = '批改结果';
    els.resultSub.textContent = reportId ? `报告编号 ${reportId}` : '';

    // 分项分数：后端 scores 形态为 { 维度: 分值 }
    els.scoreGrid.innerHTML = '';
    const scores = (data && data.scores) || {};
    const keys = Object.keys(scores);
    if (keys.length) {
      keys.forEach(function (k) {
        const cell = global.AIUI.el('div', 'score-cell');
        cell.appendChild(global.AIUI.el('b', null, String(scores[k])));
        cell.appendChild(global.AIUI.el('span', null, k));
        els.scoreGrid.appendChild(cell);
      });
    } else {
      els.scoreGrid.appendChild(global.AIUI.el('p', 'topic-sub', '本次未返回分项评分。'));
    }

    const summary = (data && (data.summary || (data.meta && data.meta.summary))) || '';
    els.summary.textContent = summary || '（无总评）';

    // 逐段批注：annotations 形态不保证统一 → 兼容 comment/note/text
    els.noteList.innerHTML = '';
    const notes = (data && data.annotations) || [];
    if (!notes.length) {
      els.noteList.appendChild(global.AIUI.el('p', 'topic-sub', '本次未返回逐段批注。'));
    } else {
      notes.forEach(function (n) {
        const item = global.AIUI.el('div', 'note-item');
        if (n && (n.dimension || n.type)) {
          item.appendChild(global.AIUI.el('span', 'note-tag', n.dimension || n.type));
        }
        const quote = (n && (n.quote || n.original || n.paragraph)) || '';
        if (quote) item.appendChild(global.AIUI.el('p', 'note-quote', String(quote)));
        const body = (n && (n.comment || n.note || n.text || n.suggestion)) || '';
        item.appendChild(global.AIUI.el('p', 'note-body', String(body || '（无批注内容）')));
        els.noteList.appendChild(item);
      });
    }

    toggleView('result');
  }

  /* ── 历史 ───────────────────────────────────────────────────────────── */
  function loadHistory() {
    return global.AIAPI.listEssays(5)
      .then(function (data) {
        const rows = (data && data.reports) || [];
        els.historyList.innerHTML = '';
        if (!rows.length) {
          els.historyList.appendChild(global.AIUI.el('p', 'topic-sub', '还没有批改记录。'));
          return;
        }
        rows.slice(0, 5).forEach(function (r) {
          const row = global.AIUI.el('div', 'task-row');
          const title = r.essay_title || r.title || '未命名作文';
          const date = String(r.created_at || r.graded_at || '').slice(0, 10);
          row.appendChild(global.AIUI.el('span', 'task-name', title + (date ? ' · ' + date : '')));
          const score = r.total_score ?? r.score ?? null;
          row.appendChild(global.AIUI.el('span', 'task-status', score === null ? '—' : String(score) + ' 分'));
          els.historyList.appendChild(row);
        });
      })
      .catch(function () {
        els.historyList.innerHTML = '';
        els.historyList.appendChild(global.AIUI.el('p', 'topic-sub', '历史记录暂时取不到。'));
      });
  }

  function boot2() {
    if (global.navigator && global.navigator.onLine === false) return setState('offline');
    if (!global.AIAPI.getToken()) return setState('auth');
    setState('loading', { title: '正在加载…' });
    return loadHistory().then(function () {
      toggleView('setup');
    });
  }

  /* ── 装配 ───────────────────────────────────────────────────────────── */
  function boot() {
    els.region = $('state-region');
    els.viewSetup = $('view-setup');
    els.viewResult = $('view-result');
    els.thumbs = $('thumbs');
    els.essayTitle = $('essay-title');
    els.examLevel = $('exam-level');
    els.gradeSelect = $('grade-select');
    els.gradeBtn = $('grade-btn');
    els.historyList = $('history-list');
    els.resultTitle = $('result-title');
    els.resultSub = $('result-sub');
    els.scoreGrid = $('score-grid');
    els.summary = $('summary');
    els.noteList = $('note-list');
    els.emptyCopy = $('empty-copy');
    els.errorCopy = $('error-copy');
    els.loadingTitle = $('loading-title');

    machine = global.AIUI.createStateMachine(els.region, STATES, { render: renderState });

    $('essay-input').addEventListener('change', onPick);
    els.gradeBtn.addEventListener('click', function () {
      grade();
    });
    $('again-btn').addEventListener('click', function () {
      files = [];
      renderThumbs();
      toggleView('setup');
    });
    $('empty-back-btn').addEventListener('click', function () {
      toggleView('setup');
    });
    $('retry-btn').addEventListener('click', function () {
      boot2();
    });
    $('offline-retry-btn').addEventListener('click', function () {
      grade();
    });

    boot2();
  }

  global.Essay = {
    STATES: STATES,
    grade: grade,
    resolveUploadUrl: resolveUploadUrl,
    setState: setState,
    setFiles: function (list) {
      files = list;
      renderThumbs();
    },
    getFilesSize: function () {
      return files.length;
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
