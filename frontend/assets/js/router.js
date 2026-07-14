/**
 * AI Tutor Router v1
 * - Unified navigation for all navbar links, CTA buttons, bottom nav, tabs
 * - Toast notifications, loading indicators, error handling
 * - Browser history management (pushState/replaceState)
 * - Dead link detection & graceful fallback
 */
(function() {
  'use strict';

  /* ── Route Map ── */
  var ROUTES = {
    'nav-home':        'home.html',
    'nav-dashboard':   'dashboard.html',
    'nav-exam':        'exam-simulation.html',
    'nav-wrong':       'wrong-book.html',
    'nav-ai':          'ai-tutor-chat.html',
    'nav-path':        'learning-journey.html',
    'cta-start':       'dashboard.html',
    'nav-exam-btn':    'exam-simulation.html',
    'cta-start-exam':  'exam-simulation.html',
    'btn-login':       'dashboard.html',
    'btn-register':    'dashboard.html',
    'btn-guest':       'dashboard.html',
    'btn-scan':        'wrong-book.html',
    'btn-ai-diagnose': 'ai-tutor-chat.html',
    'btn-submit':      'home-report.html',
    'btn-new-chat':    'ai-tutor-chat.html',
    'btn-view-solution': 'ai-tutor-chat.html'
  };

  var TAB_ROUTES = {
    'tab-home':   'home.html',
    'tab-exam':   'home-exam.html',
    'tab-report': 'home-report.html'
  };

  /* ── Valid pages ── */
  var VALID_PAGES = [
    'home.html', 'home-exam.html', 'home-report.html',
    'dashboard.html', 'exam-simulation.html',
    'wrong-book.html', 'ai-tutor-chat.html', 'learning-journey.html',
    'login.html',
    'my-reports.html'
  ];

  /* ── Toast System ── */
  var toastContainer = null;
  function getToastContainer() {
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.className = 'ait-toast-container';
      document.body.appendChild(toastContainer);
    }
    return toastContainer;
  }

  function showToast(message, type, duration) {
    type = type || 'info';
    duration = duration || 3000;
    var container = getToastContainer();
    var toast = document.createElement('div');
    toast.className = 'ait-toast ' + type;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(function() {
      toast.classList.add('removing');
      setTimeout(function() { toast.remove(); }, 250);
    }, duration);
  }

  /* ── Loading Indicator ── */
  var loadingEl = null;
  function showLoading() {
    if (loadingEl) return;
    loadingEl = document.createElement('div');
    loadingEl.className = 'ait-loading-overlay';
    loadingEl.innerHTML = '<div class="ait-loading-spinner"></div>';
    document.body.appendChild(loadingEl);
  }
  function hideLoading() {
    if (loadingEl) { loadingEl.remove(); loadingEl = null; }
  }

  /* ── Error Panel ── */
  function showError(title, message, retryFn) {
    hideLoading();
    var panel = document.createElement('div');
    panel.className = 'ait-error-panel';
    panel.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' +
      '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>' +
      '<h3>' + title + '</h3>' +
      '<p>' + message + '</p>';
    var btn = document.createElement('button');
    btn.textContent = '重试';
    btn.onclick = function() { panel.remove(); if (retryFn) retryFn(); };
    panel.appendChild(btn);
    document.body.appendChild(panel);
  }

  /* ── Navigation Core ── */
  function resolveTarget(href) {
    if (!href) return null;
    var clean = href.split('?')[0].split('#')[0];
    var parts = clean.replace(/\\/g, '/').split('/');
    var filename = parts[parts.length - 1];
    if (VALID_PAGES.indexOf(filename) !== -1) return filename;
    return null;
  }

  function navigateTo(href, pushState) {
    var target = resolveTarget(href);
    if (!target) {
      showToast('页面不存在: ' + href, 'error');
      return;
    }

    var currentPage = window.location.pathname.split('/').pop() || 'home.html';
    if (target === currentPage) {
      showToast('当前已在目标页面', 'info', 1500);
      return;
    }

    showLoading();

    if (pushState !== false) {
      try { window.history.pushState({ page: target }, '', target); } catch(e) {}
    }

    setTimeout(function() {
      window.location.href = target;
    }, 300);
  }

  var TEXT_ROUTES = {
    '立即开始':       'dashboard.html',
    '开始做题':       'exam-simulation.html',
    '查看预测卷':     'exam-simulation.html',
    '扫描错题':       'wrong-book.html',
    '立即扫描':       'wrong-book.html',
    'AI诊断':         'ai-tutor-chat.html',
    '查看解析':       'ai-tutor-chat.html',
    '查看解答':       'ai-tutor-chat.html',
    '交卷':           'home-report.html',
    '开始讲题':       'ai-tutor-chat.html',
    '生成试卷':       'exam-simulation.html',
    '新对话':         'ai-tutor-chat.html'
  };

  var TEXT_TOASTS = {
    '暂停':           '暂停功能开发中',
    '发送':           '发送功能开发中',
    '查看样例':       '样例报告功能开发中',
    '上一页':         '分页功能开发中',
    '下一页':         '分页功能开发中'
  };

  /* ── Event Binding ── */
  function bindEvents() {
    // 1. All elements with data-dom-id
    var domIds = document.querySelectorAll('[data-dom-id]');
    for (var i = 0; i < domIds.length; i++) {
      (function(el) {
        var id = el.getAttribute('data-dom-id');

        // Tab buttons: handled separately
        if (TAB_ROUTES[id]) {
          el.addEventListener('click', function(e) {
            e.preventDefault();
            navigateTo(TAB_ROUTES[id], true);
          });
          return;
        }

        // Navigation/CTA buttons
        if (ROUTES[id]) {
          el.addEventListener('click', function(e) {
            e.preventDefault();
            showToast('正在跳转...', 'info', 800);
            navigateTo(ROUTES[id], true);
          });
          return;
        }
      })(domIds[i]);
    }

    // 2. All <a> tags with .navbar-link class
    var navLinks = document.querySelectorAll('a.navbar-link');
    for (var j = 0; j < navLinks.length; j++) {
      (function(link) {
        var href = link.getAttribute('href');
        if (!href || href === '#' || href.startsWith('javascript')) return;
        link.addEventListener('click', function(e) {
          e.preventDefault();
          navigateTo(href, true);
        });
      })(navLinks[j]);
    }

    // 3. Bottom nav links
    var bottomLinks = document.querySelectorAll('a.bottom-nav-item');
    for (var k = 0; k < bottomLinks.length; k++) {
      (function(link) {
        var href = link.getAttribute('href');
        if (!href || href === '#' || href.startsWith('javascript')) return;
        link.addEventListener('click', function(e) {
          e.preventDefault();
          navigateTo(href, true);
        });
      })(bottomLinks[k]);
    }

    // 4. All other <a> tags (ghost buttons, feature cards, etc.)
    var allLinks = document.querySelectorAll('a[href$=".html"]');
    for (var m = 0; m < allLinks.length; m++) {
      (function(link) {
        if (link.classList.contains('navbar-link') || link.classList.contains('bottom-nav-item')) return;
        var href = link.getAttribute('href');
        link.addEventListener('click', function(e) {
          e.preventDefault();
          navigateTo(href, true);
        });
      })(allLinks[m]);
    }

    // 5. Buttons with text content (without data-dom-id)
    var allButtons = document.querySelectorAll('button.btn');
    for (var n = 0; n < allButtons.length; n++) {
      (function(btn) {
        if (btn.hasAttribute('data-dom-id')) return;
        var text = btn.textContent.trim();
        if (TEXT_ROUTES[text]) {
          btn.addEventListener('click', function(e) {
            e.preventDefault();
            showToast('正在跳转...', 'info', 800);
            navigateTo(TEXT_ROUTES[text], true);
          });
        } else if (TEXT_TOASTS[text]) {
          btn.addEventListener('click', function(e) {
            e.preventDefault();
            showToast(TEXT_TOASTS[text], 'info', 2000);
          });
        }
      })(allButtons[n]);
    }

    // 6. Feature cards and interactive elements
    var featureCards = document.querySelectorAll('.card-interactive, .feature-card');
    for (var p = 0; p < featureCards.length; p++) {
      (function(card) {
        var heading = card.querySelector('.card-heading, .feature-title, h3, h4');
        if (heading) {
          var cardText = heading.textContent.trim();
          if (TEXT_ROUTES[cardText]) {
            card.addEventListener('click', function(e) {
              e.preventDefault();
              showToast('正在跳转...', 'info', 800);
              navigateTo(TEXT_ROUTES[cardText], true);
            });
          }
        }
      })(featureCards[p]);
    }

    // 7. Popstate — browser back/forward
    window.addEventListener('popstate', function(e) {
      if (e.state && e.state.page) {
        navigateTo(e.state.page, false);
      }
    });
  }

  /* ── Init ── */
  function init() {
    // Replace current history state
    var currentPage = window.location.pathname.split('/').pop() || 'home.html';
    try { window.history.replaceState({ page: currentPage }, '', currentPage); } catch(e) {}

    bindEvents();

    // Initial page load state in history
    try { window.history.replaceState({ page: currentPage }, document.title || 'AI Tutor', window.location.pathname); } catch(e) {}
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose toast for other scripts
  window.AIT = window.AIT || {};
  window.AIT.showToast = showToast;
  window.AIT.showLoading = showLoading;
  window.AIT.hideLoading = hideLoading;
  window.AIT.navigateTo = navigateTo;
})();
