(function(){
  'use strict';
  if(window.__designEditorDraftScopeV1)return;
  window.__designEditorDraftScopeV1=true;

  const path=location.pathname.replace(/\/+$/,'')||'/';
  if(path!=='/design-editor/general.html'&&path!=='/design-editor/index.html'&&!path.endsWith('/design-editor/general.html')&&!path.endsWith('/design-editor/index.html'))return;

  const LEGACY_KEY='programTool.designEditor.draft.v1';
  const DRAFT_PREFIX='programTool.designEditor.draft.v2.';
  const INDEX_KEY='programTool.designEditor.draft.index.v2';
  let restoredScope='';
  let saveTimer=0;
  let installed=false;
  let startHookInstalled=false;

  const roundMm=value=>Math.round((Number(value)||0)*10)/10;
  const safePart=value=>String(value||'design').toLowerCase().replace(/[^a-z0-9._-]+/g,'-').replace(/^-+|-+$/g,'')||'design';

  function readJson(key){
    try{return JSON.parse(localStorage.getItem(key)||'null');}catch(_){return null;}
  }

  function validProject(project){
    return !!(project&&project.presetId&&Array.isArray(project.surfaces)&&Number.isFinite(Number(project.width))&&Number.isFinite(Number(project.height)));
  }

  function scopeDimensions(project){
    if(project?.designMode==='cover'&&project?.cover){
      const trimWidth=Number(project.cover.trimWidth);
      const trimHeight=Number(project.cover.trimHeight);
      if(Number.isFinite(trimWidth)&&Number.isFinite(trimHeight))return{width:trimWidth,height:trimHeight};
    }
    return{width:Number(project?.width),height:Number(project?.height)};
  }

  function scopeForProject(project){
    if(!validProject(project))return '';
    const size=scopeDimensions(project);
    return `${safePart(project.presetId)}.${roundMm(size.width)}x${roundMm(size.height)}`;
  }

  function draftKey(project){
    const scope=scopeForProject(project);
    return scope?DRAFT_PREFIX+scope:'';
  }

  function legacyGeometryDraftKey(project){
    if(!validProject(project)||project?.designMode!=='cover')return '';
    return DRAFT_PREFIX+`${safePart(project.presetId)}.${roundMm(project.width)}x${roundMm(project.height)}`;
  }

  function envelopeAt(key){
    if(!key)return null;
    const raw=readJson(key);
    if(validProject(raw?.project))return raw;
    if(validProject(raw))return {version:2,savedAt:0,project:raw};
    return null;
  }

  function readEnvelope(project){
    const key=draftKey(project);if(!key)return null;
    const current=envelopeAt(key);
    if(current)return current;
    const legacyKey=legacyGeometryDraftKey(project);
    if(legacyKey&&legacyKey!==key)return envelopeAt(legacyKey);
    return null;
  }

  function durableSnapshot(project){
    const snapshot=window.DesignEditorAssetStore?.snapshotProject?.(project);
    return validProject(snapshot)?snapshot:project;
  }

  function updateIndex(project,savedAt){
    const scope=scopeForProject(project);if(!scope)return;
    const current=readJson(INDEX_KEY);
    const list=Array.isArray(current)?current.filter(item=>item&&item.scope!==scope):[];
    const size=scopeDimensions(project);
    list.unshift({scope,presetId:String(project.presetId),name:String(project.name||project.presetId),width:roundMm(size.width),height:roundMm(size.height),savedAt});
    try{localStorage.setItem(INDEX_KEY,JSON.stringify(list.slice(0,24)));}catch(_){}
  }

  function saveProject(project,source='auto'){
    if(!validProject(project))return false;
    const key=draftKey(project);if(!key)return false;
    const savedAt=Date.now();
    const snapshot=durableSnapshot(project);
    try{
      localStorage.setItem(key,JSON.stringify({version:2,savedAt,source,project:snapshot}));
      updateIndex(project,savedAt);
      return true;
    }catch(_){return false;}
  }

  function captureLegacyDraft(){
    const legacy=readJson(LEGACY_KEY);
    if(!validProject(legacy))return;
    const key=draftKey(legacy);if(!key)return;
    try{
      if(!localStorage.getItem(key))saveProject(legacy,'legacy-migration');
    }catch(_){}
  }

  function currentProject(){return window.DesignEditorApp?.project||null;}

  function saveCurrent(source='auto'){
    clearTimeout(saveTimer);
    const project=currentProject();
    if(project)saveProject(project,source);
  }

  function queueSave(source='auto'){
    clearTimeout(saveTimer);
    saveTimer=setTimeout(()=>saveCurrent(source),220);
  }

  function setStatus(message){
    const node=document.getElementById('editorStatus');
    if(!node)return;
    node.className='editor-status ok';
    node.textContent=message;
  }

  function restoreCurrentScope(){
    const app=window.DesignEditorApp;
    const project=app?.project;
    if(!app||typeof app.resumeDraft!=='function'||!validProject(project))return false;
    if(!window.DesignEditorEmbeddedRuntime)return false;
    const scope=scopeForProject(project);
    if(!scope)return false;
    if(restoredScope===scope)return true;

    const saved=readEnvelope(project);
    restoredScope=scope;
    if(!saved?.project){queueSave('initial');return true;}

    try{
      localStorage.setItem(LEGACY_KEY,JSON.stringify(saved.project));
      app.resumeDraft();
      const restored=currentProject();
      if(restored?.designMode==='cover')saveProject(restored,'cover-scope-migration');
      setStatus('이 작업 종류의 자동 저장본을 복구했습니다.');
      queueSave('restored');
      window.dispatchEvent(new Event('resize'));
      return true;
    }catch(_){return false;}
  }

  function installProjectStartHook(){
    if(startHookInstalled)return true;
    const app=window.DesignEditorApp;
    if(!app||typeof app.startProject!=='function')return false;
    const originalStart=app.startProject.bind(app);
    app.startProject=(...args)=>{
      restoredScope='';
      const result=originalStart(...args);
      restoreCurrentScope();
      return result;
    };
    startHookInstalled=true;
    return true;
  }

  function installEvents(){
    if(installed)return;
    installed=true;
    ['input','change','pointerup','keyup','click'].forEach(name=>document.addEventListener(name,()=>queueSave(name),false));
    window.addEventListener('pagehide',()=>saveCurrent('pagehide'));
    window.addEventListener('beforeunload',()=>saveCurrent('beforeunload'));
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')saveCurrent('hidden');});
  }

  function boot(){
    installEvents();
    const attempt=()=>{
      installProjectStartHook();
      if(restoreCurrentScope())return;
      [120,280,520,900,1500,2400,3600].forEach(delay=>setTimeout(()=>{installProjectStartHook();restoreCurrentScope();},delay));
    };
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',attempt,{once:true});else attempt();
    [700,1400,2600,4200].forEach(delay=>setTimeout(()=>queueSave('settled'),delay));
  }

  captureLegacyDraft();
  boot();

  window.DesignEditorDraftScope={
    scopeForProject,
    draftKey,
    saveCurrent,
    restoreCurrentScope,
    installProjectStartHook,
    listDrafts:()=>readJson(INDEX_KEY)||[],
    stage:'preset-trim-size-scoped-draft-recovery-start-race-safe'
  };
})();