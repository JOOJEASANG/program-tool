// Advanced PDF editor runtime.
// Loaded only by /pdf-editor-advanced so the default editor stays lightweight.
(function(){
  'use strict';
  if(window.__pdfEditorAdvancedRuntimeV1)return;
  window.__pdfEditorAdvancedRuntimeV1=true;

  const PRECISION_EDIT_INPUT_IDS=new Set([
    'pdfNupAdjustScaleRange','pdfNupAdjustScale','pdfNupAdjustX','pdfNupAdjustY',
    'pdfPageCropLeftV1','pdfPageCropTopV1','pdfPageCropRightV1','pdfPageCropBottomV1',
    'pdfFineRotationDegV1',
  ]);

  const context=()=>window.ProgramStudioPdfEditorRuntimeContext||{};

  function editorPages(){
    if(Array.isArray(window.parsedPages))return window.parsedPages;
    try{return typeof parsedPages!=='undefined'&&Array.isArray(parsedPages)?parsedPages:[];}catch(_){return[];}
  }

  function installDragCropPlacementPanelSync(){
    if(window.__pdfDragCropPlacementPanelSyncV1)return;
    window.__pdfDragCropPlacementPanelSyncV1=true;
    document.addEventListener('pdf-drag-crop-autofit-applied',event=>{
      try{
        const pageId=String(event?.detail?.pageId||'');
        if(!pageId)return;
        const page=editorPages().find(item=>String(item?.id)===pageId);
        if(!page)return;
        const transform=window.PdfPageTransformEdit;
        if(typeof transform?.setValues==='function'){
          transform.setValues(page,{rotationLocked:true});
          document.documentElement.dataset.pdfAdvancedDragCropOrientationLock='1';
        }else{
          page.pageRotationLocked=true;
          document.documentElement.dataset.pdfAdvancedDragCropOrientationLock='fallback';
        }
        if(typeof window.PdfNupPageAdjust?.selectPage==='function')window.PdfNupPageAdjust.selectPage(page);
        if(typeof window.PdfNupPageAdjust?.refresh==='function')window.PdfNupPageAdjust.refresh();
        else if(typeof window.PdfEditorLayoutExport?.refresh==='function')window.PdfEditorLayoutExport.refresh();
      }catch(error){console.warn('[pdf-advanced-runtime] drag crop orientation/placement sync failed',error);}
    },true);
  }

  function precisionInputPage(){
    const hit=document.querySelector('.pdf-nup-adjust-hit[data-selected="true"]');
    const pageId=String(hit?.dataset?.pageId||'');
    if(!pageId)return null;
    return editorPages().find(page=>String(page?.id)===pageId)||null;
  }

  function precisionInputLabel(id){
    if(id==='pdfFineRotationDegV1')return'미세 회전';
    if(String(id||'').startsWith('pdfPageCrop'))return'자르기 수치 조정';
    return'페이지 위치·크기 조정';
  }

  function restartPrecisionInputHistory(target){
    if(!PRECISION_EDIT_INPUT_IDS.has(target?.id))return;
    try{
      const history=window.PdfPrecisionEditTools?.history;
      const page=precisionInputPage();
      if(!page||typeof history?.begin!=='function')return;
      if(typeof history.commit==='function')history.commit();
      history.begin(page,precisionInputLabel(target.id),'focus');
    }catch(error){console.warn('[pdf-advanced-runtime] precision input history bridge failed',error);}
  }

  function syncPrecisionInputValue(target){
    if(!PRECISION_EDIT_INPUT_IDS.has(target?.id))return;
    const page=precisionInputPage();
    if(!page)return;
    try{
      const id=target.id;
      if(id==='pdfFineRotationDegV1'){
        const value=typeof window.PdfPrecisionEditTools?.fineForPage==='function'
          ?Number(window.PdfPrecisionEditTools.fineForPage(page)||0):Number(page.fineRotationDeg||0);
        target.value=Number.isFinite(value)?value.toFixed(1):'0.0';
        return;
      }
      if(id.startsWith('pdfPageCrop')){
        const api=window.PdfPageTransformEdit;
        const value=typeof api?.valuesForPage==='function'?api.valuesForPage(page):{
          cropLeft:Number(page.cropLeftRatio||0),cropTop:Number(page.cropTopRatio||0),
          cropRight:Number(page.cropRightRatio||0),cropBottom:Number(page.cropBottomRatio||0),
        };
        const visual=typeof api?.visualCrop==='function'?api.visualCrop(value):{
          left:Number(value.cropLeft||0),top:Number(value.cropTop||0),right:Number(value.cropRight||0),bottom:Number(value.cropBottom||0),
        };
        const edgeMap={pdfPageCropLeftV1:'left',pdfPageCropTopV1:'top',pdfPageCropRightV1:'right',pdfPageCropBottomV1:'bottom'};
        const ratio=Number(visual?.[edgeMap[id]]||0);
        target.value=(Number.isFinite(ratio)?ratio*100:0).toFixed(1);
        return;
      }
      const placement=typeof window.PdfNupPageAdjust?.valuesForPage==='function'
        ?window.PdfNupPageAdjust.valuesForPage(page)
        :{scale:Number(page.nupScale||1),offsetX:Number(page.nupOffsetX||0),offsetY:Number(page.nupOffsetY||0)};
      if(id==='pdfNupAdjustScale'||id==='pdfNupAdjustScaleRange'){
        const scale=Number(placement?.scale||1);target.value=String(Math.round((Number.isFinite(scale)?scale:1)*100));
      }else if(id==='pdfNupAdjustX'){
        const value=Number(placement?.offsetX||0);target.value=(Number.isFinite(value)?value:0).toFixed(1);
      }else if(id==='pdfNupAdjustY'){
        const value=Number(placement?.offsetY||0);target.value=(Number.isFinite(value)?value:0).toFixed(1);
      }
    }catch(error){console.warn('[pdf-advanced-runtime] precision input value sync failed',error);}
  }

  function installPrecisionInputHistoryBridge(){
    if(window.__pdfPrecisionInputHistoryBridgeV1)return;
    window.__pdfPrecisionInputHistoryBridgeV1=true;
    document.addEventListener('pointerdown',event=>{if(PRECISION_EDIT_INPUT_IDS.has(event.target?.id))restartPrecisionInputHistory(event.target);},true);
    document.addEventListener('focusin',event=>{if(PRECISION_EDIT_INPUT_IDS.has(event.target?.id))restartPrecisionInputHistory(event.target);},true);
    window.addEventListener('keydown',event=>{
      const target=event.target;if(!PRECISION_EDIT_INPUT_IDS.has(target?.id))return;
      if(!(event.ctrlKey||event.metaKey)||event.altKey)return;
      const key=String(event.key||'').toLowerCase();if(key!=='z'&&key!=='y')return;
      setTimeout(()=>syncPrecisionInputValue(target),0);
    },true);
  }

  function fallbackLoad(id,src){
    const existing=document.getElementById(id);
    if(existing&&existing.dataset.loaded==='true')return Promise.resolve(true);
    return new Promise((resolve,reject)=>{
      const script=existing||document.createElement('script');
      if(!existing){script.id=id;script.src=src;script.async=false;document.head.appendChild(script);}
      script.addEventListener('load',()=>{script.dataset.loaded='true';resolve(true);},{once:true});
      script.addEventListener('error',()=>reject(new Error(`PDF advanced runtime failed: ${id}`)),{once:true});
    });
  }

  function load(id,src){const loader=context().load;return typeof loader==='function'?loader(id,src):fallbackLoad(id,src);}

  const loadAdvancedShellLayout=()=>load('pdfAdvancedShellLayoutScriptV1','/js/pdf-editor/advanced-shell-layout.js?v=20260909-2');
  const loadPreviewZoomPersistence=()=>load('pdfPreviewZoomPersistenceScriptV1','/js/pdf-editor/preview-zoom-persistence.js?v=20260908-1');
  const loadNupInteractionStability=()=>load('pdfNupInteractionStabilityScriptV1','/js/pdf-editor/nup-interaction-stability.js?v=20260908-2');
  const loadNupPageAdjust=()=>load('pdfNupPageAdjustScriptV1','/js/pdf-editor/nup-page-adjust.js?v=20260908-1');
  const loadPageTransformEdit=()=>load('pdfPageTransformEditScriptV1','/js/pdf-editor/page-transform-edit.js?v=20260908-1');
  const loadDirectPageEdit=()=>load('pdfDirectPageEditScriptV2','/js/pdf-editor/direct-page-edit-v2.js?v=20260909-2');
  const loadDragCropAutoFit=()=>load('pdfDragCropAutoFitScriptV1','/js/pdf-editor/drag-crop-autofit.js?v=20260908-2');
  const loadNupDirectPreviewEdit=()=>load('pdfNupDirectPreviewEditScriptV1','/js/pdf-editor/nup-direct-preview-edit.js?v=20260908-1');
  const loadEditorInteractionPolish=()=>load('pdfEditorInteractionPolishScriptV1','/js/pdf-editor/editor-interaction-polish.js?v=20260908-1');
  const loadOrientationScaleRegression=()=>load('pdfOrientationScaleRegressionScriptV1','/js/pdf-editor/orientation-scale-regression-fix.js?v=20260908-1');
  const loadPrecisionEditTools=()=>load('pdfPrecisionEditToolsScriptV1','/js/pdf-editor/precision-edit-tools.js?v=20260908-1');
  const loadAdvancedWorkspaceUx=()=>load('pdfAdvancedWorkspaceUxScriptV1','/js/pdf-editor/advanced-workspace-ux.js?v=20260909-1');
  const loadDirectPageEditQuickbar=()=>load('pdfDirectPageEditQuickbarScriptV1','/js/pdf-editor/direct-page-edit-quickbar.js?v=20260909-2');
  const loadAdvancedEditPersistencePolish=()=>load('pdfAdvancedEditPersistencePolishScriptV1','/js/pdf-editor/advanced-edit-persistence-polish.js?v=20260909-1');

  let loading=null;
  function loadAll(){
    if(loading)return loading;
    installDragCropPlacementPanelSync();installPrecisionInputHistoryBridge();
    // Load the shell first. Header removal, sidebar actions and upload affordance
    // must be stable before heavier editing helpers begin their waterfall.
    loading=Promise.resolve()
      .then(()=>loadAdvancedShellLayout())
      .then(()=>loadPreviewZoomPersistence())
      .then(()=>loadNupInteractionStability())
      .then(()=>loadNupPageAdjust())
      .then(()=>loadPageTransformEdit())
      .then(()=>loadDirectPageEdit())
      .then(()=>loadDragCropAutoFit())
      .then(()=>loadNupDirectPreviewEdit())
      .then(()=>loadEditorInteractionPolish())
      .then(()=>loadOrientationScaleRegression())
      .then(()=>loadPrecisionEditTools())
      .then(()=>loadAdvancedWorkspaceUx())
      .then(()=>loadDirectPageEditQuickbar())
      .then(()=>loadAdvancedEditPersistencePolish())
      .then(()=>{document.documentElement.dataset.pdfAdvancedRuntime='1';return true;});
    return loading;
  }

  installDragCropPlacementPanelSync();installPrecisionInputHistoryBridge();

  window.PdfEditorAdvancedRuntime={
    loadAll,
    stage:'pdf-editor-advanced-runtime-v1',
    modules:Object.freeze([
      'advanced-shell-layout','preview-zoom-persistence','nup-interaction-stability','nup-page-adjust',
      'page-transform-edit','direct-page-edit-v2','drag-crop-autofit','nup-direct-preview-edit',
      'editor-interaction-polish','orientation-scale-regression-fix','precision-edit-tools',
      'advanced-workspace-ux','direct-page-edit-quickbar','advanced-edit-persistence-polish'
    ])
  };
})();
