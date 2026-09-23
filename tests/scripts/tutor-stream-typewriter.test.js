// @vitest-environment jsdom
// tests/scripts/tutor-stream-typewriter.test.js — createTypewriter 安全追加回归
//
// 背景 (波次4 债3): public/src/js/tutor-stream.js 的 createTypewriter.flush() 曾用
//   `container.innerHTML += pending` 追加 LLM SSE delta。delta 是原始文本
//   (onContent 透传，见同文件 getAuthToken/parseSSEStream)，直接拼 innerHTML 即注入，
//   且 innerHTML += 会整段重解析、破坏已插入节点。
// 修法: 改 `container.appendChild(document.createTextNode(pending))`。
// 本用例断言: LLM delta 被当纯文本（不解析 HTML）、可持续追加、保留已有子节点。
// 跑: npx vitest run tests/scripts/tutor-stream-typewriter.test.js

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createTypewriter } from '../../public/src/js/tutor-stream.js';

describe('createTypewriter 流式追加（安全写法）', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('把 LLM delta 当纯文本追加，不解析 HTML（防注入）', () => {
    const c = document.createElement('div');
    const t = createTypewriter(c, { batchMs: 10 });
    t.append('<img src=x onerror=alert(1)>你好');
    t.complete();

    // 关键：不得生成任何元素（尤其 img）——注入未发生
    expect(c.querySelector('img')).toBeNull();
    expect(c.querySelector('*')).toBeNull();
    // 文本原样保留（按纯文本渲染）
    expect(c.textContent).toBe('<img src=x onerror=alert(1)>你好');
  });

  it('可持续追加：多次 append 按序累积', () => {
    const c = document.createElement('div');
    const t = createTypewriter(c, { batchMs: 10 });
    t.append('a');
    vi.advanceTimersByTime(10);
    t.append('b');
    vi.advanceTimersByTime(10);
    t.append('c');
    t.complete();

    expect(c.textContent).toBe('abc');
    expect(c.childNodes.length).toBe(3); // 每批一个文本节点
  });

  it('保留容器已有子节点（innerHTML += 会整段重解析）', () => {
    const c = document.createElement('div');
    c.innerHTML = '<span id="keep">已有</span>';
    const t = createTypewriter(c, { batchMs: 10 });
    t.append('新增');
    t.complete();

    expect(c.querySelector('#keep')).not.toBeNull();
    expect(c.textContent).toBe('已有新增');
  });
});
