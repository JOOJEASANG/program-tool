// Ensure the leaflet print-fold runtime is present and refreshed in the real editor iframe.
(function(){
  'use strict';
  if(window.__designEditorPrintFoldRuntimeEnsureV1)return;
  window.__designEditorPrintFoldRuntimeEnsureV1=true;

  const SCRIPT_ID='designPrintFoldProductionDirectScriptV1';
  const SCRIPT_SRC='/js/design-editor/print-fold-production.js?v=20260825-3';
  const PAPER_MM={
    a6:[105,148],a5:[148,210],a4:[210,297],a3:[297,420],
    b5:[182,257],b4:[257,364],b3:[364,515]
  };
  let retryTimer=0;
  let burstTimer=0;
  let observer=null;

  const project=()=>window.DesignEditorApp?.project||null;
  const isLeaflet2=p=>Boolean(p&&(p.designMode==='leaflet2'||p.presetId==='leaflet-2'));
  const isLeaflet3=p=>Boolean(p&&(p.designMode==='leaflet3'||String(p.presetId||'').startsWith('leaflet-3-')));
  const isLeaflet=p=>isLeaflet2(p)||isLeaflet3(p);
  const expectedLineCount=p=>{
    if(p?.printProductMode==='invitation')return 1;
    if(p?.printProductMode==='leaflet')return Math.max(1,(Number(p.printProductPages)||6)/2-1);
    return isLeaflet2(p)?1:isLeaflet3(p)?2:0;
  };
  const roundMm=value=>Math.round((Number(value)||0)*10)/10;

  function normalizeOrientationFields(){
    const p=project();
    if(!isLeaflet(p))return false;
    const paper=document.getElementById('designModePaper');
    const orientation=document.getElementById('designModeOrientation');
    const width=document.getElementById('designModeWidth');
    const height=document.getElementById('designModeHeight');
    if(!orientation||!width||!height)return false;
    const direction=orientation.value==='landscape'?'landscape':'portrait';
    let w=Number(width.value)||Number(p?.width)||210;
    let h=Number(height.value)||Number(p?.height)||297;
    const preset=paper?.value&&paper.value!=='custom'?PAPER_MM[paper.value]:null;
    if(preset){
      const short=Math.min(...preset),long=Math.max(...preset);
      w=direction==='landscape'?long:short;
      h=direction==='landscape'?short:long;
    }else{
      if(direction==='landscape'&&w<h)[w,h]=[h,w];
      if(direction==='portrait'&&w>h)[w,h]=[h,w];
    }
    width.value=String(roundMm(w));
    height.value=String(roundMm(h));
    document.documentElement.dataset.leafletOrientationApply=`${direction}:${roundMm(w)}x${roundMm(h)}`;
    document.documentElement.dataset.leafletOrientationMode=p?.printProductMode|| (isLeaflet3(p)?'leaflet3':'leaflet2');
    return true;
  }

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
      if(event.target?.closest?.('.design-mode-apply,.design-product-apply'))normalizeOrientationFields();
      if(event.target?.closest?.('[data-design-mode],[data-print-product],.design-mode-apply,.design-product-apply,.surface-tab'))burst();
    },true);
    document.addEventListener('change',event=>{
      if(event.target?.id==='designModeOrientation')normalizeOrientationFields();
      if(['designModeOrientation','designModePaper','designModeFold','designProductFold','designProductPages','designProductAxis','designLeaflet2Layout','guideToggle','foldToggle'].includes(event.target?.id))burst();
    },true);
    document.addEventListener('input',event=>{
      if(['designModeWidth','designModeHeight','designProductFoldPosition','bleedInput','safeInput'].includes(event.target?.id))burst();
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

  window.DesignEditorPrintFoldRuntimeEnsure={refresh,forceRender,normalizeOrientationFields,expectedLineCount,stage:'direct-fold-runtime-variable-page-verifier'};
})();
