(function(){
  if(window.__programStudioCacheBoot)return;
  window.__programStudioCacheBoot=true;
  const VERSION='2026.07.29.001';
  const CACHE_PREFIX='program-studio-';
  const RECOVERY_KEY='program-studio-sw-recovery-'+VERSION;
  const currentPath=location.pathname.replace(/\/+$/,'')||'/';
  const reveal=()=>{
    if(window.ProgramStudioBoot&&typeof window.ProgramStudioBoot.reveal==='function')window.ProgramStudioBoot.reveal();
    else document.documentElement.classList.remove('app-booting');
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
      const s=document.createElement('script');
      s.id=id;
      s.src=src;
      s.async=false;
      const done=()=>{s.dataset.loaded='true';resolve()};
      s.addEventListener('load',done,{once:true});
      s.addEventListener('error',done,{once:true});
      document.head.appendChild(s);
      setTimeout(done,1200);
    });
  }
  function isPath(...parts){return parts.some(path=>currentPath===path||currentPath.endsWith(path))}
  function isHome(){return currentPath==='/'||currentPath==='/index.html'}
  async function recoverServiceWorker(){
    let hadController=false;
    try{
      if('serviceWorker'in navigator){
        hadController=!!navigator.serviceWorker.controller;
        const registrations=typeof navigator.serviceWorker.getRegistrations==='function'
          ?await navigator.serviceWorker.getRegistrations()
          :[];
        await Promise.all(registrations.map(registration=>registration.unregister()));
      }
    }catch(error){
      console.warn('Service worker cleanup failed',error);
    }
    try{
      if('caches'in window){
        const keys=await caches.keys();
        await Promise.all(keys.filter(key=>key.startsWith(CACHE_PREFIX)).map(key=>caches.delete(key)));
      }
    }catch(error){
      console.warn('Program cache cleanup failed',error);
    }
    return hadController;
  }
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
  function scheduleCleanReload(hadController){
    if(!hadController)return;
    setTimeout(()=>location.reload(),120);
  }
  async function boot(){
    const helpersPromise=helpers();
    let recovered=false;
    try{recovered=localStorage.getItem(RECOVERY_KEY)==='done'}catch(_){}
    const recoveryPromise=recovered
      ?Promise.resolve(false)
      :recoverServiceWorker().then(hadController=>{
        try{localStorage.setItem(RECOVERY_KEY,'done')}catch(_){}
        return hadController;
      });
    try{
      await Promise.all([
        Promise.race([helpersPromise,delay(900)]),
        Promise.race([recoveryPromise,delay(1500)])
      ]);
      await nextPaint();
    }finally{
      reveal();
      recoveryPromise.then(scheduleCleanReload).catch(error=>console.warn('Recovery reload scheduling failed',error));
      Promise.allSettled([helpersPromise,recoveryPromise]);
    }
  }
  setTimeout(reveal,1800);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
