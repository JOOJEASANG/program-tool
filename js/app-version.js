// Program Studio version observer. Version changes are recorded without forcing a reload.
(function(){
  if(window.__appVersionObserverV4)return;
  window.__appVersionObserverV4=true;
  if(/^\/login(?:\.html)?\/?$/.test(location.pathname))return;

  const LOCAL_KEY='programStudioVersion';
  const currentPath=location.pathname.replace(/\/+$/,'')||'/';

  function loadScopedScript(id,src){
    if(document.getElementById(id))return;
    const script=document.createElement('script');
    script.id=id;
    script.src=src;
    script.async=false;
    document.head.appendChild(script);
  }

  function loadCatalogScripts(target){
    loadScopedScript('programCatalogCoreScriptV1','/js/program-catalog-core.js?v=20260818-1');
    const script=document.getElementById('programCatalogCoreScriptV1');
    const loadTarget=()=>{
      if(target==='home')loadScopedScript('homeProgramCatalogScriptV1','/js/home-program-catalog.js?v=20260808-1');
      if(target==='admin'){
        loadScopedScript('adminProgramCatalogManagerScriptV1','/js/admin-program-catalog-manager.js?v=20260808-1');
        loadScopedScript('adminProgramIconPaletteScriptV1','/js/admin-program-icon-palette.js?v=20260808-1');
        loadScopedScript('adminProgramCatalogNavGuardScriptV1','/js/admin-program-catalog-nav-guard.js?v=20260818-1');
      }
    };
    if(window.ProgramCatalogCore)loadTarget();
    else if(script)script.addEventListener('load',loadTarget,{once:true});
  }

  function loadScopedEnhancements(){
    if(currentPath==='/'||currentPath==='/index.html'){
      loadCatalogScripts('home');
      loadScopedScript('homePrintWorkflowScriptV1','/js/home-print-workflow.js?v=20260824-1');
    }
    if(currentPath==='/admin'||currentPath==='/admin.html'||currentPath.endsWith('/admin.html')){
      loadCatalogScripts('admin');
      loadScopedScript('adminOperationsOverviewScriptV1','/js/admin-operations-overview.js?v=20260824-1');
      loadScopedScript('aiDesignFeatureGateScriptV1','/js/ai-design-feature-gate.js?v=20260824-1');
    }
    if(
      currentPath==='/design-editor'||
      currentPath==='/design-editor/index.html'||
      currentPath==='/design-editor/general'||
      currentPath==='/design-editor/general.html'||
      currentPath.endsWith('/design-editor/general.html')
    ){
      loadScopedScript('aiDesignFeatureGateScriptV1','/js/ai-design-feature-gate.js?v=20260824-1');
    }
    if(
      currentPath==='/tools/pdf-editor.html'||
      currentPath==='/pdf-editor'||
      currentPath.endsWith('/pdf-editor/index.html')
    ){
      loadScopedScript('pdfEditorTransferLimitGuardScriptV1','/js/pdf-editor/transfer-limit-guard.js?v=20260818-1');
      loadScopedScript('pdfDividerLocalImageUploadScriptV1','/js/pdf-divider-local-image-upload.js?v=20260818-2');
      loadScopedScript('pdfEditorFinalCheckScriptV1','/js/pdf-editor-final-check.js?v=20260824-1');
    }
    if(
      currentPath==='/tools/pdf-Checker.html'||
      currentPath==='/tools/preflight.html'||
      currentPath==='/pdf-preflight'||
      currentPath.endsWith('/pdf-preflight/index.html')
    ){
      loadScopedScript('pdfUtilityFirstPaintScriptV1','/js/pdf-utility-first-paint.js?v=20260821-1');
      loadScopedScript('pdfUtilityImageConverterScriptV1','/js/pdf-utility-image-converter.js?v=20260819-1');
      loadScopedScript('pdfUtilityImageConverterFinalizeScriptV1','/js/pdf-utility-image-converter-finalize.js?v=20260819-3');
      loadScopedScript('pdfUtilityPanelResizerScriptV1','/js/pdf-utility-panel-resizer.js?v=20260821-1');
      loadScopedScript('pdfPrintReadinessScriptV1','/js/pdf-print-readiness.js?v=20260824-1');
    }
  }

  async function check(){
    try{
      const response=await fetch('/version.json?t='+Date.now(),{
        cache:'no-store',
        headers:{'Cache-Control':'no-cache'}
      });
      if(!response.ok)return;
      const data=await response.json();
      const currentVersion=String(data.version||'').trim();
      if(!currentVersion||currentVersion==='unknown')return;

      const previousVersion=localStorage.getItem(LOCAL_KEY)||'';
      localStorage.setItem(LOCAL_KEY,currentVersion);
      window.ProgramStudioVersion={
        version:currentVersion,
        previousVersion,
        changed:Boolean(previousVersion&&previousVersion!==currentVersion),
        label:String(data.label||''),
        updatedAt:String(data.updatedAt||'')
      };

      if(previousVersion&&previousVersion!==currentVersion){
        window.dispatchEvent(new CustomEvent('program-studio-version-changed',{
          detail:window.ProgramStudioVersion
        }));
      }
    }catch(error){
      console.warn('Program Studio version check failed',error);
    }
  }

  loadScopedEnhancements();
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',check,{once:true});
  }else{
    check();
  }
})();