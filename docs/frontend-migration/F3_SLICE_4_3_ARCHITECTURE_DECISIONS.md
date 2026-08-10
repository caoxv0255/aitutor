# F3 Slice 4.3 架构决策 (tutor SSE + Markdown)

> Code review 会议纪要 — ChatGPT (senior frontend engineer) 视角。
> 服务对象: 主 agent 实施 Phase 4.3。
> 决策基线日期: 2026-08-10。
> 跟 Slice 3 retro / CLAUDE.md F3 rules 完全对齐, 不破 5 个已有可复用 pattern。

---

## TL;DR — 4 个决策一句话总结

| ID | 决策 | 一句话理由 |
|----|------|-----------|
| **D52** | **fetch + ReadableStream** | 后端是 POST, EventSource 是 GET-only, 直接出局 |
| **D53** | **A 升级版** — Phase 3 escape 基础上 + 30 行 inline regex (`**bold**`, `` `code` ``, 行内 `$..$`), KaTeX/marked 留 Slice 4.5 | MVP 不背 200KB bundle, 数学公式降级到下一 slice |
| **D54** | **C 内联 + B 接口** — `tutor.html` 内联 fetch stream, 但 `tutor.askStream()` service 方法是公开入口 | 唯一消费者, YAGNI, 不污染 hook 层 |
| **D55** | **A AbortController** | 3 行代码, 切页面/browser refresh 自动 cancel, 后端 `req.on('close')` 已经接好 |

---

## D52. SSE 传输方式 → **选 B: fetch + ReadableStream**

### 推荐 + 理由

**用原生 `fetch` + `response.body.getReader()` (TextDecoderStream 包一下) 手动解 SSE 协议。**

理由只有一个, 不可商量:

1. **后端是 POST** (`api/routes/tutor-agent.js:619` `router.post('/ask/stream', ...)`)。EventSource 100% 不支持 body, 即使把 question 塞 query string 也违反 REST 语义且暴露敏感数据 (学科 + 知识点 id)。**选项 A 直接出局**, 不参与 trade-off。
2. **CLAUDE.md 钉死 "不引入新依赖除非必要"** — `eventsource-client` (microsoft) 整个包 16KB + polyfill 链 30KB, 完全不值。**选项 C 直接出局**。
3. 剩下 fetch。`fetch` 的 `response.body` 是 `ReadableStream<Uint8Array>`, 配 `TextDecoderStream` 拿到 utf8 字符串, 按 `\n\n` split event frame, 每帧按行解 `event:` + `data:`, 标准 SSE wire format 解析 ~30 行代码。

### 跟其他选项的 trade-off

| 选项 | 否决原因 |
|------|---------|
| A EventSource | GET-only, 后端是 POST, 改造后端代价 (改 query + 改 backend protocol) >> 写 30 行 parser |
| C eventsource-client | 违反 deps rule, 而且库的卖点 (auto reconnect) 我们用不到 — 教学 chat 失败就重发整条问题, 不是续传 |

### 实施示意

```js
// tutor.askStream() 内部:
const res = await fetch('/api/tutor/ask/stream', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
  body: JSON.stringify({ question, subject, knowledge_point_id }),
  signal,  // 来自 AbortController, 见 D55
});

const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
let buf = '';
while (true) {
  const { value, done } = await reader.read();
  if (done) break;
  buf += value;
  let idx;
  while ((idx = buf.indexOf('\n\n')) !== -1) {
    const frame = buf.slice(0, idx);
    buf = buf.slice(idx + 2);
    // parse "event: foo\ndata: {...}" → emit
    const ev = parseSseFrame(frame);  // { event, data }
    onEvent(ev);
  }
}
```

### 风险 / 边界

- **Buffer 边界**: SSE frame 可能被 TCP 切成两个 read chunk, 上面 `buf` 变量处理这种情况, 不能用 `buf.split('\n\n')` 直接同步消费。
- **错误响应**: 后端 SSE 走 happy path, 但若 LLM 启动前就 500 (如 auth 失败), response 不再是 `text/event-stream`, 而是普通 JSON `{message: ...}`。客户端必须先看 `res.headers.get('content-type')` — 不是 SSE 就 throw BUSINESS/SERVER, **不能**塞给 SSE parser (会无限循环死等 `\n\n`)。
- **Nginx buffer**: 后端已经发 `X-Accel-Buffering: no`, 反代层 OK。
- **超时**: SSE 默认 client.js 30s timeout 不适用 — 一个 chunk 间隔可能 > 30s (LLM 思考)。stream 路径**单独关** timeout, 由 `done` 事件终结, 错误靠 `error` 事件 + AbortController fallback (D55)。

