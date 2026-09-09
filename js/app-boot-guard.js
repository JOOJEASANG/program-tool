(function(){
  'use strict';
  if(window.__programStudioBootGuardV4)return;
  window.__programStudioBootGuardV4=true;

  const root=document.documentElement;
  const path=String(location.pathname||'').replace(/\\/g,'/').replace(/\/+$/,'');
  const modularAppKey=(function(){
    const match=path.match(/^\/apps\/([^/]+)$/i);
    return match?String(match[1]||'').toLowerCase():'';
  })();
  const protectedProgram=(function(){
    if(['pdf-layout','booklet'].includes(modularAppKey))return 'pdf-editor';
    if(['cover','poster','flyer','invitation','notice','leaflet'].includes(modularAppKey))return 'design-studio';
    if(['/tools/pdf-editor.html','/pdf-editor','/pdf-editor/index.html','/pdf-editor-advanced'].some(item=>path.endsWith(item)))return 'pdf-editor';
    if(['/tools/preflight.html','/tools/pdf-Checker.html','/pdf-preflight','/pdf-preflight/index.html'].some(item=>path.endsWith(item)))return 'preflight';
    if(['/tools/perfect-binding-cover.html','/perfect-binding-cover','/perfect-binding-cover/index.html'].some(item=>path.endsWith(item)))return 'design-studio';
    return '';
  })();

  const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  function isPdfPrintEditor(){return ['/tools/pdf-editor.html','/pdf-editor','/pdf-editor/index.html','/pdf-editor-advanced'].some(item=>path.endsWith(item));}
  function isAdvancedPdfEditor(){
    if(path.endsWith('/pdf-editor-advanced'))return true;
    if(!isPdfPrintEditor())return false;
    try{return String(new URLSearchParams(location.search).get('profile')||'').trim().toLowerCase()==='advanced';}
    catch(_){return false;}
  }

  const advancedPdfEditor=isAdvancedPdfEditor();
  if(advancedPdfEditor){
    root.dataset.pdfEditorProfile='advanced';
    root.dataset.pdfEditorAdvancedRoute='1';
    root.dataset.pdfPrintWorkflowSuppressed='advanced';
    const style=document.createElement('style');
    style.id='pdfAdvancedEarlyIsolationStylesV1';
    style.textContent=`
      html[data-pdf-editor-profile="advanced"] #nupGrid,
      html[data-pdf-editor-profile="advanced"] #bookletRow,
      html[data-pdf-editor-profile="advanced"] #nupQuickGuide,
      html[data-pdf-editor-profile="advanced"] #fileLayoutControl,
      html[data-pdf-editor-profile="advanced"] #pdfSpreadSplitPanel,
      html[data-pdf-editor-profile="advanced"] #sb-nup > .field:nth-of-type(2),
      html[data-pdf-editor-profile="advanced"] .prev-ins-zone,
      html[data-pdf-editor-profile="advanced"] .prev-ins-zone-v,
      html[data-pdf-editor-profile="advanced"] .mode-btn[data-mode="break"],
      html[data-pdf-editor-profile="advanced"] #dividerModal,
      html[data-pdf-editor-profile="advanced"] #pdfPrintWorkflowFocusPanel,
      html[data-pdf-editor-profile="advanced"] #pdfPrintUtilityRedirectCard{display:none!important}
      html[data-pdf-editor-profile="advanced"] #sb-nup > .field:first-of-type > label{display:none!important}
    `;
    document.head.appendChild(style);
  }

  function loadRuntimeScript(id,src,enabled){
    if(!enabled)return null;
    const existing=document.getElementById(id);
    if(existing)return existing;
    const script=document.createElement('script');
    script.id=id;
    script.src=src;
    script.async=false;
    script.addEventListener('load',()=>{script.dataset.loaded='true';},{once:true});
    script.addEventListener('error',()=>{script.dataset.failed='error';},{once:true});
    document.head.appendChild(script);
    return script;
  }

  // The normal print-layout workflow owns N-UP/booklet controls. Never mount it
  // on the dedicated advanced profile: advanced runtime reuses only the
  // single-page precision transform modules and must stay isolated.
  loadRuntimeScript('pdfPrintWorkflowFocusScriptV1','/js/pdf-editor/print-workflow-focus.js?v=20260827-1',isPdfPrintEditor()&&!advancedPdfEditor);
  // Prime the current preflight presentation behind the boot overlay so the
  // legacy workspace never flashes before clean-workspace-v2 takes ownership.
  loadRuntimeScript('pdfPreflightPanelBalanceScriptV1','/js/pdf-preflight-panel-balance.js?v=20260831-3',protectedProgram==='preflight');

  let revealed=false;
  let style=null;
  function reveal(stage){
    if(revealed)return;
    revealed=true;
    root.classList.remove('app-booting');
    root.dataset.appReady='true';
    root.dataset.bootGate=stage||'functional-runtime';
    if(style)requestAnimationFrame(()=>style.remove());
  }

  window.ProgramStudioBoot={...(window.ProgramStudioBoot||{}),reveal,protectedProgram};
  window.ProgramStudioBoot.modularAppKey=modularAppKey;

  if(!protectedProgram){reveal('public');return;}

  root.classList.add('app-booting');
  root.dataset.approvalRequired='true';

  style=document.createElement('style');
  style.id='programStudioBootGuardStyle';
  style.textContent=`
    html.app-booting body{pointer-events:none!important}
    html.app-booting::before{content:"";position:fixed;inset:0;z-index:2147483646;background:rgba(248,250,252,.96);visibility:visible!important}
    html.app-booting::after{content:"";position:fixed;left:50%;top:50%;z-index:2147483647;width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:50%;border:3px solid #dbe5ee;border-top-color:#1769e0;animation:programStudioBootSpin .72s linear infinite;visibility:visible!important}
    @keyframes programStudioBootSpin{to{transform:rotate(360deg)}}
    @media(prefers-reduced-motion:reduce){html.app-booting::after{animation-duration:1.4s}}
  `;
  document.head.appendChild(style);

  const accessStyle=document.createElement('style');
  accessStyle.id='programStudioAccessVisibilityStyle';
  accessStyle.textContent='html[data-access-checking] body{visibility:visible!important}';
  document.head.appendChild(accessStyle);

  const started=Date.now();
  const failClosedTimer=setTimeout(()=>{
    if(revealed)return;
    const target=new URL('/approval-waiting.html',location.origin);
    target.searchParams.set('status','timeout');
    target.searchParams.set('program',protectedProgram);
    location.replace(target.href);
  },12000);

  async function waitUntil(predicate,timeoutMs){
    const deadline=Date.now()+timeoutMs;
    while(Date.now()<deadline){
      try{if(predicate())return true;}catch(_){}
      await delay(40);
    }
    return false;
  }

  async function waitForPreflightFunctionalReady(){
    if(protectedProgram!=='preflight')return true;
    // Access approval is the only hard gate for this route. The full preflight
    // runtime may continue wiring utilities after first paint, so never hold the
    // page behind the overlay while every optional module settles.
    const runtimeStarted=await waitUntil(()=>Boolean(window.ProgramStudioPreflightRuntimeReady),220);
    const uiReady=await waitUntil(()=>document.body?.dataset?.pdfPreflightUi==='clean-workspace-v2',480);
    const ready=runtimeStarted&&uiReady;
    root.dataset.preflightFunctionalReady=ready?'1':'0';
    root.dataset.preflightRevealStage=ready?'core-started':'access-unblocked';
    if(!ready)console.warn('PDF preflight opened after access while remaining runtime modules continue loading.');
    return ready;
  }

  function retryApprovalWait(){
    if(revealed||Date.now()-started>=11000)return;
    setTimeout(waitForApproval,60);
  }

  function waitForApproval(){
    if(revealed)return;
    const ready=window.ProgramAccessReady;
    if(ready&&typeof ready.then==='function'){
      Promise.resolve(ready).then(async access=>{
        if(!access){retryApprovalWait();return;}
        clearTimeout(failClosedTimer);
        const functional=await waitForPreflightFunctionalReady();
        reveal(functional?'functional-runtime':'functional-timeout');
      }).catch(error=>{
        console.warn('Program access readiness promise failed before reveal.',error);
        retryApprovalWait();
      });
      return;
    }
    retryApprovalWait();
  }
  waitForApproval();
})();
