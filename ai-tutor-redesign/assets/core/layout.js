export class LayoutManager {
    constructor(options = {}) {
        this.options = options;
        this.layoutType = options.layout || 'default';
        this.currentUser = options.user || null;
        this.init();
    }

    init() {
        this.renderLayout();
        this.bindEvents();
    }

    renderLayout() {
        const layoutMap = {
            sidebar: () => this.renderSidebarLayout(),
            fullpage: () => this.renderFullPageLayout(),
            dashboard: () => this.renderDashboardLayout(),
            default: () => this.renderDefaultLayout()
        };

        const renderer = layoutMap[this.layoutType];
        if (renderer) {
            renderer();
        }
    }

    renderSidebarLayout() {
        const sidebarHtml = `
            <aside class="sidebar">
                <div class="sidebar__logo">
                    <div class="sidebar__logo-icon">A</div>
                    <span class="sidebar__logo-text">AI Tutor</span>
                </div>
                
                <nav class="sidebar__nav">
                    <a href="home.html" class="sidebar__nav-item" data-nav-item="home">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                            <polyline points="9 22 9 12 15 12 15 22"/>
                        </svg>
                        <span>首页</span>
                    </a>
                    <a href="dashboard.html" class="sidebar__nav-item" data-nav-item="dashboard">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="3" y="3" width="7" height="7"/>
                            <rect x="14" y="3" width="7" height="7"/>
                            <rect x="14" y="14" width="7" height="7"/>
                            <rect x="3" y="14" width="7" height="7"/>
                        </svg>
                        <span>学习驾驶舱</span>
                    </a>
                    <a href="exam-simulation.html" class="sidebar__nav-item" data-nav-item="exam">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                            <polyline points="14 2 14 8 20 8"/>
                            <line x1="16" y1="13" x2="8" y2="13"/>
                            <line x1="16" y1="17" x2="8" y2="17"/>
                        </svg>
                        <span>模拟考场</span>
                    </a>
                    <a href="wrong-book.html" class="sidebar__nav-item" data-nav-item="wrong">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                            <polyline points="14 2 14 8 20 8"/>
                            <line x1="9" y1="13" x2="15" y2="13"/>
                        </svg>
                        <span>错题本</span>
                    </a>
                    <a href="ai-tutor-chat.html" class="sidebar__nav-item" data-nav-item="ai">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                        </svg>
                        <span>AI讲题</span>
                    </a>
                    <a href="learning-journey.html" class="sidebar__nav-item" data-nav-item="journey">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"/>
                            <polyline points="12 6 12 12 16 14"/>
                        </svg>
                        <span>学习旅程</span>
                    </a>
                    <a href="home-report.html" class="sidebar__nav-item" data-nav-item="report">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/>
                        </svg>
                        <span>学习报告</span>
                    </a>
                </nav>

                <div class="sidebar__user" id="sidebar-user">
                    ${this.renderUserInfo()}
                </div>
            </aside>
        `;

        document.body.insertAdjacentHTML('afterbegin', sidebarHtml);
    }

    renderFullPageLayout() {
        const headerHtml = `
            <header class="navbar">
                <button class="navbar__back" onclick="window.history.back()">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M19 12H5"/><polyline points="12 19 5 12 12 5"/>
                    </svg>
                </button>
                <div class="navbar__title">${this.options.title || 'AI Tutor'}</div>
                <div class="navbar__actions">
                    ${this.options.headerActions || ''}
                </div>
            </header>
        `;
        document.body.insertAdjacentHTML('afterbegin', headerHtml);
    }

    renderDashboardLayout() {
        this.renderSidebarLayout();
        const navbarHtml = `
            <header class="navbar">
                <div class="navbar__logo">
                    <div class="navbar__logo-icon">A</div>
                    <span>AI Tutor</span>
                </div>
                <nav>
                    <ul class="navbar__links">
                        <li><a class="navbar__link" href="home.html">首页</a></li>
                        <li><a class="navbar__link" href="dashboard.html">学习驾驶舱</a></li>
                        <li><a class="navbar__link" href="exam-simulation.html">模拟考场</a></li>
                        <li><a class="navbar__link" href="wrong-book.html">错题本</a></li>
                        <li><a class="navbar__link" href="ai-tutor-chat.html">AI讲题</a></li>
                    </ul>
                </nav>
                <div class="navbar__actions">
                    <div class="navbar__province-select">
                        <i data-lucide="map-pin"></i>
                        <span>广东</span>
                        <i data-lucide="chevron-down"></i>
                    </div>
                    <button id="theme-toggle" class="navbar__theme-btn" title="切换主题">
                        <svg id="theme-icon-dark" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                        </svg>
                        <svg id="theme-icon-light" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display: none;">
                            <circle cx="12" cy="12" r="5"/>
                            <line x1="12" y1="1" x2="12" y2="3"/>
                            <line x1="12" y1="21" x2="12" y2="23"/>
                            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                            <line x1="1" y1="12" x2="3" y2="12"/>
                            <line x1="21" y1="12" x2="23" y2="12"/>
                            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                        </svg>
                    </button>
                    <button class="navbar__hamburger" aria-label="菜单">
                        <i data-lucide="menu"></i>
                    </button>
                </div>
            </header>
        `;
        document.body.insertAdjacentHTML('beforeend', navbarHtml);
    }

    renderDefaultLayout() {
        const navbarHtml = `
            <nav class="navbar">
                <a href="home.html" class="navbar__logo">
                    <div class="navbar__logo-icon">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M12 2a10 10 0 0 0-10 10c0 5 3.5 9.5 8.5 9.95V17h-2v-2h2V9.5c0-1.5.5-2.5 2.5-2.5h2.5v2H15v2h-2v6.95c5-.45 8.5-4.95 8.5-9.95a10 10 0 0 0-10-10z"/>
                        </svg>
                    </div>
                    <span>AI Tutor</span>
                </a>

                <ul class="navbar__links">
                    <li><a href="home.html" class="navbar__link">首页</a></li>
                    <li><a href="dashboard.html" class="navbar__link">学习驾驶舱</a></li>
                    <li><a href="exam-simulation.html" class="navbar__link">模拟考场</a></li>
                    <li><a href="wrong-book.html" class="navbar__link">错题本</a></li>
                    <li><a href="ai-tutor-chat.html" class="navbar__link">AI讲题</a></li>
                    <li><a href="learning-journey.html" class="navbar__link">学习旅程</a></li>
                </ul>

                <div class="navbar__actions">
                    <div id="user-info" class="navbar__user" style="display:none;">
                        ${this.renderUserInfo()}
                    </div>
                    <button class="navbar__theme-btn" id="theme-toggle" title="切换主题">
                        <svg id="theme-icon-dark" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                        </svg>
                        <svg id="theme-icon-light" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:none;">
                            <circle cx="12" cy="12" r="5"/>
                            <line x1="12" y1="1" x2="12" y2="3"/>
                            <line x1="12" y1="21" x2="12" y2="23"/>
                            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                            <line x1="1" y1="12" x2="3" y2="12"/>
                            <line x1="21" y1="12" x2="23" y2="12"/>
                            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                        </svg>
                    </button>
                    <button class="navbar__hamburger" onclick="toggleNavOverlay()">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="3" y1="6" x2="21" y2="6"/>
                            <line x1="3" y1="12" x2="21" y2="12"/>
                            <line x1="3" y1="18" x2="21" y2="18"/>
                        </svg>
                    </button>
                </div>
            </nav>
        `;
        document.body.insertAdjacentHTML('afterbegin', navbarHtml);
    }

    renderUserInfo() {
        if (!this.currentUser) {
            return `
                <div class="sidebar__user-avatar" style="background-color: var(--accent);">A</div>
                <div class="sidebar__user-info">
                    <span class="sidebar__user-name">同学</span>
                    <span class="sidebar__user-role">学生</span>
                </div>
            `;
        }
        const avatarColor = this.currentUser.role === 'student' ? '#3d5a80' : 
                           this.currentUser.role === 'teacher' ? '#2d6a4f' : '#c44536';
        const roleText = this.currentUser.role === 'student' ? '学生' : 
                        this.currentUser.role === 'teacher' ? '教师' : '管理员';
        return `
            <div class="sidebar__user-avatar" style="background-color: ${avatarColor};">${this.currentUser.name.charAt(0)}</div>
            <div class="sidebar__user-info">
                <span class="sidebar__user-name">${this.currentUser.name}</span>
                <span class="sidebar__user-role">${roleText}</span>
            </div>
            <button style="background:none;border:none;color:var(--muted);cursor:pointer;padding:2px;" onclick="logout()">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                    <polyline points="16 17 21 12 16 7"/>
                    <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
            </button>
        `;
    }

    renderBottomNav() {
        const bottomNavHtml = `
            <nav class="bottom-nav">
                <a href="home.html" class="bottom-nav__item" data-nav-item="home">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                        <polyline points="9 22 9 12 15 12 15 22"/>
                    </svg>
                    <span>首页</span>
                </a>
                <a href="exam-simulation.html" class="bottom-nav__item" data-nav-item="exam">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                        <polyline points="14 2 14 8 20 8"/>
                        <line x1="16" y1="13" x2="8" y2="13"/>
                        <line x1="16" y1="17" x2="8" y2="17"/>
                    </svg>
                    <span>做题</span>
                </a>
                <a href="wrong-book.html" class="bottom-nav__item" data-nav-item="wrong">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                        <polyline points="14 2 14 8 20 8"/>
                        <line x1="9" y1="13" x2="15" y2="13"/>
                    </svg>
                    <span>错题</span>
                </a>
                <a href="ai-tutor-chat.html" class="bottom-nav__item" data-nav-item="ai">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    </svg>
                    <span>AI讲题</span>
                </a>
                <a href="dashboard.html" class="bottom-nav__item" data-nav-item="dashboard">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="3" width="7" height="7"/>
                        <rect x="14" y="3" width="7" height="7"/>
                        <rect x="14" y="14" width="7" height="7"/>
                        <rect x="3" y="14" width="7" height="7"/>
                    </svg>
                    <span>我的</span>
                </a>
            </nav>
        `;
        document.body.insertAdjacentHTML('beforeend', bottomNavHtml);
    }

    bindEvents() {
        this.updateActiveNav();
        
        document.querySelectorAll('[data-nav-item]').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const href = link.getAttribute('href');
                if (href) {
                    window.location.href = href;
                }
            });
        });
    }

    updateActiveNav() {
        const currentPage = window.location.pathname.split('/').pop() || 'home.html';
        const pageMap = {
            'home.html': 'home',
            'dashboard.html': 'dashboard',
            'exam-simulation.html': 'exam',
            'wrong-book.html': 'wrong',
            'ai-tutor-chat.html': 'ai',
            'learning-journey.html': 'journey',
            'home-report.html': 'report'
        };
        const currentItem = pageMap[currentPage] || 'home';

        document.querySelectorAll('[data-nav-item]').forEach(item => {
            const itemName = item.getAttribute('data-nav-item');
            if (itemName === currentItem) {
                item.classList.add('sidebar__nav-item--active');
                item.classList.add('bottom-nav__item--active');
                item.classList.add('navbar__link--active');
            } else {
                item.classList.remove('sidebar__nav-item--active');
                item.classList.remove('bottom-nav__item--active');
                item.classList.remove('navbar__link--active');
            }
        });
    }

    static init(options) {
        return new LayoutManager(options);
    }
}