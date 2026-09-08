// Advanced direct page editing: image-editor style corner scaling, edge cropping,
// and rectangular visual white-out for dirty/scanned areas.
(function(){
  'use strict';
  if(window.__pdfDirectPageEditV2)return;

  const root=document.documentElement;
  const smokeHost=root.dataset.pdfDirectPageEditHost==='1';
  let advanced=false;
  try{advanced=new URLSearchParams(location.search).get('profile')==='advanced';}catch(_){}
  advanced=advanced||root.dataset.pdfEditorAdvancedScope==='single-page-precision-v1'||smokeHost;
  if(!advanced)return;
  window.__pdfDirectPageEditV2=true;

  const MAX_ERASE_REGIONS=40;
  const MIN_ERASE_SIZE=.006;
  const INSTALL_DELAYS=[0,80,180,360,700,1200,2200,4000];
  const byId=id=>document.getElementById(id);
  const clamp=(v,min,max)=>Math.max(min,Math.min(max,Number(v)||0));
  const num=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;

  let selectedPageId='';
  let gesture=null;
  let decorateFrame=0;
  let observer=null;
  let getPageSrcWrapper=null;
  let apiWrapper=null;
  let fetchWrapper=null;
  let collectWrapper=null;
  let loadWrapper=null;
  let historyWrapped=false;
  let directUndo=[];
  let directRedo=[];
  let directUndoArmed=false;
  const erasePreviewCache=new WeakMap();

  function pages(){
    try{return Array.isArray(parsedPages)?parsedPages:[];}catch(_){return[];}
  }
  function pageById(id){return pages().find(page=>String(page?.id)===String(id))||null;}
  function selectedPage(){
    const hit=document.querySelector('.pdf-nup-adjust-hit[data-selected="true"]');
    if(hit?.dataset?.pageId)selectedPageId=String(hit.dataset.pageId);
    return pageById(selectedPageId);
  }
  function transformApi(){return window.PdfPageTransformEdit||null;}
  function placementApi(){return window.PdfNupPageAdjust||null;}
  function transformValues(page){
    return transformApi()?.valuesForPage?.(page)||{
      rotation:num(page?.rotation,0),
      cropLeft:num(page?.cropLeftRatio,0),cropTop:num(page?.cropTopRatio,0),
      cropRight:num(page?.cropRightRatio,0),cropBottom:num(page?.cropBottomRatio,0),
    };
  }
  function visualCrop(page){
    const value=transformValues(page);
    return transformApi()?.visualCrop?.(value)||{
      left:num(value.cropLeft,0),top:num(value.cropTop,0),right:num(value.cropRight,0),bottom:num(value.cropBottom,0),
    };
  }
  function placementValues(page){
    return placementApi()?.valuesForPage?.(page)||{
      scale:num(page?.nupScale,1),offsetX:num(page?.nupOffsetX,0),offsetY:num(page?.nupOffsetY,0),
    };
  }
  function normalizedRotation(page){
    const value=num(transformValues(page).rotation,0);
    return ((Math.round(value/90)*90)%360+360)%360;
  }

  function normalizeRect(rect){
    let x0=clamp(rect?.x0,0,1),y0=clamp(rect?.y0,0,1),x1=clamp(rect?.x1,0,1),y1=clamp(rect?.y1,0,1);
    if(x1<x0)[x0,x1]=[x1,x0];
    if(y1<y0)[y0,y1]=[y1,y0];
    return{x0,y0,x1,y1};
  }
  function eraseRegionsForPage(page){
    const raw=Array.isArray(page?.eraseRegions)?page.eraseRegions:(Array.isArray(page?.erase_regions)?page.erase_regions:[]);
    return raw.map(normalizeRect).filter(r=>r.x1-r.x0>=MIN_ERASE_SIZE&&r.y1-r.y0>=MIN_ERASE_SIZE).slice(0,MAX_ERASE_REGIONS);
  }
  function setEraseRegions(page,regions){
    if(!page)return[];
    const clean=(Array.isArray(regions)?regions:[]).map(normalizeRect)
      .filter(r=>r.x1-r.x0>=MIN_ERASE_SIZE&&r.y1-r.y0>=MIN_ERASE_SIZE)
      .slice(0,MAX_ERASE_REGIONS);
    page.eraseRegions=clean.map(r=>({...r}));
    page.erase_regions=clean.map(r=>({...r}));
    erasePreviewCache.delete(page);
    return clean;
  }
  function pushDirectHistory(page,before,after,label='영역 지우기'){
    if(!page)return;
    if(JSON.stringify(before||[])===JSON.stringify(after||[]))return;
    directUndo.push({pageId:String(page.id),before,after,label});
    if(directUndo.length>40)directUndo.shift();
    directRedo=[];directUndoArmed=true;
    root.dataset.pdfDirectUndoCount=String(directUndo.length);
  }
  function addEraseRegion(page,rect,{record=true}={}){
    if(!page)return false;
    const clean=normalizeRect(rect);
    if(clean.x1-clean.x0<MIN_ERASE_SIZE||clean.y1-clean.y0<MIN_ERASE_SIZE)return false;
    const before=eraseRegionsForPage(page),next=[...before,clean].slice(-MAX_ERASE_REGIONS);
    setEraseRegions(page,next);
    if(record)pushDirectHistory(page,before,next,'영역 지우기');
    return true;
  }
  function clearEraseRegions(page,{record=true}={}){
    if(!page)return false;
    const before=eraseRegionsForPage(page);if(!before.length)return false;
    setEraseRegions(page,[]);if(record)pushDirectHistory(page,before,[],'지운 영역 초기화');
    requestPreview();queueDecorate();syncEraseUi();return true;
  }
  function undoErase(){
    const entry=directUndo.pop();if(!entry)return false;
    const page=pageById(entry.pageId);if(!page)return false;
    setEraseRegions(page,entry.before);directRedo.push(entry);directUndoArmed=directUndo.length>0;
    root.dataset.pdfDirectUndoCount=String(directUndo.length);requestPreview();queueDecorate();syncEraseUi();return true;
  }
  function redoErase(){
    const entry=directRedo.pop();if(!entry)return false;
    const page=pageById(entry.pageId);if(!page)return false;
    setEraseRegions(page,entry.after);directUndo.push(entry);directUndoArmed=true;
    root.dataset.pdfDirectUndoCount=String(directUndo.length);requestPreview();queueDecorate();syncEraseUi();return true;
  }

  function sourceRectToVisual(page,rect){
    const r=normalizeRect(rect),rot=normalizedRotation(page);
    if(rot===90)return{x0:1-r.y1,y0:r.x0,x1:1-r.y0,y1:r.x1};
    if(rot===180)return{x0:1-r.x1,y0:1-r.y1,x1:1-r.x0,y1:1-r.y0};
    if(rot===270)return{x0:r.y0,y0:1-r.x1,x1:r.y1,y1:1-r.x0};
    return r;
  }
  function visualRectToSource(page,rect){
    const r=normalizeRect(rect),rot=normalizedRotation(page);
    if(rot===90)return normalizeRect({x0:r.y0,y0:1-r.x1,x1:r.y1,y1:1-r.x0});
    if(rot===180)return normalizeRect({x0:1-r.x1,y0:1-r.y1,x1:1-r.x0,y1:1-r.y0});
    if(rot===270)return normalizeRect({x0:1-r.y1,y0:r.x0,x1:1-r.y0,y1:r.x1});
    return r;
  }
  function visibleSelectionToSource(page,selection){
    const pick=normalizeRect(selection),crop=visualCrop(page);
    const visibleW=Math.max(.001,1-num(crop.left)-num(crop.right)),visibleH=Math.max(.001,1-num(crop.top)-num(crop.bottom));
    return visualRectToSource(page,{
      x0:num(crop.left)+visibleW*pick.x0,y0:num(crop.top)+visibleH*pick.y0,
      x1:num(crop.left)+visibleW*pick.x1,y1:num(crop.top)+visibleH*pick.y1,
    });
  }
  function sourceRectToVisible(page,sourceRect){
    const visual=sourceRectToVisual(page,sourceRect),crop=visualCrop(page);
    const visibleW=Math.max(.001,1-num(crop.left)-num(crop.right)),visibleH=Math.max(.001,1-num(crop.top)-num(crop.bottom));
    const raw={x0:(visual.x0-num(crop.left))/visibleW,y0:(visual.y0-num(crop.top))/visibleH,x1:(visual.x1-num(crop.left))/visibleW,y1:(visual.y1-num(crop.top))/visibleH};
    const x0=Math.max(0,raw.x0),y0=Math.max(0,raw.y0),x1=Math.min(1,raw.x1),y1=Math.min(1,raw.y1);
    return x1>x0&&y1>y0?{x0,y0,x1,y1}:null;
  }

  function cloneCanvas(source){
    const out=document.createElement('canvas');out.width=Math.max(1,source?.width||1);out.height=Math.max(1,source?.height||1);
    const ctx=out.getContext('2d',{alpha:false});ctx.fillStyle='#fff';ctx.fillRect(0,0,out.width,out.height);ctx.drawImage(source,0,0);return out;
  }
  function paintErasesOnSource(page,source){
    const regions=eraseRegionsForPage(page);if(!regions.length||!source?.width||!source?.height)return source;
    const crop=visualCrop(page),key=[source.width,source.height,normalizedRotation(page),num(crop.left).toFixed(5),num(crop.top).toFixed(5),num(crop.right).toFixed(5),num(crop.bottom).toFixed(5),JSON.stringify(regions)].join('|');
    const cached=erasePreviewCache.get(page);if(cached?.source===source&&cached.key===key)return cached.canvas;
    const out=cloneCanvas(source),ctx=out.getContext('2d');ctx.fillStyle='#fff';
    regions.forEach(region=>{const visible=sourceRectToVisible(page,region);if(!visible)return;ctx.fillRect(Math.floor(visible.x0*out.width),Math.floor(visible.y0*out.height),Math.max(1,Math.ceil((visible.x1-visible.x0)*out.width)),Math.max(1,Math.ceil((visible.y1-visible.y0)*out.height)));});
    if(source.dataset)Object.entries(source.dataset).forEach(([k,v])=>{try{out.dataset[k]=v;}catch(_){}});
    out.dataset.pdfEraseRegionsApplied=String(regions.length);erasePreviewCache.set(page,{source,key,canvas:out});return out;
  }

  function installGetPageSrcWrapper(){
    if(getPageSrcWrapper)return true;
    const current=window.getPageSrc;if(typeof current!=='function')return false;
    if(current.__pdfDirectEraseSourceV2){getPageSrcWrapper=current;return true;}
    const original=current,wrapped=function directEraseSource(page){return paintErasesOnSource(page,original.apply(this,arguments));};
    wrapped.__pdfDirectEraseSourceV2=true;wrapped.__pdfDirectEraseSourceOriginal=original;
    window.getPageSrc=wrapped;try{getPageSrc=wrapped;}catch(_){}getPageSrcWrapper=wrapped;return true;
  }

  function enrichSettings(settings){
    if(!settings||typeof settings!=='object'||!Array.isArray(settings.pages))return settings;
    const source=pages();settings.pages=settings.pages.map((entry,index)=>({...entry,erase_regions:eraseRegionsForPage(source[index])}));return settings;
  }
  function endpointPath(input){try{const raw=typeof input==='string'?input:input?.url;if(!raw)return'';const url=new URL(raw,location.href);return url.origin===location.origin?url.pathname.replace(/\/+$/,''):'';}catch(_){return'';}}
  function installRequestWrappers(){
    const api=window.apiProcessPdf;
    if(!apiWrapper&&typeof api==='function'&&!api.__pdfDirectEraseRequestV2){
      const original=api,wrapped=function directEraseApi(files,settings,options){return original.call(this,files,enrichSettings(settings),options);};
      wrapped.__pdfDirectEraseRequestV2=true;window.apiProcessPdf=wrapped;try{apiProcessPdf=wrapped;}catch(_){}apiWrapper=wrapped;
    }else if(!apiWrapper&&api?.__pdfDirectEraseRequestV2)apiWrapper=api;
    const currentFetch=window.fetch;
    if(!fetchWrapper&&typeof currentFetch==='function'&&!currentFetch.__pdfDirectEraseRequestV2){
      const original=currentFetch.bind(window),wrapped=function directEraseFetch(input,init){
        try{const path=endpointPath(input);if(path==='/api/pdf/process'&&init?.body instanceof FormData){const raw=init.body.get('settings');if(raw)init.body.set('settings',JSON.stringify(enrichSettings(JSON.parse(raw))));}else if(path==='/api/pdf/process-storage'&&init&&typeof init.body==='string'){const body=JSON.parse(init.body);if(body?.settings){body.settings=enrichSettings(body.settings);init.body=JSON.stringify(body);}}}catch(error){console.warn('[pdf-direct-edit] request enrichment failed',error);}
        return original(input,init);
      };
      wrapped.__pdfDirectEraseRequestV2=true;window.fetch=wrapped;fetchWrapper=wrapped;
    }else if(!fetchWrapper&&currentFetch?.__pdfDirectEraseRequestV2)fetchWrapper=currentFetch;
  }
  function installSessionBridge(){
    const collect=window.collectEditorState,load=window.loadEditorSession;
    if(!collectWrapper&&typeof collect==='function'&&!collect.__pdfDirectEraseStateV2){
      const original=collect,wrapped=function directEraseCollect(){const state=original.apply(this,arguments)||{};state.pageEraseRegions=pages().map(eraseRegionsForPage);return state;};
      wrapped.__pdfDirectEraseStateV2=true;window.collectEditorState=wrapped;try{collectEditorState=wrapped;}catch(_){}collectWrapper=wrapped;
    }else if(!collectWrapper&&collect?.__pdfDirectEraseStateV2)collectWrapper=collect;
    if(!loadWrapper&&typeof load==='function'&&!load.__pdfDirectEraseStateV2){
      const original=load,wrapped=async function directEraseLoad(data){
        const result=await original.apply(this,arguments);
        try{const state=typeof data?.state==='string'?JSON.parse(data.state):(data?.state||{}),saved=Array.isArray(state.pageEraseRegions)?state.pageEraseRegions:[];pages().forEach((page,index)=>setEraseRegions(page,saved[index]||[]));}catch(error){console.warn('[pdf-direct-edit] erase state restore failed',error);}
        directUndo=[];directRedo=[];directUndoArmed=false;requestPreview();queueDecorate();syncEraseUi();return result;
      };
      wrapped.__pdfDirectEraseStateV2=true;window.loadEditorSession=wrapped;try{loadEditorSession=wrapped;}catch(_){}loadWrapper=wrapped;
    }else if(!loadWrapper&&load?.__pdfDirectEraseStateV2)loadWrapper=load;
  }

  function requestPreview(){
    try{if(typeof placementApi()?.refresh==='function'){placementApi().refresh();return;}if(typeof window.PdfEditorLayoutExport?.refresh==='function'){window.PdfEditorLayoutExport.refresh();return;}if(typeof triggerPreview==='function')triggerPreview();}catch(error){console.warn('[pdf-direct-edit] preview refresh failed',error);}
  }

  function installStyles(){
    if(byId('pdfDirectPageEditStylesV2'))return;
    const style=document.createElement('style');style.id='pdfDirectPageEditStylesV2';style.textContent=`
      html[data-pdf-direct-page-edit="1"] #pdfPageCropToggleV1{display:none!important}
      html[data-pdf-direct-page-edit="1"] #pdfPageCropOverlayV1{display:none!important}
      html[data-pdf-direct-page-edit="1"] .pdf-nup-adjust-handle{display:none!important}
      .pdf-direct-page-frame{position:absolute;z-index:28;box-sizing:border-box;border:1.5px solid rgba(37,99,235,.72);pointer-events:none;overflow:visible;border-radius:2px;filter:drop-shadow(0 0 1px rgba(255,255,255,.9))}
      .pdf-nup-adjust-hit:not([data-selected="true"]) .pdf-direct-page-frame{display:none}
      .pdf-direct-scale-corner,.pdf-direct-crop-edge{position:absolute;z-index:35;pointer-events:auto;touch-action:none;user-select:none}
      .pdf-direct-scale-corner{width:15px;height:15px;border-radius:50%;background:#2563eb;border:2px solid #fff;box-shadow:0 1px 5px rgba(15,23,42,.45)}
      .pdf-direct-scale-corner[data-corner="tl"]{left:-8px;top:-8px;cursor:nwse-resize}.pdf-direct-scale-corner[data-corner="tr"]{right:-8px;top:-8px;cursor:nesw-resize}.pdf-direct-scale-corner[data-corner="bl"]{left:-8px;bottom:-8px;cursor:nesw-resize}.pdf-direct-scale-corner[data-corner="br"]{right:-8px;bottom:-8px;cursor:nwse-resize}
      .pdf-direct-crop-edge{background:transparent}.pdf-direct-crop-edge[data-edge="left"],.pdf-direct-crop-edge[data-edge="right"]{top:10px;bottom:10px;width:12px;cursor:ew-resize}.pdf-direct-crop-edge[data-edge="left"]{left:-6px}.pdf-direct-crop-edge[data-edge="right"]{right:-6px}.pdf-direct-crop-edge[data-edge="top"],.pdf-direct-crop-edge[data-edge="bottom"]{left:10px;right:10px;height:12px;cursor:ns-resize}.pdf-direct-crop-edge[data-edge="top"]{top:-6px}.pdf-direct-crop-edge[data-edge="bottom"]{bottom:-6px}
      .pdf-direct-crop-edge::before{content:'';position:absolute;background:rgba(245,158,11,.92);opacity:.38;border-radius:999px;transition:opacity .12s ease,transform .12s ease}.pdf-direct-crop-edge[data-edge="left"]::before,.pdf-direct-crop-edge[data-edge="right"]::before{left:4px;top:8px;bottom:8px;width:3px}.pdf-direct-crop-edge[data-edge="top"]::before,.pdf-direct-crop-edge[data-edge="bottom"]::before{top:4px;left:8px;right:8px;height:3px}.pdf-direct-crop-edge:hover::before{opacity:1;transform:scale(1.25)}
      .pdf-direct-crop-edge::after{content:'✂ 잘라내기';position:absolute;z-index:40;padding:3px 6px;border-radius:999px;background:rgba(15,23,42,.92);color:#fff;font-size:8px;font-weight:900;white-space:nowrap;opacity:0;transform:translateY(2px);transition:.12s;pointer-events:none}.pdf-direct-crop-edge:hover::after{opacity:1;transform:translateY(0)}.pdf-direct-crop-edge[data-edge="left"]::after{left:10px;top:50%}.pdf-direct-crop-edge[data-edge="right"]::after{right:10px;top:50%}.pdf-direct-crop-edge[data-edge="top"]::after{left:50%;top:10px}.pdf-direct-crop-edge[data-edge="bottom"]::after{left:50%;bottom:10px}
      .pdf-direct-edit-badge{position:absolute;right:4px;top:4px;z-index:32;padding:2px 5px;border-radius:999px;background:rgba(37,99,235,.9);color:#fff;font-size:7.5px;font-weight:900;pointer-events:none}
      html[data-pdf-direct-page-edit="1"] #pdfDragCropSelectionV1{border-color:#ef4444!important;background:rgba(239,68,68,.10)!important;box-shadow:none!important}html[data-pdf-direct-page-edit="1"] #pdfDragCropShadeV1{background:rgba(255,255,255,.01)!important}
      #pdfDragEraseResetV2{border:1px solid #fca5a5;border-radius:7px;background:#fff7f7;color:#b91c1c;padding:6px 5px;font:inherit;font-size:8.5px;font-weight:900;cursor:pointer}#pdfDragEraseResetV2:disabled{opacity:.4;cursor:not-allowed}
    `;document.head.appendChild(style);
  }

  function paperGeometry(canvas){
    let pw=210,ph=297;try{const settings=typeof getSettings==='function'?getSettings():{};pw=num(settings?.pw,210)||210;ph=num(settings?.ph,297)||297;}catch(_){}
    return{pw,ph,canvasWidth:Math.max(1,canvas?.getBoundingClientRect?.().width||1),canvasHeight:Math.max(1,canvas?.getBoundingClientRect?.().height||1)};
  }
  function currentVisibleAspect(page){
    const source=page?.thumbCanvas;let w=Math.max(1,num(source?.width,1)),h=Math.max(1,num(source?.height,1)),value=transformValues(page);
    w*=Math.max(.01,1-num(value.cropLeft)-num(value.cropRight));h*=Math.max(.01,1-num(value.cropTop)-num(value.cropBottom));if([90,270].includes(normalizedRotation(page)))[w,h]=[h,w];
    const fine=Math.abs(num(page?.fineRotationDeg??page?.fine_rotation_deg,0))*Math.PI/180;if(fine>.00001){const c=Math.abs(Math.cos(fine)),s=Math.abs(Math.sin(fine));[w,h]=[w*c+h*s,w*s+h*c];}return Math.max(.02,w/Math.max(.01,h));
  }
  function frameRectForHit(page,hit){
    const width=Math.max(1,hit.clientWidth||hit.getBoundingClientRect().width||1),height=Math.max(1,hit.clientHeight||hit.getBoundingClientRect().height||1),aspect=currentVisibleAspect(page);
    let baseW=width,baseH=baseW/aspect;if(baseH>height){baseH=height;baseW=baseH*aspect;}
    const place=placementValues(page),scale=clamp(place.scale,.5,3),canvas=hit.closest('.page-preview')?.querySelector('canvas'),paper=paperGeometry(canvas),dx=num(place.offsetX,0)/paper.pw*paper.canvasWidth,dy=num(place.offsetY,0)/paper.ph*paper.canvasHeight,w=baseW*scale,h=baseH*scale;
    return{left:(width-w)/2+dx,top:(height-h)/2+dy,width:w,height:h};
  }
  function ensureDirectFrame(hit,page){
    let frame=hit.querySelector(':scope > .pdf-direct-page-frame');
    if(!frame){
      frame=document.createElement('div');frame.className='pdf-direct-page-frame';
      ['tl','tr','bl','br'].forEach(c=>{const n=document.createElement('span');n.className='pdf-direct-scale-corner';n.dataset.corner=c;n.title='드래그하여 확대/축소';frame.appendChild(n);});
      ['left','top','right','bottom'].forEach(e=>{const n=document.createElement('span');n.className='pdf-direct-crop-edge';n.dataset.edge=e;n.title='드래그한 만큼 잘라내기';frame.appendChild(n);});
      const badge=document.createElement('span');badge.className='pdf-direct-edit-badge';badge.textContent='모서리 크기 · 변 잘라내기';frame.appendChild(badge);hit.appendChild(frame);
    }
    const r=frameRectForHit(page,hit);frame.style.left=`${r.left}px`;frame.style.top=`${r.top}px`;frame.style.width=`${r.width}px`;frame.style.height=`${r.height}px`;frame.dataset.pageId=String(page.id);return frame;
  }
  function decorate(){decorateFrame=0;document.querySelectorAll('.pdf-nup-adjust-hit').forEach(hit=>{const page=pageById(hit.dataset.pageId);if(page)ensureDirectFrame(hit,page);});syncEraseUi();root.dataset.pdfDirectPageEdit='1';}
  function queueDecorate(){if(!decorateFrame)decorateFrame=requestAnimationFrame(decorate);}

  function sourcePatchForVisualEdge(page,edge,visualValue){
    const value=transformValues(page),sourceEdge=transformApi()?.sourceEdgeForVisual?.(value.rotation,edge)||edge,key={left:'cropLeft',top:'cropTop',right:'cropRight',bottom:'cropBottom'}[sourceEdge];return key?{[key]:clamp(visualValue,0,.90)}:{};
  }
  function beginFrameGesture(event,target){
    if(event.button!==0)return false;
    const hit=target.closest('.pdf-nup-adjust-hit'),page=pageById(hit?.dataset?.pageId),frame=target.closest('.pdf-direct-page-frame');if(!hit||!page||!frame)return false;
    event.preventDefault();event.stopImmediatePropagation();event.stopPropagation();selectedPageId=String(page.id);try{placementApi()?.selectPage?.(page);}catch(_){}directUndoArmed=false;directUndo=[];directRedo=[];
    const rect=frame.getBoundingClientRect();gesture=target.classList.contains('pdf-direct-scale-corner')?{type:'scale',pointerId:event.pointerId,page,frame,corner:target.dataset.corner,startX:event.clientX,startY:event.clientY,start:placementValues(page),rect}:{type:'crop',pointerId:event.pointerId,page,frame,edge:target.dataset.edge,startX:event.clientX,startY:event.clientY,startCrop:visualCrop(page),rect};try{target.setPointerCapture?.(event.pointerId);}catch(_){}return true;
  }
  function cornerScaleFactor(corner,dx,dy,width,height){const sx=String(corner).includes('l')?-1:1,sy=String(corner).includes('t')?-1:1,projected=dx*sx+dy*sy,denom=Math.max(100,(Math.abs(width)+Math.abs(height))*.36);return Math.exp(projected/denom);}
  function moveFrameGesture(event){
    const s=gesture;if(!s||event.pointerId!==s.pointerId||!['scale','crop'].includes(s.type))return false;event.preventDefault();event.stopImmediatePropagation();event.stopPropagation();const dx=event.clientX-s.startX,dy=event.clientY-s.startY;
    if(s.type==='scale'){
      placementApi()?.setValues?.(s.page,{scale:s.start.scale*cornerScaleFactor(s.corner,dx,dy,s.rect.width,s.rect.height)});const r=frameRectForHit(s.page,s.frame.closest('.pdf-nup-adjust-hit'));s.frame.style.left=`${r.left}px`;s.frame.style.top=`${r.top}px`;s.frame.style.width=`${r.width}px`;s.frame.style.height=`${r.height}px`;
    }else{
      const edge=s.edge,c=s.startCrop,vw=Math.max(.001,1-num(c.left)-num(c.right)),vh=Math.max(.001,1-num(c.top)-num(c.bottom));let desired=0;
      if(edge==='left')desired=num(c.left)+dx/Math.max(1,s.rect.width)*vw;else if(edge==='right')desired=num(c.right)-dx/Math.max(1,s.rect.width)*vw;else if(edge==='top')desired=num(c.top)+dy/Math.max(1,s.rect.height)*vh;else desired=num(c.bottom)-dy/Math.max(1,s.rect.height)*vh;
      transformApi()?.setValues?.(s.page,sourcePatchForVisualEdge(s.page,edge,desired));
      const left=edge==='left'?dx:0,right=edge==='right'?-dx:0,top=edge==='top'?dy:0,bottom=edge==='bottom'?-dy:0,parentRect=s.frame.offsetParent?.getBoundingClientRect?.()||{left:0,top:0};s.frame.style.left=`${s.rect.left-parentRect.left+left}px`;s.frame.style.top=`${s.rect.top-parentRect.top+top}px`;s.frame.style.width=`${Math.max(12,s.rect.width-left-right)}px`;s.frame.style.height=`${Math.max(12,s.rect.height-top-bottom)}px`;
    }return true;
  }
  function endFrameGesture(event){const s=gesture;if(!s||event.pointerId!==s.pointerId||!['scale','crop'].includes(s.type))return false;event.preventDefault();event.stopImmediatePropagation();event.stopPropagation();gesture=null;requestPreview();setTimeout(queueDecorate,0);return true;}

  function overlayRelativePoint(event,overlay){const rect=overlay.getBoundingClientRect();return{x:clamp((event.clientX-rect.left)/Math.max(1,rect.width),0,1),y:clamp((event.clientY-rect.top)/Math.max(1,rect.height),0,1),rect};}
  function paintEraseSelection(selection){const box=byId('pdfDragCropSelectionV1');if(!box)return;const r=normalizeRect(selection);box.style.left=`${r.x0*100}%`;box.style.top=`${r.y0*100}%`;box.style.width=`${(r.x1-r.x0)*100}%`;box.style.height=`${(r.y1-r.y0)*100}%`;box.dataset.visible='true';}
  function hideEraseSelection(){const box=byId('pdfDragCropSelectionV1');if(box)box.dataset.visible='false';}
  function eraseToolActive(){try{return!!window.PdfDragCropAutoFit?.isActive?.();}catch(_){return false;}}
  function beginEraseGesture(event,overlay){if(event.button!==0||!eraseToolActive())return false;const page=selectedPage();if(!page)return false;event.preventDefault();event.stopImmediatePropagation();event.stopPropagation();const p=overlayRelativePoint(event,overlay);gesture={type:'erase',pointerId:event.pointerId,page,overlay,startX:p.x,startY:p.y,rect:p.rect};paintEraseSelection({x0:p.x,y0:p.y,x1:p.x,y1:p.y});try{overlay.setPointerCapture?.(event.pointerId);}catch(_){}return true;}
  function moveEraseGesture(event){const s=gesture;if(!s||s.type!=='erase'||event.pointerId!==s.pointerId)return false;event.preventDefault();event.stopImmediatePropagation();event.stopPropagation();const p=overlayRelativePoint(event,s.overlay);paintEraseSelection({x0:s.startX,y0:s.startY,x1:p.x,y1:p.y});return true;}
  function paintEraseOnOverlay(selection){const canvas=byId('pdfDragCropCanvasV1');if(!canvas)return;const r=normalizeRect(selection),ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(r.x0*canvas.width,r.y0*canvas.height,(r.x1-r.x0)*canvas.width,(r.y1-r.y0)*canvas.height);}
  function endEraseGesture(event){
    const s=gesture;if(!s||s.type!=='erase'||event.pointerId!==s.pointerId)return false;event.preventDefault();event.stopImmediatePropagation();event.stopPropagation();const p=overlayRelativePoint(event,s.overlay),selection=normalizeRect({x0:s.startX,y0:s.startY,x1:p.x,y1:p.y});gesture=null;hideEraseSelection();
    if(selection.x1-selection.x0<MIN_ERASE_SIZE||selection.y1-selection.y0<MIN_ERASE_SIZE){syncEraseUi('지울 영역이 너무 작습니다. 조금 더 크게 드래그하세요.');return true;}
    const sourceRect=visibleSelectionToSource(s.page,selection);if(addEraseRegion(s.page,sourceRect)){paintEraseOnOverlay(selection);requestPreview();syncEraseUi('선택한 부분을 지웠습니다. 계속 다른 곳도 드래그할 수 있습니다.');try{document.dispatchEvent(new CustomEvent('pdf-drag-erase-applied',{detail:{pageId:String(s.page.id),sourceRect}}));}catch(_){}}return true;
  }

  function ensureEraseResetButton(){const row=byId('pdfDragCropAutoFitControlsV1');if(!row)return;let button=byId('pdfDragEraseResetV2');if(!button){button=document.createElement('button');button.type='button';button.id='pdfDragEraseResetV2';button.textContent='지운 영역 되돌리기';row.appendChild(button);button.addEventListener('click',()=>clearEraseRegions(selectedPage()));}}
  function syncEraseUi(message){
    const button=byId('pdfDragCropAutoFitV1'),status=byId('pdfDragCropAutoFitStatusV1'),hint=byId('pdfDragCropHintV1'),page=selectedPage(),active=eraseToolActive();ensureEraseResetButton();
    if(button){button.textContent=active?'지우기 종료 · 여러 곳 연속 가능':'🧽 지저분한 곳 지우기';button.title='문서의 먼지, 얼룩, 불필요한 표시를 사각형으로 드래그해 흰색으로 지웁니다.';}
    if(status)status.textContent=message||(active?'지울 부분을 사각형으로 드래그하세요. 여러 곳 연속으로 지울 수 있습니다. · Esc 종료':(page?'드래그한 사각형만 흰색으로 지웁니다. 최종 PDF에도 반영됩니다.':'먼저 미리보기에서 페이지를 선택하세요.'));
    if(hint)hint.textContent='지울 부분을 드래그 · 여러 곳 연속 가능';const reset=byId('pdfDragEraseResetV2');if(reset){const count=eraseRegionsForPage(page).length;reset.disabled=!page||!count;reset.textContent=count?`지운 영역 되돌리기 (${count})`:'지운 영역 되돌리기';}root.dataset.pdfDirectEraseActive=String(active);
  }

  function wrapPrecisionHistory(){
    if(historyWrapped)return;const history=window.PdfPrecisionEditTools?.history;if(!history||typeof history.undo!=='function'||typeof history.redo!=='function')return;const originalUndo=history.undo.bind(history),originalRedo=history.redo.bind(history);
    history.undo=function(){if(directUndoArmed&&directUndo.length)return undoErase();return originalUndo();};history.redo=function(){if(directRedo.length)return redoErase();return originalRedo();};historyWrapped=true;
  }

  function installEvents(){
    if(root.dataset.pdfDirectPageEditEvents==='1')return;root.dataset.pdfDirectPageEditEvents='1';
    document.addEventListener('pointerdown',event=>{
      const corner=event.target?.closest?.('.pdf-direct-scale-corner');if(corner){beginFrameGesture(event,corner);return;}const edge=event.target?.closest?.('.pdf-direct-crop-edge');if(edge){beginFrameGesture(event,edge);return;}const eraseOverlay=event.target?.closest?.('#pdfDragCropOverlayV1');if(eraseOverlay&&eraseToolActive()){beginEraseGesture(event,eraseOverlay);return;}
      if(event.target?.closest?.('.pdf-nup-adjust-hit,.pdf-free-rotate-handle,#pdfPageTransformControlsV1')){directUndoArmed=false;directUndo=[];directRedo=[];}
    },true);
    document.addEventListener('pointermove',event=>{if(gesture?.type==='erase')moveEraseGesture(event);else moveFrameGesture(event);},true);document.addEventListener('pointerup',event=>{if(gesture?.type==='erase')endEraseGesture(event);else endFrameGesture(event);},true);document.addEventListener('pointercancel',event=>{if(gesture&&event.pointerId===gesture.pointerId){event.preventDefault();event.stopImmediatePropagation();gesture=null;hideEraseSelection();queueDecorate();}},true);
    document.addEventListener('click',event=>{const hit=event.target?.closest?.('.pdf-nup-adjust-hit');if(hit?.dataset?.pageId){selectedPageId=String(hit.dataset.pageId);setTimeout(()=>{queueDecorate();syncEraseUi();},0);}if(event.target?.id==='pdfDragCropAutoFitV1')setTimeout(syncEraseUi,0);},true);
    document.addEventListener('pdf-import-committed',()=>{directUndo=[];directRedo=[];directUndoArmed=false;setTimeout(()=>{queueDecorate();syncEraseUi();},0);});window.addEventListener('resize',queueDecorate,{passive:true});byId('previewScroll')?.addEventListener('scroll',queueDecorate,{passive:true});
  }
  function installObserver(){const area=byId('previewScroll');if(!area||observer||typeof MutationObserver!=='function')return;observer=new MutationObserver(()=>queueDecorate());observer.observe(area,{childList:true,subtree:true,attributes:true,attributeFilter:['data-selected','data-output-index']});}
  function install(){root.dataset.pdfDirectPageEdit='1';installStyles();installEvents();installObserver();installGetPageSrcWrapper();installRequestWrappers();installSessionBridge();wrapPrecisionHistory();queueDecorate();syncEraseUi();}

  window.PdfDirectPageEdit={eraseRegionsForPage,setEraseRegions,addEraseRegion,clearEraseRegions,sourceRectToVisual,visualRectToSource,visibleSelectionToSource,sourceRectToVisible,paintErasesOnSource,enrichSettings,cornerScaleFactor,frameRectForHit,refresh:()=>{queueDecorate();syncEraseUi();},stage:'advanced-direct-scale-edge-crop-whiteout-v2'};

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();for(const delay of INSTALL_DELAYS)setTimeout(install,delay);setInterval(()=>{wrapPrecisionHistory();syncEraseUi();},1800);
})();
