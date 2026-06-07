/**
 * tutor-stream.js — SSE 流式教学响应解析器
 *
 * 前端"零计算"工具：仅解析后端 SSE 事件流，触发 UI 回调。
 * 使用原生 fetch + ReadableStream，不引入任何重型依赖。
 *
 * 事件协议：
 *   event: metadata  → 结构化诊断数据（先到达，前端立即渲染侧边栏）
 *   event: content   → LLM 教学文本 delta（流式追加，打字机效果）
 *   event: done      → 流结束，携带 duration_ms 统计
 *   event: error     → 错误信息
 *
 * 使用示例：
 *   import { askTutorStream } from './tutor-stream.js';
 *
 *   const abort = askTutorStream({
 *     question: '如何求解二次方程？',
 *     knowledge_point_id: 'kp_math_001',
 *   }, {
 *     onMetadata(meta) { renderDiagnosisCard(meta); },
 *     onContent(delta) { appendTypewriter(delta); },
 *     onDone(stats)    { showComplete(stats); },
 *     onError(err)     { showError(err); },
 *   });
 *
 *   // 取消请求: abort();
 */

function getAuthToken() {
  return localStorage.getItem('authToken');
}

/**
 * 发起流式教学请求并解析 SSE 事件
 *
 * @param {object} params - 请求参数
 * @param {string} params.question - 学生提问
 * @param {string} [params.knowledge_point_id] - 知识点 ID
 * @param {string} [params.subject] - 学科
 * @param {string} [params.current_topic_name] - 知识点名称
 * @param {object} callbacks - 事件回调
 * @param {function} callbacks.onMetadata - (metadata: object) => void
 * @param {function} callbacks.onContent - (delta: string) => void
 * @param {function} [callbacks.onDone] - (stats: object) => void
 * @param {function} [callbacks.onError] - (error: object) => void
 * @returns {function} abort - 调用此函数可取消请求
 */
export function askTutorStream(params, callbacks) {
  const controller = new AbortController();
  const token = getAuthToken();

  const doFetch = async () => {
    try {
      const response = await fetch('/api/tutor/ask/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(params),
        signal: controller.signal,
      });

      if (response.status === 401) {
        window.location.href = '/index.html';
        return;
      }

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        callbacks.onError?.({ message: errData.message || `HTTP ${response.status}` });
        return;
      }

      await parseSSEStream(response.body, callbacks);
    } catch (err) {
      if (err.name !== 'AbortError') {
        callbacks.onError?.({ message: err.message });
      }
    }
  };

  doFetch();

  // 返回 abort 函数
  return () => controller.abort();
}

/**
 * 解析 SSE 流（使用 ReadableStream reader）
 *
 * SSE 格式：
 *   event: <type>\n
 *   data: <json>\n
 *   \n
 */
async function parseSSEStream(body, callbacks) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let currentEvent = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // 按双换行分割完整的 SSE 事件块
    const blocks = buffer.split('\n\n');
    buffer = blocks.pop(); // 保留未完整的事件块

    for (const block of blocks) {
      if (!block.trim()) continue;

      const lines = block.split('\n');
      let eventData = '';

      for (const line of lines) {
        if (line.startsWith('event:')) {
          currentEvent = line.slice(6).trim();
        } else if (line.startsWith('data:')) {
          eventData = line.slice(5).trim();
        }
      }

      if (!eventData) continue;

      try {
        const parsed = JSON.parse(eventData);
        dispatchEvent(currentEvent, parsed, callbacks);
      } catch {
        // 非 JSON data，作为纯文本处理
        if (currentEvent === 'content') {
          callbacks.onContent?.(eventData);
        }
      }

      currentEvent = '';
    }
  }

  // 处理 buffer 中残余数据
  if (buffer.trim()) {
    const lines = buffer.split('\n');
    let eventData = '';
    let eventType = '';

    for (const line of lines) {
      if (line.startsWith('event:')) eventType = line.slice(6).trim();
      else if (line.startsWith('data:')) eventData = line.slice(5).trim();
    }

    if (eventData) {
      try {
        const parsed = JSON.parse(eventData);
        dispatchEvent(eventType, parsed, callbacks);
      } catch {
        // 忽略
      }
    }
  }
}

/**
 * 根据事件类型分发回调
 */
function dispatchEvent(eventType, data, callbacks) {
  switch (eventType) {
    case 'metadata':
      callbacks.onMetadata?.(data);
      break;
    case 'content':
      callbacks.onContent?.(data.delta || '');
      break;
    case 'done':
      callbacks.onDone?.(data);
      break;
    case 'error':
      callbacks.onError?.(data);
      break;
    default:
      // 未知事件类型，忽略
      break;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 打字机效果辅助组件
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 创建打字机效果渲染器
 *
 * @param {HTMLElement} container - 文本容器元素
 * @param {object} [options]
 * @param {number} [options.batchMs=16] - 批量渲染间隔（ms），避免频繁 DOM 操作
 * @returns {{ append: function, complete: function }}
 */
export function createTypewriter(container, options = {}) {
  const { batchMs = 16 } = options;
  let pending = '';
  let timer = null;

  function flush() {
    if (!pending) return;
    // 使用 innerHTML 追加（支持 Markdown 渲染后的 HTML）
    container.innerHTML += pending;
    pending = '';

    // 自动滚动到底部
    container.scrollTop = container.scrollHeight;
  }

  return {
    /** 追加文本 delta（缓冲区批量渲染） */
    append(delta) {
      pending += delta;
      if (!timer) {
        timer = setTimeout(() => {
          flush();
          timer = null;
        }, batchMs);
      }
    },

    /** 立即刷新所有缓冲内容 */
    complete() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      flush();
    },
  };
}
