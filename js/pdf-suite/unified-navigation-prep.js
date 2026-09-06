// Prepare stable specialist navigation labels and remove PDF Editor-owned features before the utility shell collects tools.
(function(){
  'use strict';
  if(window.__programStudioPdfUnifiedNavigationPrepV2)return;
  window.__programStudioPdfUnifiedNavigationPrepV2=true;

  function normalize(link,path,label){
    if(!link)return;
    link.setAttribute('href',path);
    if(link.textContent!==label)link.textContent=label;
  }

  function removeEditorOwnedUtilityTools(){
    let removed=0;
    document.querySelectorAll('.section[data-category] .tool').forEach(tool=>{
      const href=tool.getAttribute('href')||'';
      if(!/(^|\/)pdf-editor(\/|$)/.test(href))return;
      tool.remove();
      removed+=1;
    });
    document.documentElement.dataset.pdfUtilityEditorOverlapRemoved=String(removed);
    return removed;
  }

  function install(){
    removeEditorOwnedUtilityTools();
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
    removeEditorOwnedUtilityTools,
    stage:'pdf-suite-unified-navigation-prep-v2'
  });
})();