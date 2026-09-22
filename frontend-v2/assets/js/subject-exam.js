/* ==========================================================================
 * 学科卷模板（批次 4 · 第 9 页）
 *
 * 规格出处：
 *   - SPEC-ROUTES:73       「模板化（12 → 1）：math/physics/chemistry/chinese/
 *                           english/politics-exam + -report → 1 模板 + 学科参数」
 *   - PLAN-v2-migration:104 「subject-exam 模板（1 份承载 6 学科），取代 F3 的
 *                           6 学科 exam + report 共 12 页」
 *   - 参数化约定沿用 PM-BRIEF B.3:179 的 query-param 风格（subject-detail?subject=math
 *     同款）：subject-exam.html?subject=<code>。学科清单来自 global.AISubjects
 *     （9 科），未知参数不伪造数据，落空态 + 说明。
 *
 * 实际可用接口（api/modules/exam）：
 *   GET /api/exam/papers?subject=&limit=
 *       → data:[{id,title,year,province_name,paper_type_label,question_count,
 *                 total_score,difficulty_avg}]
 *   GET /api/exam/questions/:paperId
 *       → { paper, data:[{question_number,question_type,stem,options,answer,
 *                         analysis,knowledge_points,difficulty,score}] }
 *   GET /api/exam/session/history?limit=&offset=
 *       → data:[{id,subject,accuracy,score,total_score,correct_count,
 *                question_count,status,started_at,completed_at}]
 *         （exam_sessions 表带 subject 列 → 模板按当前学科在客户端过滤，
 *           后端 history 端点本身不支持 subject 参数）
 *
 * 说明：模板只参数化学科；年份 / 省份 / 试卷类型沿用接口返回值原样渲染。
 * ========================================================================== */
