class AppError extends Error {
  constructor(message, statusCode, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.details = details;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

const errorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  let error = { ...err };
  error.message = err.message;

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

  sendErrorResponse(error, req, res);
};

const handleJWTError = () => {
  return new AppError('无效的 token，请重新登录', 401);
};

const handleJWTExpiredError = () => {
  return new AppError('token 已过期，请重新登录', 401);
};

const handleDatabaseError = (err) => {
  const message = err.message || '数据库操作失败';
  return new AppError(message, 500, err.code);
};

const handlePortInUseError = (err) => {
  return new AppError('端口被占用，请检查是否有其他服务在运行', 503);
};

const sendErrorResponse = (error, req, res) => {
  const response = {
    success: false,
    message: error.message,
    status: error.status
  };

  if (error.details) {
    response.details = error.details;
  }

  if (process.env.NODE_ENV === 'development' && error.stack) {
    response.stack = error.stack;
  }

  res.status(error.statusCode).json(response);
};

export { AppError, errorHandler };
