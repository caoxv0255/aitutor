// tests/llm-budget-observe.test.js — 预算「只观测不拦」语义单元测试 (2026-09-22 拍板)
//
// 验证 services/llm.js 的 budgetEnforce 可选参数:
//   1. 默认 (budgetEnforce 缺省 / true): 预算超额抛错, 不发起上游请求 (现状不变).
//   2. budgetEnforce: false: 预算超额仍照常调用上游 (观测模式),
//      且 recordUsage 照常记账 (getBudgetStats 可见 usage 增长).
//
// 不调真实 LLM: 全局 fetch 被 stub; 通过把 LLM_BUDGET_DAILY 设为极小值
// 使 checkBudget 必然判定超额.
//
// 注意: LLM_BUDGET_DAILY / DASHSCOPE_API_KEY 在 services/llm.js 模块加载时读取,
// 必须在动态 import 之前设置.

import { describe, it, expect, vi } from 'vitest';

process.env.LLM_BUDGET_DAILY = '0.000001'; // 极小日预算 → 任何调用都超额
process.env.DASHSCOPE_API_KEY = 'test-key-not-real';

const fetchMock = vi.fn(async () => ({
  ok: true,
  json: async () => ({
    choices: [{ message: { content: '{"ok":true}' } }],
    usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
    model: 'qwen-plus',
  }),
}));
vi.stubGlobal('fetch', fetchMock);

const { chatCompletion } = await import('../services/llm.js');

describe('budgetEnforce (只观测不拦)', () => {
  it('默认语义: 预算超额抛错且不发起上游请求', async () => {
    fetchMock.mockClear();
    await expect(
      chatCompletion('sys', 'user', { feature: 'explain_question' })
    ).rejects.toThrow(/预算已耗尽/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('budgetEnforce:false 时超额照常调用上游', async () => {
    fetchMock.mockClear();
    const result = await chatCompletion('sys', 'user', {
      feature: 'explain_question',
      budgetEnforce: false,
      jsonMode: false,
    });
    expect(result.content).toContain('ok');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('budgetEnforce:false 时 recordUsage 照常记账', async () => {
    // recordUsage 的返回值经 callWithFallback 透传为 result.cost;
    // cost > 0 即证明记账已执行 (getBudgetStats 两位小数舍入会掩盖极小金额, 不作断言依据).
    const result = await chatCompletion('sys', 'user', {
      feature: 'explain_question',
      budgetEnforce: false,
      jsonMode: false,
    });
    expect(result.cost).toBeGreaterThan(0);
  });
});
