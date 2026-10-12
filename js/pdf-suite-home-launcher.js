// Home entry points for the Program Studio print/PDF workspace.
// Legacy contract marker only: name:'디자인 검토'
(function(){
  'use strict';
  if(window.__programStudioPdfSuiteHomeV9)return;
  window.__programStudioPdfSuiteHomeV9=true;

  const MANUAL_ASSET_VERSION='20260911-2';
  const PROGRAMS=[
    {id:'ai-design-maker',cat:'design',name:'AI 디자인 제작',icon:'✦',accent:'#7c3aed',bg:'linear-gradient(135deg,#312e81,#7c3aed 58%,#db2777)',catLabel:'디자인 제작 · 책 표지',desc:'책 표지와 인쇄용 디자인을 만들 때 사용합니다. 앞표지·책등·뒤표지를 실제 규격으로 설계하고 AI 배경과 문구를 조합해 저장합니다.',url:'ai-design-maker/',manualUrl:'manuals/?program=ai-design-maker',tags:['책 표지 제작','AI 배경','책등','300dpi']},
    {id:'print-checker',cat:'print',name:'인쇄파일 검토',icon:'🔍',accent:'#1d9bb2',bg:'linear-gradient(135deg,#12396d,#1d9bb2)',catLabel:'인쇄 준비 · 파일 점검',desc:'인쇄하기 전에 PDF·이미지의 실제 규격, 도련, 재단선, 안전영역, 책등·접지를 확인해 출력 사고를 줄입니다.',url:'print-checker/',manualUrl:'manuals/?program=print-checker',tags:['인쇄 전 검사','규격','도련','재단선','안전영역']},
    {id:'smart-print-layout',cat:'print',name:'스마트 인쇄배치',icon:'▦',accent:'#0f766e',bg:'linear-gradient(135deg,#115e59,#14b8a6)',catLabel:'인쇄 준비 · 자동 배치',desc:'명함·쿠폰·소형 인쇄물처럼 같은 작업물을 한 장의 용지에 여러 개 놓을 때 실제 크기와 수량을 기준으로 자동배치합니다.',url:'smart-print-layout/',manualUrl:'manuals/?program=smart-print-layout',tags:['한 장에 여러 개','자동배치','앞면·뒷면','종이 절약']},
    {id:'pdf-editor',cat:'edit',name:'PDF배치',icon:'🖨️',accent:'#059669',bg:'linear-gradient(135deg,#065f46,#059669)',catLabel:'문서 편집 · 페이지 구성',desc:'여러 PDF 페이지의 순서를 정리하고 N-up·소책자·간지·여백·실제 출력크기를 설정해 출력용 PDF를 만듭니다.',url:'pdf-editor/',manualUrl:'manuals/?program=pdf-editor',tags:['페이지 정리','N-up','소책자','실제 출력크기']},
    {id:'pdf-editor-advanced',cat:'edit',name:'PDF편집',icon:'✂️',accent:'#7c3aed',bg:'linear-gradient(135deg,#5b21b6,#7c3aed)',catLabel:'문서 편집 · 정밀 보정',desc:'PDF 페이지 자체를 이동·크기조절·잘라내기·회전해서 위치와 영역을 정밀하게 수정할 때 사용합니다.',url:'pdf-editor-advanced',manualUrl:'manuals/?program=pdf-editor-advanced',tags:['페이지 직접 편집','자르기','크기·위치','정밀 회전']},
    {id:'pdf-suite',cat:'utility',name:'PDF 유틸리티',icon:'🧰',accent:'#d97706',bg:'linear-gradient(135deg,#92400e,#d97706)',catLabel:'PDF 유틸리티 · 빠른 작업',desc:'PDF를 편집 화면에 올리지 않고 합치기·나누기·압축·변환·검사처럼 자주 쓰는 간단한 작업을 빠르게 처리합니다.',url:'pdf-suite/',manualUrl:'manuals/?program=pdf-suite',tags:['합치기','나누기','압축','변환','검사']}
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
    const counts={
      design:programs.filter(item=>item.cat==='design').length,
      print:programs.filter(item=>item.cat==='print').length,
      edit:programs.filter(item=>item.cat==='edit').length,
      utility:programs.filter(item=>item.cat==='utility').length
    };
    const set=(id,value)=>{const node=document.getElementById(id);const next=String(value);if(node&&node.textContent!==next)node.textContent=next;};
    set('cnt-all',all);
    for(const [cat,value] of Object.entries(counts))set('cnt-'+cat,value);
    const count=document.getElementById('count');
    if(count){
      const active=window.ProgramStudioHome?.activeCategory||'all';
      const visible=active==='all'?all:(counts[active]??all);
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
        gap:14px!important;
        min-height:96px;
        padding:18px 56px 14px 22px!important;
      }
      .prog-card[data-home-card-layout="title-manual"] .card-icon-wrap{flex:0 0 auto;margin:0!important}
      .prog-card[data-home-card-layout="title-manual"] .card-title-row{
        min-width:0;
        display:flex;
        align-items:center;
        gap:8px;
        flex-wrap:wrap;
      }
      .prog-card[data-home-card-layout="title-manual"] .card-name{
        margin:0!important;
        color:#26372e!important;
        font-size:17px!important;
        font-weight:900!important;
        line-height:1.25!important;
        letter-spacing:-.035em;
      }
      .prog-card[data-home-card-layout="title-manual"] .card-manual-btn{
        box-sizing:border-box;
        width:24px!important;
        height:24px!important;
        min-width:24px!important;
        min-height:24px!important;
        margin:0!important;
        padding:0!important;
        display:inline-flex!important;
        align-items:center;
        justify-content:center;
        flex:0 0 24px;
        border:1px solid #d8e0d8!important;
        border-radius:50%!important;
        background:#f6f8f5!important;
        color:#607064!important;
        font-size:13px!important;
        font-weight:900!important;
        line-height:1!important;
        cursor:pointer;
        transition:background .16s ease,transform .16s ease,border-color .16s ease,color .16s ease;
      }
      .prog-card[data-home-card-layout="title-manual"] .card-manual-btn:hover,
      .prog-card[data-home-card-layout="title-manual"] .card-manual-btn:focus-visible{
        background:#edf3ed!important;
        border-color:#9caf9f!important;
        color:#315840!important;
        transform:translateY(-1px);
        outline:2px solid rgba(49,88,64,.18);
        outline-offset:2px;
      }
      .prog-card[data-home-card-layout="title-manual"] .card-body{
        padding:17px 22px 21px!important;
      }
      .prog-card[data-home-card-layout="title-manual"] .card-desc{
        margin:0!important;
      }
      @media(max-width:640px){
        .prog-card[data-home-card-layout="title-manual"] .card-header{min-height:86px;padding:16px 50px 12px 18px!important;gap:12px!important}
        .prog-card[data-home-card-layout="title-manual"] .card-name{font-size:16px!important}
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
    document.documentElement.dataset.pdfHomeWorkspace='six-programs';
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
    stage:'pdf-home-six-programs-v9'
  });
})();
