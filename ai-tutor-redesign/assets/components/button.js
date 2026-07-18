export class Button {
  constructor(element, options = {}) {
    this.element = element;
    this.options = {
      variant: 'primary',
      size: 'md',
      loading: false,
      disabled: false,
      icon: null,
      onClick: null,
      ...options
    };
    
    this._init();
  }

  _init() {
    this._applyClasses();
    this._setupEvents();
    
    if (this.options.icon) {
      this._setIcon(this.options.icon);
    }
    
    if (this.options.loading) {
      this.setLoading(true);
    }
    
    if (this.options.disabled) {
      this.setDisabled(true);
    }
  }

  _applyClasses() {
    const classes = [
      'btn',
      `btn--${this.options.variant}`,
      `btn--${this.options.size}`
    ];
    
    this.element.className = classes.join(' ');
  }

  _setupEvents() {
    if (this.options.onClick) {
      this.element.addEventListener('click', (e) => {
        if (!this.options.disabled && !this.options.loading) {
          this.options.onClick(e);
        }
      });
    }
  }

  _setIcon(icon) {
    const iconSvg = this._getIconSvg(icon);
    if (iconSvg) {
      this.element.innerHTML = iconSvg + this.element.innerHTML;
    }
  }

  _getIconSvg(name) {
    const icons = {
      'check': '<svg class="btn__icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>',
      'x': '<svg class="btn__icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
      'arrow-right': '<svg class="btn__icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>',
      'user': '<svg class="btn__icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
      'camera': '<svg class="btn__icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>',
      'search': '<svg class="btn__icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
      'download': '<svg class="btn__icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
      'upload': '<svg class="btn__icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>',
      'edit': '<svg class="btn__icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>',
      'trash': '<svg class="btn__icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
      'home': '<svg class="btn__icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
      'book': '<svg class="btn__icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22h9"/><path d="M16 2V4h5c1 1 1 2 1 3v13c0 1-1 2-1 2H12"/><path d="M3 22h9"/><path d="M3 2h5c1-1 2-1 3-1h5"/><path d="M12 22V2"/></svg>',
      'graduation-cap': '<svg class="btn__icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 10v6"/><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M3.6 13.6 12 20l8.4-6.4"/></svg>'
    };
    
    return icons[name] || null;
  }

  setLoading(loading) {
    this.options.loading = loading;
    if (loading) {
      this.element.classList.add('btn--loading');
      this.element.disabled = true;
    } else {
      this.element.classList.remove('btn--loading');
      this.element.disabled = this.options.disabled;
    }
  }

  setDisabled(disabled) {
    this.options.disabled = disabled;
    this.element.disabled = disabled;
    if (disabled) {
      this.element.classList.add('btn--disabled');
    } else {
      this.element.classList.remove('btn--disabled');
    }
  }

  setVariant(variant) {
    this.options.variant = variant;
    this._applyClasses();
  }

  setText(text) {
    this.element.textContent = text;
  }

  static create(options = {}) {
    const button = document.createElement('button');
    if (options.textContent) {
      button.textContent = options.textContent;
    }
    return new Button(button, options);
  }
}