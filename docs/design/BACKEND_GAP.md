# BACKEND_GAP.md · 后端反推 + 缺口清单

> **阶段 3 / 5 · 后端工程师交付物** · Round 10 起
> **目标**: 把 PM-BRIEF §F.2 数据契约 + Stage 2 前端页面 全部反推回后端, 实现前后端 1:1 对应
> **状态**: ⏸️ 完成 audit 后暂停等审核

---

## 1. 现状 (Round 10 audit)

| 模块 | 端点数 | 关键端点 | 评价 |
|---|---|---|---|
| `auth` | 7 | `/login /register /me /prefs/province` | ✅ 完整 |
| `user` | 12 | `/profile /subjects /wrong-questions /knowledge-profile` | ✅ 完整 |
| `today` | 5 | `/  POST /:id/{start,complete,skip}` | ✅ 完整 (符合 D082) |
| `vision` | 3 | `/search /batch-parse /batch-ingest` | ✅ 完整 |
| `exam` | 16 | `/papers /questions /session/{start,submit,history}` | ✅ 完整 |
| `loop` | 3 | `/summary /actions /feed` | ✅ 完整 |
| `review` | 5 | weak-points 排名 | ✅ 完整 |
| `knowledge` | 6 | `/mastery /map /points /cross-subject-impact` | ⚠️ **缺 /star-map 专用端点** |
| `analytics` | 4 | `/learning-path /reports /class/{analysis,teacher}` | ✅ 完整 |
| `gamification` | 4 | checkin / points / badges | ✅ 完整 |
| `srs` | **0** | `routes.js` 存在但空 | ❌ **整个 SM2 算法端点缺失** |
| `tutor` | **0** | 模块空 | ⚠️ AI 对话模块未实现 |
| `essay` | **0** | 目录存在, 无 routes.js | ❌ **整个作文批改端点缺失** |
| `rag` / `rag-search` | 已有 | 题目检索支持 vision | ✅ |
| **合计** | **~70** | | |

---

## 2. 前端 17 页 → 后端端点需求矩阵

| # | 前端页 | 必需要端点 (PM §F.2) | 当前后端 | 缺口 |
|---|---|---|---|---|
| 1 | `landing.html` | 仅 marketing, 无 API | — | — |
| 2 | `register.html` | `POST /api/auth/register` (手机主/微信次/邮箱兜底) | ✅ `/api/auth/register` (邮箱 only) | ⚠️ 缺 手机号+验证码 / 微信 OAuth 适配 |
| 3 | `login.html` | `POST /api/auth/login` | ✅ | — |
| 4 | `onboarding.html` | `POST /api/user/initialize` (学段/省份/选科) | ✅ `/api/user/initialize` | — |
| 5 | `practice-hub-v2.html` | `GET /api/loop/summary` + `GET /api/loop/actions` + `GET /api/loop/feed` + `GET /api/today` | ✅ 4 端点全有 | — |
| 6 | `pwa-photo.html` | `POST /api/vision/search` | ✅ | — |
| 7 | `vision-result.html` | `POST /api/user/wrong-questions` | ✅ | — |
| 8 | `wrong-book.html` | `GET /api/user/wrong-questions?subject=X&status=Y` | ✅ | — |
| 9 | `learning-path.html` | `GET /api/analytics/learning-path?subject=X` + `GET /api/srs/engine/daily-tasks` | ✅ 部分 (`/learning-path` 有, **srs queue 缺**) | ❌ 缺 `/api/srs/engine/daily-tasks` |
| 10 | `predictive-paper.html` | `POST /api/exam/session/submit` + `POST /api/exam/paper/generate` | ✅ submit / ❌ **缺 generate** | ❌ 缺 `/api/exam/paper/generate` |
| 11 | `essay.html` | `POST /api/essay/grade` + `POST /api/essay/upload` + `GET /api/essay/list` | ❌ **整个 essay 模块未实现** | ❌ 缺 3 端点 |
| 12 | `mastery.html` | `GET /api/knowledge/mastery` | ✅ | — |
| 13 | `knowledge-star.html` (R9) | `GET /api/knowledge/star-map` (PM §F.2) | ❌ 缺 (仅 `/knowledge/map` 部分) | ❌ 缺 `/api/knowledge/star-map` (需 KP 节点 + 跨学科连线) |
| 14 | `subject-detail.html` | `GET /api/knowledge/mastery?subject=X` + `/cross-subject-impact` | ✅ | — |
| 15 | `settings.html` | `GET /api/user/profile` + `PUT /api/user/profile` + `GET/PUT /api/user/settings` | ✅ profile / ⚠️ 缺 settings | ⚠️ 缺 `/api/user/settings` (D082) |
| 16 | `notifications.html` | `GET /api/notifications?type=X` + `POST /:id/read` | ❌ 整个 notifications 模块未实现 | ❌ 缺 2 端点 |
| 17 | `error-404.html` | 仅静态 | — | — |
| 18 | `subject-picker.html` (R3) | `GET /api/auth/prefs/province?strategy=3+3\|3+1+2` | ✅ 部分 (省份有, 缺策略返回) | ⚠️ 缺选科策略字段 |
| 19 | `review-session.html` (R4) | `POST /api/srs/review` (PM §F.14 SM2 评分) | ❌ **整个 srs 模块未实现** | ❌ 缺 2 端点 (`/srs/review` + `/srs/queue`) |
| 20 | `state-library.html` | dev-only, 不需要 | — | — |
| 21 | `teacher-dashboard.html` | `GET /api/analytics/class/teacher` | ✅ | — |
| 22 | `learning-journey.html` | dev-only, 不需要 | — | — |

