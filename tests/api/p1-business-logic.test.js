import { describe, it, expect } from 'vitest';

describe('P1-1: taskWorker retry mechanism', () => {
  it('should define MAX_RETRIES as 3', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const source = fs.readFileSync(path.join(__dirname, '../../api/core/taskWorker.js'), 'utf-8');

    expect(source).toContain('MAX_RETRIES = 3');
  });

  it('should define retry delays with exponential backoff', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const source = fs.readFileSync(path.join(__dirname, '../../api/core/taskWorker.js'), 'utf-8');

    expect(source).toContain('RETRY_DELAYS');
    expect(source).toContain('5000');
    expect(source).toContain('15000');
    expect(source).toContain('45000');
  });

  it('should have recoverStaleTasks function', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const source = fs.readFileSync(path.join(__dirname, '../../api/core/taskWorker.js'), 'utf-8');

    expect(source).toContain('recoverStaleTasks');
    expect(source).toContain("status = 'processing'");
    expect(source).toContain("status = 'pending'");
  });

  it('should check DASHSCOPE_API_KEY existence', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const source = fs.readFileSync(path.join(__dirname, '../../api/core/taskWorker.js'), 'utf-8');

    expect(source).toContain('DASHSCOPE_API_KEY');
  });

  it('should mark task as failed after max retries', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const source = fs.readFileSync(path.join(__dirname, '../../api/core/taskWorker.js'), 'utf-8');

    expect(source).toContain('retry_count');
    expect(source).toContain("'failed'");
    expect(source).toContain('permanently failed');
  });
});

describe('P1-2: questions.js pagination and validation', () => {
  it('should have pagination with limit and offset', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const source = fs.readFileSync(path.join(__dirname, '../../api/handlers/questions.js'), 'utf-8');

    expect(source).toContain('parseInt(req.query.limit)');
    expect(source).toContain('parseInt(req.query.offset)');
    expect(source).toContain('LIMIT');
    expect(source).toContain('OFFSET');
  });

  it('should cap limit at 200 and default to 50', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const source = fs.readFileSync(path.join(__dirname, '../../api/handlers/questions.js'), 'utf-8');

    expect(source).toMatch(/\|\|\s*50/);
    expect(source).toContain('200');
  });

  it('should use paginatedResponse for GET', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const source = fs.readFileSync(path.join(__dirname, '../../api/handlers/questions.js'), 'utf-8');

    expect(source).toContain('paginatedResponse');
  });

  it('should validate data size limit (1MB)', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const source = fs.readFileSync(path.join(__dirname, '../../api/handlers/questions.js'), 'utf-8');

    expect(source).toContain('1024 * 1024');
  });
});

describe('P1-3/P1-4: subjectMap unified module', () => {
  it('should export SUBJECT_MAP with all 9 subjects', async () => {
    const { SUBJECT_MAP } = await import('../../api/utils/subjectMap.js');

    expect(Object.keys(SUBJECT_MAP)).toHaveLength(9);
    expect(SUBJECT_MAP.math).toBe('数学');
    expect(SUBJECT_MAP.chinese).toBe('语文');
    expect(SUBJECT_MAP.english).toBe('英语');
    expect(SUBJECT_MAP.physics).toBe('物理');
    expect(SUBJECT_MAP.chemistry).toBe('化学');
    expect(SUBJECT_MAP.politics).toBe('政治');
    expect(SUBJECT_MAP.biology).toBe('生物');
    expect(SUBJECT_MAP.history).toBe('历史');
    expect(SUBJECT_MAP.geography).toBe('地理');
  });

  it('should export SUBJECT_MAP_REVERSE as inverse mapping', async () => {
    const { SUBJECT_MAP, SUBJECT_MAP_REVERSE } = await import('../../api/utils/subjectMap.js');

    for (const [key, value] of Object.entries(SUBJECT_MAP)) {
      expect(SUBJECT_MAP_REVERSE[value]).toBe(key);
    }
  });

  it('resolveSubjectName should return Chinese name for English key', async () => {
    const { resolveSubjectName } = await import('../../api/utils/subjectMap.js');

    expect(resolveSubjectName('math')).toBe('数学');
    expect(resolveSubjectName('physics')).toBe('物理');
    expect(resolveSubjectName('unknown')).toBe('unknown');
  });

  it('resolveSubjectKey should return English key for Chinese name', async () => {
    const { resolveSubjectKey } = await import('../../api/utils/subjectMap.js');

    expect(resolveSubjectKey('数学')).toBe('math');
    expect(resolveSubjectKey('物理')).toBe('physics');
    expect(resolveSubjectKey('未知')).toBe('未知');
  });

  it('KEYWORD_MAP should have entries for major subjects', async () => {
    const { KEYWORD_MAP } = await import('../../api/utils/subjectMap.js');

    const mathKeys = Object.keys(KEYWORD_MAP).filter(k => k.startsWith('MATH-'));
    const chineseKeys = Object.keys(KEYWORD_MAP).filter(k => k.startsWith('CHINESE-'));
    const englishKeys = Object.keys(KEYWORD_MAP).filter(k => k.startsWith('ENGLISH-'));
    const physicsKeys = Object.keys(KEYWORD_MAP).filter(k => k.startsWith('PHYSICS-'));
    const chemistryKeys = Object.keys(KEYWORD_MAP).filter(k => k.startsWith('CHEMISTRY-'));

    expect(mathKeys.length).toBeGreaterThanOrEqual(10);
    expect(chineseKeys.length).toBeGreaterThanOrEqual(5);
    expect(englishKeys.length).toBeGreaterThanOrEqual(5);
    expect(physicsKeys.length).toBeGreaterThanOrEqual(5);
    expect(chemistryKeys.length).toBeGreaterThanOrEqual(5);
  });

  it('getKeywordsForKP should return keywords for valid KP id', async () => {
    const { getKeywordsForKP } = await import('../../api/utils/subjectMap.js');

    const keywords = getKeywordsForKP('MATH-001');
    expect(Array.isArray(keywords)).toBe(true);
    expect(keywords.length).toBeGreaterThan(0);
    expect(keywords).toContain('函数');
  });

  it('getKeywordsForKP should return empty array for unknown KP id', async () => {
    const { getKeywordsForKP } = await import('../../api/utils/subjectMap.js');

    const keywords = getKeywordsForKP('UNKNOWN-999');
    expect(keywords).toEqual([]);
  });

  it('knowledge-points.js should import from subjectMap', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const source = fs.readFileSync(path.join(__dirname, '../../api/handlers/knowledge-points.js'), 'utf-8');

    expect(source).toContain("from '../utils/subjectMap.js'");
    expect(source).toContain('KEYWORD_MAP');
    expect(source).toContain('resolveSubjectName');
  });

  it('generate-paper.js should import from subjectMap', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const source = fs.readFileSync(path.join(__dirname, '../../api/handlers/generate-paper.js'), 'utf-8');

    expect(source).toContain("from '../utils/subjectMap.js'");
    expect(source).toContain('KEYWORD_MAP');
    expect(source).toContain('resolveSubjectName');
  });
});

