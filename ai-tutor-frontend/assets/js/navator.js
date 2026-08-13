// assets/js/navator.js — 全站顶部导航栏 (F3 slice 跨页入口)
import { isLoggedIn, getUser, clearToken, clearUser } from './auth.js';
import { getMockEnabled, setUseMock } from './api/USE_MOCK.js';
import { toast } from './toast.js';

export const NAV_ITEMS = [
  { key: 'home',    label: '首页',       href: '/f3/pages/index.html',          icon: '🏠' },
  { key: 'dash',    label: 'Dashboard', href: '/f3/pages/dashboard.html',      icon: '📊' },
  { key: 'tutor',   label: 'AI 导师',    href: '/f3/pages/tutor.html',          icon: '🤖' },
  { key: 'wrong',   label: '错题本',     href: '/f3/pages/wrong-book.html',     icon: '📕' },
  { key: 'review',  label: '学情报告',   href: '/f3/pages/review.html',         icon: '📈' },
  { key: 'mastery', label: '掌握度',     href: '/f3/pages/mastery.html',        icon: '🎯' },
  { key: 'vision',  label: '拍照搜题',   href: '/f3/pages/vision.html',         icon: '📷' },
  { key: 'exam',    label: '模拟考',     href: '/f3/pages/exam-simulation.html', icon: '✍️' },
];

function render(activeKey) {
  const loggedIn = isLoggedIn();
  const user = loggedIn ? getUser() : null;
  const mockOn = getMockEnabled();
  const userLabel = (user && (user.email || user.name)) || '已登录';
  const links = NAV_ITEMS.map((it) => {
    const active = it.key === activeKey;
    const cls = active
      ? 'inline-flex items-center gap-1.5 h-9 px-3 rounded-[10px] text-[13px] font-medium bg-primary-50 text-primary-600 transition-colors whitespace-nowrap'
      : 'inline-flex items-center gap-1.5 h-9 px-3 rounded-[10px] text-[13px] font-medium text-foreground-secondary hover:bg-surface-tertiary hover:text-foreground transition-colors whitespace-nowrap';
    return '<a href="' + it.href + '" data-nav-key="' + it.key + '" class="' + cls + '"><span>' + it.icon + '</span><span>' + it.label + '</span></a>';
  }).join('');
  const mockCls = 'inline-flex items-center gap-1.5 h-9 px-3 rounded-[10px] text-[12px] font-medium ' + (mockOn ? 'bg-warning-50 text-warning-600' : 'bg-surface-tertiary text-foreground-muted') + ' hover:opacity-80 transition-opacity whitespace-nowrap';
  const mockDot = '<span class="w-1.5 h-1.5 rounded-full ' + (mockOn ? 'bg-warning-500' : 'bg-foreground-muted') + '"></span>';
  const mockText = 'Mock: ' + (mockOn ? '开' : '关');
  const right = loggedIn
    ? '<button data-dom-id="nav-mock" class="' + mockCls + '">' + mockDot + mockText + '</button><span class="hidden sm:inline text-[12px] text-foreground-muted whitespace-nowrap">' + userLabel + '</span><button data-dom-id="nav-logout" class="inline-flex items-center gap-1.5 h-9 px-3 rounded-[10px] text-[12px] font-medium text-foreground-secondary hover:bg-error-50 hover:text-error-500 transition-colors whitespace-nowrap">退出</button>'
    : '<a href="/f3/pages/login.html" class="inline-flex items-center gap-1.5 h-9 px-4 rounded-[10px] text-[13px] font-medium bg-primary-500 text-white hover:bg-primary-600 transition-colors whitespace-nowrap">登录</a>';
  return '<nav id="ait-topnav" class="fixed top-0 left-0 right-0 z-50 bg-surface/95 backdrop-blur-sm border-b border-border shadow-sm"><div class="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-3"><a href="/f3/pages/index.html" class="inline-flex items-center gap-2 shrink-0 mr-2"><span class="inline-flex items-center justify-center w-8 h-8 rounded-[8px] bg-primary-500 text-white text-[14px] font-bold">A</span><span class="hidden sm:inline text-[15px] font-bold text-foreground whitespace-nowrap">AI Tutor</span></a><div class="flex items-center gap-1 overflow-x-auto flex-1 min-w-0" style="scrollbar-width:none;-ms-overflow-style:none;">' + links + '</div><div class="flex items-center gap-2 shrink-0">' + right + '</div></div></nav>';
}

export function mount(activeKey) {
  if (document.getElementById('ait-topnav')) return;
  const tmp = document.createElement('div');
  tmp.innerHTML = render(activeKey);
  const nav = tmp.firstElementChild;
  document.body.insertBefore(nav, document.body.firstChild);
  document.body.style.paddingTop = '64px';
  const mockBtn = nav.querySelector('[data-dom-id="nav-mock"]');
  if (mockBtn) {
    mockBtn.addEventListener('click', () => {
      setUseMock(!getMockEnabled());
      const next = getMockEnabled();
      const dotCls = next ? 'bg-warning-500' : 'bg-foreground-muted';
      const btnCls = 'inline-flex items-center gap-1.5 h-9 px-3 rounded-[10px] text-[12px] font-medium ' + (next ? 'bg-warning-50 text-warning-600' : 'bg-surface-tertiary text-foreground-muted') + ' hover:opacity-80 transition-opacity whitespace-nowrap';
      mockBtn.innerHTML = '<span class="w-1.5 h-1.5 rounded-full ' + dotCls + '"></span>Mock: ' + (next ? '开' : '关');
      mockBtn.className = btnCls;
      toast.info('Mock 已' + (next ? '开启' : '关闭') + ' (下次 request 立即生效)');
    });
  }
  const outBtn = nav.querySelector('[data-dom-id="nav-logout"]');
  if (outBtn) {
    outBtn.addEventListener('click', () => {
      if (!confirm('确定退出登录？')) return;
      clearToken();
      clearUser();
      toast.success('已退出登录');
      setTimeout(() => { window.location.href = '/f3/pages/login.html'; }, 400);
    });
  }
}

export default mount;
