#!/usr/bin/env node
/* ============================================================================
 * tests/integration/essay-v1-bct.mjs — D086 §12 L4 V1.0 · 端到端集成测试
 *
 * 6 步全链路 (真实后端 + 真实 DB, 真实或 Mock LLM):
 *   1. POST /api/auth/guest              → token
 *   2. POST /api/upload/image            → http(s) URL
 *   3. POST /api/essay/transcribe        → transcript + request_token
 *   4. POST /api/essay/grade             → report (含 annotations + scores)
 *   5. GET  /api/essay?limit=5           → 列表含第 4 步 report_id
 *   6. GET  /api/essay/{report_id}       → 详情与第 4 步一致
 *
 * 运行 (需先起服务):
 *   PORT=3002 node server.js &
 *   BCT_URL=http://localhost:3002 node tests/integration/essay-v1-bct.mjs
 *
 * Mock 模式 (无 LLM 凭证): 服务端 PROXY_MOCK=1 + 本脚本自动注入
 *   (详: scripts/essay-bct-mock-proxy.mjs 启动 mock 代理)
 * ============================================================================ */

import { createHash } from 'node:crypto';

// ────────────────────────────────────────────────────────────────────────────
// 配置
// ────────────────────────────────────────────────────────────────────────────

const BASE = process.env.BCT_URL || 'http://localhost:3002';
const TIMEOUT = 60_000; // 60s (Stage A + Stage B 各 30s 上限)
const MOCK_1X1_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkAAIAAAoAAv/lxKUAAAAASUVORK5CYII=';

const PHASE = {
  auth:        '🔑 [1/6] 游客登录',
  upload:      '📤 [2/6] 上传图片',
  transcribe:  '📖 [3/6] 视觉转录',
  grade:       '✍️  [4/6] 文本批改',
  list:        '📋 [5/6] 历史列表',
  detail:      '🔍 [6/6] 报告详情',
};

// ────────────────────────────────────────────────────────────────────────────
// 工具
// ────────────────────────────────────────────────────────────────────────────

let pass = 0;
let fail = 0;
const log = (icon, msg) => console.log(`${icon} ${msg}`);
const ok = (msg) => { pass++; log('✅', msg); };
const bad = (msg, err) => { fail++; log('❌', msg); if (err) console.log('   ', err); };

/**
 * 统一 fetch 封装, 强制 Content-Type + 解析 envelope
 */
async function call(method, path, { body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), TIMEOUT);
  try {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch (_) { /* not JSON */ }
    return { status: res.status, ok: res.ok, body: json, raw: text };
  } catch (e) {
    return { status: 0, ok: false, error: e.message };
  } finally {
    clearTimeout(tid);
  }
}

/**
 * 强校验 envelope: { success, data?, errorCode?, message }
 */
function assertEnvelope(r, label) {
  if (!r.ok) throw new Error(`${label}: HTTP ${r.status}, body=${JSON.stringify(r.body).slice(0, 200)}`);
  if (!r.body || r.body.success !== true) {
    throw new Error(`${label}: success!==true, body=${JSON.stringify(r.body).slice(0, 200)}`);
  }
  if (!r.body.data) throw new Error(`${label}: missing data`);
  return r.body.data;
}

// ────────────────────────────────────────────────────────────────────────────
// 步骤 1: 游客登录
// ────────────────────────────────────────────────────────────────────────────

async function step1_auth() {
  log('🔑', PHASE.auth);
  const r = await call('POST', '/api/auth/guest', { body: {} });
  const data = assertEnvelope(r, 'guest login');
  if (!data.token) throw new Error('missing token in response');
  ok(`token len=${data.token.length}, user=${data.user?.email || 'guest'}`);
  return data.token;
}

// ────────────────────────────────────────────────────────────────────────────
// 步骤 2: 上传图片
// ────────────────────────────────────────────────────────────────────────────

async function step2_upload(token) {
  log('📤', PHASE.upload);
  const r = await call('POST', '/api/upload/image', {
    body: { image: `data:image/png;base64,${MOCK_1X1_PNG}`, purpose: 'essay' },
    token,
  });
  const data = assertEnvelope(r, 'upload image');
  if (!data.url || !data.url.startsWith('/uploads/')) {
    throw new Error(`invalid url: ${data.url}`);
  }
  if (!data.filename) throw new Error('missing filename');
  ok(`url=${data.url}, size=${data.size}B, dim=${data.width}x${data.height}`);
  return data.url;
}

// ────────────────────────────────────────────────────────────────────────────
// 步骤 3: 视觉转录
// ────────────────────────────────────────────────────────────────────────────

