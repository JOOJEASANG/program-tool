// Canonical design-editor core runtime manifest.
// The top-level Program Studio bootstrap only knows this loader; design feature
// ordering and the embedded-general route compatibility live here.
(function(){
  'use strict';
  if(window.__programStudioDesignEditorCoreRuntimeV1)return;
  window.__programStudioDesignEditorCoreRuntimeV1=true;

  const MODULES=Object.freeze([
    {id:'designEditorRuntimeDiagnosticsScriptV1',src:'/js/design-editor/runtime-diagnostics.js?v=20260823-1'},
    {id:'designEditorDraftScopeScriptV1',src:'/js/design-editor/phase5-draft-scope.js?v=20260823-4'},
    {id:'designEditorCoverModelScriptV1',src:'/js/design-editor/cover-model.js?v=20260823-1',products:['cover']},
    {id:'designEditorCoverModeBridgeScriptV1',src:'/js/design-editor/cover-mode-bridge.js?v=20260823-2',products:['cover']},
    {id:'designEditorEmbeddedRuntimeScriptV1',src:'/js/design-editor/embedded-runtime.js?v=20260821-1'},
    {id:'designEditorCoverSettingsScriptV1',src:'/js/design-editor/cover-settings.js?v=20260823-1',products:['cover']},
    {id:'designEditorEmbeddedPolishScriptV1',src:'/js/design-editor/phase6-embedded-polish.js?v=20260821-1'},
    {id:'designEditorRecentDraftsScriptV1',src:'/js/design-editor/phase7-recent-drafts.js?v=20260821-1'},
    {id:'designEditorCurrentDraftResetScriptV1',src:'/js/design-editor/phase8-current-draft-reset.js?v=20260821-1'},
    {id:'designEditorModeSwitchSafetyScriptV1',src:'/js/design-editor/phase9-mode-switch-safety.js?v=20260821-1'},
    {id:'designEditorAssetStoreScriptV1',src:'/js/design-editor/asset-store.js?v=20260822-1'},
    {id:'designEditorPhase2ScriptV1',src:'/js/design-editor/phase2.js?v=20260822-2'},
    {id:'designEditorOutputScriptV1',src:'/js/design-editor/output.js?v=20260823-1'},
    {id:'designEditorPhase3ControlsScriptV1',src:'/js/design-editor/phase3-controls.js?v=20260821-1'},
    {id:'designEditorPhase4SmartLayoutScriptV1',src:'/js/design-editor/phase4-smart-layout.js?v=20260821-1'},
    {id:'designEditorElementClipboardScriptV1',src:'/js/design-editor/phase10-element-clipboard.js?v=20260821-1'},
    {id:'designEditorProjectFileScriptV1',src:'/js/design-editor/phase11-project-file.js?v=20260823-1'},
    {id:'designEditorCloudProjectsScriptV1',src:'/js/design-editor/phase24-cloud-projects.js?v=20260823-1'},
    {id:'designEditorRotationScriptV1',src:'/js/design-editor/phase12-rotation.js?v=20260822-1'},
    {id:'designEditorCoverSpineToolsScriptV1',src:'/js/design-editor/cover-spine-tools.js?v=20260823-1',products:['cover']},
    {id:'designEditorCoverPreviewZonesScriptV1',src:'/js/design-editor/cover-preview-zones.js?v=20260823-3',products:['cover']},
    {id:'designEditorPrintQualityScriptV1',src:'/js/design-editor/phase13-print-quality.js?v=20260822-1'},
    {id:'designEditorPrintSafetyScriptV1',src:'/js/design-editor/phase14-print-safety.js?v=20260822-1'},
    {id:'designEditorFinalPrintCheckScriptV1',src:'/js/design-editor/phase22-final-print-check.js?v=20260822-1'},
    {id:'designEditorQuickDesignScriptV1',src:'/js/design-editor/phase15-quick-design.js?v=20260822-1'},
    {id:'designEditorSimpleInterfaceScriptV1',src:'/js/design-editor/phase16-simple-interface.js?v=20260823-3'},
    {id:'designEditorComponentBlocksScriptV1',src:'/js/design-editor/phase17-component-blocks.js?v=20260822-2'},
    {id:'designEditorCanvasQuickbarScriptV1',src:'/js/design-editor/phase18-canvas-quickbar.js?v=20260822-1'},
    {id:'designEditorSmartSnapScriptV1',src:'/js/design-editor/phase19-smart-snap.js?v=20260823-2'},
    {id:'designEditorPrintBlocksScriptV1',src:'/js/design-editor/phase20-print-blocks.js?v=20260822-1'},
    {id:'designEditorStyleThemesScriptV1',src:'/js/design-editor/phase21-style-themes.js?v=20260822-1'},
    {id:'designEditorDesignRecipesScriptV1',src:'/js/design-editor/phase23-design-recipes.js?v=20260822-1'}
  ]);

  const GENERAL_ROUTE_IDS=new Set([
    'designEditorPhase2ScriptV1',
    'designEditorOutputScriptV1',
    'designEditorSimpleInterfaceScriptV1',
    'designEditorComponentBlocksScriptV1'
  ]);
  const PRODUCT_ALIASES=Object.freeze({notice:'invitation',leaflet2:'leaflet',leaflet3:'leaflet'});
  const params=()=>new URLSearchParams(location.search);
  const standaloneProduct=()=>{
    const raw=(params().get('app')||'').trim().toLowerCase();
    return PRODUCT_ALIASES[raw]||raw;
  };
  const activeModules=()=>{
    const product=standaloneProduct();
    if(!product)return MODULES;
    return MODULES.filter(entry=>!entry.products||entry.products.includes(product));
  };

  const context=()=>window.ProgramStudioDesignEditorRuntimeContext||{};
  const runtimePath=()=>location.pathname.replace(/\/+$/,'')||'/';

  function isEmbeddedGeneralRuntime(){
    if(params().get('embed')!=='1')return false;
    const entryPath=context().entryPath||runtimePath();
    const path=runtimePath();
    return (entryPath==='/design-editor/general'||entryPath==='/design-editor/general.html'||entryPath.endsWith('/design-editor/general.html'))
      && (path==='/design-editor/index.html'||path.endsWith('/design-editor/index.html'));
  }

  function hostLoad(id,src){
    const loader=context().load;
    if(typeof loader!=='function'){
      return Promise.reject(new Error('Program Studio runtime loader is unavailable'));
    }
    return loader(id,src);
  }

  async function loadEntry(entry){
    if(!GENERAL_ROUTE_IDS.has(entry.id)||!isEmbeddedGeneralRuntime()){
      await hostLoad(entry.id,entry.src);
      return;
    }
    const restoreUrl=location.pathname+location.search+location.hash;
    const entryPath=context().entryPath||'/design-editor/general.html';
    const generalUrl=entryPath+location.search+location.hash;
    history.replaceState(history.state,'',generalUrl);
    try{
      await hostLoad(entry.id,entry.src);
    }finally{
      history.replaceState(history.state,'',restoreUrl);
    }
  }

  async function loadAll(){
    const seen=new Set();
    const modules=activeModules();
    for(const entry of modules){
      if(!entry.id||!entry.src||seen.has(entry.id)){
        console.warn('[design-core-runtime] manifest entry skipped',entry);
        continue;
      }
      seen.add(entry.id);
      await loadEntry(entry);
    }
    const product=standaloneProduct();
    document.documentElement.dataset.designCoreRuntime='1';
    if(product)document.documentElement.dataset.designProductBoundary=product;
    return true;
  }

  window.ProgramStudioDesignEditorRuntimeManifest=activeModules().map(({id,src})=>({id,src}));
  window.ProgramStudioDesignEditorCoreRuntime={
    loadAll,
    modules:activeModules().map(({id,src})=>({id,src})),
    product:standaloneProduct(),
    stage:'design-editor-product-aware-core-runtime-v2'
  };
})();