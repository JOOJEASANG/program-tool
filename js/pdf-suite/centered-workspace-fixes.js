// Readability refinements for the tool-first centered PDF Utility workspace.
(function(){
  'use strict';
  if(window.__programStudioPdfUtilityCenteredFixesV2)return;
  window.__programStudioPdfUtilityCenteredFixesV2=true;
  window.__programStudioPdfUtilityCenteredFixesV1=true;

  function installStyle(){
    if(document.getElementById('pdfUtilityCenteredFixesStyle'))return;
    const style=document.createElement('style');
    style.id='pdfUtilityCenteredFixesStyle';
    style.textContent=`
      .pdfuc-cat-head{min-height:108px!important;padding:7px 6px 14px!important}
      .pdfuc-cat-icon{width:52px!important;height:52px!important;border-radius:15px!important;font-size:28px!important;margin-bottom:10px!important}
      .pdfuc-cat-head strong{font-size:16px!important;line-height:1.35!important;font-weight:950!important}
      .pdfuc-cat-head>span:not(.pdfuc-cat-icon){font-size:10.5px!important;line-height:1.5!important;margin-top:4px!important}
      .pdfuc-category .pdfu-menu-item{grid-template-columns:34px minmax(0,1fr) auto!important;gap:9px!important;min-height:54px!important;padding:10px 9px!important;border-radius:11px!important}
      .pdfuc-category .pdfu-menu-icon{font-size:20px!important;line-height:1!important}
      .pdfuc-category .pdfu-menu-name{font-size:12.5px!important;line-height:1.4!important;font-weight:900!important;white-space:normal!important}
      .pdfuc-category .pdfu-menu-badge{font-size:8.5px!important;padding:4px 6px!important}
      .pdfuc-tool-upload{min-height:126px!important;display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important}
      .pdfuc-dialog .pdfud-file{min-height:126px!important;display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;line-height:1.55!important}
      @media(max-width:600px){.pdfuc-cat-head{min-height:96px!important}.pdfuc-cat-icon{width:48px!important;height:48px!important;font-size:25px!important}.pdfuc-category .pdfu-menu-name{font-size:12px!important}.pdfuc-tool-upload,.pdfuc-dialog .pdfud-file{min-height:112px!important}}
    `;
    document.head.appendChild(style);
  }

  function install(){
    installStyle();
    document.documentElement.dataset.pdfUtilityCenteredRefinements='tool-first-v2';
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
  window.ProgramStudioPdfUtilityCenteredFixes=Object.freeze({stage:'pdf-utility-centered-fixes-v2'});
})();
