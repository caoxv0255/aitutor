export class Router {
  constructor(routes) {
    this.routes = routes || {};
    this._init();
  }

  _init() {
    window.addEventListener('popstate', () => {
      this._handleRoute();
    });

    document.addEventListener('DOMContentLoaded', () => {
      this._handleRoute();
    });
  }

  _handleRoute() {
    const path = window.location.pathname;
    const route = this.routes[path] || this.routes['*'];
    
    if (route) {
      if (route.guard && !route.guard()) {
        this.navigate(route.redirect || '/login');
        return;
      }
      
      if (route.component) {
        this._render(route.component);
      }
    }
  }

  navigate(path, options = {}) {
    const route = this.routes[path];
    
    if (route && route.guard && !route.guard()) {
      this.navigate(route.redirect || '/login');
      return;
    }

    if (options.pushState !== false) {
      window.history.pushState({ path }, '', path);
    }
    
    this._handleRoute();
  }

  _render(component) {
    const app = document.getElementById('app');
    if (app && component) {
      app.innerHTML = '';
      app.appendChild(component);
    }
  }

  registerRoute(path, config) {
    this.routes[path] = config;
  }
}

export const router = new Router();

export function navigateTo(href, pushState = true) {
  if (!href) return;
  
  const current = window.location.pathname.split('/').pop() || 'home.html';
  const target = href.split('/').pop();
  
  if (current === target) {
    showToast('当前已在目标页面', 'info', 1500);
    return;
  }

  showLoading();

  setTimeout(() => {
    if (pushState) {
      try {
        window.history.pushState({ page: target }, '', href);
      } catch (e) {}
    }
    window.location.href = href;
  }, 300);
}

export function showLoading() {
  let loader = document.getElementById('page-loader');
  if (!loader) {
    loader = document.createElement('div');
    loader.id = 'page-loader';
    loader.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: var(--bg);
      z-index: 9999;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    loader.innerHTML = `
      <div style="width: 40px; height: 40px; border: 3px solid var(--bg3); border-top-color: var(--accent); border-radius: 50%; animation: spin 1s linear infinite;"></div>
      <style>@keyframes spin { to { transform: rotate(360deg); } }</style>
    `;
    document.body.appendChild(loader);
  }
  
  loader.style.display = 'flex';
}

export function hideLoading() {
  const loader = document.getElementById('page-loader');
  if (loader) {
    loader.style.display = 'none';
  }
}

export function showToast(message, type = 'info', duration = 3000) {
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.textContent = message;
  
  const icons = {
    success: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>',
    error: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    warning: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>',
    info: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
  };
  
  toast.innerHTML = `${icons[type]} ${message}`;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.classList.add('toast--exit');
    setTimeout(() => {
      if (document.body.contains(toast)) {
        document.body.removeChild(toast);
      }
    }, 300);
  }, duration);
}