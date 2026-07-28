const APP_VERSION='2026.07.28.001';
const CACHE_PREFIX='program-studio-';
const CACHE_NAME=CACHE_PREFIX+APP_VERSION;
const CORE_ASSETS=[
  '/',
  '/index.html',
  '/login.html',
  '/approval-waiting.html',
  '/tools/pdf-editor.html',
  '/pdf-editor/index.html',
  '/tools/preflight.html',
  '/tools/perfect-binding-cover.html',
  '/vendor/pdf.min.js',
  '/vendor/pdf.worker.min.js',
  '/vendor/jspdf.umd.min.js',
  '/version.json',
  '/js/firebase-config.js',
  '/js/api.js',
  '/js/sw-register.js',
  '/js/app-version.js',
  '/js/program-paths.js',
  '/js/app-boot-guard.js'
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
  await Promise.all(CORE_ASSETS.map(async asset=>{
    const response=await fetch(asset,{cache:'reload'});
    if(!response.ok)throw new Error(`Core asset preload failed: ${asset} (${response.status})`);
    await cache.put(asset,response.clone());
  }));
}

async function matchNavigationFallback(request){
  const url=new URL(request.url);
  const candidates=[request,url.pathname];
  if(url.pathname.endsWith('/'))candidates.push(`${url.pathname}index.html`);
  else if(!/\.[^/]+$/.test(url.pathname))candidates.push(`${url.pathname}.html`,`${url.pathname}/index.html`);
  for(const candidate of candidates){
    const cached=await caches.match(candidate);
    if(cached)return cached;
  }
  if(url.pathname==='/'||url.pathname==='/index.html'){
    const home=await caches.match('/index.html');
    if(home)return home;
  }
  return new Response(
    '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>연결 확인</title><style>body{font-family:system-ui,sans-serif;padding:32px;line-height:1.6;color:#172033}main{max-width:560px;margin:10vh auto}button{padding:10px 16px;border:0;border-radius:10px;background:#1769e0;color:#fff;font-weight:700}</style><main><h1>프로그램을 불러오지 못했습니다.</h1><p>인터넷 연결을 확인한 뒤 다시 시도해 주세요. 다른 페이지로 임의 이동하지 않도록 안전하게 중단했습니다.</p><button onclick="location.reload()">다시 시도</button></main>',
    {status:503,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}}
  );
}

self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    await precacheCore();
    await self.skipWaiting();
  })());
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
      await Promise.all(keys.filter(key=>key.startsWith(CACHE_PREFIX)).map(key=>caches.delete(key)));
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
          return response;
        }
        const fallback=await matchNavigationFallback(request);
        return fallback.status===503?response:fallback;
      }catch(_){
        return matchNavigationFallback(request);
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
