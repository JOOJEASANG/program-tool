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
        $('local-tools')?.scrollIntoView({behavior:'smooth',block:'start'});
        const action=link.dataset.localAction;
        if(selectedFile&&['metadata','sanitize','flatten'].includes(action))setTimeout(()=>run(action),250);
        else setStatus('아래에서 PDF 한 개를 선택한 뒤 로컬 작업을 실행하세요.');
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
    installRotate270();
    installFileInput();
    installActions();
    installFilter();
    setBusy(false);
    window.ProgramStudioPdfSuite=Object.freeze({
      version:'2026.09.04.001',
      maxLocalBytes:MAX_LOCAL_BYTES,
      pdfLibSource:PDF_LIB_SRC,
      runLocal:run,
      getSelectedFile:()=>selectedFile
    });
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
