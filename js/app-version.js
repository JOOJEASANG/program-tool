// Program Studio version observer. Version changes are recorded without forcing a reload.
(function(){
  if(window.__appVersionObserverV6)return;
  window.__appVersionObserverV6=true;
  if(/^\/login(?:\.html)?\/?$/.test(location.pathname))return;

  const LOCAL_KEY='programStudioVersion';
  const currentPath=location.pathname.replace(/\/+$/,'')||'/';
  const isPdfUtility=(currentPath==='/tools/pdf-Checker.html'||currentPath==='/tools/preflight.html'||currentPath==='/pdf-preflight'||currentPath.endsWith('/pdf-preflight/index.html'));

  function loadScopedScript(id,src,async=false){
    if(document.getElementById(id))return;
    const script=document.createElement('script');
    script.id=id;
    script.src=src;
    script.async=async;
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
    if(currentPath==='/'||currentPath==='/index.html')loadCatalogScripts('home');
    if(currentPath==='/admin'||currentPath==='/admin.html'||currentPath.endsWith('/admin.html'))loadCatalogScripts('admin');
    if(currentPath==='/tools/pdf-editor.html'||currentPath==='/pdf-editor'||currentPath.endsWith('/pdf-editor/index.html')){
      loadScopedScript('pdfEditorTransferLimitGuardScriptV1','/js/pdf-editor/transfer-limit-guard.js?v=20260818-1',true);
      loadScopedScript('pdfDividerLocalImageUploadScriptV1','/js/pdf-divider-local-image-upload.js?v=20260818-2',true);
    }
    if(currentPath==='/tools/perfect-binding-cover.html'||currentPath==='/perfect-binding-cover'||currentPath.endsWith('/perfect-binding-cover/index.html')){
      loadScopedScript('coverLargeFilePolicyScriptV1','/js/cover-large-file-policy.js?v=20260818-1',true);
      loadScopedScript('coverTemplateAdminSeparationScriptV1','/js/cover-template-admin-separation.js?v=20260818-2',true);
      loadScopedScript('coverLocalImageUploadScriptV1','/js/cover-local-image-upload.js?v=20260818-2',true);
      loadScopedScript('coverPreviewTextInspectorScriptV1','/js/cover-preview-text-inspector.js?v=20260818-1',true);
    }
    if(isPdfUtility){
      // PDF utility enhancements are non-critical. Load them only after the
      // browser has parsed and painted the page so they cannot block first paint.
      loadScopedScript('pdfUtilityFirstPaintScriptV2','/js/pdf-utility-first-paint.js?v=20260821-3',true);
      loadScopedScript('pdfUtilityPanelResizerScriptV1','/js/pdf-utility-panel-resizer.js?v=20260821-3',true);
      const loadOptional=()=>{
        loadScopedScript('pdfUtilityImageConverterScriptV1','/js/pdf-utility-image-converter.js?v=20260819-1',true);
        loadScopedScript('pdfUtilityImageConverterFinalizeScriptV1','/js/pdf-utility-image-converter-finalize.js?v=20260819-3',true);
      };
      if('requestIdleCallback' in window)window.requestIdleCallback(loadOptional,{timeout:1200});
      else setTimeout(loadOptional,300);
    }
  }

  function bootEnhancements(){
    if(isPdfUtility){
      if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',loadScopedEnhancements,{once:true});
      else setTimeout(loadScopedEnhancements,0);
    }else{
      loadScopedEnhancements();
    }
  }

  async function check(){
    try{
      const response=await fetch('/version.json?t='+Date.now(),{cache:'no-store',headers:{'Cache-Control':'no-cache'}});
      if(!response.ok)return;
      const data=await response.json();
      const currentVersion=String(data.version||'').trim();
      if(!currentVersion||currentVersion==='unknown')return;
      const previousVersion=localStorage.getItem(LOCAL_KEY)||'';
      localStorage.setItem(LOCAL_KEY,currentVersion);
      window.ProgramStudioVersion={version:currentVersion,previousVersion,changed:Boolean(previousVersion&&previousVersion!==currentVersion),label:String(data.label||''),updatedAt:String(data.updatedAt||'')};
      if(previousVersion&&previousVersion!==currentVersion)window.dispatchEvent(new CustomEvent('program-studio-version-changed',{detail:window.ProgramStudioVersion}));
    }catch(error){console.warn('Program Studio version check failed',error);}
  }

  bootEnhancements();
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',check,{once:true});else check();
})();
