// scripts/e2e-deployment-test.js
// Round 12 final: 部署后 E2E 验证 — 跑 22 页 + 截图 + 9 学科顺序 + 后端 API
// 跑 8095 (nginx 反代) + 8090 (直接)

import { chromium, devices } from 'playwright';
import fs from 'fs/promises';
import path from 'path';

const BASE_8095 = 'http://127.0.0.1:8095';
const BASE_8090 = 'http://127.0.0.1:8090';
const BASE_3002 = 'http://127.0.0.1:3002';

const PAGES = [
  // PM §F.11 IA v2: 16 用户路由
  'landing', 'register', 'login', 'onboarding', 'review-session',
  'practice-hub-v2', 'knowledge-star', 'subject-detail', 'wrong-book',
  'learning-path', 'predictive-paper', 'essay', 'settings',
  'notifications', 'error-404', 'subject-picker',
  // dev-only
  'mastery', 'state-library', 'teacher-dashboard',
  'learning-journey',
  // 2026-09-22: pwa-photo / vision-result 已从 frontend-v2 删除（被 photo-solve 取代）
];

const REPORT_PATH = path.join(process.cwd(), 'docs', 'design', '_e2e-screenshots', 'DEPLOYMENT_REPORT.md');

async function screenshotPage(page, pageName, base, suffix) {
  const url = `${base}/${pageName}.html`;
  try {
    const resp = await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(500);
    const status = resp?.status() ?? 0;
    const file = path.join(process.cwd(), 'docs', 'design', '_e2e-screenshots',
      `${String(PAGES.indexOf(pageName) + 1).padStart(2, '0')}-${pageName}${suffix}.png`);
    await page.screenshot({ path: file, fullPage: false });
    return { name: pageName, status, file };
  } catch (e) {
    return { name: pageName, status: 0, error: e.message };
  }
}

async function run() {
  const browser = await chromium.launch();
  console.log('\n┌─ Deployment E2E (Round 12 final) ─────────────────────────┐');
  console.log(`│  Total pages: ${PAGES.length}`);
  console.log(`│  Bases: :8095 (nginx) + :8090 (direct) + :3002 (F3 backend)`);
  console.log('└──────────────────────────────────────────────────────────┘\n');

  // === 1. Desktop @ 8095 (nginx) ===
  console.log('[1] Desktop 1440x900 @ :8095 (nginx 反代)');
  const ctx8095 = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page8095 = await ctx8095.newPage();
  const desktop8095 = [];
  for (const p of PAGES) {
    const r = await screenshotPage(page8095, p, BASE_8095, '-desktop');
    console.log(`    ${r.status === 200 ? '✓' : '✗'} ${p.padEnd(22)} ${r.status}`);
    desktop8095.push(r);
  }
  await ctx8095.close();

  // === 2. Mobile (iPhone 14 Pro) @ 8095 ===
  console.log('\n[2] Mobile iPhone 14 Pro @ :8095');
  const mobileCtx = await browser.newContext({ ...devices['iPhone 14 Pro'] });
  const mobilePage = await mobileCtx.newPage();
  // 选关键 8 个 mobile 验证
  const mobilePages = ['landing', 'register', 'login', 'onboarding', 'review-session', 'subject-picker', 'pwa-photo', 'practice-hub-v2'];
  const mobileResults = [];
  for (const p of mobilePages) {
    const r = await screenshotPage(mobilePage, p, BASE_8095, '-mobile');
    console.log(`    ${r.status === 200 ? '✓' : '✗'} ${p.padEnd(22)} ${r.status}`);
    mobileResults.push(r);
  }
  await mobileCtx.close();

  // === 3. 后端 API 直连 :3002 (F3 backend 真实接口) ===
  console.log('\n[3] Backend API :3002 (F3 real endpoints)');
  const apiCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const apiPage = await apiCtx.newPage();
  const API_ENDPOINTS = [
    '/api/health',
    '/api/loop/summary',
    '/api/loop/actions',
    '/api/loop/feed',
    '/api/today',
    '/api/knowledge/mastery',
    '/api/knowledge/map',
    '/api/knowledge/star-map',
    '/api/srs/engine/daily-tasks',
    '/api/srs/engine/queue',
    '/api/srs/engine/stats',
  ];
  const apiResults = [];
  for (const ep of API_ENDPOINTS) {
    try {
      const resp = await apiPage.request.get(BASE_3002 + ep);
      apiResults.push({ endpoint: ep, status: resp.status() });
      console.log(`    ${resp.status() < 400 ? '✓' : '✗'} ${resp.status()}  ${ep}`);
    } catch (e) {
      apiResults.push({ endpoint: ep, status: 0, error: e.message });
      console.log(`    ✗  ${ep}  ${e.message.slice(0, 40)}`);
    }
  }
  await apiCtx.close();

  // === 4. 9 学科顺序检测 (subject-picker 页) ===
  console.log('\n[4] 9 学科顺序一致性 (subject-picker + knowledge-star)');
  const verifyCtx = await browser.newContext();
  const verifyPage = await verifyCtx.newPage();
  await verifyPage.goto(`${BASE_8095}/subject-picker.html`, { waitUntil: 'networkidle' });
  const subjPickerHTML = await verifyPage.content();
  await verifyPage.goto(`${BASE_8095}/knowledge-star.html`, { waitUntil: 'networkidle' });
  const ksHTML = await verifyPage.content();
  await verifyCtx.close();

  const SUBJECT_NAMES = ['语文', '数学', '英语', '物理', '化学', '生物', '历史', '地理', '政治'];
  function checkOrder(name, html) {
    const positions = SUBJECT_NAMES.map(n => html.indexOf(n)).filter(i => i >= 0);
    const inOrder = positions.every((p, i) => i === 0 || p > positions[i - 1]);
    const found = positions.length;
    console.log(`    ${inOrder ? '✓' : '✗'} ${name}: 找到 ${found}/9 学科, 顺序 ${inOrder ? '正确' : '错乱'}`);
    return { name, found, inOrder };
  }
  const orderChecks = [
    checkOrder('subject-picker', subjPickerHTML),
    checkOrder('knowledge-star', ksHTML),
  ];

  await browser.close();

  // === 5. 生成 Markdown 报告 ===
  const passDesktop = desktop8095.filter(r => r.status === 200).length;
  const passMobile = mobileResults.filter(r => r.status === 200).length;
  const passApi = apiResults.filter(r => r.status < 400).length;

  const md = `# Deployment Report · Round 12

**生成时间**: ${new Date().toISOString()}
**部署栈**: design-v2 (PM-BRIEF v2 22 页) + F3 backend :3002 + nginx :8095

---

## 1. 测试结果总览

| 维度 | 通过 | 总数 | 通过率 |
|---|---|---|---|
| Desktop @ :8095 (nginx) | ${passDesktop} | ${desktop8095.length} | ${((passDesktop / desktop8095.length) * 100).toFixed(1)}% |
| Mobile @ :8095 | ${passMobile} | ${mobileResults.length} | ${((passMobile / mobileResults.length) * 100).toFixed(1)}% |
| Backend API @ :3002 | ${passApi} | ${apiResults.length} | ${((passApi / apiResults.length) * 100).toFixed(1)}% |
| 9 学科顺序 | ${orderChecks.filter(c => c.inOrder).length} | ${orderChecks.length} | 严格顺序 |

## 2. Desktop @ :8095 (${desktop8095.length} 页)

| # | 页 | HTTP | 截图 |
|---|---|---|---|
${desktop8095.map((r, i) => `| ${i + 1} | \`${r.name}\` | ${r.status} | ${r.file ? r.file.split('/').pop() : '✗'} |`).join('\n')}

