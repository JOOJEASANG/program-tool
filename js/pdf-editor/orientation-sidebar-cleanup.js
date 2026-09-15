// Ordinary PDF layout editor: preserve the PDF's visible orientation, never auto-rotate for fit,
// and keep the page sidebar compact. User-requested rotation stays a separate delta.
(function(){
  'use strict';
  if(window.__pdfOrientationSidebarCleanupV2)return;
  window.__pdfOrientationSidebarCleanupV2=true;

  const smokeHost=document.documentElement.dataset.pdfOrientationSidebarCleanupHost==='1';
  if(!String(location.pathname||'').includes('pdf-editor')&&!smokeHost)return;

  const INSTALL_DELAYS=[0,80,180,360,700,1200,2200,3800,6000];
  const byId=id=>document.getElementById(id);
  let renderWrapper=null;
  let safetyWrapper=null;
  let safetyOwner=null;
  let drawWrapper=null;
  let apiWrapper=null;
  let observer=null;
  let syncQueued=false;

  function normalizedRotation(value){
    const number=Number(value);
    if(!Number.isFinite(number))return 0;
    const rotation=((Math.round(number/90)*90)%360+360)%360;
    return[0,90,180,270].includes(rotation)?rotation:0;
  }

  function intrinsicRotation(pdfPage){
    return normalizedRotation(pdfPage?.rotate);
  }

  function effectiveRotation(pdfPage,requested){
    return normalizedRotation(intrinsicRotation(pdfPage)+normalizedRotation(requested));
  }

  function editorPages(){
    try{return Array.isArray(parsedPages)?parsedPages:[];}catch(_){return[];}
  }

  function noteUserRotation(pdfPage,requested){
    const angle=normalizedRotation(requested);
    editorPages().forEach(page=>{
      if(page?.pdfPage!==pdfPage)return;
      // Initial import renders before the page enters parsedPages. A matching page
      // therefore means this is an explicit rerender of an existing editor page.
      if(angle!==0||page.pageRotationLocked||page.rotationLocked){
        page.pageRotationLocked=true;
      }
    });
  }

  function markCanvas(canvas,pdfPage,requested){
    if(!canvas?.dataset)return canvas;
    const intrinsic=intrinsicRotation(pdfPage);
    const user=normalizedRotation(requested);
    const effective=normalizedRotation(intrinsic+user);
    canvas.dataset.pdfIntrinsicSourceRotation=String(intrinsic);
    canvas.dataset.pdfRequestedRotation=String(user);
    canvas.dataset.pdfEffectiveSourceRotation=String(effective);
    canvas.dataset.pdfAutoFitRotation='disabled';
    return canvas;
  }

  function unwrapRenderer(current){
    return current?.__pdfOrientationParityOriginal
      || current?.__pdfCanonicalRotationOriginal
      || current;
  }

  function preserveWrapperMarkers(target,current,raw){
    // Keep the legacy ownership marker so an older compatibility guard does not
    // wrap this renderer again and force the source back to rotation 0.
    target.__pdfCanonicalRotationSourceV1=true;
    target.__pdfCanonicalRotationOriginal=raw;
    target.__pdfIntrinsicRotationSourceV1=true;
    target.__pdfOrientationParityV2=true;
    target.__pdfOrientationParityOriginal=raw;
    if(current?.__pdfNupPageAdjustWrappedV1){
      target.__pdfNupPageAdjustWrappedV1=true;
      target.__pdfNupPageAdjustOriginal=current.__pdfNupPageAdjustOriginal||raw;
    }
    return target;
  }

  function installRenderWrapper(){
    const current=window.renderPdfPage;
    if(typeof current!=='function')return false;
    if(current===renderWrapper||current.__pdfOrientationParityV2){
      renderWrapper=current;
      return true;
    }
    const raw=unwrapRenderer(current);
    const wrapped=async function orientationParityRender(pdfPage,scale,rotation){
      const requested=normalizedRotation(rotation);
      noteUserRotation(pdfPage,requested);
      // pdf.js accepts an explicit rotation. Render exactly the PDF's intrinsic
      // orientation plus the user's delta; never add a fit-based quarter turn.
      const canvas=await raw.call(this,pdfPage,scale,effectiveRotation(pdfPage,requested));
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
    if((current===safetyWrapper&&safety===safetyOwner)||current.__pdfOrientationParityV2){
      safetyWrapper=current;
      safetyOwner=safety;
      return true;
    }
    const raw=unwrapRenderer(current);
    const wrapped=async function orientationParitySafetyRender(pdfPage,scale,rotation,heavyMode){
      const requested=normalizedRotation(rotation);
      noteUserRotation(pdfPage,requested);
      const canvas=await raw.call(safety,pdfPage,scale,effectiveRotation(pdfPage,requested),heavyMode);
      return markCanvas(canvas,pdfPage,requested);
    };
    preserveWrapperMarkers(wrapped,current,raw);
    safety.safeRenderPdfPage=wrapped;
    safetyWrapper=wrapped;
    safetyOwner=safety;
    return true;
  }

  function drawPdfSourceWithoutAutoRotation(ctx,src,cellX,cellY,cellW,cellH){
    const pw=Math.max(1,Number(src?.width)||1);
    const ph=Math.max(1,Number(src?.height)||1);
    const scale=Math.min(cellW/pw,cellH/ph);
    const dw=pw*scale;
    const dh=ph*scale;
    const dx=cellX+(cellW-dw)/2;
    const dy=cellY+(cellH-dh)/2;
    ctx.drawImage(src,dx,dy,dw,dh);
    let border=false;
    try{border=!!showBorder;}catch(_){}
    if(border){
      ctx.strokeStyle='rgba(0,0,0,0.15)';
      ctx.lineWidth=Math.max(.4,cellW*.002);
      ctx.strokeRect(dx,dy,dw,dh);
    }
    return{rotated:false,dx,dy,dw,dh};
  }

  function installDrawWrapper(){
    let current=null;
    try{current=window.drawPageInCell||drawPageInCell;}catch(_){current=window.drawPageInCell;}
    if(typeof current!=='function')return false;
    if(current===drawWrapper||current.__pdfNoAutoFitRotationV2){
      drawWrapper=current;
      return true;
    }
    const original=current;
    const wrapped=function noAutoFitQuarterTurn(ctx,src,cellX,cellY,cellW,cellH){
      // Only PDF canvases rendered by this helper are affected. Blank/divider
      // pages and any unrelated custom source keep their existing behavior.
      if(src?.dataset?.pdfAutoFitRotation==='disabled'){
        return drawPdfSourceWithoutAutoRotation(ctx,src,cellX,cellY,cellW,cellH);
      }
      return original.apply(this,arguments);
    };
    wrapped.__pdfNoAutoFitRotationV2=true;
    wrapped.__pdfNoAutoFitRotationOriginal=original;
    window.drawPageInCell=wrapped;
    try{drawPageInCell=wrapped;}catch(_){}
    drawWrapper=wrapped;
    return true;
  }

  function enrichOutputSettings(settings){
    if(!settings||typeof settings!=='object'||!Array.isArray(settings.pages))return settings;
    const sourcePages=editorPages();
    settings.pages=settings.pages.map((entry,index)=>{
      const page=sourcePages[index];
      if(!page||page.pageType!=='pdf'||!page.pdfPage)return entry;
      // The backend normalizes source /Rotate to zero before placement. Send the
      // exact visible orientation as a locked rotation so _best_fit_rotation()
      // cannot silently add another clockwise quarter turn during final export.
      return{
        ...entry,
        rotation:effectiveRotation(page.pdfPage,page.rotation),
        rotation_locked:true,
      };
    });
    return settings;
  }

  function installApiWrapper(){
    const current=window.apiProcessPdf;
    if(typeof current!=='function')return false;
    if(current===apiWrapper||current.__pdfOrientationParityOutputV2){
      apiWrapper=current;
      return true;
    }
    const original=current;
    const wrapped=function orientationParityOutput(files,settings,options){
      return original.call(this,files,enrichOutputSettings(settings),options);
    };
    wrapped.__pdfOrientationParityOutputV2=true;
    wrapped.__pdfOrientationParityOutputOriginal=original;
    window.apiProcessPdf=wrapped;
    try{apiProcessPdf=wrapped;}catch(_){}
    apiWrapper=wrapped;
    return true;
  }

  function installStyles(){
    if(byId('pdfOrientationSidebarCleanupStylesV1'))return;
    const style=document.createElement('style');
    style.id='pdfOrientationSidebarCleanupStylesV1';
    style.textContent=`
      #pdfFileNavigation{display:none!important}
      #pageProductivityPanelV3 .page-selection-count,
      #pageProductivityPanelV3 .page-productivity-jump,
      #pageProductivityPanelV3 .page-productivity-actions{display:none!important}
      #pageProductivityPanelV3{padding:8px!important;margin-bottom:8px!important}
      #pageProductivityPanelV3 .page-productivity-top{display:flex!important;align-items:center!important;gap:5px!important}
      #pageProductivityPanelV3 .page-productivity-top>button{flex:0 0 auto!important}
    `;
    document.head.appendChild(style);
  }

  function setTextIfNeeded(node,text){
    if(node&&String(node.textContent||'').trim()!==text)node.textContent=text;
  }

  function markSidebarState(){
    const fileNav=byId('pdfFileNavigation');
    if(fileNav){
      if(fileNav.getAttribute('aria-hidden')!=='true')fileNav.setAttribute('aria-hidden','true');
      if(fileNav.dataset.retiredFromLayout!=='1')fileNav.dataset.retiredFromLayout='1';
    }
    const panel=byId('pageProductivityPanelV3');
    if(panel){
      if(panel.dataset.compactSelectionOnly!=='1')panel.dataset.compactSelectionOnly='1';
      setTextIfNeeded(byId('pageSelectionModeBtnV3'),'다중 선택');
      const buttons=panel.querySelectorAll('.page-productivity-top button');
      setTextIfNeeded(buttons[1],'전체');
      setTextIfNeeded(buttons[2],'해제');
    }
    if(document.documentElement.dataset.pdfFileNavigationPanel!=='retired')document.documentElement.dataset.pdfFileNavigationPanel='retired';
    if(document.documentElement.dataset.pdfPageSelectionToolbar!=='compact-three')document.documentElement.dataset.pdfPageSelectionToolbar='compact-three';
    document.documentElement.dataset.pdfAutoFitRotation='disabled';
  }

  function sync(){
    syncQueued=false;
    installStyles();
    installRenderWrapper();
    installSafetyWrapper();
    installDrawWrapper();
    installApiWrapper();
    markSidebarState();
  }

  function scheduleSync(){
    if(syncQueued)return;
    syncQueued=true;
    setTimeout(sync,0);
  }

  function installObserver(){
    if(observer||!document.body)return;
    observer=new MutationObserver(scheduleSync);
    observer.observe(document.body,{childList:true,subtree:true});
  }

  function install(){
    sync();
    installObserver();
    INSTALL_DELAYS.forEach(delay=>setTimeout(sync,delay));
    document.addEventListener('pdf-import-committed',scheduleSync);
    window.addEventListener('pageshow',scheduleSync);
    document.documentElement.dataset.pdfOrientationSidebarCleanup='2';
  }

  window.PdfOrientationSidebarCleanup={
    install,
    sync,
    intrinsicRotation,
    effectiveRotation,
    enrichOutputSettings,
    stage:'pdf-visible-orientation-no-auto-fit-v2'
  };

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();
})();
