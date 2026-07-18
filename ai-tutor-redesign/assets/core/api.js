export const ErrorCode = {
  SUCCESS: 'SUCCESS',
  
  AUTH_INVALID_TOKEN: 'AUTH_INVALID_TOKEN',
  AUTH_TOKEN_EXPIRED: 'AUTH_TOKEN_EXPIRED',
  AUTH_NOT_LOGIN: 'AUTH_NOT_LOGIN',
  AUTH_PERMISSION_DENIED: 'AUTH_PERMISSION_DENIED',
  AUTH_INVALID_CREDENTIALS: 'AUTH_INVALID_CREDENTIALS',
  AUTH_EMAIL_ALREADY_EXISTS: 'AUTH_EMAIL_ALREADY_EXISTS',
  AUTH_PASSWORD_INCORRECT: 'AUTH_PASSWORD_INCORRECT',
  
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  VALIDATION_REQUIRED_FIELD: 'VALIDATION_REQUIRED_FIELD',
  VALIDATION_INVALID_FORMAT: 'VALIDATION_INVALID_FORMAT',
  VALIDATION_OUT_OF_RANGE: 'VALIDATION_OUT_OF_RANGE',
  VALIDATION_INVALID_ENUM: 'VALIDATION_INVALID_ENUM',
  
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  USER_PROFILE_NOT_SET: 'USER_PROFILE_NOT_SET',
  
  QUESTION_NOT_FOUND: 'QUESTION_NOT_FOUND',
  QUESTION_ANSWER_REQUIRED: 'QUESTION_ANSWER_REQUIRED',
  
  PAPER_NOT_FOUND: 'PAPER_NOT_FOUND',
  PAPER_NO_QUESTIONS: 'PAPER_NO_QUESTIONS',
  
  WRONG_QUESTION_NOT_FOUND: 'WRONG_QUESTION_NOT_FOUND',
  
  KNOWLEDGE_POINT_NOT_FOUND: 'KNOWLEDGE_POINT_NOT_FOUND',
  
  EXAM_SESSION_NOT_FOUND: 'EXAM_SESSION_NOT_FOUND',
  EXAM_SESSION_ALREADY_COMPLETED: 'EXAM_SESSION_ALREADY_COMPLETED',
  EXAM_SESSION_TIME_OUT: 'EXAM_SESSION_TIME_OUT',
  EXAM_SESSION_CUT_SCREEN: 'EXAM_SESSION_CUT_SCREEN',
  
  PROVINCE_NOT_FOUND: 'PROVINCE_NOT_FOUND',
  
  SUBJECT_NOT_FOUND: 'SUBJECT_NOT_FOUND',
  
  REPORT_NOT_FOUND: 'REPORT_NOT_FOUND',
  
  DATABASE_ERROR: 'DATABASE_ERROR',
  DATABASE_CONNECTION_FAILED: 'DATABASE_CONNECTION_FAILED',
  
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  SERVICE_RATE_LIMITED: 'SERVICE_RATE_LIMITED',
  SERVICE_TIMEOUT: 'SERVICE_TIMEOUT',
  
  INTERNAL_ERROR: 'INTERNAL_ERROR'
};

export const ErrorType = {
  AUTH: 'AUTH',
  VALIDATION: 'VALIDATION',
  BUSINESS: 'BUSINESS',
  SYSTEM: 'SYSTEM'
};

export class ApiClient {
  constructor(baseURL = '') {
    this.baseURL = baseURL;
  }

  async request(path, options = {}) {
    const token = this.getToken();
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...options.headers
    };

    const response = await fetch(this.baseURL + path, {
      ...options,
      headers,
      credentials: 'same-origin'
    });

    return response;
  }

  async get(path, params = {}) {
    const query = new URLSearchParams(params).toString();
    const url = query ? `${path}?${query}` : path;
    const response = await this.request(url);
    return this._parseResponse(response);
  }

  async post(path, body = {}) {
    const response = await this.request(path, {
      method: 'POST',
      body: JSON.stringify(body)
    });
    return this._parseResponse(response);
  }

  async put(path, body = {}) {
    const response = await this.request(path, {
      method: 'PUT',
      body: JSON.stringify(body)
    });
    return this._parseResponse(response);
  }

  async delete(path) {
    const response = await this.request(path, { method: 'DELETE' });
    return this._parseResponse(response);
  }

  async upload(path, formData) {
    const token = this.getToken();
    const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
    
    const response = await fetch(this.baseURL + path, {
      method: 'POST',
      headers,
      body: formData,
      credentials: 'same-origin'
    });

    return this._parseResponse(response);
  }

  async _parseResponse(response) {
    let data;
    try {
      data = await response.json();
    } catch {
      data = { success: false, message: '响应格式错误', errorCode: ErrorCode.INTERNAL_ERROR };
    }

    if (!data) {
      return { success: false, message: '响应为空', errorCode: ErrorCode.INTERNAL_ERROR };
    }

    if (response.status === 401) {
      this.clearAuth();
      if (typeof window !== 'undefined') {
        window.location.href = '/login?redirect=' + encodeURIComponent(window.location.pathname);
      }
    }

    return data;
  }

  async safeGet(path, params = {}) {
    try {
      const result = await this.get(path, params);
      return this._handleResult(result);
    } catch (error) {
      return this._handleError(error);
    }
  }

  async safePost(path, body = {}) {
    try {
      const result = await this.post(path, body);
      return this._handleResult(result);
    } catch (error) {
      return this._handleError(error);
    }
  }

  async safePut(path, body = {}) {
    try {
      const result = await this.put(path, body);
      return this._handleResult(result);
    } catch (error) {
      return this._handleError(error);
    }
  }

  async safeDelete(path) {
    try {
      const result = await this.delete(path);
      return this._handleResult(result);
    } catch (error) {
      return this._handleError(error);
    }
  }

  _handleResult(result) {
    if (result.success) {
      return {
        success: true,
        data: result.data,
        message: result.message,
        pagination: result.pagination,
        meta: result.meta
      };
    }
    
    return {
      success: false,
      message: result.message,
      errorCode: result.errorCode,
      errorType: result.errorType,
      details: result.details
    };
  }

  _handleError(error) {
    return {
      success: false,
      message: error.message || '网络请求失败',
      errorCode: ErrorCode.INTERNAL_ERROR,
      errorType: ErrorType.SYSTEM,
      details: error
    };
  }

  getToken() {
    try {
      const loginData = localStorage.getItem('aitutor_login');
      if (loginData) {
        const parsed = JSON.parse(loginData);
        if (parsed.expiresAt && parsed.expiresAt > Date.now()) {
          return parsed.id;
        }
      }
    } catch (e) {}
    return null;
  }

  clearAuth() {
    localStorage.removeItem('aitutor_login');
    localStorage.removeItem('aitutor_remember');
  }

  isAuthenticated() {
    return !!this.getToken();
  }

  getUser() {
    try {
      const loginData = localStorage.getItem('aitutor_login');
      if (loginData) {
        const parsed = JSON.parse(loginData);
        if (parsed.expiresAt && parsed.expiresAt > Date.now()) {
          return parsed;
        }
      }
    } catch (e) {}
    return null;
  }

  saveAuth(token, expiresAt, userInfo = {}) {
    const authData = {
      id: token,
      expiresAt,
      ...userInfo
    };
    localStorage.setItem('aitutor_login', JSON.stringify(authData));
  }
}

export const api = new ApiClient('/api');