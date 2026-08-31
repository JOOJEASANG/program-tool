// Standalone PDF app profiles.
// Keeps app-specific UX/defaults outside the canonical PDF route manifest.
(function(){
  'use strict';
  if(window.PdfEditorStandaloneApps)return;

  const PROFILES=Object.freeze({
    layout:Object.freeze({
      key:'layout',
      title:'PDF 배치',
      subtitle:'PDF 업로드 · 페이지 순서 · N-up · 용지 · 여백 · 출력',
      sectionTitle:'페이지 배치',
      defaultNup:2,
      booklet:false,
      showBooklet:false,
      showDocumentEdit:false
    }),
    booklet:Object.freeze({
      key:'booklet',
      title:'소책자 제작',
      subtitle:'PDF 업로드 · 페이지 순서 · 소책자 배치 · 양면 인쇄 준비 · 출력',
      sectionTitle:'소책자 배치',
      defaultNup:2,
      booklet:true,
      showBooklet:true,
      showDocumentEdit:false
    })
  });

  function normalizeKey(value){
    const raw=String(value||'').trim().toLowerCase();
    return raw==='pdf-layout'?'layout':raw;
  }
  function get(value){return PROFILES[normalizeKey(value)]||null;}
  function fromLocation(search=location.search){
    return get(new URLSearchParams(search).get('app'));
  }

  window.PdfEditorStandaloneApps=Object.freeze({
    profiles:PROFILES,
    get,
    fromLocation,
    stage:'standalone-pdf-app-profiles-v1'
  });
})();
