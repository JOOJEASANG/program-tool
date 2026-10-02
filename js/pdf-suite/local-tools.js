// Program Studio PDF Suite: local-only productivity tools and catalogue filtering.
(function(){
  'use strict';
  if(window.__programStudioPdfSuiteLocalV1)return;
  window.__programStudioPdfSuiteLocalV1=true;

  const PDF_LIB_SRC='https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js';
  const MAX_LOCAL_BYTES=120*1024*1024;
  const $=id=>document.getElementById(id);
  let selectedFile=null;
  let pdfLibPromise=null;
  let busy=false;
  let currentLocalAction='';

  function installWorkspaceStyles(){
    if(document.getElementById('pdfSuiteWorkspaceLayerStyles'))return;
    const style=document.createElement('style');
    style.id='pdfSuiteWorkspaceLayerStyles';
    style.textContent=`
      .quick-grid{grid-template-columns:repeat(4,minmax(0,1fr))!important}
      .local-panel{display:none!important;position:fixed!important;z-index:1200!important;inset:clamp(14px,2.6vw,34px)!important;margin:0!important;max-width:none!important;overflow:auto!important;border:1px solid #d7e1ec!important;border-radius:24px!important;background:#fff!important;padding:28px 30px 30px!important;box-shadow:0 0 0 100vmax rgba(15,23,42,.62),0 34px 100px rgba(15,23,42,.34)!important}
      .local-panel.is-open{display:block!important}
      body.pdf-suite-layer-open{overflow:hidden!important}
      .local-panel .layer-close{position:absolute;right:20px;top:20px;width:40px;height:40px;border:1px solid #dfe6ef;border-radius:12px;background:#fff;color:#536174;font-size:24px;line-height:1;cursor:pointer;display:grid;place-items:center;z-index:3;box-shadow:0 4px 12px rgba(15,23,42,.06)}
      .local-panel .layer-close:hover{background:#f3f6f9;color:#172033}
      .local-panel .local-header{padding:0 56px 20px 0;border-bottom:1px solid #e7edf4;align-items:center}
      .local-panel .local-title{gap:14px;align-items:center}
      .local-panel .local-title-icon{width:48px;height:48px;flex-basis:48px;border-radius:14px;font-size:15px}
      .local-panel .local-title h2{font-size:21px;letter-spacing:-.45px}
      .local-panel .local-title p{margin-top:4px;font-size:11px;line-height:1.6}
      .local-panel .local-badge{padding:7px 10px;font-size:9px}
      .local-panel .local-body{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(360px,.85fr);gap:20px;margin-top:22px;min-height:calc(100% - 92px)}
      .local-panel .local-body>div:first-child{display:flex;flex-direction:column;min-height:0}
      .local-panel .drop{flex:1;min-height:390px;padding:34px;border:2px dashed #a9bfd9;border-radius:18px;background:#f9fbfd}
      .local-panel .drop:hover,.local-panel .drop.drag{border-color:var(--blue);background:#f3f7ff}
      .local-panel .drop-mark{width:62px;height:62px;border-radius:18px;font-size:27px}
      .local-panel .drop strong{margin-top:16px;font-size:15px}
      .local-panel .drop span{margin-top:6px;font-size:11px}
      .local-panel .file-note{margin-top:12px;padding:12px 14px;border-radius:11px;font-size:11px;line-height:1.55}
      .local-panel .action-box{display:flex;flex-direction:column;min-height:100%;padding:22px;border-radius:18px;background:#fbfcfe}
      .local-panel .action-title{font-size:12px;color:#334155}
      .local-panel .local-actions{grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin-top:13px}
      .local-panel .local-btn{min-height:52px;padding:12px 13px;border-radius:12px;font-size:11px;text-align:center;background:#fff}
      .local-panel .local-btn.is-recommended{border-color:#8eb1eb;background:#eef5ff;color:#245eb8;box-shadow:0 0 0 2px rgba(47,111,235,.07)}
      .local-panel .local-status{min-height:104px;margin-top:16px;padding:15px 16px;border:1px solid #e1e8f0;border-radius:13px;background:#fff;font-size:11px;line-height:1.65;color:#526176}
      .local-panel .local-status:empty::before{content:'작업 현황이 여기에 표시됩니다.';color:#96a2b2;font-weight:750}
      .local-panel .local-status.ok{color:#16805b;background:#f5fbf8;border-color:#cfeadd}
      .local-panel .local-status.err{color:var(--danger);background:#fff7f7;border-color:#f1d4d8}
      .local-panel .meta-box{margin-top:10px;padding:13px 14px;border-radius:12px;background:#fff;font-size:10px;line-height:1.85;max-height:220px;overflow:auto}
      @media(max-width:1100px){.quick-grid{grid-template-columns:repeat(3,minmax(0,1fr))!important}.local-panel .local-body{grid-template-columns:minmax(0,1fr) minmax(330px,.82fr)}}
      @media(max-width:760px){.quick-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}.local-panel{inset:8px!important;padding:20px 18px 22px!important;border-radius:20px!important}.local-panel .layer-close{right:14px;top:14px;width:38px;height:38px}.local-panel .local-header{padding:0 46px 17px 0}.local-panel .local-title-icon{width:42px;height:42px;flex-basis:42px}.local-panel .local-title h2{font-size:18px}.local-panel .local-badge{display:none}.local-panel .local-body{grid-template-columns:1fr;gap:14px;margin-top:17px}.local-panel .drop{min-height:270px;padding:26px 18px}.local-panel .action-box{min-height:auto}.local-panel .local-status{min-height:86px}}
      @media(max-width:470px){.quick-grid{grid-template-columns:1fr!important}.local-panel .local-actions{grid-template-columns:1fr}.local-panel .drop{min-height:230px}.local-panel .local-title p{font-size:10px}}
    `;
    document.head.appendChild(style);
  }

  function safeName(file){
    return String(file?.name||'document.pdf').replace(/\.pdf$/i,'').replace(/[\\/:*?"<>|]+/g,'_').slice(0,90)||'document';
  }

  function isPdf(file){
    return Boolean(file)&&(/\.pdf$/i.test(file.name||'')||file.type==='application/pdf');
  }

  function humanBytes(bytes){
    const value=Number(bytes||0);
    if(value<1024*1024)return `${Math.max(1,Math.round(value/1024))}KB`;
    return `${(value/1024/1024).toFixed(1)}MB`;
  }

  function setStatus(message,type='info'){
    const node=$('localStatus');
    if(!node)return;
    node.textContent=message||'';
    node.className='local-status'+(type==='ok'?' ok':type==='err'?' err':'');
  }

  function setBusy(value){
    busy=value;
    document.querySelectorAll('[data-local-run]').forEach(button=>{
      button.disabled=value||!selectedFile;
    });
    const input=$('localFile');
    if(input)input.disabled=value;
    const close=document.querySelector('#local-tools .layer-close');
    if(close)close.disabled=value;
  }

  function validateFile(file){
    if(!isPdf(file))throw new Error('PDF 파일만 선택할 수 있습니다.');
    if(Number(file.size||0)>MAX_LOCAL_BYTES)throw new Error('브라우저 로컬 빠른 처리는 120MB 이하 PDF를 권장·지원합니다.');
  }

  function chooseFile(file){
    try{
      validateFile(file);
      selectedFile=file;
      const note=$('localFileNote');
      if(note){
        note.textContent=`선택 파일 · ${file.name} · ${humanBytes(file.size)}`;
        note.classList.add('show');
      }
      const meta=$('localMetadata');
      if(meta){meta.replaceChildren();meta.classList.remove('show');}
      setStatus('로컬 처리 준비 완료 · 파일은 이 기능에서 서버로 업로드되지 않습니다.','ok');
    }catch(error){
      selectedFile=null;
      const input=$('localFile');
      if(input)input.value='';
      const note=$('localFileNote');
      if(note){note.textContent='';note.classList.remove('show');}
      setStatus(error.message||'PDF 파일을 선택할 수 없습니다.','err');
    }
    setBusy(false);
  }

  function ensurePdfLib(){
    if(window.PDFLib?.PDFDocument)return Promise.resolve(window.PDFLib);
    if(pdfLibPromise)return pdfLibPromise;
    pdfLibPromise=new Promise((resolve,reject)=>{
      let script=document.querySelector('script[data-pdf-suite-lib="pdf-lib"]');
      if(script?.dataset.failed==='1'){
        script.remove();
        script=null;
      }
      if(script){
        const started=Date.now();
        const poll=()=>{
          if(window.PDFLib?.PDFDocument)return resolve(window.PDFLib);
          if(Date.now()-started>15000){
            script.dataset.failed='1';
            script.remove();
            return reject(new Error('PDF 로컬 엔진 로딩 시간이 초과되었습니다. 다시 시도하세요.'));
          }
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
      script.dataset.pdfSuiteLib='pdf-lib';
      const timer=setTimeout(()=>{
        script.dataset.failed='1';
        script.remove();
        reject(new Error('PDF 로컬 엔진 로딩 시간이 초과되었습니다. 다시 시도하세요.'));
      },15000);
      script.onload=()=>{
        clearTimeout(timer);
        if(window.PDFLib?.PDFDocument)resolve(window.PDFLib);
        else{
          script.dataset.failed='1';
          script.remove();
          reject(new Error('PDF 로컬 엔진 초기화에 실패했습니다.'));
        }
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

  function download(bytes,name){
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

  async function loadDocument(){
    validateFile(selectedFile);
    const {PDFDocument}=await ensurePdfLib();
    const bytes=await selectedFile.arrayBuffer();
    try{
      return await PDFDocument.load(bytes,{ignoreEncryption:false,updateMetadata:false});
    }catch(error){
      const message=String(error?.message||'');
      if(/encrypt/i.test(message))throw new Error('암호화된 PDF입니다. PDF 검사·유틸리티에서 먼저 암호를 해제하세요.');
      throw new Error('PDF를 열 수 없습니다. 손상되었거나 지원되지 않는 구조일 수 있습니다.');
    }
  }

  async function rotate(angle){
    const {degrees}=await ensurePdfLib();
    const doc=await loadDocument();
    doc.getPages().forEach(page=>{
      const current=Number(page.getRotation()?.angle||0);
      page.setRotation(degrees((current+angle)%360));
    });
    const bytes=await doc.save({useObjectStreams:true,addDefaultPage:false,updateFieldAppearances:false});
    download(bytes,`${safeName(selectedFile)}_회전${angle}.pdf`);
    return `${doc.getPageCount()}페이지를 ${angle}° 회전했습니다.`;
  }

  async function reversePages(){
    const {PDFDocument}=await ensurePdfLib();
    const source=await loadDocument();
    const output=await PDFDocument.create();
    const order=source.getPageIndices().slice().reverse();
    const pages=await output.copyPages(source,order);
    pages.forEach(page=>output.addPage(page));
    const bytes=await output.save({useObjectStreams:true,addDefaultPage:false,updateFieldAppearances:false});
    download(bytes,`${safeName(selectedFile)}_페이지역순.pdf`);
    return `${pages.length}페이지 순서를 역순으로 저장했습니다.`;
  }

  function metadataRows(doc){
    const read=(fn)=>{try{return fn()||'';}catch(_){return '';}};
    const date=value=>value instanceof Date&&!Number.isNaN(value.getTime())?value.toLocaleString('ko-KR'):'';
    return [
      ['제목',read(()=>doc.getTitle())],
      ['작성자',read(()=>doc.getAuthor())],
      ['주제',read(()=>doc.getSubject())],
      ['키워드',read(()=>doc.getKeywords())],
      ['작성 프로그램',read(()=>doc.getCreator())],
      ['PDF 생성 프로그램',read(()=>doc.getProducer())],
      ['작성일',date(read(()=>doc.getCreationDate()))],
      ['수정일',date(read(()=>doc.getModificationDate()))],
      ['페이지 수',String(doc.getPageCount())]
    ];
  }

  async function inspectMetadata(){
    const doc=await loadDocument();
    const box=$('localMetadata');
    if(box){
      box.replaceChildren();
      metadataRows(doc).forEach(([label,value])=>{
        const row=document.createElement('div');
        const strong=document.createElement('b');
        strong.textContent=`${label} · `;
        row.append(strong,document.createTextNode(String(value||'없음')));
        box.appendChild(row);
      });
      box.classList.add('show');
    }
    return '문서 메타데이터를 확인했습니다.';
  }

  async function sanitizeMetadata(){
    const doc=await loadDocument();
    doc.setTitle('');
    doc.setAuthor('');
    doc.setSubject('');
    doc.setKeywords([]);
    doc.setCreator('');
    doc.setProducer('');
    const bytes=await doc.save({useObjectStreams:true,addDefaultPage:false,updateFieldAppearances:false});
    download(bytes,`${safeName(selectedFile)}_메타데이터정리.pdf`);
    const box=$('localMetadata');
    if(box){box.replaceChildren();box.classList.remove('show');}
    return '일반 문서 메타데이터를 비운 새 PDF를 저장했습니다.';
  }

  async function flattenForm(){
    const doc=await loadDocument();
    let fields=[];
    try{fields=doc.getForm().getFields();}catch(_){fields=[];}
    if(!fields.length)throw new Error('평면화할 PDF 폼 필드가 없습니다.');
    try{doc.getForm().flatten();}catch(_){throw new Error('이 PDF의 폼 필드를 평면화하지 못했습니다.');}
    const bytes=await doc.save({useObjectStreams:true,addDefaultPage:false,updateFieldAppearances:false});
    download(bytes,`${safeName(selectedFile)}_폼평면화.pdf`);
    return `폼 필드 ${fields.length}개를 현재 표시 상태로 고정했습니다.`;
  }

  async function run(action){
    if(busy)return;
    try{
      validateFile(selectedFile);
      setBusy(true);
      setStatus('PDF를 브라우저에서 처리하는 중입니다...');
      let message='';
      if(action==='rotate90')message=await rotate(90);
      else if(action==='rotate180')message=await rotate(180);
      else if(action==='rotate270')message=await rotate(270);
      else if(action==='reverse')message=await reversePages();
      else if(action==='metadata')message=await inspectMetadata();
      else if(action==='sanitize')message=await sanitizeMetadata();
      else if(action==='flatten')message=await flattenForm();
      else throw new Error('지원되지 않는 로컬 작업입니다.');
      setStatus(message,'ok');
      document.documentElement.dataset.pdfSuiteLastLocalAction=action;
    }catch(error){
      setStatus(error?.message||'PDF 로컬 처리에 실패했습니다.','err');
    }finally{
      setBusy(false);
    }
  }

  function actionButtonsFor(action){
    if(action==='rotate')return ['rotate90','rotate180','rotate270'];
    return action?[action]:[];
  }

  function markRecommended(action){
    document.querySelectorAll('[data-local-run]').forEach(button=>button.classList.remove('is-recommended'));
    actionButtonsFor(action).forEach(key=>document.querySelector(`[data-local-run="${key}"]`)?.classList.add('is-recommended'));
  }

  function closeLayer(force=false){
    if(busy&&!force)return;
    const panel=$('local-tools');
    if(!panel)return;
    panel.classList.remove('is-open');
    document.body.classList.remove('pdf-suite-layer-open');
    currentLocalAction='';
  }

  function openLayer(action='',label=''){
    const panel=$('local-tools');
    if(!panel)return;
    currentLocalAction=action;
    const title=$('localTitle');
    if(title)title.textContent=label||'내 PC에서 빠른 처리';
    const copy=panel.querySelector('.local-title p');
    if(copy)copy.textContent='PDF 파일을 올린 뒤 원하는 작업을 실행하세요. 파일은 서버로 업로드되지 않으며 원본도 덮어쓰지 않습니다.';
    markRecommended(action);
    panel.classList.add('is-open');
    document.body.classList.add('pdf-suite-layer-open');
    if(selectedFile)setStatus(`${label||'로컬 PDF'} 작업을 실행할 준비가 되었습니다.`,'ok');
    else setStatus('PDF 파일을 선택하면 작업 현황이 여기에 표시됩니다.');
    requestAnimationFrame(()=>panel.focus({preventScroll:true}));
  }

  function installRotate270(){
    const group=document.querySelector('.local-actions');
    if(!group||group.querySelector('[data-local-run="rotate270"]'))return;
    const after=group.querySelector('[data-local-run="rotate180"]');
    const button=document.createElement('button');
    button.className='local-btn';
    button.type='button';
    button.dataset.localRun='rotate270';
    button.disabled=!selectedFile;
    button.textContent='↻ 270° 회전';
    if(after?.nextSibling)group.insertBefore(button,after.nextSibling);else group.appendChild(button);
  }

  function installFileInput(){
    const input=$('localFile');
    const drop=$('localDrop');
    if(input&&!input.dataset.bound){
      input.dataset.bound='1';
      input.addEventListener('click',()=>{input.value='';});
      input.addEventListener('change',()=>chooseFile(input.files?.[0]||null));
    }
    if(drop&&!drop.dataset.bound){
      drop.dataset.bound='1';
      ['dragenter','dragover'].forEach(type=>drop.addEventListener(type,event=>{event.preventDefault();drop.classList.add('drag');}));
      ['dragleave','drop'].forEach(type=>drop.addEventListener(type,event=>{event.preventDefault();drop.classList.remove('drag');}));
      drop.addEventListener('drop',event=>chooseFile(Array.from(event.dataTransfer?.files||[]).find(isPdf)||null));
    }
  }

  function installLayer(){
    const panel=$('local-tools');
    if(!panel||panel.dataset.layerBound)return;
    panel.dataset.layerBound='1';
    panel.setAttribute('role','dialog');
    panel.setAttribute('aria-modal','true');
    panel.tabIndex=-1;
    const close=document.createElement('button');
    close.type='button';
    close.className='layer-close';
    close.setAttribute('aria-label','작업창 닫기');
    close.textContent='×';
    close.addEventListener('click',()=>closeLayer());
    panel.prepend(close);
    document.addEventListener('keydown',event=>{
      if(event.key==='Escape'&&panel.classList.contains('is-open'))closeLayer();
    });
    document.querySelectorAll('[data-local-action] .tool-go').forEach(node=>{node.textContent='작업창 열기 →';});
  }

  function installActions(){
    document.querySelectorAll('[data-local-run]').forEach(button=>{
      if(button.dataset.bound)return;
      button.dataset.bound='1';
      button.addEventListener('click',()=>run(button.dataset.localRun));
    });
    document.querySelectorAll('[data-local-action]').forEach(link=>{
      if(link.dataset.localBound)return;
      link.dataset.localBound='1';
      link.addEventListener('click',event=>{
        event.preventDefault();
        const action=link.dataset.localAction||'';
        const label=link.querySelector('.tool-name')?.textContent?.trim()||'내 PC에서 빠른 처리';
        openLayer(action,label);
      });
    });
  }

  function installFilter(){
    const search=$('suiteSearch');
    const filters=$('suiteFilters');
    if(!search||!filters||filters.dataset.bound)return;
    filters.dataset.bound='1';
    let mode='all';
    const apply=()=>{
      const query=String(search.value||'').trim().toLowerCase();
      document.querySelectorAll('.tool[data-status]').forEach(tool=>{
        const status=tool.dataset.status;
        const matchesMode=mode==='all'||status===mode||(mode==='available'&&status==='available');
        const haystack=`${tool.textContent||''} ${tool.dataset.keywords||''}`.toLowerCase();
        const matchesQuery=!query||haystack.includes(query);
        tool.classList.toggle('hidden-tool',!(matchesMode&&matchesQuery));
      });
      document.querySelectorAll('.section[data-category]').forEach(section=>{
        section.classList.toggle('hidden-tool',!section.querySelector('.tool[data-status]:not(.hidden-tool)'));
      });
    };
    search.addEventListener('input',apply);
    filters.addEventListener('click',event=>{
      const button=event.target.closest('[data-filter]');
      if(!button)return;
      mode=button.dataset.filter||'all';
      filters.querySelectorAll('[data-filter]').forEach(item=>item.classList.toggle('active',item===button));
      apply();
    });
  }

  function boot(){
    installWorkspaceStyles();
    installRotate270();
    installFileInput();
    installLayer();
    installActions();
    installFilter();
    setBusy(false);
    setStatus('PDF 파일을 선택하면 작업 현황이 여기에 표시됩니다.');
    window.ProgramStudioPdfSuite=Object.freeze({
      version:'2026.10.02.001',
      maxLocalBytes:MAX_LOCAL_BYTES,
      pdfLibSource:PDF_LIB_SRC,
      runLocal:run,
      openLocal:openLayer,
      closeLocal:closeLayer,
      getSelectedFile:()=>selectedFile,
      getCurrentLocalAction:()=>currentLocalAction
    });
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();