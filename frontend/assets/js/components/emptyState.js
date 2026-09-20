/* ============================================================================
 * EmptyState 组件 · P11 抽离版
 *
 * 用途：全站空状态 / 错误状态 / 引导态的统一渲染
 * 设计稿：P5 EmptyState / 5 Scenes（错题本空 / 复习完成 / 图谱未生成 / 路径失败 / 搜索无结果）
 * Token：与 Design Token v1 完全对齐（standard + Legacy aliases 兼容）
 *
 * 用法（UMD 双栈）：
 *   <script src="assets/js/components/emptyState.js"></script>
 *   <script>
 *     // 函数式 API（推荐）
 *     document.body.appendChild(
 *       renderEmptyState({ scenario: 'pathFail', title: '...', description: '...',
 *         primary_action: { label: '重试', target_url: '...' } })
 *     );
 *     // 或：mountEmptyState(elementId, config) 把 EmptyState 渲染到指定容器
 *   </script>
 *
 * 5 个 scenario 默认映射（icon / 颜色 / 文案）：
 *   - wrongBook     错题本空         primary-500
 *   - reviewDone    复习完成         success-500
 *   - abilityMap    能力图谱未生成   info-500
 *   - pathFail      学习路径失败     danger-500
 *   - searchEmpty   搜索无结果       neutral-400
 *   - newUser       新用户空数据     primary-500
 * ============================================================================ */

