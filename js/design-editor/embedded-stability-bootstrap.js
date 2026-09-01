// Stabilizes the embedded design editor before the heavier enhancement runtime finishes.
(function(){
  'use strict';
  if(window.__designEditorEmbeddedStabilityBootstrapV1)return;
  window.__designEditorEmbeddedStabilityBootstrapV1=true;

  const params=new URLSearchParams(location.search);
  if(params.get('embed')!=='1')return;

  const root=document.documentElement;
  const directEntry=['direct','app-direct'].includes(String(params.get('entry')||''));
  const directEntryUrl=location.pathname+location.search+location.hash;
  if(directEntry){
    const nativeReplaceState=history.replaceState.bind(history);
    history.replaceState=function(state,title,url){
      try{
        const target=new URL(String(url||''),location.href);
        if(target.pathname==='/design-editor/index.html'){
          root.dataset.designDirectHistoryGuard='1';
          return nativeReplaceState(state,title,directEntryUrl);
        }
      }catch(_){}
      return nativeReplaceState(state,title,url);
    };
    root.dataset.designDirectHistoryGuard='1';
  }

  const syntheticCoalesceDeadline=Date.now()+4200;
  let lastSyntheticResizeSignature='';
  let syntheticResizeFrame=0;
  let forwardingSyntheticResize=false;
  let readyFrame=0;
  let earlyProjectTimer=0;
  let observer=null;

  const byId=id=>document.getElementById(id);
  const round1=value=>Math.round((Number(value)||0)*10)/10;

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

  function requestedMode(){
    const mode=String(params.get('mode')||'').toLowerCase();
    if(mode)return mode;
    const preset=String(params.get('preset')||'').toLowerCase();
    if(preset==='cover-a4')return'cover';
    if(preset.startsWith('poster-'))return'poster';
    if(preset.startsWith('flyer-'))return'flyer';
    if(preset.startsWith('invitation-'))return'invitation';
    if(preset==='leaflet-2')return'leaflet2';
    if(preset.startsWith('leaflet-3-'))return'leaflet3';
    return'';
  }

  function ensureEarlyCoverPreset(){
    const presets=window.DesignEditorPresets?.PRESETS;
    if(!presets)return false;
    if(presets['cover-a4'])return true;
    const trimWidth=210,trimHeight=297,bleed=3,safe=10,spine=8.5,spreadWidth=428.5;
    presets['cover-a4']={
      id:'cover-a4',group:'표지',name:'무선제본 전체 표지',description:'뒤표지·책등·앞표지를 한 펼침면에서 편집',
      width:spreadWidth,height:trimHeight,bleed,safe,designMode:'cover',
      cover:{trimWidth,trimHeight,bleed,safe,pageCount:160,paperCaliper:.1,bindingAdjust:.5,manualSpine:false,spineManual:spine,spineDirection:'bottomToTop',spine,spreadWidth,totalWidth:spreadWidth+bleed*2,totalHeight:trimHeight+bleed*2,folds:[210,218.5],panels:['뒤표지',`책등 ${spine.toFixed(1)}mm`,'앞표지']},
      surfaces:[{id:'cover',label:'전체 표지',folds:[210,218.5],panels:['뒤표지',`책등 ${spine.toFixed(1)}mm`,'앞표지']}]
    };
    return true;
  }

  function requestedPreset(mode){
    const requested=String(params.get('preset')||'');
    if(requested)return requested;
    if(mode==='cover')return'cover-a4';
    if(mode==='poster')return'poster-a4';
    if(mode==='flyer')return'flyer-a4';
    if(mode==='invitation')return'invitation-a4';
    if(mode==='leaflet2')return'leaflet-2';
    if(mode==='leaflet3')return params.get('fold')==='leaflet-3-z'?'leaflet-3-z':'leaflet-3-roll';
    return'';
  }

  function applyEarlyProjectMetadata(project,mode){
    if(!project)return;
    project.designMode=mode||project.designMode||'';
    if(params.get('paper'))project.paper=params.get('paper');
    if(params.get('orientation'))project.orientation=params.get('orientation');
    if(mode==='leaflet3')project.foldType=params.get('fold')||project.foldType||'leaflet-3-roll';
    const width=Number(params.get('w')),height=Number(params.get('h'));
    if(Number.isFinite(width)&&width>0)project.width=round1(width);
    if(Number.isFinite(height)&&height>0)project.height=round1(height);
    if(mode==='cover'){
      project.presetId='cover-a4';
      project.activeSurface='cover';
      project.showFolds=true;
    }
  }

  function startRequestedProjectEarly(){
    const app=window.DesignEditorApp;
    const presets=window.DesignEditorPresets;
    if(!app||typeof app.startProject!=='function'||!presets)return false;
    if(app.project){
      root.dataset.designEarlyProject=root.dataset.designEarlyProject||'existing';
      return true;
    }
    const mode=requestedMode(),preset=requestedPreset(mode);
    if(!mode||!preset)return false;
    if(mode==='cover'&&!ensureEarlyCoverPreset())return false;
    if(!presets.PRESETS?.[preset])return false;
    app.startProject(preset);
    applyEarlyProjectMetadata(app.project,mode);
    root.dataset.designEarlyProject='started';
    lastSyntheticResizeSignature=resizeSignature();
    queueReadyCheck();
    return true;
  }

  function probeEarlyProject(){
    clearTimeout(earlyProjectTimer);
    const deadline=Date.now()+1800;
    const probe=()=>{
      if(startRequestedProjectEarly())return;
      if(Date.now()<deadline)earlyProjectTimer=setTimeout(probe,16);
    };
    probe();
  }

  function activeSurface(project){
    return project?.surfaces?.find(surface=>surface.id===project.activeSurface)||project?.surfaces?.[0]||null;
  }

  const ITEM_SIGNATURE_KEYS=[
    'id','type','kind','role','text','x','y','w','h','width','height','size','fontSize','fontFamily','fontWeight',
    'align','color','rotation','writingMode','direction','shape','fill','stroke','strokeWidth','radius','opacity',
    'fit','focusX','focusY','locked','visible','aspect'
  ];
  function itemSignature(item){
    if(!item||typeof item!=='object')return'';
    return ITEM_SIGNATURE_KEYS.map(key=>`${key}=${String(item[key]??'')}`).join(',');
  }
  function surfaceContentSignature(surface){
    const elements=Array.isArray(surface?.elements)?surface.elements.map(itemSignature).join('~'):'';
    const extras=Array.isArray(surface?.extras)?surface.extras.map(itemSignature).join('~'):'';
    return `${elements}#${extras}`;
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
      Math.round(viewport.clientWidth),Math.round(viewport.clientHeight),folds,panels,
      project.cover?.spineDirection||'',surfaceContentSignature(surface)
    ].join(':');
  }

  function refreshCanvasOnce(signature){
    if(syntheticResizeFrame)cancelAnimationFrame(syntheticResizeFrame);
    syntheticResizeFrame=requestAnimationFrame(()=>{
      syntheticResizeFrame=0;
      const app=window.DesignEditorApp;
      if(!app?.project)return;
      forwardingSyntheticResize=true;
      try{window.dispatchEvent(new Event('resize'));}finally{forwardingSyntheticResize=false;}
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
    if(forwardingSyntheticResize)return;
    if(event.isTrusted!==false){
      lastSyntheticResizeSignature='';
      queueReadyCheck();
      return;
    }
    const app=window.DesignEditorApp;
    if(!app?.project)return;
    if(Date.now()>syntheticCoalesceDeadline){
      lastSyntheticResizeSignature='';
      queueReadyCheck();
      return;
    }
    const signature=resizeSignature();
    if(!signature)return;
    event.stopImmediatePropagation();
    if(signature===lastSyntheticResizeSignature)return;
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
    probeEarlyProject();
    window.addEventListener('resize',handleResize,true);
    if(typeof MutationObserver==='function'){
      observer=new MutationObserver(()=>{
        keepDelegatedFrameVisible();
        if(!window.DesignEditorApp?.project)startRequestedProjectEarly();
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
    sync:()=>{keepDelegatedFrameVisible();startRequestedProjectEarly();queueReadyCheck();return true;},
    startRequestedProjectEarly,
    resizeSignature,
    surfaceContentSignature,
    stage:'embedded-design-stable-canvas-bootstrap-v4-direct-entry-history-guard'
  };

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();