async function step3_transcribe(token, imageUrl) {
  log('📖', PHASE.transcribe);
  const r = await call('POST', '/api/essay/transcribe', {
    body: { images: [imageUrl], subject: 'chinese' },
    token,
  });
  const data = assertEnvelope(r, 'transcribe');

  // 校验 1: paragraphs 存在
  if (!data.transcript || !Array.isArray(data.transcript.paragraphs)) {
    throw new Error('transcript.paragraphs 不是数组');
  }
  if (data.transcript.paragraphs.length === 0) {
    throw new Error('paragraphs 为空');
  }
  // 校验 2: paragraph_index 从 0 连续
  data.transcript.paragraphs.forEach((p, i) => {
    if (p.paragraph_index !== i) {
      throw new Error(`paragraph_index 不连续: 期望 ${i}, 实际 ${p.paragraph_index}`);
    }
    if (!Array.isArray(p.lines) || p.lines.length === 0) {
      throw new Error(`段 ${i} 缺 lines`);
    }
  });
  // 校验 3: request_token 存在
  if (!data.request_token || !data.request_token.startsWith('tx_')) {
    throw new Error(`invalid request_token: ${data.request_token}`);
  }
  // 校验 4: raw_metrics 存在
  if (!data.raw_metrics || data.raw_metrics.model !== 'qwen-vl-max') {
    throw new Error(`raw_metrics.model 应为 qwen-vl-max, 实际 ${data.raw_metrics?.model}`);
  }

  const lineCount = data.transcript.paragraphs.reduce((s, p) => s + p.lines.length, 0);
  ok(`paragraphs=${data.transcript.paragraphs.length}, lines=${lineCount}, ` +
     `uncertain=${data.transcript.uncertain_total}, request_token=${data.request_token.slice(0, 20)}...`);
  return data;
}

// ────────────────────────────────────────────────────────────────────────────
// 步骤 4: 文本批改
// ────────────────────────────────────────────────────────────────────────────

async function step4_grade(token, transcribeData) {
  log('✍️', PHASE.grade);
  const r = await call('POST', '/api/essay/grade', {
    body: {
      transcript: transcribeData.transcript,
      essay_title: 'BCT 集成测试作文',
      exam_level: 'gaokao',
      grade: '高三',
      subject: 'chinese',
      request_token: transcribeData.request_token,
    },
    token,
  });
  const data = assertEnvelope(r, 'grade');

  // 校验 1: report_id 存在
  if (!data.report_id || !data.report_id.startsWith('er_')) {
    throw new Error(`invalid report_id: ${data.report_id}`);
  }
  // 校验 2: annotations 至少 1 条 (V1.0 不允许空报告)
  if (!Array.isArray(data.annotations) || data.annotations.length < 1) {
    throw new Error(`annotations 数量 < 1: ${data.annotations?.length}`);
  }
  // 校验 3: scores.total === 4 维之和
  const s = data.scores;
  if (!s || typeof s.total !== 'number') throw new Error('missing scores.total');
  const sum = s.content + s.language + s.structure + s.development;
  if (sum !== s.total) {
    throw new Error(`scores.total(${s.total}) !== 4 维之和(${sum})`);
  }
  // 校验 4: anchor_metrics.anchor_rate 为 0-1 数字
  const am = data.meta?.anchor_metrics;
  if (!am || typeof am.anchor_rate !== 'number' || am.anchor_rate < 0 || am.anchor_rate > 1) {
    throw new Error(`invalid anchor_metrics.anchor_rate: ${JSON.stringify(am)}`);
  }
  // 校验 5: 锚定区间不变量 (后端 Patch 4)
  const overlapOK = checkNoOverlap(data.annotations);
  if (!overlapOK.ok) {
    throw new Error(`批注区间重叠: ${JSON.stringify(overlapOK.conflict)}`);
  }
  // 校验 6: 锚定区间切片与原文一致 (不变量 I2)
  const paragraphs = transcribeData.transcript.paragraphs;
  const sliceOK = checkSliceMatch(data.annotations, paragraphs);
  if (!sliceOK.ok) {
    throw new Error(`锚定切片错位: ${sliceOK.error}`);
  }
  // 校验 7: rubric_id 命中
  if (!data.rubric_id || !data.rubric_id.startsWith('chinese_gaokao_v1')) {
    throw new Error(`unexpected rubric_id: ${data.rubric_id}`);
  }
  // 校验 8: server_metrics 覆盖了 LLM 自报 (前文审计决策)
  if (data.meta?.server_metrics?.model !== 'qwen-plus') {
    throw new Error(`server_metrics.model 应为 qwen-plus`);
  }

  ok(`report_id=${data.report_id}, annotations=${data.annotations.length}, ` +
     `total=${s.total}, anchor_rate=${(am.anchor_rate * 100).toFixed(0)}%`);
  return data;
}

