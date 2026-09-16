// Compatibility shim for the retired result-generation quota guard.
(function(){
  'use strict';
  if(window.__programUsageOutputGuardRetiredV1)return;
  window.__programUsageOutputGuardRetiredV1=true;

  window.ProgramUsageOutputGuard=Object.freeze({
    ensureDependencies:async()=>window.ProgramUsagePolicy||null,
    commitPending:async()=>true,
    get pending(){return null;},
    stage:'program-usage-output-guard-retired'
  });
  document.documentElement.dataset.programUsageOutputGuard='retired';
})();
