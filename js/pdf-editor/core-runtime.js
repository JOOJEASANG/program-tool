// Canonical PDF editor core-module manifest.
(function(){
  'use strict';
  if(window.__pdfEditorCoreRuntimeV1)return;
  window.__pdfEditorCoreRuntimeV1=true;

  const MODULES=Object.freeze([
    {id:'pdfEditorFontRenderFixScriptV1',src:'/js/pdf-editor/font-render-fix.js?v=20260618-1'},
    {id:'pdfEditorUploadFixScriptV1',src:'/js/pdf-editor/upload-fix.js?v=20260724-5'},
    {id:'pdfEditorLivePreviewScriptV1',src:'/js/pdf-editor/live-preview.js?v=20260724-4'},
    {id:'pdfEditorLayoutExportScriptV1',src:'/js/pdf-editor/layout-export.js?v=20260731-3'},
    {id:'pdfEditorPageCountHintScriptV1',src:'/js/pdf-editor/page-count-hint.js?v=20260731-1'},
    {id:'pdfEditorNupHelperScriptV1',src:'/js/pdf-editor/nup-helper.js?v=20260830-1'},
    {id:'pdfEditorPreviewRowDefaultScriptV1',src:'/js/pdf-editor/preview-row-default.js?v=20260831-1'},
    {id:'pdfEditorDividerHelperScriptV1',src:'/js/pdf-editor/divider-helper.js?v=20260731-2'}
  ]);

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

  function ensureBookletStylesheet(){
    if(document.getElementById('pdfBookletMenuSafeCssV1'))return;
    const link=document.createElement('link');
    link.id='pdfBookletMenuSafeCssV1';
    link.rel='stylesheet';
    link.href='/css/pdf-booklet-menu-safe.css?v=20260902-1';
    document.head.appendChild(link);
  }

  function installUploadOrderModeSafety(){
    if(window.__pdfUploadOrderModeSafetyV1)return;
    window.__pdfUploadOrderModeSafetyV1=true;
    document.addEventListener('click',event=>{
      if(!event.target?.closest?.('.mode-btn,#uploadZone'))return;
      window.__pdfUploadOrderRequestedMode='';
    },true);
  }

  function installDragCropPlacementPanelSync(){
    if(window.__pdfDragCropPlacementPanelSyncV1)return;
    window.__pdfDragCropPlacementPanelSyncV1=true;
    document.addEventListener('pdf-drag-crop-autofit-applied',event=>{
      try{
        const pageId=String(event?.detail?.pageId||'');
        if(!pageId)return;
        const page=editorPages().find(item=>String(item?.id)===pageId);
        if(page&&typeof window.PdfNupPageAdjust?.selectPage==='function'){
          window.PdfNupPageAdjust.selectPage(page);
        }
      }catch(error){
        console.warn('[pdf-core-runtime] drag crop placement panel sync failed',error);
      }
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
      // Commit the prior focused edit (or the no-change pointer transaction)
      // and immediately start a fresh focus-owned edit. This also works when
      // the input was already focused and therefore emits no new focusin.
      if(typeof history.commit==='function')history.commit();
      history.begin(page,precisionInputLabel(target.id),'focus');
    }catch(error){
      console.warn('[pdf-core-runtime] precision input history bridge failed',error);
    }
  }

  function syncPrecisionInputValue(target){
    if(!PRECISION_EDIT_INPUT_IDS.has(target?.id))return;
    const page=precisionInputPage();
    if(!page)return;
    try{
      const id=target.id;
      if(id==='pdfFineRotationDegV1'){
        const value=typeof window.PdfPrecisionEditTools?.fineForPage==='function'
          ? Number(window.PdfPrecisionEditTools.fineForPage(page)||0)
          : Number(page.fineRotationDeg||0);
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
          left:Number(value.cropLeft||0),top:Number(value.cropTop||0),
          right:Number(value.cropRight||0),bottom:Number(value.cropBottom||0),
        };
        const edgeMap={
          pdfPageCropLeftV1:'left',pdfPageCropTopV1:'top',
          pdfPageCropRightV1:'right',pdfPageCropBottomV1:'bottom',
        };
        const ratio=Number(visual?.[edgeMap[id]]||0);
        target.value=(Number.isFinite(ratio)?ratio*100:0).toFixed(1);
        return;
      }
      const placement=typeof window.PdfNupPageAdjust?.valuesForPage==='function'
        ? window.PdfNupPageAdjust.valuesForPage(page)
        : {scale:Number(page.nupScale||1),offsetX:Number(page.nupOffsetX||0),offsetY:Number(page.nupOffsetY||0)};
      if(id==='pdfNupAdjustScale'||id==='pdfNupAdjustScaleRange'){
        const scale=Number(placement?.scale||1);
        target.value=String(Math.round((Number.isFinite(scale)?scale:1)*100));
      }else if(id==='pdfNupAdjustX'){
        const value=Number(placement?.offsetX||0);
        target.value=(Number.isFinite(value)?value:0).toFixed(1);
      }else if(id==='pdfNupAdjustY'){
        const value=Number(placement?.offsetY||0);
        target.value=(Number.isFinite(value)?value:0).toFixed(1);
      }
    }catch(error){
      console.warn('[pdf-core-runtime] precision input value sync failed',error);
    }
  }

  function installPrecisionInputHistoryBridge(){
    if(window.__pdfPrecisionInputHistoryBridgeV1)return;
    window.__pdfPrecisionInputHistoryBridgeV1=true;

    // PrecisionEditTools opens pointer transactions on window capture. This
    // document-capture listener runs later in the same pointerdown, so it can
    // safely convert every numeric click into a focus-owned transaction,
    // including repeated clicks while the control is already focused.
    document.addEventListener('pointerdown',event=>{
      if(PRECISION_EDIT_INPUT_IDS.has(event.target?.id))restartPrecisionInputHistory(event.target);
    },true);

    // Keyboard/tab focus has no pointerdown, so start the same transaction on
    // focusin as a fallback.
    document.addEventListener('focusin',event=>{
      if(PRECISION_EDIT_INPUT_IDS.has(event.target?.id))restartPrecisionInputHistory(event.target);
    },true);

    // This window listener is registered before PrecisionEditTools. It queues
    // a post-undo/redo control sync before that module consumes propagation.
    window.addEventListener('keydown',event=>{
      const target=event.target;
      if(!PRECISION_EDIT_INPUT_IDS.has(target?.id))return;
      if(!(event.ctrlKey||event.metaKey)||event.altKey)return;
      const key=String(event.key||'').toLowerCase();
      if(key!=='z'&&key!=='y')return;
      setTimeout(()=>syncPrecisionInputValue(target),0);
    },true);
  }

  function fallbackLoad(id,src){
    const existing=document.getElementById(id);
    if(existing&&existing.dataset.loaded==='true')return Promise.resolve(true);
    return new Promise((resolve,reject)=>{
      const script=existing||document.createElement('script');
      if(!existing){
        script.id=id;
        script.src=src;
        script.async=false;
        document.head.appendChild(script);
      }
      script.addEventListener('load',()=>{script.dataset.loaded='true';resolve(true);},{once:true});
      script.addEventListener('error',()=>reject(new Error(`PDF core runtime failed: ${id}`)),{once:true});
    });
  }

  function loadEntry(entry){
    const loader=context().load;
    return typeof loader==='function' ? loader(entry.id,entry.src) : fallbackLoad(entry.id,entry.src);
  }

  function loadUploadOrderUi(){
    const id='pdfUploadOrderUiScriptV1';
    const src='/js/pdf-editor/upload-order-ui.js?v=20260831-1';
    const loader=context().load;
    return typeof loader==='function' ? loader(id,src) : fallbackLoad(id,src);
  }

  function loadPreviewZoomPersistence(){
    const id='pdfPreviewZoomPersistenceScriptV1';
    const src='/js/pdf-editor/preview-zoom-persistence.js?v=20260908-1';
    const loader=context().load;
    return typeof loader==='function' ? loader(id,src) : fallbackLoad(id,src);
  }

  function loadNupInteractionStability(){
    const id='pdfNupInteractionStabilityScriptV1';
    const src='/js/pdf-editor/nup-interaction-stability.js?v=20260908-1';
    const loader=context().load;
    return typeof loader==='function' ? loader(id,src) : fallbackLoad(id,src);
  }

  function loadNupPageAdjust(){
    const id='pdfNupPageAdjustScriptV1';
    const src='/js/pdf-editor/nup-page-adjust.js?v=20260908-1';
    const loader=context().load;
    return typeof loader==='function' ? loader(id,src) : fallbackLoad(id,src);
  }

  function loadPageTransformEdit(){
    const id='pdfPageTransformEditScriptV1';
    const src='/js/pdf-editor/page-transform-edit.js?v=20260908-1';
    const loader=context().load;
    return typeof loader==='function' ? loader(id,src) : fallbackLoad(id,src);
  }

  function loadDragCropAutoFit(){
    const id='pdfDragCropAutoFitScriptV1';
    const src='/js/pdf-editor/drag-crop-autofit.js?v=20260908-2';
    const loader=context().load;
    return typeof loader==='function' ? loader(id,src) : fallbackLoad(id,src);
  }

  function loadNupDirectPreviewEdit(){
    const id='pdfNupDirectPreviewEditScriptV1';
    const src='/js/pdf-editor/nup-direct-preview-edit.js?v=20260908-1';
    const loader=context().load;
    return typeof loader==='function' ? loader(id,src) : fallbackLoad(id,src);
  }

  function loadEditorInteractionPolish(){
    const id='pdfEditorInteractionPolishScriptV1';
    const src='/js/pdf-editor/editor-interaction-polish.js?v=20260908-1';
    const loader=context().load;
    return typeof loader==='function' ? loader(id,src) : fallbackLoad(id,src);
  }

  function loadOrientationScaleRegression(){
    const id='pdfOrientationScaleRegressionScriptV1';
    const src='/js/pdf-editor/orientation-scale-regression-fix.js?v=20260908-1';
    const loader=context().load;
    return typeof loader==='function' ? loader(id,src) : fallbackLoad(id,src);
  }

  function loadPrecisionEditTools(){
    const id='pdfPrecisionEditToolsScriptV1';
    const src='/js/pdf-editor/precision-edit-tools.js?v=20260908-1';
    const loader=context().load;
    return typeof loader==='function' ? loader(id,src) : fallbackLoad(id,src);
  }

  function loadAll(){
    ensureBookletStylesheet();
    installUploadOrderModeSafety();
    installDragCropPlacementPanelSync();
    installPrecisionInputHistoryBridge();
    const seen=new Set();
    const pending=[];
    for(const entry of MODULES){
      if(!entry.id||!entry.src||seen.has(entry.id))continue;
      seen.add(entry.id);
      pending.push(loadEntry(entry));
    }
    pending.push(loadUploadOrderUi());
    return Promise.all(pending)
      .then(()=>loadPreviewZoomPersistence())
      .then(()=>loadNupInteractionStability())
      .then(()=>loadNupPageAdjust())
      .then(()=>loadPageTransformEdit())
      .then(()=>loadDragCropAutoFit())
      .then(()=>loadNupDirectPreviewEdit())
      .then(()=>loadEditorInteractionPolish())
      .then(()=>loadOrientationScaleRegression())
      .then(()=>loadPrecisionEditTools())
      .then(()=>{
        document.documentElement.dataset.pdfCoreRuntime='1';
        return true;
      });
  }

  installDragCropPlacementPanelSync();
  installPrecisionInputHistoryBridge();

  window.PdfEditorCoreRuntime={
    loadAll,
    modules:MODULES.map(({id,src})=>({id,src})),
    stage:'pdf-editor-core-runtime-manifest-v1'
  };
})();
