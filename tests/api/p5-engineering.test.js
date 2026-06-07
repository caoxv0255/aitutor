import { describe, it, expect } from 'vitest';
import { validateResponseFormat } from '../../api/utils/response.js';

describe('P5-1: CI/CD pipeline configuration', () => {
  it('should have GitHub Actions workflow file', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const workflowPath = path.join(__dirname, '../../.github/workflows/ci.yml');
    expect(fs.existsSync(workflowPath)).toBe(true);
  });

  it('should have test job in CI workflow', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const source = fs.readFileSync(path.join(__dirname, '../../.github/workflows/ci.yml'), 'utf-8');

    expect(source).toContain('npm test');
    expect(source).toContain('npm run lint');
    expect(source).toContain('node-version');
    expect(source).toContain('actions/checkout');
    expect(source).toContain('actions/setup-node');
  });

  it('should have multi-node-version matrix', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const source = fs.readFileSync(path.join(__dirname, '../../.github/workflows/ci.yml'), 'utf-8');

    expect(source).toContain('matrix');
    expect(source).toContain('18');
    expect(source).toContain('20');
    expect(source).toContain('22');
  });

  it('should have security audit job', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const source = fs.readFileSync(path.join(__dirname, '../../.github/workflows/ci.yml'), 'utf-8');

    expect(source).toContain('npm audit');
    expect(source).toContain('security');
  });

  it('should have docker build job for main branch', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const source = fs.readFileSync(path.join(__dirname, '../../.github/workflows/ci.yml'), 'utf-8');

    expect(source).toContain('docker');
    expect(source).toContain('docker/build-push-action');
  });
});

describe('P5-2: ESLint + Prettier code standards', () => {
  it('should have eslint.config.js', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    expect(fs.existsSync(path.join(__dirname, '../../eslint.config.js'))).toBe(true);
  });

  it('should have .prettierrc', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    expect(fs.existsSync(path.join(__dirname, '../../.prettierrc'))).toBe(true);
  });

  it('should have lint and format scripts in package.json', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const source = fs.readFileSync(path.join(__dirname, '../../package.json'), 'utf-8');
    const pkg = JSON.parse(source);

    expect(pkg.scripts.lint).toBeDefined();
    expect(pkg.scripts['lint:fix']).toBeDefined();
    expect(pkg.scripts.format).toBeDefined();
    expect(pkg.scripts['format:check']).toBeDefined();
  });

  it('should have eslint and prettier in devDependencies', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const source = fs.readFileSync(path.join(__dirname, '../../package.json'), 'utf-8');
    const pkg = JSON.parse(source);

    expect(pkg.devDependencies.eslint).toBeDefined();
    expect(pkg.devDependencies.prettier).toBeDefined();
    expect(pkg.devDependencies['eslint-plugin-prettier']).toBeDefined();
    expect(pkg.devDependencies['@eslint/js']).toBeDefined();
  });

  it('eslint config should have prettier plugin and key rules', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const source = fs.readFileSync(path.join(__dirname, '../../eslint.config.js'), 'utf-8');

    expect(source).toContain('prettier/prettier');
    expect(source).toContain('no-var');
    expect(source).toContain('eqeqeq');
    expect(source).toContain('prefer-const');
  });

  it('prettierrc should have valid JSON format', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const source = fs.readFileSync(path.join(__dirname, '../../.prettierrc'), 'utf-8');
    const config = JSON.parse(source);

    expect(config.semi).toBeDefined();
    expect(config.singleQuote).toBeDefined();
    expect(config.printWidth).toBeDefined();
    expect(config.tabWidth).toBeDefined();
  });
});

describe('P5-3: Docker containerization', () => {
  it('should have Dockerfile', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    expect(fs.existsSync(path.join(__dirname, '../../Dockerfile'))).toBe(true);
  });

  it('should have docker-compose.yml', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    expect(fs.existsSync(path.join(__dirname, '../../docker-compose.yml'))).toBe(true);
  });

  it('should have .dockerignore', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    expect(fs.existsSync(path.join(__dirname, '../../.dockerignore'))).toBe(true);
  });

  it('Dockerfile should use node:22-slim and non-root user', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const source = fs.readFileSync(path.join(__dirname, '../../Dockerfile'), 'utf-8');

    expect(source).toContain('node:22-slim');
    expect(source).toContain('USER node');
    expect(source).toContain('npm ci');
    expect(source).toContain('EXPOSE 3000');
    expect(source).toContain('HEALTHCHECK');
  });

  it('docker-compose should have volume for database persistence', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const source = fs.readFileSync(path.join(__dirname, '../../docker-compose.yml'), 'utf-8');

    expect(source).toContain('volumes');
    expect(source).toContain('app-data');
    expect(source).toContain('database');
    expect(source).toContain('JWT_SECRET');
    expect(source).toContain('healthcheck');
  });

  it('.dockerignore should exclude node_modules and .env', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const source = fs.readFileSync(path.join(__dirname, '../../.dockerignore'), 'utf-8');

    expect(source).toContain('node_modules/');
    expect(source).toContain('.env');
  });
});

