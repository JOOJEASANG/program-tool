// Compatibility bootstrap: legacy admin filename now loads the extensible program usage settings UI.
(function(){
  'use strict';
  if(window.__programAdminUsageCompatibilityBootstrapV1)return;
  window.__programAdminUsageCompatibilityBootstrapV1=true;

  function loadScript(id,src){
    return new Promise((resolve,reject)=>{
      const existing=document.getElementById(id);
      if(existing){
        if(existing.dataset.loaded==='true')return resolve(existing);
        existing.addEventListener('load',()=>resolve(existing),{once:true});
        existing.addEventListener('error',reject,{once:true});
        return;
      }
      const script=document.createElement('script');
      script.id=id;script.src=src;script.async=false;
      script.addEventListener('load',()=>{script.dataset.loaded='true';resolve(script);},{once:true});
      script.addEventListener('error',reject,{once:true});
      document.head.appendChild(script);
    });
  }

  async function boot(){
    if(!window.ProgramUsageCatalog)await loadScript('programUsageCatalogScriptV1','/js/program-usage-catalog.js?v=20260914-1');
    if(!window.ProgramAdminUsageSettings)await loadScript('adminProgramUsageSettingsScriptV2','/js/admin-program-usage-settings.js?v=20260914-1');
    document.documentElement.dataset.adminProgramUsageBootstrap='ready';
  }

  window.ProgramAdminPdfUsageSettings=Object.freeze({
    load:()=>window.ProgramAdminUsageSettings?.load?.({showStatus:true}),
    save:()=>window.ProgramAdminUsageSettings?.saveAll?.(),
    get loaded(){return Boolean(window.ProgramAdminUsageSettings?.loaded);},
    stage:'admin-pdf-usage-compatibility-bootstrap-v2'
  });

  boot().catch(error=>console.error('[admin-program-usage] bootstrap failed',error));
})();
