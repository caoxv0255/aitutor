// tests/components/error-boundary.test.js — F3 基础: 全局兜底单测
//
// 覆盖:
//   1. SSR / window 不存在 → mountErrorBoundary() 返回 null
//   2. 注册 2 个 window listener (error + unhandledrejection)
//   3. window error Event → 兜底;  err 进 events;  banner shown
//   4. window unhandledrejection → kind = PROMISE
//   5. eb.handleError(err, 'API') 主动报告
//   6. 同 message 重复 → count 累加; banner text 显示 (×N)
//   7. unmount 后再派 error → 不再进 events
//   8. opts.onError 抛错不影响计数
//   9. mountErrorBoundary() 第二次调用返回同一 instance (idempotent)

// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mountErrorBoundary } from '../../ai-tutor-frontend/assets/js/components/error-boundary.js';

describe('mountErrorBoundary', () => {
  let eb;

  beforeEach(() => {
    delete window.__AIT_ERROR_BOUNDARY__;
  });
  afterEach(() => {
    if (eb) eb.unmount();
    eb = null;
  });

  it('mountErrorBoundary() 返回 instance, 注册 error + unhandledrejection', () => {
    eb = mountErrorBoundary();
    expect(eb).toBeTruthy();
    expect(typeof eb.handleError).toBe('function');
    expect(typeof eb.unmount).toBe('function');
    // window.__AIT_ERROR_BOUNDARY__ 也指向
    expect(window.__AIT_ERROR_BOUNDARY__).toBe(eb);
  });

  it('window error event → 兜底', () => {
    eb = mountErrorBoundary({ onError: () => {}, banner: stubBanner() });
    const err = new Error('boom');
    const ev = new ErrorEvent('error', { error: err, filename: 'x.js', lineno: 10 });
    window.dispatchEvent(ev);

    const events = eb.events();
    expect(events.length).toBe(1);
    expect(events[0].err).toBe(err);
    expect(events[0].kind).toBe('ERROR');
    expect(events[0].meta.filename).toBe('x.js');
    expect(events[0].count).toBe(1);
  });

  it('window unhandledrejection → kind = PROMISE', () => {
    eb = mountErrorBoundary({ onError: () => {}, banner: stubBanner() });
    const reason = new Error('async-boom');
    // 阻止 Promise.reject(reason) 自身再触发 unhandled (会污染测试进程)
    const p = Promise.reject(reason);
    p.catch(() => {});  // suppress
    const ev = new PromiseRejectionEvent('unhandledrejection', { reason, promise: p });
    window.dispatchEvent(ev);

    const events = eb.events();
    expect(events.length).toBe(1);
    expect(events[0].err).toBe(reason);
    expect(events[0].kind).toBe('PROMISE');
  });

  it('handleError(err, kind) 主动报告', () => {
    eb = mountErrorBoundary({ onError: () => {}, banner: stubBanner() });
    const err = Object.assign(new Error('API fail'), { type: 'SERVER', code: 'BOOM' });
    eb.handleError(err, 'API');

    const events = eb.events();
    expect(events.length).toBe(1);
    expect(events[0].err).toBe(err);
    expect(events[0].kind).toBe('API');
    expect(events[0].message).toBe('API fail');
  });

  it('同 message 重复 → count 累加', () => {
    eb = mountErrorBoundary({ onError: () => {}, banner: stubBanner() });
    const err = new Error('repeat');
    eb.handleError(err);
    eb.handleError(err);
    eb.handleError(err);

    const events = eb.events();
    expect(events.length).toBe(3);
    expect(events.map((e) => e.count)).toEqual([1, 2, 3]);
    expect(eb.counts().get('repeat')).toBe(3);
  });

  it('banner.show 收到 (×N) 累计', () => {
    const banner = stubBanner();
    eb = mountErrorBoundary({ onError: () => {}, banner });

    eb.handleError(new Error('dup-msg'));
    expect(banner.calls[0].count).toBe(1);

    eb.handleError(new Error('dup-msg'));
    expect(banner.calls[1].count).toBe(2);
  });

  it('opts.onError 抛错 → 计数不中断', () => {
    const onError = vi.fn(() => { throw new Error('onError-killer'); });
    eb = mountErrorBoundary({ onError, banner: stubBanner() });

    expect(() => eb.handleError(new Error('first'))).not.toThrow();
    expect(() => eb.handleError(new Error('first'))).not.toThrow();
    expect(eb.counts().get('first')).toBe(2);
    expect(onError).toHaveBeenCalledTimes(2);
  });

  it('unmount 后 handleError 变 noop, 全局 ref 删除, listener 解注册', () => {
    eb = mountErrorBoundary({ onError: () => {}, banner: stubBanner() });
    eb.handleError(new Error('before-unmount'));
    expect(eb.events().length).toBe(1);

    eb.unmount();

    // handleError unmount 后变 noop (避免被遗忘引用持续推 events)
    eb.handleError(new Error('after-unmount'));
    expect(eb.events().length).toBe(1);  // 没增加
    expect(eb._unmounted).toBe(true);

    // 全局 ref 清除
    expect(window.__AIT_ERROR_BOUNDARY__).toBeUndefined();
  });

  it('幂等: 第二次 mount 返回同一 instance', () => {
    const a = mountErrorBoundary({ onError: () => {}, banner: stubBanner() });
    eb = a;  // for afterEach unmount
    const b = mountErrorBoundary({ onError: () => {}, banner: stubBanner() });
    expect(b).toBe(a);
  });
});

function stubBanner() {
  return {
    _el: null,
    show(payload) { (this.calls = this.calls || []).push(payload); },
    hide() {},
  };
}
