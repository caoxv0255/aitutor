import { context } from './utils/context.js';
import { aiService } from './services/aiService.js';
import { ImageCropper } from './components/cropper.js';

class App {
  constructor() {
    this.loadVisitCounter();

    if (context.isLoggedIn()) {
      this.currentPage = 'menu';
      context.loadWrongQuestionsFromDB();
      context.loadReportsFromDB();
      context.loadTasks();
    } else {
      this.currentPage = 'login';
    }
    this.cropper = null;
    this._timers = [];
    this._abortControllers = [];
    this._pageListeners = [];
    this.render();
  }

  _addTimer(id) {
    this._timers.push(id);
    return id;
  }

  _clearTimer(id) {
    clearTimeout(id);
    clearInterval(id);
    this._timers = this._timers.filter(t => t !== id);
  }

  _addAbortController(controller) {
    this._abortControllers.push(controller);
    return controller;
  }

  _addPageListener(target, event, handler, options) {
    target.addEventListener(event, handler, options);
    this._pageListeners.push({ target, event, handler });
  }

  cleanupPage() {
    this._timers.forEach(id => {
      clearTimeout(id);
      clearInterval(id);
    });
    this._timers = [];

    this._abortControllers.forEach(c => {
      if (!c.signal.aborted) c.abort();
    });
    this._abortControllers = [];

    this._pageListeners.forEach(({ target, event, handler }) => {
      target.removeEventListener(event, handler);
    });
    this._pageListeners = [];

    if (this.cropper) {
      this.cropper.destroy();
      this.cropper = null;
    }
  }

  render() {
    this.cleanupPage();
    const app = document.getElementById('app');
    app.innerHTML = this.getPageHTML();
    this.attachEventListeners();

    // photoPicker 使用遮罩层覆盖菜单页
    if (this.currentPage === 'photoPicker') {
      this.showPhotoPickerOverlay();
    } else {
      this.closePhotoPickerOverlay();
    }
  }

  getPageHTML() {
    switch (this.currentPage) {
      case 'login': return this.renderLogin();
      case 'register': return this.renderRegister();
      case 'resetPassword': return this.renderResetPassword();
      case 'menu': return this.renderMenu();
      case 'provinceSelect': return this.renderProvinceSelect();
      case 'camera': return this.renderCamera();
      case 'crop': return this.renderCrop();
      case 'solution': return this.renderSolution();
      case 'taskQueue': return this.renderTaskQueue();
      case 'taskDetail': return this.renderTaskDetail();
      case 'wrongbook': return this.renderWrongBook();
      case 'subjectQuestions': return this.renderSubjectQuestions();
      case 'detail': return this.renderDetail();
      case 'reports': return this.renderReports();
      case 'reportDetail': return this.renderReportDetail();
      case 'photoPicker': return this.renderPhotoPicker();
      default: return '';
    }
  }

  // ========== 页面渲染 ==========

  renderLogin() {
    return `
      <div class="page">
        <h1 class="page-title">智启AI导师</h1>
        <p class="page-title-sub">拍照解题 · 错题管理 · AI 智能学习</p>
        <div class="visit-counter-container">
          <div class="visit-counter-badge" id="loginVisitCounter"></div>
        </div>
        <div class="input-group">
          <input type="email" class="input-field" id="email" placeholder="邮箱">
        </div>
        <div class="input-group">
          <input type="password" class="input-field" id="password" placeholder="密码">
        </div>
        <button class="btn-primary" id="loginBtn">登 录</button>
        <p style="text-align: center; margin-top: 4px; margin-bottom: var(--space-lg);">
          <a href="#" id="goRegisterLink" class="app-link">注册账号</a>
          &nbsp;·&nbsp;
          <a href="#" id="forgotPasswordLink" class="app-link" style="font-size: 14px;">忘记密码？</a>
        </p>
        <div class="app-separator">或者</div>
        <button class="btn-primary btn-green btn-pill" id="guestLoginBtn" style="margin-top: var(--space-md);">🎯 免登录体验</button>
      </div>
    `;
  }

  renderRegister() {
    return `
      <div class="page">
        <button class="back-btn" id="backBtn"></button>
        <h1 style="text-align: center; margin-bottom: 40px;">注册账号</h1>
        <input type="email" class="input-field" id="regEmail" placeholder="邮箱">
        <input type="password" class="input-field" id="regPassword" placeholder="密码（至少6位）">
        <select class="select-field" id="regGrade">
          <option value="">选择年级</option>
          <option value="小学">小学</option>
          <option value="初中">初中</option>
          <option value="高中">高中</option>
        </select>
        <button class="btn-primary" id="registerBtn">注 册</button>
        <p style="text-align: center; margin-top: 16px;">
          已有账号？<a href="#" id="goLoginLink" style="color: #0071e3;">登录</a>
        </p>
      </div>
    `;
  }

  renderResetPassword() {
    return `
      <div class="page">
        <button class="back-btn" id="backBtn"></button>
        <h1 style="text-align: center; margin-bottom: 40px;">重置密码</h1>
        <input type="email" class="input-field" id="resetEmail" placeholder="邮箱">
        <input type="password" class="input-field" id="newPassword" placeholder="新密码（至少6位）">
        <button class="btn-primary" id="resetBtn">确认重置</button>
      </div>
    `;
  }

