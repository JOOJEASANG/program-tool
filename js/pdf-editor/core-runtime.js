// Canonical lightweight PDF editor core-module manifest.
// Keep the default editor close to the 21b36a9 runtime footprint. Advanced
// page transforms are loaded only from the dedicated advanced editor route.
(function(){
  'use strict';
  if(window.__pdfEditorCoreRuntimeV1)return;
  window.__pdfEditorCoreRuntimeV1=true;

  const MODULES=Object.freeze([
    {id:'pdfEditorFontRenderFixScriptV1',src:'/js/pdf-editor/font-render-fix.js?v=20260618-1'},
    {id:'pdfEditorUploadFixScriptV1',src:'/js/pdf-editor/upload-fix.js?v=20260724-5'},
    {id:'pdfEditorLivePreviewScriptV1',src:'/js/pdf-editor/live-preview.js?v=20260724-4'},
    {id:'pdfEditorLayoutExportScriptV1',src:'/js/pdf-editor/layout-export.js?v=20260731-3'},
    {id:'pdfEditorPageCountHintScriptV1',src:'/js/pdf-editor/page-count-hint.js?v=20260731-1'},
    {id:'pdfEditorNupHelperScriptV1',src:'/js/pdf-editor/nup-helper.js?v=20260830-1'},
    {id:'pdfEditorPreviewRowDefaultScriptV1',src:'/js/pdf-editor/preview-row-default.js?v=20260831-1'},
    {id:'pdfEditorDividerHelperScriptV1',src:'/js/pdf-editor/divider-helper.js?v=20260731-2'}
  ]);

  const context=()=>window.ProgramStudioPdfEditorRuntimeContext||{};

  function isAdvancedProfile(){
    if(document.documentElement.dataset.pdfEditorProfile==='advanced')return true;
    return /^\/pdf-editor-advanced(?:\/|$)/.test(String(location.pathname||''));
  }

  function ensureBookletStylesheet(){
    if(document.getElementById('pdfBookletMenuSafeCssV1'))return;
    const link=document.createElement('link');
    link.id='pdfBookletMenuSafeCssV1';
    link.rel='stylesheet';
    link.href='/css/pdf-booklet-menu-safe.css?v=20260902-1';
    document.head.appendChild(link);
  }

  function installUploadOrderModeSafety(){
    if(window.__pdfUploadOrderModeSafetyV1)return;
    window.__pdfUploadOrderModeSafetyV1=true;
    document.addEventListener('click',event=>{
      if(!event.target?.closest?.('.mode-btn,#uploadZone'))return;
      window.__pdfUploadOrderRequestedMode='';
    },true);
  }

  function fallbackLoad(id,src){
    const existing=document.getElementById(id);
    if(existing&&existing.dataset.loaded==='true')return Promise.resolve(true);
    return new Promise((resolve,reject)=>{
      const script=existing||document.createElement('script');
      if(!existing){
        script.id=id;
        script.src=src;
        script.async=false;
        document.head.appendChild(script);
      }
      script.addEventListener('load',()=>{script.dataset.loaded='true';resolve(true);},{once:true});
      script.addEventListener('error',()=>reject(new Error(`PDF core runtime failed: ${id}`)),{once:true});
    });
  }

  function loadEntry(entry){
    const loader=context().load;
    return typeof loader==='function'?loader(entry.id,entry.src):fallbackLoad(entry.id,entry.src);
  }

  function loadUploadOrderUi(){
    const id='pdfUploadOrderUiScriptV1';
    const src='/js/pdf-editor/upload-order-ui.js?v=20260831-1';
    const loader=context().load;
    return typeof loader==='function'?loader(id,src):fallbackLoad(id,src);
  }

  function loadAdvancedRuntime(){
    const id='pdfEditorAdvancedRuntimeScriptV1';
    const src='/js/pdf-editor/advanced-runtime.js?v=20260908-1';
    const loader=context().load;
    const pending=typeof loader==='function'?loader(id,src):fallbackLoad(id,src);
    return pending.then(()=>{
      const runtime=window.PdfEditorAdvancedRuntime;
      if(!runtime||typeof runtime.loadAll!=='function')throw new Error('PDF advanced runtime API is unavailable');
      return runtime.loadAll();
    });
  }

  function loadAll(){
    ensureBookletStylesheet();
    installUploadOrderModeSafety();
    const seen=new Set();
    const pending=[];
    for(const entry of MODULES){
      if(!entry.id||!entry.src||seen.has(entry.id))continue;
      seen.add(entry.id);
      pending.push(loadEntry(entry));
    }
    pending.push(loadUploadOrderUi());
    const advanced=isAdvancedProfile();
    document.documentElement.dataset.pdfEditorProfile=advanced?'advanced':'lightweight';
    return Promise.all(pending)
      .then(()=>advanced?loadAdvancedRuntime():true)
      .then(()=>{
        document.documentElement.dataset.pdfCoreRuntime='1';
        return true;
      });
  }

  window.PdfEditorCoreRuntime={
    loadAll,
    isAdvancedProfile,
    modules:MODULES.map(({id,src})=>({id,src})),
    stage:'pdf-editor-core-runtime-manifest-v1',
    profileStage:'lightweight-default-advanced-route-v1'
  };
})();