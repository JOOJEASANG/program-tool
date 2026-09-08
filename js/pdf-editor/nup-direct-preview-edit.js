// Live direct manipulation feedback for per-page N-up adjustments.
(function(){
  'use strict';
  if(window.__pdfNupDirectPreviewEditV1)return;
  window.__pdfNupDirectPreviewEditV1=true;
  if(!location.pathname.includes('pdf-editor'))return;

  let drag=null;
  let styleInstalled=false;

  function pages(){
    try{return Array.isArray(parsedPages)?parsedPages:[];}catch(_){return[];}
  }

  function pageById(id){
    return pages().find(page=>String(page.id)===String(id))||null;
  }

  function values(page){
    try{return window.PdfNupPageAdjust?.valuesForPage?.(page)||{scale:1,offsetX:0,offsetY:0};}
    catch(_){return{scale:1,offsetX:0,offsetY:0};}
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
    }catch(_){return{width:210,height:297};}
  }

  function installStyles(){
    if(styleInstalled||document.getElementById('pdfNupDirectPreviewEditStylesV1'))return;
    styleInstalled=true;
    const style=document.createElement('style');
    style.id='pdfNupDirectPreviewEditStylesV1';
    style.textContent=`
      .pdf-nup-adjust-hit[data-selected="true"]{cursor:grab!important}
      .pdf-nup-adjust-hit[data-direct-editing="true"]{cursor:grabbing!important;box-shadow:0 0 0 3px rgba(37,99,235,.18)!important}
      .pdf-nup-adjust-hit[data-direct-editing="true"] .pdf-nup-adjust-handle{cursor:nwse-resize!important}
      .pdf-nup-direct-edit-hint{position:absolute;left:50%;bottom:4px;z-index:20;transform:translateX(-50%);padding:3px 7px;border-radius:999px;background:rgba(37,99,235,.9);color:#fff;font-size:8px;font-weight:900;white-space:nowrap;pointer-events:none}
    `;
    document.head.appendChild(style);
  }

  function cloneCanvas(source){
    const copy=document.createElement('canvas');
    copy.width=Math.max(1,source.width||1);
    copy.height=Math.max(1,source.height||1);
    copy.getContext('2d',{alpha:false})?.drawImage(source,0,0);
    return copy;
  }

  function cellPixels(hit,canvas){
    const canvasRect=canvas.getBoundingClientRect();
    const hitRect=hit.getBoundingClientRect();
    const sx=canvasRect.width>0?canvas.width/canvasRect.width:1;
    const sy=canvasRect.height>0?canvas.height/canvasRect.height:1;
    const x=Math.max(0,(hitRect.left-canvasRect.left)*sx);
    const y=Math.max(0,(hitRect.top-canvasRect.top)*sy);
    const width=Math.max(1,Math.min(canvas.width-x,hitRect.width*sx));
    const height=Math.max(1,Math.min(canvas.height-y,hitRect.height*sy));
    return{x,y,width,height};
  }

  function cropCell(base,rect){
    const cell=document.createElement('canvas');
    cell.width=Math.max(1,Math.round(rect.width));
    cell.height=Math.max(1,Math.round(rect.height));
    const ctx=cell.getContext('2d',{alpha:false});
    if(ctx){
      ctx.fillStyle='#fff';
      ctx.fillRect(0,0,cell.width,cell.height);
      ctx.drawImage(
        base,
        rect.x,rect.y,rect.width,rect.height,
        0,0,cell.width,cell.height
      );
    }
    return cell;
  }

  function ensureHint(hit,mode){
    hit.querySelector('.pdf-nup-direct-edit-hint')?.remove();
    const hint=document.createElement('span');
    hint.className='pdf-nup-direct-edit-hint';
    hint.textContent=mode==='scale'?'마우스로 크기 조절 중':'마우스로 위치 이동 중';
    hit.appendChild(hint);
  }

  function begin(event){
    if(event.button!==0)return;
    const hit=event.target?.closest?.('.pdf-nup-adjust-hit');
    if(!hit)return;
    const page=pageById(hit.dataset.pageId);
    const canvas=hit.closest('.page-preview')?.querySelector('canvas');
    if(!page||!canvas||!canvas.width||!canvas.height)return;
    const mode=event.target?.closest?.('.pdf-nup-adjust-handle')?'scale':'move';
    const base=cloneCanvas(canvas);
    const cell=cellPixels(hit,canvas);
    drag={
      pointerId:event.pointerId,
      page,
      hit,
      canvas,
      base,
      cell,
      cellImage:cropCell(base,cell),
      start:values(page),
      paper:paperSize(),
      mode,
    };
    hit.dataset.directEditing='true';
    ensureHint(hit,mode);
    document.documentElement.dataset.pdfNupDirectPreviewEdit='1';
  }

  function renderLive(){
    const state=drag;
    if(!state)return;
    const canvas=state.canvas;
    if(!canvas?.isConnected)return;
    const ctx=canvas.getContext('2d',{alpha:false});
    if(!ctx)return;
    const current=values(state.page);
    const startScale=Math.max(.0001,Number(state.start.scale)||1);
    const ratio=Math.max(.05,(Number(current.scale)||1)/startScale);
    const dx=(Number(current.offsetX||0)-Number(state.start.offsetX||0))/Math.max(1,state.paper.width)*canvas.width;
    const dy=(Number(current.offsetY||0)-Number(state.start.offsetY||0))/Math.max(1,state.paper.height)*canvas.height;
    const drawW=state.cell.width*ratio;
    const drawH=state.cell.height*ratio;
    const drawX=state.cell.x+(state.cell.width-drawW)/2+dx;
    const drawY=state.cell.y+(state.cell.height-drawH)/2+dy;

    ctx.save();
    ctx.setTransform(1,0,0,1,0,0);
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.drawImage(state.base,0,0);
    ctx.beginPath();
    ctx.rect(state.cell.x,state.cell.y,state.cell.width,state.cell.height);
    ctx.clip();
    ctx.fillStyle='#fff';
    ctx.fillRect(state.cell.x,state.cell.y,state.cell.width,state.cell.height);
    ctx.drawImage(state.cellImage,drawX,drawY,drawW,drawH);
    ctx.restore();
  }

  function move(event){
    if(!drag||event.pointerId!==drag.pointerId)return;
    // PdfNupPageAdjust's pointer handler updates the model first; this listener
    // then paints the changed page immediately into the visible N-up canvas.
    renderLive();
  }

  function end(event){
    if(!drag||event.pointerId!==drag.pointerId)return;
    renderLive();
    drag.hit?.querySelector('.pdf-nup-direct-edit-hint')?.remove();
    if(drag.hit)delete drag.hit.dataset.directEditing;
    drag=null;
  }

  function install(){
    installStyles();
    if(document.documentElement.dataset.pdfNupDirectPreviewEvents==='1')return;
    document.documentElement.dataset.pdfNupDirectPreviewEvents='1';
    document.addEventListener('pointerdown',begin,true);
    document.addEventListener('pointermove',move,true);
    document.addEventListener('pointerup',end,true);
    document.addEventListener('pointercancel',end,true);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();

  window.PdfNupDirectPreviewEdit={
    renderLive,
    stage:'live-canvas-direct-manipulation-v1'
  };
})();
