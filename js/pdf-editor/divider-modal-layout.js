(function(){
  'use strict';
  if(window.__pdfDividerModalLayoutV2)return;
  window.__pdfDividerModalLayoutV2=true;

  const STYLE_ID='pdfDividerModalLayoutStyleV2';
  const LAYOUT_ID='pdfDividerStudioLayoutV1';
  const CONTROLS_ID='pdfDividerStudioControlsV1';
  const PREVIEW_ID='pdfDividerStudioPreviewV1';

  function installStyles(){
    if(document.getElementById(STYLE_ID))return;
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      #dividerModal.divider-studio-modal .modal-box.pdf-divider-wide-layout{
        width:min(1180px,calc(100vw - 28px))!important;
        max-width:min(1180px,calc(100vw - 28px))!important;
        height:min(92vh,860px)!important;
        max-height:min(92vh,860px)!important;
        margin:auto!important;
      }
      #dividerModal .divider-studio-body#${LAYOUT_ID}{
        grid-template-columns:264px minmax(0,1fr)!important;
        min-height:0;
        flex:1 1 auto;
      }
      #dividerModal #${CONTROLS_ID}{
        min-width:0;
        overflow-y:auto!important;
        overflow-x:hidden!important;
        padding:10px 10px 0!important;
        scrollbar-width:thin;
        scrollbar-color:#cbd5e1 transparent;
      }
      #dividerModal #${CONTROLS_ID} .field{margin-bottom:8px}
      #dividerModal #${CONTROLS_ID} label{font-size:10px}
      #dividerModal #${CONTROLS_ID} input[type="text"],
      #dividerModal #${CONTROLS_ID} input[type="number"],
      #dividerModal #${CONTROLS_ID} select{font-size:11px;padding:6px 8px}
      #dividerModal #${CONTROLS_ID} .divider-settings-card{padding:9px;margin-bottom:8px}
      #dividerModal #${CONTROLS_ID} .pdf-div-local{margin-top:8px;padding-top:8px}
      #dividerModal #${CONTROLS_ID} .pdf-div-local-note{line-height:1.35}
      #dividerModal #${CONTROLS_ID} .pdf-div-layer-list{max-height:108px}
      #dividerModal #${CONTROLS_ID} .pdf-div-layer-controls{padding:7px}
      #dividerModal #${CONTROLS_ID} .pdf-div-layer-control{
        grid-template-columns:31px minmax(0,1fr) 36px;
        gap:5px;
        margin-bottom:6px;
      }
      #dividerModal #${CONTROLS_ID} .pdf-div-layer-actions{gap:4px}
      #dividerModal #${CONTROLS_ID} .pdf-div-layer-actions button{padding:5px 6px!important}
      #dividerModal #${PREVIEW_ID}{
        min-width:0;
        min-height:0;
        padding:14px 18px!important;
        background:#edf1f5!important;
      }
      #dividerModal #${PREVIEW_ID} .divider-prev-wrap{
        flex:0 0 auto;
        width:auto!important;
        height:min(76vh,760px)!important;
        max-width:100%!important;
        max-height:100%!important;
        aspect-ratio:210 / 297!important;
        margin:0!important;
        border-radius:7px!important;
        border:1px solid #cbd5e1!important;
        background:#fff!important;
        box-shadow:0 10px 30px rgba(15,23,42,.16)!important;
      }
      #dividerModal #${PREVIEW_ID} .divider-prev-wrap canvas{
        width:100%!important;
        height:100%!important;
        display:block!important;
        object-fit:contain!important;
      }
      #dividerModal #${CONTROLS_ID}>.modal-footer{
        position:sticky!important;
        bottom:0;
        z-index:7;
        display:grid!important;
        grid-template-columns:1fr 1fr!important;
        gap:7px!important;
        margin-top:10px!important;
        padding:10px 0 10px!important;
        border-top:1px solid #e2e8f0!important;
        background:linear-gradient(to bottom,rgba(255,255,255,.92),#fff 24%)!important;
        flex:0 0 auto!important;
      }
      #dividerModal #${CONTROLS_ID}>.modal-footer .btn{
        width:100%!important;
        min-width:0!important;
        padding:8px 7px!important;
        font-size:11px!important;
      }
      @media (max-width:820px){
        #dividerModal.divider-studio-modal .modal-box.pdf-divider-wide-layout{
          width:min(620px,calc(100vw - 12px))!important;
          max-width:min(620px,calc(100vw - 12px))!important;
          height:94vh!important;
          max-height:94vh!important;
        }
        #dividerModal .divider-studio-body#${LAYOUT_ID}{
          grid-template-columns:1fr!important;
          grid-template-rows:minmax(300px,52vh) minmax(240px,1fr)!important;
        }
        #dividerModal #${PREVIEW_ID}{
          grid-row:1;
          padding:10px!important;
        }
        #dividerModal #${PREVIEW_ID} .divider-prev-wrap{
          height:min(48vh,520px)!important;
        }
        #dividerModal #${CONTROLS_ID}{
          grid-row:2;
          padding:10px 10px 0!important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function applyLayout(){
    const modal=document.getElementById('dividerModal');
    const box=modal?.querySelector('.modal-box');
    const body=box?.querySelector('.divider-studio-body');
    const controls=body?.querySelector(':scope > .divider-studio-controls');
    const preview=body?.querySelector(':scope > .divider-studio-preview');
    const localPanel=document.getElementById('pdfDividerLocalImagePanel');
    const footer=box?.querySelector(':scope > .modal-footer')||controls?.querySelector(':scope > .modal-footer');

    // divider-studio owns modal construction. Never move its source DOM before
    // the studio body exists; doing so creates an order-dependent detached modal.
    if(!modal||!box||!body||!controls||!preview||!footer||!localPanel)return false;

    installStyles();

    if(!body.id)body.id=LAYOUT_ID;
    else if(body.id!==LAYOUT_ID)body.dataset.dividerLayoutId=LAYOUT_ID;
    if(!controls.id)controls.id=CONTROLS_ID;
    else if(controls.id!==CONTROLS_ID)controls.dataset.dividerControlsId=CONTROLS_ID;
    if(!preview.id)preview.id=PREVIEW_ID;
    else if(preview.id!==PREVIEW_ID)preview.dataset.dividerPreviewId=PREVIEW_ID;

    if(localPanel.parentElement!==controls)controls.appendChild(localPanel);
    if(footer.parentElement!==controls)controls.appendChild(footer);

    box.classList.add('pdf-divider-wide-layout');
    box.dataset.dividerLayout='wide-preview-studio-safe';
    modal.dataset.dividerLayoutCompat='studio-v2';
    document.documentElement.dataset.pdfDividerWidePreview='2';
    return true;
  }

  function boot(){
    let observer=null;
    const tryApply=()=>{
      if(!applyLayout())return false;
      observer?.disconnect();
      return true;
    };
    if(tryApply())return;
    observer=new MutationObserver(tryApply);
    observer.observe(document.documentElement,{childList:true,subtree:true});
    window.setTimeout(()=>observer?.disconnect(),12000);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
