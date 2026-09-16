(function(){
  'use strict';
  if(window.__programStudioBootGuardV5)return;
  window.__programStudioBootGuardV5=true;

  const root=document.documentElement;
  const path=String(location.pathname||'').replace(/\\/g,'/').replace(/\/+$/,'');
  const modularAppKey=(function(){
    const match=path.match(/^\/apps\/([^/]+)$/i);
    return match?String(match[1]||'').toLowerCase():'';
  })();
  const protectedProgram=(function(){
    if(['pdf-layout','booklet'].includes(modularAppKey))return 'pdf-editor';
    if(['cover','poster','flyer','invitation','notice','leaflet'].includes(modularAppKey))return 'design-studio';
    if(['/print-checker','/print-checker/index.html'].some(item=>path.endsWith(item)))return 'print-checker';
    if(['/smart-print-layout','/smart-print-layout/index.html'].some(item=>path.endsWith(item)))return 'smart-print-layout';
    if(['/pdf-suite','/pdf-suite/index.html'].some(item=>path.endsWith(item)))return 'pdf-suite';
    if(['/tools/pdf-editor.html','/pdf-editor','/pdf-editor/index.html','/pdf-editor-advanced','/pdf-editor-advanced/index.html'].some(item=>path.endsWith(item)))return 'pdf-editor';
    if(['/tools/preflight.html','/tools/pdf-Checker.html','/pdf-preflight','/pdf-preflight/index.html'].some(item=>path.endsWith(item)))return 'preflight';
    if(['/tools/perfect-binding-cover.html','/perfect-binding-cover','/perfect-binding-cover/index.html'].some(item=>path.endsWith(item)))return 'design-studio';
    return '';
  })();

  const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  function isHomeRoute(){return path===''||path==='/index.html';}
  function isStandaloneAdvancedPdfEditor(){return path.endsWith('/pdf-editor-advanced')||path.endsWith('/pdf-editor-advanced/index.html');}
  function isPdfPrintEditor(){return ['/tools/pdf-editor.html','/pdf-editor','/pdf-editor/index.html'].some(item=>path.endsWith(item));}
  function isLegacyAdvancedPdfProfile(){
    if(!isPdfPrintEditor())return false;
    try{return String(new URLSearchParams(location.search).get('profile')||'').trim().toLowerCase()==='advanced';}
    catch(_){return false;}
  }

  let homeCatalogObserver=null;
  let homeCatalogTimer=0;
  let homeCatalogStyle=null;
  function releaseHomeCatalog(stage='ready'){
    if(!root.classList.contains('program-home-booting'))return;
    root.classList.remove('program-home-booting');
    root.dataset.homeCatalogFirstPaint=stage;
    if(homeCatalogObserver){homeCatalogObserver.disconnect();homeCatalogObserver=null;}
    if(homeCatalogTimer){clearTimeout(homeCatalogTimer);homeCatalogTimer=0;}
    homeCatalogStyle?.remove();homeCatalogStyle=null;
  }
  function installHomeCatalogGuard(){
    if(!isHomeRoute())return;
    root.classList.add('program-home-booting');
    root.dataset.homeCatalogFirstPaint='waiting';
    homeCatalogStyle=document.createElement('style');
    homeCatalogStyle.id='programStudioHomeCatalogFirstPaintStyle';
    homeCatalogStyle.textContent=`
      html.program-home-booting #quickSection,
      html.program-home-booting .programs-header,
      html.program-home-booting #programGrid{visibility:hidden!important}
    `;
    document.head.appendChild(homeCatalogStyle);
    const sync=()=>{
      if(root.dataset.pdfHomeUnified==='ready')releaseHomeCatalog('ready');
    };
    if(typeof MutationObserver==='function'){
      homeCatalogObserver=new MutationObserver(sync);
      homeCatalogObserver.observe(root,{attributes:true,attributeFilter:['data-pdf-home-unified']});
    }
    homeCatalogTimer=setTimeout(()=>releaseHomeCatalog('fallback'),4000);
    sync();
  }
  installHomeCatalogGuard();

  const legacyAdvancedProfile=isLegacyAdvancedPdfProfile();
  const standaloneAdvanced=isStandaloneAdvancedPdfEditor();
  if(legacyAdvancedProfile){
    root.dataset.pdfEditorProfile='advanced';
    root.dataset.pdfEditorAdvancedRoute='legacy-profile';
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
  if(standaloneAdvanced){
    root.dataset.pdfAdvancedStandaloneRoute='1';
    root.dataset.pdfPrintWorkflowSuppressed='standalone-advanced';
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

  loadRuntimeScript('pdfPrintWorkflowFocusScriptV1','/js/pdf-editor/print-workflow-focus.js?v=20260827-1',isPdfPrintEditor()&&!legacyAdvancedProfile);
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
  window.ProgramStudioBoot.releaseHomeCatalog=releaseHomeCatalog;

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
    const runtimeStarted=await waitUntil(()=>Boolean(window.ProgramStudioPreflightRuntimeReady),220);
    const uiReady=await waitUntil(()=>document.body?.dataset?.pdfPreflightUi==='clean-workspace-v2',480);
    const ready=runtimeStarted&&uiReady;
    root.dataset.preflightFunctionalReady=ready?'1':'0';
    root.dataset.preflightRevealStage=ready?'core-started':'access-unblocked';
    if(!ready)console.warn('PDF preflight opened after access while remaining runtime modules continue loading.');
    return ready;
  }

  async function waitForPdfEditorFunctionalReady(){
    if(!isPdfPrintEditor()||legacyAdvancedProfile)return true;
    const ready=await waitUntil(()=>{
      const api=window.PdfPrintWorkflowFocus;
      const panel=document.getElementById('pdfPrintWorkflowFocusPanel');
      const mode=String(root.dataset.pdfPrintMode||'');
      return api?.stage==='pdf-print-workflow-focus-v1'&&Boolean(panel)&&(mode==='normal'||mode==='booklet');
    },1400);
    root.dataset.pdfEditorFunctionalReady=ready?'1':'0';
    root.dataset.pdfEditorRevealStage=ready?'print-workflow-ready':'access-unblocked';
    if(!ready)console.warn('PDF layout editor opened after access while print workflow presentation continues loading.');
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
        let functional=true;
        if(protectedProgram==='preflight')functional=await waitForPreflightFunctionalReady();
        else if(protectedProgram==='pdf-editor')functional=await waitForPdfEditorFunctionalReady();
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
