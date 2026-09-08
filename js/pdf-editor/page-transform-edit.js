// Non-destructive per-page crop + explicit rotation for the PDF editor.
// Transform order is: source crop -> user rotation -> N-up scale -> N-up move.
(function(){
  'use strict';
  if(window.__pdfPageTransformEditV1)return;
  window.__pdfPageTransformEditV1=true;

  const smokeHost=document.documentElement.dataset.pdfPageTransformEditHost==='1';
  if(!location.pathname.includes('pdf-editor')&&!smokeHost)return;

  const MAX_EDGE=.90;
  const MAX_PAIR=.95;
  const INSTALL_DELAYS=[0,120,280,520,900,1500,2400,3800,6000];
  const byId=id=>document.getElementById(id);
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const normal=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
  const cache=new WeakMap();

  let cropMode=false;
  let selectedPageId='';
  let cropDrag=null;
  let overlayFrame=0;
  let previewObserver=null;
  let apiWrapped=false;
  let fetchWrapped=false;
  let sessionWrapped=false;
  let getPageSrcWrapped=false;
  let drawPageWrapped=false;

  function pages(){
    try{return Array.isArray(parsedPages)?parsedPages:[];}catch(_){return[];}
  }

  function pageById(id){
    return pages().find(page=>String(page.id)===String(id))||null;
  }

  function normalizedRotation(value){
    const rotation=((Math.round(normal(value,0)/90)*90)%360+360)%360;
    return [0,90,180,270].includes(rotation)?rotation:0;
  }

  function valuesForPage(page){
    return{
      rotation:normalizedRotation(page?.rotation),
      rotationLocked:!!(page?.pageRotationLocked??page?.rotationLocked),
      cropLeft:clamp(normal(page?.cropLeftRatio??page?.crop_left_ratio,0),0,MAX_EDGE),
      cropTop:clamp(normal(page?.cropTopRatio??page?.crop_top_ratio,0),0,MAX_EDGE),
      cropRight:clamp(normal(page?.cropRightRatio??page?.crop_right_ratio,0),0,MAX_EDGE),
      cropBottom:clamp(normal(page?.cropBottomRatio??page?.crop_bottom_ratio,0),0,MAX_EDGE),
    };
  }

  function boundedPair(first,second){
    first=clamp(normal(first,0),0,MAX_EDGE);
    second=clamp(normal(second,0),0,MAX_EDGE);
    if(first+second>=MAX_PAIR)first=Math.max(0,MAX_PAIR-second-.001);
    return[first,second];
  }

  function setValues(page,patch){
    if(!page)return;
    const current=valuesForPage(page);
    let left=patch?.cropLeft??current.cropLeft;
    let right=patch?.cropRight??current.cropRight;
    let top=patch?.cropTop??current.cropTop;
    let bottom=patch?.cropBottom??current.cropBottom;
    [left,right]=boundedPair(left,right);
    [top,bottom]=boundedPair(top,bottom);
    page.cropLeftRatio=left;
    page.cropTopRatio=top;
    page.cropRightRatio=right;
    page.cropBottomRatio=bottom;
    if(patch&&Object.prototype.hasOwnProperty.call(patch,'rotation'))page.rotation=normalizedRotation(patch.rotation);
    if(patch&&Object.prototype.hasOwnProperty.call(patch,'rotationLocked'))page.pageRotationLocked=!!patch.rotationLocked;
    cache.delete(page);
  }

  function resetTransform(page){
    if(!page)return;
    setValues(page,{
      rotation:0,
      rotationLocked:false,
      cropLeft:0,
      cropTop:0,
      cropRight:0,
      cropBottom:0,
    });
  }

  function hasCrop(page){
    const value=valuesForPage(page);
    return value.cropLeft>.0001||value.cropTop>.0001||value.cropRight>.0001||value.cropBottom>.0001;
  }

  function hasTransform(page){
    const value=valuesForPage(page);
    return hasCrop(page)||value.rotation!==0||value.rotationLocked;
  }

  function selectedPage(){
    const selected=document.querySelector('.pdf-nup-adjust-hit[data-selected="true"]');
    if(selected?.dataset?.pageId)selectedPageId=String(selected.dataset.pageId);
    return pageById(selectedPageId);
  }

  function sourceEdgeForVisual(rotation,edge){
    const maps={
      0:{left:'left',top:'top',right:'right',bottom:'bottom'},
      90:{left:'bottom',top:'left',right:'top',bottom:'right'},
      180:{left:'right',top:'bottom',right:'left',bottom:'top'},
      270:{left:'top',top:'right',right:'bottom',bottom:'left'},
    };
    return(maps[normalizedRotation(rotation)]||maps[0])[edge]||edge;
  }

  function visualCrop(value){
    const source={left:value.cropLeft,top:value.cropTop,right:value.cropRight,bottom:value.cropBottom};
    const rotation=normalizedRotation(value.rotation);
    if(rotation===90)return{left:source.bottom,top:source.left,right:source.top,bottom:source.right};
    if(rotation===180)return{left:source.right,top:source.bottom,right:source.left,bottom:source.top};
    if(rotation===270)return{left:source.top,top:source.right,right:source.bottom,bottom:source.left};
    return source;
  }

  function sourcePatchForVisual(page,visualEdge,ratio){
    const value=valuesForPage(page);
    const edge=sourceEdgeForVisual(value.rotation,visualEdge);
    const key={left:'cropLeft',top:'cropTop',right:'cropRight',bottom:'cropBottom'}[edge];
    const opposite={left:'cropRight',right:'cropLeft',top:'cropBottom',bottom:'cropTop'}[key];
    const max=Math.max(0,MAX_PAIR-normal(value[opposite],0)-.001);
    return{[key]:clamp(normal(ratio,0),0,Math.min(MAX_EDGE,max))};
  }

  function rotateCanvasSource(src,rotation,crop){
    if(!src||!src.width||!src.height)return src;
    const left=Math.round(src.width*crop.cropLeft);
    const top=Math.round(src.height*crop.cropTop);
    const right=Math.round(src.width*crop.cropRight);
    const bottom=Math.round(src.height*crop.cropBottom);
    const sw=Math.max(1,src.width-left-right);
    const sh=Math.max(1,src.height-top-bottom);
    const rot=normalizedRotation(rotation);
    const out=document.createElement('canvas');
    out.width=rot===90||rot===270?sh:sw;
    out.height=rot===90||rot===270?sw:sh;
    const ctx=out.getContext('2d');
    ctx.save();
    if(rot===90){ctx.translate(out.width,0);ctx.rotate(Math.PI/2);}
    else if(rot===180){ctx.translate(out.width,out.height);ctx.rotate(Math.PI);}
    else if(rot===270){ctx.translate(0,out.height);ctx.rotate(-Math.PI/2);}
    ctx.drawImage(src,left,top,sw,sh,0,0,sw,sh);
    ctx.restore();
    return out;
  }

  function transformedSource(page,src){
    if(!page||!src||page.pageType==='divider'||page.pageType==='blank')return src;
    const value=valuesForPage(page);
    if(!hasTransform(page))return src;
    const key=[src.width,src.height,value.rotation,value.rotationLocked?1:0,
      value.cropLeft.toFixed(5),value.cropTop.toFixed(5),value.cropRight.toFixed(5),value.cropBottom.toFixed(5)].join('|');
    const cached=cache.get(page);
    if(cached&&cached.src===src&&cached.key===key)return cached.canvas;
    const out=rotateCanvasSource(src,value.rotation,value);
    if(value.rotationLocked)out.dataset.pdfManualRotation='1';
    out.dataset.pdfSourceRotation=String(value.rotation);
    cache.set(page,{src,key,canvas:out});
    return out;
  }

  function drawExact(ctx,src,cellX,cellY,cellW,cellH){
    const pw=Math.max(1,Number(src?.width)||1);
    const ph=Math.max(1,Number(src?.height)||1);
    const scale=Math.min(cellW/pw,cellH/ph);
    const dw=pw*scale;
    const dh=ph*scale;
    const dx=cellX+(cellW-dw)/2;
    const dy=cellY+(cellH-dh)/2;
    ctx.drawImage(src,dx,dy,dw,dh);
    let border=false;
    try{border=!!showBorder;}catch(_){}
    if(border){
      ctx.strokeStyle='rgba(0,0,0,0.15)';
      ctx.lineWidth=Math.max(.4,cellW*.002);
      ctx.strokeRect(dx,dy,dw,dh);
    }
  }

  function installGetPageSrcWrapper(){
    if(getPageSrcWrapped)return true;
    let current=null;
    try{current=window.getPageSrc||getPageSrc;}catch(_){current=window.getPageSrc;}
    if(typeof current!=='function')return false;
    const original=current;
    const wrapped=function pageTransformGetPageSrc(page){
      const src=original.apply(this,arguments);
      return transformedSource(page,src);
    };
    wrapped.__pdfPageTransformEditV1=true;
    wrapped.__pdfPageTransformOriginal=original;
    window.getPageSrc=wrapped;
    try{getPageSrc=wrapped;}catch(_){}
    getPageSrcWrapped=true;
    return true;
  }

  function installDrawWrapper(){
    if(drawPageWrapped)return true;
    let current=null;
    try{current=window.drawPageInCell||drawPageInCell;}catch(_){current=window.drawPageInCell;}
    if(typeof current!=='function')return false;
    const original=current;
    const wrapped=function pageTransformDraw(ctx,src,cellX,cellY,cellW,cellH){
      if(src?.dataset?.pdfManualRotation==='1')return drawExact(ctx,src,cellX,cellY,cellW,cellH);
      return original.apply(this,arguments);
    };
    wrapped.__pdfPageTransformEditV1=true;
    wrapped.__pdfPageTransformOriginal=original;
    window.drawPageInCell=wrapped;
    try{drawPageInCell=wrapped;}catch(_){}
    drawPageWrapped=true;
    return true;
  }

  function enrichSettings(settings){
    if(!settings||typeof settings!=='object'||!Array.isArray(settings.pages))return settings;
    const sourcePages=pages();
    settings.pages=settings.pages.map((entry,index)=>{
      const page=sourcePages[index];
      if(!page)return entry;
      const value=valuesForPage(page);
      return{
        ...entry,
        rotation:value.rotation,
        rotation_locked:value.rotationLocked,
        crop_left_ratio:value.cropLeft,
        crop_top_ratio:value.cropTop,
        crop_right_ratio:value.cropRight,
        crop_bottom_ratio:value.cropBottom,
      };
    });
    return settings;
  }

  function endpointPath(input){
    try{
      const raw=typeof input==='string'?input:input?.url;
      if(!raw)return'';
      const url=new URL(raw,location.href);
      return url.origin===location.origin?url.pathname.replace(/\/+$/,''):'';
    }catch(_){return'';}
  }

  function installApiWrapper(){
    if(apiWrapped||typeof window.apiProcessPdf!=='function')return apiWrapped;
    const original=window.apiProcessPdf;
    const wrapped=function pageTransformApi(files,settings,options){
      return original.call(this,files,enrichSettings(settings),options);
    };
    wrapped.__pdfPageTransformEditV1=true;
    window.apiProcessPdf=wrapped;
    try{apiProcessPdf=wrapped;}catch(_){}
    apiWrapped=true;
    return true;
  }

  function installFetchWrapper(){
    if(fetchWrapped||typeof window.fetch!=='function')return fetchWrapped;
    const original=window.fetch.bind(window);
    const wrapped=function pageTransformFetch(input,init){
      try{
        const path=endpointPath(input);
        if(path==='/api/pdf/process'&&init?.body instanceof FormData){
          const raw=init.body.get('settings');
          if(raw)init.body.set('settings',JSON.stringify(enrichSettings(JSON.parse(raw))));
        }else if(path==='/api/pdf/process-storage'&&init&&typeof init.body==='string'){
          const body=JSON.parse(init.body);
          if(body?.settings){body.settings=enrichSettings(body.settings);init.body=JSON.stringify(body);}
        }
      }catch(error){console.warn('[pdf-page-transform] request enrichment failed',error);}
      return original(input,init);
    };
    wrapped.__pdfPageTransformEditV1=true;
    window.fetch=wrapped;
    fetchWrapped=true;
    return true;
  }

  function installSessionBridge(){
    if(sessionWrapped)return true;
    const collect=window.collectEditorState;
    const load=window.loadEditorSession;
    if(typeof collect!=='function'||typeof load!=='function')return false;
    const originalCollect=collect;
    const originalLoad=load;
    const collectWrapped=function collectWithPageTransforms(){
      const state=originalCollect.apply(this,arguments)||{};
      state.pageTransforms=pages().map(page=>valuesForPage(page));
      return state;
    };
    const loadWrapped=async function loadWithPageTransforms(data){
      const result=await originalLoad.apply(this,arguments);
      try{
        const state=typeof data?.state==='string'?JSON.parse(data.state):(data?.state||{});
        const saved=Array.isArray(state.pageTransforms)?state.pageTransforms:[];
        pages().forEach((page,index)=>{if(saved[index])setValues(page,saved[index]);});
      }catch(error){console.warn('[pdf-page-transform] saved transforms could not be restored',error);}
      selectedPageId='';
      cropMode=false;
      syncControls();
      hideCropOverlay();
      requestPreview(0);
      return result;
    };
    collectWrapped.__pdfPageTransformStateV1=true;
    loadWrapped.__pdfPageTransformStateV1=true;
    window.collectEditorState=collectWrapped;
    window.loadEditorSession=loadWrapped;
    try{collectEditorState=collectWrapped;loadEditorSession=loadWrapped;}catch(_){}
    sessionWrapped=true;
    return true;
  }

  function installStyles(){
    if(byId('pdfPageTransformEditStylesV1'))return;
    const style=document.createElement('style');
    style.id='pdfPageTransformEditStylesV1';
    style.textContent=`
      .pdf-page-transform-block{margin-top:7px;padding-top:7px;border-top:1px solid #e2e8f0}
      .pdf-page-transform-title{display:flex;align-items:center;justify-content:space-between;gap:6px;margin-bottom:6px;color:#334155;font-size:9px;font-weight:900}
      .pdf-page-transform-title span{color:#64748b;font-size:8px;font-weight:800}
      .pdf-page-transform-actions{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:4px}
      .pdf-page-transform-actions button{min-width:0;border:1px solid #cbd5e1;border-radius:7px;background:#f8fafc;color:#334155;padding:6px 3px;font:inherit;font-size:8.5px;font-weight:850;cursor:pointer;white-space:nowrap}
      .pdf-page-transform-actions button[data-active="true"]{border-color:#2563eb;background:#eff6ff;color:#1d4ed8}
      .pdf-page-transform-actions button:disabled{opacity:.42;cursor:not-allowed}
      .pdf-page-crop-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:4px;margin-top:5px}
      .pdf-page-crop-field label{display:block;margin-bottom:2px;text-align:center;color:#64748b;font-size:8px;font-weight:800}
      .pdf-page-crop-field input{width:100%;padding:5px 2px!important;text-align:center;font-size:9px!important;font-weight:850}
      #pdfPageCropOverlayV1{position:fixed;z-index:2147483000;display:none;overflow:hidden;border:2px solid #2563eb;border-radius:3px;background:#fff;box-shadow:0 8px 30px rgba(15,23,42,.24);touch-action:none}
      #pdfPageCropOverlayV1[data-visible="true"]{display:block}
      #pdfPageCropOverlayV1 canvas{position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none}
      #pdfPageCropBoxV1{position:absolute;border:2px solid #f59e0b;box-shadow:0 0 0 2000px rgba(15,23,42,.48);pointer-events:none}
      .pdf-page-crop-handle{position:absolute;z-index:3;background:#f59e0b;border:2px solid #fff;box-shadow:0 1px 4px rgba(15,23,42,.4);pointer-events:auto;touch-action:none}
      .pdf-page-crop-handle[data-edges="left"],.pdf-page-crop-handle[data-edges="right"]{width:11px;height:28px;top:50%;margin-top:-14px;border-radius:5px;cursor:ew-resize}
      .pdf-page-crop-handle[data-edges="left"]{left:-6px}.pdf-page-crop-handle[data-edges="right"]{right:-6px}
      .pdf-page-crop-handle[data-edges="top"],.pdf-page-crop-handle[data-edges="bottom"]{width:28px;height:11px;left:50%;margin-left:-14px;border-radius:5px;cursor:ns-resize}
      .pdf-page-crop-handle[data-edges="top"]{top:-6px}.pdf-page-crop-handle[data-edges="bottom"]{bottom:-6px}
      .pdf-page-crop-handle[data-edges*="top,"][data-edges*="left"],.pdf-page-crop-handle[data-edges*="bottom,"][data-edges*="right"]{cursor:nwse-resize}
      .pdf-page-crop-handle[data-edges*="top,"][data-edges*="right"],.pdf-page-crop-handle[data-edges*="bottom,"][data-edges*="left"]{cursor:nesw-resize}
      .pdf-page-crop-handle[data-edges*=","]{width:13px;height:13px;border-radius:50%}
      .pdf-page-crop-handle[data-edges="top,left"]{left:-7px;top:-7px}.pdf-page-crop-handle[data-edges="top,right"]{right:-7px;top:-7px}
      .pdf-page-crop-handle[data-edges="bottom,left"]{left:-7px;bottom:-7px}.pdf-page-crop-handle[data-edges="bottom,right"]{right:-7px;bottom:-7px}
      #pdfPageCropOverlayLabelV1{position:absolute;left:5px;top:5px;z-index:4;padding:3px 6px;border-radius:999px;background:rgba(15,23,42,.82);color:#fff;font-size:8px;font-weight:900;pointer-events:none}
    `;
    document.head.appendChild(style);
  }

  function ensureControls(){
    installStyles();
    const panel=byId('pdfNupPageAdjustPanelV1');
    if(!panel)return false;
    let block=byId('pdfPageTransformControlsV1');
    if(!block){
      block=document.createElement('div');
      block.id='pdfPageTransformControlsV1';
      block.className='pdf-page-transform-block';
      block.innerHTML=`
        <div class="pdf-page-transform-title">회전 · 잘라내기 <span id="pdfPageTransformSummaryV1">기본</span></div>
        <div class="pdf-page-transform-actions">
          <button type="button" id="pdfPageRotateLeftV1">↶ 왼쪽 90°</button>
          <button type="button" id="pdfPageRotateRightV1">↷ 오른쪽 90°</button>
          <button type="button" id="pdfPageCropToggleV1">자르기</button>
          <button type="button" id="pdfPageCropResetV1">자르기 초기화</button>
        </div>
        <div class="pdf-page-crop-grid">
          <div class="pdf-page-crop-field"><label for="pdfPageCropLeftV1">좌 %</label><input id="pdfPageCropLeftV1" type="number" min="0" max="90" step="0.5" value="0"></div>
          <div class="pdf-page-crop-field"><label for="pdfPageCropTopV1">상 %</label><input id="pdfPageCropTopV1" type="number" min="0" max="90" step="0.5" value="0"></div>
          <div class="pdf-page-crop-field"><label for="pdfPageCropRightV1">우 %</label><input id="pdfPageCropRightV1" type="number" min="0" max="90" step="0.5" value="0"></div>
          <div class="pdf-page-crop-field"><label for="pdfPageCropBottomV1">하 %</label><input id="pdfPageCropBottomV1" type="number" min="0" max="90" step="0.5" value="0"></div>
        </div>`;
      const grid=panel.querySelector('.pdf-nup-adjust-grid');
      if(grid)grid.insertAdjacentElement('afterend',block);else panel.appendChild(block);

      byId('pdfPageRotateLeftV1')?.addEventListener('click',()=>rotateSelected(-90));
      byId('pdfPageRotateRightV1')?.addEventListener('click',()=>rotateSelected(90));
      byId('pdfPageCropToggleV1')?.addEventListener('click',toggleCropMode);
      byId('pdfPageCropResetV1')?.addEventListener('click',resetSelectedCrop);
      [['pdfPageCropLeftV1','left'],['pdfPageCropTopV1','top'],['pdfPageCropRightV1','right'],['pdfPageCropBottomV1','bottom']].forEach(([id,edge])=>{
        byId(id)?.addEventListener('input',event=>applyCropInput(edge,event.target.value));
        byId(id)?.addEventListener('change',()=>requestPreview(0));
      });
    }

    const strong=panel.querySelector('.pdf-nup-adjust-head strong');
    if(strong)strong.textContent='페이지 위치·크기·회전·잘라내기';
    const help=panel.querySelector('.pdf-nup-adjust-help');
    if(help)help.textContent='미리보기 드래그 = 위치 이동 · 파란 핸들 = 확대/축소 · 회전 버튼 = 90° 고정 · 자르기 = 미리보기 위 테두리를 직접 드래그. 편집값은 최종 PDF와 작업 저장에 함께 반영됩니다.';
    const reset=byId('pdfNupAdjustReset');
    const resetAll=byId('pdfNupAdjustResetAll');
    if(reset){
      reset.textContent='선택 편집 초기화';
      if(reset.dataset.pageTransformBound!=='true'){
        reset.dataset.pageTransformBound='true';
        reset.addEventListener('click',()=>{const page=selectedPage();if(page)resetTransform(page);cropMode=false;hideCropOverlay();syncControls();requestPreview(0);});
      }
    }
    if(resetAll){
      resetAll.textContent='전체 편집 초기화';
      if(resetAll.dataset.pageTransformBound!=='true'){
        resetAll.dataset.pageTransformBound='true';
        resetAll.addEventListener('click',()=>{pages().forEach(resetTransform);cropMode=false;hideCropOverlay();syncControls();requestPreview(0);});
      }
    }
    syncControls();
    return true;
  }

  function syncControls(){
    const page=selectedPage();
    const value=valuesForPage(page);
    const visual=visualCrop(value);
    const disabled=!page;
    const ids=['pdfPageRotateLeftV1','pdfPageRotateRightV1','pdfPageCropToggleV1','pdfPageCropResetV1','pdfPageCropLeftV1','pdfPageCropTopV1','pdfPageCropRightV1','pdfPageCropBottomV1'];
    ids.forEach(id=>{const el=byId(id);if(el)el.disabled=disabled;});
    const inputMap={pdfPageCropLeftV1:visual.left,pdfPageCropTopV1:visual.top,pdfPageCropRightV1:visual.right,pdfPageCropBottomV1:visual.bottom};
    Object.entries(inputMap).forEach(([id,ratio])=>{const el=byId(id);if(el&&!el.matches(':focus'))el.value=(ratio*100).toFixed(1);});
    const summary=byId('pdfPageTransformSummaryV1');
    if(summary){
      if(!page)summary.textContent='페이지 선택 필요';
      else{
        const cropText=hasCrop(page)?` · 자르기 ${Math.round((visual.left+visual.top+visual.right+visual.bottom)*100)}%`:' · 자르기 없음';
        summary.textContent=`${value.rotation}°${value.rotationLocked?' 고정':''}${cropText}`;
      }
    }
    const cropButton=byId('pdfPageCropToggleV1');
    if(cropButton){cropButton.dataset.active=String(!!page&&cropMode);cropButton.textContent=cropMode?'자르기 종료':'자르기';}
    if(cropMode&&page)queueCropOverlay();
  }

  function rotateSelected(delta){
    const page=selectedPage();
    if(!page)return;
    const value=valuesForPage(page);
    setValues(page,{rotation:value.rotation+delta,rotationLocked:true});
    syncControls();
    requestPreview(0);
    queueCropOverlay();
  }

  function resetSelectedCrop(){
    const page=selectedPage();
    if(!page)return;
    setValues(page,{cropLeft:0,cropTop:0,cropRight:0,cropBottom:0});
    syncControls();
    updateCropBox();
    requestPreview(0);
  }

  function applyCropInput(visualEdge,percent){
    const page=selectedPage();
    if(!page)return;
    setValues(page,sourcePatchForVisual(page,visualEdge,normal(percent,0)/100));
    syncControls();
    updateCropBox();
  }

  function toggleCropMode(){
    const page=selectedPage();
    if(!page)return;
    cropMode=!cropMode;
    syncControls();
    if(cropMode)queueCropOverlay();else hideCropOverlay();
  }

  function ensureCropOverlay(){
    let overlay=byId('pdfPageCropOverlayV1');
    if(overlay)return overlay;
    overlay=document.createElement('div');
    overlay.id='pdfPageCropOverlayV1';
    overlay.innerHTML=`
      <canvas id="pdfPageCropCanvasV1"></canvas>
      <div id="pdfPageCropBoxV1">
        <span class="pdf-page-crop-handle" data-edges="left"></span>
        <span class="pdf-page-crop-handle" data-edges="top"></span>
        <span class="pdf-page-crop-handle" data-edges="right"></span>
        <span class="pdf-page-crop-handle" data-edges="bottom"></span>
        <span class="pdf-page-crop-handle" data-edges="top,left"></span>
        <span class="pdf-page-crop-handle" data-edges="top,right"></span>
        <span class="pdf-page-crop-handle" data-edges="bottom,left"></span>
        <span class="pdf-page-crop-handle" data-edges="bottom,right"></span>
      </div>
      <div id="pdfPageCropOverlayLabelV1">자르기</div>`;
    overlay.addEventListener('pointerdown',event=>{
      const handle=event.target?.closest?.('.pdf-page-crop-handle');
      event.preventDefault();
      event.stopImmediatePropagation();
      event.stopPropagation();
      if(!handle)return;
      const page=selectedPage();
      if(!page)return;
      cropDrag={pointerId:event.pointerId,page,edges:String(handle.dataset.edges||'').split(',').filter(Boolean)};
      try{handle.setPointerCapture?.(event.pointerId);}catch(_){}
    },true);
    document.body.appendChild(overlay);
    return overlay;
  }

  function hideCropOverlay(){
    const overlay=byId('pdfPageCropOverlayV1');
    if(overlay)overlay.dataset.visible='false';
  }

  function drawCropReference(page,frameWidth,frameHeight){
    const canvas=byId('pdfPageCropCanvasV1');
    const source=page?.thumbCanvas;
    if(!canvas||!source)return;
    const rotation=valuesForPage(page).rotation;
    const reference=rotateCanvasSource(source,rotation,{cropLeft:0,cropTop:0,cropRight:0,cropBottom:0});
    const width=Math.max(1,Math.round(frameWidth));
    const height=Math.max(1,Math.round(frameHeight));
    if(canvas.width!==width)canvas.width=width;
    if(canvas.height!==height)canvas.height=height;
    const ctx=canvas.getContext('2d');
    ctx.clearRect(0,0,width,height);
    ctx.drawImage(reference,0,0,width,height);
  }

  function cropReferenceAspect(page){
    const source=page?.thumbCanvas;
    if(!source?.width||!source?.height)return 1;
    const rotation=valuesForPage(page).rotation;
    return rotation===90||rotation===270?source.height/source.width:source.width/source.height;
  }

  function positionCropOverlay(){
    overlayFrame=0;
    if(!cropMode){hideCropOverlay();return;}
    const page=selectedPage();
    if(!page){hideCropOverlay();return;}
    const hit=document.querySelector(`.pdf-nup-adjust-hit[data-page-id="${CSS.escape(String(page.id))}"]`)||document.querySelector(`.pdf-nup-adjust-hit[data-page-id='${String(page.id).replace(/'/g,"\\'")}']`);
    if(!hit){hideCropOverlay();return;}
    const hitRect=hit.getBoundingClientRect();
    if(hitRect.width<2||hitRect.height<2){hideCropOverlay();return;}
    const aspect=cropReferenceAspect(page);
    let width=hitRect.width;
    let height=width/Math.max(.01,aspect);
    if(height>hitRect.height){height=hitRect.height;width=height*aspect;}
    const left=hitRect.left+(hitRect.width-width)/2;
    const top=hitRect.top+(hitRect.height-height)/2;
    const overlay=ensureCropOverlay();
    overlay.style.left=`${left}px`;
    overlay.style.top=`${top}px`;
    overlay.style.width=`${Math.max(1,width)}px`;
    overlay.style.height=`${Math.max(1,height)}px`;
    overlay.dataset.visible='true';
    drawCropReference(page,width,height);
    const label=byId('pdfPageCropOverlayLabelV1');
    if(label)label.textContent=`자르기 · ${valuesForPage(page).rotation}°`;
    updateCropBox();
  }

  function updateCropBox(){
    const page=selectedPage();
    const box=byId('pdfPageCropBoxV1');
    if(!page||!box)return;
    const visual=visualCrop(valuesForPage(page));
    box.style.left=`${visual.left*100}%`;
    box.style.top=`${visual.top*100}%`;
    box.style.right=`${visual.right*100}%`;
    box.style.bottom=`${visual.bottom*100}%`;
  }

  function queueCropOverlay(){
    if(overlayFrame)return;
    overlayFrame=requestAnimationFrame(positionCropOverlay);
  }

  function moveCrop(event){
    const state=cropDrag;
    if(!state||event.pointerId!==state.pointerId)return;
    event.preventDefault();
    event.stopImmediatePropagation();
    event.stopPropagation();
    const overlay=byId('pdfPageCropOverlayV1');
    const rect=overlay?.getBoundingClientRect();
    if(!rect?.width||!rect?.height)return;
    state.edges.forEach(edge=>{
      let ratio=0;
      if(edge==='left')ratio=(event.clientX-rect.left)/rect.width;
      else if(edge==='right')ratio=(rect.right-event.clientX)/rect.width;
      else if(edge==='top')ratio=(event.clientY-rect.top)/rect.height;
      else if(edge==='bottom')ratio=(rect.bottom-event.clientY)/rect.height;
      setValues(state.page,sourcePatchForVisual(state.page,edge,ratio));
    });
    selectedPageId=String(state.page.id);
    syncControls();
    updateCropBox();
  }

  function endCrop(event){
    if(!cropDrag||event.pointerId!==cropDrag.pointerId)return;
    event.preventDefault();
    event.stopImmediatePropagation();
    event.stopPropagation();
    cropDrag=null;
    syncControls();
    requestPreview(0);
  }

  function requestPreview(delay=0){
    const run=()=>{
      try{
        if(typeof window.PdfNupPageAdjust?.refresh==='function'){window.PdfNupPageAdjust.refresh();return;}
        if(typeof window.PdfEditorLayoutExport?.refresh==='function'){window.PdfEditorLayoutExport.refresh();return;}
        if(typeof triggerPreview==='function')triggerPreview();
      }catch(error){console.warn('[pdf-page-transform] preview refresh failed',error);}
    };
    if(delay>0)setTimeout(run,delay);else run();
  }

  function installPreviewObserver(){
    const area=byId('previewScroll');
    if(!area||previewObserver||typeof MutationObserver!=='function')return !!area;
    previewObserver=new MutationObserver(mutations=>{
      if(mutations.some(mutation=>mutation.addedNodes.length||mutation.removedNodes.length)){
        requestAnimationFrame(()=>{syncControls();queueCropOverlay();});
      }
    });
    previewObserver.observe(area,{childList:true,subtree:true});
    area.addEventListener('scroll',queueCropOverlay,{passive:true});
    window.addEventListener('resize',queueCropOverlay,{passive:true});
    return true;
  }

  function installSelectionTracking(){
    if(document.documentElement.dataset.pdfPageTransformSelectionTracking==='1')return;
    document.documentElement.dataset.pdfPageTransformSelectionTracking='1';
    document.addEventListener('click',event=>{
      const hit=event.target?.closest?.('.pdf-nup-adjust-hit');
      if(!hit?.dataset?.pageId)return;
      selectedPageId=String(hit.dataset.pageId);
      requestAnimationFrame(()=>{syncControls();queueCropOverlay();});
    },true);
    document.addEventListener('pointermove',moveCrop,true);
    document.addEventListener('pointerup',endCrop,true);
    document.addEventListener('pointercancel',endCrop,true);
  }

  function install(){
    installStyles();
    installSelectionTracking();
    installGetPageSrcWrapper();
    installDrawWrapper();
    ensureControls();
    installPreviewObserver();
    if(window.PdfNupPageAdjust){installApiWrapper();installFetchWrapper();installSessionBridge();}
    syncControls();
    queueCropOverlay();
  }

  window.PdfPageTransformEdit={
    valuesForPage,
    setValues,
    resetTransform,
    hasCrop,
    hasTransform,
    visualCrop,
    sourceEdgeForVisual,
    transformedSource,
    enrichSettings,
    rotateSelected,
    toggleCropMode,
    isCropMode:()=>cropMode,
    refreshOverlay:queueCropOverlay,
    stage:'crop-rotate-before-scale-pan-v1',
  };

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();
  for(const delay of INSTALL_DELAYS)setTimeout(install,delay);
})();
