/* ============================================================================
 * Coach Mark · 老用户引导（V1.0 上线专用）
 *
 * 用途：D070 灰度期间，老用户首次进入新前端 F3 时，展示欢迎 Toast
 * 行为：
 *   1. 检查 localStorage 标记 'aitutor.v1_onboarded' 是否已存在
 *   2. 若不存在，检查用户是否为"老用户"（存在 user.createdAt < v1 release date）
 *   3. 若满足条件，渲染欢迎浮层 + 「开始复习」CTA
 *   4. 用户点击 CTA / 关闭后，写入标记（仅此浏览器，永久不再展示）
 *
 * 用法：
 *   <script src="assets/js/components/coach-mark-v1.js"></script>
 *   <script>aitutorCoachMarkV1.tryShow();</script>
 *
 * 关联：deploy/nginx-gray-cutover.conf · D070 sunset 阶段
 * ============================================================================ */

(function() {
  'use strict';

  // V1.0 发布日期（用于判断"老用户"）—— 实际值由部署时替换
  const V1_RELEASE_DATE = (typeof window !== 'undefined' && window.AITUTOR_V1_RELEASE_DATE)
    || '2026-09-15';

  // 持久化 key
  const LS_KEY = 'aitutor.v1_onboarded';

  // 文案（已与产品确认）
  const COPY = {
    title: '欢迎来到全新的 aitutor！',
    body:  '你的错题和复习任务都在这里，点击「开始复习」体验新版吧。',
    cta:   '开始复习',
    close: '下次再说',
  };

  /**
   * 入口：尝试展示引导
   * @returns {boolean} true=展示了；false=已展示过/不满足条件
   */
  function tryShow() {
    if (alreadyOnboarded()) return false;
    if (!isOldUser()) {
      markOnboarded();
      return false;
    }
    show();
    return true;
  }

  function alreadyOnboarded() {
    try {
      return localStorage.getItem(LS_KEY) === '1';
    } catch (_) { return false; }
  }

  function markOnboarded() {
    try {
      localStorage.setItem(LS_KEY, '1');
    } catch (_) {}
  }

  function isOldUser() {
    // 简化判断：localStorage 中有 user.createdAt + token issuedAt 早于 V1
    try {
      const flag = localStorage.getItem('aitutor.is_old_user');
      if (flag === '1') return true;
      if (flag === '0') return false;

      const userStr = localStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        const v1 = new Date(V1_RELEASE_DATE).getTime();
        if (user.createdAt && new Date(user.createdAt).getTime() < v1) return true;
        if (user.registeredAt && new Date(user.registeredAt).getTime() < v1) return true;
      }
    } catch (_) {}
    return false;
  }

  /**
   * 渲染引导浮层（非阻塞、含 CTA 按钮、token 设计）
   * 设计：Info 色调 / 圆角 16 / 阴影 lg / Lucide 图标
   */
  function show() {
    // 防重复
    if (document.getElementById('aitutor-v1-coach-mark')) {
      markOnboarded();
      return;
    }

    const el = document.createElement('div');
    el.id = 'aitutor-v1-coach-mark';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-labelledby', 'cmv1-title');
    el.setAttribute('aria-describedby', 'cmv1-body');
    el.style.cssText = [
      'position: fixed', 'inset: 0', 'z-index: 9999',
      'background: rgba(15, 23, 42, 0.45)',
      'display: flex', 'align-items: center', 'justify-content: center',
      'padding: 16px',
      'animation: cmv1-fade 240ms ease-out'
    ].join(';');

    // 内部样式（injected once）
    if (!document.getElementById('cmv1-styles')) {
      const style = document.createElement('style');
      style.id = 'cmv1-styles';
      style.textContent = `
        @keyframes cmv1-fade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes cmv1-pop  { from { opacity: 0; transform: translateY(8px) scale(0.96); } to { opacity: 1; transform: translateY(0) scale(1); } }
        #aitutor-v1-coach-mark .cmv1-card {
          background: var(--ait-bg-surface, #fff);
          border-radius: var(--ait-radius-xl, 20px);
          box-shadow: var(--ait-shadow-2xl, 0 24px 56px rgba(15,23,42,0.20));
          padding: 28px 24px;
          max-width: 380px;
          width: 100%;
          animation: cmv1-pop 320ms cubic-bezier(0.32, 0.72, 0, 1);
        }
        #aitutor-v1-coach-mark .cmv1-icon {
          width: 56px; height: 56px;
          background: var(--ait-color-info-50, #ecfeff);
          color: var(--ait-color-info-500, #06b6d4);
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          margin-bottom: 16px;
        }
        #aitutor-v1-coach-mark .cmv1-title {
          font-size: 18px; font-weight: 700;
          color: var(--ait-fg-strong, #0f172a);
          margin: 0 0 8px;
        }
        #aitutor-v1-coach-mark .cmv1-body {
          font-size: 14px; line-height: 1.6;
          color: var(--ait-fg-secondary, #475569);
          margin: 0 0 20px;
        }
        #aitutor-v1-coach-mark .cmv1-actions {
          display: flex; gap: 8px;
        }
        #aitutor-v1-coach-mark .cmv1-btn-primary {
          flex: 1;
          height: 44px;
          border-radius: var(--ait-radius-md, 12px);
          background: var(--ait-color-primary-500, #4f7cf0);
          color: #fff;
          font-size: 14px; font-weight: 600;
          border: 0; cursor: pointer;
          display: inline-flex; align-items: center; justify-content: center; gap: 6px;
          box-shadow: 0 2px 8px rgba(79, 125, 240, 0.25);
        }
        #aitutor-v1-coach-mark .cmv1-btn-secondary {
          height: 44px;
          padding: 0 14px;
          border-radius: var(--ait-radius-md, 12px);
          background: transparent;
          color: var(--ait-fg-secondary, #475569);
          font-size: 14px; font-weight: 500;
          border: 1px solid var(--ait-border-default, #e6e9ef);
          cursor: pointer;
        }
        @media (prefers-reduced-motion: reduce) {
          #aitutor-v1-coach-mark, #aitutor-v1-coach-mark .cmv1-card { animation: none; }
        }
      `;
      document.head.appendChild(style);
    }

    el.innerHTML = `
      <div class="cmv1-card">
        <div class="cmv1-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24"
               fill="none" stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round">
            <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>
          </svg>
        </div>
        <h2 class="cmv1-title" id="cmv1-title">${escapeHtml(COPY.title)}</h2>
        <p class="cmv1-body" id="cmv1-body">${escapeHtml(COPY.body)}</p>
        <div class="cmv1-actions">
          <button class="cmv1-btn-primary" type="button" data-cmv1-cta>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
                 fill="none" stroke="currentColor" stroke-width="2.5"
                 stroke-linecap="round" stroke-linejoin="round">
              <polygon points="6 3 20 12 6 21 6 3"></polygon>
            </svg>
            ${escapeHtml(COPY.cta)}
          </button>
          <button class="cmv1-btn-secondary" type="button" data-cmv1-close>
            ${escapeHtml(COPY.close)}
          </button>
        </div>
      </div>
    `;

    // 事件绑定
    el.addEventListener('click', (e) => {
      if (e.target === el) {
        // 点击背景蒙层关闭
        dismiss();
      }
    });
    el.querySelector('[data-cmv1-cta]').addEventListener('click', () => {
      markOnboarded();
      // 移除元素 + 跳转
      el.remove();
      location.href = '/learning-path.html';
    });
    el.querySelector('[data-cmv1-close]').addEventListener('click', () => {
      dismiss();
    });
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') dismiss();
    });

    document.body.appendChild(el);
    // 焦点管理
    setTimeout(() => el.querySelector('[data-cmv1-cta]').focus(), 100);

    function dismiss() {
      markOnboarded();
      el.remove();
    }
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /**
   * 重置引导（仅用于测试 / 强制重看）
   */
  function reset() {
    try { localStorage.removeItem(LS_KEY); } catch (_) {}
    // 同时清除老用户标记（让 isOldUser 重新判断）
    try { localStorage.removeItem('aitutor.is_old_user'); } catch (_) {}
  }

  // 暴露 API
  if (typeof window !== 'undefined') {
    window.aitutorCoachMarkV1 = {
      tryShow: tryShow,
      reset: reset,
      COPY: COPY,
      isOldUser: isOldUser,
      alreadyOnboarded: alreadyOnboarded,
    };
  }
})();
