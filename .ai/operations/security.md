# Security — 安全文档

> **最后更新**: 2026-08-28 (D083 补全)
> **配合**: D067 (DEV_AUTH_BYPASS) + CLAUDE.md §安全

---

## 1. 已知安全清单 (audit 2026-08-17)

| 检查项 | 状态 | 详情 |
|---|---|---|
| **DEV_AUTH_BYPASS guard** | ✅ | D067 启动检测 + per-request 告警 |
| **JWT secret 校验** | ✅ | 启动时 `validateJWTSecret()` |
| **authMiddleware** | ✅ | isPublicRoute 白名单 + JWT 验证 |
| **Rate limit** | ✅ | auth 20/15min, proxy 10/min, api 通用 |
| **CORS** | ✅ | ALLOWED_ORIGINS 可配 |
| **Helmet** | ❌ | **未安装 helmet** — 无 CSP/X-Frame-Options (P1-2) |
| **Input validation** | ⚠️ | 部分路由缺少 express-validator |
| **SQL injection** | ✅ | 全部使用参数化查询 ($1, $2) |
| **Secrets in .env** | ✅ | .gitignore 已包含 |
| **Docker-compose env** | ✅ | 不含明文密钥 |

---

## 2. DEV_AUTH_BYPASS (D067)

**风险**: 所有 API 端点（包括 `/api/user/dashboard`、`/api/review/reports`）在无 token 时返回 200 + 真实数据 = **用户数据泄露**。

**修法 (D067, 2026-08-17)**:
1. `authMiddleware` 每次触发时输出 `⚠️ DEV_AUTH_BYPASS=1` 警告日志
2. `server.js` 启动时检测: 生产环境直接 `process.exit(1)`, 开发环境输出醒目警告

**回避**:
- ❌ 生产环境**绝不设置** `DEV_AUTH_BYPASS`
- ❌ 调试后**必须杀死** `node server.js` 进程
- ✅ 使用 Docker 部署时确认容器环境无此变量

详细: `.ai/known-bugs.md` §2026-08

---

## 3. JWT 管理

### 3.1 生成

```bash
# 强随机 (生产)
openssl rand -hex 32

# 弱 (开发, 拒绝)
JWT_SECRET=secret
JWT_SECRET=changeme
```

启动时 `validateJWTSecret()` 检查强度, 弱密钥直接 exit。

### 3.2 存储

- ✅ `.env` (已 gitignore)
- ✅ `.env.prod` (生产, 不入库)
- ❌ 不在代码硬编码
- ❌ 不在 docker-compose.yml 明文

### 3.3 轮换

⚠️ 当前无自动轮换机制, JWT 长期有效。

**建议** (待落地):
- 短期 (7 天) + Refresh Token
- 定期轮换 secret (季度)
- 失效列表 (logout 时)

---

## 4. 公开路由白名单

```
api/core/auth.js
└── PUBLIC_ROUTES = [
  '/api/health',
  '/api/login',
  '/api/register',
  '/api/guest-login',
  '/api/reset-password',
  '/api/provinces',         // 公共数据
  '/api/exam-papers',        // 公共试卷列表?
  ...
]
```

⚠️ **不要随意加 public route**, 加之前确认:
- 该 endpoint 是否真的不需要认证?
- 是否会泄露用户数据?
- 是否会被滥用?

---

## 5. SQL Injection

**所有 SQL 必须参数化**:

```js
// ✅ 安全
await client.query(
  'SELECT * FROM users WHERE email = $1',
  [userEmail]
);

// ❌ 不安全 (NEVER)
await client.query(
  `SELECT * FROM users WHERE email = '${userEmail}'`
);
```

**仓库状态**: 全部使用参数化查询 (✅ 通过)。

---

## 6. CORS

环境变量 `ALLOWED_ORIGINS`:
```
ALLOWED_ORIGINS=https://aitutor.uibe.online,https://admin.uibe.edu.cn
```

⚠️ **不要用 `*`** 在生产, 仅 debug 可用。

---

## 7. Rate Limiting

| 路由 | 限制 |
|---|---|
| Auth (login/register) | 20 次 / 15 分钟 |
| LLM proxy | 10 次 / 分钟 |
| 通用 API | (待配) |

⚠️ 当前通用 API 无限流, 可能被滥用。

---

## 8. 输入校验

⚠️ 部分路由缺 `express-validator`, 例如:
- `POST /api/user/wrong-questions` body 字段未严格校验
- `POST /api/tutor/loop/feedback` is_correct 类型未校验

**建议** (待落地, P1):
- 加 `express-validator` middleware
- 用 zod schema 校验 body

---

## 9. 密钥管理 (Secrets)

### 9.1 当前方式

- `.env` 本地 (gitignore)
- `.env.prod` 生产 (不入库)
- docker-compose.prod.yml 用 `${VAR}` 引用

### 9.2 改进方向 (Day-3+)

- **Docker secrets** (Swarm 模式)
- **HashiCorp Vault** (大型项目)
- **AWS Secrets Manager** / **阿里云 KMS**

⚠️ 当前未采用, **Day-3+ 决策**。

---

## 10. 已知风险 (P0/P1)

| # | 风险 | 状态 | 来源 |
|---|---|---|---|
| P0 | DEV_AUTH_BYPASS 残留 | ✅ D067 修复 | known-bugs.md |
| P0 | 默认 JWT secret | ✅ 启动校验 | D070 |
| P1 | 无 Helmet | ❌ 未装 (P1-2) | audit 2026-08-17 |
| P1 | 无 express-validator | ⚠️ 部分路由 | audit 2026-08-17 |
| P1 | 通用 API 无 rate limit | ⚠️ | D070 |
| P2 | 无 JWT 自动轮换 | ⏳ Day-3+ | D069 |
| P2 | 无 refresh token | ⏳ Day-3+ | D069 |
| P2 | 无 secrets manager | ⏳ Day-3+ | D069 |

---

## 11. 报告安全问题

发现安全漏洞:
1. 立即通知 L0 (用户) + L1 (ChatGPT)
2. 创建 P0 ADR 或 SECURITY.md 附录
3. 不要私下修复后悄悄 merge
4. 修复后回归测试必须包含攻击向量

---

## 12. 不在 security scope

- ❌ 添加 Helmet (P1-2, Sprint 范围外)
- ❌ Secrets Manager 接入 (Day-3+)
- ❌ JWT 轮换机制 (Day-3+)

---

**文档结束 — security v1.0 (2026-08-28)**