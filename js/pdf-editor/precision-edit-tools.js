// Precision PDF editing bridge: live margin guides, local Ctrl+Z history,
// and free-angle per-page rotation without disturbing canonical crop geometry.
(function(){
  'use strict';
  if(window.__pdfPrecisionEditToolsV1)return;
  window.__pdfPrecisionEditToolsV1=true;

  const smokeHost=document.documentElement.dataset.pdfPrecisionEditToolsHost==='1';
  if(!location.pathname.includes('pdf-editor')&&!smokeHost)return;

  const INSTALL_DELAYS=[0,120,300,650,1100,1800,3000,5000];
  const HISTORY_LIMIT=50;
  const byId=id=>document.getElementById(id);
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const number=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
  const rotatedCache=new WeakMap();
  const undoStack=[];
  const redoStack=[];
  const EDIT_INPUT_IDS=new Set([
    'pdfNupAdjustScaleRange','pdfNupAdjustScale','pdfNupAdjustX','pdfNupAdjustY',
    'pdfPageCropLeftV1','pdfPageCropTopV1','pdfPageCropRightV1','pdfPageCropBottomV1',
    'pdfFineRotationDegV1',
  ]);
  const ACTION_BUTTON_IDS=new Set([
    'pdfPageRotateLeftV1','pdfPageRotateRightV1','pdfPageCropResetV1',
    'pdfNupAdjustReset','pdfFineRotationResetV1',
  ]);
  const MARGIN_INPUT_IDS=new Set([
    'marginLeft','marginRight','marginTop','marginBottom','marginH','marginV',
    'pnMarginMm','pnFontSize','pnEnabled','pnAutoReserve','pnApplyTo','pnExcludeFirst','facingPages',
  ]);

  let pendingHistory=null;
  let selectedPageId='';
  let rotationGesture=null;
  let getPageSrcWrapper=null;
  let drawPageWrapper=null;
  let apiWrapper=null;
  let fetchWrapper=null;
  let collectWrapper=null;
  let loadWrapper=null;
  let previewObserver=null;
  let renderFrame=0;
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

  function normalizeFine(value){
    let angle=number(value,0);
    angle=((angle+180)%360+360)%360-180;
    if(Math.abs(angle)<.0005)angle=0;
    return Math.round(angle*10)/10;
  }

  function fineForPage(page){
    return normalizeFine(page?.fineRotationDeg??page?.fine_rotation_deg??0);
  }

  function setFine(page,value,lock=true){
    if(!page)return 0;
    const angle=normalizeFine(value);
    page.fineRotationDeg=angle;
    page.fine_rotation_deg=angle;
    if(lock&&Math.abs(angle)>.0001){
      page.pageRotationLocked=true;
      page.rotationLocked=true;
    }
    return angle;
  }

  function transformValues(page){
    try{return window.PdfPageTransformEdit?.valuesForPage?.(page)||{};}catch(_){return{};}
  }

  function placementValues(page){
    try{return window.PdfNupPageAdjust?.valuesForPage?.(page)||{};}catch(_){return{};}
  }

  function capturePage(page){
    if(!page)return null;
    const transform=transformValues(page);
    const placement=placementValues(page);
    return{
      id:String(page.id),
      rotation:number(transform.rotation??page.rotation,0),
      rotationLocked:!!(transform.rotationLocked??page.pageRotationLocked??page.rotationLocked),
      cropLeft:number(transform.cropLeft??page.cropLeftRatio,0),
      cropTop:number(transform.cropTop??page.cropTopRatio,0),
      cropRight:number(transform.cropRight??page.cropRightRatio,0),
      cropBottom:number(transform.cropBottom??page.cropBottomRatio,0),
      scale:number(placement.scale??page.nupScale,1),
      offsetX:number(placement.offsetX??page.nupOffsetX,0),
      offsetY:number(placement.offsetY??page.nupOffsetY,0),
      fineRotation:fineForPage(page),
    };
  }

  function stateEqual(a,b){
    if(!a||!b)return false;
    const keys=['rotation','rotationLocked','cropLeft','cropTop','cropRight','cropBottom','scale','offsetX','offsetY','fineRotation'];
    return keys.every(key=>typeof a[key]==='boolean'?a[key]===b[key]:Math.abs(number(a[key])-number(b[key]))<.0001);
  }

  function beginHistory(page,label,source='pointer'){
    if(!page)return false;
    if(pendingHistory){
      if(pendingHistory.pageId===String(page.id))return true;
      commitHistory();
    }
    pendingHistory={pageId:String(page.id),label:String(label||'페이지 편집'),source,before:capturePage(page)};
    return true;
  }

  function commitHistory(){
    const pending=pendingHistory;
    pendingHistory=null;
    if(!pending)return false;
    const page=pageById(pending.pageId);
    const after=capturePage(page);
    if(!page||stateEqual(pending.before,after))return false;
    undoStack.push({...pending,after});
    while(undoStack.length>HISTORY_LIMIT)undoStack.shift();
    redoStack.length=0;
    updateUndoMarker();
    return true;
  }

  function cancelHistory(){pendingHistory=null;}

  function clearHistory(){
    pendingHistory=null;
    undoStack.length=0;
    redoStack.length=0;
    updateUndoMarker();
  }

  function restoreState(state){
    const page=pageById(state?.id);
    if(!page)return false;
    try{
      if(typeof window.PdfPageTransformEdit?.setValues==='function'){
        window.PdfPageTransformEdit.setValues(page,{
          rotation:state.rotation,
          rotationLocked:state.rotationLocked,
          cropLeft:state.cropLeft,
          cropTop:state.cropTop,
          cropRight:state.cropRight,
          cropBottom:state.cropBottom,
        });
      }else{
        page.rotation=state.rotation;
        page.cropLeftRatio=state.cropLeft;
        page.cropTopRatio=state.cropTop;
        page.cropRightRatio=state.cropRight;
        page.cropBottomRatio=state.cropBottom;
      }
      page.pageRotationLocked=!!state.rotationLocked;
      page.rotationLocked=!!state.rotationLocked;
      if(typeof window.PdfNupPageAdjust?.setValues==='function'){
        window.PdfNupPageAdjust.setValues(page,{scale:state.scale,offsetX:state.offsetX,offsetY:state.offsetY});
      }else{
        page.nupScale=state.scale;
        page.nupOffsetX=state.offsetX;
        page.nupOffsetY=state.offsetY;
      }
      setFine(page,state.fineRotation,false);
      selectedPageId=String(page.id);
      try{window.PdfNupPageAdjust?.selectPage?.(page);}catch(_){}
      syncFineControls();
      requestPreview();
      queueDecorations();
      return true;
    }catch(error){
      console.warn('[pdf-precision-edit] restore failed',error);
      return false;
    }
  }

  function undo(){
    commitHistory();
    const entry=undoStack.pop();
    if(!entry)return false;
    if(!restoreState(entry.before))return false;
    redoStack.push(entry);
    updateUndoMarker();
    announce(`실행 취소 · ${entry.label}`);
    return true;
  }

  function redo(){
    commitHistory();
    const entry=redoStack.pop();
    if(!entry)return false;
    if(!restoreState(entry.after))return false;
    undoStack.push(entry);
    updateUndoMarker();
    announce(`다시 실행 · ${entry.label}`);
    return true;
  }

  function updateUndoMarker(){
    document.documentElement.dataset.pdfEditUndoCount=String(undoStack.length);
    document.documentElement.dataset.pdfEditRedoCount=String(redoStack.length);
  }

  function announce(message){
    try{
      if(typeof showStatus==='function'){
        showStatus(message,'success');
        if(typeof hideStatus==='function')setTimeout(hideStatus,1000);
      }
    }catch(_){}
  }

  function requestPreview(){
    try{
      if(typeof window.PdfNupPageAdjust?.refresh==='function')window.PdfNupPageAdjust.refresh();
      else if(typeof window.PdfEditorLayoutExport?.refresh==='function')window.PdfEditorLayoutExport.refresh();
      else if(typeof schedulePreview==='function')schedulePreview(0);
      else if(typeof triggerPreview==='function')triggerPreview();
    }catch(error){console.warn('[pdf-precision-edit] preview refresh failed',error);}
  }

  function installStyles(){
    if(byId('pdfPrecisionEditToolsStylesV1'))return;
    const style=document.createElement('style');
    style.id='pdfPrecisionEditToolsStylesV1';
    style.textContent=`
      .pdf-live-margin-guide{position:absolute;z-index:7;box-sizing:border-box;border:1.5px dashed rgba(5,150,105,.92);background:rgba(16,185,129,.018);pointer-events:none;border-radius:2px}
      .pdf-live-margin-guide-label{position:absolute;left:3px;top:3px;max-width:calc(100% - 6px);padding:2px 5px;border-radius:999px;background:rgba(6,95,70,.88);color:#fff;font-size:7.5px;font-weight:850;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;pointer-events:none}
      .pdf-free-rotate-handle{position:absolute;right:-8px;top:-24px;z-index:30;width:18px;height:18px;border:2px solid #fff;border-radius:50%;background:#7c3aed;color:#fff;box-shadow:0 1px 4px rgba(15,23,42,.4);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:900;line-height:1;cursor:grab;pointer-events:auto;touch-action:none;user-select:none}
      .pdf-free-rotate-handle::after{content:'';position:absolute;left:7px;top:16px;width:2px;height:8px;background:#7c3aed;opacity:.8;pointer-events:none}
      .pdf-free-rotate-handle[data-rotating="true"]{cursor:grabbing;background:#5b21b6}
      .pdf-nup-adjust-hit:not([data-selected="true"]) .pdf-free-rotate-handle{display:none}
      .pdf-free-rotation-hint{position:absolute;left:50%;top:-49px;z-index:31;transform:translateX(-50%);padding:3px 7px;border-radius:999px;background:rgba(91,33,182,.94);color:#fff;font-size:8px;font-weight:900;white-space:nowrap;pointer-events:none}
      .pdf-fine-rotation-row{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:5px;margin-top:6px;padding-top:6px;border-top:1px dashed #e2e8f0}
      .pdf-fine-rotation-row label{color:#64748b;font-size:8px;font-weight:850;white-space:nowrap}
      .pdf-fine-rotation-row input{width:100%;padding:5px 4px!important;text-align:center;font-size:9px!important;font-weight:850}
      .pdf-fine-rotation-row button{border:1px solid #c4b5fd;border-radius:6px;background:#f5f3ff;color:#6d28d9;padding:5px 7px;font:inherit;font-size:8px;font-weight:900;cursor:pointer}
      .pdf-fine-rotation-help{grid-column:1/-1;color:#64748b;font-size:7.5px;font-weight:700;line-height:1.35;text-align:center}
    `;
    document.head.appendChild(style);
  }

  function paperSize(){
    try{
      const settings=typeof getSettings==='function'?getSettings():{};
      const pw=number(settings?.pw,210);
      const ph=number(settings?.ph,297);
      return{pw:pw>0?pw:210,ph:ph>0?ph:297};
    }catch(_){return{pw:210,ph:297};}
  }

  function marginForOutput(index){
    try{
      const value=window.PdfEditorLayoutExport?.layoutMargins?.(index);
      if(value)return{
        left:number(value.left,10),right:number(value.right,10),
        top:number(value.top,10),bottom:number(value.bottom,10),
      };
    }catch(_){}
    const h=number(byId('marginH')?.value,10);
    const v=number(byId('marginV')?.value,10);
    return{
      left:number(byId('marginLeft')?.value,h),right:number(byId('marginRight')?.value,h),
      top:number(byId('marginTop')?.value,v),bottom:number(byId('marginBottom')?.value,v),
    };
  }

  function renderMarginGuides(){
    renderFrame=0;
    const {pw,ph}=paperSize();
    const wraps=[...document.querySelectorAll('#previewScroll .page-preview')];
    wraps.forEach((wrap,domIndex)=>{
      const canvas=wrap.querySelector('canvas');
      if(!canvas||!canvas.offsetWidth||!canvas.offsetHeight)return;
      const outputIndex=Number.isFinite(Number(wrap.dataset.outputIndex))?Number(wrap.dataset.outputIndex):domIndex;
      const margin=marginForOutput(outputIndex);
      const leftPx=clamp(margin.left/pw,0,.49)*canvas.offsetWidth;
      const rightPx=clamp(margin.right/pw,0,.49)*canvas.offsetWidth;
      const topPx=clamp(margin.top/ph,0,.49)*canvas.offsetHeight;
      const bottomPx=clamp(margin.bottom/ph,0,.49)*canvas.offsetHeight;
      let guide=wrap.querySelector(':scope > .pdf-live-margin-guide');
      if(!guide){
        guide=document.createElement('div');
        guide.className='pdf-live-margin-guide';
        const label=document.createElement('span');
        label.className='pdf-live-margin-guide-label';
        guide.appendChild(label);
        wrap.appendChild(guide);
      }
      guide.style.left=`${canvas.offsetLeft+leftPx}px`;
      guide.style.top=`${canvas.offsetTop+topPx}px`;
      guide.style.width=`${Math.max(1,canvas.offsetWidth-leftPx-rightPx)}px`;
      guide.style.height=`${Math.max(1,canvas.offsetHeight-topPx-bottomPx)}px`;
      guide.dataset.outputIndex=String(outputIndex);
      guide.dataset.marginLeft=String(margin.left);
      guide.dataset.marginRight=String(margin.right);
      guide.dataset.marginTop=String(margin.top);
      guide.dataset.marginBottom=String(margin.bottom);
      const label=guide.querySelector('.pdf-live-margin-guide-label');
      if(label)label.textContent=`여백 L ${margin.left.toFixed(1)} · R ${margin.right.toFixed(1)} · T ${margin.top.toFixed(1)} · B ${margin.bottom.toFixed(1)} mm`;
    });
    document.documentElement.dataset.pdfLiveMarginGuide='1';
  }

  function queueDecorations(){
    if(renderFrame)return;
    renderFrame=requestAnimationFrame(()=>{
      installRotationHandles();
      renderMarginGuides();
      syncFineControls();
    });
  }

  function installRotationHandles(){
    document.querySelectorAll('.pdf-nup-adjust-hit').forEach(hit=>{
      if(hit.querySelector(':scope > .pdf-free-rotate-handle'))return;
      const handle=document.createElement('span');
      handle.className='pdf-free-rotate-handle';
      handle.setAttribute('role','button');
      handle.setAttribute('aria-label','선택 페이지 미세 회전');
      handle.title='마우스로 끌어 미세 회전';
      handle.textContent='↻';
      hit.appendChild(handle);
    });
  }

  function ensureFineControls(){
    installStyles();
    const block=byId('pdfPageTransformControlsV1');
    if(!block)return false;
    let row=byId('pdfFineRotationControlsV1');
    if(!row){
      row=document.createElement('div');
      row.id='pdfFineRotationControlsV1';
      row.className='pdf-fine-rotation-row';
      row.innerHTML=`<label for="pdfFineRotationDegV1">미세 회전 °</label><input id="pdfFineRotationDegV1" type="number" min="-180" max="180" step="0.1" value="0"><button type="button" id="pdfFineRotationResetV1">0°</button><div class="pdf-fine-rotation-help">선택 페이지 모서리의 보라색 ↻ 핸들을 끌면 0.1° 단위로 자유 회전합니다. · Ctrl+Z 실행 취소</div>`;
      block.appendChild(row);
      byId('pdfFineRotationDegV1')?.addEventListener('input',event=>{
        const page=selectedPage();
        if(!page)return;
        setFine(page,event.target.value,true);
        syncFineControls();
      });
      byId('pdfFineRotationDegV1')?.addEventListener('change',()=>requestPreview());
      byId('pdfFineRotationResetV1')?.addEventListener('click',()=>{
        const page=selectedPage();
        if(!page)return;
        setFine(page,0,false);
        syncFineControls();
        requestPreview();
      });
    }
    syncFineControls();
    return true;
  }

  function syncFineControls(){
    const page=selectedPage();
    const input=byId('pdfFineRotationDegV1');
    const reset=byId('pdfFineRotationResetV1');
    if(input){
      input.disabled=!page;
      if(!input.matches(':focus'))input.value=fineForPage(page).toFixed(1);
    }
    if(reset)reset.disabled=!page||Math.abs(fineForPage(page))<.0001;
  }

  function markSourceFine(page,src){
    if(!src?.dataset)return src;
    src.dataset.pdfFineRotationDeg=String(fineForPage(page));
    src.dataset.pdfFineRotationPageId=page?.id==null?'':String(page.id);
    return src;
  }

  function installGetPageSrcWrapper(){
    const current=window.getPageSrc;
    if(typeof current!=='function')return false;
    if(current===getPageSrcWrapper)return true;
    if(current.__pdfPrecisionFineSourceV1){getPageSrcWrapper=current;return true;}
    const original=current;
    const wrapped=function precisionFineSource(page){
      const src=original.apply(this,arguments);
      return markSourceFine(page,src);
    };
    wrapped.__pdfPrecisionFineSourceV1=true;
    wrapped.__pdfPrecisionFineSourceOriginal=original;
    window.getPageSrc=wrapped;
    try{getPageSrc=wrapped;}catch(_){}
    getPageSrcWrapper=wrapped;
    return true;
  }

  function rotateCanvas(src,angle){
    if(!src||!src.width||!src.height)return src;
    const fine=normalizeFine(angle);
    if(Math.abs(fine)<.0001)return src;
    let map=rotatedCache.get(src);
    if(!map){map=new Map();rotatedCache.set(src,map);}
    const key=fine.toFixed(1);
    if(map.has(key))return map.get(key);
    const radians=fine*Math.PI/180;
    const cosine=Math.abs(Math.cos(radians));
    const sine=Math.abs(Math.sin(radians));
    const out=document.createElement('canvas');
    out.width=Math.max(1,Math.ceil(src.width*cosine+src.height*sine));
    out.height=Math.max(1,Math.ceil(src.width*sine+src.height*cosine));
    const ctx=out.getContext('2d');
    ctx.save();
    ctx.translate(out.width/2,out.height/2);
    ctx.rotate(radians);
    ctx.drawImage(src,-src.width/2,-src.height/2);
    ctx.restore();
    out.dataset.pdfManualRotation='1';
    out.dataset.pdfFineRotationApplied='1';
    out.dataset.pdfFineRotationDeg='0';
    map.set(key,out);
    while(map.size>10)map.delete(map.keys().next().value);
    return out;
  }

  function installDrawPageWrapper(){
    const current=window.drawPageInCell;
    if(typeof current!=='function')return false;
    if(current===drawPageWrapper)return true;
    if(current.__pdfPrecisionFineDrawV1){drawPageWrapper=current;return true;}
    const original=current;
    const wrapped=function precisionFineDraw(ctx,src,cellX,cellY,cellW,cellH){
      const fine=normalizeFine(src?.dataset?.pdfFineRotationDeg||0);
      if(Math.abs(fine)<.0001)return original.apply(this,arguments);
      const rotated=rotateCanvas(src,fine);
      return original.call(this,ctx,rotated,cellX,cellY,cellW,cellH);
    };
    wrapped.__pdfPrecisionFineDrawV1=true;
    wrapped.__pdfPrecisionFineDrawOriginal=original;
    window.drawPageInCell=wrapped;
    try{drawPageInCell=wrapped;}catch(_){}
    drawPageWrapper=wrapped;
    return true;
  }

  function enrichSettings(settings){
    if(!settings||typeof settings!=='object'||!Array.isArray(settings.pages))return settings;
    const source=pages();
    settings.pages=settings.pages.map((entry,index)=>({...entry,fine_rotation_deg:fineForPage(source[index])}));
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

  function installRequestWrappers(){
    const api=window.apiProcessPdf;
    if(typeof api==='function'&&api!==apiWrapper&&!api.__pdfPrecisionFineRequestV1){
      const original=api;
      const wrapped=function precisionFineApi(files,settings,options){return original.call(this,files,enrichSettings(settings),options);};
      wrapped.__pdfPrecisionFineRequestV1=true;
      if(original.__pdfNupPageAdjustWrappedV1)wrapped.__pdfNupPageAdjustWrappedV1=true;
      window.apiProcessPdf=wrapped;
      try{apiProcessPdf=wrapped;}catch(_){}
      apiWrapper=wrapped;
    }else if(api?.__pdfPrecisionFineRequestV1)apiWrapper=api;

    const currentFetch=window.fetch;
    if(typeof currentFetch==='function'&&currentFetch!==fetchWrapper&&!currentFetch.__pdfPrecisionFineRequestV1){
      const original=currentFetch.bind(window);
      const wrapped=function precisionFineFetch(input,init){
        try{
          const path=endpointPath(input);
          if(path==='/api/pdf/process'&&init?.body instanceof FormData){
            const raw=init.body.get('settings');
            if(raw)init.body.set('settings',JSON.stringify(enrichSettings(JSON.parse(raw))));
          }else if(path==='/api/pdf/process-storage'&&init&&typeof init.body==='string'){
            const body=JSON.parse(init.body);
            if(body?.settings){body.settings=enrichSettings(body.settings);init.body=JSON.stringify(body);}
          }
        }catch(error){console.warn('[pdf-precision-edit] request enrichment failed',error);}
        return original(input,init);
      };
      wrapped.__pdfPrecisionFineRequestV1=true;
      window.fetch=wrapped;
      fetchWrapper=wrapped;
    }else if(currentFetch?.__pdfPrecisionFineRequestV1)fetchWrapper=currentFetch;
  }

  function installSessionBridge(){
    const collect=window.collectEditorState;
    const load=window.loadEditorSession;
    if(typeof collect==='function'&&collect!==collectWrapper&&!collect.__pdfPrecisionFineStateV1){
      const original=collect;
      const wrapped=function precisionFineCollect(){
        const state=original.apply(this,arguments)||{};
        state.pageFineRotations=pages().map(page=>fineForPage(page));
        return state;
      };
      wrapped.__pdfPrecisionFineStateV1=true;
      window.collectEditorState=wrapped;
      try{collectEditorState=wrapped;}catch(_){}
      collectWrapper=wrapped;
    }else if(collect?.__pdfPrecisionFineStateV1)collectWrapper=collect;

    if(typeof load==='function'&&load!==loadWrapper&&!load.__pdfPrecisionFineStateV1){
      const original=load;
      const wrapped=async function precisionFineLoad(data){
        const result=await original.apply(this,arguments);
        try{
          const state=typeof data?.state==='string'?JSON.parse(data.state):(data?.state||{});
          const saved=Array.isArray(state.pageFineRotations)?state.pageFineRotations:[];
          pages().forEach((page,index)=>{if(saved[index]!=null)setFine(page,saved[index],Math.abs(number(saved[index],0))>.0001);});
        }catch(error){console.warn('[pdf-precision-edit] fine rotation restore failed',error);}
        clearHistory();
        syncFineControls();
        requestPreview();
        return result;
      };
      wrapped.__pdfPrecisionFineStateV1=true;
      window.loadEditorSession=wrapped;
      try{loadEditorSession=wrapped;}catch(_){}
      loadWrapper=wrapped;
    }else if(load?.__pdfPrecisionFineStateV1)loadWrapper=load;
  }

  function cloneCanvas(source){
    const copy=document.createElement('canvas');
    copy.width=Math.max(1,source?.width||1);
    copy.height=Math.max(1,source?.height||1);
    copy.getContext('2d')?.drawImage(source,0,0);
    return copy;
  }

  function cellPixels(hit,canvas){
    const canvasRect=canvas.getBoundingClientRect();
    const hitRect=hit.getBoundingClientRect();
    const sx=canvasRect.width>0?canvas.width/canvasRect.width:1;
    const sy=canvasRect.height>0?canvas.height/canvasRect.height:1;
    const x=(hitRect.left-canvasRect.left)*sx;
    const y=(hitRect.top-canvasRect.top)*sy;
    return{x,y,width:Math.max(1,hitRect.width*sx),height:Math.max(1,hitRect.height*sy)};
  }

  function cropCell(base,rect){
    const cell=document.createElement('canvas');
    cell.width=Math.max(1,Math.round(rect.width));
    cell.height=Math.max(1,Math.round(rect.height));
    const ctx=cell.getContext('2d');
    ctx.fillStyle='#fff';ctx.fillRect(0,0,cell.width,cell.height);
    ctx.drawImage(base,rect.x,rect.y,rect.width,rect.height,0,0,cell.width,cell.height);
    return cell;
  }

  function pointerAngle(event,cx,cy){return Math.atan2(event.clientY-cy,event.clientX-cx)*180/Math.PI;}
  function angleDelta(current,start){return((current-start+180)%360+360)%360-180;}

  function renderRotationLive(state,nextFine){
    const canvas=state.canvas;
    if(!canvas?.isConnected)return;
    const ctx=canvas.getContext('2d');
    const delta=(nextFine-state.startFine)*Math.PI/180;
    ctx.save();
    ctx.setTransform(1,0,0,1,0,0);
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.drawImage(state.base,0,0);
    ctx.beginPath();ctx.rect(state.cell.x,state.cell.y,state.cell.width,state.cell.height);ctx.clip();
    ctx.fillStyle='#fff';ctx.fillRect(state.cell.x,state.cell.y,state.cell.width,state.cell.height);
    ctx.translate(state.cell.x+state.cell.width/2,state.cell.y+state.cell.height/2);
    ctx.rotate(delta);
    ctx.drawImage(state.cellImage,-state.cell.width/2,-state.cell.height/2,state.cell.width,state.cell.height);
    ctx.restore();
  }

  function updateRotationHint(state,angle){
    state.handle.dataset.rotating='true';
    let hint=state.hit.querySelector(':scope > .pdf-free-rotation-hint');
    if(!hint){hint=document.createElement('span');hint.className='pdf-free-rotation-hint';state.hit.appendChild(hint);}
    hint.textContent=`${angle>=0?'+':''}${angle.toFixed(1)}°`;
  }

  function beginFreeRotation(event,handle){
    if(event.button!==0)return;
    const hit=handle.closest('.pdf-nup-adjust-hit');
    const page=pageById(hit?.dataset?.pageId);
    const canvas=hit?.closest('.page-preview')?.querySelector('canvas');
    if(!hit||!page||!canvas?.width||!canvas?.height)return;
    event.preventDefault();event.stopImmediatePropagation();event.stopPropagation();
    selectedPageId=String(page.id);
    const rect=hit.getBoundingClientRect();
    const cx=rect.left+rect.width/2;
    const cy=rect.top+rect.height/2;
    const base=cloneCanvas(canvas);
    const cell=cellPixels(hit,canvas);
    beginHistory(page,'미세 회전','free-rotate');
    rotationGesture={
      pointerId:event.pointerId,page,hit,handle,canvas,base,cell,cellImage:cropCell(base,cell),
      cx,cy,startPointer:pointerAngle(event,cx,cy),startFine:fineForPage(page),lastFine:fineForPage(page),
    };
    updateRotationHint(rotationGesture,rotationGesture.startFine);
    try{handle.setPointerCapture?.(event.pointerId);}catch(_){}
  }

  function moveFreeRotation(event){
    const state=rotationGesture;
    if(!state||event.pointerId!==state.pointerId)return false;
    event.preventDefault();event.stopImmediatePropagation();event.stopPropagation();
    const delta=angleDelta(pointerAngle(event,state.cx,state.cy),state.startPointer);
    const next=setFine(state.page,state.startFine+delta,true);
    state.lastFine=next;
    renderRotationLive(state,next);
    updateRotationHint(state,next);
    syncFineControls();
    return true;
  }

  function finishFreeRotation(event,cancelled=false){
    const state=rotationGesture;
    if(!state||event.pointerId!==state.pointerId)return false;
    event.preventDefault();event.stopImmediatePropagation();event.stopPropagation();
    try{state.handle.releasePointerCapture?.(event.pointerId);}catch(_){}
    state.handle.removeAttribute('data-rotating');
    state.hit.querySelector(':scope > .pdf-free-rotation-hint')?.remove();
    rotationGesture=null;
    if(cancelled){
      setFine(state.page,state.startFine,false);
      cancelHistory();
      const ctx=state.canvas.getContext('2d');
      ctx.clearRect(0,0,state.canvas.width,state.canvas.height);ctx.drawImage(state.base,0,0);
    }else commitHistory();
    syncFineControls();
    requestPreview();
    queueDecorations();
    return true;
  }

  function editPageForTarget(target){
    const hit=target?.closest?.('.pdf-nup-adjust-hit');
    if(hit?.dataset?.pageId)return pageById(hit.dataset.pageId);
    return selectedPage();
  }

  function labelForTarget(target){
    if(target?.closest?.('#pdfDragCropOverlayV1,#pdfPageCropOverlayV1'))return'영역 자르기';
    if(target?.closest?.('.pdf-nup-adjust-handle'))return'페이지 크기 조절';
    if(target?.closest?.('.pdf-nup-adjust-hit'))return'페이지 위치 이동';
    const id=target?.id||'';
    if(id==='pdfPageRotateLeftV1'||id==='pdfPageRotateRightV1')return'90° 회전';
    if(id==='pdfPageCropResetV1')return'자르기 초기화';
    if(id==='pdfNupAdjustReset')return'페이지 보정 초기화';
    if(id==='pdfFineRotationResetV1'||id==='pdfFineRotationDegV1')return'미세 회전';
    if(id.startsWith('pdfPageCrop'))return'자르기 수치 조정';
    if(id.startsWith('pdfNupAdjust'))return'페이지 위치·크기 조정';
    return'페이지 편집';
  }

  function isTypingTarget(target){
    if(!target)return false;
    if(EDIT_INPUT_IDS.has(target.id))return false;
    return target.isContentEditable||target.tagName==='TEXTAREA'||(target.tagName==='INPUT'&&!['checkbox','radio','range','button'].includes(target.type));
  }

  function installEvents(){
    if(eventsInstalled)return;
    eventsInstalled=true;

    window.addEventListener('pointerdown',event=>{
      const rotateHandle=event.target?.closest?.('.pdf-free-rotate-handle');
      if(rotateHandle){beginFreeRotation(event,rotateHandle);return;}
      const target=event.target;
      const track=target?.closest?.('#pdfDragCropOverlayV1,#pdfPageCropOverlayV1,.pdf-nup-adjust-hit')||ACTION_BUTTON_IDS.has(target?.id)||EDIT_INPUT_IDS.has(target?.id);
      if(!track)return;
      const page=editPageForTarget(target);
      if(page)beginHistory(page,labelForTarget(target),'pointer');
    },true);

    window.addEventListener('pointermove',event=>{if(rotationGesture)moveFreeRotation(event);},true);
    window.addEventListener('pointerup',event=>{
      if(rotationGesture&&finishFreeRotation(event,false))return;
      if(pendingHistory?.source==='pointer')setTimeout(commitHistory,0);
    },true);
    window.addEventListener('pointercancel',event=>{
      if(rotationGesture&&finishFreeRotation(event,true))return;
      if(pendingHistory?.source==='pointer')setTimeout(commitHistory,0);
    },true);

    document.addEventListener('focusin',event=>{
      if(!EDIT_INPUT_IDS.has(event.target?.id))return;
      const page=editPageForTarget(event.target);
      if(page)beginHistory(page,labelForTarget(event.target),'focus');
    },true);
    document.addEventListener('focusout',event=>{if(EDIT_INPUT_IDS.has(event.target?.id))setTimeout(commitHistory,0);},true);
    document.addEventListener('change',event=>{if(EDIT_INPUT_IDS.has(event.target?.id))setTimeout(commitHistory,0);},true);

    document.addEventListener('click',event=>{
      const target=event.target;
      if(target?.closest?.('.page-productivity-actions button')){
        clearHistory();
        return;
      }
      if(ACTION_BUTTON_IDS.has(target?.id)&&!pendingHistory){
        const page=editPageForTarget(target);
        if(page){beginHistory(page,labelForTarget(target),'click');setTimeout(commitHistory,0);}
      }
      if(target?.closest?.('.pdf-nup-adjust-hit'))setTimeout(()=>{syncFineControls();queueDecorations();},0);
      if(target?.closest?.('.pn-pos-btn'))queueDecorations();
    },true);

    document.addEventListener('input',event=>{
      if(MARGIN_INPUT_IDS.has(event.target?.id))queueDecorations();
    },true);
    document.addEventListener('change',event=>{
      if(MARGIN_INPUT_IDS.has(event.target?.id))queueDecorations();
    },true);

    window.addEventListener('keydown',event=>{
      if(!(event.ctrlKey||event.metaKey)||event.altKey)return;
      const key=String(event.key||'').toLowerCase();
      if(key==='z'){
        if(isTypingTarget(event.target))return;
        const handled=event.shiftKey?redo():undo();
        if(handled){event.preventDefault();event.stopImmediatePropagation();event.stopPropagation();}
      }else if(key==='y'){
        if(isTypingTarget(event.target))return;
        if(redo()){event.preventDefault();event.stopImmediatePropagation();event.stopPropagation();}
      }
    },true);

    window.addEventListener('resize',queueDecorations,{passive:true});
    document.addEventListener('pdf-import-committed',()=>{clearHistory();setTimeout(queueDecorations,0);});
    document.addEventListener('pdf-drag-crop-autofit-applied',()=>setTimeout(()=>{commitHistory();queueDecorations();},0));
  }

  function installObserver(){
    const scroll=byId('previewScroll');
    if(!scroll)return false;
    if(previewObserver)return true;
    previewObserver=new MutationObserver(()=>queueDecorations());
    previewObserver.observe(scroll,{childList:true,subtree:true,attributes:true,attributeFilter:['data-selected','data-output-index']});
    return true;
  }

  function install(){
    installStyles();
    ensureFineControls();
    installGetPageSrcWrapper();
    installDrawPageWrapper();
    installRequestWrappers();
    installSessionBridge();
    installEvents();
    installObserver();
    queueDecorations();
  }

  window.PdfPrecisionEditTools={
    fineForPage,
    setFine,
    rotateCanvas,
    enrichSettings,
    renderMarginGuides,
    history:{
      begin:beginHistory,commit:commitHistory,cancel:cancelHistory,undo,redo,clear:clearHistory,
      get undoCount(){return undoStack.length;},get redoCount(){return redoStack.length;},
    },
    refresh:queueDecorations,
    stage:'live-margin-undo-free-rotation-v1',
  };

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();
  for(const delay of INSTALL_DELAYS)setTimeout(install,delay);
  setInterval(()=>{installRotationHandles();renderMarginGuides();},1800);
})();
