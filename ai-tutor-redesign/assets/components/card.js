export class Card {
  constructor(element, options = {}) {
    this.element = element;
    this.options = {
      elevated: false,
      padding: 'md',
      hoverable: false,
      onClick: null,
      ...options
    };
    
    this._init();
  }

  _init() {
    this._applyClasses();
    this._setupEvents();
  }

  _applyClasses() {
    const classes = ['card'];
    
    if (this.options.elevated) {
      classes.push('card--elevated');
    }
    
    if (this.options.padding) {
      classes.push(`card--p-${this.options.padding}`);
    }
    
    if (this.options.hoverable) {
      classes.push('card--hoverable');
    }
    
    this.element.className = classes.join(' ');
  }

  _setupEvents() {
    if (this.options.onClick) {
      this.element.addEventListener('click', (e) => {
        this.options.onClick(e);
      });
    }
  }

  setElevated(elevated) {
    this.options.elevated = elevated;
    if (elevated) {
      this.element.classList.add('card--elevated');
    } else {
      this.element.classList.remove('card--elevated');
    }
  }

  setHoverable(hoverable) {
    this.options.hoverable = hoverable;
    if (hoverable) {
      this.element.classList.add('card--hoverable');
      this.element.style.cursor = 'pointer';
    } else {
      this.element.classList.remove('card--hoverable');
      this.element.style.cursor = 'default';
    }
  }

  setPadding(padding) {
    this.options.padding = padding;
    this.element.classList.remove('card--p-sm', 'card--p-md', 'card--p-lg', 'card--p-none');
    this.element.classList.add(`card--p-${padding}`);
  }

  setContent(content) {
    this.element.innerHTML = content;
  }

  static create(options = {}) {
    const card = document.createElement('div');
    if (options.content) {
      card.innerHTML = options.content;
    }
    return new Card(card, options);
  }
}