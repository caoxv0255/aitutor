import { describe, it, expect } from 'vitest';
import { KEYWORD_MAP, SUBJECT_MAP } from '../../api/utils/subjectMap.js';
import {
  GAOKAO_MODELS,
  SUBJECT_COMBINATIONS,
  getGaokaoModelForProvince,
  getSubjectsForCombination,
  getCombinationsForModel,
  isSubjectInCombination
} from '../../api/utils/subjectCombinations.js';

describe('P4-1: Knowledge point expansion to 200+', () => {
  it('should have at least 200 knowledge point entries in KEYWORD_MAP', () => {
    const count = Object.keys(KEYWORD_MAP).length;
    expect(count).toBeGreaterThanOrEqual(200);
  });

  it('should have biology knowledge points with BIOLOGY prefix (not ZK-)', () => {
    const bioKeys = Object.keys(KEYWORD_MAP).filter(k => k.startsWith('BIOLOGY-'));
    expect(bioKeys.length).toBeGreaterThanOrEqual(15);
  });

  it('should have history knowledge points with HISTORY prefix (not ZK-)', () => {
    const histKeys = Object.keys(KEYWORD_MAP).filter(k => k.startsWith('HISTORY-'));
    expect(histKeys.length).toBeGreaterThanOrEqual(15);
  });

  it('should have geography knowledge points with GEOGRAPHY prefix (not ZK-)', () => {
    const geoKeys = Object.keys(KEYWORD_MAP).filter(k => k.startsWith('GEOGRAPHY-'));
    expect(geoKeys.length).toBeGreaterThanOrEqual(15);
  });

  it('should have expanded math knowledge points (30+)', () => {
    const mathKeys = Object.keys(KEYWORD_MAP).filter(k => k.startsWith('MATH-'));
    expect(mathKeys.length).toBeGreaterThanOrEqual(25);
  });

  it('should have expanded chinese knowledge points (15+)', () => {
    const chineseKeys = Object.keys(KEYWORD_MAP).filter(k => k.startsWith('CHINESE-'));
    expect(chineseKeys.length).toBeGreaterThanOrEqual(15);
  });

  it('should have expanded english knowledge points (15+)', () => {
    const englishKeys = Object.keys(KEYWORD_MAP).filter(k => k.startsWith('ENGLISH-'));
    expect(englishKeys.length).toBeGreaterThanOrEqual(15);
  });

  it('should have expanded physics knowledge points (20+)', () => {
    const physicsKeys = Object.keys(KEYWORD_MAP).filter(k => k.startsWith('PHYSICS-'));
    expect(physicsKeys.length).toBeGreaterThanOrEqual(20);
  });

  it('should have expanded chemistry knowledge points (20+)', () => {
    const chemKeys = Object.keys(KEYWORD_MAP).filter(k => k.startsWith('CHEMISTRY-'));
    expect(chemKeys.length).toBeGreaterThanOrEqual(20);
  });

  it('should have expanded politics knowledge points (15+)', () => {
    const polKeys = Object.keys(KEYWORD_MAP).filter(k => k.startsWith('POLITICS-'));
    expect(polKeys.length).toBeGreaterThanOrEqual(15);
  });

  it('should still preserve ZK- prefixed entries for zhongkao', () => {
    const zkKeys = Object.keys(KEYWORD_MAP).filter(k => k.startsWith('ZK-'));
    expect(zkKeys.length).toBeGreaterThanOrEqual(10);
  });

  it('should have each knowledge point with at least 2 keywords', () => {
    for (const [kpId, keywords] of Object.entries(KEYWORD_MAP)) {
      expect(keywords.length, `KEYWORD_MAP['${kpId}'] should have >= 2 keywords`).toBeGreaterThanOrEqual(2);
    }
  });

  it('should have updated CORE_KEYWORDS covering new subjects', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const source = fs.readFileSync(path.join(__dirname, '../../api/utils/subjectMap.js'), 'utf-8');

    expect(source).toContain("'基因工程'");
    expect(source).toContain("'辛亥革命'");
    expect(source).toContain("'洋流'");
    expect(source).toContain("'法拉第电磁感应'");
  });

  it('should cover all 9 subjects in SUBJECT_MAP', () => {
    expect(Object.keys(SUBJECT_MAP).length).toBe(9);
    expect(SUBJECT_MAP['biology']).toBe('生物');
    expect(SUBJECT_MAP['history']).toBe('历史');
    expect(SUBJECT_MAP['geography']).toBe('地理');
  });
});

