// services/vision.js — 拍照搜题 (F4 Vision Epic, F3 迁移)
//
// 后端契约 (实测 2026-08-15, 与 api/routes/vision-parse.js 对齐):
//   POST /api/vision/parse            {image, subject?, knowledge_point_id?, auto_ingest?}
//                                     → data: { parse: {raw_text, latex_formulas, subject_code,
//                                                        difficulty, question_type, inferred_kp_id,
//                                                        kp_validated, ...},
//                                               ingest: {success, rag_id} }
//   GET  /api/vision/knowledge-points?subject= → data: {items: [{id,name,subject,difficulty}], total}
//
// 注意: 后端没有 /api/vision/ingest 与 /api/vision/parse/:taskId —
//       parse 同步返回结果, 且默认 auto_ingest=true 由服务端"拍照即入库".
import { request } from '../client.js';

export const vision = {
  /**
   * 拍照解析 + 自动入库 (同步返回)
   * @param {object} opts
   * @param {string} opts.image             — base64 (可含 data:image/*;base64, 前缀, 后端自动剥离)
   * @param {string} [opts.subject]         — 学科 code (math/chinese/...), 缺省后端自动推断
   * @param {string} [opts.knowledgePointId]— 知识点 id, 缺省后端自动推断 + 图谱校验
   * @param {boolean} [opts.autoIngest]     — 默认 true: 解析后自动入库 (拍照即入库)
   * @returns {Promise<{success, data: {parse, ingest}}>}
   */
  async parse({ image, subject, knowledgePointId, autoIngest = true } = {}) {
    if (!image || typeof image !== 'string') throw new Error('vision.parse: image (base64) 必填');
    const body = { image, auto_ingest: autoIngest };
    if (subject) body.subject = subject;
    if (knowledgePointId) body.knowledge_point_id = knowledgePointId;
    return request('POST', '/api/vision/parse', body, { mockName: 'vision_parse' });
  },

  /**
   * 知识点列表 (供拍照前选择, 提高分类准确率)
   * @param {object} [opts]
   * @param {string} [opts.subject] — 学科 code 过滤, 缺省返回全部 (limit 200)
   * @returns {Promise<{success, data: {items: Array, total: number}}>}
   */
  async getKnowledgePoints({ subject } = {}) {
    const q = subject ? `?subject=${encodeURIComponent(subject)}` : '';
    return request('GET', `/api/vision/knowledge-points${q}`, null, { mockName: 'vision_knowledge_points' });
  },

  // ────────────────────────────────────────────────────────────────────────────
  // Phase E (2026-08-24): 整卷 OCR — 多图 / 多页 PDF 批量解析
  //
  // 后端契约 (实测 2026-08-24, 与 api/modules/vision/routes.js 对齐):
  //   POST /api/vision/batch-parse  {images: [{data, subject?, pageIndex?}],
  //                                   user_hint?: {default_subject?},
  //                                   options?: {concurrency?, mock?}}
  //                                  → data: { questions: [...], failed: [...],
  //                                            total_count, success_count, failed_count }
  //   POST /api/vision/batch-ingest {questions: [...], options?: {source?}}
  //                                  → data: { ingested: [...], failed: [...],
  //                                            total_count, success_count, failed_count,
  //                                            mastery_updates, srs_scheduled }
  //
  // 核心 UX: 单题失败不影响整批, 由前端聚合 failed[] 展示.
  // ────────────────────────────────────────────────────────────────────────────

  /**
   * 整卷 OCR 批量解析 (Phase E, 2026-08-24)
   * @param {object} opts
   * @param {Array<{data:string, subject?:string, pageIndex?:number}>} opts.images
   * @param {{default_subject?:string}} [opts.userHint]
   * @param {{concurrency?:number, mock?:boolean}} [opts.options]
   * @returns {Promise<{success, data: {questions: Array, failed: Array, total_count: number, success_count: number, failed_count: number}}>}
   */
  async batchParse({ images, userHint, options } = {}) {
    if (!Array.isArray(images) || images.length === 0) {
      throw new Error('vision.batchParse: images (非空数组) 必填');
    }
    return request(
      'POST',
      '/api/vision/batch-parse',
      { images, user_hint: userHint || {}, options: options || {} },
      { mockName: 'vision_batch_parse' }
    );
  },

  /**
   * 批量入库 (Phase E, 2026-08-24) — 把 batchParse 返回的 questions 写入错题本
   * @param {object} opts
   * @param {Array<object>} opts.questions — 必须含 full_content / subject_code / inferred_kp_id
   * @param {string} [opts.source]
   * @returns {Promise<{success, data: {ingested: Array, failed: Array, total_count: number, success_count: number, failed_count: number, mastery_updates: number, srs_scheduled: number}}>}
   */
  async batchIngest({ questions, source } = {}) {
    if (!Array.isArray(questions) || questions.length === 0) {
      throw new Error('vision.batchIngest: questions (非空数组) 必填');
    }
    return request(
      'POST',
      '/api/vision/batch-ingest',
      { questions, options: { source: source || 'vision_batch_parse' } },
      { mockName: 'vision_batch_ingest' }
    );
  },
};
