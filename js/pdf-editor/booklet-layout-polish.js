// Visual-only polish for the PDF booklet controls. No booklet processing logic lives here.
(function(){
  'use strict';
  if(window.__pdfBookletLayoutPolishV1)return;
  window.__pdfBookletLayoutPolishV1=true;

  const STYLE_ID='pdfBookletLayoutPolishStyles';

  function installStyles(){
    if(document.getElementById(STYLE_ID))return;
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      #bookletRow{
        margin-top:8px!important;
        padding:10px 11px!important;
        border:1px solid #dbe4ee!important;
        border-radius:10px!important;
        background:#f8fafc!important;
      }
      html.pdf-classic-booklet-active body #bookletRow{display:block!important}
      #bookletRow>label{
        display:grid!important;
        grid-template-columns:18px minmax(0,1fr)!important;
        grid-template-rows:auto auto!important;
        column-gap:8px!important;
        row-gap:2px!important;
        align-items:start!important;
        margin:0!important;
        line-height:1.35!important;
      }
      #bookletRow>label>#bookletCheck{
        grid-column:1!important;
        grid-row:1/span 2!important;
        width:15px!important;
        height:15px!important;
        margin:1px 0 0!important;
        accent-color:#12396d;
      }
      #bookletRow>label>span:first-of-type{
        grid-column:2!important;
        font-size:11px!important;
        font-weight:900!important;
        color:#1f2937!important;
        letter-spacing:-.1px!important;
      }
      #bookletRow>label>span:last-of-type{
        grid-column:2!important;
        display:block!important;
        margin:0!important;
        color:#64748b!important;
        font-size:9px!important;
        font-weight:600!important;
        line-height:1.45!important;
        word-break:keep-all!important;
      }
      #bookletPadInfo{
        margin:7px 0 0!important;
        padding:6px 8px!important;
        border-radius:7px!important;
        background:#eff6ff!important;
        color:#1d4ed8!important;
        font-size:9px!important;
        font-weight:800!important;
        line-height:1.45!important;
      }
      #bookletRow #bookletReliabilityNotice{
        margin:7px 0 0!important;
        padding:6px 8px!important;
        border:0!important;
        border-radius:7px!important;
        background:#f1f5f9!important;
        color:#475569!important;
        font-size:8.5px!important;
        font-weight:650!important;
        line-height:1.45!important;
      }
      #bookletRow .booklet-print-guide{
        margin:9px 0 0!important;
        padding:9px 0 0!important;
        border:0!important;
        border-top:1px solid #dbe4ee!important;
        border-radius:0!important;
        background:transparent!important;
      }
      #bookletRow .booklet-print-guide-title{
        margin-bottom:7px!important;
        color:#334155!important;
        font-size:10px!important;
      }
      #bookletRow .booklet-print-guide-badge{
        background:#e8eef7!important;
        color:#31577f!important;
      }
      #bookletRow .booklet-flip-row{
        grid-template-columns:70px minmax(0,1fr)!important;
        gap:7px!important;
        margin-bottom:7px!important;
      }
      #bookletRow .booklet-flip-row label{
        margin:0!important;
        color:#64748b!important;
        font-size:9px!important;
      }
      #bookletRow .booklet-flip-row select{
        padding:6px 8px!important;
        border-radius:7px!important;
        background:#fff!important;
        font-size:10px!important;
        font-weight:800!important;
      }
      #bookletRow .booklet-print-guide-steps{
        gap:4px!important;
        padding:7px 8px!important;
        border:1px solid #e2e8f0!important;
        border-radius:8px!important;
        background:#fff!important;
      }
      #bookletRow .booklet-print-guide-step b{background:#31577f!important}
      #bookletRow .booklet-print-guide-note{
        margin-top:6px!important;
        padding:0 1px!important;
        border-top:0!important;
        color:#64748b!important;
      }
      #bookletRow+.classic-booklet-note{
        margin-top:6px!important;
        padding:7px 9px!important;
        border-color:#dbe4ee!important;
        background:#f8fafc!important;
        color:#475569!important;
        line-height:1.45!important;
      }
      #bookletSheetPreviewButton.booklet-sheet-preview-btn{
        margin-top:7px!important;
        width:100%!important;
        padding:7px 9px!important;
        border-radius:8px!important;
      }
    `;
    document.head.appendChild(style);
  }

  function boot(){installStyles();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
