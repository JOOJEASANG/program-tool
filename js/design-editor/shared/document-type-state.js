// Canonical document-type state for the unified design editor.
(function(){
  'use strict';
  if(window.__designEditorDocumentTypeStateV1)return;
  window.__designEditorDocumentTypeStateV1=true;

  const TYPES=['cover','poster','flyer','invitation','leaflet2','leaflet3','custom'];
  const TYPE_SET=new Set(TYPES);
  const params=new URLSearchParams(location.search);

  function normalize(value){return TYPE_SET.has(String(value||''))?String(value):'';}
  function infer(project){
    if(!project)return normalize(params.get('mode'))||'custom';
    const explicit=normalize(project.documentType);if(explicit)return explicit;
    const design=normalize(project.designMode);if(design)return design;
    const product=String(project.printProductMode||'');
    if(product==='invitation')return'invitation';
    if(product==='leaflet')return Number(project.printProductPages)===4?'leaflet2':'leaflet3';
    const requested=normalize(params.get('mode'));if(requested)return requested;
    return'custom';
  }
  function legacyProduct(type){
    if(type==='invitation')return'invitation';
    if(type==='leaflet2'||type==='leaflet3')return'leaflet';
    return'';
  }
  function sync(project,options={}){
    if(!project)return'';
    const type=normalize(options.type)||infer(project);
    const changed=project.documentType!==type||project.designMode!==type;
    project.documentType=type;
    project.designMode=type;
    const legacy=legacyProduct(type);
    if(legacy)project.printProductMode=legacy;
    else if(['invitation','leaflet'].includes(project.printProductMode))delete project.printProductMode;
    if(type==='leaflet2'&&!Number(project.printProductPages))project.printProductPages=4;
    if(type==='leaflet3'&&Number(project.printProductPages)===4)project.printProductPages=6;
    document.documentElement.dataset.designDocumentType=type;
    if(changed&&options.emit!==false){
      window.dispatchEvent(new CustomEvent('programstudio:document-type-change',{detail:{type,source:options.source||'document-type-state'}}));
    }
    return type;
  }
  function set(type,project=window.DesignEditorApp?.project,options={}){
    const next=normalize(type);if(!next||!project)return'';
    return sync(project,{...options,type:next});
  }
  function current(project=window.DesignEditorApp?.project){return infer(project);}
  function queueSync(){const project=window.DesignEditorApp?.project;if(project)sync(project,{emit:false,source:'runtime-sync'});}
  function boot(){queueSync();[80,220,600,1200].forEach(delay=>setTimeout(queueSync,delay));}

  ['programstudio:design-mode-change','programstudio:runtime-script-result'].forEach(name=>window.addEventListener(name,queueSync));
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();

  window.DesignEditorDocumentTypeState={types:[...TYPES],normalize,infer,current,sync,set,stage:'canonical-document-type-state-v1'};
})();
