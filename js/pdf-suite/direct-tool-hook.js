// Route supported PDF Utility menu clicks straight into the active work/result surface.
(function(){
  'use strict';
  if(window.__programStudioPdfUtilityDirectHookV2)return;
  window.__programStudioPdfUtilityDirectHookV2=true;

  const $=id=>document.getElementById(id);
  function sourceNameFor(button){return button?.dataset.pdfuCoreSource||button?.querySelector('.pdfu-menu-name')?.textContent?.trim()||'';}
  function sourceFor(name){return [...document.querySelectorAll('#pdfUtilitySourceStore .tool')].find(node=>node.querySelector('.tool-name')?.textContent?.trim()===name)||null;}
  function toolFor(button){
    const name=sourceNameFor(button);
    const displayName=button?.querySelector('.pdfu-menu-name')?.textContent?.trim()||name;
    const source=sourceFor(name);
    return {name,displayName,desc:source?.querySelector('.tool-desc')?.textContent?.trim()||'',icon:source?.querySelector('.tool-icon')?.textContent?.trim()||'📄',source};
  }
  function header(tool){const title=$('pdfUtilityStageTitle'),desc=$('pdfUtilityStageDesc'),badge=$('pdfUtilityStageBadge'),action=$('pdfUtilityStageAction');if(title)title.textContent=tool.displayName||tool.name;if(desc)desc.textContent=tool.desc||'이 화면에서 바로 작업합니다.';if(badge){badge.textContent='직접 작업';badge.style.background='#ecfdf5';badge.style.color='#047857';}if(action){action.classList.remove('show');action.textContent='실행';delete action.dataset.pdfuGuardAction;}}
  function activate(button,event){const bridge=window.ProgramStudioPdfUtilityDirectBridge;if(!bridge)return false;const tool=toolFor(button);if(!tool.name||!bridge.handles?.(tool.name))return false;const needAuth=bridge.requiresAuth?.(tool.name)===true;if(needAuth&&!window.auth?.currentUser)return false;event?.preventDefault?.();event?.stopImmediatePropagation?.();bridge.reset?.();const stage=$('pdfUtilityStageBody');if(!stage)return false;stage.replaceChildren();document.querySelectorAll('[data-pdfu-tool]').forEach(node=>node.classList.toggle('active',node===button));header(tool);const ok=bridge.activate(tool);if(ok){document.documentElement.dataset.pdfUtilityDirectTool=tool.name;document.documentElement.dataset.pdfUtilityDirectDisplayTool=tool.displayName||tool.name;document.documentElement.dataset.pdfUtilityDirectBridge='active';window.ProgramStudioPdfUtilityCentered?.openForTool?.(button,tool);}return Boolean(ok);}

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
  function ensureCenteredWorkspace(){return ensureScript('pdfUtilityCenteredWorkspaceScript','/js/pdf-suite/centered-workspace.js?v=20260915-2',()=>Boolean(window.__programStudioPdfUtilityCenteredV1));}
  function ensureCenteredFixes(){return ensureScript('pdfUtilityCenteredFixesScript','/js/pdf-suite/centered-workspace-fixes.js?v=20260915-1',()=>Boolean(window.__programStudioPdfUtilityCenteredFixesV1));}

  function install(){
    document.addEventListener('click',event=>{const button=event.target.closest?.('[data-pdfu-tool]');if(button)activate(button,event);},true);
    document.addEventListener('change',event=>{const input=event.target;if(!input?.matches?.('.pdfud-file-input[multiple]'))return;setTimeout(()=>{const out=input.closest('.pdfud-card')?.querySelector('.pdfud-selected');if(out){const files=Array.from(input.files||[]);out.textContent=files.length?`${files.length}개 · ${files.map(file=>file.name).join(', ')}`:'';}},0);});
    document.documentElement.dataset.pdfUtilityDirectHook='ready-v2';
  }
  function boot(){Promise.allSettled([ensureLargeStorage(),ensureCenteredWorkspace().then(ensureCenteredFixes)]).finally(install);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  window.ProgramStudioPdfUtilityDirectHook=Object.freeze({activate,stage:'pdf-utility-direct-hook-v2'});
})();