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
  const BOX_SELECTOR='.tool-modal-box,.pdfu-modal,.pdfic-box,.pdfaio-box,.plot-box';

  let observer=null;
  let resizeObserver=null;
  let queued=false;
  let lastOpen=false;
  let lastOpenedOverlay=null;

  function outputPanel(){
    return document.querySelector('.pdf-preflight-output-panel')||document.querySelector('.workspace>.panel:nth-child(2)');
  }

  function installStyles(){
    if(document.getElementById('pdfPreflightOutputToolDockStyles'))return;
    const style=document.createElement('style');
    style.id='pdfPreflightOutputToolDockStyles';
    style.textContent=`
      .pdf-preflight-output-panel{width:100%!important;min-width:0!important;max-width:none!important;justify-self:stretch!important;align-self:stretch!important;box-sizing:border-box!important;container-type:inline-size}
      .pdf-preflight-output-tool-dock{display:none!important;width:100%!important;min-width:0!important;max-width:none!important;inline-size:100%!important;justify-self:stretch!important;align-self:stretch!important;flex:0 0 100%!important;margin:0 0 10px!important;padding:0!important;box-sizing:border-box!important;container-type:inline-size}
      .pdf-preflight-output-tool-dock.active{display:block!important}
      .pdf-preflight-output-tool-dock.active + .pdf-preflight-output-empty{display:none!important}
      .pdf-preflight-output-tool-dock>*{width:100%!important;min-width:0!important;max-width:none!important;inline-size:100%!important;box-sizing:border-box!important}
      .pdf-preflight-output-tool-dock>.tool-modal-overlay,.pdf-preflight-output-tool-dock>.pdfu-modal-overlay,.pdf-preflight-output-tool-dock>.pdfic-overlay,.pdf-preflight-output-tool-dock>.pdfaio-overlay,.pdf-preflight-output-tool-dock>.plot-overlay{display:none!important;position:static!important;inset:auto!important;z-index:auto!important;height:auto!important;min-height:0!important;padding:0!important;margin:0!important;background:transparent!important;backdrop-filter:none!important;align-items:stretch!important;justify-content:stretch!important;box-sizing:border-box!important}
      .pdf-preflight-output-tool-dock>.tool-modal-overlay.open,.pdf-preflight-output-tool-dock>.pdfu-modal-overlay.open,.pdf-preflight-output-tool-dock>.pdfic-overlay.open,.pdf-preflight-output-tool-dock>.pdfaio-overlay.open,.pdf-preflight-output-tool-dock>.plot-overlay.open{display:block!important}
      .pdf-preflight-output-tool-dock .tool-modal-box,.pdf-preflight-output-tool-dock .pdfu-modal,.pdf-preflight-output-tool-dock .pdfic-box,.pdf-preflight-output-tool-dock .pdfaio-box,.pdf-preflight-output-tool-dock .plot-box{display:block!important;width:100%!important;min-width:0!important;max-width:none!important;inline-size:100%!important;max-height:none!important;overflow:visible!important;margin:0!important;border:1px solid #dfe7ef!important;border-radius:11px!important;padding:14px!important;box-shadow:none!important;background:#fff!important;box-sizing:border-box!important}
      .pdf-preflight-output-tool-dock .tool-modal-box *,.pdf-preflight-output-tool-dock .pdfu-modal *,.pdf-preflight-output-tool-dock .pdfic-box *,.pdf-preflight-output-tool-dock .pdfaio-box *,.pdf-preflight-output-tool-dock .plot-box *{box-sizing:border-box;min-width:0;max-width:100%}
      .pdf-preflight-output-tool-dock input,.pdf-preflight-output-tool-dock select,.pdf-preflight-output-tool-dock textarea{max-width:100%!important}
      .pdf-preflight-output-tool-dock img,.pdf-preflight-output-tool-dock canvas,.pdf-preflight-output-tool-dock svg{max-width:100%!important;height:auto}
      .pdf-preflight-output-tool-dock .tool-modal-title,.pdf-preflight-output-tool-dock .pdfu-modal-title,.pdf-preflight-output-tool-dock .pdfic-title,.pdf-preflight-output-tool-dock .pdfaio-title,.pdf-preflight-output-tool-dock .plot-title{font-size:15px!important;overflow-wrap:anywhere}
      .pdf-preflight-output-tool-dock .tool-modal-desc,.pdf-preflight-output-tool-dock .pdfu-modal-desc,.pdf-preflight-output-tool-dock .pdfic-desc,.pdf-preflight-output-tool-dock .pdfaio-desc,.pdf-preflight-output-tool-dock .plot-sub{font-size:9px!important;line-height:1.55!important;overflow-wrap:anywhere}
      .pdf-preflight-output-tool-dock .pdfic-grid,.pdf-preflight-output-tool-dock .plot-grid,.pdf-preflight-output-tool-dock .plot-size-row,.pdf-preflight-output-tool-dock .plot-mode{width:100%!important;max-width:none!important}
      .pdf-preflight-output-tool-dock .plot-sheet-grid{max-width:100%!important}
      .pdf-preflight-output-tool-dock .pdfic-actions,.pdf-preflight-output-tool-dock .pdfaio-actions,.pdf-preflight-output-tool-dock .plot-actions,.pdf-preflight-output-tool-dock .pdfu-modal-footer,.pdf-preflight-output-tool-dock .tool-modal-footer,.pdf-preflight-output-tool-dock .tool-modal-actions{max-width:none!important;flex-wrap:wrap!important}
      .pdf-preflight-output-tool-dock .plot-preview-head,.pdf-preflight-output-tool-dock .pdfu-modal-head,.pdf-preflight-output-tool-dock .pdfic-head,.pdf-preflight-output-tool-dock .pdfaio-head,.pdf-preflight-output-tool-dock .tool-modal-head{flex-wrap:wrap}

      .pdf-preflight-output-panel[data-pdf-preflight-output-size="narrow"] .pdf-preflight-output-tool-dock .pdfic-grid,
      .pdf-preflight-output-panel[data-pdf-preflight-output-size="narrow"] .pdf-preflight-output-tool-dock .plot-grid,
      .pdf-preflight-output-panel[data-pdf-preflight-output-size="narrow"] .pdf-preflight-output-tool-dock .plot-size-row,
      .pdf-preflight-output-panel[data-pdf-preflight-output-size="narrow"] .pdf-preflight-output-tool-dock .plot-mode{grid-template-columns:1fr!important}
      .pdf-preflight-output-panel[data-pdf-preflight-output-size="narrow"] .pdf-preflight-output-tool-dock .pdfic-actions,
      .pdf-preflight-output-panel[data-pdf-preflight-output-size="narrow"] .pdf-preflight-output-tool-dock .pdfaio-actions,
      .pdf-preflight-output-panel[data-pdf-preflight-output-size="narrow"] .pdf-preflight-output-tool-dock .plot-actions,
      .pdf-preflight-output-panel[data-pdf-preflight-output-size="narrow"] .pdf-preflight-output-tool-dock .pdfu-modal-footer,
      .pdf-preflight-output-panel[data-pdf-preflight-output-size="narrow"] .pdf-preflight-output-tool-dock .tool-modal-footer,
      .pdf-preflight-output-panel[data-pdf-preflight-output-size="narrow"] .pdf-preflight-output-tool-dock .tool-modal-actions{flex-direction:column!important;align-items:stretch!important}
      .pdf-preflight-output-panel[data-pdf-preflight-output-size="narrow"] .pdf-preflight-output-tool-dock .pdfic-btn,
      .pdf-preflight-output-panel[data-pdf-preflight-output-size="narrow"] .pdf-preflight-output-tool-dock .pdfaio-btn,
      .pdf-preflight-output-panel[data-pdf-preflight-output-size="narrow"] .pdf-preflight-output-tool-dock .plot-btn,
      .pdf-preflight-output-panel[data-pdf-preflight-output-size="narrow"] .pdf-preflight-output-tool-dock .pdfu-modal-btn,
      .pdf-preflight-output-panel[data-pdf-preflight-output-size="narrow"] .pdf-preflight-output-tool-dock .tm-cancel-btn,
      .pdf-preflight-output-panel[data-pdf-preflight-output-size="narrow"] .pdf-preflight-output-tool-dock .tm-run-btn,
      .pdf-preflight-output-panel[data-pdf-preflight-output-size="narrow"] .pdf-preflight-output-tool-dock .tool-modal-btn{width:100%!important}

      @container (max-width:520px){
        .pdf-preflight-output-tool-dock .pdfic-grid,.pdf-preflight-output-tool-dock .plot-grid,.pdf-preflight-output-tool-dock .plot-size-row,.pdf-preflight-output-tool-dock .plot-mode{grid-template-columns:1fr!important}
        .pdf-preflight-output-tool-dock .pdfic-actions,.pdf-preflight-output-tool-dock .pdfaio-actions,.pdf-preflight-output-tool-dock .plot-actions,.pdf-preflight-output-tool-dock .pdfu-modal-footer,.pdf-preflight-output-tool-dock .tool-modal-footer,.pdf-preflight-output-tool-dock .tool-modal-actions{flex-direction:column!important;align-items:stretch!important}
        .pdf-preflight-output-tool-dock .pdfic-btn,.pdf-preflight-output-tool-dock .pdfaio-btn,.pdf-preflight-output-tool-dock .plot-btn,.pdf-preflight-output-tool-dock .pdfu-modal-btn,.pdf-preflight-output-tool-dock .tm-cancel-btn,.pdf-preflight-output-tool-dock .tm-run-btn,.pdf-preflight-output-tool-dock .tool-modal-btn{width:100%!important}
      }
      @media(max-width:820px){.pdf-preflight-output-tool-dock .tool-modal-box,.pdf-preflight-output-tool-dock .pdfu-modal,.pdf-preflight-output-tool-dock .pdfic-box,.pdf-preflight-output-tool-dock .pdfaio-box,.pdf-preflight-output-tool-dock .plot-box{padding:12px!important}}
    `;
    document.head.appendChild(style);
  }

  function forceWidth(node,minWidth='0'){
    if(!(node instanceof HTMLElement))return;
    node.style.setProperty('width','100%','important');
    node.style.setProperty('inline-size','100%','important');
    node.style.setProperty('min-width',minWidth,'important');
    node.style.setProperty('max-width','none','important');
    node.style.setProperty('box-sizing','border-box','important');
  }

  function placeDock(panel,dock){
    const head=panel.querySelector('.pdf-preflight-output-head')||panel.querySelector(':scope > .panel-head');
    if(head){
      if(head.nextElementSibling!==dock)head.insertAdjacentElement('afterend',dock);
    }else if(panel.firstElementChild!==dock){
      panel.prepend(dock);
    }
  }

  function classifyPanel(panel){
    if(!panel)return;
    const width=panel.getBoundingClientRect().width;
    const size=width<520?'narrow':width<760?'medium':'wide';
    if(panel.dataset.pdfPreflightOutputSize!==size)panel.dataset.pdfPreflightOutputSize=size;
  }

  function ensureDock(){
    const panel=outputPanel();
    if(!panel)return null;
    forceWidth(panel);
    panel.style.setProperty('justify-self','stretch','important');
    panel.style.setProperty('align-self','stretch','important');
    let dock=document.getElementById('pdfPreflightOutputToolDock');
    if(!dock){
      dock=document.createElement('section');
      dock.id='pdfPreflightOutputToolDock';
      dock.className='pdf-preflight-output-tool-dock';
      dock.setAttribute('aria-label','PDF 작업 설정');
    }
    if(dock.parentElement!==panel)panel.appendChild(dock);
    forceWidth(dock);
    dock.style.setProperty('justify-self','stretch','important');
    dock.style.setProperty('align-self','stretch','important');
    placeDock(panel,dock);
    classifyPanel(panel);
    if(!resizeObserver&&typeof ResizeObserver==='function'){
      resizeObserver=new ResizeObserver(entries=>{
        for(const entry of entries){
          if(entry.target===panel){
            classifyPanel(panel);
            forceWidth(dock);
            dock.querySelectorAll(BOX_SELECTOR).forEach(box=>forceWidth(box));
          }
        }
      });
      resizeObserver.observe(panel);
    }
    return dock;
  }

  function isDockable(node){
    return node instanceof HTMLElement&&node.matches(OVERLAY_SELECTOR)&&node.id!=='pdfPreflightOutputToolDock';
  }

  function normalizeOpenOverlays(dock){
    const opened=[...dock.children].filter(node=>node.classList?.contains('open'));
    if(opened.length<=1)return opened[0]||null;
    const keep=lastOpenedOverlay&&opened.includes(lastOpenedOverlay)?lastOpenedOverlay:opened[opened.length-1];
    opened.forEach(node=>{if(node!==keep)node.classList.remove('open');});
    return keep;
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
      forceWidth(node);
      const box=node.querySelector(BOX_SELECTOR);
      if(box)forceWidth(box);
    });

    const activeOverlay=normalizeOpenOverlays(dock);
    const open=Boolean(activeOverlay);
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

  function observeMutations(records){
    for(const record of records||[]){
      if(record.type==='attributes'&&record.attributeName==='class'&&isDockable(record.target)&&record.target.classList.contains('open')){
        lastOpenedOverlay=record.target;
      }
    }
    queueSync();
  }

  function boot(){
    sync();
    if(!observer&&document.body){
      observer=new MutationObserver(observeMutations);
      observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
    }
    [80,220,500,900,1600,2600].forEach(delay=>setTimeout(sync,delay));
    window.PdfPreflightOutputToolDock={sync,stage:'output-panel-tool-dock-fluid-v3'};
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
