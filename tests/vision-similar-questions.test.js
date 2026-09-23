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
  // P0-guard (2026-09-23): 溯源守卫读取当前 env 生效的 provider/model。
  getEmbeddingProvenance: vi.fn(() => ({ provider: 'remote', model: 'text-embedding-v3', dim: 1024 })),
}));

import { getEmbedding, getEmbeddingProvenance } from '../services/embedding.js';
import { VisionSearchService } from '../api/services/visionSearchService.js';
import { logger } from '../api/core/logger.js';

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
  // 默认: 当前查询 env = remote/text-embedding-v3 (与库一致)
  getEmbeddingProvenance.mockReturnValue({ provider: 'remote', model: 'text-embedding-v3', dim: 1024 });
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

// ────────────────────────────────────────────────────────────────────────────
// P0-guard (2026-09-23): 向量溯源一致性守卫回归
//
// 事故: 库是 ollama/bge-m3 产物, 查询 env 切到 remote/text-embedding-v3,
//   跨模型 cos≈0.635 却照常返回 (维度只 warn 不拦) → 页面一片垃圾相似度。
// 守卫: 查询路径比对 env 的 provider+model 与 question_vectors.metadata,
//   不一致 → 拒答 (空数组), similarNotice 说明「库中 X / 当前查询 Y」。
// ────────────────────────────────────────────────────────────────────────────
describe('P0-guard: 向量溯源不一致必须拒答', () => {
  // 主查询 (含溯源谓词) 返回 mainRows; 溯源 probe (DISTINCT metadata->>'model') 返回 mismatchedRows。
  function makeProvenancePool({ mainRows, mismatchedRows }) {
    return {
      query: vi.fn((sql) =>
        sql.includes("DISTINCT metadata->>'model'")
          ? Promise.resolve({ rows: mismatchedRows })
          : Promise.resolve({ rows: mainRows })
      ),
    };
  }

  it('8. 溯源不一致 (库 bge-m3 / 查询 text-embedding-v3) → 拒答, 不返回任何结果, notice 说明原因', async () => {
    getEmbedding.mockResolvedValue(new Array(1024).fill(0.01));
    // 真实 DB 里溯源谓词把不一致的行全部排除 → 主查询 0 行; probe 查到库中旧模型。
    const pool = makeProvenancePool({
      mainRows: [],
      mismatchedRows: [{ model: 'bge-m3', provider: 'ollama' }],
    });

    const r = await VisionSearchService.findSimilarQuestions(
      Promise.resolve(pool), LONG_TEXT, { subjectCode: 'math' }
    );

    // 拒答: 空结果, 绝不返回可能无意义的相似度
    expect(r.questions).toEqual([]);
    expect(r.notice).toBeTruthy();
    expect(r.notice).toContain('溯源不一致');
    expect(r.notice).toContain('bge-m3');            // 库中模型
    expect(r.notice).toContain('text-embedding-v3'); // 当前查询模型
    expect(r.notice).toContain('拒绝');
  });

  it('9. 溯源一致 (均为 text-embedding-v3) → 正常返回结果', async () => {
    getEmbedding.mockResolvedValue(new Array(1024).fill(0.01));
    const pool = makeProvenancePool({ mainRows: [SAMPLE_ROW], mismatchedRows: [] });

    const r = await VisionSearchService.findSimilarQuestions(
      Promise.resolve(pool), LONG_TEXT, { subjectCode: 'math' }
    );

    expect(r.notice).toBeNull();
    expect(r.questions).toHaveLength(1);
    expect(r.questions[0].similarity).toBeCloseTo(0.8235, 4);
  });

  it('10. 溯源一致但无过阈值命中 → 阈值空态 (不得误报为溯源不一致)', async () => {
    getEmbedding.mockResolvedValue(new Array(1024).fill(0.01));
    const pool = makeProvenancePool({ mainRows: [], mismatchedRows: [] });

    const r = await VisionSearchService.findSimilarQuestions(
      Promise.resolve(pool), LONG_TEXT, { subjectCode: 'math' }
    );

    expect(r.questions).toEqual([]);
    expect(r.notice).toContain('阈值');
    expect(r.notice).not.toContain('溯源不一致');
  });

  it('11. 主查询 SQL 带溯源谓词, 且 model/provider 作为参数传入 (不是 JS 事后过滤)', async () => {
    getEmbedding.mockResolvedValue(new Array(1024).fill(0.01));
    const pool = makeProvenancePool({ mainRows: [SAMPLE_ROW], mismatchedRows: [] });

    await VisionSearchService.findSimilarQuestions(
      Promise.resolve(pool), LONG_TEXT, { subjectCode: 'math', limit: 5 }
    );

    const [sql, params] = pool.query.mock.calls.find(([s]) => s.includes('q_embedding <=> $1'));
    // params = [embedding, text, threshold, subject, limit, model, provider]
    expect(params[5]).toBe('text-embedding-v3');
    expect(params[6]).toBe('remote');
    expect(sql).toContain('NOT EXISTS');
    expect(sql).toMatch(/metadata->>'model'/);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// options 容错解析 (2026-09-24)
//
// 事故: exam_questions.options 有 3086/49506 行是纯文本选项串 (非 JSON),
//   旧代码 .map() 内直接 JSON.parse → 抛错被外层 catch 吞成「检索失败」空态,
//   随机命中纯文本行的检索恒为空。
// 回归: 纯文本行必须返回该题 (options 降级为原始字符串) + warn + 计数,
//   且不得变成「检索失败」空态; 合法 JSON 行不受影响。
// ────────────────────────────────────────────────────────────────────────────
describe('options 容错解析: 纯文本行不得让整条检索崩掉', () => {
  const PURE_TEXT_OPTIONS = 'A. ①\tB. ②\tC. ③\tD. ④';
  const ROW_PURE_TEXT = { ...SAMPLE_ROW, question_uid: 'q-pure-text', options: PURE_TEXT_OPTIONS };
  const ROW_JSON = {
    ...SAMPLE_ROW,
    question_uid: 'q-json',
    options: JSON.stringify(['A. ①', 'B. ②', 'C. ③', 'D. ④']),
  };

  it('12. 纯文本 options 行 → 返回该题, options 降级为原始字符串, warn + 计数自增 (非「检索失败」空态)', async () => {
    const before = VisionSearchService.optionsParseFailureCount;
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    getEmbedding.mockResolvedValue(new Array(1024).fill(0.01));
    const pool = makePool([ROW_PURE_TEXT]);

    const r = await VisionSearchService.findSimilarQuestions(
      Promise.resolve(pool), LONG_TEXT, { subjectCode: 'math' }
    );

    // 关键: 不再返回「检索失败」空态
    expect(r.notice).toBeNull();
    expect(r.questions).toHaveLength(1);
    expect(r.questions[0].id).toBe('q-pure-text');
    // 降级策略: 保留原始文本 (不回退随机, 也不丢信息)
    expect(r.questions[0].options).toBe(PURE_TEXT_OPTIONS);
    // 可观测: warn + 累计计数自增 (不静默吞掉)
    expect(VisionSearchService.optionsParseFailureCount).toBe(before + 1);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('降级为原始文本'));
    warnSpy.mockRestore();
  });

  it('13. 合法 JSON options 行仍解析为数组, 且不触发降级 (对照组)', async () => {
    getEmbedding.mockResolvedValue(new Array(1024).fill(0.01));
    const pool = makePool([ROW_JSON]);
    const before = VisionSearchService.optionsParseFailureCount;

    const r = await VisionSearchService.findSimilarQuestions(
      Promise.resolve(pool), LONG_TEXT, { subjectCode: 'math' }
    );

    expect(r.notice).toBeNull();
    expect(r.questions[0].options).toEqual(['A. ①', 'B. ②', 'C. ③', 'D. ④']);
    expect(VisionSearchService.optionsParseFailureCount).toBe(before);
  });
});
