// Unified loader for print/design shell enhancements.
(function(){
'use strict';
if(window.__designEditorShellRuntimeV1)return;
window.__designEditorShellRuntimeV1=true;
const params=new URLSearchParams(location.search),rawApp=(params.get('app')||'').trim().toLowerCase(),app=rawApp==='notice'?'invitation':rawApp;
const standalone=['cover','poster','flyer','invitation','leaflet'].includes(app);
const fallbackFoldProduct=app==='invitation'||app==='leaflet'||(!standalone&&['invitation','leaflet2','leaflet3'].includes(params.get('mode')||''));
const MODULES=Object.freeze([
{id:'designPrintFoldRuntimeEnsureScriptV1',src:'/js/design-editor/print-fold-runtime-ensure.js?v=20260825-5',global:'DesignEditorPrintFoldRuntimeEnsure',method:'refresh'},
{id:'designDocumentTypeStateScriptV1',src:'/js/design-editor/shared/document-type-state.js?v=20260831-1',global:'DesignEditorDocumentTypeState',method:'sync'},
{id:'designPrintProductMenuScriptV1',src:'/js/design-editor/print-product-menu.js?v=20260828-3',global:'DesignEditorPrintProductMenu',method:'render'},
{id:'designPrintProductStateRestoreScriptV1',src:'/js/design-editor/print-product-state-restore.js?v=20260825-1',global:'DesignEditorPrintProductStateRestore',method:'patch'},
{id:'designPrintProductTopbarScriptV1',src:'/js/design-editor/print-product-topbar.js?v=20260828-2',global:'DesignEditorPrintProductTopbar',method:'sync'},
{id:'designSelectionContextbarScriptV1',src:'/js/design-editor/shared/selection-contextbar.js?v=20260831-1',global:'DesignEditorSelectionContextbar',method:'sync'},
{id:'designMultiSelectionScriptV1',src:'/js/design-editor/shared/multi-selection-context.js?v=20260828-1',global:'DesignEditorMultiSelection',method:'sync'},
{id:'designMultiSmartGuidesScriptV1',src:'/js/design-editor/shared/multi-selection-smart-guides.js?v=20260828-1',global:'DesignEditorMultiSmartGuides',method:'sync'},
{id:'designSimpleResultWorkflowScriptV1',src:'/js/design-editor/shared/simple-result-workflow.js?v=20260828-1',global:'DesignEditorSimpleResultWorkflow',method:'sync'},
{id:'designProfessionalUiScriptV1',src:'/js/design-editor/professional-ui.js?v=20260828-2',global:'DesignEditorProfessionalUi',method:'sync'},
{id:'designPreviewFitRefreshScriptV1',src:'/js/design-editor/preview-fit-refresh.js?v=20260831-1',global:'DesignEditorPreviewFitRefresh',method:'sync'}
]);
const loading=new Map(),getApi=e=>window[e.global]||null,activeProfile=()=>window.DesignEditorStandaloneProducts?.fromLocation?.(location.search)||null,sharedProfile=()=>window.DesignEditorSharedModuleProfile||null;
const needsFoldRuntime=()=>activeProfile()?.needsFoldRuntime??fallbackFoldProduct,needsProductMenu=()=>activeProfile()?.needsProductMenu??fallbackFoldProduct;
const nextPaint=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
function shouldLoad(e){
if(!standalone)return true;
const shared=sharedProfile();
if(shared?.shouldLoadShell)return shared.shouldLoadShell(e.id,app,{needsFoldRuntime:needsFoldRuntime(),needsProductMenu:needsProductMenu()});
if(e.id==='designPrintFoldRuntimeEnsureScriptV1')return needsFoldRuntime();
if(e.id==='designPrintProductMenuScriptV1')return needsProductMenu();
return true;
}
function loadSupportScript(id,src){
const existing=document.getElementById(id);if(existing?.dataset.loaded==='true')return Promise.resolve(true);
return new Promise(resolve=>{const script=existing||document.createElement('script'),done=ok=>{if(ok)script.dataset.loaded='true';resolve(ok);};script.addEventListener('load',()=>done(true),{once:true});script.addEventListener('error',()=>done(false),{once:true});if(!existing){script.id=id;script.src=src;script.async=false;document.head.appendChild(script);}});
}
async function loadBoundaryUi(){
if(!standalone)return true;
await loadSupportScript('designStandaloneProductProfileScriptV1','/js/design-editor/standalone-product-profile.js?v=20260901-2');
const loaded=await loadSupportScript('designProductBoundaryUiScriptV1','/js/design-editor/product-boundary-ui.js?v=20260901-3');window.DesignEditorProductBoundaryUi?.sync?.();return loaded;
}
async function loadWorkspaceNavigation(){
if(!standalone)return true;
const loaded=await loadSupportScript('designWorkspaceNavigationScriptV1','/js/design-editor/shared/workspace-navigation.js?v=20260901-2');window.DesignEditorWorkspaceNavigation?.sync?.();return loaded;
}
async function loadSidebarMenuOrder(){
if(!standalone)return true;
const loaded=await loadSupportScript('designSidebarMenuOrderScriptV1','/js/design-editor/shared/sidebar-menu-order.js?v=20260901-3');window.DesignEditorSidebarMenuOrder?.sync?.();return loaded;
}
async function loadUiRevision(){
const revisionLoaded=await loadSupportScript('designUiRevision20260901ScriptV1','/js/design-editor/ui-revision-20260901.js?v=20260901-1');
window.DesignEditorUiRevision?.sync?.();
const foldLoaded=await loadSupportScript('designInvitationFoldOverlayScriptV1','/js/design-editor/invitation-fold-overlay.js?v=20260901-1');
window.DesignEditorInvitationFoldOverlay?.refresh?.();
return revisionLoaded&&foldLoaded;
}
async function loadDirectResize(){
const loaded=await loadSupportScript('designDirectResizeHandlesScriptV1','/js/design-editor/direct-resize-handles.js?v=20260901-1');window.DesignEditorDirectResize?.sync?.();return loaded;
}
async function loadStabilityGuards(){
const loaded=await loadSupportScript('designStabilityGuardsScriptV1','/js/design-editor/stability-guards.js?v=20260901-1');window.DesignEditorStabilityGuards?.sync?.();return loaded;
}
async function loadFullPreviewWorkspace(){
const loaded=await loadSupportScript('designFullPreviewWorkspaceScriptV1','/js/design-editor/full-preview-workspace.js?v=20260901-1');window.DesignEditorFullPreviewWorkspace?.sync?.();return loaded;
}
async function loadProductSpecificWorkspace(){
if(!standalone)return true;
const loaded=await loadSupportScript('designProductSpecificWorkspaceScriptV1','/js/design-editor/product-specific-workspace.js?v=20260901-1');window.DesignEditorProductSpecificWorkspace?.sync?.();return loaded;
}
function syncEntry(e){
if(!shouldLoad(e))return false;const api=getApi(e),fn=api?.[e.method];if(typeof fn!=='function')return false;
try{if(e.global==='DesignEditorDocumentTypeState'){const project=window.DesignEditorApp?.project;if(project)fn.call(api,project,{emit:false,source:'shell-runtime'});}else fn.call(api);return true;}catch(error){console.warn('[design-shell-runtime] sync failed',e.global,error);return false;}
}
function loadEntry(e){
if(!shouldLoad(e))return Promise.resolve(true);if(syncEntry(e))return Promise.resolve(true);if(loading.has(e.id))return loading.get(e.id);
const promise=new Promise(resolve=>{let script=document.getElementById(e.id);const done=()=>{syncEntry(e);resolve(true);};if(script){if(script.dataset.loaded==='true'){done();return;}script.addEventListener('load',done,{once:true});script.addEventListener('error',()=>resolve(false),{once:true});return;}script=document.createElement('script');script.id=e.id;script.src=e.src;script.async=false;script.addEventListener('load',()=>{script.dataset.loaded='true';done();},{once:true});script.addEventListener('error',()=>resolve(false),{once:true});document.head.appendChild(script);}).finally(()=>loading.delete(e.id));loading.set(e.id,promise);return promise;
}
async function finalizeWorkspace(){
const root=document.documentElement;
delete root.dataset.designFinalWorkspaceReady;
try{window.DesignEditorDraftScope?.restoreCurrentScope?.();}catch(error){console.warn('[design-shell-runtime] draft restore failed',error);}
sync();
try{window.DesignEditorFocusedWorkspace?.sync?.();}catch(_){}
try{window.DesignEditorEmbeddedStabilityBootstrap?.sync?.();}catch(_){}
await nextPaint();
try{window.DesignEditorSidebarMenuOrder?.sync?.();}catch(_){}
try{window.DesignEditorProductSpecificWorkspace?.sync?.();}catch(_){}
try{window.DesignEditorFocusedWorkspace?.sync?.();}catch(_){}
try{window.DesignEditorEmbeddedStabilityBootstrap?.sync?.();}catch(_){}
await nextPaint();
root.dataset.designShellRuntime='1';
root.dataset.designFinalWorkspaceReady='1';
return true;
}
async function loadAll(){
const root=document.documentElement;delete root.dataset.designFinalWorkspaceReady;
await loadSupportScript('designSharedModuleProfileScriptV1','/js/design-editor/shared/module-profile.js?v=20260831-1');await loadBoundaryUi();for(const entry of MODULES)await loadEntry(entry);await loadWorkspaceNavigation();await loadSidebarMenuOrder();await loadUiRevision();await loadDirectResize();await loadStabilityGuards();await loadFullPreviewWorkspace();await loadProductSpecificWorkspace();await finalizeWorkspace();if(standalone){root.dataset.designStandaloneApp=activeProfile()?.key||rawApp||app;root.dataset.designStandaloneRuntime=activeProfile()?.runtimeProduct||app;}return true;
}
function sync(){let ready=0;MODULES.forEach(e=>{if(syncEntry(e))ready+=1;});if(standalone){window.DesignEditorProductBoundaryUi?.sync?.();window.DesignEditorWorkspaceNavigation?.sync?.();window.DesignEditorSidebarMenuOrder?.sync?.();window.DesignEditorProductSpecificWorkspace?.sync?.();}window.DesignEditorUiRevision?.sync?.();window.DesignEditorInvitationFoldOverlay?.refresh?.();window.DesignEditorDirectResize?.sync?.();window.DesignEditorStabilityGuards?.sync?.();window.DesignEditorFullPreviewWorkspace?.sync?.();window.DesignEditorFocusedWorkspace?.sync?.();return ready;}
function boot(){document.documentElement.removeAttribute('data-design-final-workspace-ready');loadAll().catch(error=>console.error('[design-shell-runtime] load failed',error));[160,500,1200].forEach(delay=>setTimeout(()=>{if(document.documentElement.dataset.designFinalWorkspaceReady!=='1')sync();},delay));}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.DesignEditorShellRuntime={loadAll,sync,finalizeWorkspace,product:standalone?app:'integrated',get profile(){return activeProfile()?.key||null;},modules:MODULES.map(({id,src,global,method})=>({id,src,global,method})),stage:'design-shell-runtime-manifest-v1',finalStage:'design-shell-runtime-final-workspace-v2'};
})();