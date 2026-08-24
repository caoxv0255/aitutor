// components/feedback-button.js — 5 星评分按钮组件 (Phase-G1-fix, 2026-08-24)
//
// 用法:
//   import { mountFeedbackButton } from '../components/feedback-button.js';
//   mountFeedbackButton('#feedback-zone', 'tutor_ask', assistantMsg.request_id);
//
// 行为:
//   - 渲染 5 个 emoji 按钮 (👎👎😐👍👍), 默认横向排列
//   - 点 1-3 星 → 弹评论框 (textarea), 必填; 点 4-5 星 → 评论可选
//   - 提交 → feedback.submit() (envelope {success, data})
//   - 成功后 → "✓ 已收到反馈", 隐藏按钮
//   - 失败 → 错误提示, 按钮保留可重试
//
// 设计:
//   - 不引入框架 (vanilla DOM), 跟 toast.js / error-boundary.js 同风格
//   - 纯静态函数, 无副作用 (DOM 之外), 单测友好
//   - SSR / 测试环境 (无 document) → 直接返回 noop

import { feedback } from '../api/services/feedback.js';

const STAR_EMOJI = ['👎', '👎', '😐', '👍', '👍'];
const STAR_LABEL = ['很差', '一般', '还行', '不错', '很棒'];

/**
 * 挂载反馈按钮到 container
 * @param {HTMLElement|string} target — DOM 节点或 CSS selector
 * @param {string} [taskType='tutor_ask']
 * @param {string} [requestId] — 关联 ai_trace
 * @returns {{ unmount: () => void, getState: () => object } | null}
 */