---

## D53. Markdown 渲染 → **选 A 升级版** (Phase 3 escape + 30 行 inline regex), 推迟 B 到 4.5

### 推荐 + 理由

**Phase 3 现状 (`tutor.html:942`)**: `esc(msg.content).replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')` — 转义 + 段落/换行, 已是 MVP 渲染。

**升级**: 在 `assistantMessageTemplate` 内增加 **3 个** 顺序 regex replace, 在 esc **之后** 跑 (避免 HTML 注入):

1. `\*\*(.+?)\*\*` → `<strong>$1</strong>`
2. `` `(.+?)` `` → `<code class="...">$1</code>`
3. 行内 `$..$` → 用同一个 regex 标记 (e.g. 包 `<span class="math-latex" data-latex="..">$..$</span>`), **不渲染**公式 — 4.3 当字面字符显示, 等 4.5 引入 KaTeX 时再 hydration。

理由:

1. **MVP 不背 200KB bundle**: marked (35KB) + KaTeX (270KB gzip) 对一个学生端 PWA 太重, 高考/中考用户网络环境差。CLAUDE.md 钉死 "不引入新依赖除非必要", 数学公式的 UX 不是 "必要", 是 "nice to have"。
2. **风险隔离**: 全部内联在 `assistantMessageTemplate`, 不引 hook 不改 service 不动 mock, 改动面 ~30 行, **0 fix commit 概率高**。
3. **后端 HTML 化** (选项 C) **否决**: ① XSS 风险 (LLM 输出如果被 prompt injection 攻击, 可注 `<script>`); ② 违反 envelope contract (response 字段目前是纯文本, 不是 HTML 片段); ③ Phase 3 已经建立的 escape + template 分层是正确架构, 倒退。

### 跟其他选项的 trade-off

| 选项 | 否决 / 推迟原因 |
|------|---------------|
| A 纯文本 | 数学公式 `$y=ax^2+bx+c$` 直接当字面字符给高中生看, 产品上不可接受, **所以升级** |
| B marked + KaTeX | bundle 太大, MVP 不必要; 4.5 单独 slice 引入, 配 code-splitting / CDN async load |
| C 后端 HTML 化 | XSS + 改 protocol 双重风险, 一票否决 |

### 实施示意

```js
function renderInlineMd(escapedText) {
  return escapedText
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`\n]+)`/g, (_, code) => `<code class="px-1 py-0.5 rounded text-[13px]" style="background:var(--surface-dim);">${code}</code>`)
    .replace(/\$([^$\n]+)\$/g, (_, latex) => `<span class="math-latex" data-latex="${latex}">$${latex}$</span>`);
}

// assistantMessageTemplate 内:
const responseHtml = renderInlineMd(esc(msg.content || ''))
  .replace(/\n\n/g, '</p><p class="mb-3 mt-3">')
  .replace(/\n/g, '<br>');
```

### 风险 / 边界

