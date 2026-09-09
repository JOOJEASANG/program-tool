// Advanced editor profile scope.
// Keeps the dedicated advanced editor focused on single-page precision editing
// while N-up, booklet, blank-page insertion and divider creation stay out of
// this profile. The default PDF editor keeps those features unchanged.
(function(){
  'use strict';
  if(window.__pdfEditorAdvancedProfileScopeV1)return;
  window.__pdfEditorAdvancedProfileScopeV1=true;

  const root=document.documentElement;
  const isAdvanced=()=>{
    if(root.dataset.pdfEditorProfile==='advanced')return true;
    if(String(location.pathname||'').replace(/\/+$/,'').endsWith('/pdf-editor-advanced'))return true;
    const value=new URLSearchParams(String(location.search||'')).get('profile');
    return String(value||'').trim().toLowerCase()==='advanced';
  };
  if(!isAdvanced())return;

  const BLOCKED_ACTION_PATTERN=/(빈\s*페이지\s*(삽입|추가)|간지\s*(삽입|추가)|N\s*-?\s*up|N-UP|NUP|소책자)/i;
  const ADVANCED_SUBTITLE='파일 업로드 · 페이지 정렬/삭제 · 자르기/회전 · 위치/크기 보정 · PDF 저장';
  let observer=null;
  let applying=false;

  function pages(){
    if(Array.isArray(window.parsedPages))return window.parsedPages;
    try{return typeof parsedPages!=='undefined'&&Array.isArray(parsedPages)?parsedPages:[];}catch(_){return[];}
  }

  function hideElement(node){
    if(!node)return;
    node.hidden=true;
    node.style.setProperty('display','none','important');
    node.setAttribute('aria-hidden','true');
  }

  function installMinimalProfileStyles(){
    if(document.getElementById('pdfAdvancedMinimalProfileStylesV1'))return;
    const style=document.createElement('style');
    style.id='pdfAdvancedMinimalProfileStylesV1';
    style.textContent=`
      html[data-pdf-editor-profile="advanced"] .prev-ins-zone,
      html[data-pdf-editor-profile="advanced"] .prev-ins-zone-v,
      html[data-pdf-editor-profile="advanced"] .mode-btn[data-mode="break"],
      html[data-pdf-editor-profile="advanced"] #dividerModal,
      html[data-pdf-editor-profile="advanced"] #nupGrid,
      html[data-pdf-editor-profile="advanced"] #bookletRow,
      html[data-pdf-editor-profile="advanced"] #nupQuickGuide,
      html[data-pdf-editor-profile="advanced"] #fileLayoutControl,
      html[data-pdf-editor-profile="advanced"] #pdfSpreadSplitPanel,
      html[data-pdf-editor-profile="advanced"] #pdfPrintWorkflowFocusPanel,
      html[data-pdf-editor-profile="advanced"] #pdfPrintUtilityRedirectCard,
      html[data-pdf-editor-profile="advanced"] #sb-nup > .field:nth-of-type(2){
        display:none!important;
      }
      html[data-pdf-editor-profile="advanced"] #sb-nup > .field:first-of-type > label{
        display:none!important;
      }
    `;
    document.head.appendChild(style);
  }

  function normalizeSinglePageLayout(){
    try{if(typeof nup!=='undefined')nup=1;}catch(_){ }
    try{
      if(typeof fileNupMap!=='undefined'&&fileNupMap&&typeof fileNupMap==='object'){
        Object.keys(fileNupMap).forEach(key=>delete fileNupMap[key]);
      }
    }catch(_){ }
    pages().forEach(page=>{
      // Existing blank/divider pages are part of the user's document. Preserve
      // them, but do not expose controls that create new ones in advanced mode.
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

  function hideLayoutControls(){
    hideElement(document.getElementById('nupGrid'));
    hideElement(document.getElementById('bookletRow'));
    hideElement(document.getElementById('nupQuickGuide'));
    hideElement(document.getElementById('pdfSpreadSplitPanel'));
    hideElement(document.getElementById('pdfPrintWorkflowFocusPanel'));
    hideElement(document.getElementById('pdfPrintUtilityRedirectCard'));
    document.querySelectorAll('.nup-popup').forEach(node=>node.remove());

    const section=document.querySelector('[data-sec="nup"]');
    const title=section?.querySelector('.sec-title')||section?.closest('.sec')?.querySelector('.sec-title');
    if(title)title.textContent='페이지 위치·크기 보정';

    const fields=[...document.querySelectorAll('#sb-nup > .field')];
    fields.forEach(field=>{
      const label=field.querySelector(':scope > label');
      const text=String(label?.textContent||'');
      if(/슬라이드\s*순서/i.test(text)){hideElement(field);return;}
      if(/기본\s*N\s*-?\s*up|페이지당\s*슬라이드/i.test(text))hideElement(label);
    });

    document.querySelectorAll('#thumbArea span').forEach(label=>{
      if(String(label.textContent||'').trim()==='배치:')hideElement(label.parentElement);
    });

    document.querySelectorAll('#thumbArea [class*="nup"],#thumbArea [data-nup]').forEach(hideElement);
    document.querySelectorAll('#thumbArea [title],#thumbArea [aria-label]').forEach(node=>{
      const text=`${node.getAttribute('title')||''} ${node.getAttribute('aria-label')||''}`;
      if(/N\s*-?\s*up|N-UP|NUP|소책자\s*배치/i.test(text))hideElement(node);
    });
  }

  function hideInsertAndDividerControls(){
    document.querySelectorAll('.prev-ins-zone,.prev-ins-zone-v').forEach(hideElement);
    hideElement(document.getElementById('dividerModal'));
    hideElement(document.querySelector('.mode-btn[data-mode="break"]'));

    // The thumbnail context menu is rebuilt dynamically, so filter it every
    // time the profile observer sees a DOM change. Keep rotate/delete actions.
    document.querySelectorAll('#thumbCtxMenu .ctx-item').forEach(item=>{
      if(BLOCKED_ACTION_PATTERN.test(String(item.textContent||'')))hideElement(item);
    });

    // Defensive filtering for dynamically injected insert buttons. Restrict
    // this to interactive controls so labels for existing blank/divider pages
    // remain visible and the user's document is never silently altered.
    document.querySelectorAll('#previewScroll button,#thumbArea button,aside button').forEach(button=>{
      const text=`${button.textContent||''} ${button.getAttribute('title')||''} ${button.getAttribute('aria-label')||''}`;
      if(BLOCKED_ACTION_PATTERN.test(text))hideElement(button);
    });
  }

  function applyBranding(){
    const sub=document.querySelector('.app > aside > .sub');
    if(sub&&String(sub.textContent||'')!==ADVANCED_SUBTITLE)sub.textContent=ADVANCED_SUBTITLE;
  }

  function apply(){
    if(applying||!isAdvanced())return false;
    applying=true;
    try{
      root.dataset.pdfEditorAdvancedScope='single-page-precision-v1';
      root.dataset.pdfEditorAdvancedMinimal='1';
      installMinimalProfileStyles();
      normalizeSinglePageLayout();
      hideLayoutControls();
      hideInsertAndDividerControls();
      applyBranding();
      return true;
    }finally{
      applying=false;
    }
  }

  function installObserver(){
    if(observer||!document.body)return;
    observer=new MutationObserver(()=>apply());
    observer.observe(document.body,{childList:true,subtree:true});
  }

  // Even if a legacy control is briefly inserted before MutationObserver runs,
  // do not let a blocked creation/layout action execute in advanced mode.
  document.addEventListener('click',event=>{
    if(!isAdvanced())return;
    const target=event.target;
    const insertZone=target?.closest?.('.prev-ins-zone,.prev-ins-zone-v,.mode-btn[data-mode="break"]');
    const menuItem=target?.closest?.('#thumbCtxMenu .ctx-item');
    const text=menuItem?String(menuItem.textContent||''):'';
    if(insertZone||(menuItem&&BLOCKED_ACTION_PATTERN.test(text))){
      event.preventDefault();
      event.stopImmediatePropagation();
      apply();
    }
  },true);

  document.addEventListener('change',event=>{
    const target=event.target;
    if(target?.id==='bookletCheck'||target?.closest?.('#nupGrid')||target?.closest?.('#thumbArea')){
      setTimeout(apply,0);
    }
  },true);

  function boot(){
    root.dataset.pdfEditorProfile='advanced';
    apply();
    installObserver();
    [80,220,500,900,1500,2400].forEach(delay=>setTimeout(apply,delay));
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();

  window.PdfEditorAdvancedProfileScope={
    apply,
    normalizeSinglePageLayout,
    stage:'advanced-single-page-precision-v1',
    minimal:true
  };
})();
