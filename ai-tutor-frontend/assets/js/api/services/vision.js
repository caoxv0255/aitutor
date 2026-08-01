// services/vision.js — 图片上传 + OCR + 入库 (独立 Epic F4)
import { request } from '../client.js';

export const vision = {
  async parse({ image, imageBase64, mimeType = 'image/jpeg' } = {}) {
    const body = imageBase64
      ? { image_base64: imageBase64, mime_type: mimeType }
      : { image, mime_type: mimeType };
    return request('POST', '/api/vision/parse', body, { mockName: 'vision_parse' });
  },

  async ingest({ content, subjectCode, knowledgePointId, sourceType = 'image' }) {
    return request('POST', '/api/vision/ingest', {
      content, subject_code: subjectCode, knowledge_point_id: knowledgePointId, source_type: sourceType,
    }, { mockName: 'vision_ingest' });
  },

  async getParseStatus(taskId) {
    return request('GET', `/api/vision/parse/${taskId}`, null, { mockName: 'vision_status' });
  },
};
