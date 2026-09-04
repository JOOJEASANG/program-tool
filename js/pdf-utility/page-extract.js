// PDF Utility page extraction: browser-local first with bounded server fallback.
(function(){
  'use strict';
  if(window.__pdfUtilityPageExtractV1)return;
  window.__pdfUtilityPageExtractV1=true;

  const path=location.pathname.replace(/\/+$/,'')||'/';
  if(!(path==='/pdf-preflight'||path.endsWith('/pdf-preflight/index.html')||path.endsWith('/tools/pdf-Checker.html')||path.endsWith('/tools/preflight.html')))return;

  const DEFAULT_LOCAL_LIMIT_BYTES=120*1024*1024;
  let pdfLibPromise=null;
  let busy=false;

  const $=id=>document.getElementById(id);
  const mb=bytes=>`${(Number(bytes||0)/1024/1024).toFixed(1)}MB`;
  const utility=()=>window.PdfUtility||null;
  const activeFile=()=>{
    const state=utility()?.state;
    return state?.files?.[Number(state.activeIndex||0)]||null;
  };
  const fileKey=file=>`${file?.name||''}|${Number(file?.size||0)}|${Number(file?.lastModified||0)}`;
  const safeBaseName=file=>String(file?.name||'document.pdf').replace(/\.pdf$/i,'').replace(/[\\/:*?"<>|]+/g,'_').slice(0,70)||'document';
  const localRuntime=()=>window.ProgramStudioPdfLocalProcessing||null;
  const localLimit=()=>Number(localRuntime()?.localMergeLimitBytes||DEFAULT_LOCAL_LIMIT_BYTES);

  function showError(message){
    if(typeof window.showError==='function')window.showError(message);
    else alert(message);
  }

  function showStatus(message,type='info'){
    if(typeof window.showCheckStatus==='function')window.showCheckStatus(message,type);
  }

  function setProgress(percent,icon,message){
    const box=$('progressBox');
    if(box)box.style.display='block';
    if(typeof window.setProgress==='function')window.setProgress(Math.max(0,Math.min(100,Math.round(percent))),icon,message);
  }

  function stopProgressSoon(){
    setTimeout(()=>{if(!busy&&typeof window.stopProgress==='function')window.stopProgress();},900);
  }

  function setMode(mode,message){
    if(typeof localRuntime()?.setMode==='function')localRuntime().setMode(mode,message);
    else document.documentElement.dataset.pdfProcessingMode=mode;
  }

  function downloadBlob(blob,name){
    const url=URL.createObjectURL(blob);
    const link=document.createElement('a');
    link.href=url;
    link.download=name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1500);
  }

  function selectionError(message){
    const error=new Error(message);
    error.code='PDF_PAGE_SELECTION_INVALID';
    return error;
  }

  function parsePageSelection(value,pageCount=null){
    const source=String(value||'').trim();
    if(!source)throw selectionError('추출할 페이지 범위를 입력하세요. 예: 1-3, 5, 8-10');
    const max=Number.isInteger(pageCount)&&pageCount>0?pageCount:null;
    const pages=[];
    const seen=new Set();
    for(const rawPart of source.split(',')){
      const part=rawPart.trim();
      if(!part)throw selectionError('페이지 범위에 빈 항목이 있습니다. 쉼표 앞뒤 값을 확인하세요.');
      const match=part.match(/^(\d+)\s*(?:-\s*(\d+))?$/);
      if(!match)throw selectionError(`페이지 범위 형식이 올바르지 않습니다: ${part}`);
      const start=Number(match[1]);
      const end=match[2]?Number(match[2]):start;
      if(start<1||end<1)throw selectionError('페이지 번호는 1 이상이어야 합니다.');
      if(end<start)throw selectionError(`범위 시작 페이지가 끝 페이지보다 큽니다: ${part}`);
      if(max&&(start>max||end>max))throw selectionError(`페이지 범위가 전체 ${max}페이지를 초과합니다: ${part}`);
      for(let page=start;page<=end;page+=1){
        if(!seen.has(page)){
          seen.add(page);
          pages.push(page);
        }
        if(pages.length>1000)throw selectionError('한 번에 추출할 수 있는 페이지는 최대 1000페이지입니다.');
      }
    }
    if(!pages.length)throw selectionError('추출할 페이지가 없습니다.');
    return pages;
  }

  function knownPageCount(file){
    const state=utility()?.state;
    const report=state?.reports?.get?.(fileKey(file));
    const count=Number(report?.page_count||0);
    return Number.isInteger(count)&&count>0?count:null;
  }

  function pdfLibSource(){
    return localRuntime()?.pdfLibSource||'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js';
  }

  function ensurePdfLib(){
    if(window.PDFLib?.PDFDocument)return Promise.resolve(window.PDFLib);
    if(pdfLibPromise)return pdfLibPromise;
    pdfLibPromise=new Promise((resolve,reject)=>{
      const existing=document.querySelector('script[data-pdf-local-lib="pdf-lib"]');
      if(existing){
        const started=Date.now();
        const wait=()=>{
          if(window.PDFLib?.PDFDocument)return resolve(window.PDFLib);
          if(Date.now()-started>15000)return reject(new Error('로컬 PDF 엔진을 불러오지 못했습니다.'));
          setTimeout(wait,50);
        };
        wait();
        return;
      }
      const script=document.createElement('script');
      script.src=pdfLibSource();
      script.async=true;
      script.crossOrigin='anonymous';
      script.referrerPolicy='no-referrer';
      script.dataset.pdfLocalLib='pdf-lib';
      const timer=setTimeout(()=>reject(new Error('로컬 PDF 엔진 로딩 시간이 초과되었습니다.')),15000);
      script.onload=()=>{
        clearTimeout(timer);
        if(window.PDFLib?.PDFDocument)resolve(window.PDFLib);
        else reject(new Error('로컬 PDF 엔진 초기화에 실패했습니다.'));
      };
      script.onerror=()=>{clearTimeout(timer);reject(new Error('로컬 PDF 엔진을 불러오지 못했습니다.'));};
      document.head.appendChild(script);
    }).catch(error=>{pdfLibPromise=null;throw error;});
    return pdfLibPromise;
  }

  function normalizePdfLibError(error){
    const message=String(error?.message||'');
    if(/encrypted|password|decrypt|encryption/i.test(message)){
      const normalized=new Error('암호화된 PDF는 먼저 암호를 해제하세요.');
      normalized.code='PDF_PAGE_SELECTION_INVALID';
      return normalized;
    }
    return error;
  }

  async function extractLocally(file,selection){
    const {PDFDocument}=await ensurePdfLib();
    setProgress(12,'✂️',`${file.name} 페이지 정보 확인 중`);
    const sourceBytes=await file.arrayBuffer();
    let source;
    try{
      source=await PDFDocument.load(sourceBytes,{ignoreEncryption:false,updateMetadata:false});
    }catch(error){
      throw normalizePdfLibError(error);
    }
    const pageCount=source.getPageCount?source.getPageCount():source.getPageIndices().length;
    const pages=parsePageSelection(selection,pageCount);
    setProgress(48,'✂️',`${pages.length}개 페이지 브라우저에서 추출 중`);
    const output=await PDFDocument.create();
    const copied=await output.copyPages(source,pages.map(page=>page-1));
    copied.forEach(page=>output.addPage(page));
    if(!copied.length)throw selectionError('추출할 페이지가 없습니다.');
    setProgress(82,'💾','브라우저에서 추출 PDF 생성 중');
    const bytes=await output.save({useObjectStreams:true,addDefaultPage:false,updateFieldAppearances:false});
    return {blob:new Blob([bytes],{type:'application/pdf'}),pageCount:copied.length,sourcePageCount:pageCount,pages};
  }

  async function ensureStorage(){
    if(typeof window._ensureStorage==='function')return window._ensureStorage();
    if(window.firebase?.storage)return firebase.storage();
    await new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      script.src='https://www.gstatic.com/firebasejs/9.23.0/firebase-storage-compat.js';
      script.onload=resolve;
      script.onerror=()=>reject(new Error('Firebase Storage SDK를 불러오지 못했습니다.'));
      document.head.appendChild(script);
    });
    return firebase.storage();
  }

  async function readPdfResponse(response,storageInstance){
    const contentType=response.headers.get('content-type')||'';
    if(!contentType.includes('application/json'))return response.blob();
    const delivery=await response.json();
    if(delivery?.delivery!=='storage'||!delivery.download_url)throw new Error('완성 PDF 다운로드 정보가 올바르지 않습니다.');
    const result=await fetch(delivery.download_url,{cache:'no-store'});
    if(!result.ok)throw new Error('완성 PDF를 내려받지 못했습니다.');
    const blob=await result.blob();
    if(delivery.storage_path&&storageInstance){
      try{await storageInstance.ref(delivery.storage_path).delete();}catch(_){}
    }
    return blob;
  }

  async function extractOnServer(file,selection){
    const user=window.auth?.currentUser;
    if(!user)throw new Error('로그인이 필요합니다.');
    const storageInstance=await ensureStorage();
    const session=`${Date.now().toString(36)}${Math.random().toString(36).slice(2,8)}`;
    const safe=file.name.replace(/[^A-Za-z0-9_.-]+/g,'_').slice(0,70)||'document.pdf';
    const storagePath=`pdf_temp/${user.uid}/${session}/01_${safe.toLowerCase().endsWith('.pdf')?safe:safe+'.pdf'}`;
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),285000);
    try{
      showStatus('페이지 추출을 위해 선택 PDF를 서버에 업로드하는 중입니다.');
      setProgress(20,'📤','PDF 업로드 중');
      await storageInstance.ref(storagePath).put(file,{contentType:'application/pdf'});
      const token=await user.getIdToken(true);
      setProgress(52,'✂️','서버에서 페이지 추출 중');
      const response=await fetch('/api/pdf-utility/extract-storage',{
        method:'POST',
        headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
        body:JSON.stringify({storage_path:storagePath,filename:file.name,page_selection:String(selection||'')}),
        signal:controller.signal
      });
      if(!response.ok){
        let message=`서버 오류 (${response.status})`;
        try{const payload=await response.json();message=payload?.detail||payload?.message||message;}catch(_){}
        throw new Error(message);
      }
      const pageCount=Number(response.headers.get('X-PDF-Page-Count')||0);
      return {blob:await readPdfResponse(response,storageInstance),pageCount};
    }catch(error){
      if(error?.name==='AbortError')throw new Error('처리 시간이 초과되었습니다. 파일 크기나 페이지 수를 줄여 다시 시도하세요.');
      throw error;
    }finally{
      clearTimeout(timer);
      try{await storageInstance.ref(storagePath).delete();}catch(_){}
    }
  }

  function setBusy(value,label='페이지 추출'){
    busy=Boolean(value);
    const state=utility()?.state;
    if(state)state.busy=busy;
    if(typeof window.setPageBusy==='function')window.setPageBusy(busy,label);
    for(const button of document.querySelectorAll('.action-grid .action-btn'))button.disabled=busy||button.id==='pdfUtilityMergeBtn'&&Number(state?.files?.length||0)<2;
    for(const id of ['pdfUtilityModalRun','pdfUtilityModalClose','pdfUtilityModalCancel'])if($(id))$(id).disabled=busy;
    const extract=$('pdfUtilityExtractBtn');
    if(extract&&!busy)extract.disabled=!activeFile();
  }

  async function runExtract(selection){
    if(busy)return false;
    const file=activeFile();
    if(!file){showError('페이지를 추출할 PDF를 선택하세요.');return false;}
    try{
      parsePageSelection(selection,knownPageCount(file));
    }catch(error){
      showError(error.message);
      return false;
    }

    setBusy(true,'페이지 추출');
    try{
      const limit=localLimit();
      if(Number(file.size||0)<=limit){
        setMode('local',`${file.name} · ${mb(file.size)} · 페이지 추출은 서버 업로드 없이 처리합니다.`);
        showStatus(`${file.name}에서 지정한 페이지를 브라우저에서 직접 추출하는 중입니다. 서버 업로드 없음.`,'info');
        setProgress(4,'✂️','브라우저 로컬 페이지 추출 준비 중');
        try{
          const result=await extractLocally(file,selection);
          downloadBlob(result.blob,`${safeBaseName(file)}_페이지추출_${result.pageCount}p.pdf`);
          setProgress(100,'✅','브라우저 로컬 페이지 추출 완료');
          showStatus(`페이지 추출 완료 · ${result.pageCount}페이지 · 서버 업로드 없음`,'ok');
          setMode('local-success',`${result.pageCount}페이지 · 서버 업로드 없이 페이지 추출을 완료했습니다.`);
          document.documentElement.dataset.pdfPageExtractLastResult='local-success';
          stopProgressSoon();
          return true;
        }catch(error){
          if(error?.code==='PDF_PAGE_SELECTION_INVALID')throw error;
          setMode('server-fallback',`${error?.message||'로컬 처리 호환 오류'} 기존 서버 처리로 계속 진행합니다.`);
          showStatus('브라우저 로컬 페이지 추출이 어려워 서버 처리로 자동 전환합니다.','info');
        }
      }else{
        setMode('server-fallback',`로컬 권장 한도 ${mb(limit)}를 초과했습니다. 현재 ${mb(file.size)}이므로 서버 처리합니다.`);
        showStatus(`파일이 로컬 권장 한도 ${mb(limit)}를 초과해 서버 처리로 전환합니다.`,'info');
      }

      const result=await extractOnServer(file,selection);
      const count=result.pageCount||parsePageSelection(selection).length;
      downloadBlob(result.blob,`${safeBaseName(file)}_페이지추출_${count}p.pdf`);
      setProgress(100,'✅','서버 페이지 추출 완료');
      showStatus(`페이지 추출 완료 · ${count}페이지 · 서버 처리`,'ok');
      document.documentElement.dataset.pdfPageExtractLastResult='server-success';
      stopProgressSoon();
      return true;
    }catch(error){
      showError(error?.message||'PDF 페이지 추출에 실패했습니다.');
      showStatus(error?.message||'PDF 페이지 추출 실패','err');
      document.documentElement.dataset.pdfPageExtractLastResult='error';
      return false;
    }finally{
      setBusy(false);
    }
  }

  function openExtractModal(){
    const file=activeFile();
    if(!file)return showError('페이지를 추출할 PDF를 선택하세요.');
    const overlay=$('pdfUtilityModalOverlay');
    if(!overlay||!$('pdfUtilityModalTitle')||!$('pdfUtilityModalBody'))return showError('페이지 추출 창을 준비하지 못했습니다. 새로고침 후 다시 시도하세요.');
    $('pdfUtilityModalTitle').textContent='PDF 페이지 추출';
    const known=knownPageCount(file);
    $('pdfUtilityModalDesc').textContent=`선택 파일: ${file.name}${known?` · 전체 ${known}페이지`:''}`;
    $('pdfUtilityModalBody').innerHTML=`<label for="pdfUtilityExtractRange" style="display:block;font-size:12px;font-weight:900;color:#172033;margin-bottom:7px">추출할 페이지 범위</label><input id="pdfUtilityExtractRange" type="text" inputmode="numeric" autocomplete="off" placeholder="예: 1-3, 5, 8-10" style="width:100%;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:10px;padding:11px 12px;font-size:13px;font-weight:800;color:#172033;outline:none"><div style="font-size:10px;color:#64748b;line-height:1.55;margin-top:8px">쉼표와 범위를 함께 사용할 수 있습니다. 예: <strong>1-3, 5, 8-10</strong>. 중복 페이지는 한 번만 추출되며 입력한 범위 순서를 유지합니다.</div><div class="pdfu-warning"><strong>처리 방식:</strong> ${mb(localLimit())} 이하에서는 브라우저에서 먼저 처리해 파일을 서버로 보내지 않습니다. 큰 파일이나 호환되지 않는 PDF만 서버 처리로 자동 전환합니다.</div>`;
    const run=$('pdfUtilityModalRun');
    run.textContent='페이지 추출 실행';
    run.onclick=async()=>{
      const selection=$('pdfUtilityExtractRange')?.value||'';
      const success=await runExtract(selection);
      if(success&&!busy)overlay.classList.remove('open');
    };
    overlay.classList.add('open');
    setTimeout(()=>$('pdfUtilityExtractRange')?.focus(),0);
  }

  function createAction(){
    if($('pdfUtilityExtractBtn'))return $('pdfUtilityExtractBtn');
    const grid=document.querySelector('.action-grid');
    if(!grid||!utility())return null;
    const button=document.createElement('button');
    button.type='button';
    button.className='action-btn pdfu-action';
    button.id='pdfUtilityExtractBtn';
    button.dataset.processingMode='local-first';
    button.innerHTML='<span class="action-chip chip-blue">로컬 우선</span><div class="action-icon" style="background:#eef7ff">✂️</div><div class="action-name">페이지 추출</div><div class="action-desc">선택 PDF에서 필요한 페이지 범위를 새 PDF로 저장합니다.</div>';
    button.addEventListener('click',openExtractModal);
    grid.appendChild(button);
    return button;
  }

  function install(){
    const api=utility();
    if(!api?.state||!$('pdfUtilityModalOverlay'))return false;
    const button=createAction();
    if(button&&!busy)button.disabled=!activeFile();
    const note=document.querySelector('.pdfu-limit-note');
    if(note&&!note.dataset.pageExtractNote){
      note.dataset.pageExtractNote='1';
      note.append(' 페이지 추출도 120MB 이하에서 브라우저 로컬 처리를 우선합니다.');
    }
    if(document.documentElement.dataset.pdfProcessingMode==='ready'){
      setMode('ready','PDF 합치기와 페이지 추출은 서버 업로드 없이 브라우저 로컬 처리를 먼저 시도합니다.');
    }
    api.openExtractModal=openExtractModal;
    api.runExtract=runExtract;
    document.documentElement.dataset.pdfPageExtract='local-first';
    return true;
  }

  const observer=new MutationObserver(()=>install());
  observer.observe(document.documentElement,{childList:true,subtree:true});
  [0,100,300,700,1200,2200].forEach(delay=>setTimeout(install,delay));

  window.ProgramStudioPdfPageExtract=Object.freeze({
    version:'2026.09.04.001',
    strategy:'local-first-with-server-fallback',
    parsePageSelection,
    extractLocally,
    runExtract,
    openExtractModal,
    localLimitBytes:localLimit
  });
})();