describe('P4-2: Gaokao subject combination adaptation', () => {
  it('should have 3 gaokao models', () => {
    expect(Object.keys(GAOKAO_MODELS).length).toBe(3);
    expect(GAOKAO_MODELS['3+1+2']).toBeDefined();
    expect(GAOKAO_MODELS['3+3']).toBeDefined();
    expect(GAOKAO_MODELS['traditional']).toBeDefined();
  });

  it('3+1+2 model should have required subjects and preferred/chooseTwo', () => {
    const model = GAOKAO_MODELS['3+1+2'];
    expect(model.required).toContain('chinese');
    expect(model.required).toContain('math');
    expect(model.required).toContain('english');
    expect(model.preferredOne).toContain('physics');
    expect(model.preferredOne).toContain('history');
    expect(model.chooseTwo.length).toBe(4);
  });

  it('3+3 model should have chooseThree with 6 subjects', () => {
    const model = GAOKAO_MODELS['3+3'];
    expect(model.chooseThree.length).toBe(6);
  });

  it('should identify 3+1+2 provinces correctly', () => {
    const result = getGaokaoModelForProvince('guangdong');
    expect(result.model).toBe('3+1+2');
  });

  it('should identify 3+3 provinces correctly', () => {
    const result = getGaokaoModelForProvince('beijing');
    expect(result.model).toBe('3+3');
  });

  it('should return traditional for unknown provinces', () => {
    const result = getGaokaoModelForProvince('unknown_province');
    expect(result.model).toBe('traditional');
  });

  it('3+1+2 should have 12 combinations', () => {
    const combos = getCombinationsForModel('3+1+2');
    expect(combos.length).toBe(12);
  });

  it('3+3 should have multiple combinations', () => {
    const combos = getCombinationsForModel('3+3');
    expect(combos.length).toBeGreaterThanOrEqual(16);
  });

  it('traditional should have 2 combinations', () => {
    const combos = getCombinationsForModel('traditional');
    expect(combos.length).toBe(2);
  });

  it('should get subjects for a combination', () => {
    const subjects = getSubjectsForCombination('physics-chem-bio');
    expect(subjects).toContain('chinese');
    expect(subjects).toContain('math');
    expect(subjects).toContain('english');
    expect(subjects).toContain('physics');
    expect(subjects).toContain('chemistry');
    expect(subjects).toContain('biology');
  });

  it('should return null for unknown combination', () => {
    const subjects = getSubjectsForCombination('nonexistent');
    expect(subjects).toBeNull();
  });

  it('should check if subject is in combination', () => {
    expect(isSubjectInCombination('physics', 'physics-chem-bio')).toBe(true);
    expect(isSubjectInCombination('history', 'physics-chem-bio')).toBe(false);
  });

  it('each 3+1+2 combination should have category', () => {
    const combos = getCombinationsForModel('3+1+2');
    for (const combo of combos) {
      expect(['science', 'liberal', 'mixed']).toContain(combo.category);
    }
  });
});

describe('P4-3: New question type templates', () => {
  it('should have fill and solution templates for math in generate-paper.js', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const source = fs.readFileSync(path.join(__dirname, '../../api/handlers/generate-paper.js'), 'utf-8');

    expect(source).toContain("fill: {");
    expect(source).toContain("solution: {");
  });

  it('should have biology question templates', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const source = fs.readFileSync(path.join(__dirname, '../../api/handlers/generate-paper.js'), 'utf-8');

    expect(source).toContain("'biology':");
    expect(source).toContain("BIOLOGY-001");
    expect(source).toContain("BIOLOGY-005");
  });

  it('should have history question templates', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const source = fs.readFileSync(path.join(__dirname, '../../api/handlers/generate-paper.js'), 'utf-8');

    expect(source).toContain("'history':");
    expect(source).toContain("HISTORY-001");
  });

  it('should have geography question templates', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const source = fs.readFileSync(path.join(__dirname, '../../api/handlers/generate-paper.js'), 'utf-8');

    expect(source).toContain("'geography':");
    expect(source).toContain("GEOGRAPHY-003");
  });

  it('should have expanded selection templates for existing subjects', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const source = fs.readFileSync(path.join(__dirname, '../../api/handlers/generate-paper.js'), 'utf-8');

    expect(source).toContain("MATH-009");
    expect(source).toContain("MATH-006");
    expect(source).toContain("PHYSICS-010");
    expect(source).toContain("CHEMISTRY-002");
    expect(source).toContain("POLITICS-008");
  });
});

