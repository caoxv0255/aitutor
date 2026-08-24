/**
 * api/middleware/traceId.js — 请求级 trace_id 提取 (Phase B, 2026-08-24)
 *
 * 设计:
 *   - 读取 X-Trace-Id header (前端 client.js 生成, 见 ai-tutor-frontend/assets/js/api/client.js)
 *   - 缺省时生成 UUID v4, 写入 req.traceId
 *   - 响应头回传 X-Trace-Id (与 X-Request-Id 区分: X-Request-Id 是 loggerMiddleware 的短随机,
 *     X-Trace-Id 是跨前后端的 UUID, 用于 ai_trace.request_id 关联)
 *   - 透传到 req.user (auth 后) 与 logger context
 *
 * 用法: app.use(traceIdMiddleware)  (在 loggerMiddleware 之后, authMiddleware 之前)
 *
 * 注意:
 *   - loggerMiddleware 已设 req.requestId (12-char base36), 用于 log 行内 requestId.
 *   - 本 middleware 设 req.traceId (UUID), 用于 ai_trace.request_id 关联.
 *   - 两者并存, 不冲突.
 */

import crypto from 'crypto';

/**
 * RFC 4122 v4 UUID 生成 (Node 18+ crypto.randomUUID 优先, 兜底 randomBytes).
 */
function generateUuidV4() {
  if (typeof crypto.randomUUID === 'function') {
    try { return crypto.randomUUID(); } catch (_) { /* fall through */ }
  }
  const bytes = crypto.randomBytes(16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20,32)}`;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function traceIdMiddleware(req, res, next) {
  // 1. 读 header (case-insensitive, Express 已规范化 lowercase)
  const incoming = req.headers['x-trace-id'];

  // 2. 校验格式: 仅接受 UUID v4, 否则忽略重新生成 (防注入)
  let traceId = (typeof incoming === 'string' && UUID_RE.test(incoming))
    ? incoming
    : generateUuidV4();

  // 3. 写入 req / res
  req.traceId = traceId;
  res.setHeader('X-Trace-Id', traceId);

  next();
}

export { generateUuidV4 };
export default traceIdMiddleware;
