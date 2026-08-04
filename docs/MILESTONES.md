# aitutor Milestones — v0.6.0-dev 基线 (2026-08-04)

> **基线 Tag**: `v0.6.0-dev` — Frontend F2 完 + RAG P3 端到端 (Ollama + pgvector 768 dim).
> **下一阶段**: F3 Feature Migration (10 page) + 推 GitHub mirror.
> **GitHub Mirror**: 等 credentials 后同步 (`gh` CLI / PAT).

---

## v0.5.0-dev (2026-08-01, 历史基线)

### ✅ Done
- [x] **Extraction** (题库分析项目): 3,819 docx → 3,120 schema v5 ok + 699 fail (.doc 老格式)
- [x] **RAG Pipeline v0.5**: 1,711 schema v5 → 0 失败 + 0 timeout
- [x] **Frontend F1 Foundation** (ai-tutor-frontend/): 5 CSS + 12 JS + 1 demo
- [x] **.gitignore 完整** (RAG / 测试缓存 / IDE / OS)
- [x] **Tag v0.5.0-dev**

---

## v0.6.0-dev (当前, 2026-08-04)

### ✅ Done
- [x] **F1.17 demo bug fix** (mock lazy check + stat placeholder + dark theme)
- [x] **F2 Service Layer 强化** (F2.1 + F2.3 + F2.4-2.6 全部完):
  - client.js retry (5xx+network, 3 次) + timeout (10s) + silent opt
  - **Contract Test 39/39 全过** (7 services 全部端点)
  - Playwright E2E 2/2 (mock dashboard + 真实 API 失败)
  - USE_MOCK toggle UI (LS 持久化)
  - demo index.html (mock 模式 + 暗色主题 + 4 stat 卡片)
- [x] **automation**: Makefile + scripts/automation/ (push_all + lint + install_hooks) + git hooks
- [x] **P3 RAG ingest pipeline** (Ollama + pgvector 768 dim):
  - 1,711 schema v5 → rag_questions (~17k 题, 估 18 min ingest)
  - pgvector 官方容器 (pgvector/pgvector:pg15) + migration 005
  - Ollama nomic-embed-text (137MB) 调 /api/embeddings
  - embedding.js 加 ollama provider (3 选 1: local/ollama/remote)
  - 内容 + 子题都 ingest, content_hash dedup, 进度跟踪
  - similarity search 验证 (cosine <=>, sim 0.82-0.88 同主题)
- [x] **docs/P3_RAG_INGEST.md** (P3 完整流程留档)
- [x] **tag v0.6.0-dev** (新基线)

### 📊 数据
- **代码量**: ~30 commits + 1 tag (v0.5.0-dev) + 1 tag (v0.6.0-dev) + automation
- **RAG**: 1,711 schema v5 → GraphRAG (8,723 md / 17,861 chunks) + pgvector (~17k 题, 768 dim)
- **Frontend**: F1 Foundation + F2 Service Layer 完
- **Tests**: Contract 39/39, E2E 2/2, lint 0 错

---

## v0.6 (下一阶段, Frontend 完整迁移 + RAG 接入)

> **目标**: ai-tutor-frontend/ 取代 frontend/ 作主前端, 完整接后端 24 handlers + RAG.
> **周期**: 2 人并联 10 天 / 1 人 16.5 天.

### Phase F2: Service Layer 强化
- [ ] F2.1: 7 service 错误处理 + 重试 + timeout
- [ ] F2.2: Mock 数据完整覆盖 (已 37 个, 验)
- [ ] F2.3: **Contract Test 20 端点** (防后端字段变更, 关键 ROI)
- [ ] F2.4: Playwright config 完整
- [ ] F2.5: Playwright 1 E2E (login → dashboard)
- [ ] F2.6: USE_MOCK 切换测试
- [ ] F2.7: 错误处理 toast 测试

