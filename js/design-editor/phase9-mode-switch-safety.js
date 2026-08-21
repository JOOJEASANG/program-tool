(function(){
  'use strict';
  if(window.__designEditorModeSwitchSafetyV1)return;
  window.__designEditorModeSwitchSafetyV1=true;

  const params=new URLSearchParams(location.search);
  const embedded=params.get('embed')==='1';
  const path=location.pathname.replace(/\/+$/,'')||'/';
  const isGeneral=path==='/design-editor/general.html'||path==='/design-editor/index.html'||path.endsWith('/design-editor/general.html')||path.endsWith('/design-editor/index.html');
  if(!embedded||!isGeneral)return;

  let lastSaveAt=0;

  function saveNow(source){
    const api=window.DesignEditorDraftScope;
    if(!api?.saveCurrent)return false;
    api.saveCurrent(source);
    lastSaveAt=Date.now();
    return true;
  }

  function isModeNavigationTarget(target){
    if(!target?.closest)return false;
    return !!target.closest('[data-design-mode],.design-mode-apply,.design-recent-item');
  }

  function handleNavigationIntent(event){
    if(!isModeNavigationTarget(event.target))return;
    saveNow('mode-switch-intent');
    const active=document.activeElement;
    if(active&&active!==document.body&&typeof active.blur==='function'){
      try{active.blur();}catch(_){}
    }
  }

  function handleKeyboard(event){
    if(event.key!=='Enter'&&event.key!==' ')return;
    if(!isModeNavigationTarget(event.target))return;
    saveNow('mode-switch-keyboard');
  }

  function boot(){
    document.addEventListener('pointerdown',handleNavigationIntent,true);
    document.addEventListener('click',handleNavigationIntent,true);
    document.addEventListener('keydown',handleKeyboard,true);
    window.addEventListener('pagehide',()=>saveNow('mode-switch-pagehide'));
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();

  window.DesignEditorModeSwitchSafety={
    saveNow,
    lastSaveAt:()=>lastSaveAt,
    stage:'synchronous-save-before-design-mode-navigation'
  };
})();
