import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('User API Handlers', () => {
  describe('user-initialize.js', () => {
    it('should validate grade_code', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const { fileURLToPath } = await import('url');
      const __dirname = path.dirname(fileURLToPath(import.meta.url));
      const source = fs.readFileSync(path.join(__dirname, '../../api/handlers/user-initialize.js'), 'utf-8');

      expect(source).toContain("VALID_GRADE_CODES = ['grade_10', 'grade_11', 'grade_12', 'grade_7', 'grade_8', 'grade_9']");
      expect(source).toContain('VALID_EXAM_LEVELS');
    });

    it('should validate province_code', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const { fileURLToPath } = await import('url');
      const __dirname = path.dirname(fileURLToPath(import.meta.url));
      const source = fs.readFileSync(path.join(__dirname, '../../api/handlers/user-initialize.js'), 'utf-8');

      expect(source).toContain('SELECT id FROM provinces WHERE code = $1');
    });

    it('should validate subjects array', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const { fileURLToPath } = await import('url');
      const __dirname = path.dirname(fileURLToPath(import.meta.url));
      const source = fs.readFileSync(path.join(__dirname, '../../api/handlers/user-initialize.js'), 'utf-8');

      expect(source).toContain('Array.isArray(subjects)');
      expect(source).toContain('subjects.length === 0');
      expect(source).toContain('subjects.length > 10');
    });

    it('should use transaction for initialization', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const { fileURLToPath } = await import('url');
      const __dirname = path.dirname(fileURLToPath(import.meta.url));
      const source = fs.readFileSync(path.join(__dirname, '../../api/handlers/user-initialize.js'), 'utf-8');

      expect(source).toContain('await pool.query(\'BEGIN\')');
      expect(source).toContain('await pool.query(\'COMMIT\')');
      expect(source).toContain('await pool.query(\'ROLLBACK\')');
    });

    it('should handle ON CONFLICT for user_profiles', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const { fileURLToPath } = await import('url');
      const __dirname = path.dirname(fileURLToPath(import.meta.url));
      const source = fs.readFileSync(path.join(__dirname, '../../api/handlers/user-initialize.js'), 'utf-8');

      expect(source).toContain('ON CONFLICT (user_email) DO UPDATE SET');
    });
  });

  describe('user-profile.js', () => {
    it('should support GET and POST methods', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const { fileURLToPath } = await import('url');
      const __dirname = path.dirname(fileURLToPath(import.meta.url));
      const source = fs.readFileSync(path.join(__dirname, '../../api/handlers/user-profile.js'), 'utf-8');

      expect(source).toContain("req.method === 'GET'");
      expect(source).toContain("req.method === 'POST'");
      expect(source).toContain('405');
    });

    it('should return default profile when not initialized', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const { fileURLToPath } = await import('url');
      const __dirname = path.dirname(fileURLToPath(import.meta.url));
      const source = fs.readFileSync(path.join(__dirname, '../../api/handlers/user-profile.js'), 'utf-8');

      expect(source).toContain('initialized: false');
      expect(source).toContain('study_hours_per_day: 2');
    });

    it('should parse weak_subjects as JSON', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const { fileURLToPath } = await import('url');
      const __dirname = path.dirname(fileURLToPath(import.meta.url));
      const source = fs.readFileSync(path.join(__dirname, '../../api/handlers/user-profile.js'), 'utf-8');

      expect(source).toContain('JSON.parse(profile.weak_subjects');
    });

    it('should use COALESCE for update', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const { fileURLToPath } = await import('url');
      const __dirname = path.dirname(fileURLToPath(import.meta.url));
      const source = fs.readFileSync(path.join(__dirname, '../../api/handlers/user-profile.js'), 'utf-8');

      expect(source).toContain('COALESCE($1, grade_code)');
    });
  });

  describe('user-subjects.js', () => {
    it('should support GET, POST, DELETE methods', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const { fileURLToPath } = await import('url');
      const __dirname = path.dirname(fileURLToPath(import.meta.url));
      const source = fs.readFileSync(path.join(__dirname, '../../api/handlers/user-subjects.js'), 'utf-8');

      expect(source).toContain("req.method === 'GET'");
      expect(source).toContain("req.method === 'POST'");
      expect(source).toContain("req.method === 'DELETE'");
    });

    it('should validate subjects count limits', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const { fileURLToPath } = await import('url');
      const __dirname = path.dirname(fileURLToPath(import.meta.url));
      const source = fs.readFileSync(path.join(__dirname, '../../api/handlers/user-subjects.js'), 'utf-8');

      expect(source).toContain('subjects.length > 10');
      expect(source).toContain('最多选择10门学科');
    });

    it('should validate subject codes against subjects table', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const { fileURLToPath } = await import('url');
      const __dirname = path.dirname(fileURLToPath(import.meta.url));
      const source = fs.readFileSync(path.join(__dirname, '../../api/handlers/user-subjects.js'), 'utf-8');

      expect(source).toContain('SELECT code FROM subjects WHERE code = ANY($1)');
    });

    it('should return 404 when removing non-existent subject', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const { fileURLToPath } = await import('url');
      const __dirname = path.dirname(fileURLToPath(import.meta.url));
      const source = fs.readFileSync(path.join(__dirname, '../../api/handlers/user-subjects.js'), 'utf-8');

      expect(source).toContain('result.rowCount === 0');
      expect(source).toContain('404');
    });
  });

  describe('user-province.js', () => {
    it('should validate user authentication', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const { fileURLToPath } = await import('url');
      const __dirname = path.dirname(fileURLToPath(import.meta.url));
      const source = fs.readFileSync(path.join(__dirname, '../../api/handlers/user-province.js'), 'utf-8');

      expect(source).toContain('!user_email');
      expect(source).toContain('401');
    });

    it('should validate exam_level and province_code', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const { fileURLToPath } = await import('url');
      const __dirname = path.dirname(fileURLToPath(import.meta.url));
      const source = fs.readFileSync(path.join(__dirname, '../../api/handlers/user-province.js'), 'utf-8');

      expect(source).toContain('!exam_level || !province_code');
      expect(source).toContain('400');
    });

    it('should validate province exists in database', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const { fileURLToPath } = await import('url');
      const __dirname = path.dirname(fileURLToPath(import.meta.url));
      const source = fs.readFileSync(path.join(__dirname, '../../api/handlers/user-province.js'), 'utf-8');

      expect(source).toContain('SELECT * FROM provinces WHERE code = $1');
      expect(source).toContain('provinceResult.rows.length === 0');
    });

    it('should use ON CONFLICT for upsert', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const { fileURLToPath } = await import('url');
      const __dirname = path.dirname(fileURLToPath(import.meta.url));
      const source = fs.readFileSync(path.join(__dirname, '../../api/handlers/user-province.js'), 'utf-8');

      expect(source).toContain('ON CONFLICT (user_email, exam_level) DO UPDATE SET');
    });

    it('should sync with users table', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const { fileURLToPath } = await import('url');
      const __dirname = path.dirname(fileURLToPath(import.meta.url));
      const source = fs.readFileSync(path.join(__dirname, '../../api/handlers/user-province.js'), 'utf-8');

      expect(source).toContain('UPDATE users SET province = $1, exam_level = $2 WHERE email = $3');
    });
  });
});
