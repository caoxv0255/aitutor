// frontend/assets/js/custom-listbox.js — D077 自定义下拉列表 (替代 <select>)
// 适配浅色 / 深色主题 + 键盘 a11y + 点击外部关闭
//
// 用法:
//   <select class="clb">
//     <option value="x">Label</option>
//   </select>
//
//   <script src="assets/js/custom-listbox.js" defer></script>
//   <script>window.initCustomListboxes && window.initCustomListboxes();</script>
//
// 兼容性:
//   - 保留原生 form 语义: 真实 <select> 在 widget 下, value/change 同步
//   - inputForm 表单 submit 仍可读 .value
//   - on('change', fn) 仍触发
//   - 多个 widget 互不干扰, 全局 ARIA 正确
//
// 设计 (D077, 2026-08-27):
//   1. 找到 .clb <select>, 把它包一层 .clb-wrap (position: relative)
//   2. 隐藏原 select (但保留 DOM, 仍可读 value / 仍可被 form 取值)
//   3. 在 select 之后插入 .clb-trigger (button-like) + .clb-popover (隐藏)
//   4. trigger 显示当前选中 option 的 label + 箭头
//   5. popover 是 ul[role=option], 每条 li[role=option]
//   6. 点击 trigger 切换 aria-expanded + 显示 popover (绝对定位在 trigger 下方)
//   7. 点击 li: 同步原 select.value='x' + dispatchEvent('change') + 更新 trigger label + 关闭 popover
//   8. 键盘: ArrowDown/Up 移动高亮, Enter 选, Esc 关闭, Tab 切焦点
//   9. 点击 popover 外 / Esc / 切换其他 widget → 关闭当前
//   10. 主题走 [data-theme="dark"] CSS 变量; 不需要 JS 配合

