export const SCHEMA_VERSION = '1.0.0';

export const ResponseSchema = {
  success: {
    type: 'object',
    required: ['success', 'data'],
    properties: {
      success: { type: 'boolean', const: true },
      message: { type: 'string' },
      data: { type: ['object', 'array', 'string', 'number', 'boolean', 'null'] },
      pagination: {
        type: 'object',
        properties: {
          page: { type: 'number' },
          limit: { type: 'number' },
          total: { type: 'number' },
          totalPages: { type: 'number' },
          hasNext: { type: 'boolean' },
          hasPrev: { type: 'boolean' }
        }
      },
      meta: { type: 'object' }
    }
  },
  error: {
    type: 'object',
    required: ['success', 'message', 'errorCode'],
    properties: {
      success: { type: 'boolean', const: false },
      message: { type: 'string' },
      errorCode: { type: 'string' },
      errorType: { type: 'string' },
      details: { type: 'object' },
      timestamp: { type: 'number' }
    }
  }
};

export const UserSchema = {
  type: 'object',
  required: ['id', 'email', 'name', 'role'],
  properties: {
    id: { type: 'string', format: 'uuid' },
    email: { type: 'string', format: 'email' },
    name: { type: 'string' },
    role: { type: 'string', enum: ['student', 'teacher', 'admin', 'guest'] },
    provinceCode: { type: 'string' },
    subjects: { type: 'array', items: { type: 'string' } },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' }
  }
};

export const QuestionSchema = {
  type: 'object',
  required: ['id', 'question', 'subject', 'difficulty', 'score'],
  properties: {
    id: { type: 'string', format: 'uuid' },
    question: { type: 'string' },
    subject: { type: 'string' },
    difficulty: { type: 'number', minimum: 1, maximum: 5 },
    score: { type: 'number', minimum: 0, maximum: 150 },
    type: { type: 'string', enum: ['choice', 'fill', 'answer', 'essay'] },
    options: { type: 'array', items: { type: 'string' } },
    answer: { type: 'string' },
    analysis: { type: 'string' },
    knowledgePoints: { type: 'array', items: { type: 'string' } },
    year: { type: 'number' },
    provinceCode: { type: 'string' },
    paperId: { type: 'string', format: 'uuid' },
    createdAt: { type: 'string', format: 'date-time' }
  }
};

export const ExamPaperSchema = {
  type: 'object',
  required: ['id', 'title', 'subject', 'year', 'provinceCode'],
  properties: {
    id: { type: 'string', format: 'uuid' },
    title: { type: 'string' },
    subject: { type: 'string' },
    year: { type: 'number' },
    provinceCode: { type: 'string' },
    totalScore: { type: 'number' },
    duration: { type: 'number' },
    questions: { type: 'array', items: QuestionSchema },
    difficultyStats: {
      type: 'object',
      properties: {
        easy: { type: 'number' },
        medium: { type: 'number' },
        hard: { type: 'number' }
      }
    },
    typeStats: {
      type: 'object',
      properties: {
        choice: { type: 'number' },
        fill: { type: 'number' },
        answer: { type: 'number' },
        essay: { type: 'number' }
      }
    },
    createdAt: { type: 'string', format: 'date-time' }
  }
};

export const WrongQuestionSchema = {
  type: 'object',
  required: ['id', 'questionId', 'userId', 'wrongCount'],
  properties: {
    id: { type: 'string', format: 'uuid' },
    questionId: { type: 'string', format: 'uuid' },
    userId: { type: 'string', format: 'uuid' },
    wrongCount: { type: 'number', minimum: 1 },
    lastWrongAt: { type: 'string', format: 'date-time' },
    reviewStatus: { type: 'string', enum: ['pending', 'reviewing', 'mastered'] },
    nextReviewAt: { type: 'string', format: 'date-time' },
    masteryLevel: { type: 'number', minimum: 0, maximum: 100 },
    analysis: { type: 'string' },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' }
  }
};

export const KnowledgePointSchema = {
  type: 'object',
  required: ['id', 'name', 'subject', 'parentId'],
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    subject: { type: 'string' },
    parentId: { type: ['string', 'null'] },
    masteryLevel: { type: 'number', minimum: 0, maximum: 100 },
    questionCount: { type: 'number', minimum: 0 },
    wrongCount: { type: 'number', minimum: 0 },
    children: { type: 'array', items: 'object' },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' }
  }
};

