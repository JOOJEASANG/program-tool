// Divider editor corrective layer: keep studio renderer authoritative and simplify conflicting UI.
(function(){
  'use strict';
  if(window.__pdfDividerUiCorrectionsV1)return;
  window.__pdfDividerUiCorrectionsV1=true;

  const $=id=>document.getElementById(id);
  let styleBound=false;
  let shapeBound=false;

  function requestPreview(){
    try{ if(typeof window.updateDividerPreview==='function') window.updateDividerPreview(); }
    catch(error){ console.warn('[divider-corrections] preview refresh failed',error); }
  }

  function simplifyUi(){
    // The legacy vertical-position block sits directly under the style buttons and
    // duplicates the newer direct-preview positioning controls. Keep its inputs in
    // the DOM for saved-document compatibility, but remove it from the visible UI.
    const valign=$('dividerVAlignRow');
    const positionField=valign?.closest('.field');
    if(positionField){
      positionField.style.display='none';
      positionField.dataset.dividerLegacyTextPositionHidden='true';
    }

    // Background-style presets were added as an extra studio card. The normal
    // background/no-background controls remain available; new/edited content now
    // falls back to the studio's solid background mode because the grid is absent.
    const backgroundCard=$('dividerBackgroundStudioCard');
    if(backgroundCard) backgroundCard.remove();

    document.documentElement.dataset.pdfDividerBackgroundStyleUi='removed';
    document.documentElement.dataset.pdfDividerLegacyTextPositionUi='hidden';
  }

  function bindStyles(){
    const row=$('dividerStyleRow');
    if(!row||row.dataset.dividerStyleCorrectionBound==='true')return false;
    row.dataset.dividerStyleCorrectionBound='true';
    row.addEventListener('click',event=>{
      const button=event.target.closest?.('[data-style]');
      if(!button||!row.contains(button))return;
      row.querySelectorAll('[data-style]').forEach(entry=>entry.classList.toggle('active',entry===button));
      requestAnimationFrame(requestPreview);
    },true);
    styleBound=true;
    return true;
  }

  function dispatchInput(control,value){
    if(!control)return;
    control.value=String(value);
    control.dispatchEvent(new Event('input',{bubbles:true}));
    control.dispatchEvent(new Event('change',{bubbles:true}));
  }

  function makeTitleBoxesVisible(){
    let changed=false;
    document.querySelectorAll('#dividerShapeList .divider-shape-card').forEach(card=>{
      const name=String(card.querySelector('.divider-extra-name')?.textContent||'');
      if(!name.includes('타이틀 박스'))return;
      const fill=card.querySelector('[data-key="fill"]');
      const stroke=card.querySelector('[data-key="stroke"]');
      const strokeWidth=card.querySelector('[data-key="strokeWidth"]');
      const opacity=card.querySelector('[data-key="opacity"]');
      const invisible=String(fill?.value||'').toLowerCase()==='#ffffff' &&
        String(stroke?.value||'').toLowerCase()==='#ffffff' && Number(strokeWidth?.value||0)===0;
      if(!invisible)return;
      dispatchInput(fill,'#dbeafe');
      dispatchInput(stroke,'#2563eb');
      dispatchInput(strokeWidth,'1');
      dispatchInput(opacity,'0.72');
      changed=true;
    });
    if(changed)requestAnimationFrame(requestPreview);
    return changed;
  }

  function bindShapes(){
    const list=$('dividerShapeList');
    const card=list?.closest('.divider-settings-card');
    if(!card||card.dataset.dividerShapeCorrectionBound==='true')return false;
    card.dataset.dividerShapeCorrectionBound='true';
    card.addEventListener('click',event=>{
      const addButton=event.target.closest?.('[data-add-shape]');
      const actionButton=event.target.closest?.('[data-action]');
      if(!addButton&&!actionButton)return;
      requestAnimationFrame(()=>requestAnimationFrame(()=>{
        if(addButton?.dataset?.addShape==='titleBox')makeTitleBoxesVisible();
        requestPreview();
      }));
    },true);
    card.addEventListener('input',()=>requestAnimationFrame(requestPreview),true);
    card.addEventListener('change',()=>requestAnimationFrame(requestPreview),true);
    shapeBound=true;
    return true;
  }

  function hasLocalImages(content){
    return Boolean(
      (Array.isArray(content?.localImageLayers)&&content.localImageLayers.length) ||
      content?.localImageDataUrl
    );
  }

  function reassertStudioRenderer(){
    const studio=window.PdfDividerStudio;
    if(!studio||typeof studio.boot!=='function'||typeof window.renderDividerCanvas!=='function')return false;

    // divider-helper and the local-image module can both wrap renderDividerCanvas.
    // Because those modules are loaded in parallel, a late legacy wrapper can
    // replace the studio renderer and make extended styles/shape layers disappear.
    // Re-run only the studio renderer patch, leaving content/open/edit wrappers intact.
    window.__pdfDividerStudioRenderPatchedV3=false;
    try{ studio.boot(); }catch(error){
      console.warn('[divider-corrections] studio renderer restore failed',error);
      return false;
    }

    const studioRender=window.renderDividerCanvas;
    if(typeof studioRender!=='function')return false;
    const localApi=window.PdfDividerLocalImageUpload;

    // Preserve the existing local-image preview behavior while preventing its
    // scheduled retry from replacing the restored studio renderer for normal pages.
    const corrected=function(content,width,height){
      if(hasLocalImages(content)&&localApi&&typeof localApi.renderLocalDivider==='function'){
        return localApi.renderLocalDivider(content,width,height);
      }
      return studioRender(content,width,height);
    };
    corrected.__localImageV1=true;
    corrected.__localImageLayersV2=true;
    corrected.__dividerStudioAuthoritativeV1=true;
    window.renderDividerCanvas=corrected;

    document.documentElement.dataset.pdfDividerRendererOwner='studio-corrected-v1';
    requestAnimationFrame(requestPreview);
    return true;
  }

  function apply(){
    simplifyUi();
    bindStyles();
    bindShapes();
    makeTitleBoxesVisible();
    const restored=reassertStudioRenderer();
    if(restored&&styleBound&&shapeBound){
      document.documentElement.dataset.pdfDividerUiCorrections='ready';
      return true;
    }
    return false;
  }

  function boot(){
    let pass=0;
    const delays=[0,120,320,700,1200,1900,2800,3900];
    delays.forEach(delay=>setTimeout(()=>{
      pass+=1;
      apply();
      if(pass===delays.length)document.documentElement.dataset.pdfDividerUiCorrectionsPasses=String(pass);
    },delay));
  }

  window.PdfDividerUiCorrections={apply,reassertStudioRenderer,makeTitleBoxesVisible,stage:'divider-ui-corrections-v1-style-shape-preview'};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
