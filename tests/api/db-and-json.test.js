import { describe, it, expect } from 'vitest';

describe('db.js PostgreSQL configuration', () => {
  it('should use pg Pool in db.js source', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const source = fs.readFileSync(path.join(__dirname, '../../api/db.js'), 'utf-8');

    expect(source).toContain("import pg from 'pg'");
    expect(source).toContain('Pool');
    expect(source).toContain('DATABASE_URL');
    expect(source).not.toContain('PRAGMA');
    expect(source).not.toContain('sqlite');
  });
});

describe('questions.js JSON.parse protection', () => {
  it('should have try-catch around JSON.parse in questions.js', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const source = fs.readFileSync(path.join(__dirname, '../../api/questions.js'), 'utf-8');

    expect(source).toContain('try {');
    expect(source).toContain('JSON.parse(r.data)');
    expect(source).toContain('} catch {');
    expect(source).toContain('1MB');
  });
});

describe('knowledge-points.js JSON.parse protection', () => {
  it('should have try-catch around JSON.parse in knowledge-points.js', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const source = fs.readFileSync(path.join(__dirname, '../../api/knowledge-points.js'), 'utf-8');

    const parseCount = (source.match(/JSON\.parse/g) || []).length;
    const tryCount = (source.match(/try \{/g) || []).length;
    expect(tryCount).toBeGreaterThanOrEqual(parseCount);
  });
});
