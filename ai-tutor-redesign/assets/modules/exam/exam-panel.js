export class ExamPanel {
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      questions: [],
      duration: 3600,
      mode: 'study',
      onSubmit: null,
      ...options
    };
    
    this.state = {
      currentIndex: 0,
      answers: {},
      marked: new Set(),
      remainingTime: options.duration,
      timerInterval: null,
      isSubmitted: false
    };
    
    this._init();
  }

  _init() {
    this._render();
    this._setupEvents();
    if (this.options.mode === 'exam') {
      this._startTimer();
    }
  }

  _render() {
    const currentQ = this.options.questions[this.state.currentIndex];
    const answeredCount = Object.keys(this.state.answers).length;
    const markedCount = this.state.marked.size;
    
    this.container.innerHTML = `
      <div class="exam-panel">
        <div class="exam-panel__header">
          <div class="exam-panel__header-left">
            <button class="exam-panel__back-btn" id="exam-back">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
              返回
            </button>
            <div class="exam-panel__title">${this.options.mode === 'exam' ? '考试作答' : '练习模式'}</div>
          </div>
          
          ${this.options.mode === 'exam' ? `
            <div class="exam-panel__timer" id="exam-timer" ${this.state.remainingTime <= 300 ? 'class="exam-panel__timer--warning"' : ''} ${this.state.remainingTime <= 60 ? 'class="exam-panel__timer--danger"' : ''}>
              <svg class="exam-panel__timer-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              <span class="exam-panel__timer-text">${this._formatTime(this.state.remainingTime)}</span>
            </div>
          ` : ''}
          
          <div class="exam-panel__header-right">
            <button class="exam-panel__action-btn exam-panel__action-btn--secondary" id="exam-mark">
              ${this.state.marked.has(this.state.currentIndex) ? '取消标记' : '标记'}
            </button>
            <button class="exam-panel__action-btn exam-panel__action-btn--primary" id="exam-submit">
              交卷
            </button>
          </div>
        </div>
        
        <div class="exam-panel__main">
          <div class="exam-panel__content">
            <div class="exam-panel__progress">
              <div class="exam-panel__progress-bar">
                <div class="exam-panel__progress-fill" style="width: ${((this.state.currentIndex + 1) / this.options.questions.length) * 100}%"></div>
              </div>
              <div class="exam-panel__progress-text">
                第 ${this.state.currentIndex + 1} / ${this.options.questions.length} 题
              </div>
            </div>
            
            <div class="exam-panel__question" id="exam-question"></div>
            
            <div class="exam-panel__nav">
              <button class="exam-panel__nav-btn" id="exam-prev" ${this.state.currentIndex === 0 ? 'disabled' : ''}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="15" y1="18" x2="9" y2="12"/><line x1="15" y1="6" x2="9" y2="12"/></svg>
                上一题
              </button>
              <button class="exam-panel__nav-btn" id="exam-next" ${this.state.currentIndex === this.options.questions.length - 1 ? 'disabled' : ''}>
                下一题
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="9" y1="18" x2="15" y2="12"/><line x1="9" y1="6" x2="15" y2="12"/></svg>
              </button>
            </div>
          </div>
          
          <div class="exam-panel__side">
            <div class="exam-panel__sheet">
              <div class="exam-panel__sheet-header">
                <span class="exam-panel__sheet-title">答题卡</span>
                <span class="exam-panel__sheet-stats">已答 ${answeredCount}/${this.options.questions.length}</span>
              </div>
              <div class="exam-panel__sheet-grid">
                ${this.options.questions.map((q, idx) => {
                  const isAnswered = this.state.answers[idx] !== undefined;
                  const isMarked = this.state.marked.has(idx);
                  const isCurrent = idx === this.state.currentIndex;
                  return `
                    <button 
                      class="exam-panel__sheet-item ${isAnswered ? 'exam-panel__sheet-item--answered' : ''} 
                        ${isMarked ? 'exam-panel__sheet-item--marked' : ''}
                        ${isCurrent ? 'exam-panel__sheet-item--current' : ''}"
                      data-index="${idx}"
                    >
                      ${idx + 1}
                    </button>
                  `;
                }).join('')}
              </div>
              <div class="exam-panel__sheet-legend">
                <span class="exam-panel__legend-item">
                  <span class="exam-panel__legend-dot exam-panel__legend-dot--answered"></span>
                  <span>已答</span>
                </span>
                <span class="exam-panel__legend-item">
                  <span class="exam-panel__legend-dot exam-panel__legend-dot--marked"></span>
                  <span>标记</span>
                </span>
                <span class="exam-panel__legend-item">
                  <span class="exam-panel__legend-dot exam-panel__legend-dot--current"></span>
                  <span>当前</span>
                </span>
              </div>
            </div>
            
            ${this.options.mode === 'exam' ? `
              <div class="exam-panel__stats">
                <div class="exam-panel__stat-item">
                  <span class="exam-panel__stat-value">${answeredCount}</span>
                  <span class="exam-panel__stat-label">已答</span>
                </div>
                <div class="exam-panel__stat-item">
                  <span class="exam-panel__stat-value">${markedCount}</span>
                  <span class="exam-panel__stat-label">标记</span>
                </div>
                <div class="exam-panel__stat-item">
                  <span class="exam-panel__stat-value">${this.options.questions.length - answeredCount}</span>
                  <span class="exam-panel__stat-label">未答</span>
                </div>
              </div>
            ` : ''}
          </div>
        </div>
      </div>
    `;
    
    this.questionContainer = this.container.querySelector('#exam-question');
    this.timerEl = this.container.querySelector('#exam-timer');
    this.timerText = this.container.querySelector('.exam-panel__timer-text');
    
    this._renderCurrentQuestion();
  }

  _renderCurrentQuestion() {
    const currentQ = this.options.questions[this.state.currentIndex];
    if (!currentQ) return;
    
    const isCorrect = this.options.mode !== 'exam' && 
      this.state.answers[this.state.currentIndex] && 
      this.state.answers[this.state.currentIndex] === currentQ.answer;
    
    const isWrong = this.options.mode !== 'exam' && 
      this.state.answers[this.state.currentIndex] && 
      this.state.answers[this.state.currentIndex] !== currentQ.answer;
    
    this.questionContainer.innerHTML = `
      <div class="question-card">
        <div class="question-card__header">
          <div class="question-card__number">
            <span class="question-card__number-label">第 ${currentQ.id} 题</span>
            <span class="question-card__type tag tag--${this._getTypeTagClass(currentQ.type)}">${this._getTypeName(currentQ.type)}</span>
          </div>
          <div class="question-card__meta">
            <span class="question-card__difficulty" data-difficulty="${currentQ.difficulty}">${this._getDifficultyLabel(currentQ.difficulty)}</span>
            <span class="question-card__score">${currentQ.score}分</span>
          </div>
        </div>
        
        <div class="question-card__content">
          <div class="question-card__text">${currentQ.text}</div>
          
          ${this._renderOptions(currentQ)}
          
          ${currentQ.type === 'fill' ? this._renderFillInput(currentQ) : ''}
          ${currentQ.type === 'essay' ? this._renderEssayInput(currentQ) : ''}
        </div>
        
        ${(isCorrect || isWrong) ? this._renderAnswerSection(currentQ, isCorrect, isWrong) : ''}
      </div>
    `;
  }

  _getTypeTagClass(type) {
    const classes = { 'single': 'info', 'multiple': 'warning', 'fill': 'success', 'essay': 'default' };
    return classes[type] || 'default';
  }

  _getTypeName(type) {
    const names = { 'single': '单选题', 'multiple': '多选题', 'fill': '填空题', 'essay': '解答题' };
    return names[type] || '其他';
  }

  _getDifficultyLabel(difficulty) {
    const labels = { 'easy': '简单', 'medium': '中等', 'hard': '困难' };
    return labels[difficulty] || '未知';
  }

  _renderOptions(q) {
    if (q.type !== 'single' && q.type !== 'multiple') return '';
    
    const currentAnswer = this.state.answers[this.state.currentIndex];
    
    return `
      <div class="question-card__options">
        ${q.options.map((opt, idx) => {
          const letter = String.fromCharCode(65 + idx);
          const isSelected = currentAnswer && 
            (Array.isArray(currentAnswer) ? currentAnswer.includes(letter) : currentAnswer === letter);
          const isCorrect = this.options.mode !== 'exam' && q.answer.includes(letter);
          const isWrong = this.options.mode !== 'exam' && isSelected && !isCorrect;
          
          return `
            <label class="question-card__option ${isSelected ? 'question-card__option--selected' : ''}
              ${isCorrect ? 'question-card__option--correct' : ''}
              ${isWrong ? 'question-card__option--wrong' : ''}"
            >
              <input type="${q.type === 'multiple' ? 'checkbox' : 'radio'}" 
                name="exam-q-${q.id}" value="${letter}" ${isSelected ? 'checked' : ''}
                ${this.options.mode !== 'exam' && (isCorrect || isWrong) ? 'disabled' : ''}
                onchange="this.dispatchEvent(new CustomEvent('answer-change', {detail: {index: ${this.state.currentIndex}, value: '${letter}', type: '${q.type}'}}))"
              >
              <span class="question-card__option-letter">${letter}</span>
              <span class="question-card__option-text">${opt}</span>
            </label>
          `;
        }).join('')}
      </div>
    `;
  }

  _renderFillInput(q) {
    const currentAnswer = this.state.answers[this.state.currentIndex];
    const isCorrect = this.options.mode !== 'exam' && currentAnswer === q.answer;
    
    return `
      <div class="question-card__fill-section">
        <input type="text" class="question-card__fill-input" 
          value="${currentAnswer || ''}" 
          placeholder="请输入答案"
          oninput="this.dispatchEvent(new CustomEvent('answer-change', {detail: {index: ${this.state.currentIndex}, value: this.value, type: 'fill'}}))"
          ${this.options.mode !== 'exam' && isCorrect ? 'disabled' : ''}
        >
      </div>
    `;
  }

  _renderEssayInput(q) {
    const currentAnswer = this.state.answers[this.state.currentIndex];
    
    return `
      <div class="question-card__essay-section">
        <textarea class="question-card__essay-input" 
          placeholder="请输入解答过程..." rows="6"
          oninput="this.dispatchEvent(new CustomEvent('answer-change', {detail: {index: ${this.state.currentIndex}, value: this.value, type: 'essay'}}))"
        >${currentAnswer || ''}</textarea>
      </div>
    `;
  }

  _renderAnswerSection(q, isCorrect, isWrong) {
    return `
      <div class="question-card__answer-section ${isCorrect ? 'question-card__answer-section--correct' : 'question-card__answer-section--wrong'}">
        <div class="question-card__answer-header">
          ${isCorrect ? '<span class="question-card__result-icon">✓</span>' : '<span class="question-card__result-icon">✗</span>'}
          <span class="question-card__result-text">${isCorrect ? '回答正确' : '回答错误'}</span>
        </div>
        ${q.analysis ? `
          <div class="question-card__analysis">
            <div class="question-card__analysis-label">解析：</div>
            <div class="question-card__analysis-content">${q.analysis}</div>
          </div>
        ` : ''}
      </div>
    `;
  }

  _formatTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  _startTimer() {
    this.state.timerInterval = setInterval(() => {
      this.state.remainingTime--;
      
      if (this.timerText) {
        this.timerText.textContent = this._formatTime(this.state.remainingTime);
      }
      
      if (this.timerEl) {
        if (this.state.remainingTime <= 60) {
          this.timerEl.className = 'exam-panel__timer exam-panel__timer--danger';
        } else if (this.state.remainingTime <= 300) {
          this.timerEl.className = 'exam-panel__timer exam-panel__timer--warning';
        }
      }
      
      if (this.state.remainingTime <= 0) {
        this._submit();
      }
    }, 1000);
  }

  _submit() {
    if (this.state.isSubmitted) return;
    
    this.state.isSubmitted = true;
    clearInterval(this.state.timerInterval);
    
    if (this.options.onSubmit) {
      this.options.onSubmit(this.state.answers);
    }
  }

  _setupEvents() {
    const prevBtn = this.container.querySelector('#exam-prev');
    const nextBtn = this.container.querySelector('#exam-next');
    const markBtn = this.container.querySelector('#exam-mark');
    const submitBtn = this.container.querySelector('#exam-submit');
    const backBtn = this.container.querySelector('#exam-back');
    
    prevBtn?.addEventListener('click', () => this._prevQuestion());
    nextBtn?.addEventListener('click', () => this._nextQuestion());
    markBtn?.addEventListener('click', () => this._toggleMark());
    submitBtn?.addEventListener('click', () => this._confirmSubmit());
    backBtn?.addEventListener('click', () => window.history.back());
    
    const sheetItems = this.container.querySelectorAll('.exam-panel__sheet-item');
    sheetItems.forEach(item => {
      item.addEventListener('click', () => {
        const index = parseInt(item.dataset.index);
        this._goToQuestion(index);
      });
    });
    
    this.questionContainer?.addEventListener('answer-change', (e) => {
      const { index, value, type } = e.detail;
      if (type === 'multiple') {
        const current = this.state.answers[index] || [];
        const checkbox = e.target;
        if (checkbox.checked) {
          current.push(value);
        } else {
          current.splice(current.indexOf(value), 1);
        }
        this.state.answers[index] = current;
      } else {
        this.state.answers[index] = value;
      }
      this._render();
    });
  }

  _prevQuestion() {
    if (this.state.currentIndex > 0) {
      this.state.currentIndex--;
      this._render();
    }
  }

  _nextQuestion() {
    if (this.state.currentIndex < this.options.questions.length - 1) {
      this.state.currentIndex++;
      this._render();
    }
  }

  _goToQuestion(index) {
    if (index >= 0 && index < this.options.questions.length) {
      this.state.currentIndex = index;
      this._render();
    }
  }

  _toggleMark() {
    if (this.state.marked.has(this.state.currentIndex)) {
      this.state.marked.delete(this.state.currentIndex);
    } else {
      this.state.marked.add(this.state.currentIndex);
    }
    this._render();
  }

  _confirmSubmit() {
    const unanswered = this.options.questions.length - Object.keys(this.state.answers).length;
    const message = unanswered > 0 
      ? `还有 ${unanswered} 题未作答，确定要交卷吗？`
      : '确定要交卷吗？';
    
    if (confirm(message)) {
      this._submit();
    }
  }

  destroy() {
    clearInterval(this.state.timerInterval);
  }
}