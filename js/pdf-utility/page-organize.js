// PDF Utility page delete/reorder: browser-local first with existing extract fallback.
(function(){
  'use strict';
  if(window.__pdfUtilityPageOrganizeV1)return;
  window.__pdfUtilityPageOrganizeV1=true;

  const path=location.pathname.replace(/\/+$/,'')||'/';
  if(!(path==='/pdf-preflight'||path.endsWith('/pdf-preflight/index.html')||path.endsWith('/tools/pdf-Checker.html')||path.endsWith('/tools/preflight.html')))return;

  const DEFAULT_LOCAL_LIMIT_BYTES=120*1024*1024;
  let busy=false;
  const $=id=>document.getElementById(id);
  const utility=()=>window.PdfUtility||null;
  const extractRuntime=()=>window.ProgramStudioPdfPageExtract||null;
  const localRuntime=()=>window.ProgramStudioPdfLocalProcessing||null;
  const mb=bytes=>`${(Number(bytes||0)/1024/1024).toFixed(1)}MB`;
  const fileKey=file=>`${file?.name||''}|${Number(file?.size||0)}|${Number(file?.lastModified||0)}`;
  const activeFile=()=>{
    const state=utility()?.state;
    return state?.files?.[Number(state.activeIndex||0)]||null;
  };
  const safeBaseName=file=>String(file?.name||'document.pdf').replace(/\.pdf$/i,'').replace(/[\\/:*?"<>|]+/g,'_').slice(0,70)||'document';
  const localLimit=()=>{
    const value=extractRuntime()?.localLimitBytes;
    if(typeof value==='function')return Number(value())||DEFAULT_LOCAL_LIMIT_BYTES;
    return Number(localRuntime()?.localMergeLimitBytes||DEFAULT_LOCAL_LIMIT_BYTES);
  };

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
  function stopProgressSoon(){setTimeout(()=>{if(!busy&&typeof window.stopProgress==='function')window.stopProgress();},900);}
  function setMode(mode,message){
    if(typeof localRuntime()?.setMode==='function')localRuntime().setMode(mode,message);
    else document.documentElement.dataset.pdfProcessingMode=mode;
  }
  function selectionError(message){
    const error=new Error(message);
    error.code='PDF_PAGE_ORGANIZE_INVALID';
    return error;
  }
  function knownPageCount(file){
    const report=utility()?.state?.reports?.get?.(fileKey(file));
    const count=Number(report?.page_count||0);
    return Number.isInteger(count)&&count>0?count:null;
  }
  function parseSelection(value,pageCount=null){
    const parser=extractRuntime()?.parsePageSelection;
    if(typeof parser!=='function')throw selectionError('페이지 처리 엔진이 아직 준비되지 않았습니다. 잠시 후 다시 시도하세요.');
    try{return parser(value,pageCount);}catch(error){
      if(error?.code==='PDF_PAGE_SELECTION_INVALID')throw selectionError(error.message);
      throw error;
    }
  }
  function pagesToSelection(pages){return pages.join(',');}
  function buildDeletePlan(deleteSelection,pageCount){
    if(!Number.isInteger(pageCount)||pageCount<1)throw selectionError('전체 페이지 수를 확인할 수 없습니다. 먼저 PDF 검수를 실행한 뒤 다시 시도하세요.');
    const deleted=parseSelection(deleteSelection,pageCount);
    const deletedSet=new Set(deleted);
    const keep=[];
    for(let page=1;page<=pageCount;page+=1)if(!deletedSet.has(page))keep.push(page);
    if(!keep.length)throw selectionError('모든 페이지를 삭제할 수 없습니다. 최소 1페이지는 남겨야 합니다.');
    return {deleted,keep,selection:pagesToSelection(keep)};
  }
  function buildReorderPlan(selection,pageCount=null){
    const pages=parseSelection(selection,pageCount);
    if(!pages.length)throw selectionError('저장할 페이지 순서를 입력하세요.');
    return {pages,selection:pagesToSelection(pages)};
  }

  async function resolveLocalPlan(file,action,selection){
    if(action==='reorder')return buildReorderPlan(selection,knownPageCount(file));
    const known=knownPageCount(file);
    if(known)return buildDeletePlan(selection,known);
    const runtime=extractRuntime();
    if(typeof runtime?.extractLocally!=='function')throw selectionError('페이지 처리 엔진이 준비되지 않았습니다.');
    // Unknown page count: ask pdf-lib for the page count without producing a final file.
    const probe=await runtime.extractLocally(file,'1');
    const count=Number(probe?.sourcePageCount||0);
    return buildDeletePlan(selection,count);
  }

  async function organizeLocally(file,action,selection){
    const runtime=extractRuntime();
    if(typeof runtime?.extractLocally!=='function')throw new Error('로컬 페이지 처리 엔진을 불러오지 못했습니다.');
    const plan=await resolveLocalPlan(file,action,selection);
    setProgress(45,action==='delete'?'🗑️':'↕️',action==='delete'?'삭제할 페이지를 제외하고 새 PDF 구성 중':'입력한 순서대로 새 PDF 구성 중');
    const result=await runtime.extractLocally(file,plan.selection);
    return {blob:result.blob,pageCount:result.pageCount,sourcePageCount:result.sourcePageCount,plan};
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
    if(delivery.storage_path&&storageInstance){try{await storageInstance.ref(delivery.storage_path).delete();}catch(_){}}
    return blob;
  }
  async function organizeOnServer(file,action,selection){
    const user=window.auth?.currentUser;
    if(!user)throw new Error('로그인이 필요합니다.');
    let targetSelection='';
    if(action==='delete'){
      const count=knownPageCount(file);
      if(!count)throw selectionError('대용량 PDF에서 페이지를 삭제하려면 먼저 PDF 검수를 실행해 전체 페이지 수를 확인하세요.');
      targetSelection=buildDeletePlan(selection,count).selection;
    }else{
      targetSelection=buildReorderPlan(selection,knownPageCount(file)).selection;
    }
    const storageInstance=await ensureStorage();
    const session=`${Date.now().toString(36)}${Math.random().toString(36).slice(2,8)}`;
    const safe=file.name.replace(/[^A-Za-z0-9_.-]+/g,'_').slice(0,70)||'document.pdf';
    const storagePath=`pdf_temp/${user.uid}/${session}/01_${safe.toLowerCase().endsWith('.pdf')?safe:safe+'.pdf'}`;
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),285000);
    try{
      showStatus(action==='delete'?'페이지 삭제를 위해 PDF를 서버에 업로드하는 중입니다.':'페이지 재정렬을 위해 PDF를 서버에 업로드하는 중입니다.');
      setProgress(20,'📤','PDF 업로드 중');
      await storageInstance.ref(storagePath).put(file,{contentType:'application/pdf'});
      const token=await user.getIdToken(true);
      setProgress(55,action==='delete'?'🗑️':'↕️',action==='delete'?'서버에서 페이지 삭제 중':'서버에서 페이지 재정렬 중');
      const response=await fetch('/api/pdf-utility/extract-storage',{
        method:'POST',
        headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
        body:JSON.stringify({storage_path:storagePath,filename:file.name,page_selection:targetSelection}),
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
  function setBusy(value,label='페이지 정리'){
    busy=Boolean(value);
    const state=utility()?.state;
    if(state)state.busy=busy;
    if(typeof window.setPageBusy==='function')window.setPageBusy(busy,label);
    for(const button of document.querySelectorAll('.action-grid .action-btn'))button.disabled=busy||button.id==='pdfUtilityMergeBtn'&&Number(state?.files?.length||0)<2;
    for(const id of ['pdfUtilityModalRun','pdfUtilityModalClose','pdfUtilityModalCancel'])if($(id))$(id).disabled=busy;
    const organize=$('pdfUtilityOrganizeBtn');
    if(organize&&!busy)organize.disabled=!activeFile();
  }

  async function runOrganize(action,selection){
    if(busy)return false;
    const file=activeFile();
    if(!file){showError('페이지를 정리할 PDF를 선택하세요.');return false;}
    if(action!=='delete'&&action!=='reorder'){showError('페이지 정리 방식을 선택하세요.');return false;}
    try{
      if(action==='reorder')buildReorderPlan(selection,knownPageCount(file));
      else if(knownPageCount(file))buildDeletePlan(selection,knownPageCount(file));
      else parseSelection(selection);
    }catch(error){showError(error.message);return false;}

    setBusy(true,action==='delete'?'페이지 삭제':'페이지 재정렬');
    try{
      const limit=localLimit();
      let result=null;
      let server=false;
      if(Number(file.size||0)<=limit){
        setMode('local',`${file.name} · ${mb(file.size)} · 페이지 ${action==='delete'?'삭제':'재정렬'}는 서버 업로드 없이 처리합니다.`);
        showStatus(`브라우저에서 페이지 ${action==='delete'?'삭제':'재정렬'} 작업을 직접 처리하는 중입니다. 서버 업로드 없음.`,'info');
        setProgress(5,action==='delete'?'🗑️':'↕️','브라우저 로컬 페이지 정리 준비 중');
        try{result=await organizeLocally(file,action,selection);}catch(error){
          if(error?.code==='PDF_PAGE_ORGANIZE_INVALID'||error?.code==='PDF_PAGE_SELECTION_INVALID')throw error;
          setMode('server-fallback',`${error?.message||'로컬 처리 호환 오류'} 기존 서버 처리로 계속 진행합니다.`);
          showStatus('브라우저 로컬 페이지 정리가 어려워 서버 처리로 자동 전환합니다.','info');
        }
      }else{
        setMode('server-fallback',`로컬 권장 한도 ${mb(limit)}를 초과했습니다. 현재 ${mb(file.size)}이므로 서버 처리합니다.`);
        showStatus(`파일이 로컬 권장 한도 ${mb(limit)}를 초과해 서버 처리로 전환합니다.`,'info');
      }
      if(!result){result=await organizeOnServer(file,action,selection);server=true;}
      const count=Number(result.pageCount||0);
      const suffix=action==='delete'?'페이지삭제':'페이지재정렬';
      downloadBlob(result.blob,`${safeBaseName(file)}_${suffix}_${count||'결과'}p.pdf`);
      setProgress(100,'✅',server?'서버 페이지 정리 완료':'브라우저 로컬 페이지 정리 완료');
      showStatus(`${action==='delete'?'페이지 삭제':'페이지 재정렬'} 완료${count?` · ${count}페이지`:''} · ${server?'서버 처리':'서버 업로드 없음'}`,'ok');
      setMode(server?'server-success':'local-success',`${action==='delete'?'페이지 삭제':'페이지 재정렬'} 작업을 완료했습니다.`);
      document.documentElement.dataset.pdfPageOrganizeLastResult=server?'server-success':'local-success';
      stopProgressSoon();
      return true;
    }catch(error){
      showError(error?.message||'PDF 페이지 정리에 실패했습니다.');
      showStatus(error?.message||'PDF 페이지 정리 실패','err');
      document.documentElement.dataset.pdfPageOrganizeLastResult='error';
      return false;
    }finally{setBusy(false);}
  }

  function renderForm(action){
    const body=$('pdfUtilityModalBody');
    if(!body)return;
    const isDelete=action==='delete';
    const file=activeFile();
    const known=knownPageCount(file);
    body.innerHTML=`<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px"><button type="button" id="pdfUtilityOrganizeDeleteMode" class="pdfu-mini-btn" data-active="${isDelete?'1':'0'}">🗑️ 페이지 삭제</button><button type="button" id="pdfUtilityOrganizeReorderMode" class="pdfu-mini-btn" data-active="${isDelete?'0':'1'}">↕️ 순서 재정렬</button></div><label for="pdfUtilityOrganizeRange" style="display:block;font-size:12px;font-weight:900;color:#172033;margin-bottom:7px">${isDelete?'삭제할 페이지':'새 페이지 순서'}</label><input id="pdfUtilityOrganizeRange" type="text" inputmode="numeric" autocomplete="off" placeholder="${isDelete?'예: 2, 4-6':'예: 5, 1-3, 4'}" style="width:100%;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:10px;padding:11px 12px;font-size:13px;font-weight:800;color:#172033;outline:none"><div style="font-size:10px;color:#64748b;line-height:1.55;margin-top:8px">${isDelete?'입력한 페이지만 제거하고 나머지는 원래 순서대로 저장합니다.':'입력한 순서가 결과 PDF의 페이지 순서가 됩니다. 입력에서 빠진 페이지는 결과에서 제외됩니다.'}</div><div class="pdfu-warning"><strong>처리 방식:</strong> ${mb(localLimit())} 이하에서는 브라우저 로컬 처리를 우선합니다.${isDelete&&!known?' 대용량 서버 처리 시에는 먼저 PDF 검수로 전체 페이지 수를 확인해야 합니다.':''}</div>`;
    const deleteMode=$('pdfUtilityOrganizeDeleteMode');
    const reorderMode=$('pdfUtilityOrganizeReorderMode');
    const styleMode=button=>{
      if(!button)return;
      const active=button.dataset.active==='1';
      button.style.cssText=`border:1px solid ${active?'#0e7490':'#cbd5e1'};border-radius:9px;padding:9px;background:${active?'#ecfeff':'#fff'};color:${active?'#0e7490':'#475569'};font-weight:900;cursor:pointer`;
    };
    styleMode(deleteMode);styleMode(reorderMode);
    deleteMode.onclick=()=>renderForm('delete');
    reorderMode.onclick=()=>renderForm('reorder');
    body.dataset.organizeAction=action;
    setTimeout(()=>$('pdfUtilityOrganizeRange')?.focus(),0);
  }
  function openOrganizeModal(){
    const file=activeFile();
    if(!file)return showError('페이지를 정리할 PDF를 선택하세요.');
    const overlay=$('pdfUtilityModalOverlay');
    if(!overlay||!$('pdfUtilityModalTitle')||!$('pdfUtilityModalBody'))return showError('페이지 정리 창을 준비하지 못했습니다. 새로고침 후 다시 시도하세요.');
    $('pdfUtilityModalTitle').textContent='PDF 페이지 삭제 · 재정렬';
    const known=knownPageCount(file);
    $('pdfUtilityModalDesc').textContent=`선택 파일: ${file.name}${known?` · 전체 ${known}페이지`:''}`;
    renderForm('delete');
    const run=$('pdfUtilityModalRun');
    run.textContent='페이지 정리 실행';
    run.onclick=async()=>{
      const action=$('pdfUtilityModalBody')?.dataset.organizeAction||'delete';
      const selection=$('pdfUtilityOrganizeRange')?.value||'';
      const success=await runOrganize(action,selection);
      if(success&&!busy)overlay.classList.remove('open');
    };
    overlay.classList.add('open');
  }
  function createAction(){
    if($('pdfUtilityOrganizeBtn'))return $('pdfUtilityOrganizeBtn');
    const grid=document.querySelector('.action-grid');
    if(!grid||!utility())return null;
    const button=document.createElement('button');
    button.type='button';
    button.className='action-btn pdfu-action';
    button.id='pdfUtilityOrganizeBtn';
    button.dataset.processingMode='local-first';
    button.innerHTML='<span class="action-chip chip-blue">로컬 우선</span><div class="action-icon" style="background:#f0fdfa">↕️</div><div class="action-name">페이지 삭제 · 재정렬</div><div class="action-desc">불필요한 페이지를 지우거나 원하는 순서로 다시 저장합니다.</div>';
    button.addEventListener('click',openOrganizeModal);
    grid.appendChild(button);
    return button;
  }
  function install(){
    const api=utility();
    if(!api?.state||!$('pdfUtilityModalOverlay')||!extractRuntime())return false;
    const button=createAction();
    if(button&&!busy)button.disabled=!activeFile();
    const note=document.querySelector('.pdfu-limit-note');
    if(note&&!note.dataset.pageOrganizeNote){
      note.dataset.pageOrganizeNote='1';
      note.append(' 페이지 삭제·재정렬도 브라우저 로컬 처리를 우선합니다.');
    }
    api.openOrganizeModal=openOrganizeModal;
    api.runOrganize=runOrganize;
    document.documentElement.dataset.pdfPageOrganize='local-first';
    return true;
  }
  const observer=new MutationObserver(()=>install());
  observer.observe(document.documentElement,{childList:true,subtree:true});
  [0,100,300,700,1200,2200].forEach(delay=>setTimeout(install,delay));

  window.ProgramStudioPdfPageOrganize=Object.freeze({
    version:'2026.09.04.001',
    strategy:'local-first-with-existing-extract-fallback',
    buildDeletePlan,
    buildReorderPlan,
    organizeLocally,
    runOrganize,
    openOrganizeModal,
    localLimitBytes:localLimit
  });
})();
