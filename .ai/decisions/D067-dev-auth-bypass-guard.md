# D067: DEV_AUTH_BYPASS 启动防护 + 告警日志

**日期**: 2026-08-17
**状态**: 已实施
**相关**: D066 (gate 体系), incident 2026-08-17

## 背景

2026-08-17 incident: 旧 `node server.js` 调试进程残留 `DEV_AUTH_BYPASS=1` 环境变量，
导致**所有 API 端点无 token 返回 200 + 真实数据**，用户数据泄露。
该变量不在 `.env` 中，仅存在于启动进程的 shell 环境变量里。

## 决策

### 1. 启动时检测（server.js）
- `NODE_ENV=production` 且 `DEV_AUTH_BYPASS=1` → `process.exit(1)`
- 开发环境 → `console.warn('⚠️ DEV_AUTH_BYPASS=1 — ALL AUTH GUARDS BYPASSED')`

### 2. 请求级告警（api/core/auth.js）
- `authMiddleware` 每次触发 bypass 时输出 `⚠️ DEV_AUTH_BYPASS=1` 警告日志
- 这样即使启动检查被绕过，每个请求都会打印告警

### 3. `authMiddleware` 是最后一道防线
- `isPublicRoute` 白名单 + `DEV_AUTH_BYPASS` + JWT 验证三层防护
- 任何一层出现问题都会被日志记录

## 影响

- 防止环境变量残留导致的**无感知认证绕过**
- 启动失败比"服务正常运行但所有请求都被 bypass"更安全
