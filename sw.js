const APP_VERSION = '2026-05-18-per-file-nup-v6';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
    await self.clients.claim();
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clients) {
      client.postMessage({ type: 'APP_VERSION', version: APP_VERSION });
    }
  })());
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data && event.data.type === 'CLEAR_CACHES') {
    event.waitUntil((async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    })());
  }
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  // Network-first/no-store for app shell and source files so deployments are visible immediately.
  const accept = req.headers.get('accept') || '';
  const isHtml = req.mode === 'navigate' || accept.includes('text/html');
  const isSource = /\.(js|css|json)$/i.test(url.pathname) || url.pathname === '/' || url.pathname.endsWith('.html');
  if (isHtml || isSource) {
    event.respondWith(fetch(req, { cache: 'no-store' }).catch(() => fetch(req)));
  }
});
