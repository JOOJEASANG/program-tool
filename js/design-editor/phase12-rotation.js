(function(){
  'use strict';
  if(window.__designEditorRotationV1)return;
  window.__designEditorRotationV1=true;
  if(new URLSearchParams(location.search).get('embed')!=='1')return;

  const DRAFT_KEY='programTool.designEditor.draft.v1';
  const CARD_ID='designRotationTools';
  const STYLE_ID='designRotationStyles';
  let installed=false;
  let rotateDrag=null;
  let uiTimer=0;

  const byId=id=>document.getElementById(id);
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const normalize=value=>{
    let angle=Number(value)||0;
    while(angle>180)angle-=360;
    while(angle<-180)angle+=360;
    return Math.round(angle*10)/10;
  };
  const project=()=>window.DesignEditorApp?.project||null;
  const surface=()=>{
    const p=project();
    return p?.surfaces?.find(item=>item.id===p.activeSurface)||p?.surfaces?.[0]||null;
  };

  function selectedRecord(){
    const current=surface();if(!current)return null;
    const extraNode=document.querySelector('.phase2-extra-object.selected');
    if(extraNode){
      const item=current.extras?.find(entry=>entry.id===extraNode.dataset.extraId);
      if(item)return{kind:'extra',item,node:extraNode};
    }
    const textNode=document.querySelector('.design-text.selected');
    if(textNode){
      const item=current.elements?.find(entry=>entry.id===textNode.dataset.id&&entry.type==='text');
      if(item)return{kind:'text',item,node:textNode};
    }
    return null;
  }

  function setStatus(message,type='info'){
    const node=byId('editorStatus');if(!node)return;
    node.className=`editor-status ${type}`;node.textContent=message;
  }

  function persist(source='rotation'){
    const p=project();if(!p)return;
    try{localStorage.setItem(DRAFT_KEY,JSON.stringify(p));}catch(_){return setStatus('회전값을 저장하지 못했습니다.','err');}
    window.DesignEditorDraftScope?.saveCurrent?.(source);
    const state=byId('saveState');if(state)state.textContent='자동 저장됨';
  }

  function applyTransform(record){
    if(!record?.node||!record.item)return;
    const angle=normalize(record.item.rotation||0);
    record.item.rotation=angle;
    record.node.style.transformOrigin='50% 50%';
    record.node.style.transform=`rotate(${angle}deg)`;
  }

  function applyAllTransforms(){
    const current=surface();if(!current)return;
    document.querySelectorAll('.design-text[data-id]').forEach(node=>{
      const item=current.elements?.find(entry=>entry.id===node.dataset.id&&entry.type==='text');
      if(item)applyTransform({item,node});
    });
    document.querySelectorAll('.phase2-extra-object[data-extra-id]').forEach(node=>{
      const item=current.extras?.find(entry=>entry.id===node.dataset.extraId);
      if(item)applyTransform({item,node});
    });
  }

  function previewRotation(value){
    const record=selectedRecord();
    if(!record)return null;
    if(record.item.locked)return null;
    record.item.rotation=normalize(value);applyTransform(record);return record;
  }

  function setRotation(value,source='rotation-control'){
    const record=selectedRecord();
    if(!record)return setStatus('회전할 글씨·이미지·도형을 먼저 선택하세요.','info');
    if(record.item.locked)return setStatus('잠긴 요소는 회전할 수 없습니다.','info');
    record.item.rotation=normalize(value);
    applyTransform(record);persist(source);queueUi();
  }

  function beginRotate(event){
    const record=selectedRecord();
    if(!record||record.item.locked)return;
    const rect=record.node.getBoundingClientRect();
    const cx=rect.left+rect.width/2,cy=rect.top+rect.height/2;
    const pointerAngle=Math.atan2(event.clientY-cy,event.clientX-cx)*180/Math.PI;
    rotateDrag={record,cx,cy,startPointer:pointerAngle,startRotation:normalize(record.item.rotation||0)};
    try{event.currentTarget.setPointerCapture(event.pointerId);}catch(_){}
    event.preventDefault();event.stopPropagation();
  }

  function handleRotateMove(event){
    if(!rotateDrag)return;
    const pointer=Math.atan2(event.clientY-rotateDrag.cy,event.clientX-rotateDrag.cx)*180/Math.PI;
    let next=rotateDrag.startRotation+(pointer-rotateDrag.startPointer);
    if(event.shiftKey)next=Math.round(next/15)*15;
    rotateDrag.record.item.rotation=normalize(next);
    applyTransform(rotateDrag.record);syncInput();
    const range=byId('designRotationRange');if(range)range.value=String(rotateDrag.record.item.rotation);
    event.preventDefault();
  }

  function finishRotate(){
    if(!rotateDrag)return;
    rotateDrag=null;persist('rotation-drag');queueUi();
  }

  function syncInput(){
    const input=byId('designRotationInput'),label=byId('designRotationSelection');
    const record=selectedRecord();
    if(!record){
      if(input){input.value='0';input.disabled=true;}
      if(label)label.textContent='요소를 선택하세요';
      return;
    }
    if(input){input.disabled=Boolean(record.item.locked);input.value=String(normalize(record.item.rotation||0));}
    if(label)label.textContent=record.kind==='text'?'글씨 회전':record.item.type==='image'?'이미지 회전':'도형 회전';
  }

  function syncHandle(){
    document.querySelectorAll('.phase12-rotation-handle').forEach(node=>node.remove());
    const record=selectedRecord();if(!record||record.item.locked)return;
    const handle=document.createElement('button');
    handle.type='button';handle.className='phase12-rotation-handle';handle.title='드래그해서 회전 · Shift를 누르면 15° 단위';
    handle.setAttribute('aria-label','선택 요소 회전');
    handle.addEventListener('pointerdown',beginRotate);
    record.node.appendChild(handle);
  }

  function installStyles(){
    if(byId(STYLE_ID))return;
    const style=document.createElement('style');style.id=STYLE_ID;style.textContent=`
      .phase12-rotation-row{display:grid;grid-template-columns:1fr 62px;gap:6px;align-items:center}.phase12-rotation-row input{width:100%;border:1px solid #cfd8e3;border-radius:8px;padding:7px 8px;font-size:9px}.phase12-rotation-buttons{display:grid;grid-template-columns:repeat(3,1fr);gap:5px;margin-top:6px}.phase12-rotation-buttons button{border:1px solid #d7e0e9;border-radius:8px;background:#fff;color:#475569;padding:7px 3px;font-size:8px;font-weight:900;cursor:pointer}.phase12-rotation-buttons button:hover{border-color:#79b9c8;background:#f0fdff}.phase12-rotation-selection{font-size:7px;font-weight:900;color:#0e7490;background:#ecfeff;border-radius:999px;padding:4px 7px;display:inline-block;margin-bottom:7px}.phase12-rotation-note{font-size:7px;line-height:1.45;color:#7c8797;margin-top:6px}.phase12-rotation-handle{position:absolute!important;z-index:130!important;left:50%!important;top:-28px!important;transform:translateX(-50%)!important;width:15px!important;height:15px!important;min-width:15px!important;min-height:15px!important;padding:0!important;border:2px solid #fff!important;border-radius:50%!important;background:#0e7490!important;box-shadow:0 0 0 1px #0f6b7a!important;cursor:grab!important;touch-action:none!important}.phase12-rotation-handle::after{content:'';position:absolute;left:50%;top:13px;width:1px;height:13px;background:#0e7490;transform:translateX(-50%)}.phase12-rotation-handle:active{cursor:grabbing}.design-object.selected,.phase2-extra-object.selected{overflow:visible!important}
    `;document.head.appendChild(style);
  }

  function installCard(){
    if(byId(CARD_ID))return true;
    const sidebar=document.querySelector('.sidebar'),projectFile=byId('designProjectFileTools'),clipboard=byId('designElementClipboardTools'),phase3=byId('designPhase3LayoutTools');
    if(!sidebar)return false;
    const card=document.createElement('section');card.id=CARD_ID;card.className='side-card';
    card.innerHTML=`<div class="side-label">회전</div><div id="designRotationSelection" class="phase12-rotation-selection">요소를 선택하세요</div><div class="phase12-rotation-row"><input id="designRotationRange" type="range" min="-180" max="180" step="1" value="0" aria-label="회전 각도"><input id="designRotationInput" type="number" min="-180" max="180" step="1" value="0" aria-label="회전 각도 숫자 입력"></div><div class="phase12-rotation-buttons"><button type="button" data-rotate="-90">-90°</button><button type="button" data-rotate="0">0°</button><button type="button" data-rotate="90">+90°</button></div><div class="phase12-rotation-note">선택 테두리 위의 회전점을 드래그할 수도 있습니다. Shift를 누르면 15° 단위로 맞춰집니다.</div>`;
    const anchor=projectFile||clipboard||phase3;
    if(anchor?.nextSibling)sidebar.insertBefore(card,anchor.nextSibling);else sidebar.appendChild(card);
    const range=byId('designRotationRange'),input=byId('designRotationInput');
    range?.addEventListener('input',()=>{if(input)input.value=range.value;previewRotation(range.value);});
    range?.addEventListener('change',()=>setRotation(range.value,'rotation-slider'));
    input?.addEventListener('input',()=>{const value=clamp(Number(input.value)||0,-180,180);if(range)range.value=String(value);previewRotation(value);});
    input?.addEventListener('change',()=>setRotation(clamp(Number(input.value)||0,-180,180),'rotation-input'));
    card.querySelectorAll('[data-rotate]').forEach(button=>button.addEventListener('click',()=>{
      const value=Number(button.dataset.rotate)||0;if(range)range.value=String(value);if(input)input.value=String(value);setRotation(value,'rotation-quick');
    }));
    return true;
  }

  function syncUi(){
    if(!project()||byId('editorShell')?.classList.contains('hidden'))return;
    installCard();applyAllTransforms();syncInput();
    const record=selectedRecord(),range=byId('designRotationRange');
    if(range){range.disabled=!record||Boolean(record.item.locked);range.value=String(normalize(record?.item?.rotation||0));}
    syncHandle();
  }

  function queueUi(){clearTimeout(uiTimer);uiTimer=setTimeout(()=>requestAnimationFrame(syncUi),30);}

  function bindEvents(){
    document.addEventListener('pointermove',handleRotateMove,{passive:false});
    document.addEventListener('pointerup',finishRotate);document.addEventListener('pointercancel',finishRotate);
    ['click','dblclick','change','pointerup'].forEach(name=>document.addEventListener(name,queueUi,false));
    window.addEventListener('resize',queueUi,{passive:true});
  }

  function install(){
    if(installed)return true;
    if(!document.querySelector('.sidebar')||!byId('artboard')||!window.DesignEditorApp)return false;
    installed=true;installStyles();installCard();bindEvents();
    [100,260,520,900,1500,2400].forEach(delay=>setTimeout(queueUi,delay));
    window.DesignEditorRotation={setRotation,sync:syncUi,stage:'selected-element-rotation-controls'};
    return true;
  }

  function boot(){if(install())return;[180,420,800,1300,2200,3200].forEach(delay=>setTimeout(install,delay));}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
