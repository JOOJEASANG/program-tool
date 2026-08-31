// Canonical PDF-editor route runtime.
// sw-register.js only chooses the route; this manifest owns editor-specific helpers.
(function(){
  'use strict';
  if(window.__pdfEditorRouteRuntimeV1)return;
  window.__pdfEditorRouteRuntimeV1=true;

  const MODULES=Object.freeze([
    {id:'programShellUnifyScriptV1',src:'/js/program-shell-unify.js?v=20260831-1'},
    {id:'pdfAllInOneStage1ScriptV1',src:'/js/pdf-all-in-one-stage1.js?v=20260824-1'},
    {id:'desktopToolMobileNoticeScriptV1',src:'/js/desktop-tool-mobile-notice.js?v=20260807-1'},
    {id:'pdfEditorModuleLoaderScript',src:'/js/pdf-editor/loader.js?v=20260828-1'},
    {id:'pdfEditorTransferLimitGuardScriptV1',src:'/js/pdf-editor/transfer-limit-guard.js?v=20260818-1'},
    {id:'pdfCropMarksScript',src:'/js/pdf-editor/crop-marks.js?v=20260731-4'},
    {id:'pdfSaveOperationScript',src:'/js/pdf-editor/save-operation.js?v=20260731-3'},
    {id:'pdfSaveRecoveryScript',src:'/js/pdf-editor/save-recovery.js?v=20260803-1'},
    {id:'pdfSessionSaveSafetyScriptV1',src:'/js/pdf-editor/session-save-safety.js?v=20260805-2'},
    {id:'pdfFileContextScopeScript',src:'/js/pdf-editor/file-context-scope.js?v=20260805-1'},
    {id:'pdfImportTransactionSafetyScriptV1',src:'/js/pdf-editor/import-transaction-safety.js?v=20260806-1'},
    {id:'pdfViewportLazyPreviewScriptV1',src:'/js/pdf-editor/viewport-lazy-preview.js?v=20260806-1'},
    {id:'pdfViewportLazyPreviewGuardScriptV1',src:'/js/pdf-editor/viewport-lazy-preview-guard.js?v=20260806-1'},
    {id:'pdfFileNavigationScriptV1',src:'/js/pdf-editor/file-navigation.js?v=20260806-1'},
    {id:'pdfPreviewInsertPersistenceScriptV1',src:'/js/pdf-editor/preview-insert-persistence.js?v=20260831-1'},
    {id:'pdfDividerLocalImageUploadScriptV1',src:'/js/pdf-divider-local-image-upload.js?v=20260830-1'},
    {id:'pdfDividerModalLayoutScriptV1',src:'/js/pdf-editor/divider-modal-layout.js?v=20260830-2'},
    {id:'pdfEditorFinalCheckScriptV1',src:'/js/pdf-editor-final-check.js?v=20260828-1'},
    {id:'pdfEditorSpreadSplitScriptV1',src:'/js/pdf-editor/spread-split.js?v=20260825-1'},
    {id:'pdfBookletSheetPreviewScriptV1',src:'/js/pdf-editor/booklet-sheet-preview.js?v=20260825-1'}
  ]);

  const context=()=>window.ProgramStudioPdfEditorRuntimeContext||{};

  function hostLoad(entry){
    const loader=context().load;
    if(typeof loader!=='function'){
      return Promise.reject(new Error('Program Studio PDF route loader is unavailable'));
    }
    return loader(entry.id,entry.src);
  }

  function loadAll(){
    const seen=new Set();
    const pending=[];
    for(const entry of MODULES){
      if(!entry.id||!entry.src||seen.has(entry.id)){
        console.warn('[pdf-route-runtime] manifest entry skipped',entry);
        continue;
      }
      seen.add(entry.id);
      // Start requests in manifest order, matching the previous sw-register behavior,
      // while allowing the browser to fetch independent helpers without a waterfall.
      pending.push(hostLoad(entry));
    }
    return Promise.all(pending).then(()=>{
      document.documentElement.dataset.pdfRouteRuntime='1';
      return true;
    });
  }

  window.PdfEditorRouteRuntime={
    loadAll,
    modules:MODULES.map(({id,src})=>({id,src})),
    stage:'pdf-editor-route-runtime-manifest-v1'
  };
})();
