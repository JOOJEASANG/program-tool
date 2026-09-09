// Focused preview mode for the standard PDF layout editor.
// Keeps the full document model/export intact while rendering only the current
// output neighborhood once a job is large enough to make full redraws costly.
(function(){
  'use strict';
  if(window.__pdfLayoutSmoothPreviewV1)return;

  const root=document.documentElement;
  const path=String(location.pathname||'').replace(/\/+$/,'');
  let advanced=false;
  try{advanced=String(new URLSearchParams(String(location.search||'')).get('profile')||'').toLowerCase()==='advanced';}catch(_){}
  advanced=advanced||root.dataset.pdfEditorProfile==='advanced'||path.endsWith('/pdf-editor-advanced');
  if(advanced||!path.includes('/pdf-editor'))return;
  window.__pdfLayoutSmoothPreviewV1=true;

  const MIN_FOCUSED_PAGE_COUNT=8;
  const INSTALL_DELAYS=[0,80,180,360,700,1200,2200,4000];
  const byId=id=>document.getElementById(id);
  let aggregateWrapped=false;
  let infoObserver=null;
  let installFrame=0;

  function pages(){
    if(Array.isArray(window.parsedPages))return window.parsedPages;
    try{return typeof parsedPages!=='undefined'&&Array.isArray(parsedPages)?parsedPages:[];}catch(_){return[];}
  }

  function activePageCount(){return pages().filter(page=>!page?.excluded).length;}
  function shouldFocus(){return activePageCount()>=MIN_FOCUSED_PAGE_COUNT;}

  function installStyles(){
    if(byId('pdfLayoutSmoothPreviewStylesV1'))return;
    const style=document.createElement('style');
    style.id='pdfLayoutSmoothPreviewStylesV1';
    style.textContent=`
      html[data-pdf-layout-focused-preview="true"] #previewScroll{scroll-behavior:auto}
      html[data-pdf-layout-focused-preview="true"] #pdfLazyPreviewNav{background:#f8fafc;border-color:#dbe5ee}
      html[data-pdf-layout-focused-preview="true"] #pdfLazyPreviewNav .lazy-preview-range{color:#526174}
      html[data-pdf-layout-focused-preview="true"] #thumbArea .thumb-item{contain:layout style paint}
    `;
    document.head.appendChild(style);
  }

  function syncLabels(){
    if(root.dataset.pdfLayoutFocusedPreview!=='true')return;
    const info=byId('previewInfo');
    if(info&&(/대용량 작업 미리보기/.test(info.textContent)||/선택한 페이지 주변만 실제 표시/.test(info.textContent))){
      info.textContent='빠른 배치 미리보기 · 현재 출력면 주변만 표시';
    }
    const nav=byId('pdfLazyPreviewNav');
    if(nav){
      nav.setAttribute('aria-label','PDF 배치 미리보기 이동');
      const range=byId('pdfLazyPreviewRange');
      if(range&&range.textContent==='주변 출력면만 표시')range.textContent='현재 출력면 주변만 표시';
    }
  }

  function applyFocusedMode(){
    const enabled=shouldFocus();
    if(!enabled){
      delete root.dataset.pdfLayoutFocusedPreview;
      return false;
    }
    // PdfViewportLazyPreview already owns bounded rendering. Fast mode simply
    // asks that existing, export-safe path to be used for normal layout jobs.
    window.__pdfEditorFastMode=true;
    if(!window.__pdfEditorExtremeMode){
      window.__pdfEditorFastModeReason='빠른 배치 미리보기 · 현재 출력면 주변만 렌더링';
    }
    root.dataset.pdfLayoutFocusedPreview='true';
    const hint=byId('livePreviewHint');
    if(hint){
      hint.textContent='빠른 배치 미리보기 ON';
      hint.style.color='#2563eb';
    }
    syncLabels();
    return true;
  }

  function wrapAggregateMode(){
    const api=window.PdfUploadOptimization;
    const current=api?.syncAggregateMode;
    if(typeof current!=='function')return false;
    if(current.__pdfLayoutFocusedPreviewV1){aggregateWrapped=true;return true;}
    const original=current.bind(api);
    const wrapped=function layoutFocusedAggregate(){
      const result=original.apply(this,arguments)||{};
      const focused=applyFocusedMode();
      return{...result,layoutFocusedPreview:focused};
    };
    wrapped.__pdfLayoutFocusedPreviewV1=true;
    wrapped.__pdfLayoutFocusedPreviewOriginal=current;
    api.syncAggregateMode=wrapped;
    aggregateWrapped=true;
    return true;
  }

  function ensureInfoObserver(){
    const info=byId('previewInfo');
    if(!info||infoObserver?.__target===info)return;
    infoObserver?.disconnect?.();
    infoObserver=new MutationObserver(()=>requestAnimationFrame(syncLabels));
    infoObserver.__target=info;
    infoObserver.observe(info,{childList:true,subtree:true,characterData:true});
  }

  function renderFocusedCurrent(){
    if(!applyFocusedMode())return false;
    const lazy=window.PdfViewportLazyPreview;
    if(typeof lazy?.requestRender!=='function')return false;
    const index=typeof lazy.getCurrentOutputIndex==='function'?lazy.getCurrentOutputIndex():0;
    Promise.resolve(lazy.requestRender(index)).catch(error=>console.warn('[pdf-layout-smooth] focused preview refresh failed',error));
    return true;
  }

  function install(){
    installFrame=0;
    installStyles();
    wrapAggregateMode();
    ensureInfoObserver();
    if(shouldFocus())applyFocusedMode();
    root.dataset.pdfLayoutSmoothPreview=aggregateWrapped?'ready':'waiting';
  }

  function queueInstall(){
    if(installFrame)return;
    installFrame=requestAnimationFrame(install);
  }

  document.addEventListener('pdf-import-committed',()=>{
    install();
    setTimeout(renderFocusedCurrent,0);
    setTimeout(renderFocusedCurrent,160);
  });

  document.addEventListener('change',event=>{
    if(event.target?.closest?.('#nupGrid')||event.target?.id==='bookletCheck'){
      if(shouldFocus())setTimeout(renderFocusedCurrent,0);
    }
  },true);

  window.addEventListener('resize',()=>{if(shouldFocus())syncLabels();},{passive:true});

  const bodyObserver=new MutationObserver(queueInstall);
  if(document.body)bodyObserver.observe(document.body,{childList:true,subtree:true});
  else document.addEventListener('DOMContentLoaded',()=>bodyObserver.observe(document.body,{childList:true,subtree:true}),{once:true});

  window.PdfLayoutSmoothPreview={
    apply:applyFocusedMode,
    refresh:renderFocusedCurrent,
    shouldFocus,
    get threshold(){return MIN_FOCUSED_PAGE_COUNT;},
    stage:'layout-focused-window-preview-v1',
  };

  install();
  for(const delay of INSTALL_DELAYS)setTimeout(install,delay);
})();