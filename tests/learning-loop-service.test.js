// tests/learning-loop-service.test.js — Learning Loop service 单元测试 (Sprint 1, D078)
// 验证:
//   1. submitFeedback 必填校验
//   2. submitFeedback 不传 subject 也能成功 (后端不接收)
//   3. submitFeedback envelope 解构
//   4. submitBatch 数组校验 + 过滤无效项
//   5. getMastery endpoint 正确
//
// 跑: npm test -- learning-loop
//
// ⚠️ ESM 顶层 import 时 USE_MOCK.js 的 IS_BROWSER 常量就被 freeze.
//    必须在 import learning-loop.js 之前先设 window/document, 否则 IS_BROWSER=false,
//    mock 永远 fallback 到 USE_MOCK=false → 走真后端 → 测试不可重现.
//    与 tests/contract.test.js 的 monkey patch 顺序一致.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const MOCK_DIR = resolve(__dirname, '../ai-tutor-frontend/assets/js/api/mock');

// === 必须在 import service 之前执行 ===

// 1. 模拟浏览器环境
global.window = {
  location: { search: '?mock=true' },
  addEventListener: () => {},
  removeEventListener: () => {},
};
global.document = {
  querySelector: () => null,
  createElement: () => ({
    className: '',
    innerHTML: '',
    appendChild: () => {},
    querySelector: () => null,
    setAttribute: () => {},
    style: {},
  }),
  body: { appendChild: () => {} },
  addEventListener: () => {},
  removeEventListener: () => {},
};
global.localStorage = {
  _data: { 'aitutor.useMock': 'true' },
  getItem(k) { return this._data[k] ?? null; },
  setItem(k, v) { this._data[k] = String(v); },
  removeItem(k) { delete this._data[k]; },
};

// 2. Monkey patch fetch (Node 22 fetch 不支持 file://)
globalThis.fetch = async (url) => {
  const u = new URL(url);
  const fname = u.pathname.split('/').pop();
  try {
    const data = readFileSync(resolve(MOCK_DIR, fname), 'utf8');
    return {
      ok: true,
      status: 200,
      text: async () => data,
      json: async () => JSON.parse(data),
    };
  } catch (e) {
    return { ok: false, status: 404, text: async () => '', json: async () => { throw e; } };
  }
};

// 3. import service (此时 IS_BROWSER=true, mock 生效)
const { learningLoop } = await import('../ai-tutor-frontend/assets/js/api/services/learning-loop.js');

describe('learningLoop.submitFeedback', () => {
  it('throws when knowledge_point_id missing', async () => {
    await expect(learningLoop.submitFeedback({ is_correct: true })).rejects.toThrow(/knowledge_point_id required/);
  });

  it('throws when is_correct missing', async () => {
    await expect(learningLoop.submitFeedback({ knowledge_point_id: 'math_002' })).rejects.toThrow(/is_correct \(boolean\) required/);
  });

  it('throws when is_correct is not boolean', async () => {
    await expect(learningLoop.submitFeedback({ knowledge_point_id: 'math_002', is_correct: 'yes' })).rejects.toThrow(/is_correct \(boolean\) required/);
    await expect(learningLoop.submitFeedback({ knowledge_point_id: 'math_002', is_correct: 1 })).rejects.toThrow(/is_correct \(boolean\) required/);
  });

  it('returns envelope with success=true when valid', async () => {
    const r = await learningLoop.submitFeedback({ knowledge_point_id: 'math_002', is_correct: true });
    expect(r).toBeTypeOf('object');
    expect(r.success).toBe(true);
    expect(r.data).toBeTypeOf('object');
    expect(r.data.feedback).toBeTypeOf('object');
  });

  it('works without subject field (后端不接收)', async () => {
    const r = await learningLoop.submitFeedback({ knowledge_point_id: 'math_002', is_correct: false });
    expect(r.success).toBe(true);
  });

  it('accepts optional time_spent_ms and hint_requested', async () => {
    const r = await learningLoop.submitFeedback({
      knowledge_point_id: 'math_002',
      is_correct: true,
      time_spent_ms: 15000,
      hint_requested: false,
    });
    expect(r.success).toBe(true);
  });
});

describe('learningLoop.submitBatch', () => {
  it('throws when feedbacks missing', async () => {
    await expect(learningLoop.submitBatch({})).rejects.toThrow(/feedbacks array required/);
  });

  it('throws when feedbacks is empty array', async () => {
    await expect(learningLoop.submitBatch({ feedbacks: [] })).rejects.toThrow(/feedbacks array required/);
  });

  it('throws when feedbacks is not an array', async () => {
    await expect(learningLoop.submitBatch({ feedbacks: 'invalid' })).rejects.toThrow(/feedbacks array required/);
  });

  it('throws when more than 100 feedbacks', async () => {
    const arr = Array.from({ length: 101 }, () => ({ knowledge_point_id: 'math_001', is_correct: true }));
    await expect(learningLoop.submitBatch({ feedbacks: arr })).rejects.toThrow(/max 100/);
  });

  it('throws when all feedbacks invalid (no KP id or is_correct)', async () => {
    await expect(learningLoop.submitBatch({
      feedbacks: [{ knowledge_point_id: '', is_correct: true }, { is_correct: 'maybe' }],
    })).rejects.toThrow(/no valid feedbacks/);
  });

  it('returns success when at least one valid feedback', async () => {
    const r = await learningLoop.submitBatch({
      feedbacks: [
        { knowledge_point_id: 'math_002', is_correct: true },
        { knowledge_point_id: 'math_007', is_correct: false },
        { knowledge_point_id: '', is_correct: true },  // 过滤掉
      ],
    });
    expect(r.success).toBe(true);
    expect(r.data).toBeTypeOf('object');
  });
});

describe('learningLoop.getMastery', () => {
  it('returns mastery list', async () => {
    const r = await learningLoop.getMastery();
    expect(r.success).toBe(true);
    expect(Array.isArray(r.data.masteries)).toBe(true);
  });
});
