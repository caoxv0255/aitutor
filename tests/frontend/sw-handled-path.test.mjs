// sw.js 行为验证：不看源码文本，直接执行它的 fetch handler，看它对哪些请求调用了 respondWith
import fs from 'node:fs';
import vm from 'node:vm';

const src = fs.readFileSync('public/sw.js', 'utf8');

const handlers = {};
const store = new Map(); // cacheName -> Map(url -> Response)
let networkCalls = [];

const makeRes = (url) => ({ ok: true, url, clone() { return makeRes(url); } });

const caches = {
  async open(name) {
    if (!store.has(name)) store.set(name, new Map());
    return {
      async addAll(urls) { urls.forEach(u => store.get(name).set(u, makeRes(u))); },
      async put(req, res) { store.get(name).set(req.url, res); },
      async match(req) { return store.get(name).get(req.url) || undefined; }
    };
  },
  async match(req) { return undefined; },
  async keys() { return [...store.keys()]; },
  async delete(name) { return store.delete(name); }
};

const selfObj = {
  location: new URL('https://x.dev/sw.js'),
  addEventListener(type, fn) { handlers[type] = fn; },
  skipWaiting() {},
  clients: { claim() {} }
};

const ctx = vm.createContext({
  self: selfObj, caches,
  fetch: (req) => { networkCalls.push(req.url); return Promise.resolve(makeRes(req.url)); },
  URL, Promise, console, Map, Set, setTimeout
});
vm.runInContext(src, ctx);

// install：把 STATIC_ASSETS 预缓存到当前 CACHE_NAME
await new Promise(res => {
  handlers.install({
    waitUntil: (p) => p.then(res, res)
  });
});

const cases = [
  ['/', '接管'],
  ['/index.html', '接管'],
  ['/mastery-dashboard.html', '接管'],
  ['/styles.css', '接管'],
  ['/manifest.json', '接管'],
  ['/favicon.ico', '接管'],
  ['/src/app.js', '接管'],
  ['/vendor/katex.min.js', '接管'],
  ['/icons/icon-192x192.png', '接管'],
  ['/api/health', '接管'],
  ['/f3/pages/index.html', '放行'],
  ['/f3/pages/mastery.html', '放行'],
  ['/f3/assets/css/tokens.css', '放行'],
  ['/v2/hero.html', '放行'],
  ['/login.html', '放行'],
  ['/dashboard.html', '放行'],
  ['/uploads/a.png', '放行']
];

let bad = 0;
console.log('路径'.padEnd(30) + '结果');
console.log('-'.repeat(46));
for (const [p, want] of cases) {
  let taken = false;
  const evt = {
    request: { url: 'https://x.dev' + p, method: 'GET' },
    respondWith() { taken = true; }
  };
  handlers.fetch(evt);
  const got = taken ? '接管' : '放行';
  const ok = got === want;
  if (!ok) bad++;
  console.log((ok ? 'OK   ' : 'FAIL ') + p.padEnd(26) + got + (ok ? '' : '  ← 期望 ' + want));
}

// 非 GET 必须放行
let taken2 = false;
handlers.fetch({
  request: { url: 'https://x.dev/api/submit', method: 'POST' },
  respondWith() { taken2 = true; }
});
console.log((taken2 ? 'FAIL ' : 'OK   ') + 'POST /api/submit'.padEnd(26) + (taken2 ? '接管' : '放行'));
if (taken2) bad++;

// 跨域必须放行（旧代码会 cache-first 住 CDN 请求）
let taken3 = false;
handlers.fetch({
  request: { url: 'https://cdn.jsdelivr.net/npm/x.js', method: 'GET' },
  respondWith() { taken3 = true; }
});
console.log((taken3 ? 'FAIL ' : 'OK   ') + 'cdn.jsdelivr.net'.padEnd(26) + (taken3 ? '接管' : '放行'));
if (taken3) bad++;

console.log('-'.repeat(46));
console.log(bad ? `❌ ${bad} 条不符预期` : '✅ 全部符合预期');
process.exit(bad ? 1 : 0);
