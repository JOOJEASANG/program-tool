(function(){
  'use strict';
  if(window.__pdfEditorAppBoundaryV1)return;
  window.__pdfEditorAppBoundaryV1=true;

  const params=new URLSearchParams(location.search);
  const app=params.get('app');
  if(app!=='layout'&&app!=='booklet')return;
  document.documentElement.dataset.pdfApp=app;

  const byId=id=>document.getElementById(id);
  const text=(selector,value)=>{const node=document.querySelector(selector);if(node)node.textContent=value;};
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
    const edit=byId('sb-edit')?.closest('.sec');if(edit)edit.style.display='none';
    if(app==='layout'){
      text('.nav-title','PDF 배치');text('aside>h1','PDF 배치');text('aside>.sub','PDF 업로드 · 페이지 순서 · N-up · 용지 · 여백 · 출력');
      const nupTitle=document.querySelector('[data-sec="nup"] .sec-title');if(nupTitle)nupTitle.textContent='페이지 배치';
      return true;
    }
    text('.nav-title','소책자 제작');text('aside>h1','소책자 제작');text('aside>.sub','PDF 업로드 · 페이지 순서 · 소책자 배치 · 양면 인쇄 준비 · 출력');
    const nupTitle=document.querySelector('[data-sec="nup"] .sec-title');if(nupTitle)nupTitle.textContent='소책자 배치';
    const two=document.querySelector('.nup-btn[data-nup="2"]');
    if(two&&!two.classList.contains('active'))two.click();
    const check=byId('bookletCheck');
    if(check&&!check.checked){check.checked=true;check.dispatchEvent(new Event('change',{bubbles:true}));}
    return Boolean(check);
  }
  function boot(){
    let attempts=0;
    const tick=()=>{attempts+=1;const ready=focusMode();if((!ready||attempts<4)&&attempts<30)setTimeout(tick,120);};tick();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  window.PdfEditorAppBoundary={app,sync:focusMode,stage:'pdf-layout-booklet-boundary-v1'};
})();
