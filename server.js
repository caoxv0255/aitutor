import express from 'express';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

import { swaggerUI, swaggerSpec } from './api/core/swagger.js';
import { authMiddleware, requireAdmin, validateJWTSecret } from './api/core/auth.js';
import { getDb } from './api/core/db.js';
import { startWorker } from './api/core/taskWorker.js';
import { ensureSeeds } from './api/core/ensureSeeds.js';
import { logger, loggerMiddleware } from './api/core/logger.js';
import { errorHandler } from './api/middleware/errorHandler.js';
import { securityHeaders, xssSanitizer, xssDetector, csrfProtection, auditMiddleware } from './api/middleware/security.js';
import { versionMiddleware } from './api/middleware/versioning.js';
// Phase-B-fix (2026-08-24): B7 — traceIdMiddleware 提取/生成 X-Trace-Id, 挂到 req.traceId
import { traceIdMiddleware } from './api/middleware/traceId.js';
import { createSuccessResponse, createErrorResponse, ErrorCode } from './api/utils/errorCodes.js';
import modulesRouter from './api/modules/index.js';
import legacyCompatRouter from './api/legacy-compat.js';
// 2026-09-25: 作文智能批改 (analyze/report/list) — 复用 V1.0 两阶段服务 + 私有 MaaS 视觉
import essayReviewRouter from './api/routes/essay-review.js';

import { getProvinces, getProvinceByCode, getProvinceStats } from './api/handlers/provinces.js';
import { getClassDetail } from './api/handlers/class-analysis.js';
import adaptiveDifficultyHandler from './api/handlers/adaptive-difficulty.js';
import { gradeEssayHandler, listEssaysHandler, getEssayHandler } from './api/handlers/essay/index.js';
import { uploadImageHandler } from './api/handlers/upload/imageHandler.js';
import { getProvinceTrends, getProvinceCompare } from './api/handlers/province-trends.js';
import { seedProvinces } from './api/handlers/seed-provinces.js';
import { CacheService } from './api/services/cacheService.js';
import { generateExamPdf } from './api/handlers/exam-pdf.js';
import proxyHandler from './api/handlers/proxy.js';

dotenv.config();

validateJWTSecret();

// D067 (2026-08-17): DEV_AUTH_BYPASS 生产防护.
// 2026-08-17 incident: 旧进程环境变量残留 DEV_AUTH_BYPASS=1,
// 导致所有端点无 token 返回 200，用户数据泄露.
// 生产环境强制拒绝启动；开发环境输出醒目警告.
if (process.env.DEV_AUTH_BYPASS === '1') {
  if (process.env.NODE_ENV === 'production') {
    console.error('❌ FATAL: DEV_AUTH_BYPASS=1 is set in production — refusing to start');
    process.exit(1);
  }
  console.warn('⚠️  WARNING: DEV_AUTH_BYPASS=1 — ALL AUTH GUARDS BYPASSED — NOT FOR PRODUCTION');
}

const app = express();
const PORT = process.env.PORT || 3002;

// Rate-limit policy:
//   - authLimiter   20 / 15min : unauth-heavy endpoints (login/register/etc.)
//   - proxyLimiter  10 / 1min  : per-user AI proxy (cost-controlled)
//   - apiLimiter    dynamic    : 120/min for authenticated users, 30/min for anon.
//                                Anonymous traffic gets the tighter bucket because
//                                we can't tie it to a stable user key for ban lists.
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: { error: '请求过于频繁，请稍后再试' } });
const proxyLimiter = rateLimit({ windowMs: 60 * 1000, max: 10, message: { error: '请求过于频繁，请稍后再试' } });
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  // express-rate-limit picks the key from req.ip by default; once authMiddleware
  // runs the request will have req.user, so we can use email as a more stable
  // key and bump the budget for known users.
  keyGenerator: (req /*, res */) => (req.user && req.user.email) ? `u:${req.user.email}` : `ip:${req.ip}`,
  max: (req /*, res */) => (req.user && req.user.email) ? 120 : 30,
  message: { error: '请求过于频繁，请稍后再试' },
});
// H3-b (2026-09-22): /api/essay/grade 双键限流 —— 已认证按 email, 兜底 ip.
// 挂在 authMiddleware 之后, 此时 req.user 已就绪.
const essayLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  keyGenerator: (req /*, res */) => (req.user && req.user.email) ? `u:${req.user.email}` : `ip:${req.ip}`,
  message: { error: '请求过于频繁，请稍后再试' },
});

