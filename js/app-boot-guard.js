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
    if(['/tools/pdf-editor.html','/pdf-editor','/pdf-editor/index.html'].some(item=>path.endsWith(item)))return 'pdf-editor';
    if(['/tools/preflight.html','/tools/pdf-Checker.html','/pdf-preflight','/pdf-preflight/index.html'].some(item=>path.endsWith(item)))return 'preflight';
    if(['/tools/perfect-binding-cover.html','/perfect-binding-cover','/perfect-binding-cover/index.html','/design-editor','/design-editor/index.html','/design-editor/general','/design-editor/general.html'].some(item=>path.endsWith(item)))return 'design-studio';
    if(['/document-editor','/document-editor/index.html'].some(item=>path.endsWith(item)))return 'document-editor';
    if(['/image-editor','/image-editor/index.html'].some(item=>path.endsWith(item)))return 'image-editor';
    return '';
  })();

  const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  function isGeneralDesignEditor(){return ['/design-editor/general','/design-editor/general.html'].some(item=>path.endsWith(item));}
  function isPdfPrintEditor(){return ['/tools/pdf-editor.html','/pdf-editor','/pdf-editor/index.html'].some(item=>path.endsWith(item));}

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
  function loadDesignRuntimeScript(id,src){loadRuntimeScript(id,src,isGeneralDesignEditor());}

  loadDesignRuntimeScript('designTextAutoFitScriptV1','/js/design-editor/text-auto-fit.js?v=20260826-2');
  loadDesignRuntimeScript('designTypographyProScriptV1','/js/design-editor/typography-pro.js?v=20260827-1');
  loadDesignRuntimeScript('designLocalFontsScriptV1','/js/design-editor/local-fonts.js?v=20260827-1');
  loadDesignRuntimeScript('designShapeBorderControlsScriptV1','/js/design-editor/shape-border-controls.js?v=20260827-1');
  loadDesignRuntimeScript('designShapeInspectorUxScriptV1','/js/design-editor/shape-inspector-ux.js?v=20260827-1');
  loadDesignRuntimeScript('designPrintProductionStage2ScriptV1','/js/design-editor/print-production-stage2.js?v=20260826-1');
  loadRuntimeScript('pdfPrintWorkflowFocusScriptV1','/js/pdf-editor/print-workflow-focus.js?v=20260827-1',isPdfPrintEditor());
  // Prime only the lightweight current preflight presentation. The canonical
  // runtime still owns the full module chain and will reuse this loaded script.
  loadRuntimeScript('pdfPreflightPanelBalanceScriptV1','/js/pdf-preflight-panel-balance.js?v=20260831-3',protectedProgram==='preflight');

  let revealed=false;
  let style=null;
  function reveal(){
    if(revealed)return;
    revealed=true;
    root.classList.remove('app-booting');
    root.dataset.appReady='true';
    if(style)requestAnimationFrame(()=>style.remove());
  }

  window.ProgramStudioBoot={...(window.ProgramStudioBoot||{}),reveal,protectedProgram,modularAppKey};
  if(!protectedProgram){reveal();return;}

  root.classList.add('app-booting');
  root.dataset.approvalRequired='true';

  style=document.createElement('style');
  style.id='programStudioBootGuardStyle';
  style.textContent=`
    html.app-booting body{pointer-events:none!important}
    html.app-booting::before{content:"";position:fixed;inset:0;z-index:2147483646;background:rgba(248,250,252,.96)}
    html.app-booting::after{content:"";position:fixed;left:50%;top:50%;z-index:2147483647;width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:50%;border:3px solid #dbe5ee;border-top-color:#1769e0;animation:programStudioBootSpin .72s linear infinite}
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

  async function waitForPreflightShell(){
    if(protectedProgram!=='preflight')return;
    const ready=await waitUntil(()=>document.body?.dataset?.pdfPreflightUi==='clean-workspace-v2',2800);
    if(!ready)console.warn('PDF preflight shell is still enhancing; revealing the base workspace to avoid blocking the tool.');
  }

  async function waitForDesignShell(){
    if(protectedProgram!=='design-studio'||!isGeneralDesignEditor())return;
    const ready=await waitUntil(()=>Boolean(
      window.DesignEditorEssentialWorkspace?.stage||
      (window.DesignEditorApp&&(document.getElementById('editorShell')||document.getElementById('startScreen')))
    ),2800);
    if(!ready)console.warn('Design editor enhancements are still loading; revealing the base workspace to avoid blocking the tool.');
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
        // Access is the only fail-closed gate. Route enhancements may continue in
        // the background, but must never keep an approved user behind a spinner.
        clearTimeout(failClosedTimer);
        try{
          await Promise.all([waitForPreflightShell(),waitForDesignShell()]);
        }catch(error){
          console.warn('Protected route enhancement wait failed; continuing with the base workspace.',error);
        }
        reveal();
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