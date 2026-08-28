// Unified loader for PDF editor workflow and three-pane workspace UI.
(function(){
  'use strict';
  if(window.__pdfEditorUiRuntimeV1)return;
  window.__pdfEditorUiRuntimeV1=true;

  const MODULES=Object.freeze([
    {id:'pdfEditorWorkflowUiScriptV1',src:'/js/pdf-editor/workflow-ui.js?v=20260828-1',global:'PdfEditorWorkflowUi'},
    {id:'pdfEditorWorkspaceLayoutScriptV1',src:'/js/pdf-editor/workspace-layout.js?v=20260828-1',global:'PdfEditorWorkspaceLayout'}
  ]);
  const loading=new Map();

  function syncEntry(entry){
    const api=window[entry.global];
    if(typeof api?.sync!=='function')return false;
    try{api.sync();return true;}catch(error){console.warn('[pdf-ui-runtime] sync failed',entry.global,error);return false;}
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
    document.documentElement.dataset.pdfUiRuntime='1';
    return true;
  }

  function sync(){
    let ready=0;
    MODULES.forEach(entry=>{if(syncEntry(entry))ready+=1;});
    return ready;
  }

  function boot(){
    loadAll().catch(error=>console.error('[pdf-ui-runtime] load failed',error));
    [160,500,1200].forEach(delay=>setTimeout(sync,delay));
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();

  window.PdfEditorUiRuntime={
    loadAll,
    sync,
    modules:MODULES.map(({id,src,global})=>({id,src,global})),
    stage:'pdf-editor-ui-runtime-manifest-v1'
  };
})();