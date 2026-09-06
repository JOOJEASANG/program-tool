// Route supported PDF Utility menu clicks straight into the right-side direct workflow.
(function(){
  'use strict';
  if(window.__programStudioPdfUtilityDirectHookV1)return;
  window.__programStudioPdfUtilityDirectHookV1=true;

  const $=id=>document.getElementById(id);
  function sourceFor(name){return [...document.querySelectorAll('#pdfUtilitySourceStore .tool')].find(node=>node.querySelector('.tool-name')?.textContent?.trim()===name)||null;}
  function toolFor(button){const name=button?.querySelector('.pdfu-menu-name')?.textContent?.trim()||'';const source=sourceFor(name);return {name,desc:source?.querySelector('.tool-desc')?.textContent?.trim()||'',icon:source?.querySelector('.tool-icon')?.textContent?.trim()||'📄',source};}
  function header(tool){const title=$('pdfUtilityStageTitle'),desc=$('pdfUtilityStageDesc'),badge=$('pdfUtilityStageBadge'),action=$('pdfUtilityStageAction');if(title)title.textContent=tool.name;if(desc)desc.textContent=tool.desc||'이 화면에서 바로 작업합니다.';if(badge){badge.textContent='직접 작업';badge.style.background='#ecfdf5';badge.style.color='#047857';}if(action){action.classList.remove('show');action.textContent='실행';delete action.dataset.pdfuGuardAction;}}
  function activate(button,event){const bridge=window.ProgramStudioPdfUtilityDirectBridge;if(!bridge)return false;const tool=toolFor(button);if(!tool.name||!bridge.handles?.(tool.name))return false;const needAuth=bridge.requiresAuth?.(tool.name)===true;if(needAuth&&!window.auth?.currentUser)return false;event?.preventDefault?.();event?.stopImmediatePropagation?.();bridge.reset?.();const stage=$('pdfUtilityStageBody');if(!stage)return false;stage.replaceChildren();document.querySelectorAll('[data-pdfu-tool]').forEach(node=>node.classList.toggle('active',node===button));header(tool);const ok=bridge.activate(tool);if(ok){document.documentElement.dataset.pdfUtilityDirectTool=tool.name;document.documentElement.dataset.pdfUtilityDirectBridge='active';}return Boolean(ok);}
  function install(){document.addEventListener('click',event=>{const button=event.target.closest?.('[data-pdfu-tool]');if(button)activate(button,event);},true);document.documentElement.dataset.pdfUtilityDirectHook='ready';}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
  window.ProgramStudioPdfUtilityDirectHook=Object.freeze({activate,stage:'pdf-utility-direct-hook-v1'});
})();