// Home entry points for the Program Studio print/PDF workspace.
(function(){
  'use strict';
  if(window.__programStudioPdfSuiteHomeV5)return;
  window.__programStudioPdfSuiteHomeV5=true;

  const PROGRAMS=[
    {
      id:'print-checker',
      cat:'print',
      name:'인쇄물 사전 검토',
      icon:'🔍',
      accent:'#1d9bb2',
      bg:'linear-gradient(135deg,#12396d,#1d9bb2)',
      catLabel:'인쇄 검토',
      desc:'외부에서 제작한 인쇄물 PDF의 재단선·안전 영역·접지선·책등·간격을 검토합니다.',
      url:'print-checker/',
      tags:['재단선','안전 영역','접지선']
    },
    {
      id:'pdf-editor',
      cat:'pdf',
      name:'PDF 편집 · N-UP · 소책자 배치',
      icon:'🖨️',
      accent:'#059669',
      bg:'linear-gradient(135deg,#065f46,#059669)',
      catLabel:'PDF 편집·배치',
      desc:'PDF 페이지 편집과 2-up·4-up 등 N-UP 인쇄 배치, 중철·소책자 판짜기를 한 프로그램 영역에서 사용합니다.',
      url:'pdf-editor/',
      tags:['페이지 편집','N-UP 배치','소책자 배치']
    },
    {
      id:'pdf-suite',
      cat:'pdf',
      name:'PDF 유틸리티',
      icon:'🧰',
      accent:'#2563eb',
      bg:'linear-gradient(135deg,#1e40af,#0891b2)',
      catLabel:'PDF 유틸리티',
      desc:'합치기·분할·회전·변환·OCR·압축·암호·검사 등 나머지 PDF 작업을 왼쪽 기능 메뉴와 오른쪽 작업·결과 화면에서 처리합니다.',
      url:'pdf-suite/',
      tags:['합치기·분할','변환·OCR','압축·암호·검사']
    }
  ];

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
    if(!normalizePrograms())return;
    syncCounts();
    document.documentElement.dataset.pdfHomeUnified='ready';
    document.documentElement.dataset.pdfHomeWorkspace='three-programs';
  }

  let observerQueued=false;
  const observer=new MutationObserver(()=>{
    if(observerQueued||!window.ProgramStudioHome?.PROGRAMS)return;
    observerQueued=true;
    queueMicrotask(()=>{
      observerQueued=false;
      normalizePrograms();
      syncCounts();
    });
  });
  if(document.documentElement)observer.observe(document.documentElement,{subtree:true,childList:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();
  [50,150,400,900].forEach(delay=>setTimeout(install,delay));

  window.ProgramStudioPdfSuiteHome=Object.freeze({
    programs:PROGRAMS,
    normalizePrograms,
    syncCounts,
    stage:'pdf-home-three-programs-v5'
  });
})();