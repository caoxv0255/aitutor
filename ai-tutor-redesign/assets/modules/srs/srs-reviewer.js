export class SRSReviewer {
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      reviewQueue: [],
      currentIndex: 0,
      onRate: null,
      ...options
    };
    
    this.state = {
      showingAnswer: false,
      completedCount: 0,
      totalQuality: 0
    };
    
    this._init();
  }

  _init() {
    this._render();
    this._setupEvents();
  }

  _render() {
    if (this.options.reviewQueue.length === 0) {
      this._renderEmptyState();
      return;
    }
    
    const current = this.options.reviewQueue[this.options.currentIndex];
    const progress = ((this.options.currentIndex) / this.options.reviewQueue.length) * 100;
    
    this.container.innerHTML = `
      <div class="srs-reviewer">
        <div class="srs-reviewer__header">
          <div class="srs-reviewer__progress">
            <div class="srs-reviewer__progress-bar">
              <div class="srs-reviewer__progress-fill" style="width: ${progress}%"></div>
            </div>
            <div class="srs-reviewer__progress-text">
              今日复习 ${this.options.currentIndex + 1} / ${this.options.reviewQueue.length}
            </div>
          </div>
          <button class="srs-reviewer__close-btn" id="srs-close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        
        <div class="srs-reviewer__card" id="srs-card">
          ${this.state.showingAnswer 
            ? this._renderAnswerSide(current) 
            : this._renderQuestionSide(current)
          }
        </div>
        
        ${this.state.showingAnswer ? this._renderRatingPanel(current) : ''}
        
        <div class="srs-reviewer__stats">
          <div class="srs-reviewer__stat">
            <span class="srs-reviewer__stat-value">${this.state.completedCount}</span>
            <span class="srs-reviewer__stat-label">已完成</span>
          </div>
          <div class="srs-reviewer__stat">
            <span class="srs-reviewer__stat-value">${this.options.reviewQueue.length - this.options.currentIndex - this.state.completedCount}</span>
            <span class="srs-reviewer__stat-label">待复习</span>
          </div>
        </div>
      </div>
    `;
  }

  _renderEmptyState() {
    this.container.innerHTML = `
      <div class="srs-reviewer srs-reviewer--empty">
        <div class="srs-reviewer__empty-icon">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2a10 10 0 1 0 10 10 10 10 0 0 0-10-10zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z"/><path d="M9.05 7.65l5.65 5.65a.5.5 0 0 1 0 .7l-1.4 1.4a.5.5 0 0 1-.7 0L8.35 8.35a.5.5 0 0 1 0-.7z"/></svg>
        </div>
        <h3 class="srs-reviewer__empty-title">今日无复习任务</h3>
        <p class="srs-reviewer__empty-desc">太棒了！你已经完成了所有复习任务</p>
        <button class="btn btn--primary" id="srs-refresh">刷新任务</button>
      </div>
    `;
    
    this.container.querySelector('#srs-refresh')?.addEventListener('click', () => {
      window.location.reload();
    });
  }

  _renderQuestionSide(item) {
    return `
      <div class="srs-card srs-card--question">
        <div class="srs-card__type">${item.type || '复习'}</div>
        <div class="srs-card__content">${item.question}</div>
        <button class="srs-card__flip-btn" id="srs-flip">显示答案</button>
      </div>
    `;
  }

  _renderAnswerSide(item) {
    return `
      <div class="srs-card srs-card--answer">
        <div class="srs-card__type">参考答案</div>
        <div class="srs-card__content">${item.answer}</div>
        ${item.analysis ? `
          <div class="srs-card__analysis">
            <div class="srs-card__analysis-label">解析：</div>
            <div class="srs-card__analysis-content">${item.analysis}</div>
          </div>
        ` : ''}
      </div>
    `;
  }

  _renderRatingPanel(item) {
    return `
      <div class="srs-reviewer__rating" id="srs-rating">
        <div class="srs-reviewer__rating-label">你掌握得如何？</div>
        <div class="srs-reviewer__rating-buttons">
          ${[
            { quality: 0, label: '完全忘记', color: 'red' },
            { quality: 2, label: '严重困难', color: 'orange' },
            { quality: 3, label: '困难', color: 'yellow' },
            { quality: 4, label: '一般', color: 'blue' },
            { quality: 5, label: '容易', color: 'green' },
            { quality: 5, label: '非常容易', color: 'green' }
          ].map((btn, idx) => `
            <button 
              class="srs-reviewer__rating-btn srs-reviewer__rating-btn--${btn.color}"
              data-quality="${btn.quality}"
              id="srs-rate-${idx}"
            >
              ${btn.label}
            </button>
          `).join('')}
        </div>
      </div>
    `;
  }

  _setupEvents() {
    const flipBtn = this.container.querySelector('#srs-flip');
    const closeBtn = this.container.querySelector('#srs-close');
    
    if (flipBtn) {
      flipBtn.addEventListener('click', () => {
        this.state.showingAnswer = true;
        this._render();
        this._setupEvents();
      });
    }
    
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        window.history.back();
      });
    }
    
    const ratingBtns = this.container.querySelectorAll('.srs-reviewer__rating-btn');
    ratingBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const quality = parseInt(btn.dataset.quality);
        this._handleRate(quality);
      });
    });
  }

  _handleRate(quality) {
    const current = this.options.reviewQueue[this.options.currentIndex];
    
    this.state.completedCount++;
    this.state.totalQuality += quality;
    
    if (this.options.onRate) {
      this.options.onRate({
        item: current,
        quality,
        completedCount: this.state.completedCount,
        totalQuality: this.state.totalQuality
      });
    }
    
    if (this.options.currentIndex < this.options.reviewQueue.length - 1) {
      this.options.currentIndex++;
      this.state.showingAnswer = false;
      this._render();
      this._setupEvents();
    } else {
      this._renderSummary();
    }
  }

  _renderSummary() {
    const avgQuality = this.state.completedCount > 0 
      ? (this.state.totalQuality / this.state.completedCount).toFixed(1) 
      : '0';
    
    this.container.innerHTML = `
      <div class="srs-reviewer srs-reviewer--summary">
        <div class="srs-reviewer__summary-icon">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <h3 class="srs-reviewer__summary-title">复习完成！</h3>
        
        <div class="srs-reviewer__summary-stats">
          <div class="srs-reviewer__summary-stat">
            <span class="srs-reviewer__summary-value">${this.state.completedCount}</span>
            <span class="srs-reviewer__summary-label">今日复习</span>
          </div>
          <div class="srs-reviewer__summary-stat">
            <span class="srs-reviewer__summary-value">${avgQuality}</span>
            <span class="srs-reviewer__summary-label">平均质量</span>
          </div>
        </div>
        
        <div class="srs-reviewer__summary-tips">
          ${parseFloat(avgQuality) >= 4 
            ? '掌握得很好！继续保持这种学习节奏。' 
            : parseFloat(avgQuality) >= 3 
              ? '还不错，建议稍后再复习一遍薄弱的题目。'
              : '需要加强复习，建议明天重新复习这些内容。'
          }
        </div>
        
        <div class="srs-reviewer__summary-actions">
          <button class="btn btn--primary" id="srs-done">完成</button>
          <button class="btn btn--ghost" id="srs-review-again">再复习一次</button>
        </div>
      </div>
    `;
    
    this.container.querySelector('#srs-done')?.addEventListener('click', () => {
      window.history.back();
    });
    
    this.container.querySelector('#srs-review-again')?.addEventListener('click', () => {
      this.options.currentIndex = 0;
      this.state.showingAnswer = false;
      this.state.completedCount = 0;
      this.state.totalQuality = 0;
      this._render();
      this._setupEvents();
    });
  }

  addItem(item) {
    this.options.reviewQueue.push(item);
    this._render();
    this._setupEvents();
  }

  removeItem(index) {
    this.options.reviewQueue.splice(index, 1);
    this._render();
    this._setupEvents();
  }
}