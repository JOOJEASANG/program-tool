// Shared approval gate for the print-checker route.
(function(){
  'use strict';
  if(window.__printCheckerAccessV1)return;
  window.__printCheckerAccessV1=true;

  const root=document.documentElement;
  root.dataset.accessChecking='true';
  const release=()=>{
    root.style.visibility='';
    delete root.dataset.accessChecking;
  };
  const watchdog=setTimeout(()=>{
    root.dataset.accessWatchdog='released';
    release();
  },8500);

  if(!window.ProgramAccess||typeof window.ProgramAccess.guardTool!=='function'){
    clearTimeout(watchdog);
    release();
    location.replace('/login.html');
    return;
  }

  const accessPromise=window.ProgramAccess.guardTool({
    programId:'design-studio',
    loginUrl:'/login.html',
    waitingUrl:'/approval-waiting.html',
    timeoutMs:8000
  });
  window.ProgramAccessReady=accessPromise;
  Promise.resolve(accessPromise).finally(()=>{
    clearTimeout(watchdog);
    release();
  });

  window.PrintCheckerAccess={programId:'design-studio',stage:'shared-program-access-v1'};
})();
