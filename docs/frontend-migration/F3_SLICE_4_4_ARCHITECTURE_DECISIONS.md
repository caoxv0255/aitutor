# F3 Slice 4.4 架构决策 (tutor session persistence + cross-page workflow 闭环)

> Code review 会议纪要 — ChatGPT (senior fullstack engineer) 视角。
> 服务对象: 主 agent 实施 Phase 4.4 (session persistence + 5 个 dead button 复活)。
> 决策基线日期: 2026-08-10。
> 跟 Slice 4.3 retro / Slice 3 retro / CLAUDE.md F3 rules 完全对齐, 不破 5 个已有可复用 pattern。
> 跟 Slice 4.3 retro 文档配对: 4.3 解 chat streaming, 4.4 解"流完了之后的事"。

---

## TL;DR — 5 个决策一句话总结

| ID | 决策 | 一句话理由 |
|----|------|-----------|
| **D56** | **C frontend-only localStorage** | F3 纪律 "mock 必须能 work, backend 路由可后置", 后端 /api/tutor/sessions 留 Slice 5+ 真实部署时再补, 4.4 不背 |
| **D57** | **A 整 messages[] 一坨存** | 跟 D56 锁死 (JSON.stringify(messages)), 跟 mock `tutor_history.json` 8 session 数据形态对齐, 不需要 messages 表分离 |
| **D58** | **A 硬跳转 + `?sid=X`** | 4 个 shell 已是 multi-page, SPA router 是 over-engineering, 跟切页面 abort 流天然兼容 |
| **D59** | **B 留在 tutor + toast "已加入, 错题本里看"** | 不打断学习流, 跟现有 "加入 → 已加入" 按钮状态接力, toast 用 CSS variables 不引入新依赖 |
| **D60** | **A AbortController abort 按钮** | D55 已经 wired (streamController 第 7 字段), 后端 `req.on('close')` 已接, 3 行代码完成 "停止生成" UI |

---

## 决策全景 (5 决策强耦合关系图)

```
D56 localStorage ←─→ D57 JSON.stringify(messages[])   ── 同一个存储层
   ↓                                                   ── 都 frontend-only
   ↓ 写入: sendMessage 流 done 后 push session          ── 都用 mock fixture
   ↓ 读取: sidebar 点击 + URL ?sid=X (D58)              ── 都 0 后端依赖
   ↓
D58 ?sid=X → renderMessages → D59 toast 不跳走 → 错题本 tab 自留
                ↑
            D60 abort button → 流中断 = 不写 localStorage (跟 D57 atomicity 绑定)
```

**核心约束**: D56/D57 锁死 localStorage, D58 锁死硬跳转, D59 锁死 toast, D60 锁死 abort。所有 4 commits 都围绕这 4 个 lock 来, 不开新口子。

---

## D56. Session persistence backend 设计 → **选 C: 完全 frontend-only (localStorage), 不动 backend**

### 推荐 + 理由

**Session 全部存 `localStorage['aitutor.sessions.v1']`, key 是 JSON 数组。** 4.4 **不**新建任何 session 路由, 4.4 **不**改 `wrong_questions` 表复用, 4.4 **不**动 `api/routes/tutor-agent.js`。

理由 (按权重排序):

1. **F3 纪律钉死 "mock 必须能 work, backend 真路由可后置"**: 现有 `services/tutor.js:51` `getHistory()` 已经 `mockName: 'tutor_history'` 接 mock JSON, mock 路径跑通不需要后端路由。localStorage 跟 mock fixture 是同一个状态机: UI 读不到 mock → fallback localStorage; UI 写完内存 state → flush 到 localStorage。**完全 frontend-only**。
2. **CLAUDE.md Non-goals 第二条 "Unify all page layouts into one shell (4 shells are product UX decisions)"**: 同理, 4.4 不应该越权去碰 backend schema 设计 — 那是 Slice 5+ 持久化层的事 (跟真实部署 / 多端同步 / Postgres schema migration 一起做)。4.4 只解**会话 UX 闭环**。
3. **跨页会话需求 = 同 origin**: tutor.html / wrong-book.html / mastery.html / dashboard.html 都在 `ai-tutor-frontend/pages/` 同源, localStorage `localStorage['xxx']` 跨页天然共享, 满足"sidebar 新建对话 → 切 dashboard → 切回 tutor 历史还在"的 UX。
4. **会话数据私密性低**: 高考生自己的 device, 不涉及多端同步 / 教师共享 / 跨设备 — localStorage **足够**。即使后续要做云同步, 是把 localStorage 内容 serialize 上传到 backend, 不是直接重做一遍 storage。
5. **后端表复用 (选项 B) 一票否决**: `wrong_questions` 表是 user-curated 错题 (question/answer/analysis/difficulty), session metadata 是流式对话历史 (messages[]/lastMessageAt/subject/title), **两个 domain**。塞进一张表 → query 时 `WHERE type='session'` 分支, 后续加 session-specific 字段 (e.g. `messages_snapshot JSONB`, `model_version`) 又得改 wrong_questions 表 schema, **type 字段污染**。F3 retro §1.2 "Hybrid Shell Adapter" 强调 domain boundary, 这里同理。

### 跟其他选项的 trade-off