export function mountFeedbackButton(target, taskType = 'tutor_ask', requestId = null) {
  if (typeof document === 'undefined') return null;

  const container = typeof target === 'string'
    ? document.querySelector(target)
    : target;
  if (!container) {
    console.warn('[feedback-button] container not found:', target);
    return null;
  }

  // 幂等: 同一个 container 二次 mount → unmount 旧的
  if (container.__feedbackMounted) {
    container.__feedbackMounted.unmount();
  }

  const state = {
    taskType,
    requestId,
    rating: null,
    comment: '',
    submitting: false,
    submitted: false,
    error: null,
  };

  // ===== DOM 构建 =====
  const root = document.createElement('div');
  root.className = 'feedback-root';
  root.style.cssText = 'font-family:inherit;';

  // 5 星 emoji 行
  const starsRow = document.createElement('div');
  starsRow.className = 'feedback-stars';
  starsRow.style.cssText = 'display:flex; gap:6px; align-items:center;';

  const promptEl = document.createElement('span');
  promptEl.textContent = '这次回答对你有帮助吗?';
  promptEl.style.cssText = 'font-size:13px; color:var(--color-foreground-secondary, #475569); margin-right:4px;';
  starsRow.appendChild(promptEl);

  const starButtons = STAR_EMOJI.map((emoji, idx) => {
    const rating = idx + 1;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.rating = String(rating);
    btn.title = `${rating} 星 - ${STAR_LABEL[idx]}`;
    btn.setAttribute('aria-label', `${rating} 星 ${STAR_LABEL[idx]}`);
    btn.textContent = emoji;
    btn.style.cssText = [
      'font-size:22px',
      'line-height:1',
      'padding:4px 8px',
      'border:1px solid var(--color-border, #e2e8f0)',
      'background:var(--color-surface, #fff)',
      'border-radius:var(--radius-pill, 9999px)',
      'cursor:pointer',
      'transition:transform 0.15s, background 0.15s',
    ].join(';');
    btn.addEventListener('mouseenter', () => { btn.style.transform = 'scale(1.15)'; });
    btn.addEventListener('mouseleave', () => { btn.style.transform = 'scale(1)'; });
    btn.addEventListener('click', () => onPick(rating));
    starsRow.appendChild(btn);
    return btn;
  });

  root.appendChild(starsRow);

  // 评论框容器 (动态插入)
  const commentWrap = document.createElement('div');
  commentWrap.className = 'feedback-comment-wrap';
  commentWrap.style.cssText = 'display:none; margin-top:10px;';
  root.appendChild(commentWrap);

  // 状态行 (已提交 / 错误)
  const statusEl = document.createElement('div');
  statusEl.className = 'feedback-status';
  statusEl.style.cssText = 'margin-top:8px; font-size:13px; min-height:18px;';
  root.appendChild(statusEl);

  container.appendChild(root);

  // ===== 交互逻辑 =====
  function onPick(rating) {
    if (state.submitting || state.submitted) return;
    state.rating = rating;
    // 高亮选中星
    starButtons.forEach((btn, idx) => {
      const active = idx + 1 <= rating;
      btn.style.background = active
        ? 'var(--color-primary-50, #fff1f1)'
        : 'var(--color-surface, #fff)';
      btn.style.borderColor = active
        ? 'var(--color-primary-400, #ff686d)'
        : 'var(--color-border, #e2e8f0)';
    });
    // 评论框: 1-3 星必填, 4-5 星可选
    renderCommentBox(rating <= 3);
  }

  function renderCommentBox(required) {
    commentWrap.innerHTML = '';
    commentWrap.style.display = 'block';

    const textarea = document.createElement('textarea');
    textarea.placeholder = required ? '哪里不满意? 我们会改进 (必填)' : '有想说的吗? (可选)';
    textarea.maxLength = 2000;
    textarea.rows = 2;
    textarea.style.cssText = [
      'width:100%',
      'box-sizing:border-box',
      'padding:8px 10px',
      'border:1px solid var(--color-border, #e2e8f0)',
      'border-radius:var(--radius-md, 14px)',
      'font-family:inherit',
      'font-size:14px',
      'resize:vertical',
      'min-height:48px',
    ].join(';');
    commentWrap.appendChild(textarea);

    const submitBtn = document.createElement('button');
    submitBtn.type = 'button';
    submitBtn.textContent = '提交反馈';
    submitBtn.style.cssText = [
      'margin-top:8px',
      'padding:6px 14px',
      'border:none',
      'border-radius:var(--radius-pill, 9999px)',
      'background:var(--color-primary-500, #d71920)',
      'color:#fff',
      'font-size:13px',
      'font-weight:500',
      'cursor:pointer',
    ].join(';');
    submitBtn.addEventListener('click', () => onSubmit(textarea, submitBtn, required));
    commentWrap.appendChild(submitBtn);

    // 自动聚焦 (1-3 星必填场景)
    setTimeout(() => { try { textarea.focus(); } catch (_) {} }, 50);
  }

  async function onSubmit(textarea, submitBtn, required) {
    if (state.submitting || state.submitted) return;
    const comment = (textarea.value || '').trim();
    if (required && !comment) {
      statusEl.textContent = '请填写反馈内容';
      statusEl.style.color = 'var(--color-error, #ef4444)';
      return;
    }
    state.comment = comment;
    state.submitting = true;
    submitBtn.disabled = true;
    submitBtn.style.opacity = '0.5';
    statusEl.textContent = '提交中...';
    statusEl.style.color = 'var(--color-foreground-muted, #94a3b8)';

    try {
      const res = await feedback.submit({
        task_type: state.taskType,
        rating: state.rating,
        comment: state.comment || undefined,
        request_id: state.requestId || undefined,
      });
      // D062: res = envelope {success, data}
      if (res && res.success) {
        state.submitted = true;
        state.error = null;
        // 成功后: 隐藏按钮 + 评论框, 显示 "✓ 已收到反馈"
        starsRow.style.display = 'none';
        commentWrap.style.display = 'none';
        statusEl.textContent = '✓ 已收到反馈, 感谢你的支持';
        statusEl.style.color = 'var(--color-success-600, #047857)';
      } else {
        throw new Error((res && res.message) || '提交失败');
      }
    } catch (err) {
      state.error = err;
      state.submitting = false;
      submitBtn.disabled = false;
      submitBtn.style.opacity = '1';
      statusEl.textContent = '✗ 提交失败: ' + (err.message || '未知错误');
      statusEl.style.color = 'var(--color-error, #ef4444)';
    }
  }

  const api = {
    unmount() {
      try { root.remove(); } catch (_) {}
      delete container.__feedbackMounted;
    },
    getState() {
      return { ...state };
    },
  };
  container.__feedbackMounted = api;
  return api;
}