// Canonical runtime owner for the PDF inspection + utility route.
(function(){
  'use strict';
  if(window.__pdfPreflightRouteRuntimeV1)return;
  window.__pdfPreflightRouteRuntimeV1=true;

  const context=window.ProgramStudioPreflightRuntimeContext||{};
  const load=typeof context.load==='function'?context.load:null;
  if(!load)throw new Error('PDF preflight runtime loader context is unavailable');

  // Keep first interaction light: upload, batch inspection and the canonical
  // workspace shell load first. Feature-specific utilities continue after the
  // page is already interactive.
  const CRITICAL_MODULES=Object.freeze([
    {id:'programShellUnifyScriptV1',src:'/js/program-shell-unify.js?v=20260824-1'},
    {id:'pdfCheckerFinalGuardScript',src:'/js/pdf-checker-final-guard.js?v=20260831-1'},
    {id:'pdfUtilityScriptV1',src:'/js/pdf-utility.js?v=20260831-1'},
    {id:'pdfUtilityWideLayoutScriptV1',src:'/js/pdf-utility-wide-layout.js?v=20260821-1'},
    {id:'pdfUtilityPanelResizerScriptV1',src:'/js/pdf-utility-panel-resizer.js?v=20260823-1'},
    {id:'pdfUtilityFinalizeScriptV1',src:'/js/pdf-utility-finalize.js?v=20260831-2'},
    {id:'pdfAllInOneStage1ScriptV1',src:'/js/pdf-all-in-one-stage1.js?v=20260831-2'},
    {id:'pdfPreflightWorkflowV2Script',src:'/js/pdf-preflight/workflow-v2.js?v=20260831-1'}
  ]);

  const DEFERRED_MODULES=Object.freeze([
    {id:'pdfUtilityMarginCropScriptV1',src:'/js/pdf-utility-margin-crop.js?v=20260819-1'},
    {id:'pdfUtilityBackgroundMarginLabelsScriptV1',src:'/js/pdf-utility-background-margin-labels.js?v=20260819-2'},
    {id:'pdfUtilityImageConverterScriptV1',src:'/js/pdf-utility-image-converter.js?v=20260819-1'},
    {id:'pdfUtilityImageConverterFinalizeScriptV1',src:'/js/pdf-utility-image-converter-finalize.js?v=20260827-2'},
    {id:'pdfSecurityLargeFileScriptV1',src:'/js/pdf-utility/security-large-file.js?v=20260831-2'},
    {id:'pdfUtilityCostGuardScriptV2',src:'/js/pdf-utility-cost-guard-v2.js?v=20260831-2'},
    {id:'pdfPrintReadinessScriptV1',src:'/js/pdf-print-readiness.js?v=20260831-1'},
    {id:'pdfPrintAutoFixScriptV1',src:'/js/pdf-print-auto-fix.js?v=20260831-1'},
    {id:'pdfLargeOutputTilingScriptV1',src:'/js/pdf-large-output-tiling.js?v=20260831-1'}
  ]);

  // Keep this declaration physically last among manifest entries. Older visual
  // helpers may mutate the same workspace; the clean-workspace owner must win.
  const PANEL_BALANCE_MODULE=Object.freeze(
    {id:'pdfPreflightPanelBalanceScriptV1',src:'/js/pdf-preflight-panel-balance.js?v=20260831-2'}
  );

  const MODULES=Object.freeze([...CRITICAL_MODULES,...DEFERRED_MODULES,PANEL_BALANCE_MODULE]);
  let readyPromise=null;
  let deferredPromise=null;
  let deferredScheduled=false;

  async function loadEntries(entries){
    const loaded=[];
    for(const entry of entries){
      await load(entry.id,entry.src);
      loaded.push(entry.id);
    }
    return loaded;
  }

  function loadDeferred(){
    if(deferredPromise)return deferredPromise;
    deferredPromise=loadEntries(DEFERRED_MODULES).then(async loaded=>{
      // Re-sync the final clean workspace after optional feature modules mutate
      // their controls. The existing script is reused by the host loader.
      await load(PANEL_BALANCE_MODULE.id,PANEL_BALANCE_MODULE.src);
      window.PdfPreflightPanelBalance?.sync?.();
      document.documentElement.dataset.pdfPreflightDeferred='ready';
      return loaded;
    }).catch(error=>{
      document.documentElement.dataset.pdfPreflightDeferred='failed';
      console.warn('[pdf-preflight-runtime] deferred feature loading failed',error);
      return [];
    });
    window.ProgramStudioPreflightDeferredReady=deferredPromise;
    return deferredPromise;
  }

  function scheduleDeferred(){
    if(deferredScheduled)return;
    deferredScheduled=true;
    const run=()=>loadDeferred();
    if(typeof requestIdleCallback==='function')requestIdleCallback(run,{timeout:1400});
    else setTimeout(run,250);
  }

  async function loadAll(){
    if(readyPromise)return readyPromise;
    readyPromise=(async()=>{
      const loaded=await loadEntries(CRITICAL_MODULES);
      loaded.push(...await loadEntries([PANEL_BALANCE_MODULE]));
      document.documentElement.dataset.pdfPreflightRuntime='canonical-v2-critical-ready';
      scheduleDeferred();
      return loaded;
    })();
    return readyPromise;
  }

  window.ProgramStudioPreflightRuntime={
    modules:MODULES,
    criticalModules:Object.freeze([...CRITICAL_MODULES,PANEL_BALANCE_MODULE]),
    deferredModules:DEFERRED_MODULES,
    loadAll,
    loadDeferred,
    stage:'canonical-preflight-runtime-v1'
  };
})();