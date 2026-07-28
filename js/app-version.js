// Program Studio silent version check and one-time cache refresh.
(function(){
  if(window.__appVersionHelperV3)return;
  window.__appVersionHelperV3=true;
  if(/^\/login(?:\.html)?\/?$/.test(location.pathname))return;
  const LOCAL_KEY='programStudioVersion';
  const RELOAD_KEY='programStudioVersionReloaded';
  let currentVersion='';

  async function clear(){
    try{
      if('serviceWorker'in navigator){
        const regs=await navigator.serviceWorker.getRegistrations();
        for(const r of regs){if(r.active)r.active.postMessage({type:'CLEAR_CACHES'})}
      }
    }catch(_){}
    try{
      if('caches'in window){
        const keys=await caches.keys();
        await Promise.all(keys.map(k=>caches.delete(k)));
      }
    }catch(_){}
  }

  async function refresh(){
    await clear();
    sessionStorage.setItem(RELOAD_KEY,currentVersion);
    const url=new URL(location.href);
    url.searchParams.set('appv',currentVersion);
    location.replace(url.toString());
  }

  async function check(){
    try{
      const response=await fetch('/version.json?t='+Date.now(),{cache:'no-store',headers:{'Cache-Control':'no-cache'}});
      const data=await response.json();
      currentVersion=String(data.version||'unknown');
      const previous=localStorage.getItem(LOCAL_KEY);
      const alreadyReloaded=sessionStorage.getItem(RELOAD_KEY)===currentVersion;
      localStorage.setItem(LOCAL_KEY,currentVersion);
      if(previous&&previous!==currentVersion&&!alreadyReloaded)await refresh();
    }catch(_){}
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',check,{once:true});else check();
})();
