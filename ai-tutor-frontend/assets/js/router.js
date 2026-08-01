// router.js — SPA 路由, navbar/bottom-nav 统一
// 处理内部跳转 (data-route), 高亮当前页, 401 守卫

const ROUTES = {
  'home': '/index.html',
  'dashboard': '/dashboard.html',
  'mastery': '/mastery.html',
  'tutor': '/tutor.html',
  'review': '/review.html',
  'exam': '/exam-simulation.html',
  'vision': '/vision.html',
  'wrongbook': '/wrong-book.html',
  'login': '/login.html',
  'register': '/register.html',
};

const NAV_LINKS = [
  { key: 'home', icon: 'home', label: '首页' },
  { key: 'dashboard', icon: 'layout-dashboard', label: '主页' },
  { key: 'mastery', icon: 'target', label: '掌握' },
  { key: 'review', icon: 'file-text', label: '报告' },
  { key: 'wrongbook', icon: 'book-open', label: '错题' },
];

const BOTTOM_NAV_LINKS = [
  { key: 'home', icon: 'home', label: '首页' },
  { key: 'dashboard', icon: 'layout-dashboard', label: '主页' },
  { key: 'tutor', icon: 'message-circle', label: '答疑' },
  { key: 'wrongbook', icon: 'book-open', label: '错题' },
  { key: 'review', icon: 'file-text', label: '报告' },
];

function currentRouteKey() {
  const path = window.location.pathname.split('/').pop() || 'index.html';
  for (const [k, p] of Object.entries(ROUTES)) {
    if (p.endsWith(path)) return k;
  }
  return null;
}

function renderTopbar() {
  const current = currentRouteKey();
  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <nav class="ait-topbar">
      <a class="ait-brand" href="/index.html">
        <span class="ait-brand-icon"><i data-lucide="graduation-cap"></i></span>
        <span>AI Tutor</span>
      </a>
      <div class="ait-nav">
        ${NAV_LINKS.map(l => `<a class="ait-nav-link ${l.key===current?'active':''}" href="${ROUTES[l.key]}"><i data-lucide="${l.icon}"></i> ${l.label}</a>`).join('')}
      </div>
      <div class="ait-user" onclick="window.AIT.auth.logout()" title="登出">
        <span class="ait-user-avatar">D</span>
        <span class="hidden md:inline">演示学生</span>
      </div>
    </nav>
  `;
  document.body.insertBefore(wrap.firstElementChild, document.body.firstChild);
}

function renderBottomNav() {
  const current = currentRouteKey();
  const wrap = document.createElement('div');
  wrap.className = 'ait-bottom-nav';
  wrap.innerHTML = `
    <div class="ait-nav-grid">
      ${BOTTOM_NAV_LINKS.map(l => `<a class="ait-nav-item ${l.key===current?'active':''}" href="${ROUTES[l.key]}"><i data-lucide="${l.icon}"></i><span>${l.label}</span></a>`).join('')}
    </div>
  `;
  document.body.appendChild(wrap);
}

function highlightDataRoute() {
  const current = currentRouteKey();
  document.querySelectorAll('[data-route]').forEach(el => {
    if (el.dataset.route === current) el.classList.add('active');
  });
}

function init() {
  renderTopbar();
  renderBottomNav();
  highlightDataRoute();
  if (window.lucide) lucide.createIcons();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

export { ROUTES, currentRouteKey, init };
