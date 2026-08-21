(function(){
  'use strict';
  if(window.__designEditorCurrentDraftResetV1)return;
  window.__designEditorCurrentDraftResetV1=true;

  const params=new URLSearchParams(location.search);
  const embedded=params.get('embed')==='1';
  const path=location.pathname.replace(/\/+$/,'')||'/';
  const isGeneral=path==='/design-editor/general.html'||path==='/design-editor/index.html'||path.endsWith('/design-editor/general.html')||path.endsWith('/design-editor/index.html');
  if(!embedded||!isGeneral)return;

  const INDEX_KEY='programTool.designEditor.draft.index.v2';
  const LEGACY_KEY='programTool.designEditor.draft.v1';
  const STYLE_ID='designEditorCurrentDraftResetStyles';
  const BUTTON_ID='designCurrentDraftResetBtn';
  let installed=false;

  function readJson(key){
    try{return JSON.parse(localStorage.getItem(key)||'null');}catch(_){return null;}
  }

  function installStyles(){
    if(document.getElementById(STYLE_ID))return;
    const style=document.createElement('style');style.id=STYLE_ID;style.textContent=`
      .design-current-reset-wrap{margin-top:7px;padding-top:7px;border-top:1px solid #e3e9ef}
      .design-current-reset{width:100%;border:1px solid #e0b9b5;border-radius:7px;background:#fff8f7;color:#a13a32;padding:6px 7px;font-size:7.5px;font-weight:900;cursor:pointer}
      .design-current-reset:hover{background:#fff1ef;border-color:#d99992}
      .design-current-reset-note{margin-top:4px;color:#8a94a4;font-size:6.5px;line-height:1.4}
    `;document.head.appendChild(style);
  }

  function currentProject(){return window.DesignEditorApp?.project||null;}

  function clearIndexScope(scope){
    const current=readJson(INDEX_KEY);
    if(!Array.isArray(current))return;
    try{localStorage.setItem(INDEX_KEY,JSON.stringify(current.filter(item=>item?.scope!==scope)));}catch(_){}
  }

  function clearMatchingLegacy(scope){
    const legacy=readJson(LEGACY_KEY);
    const legacyScope=window.DesignEditorDraftScope?.scopeForProject?.(legacy)||'';
    if(legacyScope&&legacyScope===scope){
      try{localStorage.removeItem(LEGACY_KEY);}catch(_){}
    }
  }

  function resetCurrentDraft(){
    const project=currentProject();
    const api=window.DesignEditorDraftScope;
    if(!project||!api?.scopeForProject||!api?.draftKey)return;
    const scope=api.scopeForProject(project),key=api.draftKey(project);
    if(!scope||!key)return;
    const label=String(project.name||project.presetId||'현재 작업');
    if(!confirm(`${label}의 현재 자동 저장 작업만 비울까요?\n다른 포스터·전단·리플렛 작업은 그대로 유지됩니다.`))return;
    try{localStorage.removeItem(key);}catch(_){}
    clearIndexScope(scope);
    clearMatchingLegacy(scope);
    location.reload();
  }

  function install(){
    if(document.getElementById(BUTTON_ID))return true;
    const card=document.getElementById('designEmbeddedModeCard');
    const project=currentProject();
    if(!card||!project||!window.DesignEditorDraftScope)return false;
    installStyles();
    const wrap=document.createElement('div');wrap.className='design-current-reset-wrap';
    const button=document.createElement('button');button.id=BUTTON_ID;button.type='button';button.className='design-current-reset';button.textContent='현재 작업 새로 시작';
    const note=document.createElement('div');note.className='design-current-reset-note';note.textContent='현재 종류·규격의 자동 저장본만 비우고 빈 작업으로 다시 시작합니다.';
    button.addEventListener('click',resetCurrentDraft);wrap.append(button,note);card.appendChild(wrap);installed=true;return true;
  }

  function boot(){
    if(install())return;
    [120,260,520,900,1500,2400,3600].forEach(delay=>setTimeout(install,delay));
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();

  window.DesignEditorCurrentDraftReset={
    resetCurrentDraft,
    stage:'reset-only-current-preset-draft'
  };
})();
