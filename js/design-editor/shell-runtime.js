// Unified loader for print/design shell enhancements.
(function(){
  'use strict';
  if(window.__designEditorShellRuntimeV1)return;
  window.__designEditorShellRuntimeV1=true;

  const params=new URLSearchParams(location.search);
  const rawApp=(params.get('app')||'').trim().toLowerCase();
  const app=rawApp==='notice'?'invitation':rawApp;
  const standalone=['cover','poster','flyer','invitation','leaflet'].includes(app);
  const fallbackFoldProduct=app==='invitation'||app==='leaflet'||(!standalone&&['invitation','leaflet2','leaflet3'].includes(params.get('mode')||''));

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
  const activeProfile=()=>window.DesignEditorStandaloneProducts?.fromLocation?.(location.search)||null;
  const sharedProfile=()=>window.DesignEditorSharedModuleProfile||null;
  const needsFoldRuntime=()=>activeProfile()?.needsFoldRuntime??fallbackFoldProduct;
  const needsProductMenu=()=>activeProfile()?.needsProductMenu??fallbackFoldProduct;
  const shouldLoad=entry=>{
    if(!standalone)return true;
    const shared=sharedProfile();
    if(shared?.shouldLoadShell){
      return shared.shouldLoadShell(entry.id,app,{
        needsFoldRuntime:needsFoldRuntime(),
        needsProductMenu:needsProductMenu()
      });
    }
    if(entry.id==='designPrintFoldRuntimeEnsureScriptV1')return needsFoldRuntime();
    if(entry.id==='designPrintProductMenuScriptV1')return needsProductMenu();
    return true;
  };

  function loadSupportScript(scriptId,src){
    const existing=document.getElementById(scriptId);
    if(existing?.dataset.loaded==='true')return Promise.resolve(true);
    return new Promise(resolve=>{
      const script=existing||document.createElement('script');
      const done=ok=>{if(ok)script.dataset.loaded='true';resolve(ok);};
      script.addEventListener('load',()=>done(true),{once:true});
      script.addEventListener('error',()=>done(false),{once:true});
      if(!existing){script.id=scriptId;script.src=src;script.async=false;document.head.appendChild(script);}
    });
  }

  async function loadBoundaryUi(){
    if(!standalone)return true;
    await loadSupportScript('designStandaloneProductProfileScriptV1','/js/design-editor/standalone-product-profile.js?v=20260831-1');
    const loaded=await loadSupportScript('designProductBoundaryUiScriptV1','/js/design-editor/product-boundary-ui.js?v=20260831-2');
    window.DesignEditorProductBoundaryUi?.sync?.();
    return loaded;
  }

  function syncEntry(entry){
    if(!shouldLoad(entry))return false;
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
    if(!shouldLoad(entry))return Promise.resolve(true);
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
    await loadSupportScript('designSharedModuleProfileScriptV1','/js/design-editor/shared/module-profile.js?v=20260831-1');
    await loadBoundaryUi();
    for(const entry of MODULES)await loadEntry(entry);
    sync();
    document.documentElement.dataset.designShellRuntime='1';
    if(standalone){
      document.documentElement.dataset.designStandaloneApp=activeProfile()?.key||rawApp||app;
      document.documentElement.dataset.designStandaloneRuntime=activeProfile()?.runtimeProduct||app;
    }
    return true;
  }

  function sync(){
    let ready=0;
    MODULES.forEach(entry=>{if(syncEntry(entry))ready+=1;});
    if(standalone)window.DesignEditorProductBoundaryUi?.sync?.();
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
    product:standalone?app:'integrated',
    get profile(){return activeProfile()?.key||null;},
    modules:MODULES.map(({id,src,global,method})=>({id,src,global,method})),
    stage:'design-shell-runtime-manifest-v1'
  };
})();