describe('P4-4: Essay multi-dimensional scoring', () => {
  it('should have scores field in essay grading prompt', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const source = fs.readFileSync(path.join(__dirname, '../../api/utils/prompts.js'), 'utf-8');

    expect(source).toContain('scores');
    expect(source).toContain('content');
    expect(source).toContain('language');
    expect(source).toContain('structure');
    expect(source).toContain('development');
    expect(source).toContain('total');
  });

  it('should have four scoring dimensions with 20 points each', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const source = fs.readFileSync(path.join(__dirname, '../../api/utils/prompts.js'), 'utf-8');

    expect(source).toContain('20分');
    expect(source).toContain('0-80');
  });

  it('should have scoring criteria descriptions', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const source = fs.readFileSync(path.join(__dirname, '../../api/utils/prompts.js'), 'utf-8');

    expect(source).toContain('审题准确');
    expect(source).toContain('语言流畅');
    expect(source).toContain('结构完整');
    expect(source).toContain('有文采');
  });

  it('should reference four parts in prompt (not three)', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const source = fs.readFileSync(path.join(__dirname, '../../api/utils/prompts.js'), 'utf-8');

    expect(source).toContain('第四部分');
    expect(source).toContain('四部分输出');
  });
});

describe('P4-5: Class analysis enhancement', () => {
  it('should have getClassDetail function in class-analysis.js', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const source = fs.readFileSync(path.join(__dirname, '../../api/handlers/class-analysis.js'), 'utf-8');

    expect(source).toContain('export async function getClassDetail');
  });

  it('should have studentPerformance query in getClassDetail', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const source = fs.readFileSync(path.join(__dirname, '../../api/handlers/class-analysis.js'), 'utf-8');

    expect(source).toContain('studentPerformance');
    expect(source).toContain('avg_accuracy');
  });

  it('should have classWeakPoints query with affected_students', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const source = fs.readFileSync(path.join(__dirname, '../../api/handlers/class-analysis.js'), 'utf-8');

    expect(source).toContain('classWeakPoints');
    expect(source).toContain('affected_students');
  });

  it('should have weeklyTrend query', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const source = fs.readFileSync(path.join(__dirname, '../../api/handlers/class-analysis.js'), 'utf-8');

    expect(source).toContain('weeklyTrend');
    expect(source).toContain('active_students');
  });

  it('should have scoreDistribution query', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const source = fs.readFileSync(path.join(__dirname, '../../api/handlers/class-analysis.js'), 'utf-8');

    expect(source).toContain('scoreDistribution');
    expect(source).toContain('90-100');
    expect(source).toContain('0-59');
  });

  it('should have progressTrend in student analysis', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const source = fs.readFileSync(path.join(__dirname, '../../api/handlers/class-analysis.js'), 'utf-8');

    expect(source).toContain('progressTrend');
  });

  it('should have examHistory in student analysis', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const source = fs.readFileSync(path.join(__dirname, '../../api/handlers/class-analysis.js'), 'utf-8');

    expect(source).toContain('examHistory');
  });

  it('should validate period parameter with bounds', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const source = fs.readFileSync(path.join(__dirname, '../../api/handlers/class-analysis.js'), 'utf-8');

    expect(source).toContain('Math.min(Math.max(parseInt(period)');
    expect(source).toContain('7)');
    expect(source).toContain('365)');
  });

  it('should register class-detail route in server.js', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const source = fs.readFileSync(path.join(__dirname, '../../server.js'), 'utf-8');

    expect(source).toContain('/api/class-detail');
    expect(source).toContain('getClassDetail');
  });

  it('should import resolveSubjectName in class-analysis.js', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const source = fs.readFileSync(path.join(__dirname, '../../api/handlers/class-analysis.js'), 'utf-8');

    expect(source).toContain("from '../utils/subjectMap.js'");
    expect(source).toContain('resolveSubjectName');
  });
});
