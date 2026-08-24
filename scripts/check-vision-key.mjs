#!/usr/bin/env node
/**
 * scripts/check-vision-key.mjs
 * P0-fix (2026-08-24): Phase D — D4
 *
 * 验证 .env 中 DASHSCOPE_API_KEY 是否对当前 DASHSCOPE_BASE_URL 生效.
 *
 * 用法:
 *   node scripts/check-vision-key.mjs
 *   node scripts/check-vision-key.mjs --subject=math
 *
 * 退出码:
 *   0  = API Key 有效 (HTTP 2xx, vision 调用返回内容)
 *   1  = API Key 缺失
 *   2  = API Key 无效 / 被拒绝 (HTTP 401/403/Access denied)
 *   3  = 网络/超时/其他错误
 *
 * 输出:
 *   - ✅ / ❌
 *   - HTTP 状态码 + 错误信息
 *   - 校验耗时
 *   - model / base_url / key 前 8 位 + 后 4 位 (脱敏)
 */

import dotenv from 'dotenv';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
dotenv.config({ path: join(ROOT, '.env') });

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .filter((a) => a.startsWith('--'))
    .map((a) => {
      const [k, ...rest] = a.replace(/^--/, '').split('=');
      return [k, rest.length ? rest.join('=') : 'true'];
    })
);

const MODEL = args.model || 'qwen-vl-plus';
const BASE_URL = process.env.DASHSCOPE_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1';
const KEY = process.env.DASHSCOPE_API_KEY;

const maskKey = (k) => {
  if (!k) return '(none)';
  if (k.length <= 12) return k.slice(0, 4) + '***' + k.slice(-2);
  return k.slice(0, 8) + '***' + k.slice(-4);
};

const log = (...a) => console.log(...a);

if (!KEY) {
  console.log(JSON.stringify({ ok: false, code: 1, message: 'DASHSCOPE_API_KEY not set in .env' }, null, 2));
  process.exit(1);
}

// 最小 vision payload: 1x1 透明 PNG base64, 数学题简短问题.
const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

const payload = {
  model: MODEL,
  messages: [
    {
      role: 'system',
      content: [{ type: 'text', text: 'You are a helpful assistant.' }],
    },
    {
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: `data:image/png;base64,${TINY_PNG_BASE64}` } },
        { type: 'text', text: 'ping' },
      ],
    },
  ],
  max_tokens: 8,
  temperature: 0,
};

const url = BASE_URL.replace(/\/$/, '') + '/chat/completions';

const t0 = Date.now();
let res;
try {
  res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${KEY}`,
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(20_000),
  });
} catch (err) {
  console.log(
    JSON.stringify(
      {
        ok: false,
        code: 3,
        message: 'fetch failed: ' + (err.message || String(err)),
        base_url: BASE_URL,
        model: MODEL,
        key: maskKey(KEY),
        latency_ms: Date.now() - t0,
      },
      null,
      2
    )
  );
  process.exit(3);
}

const latency = Date.now() - t0;
const text = await res.text().catch(() => '');

if (res.status >= 200 && res.status < 300) {
  let content = '';
  try {
    const j = JSON.parse(text);
    content = j?.choices?.[0]?.message?.content ?? '';
  } catch {
    /* non-JSON success body */
  }
  console.log(
    JSON.stringify(
      {
        ok: true,
        code: 0,
        message: 'Vision API Key 有效',
        base_url: BASE_URL,
        model: MODEL,
        key: maskKey(KEY),
        http_status: res.status,
        latency_ms: latency,
        sample_content: content.slice(0, 80),
      },
      null,
      2
    )
  );
  process.exit(0);
}

const isAccessDenied =
  res.status === 401 ||
  res.status === 403 ||
  /Access denied/i.test(text) ||
  /invalid api key/i.test(text) ||
  /invalid_api_key/i.test(text);

console.log(
  JSON.stringify(
    {
      ok: false,
      code: isAccessDenied ? 2 : 3,
      message: isAccessDenied ? 'API Key 无效或被拒绝' : `Vision 调用失败 (HTTP ${res.status})`,
      base_url: BASE_URL,
      model: MODEL,
      key: maskKey(KEY),
      http_status: res.status,
      latency_ms: latency,
      body_preview: text.slice(0, 300),
    },
    null,
    2
  )
);
process.exit(isAccessDenied ? 2 : 3);