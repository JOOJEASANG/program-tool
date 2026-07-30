const APP_VERSION='2026.07.30.002';
const CACHE_PREFIX='program-studio-';

async function purgeProgramStudioCaches(){
  if(typeof caches==='undefined')return;
  const keys=await caches.keys();
  await Promise.all(
    keys.filter(key=>key.startsWith(CACHE_PREFIX)).map(key=>caches.delete(key))
  );
}

async function notifyClients(){
  const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  clients.forEach(client=>client.postMessage({type:'SERVICE_WORKER_RECOVERY',version:APP_VERSION}));
}

async function disableServiceWorker(){
  await purgeProgramStudioCaches();
  await notifyClients();
  await self.registration.unregister();
}

self.addEventListener('install',event=>{
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    await self.clients.claim();
    await disableServiceWorker();
  })());
});

self.addEventListener('message',event=>{
  if(!event.data)return;
  if(event.data.type==='SKIP_WAITING'){
    event.waitUntil(self.skipWaiting());
    return;
  }
  if(event.data.type==='CLEAR_CACHES'||event.data.type==='DISABLE_SERVICE_WORKER'){
    event.waitUntil(disableServiceWorker());
  }
});
