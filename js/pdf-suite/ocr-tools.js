// Program Studio PDF Suite: browser-local Korean/English OCR and searchable PDF.
(function(){
  'use strict';
  if(window.__programStudioPdfSuiteOcrV3)return;
  window.__programStudioPdfSuiteOcrV3=true;

  const TESSERACT_VERSION='7.0.0';
  const PDFJS_VERSION='3.11.174';
  const TESSERACT_SRC=`https://cdn.jsdelivr.net/npm/tesseract.js@${TESSERACT_VERSION}/dist/tesseract.min.js`;
  const PDFJS_SRC=`https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.min.js`;
  const PDFJS_WORKER=`https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.js`;
  const PDFLIB_SRC='https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js';
  const MAX_OCR_BYTES=40*1024*1024;
  const MAX_OCR_PAGES=30;
  const OCR_DPI=180;
  const MAX_CANVAS_PIXELS=16_000_000;
  const NATIVE_TEXT_THRESHOLD=30;

  const $=id=>document.getElementById(id);
  let tesseractPromise=null,pdfJsPromise=null,pdfLibPromise=null;
  let session=null;

  function safeBase(file){return String(file?.name||'document.pdf').replace(/\.pdf$/i,'').replace(/[\\/:*?"<>|]+/g,'_').slice(0,90)||'document';}
  function isPdf(file){return Boolean(file)&&(/\.pdf$/i.test(file.name||'')||file.type==='application/pdf');}
  function validatePdf(file){
    if(!isPdf(file))throw new Error('PDF 파일만 선택할 수 있습니다.');
    if(Number(file.size||0)>MAX_OCR_BYTES)throw new Error('OCR은 브라우저 메모리 보호를 위해 40MB 이하 PDF만 지원합니다.');
  }
  function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
  function bytesText(bytes){const mb=Number(bytes||0)/1048576;return mb<1?`${Math.max(1,Math.round(Number(bytes||0)/1024))}KB`:`${mb.toFixed(1)}MB`;}
  function downloadBlob(blob,name){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2500);}
  function downloadText(text,name){downloadBlob(new Blob(['\uFEFF',text],{type:'text/plain;charset=utf-8'}),name);}

  function loadScript(src,marker,ready){
    if(ready())return Promise.resolve();
    return new Promise((resolve,reject)=>{
      let script=document.querySelector(`script[data-pdf-suite-ocr-lib="${marker}"]`);
      if(script?.dataset.failed==='1'){script.remove();script=null;}
      if(script){
        const started=Date.now();
        const poll=()=>{if(ready())return resolve();if(Date.now()-started>20000){script.dataset.failed='1';script.remove();return reject(new Error('OCR 엔진 로딩 시간이 초과되었습니다.'));}setTimeout(poll,80);};
        poll();return;
      }
      script=document.createElement('script');script.src=src;script.async=true;script.crossOrigin='anonymous';script.referrerPolicy='no-referrer';script.dataset.pdfSuiteOcrLib=marker;
      const timer=setTimeout(()=>{script.dataset.failed='1';script.remove();reject(new Error('OCR 엔진 로딩 시간이 초과되었습니다.'));},20000);
      script.onload=()=>{clearTimeout(timer);ready()?resolve():(script.dataset.failed='1',script.remove(),reject(new Error('OCR 엔진 초기화에 실패했습니다.')));};
      script.onerror=()=>{clearTimeout(timer);script.dataset.failed='1';script.remove();reject(new Error('OCR 엔진을 불러오지 못했습니다. 네트워크 연결을 확인하세요.'));};
      document.head.appendChild(script);
    });
  }
  function ensureTesseract(){
    if(window.Tesseract?.createWorker)return Promise.resolve(window.Tesseract);
    if(tesseractPromise)return tesseractPromise;
    tesseractPromise=loadScript(TESSERACT_SRC,'tesseract',()=>Boolean(window.Tesseract?.createWorker)).then(()=>window.Tesseract).catch(error=>{tesseractPromise=null;throw error;});
    return tesseractPromise;
  }
  function ensurePdfJs(){
    if(window.pdfjsLib?.getDocument){window.pdfjsLib.GlobalWorkerOptions.workerSrc=PDFJS_WORKER;return Promise.resolve(window.pdfjsLib);}
    if(pdfJsPromise)return pdfJsPromise;
    pdfJsPromise=loadScript(PDFJS_SRC,'pdfjs',()=>Boolean(window.pdfjsLib?.getDocument)).then(()=>{window.pdfjsLib.GlobalWorkerOptions.workerSrc=PDFJS_WORKER;return window.pdfjsLib;}).catch(error=>{pdfJsPromise=null;throw error;});
    return pdfJsPromise;
  }
  function ensurePdfLib(){
    if(window.PDFLib?.PDFDocument)return Promise.resolve(window.PDFLib);
    if(pdfLibPromise)return pdfLibPromise;
    pdfLibPromise=loadScript(PDFLIB_SRC,'pdf-lib',()=>Boolean(window.PDFLib?.PDFDocument)).then(()=>window.PDFLib).catch(error=>{pdfLibPromise=null;throw error;});
    return pdfLibPromise;
  }

  function installStyles(){
    if($('pdfSuiteOcrStyles'))return;
    const style=document.createElement('style');style.id='pdfSuiteOcrStyles';style.textContent=`
      .pdfocr-overlay{position:fixed;inset:0;z-index:1950;display:none;align-items:center;justify-content:center;padding:18px;background:rgba(15,23,42,.68);backdrop-filter:blur(5px)}.pdfocr-overlay.open{display:flex}
      .pdfocr-dialog{width:min(760px,100%);max-height:94vh;overflow:auto;background:#fff;border-radius:22px;padding:22px;box-shadow:0 30px 90px rgba(0,0,0,.34)}.pdfocr-head{display:flex;gap:12px;align-items:flex-start}.pdfocr-head>div{flex:1}.pdfocr-head h3{font-size:20px;font-weight:950;color:#0f172a}.pdfocr-head p{margin-top:4px;font-size:11px;color:#64748b;line-height:1.55}.pdfocr-close{width:36px;height:36px;border:0;border-radius:10px;background:#f1f5f9;font-size:21px;cursor:pointer}
      .pdfocr-file{display:block;margin-top:15px;border:2px dashed #bfd2e5;background:#f8fbff;border-radius:14px;padding:18px;text-align:center;font-size:11px;font-weight:900;color:#334155;cursor:pointer}.pdfocr-file input{display:none}.pdfocr-selected{margin-top:7px;font-size:9px;color:#64748b;word-break:break-all}
      .pdfocr-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:13px}.pdfocr-label{display:block;font-size:10px;font-weight:900;color:#475569;margin-bottom:6px}.pdfocr-select{width:100%;border:1.5px solid #dbe4ee;background:#fff;border-radius:11px;padding:10px;font-size:11px}.pdfocr-check{display:flex;align-items:flex-start;gap:8px;margin-top:13px;border:1px solid #dbe4ee;background:#f8fafc;border-radius:11px;padding:10px;font-size:10px;color:#475569}.pdfocr-check input{margin-top:2px}
      .pdfocr-progress{height:9px;border-radius:999px;background:#e2e8f0;overflow:hidden;margin-top:14px}.pdfocr-bar{height:100%;width:0;background:linear-gradient(90deg,#2563eb,#0891b2);transition:width .18s}.pdfocr-status{min-height:38px;margin-top:8px;font-size:10px;font-weight:850;color:#2563eb;line-height:1.55}.pdfocr-status.err{color:#dc2626}.pdfocr-status.ok{color:#15803d}
      .pdfocr-note{margin-top:12px;border:1px solid #bae6fd;background:#f0f9ff;color:#075985;border-radius:11px;padding:10px 12px;font-size:9px;line-height:1.55}.pdfocr-warn{border-color:#fde68a;background:#fffbeb;color:#92400e}.pdfocr-actions{display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap;margin-top:15px}.pdfocr-btn{border-radius:10px;padding:10px 14px;font-size:11px;font-weight:900;cursor:pointer}.pdfocr-secondary{border:1px solid #dbe4ee;background:#f8fafc;color:#475569}.pdfocr-primary{border:0;background:linear-gradient(135deg,#1d4ed8,#0891b2);color:#fff}.pdfocr-btn:disabled{opacity:.42;cursor:not-allowed}.pdfocr-ready{cursor:pointer!important}
      @media(max-width:600px){.pdfocr-dialog{padding:17px}.pdfocr-grid{grid-template-columns:1fr}}
    `;document.head.appendChild(style);
  }
  function setStatus(overlay,text,type='info'){const node=overlay.querySelector('[data-ocr-status]');node.textContent=text||'';node.className='pdfocr-status'+(type==='err'?' err':type==='ok'?' ok':'');}
  function setProgress(overlay,value){overlay.querySelector('[data-ocr-bar]').style.width=`${Math.max(0,Math.min(100,Number(value)||0))}%`;}
  function setBusy(overlay,busy){overlay.querySelector('[data-ocr-run]').disabled=busy;overlay.querySelector('[data-ocr-close]').disabled=busy;overlay.querySelector('[data-ocr-cancel]').hidden=!busy;}

  function createModal(){
    let overlay=$('pdfSuiteOcrModal');if(overlay)return overlay;
    overlay=document.createElement('div');overlay.id='pdfSuiteOcrModal';overlay.className='pdfocr-overlay';overlay.innerHTML=`
      <div class="pdfocr-dialog" role="dialog" aria-modal="true" aria-labelledby="pdfOcrTitle">
        <div class="pdfocr-head"><div><h3 id="pdfOcrTitle">한국어·영어 OCR</h3><p>스캔 PDF를 페이지 이미지로 렌더링한 뒤 브라우저 안의 Tesseract OCR로 글자를 인식합니다.</p></div><button class="pdfocr-close" data-ocr-close type="button" aria-label="닫기">×</button></div>
        <label class="pdfocr-file">📄 OCR할 PDF 선택<input data-ocr-file type="file" accept="application/pdf"><span class="pdfocr-selected" data-ocr-selected>파일을 선택하세요.</span></label>
        <div class="pdfocr-grid"><label><span class="pdfocr-label">결과 형식</span><select class="pdfocr-select" data-ocr-mode><option value="pdf">검색 가능한 PDF + TXT</option><option value="txt">OCR TXT만 저장</option></select></label><label><span class="pdfocr-label">인식 언어</span><select class="pdfocr-select" data-ocr-lang><option value="kor+eng">한국어 + 영어</option><option value="kor">한국어</option><option value="eng">영어</option></select></label></div>
        <label class="pdfocr-check"><input data-ocr-native type="checkbox" checked><span><b>이미 텍스트가 있는 페이지는 OCR하지 않고 유지</b><br>기존 텍스트 페이지의 품질·링크·벡터를 보존하고, 스캔 페이지에만 OCR을 적용합니다.</span></label>
        <div class="pdfocr-progress"><div class="pdfocr-bar" data-ocr-bar></div></div><div class="pdfocr-status" data-ocr-status></div>
        <div class="pdfocr-note">개인 PDF 내용은 Program Studio 서버로 업로드하지 않습니다. 다만 OCR 실행 시 Tesseract 엔진과 선택 언어 학습 데이터가 jsDelivr에서 브라우저로 다운로드됩니다.</div>
        <div class="pdfocr-note pdfocr-warn">최대 40MB · 30페이지. OCR 정확도는 원본 해상도, 기울기, 글꼴, 배경 노이즈에 따라 달라집니다. 중요한 문서는 결과를 직접 검수하세요.</div>
        <div class="pdfocr-actions"><button class="pdfocr-btn pdfocr-secondary" data-ocr-cancel type="button" hidden>작업 취소</button><button class="pdfocr-btn pdfocr-primary" data-ocr-run type="button">OCR 실행</button></div>
      </div>`;
    document.body.appendChild(overlay);
    const close=()=>{if(session?.running)return;overlay.classList.remove('open');document.body.style.overflow='';};
    overlay.querySelector('[data-ocr-close]').onclick=close;overlay.addEventListener('click',event=>{if(event.target===overlay)close();});
    overlay.querySelector('[data-ocr-file]').onchange=event=>{const file=event.target.files?.[0];overlay.querySelector('[data-ocr-selected]').textContent=file?`${file.name} · ${bytesText(file.size)}`:'파일을 선택하세요.';};
    overlay.querySelector('[data-ocr-run]').onclick=()=>runOcr(overlay);
    overlay.querySelector('[data-ocr-cancel]').onclick=()=>cancelOcr(overlay);
    return overlay;
  }
  function openModal(mode='pdf'){
    installStyles();const overlay=createModal();overlay.querySelector('[data-ocr-mode]').value=mode;setProgress(overlay,0);setStatus(overlay,'');overlay.classList.add('open');document.body.style.overflow='hidden';
  }

  function pageScale(viewport){
    let scale=OCR_DPI/72;const pixels=viewport.width*viewport.height*scale*scale;if(pixels>MAX_CANVAS_PIXELS)scale*=Math.sqrt(MAX_CANVAS_PIXELS/pixels);return Math.max(1,scale);
  }
  function textFromItems(content){return (content?.items||[]).map(item=>typeof item.str==='string'?item.str:'').join(' ').replace(/\s+/g,' ').trim();}
  async function pdfOutputBytes(value){
    if(value instanceof Uint8Array)return value;if(value instanceof ArrayBuffer)return new Uint8Array(value);if(value?.arrayBuffer)return new Uint8Array(await value.arrayBuffer());throw new Error('OCR 엔진이 검색 가능한 PDF 데이터를 반환하지 않았습니다.');
  }
  async function cancelOcr(overlay){
    if(!session?.running)return;session.cancelled=true;setStatus(overlay,'OCR 작업을 취소하는 중입니다...');try{await session.worker?.terminate?.();}catch(_){}
  }

  async function runOcr(overlay){
    const file=overlay.querySelector('[data-ocr-file]').files?.[0];const mode=overlay.querySelector('[data-ocr-mode]').value;const language=overlay.querySelector('[data-ocr-lang]').value;const preserveNative=overlay.querySelector('[data-ocr-native]').checked;
    let worker=null;
    try{
      validatePdf(file);setBusy(overlay,true);setProgress(overlay,1);setStatus(overlay,'PDF와 OCR 엔진을 준비하는 중입니다...');
      const [pdfjs,PDFLib,Tesseract]=await Promise.all([ensurePdfJs(),ensurePdfLib(),ensureTesseract()]);
      const raw=new Uint8Array(await file.arrayBuffer());
      let pdf;
      try{pdf=await pdfjs.getDocument({data:raw.slice()}).promise;}catch(error){if(/password/i.test(String(error?.message||'')))throw new Error('암호화된 PDF입니다. 먼저 암호를 해제하세요.');throw new Error('PDF를 열 수 없습니다.');}
      if(pdf.numPages>MAX_OCR_PAGES)throw new Error(`OCR은 최대 ${MAX_OCR_PAGES}페이지까지 지원합니다.`);
      const sourceDoc=await PDFLib.PDFDocument.load(raw,{ignoreEncryption:false,updateMetadata:false});
      const output=mode==='pdf'?await PDFLib.PDFDocument.create():null;const textPages=[];
      let activePage=0,engineProgress=0;
      worker=await Tesseract.createWorker(language,1,{logger:message=>{if(!session?.running)return;engineProgress=Number(message?.progress||0);const pagePart=activePage?` · ${activePage}/${pdf.numPages}페이지`:'';setStatus(overlay,`${String(message?.status||'OCR 처리 중')}${pagePart}`);const base=(Math.max(0,activePage-1)/pdf.numPages)*100;setProgress(overlay,Math.min(98,base+(engineProgress/pdf.numPages)*100));}});
      session={running:true,cancelled:false,worker};
      for(let pageNo=1;pageNo<=pdf.numPages;pageNo++){
        if(session.cancelled)throw new Error('사용자가 OCR 작업을 취소했습니다.');activePage=pageNo;engineProgress=0;
        const page=await pdf.getPage(pageNo);const content=await page.getTextContent().catch(()=>({items:[]}));const nativeText=textFromItems(content);const baseViewport=page.getViewport({scale:1});
        if(preserveNative&&nativeText.length>=NATIVE_TEXT_THRESHOLD){
          textPages.push(`===== ${pageNo} / ${pdf.numPages} 페이지 · 기존 텍스트 =====\n${nativeText}`);
          if(output){const [copied]=await output.copyPages(sourceDoc,[pageNo-1]);output.addPage(copied);}
          setStatus(overlay,`기존 텍스트 페이지 유지 · ${pageNo}/${pdf.numPages}`);setProgress(overlay,(pageNo/pdf.numPages)*100);continue;
        }
        const scale=pageScale(baseViewport);const viewport=page.getViewport({scale});const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(viewport.width));canvas.height=Math.max(1,Math.round(viewport.height));const ctx=canvas.getContext('2d',{alpha:false});
        await page.render({canvasContext:ctx,viewport,background:'#FFFFFF'}).promise;
        setStatus(overlay,`OCR 인식 중 · ${pageNo}/${pdf.numPages}페이지`);
        const result=await worker.recognize(canvas,{pdfTitle:`${file.name} ${pageNo}`},{text:true,pdf:mode==='pdf'});const recognized=String(result?.data?.text||'').trim();textPages.push(`===== ${pageNo} / ${pdf.numPages} 페이지 · OCR =====\n${recognized}`);
        if(output){
          const onePageBytes=await pdfOutputBytes(result?.data?.pdf);const ocrDoc=await PDFLib.PDFDocument.load(onePageBytes,{updateMetadata:false});const sourcePage=ocrDoc.getPage(0);const embedded=await output.embedPage(sourcePage);const outPage=output.addPage([baseViewport.width,baseViewport.height]);outPage.drawPage(embedded,{x:0,y:0,width:baseViewport.width,height:baseViewport.height});
        }
        canvas.width=1;canvas.height=1;setProgress(overlay,(pageNo/pdf.numPages)*100);
      }
      if(session.cancelled)throw new Error('사용자가 OCR 작업을 취소했습니다.');
      const text=textPages.join('\n\n');downloadText(text,`${safeBase(file)}_OCR.txt`);
      if(output){output.setTitle(`${safeBase(file)} OCR`);output.setCreator('Program Studio PDF OCR');output.setProducer('Program Studio + Tesseract.js');const bytes=await output.save({useObjectStreams:true,addDefaultPage:false});downloadBlob(new Blob([bytes],{type:'application/pdf'}),`${safeBase(file)}_검색가능_OCR.pdf`);}
      setProgress(overlay,100);setStatus(overlay,`${pdf.numPages}페이지 OCR 처리가 완료되었습니다. ${mode==='pdf'?'검색 가능한 PDF와 TXT':'TXT'}를 저장했습니다.`,'ok');document.documentElement.dataset.pdfSuiteOcrRun='done';
    }catch(error){setStatus(overlay,error?.message||'OCR 처리에 실패했습니다.','err');}
    finally{
      try{await worker?.terminate?.();}catch(_){}if(session)session.running=false;session=null;setBusy(overlay,false);
    }
  }

  function promote(name,mode,copy){
    const card=[...document.querySelectorAll('.tool')].find(node=>node.querySelector('.tool-name')?.textContent?.trim()===name);if(!card)return null;
    card.classList.remove('planned');card.classList.add('available','pdfocr-ready');card.dataset.status='local';card.dataset.ocrMode=mode;card.setAttribute('role','button');card.setAttribute('tabindex','0');
    const badge=card.querySelector('.status');if(badge){badge.className='status local';badge.textContent='로컬 OCR';}if(copy?.name)card.querySelector('.tool-name').textContent=copy.name;if(copy?.desc)card.querySelector('.tool-desc').textContent=copy.desc;
    card.addEventListener('click',()=>openModal(mode));card.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();openModal(mode);}});return card;
  }
  function removeRoadmap(text){[...document.querySelectorAll('.roadmap-tag')].filter(node=>node.textContent.trim()===text).forEach(node=>node.remove());}
  function boot(){
    installStyles();promote('OCR 문자 인식','txt',{name:'한국어·영어 OCR 문자 인식',desc:'PDF 페이지를 고해상도 이미지로 렌더링해 한국어·영어 글자를 인식하고 TXT로 저장합니다.'});promote('검색 가능한 PDF','pdf',{name:'OCR 검색 가능한 PDF',desc:'스캔 페이지만 OCR 처리해 검색·복사가 가능한 PDF와 TXT를 만듭니다.'});removeRoadmap('한국어 OCR');removeRoadmap('검색 가능한 PDF');
    window.ProgramStudioPdfSuiteOcr=Object.freeze({version:'2026.09.05.001',tesseractVersion:TESSERACT_VERSION,maxBytes:MAX_OCR_BYTES,maxPages:MAX_OCR_PAGES,open:openModal});document.documentElement.dataset.pdfSuiteOcr='ready';
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
