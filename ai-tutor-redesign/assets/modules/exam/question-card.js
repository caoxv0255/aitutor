export class QuestionCard {
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      question: null,
      mode: 'practice',
      showAnswer: false,
      userAnswer: null,
      onAnswer: null,
      ...options
    };
    
    this._init();
  }

  _init() {
    this._render();
    this._setupEvents();
  }

  _render() {
    if (!this.options.question) return;
    
    const q = this.options.question;
    const isCorrect = this.options.showAnswer && this.options.userAnswer === q.answer;
    const isWrong = this.options.showAnswer && this.options.userAnswer !== null && this.options.userAnswer !== q.answer;
    
    this.container.innerHTML = `
      <div class="question-card">
        <div class="question-card__header">
          <div class="question-card__number">
            <span class="question-card__number-label">第 ${q.id} 题</span>
            <span class="question-card__type tag tag--${this._getTypeTagClass(q.type)}">${this._getTypeName(q.type)}</span>
          </div>
          <div class="question-card__meta">
            <span class="question-card__difficulty" data-difficulty="${q.difficulty}">
              ${this._getDifficultyLabel(q.difficulty)}
            </span>
            <span class="question-card__score">${q.score}分</span>
          </div>
        </div>
        
        <div class="question-card__content">
          <div class="question-card__text">${q.text}</div>
          
          ${this._renderOptions(q)}
          
          ${q.type === 'fill' ? this._renderFillInput(q) : ''}
          ${q.type === 'essay' ? this._renderEssayInput(q) : ''}
        </div>
        
        ${this.options.showAnswer ? this._renderAnswerSection(q, isCorrect, isWrong) : ''}
        
        ${this.options.mode !== 'exam' && !this.options.showAnswer ? this._renderActions() : ''}
      </div>
    `;
    
    this.optionsForm = this.container.querySelector('.question-card__options');
    this.fillInput = this.container.querySelector('.question-card__fill-input');
    this.essayInput = this.container.querySelector('.question-card__essay-input');
  }

  _getTypeTagClass(type) {
    const classes = {
      'single': 'info',
      'multiple': 'warning',
      'fill': 'success',
      'essay': 'default'
    };
    return classes[type] || 'default';
  }

  _getTypeName(type) {
    const names = {
      'single': '单选题',
      'multiple': '多选题',
      'fill': '填空题',
      'essay': '解答题'
    };
    return names[type] || '其他';
  }

  _getDifficultyLabel(difficulty) {
    const labels = {
      'easy': '简单',
      'medium': '中等',
      'hard': '困难'
    };
    return labels[difficulty] || '未知';
  }

  _renderOptions(q) {
    if (q.type !== 'single' && q.type !== 'multiple') return '';
    
    return `
      <div class="question-card__options" id="q-options">
        ${q.options.map((opt, idx) => {
          const letter = String.fromCharCode(65 + idx);
          const isSelected = this.options.userAnswer && 
            (Array.isArray(this.options.userAnswer) 
              ? this.options.userAnswer.includes(letter)
              : this.options.userAnswer === letter
            );
          const isCorrectAnswer = this.options.showAnswer && q.answer.includes(letter);
          const isWrongSelection = this.options.showAnswer && isSelected && !isCorrectAnswer;
          
          return `
            <label class="question-card__option ${isSelected ? 'question-card__option--selected' : ''} 
              ${isCorrectAnswer ? 'question-card__option--correct' : ''}
              ${isWrongSelection ? 'question-card__option--wrong' : ''}"
              ${this.options.mode === 'exam' && this.options.showAnswer ? 'style="pointer-events: none;"' : ''}
            >
              <input 
                type="${q.type === 'multiple' ? 'checkbox' : 'radio'}" 
                name="question-${q.id}" 
                value="${letter}"
                ${isSelected ? 'checked' : ''}
                ${this.options.mode === 'exam' && this.options.showAnswer ? 'disabled' : ''}
              >
              <span class="question-card__option-letter">${letter}</span>
              <span class="question-card__option-text">${opt}</span>
              ${isCorrectAnswer ? '<span class="question-card__option-indicator question-card__option-indicator--correct">正确</span>' : ''}
              ${isWrongSelection ? '<span class="question-card__option-indicator question-card__option-indicator--wrong">错误</span>' : ''}
            </label>
          `;
        }).join('')}
      </div>
    `;
  }

  _renderFillInput(q) {
    return `
      <div class="question-card__fill-section">
        <input 
          type="text" 
          class="question-card__fill-input" 
          placeholder="请输入答案"
          value="${this.options.userAnswer || ''}"
          ${this.options.mode === 'exam' && this.options.showAnswer ? 'disabled' : ''}
        >
        ${this.options.showAnswer ? `<div class="question-card__fill-answer">正确答案：${q.answer}</div>` : ''}
      </div>
    `;
  }

  _renderEssayInput(q) {
    return `
      <div class="question-card__essay-section">
        <textarea 
          class="question-card__essay-input" 
          placeholder="请输入解答过程..."
          rows="6"
          ${this.options.mode === 'exam' && this.options.showAnswer ? 'disabled' : ''}
        >${this.options.userAnswer || ''}</textarea>
        ${this.options.showAnswer ? `
          <div class="question-card__essay-answer">
            <div class="question-card__essay-answer-label">参考答案：</div>
            <div class="question-card__essay-answer-content">${q.analysis || q.answer}</div>
          </div>
        ` : ''}
      </div>
    `;
  }

  _renderAnswerSection(q, isCorrect, isWrong) {
    return `
      <div class="question-card__answer-section ${isCorrect ? 'question-card__answer-section--correct' : isWrong ? 'question-card__answer-section--wrong' : ''}">
        <div class="question-card__answer-header">
          ${isCorrect ? '<span class="question-card__result-icon">✓</span>' : isWrong ? '<span class="question-card__result-icon">✗</span>' : ''}
          <span class="question-card__result-text">${isCorrect ? '回答正确' : isWrong ? '回答错误' : '参考答案'}</span>
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

  _renderActions() {
    return `
      <div class="question-card__actions">
        <button class="question-card__action-btn question-card__action-btn--primary" id="q-submit">提交答案</button>
        <button class="question-card__action-btn question-card__action-btn--secondary" id="q-show-answer">查看答案</button>
      </div>
    `;
  }

  _setupEvents() {
    const submitBtn = this.container.querySelector('#q-submit');
    const showAnswerBtn = this.container.querySelector('#q-show-answer');
    
    if (submitBtn) {
      submitBtn.addEventListener('click', () => {
        this._submitAnswer();
      });
    }
    
    if (showAnswerBtn) {
      showAnswerBtn.addEventListener('click', () => {
        this.setShowAnswer(true);
      });
    }
  }

  _submitAnswer() {
    let answer;
    
    if (this.options.question.type === 'single') {
      const radio = this.optionsForm?.querySelector('input:checked');
      answer = radio ? radio.value : null;
    } else if (this.options.question.type === 'multiple') {
      const checkboxes = this.optionsForm?.querySelectorAll('input:checked');
      answer = checkboxes ? Array.from(checkboxes).map(cb => cb.value) : null;
    } else if (this.options.question.type === 'fill') {
      answer = this.fillInput?.value.trim() || null;
    } else if (this.options.question.type === 'essay') {
      answer = this.essayInput?.value.trim() || null;
    }
    
    this.options.userAnswer = answer;
    
    if (this.options.onAnswer) {
      this.options.onAnswer(answer);
    }
    
    this.setShowAnswer(true);
  }

  setShowAnswer(show) {
    this.options.showAnswer = show;
    this._render();
    this._setupEvents();
  }

  setUserAnswer(answer) {
    this.options.userAnswer = answer;
    this._render();
    this._setupEvents();
  }

  getUserAnswer() {
    return this.options.userAnswer;
  }

  updateQuestion(question) {
    this.options.question = question;
    this.options.showAnswer = false;
    this.options.userAnswer = null;
    this._render();
    this._setupEvents();
  }
}