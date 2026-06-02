import { describe, it, expect } from 'vitest';
import { calculateUserAbility, calculateAdaptiveDifficulty } from '../../api/adaptive-difficulty.js';

describe('P3-1: Mobile SPA memory leak fix', () => {
  it('should have cleanupPage method in App class', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const source = fs.readFileSync(path.join(__dirname, '../../public/src/app.js'), 'utf-8');

    expect(source).toContain('cleanupPage()');
    expect(source).toContain('this._timers');
    expect(source).toContain('this._abortControllers');
    expect(source).toContain('this._pageListeners');
  });

  it('should call cleanupPage in render method', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const source = fs.readFileSync(path.join(__dirname, '../../public/src/app.js'), 'utf-8');

    const renderMatch = source.match(/render\(\)\s*\{[\s\S]*?this\.cleanupPage/);
    expect(renderMatch).toBeTruthy();
  });

  it('should have _addTimer and _clearTimer methods', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const source = fs.readFileSync(path.join(__dirname, '../../public/src/app.js'), 'utf-8');

    expect(source).toContain('_addTimer(id)');
    expect(source).toContain('_clearTimer(id)');
  });

  it('should have _addAbortController method', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const source = fs.readFileSync(path.join(__dirname, '../../public/src/app.js'), 'utf-8');

    expect(source).toContain('_addAbortController(controller)');
  });

  it('should have _addPageListener method', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const source = fs.readFileSync(path.join(__dirname, '../../public/src/app.js'), 'utf-8');

    expect(source).toContain('_addPageListener(target, event, handler, options)');
  });

  it('should destroy cropper in cleanupPage', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const source = fs.readFileSync(path.join(__dirname, '../../public/src/app.js'), 'utf-8');

    expect(source).toContain('this.cropper.destroy()');
    expect(source).toContain('this.cropper = null');
  });

  it('should use _addTimer in showToast', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const source = fs.readFileSync(path.join(__dirname, '../../public/src/app.js'), 'utf-8');

    const toastStart = source.indexOf('showToast(message, duration');
    const toastEnd = source.indexOf('}', source.indexOf('this._addTimer(hideTimer)', toastStart) + 1);
    const toastSection = source.slice(toastStart, toastEnd);
    expect(toastSection).toContain('this._addTimer');
  });
});

describe('P3-2: PC photo search feature', () => {
  it('should have photo search modal in dashboard.html', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const source = fs.readFileSync(path.join(__dirname, '../../frontend/dashboard.html'), 'utf-8');

    expect(source).toContain('photoSearchModal');
    expect(source).toContain('cameraVideo');
    expect(source).toContain('startCamera');
    expect(source).toContain('capturePhoto');
    expect(source).toContain('stopCamera');
  });

  it('should have file upload input in dashboard.html', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const source = fs.readFileSync(path.join(__dirname, '../../frontend/dashboard.html'), 'utf-8');

    expect(source).toContain('photoFileInput');
    expect(source).toContain('modalFileInput');
    expect(source).toContain('handlePhotoFile');
  });

  it('should have submitPhotoSearch function', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const source = fs.readFileSync(path.join(__dirname, '../../frontend/dashboard.html'), 'utf-8');

    expect(source).toContain('submitPhotoSearch');
    expect(source).toContain('/api/proxy');
    expect(source).toContain('qwen3-vl-plus');
  });

  it('should properly stop camera stream on close', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const source = fs.readFileSync(path.join(__dirname, '../../frontend/dashboard.html'), 'utf-8');

    expect(source).toContain('getTracks().forEach');
    expect(source).toContain('_cameraStream = null');
    expect(source).toContain('video.srcObject = null');
  });

  it('should have escapeHtml for XSS prevention', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const source = fs.readFileSync(path.join(__dirname, '../../frontend/dashboard.html'), 'utf-8');

    expect(source).toContain('function escapeHtml');
    expect(source).toContain('escapeHtml(result.clue)');
    expect(source).toContain('escapeHtml(result.solution)');
  });
});

describe('P3-3: Exam mode optimization', () => {
  it('should have countdown timer in exam-mode.js', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const source = fs.readFileSync(path.join(__dirname, '../../frontend/exam-mode.js'), 'utf-8');

    expect(source).toContain('isCountdown');
    expect(source).toContain('remaining');
    expect(source).toContain('updateCountdownDisplay');
    expect(source).toContain('defaultTimeLimit');
  });

  it('should auto-submit when countdown reaches zero', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const source = fs.readFileSync(path.join(__dirname, '../../frontend/exam-mode.js'), 'utf-8');

    expect(source).toContain('remaining <= 0');
    expect(source).toContain('window._examMode.submit()');
  });

  it('should have visibility change guard for anti-cheating', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const source = fs.readFileSync(path.join(__dirname, '../../frontend/exam-mode.js'), 'utf-8');

    expect(source).toContain('visibilitychange');
    expect(source).toContain('handleVisibilityChange');
    expect(source).toContain('visibilityChangeCount');
    expect(source).toContain('enableVisibilityGuard');
    expect(source).toContain('disableVisibilityGuard');
  });

  it('should have timer toggle button for countdown/countup switch', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const source = fs.readFileSync(path.join(__dirname, '../../frontend/exam-mode.js'), 'utf-8');

    expect(source).toContain('timer-toggle-btn');
    expect(source).toContain('isCountdown = !isCountdown');
  });

  it('should display color warning when time is running low', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const source = fs.readFileSync(path.join(__dirname, '../../frontend/exam-mode.js'), 'utf-8');

    expect(source).toContain('remaining <= 300');
    expect(source).toContain('#d71920');
    expect(source).toContain('remaining <= 600');
    expect(source).toContain('#ff9800');
  });

  it('should expose API methods on window._examMode', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const source = fs.readFileSync(path.join(__dirname, '../../frontend/exam-mode.js'), 'utf-8');

    expect(source).toContain('setTimeLimit');
    expect(source).toContain('getCountdown');
    expect(source).toContain('getElapsedTime');
    expect(source).toContain('getRemainingTime');
    expect(source).toContain('getVisibilityCount');
  });

  it('should record visibility change count in score summary', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const source = fs.readFileSync(path.join(__dirname, '../../frontend/exam-mode.js'), 'utf-8');

    expect(source).toContain('visibilityChangeCount > 0');
    expect(source).toContain('切屏');
  });
});