  renderMenu() {
    const email = context.user?.email || '';
    const isGuest = email.includes('guest_');
    const pendingCount = (context.tasks || []).filter(t => t.status === 'pending' || t.status === 'processing').length;
    const displayEmail = isGuest ? '游客模式' : email;
    const province = context.user?.province || '未设置';
    const examLevel = context.user?.exam_level || '未设置';
    return `
      <div class="page">
        <div class="user-bar">
          <div class="user-bar-info">
            <div class="user-bar-avatar">${isGuest ? '👤' : email.charAt(0).toUpperCase()}</div>
            <span>${displayEmail}</span>
          </div>
          <button id="logoutBtn" class="logout-btn">退出</button>
        </div>
        <div class="visit-counter-container">
          <div class="visit-counter-badge" id="menuVisitCounter"></div>
        </div>

        <div class="province-info-card" id="provinceSelectBtn" style="background:linear-gradient(135deg,#d71920 0%,#8b1015 100%);color:#fff;border-radius:12px;padding:16px;margin-bottom:20px;cursor:pointer">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div>
              <div style="font-size:12px;opacity:0.8">我的考试地区</div>
              <div style="font-size:20px;font-weight:bold;margin-top:4px" id="provinceDisplay">${province}</div>
              <div style="font-size:13px;opacity:0.9;margin-top:2px" id="examLevelDisplay">${examLevel === 'gaokao' ? '高考' : examLevel === 'zhongkao' ? '中考' : examLevel}</div>
            </div>
            <div style="font-size:24px">›</div>
          </div>
        </div>

        <h1 class="page-title" style="padding-bottom: var(--space-lg);">选择功能</h1>
        <input type="file" accept="image/*" capture="environment" id="menuCameraInput" style="display: none;">
        <input type="file" accept="image/*" id="menuAlbumInput" style="display: none;">
        <div class="menu-grid">
          <div class="menu-card" id="cameraBtn">
            <div class="menu-card-icon camera">📷</div>
            <div class="menu-card-text">
              <h3>拍照搜题</h3>
              <p>拍摄题目，AI 智能解析</p>
            </div>
            <div class="menu-card-arrow">›</div>
          </div>
          <div class="menu-card" id="taskQueueBtn">
            <div class="menu-card-icon task">📋</div>
            <div class="menu-card-text">
              <h3>任务队列${pendingCount > 0 ? ` <span class="badge">${pendingCount}</span>` : ''}</h3>
              <p>查看解析进度和结果</p>
            </div>
            <div class="menu-card-arrow">›</div>
          </div>
          <div class="menu-card" id="wrongbookBtn">
            <div class="menu-card-icon book">📚</div>
            <div class="menu-card-text">
              <h3>错题本</h3>
              <p>回顾错题，生成学科报告</p>
            </div>
            <div class="menu-card-arrow">›</div>
          </div>
        </div>
      </div>
    `;
  }

  renderPhotoPicker() {
    return this.renderMenu();
  }

  renderProvinceSelect() {
    return `
      <div class="page">
        <button class="back-btn" id="backBtn"></button>
        <h2 style="text-align: center; margin-bottom: 24px;">选择考试地区</h2>
        <div style="margin-bottom: 20px;">
          <label style="font-size: 14px; color: #86868b; display: block; margin-bottom: 8px;">考试类型</label>
          <select class="select-field" id="examLevelSelect">
            <option value="gaokao">高考</option>
            <option value="zhongkao">中考</option>
          </select>
        </div>
        <div style="margin-bottom: 20px;">
          <label style="font-size: 14px; color: #86868b; display: block; margin-bottom: 8px;">选择省份</label>
          <div id="provinceList" style="max-height: 400px; overflow-y: auto;">
            <div style="text-align: center; color: #86868b; padding: 20px;">加载中...</div>
          </div>
        </div>
        <button class="btn-primary" id="confirmProvinceBtn">确认选择</button>
      </div>
    `;
  }

  renderCamera() {
    return `
      <div class="page">
        <button class="back-btn" id="backBtn"></button>
        <h2 style="text-align: center; margin-bottom: 40px;">拍照搜题</h2>
        <div class="camera-box" id="cameraBox">
          <input type="file" accept="image/*" id="fileInput" style="display: none;">
          <span style="color: #86868b;">点击上传题目图片</span>
        </div>
        <button class="btn-primary" id="confirmPhoto" style="display: none;">确认拍照</button>
      </div>
    `;
  }

  renderCrop() {
    const subjects = context.getSubjects();
    return `
      <div class="page">
        <button class="back-btn" id="backBtn"></button>
        <h2 style="text-align: center; margin-bottom: 20px;">裁剪与选择学科</h2>
        <div id="cropperContainer" style="width: 100%; height: 400px; background: #000; border-radius: 16px; position: relative; overflow: hidden;"></div>
        <input type="file" accept="image/*" id="cropFileInput" style="display: none;">
        <button class="btn-secondary" id="rePickBtn" style="margin-top: 12px;">从相册选择图片</button>
        <div class="subject-slider">
          ${subjects.map(s => `<div class="subject-item" data-subject="${s}">${s}</div>`).join('')}
        </div>
        <button class="btn-primary" id="confirmCrop">提交解析</button>
      </div>
    `;
  }

  renderSolution() {
    return `
      <div class="page">
        <button class="back-btn" id="backBtn"></button>
        <h2 style="text-align: center; margin-bottom: 20px;">题目解析</h2>
        <div id="solutionContainer">
          <div class="loading">
            <div class="spinner"></div>
            <p style="margin-top: 20px; color: #86868b;">AI导师正在分析中...</p>
          </div>
        </div>
      </div>
    `;
  }