---

## 3. 缺口分级 (P0/P1/P2)

### ❌ P0 · 必须补齐 (Stage 3 主工作)

| 缺口 | 阻塞前端页 | 优先级 |
|---|---|---|
| `POST /api/srs/review` (SM2 评分核心) | review-session ★ R4 | **P0-1** |
| `GET /api/knowledge/star-map` (node-link + 跨学科连接) | knowledge-star ★ R9 | **P0-2** |
| `POST /api/essay/grade` (D086 作文批改核心) | essay | **P0-3** |
| `POST /api/essay/upload` (拍照上传) | essay | **P0-4** |
| `GET /api/essay/list` (历史) | essay | **P0-5** |
| `POST /api/exam/paper/generate` (AI 组卷) | predictive-paper | **P0-6** |
| `GET /api/srs/engine/daily-tasks` (今日 SRS 队列) | learning-path + notifications | **P0-7** |

### ⚠️ P1 · 应当补齐

| 缺口 | 阻塞前端页 | 优先级 |
|---|---|---|
| 短信验证码端点 (手机号注册) | register | P1-1 |
| 微信 OAuth 适配 | register | P1-2 |
| `GET/PUT /api/user/settings` (D082 完整 settings 表) | settings | P1-3 |
| `GET /api/notifications?type=X` | notifications | P1-4 |
| `POST /api/notifications/:id/read` | notifications | P1-5 |
| `/api/auth/prefs/province` 增 `strategy=3+3\|3+1+2` 字段 | subject-picker, onboarding | P1-6 |
| `GET /api/tutor/chat` (AI 老师对话) | 暂未前端 | P1-7 |

### 🟢 P2 · 备注

| 缺口 | 说明 |
|---|---|
| D062 强制 envelope | 已有 (mock/real 双路径同构), 不需改 |
| SM2 算法后端实装 | 需 Python/Node 实现 EF' 公式, 单元测试 |
| 离线评分本地暂存 | 客户端 IndexedDB (前端, 不是后端) |

---

## 4. SM2 算法后端实装 (P0-1 P0-7)

按 PM §F.14 统一参数, 后端实装:

```js
// api/modules/srs/routes.js (新)
import { authMiddleware } from '../../core/auth.js';

const EF_MIN = 1.3;
const EF_MAX = 2.8;
const EF_INIT = 2.5;
const MASTERY_DELTA = { 0: -0.15, 1: -0.10, 2: -0.05, 3: 0.04, 4: 0.08, 5: 0.12 };

router.get('/queue', authMiddleware, async (req, res) => {
  // 查 user 今日到期的 srs_review_log
  // 返回 [{wrong_id, similar_questions, subject, kp_name, ...}]
  // 满足 PM §F.9 相似题策略: 错题 1 + 相似 3 = 1 组
});

router.post('/review', authMiddleware, async (req, res) => {
  const { wrong_id, quality, time_spent_ms, group_results } = req.body;
  // 1. EF' = clamp(EF + 0.1 - (5-q)*(0.08 + (5-q)*0.02), EF_MIN, EF_MAX)
  // 2. 写 srs_review_log
  // 3. 计算 mastery_delta (按 q)
  // 4. 如果 group_results 全部错 → 该轮 q 封顶 2
  // 5. 如果相似题 3 对 ≥ 2 → 额外 +0.05
  // 6. 更新 mastery_score + srs_schedule
  // 返回 { new_ef, next_review_at, mastery_delta, group_mastery_delta }
});
```

---

## 5. 知识星图后端 (P0-2)

```js
// api/modules/knowledge/routes.js 追加
router.get('/star-map', authMiddleware, async (req, res) => {
  // 返回 KP 节点 + 跨学科连线
  // { nodes: [{kp_id, name, subject_code, mastery, is_weak, neighbors}],
  //   edges: [{from, to, strength}],
  //   subjects: [...] }
  // 9 学科 (语/数/英/物/化/生/历/地/政) 严格顺序
  // 复杂度: ≤ 48 KP 用 SVG, 101-500 用 Canvas (PM §F.5 性能预算 < 200KB)
});
```

---

## 6. 作文批改后端 (P0-3~5)

