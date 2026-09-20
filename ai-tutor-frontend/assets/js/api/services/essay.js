// services/essay.js — 作文批改 V1.0 (D086 §12 L4)
//
// 后端契约 (与 api/handlers/essay/{transcribeService,gradeService,imageHandler}.js 对齐):
//   POST /api/upload/image          { image: "data:image/...;base64,...", purpose? }
//                                  → { url, filename, size, mime, purpose, width, height, uploaded_at }
//   POST /api/essay/transcribe     { images: ["http(s)://..."], subject: "chinese"|"english" }
//                                  → { transcript: { paragraphs, confidence, uncertain_total },
//                                      request_token, raw_metrics }
//   POST /api/essay/grade          { transcript, essay_title, exam_level, grade, subject, request_token }
//                                  → { report_id, annotations[], scores, comment, rubric_id, meta }
//   GET  /api/essay?limit=N        → { reports: [...] }
//
// 调用方: pages/essay.html (B2-B5 UI 开发), useEssayFlow.js (B4 hook)
// Mock:   ?mock=true 或 localStorage.aitutor.useMock=true 走 mock JSON

import { request } from '../client.js';

// ────────────────────────────────────────────────────────────────────────────
// 类型定义 (JSDoc, 与 Zod Schema 一一对应)
// ────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} TranscriptLine
 * @property {number} line_no
 * @property {string} text
 * @property {string[]} [uncertain_chars]
 */

/**
 * @typedef {Object} TranscriptParagraph
 * @property {number} paragraph_index
 * @property {TranscriptLine[]} lines
 */

/**
 * @typedef {Object} TranscriptResult
 * @property {TranscriptParagraph[]} paragraphs
 * @property {number} confidence
 * @property {number} uncertain_total
 */

/**
 * @typedef {'chinese' | 'english'} Subject
 * @typedef {'gaokao' | 'zhongkao'} ExamLevel
 * @typedef {'初一' | '初二' | '初三' | '高一' | '高二' | '高三'} Grade
 */

/**
 * @typedef {Object} Annotation
 * @property {string} id
 * @property {'highlight' | 'masterstroke' | 'grammar_error' | 'advanced_vocab' | 'logic_issue'} type
 * @property {Object} anchor
 * @property {number} anchor.paragraph_index
 * @property {string} anchor.quote
 * @property {number} [anchor.line_no]
 * @property {string} comment
 * @property {boolean} [anchor_failed]
 * @property {string} [failure_reason]
 */

/**
 * @typedef {Object} EssayScores
 * @property {number} content
 * @property {number} language
 * @property {number} structure
 * @property {number} development
 * @property {number} total
 */

// ────────────────────────────────────────────────────────────────────────────
// 工具: File → DataURL (前端压缩上传用)
// ────────────────────────────────────────────────────────────────────────────

/**
 * 把 File 对象读取为 base64 data URL.
 * @param {File|Blob} file
 * @returns {Promise<string>} "data:image/...;base64,..."
 */
function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error(`读取文件失败: ${file.name || 'unknown'}`));
    r.readAsDataURL(file);
  });
}

/**
 * 客户端压缩 (V1.1 优化, 当前 V1.0 透传).
 * 占位实现, 未来可加 canvas 压缩, 减少 base64 体积.
 * @param {string} dataUrl
 * @param {number} [maxSize=1920]
 * @returns {Promise<string>}
 */
async function maybeCompress(dataUrl, maxSize = 1920) {
  // V1.0: 不做客户端压缩, 后端 sharp 已重编码
  return dataUrl;
}

// ────────────────────────────────────────────────────────────────────────────
// Service 实现
// ────────────────────────────────────────────────────────────────────────────

