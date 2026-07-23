const APP_VERSION='2026.07.24.001';
const CACHE_PREFIX='program-studio-';
const CACHE_NAME=CACHE_PREFIX+APP_VERSION;
async function clearOldCaches(){const keys=await caches.keys();await Promise.all(keys.filter(k=>k.startsWith(CACHE_PREFIX)&&k!==CACHE_NAME).map(k=>caches.delete(k)))}
self.addEventListener('install',event=>{self.skipWaiting();event.waitUntil(clearOldCaches())});
self.addEventListener('activate',event=>{event.waitUntil((async()=>{await clearOldCaches();await self.clients.claim();const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});clients.forEach(c=>c.postMessage({type:'APP_VERSION',version:APP_VERSION}))})())});
self.addEventListener('message',event=>{if(!event.data)return;if(event.data.type==='SKIP_WAITING')self.skipWaiting();if(event.data.type==='CLEAR_CACHES')event.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.map(k=>caches.delete(k)))})())});
self.addEventListener('fetch',event=>{const req=event.request;if(req.method!=='GET')return;const url=new URL(req.url);if(url.origin!==self.location.origin)return;
  event.respondWith((async()=>{try{return await fetch(req,{cache:'no-store'})}catch(error){const cached=await caches.match(req);if(cached)return cached;throw error}})());
});
