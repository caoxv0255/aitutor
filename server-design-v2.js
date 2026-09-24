// server-design-v2.js
// Round 12+: 部署 docs/design/ (PM-BRIEF v2 22 页) 到独立端口 8081
// 与 F3 旧版 (3002) 共存, 共享 PostgreSQL 真实数据
// 风险: 0 (不动 F3 systemd 服务, 共享 DB 但不同 app 实例)
//
// 启动: node server-design-v2.js
// 访问: http://127.0.0.1:8081/

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import { promisify } from 'util';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT || '8081', 10);
const F3_BACKEND = process.env.F3_BACKEND || 'http://127.0.0.1:3002';
// 2026-09-21: 设计稿已从 docs/design/ 迁入 frontend-v2/ (受版本控制的新主树)
const DESIGN_DIR = path.join(__dirname, 'frontend-v2');

const app = express();

// 1. /api/* 代理到 F3 后端 (3002), 数据真实
app.use('/api', async (req, res) => {
  const target = F3_BACKEND + req.originalUrl;
  try {
    const headers = { ...req.headers };
    delete headers.host;
    const fetchFn = globalThis.fetch;
    const init = { method: req.method, headers };
    if (!['GET', 'HEAD'].includes(req.method)) {
      // 收集 body
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      if (chunks.length) init.body = Buffer.concat(chunks);
    }
    const r = await fetchFn(target, init);
    res.status(r.status);
    r.headers.forEach((v, k) => {
      if (!['transfer-encoding', 'content-encoding'].includes(k.toLowerCase())) {
        res.setHeader(k, v);
      }
    });
    const buf = Buffer.from(await r.arrayBuffer());
    res.end(buf);
  } catch (e) {
    console.error('[design-v2] F3 proxy failed:', e.message);
    res.status(502).json({
      success: false,
      message: 'F3 backend unavailable',
      error: '上游服务调用失败，详见服务端日志',
      hint: `请确认 ${F3_BACKEND} 在跑 (systemctl status uibe-tutor)`
    });
  }
});

// 2. /health (design v2 自检)
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Design V2 wrapper online',
    data: {
      service: 'design-v2',
      port: PORT,
      f3_backend: F3_BACKEND,
      design_dir: DESIGN_DIR,
      uptime: process.uptime()
    }
  });
});

// 3. / 静态服务 docs/design/ (PM-BRIEF v2 22 页)
app.use(express.static(DESIGN_DIR, {
  maxAge: '1d',
  etag: true,
  setHeaders: (res, path) => {
    if (path.endsWith('.html')) res.setHeader('Cache-Control', 'public, max-age=300');
  }
}));

// 3.5 根路径自动重定向到 subject-picker.html (PM-BRIEF v2 推荐首屏)
app.get('/', (req, res) => {
  // Round 18: 直接返 hero.html (避免 301 redirect 让 CF cache 老路径)
  res.sendFile(path.join(DESIGN_DIR, 'hero.html'), (err) => {
    if (err) {
      console.error('[design-v2] sendFile failed:', err.message);
      res.status(500).json({ success: false, message: '页面加载失败，请稍后重试' });
    }
  });
});

// 3.6 fallback 跳转: HTML 路径无 .html 后缀时自动补
app.get(/^\/[a-z0-9-]+$/, (req, res) => {
  const slug = req.path.slice(1);
  res.redirect(301, `/${slug}.html`);
});

// 4. 启动
const server = http.createServer(app);
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n[Design V2] Started on http://0.0.0.0:${PORT}`);
  console.log(`  - 静态页: ${DESIGN_DIR} (22 页 PM-BRIEF v2)`);
  console.log(`  - API 代理: ${F3_BACKEND}/api/*`);
  console.log(`  - 健康: http://127.0.0.1:${PORT}/health\n`);
});

process.on('SIGTERM', () => { server.close(); process.exit(0); });
process.on('SIGINT', () => { server.close(); process.exit(0); });
