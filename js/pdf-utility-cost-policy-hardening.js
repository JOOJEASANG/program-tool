// Final cost-policy guard layered after the legacy PDF Utility 500MB helper.
// The legacy helper remains for its security modal/batch UX; this module owns the
// stricter production transfer policy and blocks oversized input before it reaches
// legacy handlers.
(function(){
  'use strict';
  if(window.__pdfUtilityCostPolicyHardeningV1)return;
  window.__pdfUtilityCostPolicyHardeningV1=true;

  const path=location.pathname.replace(/\/+$/,'')||'/';
  if(!(path==='/pdf-preflight'||path.endsWith('/pdf-preflight/index.html')||path.endsWith('/tools/pdf-Checker.html')||path.endsWith('/tools/preflight.html')))return;

  const MAX_FILES=10;
  const MAX_FILE_BYTES=200*1024*1024;
  const MAX_TOTAL_BYTES=300*1024*1024;
  const $=id=>document.getElementById(id);
  let observer=null;

  function state(){return window.PdfUtility?.state||null}
  function totalBytes(){return (state()?.files||[]).reduce((sum,file)=>sum+Number(file?.size||0),0)}
  function incomingFiles(value){return Array.from(value||[]).filter(Boolean)}
  function showError(message){
    if(typeof window.showError==='function')window.showError(message);
    else alert(message);
  }
  function block(event,message){
    event.preventDefault();
    event.stopImmediatePropagation();
    if(event.target?.id==='fileInput')event.target.value='';
    showError(message);
  }

  function validate(files){
    const incoming=incomingFiles(files);
    if(!incoming.length)return{ok:true};
    const nonPdf=incoming.find(file=>!((file.type||'').includes('pdf')||/\.pdf$/i.test(file.name||'')));
    if(nonPdf)return{ok:false,message:'PDF 파일만 업로드할 수 있습니다.'};
    const tooLarge=incoming.find(file=>Number(file.size||0)>MAX_FILE_BYTES);
    if(tooLarge)return{ok:false,message:`${tooLarge.name}: PDF 한 파일은 최대 200MB까지 가능합니다.`};
    const current=state()?.files||[];
    if(current.length+incoming.length>MAX_FILES)return{ok:false,message:`PDF는 최대 ${MAX_FILES}개까지 등록할 수 있습니다.`};
    const nextTotal=totalBytes()+incoming.reduce((sum,file)=>sum+Number(file?.size||0),0);
    if(nextTotal>MAX_TOTAL_BYTES)return{ok:false,message:'한 번 작업에 등록하는 PDF 전체 합계는 최대 300MB까지 가능합니다.'};
    return{ok:true,nextTotal};
  }

  function onChange(event){
    if(event.target?.id!=='fileInput')return;
    const result=validate(event.target.files);
    if(!result.ok)block(event,result.message);
  }
  function onDrop(event){
    if(!event.target?.closest?.('#uploadZone'))return;
    const result=validate(event.dataTransfer?.files);
    if(!result.ok)block(event,result.message);
  }

  function setText(node,value){if(node&&node.textContent!==value)node.textContent=value}
  function setHtml(node,value){if(node&&node.innerHTML!==value)node.innerHTML=value}
  function rewritePolicyUi(){
    const count=state()?.files?.length||0;
    const total=(totalBytes()/1024/1024).toFixed(1);
    setText($('pdfUtilityFileSummary'),`${count} / ${MAX_FILES} · ${total}MB / 300MB`);
    setText(document.querySelector('.pdfu-limit-note'),'PDF는 최대 10개, 한 파일 최대 200MB, 한 번 작업 전체 합계 300MB까지 등록할 수 있습니다. 대용량 변환은 별도 페이지·해상도 한도가 적용됩니다.');
    setHtml(document.querySelector('.upload-sub'),'클릭하거나 여러 PDF를 끌어다 놓으세요.<br>최대 10개 · 파일당 200MB · 전체 합계 300MB · PDF 형식만 지원');
    for(const id of ['encryptBtn','decryptBtn']){
      const button=$(id);
      if(button)button.title='20MB 초과~200MB PDF는 Storage 기반 암호 작업을 사용합니다.';
    }
    document.documentElement.dataset.pdfUtilityCostPolicy='200mb-file-300mb-job-v1';
  }

  function installObserver(){
    if(observer)return;
    const targets=[
      $('pdfUtilityFileSummary'),
      document.querySelector('.pdfu-limit-note'),
      document.querySelector('.upload-sub')
    ].filter(Boolean);
    if(!targets.length)return;
    observer=new MutationObserver(()=>queueMicrotask(rewritePolicyUi));
    targets.forEach(target=>observer.observe(target,{childList:true,subtree:true,characterData:true}));
  }

  function install(attempt=0){
    if(!window.PdfUtility||!$('fileInput')||!$('uploadZone')){
      if(attempt<80)setTimeout(()=>install(attempt+1),75);
      return;
    }
    rewritePolicyUi();
    installObserver();
    [150,500,1200,2500].forEach(delay=>setTimeout(rewritePolicyUi,delay));
  }

  // Capture phase must run before the legacy cloned-input target handlers.
  document.addEventListener('change',onChange,true);
  document.addEventListener('drop',onDrop,true);

  window.PdfUtilityCostPolicy={
    validate,
    maxFiles:MAX_FILES,
    maxFileBytes:MAX_FILE_BYTES,
    maxTotalBytes:MAX_TOTAL_BYTES,
    stage:'pdf-utility-200mb-file-300mb-job-cost-policy-v1'
  };

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>install(0),{once:true});
  else install(0);
})();
