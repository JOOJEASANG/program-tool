// Dock PDF utility tool dialogs inside the right-side progress/result panel.
(function(){
  'use strict';
  if(window.__pdfPreflightOutputToolDockV1)return;
  window.__pdfPreflightOutputToolDockV1=true;

  const path=(location.pathname||'/').replace(/\/+$/,'')||'/';
  if(!(path==='/pdf-preflight'||path==='/pdf-preflight/index.html'||path.endsWith('/pdf-preflight/index.html')||path.endsWith('/tools/pdf-Checker.html')||path.endsWith('/tools/preflight.html')))return;

  const OVERLAY_SELECTOR=[
    '#toolModalOverlay',
    '#pdfUtilityModalOverlay',
    '#pdfUtilityImageConverterOverlay',
    '#pdfAllInOneOverlay',
    '#pdfLargeOutputTilingOverlay',
    '.tool-modal-overlay',
    '.pdfu-modal-overlay',
    '.pdfic-overlay',
    '.pdfaio-overlay',
    '.plot-overlay'
  ].join(',');

  let observer=null;
  let queued=false;
  let lastOpen=false;

  function outputPanel(){
    return document.querySelector('.pdf-preflight-output-panel')||document.querySelector('.workspace>.panel:nth-child(2)');
  }

  function installStyles(){
    if(document.getElementById('pdfPreflightOutputToolDockStyles'))return;
    const style=document.createElement('style');
    style.id='pdfPreflightOutputToolDockStyles';
    style.textContent=`
      .pdf-preflight-output-tool-dock{display:none;width:100%;margin:0 0 10px}.pdf-preflight-output-tool-dock.active{display:block}
      .pdf-preflight-output-tool-dock.active + .pdf-preflight-output-empty{display:none!important}
      .pdf-preflight-output-tool-dock .tool-modal-overlay,.pdf-preflight-output-tool-dock .pdfu-modal-overlay,.pdf-preflight-output-tool-dock .pdfic-overlay,.pdf-preflight-output-tool-dock .pdfaio-overlay,.pdf-preflight-output-tool-dock .plot-overlay{display:none!important;position:static!important;inset:auto!important;z-index:auto!important;width:100%!important;height:auto!important;min-height:0!important;padding:0!important;margin:0!important;background:transparent!important;backdrop-filter:none!important;align-items:stretch!important;justify-content:stretch!important}
      .pdf-preflight-output-tool-dock .tool-modal-overlay.open,.pdf-preflight-output-tool-dock .pdfu-modal-overlay.open,.pdf-preflight-output-tool-dock .pdfic-overlay.open,.pdf-preflight-output-tool-dock .pdfaio-overlay.open,.pdf-preflight-output-tool-dock .plot-overlay.open{display:block!important}
      .pdf-preflight-output-tool-dock .tool-modal-box,.pdf-preflight-output-tool-dock .pdfu-modal,.pdf-preflight-output-tool-dock .pdfic-box,.pdf-preflight-output-tool-dock .pdfaio-box,.pdf-preflight-output-tool-dock .plot-box{width:100%!important;max-width:none!important;max-height:none!important;overflow:visible!important;margin:0!important;border:1px solid #dfe7ef!important;border-radius:11px!important;padding:14px!important;box-shadow:none!important;background:#fff!important}
      .pdf-preflight-output-tool-dock .tool-modal-title,.pdf-preflight-output-tool-dock .pdfu-modal-title,.pdf-preflight-output-tool-dock .pdfic-title,.pdf-preflight-output-tool-dock .pdfaio-title,.pdf-preflight-output-tool-dock .plot-title{font-size:15px!important}
      .pdf-preflight-output-tool-dock .tool-modal-desc,.pdf-preflight-output-tool-dock .pdfu-modal-desc,.pdf-preflight-output-tool-dock .pdfic-desc,.pdf-preflight-output-tool-dock .pdfaio-desc,.pdf-preflight-output-tool-dock .plot-sub{font-size:9px!important;line-height:1.55!important}
      @media(max-width:820px){.pdf-preflight-output-tool-dock .tool-modal-box,.pdf-preflight-output-tool-dock .pdfu-modal,.pdf-preflight-output-tool-dock .pdfic-box,.pdf-preflight-output-tool-dock .pdfaio-box,.pdf-preflight-output-tool-dock .plot-box{padding:12px!important}}
    `;
    document.head.appendChild(style);
  }

  function placeDock(panel,dock){
    const head=panel.querySelector('.pdf-preflight-output-head')||panel.querySelector(':scope > .panel-head');
    if(head){
      if(head.nextElementSibling!==dock)head.insertAdjacentElement('afterend',dock);
    }else if(panel.firstElementChild!==dock){
      panel.prepend(dock);
    }
  }

  function ensureDock(){
    const panel=outputPanel();
    if(!panel)return null;
    let dock=document.getElementById('pdfPreflightOutputToolDock');
    if(!dock){
      dock=document.createElement('section');
      dock.id='pdfPreflightOutputToolDock';
      dock.className='pdf-preflight-output-tool-dock';
      dock.setAttribute('aria-label','PDF 작업 설정');
    }
    if(dock.parentElement!==panel)panel.appendChild(dock);
    placeDock(panel,dock);
    return dock;
  }

  function isDockable(node){
    return node instanceof HTMLElement&&node.matches(OVERLAY_SELECTOR)&&node.id!=='pdfPreflightOutputToolDock';
  }

  function sync(){
    queued=false;
    installStyles();
    const dock=ensureDock();
    if(!dock)return;

    [...document.querySelectorAll(OVERLAY_SELECTOR)].forEach(node=>{
      if(!isDockable(node))return;
      if(node.parentElement!==dock)dock.appendChild(node);
      node.dataset.pdfPreflightDocked='true';
    });

    const open=[...dock.children].some(node=>node.classList?.contains('open'));
    dock.classList.toggle('active',open);
    document.documentElement.dataset.pdfPreflightToolDock=open?'open':'ready';

    if(open&&!lastOpen&&window.matchMedia('(max-width: 820px)').matches){
      requestAnimationFrame(()=>dock.scrollIntoView({behavior:'smooth',block:'start'}));
    }
    lastOpen=open;
  }

  function queueSync(){
    if(queued)return;
    queued=true;
    queueMicrotask(sync);
  }

  function boot(){
    sync();
    if(!observer&&document.body){
      observer=new MutationObserver(queueSync);
      observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
    }
    [80,220,500,900,1600,2600].forEach(delay=>setTimeout(sync,delay));
    window.PdfPreflightOutputToolDock={sync,stage:'output-panel-tool-dock-v1'};
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
