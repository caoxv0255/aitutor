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
    localStorage.setItem('authToken', token);
    localStorage.setItem('currentUser', email);
    localStorage.setItem('currentGrade', grade);
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
    localStorage.removeItem('currentUser');
    localStorage.removeItem('currentGrade');
  }

  restoreSession() {
    const token = localStorage.getItem('authToken');
    const email = localStorage.getItem('currentUser');
    const grade = localStorage.getItem('currentGrade');
    if (token && email && grade) {
      this.authToken = token;
      this.user = { email };
      this.grade = grade;
    }
  }

  // ========== 登录/注册/重置密码 ==========

  async login(email, password) {
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await response.json();
      if (response.ok) {
        this.saveAuth(data.token, email, data.user.grade);
        await this.loadWrongQuestionsFromDB();
        await this.loadReportsFromDB();
        await this.loadTasks();
        return { success: true };
      } else {
        return { success: false, message: data.error };
      }
    } catch (error) {
      return { success: false, message: '网络错误，请检查连接' };
    }
  }

  async guestLogin() {
    try {
      const response = await fetch('/api/guest-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      if (response.ok) {
        this.saveAuth(data.token, data.user.email, data.user.grade);
        await this.loadWrongQuestionsFromDB();
        await this.loadReportsFromDB();
        await this.loadTasks();
        return { success: true };
      } else {
        return { success: false, message: data.error };
      }
    } catch (error) {
      return { success: false, message: '网络错误，请检查连接' };
    }
  }

  async register(email, password, grade) {
    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, grade })
      });
      const data = await response.json();
      if (response.ok) {
        this.saveAuth(data.token, email, grade);
        return { success: true };
      } else {
        return { success: false, message: data.error };
      }
    } catch (error) {
      return { success: false, message: '网络错误，请检查连接' };
    }
  }

  async resetPassword(email, newPassword) {
    try {
      const response = await fetch('/api/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, newPassword })
      });
      const data = await response.json();
      if (response.ok) {
        return { success: true };
      } else {
        return { success: false, message: data.error };
      }
    } catch (error) {
      return { success: false, message: '重置失败，请检查网络' };
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
      const response = await fetch('/api/questions', {
        method: 'POST',
        headers: this.authHeaders(),
        body: JSON.stringify(newQuestion)
      });
      if (response.ok) {
        await this.loadWrongQuestionsFromDB();
      }
    } catch (error) {
      console.error('保存错题失败:', error);
    }
  }

  async loadWrongQuestionsFromDB() {
    if (!this.isLoggedIn()) return;
    try {
      const response = await fetch('/api/questions', { headers: this.authHeaders() });
      if (response.ok) {
        this.wrongQuestions = await response.json();
      } else if (response.status === 401) {
        this.logout();
      }
    } catch (error) {
      console.error('加载错题失败:', error);
    }
  }

  async deleteWrongQuestion(id) {
    try {
      const response = await fetch('/api/questions', {
        method: 'DELETE',
        headers: this.authHeaders(),
        body: JSON.stringify({ id })
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

  // ========== 任务队列 ==========

  async submitTask(subject, grade, imageData) {
    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: this.authHeaders(),
        body: JSON.stringify({ subject, grade, imageData })
      });
      if (response.ok) {
        const data = await response.json();
        return { success: true, id: data.id };
      }
      return { success: false, message: '提交失败' };
    } catch (error) {
      return { success: false, message: '网络错误' };
    }
  }

  async loadTasks() {
    if (!this.isLoggedIn()) return;
    try {
      const response = await fetch('/api/tasks', { headers: this.authHeaders() });
      if (response.ok) {
        this.tasks = await response.json();
      }
    } catch (error) {
      console.error('加载任务失败:', error);
    }
  }

  async deleteTask(id) {
    try {
      const response = await fetch('/api/tasks', {
        method: 'DELETE',
        headers: this.authHeaders(),
        body: JSON.stringify({ id })
      });
      if (response.ok) {
        await this.loadTasks();
      }
    } catch (error) {
      console.error('删除任务失败:', error);
    }
  }

  getTask(id) { return this.tasks.find(t => t._id === id); }

  async generateSubjectReport(subject) {
    const questions = this.wrongQuestions.filter(q => q.subject === subject);
    if (questions.length === 0) {
      throw new Error('该学科暂无错题，无法生成报告');
    }

    // 收集错题元数据和AI解析内容用于类题推荐
    const summaries = questions.map(q => ({
      id: q._id,
      keywords: q.metadata?.keywords || [],
      difficulty: q.metadata?.difficulty || 3,
      frequency: q.metadata?.frequency || '中',
      solution: q.solution || '',
      analysis: q.analysis || '',
      clue: q.clue || ''
    }));

    // 先生成报告，再用薄弱知识点生成类题
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

    // 构建节点 → 错题映射（节点 label 与错题 keywords 模糊匹配）
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
      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: this.authHeaders(),
        body: JSON.stringify(report)
      });
      if (response.ok) {
        await this.loadReportsFromDB();
      }
    } catch (error) {
      console.error('生成报告失败:', error);
    }
  }

  async loadReportsFromDB() {
    if (!this.isLoggedIn()) return;
    try {
      const response = await fetch('/api/reports', { headers: this.authHeaders() });
      if (response.ok) {
        this.reports = await response.json();
      }
    } catch (error) {
      console.error('加载报告失败:', error);
    }
  }

  async deleteReport(id) {
    try {
      const response = await fetch('/api/reports', {
        method: 'DELETE',
        headers: this.authHeaders(),
        body: JSON.stringify({ id })
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
