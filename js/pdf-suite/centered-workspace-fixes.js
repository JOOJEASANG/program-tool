// Readability refinements for the tool-first centered PDF Utility workspace.
(function(){
  'use strict';
  if(window.__programStudioPdfUtilityCenteredFixesV4)return;
  window.__programStudioPdfUtilityCenteredFixesV4=true;
  window.__programStudioPdfUtilityCenteredFixesV3=true;
  window.__programStudioPdfUtilityCenteredFixesV2=true;
  window.__programStudioPdfUtilityCenteredFixesV1=true;

  const CATEGORY_COPY={
    pages:'합치기 · 빈 페이지 · 회전 · 배경/여백',
    convert:'PDF ↔ 이미지 · OCR · 텍스트',
    security:'페이지 정리 · 추출 · 암호 · 개인정보',
    inspect:'검사 · 압축 · 인쇄 문제 자동 수정'
  };

  function installStyle(){
    if(document.getElementById('pdfUtilityCenteredFixesStyle'))return;
    const style=document.createElement('style');
    style.id='pdfUtilityCenteredFixesStyle';
    style.textContent=`
      .pdfuc-home{padding:48px clamp(22px,3.6vw,68px) 82px!important}
      .pdfuc-inner{width:min(1480px,100%)!important}
      .pdfuc-head{margin:6px auto 40px!important}
      .pdfuc-head h1{font-size:clamp(34px,4.5vw,48px)!important}
      .pdfuc-head p{font-size:16px!important;line-height:1.78!important}
      .pdfuc-section-title{margin-bottom:21px!important}
      .pdfuc-section-title strong{font-size:22px!important}
      .pdfuc-section-title span{font-size:13px!important}
      .pdfuc-categories{gap:22px!important}
      .pdfuc-category{padding:22px!important;border-radius:24px!important;box-shadow:0 14px 34px rgba(15,23,42,.065)!important}
      .pdfuc-cat-head{min-height:142px!important;padding:12px 9px 19px!important;margin-bottom:13px!important}
      .pdfuc-cat-icon{width:70px!important;height:70px!important;border-radius:20px!important;font-size:38px!important;margin-bottom:14px!important}
      .pdfuc-cat-head strong{font-size:20px!important;line-height:1.35!important;font-weight:950!important}
      .pdfuc-cat-head>span:not(.pdfuc-cat-icon){font-size:13px!important;line-height:1.58!important;margin-top:6px!important}
      .pdfuc-category .pdfu-menu-item{grid-template-columns:46px minmax(0,1fr) auto!important;gap:12px!important;min-height:72px!important;padding:14px 13px!important;margin:4px 0!important;border-radius:14px!important}
      .pdfuc-category .pdfu-menu-icon{font-size:27px!important;line-height:1!important}
      .pdfuc-category .pdfu-menu-name{font-size:15.5px!important;line-height:1.45!important;font-weight:900!important;white-space:normal!important}
      .pdfuc-category .pdfu-menu-badge{font-size:10px!important;padding:5px 8px!important}
      .pdfuc-tool-upload{min-height:142px!important;display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important}
      .pdfuc-dialog .pdfud-file{min-height:142px!important;display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;line-height:1.55!important}
      .pdfuc-dialog{width:min(1340px,100%)!important;height:min(900px,94vh)!important;border-radius:24px!important}
      .pdfuc-server-card{width:min(1000px,100%)!important;padding:28px!important;border-radius:20px!important}
      @media(max-width:1180px){
        .pdfuc-inner{width:min(1040px,100%)!important}
        .pdfuc-categories{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:18px!important}
      }
      @media(max-width:700px){
        .pdfuc-home{padding:30px 13px 50px!important}
        .pdfuc-head{margin-bottom:28px!important}
        .pdfuc-head h1{font-size:32px!important}
        .pdfuc-head p{font-size:13.5px!important}
        .pdfuc-section-title strong{font-size:19px!important}
        .pdfuc-section-title span{font-size:11px!important}
        .pdfuc-categories{grid-template-columns:1fr!important;gap:14px!important}
        .pdfuc-category{padding:16px!important;border-radius:19px!important}
        .pdfuc-cat-head{min-height:108px!important;padding:8px 7px 14px!important}
        .pdfuc-cat-icon{width:54px!important;height:54px!important;font-size:29px!important;border-radius:16px!important;margin-bottom:10px!important}
        .pdfuc-cat-head strong{font-size:17px!important}
        .pdfuc-cat-head>span:not(.pdfuc-cat-icon){font-size:11px!important}
        .pdfuc-category .pdfu-menu-item{grid-template-columns:38px minmax(0,1fr) auto!important;gap:9px!important;min-height:60px!important;padding:11px 10px!important}
        .pdfuc-category .pdfu-menu-icon{font-size:22px!important}
        .pdfuc-category .pdfu-menu-name{font-size:13.5px!important}
        .pdfuc-tool-upload,.pdfuc-dialog .pdfud-file{min-height:116px!important}
        .pdfuc-dialog{height:96vh!important;border-radius:16px!important}
        .pdfuc-server-card{padding:16px!important}
      }
    `;
    document.head.appendChild(style);
  }

  function syncCategoryCopy(){
    const root=document.getElementById('pdfUtilityCenteredCategories');
    if(!root)return false;
    Object.entries(CATEGORY_COPY).forEach(([category,text])=>{
      const description=root.querySelector(`.pdfuc-category[data-category="${category}"] .pdfuc-cat-head>span:not(.pdfuc-cat-icon)`);
      if(description)description.textContent=text;
    });
    return true;
  }

  function install(){
    installStyle();
    if(!syncCategoryCopy()){
      let tries=0;
      const timer=setInterval(()=>{
        tries+=1;
        if(syncCategoryCopy()||tries>=80)clearInterval(timer);
      },25);
    }
    document.documentElement.dataset.pdfUtilityCenteredRefinements='tool-first-v4-large-layout';
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
  window.ProgramStudioPdfUtilityCenteredFixes=Object.freeze({stage:'pdf-utility-centered-fixes-v4'});
})();
