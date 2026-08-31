// Storage bridge for encrypt/decrypt PDFs that exceed the direct 20 MiB request path.
(function(){
  'use strict';
  if(window.__pdfSecurityLargeFileV2)return;
  window.__pdfSecurityLargeFileV2=true;

  const path=location.pathname.replace(/\/+$/,'')||'/';
  if(!(path==='/pdf-preflight'||path.endsWith('/pdf-preflight/index.html')))return;

  const DIRECT_MAX=20*1024*1024;
  const MAX_FILE_BYTES=200*1024*1024;
  const SECURITY_ENDPOINT='/api/pdf-utility/security-storage';
  let originalApiPdfTool=null;
  let attempts=0;

  const $=id=>document.getElementById(id);
  function activeFile(){
    const utility=window.PdfUtility;
    if(utility?.state?.files?.length){
      const index=Math.max(0,Math.min(utility.state.files.length-1,Number(utility.state.activeIndex)||0));
      return utility.state.files[index]||null;
    }
    return window.selectedFile||null;
  }
  function isPdf(file){return Boolean(file)&&((file.type||'').includes('pdf')||/\.pdf$/i.test(file.name||''));}
  function safeBaseName(file){return String(file?.name||'document.pdf').replace(/\.pdf$/i,'').replace(/[\\/:*?"<>|]+/g,'_').slice(0,80)||'document';}
  function showError(message){if(typeof window.showError==='function')window.showError(message);else alert(message);}
  function showStatus(message,type='info'){if(typeof window.showCheckStatus==='function')window.showCheckStatus(message,type);}
  function downloadBlob(blob,name){
    if(typeof window.downloadBlob==='function'){window.downloadBlob(blob,name);return;}
    const url=URL.createObjectURL(blob);
    const link=document.createElement('a');
    link.href=url;
    link.download=name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1500);
  }
  async function currentUser(){
    return window.auth?.currentUser||window.firebase?.auth?.()?.currentUser||null;
  }
  async function ensureStorage(){
    if(typeof window._ensureStorage==='function')return window._ensureStorage();
    if(window.storage?.ref)return window.storage;
    if(typeof firebase==='undefined'||!firebase.storage)throw new Error('Firebase Storage를 사용할 수 없습니다.');
    window.storage=firebase.storage();
    return window.storage;
  }
  async function readError(response){
    if(typeof window._readApiError==='function')return window._readApiError(response);
    const data=await response.json().catch(()=>null);
    return data?.detail||data?.error||data?.message||`요청 실패 (${response.status})`;
  }
  async function readDelivery(response,storage){
    if(typeof window._readPdfDelivery==='function')return window._readPdfDelivery(response);
    const contentType=response.headers.get('content-type')||'';
    if(!contentType.includes('application/json'))return response.blob();
    const delivery=await response.json();
    if(delivery?.delivery!=='storage'||!delivery.download_url)throw new Error('완성 PDF 다운로드 정보가 올바르지 않습니다.');
    const result=await fetch(delivery.download_url,{cache:'no-store'});
    if(!result.ok)throw new Error('완성 PDF를 내려받지 못했습니다.');
    const blob=await result.blob();
    if(delivery.storage_path){try{await storage.ref(delivery.storage_path).delete();}catch(_){}}
    return blob;
  }

  async function runStorageSecurity(operation,file,params={}){
    if(!file)throw new Error('먼저 PDF 파일을 선택하세요.');
    if(!isPdf(file))throw new Error('PDF 파일만 사용할 수 있습니다.');
    if(Number(file.size||0)>MAX_FILE_BYTES)throw new Error('PDF 암호 설정·해제는 최대 200MB 파일을 지원합니다.');
    const user=await currentUser();
    if(!user)throw new Error('로그인이 필요합니다.');
    const storage=await ensureStorage();
    const session=`security-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
    const storagePath=`pdf_temp/${user.uid}/${session}/source.pdf`;
    const ref=storage.ref(storagePath);
    let uploaded=false;
    try{
      showStatus('20MB를 초과한 PDF를 암호 처리용으로 업로드하는 중입니다…');
      if(typeof window._uploadStorageFile==='function'){
        await window._uploadStorageFile(ref,file,{timeoutMs:30*60*1000});
      }else{
        await ref.put(file,{contentType:'application/pdf'});
      }
      uploaded=true;
      const token=await user.getIdToken(true);
      const response=await fetch(SECURITY_ENDPOINT,{
        method:'POST',
        headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
        body:JSON.stringify({
          storage_path:storagePath,
          operation,
          password:String(params?.password||''),
          filename:String(file.name||'document.pdf')
        })
      });
      if(!response.ok)throw new Error(await readError(response));
      const blob=await readDelivery(response,storage);
      return{blob,meta:{large_security:true,operation}};
    }finally{
      if(uploaded){try{await ref.delete();}catch(_){}}
    }
  }

  function patchApi(){
    if(typeof window.apiPdfTool!=='function')return false;
    if(window.apiPdfTool.__securityStorageV2)return true;
    originalApiPdfTool=window.apiPdfTool;
    const wrapped=async function(operation,fileOrFiles,params={}){
      const security=operation==='encrypt'||operation==='decrypt';
      const file=Array.isArray(fileOrFiles)?null:fileOrFiles;
      if(security&&file){
        const size=Number(file.size||0);
        if(size>MAX_FILE_BYTES)throw new Error('PDF 암호 설정·해제는 최대 200MB 파일을 지원합니다.');
        if(size>DIRECT_MAX)return runStorageSecurity(operation,file,params);
      }
      return originalApiPdfTool.apply(this,arguments);
    };
    wrapped.__securityStorageV2=true;
    wrapped.__original=originalApiPdfTool;
    window.apiPdfTool=wrapped;
    return true;
  }

  function patchAutoDecrypt(){
    if(typeof window.runAutoDecrypt!=='function')return false;
    if(window.runAutoDecrypt.__securityStorageV2)return true;
    const original=window.runAutoDecrypt;
    const wrapped=async function(){
      const file=activeFile();
      if(!file||Number(file.size||0)<=DIRECT_MAX)return original.apply(this,arguments);
      if(Number(file.size||0)>MAX_FILE_BYTES)return showError('암호 해제는 최대 200MB PDF를 지원합니다.');
      if(typeof window.setPageBusy==='function')window.setPageBusy(true,'암호 해제');
      try{
        showStatus('PDF 암호를 확인하고 해제하는 중입니다…');
        const {blob}=await window.apiPdfTool('decrypt',file,{password:''});
        downloadBlob(blob,`${safeBaseName(file)}_암호해제.pdf`);
        showStatus('암호 없이 열 수 있는 PDF로 저장했습니다.','ok');
      }catch(error){
        const message=error?.message||'암호 해제에 실패했습니다.';
        if(message.includes('비밀번호')&&typeof window.openTool==='function'){
          window.openTool('decrypt');
          setTimeout(()=>{const node=$('toolError');if(node)node.textContent='비밀번호가 필요한 PDF입니다. 비밀번호를 입력한 뒤 다시 시도하세요.';},0);
        }else{
          showError(message);
          showStatus(message,'err');
        }
      }finally{
        if(typeof window.setPageBusy==='function')window.setPageBusy(false);
      }
    };
    wrapped.__securityStorageV2=true;
    wrapped.__original=original;
    window.runAutoDecrypt=wrapped;
    return true;
  }

  function install(){
    attempts+=1;
    const apiReady=patchApi();
    const decryptReady=patchAutoDecrypt();
    if(apiReady&&decryptReady){
      window.PdfSecurityLargeFile={
        runStorageSecurity,
        directMax:DIRECT_MAX,
        maxFileBytes:MAX_FILE_BYTES,
        stage:'pdf-security-storage-200mb-v2'
      };
      document.documentElement.dataset.pdfSecurityStorage='200mb-v2';
      return;
    }
    if(attempts<80)setTimeout(install,100);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();
})();