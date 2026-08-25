// Large-format tiling for PDF / JPG / PNG.
(function(){
  'use strict';
  if(window.__pdfLargeOutputTilingV1)return;
  window.__pdfLargeOutputTilingV1=true;

  const path=location.pathname.replace(/\/+$/,'')||'/';
  if(!(
    path==='/pdf-preflight'||
    path.endsWith('/pdf-preflight/index.html')||
    path.endsWith('/tools/pdf-Checker.html')||
    path.endsWith('/tools/preflight.html')
  ))return;

  const MAX_BYTES=500*1024*1024;
  const DIRECT_LIMIT=20*1024*1024;
  const PAPER={A4:[210,297],A3:[297,420]};
  const $=id=>document.getElementById(id);
  const mmToPt=mm=>Number(mm)*72/25.4;
  const ptToMm=pt=>Number(pt)*25.4/72;
  let sourceFile=null;
  let sourceInfo=null;
  let libsPromise=null;

  function loadScript(src,globalName){
    if(window[globalName])return Promise.resolve(window[globalName]);
    return new Promise((resolve,reject)=>{
      const key=`script[data-large-output-src="${src}"]`;
      const existing=document.querySelector(key);
      if(existing){
        existing.addEventListener('load',()=>resolve(window[globalName]),{once:true});
        existing.addEventListener('error',()=>reject(new Error('필요한 PDF 라이브러리를 불러오지 못했습니다.')),{once:true});
        return;
      }
      const script=document.createElement('script');
      script.src=src;script.async=true;script.dataset.largeOutputSrc=src;
      script.onload=()=>window[globalName]?resolve(window[globalName]):reject(new Error('PDF 라이브러리 초기화에 실패했습니다.'));
      script.onerror=()=>reject(new Error('필요한 PDF 라이브러리를 불러오지 못했습니다.'));
      document.head.appendChild(script);
    });
  }

  function libraries(){
    if(libsPromise)return libsPromise;
    libsPromise=Promise.all([
      loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js','pdfjsLib'),
      loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js','PDFLib')
    ]).then(([pdfjs,pdfLib])=>{
      pdfjs.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      return {pdfjs,pdfLib};
    });
    return libsPromise;
  }

  function installStyles(){
    if($('pdfLargeOutputTilingStyles'))return;
    const style=document.createElement('style');
    style.id='pdfLargeOutputTilingStyles';
    style.textContent=`
      #pdfLargeOutputTilingCard{grid-column:1/-1;min-height:0;display:flex;align-items:center;gap:15px;padding:15px 17px}
      #pdfLargeOutputTilingCard .action-icon{margin:0;flex:0 0 43px}.plot-overlay{display:none;position:fixed;inset:0;z-index:1550;background:rgba(15,23,42,.64);backdrop-filter:blur(4px);align-items:center;justify-content:center;padding:18px}.plot-overlay.open{display:flex}.plot-box{width:min(720px,100%);max-height:94vh;overflow:auto;background:#fff;border-radius:20px;padding:22px;box-shadow:0 30px 90px rgba(0,0,0,.3)}
      .plot-head{display:flex;gap:10px;align-items:flex-start}.plot-title{font-size:19px;font-weight:950;color:#12396d}.plot-sub{font-size:10px;color:#64748b;line-height:1.5;margin-top:4px}.plot-close{margin-left:auto;border:0;background:#f1f5f9;border-radius:9px;width:34px;height:34px;font-size:20px;cursor:pointer}.plot-file{display:block;margin-top:14px;border:2px dashed #b8cadd;border-radius:13px;padding:17px;text-align:center;background:#f8fbff;cursor:pointer}.plot-file input{display:none}.plot-file strong{display:block;font-size:12px;color:#12396d}.plot-file small{display:block;font-size:9px;color:#64748b;margin-top:4px}.plot-summary{display:none;margin-top:10px;border:1px solid #dbe5ee;background:#fff;border-radius:11px;padding:10px 12px;font-size:10px;color:#475569;line-height:1.55}.plot-summary.show{display:block}.plot-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin-top:12px}.plot-field label{display:block;font-size:9px;font-weight:900;color:#475569;margin-bottom:5px}.plot-input{width:100%;border:1.5px solid #d8e2ec;border-radius:9px;padding:9px 10px;font-size:11px;background:#fff}.plot-image-size{display:none;grid-column:1/-1;border:1px solid #dbeafe;background:#f8fbff;border-radius:11px;padding:10px}.plot-image-size.show{display:block}.plot-size-row{display:grid;grid-template-columns:1fr 1fr;gap:8px}.plot-quality{margin-top:7px;font-size:9px;font-weight:850;line-height:1.45}.plot-quality.good{color:#15803d}.plot-quality.warn{color:#a16207}.plot-quality.fail{color:#dc2626}
      .plot-mode{display:grid;grid-template-columns:1fr 1fr;gap:7px}.plot-mode label{border:1px solid #dbe5ee;border-radius:9px;padding:9px;font-size:10px;font-weight:850;color:#475569;cursor:pointer}.plot-mode label:has(input:checked){border-color:#67c7d8;background:#ecfeff;color:#0e7490}.plot-mode input{margin-right:5px;accent-color:#0e7490}.plot-preview{margin-top:12px;border:1px solid #dbe5ee;border-radius:12px;background:#f8fafc;padding:12px}.plot-preview-head{display:flex;justify-content:space-between;gap:10px;font-size:10px;font-weight:900;color:#334155}.plot-sheet-grid{display:grid;gap:4px;margin-top:9px;max-width:360px}.plot-sheet{min-height:34px;border:1px solid #94a3b8;background:#fff;border-radius:4px;display:grid;place-items:center;font-size:8px;font-weight:900;color:#64748b}.plot-note{margin-top:10px;padding:9px 10px;border-radius:9px;background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;font-size:9px;line-height:1.55}.plot-status{font-size:10px;font-weight:800;color:#2563eb;line-height:1.45;margin-top:10px}.plot-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:14px}.plot-btn{border-radius:10px;padding:10px 15px;font-size:11px;font-weight:900;cursor:pointer}.plot-btn.cancel{border:1px solid #dbe5ee;background:#f8fafc;color:#475569}.plot-btn.run{border:0;background:linear-gradient(135deg,#12396d,#1d9bb2);color:#fff}.plot-btn:disabled,.plot-close:disabled{opacity:.45;cursor:not-allowed}
      @media(max-width:620px){.plot-grid,.plot-size-row{grid-template-columns:1fr}.plot-mode{grid-template-columns:1fr}.plot-actions{flex-direction:column-reverse}.plot-btn{width:100%}}
    `;
    document.head.appendChild(style);
  }

  function installCard(){
    const grid=document.querySelector('.action-grid');
    if(!grid||$('pdfLargeOutputTilingCard'))return false;
    const card=document.createElement('button');
    card.type='button';card.id='pdfLargeOutputTilingCard';card.className='action-btn';
    card.innerHTML='<span class="action-icon" style="background:#ede9fe">🧩</span><span><span class="action-name">대형 분할 출력</span><span class="action-desc">큰 PDF·이미지를 A3/A4 여러 장으로 100% 실제 크기 분할합니다. 프린터 사방 3mm 여백과 겹침을 반영합니다.</span></span><span class="action-chip chip-blue">인쇄 실무</span>';
    card.addEventListener('click',openModal);grid.appendChild(card);return true;
  }

  function makeModal(){
    if($('pdfLargeOutputTilingOverlay'))return;
    const overlay=document.createElement('div');overlay.id='pdfLargeOutputTilingOverlay';overlay.className='plot-overlay';
    overlay.innerHTML=`<div class="plot-box"><div class="plot-head"><div><div class="plot-title">대형 분할 출력</div><div class="plot-sub">PDF는 원본 페이지 크기를 그대로 사용하고, 이미지는 최종 출력 크기를 확인한 뒤 A3/A4 여러 장으로 나눕니다.</div></div><button type="button" class="plot-close" id="plotClose">×</button></div>
      <label class="plot-file">📄🖼️ <strong>PDF / JPG / PNG 파일 선택</strong><small>PDF는 실제 페이지 크기 사용 · 이미지는 300DPI 기준 크기를 자동 계산 후 수정 가능</small><input id="plotFileInput" type="file" accept="application/pdf,image/jpeg,image/png"></label>
      <div class="plot-summary" id="plotSourceSummary"></div>
      <div class="plot-grid">
        <div class="plot-field"><label>출력 용지</label><select class="plot-input" id="plotPaper"><option value="A3" selected>A3 · 297×420mm</option><option value="A4">A4 · 210×297mm</option></select></div>
        <div class="plot-field"><label>용지 방향</label><select class="plot-input" id="plotOrientation"><option value="auto" selected>자동 · 장수 적은 방향</option><option value="portrait">세로 고정</option><option value="landscape">가로 고정</option></select></div>
        <div class="plot-field"><label>프린터 사방 비인쇄 여백</label><input class="plot-input" id="plotMargin" type="number" min="0" max="20" step="0.5" value="3"></div>
        <div class="plot-field"><label>이어 붙이기 방식</label><select class="plot-input" id="plotOverlap"><option value="0" selected>맞대기 · 겹침 없음</option><option value="5">5mm 겹침</option><option value="10">10mm 겹침</option></select></div>
        <div class="plot-image-size" id="plotImageSize"><div class="plot-size-row"><div class="plot-field"><label>이미지 최종 출력 가로(mm)</label><input class="plot-input" id="plotImageWidth" type="number" min="10" max="5000" step="1"></div><div class="plot-field"><label>이미지 최종 출력 세로(mm)</label><input class="plot-input" id="plotImageHeight" type="number" min="10" max="5000" step="1"></div></div><div class="plot-quality" id="plotImageQuality"></div></div>
      </div>
      <div class="plot-mode"><label><input type="checkbox" id="plotLabels">작은 타일 번호 표시</label><label><input type="checkbox" id="plotKeepRatio" checked>이미지 가로·세로 비율 유지</label></div>
      <div class="plot-preview"><div class="plot-preview-head"><span id="plotPreviewTitle">파일을 선택하면 예상 분할 장수를 계산합니다.</span><span id="plotPreviewCount"></span></div><div class="plot-sheet-grid" id="plotSheetGrid"></div></div>
      <div class="plot-note">기본 3mm는 프린터가 인쇄하지 못하는 흰 테두리로 보고 실제 배치 영역에서 제외합니다. PDF 내용은 래스터 이미지로 바꾸지 않아 글자·벡터 품질을 유지합니다.</div>
      <div class="plot-status" id="plotStatus"></div><div class="plot-actions"><button type="button" class="plot-btn cancel" id="plotCancel">닫기</button><button type="button" class="plot-btn run" id="plotRun" disabled>분할 출력 PDF 만들기</button></div></div>`;
    document.body.appendChild(overlay);
    $('plotClose').onclick=closeModal;$('plotCancel').onclick=closeModal;$('plotRun').onclick=runTiling;
    $('plotFileInput').addEventListener('change',handleFile);
    ['plotPaper','plotOrientation','plotMargin','plotOverlap'].forEach(id=>$(id)?.addEventListener('change',renderPreview));
    $('plotImageWidth').addEventListener('input',()=>syncImageDimension('width'));
    $('plotImageHeight').addEventListener('input',()=>syncImageDimension('height'));
    $('plotKeepRatio').addEventListener('change',renderPreview);
    overlay.addEventListener('click',event=>{if(event.target===overlay)closeModal();});
  }

  function openModal(){makeModal();$('pdfLargeOutputTilingOverlay')?.classList.add('open');renderPreview();}
  function closeModal(){if(!$('plotRun')?.disabled||!sourceFile)$('pdfLargeOutputTilingOverlay')?.classList.remove('open');}
  function setStatus(text,error=false){const el=$('plotStatus');if(el){el.textContent=text||'';el.style.color=error?'#dc2626':'#2563eb';}}
  function setBusy(busy,label='처리 중...'){const run=$('plotRun');if(run){run.disabled=busy||!sourceFile;run.textContent=busy?label:'분할 출력 PDF 만들기';}['plotClose','plotCancel'].forEach(id=>{if($(id))$(id).disabled=busy;});}

  function validateFile(file){
    if(!file)throw new Error('파일을 선택하세요.');
    if(file.size>MAX_BYTES)throw new Error('파일은 최대 500MB까지 지원합니다.');
    const ok=file.type==='application/pdf'||['image/jpeg','image/png'].includes(file.type)||/\.(pdf|jpe?g|png)$/i.test(file.name||'');
    if(!ok)throw new Error('PDF, JPG, PNG 파일만 지원합니다.');
  }

  async function handleFile(event){
    const file=event.target.files?.[0]||null;sourceFile=null;sourceInfo=null;setStatus('');
    try{
      validateFile(file);sourceFile=file;setStatus('파일 정보 확인 중...');
      if(file.type==='application/pdf'||/\.pdf$/i.test(file.name))sourceInfo=await inspectPdf(file);
      else sourceInfo=await inspectImage(file);
      renderSourceSummary();renderPreview();$('plotRun').disabled=false;setStatus('');
    }catch(error){sourceFile=null;sourceInfo=null;$('plotRun').disabled=true;setStatus(error.message||'파일을 확인하지 못했습니다.',true);renderSourceSummary();renderPreview();}
  }

  async function inspectPdf(file){
    const {pdfjs}=await libraries();
    const bytes=await file.arrayBuffer();
    const doc=await pdfjs.getDocument({data:bytes}).promise;
    if(doc.numPages>50)throw new Error('대형 분할 출력은 PDF 최대 50페이지까지 지원합니다.');
    const pages=[];
    for(let index=1;index<=doc.numPages;index++){
      const page=await doc.getPage(index);const viewport=page.getViewport({scale:1});
      pages.push({widthMm:ptToMm(viewport.width),heightMm:ptToMm(viewport.height)});
    }
    return {kind:'pdf',pages,pageCount:doc.numPages};
  }

  function imageElement(file){
    return new Promise((resolve,reject)=>{
      const url=URL.createObjectURL(file);const img=new Image();
      img.onload=()=>{URL.revokeObjectURL(url);resolve(img);};
      img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('이미지를 열 수 없습니다.'));};img.src=url;
    });
  }

  async function inspectImage(file){
    const img=await imageElement(file);const widthPx=img.naturalWidth,heightPx=img.naturalHeight;
    if(!widthPx||!heightPx)throw new Error('이미지 크기를 확인할 수 없습니다.');
    const widthMm=widthPx/300*25.4,heightMm=heightPx/300*25.4;
    $('plotImageWidth').value=Math.round(widthMm);$('plotImageHeight').value=Math.round(heightMm);
    return {kind:'image',widthPx,heightPx,ratio:widthPx/heightPx,pages:[{widthMm,heightMm}],pageCount:1};
  }

  function renderSourceSummary(){
    const box=$('plotSourceSummary');const imageBox=$('plotImageSize');
    if(!sourceFile||!sourceInfo){box.classList.remove('show');box.textContent='';imageBox.classList.remove('show');return;}
    box.classList.add('show');
    if(sourceInfo.kind==='pdf'){
      const first=sourceInfo.pages[0];box.textContent=`${sourceFile.name} · PDF ${sourceInfo.pageCount}페이지 · 첫 페이지 ${first.widthMm.toFixed(1)}×${first.heightMm.toFixed(1)}mm · 원본 실제 크기 100% 사용`;
      imageBox.classList.remove('show');
    }else{
      box.textContent=`${sourceFile.name} · ${sourceInfo.widthPx}×${sourceInfo.heightPx}px · 아래 최종 출력 크기를 기준으로 분할`;
      imageBox.classList.add('show');renderImageQuality();
    }
  }

  function syncImageDimension(changed){
    if(sourceInfo?.kind!=='image'||!$('plotKeepRatio').checked){renderImageQuality();renderPreview();return;}
    const ratio=sourceInfo.ratio||1;
    if(changed==='width')$('plotImageHeight').value=Math.max(1,Math.round(Number($('plotImageWidth').value||1)/ratio));
    else $('plotImageWidth').value=Math.max(1,Math.round(Number($('plotImageHeight').value||1)*ratio));
    renderImageQuality();renderPreview();
  }

  function imageSize(){return {widthMm:Number($('plotImageWidth')?.value||0),heightMm:Number($('plotImageHeight')?.value||0)};}
  function renderImageQuality(){
    if(sourceInfo?.kind!=='image')return;const {widthMm,heightMm}=imageSize();const el=$('plotImageQuality');
    if(widthMm<=0||heightMm<=0){el.className='plot-quality fail';el.textContent='출력 크기를 입력하세요.';return;}
    const dpi=Math.min(sourceInfo.widthPx/(widthMm/25.4),sourceInfo.heightPx/(heightMm/25.4));
    const cls=dpi>=300?'good':dpi>=150?'warn':'fail';el.className=`plot-quality ${cls}`;
    el.textContent=dpi>=300?`예상 ${Math.round(dpi)} DPI · 인쇄 품질 양호`:dpi>=150?`예상 ${Math.round(dpi)} DPI · 일반 출력 가능, 가까이서 보면 거칠 수 있음`:`예상 ${Math.round(dpi)} DPI · 저해상도 경고`;
  }

  function tileAxis(source,usable,overlap){if(source<=usable)return 1;const step=usable-overlap;return step>0?Math.ceil((source-overlap)/step):999;}
  function pagePlan(widthMm,heightMm){
    const paper=PAPER[$('plotPaper')?.value]||PAPER.A3;const orientation=$('plotOrientation')?.value||'auto';const margin=Math.max(0,Number($('plotMargin')?.value||0));const overlap=Math.max(0,Number($('plotOverlap')?.value||0));
    const options=orientation==='auto'?[[paper[0],paper[1]],[paper[1],paper[0]]]:orientation==='landscape'?[[paper[1],paper[0]]]:[[paper[0],paper[1]]];
    return options.map(([pw,ph])=>{const uw=pw-margin*2,uh=ph-margin*2;const cols=tileAxis(widthMm,uw,overlap),rows=tileAxis(heightMm,uh,overlap);return {pw,ph,uw,uh,cols,rows,count:cols*rows};}).sort((a,b)=>a.count-b.count)[0];
  }

  function currentPages(){
    if(!sourceInfo)return[];
    if(sourceInfo.kind==='image'){const size=imageSize();return size.widthMm>0&&size.heightMm>0?[size]:[];}
    return sourceInfo.pages;
  }

  function renderPreview(){
    const title=$('plotPreviewTitle'),countEl=$('plotPreviewCount'),grid=$('plotSheetGrid');grid.innerHTML='';
    if(!sourceInfo){title.textContent='파일을 선택하면 예상 분할 장수를 계산합니다.';countEl.textContent='';return;}
    if(sourceInfo.kind==='image')renderImageQuality();
    const pages=currentPages();if(!pages.length){title.textContent='출력 크기를 확인하세요.';countEl.textContent='';return;}
    const plans=pages.map(page=>pagePlan(page.widthMm,page.heightMm));const total=plans.reduce((sum,p)=>sum+p.count,0);const first=plans[0];
    title.textContent=`첫 페이지 ${first.cols}열 × ${first.rows}행 · 실제 크기 100%`;countEl.textContent=`총 ${total}장`;
    grid.style.gridTemplateColumns=`repeat(${Math.min(first.cols,8)},minmax(32px,1fr))`;
    const shown=Math.min(first.count,64);for(let i=0;i<shown;i++){const cell=document.createElement('div');cell.className='plot-sheet';cell.textContent=String(i+1);grid.appendChild(cell);}if(first.count>shown){const more=document.createElement('div');more.className='plot-sheet';more.textContent=`+${first.count-shown}`;grid.appendChild(more);}
  }

  async function imageToPdf(file){
    const {pdfLib}=await libraries();const {PDFDocument}=pdfLib;const bytes=await file.arrayBuffer();const doc=await PDFDocument.create();const size=imageSize();
    if(size.widthMm<=0||size.heightMm<=0)throw new Error('이미지 최종 출력 크기를 입력하세요.');
    const image=file.type==='image/png'||/\.png$/i.test(file.name)?await doc.embedPng(bytes):await doc.embedJpg(bytes);
    const page=doc.addPage([mmToPt(size.widthMm),mmToPt(size.heightMm)]);page.drawImage(image,{x:0,y:0,width:page.getWidth(),height:page.getHeight()});
    const pdfBytes=await doc.save({useObjectStreams:true});return new File([pdfBytes],`${String(file.name||'image').replace(/\.[^.]+$/,'')}_source.pdf`,{type:'application/pdf',lastModified:Date.now()});
  }

  async function token(){const user=window.auth?.currentUser||((typeof auth!=='undefined'&&auth)?auth.currentUser:null);if(!user)throw new Error('로그인이 필요합니다.');return user.getIdToken(true);}
  async function storage(){if(typeof window._ensureStorage==='function')return window._ensureStorage();if(typeof _ensureStorage==='function')return _ensureStorage();if(window.storage)return window.storage;if(window.firebase?.storage)return window.firebase.storage();throw new Error('대용량 임시 저장소를 사용할 수 없습니다.');}
  async function readDelivery(response){const type=response.headers.get('content-type')||'';if(!type.includes('application/json'))return response.blob();const data=await response.json();if(data?.delivery!=='storage'||!data.download_url)throw new Error(data?.detail||'완성 PDF 정보를 읽지 못했습니다.');const result=await fetch(data.download_url,{cache:'no-store'});if(!result.ok)throw new Error('완성 PDF를 내려받지 못했습니다.');const blob=await result.blob();if(data.storage_path){try{const st=await storage();await st.ref(data.storage_path).delete();}catch(error){console.warn('[tiling] result cleanup failed',error);}}return blob;}

  async function requestTiling(pdfFile,params){
    const authToken=await token();
    if(pdfFile.size<=DIRECT_LIMIT){const form=new FormData();form.append('file',pdfFile);form.append('params',JSON.stringify(params));const response=await fetch('/api/pdf-utility/tile',{method:'POST',headers:{Authorization:`Bearer ${authToken}`},body:form});if(!response.ok){const err=await response.json().catch(()=>null);throw new Error(err?.detail||`분할 출력 실패 (${response.status})`);}return readDelivery(response);}
    const user=window.auth?.currentUser||((typeof auth!=='undefined'&&auth)?auth.currentUser:null);const st=await storage();const session=Date.now().toString(36)+Math.random().toString(36).slice(2,7);const safe=(pdfFile.name||'large.pdf').replace(/[^A-Za-z0-9_.-]/g,'_').slice(0,80)||'large.pdf';const storagePath=`pdf_temp/${user.uid}/${session}/${safe.toLowerCase().endsWith('.pdf')?safe:safe+'.pdf'}`;
    try{setStatus('대용량 파일 임시 업로드 중...');await st.ref(storagePath).put(pdfFile,{contentType:'application/pdf'});const response=await fetch('/api/pdf-utility/tile-storage',{method:'POST',headers:{Authorization:`Bearer ${authToken}`,'Content-Type':'application/json'},body:JSON.stringify({storage_path:storagePath,filename:pdfFile.name,params})});if(!response.ok){const err=await response.json().catch(()=>null);throw new Error(err?.detail||`분할 출력 실패 (${response.status})`);}return readDelivery(response);}catch(error){try{await st.ref(storagePath).delete();}catch(_){}throw error;}
  }

  function download(blob,name){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);}

  async function runTiling(){
    if(!sourceFile||!sourceInfo)return;setBusy(true,'분할 PDF 만드는 중...');setStatus('원본 실제 크기를 기준으로 분할 계산 중...');
    try{
      const pdfFile=sourceInfo.kind==='image'?await imageToPdf(sourceFile):sourceFile;
      const params={paper_size:$('plotPaper').value,orientation:$('plotOrientation').value,printer_margin_mm:Number($('plotMargin').value||3),overlap_mm:Number($('plotOverlap').value||0),add_sheet_labels:!!$('plotLabels').checked};
      const blob=await requestTiling(pdfFile,params);const base=String(sourceFile.name||'large_output').replace(/\.[^.]+$/,'');download(blob,`${base}_분할출력.pdf`);setStatus('분할 출력 PDF 저장 완료. 프린터에서는 배율 100% / 실제 크기로 출력하세요.');
    }catch(error){console.error('[tiling] failed',error);setStatus(error?.message||'분할 출력 PDF를 만들지 못했습니다.',true);if(typeof window.showError==='function')window.showError(error?.message||'분할 출력에 실패했습니다.');}
    finally{setBusy(false);}
  }

  function install(){installStyles();makeModal();const ok=installCard();if(ok||$('pdfLargeOutputTilingCard')){window.PdfLargeOutputTiling={open:openModal,renderPreview,stage:'large-output-tiling-v1'};document.documentElement.dataset.pdfLargeOutputTiling='1';return true;}return false;}
  let attempts=0;function boot(){attempts+=1;if(install())return;if(attempts<80)setTimeout(boot,100);}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
