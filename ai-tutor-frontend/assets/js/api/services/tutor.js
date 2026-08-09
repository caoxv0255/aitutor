// services/tutor.js — 教学 Agent (F3 Slice 4 Phase 1 read-only MVP)
// 域: pedagogical chat agent (跟 rag.ask 不同, 走 /api/tutor/ask, 有 diagnosis/learning_path)
// 后端: api/routes/tutor-agent.js → askTutorAgent()
// envelope: backend successResponse (data + message, 无 pagination)
// Slice 4.1/4.2/4.3 (deferred): askStream / getHistory / getMastery / session 持久化
// Phase 1 不接 SSE, 不接 history 持久化, 不接 cross-page
import { request, getMockEnabled, loadMock, getApiBase, getToken, ApiError, ErrorType } from '../client.js';

// ===== Slice 4.3 SSE parser helper (D52) =====
function parseSseFrame(frame) {
  if (!frame) return null;
  const lines = frame.split('\n');
  let event = 'message';
  let data = '';
  for (const line of lines) {
    if (line.startsWith('event:')) {
      event = line.slice(6).trim();
    } else if (line.startsWith('data:')) {
      const raw = line.slice(5).trim();
      data += raw;
    }
  }
  if (!data) return { event, data: '' };
  try { return { event, data: JSON.parse(data) }; }
  catch (_) { return { event, data }; }
}

export const tutor = {
  /**
   * 单次问答 (non-streaming)
   * @param {object} opts
   * @param {string} opts.question       — 必填
   * @param {string} [opts.knowledgePointId]
   * @param {string} [opts.subject]      — '数学' 等 (backend 自己处理中文/英文)
   * @param {string} [opts.currentTopicName]
   * @returns {Promise<{success, message, data: TutorResponse}>}
   */
  async ask({ question, knowledgePointId, subject, currentTopicName, mockName } = {}) {
    if (!question) throw new Error('tutor.ask: question required');
    return request('POST', '/api/tutor/ask', {
      question,
      knowledge_point_id: knowledgePointId,
      subject,
      current_topic_name: currentTopicName,
    }, { mockName: mockName || 'tutor_ask' });
  },
  /**
   * 会话历史列表 (Phase 2: render adapter only; backend /api/tutor/sessions 待 Slice 4.4 实现)
   * @returns {Promise<{success, message, data: ChatSession[]}>}
   */
  async getHistory() {
    return request('GET', '/api/tutor/sessions', null, { mockName: 'tutor_history' });
  },
  /**
   * SSE 流式教学 Agent 推理 (Slice 4.3 commit 1: parser + mock skeleton)
   * @param {object} opts
   * @param {string} opts.question
   * @param {string} [opts.knowledgePointId]
   * @param {string} [opts.subject]
   * @param {string} [opts.currentTopicName]
   * @param {AbortSignal} [opts.signal]       — D55 AbortController 取消
   * @param {function} opts.onEvent            — callback({event, data})
   * @param {string} [opts.mockName='tutor_ask_stream']  — mock fixture name
   * @returns {Promise<void>}                    — 走 SSE 流, 不返回单次结果
   */
  async askStream({ question, knowledgePointId, subject, currentTopicName, signal, onEvent, mockName } = {}) {
    if (!question) throw new Error('tutor.askStream: question required');
    if (typeof onEvent !== 'function') throw new Error('tutor.askStream: onEvent callback required');

    // Mock 路径: replay events array with delay_ms 模拟流时序
    if (getMockEnabled()) {
      const { loadMock } = await import('../client.js');
      const mock = await loadMock(mockName || 'tutor_ask_stream');
      const events = (mock && mock.events) || [];
      for (const e of events) {
        if (signal && signal.aborted) return;
        if (e.delay_ms && e.delay_ms > 0) {
          await new Promise((resolve) => {
            const timer = setTimeout(resolve, e.delay_ms);
            if (signal) signal.addEventListener('abort', () => clearTimeout(timer), { once: true });
          });
          if (signal && signal.aborted) return;
        }
        onEvent({ event: e.event, data: e.data });
      }
      return;
    }

    // 真实 SSE 路径: fetch + ReadableStream
    const res = await fetch(getApiBase() + '/api/tutor/ask/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(getToken() ? { 'Authorization': `Bearer ${getToken()}` } : {}) },
      body: JSON.stringify({
        question,
        knowledge_point_id: knowledgePointId,
        subject,
        current_topic_name: currentTopicName,
      }),
      signal,
    });
    // D52 关键: content-type 校验, 非 SSE 走错误处理
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('text/event-stream')) {
      // 业务错误: backend 返回普通 JSON
      const body = await res.json().catch(() => ({}));
      const err = new ApiError(
        body.message || '请求失败',
        ErrorType.BUSINESS,
        { status: res.status, code: body.errorCode || null, body }
      );
      onEvent({ event: 'error', data: { message: err.message, type: err.type, code: err.code } });
      throw err;
    }

    // SSE parser: pipe through TextDecoderStream, split on \n\n frames
    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
    let buf = '';
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (signal && signal.aborted) return;
      buf += value;
      let idx;
      while ((idx = buf.indexOf('\n\n')) !== -1) {
        const frame = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        // Parse "event: foo\ndata: {...}"
        const ev = parseSseFrame(frame);
        if (ev) onEvent(ev);
      }
    }
  },
  // Slice 4.3 commit 2/3/4 (deferred):
  // async getMastery(kpId) { ... }   → GET /api/tutor/mastery/:kpId
};