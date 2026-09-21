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
      // 以下两个是 `node xxx.js` 脚本式检查(自带 process.exit + 打印), vitest 收集会报
      // "No test suite found"; 各自由 release-gate 的专门步骤执行:
      'tests/api/mastery-scale-guard.test.js',  // 门禁 6/7 静态标度闸门
      'tests/api/wrong-questions-crud.test.js', // 契约测试, 需 BCT_TOKEN + 活后端
      'node_modules/**',
    ],
    coverage: {
      provider: 'v8',
      include: ['api/**/*.js'],
      exclude: ['api/swagger.js', 'api/seed-provinces.js']
    }
  }
});
