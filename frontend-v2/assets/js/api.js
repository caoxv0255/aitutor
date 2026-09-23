/* global window */
/* ==========================================================================
 * frontend-v2 统一数据层
 *
 * 页面不得直接 fetch —— 统一走这里，原因：
 *  1. 鉴权：Bearer token 从 localStorage 取，缺失即判定为未登录（401/403 态）
 *  2. 错误分类：网络失败与 HTTP 失败要落到不同状态（离线 vs 错误）
 *  3. 响应解包：后端统一 { success, data, message }
 * ========================================================================== */
(function (global) {
  'use strict';

  const TOKEN_KEY = 'authToken';

  function getToken() {
    try {
      return global.localStorage ? global.localStorage.getItem(TOKEN_KEY) : null;
    } catch {
      return null;
    }
  }

  /** 网络层失败（DNS/断网/CORS）→ offline；HTTP 失败 → error（带 status） */
  function ApiError(message, opts) {
    const err = new Error(message);
    err.name = 'ApiError';
    err.status = opts && opts.status;
    err.kind = (opts && opts.kind) || (err.status ? 'http' : 'network');
    err.payload = opts && opts.payload;
    return err;
  }

  function request(path, options) {
    options = options || {};
    const headers = { 'Content-Type': 'application/json' };
    const token = getToken();
    if (token) headers.Authorization = 'Bearer ' + token;

    const init = {
      method: options.method || 'GET',
      headers: headers,
      credentials: 'same-origin',
    };
    if (options.body !== undefined) init.body = JSON.stringify(options.body);
    if (options.signal) init.signal = options.signal;

    return global.fetch(path, init).then(
      function (res) {
        return res
          .json()
          .catch(function () {
            return null;
          })
          .then(function (payload) {
            if (!res.ok) {
              const msg = (payload && (payload.message || payload.error)) || '请求失败（HTTP ' + res.status + '）';
              throw ApiError(msg, { status: res.status, payload: payload });
            }
            return payload && payload.data !== undefined ? payload.data : payload;
          });
      },
      function (err) {
        // fetch 只在网络层 reject；AbortError 单独放行给调用方处理
        if (err && err.name === 'AbortError') throw err;
        throw ApiError('网络连接不可用', { kind: 'network' });
      }
    );
  }

  global.AIAPI = {
    getToken: getToken,
    request: request,
    ApiError: ApiError,

    /** 整卷/多图解析：POST /api/vision/batch-parse */
    batchParse: function (images, userHint, signal) {
      return request('/api/vision/batch-parse', {
        method: 'POST',
        body: { images: images, user_hint: userHint || {}, options: { concurrency: 3 } },
        signal: signal,
      });
    },

    /**
     * 按题干文本查相似题：POST /api/vision/similar-by-text
     * 入参 { text(必填, ≥10字), subject?, limit? }
     * → { similarQuestions[], similarNotice|null }
     *
     * 纯检索（embedding + pgvector），不跑 OCR / 不调 LLM —— 供 photo-solve
     * 在 batch-parse 拿到题干后单独取相似题，避免重传图片再跑一遍完整管线。
     * 空态由后端 similarNotice 说明（阈值内无题 / 向量服务不可用），前端不编造。
     */
    similarByText: function (text, options, signal) {
      const body = { text: text };
      if (options && options.subject) body.subject = options.subject;
      if (options && options.limit) body.limit = options.limit;
      return request('/api/vision/similar-by-text', {
        method: 'POST',
        body: body,
        signal: signal,
      });
    },

    /** 存入错题本：POST /api/user/wrong-questions */
    addWrongQuestion: function (payload, signal) {
      return request('/api/user/wrong-questions', {
        method: 'POST',
        body: payload,
        signal: signal,
      });
    },

    /* ── 认证 ─────────────────────────────────────────────────────────── */

    /** 登录：POST /api/auth/login → { token, user } */
    login: function (email, password, signal) {
      return request('/api/auth/login', { method: 'POST', body: { email: email, password: password }, signal: signal });
    },

    /** 注册：POST /api/auth/register → { token, user }（201） */
    register: function (payload, signal) {
      return request('/api/auth/register', { method: 'POST', body: payload, signal: signal });
    },

    /** 游客登录：POST /api/auth/guest-login → { token, user } */
    guestLogin: function (signal) {
      return request('/api/auth/guest-login', { method: 'POST', body: {}, signal: signal });
    },

    /** 当前用户：GET /api/auth/me */
    me: function (signal) {
      return request('/api/auth/me', { signal: signal });
    },

    /** 退出：POST /api/auth/logout（JWT 无状态，服务端只保证 200） */
    logout: function (signal) {
      return request('/api/auth/logout', { method: 'POST', body: {}, signal: signal });
    },

    /** 把登录结果落到本地（token 是唯一真相源，务必与 getToken 的键一致） */
    saveSession: function (data) {
      try {
        if (data && data.token) global.localStorage.setItem(TOKEN_KEY, data.token);
        if (data && data.user) global.localStorage.setItem('user', JSON.stringify(data.user));
      } catch {
        /* 隐私模式下 localStorage 可能不可用，静默降级 */
      }
      return data;
    },

    clearSession: function () {
      try {
        global.localStorage.removeItem(TOKEN_KEY);
        global.localStorage.removeItem('user');
      } catch {
        /* 同上 */
      }
    },

    /* ── SRS 复习（批次 2） ────────────────────────────────────────────── */

    /** 今日复习队列：GET /api/srs/engine/queue → { queue, total, generated_at } */
    srsQueue: function (limit, signal) {
      const q = limit ? '?limit=' + encodeURIComponent(limit) : '';
      return request('/api/srs/engine/queue' + q, { signal: signal });
    },

    /** 提交一组复习：POST /api/srs/engine/review { wrong_id, quality(0-5), time_spent_ms, group_results } */
    srsReview: function (payload, signal) {
      return request('/api/srs/engine/review', { method: 'POST', body: payload, signal: signal });
    },

    /** 复习统计：GET /api/srs/engine/stats → { total_reviews, today_reviews, due_count, active_days_30d } */
    srsStats: function (signal) {
      return request('/api/srs/engine/stats', { signal: signal });
    },

    /* ── 学习路径 ───────────────────────────────────────────────────────── */

    /**
     * 今日学习路径：GET /api/learning-path/current?subject=
     * → { subject, recommendation_reason, cited_stats:[{icon,label}],
     *     global_progress_pct(0..100), stages[4]:{id,name,status,description,progress_pct?},
     *     today_task:{id,title,reason,topic,target_url,…}|null,
     *     empty_state?:{scenario,title,description,primary_action,secondary_action} }
     *
     * ⚠️ 后端给的 target_url 用的是**第三套命名**（/photo-search.html、/review.html、
     * /onboarding.html），实测其中两个在生产 404、一个落到旧树页面。前端必须映射
     * （见 LEARNING_PATH_PAGE 的 URL_MAP），不得直接渲染 —— 见 SPEC-DATA G8。
     */
    learningPath: function (subject, signal) {
      const q = subject ? '?subject=' + encodeURIComponent(subject) : '';
      return request('/api/learning-path/current' + q, { signal: signal });
    },

    /* ── 作文批改（essay） ──────────────────────────────────────────────── */

    /**
     * 上传图片：POST /api/upload/image  { image: "data:image/...;base64,...", purpose }
     * → { url, filename, size, mime, purpose, width, height, uploaded_at }
     *
     * ⚠️ 返回的 url 是**相对路径**（/uploads/purpose/YYYY/MM/x.jpg）。
     * 而 /api/essay/grade 的 images 要交给 LLM 抓取，必须是绝对地址 ——
     * 调用方需用 new URL(url, location.origin).href 转换（见 resolveUploadUrl）。
     */
    uploadImage: function (dataUrl, purpose, signal) {
      return request('/api/upload/image', {
        method: 'POST',
        body: { image: dataUrl, purpose: purpose || 'general' },
        signal: signal,
      });
    },

    /**
     * 作文批改：POST /api/essay/grade
     * 入参 { images: [绝对URL], essay_title, exam_level: 'gaokao'|'zhongkao', grade: '初一'..'高三' }
     * → { meta, transcript:{paragraphs}, annotations[], scores, summary }（外层还有 reportId）
     *
     * 注意（SPEC-DATA G7）：链路里的 /api/essay/transcribe 尚未注册
     * （server.js:451 注明"待 Phase 1 单测通过后注册"），所以当前是
     * 「上传 → 单次 LLM 批改」两步，不是文档里的三步。
     */
    gradeEssay: function (payload, signal) {
      return request('/api/essay/grade', { method: 'POST', body: payload, signal: signal });
    },

    /** 作文报告列表：GET /api/essay?limit → { reports[] } */
    listEssays: function (limit, signal) {
      const q = limit ? '?limit=' + encodeURIComponent(limit) : '';
      return request('/api/essay' + q, { signal: signal });
    },

    /** 作文报告详情：GET /api/essay/:id */
    getEssay: function (id, signal) {
      return request('/api/essay/' + encodeURIComponent(id), { signal: signal });
    },

    /* ── 练习（exam） ───────────────────────────────────────────────────── */

    /**
     * 组卷并开启会话：POST /api/exam/session/start
     * 入参 { subject(必填), province_code?, year?, time_limit=120, question_count=20 }
     * → { sessionId, questions:[{id,question_number,question_type,stem,options,score,difficulty,year,province_name}],
     *     timeLimit, totalQuestions, subject, province_code }
     * 无匹配题目时后端返回 404「没有找到符合条件的题目」。
     */
    startPractice: function (payload, signal) {
      return request('/api/exam/session/start', { method: 'POST', body: payload, signal: signal });
    },

    /**
     * 交卷：POST /api/exam/session/submit  { sessionId, answers:[{questionId, answer}] }
     * → { sessionId, totalQuestions, correctCount, accuracy, earnedScore, totalScore, results[] }
     *
     * ⚠️ 标度（接新端点必查）：accuracy 是**后端算好的百分比字符串**（"82.5"），
     * 且是**按得分**加权（earnedScore/totalScore），不是按题数 ——
     * 页面要同时给出"答对 N/M"，否则会误导。
     */
    submitPractice: function (payload, signal) {
      return request('/api/exam/session/submit', { method: 'POST', body: payload, signal: signal });
    },

    /** 练习历史：GET /api/exam/session/history?limit&offset → { data?, sessions? , total } */
    practiceHistory: function (query, signal) {
      const qs = new global.URLSearchParams();
      Object.keys(query || {}).forEach(function (k) {
        if (query[k] !== undefined && query[k] !== null && query[k] !== '') qs.set(k, query[k]);
      });
      const suffix = qs.toString() ? '?' + qs.toString() : '';
      return request('/api/exam/session/history' + suffix, { signal: signal });
    },

    /* ── 仪表盘 / 今日任务 / 签到 ───────────────────────────────────────── */

    /**
     * 学习仪表盘：GET /api/user/dashboard
     * → { user, overview:{total_wrong_questions,total_practice,avg_accuracy,study_days},
     *     subject_distribution:[{subject,count,percentage}],
     *     daily_practice:[{date,practice_count,accuracy}],
     *     monthly_trend, weak_points:[{id,name,subject,wrong_count,practice_count,accuracy,level}] }
     *
     * ⚠️ 标度（G6-b 同类）：本端点的 accuracy / percentage 是**后端已算好的百分比字符串**
     * （如 "60.0"），与 /api/knowledge/mastery 的 0..1 不同 —— 页面不要再乘。
     */
    userDashboard: function (signal) {
      return request('/api/user/dashboard', { signal: signal });
    },

    /** 今日任务：GET /api/user/today → { date, streak_days, tasks[] } */
    todayTasks: function (signal) {
      return request('/api/user/today', { signal: signal });
    },

    /** 签到状态：GET /api/gamification/checkin/status */
    checkinStatus: function (signal) {
      return request('/api/gamification/checkin/status', { signal: signal });
    },

    /* ── 知识掌握度 ────────────────────────────────────────────────────── */

    /**
     * 掌握度概览：GET /api/knowledge/mastery
     * 返回 { subject, overall, by_topic:[{kp_id,topic,mastery,questions_done,accuracy}], weak_points }
     *
     * ⚠️ 标度（SPEC-DATA G6-b）：本端点的 overall / by_topic[].mastery 是 **0..1**，
     * 与 /api/srs/engine/queue 的 mastery_score(0..100) 不同。展示层需 ×100，
     * 归一化只在页面里做一次，不要在多处重复乘。
     */
    knowledgeMastery: function (subject, signal) {
      const q = subject ? '?subject=' + encodeURIComponent(subject) : '';
      return request('/api/knowledge/mastery' + q, { signal: signal });
    },

    /** 错题列表：GET /api/user/wrong-questions（支持 page/page_size/subject/reviewed） */
    getWrongQuestions: function (query, signal) {
      const qs = new global.URLSearchParams();
      Object.keys(query || {}).forEach(function (k) {
        if (query[k] !== undefined && query[k] !== null && query[k] !== '') qs.set(k, query[k]);
      });
      const suffix = qs.toString() ? '?' + qs.toString() : '';
      return request('/api/user/wrong-questions' + suffix, { signal: signal });
    },

    /** 错题统计：GET /api/user/wrong-questions/stats */
    getWrongQuestionStats: function (signal) {
      return request('/api/user/wrong-questions/stats', { signal: signal });
    },

    /** 更新错题（标记复习等）：PUT /api/user/wrong-questions/:id —— G1 新增 */
    updateWrongQuestion: function (id, payload, signal) {
      return request('/api/user/wrong-questions/' + encodeURIComponent(id), {
        method: 'PUT',
        body: payload || {},
        signal: signal,
      });
    },

    /** 删除错题：DELETE /api/user/wrong-questions/:id —— G1 新增 */
    deleteWrongQuestion: function (id, signal) {
      return request('/api/user/wrong-questions/' + encodeURIComponent(id), {
        method: 'DELETE',
        signal: signal,
      });
    },

    /* ── AI 导师问答（tutor） ───────────────────────────────────────────
     * 入参 payload：{ question(必填), knowledge_point_id?, subject?, current_topic_name? }
     *
     * 响应增量契约 (F1/G4，2026-09-23，见 api/routes/tutor-agent.js)：
     *   grounded: boolean        — false 表示本次回答未依据题库内容
     *   citations: array         — 命中题号列表（[{question_id, similarity}]），无则 []
     *   groundingNotice: string|null — 未接地时的**后端原文说明**；已接地 → null
     *   ⇒ 前端只消费后端产出的文案，不得自造/改写；无这三字段时按“未知”处理（不伪造状态）。
     * ──────────────────────────────────────────────────────────────────── */

    /** 单次问答（非流式）：POST /api/tutor/ask → { response, diagnosis, learning_path, metadata, context, usage, duration_ms, grounded, citations, groundingNotice } */
    askTutor: function (payload, signal) {
      return request('/api/tutor/ask', { method: 'POST', body: payload, signal: signal });
    },

    /**
     * 流式问答：POST /api/tutor/ask/stream（SSE）。
     * @param {object} payload  { question, knowledge_point_id?, subject?, current_topic_name? }
     * @param {{onEvent: function({event,data}), signal?: AbortSignal}} opts
     *        onEvent 收到 { event, data }，event ∈ metadata|content|done|error。
     *        ⚠️ 流式三字段随 metadata（meta）事件下发（后端约定）；缺字段即视为未知，不伪造。
     * @returns {Promise<void>} 流结束即 resolve；业务/网络错误 reject（并把 error 事件交给 onEvent）。
     */
    askTutorStream: function (payload, opts) {
      opts = opts || {};
      const onEvent = opts.onEvent;
      if (typeof onEvent !== 'function') {
        return Promise.reject(ApiError('askTutorStream: onEvent 回调必填', { kind: 'request' }));
      }

      const headers = { 'Content-Type': 'application/json' };
      const token = getToken();
      if (token) headers.Authorization = 'Bearer ' + token;

      return global
        .fetch('/api/tutor/ask/stream', {
          method: 'POST',
          headers: headers,
          credentials: 'same-origin',
          body: JSON.stringify(payload || {}),
          signal: opts.signal,
        })
        .then(
          function (res) {
            const contentType = res.headers && res.headers.get ? res.headers.get('content-type') || '' : '';
            if (String(contentType).indexOf('text/event-stream') === -1) {
              // 业务错误：后端返回普通 JSON（401/400/500…）
              return res
                .json()
                .catch(function () {
                  return null;
                })
                .then(function (body) {
                  const msg = (body && (body.message || body.error)) || '请求失败（HTTP ' + res.status + '）';
                  onEvent({ event: 'error', data: { message: msg, status: res.status } });
                  throw ApiError(msg, { status: res.status, payload: body });
                });
            }
            // 无流式能力的环境（如无 ReadableStream/TextDecoderStream）→ 如实报错，不伪造
            if (!res.body || typeof res.body.getReader !== 'function' || typeof global.TextDecoderStream !== 'function') {
              const msg = '当前环境不支持流式响应';
              onEvent({ event: 'error', data: { message: msg } });
              throw ApiError(msg, { kind: 'request' });
            }

            const reader = res.body.pipeThrough(new global.TextDecoderStream()).getReader();
            let buf = '';
            const normalize = function (s) {
              return s.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
            };
            function pump() {
              return reader.read().then(function (r) {
                if (r.done) return undefined;
                buf += normalize(r.value);
                let idx;
                while ((idx = buf.indexOf('\n\n')) !== -1) {
                  const frame = buf.slice(0, idx);
                  buf = buf.slice(idx + 2);
                  const ev = parseSseFrame(frame);
                  if (ev) onEvent(ev);
                }
                return pump();
              });
            }
            return pump();
          },
          function (err) {
            if (err && err.name === 'AbortError') throw err;
            throw ApiError('网络连接不可用', { kind: 'network' });
          }
        );
    },
  };

  /**
   * 解析单个 SSE 帧 "event: x\ndata: {...}" → { event, data }。
   * data 非 JSON 时原样返回字符串；空 data 返回 { event, data: '' }。
   */
  function parseSseFrame(frame) {
    if (!frame) return null;
    const lines = frame.split('\n');
    let event = 'message';
    let data = '';
    lines.forEach(function (line) {
      if (line.indexOf('event:') === 0) event = line.slice(6).trim();
      else if (line.indexOf('data:') === 0) data += line.slice(5).trim();
    });
    if (!data) return { event: event, data: '' };
    try {
      return { event: event, data: JSON.parse(data) };
    } catch (e) {
      return { event: event, data: data };
    }
  }

  global.AIAPI.parseSseFrame = parseSseFrame;
})(window);
