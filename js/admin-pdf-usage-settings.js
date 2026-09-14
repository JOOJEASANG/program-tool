// Compatibility bootstrap for the retired usage-count administration entry point.
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
      const script=document.createElement('script');script.id=id;script.src=src;script.async=false;
      script.addEventListener('load',()=>{script.dataset.loaded='true';resolve(script);},{once:true});
      script.addEventListener('error',reject,{once:true});document.head.appendChild(script);
    });
  }

  async function boot(){
    if(!window.ProgramAdminAccessControl)await loadScript('programAccessAdminScriptV1','/js/admin-access-control.js?v=20260914-1');
    if(!window.AdminFirebaseUsage)await loadScript('firebaseUsageAdminScriptV1','/js/admin-firebase-usage.js?v=20260914-1');
    document.documentElement.dataset.adminProgramUsageBootstrap='approval-only';
  }

  window.ProgramAdminPdfUsageSettings=Object.freeze({
    load:()=>window.ProgramAdminAccessControl?.refresh?.(),
    save:()=>false,
    get loaded(){return Boolean(window.ProgramAdminAccessControl);},
    stage:'admin-usage-count-retired-approval-compat-v3'
  });

  boot().catch(error=>console.error('[admin-access] compatibility bootstrap failed',error));
})();
