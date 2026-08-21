# Dead Backend 端点引用扫描 — 2026-08-20

**生成时间**: 2026-08-20T16:35:01.475Z
**总 dead backend**: 32
**真 0 引用 (可安全删除)**: 0
**有引用 (需 review)**: 32

## 决策
- **refCount = 0**: 真 0 引用, 可安全删 routes.js 端点 (4-5 行, 减 dead code)
- **refCount > 0**: 可能是 docstring / 注释 / mock 引用, 需逐个看 snippet 决定
- **清理方式**: 删 routes.js 端点 (不影响子 router, 不动 handler 文件)

## 真死 (0 引用, 可安全删)

## 有引用 (需 review)

### `DELETE /api/auth/prefs/province`
- 后端: api/modules/auth/routes.js:32
- 引用 (3 处):
  - `ai-tutor-frontend/assets/js/api/services/user.js:39` `// 2026-08-20 DSH: 之前 /api/user/user-province 404, 后端真端点是 /api/auth/prefs/provin`
  - `ai-tutor-frontend/assets/js/api/services/user.js:41` `return request('GET', '/api/auth/prefs/province', null, { mockName: 'user_userpr`
  - `ai-tutor-frontend/assets/js/api/services/user.js:45` `return request('POST', '/api/auth/prefs/province', { province_code: provinceCode`