export const ExamSessionSchema = {
  type: 'object',
  required: ['id', 'userId', 'paperId', 'status'],
  properties: {
    id: { type: 'string', format: 'uuid' },
    userId: { type: 'string', format: 'uuid' },
    paperId: { type: 'string', format: 'uuid' },
    status: { type: 'string', enum: ['in-progress', 'completed', 'paused'] },
    startTime: { type: 'string', format: 'date-time' },
    endTime: { type: ['string', 'null'], format: 'date-time' },
    duration: { type: 'number' },
    remainingTime: { type: 'number' },
    answers: { type: 'array', items: { type: 'object' } },
    score: { type: ['number', 'null'] },
    cutScreenCount: { type: 'number', minimum: 0 },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' }
  }
};

export const LoginRequestSchema = {
  type: 'object',
  required: ['email', 'password'],
  properties: {
    email: { type: 'string', format: 'email' },
    password: { type: 'string', minLength: 6, maxLength: 128 },
    rememberMe: { type: 'boolean' }
  }
};

export const RegisterRequestSchema = {
  type: 'object',
  required: ['email', 'password', 'name'],
  properties: {
    email: { type: 'string', format: 'email' },
    password: { type: 'string', minLength: 6, maxLength: 128 },
    name: { type: 'string', minLength: 2, maxLength: 50 },
    role: { type: 'string', enum: ['student', 'teacher'], default: 'student' }
  }
};

export const PaginatedRequestSchema = {
  type: 'object',
  properties: {
    page: { type: 'number', minimum: 1, default: 1 },
    limit: { type: 'number', minimum: 1, maximum: 100, default: 20 },
    sortBy: { type: 'string' },
    sortOrder: { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
    keyword: { type: 'string' }
  }
};

export const schemas = {
  response: ResponseSchema,
  user: UserSchema,
  question: QuestionSchema,
  examPaper: ExamPaperSchema,
  wrongQuestion: WrongQuestionSchema,
  knowledgePoint: KnowledgePointSchema,
  examSession: ExamSessionSchema,
  loginRequest: LoginRequestSchema,
  registerRequest: RegisterRequestSchema,
  paginatedRequest: PaginatedRequestSchema
};

export function validateSchema(data, schema) {
  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['数据必须是对象'] };
  }

  const errors = [];
  
  if (schema.required) {
    for (const field of schema.required) {
      if (!data[field] && data[field] !== 0 && data[field] !== false) {
        errors.push(`缺少必填字段: ${field}`);
      }
    }
  }

  if (schema.properties) {
    for (const [field, prop] of Object.entries(schema.properties)) {
      if (data[field] !== undefined) {
        const value = data[field];
        
        if (prop.type && typeof value !== prop.type) {
          errors.push(`${field} 类型错误，期望 ${prop.type}`);
        }
        
        if (prop.minLength && typeof value === 'string' && value.length < prop.minLength) {
          errors.push(`${field} 长度不能小于 ${prop.minLength}`);
        }
        
        if (prop.maxLength && typeof value === 'string' && value.length > prop.maxLength) {
          errors.push(`${field} 长度不能大于 ${prop.maxLength}`);
        }
        
        if (prop.minimum !== undefined && typeof value === 'number' && value < prop.minimum) {
          errors.push(`${field} 不能小于 ${prop.minimum}`);
        }
        
        if (prop.maximum !== undefined && typeof value === 'number' && value > prop.maximum) {
          errors.push(`${field} 不能大于 ${prop.maximum}`);
        }
        
        if (prop.enum && !prop.enum.includes(value)) {
          errors.push(`${field} 值无效，可选值: ${prop.enum.join(', ')}`);
        }
        
        if (prop.format === 'email') {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(value)) {
            errors.push(`${field} 邮箱格式不正确`);
          }
        }
        
        if (prop.format === 'uuid') {
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          if (!uuidRegex.test(value)) {
            errors.push(`${field} UUID格式不正确`);
          }
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

export default schemas;