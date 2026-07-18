import { createErrorResponse, ErrorCode, ErrorType } from '../utils/errorCodes.js';

class AppError extends Error {
  constructor(message, statusCode, errorCode = null, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.errorType = `${statusCode}`.startsWith('4') ? ErrorType.VALIDATION : ErrorType.SYSTEM;
    this.details = details;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message, details = null) {
    super(message, 400, ErrorCode.VALIDATION_ERROR, details);
    this.errorType = ErrorType.VALIDATION;
  }
}

class AuthError extends AppError {
  constructor(message, errorCode = ErrorCode.AUTH_NOT_LOGIN) {
    super(message, 401, errorCode);
    this.errorType = ErrorType.AUTH;
  }
}

class PermissionError extends AppError {
  constructor(message) {
    super(message, 403, ErrorCode.AUTH_PERMISSION_DENIED);
    this.errorType = ErrorType.AUTH;
  }
}

class NotFoundError extends AppError {
  constructor(message, errorCode = ErrorCode.INTERNAL_ERROR) {
    super(message, 404, errorCode);
    this.errorType = ErrorType.BUSINESS;
  }
}

class BusinessError extends AppError {
  constructor(message, errorCode = null, details = null) {
    super(message, 400, errorCode, details);
    this.errorType = ErrorType.BUSINESS;
  }
}

const errorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  let error = { ...err };
  error.message = err.message;
  error.errorCode = err.errorCode;
  error.errorType = err.errorType;
  error.details = err.details;

  if (error.name === 'JsonWebTokenError') {
    error = handleJWTError();
  }

  if (error.name === 'TokenExpiredError') {
    error = handleJWTExpiredError();
  }

  if (error.code === 'SQLITE_ERROR') {
    error = handleDatabaseError(error);
  }

  if (error.code === 'EADDRINUSE') {
    error = handlePortInUseError(error);
  }

  if (error.code === 'ER_ACCESS_DENIED_ERROR') {
    error = handleDatabaseAccessError(error);
  }

  sendErrorResponse(error, req, res);
};

const handleJWTError = () => {
  return new AuthError('无效的 token，请重新登录', ErrorCode.AUTH_INVALID_TOKEN);
};

const handleJWTExpiredError = () => {
  return new AuthError('token 已过期，请重新登录', ErrorCode.AUTH_TOKEN_EXPIRED);
};

const handleDatabaseError = (err) => {
  const message = err.message || '数据库操作失败';
  return new AppError(message, 500, ErrorCode.DATABASE_ERROR, err.code);
};

const handleDatabaseAccessError = (err) => {
  return new AppError('数据库连接失败，请检查配置', 500, ErrorCode.DATABASE_CONNECTION_FAILED);
};

const handlePortInUseError = (err) => {
  return new AppError('端口被占用，请检查是否有其他服务在运行', 503, ErrorCode.SERVICE_UNAVAILABLE);
};

const sendErrorResponse = (error, req, res) => {
  const response = createErrorResponse(
    error.errorCode || ErrorCode.INTERNAL_ERROR,
    error.details
  );

  if (process.env.NODE_ENV === 'development' && error.stack) {
    response.stack = error.stack;
  }

  res.status(error.statusCode || 500).json(response);
};

export { 
  AppError, 
  ValidationError, 
  AuthError, 
  PermissionError, 
  NotFoundError, 
  BusinessError,
  errorHandler 
};