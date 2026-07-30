(function(){
  if(window.__programStudioRuntimeBoot)return;
  window.__programStudioRuntimeBoot=true;

  const VERSION='2026.07.30.001';
  const CACHE_PREFIX='program-studio-';
  const CLEANUP_KEY='program-studio-legacy-runtime-cleanup-'+VERSION;
  const currentPath=location.pathname.replace(/\/+$/,'')||'/';

  const reveal=()=>{
    if(window.ProgramStudioBoot&&typeof window.ProgramStudioBoot.reveal==='function'){
      window.ProgramStudioBoot.reveal();
    }else{
      document.documentElement.classList.remove('app-booting');
    }
  };
  const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const nextPaint=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));

  function load(id,src){
    const existing=document.getElementById(id);
    if(existing){
      if(existing.dataset.loaded==='true')return Promise.resolve();
      return new Promise(resolve=>{
        const done=()=>resolve();
        existing.addEventListener('load',done,{once:true});
        existing.addEventListener('error',done,{once:true});
        setTimeout(done,1200);
      });
    }
    return new Promise(resolve=>{
      const script=document.createElement('script');
      script.id=id;
      script.src=src;
      script.async=false;
      const done=()=>{script.dataset.loaded='true';resolve()};
      script.addEventListener('load',done,{once:true});
      script.addEventListener('error',done,{once:true});
      document.head.appendChild(script);
      setTimeout(done,1200);
    });
  }

  function isPath(...parts){
    return parts.some(path=>currentPath===path||currentPath.endsWith(path));
  }
  function isHome(){return currentPath==='/'||currentPath==='/index.html'}
  function isAuthPage(){return isPath('/login','/login.html')}

  async function cleanupLegacyRuntime(){
    try{
      if(localStorage.getItem(CLEANUP_KEY)==='done')return;
    }catch(_){}

    try{
      if('serviceWorker'in navigator&&typeof navigator.serviceWorker.getRegistrations==='function'){
        const registrations=await navigator.serviceWorker.getRegistrations();
        await Promise.allSettled(registrations.map(registration=>registration.unregister()));
      }
    }catch(error){
      console.warn('Legacy service worker cleanup failed',error);
    }

    try{
      if('caches'in window){
        const keys=await caches.keys();
        await Promise.allSettled(
          keys.filter(key=>key.startsWith(CACHE_PREFIX)).map(key=>caches.delete(key))
        );
      }
    }catch(error){
      console.warn('Legacy Program Studio cache cleanup failed',error);
    }

    try{localStorage.setItem(CLEANUP_KEY,'done')}catch(_){}
  }

  function helpers(){
    const tasks=[];
    if(!isAuthPage())tasks.push(load('appVersionHelperScript','/js/app-version.js?v='+VERSION));
    if(isHome()){
      tasks.push(load('homeHeroUpgradeScript','/js/home-hero-upgrade.js?v='+VERSION));
      tasks.push(load('homeHeaderFooterRefineScript','/js/home-header-footer-refine.js?v='+VERSION));
    }
    if(isPath('/tools/pdf-editor.html','/pdf-editor','/pdf-editor/index.html')){
      tasks.push(load('pdfEditorModuleLoaderScript','/js/pdf-editor/loader.js?v='+VERSION));
    }
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
    return Promise.allSettled(tasks);
  }

  async function boot(){
    const helpersPromise=helpers();
    cleanupLegacyRuntime().catch(error=>console.warn('Legacy runtime cleanup failed',error));
    try{
      await Promise.race([helpersPromise,delay(1000)]);
      await nextPaint();
    }finally{
      reveal();
      helpersPromise.catch(error=>console.warn('Runtime helper loading failed',error));
    }
  }

  setTimeout(reveal,1600);
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',boot,{once:true});
  }else{
    boot();
  }
})();
