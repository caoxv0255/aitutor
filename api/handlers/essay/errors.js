/* ============================================================================
 * errors.js — D086 §12 L4 V1.0 · 作文批改专用异常类
 *
 * 用途: service 层抛出 EssayError, handler 统一捕获并转为 ErrorCode 响应.
 * 设计: EssayError.code 对应 ErrorCode enum, EssayError.statusCode 来自 ErrorMap.
 * ============================================================================ */

'use strict';

import { ErrorMap } from '../../utils/errorCodes.js';

export class EssayError extends Error {
  /**
   * @param {string} code        ErrorCode enum 之一 (如 ESSAY_TRANSCRIBE_PARSE_FAILED)
   * @param {string} [message]   用户可读消息; 若未提供, 用 ErrorMap 中的默认 message
   * @param {object} [details]   附加诊断信息 (如 zod_issues, raw_excerpt)
   */
  constructor(code, message, details = null) {
    const info = ErrorMap[code] || { message: '未知错误', type: 'SYSTEM', statusCode: 500 };
    super(message || info.message);
    this.name = 'EssayError';
    this.code = code;
    this.statusCode = info.statusCode;
    this.type = info.type;
    this.details = details;
    if (typeof Error.captureStackTrace === 'function') {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}