describe('P5-4: API response format unification', () => {
  it('should have validateResponseFormat function', () => {
    expect(typeof validateResponseFormat).toBe('function');
  });

  it('validateResponseFormat should accept valid success response', () => {
    const body = { success: true, message: 'ok', data: { id: 1 } };
    expect(validateResponseFormat(body)).toBe(true);
  });

  it('validateResponseFormat should accept valid error response', () => {
    const body = { success: false, message: 'error occurred', status: 'error' };
    expect(validateResponseFormat(body)).toBe(true);
  });

  it('validateResponseFormat should accept paginated response', () => {
    const body = { success: true, message: 'ok', data: [], pagination: { page: 1 } };
    expect(validateResponseFormat(body)).toBe(true);
  });

  it('validateResponseFormat should reject response without success field', () => {
    const body = { error: 'something went wrong' };
    expect(validateResponseFormat(body)).toBe(false);
  });

  it('validateResponseFormat should reject null', () => {
    expect(validateResponseFormat(null)).toBe(false);
  });

  it('validateResponseFormat should reject non-object', () => {
    expect(validateResponseFormat('string')).toBe(false);
  });

  it('should have createdResponse and deletedResponse exports', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const source = fs.readFileSync(path.join(__dirname, '../../api/utils/response.js'), 'utf-8');

    expect(source).toContain('createdResponse');
    expect(source).toContain('deletedResponse');
  });

  it('proxy.js should use errorResponse instead of { error: ... }', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const source = fs.readFileSync(path.join(__dirname, '../../api/handlers/proxy.js'), 'utf-8');

    expect(source).toContain("from '../utils/response.js'");
    expect(source).toContain('errorResponse');
  });

  it('auth.js should use errorResponse instead of { error: ... }', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const source = fs.readFileSync(path.join(__dirname, '../../api/core/auth.js'), 'utf-8');

    expect(source).toContain("from '../utils/response.js'");
    expect(source).toContain('errorResponse');
  });

  it('exam-session.js should use errorResponse', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const source = fs.readFileSync(path.join(__dirname, '../../api/handlers/exam-session.js'), 'utf-8');

    expect(source).toContain("from '../utils/response.js'");
  });

  it('graphrag.js should use errorResponse', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const source = fs.readFileSync(path.join(__dirname, '../../api/routes/graphrag.js'), 'utf-8');

    expect(source).toContain("from '../utils/response.js'");
  });

  it('security middleware should use errorResponse', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const source = fs.readFileSync(path.join(__dirname, '../../api/middleware/security.js'), 'utf-8');

    expect(source).toContain("from '../utils/response.js'");
    expect(source).toContain('errorResponse');
  });

  it('no API file should use raw { error: } pattern (except response.js itself)', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const apiDir = path.join(__dirname, '../../api');

    const subdirs = ['handlers', 'routes', 'core', 'middleware', 'utils'];
    const allFiles = [];
    for (const sub of subdirs) {
      const subDir = path.join(apiDir, sub);
      if (fs.existsSync(subDir)) {
        const files = fs.readdirSync(subDir).filter(f => f.endsWith('.js')).map(f => path.join(sub, f));
        allFiles.push(...files);
      }
    }
    let violations = 0;

    for (const file of allFiles) {
      if (file === 'utils/response.js') continue;
      const filePath = path.join(apiDir, file);
      if (!fs.statSync(filePath).isFile()) continue;
      const source = fs.readFileSync(filePath, 'utf-8');
      const rawErrorPattern = /res\.(?:status\(\d+\)\.)?json\(\s*\{\s*error\s*:/;
      if (rawErrorPattern.test(source)) {
        violations++;
      }
    }

    expect(violations).toBe(0);
  });
});
