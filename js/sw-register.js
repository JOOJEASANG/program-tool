(function(){
  if(window.__programStudioCacheBoot)return;
  window.__programStudioCacheBoot=true;
  const VERSION='2026.07.27.004';
  const currentPath=location.pathname.replace(/\/+$/,'')||'/';
  const reveal=()=>{
    if(window.ProgramStudioBoot&&typeof window.ProgramStudioBoot.reveal==='function')window.ProgramStudioBoot.reveal();
    else document.documentElement.classList.remove('app-booting');
  };
  const nextPaint=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  function load(id,src){
    const existing=document.getElementById(id);
    if(existing){
      if(existing.dataset.loaded==='true')return Promise.resolve();
      return new Promise(resolve=>{
        const done=()=>resolve();
        existing.addEventListener('load',done,{once:true});
        existing.addEventListener('error',done,{once:true});
        setTimeout(done,2500);
      });
    }
    return new Promise(resolve=>{
      const s=document.createElement('script');
      s.id=id;
      s.src=src;
      s.async=false;
      const done=()=>{s.dataset.loaded='true';resolve()};
      s.addEventListener('load',done,{once:true});
      s.addEventListener('error',done,{once:true});
      document.head.appendChild(s);
      setTimeout(done,2500);
    });
  }
  function isPath(...parts){return parts.some(path=>currentPath===path||currentPath.endsWith(path))}
  function isHome(){return currentPath==='/'||currentPath==='/index.html'}
  async function clearLegacyCaches(){try{if('caches'in window){const keys=await caches.keys();await Promise.all(keys.filter(k=>!k.includes(VERSION)).map(k=>caches.delete(k)))}}catch(_){} }
  async function register(){if(!('serviceWorker'in navigator))return;try{const reg=await navigator.serviceWorker.register('/sw.js?v='+encodeURIComponent(VERSION),{updateViaCache:'none'});await reg.update().catch(()=>{});if(reg.waiting)reg.waiting.postMessage({type:'SKIP_WAITING'})}catch(e){console.warn('Service worker registration failed',e)}}
  function helpers(){
    const tasks=[];
    tasks.push(load('siteWordingCleanupScript','/js/site-wording-cleanup.js?v='+VERSION));
    tasks.push(load('appVersionHelperScript','/js/app-version.js?v='+VERSION));
    tasks.push(load('programPathMapperScript','/js/program-paths.js?v='+VERSION));
    if(isHome()){
      tasks.push(load('homeCleanupScript','/js/home-cleanup.js?v='+VERSION));
      tasks.push(load('homeHeroUpgradeScript','/js/home-hero-upgrade.js?v='+VERSION));
      tasks.push(load('homeHeaderFooterRefineScript','/js/home-header-footer-refine.js?v='+VERSION));
    }
    if(isPath('/tools/pdf-editor.html','/pdf-editor','/pdf-editor/index.html'))tasks.push(load('pdfEditorModuleLoaderScript','/js/pdf-editor/loader.js?v='+VERSION));
    if(isPath('/tools/pdf-Checker.html','/tools/preflight.html','/pdf-preflight','/pdf-preflight/index.html')){
      tasks.push(load('pdfCheckerFinalGuardScript','/js/pdf-checker-final-guard.js?v='+VERSION));
      tasks.push(load('pdfPreflightPanelBalanceScript','/js/pdf-preflight-panel-balance.js?v='+VERSION));
    }
    if(isPath('/tools/perfect-binding-cover.html','/perfect-binding-cover','/perfect-binding-cover/index.html')){
      tasks.push(load('perfectBindingFineControlsScript','/js/perfect-binding-cover-fine-controls.js?v='+VERSION));
      tasks.push(load('coverTextZonesScriptV3','/js/cover-editor-text-zones-v2.js?v='+VERSION));
      tasks.push(load('coverTextUiRefineScriptV4','/js/cover-text-ui-refine.js?v='+VERSION));
      tasks.push(load('coverPreviewWorkspaceScriptV2','/js/cover-preview-workspace.js?v='+VERSION));
      tasks.push(load('coverProjectStateBridgeScriptV1','/js/cover-project-state-bridge.js?v='+VERSION));
      tasks.push(load('coverFloatingActionDockScriptV1','/js/cover-floating-action-dock.js?v='+VERSION));
    }
    return Promise.all(tasks);
  }
  async function boot(){
    try{
      await helpers();
      await nextPaint();
    }finally{
      reveal();
      Promise.allSettled([clearLegacyCaches(),register()]);
    }
  }
  setTimeout(reveal,5000);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
