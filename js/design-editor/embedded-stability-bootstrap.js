// Stabilizes the embedded design editor before the heavier enhancement runtime finishes.
(function(){
  'use strict';
  if(window.__designEditorEmbeddedStabilityBootstrapV1)return;
  window.__designEditorEmbeddedStabilityBootstrapV1=true;

  const params=new URLSearchParams(location.search);
  if(params.get('embed')!=='1')return;

  const root=document.documentElement;
  let lastSyntheticResizeSignature='';
  let syntheticResizeFrame=0;
  let readyFrame=0;
  let observer=null;

  const byId=id=>document.getElementById(id);

  function delegatedParent(){
    if(window.parent===window)return false;
    try{
      const parentDoc=window.parent.document;
      const parentRoot=parentDoc?.documentElement;
      const parentPath=String(window.parent.location.pathname||'').replace(/\/+$/,'');
      const key=String(parentPath.match(/^\/apps\/([^/]+)$/i)?.[1]||'').toLowerCase();
      const frame=parentDoc?.getElementById('appFrame');
      return ['cover','poster','flyer','invitation','notice','leaflet'].includes(key)
        && parentRoot?.dataset?.programStudioModularApp==='1'
        && frame?.contentWindow===window;
    }catch(_){return false;}
  }

  const delegated=delegatedParent();

  function keepDelegatedFrameVisible(){
    if(!delegated)return false;
    root.dataset.parentAccessDelegated='true';
    if(root.style.visibility==='hidden')root.style.removeProperty('visibility');
    if(root.dataset.accessChecking)delete root.dataset.accessChecking;
    byId('authLoading')?.classList.add('hidden');
    return true;
  }

  function activeSurface(project){
    return project?.surfaces?.find(surface=>surface.id===project.activeSurface)||project?.surfaces?.[0]||null;
  }

  function resizeSignature(){
    const app=window.DesignEditorApp;
    const project=app?.project;
    const viewport=byId('artboardViewport');
    if(!project||!viewport)return '';
    const surface=activeSurface(project);
    const folds=(surface?.folds||[]).map(value=>Math.round((Number(value)||0)*10)/10).join(',');
    const panels=(surface?.panels||[]).join('|');
    return [
      project.presetId||'',project.designMode||'',project.activeSurface||'',
      Number(project.width)||0,Number(project.height)||0,Number(project.bleed)||0,
      Math.round(viewport.clientWidth),Math.round(viewport.clientHeight),folds,panels
    ].join(':');
  }

  function refreshCanvasOnce(signature){
    if(syntheticResizeFrame)cancelAnimationFrame(syntheticResizeFrame);
    syntheticResizeFrame=requestAnimationFrame(()=>{
      syntheticResizeFrame=0;
      const app=window.DesignEditorApp;
      if(!app?.project)return;
      const viewport=app.viewport;
      const state=viewport?.getState?.();
      if(state?.mode==='fit'&&typeof viewport.fit==='function')viewport.fit({center:false});
      try{window.DesignEditorPhase2?.sync?.();}catch(_){}
      root.dataset.designSyntheticResizeCoalesced='1';
      lastSyntheticResizeSignature=signature||resizeSignature();
      queueReadyCheck();
    });
  }

  function handleResize(event){
    if(event.isTrusted!==false){
      lastSyntheticResizeSignature='';
      queueReadyCheck();
      return;
    }
    const app=window.DesignEditorApp;
    if(!app?.project)return;
    event.stopImmediatePropagation();
    const signature=resizeSignature();
    if(!signature||signature===lastSyntheticResizeSignature)return;
    refreshCanvasOnce(signature);
  }

  function projectIsPaintReady(){
    const app=window.DesignEditorApp;
    const project=app?.project;
    const shell=byId('editorShell');
    const viewport=byId('artboardViewport');
    const artboard=byId('artboard');
    if(!project||!shell||shell.classList.contains('hidden')||!viewport||!artboard)return false;
    const rect=artboard.getBoundingClientRect();
    return rect.width>20&&rect.height>20&&viewport.clientWidth>100&&viewport.clientHeight>100;
  }

  function checkReady(){
    readyFrame=0;
    keepDelegatedFrameVisible();
    if(projectIsPaintReady()){
      root.dataset.designEmbeddedProjectReady='1';
      root.dataset.designEmbeddedCanvasStable='1';
      return true;
    }
    return false;
  }

  function queueReadyCheck(){
    if(readyFrame)return;
    readyFrame=requestAnimationFrame(checkReady);
  }

  function boot(){
    keepDelegatedFrameVisible();
    window.addEventListener('resize',handleResize,true);
    if(typeof MutationObserver==='function'){
      observer=new MutationObserver(()=>{
        keepDelegatedFrameVisible();
        queueReadyCheck();
      });
      observer.observe(root,{attributes:true,attributeFilter:['style','data-access-checking','class']});
      if(document.body)observer.observe(document.body,{childList:true,subtree:true});
    }
    ['programstudio:runtime-script-result','programstudio:design-mode-change','programstudio:document-type-change','designeditor:project-restored']
      .forEach(name=>window.addEventListener(name,queueReadyCheck));
    queueReadyCheck();
  }

  window.DesignEditorEmbeddedStabilityBootstrap={
    sync:()=>{keepDelegatedFrameVisible();queueReadyCheck();return true;},
    resizeSignature,
    stage:'embedded-design-stable-canvas-bootstrap-v1'
  };

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();