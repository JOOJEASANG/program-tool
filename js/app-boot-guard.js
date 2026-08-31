(function(){
  'use strict';
  if(window.__programStudioBootGuardV3)return;
  window.__programStudioBootGuardV3=true;

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

  const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  function isGeneralDesignEditor(){return ['/design-editor/general','/design-editor/general.html'].some(item=>path.endsWith(item));}
  function isPdfPrintEditor(){return ['/tools/pdf-editor.html','/pdf-editor','/pdf-editor/index.html'].some(item=>path.endsWith(item));}

  function loadRuntimeScript(id,src,enabled){
    if(!enabled||document.getElementById(id))return;
    const script=document.createElement('script');
    script.id=id;
    script.src=src;
    script.async=false;
    document.head.appendChild(script);
  }
  function loadDesignRuntimeScript(id,src){loadRuntimeScript(id,src,isGeneralDesignEditor());}

  loadDesignRuntimeScript('designTextAutoFitScriptV1','/js/design-editor/text-auto-fit.js?v=20260826-2');
  loadDesignRuntimeScript('designTypographyProScriptV1','/js/design-editor/typography-pro.js?v=20260827-1');
  loadDesignRuntimeScript('designLocalFontsScriptV1','/js/design-editor/local-fonts.js?v=20260827-1');
  loadDesignRuntimeScript('designShapeBorderControlsScriptV1','/js/design-editor/shape-border-controls.js?v=20260827-1');
  loadDesignRuntimeScript('designShapeInspectorUxScriptV1','/js/design-editor/shape-inspector-ux.js?v=20260827-1');
  loadDesignRuntimeScript('designPrintProductionStage2ScriptV1','/js/design-editor/print-production-stage2.js?v=20260826-1');
  loadRuntimeScript('pdfPrintWorkflowFocusScriptV1','/js/pdf-editor/print-workflow-focus.js?v=20260827-1',isPdfPrintEditor());

  let revealed=false;
  let style=null;
  function reveal(){
    if(revealed)return;
    revealed=true;
    root.classList.remove('app-booting');
    root.dataset.appReady='true';
    if(style)requestAnimationFrame(()=>style.remove());
  }

  window.ProgramStudioBoot={...(window.ProgramStudioBoot||{}),reveal,protectedProgram};
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

  function redirectRuntimeFailure(){
    const target=new URL('/approval-waiting.html',location.origin);
    target.searchParams.set('status','runtime');
    target.searchParams.set('program',protectedProgram);
    location.replace(target.href);
  }

  async function waitForPreflightRuntime(){
    if(protectedProgram!=='preflight')return;
    const deadline=Date.now()+9000;
    while(Date.now()<deadline){
      const ready=window.ProgramStudioPreflightRuntimeReady;
      if(ready&&typeof ready.then==='function'){
        await ready;
        if(document.body?.dataset?.pdfPreflightUi!=='clean-workspace-v2'){
          await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
        }
        if(document.body?.dataset?.pdfPreflightUi!=='clean-workspace-v2')throw new Error('PDF preflight workspace did not reach the current UI state');
        return;
      }
      await delay(40);
    }
    throw new Error('PDF preflight runtime was not initialized');
  }

  function waitForApproval(){
    if(revealed)return;
    const ready=window.ProgramAccessReady;
    if(ready&&typeof ready.then==='function'){
      Promise.resolve(ready).then(async access=>{
        if(!access)return;
        try{
          await waitForPreflightRuntime();
          clearTimeout(failClosedTimer);
          reveal();
        }catch(error){
          console.error('Protected runtime failed before reveal',error);
          clearTimeout(failClosedTimer);
          redirectRuntimeFailure();
        }
      }).catch(()=>{});
      return;
    }
    if(Date.now()-started<11000)setTimeout(waitForApproval,40);
  }
  waitForApproval();
})();