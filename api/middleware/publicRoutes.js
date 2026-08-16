// api/middleware/publicRoutes.js — 无需 JWT 的公开路由白名单
//
// 为什么需要 (P0.6, 2026-08-15):
//   server.js 对 /api/* 全局挂载 authMiddleware, 若登录/注册/游客也要求 JWT,
//   则形成"注册不了 → 登录不了 → 拿不到 token → 所有页面挂"的死锁.
//   本白名单让预认证端点直接放行.
//
// 路径基准: authMiddleware 在 server.js 挂载于 '/api/' 前缀下,
//   req.path 是去掉 /api 之后的相对路径 (如 '/auth/login').
//   因此这里存相对路径, 与 req.path 直接比较.
export const PUBLIC_ROUTES = [
  '/auth/login', // 登录
  '/auth/register', // 注册
  '/auth/guest', // 游客登录 (模块挂载点)
  '/auth/guest-login', // 游客登录别名 (F3 service 实际调用路径)
  '/auth/reset-password', // 重置密码 (含请求/验证/设置)
  '/auth/logout', // 登出 (JWT 无状态, 前端清 token; 保证 200)
  '/health', // 健康检查 (虽然 server.js 提前处理, 双保险)
];

/**
 * 判断路径是否为公开路由 (无需 JWT).
 * @param {string} path — req.path (相对 /api 前缀) 或完整路径均可
 * @returns {boolean}
 */
export function isPublicRoute(path) {
  if (!path || typeof path !== 'string') return false;
  const p = path.split('?')[0];
  // 兼容带 /api 前缀的完整路径
  const candidates = p.startsWith('/api') ? [p.slice(4) || '/', p] : [p, '/api' + p];
  return PUBLIC_ROUTES.some((route) => candidates.some((c) => c === route || c.startsWith(route + '/')));
}
