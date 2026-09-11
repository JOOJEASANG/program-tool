// Home entry points for the Program Studio print/PDF workspace.
(function(){
  'use strict';
  if(window.__programStudioPdfSuiteHomeV7)return;
  window.__programStudioPdfSuiteHomeV7=true;

  const MANUAL_ASSET_VERSION='20260911-2';
  const PROGRAMS=[
    {id:'print-checker',cat:'print',name:'인쇄물 사전 검토',icon:'🔍',accent:'#1d9bb2',bg:'linear-gradient(135deg,#12396d,#1d9bb2)',catLabel:'인쇄 검토',desc:'외부에서 제작한 인쇄물 PDF의 재단선·안전 영역·접지선·책등·간격을 검토합니다.',url:'print-checker/',manualUrl:'manuals/?program=print-checker',tags:['재단선','안전 영역','접지선']},
    {id:'smart-print-layout',cat:'print',name:'스마트 인쇄배치',icon:'▦',accent:'#0f766e',bg:'linear-gradient(135deg,#115e59,#14b8a6)',catLabel:'스마트 배치',desc:'PDF의 실제 크기를 읽어 용지 한 장에 최대 자동배치하고 앞면·뒷면 양면 위치까지 맞춥니다.',url:'smart-print-layout/',manualUrl:'manuals/?program=smart-print-layout',tags:['자동배치','앞면·뒷면','종이 절약']},
    {id:'pdf-editor',cat:'pdf',name:'PDF배치',icon:'🖨️',accent:'#059669',bg:'linear-gradient(135deg,#065f46,#059669)',catLabel:'PDF 인쇄 배치',desc:'페이지 순서 정리, N-UP, 중철·소책자, 간지, 여백 등 출력용 PDF 배치 작업을 가볍게 처리합니다.',url:'pdf-editor/',manualUrl:'manuals/?program=pdf-editor',tags:['N-UP','소책자','간지·여백','페이지 편집']},
    {id:'pdf-editor-advanced',cat:'pdf',name:'PDF편집',icon:'✂️',accent:'#7c3aed',bg:'linear-gradient(135deg,#5b21b6,#7c3aed)',catLabel:'PDF 정밀 편집',desc:'페이지별 이동·크기조절, 드래그 잘라내기, 자동 맞춤, 회전·미세 회전 등 정밀 편집 기능을 사용합니다.',url:'pdf-editor-advanced',manualUrl:'manuals/?program=pdf-editor-advanced',tags:['이동·크기','드래그 자르기','회전·미세편집','페이지 편집']},
    {id:'pdf-suite',cat:'pdf',name:'PDF 유틸리티',icon:'🧰',accent:'#2563eb',bg:'linear-gradient(135deg,#1e40af,#0891b2)',catLabel:'PDF 유틸리티',desc:'합치기·분할·회전·변환·OCR·압축·암호·검사 등 나머지 PDF 작업을 왼쪽 기능 메뉴와 오른쪽 작업·결과 화면에서 처리합니다.',url:'pdf-suite/',manualUrl:'manuals/?program=pdf-suite',tags:['합치기·분할','변환·OCR','압축·암호·검사']}
  ];
  let manualLoaderPromise=null;

  function normalizePrograms(){
    const api=window.ProgramStudioHome;
    const programs=api?.PROGRAMS;
    if(!Array.isArray(programs))return false;
    const before=programs.map(item=>`${item.id}:${item.name}`).join('|');
    programs.splice(0,programs.length,...PROGRAMS.map(item=>({...item})));
    const after=programs.map(item=>`${item.id}:${item.name}`).join('|');
    if(before!==after){
      try{window.renderGrid?.();}catch(_){ }
      try{window.buildQuickRow?.();}catch(_){ }
    }
    return true;
  }

  function syncCounts(){
    const programs=window.ProgramStudioHome?.PROGRAMS;
    if(!Array.isArray(programs))return;
    const all=programs.length;
    const print=programs.filter(item=>item.cat==='print').length;
    const pdf=programs.filter(item=>item.cat==='pdf').length;
    const set=(id,value)=>{const node=document.getElementById(id);const next=String(value);if(node&&node.textContent!==next)node.textContent=next;};
    set('cnt-all',all);set('cnt-print',print);set('cnt-pdf',pdf);
    const count=document.getElementById('count');
    if(count){
      const active=window.ProgramStudioHome?.activeCategory||'all';
      const visible=active==='all'?all:active==='print'?print:active==='pdf'?pdf:all;
      const next=`${visible}개`;
      if(count.textContent!==next)count.textContent=next;
    }
  }

  function installManualStyles(){
    if(!document.getElementById('programManualHomeModalStyle')){
      const link=document.createElement('link');
      link.id='programManualHomeModalStyle';
      link.rel='stylesheet';
      link.href=`/css/program-manual-home-modal.css?v=${MANUAL_ASSET_VERSION}`;
      document.head.appendChild(link);
    }
    if(document.getElementById('programHomeCardTitleManualStyle'))return;
    const style=document.createElement('style');
    style.id='programHomeCardTitleManualStyle';
    style.textContent=`
      .prog-card[data-home-card-layout="title-manual"] .card-header{
        display:flex!important;
        align-items:center!important;
        gap:16px!important;
        min-height:104px;
        padding:20px 22px!important;
      }
      .prog-card[data-home-card-layout="title-manual"] .card-icon-wrap{flex:0 0 auto;margin:0!important}
      .prog-card[data-home-card-layout="title-manual"] .card-title-row{
        min-width:0;
        display:flex;
        align-items:center;
        gap:8px;
      }
      .prog-card[data-home-card-layout="title-manual"] .card-name{
        margin:0!important;
        color:#fff!important;
        font-size:clamp(20px,2vw,25px)!important;
        font-weight:900!important;
        line-height:1.25!important;
        letter-spacing:-.035em;
      }
      .prog-card[data-home-card-layout="title-manual"] .card-manual-btn{
        box-sizing:border-box;
        width:28px!important;
        height:28px!important;
        min-width:28px!important;
        min-height:28px!important;
        margin:0!important;
        padding:0!important;
        display:inline-flex!important;
        align-items:center;
        justify-content:center;
        flex:0 0 28px;
        border:1px solid rgba(255,255,255,.68)!important;
        border-radius:50%!important;
        background:rgba(255,255,255,.16)!important;
        color:#fff!important;
        font-size:16px!important;
        font-weight:900!important;
        line-height:1!important;
        cursor:pointer;
        transition:background .16s ease,transform .16s ease,border-color .16s ease;
      }
      .prog-card[data-home-card-layout="title-manual"] .card-manual-btn:hover,
      .prog-card[data-home-card-layout="title-manual"] .card-manual-btn:focus-visible{
        background:rgba(255,255,255,.28)!important;
        border-color:#fff!important;
        transform:translateY(-1px);
        outline:2px solid rgba(255,255,255,.72);
        outline-offset:2px;
      }
      .prog-card[data-home-card-layout="title-manual"] .card-body{
        padding:17px 22px 21px!important;
      }
      .prog-card[data-home-card-layout="title-manual"] .card-desc{
        margin:0!important;
      }
      @media(max-width:640px){
        .prog-card[data-home-card-layout="title-manual"] .card-header{min-height:92px;padding:18px!important;gap:13px!important}
        .prog-card[data-home-card-layout="title-manual"] .card-name{font-size:20px!important}
      }
    `;
    document.head.appendChild(style);
  }

  function ensureManualModal(){
    if(window.ProgramManualHomeModal)return Promise.resolve(window.ProgramManualHomeModal);
    if(manualLoaderPromise)return manualLoaderPromise;
    manualLoaderPromise=new Promise((resolve,reject)=>{
      const existing=document.getElementById('programManualHomeModalScript');
      const script=existing||document.createElement('script');
      const done=()=>window.ProgramManualHomeModal?resolve(window.ProgramManualHomeModal):reject(new Error('사용설명서 레이어를 시작하지 못했습니다.'));
      if(existing){
        if(window.ProgramManualHomeModal)return done();
        script.addEventListener('load',done,{once:true});
        script.addEventListener('error',()=>reject(new Error('사용설명서 레이어를 불러오지 못했습니다.')),{once:true});
        return;
      }
      script.id='programManualHomeModalScript';
      script.src=`/js/program-manuals/home-modal.js?v=${MANUAL_ASSET_VERSION}`;
      script.async=true;
      script.addEventListener('load',done,{once:true});
      script.addEventListener('error',()=>reject(new Error('사용설명서 레이어를 불러오지 못했습니다.')),{once:true});
      document.head.appendChild(script);
    }).finally(()=>{if(!window.ProgramManualHomeModal)manualLoaderPromise=null;});
    return manualLoaderPromise;
  }

  function openManual(programId,trigger){
    ensureManualModal().then(api=>api.open(programId,trigger)).catch(error=>{
      console.error(error);
      window.alert('사용설명서를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
    });
  }

  function cardForProgram(program){
    return [...document.querySelectorAll('.prog-card[href]')].find(node=>{
      const href=node.getAttribute('href')||'';
      return href===program.url||href.endsWith(`/${program.url}`)||href.replace(/^\.\//,'')===program.url;
    })||null;
  }

  function installCardManualButtons(){
    for(const program of PROGRAMS){
      const card=cardForProgram(program);
      if(!card)continue;
      const header=card.querySelector('.card-header');
      const body=card.querySelector('.card-body');
      const name=card.querySelector('.card-name');
      if(!header||!body||!name)continue;

      card.dataset.manualUrl=`/${program.manualUrl}`;
      card.dataset.homeCardLayout='title-manual';
      card.querySelector('.card-cat')?.remove();
      card.querySelector('.card-tags')?.remove();
      card.querySelector('.card-footer')?.remove();

      let titleRow=header.querySelector('.card-title-row');
      if(!titleRow){
        titleRow=document.createElement('div');
        titleRow.className='card-title-row';
        header.appendChild(titleRow);
      }
      if(name.parentElement!==titleRow)titleRow.appendChild(name);

      let button=titleRow.querySelector('[data-manual-program]');
      if(!button){
        button=document.createElement('span');
        button.className='card-manual-btn';
        button.setAttribute('role','button');
        button.tabIndex=0;
        button.textContent='?';
        titleRow.appendChild(button);
      }
      button.dataset.manualProgram=program.id;
      button.setAttribute('aria-label',`${program.name} 사용설명서 열기`);
      button.setAttribute('title','사용설명서');
      if(button.dataset.manualBound==='1')continue;
      button.dataset.manualBound='1';
      button.addEventListener('click',event=>{
        event.preventDefault();event.stopPropagation();
        openManual(program.id,button);
      });
      button.addEventListener('keydown',event=>{
        if(event.key!=='Enter'&&event.key!==' ')return;
        event.preventDefault();event.stopPropagation();
        openManual(program.id,button);
      });
    }
  }

  function removeStandaloneManualEntries(){
    document.getElementById('programManualNav')?.remove();
    document.querySelector('[data-program-manual-divider]')?.remove();
    document.getElementById('programManualTopLink')?.remove();
  }

  function installManualEntry(){
    removeStandaloneManualEntries();
    installManualStyles();
    installCardManualButtons();
  }

  function removeLegacyEntry(){
    document.getElementById('pdfSuiteHomeEntry')?.remove();
    document.querySelectorAll('[data-pdf-suite-home-chip]').forEach(node=>node.remove());
  }

  function install(){
    removeLegacyEntry();
    if(!normalizePrograms())return;
    syncCounts();
    installManualEntry();
    document.documentElement.dataset.pdfHomeUnified='ready';
    document.documentElement.dataset.pdfHomeWorkspace='five-programs';
  }

  let observerQueued=false;
  const observer=new MutationObserver(()=>{
    if(observerQueued||!window.ProgramStudioHome?.PROGRAMS)return;
    observerQueued=true;
    queueMicrotask(()=>{
      observerQueued=false;
      normalizePrograms();syncCounts();installManualEntry();
    });
  });
  if(document.documentElement)observer.observe(document.documentElement,{subtree:true,childList:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
  [50,150,400,900].forEach(delay=>setTimeout(install,delay));

  window.ProgramStudioPdfSuiteHome=Object.freeze({
    programs:PROGRAMS,
    normalizePrograms,
    syncCounts,
    installManualEntry,
    installCardManualButtons,
    openManual,
    stage:'pdf-home-five-programs-v7'
  });
})();
