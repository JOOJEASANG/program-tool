// Smart Print Layout image-input bridge.
// Images are converted to ordinary one-page PDFs before the existing app sees them.
(function(){
  'use strict';
  if(window.__smartPrintLayoutImageInputBridgeV1)return;
  window.__smartPrintLayoutImageInputBridgeV1=true;

  const MAX_NORMALIZED_PDF_BYTES=20*1024*1024;
  const $=id=>document.getElementById(id);
  let replaying=false;
  let busy=false;
  let fileListObserver=null;

  const adapter=()=>window.ProgramImagePdfAdapter;

  function setStatus(message,type=''){
    const line=$('statusLine');
    if(!line)return;
    line.textContent=message;
    line.className=`status${type?` ${type}`:''}`;
  }

  function syncImageLabels(){
    const items=window.SmartPrintLayout?.state?.items;
    const list=$('fileList');
    if(!Array.isArray(items)||!list)return 0;
    const rows=Array.from(list.querySelectorAll('.file-item'));
    let decorated=0;
    items.forEach((item,index)=>{
      const file=item?.file;
      if(file?.__sourceType!=='image')return;
      const row=rows[index];
      if(!row)return;
      const displayName=file.__displayName||item.displayName||file.name||item.name||'이미지';
      const imageMeta=file.__imageMeta&&typeof file.__imageMeta==='object'?{...file.__imageMeta}:null;
      item.sourceType='image';
      item.sourceOriginalName=displayName;
      item.imageMeta=imageMeta;
      const name=row.querySelector('.file-name');
      if(name&&name.textContent!==displayName)name.textContent=displayName;
      const pill=row.querySelector('.side-pill');
      if(pill&&pill.textContent!=='이미지')pill.textContent='이미지';
      const meta=row.querySelector('.file-meta');
      const dpi=Math.round(Number(imageMeta?.dpi)||300);
      const marker=`이미지 ${dpi}dpi`;
      if(meta&&!meta.textContent.includes(marker))meta.textContent=`${meta.textContent} · ${marker}`;
      row.dataset.sourceType='image';
      decorated++;
    });
    if(decorated)document.documentElement.dataset.smartPrintImageLabels=String(decorated);
    return decorated;
  }

  function bindFileListObserver(){
    const list=$('fileList');
    if(!list||fileListObserver)return Boolean(list);
    fileListObserver=new MutationObserver(()=>syncImageLabels());
    fileListObserver.observe(list,{childList:true,subtree:true});
    return true;
  }

  function updateUi(){
    const api=adapter();
    const input=$('fileInput');
    if(api&&input)input.accept=api.acceptString();
    const panel=$('uploadZone')?.closest('.panel');
    const heading=panel?.querySelector('h2');
    const strong=$('uploadZone')?.querySelector('strong');
    const small=$('uploadZone')?.querySelector('small');
    const summary=document.querySelector('#summaryCard .summary-empty');
    const emptyStrong=$('emptyPreview')?.querySelector('strong');
    const emptySub=$('emptyPreview')?.querySelector('span');
    if(heading)heading.textContent='PDF · 이미지 파일';
    if(strong)strong.textContent='PDF / 이미지 올리기';
    if(small)small.innerHTML='PDF · JPG · PNG · WEBP<br>이미지는 300dpi 기준 1페이지 PDF로 안전하게 변환해 기존 자동배치 엔진을 사용합니다.';
    if(summary&&summary.textContent.includes('PDF'))summary.textContent='PDF 또는 이미지를 올리면 용지 한 장에 들어가는 최대 개수를 자동 계산합니다.';
    if(emptyStrong)emptyStrong.textContent='PDF 또는 이미지를 올리면 바로 자동배치됩니다';
    if(emptySub)emptySub.textContent='선택한 용지에 들어갈 수 있는 최대 개수와 앞면·뒷면 위치를 계산합니다.';
    document.documentElement.dataset.smartPrintImageInput='ready';
  }

  function containsImage(files){
    const api=adapter();
    return Boolean(api&&Array.from(files||[]).some(file=>api.isImage(file)));
  }

  function supportedFiles(files){
    const api=adapter();
    return api?Array.from(files||[]).filter(file=>api.isSupported(file)):[];
  }

  async function normalizeForSmart(files){
    const api=adapter();
    if(!api)throw new Error('이미지 입력 모듈을 준비하지 못했습니다.');
    const source=supportedFiles(files);
    if(!source.length)throw new Error('PDF, JPG, PNG, WEBP 파일만 사용할 수 있습니다.');
    const result=[];
    for(const file of source){
      if(api.isPdf(file)){
        result.push(file);
        continue;
      }
      setStatus(`"${file.name}" 이미지를 300dpi 기준으로 변환하는 중...`);
      const converted=await api.normalizeFile(file,{dpi:300,quality:0.88});
      if(converted.size>MAX_NORMALIZED_PDF_BYTES){
        throw new Error(`${file.name}: 변환 결과가 20MB를 초과합니다. 이미지 크기나 해상도를 줄여 주세요.`);
      }
      result.push(converted);
    }
    return result;
  }

  function replayThroughInput(files){
    const input=$('fileInput');
    if(!input)throw new Error('파일 입력창을 찾지 못했습니다.');
    if(typeof DataTransfer!=='function')throw new Error('현재 브라우저에서는 이미지 자동배치를 지원하지 않습니다. 최신 Chrome 또는 Edge를 사용해 주세요.');
    const transfer=new DataTransfer();
    files.forEach(file=>transfer.items.add(file));
    replaying=true;
    input.files=transfer.files;
    input.dispatchEvent(new Event('change',{bubbles:true}));
  }

  async function importImages(files){
    if(busy)return false;
    busy=true;
    const input=$('fileInput');
    if(input)input.disabled=true;
    try{
      const normalized=await normalizeForSmart(files);
      replayThroughInput(normalized);
      queueMicrotask(syncImageLabels);
      document.documentElement.dataset.smartPrintImageImport='complete';
      return true;
    }catch(error){
      setStatus(error?.message||'이미지를 불러오지 못했습니다.','error');
      return false;
    }finally{
      busy=false;
      // Existing app may still be inspecting the replayed PDFs; its own busy state
      // owns the final disabled value after the synthetic change reaches it.
      if(input&&replaying===false&& !window.SmartPrintLayout?.state?.busy)input.disabled=false;
    }
  }

  function bindInput(){
    const input=$('fileInput');
    if(!input||input.dataset.smartImageBridgeBound==='true')return false;
    input.dataset.smartImageBridgeBound='true';
    input.addEventListener('change',event=>{
      if(replaying){
        replaying=false;
        return;
      }
      if(busy||!containsImage(event.target.files))return;
      const files=Array.from(event.target.files||[]);
      event.stopImmediatePropagation();
      event.target.value='';
      importImages(files);
    },true);
    return true;
  }

  function bindDrop(){
    const zone=$('uploadZone');
    if(!zone||zone.dataset.smartImageDropBound==='true')return false;
    zone.dataset.smartImageDropBound='true';
    zone.addEventListener('drop',event=>{
      if(busy||!event.dataTransfer?.files?.length||!containsImage(event.dataTransfer.files))return;
      const files=Array.from(event.dataTransfer.files||[]);
      event.preventDefault();
      event.stopImmediatePropagation();
      zone.classList.remove('drag');
      importImages(files);
    },true);
    return true;
  }

  function boot(){
    updateUi();
    bindInput();
    bindDrop();
    bindFileListObserver();
    syncImageLabels();
  }

  window.SmartPrintLayoutImageInput={
    importImages,normalizeForSmart,updateUi,syncImageLabels,
    stage:'smart-print-image-input-v2-source-metadata'
  };

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
