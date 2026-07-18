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

export const ErrorMap = {
  [ErrorCode.SUCCESS]: { message: '操作成功', type: ErrorType.BUSINESS, statusCode: 200 },
  
  [ErrorCode.AUTH_INVALID_TOKEN]: { message: '无效的认证令牌', type: ErrorType.AUTH, statusCode: 401 },
  [ErrorCode.AUTH_TOKEN_EXPIRED]: { message: '认证令牌已过期', type: ErrorType.AUTH, statusCode: 401 },
  [ErrorCode.AUTH_NOT_LOGIN]: { message: '请先登录', type: ErrorType.AUTH, statusCode: 401 },
  [ErrorCode.AUTH_PERMISSION_DENIED]: { message: '权限不足', type: ErrorType.AUTH, statusCode: 403 },
  [ErrorCode.AUTH_INVALID_CREDENTIALS]: { message: '登录凭据无效', type: ErrorType.AUTH, statusCode: 400 },
  [ErrorCode.AUTH_EMAIL_ALREADY_EXISTS]: { message: '邮箱已被注册', type: ErrorType.AUTH, statusCode: 400 },
  [ErrorCode.AUTH_PASSWORD_INCORRECT]: { message: '密码不正确', type: ErrorType.AUTH, statusCode: 400 },
  
  [ErrorCode.VALIDATION_ERROR]: { message: '数据验证失败', type: ErrorType.VALIDATION, statusCode: 400 },
  [ErrorCode.VALIDATION_REQUIRED_FIELD]: { message: '缺少必填字段', type: ErrorType.VALIDATION, statusCode: 400 },
  [ErrorCode.VALIDATION_INVALID_FORMAT]: { message: '数据格式不正确', type: ErrorType.VALIDATION, statusCode: 400 },
  [ErrorCode.VALIDATION_OUT_OF_RANGE]: { message: '数据超出有效范围', type: ErrorType.VALIDATION, statusCode: 400 },
  [ErrorCode.VALIDATION_INVALID_ENUM]: { message: '无效的枚举值', type: ErrorType.VALIDATION, statusCode: 400 },
  
  [ErrorCode.USER_NOT_FOUND]: { message: '用户不存在', type: ErrorType.BUSINESS, statusCode: 404 },
  [ErrorCode.USER_PROFILE_NOT_SET]: { message: '用户资料未设置', type: ErrorType.BUSINESS, statusCode: 400 },
  
  [ErrorCode.QUESTION_NOT_FOUND]: { message: '题目不存在', type: ErrorType.BUSINESS, statusCode: 404 },
  [ErrorCode.QUESTION_ANSWER_REQUIRED]: { message: '题目答案不能为空', type: ErrorType.BUSINESS, statusCode: 400 },
  
  [ErrorCode.PAPER_NOT_FOUND]: { message: '试卷不存在', type: ErrorType.BUSINESS, statusCode: 404 },
  [ErrorCode.PAPER_NO_QUESTIONS]: { message: '试卷中没有题目', type: ErrorType.BUSINESS, statusCode: 400 },
  
  [ErrorCode.WRONG_QUESTION_NOT_FOUND]: { message: '错题记录不存在', type: ErrorType.BUSINESS, statusCode: 404 },
  
  [ErrorCode.KNOWLEDGE_POINT_NOT_FOUND]: { message: '知识点不存在', type: ErrorType.BUSINESS, statusCode: 404 },
  
  [ErrorCode.EXAM_SESSION_NOT_FOUND]: { message: '考试会话不存在', type: ErrorType.BUSINESS, statusCode: 404 },
  [ErrorCode.EXAM_SESSION_ALREADY_COMPLETED]: { message: '考试已完成', type: ErrorType.BUSINESS, statusCode: 400 },
  [ErrorCode.EXAM_SESSION_TIME_OUT]: { message: '考试时间已结束', type: ErrorType.BUSINESS, statusCode: 400 },
  [ErrorCode.EXAM_SESSION_CUT_SCREEN]: { message: '检测到切屏行为', type: ErrorType.BUSINESS, statusCode: 400 },
  
  [ErrorCode.PROVINCE_NOT_FOUND]: { message: '省份不存在', type: ErrorType.BUSINESS, statusCode: 404 },
  
  [ErrorCode.SUBJECT_NOT_FOUND]: { message: '学科不存在', type: ErrorType.BUSINESS, statusCode: 404 },
  
  [ErrorCode.REPORT_NOT_FOUND]: { message: '报告不存在', type: ErrorType.BUSINESS, statusCode: 404 },
  
  [ErrorCode.DATABASE_ERROR]: { message: '数据库操作失败', type: ErrorType.SYSTEM, statusCode: 500 },
  [ErrorCode.DATABASE_CONNECTION_FAILED]: { message: '数据库连接失败', type: ErrorType.SYSTEM, statusCode: 500 },
  
  [ErrorCode.SERVICE_UNAVAILABLE]: { message: '服务暂时不可用', type: ErrorType.SYSTEM, statusCode: 503 },
  [ErrorCode.SERVICE_RATE_LIMITED]: { message: '请求过于频繁，请稍后再试', type: ErrorType.SYSTEM, statusCode: 429 },
  [ErrorCode.SERVICE_TIMEOUT]: { message: '请求超时', type: ErrorType.SYSTEM, statusCode: 504 },
  
  [ErrorCode.INTERNAL_ERROR]: { message: '服务器内部错误', type: ErrorType.SYSTEM, statusCode: 500 }
};

export function getErrorInfo(errorCode) {
  return ErrorMap[errorCode] || {
    message: '未知错误',
    type: ErrorType.SYSTEM,
    statusCode: 500
  };
}

export function createErrorResponse(errorCode, details = null) {
  const info = getErrorInfo(errorCode);
  return {
    success: false,
    message: info.message,
    errorCode,
    errorType: info.type,
    details,
    timestamp: Date.now()
  };
}

export function createSuccessResponse(data, message = '操作成功', meta = null) {
  const response = {
    success: true,
    message,
    data
  };
  if (meta) {
    response.meta = meta;
  }
  return response;
}

export function createPaginatedResponse(data, total, page, limit) {
  const totalPages = Math.ceil(total / limit);
  return {
    success: true,
    message: '操作成功',
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1
    }
  };
}