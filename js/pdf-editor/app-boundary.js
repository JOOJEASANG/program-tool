(function(){
  'use strict';
  if(window.__pdfEditorAppBoundaryV1)return;
  window.__pdfEditorAppBoundaryV1=true;

  const params=new URLSearchParams(location.search);
  const app=params.get('app');
  if(app!=='layout'&&app!=='booklet')return;
  const profile=window.PdfEditorStandaloneApps?.fromLocation?.(location.search)||null;
  document.documentElement.dataset.pdfApp=app;
  if(profile?.key)document.documentElement.dataset.pdfStandaloneProfile=profile.key;

  const byId=id=>document.getElementById(id);
  const text=(selector,value)=>{const node=document.querySelector(selector);if(node)node.textContent=value;};
  const title=profile?.title||(app==='layout'?'PDF 배치':'소책자 제작');
  const subtitle=profile?.subtitle||(app==='layout'?'PDF 업로드 · 페이지 순서 · N-up · 용지 · 여백 · 출력':'PDF 업로드 · 페이지 순서 · 소책자 배치 · 양면 인쇄 준비 · 출력');
  const sectionTitle=profile?.sectionTitle||(app==='layout'?'페이지 배치':'소책자 배치');
  const defaultNup=Number(profile?.defaultNup)||2;
  const bookletEnabled=profile?.booklet??(app==='booklet');
  const showBooklet=profile?.showBooklet??(app==='booklet');
  const showDocumentEdit=profile?.showDocumentEdit??false;

  function installStyles(){
    if(byId('pdfAppBoundaryStylesV1'))return;
    const style=document.createElement('style');style.id='pdfAppBoundaryStylesV1';style.textContent=`
      html[data-pdf-app] body{background:#eef3f7}
      html[data-pdf-app] body.pdf-app-embedded{padding-top:0!important}
      html[data-pdf-app] body.pdf-app-embedded .top-nav{display:none!important}
      html[data-pdf-app] body.pdf-app-embedded .app{height:100vh!important}
      html[data-pdf-app] aside>h1{font-size:17px;letter-spacing:-.35px;color:#0b2a55}
      html[data-pdf-app] aside>.sub{font-size:10px;line-height:1.6;color:#667085}
      html[data-pdf-app] .sec{border-top-color:#e8edf3}
      html[data-pdf-app] .sec-head .sec-title{letter-spacing:.2px;text-transform:none}
      html[data-pdf-app="booklet"] #bookletRow{display:block!important;border:1px solid #d8e7f8;border-radius:9px;background:#f4f9ff;padding:8px 9px;margin-top:7px!important}
      html[data-pdf-app="layout"] #bookletRow{display:none!important}
    `;document.head.appendChild(style);
  }
  function focusMode(){
    installStyles();
    if(params.get('embed')==='1')document.body.classList.add('pdf-app-embedded');
    const edit=byId('sb-edit')?.closest('.sec');if(edit)edit.style.display=showDocumentEdit?'':'none';
    text('.nav-title',title);text('aside>h1',title);text('aside>.sub',subtitle);
    const nupTitle=document.querySelector('[data-sec="nup"] .sec-title');if(nupTitle)nupTitle.textContent=sectionTitle;
    const bookletRow=byId('bookletRow');if(bookletRow)bookletRow.hidden=!showBooklet;
    const nup=document.querySelector(`.nup-btn[data-nup="${defaultNup}"]`);
    if(nup&&!nup.classList.contains('active'))nup.click();
    if(app==='layout'){
      const check=byId('bookletCheck');
      if(check&&check.checked){check.checked=false;check.dispatchEvent(new Event('change',{bubbles:true}));}
      return true;
    }
    const check=byId('bookletCheck');
    if(check&&check.checked!==bookletEnabled){check.checked=bookletEnabled;check.dispatchEvent(new Event('change',{bubbles:true}));}
    return Boolean(check);
  }
  function boot(){
    let attempts=0;
    const tick=()=>{attempts+=1;const ready=focusMode();if((!ready||attempts<4)&&attempts<30)setTimeout(tick,120);};tick();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  window.PdfEditorAppBoundary={app,profile:profile?.key||app,sync:focusMode,stage:'pdf-layout-booklet-boundary-v2'};
})();
