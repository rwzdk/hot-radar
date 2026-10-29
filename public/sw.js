/* 热点雷达 Service Worker
 * 策略:
 * - 只处理同源 GET 请求;60s API / HN / OpenRouter 等跨域请求与封面图全部不拦;
 * - 页面导航 network-first(保证发版后拿到新 index.html),离线时回退缓存的壳;
 * - 同源静态资源(含带 hash 的产物、每日快照 JSON)stale-while-revalidate;
 * - 缓存名带注册时的 ?v= 版本(由构建注入),activate 时清理旧版本。
 */
const VERSION = new URLSearchParams(self.location.search).get('v') || 'dev';
const CACHE = `hotradar-shell-${VERSION}`;

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((n) => n.startsWith('hotradar-shell-') && n !== CACHE)
          .map((n) => caches.delete(n)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        try {
          const res = await fetch(req);
          if (res.ok) cache.put('index.html', res.clone());
          return res;
        } catch {
          return (
            (await cache.match('index.html')) ||
            (await cache.match('./')) ||
            Response.error()
          );
        }
      })(),
    );
    return;
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(req);
      const network = fetch(req)
        .then((res) => {
          if (res && res.ok) cache.put(req, res.clone());
          return res;
        })
        .catch(() => undefined);
      return cached || (await network) || Response.error();
    })(),
  );
});
