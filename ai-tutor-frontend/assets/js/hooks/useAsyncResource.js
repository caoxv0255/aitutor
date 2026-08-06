// assets/js/hooks/useAsyncResource.js — F3 基础: 替代 loading/error/data + useState/useEffect 三件套
//
// 用法 (vanilla JS, 无 React 依赖):
//
//   import { useAsyncResource, createAsyncResource } from '../assets/js/hooks/useAsyncResource.js';
//
//   // 1) 直接 API: create + 手动 control
//   const res = createAsyncResource(() => user.getDashboard());
//   res.refetch();      // 触发首次
//   const s = res.read();
//   const unsub = res.subscribe(({ data, loading, error }) => render(s));
//
//   // 2) Sugar: 一次完成 create + 立即 refetch
//   const res = useAsyncResource(() => user.getDashboard());
//
// 状态机:
//   idle → loading → (success | error)  ─→ refetch → loading → ...
//
// 并发:
//   多次 refetch() 时, 用 runId 追踪, stale fetch 丢弃结果 (last-write-wins).
//
// ErrorType: 对 ApiError 透传 (.type / .code), 不做额外分类.
//
// 浏览器外用法: SSR / Node (没 window), 不报错. fetcher 正常跑.

/**
 * @typedef {Object} AsyncResourceState
 * @property {*} data
 * @property {boolean} loading
 * @property {Error|null} error
 * @property {number} version   — 每次 state 变更 +1, 用于 snapshot 比对
 */

/**
 * @typedef {Object} AsyncResource
 * @property {() => AsyncResourceState} read       — 同步取当前 state
 * @property {(cb: (s: AsyncResourceState) => void) => () => void} subscribe
 *                                                  — 订阅变化, 立即触发 cb 一次; 返回 unsubscribe
 * @property {() => Promise<*>} refetch           — 手动重试, 返回 fetcher 的 promise (含 stale 检测)
 */

/**
 * 工厂函数 — 不自动启动, 给需要手动控制的场景 (例如: 配 IntersectionObserver 后再触发)
 * @param {() => Promise<*>} fetcher
 * @returns {AsyncResource}
 */
export function createAsyncResource(fetcher) {
  /** @type {AsyncResourceState} */
  let state = { data: null, loading: true, error: null, version: 0 };
  const subs = new Set();
  let currentRunId = 0;

  function setState(patch) {
    // diff skip: 避免 listener 收到 no-op (e.g. loading=true 重复设)
    let changed = false;
    for (const k of Object.keys(patch)) {
      if (state[k] !== patch[k]) { changed = true; break; }
    }
    if (!changed) return;
    state = { ...state, ...patch, version: state.version + 1 };
    for (const cb of subs) {
      try { cb(state); } catch (_) { /* subscriber 自己负责 */ }
    }
  }

  async function run() {
    const runId = ++currentRunId;
    setState({ loading: true, error: null });
    try {
      const data = await fetcher();
      if (runId !== currentRunId) return undefined;  // stale, 丢弃
      setState({ loading: false, error: null, data });
      return data;
    } catch (error) {
      if (runId !== currentRunId) return undefined;  // stale, 丢弃
      setState({ loading: false, error });
      return undefined;
    }
  }

  return {
    read() { return state; },
    subscribe(cb) {
      subs.add(cb);
      try { cb(state); } catch (_) { /* 测试单点 */ }
      return () => { subs.delete(cb); };
    },
    refetch() { return run(); },
  };
}

/**
 * Sugar — create + 立即 refetch.  适合"挂载就拉"的 page 场景.
 * @param {() => Promise<*>} fetcher
 * @returns {AsyncResource}
 */
export function useAsyncResource(fetcher) {
  const r = createAsyncResource(fetcher);
  r.refetch();
  return r;
}