| 选项 | 否决原因 |
|------|---------|
| **A 新建 /api/tutor/sessions 路由** | ① mock 优先级 = 不需要后端路由 (F3 纪律); ② 4.4 范围越权 (Slice 5 持久化层的事); ③ POST create + GET list + GET :id + PUT update = 4 个 endpoint, **跟 D57 schema 强耦合**, 等 D57 拍板再开后端也不晚 |
| **B 复用 wrong_questions 表** | ① domain 混淆 (错题 vs 会话); ② schema 演进两条线缠一张表 → migration 地狱; ③ 无 messages 字段 → 还得加 JSONB 列, 等于在 B 上偷偷做 A |
| **C localStorage** | ✅ 选, 见上 |

### 实施示意

```js
// assets/js/api/services/tutor.js 新增 (沿用 mockName convention 但走 localStorage):
const STORAGE_KEY = 'aitutor.sessions.v1';

async function _loadLocalSessions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { console.warn('[Slice4.4] localStorage parse failed:', e); }
  // Fallback 第一次访问: 返回 mock fixture (跟 D52 SSE mock-first 思路一致)
  const mock = await loadMock('tutor_history');
  return mock.data || [];
}

function _saveLocalSessions(sessions) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  } catch (e) {
    console.warn('[Slice4.4] localStorage quota:', e);
    // 失败时不 throw — UX 降级到"刷新丢失会话", 但 UI 仍可用
  }
}

// getHistory() 改造: 优先 localStorage, fallback mock, 完全不走 backend
async getHistory() {
  const data = await _loadLocalSessions();
  return { success: true, message: '获取会话列表成功', data };
}
```

### 风险 / 边界

- **Quota 边界**: localStorage 5–10MB / origin, 一个 session 假设 50 messages × 200 字符 ≈ 10KB, 理论上能存 500+ session。**接受** — 高中生一年用不到 50 session。
- **私密 mode / 隐私浏览**: `localStorage` setItem 抛 `QuotaExceededError`, catch 里降级到 "in-memory only", 刷新即丢, 不污染主流程。
- **多 tab 同步**: 不做 (4.4 范围外)。后续如果用户报"我在 tab A 新建对话, tab B 看不到"再补 `storage` event 监听。
- **版本号 suffix**: `v1` suffix 是给未来 schema migration 留口子 (万一 messages 字段升级, 读 v0 → 迁移到 v1 → 写 v1)。
- **不破 Slice 4.3 `getHistory()` 签名**: mockName 参数保留 (向后兼容), 内部实现从 mock 直读 → 改为 localStorage first + mock fallback。
- **不破 conversationState 字段顺序**: 4.3 已经 7 字段固定 (`subject / currentSessionId / sessions / messages / loading / error / streamController`), 4.4 **不**加第 8 字段 — `currentSessionId` 4.3 retro 已留口 (line 820 comment "Phase 4.4 才用"), 4.4 真正赋值即可。

---

## D57. Session messages 存储 schema → **选 A: 整 messages[] 数组存 JSON.stringify**

### 推荐 + 理由

**Session 对象 = `{id, title, subject, createdAt, lastMessageAt, messageCount, messages: [...]}`, 整对象 `JSON.stringify` 写 localStorage。** 跟 D56 锁死, 不引 messages 表分离 (e.g. `tutor_session_messages` 表), 不引 mock 缓存层 (选项 C 跟 D56 frontend-only 重复)。

理由:

1. **跟 mock fixture 对齐**: `tutor_history.json` 8 个 session 字段是 `{id, title, subject, lastMessageAt, messageCount, preview}` — mock 已经选了"summary 而非 full messages"模式。4.4 升级到存 full messages, 跟 mock 的 `preview` 字段做"列表展示用 preview, 进入 session 用 messages[]"的分层。
2. **query 模式简单**: 8 个 session 是 sidebar 列表渲染, 进入 session 才加载 messages。**没有"全文搜索历史消息"需求** (高中 AI tutor 学习场景, 用户翻历史 = 翻某次具体对话, 不是 search "我什么时候问过三角函数")。
3. **JSONB 不需要 Postgres**: 选项 B "单独 messages 表" 是给关系型 DB 的方案 (e.g. WHERE content LIKE '%三角函数%'), 我们 4.4 走 localStorage, **整个对象就是一个 JSONB**, 物理层已经是一坨 JSON, 再"拆表"是 over-engineering。
4. **mock cache (选项 C) 否决**: 4.4 走 localStorage = 已经有持久化层, 再加 mock cache = 两层缓存互相覆盖 (localStorage 写完了, mock cache 不知道, 刷新读 mock 旧值)。**直接一坨存, 不要中间层**。

### 跟其他选项的 trade-off

| 选项 | 否决原因 |
|------|---------|
| **A JSONB 一坨** | ✅ 选, 见上 |
| **B 单独 messages 表** | ① 4.4 不上 Postgres (留 Slice 5+); ② 拆分没带来 query 优势 (无搜索需求); ③ 写入要 2 个 key (session metadata + messages array), 失败 atomicity 难保证 |
| **C 每次存最新摘要, messages 走 mock cache** | ① 跟 D56 frontend-only 冲突 (mock cache 又一个层); ② 摘要失真 (用户回看历史看不到完整对话); ③ UX 上不可接受 |

