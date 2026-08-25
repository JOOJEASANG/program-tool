// Ensure the leaflet print-fold runtime is present and refreshed in the real editor iframe.
(function(){
  'use strict';
  if(window.__designEditorPrintFoldRuntimeEnsureV1)return;
  window.__designEditorPrintFoldRuntimeEnsureV1=true;

  const SCRIPT_ID='designPrintFoldProductionDirectScriptV1';
  const SCRIPT_SRC='/js/design-editor/print-fold-production.js?v=20260825-2';
  let retryTimer=0;
  let burstTimer=0;
  let observer=null;

  const project=()=>window.DesignEditorApp?.project||null;
  const activeSurface=p=>p?.surfaces?.find(item=>item.id===p.activeSurface)||p?.surfaces?.[0]||null;
  const isLeaflet2=p=>Boolean(p&&(p.designMode==='leaflet2'||p.presetId==='leaflet-2'));
  const isLeaflet3=p=>Boolean(p&&(p.designMode==='leaflet3'||String(p.presetId||'').startsWith('leaflet-3-')));
  const expectedLineCount=p=>isLeaflet2(p)?1:isLeaflet3(p)?2:0;

  function ensureProduction(){
    if(window.DesignEditorPrintFoldProduction)return Promise.resolve(true);
    let script=document.getElementById(SCRIPT_ID);
    if(!script){
      script=document.createElement('script');
      script.id=SCRIPT_ID;
      script.src=SCRIPT_SRC;
      script.async=false;
      document.head.appendChild(script);
    }
    return new Promise(resolve=>{
      if(window.DesignEditorPrintFoldProduction)return resolve(true);
      let done=false;
      const finish=()=>{if(done)return;done=true;resolve(Boolean(window.DesignEditorPrintFoldProduction));};
      script.addEventListener('load',finish,{once:true});
      script.addEventListener('error',finish,{once:true});
      setTimeout(finish,1600);
    });
  }

  function forceRender(){
    const runtime=window.DesignEditorPrintFoldProduction;
    if(!runtime?.sync)return false;
    const p=project();
    runtime.sync();
    const expected=expectedLineCount(p);
    if(!expected)return true;
    const overlay=document.getElementById('designPrintFoldProductionOverlay');
    const actual=document.querySelectorAll('#designPrintFoldProductionOverlay .design-print-fold-line').length;
    if(actual===expected)return true;
    if(overlay)delete overlay.dataset.signature;
    runtime.sync();
    return document.querySelectorAll('#designPrintFoldProductionOverlay .design-print-fold-line').length===expected;
  }

  async function refresh(){
    clearTimeout(retryTimer);
    await ensureProduction();
    if(forceRender()){
      document.documentElement.dataset.printFoldRuntimeEnsure='ready';
      return true;
    }
    document.documentElement.dataset.printFoldRuntimeEnsure='waiting';
    retryTimer=setTimeout(refresh,180);
    return false;
  }

  function burst(){
    clearTimeout(burstTimer);
    let count=0;
    const tick=()=>{
      refresh();
      count+=1;
      if(count<8)burstTimer=setTimeout(tick,120);
    };
    tick();
  }

  function bind(){
    document.addEventListener('click',event=>{
      if(event.target?.closest?.('[data-design-mode],.design-mode-apply,.surface-tab'))burst();
    },true);
    document.addEventListener('change',event=>{
      if(['designModeOrientation','designModePaper','designModeFold','designLeaflet2Layout','guideToggle','foldToggle'].includes(event.target?.id))burst();
    },true);
    document.addEventListener('input',event=>{
      if(['designModeWidth','designModeHeight','bleedInput','safeInput'].includes(event.target?.id))burst();
    },true);
    if(typeof MutationObserver==='function'){
      observer=new MutationObserver(records=>{
        if(records.some(record=>[...record.addedNodes].some(node=>node?.id==='artboard'||node?.id==='designEmbeddedModeCard')))burst();
      });
      observer.observe(document.documentElement,{childList:true,subtree:true});
    }
    window.addEventListener('resize',burst,{passive:true});
  }

  bind();
  burst();
  [500,1200,2400,4200,7000].forEach(delay=>setTimeout(refresh,delay));

  window.DesignEditorPrintFoldRuntimeEnsure={refresh,forceRender,stage:'direct-fold-runtime-loader-and-verifier'};
})();
