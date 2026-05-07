// Program Tool — minimal auto-updating service worker
// Goal: never serve stale HTML/JS/CSS. New SW takes over immediately.
const APP_VERSION = self.__APP_VERSION__ || Date.now().toString();

self.addEventListener('install', (event) => {
  // Activate the new SW as soon as it's installed (don't wait for tabs to close)
  self.skipWaiting();
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // Clear ALL caches owned by this origin so nothing stale survives
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
    // Take control of any open tabs immediately
    await self.clients.claim();
    // Notify clients that a new version is active
    const clients = await self.clients.matchAll({ type: 'window' });
    for (const client of clients) {
      client.postMessage({ type: 'SW_UPDATED', version: APP_VERSION });
    }
  })());
});

// Network-first for navigation/HTML so users always get the freshest page
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  const isHtml =
    req.mode === 'navigate' ||
    req.headers.get('accept')?.includes('text/html');

  if (isHtml) {
    event.respondWith(
      fetch(req, { cache: 'no-store' }).catch(() => caches.match(req))
    );
  }
  // Other assets: let the browser/Hosting Cache-Control rules apply
});
