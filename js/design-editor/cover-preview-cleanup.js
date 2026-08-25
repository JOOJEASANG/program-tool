// Cover preview visual cleanup: keep one clear label per cover zone.
(function(){
  'use strict';
  if(window.__designEditorCoverPreviewCleanupV1)return;
  window.__designEditorCoverPreviewCleanupV1=true;

  const params=new URLSearchParams(location.search);
  if(params.get('embed')!=='1'||params.get('mode')!=='cover')return;

  const STYLE_ID='designCoverPreviewCleanupStyles';

  function install(){
    if(document.getElementById(STYLE_ID))return true;
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      /* The base editor already draws panel names. Cover mode has its own richer
         zone labels, so showing both creates duplicate badges around the spine. */
      .panel-guide-label{display:none!important}

      /* Keep the three cover zones visually quiet and let the fold lines define
         the actual back/spine/front boundaries. */
      .cover-preview-zone{overflow:hidden!important}
      .cover-preview-zone-label{
        top:6px!important;
        z-index:4!important;
        padding:2px 6px!important;
        border-color:#cbd5e1!important;
        background:rgba(255,255,255,.97)!important;
        box-shadow:0 1px 3px rgba(15,23,42,.08)!important;
        color:#475569!important;
        line-height:1.25!important;
      }

      /* A spine can be only a few millimetres wide. Its badge must be allowed to
         extend outside the narrow zone, and is lowered so it cannot collide with
         the back/front labels on the top guide row. */
      .cover-preview-zone[data-zone="spine"]{
        overflow:visible!important;
        z-index:3!important;
      }
      .cover-preview-zone[data-zone="spine"]>.cover-preview-zone-label{
        top:22px!important;
        max-width:none!important;
        min-width:max-content!important;
        padding:2px 7px!important;
        background:#fff!important;
        border-color:#94a3b8!important;
        color:#334155!important;
      }

      /* Safety boxes stay behind labels and remain intentionally lighter than
         the solid fold/trim boundaries. */
      .cover-preview-zone-safe{z-index:1!important;border-color:rgba(100,116,139,.42)!important}
      .cover-preview-zone-safe[data-zone="spine"]{border-color:rgba(71,85,105,.5)!important}
    `;
    document.head.appendChild(style);
    document.documentElement.dataset.coverPreviewCleanup='1';
    return true;
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();
})();