### 实施示意

```js
// D56 STORAGE_KEY 同一个 key, schema 升级:
// v1 = [{ id, title, subject, createdAt, lastMessageAt, messageCount, messages: [...] }]

// sendMessage 流 done 后, 持久化当前 session:
function _persistCurrentSession() {
  if (!conversationState.currentSessionId) return;
  const session = {
    id: conversationState.currentSessionId,
    title: conversationState.messages[0]?.content?.slice(0, 30) || '新对话',
    subject: conversationState.subject,
    createdAt: conversationState.sessions.find(s => s.id === conversationState.currentSessionId)?.createdAt || Date.now(),
    lastMessageAt: Date.now(),
    messageCount: conversationState.messages.length,
    messages: conversationState.messages,  // ← 整 messages[] 一坨
  };
  const idx = conversationState.sessions.findIndex(s => s.id === session.id);
  if (idx >= 0) conversationState.sessions[idx] = session;
  else conversationState.sessions.unshift(session);
  _saveLocalSessions(conversationState.sessions);
}
```

### 风险 / 边界

- **JSON.stringify 大对象性能**: 50 messages × 200 字符 ≈ 10KB, JSON.stringify 微秒级, **不 throttle**。如果用户疯狂刷 1000 messages → 200KB → stringify 仍 <10ms, 可接受。
- **AbortError 不持久化 (跟 D60 联动)**: `if (err.name === 'AbortError') return;` catch 里**不**调 `_persistCurrentSession`, 因为流被用户中断 = 这条对话未完成, 不应该写 localStorage。这是 D57 + D60 的 atomicity 约定。
- **messages 字段可能含 streamController 引用?**: 不可能。messages[] 元素是 plain object `{role, content, timestamp, diagnosis, context}`, **不存** AbortController / DOM ref / closure。JSON.stringify 安全。
- **localStorage 写失败 (quota)**: catch 降级, UI 仍可用, console.warn 提示。不 throw, 不弹 toast (D59 toast 是给 success 路径用的)。
- **mock fixture 兼容**: 旧 mock `tutor_history.json` 8 session 没有 `messages` 字段, 4.4 读出来 `s.messages = undefined`, 列表渲染走 `preview` 兜底, 点击进入 → 显示 "暂无消息" empty state, **不破** mock 展示。

---

## D58. Cross-page navigation pattern → **选 A: `window.location.href = '...html?sid=X'` 硬跳转**

### 推荐 + 理由

**所有 tutor 内部跳转用 `window.location.href` 硬跳转, session id 通过 query string `?sid=X` 传。** 不引 router, 不引 postMessage, 不引 SPA shell 重组。

理由 (跟 Slice 3 retro §1.2 "Hybrid Shell Adapter" 同一思路):

1. **4 shell 是 product UX 决策, 不是技术债**: CLAUDE.md 钉死 "Do not unify all page layouts into one shell"。同理, 4 个 shell 之间导航就是硬跳转, **不应该**被 router 抽象。mastery.html 已经用 `?kpId=X` 传参 (F3 Slice 2 验证过), 4.4 沿用同样的 pattern, **0 新概念**。
2. **跟切页面 abort 流天然兼容**: Slice 4.3 D55 已经 wired `beforeunload → streamController.abort()` + `visibilitychange 5s → abort`。硬跳转触发 `beforeunload` → 流被 cancel → 后端 `req.on('close')` 释放 LLM token。**这是 4.3 已经验证的路径, 4.4 复用**。
3. **后端不需要 router-aware**: 硬跳转意味着每个 .html 都是独立 page load, `client.js` `mountErrorBoundary()` 重新 mount, `useAsyncResource` 重新订阅 — **整套 stack 干净重启**, 不会出现 "SPA 内泄漏 stale state"。
4. **query string 解析简单**: `new URLSearchParams(location.search).get('sid')`, 跟 mastery.html kpId 一致 (后端 mock 也支持 query)。
5. **SPA router (选项 B) 否决**: ① 单消费者 (tutor) 的 router 是 YAGNI; ② 4 个 shell 之间的导航已经被 sidebar link 接管 (`<a href="mastery.html">`), 4.4 只补**session-to-session**跳转 (sidebar history 内部) + **session-to-page**跳转 (D59 "加入错题本" → 留 tutor); ③ history API 还涉及 server-side route fallback (e.g. `nginx try_files`), dev 环境 `python3 -m http.server` 不支持。

### 跟其他选项的 trade-off

| 选项 | 否决原因 |
|------|---------|
| **A `window.location.href` 硬跳转** | ✅ 选, 见上 |
| **B SPA hash/history routing** | ① 4 个 shell 已是 product UX 边界, 不该强行统一; ② dev server 不支持 history fallback; ③ F3 retro 5 pattern 全是"页面级", 跟 router 抽象气质不符 |
| **C `window.open()` + postMessage** | ① 用户体验割裂 (新 tab 看错题本, 原 tab 看不到反馈); ② postMessage 跨 tab 通信复杂度 ≫ 同 tab localStorage; ③ 高考场景 "同 tab 流式学习" 才是主流 |

### 实施示意

