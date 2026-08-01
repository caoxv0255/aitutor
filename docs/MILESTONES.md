# aitutor Milestones — v0.5.0-dev 基线 (2026-08-01)

> **基线 Tag**: `v0.5.0-dev` — RAG pipeline + Frontend F1 Foundation 完.
> **下一阶段**: Frontend F2-F6 迁移 + RAG 接入 + GraphRAG 重建.
> **GitHub Mirror**: 等 credentials 后同步 (`gh` CLI / PAT).

---

## v0.5.0-dev (当前, 2026-08-01)

### ✅ Done
- [x] **Extraction** (题库分析项目): 3,819 docx → 3,120 schema v5 ok + 699 fail (.doc 老格式)
- [x] **RAG Pipeline v0.5**: 1,711 schema v5 → 0 失败 + 0 timeout
  - 排除 2026 + paper_type=网络/其他 + .doc 老格式
  - per-docx timeout 30s
  - cross-source dedup (历年合集 + 31 省跨源重复去重)
  - ingest to GraphRAG (converted_markdown + jsonl + gaokao_all.txt, +772 md / +17,569 chunks)
- [x] **Frontend F1 Foundation** (ai-tutor-frontend/):
  - Design Token 60 颜色 + Tailwind 4 theme 注入 (保留 Tailwind, 不重做)
  - 7 Service Layer (auth/user/exam/rag/knowledge/review/vision) + 37 mock JSON
  - 5 CSS + 12 JS + 1 demo page
  - SPEC.md + PLAN.md v0.2 (整合用户反馈: 6 阶段, Service Layer, Mock, Contract Test, Vision Epic, Freeze)
- [x] **.gitignore 完整** (RAG 大文件 / 测试缓存 / IDE / OS)
- [x] **Tag v0.5.0-dev** (基线)

### 📊 数据
- **代码量**: 28 commits (24 RAG + 4 新)
- **RAG 产物**: 1,711 unique schema v5 (170 MB 本地, 不入 git)
- **GraphRAG 接入**: 8,723 md + 17,861 jsonl chunks
- **F1 验证**: 17/17 DoD pass

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

## v0.7 (远期, GraphRAG 重建 + RAG 接入后端)

- [ ] RAG ingest 1,711 schema v5 → pgvector (rag_questions 表)
- [ ] GraphRAG CLI 重建 gaokao_all 索引 (LLM 限速, ~30 小时)
- [ ] neo4j 知识图谱导入 (kg/*.csv)
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
| `v0.6.0` | Frontend 完整迁移 + ai-tutor-frontend/ 主前端 | TBD |
| `v0.7.0` | GraphRAG + RAG 后端接入 | TBD |
| `v1.0.0` | Release | TBD |

---

## GitHub Milestone 同步

等 GitHub credentials (gh CLI / PAT / SSH) 后:
1. 登录 gh: `gh auth login`
2. 创建 milestone: `gh milestone create --title "v0.6" --due-date "..." --description "..."`
3. 创建 issue: `gh issue create --milestone "v0.6" --title "..." --body "..."`
4. PR 关联: `gh pr create --milestone "v0.6" --title "..."`

**当前状态**: GitHub mirror 未推, uibe 为主.