- **regex 顺序**: escape **先** 跑 (`esc()` 把 `<` 变 `&lt;`), markdown replace **后** 跑 (吃 `<strong>` 等字面量)。**不能反过来** — 否则 LLM 输出 `` `code` `` 里的 `<` 被先转义, regex 还能匹配, 但 LLM 输出 ``<script>`` 会被 escape 保护住。
- **`**` 嵌套**: LLM 偶尔输出 `***bold-italic***`, 我们的 regex 不处理三层嵌套 — 4.3 MVP 不 care, 留 4.5 marked 处理。
- **code block (```)**: 不在 4.3 处理 — LLM 偶尔输出多行 ``` 代码块, 会保留为字面 `` ``` `` + 换行, 用户看到原文。**接受** (不是高频场景)。
- **`$..$` 误判**: 价格 / 数学变量都可能用 `$`, LLM 输出里出现 `$x=1$` 是公式, `$5 dollars` 是价格。我们的 regex 不区分 — 但高中教学语境下价格几乎不会出现, **接受误判率**。
- **4.5 hydration path**: `data-latex` 属性保留, 4.5 引入 KaTeX 后扫 DOM `[data-latex]` 替换。

---

## D54. Streaming 状态管理 → **选 C 主体 (tutor.html 内联) + B 接口 (tutor.askStream 是 service 方法)**

### 推荐 + 理由

**`tutor.html` module script 内联实现 SSE consumer; 但暴露入口在 `assets/js/api/services/tutor.js` 的 `askStream()` 方法上**, 这样:

- 调用形态跟 `tutor.ask()` / `tutor.getHistory()` 保持一致 (F3 service-layer 纪律);
- 实现细节 (fetch + ReadableStream parser) 封在 service 里, page 只看到 subscribe callback API;
- 不新建 `useStreamingResource` hook — **YAGNI**。

理由:

1. **唯一消费者**: 当前只有 tutor 用 SSE, vision / review / exam 都不流式输出。Hook 抽象需要 ≥2 消费者才划算, 现在 0 个。
2. **Phase 3 imperative 兼容**: `conversationState` 已经是 6 字段直接赋值, `messages` array push 的 imperative 风格, 内联 fetch + chunk 回调 push 进 `messages[last].content += delta` 是最贴合的写法。
3. **CLAUDE.md 兼容**: service 加一个 `askStream()` 方法**不破** envelope contract (`client.js` 不改), 不引入依赖, 不动 useAsyncResource。
4. **选项 A (useStreamingResource) 否决**: 通用 hook 需要解决并发 / 重连 / partial state 通用化 — 这些在 4.3 都是 over-engineering。F3 retro 5 个 pattern 全是"页面级", 跟 hook 抽象气质不符。

### 跟其他选项的 trade-off

| 选项 | 否决 / 推迟原因 |
|------|---------------|
| A useStreamingResource | 单消费者, YAGNI; 真要做也得等 vision 或 review 流式需求出来再抽 (4.5+) |
| B tutor.js 完全封装 stream + subscribe | **部分采用** — service 暴露 `askStream(opts, onEvent)`, page 内联 onEvent callback 实现 state 更新 |
| C 全内联 | 部分采用 — 解析逻辑在 service, state 更新在 page |

### 实施示意 (service 层)

```js
// services/tutor.js 新增:
async function askStream({ question, knowledgePointId, subject, currentTopicName, signal, onEvent }, opts = {}) {
  if (getMockEnabled()) {
    return askStreamMock({ question, knowledgePointId, subject }, onEvent, opts.mockName || 'tutor_ask_stream');
  }
  const res = await fetch(API_BASE + '/api/tutor/ask/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
    body: JSON.stringify({ question, knowledge_point_id: knowledgePointId, subject, current_topic_name: currentTopicName }),
    signal,
  });
  if (!res.headers.get('content-type')?.includes('text/event-stream')) {
    // 非 SSE → 抛 ApiError
    const text = await res.text();
    throw new ApiError('SSE endpoint returned non-stream', ErrorType.SERVER, { status: res.status, body: text });
  }
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buf = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += value;
    let idx;
    while ((idx = buf.indexOf('\n\n')) !== -1) {
      const frame = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      onEvent(parseSseFrame(frame));  // { event: 'content', data: { delta: '...' } }
    }
  }
}
```

### 实施示意 (page 层, tutor.html sendMessage 改造)

```js
// 取代 Phase 3 的 await tutor.ask():
const assistantMsg = { role: 'assistant', content: '', diagnosis: null, context: null, metadata: null, timestamp: Date.now() };
conversationState.messages.push(assistantMsg);
conversationState.loading = true;
renderLoading();
renderMessages(conversationState.messages);

const controller = new AbortController();  // D55
conversationState.streamController = controller;

