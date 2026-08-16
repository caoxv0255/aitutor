# D061 — AuthMiddleware 公开路由白名单

> **日期**: 2026-08-15
> **阶段**: Phase 1 工程收敛
> **影响范围**: server.js, api/core/auth.js, api/middleware/publicRoutes.js, 8 个公开端点

## 问题

`server.js` 对 `/api/*` 全局挂载 `authMiddleware`, **没有放行名单**, 导致登录/注册/游客登录自身也被 401 拦截, 形成"登录需要 JWT → 拿不到 JWT → 登录不了"的死锁。

容器跑的是旧镜像 (08-12 构建, 早于全局 auth 提交), 所以症状被掩盖——一旦用新代码重建, F3 前端完全无法登录。

## 决策

采用**声明式白名单** (`api/middleware/publicRoutes.js`), 而**不是**硬编码 if/else:

```js
export const PUBLIC_ROUTES = [
  '/auth/login', '/auth/register',
  '/auth/guest', '/auth/guest-login',
  '/auth/reset-password', '/auth/logout',
  '/health',
];
```

`authMiddleware` 在最前面检查 `isPublicRoute(req.path)`, 通过则放行。

**补齐了契约缺口**:
- 后端缺 `/api/auth/guest-login` 别名 (F3 service 调的就是这个路径) → 已加
- 后端缺 `/api/auth/me` (getCurrentUser) → 已加
- 后端缺 `/api/auth/logout` (service 调但 silent) → 已加 (public)

## 备选方案 & 否决理由

| 方案 | 否决理由 |
|------|----------|
| 硬编码 if (path === '/login') return next() | 不可维护, 每次加端点都要改 auth.js |
| 让登录模块自己挂载 (绕过 modulesRouter) | 破坏统一中间件链, 失去 audit/rate-limit 保护 |
| 把 auth 模块放进 modulesRouter 但排除 authMiddleware | 同上, 失去统一观测 |

## 后果

- `npm run contract:backend` 通过 (19/19, 含 auth guard 验证)
- 容器重建后登录链路 (register → login → token → 受保护端点) 完整恢复
- `auth.js` 加入白名单检查 (3 行), 不影响 DEV bypass 路径
- `auditMiddleware` + `apiLimiter` 仍作用于公开路由, 安全无损失

## 变更文件

| 文件 | 改动 |
|------|------|
| `api/middleware/publicRoutes.js` | **新增** — 白名单 + isPublicRoute() |
| `api/core/auth.js` | 加 isPublicRoute 放行 (3 行) |
| `api/modules/auth/routes.js` | 加 /guest-login, /me, /logout 端点 |
| `server.js` | 无改动 (authMiddleware 引用从 auth.js) |

## 验证

```bash
BCT_URL=http://localhost:3002 node tests/backend-contract.test.js
# → 19 passed, 0 failed (含 public routes + auth guard 两组断言)
```