/* ============================================================================
 * useEssayFlow.js — D086 §12 L4 V1.0 · 作文两阶段流程编排
 *
 * 职责: 编排"上传 → 转录 → 校对 → 批改 → 完成"5 态状态机,
 *       统一暴露状态 + 3 个动作 (transcribe / grade / reset), 自动错误捕获.
 *
 * 状态机:
 *   idle → uploading → transcribing → reviewing → grading → done
 *                                  ↘ failed     ↘ failed
 *
 * 设计:
 *   - 与 useAsyncResource 同款 subscriber 模式 (vanilla JS, 无 React 依赖)
 *   - 每个动作都返回 Promise, 失败抛 EssayError
 *   - reset() 完全清空, 回到 idle
 *
 * 调用方: pages/essay.html (B5)
 * 依赖: services/essay.js (B1)
 * ============================================================================ */

'use strict';

import { essay as essayService } from '../api/services/essay.js';

// ────────────────────────────────────────────────────────────────────────────
// 状态机定义
// ────────────────────────────────────────────────────────────────────────────

/**
 * 状态机合法迁移表 (防御非法跳转)
 *   idle         → uploading
 *   uploading     → transcribing | failed
 *   transcribing  → reviewing | failed
 *   reviewing     → grading | failed (transcribe 重跑)
 *   grading       → done | failed
 *   done          → idle (reset 后)
 *   failed        → idle (reset 后)
 */
const ALLOWED_TRANSITIONS = {
  idle:         ['uploading', 'transcribing', 'failed'],
  uploading:    ['transcribing', 'failed'],
  transcribing: ['reviewing', 'failed'],
  reviewing:    ['grading', 'transcribing', 'failed'],
  grading:      ['done', 'failed'],
  done:         ['idle'],
  failed:       ['idle'],
};

/**
 * 步骤序号 (用于 UI 进度条: 1/5, 2/5, ...)
 */
const STEP_INDEX = {
  idle: 0,
  uploading: 1,
  transcribing: 2,
  reviewing: 3,
  grading: 4,
  done: 5,
};

const TOTAL_STEPS = 5;

// ────────────────────────────────────────────────────────────────────────────
// Hook 实现
// ────────────────────────────────────────────────────────────────────────────

/**
 * 创建作文流程编排器.
 *
 * @returns {{
 *   state: EssayFlowState,
 *   subscribe: (cb: (state: EssayFlowState) => void) => () => void,
 *   getState: () => EssayFlowState,
 *   startTranscribe: (opts: { file: File|Blob, subject: Subject }) => Promise<{transcript, request_token}>,
 *   startGrade: (opts: { essay_title, exam_level, grade, subject, request_token, transcript? }) => Promise<GradeResult>,
 *   retryTranscribe: () => Promise<void>,
 *   reset: () => void,
 * }}
 */
