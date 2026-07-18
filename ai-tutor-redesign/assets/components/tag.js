export class Tag {
  constructor(element, options = {}) {
    this.element = element;
    this.options = {
      variant: 'default',
      closable: false,
      size: 'sm',
      onClose: null,
      ...options
    };
    
    this._init();
  }

  _init() {
    this._applyClasses();
    
    if (this.options.closable) {
      this._createCloseButton();
    }
  }

  _applyClasses() {
    const classes = ['tag', `tag--${this.options.variant}`, `tag--${this.options.size}`];
    this.element.className = classes.join(' ');
  }

  _createCloseButton() {
    const closeBtn = document.createElement('button');
    closeBtn.className = 'tag__close';
    closeBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
    
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.options.onClose) {
        this.options.onClose(e);
      } else {
        this.element.remove();
      }
    });
    
    this.element.appendChild(closeBtn);
  }

  setVariant(variant) {
    this.options.variant = variant;
    this._applyClasses();
  }

  setText(text) {
    const closeBtn = this.element.querySelector('.tag__close');
    this.element.textContent = text;
    if (closeBtn) {
      this.element.appendChild(closeBtn);
    }
  }

  static create(options = {}) {
    const tag = document.createElement('span');
    if (options.textContent) {
      tag.textContent = options.textContent;
    }
    return new Tag(tag, options);
  }
}