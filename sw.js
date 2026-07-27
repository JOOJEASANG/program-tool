const APP_VERSION='2026.07.27.005';
const CACHE_PREFIX='program-studio-';
const CACHE_NAME=CACHE_PREFIX+APP_VERSION;
const CORE_ASSETS=[
  '/',
  '/index.html',
  '/login.html',
  '/approval-waiting.html',
  '/version.json',
  '/js/firebase-config.js',
  '/js/api.js',
  '/js/sw-register.js',
  '/js/app-version.js',
  '/js/program-paths.js'
];

async function clearOldCaches(){
  const keys=await caches.keys();
  await Promise.all(
    keys.filter(key=>key.startsWith(CACHE_PREFIX)&&key!==CACHE_NAME)
      .map(key=>caches.delete(key))
  );
}

async function precacheCore(){
  const cache=await caches.open(CACHE_NAME);
  await Promise.allSettled(
    CORE_ASSETS.map(async asset=>{
      const response=await fetch(asset,{cache:'reload'});
      if(response.ok)await cache.put(asset,response.clone());
    })
  );
}

self.addEventListener('install',event=>{
  self.skipWaiting();
  event.waitUntil((async()=>{await clearOldCaches();await precacheCore()})());
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    await clearOldCaches();
    await self.clients.claim();
    const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    clients.forEach(client=>client.postMessage({type:'APP_VERSION',version:APP_VERSION}));
  })());
});

self.addEventListener('message',event=>{
  if(!event.data)return;
  if(event.data.type==='SKIP_WAITING')self.skipWaiting();
  if(event.data.type==='CLEAR_CACHES'){
    event.waitUntil((async()=>{
      const keys=await caches.keys();
      await Promise.all(keys.map(key=>caches.delete(key)));
      await precacheCore();
    })());
  }
});

self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin||url.pathname.startsWith('/api/'))return;

  if(request.mode==='navigate'){
    event.respondWith((async()=>{
      try{
        const response=await fetch(request,{cache:'no-store'});
        if(response.ok){
          const cache=await caches.open(CACHE_NAME);
          await cache.put(request,response.clone());
        }
        return response;
      }catch(error){
        return (await caches.match(request))||(await caches.match('/index.html'))||Promise.reject(error);
      }
    })());
    return;
  }

  event.respondWith((async()=>{
    const cached=await caches.match(request);
    const network=fetch(request,{cache:'no-cache'}).then(async response=>{
      if(response.ok){
        const cache=await caches.open(CACHE_NAME);
        await cache.put(request,response.clone());
      }
      return response;
    });
    if(cached){
      event.waitUntil(network.catch(()=>{}));
      return cached;
    }
    return network;
  })());
});