```js
// tutor.html sidebar history click handler (event delegation):
const historyEl = document.getElementById('chat-history-list');
historyEl.addEventListener('click', (e) => {
  const li = e.target.closest('[data-session-id]');
  if (!li) return;
  const sid = li.dataset.sessionId;
  // 当前页就激活, 不需要跳; 跨页跳才用 location.href
  if (location.pathname.endsWith('tutor.html')) {
    loadSession(sid);  // 4.4 新增: loadSession 触发 messages 渲染 + URL 加 history
  } else {
    location.href = `tutor.html?sid=${encodeURIComponent(sid)}`;
  }
});

// 4.4 新增: 页面加载时读 ?sid=
const urlSid = new URLSearchParams(location.search).get('sid');
if (urlSid) {
  loadSession(urlSid);  // 从 localStorage 取 session.messages → renderMessages
}
```

### 风险 / 边界

- **query string 长度**: session id 用 `sess_001` 这种短 ID (8 字符), URL 总长 <100 字符, **可接受**。如果未来 id 变 UUID (36 字符), 仍 <150, 不破 2KB URL 上限。
- **history.back() 行为**: 用户从 wrong-book 跳回 tutor.html?sid=X, 再按 back, 浏览器跳回 wrong-book — 不回到默认 tutor.html。**接受** (这是浏览器默认行为, 跟 SPA router 等价, 不需要 polyfill)。
- **localStorage 同源要求**: tutor.html 和 wrong-book.html 必须同 origin (都是 `ai-tutor-frontend/pages/`), 如果未来 CDN 分发跨子域, 要 fallback 到 cookie 或 BroadcastChannel — **Slice 5+ 范围**。
- **mock fixture 兼容**: tutor.html load 时无 `?sid=`, 默认进第 1 个 session (跟 Phase 2 行为一致), 不破现有 mock-first 路径。

---

## D59. "加入错题本" cross-page UX 闭环 → **选 B: 留在 tutor + toast "已加入, 错题本里看"**

### 推荐 + 理由

**调 `wrong.createQuestion()` 成功后, 不跳走, 在 tutor.html 右下角弹 toast "已加入错题本, 去错题本看 →", 3 秒后自动消失。** 不开新 tab, 不弹 modal, 不强制跳转。

理由:

1. **不打断学习流**: 用户刚问完一道题, AI 答完, 用户点 "加入错题本" 的意图是 "mark this for review later", **不是** "我现在要去错题本页面"。强制跳走 → 用户失去当前 chat 上下文 (诊断卡片 + 后续问题), **违反 chat-first UX**。
2. **跟现有 button 状态接力无缝**: Slice 3.2 已经实现 button 文字 "加入错题本" → "已加入" (3 秒后恢复)。4.4 toast 是**升级**, 不是替代 — button 文字变化保留 (即时反馈), toast 补充 (跳转入口提示)。两层反馈 = 既"我知道成功了"又"我知道去哪看"。
3. **F3 5 pattern 全沿用**: toast 是新组件, 但实现完全沿用 **Event Delegation** (单 `toast-container` 监听 `show-toast` custom event) + **Active Button Toggle** (toast 自身是 transient active state) — 0 新概念。
4. **0 新依赖**: toast 是纯 CSS + JS, 用现有 `--brand / --surface / --success` variables, 不引 toastify / notyf 库 (违反 deps rule)。
5. **跨页跳转入口保留**: toast 文案 "去错题本看 →" 带 `<a href="wrong-book.html">`, 用户想跳就点 (D58 硬跳转), 不想跳就让 toast 自动消失 — **用户主动权**。
6. **modal (选项 C) 否决**: ① 多一步 click ("继续对话" 是默认, 但用户得 read 完文案才能确认); ② 高考学生学习节奏快, modal 是 friction; ③ F3 retro 强调"页面级 pattern", modal 是 modal-library 级别的抽象, YAGNI。

### 跟其他选项的 trade-off

| 选项 | 否决原因 |
|------|---------|
| **A createQuestion → 跳 wrong-book.html 新窗口** | ① 新窗口打断原 chat 流; ② 同 tab 跳也打断流; ③ "用户加错题 = 用户想看错题" 是错假设 |
| **B 留在 tutor + toast** | ✅ 选, 见上 |
| **C modal 选 "查看错题本" / "继续对话"** | ① modal friction; ② 高考场景用户决策疲劳; ③ 跟现有 button 状态接力重复 |

### 实施示意

```js
// tutor.html 新增 toast container (HTML, 在 body 末尾):
// <div id="toast-container" class="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none"></div>

// Event Delegation 监听自定义事件:
const toastContainer = document.getElementById('toast-container');
toastContainer.addEventListener('click', (e) => {
  const link = e.target.closest('[data-toast-link]');
  if (link) location.href = link.dataset.toastLink;  // D58 硬跳转
});

// showToast 公共方法 (沿用 imperative state mgmt 风格, 不引 hook):
function showToast({ message, linkText, linkHref, durationMs = 3000 }) {
  const toast = document.createElement('div');
  toast.className = 'pointer-events-auto px-4 py-3 rounded-xl shadow-lg bg-surface text-foreground text-sm flex items-center gap-3';
  toast.innerHTML = `
    <i data-lucide="check-circle-2" class="w-4 h-4" style="color:var(--success);"></i>
    <span>${esc(message)}</span>
    ${linkHref ? `<a data-toast-link="${esc(linkHref)}" href="${esc(linkHref)}" class="font-medium underline" style="color:var(--brand);">${esc(linkText)}</a>` : ''}
  `;
  toastContainer.appendChild(toast);
  if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
  setTimeout(() => toast.remove(), durationMs);
}

// 改造 Slice 3.2 handler:
messagesEl2.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-dom-id="tutor-add-wrong"]');
  if (!btn || btn.disabled) return;
  // ... (loading state 同 4.3) ...
  try {
    await wrong.createQuestion({ ... });
    btn.innerHTML = '<i data-lucide="check"></i> 已加入';  // ← 保留
    showToast({  // ← 新增
      message: '已加入错题本',
      linkText: '去错题本看 →',
      linkHref: 'wrong-book.html',
    });
  } catch (err) { ... }
});
```

