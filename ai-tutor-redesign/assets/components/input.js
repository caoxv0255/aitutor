export class Input {
  constructor(element, options = {}) {
    this.element = element;
    this.options = {
      type: 'text',
      label: null,
      placeholder: '',
      error: null,
      prefixIcon: null,
      maxlength: null,
      value: '',
      onChange: null,
      onFocus: null,
      onBlur: null,
      ...options
    };
    
    this._init();
  }

  _init() {
    this._applyAttributes();
    this._setupEvents();
    
    if (this.options.prefixIcon) {
      this._createPrefixIcon();
    }
    
    if (this.options.label) {
      this._createLabel();
    }
    
    if (this.options.error) {
      this.setError(this.options.error);
    }
    
    if (this.options.value) {
      this.setValue(this.options.value);
    }
  }

  _applyAttributes() {
    if (this.options.type) {
      this.element.type = this.options.type;
    }
    if (this.options.placeholder) {
      this.element.placeholder = this.options.placeholder;
    }
    if (this.options.maxlength) {
      this.element.maxlength = this.options.maxlength;
    }
  }

  _setupEvents() {
    if (this.options.onChange) {
      this.element.addEventListener('input', (e) => {
        this.options.onChange(e.target.value, e);
      });
    }
    
    if (this.options.onFocus) {
      this.element.addEventListener('focus', (e) => {
        this.options.onFocus(e);
      });
    }
    
    if (this.options.onBlur) {
      this.element.addEventListener('blur', (e) => {
        this.options.onBlur(e);
      });
    }
  }

  _createPrefixIcon() {
    const iconContainer = document.createElement('span');
    iconContainer.className = 'input__prefix';
    
    const icons = {
      'user': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
      'lock': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
      'mail': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>',
      'search': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>'
    };
    
    iconContainer.innerHTML = icons[this.options.prefixIcon] || '';
    
    const wrapper = document.createElement('div');
    wrapper.className = 'input__wrapper';
    this.element.parentNode.insertBefore(wrapper, this.element);
    wrapper.appendChild(iconContainer);
    wrapper.appendChild(this.element);
    
    this.element.classList.add('input__field');
  }

  _createLabel() {
    const label = document.createElement('label');
    label.textContent = this.options.label;
    label.className = 'input__label';
    
    this.element.parentNode.insertBefore(label, this.element);
  }

  setValue(value) {
    this.element.value = value;
  }

  getValue() {
    return this.element.value;
  }

  setError(error) {
    this.options.error = error;
    
    let errorEl = this.element.parentNode.querySelector('.input__error');
    if (error) {
      if (!errorEl) {
        errorEl = document.createElement('span');
        errorEl.className = 'input__error';
        this.element.parentNode.appendChild(errorEl);
      }
      errorEl.textContent = error;
      this.element.classList.add('input--error');
    } else {
      if (errorEl) {
        errorEl.remove();
      }
      this.element.classList.remove('input--error');
    }
  }

  focus() {
    this.element.focus();
  }

  blur() {
    this.element.blur();
  }

  setDisabled(disabled) {
    this.element.disabled = disabled;
    if (disabled) {
      this.element.classList.add('input--disabled');
    } else {
      this.element.classList.remove('input--disabled');
    }
  }

  static create(options = {}) {
    const input = document.createElement('input');
    input.className = 'input';
    
    const wrapper = document.createElement('div');
    wrapper.className = 'input__wrapper';
    wrapper.appendChild(input);
    
    const instance = new Input(input, options);
    return { element: wrapper, instance };
  }
}