export const essay = {
  /**
   * Stage 0: 上传图片, 获取 URL.
   * @param {File|Blob|string} input   File/Blob 或已经是 data:URL/base64 字符串
   * @param {Object} [opts]
   * @param {'essay'|'avatar'|'general'} [opts.purpose='essay']
   * @returns {Promise<{success:boolean, data:{url:string, filename:string, size:number, mime:string, width:number, height:number, uploaded_at:string}}>}
   */
  async uploadImage(input, { purpose = 'essay' } = {}) {
    let dataUrl;
    if (input instanceof Blob || input instanceof File) {
      dataUrl = await readFileAsDataURL(input);
      dataUrl = await maybeCompress(dataUrl);
    } else if (typeof input === 'string') {
      dataUrl = input; // 已上传过的, 或已是 data URL
    } else {
      throw new Error('essay.uploadImage: input 必须是 File / Blob / data URL 字符串');
    }
    return request('POST', '/api/upload/image', { image: dataUrl, purpose }, {
      mockName: 'essay_upload',
    });
  },

  /**
   * Stage A: 视觉转录.
   * @param {Object} opts
   * @param {string[]} opts.images  URL 数组 (必须先调 uploadImage, Patch 2)
   * @param {Subject} opts.subject
   * @returns {Promise<{success:boolean, data:{transcript:TranscriptResult, request_token:string, raw_metrics:Object}}>}
   */
  async transcribe({ images, subject }) {
    if (!Array.isArray(images) || images.length === 0) {
      throw new Error('essay.transcribe: images 必填 (URL 数组)');
    }
    if (!['chinese', 'english'].includes(subject)) {
      throw new Error('essay.transcribe: subject 必须是 chinese | english');
    }
    return request('POST', '/api/essay/transcribe', { images, subject }, {
      mockName: 'essay_transcribe',
    });
  },

  /**
   * Stage B: 批改 (基于 Stage A 的转录结果).
   * @param {Object} opts
   * @param {TranscriptResult} opts.transcript
   * @param {string} opts.essay_title
   * @param {ExamLevel} opts.exam_level
   * @param {Grade} opts.grade
   * @param {Subject} opts.subject
   * @param {string} opts.request_token  (Stage A 透传, 用于 idempotency)
   * @returns {Promise<{success:boolean, data:{report_id:string, annotations:Annotation[], scores:EssayScores, comment:string, rubric_id:string, meta:Object}}>}
   */
  async grade({ transcript, essay_title, exam_level, grade, subject, request_token }) {
    if (!transcript || !Array.isArray(transcript.paragraphs)) {
      throw new Error('essay.grade: transcript 必填 (来自 Stage A)');
    }
    if (!essay_title || typeof essay_title !== 'string') {
      throw new Error('essay.grade: essay_title 必填');
    }
    if (!['gaokao', 'zhongkao'].includes(exam_level)) {
      throw new Error('essay.grade: exam_level 必须是 gaokao | zhongkao');
    }
    const validGrades = ['初一', '初二', '初三', '高一', '高二', '高三'];
    if (!validGrades.includes(grade)) {
      throw new Error(`essay.grade: grade 必须是 ${validGrades.join(' | ')}`);
    }
    if (!request_token || typeof request_token !== 'string') {
      throw new Error('essay.grade: request_token 必填 (来自 Stage A)');
    }
    return request('POST', '/api/essay/grade', {
      transcript, essay_title, exam_level, grade, subject, request_token,
    }, {
      mockName: 'essay_grade',
    });
  },

  /**
   * 历史报告列表.
   * @param {Object} [opts]
   * @param {number} [opts.limit=20]  (上限 50)
   * @returns {Promise<{success:boolean, data:{reports:Array<{report_id:string, essay_title:string, exam_level:string, grade:string, status:string, confidence:number, model:string, created_at:string}>}}>}
   */
  async list({ limit = 20 } = {}) {
    const safeLimit = Math.min(Math.max(parseInt(limit) || 20, 1), 50);
    return request('GET', `/api/essay?limit=${safeLimit}`, null, {
      mockName: 'essay_list',
    });
  },

  /**
   * 单条报告详情.
   * @param {string} reportId
   * @returns {Promise<{success:boolean, data:Object}>}
   */
  async get(reportId) {
    if (!reportId) throw new Error('essay.get: reportId 必填');
    return request('GET', `/api/essay/${encodeURIComponent(reportId)}`, null, {
      mockName: 'essay_detail',
    });
  },
};

// 兼容默认导出 (供 import essay from ... 风格)
export default essay;
