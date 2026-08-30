// PDF editor: one sidebar, every control visible, no step/work-panel filtering.
(function(){
  'use strict';
  if(window.__pdfEditorSimpleSidebarUiV1)return;
  window.__pdfEditorSimpleSidebarUiV1=true;
  const path=(location.pathname||'/').replace(/\/+$/,'')||'/';
  if(path!=='/pdf-editor'&&path!=='/pdf-editor/index.html'&&!path.endsWith('/pdf-editor/index.html'))return;

  window.__programStudioEditorToolRailV1=true;
  window.__pdfEditorWorkflowV2=true;
  let frame=0,observer=null;

  function installStyles(){
    if(document.getElementById('pdfSimpleSidebarUiStyles'))return;
    const style=document.createElement('style');
    style.id='pdfSimpleSidebarUiStyles';
    style.textContent=`
      body[data-program-kind="pdf-editor"] .app{grid-template-columns:360px minmax(0,1fr)!important;background:#eef2f5!important}
      body[data-program-kind="pdf-editor"] .app>aside:first-of-type{width:auto!important;min-width:0!important;padding:12px!important;background:#f8fafc!important;border-right:1px solid #dbe4ec!important;overflow-y:auto!important;scrollbar-gutter:stable}
      body[data-program-kind="pdf-editor"] .app>main{grid-column:2!important;padding:12px!important;background:#e9eef2!important}
      body[data-program-kind="pdf-editor"] .program-local-actions{display:flex!important;align-items:center!important;gap:5px!important;flex-wrap:nowrap!important;overflow:hidden!important;width:100%!important;margin:0 0 10px!important;white-space:nowrap!important}
      body[data-program-kind="pdf-editor"] .program-local-actions>a,body[data-program-kind="pdf-editor"] .program-local-actions>button{min-width:0!important;min-height:30px!important;padding:5px 7px!important;font-size:9px!important;line-height:1!important;flex:0 1 auto!important;white-space:nowrap!important}
      body[data-program-kind="pdf-editor"] .program-local-actions>.nav-back{flex:0 0 auto!important}
      body[data-program-kind="pdf-editor"] .program-local-actions>#navSessionBtn,body[data-program-kind="pdf-editor"] .program-local-actions>#navSessionLoadBtn{flex:1 1 auto!important}
      body[data-program-kind="pdf-editor"] .program-local-actions>.program-account-name{display:none!important}
      body[data-program-kind="pdf-editor"] .program-local-actions>#navLogout{flex:0 0 32px!important;width:32px!important;height:30px!important;padding:0!important;font-size:0!important;gap:0!important}
      body[data-program-kind="pdf-editor"] .program-local-actions>#navLogout svg{width:15px!important;height:15px!important;margin:0!important}
      body[data-program-kind="pdf-editor"] .sec{display:block!important;position:relative!important;bottom:auto!important;margin:0 0 8px!important;padding:0!important;border:1px solid #dde5ed!important;border-radius:11px!important;background:#fff!important;overflow:hidden!important;box-shadow:0 1px 2px rgba(15,23,42,.025)!important}
      body[data-program-kind="pdf-editor"] .sec-head{cursor:default!important;padding:10px 11px!important;background:#f9fbfd!important;border-bottom:1px solid #eef2f6!important}
      body[data-program-kind="pdf-editor"] .sec-head .sec-title{font-size:10.5px!important;color:#35475b!important;letter-spacing:0!important;text-transform:none!important}
      body[data-program-kind="pdf-editor"] .sec-head .sec-arrow{display:none!important}
      body[data-program-kind="pdf-editor"] .sec-body,body[data-program-kind="pdf-editor"] .sec-body.hidden{display:block!important;padding:10px 11px 11px!important}
      body[data-program-kind="pdf-editor"] #thumbSection[style*="display:none"]{display:none!important}
      body[data-program-kind="pdf-editor"] .ps-tool-sidebar-shell{display:block!important;height:auto!important;min-height:0!important;background:transparent!important}
      body[data-program-kind="pdf-editor"] .ps-tool-sidebar-shell>.ps-tool-panel{display:block!important;min-height:0!important;overflow:visible!important;padding:0!important;background:transparent!important}
      body[data-program-kind="pdf-editor"] .ps-sidebar-toggle,body[data-program-kind="pdf-editor"] .ps-tool-rail,body[data-program-kind="pdf-editor"] .ps-tool-panel-head,body[data-program-kind="pdf-editor"] #pdfWorkflowHead,body[data-program-kind="pdf-editor"] #pdfResultBar,body[data-program-kind="pdf-editor"] #pdfOutputRail,body[data-program-kind="pdf-editor"] #pdfEditorWorkflowV2,body[data-program-kind="pdf-editor"] #pdfEditorWorkflowErrorV2,body[data-program-kind="pdf-editor"] #pdfOutputSummaryV2{display:none!important}
      @media(max-width:980px){body[data-program-kind="pdf-editor"]{overflow:auto!important}body[data-program-kind="pdf-editor"] .app{grid-template-columns:1fr!important;height:auto!important;min-height:100vh!important}body[data-program-kind="pdf-editor"] .app>aside:first-of-type,body[data-program-kind="pdf-editor"] .app>main{grid-column:1!important;width:100%!important;height:auto!important;position:relative!important;overflow:visible!important}}
    `;
    document.head.appendChild(style);
  }

  function neutralizeToolRail(){
    const sidebar=document.querySelector('.app>aside:first-of-type');
    const shell=sidebar?.querySelector(':scope>.ps-tool-sidebar-shell');
    if(!sidebar||!shell)return;

    // A late legacy tool-rail may already own MutationObservers that move direct
    // sidebar children back into its panel. Removing that shell would then let
    // those observers move every restored section into a detached node. Keep the
    // containment alive, force its own state to "all", and flatten it visually.
    try{window.ProgramStudioEditorToolRail?.showAll?.();}catch(error){console.warn('[pdf-sidebar] legacy tool rail showAll failed',error);}
    const panel=shell.querySelector('.ps-tool-panel');
    if(panel){
      [...panel.children].forEach(node=>{
        if(!(node instanceof HTMLElement)||node.classList.contains('ps-tool-panel-head'))return;
        node.hidden=false;
        node.removeAttribute('data-ps-tool-step');
      });
    }
    shell.dataset.pdfSidebarLegacyContainment='1';
    sidebar.classList.remove('ps-sidebar-collapsed');
    document.getElementById('programStudioEditorToolRailV1Styles')?.remove();
  }

  function restoreOutputRail(){
    const app=document.querySelector('.app'),sidebar=app?.querySelector('aside:first-of-type'),rail=document.getElementById('pdfOutputRail');
    if(!app||!sidebar||!rail)return;
    [...rail.children].filter(node=>node.classList?.contains('sec')).forEach(node=>sidebar.appendChild(node));
    rail.remove();
    const main=app.querySelector('main');if(main)main.style.gridColumn='';
  }

  function removeLegacyUi(){
    document.querySelectorAll('.ps-sidebar-toggle,#pdfWorkflowHead,#pdfResultBar,#pdfEditorWorkflowV2,#pdfEditorWorkflowErrorV2,#pdfOutputSummaryV2').forEach(node=>node.remove());
    const sidebar=document.querySelector('.app>aside:first-of-type');
    sidebar?.classList.remove('ps-sidebar-collapsed');
    sidebar?.removeAttribute('aria-hidden');
    document.documentElement.classList.remove('ps-sidebar-collapsed');
    document.body?.classList.remove('ps-sidebar-collapsed');
    document.body?.removeAttribute('data-pdf-workflow');
    document.body?.removeAttribute('data-pdf-workspace');
    document.documentElement.removeAttribute('data-pdf-workflow-ui');
    document.documentElement.removeAttribute('data-pdf-workspace-layout');
    document.documentElement.dataset.pdfAdvanced='1';
    try{
      localStorage.removeItem('program-studio:pdf-editor:sidebar-collapsed');
      localStorage.removeItem('program-studio:sidebar:pdf-editor');
      localStorage.setItem('program-studio:pdf-editor:advanced','1');
    }catch(_){}
  }

  function keepSectionsOpen(){
    document.querySelectorAll('.app>aside .sec').forEach(sec=>{
      sec.hidden=false;
      sec.classList.remove('pdf-step-section','pdf-advanced-section','pdf-output-dock-v2','ps-tool-source','ps-tool-context-hidden');
      sec.removeAttribute('data-pdf-step');
      sec.removeAttribute('data-ps-tool-step');
      const head=sec.querySelector(':scope>.sec-head'),body=sec.querySelector(':scope>.sec-body');
      head?.classList.remove('collapsed');body?.classList.remove('hidden');
      if(head){head.setAttribute('aria-expanded','true');head.removeAttribute('role');}
    });
    const hint=document.querySelector('.thumb-hint');
    if(hint&&hint.textContent.includes('클릭=제외'))hint.textContent='클릭=미리보기 이동 · 드래그=순서변경 · 배지=개별설정';
  }

  function compactLogout(){
    const logout=document.getElementById('navLogout');if(!logout)return;
    logout.title='로그아웃';logout.setAttribute('aria-label','로그아웃');
    logout.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 17l5-5-5-5M15 12H3M14 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5"/></svg>';
  }

  function sync(){
    observer?.disconnect?.();
    try{installStyles();neutralizeToolRail();restoreOutputRail();removeLegacyUi();keepSectionsOpen();compactLogout();document.body.dataset.pdfSidebarMode='all-visible';document.documentElement.dataset.pdfSimpleSidebarUi='1';}
    finally{observer?.observe(document.querySelector('.app')||document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style','hidden','aria-hidden']});}
  }

  function blockToggle(event){
    const head=event.target.closest?.('.app>aside .sec-head');if(!head)return;
    event.preventDefault();event.stopImmediatePropagation();
    head.classList.remove('collapsed');head.parentElement?.querySelector(':scope>.sec-body')?.classList.remove('hidden');
  }
  function queue(){if(frame)return;frame=requestAnimationFrame(()=>{frame=0;sync();});}
  function boot(){if(typeof MutationObserver==='function')observer=new MutationObserver(queue);document.addEventListener('click',blockToggle,true);sync();[80,220,600,1200,2200].forEach(delay=>setTimeout(queue,delay));}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();

  const api={sync,stage:'single-sidebar-all-controls-visible-v3'};
  window.PdfEditorSimpleSidebarUi=api;window.PdfEditorWorkflowUi=api;window.PdfEditorWorkspaceLayout=api;
})();