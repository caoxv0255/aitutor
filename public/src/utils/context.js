import { aiService } from '../services/aiService.js';

/**
 * 学科配置
 */
export const SUBJECTS = {
  '小学': ['语文', '作文', '数学', '英语'],
  '初中': ['语文', '作文', '数学', '英语', '政治', '历史', '地理', '生物', '化学', '物理'],
  '高中': ['语文', '作文', '数学', '英语', '政治', '历史', '地理', '生物', '化学', '物理']
};

/**
 * 用户上下文管理
 *
 * API 契约 (D062 envelope, 2026-08-23 统一):
 *   成功响应: { success: true, message?: string, data: ... }
 *   失败响应: { success: false, message: string, errorCode?: string }
 *
 * 本类内部用 unwrap() 把 envelope 解包成业务数据, 字段访问保持原样.
 * 旧 compat 层 (api/legacy-compat.js) 的 unwrapEnvelope 已删除, 前端需自行解包.
 */
class Context {
  constructor() {
    this.user = null;
    this.grade = null;
    this.authToken = null;
    this.currentImage = null;
    this.croppedImage = null;
    this.currentSubject = null;
    this.wrongQuestions = [];
    this.reports = [];
    this.tasks = [];
    this.restoreSession();
  }

  // ========== envelope 解包工具 ==========

  /**
   * 把后端 envelope 解包成 data; 失败响应抛出带 message 的 Error
   */
  async parseJson(response) {
    let body;
    try { body = await response.json(); } catch (_) { body = null; }
    if (response.ok && body && body.success === true) return body.data;
    const msg = (body && body.message) || `HTTP ${response.status}`;
    const err = new Error(msg);
    err.status = response.status;
    err.body = body;
    throw err;
  }

  // ========== 认证相关 ==========

  isLoggedIn() {
    return !!(this.authToken && this.user);
  }

