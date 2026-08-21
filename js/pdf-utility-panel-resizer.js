// Resizable PDF Utility file/work panel splitter.
(function(){
  'use strict';
  if(window.__pdfUtilityPanelResizerV1)return;
  window.__pdfUtilityPanelResizerV1=true;

  const PATHS=['/tools/pdf-Checker.html','/tools/preflight.html','/pdf-preflight'];
  const path=location.pathname.replace(/\/+$/,'')||'/';
  if(!PATHS.some(p=>path===p||path.endsWith(p+'/index.html')))return;

  const STORAGE_KEY='pdfUtilityPanelSplitRatio';
  const MIN=0.30;
  const MAX=0.70;
  const GAP=12;
  const HANDLE=10;
  let installed=false;

  function clamp(v){return Math.max(MIN,Math.min(MAX,v));}
  function getRatio(){
    const raw=Number(localStorage.getItem(STORAGE_KEY));
    return Number.isFinite(raw)?clamp(raw):0.5;
  }
  function setRatio(r){
    const ratio=clamp(r);
    localStorage.setItem(STORAGE_KEY,String(ratio));
    document.documentElement.style.setProperty('--pdfu-left-ratio',ratio);
    return ratio;
  }

  function injectStyles(){
    if(document.getElementById('pdfUtilityPanelResizerStyles'))return;
    const style=document.createElement('style');
    style.id='pdfUtilityPanelResizerStyles';
    style.textContent=`
      body.pdfu-wide-layout .container{
        width:100%!important;
        max-width:none!important;
        margin:0!important;
        padding:14px 10px 50px!important;
      }
      body.pdfu-wide-layout .hero{display:none!important}
      body.pdfu-wide-layout .workspace{width:100%!important;max-width:none!important;margin:0!important;padding:0!important}
      body.pdfu-wide-layout .workspace.pdfu-resizable-workspace{
        grid-template-columns:minmax(0,calc((100% - ${GAP}px - ${HANDLE}px) * var(--pdfu-left-ratio, .5))) ${HANDLE}px minmax(0,1fr)!important;
        gap:${GAP}px!important;
      }
      body.pdfu-wide-layout .workspace.pdfu-resizable-workspace>.panel{min-width:0!important;margin:0!important}
      body.pdfu-wide-layout .pdfu-panel-resizer{
        width:${HANDLE}px;min-width:${HANDLE}px;align-self:stretch;min-height:420px;border:0;
        border-radius:999px;background:transparent;cursor:col-resize;position:relative;
        touch-action:none;user-select:none;z-index:20;
      }
      body.pdfu-wide-layout .pdfu-panel-resizer::before{
        content:"";position:absolute;left:3px;top:0;bottom:0;width:4px;border-radius:999px;
        background:#dbe5ee;transition:background .15s ease,box-shadow .15s ease;
      }
      body.pdfu-wide-layout .pdfu-panel-resizer::after{
        content:"⋮";position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);
        width:20px;height:42px;border-radius:10px;display:grid;place-items:center;background:#fff;
        border:1px solid #dbe5ee;box-shadow:0 5px 15px rgba(15,23,42,.10);color:#8290a4;
        font-size:16px;font-weight:900;line-height:1;
      }
      body.pdfu-wide-layout .pdfu-panel-resizer:hover::before,
      body.pdfu-wide-layout .pdfu-panel-resizer.dragging::before{background:#1769e0;box-shadow:0 0 0 3px rgba(23,105,224,.10)}
      body.pdfu-wide-layout.pdfu-resizing,body.pdfu-wide-layout.pdfu-resizing *{cursor:col-resize!important;user-select:none!important}
      @media(max-width:1050px){
        body.pdfu-wide-layout .workspace.pdfu-resizable-workspace{grid-template-columns:1fr!important}
        body.pdfu-wide-layout .pdfu-panel-resizer{display:none!important}
      }
      @media(max-width:520px){body.pdfu-wide-layout .container{padding:10px 6px 36px!important}}
    `;
    document.head.appendChild(style);
  }

  // pdf-utility-wide-layout.js is loaded later by the legacy finalizer. Re-append
  // our style once it appears so the user's full-width split remains authoritative.
  function keepLayoutStyleLast(){
    const style=document.getElementById('pdfUtilityPanelResizerStyles');
    if(!style)return;
    let attempts=0;
    const check=()=>{
      if(document.getElementById('pdfUtilityWideLayoutStyles')){
        document.head.appendChild(style);
        return;
      }
      if(++attempts<30)setTimeout(check,100);
    };
    check();
  }

  function install(){
    if(installed)return true;
    document.body.classList.add('pdfu-wide-layout');
    const workspace=document.querySelector('body.pdfu-wide-layout .workspace');
    if(!workspace)return false;
    const panels=workspace.querySelectorAll(':scope > .panel');
    if(panels.length<2)return false;
    workspace.classList.add('pdfu-resizable-workspace');
    if(workspace.querySelector('.pdfu-panel-resizer')){installed=true;setRatio(getRatio());return true;}

    const divider=document.createElement('div');
    divider.className='pdfu-panel-resizer';
    divider.setAttribute('role','separator');
    divider.setAttribute('aria-label','파일 선택 영역과 작업 선택 영역 크기 조절');
    divider.setAttribute('aria-orientation','vertical');
    divider.setAttribute('tabindex','0');
    panels[0].insertAdjacentElement('afterend',divider);
    setRatio(getRatio());

    let dragging=false;
    function move(clientX){
      const rect=workspace.getBoundingClientRect();
      const usable=rect.width-GAP-HANDLE;
      if(usable<=0)return;
      setRatio((clientX-rect.left)/usable);
    }
    function end(e){
      if(!dragging)return;
      dragging=false;
      divider.classList.remove('dragging');
      document.body.classList.remove('pdfu-resizing');
      try{if(e&&e.pointerId!=null)divider.releasePointerCapture?.(e.pointerId);}catch(_){}
    }
    divider.addEventListener('pointerdown',e=>{
      if(e.button!==0)return;
      dragging=true;
      divider.classList.add('dragging');
      document.body.classList.add('pdfu-resizing');
      divider.setPointerCapture?.(e.pointerId);
      move(e.clientX);
      e.preventDefault();
    });
    divider.addEventListener('pointermove',e=>{if(dragging)move(e.clientX);});
    divider.addEventListener('pointerup',end);
    divider.addEventListener('pointercancel',end);
    divider.addEventListener('keydown',e=>{
      if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
      let r=getRatio();
      if(e.key==='ArrowLeft')r-=.02;
      if(e.key==='ArrowRight')r+=.02;
      if(e.key==='Home')r=MIN;
      if(e.key==='End')r=MAX;
      setRatio(r);
      e.preventDefault();
    });
    installed=true;
    return true;
  }

  function boot(){
    injectStyles();
    keepLayoutStyleLast();
    if(install())return;
    let attempts=0;
    const retry=()=>{if(install()||++attempts>=20)return;setTimeout(retry,100);};
    retry();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
