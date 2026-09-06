// Clarify that legacy PDF screens are specialist workspaces reached from PDF All-in-One.
(function(){
  'use strict';
  if(window.__programStudioPdfSpecialistLabelV1)return;
  window.__programStudioPdfSpecialistLabelV1=true;

  function installStyle(){
    if(document.getElementById('pdfSpecialistLabelStyle'))return;
    const style=document.createElement('style');
    style.id='pdfSpecialistLabelStyle';
    style.textContent=`
      .pdf-specialist-role{margin:0 0 14px;border:1px solid #bfdbfe;background:#eff6ff;color:#334155;border-radius:12px;padding:10px 12px;font:800 11px/1.55 Pretendard,"Noto Sans KR",sans-serif}
      .pdf-specialist-role a{color:#1d4ed8;font-weight:950;text-decoration:none}.pdf-specialist-role strong{color:#0f2f59}
      .pdf-editor-specialist-link{display:block;margin:0 0 12px;border:1px solid #bfdbfe;background:#eff6ff;color:#334155;border-radius:10px;padding:9px 10px;font:800 10px/1.5 Pretendard,"Noto Sans KR",sans-serif;text-decoration:none}
    `;
    document.head.appendChild(style);
  }

  function installPreflight(){
    document.title='PDF 전문 검사·변환 · Program Studio';
    const nav=document.querySelector('.nav-title');
    if(nav)nav.textContent='PDF 전문 검사·변환';
    const hero=document.querySelector('.hero');
    const heading=hero?.querySelector('h1');
    const copy=hero?.querySelector('p');
    if(heading)heading.textContent='PDF 전문 검사·변환';
    if(copy)copy.textContent='기본 합치기·페이지 추출은 PDF 올인원에서 바로 처리합니다. 이 화면은 인쇄 진단, 암호, 압축, 변환처럼 전문 처리가 필요한 작업에 사용합니다.';
    const container=document.querySelector('.container');
    if(container&&!document.getElementById('pdfSpecialistRole')){
      const role=document.createElement('div');
      role.id='pdfSpecialistRole';
      role.className='pdf-specialist-role';
      role.innerHTML='<strong>전문 기능 화면</strong> · 일반 PDF 작업은 <a href="../pdf-suite/">PDF 올인원</a>에서 한 페이지 안에서 처리할 수 있습니다.';
      container.prepend(role);
    }
    document.documentElement.dataset.pdfSpecialist='preflight';
  }

  function installEditor(){
    document.title='PDF 전문 편집·인쇄배치 · Program Studio';
    const nav=document.querySelector('.nav-title');
    if(nav)nav.textContent='PDF 전문 편집·인쇄배치';
    const aside=document.querySelector('aside');
    const heading=aside?.querySelector('h1');
    if(heading)heading.textContent='PDF 전문 편집·인쇄배치';
    if(aside&&!document.getElementById('pdfEditorSpecialistLink')){
      const link=document.createElement('a');
      link.id='pdfEditorSpecialistLink';
      link.className='pdf-editor-specialist-link';
      link.href='../pdf-suite/';
      link.textContent='← 기본 PDF 작업은 PDF 올인원에서';
      aside.prepend(link);
    }
    document.documentElement.dataset.pdfSpecialist='editor';
  }

  function install(){
    installStyle();
    const path=location.pathname;
    if(/(^|\/)pdf-preflight(\/|$)/.test(path))installPreflight();
    if(/(^|\/)pdf-editor(\/|$)/.test(path))installEditor();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();
})();