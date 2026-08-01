// playwright.config.js — F2.4 Playwright E2E config
// 跑: npx playwright test --config=playwright.config.js
// 或: make e2e (未来 Makefile target)
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:8000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // 默认 mock 模式 (URL 加 ?mock=true, services 走 mock JSON)
    extraHTTPHeaders: {},
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'python3 -m http.server 8000 --bind 0.0.0.0 --directory ai-tutor-frontend',
    url: 'http://localhost:8000/pages/index.html',
    reuseExistingServer: true,
    timeout: 10_000,
  },
});