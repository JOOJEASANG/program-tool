(function(){
  'use strict';
  if(window.__programStudioModularAppAccessV1)return;
  window.__programStudioModularAppAccessV1=true;

  const path=String(location.pathname||'').replace(/\\/g,'/').replace(/\/+$/,'');
  const match=path.match(/^\/apps\/([^/]+)$/i);
  const key=match?String(match[1]||'').toLowerCase():'';
  const programId=['pdf-layout','booklet'].includes(key)
    ?'pdf-editor'
    :(['cover','poster','flyer','invitation','notice','leaflet'].includes(key)?'design-studio':'');
  if(!programId)return;

  // firebase-config historically auto-guards only canonical editor paths. The
  // modular shell deliberately reuses the same guard rather than duplicating
  // authentication or permission rules.
  if(!window.ProgramAccess||typeof window.ProgramAccess.guardTool!=='function'){
    console.error('[modular-app-access] shared ProgramAccess guard is unavailable');
    return;
  }

  // sw-register is injected by firebase-config as a deferred compatibility
  // loader. On /apps/* it does not own access control, so prevent an external
  // reveal until the shared permission guard marks this route ready.
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

  window.ProgramStudioModularAppAccess={key,programId,stage:'shared-program-access-adapter-v1'};
})();
