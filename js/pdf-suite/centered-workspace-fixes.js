// Readability refinements for the tool-first centered PDF Utility workspace.
(function(){
  'use strict';
  if(window.__programStudioPdfUtilityCenteredFixesV3)return;
  window.__programStudioPdfUtilityCenteredFixesV3=true;
  window.__programStudioPdfUtilityCenteredFixesV2=true;
  window.__programStudioPdfUtilityCenteredFixesV1=true;

  function installStyle(){
    if(document.getElementById('pdfUtilityCenteredFixesStyle'))return;
    const style=document.createElement('style');
    style.id='pdfUtilityCenteredFixesStyle';
    style.textContent=`
      .pdfuc-home{padding:42px clamp(20px,3.5vw,58px) 72px!important}
      .pdfuc-inner{width:min(1360px,100%)!important}
      .pdfuc-head{margin:5px auto 34px!important}
      .pdfuc-head h1{font-size:clamp(30px,4.2vw,44px)!important}
      .pdfuc-head p{font-size:14.5px!important;line-height:1.75!important}
      .pdfuc-section-title{margin-bottom:18px!important}
      .pdfuc-section-title strong{font-size:20px!important}
      .pdfuc-section-title span{font-size:12px!important}
      .pdfuc-categories{gap:18px!important}
      .pdfuc-category{padding:18px!important;border-radius:22px!important}
      .pdfuc-cat-head{min-height:126px!important;padding:10px 8px 17px!important;margin-bottom:11px!important}
      .pdfuc-cat-icon{width:62px!important;height:62px!important;border-radius:18px!important;font-size:33px!important;margin-bottom:12px!important}
      .pdfuc-cat-head strong{font-size:18px!important;line-height:1.35!important;font-weight:950!important}
      .pdfuc-cat-head>span:not(.pdfuc-cat-icon){font-size:11.5px!important;line-height:1.55!important;margin-top:5px!important}
      .pdfuc-category .pdfu-menu-item{grid-template-columns:40px minmax(0,1fr) auto!important;gap:11px!important;min-height:64px!important;padding:12px 11px!important;margin:3px 0!important;border-radius:13px!important}
      .pdfuc-category .pdfu-menu-icon{font-size:24px!important;line-height:1!important}
      .pdfuc-category .pdfu-menu-name{font-size:14px!important;line-height:1.45!important;font-weight:900!important;white-space:normal!important}
      .pdfuc-category .pdfu-menu-badge{font-size:9.5px!important;padding:5px 7px!important}
      .pdfuc-tool-upload{min-height:126px!important;display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important}
      .pdfuc-dialog .pdfud-file{min-height:126px!important;display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;line-height:1.55!important}
      @media(max-width:980px){
        .pdfuc-inner{width:min(920px,100%)!important}
        .pdfuc-categories{gap:16px!important}
      }
      @media(max-width:600px){
        .pdfuc-home{padding:26px 12px 46px!important}
        .pdfuc-head h1{font-size:30px!important}
        .pdfuc-head p{font-size:13px!important}
        .pdfuc-category{padding:15px!important}
        .pdfuc-cat-head{min-height:104px!important}
        .pdfuc-cat-icon{width:52px!important;height:52px!important;font-size:28px!important}
        .pdfuc-cat-head strong{font-size:17px!important}
        .pdfuc-category .pdfu-menu-item{grid-template-columns:36px minmax(0,1fr) auto!important;min-height:58px!important;padding:11px 10px!important}
        .pdfuc-category .pdfu-menu-icon{font-size:21px!important}
        .pdfuc-category .pdfu-menu-name{font-size:13px!important}
        .pdfuc-tool-upload,.pdfuc-dialog .pdfud-file{min-height:112px!important}
      }
    `;
    document.head.appendChild(style);
  }

  function install(){
    installStyle();
    document.documentElement.dataset.pdfUtilityCenteredRefinements='tool-first-v3';
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
  window.ProgramStudioPdfUtilityCenteredFixes=Object.freeze({stage:'pdf-utility-centered-fixes-v3'});
})();
