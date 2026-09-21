const CACHE_NAME = 'ai-tutor-v9';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/src/app.js',
  '/src/config/modelConfig.js',
  '/src/services/aiService.js',
  '/src/components/cropper.js',
  '/src/utils/context.js',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/vendor/marked.min.js',
  '/vendor/katex.min.js',
  '/vendor/katex.min.css',
  '/vendor/purify.min.js'
];

// 本 SW 注册在 '/sw.js'（见 public/index.html），作用域是根。
// 但根路径下同时服务 F3(/f3/)、legacy(/index.html …)、设计稿(/v2/)等多个前端，
// 过去「除 /api/ 与 /src/ 之外一律 cache-first」会把这些也缓存住，
// 使 server.js 为 F3 专设的 no-store 被绕过（审计 R1）。
// 修复方式：改为 allow-list —— 只接管 PWA 自己的资源，其余直接放行给网络。
const OWNED_EXACT = new Set([
  '/',
  '/index.html',
  '/mastery-dashboard.html',
  '/styles.css',
  '/manifest.json',
  '/favicon.ico'
]);
// /src/ 与 /vendor/ /icons/ 是 PWA 自身静态资源；/api/ 单独走 Network-First 但不写缓存。
// 这条 allow-list 之外的路径（F3 / legacy / /v2 / uploads …）一律不接管。
const OWNED_PREFIX = ['/src/', '/vendor/', '/icons/'];

// 挂载前缀（根部署为 '/'，子路径部署时为 '/<prefix>/'），用于把 pathname 归一到 PWA 视角
const SCOPE_BASE = new URL('./', self.location).pathname;

function handledPath(request) {
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return null; // 跨域（含 CDN）：不接管
  if (!url.pathname.startsWith(SCOPE_BASE)) return null; // 挂载前缀之外：不接管
  const path = url.pathname.slice(SCOPE_BASE.length - 1);
  if (path.startsWith('/api/')) return path;
  if (OWNED_EXACT.has(path) || OWNED_PREFIX.some((p) => path.startsWith(p))) return path;
  return null;
}

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return; // 非幂等请求一律走网络

  // 不在接管清单里（F3 / legacy / /v2 / uploads / 其他路径）→ 放行给网络
  const path = handledPath(request);
  if (path === null) return;

  // API 请求：Network-First（优先网络，失败时用缓存）
  if (path.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .catch(() => caches.match(request))
    );
    return;
  }

  // JS源码：Network-First（优先网络，确保最新代码；离线时用缓存兜底）
  if (path.startsWith('/src/')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // PWA 自身静态资源：Cache-First（优先缓存，没有则请求网络）
  event.respondWith(
    caches.match(request)
      .then(response => {
        if (response) return response;
        return fetch(request).then(networkResponse => {
          if (networkResponse.ok) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          }
          return networkResponse;
        });
      })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});
