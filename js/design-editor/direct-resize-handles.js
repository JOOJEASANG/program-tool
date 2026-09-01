// Direct canvas resize handles for the shared design editor.
(function(){
  'use strict';
  if(window.__designEditorDirectResizeHandlesV1)return;
  window.__designEditorDirectResizeHandlesV1=true;
  if(new URLSearchParams(location.search).get('embed')!=='1')return;

  const STYLE_ID='designDirectResizeHandlesStylesV1';
  const DRAFT_KEY='programTool.designEditor.draft.v1';
  const HANDLE_CLASS='design-direct-resize-handle';
  const HANDLE_DIRS=['nw','n','ne','e','se','s','sw','w'];
  let resize=null;
  let observer=null;
  let syncFrame=0;

  const byId=id=>document.getElementById(id);
  const project=()=>window.DesignEditorApp?.project||null;
  const surface=()=>{
    const p=project();
    return p?.surfaces?.find(item=>item.id===p.activeSurface)||p?.surfaces?.[0]||null;
  };
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const round=value=>Math.round((Number(value)||0)*10)/10;

  function ppm(){
    const p=project(),board=byId('artboard');
    if(!p||!board)return 1;
    return Math.max(.001,board.getBoundingClientRect().width/Math.max(1,Number(p.width)+(Number(p.bleed)||0)*2));
  }

  function selectedRecord(){
    const current=surface();
    if(!current)return null;
    const extraNode=document.querySelector('#artboard .phase2-extra-object.selected');
    if(extraNode){
      const item=current.extras?.find(entry=>entry.id===extraNode.dataset.extraId);
      if(item)return{kind:item.type==='image'?'image':'shape',item,node:extraNode};
    }
    const textNode=document.querySelector('#artboard .design-text.selected');
    if(textNode){
      const item=current.elements?.find(entry=>entry.id===textNode.dataset.id&&entry.type==='text');
      if(item)return{kind:'text',item,node:textNode};
    }
    return null;
  }

  function installStyles(){
    if(byId(STYLE_ID))return;
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      .design-direct-resize-owner{overflow:visible!important}
      .${HANDLE_CLASS}{position:absolute!important;z-index:150!important;width:11px!important;height:11px!important;min-width:11px!important;min-height:11px!important;padding:0!important;border:2px solid #fff!important;border-radius:2px!important;background:#1769e0!important;box-shadow:0 0 0 1px #1769e0!important;touch-action:none!important;user-select:none!important}
      .${HANDLE_CLASS}[data-resize-dir="nw"]{left:0;top:0;transform:translate(-50%,-50%);cursor:nwse-resize!important}
      .${HANDLE_CLASS}[data-resize-dir="n"]{left:50%;top:0;transform:translate(-50%,-50%);cursor:ns-resize!important}
      .${HANDLE_CLASS}[data-resize-dir="ne"]{right:0;top:0;transform:translate(50%,-50%);cursor:nesw-resize!important}
      .${HANDLE_CLASS}[data-resize-dir="e"]{right:0;top:50%;transform:translate(50%,-50%);cursor:ew-resize!important}
      .${HANDLE_CLASS}[data-resize-dir="se"]{right:0;bottom:0;transform:translate(50%,50%);cursor:nwse-resize!important}
      .${HANDLE_CLASS}[data-resize-dir="s"]{left:50%;bottom:0;transform:translate(-50%,50%);cursor:ns-resize!important}
      .${HANDLE_CLASS}[data-resize-dir="sw"]{left:0;bottom:0;transform:translate(-50%,50%);cursor:nesw-resize!important}
      .${HANDLE_CLASS}[data-resize-dir="w"]{left:0;top:50%;transform:translate(-50%,-50%);cursor:ew-resize!important}
      .design-direct-resize-readout{position:absolute;z-index:151;left:50%;bottom:-27px;transform:translateX(-50%);padding:4px 7px;border-radius:6px;background:#12396d;color:#fff;font:850 7px/1 Pretendard,"Malgun Gothic",sans-serif;white-space:nowrap;pointer-events:none;box-shadow:0 2px 7px rgba(15,39,72,.18)}
      .design-direct-resizing{cursor:grabbing!important}
      @media(pointer:coarse){.${HANDLE_CLASS}{width:15px!important;height:15px!important;min-width:15px!important;min-height:15px!important}}
    `;
    document.head.appendChild(style);
  }

  function removeHandles(except=null){
    document.querySelectorAll(`.${HANDLE_CLASS}`).forEach(node=>{
      if(except&&node.parentElement===except)return;
      node.remove();
    });
    document.querySelectorAll('.design-direct-resize-readout').forEach(node=>node.remove());
    document.querySelectorAll('.design-direct-resize-owner').forEach(node=>{
      if(node!==except)node.classList.remove('design-direct-resize-owner');
    });
  }

  function allowedDirs(record){
    if(record.kind==='text')return['w','e'];
    if(record.kind==='shape'&&record.item.shape==='line')return['w','e'];
    return HANDLE_DIRS;
  }

  function handleTitle(record,dir){
    const corner=dir.length===2;
    if(record.kind==='image'&&corner)return'드래그해 크기 조절 · 이미지 모서리는 비율 유지';
    if(record.kind==='shape'&&corner)return'드래그해 크기 조절 · Shift를 누르면 비율 유지';
    if(record.kind==='text')return'드래그해 글상자 폭 조절';
    return'드래그해 크기 조절';
  }

  function ensureHandles(){
    if(resize)return true;
    const record=selectedRecord();
    if(!record||record.item.locked||record.node.querySelector('.editable-text.editing')){
      removeHandles();
      return false;
    }
    removeHandles(record.node);
    record.node.classList.add('design-direct-resize-owner');
    const wanted=allowedDirs(record);
    wanted.forEach(dir=>{
      if(record.node.querySelector(`.${HANDLE_CLASS}[data-resize-dir="${dir}"]`))return;
      const handle=document.createElement('button');
      handle.type='button';
      handle.className=HANDLE_CLASS;
      handle.dataset.resizeDir=dir;
      handle.title=handleTitle(record,dir);
      handle.setAttribute('aria-label',handle.title);
      handle.addEventListener('pointerdown',event=>beginResize(event,dir));
      handle.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();});
      handle.addEventListener('dblclick',event=>{event.preventDefault();event.stopPropagation();});
      record.node.appendChild(handle);
    });
    return true;
  }

  function beginResize(event,dir){
    if(event.button!==0)return;
    const record=selectedRecord(),p=project();
    if(!record||!p||record.item.locked)return;
    const scale=ppm();
    const visualH=record.kind==='text'?Math.max(1,record.node.offsetHeight/scale):Math.max(.5,Number(record.item.h)||1);
    const width=Math.max(1,Number(record.item.w)||1);
    resize={
      record,dir,pointerId:event.pointerId,startClientX:event.clientX,startClientY:event.clientY,
      x:Number(record.item.x)||0,y:Number(record.item.y)||0,w:width,h:visualH,
      rotation:Number(record.item.rotation)||0,aspect:width/Math.max(.001,visualH),scale
    };
    window.__designDirectResizeActive=true;
    record.node.classList.add('design-direct-resizing');
    try{event.currentTarget.setPointerCapture(event.pointerId);}catch(_){}
    event.preventDefault();
    event.stopPropagation();
  }

  function constrainedSize(state,dx,dy,event){
    const p=project(),dir=state.dir;
    const horizontal=dir.includes('e')||dir.includes('w');
    const vertical=dir.includes('n')||dir.includes('s');
    const sx=dir.includes('e')?1:dir.includes('w')?-1:0;
    const sy=dir.includes('s')?1:dir.includes('n')?-1:0;
    const minW=state.record.kind==='text'?20:state.record.kind==='shape'&&state.record.item.shape==='line'?2:4;
    const minH=(state.record.kind==='shape'&&state.record.item.shape==='line') ? 0.5 : 4;
    let nextW=horizontal?state.w+sx*dx:state.w;
    let nextH=vertical?state.h+sy*dy:state.h;
    nextW=Math.max(minW,nextW);
    nextH=Math.max(minH,nextH);
    const corner=horizontal&&vertical;
    const ratioLock=corner&&(state.record.kind==='image'||(state.record.kind==='shape'&&event.shiftKey));
    if(ratioLock){
      const dw=Math.abs(nextW-state.w)/Math.max(1,state.w);
      const dh=Math.abs(nextH-state.h)/Math.max(1,state.h);
      if(dw>=dh)nextH=Math.max(minH,nextW/state.aspect);
      else nextW=Math.max(minW,nextH*state.aspect);
    }
    if(p){
      if(ratioLock){
        if(nextW>p.width){nextW=p.width;nextH=nextW/state.aspect;}
        if(nextH>p.height){nextH=p.height;nextW=nextH*state.aspect;}
      }else{
        nextW=Math.min(nextW,p.width);
        if(state.record.kind!=='text')nextH=Math.min(nextH,p.height);
      }
    }
    return{w:nextW,h:state.record.kind==='text'?state.h:nextH,sx,sy,horizontal,vertical};
  }

  function applyGeometry(state,size){
    const p=project(),item=state.record.item,node=state.record.node;
    if(!p||!item||!node)return;
    const angle=state.rotation*Math.PI/180;
    const dw=size.w-state.w,dh=size.h-state.h;
    const localShiftX=size.horizontal?size.sx*dw/2:0;
    const localShiftY=size.vertical?size.sy*dh/2:0;
    const shiftX=localShiftX*Math.cos(angle)-localShiftY*Math.sin(angle);
    const shiftY=localShiftX*Math.sin(angle)+localShiftY*Math.cos(angle);
    const startCx=state.x+state.w/2,startCy=state.y+state.h/2;
    const nextCx=startCx+shiftX,nextCy=startCy+shiftY;
    let x=nextCx-size.w/2,y=nextCy-size.h/2;
    x=clamp(x,0,Math.max(0,p.width-size.w));
    y=clamp(y,0,Math.max(0,p.height-size.h));
    item.x=x;item.y=y;item.w=size.w;
    if(state.record.kind!=='text')item.h=size.h;
    const scale=state.scale,bleed=Number(p.bleed)||0;
    node.style.left=`${(bleed+x)*scale}px`;
    node.style.top=`${(bleed+y)*scale}px`;
    node.style.width=`${size.w*scale}px`;
    if(state.record.kind!=='text')node.style.height=`${size.h*scale}px`;
    updateReadout(state.record,size);
    updateHiddenFields(state.record);
  }

  function updateReadout(record,size){
    let label=record.node.querySelector('.design-direct-resize-readout');
    if(!label){label=document.createElement('span');label.className='design-direct-resize-readout';record.node.appendChild(label);}
    label.textContent=record.kind==='text'?`${round(size.w)} mm`:`${round(size.w)} × ${round(size.h)} mm`;
  }

  function updateHiddenFields(record){
    if(record.kind==='text'){
      const width=byId('widthInput');if(width)width.value=String(round(record.item.w));
      return;
    }
    const root=byId('inspector');
    if(!root)return;
    ['x','y','w','h'].forEach(field=>{
      const input=root.querySelector(`[data-extra-field="${field}"]`);
      if(input)input.value=String(round(record.item[field]));
    });
  }

  function onPointerMove(event){
    if(!resize)return;
    const state=resize;
    const scale=Math.max(.001,state.scale);
    const screenDx=(event.clientX-state.startClientX)/scale;
    const screenDy=(event.clientY-state.startClientY)/scale;
    const angle=state.rotation*Math.PI/180;
    const dx=screenDx*Math.cos(angle)+screenDy*Math.sin(angle);
    const dy=-screenDx*Math.sin(angle)+screenDy*Math.cos(angle);
    applyGeometry(state,constrainedSize(state,dx,dy,event));
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  function persist(record){
    const p=project();if(!p)return;
    try{localStorage.setItem(DRAFT_KEY,JSON.stringify(p));}catch(_){}
    window.DesignEditorDraftScope?.saveCurrent?.('direct-resize');
    const save=byId('saveState');if(save)save.textContent='자동 저장됨';
    try{window.dispatchEvent(new CustomEvent('programstudio:design-resize',{detail:{kind:record.kind,id:record.item.id,w:record.item.w,h:record.item.h??null}}));}catch(_){}
  }

  function finishResize(event){
    if(!resize)return;
    if(event?.pointerId!=null&&resize.pointerId!=null&&event.pointerId!==resize.pointerId)return;
    const record=resize.record;
    record.node.classList.remove('design-direct-resizing');
    record.node.querySelector('.design-direct-resize-readout')?.remove();
    resize=null;
    window.__designDirectResizeActive=false;
    persist(record);
    if(record.kind!=='text')window.DesignEditorPhase2?.sync?.();
    window.DesignEditorSelectionContextbar?.sync?.();
    window.DesignEditorRotation?.sync?.();
    queueSync();
  }

  function sync(){
    if(resize)return true;
    if(!project()||byId('editorShell')?.classList.contains('hidden')){removeHandles();return false;}
    return ensureHandles();
  }

  function queueSync(){
    if(syncFrame)return;
    syncFrame=requestAnimationFrame(()=>{syncFrame=0;sync();});
  }

  function boot(){
    installStyles();
    const board=byId('artboard');
    if(board&&typeof MutationObserver==='function'){
      observer=new MutationObserver(queueSync);
      observer.observe(board,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
    }
    document.addEventListener('pointermove',onPointerMove,{capture:true,passive:false});
    document.addEventListener('pointerup',finishResize,true);
    document.addEventListener('pointercancel',finishResize,true);
    ['click','dblclick','pointerup','change','input'].forEach(name=>document.addEventListener(name,queueSync,false));
    window.addEventListener('resize',queueSync,{passive:true});
    window.addEventListener('designeditor:viewport-change',queueSync,{passive:true});
    [100,240,500,900,1500,2600].forEach(delay=>setTimeout(queueSync,delay));
  }

  window.DesignEditorDirectResize={sync,stage:'direct-canvas-resize-handles-v1'};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
