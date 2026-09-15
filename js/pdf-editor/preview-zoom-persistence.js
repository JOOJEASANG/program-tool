// Keeps a user-selected PDF preview zoom fixed across lazy page/window renders.
(function(){
  'use strict';
  if(window.__pdfPreviewZoomPersistenceV2)return;
  window.__pdfPreviewZoomPersistenceV2=true;
  const smokeHost=document.documentElement.dataset.pdfPreviewZoomPersistenceHost==='1';
  if(!location.pathname.includes('pdf-editor')&&!smokeHost)return;

  const INSTALL_DELAYS=[0,120,280,520,900,1500,2400,3800,6000];
  let userPinned=false;
  let pinnedZoom=null;
  let explicitAutoFit=false;
  let wrappedDisplay=null;

  function readZoom(){
    try{
      const value=Number(_previewZoom);
      return Number.isFinite(value)&&value>0?value:null;
    }catch(_){return null;}
  }

  function writeZoom(value){
    const zoom=Number(value);
    if(!Number.isFinite(zoom)||zoom<=0)return false;
    try{_previewZoom=zoom;return true;}catch(_){return false;}
  }

  function capturePinnedZoom(){
    const current=readZoom();
    if(current!==null)pinnedZoom=current;
    userPinned=true;
    document.documentElement.dataset.pdfPreviewZoomPinned='1';
    if(pinnedZoom!==null)document.documentElement.dataset.pdfPreviewZoomValue=String(pinnedZoom);
  }

  function markPinned(){
    userPinned=true;
    const current=readZoom();
    if(current!==null)pinnedZoom=current;
    document.documentElement.dataset.pdfPreviewZoomPinned='1';
  }

  function calculateViewportFit(){
    const scroll=document.getElementById('previewScroll');
    let pages=[];
    let perRow=1;
    let baseHeight=280;
    try{pages=Array.isArray(previewCanvases)?previewCanvases:[];}catch(_){}
    try{perRow=Math.max(1,Number(_previewPerRow)||1);}catch(_){}
    try{baseHeight=Math.max(1,Number(ZOOM_BASE_H)||280);}catch(_){}
    const canvas=pages[0];
    if(!scroll||!canvas||!canvas.width||!canvas.height)return null;

    const availW=Math.max(1,scroll.clientWidth-24);
    const availH=Math.max(1,scroll.clientHeight-24);
    const totalInsert=perRow>1?(perRow-1)*28:0;
    const totalGap=perRow>1?(2*perRow-2)*8:0;
    const slotW=perRow<=1?availW:(availW-totalInsert-totalGap)/perRow;
    if(slotW<=0)return null;
    const basePageW=baseHeight*(canvas.width/canvas.height);
    const widthFit=slotW/basePageW;
    const heightFit=availH/baseHeight;
    const zoom=Math.min(widthFit,heightFit);
    if(!Number.isFinite(zoom)||zoom<=0)return null;
    return Math.max(.1,Math.min(3,zoom));
  }

  function fitToViewport(){
    const fit=calculateViewportFit();
    if(fit===null)return false;
    writeZoom(fit);
    pinnedZoom=fit;
    userPinned=true;
    document.documentElement.dataset.pdfPreviewZoomPinned='1';
    document.documentElement.dataset.pdfPreviewZoomValue=String(fit);
    try{
      if(Array.isArray(previewCanvases)&&previewCanvases.length&&typeof displayPreview==='function')displayPreview(previewCanvases,false);
      else if(typeof updateZoomLabel==='function')updateZoomLabel();
    }catch(error){console.warn('[preview-zoom] fit render failed',error);}
    return true;
  }

  function onZoomControl(event){
    const control=event.target?.closest?.('#zoomInBtn,#zoomOutBtn,#zoomResetBtn');
    if(!control)return;
    if(control.id==='zoomResetBtn'){
      event.preventDefault();
      event.stopImmediatePropagation();
      fitToViewport();
      return;
    }
    markPinned();
    queueMicrotask(capturePinnedZoom);
  }

  function wrapDisplayPreview(){
    let current=null;
    try{current=displayPreview;}catch(_){}
    if(typeof current!=='function')current=window.displayPreview;
    if(typeof current!=='function')return false;
    if(current.__pdfPreviewZoomPersistenceV2){wrappedDisplay=current;return true;}

    const original=current;
    const guarded=function stickyPreviewZoom(pages,autoFit){
      const requestedAutoFit=!!autoFit;
      const explicit=explicitAutoFit;
      if(explicit)explicitAutoFit=false;
      if(userPinned&&!explicit&&pinnedZoom!==null)writeZoom(pinnedZoom);
      const effectiveAutoFit=requestedAutoFit&&(!userPinned||explicit);
      const result=original.call(this,pages,effectiveAutoFit);
      if(userPinned&&!explicit&&pinnedZoom!==null)writeZoom(pinnedZoom);
      return result;
    };
    guarded.__pdfPreviewZoomPersistenceV2=true;
    guarded.__pdfPreviewZoomPersistenceOriginal=original;
    try{displayPreview=guarded;}catch(_){}
    window.displayPreview=guarded;
    wrappedDisplay=guarded;
    return true;
  }

  function updateFitButton(){
    const button=document.getElementById('zoomResetBtn');
    if(!button)return;
    button.textContent='화면 맞춤';
    button.title='미리보기를 현재 화면에 맞춤';
    button.setAttribute('aria-label','미리보기 화면 맞춤');
  }

  function install(){
    wrapDisplayPreview();
    updateFitButton();
    if(document.documentElement.dataset.pdfPreviewZoomPersistenceEvents==='2')return;
    document.documentElement.dataset.pdfPreviewZoomPersistenceEvents='2';
    // Capture before the editor target handlers. The fit control intentionally owns
    // the old reset button so it can fit both width and available viewport height.
    document.addEventListener('click',onZoomControl,true);
  }

  window.PdfPreviewZoomPersistence={
    isPinned:()=>userPinned,
    getPinnedZoom:()=>pinnedZoom,
    pin:capturePinnedZoom,
    fitToViewport,
    calculateViewportFit,
    wrapDisplayPreview,
    install,
    stage:'user-selected-preview-zoom-sticky-fit-v2'
  };

  for(const delay of INSTALL_DELAYS)setTimeout(install,delay);
})();
