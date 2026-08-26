(function(){
  'use strict';
  if(window.__designEditorCurrentDraftResetV2)return;
  window.__designEditorCurrentDraftResetV2=true;

  const path=location.pathname.replace(/\/+$/,'')||'/';
  const isGeneral=path==='/design-editor/general'||path==='/design-editor/general.html'||path==='/design-editor/index.html'||path.endsWith('/design-editor/general.html')||path.endsWith('/design-editor/index.html');
  if(!isGeneral)return;

  const INDEX_KEY='programTool.designEditor.draft.index.v2';
  const LEGACY_KEY='programTool.designEditor.draft.v1';
  const DRAFT_PREFIX='programTool.designEditor.draft.v2.';
  const STYLE_ID='designEditorCurrentDraftResetStyles';
  const HEADER_BUTTON_ID='designGlobalResetBtn';
  const CARD_BUTTON_ID='designCurrentDraftResetBtn';
  const CARD_WRAP_ID='designCurrentDraftResetWrap';
  let observer=null;
  let installTimer=0;
  let resetting=false;

  const roundMm=value=>Math.round((Number(value)||0)*10)/10;
  const safePart=value=>String(value||'design').toLowerCase().replace(/[^a-z0-9._-]+/g,'-').replace(/^-+|-+$/g,'')||'design';

  function readJson(key){
    try{return JSON.parse(localStorage.getItem(key)||'null');}catch(_){return null;}
  }

  function currentProject(){return window.DesignEditorApp?.project||null;}

  function fallbackScope(project){
    if(!project?.presetId)return'';
    let width=Number(project.width),height=Number(project.height);
    if(project.designMode==='cover'&&project.cover){
      const trimWidth=Number(project.cover.trimWidth),trimHeight=Number(project.cover.trimHeight);
      if(Number.isFinite(trimWidth)&&Number.isFinite(trimHeight)){width=trimWidth;height=trimHeight;}
    }
    if(!Number.isFinite(width)||!Number.isFinite(height))return'';
    return `${safePart(project.presetId)}.${roundMm(width)}x${roundMm(height)}`;
  }

  function scopeFor(project){
    return window.DesignEditorDraftScope?.scopeForProject?.(project)||fallbackScope(project);
  }

  function installStyles(){
    if(document.getElementById(STYLE_ID))return;
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      .design-global-reset{border:1px solid #e2a9a3!important;background:#fff7f6!important;color:#a43831!important;white-space:nowrap}
      .design-global-reset:hover{background:#fff0ee!important;border-color:#d8877f!important}
      .design-current-reset-wrap{margin-top:7px;padding-top:7px;border-top:1px solid #e3e9ef}
      .design-current-reset{width:100%;border:1px solid #e0b9b5;border-radius:7px;background:#fff8f7;color:#a13a32;padding:7px;font-size:7.5px;font-weight:950;cursor:pointer}
      .design-current-reset:hover{background:#fff1ef;border-color:#d99992}
      .design-current-reset-note{margin-top:4px;color:#8a94a4;font-size:6.5px;line-height:1.4}
    `;
    document.head.appendChild(style);
  }

  function clearIndexScope(scope){
    const current=readJson(INDEX_KEY);
    if(!Array.isArray(current))return;
    try{localStorage.setItem(INDEX_KEY,JSON.stringify(current.filter(item=>item?.scope!==scope)));}catch(_){}
  }

  function clearScopeStorage(project,scope){
    const api=window.DesignEditorDraftScope;
    const directKey=api?.draftKey?.(project)||'';
    const remove=[];
    try{
      for(let index=0;index<localStorage.length;index+=1){
        const key=localStorage.key(index);
        if(!key||!key.startsWith(DRAFT_PREFIX))continue;
        if(key===directKey){remove.push(key);continue;}
        const raw=readJson(key);
        const saved=raw?.project||raw;
        if(saved&&scopeFor(saved)===scope)remove.push(key);
      }
    }catch(_){}
    remove.forEach(key=>{try{localStorage.removeItem(key);}catch(_){}});
    clearIndexScope(scope);
    try{localStorage.removeItem(LEGACY_KEY);}catch(_){}
  }

  function blankProject(project){
    let fresh;
    try{fresh=JSON.parse(JSON.stringify(project));}catch(_){return null;}
    if(!fresh||!Array.isArray(fresh.surfaces))return null;
    fresh.surfaces=fresh.surfaces.map(surface=>({
      ...surface,
      background:'#ffffff',
      elements:[],
      extras:[]
    }));
    fresh.activeSurface=fresh.activeSurface&&fresh.surfaces.some(surface=>surface.id===fresh.activeSurface)?fresh.activeSurface:(fresh.surfaces[0]?.id||'');
    fresh.showGuides=fresh.showGuides!==false;
    fresh.showFolds=fresh.showFolds!==false;
    return fresh;
  }

  function setStatus(message){
    const node=document.getElementById('editorStatus');
    if(node){node.className='editor-status ok';node.textContent=message;}
    const state=document.getElementById('saveState');
    if(state)state.textContent='새 작업 저장됨';
  }

  function refreshUi(){
    try{document.getElementById('artboard')?.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,view:window}));}catch(_){}
    window.DesignEditorPhase2?.sync?.();
    window.DesignEditorTextAutoFit?.sync?.();
    window.DesignEditorPrintProductMenu?.render?.();
    window.DesignEditorEmbeddedPolish?.syncCapabilityVisibility?.();
    window.DesignEditorCoverSettings?.syncFields?.();
    window.DesignEditorCoverSpineTools?.placeAll?.();
    window.DesignEditorCoverPreviewZones?.render?.();
    window.DesignEditorPreviewGuides?.refresh?.();
    window.dispatchEvent(new Event('resize'));
  }

  function resetCurrentDraft(options={}){
    if(resetting)return false;
    const project=currentProject(),app=window.DesignEditorApp;
    if(!project||!app||typeof app.resumeDraft!=='function')return false;
    const scope=scopeFor(project);
    const fresh=blankProject(project);
    if(!fresh)return false;
    const label=String(project.name||project.presetId||'현재 작업');
    const shouldConfirm=options.confirm!==false;
    if(shouldConfirm&&!confirm(`${label} 작업을 초기화하고 같은 종류·규격으로 새 작업을 시작할까요?\n현재 디자인 내용과 이 작업의 자동 저장본이 삭제됩니다.`))return false;

    resetting=true;
    try{
      clearTimeout(installTimer);
      clearScopeStorage(project,scope);
      localStorage.setItem(LEGACY_KEY,JSON.stringify(fresh));
      app.resumeDraft();
      const blank=currentProject();
      if(!blank)throw new Error('blank project restore failed');
      try{localStorage.setItem(LEGACY_KEY,JSON.stringify(blank));}catch(_){}
      window.DesignEditorDraftScope?.saveCurrent?.('reset-new-work');
      setStatus('초기화했습니다. 같은 종류·규격의 새 작업을 시작합니다.');
      refreshUi();
      try{window.dispatchEvent(new CustomEvent('designeditor:project-reset',{detail:{scope,presetId:blank.presetId,designMode:blank.designMode||'',productMode:blank.printProductMode||''}}));}catch(_){}
      window.DesignEditorRecentDrafts?.render?.();
      const reload=options.reload!==false;
      if(reload)setTimeout(()=>location.reload(),120);
      return true;
    }catch(error){
      console.error('[design reset]',error);
      return false;
    }finally{
      resetting=false;
    }
  }

  function makeButton(id,label,className){
    const button=document.createElement('button');
    button.id=id;button.type='button';button.className=className;button.textContent=label;
    button.title='현재 디자인 내용을 지우고 같은 종류·규격으로 새 작업을 시작합니다.';
    button.addEventListener('click',()=>resetCurrentDraft());
    return button;
  }

  function installHeaderButton(){
    if(document.getElementById(HEADER_BUTTON_ID))return true;
    const head=document.querySelector('.document-head');
    if(!head||!currentProject())return false;
    const button=makeButton(HEADER_BUTTON_ID,'초기화','mini-action design-global-reset');
    const other=document.getElementById('newDesignBtn');
    if(other)head.insertBefore(button,other);else head.appendChild(button);
    return true;
  }

  function installModeCardButton(){
    const card=document.getElementById('designEmbeddedModeCard');
    if(!card||!currentProject())return false;
    let wrap=document.getElementById(CARD_WRAP_ID);
    if(wrap&&wrap.parentElement===card)return true;
    wrap?.remove();
    wrap=document.createElement('div');wrap.id=CARD_WRAP_ID;wrap.className='design-current-reset-wrap';
    const button=makeButton(CARD_BUTTON_ID,'초기화 · 새 작업','design-current-reset');
    const note=document.createElement('div');note.className='design-current-reset-note';note.textContent='현재 메뉴와 규격은 유지하고 디자인 내용만 비워 새 작업을 시작합니다.';
    wrap.append(button,note);card.appendChild(wrap);
    return true;
  }

  function install(){
    installStyles();
    const header=installHeaderButton();
    const card=installModeCardButton();
    return header||card;
  }

  function queueInstall(delay=40){
    clearTimeout(installTimer);
    installTimer=setTimeout(()=>install(),delay);
  }

  function observe(){
    if(observer||typeof MutationObserver!=='function')return;
    observer=new MutationObserver(records=>{
      if(records.some(record=>record.type==='childList'))queueInstall(30);
    });
    observer.observe(document.documentElement,{childList:true,subtree:true});
  }

  function boot(){
    install();observe();
    [80,180,360,700,1200,2200,3600].forEach(delay=>setTimeout(install,delay));
    window.addEventListener('programstudio:design-mode-change',()=>queueInstall(20));
    window.addEventListener('designeditor:project-restored',()=>queueInstall(20));
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();

  window.DesignEditorCurrentDraftReset={
    resetCurrentDraft,
    install,
    blankProject,
    stage:'all-design-menus-reset-to-blank-current-spec'
  };
})();

(function(){
  'use strict';
  const id='designEditorLeaflet2LayoutScriptV1';
  if(document.getElementById(id))return;
  const script=document.createElement('script');script.id=id;script.src='/js/design-editor/phase25-leaflet2-layout.js?v=20260824-1';script.async=false;document.head.appendChild(script);
})();
