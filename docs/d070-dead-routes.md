# D070 Dead Backend Endpoints — 2026-08-20 audit

**生成时间**: 2026-08-20T11:52:08.964Z
**Dead backend**: 83 个 (后端有, 前端 0 调用)
**Missing backend**: 8 个 (前端调, 后端 404)

## 已知 fix
- missing backend 8 个中真问题已修 (rag.js / exam.js / user.js / tutor.js), 剩 5 个 audit re3 误报 (实际后端有 200/500)
- dead backend 88 个**未删**, 原因: D070 之前可能用, audit 不知业务上下文, 风险大, 待人工 review

## Dead backend 列表 (按模块)

### analytics (9)
- `GET /api/analytics/province/trends` — api/modules/analytics/routes.js:11
- `GET /api/analytics/province/compare` — api/modules/analytics/routes.js:12
- `GET /api/analytics/dashboard` — api/modules/analytics/routes.js:13
- `GET /api/analytics/class/analysis` — api/modules/analytics/routes.js:15
- `GET /api/analytics/class/teacher-dashboard` — api/modules/analytics/routes.js:16
- `GET /api/analytics/class/detail` — api/modules/analytics/routes.js:17
- `POST /api/analytics/path` — api/modules/analytics/routes.js:14
- `POST /api/analytics/adaptive` — api/modules/analytics/routes.js:18
- `POST /api/analytics/reports` — api/modules/analytics/routes.js:19

### auth (3)
- `DELETE /api/auth/prefs/province` — api/modules/auth/routes.js:32
- `POST /api/auth/reset-password` — api/modules/auth/routes.js:14
- `POST /api/auth/guest` — api/modules/auth/routes.js:15

### exam (12)
- `GET /api/exam/papers` — api/modules/exam/routes.js:12
- `GET /api/exam/papers/:id` — api/modules/exam/routes.js:13
- `POST /api/exam/papers` — api/modules/exam/routes.js:14
- `GET /api/exam/questions/:paperId` — api/modules/exam/routes.js:16
- `POST /api/exam/questions` — api/modules/exam/routes.js:17
- `POST /api/exam/questions/batch` — api/modules/exam/routes.js:18
- `GET /api/exam/session/history` — api/modules/exam/routes.js:22
- `POST /api/exam/pdf/generate` — api/modules/exam/routes.js:25
- `POST /api/exam/pdf/generate/:paperId` — api/modules/exam/routes.js:27
- `POST /api/exam/generate` — api/modules/exam/routes.js:24
- `POST /api/exam/list` — api/modules/exam/routes.js:28
- `POST /api/exam/explain` — api/modules/exam/routes.js:29

### gamification (4)
- `POST /api/gamification/checkin` — api/modules/gamification/routes.js:6
- `GET /api/gamification/checkin/status` — api/modules/gamification/routes.js:7
- `GET /api/gamification/points/history` — api/modules/gamification/routes.js:8
- `GET /api/gamification/badges` — api/modules/gamification/routes.js:9

### knowledge (4)
- `GET /api/knowledge/mastery` — api/modules/knowledge/routes.js:17
- `GET /api/knowledge/mastery/:kpId` — api/modules/knowledge/routes.js:76
- `GET /api/knowledge/map` — api/modules/knowledge/routes.js:126
- `GET /api/knowledge/points` — api/modules/knowledge/routes.js:181

### rag (13)
- `DELETE /api/rag/questions/:id` — api/routes/rag-search.js:636
- `POST /api/rag/multi/upsert` — api/routes/rag-search.js:745
- `GET /api/rag/multi/questions/:question_id` — api/routes/rag-search.js:797
- `DELETE /api/rag/multi/questions/:question_id` — api/routes/rag-search.js:819
- `GET /api/rag/multi/stats` — api/routes/rag-search.js:841
- `POST /api/rag/graphrag/query` — api/routes/graphrag.js:88
- `POST /api/rag/graphrag/explain` — api/routes/graphrag.js:118
- `POST /api/rag/graphrag/similar-questions` — api/routes/graphrag.js:136
- `GET /api/rag/graphrag/knowledge-map` — api/routes/graphrag.js:156
- `GET /api/rag/graphrag/paper-source` — api/routes/graphrag.js:170
- `GET /api/rag/graphrag/admin/jobs` — api/routes/graphrag.js:186
- `GET /api/rag/graphrag/admin/stats` — api/routes/graphrag.js:198
- `POST /api/rag/graphrag/admin/reindex` — api/routes/graphrag.js:210

### review (5)
- `GET /api/review/reports` — api/modules/review/routes.js:14
- `GET /api/review/reports/:id` — api/modules/review/routes.js:60
- `GET /api/review/session/history` — api/modules/review/routes.js:99
- `GET /api/review/weak-points` — api/modules/review/routes.js:143
- `GET /api/review/trend-summary` — api/modules/review/routes.js:198

### srs (3)
- `GET /api/srs/engine/daily-tasks` — api/routes/srs-engine.js:123
- `POST /api/srs/engine/complete` — api/routes/srs-engine.js:206
- `GET /api/srs/engine/stats` — api/routes/srs-engine.js:334

### trends (4)
- `GET /api/trends/province/:code` — api/modules/trends/routes.js:8
- `GET /api/trends/province/compare` — api/modules/trends/routes.js:9
- `GET /api/trends/subject/:subject` — api/modules/trends/routes.js:10
- `GET /api/trends/expert-summary` — api/modules/trends/routes.js:11

### tutor (12)
- `GET /api/tutor/mastery/:kpId` — api/routes/tutor-agent.js:585
- `POST /api/tutor/loop/feedback` — api/routes/learning-loop.js:247
- `POST /api/tutor/loop/batch` — api/routes/learning-loop.js:320
- `GET /api/tutor/loop/mastery` — api/routes/learning-loop.js:388
- `GET /api/tutor/loop/graph` — api/routes/learning-loop.js:453
- `GET /api/tutor/graph/stats` — api/routes/knowledge-graph.js:12
- `POST /api/tutor/graph/sync` — api/routes/knowledge-graph.js:22
- `POST /api/tutor/graph/sync-back` — api/routes/knowledge-graph.js:32
- `GET /api/tutor/graph/search` — api/routes/knowledge-graph.js:42
- `GET /api/tutor/graph/file` — api/routes/knowledge-graph.js:60
- `GET /api/tutor/graph/list` — api/routes/knowledge-graph.js:95
- `POST /api/tutor/graph/reindex` — api/routes/knowledge-graph.js:120

### user (12)
- `POST /api/user/profile` — api/modules/user/routes.js:17
- `POST /api/user/subjects` — api/modules/user/routes.js:20
- `DELETE /api/user/subjects` — api/modules/user/routes.js:21
- `POST /api/user/initialize` — api/modules/user/routes.js:23
- `GET /api/user/list/subjects` — api/modules/user/routes.js:25
- `GET /api/user/list/provinces` — api/modules/user/routes.js:26
- `GET /api/user/wrong-questions` — api/modules/user/routes.js:28
- `PUT /api/user/wrong-questions/:id` — api/modules/user/routes.js:30
- `DELETE /api/user/wrong-questions/:id` — api/modules/user/routes.js:31
- `GET /api/user/wrong-questions/stats` — api/modules/user/routes.js:32
- `GET /api/user/wrong-questions/export` — api/modules/user/routes.js:33
- `POST /api/user/knowledge-mastery` — api/modules/user/routes.js:36

### vision (2)
- `POST /api/vision/search` — api/modules/vision/routes.js:14
- `GET /api/vision/knowledge-points` — api/routes/vision-parse.js:338
