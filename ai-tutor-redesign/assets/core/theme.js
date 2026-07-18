export class ThemeManager {
  constructor() {
    this._init();
  }

  _init() {
    const saved = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initial = saved || (prefersDark ? 'dark' : 'light');
    this.set(initial);

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (!localStorage.getItem('theme')) {
        this.set(e.matches ? 'dark' : 'light');
      }
    });
  }

  set(theme) {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('theme', theme);
    this._notify(theme);
  }

  get() {
    return document.documentElement.dataset.theme || 'light';
  }

  toggle() {
    const current = this.get();
    this.set(current === 'light' ? 'dark' : 'light');
  }

  isDark() {
    return this.get() === 'dark';
  }

  subscribe(callback) {
    this._listeners = this._listeners || [];
    this._listeners.push(callback);
    return () => {
      const index = this._listeners.indexOf(callback);
      if (index > -1) {
        this._listeners.splice(index, 1);
      }
    };
  }

  _notify(theme) {
    (this._listeners || []).forEach(callback => {
      try {
        callback(theme);
      } catch (e) {
        console.error('Theme callback error:', e);
      }
    });
  }
}

export const themeManager = new ThemeManager();