### Phase F3: Feature Migration (按 User Journey)
- [ ] F3.1: Auth (login.html + register.html)
- [ ] F3.2: Dashboard (dashboard.html)
- [ ] F3.3: Question (in dashboard)
- [ ] F3.4: Tutor (tutor.html)
- [ ] F3.5: WrongBook (wrong-book.html)
- [ ] F3.6: Review + Mastery (review.html + mastery.html)
- [ ] F3.7: Exam Simulation (exam-simulation.html)

### Phase F4: Vision Epic (独立并联)
- [ ] F4.1: vision.html 调 vision.parse / vision.ingest
- [ ] F4.2: 图片上传 (drag-drop + click)
- [ ] F4.3: OCR 结果显示
- [ ] F4.4: 解析后入库
- [ ] F4.5: Vision E2E
- [ ] F4.6: 错误处理

### Phase F5: Testing
- [ ] F5.1: Playwright 10 page 截图
- [ ] F5.2: Playwright 关键 E2E flow
- [ ] F5.3: API Contract Test 20+ 端点
- [ ] F5.4: Lighthouse Performance > 85
- [ ] F5.5: Visual Regression
- [ ] F5.6: Mock 数据一致性
- [ ] F5.7: 跨浏览器

### Phase F6: Cutover (Freeze)
- [ ] F6.1: server.js 静态根 (主 + /legacy)
- [ ] F6.2: 归档 ai-tutor-redesign
- [ ] F6.3: package.json scripts
- [ ] F6.4: README 更新
- [ ] F6.5: git tag v0.6.0
- [ ] F6.6: frontend/ 加 DEPRECATED.md
- [ ] F6.7: 删 /redesign 配

---

## v0.7 (远期, GraphRAG 重建 + AGE+pgvector 自定义镜像 + RAG 完整接入)

- [ ] RAG ingest 完整: 1,711 schema v5 → pgvector (进行中, P3 v0.6)
- [x] ~~pgvector 官方镜像 (P3 选了, B 路径)~~
- [ ] Apache AGE + pgvector 自定义镜像 (A1, 15 min build)
- [ ] knowledge_point_id 反查关联 (KP map)
- [ ] difficulty 字段从 quality.confidence 推
- [ ] ivfflat → HNSW 索引切换 (10K+ 后)
- [ ] GraphRAG CLI 重建 gaokao_all 索引 (LLM 限速, ~30 小时)
- [ ] ES bulk 导入 (es/*.bulk.jsonl, 修 export_all bug)
- [ ] frontend/ 观察 2-3 周后归档

---

## v1.0 (Release, 长期)

- [ ] 10 page 全部 RAG-enhanced
- [ ] RAG search 走 pgvector (10ms 响应)
- [ ] Vision 完整 OCR pipeline
- [ ] 31 省 + 全国卷 + 新高考 完整覆盖
- [ ] 用户管理 + 进度追踪
- [ ] Tutor Agent (已有, 集成)

---

## 标签 / Release 命名

| Tag | 含义 | 日期 |
|-----|------|------|
| `v0.5.0-dev` | RAG pipeline + Frontend F1 基线 | 2026-08-01 |
| `v0.5.0` | v0.5 正式 (稳定 RAG + GraphRAG 接入) | TBD |
| `v0.6.0-dev` | Frontend F2 + RAG P3 端到端 (Ollama + pgvector 768 dim) | 2026-08-04 |
| `v0.6.0` | v0.6 正式 (Frontend F1-F3 + P3) | TBD |
| `v0.7.0` | GraphRAG + AGE + RAG 后端完整 | TBD |
| `v1.0.0` | Release | TBD |

---

## GitHub Milestone 同步

等 GitHub credentials (gh CLI / PAT / SSH) 后:
1. 登录 gh: `gh auth login`
2. 创建 milestone: `gh milestone create --title "v0.6" --due-date "..." --description "..."`
3. 创建 issue: `gh issue create --milestone "v0.6" --title "..." --body "..."`
4. PR 关联: `gh pr create --milestone "v0.6" --title "..."`

**当前状态**: GitHub mirror 未推, uibe 为主.
