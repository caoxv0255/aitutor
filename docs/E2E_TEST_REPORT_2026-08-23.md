# E2E 测试报告 — aitutor (2026-08-23)

## 测试账号

| 字段 | 值 |
|------|----|
| email | test@uibe.edu.cn |
| password | test123456 |
| grade | 高三 (gaokao) |
| user_id | 594 |
| 创建时间 | 2026-08-23 10:14 UTC |

注册端点：`POST /api/auth/register`
登录端点：`POST /api/auth/login`

---

## 测试结果汇总

| 类别 | 通过 | 失败 | 通过率 |
|------|------|------|--------|
| 后端 API（38 用例） | 34 | 4 | **89.5%** |
| 前端 — F3 (ai-tutor-frontend) | ✅ | – | 100% (login → dashboard → wrong-book → mastery) |
| 前端 — Legacy (frontend/) | ⚠️ | – | 页面 200 OK，但 fetch 调用旧路径 |
| 前端 — PWA (public/) | ⚠️ | – | 页面 200 OK，登录按钮静默失败 |

---

## API 测试详情

### ✅ 已通过的端点（34/38）

**1. AUTH & USER（4/4）**
- `GET /api/auth/me`
- `GET /api/auth/prefs/province`
- `POST /api/auth/prefs/province` (body: `province_code`+`exam_level`)
- `POST /api/auth/logout`

**2. USER 模块（9/9）**
- `GET /api/user/dashboard`
- `GET/POST /api/user/profile`
- `GET /api/user/subjects`
- `GET /api/user/knowledge-profile`
- `GET /api/user/learning-suggestions`
- `GET/POST /api/user/wrong-questions`
- `GET /api/user/wrong-questions/export`

**3. KNOWLEDGE 模块（4/4）**
- `GET /api/knowledge/points?subject=math&level=gaokao`
- `GET /api/knowledge/map`
- `GET /api/knowledge/mastery`
- `GET /api/knowledge/mastery/:kpId`

**4. REVIEW 模块（4/4）**
- `GET /api/review/reports`
- `GET /api/review/weak-points`
- `GET /api/review/trend-summary`
- `GET /api/review/session/history`

**5. EXAM 模块（2/2）**
- `GET /api/exam/papers`
- `POST /api/exam/session/start` (subject=math, province=beijing)

**6. PROVINCES（2/4，see Issues）**
- `GET /api/provinces`
- `GET /api/provinces/beijing`

**7. SRS 模块（2/2）**
- `GET /api/srs/engine/daily-tasks`
- `GET /api/srs/engine/stats`

**8. RAG（2/3，see Issues）**
- `GET /api/rag/stats`
- `POST /api/rag/search`

**9. TUTOR（4/5，see Issues）**
- `GET /api/tutor/mastery/:kpId`
- `GET /api/tutor/loop/mastery`
- `POST /api/tutor/loop/batch`
- `POST /api/tutor/ask` ← **LLM 真实调用成功，返回完整教学推理**

**10. HEALTH**
- `GET /api/health`

### ⚠️ 已知问题（4 failures + 7 real bugs）

#### A. 测试用例参数问题（非产品 bug）
| 端点 | 实际 | 原因 |
|------|------|------|
| `GET /api/province-stats/beijing` | 500 | `province_knowledge_stats` 表为空（无 exam_papers 数据导入）|
| `GET /api/province-trends/beijing` | 500 | 同上 |
| `GET /api/rag/graphrag/knowledge-map?subject=math` | 503 | GraphRAG Python 微服务未启动 |
| `POST /api/tutor/loop/feedback` | 400 | 测试用 nested payload，实际需要 flat body `{knowledge_point_id, is_correct}` |

#### B. 真正的产品 bug（需要修复）

1. **`api/handlers/adaptive-difficulty.js:48` — SQL 语法错**
   ```sql
   SELECT es.*, AVG(CAST(qp.difficulty AS DOUBLE PRECISION)) ...  -- 'qp' 表未 JOIN
   FROM exam_sessions es
   LEFT JOIN wrong_questions wq ON ...  -- 只 JOIN 了 wq
   ```
   报错：`missing FROM-clause entry for table "qp"`
   **影响**: 任何 GET `/api/adaptive-difficulty?subject=math` 都返回 500

2. **`api/handlers/wrong-questions.js:218-219` — boolean/integer 类型不匹配**
   ```sql
   SUM(CASE WHEN reviewed = true THEN 1 ELSE 0 END)     -- 'reviewed' 列是 INTEGER
   SUM(CASE WHEN reviewed = false THEN 1 ELSE 0 END)
   ```
   报错：`operator does not exist: integer = boolean`
   **影响**: `GET /api/user/wrong-questions/stats` 返回 500

