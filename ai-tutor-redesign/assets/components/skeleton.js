export class Skeleton {
  constructor(element, options = {}) {
    this.element = element;
    this.options = {
      type: 'text',
      width: '100%',
      height: '16px',
      ...options
    };
    
    this._init();
  }

  _init() {
    this._applyClasses();
    this._applyStyles();
  }

  _applyClasses() {
    const classes = ['skeleton', `skeleton--${this.options.type}`];
    this.element.className = classes.join(' ');
  }

  _applyStyles() {
    this.element.style.width = this.options.width;
    if (this.options.type === 'rect') {
      this.element.style.height = this.options.height;
    }
  }

  setType(type) {
    this.options.type = type;
    this._applyClasses();
  }

  setWidth(width) {
    this.options.width = width;
    this.element.style.width = width;
  }

  setHeight(height) {
    this.options.height = height;
    this.element.style.height = height;
  }

  static create(options = {}) {
    const skeleton = document.createElement('div');
    return new Skeleton(skeleton, options);
  }

  static createText(width = '100%') {
    return Skeleton.create({ type: 'text', width });
  }

  static createRect(width = '100%', height = '100px') {
    return Skeleton.create({ type: 'rect', width, height });
  }

  static createCircle(size = '40px') {
    const skeleton = Skeleton.create({ type: 'circle', width: size, height: size });
    skeleton.element.style.borderRadius = '50%';
    return skeleton;
  }
}