(function(factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    /* global window */
    (typeof self !== 'undefined' ? self : this).EmptyState = factory();
  }
})(function() {

  // ====== 5 场景默认配置（P5 设计稿）======
  var SCENE_CONFIG = {
    wrongBook: {
      icon:    'notebook-pen',
      color:   'var(--ait-color-primary-500)',
      bg:      'var(--ait-color-primary-50)',
      title:   '还没有错题记录哦',
      desc:    '拍一道题，让 aitutor 帮你分析哪里错了。',
      primary: { label: '拍一道题', icon: 'camera' },
      secondary: { label: '手动输入', icon: 'pencil-line' }
    },
    reviewDone: {
      icon:    'party-popper',
      color:   'var(--ait-color-success-500)',
      bg:      'var(--ait-color-success-50)',
      title:   '今天的复习任务都完成了',
      desc:    '坚持是最高效的方法，明天继续。',
      primary: { label: '返回首页', icon: 'home' },
      secondary: { label: '看看错题本', icon: 'notebook-pen' }
    },
    abilityMap: {
      icon:    'network',
      color:   'var(--ait-color-info-500)',
      bg:      'var(--ait-color-info-50)',
      title:   '能力图谱还在生成中',
      desc:    '做几道题之后，就能看到你的知识星空啦。',
      primary: { label: '去做几道题', icon: 'zap' },
      secondary: { label: '返回', icon: 'arrow-left' }
    },
    pathFail: {
      icon:    'alert-circle',
      color:   'var(--ait-color-danger-500)',
      bg:      'var(--ait-color-danger-50)',
      title:   '学习路径生成失败',
      desc:    'aitutor 正在努力准备，再试一次吧。',
      primary: { label: '重新生成', icon: 'refresh-cw' },
      secondary: { label: '去看错题本', icon: 'notebook-pen' }
    },
    searchEmpty: {
      icon:    'search-x',
      color:   'var(--ait-color-neutral-400)',
      bg:      'var(--ait-color-neutral-100)',
      title:   '没有找到相关内容',
      desc:    '试试换个关键词，或者清空筛选条件。',
      primary: { label: '清空筛选', icon: 'filter-x' },
      secondary: { label: '返回', icon: 'arrow-left' }
    },
    newUser: {
      icon:    'user-plus',
      color:   'var(--ait-color-primary-500)',
      bg:      'var(--ait-color-primary-50)',
      title:   '欢迎来到 aitutor',
      desc:    '先做几道诊断题，aitutor 就能为你定制专属学习路径。',
      primary: { label: '去诊断一下', icon: 'sparkles' },
      secondary: { label: '去拍照录题', icon: 'camera' }
    }
  };

  // ====== 工具 =======
  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function renderAction(act, kind) {
    if (!act || !act.label) return '';
    var isPrimary = kind === 'primary';
    var cls = isPrimary ? 'es-cta es-cta--primary' : 'es-cta es-cta--secondary';
    var icon = act.icon ? '<i data-lucide="' + escapeHtml(act.icon) + '"></i>' : '';
    var href = act.target_url ? act.target_url : '#';
    var onclick = act.onClick ? ' data-es-onclick="1"' : '';
    if (act.onClick) {
      return '<button type="button" class="' + cls + '"' + onclick + '>' + icon + ' ' + escapeHtml(act.label) + '</button>';
    }
    return '<a href="' + escapeHtml(href) + '" class="' + cls + '">' + icon + ' ' + escapeHtml(act.label) + '</a>';
  }

  /**
   * 渲染 EmptyState 为 HTMLElement（不插入 DOM）
   * @param {object} cfg
   *   - scenario (string, 可选)  从 SCENE_CONFIG 加载默认配置
   *   - title / description (string) 覆盖默认
   *   - icon / iconColor / iconBg 覆盖默认
   *   - primary_action / secondary_action { label, icon, target_url, onClick }
   *   - className (string) 可选，附加到根元素
   * @returns HTMLElement
   */
  function renderEmptyState(cfg) {
    cfg = cfg || {};
    var scene = SCENE_CONFIG[cfg.scenario] || SCENE_CONFIG.pathFail;
    var icon    = cfg.icon    || scene.icon;
    var color   = cfg.iconColor || cfg.icon_color || scene.color;
    var bg      = cfg.iconBg  || cfg.icon_bg    || scene.bg;
    var title   = cfg.title   || scene.title;
    var desc    = cfg.description || scene.desc;
    var primary = cfg.primary_action   || scene.primary;
    var secondary = cfg.secondary_action || scene.secondary;

    var el = document.createElement('section');
    el.className = 'es ' + (cfg.className || '');
    el.setAttribute('data-es-scenario', cfg.scenario || 'pathFail');
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    el.innerHTML =
      '<div class="es__art" style="background:' + bg + ';">' +
        '<i data-lucide="' + escapeHtml(icon) + '" style="color:' + color + ';"></i>' +
      '</div>' +
      '<h2 class="es__title">' + escapeHtml(title) + '</h2>' +
      (desc ? '<p class="es__desc">' + escapeHtml(desc) + '</p>' : '') +
      '<div class="es__cta-row">' +
        renderAction(primary,   'primary') +
        renderAction(secondary, 'secondary') +
      '</div>';

    // 绑定 onClick 回调（如果用户传了）
    Array.prototype.slice.call(el.querySelectorAll('[data-es-onclick]')).forEach(function(btn) {
      var isPrimary = btn.className.indexOf('es-cta--primary') >= 0;
      var act = isPrimary ? primary : secondary;
      if (act && typeof act.onClick === 'function') {
        btn.addEventListener('click', function(ev) {
          ev.preventDefault();
          act.onClick();
        });
      }
    });

    // Lucide 图标注入
    if (typeof window !== 'undefined' && window.lucide && typeof window.lucide.createIcons === 'function') {
      // 异步确保 DOM 已挂入再渲染图标
      setTimeout(function() { try { window.lucide.createIcons(); } catch (_) {} }, 0);
    }

    return el;
  }

  /**
   * 挂载到指定容器
   */
  function mountEmptyState(target, cfg) {
    var el = (typeof target === 'string')
      ? document.getElementById(target)
      : target;
    if (!el) {
      // 找不到容器时直接 return detached element
      return renderEmptyState(cfg);
    }
    el.innerHTML = '';
    el.appendChild(renderEmptyState(cfg));
    return el;
  }

  // ====== 暴露 API ======
  return {
    render: renderEmptyState,
    mount:  mountEmptyState,
    SCENES: SCENE_CONFIG
  };

});
