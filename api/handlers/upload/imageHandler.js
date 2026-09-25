/* ============================================================================
 * imageHandler.js — D086 §12 L4 V1.0 · /api/upload/image
 *
 * 职责: 接收 base64 图片 → sharp 重编码 + EXIF 清除 → 落盘到 public/uploads/
 *       返回相对 URL, 前端传给 /api/essay/transcribe.
 *
 * 设计要点:
 *   - 不引入 multer/busboy: 沿用现有 /api/vision/parse 的 base64 方案, 零新依赖
 *   - sharp 二次校验 + 重编码: 拒绝伪造 MIME, 自动旋转 EXIF, 压缩到 85% JPEG
 *   - UUID 文件名 + 路径白名单: 杜绝 path traversal
 *   - express.json 全局 10mb 限制 = 实际可接受约 7.5MB 原始图片 (够手机拍照)
 *
 * 调用方: server.js POST /api/upload/image
 * 落盘: public/uploads/{purpose}/{YYYY}/{MM}/{uuid}.jpg
 * 访问: GET /uploads/{purpose}/{YYYY}/{MM}/{uuid}.jpg (由 express.static('public') 自动托管)
 *
 * 2026-09-25: 抽出 saveImageFromBase64() 作为**唯一**落盘实现, 供
 *   api/handlers/essay/analyzeService.js 复用同一存储方案 (同一目录/命名/静态托管),
 *   避免第二条并列的图片存储约定。uploadImageHandler 改为调用它, 对外错误码/文案不变。
 * ============================================================================ */

'use strict';

import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import sharp from 'sharp';

import { successJson, errorJson } from '../../utils/response.js';
import { ErrorCode } from '../../utils/errorCodes.js';
import { logger } from '../../core/logger.js';

// ────────────────────────────────────────────────────────────────────────────
// 常量
// ────────────────────────────────────────────────────────────────────────────

const UPLOAD_ROOT = path.join(process.cwd(), 'public', 'uploads');

/** 全局 express.json 限制 10mb, base64 膨胀率 ~4/3, 故最大原始图片 ~7.5MB */
const MAX_BASE64_CHARS = 10 * 1024 * 1024; // 10MB string, server-side 实际拦截由 express.json 完成

/** 支持的图片格式 (sharp 能识别的) */
const SUPPORTED_FORMATS = new Set([
  'jpeg', 'jpg', 'png', 'webp', 'heif', 'heic', 'gif', 'tiff', 'avif',
]);

/** 允许的 purpose 目录白名单 (防任意目录写入) */
const ALLOWED_PURPOSES = new Set(['essay', 'avatar', 'general']);

// ────────────────────────────────────────────────────────────────────────────
// 工具: 安全提取 base64 内容
// ────────────────────────────────────────────────────────────────────────────

/**
 * 解析 data URL 形式: "data:image/jpeg;base64,/9j/4AAQ..."
 * 也兼容纯 base64 字符串 (无前缀, 默认按 jpeg 处理).
 *
 * @param {string} input
 * @returns {{ext: string, data: string} | null}
 */
function parseBase64Image(input) {
  if (typeof input !== 'string') return null;
  const trimmed = input.trim();

  // 标准 data URL
  const m = trimmed.match(/^data:image\/([\w+.-]+);base64,(.+)$/i);
  if (m) {
    return { ext: m[1].toLowerCase(), data: m[2] };
  }

  // 宽松: data:image/jpeg;base64,... (无大小写)
  const m2 = trimmed.match(/^data:image\/([\w+.-]+);BASE64,(.+)$/);
  if (m2) {
    return { ext: m2[1].toLowerCase(), data: m2[2] };
  }

  // 纯 base64 字符串 (无前缀) - 默认按 jpeg 处理
  // 启发式: 长度是 4 的倍数, 字符集是 base64
  if (/^[A-Za-z0-9+/=_-]+$/.test(trimmed) && trimmed.length % 4 === 0 && trimmed.length > 100) {
    return { ext: 'jpeg', data: trimmed };
  }

  return null;
}

