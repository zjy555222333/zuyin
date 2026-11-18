/* 瓒冲嵃 路 鏃ュ父鐗堢绾垮澹炽€傚彧澶勭悊鏄庣‘鍒楀嚭鐨勬湰搴旂敤鏂囦欢銆?*/
const SCOPE = new URL('./', self.location.href);
const SCOPE_KEY = '@' + encodeURIComponent(SCOPE.pathname);
const CACHE = 'zuyin-daily-v5.0' + SCOPE_KEY;
const SHELL = [
  './', './index.html', './manifest.webmanifest',
  './icon-192.png', './icon-512.png',
  './assets/daily-core.js', './assets/daily-ui.js', './assets/daily.css', './assets/dancer-body.png',
  './assets/product-core.js', './assets/product-ui.js', './assets/product.css',
  './assets/studio-core.js', './assets/studio-ui.js', './assets/studio.css'
];
const URLS = new Set(SHELL.map(path => new URL(path, SCOPE).href));

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE &&
        (k === 'zuyin-v1' || (k.startsWith('zuyin-daily-') && k.endsWith(SCOPE_KEY))))
        .map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== SCOPE.origin || !URLS.has(url.href)) return;
  const isDoc = req.mode === 'navigate' || /\.html$/.test(url.pathname) || url.pathname === SCOPE.pathname;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    if (!isDoc) { const hit = await cache.match(req); if (hit) return hit; }
    try {
      const res = await fetch(req);
      if (res.ok) {
        try { await cache.put(req, res.clone()); } catch (ignore) { /* 缂撳瓨澶辫触涓嶅Θ纰嶆樉绀虹綉缁滅粨鏋溿€?*/ }
      }
      return res;
    } catch (error) {
      const hit = await cache.match(req);
      return hit || (isDoc && await cache.match(new URL('./index.html', SCOPE).href)) || Response.error();
    }
  })());
});
