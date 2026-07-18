export class Toast {
  constructor(options = {}) {
    this.options = {
      type: 'info',
      duration: 3000,
      message: '',
      onClose: null,
      ...options
    };
    
    this._element = null;
    this._timer = null;
  }

  _createElement() {
    const toast = document.createElement('div');
    toast.className = `toast toast--${this.options.type}`;
    
    const icons = {
      success: '<svg class="toast__icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>',
      error: '<svg class="toast__icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
      warning: '<svg class="toast__icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>',
      info: '<svg class="toast__icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
    };
    
    toast.innerHTML = `
      ${icons[this.options.type]}
      <span class="toast__message">${this.options.message}</span>
      <button class="toast__close" aria-label="关闭">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    `;
    
    toast.querySelector('.toast__close').addEventListener('click', () => {
      this.close();
    });
    
    return toast;
  }

  show() {
    if (this._element) {
      this.close();
    }
    
    this._element = this._createElement();
    document.body.appendChild(this._element);
    
    requestAnimationFrame(() => {
      if (this._element) {
        this._element.classList.add('toast--visible');
      }
    });
    
    if (this.options.duration > 0) {
      this._timer = setTimeout(() => {
        this.close();
      }, this.options.duration);
    }
    
    return this;
  }

  close() {
    if (!this._element) return;
    
    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = null;
    }
    
    this._element.classList.remove('toast--visible');
    this._element.classList.add('toast--exit');
    
    setTimeout(() => {
      if (this._element && document.body.contains(this._element)) {
        this._element.remove();
      }
      this._element = null;
      
      if (this.options.onClose) {
        this.options.onClose();
      }
    }, 300);
  }

  static show(options) {
    return new Toast(options).show();
  }

  static success(message, duration = 3000) {
    return Toast.show({ type: 'success', message, duration });
  }

  static error(message, duration = 3000) {
    return Toast.show({ type: 'error', message, duration });
  }

  static warning(message, duration = 3000) {
    return Toast.show({ type: 'warning', message, duration });
  }

  static info(message, duration = 3000) {
    return Toast.show({ type: 'info', message, duration });
  }
}