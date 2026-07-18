export class VisionCapture {
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      captureMode: 'camera',
      onResult: null,
      ...options
    };
    
    this.state = {
      mode: this.options.captureMode,
      step: 'select',
      image: null,
      videoStream: null,
      croppedImage: null
    };
    
    this._init();
  }

  _init() {
    this._render();
    this._setupEvents();
  }

  _render() {
    switch (this.state.step) {
      case 'select':
        this._renderSelectMode();
        break;
      case 'camera':
        this._renderCamera();
        break;
      case 'upload':
        this._renderUpload();
        break;
      case 'crop':
        this._renderCrop();
        break;
      case 'result':
        this._renderResult();
        break;
      case 'loading':
        this._renderLoading();
        break;
      default:
        this._renderSelectMode();
    }
  }

  _renderSelectMode() {
    const hasCamera = navigator.mediaDevices && navigator.mediaDevices.getUserMedia;
    
    this.container.innerHTML = `
      <div class="vision-capture">
        <div class="vision-capture__header">
          <button class="vision-capture__back" id="vision-back">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
          </button>
          <h3 class="vision-capture__title">拍照搜题</h3>
          <div class="vision-capture__placeholder"></div>
        </div>
        
        <div class="vision-capture__content">
          <div class="vision-capture__modes">
            ${hasCamera ? `
              <button class="vision-capture__mode-btn vision-capture__mode-btn--camera" id="vision-mode-camera">
                <div class="vision-capture__mode-icon">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                    <circle cx="12" cy="13" r="4"/>
                  </svg>
                </div>
                <div class="vision-capture__mode-label">拍照</div>
                <div class="vision-capture__mode-desc">使用摄像头拍摄题目</div>
              </button>
            ` : ''}
            
            <button class="vision-capture__mode-btn vision-capture__mode-btn--upload" id="vision-mode-upload">
              <div class="vision-capture__mode-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/>
                  <line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
              </div>
              <div class="vision-capture__mode-label">上传图片</div>
              <div class="vision-capture__mode-desc">从相册选择图片</div>
            </button>
          </div>
          
          <div class="vision-capture__tips">
            <div class="vision-capture__tip">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="16" x2="12" y2="12"/>
                <line x1="12" y1="8" x2="12.01" y2="8"/>
              </svg>
              <span>确保题目清晰，光线充足</span>
            </div>
            <div class="vision-capture__tip">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="16" x2="12" y2="12"/>
                <line x1="12" y1="8" x2="12.01" y2="8"/>
              </svg>
              <span>拍摄时保持手机稳定</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  _renderCamera() {
    this.container.innerHTML = `
      <div class="vision-capture vision-capture--camera">
        <div class="vision-capture__header">
          <button class="vision-capture__back" id="vision-back">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
          </button>
          <div class="vision-capture__placeholder"></div>
          <button class="vision-capture__flip" id="vision-flip">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M16 3h5v5M4 20V11h5M20 20v-5h-5M11 4H6v5"/>
            </svg>
          </button>
        </div>
        
        <div class="vision-capture__camera-container">
          <video id="vision-video" autoplay playsinline></video>
          <div class="vision-capture__camera-frame">
            <div class="vision-capture__camera-corner vision-capture__camera-corner--tl"></div>
            <div class="vision-capture__camera-corner vision-capture__camera-corner--tr"></div>
            <div class="vision-capture__camera-corner vision-capture__camera-corner--bl"></div>
            <div class="vision-capture__camera-corner vision-capture__camera-corner--br"></div>
          </div>
          <div class="vision-capture__camera-hint">将题目置于框内</div>
        </div>
        
        <div class="vision-capture__camera-actions">
          <button class="vision-capture__camera-btn" id="vision-capture">
            <div class="vision-capture__camera-btn-inner"></div>
          </button>
        </div>
      </div>
    `;
    
    this._startCamera();
  }

  _renderUpload() {
    this.container.innerHTML = `
      <div class="vision-capture">
        <div class="vision-capture__header">
          <button class="vision-capture__back" id="vision-back">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
          </button>
          <h3 class="vision-capture__title">选择图片</h3>
          <div class="vision-capture__placeholder"></div>
        </div>
        
        <div class="vision-capture__content">
          <input type="file" id="vision-file-input" accept="image/*" style="display: none;">
          
          <div class="vision-capture__upload-area" id="vision-upload-area">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            <p class="vision-capture__upload-title">点击或拖拽上传图片</p>
            <p class="vision-capture__upload-desc">支持 JPG、PNG 格式，最大 10MB</p>
          </div>
          
          <div class="vision-capture__recent" id="vision-recent">
            <div class="vision-capture__recent-title">最近图片</div>
            <div class="vision-capture__recent-grid">
              ${this._renderRecentImages()}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  _renderRecentImages() {
    const placeholders = [
      { color: '#eef7f2', label: '图片1' },
      { color: '#fff3e0', label: '图片2' },
      { color: '#fdf6f5', label: '图片3' },
      { color: '#e8eaf6', label: '图片4' },
      { color: '#fce4e4', label: '图片5' },
      { color: '#e3f2fd', label: '图片6' }
    ];
    
    return placeholders.map((p, i) => `
      <div class="vision-capture__recent-item" data-index="${i}" id="vision-recent-${i}">
        <div class="vision-capture__recent-thumb" style="background: ${p.color}">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <path d="M21 15l-5-5L5 21"/>
          </svg>
        </div>
        <div class="vision-capture__recent-name">${p.label}</div>
      </div>
    `).join('');
  }

  _renderCrop() {
    if (!this.state.image) {
      this.state.step = 'select';
      this._render();
      return;
    }

    this.container.innerHTML = `
      <div class="vision-capture">
        <div class="vision-capture__header">
          <button class="vision-capture__back" id="vision-back">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
          </button>
          <h3 class="vision-capture__title">裁剪图片</h3>
          <button class="vision-capture__confirm" id="vision-confirm-crop">确认</button>
        </div>
        
        <div class="vision-capture__content">
          <div class="vision-capture__crop-container">
            <img id="vision-crop-image" src="${this.state.image}" crossorigin="anonymous">
            <div class="vision-capture__crop-frame">
              <div class="vision-capture__crop-overlay"></div>
              <div class="vision-capture__crop-area">
                <div class="vision-capture__crop-handle vision-capture__crop-handle--n"></div>
                <div class="vision-capture__crop-handle vision-capture__crop-handle--s"></div>
                <div class="vision-capture__crop-handle vision-capture__crop-handle--e"></div>
                <div class="vision-capture__crop-handle vision-capture__crop-handle--w"></div>
                <div class="vision-capture__crop-handle vision-capture__crop-handle--ne"></div>
                <div class="vision-capture__crop-handle vision-capture__crop-handle--nw"></div>
                <div class="vision-capture__crop-handle vision-capture__crop-handle--se"></div>
                <div class="vision-capture__crop-handle vision-capture__crop-handle--sw"></div>
              </div>
            </div>
          </div>
          
          <div class="vision-capture__crop-tips">
            拖动边框调整裁剪区域，确保题目完整
          </div>
        </div>
      </div>
    `;
  }

  _renderLoading() {
    this.container.innerHTML = `
      <div class="vision-capture">
        <div class="vision-capture__header">
          <button class="vision-capture__back" id="vision-back">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
          </button>
          <div class="vision-capture__placeholder"></div>
          <div class="vision-capture__placeholder"></div>
        </div>
        
        <div class="vision-capture__content vision-capture__content--loading">
          <div class="vision-capture__loading">
            <div class="vision-capture__loading-spinner"></div>
            <p class="vision-capture__loading-text">正在识别题目...</p>
            <p class="vision-capture__loading-desc">请稍候，AI正在分析图片内容</p>
          </div>
        </div>
      </div>
    `;
  }

  _renderResult() {
    if (!this.state.result) {
      return this._renderEmptyResult();
    }

    const { question, similar, knowledge_points } = this.state.result;

    this.container.innerHTML = `
      <div class="vision-capture">
        <div class="vision-capture__header">
          <button class="vision-capture__back" id="vision-back">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
          </button>
          <h3 class="vision-capture__title">识别结果</h3>
          <button class="vision-capture__retry" id="vision-retry">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
              <path d="M3 3v5h5M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/>
              <path d="M16 21h5v-5"/>
            </svg>
          </button>
        </div>
        
        <div class="vision-capture__content">
          <div class="vision-capture__result-card">
            <div class="vision-capture__result-title">识别到的题目</div>
            <div class="vision-capture__result-question">${question}</div>
            
            ${knowledge_points && knowledge_points.length > 0 ? `
              <div class="vision-capture__result-knowledge">
                <div class="vision-capture__result-knowledge-label">相关知识点</div>
                <div class="vision-capture__result-knowledge-tags">
                  ${knowledge_points.map(kp => `<span class="tag tag--success">${kp}</span>`).join('')}
                </div>
              </div>
            ` : ''}
            
            <div class="vision-capture__result-actions">
              <button class="btn btn--primary" id="vision-add-wrong">加入错题本</button>
              <button class="btn btn--ghost" id="vision-ask-tutor">问AI导师</button>
            </div>
          </div>
          
          ${similar && similar.length > 0 ? `
            <div class="vision-capture__similar">
              <div class="vision-capture__similar-title">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M11 4a2 2 0 1 1 4 0v1a1 1 0 0 0 1 1h3a1 1 0 0 1 1 1v3a1 1 0 0 0 1 1h1a2 2 0 1 1 0 4h-1a1 1 0 0 0-1 1v3a1 1 0 0 1-1 1h-3a1 1 0 0 0-1 1v1a2 2 0 1 1-4 0v-1a1 1 0 0 0-1-1h-3a1 1 0 0 1-1-1v-3a1 1 0 0 0-1-1H4a2 2 0 1 1 0-4h1a1 1 0 0 0 1-1v-3a1 1 0 0 1 1-1h3a1 1 0 0 0 1-1V4z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
                <span>相似题目推荐</span>
              </div>
              <div class="vision-capture__similar-list">
                ${similar.slice(0, 3).map((item, idx) => `
                  <div class="vision-capture__similar-item" id="vision-similar-${idx}">
                    <div class="vision-capture__similar-number">${idx + 1}</div>
                    <div class="vision-capture__similar-content">${item.text}</div>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  _renderEmptyResult() {
    this.container.innerHTML = `
      <div class="vision-capture">
        <div class="vision-capture__header">
          <button class="vision-capture__back" id="vision-back">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
          </button>
          <div class="vision-capture__placeholder"></div>
          <div class="vision-capture__placeholder"></div>
        </div>
        
        <div class="vision-capture__content">
          <div class="vision-capture__empty">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
              <line x1="8" y1="12" x2="12" y2="12"/>
              <line x1="16" y1="12" x2="16.01" y2="12"/>
            </svg>
            <p class="vision-capture__empty-title">未识别到题目</p>
            <p class="vision-capture__empty-desc">请确保图片清晰，包含完整题目内容</p>
            <button class="btn btn--primary" id="vision-retry">重新拍摄</button>
          </div>
        </div>
      </div>
    `;
  }

  _setupEvents() {
    const backBtn = this.container.querySelector('#vision-back');
    const retryBtn = this.container.querySelector('#vision-retry');
    
    if (backBtn) {
      backBtn.addEventListener('click', () => this._goBack());
    }
    
    if (retryBtn) {
      retryBtn.addEventListener('click', () => {
        this.state.step = 'select';
        this.state.image = null;
        this.state.result = null;
        this._render();
        this._setupEvents();
      });
    }

    switch (this.state.step) {
      case 'select':
        this._setupSelectEvents();
        break;
      case 'camera':
        this._setupCameraEvents();
        break;
      case 'upload':
        this._setupUploadEvents();
        break;
      case 'crop':
        this._setupCropEvents();
        break;
      case 'result':
        this._setupResultEvents();
        break;
    }
  }

  _setupSelectEvents() {
    const cameraBtn = this.container.querySelector('#vision-mode-camera');
    const uploadBtn = this.container.querySelector('#vision-mode-upload');
    
    if (cameraBtn) {
      cameraBtn.addEventListener('click', () => {
        this.state.mode = 'camera';
        this.state.step = 'camera';
        this._render();
        this._setupEvents();
      });
    }
    
    if (uploadBtn) {
      uploadBtn.addEventListener('click', () => {
        this.state.mode = 'upload';
        this.state.step = 'upload';
        this._render();
        this._setupEvents();
      });
    }
  }

  _setupCameraEvents() {
    const captureBtn = this.container.querySelector('#vision-capture');
    const flipBtn = this.container.querySelector('#vision-flip');
    
    if (captureBtn) {
      captureBtn.addEventListener('click', () => this._captureImage());
    }
    
    if (flipBtn) {
      flipBtn.addEventListener('click', () => this._flipCamera());
    }
  }

  _setupUploadEvents() {
    const fileInput = this.container.querySelector('#vision-file-input');
    const uploadArea = this.container.querySelector('#vision-upload-area');
    const recentItems = this.container.querySelectorAll('.vision-capture__recent-item');
    
    const handleFileSelect = (file) => {
      if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          this.state.image = e.target.result;
          this.state.step = 'crop';
          this._render();
          this._setupEvents();
        };
        reader.readAsDataURL(file);
      }
    };
    
    if (fileInput) {
      fileInput.addEventListener('change', (e) => handleFileSelect(e.target.files[0]));
    }
    
    if (uploadArea) {
      uploadArea.addEventListener('click', () => fileInput?.click());
      
      uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('vision-capture__upload-area--dragging');
      });
      
      uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('vision-capture__upload-area--dragging');
      });
      
      uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('vision-capture__upload-area--dragging');
        handleFileSelect(e.dataTransfer.files[0]);
      });
    }
    
    recentItems.forEach(item => {
      item.addEventListener('click', () => {
        const canvas = document.createElement('canvas');
        canvas.width = 400;
        canvas.height = 300;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#f8f7f4';
        ctx.fillRect(0, 0, 400, 300);
        ctx.fillStyle = '#2d6a4f';
        ctx.font = '24px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('示例题目图片', 200, 150);
        this.state.image = canvas.toDataURL('image/png');
        this.state.step = 'crop';
        this._render();
        this._setupEvents();
      });
    });
  }

  _setupCropEvents() {
    const confirmBtn = this.container.querySelector('#vision-confirm-crop');
    
    if (confirmBtn) {
      confirmBtn.addEventListener('click', () => {
        this.state.step = 'loading';
        this._render();
        this._setupEvents();
        
        setTimeout(() => {
          this._simulateRecognition();
        }, 2000);
      });
    }
  }

  _setupResultEvents() {
    const addWrongBtn = this.container.querySelector('#vision-add-wrong');
    const askTutorBtn = this.container.querySelector('#vision-ask-tutor');
    const similarItems = this.container.querySelectorAll('.vision-capture__similar-item');
    
    if (addWrongBtn) {
      addWrongBtn.addEventListener('click', () => {
        if (this.options.onResult) {
          this.options.onResult({
            action: 'add_wrong',
            data: this.state.result
          });
        }
      });
    }
    
    if (askTutorBtn) {
      askTutorBtn.addEventListener('click', () => {
        if (this.options.onResult) {
          this.options.onResult({
            action: 'ask_tutor',
            data: this.state.result
          });
        }
      });
    }
    
    similarItems.forEach(item => {
      item.addEventListener('click', () => {
        if (this.options.onResult) {
          this.options.onResult({
            action: 'select_similar',
            data: this.state.result.similar[parseInt(item.id.split('-')[2])]
          });
        }
      });
    });
  }

  _startCamera() {
    navigator.mediaDevices.getUserMedia({ 
      video: { facingMode: 'environment' } 
    })
    .then(stream => {
      this.state.videoStream = stream;
      const video = this.container.querySelector('#vision-video');
      if (video) {
        video.srcObject = stream;
      }
    })
    .catch(err => {
      console.error('Camera error:', err);
      this.state.step = 'upload';
      this._render();
      this._setupEvents();
    });
  }

  _stopCamera() {
    if (this.state.videoStream) {
      this.state.videoStream.getTracks().forEach(track => track.stop());
      this.state.videoStream = null;
    }
  }

  _flipCamera() {
    this._stopCamera();
    navigator.mediaDevices.getUserMedia({ 
      video: { facingMode: 'user' } 
    })
    .then(stream => {
      this.state.videoStream = stream;
      const video = this.container.querySelector('#vision-video');
      if (video) {
        video.srcObject = stream;
        video.style.transform = 'scaleX(-1)';
      }
    })
    .catch(err => {
      console.error('Camera flip error:', err);
    });
  }

  _captureImage() {
    const video = this.container.querySelector('#vision-video');
    if (!video) return;
    
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);
    
    this.state.image = canvas.toDataURL('image/jpeg', 0.8);
    this._stopCamera();
    this.state.step = 'crop';
    this._render();
    this._setupEvents();
  }

  _simulateRecognition() {
    this.state.result = {
      question: '已知函数 f(x) = x^2 - 2x + 1，求 f(x) 在区间 [0, 3] 上的最大值和最小值。',
      knowledge_points: ['二次函数', '函数最值', '闭区间'],
      similar: [
        { text: '已知二次函数 f(x) = 2x^2 - 4x + 3，求其顶点坐标。' },
        { text: '求函数 g(x) = -x^2 + 6x - 5 在 x ∈ [1, 4] 上的值域。' },
        { text: '已知函数 h(x) = x^2 - 2ax + a^2，讨论其单调性。' }
      ]
    };
    
    this.state.step = 'result';
    this._render();
    this._setupEvents();
    
    if (this.options.onResult) {
      this.options.onResult({
        action: 'result',
        data: this.state.result
      });
    }
  }

  _goBack() {
    this._stopCamera();
    
    if (this.state.step === 'select') {
      window.history.back();
    } else {
      this.state.step = 'select';
      this.state.image = null;
      this.state.result = null;
      this._render();
      this._setupEvents();
    }
  }

  setMode(mode) {
    this.state.mode = mode;
    this.state.step = mode === 'camera' ? 'camera' : 'upload';
    this._render();
    this._setupEvents();
  }

  destroy() {
    this._stopCamera();
    this.container.innerHTML = '';
  }
}