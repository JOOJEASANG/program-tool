// PDF Utility local-first processing layer.
(function(){
  'use strict';
  if(window.__pdfUtilityLocalProcessingV1)return;
  window.__pdfUtilityLocalProcessingV1=true;

  const path=location.pathname.replace(/\/+$/,'')||'/';
  if(!(path==='/pdf-preflight'||path.endsWith('/pdf-preflight/index.html')||path.endsWith('/tools/pdf-Checker.html')||path.endsWith('/tools/preflight.html')))return;

  const PDF_LIB_SRC='https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js';
  const LOCAL_MERGE_LIMIT_BYTES=120*1024*1024;
  const trackedFiles=new Map();
  let pdfLibPromise=null;
  let bypassOnce=false;
  let localBusy=false;
  let fileListObserver=null;

  const $=id=>document.getElementById(id);
  const fileKey=file=>`${file?.name||''}|${Number(file?.size||0)}|${Number(file?.lastModified||0)}`;
  const isPdf=file=>file&&(/\.pdf$/i.test(file.name||'')||file.type==='application/pdf');
  const mb=bytes=>`${(Number(bytes||0)/1024/1024).toFixed(1)}MB`;

  function rememberFiles(fileList){
    Array.from(fileList||[]).filter(isPdf).forEach(file=>trackedFiles.set(fileKey(file),file));
    queueMicrotask(syncTrackedFilesFromDom);
  }

  function rows(){return Array.from(document.querySelectorAll('#pdfUtilityFileItems .pdfu-file-row'));}

  function resolveOrderedFiles(){
    const currentRows=rows();
    if(!currentRows.length)return [];
    const available=Array.from(trackedFiles.values());
    const used=new Set();
    const ordered=[];
    for(const row of currentRows){
      const name=row.querySelector('.pdfu-file-name')?.textContent?.trim()||'';
      let index=available.findIndex((file,i)=>!used.has(i)&&file.name===name);
      if(index<0)index=available.findIndex((_,i)=>!used.has(i));
      if(index<0)return null;
      used.add(index);
      ordered.push(available[index]);
    }
    return ordered.length===currentRows.length?ordered:null;
  }

  function syncTrackedFilesFromDom(){
    const currentRows=rows();
    if(!currentRows.length){
      if($('pdfUtilityFileItems'))trackedFiles.clear();
      return;
    }
    const ordered=resolveOrderedFiles();
    if(!ordered)return;
    const keep=new Set(ordered.map(fileKey));
    for(const key of Array.from(trackedFiles.keys()))if(!keep.has(key))trackedFiles.delete(key);
  }

  function installFileListObserver(){
    const target=$('pdfUtilityFileItems');
    if(!target||fileListObserver)return;
    fileListObserver=new MutationObserver(()=>queueMicrotask(syncTrackedFilesFromDom));
    fileListObserver.observe(target,{childList:true,subtree:true,characterData:true});
    syncTrackedFilesFromDom();
  }

  function ensureModeBadge(){
    let badge=$('pdfLocalProcessingMode');
    if(badge)return badge;
    const grid=document.querySelector('.action-grid');
    if(!grid)return null;
    badge=document.createElement('div');
    badge.id='pdfLocalProcessingMode';
    badge.setAttribute('role','status');
    badge.setAttribute('aria-live','polite');
    badge.style.cssText='grid-column:1/-1;border:1px solid #bae6fd;background:#f0fdff;color:#0e7490;border-radius:11px;padding:9px 11px;font-size:10px;font-weight:850;line-height:1.55';
    const strong=document.createElement('strong');
    const span=document.createElement('span');
    span.style.cssText='display:block;margin-top:2px;color:#64748b';
    badge.append(strong,span);
    grid.appendChild(badge);
    return badge;
  }

  function setMode(mode,message){
    const text=String(message||'');
    const labels={
      ready:'브라우저 로컬 우선',
      local:'브라우저에서 처리 중',
      'local-success':'브라우저 로컬 처리 완료',
      'server-fallback':'서버 처리로 자동 전환',
      error:'처리 오류'
    };
    document.documentElement.dataset.pdfProcessingMode=mode;
    const badge=ensureModeBadge();
    if(!badge)return;
    if(badge.dataset.mode===mode&&badge.dataset.message===text)return;
    badge.dataset.mode=mode;
    badge.dataset.message=text;
    const strong=badge.querySelector('strong');
    const span=badge.querySelector('span');
    const title=`처리 방식 · ${labels[mode]||mode}`;
    if(strong&&strong.textContent!==title)strong.textContent=title;
    if(span&&span.textContent!==text)span.textContent=text;
  }

  function updateMergeButton(){
    const button=$('pdfUtilityMergeBtn');
    if(!button)return;
    button.dataset.processingMode='local-first';
    const chip=button.querySelector('.action-chip');
    if(chip&&chip.textContent!=='로컬 우선')chip.textContent='로컬 우선';
    const desc=button.querySelector('.action-desc');
    const copy='120MB 이하에서는 브라우저에서 먼저 합치며, 호환되지 않는 경우에만 서버 처리로 자동 전환합니다.';
    if(desc&&desc.textContent!==copy)desc.textContent=copy;
    ensureModeBadge();
  }

  function setProgress(percent,icon,message){
    const box=$('progressBox');
    if(box)box.style.display='block';
    if(typeof window.setProgress==='function')window.setProgress(Math.max(0,Math.min(100,Math.round(percent))),icon,message);
  }

  function showStatus(message,type='info'){
    if(typeof window.showCheckStatus==='function')window.showCheckStatus(message,type);
  }

  function stopProgressSoon(){
    setTimeout(()=>{if(!localBusy&&typeof window.stopProgress==='function')window.stopProgress();},900);
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
      script.src=PDF_LIB_SRC;
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

  async function mergeLocally(files){
    const {PDFDocument}=await ensurePdfLib();
    const output=await PDFDocument.create();
    let pageCount=0;
    for(let index=0;index<files.length;index+=1){
      const file=files[index];
      const percent=10+Math.round((index/files.length)*65);
      setProgress(percent,'🧩',`${index+1}/${files.length} · ${file.name} 로컬 병합 중`);
      const sourceBytes=await file.arrayBuffer();
      const source=await PDFDocument.load(sourceBytes,{ignoreEncryption:false,updateMetadata:false});
      const indices=source.getPageIndices();
      const copied=await output.copyPages(source,indices);
      copied.forEach(page=>output.addPage(page));
      pageCount+=copied.length;
    }
    if(!pageCount)throw new Error('합칠 PDF 페이지가 없습니다.');
    setProgress(82,'💾','브라우저에서 완성 PDF 생성 중');
    const bytes=await output.save({useObjectStreams:true,addDefaultPage:false,updateFieldAppearances:false});
    return {blob:new Blob([bytes],{type:'application/pdf'}),pageCount};
  }

  function fallbackToServer(button,reason){
    const text=reason||'로컬 처리 조건을 충족하지 못했습니다.';
    setMode('server-fallback',`${text} 기존 서버 처리로 계속 진행합니다.`);
    showStatus(`로컬 처리 대신 서버 처리로 전환합니다. · ${text}`,'info');
    bypassOnce=true;
    button.disabled=false;
    queueMicrotask(()=>button.click());
  }

  async function runLocalFirstMerge(button){
    if(localBusy)return;
    syncTrackedFilesFromDom();
    const files=resolveOrderedFiles();
    if(!files||files.length<2){
      fallbackToServer(button,'브라우저에서 현재 파일 순서를 확인하지 못했습니다.');
      return;
    }
    const total=files.reduce((sum,file)=>sum+Number(file.size||0),0);
    if(total>LOCAL_MERGE_LIMIT_BYTES){
      fallbackToServer(button,`로컬 권장 한도 ${mb(LOCAL_MERGE_LIMIT_BYTES)}를 초과했습니다. 현재 ${mb(total)}입니다.`);
      return;
    }

    localBusy=true;
    button.disabled=true;
    document.documentElement.dataset.pdfLocalProcessingBusy='true';
    if(typeof window.setPageBusy==='function')window.setPageBusy(true,'PDF 합치기');
    setMode('local',`${files.length}개 · ${mb(total)} · 파일은 서버에 업로드되지 않습니다.`);
    showStatus(`PDF ${files.length}개를 브라우저에서 직접 합치는 중입니다. 서버 업로드 없음.`,'info');
    setProgress(4,'🔗','브라우저 로컬 병합 준비 중');

    try{
      const {blob,pageCount}=await mergeLocally(files);
      downloadBlob(blob,`PDF_합치기_${files.length}개_${pageCount}p.pdf`);
      setProgress(100,'✅','브라우저 로컬 PDF 합치기 완료');
      showStatus(`PDF 합치기 완료 · ${files.length}개 · 총 ${pageCount}페이지 · 서버 업로드 없음`,'ok');
      setMode('local-success',`${files.length}개 · 총 ${pageCount}페이지 · 서버 업로드 없이 완료했습니다.`);
      document.documentElement.dataset.pdfLocalProcessingLastResult='local-success';
      stopProgressSoon();
    }catch(error){
      const reason=error?.message||'브라우저 로컬 병합에 실패했습니다.';
      document.documentElement.dataset.pdfLocalProcessingLastResult='fallback';
      fallbackToServer(button,reason);
    }finally{
      localBusy=false;
      delete document.documentElement.dataset.pdfLocalProcessingBusy;
      if(typeof window.setPageBusy==='function')window.setPageBusy(false);
      if(!bypassOnce)button.disabled=files.length<2;
    }
  }

  function onDocumentChange(event){
    if(event.target?.id==='fileInput')rememberFiles(event.target.files);
  }

  function onDocumentDrop(event){
    if(event.target?.closest?.('#uploadZone'))rememberFiles(event.dataTransfer?.files);
  }

  function onDocumentClick(event){
    const button=event.target?.closest?.('#pdfUtilityMergeBtn');
    if(!button)return;
    if(bypassOnce){bypassOnce=false;return;}
    if(button.disabled||localBusy)return;
    event.preventDefault();
    event.stopImmediatePropagation();
    runLocalFirstMerge(button);
  }

  function install(){
    updateMergeButton();
    installFileListObserver();
    const note=document.querySelector('.pdfu-limit-note');
    if(note&&!note.dataset.localProcessingNote){
      note.dataset.localProcessingNote='1';
      note.append(' PDF 합치기는 120MB 이하에서 브라우저 로컬 처리를 우선해 불필요한 업로드를 줄입니다.');
    }
    if($('pdfUtilityMergeBtn')&&!document.documentElement.dataset.pdfProcessingMode){
      setMode('ready','PDF 합치기는 서버 업로드 없이 로컬 처리를 먼저 시도합니다.');
    }
  }

  document.addEventListener('change',onDocumentChange,true);
  document.addEventListener('drop',onDocumentDrop,true);
  document.addEventListener('click',onDocumentClick,true);
  const observer=new MutationObserver(install);
  observer.observe(document.documentElement,{childList:true,subtree:true});
  install();
  [100,300,700,1200,2200].forEach(delay=>setTimeout(install,delay));

  window.ProgramStudioPdfLocalProcessing=Object.freeze({
    version:'2026.09.04.002',
    strategy:'local-first-with-server-fallback',
    localMergeLimitBytes:LOCAL_MERGE_LIMIT_BYTES,
    pdfLibSource:PDF_LIB_SRC,
    resolveOrderedFiles,
    mergeLocally,
    setMode
  });
})();
