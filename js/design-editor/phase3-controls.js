(function(){
  'use strict';
  if(window.__designEditorPhase3ControlsV1)return;
  window.__designEditorPhase3ControlsV1=true;
  if(new URLSearchParams(location.search).get('embed')!=='1')return;

  const DRAFT_KEY='programTool.designEditor.draft.v1';
  const CARD_ID='designPhase3LayoutTools';
  const STYLE_ID='designPhase3Styles';
  const MAX_HISTORY=32;
  let installed=false;
  let resizeDrag=null;
  let history=[];
  let historyIndex=-1;
  let lastSnapshot='';
  let captureTimer=0;
  let applyingHistory=false;
  let uiTimer=0;

  const byId=id=>document.getElementById(id);
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const project=()=>window.DesignEditorApp?.project||null;
  const activeSurface=()=>{
    const p=project();
    return p?.surfaces?.find(item=>item.id===p.activeSurface)||p?.surfaces?.[0]||null;
  };

  function setStatus(message,type='info'){
    const node=byId('editorStatus');if(!node)return;
    node.className=`editor-status ${type}`;node.textContent=message;
  }

  function ppm(){
    const p=project(),board=byId('artboard');
    if(!p||!board)return 1;
    return Math.max(.001,board.getBoundingClientRect().width/Math.max(1,p.width+(Number(p.bleed)||0)*2));
  }

  function selectedRecord(){
    const p=project(),surface=activeSurface();if(!p||!surface)return null;
    const extraNode=document.querySelector('.phase2-extra-object.selected');
    if(extraNode){
      const item=surface.extras?.find(entry=>entry.id===extraNode.dataset.extraId);
      if(item)return{kind:'extra',item,node:extraNode,surface};
    }
    const textNode=document.querySelector('.design-text.selected');
    if(textNode){
      const item=surface.elements?.find(entry=>entry.id===textNode.dataset.id&&entry.type==='text');
      if(item)return{kind:'text',item,node:textNode,surface};
    }
    return null;
  }

  function elementHeightMm(record){
    if(!record)return 8;
    if(record.kind==='extra')return Math.max(.5,Number(record.item.h)||.5);
    return Math.max(4,record.node.getBoundingClientRect().height/ppm());
  }

  function positionSelectedDom(record){
    const p=project();if(!record||!p)return;
    const scale=ppm(),bleed=Number(p.bleed)||0,item=record.item,node=record.node;
    node.style.left=`${(bleed+Number(item.x||0))*scale}px`;
    node.style.top=`${(bleed+Number(item.y||0))*scale}px`;
    node.style.width=`${Math.max(.5,Number(item.w)||.5)*scale}px`;
    if(record.kind==='extra')node.style.height=`${Math.max(.5,Number(item.h)||.5)*scale}px`;
    else if(Number(item.size))node.style.fontSize=`${Number(item.size)*(25.4/72)*scale}px`;
  }

  function persist(){
    try{
      const p=project();if(!p)return;
      localStorage.setItem(DRAFT_KEY,JSON.stringify(p));
      const state=byId('saveState');if(state)state.textContent='자동 저장됨';
    }catch(_){setStatus('현재 작업을 브라우저에 저장하지 못했습니다.','err');}
  }

  function captureSnapshot(){
    if(applyingHistory)return;
    const p=project();if(!p)return;
    let serialized='';
    try{serialized=JSON.stringify(p);}catch(_){return;}
    if(!serialized||serialized===lastSnapshot)return;
    if(historyIndex<history.length-1)history=history.slice(0,historyIndex+1);
    history.push(serialized);
    const limit=serialized.length>1800000?8:MAX_HISTORY;
    while(history.length>limit)history.shift();
    historyIndex=history.length-1;lastSnapshot=serialized;updateHistoryButtons();
  }

  function queueCapture(){
    clearTimeout(captureTimer);
    captureTimer=setTimeout(captureSnapshot,220);
  }

  function applyHistory(nextIndex){
    if(nextIndex<0||nextIndex>=history.length||nextIndex===historyIndex)return;
    const snapshot=history[nextIndex];
    try{
      applyingHistory=true;
      localStorage.setItem(DRAFT_KEY,snapshot);
      historyIndex=nextIndex;lastSnapshot=snapshot;
      window.DesignEditorApp?.resumeDraft?.();
      setTimeout(()=>{
        window.DesignEditorPhase2?.sync?.();
        applyingHistory=false;syncUi();updateHistoryButtons();
      },80);
    }catch(_){applyingHistory=false;setStatus('실행 취소 기록을 복원하지 못했습니다.','err');}
  }

  function undo(){applyHistory(historyIndex-1);}
  function redo(){applyHistory(historyIndex+1);}

  function updateHistoryButtons(){
    const undoBtn=byId('phase3Undo'),redoBtn=byId('phase3Redo');
    if(undoBtn)undoBtn.disabled=historyIndex<=0;
    if(redoBtn)redoBtn.disabled=historyIndex<0||historyIndex>=history.length-1;
  }

  function alignSelected(direction){
    const record=selectedRecord(),p=project();if(!record||!p)return setStatus('정렬할 요소를 먼저 선택하세요.','info');
    if(record.item.locked)return setStatus('잠긴 요소는 이동할 수 없습니다.','info');
    const item=record.item,safe=clamp(Number(p.safe)||0,0,Math.min(p.width,p.height)/2);
    const height=elementHeightMm(record),width=Math.max(.5,Number(item.w)||.5);
    if(direction==='left')item.x=safe;
    if(direction==='center')item.x=(p.width-width)/2;
    if(direction==='right')item.x=Math.max(0,p.width-safe-width);
    if(direction==='top')item.y=safe;
    if(direction==='middle')item.y=(p.height-height)/2;
    if(direction==='bottom')item.y=Math.max(0,p.height-safe-height);
    item.x=clamp(Number(item.x)||0,0,Math.max(0,p.width-width));
    item.y=clamp(Number(item.y)||0,0,Math.max(0,p.height-height));
    positionSelectedDom(record);window.DesignEditorPhase2?.sync?.();persist();queueCapture();queueUi();
  }

  function nudgeSelected(dx,dy){
    const record=selectedRecord(),p=project();if(!record||!p||record.item.locked)return false;
    const item=record.item,width=Math.max(.5,Number(item.w)||.5),height=elementHeightMm(record);
    item.x=clamp((Number(item.x)||0)+dx,0,Math.max(0,p.width-width));
    item.y=clamp((Number(item.y)||0)+dy,0,Math.max(0,p.height-height));
    positionSelectedDom(record);window.DesignEditorPhase2?.sync?.();persist();queueCapture();queueUi();return true;
  }

  function installStyles(){
    if(byId(STYLE_ID))return;
    const style=document.createElement('style');style.id=STYLE_ID;style.textContent=`
      .phase3-card-note{font-size:8px;color:#64748b;line-height:1.5;margin:0 0 8px}.phase3-align-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:5px}.phase3-align-grid button,.phase3-history button{border:1px solid #d7e0e9;border-radius:8px;background:#fff;color:#475569;padding:7px 3px;font-size:8px;font-weight:900;cursor:pointer}.phase3-align-grid button:hover,.phase3-history button:hover:not(:disabled){border-color:#79b9c8;background:#f0fdff}.phase3-history{display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-top:7px}.phase3-history button:disabled{opacity:.42;cursor:not-allowed}.phase3-selection{font-size:7px;font-weight:900;color:#0e7490;background:#ecfeff;border-radius:999px;padding:4px 7px;display:inline-block;margin-bottom:7px}.phase3-resize-handle{position:absolute!important;z-index:120!important;right:-7px!important;bottom:-7px!important;width:13px!important;height:13px!important;min-width:13px!important;min-height:13px!important;padding:0!important;border:2px solid #fff!important;border-radius:3px!important;background:#0284c7!important;box-shadow:0 0 0 1px #0369a1!important;cursor:nwse-resize!important;touch-action:none!important}.design-object.selected,.phase2-extra-object.selected{overflow:visible!important}
    `;document.head.appendChild(style);
  }

  function installCard(){
    if(byId(CARD_ID))return true;
    const sidebar=document.querySelector('.sidebar'),layers=byId('layerList')?.closest('.side-card');if(!sidebar)return false;
    const card=document.createElement('section');card.id=CARD_ID;card.className='side-card';
    card.innerHTML=`<div class="side-label">빠른 배치</div><div id="phase3Selection" class="phase3-selection">요소를 선택하세요</div><p class="phase3-card-note">안전여백 기준으로 정렬합니다. 방향키는 0.5mm, Shift+방향키는 5mm씩 이동합니다.</p><div class="phase3-align-grid"><button type="button" data-phase3-align="left">왼쪽</button><button type="button" data-phase3-align="center">가운데</button><button type="button" data-phase3-align="right">오른쪽</button><button type="button" data-phase3-align="top">위</button><button type="button" data-phase3-align="middle">중앙</button><button type="button" data-phase3-align="bottom">아래</button></div><div class="phase3-history"><button id="phase3Undo" type="button">↶ 실행취소</button><button id="phase3Redo" type="button">↷ 다시실행</button></div>`;
    if(layers)sidebar.insertBefore(card,layers);else sidebar.appendChild(card);
    card.querySelectorAll('[data-phase3-align]').forEach(button=>button.addEventListener('click',()=>alignSelected(button.dataset.phase3Align)));
    byId('phase3Undo').addEventListener('click',undo);byId('phase3Redo').addEventListener('click',redo);updateHistoryButtons();return true;
  }

  function beginResize(event,record){
    if(!record||record.item.locked)return;
    const item=record.item,rect=record.node.getBoundingClientRect();
    resizeDrag={record,startX:event.clientX,startY:event.clientY,w:Number(item.w)||10,h:record.kind==='extra'?(Number(item.h)||10):elementHeightMm(record),size:Number(item.size)||11,rectHeight:Math.max(1,rect.height)};
    try{event.currentTarget.setPointerCapture(event.pointerId);}catch(_){}
    event.preventDefault();event.stopPropagation();
  }

  function handleResizeMove(event){
    if(!resizeDrag)return;
    const {record}=resizeDrag,item=record.item,p=project();if(!p)return;
    const scale=ppm(),dx=(event.clientX-resizeDrag.startX)/scale,dy=(event.clientY-resizeDrag.startY)/scale;
    if(record.kind==='text'){
      const factor=clamp((resizeDrag.w+dx)/Math.max(1,resizeDrag.w),.3,4);
      item.w=clamp(resizeDrag.w*factor,20,p.width);
      item.size=clamp(resizeDrag.size*factor,6,120);
    }else{
      let nextW=clamp(resizeDrag.w+dx,1,p.width),nextH=clamp(resizeDrag.h+dy,.5,p.height);
      if((item.type==='image'||event.shiftKey)&&!event.altKey){
        const ratio=resizeDrag.w/Math.max(.5,resizeDrag.h);
        if(Math.abs(dx)>=Math.abs(dy)){nextH=nextW/ratio;}else{nextW=nextH*ratio;}
      }
      item.w=clamp(nextW,1,p.width);item.h=clamp(nextH,.5,p.height);
    }
    item.x=clamp(Number(item.x)||0,0,Math.max(0,p.width-item.w));
    item.y=clamp(Number(item.y)||0,0,Math.max(0,p.height-elementHeightMm(record)));
    positionSelectedDom(record);event.preventDefault();
  }

  function finishResize(){
    if(!resizeDrag)return;
    resizeDrag=null;window.DesignEditorPhase2?.sync?.();persist();queueCapture();queueUi();
  }

  function syncResizeHandle(){
    document.querySelectorAll('.phase3-resize-handle').forEach(node=>node.remove());
    const record=selectedRecord();if(!record||record.item.locked)return;
    const handle=document.createElement('button');handle.type='button';handle.className='phase3-resize-handle';handle.title=record.kind==='text'?'드래그해서 글씨와 글상자 크기 조절':'드래그해서 크기 조절';
    handle.addEventListener('pointerdown',event=>beginResize(event,record));record.node.appendChild(handle);
  }

  function updateSelectionLabel(){
    const label=byId('phase3Selection');if(!label)return;
    const record=selectedRecord();
    if(!record){label.textContent='요소를 선택하세요';return;}
    if(record.kind==='text')label.textContent='글씨 선택됨';
    else if(record.item.type==='image')label.textContent='이미지 선택됨';
    else label.textContent='도형 선택됨';
  }

  function syncUi(){
    if(!project()||byId('editorShell')?.classList.contains('hidden'))return;
    installCard();syncResizeHandle();updateSelectionLabel();updateHistoryButtons();
  }

  function queueUi(){
    clearTimeout(uiTimer);uiTimer=setTimeout(()=>requestAnimationFrame(syncUi),30);
  }

  function bindEvents(){
    document.addEventListener('pointermove',handleResizeMove,{passive:false});
    document.addEventListener('pointerup',finishResize);document.addEventListener('pointercancel',finishResize);
    ['click','dblclick','input','change','pointerup'].forEach(name=>document.addEventListener(name,()=>{queueUi();queueCapture();},false));
    window.addEventListener('resize',queueUi,{passive:true});
    document.addEventListener('keydown',event=>{
      const tag=String(event.target?.tagName||'').toUpperCase();const typing=['INPUT','TEXTAREA','SELECT'].includes(tag)||event.target?.isContentEditable;
      if((event.ctrlKey||event.metaKey)&&!event.shiftKey&&event.key.toLowerCase()==='z'&&!typing){event.preventDefault();event.stopImmediatePropagation();undo();return;}
      if(((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='y'||(event.ctrlKey||event.metaKey)&&event.shiftKey&&event.key.toLowerCase()==='z')&&!typing){event.preventDefault();event.stopImmediatePropagation();redo();return;}
      if(typing||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;
      const step=event.shiftKey?5:.5;
      const dx=event.key==='ArrowLeft'?-step:event.key==='ArrowRight'?step:0;
      const dy=event.key==='ArrowUp'?-step:event.key==='ArrowDown'?step:0;
      if(nudgeSelected(dx,dy)){event.preventDefault();event.stopImmediatePropagation();}
    },true);
  }

  function install(){
    if(installed)return true;
    if(!document.querySelector('.sidebar')||!byId('artboard')||!window.DesignEditorApp)return false;
    installed=true;installStyles();installCard();bindEvents();
    [120,350,800,1400].forEach(delay=>setTimeout(()=>{captureSnapshot();queueUi();},delay));
    window.DesignEditorPhase3Controls={undo,redo,alignSelected,stage:'lightweight-layout-resize-history-controls'};
    return true;
  }

  function boot(){if(install())return;[180,420,800,1300,2200,3200].forEach(delay=>setTimeout(install,delay));}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
