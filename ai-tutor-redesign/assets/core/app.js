import { Router } from './router.js';
import { ThemeManager } from './theme.js';
import { LayoutManager } from './layout.js';

export class App {
    constructor() {
        this.router = null;
        this.themeManager = null;
        this.layoutManager = null;
        this.currentUser = null;
        this.init();
    }

    init() {
        this.loadUser();
        this.initTheme();
        this.initRouter();
        this.initLayout();
        this.bindGlobalEvents();
    }

    loadUser() {
        const stored = localStorage.getItem('user');
        if (stored) {
            try {
                this.currentUser = JSON.parse(stored);
            } catch (e) {
                this.currentUser = null;
            }
        }
    }

    saveUser(user) {
        this.currentUser = user;
        localStorage.setItem('user', JSON.stringify(user));
        this.updateUserUI();
    }

    logout() {
        this.currentUser = null;
        localStorage.removeItem('user');
        localStorage.removeItem('role');
        this.router.navigate('home.html');
        location.reload();
    }

    updateUserUI() {
        const userInfoEl = document.getElementById('user-info');
        if (userInfoEl) {
            userInfoEl.style.display = this.currentUser ? 'flex' : 'none';
        }
    }

    initTheme() {
        this.themeManager = new ThemeManager();
        this.themeManager.init();
    }

    initRouter() {
        this.router = new Router({
            routes: {
                'home.html': () => this.handleRoute('home'),
                'dashboard.html': () => this.handleRoute('dashboard'),
                'exam-simulation.html': () => this.handleRoute('exam'),
                'wrong-book.html': () => this.handleRoute('wrong'),
                'ai-tutor-chat.html': () => this.handleRoute('ai'),
                'learning-journey.html': () => this.handleRoute('journey'),
                'home-report.html': () => this.handleRoute('report'),
                'exam-paper.html': () => this.handleRoute('paper'),
                'exam-start.html': () => this.handleRoute('exam-start')
            }
        });
        this.router.init();
    }

    initLayout() {
        const currentPage = window.location.pathname.split('/').pop() || 'home.html';
        let layoutType = 'default';
        
        if (currentPage === 'dashboard.html') {
            layoutType = 'dashboard';
        } else if (['exam-start.html', 'exam-paper.html'].includes(currentPage)) {
            layoutType = 'fullpage';
        }

        this.layoutManager = new LayoutManager({
            layout: layoutType,
            user: this.currentUser
        });

        if (['home.html', 'exam-simulation.html', 'wrong-book.html', 'ai-tutor-chat.html'].includes(currentPage)) {
            this.layoutManager.renderBottomNav();
        }
    }

    handleRoute(page) {
        console.log('Navigated to:', page);
    }

    bindGlobalEvents() {
        this.bindThemeToggle();
        this.bindLogout();
        this.bindNavOverlay();
        this.bindResize();
    }

    bindThemeToggle() {
        const toggleBtn = document.getElementById('theme-toggle');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                this.themeManager.toggle();
            });
        }
    }

    bindLogout() {
        window.logout = () => {
            this.logout();
        };
    }

    bindNavOverlay() {
        window.toggleNavOverlay = () => {
            const overlay = document.getElementById('nav-overlay');
            if (overlay) {
                overlay.classList.toggle('nav-overlay--open');
            } else {
                this.createNavOverlay();
            }
        };
    }

    createNavOverlay() {
        const overlayHtml = `
            <div id="nav-overlay" class="nav-overlay">
                <div class="nav-overlay__backdrop" onclick="toggleNavOverlay()"></div>
                <div class="nav-overlay__content">
                    <div class="nav-overlay__header">
                        <span>导航菜单</span>
                        <button onclick="toggleNavOverlay()">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="18" y1="6" x2="6" y2="18"/>
                                <line x1="6" y1="6" x2="18" y2="18"/>
                            </svg>
                        </button>
                    </div>
                    <ul class="nav-overlay__links">
                        <li><a href="home.html" onclick="toggleNavOverlay()">首页</a></li>
                        <li><a href="dashboard.html" onclick="toggleNavOverlay()">学习驾驶舱</a></li>
                        <li><a href="exam-simulation.html" onclick="toggleNavOverlay()">模拟考场</a></li>
                        <li><a href="wrong-book.html" onclick="toggleNavOverlay()">错题本</a></li>
                        <li><a href="ai-tutor-chat.html" onclick="toggleNavOverlay()">AI讲题</a></li>
                        <li><a href="learning-journey.html" onclick="toggleNavOverlay()">学习旅程</a></li>
                        <li><a href="home-report.html" onclick="toggleNavOverlay()">学习报告</a></li>
                    </ul>
                    ${this.currentUser ? `
                        <div class="nav-overlay__user">
                            <div style="background-color: ${this.currentUser.role === 'student' ? '#3d5a80' : '#2d6a4f'}" class="nav-overlay__avatar">
                                ${this.currentUser.name.charAt(0)}
                            </div>
                            <div>
                                <span>${this.currentUser.name}</span>
                                <span>${this.currentUser.role === 'student' ? '学生' : '教师'}</span>
                            </div>
                            <button onclick="logout()">退出登录</button>
                        </div>
                    ` : `
                        <div class="nav-overlay__user">
                            <button class="btn btn-primary" onclick="window.location.href='home.html'">登录</button>
                        </div>
                    `}
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', overlayHtml);
    }

    bindResize() {
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                this.handleResize();
            }, 250);
        });
    }

    handleResize() {
        const sidebar = document.querySelector('.sidebar');
        const navOverlay = document.getElementById('nav-overlay');
        
        if (window.innerWidth >= 768) {
            if (navOverlay) {
                navOverlay.classList.remove('nav-overlay--open');
            }
            if (sidebar) {
                sidebar.classList.remove('sidebar--collapsed');
            }
        }
    }

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast--${type}`;
        toast.innerHTML = `
            <span>${message}</span>
            <button onclick="this.parentElement.remove()">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
            </button>
        `;
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(-10px)';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    showLoading(message = '加载中...') {
        const loading = document.createElement('div');
        loading.className = 'loading-overlay';
        loading.id = 'app-loading';
        loading.innerHTML = `
            <div class="loading-spinner"></div>
            <span>${message}</span>
        `;
        document.body.appendChild(loading);
    }

    hideLoading() {
        const loading = document.getElementById('app-loading');
        if (loading) {
            loading.remove();
        }
    }

    static getInstance() {
        if (!App._instance) {
            App._instance = new App();
        }
        return App._instance;
    }
}

App._instance = null;

document.addEventListener('DOMContentLoaded', () => {
    App.getInstance();
});

window.app = App.getInstance();