```js
// api/modules/essay/routes.js (新, 整模块从 0 写)
import { callLLM } from '../../services/llm.js';

router.post('/upload', authMiddleware, async (req, res) => {
  // multipart/form-data: image → OSS / 留 base64
  // 返回 { essay_id, image_url }
});

router.post('/grade', authMiddleware, async (req, res) => {
  // body: { essay_id, language: 'zh'|'en', content }
  // 调用 LLM (D086 V1.0) 4 维评分 + 锚定回原文
  // 写 essays 表 + essay_annotations 表
  // 返回 { essay_id, dimensions: {立意/结构/语言/规范}, score, annotations, ai_teacher_summary }
});

router.get('/list', authMiddleware, async (req, res) => {
  // 查用户历史作文, 按 created_at desc
  // 返回 [{ essay_id, title, score, language, created_at }]
});
```

---

## 7. AI 组卷 (P0-6)

```js
// api/modules/exam/routes.js 追加
router.post('/paper/generate', authMiddleware, async (req, res) => {
  // body: { subject, kp_ids?, difficulty?, count, source_provenance: true }
  // 按 PM §F.2 PredictedQuestion 返, 每题带命题依据
  // 调用 LLM 改写真题: source.year, source.province, source.original_qid, hit_logic
});
```

---

## 8. 数据库迁移 (后端工程师参考)

需要新建/补的表 (D082 + D086 + F.2):

```sql
-- srs 队列 (PM §F.2 WrongQuestion.similar_questions 关联)
CREATE TABLE srs_review_log (
  id UUID PRIMARY KEY,
  user_email TEXT REFERENCES users(email),
  wrong_id UUID REFERENCES wrong_questions(id),
  group_id UUID,  -- 错题 1 + 相似 3 = 1 组
  card_index SMALLINT,  -- 1..4 (组内位置)
  quality SMALLINT,  -- 0..5
  new_ef NUMERIC(3,2),
  interval_days INT,
  mastery_delta NUMERIC(3,2),
  time_spent_ms INT,
  reviewed_at TIMESTAMPTZ
);

-- 作文 (D086)
CREATE TABLE essays (
  id UUID PRIMARY KEY,
  user_email TEXT REFERENCES users(email),
  language TEXT,
  content TEXT,
  image_url TEXT,
  dimensions JSONB,  -- {立意:23, 结构:9, 语言:9, 规范:5}
  total_score SMALLINT,
  ai_summary TEXT,
  created_at TIMESTAMPTZ
);
CREATE TABLE essay_annotations (
  id UUID PRIMARY KEY,
  essay_id UUID REFERENCES essays(id),
  start_idx INT, end_idx INT,
  original TEXT, suggestion TEXT,
  severity TEXT,  -- '保留'/'待改'
  created_at TIMESTAMPTZ
);

-- 用户偏好 (D082)
CREATE TABLE user_settings (
  user_email TEXT PRIMARY KEY REFERENCES users(email),
  photo_only_wrong BOOLEAN DEFAULT true,
  exam_type TEXT,  -- '中考' / '高考' / '小学'
  subject_strategy TEXT,  -- '3+3' / '3+1+2' / '9科全开'
  subjects JSONB,  -- ['chinese', 'math', ...]
  daily_goal INT DEFAULT 40,
  notifications JSONB,
  channels JSONB,
  privacy JSONB,
  updated_at TIMESTAMPTZ
);

-- 通知
CREATE TABLE notifications (
  id UUID PRIMARY KEY,
  user_email TEXT REFERENCES users(email),
  type TEXT,  -- 'review' / 'weak' / 'achievement' / 'system' / 'achievement'
  title TEXT, body TEXT,
  is_read BOOLEAN DEFAULT false,
  subject_code TEXT,
  action_url TEXT,
  created_at TIMESTAMPTZ
);
```

---

## 9. 验证清单 (Stage 4 回归测试)

| 验证 | 方式 | 通过标准 |
|---|---|---|
| 70 端点 contract test | npm run gate | 100% 绿 |
| Stage 2 前端 17 页加载 | playwright e2e | 200, 4 状态可访问 |
| 9 学科顺序一致性 | grep test | 严格按 PM §F.8 |
| 9 学科色一致性 | screenshot diff | 8 种 hex 完全一致 |
| 0-5 评分控件 tappable | iPhone 14 Pro 触点 | 44×44+ px, < 100ms 响应 |
| WCAG a11y | axe-core | contrast 4.5:1+ |
| Lighthouse Perf | headless chrome | > 90 |

---

## 10. 阶段 3 交付物

- ✅ `docs/design/BACKEND_GAP.md` (本文档)
- ⏳ P0-1: api/modules/srs/routes.js
- ⏳ P0-2: GET /api/knowledge/star-map
- ⏳ P0-3~5: api/modules/essay/ (整模块)
- ⏳ P0-6: POST /api/exam/paper/generate
- ⏳ P0-7: GET /api/srs/engine/daily-tasks
- ⏳ DB 迁移: srs_review_log / essays / essay_annotations / user_settings / notifications

完成所有 P0 后, Stage 3 暂停, 进入 Stage 4 (测试 + 回归指南).
