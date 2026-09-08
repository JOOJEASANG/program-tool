// Advanced editor profile scope.
// Keeps the dedicated advanced editor focused on single-page precision editing
// while N-up and booklet remain available through their standalone tools.
(function(){
  'use strict';
  if(window.__pdfEditorAdvancedProfileScopeV1)return;
  window.__pdfEditorAdvancedProfileScopeV1=true;

  const root=document.documentElement;
  const isAdvanced=()=>{
    if(root.dataset.pdfEditorProfile==='advanced')return true;
    const value=new URLSearchParams(String(location.search||'')).get('profile');
    return String(value||'').trim().toLowerCase()==='advanced';
  };
  if(!isAdvanced())return;

  let observer=null;
  let applying=false;

  function pages(){
    try{return typeof parsedPages!=='undefined'&&Array.isArray(parsedPages)?parsedPages:[];}catch(_){return[];}
  }

  function normalizeSinglePageLayout(){
    try{if(typeof nup!=='undefined')nup=1;}catch(_){}
    try{
      if(typeof fileNupMap!=='undefined'&&fileNupMap&&typeof fileNupMap==='object'){
        Object.keys(fileNupMap).forEach(key=>delete fileNupMap[key]);
      }
    }catch(_){}
    pages().forEach(page=>{
      if(!page||page.pageType==='blank'||page.pageType==='divider')return;
      if(page.nupOverride!=null)page.nupOverride=null;
    });

    const booklet=document.getElementById('bookletCheck');
    if(booklet){
      booklet.checked=false;
      booklet.disabled=true;
      booklet.setAttribute('aria-hidden','true');
    }

    const buttons=document.querySelectorAll('#nupGrid [data-nup]');
    buttons.forEach(button=>button.classList.toggle('active',String(button.dataset.nup)==='1'));
  }

  function hideElement(node){
    if(!node)return;
    node.hidden=true;
    node.style.setProperty('display','none','important');
    node.setAttribute('aria-hidden','true');
  }

  function hideLayoutControls(){
    hideElement(document.getElementById('nupGrid'));
    hideElement(document.getElementById('bookletRow'));
    hideElement(document.getElementById('nupQuickGuide'));
    document.querySelectorAll('.nup-popup').forEach(node=>node.remove());

    const section=document.querySelector('[data-sec="nup"]');
    const title=section?.querySelector('.sec-title');
    if(title&&/N\s*-?\s*up|N-UP/i.test(title.textContent||''))title.textContent='페이지 위치·크기 보정';

    document.querySelectorAll('#sb-nup label').forEach(label=>{
      if(/기본\s*N\s*-?\s*up|페이지당\s*슬라이드/i.test(label.textContent||''))hideElement(label);
    });

    // File-level N-up selectors are generated dynamically with the "배치:" label.
    document.querySelectorAll('#thumbArea span').forEach(label=>{
      if(String(label.textContent||'').trim()==='배치:')hideElement(label.parentElement);
    });

    // Per-page N-up affordances may be created after thumbnail rendering.
    document.querySelectorAll('#thumbArea [class*="nup"],#thumbArea [data-nup]').forEach(hideElement);
    document.querySelectorAll('#thumbArea [title],#thumbArea [aria-label]').forEach(node=>{
      const text=`${node.getAttribute('title')||''} ${node.getAttribute('aria-label')||''}`;
      if(/N\s*-?\s*up|N-UP|NUP|소책자\s*배치/i.test(text))hideElement(node);
    });
  }

  function applyBranding(){
    const sub=document.querySelector('.app > aside > .sub');
    if(sub&&/N\s*-?\s*up|N-UP|소책자/i.test(sub.textContent||'')){
      sub.textContent='페이지 편집 · 간지 · 머리말/꼬리말 · 워터마크 · 정밀 보정 · 인쇄용 PDF 저장';
    }
  }

  function apply(){
    if(applying||!isAdvanced())return false;
    applying=true;
    try{
      root.dataset.pdfEditorAdvancedScope='single-page-precision-v1';
      normalizeSinglePageLayout();
      hideLayoutControls();
      applyBranding();
      return true;
    }finally{applying=false;}
  }

  function installObserver(){
    if(observer||!document.body)return;
    observer=new MutationObserver(()=>apply());
    observer.observe(document.body,{childList:true,subtree:true,characterData:true});
  }

  document.addEventListener('change',event=>{
    if(!isAdvanced())return;
    const target=event.target;
    if(target?.id==='bookletCheck'||target?.closest?.('#nupGrid')||target?.closest?.('#thumbArea')){
      queueMicrotask(apply);
    }
  },true);

  function boot(){
    apply();
    installObserver();
    [80,220,500,900,1500,2400].forEach(delay=>setTimeout(apply,delay));
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();

  window.PdfEditorAdvancedProfileScope={
    apply,
    normalizeSinglePageLayout,
    stage:'advanced-single-page-precision-v1'
  };
})();