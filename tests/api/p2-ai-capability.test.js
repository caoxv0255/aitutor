import { describe, it, expect } from 'vitest';
import {
  parseImageRecognitionResponse,
  parseExplainResponse,
  assessImageResultQuality,
  assessExplainResultQuality,
  createTaskMetrics
} from '../../api/utils/llmParser.js';
import { PROMPTS, PROMPT_VERSION } from '../../api/utils/prompts.js';
import { matchWeakPoint, findWeakKPIds, KEYWORD_MAP } from '../../api/utils/subjectMap.js';

describe('P2-1: Vision model accuracy monitoring', () => {
  it('should have task_metrics table in db.js', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const source = fs.readFileSync(path.join(__dirname, '../../api/core/db.js'), 'utf-8');

    expect(source).toContain('task_metrics');
    expect(source).toContain('quality_score');
    expect(source).toContain('processing_time_ms');
    expect(source).toContain('token_prompt');
    expect(source).toContain('token_completion');
    expect(source).toContain('token_total');
    expect(source).toContain('prompt_version');
    expect(source).toContain('is_fallback');
  });

  it('should have getTaskStats export in taskWorker', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const source = fs.readFileSync(path.join(__dirname, '../../api/core/taskWorker.js'), 'utf-8');

    expect(source).toContain('export function getTaskStats');
    expect(source).toContain('taskStats');
    expect(source).toContain('quality');
    expect(source).toContain('isFallback');
  });

  it('should record metrics with token usage in taskWorker', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const source = fs.readFileSync(path.join(__dirname, '../../api/core/taskWorker.js'), 'utf-8');

    expect(source).toContain('recordMetrics');
    expect(source).toContain('tokenUsage');
    expect(source).toContain('prompt_tokens');
    expect(source).toContain('completion_tokens');
    expect(source).toContain('total_tokens');
  });

  it('should log quality warnings for low quality results', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const source = fs.readFileSync(path.join(__dirname, '../../api/core/taskWorker.js'), 'utf-8');

    expect(source).toContain('lowQuality');
    expect(source).toContain('quality < 30');
    expect(source).toContain('logTaskMetrics');
  });

  it('createTaskMetrics should build correct metrics object', () => {
    const metrics = createTaskMetrics(42, 1000, 2500, 'qwen3-vl-plus', { prompt: 100, completion: 200, total: 300 }, 80, false);

    expect(metrics.task_id).toBe(42);
    expect(metrics.processing_time_ms).toBe(1500);
    expect(metrics.model).toBe('qwen3-vl-plus');
    expect(metrics.prompt_version).toBe('2.0.0');
    expect(metrics.quality_score).toBe(80);
    expect(metrics.is_fallback).toBe(false);
    expect(metrics.token_usage.total).toBe(300);
  });
});

