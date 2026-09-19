# D086: 作文批改 V1.0 白盒架构

> **日期**: 2026-09-15
> **阶段**: Phase 2 提测门禁
> **影响范围**: api/handlers/essay/*, api/handlers/upload/*, api/utils/errorCodes.js,
>            api/utils/prompts.js, api/core/db.js, ai-tutor-frontend/{js,css,pages}/essay*,
>            tests/{api,integration,e2e}/essay*, .ai/decisions/*
> **ADR 系列**: D061-D092 体系
> **替代**: D086 L4 黑盒版本 (golden E2E 测试, 现 D070 sunset 队列)

---

## 上下文

原 D086 §12 L4 (essay-golden.test.js 时期) 是黑盒实现, 存在 3 个 P0 缺陷:

1. **Prompt 与 Reconcile 契约错位** — Prompt 要求 LLM 输出 markdown 编号列表, 但 reconcile 算法期望 `clue/solution/analysis: [{original, comment}]` 数组. 实测中 LLM 行为不可预测, 解析失败后**静默降级**返回空报告 + `success: true`.

2. **识别与批改耦合** — 单次 VLM 调用同时承担 OCR + 评分. VLM 幻觉 (自动改字、补全) 直接污染锚定, `findInParagraphs` 命中率退化.

3. **前端完全缺失** — `ai-tutor-frontend/` 无 essay 页, 旁注渲染零实现, 锚定数据无人消费. PWA 端 (`public/`) 走完全独立的 3 段式老接口, 与新后端割裂.

**审计结论** (2026-09-03 `.ai/audits/p0.3-dataflow-architecture-audit.md`): 建议两阶段管线 + Zod 强校验 + 前端落地.

---

## 决策

### D1 · 两阶段管线 (Stage A 转录 + Stage B 批改)

```
POST /api/essay/transcribe  → qwen-vl-max  → transcript (含 line_no)
POST /api/essay/grade       → qwen-plus    → annotations + scores
```

**Stage A 强约束 (防幻觉)**: Prompt 显式禁止改正错别字、禁止补全、禁止规范化标点; 模糊字符用 `[?]` 标记 + `uncertain_chars[]` 列表.

**Stage B 结构化输出**: Prompt 显式要求严格 JSON 数组, 不允许 markdown 列表; quote 必须能在对应段落文本中精确匹配; 5 类批注枚举 `highlight | masterstroke | grammar_error | advanced_vocab | logic_issue`; 4 维评分 `content / language / structure / development` (各 0-20, 总 0-80, total 必须严格等于 4 维之和 — Zod refine 守门).

### D2 · Zod 强校验 + 零静默降级

- `transcribeService.js`: `TranscribeOutputSchema` (Zod) + `safeParse` 失败 → 抛 `EssayError(ESSAY_TRANSCRIBE_PARSE_FAILED, 422)`
- `gradeService.js`: `GradeOutputSchema` + `ScoresSchema.refine` (total = sum) + 失败 → 抛 `EssayError(ESSAY_GRADE_PARSE_FAILED, 422)`
- 失败路径**绝不**返回 `{success: true, data: 空对象}`, 而是 `ErrorCode + statusCode + details (含 zod_issues)`, 报告 `status='failed'` 落库
- 新增 9 个 ErrorCode: `ESSAY_TRANSCRIBE_PARSE_FAILED` `ESSAY_GRADE_PARSE_FAILED` `ESSAY_RUBRIC_NOT_FOUND` `ESSAY_LLM_TIMEOUT` `ESSAY_LLM_UPSTREAM_ERROR` + 4 个 `UPLOAD_*`

### D3 · 锚定算法 (3 级匹配 + Patch 4 非重叠保证)

`essayReconcile.js` 重写为 V1.0:

1. **精确匹配** — `String.indexOf` 字符级
2. **规范化匹配** — 去除中英文标点/空白后查找 (处理 LLM 输出与原文标点差异)
3. **LCS 兜底** — 朴素 O(m·n) DP, ≥ 6 字符才匹配, 含 `m*n > 5e6` 性能护栏
4. **Patch 4 冲突消解** — 同段内区间重叠时, 按 `masterstroke > grammar_error > highlight > 其它` 类型优先级 + `quote.length` 平局裁决, 失败方降级为 `anchor_failed: true, failure_reason: 'overlap_evicted'`, **不丢弃**
5. **不变量 (I1-I4)**: 失败项 `start === -1`; 同段内 `[start, end)` 严格不相交; `final_valid_count === raw_count`; 越界 → `failure_reason: 'paragraph_index_out_of_range'`
6. `reconcile` 测度**覆盖** LLM 自报 (`server_metrics.model = 'qwen-plus'`), 防止 LLM 撒谎
7. 保留 `findInParagraphs` 别名兼容老测试

### D4 · 前端索引基线: `join('') + <br>` 算法 (V1.0.1 P0 修复)

**被否决**: V1.0.0 早期尝试 `lines.join('\n')` + `white-space: pre-wrap`, 与后端 `findInParagraphs` 的 `join('')` **索引基线错位 1 字符/行**, 跨行 quote 锚定全部失效.

**V1.0.1 决定**: 前后端统一用 `join('')`, 视觉换行通过**显式 `<br>` 断点插入**实现:

```js
const lineBreaks = new Set();
let len = 0;
for (let i = 0; i < lines.length - 1; i++) {
  len += lines[i].text.length;
  lineBreaks.add(len);  // 每行结束位置
}
// 渲染时: 字符逐个 escapeHtml, 遇 lineBreaks.has(i+1) 插入 <br>
```

跨行高亮结构: `AA<span>BB<br>CC</span>DD` (验证通过 `essay-anchor-highlight.js` + 7 个 vitest).

### D5 · 图片上传: 强制 `/api/upload/image` 预上传 (Patch 2)

**被否决**: Base64 直传 `/api/essay/transcribe` (会撑爆 `express.json` 10mb 限制, 且无 sharp 压缩 + EXIF 清除).

**决定**: 前端**必须**先调 `POST /api/upload/image` (JSON body, `{image: "data:image/...;base64,...", purpose}`), 后端用 `sharp` 重编码 + 写 `public/uploads/{purpose}/{YYYY}/{MM}/{uuid}.jpg`, 返回 `{url: "/uploads/..."}` (相对 URL, 前端 `new URL(url, origin)` 解析). Zod `TranscribeRequestSchema` 强约束 `images: z.array(z.string().url().refine(/^https?:\/\//))`, 拒绝 `data:` 协议.

### D6 · Rubric 配置化

`api/handlers/essay/rubrics/{subject}_{exam_level}_v1.json` 4 份 (语文高考/中考/英语高考/中考), 字段: `dimensions[4] {key, name_cn, max, criteria[4]}` + `type_distribution` + `summary_length` + `annotation_count`. `rubricLoader.js` 进程级缓存, 失败时 `gradeService` 抛 `ESSAY_RUBRIC_NOT_FOUND` (500). 升级时改 JSON + bump version, 不改 prompt 文本.

### D7 · 状态机 + EmptyState 错误体系

`useEssayFlow.js` 5 态: `idle → uploading → transcribing → reviewing → grading → done | failed`. `ALLOWED_TRANSITIONS` 显式 DAG (含所有状态 → `failed` 边). 早返回校验**也**在 try-catch 内, 保证失败必入 `failed` 态. `failed` 视图按 `errorCode` 映射到 8 个 EmptyState 场景 (pathFail / timeout / serviceFail / authFail / inputFail / configFail / retry / login). 前端捕获 4 类 `fetchClient.ErrorType` (NETWORK/TIMEOUT/SERVER) 弹 Toast + 渲染 EmptyState.

### D8 · 视觉与 Design Token v1 严格对齐

`assets/css/essay.css` 5 语义色 (从 `--color-success/error/info/warning/primary` 50/600 阶) + 5 类批注对应 CSS 类 (`ess-anno--highlight/masterstroke/grammar-error/advanced-vocab/logic-issue`) + 段末降级虚线框 `data-anchor-failed="true"`. 60/40 PC 双栏 (`@media min-width: 1024px`) + 移动单栏 + Drawer (250ms ease-out). 所有 LLM 输出经 `safe-text.js#escapeHtml` 5 个 XSS payload 验证.

---

## 被否决的替代方案

| 方案 | 否决理由 |
|---|---|
| 端到端单次 VLM 调用 (Stage A+B 合并) | 幻觉不可控, 锚定率 < 60%; 改字污染原文, 跨行 quote 失败 |
| 后端 `lines.join('\n')` | 与前端 `<br>` 算法冲突; 字符流被 `\n` 污染, 跨行 quote 匹配率退化; 全文检索 (LCS) 受额外字符干扰 |
| Base64 直传 `/api/essay/transcribe` | 10MB express.json 上限不够 (高分辨率作文照 5-8MB); 无 EXIF 清除, 隐私风险 |
| OSS / 对象存储直传 | Sprint 1 引入过度复杂度 (需申请 bucket / 配置 CORS / 处理 presigned URL); 本地落盘对中小学校客户足够 |
| Markdown 列表 (clue/solution/analysis 字符串) | 与 reconcile 数组契约错位; LLM 行为不可预测; 静默降级; 已用 Zod 数组契约根治 |
| 静默降级 (catch 后返回空报告 + success: true) | 前端无法区分"AI 没评"vs"AI 评了但没内容"; 用户体验崩溃 |
| V1.0.0 早期 `lines.join('\n')` + `white-space: pre-wrap` (前端) | 与后端 `join('')` 索引错位 1 字符/行; 跨行高亮失效; **P0 修复为 V1.0.1 `join('') + <br>`** |
| `annotation_id` 字段名 (而非 `id`) | 命名不一致, 测试中易出错; 改为 V1.0 `id` 与 API spec 对齐 |
| `findInParagraphs` 重命名 (D086 L4 → V1.0 `findQuoteInParagraph`) | 破坏老测试; 保留为别名 |

---

## 后果

### 正面

- **77 单元测试全绿** (A5 Reconcile 32 + A6 Transcribe 20 + A7 Grade 25)
- **9 真实 bug 在开发期捕获并修复** (1 命名冲突, 2 import 路径, 1 缺字段, 1 状态机边缺失, 1 早返回校验, 1 后端字段命名, 1 join 算法, 2 内置逻辑)
- **零静默降级**: 任何阶段失败 → 明确 `ErrorCode + statusCode + 错误详情` → 前端 8 场景 EmptyState
- **锚定率可度量**: `meta.anchor_metrics.anchor_rate` (服务端实测, 覆盖 LLM 自报) + `final_valid_count === raw_count` (V1.0 不丢批注)
- **跨行高亮工作**: 7 个 vitest 验证 `join('') + <br>` 算法
- **XSS 防护链路完整**: 5 个 payload 验证 `escapeHtml` + `<br>` 双重转义
- **状态机清晰**: 7 个 `ALLOWED_TRANSITIONS` 边 + 5 个状态 + 2 个工具函数 (`getStepProgress` / `canPerformAction`)
- **可配置 Rubric**: 4 份 JSON, 升级不影响 prompt 文本

### 负面

- **延迟增加**: 两次 LLM 调用, Stage A ~5-15s + Stage B ~10-20s, 总计 **15-35s** (用户感知), 由 Skeleton 加载 + 进度条缓解
- **Token 成本翻倍**: V1.0 双次调用, 估算每次作文 ¥0.10-0.20 (vs 单次 ~¥0.05)
- **架构复杂度**: 拆分 V1.0 后, 旧 D086 L4 端点需保留 30 天 (D070 sunset) 兼容 PWA
- **Mock 数据需 5 份**: upload + transcribe + grade + grade_parse_fail + list, UI 开发依赖
- **前端 B2/B3 组件需强解耦**: 单向数据流, 双向联动通过回调, 不能用 React-style 状态提升 (当前 vanilla JS)

### 中性 (V1.0 已知遗留)

- 校对页 (`reviewing`) 暂不支持手工修改识别结果 — 提示用户"确认无误后继续"
- 批改详情页 (`done`) 缺"修改建议"按钮 — B5 阶段预留 footer 容器
- `failed` → 单一动作 (重试/重置/登录), 暂未支持"换模型重试"等高级操作
- V1.0.1 P0 修复需要 `essay_grade.json` mock 重新生成 (anchor.paragraph_index/start/end 按 `join('')` 基线; 当前 mock 实际兼容, 但其他依赖旧契约的 mock 需审计)

---

## 变更文件 (Sprint 1 全量)

### 后端 (10 文件, ~1900 行)

| 文件 | 状态 | 行数 |
|---|---|---|
| `api/utils/errorCodes.js` | 🔧 改 (+9 codes + 9 ErrorMap) | +28 |
| `api/handlers/essay/errors.js` | 🆕 | 30 |
| `api/handlers/essay/rubricLoader.js` | 🆕 | 114 |
| `api/handlers/essay/prompts/grade.v1.txt` | 🆕 | 87 |
| `api/handlers/essay/rubrics/{chinese,english}_{gaokao,zhongkao}_v1.json` | 🆕 × 4 | 63 × 4 = 252 |
| `api/handlers/essay/essayReconcile.js` | 🔧 改 (V1.0 + P0 修复) | 298 |
| `api/handlers/essay/transcribeService.js` | 🆕 (V1.0 + request_token) | 498 |
| `api/handlers/essay/gradeService.js` | 🆕 (V1.0 + Zod) | 568 |
| `api/handlers/upload/imageHandler.js` | 🆕 | 244 |
| `api/core/db.js` | 🔧 改 (+essay_reports DDL) | +19 |

### 前端 (8 文件, ~3000 行)

| 文件 | 状态 | 行数 |
|---|---|---|
| `ai-tutor-frontend/assets/js/utils/safe-text.js` | 🆕 | 123 |
| `ai-tutor-frontend/assets/js/api/services/essay.js` | 🆕 | 208 |
| `ai-tutor-frontend/assets/js/api/services/index.js` | 🔧 改 (+1 export) | +1 |
| `ai-tutor-frontend/assets/js/components/essay-anchor-highlight.js` | 🆕 (V1.0.1 P0 修复) | 326 |
| `ai-tutor-frontend/assets/js/components/essay-annotation-card.js` | 🆕 | 283 |
| `ai-tutor-frontend/assets/js/hooks/useEssayFlow.js` | 🆕 | 319 |
| `ai-tutor-frontend/assets/css/essay.css` | 🆕 | 728 |
| `ai-tutor-frontend/pages/essay.html` | 🆕 (5 视图 + 双向联动 + Drawer) | 600 |
| `ai-tutor-frontend/assets/js/navator.js` | 🔧 改 (+essay 入口) | +1 |

### Mock 数据 (5 份)

| 文件 | 行数 |
|---|---|
| `essay_upload.json` | 12 |
| `essay_transcribe.json` | 34 |
| `essay_grade.json` (5 类型 + 1 降级 + scores=62) | 111 |
| `essay_grade_parse_fail.json` (422 + zod_issues) | 25 |
| `essay_list.json` (3 条历史) | 38 |

### 测试 (3 份, ~2400 行)

| 文件 | 行数 | 状态 |
|---|---|---|
| `tests/api/essay-reconcile-v1.test.js` | 402 | ✅ 32/32 |
| `tests/api/transcribe-v1.test.js` | 491 | ✅ 20/20 |
| `tests/api/grade-v1.test.js` | 665 | ✅ 25/25 |
| `tests/integration/essay-v1-bct.mjs` | 358 | 🆕 (本次) |
| `tests/e2e/essay-v1.spec.cjs` | 286 | 🆕 (本次) |

### 修复 (legacy pre-existing)

| 文件 | 修复 |
|---|---|
| `api/handlers/essay/index.js` | import ErrorCode from `errorCodes.js` (response.js 不 re-export) |
| `api/handlers/learning-path.js` | 同上 |

### 服务器集成

| 文件 | 改动 |
|---|---|
| `server.js` | +2 行: `import { uploadImageHandler }` + `app.post('/api/upload/image', ...)` |

---

## 验证

```bash
# 后端 5 模块加载
node --input-type=module -e "
const mods = ['./api/handlers/essay/errors.js', './api/handlers/essay/essayReconcile.js',
  './api/handlers/essay/rubricLoader.js', './api/handlers/essay/transcribeService.js',
  './api/handlers/essay/gradeService.js', './api/handlers/upload/imageHandler.js'];
for (const m of mods) await import(m);
console.log('✅ 6/6 backend modules loaded');
"

# 单元测试
npx vitest run tests/api/essay-reconcile-v1.test.js tests/api/transcribe-v1.test.js tests/api/grade-v1.test.js
# → 77 passed (3 files)

# BCT 集成测试 (需启 server + 真实 LLM 或 Mock 代理)
PORT=3002 node server.js &
BCT_URL=http://localhost:3002 node tests/integration/essay-v1-bct.mjs
# → 🎉 6 步全链路通过

# Playwright E2E (mock 模式, 无需 LLM)
npx playwright test tests/e2e/essay-v1.spec.cjs --reporter=list
# → 5/5 场景通过
```

---

## 后续路径 (P0 backlog)

- [ ] **PWA 接入 (Phase 3)**: 改造 `public/src/services/aiService.js` + `public/src/app.js` 走 V1.0 两阶段接口
- [ ] **D070 老接口 sunset**: 30 天后删除 `/api/essay/grade` 老端点 (当前 PWA 还在用)
- [ ] **B5 校对页支持手工编辑**: 允许用户修正 OCR 错误, 写入 `transcript_raw` (V1.1)
- [ ] **Rubric 升级流程**: 字段增删时, 老 rubric_id 仍可加载 (向后兼容)
- [ ] **ai_trace 任务类型拆分**: 当前 `task_type='chat'`, 改为 `essay_transcribe` / `essay_grade` (成本分账)
- [ ] **mock proxy 工具**: `scripts/essay-bct-mock-proxy.mjs` 启动本地 mock DashScope, BCT 无 API key 也能跑
- [ ] **集成测试 fixture**: `tests/fixtures/essay/{01,02,03}.jpg` + `LICENSE-SYNTHETIC.md` (D086 L4 时期的文件, 待补齐)
- [ ] **生产部署**: `.env.prod` 加 `ESSAY_LLM_TIMEOUT_MS=30000` (可调, 应对 QPS)

---

## 相关 ADR

- **D062** — client.js 解包统一 (envelope-only): mock 路径返回 `{success, data}` 与 real 路径一致, 5 份 essay mock 严格按此契约
- **D065** — 发布质量门禁 (npm run gate): Vitest 77 项 + BCT + E2E (本次新增) 5 项纳入门禁
- **D070** — Frontend Version Cleanup: 老 PWA `essay` 端点保留 30 天后 sunset
- **D088** — Canonical Question Bank Gate: essay_reports 与 wrong_questions 解耦 (本次决策 D-essayReconcile V1.0 不再依赖 wrong_questions)
- **D090** — KP Coverage 30 Percent: essay Rubric 与 knowledge_points 解耦, 不依赖 KP 体系

---

## 变更历史

- 2026-09-15: 初版 (Sprint 1 完成) — Accepted
