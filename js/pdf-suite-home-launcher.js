// Home entry point for the Program Studio PDF all-in-one workspace.
(function(){
  'use strict';
  if(window.__programStudioPdfSuiteHomeV1)return;
  window.__programStudioPdfSuiteHomeV1=true;

  function installStyle(){
    if(document.getElementById('pdfSuiteHomeStyle'))return;
    const style=document.createElement('style');
    style.id='pdfSuiteHomeStyle';
    style.textContent=`
      .pdf-suite-home-entry{margin:0 0 26px;border:1.5px solid #bfdbfe;background:linear-gradient(135deg,#eff6ff,#ecfeff);border-radius:16px;padding:18px 20px;display:flex;align-items:center;gap:15px;box-shadow:0 8px 22px rgba(37,99,235,.06)}
      .pdf-suite-home-icon{width:48px;height:48px;border-radius:13px;display:grid;place-items:center;background:linear-gradient(135deg,#1d4ed8,#0891b2);color:#fff;font-size:22px;flex:0 0 48px}
      .pdf-suite-home-body{flex:1;min-width:0}.pdf-suite-home-title{font-size:15px;font-weight:950;color:#0f2f59}.pdf-suite-home-desc{font-size:11px;color:#475569;line-height:1.55;margin-top:4px}
      .pdf-suite-home-cta{flex:0 0 auto;text-decoration:none;border:0;border-radius:11px;background:#1d4ed8;color:#fff;padding:10px 14px;font-size:11px;font-weight:900;box-shadow:0 4px 12px rgba(37,99,235,.18)}
      @media(max-width:640px){.pdf-suite-home-entry{align-items:flex-start;flex-wrap:wrap}.pdf-suite-home-body{min-width:calc(100% - 70px)}.pdf-suite-home-cta{margin-left:63px}}
    `;
    document.head.appendChild(style);
  }

  function installEntry(){
    const quick=document.getElementById('quickSection');
    if(!quick||document.getElementById('pdfSuiteHomeEntry'))return false;
    installStyle();
    const box=document.createElement('section');
    box.id='pdfSuiteHomeEntry';
    box.className='pdf-suite-home-entry';
    box.setAttribute('aria-label','PDF 올인원 빠른 실행');
    box.innerHTML='<div class="pdf-suite-home-icon">📄</div><div class="pdf-suite-home-body"><div class="pdf-suite-home-title">PDF 올인원 · PDF로 할 수 있는 작업을 한곳에</div><div class="pdf-suite-home-desc">페이지 구성 · 변환 · 편집 · 보안 · 인쇄 · 스캔/OCR 확장 · 최적화 · 검사/분석을 목적별로 찾고 바로 실행합니다.</div></div><a class="pdf-suite-home-cta" href="pdf-suite/">PDF 올인원 열기 →</a>';
    quick.insertAdjacentElement('afterend',box);
    return true;
  }

  function installQuickChip(){
    const row=document.getElementById('quickRow');
    if(!row||row.querySelector('[data-pdf-suite-home-chip]'))return false;
    const link=document.createElement('a');
    link.href='pdf-suite/';
    link.className='quick-chip';
    link.dataset.pdfSuiteHomeChip='1';
    link.innerHTML='<span class="quick-dot" style="background:#2563eb"></span>PDF 올인원';
    row.prepend(link);
    return true;
  }

  function install(){
    installEntry();
    installQuickChip();
  }

  const observer=new MutationObserver(install);
  if(document.documentElement)observer.observe(document.documentElement,{subtree:true,childList:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();
  [80,250,600,1200,2200].forEach(delay=>setTimeout(install,delay));
})();
