// Prepare stable specialist navigation labels before the unified PDF workspace observer starts.
(function(){
  'use strict';
  if(window.__programStudioPdfUnifiedNavigationPrepV1)return;
  window.__programStudioPdfUnifiedNavigationPrepV1=true;

  function normalize(link,path,label){
    if(!link)return;
    link.setAttribute('href',path);
    if(link.textContent!==label)link.textContent=label;
  }

  function install(){
    document.querySelectorAll('.top-link').forEach(link=>{
      const href=link.getAttribute('href')||'';
      if(href.includes('pdf-preflight'))normalize(link,'/pdf-preflight/','전문 검사·변환');
      if(href.includes('pdf-editor'))normalize(link,'/pdf-editor/','전문 편집·인쇄');
    });
    document.documentElement.dataset.pdfUnifiedNavigationPrep='ready';
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();

  window.ProgramStudioPdfUnifiedNavigationPrep=Object.freeze({
    install,
    stage:'pdf-suite-unified-navigation-prep-v1'
  });
})();