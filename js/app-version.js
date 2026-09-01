// Program Studio version observer. Version changes are recorded without forcing a reload.
(function(){
  'use strict';
  if(window.__appVersionObserverV7)return;
  window.__appVersionObserverV7=true;
  if(/^\/login(?:\.html)?\/?$/.test(location.pathname))return;

  const LOCAL_KEY='programStudioVersion';
  const CHECK_INTERVAL_MS=10*60*1000;
  const currentPath=location.pathname.replace(/\/+$/,'')||'/';
  let lastCheckAt=0;
  let checkPromise=null;

  function loadScopedScript(id,src){
    if(document.getElementById(id))return;
    const script=document.createElement('script');
    script.id=id;script.src=src;script.async=false;
    script.onload=()=>script.dataset.loaded='true';
    document.head.appendChild(script);
  }

  // Only enhancements without a canonical route-runtime owner belong here.
  function loadObserverOwnedEnhancements(){
    if(currentPath==='/admin'||currentPath==='/admin.html'||currentPath.endsWith('/admin.html')){
      loadScopedScript('aiDesignFeatureGateScriptV1','/js/ai-design-feature-gate.js?v=20260824-1');
    }
    if(currentPath==='/design-editor'||currentPath==='/design-editor/index.html'||currentPath==='/design-editor/general'||currentPath==='/design-editor/general.html'||currentPath.endsWith('/design-editor/general.html')){
      loadScopedScript('aiDesignFeatureGateScriptV1','/js/ai-design-feature-gate.js?v=20260824-1');
      loadScopedScript('designPreviewGuideEnhancementScriptV1','/js/design-editor/preview-guide-enhancement.js?v=20260825-3');
      loadScopedScript('designCoverPreviewCleanupScriptV1','/js/design-editor/cover-preview-cleanup.js?v=20260825-3');
      loadScopedScript('designPrintFoldProductionScriptV1','/js/design-editor/print-fold-production.js?v=20260825-1');
    }
  }

  function readStoredVersion(){try{return localStorage.getItem(LOCAL_KEY)||''}catch(_){return ''}}
  function writeStoredVersion(value){try{localStorage.setItem(LOCAL_KEY,value)}catch(_){}}

  async function check({force=false}={}){
    const now=Date.now();
    if(!force&&now-lastCheckAt<CHECK_INTERVAL_MS)return window.ProgramStudioVersion||null;
    if(checkPromise)return checkPromise;
    lastCheckAt=now;
    checkPromise=(async()=>{
      try{
        const response=await fetch('/version.json?t='+Date.now(),{cache:'no-store',headers:{'Cache-Control':'no-cache'}});
        if(!response.ok)return window.ProgramStudioVersion||null;
        const data=await response.json();
        const currentVersion=String(data.version||'').trim();
        if(!currentVersion||currentVersion==='unknown')return window.ProgramStudioVersion||null;
        const previousVersion=readStoredVersion();
        writeStoredVersion(currentVersion);
        window.ProgramStudioVersion={version:currentVersion,previousVersion,changed:Boolean(previousVersion&&previousVersion!==currentVersion),label:String(data.label||''),updatedAt:String(data.updatedAt||'')};
        if(window.ProgramStudioVersion.changed)window.dispatchEvent(new CustomEvent('program-studio-version-changed',{detail:window.ProgramStudioVersion}));
        return window.ProgramStudioVersion;
      }catch(error){console.warn('Program Studio version check failed',error);return window.ProgramStudioVersion||null;}
      finally{checkPromise=null;}
    })();
    return checkPromise;
  }

  function checkWhenActive(){if(document.visibilityState!=='hidden')check({force:false});}
  loadObserverOwnedEnhancements();
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>check({force:true}),{once:true});
  else check({force:true});
  setInterval(checkWhenActive,CHECK_INTERVAL_MS);
  window.addEventListener('focus',checkWhenActive);
  document.addEventListener('visibilitychange',checkWhenActive);
  window.ProgramStudioVersionCheck=()=>check({force:true});
})();