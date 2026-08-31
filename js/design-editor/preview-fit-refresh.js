// Keep the design artboard fitted after shell/toolbars change the available workspace.
(function(){
  'use strict';
  if(window.__designEditorPreviewFitRefreshV1)return;
  window.__designEditorPreviewFitRefreshV1=true;

  const params=new URLSearchParams(location.search);
  if(params.get('embed')!=='1')return;

  const STYLE_ID='designPreviewFitRefreshStyles';
  const root=document.documentElement;
  let resizeObserver=null;
  let mutationObserver=null;
  let frame=0;
  let lastWidth=0;
  let lastHeight=0;

  const byId=id=>document.getElementById(id);
  const project=()=>window.DesignEditorApp?.project||null;
  const isCover=()=>{
    const current=project();
    return current?.designMode==='cover'||Boolean(current?.cover)||params.get('mode')==='cover';
  };

  function installStyles(){
    if(byId(STYLE_ID))return;
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      @media(min-width:981px){
        html[data-design-cover-preview-fit="1"] #editorShell.editor-shell{height:100vh!important;min-height:100vh!important;align-items:stretch!important}
        html[data-design-cover-preview-fit="1"] .editor-main{height:100%!important;min-height:0!important;align-self:stretch!important}
        html[data-design-cover-preview-fit="1"] .artboard-viewport{flex:1 1 auto!important;min-height:0!important;padding:26px 30px 36px!important;scroll-padding:26px 30px 36px!important}
      }
      @media(min-width:1440px){
        html[data-design-cover-preview-fit="1"] .artboard-viewport{padding:20px 26px 32px!important;scroll-padding:20px 26px 32px!important}
      }
    `;
    document.head.appendChild(style);
  }

  function requestRefit(){
    if(frame)return;
    frame=requestAnimationFrame(()=>{
      frame=requestAnimationFrame(()=>{
        frame=0;
        if(!project())return;
        // app.js owns the scale and pointer coordinate math. Reuse its existing
        // resize handler instead of applying a visual-only CSS transform.
        window.dispatchEvent(new Event('resize'));
        root.dataset.designPreviewRefit='1';
      });
    });
  }

  function observeViewport(){
    const viewport=byId('artboardViewport');
    if(!viewport)return false;
    if(!resizeObserver&&window.ResizeObserver){
      resizeObserver=new ResizeObserver(entries=>{
        const rect=entries[0]?.contentRect;
        if(!rect)return;
        const width=Math.round(rect.width),height=Math.round(rect.height);
        if(width===lastWidth&&height===lastHeight)return;
        lastWidth=width;lastHeight=height;
        requestRefit();
      });
      resizeObserver.observe(viewport);
    }
    return true;
  }

  function sync(){
    installStyles();
    root.dataset.designCoverPreviewFit=isCover()?'1':'0';
    observeViewport();
    requestRefit();
    return true;
  }

  function boot(){
    sync();
    const shell=byId('editorShell')||document.body;
    if(typeof MutationObserver==='function'&&!mutationObserver){
      mutationObserver=new MutationObserver(()=>{
        root.dataset.designCoverPreviewFit=isCover()?'1':'0';
        observeViewport();
      });
      mutationObserver.observe(shell,{childList:true,subtree:true});
    }
    ['programstudio:design-mode-change','programstudio:document-type-change'].forEach(name=>window.addEventListener(name,sync));
    [80,220,500,900,1500].forEach(delay=>setTimeout(sync,delay));
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();

  window.DesignEditorPreviewFitRefresh={sync,requestRefit,stage:'cover-workspace-resize-refit-v1'};
})();