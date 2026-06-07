import { getDb } from './db.js';
import { PROMPTS, PROMPT_VERSION } from '../utils/prompts.js';
import { parseImageRecognitionResponse, createTaskMetrics, logTaskMetrics } from '../utils/llmParser.js';
import dotenv from 'dotenv';
dotenv.config();

const MAX_RETRIES = 3;
const RETRY_DELAYS = [5000, 15000, 45000];
const STALE_PROCESSING_THRESHOLD_MS = 5 * 60 * 1000;

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

    const apiKey = process.env.DASHSCOPE_API_KEY;
    if (!apiKey) {
      throw new Error('DASHSCOPE_API_KEY 环境变量未配置');
    }

    const startTime = Date.now();

    try {
      const promptConfig = PROMPTS.IMAGE_RECOGNITION;
      const prompt = promptConfig.build(task.subject, task.grade);

      const response = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: promptConfig.model,
          messages: [{
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: task.image_data } }
            ]
          }],
          temperature: promptConfig.temperature,
          max_tokens: promptConfig.maxTokens
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error?.message || `API error: ${response.status}`);
      }

      const content = data.choices[0].message.content;
      const { parsed: result, isFallback, quality } = parseImageRecognitionResponse(content);

      const endTime = Date.now();
      const tokenUsage = {
        prompt: data.usage?.prompt_tokens || 0,
        completion: data.usage?.completion_tokens || 0,
        total: data.usage?.total_tokens || 0
      };

      const metrics = createTaskMetrics(task.id, startTime, endTime, promptConfig.model, tokenUsage, quality, isFallback);
      logTaskMetrics(metrics);
      await recordMetrics(pool, task.id, metrics);

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
  intervalId = setInterval(processNext, intervalMs);
}

export function stopWorker() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
