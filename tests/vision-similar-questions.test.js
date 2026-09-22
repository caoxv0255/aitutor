// tests/vision-similar-questions.test.js — F3-fix 回归闸门 (2026-09-22)
//
// 背景: visionSearchService.findSimilarQuestions 旧实现用 `ORDER BY RANDOM()`
//   冒充相似度 (幻觉评审实锤, 功能造假). 已改为 pgvector cosine 真相似度检索.
//
// 断言 (机械可复现):
//   1. 源码静态: 相似题查询路径不含 RANDOM()
//   2. 动态: 发出的 SQL 含 cosine 距离 (<=>) + 相似度阈值谓词, 不含 RANDOM
//   3. 阈值过滤: 阈值作为参数传入 SQL 谓词 (env 可调), 低于阈值的结果由 SQL 排除
//   4. embedding 不可用 → 诚实空态 (空数组 + notice), 且不触碰 DB (无随机回退)
//   5. 文本过短 / 无过阈值结果 → 诚实空态 + notice
//
// 跑: npm test -- vision-similar-questions

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SERVICE_PATH = resolve(__dirname, '../api/services/visionSearchService.js');

// mock embedding provider — 测试不打任何真实 embedding 服务 (含本地 ollama)
vi.mock('../services/embedding.js', () => ({
  getEmbedding: vi.fn(),
}));

import { getEmbedding } from '../services/embedding.js';
import { VisionSearchService } from '../api/services/visionSearchService.js';

const SAMPLE_ROW = {
  question_uid: 'q-uid-001',
  stem: '已知函数 f(x)=x^2, 求 f(2) 的值',
  options: null,
  answer: 'A',
  analysis: '直接代入即可',
  knowledge_points: 'kp_math_015',
  difficulty: 2,
  question_type: 'choice',
  subject_code: 'math',
  year: 2024,
  score: 5,
  similarity: 0.8234567,
};

function makePool(rows) {
  return { query: vi.fn().mockResolvedValue({ rows }) };
}

const LONG_TEXT = '已知二次函数 f(x) = x^2 - 2x + 1，求其在区间 [0, 2] 上的最大值与最小值';

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.SIMILAR_QUESTIONS_MIN_SIMILARITY;
});

afterEach(() => {
  delete process.env.SIMILAR_QUESTIONS_MIN_SIMILARITY;
});

describe('F3: 相似题真相似度检索 (禁用 RANDOM 冒充)', () => {
  it('1. 源码静态断言: visionSearchService 不再出现 ORDER BY RANDOM', () => {
    const src = readFileSync(SERVICE_PATH, 'utf8');
    expect(src).not.toMatch(/ORDER\s+BY\s+RANDOM\s*\(/i);
  });

  it('2. 发出的 SQL 用 cosine 距离 (<=>) 排序且不含 RANDOM', async () => {
    getEmbedding.mockResolvedValue(new Array(1024).fill(0.01));
    const pool = makePool([SAMPLE_ROW]);

    const r = await VisionSearchService.findSimilarQuestions(
      Promise.resolve(pool), LONG_TEXT, { subjectCode: 'math', limit: 5 }
    );

    expect(pool.query).toHaveBeenCalledTimes(1);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).not.toMatch(/RANDOM\s*\(/i);
    expect(sql).toContain('q_embedding <=> $1');            // cosine 距离
    expect(sql).toMatch(/ORDER BY\s+qv\.q_embedding <=>/);  // 按相似度排序
    expect(sql).toContain('1 - (qv.q_embedding <=> $1) >= $3'); // 阈值谓词
    expect(params[2]).toBeCloseTo(0.60, 5);                 // 默认阈值 0.60
    expect(params[4]).toBe(5);                              // top-N

    expect(r.notice).toBeNull();
    expect(r.questions).toHaveLength(1);
    // 响应契约: 既有字段全部保留, similarity 为增量字段
    expect(r.questions[0]).toMatchObject({
      id: 'q-uid-001',
      content: SAMPLE_ROW.stem,
      answer: 'A',
      explanation: '直接代入即可',
      subject_code: 'math',
    });
    expect(r.questions[0].similarity).toBeCloseTo(0.8235, 4);
  });

  it('3. 阈值 env 可调: SIMILAR_QUESTIONS_MIN_SIMILARITY=0.75 生效于 SQL 参数', async () => {
    process.env.SIMILAR_QUESTIONS_MIN_SIMILARITY = '0.75';
    getEmbedding.mockResolvedValue(new Array(1024).fill(0.01));
    const pool = makePool([]);

    await VisionSearchService.findSimilarQuestions(Promise.resolve(pool), LONG_TEXT, {});

    const [, params] = pool.query.mock.calls[0];
    expect(params[2]).toBeCloseTo(0.75, 5);
  });

  it('4. 低于阈值的结果不出现: 阈值过滤由 SQL WHERE 强制 (非事后 JS 过滤)', async () => {
    getEmbedding.mockResolvedValue(new Array(1024).fill(0.01));
    // DB 端遵守 WHERE 返回空 → 服务层必须原样返回空, 不得自行补题
    const pool = makePool([]);

    const r = await VisionSearchService.findSimilarQuestions(
      Promise.resolve(pool), LONG_TEXT, { subjectCode: 'math' }
    );

    const [sql] = pool.query.mock.calls[0];
    expect(sql).toContain('>= $3'); // 过滤在 SQL 层, 低相似度行根本不出库
    expect(r.questions).toEqual([]);
    expect(r.notice).toBeTruthy();
    expect(r.notice).toContain('阈值');
  });

  it('5. embedding 不可用 → 诚实空态, 且不触碰 DB (无随机回退)', async () => {
    getEmbedding.mockRejectedValue(new Error('Embedding API 请求失败 [NETWORK] (ollama): connect ECONNREFUSED'));
    const pool = makePool([SAMPLE_ROW]); // 即使 DB 有题也绝不能被查到

    const r = await VisionSearchService.findSimilarQuestions(
      Promise.resolve(pool), LONG_TEXT, { subjectCode: 'math' }
    );

    expect(r.questions).toEqual([]);
    expect(r.notice).toBeTruthy();
    expect(r.notice).toContain('暂不可用');
    expect(pool.query).not.toHaveBeenCalled(); // 关键: 禁止回退到任何 SQL 兜底
  });

  it('6. 题干过短 (<10 字) → 诚实空态, 不调 embedding 也不查库', async () => {
    const pool = makePool([SAMPLE_ROW]);

    const r = await VisionSearchService.findSimilarQuestions(Promise.resolve(pool), '太短', {});

    expect(r.questions).toEqual([]);
    expect(r.notice).toContain('过短');
    expect(getEmbedding).not.toHaveBeenCalled();
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('7. DB 查询异常 → 诚实空态 + notice, 不抛出', async () => {
    getEmbedding.mockResolvedValue(new Array(1024).fill(0.01));
    const pool = { query: vi.fn().mockRejectedValue(new Error('relation "question_vectors" does not exist')) };

    const r = await VisionSearchService.findSimilarQuestions(Promise.resolve(pool), LONG_TEXT, {});

    expect(r.questions).toEqual([]);
    expect(r.notice).toBeTruthy();
  });
});
