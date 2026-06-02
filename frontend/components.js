// AI Tutor - Unified navigation, QR popup, and footer
(function() {
  var SITE_URL = 'https://aitutor.uibe.online/app';

  // Detect which page we're on
  var path = location.pathname.split('/').pop() || 'index.html';

  function isLoggedIn() {
    return !!localStorage.getItem('token');
  }

  function getUser() {
    try { return JSON.parse(localStorage.getItem('user') || '{}'); } catch(e) { return {}; }
  }

  // Build nav links based on login state
  function buildNavLinks() {
    var token = isLoggedIn();
    var links = [];
    links.push({ href: 'index.html', text: '首页', match: ['index.html', 'province.html'] });

    // Always show gaokao/zhongkao
    links.push({ href: 'zhongkao.html', text: '中考专区', match: ['zhongkao.html', 'zhongkao-policy.html'] });

    if (token) {
      links.push({ href: 'dashboard.html', text: '个人中心', match: ['dashboard.html','my-reports.html','my-weak-points.html','personalized-paper.html','question-explainer.html','learning-path.html','wrong-book.html'] });
    } else {
      links.push({ href: '2026-policy.html', text: '政策解读', match: ['2026-policy.html'] });
      links.push({ href: 'methodology.html', text: '方法论', match: ['methodology.html'] });
      links.push({ href: 'login.html', text: '登录', match: ['login.html','register.html'] });
    }

    return links;
  }

  function isActive(href, matchList) {
    if (!matchList) return path === href;
    return matchList.indexOf(path) !== -1;
  }

  // Render header
  function renderHeader() {
    var links = buildNavLinks();
    var navHtml = links.map(function(l) {
      var cls = isActive(l.href, l.match) ? ' class="active"' : '';
      return '<a href="' + l.href + '"' + cls + '>' + l.text + '</a>';
    }).join('');

    // Logout link if logged in
    var logoutHtml = isLoggedIn()
      ? '<a href="#" id="navLogout" class="nav-logout">退出</a>'
      : '';

    // QR button
    var qrBtn = '<span class="qr-trigger" id="qrTrigger" title="扫码使用手机端">扫码使用 <span class="qr-icon">&#9641;</span></span>';

    var html = '<header class="site-header">'
      + '<div class="logo">AI<span>Tutor</span></div>'
      + '<button class="theme-toggle" onclick="window.themeToggle()" title="切换主题"><span class="icon-sun">&#9728;</span><span class="icon-moon">&#9790;</span></button>'
      + '<button class="hamburger" onclick="document.querySelector(\'nav\').classList.toggle(\'open\')">&#9776;</button>'
      + '<nav>' + navHtml + logoutHtml + qrBtn + '</nav>'
      + '<div class="qr-popup" id="qrPopup">'
      +   '<div class="qr-popup-title">扫码使用手机端</div>'
      +   '<canvas id="qrCanvas"></canvas>'
      +   '<div class="qr-popup-desc">手机拍题，生成专属报告</div>'
      + '</div>'
      + '</header>';

    // Insert after body open or replace existing header
    var existing = document.querySelector('.site-header');
    if (existing) {
      existing.outerHTML = html;
    } else {
      document.body.insertAdjacentHTML('afterbegin', html);
    }

    // Generate QR code
    var canvas = document.getElementById('qrCanvas');
    if (canvas && window.QRCode) {
      QRCode.generate(SITE_URL, canvas, { moduleSize: 4, margin: 2 });
    }

    // QR toggle
    var trigger = document.getElementById('qrTrigger');
    var popup = document.getElementById('qrPopup');
    if (trigger && popup) {
      trigger.addEventListener('click', function(e) {
        e.stopPropagation();
        popup.classList.toggle('show');
      });
      document.addEventListener('click', function() {
        popup.classList.remove('show');
      });
      popup.addEventListener('click', function(e) {
        e.stopPropagation();
      });
    }

    // Logout handlers
    var logoutLink = document.getElementById('navLogout');
    if (logoutLink) {
      logoutLink.addEventListener('click', function(e) {
        e.preventDefault();
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        location.href = 'index.html';
      });
    }
  }

  // Render footer
  function renderFooter() {
    var footerHtml = '<footer class="site-footer">'
      + '<div class="footer-inner">'
      +   '<div class="footer-brand">AI<span>Tutor</span> 高考/中考错题诊断与预测学习平台</div>'
      +   '<p class="footer-desc">基于历年真题、学生错题与知识点图谱，生成个性化预测卷与强化学习方案</p>'
      +   '<div class="footer-links">'
      +     '<a href="index.html">高考专区</a>'
      +     '<a href="zhongkao.html">中考专区</a>'
      +     '<a href="2026-policy.html">政策解读</a>'
      +     '<a href="methodology.html">方法论</a>'
      +     '<a href="login.html">登录</a>'
      +   '</div>'
      +   '<p class="footer-disclaimer">本系统为学习研究与复习辅助工具，预测内容不代表官方命题方向，政策信息以北京教育考试院及教育主管部门正式发布为准。</p>'
      +   '<p class="footer-copy">aitutor.uibe.online</p>'
      + '</div>'
      + '</footer>';

    var existing = document.querySelector('.site-footer');
    if (existing) {
      existing.outerHTML = footerHtml;
    } else {
      document.body.insertAdjacentHTML('beforeend', footerHtml);
    }
  }

  // Execute on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { renderHeader(); renderFooter(); });
  } else {
    renderHeader();
    renderFooter();
  }
})();