describe('P3-4: Adaptive difficulty', () => {
  it('calculateUserAbility should return 3.0 for empty history', () => {
    const ability = calculateUserAbility([]);
    expect(ability).toBe(3.0);
  });

  it('calculateUserAbility should return 3.0 for null input', () => {
    const ability = calculateUserAbility(null);
    expect(ability).toBe(3.0);
  });

  it('calculateUserAbility should return higher ability for high accuracy', () => {
    const history = [
      { correct_count: 18, total_questions: 20, avg_difficulty: 4 },
      { correct_count: 16, total_questions: 20, avg_difficulty: 3.5 }
    ];
    const ability = calculateUserAbility(history);
    expect(ability).toBeGreaterThan(3.0);
  });

  it('calculateUserAbility should return lower ability for low accuracy', () => {
    const history = [
      { correct_count: 5, total_questions: 20, avg_difficulty: 3 },
      { correct_count: 4, total_questions: 20, avg_difficulty: 2.5 }
    ];
    const ability = calculateUserAbility(history);
    expect(ability).toBeLessThan(3.0);
  });

  it('calculateUserAbility should weight recent exams more heavily', () => {
    const recentGood = [
      { correct_count: 20, total_questions: 20, avg_difficulty: 5 },
      { correct_count: 20, total_questions: 20, avg_difficulty: 5 },
      { correct_count: 20, total_questions: 20, avg_difficulty: 5 },
      { correct_count: 0, total_questions: 20, avg_difficulty: 1 },
      { correct_count: 0, total_questions: 20, avg_difficulty: 1 }
    ];
    const recentBad = [
      { correct_count: 0, total_questions: 20, avg_difficulty: 1 },
      { correct_count: 0, total_questions: 20, avg_difficulty: 1 },
      { correct_count: 0, total_questions: 20, avg_difficulty: 1 },
      { correct_count: 20, total_questions: 20, avg_difficulty: 5 },
      { correct_count: 20, total_questions: 20, avg_difficulty: 5 }
    ];
    const abilityGood = calculateUserAbility(recentGood);
    const abilityBad = calculateUserAbility(recentBad);
    expect(abilityGood).toBeGreaterThan(abilityBad);
  });

  it('calculateAdaptiveDifficulty should lower difficulty for many weak points', () => {
    const normal = calculateAdaptiveDifficulty(3.0, 0.1);
    const manyWeak = calculateAdaptiveDifficulty(3.0, 0.7);
    expect(manyWeak).toBeLessThan(normal);
  });

  it('calculateAdaptiveDifficulty should raise difficulty for few weak points', () => {
    const normal = calculateAdaptiveDifficulty(3.0, 0.3);
    const fewWeak = calculateAdaptiveDifficulty(3.0, 0.1);
    expect(fewWeak).toBeGreaterThan(normal);
  });

  it('calculateAdaptiveDifficulty should clamp between 1.5 and 4.5', () => {
    const low = calculateAdaptiveDifficulty(0.5, 0.9);
    const high = calculateAdaptiveDifficulty(5.5, 0);
    expect(low).toBeGreaterThanOrEqual(1.5);
    expect(high).toBeLessThanOrEqual(4.5);
  });

  it('adaptive-difficulty.js should exist and export handler', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const exists = fs.existsSync(path.join(__dirname, '../../api/adaptive-difficulty.js'));
    expect(exists).toBe(true);
  });

  it('server.js should register adaptive-difficulty route', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const source = fs.readFileSync(path.join(__dirname, '../../server.js'), 'utf-8');

    expect(source).toContain("from './api/adaptive-difficulty.js'");
    expect(source).toContain('/api/adaptive-difficulty');
  });

  it('generate-paper.js should import adaptive difficulty', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const source = fs.readFileSync(path.join(__dirname, '../../api/generate-paper.js'), 'utf-8');

    expect(source).toContain("from './adaptive-difficulty.js'");
    expect(source).toContain('getUserAbilityForSubject');
    expect(source).toContain('adaptive');
  });
});
