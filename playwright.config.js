// playwright.config.js — F2.4 + Phase I+ (2026-08-25) Playwright E2E config
// 跑: npx playwright test --config=playwright.config.js
//
// Phase I+ 变更:
//  - baseURL 改 3002 (F3 页面同源走真实后端, 需要 /api/* + /f3/pages/* 都通)
//  - webServer 移除 (复用现成 server.js 3002, 不再启 8000 静态)
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',
  use: {
    // Phase I+: 切到真实后端 (F3 页面同时需要静态 + /api/*)
    baseURL: 'http://localhost:3002',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // 默认 mock 模式 (URL 加 ?mock=true, services 走 mock JSON)
    extraHTTPHeaders: {},
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  // Phase I+: webServer 已移除 — 复用现成 3002 server.js (dev/prod 同源).
  // 老 demo.spec.js 通过 3002 + /f3/pages/index.html 跑 (mock 模式无后端依赖).
});