(function() {
  'use strict';

  let openInstance = null;
  let documentClickHandler = null;

  function buildLabel(opt) {
    return opt ? opt.textContent : '';
  }

  function syncNativeSelect(nativeSel, code) {
    if (nativeSel.value === code) return;
    nativeSel.value = code;
    // Dispatch native change so existing addEventListener('change', ...) fires
    nativeSel.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function closeAll() {
    if (openInstance) {
      openInstance.popover.style.display = 'none';
      openInstance.trigger.setAttribute('aria-expanded', 'false');
      openInstance = null;
    }
  }

  function openWidget(widget) {
    if (openInstance && openInstance !== widget) closeAll();
    widget.popover.style.display = 'block';
    widget.trigger.setAttribute('aria-expanded', 'true');
    openInstance = widget;
    // Position highlight to selected option
    const selected = widget.popover.querySelector('.clb-option[aria-selected="true"]');
    if (selected) {
      const allOpts = Array.from(widget.popover.querySelectorAll('.clb-option'));
      const idx = allOpts.indexOf(selected);
      widget._highlightIndex = idx;
      setHighlight(widget, idx);
    } else {
      widget._highlightIndex = -1;
    }
  }

  function setHighlight(widget, idx) {
    const opts = Array.from(widget.popover.querySelectorAll('.clb-option'));
    opts.forEach((el, i) => {
      el.setAttribute('aria-activedescendant', i === idx ? 'true' : 'false');
      el.classList.toggle('is-highlighted', i === idx);
    });
    const hl = opts[idx];
    if (hl) {
      const pop = widget.popover;
      const itemTop = hl.offsetTop;
      const itemBot = itemTop + hl.offsetHeight;
      if (itemTop < pop.scrollTop) {
        pop.scrollTop = itemTop;
      } else if (itemBot > pop.scrollTop + pop.clientHeight) {
        pop.scrollTop = itemBot - pop.clientHeight;
      }
    }
  }

  function buildWidget(nativeSel) {
    const id = nativeSel.id || ('clb-' + Math.random().toString(36).slice(2, 8));
    // Wrap
    const wrap = document.createElement('div');
    wrap.className = 'clb-wrap';
    nativeSel.parentNode.insertBefore(wrap, nativeSel);
    wrap.appendChild(nativeSel);
    // Hide native select but keep it form-submittable
    nativeSel.classList.add('clb-native');
    nativeSel.setAttribute('aria-hidden', 'true');
    nativeSel.tabIndex = -1;
    // Trigger button
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'clb-trigger';
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-labelledby', id + '-label');
    trigger.id = id + '-trigger';
    const cur = nativeSel.options[nativeSel.selectedIndex];
    trigger.innerHTML = `
      <span class="clb-trigger-text">${escapeHtml(buildLabel(cur))}</span>
      <svg class="clb-trigger-caret" viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
        <path d="M3 5l3 3 3-3" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;
    wrap.appendChild(trigger);
    // Popover (ul)
    const popover = document.createElement('div');
    popover.className = 'clb-popover';
    popover.style.display = 'none';
    popover.id = id + '-popover';
    const list = document.createElement('ul');
    list.className = 'clb-list';
    list.setAttribute('role', 'listbox');
    list.setAttribute('aria-labelledby', id + '-label');
    list.tabIndex = -1;
    popover.appendChild(list);
    wrap.appendChild(popover);
    // Build options
    Array.from(nativeSel.options).forEach((opt, i) => {
      const li = document.createElement('li');
      li.className = 'clb-option';
      li.setAttribute('role', 'option');
      li.dataset.value = opt.value;
      li.id = id + '-opt-' + i;
      li.textContent = opt.textContent;
      if (opt.disabled) {
        li.setAttribute('aria-disabled', 'true');
        li.classList.add('is-disabled');
      }
      if (opt.selected) li.setAttribute('aria-selected', 'true');
      li.addEventListener('mouseenter', () => {
        widget._highlightIndex = i;
        setHighlight(widget, i);
      });
      li.addEventListener('click', (e) => {
        e.preventDefault();
        if (opt.disabled) return;
        selectOption(widget, opt.value, opt.textContent);
        closeAll();
        trigger.focus();
      });
      list.appendChild(li);
    });

    function selectOption(widget, value, label) {
      syncNativeSelect(widget.nativeSel, value);
      widget.trigger.querySelector('.clb-trigger-text').textContent = label;
      const allOpts = Array.from(widget.popover.querySelectorAll('.clb-option'));
      allOpts.forEach((el) => el.setAttribute('aria-selected', el.dataset.value === value ? 'true' : 'false'));
      widget._selectedValue = value;
    }

    const widget = {
      nativeSel,
      trigger,
      popover,
      wrap,
      _highlightIndex: -1,
      _selectedValue: nativeSel.value,
    };
    return widget;
  }

  function attachBehavior(widget) {
    const trigger = widget.trigger;
    const popover = widget.popover;
    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      if (openInstance === widget) { closeAll(); return; }
      openWidget(widget);
    });
    trigger.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (openInstance !== widget) openWidget(widget);
        const opts = Array.from(popover.querySelectorAll('.clb-option:not(.is-disabled)'));
        if (opts.length === 0) return;
        const cur = widget._highlightIndex;
        let next = cur + (e.key === 'ArrowDown' ? 1 : -1);
        if (next < 0) next = opts.length - 1;
        if (next >= opts.length) next = 0;
        widget._highlightIndex = next;
        // map highlightIndex (filtered) to actual index
        const allOpts = Array.from(popover.querySelectorAll('.clb-option'));
        const idxInAll = allOpts.indexOf(opts[next]);
        setHighlight(widget, idxInAll);
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (openInstance !== widget) { openWidget(widget); return; }
        const opt = popover.querySelectorAll('.clb-option')[widget._highlightIndex];
        if (opt) opt.click();
      } else if (e.key === 'Escape') {
        if (openInstance === widget) { closeAll(); }
      }
    });
    // Sync external programmatic changes to native select (e.g. loadUserProvince sets value)
    const observer = new MutationObserver(() => syncFromNative(widget));
    observer.observe(widget.nativeSel, { attributes: true, attributeFilter: ['value'] });
    // Also poll for option-list changes (loadProvinces rewrites options[])
    const optionObserver = new MutationObserver(() => {
      rebuildOptions(widget);
    });
    optionObserver.observe(widget.nativeSel, { childList: true, subtree: false });
  }

  function syncFromNative(widget) {
    const sel = widget.nativeSel;
    const cur = sel.options[sel.selectedIndex];
    if (!cur) return;
    widget.trigger.querySelector('.clb-trigger-text').textContent = buildLabel(cur);
    widget.popover.querySelectorAll('.clb-option').forEach((el) => {
      el.setAttribute('aria-selected', el.dataset.value === sel.value ? 'true' : 'false');
    });
    widget._selectedValue = sel.value;
    // Re-apply disabled look
    Array.from(sel.options).forEach((opt, i) => {
      const li = widget.popover.querySelectorAll('.clb-option')[i];
      if (!li) return;
      li.classList.toggle('is-disabled', !!opt.disabled);
      li.setAttribute('aria-disabled', opt.disabled ? 'true' : 'false');
    });
  }

  function rebuildOptions(widget) {
    const list = widget.popover.querySelector('.clb-list');
    list.innerHTML = '';
    const id = widget.nativeSel.id || ('clb-' + Math.random().toString(36).slice(2, 8));
    Array.from(widget.nativeSel.options).forEach((opt, i) => {
      const li = document.createElement('li');
      li.className = 'clb-option';
      li.setAttribute('role', 'option');
      li.dataset.value = opt.value;
      li.id = id + '-opt-' + i;
      li.textContent = opt.textContent;
      if (opt.disabled) {
        li.setAttribute('aria-disabled', 'true');
        li.classList.add('is-disabled');
      }
      if (opt.selected) li.setAttribute('aria-selected', 'true');
      li.addEventListener('mouseenter', () => {
        widget._highlightIndex = i;
        setHighlight(widget, i);
      });
      li.addEventListener('click', (e) => {
        e.preventDefault();
        if (opt.disabled) return;
        syncNativeSelect(widget.nativeSel, opt.value);
        widget.trigger.querySelector('.clb-trigger-text').textContent = opt.textContent;
        list.querySelectorAll('.clb-option').forEach((el) => el.setAttribute('aria-selected', el.dataset.value === opt.value ? 'true' : 'false'));
        widget._selectedValue = opt.value;
        closeAll();
        widget.trigger.focus();
      });
      list.appendChild(li);
    });
    syncFromNative(widget);
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[c]);
  }

  function initCustomListboxes(root) {
    const scope = root || document;
    const sels = scope.querySelectorAll('select.clb:not(.clb-initialized)');
    sels.forEach((sel) => {
      sel.classList.add('clb-initialized');
      const widget = buildWidget(sel);
      attachBehavior(widget);
      widget._widget = widget;
      sel._clbWidget = widget;
      syncFromNative(widget);
    });
    if (!documentClickHandler) {
      documentClickHandler = (e) => {
        if (openInstance && !openInstance.wrap.contains(e.target)) closeAll();
      };
      document.addEventListener('click', documentClickHandler);
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && openInstance) closeAll();
      });
    }
  }

  // Public API
  window.initCustomListboxes = initCustomListboxes;
  window.closeAllCustomListboxes = closeAll;

  // Auto-init on DOMContentLoaded for any .clb <select>s
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initCustomListboxes());
  } else {
    initCustomListboxes();
  }
})();
