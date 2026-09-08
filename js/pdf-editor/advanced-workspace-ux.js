// Stable, compact workspace UX for the advanced PDF editor profile.
// Keeps the visible page anchored across preview rebuilds and places the most
// common editing actions within one fixed-height toolbar.
(function(){
  'use strict';
  if(window.__pdfAdvancedWorkspaceUxV1)return;
  window.__pdfAdvancedWorkspaceUxV1=true;

  const root=document.documentElement;
  const isAdvanced=()=>{
    if(root.dataset.pdfEditorProfile==='advanced')return true;
    const value=new URLSearchParams(String(location.search||'')).get('profile');
    return String(value||'').trim().toLowerCase()==='advanced';
  };
  if(!isAdvanced())return;

  const INSTALL_DELAYS=[0,80,180,360,700,1200,2000,3200,5000];
  const byId=id=>document.getElementById(id);
  let wrappedDisplay=null;
  let wrappedShowStatus=null;
  let wrappedHideStatus=null;
  let previewObserver=null;
  let sidebarObserver=null;
  let restoreTimers=[];
  let navigationUntil=0;
  let syncing=false;

  function pages(){
    try{return Array.isArray(parsedPages)?parsedPages:[];}catch(_){return[];}
  }

  function activePages(){return pages().filter(page=>!page?.excluded);}

  function selectedPage(){
    const hit=document.querySelector('.pdf-nup-adjust-hit[data-selected="true"]');
    const hitId=String(hit?.dataset?.pageId||'');
    if(hitId){
      const page=pages().find(item=>String(item?.id)===hitId);
      if(page)return page;
    }
    const current=document.querySelector('#thumbArea .thumb-wrap[data-sidebar-current="true"]');
    const thumbId=String(current?.closest?.('.thumb-item')?.dataset?.id||'');
    if(thumbId){
      const page=pages().find(item=>String(item?.id)===thumbId);
      if(page)return page;
    }
    return activePages()[0]||null;
  }

  function markNavigation(duration=900){
    navigationUntil=Math.max(navigationUntil,Date.now()+Math.max(0,Number(duration)||0));
  }

  function navigationActive(){return Date.now()<navigationUntil;}

  function forceSinglePageWorkspace(){
    try{if(typeof nup!=='undefined')nup=1;}catch(_){}
    try{if(typeof _previewPerRow!=='undefined')_previewPerRow=1;}catch(_){}
    const select=byId('perRowSelect');
    if(select){
      if(select.value!=='1')select.value='1';
      select.disabled=true;
      select.setAttribute('aria-hidden','true');
      select.tabIndex=-1;
    }
    root.dataset.pdfAdvancedSinglePageWorkspace='1';
  }

  function hideSection(name){
    const head=document.querySelector(`.sec-head[data-sec="${name}"]`);
    const section=head?.closest?.('.sec');
    if(!section)return;
    section.hidden=true;
    section.style.setProperty('display','none','important');
    section.setAttribute('aria-hidden','true');
  }

  function compactSidebar(){
    const nupSection=document.querySelector('.sec-head[data-sec="nup"]')?.closest?.('.sec');
    const pagesSection=byId('thumbSection');
    if(nupSection&&pagesSection&&nupSection.nextElementSibling!==pagesSection){
      pagesSection.parentElement?.insertBefore(nupSection,pagesSection);
    }

    const title=nupSection?.querySelector('.sec-title');
    if(title&&title.textContent!=='페이지 편집')title.textContent='페이지 편집';

    hideSection('paper');
    hideSection('edit');

    const uploadHead=document.querySelector('.sec-head[data-sec="upload"]');
    const uploadBody=byId('sb-upload');
    if(uploadHead&&uploadBody&&!uploadHead.dataset.advancedUxBound){
      uploadHead.dataset.advancedUxBound='1';
      uploadHead.addEventListener('click',()=>{uploadHead.dataset.advancedUserToggled='1';},true);
    }
    if(pages().length&&uploadHead&&uploadBody&&!uploadHead.dataset.advancedAutoCollapsed&&!uploadHead.dataset.advancedUserToggled){
      uploadHead.dataset.advancedAutoCollapsed='1';
      uploadHead.classList.add('collapsed');
      uploadBody.classList.add('hidden');
    }

    root.dataset.pdfAdvancedCompactSidebar='1';
  }

  function installStyles(){
    if(byId('pdfAdvancedWorkspaceUxStylesV1'))return;
    const style=document.createElement('style');
    style.id='pdfAdvancedWorkspaceUxStylesV1';
    style.textContent=`
      html[data-pdf-editor-profile="advanced"] .app{grid-template-columns:330px minmax(0,1fr)!important}
      html[data-pdf-editor-profile="advanced"] .app>aside{padding:12px!important;scrollbar-gutter:stable;overscroll-behavior:contain}
      html[data-pdf-editor-profile="advanced"] .app>main{padding:10px!important;gap:8px!important}
      html[data-pdf-editor-profile="advanced"] #thumbArea{max-height:136px!important;overflow:auto!important;overscroll-behavior:contain;scrollbar-gutter:stable}
      html[data-pdf-editor-profile="advanced"] #sb-pages{padding-bottom:8px!important}
      html[data-pdf-editor-profile="advanced"] .thumb-hint{position:sticky;bottom:0;background:#fff;padding-top:5px;z-index:2}
      html[data-pdf-editor-profile="advanced"] #perRowSelect,
      html[data-pdf-editor-profile="advanced"] #perRowSelect+span{display:none!important}
      html[data-pdf-editor-profile="advanced"] .preview-shell{padding:8px!important;gap:6px!important;border-radius:10px!important;min-height:0}
      html[data-pdf-editor-profile="advanced"] .preview-info{min-height:34px!important;height:34px!important;padding:5px 8px!important;border-radius:7px!important}
      html[data-pdf-editor-profile="advanced"] #previewScroll{scrollbar-gutter:stable both-edges;overscroll-behavior:contain;overflow-anchor:none!important;scroll-behavior:auto!important;padding:10px!important}
      html[data-pdf-editor-profile="advanced"] #previewScroll .preview-row{width:max-content;min-width:100%;justify-content:center!important;margin:8px 0!important}
      html[data-pdf-editor-profile="advanced"] #previewScroll .page-preview{scroll-margin:30px;transition:box-shadow .12s ease,outline-color .12s ease}
      html[data-pdf-editor-profile="advanced"] #previewScroll .pdf-nup-adjust-hit[data-selected="true"]{box-shadow:0 0 0 3px rgba(37,99,235,.16)!important}
      html[data-pdf-editor-profile="advanced"] #statusBar{display:flex!important;height:34px!important;min-height:34px!important;max-height:34px!important;padding:6px 10px!important;overflow:hidden!important;visibility:hidden;opacity:0;pointer-events:none;transition:opacity .12s ease}
      html[data-pdf-editor-profile="advanced"] #statusBar[data-advanced-visible="1"]{visibility:visible;opacity:1}
      html[data-pdf-editor-profile="advanced"] #statusBar span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      #pdfAdvancedQuickBarV1{height:36px;min-height:36px;display:flex;align-items:center;gap:5px;padding:4px 6px;border:1px solid #dbe3eb;border-radius:8px;background:rgba(255,255,255,.96);flex:0 0 auto;overflow-x:auto;overflow-y:hidden;scrollbar-width:thin}
      #pdfAdvancedQuickBarV1 .advanced-workspace-group{display:flex;align-items:center;gap:4px;flex:0 0 auto}
      #pdfAdvancedQuickBarV1 .advanced-workspace-sep{width:1px;height:20px;background:#e2e8f0;flex:0 0 auto}
      #pdfAdvancedQuickBarV1 button{height:26px;border:1px solid #cbd5e1;border-radius:6px;background:#fff;color:#334155;padding:0 8px;font:inherit;font-size:10px;font-weight:850;cursor:pointer;white-space:nowrap}
      #pdfAdvancedQuickBarV1 button:hover:not(:disabled){background:#eff6ff;border-color:#93c5fd;color:#1d4ed8}
      #pdfAdvancedQuickBarV1 button:disabled{opacity:.38;cursor:not-allowed}
      #pdfAdvancedQuickBarV1 button[data-active="true"]{background:#eff6ff;border-color:#2563eb;color:#1d4ed8}
      #pdfAdvancedQuickBarV1 .advanced-workspace-page{min-width:72px;text-align:center;font-size:10px;font-weight:900;color:#0f172a;white-space:nowrap}
      #pdfAdvancedQuickBarV1 .advanced-workspace-lock{margin-left:auto;display:flex;align-items:center;gap:4px;color:#64748b;font-size:9px;font-weight:800;white-space:nowrap}
      #pdfAdvancedQuickBarV1 .advanced-workspace-lock::before{content:'●';color:#10b981;font-size:8px}
      html[data-pdf-editor-profile="advanced"] #pdfNupPageAdjustPanelV1{margin-top:4px!important;padding:8px!important;border-color:#dbe3eb!important;box-shadow:none!important}
      html[data-pdf-editor-profile="advanced"] #pdfNupPageAdjustPanelV1 .pdf-nup-adjust-help{margin-top:5px!important;padding-top:5px!important}
      @media(max-width:900px){
        html[data-pdf-editor-profile="advanced"] .app{display:block!important}
        html[data-pdf-editor-profile="advanced"] .app>aside{max-height:none!important}
        html[data-pdf-editor-profile="advanced"] #thumbArea{max-height:112px!important}
        #pdfAdvancedQuickBarV1 .advanced-workspace-lock{display:none}
      }
    `;
    document.head.appendChild(style);
  }

  function centerAnchor(scroll){
    if(!scroll)return null;
    const wraps=[...scroll.querySelectorAll('.page-preview')];
    if(!wraps.length)return null;
    let wrap=document.querySelector('.pdf-nup-adjust-hit[data-selected="true"]')?.closest?.('.page-preview');
    if(!wrap||!scroll.contains(wrap)){
      const box=scroll.getBoundingClientRect();
      const centerY=box.top+Math.min(box.height,scroll.clientHeight||box.height)/2;
      let best=null;
      let bestDistance=Infinity;
      wraps.forEach(node=>{
        const rect=node.getBoundingClientRect();
        const distance=Math.abs((rect.top+rect.bottom)/2-centerY);
        if(distance<bestDistance){bestDistance=distance;best=node;}
      });
      wrap=best||wraps[0];
    }
    if(!wrap)return null;
    const box=scroll.getBoundingClientRect();
    const rect=wrap.getBoundingClientRect();
    return{
      outputIndex:String(wrap.dataset.outputIndex??''),
      domIndex:wraps.indexOf(wrap),
      offsetTop:rect.top-box.top,
      offsetLeft:rect.left-box.left,
    };
  }

  function viewportSnapshot(){
    const scroll=byId('previewScroll');
    if(!scroll)return null;
    return{
      scroll,
      top:Number(scroll.scrollTop||0),
      left:Number(scroll.scrollLeft||0),
      windowX:Number(window.scrollX||0),
      windowY:Number(window.scrollY||0),
      anchor:centerAnchor(scroll),
    };
  }

  function resolveAnchor(scroll,anchor){
    if(!scroll||!anchor)return null;
    const wraps=[...scroll.querySelectorAll('.page-preview')];
    if(anchor.outputIndex){
      const exact=wraps.find(node=>String(node.dataset.outputIndex??'')===anchor.outputIndex);
      if(exact)return exact;
    }
    return wraps[anchor.domIndex]||null;
  }

  function restoreViewport(snapshot){
    if(!snapshot||syncing||navigationActive())return false;
    syncing=true;
    try{
      const scroll=snapshot.scroll?.isConnected?snapshot.scroll:byId('previewScroll');
      if(scroll){
        scroll.scrollTop=snapshot.top;
        scroll.scrollLeft=snapshot.left;
        const anchor=resolveAnchor(scroll,snapshot.anchor);
        if(anchor&&snapshot.anchor){
          const box=scroll.getBoundingClientRect();
          const rect=anchor.getBoundingClientRect();
          const dy=(rect.top-box.top)-snapshot.anchor.offsetTop;
          const dx=(rect.left-box.left)-snapshot.anchor.offsetLeft;
          if(Math.abs(dy)>.5)scroll.scrollTop+=dy;
          if(Math.abs(dx)>.5)scroll.scrollLeft+=dx;
        }
      }
      if(Math.abs((window.scrollX||0)-snapshot.windowX)>.5||Math.abs((window.scrollY||0)-snapshot.windowY)>.5){
        window.scrollTo(snapshot.windowX,snapshot.windowY);
      }
      root.dataset.pdfAdvancedViewportRestored='1';
      return true;
    }finally{syncing=false;}
  }

  function clearRestoreTimers(){
    restoreTimers.forEach(timer=>clearTimeout(timer));
    restoreTimers=[];
  }

  function restoreBurst(snapshot){
    if(!snapshot)return;
    clearRestoreTimers();
    [0,16,42,90,160,280].forEach(delay=>{
      restoreTimers.push(setTimeout(()=>restoreViewport(snapshot),delay));
    });
    requestAnimationFrame(()=>restoreViewport(snapshot));
  }

  function wrapDisplayPreview(){
    const current=window.displayPreview;
    if(typeof current!=='function')return false;
    if(current.__pdfAdvancedWorkspaceStableV1){wrappedDisplay=current;return true;}
    const original=current;
    const wrapped=function advancedStableDisplayPreview(previewPages,autoFit){
      forceSinglePageWorkspace();
      const scroll=byId('previewScroll');
      const hadPreview=Boolean(scroll?.querySelector('.page-preview'));
      const snapshot=hadPreview&&!navigationActive()?viewportSnapshot():null;
      const result=original.call(this,previewPages,autoFit);
      if(snapshot)restoreBurst(snapshot);
      setTimeout(syncWorkspace,0);
      return result;
    };
    wrapped.__pdfAdvancedWorkspaceStableV1=true;
    wrapped.__pdfAdvancedWorkspaceOriginal=original;
    window.displayPreview=wrapped;
    try{displayPreview=wrapped;}catch(_){}
    wrappedDisplay=wrapped;
    return true;
  }

  function wrapStatusFunctions(){
    const currentShow=window.showStatus;
    if(typeof currentShow==='function'&&!currentShow.__pdfAdvancedWorkspaceStableV1){
      const original=currentShow;
      const wrapped=function stableStatusShow(){
        const result=original.apply(this,arguments);
        byId('statusBar')?.setAttribute('data-advanced-visible','1');
        return result;
      };
      wrapped.__pdfAdvancedWorkspaceStableV1=true;
      wrapped.__pdfAdvancedWorkspaceOriginal=original;
      window.showStatus=wrapped;
      try{showStatus=wrapped;}catch(_){}
      wrappedShowStatus=wrapped;
    }else if(currentShow?.__pdfAdvancedWorkspaceStableV1){wrappedShowStatus=currentShow;}

    const currentHide=window.hideStatus;
    if(typeof currentHide==='function'&&!currentHide.__pdfAdvancedWorkspaceStableV1){
      const original=currentHide;
      const wrapped=function stableStatusHide(){
        const result=original.apply(this,arguments);
        byId('statusBar')?.removeAttribute('data-advanced-visible');
        return result;
      };
      wrapped.__pdfAdvancedWorkspaceStableV1=true;
      wrapped.__pdfAdvancedWorkspaceOriginal=original;
      window.hideStatus=wrapped;
      try{hideStatus=wrapped;}catch(_){}
      wrappedHideStatus=wrapped;
    }else if(currentHide?.__pdfAdvancedWorkspaceStableV1){wrappedHideStatus=currentHide;}
  }

  function focusPage(page){
    if(!page)return Promise.resolve(false);
    markNavigation(1000);
    try{window.PdfNupPageAdjust?.selectPage?.(page);}catch(_){}

    let request=Promise.resolve(true);
    try{
      const lazy=window.PdfViewportLazyPreview;
      if(lazy?.isActive?.()){
        const descriptors=lazy.buildOutputDescriptors?.()||[];
        const index=lazy.descriptorIndexForPage?.(page,descriptors);
        if(Number.isFinite(Number(index))&&Number(index)>=0){
          request=Promise.resolve(lazy.requestRender?.(Number(index)));
        }
      }
    }catch(_){}

    return request.finally(()=>{
      const scrollToHit=()=>{
        const scroll=byId('previewScroll');
        if(!scroll)return;
        const escaped=window.CSS?.escape?CSS.escape(String(page.id)):String(page.id).replace(/"/g,'\\"');
        let target=scroll.querySelector(`.pdf-nup-adjust-hit[data-page-id="${escaped}"]`)?.closest('.page-preview');
        if(!target){
          const index=activePages().indexOf(page);
          target=[...scroll.querySelectorAll('.page-preview')][Math.max(0,index)]||null;
        }
        if(!target)return;
        const box=scroll.getBoundingClientRect();
        const rect=target.getBoundingClientRect();
        scroll.scrollTop+=rect.top-box.top-(scroll.clientHeight-rect.height)/2;
        scroll.scrollLeft+=rect.left-box.left-(scroll.clientWidth-rect.width)/2;
        root.dataset.pdfAdvancedUserNavigation='1';
      };
      requestAnimationFrame(()=>requestAnimationFrame(scrollToHit));
      setTimeout(scrollToHit,90);
    });
  }

  function stepPage(delta){
    const list=activePages();
    if(!list.length)return;
    const current=selectedPage();
    let index=list.indexOf(current);
    if(index<0)index=0;
    index=Math.max(0,Math.min(list.length-1,index+delta));
    focusPage(list[index]);
  }

  function proxyClick(id){
    const target=byId(id);
    if(!target||target.disabled)return false;
    target.click();
    return true;
  }

  function ensureQuickBar(){
    let bar=byId('pdfAdvancedQuickBarV1');
    if(bar)return bar;
    const scroll=byId('previewScroll');
    if(!scroll?.parentElement)return null;
    bar=document.createElement('div');
    bar.id='pdfAdvancedQuickBarV1';
    bar.setAttribute('role','toolbar');
    bar.setAttribute('aria-label','고급 편집 빠른 도구');
    bar.innerHTML=`
      <div class="advanced-workspace-group">
        <button type="button" id="pdfAdvancedPrevPageV1" title="이전 페이지">‹ 이전</button>
        <span class="advanced-workspace-page" id="pdfAdvancedPageLabelV1">페이지 - / -</span>
        <button type="button" id="pdfAdvancedNextPageV1" title="다음 페이지">다음 ›</button>
      </div>
      <span class="advanced-workspace-sep"></span>
      <div class="advanced-workspace-group">
        <button type="button" id="pdfAdvancedRotateLeftV1" title="왼쪽으로 90도 회전">↶ 회전</button>
        <button type="button" id="pdfAdvancedRotateRightV1" title="오른쪽으로 90도 회전">↷ 회전</button>
        <button type="button" id="pdfAdvancedCropV1" title="선택 페이지 자르기">자르기</button>
      </div>
      <span class="advanced-workspace-sep"></span>
      <div class="advanced-workspace-group">
        <button type="button" id="pdfAdvancedUndoV1" title="실행 취소 (Ctrl+Z)">실행취소</button>
        <button type="button" id="pdfAdvancedRedoV1" title="다시 실행 (Ctrl+Y)">다시실행</button>
      </div>
      <span class="advanced-workspace-lock">작업 위치 고정</span>`;
    scroll.parentElement.insertBefore(bar,scroll);

    byId('pdfAdvancedPrevPageV1')?.addEventListener('click',()=>stepPage(-1));
    byId('pdfAdvancedNextPageV1')?.addEventListener('click',()=>stepPage(1));
    byId('pdfAdvancedRotateLeftV1')?.addEventListener('click',()=>proxyClick('pdfPageRotateLeftV1'));
    byId('pdfAdvancedRotateRightV1')?.addEventListener('click',()=>proxyClick('pdfPageRotateRightV1'));
    byId('pdfAdvancedCropV1')?.addEventListener('click',()=>proxyClick('pdfPageCropToggleV1'));
    byId('pdfAdvancedUndoV1')?.addEventListener('click',()=>window.PdfPrecisionEditTools?.history?.undo?.());
    byId('pdfAdvancedRedoV1')?.addEventListener('click',()=>window.PdfPrecisionEditTools?.history?.redo?.());
    return bar;
  }

  function syncQuickBar(){
    ensureQuickBar();
    const list=activePages();
    const current=selectedPage();
    const index=current?list.indexOf(current):-1;
    const prev=byId('pdfAdvancedPrevPageV1');
    const next=byId('pdfAdvancedNextPageV1');
    if(prev)prev.disabled=index<=0;
    if(next)next.disabled=index<0||index>=list.length-1;
    const label=byId('pdfAdvancedPageLabelV1');
    if(label)label.textContent=index>=0?`페이지 ${index+1} / ${list.length}`:`페이지 - / ${list.length}`;
    const disabled=!current;
    ['pdfAdvancedRotateLeftV1','pdfAdvancedRotateRightV1','pdfAdvancedCropV1'].forEach(id=>{const node=byId(id);if(node)node.disabled=disabled;});
    const crop=byId('pdfAdvancedCropV1');
    if(crop)crop.dataset.active=String(byId('pdfPageCropToggleV1')?.dataset?.active==='true');
    const history=window.PdfPrecisionEditTools?.history;
    const undo=byId('pdfAdvancedUndoV1');
    const redo=byId('pdfAdvancedRedoV1');
    if(undo)undo.disabled=!Number(history?.undoCount||0);
    if(redo)redo.disabled=!Number(history?.redoCount||0);
  }

  function installObservers(){
    const scroll=byId('previewScroll');
    if(scroll&&previewObserver?.__target!==scroll){
      previewObserver?.disconnect?.();
      previewObserver=new MutationObserver(()=>requestAnimationFrame(syncQuickBar));
      previewObserver.__target=scroll;
      previewObserver.observe(scroll,{childList:true,subtree:true,attributes:true,attributeFilter:['data-selected','data-active','data-output-index']});
    }
    const aside=document.querySelector('.app>aside');
    if(aside&&sidebarObserver?.__target!==aside){
      sidebarObserver?.disconnect?.();
      sidebarObserver=new MutationObserver(()=>requestAnimationFrame(()=>{compactSidebar();syncQuickBar();}));
      sidebarObserver.__target=aside;
      sidebarObserver.observe(aside,{childList:true,subtree:true});
    }
  }

  function installEvents(){
    if(root.dataset.pdfAdvancedWorkspaceEvents==='1')return;
    root.dataset.pdfAdvancedWorkspaceEvents='1';
    document.addEventListener('click',event=>{
      if(event.target?.closest?.('#thumbArea .thumb-wrap,#pdfLazyPreviewNav'))markNavigation(1000);
      if(event.target?.closest?.('.pdf-nup-adjust-hit'))setTimeout(syncQuickBar,0);
      if(event.target?.closest?.('#pdfPageCropToggleV1,#pdfPageRotateLeftV1,#pdfPageRotateRightV1,#pdfPageCropResetV1'))setTimeout(syncQuickBar,0);
    },true);
    document.addEventListener('input',event=>{
      if(event.target?.closest?.('#pdfNupPageAdjustPanelV1'))setTimeout(syncQuickBar,0);
    },true);
    document.addEventListener('pdf-import-committed',()=>setTimeout(()=>{compactSidebar();forceSinglePageWorkspace();syncQuickBar();},0));
    window.addEventListener('resize',()=>{if(!navigationActive())restoreBurst(viewportSnapshot());},{passive:true});
  }

  function syncWorkspace(){
    installStyles();
    forceSinglePageWorkspace();
    compactSidebar();
    ensureQuickBar();
    syncQuickBar();
    installObservers();
    root.dataset.pdfAdvancedWorkspaceUx='stable-single-page-v1';
  }

  function install(){
    if(!isAdvanced())return;
    syncWorkspace();
    wrapStatusFunctions();
    wrapDisplayPreview();
    installEvents();
  }

  window.PdfEditorAdvancedWorkspaceUX={
    sync:syncWorkspace,
    snapshot:viewportSnapshot,
    restore:restoreViewport,
    focusPage,
    markNavigation,
    stage:'stable-single-page-workspace-v1',
  };

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();
  for(const delay of INSTALL_DELAYS)setTimeout(install,delay);
})();
