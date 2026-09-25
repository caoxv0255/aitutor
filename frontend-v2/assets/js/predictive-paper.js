/* ==========================================================================
 * 预测卷（批次 4 · 第 6 页）
 *
 * 规格出处：
 *   - PM-BRIEF B.3:182    「高考真题预测 + 命题依据 / 80 分圆环 + 10 题」
 *   - PM-BRIEF F.16.7:788 布局（得分圆环 / 闭环 banner / 10 题 grid / 命题依据行）
 *   - PM-BRIEF F.2:361-374 PredictedQuestion 契约（source_provenance 命题依据）
 *   - PM-BRIEF F.13:557   中考区显示"中考冲刺卷"、隐藏高考入口
 *   - SPEC-ROUTES:59      依赖 GET /api/exam/papers、POST /api/exam/pdf/generate
 *
 * 实际可用接口（api/modules/exam/routes.js）：
 *   GET  /api/exam/papers?subject=&limit=  → data:[{id,title,year,province_name,
 *         subject,exam_level,paper_type_label,question_count,total_score,difficulty_avg}]
 *   GET  /api/exam/questions/:paperId      → { paper, data:[{question_number,
 *         question_type,stem,options,answer,analysis,knowledge_points,difficulty,score}] }
 *   POST /api/exam/pdf/generate/:paperId   → 二进制 PDF 流（inline Content-Disposition）
 *
 * ⚠️ 缺接口不伪造：PM §F.2 的 /api/predicted-paper/{id}（AI 组卷 + source_provenance
 *    命题依据 + 80 分得分圆环 + "今天已完成"空态）后端不存在，页面以说明态登记，
 *    命题依据行渲染题库实有字段（年份/省份/题型/难度/考点）。
 * ⚠️ SPEC-ROUTES:59 写的 POST /api/exam/pdf/generate 实际路由带 :paperId
 *    （routes.js:333），按实际路由调用。
 * ⚠️ PDF 是二进制流，统一数据层（AIAPI.request）只解 JSON 无法承载，
 *    此处是唯一例外：直接 fetch 携带 AIAPI.getToken() 的 Bearer 头取 blob。
 *
 * 学科清单来自共享数据源 global.AISubjects（9 科）。
 * ========================================================================== */
