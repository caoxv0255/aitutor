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
  };
})(window);