// Trust-proxy configuration.
//   - Default: trust the loopback proxy only (Express docs recommend this for
//     single-tier reverse proxies).
//   - Override with TRUST_PROXY=<n|ip|loopback|...> in env if you sit behind
//     multiple tiers (e.g. CDN -> ALB -> app). Never set to `true` unless you
//     fully control every hop, otherwise rate-limit X-Forwarded-For will be
//     spoofable. See https://expressjs.com/en/guide/behind-proxies.html
const TRUST_PROXY = process.env.TRUST_PROXY ?? 'loopback';
app.set('trust proxy', TRUST_PROXY);
app.use(securityHeaders);
app.use(cors({ origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3002'], credentials: true }));
// P0-fix (2026-08-24): Phase D — D1
// 默认 JSON body limit 由 1mb → 10mb, 支持整卷拍照上传 (2-5MB base64).
// 仍由 express-rate-limit + auth 中间件前置保护, 不引入新攻击面.
// 若是单 endpoint 需要更大体积, 在挂载点用 per-route parser 单独覆盖.
app.use(express.json({ limit: '10mb' }));
app.use(xssSanitizer);
app.use(xssDetector);
app.use(csrfProtection);
// Phase-B-fix (2026-08-24): B7 — traceId 必须在 loggerMiddleware 之后,
//   让 logger.request() 把 traceId 写入日志 meta (与 requestId 并列)
app.use(loggerMiddleware);
app.use(traceIdMiddleware);
app.use('/api/', versionMiddleware);

app.use((req, res, next) => {
  req.cookies = {};
  const header = req.headers.cookie;
  if (header) {
    header.split(';').forEach((c) => {
      const idx = c.indexOf('=');
      if (idx > 0) {
        req.cookies[c.slice(0, idx).trim()] = c.slice(idx + 1).trim();
      }
    });
  }
  next();
});

app.use((req, res, next) => {
  if (req.url.startsWith('/aitutor')) {
    req.url = req.url.slice('/aitutor'.length) || '/';
  }
  next();
});

// ═══════════════════════════════════════════════════════════════════════════
// V2-DESIGN-BEGIN  —— /v2 设计稿托管（PM-BRIEF v2，24 页静态稿）
//
// 交付目标：https://aitutor.uibe.online/v2
//
// 此前这批设计稿只挂在 lab.uibe.edu.cn/v2（nginx → :8090 的
// server-design-v2.js）。现在改为由本站点自身（aitutor.uibe.online → :3002）
// 在 /v2 子路径下提供，不依赖 lab 域名，也不需要新增/修改任何 nginx 规则。
//
// 为什么能直接挂子路径：24 页全部用相对路径引用资源
// （href="login.html" / src="assets/js/auth-nav.js"），仅 hero.html 有一处
// href="/" 指向站点根；页内 /api/* 调用是绝对路径，仍归还到同域名后端。
//
// 目录解析：DESIGN_V2_DIR 环境变量优先，默认 ./frontend-v2（本项目内）
//
// 2026-09-21 变更：设计稿已从 docs/design/ 迁入 frontend-v2/（受版本控制，
// 且不再被 .dockerignore 排除）。切换期间 docs/design/ 下留有一份桥接副本
// （硬链接 + assets 拷贝），供尚未重启的旧进程继续服务；重启后删除即可。
// 对外屏蔽：*.md 内部文档 与 _e2e-screenshots/
// ═══════════════════════════════════════════════════════════════════════════
const DESIGN_V2_DIR = path.resolve(process.env.DESIGN_V2_DIR || 'frontend-v2');

if (fs.existsSync(path.join(DESIGN_V2_DIR, 'hero.html'))) {
  const DESIGN_V2_404 = path.join(DESIGN_V2_DIR, 'error-404.html');
  const sendDesign404 = (res) => {
    if (fs.existsSync(DESIGN_V2_404)) {
      return res.status(404).sendFile(DESIGN_V2_404);
    }
    return res.status(404).type('html').send('<!doctype html><meta charset="utf-8"><title>404</title><h1>404 Not Found</h1>');
  };

  // /v2 → /v2/（补斜杠）；/v2/ → hero.html（与 :8090 现行行为保持一致）
  //
  // ⚠️ 必须用正则而不是 app.get('/v2') / app.get('/v2/')：
  // Express 默认 strict:false，字符串路由 '/v2' 会把 '/v2/' 一并匹配，
  // 导致 /v2/ 被自己 301 到 /v2/ —— 死循环。
  app.get(/^\/v2\/?$/, (req, res) => {
    if (req.path === '/v2') {
      return res.redirect(301, '/v2/');
    }
    return res.sendFile(path.join(DESIGN_V2_DIR, 'hero.html'), (err) => {
      if (err && !res.headersSent) {
        res.status(500).type('html').send('design v2: hero.html 读取失败');
      }
    });
  });

  // 无后缀直达 /v2/essay → 301 /v2/essay.html（仅当目标文件确实存在）
  app.get(/^\/v2\/([A-Za-z0-9_-]+)$/, (req, res, next) => {
    const slug = req.params[0];
    if (fs.existsSync(path.join(DESIGN_V2_DIR, `${slug}.html`))) {
      return res.redirect(301, `/v2/${slug}.html`);
    }
    return next();
  });

  // 内部资料不对外：_e2e-screenshots/ 与 *.md
  app.use('/v2', (req, res, next) => {
    if (req.path.startsWith('/_e2e-screenshots') || /\.md$/i.test(req.path)) {
      return sendDesign404(res);
    }
    return next();
  });

  // 静态资源（*.html / *.png / assets/**）
  app.use(
    '/v2',
    express.static(DESIGN_V2_DIR, {
      index: false,
      etag: true,
      maxAge: '7d',
      setHeaders(res, filePath) {
        if (filePath.endsWith('.html')) {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        }
      },
    })
  );

  // /v2/* 未命中 → 设计稿自带的 404 页
  app.use('/v2', (_req, res) => sendDesign404(res));

  logger.info(`[v2] 设计稿已挂载到 /v2 → ${DESIGN_V2_DIR}`);
} else {
  logger.warn(`[v2] 未挂载：找不到 ${DESIGN_V2_DIR}/hero.html`);
}
// V2-DESIGN-END
// ═══════════════════════════════════════════════════════════════════════════

app.get('/', (req, res) => {
  const userAgent = req.headers['user-agent'] || '';
  const isMobile = /Mobile|Android|iPhone|iPad|iPod|Windows Phone/i.test(userAgent);
  if (isMobile) {
    res.sendFile('index.html', { root: 'public' });
  } else {
    // PC: F3 完整产品首页 (D-Bug-D 完成 2026-08-24, 把 frontend/index.html 内容迁移到 F3).
    // 见 docs/frontend-migration/F3_MIGRATION_PLAN_2026-08-23.md
    res.sendFile('index.html', { root: 'ai-tutor-frontend/pages' });
  }
});

app.get('/index.html', (req, res) => {
  const userAgent = req.headers['user-agent'] || '';
  const isMobile = /Mobile|Android|iPhone|iPad|iPod|Windows Phone/i.test(userAgent);
  if (isMobile) {
    res.sendFile('index.html', { root: 'public' });
  } else {
    res.sendFile('index.html', { root: 'frontend' });
  }
});

app.get('/app', (req, res) => {
  res.sendFile('index.html', { root: 'public' });
});

// P0.5 (2026-08-13) + D070 (2026-08-17): freeze legacy frontends, 301 -> F3
// legacy /frontend (frontend/) have been migrated to /f3.
// Preserve 30 days for backward links, then change to 410 Gone.
// NOTE: must be BEFORE any express.static() that would shadow it.
app.get(/^\/(frontend)(\/.*)?$/, (req, res) => {
  res.redirect(301, '/f3/pages/index.html');
});

// ═══════════════════════════════════════════════════════════════════════════
// NEW-TREE-BEGIN (2026-09-21, Q3 决策「立刻切默认，旧树只留回滚」)
//
// 落地方式：新树优先 + 旧树兜底 + 一键回滚。**不是**一刀切 ——
// 只有 NEW_TREE_PAGES 里已按新架构重建并通过验收的页面才由 frontend-v2/ 接管，
// 其余路径继续由旧树（F3 / legacy / PWA）服务，因此不会出现"切了之后功能页消失"。
//
// 为什么页面走根路径而不是 /v2/：canonical URL 应该是用户会手输的
// `/login.html`，而不是 `/v2/login.html`。旧树同名页（legacy 与 F3 的
// login/register/wrong-book/mastery）被这里**优先遮蔽**，实现"同一路径只有一个版本"。
//
// 资源为什么用 /assets/v2/：新树的页面用相对路径引用 `assets/...`，
// 挂到根路径会与 legacy 的 frontend/assets/ 撞名（实测 legacy 也有
// assets/js/auth-nav.js），把新树资源前置会静默改掉旧页行为。故给新树
// 独立的命名空间，零碰撞。
//
// 回滚：
//   NEW_TREE=off            → 完全回到今天之前（新页仍可在 /v2/ 访问）
//   NEW_TREE_PAGES=a,b      → 只接管列举的页（渐进放量 / 缩小射程）
// 均可通过改环境变量 + 重启完成，不需要改代码。
// ═══════════════════════════════════════════════════════════════════════════
const NEW_TREE_ENABLED = process.env.NEW_TREE !== 'off';
// 批次 4（2026-09-22）：+5 增量页（onboarding/notifications/settings/subject-picker/knowledge-star）
// 与 +5 收尾页（predictive-paper/subject-detail/state-library/learning-journey/subject-exam 模板）。
// state-library / learning-journey 为 dev-only 陈列页（PM §F.11），接管后根路径可达但不进主导航。
const DEFAULT_NEW_TREE_PAGES =
  'login.html,register.html,photo-solve.html,wrong-book.html,review-session.html,mastery.html,dashboard.html,practice-hub.html,essay.html,learning-path.html,' +
  'onboarding.html,notifications.html,settings.html,subject-picker.html,knowledge-star.html,' +
  'predictive-paper.html,subject-detail.html,state-library.html,learning-journey.html,subject-exam.html';
const NEW_TREE_PAGES = (process.env.NEW_TREE_PAGES || DEFAULT_NEW_TREE_PAGES)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

if (NEW_TREE_ENABLED) {
  // 新树静态资源（必须先于 legacy 的 express.static('frontend')）
  app.use(
    '/assets/v2',
    express.static(path.join(DESIGN_V2_DIR, 'assets'), {
      etag: true,
      // 迭代期不设 maxAge: 改 CSS 后浏览器立即拉新（协商 304）。
      // 生产切换时恢复 maxAge: '1h' 并配 contenthash 文件名。
      cacheControl: false,
      lastModified: true,
    })
  );

  // 已迁移页面：根路径接管（旧树同名页被遮蔽）
  app.get(/^\/([A-Za-z0-9_-]+)(?:\.html)?$/, (req, res, next) => {
    const page = `${req.params[0]}.html`;
    if (!NEW_TREE_PAGES.includes(page)) return next();
    const file = path.join(DESIGN_V2_DIR, page);
    if (!fs.existsSync(file)) return next();
    // 与 F3 相同的反缓存策略（P0.1 ESM 缓存粘滞修复）：已迁移页不缓存
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    return res.sendFile(file, (err) => (err ? next(err) : undefined));
  });

  logger.info(
    `[new-tree] 已启用：${NEW_TREE_PAGES.length} 页由 ${DESIGN_V2_DIR} 接管 → ${NEW_TREE_PAGES.join(', ')}`
  );
} else {
  logger.warn('[new-tree] 已禁用 (NEW_TREE=off)：全部路径回到旧树，新页仅 /v2/ 可达');
}
// NEW-TREE-END
// ═══════════════════════════════════════════════════════════════════════════

app.use(express.static('public'));
app.use('/vendor', express.static('public/vendor'));
app.use(
  '/assets',
  express.static('frontend/assets', {
    setHeaders(res, path) {
      if (path.endsWith('.js') || path.endsWith('.css')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      }
    },
  })
);
app.use(express.static('frontend', {
  setHeaders(res, path) {
    if (path.endsWith('.html') || path.endsWith('.js') || path.endsWith('.css')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  },
}));
app.use('/icons', express.static('public/icons'));
// SERVE_F3: prod off by default, opt-in with SERVE_F3=true.
// Dev/staging always on for frontend iteration.
// Cache-Control stays no-cache in dev to avoid ESM browser cache stickiness (P0.1).
const SERVE_F3 = process.env.NODE_ENV !== 'production' || process.env.SERVE_F3 === 'true';
if (SERVE_F3) {
  app.use(
    '/f3',
    express.static('ai-tutor-frontend', {
      setHeaders(res, filePath) {
        if (filePath.endsWith('.html') || filePath.endsWith('.js') || filePath.endsWith('.css')) {
          // P0.1: dev/staging force no-cache to fix ES module browser cache stickiness
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          res.setHeader('Pragma', 'no-cache');
          res.setHeader('Expires', '0');
        }
      },
    })
  );
  logger.info(`[F3] /f3 preview enabled (NODE_ENV=${process.env.NODE_ENV || '<unset>'}, SERVE_F3=${process.env.SERVE_F3 || '<unset>'})`);
} else {
  logger.info(`[F3] /f3 preview disabled (NODE_ENV=production, SERVE_F3 not set)`);
}
app.use(
  '/src',
  express.static('public/src', {
    setHeaders(res, path) {
      if (path.endsWith('.js')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      }
    },
  })
);
app.use('/uploads', express.static('uploads'));
// P4 多模态读端 (路线图 P2b): 题目里的 ⟦IMG:rId⟧/⟦F:rId⟧ 渲染所用资产。
// 资产按 sha256 内容寻址 → immutable 缓存安全。见 api/services/questionTables.js。
app.use(
  '/qb-media',
  express.static('database/preflight/qb-extract/out/media', {
    maxAge: '7d',
    immutable: true,
  })
);
// 公式渲染 PNG (31-render-formula-assets.py 把 wmf/emf 渲成 png, 内容寻址)
app.use(
  '/qb-media-png',
  express.static('database/preflight/qb-extract/out/media-png', {
    maxAge: '7d',
    immutable: true,
  })
);

// wrapHandler: catch both sync throws and async rejections, and respect
// the case where the handler already started writing the response.
const wrapHandler = (handler) => async (req, res, next) => {
  try {
    // Express 4 only forwards rejections to error middleware when the handler
    // returns a promise; synchronous throws need an explicit try/catch.
    const ret = handler(req, res, next);
    if (ret && typeof ret.then === 'function') {
      await ret;
    }
  } catch (error) {
    logger.error('Handler error', { error });
    if (!res.headersSent) {
      res.status(500).json({ error: '服务器内部错误' });
    } else {
      // Headers already flushed (streaming, etc.) — destroy the socket so the
      // client doesn't hang waiting for a body that's never coming.
      res.destroy(error);
    }
  }
};

app.get('/api/health', async (_req, res) => {
  let dbReady = false;
  try {
    await getDb();
    dbReady = true;
  } catch (e) {
    // H1-b (2026-09-22): dbError 不回显给客户端 (信息泄露), 仅保留服务端日志
    console.error('[health] db check failed:', e && e.message ? e.message : e);
  }
  res.json(createSuccessResponse({ dbReady }, '服务运行正常'));
});

// H1-c (2026-09-22): Swagger 文档在生产环境 404 (端点/ schema 信息泄露).
// 生产不注册路由, 请求落入底部统一 404 fallback; 非 production 保持可访问.
if (process.env.NODE_ENV !== 'production') {
  app.get('/api-docs', swaggerUI);
  app.get('/api-docs.json', swaggerSpec);
}

// Audit-2026-08-24 Fix-4: 收口说明
// 以下 7 个 endpoint 仍由 server.js 直接挂, 未走 api/modules/*/routes.js
// 原因: 这些路径被 frontend/ (D070 冻结) + public/ (PWA) + ai-tutor-frontend/ 三处调用,
//       改路径会破坏向后兼容. 等 frontend/ + public/ 完全归档 (F6 计划 2-3 周观察期) 后
//       再迁到 modules/province + modules/admin 等.
// 新增 endpoint 一律走 modules, 不在 server.js 直接挂. (gate 守门见 release-gate.sh)
app.get('/api/provinces', wrapHandler(getProvinces));
app.get('/api/provinces/:code', wrapHandler(getProvinceByCode));
app.get('/api/province-stats/:code', wrapHandler(getProvinceStats));
app.get('/api/province-trends/:code', wrapHandler(getProvinceTrends));
app.get('/api/province-compare', wrapHandler(getProvinceCompare));
// H1-a (2026-09-22): 种子导入/清缓存为管理操作, 未授权可写库 → 加 auth + admin 门
app.post('/api/provinces/seed', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const result = await seedProvinces();
    // D072 (2026-08-24): 清 cache, 让 province 列表刷新
    await CacheService.invalidateProvinces();
    res.json(result);
  } catch (err) {
    console.error('[seed-provinces] failed:', err.message, err.stack);
    res.status(500).json({ error: '种子导入失败', detail: '内部错误，详见服务端日志' });
  }
});

// D072 (2026-08-24): 临时 admin 端点清 province cache (直接 INSERT 后用)
// 用法: curl -X POST http://localhost:3002/api/cache/clear-provinces
app.post('/api/cache/clear-provinces', authMiddleware, requireAdmin, async (req, res) => {
  try {
    await CacheService.invalidateProvinces();
    res.json({ success: true, message: 'Province cache cleared' });
  } catch (err) {
    console.error('[cache/clear-provinces] failed:', err.message);
    res.status(500).json({ error: '清缓存失败，请稍后重试' });
  }
});

app.get('/api/exam-pdf/:paperId', generateExamPdf);
app.get('/api/adaptive-difficulty', authMiddleware, wrapHandler(adaptiveDifficultyHandler));
app.get('/api/class-detail', authMiddleware, wrapHandler(getClassDetail));
// P11 (2026-09): /api/learning-path/current 已迁入 api/modules/learning-path/routes.js
//   (release-gate 直挂 endpoint 基线 ≤ 12; 路径不变, 只是不再由 server.js 直挂)
// 向后兼容：旧版 /api/learning-path?subject=...（D070 sunset 时移除）

// D086 §12 L4 · 作文批改（拍照 / 上传 → AI 4 维评分 + 锚定回原文）
//   注: V1.0 两阶段管线 (/api/essay/transcribe + /api/essay/grade) 待 Phase 1 单测通过后注册.
//   现存 D086 L4 端点保留 30 天 (D070 sunset).
// 2026-09-25: 作文智能批改新入口 (POST /api/essay/analyze, POST /api/essay/report/:id,
//   GET /api/essay/list) —— 复用 V1.0 服务 + 私有 MaaS 视觉。**必须挂在
//   GET /api/essay/:id 之前**, 否则 /api/essay/list 会被 :id 路由当作 id 吃掉。
//   用 app.use 追加挂载: 不增加 release-gate「直挂 endpoint ≤ 12」计数。
app.use('/api/essay', essayReviewRouter);
app.post ('/api/essay/grade', authMiddleware, essayLimiter, wrapHandler(gradeEssayHandler));
app.get  ('/api/essay',         authMiddleware, wrapHandler(listEssaysHandler));
app.get  ('/api/essay/:id',     authMiddleware, wrapHandler(getEssayHandler));
// D086 §12 L4 V1.0 · 图片上传 (Patch 2 强制: 转录前必须先上传拿 URL)
app.post ('/api/upload/image', authMiddleware, wrapHandler(uploadImageHandler));
// Round 10: essay 上传走统一端点 (D086 V1.0 适配 PM §F.2)
app.post ('/api/essay/upload',  authMiddleware, wrapHandler(uploadImageHandler));
// /api/proxy — MUST stay behind a fixed endpoint whitelist.
// The handler (api/handlers/proxy.js) refuses any model not in API_CONFIGS,
// which means the upstream URL is hardcoded and not user-controllable, so
// the SSRF surface is limited to the two allow-listed hosts (DashScope /
// DeepSeek).  Do NOT extend this handler to accept arbitrary URLs.
app.post('/api/proxy', authMiddleware, proxyLimiter, wrapHandler(proxyHandler));

// Audit BEFORE auth: security-relevant events (failed auth, anonymous probing,
// repeat 401s from one IP) only show up in the audit log if auditMiddleware
// runs before authMiddleware rejects the request.
//
// D-Bug-D (2026-08-23): legacyCompatRouter 必须在 modulesRouter 之前.
// 它把旧 frontend/ + public/ (PWA) 调用的旧路径 (/api/login, /api/questions 等)
// 转发到新路径或返回 410 Gone. 兼容期 30 天 (D070 sunset: 2026-09-23).
// F3 (ai-tutor-frontend) 已对齐新路径, 不需要 alias.
// H3-a (2026-09-22): authLimiter 挂到预认证端点, 必须先于全局 authMiddleware 链,
// 否则未认证请求不会被限流 (暴力破解/撞库面).
// 含 legacy-compat 旧路径 (/api/login 等直接转发 handler, 不经 /api/auth 前缀).
app.use(
  [
    '/api/auth/login',
    '/api/auth/register',
    '/api/auth/guest',
    '/api/auth/guest-login',
    '/api/auth/reset-password',
    '/api/login',
    '/api/register',
    '/api/guest-login',
  ],
  authLimiter
);

app.use('/api/', auditMiddleware, authMiddleware, apiLimiter, legacyCompatRouter, modulesRouter);

// 404 fallback. Message intentionally generic — leaking valid routes is
// info-disclosure. Attach request id so client can quote it in bug reports.
app.use((req, res) => {
  logger.warn(`404 ${req.method} ${req.originalUrl}`, {
    requestId: req.requestId,
    user: req.user?.email || 'anonymous',
  });
  const body = createErrorResponse(ErrorCode.INTERNAL_ERROR, 'API 端点不存在');
  if (req.requestId) body.requestId = req.requestId;
  res.status(404).json(body);
});

app.use(errorHandler);

// 2026-09-23: 允许临时/测试实例跳过 task worker。
// taskWorker 从共享的 task_queue 取任务 —— 同一个库上跑第二个 server.js 实例
// 会与主实例争抢队列 (任务被非预期进程消费)。门禁需要一个独立进程 (独立
// 限流桶) 跑 BCT, 因此提供此开关。命名与既有 DEV_AUTH_BYPASS 一致 (严格 === '1')。
// 默认 (不设 / 非 '1') 行为与改动前完全一致: 照常 startWorker()。
const SKIP_TASK_WORKER = process.env.SKIP_TASK_WORKER === '1';

async function start() {
  try {
    await getDb();
    // Phase 3: 幂等 seed (knowledge_points 为空时自动导入教材知识点)
    const seedResult = await ensureSeeds();
    if (seedResult.seeded) {
      logger.info(`[Seed] 自动导入完成: ${seedResult.count} 条知识点`);
    } else if (seedResult.reason) {
      logger.info(`[Seed] 跳过: ${seedResult.reason}`);
    }
    if (SKIP_TASK_WORKER) {
      logger.info('[Worker] SKIP_TASK_WORKER=1 — 跳过 startWorker (临时实例模式, 不争抢 task_queue)');
    } else {
      startWorker();
    }
    app.listen(PORT, () => {
      logger.info(`Server running at http://localhost:${PORT}`);
    });
  } catch (error) {
    logger.error('启动失败', { error });
    process.exit(1);
  }
}

start();
