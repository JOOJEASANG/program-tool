// Route supported PDF Utility menu clicks straight into the active work/result surface.
(function(){
  'use strict';
  if(window.__programStudioPdfUtilityDirectHookV3)return;
  window.__programStudioPdfUtilityDirectHookV3=true;
  window.__programStudioPdfUtilityDirectHookV2=true;

  const $=id=>document.getElementById(id);
  const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  function sourceNameFor(button){return button?.dataset.pdfuCoreSource||button?.querySelector('.pdfu-menu-name')?.textContent?.trim()||'';}
  function sourceFor(name){return [...document.querySelectorAll('#pdfUtilitySourceStore .tool')].find(node=>node.querySelector('.tool-name')?.textContent?.trim()===name)||null;}
  function toolFor(button){
    const name=sourceNameFor(button);
    const displayName=button?.querySelector('.pdfu-menu-name')?.textContent?.trim()||name;
    const source=sourceFor(name);
    return {name,displayName,desc:source?.querySelector('.tool-desc')?.textContent?.trim()||'',icon:source?.querySelector('.tool-icon')?.textContent?.trim()||'PDF',source};
  }
  function header(tool){
    const title=$('pdfUtilityStageTitle'),desc=$('pdfUtilityStageDesc'),badge=$('pdfUtilityStageBadge'),action=$('pdfUtilityStageAction');
    if(title)title.textContent=tool.displayName||tool.name;
    if(desc)desc.textContent=tool.desc||'이 화면에서 바로 작업합니다.';
    if(badge){badge.textContent='PDF 유틸리티';badge.style.background='#eef5ff';badge.style.color='#1d4ed8';}
    if(action){action.classList.remove('show');action.textContent='실행';delete action.dataset.pdfuGuardAction;}
  }
  function activate(button,event){
    const bridge=window.ProgramStudioPdfUtilityDirectBridge;
    if(!bridge)return false;
    const tool=toolFor(button);
    if(!tool.name||!bridge.handles?.(tool.name))return false;
    const needAuth=bridge.requiresAuth?.(tool.name)===true;
    if(needAuth&&!window.auth?.currentUser)return false;
    event?.preventDefault?.();event?.stopImmediatePropagation?.();
    bridge.reset?.();
    const stage=$('pdfUtilityStageBody');if(!stage)return false;
    stage.replaceChildren();
    document.querySelectorAll('[data-pdfu-tool]').forEach(node=>node.classList.toggle('active',node===button));
    header(tool);
    const ok=bridge.activate(tool);
    if(ok){
      document.documentElement.dataset.pdfUtilityDirectTool=tool.name;
      document.documentElement.dataset.pdfUtilityDirectDisplayTool=tool.displayName||tool.name;
      document.documentElement.dataset.pdfUtilityDirectBridge='active';
      window.ProgramStudioPdfUtilityCentered?.openForTool?.(button,tool);
    }
    return Boolean(ok);
  }

  function ensureScript(id,src,ready){
    if(ready?.())return Promise.resolve();
    const existing=$(id);
    if(existing){
      if(existing.dataset.loaded==='1'||ready?.())return Promise.resolve();
      return new Promise((resolve,reject)=>{existing.addEventListener('load',resolve,{once:true});existing.addEventListener('error',reject,{once:true});});
    }
    return new Promise((resolve,reject)=>{
      const script=document.createElement('script');script.id=id;script.src=src;
      script.onload=()=>{script.dataset.loaded='1';resolve();};script.onerror=reject;document.head.appendChild(script);
    });
  }
  function ensureLargeStorage(){return ensureScript('pdfUtilityDirectLargeStorageScript','/js/pdf-suite/direct-tool-large-storage.js?v=20260915-1',()=>Boolean(window.__programStudioPdfUtilityLargeStorageV1));}
  function ensureCenteredWorkspace(){return ensureScript('pdfUtilityCenteredWorkspaceScript','/js/pdf-suite/centered-workspace.js?v=20260915-4',()=>Boolean(window.__programStudioPdfUtilityCenteredV2));}
  // Keep the established function name/legacy readiness marker for compatibility contracts,
  // but the actual final presentation is now owned by one clean UI module.
  function ensureCenteredFixes(){return ensureScript('pdfUtilityCleanUiScript','/js/pdf-suite/clean-ui.js?v=20261002-1',()=>Boolean(window.__programStudioPdfUtilityCleanUiV1||window.__programStudioPdfUtilityCenteredFixesV4));}
  function ensureToolModalFlow(){return ensureScript('pdfUtilityToolModalFlowScript','/js/pdf-suite/tool-modal-flow.js?v=20260915-1',()=>Boolean(window.__programStudioPdfUtilityToolModalFlowV1));}

  async function waitForCuratedCore(){
    const deadline=Date.now()+1600;
    while(Date.now()<deadline){
      if(document.documentElement.dataset.pdfUtilityCuratedCore==='ready')return 'ready';
      await delay(25);
    }
    return 'timeout';
  }

  let installed=false;
  function install(){
    if(installed)return;installed=true;
    document.addEventListener('click',event=>{const button=event.target.closest?.('[data-pdfu-tool]');if(button)activate(button,event);},true);
    document.addEventListener('change',event=>{
      const input=event.target;if(!input?.matches?.('.pdfud-file-input[multiple]'))return;
      setTimeout(()=>{
        const out=input.closest('.pdfud-card')?.querySelector('.pdfud-selected');
        if(out){const files=Array.from(input.files||[]);out.textContent=files.length?`${files.length}개 · ${files.map(file=>file.name).join(', ')}`:'';}
      },0);
    });
    document.documentElement.dataset.pdfUtilityDirectHook='ready-v3';
  }
  function boot(){
    install();
    Promise.allSettled([
      ensureLargeStorage(),
      waitForCuratedCore().then(ensureCenteredWorkspace).then(ensureCenteredFixes).then(ensureToolModalFlow)
    ]);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  window.ProgramStudioPdfUtilityDirectHook=Object.freeze({activate,stage:'pdf-utility-direct-hook-v3',legacyStage:'pdf-utility-direct-hook-v2'});
})();