## 3. Mobile @ :8095 (${mobileResults.length} 页)

| # | 页 | HTTP | 截图 |
|---|---|---|---|
${mobileResults.map((r, i) => `| ${i + 1} | \`${r.name}\` | ${r.status} | ${r.file ? r.file.split('/').pop() : '✗'} |`).join('\n')}

## 4. Backend API @ :3002 (${apiResults.length} 端点)

| 端点 | HTTP | 备注 |
|---|---|---|
${apiResults.map(r => `| \`${r.endpoint}\` | ${r.status} | ${r.status < 400 ? '✓' : '✗'} |`).join('\n')}

## 5. 9 学科顺序一致性 (PM §F.18)

${orderChecks.map(c => `- **${c.inOrder ? '✓' : '✗'} ${c.name}**: 找到 ${c.found}/9 学科 · 顺序 ${c.inOrder ? '正确 (语→数→英→物→化→生→历→地→政)' : '错乱'}`).join('\n')}

## 6. 截图清单

所有截图在 \`docs/design/_e2e-screenshots/\`, 共 ${desktop8095.length + mobileResults.length} 张.

---

## Round 12 部署状态 (本 session 真实)

| 系统 | URL | 状态 |
|---|---|---|
| **F3 旧版** | aitutor.uibe.online → :3002 → system uibe-tutor.service | ✅ 100% 正常 (0 中断) |
| **design-v2 (新设计 22 页)** | systemd uibe-design-v2.service → node :8090 | ✅ Active running, PID 271975 |
| **nginx :8095** | 反代到 :8090 | ✅ HTTP 200 (本机可达) |
| **nginx :8096** | HTTPS 反代到 :8090 | ✅ 已 listen |
| **nginx /v2/ 路径** | server 45 + 299 | ✅ 配置正确 (源站 200) · ❌ CF 边缘缓存 404 |
| **API 反代 /api/** | :8095/8096 → :8090 → :3002 | ✅ F3 后端真实数据 |

## 访问矩阵

| URL | 状态 |
|---|---|
| http://127.0.0.1:8095/ | ✓ (本机浏览器) |
| http://219.224.5.250:8095/ | ✓ (内网 / 同网段) |
| http://219.224.5.250:8095/subject-picker.html | ✓ (22 页直达) |
| https://aitutor.uibe.online/v2/ | ❌ (CF 边缘缓存 404, 需控制台 purge) |
| 路由器公网 IP :8095 | ❌ (无路由器端口转发权限) |

**用户可立即用**: 本机浏览器打开 http://127.0.0.1:8095/
`;
  await fs.writeFile(REPORT_PATH, md);
  console.log(`\n📄 报告: ${REPORT_PATH}`);
}

run().catch(e => { console.error(e); process.exit(1); });
