(function(){
  if(window.__programStudioCacheBoot)return;
  window.__programStudioCacheBoot=true;
  const VERSION='2026.07.23.005';
  function load(id,src){if(document.getElementById(id))return;const s=document.createElement('script');s.id=id;s.src=src;s.async=false;s.defer=true;document.head.appendChild(s)}
  function isPath(...parts){const path=location.pathname.replace(/\/+$/,'');return parts.some(p=>path.endsWith(p))}
  async function clearLegacyCaches(){try{if('caches'in window){const keys=await caches.keys();await Promise.all(keys.filter(k=>!k.includes(VERSION)).map(k=>caches.delete(k)))}}catch(_){}}
  async function register(){if(!('serviceWorker'in navigator))return;try{const reg=await navigator.serviceWorker.register('/sw.js?v='+encodeURIComponent(VERSION),{updateViaCache:'none'});await reg.update().catch(()=>{});if(reg.waiting)reg.waiting.postMessage({type:'SKIP_WAITING'})}catch(e){console.warn('Service worker registration failed',e)}}
  function helpers(){
    load('appVersionHelperScript','/js/app-version.js?v='+VERSION);
    load('programPathMapperScript','/js/program-paths.js?v='+VERSION);
    if(location.pathname==='/'||location.pathname.endsWith('/index.html'))load('homeCleanupScript','/js/home-cleanup.js?v='+VERSION);
    if(isPath('/tools/pdf-editor.html','/pdf-editor','/pdf-editor/index.html'))load('pdfEditorModuleLoaderScript','/js/pdf-editor/loader.js?v='+VERSION);
    if(isPath('/tools/pdf-Checker.html','/tools/preflight.html','/pdf-preflight','/pdf-preflight/index.html'))load('pdfCheckerFinalGuardScript','/js/pdf-checker-final-guard.js?v='+VERSION);
    if(isPath('/tools/perfect-binding-cover.html','/perfect-binding-cover','/perfect-binding-cover/index.html')){
      load('perfectBindingFineControlsScript','/js/perfect-binding-cover-fine-controls.js?v='+VERSION);
      load('coverTextZonesScriptV3','/js/cover-editor-text-zones-v2.js?v='+VERSION);
      load('coverTextUiRefineScriptV4','/js/cover-text-ui-refine.js?v='+VERSION);
      load('coverPreviewWorkspaceScriptV2','/js/cover-preview-workspace.js?v='+VERSION);
      load('coverProjectStateBridgeScriptV1','/js/cover-project-state-bridge.js?v='+VERSION);
    }
  }
  async function boot(){await clearLegacyCaches();await register();helpers()}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
