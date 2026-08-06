// api/USE_MOCK.js — Mock 模式开关 (D1: 删 import-time IIFE, 全 lazy)
//
// 启用方式:
//   1. URL 加 ?mock=true 或 ?mock=false
//   2. localStorage.setItem('aitutor.useMock', 'true'|'false')
//
// 设计: 不在 import-time 算任何状态 — 全部 lazy, request() 每次调用现算.
//       这避免 ES Module import-time freeze: setUseMock(true) 之后调 request() 立即生效.
// 优先级: URL ?mock > LS aitutor.useMock > 常量 USE_MOCK (默认 false)

const IS_BROWSER = typeof window !== 'undefined' && typeof document !== 'undefined';

// 默认 mock 关闭 (走真后端). 改这里强制翻默认.
export const USE_MOCK = false;

// mock 模拟网络延迟 (ms). 0 = 不延迟. 调试 RAG loading UI 时可设 600.
export const MOCK_DELAY_MS = 0;

/**
 * Lazy 算 mock 模式是否启用. 每次 request() 调一次, 不缓存.
 * @returns {boolean}
 */
export function getMockEnabled() {
  if (!IS_BROWSER) return USE_MOCK;  // SSR / 测试 fallback
  try {
    // 1. URL 优先 (一键强制)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('mock')) {
      return urlParams.get('mock') !== 'false';
    }
    // 2. LS 持久设置
    const ls = localStorage.getItem('aitutor.useMock');
    if (ls === 'true' || ls === '1') return true;
    if (ls === 'false' || ls === '0') return false;
    // 3. 常量 fallback
    return USE_MOCK;
  } catch (_) {
    return USE_MOCK;
  }
}

/**
 * 写 LS 切换 mock. 立即生效 (因 getMockEnabled lazy 读).
 * @param {boolean} v
 */
export function setUseMock(v) {
  if (!IS_BROWSER) return;
  localStorage.setItem('aitutor.useMock', v ? 'true' : 'false');
  console.log('[MOCK]', v ? 'ON' : 'OFF', '(下次 request 立即生效)');
}