/* global window */
(function (global) {
  'use strict';

  const STATES = ['empty', 'loading', 'success', 'error', 'auth', 'offline'];

  const TYPE_LABELS = {
    '单选': '单选题',
    '单选题': '单选题',
    '多选': '多选题',
    '多选题': '多选题',
    '填空': '填空题',
    '填空题': '填空题',
    '解答': '解答题',
    '解答题': '解答题',
    'choice': '选择题',
    'fill': '填空题',
    'solution': '解答题',
  };

  const els = {};
  let machine = null;
  let papers = [];
  let currentPaper = null;
  let exporting = false;

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
  }

  /* ── 渲染：试卷列表 ─────────────────────────────────────────────────── */
  function renderPapers() {
    els.paperList.innerHTML = '';
    els.paperView.hidden = true;
    currentPaper = null;

    papers.forEach(function (p) {
      const row = global.AIUI.el('div', 'task-row paper-row');
      const main = global.AIUI.el('div');
      main.appendChild(global.AIUI.el('div', 'task-name', p.title || p.name || '未命名试卷'));
      const chips = global.AIUI.el('div', 'chip-row');
      [
        p.paper_type_label,
        p.province_name,
        p.year ? p.year + '年' : '',
        p.question_count != null ? p.question_count + ' 题' : '',
        p.total_score != null ? '满分 ' + p.total_score : '',
        p.difficulty_avg != null ? '均难度 ' + p.difficulty_avg : '',
      ].forEach(function (label) {
        if (label !== '' && label != null) chips.appendChild(global.AIUI.el('span', 'chip', String(label)));
      });
      main.appendChild(chips);
      row.appendChild(main);

      const open = global.AIUI.el('button', 'btn btn-ghost', '查看试卷');
      open.type = 'button';
      open.addEventListener('click', function () {
        openPaper(p.id);
      });
      row.appendChild(open);
      els.paperList.appendChild(row);
    });
  }

  /* ── 渲染：整卷视图 ─────────────────────────────────────────────────── */
  function optionList(raw) {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw.map(String);
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      /* 非 JSON，按行拆 */
    }
    return String(raw).split(/\r?\n/).filter(Boolean);
  }

  function renderQuestions(questions) {
    els.questionList.innerHTML = '';
    (questions || []).forEach(function (q) {
      const card = global.AIUI.el('div', 'q-card');

      const head = global.AIUI.el('div', 'q-head');
      head.appendChild(global.AIUI.el('span', 'q-index', '#' + (q.question_number != null ? q.question_number : '?')));
      const type = TYPE_LABELS[q.question_type] || q.question_type || '';
      if (type) head.appendChild(global.AIUI.el('span', 'chip', type));
      if (q.difficulty != null) head.appendChild(global.AIUI.el('span', 'chip', '难度 ' + q.difficulty));
      if (q.score != null) head.appendChild(global.AIUI.el('span', 'chip', q.score + ' 分'));
      card.appendChild(head);

      // 题库题面含 ⟦IMG/F/TABLE/OMML⟧ 占位符 → 共享渲染（图片/公式/占位），不直出 token
      const body = global.AIUI.el('p', 'q-body');
      global.QBRender.renderInto(body, q.stem || '', q.media);
      card.appendChild(body);

      const options = optionList(q.options);
      if (options.length) {
        const list = global.AIUI.el('div', 'q-options');
        options.forEach(function (opt) {
          list.appendChild(global.AIUI.el('span', null, opt));
        });
        card.appendChild(list);
      }

      // 命题依据 meta 行（PM §S2）：题库实有字段，命中逻辑等引擎补
      const prov = global.AIUI.el('p', 'q-prov');
      const bits = [];
      if (currentPaper) {
        if (currentPaper.year) bits.push('来源 ' + currentPaper.year + '年' + (currentPaper.province_name || '') + '卷');
        if (q.knowledge_points) bits.push('考点 ' + q.knowledge_points);
      }
      bits.push('命中逻辑：predicted-paper 引擎未接入');
      prov.textContent = '命题依据 · ' + bits.join(' · ');
      card.appendChild(prov);

      if (q.answer || q.analysis) {
        const toggle = global.AIUI.el('button', 'btn btn-ghost ans-toggle', '查看答案与解析');
        toggle.type = 'button';
        const ansBlock = global.AIUI.el('div', 'q-analysis ans-block');
        ansBlock.hidden = true;
        if (q.answer) ansBlock.appendChild(global.AIUI.el('p', null, '【答案】' + q.answer));
        if (q.analysis) ansBlock.appendChild(global.AIUI.el('p', null, '【解析】' + q.analysis));
        toggle.addEventListener('click', function () {
          ansBlock.hidden = !ansBlock.hidden;
          toggle.textContent = ansBlock.hidden ? '查看答案与解析' : '收起答案与解析';
        });
        card.appendChild(toggle);
        card.appendChild(ansBlock);
      }

      els.questionList.appendChild(card);
    });
  }

  /* ── 取数 ───────────────────────────────────────────────────────────── */
  function load() {
    if (global.navigator && global.navigator.onLine === false) {
      return global.Promise.resolve(setState('offline'));
    }
    if (!global.AIAPI.getToken()) return global.Promise.resolve(setState('auth'));

    setState('loading');

    const subject = els.subjectFilter.value || '';
    const q = '/api/exam/papers?limit=20' + (subject ? '&subject=' + global.encodeURIComponent(subject) : '');
    return global.AIAPI.request(q)
      .then(function (data) {
        papers = (data && (data.data || data)) || [];
        if (!Array.isArray(papers)) papers = [];
        if (!papers.length) {
          setState('empty');
          return 'empty';
        }
        renderPapers();
        setState('success');
        return 'success';
      })
      .catch(function (err) {
        const mapped = global.AIUI.mapError(err);
        if (mapped !== 'error') return setState(mapped);
        return setState('error', { message: (err && err.message) || '获取试卷列表失败' });
      });
  }

  function openPaper(paperId) {
    setPaperError('');
    return global.AIAPI.request('/api/exam/questions/' + global.encodeURIComponent(paperId))
      .then(function (payload) {
        const paper = (payload && payload.paper) || papers.find(function (p) { return String(p.id) === String(paperId); }) || {};
        const questions = (payload && payload.data) || [];
        currentPaper = paper;
        els.paperTitle.textContent = paper.title || paper.name || '试卷';
        els.paperEyebrow.textContent = (paper.exam_level === 'zhongkao' ? 'ZHONGKAO PAPER' : 'GAOKAO PAPER');
        els.paperMeta.innerHTML = '';
        [
          paper.paper_type_label,
          paper.province_name,
          paper.year ? paper.year + '年' : '',
          paper.question_count != null ? paper.question_count + ' 题' : '',
          paper.total_score != null ? '满分 ' + paper.total_score : '',
        ].forEach(function (label) {
          if (label !== '' && label != null) els.paperMeta.appendChild(global.AIUI.el('span', 'chip', String(label)));
        });
        renderQuestions(questions);
        els.paperView.hidden = false;
        els.paperView.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return 'opened';
      })
      .catch(function (err) {
        setPaperError((err && err.message) || '试卷题目读取失败');
        return 'error';
      });
  }

  /**
   * 导出 PDF：二进制响应，走统一数据层之外的一次直连（携带统一 Bearer）。
   * 拿到 blob 后开新标签页预览 / 下载。
   */
  function exportPdf() {
    if (!currentPaper || exporting) return global.Promise.resolve('busy');
    exporting = true;
    els.pdfBtn.disabled = true;
    els.pdfHint.textContent = '正在生成…';

    const token = global.AIAPI.getToken();
    const headers = token ? { Authorization: 'Bearer ' + token } : {};
    return global
      .fetch('/api/exam/pdf/generate/' + global.encodeURIComponent(currentPaper.id), { method: 'POST', headers: headers })
      .then(function (res) {
        if (!res.ok) throw global.AIAPI.ApiError('PDF 生成失败（HTTP ' + res.status + '）', { status: res.status });
        return res.blob();
      })
      .then(function (blob) {
        const url = global.URL.createObjectURL(blob);
        if (typeof global.window.open === 'function') global.window.open(url, '_blank');
        els.pdfHint.textContent = '已在新标签页打开，如被拦截请允许弹窗。';
        global.setTimeout(function () {
          global.URL.revokeObjectURL(url);
        }, 60000);
        return 'opened';
      })
      .catch(function (err) {
        els.pdfHint.textContent = (err && err.message) || 'PDF 生成失败，请稍后再试。';
        return 'error';
      })
      .then(function (outcome) {
        exporting = false;
        els.pdfBtn.disabled = false;
        return outcome;
      });
  }

  function setPaperError(message) {
    if (!message) {
      els.paperError.hidden = true;
      els.paperError.textContent = '';
      return;
    }
    els.paperError.textContent = message;
    els.paperError.hidden = false;
  }

  /* ── boot ───────────────────────────────────────────────────────────── */
  function boot() {
    els.region = $('state-region');
    els.subjectFilter = $('subject-filter');
    els.paperList = $('paper-list');
    els.paperView = $('paper-view');
    els.paperTitle = $('paper-title');
    els.paperEyebrow = $('paper-eyebrow');
    els.paperMeta = $('paper-meta');
    els.questionList = $('question-list');
    els.paperError = $('paper-error');
    els.pdfBtn = $('pdf-btn');
    els.pdfHint = $('pdf-hint');
    els.errorCopy = $('error-copy');

    machine = global.AIUI.createStateMachine(els.region, STATES, { render: renderState });

    // 学科筛选来自 AISubjects（9 科），前置「全部」
    global.AISubjects.fillSelect(els.subjectFilter, { includeAll: true });
    els.subjectFilter.addEventListener('change', function () {
      load();
    });

    els.pdfBtn.addEventListener('click', function () {
      exportPdf();
    });
    $('paper-close-btn').addEventListener('click', function () {
      els.paperView.hidden = true;
      currentPaper = null;
    });
    $('retry-btn').addEventListener('click', function () {
      load();
    });
    $('offline-retry-btn').addEventListener('click', function () {
      load();
    });

    setState('empty');
    load();
  }

  global.PredictivePaper = {
    STATES: STATES,
    TYPE_LABELS: TYPE_LABELS,
    load: load,
    openPaper: openPaper,
    exportPdf: exportPdf,
    setState: setState,
    getState: function () {
      return machine.get();
    },
    data: {
      get papers() {
        return papers;
      },
      get currentPaper() {
        return currentPaper;
      },
    },
  };

  if (global.document.readyState === 'loading') {
    global.document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window);