try {
  await tutor.askStream(
    { question, subject: conversationState.subject, signal: controller.signal },
    (ev) => {
      if (ev.event === 'metadata') {
        assistantMsg.diagnosis = ev.data.diagnosis;
        assistantMsg.context = ev.data.context;
        assistantMsg.metadata = ev.data.metadata;
        // Phase 4 UX: 立即渲染诊断卡片 (msg 已 push, renderMessages 会触发)
        renderMessages(conversationState.messages);
      } else if (ev.event === 'content') {
        assistantMsg.content += ev.data.delta;
        // 节流 render: 30ms 节流, 避免每字符触发 scroll 重排
        throttledRender();
      } else if (ev.event === 'error') {
        assistantMsg.error = { type: 'STREAM', code: null, message: ev.data.message };
      } else if (ev.event === 'done') {
        assistantMsg.duration_ms = ev.data.duration_ms;
      }
    }
  );
} catch (err) {
  // AbortError = 用户主动停, 不算 error
  if (err.name !== 'AbortError') {
    assistantMsg.error = { type: err.type || 'UNKNOWN', code: err.code, message: err.message };
  }
} finally {
  conversationState.loading = false;
  conversationState.streamController = null;
  renderMessages(conversationState.messages);
  renderLoading();
}
```

### 风险 / 边界

- **throttle 渲染**: SSE chunk 频率可能 50-200/s, 每 chunk 触发 `renderMessages` 会让 scroll 重排抖。必须 throttle (e.g. `requestAnimationFrame` 合并, 或 30ms `setTimeout` debounce)。这是 4.3 唯一可能的"额外复杂度点", 跟 Slice 3 retro "0 fix commit" 目标强相关, 测试时务必手动开 devtools 验证。
- **metadata 在 content 之前**: 后端协议保证 metadata 先到, 诊断卡片可立即渲染 (而不是等流结束再补)。这是体验加分项, 不要搞错顺序。
- **error 事件 vs throw**: SSE `error` 事件是**业务错误** (LLM 推理失败), 客户端 callback 写进 message.error。fetch reject 是**传输错误** (网络断), 进 catch。两者处理路径分开。
- **page reload 取消**: 见 D55。
- **store 旧 sendMessage**: Phase 3 的 `try/catch/finally` 包了 `tutor.ask()` 整段, 4.3 改造时先复制一份再改, **不要原地改**, 便于 review diff。

---

## D55. 中断 / 取消策略 → **选 A: AbortController**

### 推荐 + 理由

**新建 `AbortController`, 在 `sendMessage` 开始时实例化, 挂到 `conversationState.streamController`, 关闭浏览器 tab / 刷新页面 / 切换路由 (未来) 时 `controller.abort()`。**

理由:

1. **3 行代码, 0 依赖**: `new AbortController()`, fetch 第二参数 `signal: controller.signal`, 关闭时 `controller.abort()` — 浏览器原生。
2. **后端已经接好**: `tutor-agent.js:632` `req.on('close', () => { closed = true; })` + `sendEvent` 检查 `closed`, fetch 一断, 后端立刻停止 LLM 推理循环 (`for await` 检查 `closed`)。**前后端联动已经 ready**, 客户端只要发起 abort。
3. **切页面 = 自动 cancel**: 即使 page layer 忘了 `controller.abort()`, 用户切到 dashboard 或别的 tab, **浏览器自动关闭 fetch connection**, 触发后端 `req.on('close')`。AbortController 是"显式控制"层, 浏览器 native cancel 是兜底层, 两者叠加。
4. **MVP 不需要 "停止生成" 按钮**: 用户在 streaming 中途想停, **关 tab 就行** (高考学生心智模型)。"停止" 按钮是 4.4 nice-to-have, **4.3 不做**。

### 跟其他选项的 trade-off

| 选项 | 否决 / 推迟原因 |
|------|---------------|
| A AbortController | ✅ 选, 见上 |
| B 客户端断连检测 | **已经隐含包含** — `req.on('close')` 在 backend, fetch 断连自动 fire。客户端不需要单独实现, 只是让 A 选项更完整 |
| C 都不做 | 否决 — 浪费 LLM token + 带宽 + 后端 CPU; 后端 `for await` 循环会跑到 LLM 流自然结束 (可能 30s+), 期间资源锁住 |

### 实施示意

```js
// conversationState 增加第 7 字段:
const conversationState = {
  subject: '数学',
  currentSessionId: null,
  sessions: [],
  messages: [],
  loading: false,
  error: null,
  streamController: null,  // NEW: 当前 SSE 的 AbortController, 用于切换页面时 abort
};

// sendMessage 入口:
const controller = new AbortController();
conversationState.streamController = controller;