### 风险 / 边界

- **toast 堆叠**: 同一 message 加错题本 2 次 (不太可能但理论), 第二次会盖在第一个上面, 3 秒后第一个消失。**接受** (视觉小问题, 不影响 UX 闭环)。
- **toast vs `setUseMock` mock-first**: `wrong.createQuestion` 走 mock 时 100ms 成功, toast 立即弹, 体验 OK; 走真实后端时延迟可能 200-500ms, 期间 button 已 disabled ("添加中..." spinner), 用户感知 OK。
- **a11y**: toast 加 `role="status"` `aria-live="polite"`, screen reader 友好。不在 4.4 强制, 留 todo (CLAUDE.md 没强制 a11y)。
- **CSS variable 兼容**: `--success` `--brand` 已在 CLAUDE.md design system 列出, **不破 design contract**。
- **mobile 适配**: toast 位置 `bottom-6 right-6` 在 mobile (<640px) 改成 `bottom-4 left-4 right-4`, 用 Tailwind responsive prefix `sm:right-6 sm:left-auto`。**0 新概念**。

---

## D60. "停止生成" 按钮 (Slice 4.3 deferred → 4.4) → **选 A: AbortController abort 按钮**

### 推荐 + 理由

**在 assistant message 流式渲染期间, 在 message 下方 (跟 "加入错题本" 同一行) 显示 "停止生成" 按钮, 点击 → `conversationState.streamController.abort()`。** 按钮在 `done` / `error` / `AbortError` 事件后自动隐藏。

理由:

1. **D55 已经 wired, 4.4 只接 UI**: `conversationState.streamController` 第 7 字段已经在 4.3 commit 2 落地 (`tutor.html:1251`), `beforeunload` 兜底已经在 (`tutor.html:1180-1196`), **所有 infrastructure 已 ready**, 4.4 只加 1 个 button + 1 个 onclick handler。
2. **后端 `req.on('close')` 已接**: `api/routes/tutor-agent.js:632` `req.on('close', () => { closed = true; })` + `sendEvent` 检查 `closed` flag + LLM `for await` 检查 `closed` break。**前后端联动 end-to-end**, 客户端按钮 abort → fetch close → 后端 `req.on('close')` → LLM loop break → token 释放。
3. **0 依赖**: 跟 D59 toast 同思路, 用现有 button CSS, 无新包。
4. **chat UX 必备**: LLM 流式输出 30s+ 是常态, 用户问错了想中途停 ("不是这道题, 是另一道") 是高频操作。**关 tab 太重, 4.3 retro 已经埋口 "未来 4.4 按钮"**, 4.4 接上。
5. **后端 stop endpoint (选项 B) 否决**: ① 4.3 已经用 `req.on('close')` 解决了"取消"的传输层语义, 不需要再发明 application-layer "stop"; ② 真实 LLM API (qwen-plus streaming) 不支持 application-layer cancel, 只能靠 fetch close; ③ 增加 endpoint = 增加 mock fixture + 客户端 race condition 处理 (按钮按了, fetch 已经在 close 了, stop 请求发出去无意义)。
6. **不做 (选项 C) 否决**: 用户只能关 tab 是 2020 年前的体验, 2026 年 chat UX 必备。F3 纪律 "MVP 不背 200KB bundle" 不等于 "MVP 不做核心 UX"。

### 跟其他选项的 trade-off

| 选项 | 否决原因 |
|------|---------|
| **A AbortController abort 按钮** | ✅ 选, 见上 |
| **B 等后端 stop endpoint** | ① fetch close 已经能 cancel LLM, 重复; ② 增加 endpoint + mock fixture + race condition, 复杂度 ≫ 收益; ③ qwen-plus 不支持 application-layer cancel |
| **C 不做** | 违反 chat UX 常识; 4.3 retro 已经承诺 "4.4 nice-to-have", 不兑现 = 跨 slice 拖延 |

### 实施示意

