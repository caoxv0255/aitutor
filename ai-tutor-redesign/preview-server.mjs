import { createServer } from 'http';
import { readFile, stat, readdir } from 'fs/promises';
import { join, extname, dirname } from 'path';

const PORT = 3001;
const PROJECT = 'd:\\Desktop\\aitutor\\ai-tutor-redesign';
const LIBRARY = 'd:\\Desktop\\aitutor\\.design_library\\ai-tutor';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

async function serveStatic(urlPath) {
  // Resolve /pages/*.html -> PROJECT/pages/
  // Resolve /assets/* -> PROJECT/assets/
  // Resolve /design_library/* -> LIBRARY/
  // Resolve direct HTML file requests (e.g., dashboard.html) -> PROJECT/pages/
  let filePath;
  if (urlPath.startsWith('/design_library/')) {
    filePath = join(LIBRARY, urlPath.slice('/design_library/'.length));
  } else if (urlPath === '/' || urlPath === '') {
    filePath = join(PROJECT, 'pages', 'login.html');
  } else if (urlPath.startsWith('/pages/')) {
    filePath = join(PROJECT, urlPath);
  } else if (urlPath.startsWith('/assets/')) {
    filePath = join(PROJECT, urlPath);
  } else if (urlPath.endsWith('.html')) {
    filePath = join(PROJECT, 'pages', urlPath);
  } else {
    filePath = join(PROJECT, urlPath);
  }

  try {
    const s = await stat(filePath);
    if (s.isDirectory()) {
      // Try index.html
      const indexPath = join(filePath, 'index.html');
      try { await stat(indexPath); filePath = indexPath; } catch { return null; }
    }
    const content = await readFile(filePath);
    const ext = extname(filePath);
    return { content, mime: MIME[ext] || 'application/octet-stream' };
  } catch {
    return null;
  }
}

const server = createServer(async (req, res) => {
  const urlPath = decodeURIComponent(req.url.split('?')[0]);
  const result = await serveStatic(urlPath);
  if (result) {
    res.writeHead(200, { 'Content-Type': result.mime });
    res.end(result.content);
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

server.listen(PORT, () => {
  console.log(`AI Tutor Preview Server running at http://localhost:${PORT}`);
  console.log(`  Pages: http://localhost:${PORT}/pages/home.html`);
  console.log(`  Dashboard: http://localhost:${PORT}/pages/dashboard.html`);
});
