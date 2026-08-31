// Canonical PDF editor core-module manifest.
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

  function ensureBookletStylesheet(){
    if(document.getElementById('pdfBookletMenuSafeCssV1'))return;
    const link=document.createElement('link');
    link.id='pdfBookletMenuSafeCssV1';
    link.rel='stylesheet';
    link.href='/css/pdf-booklet-menu-safe.css?v=20260830-1';
    document.head.appendChild(link);
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
    return typeof loader==='function' ? loader(entry.id,entry.src) : fallbackLoad(entry.id,entry.src);
  }

  function loadUploadOrderUi(){
    const id='pdfUploadOrderModalUiScriptV2';
    const src='/js/pdf-editor/upload-order-modal-ui.js?v=20260831-2';
    const loader=context().load;
    return typeof loader==='function' ? loader(id,src) : fallbackLoad(id,src);
  }

  function loadAll(){
    ensureBookletStylesheet();
    const seen=new Set();
    const pending=[];
    for(const entry of MODULES){
      if(!entry.id||!entry.src||seen.has(entry.id))continue;
      seen.add(entry.id);
      pending.push(loadEntry(entry));
    }
    pending.push(loadUploadOrderUi());
    return Promise.all(pending).then(()=>{
      document.documentElement.dataset.pdfCoreRuntime='1';
      return true;
    });
  }

  window.PdfEditorCoreRuntime={
    loadAll,
    modules:MODULES.map(({id,src})=>({id,src})),
    stage:'pdf-editor-core-runtime-manifest-v1'
  };
})();