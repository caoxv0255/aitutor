// Theme management utility
(function(){
  var THEME_KEY = 'aitutor_theme';
  
  var DARK_VARS = {
    '--bg': '#0b0b0d',
    '--bg-card': '#1a1a22',
    '--bg-card-hover': '#22222e',
    '--text': '#f0f0f0',
    '--text-muted': '#a0a0b0',
    '--border': '#2a2a35',
    '--shadow': '0 4px 24px rgba(0,0,0,.4)',
    '--shadow-lg': '0 8px 40px rgba(0,0,0,.6)',
    // Standalone page vars
    '--card': '#1a1a22',
    '--muted': '#a0a0b0',
    '--line': '#2a2a35',
    '--soft': '#1e1e2a',
    '--navy': '#e8e8f0',
    '--bar': '#6a8dcc',
    '--bar2': '#4a6db0',
    '--green': '#44dd88',
    '--green-soft': '#0d2818',
    '--amber': '#f0b030',
    '--amber-soft': '#2a2000',
    '--blue-soft': '#0d1528'
  };

  var LIGHT_VARS = {
    '--bg': '#f8f9fa',
    '--bg-card': '#ffffff',
    '--bg-card-hover': '#f0f0f2',
    '--text': '#1a1a22',
    '--text-muted': '#5a5a6e',
    '--border': '#e2e2e8',
    '--shadow': '0 4px 24px rgba(0,0,0,.08)',
    '--shadow-lg': '0 8px 40px rgba(0,0,0,.12)',
    // Standalone page vars (default light)
    '--card': '#ffffff',
    '--muted': '#6b7280',
    '--line': '#e5e7eb',
    '--soft': '#eff6ff',
    '--navy': '#1e293b',
    '--bar': '#93c5fd',
    '--bar2': '#60a5fa',
    '--green': '#059669',
    '--green-soft': '#ecfdf5',
    '--amber': '#d97706',
    '--amber-soft': '#fffbeb',
    '--blue-soft': '#eff6ff'
  };

  function getSystemTheme() {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function getSavedTheme() {
    var saved = localStorage.getItem(THEME_KEY);
    if (saved) return saved;
    return getSystemTheme();
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    // Override inline CSS variables for standalone pages
    var vars = theme === 'dark' ? DARK_VARS : LIGHT_VARS;
    for (var key in vars) {
      document.documentElement.style.setProperty(key, vars[key]);
    }
    // Update toggle button icon
    var btn = document.querySelector('.theme-toggle');
    if (btn) {
      btn.innerHTML = theme === 'dark'
        ? '<span class="icon-sun">&#9728;</span>'
        : '<span class="icon-moon">&#9790;</span>';
    }
    // Update body background for standalone pages that use inline styles
    var body = document.body;
    if (body && body.style.background) {
      body.style.background = theme === 'dark' ? '#0b0b0d' : '';
    }
  }

  // Initial apply
  applyTheme(getSavedTheme());

  // Listen system preference changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function(e) {
    if (!localStorage.getItem(THEME_KEY)) {
      applyTheme(e.matches ? 'dark' : 'light');
    }
  });

  // Export global functions
  window.themeToggle = function() {
    var current = document.documentElement.getAttribute('data-theme') || 'dark';
    var next = current === 'dark' ? 'light' : 'dark';
    localStorage.setItem(THEME_KEY, next);
    applyTheme(next);
    return next;
  };

  window.getTheme = function() {
    return document.documentElement.getAttribute('data-theme') || 'dark';
  };
})();
