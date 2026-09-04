// Program Studio PDF Suite: advanced browser-local PDF tools.
(function(){
  'use strict';
  if(window.__programStudioPdfSuiteAdvancedV2)return;
  window.__programStudioPdfSuiteAdvancedV2=true;

  const PDFJS_VERSION='3.11.174';
  const PDFJS_SRC=`https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.min.js`;
  const PDFJS_WORKER_SRC=`https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.js`;
  const PDF_LIB_SRC='https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js';
  const MAX_FILE_BYTES=80*1024*1024;
  const MAX_COMPARE_PAGES=80;
  const MAX_REDACT_PAGES=80;
  const REDACTION_SCALE=2;
  const $=id=>document.getElementById(id);
  let pdfJsPromise=null;
  let pdfLibPromise=null;
  let compareState=null;
  let redactState=null;

  function safeBase(file){
    return String(file?.name||'document.pdf').replace(/\.pdf$/i,'').replace(/[\\/:*?"<>|]+/g,'_').slice(0,90)||'document';
  }
  function isPdf(file){return Boolean(file)&&(/\.pdf$/i.test(file.name||'')||file.type==='application/pdf');}
  function validatePdf(file,limit=MAX_FILE_BYTES){
    if(!isPdf(file))throw new Error('PDF 파일만 선택할 수 있습니다.');
    if(Number(file.size||0)>limit)throw new Error(`이 로컬 도구는 ${(limit/1024/1024)|0}MB 이하 PDF를 지원합니다.`);
  }
  function humanBytes(bytes){
    const value=Number(bytes||0);
    if(value<1024*1024)return `${Math.max(1,Math.round(value/1024))}KB`;
    return `${(value/1024/1024).toFixed(1)}MB`;
  }
  function escapeHtml(value){
    return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  }
  function loadScript(src,marker,ready){
    if(ready())return Promise.resolve();
    return new Promise((resolve,reject)=>{
      let script=document.querySelector(`script[data-pdf-suite-advanced-lib="${marker}"]`);
      if(script?.dataset.failed==='1'){script.remove();script=null;}
      if(script){
        const started=Date.now();
        const poll=()=>{
          if(ready())return resolve();
          if(Date.now()-started>15000){script.dataset.failed='1';script.remove();return reject(new Error('PDF 엔진 로딩 시간이 초과되었습니다.'));}
          setTimeout(poll,60);
        };
        poll();
        return;
      }
      script=document.createElement('script');
      script.src=src;
      script.async=true;
      script.crossOrigin='anonymous';
      script.referrerPolicy='no-referrer';
      script.dataset.pdfSuiteAdvancedLib=marker;
      const timer=setTimeout(()=>{
        script.dataset.failed='1';script.remove();reject(new Error('PDF 엔진 로딩 시간이 초과되었습니다.'));
      },15000);
      script.onload=()=>{
        clearTimeout(timer);
        if(ready())resolve();
        else{script.dataset.failed='1';script.remove();reject(new Error('PDF 엔진 초기화에 실패했습니다.'));}
      };
      script.onerror=()=>{
        clearTimeout(timer);script.dataset.failed='1';script.remove();reject(new Error('PDF 엔진을 불러오지 못했습니다. 네트워크 연결을 확인하세요.'));
      };
      document.head.appendChild(script);
    });
  }
  function ensurePdfJs(){
    if(window.pdfjsLib?.getDocument){window.pdfjsLib.GlobalWorkerOptions.workerSrc=PDFJS_WORKER_SRC;return Promise.resolve(window.pdfjsLib);}
    if(pdfJsPromise)return pdfJsPromise;
    pdfJsPromise=loadScript(PDFJS_SRC,'pdfjs',()=>Boolean(window.pdfjsLib?.getDocument)).then(()=>{
      window.pdfjsLib.GlobalWorkerOptions.workerSrc=PDFJS_WORKER_SRC;
      return window.pdfjsLib;
    }).catch(error=>{pdfJsPromise=null;throw error;});
    return pdfJsPromise;
  }
  function ensurePdfLib(){
    if(window.PDFLib?.PDFDocument)return Promise.resolve(window.PDFLib);
    if(pdfLibPromise)return pdfLibPromise;
    pdfLibPromise=loadScript(PDF_LIB_SRC,'pdf-lib',()=>Boolean(window.PDFLib?.PDFDocument)).then(()=>window.PDFLib).catch(error=>{pdfLibPromise=null;throw error;});
    return pdfLibPromise;
  }
  async function openPdf(file){
    validatePdf(file);
    const pdfjs=await ensurePdfJs();
    try{
      const bytes=new Uint8Array(await file.arrayBuffer());
      return await pdfjs.getDocument({data:bytes,disableFontFace:false,useSystemFonts:true}).promise;
    }catch(error){
      const text=String(error?.message||'');
      if(/password|encrypted/i.test(text))throw new Error('암호화된 PDF입니다. 먼저 암호를 해제하세요.');
      throw new Error('PDF를 열 수 없습니다. 손상되었거나 지원되지 않는 구조일 수 있습니다.');
    }
  }
  function downloadBlob(blob,name){
    const url=URL.createObjectURL(blob);
    const link=document.createElement('a');
    link.href=url;link.download=name;document.body.appendChild(link);link.click();link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),2500);
  }
  function downloadText(text,name,type='text/plain;charset=utf-8'){
    downloadBlob(new Blob(['\uFEFF',text],{type}),name);
  }
  function setGlobalStatus(message,type='info'){
    const node=$('localStatus');
    if(!node)return;
    node.textContent=message||'';
    node.className='local-status'+(type==='ok'?' ok':type==='err'?' err':'');
  }

  function installStyles(){
    if($('pdfSuiteAdvancedStyles'))return;
    const style=document.createElement('style');
    style.id='pdfSuiteAdvancedStyles';
    style.textContent=`
      .pdfadv-overlay{position:fixed;inset:0;z-index:1900;background:rgba(15,23,42,.68);display:none;align-items:center;justify-content:center;padding:18px;backdrop-filter:blur(5px)}
      .pdfadv-overlay.open{display:flex}.pdfadv-dialog{width:min(920px,100%);max-height:94vh;overflow:auto;background:#fff;border-radius:22px;box-shadow:0 30px 90px rgba(0,0,0,.34);padding:22px}
      .pdfadv-head{display:flex;gap:12px;align-items:flex-start}.pdfadv-head-text{flex:1}.pdfadv-head h3{font-size:20px;font-weight:950;color:#0f172a}.pdfadv-head p{margin-top:4px;font-size:11px;color:#64748b;line-height:1.55}.pdfadv-close{width:36px;height:36px;border:0;border-radius:10px;background:#f1f5f9;font-size:21px;cursor:pointer}
      .pdfadv-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:16px}.pdfadv-field{display:block}.pdfadv-label{display:block;font-size:10px;font-weight:900;color:#475569;margin-bottom:6px}.pdfadv-input{width:100%;border:1.5px solid #dbe4ee;background:#fff;border-radius:11px;padding:10px;font-size:11px}.pdfadv-file{border:2px dashed #c7d7e8;background:#f8fbff;border-radius:13px;padding:16px;text-align:center;cursor:pointer;font-size:11px;font-weight:850;color:#334155}.pdfadv-file input{display:none}
      .pdfadv-actions{display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap;margin-top:16px}.pdfadv-btn{border-radius:10px;padding:10px 14px;font-size:11px;font-weight:900;cursor:pointer}.pdfadv-secondary{border:1px solid #dbe4ee;background:#f8fafc;color:#475569}.pdfadv-primary{border:0;background:linear-gradient(135deg,#164e8f,#0891b2);color:#fff}.pdfadv-danger{border:0;background:#991b1b;color:#fff}.pdfadv-btn:disabled{opacity:.45;cursor:not-allowed}
      .pdfadv-status{min-height:20px;margin-top:11px;font-size:11px;font-weight:850;color:#2563eb}.pdfadv-status.err{color:#dc2626}.pdfadv-status.ok{color:#15803d}.pdfadv-note{margin-top:12px;border:1px solid #fde68a;background:#fffbeb;color:#92400e;border-radius:11px;padding:10px 12px;font-size:10px;line-height:1.55}
      .pdfadv-report{margin-top:14px;border:1px solid #dbe4ee;border-radius:13px;overflow:hidden}.pdfadv-report table{width:100%;border-collapse:collapse;font-size:10px}.pdfadv-report th,.pdfadv-report td{padding:8px 9px;border-bottom:1px solid #edf2f7;text-align:left}.pdfadv-report th{background:#f8fafc;color:#475569;font-weight:900}.pdfadv-report tr:last-child td{border-bottom:0}.pdfadv-chip{display:inline-flex;border-radius:999px;padding:3px 7px;font-weight:900}.pdfadv-chip.same{background:#dcfce7;color:#15803d}.pdfadv-chip.diff{background:#fee2e2;color:#b91c1c}.pdfadv-chip.warn{background:#fef3c7;color:#b45309}
      .pdfadv-summary{margin-top:12px;display:flex;gap:7px;flex-wrap:wrap}.pdfadv-summary span{border:1px solid #dbe4ee;background:#f8fafc;border-radius:999px;padding:5px 8px;font-size:9px;font-weight:850;color:#475569}
      .pdfadv-preview-shell{margin-top:14px;border:1px solid #dbe4ee;border-radius:14px;padding:10px;background:#eef4f8}.pdfadv-preview-toolbar{display:flex;gap:7px;align-items:center;justify-content:center;margin-bottom:9px}.pdfadv-preview-wrap{position:relative;margin:0 auto;width:fit-content;max-width:100%;line-height:0;background:#fff;box-shadow:0 5px 18px rgba(15,23,42,.12)}.pdfadv-preview-wrap canvas{display:block;max-width:100%;height:auto}.pdfadv-redact-overlay{position:absolute;inset:0;cursor:crosshair;touch-action:none}.pdfadv-redact-box{position:absolute;background:rgba(0,0,0,.72);border:1px solid #111827}.pdfadv-page-label{font-size:10px;font-weight:900;color:#475569;min-width:90px;text-align:center}
      .pdfadv-list{margin-top:13px;display:grid;gap:8px}.pdfadv-list-row{display:flex;gap:10px;align-items:center;border:1px solid #e2e8f0;border-radius:10px;padding:9px 10px}.pdfadv-list-row .grow{flex:1;min-width:0}.pdfadv-list-row strong{display:block;font-size:11px}.pdfadv-list-row small{display:block;font-size:9px;color:#64748b;margin-top:2px;word-break:break-all}.pdfadv-mini{border:1px solid #dbe4ee;background:#fff;border-radius:8px;padding:6px 8px;font-size:9px;font-weight:900;cursor:pointer}
      .pdfadv-tool-ready{cursor:pointer!important}.pdfadv-tool-ready:focus-visible{outline:3px solid rgba(37,99,235,.25);outline-offset:3px}
      @media(max-width:680px){.pdfadv-dialog{padding:17px}.pdfadv-grid{grid-template-columns:1fr}.pdfadv-report{overflow:auto}.pdfadv-report table{min-width:620px}}
    `;
    document.head.appendChild(style);
  }

  function makeOverlay(id,title,description,bodyHtml){
    let overlay=$(id);
    if(overlay)return overlay;
    overlay=document.createElement('div');
    overlay.id=id;overlay.className='pdfadv-overlay';
    overlay.innerHTML=`<div class="pdfadv-dialog" role="dialog" aria-modal="true"><div class="pdfadv-head"><div class="pdfadv-head-text"><h3>${escapeHtml(title)}</h3><p>${escapeHtml(description)}</p></div><button class="pdfadv-close" type="button" aria-label="닫기">×</button></div>${bodyHtml}</div>`;
    overlay.addEventListener('click',event=>{if(event.target===overlay)closeOverlay(overlay);});
    overlay.querySelector('.pdfadv-close').addEventListener('click',()=>closeOverlay(overlay));
    document.body.appendChild(overlay);
    return overlay;
  }
  function openOverlay(overlay){overlay.classList.add('open');document.body.style.overflow='hidden';}
  function closeOverlay(overlay){overlay?.classList.remove('open');document.body.style.overflow='';}
  function setOverlayStatus(overlay,message,type='info'){
    const node=overlay?.querySelector('[data-pdfadv-status]');
    if(!node)return;
    node.textContent=message||'';node.className='pdfadv-status'+(type==='err'?' err':type==='ok'?' ok':'');
  }

  function selectedSuiteFile(){
    const file=window.ProgramStudioPdfSuite?.getSelectedFile?.();
    return isPdf(file)?file:null;
  }

  async function extractText(file){
    validatePdf(file);
    const pdf=await openPdf(file);
    const chunks=[];
    let totalChars=0;
    for(let pageNo=1;pageNo<=pdf.numPages;pageNo++){
      const page=await pdf.getPage(pageNo);
      const content=await page.getTextContent({includeMarkedContent:false,disableNormalization:false});
      const lines=new Map();
      content.items.forEach(item=>{
        if(!item||typeof item.str!=='string')return;
        const y=Math.round(Number(item.transform?.[5]||0)*2)/2;
        const bucket=lines.get(y)||[];
        bucket.push({x:Number(item.transform?.[4]||0),text:item.str});
        lines.set(y,bucket);
      });
      const pageLines=[...lines.entries()].sort((a,b)=>b[0]-a[0]).map(([,items])=>items.sort((a,b)=>a.x-b.x).map(item=>item.text).join(' ').replace(/\s+/g,' ').trim()).filter(Boolean);
      const text=pageLines.join('\n');
      totalChars+=text.length;
      chunks.push(`===== ${pageNo} / ${pdf.numPages} 페이지 =====\n${text}`);
    }
    const output=chunks.join('\n\n');
    if(!totalChars)throw new Error('추출 가능한 텍스트 레이어가 없습니다. 스캔 PDF는 OCR 기능이 필요합니다.');
    downloadText(output,`${safeBase(file)}_본문텍스트.txt`);
    return `${pdf.numPages}페이지에서 약 ${totalChars.toLocaleString('ko-KR')}자의 텍스트를 추출했습니다.`;
  }

  function compareModal(){
    const overlay=makeOverlay('pdfAdvancedCompare','PDF 버전 비교','두 PDF의 페이지 크기, 텍스트 레이어, 저해상도 렌더링 차이를 브라우저에서 비교합니다.',`
      <div class="pdfadv-grid"><label class="pdfadv-file">기준 PDF 선택<input data-compare-a type="file" accept="application/pdf"></label><label class="pdfadv-file">비교 PDF 선택<input data-compare-b type="file" accept="application/pdf"></label></div>
      <div class="pdfadv-summary" data-compare-summary></div><div class="pdfadv-status" data-pdfadv-status></div><div class="pdfadv-report" data-compare-report hidden></div>
      <div class="pdfadv-actions"><button class="pdfadv-btn pdfadv-secondary" type="button" data-compare-download disabled>비교 리포트 TXT</button><button class="pdfadv-btn pdfadv-primary" type="button" data-compare-run>비교 실행</button></div>
      <div class="pdfadv-note">시각 비교는 빠른 변경 탐지용 저해상도 픽셀 비교입니다. 법적 감정·색상 검증·인쇄 교정 판정의 대체 수단은 아닙니다.</div>`);
    const a=overlay.querySelector('[data-compare-a]');
    const selected=selectedSuiteFile();if(selected&&!a.files?.length)overlay.dataset.prefillName=selected.name;
    const run=overlay.querySelector('[data-compare-run]');
    run.onclick=()=>runCompare(overlay);
    overlay.querySelector('[data-compare-download]').onclick=()=>{
      if(!compareState?.text)return;
      downloadText(compareState.text,`${compareState.base}_PDF비교리포트.txt`);
    };
    return overlay;
  }

  function normalizedText(content){
    return content.items.map(item=>typeof item.str==='string'?item.str:'').join(' ').normalize('NFKC').replace(/\s+/g,' ').trim();
  }
  function stringDifference(a,b){
    if(a===b)return 0;
    if(!a&&!b)return 0;
    const max=Math.max(a.length,b.length,1);
    let same=0;
    const limit=Math.min(a.length,b.length);
    for(let i=0;i<limit;i++)if(a[i]===b[i])same++;
    return Math.min(100,Math.max(0,100-(same/max*100)));
  }
  function makeCanvas(width,height){
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(width));canvas.height=Math.max(1,Math.round(height));return canvas;
  }
  async function renderComparePage(page,targetWidth=320){
    const base=page.getViewport({scale:1});
    const scale=Math.min(1,targetWidth/Math.max(1,base.width));
    const viewport=page.getViewport({scale});
    const canvas=makeCanvas(viewport.width,viewport.height);
    const context=canvas.getContext('2d',{willReadFrequently:true});
    await page.render({canvasContext:context,viewport,background:'#FFFFFF'}).promise;
    return {canvas,viewport,base};
  }
  function visualDifference(a,b){
    const width=Math.max(a.canvas.width,b.canvas.width);
    const height=Math.max(a.canvas.height,b.canvas.height);
    const ca=makeCanvas(width,height),cb=makeCanvas(width,height);
    const xa=ca.getContext('2d',{willReadFrequently:true}),xb=cb.getContext('2d',{willReadFrequently:true});
    xa.fillStyle='#fff';xa.fillRect(0,0,width,height);xb.fillStyle='#fff';xb.fillRect(0,0,width,height);
    xa.drawImage(a.canvas,0,0);xb.drawImage(b.canvas,0,0);
    const da=xa.getImageData(0,0,width,height).data,db=xb.getImageData(0,0,width,height).data;
    let changed=0,total=width*height;
    for(let i=0;i<da.length;i+=4){
      const delta=Math.abs(da[i]-db[i])+Math.abs(da[i+1]-db[i+1])+Math.abs(da[i+2]-db[i+2]);
      if(delta>48)changed++;
    }
    return total?changed/total*100:0;
  }
  async function runCompare(overlay){
    const fileA=overlay.querySelector('[data-compare-a]').files?.[0];
    const fileB=overlay.querySelector('[data-compare-b]').files?.[0];
    const run=overlay.querySelector('[data-compare-run]');
    const download=overlay.querySelector('[data-compare-download]');
    try{
      validatePdf(fileA);validatePdf(fileB);run.disabled=true;download.disabled=true;
      setOverlayStatus(overlay,'두 PDF를 비교하는 중입니다...');
      const [pdfA,pdfB]=await Promise.all([openPdf(fileA),openPdf(fileB)]);
      const total=Math.max(pdfA.numPages,pdfB.numPages);
      const pages=Math.min(total,MAX_COMPARE_PAGES);
      const rows=[];
      for(let i=1;i<=pages;i++){
        const existsA=i<=pdfA.numPages,existsB=i<=pdfB.numPages;
        if(!existsA||!existsB){rows.push({page:i,size:'페이지 누락',textDiff:100,visualDiff:100,state:'diff'});continue;}
        setOverlayStatus(overlay,`비교 중 · ${i}/${pages}페이지`);
        const [pageA,pageB]=await Promise.all([pdfA.getPage(i),pdfB.getPage(i)]);
        const [contentA,contentB,renderA,renderB]=await Promise.all([pageA.getTextContent(),pageB.getTextContent(),renderComparePage(pageA),renderComparePage(pageB)]);
        const sizeDiff=Math.abs(renderA.base.width-renderB.base.width)>.8||Math.abs(renderA.base.height-renderB.base.height)>.8;
        const textA=normalizedText(contentA),textB=normalizedText(contentB);
        const textDiff=stringDifference(textA,textB);
        const visualDiff=visualDifference(renderA,renderB);
        const changed=sizeDiff||textDiff>.5||visualDiff>.25;
        rows.push({page:i,size:sizeDiff?'크기 다름':`${renderA.base.width.toFixed(1)}×${renderA.base.height.toFixed(1)}pt`,textDiff,visualDiff,state:changed?'diff':'same'});
      }
      const changed=rows.filter(row=>row.state==='diff').length;
      const truncated=total>MAX_COMPARE_PAGES;
      const summary=overlay.querySelector('[data-compare-summary]');
      summary.innerHTML=`<span>기준 ${pdfA.numPages}p</span><span>비교 ${pdfB.numPages}p</span><span>변경 ${changed}/${rows.length}p</span>${truncated?'<span>80p까지만 비교</span>':''}`;
      const report=overlay.querySelector('[data-compare-report]');
      report.hidden=false;
      report.innerHTML=`<table><thead><tr><th>페이지</th><th>판정</th><th>페이지 크기</th><th>텍스트 차이</th><th>시각 차이</th></tr></thead><tbody>${rows.map(row=>`<tr><td>${row.page}</td><td><span class="pdfadv-chip ${row.state}">${row.state==='same'?'동일':'변경'}</span></td><td>${escapeHtml(row.size)}</td><td>${row.textDiff.toFixed(1)}%</td><td>${row.visualDiff.toFixed(2)}%</td></tr>`).join('')}</tbody></table>`;
      const text=[`PDF 비교 리포트`,`기준: ${fileA.name} (${pdfA.numPages}p)`,`비교: ${fileB.name} (${pdfB.numPages}p)`,`검사 페이지: ${rows.length}${truncated?' (최대 80p 제한)':''}`,`변경 페이지: ${changed}`,``,...rows.map(row=>`${row.page}p | ${row.state==='same'?'동일':'변경'} | ${row.size} | 텍스트 ${row.textDiff.toFixed(1)}% | 시각 ${row.visualDiff.toFixed(2)}%`)].join('\n');
      compareState={text,base:`${safeBase(fileA)}_vs_${safeBase(fileB)}`};download.disabled=false;
      setOverlayStatus(overlay,changed?`${changed}개 페이지에서 차이를 감지했습니다.`:'검사 범위에서 의미 있는 차이를 감지하지 못했습니다.','ok');
      document.documentElement.dataset.pdfSuiteCompare='done';
    }catch(error){setOverlayStatus(overlay,error?.message||'PDF 비교에 실패했습니다.','err');}
    finally{run.disabled=false;}
  }

  function redactModal(){
    const overlay=makeOverlay('pdfAdvancedRedact','영구 마스킹 · Redaction','선택 영역을 검은색으로 굽고 원본 콘텐츠를 버린 래스터 PDF를 새로 만듭니다.',`
      <div class="pdfadv-grid"><label class="pdfadv-file">마스킹할 PDF 선택<input data-redact-file type="file" accept="application/pdf"></label><div><label class="pdfadv-label">처리 방식</label><div class="pdfadv-note" style="margin-top:0">전체 페이지를 이미지로 재구성해 텍스트·벡터·링크·폼·첨부·메타데이터를 제거합니다.</div></div></div>
      <div class="pdfadv-preview-shell" data-redact-shell hidden><div class="pdfadv-preview-toolbar"><button class="pdfadv-mini" type="button" data-redact-prev>← 이전</button><span class="pdfadv-page-label" data-redact-page></span><button class="pdfadv-mini" type="button" data-redact-next>다음 →</button><button class="pdfadv-mini" type="button" data-redact-clear>현재 영역 지우기</button></div><div class="pdfadv-preview-wrap" data-redact-wrap><canvas data-redact-canvas></canvas><div class="pdfadv-redact-overlay" data-redact-overlay></div></div></div>
      <div class="pdfadv-status" data-pdfadv-status></div><div class="pdfadv-actions"><button class="pdfadv-btn pdfadv-danger" type="button" data-redact-export disabled>영구 마스킹 PDF 만들기</button></div>
      <div class="pdfadv-note">주의: 출력 PDF는 의도적으로 래스터화됩니다. 검색, 텍스트 선택, 링크, 폼, 벡터 품질은 사라집니다. 민감정보 삭제에는 유리하지만 보관용 원본은 별도로 유지하세요.</div>`);
    const input=overlay.querySelector('[data-redact-file]');
    input.onchange=()=>loadRedactFile(overlay,input.files?.[0]);
    overlay.querySelector('[data-redact-prev]').onclick=()=>changeRedactPage(overlay,-1);
    overlay.querySelector('[data-redact-next]').onclick=()=>changeRedactPage(overlay,1);
    overlay.querySelector('[data-redact-clear]').onclick=()=>clearRedactPage(overlay);
    overlay.querySelector('[data-redact-export]').onclick=()=>exportRedacted(overlay);
    return overlay;
  }
  async function loadRedactFile(overlay,file){
    try{
      validatePdf(file);setOverlayStatus(overlay,'PDF 미리보기를 준비하는 중입니다...');
      const pdf=await openPdf(file);
      if(pdf.numPages>MAX_REDACT_PAGES)throw new Error(`영구 마스킹은 최대 ${MAX_REDACT_PAGES}페이지까지 지원합니다.`);
      redactState={file,pdf,page:1,rects:new Map(),renderSerial:0};
      overlay.querySelector('[data-redact-shell]').hidden=false;
      overlay.querySelector('[data-redact-export]').disabled=false;
      bindRedactPointer(overlay);
      await renderRedactPage(overlay);
      setOverlayStatus(overlay,'마우스나 손가락으로 가릴 영역을 드래그하세요.','ok');
    }catch(error){redactState=null;overlay.querySelector('[data-redact-shell]').hidden=true;overlay.querySelector('[data-redact-export]').disabled=true;setOverlayStatus(overlay,error?.message||'PDF를 열지 못했습니다.','err');}
  }
  async function renderRedactPage(overlay){
    if(!redactState)return;
    const serial=++redactState.renderSerial;
    const page=await redactState.pdf.getPage(redactState.page);
    const base=page.getViewport({scale:1});
    const scale=Math.min(1.3,720/Math.max(base.width,1));
    const viewport=page.getViewport({scale});
    const canvas=overlay.querySelector('[data-redact-canvas]');
    canvas.width=Math.round(viewport.width);canvas.height=Math.round(viewport.height);
    await page.render({canvasContext:canvas.getContext('2d'),viewport,background:'#FFFFFF'}).promise;
    if(serial!==redactState.renderSerial)return;
    overlay.querySelector('[data-redact-page]').textContent=`${redactState.page} / ${redactState.pdf.numPages} 페이지`;
    renderRedactBoxes(overlay);
  }
  function renderRedactBoxes(overlay,temp=null){
    const layer=overlay.querySelector('[data-redact-overlay]');
    layer.querySelectorAll('.pdfadv-redact-box').forEach(node=>node.remove());
    const rects=(redactState?.rects.get(redactState.page)||[]).concat(temp?[temp]:[]);
    rects.forEach(rect=>{
      const box=document.createElement('div');box.className='pdfadv-redact-box';
      box.style.left=`${rect.x*100}%`;box.style.top=`${rect.y*100}%`;box.style.width=`${rect.w*100}%`;box.style.height=`${rect.h*100}%`;
      layer.appendChild(box);
    });
  }
  function bindRedactPointer(overlay){
    const layer=overlay.querySelector('[data-redact-overlay]');
    if(layer.dataset.bound)return;layer.dataset.bound='1';
    let start=null,current=null;
    const point=event=>{const r=layer.getBoundingClientRect();return{x:Math.min(1,Math.max(0,(event.clientX-r.left)/r.width)),y:Math.min(1,Math.max(0,(event.clientY-r.top)/r.height))};};
    layer.addEventListener('pointerdown',event=>{if(!redactState)return;layer.setPointerCapture?.(event.pointerId);start=point(event);current=null;});
    layer.addEventListener('pointermove',event=>{if(!start)return;const p=point(event);current={x:Math.min(start.x,p.x),y:Math.min(start.y,p.y),w:Math.abs(p.x-start.x),h:Math.abs(p.y-start.y)};renderRedactBoxes(overlay,current);});
    const finish=()=>{
      if(start&&current&&current.w>.005&&current.h>.005){const rects=redactState.rects.get(redactState.page)||[];rects.push(current);redactState.rects.set(redactState.page,rects);}
      start=null;current=null;renderRedactBoxes(overlay);
    };
    layer.addEventListener('pointerup',finish);layer.addEventListener('pointercancel',finish);
  }
  async function changeRedactPage(overlay,delta){
    if(!redactState)return;const next=Math.min(redactState.pdf.numPages,Math.max(1,redactState.page+delta));if(next===redactState.page)return;redactState.page=next;await renderRedactPage(overlay);
  }
  function clearRedactPage(overlay){if(!redactState)return;redactState.rects.delete(redactState.page);renderRedactBoxes(overlay);setOverlayStatus(overlay,'현재 페이지의 마스킹 영역을 지웠습니다.');}
  function canvasToBlob(canvas,type='image/jpeg',quality=.92){return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('페이지 이미지를 만들지 못했습니다.')),type,quality));}
  async function exportRedacted(overlay){
    const button=overlay.querySelector('[data-redact-export]');
    try{
      if(!redactState)throw new Error('PDF를 먼저 선택하세요.');
      const count=[...redactState.rects.values()].reduce((sum,list)=>sum+list.length,0);
      if(!count)throw new Error('마스킹 영역을 한 곳 이상 지정하세요.');
      button.disabled=true;const {PDFDocument}=await ensurePdfLib();const output=await PDFDocument.create();
      for(let pageNo=1;pageNo<=redactState.pdf.numPages;pageNo++){
        setOverlayStatus(overlay,`영구 마스킹 처리 중 · ${pageNo}/${redactState.pdf.numPages}페이지`);
        const page=await redactState.pdf.getPage(pageNo);const base=page.getViewport({scale:1});const viewport=page.getViewport({scale:REDACTION_SCALE});
        const canvas=makeCanvas(viewport.width,viewport.height);const ctx=canvas.getContext('2d');
        await page.render({canvasContext:ctx,viewport,background:'#FFFFFF'}).promise;
        const rects=redactState.rects.get(pageNo)||[];ctx.fillStyle='#000';rects.forEach(rect=>ctx.fillRect(rect.x*canvas.width,rect.y*canvas.height,rect.w*canvas.width,rect.h*canvas.height));
        const blob=await canvasToBlob(canvas);const jpg=await output.embedJpg(new Uint8Array(await blob.arrayBuffer()));const out=output.addPage([base.width,base.height]);out.drawImage(jpg,{x:0,y:0,width:base.width,height:base.height});
        canvas.width=1;canvas.height=1;
      }
      output.setTitle('');output.setAuthor('');output.setSubject('');output.setKeywords([]);output.setCreator('');output.setProducer('Program Studio permanent raster redaction');
      const bytes=await output.save({useObjectStreams:true,addDefaultPage:false,updateFieldAppearances:false});downloadBlob(new Blob([bytes],{type:'application/pdf'}),`${safeBase(redactState.file)}_영구마스킹.pdf`);
      setOverlayStatus(overlay,`${count}개 영역을 영구 마스킹하고 전체 문서를 래스터 PDF로 재구성했습니다.`,'ok');document.documentElement.dataset.pdfSuiteRedaction='done';
    }catch(error){setOverlayStatus(overlay,error?.message||'영구 마스킹에 실패했습니다.','err');}
    finally{button.disabled=!redactState;}
  }

  function attachmentModal(){
    const overlay=makeOverlay('pdfAdvancedAttachments','PDF 첨부파일 추출','PDF 내부에 포함된 파일 첨부(EmbeddedFiles)를 찾아 브라우저에서 개별 저장합니다.',`<div class="pdfadv-status" data-pdfadv-status></div><div class="pdfadv-list" data-attach-list></div><div class="pdfadv-actions"><button class="pdfadv-btn pdfadv-primary" type="button" data-attach-open>선택 PDF 검사</button></div>`);
    const run=overlay.querySelector('[data-attach-open]');
    run.onclick=async()=>{
      try{
        const file=selectedSuiteFile();if(!file)throw new Error('먼저 아래 로컬 처리 영역에서 PDF를 선택하세요.');
        run.disabled=true;setOverlayStatus(overlay,'첨부파일을 확인하는 중입니다...');const pdf=await openPdf(file);const attachments=await pdf.getAttachments();const entries=attachments?Object.entries(attachments):[];
        if(!entries.length)throw new Error('이 PDF에는 추출 가능한 첨부파일이 없습니다.');
        const list=overlay.querySelector('[data-attach-list]');list.replaceChildren();entries.forEach(([name,item],index)=>{
          const row=document.createElement('div');row.className='pdfadv-list-row';const grow=document.createElement('div');grow.className='grow';const strong=document.createElement('strong');strong.textContent=item?.filename||name||`attachment-${index+1}`;const small=document.createElement('small');small.textContent=`${humanBytes(item?.content?.byteLength||0)} · PDF 내부 첨부`;grow.append(strong,small);const save=document.createElement('button');save.type='button';save.className='pdfadv-mini';save.textContent='저장';save.onclick=()=>downloadBlob(new Blob([item.content],{type:'application/octet-stream'}),item?.filename||name||`attachment-${index+1}`);row.append(grow,save);list.appendChild(row);
        });
        setOverlayStatus(overlay,`첨부파일 ${entries.length}개를 찾았습니다.`,'ok');
      }catch(error){overlay.querySelector('[data-attach-list]').replaceChildren();setOverlayStatus(overlay,error?.message||'첨부파일을 확인하지 못했습니다.','err');}
      finally{run.disabled=false;}
    };
    return overlay;
  }

  function accessibilityModal(){
    const overlay=makeOverlay('pdfAdvancedAccessibility','접근성·태그 기본 검사','Tagged PDF 여부, 문서 언어, 페이지 구조 트리 존재 여부를 빠르게 검사합니다.',`<div class="pdfadv-status" data-pdfadv-status></div><div class="pdfadv-report" data-access-report hidden></div><div class="pdfadv-actions"><button class="pdfadv-btn pdfadv-primary" type="button" data-access-run>선택 PDF 검사</button></div><div class="pdfadv-note">이 검사는 기본 구조 신호만 확인합니다. PDF/UA 적합성, 읽기 순서, 모든 이미지 대체텍스트 품질을 완전 검증하는 인증 도구는 아닙니다.</div>`);
    const run=overlay.querySelector('[data-access-run]');run.onclick=async()=>{
      try{
        const file=selectedSuiteFile();if(!file)throw new Error('먼저 아래 로컬 처리 영역에서 PDF를 선택하세요.');run.disabled=true;setOverlayStatus(overlay,'접근성 구조를 검사하는 중입니다...');const pdf=await openPdf(file);const markPromise=typeof pdf.getMarkInfo==='function'?pdf.getMarkInfo().catch(()=>null):Promise.resolve(null);const [metadata,markInfo]=await Promise.all([pdf.getMetadata().catch(()=>null),markPromise]);
        let structured=0;const checked=Math.min(pdf.numPages,30);for(let pageNo=1;pageNo<=checked;pageNo++){const page=await pdf.getPage(pageNo);const tree=typeof page.getStructTree==='function'?await page.getStructTree().catch(()=>null):null;if(tree)structured++;}
        const language=String(metadata?.info?.Language||metadata?.metadata?.get?.('dc:language')||'').trim();const marked=Boolean(markInfo?.Marked);const issues=[];if(!marked)issues.push('문서가 Tagged PDF로 표시되지 않음');if(!language)issues.push('문서 언어 정보 없음');if(structured<checked)issues.push(`구조 트리 없는 페이지 감지 (${checked-structured}/${checked})`);
        const report=overlay.querySelector('[data-access-report]');report.hidden=false;report.innerHTML=`<table><tbody><tr><th>Tagged 표시</th><td><span class="pdfadv-chip ${marked?'same':'warn'}">${marked?'있음':'없음'}</span></td></tr><tr><th>문서 언어</th><td>${escapeHtml(language||'없음')}</td></tr><tr><th>구조 트리</th><td>${structured}/${checked}페이지${pdf.numPages>checked?' (앞 30p 검사)':''}</td></tr><tr><th>기본 경고</th><td>${issues.length?issues.map(escapeHtml).join('<br>'):'기본 구조 신호 이상 없음'}</td></tr></tbody></table>`;
        setOverlayStatus(overlay,issues.length?`기본 접근성 경고 ${issues.length}건을 찾았습니다.`:'기본 접근성 구조 신호에서 큰 문제를 찾지 못했습니다.','ok');document.documentElement.dataset.pdfSuiteAccessibility='done';
      }catch(error){setOverlayStatus(overlay,error?.message||'접근성 검사에 실패했습니다.','err');}
      finally{run.disabled=false;}
    };return overlay;
  }

  function outlineModal(){
    const overlay=makeOverlay('pdfAdvancedOutline','책갈피·페이지 라벨 분석','PDF의 북마크(Outline)와 페이지 라벨 정보를 읽어 TXT 리포트로 내보냅니다.',`<div class="pdfadv-status" data-pdfadv-status></div><div class="pdfadv-list" data-outline-list></div><div class="pdfadv-actions"><button class="pdfadv-btn pdfadv-secondary" type="button" data-outline-download disabled>TXT 저장</button><button class="pdfadv-btn pdfadv-primary" type="button" data-outline-run>선택 PDF 분석</button></div>`);
    let reportText='';const run=overlay.querySelector('[data-outline-run]'),download=overlay.querySelector('[data-outline-download]');run.onclick=async()=>{
      try{
        const file=selectedSuiteFile();if(!file)throw new Error('먼저 아래 로컬 처리 영역에서 PDF를 선택하세요.');run.disabled=true;download.disabled=true;setOverlayStatus(overlay,'책갈피와 페이지 라벨을 읽는 중입니다...');const pdf=await openPdf(file);const [outline,labels]=await Promise.all([pdf.getOutline().catch(()=>null),pdf.getPageLabels().catch(()=>null)]);
        const flat=[];const walk=(items,depth=0)=>{(items||[]).forEach(item=>{flat.push({depth,title:String(item?.title||'제목 없음')});walk(item?.items,depth+1);});};walk(outline||[]);
        const list=overlay.querySelector('[data-outline-list]');list.replaceChildren();const summary=document.createElement('div');summary.className='pdfadv-list-row';summary.innerHTML=`<div class="grow"><strong>책갈피 ${flat.length}개 · 페이지 라벨 ${labels?labels.length:0}개</strong><small>${labels?'페이지 라벨 예: '+escapeHtml(labels.slice(0,10).join(', ')):'사용자 지정 페이지 라벨 없음'}</small></div>`;list.appendChild(summary);
        flat.slice(0,120).forEach(item=>{const row=document.createElement('div');row.className='pdfadv-list-row';row.innerHTML=`<div class="grow"><strong>${'↳ '.repeat(Math.min(item.depth,5))}${escapeHtml(item.title)}</strong></div>`;list.appendChild(row);});
        reportText=[`책갈피·페이지 라벨 리포트`,`파일: ${file.name}`,`페이지: ${pdf.numPages}`,`책갈피: ${flat.length}`,`페이지 라벨: ${labels?labels.length:0}`,``,...(labels?[`[페이지 라벨]`,...labels.map((label,index)=>`${index+1}p = ${label}`),``]:[]),`[책갈피]`,...flat.map(item=>`${'  '.repeat(item.depth)}- ${item.title}`)].join('\n');download.disabled=false;setOverlayStatus(overlay,'문서 탐색 구조를 분석했습니다.','ok');
      }catch(error){reportText='';download.disabled=true;setOverlayStatus(overlay,error?.message||'구조 분석에 실패했습니다.','err');}
      finally{run.disabled=false;}
    };download.onclick=()=>{const file=selectedSuiteFile();if(reportText&&file)downloadText(reportText,`${safeBase(file)}_책갈피페이지라벨.txt`);};return overlay;
  }

  function promoteTool(name,action,label='로컬',copy=null){
    const card=[...document.querySelectorAll('.tool')].find(node=>node.querySelector('.tool-name')?.textContent?.trim()===name);
    if(!card)return null;
    card.classList.remove('planned');card.classList.add('available','pdfadv-tool-ready');card.dataset.status='local';card.dataset.advancedAction=action;card.setAttribute('role','button');card.setAttribute('tabindex','0');
    const status=card.querySelector('.status');if(status){status.className='status local';status.textContent=label;}
    if(copy?.name&&card.querySelector('.tool-name'))card.querySelector('.tool-name').textContent=copy.name;
    if(copy?.desc&&card.querySelector('.tool-desc'))card.querySelector('.tool-desc').textContent=copy.desc;
    card.addEventListener('click',()=>launch(action));card.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();launch(action);}});
    return card;
  }
  function removeRoadmapTag(text){[...document.querySelectorAll('.roadmap-tag')].filter(node=>node.textContent.trim()===text).forEach(node=>node.remove());}
  function launch(action){
    installStyles();
    if(action==='text'){
      const file=selectedSuiteFile();if(!file){setGlobalStatus('아래 로컬 처리 영역에서 PDF를 먼저 선택하세요.','err');$('local-tools')?.scrollIntoView({behavior:'smooth'});return;}
      setGlobalStatus('본문 텍스트를 추출하는 중입니다...');extractText(file).then(message=>setGlobalStatus(message,'ok')).catch(error=>setGlobalStatus(error?.message||'텍스트 추출에 실패했습니다.','err'));return;
    }
    let overlay=null;
    if(action==='compare')overlay=compareModal();
    else if(action==='redact')overlay=redactModal();
    else if(action==='attachments')overlay=attachmentModal();
    else if(action==='accessibility')overlay=accessibilityModal();
    else if(action==='outline')overlay=outlineModal();
    if(overlay)openOverlay(overlay);
  }

  function installCatalogPromotions(){
    promoteTool('텍스트·문서 추출','text','로컬',{name:'본문 텍스트 추출 · TXT',desc:'PDF의 실제 텍스트 레이어를 읽어 페이지 구분이 포함된 UTF-8 TXT로 저장합니다.'});
    promoteTool('PDF 버전 비교','compare');
    promoteTool('영구 마스킹·Redaction','redact');
    promoteTool('첨부파일 추출','attachments');
    promoteTool('접근성·태그 검사','accessibility','로컬',{name:'접근성·태그 기본 검사',desc:'Tagged 표시, 문서 언어, 페이지 구조 트리 등 기본 접근성 신호를 빠르게 확인합니다.'});
    removeRoadmapTag('영구 Redaction');removeRoadmapTag('PDF 버전 비교');removeRoadmapTag('접근성·Tagged PDF');removeRoadmapTag('첨부파일 추출');
    const roadmap=document.querySelector('.roadmap-tags');
    if(roadmap&&!roadmap.querySelector('[data-advanced-roadmap]')){
      const tag=document.createElement('span');tag.className='roadmap-tag';tag.dataset.advancedRoadmap='1';tag.textContent='완전한 PDF/UA 인증';roadmap.appendChild(tag);
    }
    const inspectSection=document.querySelector('.section[data-category="pages"]')||document.querySelector('.section[data-category]');
    if(inspectSection&&!document.querySelector('[data-advanced-action="outline"]')){
      const grid=inspectSection.querySelector('.tool-grid');if(grid){const card=document.createElement('div');card.className='tool available pdfadv-tool-ready';card.dataset.status='local';card.dataset.advancedAction='outline';card.dataset.keywords='책갈피 outline bookmark 페이지 라벨 page labels 분석';card.setAttribute('role','button');card.setAttribute('tabindex','0');card.innerHTML='<span class="status local">로컬</span><span class="tool-icon">🔖</span><span class="tool-name">책갈피·페이지 라벨 분석</span><span class="tool-desc">북마크 계층과 사용자 지정 페이지 라벨을 읽고 TXT 리포트로 저장합니다.</span>';card.onclick=()=>launch('outline');card.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();launch('outline');}};grid.appendChild(card);}
    }
  }

  function boot(){
    installStyles();installCatalogPromotions();
    window.ProgramStudioPdfSuiteAdvanced=Object.freeze({version:'2026.09.05.001',pdfJsVersion:PDFJS_VERSION,maxFileBytes:MAX_FILE_BYTES,launch,extractText});
    document.documentElement.dataset.pdfSuiteAdvanced='ready';
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
