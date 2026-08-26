(function(){
  if(window.__programStudioBootGuardV2)return;
  window.__programStudioBootGuardV2=true;

  const root=document.documentElement;
  const path=String(location.pathname||'').replace(/\\/g,'/').replace(/\/+$/,'');
  const protectedProgram=(function(){
    if(['/tools/pdf-editor.html','/pdf-editor','/pdf-editor/index.html'].some(item=>path.endsWith(item)))return 'pdf-editor';
    if(['/tools/preflight.html','/tools/pdf-Checker.html','/pdf-preflight','/pdf-preflight/index.html'].some(item=>path.endsWith(item)))return 'preflight';
    if(['/tools/perfect-binding-cover.html','/perfect-binding-cover','/perfect-binding-cover/index.html','/design-editor','/design-editor/index.html','/design-editor/general','/design-editor/general.html'].some(item=>path.endsWith(item)))return 'design-studio';
    if(['/document-editor','/document-editor/index.html'].some(item=>path.endsWith(item)))return 'document-editor';
    if(['/image-editor','/image-editor/index.html'].some(item=>path.endsWith(item)))return 'image-editor';
    return '';
  })();

  function loadDesignPrintProductionStage2(){
    if(!(['/design-editor/general','/design-editor/general.html'].some(item=>path.endsWith(item))))return;
    if(document.getElementById('designPrintProductionStage2ScriptV1'))return;
    const script=document.createElement('script');
    script.id='designPrintProductionStage2ScriptV1';
    script.src='/js/design-editor/print-production-stage2.js?v=20260826-1';
    script.async=false;
    document.head.appendChild(script);
  }
  loadDesignPrintProductionStage2();

  root.classList.add('app-booting');
  if(protectedProgram)root.dataset.approvalRequired='true';

  const style=document.createElement('style');
  style.id='programStudioBootGuardStyle';
  style.textContent=`
    html.app-booting body{pointer-events:none!important}
    html.app-booting::before{
      content:"";position:fixed;inset:0;z-index:2147483646;background:rgba(248,250,252,.96);
    }
    html.app-booting::after{
      content:"";position:fixed;left:50%;top:50%;z-index:2147483647;
      width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:50%;
      border:3px solid #dbe5ee;border-top-color:#1769e0;
      animation:programStudioBootSpin .72s linear infinite;
    }
    @keyframes programStudioBootSpin{to{transform:rotate(360deg)}}
    @media(prefers-reduced-motion:reduce){html.app-booting::after{animation-duration:1.4s}}
  `;
  document.head.appendChild(style);

  // firebase-config.js temporarily hides the document while it checks access.
  // Keep the body renderable behind this non-interactive boot layer so users see
  // a stable loading state instead of a flash of an unauthorized tool.
  const accessStyle=document.createElement('style');
  accessStyle.id='programStudioAccessVisibilityStyle';
  accessStyle.textContent='html[data-access-checking] body{visibility:visible!important}';
  document.head.appendChild(accessStyle);

  let revealed=false;
  function reveal(){
    if(revealed)return;
    revealed=true;
    root.classList.remove('app-booting');
    root.dataset.appReady='true';
    requestAnimationFrame(()=>style.remove());
  }

  window.ProgramStudioBoot={...(window.ProgramStudioBoot||{}),reveal};
  window.addEventListener('pageshow',event=>{
    if(event.persisted&&!protectedProgram)reveal();
  });

  if(!protectedProgram){
    setTimeout(reveal,1800);
    return;
  }

  const started=Date.now();
  const failClosedTimer=setTimeout(()=>{
    if(revealed)return;
    const target=new URL('/approval-waiting.html',location.origin);
    target.searchParams.set('status','timeout');
    target.searchParams.set('program',protectedProgram);
    location.replace(target.href);
  },10500);

  function waitForApproval(){
    if(revealed)return;
    const ready=window.ProgramAccessReady;
    if(ready&&typeof ready.then==='function'){
      Promise.resolve(ready).then(access=>{
        if(access){
          clearTimeout(failClosedTimer);
          reveal();
        }
      }).catch(()=>{});
      return;
    }
    if(Date.now()-started<10000)setTimeout(waitForApproval,40);
  }
  waitForApproval();
})();
