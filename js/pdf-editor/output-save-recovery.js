// Keeps the PDF editor's core save action available without intercepting its click.
(function(){
  'use strict';
  if(window.__pdfOutputSaveRecoveryV1)return;
  window.__pdfOutputSaveRecoveryV1=true;

  const path=(location.pathname||'/').replace(/\/+$/,'')||'/';
  if(path!=='/pdf-editor'&&path!=='/pdf-editor/index.html'&&!path.endsWith('/pdf-editor/index.html'))return;

  let previewObserver=null;
  let thumbObserver=null;

  const $=id=>document.getElementById(id);

  function stateReady(){
    try{
      return Array.isArray(uploadedFiles)
        && uploadedFiles.length>0
        && Array.isArray(parsedPages)
        && parsedPages.some(page=>!page?.excluded);
    }catch(_){
      return false;
    }
  }

  function operationBusy(){
    try{return !!window.PdfOperationManager?.active?.();}
    catch(_){return false;}
  }

  function previewIdle(){
    const preview=$('previewBtn');
    return !preview||preview.disabled===false;
  }

  function sync(){
    const direct=$('downloadBtn');
    const ready=stateReady();
    if(direct&&ready&&previewIdle()&&!operationBusy())direct.disabled=false;

    const check=$('pdfEditorFinalCheckBtn');
    if(check&&ready&&direct?.disabled===false&&!operationBusy())check.disabled=false;

    document.documentElement.dataset.pdfOutputSaveReady=ready?'1':'0';
    return ready;
  }

  function observe(){
    const preview=$('previewBtn');
    if(preview&&!previewObserver){
      previewObserver=new MutationObserver(()=>setTimeout(sync,0));
      previewObserver.observe(preview,{attributes:true,attributeFilter:['disabled']});
    }
    const thumbs=$('thumbArea');
    if(thumbs&&!thumbObserver){
      thumbObserver=new MutationObserver(()=>setTimeout(sync,0));
      thumbObserver.observe(thumbs,{childList:true});
    }
    return !!$('downloadBtn');
  }

  function install(attempt=0){
    if(!observe()){
      if(attempt<30)setTimeout(()=>install(attempt+1),100+attempt*20);
      return false;
    }
    sync();
    [180,500,1200,2200].forEach(delay=>setTimeout(sync,delay));
    document.addEventListener('change',event=>{
      if(event.target?.id==='fileInput')setTimeout(sync,80);
    },true);
    document.addEventListener('pdf-editor:pages-changed',()=>setTimeout(sync,0));
    document.documentElement.dataset.pdfOutputSaveRecovery='1';
    return true;
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>install(0),{once:true});
  else install(0);

  window.PdfOutputSaveRecovery={sync,stateReady,stage:'core-save-button-recovery-v1'};
})();
