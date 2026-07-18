import { createSuccessResponse, createPaginatedResponse, createErrorResponse, ErrorCode } from './errorCodes.js';

const successResponse = (data, message = '操作成功') => {
  return createSuccessResponse(data, message);
};

const errorResponse = (message, status = 'error') => {
  return {
    success: false,
    message,
    status
  };
};

const paginatedResponse = (data, total, page, limit) => {
  return createPaginatedResponse(data, total, page, limit);
};

const createdResponse = (data, message = '创建成功') => {
  return createSuccessResponse(data, message);
};

const deletedResponse = (message = '删除成功') => {
  return createSuccessResponse(null, message);
};

const apiErrorResponse = (errorCode, details = null) => {
  return createErrorResponse(errorCode, details);
};

const successJson = (res, data, message = '操作成功', meta = null) => {
  const response = createSuccessResponse(data, message, meta);
  res.json(response);
};

const errorJson = (res, errorCode, details = null) => {
  const response = createErrorResponse(errorCode, details);
  const info = {
    [ErrorCode.AUTH_INVALID_TOKEN]: 401,
    [ErrorCode.AUTH_TOKEN_EXPIRED]: 401,
    [ErrorCode.AUTH_NOT_LOGIN]: 401,
    [ErrorCode.AUTH_PERMISSION_DENIED]: 403,
    [ErrorCode.AUTH_INVALID_CREDENTIALS]: 400,
    [ErrorCode.AUTH_EMAIL_ALREADY_EXISTS]: 400,
    [ErrorCode.AUTH_PASSWORD_INCORRECT]: 400,
    [ErrorCode.VALIDATION_ERROR]: 400,
    [ErrorCode.VALIDATION_REQUIRED_FIELD]: 400,
    [ErrorCode.VALIDATION_INVALID_FORMAT]: 400,
    [ErrorCode.VALIDATION_OUT_OF_RANGE]: 400,
    [ErrorCode.VALIDATION_INVALID_ENUM]: 400,
    [ErrorCode.USER_NOT_FOUND]: 404,
    [ErrorCode.USER_PROFILE_NOT_SET]: 400,
    [ErrorCode.QUESTION_NOT_FOUND]: 404,
    [ErrorCode.QUESTION_ANSWER_REQUIRED]: 400,
    [ErrorCode.PAPER_NOT_FOUND]: 404,
    [ErrorCode.PAPER_NO_QUESTIONS]: 400,
    [ErrorCode.WRONG_QUESTION_NOT_FOUND]: 404,
    [ErrorCode.KNOWLEDGE_POINT_NOT_FOUND]: 404,
    [ErrorCode.EXAM_SESSION_NOT_FOUND]: 404,
    [ErrorCode.EXAM_SESSION_ALREADY_COMPLETED]: 400,
    [ErrorCode.EXAM_SESSION_TIME_OUT]: 400,
    [ErrorCode.EXAM_SESSION_CUT_SCREEN]: 400,
    [ErrorCode.PROVINCE_NOT_FOUND]: 404,
    [ErrorCode.SUBJECT_NOT_FOUND]: 404,
    [ErrorCode.REPORT_NOT_FOUND]: 404,
    [ErrorCode.DATABASE_ERROR]: 500,
    [ErrorCode.DATABASE_CONNECTION_FAILED]: 500,
    [ErrorCode.SERVICE_UNAVAILABLE]: 503,
    [ErrorCode.SERVICE_RATE_LIMITED]: 429,
    [ErrorCode.SERVICE_TIMEOUT]: 504,
    [ErrorCode.INTERNAL_ERROR]: 500
  };
  const statusCode = info[errorCode] || 500;
  res.status(statusCode).json(response);
};

const paginatedJson = (res, data, total, page, limit) => {
  const response = createPaginatedResponse(data, total, page, limit);
  res.json(response);
};

export function validateResponseFormat(body) {
  if (!body || typeof body !== 'object') return false;
  if (typeof body.success !== 'boolean') return false;
  if (body.success === true) {
    return body.hasOwnProperty('data') || body.hasOwnProperty('pagination');
  }
  if (body.success === false) {
    return typeof body.message === 'string';
  }
  return false;
}

export {
  successResponse,
  errorResponse,
  paginatedResponse,
  createdResponse,
  deletedResponse,
  apiErrorResponse,
  successJson,
  errorJson,
  paginatedJson
};