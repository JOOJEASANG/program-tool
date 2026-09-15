// Ordinary PDF layout editor: preserve intrinsic PDF rotation and keep the page sidebar compact.
(function(){
  'use strict';
  if(window.__pdfOrientationSidebarCleanupV1)return;
  window.__pdfOrientationSidebarCleanupV1=true;

  const smokeHost=document.documentElement.dataset.pdfOrientationSidebarCleanupHost==='1';
  if(!String(location.pathname||'').includes('pdf-editor')&&!smokeHost)return;

  const INSTALL_DELAYS=[0,80,180,360,700,1200,2200,3800,6000];
  const byId=id=>document.getElementById(id);
  let renderWrapper=null;
  let safetyWrapper=null;
  let safetyOwner=null;
  let observer=null;

  function normalizedRotation(value){
    const number=Number(value);
    if(!Number.isFinite(number))return 0;
    const rotation=((Math.round(number/90)*90)%360+360)%360;
    return[0,90,180,270].includes(rotation)?rotation:0;
  }

  function intrinsicRotation(pdfPage){
    return normalizedRotation(pdfPage?.rotate);
  }

  function editorPages(){
    try{return Array.isArray(parsedPages)?parsedPages:[];}catch(_){return[];}
  }

  function noteUserRotation(pdfPage,requested){
    const angle=normalizedRotation(requested);
    editorPages().forEach(page=>{
      if(page?.pdfPage!==pdfPage)return;
      // Initial import renders before the page enters parsedPages, so a matching
      // page here means this is a rerender of an existing editor page. Preserve
      // explicit rotation intent, including a later return to 0 degrees.
      if(angle!==0||page.pageRotationLocked||page.rotationLocked){
        page.pageRotationLocked=true;
      }
    });
  }

  function markCanvas(canvas,pdfPage,requested){
    if(!canvas?.dataset)return canvas;
    // The source is canonical from the editor's point of view: the PDF's own
    // /Rotate is already baked in, while user rotation remains a separate delta.
    canvas.dataset.pdfCanonicalSourceRotation='0';
    canvas.dataset.pdfIntrinsicSourceRotation=String(intrinsicRotation(pdfPage));
    canvas.dataset.pdfRequestedRotation=String(normalizedRotation(requested));
    return canvas;
  }

  function preserveWrapperMarkers(target,current,raw){
    target.__pdfCanonicalRotationSourceV1=true;
    target.__pdfCanonicalRotationOriginal=raw;
    target.__pdfIntrinsicRotationSourceV1=true;
    if(current?.__pdfNupPageAdjustWrappedV1){
      target.__pdfNupPageAdjustWrappedV1=true;
      target.__pdfNupPageAdjustOriginal=current.__pdfNupPageAdjustOriginal||raw;
    }
    return target;
  }

  function installRenderWrapper(){
    const current=window.renderPdfPage;
    if(typeof current!=='function')return false;
    if(current===renderWrapper||current.__pdfIntrinsicRotationSourceV1){
      renderWrapper=current;
      return true;
    }
    const raw=current.__pdfCanonicalRotationOriginal||current;
    const wrapped=async function intrinsicRotationRender(pdfPage,scale,rotation){
      const requested=normalizedRotation(rotation);
      noteUserRotation(pdfPage,requested);
      const canvas=await raw.call(this,pdfPage,scale,intrinsicRotation(pdfPage));
      return markCanvas(canvas,pdfPage,requested);
    };
    preserveWrapperMarkers(wrapped,current,raw);
    window.renderPdfPage=wrapped;
    try{renderPdfPage=wrapped;}catch(_){}
    renderWrapper=wrapped;
    return true;
  }

  function installSafetyWrapper(){
    const safety=window.PdfImportTransactionSafety;
    const current=safety?.safeRenderPdfPage;
    if(typeof current!=='function')return false;
    if((current===safetyWrapper&&safety===safetyOwner)||current.__pdfIntrinsicRotationSourceV1){
      safetyWrapper=current;
      safetyOwner=safety;
      return true;
    }
    const raw=current.__pdfCanonicalRotationOriginal||current;
    const wrapped=async function intrinsicSafetyRender(pdfPage,scale,rotation,heavyMode){
      const requested=normalizedRotation(rotation);
      noteUserRotation(pdfPage,requested);
      const canvas=await raw.call(safety,pdfPage,scale,intrinsicRotation(pdfPage),heavyMode);
      return markCanvas(canvas,pdfPage,requested);
    };
    preserveWrapperMarkers(wrapped,current,raw);
    safety.safeRenderPdfPage=wrapped;
    safetyWrapper=wrapped;
    safetyOwner=safety;
    return true;
  }

  function installStyles(){
    if(byId('pdfOrientationSidebarCleanupStylesV1'))return;
    const style=document.createElement('style');
    style.id='pdfOrientationSidebarCleanupStylesV1';
    style.textContent=`
      /* The file-navigation helper still decorates file headers, but its bulky
         jump/collapse card is retired from the ordinary layout sidebar. */
      #pdfFileNavigation{display:none!important}

      /* Keep exactly the three requested selection controls visible. */
      #pageProductivityPanelV3 .page-selection-count,
      #pageProductivityPanelV3 .page-productivity-jump,
      #pageProductivityPanelV3 .page-productivity-actions{display:none!important}
      #pageProductivityPanelV3{padding:8px!important;margin-bottom:8px!important}
      #pageProductivityPanelV3 .page-productivity-top{display:flex!important;align-items:center!important;gap:5px!important}
      #pageProductivityPanelV3 .page-productivity-top>button{flex:0 0 auto!important}
    `;
    document.head.appendChild(style);
  }

  function markSidebarState(){
    const fileNav=byId('pdfFileNavigation');
    if(fileNav){
      fileNav.setAttribute('aria-hidden','true');
      fileNav.dataset.retiredFromLayout='1';
    }
    const panel=byId('pageProductivityPanelV3');
    if(panel){
      panel.dataset.compactSelectionOnly='1';
      const mode=byId('pageSelectionModeBtnV3');
      if(mode)mode.textContent='다중 선택';
      const buttons=panel.querySelectorAll('.page-productivity-top button');
      if(buttons[1])buttons[1].textContent='전체';
      if(buttons[2])buttons[2].textContent='해제';
    }
    document.documentElement.dataset.pdfFileNavigationPanel='retired';
    document.documentElement.dataset.pdfPageSelectionToolbar='compact-three';
  }

  function sync(){
    installStyles();
    installRenderWrapper();
    installSafetyWrapper();
    markSidebarState();
  }

  function installObserver(){
    if(observer||!document.body)return;
    observer=new MutationObserver(()=>queueMicrotask(sync));
    observer.observe(document.body,{childList:true,subtree:true});
  }

  function install(){
    sync();
    installObserver();
    INSTALL_DELAYS.forEach(delay=>setTimeout(sync,delay));
    document.addEventListener('pdf-import-committed',sync);
    window.addEventListener('pageshow',sync);
    document.documentElement.dataset.pdfOrientationSidebarCleanup='1';
  }

  window.PdfOrientationSidebarCleanup={
    install,
    sync,
    intrinsicRotation,
    stage:'pdf-intrinsic-rotation-sidebar-compact-v1'
  };

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();
})();