export function useEssayFlow() {
  /** @type {EssayFlowState} */
  const state = {
    step: 'idle',
    error: null,
    imageUrl: null,        // Stage 0 上传后拿到的 URL
    imageInfo: null,       // { url, filename, size, width, height, uploaded_at }
    transcript: null,      // Stage A 输出
    request_token: null,   // 透传给 Stage B 做 idempotency
    report: null,          // Stage B 输出
  };

  const subs = new Set();

  const setState = (patch) => {
    let changed = false;
    for (const k of Object.keys(patch)) {
      if (state[k] !== patch[k]) {
        changed = true;
        break;
      }
    }
    if (!changed) return;
    Object.assign(state, patch);
    for (const cb of subs) {
      try { cb(state); } catch (_) { /* subscriber 自己负责 try-catch */ }
    }
  };

  const transition = (next) => {
    if (!ALLOWED_TRANSITIONS[state.step]?.includes(next)) {
      throw new Error(`非法的状态迁移: ${state.step} → ${next}`);
    }
    setState({ step: next, error: next === 'failed' ? state.error : null });
  };

  // ────────────────────────────────────────────────────────────────────────
  // 公共 API
  // ────────────────────────────────────────────────────────────────────────

  const subscribe = (cb) => {
    subs.add(cb);
    try { cb(state); } catch (_) {}
    return () => subs.delete(cb);
  };

  const getState = () => state;

  // ────────────────────────────────────────────────────────────────────────
  // Stage 0 + Stage A: 上传 + 转录
  // ────────────────────────────────────────────────────────────────────────

  /**
   * 启动转录流程: 上传图片 → 调 transcribe → 跳 reviewing.
   * @param {object} opts
   * @param {File|Blob|string} opts.image  File/Blob (走 Stage 0) 或已上传的 dataURL 字符串
   * @param {'chinese'|'english'} opts.subject
   * @returns {Promise<{transcript: TranscriptResult, request_token: string}>}
   */
  const startTranscribe = async ({ image, subject }) => {
    try {
      if (!image) throw new Error('startTranscribe: image 必填');
      if (!subject) throw new Error('startTranscribe: subject 必填');

      // Stage 0: 上传图片
      transition('uploading');
      const uploadRes = await essayService.uploadImage(image, { purpose: 'essay' });
      if (!uploadRes.success) {
        throw new Error(uploadRes.message || '图片上传失败');
      }
      const imageUrl = uploadRes.data.url;
      const imageInfo = uploadRes.data;
      setState({ imageUrl, imageInfo });

      // Stage A: 转录
      transition('transcribing');
      const tRes = await essayService.transcribe({ images: [imageUrl], subject });
      if (!tRes.success) {
        throw new Error(tRes.message || '转录失败');
      }
      const transcript = tRes.data.transcript;
      const request_token = tRes.data.request_token;

      setState({ transcript, request_token });
      transition('reviewing');
      return { transcript, request_token };
    } catch (err) {
      setState({ error: err });
      transition('failed');
      throw err;
    }
  };

  /**
   * 重新转录 (用户在校对页修改了学科后).
   * 复用上次的 image, 只重跑 Stage A.
   * @param {object} opts
   * @param {'chinese'|'english'} opts.subject
   */
  const retryTranscribe = async ({ subject }) => {
    if (!state.imageUrl) {
      throw new Error('retryTranscribe: 无 image, 请先 startTranscribe');
    }
    try {
      transition('transcribing');
      const tRes = await essayService.transcribe({ images: [state.imageUrl], subject });
      if (!tRes.success) {
        throw new Error(tRes.message || '转录失败');
      }
      setState({ transcript: tRes.data.transcript, request_token: tRes.data.request_token });
      transition('reviewing');
    } catch (err) {
      setState({ error: err });
      transition('failed');
      throw err;
    }
  };

  // ────────────────────────────────────────────────────────────────────────
  // Stage B: 批改
  // ────────────────────────────────────────────────────────────────────────

  /**
   * 启动批改: 调 grade → 跳 done.
   * @param {object} opts
   * @param {string} opts.essay_title
   * @param {'gaokao'|'zhongkao'} opts.exam_level
   * @param {string} opts.grade
   * @param {'chinese'|'english'} opts.subject
   * @returns {Promise<GradeResult>}
   */
  const startGrade = async ({ essay_title, exam_level, grade, subject }) => {
    try {
      if (!state.transcript) {
        throw new Error('startGrade: 无 transcript, 请先完成转录');
      }
      if (!state.request_token) {
        throw new Error('startGrade: 无 request_token (transcribe 异常)');
      }
      if (!essay_title) throw new Error('startGrade: essay_title 必填');
      if (!exam_level) throw new Error('startGrade: exam_level 必填');
      if (!grade) throw new Error('startGrade: grade 必填');
      if (!subject) throw new Error('startGrade: subject 必填');

      transition('grading');
      const gRes = await essayService.grade({
        transcript: state.transcript,
        essay_title,
        exam_level,
        grade,
        subject,
        request_token: state.request_token,
      });
      if (!gRes.success) {
        throw new Error(gRes.message || '批改失败');
      }
      setState({ report: gRes.data });
      transition('done');
      return gRes.data;
    } catch (err) {
      setState({ error: err });
      transition('failed');
      throw err;
    }
  };

  // ────────────────────────────────────────────────────────────────────────
  // 重置 / 销毁
  // ────────────────────────────────────────────────────────────────────────

  /**
   * 完全重置, 回到 idle.
   */
  const reset = () => {
    if (state.step === 'done' || state.step === 'failed') {
      transition('idle');
    }
    setState({
      error: null,
      imageUrl: null,
      imageInfo: null,
      transcript: null,
      request_token: null,
      report: null,
    });
  };

  return {
    state,
    subscribe,
    getState,
    startTranscribe,
    retryTranscribe,
    startGrade,
    reset,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// 工具函数 (导出供 UI 组件使用)
// ────────────────────────────────────────────────────────────────────────────

/**
 * 获取当前步骤 (1/5, 2/5 ...) 用于进度条.
 * @param {string} step
 * @returns {{current: number, total: number, label: string}}
 */
export function getStepProgress(step) {
  const STEP_LABEL = {
    idle: '准备',
    uploading: '上传图片',
    transcribing: 'AI 识别原文',
    reviewing: '校对原文',
    grading: 'AI 批改',
    done: '完成',
    failed: '失败',
  };
  return {
    current: STEP_INDEX[step] || 0,
    total: TOTAL_STEPS,
    label: STEP_LABEL[step] || step,
  };
}

/**
 * 判断是否可执行某个动作 (供 UI 按钮 disabled 状态用).
 * @param {string} currentStep
 * @param {'startTranscribe'|'retryTranscribe'|'startGrade'|'reset'} action
 * @returns {boolean}
 */
export function canPerformAction(currentStep, action) {
  const ACTION_FROM_STEPS = {
    startTranscribe: ['idle', 'failed'],
    retryTranscribe: ['reviewing', 'failed'],
    startGrade: ['reviewing'],
    reset: ['done', 'failed', 'reviewing'],
  };
  return ACTION_FROM_STEPS[action]?.includes(currentStep) || false;
}

export default useEssayFlow;
