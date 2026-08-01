// toast.js — 全局 toast 通知, 4 等级 (success/error/info/warning)
// 复用 frontend/assets/css/router.css 的 .ait-toast 样式
//
// 用法:
//   toast.success('保存成功')
//   toast.error('加载失败: ' + err.message)
//   toast.info('正在处理...')
//   toast.warning('注意: 数据已过期')

let container = null;

function ensureContainer() {
  if (container) return container;
  container = document.createElement('div');
  container.className = 'ait-toast-container';
  document.body.appendChild(container);
  return container;
}

const ICONS = { success: '✓', error: '✕', info: 'i', warning: '!' };

function show(message, type = 'info', duration = 3000) {
  ensureContainer();
  const el = document.createElement('div');
  el.className = `ait-toast ${type}`;
  el.innerHTML = `<span style="font-weight:700;margin-right:8px">${ICONS[type]}</span>${escapeHtml(message)}`;
  container.appendChild(el);
  setTimeout(() => {
    el.classList.add('removing');
    setTimeout(() => el.remove(), 250);
  }, duration);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);
}

export const toast = {
  success: (msg, dur) => show(msg, 'success', dur),
  error: (msg, dur = 5000) => show(msg, 'error', dur),
  info: (msg, dur) => show(msg, 'info', dur),
  warning: (msg, dur) => show(msg, 'warning', dur),
};
