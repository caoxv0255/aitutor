// tests/hooks/useAsyncResource.test.js — F3 基础 hook 单测
//
// 覆盖:
//   1. 初始 loading=true, data=null, error=null
//   2. fetcher resolve → data 有值, loading=false, version +1
//   3. fetcher reject → error 有值, loading=false, data 保持 null
//   4. refetch 重新调 fetcher, 状态反映新值
//   5. 同 resource 多次 refetch 并发: last-write-wins (stale 丢弃)
//   6. subscribe(cb) 立即触发 + 状态变化触发 + unsubscribe 后不触发
//   7. subscriber 抛错不影响其他 subscriber

import { describe, it, expect } from 'vitest';
import { useAsyncResource, createAsyncResource } from '../../ai-tutor-frontend/assets/js/hooks/useAsyncResource.js';

// micro flush helper — 让挂在 microtask queue 的 await 落地
const flush = () => new Promise((r) => setTimeout(r, 0));

describe('useAsyncResource', () => {
  it('初始 state: loading=true, data=null, error=null', async () => {
    let resolveFetch;
    const fetcher = () => new Promise((r) => { resolveFetch = r; });
    const res = useAsyncResource(fetcher);

    const s0 = res.read();
    expect(s0.loading).toBe(true);
    expect(s0.data).toBe(null);
    expect(s0.error).toBe(null);
    expect(s0.version).toBe(0);

    resolveFetch('ok');
    await flush();
  });

  it('fetcher resolve → data 有值, loading=false, version 增长', async () => {
    const res = useAsyncResource(async () => {
      await flush();
      return { name: 'aitutor', k: 42 };
    });

    await flush();
    await flush();

    const s = res.read();
    expect(s.loading).toBe(false);
    expect(s.data).toEqual({ name: 'aitutor', k: 42 });
    expect(s.error).toBe(null);
    expect(s.version).toBeGreaterThan(0);
  });

  it('fetcher reject → error 有值, loading=false, data 保持 null', async () => {
    const apiErr = Object.assign(new Error('boom'), { type: 'SERVER', code: 'BOOM' });
    const res = useAsyncResource(async () => {
      await flush();
      throw apiErr;
    });

    await flush();
    await flush();

    const s = res.read();
    expect(s.loading).toBe(false);
    expect(s.error).toBe(apiErr);
    expect(s.data).toBe(null);
  });

  it('refetch 重新调 fetcher, 新值覆盖', async () => {
    let n = 0;
    const res = useAsyncResource(async () => {
      n += 1;
      await flush();
      return `v${n}`;
    });

    await flush();
    await flush();
    expect(res.read().data).toBe('v1');

    await res.refetch();
    await flush();
    expect(res.read().data).toBe('v2');
    expect(res.read().loading).toBe(false);
    expect(n).toBe(2);
  });

  it('多次 refetch 并发: last-write-wins (stale 丢弃)', async () => {
    // 第 1 个 refetch 解到旧值, 第 2 个 refetch 解到新值. 状态以第 2 个为准.
    const resolvers = [];
    const fetcher = () => new Promise((r) => resolvers.push(r));
    const res = createAsyncResource(fetcher);

    // trigger 第 1 次 refetch (但 fetcher 没 resolve)
    const p1 = res.refetch();
    await flush();
    expect(res.read().loading).toBe(true);

    // trigger 第 2 次 refetch
    const p2 = res.refetch();
    await flush();
    expect(res.read().loading).toBe(true);

    // 第 2 个先 resolve (新值)
    resolvers[1]('new');
    await flush();
    expect(res.read().data).toBe('new');
    expect(res.read().loading).toBe(false);
    // version 历程: init(loading=true, v=0) → 2 次 refetch 都 skip (loading 已经是 true) → resolver[1] 切到 success (v=1)
    expect(res.read().version).toBe(1);

    // 第 1 个后 resolve (旧值, 应被丢弃)
    resolvers[0]('old');
    await flush();
    expect(res.read().data).toBe('new');  // 没有被覆盖
    expect(res.read().version).toBe(1);     // stale 丢弃, 不 +1

    void p1; void p2;
  });

  it('subscribe(cb) 立即 cb 一次 + 后续 state 变更触发 + unsubscribe 后停止', async () => {
    const res = useAsyncResource(async () => {
      await flush();
      return 'value';
    });

    const seen = [];
    const unsub = res.subscribe((s) => seen.push({ loading: s.loading, data: s.data }));

    // 立即触发 1 次 (init)
    expect(seen.length).toBeGreaterThanOrEqual(1);
    expect(seen[0].loading).toBe(true);

    await flush();
    await flush();

    // 现在应至少 2 次 (init + 1 success)
    const last = seen[seen.length - 1];
    expect(last.loading).toBe(false);
    expect(last.data).toBe('value');

    // unsubscribe 后不再推
    const before = seen.length;
    unsub();
    await res.refetch();
    await flush();
    expect(seen.length).toBe(before);
  });

  it('subscriber 抛错不影响其他 subscriber', async () => {
    const res = useAsyncResource(async () => {
      await flush();
      return 'x';
    });

    const a = vi.fn(() => {});
    const bad = () => { throw new Error('subscriber-killer'); };
    const b = vi.fn(() => {});
    res.subscribe(a);
    res.subscribe(bad);
    res.subscribe(b);

    await flush();
    await flush();

    expect(a).toHaveBeenCalled();
    expect(b).toHaveBeenCalled();
  });
});
