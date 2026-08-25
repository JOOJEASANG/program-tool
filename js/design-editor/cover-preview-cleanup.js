// Cover preview visual cleanup: move labels outside the trim area and color-code each zone.
(function(){
  'use strict';
  if(window.__designEditorCoverPreviewCleanupV2)return;
  window.__designEditorCoverPreviewCleanupV2=true;

  const params=new URLSearchParams(location.search);
  if(params.get('embed')!=='1'||params.get('mode')!=='cover')return;

  const STYLE_ID='designCoverPreviewCleanupStyles';

  function install(){
    let style=document.getElementById(STYLE_ID);
    if(style)style.remove();
    style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      /* Cover mode has its own zone labels. Hide the base panel badges so labels
         are never drawn twice around the spine. */
      .panel-guide-label{display:none!important}

      /* The labels intentionally sit outside the artboard/trim line in the
         viewport padding. Keep every layer overflow-visible so the outside
         badges are never clipped. */
      #designCoverPreviewZones{overflow:visible!important}
      .cover-preview-zone{overflow:visible!important;box-sizing:border-box!important;background:rgba(255,255,255,0)!important}

      /* The colored zone borders replace the visually competing generic fold
         guides in cover mode. Back = green, spine = orange, front = blue. */
      .fold-guide{display:none!important}
      .cover-preview-zone[data-zone="back"]{border:1.5px solid #22a06b!important}
      .cover-preview-zone[data-zone="spine"]{border:1.5px solid #e59b23!important;z-index:3!important}
      .cover-preview-zone[data-zone="front"]{border:1.5px solid #2f80ed!important}

      /* All three labels share one clean row above the preview line. This keeps
         the words completely away from trim/safe/fold guides. */
      .cover-preview-zone-label{
        top:-28px!important;
        left:50%!important;
        z-index:6!important;
        max-width:none!important;
        min-width:max-content!important;
        padding:3px 8px!important;
        border-radius:999px!important;
        background:rgba(255,255,255,.98)!important;
        box-shadow:0 2px 7px rgba(15,23,42,.12)!important;
        font-size:7.5px!important;
        font-weight:950!important;
        line-height:1.2!important;
        white-space:nowrap!important;
      }
      .cover-preview-zone[data-zone="back"]>.cover-preview-zone-label{
        border:1px solid #22a06b!important;color:#11724d!important
      }
      .cover-preview-zone[data-zone="spine"]>.cover-preview-zone-label{
        border:1px solid #e59b23!important;color:#9a5d08!important
      }
      .cover-preview-zone[data-zone="front"]>.cover-preview-zone-label{
        border:1px solid #2f80ed!important;color:#1d5fb8!important
      }

      /* Safety guides use the same family as their zone but stay lighter than
         the primary border so the hierarchy remains obvious. */
      .cover-preview-zone-safe{z-index:1!important;background:transparent!important}
      .cover-preview-zone-safe[data-zone="back"]{border:1px dashed rgba(34,160,107,.48)!important}
      .cover-preview-zone-safe[data-zone="spine"]{border:1px dashed rgba(229,155,35,.55)!important}
      .cover-preview-zone-safe[data-zone="front"]{border:1px dashed rgba(47,128,237,.48)!important}
    `;
    document.head.appendChild(style);
    document.documentElement.dataset.coverPreviewCleanup='2';
    return true;
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();
})();
