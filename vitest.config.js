import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.js'],
    exclude: [
      'tests/contract.test.js',
      'tests/backend-contract.test.js',
      'tests/production-smoke.test.js', // CI-only smoke (D070: vitest 不能加载, 否则报 "No test suite found")
      'node_modules/**',
    ],
    coverage: {
      provider: 'v8',
      include: ['api/**/*.js'],
      exclude: ['api/swagger.js', 'api/seed-provinces.js']
    }
  }
});