### `POST /api/auth/guest`
- 后端: api/modules/auth/routes.js:15
- 引用 (3 处):
  - `api/modules/auth/routes.js:16` `router.use('/guest-login', guestLoginRouter); // 别名: F3 service 调 /api/auth/gues`
  - `ai-tutor-frontend/assets/js/api/services/auth.js:24` `const res = await request('POST', '/api/auth/guest-login', null, { mockName: 'au`
  - `scripts/audit/probe-routes.sh:5` `TOKEN=$(curl -sS -X POST http://localhost:3002/api/auth/guest-login \`

### `GET /api/exam/papers`
- 后端: api/modules/exam/routes.js:12
- 引用 (1 处):
  - `ai-tutor-frontend/assets/js/api/services/exam.js:74` `return request('GET', `/api/exam/papers?${params}`, null, { mockName: 'exam_pape`

### `POST /api/exam/papers`
- 后端: api/modules/exam/routes.js:14
- 引用 (1 处):
  - `ai-tutor-frontend/assets/js/api/services/exam.js:74` `return request('GET', `/api/exam/papers?${params}`, null, { mockName: 'exam_pape`

### `POST /api/exam/questions`
- 后端: api/modules/exam/routes.js:16
- 引用 (2 处):
  - `ai-tutor-frontend/assets/js/api/services/exam.js:15` `return request('GET', `/api/exam/questions?${params}`, null, { mockName: 'exam_q`
  - `ai-tutor-frontend/assets/js/api/services/exam.js:19` `return request('GET', `/api/exam/questions/${id}`, null, { mockName: 'exam_quest`

### `POST /api/exam/pdf/generate`
- 后端: api/modules/exam/routes.js:21
- 引用 (2 处):
  - `ai-tutor-frontend/assets/js/api/services/exam.js:41` `// 2026-08-20 DSH: 之前 GET /api/exam-pdf/ (audit 404), 改 POST /api/exam/pdf/gener`
  - `ai-tutor-frontend/assets/js/api/services/exam.js:47` `const res = await fetch(base + '/api/exam/pdf/generate/' + encodeURIComponent(pa`

### `POST /api/exam/pdf/generate/:paperId`
- 后端: api/modules/exam/routes.js:23
- 引用 (1 处):
  - `ai-tutor-frontend/assets/js/api/services/exam.js:41` `// 2026-08-20 DSH: 之前 GET /api/exam-pdf/ (audit 404), 改 POST /api/exam/pdf/gener`

### `GET /api/knowledge/mastery`
- 后端: api/modules/knowledge/routes.js:17
- 引用 (3 处):
  - `api/modules/knowledge/routes.js:10` `* GET /api/knowledge/mastery`
  - `api/modules/knowledge/routes.js:72` `* GET /api/knowledge/mastery/:kpId`
  - `ai-tutor-frontend/assets/js/api/services/knowledge.js:7` `return request('GET', `/api/knowledge/mastery${q}`, null, { mockName: 'knowledge`

### `GET /api/knowledge/mastery/:kpId`
- 后端: api/modules/knowledge/routes.js:76
- 引用 (1 处):
  - `api/modules/knowledge/routes.js:72` `* GET /api/knowledge/mastery/:kpId`

### `GET /api/knowledge/map`
- 后端: api/modules/knowledge/routes.js:126
- 引用 (2 处):
  - `api/modules/knowledge/routes.js:122` `* GET /api/knowledge/map`
  - `ai-tutor-frontend/assets/js/api/services/knowledge.js:16` `return request('GET', `/api/knowledge/map${q}`, null, { mockName: 'knowledge_map`

### `GET /api/knowledge/points`
- 后端: api/modules/knowledge/routes.js:181
- 引用 (3 处):
  - `api/modules/knowledge/routes.js:177` `* GET /api/knowledge/points`
  - `ai-tutor-frontend/assets/js/api/services/knowledge.js:21` `return request('GET', `/api/knowledge/points${q}`, null, { mockName: 'knowledge_`
  - `tests/backend-contract.test.js:151` `const r = await call('GET', '/api/knowledge/points', A);`

### `DELETE /api/rag/questions/:id`
- 后端: api/routes/rag-search.js:636
- 引用 (1 处):
  - `api/routes/rag-search.js:634` `* DELETE /api/rag/questions/:id — 删除已入库题目`

### `POST /api/rag/multi/upsert`
- 后端: api/routes/rag-search.js:745
- 引用 (1 处):
  - `api/routes/rag-search.js:743` `* POST /api/rag/multi/upsert — 插入/更新四向量数据`

### `GET /api/rag/multi/questions/:question_id`
- 后端: api/routes/rag-search.js:797
- 引用 (2 处):
  - `api/routes/rag-search.js:795` `* GET /api/rag/multi/questions/:question_id — 获取题目四向量详情`
  - `api/routes/rag-search.js:817` `* DELETE /api/rag/multi/questions/:question_id — 删除题目四向量记录`

### `DELETE /api/rag/multi/questions/:question_id`
- 后端: api/routes/rag-search.js:819
- 引用 (2 处):
  - `api/routes/rag-search.js:795` `* GET /api/rag/multi/questions/:question_id — 获取题目四向量详情`
  - `api/routes/rag-search.js:817` `* DELETE /api/rag/multi/questions/:question_id — 删除题目四向量记录`

### `GET /api/rag/multi/stats`
- 后端: api/routes/rag-search.js:841
- 引用 (1 处):
  - `api/routes/rag-search.js:839` `* GET /api/rag/multi/stats — 获取四向量表统计信息`

### `GET /api/review/reports`
- 后端: api/modules/review/routes.js:14
- 引用 (3 处):
  - `api/modules/review/routes.js:10` `* GET /api/review/reports`
  - `api/modules/review/routes.js:57` `* GET /api/review/reports/:id`
  - `ai-tutor-frontend/assets/js/api/services/review.js:6` `return request('GET', `/api/review/reports?page=${page}&page_size=${pageSize}`, `

### `GET /api/review/reports/:id`
- 后端: api/modules/review/routes.js:60
- 引用 (1 处):
  - `api/modules/review/routes.js:57` `* GET /api/review/reports/:id`

### `GET /api/review/session/history`
- 后端: api/modules/review/routes.js:99
- 引用 (3 处):
  - `api/modules/review/routes.js:95` `* GET /api/review/session/history`
  - `ai-tutor-frontend/assets/js/api/services/review.js:14` `return request('GET', `/api/review/session/history?limit=${limit}`, null, { mock`
  - `tests/backend-contract.test.js:129` `const r = await call('GET', '/api/review/session/history?limit=5', A);`

### `GET /api/review/weak-points`
- 后端: api/modules/review/routes.js:143
- 引用 (3 处):
  - `api/modules/review/routes.js:136` `* GET /api/review/weak-points`
  - `ai-tutor-frontend/assets/js/api/services/review.js:19` `return request('GET', `/api/review/weak-points${q}`, null, { mockName: 'review_w`
  - `tests/backend-contract.test.js:125` `const r = await call('GET', '/api/review/weak-points', A);`

### `GET /api/review/trend-summary`
- 后端: api/modules/review/routes.js:198
- 引用 (3 处):
  - `api/modules/review/routes.js:194` `* GET /api/review/trend-summary`
  - `ai-tutor-frontend/assets/js/api/services/review.js:23` `return request('GET', `/api/review/trend-summary?days=${days}`, null, { mockName`
  - `tests/backend-contract.test.js:133` `const r = await call('GET', '/api/review/trend-summary?days=30', A);`

### `GET /api/trends/expert-summary`
- 后端: api/modules/trends/routes.js:8
- 引用 (1 处):
  - `frontend/redesign/trends-analysis.html:451` `var response = await fetch(`/api/trends/expert-summary?province=${province}&subj`

### `GET /api/tutor/mastery/:kpId`
- 后端: api/routes/tutor-agent.js:585
- 引用 (2 处):
  - `api/routes/tutor-agent.js:583` `* GET /api/tutor/mastery/:kpId — 查询学生对某知识点的掌握度`
  - `ai-tutor-frontend/assets/js/api/services/tutor.js:156` `// async getMastery(kpId) { ... }   → GET /api/tutor/mastery/:kpId`

### `POST /api/user/profile`
- 后端: api/modules/user/routes.js:17
- 引用 (2 处):
  - `ai-tutor-frontend/assets/js/api/services/user.js:49` `return request('GET', '/api/user/profile', null, { mockName: 'user_profile' });`
  - `frontend/redesign/login.html:700` `var response = await fetch('/api/user/profile', {`

### `POST /api/user/subjects`
- 后端: api/modules/user/routes.js:20
- 引用 (1 处):
  - `ai-tutor-frontend/assets/js/api/services/user.js:53` `return request('GET', '/api/user/subjects', null, { mockName: 'user_subjects' })`

### `DELETE /api/user/subjects`
- 后端: api/modules/user/routes.js:21
- 引用 (1 处):
  - `ai-tutor-frontend/assets/js/api/services/user.js:53` `return request('GET', '/api/user/subjects', null, { mockName: 'user_subjects' })`

### `POST /api/user/initialize`
- 后端: api/modules/user/routes.js:23
- 引用 (1 处):
  - `frontend/redesign/onboarding.html:545` `var response = await fetch('/api/user/initialize', {`

### `GET /api/user/wrong-questions`
- 后端: api/modules/user/routes.js:25
- 引用 (3 处):
  - `ai-tutor-frontend/assets/js/api/services/wrong.js:18` `return request('GET', `/api/user/wrong-questions?${params}`, null, { mockName: '`
  - `ai-tutor-frontend/assets/js/api/services/wrong.js:27` `return request('DELETE', '/api/user/wrong-questions/' + id, { mockName: 'wrong_d`
  - `ai-tutor-frontend/assets/js/api/services/wrong.js:43` `return request('POST', '/api/user/wrong-questions', payload, { mockName: 'wrong_`

### `GET /api/user/wrong-questions/stats`
- 后端: api/modules/user/routes.js:28
- 引用 (1 处):
  - `frontend/redesign/wrong-book.html:312` `var response = await fetch('/api/user/wrong-questions/stats');`

### `GET /api/user/wrong-questions/export`
- 后端: api/modules/user/routes.js:29
- 引用 (1 处):
  - `frontend/redesign/wrong-book.html:485` `var url = '/api/user/wrong-questions/export';`

### `POST /api/vision/search`
- 后端: api/modules/vision/routes.js:14
- 引用 (1 处):
  - `frontend/redesign/photo-search.html:388` `var response = await fetch('/api/vision/search', {`

### `GET /api/vision/knowledge-points`
- 后端: api/routes/vision-parse.js:338
- 引用 (3 处):
  - `api/modules/vision/routes.js:11` `// 修正后: POST /api/vision/parse, GET /api/vision/knowledge-points`
  - `api/routes/vision-parse.js:336` `* GET /api/vision/knowledge-points — 获取可用知识点列表（供前端下拉选择）`
  - `ai-tutor-frontend/assets/js/api/services/vision.js:9` `//   GET  /api/vision/knowledge-points?subject= → data: {items: [{id,name,subjec`

