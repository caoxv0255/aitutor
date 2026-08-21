import { createServer } from 'http';
import { readFile, stat } from 'fs/promises';
import { join, extname } from 'path';

const PORT = 3000;
const BASE = 'd:\\Desktop\\aitutor\\frontend';
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
};

async function serve(urlPath) {
  let filePath = join(BASE, urlPath === '/' ? 'redesign/index.html' : urlPath);
  try {
    const s = await stat(filePath);
    if (s.isDirectory()) filePath = join(filePath, 'index.html');
    const content = await readFile(filePath);
    return { content, mime: MIME[extname(filePath)] || 'application/octet-stream' };
  } catch { return null; }
}

createServer(async (req, res) => {
  const r = await serve(decodeURIComponent(req.url.split('?')[0]));
  if (r) { res.writeHead(200, { 'Content-Type': r.mime, 'Cache-Control': 'no-cache' }); res.end(r.content); }
  else { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('404 Not Found: ' + req.url); }
}).listen(PORT, () => {
  console.log('AI Tutor Frontend Server: http://localhost:' + PORT);
  console.log('  Redesign: http://localhost:' + PORT + '/redesign/');
  console.log('  Legacy:   http://localhost:' + PORT + '/index.html');
});
