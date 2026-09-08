// Keeps N-up direct manipulation anchored to the exact visible output face.
(function(){
  'use strict';
  if(window.__pdfNupInteractionStabilityV1)return;
  window.__pdfNupInteractionStabilityV1=true;
  const smokeHost=document.documentElement.dataset.pdfNupStabilityHost==='1';
  if(!location.pathname.includes('pdf-editor')&&!smokeHost)return;

  const INSTALL_DELAYS=[0,180,420,800,1300,2100,3300,5000];
  const STABLE_EDIT_INPUT_IDS=new Set([
    'pdfNupAdjustScaleRange','pdfNupAdjustScale','pdfNupAdjustX','pdfNupAdjustY',
    'pdfPageCropLeftV1','pdfPageCropTopV1','pdfPageCropRightV1','pdfPageCropBottomV1',
    'pdfFineRotationDegV1',
    'marginLeft','marginRight','marginTop','marginBottom','marginH','marginV',
    'pnMarginMm','pnFontSize','pnEnabled','pnAutoReserve','pnApplyTo','pnExcludeFirst','facingPages',
  ]);
  const STABLE_EDIT_ACTION_IDS=new Set([
    'pdfNupAdjustReset','pdfNupAdjustResetAll',
    'pdfPageRotateLeftV1','pdfPageRotateRightV1','pdfPageCropResetV1',
    'pdfFineRotationResetV1','pdfDragCropAutoFitV1',
  ]);
  const byId=id=>document.getElementById(id);
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

  let drag=null;
  let restoring=false;
  let suppressClickUntil=0;
  let suppressPageId='';
  let wrappedLazyObject=null;
  let wrappedLazyRequest=null;
  let editViewport=null;
  let editReleaseTimer=null;
  let editRestoreTimers=[];
  let previewMutationObserver=null;
  let restoreFrame=0;

  function pages(){
    try{return Array.isArray(parsedPages)?parsedPages:[];}catch(_){return[];}
  }

  function pageById(id){
    return pages().find(page=>String(page.id)===String(id))||null;
  }

  function valuesForPage(page){
    try{
      return window.PdfNupPageAdjust?.valuesForPage?.(page)||{
        scale:Number(page?.nupScale)||1,
        offsetX:Number(page?.nupOffsetX)||0,
        offsetY:Number(page?.nupOffsetY)||0,
      };
    }catch(_){
      return{scale:1,offsetX:0,offsetY:0};
    }
  }

  function paperSize(){
    try{
      const settings=typeof getSettings==='function'?getSettings():null;
      const width=Number(settings?.pw);
      const height=Number(settings?.ph);
      return{
        width:Number.isFinite(width)&&width>0?width:210,
        height:Number.isFinite(height)&&height>0?height:297,
      };
    }catch(_){
      return{width:210,height:297};
    }
  }

  function anchorForScroll(scroll){
    if(!scroll)return null;
    const wraps=[...scroll.querySelectorAll('.page-preview')];
    if(!wraps.length)return null;
    let wrap=document.querySelector('.pdf-nup-adjust-hit[data-selected="true"]')?.closest?.('.page-preview');
    if(!wrap||!scroll.contains(wrap)){
      const scrollRect=scroll.getBoundingClientRect();
      const centerY=scrollRect.top+Math.max(1,Math.min(scroll.clientHeight||scrollRect.height,scrollRect.height||scroll.clientHeight))/2;
      wrap=wraps.find(node=>{
        const rect=node.getBoundingClientRect();
        return rect.bottom>=centerY&&rect.top<=centerY;
      })||wraps[0];
    }
    if(!wrap)return null;
    const scrollRect=scroll.getBoundingClientRect();
    const rect=wrap.getBoundingClientRect();
    return{
      outputIndex:String(wrap.dataset?.outputIndex??''),
      domIndex:wraps.indexOf(wrap),
      offsetTop:rect.top-scrollRect.top,
      offsetLeft:rect.left-scrollRect.left,
    };
  }

  function resolveAnchor(scroll,anchor){
    if(!scroll||!anchor)return null;
    const wraps=[...scroll.querySelectorAll('.page-preview')];
    if(anchor.outputIndex){
      const exact=wraps.find(node=>String(node.dataset?.outputIndex??'')===anchor.outputIndex);
      if(exact)return exact;
    }
    return wraps[anchor.domIndex]||null;
  }

  function scrollSnapshot(){
    const scroll=byId('previewScroll');
    return{
      scroll,
      scrollTop:Number(scroll?.scrollTop||0),
      scrollLeft:Number(scroll?.scrollLeft||0),
      windowX:Number(window.scrollX||0),
      windowY:Number(window.scrollY||0),
      anchor:anchorForScroll(scroll),
    };
  }

  function activeScrollSnapshot(){
    return drag?.scroll||editViewport?.scroll||null;
  }

  function restoreScroll(snapshot=activeScrollSnapshot()){
    if(!snapshot||restoring)return;
    restoring=true;
    try{
      const scroll=snapshot.scroll?.isConnected?snapshot.scroll:byId('previewScroll');
      if(scroll){
        if(Math.abs(scroll.scrollTop-snapshot.scrollTop)>.5)scroll.scrollTop=snapshot.scrollTop;
        if(Math.abs(scroll.scrollLeft-snapshot.scrollLeft)>.5)scroll.scrollLeft=snapshot.scrollLeft;
        const anchor=resolveAnchor(scroll,snapshot.anchor);
        if(anchor&&snapshot.anchor){
          const scrollRect=scroll.getBoundingClientRect();
          const rect=anchor.getBoundingClientRect();
          const dy=(rect.top-scrollRect.top)-snapshot.anchor.offsetTop;
          const dx=(rect.left-scrollRect.left)-snapshot.anchor.offsetLeft;
          if(Math.abs(dy)>.5)scroll.scrollTop+=dy;
          if(Math.abs(dx)>.5)scroll.scrollLeft+=dx;
        }
      }
      if(Math.abs((window.scrollX||0)-snapshot.windowX)>.5||Math.abs((window.scrollY||0)-snapshot.windowY)>.5){
        window.scrollTo(snapshot.windowX,snapshot.windowY);
      }
    }finally{
      restoring=false;
    }
  }

  function installStyles(){
    if(byId('pdfNupInteractionStabilityStylesV1'))return;
    const style=document.createElement('style');
    style.id='pdfNupInteractionStabilityStylesV1';
    style.textContent=`
      #previewScroll{overflow-anchor:none}
      html[data-pdf-nup-interaction-lock="1"],html[data-pdf-nup-interaction-lock="1"] body,
      html[data-pdf-advanced-viewport-lock="1"],html[data-pdf-advanced-viewport-lock="1"] body{scroll-behavior:auto!important;overscroll-behavior:none!important}
      html[data-pdf-nup-interaction-lock="1"] #previewScroll,
      html[data-pdf-advanced-viewport-lock="1"] #previewScroll{overflow-anchor:none!important;scroll-behavior:auto!important;overscroll-behavior:none!important}
      html[data-pdf-nup-interaction-lock="1"] #previewScroll,html[data-pdf-nup-interaction-lock="1"] #previewScroll *{user-select:none!important;-webkit-user-select:none!important}
    `;
    document.head.appendChild(style);
  }

  function pageLabel(page){
    const list=pages();
    const index=list.indexOf(page);
    const fileName=String(page?.sourceFile||'').trim();
    const pageNumber=index>=0?index+1:Number(page?.page_index||0)+1;
    return`${pageNumber}페이지${fileName?` · ${fileName}`:''}`;
  }

  function syncVisiblePanel(page,current){
    const scalePercent=Math.round(Number(current.scale||1)*100);
    const range=byId('pdfNupAdjustScaleRange');
    const scale=byId('pdfNupAdjustScale');
    const x=byId('pdfNupAdjustX');
    const y=byId('pdfNupAdjustY');
    const state=byId('pdfNupAdjustState');
    const badge=byId('pdfNupAdjustBadge');
    const label=byId('pdfNupAdjustSelectedLabel');
    if(range)range.value=String(scalePercent);
    if(scale)scale.value=String(scalePercent);
    if(x)x.value=Number(current.offsetX||0).toFixed(1);
    if(y)y.value=Number(current.offsetY||0).toFixed(1);
    if(state)state.value='보정 적용';
    if(badge)badge.textContent='보정됨';
    if(label)label.textContent=pageLabel(page);
    document.querySelectorAll('.pdf-nup-adjust-hit').forEach(node=>{
      node.dataset.selected=String(node.dataset.pageId===String(page.id));
      if(node.dataset.pageId===String(page.id))node.dataset.adjusted='true';
    });
  }

  function applyValues(page,next){
    const api=window.PdfNupPageAdjust;
    if(typeof api?.setValues==='function'){
      api.setValues(page,next);
      return;
    }
    page.nupScale=clamp(Number(next.scale)||1,.5,3);
    page.nupOffsetX=clamp(Number(next.offsetX)||0,-200,200);
    page.nupOffsetY=clamp(Number(next.offsetY)||0,-200,200);
  }

  function clearEditRestoreTimers(){
    editRestoreTimers.forEach(timer=>clearTimeout(timer));
    editRestoreTimers=[];
  }

  function queueLockedRestore(){
    if(document.documentElement.dataset.pdfNupInteractionLock!=='1'
      &&document.documentElement.dataset.pdfAdvancedViewportLock!=='1')return;
    if(restoreFrame)return;
    restoreFrame=requestAnimationFrame(()=>{
      restoreFrame=0;
      restoreScroll();
    });
  }

  function scheduleEditRestoreBurst(){
    clearEditRestoreTimers();
    const current=editViewport;
    [0,24,56,100,170,280,440,700].forEach(delay=>{
      const timer=setTimeout(()=>{
        if(editViewport!==current)return;
        restoreScroll(current?.scroll);
      },delay);
      editRestoreTimers.push(timer);
    });
  }

  function scheduleEditRelease(delay=720){
    clearTimeout(editReleaseTimer);
    editReleaseTimer=setTimeout(()=>{
      if(!editViewport)return;
      const active=document.activeElement;
      if(editViewport.sticky&&STABLE_EDIT_INPUT_IDS.has(active?.id)){
        scheduleEditRelease(delay);
        return;
      }
      releaseEditViewport();
    },delay);
  }

  function holdEditViewport(sticky=false,releaseDelay=720){
    if(drag)return;
    if(!editViewport){
      editViewport={scroll:scrollSnapshot(),sticky:false};
      document.documentElement.dataset.pdfAdvancedViewportLock='1';
    }
    if(sticky)editViewport.sticky=true;
    restoreScroll(editViewport.scroll);
    scheduleEditRestoreBurst();
    if(!editViewport.sticky)scheduleEditRelease(releaseDelay);
  }

  function releaseEditViewport(){
    if(!editViewport)return;
    const snapshot=editViewport.scroll;
    editViewport=null;
    clearTimeout(editReleaseTimer);
    clearEditRestoreTimers();
    restoreScroll(snapshot);
    delete document.documentElement.dataset.pdfAdvancedViewportLock;
    restoreScroll(snapshot);
  }

  function isCropOverlayTarget(target){
    return!!target?.closest?.('#pdfPageCropOverlayV1,#pdfDragCropOverlayV1');
  }

  function beginStableEdit(event){
    const target=event.target;
    if(STABLE_EDIT_INPUT_IDS.has(target?.id)){
      holdEditViewport(true);
      return;
    }
    if(STABLE_EDIT_ACTION_IDS.has(target?.id)||isCropOverlayTarget(target)){
      holdEditViewport(false,900);
    }
  }

  function focusStableEdit(event){
    if(STABLE_EDIT_INPUT_IDS.has(event.target?.id))holdEditViewport(true);
  }

  function updateStableEdit(event){
    if(STABLE_EDIT_INPUT_IDS.has(event.target?.id))holdEditViewport(true);
  }

  function finishStableEdit(event){
    if(STABLE_EDIT_INPUT_IDS.has(event.target?.id)&&editViewport){
      editViewport.sticky=false;
      scheduleEditRestoreBurst();
      scheduleEditRelease(760);
      return;
    }
    if(isCropOverlayTarget(event.target)&&editViewport){
      editViewport.sticky=false;
      scheduleEditRestoreBurst();
      scheduleEditRelease(900);
    }
  }

  function clickStableEdit(event){
    if(STABLE_EDIT_ACTION_IDS.has(event.target?.id)){
      if(editViewport)editViewport.sticky=false;
      holdEditViewport(false,900);
    }
  }

  function appliedStableCrop(){
    if(editViewport){
      editViewport.sticky=false;
      scheduleEditRestoreBurst();
      scheduleEditRelease(900);
    }else{
      holdEditViewport(false,900);
    }
  }

  function installPreviewMutationObserver(){
    const scroll=byId('previewScroll');
    if(!scroll||previewMutationObserver?.__target===scroll)return;
    previewMutationObserver?.disconnect?.();
    previewMutationObserver=new MutationObserver(queueLockedRestore);
    previewMutationObserver.__target=scroll;
    previewMutationObserver.observe(scroll,{childList:true,subtree:true,attributes:true,attributeFilter:['style','class','data-output-index']});
  }

  function begin(event){
    if(event.button!==0)return;
    const hit=event.target?.closest?.('.pdf-nup-adjust-hit');
    if(!hit)return;
    const page=pageById(hit.dataset.pageId);
    const wrap=hit.closest('.page-preview');
    const canvas=wrap?.querySelector('canvas');
    if(!page||!canvas)return;

    releaseEditViewport();
    const rect=canvas.getBoundingClientRect();
    const mode=event.target?.closest?.('.pdf-nup-adjust-handle')?'scale':'move';
    drag={
      pointerId:event.pointerId,
      page,
      hit,
      canvas,
      wrap,
      outputIndex:Number.isFinite(Number(wrap?.dataset?.outputIndex))?Number(wrap.dataset.outputIndex):null,
      mode,
      startX:event.clientX,
      startY:event.clientY,
      start:valuesForPage(page),
      canvasWidth:Math.max(1,rect.width||1),
      canvasHeight:Math.max(1,rect.height||1),
      paper:paperSize(),
      scroll:scrollSnapshot(),
      moved:false,
    };

    document.documentElement.dataset.pdfNupInteractionLock='1';
    document.documentElement.dataset.pdfNupInteractionOutput=drag.outputIndex==null?'':String(drag.outputIndex);
    restoreScroll(drag.scroll);

    // This capture listener is intentionally loaded before the legacy target
    // handler. Stop propagation here so that handler cannot schedule a full
    // preview rebuild on pointer-up. Other document capture listeners (the live
    // canvas painter) still receive the same event.
    event.preventDefault();
    event.stopPropagation();
    try{hit.setPointerCapture?.(event.pointerId);}catch(_){}
  }

  function move(event){
    const state=drag;
    if(!state||event.pointerId!==state.pointerId)return;
    event.preventDefault();
    event.stopPropagation();

    const dx=event.clientX-state.startX;
    const dy=event.clientY-state.startY;
    if(Math.abs(dx)+Math.abs(dy)>2)state.moved=true;

    let next;
    if(state.mode==='scale'){
      const factor=Math.exp((dx-dy)/180);
      next={scale:state.start.scale*factor};
    }else{
      next={
        offsetX:state.start.offsetX+dx/state.canvasWidth*state.paper.width,
        offsetY:state.start.offsetY+dy/state.canvasHeight*state.paper.height,
      };
    }
    applyValues(state.page,next);
    syncVisiblePanel(state.page,valuesForPage(state.page));
    restoreScroll(state.scroll);
  }

  function finishScrollLock(snapshot){
    const restore=()=>restoreScroll(snapshot);
    let released=false;
    const release=()=>{
      if(released)return;
      released=true;
      restore();
      delete document.documentElement.dataset.pdfNupInteractionLock;
      delete document.documentElement.dataset.pdfNupInteractionOutput;
      restore();
    };

    restore();
    const fallback=setTimeout(release,96);
    requestAnimationFrame(()=>{
      restore();
      requestAnimationFrame(()=>{
        clearTimeout(fallback);
        release();
      });
    });
  }

  function end(event){
    const state=drag;
    if(!state||event.pointerId!==state.pointerId)return;
    event.preventDefault();
    event.stopPropagation();

    drag=null;
    suppressClickUntil=Date.now()+420;
    suppressPageId=String(state.page.id);

    // Commit only selection state. Do not request a new lazy/full preview here:
    // the live canvas already shows the edit, while final PDF rendering reads
    // the stored values directly. This keeps the exact output face stationary.
    try{window.PdfNupPageAdjust?.selectPage?.(state.page);}catch(_){}
    finishScrollLock(state.scroll);
  }

  function suppressSyntheticClick(event){
    if(Date.now()>suppressClickUntil)return;
    const hit=event.target?.closest?.('.pdf-nup-adjust-hit');
    if(!hit||String(hit.dataset.pageId)!==suppressPageId)return;
    event.preventDefault();
    event.stopImmediatePropagation();
    event.stopPropagation();
  }

  function enforceScroll(){
    if(document.documentElement.dataset.pdfNupInteractionLock!=='1'
      &&document.documentElement.dataset.pdfAdvancedViewportLock!=='1')return;
    restoreScroll();
  }

  function wrapLazyRequest(){
    const lazy=window.PdfViewportLazyPreview;
    if(!lazy||typeof lazy.requestRender!=='function')return false;
    if(lazy===wrappedLazyObject&&lazy.requestRender===wrappedLazyRequest)return true;
    if(lazy.requestRender.__pdfNupInteractionStableV1){
      wrappedLazyObject=lazy;
      wrappedLazyRequest=lazy.requestRender;
      return true;
    }
    const original=lazy.requestRender.bind(lazy);
    const wrapped=function stableLazyRequest(outputIndex){
      if(document.documentElement.dataset.pdfNupInteractionLock==='1'){
        return Promise.resolve(false);
      }
      const snapshot=editViewport?.scroll||null;
      const result=original(outputIndex);
      if(snapshot){
        scheduleEditRestoreBurst();
        Promise.resolve(result).finally(()=>{
          if(editViewport?.scroll===snapshot)scheduleEditRestoreBurst();
        });
      }
      return result;
    };
    wrapped.__pdfNupInteractionStableV1=true;
    wrapped.__pdfNupInteractionOriginal=original;
    lazy.requestRender=wrapped;
    wrappedLazyObject=lazy;
    wrappedLazyRequest=wrapped;
    return true;
  }

  function install(){
    installStyles();
    wrapLazyRequest();
    installPreviewMutationObserver();
    if(document.documentElement.dataset.pdfNupInteractionStabilityEvents==='1')return;
    document.documentElement.dataset.pdfNupInteractionStabilityEvents='1';

    // Capture listeners must be registered before nup-page-adjust.js so they can
    // prevent the old target-level pointer handler from starting a rebuild cycle.
    document.addEventListener('pointerdown',beginStableEdit,true);
    document.addEventListener('focusin',focusStableEdit,true);
    document.addEventListener('input',updateStableEdit,true);
    document.addEventListener('change',updateStableEdit,true);
    document.addEventListener('focusout',finishStableEdit,true);
    document.addEventListener('pointerup',finishStableEdit,true);
    document.addEventListener('pointercancel',finishStableEdit,true);
    document.addEventListener('click',clickStableEdit,true);
    document.addEventListener('pdf-drag-crop-autofit-applied',appliedStableCrop,true);
    document.addEventListener('pointerdown',begin,true);
    document.addEventListener('pointermove',move,true);
    document.addEventListener('pointerup',end,true);
    document.addEventListener('pointercancel',end,true);
    document.addEventListener('click',suppressSyntheticClick,true);
    document.addEventListener('scroll',enforceScroll,true);
    window.addEventListener('scroll',enforceScroll,true);
  }

  window.PdfNupInteractionStability={
    restoreScroll,
    isLocked:()=>document.documentElement.dataset.pdfNupInteractionLock==='1'||document.documentElement.dataset.pdfAdvancedViewportLock==='1',
    holdViewport:()=>holdEditViewport(false,900),
    releaseViewport:releaseEditViewport,
    stage:'fixed-output-face-direct-edit-v1',
    viewportStage:'advanced-edit-fixed-viewport-v1',
  };

  for(const delay of INSTALL_DELAYS)setTimeout(install,delay);
})();
