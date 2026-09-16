// Compatibility shim retained for old cached admin pages.
// Usage-count controls were retired: approved members may use the service without a quota.
(function(){
  'use strict';
  if(window.__programAdminUsageCompatibilityRetiredV1)return;
  window.__programAdminUsageCompatibilityRetiredV1=true;

  function cleanup(){
    document.getElementById('adminProgramUsageNav')?.remove();
    document.getElementById('programusage')?.remove();
    document.documentElement.dataset.adminProgramUsageBootstrap='retired';
  }

  window.ProgramAdminPdfUsageSettings=Object.freeze({
    load:async()=>[],
    save:async()=>true,
    get loaded(){return true;},
    stage:'admin-usage-limits-retired'
  });

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',cleanup,{once:true});
  else cleanup();
})();
