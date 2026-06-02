export class ImageCropper {
  constructor(containerId, imageUrl) {
    this.container = document.getElementById(containerId);
    this.imageUrl = imageUrl;
    this.cropBox = null;
    this.isDragging = false;
    this.isResizing = false;
    this.currentHandle = null;
    this.startX = 0;
    this.startY = 0;
    this.startLeft = 0;
    this.startTop = 0;
    this.startWidth = 0;
    this.startHeight = 0;

    this._onPointerMove = this.onPointerMove.bind(this);
    this._onPointerUp = this.onPointerUp.bind(this);

    this.init();
  }

  init() {
    this.container.innerHTML = `
      <img src="${this.imageUrl}" id="cropperImage" style="max-width: 100%; max-height: 100%; display: block; margin: auto;">
      <canvas id="cropperCanvas" style="display: none;"></canvas>
    `;

    const img = document.getElementById('cropperImage');
    img.onload = () => {
      this.createCropBox();
      this.attachEvents();
    };
  }

  createCropBox() {
    const img = document.getElementById('cropperImage');
    const rect = img.getBoundingClientRect();
    const containerRect = this.container.getBoundingClientRect();

    this.imgLeft = rect.left - containerRect.left;
    this.imgTop = rect.top - containerRect.top;
    this.imgWidth = rect.width;
    this.imgHeight = rect.height;

    const w = this.imgWidth * 0.8;
    const h = this.imgHeight * 0.6;

    this.cropBox = document.createElement('div');
    this.cropBox.className = 'cropper-box';
    this.cropBox.style.cssText = `
      position: absolute;
      border: 2px solid #fff;
      box-shadow: 0 0 0 9999px rgba(0,0,0,0.5);
      cursor: move;
      left: ${this.imgLeft + (this.imgWidth - w) / 2}px;
      top: ${this.imgTop + (this.imgHeight - h) / 2}px;
      width: ${w}px;
      height: ${h}px;
      z-index: 100;
      touch-action: none;
    `;

    this.cropBox.innerHTML = `
      <div class="handle tl" style="position: absolute; top: -5px; left: -5px; width: 20px; height: 20px; background: #fff; border: 2px solid #0071e3; cursor: nwse-resize;"></div>
      <div class="handle tr" style="position: absolute; top: -5px; right: -5px; width: 20px; height: 20px; background: #fff; border: 2px solid #0071e3; cursor: nesw-resize;"></div>
      <div class="handle bl" style="position: absolute; bottom: -5px; left: -5px; width: 20px; height: 20px; background: #fff; border: 2px solid #0071e3; cursor: nesw-resize;"></div>
      <div class="handle br" style="position: absolute; bottom: -5px; right: -5px; width: 20px; height: 20px; background: #fff; border: 2px solid #0071e3; cursor: nwse-resize;"></div>
    `;

    this.container.appendChild(this.cropBox);
  }

  attachEvents() {
    this.cropBox.addEventListener('pointerdown', this.onPointerDown.bind(this));
    document.addEventListener('pointermove', this._onPointerMove);
    document.addEventListener('pointerup', this._onPointerUp);
  }

  onPointerDown(e) {
    e.preventDefault();
    this.cropBox.setPointerCapture(e.pointerId);

    if (e.target.classList.contains('handle')) {
      this.isResizing = true;
      this.currentHandle = e.target.classList[1];
    } else {
      this.isDragging = true;
    }

    this.startX = e.clientX;
    this.startY = e.clientY;
    this.startLeft = this.cropBox.offsetLeft;
    this.startTop = this.cropBox.offsetTop;
    this.startWidth = this.cropBox.offsetWidth;
    this.startHeight = this.cropBox.offsetHeight;
  }

  onPointerMove(e) {
    if (!this.isDragging && !this.isResizing) return;

    const dx = e.clientX - this.startX;
    const dy = e.clientY - this.startY;

    if (this.isDragging) {
      let newLeft = this.startLeft + dx;
      let newTop = this.startTop + dy;

      newLeft = Math.max(this.imgLeft, Math.min(newLeft, this.imgLeft + this.imgWidth - this.cropBox.offsetWidth));
      newTop = Math.max(this.imgTop, Math.min(newTop, this.imgTop + this.imgHeight - this.cropBox.offsetHeight));

      this.cropBox.style.left = newLeft + 'px';
      this.cropBox.style.top = newTop + 'px';
    } else if (this.isResizing) {
      this.handleResize(dx, dy);
    }
  }

  handleResize(dx, dy) {
    const minSize = 50;

    if (this.currentHandle === 'br') {
      const newWidth = Math.max(minSize, Math.min(this.startWidth + dx, this.imgLeft + this.imgWidth - this.startLeft));
      const newHeight = Math.max(minSize, Math.min(this.startHeight + dy, this.imgTop + this.imgHeight - this.startTop));
      this.cropBox.style.width = newWidth + 'px';
      this.cropBox.style.height = newHeight + 'px';
    } else if (this.currentHandle === 'bl') {
      const newWidth = Math.max(minSize, this.startWidth - dx);
      const newLeft = Math.max(this.imgLeft, this.startLeft + this.startWidth - newWidth);
      const newHeight = Math.max(minSize, Math.min(this.startHeight + dy, this.imgTop + this.imgHeight - this.startTop));
      this.cropBox.style.width = newWidth + 'px';
      this.cropBox.style.left = newLeft + 'px';
      this.cropBox.style.height = newHeight + 'px';
    } else if (this.currentHandle === 'tr') {
      const newWidth = Math.max(minSize, Math.min(this.startWidth + dx, this.imgLeft + this.imgWidth - this.startLeft));
      const newHeight = Math.max(minSize, this.startHeight - dy);
      const newTop = Math.max(this.imgTop, this.startTop + this.startHeight - newHeight);
      this.cropBox.style.width = newWidth + 'px';
      this.cropBox.style.height = newHeight + 'px';
      this.cropBox.style.top = newTop + 'px';
    } else if (this.currentHandle === 'tl') {
      const newWidth = Math.max(minSize, this.startWidth - dx);
      const newLeft = Math.max(this.imgLeft, this.startLeft + this.startWidth - newWidth);
      const newHeight = Math.max(minSize, this.startHeight - dy);
      const newTop = Math.max(this.imgTop, this.startTop + this.startHeight - newHeight);
      this.cropBox.style.width = newWidth + 'px';
      this.cropBox.style.left = newLeft + 'px';
      this.cropBox.style.height = newHeight + 'px';
      this.cropBox.style.top = newTop + 'px';
    }
  }

  onPointerUp() {
    this.isDragging = false;
    this.isResizing = false;
  }

  getCroppedImage() {
    const img = document.getElementById('cropperImage');
    const canvas = document.getElementById('cropperCanvas');
    const ctx = canvas.getContext('2d');

    const scaleX = img.naturalWidth / img.width;
    const scaleY = img.naturalHeight / img.height;

    const x = (this.cropBox.offsetLeft - this.imgLeft) * scaleX;
    const y = (this.cropBox.offsetTop - this.imgTop) * scaleY;
    const w = this.cropBox.offsetWidth * scaleX;
    const h = this.cropBox.offsetHeight * scaleY;

    const MAX_SIZE = 1920;
    let targetW = w, targetH = h;
    if (w > MAX_SIZE || h > MAX_SIZE) {
      const ratio = Math.min(MAX_SIZE / w, MAX_SIZE / h);
      targetW = w * ratio;
      targetH = h * ratio;
    }

    canvas.width = targetW;
    canvas.height = targetH;
    ctx.drawImage(img, x, y, w, h, 0, 0, targetW, targetH);

    return canvas.toDataURL('image/jpeg', 0.85);
  }

  destroy() {
    document.removeEventListener('pointermove', this._onPointerMove);
    document.removeEventListener('pointerup', this._onPointerUp);

    if (this.cropBox) {
      this.cropBox.remove();
    }
  }
}
