// Canonical PDF-editor route runtime.
// sw-register.js only chooses the route; this manifest owns editor-specific helpers.
(function(){
  'use strict';
  if(window.__pdfEditorRouteRuntimeV2)return;
  window.__pdfEditorRouteRuntimeV2=true;

  const MODULES=Object.freeze([
    {id:'programShellUnifyScriptV1',src:'/js/program-shell-unify.js?v=20260831-1'},
    {id:'pdfAllInOneStage1ScriptV1',src:'/js/pdf-all-in-one-stage1.js?v=20260824-1'},
    {id:'desktopToolMobileNoticeScriptV1',src:'/js/desktop-tool-mobile-notice.js?v=20260807-1'},
    {id:'pdfLayoutPageSelectionScriptV1',src:'/js/pdf-editor/page-selection-preview-focus.js?v=20260914-2',app:'layout'},
    {id:'pdfEditorModuleLoaderScript',src:'/js/pdf-editor/loader.js?v=20260914-4'},
    {id:'pdfEditorTransferLimitGuardScriptV1',src:'/js/pdf-editor/transfer-limit-guard.js?v=20260915-1'},
    {id:'pdfCropMarksScript',src:'/js/pdf-editor/crop-marks.js?v=20260731-4'},
    {id:'pdfOutputSaveRecoveryScriptV1',src:'/js/pdf-editor/output-save-recovery.js?v=20260914-2'},
    {id:'pdfSaveRecoveryScript',src:'/js/pdf-editor/save-recovery.js?v=20260803-1'},
    {id:'pdfSessionSaveSafetyScriptV1',src:'/js/pdf-editor/session-save-safety.js?v=20260831-2'},
    {id:'pdfFileContextScopeScript',src:'/js/pdf-editor/file-context-scope.js?v=20260805-1'},
    {id:'pdfImportTransactionSafetyScriptV1',src:'/js/pdf-editor/import-transaction-safety.js?v=20260806-1'},
    {id:'pdfViewportLazyPreviewScriptV1',src:'/js/pdf-editor/viewport-lazy-preview.js?v=20260909-2'},
    {id:'pdfViewportLazyPreviewGuardScriptV1',src:'/js/pdf-editor/viewport-lazy-preview-guard.js?v=20260914-1'},
    {id:'pdfFileNavigationScriptV1',src:'/js/pdf-editor/file-navigation.js?v=20260806-1'},
    {id:'pdfLayoutSmoothPreviewScriptV1',src:'/js/pdf-editor/layout-smooth-preview.js?v=20260909-1'},
    {id:'pdfPreviewInsertPersistenceScriptV1',src:'/js/pdf-editor/preview-insert-persistence.js?v=20260914-3'},
    {id:'pdfDividerLocalImageUploadScriptV1',src:'/js/pdf-divider-local-image-upload.js?v=20260830-1'},
    {id:'pdfDividerModalLayoutScriptV1',src:'/js/pdf-editor/divider-modal-layout.js?v=20260830-2'},
    {id:'pdfEditorFinalCheckScriptV1',src:'/js/pdf-editor-final-check.js?v=20260828-1'},
    {id:'pdfEditorSpreadSplitScriptV1',src:'/js/pdf-editor/spread-split.js?v=20260825-1'},
    {id:'pdfBookletSheetPreviewScriptV1',src:'/js/pdf-editor/booklet-sheet-preview.js?v=20260825-1'}
  ]);

  const ADVANCED_UNUSED_ROUTE_IDS=new Set([
    'pdfLayoutSmoothPreviewScriptV1',
    'pdfPreviewInsertPersistenceScriptV1',
    'pdfDividerLocalImageUploadScriptV1',
    'pdfDividerModalLayoutScriptV1',
    'pdfEditorSpreadSplitScriptV1',
    'pdfBookletSheetPreviewScriptV1'
  ]);

  const context=()=>window.ProgramStudioPdfEditorRuntimeContext||{};
  const params=()=>new URLSearchParams(location.search);
  const standaloneApp=()=>{
    const value=(params().get('app')||'').trim().toLowerCase();
    return value==='layout'||value==='booklet'?value:'';
  };
  const isAdvancedProfile=()=>{
    if(document.documentElement.dataset.pdfEditorProfile==='advanced')return true;
    if(String(location.pathname||'').replace(/\/+$/,'').endsWith('/pdf-editor-advanced'))return true;
    return String(params().get('profile')||'').trim().toLowerCase()==='advanced';
  };

  function removeStandardSidebarTitle(){
    if(isAdvancedProfile())return;
    const remove=()=>{
      const title=document.querySelector('.app > aside > h1');
      if(title&&String(title.textContent||'').trim()==='PDF 문서 편집기'){
        title.remove();
        document.documentElement.dataset.pdfLayoutSidebarTitleRemoved='1';
      }
    };
    remove();
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',remove,{once:true});
  }

  function hostLoadScript(id,src){
    const loader=context().load;
    if(typeof loader!=='function'){
      return Promise.reject(new Error('Program Studio PDF route loader is unavailable'));
    }
    return loader(id,src);
  }

  function hostLoad(entry){
    return hostLoadScript(entry.id,entry.src);
  }

  function loadStandaloneBoundary(){
    if(!standaloneApp())return Promise.resolve(true);
    return hostLoadScript('pdfEditorStandaloneAppProfileScriptV1','/js/pdf-editor/standalone-app-profile.js?v=20260831-1')
      .then(()=>hostLoadScript('pdfEditorAppBoundaryScriptV1','/js/pdf-editor/app-boundary.js?v=20260909-1'));
  }

  function loadImageInput(){
    return hostLoadScript('programImagePdfAdapterScriptV1','/js/image-pdf-adapter.js?v=20260915-1')
      .then(()=>hostLoadScript('pdfEditorImageInputBridgeScriptV1','/js/pdf-editor/image-input-bridge.js?v=20260915-2'));
  }

  function loadLayoutUiRefinements(){
    return hostLoadScript('pdfPreviewZoomPersistenceScriptV2','/js/pdf-editor/preview-zoom-persistence.js?v=20260915-3')
      .then(()=>hostLoadScript('pdfLayoutUiRefinementsScriptV1','/js/pdf-editor/layout-ui-refinements.js?v=20260915-2'))
      .then(()=>hostLoadScript('pdfOrientationSidebarCleanupScriptV2','/js/pdf-editor/orientation-sidebar-cleanup.js?v=20260915-2'))
      .then(()=>hostLoadScript('programSidebarActionsScriptV1','/js/program-sidebar-actions.js?v=20260916-1'));
  }

  function loadAll(){
    const seen=new Set();
    const pending=[];
    const app=standaloneApp();
    const advanced=isAdvancedProfile();
    removeStandardSidebarTitle();
    if(app==='layout'){
      window.__pdfEditorHiddenContextActionV1=true;
    }
    if(app)pending.push(loadStandaloneBoundary());
    for(const entry of MODULES){
      if(!entry.id||!entry.src||seen.has(entry.id)){
        console.warn('[pdf-route-runtime] manifest entry skipped',entry);
        continue;
      }
      if(entry.app&&entry.app!==app)continue;
      if(advanced&&ADVANCED_UNUSED_ROUTE_IDS.has(entry.id))continue;
      seen.add(entry.id);
      pending.push(hostLoad(entry));
    }
    if(advanced)document.documentElement.dataset.pdfAdvancedRouteModules='minimal';
    return Promise.all(pending)
      .then(()=>advanced?true:loadImageInput())
      .then(()=>advanced?true:loadLayoutUiRefinements())
      .then(()=>advanced?true:hostLoadScript('pdfDividerUiCorrectionsScriptV1','/js/pdf-editor/divider-ui-corrections.js?v=20260914-2'))
      .then(()=>{
        document.documentElement.dataset.pdfRouteRuntime='1';
        if(app){
          const profile=window.PdfEditorStandaloneApps?.fromLocation?.(location.search);
          document.documentElement.dataset.pdfStandaloneApp=profile?.key||app;
        }
        return true;
      });
  }

  window.PdfEditorRouteRuntime={
    loadAll,
    isAdvancedProfile,
    modules:MODULES.map(({id,src})=>({id,src})),
    app:standaloneApp(),
    get profile(){return window.PdfEditorStandaloneApps?.fromLocation?.(location.search)?.key||null;},
    stage:'pdf-editor-route-runtime-manifest-v7-unified-sidebar-actions'
  };
})();
