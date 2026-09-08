// Final compatibility guard for PDF page rotation and direct resize semantics.
// Keeps every preview source canvas canonical (rotation 0), treats legacy rotate
// actions as exact user intent, and guarantees corner drag outward=grow/inward=shrink.
(function(){
  'use strict';
  if(window.__pdfOrientationScaleRegressionFixV1)return;
  window.__pdfOrientationScaleRegressionFixV1=true;

  const smokeHost=document.documentElement.dataset.pdfOrientationScaleRegressionHost==='1';
  if(!location.pathname.includes('pdf-editor')&&!smokeHost)return;

  const MIN_SCALE=.5;
  const MAX_SCALE=3;
  const INSTALL_DELAYS=[0,100,240,520,900,1500,2400,3800,6000];
  const rotationStates=new WeakMap();
  const byId=id=>document.getElementById(id);
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const normal=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;

  let scaleDrag=null;
  let eventsInstalled=false;
  let renderWrapper=null;
  let renderOriginal=null;
  let safetyWrapper=null;
  let safetyOriginal=null;
  let safetyOwner=null;
  let apiWrapper=null;
  let fetchWrapper=null;
  let collectWrapper=null;
  let loadWrapper=null;

  function pages(){
    try{return Array.isArray(parsedPages)?parsedPages:[];}catch(_){return[];}
  }

  function pageById(id){
    return pages().find(page=>String(page.id)===String(id))||null;
  }

  function normalizedRotation(value){
    const rotation=((Math.round(normal(value,0)/90)*90)%360+360)%360;
    return[0,90,180,270].includes(rotation)?rotation:0;
  }

  function currentLock(page){
    return!!(page?.pageRotationLocked??page?.rotationLocked);
  }

  function hasLockField(page){
    return!!page&&(
      Object.prototype.hasOwnProperty.call(page,'pageRotationLocked')||
      Object.prototype.hasOwnProperty.call(page,'rotationLocked')
    );
  }

  function ensureRotationState(page){
    if(!page)return null;
    let state=rotationStates.get(page);
    if(state)return state;
    const rotation=normalizedRotation(page.rotation);
    let lock=currentLock(page);
    // Older saved sessions only carried a non-zero `rotation`. Treat that as a
    // deliberate user orientation instead of allowing auto-fit to rotate again.
    if(!hasLockField(page)&&rotation!==0){
      page.pageRotationLocked=true;
      lock=true;
    }
    state={rotation,lock,history:[]};
    rotationStates.set(page,state);
    return state;
  }

  function trimHistory(state){
    while(state.history.length>24)state.history.shift();
  }

  function noteRenderedRotation(page,requested){
    const state=ensureRotationState(page);
    if(!state)return;
    const next=normalizedRotation(requested);
    if(next===state.rotation){
      state.lock=currentLock(page);
      return;
    }

    const previous=state.history[state.history.length-1];
    if(previous&&previous.rotation===next){
      state.history.pop();
      page.pageRotationLocked=!!previous.lock;
      state.lock=!!previous.lock;
    }else{
      state.history.push({rotation:state.rotation,lock:currentLock(page)});
      trimHistory(state);
      page.pageRotationLocked=true;
      state.lock=true;
    }
    state.rotation=next;
  }

  function syncRotationIntent(){
    pages().forEach(page=>{
      if(!page||page.pageType==='divider'||page.pageType==='blank')return;
      const state=ensureRotationState(page);
      const next=normalizedRotation(page.rotation);
      if(next!==state.rotation){
        const explicit=currentLock(page);
        state.history.push({rotation:state.rotation,lock:state.lock});
        trimHistory(state);
        if(explicit){
          page.pageRotationLocked=true;
          state.lock=true;
        }else if(next!==0){
          // Legacy state mutation without the new lock field is still a user
          // rotation. Do not let backend auto-fit add another quarter turn.
          page.pageRotationLocked=true;
          state.lock=true;
        }
        state.rotation=next;
      }else{
        state.lock=currentLock(page);
      }
    });
  }

  function noteMatchingPageIntent(pdfPage,requested){
    pages().forEach(page=>{
      if(page?.pdfPage===pdfPage)noteRenderedRotation(page,requested);
    });
  }

  function markCanonicalCanvas(canvas,requested){
    if(!canvas?.dataset)return canvas;
    canvas.dataset.pdfCanonicalSourceRotation='0';
    canvas.dataset.pdfRequestedRotation=String(normalizedRotation(requested));
    return canvas;
  }

  function installRenderWrapper(){
    const current=window.renderPdfPage;
    if(typeof current!=='function')return false;
    if(current===renderWrapper)return true;
    if(current.__pdfCanonicalRotationSourceV1){
      renderWrapper=current;
      renderOriginal=current.__pdfCanonicalRotationOriginal||renderOriginal;
      return true;
    }

    const original=current;
    const wrapped=async function canonicalRotationRender(pdfPage,scale,rotation){
      const requested=normalizedRotation(rotation);
      // Existing rotate/context/batch actions change page.rotation before they
      // request a rerender. Observe that transition and lock the exact angle.
      noteMatchingPageIntent(pdfPage,requested);

      // All page-transform editing is applied from one canonical rotation-0
      // source. This prevents a legacy rerendered thumbnail from being rotated
      // a second time by page-transform-edit.js.
      const canvas=await original.call(this,pdfPage,scale,0);
      return markCanonicalCanvas(canvas,requested);
    };
    wrapped.__pdfCanonicalRotationSourceV1=true;
    wrapped.__pdfCanonicalRotationOriginal=original;
    window.renderPdfPage=wrapped;
    try{renderPdfPage=wrapped;}catch(_){}
    renderWrapper=wrapped;
    renderOriginal=original;
    return true;
  }

  function installSafetyRenderWrapper(){
    const safety=window.PdfImportTransactionSafety;
    const current=safety?.safeRenderPdfPage;
    if(typeof current!=='function')return false;
    if(current===safetyWrapper&&safety===safetyOwner)return true;
    if(current.__pdfCanonicalRotationSourceV1){
      safetyWrapper=current;
      safetyOriginal=current.__pdfCanonicalRotationOriginal||safetyOriginal;
      safetyOwner=safety;
      return true;
    }

    const original=current;
    const wrapped=async function canonicalSafetyRender(pdfPage,scale,rotation,heavyMode){
      const requested=normalizedRotation(rotation);
      noteMatchingPageIntent(pdfPage,requested);
      // viewport-lazy-preview uses this safety renderer directly for hydrated
      // large-document pages, bypassing window.renderPdfPage. Force that path
      // through the same rotation-0 source contract as ordinary previews.
      const canvas=await original.call(safety,pdfPage,scale,0,heavyMode);
      return markCanonicalCanvas(canvas,requested);
    };
    wrapped.__pdfCanonicalRotationSourceV1=true;
    wrapped.__pdfCanonicalRotationOriginal=original;
    safety.safeRenderPdfPage=wrapped;
    safetyWrapper=wrapped;
    safetyOriginal=original;
    safetyOwner=safety;
    return true;
  }

  async function canonicalizeExistingRotatedPages(){
    if(typeof renderOriginal!=='function')return;
    for(const page of pages()){
      if(!page?.pdfPage||normalizedRotation(page.rotation)===0)continue;
      if(page.thumbCanvas?.dataset?.pdfCanonicalSourceRotation==='0')continue;
      try{
        const canvas=await renderOriginal(page.pdfPage,.9,0);
        page.thumbCanvas=markCanonicalCanvas(canvas,page.rotation);
        page.hiCanvas=null;
      }catch(error){
        console.warn('[pdf-orientation-scale] canonical thumbnail rebuild failed',error);
      }
    }
  }

  function pageScale(page){
    try{return normal(window.PdfNupPageAdjust?.valuesForPage?.(page)?.scale,page?.nupScale||1);}catch(_){return normal(page?.nupScale,1);}
  }

  function setPageScale(page,scale){
    const safe=clamp(normal(scale,1),MIN_SCALE,MAX_SCALE);
    try{
      if(typeof window.PdfNupPageAdjust?.setValues==='function')window.PdfNupPageAdjust.setValues(page,{scale:safe});
      else if(page)page.nupScale=safe;
    }catch(_){if(page)page.nupScale=safe;}
    return safe;
  }

  function projectedScale(startScale,centerX,centerY,startX,startY,currentX,currentY){
    const vx=normal(startX)-normal(centerX);
    const vy=normal(startY)-normal(centerY);
    const startDistance=Math.max(12,Math.hypot(vx,vy));
    const ux=vx/startDistance;
    const uy=vy/startDistance;
    const dx=normal(currentX)-normal(startX);
    const dy=normal(currentY)-normal(startY);
    // Positive projection is away from the page centre; negative is inward.
    const projected=dx*ux+dy*uy;
    const radial=Math.max(startDistance*.15,startDistance+projected);
    return clamp(normal(startScale,1)*(radial/startDistance),MIN_SCALE,MAX_SCALE);
  }

  function syncScaleUi(page,scale,direction){
    const percent=Math.round(scale*100);
    const number=byId('pdfNupAdjustScale');
    const range=byId('pdfNupAdjustScaleRange');
    if(number)number.value=String(percent);
    if(range)range.value=String(percent);
    const state=byId('pdfNupAdjustState');
    if(state)state.value='보정 적용';
    const badge=byId('pdfNupAdjustBadge');
    if(badge)badge.textContent='보정됨';
    const hint=scaleDrag?.hit?.querySelector?.('.pdf-nup-direct-edit-hint');
    if(hint)hint.textContent=`${direction==='grow'?'확대':direction==='shrink'?'축소':'크기 조절'} ${percent}%`;
  }

  function beginScale(event){
    if(event.button!==0)return;
    const handle=event.target?.closest?.('.pdf-nup-adjust-handle');
    if(!handle)return;
    const hit=handle.closest('.pdf-nup-adjust-hit');
    const page=pageById(hit?.dataset?.pageId);
    if(!hit||!page)return;
    const rect=hit.getBoundingClientRect();
    scaleDrag={
      pointerId:event.pointerId,
      page,
      hit,
      centerX:rect.left+rect.width/2,
      centerY:rect.top+rect.height/2,
      startX:event.clientX,
      startY:event.clientY,
      startScale:pageScale(page),
      lastScale:pageScale(page),
    };
  }

  function applyScalePointer(event){
    const state=scaleDrag;
    if(!state||event.pointerId!==state.pointerId)return;
    const next=setPageScale(state.page,projectedScale(
      state.startScale,
      state.centerX,state.centerY,
      state.startX,state.startY,
      event.clientX,event.clientY,
    ));
    const direction=next>state.startScale+.003?'grow':next<state.startScale-.003?'shrink':'steady';
    state.lastScale=next;
    syncScaleUi(state.page,next,direction);
    if(state.hit)state.hit.dataset.scaleDirection=direction;
  }

  function moveScale(event){
    if(!scaleDrag||event.pointerId!==scaleDrag.pointerId)return;
    // Registered after the historical scale handlers, so this is the final
    // model value consumed by nup-direct-preview-edit's queued live paint.
    applyScalePointer(event);
  }

  function endScale(event){
    if(!scaleDrag||event.pointerId!==scaleDrag.pointerId)return;
    applyScalePointer(event);
    const state=scaleDrag;
    if(state.hit)delete state.hit.dataset.scaleDirection;
    scaleDrag=null;
  }

  function installEvents(){
    if(eventsInstalled)return;
    eventsInstalled=true;
    document.addEventListener('pointerdown',beginScale,true);
    document.addEventListener('pointermove',moveScale,true);
    document.addEventListener('pointerup',endScale,true);
    document.addEventListener('pointercancel',endScale,true);
    document.addEventListener('pdf-import-committed',()=>{
      syncRotationIntent();
      canonicalizeExistingRotatedPages();
    });
    document.addEventListener('click',event=>{
      if(event.target?.closest?.('#pdfPageRotateLeftV1,#pdfPageRotateRightV1')){
        queueMicrotask(syncRotationIntent);
      }
    },true);
  }

  function installApiWrapper(){
    const current=window.apiProcessPdf;
    if(typeof current!=='function')return false;
    if(current===apiWrapper)return true;
    if(current.__pdfOrientationIntentSyncV1){apiWrapper=current;return true;}
    const original=current;
    const wrapped=function orientationIntentApi(){
      syncRotationIntent();
      return original.apply(this,arguments);
    };
    wrapped.__pdfOrientationIntentSyncV1=true;
    wrapped.__pdfOrientationIntentOriginal=original;
    window.apiProcessPdf=wrapped;
    try{apiProcessPdf=wrapped;}catch(_){}
    apiWrapper=wrapped;
    return true;
  }

  function installFetchWrapper(){
    const current=window.fetch;
    if(typeof current!=='function')return false;
    if(current===fetchWrapper)return true;
    if(current.__pdfOrientationIntentSyncV1){fetchWrapper=current;return true;}
    const original=current.bind(window);
    const wrapped=function orientationIntentFetch(){
      syncRotationIntent();
      return original(...arguments);
    };
    wrapped.__pdfOrientationIntentSyncV1=true;
    wrapped.__pdfOrientationIntentOriginal=current;
    window.fetch=wrapped;
    fetchWrapper=wrapped;
    return true;
  }

  function installStateWrappers(){
    const collect=window.collectEditorState;
    if(typeof collect==='function'&&collect!==collectWrapper&&!collect.__pdfOrientationIntentSyncV1){
      const originalCollect=collect;
      const wrappedCollect=function orientationIntentCollect(){
        syncRotationIntent();
        return originalCollect.apply(this,arguments);
      };
      wrappedCollect.__pdfOrientationIntentSyncV1=true;
      wrappedCollect.__pdfOrientationIntentOriginal=originalCollect;
      window.collectEditorState=wrappedCollect;
      try{collectEditorState=wrappedCollect;}catch(_){}
      collectWrapper=wrappedCollect;
    }else if(collect?.__pdfOrientationIntentSyncV1){collectWrapper=collect;}

    const load=window.loadEditorSession;
    if(typeof load==='function'&&load!==loadWrapper&&!load.__pdfOrientationIntentSyncV1){
      const originalLoad=load;
      const wrappedLoad=async function orientationIntentLoad(){
        const result=await originalLoad.apply(this,arguments);
        syncRotationIntent();
        await canonicalizeExistingRotatedPages();
        return result;
      };
      wrappedLoad.__pdfOrientationIntentSyncV1=true;
      wrappedLoad.__pdfOrientationIntentOriginal=originalLoad;
      window.loadEditorSession=wrappedLoad;
      try{loadEditorSession=wrappedLoad;}catch(_){}
      loadWrapper=wrappedLoad;
    }else if(load?.__pdfOrientationIntentSyncV1){loadWrapper=load;}
  }

  function maintain(){
    installRenderWrapper();
    installSafetyRenderWrapper();
    installApiWrapper();
    installFetchWrapper();
    installStateWrappers();
    syncRotationIntent();
  }

  function install(){
    installEvents();
    maintain();
    canonicalizeExistingRotatedPages();
    document.documentElement.dataset.pdfOrientationScaleRegression='1';
  }

  window.PdfOrientationScaleRegression={
    normalizedRotation,
    projectedScale,
    syncRotationIntent,
    noteRenderedRotation,
    installSafetyRenderWrapper,
    canonicalizeExistingRotatedPages,
    stage:'canonical-rotation-outward-scale-v1',
  };

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();
  for(const delay of INSTALL_DELAYS)setTimeout(install,delay);
  setInterval(maintain,1800);
})();
