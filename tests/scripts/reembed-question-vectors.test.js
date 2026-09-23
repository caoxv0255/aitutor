// tests/scripts/reembed-question-vectors.test.js — 重嵌入脚本的纯逻辑回归
//
// 被测量: scripts/reembed-question-vectors.mjs
// 背景: 2026-09-23 向量溯源事故 (库 bge-m3 / 查询 text-embedding-v3) 的全量重嵌入。
//   本套只测「分批 / 维度校验 / 幂等判定 / 重试退避 / SQL 目标列」等纯逻辑,
//   mock 外部调用, 绝不真调 DashScope API, 也不连 DB。
//
// 运行: npx vitest run tests/scripts/reembed-question-vectors.test.js

import { describe, it, expect, vi } from 'vitest';
import {
  TARGET,
  chunk,
  isUpToDate,
  mergeProvenanceMetadata,
  assertVectorDim,
  backoffMs,
  buildPendingQuery,
  buildUpdateSql,
  parseArgs,
  pickEmbedding,
  extractTokens,
  describeAxiosError,
  toRichError,
  isFatalAccountError,
  callWithRetry,
  embedItems,
} from '../../scripts/reembed-question-vectors.mjs';

const vec1024 = () => new Array(1024).fill(0.01);

describe('reembed: 分批 chunk()', () => {
  it('按 size 切块, 尾部保留余数', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
  it('size 非法 → 抛', () => {
    expect(() => chunk([1], 0)).toThrow();
    expect(() => chunk([1], 1.5)).toThrow();
  });
});

describe('reembed: 幂等判定 isUpToDate()', () => {
  it('metadata.model === 目标 → 已处理 (跳过)', () => {
    expect(isUpToDate({ model: TARGET.model, provider: 'remote' })).toBe(true);
  });
  it('旧模型产物 / 缺 model / 非对象 → 未处理', () => {
    expect(isUpToDate({ model: 'bge-m3' })).toBe(false);
    expect(isUpToDate({ dim: 1024 })).toBe(false);
    expect(isUpToDate(null)).toBe(false);
    expect(isUpToDate('x')).toBe(false);
  });
});

describe('reembed: 溯源 metadata 合并', () => {
  it('写 dim/model/provider/source, 且保留其它既有键', () => {
    const merged = mergeProvenanceMetadata({
      source: 'batch02-11-embed-all',
      model: 'bge-m3',
      provider: 'ollama',
      dim: 1024,
      custom_key: 'keep-me',
    });
    expect(merged).toMatchObject({
      dim: 1024,
      model: 'text-embedding-v3',
      provider: 'remote',
      source: 'reembed-2026-09-23',
      custom_key: 'keep-me',
    });
  });
  it('metadata 为 null → 仍产出合法对象', () => {
    expect(mergeProvenanceMetadata(null)).toMatchObject({ model: TARGET.model });
  });
});

describe('reembed: 维度校验 assertVectorDim() (必须拦, 不能只 warn)', () => {
  it('1024 维通过', () => {
    expect(assertVectorDim(vec1024(), 1024)).toBe(true);
  });
  it('维度不符 / 非数组 → 抛', () => {
    expect(() => assertVectorDim(new Array(768).fill(0), 1024)).toThrow(/维度不符/);
    expect(() => assertVectorDim(undefined, 1024)).toThrow(/非数组/);
  });
});

describe('reembed: 退避 backoffMs()', () => {
  it('指数增长且封顶', () => {
    expect(backoffMs(1, 1000, 30000)).toBe(1000);
    expect(backoffMs(2, 1000, 30000)).toBe(2000);
    expect(backoffMs(3, 1000, 30000)).toBe(4000);
    expect(backoffMs(99, 1000, 30000)).toBe(30000);
  });
});

describe('reembed: SQL 目标列与幂等谓词', () => {
  it('question_vectors 用 q_text, 幂等谓词在 WHERE, limit 进参数', () => {
    const { sql, params } = buildPendingQuery('question_vectors', { limit: 3 });
    expect(sql).toContain('q_text');
    expect(sql).toMatch(/metadata->>'model' IS DISTINCT FROM \$1/);
    expect(sql).toContain('LIMIT $2');
    expect(params).toEqual([TARGET.model, 3]);
  });
  it('rag_questions 用 content', () => {
    const { sql } = buildPendingQuery('rag_questions');
    expect(sql).toContain('content AS text');
    expect(sql).not.toContain('LIMIT');
  });
  it('UPDATE 写对应向量列 + 合并 metadata', () => {
    expect(buildUpdateSql('question_vectors')).toContain('q_embedding = $2::vector');
    expect(buildUpdateSql('rag_questions')).toContain('embedding = $2::vector');
    expect(buildUpdateSql('question_vectors')).toContain("COALESCE(metadata, '{}'::jsonb) || $3::jsonb");
  });
  it('未知表 → 抛', () => {
    expect(() => buildPendingQuery('nope')).toThrow();
  });
});

describe('reembed: CLI 解析 parseArgs()', () => {
  it('默认值', () => {
    expect(parseArgs([])).toMatchObject({ dryRun: false, limit: null, batchSize: 20, table: 'all' });
  });
  it('解析 --dry-run / --limit / --table', () => {
    expect(parseArgs(['--dry-run', '--limit', '5', '--table', 'rag_questions']))
      .toMatchObject({ dryRun: true, limit: 5, table: 'rag_questions' });
  });
  it('batch-size > 25 (DashScope 上限) → 抛', () => {
    expect(() => parseArgs(['--batch-size', '26'])).toThrow();
  });
  it('未知参数 → 抛', () => {
    expect(() => parseArgs(['--wat'])).toThrow(/未知参数/);
  });
});

describe('reembed: 响应解析', () => {
  it('pickEmbedding 按 index 排序取', () => {
    const data = { data: [{ index: 1, embedding: 'B' }, { index: 0, embedding: 'A' }] };
    expect(pickEmbedding(data, 0)).toBe('A');
    expect(pickEmbedding(data, 1)).toBe('B');
  });
  it('extractTokens 优先 usage, 缺失则按字符估算', () => {
    expect(extractTokens({ usage: { total_tokens: 42 } }, ['xxxx'])).toBe(42);
    expect(extractTokens({}, ['abcd', 'ef'])).toBe(3); // ceil(4/2)+ceil(2/2)
  });
});

describe('reembed: 错误诊断 (Arrearage 等)', () => {
  const arrearage = {
    response: {
      status: 400,
      data: { error: { code: 'Arrearage', message: 'Access denied, please make sure your account is in good standing. ... overdue-payment' } },
    },
  };
  it('describeAxiosError 提取 status/code/服务端 message', () => {
    expect(describeAxiosError(arrearage)).toMatchObject({ status: 400, code: 'Arrearage' });
    expect(describeAxiosError(arrearage).apiMsg).toMatch(/overdue-payment/);
  });
  it('toRichError 保留 HTTP status + code + message', () => {
    const e = toRichError(arrearage);
    expect(e.message).toMatch(/HTTP 400/);
    expect(e.message).toMatch(/Arrearage/);
    expect(e.status).toBe(400);
    expect(e.code).toBe('Arrearage');
  });
  it('isFatalAccountError 识别欠费/停用, 不误伤普通 400', () => {
    expect(isFatalAccountError(toRichError(arrearage))).toBe(true);
    expect(isFatalAccountError(toRichError({ response: { status: 400, data: { error: { message: 'invalid input' } } } }))).toBe(false);
  });
});

describe('reembed: callWithRetry() 退避重试', () => {
  it('账号欠费 (Arrearage) → 立即抛, 不重试不退避', async () => {
    const post = vi.fn().mockRejectedValue({
      response: { status: 400, data: { error: { code: 'Arrearage', message: 'Access denied ... overdue-payment' } } },
    });
    const sleep = vi.fn(async () => {});
    await expect(callWithRetry(['t'], { post, maxAttempts: 5, sleep })).rejects.toThrow(/Arrearage/);
    expect(post).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('429 后重试成功; sleep 被调用', async () => {
    const post = vi.fn()
      .mockRejectedValueOnce({ response: { status: 429 } })
      .mockResolvedValueOnce({ data: [{ index: 0, embedding: vec1024() }] });
    const sleep = vi.fn(async () => {});
    const data = await callWithRetry(['t'], { post, maxAttempts: 3, sleep, baseBackoffMs: 1 });
    expect(post).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(data.data[0].embedding).toHaveLength(1024);
  });
  it('不可重试的 400 立即抛 (不退避)', async () => {
    const post = vi.fn().mockRejectedValue({ response: { status: 400 } });
    const sleep = vi.fn(async () => {});
    await expect(callWithRetry(['t'], { post, maxAttempts: 5, sleep })).rejects.toBeTruthy();
    expect(post).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });
});

describe('reembed: embedItems() 分批 + 降级补救 + 维度失败记录', () => {
  const items = Array.from({ length: 5 }, (_, i) => ({ id: i + 1, text: `题${i + 1}` }));

  it('按 batchSize 分批调用 post', async () => {
    const post = vi.fn(async (texts) => ({
      data: texts.map((_, i) => ({ index: i, embedding: vec1024() })),
      usage: { total_tokens: 10 },
    }));
    const r = await embedItems(items, { post, batchSize: 2, dim: 1024 });
    expect(post).toHaveBeenCalledTimes(3); // 2+2+1
    expect(post.mock.calls[0][0]).toHaveLength(2);
    expect(r.vectors.size).toBe(5);
    expect(r.failed).toEqual([]);
    expect(r.tokens).toBe(30);
    expect(r.requests).toBe(3);
  });

  it('整批失败 → 降级逐条补救, 成功的仍入库, 不整批回滚', async () => {
    const post = vi.fn(async (texts) => {
      if (texts.length > 1) throw new Error('batch 500');
      return { data: [{ index: 0, embedding: vec1024() }] };
    });
    const r = await embedItems(items.slice(0, 3), { post, batchSize: 3, dim: 1024, maxAttempts: 1 });
    // 1 次批失败 + 3 次逐条
    expect(post.mock.calls.filter(([t]) => t.length > 1)).toHaveLength(1);
    expect(post.mock.calls.filter(([t]) => t.length === 1)).toHaveLength(3);
    expect(r.vectors.size).toBe(3);
    expect(r.failed).toEqual([]);
  });

  it('维度不符的行 → 记入 failed, 不写入 vectors (不静默放行)', async () => {
    const post = vi.fn(async (texts) => ({
      data: texts.map((_, i) => ({ index: i, embedding: i === 0 ? new Array(768).fill(0) : vec1024() })),
    }));
    const r = await embedItems(items.slice(0, 2), { post, batchSize: 2, dim: 1024 });
    expect(r.vectors.size).toBe(1);
    expect(r.failed).toHaveLength(1);
    expect(r.failed[0].error).toMatch(/维度不符/);
  });

  it('onBatch 每批回调一次 (断点续跑落库钩子), 携带成功项', async () => {
    const post = vi.fn(async (texts) => ({
      data: texts.map((_, i) => ({ index: i, embedding: vec1024() })),
    }));
    const batches = [];
    await embedItems(items, { post, batchSize: 2, dim: 1024, onBatch: async (s) => batches.push(s.map((x) => x.id)) });
    expect(batches).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('账号欠费 → 立即中止整轮, 不做逐条补救 (避免打光剩余行)', async () => {
    const post = vi.fn().mockRejectedValue({
      response: { status: 400, data: { error: { code: 'Arrearage', message: 'Access denied ... overdue-payment' } } },
    });
    await expect(embedItems(items, { post, batchSize: 5, dim: 1024, maxAttempts: 3 })).rejects.toThrow(/Arrearage/);
    expect(post).toHaveBeenCalledTimes(1); // 首请求即判定欠费, 中止
  });
});
