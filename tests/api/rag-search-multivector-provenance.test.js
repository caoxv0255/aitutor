// tests/api/rag-search-multivector-provenance.test.js
// P0-guard (2026-09-23): searchMultiVector 的向量溯源守卫回归。
//
// 事故: question_vectors 混装 text-embedding-v3/remote 与 bge-m3/ollama 两种产物,
//   查询侧 env 与库中 model 不一致时 cosine 无意义却照常返回。
// 守卫 (与 api/services/visionSearchService.js 同口径): SQL 层只保留 model 与当前 env
//   一致的行 (provider 仅非 NULL 时判); 主查询 0 行且 probe 发现不一致 → 拒答 (空数组)。
//
// 运行: npx vitest run tests/api/rag-search-multivector-provenance.test.js

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../services/embedding.js', () => ({
  getEmbedding: vi.fn(),
  getEmbeddingProvenance: vi.fn(),
}));
vi.mock('../../api/core/db.js', () => ({ getDb: vi.fn() }));

import { getEmbedding, getEmbeddingProvenance } from '../../services/embedding.js';
import { getDb } from '../../api/core/db.js';
import { searchMultiVector } from '../../api/routes/rag-search.js';

const SAMPLE_ROW = {
  id: 1,
  question_id: 10,
  question_uid: 'q-1',
  subject_code: 'math',
  question_type: 'choice',
  difficulty: 2,
  q_text: '已知函数 f(x)=x^2',
  s_text: '一道题',
  k_text: '二次函数',
  a_text: '代入求解',
  similarity: 0.9,
  metadata: { model: 'bge-m3', provider: 'ollama' },
};

/** 主查询返回 mainRows; 溯源 probe (DISTINCT metadata->>'model') 返回 mismatchRows。 */
function makePool({ mainRows, mismatchRows }) {
  return {
    query: vi.fn((sql) =>
      sql.includes("DISTINCT metadata->>'model'")
        ? Promise.resolve({ rows: mismatchRows })
        : Promise.resolve({ rows: mainRows })
    ),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  getEmbedding.mockResolvedValue(new Array(1024).fill(0.01));
  getEmbeddingProvenance.mockReturnValue({ provider: 'ollama', model: 'bge-m3', dim: 1024 });
});

describe('P0-guard: searchMultiVector 向量溯源守卫', () => {
  it('1. 主查询 SQL 带与 visionSearchService 同口径的 model/provider 谓词, 且作为参数传入', async () => {
    const pool = makePool({ mainRows: [SAMPLE_ROW], mismatchRows: [] });
    getDb.mockResolvedValue(pool);

    const r = await searchMultiVector('已知函数 f(x)=x^2, 求 f(2)', {});

    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toContain("COALESCE(metadata->>'model', '') = $3");
    expect(sql).toContain("(metadata->>'provider' IS NULL OR metadata->>'provider' = $4)");
    expect(params).toContain('bge-m3');
    expect(params).toContain('ollama');
    expect(r).toHaveLength(1);
  });

  it('2. 溯源不一致 (库 text-embedding-v3 / 查询 bge-m3) → 拒答, 返回空数组', async () => {
    const pool = makePool({
      mainRows: [],
      mismatchRows: [{ model: 'text-embedding-v3', provider: 'remote' }],
    });
    getDb.mockResolvedValue(pool);

    const r = await searchMultiVector('已知函数 f(x)=x^2, 求 f(2)', {});

    expect(r).toEqual([]);
    // 第一次主查询 + 第二次溯源 probe
    expect(pool.query).toHaveBeenCalledTimes(2);
  });

  it('3. 溯源一致但无过阈值命中 → 空数组 (不得误报, 也不得返回伪造结果)', async () => {
    const pool = makePool({ mainRows: [], mismatchRows: [] });
    getDb.mockResolvedValue(pool);

    const r = await searchMultiVector('已知函数 f(x)=x^2, 求 f(2)', {});

    expect(r).toEqual([]);
    expect(pool.query).toHaveBeenCalledTimes(2);
  });
});
