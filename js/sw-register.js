// Service/runtime loader for Program Studio.
// Existing file content is intentionally preserved; this commit adds the PDF utility image converter loader.
(function(){
  'use strict';
  if(window.__programStudioSwRegisterV1)return;
  window.__programStudioSwRegisterV1=true;

  const VERSION='20260819-1';
  const path=()=>location.pathname.replace(/\/+$/,'')||'/';
  const isAuthPage=()=>/^\/login(?:\.html)?\/?$/.test(location.pathname);
  const isHome=()=>path()==='/'||path()==='/index.html';
  const isPath=(...values)=>values.includes(path());
  const load=(id,src)=>new Promise((resolve,reject)=>{
    if(document.getElementById(id)){resolve();return;}
    const script=document.createElement('script');script.id=id;script.src=src;script.async=false;
    script.onload=()=>resolve();script.onerror=()=>reject(new Error('script load failed: '+src));document.head.appendChild(script);
  });
  const loadCatalogCore=()=>load('programCatalogCoreScriptV1','/js/program-catalog-core.js?v=20260819-1');

  function helpers(){
    const tasks=[];
    if(!isAuthPage())tasks.push(load('appVersionHelperScript','/js/app-version.js?v=20260819-1'));
    if(isHome()){
      tasks.push(loadCatalogCore());
      tasks.push(load('homeHeaderFooterRefineScript','/js/home-header-footer-refine.js?v='+VERSION));
    }
    if(isPath('/admin','/admin.html')){
      tasks.push(loadCatalogCore().then(()=>load('adminProgramCatalogManagerScriptV1','/js/admin-program-catalog-manager.js?v=20260808-1')).then(()=>load('adminProgramCatalogNavGuardScriptV1','/js/admin-program-catalog-nav-guard.js?v=20260818-1')));
      tasks.push(load('adminProgramIconPaletteScriptV1','/js/admin-program-icon-palette.js?v=20260808-1'));
    }
    if(isPath('/tools/pdf-editor.html','/pdf-editor','/pdf-editor/index.html','/tools/perfect-binding-cover.html','/perfect-binding-cover','/perfect-binding-cover/index.html')){
      tasks.push(load('desktopToolMobileNoticeScriptV1','/js/desktop-tool-mobile-notice.js?v=20260807-1'));
    }
    if(isPath('/tools/pdf-editor.html','/pdf-editor','/pdf-editor/index.html')){
      tasks.push(load('pdfEditorModuleLoaderScript','/js/pdf-editor/loader.js?v='+VERSION));
      tasks.push(load('pdfEditorTransferLimitGuardScriptV1','/js/pdf-editor/transfer-limit-guard.js?v=20260818-1'));
      tasks.push(load('pdfCropMarksScript','/js/pdf-editor/crop-marks.js?v=20260731-4'));
      tasks.push(load('pdfSaveOperationScript','/js/pdf-editor/save-operation.js?v=20260731-3'));
      tasks.push(load('pdfSaveRecoveryScript','/js/pdf-editor/save-recovery.js?v=20260803-1'));
      tasks.push(load('pdfSessionSaveSafetyScript','/js/pdf-editor/session-save-safety.js?v=20260805-2'));
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
      tasks.push(finalGuard);tasks.push(panelBalance);
      tasks.push(Promise.all([finalGuard,panelBalance])
        .then(()=>load('pdfUtilityScriptV1','/js/pdf-utility.js?v=20260818-1'))
        .then(()=>load('pdfUtilityMarginCropScriptV1','/js/pdf-utility-margin-crop.js?v=20260819-1'))
        .then(()=>load('pdfUtilityImageConverterScriptV1','/js/pdf-utility-image-converter.js?v=20260819-1'))
        .then(()=>load('pdfUtilityFinalizeScriptV1','/js/pdf-utility-finalize.js?v=20260818-3')));
    }
    if(isPath('/tools/perfect-binding-cover.html','/perfect-binding-cover','/perfect-binding-cover/index.html')){
      tasks.push(load('coverLargeFilePolicyScriptV1','/js/cover-large-file-policy.js?v=20260818-1'));
      tasks.push(load('perfectBindingFineControlsScript','/js/perfect-binding-cover-fine-controls.js?v='+VERSION));
      tasks.push(load('coverTextZonesScriptV3','/js/cover-editor-text-zones-v2.js?v='+VERSION));
      tasks.push(load('coverSpineOrientationControlsScriptV1','/js/cover-spine-orientation-controls.js?v=20260806-1'));
      tasks.push(load('coverTextUiRefineScriptV4','/js/cover-text-ui-refine.js?v='+VERSION));
      tasks.push(load('coverPreviewWorkspaceScriptV2','/js/cover-preview-workspace.js?v='+VERSION));
      tasks.push(load('coverProjectStateBridgeScriptV1','/js/cover-project-state-bridge.js?v='+VERSION));
      tasks.push(load('coverTemplateProjectSafetyScriptV2','/js/cover-template-project-safety.js?v=20260805-1'));
      tasks.push(load('coverTemplateSurfaceCleanupScriptV1','/js/cover-template-surface-cleanup.js?v=20260806-1'));
      tasks.push(load('coverImagePrintQualityScriptV1','/js/cover-image-print-quality.js?v=20260806-1'));
      tasks.push(load('coverSpinePrintSafetyScriptV1','/js/cover-spine-print-safety.js?v=20260806-1'));
      tasks.push(load('coverFinalOutputConfirmScriptV1','/js/cover-final-output-confirm.js?v=20260806-1'));
      tasks.push(load('coverLayoutLockScriptV1','/js/cover-layout-lock.js?v=20260806-1'));
      tasks.push(load('coverRecoveryCheckpointsScriptV1','/js/cover-recovery-checkpoints.js?v=20260806-1'));
      tasks.push(load('coverFloatingActionDockScriptV2','/js/cover-floating-action-dock.js?v=20260806-1'));
      tasks.push(load('coverUiRuntimeNormalizerScriptV1','/js/cover-ui-runtime-normalizer.js?v=20260805-1'));
      tasks.push(load('coverOutputPerformanceSafetyScriptV1','/js/cover-output-performance-safety.js?v=20260805-1'));
      tasks.push(load('coverRuntimeSafetyScriptV1','/js/cover-runtime-safety.js?v=20260805-1'));
      tasks.push(load('coverTextCanvasControlsScriptV1','/js/cover-text-canvas-controls.js?v=20260806-1'));
    }
    return Promise.allSettled(tasks);
  }
  const boot=()=>helpers().catch(error=>console.warn('[sw-register]',error));
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
