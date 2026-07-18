const APP_VERSION = '2026-07-18-access-regression-v2';
const CACHE_PREFIX = 'program-tool-';
const STATIC_CACHE = CACHE_PREFIX + APP_VERSION;
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/login.html',
  '/js/firebase-config.js',
  '/js/sw-register.js',
  '/js/access-compat.js',
  '/version.json',
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil((async () => {
    const cache = await caches.open(STATIC_CACHE);
    await Promise.allSettled(CORE_ASSETS.map(asset => cache.add(new Request(asset, { cache: 'reload' }))));
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter(key => key.startsWith(CACHE_PREFIX) && key !== STATIC_CACHE)
      .map(key => caches.delete(key)));
    await self.clients.claim();
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    clients.forEach(client => client.postMessage({ type: 'APP_VERSION', version: APP_VERSION }));
  })());
});

self.addEventListener('message', event => {
  if (!event.data) return;
  if (event.data.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data.type === 'CLEAR_APP_CACHES') {
    event.waitUntil((async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter(key => key.startsWith(CACHE_PREFIX)).map(key => caches.delete(key)));
    })());
  }
});

async function networkFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  try {
    const response = await fetch(request, { cache: 'no-store' });
    if (response.ok) cache.put(request, response.clone()).catch(() => {});
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;
    if (request.mode === 'navigate') {
      const fallback = await cache.match('/index.html');
      if (fallback) return fallback;
    }
    throw error;
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  const networkPromise = fetch(request).then(response => {
    if (response.ok) cache.put(request, response.clone()).catch(() => {});
    return response;
  }).catch(() => null);

  if (cached) {
    networkPromise.catch(() => {});
    return cached;
  }
  const networkResponse = await networkPromise;
  return networkResponse || Response.error();
}

async function accessEndpointWithPreviewFallback(request, url) {
  try {
    const response = await fetch(request, { cache: 'no-store' });
    if (response.status !== 404 && response.status !== 405 && response.status < 500) return response;
  } catch (_) {}

  const programId = decodeURIComponent(url.pathname.slice('/api/access/'.length));
  const known = ['pdf-editor', 'preflight', 'perfect-binding-cover'].includes(programId);
  return new Response(JSON.stringify({
    programId,
    allowed: known,
    isAdmin: false,
    isPublic: known,
    isApproved: false,
    compatibilityMode: true,
  }), {
    status: known ? 200 : 404,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith('/api/access/')) {
    event.respondWith(accessEndpointWithPreviewFallback(request, url));
    return;
  }
  if (url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname === '/version.json') {
    event.respondWith(networkFirst(request));
    return;
  }
  event.respondWith(staleWhileRevalidate(request));
});