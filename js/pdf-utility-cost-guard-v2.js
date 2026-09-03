// PDF Utility transfer policy + multi-file upload owner.
(function(){
  'use strict';
  if(window.__pdfUtilityCostGuardV3)return;
  window.__pdfUtilityCostGuardV3=true;

  const path=location.pathname.replace(/\/+$/,'')||'/';
  if(!(path==='/pdf-preflight'||path.endsWith('/pdf-preflight/index.html')))return;

  const MAX_FILES=10;
  const MAX_FILE_BYTES=200*1024*1024;
  const MAX_TOTAL_BYTES=300*1024*1024;
  const DIRECT_SECURITY_BYTES=20*1024*1024;
  const $=id=>document.getElementById(id);
  const fileKey=file=>`${file.name}|${file.size}|${file.lastModified}`;
  let installed=false;
  let observer=null;
  let observerQueued=false;

  function state(){return window.PdfUtility?.state||null;}
  function totalBytes(){return (state()?.files||[]).reduce((sum,file)=>sum+Number(file?.size||0),0);}
  function showError(message){if(typeof window.showError==='function')window.showError(message);else alert(message);}
  function hideError(){if(typeof window.hideError==='function')window.hideError();}
  function mb(bytes){return `${(Number(bytes||0)/1024/1024).toFixed(1)}MB`;}
  function isPdf(file){return Boolean(file)&&((file.type||'').includes('pdf')||/\.pdf$/i.test(file.name||''));}
  function setText(node,value){if(node&&node.textContent!==value)node.textContent=value;}
  function setHtml(node,value){if(node&&node.innerHTML!==value)node.innerHTML=value;}

  function validateIncoming(rawFiles){
    const current=state();
    const incoming=Array.from(rawFiles||[]).filter(Boolean);
    if(!current||!incoming.length)return{ok:false,silent:true};
    const existing=new Set(current.files.map(fileKey));
    const unique=incoming.filter(file=>!existing.has(fileKey(file)));
    const invalid=unique.find(file=>!isPdf(file));
    if(invalid)return{ok:false,message:'PDF 파일만 업로드할 수 있습니다.'};
    const tooLarge=unique.find(file=>Number(file.size||0)>MAX_FILE_BYTES);
    if(tooLarge)return{ok:false,message:`${tooLarge.name}: PDF 한 파일은 최대 200MB까지 가능합니다.`};
    if(current.files.length+unique.length>MAX_FILES)return{ok:false,message:`PDF는 최대 ${MAX_FILES}개까지 등록할 수 있습니다.`};
    const nextTotal=totalBytes()+unique.reduce((sum,file)=>sum+Number(file?.size||0),0);
    if(nextTotal>MAX_TOTAL_BYTES)return{ok:false,message:'한 번 작업에 등록하는 PDF 전체 합계는 최대 300MB까지 가능합니다.'};
    return{ok:true,files:unique,nextTotal};
  }

  function rewritePolicyUi(){
    const count=state()?.files?.length||0;
    setText($('pdfUtilityFileSummary'),`${count} / ${MAX_FILES} · ${mb(totalBytes())} / 300MB`);
    setText(document.querySelector('.pdfu-limit-note'),'PDF는 최대 10개, 한 파일 최대 200MB, 한 번 작업 전체 합계 300MB까지 등록할 수 있습니다. 대용량 변환은 별도 페이지·해상도 한도가 적용됩니다.');
    setHtml(document.querySelector('.upload-sub'),'클릭하거나 여러 PDF를 끌어다 놓으세요.<br>최대 10개 · 파일당 200MB · 전체 합계 300MB · PDF 형식만 지원');
    for(const id of ['encryptBtn','decryptBtn']){
      const button=$(id);
      const title='20MB 초과~200MB PDF는 Storage 기반 암호 작업을 사용합니다.';
      if(button&&button.title!==title)button.title=title;
    }
    document.documentElement.dataset.pdfUtilityCostPolicy='200mb-file-300mb-job-v2';
  }

  function addFiles(rawFiles){
    const current=state();
    if(!current||current.busy)return;
    const result=validateIncoming(rawFiles);
    if(!result.ok){if(!result.silent)showError(result.message);return;}
    if(!result.files.length)return;
    current.files.push(...result.files);
    if(current.files.length===result.files.length)current.activeIndex=0;
    if(typeof window.PdfUtility.selectActive==='function'){
      window.PdfUtility.selectActive(Math.min(current.activeIndex||0,current.files.length-1));
    }
    hideError();
    rewritePolicyUi();
  }

  function replaceUploadHandlers(){
    const input=$('fileInput');
    const zone=$('uploadZone');
    if(!input||!zone||input.dataset.pdfUtilityPolicyOwner==='1')return false;

    const nextInput=input.cloneNode(true);
    nextInput.dataset.pdfUtilityPolicyOwner='1';
    nextInput.multiple=true;
    nextInput.setAttribute('multiple','multiple');
    input.replaceWith(nextInput);

    const nextZone=zone.cloneNode(true);
    nextZone.removeAttribute('onclick');
    nextZone.dataset.pdfUtilityPolicyOwner='1';
    zone.replaceWith(nextZone);

    nextZone.addEventListener('click',()=>nextInput.click());
    nextZone.addEventListener('keydown',event=>{
      if(event.key==='Enter'||event.key===' '){event.preventDefault();nextInput.click();}
    });
    nextInput.addEventListener('change',event=>{
      addFiles(event.target.files);
      event.target.value='';
    });
    for(const name of ['dragenter','dragover']){
      nextZone.addEventListener(name,event=>{event.preventDefault();nextZone.classList.add('dragover');});
    }
    nextZone.addEventListener('dragleave',()=>nextZone.classList.remove('dragover'));
    nextZone.addEventListener('drop',event=>{
      event.preventDefault();
      nextZone.classList.remove('dragover');
      addFiles(event.dataTransfer?.files);
    });
    return true;
  }

  function observeUi(){
    if(observer)return;
    // Observe only the actual file rows. The policy rewrite updates the summary
    // text outside this node, so its own DOM writes cannot retrigger the observer.
    const items=$('pdfUtilityFileItems');
    if(!items)return;
    observer=new MutationObserver(()=>{
      if(observerQueued)return;
      observerQueued=true;
      requestAnimationFrame(()=>{
        observerQueued=false;
        rewritePolicyUi();
      });
    });
    observer.observe(items,{childList:true,subtree:true});
  }

  function install(attempt=0){
    if(installed)return;
    if(!window.PdfUtility||!$('fileInput')||!$('uploadZone')||!$('pdfUtilityFileList')||!$('pdfUtilityFileItems')){
      if(attempt<80)setTimeout(()=>install(attempt+1),75);
      return;
    }
    replaceUploadHandlers();
    observeUi();
    rewritePolicyUi();
    window.PdfUtilityCostPolicy={
      validateIncoming,
      addFiles,
      maxFiles:MAX_FILES,
      maxFileBytes:MAX_FILE_BYTES,
      maxTotalBytes:MAX_TOTAL_BYTES,
      directSecurityBytes:DIRECT_SECURITY_BYTES,
      stage:'pdf-utility-200mb-file-300mb-job-v2'
    };
    installed=true;
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>install(0),{once:true});
  else install(0);
})();