// beforeunload (切页面 / refresh 兜底):
window.addEventListener('beforeunload', () => {
  if (conversationState.streamController) {
    conversationState.streamController.abort();
  }
});
```

### 风险 / 边界

- **AbortError 处理**: catch 里要 `if (err.name === 'AbortError') return;` — abort **不是** error, 不写进 `message.error`, 不弹 toast。
- **beforeunload 时机**: 浏览器关 tab 时 fetch 可能来不及 abort, 但 backend 的 `req.on('close')` 兜底, **资源仍能释放**。beforeunload 是 best-effort。
- **未来 4.4 "停止" 按钮**: button `onclick` → `conversationState.streamController.abort()`, catch 里 graceful stop (当前 message 保留, status 标 `aborted`)。
- **重连**: 4.3 不做 — 流断了就当 error, 让用户重新点发送。auto-reconnect 是 4.5+ 的事, EventSource 的卖点我们不要 (见 D52)。

---

## 实施路径建议 (commit 拆分 + DoD + 验证)

**核心约束**: 1 sub-feature = 1 commit, 0 fix commit 目标, mock 必须能 work (SSE mock 用 JSON array replay, 见下)。

### Mock 设计 (前置, 不单独占 commit, 跟 sub-feature 1 一起)

**问题**: 后端 SSE 是流, 现有 `client.js` mock convention 是单个静态 JSON 文件。

**方案**: 新增 `assets/js/api/mock/tutor_ask_stream.json`, 内容是**事件序列**:

```json
{
  "events": [
    { "event": "metadata", "data": { "diagnosis": {...}, "context": {...}, ... }, "delay_ms": 50 },
    { "event": "content", "data": { "delta": "好的，" }, "delay_ms": 100 },
    { "event": "content", "data": { "delta": "我们" }, "delay_ms": 150 },
    { "event": "content", "data": { "delta": "来求解这道二次函数题。" }, "delay_ms": 120 },
    ...
    { "event": "done", "data": { "duration_ms": 3450, "content_length": 420 }, "delay_ms": 0 }
  ]
}
```

Service 层 `askStream()` 走 mock 时: `for (const e of mock.events) { await sleep(e.delay_ms); onEvent({event: e.event, data: e.data}); }` — 模拟真实 SSE 时序, 验证 page 层的 throttledRender / metadata 立即渲染 等 UX。

**不做**: 真实 wire format `.sse` 文件 — Python http.server MIME 处理不一致, 增加 dev server 复杂度, 不值。

### Commit 拆分 (推荐 4 commits, 每个独立可验证)

| # | Commit | 内容 | DoD | 验证 |
|---|--------|------|-----|-----|
| **1** | `feat(tutor): SSE parser + askStream service skeleton (mock-friendly)` | ① 新增 `assets/js/api/mock/tutor_ask_stream.json` (10 events: 1 metadata + 8 content + 1 done); ② `services/tutor.js` 新增 `askStream(opts, onEvent)`, 含 SSE parser + content-type 校验 + mock replay; ③ `tutor.html` import + console.log 验证 (暂不接 UI) | `python3 -m http.server 9001 --directory ai-tutor-frontend` + `?mock=true`, console 看到 10 个 `{event, data}` 顺序输出 | Browser: F12 console / Network: mock JSON 200 |
| **2** | `feat(tutor): streaming chat UI + metadata-first render (Phase 3 sendMessage 改造)` | ① `sendMessage` 改用 `tutor.askStream`; ② `conversationState.streamController` 第 7 字段; ③ assistant message 即时 push, content 累加; ④ `renderMessages` 节流 (rAF); ⑤ metadata 事件触发诊断卡片立即渲染; ⑥ D55 `beforeunload` abort; ⑦ `pickMockName` 加 `tutor_ask_stream` | 浏览器发问 → 字符一个一个蹦出 → 诊断卡 (skip_allowed=false) 在第一段之前出现 → 流结束 → "加入错题本" 按钮可点 (Slice 3.2 不回归) | Browser: 录屏 / 截图存 `.hermes/cache/screenshots/slice-4.3-stream.png`; F12 Network: 0 SSE event 丢失, 顺序正确 |
| **3** | `feat(tutor): inline markdown regex (bold / code / latex placeholder)` | ① `assistantMessageTemplate` 抽出 `renderInlineMd(escapedText)`; ② 3 个 regex (顺序: escape → markdown); ③ `.math-latex` span + `data-latex` 属性; ④ CSS: `.math-latex` 斜体灰色提示 "4.5 渲染" | mock 内容含 `**粗体** / \`code\` / $y=ax^2$` → 浏览器看到粗体/code box/斜体 latex span; LLM 输出 ``<script>`` 仍被 escape | Browser: 手动注入 ``<script>alert(1)</script>`` → 无 alert; mock fixture 含 markdown 片段 |
| **4** | `docs(tutor): F3 Slice 4.3 retrospective` | retro 文档, 引用本决策 memo + Slice 3 §2.2-2.6 5 个 pattern, 记录 0 fix commit (or 实际 fix 数), 标记 D52/D53/D54/D55 落地状态 | 文档可读, commit hash 填齐, GitHub 链接 OK | Git: `git log --oneline` 显示 4 commits 顺序对应 |

