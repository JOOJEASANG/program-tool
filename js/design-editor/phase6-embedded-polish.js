(function(){
  'use strict';
  if(window.__designEditorEmbeddedPolishV1)return;
  window.__designEditorEmbeddedPolishV1=true;

  const params=new URLSearchParams(location.search);
  const embedded=params.get('embed')==='1';
  const path=location.pathname.replace(/\/+$/,'')||'/';
  const isGeneral=path==='/design-editor/general.html'||path==='/design-editor/index.html'||path.endsWith('/design-editor/general.html')||path.endsWith('/design-editor/index.html');
  if(!embedded||!isGeneral)return;

  const STYLE_ID='designEditorEmbeddedPolishStyles';
  let installed=false;
  let refreshTimer=0;

  function installStyles(){
    if(document.getElementById(STYLE_ID))return;
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      html[data-design-embedded="1"] .start-screen{display:none!important}
      html[data-design-embedded="1"] #newDesignBtn{display:none!important}
      .design-mode-btn.has-saved{position:relative;padding-right:12px!important}
      .design-mode-btn.has-saved::after{content:'';position:absolute;right:5px;top:5px;width:5px;height:5px;border-radius:50%;background:currentColor;opacity:.8}
      .design-mode-save-hint{display:flex;align-items:center;gap:5px;margin-top:6px;padding:5px 6px;border-radius:6px;background:#eef8f8;color:#0f6f78;font-size:7px;font-weight:850;line-height:1.35}
      .design-mode-save-hint::before{content:'✓';font-size:8px;font-weight:950}
    `;
    document.head.appendChild(style);
  }

  function modeForPreset(presetId){
    const id=String(presetId||'');
    if(id.startsWith('poster-'))return 'poster';
    if(id.startsWith('flyer-'))return 'flyer';
    if(id==='leaflet-2')return 'leaflet2';
    if(id.startsWith('leaflet-3-'))return 'leaflet3';
    if(id==='custom')return 'custom';
    return '';
  }

  function savedModes(){
    const list=window.DesignEditorDraftScope?.listDrafts?.();
    if(!Array.isArray(list))return new Set();
    return new Set(list.map(item=>modeForPreset(item?.presetId)).filter(Boolean));
  }

  function currentMode(){
    const button=document.querySelector('#designEmbeddedModeCard .design-mode-btn.on');
    return button?.dataset.designMode||'';
  }

  function decorateModeCard(){
    const card=document.getElementById('designEmbeddedModeCard');
    if(!card)return false;
    const modes=savedModes();
    card.querySelectorAll('[data-design-mode]').forEach(button=>{
      const hasSaved=modes.has(button.dataset.designMode);
      button.classList.toggle('has-saved',hasSaved);
      if(hasSaved)button.title='자동 저장된 작업 있음';else button.removeAttribute('title');
    });

    let hint=card.querySelector('.design-mode-save-hint');
    const hasCurrent=modes.has(currentMode());
    if(hasCurrent&&!hint){
      hint=document.createElement('div');hint.className='design-mode-save-hint';hint.textContent='이 작업 종류는 자동 저장되어 다시 돌아와도 이어서 작업할 수 있습니다.';
      card.appendChild(hint);
    }else if(!hasCurrent&&hint){
      hint.remove();
    }
    return true;
  }

  function queueRefresh(){
    clearTimeout(refreshTimer);
    refreshTimer=setTimeout(decorateModeCard,260);
  }

  function install(){
    if(installed)return true;
    installStyles();
    installed=true;
    ['input','change','pointerup','keyup','click'].forEach(name=>document.addEventListener(name,queueRefresh,false));
    window.addEventListener('pageshow',queueRefresh);
    [80,220,480,900,1500,2400,3600].forEach(delay=>setTimeout(decorateModeCard,delay));
    return true;
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();

  window.DesignEditorEmbeddedPolish={
    decorateModeCard,
    stage:'single-sidebar-embedded-flow-and-saved-mode-indicators'
  };
})();
