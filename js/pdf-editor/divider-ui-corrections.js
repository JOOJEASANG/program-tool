// Divider editor corrective layer: keep studio renderer authoritative and improve editor UX.
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

  function installUxStyles(){
    if($('pdfDividerUxStyles'))return true;
    const style=document.createElement('style');
    style.id='pdfDividerUxStyles';
    style.textContent=`
      #dividerModal.divider-studio-modal{padding:10px!important;background:rgba(15,23,42,.78)!important}
      #dividerModal.divider-studio-modal .modal-box{border-radius:16px!important;box-shadow:0 24px 70px rgba(15,23,42,.28)!important}
      #dividerModal .modal-head{min-height:54px!important;padding:0 18px!important;display:flex!important;align-items:center!important;gap:10px!important;font-size:15px!important;font-weight:900!important;color:#0f172a!important;background:#fff!important;border-bottom:1px solid #e2e8f0!important}
      #dividerModal .modal-head #dividerModalClose{margin-left:auto!important;border:1px solid #cbd5e1!important;border-radius:9px!important;background:#fff!important;color:#475569!important;min-width:64px!important;min-height:34px!important;font-weight:800!important;cursor:pointer!important}
      #dividerModal .modal-head #dividerModalClose:hover{background:#f8fafc!important;border-color:#94a3b8!important;color:#0f172a!important}
      #dividerModal .divider-studio-body{grid-template-columns:clamp(480px,42vw,640px) minmax(0,1fr)!important;background:#eef2f7!important}
      #dividerModal .divider-studio-controls{padding:16px 18px 28px!important;background:#f8fafc!important;border-right:1px solid #dbe3ec!important;scrollbar-gutter:stable!important}
      #dividerModal .divider-studio-preview{position:relative!important;padding:30px 24px 24px!important;background:linear-gradient(145deg,#e7edf4 0%,#f3f6fa 100%)!important}
      #dividerModal .divider-studio-preview::before{content:'실시간 미리보기';position:absolute;top:10px;left:16px;padding:4px 8px;border-radius:999px;background:rgba(255,255,255,.88);border:1px solid #d9e2ec;color:#64748b;font-size:10px;font-weight:900;letter-spacing:.02em;box-shadow:0 2px 8px rgba(15,23,42,.05)}
      #dividerModal .divider-prev-wrap{width:min(72vh,94%)!important;max-width:720px!important;border:1px solid rgba(148,163,184,.45)!important;border-radius:3px!important;box-shadow:0 16px 38px rgba(15,23,42,.18)!important}
      #dividerModal .divider-quick-nav{position:sticky;top:-16px;z-index:8;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;margin:-2px -2px 12px;padding:10px 2px 9px;background:linear-gradient(#f8fafc 78%,rgba(248,250,252,.90));backdrop-filter:blur(8px)}
      #dividerModal .divider-quick-nav button{min-height:34px;border:1px solid #d9e2ec;border-radius:9px;background:#fff;color:#475569;font-size:10px;font-weight:900;cursor:pointer;transition:border-color .12s,background .12s,color .12s,transform .12s}
      #dividerModal .divider-quick-nav button:hover{border-color:#93c5fd;background:#eff6ff;color:#1d4ed8;transform:translateY(-1px)}
      #dividerModal .divider-settings-card{padding:14px!important;margin-bottom:12px!important;border:1px solid #dce5ee!important;border-radius:12px!important;background:#fff!important;box-shadow:0 2px 10px rgba(15,23,42,.035)!important}
      #dividerModal .divider-settings-title{font-size:12px!important;font-weight:900!important;color:#1e293b!important;margin-bottom:9px!important;letter-spacing:-.01em!important}
      #dividerModal .divider-studio-controls>.field{margin:0 0 10px!important;padding:10px 12px!important;border:1px solid #e2e8f0!important;border-radius:10px!important;background:#fff!important}
      #dividerModal .divider-studio-controls>.field>label{display:block!important;margin-bottom:6px!important;color:#475569!important;font-size:10px!important;font-weight:900!important}
      #dividerModal .divider-studio-controls input[type="text"],#dividerModal .divider-studio-controls input[type="number"],#dividerModal .divider-studio-controls textarea,#dividerModal .divider-studio-controls select{min-height:36px!important;border:1px solid #cbd5e1!important;border-radius:8px!important;background:#fff!important;padding:7px 9px!important;box-sizing:border-box!important;outline:none!important}
      #dividerModal .divider-studio-controls input[type="text"]:focus,#dividerModal .divider-studio-controls input[type="number"]:focus,#dividerModal .divider-studio-controls textarea:focus,#dividerModal .divider-studio-controls select:focus{border-color:#60a5fa!important;box-shadow:0 0 0 3px rgba(59,130,246,.09)!important}
      #dividerModal .divider-studio-controls input[type="color"]{width:52px!important;height:34px!important;padding:2px!important;border:1px solid #cbd5e1!important;border-radius:8px!important;background:#fff!important;cursor:pointer!important}
      #dividerModal #dividerStyleRow{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:7px!important}
      #dividerModal #dividerStyleRow .style-btn{min-height:40px!important;border:1px solid #cbd5e1!important;border-radius:9px!important;background:#fff!important;color:#475569!important;font-size:11px!important;font-weight:900!important;cursor:pointer!important;box-shadow:none!important;transition:background .12s,border-color .12s,color .12s,transform .12s!important}
      #dividerModal #dividerStyleRow .style-btn:hover{border-color:#93c5fd!important;background:#f8fbff!important;color:#1d4ed8!important;transform:translateY(-1px)!important}
      #dividerModal #dividerStyleRow .style-btn.active{border-color:#2563eb!important;background:#eff6ff!important;color:#1d4ed8!important;box-shadow:inset 0 0 0 1px rgba(37,99,235,.12)!important}
      #dividerModal .divider-layer-button-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:7px!important}
      #dividerModal .divider-add-text-btn,#dividerModal .divider-add-shape-btn{min-height:39px!important;border-radius:9px!important;font-size:10px!important;transition:background .12s,border-color .12s,transform .12s!important}
      #dividerModal .divider-add-text-btn:hover,#dividerModal .divider-add-shape-btn:hover{transform:translateY(-1px)!important}
      #dividerModal .divider-extra-list,#dividerModal .divider-shape-list{gap:10px!important}
      #dividerModal .divider-extra-card,#dividerModal .divider-shape-card{padding:11px!important;border-radius:10px!important;background:#fff!important;box-shadow:0 1px 5px rgba(15,23,42,.04)!important}
      #dividerModal .divider-extra-actions button{min-height:27px!important;padding:4px 7px!important;border-radius:7px!important;background:#fff!important}
      #dividerModal .divider-extra-grid{gap:8px!important}
      #dividerModal .divider-extra-grid label{font-size:9px!important;font-weight:800!important;color:#64748b!important}
      #dividerModal .modal-footer{min-height:54px!important;padding:9px 18px!important;box-shadow:0 -4px 14px rgba(15,23,42,.035)!important}
      #dividerModal .modal-footer button{min-height:36px!important;border-radius:9px!important;padding:0 16px!important;font-weight:900!important}
      @media(max-width:1050px){#dividerModal .divider-studio-body{grid-template-columns:minmax(440px,48%) minmax(0,52%)!important}#dividerModal .divider-studio-controls{padding-left:14px!important;padding-right:14px!important}}
      @media(max-width:850px){#dividerModal.divider-studio-modal{padding:4px!important}#dividerModal .divider-studio-body{grid-template-columns:1fr!important;grid-template-rows:minmax(300px,54%) minmax(240px,46%)!important}#dividerModal .divider-studio-controls{border-right:0!important;border-bottom:1px solid #dbe3ec!important}#dividerModal .divider-preview-wrap{width:min(40vh,90%)!important}#dividerModal .divider-quick-nav{top:-16px}}
    `;
    document.head.appendChild(style);
    document.documentElement.dataset.pdfDividerUx='enhanced-v2';
    return true;
  }

  function quickNavTarget(key,sidebar){
    if(key==='basic')return $('dividerTitle')?.closest('.field')||sidebar.querySelector('.divider-settings-card');
    if(key==='style')return $('dividerStyleRow')?.closest('.field');
    if(key==='shape')return $('dividerShapeList')?.closest('.divider-settings-card');
    if(key==='text')return $('dividerExtraList')?.closest('.divider-settings-card');
    return null;
  }

  function installQuickNav(){
    const sidebar=document.querySelector('#dividerModal .divider-studio-controls');
    if(!sidebar)return false;
    sidebar.dataset.dividerSidebarWide='true';
    if($('dividerQuickNav'))return true;
    const nav=document.createElement('div');
    nav.id='dividerQuickNav';
    nav.className='divider-quick-nav';
    nav.setAttribute('aria-label','간지 편집 빠른 이동');
    nav.innerHTML='<button type="button" data-divider-jump="basic">기본</button><button type="button" data-divider-jump="style">스타일</button><button type="button" data-divider-jump="shape">도형</button><button type="button" data-divider-jump="text">텍스트</button>';
    nav.addEventListener('click',event=>{
      const button=event.target.closest?.('[data-divider-jump]');
      if(!button||!nav.contains(button))return;
      const target=quickNavTarget(button.dataset.dividerJump,sidebar);
      if(!target)return;
      target.scrollIntoView({behavior:'smooth',block:'start'});
      setTimeout(()=>{ sidebar.scrollTop=Math.max(0,sidebar.scrollTop-54); },180);
    });
    sidebar.prepend(nav);
    return true;
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
    installUxStyles();
    simplifyUi();
    installQuickNav();
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

  window.PdfDividerUiCorrections={apply,reassertStudioRenderer,makeTitleBoxesVisible,installQuickNav,stage:'divider-ui-corrections-v2-wide-sidebar-ux'};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
