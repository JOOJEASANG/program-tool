// PDF utility large-file security bridge.
// Keeps normal PDF tools on the direct request path while moving encrypt/decrypt files over 20MB to Firebase Storage.
(function(){
  'use strict';
  if(window.__pdfSecurityLargeFileV1)return;
  window.__pdfSecurityLargeFileV1=true;

  const DIRECT_MAX=20*1024*1024;
  const UTILITY_FILE_MAX=200*1024*1024;
  const SECURITY_MAX=500*1024*1024;
  const SECURITY_ENDPOINT='/api/pdf-utility/security-storage';
  let originalApiPdfTool=null;
  let attempts=0;

  const $=id=>document.getElementById(id);
  const formatBytes=bytes=>{
    const value=Number(bytes||0);
    if(value>=1024*1024)return `${(value/(1024*1024)).toFixed(value>=100*1024*1024?0:1)}MB`;
    if(value>=1024)return `${(value/1024).toFixed(1)}KB`;
    return `${value}B`;
  };

  function isPdf(file){
    return !!file&&(file.type==='application/pdf'||String(file.name||'').toLowerCase().endsWith('.pdf'));
  }

  function selected(){
    return window.selectedFile||null;
  }

  function setLegacySelected(file){
    window.selectedFile=file;
    try{selectedFile=file;}catch(_){}
  }

  function showErrorSafe(message){
    if(typeof window.showError==='function')window.showError(message);
    else alert(message);
  }

  function showStatus(message,type='info'){
    if(typeof window.showCheckStatus==='function')window.showCheckStatus(message,type);
  }

  function hideStatus(){
    if(typeof window.hideCheckStatus==='function')window.hideCheckStatus();
  }

  function setProgressSafe(percent,text){
    if(typeof window.setProgress==='function'){
      try{window.setProgress(percent,'🔐',text);}catch(_){}
    }
  }

  function safeBaseName(file){
    if(typeof window.safeBaseName==='function')return window.safeBaseName(file);
    return String(file?.name||'document.pdf').replace(/\.pdf$/i,'').replace(/[\\/:*?"<>|]+/g,'_').slice(0,80)||'document';
  }

  function downloadBlobSafe(blob,name){
    if(typeof window.downloadBlob==='function'){
      window.downloadBlob(blob,name);
      return;
    }
    const url=URL.createObjectURL(blob);
    const link=document.createElement('a');
    link.href=url;
    link.download=name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1500);
  }

  async function readApiError(resp){
    if(typeof window._readApiError==='function')return window._readApiError(resp);
    const data=await resp.json().catch(()=>null);
    return data?.detail||data?.error||data?.message||`요청 실패 (${resp.status})`;
  }

  async function authHeaders(user){
    if(typeof window._authHeaders==='function')return window._authHeaders();
    return {'Authorization':`Bearer ${await user.getIdToken(true)}`};
  }

  async function ensureStorage(){
    if(typeof window._ensureStorage==='function')return window._ensureStorage();
    if(typeof firebase==='undefined'||!firebase.storage)throw new Error('Firebase Storage를 사용할 수 없습니다.');
    return firebase.storage();
  }

  async function uploadStorageFile(ref,file){
    if(typeof window._uploadStorageFile==='function'){
      return window._uploadStorageFile(ref,file,{
        timeoutMs:30*60*1000,
        onProgress:progress=>{
          const ratio=Math.max(0,Math.min(1,Number(progress?.ratio||0)));
          const uploadPercent=Math.round(ratio*100);
          setProgressSafe(Math.max(2,Math.min(72,Math.round(ratio*70)+2)),`암호 처리용 PDF 업로드 중… ${uploadPercent}%`);
          showStatus(`대용량 PDF를 안전하게 업로드하는 중입니다… ${uploadPercent}%`);
        }
      });
    }
    return ref.put(file,{contentType:'application/pdf'});
  }

  async function readDelivery(resp){
    if(typeof window._readPdfDelivery==='function')return window._readPdfDelivery(resp);
    return resp.blob();
  }

  async function runStorageSecurity(op,file,params={}){
    if(!file)throw new Error('먼저 PDF 파일을 선택하세요.');
    if(!isPdf(file))throw new Error('PDF 파일만 사용할 수 있습니다.');
    if(Number(file.size||0)>SECURITY_MAX)throw new Error('PDF 암호 설정·해제는 500MB 이하 파일만 지원합니다.');

    const user=window.auth?.currentUser||window.firebase?.auth?.()?.currentUser;
    if(!user)throw new Error('로그인이 필요합니다.');

    const storage=await ensureStorage();
    const session=`security-${Date.now()}-${Math.random().toString(36).slice(2,10)}`;
    const storagePath=`pdf_temp/${user.uid}/${session}/source.pdf`;
    const ref=storage.ref(storagePath);

    try{
      setProgressSafe(2,'대용량 PDF 업로드 준비 중…');
      showStatus(`대용량 PDF ${formatBytes(file.size)}를 암호 처리용으로 업로드합니다…`);
      await uploadStorageFile(ref,file);
      setProgressSafe(76,op==='decrypt'?'서버에서 PDF 암호 해제 중…':'서버에서 PDF 암호 설정 중…');
      showStatus(op==='decrypt'?'서버에서 PDF 암호를 해제하는 중입니다…':'서버에서 PDF 암호를 설정하는 중입니다…');

      const headers=await authHeaders(user);
      const resp=await fetch(SECURITY_ENDPOINT,{
        method:'POST',
        headers:{...headers,'Content-Type':'application/json'},
        body:JSON.stringify({
          storage_path:storagePath,
          operation:op,
          password:String(params?.password||''),
          filename:String(file.name||'document.pdf')
        })
      });
      if(!resp.ok)throw new Error(await readApiError(resp));

      setProgressSafe(92,'처리된 PDF를 가져오는 중…');
      const blob=await readDelivery(resp);
      setProgressSafe(100,'PDF 암호 처리 완료');
      return {blob,meta:{large_security:true,operation:op}};
    }finally{
      try{await ref.delete();}catch(_){}
    }
  }

  function patchApi(){
    if(typeof window.apiPdfTool!=='function')return false;
    if(window.apiPdfTool.__security500mb)return true;
    originalApiPdfTool=window.apiPdfTool;
    const wrapped=async function(op,fileOrFiles,params={}){
      const security=op==='encrypt'||op==='decrypt';
      const file=Array.isArray(fileOrFiles)?null:fileOrFiles;
      if(security&&file){
        const size=Number(file.size||0);
        if(size>SECURITY_MAX)throw new Error('PDF 암호 설정·해제는 500MB 이하 파일만 지원합니다.');
        if(size>DIRECT_MAX)return runStorageSecurity(op,file,params);
      }
      return originalApiPdfTool.apply(this,arguments);
    };
    wrapped.__security500mb=true;
    wrapped.__original=originalApiPdfTool;
    window.apiPdfTool=wrapped;
    return true;
  }

  function patchAvailability(){
    if(window.syncFileActionAvailability?.__security500mb)return true;
    const original=typeof window.syncFileActionAvailability==='function'?window.syncFileActionAvailability:null;
    const wrapped=function(){
      if(original){
        try{original();}catch(_){}
      }
      let busy=false;
      try{busy=!!pageBusy;}catch(_){busy=false;}
      const file=selected();
      const unavailable=busy||!file;
      const tooLarge=Number(file?.size||0)>SECURITY_MAX;
      const decrypt=$('decryptBtn');
      const encrypt=$('encryptBtn');
      if(decrypt){
        decrypt.disabled=unavailable||tooLarge;
        decrypt.title=tooLarge?'암호 해제는 최대 500MB PDF를 지원합니다.':'';
      }
      if(encrypt){
        encrypt.disabled=unavailable||tooLarge;
        encrypt.title=tooLarge?'암호 설정은 최대 500MB PDF를 지원합니다.':'';
      }
    };
    wrapped.__security500mb=true;
    wrapped.__original=original;
    window.syncFileActionAvailability=wrapped;
    return true;
  }

  function patchSelectFile(){
    if(window.selectFile?.__security500mb)return true;
    const original=typeof window.selectFile==='function'?window.selectFile:null;
    const wrapped=function(file){
      if(!file)return;
      if(!isPdf(file)){
        showErrorSafe('PDF 파일만 선택할 수 있습니다.');
        const input=$('fileInput');
        if(input)input.value='';
        return;
      }
      if(Number(file.size||0)>SECURITY_MAX){
        showErrorSafe('PDF 암호 설정·해제는 최대 500MB 파일을 지원합니다.');
        const input=$('fileInput');
        if(input)input.value='';
        return;
      }
      if(Number(file.size||0)<=DIRECT_MAX&&original){
        return original(file);
      }

      setLegacySelected(file);
      if(typeof window.hideError==='function')window.hideError();
      const filename=$('uploadFilename');
      if(filename)filename.textContent=`${file.name} · ${formatBytes(file.size)}`;
      const reset=$('resetBtn');
      if(reset)reset.style.display='';
      const uploadZone=$('uploadZone');
      if(uploadZone)uploadZone.classList.add('has-file');
      window.syncFileActionAvailability?.();
      showStatus(Number(file.size||0)>UTILITY_FILE_MAX
        ? '200MB를 넘는 PDF는 암호 설정·해제 전용 대용량 경로로 준비했습니다.'
        : '20MB를 넘는 PDF 암호 작업은 대용량 전송 경로를 자동 사용합니다.','ok');
    };
    wrapped.__security500mb=true;
    wrapped.__original=original;
    window.selectFile=wrapped;
    return true;
  }

  function patchAutoDecrypt(){
    if(window.runAutoDecrypt?.__security500mb)return true;
    const original=typeof window.runAutoDecrypt==='function'?window.runAutoDecrypt:null;
    const wrapped=async function(){
      let busy=false;
      try{busy=!!pageBusy;}catch(_){busy=false;}
      const file=selected();
      if(busy||!file)return;
      if(Number(file.size||0)>SECURITY_MAX){
        showErrorSafe('암호 해제는 최대 500MB PDF를 지원합니다.');
        return;
      }
      if(Number(file.size||0)<=DIRECT_MAX&&original)return original();

      if(typeof window.setPageBusy==='function')window.setPageBusy(true,'암호 해제');
      if(typeof window.hideError==='function')window.hideError();
      hideStatus();
      showStatus('암호를 확인하고 해제하는 중입니다…');
      try{
        const {blob}=await window.apiPdfTool('decrypt',file,{password:''});
        downloadBlobSafe(blob,`${safeBaseName(file)}_암호해제.pdf`);
        showStatus('암호 없이 열 수 있는 PDF로 저장했습니다.','ok');
      }catch(error){
        const message=error?.message||'암호 해제에 실패했습니다.';
        if(message.includes('비밀번호')){
          hideStatus();
          if(typeof window.openTool==='function')window.openTool('decrypt');
          setTimeout(()=>{
            const toolError=$('toolError');
            if(toolError)toolError.textContent='비밀번호가 필요한 PDF입니다. 비밀번호를 입력한 뒤 다시 시도하세요.';
          },0);
        }else{
          showErrorSafe(message);
          showStatus(message,'err');
        }
      }finally{
        if(typeof window.setPageBusy==='function')window.setPageBusy(false);
      }
    };
    wrapped.__security500mb=true;
    wrapped.__original=original;
    window.runAutoDecrypt=wrapped;
    return true;
  }

  function renderLargeFileSummary(file){
    const summary=$('pdfUtilityFileSummary');
    if(summary)summary.textContent=`대용량 암호 작업 · 1개 · ${formatBytes(file.size)}`;
    const list=$('pdfUtilityFileItems');
    if(list){
      list.innerHTML='';
      const item=document.createElement('div');
      item.className='pdf-utility-file-item active';
      item.innerHTML=`<div class="pdf-utility-file-main"><strong></strong><span>암호 설정·해제 전용 · 최대 500MB</span></div>`;
      item.querySelector('strong').textContent=file.name;
      list.appendChild(item);
    }
  }

  function handleVeryLargeFile(file){
    if(!file||Number(file.size||0)<=UTILITY_FILE_MAX)return false;
    if(!isPdf(file)){
      showErrorSafe('PDF 파일만 선택할 수 있습니다.');
      return true;
    }
    if(Number(file.size||0)>SECURITY_MAX){
      showErrorSafe('PDF 암호 설정·해제는 최대 500MB 파일을 지원합니다.');
      return true;
    }
    if(typeof window.selectFile!=='function')return false;
    window.selectFile(file);
    renderLargeFileSummary(file);
    return true;
  }

  function bindLargeSelection(){
    if(window.__pdfSecurityLargeSelectionBound)return;
    window.__pdfSecurityLargeSelectionBound=true;
    window.addEventListener('change',event=>{
      if(event.target?.id!=='fileInput')return;
      const files=[...(event.target.files||[])];
      const file=files.length===1?files[0]:null;
      if(!file||Number(file.size||0)<=UTILITY_FILE_MAX)return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      handleVeryLargeFile(file);
      event.target.value='';
    },true);
    window.addEventListener('drop',event=>{
      const zone=$('uploadZone');
      if(!zone||!zone.contains(event.target))return;
      const files=[...(event.dataTransfer?.files||[])];
      const file=files.length===1?files[0]:null;
      if(!file||Number(file.size||0)<=UTILITY_FILE_MAX)return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      handleVeryLargeFile(file);
    },true);
  }

  function updateLabels(){
    const uploadZone=$('uploadZone');
    if(uploadZone){
      const hints=[...uploadZone.querySelectorAll('.upload-sub,.upload-hint,.drop-hint,.upload-desc')];
      hints.forEach(node=>{
        if(/20MB|200MB|용량/.test(node.textContent||''))node.textContent='일반 PDF 작업은 최대 200MB · 암호 설정·해제는 단일 PDF 최대 500MB';
      });
    }
    [['decryptBtn','PDF 암호를 제거해 다시 저장합니다. 최대 500MB.'],['encryptBtn','PDF에 암호를 설정해 다시 저장합니다. 최대 500MB.']].forEach(([id,desc])=>{
      const button=$(id);
      const text=button?.querySelector('.action-desc');
      if(text)text.textContent=desc;
    });
  }

  function install(){
    attempts+=1;
    const apiReady=patchApi();
    const availabilityReady=patchAvailability();
    const selectReady=patchSelectFile();
    const decryptReady=patchAutoDecrypt();
    bindLargeSelection();
    updateLabels();
    window.syncFileActionAvailability?.();
    if(apiReady&&availabilityReady&&selectReady&&decryptReady){
      window.PdfSecurityLargeFile={
        runStorageSecurity,
        handleVeryLargeFile,
        directMax:DIRECT_MAX,
        utilityFileMax:UTILITY_FILE_MAX,
        securityMax:SECURITY_MAX,
        stage:'pdf-security-large-file-v1'
      };
      document.documentElement.dataset.pdfSecurity500mb='1';
      return true;
    }
    if(attempts<80)setTimeout(install,100);
    return false;
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();
})();
