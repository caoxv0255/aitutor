export class TutorChat {
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      subject: 'math',
      messages: [],
      onSend: null,
      ...options
    };
    
    this.state = {
      streaming: false,
      currentMessage: null
    };
    
    this._init();
  }

  _init() {
    this._render();
    this._setupEvents();
  }

  _render() {
    this.container.innerHTML = `
      <div class="tutor-chat">
        <div class="tutor-chat__header">
          <div class="tutor-chat__subject">
            <select class="tutor-chat__subject-select">
              <option value="math">数学</option>
              <option value="chinese">语文</option>
              <option value="english">英语</option>
              <option value="physics">物理</option>
              <option value="chemistry">化学</option>
              <option value="politics">政治</option>
            </select>
          </div>
          <div class="tutor-chat__status">
            <span class="tutor-chat__status-indicator"></span>
            <span class="tutor-chat__status-text">AI 导师在线</span>
          </div>
        </div>
        
        <div class="tutor-chat__messages" id="tutor-messages">
          ${this._renderMessages()}
        </div>
        
        <div class="tutor-chat__input-area">
          <div class="tutor-chat__input-wrapper">
            <textarea 
              class="tutor-chat__input" 
              placeholder="输入你的问题..." 
              rows="2"
              id="tutor-input"
            ></textarea>
            <button class="tutor-chat__send-btn" id="tutor-send">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            </button>
          </div>
        </div>
      </div>
    `;
    
    this.messagesContainer = this.container.querySelector('#tutor-messages');
    this.input = this.container.querySelector('#tutor-input');
    this.sendBtn = this.container.querySelector('#tutor-send');
    this.subjectSelect = this.container.querySelector('.tutor-chat__subject-select');
  }

  _renderMessages() {
    return this.options.messages.map(msg => this._renderMessage(msg)).join('');
  }

  _renderMessage(msg) {
    const isUser = msg.role === 'user';
    return `
      <div class="tutor-chat__message tutor-chat__message--${isUser ? 'user' : 'ai'}">
        <div class="tutor-chat__message-avatar">
          ${isUser 
            ? '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>' 
            : '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a10 10 0 1 0 10 10 10 10 0 0 0-10-10zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z"/><path d="M9.05 7.65l5.65 5.65a.5.5 0 0 1 0 .7l-1.4 1.4a.5.5 0 0 1-.7 0L8.35 8.35a.5.5 0 0 1 0-.7z"/></svg>'
          }
        </div>
        <div class="tutor-chat__message-content">
          ${msg.metadata ? this._renderMetadata(msg.metadata) : ''}
          <div class="tutor-chat__message-text" ${msg.streaming ? 'data-streaming="true"' : ''}>
            ${msg.content}
          </div>
        </div>
      </div>
    `;
  }

  _renderMetadata(metadata) {
    if (!metadata) return '';
    
    const { diagnosis, learning_path } = metadata;
    if (!diagnosis) return '';
    
    return `
      <div class="tutor-chat__metadata">
        <div class="tutor-chat__diagnosis">
          <div class="tutor-chat__diagnosis-label">诊断结果</div>
          <div class="tutor-chat__diagnosis-content">
            ${diagnosis.weak_prerequisites && diagnosis.weak_prerequisites.length > 0 
              ? `<div class="tutor-chat__weak-points">
                   <span class="tutor-chat__weak-label">薄弱前置知识点：</span>
                   <span class="tutor-chat__weak-list">${diagnosis.weak_prerequisites.join('、')}</span>
                 </div>` 
              : ''
            }
            ${diagnosis.mastery !== undefined 
              ? `<div class="tutor-chat__mastery">
                   <span class="tutor-chat__mastery-label">掌握度：</span>
                   <span class="tutor-chat__mastery-value">${(diagnosis.mastery * 100).toFixed(0)}%</span>
                 </div>` 
              : ''
            }
          </div>
        </div>
      </div>
    `;
  }

  _setupEvents() {
    this.sendBtn.addEventListener('click', () => this._handleSend());
    
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this._handleSend();
      }
    });
    
    this.subjectSelect.addEventListener('change', (e) => {
      this.options.subject = e.target.value;
    });
  }

  _handleSend() {
    const text = this.input.value.trim();
    if (!text || this.state.streaming) return;
    
    this.input.value = '';
    
    const userMsg = { role: 'user', content: text, timestamp: Date.now() };
    this.options.messages.push(userMsg);
    this._appendMessage(userMsg);
    
    this.state.streaming = true;
    this.sendBtn.disabled = true;
    
    const aiMsg = { role: 'ai', content: '', streaming: true, timestamp: Date.now() };
    this.options.messages.push(aiMsg);
    const msgElement = this._appendMessage(aiMsg);
    
    if (this.options.onSend) {
      this.options.onSend(text, this.options.subject, {
        onMetadata: (metadata) => {
          aiMsg.metadata = metadata;
          this._updateMessage(msgElement, aiMsg);
        },
        onContent: (content) => {
          aiMsg.content += content;
          this._updateMessageContent(msgElement, aiMsg.content);
        },
        onDone: () => {
          this.state.streaming = false;
          aiMsg.streaming = false;
          this.sendBtn.disabled = false;
        },
        onError: () => {
          this.state.streaming = false;
          this.sendBtn.disabled = false;
        }
      });
    }
  }

  _appendMessage(msg) {
    const msgElement = document.createElement('div');
    msgElement.innerHTML = this._renderMessage(msg);
    this.messagesContainer.appendChild(msgElement);
    this._scrollToBottom();
    return msgElement;
  }

  _updateMessage(element, msg) {
    element.innerHTML = this._renderMessage(msg);
    this._scrollToBottom();
  }

  _updateMessageContent(element, content) {
    const textEl = element.querySelector('.tutor-chat__message-text');
    if (textEl) {
      textEl.innerHTML = content;
      this._scrollToBottom();
    }
  }

  _scrollToBottom() {
    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
  }

  addMessage(msg) {
    this.options.messages.push(msg);
    this._appendMessage(msg);
  }

  clearMessages() {
    this.options.messages = [];
    this.messagesContainer.innerHTML = '';
  }
}