  authHeaders() {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.authToken}`
    };
  }

  saveAuth(token, email, grade) {
    this.authToken = token;
    this.user = { email };
    this.grade = grade;
    // D072 (2026-08-24): 双写 key, 兼容 F3 (aitutor.token) + 老 PWA (authToken)
    localStorage.setItem('aitutor.token', token);
    localStorage.setItem('authToken', token);
    localStorage.setItem('currentUser', email);
    localStorage.setItem('currentGrade', grade);
    // aitutor.user (F3 格式) 也存一份, 跨端共享
    if (email) localStorage.setItem('aitutor.user', JSON.stringify({ email, grade }));
  }

  logout() {
    this.authToken = null;
    this.user = null;
    this.grade = null;
    this.currentImage = null;
    this.croppedImage = null;
    this.currentSubject = null;
    this.wrongQuestions = [];
    this.reports = [];
    this.tasks = [];
    localStorage.removeItem('authToken');
    localStorage.removeItem('aitutor.token');
    localStorage.removeItem('currentUser');
    localStorage.removeItem('aitutor.user');
    localStorage.removeItem('currentGrade');
  }

  restoreSession() {
    // D072 (2026-08-24): 优先用 F3 统一 key (aitutor.token), 兜底老 PWA key
    const token = localStorage.getItem('aitutor.token') || localStorage.getItem('authToken');
    let email = localStorage.getItem('currentUser');
    let grade = localStorage.getItem('currentGrade');
    if (!email) {
      // 从 aitutor.user 反向解析 (跨端登录)
      try {
        const userStr = localStorage.getItem('aitutor.user');
        if (userStr) {
          const u = JSON.parse(userStr);
          email = u.email;
          grade = u.grade || grade;
        }
      } catch (_) {}
    }
    if (token && email) {
      this.authToken = token;
      this.user = { email };
      this.grade = grade;
    }
  }

  // ========== 登录/注册/重置密码 ==========

  async login(email, password) {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await this.parseJson(response); // {token, user}
      this.saveAuth(data.token, email, data.user.grade);
      await this.loadWrongQuestionsFromDB();
      await this.loadReportsFromDB();
      return { success: true };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async guestLogin() {
    try {
      const response = await fetch('/api/auth/guest-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await this.parseJson(response); // {token, user}
      this.saveAuth(data.token, data.user.email, data.user.grade);
      await this.loadWrongQuestionsFromDB();
      await this.loadReportsFromDB();
      return { success: true };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async register(email, password, grade) {
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, grade })
      });
      const data = await this.parseJson(response); // {token, user}
      this.saveAuth(data.token, email, grade);
      return { success: true };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async resetPassword(email, newPassword) {
    try {
      // 后端无 reset-password 接口 (compat 已 410 Gone). 调用前应提示用户.
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, newPassword })
      });
      await this.parseJson(response);
      return { success: true };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  // ========== 学科 ==========

  getSubjects() { return SUBJECTS[this.grade] || []; }
  setCurrentImage(imageBase64) { this.currentImage = imageBase64; }
  setCroppedImage(imageBase64) { this.croppedImage = imageBase64; }
  setCurrentSubject(subject) { this.currentSubject = subject; }

  // ========== 错题管理 ==========

  getWrongQuestion(id) {
    return this.wrongQuestions.find(q => q._id === id);
  }

  async addWrongQuestion(question) {
    const newQuestion = {
      croppedImage: this.croppedImage,
      subject: this.currentSubject,
      ...question
    };
    try {
      const response = await fetch('/api/user/wrong-questions', {
        method: 'POST',
        headers: this.authHeaders(),
        body: JSON.stringify(newQuestion)
      });
      if (response.ok) {
        await this.loadWrongQuestionsFromDB();
      } else {
        console.error('保存错题失败:', response.status);
      }
    } catch (error) {
      console.error('保存错题失败:', error);
    }
  }

  async loadWrongQuestionsFromDB() {
    if (!this.isLoggedIn()) return;
    try {
      const response = await fetch('/api/user/wrong-questions?limit=100', { headers: this.authHeaders() });
      if (response.ok) {
        const data = await this.parseJson(response); // {questions, total, ...} 或直接数组
        this.wrongQuestions = Array.isArray(data) ? data : (data.questions || []);
      } else if (response.status === 401) {
        this.logout();
      }
    } catch (error) {
      console.error('加载错题失败:', error);
    }
  }

  async deleteWrongQuestion(id) {
    try {
      const response = await fetch(`/api/user/wrong-questions/${id}`, {
        method: 'DELETE',
        headers: this.authHeaders()
      });
      if (response.ok) {
        await this.loadWrongQuestionsFromDB();
      }
    } catch (error) {
      console.error('删除错题失败:', error);
    }
  }

  // ========== 报告管理 ==========

  getSubjectReports(subject) { return this.reports.filter(r => r.subject === subject); }
  getReport(id) { return this.reports.find(r => r._id === id); }

  // ========== 任务队列 (已退役, /api/tasks 410 Gone) ==========
  // 后端无独立 tasks 模块, OCR 走 /api/user/wrong-questions + 后台 task_worker.
  // 旧前端 submitTask/loadTasks/deleteTask 保留为空 stub 以防 app.js 调用崩溃.

  async submitTask(subject, grade, imageData) {
    console.warn('[deprecated] /api/tasks 已退役, 请改用 /api/user/wrong-questions 异步上传');
    return { success: false, message: '旧任务队列接口已废弃, 请刷新页面' };
  }

  async loadTasks() {
    if (!this.isLoggedIn()) return;
    // 后端 410 Gone, 不拉取
    this.tasks = [];
  }

  async deleteTask(id) {
    console.warn('[deprecated] /api/tasks 已退役');
  }

  getTask(id) { return null; }

  // ========== AI 生成报告 ==========

  async generateSubjectReport(subject) {
    const questions = this.wrongQuestions.filter(q => q.subject === subject);
    if (questions.length === 0) {
      throw new Error('该学科暂无错题，无法生成报告');
    }

    const summaries = questions.map(q => ({
      id: q._id,
      keywords: q.metadata?.keywords || [],
      difficulty: q.metadata?.difficulty || 3,
      frequency: q.metadata?.frequency || '中',
      solution: q.solution || '',
      analysis: q.analysis || '',
      clue: q.clue || ''
    }));

    const aiResult = await aiService.generateReport(subject, this.grade, summaries);
    const weakPoints = aiResult.weakPoints || [];
    const existingKeywords = summaries.flatMap(s => s.keywords);
    let similarQuestions = [];
    try {
      similarQuestions = await aiService.generateSimilarQuestions(subject, this.grade, weakPoints, existingKeywords, summaries);
    } catch (error) {
      console.error('类题生成失败，weakPoints:', weakPoints, error);
    }
    if (!similarQuestions || similarQuestions.length === 0) {
      similarQuestions = [];
      console.warn('AI未能生成类题——跳过类题，不进行兜底');
    }

    const nodeQuestionMap = {};
    if (aiResult.knowledgeGraph?.nodes) {
      for (const node of aiResult.knowledgeGraph.nodes) {
        nodeQuestionMap[node.id] = summaries
          .filter(s => s.keywords.some(kw => node.label.includes(kw) || kw.includes(node.label)))
          .map(s => s.id);
      }
    }

    const timestamp = new Date();
    const report = {
      subject,
      title: `${timestamp.toLocaleDateString().replace(/\//g, '-')} ${subject}学科报告`,
      questionCount: questions.length,
      summary: aiResult.summary || '',
      weakPoints,
      suggestions: aiResult.suggestions || '',
      encouragement: aiResult.encouragement || '',
      knowledgeGraph: aiResult.knowledgeGraph || null,
      nodeQuestionMap,
      similarQuestions,
      timestamp
    };

    try {
      const response = await fetch('/api/user/wrong-questions/generate-report', {
        method: 'POST',
        headers: this.authHeaders(),
        body: JSON.stringify(report)
      });
      if (response.ok) {
        await this.loadReportsFromDB();
      } else {
        console.error('生成报告失败:', response.status);
      }
    } catch (error) {
      console.error('生成报告失败:', error);
    }
  }

  async loadReportsFromDB() {
    if (!this.isLoggedIn()) return;
    try {
      const response = await fetch('/api/review/reports?limit=100', { headers: this.authHeaders() });
      if (response.ok) {
        const data = await this.parseJson(response); // {reports, ...} 或数组
        this.reports = Array.isArray(data) ? data : (data.reports || data || []);
      }
    } catch (error) {
      console.error('加载报告失败:', error);
    }
  }

  async deleteReport(id) {
    try {
      const response = await fetch(`/api/review/reports/${id}`, {
        method: 'DELETE',
        headers: this.authHeaders()
      });
      if (response.ok) {
        await this.loadReportsFromDB();
      }
    } catch (error) {
      console.error('删除报告失败:', error);
    }
  }
}

export const context = new Context();