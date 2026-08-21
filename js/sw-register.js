(function(){
  if(window.__programStudioRuntimeBootV2)return;
  window.__programStudioRuntimeBootV2=true;

  const VERSION='2026.08.21.001';
  const CACHE_PREFIX='program-studio-';
  const CLEANUP_KEY='program-studio-legacy-runtime-cleanup-'+VERSION;
  const currentPath=location.pathname.replace(/\/+$/,'')||'/';

  const reveal=()=>{
    if(window.ProgramStudioBoot&&typeof window.ProgramStudioBoot.reveal==='function')window.ProgramStudioBoot.reveal();
    else document.documentElement.classList.remove('app-booting');
  };
  const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const nextPaint=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));

  function load(id,src,async=true){
    const existing=document.getElementById(id);
    if(existing)return Promise.resolve();
    return new Promise(resolve=>{
      const script=document.createElement('script');
      script.id=id;script.src=src;script.async=async;
      const done=()=>{script.dataset.loaded='true';resolve();};
      script.addEventListener('load',done,{once:true});
      script.addEventListener('error',done,{once:true});
      document.head.appendChild(script);
      setTimeout(done,1500);
    });
  }
  function isPath(...parts){return parts.some(path=>currentPath===path||currentPath.endsWith(path));}
  function isHome(){return currentPath==='/'||currentPath==='/index.html';}
  function isAuthPage(){return isPath('/login','/login.html');}
  function loadCatalogCore(){return load('programCatalogCoreScriptV1','/js/program-catalog-core.js?v=20260818-1',false);}

  async function cleanupLegacyRuntime(){
    try{if(localStorage.getItem(CLEANUP_KEY)==='done')return;}catch(_){}
    try{
      if('serviceWorker'in navigator&&typeof navigator.serviceWorker.getRegistrations==='function'){
        const registrations=await navigator.serviceWorker.getRegistrations();
        await Promise.allSettled(registrations.map(r=>r.unregister()));
      }
    }catch(error){console.warn('Legacy service worker cleanup failed',error);}
    try{
      if('caches'in window){
        const keys=await caches.keys();
        await Promise.allSettled(keys.filter(k=>k.startsWith(CACHE_PREFIX)).map(k=>caches.delete(k)));
      }
    }catch(error){console.warn('Legacy Program Studio cache cleanup failed',error);}
    try{localStorage.setItem(CLEANUP_KEY,'done');}catch(_){}
  }

  function helpers(){
    const tasks=[];
    if(!isAuthPage())tasks.push(load('appVersionHelperScript','/js/app-version.js?v=20260821-5',true));
    if(isHome()){
      tasks.push(loadCatalogCore().then(()=>load('homeProgramCatalogScriptV1','/js/home-program-catalog.js?v=20260808-1',true)).then(()=>load('homePdfUtilityNameSyncScriptV1','/js/home-pdf-utility-name-sync.js?v=20260818-1',true)));
      tasks.push(load('homeHeroUpgradeScript','/js/home-hero-upgrade.js?v='+VERSION,true));
      tasks.push(load('homeHeaderFooterRefineScript','/js/home-header-footer-refine.js?v='+VERSION,true));
    }
    if(isPath('/admin','/admin.html')){
      tasks.push(loadCatalogCore().then(()=>load('adminProgramCatalogManagerScriptV1','/js/admin-program-catalog-manager.js?v=20260808-1',true)).then(()=>load('adminProgramCatalogNavGuardScriptV1','/js/admin-program-catalog-nav-guard.js?v=20260818-1',true)));
      tasks.push(load('adminProgramIconPaletteScriptV1','/js/admin-program-icon-palette.js?v=20260808-1',true));
    }
    if(isPath('/tools/pdf-editor.html','/pdf-editor','/pdf-editor/index.html','/tools/perfect-binding-cover.html','/perfect-binding-cover','/perfect-binding-cover/index.html'))tasks.push(load('desktopToolMobileNoticeScriptV1','/js/desktop-tool-mobile-notice.js?v=20260807-1',true));
    if(isPath('/tools/pdf-editor.html','/pdf-editor','/pdf-editor/index.html')){
      tasks.push(load('pdfEditorModuleLoaderScript','/js/pdf-editor/loader.js?v='+VERSION,true));
      tasks.push(load('pdfEditorTransferLimitGuardScriptV1','/js/pdf-editor/transfer-limit-guard.js?v=20260818-1',true));
      tasks.push(load('pdfCropMarksScript','/js/pdf-editor/crop-marks.js?v=20260731-4',true));
      tasks.push(load('pdfSaveOperationScript','/js/pdf-editor/save-operation.js?v=20260731-3',true));
      tasks.push(load('pdfSaveRecoveryScript','/js/pdf-editor/save-recovery.js?v=20260803-1',true));
      tasks.push(load('pdfSessionSaveSafetyScript','/js/pdf-editor/session-save-safety.js?v=20260805-2',true));
      tasks.push(load('pdfFileContextScopeScript','/js/pdf-editor/file-context-scope.js?v=20260805-1',true));
      tasks.push(load('pdfImportTransactionSafetyScriptV1','/js/pdf-editor/import-transaction-safety.js?v=20260806-1',true));
      tasks.push(load('pdfViewportLazyPreviewScriptV1','/js/pdf-editor/viewport-lazy-preview.js?v=20260806-1',true));
      tasks.push(load('pdfViewportLazyPreviewGuardScriptV1','/js/pdf-editor/viewport-lazy-preview-guard.js?v=20260806-1',true));
      tasks.push(load('pdfFileNavigationScriptV1','/js/pdf-editor/file-navigation.js?v=20260806-1',true));
      tasks.push(load('pdfDividerLocalImageUploadScriptV1','/js/pdf-divider-local-image-upload.js?v=20260818-2',true));
    }
    if(isPath('/tools/pdf-Checker.html','/tools/preflight.html','/pdf-preflight','/pdf-preflight/index.html')){
      // PDF Utility runtime is now owned by app-version.js. Keep only the two
      // small legacy guards here; do not load the old utility/image-converter
      // chain a second time, which previously caused duplicate initialization.
      tasks.push(load('pdfCheckerFinalGuardScript','/js/pdf-checker-final-guard.js?v='+VERSION,true));
      tasks.push(load('pdfPreflightPanelBalanceScript','/js/pdf-preflight-panel-balance.js?v='+VERSION,true));
    }
    if(isPath('/tools/perfect-binding-cover.html','/perfect-binding-cover','/perfect-binding-cover/index.html')){
      tasks.push(load('coverLargeFilePolicyScriptV1','/js/cover-large-file-policy.js?v=20260818-1',true));
      tasks.push(load('perfectBindingFineControlsScript','/js/perfect-binding-cover-fine-controls.js?v='+VERSION,true));
      tasks.push(load('coverTextZonesScriptV3','/js/cover-editor-text-zones-v2.js?v='+VERSION,true));
      tasks.push(load('coverSpineOrientationControlsScriptV1','/js/cover-spine-orientation-controls.js?v=20260806-1',true));
      tasks.push(load('coverTextUiRefineScriptV4','/js/cover-text-ui-refine.js?v='+VERSION,true));
      tasks.push(load('coverPreviewWorkspaceScriptV2','/js/cover-preview-workspace.js?v='+VERSION,true));
      tasks.push(load('coverProjectStateBridgeScriptV1','/js/cover-project-state-bridge.js?v='+VERSION,true));
      tasks.push(load('coverTemplateProjectSafetyScriptV2','/js/cover-template-project-safety.js?v=20260805-1',true));
      tasks.push(load('coverTemplateSurfaceCleanupScriptV1','/js/cover-template-surface-cleanup.js?v=20260806-1',true));
      tasks.push(load('coverImagePrintQualityScriptV1','/js/cover-image-print-quality.js?v=20260806-1',true));
      tasks.push(load('coverSpinePrintSafetyScriptV1','/js/cover-spine-print-safety.js?v=20260806-1',true));
      tasks.push(load('coverFinalOutputConfirmScriptV1','/js/cover-final-output-confirm.js?v=20260806-1',true));
      tasks.push(load('coverLayoutLockScriptV1','/js/cover-layout-lock.js?v=20260806-1',true));
      tasks.push(load('coverRecoveryCheckpointsScriptV1','/js/cover-recovery-checkpoints.js?v=20260806-1',true));
      tasks.push(load('coverFloatingActionDockScriptV2','/js/cover-floating-action-dock.js?v=20260806-1',true));
      tasks.push(load('coverUiRuntimeNormalizerScriptV1','/js/cover-ui-runtime-normalizer.js?v=20260805-1',true));
      tasks.push(load('coverOutputPerformanceSafetyScriptV1','/js/cover-output-performance-safety.js?v=20260805-1',true));
      tasks.push(load('coverRuntimeSafetyScriptV1','/js/cover-runtime-safety.js?v=20260805-1',true));
      tasks.push(load('coverTextCanvasControlsScriptV1','/js/cover-text-canvas-controls.js?v=20260806-1',true));
      tasks.push(load('coverEditHistoryScriptV1','/js/cover-edit-history.js?v=20260806-1',true));
      tasks.push(load('coverLocalImageUploadScriptV1','/js/cover-local-image-upload.js?v=20260818-2',true));
      tasks.push(load('coverRenderPipelineContractScriptV1','/js/cover-render-pipeline-contract.js?v=20260806-1',true));
      tasks.push(load('coverTemplateAdminSeparationScriptV1','/js/cover-template-admin-separation.js?v=20260818-2',true));
    }
    return Promise.allSettled(tasks);
  }

  async function boot(){
    const helpersPromise=helpers();
    cleanupLegacyRuntime().catch(error=>console.warn('Legacy runtime cleanup failed',error));
    try{await Promise.race([helpersPromise,delay(800)]);await nextPaint();}finally{
      reveal();
      helpersPromise.catch(error=>console.warn('Runtime helper loading failed',error));
    }
  }
  setTimeout(reveal,1200);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
