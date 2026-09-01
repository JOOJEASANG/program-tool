// Stability guards for shared design-editor interactions.
(function(){
  'use strict';
  if(window.__designEditorStabilityGuardsV1)return;
  window.__designEditorStabilityGuardsV1=true;
  if(new URLSearchParams(location.search).get('embed')!=='1')return;

  const DRAFT_KEY='programTool.designEditor.draft.v1';
  const STYLE_ID='designEditorStabilityGuardStylesV1';
  let observer=null;
  let queued=false;

  const project=()=>window.DesignEditorApp?.project||null;
  const currentSurface=()=>{
    const p=project();
    return p?.surfaces?.find(item=>item.id===p.activeSurface)||p?.surfaces?.[0]||null;
  };

  function installStyles(){
    if(document.getElementById(STYLE_ID))return;
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`html[data-design-direct-resize="1"] .phase3-resize-handle{display:none!important;pointer-events:none!important}`;
    document.head.appendChild(style);
  }

  function removeLegacyResizeHandles(){
    if(!window.DesignEditorDirectResize)return false;
    document.documentElement.dataset.designDirectResize='1';
    let removed=false;
    document.querySelectorAll('#artboard .phase3-resize-handle').forEach(node=>{node.remove();removed=true;});
    return removed;
  }

  function findTextById(id){
    if(!id)return null;
    const p=project();
    if(!p)return null;
    for(const surface of p.surfaces||[]){
      const item=(surface.elements||[]).find(entry=>entry.id===id&&entry.type==='text');
      if(item)return item;
    }
    return null;
  }

  function persistManualText(entry){
    if(!entry)return false;
    entry.textBoxWidthMode='manual';
    const p=project();
    if(p){
      try{localStorage.setItem(DRAFT_KEY,JSON.stringify(p));}catch(_){}
      try{window.DesignEditorDraftScope?.saveCurrent?.('stability-direct-text-width');}catch(_){}
    }
    try{window.dispatchEvent(new CustomEvent('designeditor:text-width-manual',{detail:{entry}}));}catch(_){}
    window.DesignEditorTextAutoFit?.sync?.();
    return true;
  }

  function handleResize(event){
    const detail=event?.detail||{};
    if(detail.kind!=='text')return;
    const entry=findTextById(detail.id)||(currentSurface()?.elements||[]).find(item=>item.id===detail.id&&item.type==='text');
    persistManualText(entry);
  }

  function sync(){
    installStyles();
    removeLegacyResizeHandles();
    return true;
  }

  function queueSync(){
    if(queued)return;
    queued=true;
    requestAnimationFrame(()=>{queued=false;sync();});
  }

  function boot(){
    installStyles();
    window.addEventListener('programstudio:design-resize',handleResize);
    const board=document.getElementById('artboard');
    if(board&&typeof MutationObserver==='function'){
      observer=new MutationObserver(queueSync);
      observer.observe(board,{childList:true,subtree:true});
    }
    ['click','pointerup','change'].forEach(name=>document.addEventListener(name,queueSync,false));
    [80,220,500,1000,1800].forEach(delay=>setTimeout(queueSync,delay));
  }

  window.DesignEditorStabilityGuards={sync,persistManualText,stage:'design-editor-stability-guards-v1'};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();