  renderTaskQueue() {
    const tasks = context.tasks || [];
    const statusLabel = { pending: '排队中', processing: '解析中', completed: '已完成', failed: '失败' };
    const statusClass = { pending: 'status-pending', processing: 'status-processing', completed: 'status-completed', failed: 'status-failed' };
    return `
      <div class="page">
        <button class="back-btn" id="backBtn"></button>
        <h2 style="text-align: center; margin-bottom: 20px;">任务队列</h2>
        <button class="btn-secondary" id="refreshTasksBtn" style="margin-bottom: 16px;">刷新状态</button>
        <div class="question-list">
          ${tasks.length === 0 ? '<p style="text-align: center; color: #86868b;">暂无提交记录</p>' :
          tasks.map(t => `
            <div class="task-item ${t.status === 'completed' ? 'clickable' : ''}" data-id="${t._id}" data-status="${t.status}">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                  <span style="font-weight: 600;">${t.subject}</span>
                  <span class="task-status ${statusClass[t.status]}">${statusLabel[t.status]}</span>
                </div>
                <div style="font-size: 13px; color: #86868b;">${new Date(t.createdAt).toLocaleString()}</div>
              </div>
              ${t.status === 'failed' ? '<div style="color: #ff3b30; font-size: 13px; margin-top: 6px;">解析失败，请重新提交</div>' : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  renderTaskDetail() {
    const task = context.getTask(this.currentTaskId);
    if (!task || !task.result) return '<div class="page"><p>任务不存在或尚未完成</p></div>';
    const result = task.result;
    const isEssay = task.subject === '作文';
    return `
      <div class="page">
        <button class="back-btn" id="backBtn"></button>
        <h2 style="text-align: center; margin-bottom: 20px;">${isEssay ? '作文点评' : '解析结果'}</h2>
        <div class="solution-content">
          <div class="solution-section">
            <h3>📷 ${isEssay ? '作文' : '题目'}</h3>
            <img src="${task.imageData}" alt="${isEssay ? '作文' : '题目'}" style="width: 100%; border-radius: 8px;">
          </div>
          <div class="solution-section">
            <h3>💡 ${isEssay ? '本文亮点' : '思考线索'}</h3>
            <div>${this.renderMarkdown(result.clue)}</div>
          </div>
          <div class="solution-section">
            <h3>📝 ${isEssay ? '改进之处' : '详细解答'}</h3>
            <div>${this.renderMarkdown(result.solution)}</div>
          </div>
          <div class="solution-section">
            <h3>🔍 ${isEssay ? '改进示例' : '错因分析'}</h3>
            <div>${this.renderMarkdown(result.analysis)}</div>
          </div>
          ${!isEssay ? `
          <div class="solution-section">
            <h3>📊 题目信息</h3>
            <p>难度: ${result.metadata?.difficulty || '?'}/5</p>
            <p>考频: ${result.metadata?.frequency || '?'}</p>
          </div>` : ''}
        </div>
      </div>
    `;
  }

  renderWrongBook() {
    const subjects = context.getSubjects();
    const subjectCounts = {};
    subjects.forEach(s => {
      subjectCounts[s] = context.wrongQuestions.filter(q => q.subject === s).length;
    });

    return `
      <div class="page">
        <button class="back-btn" id="backBtn"></button>
        <h2 style="text-align: center; margin-bottom: 20px;">错题本</h2>
        <div class="question-list">
          ${subjects.map(subject => `
            <div class="subject-category" data-subject="${subject}">
              <div style="font-size: 18px; font-weight: 600;">${subject}</div>
              <div class="subject-count" style="color: #86868b; font-size: 14px; margin-top: 4px;">${subjectCounts[subject]} 道错题</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  renderSubjectQuestions() {
    const questions = context.wrongQuestions.filter(q => q.subject === this.currentSubject);
    const isEssay = this.currentSubject === '作文';
    return `
      <div class="page">
        <button class="back-btn" id="backBtn"></button>
        <h2 style="text-align: center; margin-bottom: 20px;">${isEssay ? '作文' : `${this.currentSubject} 错题`}</h2>
        <button class="btn-primary" id="generateReportBtn" style="margin-bottom: 20px;">生成学科报告</button>
        <button class="btn-primary" id="viewReportsBtn" style="margin-bottom: 20px; background: #007aff;">查看历史报告</button>
        <div class="question-list">
          ${questions.length === 0 ? '<p style="text-align: center; color: #86868b;">' + (isEssay ? '暂无作文' : '暂无错题') + '</p>' :
        questions.map(q => `
              <div class="question-item" data-id="${q._id}">
                <img src="${q.croppedImage}" alt="题目" style="width: 100%; border-radius: 8px; margin-bottom: 8px;">
                <div style="color: #86868b; font-size: 14px;">${new Date(q.timestamp).toLocaleDateString()}</div>
              </div>
            `).join('')}
        </div>
      </div>
    `;
  }

  renderReports() {
    const reports = context.getSubjectReports(this.currentSubject);
    return `
      <div class="page">
        <button class="back-btn" id="backBtn"></button>
        <h2 style="text-align: center; margin-bottom: 20px;">${this.currentSubject} 学科报告</h2>
        <div class="question-list">
          ${reports.length === 0 ? '<p style="text-align: center; color: #86868b;">暂无报告</p>' :
        reports.map(r => `
              <div class="report-item" data-id="${r._id}">
                <div class="report-item-header">
                  <div style="font-size: 16px; font-weight: 600; margin-bottom: 8px;">${r.title}</div>
                  <div style="color: #86868b; font-size: 14px;">${new Date(r.timestamp).toLocaleString()}</div>
                  <div style="color: #86868b; font-size: 13px; margin-top: 4px;">${r.summary || ''}</div>
                </div>
                <div style="display: flex; gap: 8px; margin-top: 12px;">
                  <button class="view-report-btn" data-id="${r._id}" style="flex: 1; padding: 8px; background: #0071e3; color: white; border: none; border-radius: 8px; cursor: pointer;">查看详情</button>
                  <button class="delete-report-btn" data-id="${r._id}" style="padding: 8px 12px; background: #ff3b30; color: white; border: none; border-radius: 8px; cursor: pointer;">删除</button>
                </div>
              </div>
            `).join('')}
        </div>
      </div>
    `;
  }

  renderReportDetail() {
    const report = context.getReport(this.currentReportId);
    if (!report) return '<div class="page"><p>报告不存在</p></div>';

    const weakPointsHtml = (report.weakPoints || []).map(p => `<li>${this.sanitize(p)}</li>`).join('');
    const similarQuestions = report.similarQuestions || [];

    const similarQuestionsHtml = similarQuestions.length === 0
      ? `<p style="color:#86868b;font-size:14px;text-align:center;padding:16px 0;">暂无类题数据，请重新生成报告</p>`
      : `
        <div class="similar-questions-list">
          ${similarQuestions.map((q, i) => this.renderSimilarQuestionCard(q, i)).join('')}
        </div>
      `;

    return `
      <div class="page">
        <button class="back-btn" id="backBtn"></button>
        <h2 style="text-align: center; margin-bottom: 20px;">${this.sanitize(report.title)}</h2>
        <div class="solution-content">
          <div class="solution-section">
            <h3>🕸️ 知识图谱</h3>
            <canvas id="knowledgeGraphCanvas" style="width:100%;border-radius:12px;background:#f5f5f7;display:block;"></canvas>
          </div>
          <div class="solution-section">
            <h3>📊 总体评估</h3>
            <div>${this.renderMarkdown(report.summary || '暂无评估')}</div>
          </div>
          <div class="solution-section">
            <h3>⚠️ 薄弱知识点</h3>
            <ul style="padding-left: 20px;">${weakPointsHtml || '<li>暂无数据</li>'}</ul>
          </div>
          <div class="solution-section">
            <h3>💡 学习建议</h3>
            <div>${this.renderMarkdown(report.suggestions || '暂无建议')}</div>
          </div>
          <div class="solution-section">
            <h3>🌟 老师寄语</h3>
            <div>${this.renderMarkdown(report.encouragement || '继续加油！')}</div>
          </div>
          <div class="solution-section">
            <h3>📝 类题推荐</h3>
            <p style="color:#86868b;font-size:13px;margin-bottom:12px;">针对薄弱知识点的专项练习题，点击题目可查看解题思路</p>
            <div id="similarQuestionsContainer">
              ${similarQuestionsHtml}
            </div>
          </div>
          <div class="solution-section">
            <h3>📈 统计信息</h3>
            <p>错题数量: ${report.questionCount || 0} 道</p>
            <p>生成时间: ${new Date(report.timestamp).toLocaleString()}</p>
          </div>
        </div>
      </div>
    `;
  }

  renderSimilarQuestionCard(q, index) {
    const difficultyStars = '★'.repeat(q.difficulty || 3) + '☆'.repeat(5 - (q.difficulty || 3));
    const typeColor = { '选择题': '#0071e3', '填空题': '#ff9500', '解答题': '#34c759' };
    const color = typeColor[q.type] || '#86868b';
    const kpHtml = (q.knowledgePoints || []).map(kp =>
      `<span class="kp-tag">${this.sanitize(kp)}</span>`
    ).join('');

    return `
      <div class="similar-question-card" data-index="${index}">
        <div class="sq-header">
          <span class="sq-type-badge" style="background:${color}">${this.sanitize(q.type || '练习题')}</span>
          <span class="sq-difficulty">${difficultyStars}</span>
          <span class="sq-index">第 ${index + 1} 题</span>
        </div>
        <div class="sq-title">${this.renderMarkdown(q.title || '')}</div>
        ${q.imageDescription ? `<div class="sq-image-desc">📐 ${this.sanitize(q.imageDescription)}</div>` : ''}
        <div class="sq-kp-row">${kpHtml}</div>
        <div class="sq-expand-btn" data-index="${index}">查看解题思路 ▾</div>
        <div class="sq-solution-panel" id="sqPanel${index}" style="display:none;">
          <div class="sq-hint">
            <strong>💡 思路提示</strong>
            <div>${this.renderMarkdown(q.hint || '')}</div>
          </div>
          <div class="sq-answer">
            <strong>✅ 参考答案</strong>
            <div>${this.renderMarkdown(q.answer || '')}</div>
          </div>
          <div class="sq-steps">
            <strong>📋 详细步骤</strong>
            <div>${this.renderMarkdown(q.solution || '')}</div>
          </div>
        </div>
      </div>
    `;
  }

  renderDetail() {
    const question = context.getWrongQuestion(this.currentQuestionId);
    if (!question) return '<div>题目不存在</div>';

    const isEssay = question.subject === '作文';
    return `
      <div class="page">
        <button class="back-btn" id="backBtn"></button>
        <h2 style="text-align: center; margin-bottom: 20px;">${isEssay ? '作文详情' : '错题详情'}</h2>
        <div class="solution-content">
          <div class="solution-section">
            <h3>📷 ${isEssay ? '作文' : '题目'}</h3>
            <img src="${question.croppedImage}" alt="${isEssay ? '作文' : '题目'}" style="width: 100%; border-radius: 8px;">
          </div>
          <div class="solution-section">
            <h3>💡 ${isEssay ? '本文亮点' : '思考线索'}</h3>
            <div>${this.renderMarkdown(question.clue)}</div>
          </div>
          <div class="solution-section">
            <h3>📝 ${isEssay ? '改进之处' : '详细解答'}</h3>
            <div>${this.renderMarkdown(question.solution)}</div>
          </div>
          <div class="solution-section">
            <h3>🔍 ${isEssay ? '改进示例' : '错因分析'}</h3>
            <div>${this.renderMarkdown(question.analysis)}</div>
          </div>
          ${!isEssay ? `
          <div class="solution-section">
            <h3>📊 题目信息</h3>
            <p>难度: ${question.metadata?.difficulty || '?'}/5</p>
            <p>考频: ${question.metadata?.frequency || '?'}</p>
          </div>` : ''}
        </div>
        <button class="btn-primary" id="deleteBtn" style="background: #ff3b30;">${isEssay ? '删除此作文' : '删除此错题'}</button>
      </div>
    `;
  }

  // ========== 工具方法 ==========

  sanitize(text) {
    if (!text) return '';
    return window.DOMPurify.sanitize(text);
  }

  sanitizeSvg(svg) {
    if (!svg) return '';
    return window.DOMPurify.sanitize(svg, {
      USE_PROFILES: { svg: true, svgFilters: true },
      ADD_ATTR: ['viewBox', 'xmlns'],
      FORBID_TAGS: ['script', 'foreignObject', 'style'],
      FORBID_ATTR: ['onload', 'onclick', 'onerror', 'onmouseover']
    });
  }

  renderMarkdown(text) {
    if (!text) return '';

    text = text.replace(/\$\$([\s\S]*?)\$\$/g, (match, formula) => {
      try {
        return window.katex.renderToString(formula.trim(), { displayMode: true, throwOnError: false });
      } catch (e) { return match; }
    });

    text = text.replace(/\$([^\$\n]+?)\$/g, (match, formula) => {
      try {
        return window.katex.renderToString(formula.trim(), { displayMode: false, throwOnError: false });
      } catch (e) { return match; }
    });

    // 将独立的图片URL转为markdown图片语法
    text = text.replace(/(^|\n)(https?:\/\/[^\s]+\.(?:png|jpg|jpeg|gif|webp|svg)(?:\?[^\s]*)?)(\n|$)/gi,
      (match, pre, url, post) => `${pre}![图片](${url})${post}`
    );

    let html = window.marked.parse(text);

    html = window.DOMPurify.sanitize(html, {
      ADD_TAGS: ['span', 'math', 'semantics', 'mrow', 'mi', 'mo', 'mn', 'msup', 'msub', 'mfrac', 'annotation', 'img'],
      ADD_ATTR: ['class', 'style', 'aria-hidden', 'encoding', 'src', 'alt']
    });

    return html;
  }

  // ========== 事件绑定 ==========

  attachEventListeners() {
    const backBtn = document.getElementById('backBtn');
    if (backBtn) {
      backBtn.onclick = () => {
        const backMap = {
          register: 'login', resetPassword: 'login',
          camera: 'menu', crop: 'menu', solution: 'menu',
          taskQueue: 'menu', taskDetail: 'taskQueue',
          wrongbook: 'menu', subjectQuestions: 'wrongbook',
          detail: 'subjectQuestions', reports: 'subjectQuestions',
          reportDetail: 'reports'
        };
        this.navigateTo(backMap[this.currentPage] || 'menu');
      };
    }

    // 登录页
    if (this.currentPage === 'login') {
      const loginBtn = document.getElementById('loginBtn');
      loginBtn.onclick = async () => {
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;

        if (!email || !password) { alert('请填写邮箱和密码'); return; }

        loginBtn.disabled = true;
        loginBtn.textContent = '登录中...';

        const result = await context.login(email, password);
        if (result.success) {
          this.navigateTo('menu');
        } else {
          alert(result.message || '登录失败');
          loginBtn.disabled = false;
          loginBtn.textContent = '登 录';
        }
      };

      document.getElementById('goRegisterLink').onclick = (e) => {
        e.preventDefault();
        this.navigateTo('register');
      };

      document.getElementById('forgotPasswordLink').onclick = (e) => {
        e.preventDefault();
        this.navigateTo('resetPassword');
      };

      const guestBtn = document.getElementById('guestLoginBtn');
      if (guestBtn) {
        guestBtn.onclick = async () => {
          guestBtn.disabled = true;
          guestBtn.textContent = '进入中...';
          const result = await context.guestLogin();
          if (result.success) {
            this.navigateTo('menu');
          } else {
            alert(result.message || '免登录进入失败');
            guestBtn.disabled = false;
            guestBtn.textContent = '🎯 免登录体验';
          }
        };
      }
    }

    // 注册页
    if (this.currentPage === 'register') {
      const registerBtn = document.getElementById('registerBtn');
      registerBtn.onclick = async () => {
        const email = document.getElementById('regEmail').value.trim();
        const password = document.getElementById('regPassword').value;
        const grade = document.getElementById('regGrade').value;

        if (!email || !password || !grade) { alert('请填写完整信息'); return; }
        if (password.length < 6) { alert('密码至少需要6位'); return; }

        registerBtn.disabled = true;
        registerBtn.textContent = '注册中...';

        const result = await context.register(email, password, grade);
        if (result.success) {
          this.navigateTo('menu');
        } else {
          alert(result.message || '注册失败');
          registerBtn.disabled = false;
          registerBtn.textContent = '注 册';
        }
      };

      document.getElementById('goLoginLink').onclick = (e) => {
        e.preventDefault();
        this.navigateTo('login');
      };
    }

    // 重置密码页
    if (this.currentPage === 'resetPassword') {
      const resetBtn = document.getElementById('resetBtn');
      resetBtn.onclick = async () => {
        const email = document.getElementById('resetEmail').value.trim();
        const newPassword = document.getElementById('newPassword').value;

        if (!email || !newPassword) { alert('请填写完整信息'); return; }
        if (newPassword.length < 6) { alert('密码至少需要6位'); return; }

        resetBtn.disabled = true;
        resetBtn.textContent = '重置中...';

        const result = await context.resetPassword(email, newPassword);
        if (result.success) {
          alert('密码重置成功，请重新登录');
          this.navigateTo('login');
        } else {
          alert(result.message || '重置失败');
          resetBtn.disabled = false;
          resetBtn.textContent = '确认重置';
        }
      };
    }

    // 菜单页 / photoPicker（需绑定文件输入事件）
    if (this.currentPage === 'menu' || this.currentPage === 'photoPicker') {
      const provinceBtn = document.getElementById('provinceSelectBtn');
      if (provinceBtn) {
        provinceBtn.onclick = () => this.navigateTo('provinceSelect');
      }
      document.getElementById('cameraBtn').onclick = () => this.navigateTo('photoPicker');
      document.getElementById('menuCameraInput').onchange = (e) => {
        this.handleImageFile(e.target.files[0]);
        e.target.value = '';
      };
      document.getElementById('menuAlbumInput').onchange = (e) => {
        this.handleImageFile(e.target.files[0]);
        e.target.value = '';
      };
      document.getElementById('taskQueueBtn').onclick = async () => {
        await context.loadTasks();
        this.navigateTo('taskQueue');
      };
      document.getElementById('wrongbookBtn').onclick = () => this.navigateTo('wrongbook');
      document.getElementById('logoutBtn').onclick = () => {
        if (confirm('确定要退出登录吗？')) {
          context.logout();
          this.navigateTo('login');
        }
      };
    }

    // 省份选择页
    if (this.currentPage === 'provinceSelect') {
      const examLevelSelect = document.getElementById('examLevelSelect');
      const provinceList = document.getElementById('provinceList');
      const confirmBtn = document.getElementById('confirmProvinceBtn');

      // 加载省份列表
      this.loadProvincesList(examLevelSelect.value);

      examLevelSelect.onchange = () => {
        this.loadProvincesList(examLevelSelect.value);
      };

      confirmBtn.onclick = async () => {
        const selected = document.querySelector('.province-item.selected');
        if (!selected) {
          alert('请选择省份');
          return;
        }

        const provinceCode = selected.dataset.code;
        const examLevel = examLevelSelect.value;

        try {
          const token = localStorage.getItem('token');
          const res = await fetch('/api/user-province', {
            method: 'POST',
            headers: {
              'Authorization': 'Bearer ' + token,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ exam_level: examLevel, province_code: provinceCode })
          });

          if (res.ok) {
            const { data } = await res.json();
            context.user.province = data.province_code;
            context.user.exam_level = examLevel;
            alert('省份设置成功');
            this.navigateTo('menu');
          } else {
            const err = await res.json();
            alert(err.error || '设置失败');
          }
        } catch (err) {
          alert('设置失败');
        }
      };
    }

    // 拍照页
    if (this.currentPage === 'camera') {
      const cameraBox = document.getElementById('cameraBox');
      const fileInput = document.getElementById('fileInput');
      const confirmBtn = document.getElementById('confirmPhoto');

      cameraBox.onclick = () => fileInput.click();
      fileInput.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
              cameraBox.innerHTML = `<img src="${event.target.result}" alt="照片">`;
              confirmBtn.style.display = 'block';
              context.setCurrentImage(event.target.result);
            };
            img.src = event.target.result;
          };
          reader.readAsDataURL(file);
        }
      };