describe('P2-2: Prompt version management', () => {
  it('should export PROMPT_VERSION', () => {
    expect(PROMPT_VERSION).toBe('2.0.0');
  });

  it('should export PROMPTS with IMAGE_RECOGNITION and QUESTION_EXPLAIN', () => {
    expect(PROMPTS.IMAGE_RECOGNITION).toBeDefined();
    expect(PROMPTS.QUESTION_EXPLAIN).toBeDefined();
    expect(PROMPTS.IMAGE_RECOGNITION.version).toBe('2.0.0');
    expect(PROMPTS.QUESTION_EXPLAIN.version).toBe('2.0.0');
  });

  it('should have model config in each prompt', () => {
    expect(PROMPTS.IMAGE_RECOGNITION.model).toBe('qwen3-vl-plus');
    expect(PROMPTS.IMAGE_RECOGNITION.temperature).toBe(0.7);
    expect(PROMPTS.IMAGE_RECOGNITION.maxTokens).toBe(2000);
    expect(PROMPTS.QUESTION_EXPLAIN.model).toBe('qwen-plus');
    expect(PROMPTS.QUESTION_EXPLAIN.maxTokens).toBe(3000);
  });

  it('IMAGE_RECOGNITION.build should return essay prompt for 作文', () => {
    const prompt = PROMPTS.IMAGE_RECOGNITION.build('作文', '高三');
    expect(prompt).toContain('语文特级教师');
    expect(prompt).toContain('高三');
    expect(prompt).toContain('clue');
    expect(prompt).toContain('solution');
    expect(prompt).toContain('analysis');
  });

  it('IMAGE_RECOGNITION.build should return subject prompt for other subjects', () => {
    const prompt = PROMPTS.IMAGE_RECOGNITION.build('数学', '高二');
    expect(prompt).toContain('数学导师');
    expect(prompt).toContain('高二');
    expect(prompt).toContain('启发式教学');
  });

  it('QUESTION_EXPLAIN.build should return explain prompt', () => {
    const prompt = PROMPTS.QUESTION_EXPLAIN.build('数学', '求函数f(x)=x²的导数', '导数');
    expect(prompt).toContain('数学');
    expect(prompt).toContain('求函数f(x)=x²的导数');
    expect(prompt).toContain('导数');
    expect(prompt).toContain('explanation');
  });

  it('taskWorker should import from prompts.js', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const source = fs.readFileSync(path.join(__dirname, '../../api/core/taskWorker.js'), 'utf-8');

    expect(source).toContain("from '../utils/prompts.js'");
    expect(source).toContain('PROMPTS.IMAGE_RECOGNITION');
    expect(source).toContain('PROMPT_VERSION');
  });

  it('explain-question.js should import from prompts.js', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const source = fs.readFileSync(path.join(__dirname, '../../api/handlers/explain-question.js'), 'utf-8');

    expect(source).toContain("from '../utils/prompts.js'");
    expect(source).toContain('PROMPTS.QUESTION_EXPLAIN');
  });
});