3. **`api/handlers/user-initialize.js:72` — 进程崩溃 + pool undefined**
   - 失败时调用 `pool.query('ROLLBACK')`，但 `pool` 变量未定义 → `ReferenceError`
   - 这是 **未捕获同步异常**，会**杀掉整个 Node 进程**（已确认 Docker 自动重启）
   - 触发条件：传入 `subjects:["math"]` 而非 `[{code:"math"}]`
   - **影响**: 单次失败就会让所有用户失去服务（高危）

4. **`api/handlers/exam-session.js` / `class-analysis.js` — Connection reset**
   - 几个 endpoint（POST `/api/exam/session/start`、`GET /api/class-detail`）会触发 connection reset
   - 需要查 container log 确认是否也是 unhandled rejection 杀进程

5. **前端 ↔ 后端路径不匹配（影响所有非 F3 客户端）**

   | 前端 | 调用路径 | 实际存在 | 状态 |
   |------|---------|---------|------|
   | `frontend/login.html:158` | `POST /api/login` | 仅 `POST /api/auth/login` | ❌ 404 |
   | `frontend/register.html:110` | `POST /api/register` | 仅 `POST /api/auth/register` | ❌ 404 |
   | `frontend/dashboard.html:215,220,228` | `/api/questions` / `/api/reports` / `/api/weak-points` | 已迁到 `/api/user/wrong-questions` / `/api/review/reports` / `/api/review/weak-points` | ❌ 404 |
   | `frontend/personalized-paper.html` | `/api/generate-paper` `/api/explain-question` | **未挂载**（没有 modulesRouter 路由） | ❌ 404 |
   | `frontend/learning-path.html` | `/api/learning-path` | **未挂载**（analytics 模块空） | ❌ 404 |
   | `frontend/wrong-book.html` | `/api/questions` | 同上 | ❌ 404 |
   | `frontend/my-weak-points.html` | `/api/weak-points` `/api/generate-paper` | 同上 | ❌ 404 |
   | `public/src/utils/context.js:81,103,124,143,179,etc.` | `/api/login /register/reset-password/questions/tasks` | 同上 | ❌ 404 |

   **D070** (2026-08-17) 把 `frontend/*` 301 → `/f3/pages/*`，但 `/api/*` 旧路径未做 alias，是 F3 之外前端静默失败的根本原因。

6. **未挂载的模块（handler 文件存在但无路由）**

   | 模块 | handler | 状态 |
   |------|---------|------|
   | `api/handlers/learning-path.js` | 存在 | 未挂载（`api/modules/analytics/routes.js` 是空 router）|
   | `api/handlers/reports.js` | 存在 | 同上 |
   | `api/handlers/gamification.js` (checkin/points/badges) | 存在 | 未挂载 |
   | `api/handlers/class-analysis.js` | 存在 | 仅 server.js 挂载了 `getClassDetail` |
   | `api/handlers/learning-dashboard.js` | 存在 | 仅 `/api/user/dashboard` 用了它 |
   | `api/handlers/adaptive-difficulty.js` | 存在 | 仅 server.js 挂载 |

---

## 真实持久化数据

```sql
SELECT * FROM (
  SELECT 'wrong_questions' tbl, COUNT(*) FROM wrong_questions WHERE user_email='test@uibe.edu.cn'
  UNION ALL SELECT 'user_profiles', COUNT(*) FROM user_profiles WHERE user_email='test@uibe.edu.cn'
  UNION ALL SELECT 'user_subjects', COUNT(*) FROM user_subjects WHERE user_email='test@uibe.edu.cn'
) x;
-- wrong_questions=2, user_profiles=1, user_subjects=1
```

---

## 建议修复优先级

**P0 (生产事故风险)**:
1. `user-initialize.js:72` `pool is not defined` — 单点崩溃杀进程
2. `wrong-questions.js:218-219` boolean/int 类型不匹配
3. `adaptive-difficulty.js:48` SQL `qp` 表未 JOIN

**P1 (核心功能阻塞)**:
4. `exam-session.js` / `class-analysis.js` connection reset（需 log 确认）
5. 前端旧 `/api/*` 路径 → 新 `/api/auth/*`, `/api/user/*` 等的兼容层（推荐：modulesRouter 增加 legacy alias）

**P2 (架构债务)**:
6. `learning-path.js` `reports.js` `gamification.js` handler 未挂载
7. 旧 frontend/ 与 public/ 是 legacy/过渡状态，应冻结或移除

---

## 测试脚本

- `scripts/e2e_test.sh` — v1 错误路径版本（教学用，保留作为负面参考）
- `scripts/e2e_final.sh` — v3 修正路径 + 修正参数（推荐使用）

执行：
```bash
bash scripts/e2e_final.sh
```

跑通全部 38 用例约 30-60 秒（含 LLM 调用）。