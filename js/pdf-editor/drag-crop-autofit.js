// Fast selection crop: drag the content to keep, crop everything else,
// then reset per-page placement so the cropped content auto-fits the current
// paper/N-up cell inside the configured margins.
(function(){
  'use strict';
  if(window.__pdfDragCropAutoFitV1)return;
  window.__pdfDragCropAutoFitV1=true;

  const smokeHost=document.documentElement.dataset.pdfDragCropAutoFitHost==='1';
  if(!location.pathname.includes('pdf-editor')&&!smokeHost)return;

  const INSTALL_DELAYS=[0,120,300,650,1100,1800,3000,5000];
  const MIN_SELECTION=.055;
  const MIN_SOURCE_VISIBLE=.051;
  const SOURCE_CACHE_LIMIT=12;
  const SOURCE_CACHE_MAX_SIDE=520;
  const FALLBACK_HYDRATION_SCALE=.38;
  const byId=id=>document.getElementById(id);
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

  let active=false;
  let selectedPageId='';
  let drag=null;
  let overlayFrame=0;
  let selectionFrame=0;
  let pendingSelection=null;
  let previewObserver=null;
  let eventsInstalled=false;
  let activeSource=null;
  let activationToken=0;
  let hydratedBasePage=null;
  let hydratedBaseCanvas=null;
  let sourceCaptureInstalled=false;
  let drawnSource=null;
  let drawnWidth=0;
  let drawnHeight=0;
  const sourceCache=new Map();

  function pages(){
    try{return Array.isArray(parsedPages)?parsedPages:[];}catch(_){return[];}
  }

  function files(){
    try{return Array.isArray(uploadedFiles)?uploadedFiles:[];}catch(_){return[];}
  }

  function pageById(id){
    return pages().find(page=>String(page.id)===String(id))||null;
  }

  function selectedPage(){
    const hit=document.querySelector('.pdf-nup-adjust-hit[data-selected="true"]');
    if(hit?.dataset?.pageId)selectedPageId=String(hit.dataset.pageId);
    return pageById(selectedPageId);
  }

  function transformApi(){return window.PdfPageTransformEdit||null;}
  function placementApi(){return window.PdfNupPageAdjust||null;}

  function valuesForPage(page){
    return transformApi()?.valuesForPage?.(page)||{
      rotation:Number(page?.rotation||0),rotationLocked:!!page?.pageRotationLocked,
      cropLeft:Number(page?.cropLeftRatio||0),cropTop:Number(page?.cropTopRatio||0),
      cropRight:Number(page?.cropRightRatio||0),cropBottom:Number(page?.cropBottomRatio||0),
    };
  }

  function visualCropForPage(page){
    const value=valuesForPage(page);
    if(typeof transformApi()?.visualCrop==='function')return transformApi().visualCrop(value);
    return{left:value.cropLeft,top:value.cropTop,right:value.cropRight,bottom:value.cropBottom};
  }

  function sourceEdgeForVisual(rotation,edge){
    if(typeof transformApi()?.sourceEdgeForVisual==='function')return transformApi().sourceEdgeForVisual(rotation,edge);
    const maps={
      0:{left:'left',top:'top',right:'right',bottom:'bottom'},
      90:{left:'bottom',top:'left',right:'top',bottom:'right'},
      180:{left:'right',top:'bottom',right:'left',bottom:'top'},
      270:{left:'top',top:'right',right:'bottom',bottom:'left'},
    };
    const normalized=((Number(rotation||0)%360)+360)%360;
    return(maps[normalized]||maps[0])[edge]||edge;
  }

  function normalizeSelection(selection){
    let left=clamp(Number(selection?.left??0),0,1);
    let top=clamp(Number(selection?.top??0),0,1);
    let right=clamp(Number(selection?.right??1),0,1);
    let bottom=clamp(Number(selection?.bottom??1),0,1);
    if(right<left)[left,right]=[right,left];
    if(bottom<top)[top,bottom]=[bottom,top];
    return{left,top,right,bottom};
  }

  function composeVisualCrop(page,selection){
    const current=visualCropForPage(page);
    const pick=normalizeSelection(selection);
    const visibleW=Math.max(.001,1-Number(current.left||0)-Number(current.right||0));
    const visibleH=Math.max(.001,1-Number(current.top||0)-Number(current.bottom||0));
    return{
      left:clamp(Number(current.left||0)+visibleW*pick.left,0,.95),
      top:clamp(Number(current.top||0)+visibleH*pick.top,0,.95),
      right:clamp(Number(current.right||0)+visibleW*(1-pick.right),0,.95),
      bottom:clamp(Number(current.bottom||0)+visibleH*(1-pick.bottom),0,.95),
    };
  }

  function sourcePatchFromVisual(page,visual){
    const rotation=Number(valuesForPage(page).rotation||0);
    const patch={cropLeft:0,cropTop:0,cropRight:0,cropBottom:0};
    const keys={left:'cropLeft',top:'cropTop',right:'cropRight',bottom:'cropBottom'};
    ['left','top','right','bottom'].forEach(edge=>{
      const sourceEdge=sourceEdgeForVisual(rotation,edge);
      patch[keys[sourceEdge]]=clamp(Number(visual?.[edge]||0),0,.90);
    });
    return patch;
  }

  function requestPreview(){
    try{
      if(typeof placementApi()?.refresh==='function'){placementApi().refresh();return;}
      if(typeof window.PdfEditorLayoutExport?.refresh==='function'){window.PdfEditorLayoutExport.refresh();return;}
      if(typeof triggerPreview==='function')triggerPreview();
    }catch(error){console.warn('[pdf-drag-crop-autofit] preview refresh failed',error);}
  }

  function resetPlacement(page){
    if(typeof placementApi()?.setValues==='function'){
      placementApi().setValues(page,{scale:1,offsetX:0,offsetY:0});
      return;
    }
    if(page){page.nupScale=1;page.nupOffsetX=0;page.nupOffsetY=0;}
  }

  function applySelection(page,selection){
    if(!page||!transformApi()?.setValues)return false;
    const pick=normalizeSelection(selection);
    if(pick.right-pick.left<MIN_SELECTION||pick.bottom-pick.top<MIN_SELECTION)return false;
    const visual=composeVisualCrop(page,pick);
    const visibleW=1-visual.left-visual.right;
    const visibleH=1-visual.top-visual.bottom;
    if(visibleW<MIN_SOURCE_VISIBLE||visibleH<MIN_SOURCE_VISIBLE)return false;
    const patch=sourcePatchFromVisual(page,visual);
    transformApi().setValues(page,patch);
    resetPlacement(page);
    selectedPageId=String(page.id);
    active=false;
    drag=null;
    activeSource=null;
    pendingSelection=null;
    hideOverlay();
    syncControls('선택 영역 맞춤 완료');
    requestPreview();
    try{document.dispatchEvent(new CustomEvent('pdf-drag-crop-autofit-applied',{detail:{pageId:String(page.id),selection:pick,visualCrop:visual}}));}catch(_){}
    return true;
  }

  function isLightweightPage(page){
    try{
      if(typeof window.PdfViewportLazyPreview?.isLightweightPage==='function')return window.PdfViewportLazyPreview.isLightweightPage(page);
    }catch(_){}
    return!!(
      page?.lightweight||page?.pdfPage?.__lightweightPdfPage||page?.thumbCanvas?.dataset?.lightweightPage==='1'
    );
  }

  function isUsableSource(source){
    return!!(
      source?.width>1&&source?.height>1
      &&source.dataset?.lazyPreviewError!=='1'
      &&source.dataset?.lightweightPage!=='1'
    );
  }

  function cloneForCache(source){
    if(!isUsableSource(source))return null;
    const ratio=Math.min(1,SOURCE_CACHE_MAX_SIDE/Math.max(source.width,source.height));
    const canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(source.width*ratio));
    canvas.height=Math.max(1,Math.round(source.height*ratio));
    const context=canvas.getContext('2d',{alpha:false});
    if(!context)return null;
    context.fillStyle='#fff';
    context.fillRect(0,0,canvas.width,canvas.height);
    context.drawImage(source,0,0,canvas.width,canvas.height);
    if(source.dataset){
      ['pdfCanonicalSourceRotation','pdfRequestedRotation','pageRotation'].forEach(key=>{
        if(source.dataset[key]!=null)canvas.dataset[key]=source.dataset[key];
      });
    }
    canvas.dataset.pdfDragCropCachedSource='1';
    return canvas;
  }

  function rememberSource(page,source){
    const original=pageById(page?.id);
    if(!original||!isLightweightPage(original)||!isUsableSource(source))return;
    // A rotated raw thumbnail without the canonical marker can double-rotate
    // when PageTransformEdit applies the current user rotation. Cache only a
    // guaranteed canonical source, or a rotation-0 page where raw is canonical.
    if(Number(original.rotation||0)%360!==0&&source.dataset?.pdfCanonicalSourceRotation!=='0')return;
    const cached=cloneForCache(source);
    if(!cached)return;
    const key=String(original.id);
    const previous=sourceCache.get(key);
    if(previous&&previous!==cached){try{previous.width=1;previous.height=1;}catch(_){}}
    sourceCache.delete(key);
    sourceCache.set(key,cached);
    while(sourceCache.size>SOURCE_CACHE_LIMIT){
      const oldestKey=sourceCache.keys().next().value;
      const oldest=sourceCache.get(oldestKey);
      sourceCache.delete(oldestKey);
      try{oldest.width=1;oldest.height=1;}catch(_){}
    }
    document.documentElement.dataset.pdfDragCropCachedSources=String(sourceCache.size);
  }

  function cachedSource(page){
    const key=String(page?.id??'');
    const canvas=sourceCache.get(key);
    if(!isUsableSource(canvas)){
      if(canvas)sourceCache.delete(key);
      return null;
    }
    sourceCache.delete(key);
    sourceCache.set(key,canvas);
    return canvas;
  }

  function clearSourceCache(){
    for(const canvas of sourceCache.values()){
      try{canvas.width=1;canvas.height=1;}catch(_){}
    }
    sourceCache.clear();
    document.documentElement.dataset.pdfDragCropCachedSources='0';
  }

  function installGetPageSrcCapture(){
    if(sourceCaptureInstalled)return true;
    const current=window.getPageSrc;
    if(typeof current!=='function')return false;
    const original=current;
    const wrapped=function dragCropSourceCapture(page){
      try{rememberSource(page,page?.thumbCanvas);}catch(_){}
      return original.apply(this,arguments);
    };
    wrapped.__pdfDragCropSourceCaptureV1=true;
    wrapped.__pdfDragCropSourceCaptureOriginal=original;
    window.getPageSrc=wrapped;
    try{getPageSrc=wrapped;}catch(_){}
    sourceCaptureInstalled=true;
    return true;
  }

  function releaseHydratedBase(){
    if(hydratedBaseCanvas){
      try{hydratedBaseCanvas.width=1;hydratedBaseCanvas.height=1;}catch(_){}
    }
    hydratedBaseCanvas=null;
    hydratedBasePage=null;
  }

  async function renderHydratedBase(page){
    if(hydratedBasePage===page&&hydratedBaseCanvas?.width>1&&hydratedBaseCanvas?.height>1)return hydratedBaseCanvas;
    releaseHydratedBase();
    const file=files()[Number(page?.file_index)];
    if(!file||typeof file.arrayBuffer!=='function')throw new Error('원본 PDF 파일을 찾지 못했습니다.');
    const buffer=await file.arrayBuffer();
    const safety=window.PdfImportTransactionSafety;
    let documentHandle=null;
    let pdfPage=null;
    try{
      documentHandle=typeof safety?.safePdfGetDocument==='function'
        ? await safety.safePdfGetDocument(buffer,true)
        : await pdfjsLib.getDocument({data:buffer,disableAutoFetch:true,disableFontFace:true}).promise;
      pdfPage=await documentHandle.getPage(Number(page?.page_index||0)+1);
      // Selection ratios do not need a large raster. A small canonical source
      // is substantially faster and the final PDF still uses the vector source.
      const canvas=typeof safety?.safeRenderPdfPage==='function'
        ? await safety.safeRenderPdfPage(pdfPage,FALLBACK_HYDRATION_SCALE,0,true)
        : await renderPdfPage(pdfPage,FALLBACK_HYDRATION_SCALE,0);
      if(!isUsableSource(canvas))throw new Error('실제 페이지 미리보기를 만들지 못했습니다.');
      hydratedBasePage=page;
      hydratedBaseCanvas=canvas;
      return canvas;
    }finally{
      try{pdfPage?.cleanup?.();}catch(_){}
      try{await documentHandle?.destroy?.();}catch(_){}
    }
  }

  function transformedDisplaySource(page,baseCanvas){
    if(!baseCanvas)return null;
    try{
      if(typeof window.getPageSrc==='function'){
        const sourcePage=baseCanvas===page?.thumbCanvas?page:{...page,thumbCanvas:baseCanvas,lightweight:false};
        const source=window.getPageSrc(sourcePage);
        if(source?.width&&source?.height)return source;
      }
    }catch(error){console.warn('[pdf-drag-crop-autofit] page transform source failed',error);}
    return baseCanvas;
  }

  async function resolveDisplaySource(page){
    if(!page)return null;
    if(!isLightweightPage(page))return transformedDisplaySource(page,page?.thumbCanvas);

    // Large-document lazy preview has already rendered the page the user can
    // see. Capture that source while it is available and reuse it here instead
    // of reopening and reparsing the entire PDF on every crop activation.
    const cached=cachedSource(page);
    if(cached)return transformedDisplaySource(page,cached);

    try{
      const base=await renderHydratedBase(page);
      return transformedDisplaySource(page,base);
    }catch(error){
      console.warn('[pdf-drag-crop-autofit] lightweight source hydration failed',error);
      return null;
    }
  }

  function currentSource(page){
    if(activeSource?.page===page&&activeSource.canvas?.width&&activeSource.canvas?.height)return activeSource.canvas;
    return null;
  }

  function installStyles(){
    if(byId('pdfDragCropAutoFitStylesV1'))return;
    const style=document.createElement('style');
    style.id='pdfDragCropAutoFitStylesV1';
    style.textContent=`
      .pdf-drag-crop-autofit-row{display:grid;grid-template-columns:minmax(0,1fr);gap:4px;margin-top:5px}
      #pdfDragCropAutoFitV1{border:1px solid #2563eb;border-radius:7px;background:#eff6ff;color:#1d4ed8;padding:7px 5px;font:inherit;font-size:9px;font-weight:900;cursor:pointer}
      #pdfDragCropAutoFitV1[data-active="true"]{background:#2563eb;color:#fff}
      #pdfDragCropAutoFitV1:disabled{opacity:.42;cursor:not-allowed}
      #pdfDragCropAutoFitStatusV1{min-height:13px;color:#64748b;font-size:8px;font-weight:750;line-height:1.35;text-align:center}
      #pdfDragCropOverlayV1{position:fixed;z-index:2147483050;display:none;overflow:hidden;border:2px solid #2563eb;border-radius:3px;background:#fff;box-shadow:0 10px 34px rgba(15,23,42,.26);cursor:crosshair;touch-action:none;user-select:none;pointer-events:auto;contain:layout paint}
      #pdfDragCropOverlayV1[data-visible="true"]{display:block}
      #pdfDragCropOverlayV1 canvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
      #pdfDragCropShadeV1{position:absolute;inset:0;background:rgba(37,99,235,.025);pointer-events:none}
      #pdfDragCropSelectionV1{position:absolute;display:none;border:2px solid #f59e0b;background:rgba(255,255,255,.08);box-shadow:0 0 0 2000px rgba(15,23,42,.48);pointer-events:none;will-change:left,top,width,height}
      #pdfDragCropSelectionV1[data-visible="true"]{display:block}
      #pdfDragCropHintV1{position:absolute;left:50%;top:8px;transform:translateX(-50%);z-index:3;max-width:calc(100% - 16px);padding:4px 8px;border-radius:999px;background:rgba(15,23,42,.86);color:#fff;font-size:8px;font-weight:900;white-space:nowrap;pointer-events:none}
    `;
    document.head.appendChild(style);
  }

  function ensureControls(){
    installStyles();
    const block=byId('pdfPageTransformControlsV1');
    if(!block)return false;
    let row=byId('pdfDragCropAutoFitControlsV1');
    if(!row){
      row=document.createElement('div');
      row.id='pdfDragCropAutoFitControlsV1';
      row.className='pdf-drag-crop-autofit-row';
      row.innerHTML=`<button type="button" id="pdfDragCropAutoFitV1">✂ 필요한 영역 드래그 → 여백 자동 맞춤</button><div id="pdfDragCropAutoFitStatusV1">선택 부분만 남기고 나머지를 자른 뒤 자동으로 최대 맞춤합니다.</div>`;
      block.appendChild(row);
      byId('pdfDragCropAutoFitV1')?.addEventListener('click',()=>{
        if(active)cancel();else void activate(selectedPage());
      });
    }
    syncControls();
    return true;
  }

  function syncControls(message){
    const page=selectedPage();
    const button=byId('pdfDragCropAutoFitV1');
    if(button){
      button.disabled=!page;
      button.dataset.active=String(active&&!!page);
      button.textContent=active&&page?'취소 · 영역 선택 중':'✂ 필요한 영역 드래그 → 여백 자동 맞춤';
    }
    const status=byId('pdfDragCropAutoFitStatusV1');
    if(status){
      if(message)status.textContent=message;
      else if(active&&page&&!activeSource)status.textContent='빠른 자르기 화면을 준비하는 중입니다.';
      else if(active&&page)status.textContent='남길 부분을 사각형으로 드래그하세요. 마우스를 놓으면 즉시 적용됩니다. · Esc 취소';
      else status.textContent=page?'선택 부분만 남기고 나머지를 자른 뒤 자동으로 최대 맞춤합니다.':'먼저 미리보기에서 페이지를 선택하세요.';
    }
  }

  function ensureOverlay(){
    let overlay=byId('pdfDragCropOverlayV1');
    if(overlay)return overlay;
    overlay=document.createElement('div');
    overlay.id='pdfDragCropOverlayV1';
    overlay.innerHTML=`<canvas id="pdfDragCropCanvasV1"></canvas><div id="pdfDragCropShadeV1"></div><div id="pdfDragCropSelectionV1"></div><div id="pdfDragCropHintV1">남길 부분을 드래그 · 놓으면 자동 적용</div>`;
    overlay.addEventListener('pointerdown',beginDrag,{capture:true,passive:false});
    document.body.appendChild(overlay);
    return overlay;
  }

  function hideOverlay(){
    const overlay=byId('pdfDragCropOverlayV1');
    if(overlay){overlay.dataset.visible='false';delete overlay.dataset.dragging;}
    const selection=byId('pdfDragCropSelectionV1');
    if(selection)selection.dataset.visible='false';
  }

  function hideSelectionBox(){
    const selection=byId('pdfDragCropSelectionV1');
    if(selection)selection.dataset.visible='false';
  }

  function drawSource(source,width,height){
    const canvas=byId('pdfDragCropCanvasV1');
    if(!canvas||!source)return;
    const w=Math.max(1,Math.round(width));
    const h=Math.max(1,Math.round(height));
    if(drawnSource===source&&drawnWidth===w&&drawnHeight===h&&canvas.width===w&&canvas.height===h)return;
    if(canvas.width!==w)canvas.width=w;
    if(canvas.height!==h)canvas.height=h;
    const ctx=canvas.getContext('2d',{alpha:false});
    ctx.fillStyle='#fff';
    ctx.fillRect(0,0,w,h);
    ctx.drawImage(source,0,0,w,h);
    drawnSource=source;
    drawnWidth=w;
    drawnHeight=h;
  }

  function positionOverlay(){
    overlayFrame=0;
    if(!active){hideOverlay();return;}
    const page=selectedPage();
    if(!page){cancel();return;}
    const hit=document.querySelector(`.pdf-nup-adjust-hit[data-page-id="${CSS.escape(String(page.id))}"]`);
    const source=currentSource(page);
    if(!hit||!source?.width||!source?.height){hideOverlay();return;}
    const rect=hit.getBoundingClientRect();
    if(rect.width<2||rect.height<2){hideOverlay();return;}
    const aspect=source.width/source.height;
    let width=rect.width;
    let height=width/Math.max(.01,aspect);
    if(height>rect.height){height=rect.height;width=height*aspect;}
    const left=rect.left+(rect.width-width)/2;
    const top=rect.top+(rect.height-height)/2;
    const overlay=ensureOverlay();
    overlay.style.left=`${left}px`;
    overlay.style.top=`${top}px`;
    overlay.style.width=`${Math.max(1,width)}px`;
    overlay.style.height=`${Math.max(1,height)}px`;
    overlay.dataset.visible='true';
    drawSource(source,width,height);
  }

  function queueOverlay(){
    if(overlayFrame)return;
    overlayFrame=requestAnimationFrame(positionOverlay);
  }

  function relativePoint(event,rect){
    return{
      x:clamp((Number(event.clientX)-rect.left)/Math.max(1,rect.width),0,1),
      y:clamp((Number(event.clientY)-rect.top)/Math.max(1,rect.height),0,1),
    };
  }

  function paintSelectionNow(selection){
    const box=byId('pdfDragCropSelectionV1');
    if(!box)return;
    const pick=normalizeSelection(selection);
    box.style.left=`${pick.left*100}%`;
    box.style.top=`${pick.top*100}%`;
    box.style.width=`${Math.max(0,pick.right-pick.left)*100}%`;
    box.style.height=`${Math.max(0,pick.bottom-pick.top)*100}%`;
    box.dataset.visible='true';
  }

  function queueSelectionPaint(selection){
    pendingSelection=selection;
    if(selectionFrame)return;
    selectionFrame=requestAnimationFrame(()=>{
      selectionFrame=0;
      const next=pendingSelection;
      pendingSelection=null;
      if(next)paintSelectionNow(next);
    });
  }

  function clearSelectionPaint(){
    pendingSelection=null;
    if(selectionFrame){
      try{cancelAnimationFrame(selectionFrame);}catch(_){}
      selectionFrame=0;
    }
  }

  function beginDrag(event){
    if(!active||!activeSource||event.button!==0)return;
    const page=selectedPage();
    const overlay=byId('pdfDragCropOverlayV1');
    const rect=overlay?.getBoundingClientRect();
    if(!page||!rect?.width||!rect?.height)return;
    event.preventDefault();event.stopImmediatePropagation();event.stopPropagation();
    clearSelectionPaint();
    const point=relativePoint(event,rect);
    drag={pointerId:event.pointerId,page,rect,startX:point.x,startY:point.y,currentX:point.x,currentY:point.y};
    overlay.dataset.dragging='true';
    paintSelectionNow({left:point.x,top:point.y,right:point.x,bottom:point.y});
    try{overlay.setPointerCapture?.(event.pointerId);}catch(_){}
  }

  function moveDrag(event){
    if(!drag||event.pointerId!==drag.pointerId)return;
    event.preventDefault();event.stopImmediatePropagation();event.stopPropagation();
    const point=relativePoint(event,drag.rect);
    drag.currentX=point.x;drag.currentY=point.y;
    queueSelectionPaint({left:drag.startX,top:drag.startY,right:drag.currentX,bottom:drag.currentY});
  }

  function endDrag(event){
    if(!drag||event.pointerId!==drag.pointerId)return;
    event.preventDefault();event.stopImmediatePropagation();event.stopPropagation();
    const state=drag;
    const point=relativePoint(event,state.rect);
    drag=null;
    clearSelectionPaint();
    const overlay=byId('pdfDragCropOverlayV1');
    if(overlay)delete overlay.dataset.dragging;
    const selection=normalizeSelection({left:state.startX,top:state.startY,right:point.x,bottom:point.y});
    if(selection.right-selection.left<MIN_SELECTION||selection.bottom-selection.top<MIN_SELECTION){
      hideSelectionBox();
      syncControls('선택 영역이 너무 작습니다. 다시 드래그하세요.');
      return;
    }
    if(!applySelection(state.page,selection)){
      hideSelectionBox();
      syncControls('최종 남는 영역은 원본의 약 5% 이상이어야 합니다. 조금 더 크게 선택하세요.');
    }
  }

  function cancelDrag(event){
    if(!drag||event.pointerId!==drag.pointerId)return;
    event.preventDefault();event.stopImmediatePropagation();event.stopPropagation();
    drag=null;
    clearSelectionPaint();
    const overlay=byId('pdfDragCropOverlayV1');
    if(overlay)delete overlay.dataset.dragging;
    hideSelectionBox();
    syncControls('선택 동작이 취소되었습니다. 다시 드래그하세요.');
  }

  async function activate(page){
    if(!page)return false;
    const token=++activationToken;
    selectedPageId=String(page.id);
    if(transformApi()?.isCropMode?.())transformApi().toggleCropMode?.();
    active=true;
    drag=null;
    activeSource=null;
    clearSelectionPaint();
    hideOverlay();
    syncControls();
    const source=await resolveDisplaySource(page);
    if(token!==activationToken||!active||selectedPageId!==String(page.id))return false;
    if(!source?.width||!source?.height){
      active=false;
      activeSource=null;
      syncControls('실제 원본 페이지를 불러오지 못했습니다. 다시 시도하세요.');
      return false;
    }
    activeSource={page,canvas:source};
    syncControls();
    queueOverlay();
    return true;
  }

  function cancel(){
    activationToken+=1;
    active=false;
    drag=null;
    activeSource=null;
    clearSelectionPaint();
    hideOverlay();
    syncControls();
  }

  function installEvents(){
    if(eventsInstalled)return;
    eventsInstalled=true;
    document.addEventListener('pointermove',moveDrag,{capture:true,passive:false});
    document.addEventListener('pointerup',endDrag,{capture:true,passive:false});
    document.addEventListener('pointercancel',cancelDrag,{capture:true,passive:false});
    document.addEventListener('keydown',event=>{if(event.key==='Escape'&&active){event.preventDefault();cancel();}},true);
    document.addEventListener('click',event=>{
      const hit=event.target?.closest?.('.pdf-nup-adjust-hit');
      if(!hit?.dataset?.pageId)return;
      const nextId=String(hit.dataset.pageId);
      if(active&&nextId!==selectedPageId)cancel();
      selectedPageId=nextId;
      requestAnimationFrame(()=>syncControls());
    },true);
    document.addEventListener('pdf-import-committed',()=>{
      cancel();
      releaseHydratedBase();
      clearSourceCache();
    });
    window.addEventListener('resize',queueOverlay,{passive:true});
    byId('previewScroll')?.addEventListener('scroll',queueOverlay,{passive:true});
  }

  function installObserver(){
    const area=byId('previewScroll');
    if(!area||previewObserver||typeof MutationObserver!=='function')return;
    previewObserver=new MutationObserver(mutations=>{
      if(mutations.some(m=>m.addedNodes.length||m.removedNodes.length))requestAnimationFrame(()=>{ensureControls();syncControls();if(active)queueOverlay();});
    });
    previewObserver.observe(area,{childList:true,subtree:true});
  }

  function install(){
    installStyles();
    installGetPageSrcCapture();
    installEvents();
    ensureControls();
    installObserver();
    if(active)queueOverlay();
    document.documentElement.dataset.pdfDragCropAutoFit='1';
  }

  window.PdfDragCropAutoFit={
    normalizeSelection,
    composeVisualCrop,
    sourcePatchFromVisual,
    applySelection,
    resolveDisplaySource,
    activate,
    cancel,
    isActive:()=>active,
    get cachedSourceCount(){return sourceCache.size;},
    refresh:()=>{syncControls();queueOverlay();},
    stage:'drag-keep-region-crop-autofit-v1',
    performanceStage:'cached-lazy-source-frame-throttle-v1',
  };

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();
  for(const delay of INSTALL_DELAYS)setTimeout(install,delay);
})();