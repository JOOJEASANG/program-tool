// Final functional binding after the PDF Utility core and preflight guard are ready.
(function(){
  'use strict';
  if(window.__pdfUtilityFinalizeV5)return;
  window.__pdfUtilityFinalizeV5=true;

  const path=location.pathname.replace(/\/+$/,'')||'/';
  if(!(path==='/pdf-preflight'||path.endsWith('/pdf-preflight/index.html')))return;

  let attempts=0;
  let checkObserver=null;
  let retainedDownloadUrl='';
  const blobByUrl=new Map();
  const nativeAnchorClick=HTMLAnchorElement.prototype.click;
  const nativeCreateObjectURL=URL.createObjectURL.bind(URL);
  const nativeRevokeObjectURL=URL.revokeObjectURL.bind(URL);

  function ensureDownloadFallbackUi(){
    let bar=document.getElementById('pdfUtilityDownloadFallback');
    if(bar)return bar;

    bar=document.createElement('div');
    bar.id='pdfUtilityDownloadFallback';
    bar.style.cssText='display:none;margin:14px 0 0;padding:12px 14px;border:1px solid #bae6fd;border-radius:12px;background:#ecfeff;color:#0e7490;align-items:center;gap:10px;flex-wrap:wrap;font-size:11px;font-weight:800';
    bar.innerHTML='<span id="pdfUtilityDownloadFallbackText" style="flex:1;min-width:190px">작업 결과가 준비되었습니다.</span><button type="button" id="pdfUtilityDownloadFallbackBtn" style="border:0;border-radius:9px;padding:9px 13px;background:#0e7490;color:#fff;font:inherit;font-weight:900;cursor:pointer">결과 다운로드</button>';

    const progress=document.getElementById('progressBox');
    const statusStack=document.querySelector('.status-stack');
    if(progress?.parentNode)progress.insertAdjacentElement('afterend',bar);
    else if(statusStack)statusStack.appendChild(bar);
    else document.querySelector('.container')?.appendChild(bar);
    return bar;
  }

  function retainBlobDownload(blob,name){
    if(!(blob instanceof Blob))return;
    if(retainedDownloadUrl){
      try{nativeRevokeObjectURL(retainedDownloadUrl);}catch(_){}
      retainedDownloadUrl='';
    }
    retainedDownloadUrl=nativeCreateObjectURL(blob);
    const bar=ensureDownloadFallbackUi();
    if(!bar)return;
    const text=document.getElementById('pdfUtilityDownloadFallbackText');
    const button=document.getElementById('pdfUtilityDownloadFallbackBtn');
    if(text)text.textContent=`작업 결과가 준비되었습니다: ${name||'result.pdf'}`;
    if(button){
      button.onclick=function(){
        if(!retainedDownloadUrl)return;
        const link=document.createElement('a');
        link.href=retainedDownloadUrl;
        link.download=name||'result.pdf';
        link.dataset.pdfUtilityFallbackDownload='1';
        link.style.display='none';
        document.body.appendChild(link);
        Reflect.apply(nativeAnchorClick,link,[]);
        link.remove();
      };
    }
    bar.style.display='flex';
  }

  function installDownloadFallback(){
    if(URL.createObjectURL.__pdfUtilityDownloadFallbackV5)return;

    const wrappedCreateObjectURL=function pdfUtilityCreateObjectURL(value){
      const url=nativeCreateObjectURL(value);
      if(value instanceof Blob)blobByUrl.set(url,value);
      return url;
    };
    wrappedCreateObjectURL.__pdfUtilityDownloadFallbackV5=true;
    wrappedCreateObjectURL.__pdfUtilityNativeCreateObjectURL=nativeCreateObjectURL;

    const wrappedRevokeObjectURL=function pdfUtilityRevokeObjectURL(url){
      blobByUrl.delete(String(url||''));
      return nativeRevokeObjectURL(url);
    };
    wrappedRevokeObjectURL.__pdfUtilityDownloadFallbackV5=true;
    wrappedRevokeObjectURL.__pdfUtilityNativeRevokeObjectURL=nativeRevokeObjectURL;

    const wrappedClick=function pdfUtilityAnchorClick(){
      const href=String(this.href||'');
      const name=this.download||'result.pdf';
      const isFallback=this.dataset?.pdfUtilityFallbackDownload==='1';
      if(!isFallback&&href.startsWith('blob:')&&this.hasAttribute('download')){
        const blob=blobByUrl.get(href);
        if(blob)retainBlobDownload(blob,name);
      }
      return Reflect.apply(nativeAnchorClick,this,arguments);
    };
    wrappedClick.__pdfUtilityDownloadFallbackV5=true;
    wrappedClick.__pdfUtilityNativeClick=nativeAnchorClick;

    URL.createObjectURL=wrappedCreateObjectURL;
    URL.revokeObjectURL=wrappedRevokeObjectURL;
    HTMLAnchorElement.prototype.click=wrappedClick;

    window.addEventListener('beforeunload',()=>{
      if(retainedDownloadUrl){
        try{nativeRevokeObjectURL(retainedDownloadUrl);}catch(_){}
        retainedDownloadUrl='';
      }
      blobByUrl.clear();
    },{once:true});
  }

  function restoreCheckLabel(){
    const check=document.getElementById('checkBtn');
    if(!check)return;
    const name=check.querySelector('.action-name');
    const desc=check.querySelector('.action-desc');
    const chip=check.querySelector('.action-chip');
    if(name&&name.textContent!=='최대 10개 일괄 검수')name.textContent='최대 10개 일괄 검수';
    if(desc&&desc.textContent!=='등록한 PDF를 순서대로 검사하고 파일별 점수와 경고를 모아 보여줍니다.'){
      desc.textContent='등록한 PDF를 순서대로 검사하고 파일별 점수와 경고를 모아 보여줍니다.';
    }
    if(chip&&chip.textContent!=='일괄 점검')chip.textContent='일괄 점검';
  }

  function wrapBusyState(){
    const original=window.setPageBusy;
    if(typeof original!=='function'||original.__pdfUtilityFinalizedV5)return;
    const wrapped=function pdfUtilitySetPageBusy(busy,label){
      const result=Reflect.apply(original,this,arguments);
      if(!busy)queueMicrotask(restoreCheckLabel);
      return result;
    };
    wrapped.__pdfUtilityFinalizedV5=true;
    wrapped.__pdfUtilityDelegate=original;
    window.setPageBusy=wrapped;
  }

  function observeCheckLabel(){
    const check=document.getElementById('checkBtn');
    if(!check||checkObserver)return;
    checkObserver=new MutationObserver(()=>{
      const utility=window.PdfUtility;
      if(!utility||utility.state?.busy)return;
      restoreCheckLabel();
      window.runCheck=utility.runBatchCheck;
    });
    checkObserver.observe(check,{subtree:true,childList:true,characterData:true});
  }

  function finalize(){
    attempts+=1;
    const utility=window.PdfUtility;
    const guardReady=document.getElementById('pdfToolsResetBelowStyle');
    if(!utility||!guardReady){
      if(attempts<80)setTimeout(finalize,75);
      return;
    }
    const input=document.getElementById('fileInput');
    if(input){input.multiple=true;input.setAttribute('multiple','multiple');}
    restoreCheckLabel();
    wrapBusyState();
    observeCheckLabel();
    ensureDownloadFallbackUi();
    window.runCheck=utility.runBatchCheck;
    document.documentElement.dataset.pdfUtilityFinalized='functional-v5-download-fallback';
  }

  installDownloadFallback();
  finalize();
})();