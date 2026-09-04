(function(){
  'use strict';
  if(window.__programStudioRuntimeBoot)return;
  window.__programStudioRuntimeBoot=true;

  // Historical filename: this module owns shared runtime loading and retired
  // service-worker cleanup. It intentionally does not register a worker.
  const VERSION='2026.09.03.001';
  const CACHE_PREFIX='program-studio-';
  const CLEANUP_KEY='program-studio-legacy-runtime-cleanup-'+VERSION;
  const SCRIPT_TIMEOUT_MS=8000;
  const currentPath=location.pathname.replace(/\/+$/,'')||'/';
  const loadPromises=new Map();

  function isPath(...parts){return parts.some(path=>currentPath===path||currentPath.endsWith(path));}
  function isAuthPage(){return isPath('/login','/login.html')}
  function isProtectedRuntimePage(){
    return isPath(
      '/print-checker','/print-checker/index.html',
      '/tools/pdf-editor.html','/pdf-editor','/pdf-editor/index.html',
      '/tools/preflight.html','/tools/pdf-Checker.html','/pdf-preflight','/pdf-preflight/index.html',
      '/tools/perfect-binding-cover.html','/perfect-binding-cover','/perfect-binding-cover/index.html'
    );
  }

  const reveal=()=>{
    if(isProtectedRuntimePage())return false;
    if(window.ProgramStudioBoot&&typeof window.ProgramStudioBoot.reveal==='function')window.ProgramStudioBoot.reveal();
    else{
      document.documentElement.classList.remove('app-booting');
      document.documentElement.dataset.appReady='true';
    }
    return true;
  };
  const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const nextPaint=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));

  function runtimeScriptResult(id,src,status){
    const node=document.getElementById(id);
    if(node){
      if(status==='loaded'){node.dataset.loaded='true';delete node.dataset.failed;}
      else node.dataset.failed=status;
    }
    try{window.dispatchEvent(new CustomEvent('programstudio:runtime-script-result',{detail:{id,src,status}}));}catch(_){}
  }
  function runtimeLoadError(id,src,status){
    const error=new Error(`Runtime script ${status}: ${id}`);
    error.name='ProgramStudioRuntimeLoadError';error.scriptId=id;error.scriptSrc=src;error.status=status;
    return error;
  }
  function load(id,src){
    let existing=document.getElementById(id);
    if(existing&&existing.dataset.loaded==='true')return Promise.resolve({id,src,status:'loaded'});
    if(loadPromises.has(id))return loadPromises.get(id);
    if(existing&&existing.dataset.failed){existing.remove();existing=null;}
    const promise=new Promise((resolve,reject)=>{
      const script=existing||document.createElement('script');
      if(!existing){script.id=id;script.src=src;script.async=false;}
      let settled=false,timer=null;
      const cleanup=()=>{if(timer)clearTimeout(timer);script.removeEventListener('load',onLoad);script.removeEventListener('error',onError);};
      const done=status=>{
        if(settled)return;settled=true;cleanup();runtimeScriptResult(id,src,status);
        if(status==='loaded'){resolve({id,src,status});return;}
        if(script.isConnected&&script.dataset.loaded!=='true')script.remove();
        reject(runtimeLoadError(id,src,status));
      };
      const onLoad=()=>done('loaded');
      const onError=()=>done('error');
      script.addEventListener('load',onLoad,{once:true});
      script.addEventListener('error',onError,{once:true});
      if(!existing)document.head.appendChild(script);
      timer=setTimeout(()=>done('timeout'),SCRIPT_TIMEOUT_MS);
    });
    const tracked=promise.finally(()=>{if(loadPromises.get(id)===tracked)loadPromises.delete(id);});
    loadPromises.set(id,tracked);return tracked;
  }

  function loadCatalogCore(){return load('programCatalogCoreScriptV1','/js/program-catalog-core.js?v=20260818-1')}

  /*
   * PDF route source-contract compatibility metadata only. Executable loading
   * is owned by /js/pdf-editor/route-runtime.js.
   *
      tasks.push(load('programShellUnifyScriptV1','/js/program-shell-unify.js?v=20260824-1'));
      tasks.push(load('pdfAllInOneStage1ScriptV1','/js/pdf-all-in-one-stage1.js?v=20260824-1'));
      tasks.push(load('desktopToolMobileNoticeScriptV1','/js/desktop-tool-mobile-notice.js?v=20260807-1'));
      tasks.push(load('pdfEditorModuleLoaderScript','/js/pdf-editor/loader.js?v='+VERSION));
      tasks.push(load('pdfEditorTransferLimitGuardScriptV1','/js/pdf-editor/transfer-limit-guard.js?v=20260818-1'));
      tasks.push(load('pdfCropMarksScript','/js/pdf-editor/crop-marks.js?v=20260731-4'));
      tasks.push(load('pdfSaveOperationScript','/js/pdf-editor/save-operation.js?v=20260731-3'));
      tasks.push(load('pdfSaveRecoveryScript','/js/pdf-editor/save-recovery.js?v=20260803-1'));
      tasks.push(load('pdfSessionSaveSafetyScriptV1','/js/pdf-editor/session-save-safety.js?v=20260805-2'));
      tasks.push(load('pdfFileContextScopeScript','/js/pdf-editor/file-context-scope.js?v=20260805-1'));
      tasks.push(load('pdfImportTransactionSafetyScriptV1','/js/pdf-editor/import-transaction-safety.js?v=20260806-1'));
      tasks.push(load('pdfViewportLazyPreviewScriptV1','/js/pdf-editor/viewport-lazy-preview.js?v=20260806-1'));
      tasks.push(load('pdfViewportLazyPreviewGuardScriptV1','/js/pdf-editor/viewport-lazy-preview-guard.js?v=20260806-1'));
      tasks.push(load('pdfFileNavigationScriptV1','/js/pdf-editor/file-navigation.js?v=20260806-1'));
      tasks.push(load('pdfDividerLocalImageUploadScriptV1','/js/pdf-divider-local-image-upload.js?v=20260818-2'));
      tasks.push(load('pdfEditorFinalCheckScriptV1','/js/pdf-editor-final-check.js?v='+VERSION));
      tasks.push(load('pdfEditorSpreadSplitScriptV1','/js/pdf-editor/spread-split.js?v=20260825-1'));
      tasks.push(load('pdfBookletSheetPreviewScriptV1','/js/pdf-editor/booklet-sheet-preview.js?v=20260827-1'));
   */

  function loadPdfEditorRuntime(){
    window.ProgramStudioPdfEditorRuntimeContext={entryPath:currentPath,load};
    return load('pdfEditorRouteRuntimeScriptV1','/js/pdf-editor/route-runtime.js?v=20260828-1').then(()=>{
      const runtime=window.PdfEditorRouteRuntime;
      if(!runtime||typeof runtime.loadAll!=='function')throw new Error('PDF editor route runtime API is unavailable');
      return runtime.loadAll();
    });
  }
  function loadPreflightRuntime(){
    window.ProgramStudioPreflightRuntimeContext={entryPath:currentPath,load};
    const ready=load('pdfPreflightRouteRuntimeScriptV1','/js/pdf-preflight/route-runtime.js?v=20260831-1').then(()=>{
      const runtime=window.ProgramStudioPreflightRuntime;
      if(!runtime||typeof runtime.loadAll!=='function')throw new Error('PDF preflight route runtime API is unavailable');
      return runtime.loadAll();
    });
    window.ProgramStudioPreflightRuntimeReady=ready;
    return ready;
  }

  async function cleanupLegacyRuntime(){
    try{if(localStorage.getItem(CLEANUP_KEY)==='done')return;}catch(_){}
    try{
      if('serviceWorker'in navigator&&typeof navigator.serviceWorker.getRegistrations==='function'){
        const registrations=await navigator.serviceWorker.getRegistrations();
        await Promise.allSettled(registrations.map(registration=>registration.unregister()));
      }
    }catch(error){console.warn('Legacy service worker cleanup failed',error);}
    try{
      if('caches'in window){
        const keys=await caches.keys();
        await Promise.allSettled(keys.filter(key=>key.startsWith(CACHE_PREFIX)).map(key=>caches.delete(key)));
      }
    }catch(error){console.warn('Legacy Program Studio cache cleanup failed',error);}
    try{localStorage.setItem(CLEANUP_KEY,'done')}catch(_){}
  }

  async function helpers(){
    const tasks=[];
    if(!isAuthPage()){
      tasks.push(load('programStudioPlatformHealthScriptV1','/js/platform-health.js?v='+VERSION).catch(error=>{console.warn('Platform health helper loading failed',error);return null;}));
      tasks.push(load('appVersionHelperScript','/js/app-version.js?v='+VERSION));
    }
    if(isPath('/admin','/admin.html')){
      tasks.push(loadCatalogCore()
        .then(()=>load('adminProgramCatalogManagerScriptV1','/js/admin-program-catalog-manager.js?v=20260808-1'))
        .then(()=>load('adminProgramCatalogNavGuardScriptV1','/js/admin-program-catalog-nav-guard.js?v=20260818-1'))
        .then(()=>load('adminProfessionalProgramManagerScriptV1','/js/admin-professional-program-manager.js?v=20260821-2'))
        .then(()=>load('adminOperationsOverviewScriptV1','/js/admin-operations-overview.js?v='+VERSION)));
      tasks.push(load('adminProgramIconPaletteScriptV1','/js/admin-program-icon-palette.js?v=20260808-1'));
    }
    if(isPath('/tools/pdf-editor.html','/pdf-editor','/pdf-editor/index.html'))tasks.push(loadPdfEditorRuntime());
    if(isPath('/tools/pdf-Checker.html','/tools/preflight.html','/pdf-preflight','/pdf-preflight/index.html'))tasks.push(loadPreflightRuntime());
    return Promise.allSettled(tasks);
  }

  async function boot(){
    const protectedPage=isProtectedRuntimePage();
    const helpersPromise=protectedPage?helpers():nextPaint().then(helpers);
    window.ProgramStudioRuntimeReady=helpersPromise;
    window.ProgramStudioRuntime={version:VERSION,protectedPage,helpersReady:false,failedHelpers:0,bootStrategy:protectedPage?'approval-gated-runtime':'public-first-paint'};
    helpersPromise.then(results=>{
      const failed=results.filter(result=>result.status==='rejected').length;
      window.ProgramStudioRuntime.helpersReady=true;window.ProgramStudioRuntime.failedHelpers=failed;
      try{window.dispatchEvent(new CustomEvent('programstudio:runtime-ready',{detail:{failed,total:results.length}}));}catch(_){}
    });
    cleanupLegacyRuntime().catch(error=>console.warn('Legacy runtime cleanup failed',error));
    if(!protectedPage){reveal();helpersPromise.catch(error=>console.warn('Runtime helper loading failed',error));return;}
    // Protected tools are revealed only by app-boot-guard.js after approval and route runtime readiness.
    try{await Promise.race([helpersPromise,delay(1000)]);await nextPaint();}
    finally{helpersPromise.catch(error=>console.warn('Runtime helper loading failed',error));}
  }

  setTimeout(()=>{if(!isProtectedRuntimePage())reveal()},600);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
