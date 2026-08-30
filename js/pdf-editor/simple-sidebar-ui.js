// PDF editor: keep every control visible in one sidebar and remove step filtering.
(function(){
  'use strict';
  if(window.__pdfEditorSimpleSidebarUiV1)return;
  window.__pdfEditorSimpleSidebarUiV1=true;

  const path=(location.pathname||'/').replace(/\/+$/,'')||'/';
  if(path!=='/pdf-editor'&&path!=='/pdf-editor/index.html'&&!path.endsWith('/pdf-editor/index.html'))return;

  // Prevent the shared compact tool rail from mounting on this editor.
  window.__programStudioEditorToolRailV1=true;

  let frame=0;
  let observer=null;

  function installStyles(){
    if(document.getElementById('pdfSimpleSidebarUiStyles'))return;
    const style=document.createElement('style');
    style.id='pdfSimpleSidebarUiStyles';
    style.textContent=`
      body[data-program-kind="pdf-editor"] .app{
        grid-template-columns:360px minmax(0,1fr)!important;
        background:#eef2f5!important;
      }
      body[data-program-kind="pdf-editor"] .app>aside:first-of-type{
        width:auto!important;min-width:0!important;padding:12px!important;
        background:#f8fafc!important;border-right:1px solid #dbe4ec!important;
        overflow-y:auto!important;scrollbar-gutter:stable;
      }
      body[data-program-kind="pdf-editor"] .app>main{
        grid-column:2!important;padding:12px!important;background:#e9eef2!important;
      }
      body[data-program-kind="pdf-editor"] .program-local-actions{
        display:flex!important;align-items:center!important;gap:5px!important;
        flex-wrap:nowrap!important;overflow:hidden!important;width:100%!important;
        margin:0 0 10px!important;white-space:nowrap!important;
      }
      body[data-program-kind="pdf-editor"] .program-local-actions>a,
      body[data-program-kind="pdf-editor"] .program-local-actions>button{
        min-width:0!important;min-height:30px!important;padding:5px 7px!important;
        font-size:9px!important;line-height:1!important;flex:0 1 auto!important;
        white-space:nowrap!important;
      }
      body[data-program-kind="pdf-editor"] .program-local-actions>.nav-back{flex:0 0 auto!important;}
      body[data-program-kind="pdf-editor"] .program-local-actions>#navSessionBtn,
      body[data-program-kind="pdf-editor"] .program-local-actions>#navSessionLoadBtn{flex:1 1 auto!important;}
      body[data-program-kind="pdf-editor"] .program-local-actions>.program-account-name{display:none!important;}
      body[data-program-kind="pdf-editor"] .program-local-actions>#navLogout{
        flex:0 0 32px!important;width:32px!important;height:30px!important;
        padding:0!important;font-size:0!important;gap:0!important;
      }
      body[data-program-kind="pdf-editor"] .program-local-actions>#navLogout svg{
        width:15px!important;height:15px!important;margin:0!important;
      }
      body[data-program-kind="pdf-editor"] .sec{
        display:block!important;margin:0 0 8px!important;border:1px solid #dde5ed!important;
        border-radius:11px!important;background:#fff!important;overflow:hidden!important;
        box-shadow:0 1px 2px rgba(15,23,42,.025)!important;
      }
      body[data-program-kind="pdf-editor"] .sec-head{
        cursor:default!important;pointer-events:auto!important;padding:10px 11px!important;
        background:#f9fbfd!important;border-bottom:1px solid #eef2f6!important;
      }
      body[data-program-kind="pdf-editor"] .sec-head .sec-title{
        font-size:10.5px!important;color:#35475b!important;letter-spacing:0!important;
        text-transform:none!important;
      }
      body[data-program-kind="pdf-editor"] .sec-head .sec-arrow{display:none!important;}
      body[data-program-kind="pdf-editor"] .sec-body,
      body[data-program-kind="pdf-editor"] .sec-body.hidden{
        display:block!important;padding:10px 11px 11px!important;
      }
      body[data-program-kind="pdf-editor"] #thumbSection[style*="display:none"]{display:none!important;}
      body[data-program-kind="pdf-editor"] #pdfWorkflowHead,
      body[data-program-kind="pdf-editor"] #pdfResultBar,
      body[data-program-kind="pdf-editor"] #pdfOutputRail,
      body[data-program-kind="pdf-editor"] .ps-tool-sidebar-shell,
      body[data-program-kind="pdf-editor"] .ps-tool-rail,
      body[data-program-kind="pdf-editor"] .ps-tool-panel-head{display:none!important;}
      @media(max-width:980px){
        body[data-program-kind="pdf-editor"]{overflow:auto!important;}
        body[data-program-kind="pdf-editor"] .app{grid-template-columns:1fr!important;height:auto!important;min-height:100vh!important;}
        body[data-program-kind="pdf-editor"] .app>aside:first-of-type,
        body[data-program-kind="pdf-editor"] .app>main{grid-column:1!important;width:100%!important;height:auto!important;position:relative!important;overflow:visible!important;}
      }
    `;
    document.head.appendChild(style);
  }

  function restoreFromToolRail(){
    const sidebar=document.querySelector('.app>aside:first-of-type');
    const shell=sidebar?.querySelector(':scope>.ps-tool-sidebar-shell');
    if(!sidebar||!shell)return false;
    const panel=shell.querySelector('.ps-tool-panel');
    const actions=sidebar.querySelector(':scope>.program-local-actions');
    if(panel){
      const nodes=[...panel.childNodes].filter(node=>!(node.nodeType===1&&node.classList?.contains('ps-tool-panel-head')));
      const anchor=actions?.nextSibling||shell;
      nodes.forEach(node=>sidebar.insertBefore(node,anchor));
    }
    shell.remove();
    sidebar.classList.remove('ps-tool-rail-mounted');
    document.getElementById('programStudioEditorToolRailV1Styles')?.remove();
    return true;
  }

  function restoreFromOutputRail(){
    const app=document.querySelector('.app');
    const sidebar=app?.querySelector('aside:first-of-type');
    const rail=document.getElementById('pdfOutputRail');
    if(!app||!sidebar||!rail)return false;
    const main=app.querySelector('main');
    const movable=[...rail.children].filter(node=>node.classList?.contains('sec'));
    movable.forEach(node=>sidebar.appendChild(node));
    rail.remove();
    if(main)main.style.gridColumn='';
    document.body.removeAttribute('data-pdf-workspace');
    document.documentElement.removeAttribute('data-pdf-workspace-layout');
    return true;
  }

  function removeWorkflowChrome(){
    document.getElementById('pdfWorkflowHead')?.remove();
    document.getElementById('pdfResultBar')?.remove();
    document.body.removeAttribute('data-pdf-workflow');
    document.documentElement.removeAttribute('data-pdf-workflow-ui');
  }

  function keepSectionsOpen(){
    document.querySelectorAll('.app>aside .sec').forEach(sec=>{
      const head=sec.querySelector(':scope>.sec-head');
      const body=sec.querySelector(':scope>.sec-body');
      head?.classList.remove('collapsed');
      body?.classList.remove('hidden');
      if(head){head.setAttribute('aria-expanded','true');head.removeAttribute('role');}
    });
  }

  function compactLogout(){
    const logout=document.getElementById('navLogout');
    if(!logout)return;
    logout.title='로그아웃';
    logout.setAttribute('aria-label','로그아웃');
    [...logout.childNodes].forEach(node=>{if(node.nodeType===Node.TEXT_NODE)node.remove();});
  }

  function sync(){
    observer?.disconnect?.();
    try{
      installStyles();
      restoreFromToolRail();
      restoreFromOutputRail();
      removeWorkflowChrome();
      keepSectionsOpen();
      compactLogout();
      document.body.dataset.pdfSidebarMode='all-visible';
      document.documentElement.dataset.pdfSimpleSidebarUi='1';
    }finally{
      const root=document.querySelector('.app')||document.body;
      observer?.observe(root,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style']});
    }
  }

  function blockSectionToggle(event){
    const head=event.target.closest?.('.app>aside .sec-head');
    if(!head)return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const body=head.parentElement?.querySelector(':scope>.sec-body');
    head.classList.remove('collapsed');
    body?.classList.remove('hidden');
  }

  function queueSync(){
    if(frame)return;
    frame=requestAnimationFrame(()=>{frame=0;sync();});
  }

  function boot(){
    if(typeof MutationObserver==='function')observer=new MutationObserver(queueSync);
    document.addEventListener('click',blockSectionToggle,true);
    sync();
    [80,220,600,1200].forEach(delay=>setTimeout(queueSync,delay));
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();

  const api={sync,stage:'single-sidebar-all-controls-visible-v2'};
  window.PdfEditorSimpleSidebarUi=api;
  // Compatibility aliases for callers from the previous guided / three-pane UI.
  window.PdfEditorWorkflowUi=api;
  window.PdfEditorWorkspaceLayout=api;
})();