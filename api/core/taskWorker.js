import { getDb } from './db.js';
import { PROMPTS, PROMPT_VERSION } from '../utils/prompts.js';
import { parseImageRecognitionResponse, createTaskMetrics, logTaskMetrics } from '../utils/llmParser.js';
import dotenv from 'dotenv';
// Phase-B-fix (2026-08-24): B10 — 改用 services/aiTrace.js 统一埋点
import { recordAiTraceAsync } from '../../services/aiTrace.js';
// 2026-09-22 (路径 A): 视觉推理统一走 services/llm.js 封装, 不再直连 DashScope 兼容端点.
import { visionChatCompletion } from '../../services/llm.js';
dotenv.config();

const MAX_RETRIES = 3;
const RETRY_DELAYS = [5000, 15000, 45000];
const STALE_PROCESSING_THRESHOLD_MS = 5 * 60 * 1000;
// P0-fix (2026-08-24): 失败任务 30 天后自动清理 (防 task_queue 无限增长)
const FAILED_TASK_RETENTION_DAYS = 30;

let isProcessing = false;
let taskStats = { total: 0, success: 0, fallback: 0, failed: 0, lowQuality: 0 };

async function recoverStaleTasks() {
  try {
    const pool = await getDb();
    const cutoff = new Date(Date.now() - STALE_PROCESSING_THRESHOLD_MS).toISOString();
    const result = await pool.query(
      "UPDATE task_queue SET status = 'pending', updated_at = CURRENT_TIMESTAMP WHERE status = 'processing' AND updated_at < $1",
      [cutoff]
    );
    if (result.rowCount > 0) {
      console.log(`[Worker] Recovered ${result.rowCount} stale processing tasks`);
    }
  } catch (err) {
    console.error('[Worker] Failed to recover stale tasks:', err.message);
  }
}

