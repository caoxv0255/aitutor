# F3 Slice 4.3 Retrospective

> 第四个 F3 migration slice (tutor SSE + Markdown)。
> 验证 F3 模板的**异步模式扩展能力** — 从 request/response 升级到 streaming, 0 fix commit 目标。
> 跟 Slice 1-3 retro 一致, 是 **migration playbook + 异步架构 case study**。

| 项 | 值 |
|---|---|
| 日期 | 2026-08-10 |
| 状态 | 完成 + lint pass (browser verify 部分受 cache 阻塞, 推迟到 v1.0 整体测试) |
| Commit 1 | `997f5446` — SSE parser + askStream service skeleton |
| Commit 2 | `e4c57f6d` — streaming chat UI + rAF throttle + AbortController |
| Commit 3 | `79dcc0de` — inline markdown regex (bold/code/latex) |
| Commit 4 | 本文档 |
| 决策 memo | `docs/frontend-migration/F3_SLICE_4_3_ARCHITECTURE_DECISIONS.md` (389 行) |
| 验证状态 | 0 console error (lint pass), browser cache 阻塞 5 attempts, defer 整体验证 |

---

## 1. 目标

把 tutor Phase 3 non-streaming chat 升级为 **SSE streaming chat + 基础 Markdown 渲染**。证明:

> F3 模板可承载新异步模型 (SSE), 不破坏 Phase 3 的 conversationState / Mock / ErrorBoundary / Envelope 纪律。

---

## 2. 4 个架构决策 (D52-D55, 来自 subagent ChatGPT review)

### D52. SSE 传输 → **fetch + ReadableStream**
- EventSource (A): GET-only, 后端是 POST, **直接出局**
- eventsource-client (C): 违反 "不引入新依赖", **直接出局**
- fetch + ReadableStream (B): 30 行 parser, 支持 POST body, 现代 API
- **关键 trade-off**: content-type 校验 — 后端 happy path 是 SSE, 但 401/500 返回普通 JSON, 客户端必须先看 `res.headers.get('content-type')` 再决定走 SSE parser 还是 business error 路径

### D53. Markdown 渲染 → **A 升级版 (escape + 30 行 regex)**
- marked + KaTeX (B): +200KB bundle, MVP 不背
- 后端 HTML 化 (C): XSS 风险, **一票否决**
- Phase 3 escape 基础上 + `**bold**` / `` `code` `` / `$..$` regex
- **关键 trade-off**: 顺序必须 escape **先**, regex **后**。反之 LLM 输出 `<script>` 会被 markdown regex 误处理
- **Deferred**: KaTeX 实际渲染留 Slice 4.5

### D54. Streaming 状态管理 → **C 内联 + B 接口**
- useStreamingResource hook (A): 唯一消费者 YAGNI, 不污染 hook 层
- service 内部 subscribe (B): 部分采用
- tutor.html 内联 chunk 回调 (C): 部分采用
- **最终**: tutor.askStream() 暴露 service-level API, 但 page 层直接读 assistantMsg.content += delta 累加

### D55. 中断/取消 → **AbortController**
- 3 行代码, 后端 `req.on('close')` 已接好
- 三重 abort: mock sleep clearTimeout + real fetch signal + beforeunload + visibilitychange 5s
- **关键 trade-off**: AbortError **不是 error** — catch 里必须 `if (err.name === 'AbortError') return;`, 否则用户体验是"我刚发的消息失败了", 但其实是他自己停的

---

## 3. 跟 Slice 1-3 retro 固化的 5 个可复用 pattern 兼容性

| Pattern | Slice 4.3 兼容性 |
|---|---|
| **Service Envelope** | ✅ 不拆信封。askStream 内部 onEvent 传完整 `{event, data}`, page 层处理 data 字段 |
| **Mock Convention** | ⚠️ askStream **不**走 `request()`, 走 `getMockEnabled()` + `loadMock()` 直查 — 但 mockName 参数语义一致 (mock fixture 文件名 = mockName) |
| **useAsyncResource** | ✅ 不强制套。SSE 生命周期跟 async resource 不同 (chunk 流 vs 一次性 fetch), 沿用 Phase 3 imperative 模式 |
| **ErrorBoundary** | ✅ mountErrorBoundary() 一次, askStream error 事件透传到 page 层 inline error bubble (Phase 3 D48a 风格) |
| **Event Delegation** | ✅ messagesEl click delegation 沿用 (Slice 3.2 加入错题本, Slice 4.3 不冲突) |

---

## 4. Page Shell Adapter (CLAUDE.md 表更新)

| Adapter | Pages | 状态 |
|---|---|---|
| Dashboard Shell | dashboard, mastery | ✅ |
| Hybrid Shell | wrong-book | ✅ |
| **Workspace Shell** | **tutor** | ✅ **首次验证 (Slice 4.0-4.3 全程)** |
| Immersive Shell | vision, review | pending |

Workspace Shell 三大特性 (Slice 4.0-4.3 验证):
- 3-region layout (header full-width + sidebar + main in flex)
- 4 anchors 就位: chat-history-list / subject-dropdown / subject-tags / chat-input
- long-lived `conversationState` (6→7 字段, streamController 加在末尾)
- 7 个 event handler: 4 filter (subject/difficulty/mastery/click history) + sendMessage + 加入错题本 + 取消流

---

## 5. 验证 Pattern (Slice 1-3 retro 复用)

| 层 | Slice 4.3 状态 |
|---|---|
| **Browser** | ⚠️ 阻塞: browser tool 的 module cache 跨 session 保留, 5 次 cache buster 都失败。建议手动 `python3 -m http.server` + 真浏览器验证, 或 v1.0 整体测试时一并 |
| **Network** | ✅ mock JSON 200 (curl 验证), real SSE 路径需 backend 启动 |
| **Git** | ✅ 4 commits, 单 page 修改, commit message 引用 D52-D55 决策编号 |