// 不变量 I2 校验: 同段内 [start, end) 不重叠
function checkNoOverlap(annotations) {
  const byPara = new Map();
  for (const a of annotations) {
    if (a.anchor_failed) continue;
    if (!byPara.has(a.paragraph_index)) byPara.set(a.paragraph_index, []);
    byPara.get(a.paragraph_index).push(a);
  }
  for (const [p, arr] of byPara) {
    arr.sort((a, b) => a.start - b.start);
    for (let i = 1; i < arr.length; i++) {
      if (arr[i].start < arr[i - 1].end) {
        return { ok: false, conflict: { p, i, a: arr[i - 1], b: arr[i] } };
      }
    }
  }
  return { ok: true };
}

// 不变量 I2 严格校验: text.slice(start, end) === annotation.original
function checkSliceMatch(annotations, paragraphs) {
  for (const a of annotations) {
    if (a.anchor_failed) continue;
    const para = paragraphs[a.paragraph_index];
    if (!para) return { ok: false, error: `段 ${a.paragraph_index} 不存在` };
    const fullText = para.lines.map(l => l.text || '').join('');
    const slice = fullText.slice(a.start, a.end);
    if (slice !== a.original) {
      return {
        ok: false,
        error: `段 ${a.paragraph_index} [${a.start},${a.end}): ` +
               `slice="${slice}" !== original="${a.original}"`
      };
    }
  }
  return { ok: true };
}

// ────────────────────────────────────────────────────────────────────────────
// 步骤 5: 历史列表
// ────────────────────────────────────────────────────────────────────────────

async function step5_list(token, reportId) {
  log('📋', PHASE.list);
  const r = await call('GET', '/api/essay?limit=5', { token });
  const data = assertEnvelope(r, 'list');
  if (!Array.isArray(data.reports)) throw new Error('missing reports[]');
  const found = data.reports.find(x => x.report_id === reportId);
  if (!found) {
    throw new Error(`列表中未找到 report_id=${reportId}, 列表有 ${data.reports.length} 条`);
  }
  // 验证字段完整性
  for (const field of ['report_id', 'essay_title', 'exam_level', 'grade', 'status', 'created_at']) {
    if (found[field] === undefined) throw new Error(`报告缺字段: ${field}`);
  }
  if (found.status !== 'completed' && found.status !== 'failed') {
    throw new Error(`unexpected status: ${found.status}`);
  }
  ok(`list size=${data.reports.length}, found report_id=${reportId} status=${found.status}`);
  return data;
}

// ────────────────────────────────────────────────────────────────────────────
// 步骤 6: 报告详情
// ────────────────────────────────────────────────────────────────────────────

async function step6_detail(token, reportId, gradeData) {
  log('🔍', PHASE.detail);
  const r = await call('GET', `/api/essay/${encodeURIComponent(reportId)}`, { token });
  const data = assertEnvelope(r, 'detail');

  // 验证详情与第 4 步返回一致
  if (data.report_id !== gradeData.report_id) {
    throw new Error(`report_id 不一致: ${data.report_id} !== ${gradeData.report_id}`);
  }
  if (data.scores.total !== gradeData.scores.total) {
    throw new Error(`scores.total 不一致: ${data.scores.total} !== ${gradeData.scores.total}`);
  }
  if (data.essay_title !== gradeData.essay_title) {
    throw new Error(`essay_title 不一致: ${data.essay_title} !== ${gradeData.essay_title}`);
  }
  ok(`detail OK, report_id=${data.report_id}, status=${data.status || 'n/a'}`);
  return data;
}

// ────────────────────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────────────────────

async function main() {
  log('🚀', `Essay V1.0 BCT — ${BASE}`);
  log('⏰', `started at ${new Date().toISOString()}`);

  // 前置: 服务可用性
  try {
    const health = await call('GET', '/api/health');
    if (!health.ok) {
      log('⚠️', `/api/health 返回 ${health.status}, 继续 (可能无 /api/health)`);
    }
  } catch (_) {
    log('⚠️', `无法连接 ${BASE}, 确认 server.js 已启动`);
  }

  let token, imageUrl, transcribeData, gradeData;
  try {
    token = await step1_auth();
    imageUrl = await step2_upload(token);
    transcribeData = await step3_transcribe(token, imageUrl);
    gradeData = await step4_grade(token, transcribeData);
    await step5_list(token, gradeData.report_id);
    await step6_detail(token, gradeData.report_id, gradeData);
  } catch (e) {
    bad(`❌ 链路中断: ${e.message}`);
  }

  // 汇总
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  BCT 总结: ${pass} ✅ / ${fail} ❌ (total ${pass + fail})`);
  console.log('═══════════════════════════════════════════════════════════');

  if (fail > 0) {
    console.error('\n❌ BCT 失败, 请检查后端日志');
    process.exit(1);
  } else {
    console.log('\n🎉 6 步全链路通过, 契约 100% 一致');
    process.exit(0);
  }
}

main();
