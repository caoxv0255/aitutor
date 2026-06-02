const successResponse = (data, message = '操作成功') => {
  return {
    success: true,
    message,
    data
  };
};

const errorResponse = (message, status = 'error') => {
  return {
    success: false,
    message,
    status
  };
};

const paginatedResponse = (data, total, page, limit) => {
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
};

const createdResponse = (data, message = '创建成功') => {
  return {
    success: true,
    message,
    data
  };
};

const deletedResponse = (message = '删除成功') => {
  return {
    success: true,
    message,
    data: null
  };
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
  return true;
}

export {
  successResponse,
  errorResponse,
  paginatedResponse,
  createdResponse,
  deletedResponse
};
