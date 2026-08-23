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

  function setStatus(project){
    const node=document.getElementById('editorStatus');
    const spine=Number(project?.cover?.spine)||0;
    if(node){
      node.className='editor-status ok';
      node.textContent=`표지 통합 편집 모드 · 뒤표지 | 책등 ${spine.toFixed(1)}mm | 앞표지`;
    }
  }

  function patchModeCard(){
    const card=document.getElementById('designEmbeddedModeCard');
    if(!card)return false;
    const coverButton=card.querySelector('[data-design-mode="cover"]');
    if(coverButton)coverButton.classList.add('on');
    const options=card.querySelector('.design-mode-options');
    if(options){
      options.innerHTML='<div class="design-mode-note">뒤표지·책등·앞표지를 한 펼침면에서 편집합니다. 책등과 표지 규격 세부 설정은 표지 전용 설정 패널로 순차 통합됩니다.</div>';
    }
    return true;
  }

  function ensureCoverProject(){
    const app=root.DesignEditorApp;
    const model=root.DesignEditorCoverModel;
    if(!app||typeof app.startProject!=='function'||!model)return false;
    model.registerPreset();
    if(app.project?.presetId!=='cover-a4')app.startProject('cover-a4');
    const project=model.applyToProject(app.project);
    if(!project)return false;
    setStatus(project);
    installed=true;
    root.dispatchEvent(new Event('resize'));
    return true;
  }

  function restoreScopedDraft(){
    if(restored||!installed||!root.DesignEditorEmbeddedRuntime)return false;
    const scope=root.DesignEditorDraftScope;
    if(!scope?.restoreCurrentScope)return false;
    restored=Boolean(scope.restoreCurrentScope());
    if(restored){
      root.DesignEditorCoverModel?.applyToProject?.(root.DesignEditorApp?.project);
      setStatus(root.DesignEditorApp?.project);
      root.dispatchEvent(new Event('resize'));
    }
    return restored;
  }

  function boot(){
    if(!ensureCoverProject()){
      [80,180,360,700,1200,2200].forEach(delay=>setTimeout(ensureCoverProject,delay));
    }
    [120,260,520,900,1500,2600,4200].forEach(delay=>setTimeout(()=>{
      patchModeCard();
      restoreScopedDraft();
    },delay));
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();

  root.DesignEditorCoverModeBridge={
    ensureCoverProject,
    restoreScopedDraft,
    patchModeCard,
    stage:'unified-general-cover-route-bridge'
  };
})(window);
