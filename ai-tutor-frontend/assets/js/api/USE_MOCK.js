// api/USE_MOCK.js — Mock 模式开关
// 优先级: URL ?mock=false > localStorage aitutor.useMock > .env > 默认 false
//
// 启用方式:
//   1. URL 加 ?mock=true 或 ?mock=false
//   2. localStorage.setItem('aitutor.useMock', 'true'|'false')
//   3. 改常量 USE_MOCK

const IS_BROWSER = typeof window !== 'undefined' && typeof document !== 'undefined';

const URL_PARAMS = IS_BROWSER ? new URLSearchParams(window.location.search) : new URLSearchParams();
const URL_MOCK = URL_PARAMS.get('mock');
const LS_MOCK = IS_BROWSER ? localStorage.getItem('aitutor.useMock') : null;

export const USE_MOCK = false;
export const MOCK_DELAY_MS = 0;

export const USE_MOCK_OVERRIDE = (() => {
  if (URL_MOCK === 'true') return true;
  if (URL_MOCK === 'false') return false;
  if (LS_MOCK === 'true') return true;
  if (LS_MOCK === 'false') return false;
  return null;
})();

export function setUseMock(v) {
  if (!IS_BROWSER) return;
  localStorage.setItem('aitutor.useMock', v ? 'true' : 'false');
  console.log('[MOCK]', v ? 'ON' : 'OFF', '(刷新页面生效)');
}
