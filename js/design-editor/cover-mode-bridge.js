(function(root){
  'use strict';
  if(root.__designEditorCoverModeBridgeV1)return;
  root.__designEditorCoverModeBridgeV1=true;

  const params=new URLSearchParams(location.search);
  const initialPath=location.pathname.replace(/\/+$/,'')||'/';
  const embedded=params.get('embed')==='1';
  const coverRequested=params.get('mode')==='cover'||params.get('preset')==='cover-a4';
  const generalPath=initialPath==='/design-editor/general'||initialPath==='/design-editor/general.html'||initialPath.endsWith('/design-editor/general.html');
  const rewrittenGeneralPath=embedded&&(initialPath==='/design-editor/index.html'||initialPath.endsWith('/design-editor/index.html'));
  if(!embedded||!coverRequested||(!generalPath&&!rewrittenGeneralPath))return;

  let installed=false;
  let restored=false;
  let modeCaptureInstalled=false;

  function project(){return root.DesignEditorApp?.project||null;}

  function setStatus(current=project()){
    const node=document.getElementById('editorStatus');
    const spine=Number(current?.cover?.spine)||0;
    if(node){
      node.className='editor-status ok';
      node.textContent=`표지 통합 편집 모드 · 뒤표지 | 책등 ${spine.toFixed(1)}mm | 앞표지`;
    }
  }

  function patchModeCard(){
    const card=document.getElementById('designEmbeddedModeCard');
    if(!card)return false;
    card.querySelectorAll('[data-design-mode]').forEach(button=>button.classList.toggle('on',button.dataset.designMode==='cover'));
    const options=card.querySelector('.design-mode-options');
    if(options){
      options.innerHTML='<div class="design-mode-note">뒤표지·책등·앞표지를 한 펼침면에서 편집합니다. 표지에서만 책등·표지 규격·표지 가이드 메뉴를 표시합니다.</div>';
    }
    return true;
  }

  function syncModeMenus(){
    root.DesignEditorEmbeddedPolish?.syncCapabilityVisibility?.();
    root.DesignEditorCoverSettings?.syncFields?.();
    root.DesignEditorCoverSpineTools?.placeAll?.();
    root.DesignEditorCoverPreviewZones?.render?.();
  }

  function updateCoverHistory(){
    try{history.replaceState(history.state,'','/design-editor/index.html?embed=1&mode=cover&preset=cover-a4');}catch(_){}
  }

  function ensureCoverProject(){
    const app=root.DesignEditorApp;
    const model=root.DesignEditorCoverModel;
    if(!app||typeof app.startProject!=='function'||!model)return false;
    model.registerPreset();
    if(app.project?.presetId!=='cover-a4')app.startProject('cover-a4');
    const current=model.applyToProject(app.project);
    if(!current)return false;
    setStatus(current);
    installed=true;
    root.dispatchEvent(new Event('resize'));
    return true;
  }

  function restoreScopedDraft(force=false){
    if(force)restored=false;
    if(restored||!installed||!root.DesignEditorEmbeddedRuntime)return false;
    const scope=root.DesignEditorDraftScope;
    if(!scope?.restoreCurrentScope)return false;
    restored=Boolean(scope.restoreCurrentScope());
    if(restored){
      root.DesignEditorCoverModel?.applyToProject?.(project());
      setStatus();
      syncModeMenus();
      root.dispatchEvent(new Event('resize'));
    }
    return restored;
  }

  function activateCoverInPlace(source='mode-button'){
    const app=root.DesignEditorApp;
    const model=root.DesignEditorCoverModel;
    if(!app||typeof app.startProject!=='function'||!model)return false;
    if(project()?.designMode==='cover'&&project()?.presetId==='cover-a4'){
      patchModeCard();syncModeMenus();updateCoverHistory();return true;
    }
    root.DesignEditorModeSwitchSafety?.saveNow?.(`cover-${source}`);
    root.DesignEditorDraftScope?.saveCurrent?.(`cover-${source}`);
    restored=false;
    model.registerPreset();
    app.startProject('cover-a4');
    const current=model.applyToProject(app.project);
    if(!current)return false;
    installed=true;
    restoreScopedDraft(true);
    model.applyToProject(app.project);
    patchModeCard();
    updateCoverHistory();
    syncModeMenus();
    root.DesignEditorPhase2?.sync?.();
    setStatus();
    root.dispatchEvent(new Event('resize'));
    try{root.dispatchEvent(new CustomEvent('programstudio:design-mode-change',{detail:{mode:'cover',source}}));}catch(_){}
    requestAnimationFrame(()=>{patchModeCard();syncModeMenus();root.DesignEditorPhase2?.sync?.();});
    return true;
  }

  function handleModeButtonCapture(event){
    const button=event.target?.closest?.('#designEmbeddedModeCard [data-design-mode]');
    if(!button)return;
    const next=button.dataset.designMode;
    const current=project()?.designMode||'';
    if(next==='cover'){
      event.preventDefault();event.stopImmediatePropagation();
      activateCoverInPlace('mode-button');
      return;
    }
    if(current!=='cover')return;
    const runtime=root.DesignEditorEmbeddedRuntime;
    if(!runtime?.switchGeneralMode)return;
    event.preventDefault();event.stopImmediatePropagation();
    runtime.switchGeneralMode({mode:next},'cover-mode-button');
    queueMicrotask(()=>syncModeMenus());
    setTimeout(syncModeMenus,80);
  }

  function installModeCapture(){
    if(modeCaptureInstalled)return;
    modeCaptureInstalled=true;
    document.addEventListener('click',handleModeButtonCapture,true);
  }

  function settleAfterRuntime(){
    patchModeCard();
    restoreScopedDraft();
    syncModeMenus();
  }

  function onRuntimeResult(event){
    const detail=event.detail||{};
    if(detail.id==='designEditorEmbeddedRuntimeScriptV1'&&detail.status==='loaded')queueMicrotask(settleAfterRuntime);
    if(['designEditorEmbeddedPolishScriptV1','designEditorCoverSettingsScriptV1','designEditorCoverSpineToolsScriptV1','designEditorCoverPreviewZonesScriptV1'].includes(detail.id)&&detail.status==='loaded')queueMicrotask(syncModeMenus);
  }

  function boot(){
    installModeCapture();
    root.addEventListener('programstudio:runtime-script-result',onRuntimeResult);
    if(!ensureCoverProject()){
      [80,260,700,1200].forEach(delay=>setTimeout(ensureCoverProject,delay));
    }
    settleAfterRuntime();
    [120,420,1000].forEach(delay=>setTimeout(settleAfterRuntime,delay));
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();

  root.DesignEditorCoverModeBridge={
    ensureCoverProject,
    restoreScopedDraft,
    patchModeCard,
    activateCoverInPlace,
    syncModeMenus,
    stage:'unified-general-cover-route-bridge'
  };
})(window);
