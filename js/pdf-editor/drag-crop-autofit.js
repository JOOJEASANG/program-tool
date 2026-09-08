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
  const MIN_SELECTION=.025;
  const byId=id=>document.getElementById(id);
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

  let active=false;
  let selectedPageId='';
  let drag=null;
  let overlayFrame=0;
  let previewObserver=null;
  let eventsInstalled=false;

  function pages(){
    try{return Array.isArray(parsedPages)?parsedPages:[];}catch(_){return[];}
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
    let left=clamp(Number(selection?.left||0),0,1);
    let top=clamp(Number(selection?.top||0),0,1);
    let right=clamp(Number(selection?.right||1),0,1);
    let bottom=clamp(Number(selection?.bottom||1),0,1);
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
    const patch=sourcePatchFromVisual(page,visual);
    transformApi().setValues(page,patch);
    resetPlacement(page);
    selectedPageId=String(page.id);
    active=false;
    drag=null;
    hideOverlay();
    syncControls('선택 영역 맞춤 완료');
    requestPreview();
    try{document.dispatchEvent(new CustomEvent('pdf-drag-crop-autofit-applied',{detail:{pageId:String(page.id),selection:pick,visualCrop:visual}}));}catch(_){}
    return true;
  }

  function currentSource(page){
    try{
      if(typeof window.getPageSrc==='function'){
        const source=window.getPageSrc(page);
        if(source?.width&&source?.height)return source;
      }
    }catch(_){}
    return page?.thumbCanvas||null;
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
      #pdfDragCropOverlayV1{position:fixed;z-index:2147483050;display:none;overflow:hidden;border:2px solid #2563eb;border-radius:3px;background:#fff;box-shadow:0 10px 34px rgba(15,23,42,.26);cursor:crosshair;touch-action:none;user-select:none}
      #pdfDragCropOverlayV1[data-visible="true"]{display:block}
      #pdfDragCropOverlayV1 canvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
      #pdfDragCropShadeV1{position:absolute;inset:0;background:rgba(15,23,42,.18);pointer-events:none}
      #pdfDragCropSelectionV1{position:absolute;display:none;border:2px solid #f59e0b;background:rgba(255,255,255,.08);box-shadow:0 0 0 2000px rgba(15,23,42,.48);pointer-events:none}
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
        if(active)cancel();else activate(selectedPage());
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
    overlay.addEventListener('pointerdown',beginDrag,true);
    document.body.appendChild(overlay);
    return overlay;
  }

  function hideOverlay(){
    const overlay=byId('pdfDragCropOverlayV1');
    if(overlay)overlay.dataset.visible='false';
    const selection=byId('pdfDragCropSelectionV1');
    if(selection)selection.dataset.visible='false';
  }

  function drawSource(source,width,height){
    const canvas=byId('pdfDragCropCanvasV1');
    if(!canvas||!source)return;
    const w=Math.max(1,Math.round(width));
    const h=Math.max(1,Math.round(height));
    if(canvas.width!==w)canvas.width=w;
    if(canvas.height!==h)canvas.height=h;
    const ctx=canvas.getContext('2d');
    ctx.clearRect(0,0,w,h);
    ctx.drawImage(source,0,0,w,h);
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

  function paintSelection(selection){
    const box=byId('pdfDragCropSelectionV1');
    if(!box)return;
    const pick=normalizeSelection(selection);
    box.style.left=`${pick.left*100}%`;
    box.style.top=`${pick.top*100}%`;
    box.style.width=`${Math.max(0,pick.right-pick.left)*100}%`;
    box.style.height=`${Math.max(0,pick.bottom-pick.top)*100}%`;
    box.dataset.visible='true';
  }

  function beginDrag(event){
    if(!active||event.button!==0)return;
    const page=selectedPage();
    const overlay=byId('pdfDragCropOverlayV1');
    const rect=overlay?.getBoundingClientRect();
    if(!page||!rect?.width||!rect?.height)return;
    event.preventDefault();event.stopImmediatePropagation();event.stopPropagation();
    const point=relativePoint(event,rect);
    drag={pointerId:event.pointerId,page,rect,startX:point.x,startY:point.y,currentX:point.x,currentY:point.y};
    paintSelection({left:point.x,top:point.y,right:point.x,bottom:point.y});
    try{overlay.setPointerCapture?.(event.pointerId);}catch(_){}
  }

  function moveDrag(event){
    if(!drag||event.pointerId!==drag.pointerId)return;
    event.preventDefault();event.stopImmediatePropagation();event.stopPropagation();
    const point=relativePoint(event,drag.rect);
    drag.currentX=point.x;drag.currentY=point.y;
    paintSelection({left:drag.startX,top:drag.startY,right:drag.currentX,bottom:drag.currentY});
  }

  function endDrag(event){
    if(!drag||event.pointerId!==drag.pointerId)return;
    event.preventDefault();event.stopImmediatePropagation();event.stopPropagation();
    const state=drag;
    const point=relativePoint(event,state.rect);
    drag=null;
    const selection=normalizeSelection({left:state.startX,top:state.startY,right:point.x,bottom:point.y});
    if(selection.right-selection.left<MIN_SELECTION||selection.bottom-selection.top<MIN_SELECTION){
      const box=byId('pdfDragCropSelectionV1');if(box)box.dataset.visible='false';
      syncControls('선택 영역이 너무 작습니다. 다시 드래그하세요.');
      return;
    }
    applySelection(state.page,selection);
  }

  function activate(page){
    if(!page)return false;
    selectedPageId=String(page.id);
    if(transformApi()?.isCropMode?.())transformApi().toggleCropMode?.();
    active=true;
    drag=null;
    syncControls();
    queueOverlay();
    return true;
  }

  function cancel(){
    active=false;
    drag=null;
    hideOverlay();
    syncControls();
  }

  function installEvents(){
    if(eventsInstalled)return;
    eventsInstalled=true;
    document.addEventListener('pointermove',moveDrag,true);
    document.addEventListener('pointerup',endDrag,true);
    document.addEventListener('pointercancel',endDrag,true);
    document.addEventListener('keydown',event=>{if(event.key==='Escape'&&active){event.preventDefault();cancel();}},true);
    document.addEventListener('click',event=>{
      const hit=event.target?.closest?.('.pdf-nup-adjust-hit');
      if(!hit?.dataset?.pageId)return;
      selectedPageId=String(hit.dataset.pageId);
      requestAnimationFrame(()=>{syncControls();if(active)queueOverlay();});
    },true);
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
    activate,
    cancel,
    isActive:()=>active,
    refresh:()=>{syncControls();queueOverlay();},
    stage:'drag-keep-region-crop-autofit-v1',
  };

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();
  for(const delay of INSTALL_DELAYS)setTimeout(install,delay);
})();