      confirmBtn.onclick = () => this.navigateTo('crop');
    }

    // 裁剪页
    if (this.currentPage === 'crop') {
      if (this.cropper) this.cropper.destroy();
      this.cropper = new ImageCropper('cropperContainer', context.currentImage);

      const subjects = document.querySelectorAll('.subject-item');
      subjects.forEach(item => {
        item.onclick = () => {
          subjects.forEach(s => s.classList.remove('active'));
          item.classList.add('active');
          context.setCurrentSubject(item.dataset.subject);
        };
      });

      // 从相册重新选择图片
      const cropFileInput = document.getElementById('cropFileInput');
      document.getElementById('rePickBtn').onclick = () => cropFileInput.click();
      cropFileInput.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
              context.setCurrentImage(event.target.result);
              if (this.cropper) this.cropper.destroy();
              this.cropper = new ImageCropper('cropperContainer', context.currentImage);
            };
            img.src = event.target.result;
          };
          reader.readAsDataURL(file);
        }
      };

      // 异步提交到任务队列
      document.getElementById('confirmCrop').onclick = async () => {
        if (!context.currentSubject) { alert('请选择学科'); return; }
        const croppedImage = this.cropper.getCroppedImage();
        context.setCroppedImage(croppedImage);

        const btn = document.getElementById('confirmCrop');
        btn.disabled = true;
        btn.textContent = '提交中...';

        const result = await context.submitTask(context.currentSubject, context.grade, croppedImage);
        if (result.success) {
          this.showToast('已加入解析队列');
          this.navigateTo('menu');
        } else {
          alert(result.message || '提交失败');
          btn.disabled = false;
          btn.textContent = '提交解析';
        }
      };
    }

    // 错题本页
    if (this.currentPage === 'wrongbook') {
      context.loadWrongQuestionsFromDB().then(() => {
        const subjects = context.getSubjects();
        document.querySelectorAll('.subject-category').forEach(item => {
          const subject = item.dataset.subject;
          const count = context.wrongQuestions.filter(q => q.subject === subject).length;
          const countEl = item.querySelector('.subject-count');
          if (countEl) countEl.textContent = `${count} 道错题`;
        });
      });
      document.querySelectorAll('.subject-category').forEach(item => {
        item.onclick = () => {
          this.currentSubject = item.dataset.subject;
          this.navigateTo('subjectQuestions');
        };
      });
    }

    // 学科错题列表页
    if (this.currentPage === 'subjectQuestions') {
      document.querySelectorAll('.question-item').forEach(item => {
        item.onclick = () => {
          this.currentQuestionId = item.dataset.id;
          this.navigateTo('detail');
        };
      });

      const generateBtn = document.getElementById('generateReportBtn');
      if (generateBtn) {
        generateBtn.onclick = async () => {
          generateBtn.disabled = true;
          generateBtn.textContent = 'AI 分析中...';
          try {
            await context.generateSubjectReport(this.currentSubject);
            alert('报告生成成功');
          } catch (err) {
            alert(err.message || '报告生成失败');
          }
          generateBtn.disabled = false;
          generateBtn.textContent = '生成学科报告';
        };
      }

      const viewReportsBtn = document.getElementById('viewReportsBtn');
      if (viewReportsBtn) {
        viewReportsBtn.onclick = () => this.navigateTo('reports');
      }
    }

    // 报告列表页
    if (this.currentPage === 'reports') {
      document.querySelectorAll('.report-item').forEach(item => {
        const viewBtn = item.querySelector('.view-report-btn');
        if (viewBtn) {
          viewBtn.onclick = (e) => {
            e.stopPropagation();
            this.currentReportId = viewBtn.dataset.id;
            this.navigateTo('reportDetail');
          };
        }
        const deleteBtn = item.querySelector('.delete-report-btn');
        if (deleteBtn) {
          deleteBtn.onclick = async (e) => {
            e.stopPropagation();
            if (confirm('确定要删除这份报告吗？')) {
              await context.deleteReport(deleteBtn.dataset.id);
              this.render();
            }
          };
        }
      });
    }

    // 报告详情页
    if (this.currentPage === 'reportDetail') {
      const report = context.getReport(this.currentReportId);
      if (report?.knowledgeGraph) {
        this.drawKnowledgeGraph(report.knowledgeGraph, report.nodeQuestionMap || {});
      }

      // 展开/收起解题思路
      document.querySelectorAll('.sq-expand-btn').forEach(btn => {
        btn.onclick = () => {
          const idx = btn.dataset.index;
          const panel = document.getElementById(`sqPanel${idx}`);
          if (!panel) return;
          const isOpen = panel.style.display !== 'none';
          panel.style.display = isOpen ? 'none' : 'block';
          btn.textContent = isOpen ? '查看解题思路 ▾' : '收起解题思路 ▴';
        };
      });
    }

    // 任务队列页
    if (this.currentPage === 'taskQueue') {
      document.getElementById('refreshTasksBtn').onclick = async () => {
        await context.loadTasks();
        this.render();
      };
      document.querySelectorAll('.task-item').forEach(item => {
        if (item.dataset.status === 'completed') {
          item.onclick = () => {
            this.currentTaskId = item.dataset.id;
            this.navigateTo('taskDetail');
          };
        }
      });
    }

    // 错题详情页
    if (this.currentPage === 'detail') {
      const deleteBtn = document.getElementById('deleteBtn');
      if (deleteBtn) {
        deleteBtn.onclick = async () => {
          if (confirm('确定要删除这道错题吗？')) {
            await context.deleteWrongQuestion(this.currentQuestionId);
            this.navigateTo('wrongbook');
          }
        };
      }
    }
  }

  async loadSolution() {
    try {
      const base64 = context.croppedImage.split(',')[1];
      const result = await aiService.requestSolution(base64, context.currentSubject, context.grade);

      context.addWrongQuestion(result);

      const isEssay = context.currentSubject === '作文';
      const container = document.getElementById('solutionContainer');
      container.innerHTML = `
        <div class="solution-content">
          <div class="solution-section">
            <h3>💡 ${isEssay ? '本文亮点' : '思考线索'}</h3>
            <div>${this.renderMarkdown(result.clue)}</div>
          </div>
          <div class="solution-section">
            <h3>📝 ${isEssay ? '改进之处' : '详细解答'}</h3>
            <div>${this.renderMarkdown(result.solution)}</div>
          </div>
          <div class="solution-section">
            <h3>🔍 ${isEssay ? '改进示例' : '错因分析'}</h3>
            <div>${this.renderMarkdown(result.analysis)}</div>
          </div>
          ${!isEssay ? `
          <div class="solution-section">
            <h3>📊 题目信息</h3>
            <p>难度: ${result.metadata?.difficulty || '?'}/5</p>
            <p>考频: ${result.metadata?.frequency || '?'}</p>
          </div>` : ''}
        </div>
      `;
    } catch (error) {
      const container = document.getElementById('solutionContainer');
      container.innerHTML = `<div style="text-align: center; color: red;">解析失败: ${this.sanitize(error.message)}</div>`;
    }
  }

  showToast(message, duration = 2000) {
    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.textContent = message;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    const hideTimer = setTimeout(() => {
      toast.classList.remove('show');
      const removeTimer = setTimeout(() => toast.remove(), 300);
      this._addTimer(removeTimer);
      this._clearTimer(hideTimer);
    }, duration);
    this._addTimer(hideTimer);
  }

  async loadProvincesList(examLevel) {
    const provinceList = document.getElementById('provinceList');
    if (!provinceList) return;

    provinceList.innerHTML = '<div style="text-align: center; color: #86868b; padding: 20px;">加载中...</div>';

    try {
      const res = await fetch(`/api/provinces?exam_level=${examLevel}`);
      const { data } = await res.json();

      const selectedCode = context.user?.province;

      provinceList.innerHTML = data.map(p => `
        <div class="province-item ${p.code === selectedCode ? 'selected' : ''}"
             data-code="${p.code}"
             style="padding: 12px; border: 1px solid ${p.code === selectedCode ? '#d71920' : '#e5e5ea'};
                    border-radius: 8px; margin-bottom: 8px; cursor: pointer;
                    background: ${p.code === selectedCode ? '#fff5f5' : '#fff'};
                    transition: all 0.2s;">
          <div style="font-weight: 600; font-size: 16px;">${p.name}</div>
          <div style="font-size: 12px; color: #86868b; margin-top: 4px;">${p.paper_type === 'independent' ? '自主命题' : p.paper_type === 'new_gaokao_i' ? '新高考I卷' : p.paper_type === 'new_gaokao_ii' ? '新高考II卷' : p.paper_type === 'national_a' ? '全国甲卷' : p.paper_type === 'national_b' ? '全国乙卷' : p.paper_type}</div>
        </div>
      `).join('');

      // 添加点击事件
      provinceList.querySelectorAll('.province-item').forEach(item => {
        item.onclick = () => {
          provinceList.querySelectorAll('.province-item').forEach(i => {
            i.classList.remove('selected');
            i.style.borderColor = '#e5e5ea';
            i.style.background = '#fff';
          });
          item.classList.add('selected');
          item.style.borderColor = '#d71920';
          item.style.background = '#fff5f5';
        };
      });
    } catch (err) {
      provinceList.innerHTML = '<div style="text-align: center; color: #ff3b30; padding: 20px;">加载失败</div>';
    }
  }

  handleImageFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        context.setCurrentImage(event.target.result);
        this.navigateTo('crop');
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  }

  showPhotoPickerOverlay() {
    this.closePhotoPickerOverlay();

    const overlay = document.createElement('div');
    overlay.className = 'photo-picker-overlay';
    overlay.id = 'photoPickerOverlay';
    overlay.innerHTML = `
      <div class="photo-picker-content">
        <button class="photo-picker-btn" id="overlayTakePhoto">
          <span class="photo-picker-icon">📷</span>拍照
        </button>
        <button class="photo-picker-btn" id="overlayChooseAlbum">
          <span class="photo-picker-icon">🖼️</span>从相册选择
        </button>
        <button class="photo-picker-btn photo-picker-cancel" id="overlayCancel">取消</button>
      </div>
    `;

    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('show'));

    document.getElementById('overlayTakePhoto').onclick = () => {
      this.closePhotoPickerOverlay();
      this.currentPage = 'menu';
      document.getElementById('menuCameraInput').click();
    };

    document.getElementById('overlayChooseAlbum').onclick = () => {
      this.closePhotoPickerOverlay();
      this.currentPage = 'menu';
      document.getElementById('menuAlbumInput').click();
    };

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        this.closePhotoPickerOverlay();
        this.currentPage = 'menu';
      }
    });

    document.getElementById('overlayCancel').onclick = () => {
      this.closePhotoPickerOverlay();
      this.currentPage = 'menu';
    };
  }

  closePhotoPickerOverlay() {
    const overlay = document.getElementById('photoPickerOverlay');
    if (overlay) {
      overlay.classList.remove('show');
      const removeTimer = setTimeout(() => overlay.remove(), 300);
      this._addTimer(removeTimer);
    }
  }

  navigateTo(page) {
    this.currentPage = page;
    this.render();
  }

  drawKnowledgeGraph({ nodes, edges }, nodeQuestionMap = {}) {
    const canvas = document.getElementById('knowledgeGraphCanvas');
    if (!canvas || !nodes?.length) return;

    const W = canvas.parentElement.clientWidth || 360;
    const H = Math.max(300, Math.min(W * 0.75, 400));
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    // 初始化节点位置（圆形分布）
    const pos = nodes.map((n, i) => ({
      x: W / 2 + (W * 0.35) * Math.cos((2 * Math.PI * i) / nodes.length),
      y: H / 2 + (H * 0.35) * Math.sin((2 * Math.PI * i) / nodes.length),
      vx: 0, vy: 0
    }));

    const nodeIndex = Object.fromEntries(nodes.map((n, i) => [n.id, i]));

    // 力导向模拟
    for (let iter = 0; iter < 200; iter++) {
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = pos[i].x - pos[j].x, dy = pos[i].y - pos[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = 3000 / (dist * dist);
          pos[i].vx += force * dx / dist; pos[i].vy += force * dy / dist;
          pos[j].vx -= force * dx / dist; pos[j].vy -= force * dy / dist;
        }
      }
      for (const e of edges) {
        const si = nodeIndex[e.source], ti = nodeIndex[e.target];
        if (si == null || ti == null) continue;
        const dx = pos[ti].x - pos[si].x, dy = pos[ti].y - pos[si].y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = (dist - 100) * 0.05;
        pos[si].vx += force * dx / dist; pos[si].vy += force * dy / dist;
        pos[ti].vx -= force * dx / dist; pos[ti].vy -= force * dy / dist;
      }
      for (const p of pos) {
        p.vx += (W / 2 - p.x) * 0.01;
        p.vy += (H / 2 - p.y) * 0.01;
        p.vx *= 0.85; p.vy *= 0.85;
        p.x = Math.max(40, Math.min(W - 40, p.x + p.vx));
        p.y = Math.max(30, Math.min(H - 30, p.y + p.vy));
      }
    }

    const colorMap = { weak: '#ff3b30', normal: '#ff9500', strong: '#34c759' };
    const nodeRadii = nodes.map(n => 14 + Math.min(n.weight || 1, 5) * 2);

    const draw = (selectedIdx = -1) => {
      ctx.clearRect(0, 0, W, H);

      // 画边
      ctx.strokeStyle = '#c7c7cc';
      ctx.lineWidth = 1.5;
      for (const e of edges) {
        const si = nodeIndex[e.source], ti = nodeIndex[e.target];
        if (si == null || ti == null) continue;
        ctx.beginPath();
        ctx.moveTo(pos[si].x, pos[si].y);
        ctx.lineTo(pos[ti].x, pos[ti].y);
        ctx.stroke();
      }

      // 画节点
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        const r = nodeRadii[i];
        ctx.beginPath();
        ctx.arc(pos[i].x, pos[i].y, r, 0, Math.PI * 2);
        ctx.fillStyle = colorMap[n.type] || '#0071e3';
        ctx.fill();
        ctx.strokeStyle = i === selectedIdx ? '#1d1d1f' : '#fff';
        ctx.lineWidth = i === selectedIdx ? 3 : 2;
        ctx.stroke();

        ctx.fillStyle = '#1d1d1f';
        ctx.font = `bold ${Math.min(12, r)}px -apple-system, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const label = n.label.length > 6 ? n.label.slice(0, 5) + '…' : n.label;
        ctx.fillText(label, pos[i].x, pos[i].y + r + 10);
      }

      // 图例
      const legend = [['#ff3b30', '薄弱'], ['#ff9500', '一般'], ['#34c759', '掌握']];
      legend.forEach(([color, text], i) => {
        ctx.beginPath();
        ctx.arc(16 + i * 60, H - 14, 6, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.fillStyle = '#86868b';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, 26 + i * 60, H - 14);
      });
    };

    draw();

    // 点击交互：命中节点则弹出错题回溯抽屉
    canvas.style.cursor = 'default';
    canvas.onclick = (e) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = W / rect.width;
      const scaleY = H / rect.height;
      const mx = (e.clientX - rect.left) * scaleX;
      const my = (e.clientY - rect.top) * scaleY;

      for (let i = 0; i < nodes.length; i++) {
        const dx = mx - pos[i].x, dy = my - pos[i].y;
        if (Math.sqrt(dx * dx + dy * dy) <= nodeRadii[i] + 4) {
          draw(i);
          this.showNodeReviewDrawer(nodes[i], nodeQuestionMap[nodes[i].id] || []);
          return;
        }
      }
      // 点击空白处关闭抽屉
      draw();
      this.closeNodeReviewDrawer();
    };

    canvas.onmousemove = (e) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = W / rect.width;
      const scaleY = H / rect.height;
      const mx = (e.clientX - rect.left) * scaleX;
      const my = (e.clientY - rect.top) * scaleY;
      canvas.style.cursor = nodes.some((_, i) => {
        const dx = mx - pos[i].x, dy = my - pos[i].y;
        return Math.sqrt(dx * dx + dy * dy) <= nodeRadii[i] + 4;
      }) ? 'pointer' : 'default';
    };
  }

  showNodeReviewDrawer(node, questionIds) {
    this.closeNodeReviewDrawer();

    const questions = questionIds.map(id => context.getWrongQuestion(id)).filter(Boolean);
    const colorMap = { weak: '#ff3b30', normal: '#ff9500', strong: '#34c759' };
    const typeLabel = { weak: '薄弱', normal: '一般', strong: '掌握' };

    const drawer = document.createElement('div');
    drawer.id = 'nodeReviewDrawer';
    drawer.className = 'node-review-drawer';
    drawer.innerHTML = `
      <div class="drawer-handle"></div>
      <div class="drawer-header">
        <span class="drawer-node-badge" style="background:${colorMap[node.type] || '#0071e3'}">${typeLabel[node.type] || '知识点'}</span>
        <span class="drawer-title">${this.sanitize(node.label)}</span>
        <button class="drawer-close" id="drawerCloseBtn">✕</button>
      </div>
      <div class="drawer-body">
        ${questions.length === 0
          ? '<p class="drawer-empty">暂无关联错题</p>'
          : questions.map(q => `
            <div class="drawer-question-item" data-id="${q._id}">
              <img src="${q.croppedImage}" alt="题目" class="drawer-question-img">
              <div class="drawer-question-meta">
                <span>难度 ${q.metadata?.difficulty || '?'}/5</span>
                <span>${new Date(q.timestamp).toLocaleDateString()}</span>
              </div>
            </div>
          `).join('')}
      </div>
    `;

    document.getElementById('app').appendChild(drawer);
    requestAnimationFrame(() => drawer.classList.add('open'));

    document.getElementById('drawerCloseBtn').onclick = () => this.closeNodeReviewDrawer();

    drawer.querySelectorAll('.drawer-question-item').forEach(item => {
      item.onclick = () => {
        this.currentQuestionId = item.dataset.id;
        this.closeNodeReviewDrawer();
        this.navigateTo('detail');
      };
    });
  }

  closeNodeReviewDrawer() {
    const existing = document.getElementById('nodeReviewDrawer');
    if (existing) existing.remove();
  }

  // ========== 访问计数器 ==========

  async loadVisitCounter() {
    try {
      let fingerprint = sessionStorage.getItem('visit_fingerprint');
      if (!fingerprint) {
        fingerprint = crypto.randomUUID
          ? crypto.randomUUID()
          : Math.random().toString(36).slice(2);
        sessionStorage.setItem('visit_fingerprint', fingerprint);
      }

      let data;
      try {
        const res = await fetch('/api/stats/visits/increment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fingerprint }),
        });
        data = await res.json();
      } catch {
        const res = await fetch('/api/stats/visits');
        data = await res.json();
      }

      if (data && data.total_visits) {
        const formatted = Number(data.total_visits).toLocaleString('en-US');
        const text = `累计服务 ${formatted} 次`;
        const el = document.getElementById('loginVisitCounter');
        if (el) el.textContent = text;
        const menuEl = document.getElementById('menuVisitCounter');
        if (menuEl) menuEl.textContent = text;
      }
    } catch {
      // 静默失败
    }
  }
}

new App();
