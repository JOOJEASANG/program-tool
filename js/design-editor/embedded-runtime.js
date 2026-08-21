(function(){
  'use strict';
  if(window.__designEditorEmbeddedRuntimeV1)return;
  window.__designEditorEmbeddedRuntimeV1=true;

  const params=new URLSearchParams(location.search);
  const embedded=params.get('embed')==='1';
  const path=location.pathname.replace(/\/+$/,'')||'/';
  const isGeneral=path==='/design-editor/general.html'||path.endsWith('/design-editor/general.html');
  const isCover=path==='/perfect-binding-cover'||path==='/perfect-binding-cover/index.html'||path.endsWith('/perfect-binding-cover/index.html');
  if(!embedded||(!isGeneral&&!isCover))return;

  function installEmbedStyles(){
    if(document.getElementById('designEmbeddedRuntimeStyles'))return;
    const style=document.createElement('style');
    style.id='designEmbeddedRuntimeStyles';
    style.textContent=isCover
      ? 'html,body{height:100%!important}body{padding-top:0!important}.top-nav{display:none!important}.workspace{height:100vh!important}.preview-panel{padding-top:7px!important}'
      : 'html,body{height:100%!important}body{padding-top:0!important}.top-nav{display:none!important}.start-screen,.editor-shell{height:100vh!important}';
    document.head.appendChild(style);
    document.documentElement.dataset.designEmbedded='1';
  }

  function clamp(value,min,max){return Math.max(min,Math.min(max,value));}

  function applyRequestedGeometry(){
    const app=window.DesignEditorApp;
    const project=app?.project;
    if(!project)return;
    const orientation=params.get('orientation');
    if(orientation==='landscape'&&project.width<project.height){
      const width=project.height;project.height=project.width;project.width=width;
    }else if(orientation==='portrait'&&project.width>project.height){
      const width=project.height;project.height=project.width;project.width=width;
    }

    const requestedW=Number(params.get('w'));
    const requestedH=Number(params.get('h'));
    if(Number.isFinite(requestedW))project.width=clamp(requestedW,80,1000);
    if(Number.isFinite(requestedH))project.height=clamp(requestedH,80,1000);

    const id=String(project.presetId||params.get('preset')||'');
    if(id==='leaflet-2'){
      project.surfaces?.forEach(surface=>{surface.folds=[project.width/2];});
    }else if(id==='leaflet-3-z'){
      project.surfaces?.forEach(surface=>{surface.folds=[project.width/3,project.width*2/3];});
    }else if(id==='leaflet-3-roll'){
      const third=project.width/3;
      project.surfaces?.forEach(surface=>{
        surface.folds=surface.id==='inside'?[third+1,third*2+1]:[Math.max(1,third-1),Math.max(2,third*2-1)];
      });
    }

    const meta=document.getElementById('documentMeta');
    if(meta)meta.textContent=`${Math.round(project.width*10)/10} × ${Math.round(project.height*10)/10}mm · 재단 ${project.bleed}mm`;
    window.dispatchEvent(new Event('resize'));
    queueMicrotask(()=>document.getElementById('artboard')?.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true})));
  }

  function startRequestedGeneralMode(){
    if(!isGeneral)return true;
    const app=window.DesignEditorApp;
    if(!app||typeof app.startProject!=='function')return false;
    if(app.project)return true;
    const preset=params.get('preset');
    if(!preset)return true;
    if(preset==='custom'){
      app.startProject('custom',{width:clamp(Number(params.get('w'))||210,80,1000),height:clamp(Number(params.get('h'))||297,80,1000)});
    }else{
      app.startProject(preset);
    }
    applyRequestedGeometry();
    return true;
  }

  function boot(){
    installEmbedStyles();
    if(startRequestedGeneralMode())return;
    [120,260,520,900,1500,2400].forEach(delay=>setTimeout(()=>{installEmbedStyles();startRequestedGeneralMode();},delay));
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();

  window.DesignEditorEmbeddedRuntime={
    applyRequestedGeometry,
    stage:'unified-design-mode-engine-bridge'
  };
})();
