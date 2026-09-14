// PDF editor/layout image-input bridge.
// Images are normalized to one-page PDFs before the canonical PDF editor sees them.
(function(){
  'use strict';
  if(window.__pdfEditorImageInputBridgeV1)return;
  window.__pdfEditorImageInputBridgeV1=true;

  const adapter=()=>window.ProgramImagePdfAdapter;
  const $=id=>document.getElementById(id);
  let busy=false;

  function showError(message){
    try{
      if(typeof window.showStatus==='function')window.showStatus(message,'error');
      else console.error('[pdf-image-input]',message);
    }catch(_){console.error('[pdf-image-input]',message);}
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
    if(sub)sub.textContent='PDF · JPG · PNG · WEBP · 이미지는 300dpi 기준 1페이지로 가져옵니다';
    document.documentElement.dataset.pdfImageInput='ready';
  }

  async function importFiles(files){
    const api=adapter();
    if(!api||typeof window.handleFile!=='function'){
      showError('이미지 입력 모듈을 준비하지 못했습니다.');
      return;
    }
    const incoming=Array.from(files||[]);
    const supported=incoming.filter(api.isSupported);
    const rejected=incoming.filter(file=>!api.isSupported(file));
    if(rejected.length)showError('PDF, JPG, PNG, WEBP 파일만 사용할 수 있습니다.');
    if(!supported.length)return;

    busy=true;
    try{
      for(const original of supported){
        let normalized=original;
        if(api.isImage(original)){
          try{
            if(typeof window.showStatus==='function')window.showStatus(`"${original.name}" 이미지 변환 중...`);
            normalized=await api.normalizeFile(original,{dpi:300,quality:0.92});
          }catch(error){
            showError(error?.message||`${original.name}: 이미지를 변환하지 못했습니다.`);
            continue;
          }
        }
        await window.handleFile(normalized);
      }
      document.documentElement.dataset.pdfImageImport='complete';
    }finally{
      busy=false;
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
      if(busy||!hasImage(event.target.files))return;
      event.stopImmediatePropagation();
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
      if(busy||!event.dataTransfer?.files?.length||!hasImage(event.dataTransfer.files))return;
      event.preventDefault();
      event.stopImmediatePropagation();
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
    stage:'pdf-editor-image-input-v1-adapter-isolated'
  };

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
