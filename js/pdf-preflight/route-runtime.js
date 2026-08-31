// Canonical runtime owner for the PDF inspection + utility route.
(function(){
  'use strict';
  if(window.__pdfPreflightRouteRuntimeV2)return;
  window.__pdfPreflightRouteRuntimeV2=true;

  const context=window.ProgramStudioPreflightRuntimeContext||{};
  const load=typeof context.load==='function'?context.load:null;
  if(!load)throw new Error('PDF preflight runtime loader context is unavailable');

  // The current workspace shell is applied first so approved users are not kept
  // behind a loading curtain while the heavier functional helpers are fetched.
  // Older helpers no longer own branding/presentation, so this order is stable.
  const MODULES=Object.freeze([
    {id:'programShellUnifyScriptV1',src:'/js/program-shell-unify.js?v=20260824-1'},
    {id:'pdfPreflightPanelBalanceScriptV1',src:'/js/pdf-preflight-panel-balance.js?v=20260831-2'},
    {id:'pdfCheckerFinalGuardScript',src:'/js/pdf-checker-final-guard.js?v=20260831-1'},
    {id:'pdfUtilityScriptV1',src:'/js/pdf-utility.js?v=20260831-1'},
    {id:'pdfUtilityMarginCropScriptV1',src:'/js/pdf-utility-margin-crop.js?v=20260819-1'},
    {id:'pdfUtilityBackgroundMarginLabelsScriptV1',src:'/js/pdf-utility-background-margin-labels.js?v=20260819-2'},
    {id:'pdfUtilityImageConverterScriptV1',src:'/js/pdf-utility-image-converter.js?v=20260819-1'},
    {id:'pdfUtilityImageConverterFinalizeScriptV1',src:'/js/pdf-utility-image-converter-finalize.js?v=20260827-2'},
    {id:'pdfSecurityLargeFileScriptV1',src:'/js/pdf-utility/security-large-file.js?v=20260831-2'},
    {id:'pdfUtilityWideLayoutScriptV1',src:'/js/pdf-utility-wide-layout.js?v=20260821-1'},
    {id:'pdfUtilityPanelResizerScriptV1',src:'/js/pdf-utility-panel-resizer.js?v=20260823-1'},
    {id:'pdfUtilityCostGuardScriptV2',src:'/js/pdf-utility-cost-guard-v2.js?v=20260831-2'},
    {id:'pdfUtilityFinalizeScriptV1',src:'/js/pdf-utility-finalize.js?v=20260831-2'},
    {id:'pdfAllInOneStage1ScriptV1',src:'/js/pdf-all-in-one-stage1.js?v=20260831-2'},
    {id:'pdfPrintReadinessScriptV1',src:'/js/pdf-print-readiness.js?v=20260831-1'},
    {id:'pdfPrintAutoFixScriptV1',src:'/js/pdf-print-auto-fix.js?v=20260831-1'},
    {id:'pdfLargeOutputTilingScriptV1',src:'/js/pdf-large-output-tiling.js?v=20260831-1'},
    {id:'pdfPreflightWorkflowV2Script',src:'/js/pdf-preflight/workflow-v2.js?v=20260831-1'}
  ]);

  let readyPromise=null;
  async function loadAll(){
    if(readyPromise)return readyPromise;
    readyPromise=(async()=>{
      const loaded=[];
      for(const entry of MODULES){
        await load(entry.id,entry.src);
        loaded.push(entry.id);
        if(entry.id==='pdfPreflightPanelBalanceScriptV1'){
          document.documentElement.dataset.pdfPreflightShellReady='1';
        }
      }
      document.documentElement.dataset.pdfPreflightRuntime='canonical-v2';
      return loaded;
    })();
    return readyPromise;
  }

  window.ProgramStudioPreflightRuntime={
    modules:MODULES,
    loadAll,
    stage:'canonical-preflight-runtime-v2'
  };
})();