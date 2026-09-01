// Expands the design preview into the space previously reserved for the removed right sidebar.
(function(){
  'use strict';
  if(window.__designEditorFullPreviewWorkspaceV1)return;
  window.__designEditorFullPreviewWorkspaceV1=true;

  const params=new URLSearchParams(location.search);
  if(params.get('embed')!=='1')return;

  const root=document.documentElement;
  const STYLE_ID='designFullPreviewWorkspaceStylesV1';
  let frame=0;
  let attributeObserver=null;

  const byId=id=>document.getElementById(id);

  function installStyles(){
    if(byId(STYLE_ID))return;
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      html[data-design-full-preview="1"]{--design-right-fixed:0px!important}
      html[data-design-full-preview="1"] #editorShell,
      html[data-design-full-preview="1"][data-design-ui-revision="20260901"] #editorShell,
      html[data-design-full-preview="1"][data-design-essential-workspace] #editorShell,
      html[data-design-full-preview="1"][data-design-focused-workspace="1"] #editorShell{
        width:100%!important;
        max-width:none!important;
        grid-template-columns:var(--design-focused-left,var(--design-left-open,268px)) minmax(0,1fr)!important;
      }
      html[data-design-full-preview="1"][data-design-sidebar-open="false"] #editorShell,
      html[data-design-full-preview="1"][data-design-sidebar-open="false"][data-design-ui-revision="20260901"] #editorShell,
      html[data-design-full-preview="1"][data-design-sidebar-open="false"][data-design-essential-workspace] #editorShell{
        grid-template-columns:var(--design-left-closed,52px) minmax(0,1fr)!important;
      }
      html[data-design-full-preview="1"] #propertiesPanel,
      html[data-design-full-preview="1"][data-design-ui-revision="20260901"] #propertiesPanel,
      html[data-design-full-preview="1"][data-design-essential-workspace] #propertiesPanel,
      html[data-design-full-preview="1"][data-design-context-pane-open="true"] #propertiesPanel,
      html[data-design-full-preview="1"][data-design-context-pane-open="false"] #propertiesPanel{
        display:none!important;
        position:absolute!important;
        width:0!important;
        min-width:0!important;
        max-width:0!important;
        margin:0!important;
        padding:0!important;
        border:0!important;
        visibility:hidden!important;
        pointer-events:none!important;
      }
      html[data-design-full-preview="1"] .editor-main,
      html[data-design-full-preview="1"] #canvasArea{
        grid-column:2 / -1!important;
        width:100%!important;
        max-width:none!important;
        min-width:0!important;
        margin-right:0!important;
        padding-right:0!important;
      }
      html[data-design-full-preview="1"] #artboardViewport,
      html[data-design-full-preview="1"] .artboard-viewport{
        width:100%!important;
        max-width:none!important;
        min-width:0!important;
        flex:1 1 auto!important;
      }
      @media(max-width:820px){
        html[data-design-full-preview="1"] #editorShell,
        html[data-design-full-preview="1"][data-design-sidebar-open="false"] #editorShell{
          grid-template-columns:minmax(0,1fr)!important;
        }
        html[data-design-full-preview="1"] .editor-main,
        html[data-design-full-preview="1"] #canvasArea{grid-column:1 / -1!important}
      }
    `;
    document.head.appendChild(style);
  }

  function refreshPreview(){
    try{window.DesignEditorPreviewFitRefresh?.sync?.();}catch(_){}
    try{window.DesignEditorCanvasViewportToolbar?.sync?.();}catch(_){}
    try{window.DesignEditorDirectResize?.sync?.();}catch(_){}
  }

  function sync(){
    root.dataset.designFullPreview='1';
    installStyles();
    const shell=byId('editorShell');
    if(shell)shell.dataset.workspace='two-pane-full-preview';
    const panel=byId('propertiesPanel');
    if(panel){
      panel.hidden=true;
      panel.setAttribute('aria-hidden','true');
      panel.setAttribute('aria-expanded','false');
    }
    requestAnimationFrame(refreshPreview);
    return true;
  }

  function queueSync(){
    if(frame)return;
    frame=requestAnimationFrame(()=>{frame=0;sync();});
  }

  function boot(){
    sync();
    if(typeof MutationObserver==='function'){
      attributeObserver=new MutationObserver(queueSync);
      attributeObserver.observe(root,{attributes:true,attributeFilter:['data-design-sidebar-open','data-design-ui-revision','data-design-essential-workspace','data-design-focused-workspace']});
    }
    window.addEventListener('resize',refreshPreview,{passive:true});
    ['programstudio:design-mode-change','programstudio:document-type-change','designeditor:project-restored'].forEach(name=>window.addEventListener(name,queueSync));
    [80,220,500,1000,1800].forEach(delay=>setTimeout(queueSync,delay));
  }

  window.DesignEditorFullPreviewWorkspace={sync,stage:'two-pane-full-preview-workspace-v1'};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