### 整体 DoD (Slice 4.3 完成定义)

- [ ] 4 commits, 无 fix commit (除非真出问题)
- [ ] Browser 验证: mock 模式 + 真实后端模式 (如果 :3002 启了) 都跑通
- [ ] Network 验证: mock JSON 200 + 真后端 SSE event-stream 200, content-type 正确
- [ ] Git 验证: commit message 含 "Slice 4.3", 引用 D52-D55 决策编号
- [ ] 不破 Slice 3.2: "加入错题本" 按钮仍可用
- [ ] 不破 conversationState 6 → 7 字段契约 (streamController 加在末尾, 不插队)
- [ ] **不**引入新 npm 依赖
- [ ] **不**改 `client.js` 拆信封
- [ ] mock 文件 `tutor_ask_stream.json` schema 文档化 (在本 retro 文档 §Mock Schema 一节)

### 验证清单 (主 agent 实施时 checklist)

```
□ Commit 1: console.log 看到 10 events 顺序
□ Commit 2: 浏览器录屏字符递增 + 诊断卡先出现 + 流结束后按钮可点
□ Commit 2: F12 Network → EventStream 分页 → 看到 metadata/content/done 顺序
□ Commit 2: 切换到 dashboard.html → 回 tutor.html → 无残留 loading state
□ Commit 3: mock fixture 含 ** / ` / $ 三种语法 → 浏览器渲染正确
□ Commit 3: 手动 XSS 测试 <script> 注入 → 无弹窗
□ Commit 4: retro 文档完整, 引用本 memo 链接 (docs/frontend-migration/F3_SLICE_4_3_ARCHITECTURE_DECISIONS.md)
```

### 延后到 4.4 / 4.5 (不在 4.3 范围)

- "停止生成" 按钮 → 4.4
- marked + KaTeX hydration → 4.5
- auto-reconnect / 重试 → 4.5+
- session 持久化 (currentSessionId 真正写入) → 4.4
- `useStreamingResource` hook 抽象 → 5+ 消费者再抽 (当前 1 个)

---

## 跟 F3 已固化规则的兼容性自检

| Rule | 4.3 决策是否冲突 |
|------|----------------|
| 不改 `client.js` 拆信封 | ✅ 不改 client.js, 新增 `askStream` 是 service 层加方法 |
| 不引入新依赖 | ✅ 0 npm add |
| Mock convention (`request(..., { mockName })`) | ⚠️ `askStream` **不**走 `request()`, 走 `getMockEnabled()` 直查 mock 文件 — 但保持 mockName 参数语义一致; 文档化在 retro §Mock Schema |
| `useAsyncResource` 强制 | ✅ 不强制套, `sendMessage` 沿用 imperative; SSE 生命周期跟 async resource 不同 |
| 5 个可复用 pattern (Slice 3 §2.2-2.6) | ✅ Filter State (subject 切换) + Event Delegation (加入错题本) + Matched/Total (history sidebar) 全部沿用 |
| Page Shell Adapter | ✅ tutor 是 Workspace Shell (CLAUDE.md L249 已 pending), 4.3 不动 shell, 只动 chat 内部 |
| 0 fix commit | ✅ 4 commits 全 reviewable, mock fixture 提前 design 避免反复 |

---

## 跟主 agent 的一句话交接

**干就完了, 别纠结。** SSE 解析 30 行, mock fixture 一个 JSON 文件, throttle 一个 rAF, XSS 守住 esc 顺序。4 commits 收工。KaTeX / 停止按钮 / hook 抽象全留 4.4+, 4.3 不要 FOMO。

— ChatGPT, 2026-08-10