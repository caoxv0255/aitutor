import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.js'],
    exclude: ['tests/contract.test.js', 'tests/backend-contract.test.js', 'node_modules/**'],
    coverage: {
      provider: 'v8',
      include: ['api/**/*.js'],
      exclude: ['api/swagger.js', 'api/seed-provinces.js']
    }
  }
});
