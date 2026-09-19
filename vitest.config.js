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
      // 同为 `node tests/xxx.js` 脚本式测试 (非 vitest suite), vitest 加载会报 "No test suite found"
      'tests/loop-endpoints.test.js',   // Round 8 contract, 手动跑
      'tests/e2e/design-quality.test.js', // Playwright E2E, 需 design server :8765
      'node_modules/**',
    ],
    coverage: {
      provider: 'v8',
      include: ['api/**/*.js'],
      exclude: ['api/swagger.js', 'api/seed-provinces.js']
    }
  }
});
