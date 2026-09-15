// PDF editor/layout image-input bridge.
// Images are normalized to one-page PDFs before the canonical PDF editor sees them.
(function(){
  'use strict';
  if(window.__pdfEditorImageInputBridgeV1)return;
  window.__pdfEditorImageInputBridgeV1=true;

  const NORMALIZE_TIMEOUT_MS=30000;
  const HANDLE_FILE_TIMEOUT_MS=45000;
  const adapter=()=>window.ProgramImagePdfAdapter;
  const $=id=>document.getElementById(id);
  let busy=false;
  let importSerial=0;

  function withTimeout(promise,timeoutMs,message){
    let timer;
    return Promise.race([
      Promise.resolve(promise),
      new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(message)),timeoutMs);})
    ]).finally(()=>clearTimeout(timer));
  }

  function showError(message){
    try{
      if(typeof window.showStatus==='function')window.showStatus(message,'error');
      else console.error('[pdf-image-input]',message);
    }catch(_){console.error('[pdf-image-input]',message);}
  }

  function editorPages(){
    try{if(Array.isArray(parsedPages))return parsedPages;}catch(_){ }
    return Array.isArray(window.parsedPages)?window.parsedPages:null;
  }

  function pageIdSnapshot(){
    const pages=editorPages();
    return new Set((pages||[]).map(page=>String(page?.id||'')).filter(Boolean));
  }

  function tagImportedImagePages(original,normalized,beforeIds){
    const pages=editorPages();
    if(!pages||!original||normalized?.__sourceType!=='image')return 0;
    const meta=normalized.__imageMeta&&typeof normalized.__imageMeta==='object'?{...normalized.__imageMeta}:null;
    let tagged=0;
    pages.forEach(page=>{
      const id=String(page?.id||'');
      if(!page||page.pageType==='blank'||page.pageType==='divider'||(id&&beforeIds?.has(id)))return;
      page.sourceType='image';
      page.sourceOriginalName=original.name||normalized.__displayName||normalized.name;
      page.sourceFile=page.sourceOriginalName;
      page.imageMeta=meta?{...meta}:null;
      tagged++;
    });
    if(tagged){
      document.documentElement.dataset.pdfImageTaggedPages=String(tagged);
      try{if(typeof renderThumbs==='function')renderThumbs();}catch(error){console.warn('[pdf-image-input] thumbnail label refresh failed',error);}
    }
    return tagged;
  }

  function updateUi(){
    const api=adapter();
    const input=$('fileInput');
    if(api&&input)input.accept=api.acceptString();
    const zone=$('uploadZone');
    if(zone)zone.setAttribute('aria-label','PDF 또는 이미지 파일 선택');
    const text=$('uploadZoneText');
    if(text)text.textContent='PDF / 이미지 클릭 또는 드래그';
    const sub=$('uploadZoneSub');
    if(sub)sub.textContent='PDF · JPG · PNG · WEBP · 이미지는 300dpi 기준 1페이지로 가져와 기존 회전·배치 편집에 그대로 사용합니다';
    document.documentElement.dataset.pdfImageInput='ready';
  }

  async function importFiles(files){
    const api=adapter();
    if(!api||typeof window.handleFile!=='function'){
      showError('이미지 입력 모듈을 준비하지 못했습니다.');
      return false;
    }
    if(busy){
      showError('현재 파일을 불러오는 중입니다. 완료 후 다시 시도해 주세요.');
      return false;
    }

    const incoming=Array.from(files||[]);
    const supported=incoming.filter(api.isSupported);
    const rejected=incoming.filter(file=>!api.isSupported(file));
    if(rejected.length)showError('PDF, JPG, PNG, WEBP 파일만 사용할 수 있습니다.');
    if(!supported.length)return false;

    const runId=++importSerial;
    busy=true;
    document.documentElement.dataset.pdfImageImport='working';
    let importedCount=0;
    try{
      for(const original of supported){
        let normalized=original;
        const imageSource=api.isImage(original);
        if(imageSource){
          try{
            if(typeof window.showStatus==='function')window.showStatus(`"${original.name}" 이미지 변환 중...`);
            normalized=await withTimeout(
              api.normalizeFile(original,{dpi:300,quality:0.92}),
              NORMALIZE_TIMEOUT_MS,
              `${original.name}: 이미지 변환 시간이 초과되었습니다. 파일 크기를 줄이거나 다시 저장한 뒤 시도해 주세요.`
            );
          }catch(error){
            showError(error?.message||`${original.name}: 이미지를 변환하지 못했습니다.`);
            continue;
          }
        }

        const beforeIds=imageSource?pageIdSnapshot():null;
        try{
          await withTimeout(
            window.handleFile(normalized),
            HANDLE_FILE_TIMEOUT_MS,
            `${original.name}: PDF 불러오기 시간이 초과되었습니다. 파일을 확인한 뒤 다시 시도해 주세요.`
          );
        }catch(error){
          showError(error?.message||`${original.name}: 파일을 불러오지 못했습니다.`);
          continue;
        }
        if(runId!==importSerial)break;
        if(imageSource)tagImportedImagePages(original,normalized,beforeIds);
        importedCount++;
      }
      document.documentElement.dataset.pdfImageImport=importedCount?'complete':'failed';
      return importedCount>0;
    }finally{
      if(runId===importSerial)busy=false;
    }
  }

  function hasImage(files){
    const api=adapter();
    return Boolean(api&&Array.from(files||[]).some(api.isImage));
  }

  function bindInput(){
    const input=$('fileInput');
    if(!input||input.dataset.imageBridgeBound==='true')return false;
    input.dataset.imageBridgeBound='true';
    input.addEventListener('change',event=>{
      if(!hasImage(event.target.files))return;
      event.stopImmediatePropagation();
      if(busy){
        showError('현재 파일을 불러오는 중입니다. 완료 후 다시 시도해 주세요.');
        event.target.value='';
        return;
      }
      const files=Array.from(event.target.files||[]);
      event.target.value='';
      importFiles(files);
    },true);
    return true;
  }

  function bindDrop(){
    if(document.documentElement.dataset.pdfImageDropBridge==='true')return true;
    document.documentElement.dataset.pdfImageDropBridge='true';
    document.addEventListener('drop',event=>{
      if(!event.dataTransfer?.files?.length||!hasImage(event.dataTransfer.files))return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if(busy){
        showError('현재 파일을 불러오는 중입니다. 완료 후 다시 시도해 주세요.');
        return;
      }
      importFiles(Array.from(event.dataTransfer.files));
    },true);
    return true;
  }

  function boot(){
    updateUi();
    bindInput();
    bindDrop();
  }

  window.PdfEditorImageInput={
    importFiles,
    updateUi,
    tagImportedImagePages,
    get busy(){return busy;},
    stage:'pdf-editor-image-input-v3-production-hardening'
  };

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