/* global window */
(function (global) {
  'use strict';

  const STATES = ['empty', 'loading', 'success', 'error', 'auth', 'offline'];
  const TABS = ['paper', 'report'];

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
  let subject = 'math';
  let papers = [];

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
    if (name === 'empty' && ctx && ctx.reason === 'invalid-subject') {
      els.emptyTitle.textContent = '未知学科参数';
      els.emptyCopy.textContent = '模板只接受 9 学科代码（?subject=）。';
      els.emptyNote.hidden = false;
      els.emptyNoteCopy.textContent =
        '收到：' + (ctx.received || '（空）') +
        '。可用取值：' + global.AISubjects.LIST.map(function (s) { return s.code; }).join(' / ') + '。';
    } else {
      els.emptyNote.hidden = true;
      if (name === 'empty') {
        els.emptyTitle.textContent = (ctx && ctx.title) || '没有可展示的内容';
        els.emptyCopy.textContent = (ctx && ctx.copy) || '该学科暂无试卷或练习记录。';
      }
    }
  }

  /* ── tabs ───────────────────────────────────────────────────────────── */
  function switchTab(name) {
    TABS.forEach(function (t) {
      const panel = $('tab-' + t);
      if (panel) panel.hidden = t !== name;
    });
    els.examTabs.querySelectorAll('.tab').forEach(function (btn) {
      btn.classList.toggle('tab--on', btn.getAttribute('data-tab') === name);
    });
    return name;
  }

  /* ── 渲染：试卷列表 ─────────────────────────────────────────────────── */
  function renderPapers() {
    els.paperList.innerHTML = '';
    els.paperView.hidden = true;

    if (!papers.length) {
      els.paperList.appendChild(global.AIUI.el('p', 'form-hint', '该学科暂无试卷。'));
      return;
    }
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
      ].forEach(function (label) {
        if (label !== '' && label != null) chips.appendChild(global.AIUI.el('span', 'chip', String(label)));
      });
      main.appendChild(chips);
      row.appendChild(main);

      const open = global.AIUI.el('button', 'btn btn-ghost', '打开整卷');
      open.type = 'button';
      open.addEventListener('click', function () {
        openPaper(p.id);
      });
      row.appendChild(open);
      els.paperList.appendChild(row);
    });
  }

  /* ── 渲染：整卷 ─────────────────────────────────────────────────────── */
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
    let lastType = null;
    (questions || []).forEach(function (q) {
      const typeLabel = TYPE_LABELS[q.question_type] || q.question_type || '';
      if (typeLabel && typeLabel !== lastType) {
        els.questionList.appendChild(global.AIUI.el('div', 'section-title', typeLabel));
        lastType = typeLabel;
      }

      const card = global.AIUI.el('div', 'q-card');
      const head = global.AIUI.el('div', 'q-head');
      head.appendChild(global.AIUI.el('span', 'q-index', '#' + (q.question_number != null ? q.question_number : '?')));
      if (q.difficulty != null) head.appendChild(global.AIUI.el('span', 'chip', '难度 ' + q.difficulty));
      if (q.score != null) head.appendChild(global.AIUI.el('span', 'chip', q.score + ' 分'));
      card.appendChild(head);

      card.appendChild(global.AIUI.el('p', 'q-body', q.stem || ''));

      const options = optionList(q.options);
      if (options.length) {
        const list = global.AIUI.el('div', 'q-options');
        options.forEach(function (opt) {
          list.appendChild(global.AIUI.el('span', null, opt));
        });
        card.appendChild(list);
      }

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

  function openPaper(paperId) {
    setPaperError('');
    return global.AIAPI.request('/api/exam/questions/' + global.encodeURIComponent(paperId))
      .then(function (payload) {
        const paper = (payload && payload.paper) || papers.find(function (p) { return String(p.id) === String(paperId); }) || {};
        els.paperTitle.textContent = paper.title || paper.name || '试卷';
        els.paperEyebrow.textContent = 'PAPER · ' + global.AISubjects.name(subject);
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
        renderQuestions((payload && payload.data) || []);
        els.paperView.hidden = false;
        els.paperView.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return 'opened';
      })
      .catch(function (err) {
        setPaperError((err && err.message) || '试卷题目读取失败');
        return 'error';
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

  /* ── 渲染：练习报告 ─────────────────────────────────────────────────── */
  function renderReports(payload) {
    els.reportList.innerHTML = '';
    const rows = (payload && (payload.data || payload)) || [];
    const mine = (Array.isArray(rows) ? rows : []).filter(function (r) {
      return r && r.subject === subject;
    });

    if (!mine.length) {
      els.reportList.appendChild(
        global.AIUI.el('p', 'form-hint', '暂无' + global.AISubjects.name(subject) + '的练习记录，先去练一组。')
      );
      return;
    }
    mine.slice(0, 20).forEach(function (r) {
      const row = global.AIUI.el('div', 'task-row');
      const main = global.AIUI.el('div');
      const when = r.completed_at || r.started_at || '';
      main.appendChild(
        global.AIUI.el(
          'div',
          'task-name',
          (when ? String(when).slice(0, 10) + ' · ' : '') +
            (r.correct_count != null && r.question_count ? '答对 ' + r.correct_count + '/' + r.question_count : '练习会话')
        )
      );
      const sub = [
        r.score != null && r.total_score ? '得分 ' + r.score + '/' + r.total_score : '',
        r.accuracy != null ? '正确率 ' + r.accuracy + '%' : '',
        r.status || '',
      ]
        .filter(Boolean)
        .join(' · ');
      main.appendChild(global.AIUI.el('span', 'topic-sub', sub));
      row.appendChild(main);
      els.reportList.appendChild(row);
    });
  }

  /* ── 取数 ───────────────────────────────────────────────────────────── */
  function load() {
    if (global.navigator && global.navigator.onLine === false) {
      return global.Promise.resolve(setState('offline'));
    }
    if (!global.AIAPI.getToken()) return global.Promise.resolve(setState('auth'));

    setState('loading');

    const s = global.encodeURIComponent(subject);
    const papersReq = global.AIAPI.request('/api/exam/papers?limit=20&subject=' + s);
    const historyReq = global.AIAPI.request('/api/exam/session/history?limit=50');

    return global.Promise.all([papersReq, historyReq])
      .then(function (all) {
        papers = (all[0] && (all[0].data || all[0])) || [];
        if (!Array.isArray(papers)) papers = [];

        renderPapers();
        renderReports(all[1]);

        els.examEyebrow.textContent = 'SUBJECT EXAM · ' + subject.toUpperCase();
        els.examTitle.textContent = global.AISubjects.name(subject) + '卷';

        if (!papers.length) {
          setState('empty', { title: '暂无试卷', copy: '该学科暂无可用试卷，先去练习积累。' });
          return 'empty';
        }

        switchTab('paper');
        setState('success');
        return 'success';
      })
      .catch(function (err) {
        const mapped = global.AIUI.mapError(err);
        if (mapped !== 'error') return setState(mapped);
        return setState('error', { message: (err && err.message) || '获取学科卷失败' });
      });
  }

  /* ── boot ───────────────────────────────────────────────────────────── */
  function boot() {
    els.region = $('state-region');
    els.examEyebrow = $('exam-eyebrow');
    els.examTitle = $('exam-title');
    els.examTabs = $('exam-tabs');
    els.subjectSelect = $('subject-select');
    els.paperList = $('paper-list');
    els.paperView = $('paper-view');
    els.paperEyebrow = $('paper-eyebrow');
    els.paperTitle = $('paper-title');
    els.paperMeta = $('paper-meta');
    els.paperError = $('paper-error');
    els.questionList = $('question-list');
    els.reportList = $('report-list');
    els.emptyTitle = $('empty-title');
    els.emptyCopy = $('empty-copy');
    els.emptyNote = $('empty-note');
    els.emptyNoteCopy = $('empty-note-copy');
    els.errorCopy = $('error-copy');

    machine = global.AIUI.createStateMachine(els.region, STATES, { render: renderState });

    // 模板参数：?subject=<code>（9 科白名单，未知 → 空态说明，不伪造）
    const param = new global.URLSearchParams(global.location.search).get('subject');
    if (param && global.AISubjects.LIST.some(function (s) { return s.code === param; })) {
      subject = param;
    } else {
      setState('empty', { reason: 'invalid-subject', received: param || '' });
      // 未知参数不继续取数：白名单外没有可展示的学科视图
      bindStatic();
      return;
    }

    global.AISubjects.fillSelect(els.subjectSelect, { selected: subject });
    els.subjectSelect.value = subject;
    els.subjectSelect.addEventListener('change', function () {
      subject = els.subjectSelect.value;
      const url = new global.URL(global.location.href);
      url.searchParams.set('subject', subject);
      global.history.replaceState(null, '', url.pathname + '?' + url.searchParams.toString());
      load();
    });

    bindStatic();
    setState('empty');
    load();
  }

  function bindStatic() {
    els.examTabs.addEventListener('click', function (ev) {
      const btn = ev.target.closest('.tab');
      if (btn) switchTab(btn.getAttribute('data-tab'));
    });
    $('paper-close-btn').addEventListener('click', function () {
      els.paperView.hidden = true;
    });
    $('retry-btn').addEventListener('click', function () {
      load();
    });
    $('offline-retry-btn').addEventListener('click', function () {
      load();
    });
  }

  global.SubjectExam = {
    STATES: STATES,
    TABS: TABS,
    load: load,
    openPaper: openPaper,
    setState: setState,
    switchTab: switchTab,
    getState: function () {
      return machine.get();
    },
    data: {
      get subject() {
        return subject;
      },
      get papers() {
        return papers;
      },
    },
  };

  if (global.document.readyState === 'loading') {
    global.document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window);