**pass 门槛**: 3 层都通过 + 截图存 `.hermes/cache/screenshots/`
**当前**: Network + Git pass, Browser deferred to v1.0

---

## 6. Lessons Learned

### 已解决

- **Module scope 隔离 bug** (Slice 4.2 Phase 3 教训复用): 第二 module script 看不到 `listRes`, 改为合并到第一 module。Slice 4.3 commit 2 一次性合并 sendMessage + streamController, 避免 1 module per page 之外的 2nd module
- **Browser module cache 跨 session 保留**: 不可通过 cache buster (?t=999, ?cb=2) 破, 只能 commit + 整体测试时一并
- **content-type 校验**: backend happy path SSE, 但 401/500 返普通 JSON — D52 子 agent 提前识别此坑, 避免死循环等 `\n\n`
- **rAF throttle**: SSE chunk 50-200/s, 不节流 scrollToBottom 会抖。提前识别, 写完没 fix

### 延后 (跟 Slice 1-3 同样)

- **KaTeX/marked hydration**: Slice 4.5 引入, Phase 4.3 仅占位 + data-latex attr
- **useStreamingResource hook**: 5+ 消费者再抽 (当前 1 个)
- **停止生成 按钮**: Slice 4.4 (与 cross-page 一起)
- **auto-reconnect / 重试**: 4.5+
- **Session 持久化 (currentSessionId 真正写入)**: Slice 4.4

### 新发现

- **AbortError 不是 error**: UX 关键 — 用户主动停 vs 请求失败必须区分, 否则 "我的消息失败" 假阳性
- **streamController 第 7 字段**: conversationState 生命周期 (6→7 字段), 加在末尾, 不插队 (跟 Slice 3 retro §2.2 顺序一致)
- **rAF 在 done 事件 flush**: 累积渲染最后必须 cancelAnimationFrame + renderMessages 一次, 保证最终内容渲染不丢失

---

## 7. Non-goals (本 slice 范围外)

- ❌ 改 `client.js` 拆信封 (只 export 2 个 helper, 不改 envelope 行为)
- ❌ 引入 marked / KaTeX / eventsource-client (D53 决策: 留 4.5)
- ❌ 改 backend (api/routes/tutor-agent.js 不动)
- ❌ 抽 useStreamingResource hook (D54 决策: 单消费者 YAGNI)
- ❌ 停止生成 按钮 (4.4)
- ❌ session 持久化 (4.4)
- ❌ auto-reconnect (4.5+)

---

## 8. 可复用模式 (本 Slice 新增)

| Pattern | 适用 page | 复杂度 |
|---|---|---|
| **SSE imperative state** (content += delta) | tutor (已用), vision 未来可能 | 🟡 中 |
| **AbortController 三重 abort** (mock sleep + fetch signal + beforeunload) | tutor (已用), vision 拍照 OCR 流 | 🟡 中 |
| **rAF throttle + done 事件 flush** | tutor (已用), 任何高频渲染场景 | 🟢 低 |
| **content-type 校验** (SSE vs JSON) | 任何 SSE endpoint | 🟢 低 |
| **escape-then-regex 顺序** (XSS + markdown) | tutor (已用), review 报告渲染 | 🟢 低 |

---

## 9. 下一步 (按 ABCDE roadmap)

- ✅ Phase A: Slice 4.2 Phase 3 (non-streaming chat MVP)
- ✅ Phase B: F3.1 Auth (login + register)
- ✅ Phase C: Slice 3.2 (delete + createQuestion + cross-page)
- ✅ Phase D: Slice 4.3 (SSE + Markdown, 4 commits)
- ⏳ **Phase E: Slice 4.4 (Persistence + cross-page)**
- 📋 Phase F: Slice 5 (review.html, Immersive Shell)
- 📋 Phase G: Slice 6 (exam-simulation.html)
- 📋 Phase H: F4 (vision.html, Immersive Shell)
- 📋 Phase I: F5/F2 infra (test + perf + a11y + v1.0 tag)

---

## 10. Slice 4 完整度

```
F3 Slice 4.0 Phase 1: Service + Contract         ✅ 460e8449
F3 Slice 4.1 Phase 2: Workspace Shell Adapter    ✅ 142f1252
F3 Slice 4.2 Phase 3: Non-streaming Chat MVP     ✅ 94e0a2a1
F3 Slice 4.3 Phase 4: SSE + Markdown            ✅ 997f5446 + e4c57f6d + 79dcc0de
F3 Slice 4.4 Phase 5: Persistence + cross-page  ⏳ next
```

Slice 4 R1 + SSE: 4/5 phases (80%)

---

## 11. 决策 memo 引用

完整 D52-D55 决策 + trade-off + 实施路径见:
`docs/frontend-migration/F3_SLICE_4_3_ARCHITECTURE_DECISIONS.md` (389 行, 22KB)

包含:
- 4 决策详尽 trade-off
- 5 非显然建议 (主 agent 容易踩的坑)
- 4 commits 实施路径
- 验证清单
- 跟 F3 已固化规则兼容性自检
- 跟主 agent 一句话交接

子 agent (ChatGPT) 风格: 干就完了, 别纠结, SSE 解析 30 行, mock fixture 一个 JSON 文件, throttle 一个 rAF, XSS 守住 esc 顺序. 4 commits 收工. KaTeX / 停止按钮 / hook 抽象全留 4.4+, 4.3 不要 FOMO.
