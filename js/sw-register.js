(function(){
  if(window.__programStudioRuntimeBoot)return;
  window.__programStudioRuntimeBoot=true;

  const VERSION='2026.07.31.004';
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

  function runtimeScriptResult(id,src,status){
    const node=document.getElementById(id);
    if(node){
      if(status==='loaded'){
        node.dataset.loaded='true';
        delete node.dataset.failed;
      }else{
        node.dataset.failed=status;
      }
    }
    try{
      window.dispatchEvent(new CustomEvent('programstudio:runtime-script-result',{detail:{id,src,status}}));
    }catch(_){}
  }

  function load(id,src){
    const existing=document.getElementById(id);
    if(existing){
      if(existing.dataset.loaded==='true')return Promise.resolve();
      return new Promise(resolve=>{
        let settled=false;
        const done=status=>{
          if(settled)return;
          settled=true;
          runtimeScriptResult(id,src,status);
          resolve();
        };
        existing.addEventListener('load',()=>done('loaded'),{once:true});
        existing.addEventListener('error',()=>done('error'),{once:true});
        setTimeout(()=>done('timeout'),1200);
      });
    }
    return new Promise(resolve=>{
      const script=document.createElement('script');
      script.id=id;
      script.src=src;
      script.async=false;
      let settled=false;
      const done=status=>{
        if(settled)return;
        settled=true;
        runtimeScriptResult(id,src,status);
        resolve();
      };
      script.addEventListener('load',()=>done('loaded'),{once:true});
      script.addEventListener('error',()=>done('error'),{once:true});
      document.head.appendChild(script);
      setTimeout(()=>done('timeout'),1200);
    });
  }

  function isPath(...parts){
    return parts.some(path=>currentPath===path||currentPath.endsWith(path));
  }
  function isHome(){return currentPath==='/'||currentPath==='/index.html'}
  function isAuthPage(){return isPath('/login','/login.html')}
  function loadCatalogCore(){return load('programCatalogCoreScriptV1','/js/program-catalog-core.js?v=20260818-1')}

  const DESIGN_EDITOR_RUNTIME_SCRIPTS=Object.freeze([
    ['designEditorRuntimeDiagnosticsScriptV1','/js/design-editor/runtime-diagnostics.js?v=20260823-1'],
    ['designEditorDraftScopeScriptV1','/js/design-editor/phase5-draft-scope.js?v=20260823-4'],
    ['designEditorCoverModelScriptV1','/js/design-editor/cover-model.js?v=20260823-1'],
    ['designEditorCoverModeBridgeScriptV1','/js/design-editor/cover-mode-bridge.js?v=20260823-1'],
    ['designEditorEmbeddedRuntimeScriptV1','/js/design-editor/embedded-runtime.js?v=20260821-1'],
    ['designEditorCoverSettingsScriptV1','/js/design-editor/cover-settings.js?v=20260823-1'],
    ['designEditorEmbeddedPolishScriptV1','/js/design-editor/phase6-embedded-polish.js?v=20260821-1'],
    ['designEditorRecentDraftsScriptV1','/js/design-editor/phase7-recent-drafts.js?v=20260821-1'],
    ['designEditorCurrentDraftResetScriptV1','/js/design-editor/phase8-current-draft-reset.js?v=20260821-1'],
    ['designEditorModeSwitchSafetyScriptV1','/js/design-editor/phase9-mode-switch-safety.js?v=20260821-1'],
    ['designEditorAssetStoreScriptV1','/js/design-editor/asset-store.js?v=20260822-1'],
    ['designEditorPhase2ScriptV1','/js/design-editor/phase2.js?v=20260822-2'],
    ['designEditorOutputScriptV1','/js/design-editor/output.js?v=20260823-1'],
    ['designEditorPhase3ControlsScriptV1','/js/design-editor/phase3-controls.js?v=20260821-1'],
    ['designEditorPhase4SmartLayoutScriptV1','/js/design-editor/phase4-smart-layout.js?v=20260821-1'],
    ['designEditorElementClipboardScriptV1','/js/design-editor/phase10-element-clipboard.js?v=20260821-1'],
    ['designEditorProjectFileScriptV1','/js/design-editor/phase11-project-file.js?v=20260823-1'],
    ['designEditorCloudProjectsScriptV1','/js/design-editor/phase24-cloud-projects.js?v=20260823-1'],
    ['designEditorRotationScriptV1','/js/design-editor/phase12-rotation.js?v=20260822-1'],
    ['designEditorCoverSpineToolsScriptV1','/js/design-editor/cover-spine-tools.js?v=20260823-1'],
    ['designEditorCoverPreviewZonesScriptV1','/js/design-editor/cover-preview-zones.js?v=20260823-1'],
    ['designEditorPrintQualityScriptV1','/js/design-editor/phase13-print-quality.js?v=20260822-1'],
    ['designEditorPrintSafetyScriptV1','/js/design-editor/phase14-print-safety.js?v=20260822-1'],
    ['designEditorFinalPrintCheckScriptV1','/js/design-editor/phase22-final-print-check.js?v=20260822-1'],
    ['designEditorQuickDesignScriptV1','/js/design-editor/phase15-quick-design.js?v=20260822-1'],
    ['designEditorSimpleInterfaceScriptV1','/js/design-editor/phase16-simple-interface.js?v=20260823-3'],
    ['designEditorComponentBlocksScriptV1','/js/design-editor/phase17-component-blocks.js?v=20260822-2'],
    ['designEditorCanvasQuickbarScriptV1','/js/design-editor/phase18-canvas-quickbar.js?v=20260822-1'],
    ['designEditorSmartSnapScriptV1','/js/design-editor/phase19-smart-snap.js?v=20260823-2'],
    ['designEditorPrintBlocksScriptV1','/js/design-editor/phase20-print-blocks.js?v=20260822-1'],
    ['designEditorStyleThemesScriptV1','/js/design-editor/phase21-style-themes.js?v=20260822-1'],
    ['designEditorDesignRecipesScriptV1','/js/design-editor/phase23-design-recipes.js?v=20260822-1']
  ]);
  const DESIGN_EDITOR_GENERAL_ROUTE_IDS=new Set([
    'designEditorPhase2ScriptV1',
    'designEditorOutputScriptV1',
    'designEditorSimpleInterfaceScriptV1',
    'designEditorComponentBlocksScriptV1'
  ]);
  window.ProgramStudioDesignEditorRuntimeManifest=DESIGN_EDITOR_RUNTIME_SCRIPTS.map(([id,src])=>({id,src}));

  function runtimePath(){return location.pathname.replace(/\/+$/,'')||'/';}
  function isEmbeddedGeneralRuntime(){
    if(new URLSearchParams(location.search).get('embed')!=='1')return false;
    const path=runtimePath();
    return (currentPath==='/design-editor/general'||currentPath==='/design-editor/general.html'||currentPath.endsWith('/design-editor/general.html'))
      && (path==='/design-editor/index.html'||path.endsWith('/design-editor/index.html'));
  }
  async function loadDesignEditorEntry(id,src){
    if(!DESIGN_EDITOR_GENERAL_ROUTE_IDS.has(id)||!isEmbeddedGeneralRuntime()){
      await load(id,src);
      return;
    }
    const restoreUrl=location.pathname+location.search+location.hash;
    const generalUrl=currentPath+location.search+location.hash;
    history.replaceState(history.state,'',generalUrl);
    try{
      await load(id,src);
    }finally{
      history.replaceState(history.state,'',restoreUrl);
    }
  }

  async function loadSeries(entries){
    const seen=new Set();
    for(const [id,src] of entries){
      if(!id||!src||seen.has(id)){
        console.warn('Runtime manifest entry skipped',id,src);
        continue;
      }
      seen.add(id);
      await loadDesignEditorEntry(id,src);
    }
  }

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
    if(!isAuthPage())tasks.push(load('appVersionHelperScript','/js/app-version.js?v=20260818-4'));
    if(isHome()){
      tasks.push(
        loadCatalogCore()
          .then(()=>load('homeProgramCatalogScriptV1','/js/home-program-catalog.js?v=20260808-1'))
          .then(()=>load('homePdfUtilityNameSyncScriptV1','/js/home-pdf-utility-name-sync.js?v=20260818-1'))
          .then(()=>load('homeProfessionalSuiteScriptV1','/js/home-professional-suite.js?v=20260821-3'))
      );
      tasks.push(load('homeHeroUpgradeScript','/js/home-hero-upgrade.js?v='+VERSION));
      tasks.push(load('homeHeaderFooterRefineScript','/js/home-header-footer-refine.js?v='+VERSION));
    }
    if(isPath('/admin','/admin.html')){
      tasks.push(
        loadCatalogCore()
          .then(()=>load('adminProgramCatalogManagerScriptV1','/js/admin-program-catalog-manager.js?v=20260808-1'))
          .then(()=>load('adminProgramCatalogNavGuardScriptV1','/js/admin-program-catalog-nav-guard.js?v=20260818-1'))
          .then(()=>load('adminProfessionalProgramManagerScriptV1','/js/admin-professional-program-manager.js?v=20260821-2'))
      );
      tasks.push(load('adminProgramIconPaletteScriptV1','/js/admin-program-icon-palette.js?v=20260808-1'));
    }
    // Legacy test/source marker kept intentionally: if(isPath('/design-editor','/design-editor/index.html'))
    // Legacy test/source marker kept intentionally: if(isPath('/design-editor/general.html'))
    if(isPath('/design-editor/general','/design-editor/general.html')){
      tasks.push(loadSeries(DESIGN_EDITOR_RUNTIME_SCRIPTS));
    }
    if(isPath('/tools/pdf-editor.html','/pdf-editor','/pdf-editor/index.html')){
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
    }
    if(isPath('/tools/pdf-Checker.html','/tools/preflight.html','/pdf-preflight','/pdf-preflight/index.html')){
      const finalGuard=load('pdfCheckerFinalGuardScript','/js/pdf-checker-final-guard.js?v='+VERSION);
      const panelBalance=load('pdfPreflightPanelBalanceScript','/js/pdf-preflight-panel-balance.js?v='+VERSION);
      tasks.push(finalGuard);
      tasks.push(panelBalance);
      tasks.push(
        Promise.all([finalGuard,panelBalance])
          .then(()=>load('pdfUtilityScriptV1','/js/pdf-utility.js?v=20260818-1'))
          .then(()=>load('pdfUtilityMarginCropScriptV1','/js/pdf-utility-margin-crop.js?v=20260819-1'))
          .then(()=>load('pdfUtilityBackgroundMarginLabelsScriptV1','/js/pdf-utility-background-margin-labels.js?v=20260819-2'))
          .then(()=>load('pdfUtilityImageConverterScriptV1','/js/pdf-utility-image-converter.js?v=20260819-1'))
          .then(()=>load('pdfUtilityFinalizeScriptV1','/js/pdf-utility-finalize.js?v=20260818-3'))
      );
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