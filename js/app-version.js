// Program Studio version display and one-time cache refresh.
(function(){
  if(window.__appVersionHelperV2)return;
  window.__appVersionHelperV2=true;
  const LOCAL_KEY='programStudioVersion';
  const RELOAD_KEY='programStudioVersionReloaded';
  let currentVersion='확인 중';
  function badge(mode){let el=document.getElementById('appVersionBadge');if(!el){el=document.createElement('div');el.id='appVersionBadge';el.style.cssText='position:fixed;right:10px;bottom:10px;z-index:99999;background:rgba(15,23,42,.92);color:#fff;border-radius:9px;padding:6px 9px;font:800 10px Pretendard,sans-serif;box-shadow:0 8px 24px rgba(15,23,42,.2);display:flex;gap:7px;align-items:center;';document.body.appendChild(el)}
    el.innerHTML=mode==='update'?`새 버전 ${currentVersion}<button id="appVersionReloadBtn" style="border:0;border-radius:6px;background:#72e5d7;color:#063b36;font-size:10px;font-weight:900;padding:4px 7px;cursor:pointer">바로 적용</button>`:`버전 ${currentVersion}`;
    const b=document.getElementById('appVersionReloadBtn');if(b)b.onclick=()=>refresh(true);
  }
  async function clear(){try{if('serviceWorker'in navigator){const regs=await navigator.serviceWorker.getRegistrations();for(const r of regs){if(r.active)r.active.postMessage({type:'CLEAR_CACHES'})}}}catch(_){}try{if('caches'in window){const keys=await caches.keys();await Promise.all(keys.map(k=>caches.delete(k)))}}catch(_){}}
  async function refresh(manual){await clear();if(manual)sessionStorage.setItem(RELOAD_KEY,currentVersion);const u=new URL(location.href);u.searchParams.set('appv',currentVersion);location.replace(u.toString())}
  async function check(){try{const r=await fetch('/version.json?t='+Date.now(),{cache:'no-store',headers:{'Cache-Control':'no-cache'}});const data=await r.json();currentVersion=String(data.version||'unknown');const prev=localStorage.getItem(LOCAL_KEY);const already=sessionStorage.getItem(RELOAD_KEY)===currentVersion;localStorage.setItem(LOCAL_KEY,currentVersion);if(prev&&prev!==currentVersion&&!already){badge('update');await refresh(false);return}badge('normal')}catch(e){currentVersion='확인 실패';badge('normal')}}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',check,{once:true});else check();
})();
