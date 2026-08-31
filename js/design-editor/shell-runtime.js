// Unified loader for print/design shell enhancements.
(function(){
  'use strict';
  if(window.__designEditorShellRuntimeV1)return;
  window.__designEditorShellRuntimeV1=true;

  const MODULES=Object.freeze([
    {id:'designPrintFoldRuntimeEnsureScriptV1',src:'/js/design-editor/print-fold-runtime-ensure.js?v=20260825-5',global:'DesignEditorPrintFoldRuntimeEnsure',method:'refresh'},
    {id:'designDocumentTypeStateScriptV1',src:'/js/design-editor/document-type-state.js?v=20260828-1',global:'DesignEditorDocumentTypeState',method:'sync'},
    {id:'designPrintProductMenuScriptV1',src:'/js/design-editor/print-product-menu.js?v=20260828-3',global:'DesignEditorPrintProductMenu',method:'render'},
    {id:'designPrintProductStateRestoreScriptV1',src:'/js/design-editor/print-product-state-restore.js?v=20260825-1',global:'DesignEditorPrintProductStateRestore',method:'patch'},
    {id:'designPrintProductTopbarScriptV1',src:'/js/design-editor/print-product-topbar.js?v=20260828-2',global:'DesignEditorPrintProductTopbar',method:'sync'},
    {id:'designSelectionContextbarScriptV1',src:'/js/design-editor/selection-contextbar.js?v=20260828-1',global:'DesignEditorSelectionContextbar',method:'sync'},
    {id:'designMultiSelectionScriptV1',src:'/js/design-editor/multi-selection-context.js?v=20260828-1',global:'DesignEditorMultiSelection',method:'sync'},
    {id:'designMultiSmartGuidesScriptV1',src:'/js/design-editor/multi-selection-smart-guides.js?v=20260828-1',global:'DesignEditorMultiSmartGuides',method:'sync'},
    {id:'designSimpleResultWorkflowScriptV1',src:'/js/design-editor/simple-result-workflow.js?v=20260828-1',global:'DesignEditorSimpleResultWorkflow',method:'sync'},
    {id:'designProfessionalUiScriptV1',src:'/js/design-editor/professional-ui.js?v=20260828-2',global:'DesignEditorProfessionalUi',method:'sync'},
    {id:'designPreviewFitRefreshScriptV1',src:'/js/design-editor/preview-fit-refresh.js?v=20260831-1',global:'DesignEditorPreviewFitRefresh',method:'sync'}
  ]);

  const loading=new Map();
  const getApi=entry=>window[entry.global]||null;

  function syncEntry(entry){
    const api=getApi(entry);
    const fn=api?.[entry.method];
    if(typeof fn!=='function')return false;
    try{
      if(entry.global==='DesignEditorDocumentTypeState'){
        const project=window.DesignEditorApp?.project;
        if(project)fn.call(api,project,{emit:false,source:'shell-runtime'});
      }else{
        fn.call(api);
      }
      return true;
    }catch(error){
      console.warn('[design-shell-runtime] sync failed',entry.global,error);
      return false;
    }
  }

  function loadEntry(entry){
    if(syncEntry(entry))return Promise.resolve(true);
    if(loading.has(entry.id))return loading.get(entry.id);

    const promise=new Promise(resolve=>{
      let script=document.getElementById(entry.id);
      const done=()=>{syncEntry(entry);resolve(true);};
      if(script){
        if(script.dataset.loaded==='true'){done();return;}
        script.addEventListener('load',done,{once:true});
        script.addEventListener('error',()=>resolve(false),{once:true});
        return;
      }
      script=document.createElement('script');
      script.id=entry.id;
      script.src=entry.src;
      script.async=false;
      script.addEventListener('load',()=>{script.dataset.loaded='true';done();},{once:true});
      script.addEventListener('error',()=>resolve(false),{once:true});
      document.head.appendChild(script);
    }).finally(()=>loading.delete(entry.id));

    loading.set(entry.id,promise);
    return promise;
  }

  async function loadAll(){
    for(const entry of MODULES)await loadEntry(entry);
    sync();
    document.documentElement.dataset.designShellRuntime='1';
    return true;
  }

  function sync(){
    let ready=0;
    MODULES.forEach(entry=>{if(syncEntry(entry))ready+=1;});
    return ready;
  }

  function boot(){
    loadAll().catch(error=>console.error('[design-shell-runtime] load failed',error));
    [160,500,1200].forEach(delay=>setTimeout(sync,delay));
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();

  window.DesignEditorShellRuntime={
    loadAll,
    sync,
    modules:MODULES.map(({id,src,global,method})=>({id,src,global,method})),
    stage:'design-shell-runtime-manifest-v1'
  };
})();