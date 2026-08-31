// Final functional binding after the PDF Utility core and preflight guard are ready.
(function(){
  'use strict';
  if(window.__pdfUtilityFinalizeV3)return;
  window.__pdfUtilityFinalizeV3=true;

  const path=location.pathname.replace(/\/+$/,'')||'/';
  if(!(path==='/pdf-preflight'||path.endsWith('/pdf-preflight/index.html')))return;

  let attempts=0;
  let checkObserver=null;

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
    if(typeof original!=='function'||original.__pdfUtilityFinalizedV3)return;
    const wrapped=function pdfUtilitySetPageBusy(busy,label){
      const result=Reflect.apply(original,this,arguments);
      if(!busy)queueMicrotask(restoreCheckLabel);
      return result;
    };
    wrapped.__pdfUtilityFinalizedV3=true;
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
    window.runCheck=utility.runBatchCheck;
    document.documentElement.dataset.pdfUtilityFinalized='functional-v3';
  }

  finalize();
})();