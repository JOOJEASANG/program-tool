// Program Tool — auto-updating service worker + cover-spread AI prompt patch
const APP_VERSION = '2026-05-12-cover-spread-v2';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
    await self.clients.claim();
    const clients = await self.clients.matchAll({ type: 'window' });
    for (const client of clients) {
      client.postMessage({ type: 'SW_UPDATED', version: APP_VERSION });
    }
  })());
});

function shouldPatchCoverAiRequest(req) {
  const url = new URL(req.url);
  return req.method === 'POST' && url.origin === location.origin && url.pathname === '/api/ai/generate-bg';
}

function looksCoverRelated(text) {
  const s = String(text || '').toLowerCase();
  return ['표지', '책등', '앞표지', '뒷표지', '앞면', '뒷면', 'cover', 'spine', 'book cover'].some((word) => s.includes(word));
}

function buildCoverSpreadPrompt(prompt, body) {
  const metrics = body.cover_metrics || {};
  const paperW = metrics.paperW || metrics.paper_width || 'front/back cover width';
  const paperH = metrics.paperH || metrics.paper_height || 'cover height';
  const spine = metrics.spine || metrics.spineWidth || metrics.spine_width || 'spine width';
  const bleed = metrics.bleed || metrics.bleedMm || metrics.bleed_mm || 'bleed';

  return [
    'Create one continuous full book-cover spread background image.',
    'The layout must be: back cover on the left, spine in the center, front cover on the right.',
    'The back cover, spine, front cover, and bleed area must feel like one seamless connected scene, not separate panels.',
    'Generate background only. Do not include text, letters, logos, watermarks, labels, mockups, or page guides.',
    'Make the front cover visually focused, let the spine continue the same pattern, gradient, or texture, and let the back cover extend the same atmosphere with clean usable space.',
    'Keep important subjects and faces away from the spine area so they are not split by the book spine.',
    'Include enough bleed-safe continuation around the edges for trimming.',
    `Size context: front/back width ${paperW}, cover height ${paperH}, spine ${spine}, bleed ${bleed}.`,
    'Original user request:',
    String(prompt || '')
  ].join('\n');
}

async function patchCoverAiRequest(req) {
  try {
    const body = await req.clone().json();
    const prompt = body.prompt || '';
    if (!body.cover_spread && !looksCoverRelated(prompt)) return fetch(req);

    body.prompt = buildCoverSpreadPrompt(prompt, body);
    body.aspect = 'wide';
    body.cover_spread = true;

    const headers = new Headers(req.headers);
    headers.set('content-type', 'application/json');

    return fetch(new Request(req.url, {
      method: req.method,
      headers,
      body: JSON.stringify(body),
      mode: req.mode,
      credentials: req.credentials,
      cache: 'no-store',
      redirect: req.redirect,
      referrer: req.referrer,
      referrerPolicy: req.referrerPolicy,
      integrity: req.integrity,
      keepalive: req.keepalive
    }));
  } catch (_) {
    return fetch(req);
  }
}

self.addEventListener('fetch', (event) => {
  const req = event.request;

  if (shouldPatchCoverAiRequest(req)) {
    event.respondWith(patchCoverAiRequest(req));
    return;
  }

  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  const isHtml = req.mode === 'navigate' || req.headers.get('accept')?.includes('text/html');
  if (isHtml) {
    event.respondWith(fetch(req, { cache: 'no-store' }).catch(() => caches.match(req)));
  }
});
