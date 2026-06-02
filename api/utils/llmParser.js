const REQUIRED_FIELDS_IMAGE = ['clue', 'solution', 'analysis'];
const REQUIRED_FIELDS_EXPLAIN = ['explanation'];

function stripThinkTags(content) {
  return content.replace(/<think[\s\S]*?<\/think>/g, '').trim();
}

function stripCodeBlocks(content) {
  return content.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
}

function extractBalancedBracket(text, open, close, startPos) {
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = startPos; i < text.length; i++) {
    const ch = text[i];
    if (esc) { esc = false; continue; }
    if (ch === '\\' && inStr) { esc = true; continue; }
    if (ch === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function tryParseJSON(jsonStr) {
  try {
    return JSON.parse(jsonStr);
  } catch (_) {}

  try {
    const fixed = jsonStr
      .replace(/,\s*([}\]])/g, '$1')
      .replace(/'/g, '"');
    return JSON.parse(fixed);
  } catch (_) {}

  try {
    const fixed = jsonStr
      .replace(/,\s*([}\]])/g, '$1')
      .replace(/'/g, '"')
      .replace(/\\(?!"|\\|\/|b|f|n|r|t|u)/g, '\\\\');
    return JSON.parse(fixed);
  } catch (_) {}

  return null;
}

function unescapeFields(obj, fields) {
  fields.forEach(field => {
    if (obj[field] && typeof obj[field] === 'string') {
      obj[field] = obj[field]
        .replace(/\\n/g, '\n')
        .replace(/\\\\/g, '\\')
        .replace(/\\"/g, '"');
    }
  });
}

function extractJSON(content) {
  const firstBrace = content.indexOf('{');
  if (firstBrace === -1) return null;

  const endIdx = extractBalancedBracket(content, '{', '}', firstBrace);
  if (endIdx !== -1) {
    const rawJson = content.slice(firstBrace, endIdx + 1);
    const parsed = tryParseJSON(rawJson);
    if (parsed) return parsed;
  }

  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    const parsed = tryParseJSON(jsonMatch[0]);
    if (parsed) return parsed;
  }

  return null;
}

export function parseImageRecognitionResponse(content) {
  const cleaned = stripCodeBlocks(stripThinkTags(content));
  const parsed = extractJSON(cleaned);

  if (parsed) {
    unescapeFields(parsed, ['clue', 'solution', 'analysis']);
    return {
      parsed,
      isFallback: false,
      quality: assessImageResultQuality(parsed)
    };
  }

  return {
    parsed: {
      clue: '请仔细观察题目条件',
      solution: cleaned || '解析失败',
      analysis: '请根据解答过程总结知识点',
      metadata: { difficulty: 3, frequency: '中', keywords: [] }
    },
    isFallback: true,
    quality: 0
  };
}

export function parseExplainResponse(content) {
  const cleaned = stripCodeBlocks(stripThinkTags(content));
  const parsed = extractJSON(cleaned);

  if (parsed) {
    unescapeFields(parsed, ['explanation']);
    return {
      parsed,
      isFallback: false,
      quality: assessExplainResultQuality(parsed)
    };
  }

  return {
    parsed: {
      explanation: cleaned || '解析失败',
      keyPoints: [],
      variantProblems: [],
      similarProblems: []
    },
    isFallback: true,
    quality: 0
  };
}

export function assessImageResultQuality(result) {
  let score = 0;
  const maxScore = 100;

  for (const field of REQUIRED_FIELDS_IMAGE) {
    if (result[field] && typeof result[field] === 'string') {
      const len = result[field].length;
      if (len > 10) score += 20;
      else if (len > 0) score += 10;
    }
  }

  if (result.metadata) {
    score += 10;
    if (Array.isArray(result.metadata.keywords) && result.metadata.keywords.length > 0) {
      score += 10;
    }
    if (result.metadata.difficulty && result.metadata.difficulty >= 1 && result.metadata.difficulty <= 5) {
      score += 10;
    }
  }

  const isTrivial = REQUIRED_FIELDS_IMAGE.some(f => {
    const val = result[f];
    return !val || val.length < 5 || val === '请仔细观察题目条件' || val === '思考题目的关键信息';
  });
  if (!isTrivial) score += 20;

  return Math.min(score, maxScore);
}

export function assessExplainResultQuality(result) {
  let score = 0;
  const maxScore = 100;

  if (result.explanation && result.explanation.length > 20) score += 30;
  else if (result.explanation && result.explanation.length > 0) score += 15;

  if (Array.isArray(result.keyPoints) && result.keyPoints.length > 0) score += 20;
  if (Array.isArray(result.variantProblems) && result.variantProblems.length > 0) score += 20;
  if (Array.isArray(result.similarProblems) && result.similarProblems.length > 0) score += 20;

  const hasSteps = result.explanation && /步骤[1-9]/.test(result.explanation);
  if (hasSteps) score += 10;

  return Math.min(score, maxScore);
}

export function createTaskMetrics(taskId, startTime, endTime, model, tokenUsage, quality, isFallback) {
  return {
    task_id: taskId,
    processing_time_ms: endTime - startTime,
    model,
    prompt_version: '2.0.0',
    token_usage: tokenUsage || { prompt: 0, completion: 0, total: 0 },
    quality_score: quality,
    is_fallback: isFallback,
    timestamp: new Date().toISOString()
  };
}

export function logTaskMetrics(metrics) {
  const level = metrics.quality_score < 30 ? 'WARN' : metrics.is_fallback ? 'WARN' : 'INFO';
  const logFn = level === 'WARN' ? console.warn : console.log;

  logFn(`[Worker/Metrics] task=#${metrics.task_id} time=${metrics.processing_time_ms}ms ` +
    `model=${metrics.model} quality=${metrics.quality_score} ` +
    `tokens=${metrics.token_usage.total} fallback=${metrics.is_fallback}`);
}
