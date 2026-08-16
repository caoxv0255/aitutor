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
};
