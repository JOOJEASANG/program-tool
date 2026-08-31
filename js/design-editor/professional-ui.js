// Compatibility owner for the integrated editor's professional workflow bar.
(function(){
  'use strict';
  if(window.__designEditorProfessionalUiV2)return;
  window.__designEditorProfessionalUiV2=true;

  const params=new URLSearchParams(location.search);
  if(params.get('embed')!=='1')return;

  const STANDALONE_APPS=new Set(['cover','poster','flyer','invitation','notice','leaflet']);
  const standalone=STANDALONE_APPS.has(params.get('app')||'');
  const currentScriptSrc=document.currentScript?.src||'';
  let sharedApi=window.DesignEditorProfessionalShellUi||null;
  let sharedPromise=null;

  function byId(id){return document.getElementById(id)}

  function ensureShared(){
    if(window.DesignEditorProfessionalShellUi){
      sharedApi=window.DesignEditorProfessionalShellUi;
      return Promise.resolve(sharedApi);
    }
    if(sharedPromise)return sharedPromise;
    sharedPromise=new Promise((resolve,reject)=>{
      const id='designProfessionalShellUiScriptV1';
      let script=byId(id);
      const finish=()=>{
        sharedApi=window.DesignEditorProfessionalShellUi||null;
        if(sharedApi)resolve(sharedApi);else reject(new Error('shared professional shell UI did not register'));
      };
      const fail=()=>reject(new Error('shared professional shell UI failed to load'));
      if(!script){
        script=document.createElement('script');
        script.id=id;
        script.src=currentScriptSrc
          ?new URL('./shared/professional-shell-ui.js?v=20260901-1',currentScriptSrc).href
          :'../js/design-editor/shared/professional-shell-ui.js?v=20260901-1';
        script.async=false;
        script.addEventListener('load',finish,{once:true});
        script.addEventListener('error',fail,{once:true});
        (document.head||document.documentElement).appendChild(script);
        return;
      }
      script.addEventListener('load',finish,{once:true});
      script.addEventListener('error',fail,{once:true});
      setTimeout(()=>{if(window.DesignEditorProfessionalShellUi)finish();},0);
    });
    return sharedPromise;
  }

  function ensureWorkflowBar(api){
    const existing=byId('designProfessionalWorkflow');
    if(standalone){
      existing?.remove();
      document.documentElement.dataset.professionalWorkflowOwner='workspace-navigation';
      return false;
    }
    if(existing){
      document.documentElement.dataset.professionalWorkflowOwner='professional-ui';
      return true;
    }
    const toolbar=document.querySelector('.editor-main .editor-toolbar');
    if(!toolbar?.parentElement)return false;
    const bar=document.createElement('div');
    bar.id='designProfessionalWorkflow';
    bar.className='ps-workflowbar';
    bar.setAttribute('aria-label','디자인 작업 순서');
    bar.innerHTML='<span class="ps-workflow-title">작업 순서</span><button class="ps-workflow-step" type="button" data-ps-flow="product"><b>1</b>종류·규격</button><button class="ps-workflow-step" type="button" data-ps-flow="compose"><b>2</b>내용 제작</button><button class="ps-workflow-step" type="button" data-ps-flow="check"><b>3</b>인쇄 점검</button><button class="ps-workflow-step primary" type="button" data-ps-flow="output"><b>4</b>PDF 만들기</button><span class="ps-workflow-spacer"></span><span class="ps-workflow-note">자동 저장 · 300DPI 출력</span>';
    bar.addEventListener('click',event=>{
      const action=event.target.closest('[data-ps-flow]')?.dataset.psFlow;
      if(action==='product')api.openProduct?.();
      else if(action==='compose')api.openCompose?.();
      else if(action==='check')api.openCheck?.();
      else if(action==='output')api.makePdf?.();
    });
    toolbar.insertAdjacentElement('afterend',bar);
    document.documentElement.dataset.professionalWorkflowOwner='professional-ui';
    return true;
  }

  function sync(){
    ensureShared().then(api=>{
      api.sync?.();
      ensureWorkflowBar(api);
    }).catch(()=>{
      document.documentElement.dataset.professionalWorkflowOwner='shared-load-error';
    });
  }

  let frame=0;
  function queueSync(){if(frame)return;frame=requestAnimationFrame(()=>{frame=0;sync();});}
  function boot(){
    sync();
    const root=byId('editorShell')||document.body;
    if(typeof MutationObserver==='function')new MutationObserver(queueSync).observe(root,{childList:true,subtree:true});
    ['programstudio:design-mode-change','programstudio:document-type-change','programstudio:runtime-script-result','resize'].forEach(name=>window.addEventListener(name,queueSync));
    [120,360,900,1800].forEach(delay=>setTimeout(queueSync,delay));
  }

  window.DesignEditorProfessionalUi={
    sync,
    makePdf:(...args)=>sharedApi?.makePdf?.(...args)??false,
    openCheck:(...args)=>sharedApi?.openCheck?.(...args)??false,
    openCompose:(...args)=>sharedApi?.openCompose?.(...args)??false,
    stage:'professional-workspace-result-first-v2',
    workspaceStage:'three-pane-context-properties-v1',
    sharedStage:'design-editor-professional-shell-ui-v1'
  };
  ensureShared();
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();