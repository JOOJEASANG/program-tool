// Home entry point for the Program Studio PDF all-in-one workspace.
(function(){
  'use strict';
  if(window.__programStudioPdfSuiteHomeV2)return;
  window.__programStudioPdfSuiteHomeV2=true;

  const SUITE_PROGRAM={
    id:'pdf-suite',
    cat:'pdf',
    name:'PDF 올인원',
    icon:'📄',
    accent:'#2563eb',
    bg:'linear-gradient(135deg,#1e40af,#0891b2)',
    catLabel:'PDF',
    desc:'PDF 합치기·페이지 추출·회전 같은 기본 작업부터 검사·암호·압축·OCR·전문 인쇄배치까지 한곳에서 찾고 실행합니다.',
    url:'pdf-suite/',
    tags:['기본 PDF 작업','로컬 처리','전문 기능 연결']
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
    const set=(id,value)=>{const node=document.getElementById(id);if(node)node.textContent=String(value);};
    set('cnt-all',all);
    set('cnt-print',print);
    set('cnt-pdf',pdf);
    const count=document.getElementById('count');
    if(count){
      const active=window.ProgramStudioHome?.activeCategory||'all';
      const visible=active==='all'?all:active==='print'?print:active==='pdf'?pdf:all;
      count.textContent=`${visible}개`;
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
  }

  const observer=new MutationObserver(()=>{
    if(!window.ProgramStudioHome?.PROGRAMS)return;
    consolidatePrograms();
    syncCounts();
  });
  if(document.documentElement)observer.observe(document.documentElement,{subtree:true,childList:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();
  [50,150,400,900].forEach(delay=>setTimeout(install,delay));

  window.ProgramStudioPdfSuiteHome=Object.freeze({
    program:SUITE_PROGRAM,
    consolidatePrograms,
    syncCounts,
    stage:'pdf-suite-home-unified-v2'
  });
})();