// Shared capability/module policy for standalone and integrated design-editor runtimes.
(function(){
  'use strict';
  if(window.DesignEditorSharedModuleProfile)return;

  const PRODUCT_ALIASES=Object.freeze({
    notice:'invitation',
    leaflet2:'leaflet',
    leaflet3:'leaflet'
  });

  const CORE_PRODUCT_ONLY=Object.freeze({
    cover:new Set([
      'designEditorCoverModelScriptV1',
      'designEditorCoverModeBridgeScriptV1',
      'designEditorCoverSettingsScriptV1',
      'designEditorCoverSpineToolsScriptV1',
      'designEditorCoverPreviewZonesScriptV1'
    ])
  });

  const SHELL_CAPABILITIES=Object.freeze({
    cover:Object.freeze({fold:false,productMenu:false}),
    poster:Object.freeze({fold:false,productMenu:false}),
    flyer:Object.freeze({fold:false,productMenu:false}),
    invitation:Object.freeze({fold:true,productMenu:true}),
    leaflet:Object.freeze({fold:true,productMenu:true})
  });

  function normalizeProduct(value){
    const raw=String(value||'').trim().toLowerCase();
    return PRODUCT_ALIASES[raw]||raw;
  }

  function fromLocation(search=location.search){
    const params=new URLSearchParams(search||'');
    return normalizeProduct(params.get('app')||'');
  }

  function shouldLoadCore(entryId,product){
    const active=normalizeProduct(product);
    if(!active)return true;
    for(const [owner,ids] of Object.entries(CORE_PRODUCT_ONLY)){
      if(ids.has(entryId))return active===owner;
    }
    return true;
  }

  function shellCapabilities(product){
    const active=normalizeProduct(product);
    return SHELL_CAPABILITIES[active]||Object.freeze({fold:false,productMenu:false});
  }

  function shouldLoadShell(entryId,product,options={}){
    const active=normalizeProduct(product);
    if(!active)return true;
    const capabilities=shellCapabilities(active);
    if(entryId==='designPrintFoldRuntimeEnsureScriptV1'){
      return options.needsFoldRuntime??capabilities.fold;
    }
    if(entryId==='designPrintProductMenuScriptV1'){
      return options.needsProductMenu??capabilities.productMenu;
    }
    return true;
  }

  window.DesignEditorSharedModuleProfile=Object.freeze({
    normalizeProduct,
    fromLocation,
    shouldLoadCore,
    shouldLoadShell,
    shellCapabilities,
    stage:'design-editor-shared-module-profile-v1'
  });
})();
