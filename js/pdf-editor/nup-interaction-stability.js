// Keeps N-up direct manipulation anchored to the exact visible output face.
(function(){
  'use strict';
  if(window.__pdfNupInteractionStabilityV1)return;
  window.__pdfNupInteractionStabilityV1=true;
  if(!location.pathname.includes('pdf-editor'))return;

  const INSTALL_DELAYS=[0,180,420,800,1300,2100,3300,5000];
  const byId=id=>document.getElementById(id);
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

  let drag=null;
  let restoring=false;
  let suppressClickUntil=0;
  let suppressPageId='';
  let wrappedLazyObject=null;
  let wrappedLazyRequest=null;

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

  function scrollSnapshot(){
    const scroll=byId('previewScroll');
    return{
      scroll,
      scrollTop:Number(scroll?.scrollTop||0),
      scrollLeft:Number(scroll?.scrollLeft||0),
      windowX:Number(window.scrollX||0),
      windowY:Number(window.scrollY||0),
    };
  }

  function restoreScroll(snapshot=drag?.scroll){
    if(!snapshot||restoring)return;
    restoring=true;
    try{
      const scroll=snapshot.scroll?.isConnected?snapshot.scroll:byId('previewScroll');
      if(scroll){
        if(Math.abs(scroll.scrollTop-snapshot.scrollTop)>.5)scroll.scrollTop=snapshot.scrollTop;
        if(Math.abs(scroll.scrollLeft-snapshot.scrollLeft)>.5)scroll.scrollLeft=snapshot.scrollLeft;
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
      html[data-pdf-nup-interaction-lock="1"],html[data-pdf-nup-interaction-lock="1"] body{scroll-behavior:auto!important;overscroll-behavior:none!important}
      html[data-pdf-nup-interaction-lock="1"] #previewScroll{overflow-anchor:none!important;scroll-behavior:auto!important;overscroll-behavior:none!important}
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

  function begin(event){
    if(event.button!==0)return;
    const hit=event.target?.closest?.('.pdf-nup-adjust-hit');
    if(!hit)return;
    const page=pageById(hit.dataset.pageId);
    const wrap=hit.closest('.page-preview');
    const canvas=wrap?.querySelector('canvas');
    if(!page||!canvas)return;

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
    restore();
    requestAnimationFrame(()=>{
      restore();
      requestAnimationFrame(()=>{
        restore();
        delete document.documentElement.dataset.pdfNupInteractionLock;
        delete document.documentElement.dataset.pdfNupInteractionOutput;
        restore();
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
    if(document.documentElement.dataset.pdfNupInteractionLock!=='1')return;
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
      return original(outputIndex);
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
    if(document.documentElement.dataset.pdfNupInteractionStabilityEvents==='1')return;
    document.documentElement.dataset.pdfNupInteractionStabilityEvents='1';

    // Capture listeners must be registered before nup-page-adjust.js so they can
    // prevent the old target-level pointer handler from starting a rebuild cycle.
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
    isLocked:()=>document.documentElement.dataset.pdfNupInteractionLock==='1',
    stage:'fixed-output-face-direct-edit-v1',
  };

  for(const delay of INSTALL_DELAYS)setTimeout(install,delay);
})();