```js
// assistantMessageTemplate 内, "加入错题本" 旁边加条件按钮:
function assistantMessageTemplate(msg) {
  const isStreaming = msg.role === 'assistant' && conversationState.loading && !msg.error;
  return `
    ...
    <div class="flex items-center gap-2 ml-1">
      ${isStreaming ? `
        <button data-dom-id="tutor-stop-stream" class="inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-xs font-medium text-foreground-secondary bg-surface-tertiary hover:bg-border-light transition-all">
          <i data-lucide="square" class="w-3 h-3"></i>
          停止生成
        </button>
      ` : `
        <button data-dom-id="tutor-add-wrong" data-question-text="${esc((msg.content || '').slice(0, 200))}" class="inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-xs font-medium text-white transition-all hover:opacity-90 disabled:opacity-50" style="background:var(--brand);">
          <i data-lucide="bookmark-plus" class="w-3.5 h-3.5"></i>
          加入错题本
        </button>
      `}
    </div>
    ...
  `;
}

// Event delegation (跟 add-wrong 同一个 listener, 加 case):
messagesEl2.addEventListener('click', (e) => {
  const stopBtn = e.target.closest('[data-dom-id="tutor-stop-stream"]');
  if (stopBtn) {
    if (conversationState.streamController) {
      conversationState.streamController.abort();
      // Slice 4.3 catch 里已经处理 AbortError (不写 error bubble)
    }
    return;
  }
  // ... 原 add-wrong handler 不变
});
```

### 风险 / 边界

- **AbortError UX**: 4.3 已经 wired catch 里 `if (err.name === 'AbortError') return;` 不写 error bubble。4.4 按钮触发 abort → 流提前结束 → assistant message.content 保留**已生成部分** (e.g. 用户问完看 5 秒, 已生成 30% 内容, abort 后 30% 保留) — 这是**符合直觉的 UX** (不是"全删", 是"停在这里")。
- **按钮状态 race**: 用户连点 2 次 stop → 第 2 次 `controller.abort()` 是 no-op (已 aborted), 不报错。**安全**。
- **mock 路径兼容**: `services/tutor.js:81` `if (signal && signal.aborted) return;` 已经检查 abort, mock 路径 abort 后立即停止 emit events, 4.4 按钮在 mock mode 也 work (Playwright 验证时手动按)。
- **loading flag 不重置**: abort 后 `finally` 块里 `conversationState.loading = false; renderMessages(...)` 触发 `assistantMessageTemplate` 重渲染 → 按钮条件 `isStreaming` 变 false → 按钮消失, 出现 "加入错题本"。**顺序安全** (try/catch/finally 保证)。
- **不破 conversationState 7 字段契约**: 不加第 8 字段, 不改字段顺序。abort 用现有的 `streamController` 第 7 字段。
- **不破 Slice 4.3 5 commits**: 4.4 commit 2 (UI 复活) 跟 4.3 commit 2 (sendMessage) 互不依赖, git log 独立可回滚。

---

## 实施路径建议 (commit 拆分 + DoD + 验证 + 工时估计)

**核心约束**: 1 sub-feature = 1 commit, 0 fix commit 目标, mock 必须能 work (D56 localStorage = 0 后端依赖), backend 真路由后置到 Slice 5+。

### Mock 设计 (前置, 不单独占 commit, 跟 sub-feature 1 一起)

**问题**: D56 选择 localStorage, 不需要新 mock fixture (现有 `tutor_history.json` 8 session 继续 fallback 第一次访问)。但 D57 schema 升级需要**新 mock fixture** 给"已有 messages 的 session"路径用, e.g.:

```json
// assets/js/api/mock/tutor_session_detail.json (新增, 1 个 session 含 4 messages)
{
  "success": true,
  "message": "获取会话详情成功",
  "data": {
    "id": "sess_001",
    "title": "二次函数解析式求解",
    "subject": "数学",
    "createdAt": "2026-08-06T08:00:00Z",
    "lastMessageAt": "2026-08-06T08:15:00Z",
    "messageCount": 4,
    "messages": [
      { "role": "user", "content": "二次函数 $y=ax^2+bx+c$ 怎么求 a?", "timestamp": "2026-08-06T08:00:00Z" },
      { "role": "assistant", "content": "好的, 我们来看...", "timestamp": "2026-08-06T08:00:30Z", "diagnosis": {...} },
      ...
    ]
  }
}
```

**说明**: 4.4 主路径**不走这个 mock** (主路径读 localStorage), 这个 mock 仅给 "localStorage 空 + URL 带 ?sid=X (cold start)" 的边界 case 用 — 第一次访问用户, 8 session 列表从 `tutor_history.json` mock 加载, 但具体某一个 session 的 messages 还没持久化 (因为没问过), mock fixture 给一个 fallback。

**不做**: 真实 .sse 文件 — 跟 Slice 4.3 retro 同判断, Python http.server MIME 处理不一致, 不值。

### Commit 拆分 (推荐 5 commits, 每个独立可验证)

