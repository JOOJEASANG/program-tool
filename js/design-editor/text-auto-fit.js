(function(){
  'use strict';
  if(window.__designEditorTextAutoFitV1)return;
  window.__designEditorTextAutoFitV1=true;

  const DRAFT_KEY='programTool.designEditor.draft.v1';
  const MIN_BOX_MM=4;
  const MIN_MANUAL_BOX_MM=20;
  const EPSILON_MM=.08;
  const AUTO_CONTROL_ID='textBoxAutoWidthControl';
  const AUTO_INPUT_ID='textBoxAutoWidthInput';
  let installed=false;
  let syncing=false;
  let queued=false;
  let saveTimer=0;
  let observer=null;
  let manualDrag=null;

  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const project=()=>window.DesignEditorApp?.project||null;
  const activeSurface=()=>{
    const p=project();
    return p?.surfaces?.find(surface=>surface.id===p.activeSurface)||p?.surfaces?.[0]||null;
  };
  const selectedTextEntry=()=>{
    const surface=activeSurface();
    const selected=document.querySelector('.design-text.selected[data-id]');
    return surface?.elements?.find(item=>item.id===selected?.dataset.id&&item.type==='text')||null;
  };
  const isAutoWidth=entry=>entry?.textBoxWidthMode!=='manual';

  function artboardScale(){
    const p=project(),board=document.getElementById('artboard');
    if(!p||!board)return 1;
    const total=Math.max(1,(Number(p.width)||0)+(Number(p.bleed)||0)*2);
    const width=board.getBoundingClientRect().width||board.offsetWidth||total;
    return Math.max(.001,width/total);
  }

  function createMeter(entry,scale){
    const node=document.createElement('div');
    node.className='design-object design-text design-text-auto-fit-meter';
    node.setAttribute('aria-hidden','true');
    node.style.cssText='position:fixed!important;left:-100000px!important;top:-100000px!important;width:max-content!important;max-width:none!important;min-width:0!important;height:auto!important;visibility:hidden!important;pointer-events:none!important;transform:none!important;white-space:nowrap!important;z-index:-1!important;';
    node.style.fontFamily=`${entry.fontFamily||'Pretendard'}, "Malgun Gothic", sans-serif`;
    node.style.fontWeight=String(Number(entry.weight)||400);
    node.style.fontSize=`${(Number(entry.size)||12)*(25.4/72)*scale}px`;
    node.style.lineHeight=String(Number(entry.lineHeight)||1.26);

    const inner=document.createElement('div');
    inner.className='design-text-inner';
    inner.style.width='max-content';
    inner.style.minWidth='0';
    inner.style.maxWidth='none';
    inner.style.flexWrap='nowrap';

    if(entry.icon&&entry.icon!=='none'){
      const icon=document.createElement('span');
      icon.className='design-prefix-icon';
      icon.textContent=' ';
      inner.appendChild(icon);
    }

    const text=document.createElement('span');
    text.className='editable-text';
    text.textContent=String(entry.text||'');
    text.style.display='block';
    text.style.flex='0 0 auto';
    text.style.width='max-content';
    text.style.minWidth='0';
    text.style.maxWidth='none';
    text.style.whiteSpace='pre';
    text.style.overflowWrap='normal';
    text.style.wordBreak='normal';
    text.style.letterSpacing=`${(Number(entry.letterSpacing)||0)*scale}px`;
    inner.appendChild(text);
    node.appendChild(inner);
    return node;
  }

  function measureWidthMm(entry,p,scale){
    const meter=createMeter(entry,scale);
    document.body.appendChild(meter);
    let pixels=0;
    try{pixels=meter.getBoundingClientRect().width||meter.scrollWidth||0;}
    finally{meter.remove();}
    const fontMm=(Number(entry.size)||12)*(25.4/72);
    const minimum=Math.max(MIN_BOX_MM,fontMm*.72);
    const maximum=Math.max(minimum,Number(p.width)||minimum);
    return clamp(Math.max(minimum,pixels/Math.max(.001,scale)),minimum,maximum);
  }

  function anchoredX(entry,newWidth,p){
    const oldWidth=Math.max(MIN_BOX_MM,Number(entry.w)||newWidth);
    const oldX=Number(entry.x)||0;
    let next=oldX;
    if(entry.align==='center')next=oldX+(oldWidth-newWidth)/2;
    else if(entry.align==='right')next=oldX+(oldWidth-newWidth);
    return clamp(next,0,Math.max(0,(Number(p.width)||newWidth)-newWidth));
  }

  function fitEntry(entry,p=project(),scale=artboardScale()){
    if(!entry||entry.type!=='text'||entry.visible===false||!p||!isAutoWidth(entry))return false;
    const nextWidth=measureWidthMm(entry,p,scale);
    const oldWidth=Math.max(MIN_BOX_MM,Number(entry.w)||nextWidth);
    const oldX=Number(entry.x)||0;
    const nextX=anchoredX(entry,nextWidth,p);
    if(Math.abs(oldWidth-nextWidth)<EPSILON_MM&&Math.abs(oldX-nextX)<EPSILON_MM)return false;
    entry.w=Math.round(nextWidth*1000)/1000;
    entry.x=Math.round(nextX*1000)/1000;
    return true;
  }

  function applyManualWidth(entry,value,p=project()){
    if(!entry||entry.type!=='text'||!p)return false;
    const parsed=Number(value);
    if(!Number.isFinite(parsed))return false;
    const maximum=Math.max(MIN_MANUAL_BOX_MM,Number(p.width)||MIN_MANUAL_BOX_MM);
    const nextWidth=clamp(parsed,MIN_MANUAL_BOX_MM,maximum);
    entry.textBoxWidthMode='manual';
    entry.w=Math.round(nextWidth*1000)/1000;
    entry.x=Math.round(clamp(Number(entry.x)||0,0,Math.max(0,maximum-nextWidth))*1000)/1000;
    return true;
  }

  function setAutoWidth(entry,enabled=true){
    if(!entry||entry.type!=='text')return false;
    entry.textBoxWidthMode=enabled?'auto':'manual';
    if(enabled)fitEntry(entry);
    applyActiveSurface();
    syncInspector();
    persist();
    try{window.dispatchEvent(new CustomEvent('designeditor:text-width-mode',{detail:{entry,mode:entry.textBoxWidthMode}}));}catch(_){}
    return true;
  }

  function syncManualResizeHandles(){
    document.querySelectorAll('.design-text.selected[data-id] .phase3-resize-handle').forEach(handle=>{
      handle.title='좌우로 드래그해서 글상자 폭 조절';
      handle.setAttribute('aria-label','글상자 폭 조절');
      handle.style.setProperty('cursor','ew-resize','important');
    });
  }

  function beginManualResize(event){
    const handle=event.target?.closest?.('.phase3-resize-handle');
    const node=handle?.closest?.('.design-text.selected[data-id]');
    if(!handle||!node)return;
    const entry=selectedTextEntry(),p=project();
    if(!entry||!p||entry.locked)return;
    entry.textBoxWidthMode='manual';
    manualDrag={
      entry,
      node,
      startX:Number(event.clientX)||0,
      startWidth:Math.max(MIN_MANUAL_BOX_MM,Number(entry.w)||MIN_MANUAL_BOX_MM),
      scale:artboardScale(),
      project:p
    };
    syncInspector();
    try{handle.setPointerCapture?.(event.pointerId);}catch(_){}
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  function moveManualResize(event){
    if(!manualDrag)return;
    const {entry,node,startX,startWidth,scale,project:p}=manualDrag;
    const delta=((Number(event.clientX)||0)-startX)/Math.max(.001,scale);
    const nextWidth=clamp(startWidth+delta,MIN_MANUAL_BOX_MM,Math.max(MIN_MANUAL_BOX_MM,Number(p.width)||MIN_MANUAL_BOX_MM));
    entry.w=Math.round(nextWidth*1000)/1000;
    entry.x=Math.round(clamp(Number(entry.x)||0,0,Math.max(0,(Number(p.width)||nextWidth)-nextWidth))*1000)/1000;
    node.style.left=`${((Number(p.bleed)||0)+(Number(entry.x)||0))*scale}px`;
    node.style.width=`${entry.w*scale}px`;
    const input=document.getElementById('widthInput');
    if(input)input.value=String(Math.round(entry.w*10)/10);
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  function finishManualResize(){
    if(!manualDrag)return;
    const entry=manualDrag.entry;
    manualDrag=null;
    persist();
    syncInspector();
    try{window.dispatchEvent(new CustomEvent('designeditor:text-width-manual',{detail:{entry}}));}catch(_){}
  }

  function applyActiveSurface(){
    const p=project(),surface=activeSurface(),board=document.getElementById('artboard');
    if(!p||!surface||!board)return;
    const scale=artboardScale();
    board.querySelectorAll('.design-text[data-id]').forEach(node=>{
      const entry=surface.elements?.find(item=>item.id===node.dataset.id&&item.type==='text');
      if(!entry)return;
      node.style.left=`${((Number(p.bleed)||0)+(Number(entry.x)||0))*scale}px`;
      node.style.width=`${Math.max(MIN_BOX_MM,Number(entry.w)||MIN_BOX_MM)*scale}px`;
    });
    syncManualResizeHandles();
  }

  function ensureAutoControl(input,entry){
    const field=input.closest('.field');
    if(!field)return null;
    let control=document.getElementById(AUTO_CONTROL_ID);
    if(!control||control.parentElement!==field){
      control?.remove();
      control=document.createElement('label');
      control.id=AUTO_CONTROL_ID;
      control.className='check-row text-box-auto-width-control';
      control.title='켜면 글자 길이에 맞춰 폭이 자동으로 조절되고, 끄면 사용자가 지정한 폭을 유지합니다.';
      const checkbox=document.createElement('input');
      checkbox.id=AUTO_INPUT_ID;
      checkbox.type='checkbox';
      const text=document.createElement('span');
      text.textContent='글상자 폭 자동 맞춤';
      control.append(checkbox,text);
      field.appendChild(control);
      checkbox.addEventListener('change',()=>{
        const current=selectedTextEntry();
        if(!current)return;
        setAutoWidth(current,checkbox.checked);
      });
    }
    const checkbox=control.querySelector(`#${AUTO_INPUT_ID}`);
    if(checkbox&&entry)checkbox.checked=isAutoWidth(entry);
    return control;
  }

  function syncInspector(){
    const input=document.getElementById('widthInput');
    if(!input)return;
    const entry=selectedTextEntry();
    if(entry){
      const value=String(Math.round((Number(entry.w)||0)*10)/10);
      if(input.value!==value)input.value=value;
    }
    input.disabled=false;
    input.readOnly=false;
    const auto=!entry||isAutoWidth(entry);
    input.title=auto?'폭을 직접 입력하면 수동 폭으로 전환됩니다.':'사용자가 지정한 글상자 폭입니다.';
    const label=input.closest('.field')?.querySelector('label');
    if(label)label.textContent=auto?'글상자 폭 mm · 자동':'글상자 폭 mm · 직접';
    ensureAutoControl(input,entry);
    syncManualResizeHandles();
  }

  function persist(){
    clearTimeout(saveTimer);
    saveTimer=setTimeout(()=>{
      const p=project();
      if(!p)return;
      try{localStorage.setItem(DRAFT_KEY,JSON.stringify(p));}catch(_){}
      try{window.DesignEditorDraftScope?.saveCurrent?.('text-auto-fit');}catch(_){}
    },220);
  }

  function syncAll(){
    if(syncing)return false;
    const p=project();
    if(!p||!Array.isArray(p.surfaces))return false;
    syncing=true;
    let changed=false;
    // Suppress our own artboard observer while we mutate the DOM so these writes
    // do not re-trigger this sync. JS is single-threaded, so no external mutation
    // can slip in during this synchronous block — nothing is missed.
    const board=document.getElementById('artboard');
    if(observer)observer.disconnect();
    try{
      const scale=artboardScale();
      p.surfaces.forEach(surface=>{
        (surface.elements||[]).forEach(entry=>{if(fitEntry(entry,p,scale))changed=true;});
      });
      applyActiveSurface();
      syncInspector();
      if(changed){
        persist();
        window.dispatchEvent(new CustomEvent('designeditor:text-autofit',{detail:{project:p}}));
      }
      return changed;
    }finally{
      if(observer&&board){try{observer.takeRecords();}catch(_){}try{observer.observe(board,{childList:true,subtree:true,characterData:true});}catch(_){}}
      syncing=false;
    }
  }

  function queueSync(){
    if(queued)return;
    queued=true;
    setTimeout(()=>{queued=false;syncAll();},0);
  }

  function bindEvents(){
    const board=document.getElementById('artboard');
    if(board){
      observer=new MutationObserver(()=>queueSync());
      observer.observe(board,{childList:true,subtree:true,characterData:true});
    }
    document.addEventListener('pointerdown',beginManualResize,true);
    document.addEventListener('pointermove',moveManualResize,true);
    document.addEventListener('pointerup',finishManualResize,true);
    document.addEventListener('pointercancel',finishManualResize,true);
    document.addEventListener('input',event=>{
      if(event.target?.id==='widthInput'){
        const entry=selectedTextEntry();
        if(entry&&applyManualWidth(entry,event.target.value)){
          applyActiveSurface();
          persist();
          setTimeout(syncInspector,0);
        }
        return;
      }
      if(event.target?.matches?.('.editable-text,#textContentInput,#sizeInput,#phase2LetterSpacing,#phase2LineHeight'))queueSync();
    },true);
    document.addEventListener('change',event=>{
      if(event.target?.matches?.('#roleInput,#iconInput,#fontInput,#weightInput'))queueSync();
    });
    document.addEventListener('click',event=>{
      if(event.target?.matches?.('[data-align],#addTitleBtn,#addSubtitleBtn,#addBodyBtn,#addInfoBtn,#inspectorAddTitle,#inspectorAddText'))queueSync();
    });
    window.addEventListener('resize',queueSync,{passive:true});
    window.addEventListener('designeditor:project-restored',queueSync);
    window.addEventListener('designeditor:text-width-manual',event=>{
      const entry=event.detail?.entry||selectedTextEntry();
      if(entry){entry.textBoxWidthMode='manual';syncInspector();persist();}
    });
    if(document.fonts?.ready)document.fonts.ready.then(queueSync).catch(()=>{});
  }

  function install(){
    if(installed)return true;
    if(!document.getElementById('artboard')||!document.getElementById('inspector')||!window.DesignEditorApp)return false;
    installed=true;
    bindEvents();
    window.DesignEditorTextAutoFit={
      sync:syncAll,
      queue:queueSync,
      fitEntry,
      isAutoWidth,
      setAutoWidth,
      setManualWidth:(entry,width)=>{const changed=applyManualWidth(entry,width);if(changed){applyActiveSurface();syncInspector();persist();}return changed;},
      stage:'all-design-text-box-auto-and-manual-width'
    };
    [0,80,220,500,1000,1800].forEach(delay=>setTimeout(queueSync,delay));
    return true;
  }

  function boot(){if(install())return;[80,180,350,700,1200,2200,3500].forEach(delay=>setTimeout(install,delay));}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
