(function(){
  'use strict';
  if(window.__designEditorTextAutoFitV1)return;
  window.__designEditorTextAutoFitV1=true;

  const DRAFT_KEY='programTool.designEditor.draft.v1';
  const MIN_BOX_MM=4;
  const EPSILON_MM=.08;
  let installed=false;
  let syncing=false;
  let queued=false;
  let saveTimer=0;
  let observer=null;

  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const project=()=>window.DesignEditorApp?.project||null;
  const activeSurface=()=>{
    const p=project();
    return p?.surfaces?.find(surface=>surface.id===p.activeSurface)||p?.surfaces?.[0]||null;
  };

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

  function fitEntry(entry,p,scale){
    if(!entry||entry.type!=='text'||entry.visible===false)return false;
    const nextWidth=measureWidthMm(entry,p,scale);
    const oldWidth=Math.max(MIN_BOX_MM,Number(entry.w)||nextWidth);
    const oldX=Number(entry.x)||0;
    const nextX=anchoredX(entry,nextWidth,p);
    if(Math.abs(oldWidth-nextWidth)<EPSILON_MM&&Math.abs(oldX-nextX)<EPSILON_MM)return false;
    entry.w=Math.round(nextWidth*1000)/1000;
    entry.x=Math.round(nextX*1000)/1000;
    return true;
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
  }

  function syncInspector(){
    const input=document.getElementById('widthInput');
    if(!input)return;
    const surface=activeSurface(),selected=document.querySelector('.design-text.selected[data-id]');
    const entry=surface?.elements?.find(item=>item.id===selected?.dataset.id&&item.type==='text');
    if(entry){
      const value=String(Math.round((Number(entry.w)||0)*10)/10);
      if(input.value!==value)input.value=value;
    }
    if(!input.disabled)input.disabled=true;
    if(!input.readOnly)input.readOnly=true;
    if(input.title!=='글자 길이에 따라 자동으로 맞춰집니다.')input.title='글자 길이에 따라 자동으로 맞춰집니다.';
    const label=input.closest('.field')?.querySelector('label');
    if(label&&label.textContent!=='글상자 폭 mm · 자동')label.textContent='글상자 폭 mm · 자동';
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
    }finally{syncing=false;}
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
    document.addEventListener('input',event=>{
      if(event.target?.matches?.('.editable-text,#textContentInput,#sizeInput,#phase2LetterSpacing,#phase2LineHeight'))queueSync();
    });
    document.addEventListener('change',event=>{
      if(event.target?.matches?.('#roleInput,#iconInput,#fontInput,#weightInput'))queueSync();
    });
    document.addEventListener('click',event=>{
      if(event.target?.matches?.('[data-align],#addTitleBtn,#addSubtitleBtn,#addBodyBtn,#addInfoBtn,#inspectorAddTitle,#inspectorAddText'))queueSync();
    });
    window.addEventListener('resize',queueSync,{passive:true});
    window.addEventListener('designeditor:project-restored',queueSync);
    if(document.fonts?.ready)document.fonts.ready.then(queueSync).catch(()=>{});
  }

  function install(){
    if(installed)return true;
    if(!document.getElementById('artboard')||!document.getElementById('inspector')||!window.DesignEditorApp)return false;
    installed=true;
    bindEvents();
    window.DesignEditorTextAutoFit={sync:syncAll,queue:queueSync,stage:'all-design-text-box-auto-fit'};
    [0,80,220,500,1000,1800].forEach(delay=>setTimeout(queueSync,delay));
    return true;
  }

  function boot(){if(install())return;[80,180,350,700,1200,2200,3500].forEach(delay=>setTimeout(install,delay));}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