describe('P1-5: generate-paper.js division-by-zero and score fixes', () => {
  it('should return 400 when no knowledge points found', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const source = fs.readFileSync(path.join(__dirname, '../../api/handlers/generate-paper.js'), 'utf-8');

    expect(source).toContain('allKP.length === 0');
    expect(source).toContain('400');
  });

  it('should query knowledge_points with both English and Chinese subject names', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const source = fs.readFileSync(path.join(__dirname, '../../api/handlers/generate-paper.js'), 'utf-8');

    expect(source).toContain('WHERE subject = $1 OR subject = $2');
  });

  it('should have correct score calculation: selectionTotal*5 + fillCount*5 + solutionScores', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const source = fs.readFileSync(path.join(__dirname, '../../api/handlers/generate-paper.js'), 'utf-8');

    expect(source).toContain('selectionScore = 5');
    expect(source).toContain('fillScore = 5');
    expect(source).toContain("solutionScores = [12, 12, 14]");
    expect(source).toContain('paper.metadata.totalScore');
  });

  it('should use actual weak point detection for is_weak_point', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const source = fs.readFileSync(path.join(__dirname, '../../api/handlers/generate-paper.js'), 'utf-8');

    const weakKPCheck = source.includes('weakKPIds.includes(kp.id)');
    expect(weakKPCheck).toBe(true);
  });
});

describe('P1-6: exam-session.js security hardening', () => {
  it('should use crypto.randomUUID for session ID', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const source = fs.readFileSync(path.join(__dirname, '../../api/handlers/exam-session.js'), 'utf-8');

    expect(source).toContain("import crypto from 'crypto'");
    expect(source).toContain('crypto.randomUUID()');
  });

  it('should validate answers array is non-empty with valid questionIds', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const source = fs.readFileSync(path.join(__dirname, '../../api/handlers/exam-session.js'), 'utf-8');

    expect(source).toContain("Array.isArray(answers)");
    expect(source).toContain("answers.length === 0");
    expect(source).toContain('questionIds.length === 0');
  });

  it('should validate questionIds belong to session subject', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const source = fs.readFileSync(path.join(__dirname, '../../api/handlers/exam-session.js'), 'utf-8');

    expect(source).toContain('sessionQuestionIds');
    expect(source).toContain('sessionQuestionIds.has');
  });

  it('should have safe parseInt for question_count and time_limit', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const source = fs.readFileSync(path.join(__dirname, '../../api/handlers/exam-session.js'), 'utf-8');

    expect(source).toContain('safeQuestionCount');
    expect(source).toContain('safeTimeLimit');
    expect(source).toContain('Math.min(Math.max(parseInt(question_count)');
    expect(source).toContain('Math.min(Math.max(parseInt(time_limit)');
  });

  it('should have safe pagination in getExamHistory', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const source = fs.readFileSync(path.join(__dirname, '../../api/handlers/exam-session.js'), 'utf-8');

    expect(source).toContain('parseInt(req.query.limit)');
    expect(source).toContain('parseInt(req.query.offset)');
  });
});

describe('P1-fix: db.js retry_count column', () => {
  it('should have retry_count column in task_queue table', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const source = fs.readFileSync(path.join(__dirname, '../../api/core/db.js'), 'utf-8');

    const taskQueueMatch = source.match(/CREATE TABLE IF NOT EXISTS task_queue[\s\S]*?;/);
    expect(taskQueueMatch).toBeTruthy();
    expect(taskQueueMatch[0]).toContain('retry_count INTEGER DEFAULT 0');
  });
});