/** 构造一个带 ErrorCode 的落盘异常 (供 uploadImageHandler / analyzeService 统一映射) */
function uploadError(uploadCode, message) {
  const err = new Error(message);
  err.uploadCode = uploadCode;
  return err;
}

// ────────────────────────────────────────────────────────────────────────────
// 共享实现: base64 → sharp 处理 → 落盘 → 返回 URL
// ────────────────────────────────────────────────────────────────────────────

/**
 * 处理并落盘一张 base64 图片 (POST /api/upload/image 与 essay analyze 共用).
 *
 * @param {string} image  "data:image/...;base64,..." 或纯 base64 字符串
 * @param {object} [opts]
 * @param {string} [opts.purpose='general']  'essay'|'avatar'|'general' (非法值回落 general)
 * @param {string} [opts.email]              仅用于日志 (可空)
 * @returns {Promise<{url:string, filename:string, size:number, mime:string, purpose:string,
 *                    width:number, height:number, uploaded_at:string}>}
 * @throws {Error & {uploadCode:string}} uploadCode ∈ ErrorCode.UPLOAD_* ;
 *        文案与 /api/upload/image 对外文案完全一致。
 */
export async function saveImageFromBase64(image, { purpose: rawPurpose = 'general', email = null } = {}) {
  const purpose = ALLOWED_PURPOSES.has(rawPurpose) ? rawPurpose : 'general';

  // 1. 基础校验
  if (!image || typeof image !== 'string') {
    throw uploadError(ErrorCode.VALIDATION_REQUIRED_FIELD, 'image 字段必填');
  }

  // 2. 解析 base64
  const parsed = parseBase64Image(image);
  if (!parsed) {
    throw uploadError(ErrorCode.UPLOAD_INVALID_BASE64, 'image 必须为 data:image/...;base64,... 格式或纯 base64 字符串');
  }

  // 3. 大小预检 (在 Buffer.from 之前, 节省内存)
  if (parsed.data.length > MAX_BASE64_CHARS) {
    throw uploadError(
      ErrorCode.UPLOAD_UNSUPPORTED_FORMAT,
      `图片过大 (base64 长度 ${parsed.data.length} > ${MAX_BASE64_CHARS}), 请压缩后重试`
    );
  }

  // 4. 解码 → Buffer
  let buffer;
  try {
    buffer = Buffer.from(parsed.data, 'base64');
  } catch (e) {
    logger.error('[upload] base64 decode failed', { error: e });
    throw uploadError(ErrorCode.UPLOAD_INVALID_BASE64, 'base64 解码失败，请提供合法的图片数据');
  }
  if (buffer.length === 0) {
    throw uploadError(ErrorCode.UPLOAD_INVALID_BASE64, 'base64 解码后为空');
  }

  // 5. sharp 处理: 格式二次校验 + EXIF 自动旋转 + 重编码 + 压缩
  let processed;
  let processedMeta;
  try {
    const instance = sharp(buffer, { failOn: 'none' });
    const meta = await instance.metadata();
    const detectedFormat = (meta.format || '').toLowerCase();

    if (!SUPPORTED_FORMATS.has(detectedFormat)) {
      throw uploadError(
        ErrorCode.UPLOAD_UNSUPPORTED_FORMAT,
        `不支持的图片格式: ${detectedFormat || 'unknown'} (支持: ${[...SUPPORTED_FORMATS].join(', ')})`
      );
    }

    // 防御: 元数据声明的尺寸合理性 (避免内存炸弹)
    if (meta.width && meta.height && (meta.width > 8000 || meta.height > 8000)) {
      throw uploadError(
        ErrorCode.UPLOAD_UNSUPPORTED_FORMAT,
        `图片尺寸过大: ${meta.width}x${meta.height} (上限 8000x8000)`
      );
    }

    // 重编码: 自动旋转 + JPEG 85% 质量
    processed = await instance
      .rotate() // 根据 EXIF Orientation 自动旋转
      .jpeg({ quality: 85, mozjpeg: true, progressive: true })
      .toBuffer({ resolveWithObject: true });

    processedMeta = processed.info; // { size, width, height, format }
  } catch (e) {
    if (e.uploadCode) throw e; // 上面主动抛出的格式/尺寸错误 → 原样透传
    logger.error('[upload] sharp processing failed', { error: e, ext: parsed.ext, email });
    throw uploadError(ErrorCode.UPLOAD_PROCESSING_FAILED, '图片处理失败，请稍后重试');
  }

  // 6. 生成目标路径
  const now = new Date();
  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const id = crypto.randomBytes(16).toString('hex');
  const filename = `${id}.jpg`;
  const dir = path.join(UPLOAD_ROOT, purpose, yyyy, mm);
  const fullPath = path.join(dir, filename);

  // 二次防御: fullPath 必须在 UPLOAD_ROOT 下 (防 path traversal, 理论上 UUID 已杜绝)
  const normalized = path.normalize(fullPath);
  if (!normalized.startsWith(path.normalize(UPLOAD_ROOT) + path.sep)) {
    logger.error('[upload] path traversal attempt', { fullPath, email });
    throw uploadError(ErrorCode.UPLOAD_DISK_ERROR, '非法路径');
  }

  // 7. 写盘
  try {
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(fullPath, processed.data);
  } catch (e) {
    logger.error('[upload] write file failed', { error: e, fullPath, email });
    throw uploadError(ErrorCode.UPLOAD_DISK_ERROR, '图片保存失败，请稍后重试');
  }

  // 8. 返回相对 URL (前端用 new URL(url, location.origin) 解析为绝对地址)
  const url = `/uploads/${purpose}/${yyyy}/${mm}/${filename}`;

  return {
    url,
    filename,
    size: processed.data.length,
    mime: 'image/jpeg',
    purpose,
    width: processedMeta.width,
    height: processedMeta.height,
    uploaded_at: now.toISOString(),
    original_format: parsed.ext,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// 主函数: uploadImageHandler
// ────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/upload/image
 * Body: { image: "data:image/jpeg;base64,..." | "<base64>", purpose?: "essay"|"avatar"|"general" }
 * Auth: 必需 (通过 authMiddleware)
 *
 * 200 Response:
 *   { success: true, data: { url, filename, size, mime, purpose, uploaded_at } }
 *
 * Error Responses (with errorCode):
 *   AUTH_NOT_LOGIN               401 - 未登录
 *   VALIDATION_REQUIRED_FIELD    400 - image 缺失
 *   UPLOAD_INVALID_BASE64        400 - 非合法 base64
 *   UPLOAD_UNSUPPORTED_FORMAT    400 - 图片格式不支持 / 过大
 *   UPLOAD_PROCESSING_FAILED     500 - sharp 处理失败
 *   UPLOAD_DISK_ERROR            500 - 写盘失败
 */
export async function uploadImageHandler(req, res) {
  if (req.method !== 'POST') {
    return errorJson(res, ErrorCode.VALIDATION_ERROR, 'Method not allowed');
  }

  // 1. 鉴权 (authMiddleware 已挂载, 此处双保险)
  const email = req.user?.email;
  if (!email) {
    return errorJson(res, ErrorCode.AUTH_NOT_LOGIN);
  }

  const { image, purpose } = req.body || {};

  let saved;
  try {
    saved = await saveImageFromBase64(image, { purpose, email });
  } catch (e) {
    // 对外只回 ErrorMap 的固定文案; 具体原因 (e.message) 只进日志 (门禁第 11 段)
    if (e.uploadCode) {
      logger.warn('[upload] rejected', { error: e, email, uploadCode: e.uploadCode });
      return errorJson(res, e.uploadCode);
    }
    logger.error('[upload] unexpected failure', { error: e, email });
    return errorJson(res, ErrorCode.UPLOAD_PROCESSING_FAILED);
  }

  const { original_format, ...data } = saved;

  logger.info('[upload] image uploaded', {
    email,
    purpose: data.purpose,
    url: data.url,
    size: data.size,
    original_format,
    output_dimensions: `${data.width}x${data.height}`,
  });

  return successJson(res, data, '上传成功', { requestId: req.requestId });
}
