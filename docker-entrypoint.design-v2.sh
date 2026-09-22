#!/bin/sh
# docker-entrypoint.design-v2.sh
# 在 Express server.js 之上加一层: 优先 serve docs/design/ 静态文件, 然后 fallback 到原 server.js

set -e

# 改写 server.js: 优先 serve /docs/design/ 静态文件
# 这个 entry 实际不修改 server.js, 而是启动一个轻量 wrapper

cat > /tmp/design-v2-wrapper.js << 'WRAPPER_EOF'
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

// 1. 优先 serve docs/design/ (PM-BRIEF v2 22 页)
const designDir = process.env.DESIGN_V2_DIR || '/app/docs/design';
app.use(express.static(designDir, { maxAge: '1d', etag: true }));

// 2. /v2/* 路径别名 (方便从 aitutor.uibe.online/v2/ 访问)
app.use('/v2', express.static(designDir, { maxAge: '1d', etag: true }));

// 3. /api/* 转发到原 server.js (F3 后端逻辑, 共享数据库)
import('./server.js').then(({ default: f3App }) => {
  // 已在 3002 跑, 我们用 mount 方式
}).catch(err => console.error('F3 load error:', err.message));

// 简单代理 /api/* 到 3002 (避免双进程, 这里直连 DB via F3)
app.use('/api', async (req, res, next) => {
  // 简化方案: 直接 200 + mock, 真实生产应 proxy_pass
  // 但这个 v2 主要是设计验证, 后端调用会走原 F3 服务 (3002)
  const target = `http://127.0.0.1:3002${req.originalUrl}`;
  try {
    const headers = { ...req.headers };
    delete headers.host;
    const r = await fetch(target, { method: req.method, headers, body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined });
    res.status(r.status);
    r.headers.forEach((v, k) => res.setHeader(k, v));
    const buf = await r.arrayBuffer();
    res.end(Buffer.from(buf));
  } catch (e) {
    res.status(502).json({ success: false, message: 'F3 backend unavailable', error: e.message });
  }
});

app.get('/api/health', (req, res) => res.json({
  success: true,
  message: 'Design V2 service (port 3001) — wraps F3 backend',
  data: { design_v2: true, backend_proxy: 'http://127.0.0.1:3002', design_dir: designDir }
}));

const server = createServer(app);
server.listen(PORT, '0.0.0.0', () => {
  console.log(`[Design V2] http://0.0.0.0:${PORT} → ${designDir}`);
  console.log(`[Design V2] API proxy → http://127.0.0.1:3002`);
});
WRAPPER_EOF

exec node /tmp/design-v2-wrapper.js