describe('P2-3: LLM response parser enhancement', () => {
  it('should strip think tags from qwen3 responses', () => {
    const content = '<think\n这是思维过程\n</think\n{"clue":"提示","solution":"解答","analysis":"分析"}';
    const result = parseImageRecognitionResponse(content);
    expect(result.parsed.clue).toBe('提示');
    expect(result.isFallback).toBe(false);
  });

  it('should parse standard JSON response', () => {
    const content = '{"clue":"思考方向","solution":"解题步骤","analysis":"知识点分析","metadata":{"difficulty":3,"frequency":"中","keywords":["函数"]}}';
    const result = parseImageRecognitionResponse(content);
    expect(result.parsed.clue).toBe('思考方向');
    expect(result.parsed.metadata.keywords).toContain('函数');
    expect(result.isFallback).toBe(false);
    expect(result.quality).toBeGreaterThan(0);
  });

  it('should parse JSON wrapped in code blocks', () => {
    const content = '```json\n{"clue":"提示","solution":"解答","analysis":"分析"}\n```';
    const result = parseImageRecognitionResponse(content);
    expect(result.parsed.clue).toBe('提示');
    expect(result.isFallback).toBe(false);
  });

  it('should return fallback for unparseable content', () => {
    const content = 'This is not JSON at all, just plain text.';
    const result = parseImageRecognitionResponse(content);
    expect(result.isFallback).toBe(true);
    expect(result.quality).toBe(0);
    expect(result.parsed.clue).toBeDefined();
  });

  it('should handle JSON with trailing text after closing brace', () => {
    const content = '{"clue":"提示","solution":"解答","analysis":"分析"}这是一些额外文本';
    const result = parseImageRecognitionResponse(content);
    expect(result.parsed.clue).toBe('提示');
    expect(result.isFallback).toBe(false);
  });

  it('should fix trailing commas in JSON', () => {
    const content = '{"clue":"提示","solution":"解答","analysis":"分析","metadata":{"difficulty":3,}}';
    const result = parseImageRecognitionResponse(content);
    expect(result.parsed.clue).toBe('提示');
    expect(result.isFallback).toBe(false);
  });

  it('should unescape \\n in string fields', () => {
    const content = '{"clue":"提示","solution":"步骤1\\n\\n步骤2","analysis":"分析"}';
    const result = parseImageRecognitionResponse(content);
    expect(result.parsed.solution).toContain('\n');
  });

  it('parseExplainResponse should parse explanation JSON', () => {
    const content = '{"explanation":"详细讲解步骤1\\n\\n步骤2","keyPoints":["关键点1"],"variantProblems":[],"similarProblems":[]}';
    const result = parseExplainResponse(content);
    expect(result.parsed.explanation).toContain('步骤1');
    expect(result.parsed.keyPoints).toHaveLength(1);
    expect(result.isFallback).toBe(false);
  });

  it('parseExplainResponse should return fallback for unparseable content', () => {
    const content = 'plain text without JSON';
    const result = parseExplainResponse(content);
    expect(result.isFallback).toBe(true);
    expect(result.parsed.explanation).toBeDefined();
  });

  it('assessImageResultQuality should score complete results highly', () => {
    const result = {
      clue: '这是一个很好的思考提示，引导学生分析问题',
      solution: '解题步骤1：首先分析条件\n\n解题步骤2：然后推导结论',
      analysis: '本题考查函数单调性，常见错因是忽略定义域',
      metadata: { difficulty: 4, frequency: '高', keywords: ['函数', '单调性'] }
    };
    const quality = assessImageResultQuality(result);
    expect(quality).toBeGreaterThanOrEqual(70);
  });

  it('assessImageResultQuality should score trivial results poorly', () => {
    const result = {
      clue: '请仔细观察题目条件',
      solution: '解析失败',
      analysis: '分析解题思路'
    };
    const quality = assessImageResultQuality(result);
    expect(quality).toBeLessThan(50);
  });

  it('assessExplainResultQuality should reward step markers', () => {
    const withSteps = { explanation: '步骤1：分析\n步骤2：求解', keyPoints: ['k1'], variantProblems: [], similarProblems: [] };
    const withoutSteps = { explanation: '分析求解', keyPoints: ['k1'], variantProblems: [], similarProblems: [] };
    expect(assessExplainResultQuality(withSteps)).toBeGreaterThan(assessExplainResultQuality(withoutSteps));
  });

  it('llmParser.js should be imported by taskWorker', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const source = fs.readFileSync(path.join(__dirname, '../../api/core/taskWorker.js'), 'utf-8');

    expect(source).toContain("from '../utils/llmParser.js'");
    expect(source).toContain('parseImageRecognitionResponse');
    expect(source).toContain('createTaskMetrics');
    expect(source).toContain('logTaskMetrics');
  });

  it('llmParser.js should be imported by explain-question.js', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const source = fs.readFileSync(path.join(__dirname, '../../api/handlers/explain-question.js'), 'utf-8');

    expect(source).toContain("from '../utils/llmParser.js'");
    expect(source).toContain('parseExplainResponse');
  });
});

describe('P2-4: GraphRAG subject index scripts', () => {
  it('should have split_by_subject.py script', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const scriptPath = path.join(__dirname, '../../scripts/split_by_subject.py');
    const exists = fs.existsSync(scriptPath);
    expect(exists).toBe(true);

    const source = fs.readFileSync(scriptPath, 'utf-8');
    expect(source).toContain('SUBJECTS');
    expect(source).toContain('math');
    expect(source).toContain('physics');
    expect(source).toContain('chemistry');
  });

  it('should have build_subject_indexes.py script', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const scriptPath = path.join(__dirname, '../../scripts/build_subject_indexes.py');
    const exists = fs.existsSync(scriptPath);
    expect(exists).toBe(true);

    const source = fs.readFileSync(scriptPath, 'utf-8');
    expect(source).toContain('build_index');
    expect(source).toContain('SUBJECTS');
  });

  it('should have gaokao_all index with settings.yaml', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const settingsPath = path.join(__dirname, '../../graphrag_workspace/indexes/gaokao_all/settings.yaml');
    const exists = fs.existsSync(settingsPath);
    expect(exists).toBe(true);

    const content = fs.readFileSync(settingsPath, 'utf-8');
    expect(content).toContain('graphrag');
    expect(content).toContain('embedding');
  });
});

