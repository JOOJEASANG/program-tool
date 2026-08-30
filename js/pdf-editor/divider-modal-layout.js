(function(){
  'use strict';
  if(window.__pdfDividerModalLayoutV1)return;
  window.__pdfDividerModalLayoutV1=true;

  const STYLE_ID='pdfDividerModalLayoutStyleV1';
  const LAYOUT_ID='pdfDividerStudioLayoutV1';
  const CONTROLS_ID='pdfDividerStudioControlsV1';
  const PREVIEW_ID='pdfDividerStudioPreviewV1';

  function installStyles(){
    if(document.getElementById(STYLE_ID))return;
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      #dividerModal .modal-box.pdf-divider-wide-layout{
        width:min(1180px,calc(100vw - 32px));
        max-width:min(1180px,calc(100vw - 32px));
        max-height:92vh;
        padding:18px;
        overflow:hidden;
      }
      #dividerModal .modal-box.pdf-divider-wide-layout>.modal-head{
        margin-bottom:12px;
      }
      #${LAYOUT_ID}{
        display:grid;
        grid-template-columns:264px minmax(0,1fr);
        gap:16px;
        min-height:0;
        height:min(82vh,820px);
        align-items:stretch;
      }
      #${CONTROLS_ID}{
        min-width:0;
        overflow-y:auto;
        overflow-x:hidden;
        padding:1px 5px 2px 1px;
        scrollbar-width:thin;
        scrollbar-color:#cbd5e1 transparent;
      }
      #${CONTROLS_ID} .field{margin-bottom:8px}
      #${CONTROLS_ID} label{font-size:10px}
      #${CONTROLS_ID} input[type="text"],
      #${CONTROLS_ID} input[type="number"],
      #${CONTROLS_ID} select{font-size:11px;padding:6px 8px}
      #${CONTROLS_ID} .pdf-div-local{margin-top:8px;padding-top:8px}
      #${CONTROLS_ID} .pdf-div-local-note{line-height:1.35}
      #${CONTROLS_ID} .pdf-div-layer-list{max-height:108px}
      #${CONTROLS_ID} .pdf-div-layer-controls{padding:7px}
      #${CONTROLS_ID} .pdf-div-layer-control{
        grid-template-columns:31px minmax(0,1fr) 36px;
        gap:5px;
        margin-bottom:6px;
      }
      #${CONTROLS_ID} .pdf-div-layer-actions{gap:4px}
      #${CONTROLS_ID} .pdf-div-layer-actions button{padding:5px 6px!important}
      #${PREVIEW_ID}{
        min-width:0;
        min-height:0;
        display:flex;
        align-items:center;
        justify-content:center;
        overflow:auto;
        padding:16px;
        border:1px solid #dbe3ee;
        border-radius:12px;
        background:#edf1f5;
      }
      #${PREVIEW_ID} .divider-prev-wrap{
        flex:0 0 auto;
        width:auto;
        height:min(76vh,760px);
        max-width:100%;
        max-height:100%;
        aspect-ratio:210 / 297;
        margin:0;
        border-radius:7px;
        border:1px solid #cbd5e1;
        background:#fff;
        box-shadow:0 10px 30px rgba(15,23,42,.16);
      }
      #${PREVIEW_ID} .divider-prev-wrap canvas{
        width:100%!important;
        height:100%!important;
        display:block;
        object-fit:contain;
      }
      #${CONTROLS_ID} .modal-footer{
        position:sticky;
        bottom:-2px;
        z-index:5;
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:7px;
        margin-top:10px;
        padding:10px 0 2px;
        background:linear-gradient(to bottom,rgba(255,255,255,.88),#fff 26%);
      }
      #${CONTROLS_ID} .modal-footer .btn{
        min-width:0;
        padding:8px 7px;
        font-size:11px;
      }
      @media (max-width:820px){
        #dividerModal .modal-box.pdf-divider-wide-layout{
          width:min(620px,calc(100vw - 20px));
          max-width:min(620px,calc(100vw - 20px));
          max-height:94vh;
          padding:14px;
          overflow-y:auto;
        }
        #${LAYOUT_ID}{
          display:flex;
          flex-direction:column;
          height:auto;
          gap:12px;
        }
        #${PREVIEW_ID}{
          order:-1;
          min-height:390px;
          padding:10px;
        }
        #${PREVIEW_ID} .divider-prev-wrap{
          height:min(58vh,560px);
        }
        #${CONTROLS_ID}{overflow:visible;padding-right:0}
        #${CONTROLS_ID} .modal-footer{position:static}
      }
    `;
    document.head.appendChild(style);
  }

  function applyLayout(){
    const overlay=document.getElementById('dividerModal');
    const box=overlay?.querySelector('.modal-box');
    const head=box?.querySelector(':scope > .modal-head');
    const preview=box?.querySelector(':scope > .divider-prev-wrap');
    const localPanel=document.getElementById('pdfDividerLocalImagePanel');
    if(!box||!head||!preview||!localPanel)return false;
    if(document.getElementById(LAYOUT_ID))return true;

    installStyles();

    const directChildren=Array.from(box.children);
    const layout=document.createElement('div');
    layout.id=LAYOUT_ID;
    layout.setAttribute('aria-label','간지 편집 작업 영역');

    const controls=document.createElement('div');
    controls.id=CONTROLS_ID;
    controls.setAttribute('aria-label','간지 설정');

    const previewPane=document.createElement('div');
    previewPane.id=PREVIEW_ID;
    previewPane.setAttribute('aria-label','간지 미리보기');

    for(const child of directChildren){
      if(child===head)continue;
      if(child===preview)previewPane.appendChild(child);
      else controls.appendChild(child);
    }

    layout.appendChild(controls);
    layout.appendChild(previewPane);
    head.insertAdjacentElement('afterend',layout);
    box.classList.add('pdf-divider-wide-layout');
    box.dataset.dividerLayout='wide-preview';
    document.documentElement.dataset.pdfDividerWidePreview='1';
    return true;
  }

  function boot(){
    if(applyLayout())return;
    const observer=new MutationObserver(()=>{
      if(applyLayout())observer.disconnect();
    });
    observer.observe(document.documentElement,{childList:true,subtree:true});
    window.setTimeout(()=>observer.disconnect(),10000);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
