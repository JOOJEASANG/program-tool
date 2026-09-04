// PDF Utility visual page organizer: thumbnails, drag reorder, rotate and delete.
(function(){
  'use strict';
  if(window.__pdfUtilityVisualPageOrganizerV1)return;
  window.__pdfUtilityVisualPageOrganizerV1=true;

  const route=location.pathname.replace(/\/+$/,'')||'/';
  if(!(route==='/pdf-preflight'||route.endsWith('/pdf-preflight/index.html')||route.endsWith('/tools/pdf-Checker.html')||route.endsWith('/tools/preflight.html')))return;

  const PDFJS_VERSION='3.11.174';
  const PDFJS_SRC=`https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.min.js`;
  const PDFJS_WORKER=`https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.js`;
  const PDFLIB_SRC='https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js';
  const DEFAULT_LOCAL_LIMIT_BYTES=120*1024*1024;
  const MAX_VISUAL_PAGES=300;
  const state={file:null,pageCount:0,pages:[],pdfDoc:null};
  let pdfJsPromise=null;
  let pdfLibPromise=null;
  let busy=false;
  let sessionSerial=0;
  let dragSourcePage=null;

  const $=id=>document.getElementById(id);
  const utility=()=>window.PdfUtility||null;
  const extractRuntime=()=>window.ProgramStudioPdfPageExtract||null;
  const localRuntime=()=>window.ProgramStudioPdfLocalProcessing||null;
  const activeFile=()=>utility()?.state?.files?.[Number(utility()?.state?.activeIndex||0)]||null;
  const mb=bytes=>`${(Number(bytes||0)/1024/1024).toFixed(1)}MB`;
  const safeBaseName=file=>String(file?.name||'document.pdf').replace(/\.pdf$/i,'').replace(/[\\/:*?"<>|]+/g,'_').slice(0,70)||'document';
  const localLimit=()=>Number(extractRuntime()?.localLimitBytes?.()||localRuntime()?.localMergeLimitBytes||DEFAULT_LOCAL_LIMIT_BYTES);

  function planError(message){const error=new Error(message);error.code='PDF_VISUAL_PLAN_INVALID';return error;}
  function showError(message){if(typeof window.showError==='function')window.showError(message);else alert(message);}
  function showStatus(message,type='info'){if(typeof window.showCheckStatus==='function')window.showCheckStatus(message,type);}
  function setProgress(percent,icon,message){if($('progressBox'))$('progressBox').style.display='block';if(typeof window.setProgress==='function')window.setProgress(Math.max(0,Math.min(100,Math.round(percent))),icon,message);}
  function stopProgressSoon(){setTimeout(()=>{if(!busy&&typeof window.stopProgress==='function')window.stopProgress();},900);}
  function setMode(mode,message){if(typeof localRuntime()?.setMode==='function')localRuntime().setMode(mode,message);else document.documentElement.dataset.pdfProcessingMode=mode;}
  function downloadBlob(blob,name){const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=name;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);}

  function installStyles(){
    if($('pdfUtilityVisualOrganizerStyles'))return;
    const style=document.createElement('style');style.id='pdfUtilityVisualOrganizerStyles';style.textContent=`
      #pdfUtilityModalOverlay.pdfu-visual-open .pdfu-modal{width:min(980px,96vw);max-height:94vh}
      .pdfu-visual-toolbar{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:12px;padding:10px 11px;border:1px solid #dbe5ee;border-radius:12px;background:#f8fbfd}
      .pdfu-visual-summary{font-size:11px;font-weight:900;color:#12396d}.pdfu-visual-help{font-size:10px;color:#64748b;line-height:1.45}
      .pdfu-visual-reset{border:1px solid #cbd5e1;background:#fff;color:#475569;border-radius:9px;padding:7px 10px;font-size:10px;font-weight:900;cursor:pointer}.pdfu-visual-reset:hover{background:#f1f5f9}
      .pdfu-visual-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(132px,1fr));gap:10px;max-height:55vh;overflow:auto;padding:3px 2px 10px}
      .pdfu-page-card{position:relative;border:1.5px solid #dbe5ee;border-radius:13px;background:#fff;padding:8px;box-shadow:0 4px 12px rgba(15,23,42,.04);cursor:grab;user-select:none}.pdfu-page-card:active{cursor:grabbing}.pdfu-page-card.dragging{opacity:.42}.pdfu-page-card.drop-target{border-color:#1d9bb2;box-shadow:0 0 0 3px rgba(29,155,178,.12)}
      .pdfu-page-preview{height:158px;border-radius:8px;background:#eef2f7;display:grid;place-items:center;overflow:hidden;position:relative}.pdfu-page-preview canvas{max-width:100%;max-height:100%;transform-origin:center;transition:transform .18s}.pdfu-page-placeholder{font-size:10px;color:#94a3b8;font-weight:800}
      .pdfu-page-badge{position:absolute;left:6px;top:6px;z-index:2;border-radius:999px;background:rgba(18,57,109,.9);color:#fff;padding:3px 7px;font-size:9px;font-weight:950}.pdfu-page-rotation{position:absolute;right:6px;top:6px;z-index:2;border-radius:999px;background:rgba(15,23,42,.75);color:#fff;padding:3px 6px;font-size:9px;font-weight:900}
      .pdfu-page-source{font-size:10px;font-weight:900;color:#334155;text-align:center;margin:7px 0 6px}.pdfu-page-actions{display:grid;grid-template-columns:repeat(5,1fr);gap:3px}.pdfu-page-action{border:1px solid #dbe5ee;background:#f8fafc;color:#475569;border-radius:7px;height:27px;font-size:11px;font-weight:900;cursor:pointer}.pdfu-page-action:hover:not(:disabled){background:#eaf6fa;border-color:#93c5d0}.pdfu-page-action.delete{color:#b91c1c}.pdfu-page-action:disabled{opacity:.3;cursor:not-allowed}
      .pdfu-visual-loading{padding:28px 12px;text-align:center;color:#64748b;font-size:12px;font-weight:800}.pdfu-visual-loading strong{display:block;color:#12396d;font-size:14px;margin-bottom:6px}
      @media(max-width:620px){#pdfUtilityModalOverlay.pdfu-visual-open .pdfu-modal{width:100%;padding:15px}.pdfu-visual-grid{grid-template-columns:repeat(2,minmax(0,1fr));max-height:58vh}.pdfu-page-preview{height:135px}}
    `;document.head.appendChild(style);
  }

  function loadScriptOnce(selector,src,tag,ready,errorMessage){
    const existing=document.querySelector(selector);
    return new Promise((resolve,reject)=>{
      const finish=()=>ready()?resolve():reject(new Error(errorMessage));
      if(existing){const started=Date.now();const wait=()=>{if(ready())return resolve();if(Date.now()-started>15000)return reject(new Error(errorMessage));setTimeout(wait,50);};wait();return;}
      const script=document.createElement('script');script.src=src;script.async=true;script.crossOrigin='anonymous';script.referrerPolicy='no-referrer';script.dataset.pdfVisualLib=tag;const timer=setTimeout(()=>reject(new Error(errorMessage)),15000);script.onload=()=>{clearTimeout(timer);finish();};script.onerror=()=>{clearTimeout(timer);reject(new Error(errorMessage));};document.head.appendChild(script);
    });
  }
  function ensurePdfJs(){
    if(window.pdfjsLib?.getDocument){window.pdfjsLib.GlobalWorkerOptions.workerSrc=PDFJS_WORKER;return Promise.resolve(window.pdfjsLib);}
    if(!pdfJsPromise)pdfJsPromise=loadScriptOnce('script[data-pdf-visual-lib="pdfjs"]',PDFJS_SRC,'pdfjs',()=>Boolean(window.pdfjsLib?.getDocument),'PDF 썸네일 엔진을 불러오지 못했습니다.').then(()=>{window.pdfjsLib.GlobalWorkerOptions.workerSrc=PDFJS_WORKER;return window.pdfjsLib;}).catch(error=>{pdfJsPromise=null;throw error;});
    return pdfJsPromise;
  }
  function ensurePdfLib(){
    if(window.PDFLib?.PDFDocument)return Promise.resolve(window.PDFLib);
    if(!pdfLibPromise)pdfLibPromise=loadScriptOnce('script[data-pdf-visual-lib="pdf-lib"]',PDFLIB_SRC,'pdf-lib',()=>Boolean(window.PDFLib?.PDFDocument),'로컬 PDF 편집 엔진을 불러오지 못했습니다.').then(()=>window.PDFLib).catch(error=>{pdfLibPromise=null;throw error;});
    return pdfLibPromise;
  }

  function normalizeRotation(value){const angle=Number(value||0);if(!Number.isFinite(angle)||angle%90!==0)throw planError('페이지 회전은 90도 단위만 사용할 수 있습니다.');return ((angle%360)+360)%360;}
  function resetPlan(pageCount=state.pageCount){state.pageCount=Number(pageCount||0);state.pages=Array.from({length:state.pageCount},(_,index)=>({sourcePage:index+1,rotation:0}));}
  function snapshot(){return {pageCount:state.pageCount,pages:state.pages.map(item=>({sourcePage:item.sourcePage,rotation:item.rotation}))};}
  function findIndex(sourcePage){return state.pages.findIndex(item=>item.sourcePage===Number(sourcePage));}
  function planChanged(){return state.pages.length!==state.pageCount||state.pages.some((entry,index)=>entry.sourcePage!==index+1||entry.rotation!==0);}
  function syncSummary(){const summary=$('pdfUtilityVisualSummary');if(summary)summary.textContent=`현재 ${state.pages.length}페이지 / 원본 ${state.pageCount}페이지${planChanged()?' · 변경됨':' · 원본 순서'}`;}
  function applyCardRotation(card,entry){const canvas=card.querySelector('canvas');if(canvas)canvas.style.transform=`rotate(${entry.rotation}deg) scale(${entry.rotation%180===0?1:.78})`;const tag=card.querySelector('.pdfu-page-rotation');if(tag){tag.textContent=entry.rotation?`${entry.rotation}°`:'0°';tag.hidden=!entry.rotation;}}

  function syncCardOrder(){
    const grid=$('pdfUtilityVisualGrid');if(!grid)return;
    state.pages.forEach(entry=>{const card=grid.querySelector(`[data-source-page="${entry.sourcePage}"]`);if(card)grid.appendChild(card);});
    state.pages.forEach((entry,index)=>{const card=grid.querySelector(`[data-source-page="${entry.sourcePage}"]`);if(!card)return;card.setAttribute('aria-label',`원본 ${entry.sourcePage}페이지, 현재 순서 ${index+1}`);const badge=card.querySelector('.pdfu-page-badge');if(badge)badge.textContent=String(index+1);const left=card.querySelector('[data-action="left"]');const right=card.querySelector('[data-action="right"]');if(left)left.disabled=index===0;if(right)right.disabled=index===state.pages.length-1;});syncSummary();
  }
  function movePage(sourcePage,toIndex){const from=findIndex(sourcePage);if(from<0)throw planError('이동할 페이지를 찾을 수 없습니다.');const target=Math.max(0,Math.min(state.pages.length-1,Number(toIndex)));if(from===target)return snapshot();const [entry]=state.pages.splice(from,1);state.pages.splice(target,0,entry);syncCardOrder();return snapshot();}
  function rotatePage(sourcePage,delta){const index=findIndex(sourcePage);if(index<0)throw planError('회전할 페이지를 찾을 수 없습니다.');state.pages[index].rotation=normalizeRotation(state.pages[index].rotation+Number(delta||0));const card=$('pdfUtilityVisualGrid')?.querySelector(`[data-source-page="${sourcePage}"]`);if(card)applyCardRotation(card,state.pages[index]);syncSummary();return snapshot();}
  function deletePage(sourcePage){if(state.pages.length<=1)throw planError('PDF에는 최소 1페이지가 남아 있어야 합니다.');const index=findIndex(sourcePage);if(index<0)throw planError('삭제할 페이지를 찾을 수 없습니다.');state.pages.splice(index,1);$('pdfUtilityVisualGrid')?.querySelector(`[data-source-page="${sourcePage}"]`)?.remove();syncCardOrder();return snapshot();}

  async function renderThumbnail(sourcePage,canvas,serial){
    const doc=state.pdfDoc;if(!doc||serial!==sessionSerial)return;
    try{const page=await doc.getPage(sourcePage);if(serial!==sessionSerial)return;const base=page.getViewport({scale:1});const scale=Math.min(128/Math.max(1,base.width),150/Math.max(1,base.height),1.25);const viewport=page.getViewport({scale});canvas.width=Math.max(1,Math.round(viewport.width));canvas.height=Math.max(1,Math.round(viewport.height));const context=canvas.getContext('2d');if(context)await page.render({canvasContext:context,viewport}).promise;canvas.dataset.rendered='1';}
    catch(_){const wrap=canvas.parentElement;if(wrap){canvas.remove();const fallback=document.createElement('span');fallback.className='pdfu-page-placeholder';fallback.textContent='미리보기 실패';wrap.appendChild(fallback);}}
  }
  function createCard(entry,index,serial){
    const card=document.createElement('div');card.className='pdfu-page-card';card.draggable=true;card.dataset.sourcePage=String(entry.sourcePage);card.tabIndex=0;card.setAttribute('aria-label',`원본 ${entry.sourcePage}페이지, 현재 순서 ${index+1}`);card.innerHTML=`<div class="pdfu-page-preview"><span class="pdfu-page-badge">${index+1}</span><span class="pdfu-page-rotation" hidden>0°</span><canvas aria-hidden="true"></canvas></div><div class="pdfu-page-source">원본 ${entry.sourcePage}p</div><div class="pdfu-page-actions"><button type="button" class="pdfu-page-action" data-action="left" title="앞으로 이동" aria-label="앞으로 이동">←</button><button type="button" class="pdfu-page-action" data-action="right" title="뒤로 이동" aria-label="뒤로 이동">→</button><button type="button" class="pdfu-page-action" data-action="rotate-left" title="왼쪽 90도 회전" aria-label="왼쪽 90도 회전">↺</button><button type="button" class="pdfu-page-action" data-action="rotate-right" title="오른쪽 90도 회전" aria-label="오른쪽 90도 회전">↻</button><button type="button" class="pdfu-page-action delete" data-action="delete" title="페이지 삭제" aria-label="페이지 삭제">×</button></div>`;
    const canvas=card.querySelector('canvas');if('IntersectionObserver'in window){const observer=new IntersectionObserver(entries=>{if(entries.some(item=>item.isIntersecting)){observer.disconnect();renderThumbnail(entry.sourcePage,canvas,serial);}}, {root:$('pdfUtilityVisualGrid'),rootMargin:'180px'});observer.observe(card);}else renderThumbnail(entry.sourcePage,canvas,serial);return card;
  }

  function bindGrid(grid){
    if(grid.dataset.visualBound==='1')return;grid.dataset.visualBound='1';
    grid.addEventListener('click',event=>{const button=event.target.closest('[data-action]');if(!button)return;const card=button.closest('.pdfu-page-card');const sourcePage=Number(card?.dataset.sourcePage||0);const index=findIndex(sourcePage);try{if(button.dataset.action==='left'&&index>0)movePage(sourcePage,index-1);if(button.dataset.action==='right'&&index>=0)movePage(sourcePage,index+1);if(button.dataset.action==='rotate-left')rotatePage(sourcePage,-90);if(button.dataset.action==='rotate-right')rotatePage(sourcePage,90);if(button.dataset.action==='delete')deletePage(sourcePage);}catch(error){showError(error.message);}});
    grid.addEventListener('dragstart',event=>{const card=event.target.closest('.pdfu-page-card');if(!card)return;dragSourcePage=Number(card.dataset.sourcePage);card.classList.add('dragging');if(event.dataTransfer){event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',String(dragSourcePage));}});
    grid.addEventListener('dragend',event=>{event.target.closest('.pdfu-page-card')?.classList.remove('dragging');grid.querySelectorAll('.drop-target').forEach(node=>node.classList.remove('drop-target'));dragSourcePage=null;});
    grid.addEventListener('dragover',event=>{const card=event.target.closest('.pdfu-page-card');if(!card)return;event.preventDefault();grid.querySelectorAll('.drop-target').forEach(node=>node.classList.remove('drop-target'));card.classList.add('drop-target');});
    grid.addEventListener('drop',event=>{const card=event.target.closest('.pdfu-page-card');if(!card)return;event.preventDefault();card.classList.remove('drop-target');const source=dragSourcePage||Number(event.dataTransfer?.getData('text/plain')||0);const target=findIndex(Number(card.dataset.sourcePage));if(source&&target>=0)movePage(source,target);});
  }
  function renderGrid(serial){const grid=$('pdfUtilityVisualGrid');if(!grid)return;bindGrid(grid);grid.innerHTML='';state.pages.forEach((entry,index)=>grid.appendChild(createCard(entry,index,serial)));syncCardOrder();}

  function closeModal(){sessionSerial+=1;const overlay=$('pdfUtilityModalOverlay');overlay?.classList.remove('open','pdfu-visual-open');try{state.pdfDoc?.destroy?.();}catch(_){}state.pdfDoc=null;}
  function buildModalShell(file){
    const overlay=$('pdfUtilityModalOverlay');const body=$('pdfUtilityModalBody');if(!overlay||!body)throw new Error('페이지 정리 창을 준비하지 못했습니다. 새로고침 후 다시 시도하세요.');installStyles();overlay.classList.add('pdfu-visual-open');$('pdfUtilityModalTitle').textContent='썸네일 페이지 정리';$('pdfUtilityModalDesc').textContent=`선택 파일: ${file.name} · 썸네일을 끌어 순서를 바꾸고 페이지별 회전·삭제를 할 수 있습니다.`;body.innerHTML='<div class="pdfu-visual-toolbar"><div><div class="pdfu-visual-summary" id="pdfUtilityVisualSummary">페이지 불러오는 중...</div><div class="pdfu-visual-help">드래그 또는 ← → 버튼으로 순서를 바꾸고, ↺ ↻ 버튼으로 90° 회전할 수 있습니다.</div></div><button type="button" class="pdfu-visual-reset" id="pdfUtilityVisualReset">원래대로</button></div><div class="pdfu-visual-grid" id="pdfUtilityVisualGrid"><div class="pdfu-visual-loading"><strong>페이지 썸네일 준비 중</strong>PDF는 브라우저에서 읽으며 미리보기를 위해 서버에 업로드하지 않습니다.</div></div><div class="pdfu-warning"><strong>저장 방식:</strong> '+mb(localLimit())+' 이하에서는 서버 업로드 없이 브라우저에서 저장합니다. 큰 파일이나 로컬 호환 오류가 있을 때만 인증된 서버 처리로 전환합니다.</div>';
    $('pdfUtilityModalRun').textContent='정리한 PDF 저장';$('pdfUtilityModalRun').onclick=()=>saveCurrent();const close=()=>closeModal();$('pdfUtilityModalClose').onclick=close;$('pdfUtilityModalCancel').onclick=close;$('pdfUtilityVisualReset').onclick=()=>{resetPlan();renderGrid(sessionSerial);};overlay.classList.add('open');
  }
  async function openVisualOrganizer(){
    if(busy)return false;const file=activeFile();if(!file){showError('페이지를 정리할 PDF를 선택하세요.');return false;}sessionSerial+=1;const serial=sessionSerial;state.file=file;state.pdfDoc=null;state.pageCount=0;state.pages=[];
    try{buildModalShell(file);setMode('local',`${file.name} · 썸네일 미리보기는 브라우저에서 처리합니다.`);setProgress(5,'🗂️','페이지 썸네일 정보 읽는 중');const pdfjs=await ensurePdfJs();const bytes=await file.arrayBuffer();if(serial!==sessionSerial)return false;state.pdfDoc=await pdfjs.getDocument({data:bytes}).promise;const count=Number(state.pdfDoc?.numPages||0);if(!count)throw new Error('페이지가 없는 PDF입니다.');if(count>MAX_VISUAL_PAGES)throw planError(`썸네일 페이지 정리는 최대 ${MAX_VISUAL_PAGES}페이지까지 지원합니다. 페이지 범위 재정렬 기능을 이용하세요.`);resetPlan(count);renderGrid(serial);setProgress(100,'✅',`${count}페이지 썸네일 준비 완료`);showStatus(`${count}페이지를 브라우저에서 불러왔습니다. 서버 업로드 없음.`,'ok');stopProgressSoon();document.documentElement.dataset.pdfVisualOrganizer='local-first';return true;}
    catch(error){showError(error?.message||'페이지 썸네일을 불러오지 못했습니다.');showStatus(error?.message||'페이지 썸네일 준비 실패','err');closeModal();return false;}
  }

  function validatePlan(){if(!state.file||!state.pageCount||!state.pages.length)throw planError('저장할 페이지 정리 정보가 없습니다.');const seen=new Set();for(const item of state.pages){if(!Number.isInteger(item.sourcePage)||item.sourcePage<1||item.sourcePage>state.pageCount)throw planError('페이지 순서 정보가 올바르지 않습니다.');if(seen.has(item.sourcePage))throw planError('같은 원본 페이지를 두 번 배치할 수 없습니다.');seen.add(item.sourcePage);item.rotation=normalizeRotation(item.rotation);}return snapshot();}
  async function saveLocally(file){
    const plan=validatePlan();const {PDFDocument,degrees}=await ensurePdfLib();setProgress(16,'🗂️','원본 PDF 읽는 중');const sourceBytes=await file.arrayBuffer();let source;try{source=await PDFDocument.load(sourceBytes,{ignoreEncryption:false,updateMetadata:false});}catch(error){if(/encrypted|password|decrypt|encryption/i.test(String(error?.message||'')))throw planError('암호화된 PDF는 먼저 암호를 해제하세요.');throw error;}if(Number(source.getPageCount?.()||0)!==state.pageCount)throw planError('PDF 페이지 수가 미리보기와 달라졌습니다. 파일을 다시 선택하세요.');setProgress(48,'🗂️','페이지 순서와 회전 적용 중');const output=await PDFDocument.create();const copied=await output.copyPages(source,plan.pages.map(item=>item.sourcePage-1));copied.forEach((page,index)=>{const item=plan.pages[index];if(item.rotation&&typeof page.setRotation==='function'&&typeof degrees==='function'){const base=Number(page.getRotation?.()?.angle||0);page.setRotation(degrees((base+item.rotation)%360));}output.addPage(page);});setProgress(84,'💾','정리 PDF 생성 중');const bytes=await output.save({useObjectStreams:true,addDefaultPage:false,updateFieldAppearances:false});return {blob:new Blob([bytes],{type:'application/pdf'}),pageCount:copied.length};
  }

  async function ensureStorage(){if(typeof window._ensureStorage==='function')return window._ensureStorage();if(window.firebase?.storage)return firebase.storage();await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://www.gstatic.com/firebasejs/9.23.0/firebase-storage-compat.js';script.onload=resolve;script.onerror=()=>reject(new Error('Firebase Storage SDK를 불러오지 못했습니다.'));document.head.appendChild(script);});return firebase.storage();}
  async function readPdfResponse(response,storageInstance){const type=response.headers.get('content-type')||'';if(!type.includes('application/json'))return response.blob();const delivery=await response.json();if(delivery?.delivery!=='storage'||!delivery.download_url)throw new Error('완성 PDF 다운로드 정보가 올바르지 않습니다.');const result=await fetch(delivery.download_url,{cache:'no-store'});if(!result.ok)throw new Error('완성 PDF를 내려받지 못했습니다.');const blob=await result.blob();if(delivery.storage_path&&storageInstance){try{await storageInstance.ref(delivery.storage_path).delete();}catch(_){}}return blob;}
  async function saveOnServer(file){
    const plan=validatePlan();const user=window.auth?.currentUser;if(!user)throw new Error('로그인이 필요합니다.');const storageInstance=await ensureStorage();const session=`${Date.now().toString(36)}${Math.random().toString(36).slice(2,8)}`;const safe=file.name.replace(/[^A-Za-z0-9_.-]+/g,'_').slice(0,70)||'document.pdf';const storagePath=`pdf_temp/${user.uid}/${session}/01_${safe.toLowerCase().endsWith('.pdf')?safe:safe+'.pdf'}`;const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),285000);
    try{setProgress(20,'📤','정리할 PDF 업로드 중');showStatus('대용량 또는 로컬 호환 문제로 인증된 서버 처리로 전환했습니다.','info');await storageInstance.ref(storagePath).put(file,{contentType:'application/pdf'});const token=await user.getIdToken(true);setProgress(54,'🗂️','서버에서 페이지 순서·회전 적용 중');const rotations={};for(const item of plan.pages)if(item.rotation)rotations[String(item.sourcePage)]=item.rotation;const response=await fetch('/api/pdf-utility/organize-storage',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({storage_path:storagePath,filename:file.name,page_order:plan.pages.map(item=>item.sourcePage),page_rotations:rotations}),signal:controller.signal});if(!response.ok){let message=`서버 오류 (${response.status})`;try{const payload=await response.json();message=payload?.detail||payload?.message||message;}catch(_){}throw new Error(message);}return {blob:await readPdfResponse(response,storageInstance),pageCount:Number(response.headers.get('X-PDF-Page-Count')||plan.pages.length)};}
    catch(error){if(error?.name==='AbortError')throw new Error('처리 시간이 초과되었습니다. 파일 크기나 페이지 수를 줄여 다시 시도하세요.');throw error;}finally{clearTimeout(timer);try{await storageInstance.ref(storagePath).delete();}catch(_){}}
  }

  function setBusy(value){busy=Boolean(value);if(utility()?.state)utility().state.busy=busy;if(typeof window.setPageBusy==='function')window.setPageBusy(busy,'썸네일 페이지 정리');for(const id of ['pdfUtilityModalRun','pdfUtilityModalClose','pdfUtilityModalCancel','pdfUtilityVisualReset'])if($(id))$(id).disabled=busy;const button=$('pdfUtilityVisualOrganizeBtn');if(button&&!busy)button.disabled=!activeFile();}
  async function saveCurrent(){
    if(busy)return false;const file=state.file;try{validatePlan();}catch(error){showError(error.message);return false;}if(!planChanged()){showError('페이지 순서·회전·삭제 변경이 없습니다.');return false;}setBusy(true);
    try{const limit=localLimit();let result=null;if(Number(file.size||0)<=limit){setMode('local',`${file.name} · 정리한 PDF를 서버 업로드 없이 저장합니다.`);showStatus('페이지 순서·회전·삭제를 브라우저에서 직접 적용하는 중입니다. 서버 업로드 없음.','info');setProgress(5,'🗂️','브라우저 로컬 페이지 정리 준비 중');try{result=await saveLocally(file);document.documentElement.dataset.pdfVisualOrganizerLastResult='local-success';setMode('local-success',`${result.pageCount}페이지 · 서버 업로드 없이 페이지 정리를 완료했습니다.`);}catch(error){if(error?.code==='PDF_VISUAL_PLAN_INVALID')throw error;setMode('server-fallback',`${error?.message||'로컬 처리 호환 오류'} · 서버 처리로 계속 진행합니다.`);showStatus('브라우저 로컬 저장이 어려워 서버 처리로 자동 전환합니다.','info');}}else{setMode('server-fallback',`로컬 권장 한도 ${mb(limit)} 초과 (${mb(file.size)}) · 서버 처리합니다.`);showStatus(`파일이 로컬 권장 한도 ${mb(limit)}를 초과해 저장만 서버 처리로 전환합니다.`,'info');}if(!result){result=await saveOnServer(file);document.documentElement.dataset.pdfVisualOrganizerLastResult='server-success';}downloadBlob(result.blob,`${safeBaseName(file)}_페이지시각정리_${result.pageCount}p.pdf`);setProgress(100,'✅','페이지 정리 PDF 저장 완료');showStatus(`페이지 정리 완료 · ${result.pageCount}페이지${document.documentElement.dataset.pdfVisualOrganizerLastResult==='local-success'?' · 서버 업로드 없음':' · 서버 처리'}`,'ok');stopProgressSoon();closeModal();return true;}
    catch(error){document.documentElement.dataset.pdfVisualOrganizerLastResult='error';showError(error?.message||'페이지 정리에 실패했습니다.');showStatus(error?.message||'페이지 정리 실패','err');return false;}finally{setBusy(false);}
  }

  function createAction(){if($('pdfUtilityVisualOrganizeBtn'))return $('pdfUtilityVisualOrganizeBtn');const grid=document.querySelector('.action-grid');if(!grid||!utility())return null;const button=document.createElement('button');button.type='button';button.className='action-btn pdfu-action';button.id='pdfUtilityVisualOrganizeBtn';button.dataset.processingMode='local-first';button.innerHTML='<span class="action-chip chip-green">썸네일</span><div class="action-icon" style="background:#ecfdf5">🗂️</div><div class="action-name">썸네일 페이지 정리</div><div class="action-desc">페이지를 보면서 드래그 순서 변경·90° 회전·삭제합니다.</div>';button.addEventListener('click',openVisualOrganizer);grid.appendChild(button);return button;}
  function install(){const api=utility();if(!api?.state||!$('pdfUtilityModalOverlay'))return false;installStyles();const button=createAction();if(button&&!busy)button.disabled=!activeFile();const note=document.querySelector('.pdfu-limit-note');if(note&&!note.dataset.visualOrganizerNote){note.dataset.visualOrganizerNote='1';note.append(' 썸네일 페이지 정리는 최대 '+MAX_VISUAL_PAGES+'페이지를 브라우저에서 미리봅니다.');}api.openVisualOrganizer=openVisualOrganizer;api.saveVisualOrganizer=saveCurrent;document.documentElement.dataset.pdfVisualOrganizer='local-first';return true;}

  const observer=new MutationObserver(()=>install());observer.observe(document.documentElement,{childList:true,subtree:true});[0,100,300,700,1200,2200].forEach(delay=>setTimeout(install,delay));
  window.ProgramStudioPdfVisualPageOrganizer=Object.freeze({version:'2026.09.04.002',strategy:'thumbnail-local-first-with-server-fallback',maxVisualPages:MAX_VISUAL_PAGES,openVisualOrganizer,saveCurrent,movePage,rotatePage,deletePage,resetPlan,snapshot,localLimitBytes:localLimit});
})();