| # | Commit | 内容 | DoD | 验证 |
|---|--------|------|-----|-----|
| **1** | `feat(tutor): Slice 4.4 commit 1 — localStorage session store + loadSession` | ① D56 `_loadLocalSessions()` / `_saveLocalSessions()` 加到 `services/tutor.js`; ② `getHistory()` 改 localStorage-first + mock fallback; ③ `tutor.html` 加 `loadSession(sid)` 函数 (从 localStorage 取 messages → renderMessages); ④ URL `?sid=X` 解析; ⑤ 新增 mock `tutor_session_detail.json` (cold-start fallback) | 浏览器首次访问 → 读 mock 8 session; F12 Application → Local Storage 看到 `aitutor.sessions.v1` 写入; 手动 `localStorage.clear()` → reload → 重新从 mock 加载 | Browser: sidebar 8 items 渲染; DevTools → Local Storage → `aitutor.sessions.v1` 存在 |
| **2** | `feat(tutor): Slice 4.4 commit 2 — sendMessage 流 done 后持久化 + sidebar 切换 + URL sync` | ① `sendMessage` finally 里调 `_persistCurrentSession()` (D57 schema); ② sidebar `data-session-id` click handler → `loadSession` (D58 同页) 或 `location.href` (D58 跨页); ③ 新建对话按钮 → `conversationState.currentSessionId = 'sess_' + Date.now()` + 清空 messages + URL 去掉 `?sid`; ④ 清空对话按钮 → 同上但 confirm dialog; ⑤ `pushState` 同步 URL | 发问 → 流 done → Local Storage 更新; 点 sidebar 第 3 项 → 切换 messages + URL 变 `?sid=sess_003`; 点新建 → 清空 chat + URL 变 `/tutor.html`; 刷新页面 → 当前 session 还在 | Browser: 录屏 sidebar 切换 + 新建 + 清空; F12 Local Storage 验证 JSON 结构 |
| **3** | `feat(tutor): Slice 4.4 commit 3 — 5 个 dead button 复活 (加入错题本 toast / 知识图谱跳转 / 拍照搜题 / 停止生成)` | ① D59 toast container + `showToast()` 加进 `tutor.html`; ② `tutor-add-wrong` handler 接 toast "已加入错题本, 去错题本看 →"; ③ `tutor-to-mastery` 加 click handler → `location.href = 'mastery.html?kpId=X'` (X 从 assistantMsg.diagnosis.metadata.weak_kp_ids[0] 读); ④ `tutor-to-vision` 加 click handler → `location.href = 'vision.html'`; ⑤ `clear-chat-btn` 接 confirm + 新建对话; ⑥ D60 停止生成按钮 + abort handler | 5 个按钮全部有反馈: 加入 → toast 弹 + 按钮文字变; 知识图谱 → 跳 mastery 页面 (带 ?kpId); 拍照搜题 → 跳 vision 页面; 停止生成 → 流立即停 + 按钮消失; 清空 → confirm + 清空 chat | Browser: 录屏 5 个 button 各点一次; F12 Network 看 navigation |
| **4** | `feat(tutor): Slice 4.4 commit 4 — 跨页加载错题本时 (从 toast link / 直接 URL) 显示新加入题的高亮` | ① wrong-book.html 加 `?highlight=QID` query param 解析; ② 新加入的错题 3 秒高亮 (背景 flash `--success-100`); ③ 跟 Slice 3.2 `wrong.createQuestion` 返回的 `data.id` 联动 (D58 硬跳转时把 qid 塞 URL) | 加入错题 → toast 点链接 → wrong-book.html 跳转 → 新加入题 3 秒绿色高亮 → 用户视觉闭环 | Browser: 录屏 join → toast → click → wrong-book 高亮 → 渐隐 |
| **5** | `docs(tutor): F3 Slice 4.4 retrospective` | retro 文档, 引用本决策 memo + Slice 3 §2.2-2.6 5 pattern + Slice 4.3 retro, 记录 0 fix commit, 标记 D56/D57/D58/D59/D60 落地状态 | 文档可读, commit hash 填齐, GitHub 链接 OK | Git: `git log --oneline` 显示 5 commits 顺序对应 |

### 整体 DoD (Slice 4.4 完成定义)

- [ ] 5 commits, 无 fix commit (除非真出问题)
- [ ] Browser 验证: mock 模式 + 真实后端模式 (如果 :3002 启了) 都跑通
- [ ] Network 验证: 不引入新 endpoint (D56 锁死), 仍走 mock JSON / SSE 现有 endpoint
- [ ] Git 验证: commit message 含 "Slice 4.4", 引用 D56-D60 决策编号
- [ ] 不破 Slice 4.3: SSE 流式 chat 仍 work, diagnosis card 仍 work, "加入错题本" 按钮仍可点
- [ ] 不破 Slice 3.2: wrong-book.html filter / pagination / delete 仍 work
- [ ] 不破 conversationState 6 → 7 字段契约 (D56 锁死不加第 8 字段)
- [ ] **不**引入新 npm 依赖
- [ ] **不**改 `client.js` 拆信封
- [ ] **不**新建后端 session 路由 (D56 frontend-only 锁死)
- [ ] mock 文件 `tutor_session_detail.json` schema 文档化 (在 retro §Mock Schema)
- [ ] 5 个 F3 reusable pattern 全部沿用: Filter State (subject 切换) / Event Delegation (sidebar + messages) / Mastery Derive (diagnosis card) / Active Button Toggle (sidebar active item, stop/add toggle) / Matched/Total (sidebar message count 预览)

### 验证清单 (主 agent 实施时 checklist)