describe('P2-5: Weak point algorithm upgrade', () => {
  it('matchWeakPoint should return matched=true for matching content', () => {
    const questionData = {
      analysis: '本题考查导数和函数单调性',
      solution: '步骤1：求导 f\'(x) = 3x² - 3',
      subject: '数学'
    };
    const result = matchWeakPoint(questionData, 'MATH-001');
    expect(result.matched).toBe(true);
    expect(result.score).toBeGreaterThan(0);
    expect(result.matchedKeywords.length).toBeGreaterThan(0);
  });

  it('matchWeakPoint should return matched=false for non-matching content', () => {
    const questionData = {
      analysis: '本题考查光合作用',
      subject: '生物'
    };
    const result = matchWeakPoint(questionData, 'MATH-001');
    expect(result.matched).toBe(false);
    expect(result.score).toBe(0);
  });

  it('matchWeakPoint should give higher score to core keywords', () => {
    const coreData = { analysis: '导数单调性极值', subject: '数学' };
    const nonCoreData = { analysis: '切线斜率零点', subject: '数学' };
    const coreResult = matchWeakPoint(coreData, 'MATH-001');
    const nonCoreResult = matchWeakPoint(nonCoreData, 'MATH-001');
    expect(coreResult.score).toBeGreaterThan(nonCoreResult.score);
  });

  it('matchWeakPoint should search priority fields', () => {
    const dataWithAnalysis = { analysis: '导数单调性' };
    const dataWithSolution = { solution: '导数单调性' };
    const dataWithClue = { clue: '导数单调性' };
    expect(matchWeakPoint(dataWithAnalysis, 'MATH-001').matched).toBe(true);
    expect(matchWeakPoint(dataWithSolution, 'MATH-001').matched).toBe(true);
    expect(matchWeakPoint(dataWithClue, 'MATH-001').matched).toBe(true);
  });

  it('matchWeakPoint should handle string input', () => {
    const result = matchWeakPoint('这道题考查导数和函数单调性', 'MATH-001');
    expect(result.matched).toBe(true);
  });

  it('matchWeakPoint should handle metadata.keywords', () => {
    const data = { metadata: { keywords: ['导数', '函数'] } };
    const result = matchWeakPoint(data, 'MATH-001');
    expect(result.matched).toBe(true);
  });

  it('matchWeakPoint should return confidence between 0 and 1', () => {
    const data = { analysis: '导数单调性极值切线零点' };
    const result = matchWeakPoint(data, 'MATH-001');
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it('findWeakKPIds should sort by weaknessIndex descending', () => {
    const wrongQuestions = [
      { data: JSON.stringify({ analysis: '导数单调性极值', subject: '数学' }) },
      { data: JSON.stringify({ analysis: '椭圆双曲线抛物线', subject: '数学' }) }
    ];
    const allKP = [
      { id: 'MATH-001', name: '函数与导数', difficulty: 4, frequency: '高' },
      { id: 'MATH-002', name: '解析几何', difficulty: 5, frequency: '高' }
    ];
    const results = findWeakKPIds(wrongQuestions, allKP);
    expect(results.length).toBeGreaterThan(0);
    if (results.length > 1) {
      expect(results[0].weaknessIndex).toBeGreaterThanOrEqual(results[1].weaknessIndex);
    }
  });

  it('findWeakKPIds should include matchedKeywords', () => {
    const wrongQuestions = [
      { data: JSON.stringify({ analysis: '导数单调性', subject: '数学' }) }
    ];
    const allKP = [
      { id: 'MATH-001', name: '函数与导数', difficulty: 4, frequency: '高' }
    ];
    const results = findWeakKPIds(wrongQuestions, allKP);
    expect(results.length).toBe(1);
    expect(results[0].matchedKeywords.length).toBeGreaterThan(0);
  });

  it('knowledge-points.js should import matchWeakPoint and findWeakKPIds', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const source = fs.readFileSync(path.join(__dirname, '../../api/handlers/knowledge-points.js'), 'utf-8');

    expect(source).toContain('matchWeakPoint');
    expect(source).toContain('findWeakKPIds');
  });

  it('generate-paper.js should import matchWeakPoint', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const source = fs.readFileSync(path.join(__dirname, '../../api/handlers/generate-paper.js'), 'utf-8');

    expect(source).toContain('matchWeakPoint');
  });
});
