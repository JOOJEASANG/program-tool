// Keeps a user-selected PDF preview zoom fixed until the user changes it again.
(function(){
  'use strict';
  if(window.__pdfPreviewZoomPersistenceV1)return;
  window.__pdfPreviewZoomPersistenceV1=true;
  const smokeHost=document.documentElement.dataset.pdfPreviewZoomPersistenceHost==='1';
  if(!location.pathname.includes('pdf-editor')&&!smokeHost)return;

  const INSTALL_DELAYS=[0,120,280,520,900,1500,2400,3800,6000];
  let userPinned=false;
  let explicitAutoFit=false;
  let wrappedDisplay=null;

  function markPinned(){
    userPinned=true;
    document.documentElement.dataset.pdfPreviewZoomPinned='1';
  }

  function allowExplicitAutoFitOnce(){
    markPinned();
    explicitAutoFit=true;
    queueMicrotask(()=>{
      explicitAutoFit=false;
    });
  }

  function onZoomControl(event){
    const control=event.target?.closest?.('#zoomInBtn,#zoomOutBtn,#zoomResetBtn');
    if(!control)return;
    if(control.id==='zoomResetBtn')allowExplicitAutoFitOnce();
    else markPinned();
  }

  function wrapDisplayPreview(){
    const current=window.displayPreview;
    if(typeof current!=='function')return false;
    if(current.__pdfPreviewZoomPersistenceV1){
      wrappedDisplay=current;
      return true;
    }

    const original=current;
    const guarded=function stickyPreviewZoom(pages,autoFit){
      const requestedAutoFit=!!autoFit;
      const explicit=explicitAutoFit;
      if(explicit)explicitAutoFit=false;
      const effectiveAutoFit=requestedAutoFit&&(!userPinned||explicit);
      return original.call(this,pages,effectiveAutoFit);
    };
    guarded.__pdfPreviewZoomPersistenceV1=true;
    guarded.__pdfPreviewZoomPersistenceOriginal=original;
    window.displayPreview=guarded;
    try{displayPreview=guarded;}catch(_){}
    wrappedDisplay=guarded;
    return true;
  }

  function install(){
    wrapDisplayPreview();
    if(document.documentElement.dataset.pdfPreviewZoomPersistenceEvents==='1')return;
    document.documentElement.dataset.pdfPreviewZoomPersistenceEvents='1';
    // Capture runs before the editor's target click handlers, so the guard knows
    // whether an auto-fit request came from the user or from a background refresh.
    document.addEventListener('click',onZoomControl,true);
  }

  window.PdfPreviewZoomPersistence={
    isPinned:()=>userPinned,
    pin:markPinned,
    stage:'user-selected-preview-zoom-sticky-v1',
  };

  for(const delay of INSTALL_DELAYS)setTimeout(install,delay);
})();
