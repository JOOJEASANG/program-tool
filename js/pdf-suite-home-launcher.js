// Home entry point for the Program Studio PDF workspace.
(function(){
  'use strict';
  if(window.__programStudioPdfSuiteHomeV3)return;
  window.__programStudioPdfSuiteHomeV3=true;

  const SUITE_PROGRAM={
    id:'pdf-suite',
    cat:'pdf',
    name:'PDF 작업실',
    icon:'📄',
    accent:'#2563eb',
    bg:'linear-gradient(135deg,#1e40af,#0891b2)',
    catLabel:'PDF',
    desc:'PDF 작업은 한 번 들어온 뒤 화면을 옮기지 않고 기능 메뉴만 바꿔서 처리합니다. 합치기·추출·변환·편집·보안·검사 기능을 한 작업실에서 사용합니다.',
    url:'pdf-suite/',
    tags:['한 화면 PDF 작업','로컬 처리','기능 메뉴 전환']
  };

  function consolidatePrograms(){
    const api=window.ProgramStudioHome;
    const programs=api?.PROGRAMS;
    if(!Array.isArray(programs))return false;
    const before=programs.map(item=>item.id).join(',');
    const retained=programs.filter(item=>!['pdf-editor','pdf-preflight','pdf-suite'].includes(item.id));
    retained.push({...SUITE_PROGRAM});
    programs.splice(0,programs.length,...retained);
    const changed=before!==programs.map(item=>item.id).join(',');
    if(changed){
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
    const set=(id,value)=>{
      const node=document.getElementById(id);
      const next=String(value);
      if(node&&node.textContent!==next)node.textContent=next;
    };
    set('cnt-all',all);
    set('cnt-print',print);
    set('cnt-pdf',pdf);
    const count=document.getElementById('count');
    if(count){
      const active=window.ProgramStudioHome?.activeCategory||'all';
      const visible=active==='all'?all:active==='print'?print:active==='pdf'?pdf:all;
      const next=`${visible}개`;
      if(count.textContent!==next)count.textContent=next;
    }
  }

  function removeLegacyEntry(){
    document.getElementById('pdfSuiteHomeEntry')?.remove();
    document.querySelectorAll('[data-pdf-suite-home-chip]').forEach(node=>node.remove());
  }

  function install(){
    removeLegacyEntry();
    if(!consolidatePrograms())return;
    syncCounts();
    document.documentElement.dataset.pdfHomeUnified='ready';
    document.documentElement.dataset.pdfHomeWorkspace='single-page';
  }

  let observerQueued=false;
  const observer=new MutationObserver(()=>{
    if(observerQueued||!window.ProgramStudioHome?.PROGRAMS)return;
    observerQueued=true;
    queueMicrotask(()=>{
      observerQueued=false;
      consolidatePrograms();
      syncCounts();
    });
  });
  if(document.documentElement)observer.observe(document.documentElement,{subtree:true,childList:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();
  [50,150,400,900].forEach(delay=>setTimeout(install,delay));

  window.ProgramStudioPdfSuiteHome=Object.freeze({
    program:SUITE_PROGRAM,
    consolidatePrograms,
    syncCounts,
    stage:'pdf-suite-home-single-workspace-v3'
  });
})();