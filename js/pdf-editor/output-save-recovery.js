// Keeps the PDF editor's core save action available without intercepting its click.
(function(){
  'use strict';
  if(window.__pdfOutputSaveRecoveryV1)return;
  window.__pdfOutputSaveRecoveryV1=true;

  const path=(location.pathname||'/').replace(/\/+$/,'')||'/';
  if(path!=='/pdf-editor'&&path!=='/pdf-editor/index.html'&&!path.endsWith('/pdf-editor/index.html'))return;

  const DOWNLOAD_URL_GRACE_MS=30000;
  let previewObserver=null;
  let thumbObserver=null;
  let deliveryInstalled=false;

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

  // The core editor creates a temporary blob URL, clicks a detached <a>, and
  // immediately revokes the URL. After a long N-UP/booklet render Chrome can
  // receive the click after that URL has already been released, leaving the UI
  // at "PDF 저장 완료" without an actual file download. Keep result anchors in
  // the document during dispatch and give blob URLs a short grace period.
  function installResultDownloadDelivery(){
    if(deliveryInstalled)return true;
    if(!window.HTMLAnchorElement||!window.URL?.revokeObjectURL)return false;
    deliveryInstalled=true;

    const proto=window.HTMLAnchorElement.prototype;
    const nativeClick=proto.click;
    const nativeRevoke=window.URL.revokeObjectURL.bind(window.URL);
    const protectedUrls=new Set();
    const cleanupTimers=new Map();

    function scheduleRelease(url){
      if(!url||cleanupTimers.has(url))return;
      const timer=setTimeout(()=>{
        cleanupTimers.delete(url);
        protectedUrls.delete(url);
        try{nativeRevoke(url);}catch(_){}
      },DOWNLOAD_URL_GRACE_MS);
      cleanupTimers.set(url,timer);
    }

    if(!nativeClick.__pdfResultDownloadDeliveryV2){
      const guardedClick=function(){
        const href=String(this.href||'');
        const isPdfBlob=Boolean(this.download)&&href.startsWith('blob:');
        let mounted=false;
        if(isPdfBlob){
          protectedUrls.add(href);
          scheduleRelease(href);
          if(!this.isConnected&&document.body){
            this.style.display='none';
            this.dataset.pdfResultDownload='1';
            document.body.appendChild(this);
            mounted=true;
          }
          document.documentElement.dataset.pdfResultDownloadDispatch='mounted-blob-v2';
        }
        try{
          return nativeClick.call(this);
        }finally{
          if(mounted)setTimeout(()=>{try{this.remove();}catch(_){}},1500);
        }
      };
      guardedClick.__pdfResultDownloadDeliveryV2=true;
      guardedClick.__pdfResultDownloadNative=nativeClick;
      proto.click=guardedClick;
    }

    if(!window.URL.revokeObjectURL.__pdfResultDownloadDeliveryV2){
      const guardedRevoke=function(url){
        const value=String(url||'');
        if(protectedUrls.has(value)){
          scheduleRelease(value);
          return;
        }
        return nativeRevoke(url);
      };
      guardedRevoke.__pdfResultDownloadDeliveryV2=true;
      guardedRevoke.__pdfResultDownloadNative=nativeRevoke;
      window.URL.revokeObjectURL=guardedRevoke;
    }

    document.documentElement.dataset.pdfResultDownloadDelivery='blob-grace-v2';
    return true;
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
    installResultDownloadDelivery();
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
    document.documentElement.dataset.pdfOutputSaveRecovery='2';
    return true;
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>install(0),{once:true});
  else install(0);

  window.PdfOutputSaveRecovery={
    sync,
    stateReady,
    installResultDownloadDelivery,
    stage:'core-save-button-recovery-v2-result-download'
  };
})();
