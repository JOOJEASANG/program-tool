(function(){
  'use strict';
  if(window.__programStudioModularAppAccessV1)return;
  window.__programStudioModularAppAccessV1=true;

  const path=String(location.pathname||'').replace(/\\/g,'/').replace(/\/+$/,'');
  const match=path.match(/^\/apps\/([^/]+)$/i);
  const key=match?String(match[1]||'').toLowerCase():'';
  const programId=['pdf-layout','booklet'].includes(key)?'pdf-editor':'';
  if(!programId)return;

  // The modular shell owns only the protected PDF layout/booklet routes.
  // Print-checker design routes redirect synchronously in apps/index.html and
  // therefore do not share this access adapter or any retired design runtime.
  if(!window.ProgramAccess||typeof window.ProgramAccess.guardTool!=='function'){
    console.error('[modular-app-access] shared ProgramAccess guard is unavailable');
    return;
  }

  const boot=window.ProgramStudioBoot;
  if(boot&&typeof boot.reveal==='function'&&!boot.__modularRevealWrapped){
    const reveal=boot.reveal.bind(boot);
    boot.reveal=function(){
      if(document.documentElement.dataset.accessReady!=='true')return false;
      return reveal();
    };
    boot.__modularRevealWrapped=true;
  }

  const root=document.documentElement;
  root.dataset.accessChecking='true';
  const accessPromise=window.ProgramAccess.guardTool({
    programId,
    loginUrl:'/login.html',
    waitingUrl:'/approval-waiting.html',
    timeoutMs:8000
  });
  window.ProgramAccessReady=accessPromise;
  Promise.resolve(accessPromise).finally(()=>{
    delete root.dataset.accessChecking;
  });

  window.ProgramStudioModularAppAccess={key,programId,stage:'shared-pdf-program-access-adapter-v2'};
})();