// P0-fix (2026-08-24): 清理 30 天前的 failed 任务 (防 task_queue 无限增长)
async function purgeOldFailedTasks() {
  try {
    const pool = await getDb();
    const cutoff = new Date(Date.now() - FAILED_TASK_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const result = await pool.query(
      "DELETE FROM task_queue WHERE status = 'failed' AND updated_at < $1",
      [cutoff]
    );
    if (result.rowCount > 0) {
      console.log(`[Worker] Purged ${result.rowCount} failed tasks older than ${FAILED_TASK_RETENTION_DAYS} days`);
    }
  } catch (err) {
    console.error('[Worker] Failed to purge old failed tasks:', err.message);
  }
}

async function recordMetrics(pool, taskId, metrics) {
  try {
    await pool.query(
      `INSERT INTO task_metrics (task_id, processing_time_ms, model, prompt_version, quality_score, is_fallback, token_prompt, token_completion, token_total)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [taskId, metrics.processing_time_ms, metrics.model, metrics.prompt_version,
       metrics.quality_score, metrics.is_fallback ? 1 : 0,
       metrics.token_usage.prompt, metrics.token_usage.completion, metrics.token_usage.total]
    );
  } catch (err) {
    console.error('[Worker] Failed to record metrics:', err.message);
  }
}

async function processNext() {
  if (isProcessing) return;
  isProcessing = true;

  try {
    const pool = await getDb();

    const rowsResult = await pool.query('SELECT id, user_email, subject, grade, image_data, retry_count FROM task_queue WHERE status = $1 ORDER BY created_at LIMIT 1', ['pending']);
    
    if (rowsResult.rows.length === 0) {
      isProcessing = false;
      return;
    }

    const task = rowsResult.rows[0];
    const retryCount = task.retry_count || 0;
    
    await pool.query('UPDATE task_queue SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', ['processing', task.id]);

    console.log(`[Worker] Processing task #${task.id} for ${task.user_email} (attempt ${retryCount + 1}/${MAX_RETRIES})`);

    if (!process.env.DASHSCOPE_API_KEY) {
      throw new Error('DASHSCOPE_API_KEY 环境变量未配置');
    }

    const startTime = Date.now();
    // services/llm.js 的 vision 出口在 finally 中写 ai_trace; 记录 LLM 调用失败是否已由封装
    // 写过, 避免与下方 catch 的手写 trace 重复 (手写仅覆盖 LLM 调用之外的异常).
    let llmTraceWritten = false;

    try {
      const promptConfig = PROMPTS.IMAGE_RECOGNITION;
      const prompt = promptConfig.build(task.subject, task.grade);

      // visionChatCompletion 接收不含 data: 前缀的纯 base64, 会自行拼回 `data:image/jpeg;base64,`;
      // task.image_data 是 data URL (前端 canvas.toDataURL('image/jpeg')), 故此处剥掉前缀.
      // 调用参数与原旁路对齐: qwen-vl-plus / temperature=0.7 / max_tokens=2000 / 无 response_format.
      const rawBase64 = String(task.image_data || '').replace(/^data:image\/[\w+.-]+;base64,/i, '');

      let llmResult;
      try {
        llmResult = await visionChatCompletion('', prompt, rawBase64, {
          model: promptConfig.model,
          temperature: promptConfig.temperature,
          max_tokens: promptConfig.maxTokens,
          jsonMode: false,
          task_type: 'image_recognition',
          budgetEnforce: false, // 2026-09-22 拍板: 路径 A 新接入口径为「只观测不拦」, 记账照常
          request_id: `task_${task.id}`,
          user_id: task.user_email,
          session_id: String(task.id),
        });
      } catch (llmErr) {
        llmTraceWritten = true; // 失败 trace 已由 services/llm.js 写入
        throw llmErr;
      }

      const { parsed: result, isFallback, quality } = parseImageRecognitionResponse(llmResult.content);

      const endTime = Date.now();
      const tokenUsage = {
        prompt: llmResult.usage?.prompt_tokens || 0,
        completion: llmResult.usage?.completion_tokens || 0,
        total: llmResult.usage?.total_tokens || 0
      };

      const metrics = createTaskMetrics(task.id, startTime, endTime, promptConfig.model, tokenUsage, quality, isFallback);
      logTaskMetrics(metrics);
      await recordMetrics(pool, task.id, metrics);

      // Phase-B-fix (2026-08-24): B10 — 成功路径 ai_trace 由 services/llm.js 统一写入, 此处不再重复.

      taskStats.total++;
      if (isFallback) {
        taskStats.fallback++;
        console.warn(`[Worker] Task #${task.id} used fallback parsing (quality=${quality})`);
      } else if (quality < 30) {
        taskStats.lowQuality++;
        console.warn(`[Worker] Task #${task.id} low quality result (quality=${quality})`);
      } else {
        taskStats.success++;
      }

      await pool.query(
        'UPDATE task_queue SET status = $1, result = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
        ['completed', JSON.stringify(result), task.id]
      );

      const questionData = {
        croppedImage: task.image_data,
        subject: task.subject,
        ...result
      };
      await pool.query(
        'INSERT INTO wrong_questions (user_email, data) VALUES ($1, $2)',
        [task.user_email, JSON.stringify(questionData)]
      );

      console.log(`[Worker] Task #${task.id} completed (quality=${quality}, time=${endTime - startTime}ms)`);
    } catch (err) {
      const endTime = Date.now();
      taskStats.total++;
      taskStats.failed++;
      console.error(`[Worker] Task #${task.id} failed (attempt ${retryCount + 1}/${MAX_RETRIES}):`, err.message);

      const metrics = createTaskMetrics(task.id, startTime, endTime, PROMPTS.IMAGE_RECOGNITION.model, { prompt: 0, completion: 0, total: 0 }, 0, true);
      logTaskMetrics(metrics);

      // Phase-B-fix (2026-08-24): B10 — 失败路径也 ai_trace
      // LLM 调用失败时 services/llm.js 已写过 trace, 仅在封装未覆盖的异常 (解析/入库等) 补写.
      if (!llmTraceWritten) {
        recordAiTraceAsync({
          request_id: `task_${task.id}`,
          user_id: task.user_email,
          session_id: String(task.id),
          task_type: 'image_recognition',
          provider: 'dashscope',
          model: PROMPTS.IMAGE_RECOGNITION.model,
          latency_ms: endTime - startTime,
          success: false,
          error_message: err.message,
        });
      }

      if (retryCount + 1 < MAX_RETRIES) {
        const delay = RETRY_DELAYS[retryCount] || RETRY_DELAYS[RETRY_DELAYS.length - 1];
        await pool.query(
          "UPDATE task_queue SET status = 'pending', retry_count = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
          [retryCount + 1, task.id]
        );
        console.log(`[Worker] Task #${task.id} will retry in ${delay}ms`);
      } else {
        await pool.query(
          'UPDATE task_queue SET status = $1, result = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
          ['failed', JSON.stringify({ error: err.message, retries: MAX_RETRIES }), task.id]
        );
        console.log(`[Worker] Task #${task.id} permanently failed after ${MAX_RETRIES} attempts`);
      }
    }
  } catch (err) {
    console.error('[Worker] Unexpected error:', err.message);
  } finally {
    isProcessing = false;
  }
}

export function getTaskStats() {
  return { ...taskStats, promptVersion: PROMPT_VERSION };
}

let intervalId = null;

export function startWorker(intervalMs = 3000) {
  console.log(`[Worker] Started, polling every ${intervalMs}ms (prompt v${PROMPT_VERSION})`);
  recoverStaleTasks();
  // P0-fix (2026-08-24): 启动时清理 30 天前 failed 任务, 避免无限堆积
  purgeOldFailedTasks();
  intervalId = setInterval(processNext, intervalMs);
}

export function stopWorker() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