```
□ Commit 1: Local Storage 看到 aitutor.sessions.v1, JSON 结构 = [{id, title, subject, messages: [...]}]
□ Commit 1: 手动 localStorage.clear() → reload → 8 session 列表从 mock 加载
□ Commit 2: 发问 → 流 done → Local Storage 更新该 sid 的 messages 字段
□ Commit 2: sidebar 切到第 3 项 → URL 变 ?sid=sess_003 → 刷新页面 → 仍切到第 3 项
□ Commit 2: 新建对话 → 清空 chat → URL 去掉 ?sid → Local Storage 增加新 sess_xxx
□ Commit 3: 5 个按钮各点一次, 全部有 UX 反馈 (toast / 跳转 / abort)
□ Commit 3: 停止生成 → 1 秒内流停 → assistant 保留已生成内容 + 按钮消失
□ Commit 3: 知识图谱按钮 → 跳 mastery.html?kpId=xxx (xxx 从 diagnosis.metadata.weak_kp_ids[0] 读)
□ Commit 4: 加入错题本 → toast 点链接 → wrong-book.html?highlight=qid → 新错题 3 秒高亮
□ Commit 5: retro 文档完整, 引用本 memo 链接
□ 全程: 0 后端路由新增, 0 新依赖, client.js 不动
```

### 工作量估计 (1-2 天, 主 agent 实施)

| 阶段 | 估计 | 备注 |
|------|------|------|
| Commit 1 (localStorage store + loadSession) | 3 小时 | 含 mock fixture 设计 + 边界 case 处理 (localStorage 解析失败 / quota) |
| Commit 2 (流 done 持久化 + sidebar 切换 + URL sync) | 4 小时 | 含 pushState history API + 新建/清空对话 confirm dialog |
| Commit 3 (5 个 dead button 复活) | 4 小时 | toast 组件 + 5 个 handler + 跟现有 button 状态接力 |
| Commit 4 (错题本高亮) | 2 小时 | 跨页 query param 传递 + 3 秒 flash 动画 |
| Commit 5 (retro 文档) | 2 小时 | 跟 Slice 4.3 retro 同模板, 引用 5 pattern |
| **总计** | **15 小时 ≈ 1.5-2 工作日** | 假设主 agent 不被别的事打断, 一次性做完 |

### 延后到 Slice 5+ (不在 4.4 范围)

- 后端 `/api/tutor/sessions` 真路由 + Postgres schema → Slice 5 持久化层
- 多端同步 (云端 localStorage → backend) → Slice 5+
- 多 tab 同步 (`storage` event 监听) → 用户报 bug 再补
- message 全文搜索 → 无需求, 不做
- `useStreamingResource` hook 抽象 → 5+ 消费者再抽 (当前 1 个)
- KaTeX hydration → Slice 4.5 (跟 4.3 retro 同)

---

## 跟 F3 已固化规则的兼容性自检

| Rule | 4.4 决策是否冲突 |
|------|----------------|
| 不改 `client.js` 拆信封 | ✅ D56 不动 client.js, `getHistory()` 内部实现改 (mock-first → localStorage-first), 签名不变 |
| 不引入新依赖 | ✅ D59 toast 纯 CSS + JS, D60 abort button 纯 HTML |
| Mock convention (`request(..., { mockName })`) | ⚠️ D56 `getHistory()` 不走 `request()`, 走 `_loadLocalSessions()` — 但 mockName 参数保留 (向后兼容 fallback); 新增 `tutor_session_detail.json` 走 `request()` mockName (cold-start 边界 case) |
| `useAsyncResource` 强制 | ✅ `loadSession(sid)` 沿用 imperative (一次性读 localStorage + renderMessages), 不强套 hook |
| 5 个可复用 pattern (Slice 3 §2.2-2.6) | ✅ Filter State (subject 切换不变) / Event Delegation (sidebar click, messages click, toast click) / Mastery Derive (diagnosis card 仍走 page-layer derive) / Active Button Toggle (sidebar active item, stop/add button toggle) / Matched/Total (sidebar messageCount 字段) 全部沿用 |
| Page Shell Adapter | ✅ tutor 已是 Workspace Shell, 4.4 不动 shell, 只动 chat 内部 + sidebar 交互 |
| 0 fix commit | ✅ 5 commits 全 reviewable, mock fixture 提前 design, 5 个 button 一次性接完 |
| 4 shell 不统一 | ✅ D58 硬跳转, 不引 router |
| conversationState 6 → 7 字段不破 | ✅ D56 锁死不加第 8 字段, 用现有 `currentSessionId` 第 2 字段 |

---

## 跟 Slice 4.3 retro 的一对一接力

| Slice 4.3 retro 段 | Slice 4.4 接力点 |
|------------------|----------------|
| D52 SSE parser | 不动 |
| D53 inline markdown | 不动 |
| D54 streaming state mgmt | 不动 |
| D55 AbortController infrastructure | ✅ D60 按钮接上, 利用 `streamController` 第 7 字段 |
| §实施路径 "延后到 4.4" 列表 | ✅ 5 个 deferred 项 (session 持久化 / 停止生成 / sidebar 切换 / 新建对话 / 清空对话) 全部 4.4 落地 |

---

## 跟主 agent 的一句话交接

**干就完了, 别纠结。** localStorage 一坨 JSON, URL 加 `?sid=X` 硬跳, toast 用 CSS variables 不引包, 停止按钮 3 行 onclick。**0 后端路由, 0 新依赖, 0 client.js 改动**。5 commits 收工。KaTeX / router / 云同步全留 Slice 5+, 4.4 不要 FOMO。

— ChatGPT, 2026-08-10