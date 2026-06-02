import { AppError } from '../middleware/errorHandler.js';

const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const validatePassword = (password) => {
  if (!password || password.length < 6) {
    return { valid: false, message: '密码长度至少为6位' };
  }
  if (password.length > 128) {
    return { valid: false, message: '密码长度不能超过128位' };
  }
  return { valid: true };
};

const validateRequiredFields = (fields, data) => {
  const missing = [];
  for (const field of fields) {
    if (!data[field] && data[field] !== 0 && data[field] !== false) {
      missing.push(field);
    }
  }
  if (missing.length > 0) {
    return { valid: false, message: `缺少必填字段: ${missing.join(', ')}` };
  }
  return { valid: true };
};

const validateEmailFormat = (email) => {
  if (!validateEmail(email)) {
    return { valid: false, message: '邮箱格式不正确' };
  }
  return { valid: true };
};

const validateQuestion = (question) => {
  if (!question || typeof question !== 'string') {
    return { valid: false, message: '题目内容必须是字符串' };
  }
  if (question.trim().length === 0) {
    return { valid: false, message: '题目内容不能为空' };
  }
  if (question.length > 5000) {
    return { valid: false, message: '题目内容不能超过5000字符' };
  }
  return { valid: true };
};

const validateSubject = (subject) => {
  const validSubjects = ['数学', '语文', '英语', '物理', '化学', '生物', '历史', '地理', '政治'];
  if (!validSubjects.includes(subject)) {
    return { valid: false, message: `无效的学科: ${subject}，可选值: ${validSubjects.join(', ')}` };
  }
  return { valid: true };
};

const validateDifficulty = (difficulty) => {
  if (typeof difficulty !== 'number' || difficulty < 1 || difficulty > 5) {
    return { valid: false, message: '难度值必须在1-5之间' };
  }
  return { valid: true };
};

const validateScore = (score) => {
  if (typeof score !== 'number' || score < 0 || score > 150) {
    return { valid: false, message: '分值必须在0-150之间' };
  }
  return { valid: true };
};

const validateYear = (year) => {
  const currentYear = new Date().getFullYear();
  if (typeof year !== 'number' || year < 2000 || year > currentYear + 1) {
    return { valid: false, message: `年份必须在2000-${currentYear + 1}之间` };
  }
  return { valid: true };
};

const validate = (validators, data) => {
  for (const { field, validators: fieldValidators } of validators) {
    const value = data[field];
    for (const validator of fieldValidators) {
      const result = validator(value);
      if (!result.valid) {
        throw new AppError(`${field}: ${result.message}`, 400);
      }
    }
  }
};

const validateLogin = (data) => {
  const validators = [
    { field: 'email', validators: [validateEmailFormat] },
    { field: 'password', validators: [validatePassword] }
  ];
  validate(validators, data);
};

const validateRegister = (data) => {
  const validators = [
    { field: 'email', validators: [validateEmailFormat] },
    { field: 'password', validators: [validatePassword] },
    { field: 'name', validators: [validateRequiredFields.bind(null, ['name'])] }
  ];
  validate(validators, data);
};

const validateQuestionData = (data) => {
  const validators = [
    { field: 'question', validators: [validateQuestion] },
    { field: 'subject', validators: [validateSubject] },
    { field: 'difficulty', validators: [validateDifficulty] },
    { field: 'score', validators: [validateScore] }
  ];
  validate(validators, data);
};

export {
  validateEmail,
  validatePassword,
  validateRequiredFields,
  validateEmailFormat,
  validateQuestion,
  validateSubject,
  validateDifficulty,
  validateScore,
  validateYear,
  validate,
  validateLogin,
  validateRegister,
  validateQuestionData
};
