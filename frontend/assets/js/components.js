(function(root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.Components = factory();
  }
})(typeof self !== 'undefined' ? self : this, function() {

class Components {
  constructor() {
    this.SITE_URL = 'https://aitutor.uibe.online/app';
    this.isInitialized = false;
  }

  init() {
    if (this.isInitialized) return;
    this.isInitialized = true;
    
    this.setupEventDelegation();
    
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        this.renderHeader();
        this.renderFooter();
      });
    } else {
      this.renderHeader();
      this.renderFooter();
    }
  }

  setupEventDelegation() {
    document.addEventListener('click', (e) => {
      const target = e.target;
      
      if (target.closest('[data-action="logout"]')) {
        e.preventDefault();
        this.handleLogout();
      }
      
      if (target.closest('.theme-toggle')) {
        e.preventDefault();
        this.toggleTheme();
      }
    });
  }

  renderHeader() {
    const header = document.getElementById('header');
    if (!header) return;

    const isLoggedIn = this.isLoggedIn();
    const username = localStorage.getItem('username') || '';

    const headerHtml = `
      <div class="header-content">
        <div class="logo">
          <span class="logo-icon">🎓</span>
          <span class="logo-text">AI Tutor</span>
        </div>
        <nav class="nav-links">
          <a href="index.html" class="nav-link">首页</a>
          <a href="zhongkao.html" class="nav-link">中考专区</a>
          <a href="methodology.html" class="nav-link">方法论</a>
        </nav>
        <div class="header-right">
          ${isLoggedIn ? `
            <span class="username">${this.escapeHtml(username)}</span>
            <button class="btn secondary" data-action="logout">退出</button>
          ` : `
            <a href="login.html" class="btn secondary">登录</a>
          `}
          <button class="theme-toggle" aria-label="切换主题">
            <span>${this.isDarkMode() ? '☀' : '🌙'}</span>
          </button>
        </div>
      </div>
    `;

    header.innerHTML = headerHtml;
  }

  renderFooter() {
    const footer = document.getElementById('footer');
    if (!footer) return;

    footer.innerHTML = `
      <div class="footer-content">
        <p>基于历年真题、学生错题与知识点图谱，生成个性化预测卷与强化学习方案</p>
        <p>本系统为学习研究与复习辅助工具，预测内容不代表官方命题方向，政策信息以北京教育考试院及教育主管部门正式发布为准。</p>
        <p>aitutor.uibe.online</p>
      </div>
    `;
  }

  isLoggedIn() {
    return !!localStorage.getItem('token');
  }

  handleLogout() {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    localStorage.removeItem('user_id');
    this.renderHeader();
    window.location.href = 'login.html';
  }

  toggleTheme() {
    const isDark = this.isDarkMode();
    if (isDark) {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    } else {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    }
    this.renderHeader();
  }

  isDarkMode() {
    return localStorage.getItem('theme') === 'dark' || 
           (localStorage.getItem('theme') === null && 
            window.matchMedia('(prefers-color-scheme: dark)').matches);
  }

  escapeHtml(text) {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  updateHeader() {
    this.renderHeader();
  }
}

const components = new Components();

document.addEventListener('DOMContentLoaded', () => {
  components.init();
});

return {
  Components,
  components,
  default: components
};

});
