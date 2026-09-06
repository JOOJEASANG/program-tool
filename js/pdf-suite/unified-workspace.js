// Program Studio PDF Suite: make the all-in-one page the primary workspace for common PDF jobs.
(function(){
  'use strict';
  if(window.__programStudioPdfUnifiedWorkspaceV1)return;
  window.__programStudioPdfUnifiedWorkspaceV1=true;

  const PDF_LIB_SRC='https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js';
  const MAX_TOTAL_BYTES=120*1024*1024;
  const MAX_MERGE_FILES=20;
  let pdfLibPromise=null;
  let mergeFiles=[];
  let extractFile=null;
  let extractPageCount=0;
  let mode='merge';
  let busy=false;

  const $=id=>document.getElementById(id);
  const isPdf=file=>Boolean(file)&&(/\.pdf$/i.test(file.name||'')||file.type==='application/pdf');
  const humanBytes=bytes=>{
    const value=Number(bytes||0);
    if(value<1024*1024)return `${Math.max(1,Math.round(value/1024))}KB`;
    return `${(value/1024/1024).toFixed(1)}MB`;
  };
  const safeName=file=>String(file?.name||'document.pdf').replace(/\.pdf$/i,'').replace(/[\\/:*?"<>|]+/g,'_').slice(0,90)||'document';

  function ensurePdfLib(){
    if(window.PDFLib?.PDFDocument)return Promise.resolve(window.PDFLib);
    if(pdfLibPromise)return pdfLibPromise;
    pdfLibPromise=new Promise((resolve,reject)=>{
      let script=document.querySelector('script[data-pdf-unified-lib="pdf-lib"]');
      if(script?.dataset.failed==='1'){script.remove();script=null;}
      if(script){
        const started=Date.now();
        const poll=()=>{
          if(window.PDFLib?.PDFDocument)return resolve(window.PDFLib);
          if(Date.now()-started>15000){script.dataset.failed='1';script.remove();return reject(new Error('PDF 로컬 엔진 로딩 시간이 초과되었습니다. 다시 시도하세요.'));}
          setTimeout(poll,60);
        };
        poll();
        return;
      }
      script=document.createElement('script');
      script.src=PDF_LIB_SRC;
      script.async=true;
      script.crossOrigin='anonymous';
      script.referrerPolicy='no-referrer';
      script.dataset.pdfUnifiedLib='pdf-lib';
      const timer=setTimeout(()=>{
        script.dataset.failed='1';
        script.remove();
        reject(new Error('PDF 로컬 엔진 로딩 시간이 초과되었습니다. 다시 시도하세요.'));
      },15000);
      script.onload=()=>{
        clearTimeout(timer);
        if(window.PDFLib?.PDFDocument)resolve(window.PDFLib);
        else reject(new Error('PDF 로컬 엔진 초기화에 실패했습니다.'));
      };
      script.onerror=()=>{
        clearTimeout(timer);
        script.dataset.failed='1';
        script.remove();
        reject(new Error('PDF 로컬 엔진을 불러오지 못했습니다. 네트워크 연결 후 다시 시도하세요.'));
      };
      document.head.appendChild(script);
    }).catch(error=>{pdfLibPromise=null;throw error;});
    return pdfLibPromise;
  }

  function validatePdf(file){
    if(!isPdf(file))throw new Error('PDF 파일만 선택할 수 있습니다.');
  }

  function totalBytes(files){return files.reduce((sum,file)=>sum+Number(file?.size||0),0);}

  async function loadPdf(file){
    validatePdf(file);
    const {PDFDocument}=await ensurePdfLib();
    try{
      return await PDFDocument.load(await file.arrayBuffer(),{ignoreEncryption:false,updateMetadata:false});
    }catch(error){
      if(/encrypt|password/i.test(String(error?.message||'')))throw new Error(`${file.name}은(는) 암호화된 PDF입니다. 전문 검사·변환에서 먼저 암호를 해제하세요.`);
      throw new Error(`${file.name}을(를) 열 수 없습니다. 손상되었거나 지원되지 않는 PDF일 수 있습니다.`);
    }
  }

  function downloadPdf(bytes,name){
    const blob=new Blob([bytes],{type:'application/pdf'});
    const url=URL.createObjectURL(blob);
    const link=document.createElement('a');
    link.href=url;
    link.download=name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1800);
  }

  function parsePageSelection(value,pageCount){
    const text=String(value||'').replace(/\s+/g,'');
    if(!text)throw new Error('추출할 페이지를 입력하세요. 예: 1-3,5');
    const result=[];
    const seen=new Set();
    for(const token of text.split(',').filter(Boolean)){
      const match=token.match(/^(\d+)(?:-(\d+))?$/);
      if(!match)throw new Error(`페이지 범위를 확인하세요: ${token}`);
      const start=Number(match[1]);
      const end=Number(match[2]||match[1]);
      if(start<1||end<1||start>pageCount||end>pageCount)throw new Error(`페이지는 1~${pageCount} 범위로 입력하세요.`);
      const step=start<=end?1:-1;
      for(let page=start;;page+=step){
        if(!seen.has(page)){seen.add(page);result.push(page);}
        if(page===end)break;
      }
    }
    if(!result.length)throw new Error('추출할 페이지가 없습니다.');
    return result;
  }

  function setStatus(message,type='info'){
    const node=$('pdfUnifiedStatus');
    if(!node)return;
    node.textContent=message||'';
    node.dataset.type=type;
  }

  function setBusy(value){
    busy=Boolean(value);
    const run=$('pdfUnifiedRun');
    if(run)run.disabled=busy||(mode==='merge'?mergeFiles.length<2:!extractFile);
    const inputs=[$('pdfUnifiedMergeInput'),$('pdfUnifiedExtractInput'),$('pdfUnifiedRange')];
    inputs.forEach(input=>{if(input)input.disabled=busy;});
    document.querySelectorAll('[data-pdf-unified-move],[data-pdf-unified-remove],[data-pdf-unified-mode]').forEach(node=>node.disabled=busy);
  }

  function installStyle(){
    if($('pdfUnifiedStyle'))return;
    const style=document.createElement('style');
    style.id='pdfUnifiedStyle';
    style.textContent=`
      .pdfu-primary{margin:0 0 28px;background:#fff;border:1.5px solid #bfdbfe;border-radius:22px;padding:22px;box-shadow:0 12px 32px rgba(37,99,235,.08)}
      .pdfu-primary-head{display:flex;align-items:flex-start;gap:14px}.pdfu-primary-icon{width:50px;height:50px;border-radius:14px;display:grid;place-items:center;background:linear-gradient(135deg,#1d4ed8,#0891b2);color:#fff;font-size:23px;flex:0 0 50px}.pdfu-primary-copy{flex:1}.pdfu-primary-copy h2{font-size:20px;font-weight:950;color:#0f2f59}.pdfu-primary-copy p{font-size:11px;color:#64748b;margin-top:5px;line-height:1.6}.pdfu-local-pill{font-size:9px;font-weight:950;color:#047857;background:#ecfdf5;border:1px solid #bbf7d0;border-radius:999px;padding:6px 9px;white-space:nowrap}
      .pdfu-tabs{display:flex;gap:7px;flex-wrap:wrap;margin-top:18px}.pdfu-tab{border:1px solid #dbe4ee;background:#f8fafc;color:#475569;border-radius:10px;padding:9px 13px;font-size:11px;font-weight:900;cursor:pointer}.pdfu-tab.active{border-color:#2563eb;background:#eff6ff;color:#1d4ed8}.pdfu-tab-link{text-decoration:none}
      .pdfu-panel{display:none;margin-top:14px}.pdfu-panel.active{display:block}.pdfu-drop{display:block;border:2px dashed #bfd2e5;background:#f8fbff;border-radius:15px;padding:20px;text-align:center;cursor:pointer}.pdfu-drop.drag{border-color:#2563eb;background:#eff6ff}.pdfu-drop strong{display:block;font-size:13px}.pdfu-drop span{display:block;font-size:10px;color:#64748b;margin-top:4px}.pdfu-hidden-input{display:none!important}
      .pdfu-files{display:grid;gap:7px;margin-top:10px}.pdfu-file{display:flex;align-items:center;gap:8px;border:1px solid #e2e8f0;background:#fff;border-radius:10px;padding:9px 10px}.pdfu-file-index{width:22px;height:22px;border-radius:7px;background:#eff6ff;color:#1d4ed8;display:grid;place-items:center;font-size:9px;font-weight:950;flex:0 0 22px}.pdfu-file-main{flex:1;min-width:0}.pdfu-file-name{font-size:11px;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.pdfu-file-meta{font-size:9px;color:#94a3b8;margin-top:2px}.pdfu-file-btn{border:1px solid #e2e8f0;background:#f8fafc;border-radius:7px;width:28px;height:28px;cursor:pointer;font-size:11px}.pdfu-file-btn:disabled{opacity:.35;cursor:not-allowed}
      .pdfu-extract-meta{display:none;margin-top:10px;border:1px solid #bae6fd;background:#f0fdff;color:#0e7490;border-radius:10px;padding:9px 11px;font-size:10px;font-weight:850}.pdfu-extract-meta.show{display:block}.pdfu-field{margin-top:11px}.pdfu-field label{display:block;font-size:10px;font-weight:900;color:#334155;margin-bottom:5px}.pdfu-field input{width:100%;border:1.5px solid #dbe4ee;border-radius:10px;padding:10px 12px;outline:none}.pdfu-field input:focus{border-color:#60a5fa;box-shadow:0 0 0 3px rgba(37,99,235,.08)}
      .pdfu-actions{display:flex;align-items:center;gap:9px;margin-top:13px;flex-wrap:wrap}.pdfu-run{border:0;border-radius:11px;background:#1d4ed8;color:#fff;padding:11px 16px;font-size:11px;font-weight:950;cursor:pointer}.pdfu-run:disabled{opacity:.4;cursor:not-allowed}.pdfu-status{font-size:10px;font-weight:850;color:#2563eb;min-height:18px}.pdfu-status[data-type="ok"]{color:#15803d}.pdfu-status[data-type="err"]{color:#dc2626}.pdfu-note{margin-left:auto;font-size:9px;color:#94a3b8}
      .pdfu-expert{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px;padding-top:13px;border-top:1px solid #eef2f7}.pdfu-expert a{font-size:10px;font-weight:850;color:#475569;text-decoration:none;border:1px solid #e2e8f0;border-radius:9px;padding:7px 9px;background:#f8fafc}
      @media(max-width:640px){.pdfu-primary-head{flex-wrap:wrap}.pdfu-local-pill{margin-left:64px}.pdfu-note{width:100%;margin-left:0}.pdfu-file-btn{width:32px;height:32px}}
    `;
    document.head.appendChild(style);
  }

  function workspaceMarkup(){
    return `
      <div class="pdfu-primary-head">
        <div class="pdfu-primary-icon">⚡</div>
        <div class="pdfu-primary-copy"><h2>기본 PDF 작업 · 여기서 바로 처리</h2><p>합치기와 페이지 추출은 다른 페이지로 이동하지 않고 브라우저 안에서 바로 처리합니다. 파일은 이 기본 작업에서 서버로 업로드되지 않습니다.</p></div>
        <span class="pdfu-local-pill">로컬 처리</span>
      </div>
      <div class="pdfu-tabs" role="tablist" aria-label="기본 PDF 작업">
        <button class="pdfu-tab active" type="button" data-pdf-unified-mode="merge">PDF 합치기</button>
        <button class="pdfu-tab" type="button" data-pdf-unified-mode="extract">페이지 추출</button>
        <a class="pdfu-tab pdfu-tab-link" href="#local-tools">회전·기타 로컬 작업</a>
      </div>
      <div class="pdfu-panel active" data-pdf-unified-panel="merge">
        <label class="pdfu-drop" id="pdfUnifiedMergeDrop" for="pdfUnifiedMergeInput"><strong>합칠 PDF를 2개 이상 선택하거나 여기에 놓으세요</strong><span>최대 ${MAX_MERGE_FILES}개 · 표시된 순서대로 합치기 · 전체 ${humanBytes(MAX_TOTAL_BYTES)} 이하 권장/지원</span></label>
        <input class="pdfu-hidden-input" id="pdfUnifiedMergeInput" type="file" accept="application/pdf,.pdf" multiple>
        <div class="pdfu-files" id="pdfUnifiedMergeFiles"></div>
      </div>
      <div class="pdfu-panel" data-pdf-unified-panel="extract">
        <label class="pdfu-drop" id="pdfUnifiedExtractDrop" for="pdfUnifiedExtractInput"><strong>페이지를 추출할 PDF 한 개를 선택하세요</strong><span>예: 1-3,5처럼 원하는 페이지만 새 PDF로 저장</span></label>
        <input class="pdfu-hidden-input" id="pdfUnifiedExtractInput" type="file" accept="application/pdf,.pdf">
        <div class="pdfu-extract-meta" id="pdfUnifiedExtractMeta"></div>
        <div class="pdfu-field"><label for="pdfUnifiedRange">추출 페이지</label><input id="pdfUnifiedRange" type="text" inputmode="text" placeholder="예: 1-3,5" autocomplete="off"></div>
      </div>
      <div class="pdfu-actions"><button class="pdfu-run" id="pdfUnifiedRun" type="button" data-pdf-unified-run="merge" disabled>PDF 합치기 실행</button><div class="pdfu-status" id="pdfUnifiedStatus" role="status" aria-live="polite"></div><span class="pdfu-note">성공한 작업만 일일 무료 사용량에 반영</span></div>
      <div class="pdfu-expert"><a href="../pdf-preflight/">전문 검사·암호·압축·변환 →</a><a href="../pdf-editor/">전문 편집·인쇄배치 →</a><a href="../print-checker/">인쇄물 사전 검토 →</a></div>
    `;
  }

  function installWorkspace(){
    if($('pdf-primary-workspace'))return;
    const quick=document.querySelector('.quick');
    if(!quick)return;
    installStyle();
    const section=document.createElement('section');
    section.className='pdfu-primary';
    section.id='pdf-primary-workspace';
    section.setAttribute('aria-label','기본 PDF 로컬 작업');
    section.innerHTML=workspaceMarkup();
    quick.insertAdjacentElement('afterend',section);
    bindWorkspace();
  }

  function renderMergeFiles(){
    const root=$('pdfUnifiedMergeFiles');
    if(!root)return;
    root.replaceChildren();
    mergeFiles.forEach((file,index)=>{
      const row=document.createElement('div');
      row.className='pdfu-file';
      row.innerHTML=`<span class="pdfu-file-index">${index+1}</span><div class="pdfu-file-main"><div class="pdfu-file-name"></div><div class="pdfu-file-meta">${humanBytes(file.size)}</div></div><button class="pdfu-file-btn" type="button" data-pdf-unified-move="up" aria-label="위로">↑</button><button class="pdfu-file-btn" type="button" data-pdf-unified-move="down" aria-label="아래로">↓</button><button class="pdfu-file-btn" type="button" data-pdf-unified-remove="1" aria-label="제거">×</button>`;
      row.querySelector('.pdfu-file-name').textContent=file.name;
      row.querySelector('[data-pdf-unified-move="up"]').disabled=index===0||busy;
      row.querySelector('[data-pdf-unified-move="down"]').disabled=index===mergeFiles.length-1||busy;
      row.querySelector('[data-pdf-unified-remove]').disabled=busy;
      row.querySelector('[data-pdf-unified-move="up"]').onclick=()=>moveMergeFile(index,-1);
      row.querySelector('[data-pdf-unified-move="down"]').onclick=()=>moveMergeFile(index,1);
      row.querySelector('[data-pdf-unified-remove]').onclick=()=>removeMergeFile(index);
      root.appendChild(row);
    });
    if(mergeFiles.length)setStatus(`${mergeFiles.length}개 파일 · 총 ${humanBytes(totalBytes(mergeFiles))} · 위에서부터 순서대로 합칩니다.`,'ok');
    else setStatus('합칠 PDF를 선택하세요.');
    setBusy(busy);
  }

  function setMergeFiles(files){
    const list=Array.from(files||[]).filter(isPdf).slice(0,MAX_MERGE_FILES);
    mergeFiles=list;
    const input=$('pdfUnifiedMergeInput');
    if(input&&files!==input.files)input.value='';
    if(Array.from(files||[]).some(file=>!isPdf(file)))setStatus('PDF가 아닌 파일은 제외했습니다.','err');
    renderMergeFiles();
  }

  function moveMergeFile(index,delta){
    const next=index+delta;
    if(next<0||next>=mergeFiles.length)return;
    [mergeFiles[index],mergeFiles[next]]=[mergeFiles[next],mergeFiles[index]];
    renderMergeFiles();
  }

  function removeMergeFile(index){
    mergeFiles.splice(index,1);
    renderMergeFiles();
  }

  async function setExtractFile(file){
    extractFile=null;
    extractPageCount=0;
    const meta=$('pdfUnifiedExtractMeta');
    if(meta){meta.textContent='';meta.classList.remove('show');}
    if(!file){setBusy(false);setStatus('페이지를 추출할 PDF를 선택하세요.');return;}
    try{
      validatePdf(file);
      if(Number(file.size||0)>MAX_TOTAL_BYTES)throw new Error(`로컬 페이지 추출은 ${humanBytes(MAX_TOTAL_BYTES)} 이하 PDF를 지원합니다.`);
      setStatus('PDF 페이지 수를 확인하는 중입니다...');
      const doc=await loadPdf(file);
      extractFile=file;
      extractPageCount=doc.getPageCount();
      if(meta){meta.textContent=`${file.name} · ${humanBytes(file.size)} · ${extractPageCount}페이지`;meta.classList.add('show');}
      setStatus('페이지 범위를 입력한 뒤 실행하세요.','ok');
    }catch(error){
      setStatus(error?.message||'PDF를 열 수 없습니다.','err');
    }finally{setBusy(false);}
  }

  function setMode(next){
    mode=next==='extract'?'extract':'merge';
    document.querySelectorAll('[data-pdf-unified-mode]').forEach(button=>button.classList.toggle('active',button.dataset.pdfUnifiedMode===mode));
    document.querySelectorAll('[data-pdf-unified-panel]').forEach(panel=>panel.classList.toggle('active',panel.dataset.pdfUnifiedPanel===mode));
    const run=$('pdfUnifiedRun');
    if(run){run.dataset.pdfUnifiedRun=mode;run.textContent=mode==='merge'?'PDF 합치기 실행':'선택 페이지 추출';}
    if(mode==='merge')renderMergeFiles();else setStatus(extractFile?`선택 파일 · ${extractFile.name} · ${extractPageCount}페이지`:'페이지를 추출할 PDF를 선택하세요.',extractFile?'ok':'info');
    setBusy(false);
  }

  async function runMerge(){
    if(mergeFiles.length<2)throw new Error('PDF를 2개 이상 선택하세요.');
    if(mergeFiles.length>MAX_MERGE_FILES)throw new Error(`한 번에 최대 ${MAX_MERGE_FILES}개까지 합칠 수 있습니다.`);
    const bytes=totalBytes(mergeFiles);
    if(bytes>MAX_TOTAL_BYTES)throw new Error(`로컬 합치기는 전체 ${humanBytes(MAX_TOTAL_BYTES)} 이하를 지원합니다. 큰 파일은 아래 전문 도구를 이용하세요.`);
    const {PDFDocument}=await ensurePdfLib();
    const output=await PDFDocument.create();
    let pageTotal=0;
    for(let i=0;i<mergeFiles.length;i+=1){
      const file=mergeFiles[i];
      setStatus(`${i+1}/${mergeFiles.length} · ${file.name} 읽는 중...`);
      const source=await loadPdf(file);
      const indices=source.getPageIndices();
      const pages=await output.copyPages(source,indices);
      pages.forEach(page=>output.addPage(page));
      pageTotal+=pages.length;
    }
    const saved=await output.save({useObjectStreams:true,addDefaultPage:false,updateFieldAppearances:false});
    downloadPdf(saved,`PDF_합치기_${mergeFiles.length}개_${pageTotal}p.pdf`);
    document.documentElement.dataset.pdfUnifiedLastResult='merge-success';
    return `${mergeFiles.length}개 PDF · 총 ${pageTotal}페이지를 로컬에서 합쳤습니다.`;
  }

  async function runExtract(){
    if(!extractFile)throw new Error('페이지를 추출할 PDF를 선택하세요.');
    if(Number(extractFile.size||0)>MAX_TOTAL_BYTES)throw new Error(`로컬 페이지 추출은 ${humanBytes(MAX_TOTAL_BYTES)} 이하 PDF를 지원합니다.`);
    const source=await loadPdf(extractFile);
    const pageCount=source.getPageCount();
    const selected=parsePageSelection($('pdfUnifiedRange')?.value,pageCount);
    const {PDFDocument}=await ensurePdfLib();
    const output=await PDFDocument.create();
    const pages=await output.copyPages(source,selected.map(page=>page-1));
    pages.forEach(page=>output.addPage(page));
    const saved=await output.save({useObjectStreams:true,addDefaultPage:false,updateFieldAppearances:false});
    downloadPdf(saved,`${safeName(extractFile)}_페이지추출_${pages.length}p.pdf`);
    document.documentElement.dataset.pdfUnifiedLastResult='extract-success';
    return `${pages.length}페이지를 로컬에서 새 PDF로 저장했습니다.`;
  }

  async function run(){
    if(busy)return;
    try{
      setBusy(true);
      setStatus('브라우저에서 PDF를 처리하는 중입니다...');
      const message=mode==='merge'?await runMerge():await runExtract();
      setStatus(message,'ok');
    }catch(error){
      setStatus(error?.message||'PDF 처리에 실패했습니다.','err');
    }finally{setBusy(false);}
  }

  function bindDrop(id,handler){
    const drop=$(id);
    if(!drop)return;
    ['dragenter','dragover'].forEach(type=>drop.addEventListener(type,event=>{event.preventDefault();drop.classList.add('drag');}));
    ['dragleave','drop'].forEach(type=>drop.addEventListener(type,event=>{event.preventDefault();drop.classList.remove('drag');}));
    drop.addEventListener('drop',handler);
  }

  function bindWorkspace(){
    document.querySelectorAll('[data-pdf-unified-mode]').forEach(button=>button.addEventListener('click',()=>setMode(button.dataset.pdfUnifiedMode)));
    const mergeInput=$('pdfUnifiedMergeInput');
    const extractInput=$('pdfUnifiedExtractInput');
    if(mergeInput)mergeInput.addEventListener('change',()=>setMergeFiles(mergeInput.files));
    if(extractInput)extractInput.addEventListener('change',()=>setExtractFile(extractInput.files?.[0]||null));
    bindDrop('pdfUnifiedMergeDrop',event=>setMergeFiles(event.dataTransfer?.files||[]));
    bindDrop('pdfUnifiedExtractDrop',event=>setExtractFile(Array.from(event.dataTransfer?.files||[]).find(isPdf)||null));
    $('pdfUnifiedRun')?.addEventListener('click',run);
    setMode('merge');
  }

  function openWorkspace(next='merge'){
    installWorkspace();
    setMode(next);
    $('pdf-primary-workspace')?.scrollIntoView({behavior:'smooth',block:'start'});
  }

  function routeCommonCards(){
    const routes=new Map([
      ['PDF 합치기','merge'],
      ['페이지 추출·나누기','extract'],
      ['선택 페이지 → PDF','extract']
    ]);
    document.querySelectorAll('.tool').forEach(tool=>{
      const name=tool.querySelector('.tool-name')?.textContent?.trim();
      const next=routes.get(name);
      if(!next||tool.dataset.pdfUnifiedRouted)return;
      tool.dataset.pdfUnifiedRouted='1';
      tool.setAttribute('href',`#pdf-primary-workspace`);
      tool.dataset.status='local';
      const badge=tool.querySelector('.status');
      if(badge){badge.className='status local';badge.textContent='로컬';}
      tool.addEventListener('click',event=>{event.preventDefault();openWorkspace(next);});
    });
  }

  function clarifyNavigation(){
    const quick=document.querySelector('.quick a[href="../pdf-preflight/"]');
    if(quick){
      quick.href='#pdf-primary-workspace';
      const strong=quick.querySelector('strong');
      const small=quick.querySelector('small');
      if(strong)strong.textContent='기본 PDF 작업';
      if(small)small.textContent='합치기 · 페이지 추출 · 로컬 처리';
      if(!quick.dataset.pdfUnifiedBound){quick.dataset.pdfUnifiedBound='1';quick.addEventListener('click',event=>{event.preventDefault();openWorkspace('merge');});}
    }
    document.querySelectorAll('.top-link').forEach(link=>{
      if(link.getAttribute('href')==='../pdf-preflight/')link.textContent='전문 검사·변환';
      if(link.getAttribute('href')==='../pdf-editor/')link.textContent='전문 편집·인쇄';
    });
  }

  function installRoleHint(){
    const hero=document.querySelector('.hero p');
    if(hero&&!hero.dataset.pdfUnifiedCopy){
      hero.dataset.pdfUnifiedCopy='1';
      hero.textContent='일반 PDF 작업은 이 페이지에서 바로 처리하고, 검사·암호·압축·인쇄배치처럼 전문 기능이 필요한 경우에만 전문 화면으로 이동합니다.';
    }
  }

  function install(){
    installWorkspace();
    routeCommonCards();
    clarifyNavigation();
    installRoleHint();
    document.documentElement.dataset.pdfSuiteUnified='ready';
  }

  const observer=new MutationObserver(()=>{routeCommonCards();clarifyNavigation();});
  if(document.documentElement)observer.observe(document.documentElement,{subtree:true,childList:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();

  window.ProgramStudioPdfUnifiedWorkspace=Object.freeze({
    maxTotalBytes:MAX_TOTAL_BYTES,
    maxMergeFiles:MAX_MERGE_FILES,
    parsePageSelection,
    openWorkspace,
    setMode,
    get mergeFiles(){return mergeFiles.slice();},
    get extractFile(){return extractFile;},
    stage:'pdf-suite-unified-workspace-v1'
  });
})();