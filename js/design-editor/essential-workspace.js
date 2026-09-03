// Product-aware workspace for the unified design editor.
// Keeps product/setup tools in the left menu, gives the canvas maximum room,
// and restores selection properties/layers as a collapsible right context pane.
(function(){
  'use strict';
  if(window.__designEditorEssentialWorkspaceV2)return;
  window.__designEditorEssentialWorkspaceV2=true;

  const path=(location.pathname||'/').replace(/\/+$/,'')||'/';
  const params=new URLSearchParams(location.search);
  const embedded=params.get('embed')==='1';
  const isGeneral=path==='/design-editor/general'||path==='/design-editor/general.html'||path.endsWith('/design-editor/general.html')||(embedded&&(path==='/design-editor/index.html'||path.endsWith('/design-editor/index.html')));
  if(!isGeneral)return;

  const COVER_ONLY_IDS=new Set(['designCoverSettingsTools','designCoverSpineTools','designCoverPreviewZoneTools']);
  const INTERNAL_IDS=new Set(['designEditorWorkflowV2','designWorkflowStatusV2','designPrintQualityTools','designPrintSafetyTools','designRuntimeDiagnostics']);
  const FOLD_ID_RE=/PrintFold|Leaflet|FoldTools/i;
  const INVITATION_FOLD_KEYS=['printProductFold','printProductAxis','printProductFoldPosition','printFoldFlipPanel','printFoldOrientationV1','foldType','leaflet2Layout'];
  const BOUNDARY_ID='designFlatCoverBoundaries';
  const CONTEXT_CHROME_ID='designContextPaneChrome';
  const CONTEXT_STORAGE='programTool.designEditor.contextPane.v1';

  let sidebar=null,panel=null,properties=null;
  let sidebarObserver=null,panelObserver=null,propertiesObserver=null,htmlObserver=null,resizeObserver=null;
  let syncFrame=0,mutating=false;

  const byId=id=>document.getElementById(id);
  const project=()=>window.DesignEditorApp?.project||null;

  function currentType(){
    const htmlType=String(document.documentElement.dataset.designDocumentType||'');
    if(['cover','poster','flyer','invitation','leaflet2','leaflet3','custom'].includes(htmlType))return htmlType;
    const p=project();
    if(p?.printProductMode==='invitation')return'invitation';
    if(p?.printProductMode==='leaflet')return Number(p?.printProductPages)===4?'leaflet2':'leaflet3';
    const mode=String(p?.designMode||'');
    if(['cover','poster','flyer','invitation','leaflet2','leaflet3','custom'].includes(mode))return mode;
    const preset=String(p?.presetId||params.get('preset')||'');
    if(preset==='cover-a4')return'cover';
    if(preset.startsWith('invitation-'))return'invitation';
    if(preset==='leaflet-2')return'leaflet2';
    if(preset.startsWith('leaflet-3-'))return'leaflet3';
    if(preset.startsWith('poster-'))return'poster';
    if(preset.startsWith('flyer-'))return'flyer';
    return'custom';
  }

  function installStyles(){
    if(byId('designFlatWorkspaceStyles'))return;
    const style=document.createElement('style');
    style.id='designFlatWorkspaceStyles';
    style.textContent=`
      html[data-design-essential-workspace="context-v3"] #editorShell{position:relative;grid-template-columns:268px minmax(0,1fr)!important}
      html[data-design-essential-workspace="context-v3"] .sidebar{padding:0!important;overflow:hidden!important;background:#fff!important;border-right:1px solid #dde5ee!important}
      .design-flat-panel{height:100%;min-height:0;overflow-y:auto;padding:11px 12px 16px;background:#fff;scrollbar-gutter:stable}
      .design-flat-panel>.side-card,.design-flat-panel>.design-mode-card{display:block;margin:0 0 9px!important}
      .design-flat-panel>.side-card:last-child,.design-flat-panel>.design-mode-card:last-child{margin-bottom:0!important}
      [data-design-flat-hidden="1"]{display:none!important}
      #designProfessionalWorkflow{display:none!important}
      .design-flat-cover-boundaries{position:absolute;inset:0;z-index:44;pointer-events:none;overflow:visible}
      .design-flat-cover-boundary{position:absolute;width:0;border-left:2px dashed #f59e0b;box-sizing:border-box;filter:drop-shadow(0 0 1px rgba(255,255,255,.9))}

      html[data-design-essential-workspace="context-v3"] #propertiesPanel{
        display:flex!important;position:absolute!important;right:8px;top:8px;bottom:8px;z-index:92;width:52px!important;min-width:52px!important;
        flex-direction:column;padding:0!important;overflow:hidden!important;background:rgba(255,255,255,.98)!important;border:1px solid #d9e3ee!important;
        border-radius:13px!important;box-shadow:0 10px 28px rgba(15,39,72,.12)!important;transition:width .18s ease,box-shadow .18s ease
      }
      html[data-design-essential-workspace="context-v3"][data-design-context-pane-open="true"] #propertiesPanel{width:292px!important;box-shadow:0 16px 42px rgba(15,39,72,.18)!important}
      #designContextPaneChrome{display:flex;flex-direction:column;flex:0 0 auto;border-bottom:0;background:#f8fafc}
      #designContextPaneChrome .design-context-head{display:none;align-items:center;justify-content:space-between;gap:8px;padding:11px 12px 8px;border-bottom:1px solid #e7edf4}
      #designContextPaneChrome .design-context-head-copy{min-width:0;display:flex;flex-direction:column;gap:2px}
      #designContextPaneChrome .design-context-head strong{font-size:11px;font-weight:950;color:#17365f;letter-spacing:-.2px}
      #designContextPaneChrome .design-context-head span{font-size:8px;font-weight:750;color:#8a98a9;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      #designContextPaneChrome .design-context-close{width:26px;height:26px;border:1px solid #d9e3ee;border-radius:8px;background:#fff;color:#667085;font:900 14px/1 inherit;cursor:pointer}
      #designContextPaneChrome .design-context-tabs{display:flex;flex-direction:column;gap:5px;padding:7px}
      #designContextPaneChrome .design-context-tab{height:36px;min-width:0;border:1px solid transparent;border-radius:9px;background:transparent;color:#667085;font-family:inherit;font-size:8px;font-weight:900;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;padding:0 6px}
      #designContextPaneChrome .design-context-tab:hover{background:#eef5fd;color:#17466f}
      #designContextPaneChrome .design-context-tab[aria-selected="true"]{border-color:#b8d2ed;background:#eaf4ff;color:#1769e0}
      #designContextPaneChrome .design-context-tab-label{display:none;white-space:nowrap}
      #designContextPaneChrome .design-context-tab-mark{font-size:10px;font-weight:950}
      html[data-design-context-pane-open="true"] #designContextPaneChrome .design-context-head{display:flex}
      html[data-design-context-pane-open="true"] #designContextPaneChrome .design-context-tabs{display:grid;grid-template-columns:1fr 1fr;gap:6px;padding:8px 10px;border-bottom:1px solid #e7edf4}
      html[data-design-context-pane-open="true"] #designContextPaneChrome .design-context-tab{height:32px;border-color:#dde6ef;background:#fff}
      html[data-design-context-pane-open="true"] #designContextPaneChrome .design-context-tab[aria-selected="true"]{border-color:#9bc1e8;background:#eaf4ff}
      html[data-design-context-pane-open="true"] #designContextPaneChrome .design-context-tab-label{display:inline}
      html[data-design-essential-workspace="context-v3"] #propertiesPanel>#inspector,
      html[data-design-essential-workspace="context-v3"] #propertiesPanel>#designLayerTools{display:none!important;margin:0!important;border:0!important;border-radius:0!important;box-shadow:none!important;overflow-y:auto;min-height:0;flex:1 1 auto;padding:12px!important;background:#fff!important}
      html[data-design-context-pane-open="true"][data-design-context-tab="properties"] #propertiesPanel>#inspector{display:block!important}
      html[data-design-context-pane-open="true"][data-design-context-tab="layers"] #propertiesPanel>#designLayerTools{display:block!important}
      html[data-design-context-pane-open="false"] #propertiesPanel>#inspector,
      html[data-design-context-pane-open="false"] #propertiesPanel>#designLayerTools{display:none!important}
      html[data-design-essential-workspace="context-v3"] #propertiesPanel .inspector-title,
      html[data-design-essential-workspace="context-v3"] #propertiesPanel .side-label{font-size:11px!important;font-weight:950!important;color:#17365f!important}
      html[data-design-essential-workspace="context-v3"] #propertiesPanel .prop-grid{grid-template-columns:1fr 1fr!important;gap:7px!important}
      html[data-design-essential-workspace="context-v3"] #propertiesPanel button{min-height:30px}
      html[data-design-essential-workspace="context-v3"] #canvasArea{min-width:0!important;padding-right:48px!important}
      @media(max-width:1180px){
        html[data-design-essential-workspace="context-v3"] #editorShell{grid-template-columns:248px minmax(0,1fr)!important}
        html[data-design-essential-workspace="context-v3"][data-design-context-pane-open="true"] #propertiesPanel{width:280px!important}
      }
      @media(max-width:820px){
        html[data-design-essential-workspace="context-v3"] #editorShell{grid-template-columns:1fr!important}
        html[data-design-essential-workspace="context-v3"] .sidebar{position:absolute;left:8px;top:8px;bottom:8px;width:min(286px,calc(100vw - 80px));z-index:91;border:1px solid #d9e3ee!important;border-radius:13px;box-shadow:0 14px 36px rgba(15,39,72,.16)}
        html[data-design-essential-workspace="context-v3"].ps-sidebar-collapsed .sidebar{display:none!important}
        html[data-design-essential-workspace="context-v3"] #propertiesPanel{right:6px;top:6px;bottom:6px}
        html[data-design-essential-workspace="context-v3"][data-design-context-pane-open="true"] #propertiesPanel{width:min(286px,calc(100vw - 72px))!important}
        html[data-design-essential-workspace="context-v3"] #canvasArea{padding-right:46px!important}
      }
    `;
    document.head.appendChild(style);
  }

  function removeWorkflowBar(){byId('designProfessionalWorkflow')?.remove();}

  function isInternal(node){
    if(INTERNAL_IDS.has(node.id))return true;
    const title=String(node.querySelector?.('.side-label,.design-tool-title,.panel-title,.sec-title,summary,h3,h2')?.textContent||'').replace(/\s+/g,' ').trim();
    return /런타임 진단|내부 상태|워크플로 상태/.test(title);
  }

  function modeAllowed(node,type=currentType()){
    if(COVER_ONLY_IDS.has(node.id))return type==='cover';
    const capability=String(node.dataset.designCapability||'').trim();
    if(capability){
      const required=capability.split(/\s+/).filter(Boolean);
      const allowed=new Set(['common']);
      if(type==='cover')allowed.add('cover');
      if(type==='leaflet2'||type==='leaflet3')allowed.add('fold');
      if(!required.some(item=>allowed.has(item)))return false;
    }
    if(FOLD_ID_RE.test(node.id||''))return type==='leaflet2'||type==='leaflet3';
    return true;
  }

  function ensureLayerId(){
    const list=byId('layerList');
    const card=list?.closest('.side-card');
    if(card&&!card.id)card.id='designLayerTools';
    return card||null;
  }

  function readContextState(){
    try{
      const raw=JSON.parse(localStorage.getItem(CONTEXT_STORAGE)||'{}');
      return{open:raw.open===true,tab:raw.tab==='layers'?'layers':'properties'};
    }catch(_){return{open:false,tab:'properties'};}
  }

  function persistContextState(open,tab){
    try{localStorage.setItem(CONTEXT_STORAGE,JSON.stringify({open:Boolean(open),tab:tab==='layers'?'layers':'properties'}));}catch(_){}
  }

  function syncContextChrome(){
    const chrome=byId(CONTEXT_CHROME_ID);if(!chrome)return;
    const tab=document.documentElement.dataset.designContextTab==='layers'?'layers':'properties';
    const open=document.documentElement.dataset.designContextPaneOpen==='true';
    chrome.querySelectorAll('[data-context-tab]').forEach(button=>{
      const active=button.dataset.contextTab===tab;
      button.setAttribute('aria-selected',String(active));
      button.setAttribute('aria-expanded',String(open&&active));
    });
    const label=chrome.querySelector('[data-context-current]');
    if(label)label.textContent=tab==='layers'?'레이어 순서와 객체 관리':'선택한 객체의 위치·크기·스타일';
  }

  function setContextPane(tab='properties',open=true,{persist=true,scroll=false}={}){
    const normalized=tab==='layers'?'layers':'properties';
    document.documentElement.dataset.designContextTab=normalized;
    document.documentElement.dataset.designContextPaneOpen=open?'true':'false';
    properties?.setAttribute('aria-expanded',String(Boolean(open)));
    syncContextChrome();
    if(persist)persistContextState(open,normalized);
    if(open&&scroll){
      const target=normalized==='layers'?ensureLayerId():byId('inspector');
      requestAnimationFrame(()=>{try{target?.scrollIntoView({behavior:'smooth',block:'nearest'});}catch(_){target?.scrollIntoView?.();}});
    }
    window.dispatchEvent(new Event('resize'));
    return true;
  }

  function ensureContextChrome(){
    properties=byId('propertiesPanel');
    if(!properties)return false;
    const inspector=byId('inspector'),layer=ensureLayerId();
    [inspector,layer].forEach(node=>{if(node&&node.parentElement!==properties)properties.appendChild(node);});
    properties.hidden=false;
    properties.setAttribute('aria-hidden','false');
    properties.setAttribute('aria-label','선택 속성과 레이어');
    let chrome=byId(CONTEXT_CHROME_ID);
    if(!chrome){
      chrome=document.createElement('div');chrome.id=CONTEXT_CHROME_ID;chrome.className='design-context-pane-chrome';
      chrome.innerHTML=`<div class="design-context-head"><div class="design-context-head-copy"><strong>작업 속성</strong><span data-context-current>선택한 객체의 위치·크기·스타일</span></div><button type="button" class="design-context-close" data-context-close aria-label="오른쪽 패널 접기">×</button></div><div class="design-context-tabs" role="tablist" aria-label="오른쪽 작업 패널"><button type="button" class="design-context-tab" data-context-tab="properties" role="tab"><span class="design-context-tab-mark">속</span><span class="design-context-tab-label">선택 속성</span></button><button type="button" class="design-context-tab" data-context-tab="layers" role="tab"><span class="design-context-tab-mark">층</span><span class="design-context-tab-label">레이어</span></button></div>`;
      properties.prepend(chrome);
      chrome.addEventListener('click',event=>{
        const tab=event.target.closest('[data-context-tab]');
        if(tab){
          const same=document.documentElement.dataset.designContextPaneOpen==='true'&&document.documentElement.dataset.designContextTab===tab.dataset.contextTab;
          setContextPane(tab.dataset.contextTab,!same,{persist:true,scroll:false});
          return;
        }
        if(event.target.closest('[data-context-close]'))setContextPane(document.documentElement.dataset.designContextTab||'properties',false,{persist:true});
      });
    }else if(properties.firstElementChild!==chrome){properties.prepend(chrome);}
    if(!document.documentElement.dataset.designContextPaneOpen){
      const saved=readContextState();
      document.documentElement.dataset.designContextTab=saved.tab;
      document.documentElement.dataset.designContextPaneOpen=saved.open?'true':'false';
    }
    syncContextChrome();
    return true;
  }

  function moveSidebarChildren(){
    if(!sidebar||!panel)return;
    [...sidebar.children].forEach(node=>{
      if(node===panel||node.classList?.contains('program-local-actions'))return;
      if(node.classList?.contains('design-essential-shell')){
        [...node.querySelectorAll(':scope > .design-essential-panel > *')].forEach(child=>{
          if(!child.classList.contains('design-essential-panel-head')&&child.id!=='designEssentialEmpty')panel.appendChild(child);
        });
        node.remove();return;
      }
      panel.appendChild(node);
    });
  }

  function applyVisibility(){
    const type=currentType();
    [...panel.children].forEach(node=>{
      if(!(node instanceof HTMLElement))return;
      const hide=isInternal(node)||!modeAllowed(node,type);
      node.dataset.designFlatHidden=hide?'1':'0';node.hidden=hide;node.setAttribute('aria-hidden',hide?'true':'false');
      node.classList.remove('design-essential-step-hidden','design-essential-internal');
    });
    const foldToggle=byId('foldToggle')?.closest('.check-row');
    if(foldToggle)foldToggle.hidden=!(type==='leaflet2'||type==='leaflet3');
  }

  function clearInvitationGeometry(){
    const p=project();if(!p||currentType()!=='invitation')return false;
    let changed=false;
    INVITATION_FOLD_KEYS.forEach(key=>{if(Object.prototype.hasOwnProperty.call(p,key)){delete p[key];changed=true;}});
    (p.surfaces||[]).forEach(surface=>{
      if(Array.isArray(surface.folds)&&surface.folds.length){surface.folds=[];changed=true;}
      if(Array.isArray(surface.foldsY)&&surface.foldsY.length){delete surface.foldsY;changed=true;}
      if(surface.foldAxis){delete surface.foldAxis;changed=true;}
      if(Array.isArray(surface.panels)&&surface.panels.length){surface.panels=[];changed=true;}
    });
    byId('designEssentialInvitationFold')?.remove();byId('designEssentialInvitationFoldLabel')?.remove();
    if(changed){try{localStorage.setItem('programTool.designEditor.draft.v1',JSON.stringify(p));}catch(_){}requestAnimationFrame(()=>window.dispatchEvent(new Event('resize')));}
    return changed;
  }

  function removeFieldContaining(id){
    const node=byId(id);if(!node)return;
    const wrapper=node.closest('.design-product-field,.design-print-fold-field');const pair=wrapper?.closest('.design-product-two');
    (pair&&pair.querySelector(`#${id}`)?pair:wrapper||node).remove();
  }

  function stripInvitationFoldControls(){
    if(currentType()!=='invitation')return;
    ['designProductAxis','designProductFoldPosition','designProductFlip'].forEach(removeFieldContaining);
    byId('designProductCenterFold')?.remove();byId('designPrintFoldDirectionField')?.remove();
    const options=byId('designEmbeddedModeCard')?.querySelector('.design-mode-options');const note=options?.querySelector('.design-product-note,.design-mode-note');
    if(note)note.textContent='초대장·안내장은 접지선 없이 한 장 규격으로 작업합니다. 용지 규격과 방향만 설정하세요.';
  }

  function removeCoverBoundaries(){byId(BOUNDARY_ID)?.remove();}

  function renderCoverBoundaries(){
    const p=project(),artboard=byId('artboard');
    if(!p||!artboard||currentType()!=='cover'||!p.cover){removeCoverBoundaries();return false;}
    const bleed=Math.max(0,Number(p.bleed??p.cover.bleed)||0),trimW=Math.max(.1,Number(p.cover.trimWidth)||210),trimH=Math.max(.1,Number(p.cover.trimHeight)||Number(p.height)||297),spine=Math.max(0,Number(p.cover.spine)||0),width=Math.max(.1,Number(p.width)||trimW*2+spine),height=Math.max(.1,Number(p.height)||trimH);
    const sx=artboard.clientWidth/(width+bleed*2),sy=artboard.clientHeight/(height+bleed*2);
    let overlay=byId(BOUNDARY_ID);
    // Skip the unconditional rebuild when nothing that affects the guides changed.
    // Without this the childList of the artboard churns on every sync and wakes
    // every other artboard observer, feeding the idle re-render cascade.
    const signature=[bleed,trimW,trimH,spine,Math.round(sx*1000),Math.round(sy*1000)].join('|');
    if(overlay&&overlay.dataset.boundarySig===signature)return true;
    if(!overlay){overlay=document.createElement('div');overlay.id=BOUNDARY_ID;overlay.className='design-flat-cover-boundaries';overlay.setAttribute('aria-hidden','true');artboard.appendChild(overlay);}
    const points=[trimW,trimW+spine];
    overlay.replaceChildren(...points.map(mm=>{const line=document.createElement('div');line.className='design-flat-cover-boundary';line.style.left=`${(bleed+mm)*sx}px`;line.style.top=`${bleed*sy}px`;line.style.height=`${trimH*sy}px`;return line;}));
    overlay.dataset.spine=String(spine);overlay.dataset.boundarySig=signature;return true;
  }

  function targetFor(step){
    if(step==='edit')return byId('inspector');
    if(step==='arrange')return ensureLayerId();
    if(step==='output'||step==='all')return byId('designFinalPrintCheckTools')||byId('designOutputTools');
    return byId('designEmbeddedModeCard')||byId('designCoverSettingsTools')||byId('designSimpleResultTools')||byId('addTitleBtn')?.closest('.side-card');
  }

  function revealTarget(targetId,scroll=true){
    if(!targetId)return false;
    if(targetId==='inspector'){setContextPane('properties',true,{persist:true,scroll});return true;}
    if(targetId==='designLayerTools'||targetId==='layerList'){setContextPane('layers',true,{persist:true,scroll});return true;}
    const target=byId(targetId);if(!target)return false;
    if(scroll){try{target.scrollIntoView({behavior:'smooth',block:'start'});}catch(_){target.scrollIntoView?.();}}
    return true;
  }

  function select(step='all',scroll=true){
    const normalized=step==='edit'||step==='arrange'||step==='output'||step==='start'?step:'all';
    if(normalized==='edit')return setContextPane('properties',true,{persist:true,scroll});
    if(normalized==='arrange')return setContextPane('layers',true,{persist:true,scroll});
    if(normalized==='start'||normalized==='output'||normalized==='all')setContextPane(document.documentElement.dataset.designContextTab||'properties',false,{persist:true});
    const target=targetFor(normalized);if(scroll&&target){try{target.scrollIntoView({behavior:'smooth',block:'nearest'});}catch(_){target.scrollIntoView?.();}}
    return true;
  }

  function runSync(){
    if(mutating||!panel)return false;mutating=true;
    // Pause our own structural observers while we mutate the sidebar/panel so
    // these writes do not re-trigger runSync. JS is single-threaded, so no
    // external mutation can slip in during this synchronous block — nothing missed.
    if(sidebarObserver)sidebarObserver.disconnect();
    if(panelObserver)panelObserver.disconnect();
    if(propertiesObserver)propertiesObserver.disconnect();
    try{
      removeWorkflowBar();moveSidebarChildren();ensureContextChrome();applyVisibility();clearInvitationGeometry();stripInvitationFoldControls();renderCoverBoundaries();
      document.documentElement.dataset.designEssentialWorkspace='context-v3';document.documentElement.dataset.editorToolStep='all';
      return true;
    }finally{
      if(sidebarObserver&&sidebar){try{sidebarObserver.takeRecords();}catch(_){}try{sidebarObserver.observe(sidebar,{childList:true});}catch(_){}}
      if(panelObserver&&panel){try{panelObserver.takeRecords();}catch(_){}try{panelObserver.observe(panel,{childList:true,subtree:true});}catch(_){}}
      if(propertiesObserver&&properties){try{propertiesObserver.takeRecords();}catch(_){}try{propertiesObserver.observe(properties,{childList:true,subtree:false});}catch(_){}}
      mutating=false;
    }
  }

  function scheduleSync(){if(syncFrame)return;syncFrame=requestAnimationFrame(()=>{syncFrame=0;runSync();});}
  function sync(){if(syncFrame){try{cancelAnimationFrame(syncFrame);}catch(_){}syncFrame=0;}return runSync();}

  function observe(){
    sidebarObserver=new MutationObserver(scheduleSync);sidebarObserver.observe(sidebar,{childList:true});
    panelObserver=new MutationObserver(scheduleSync);panelObserver.observe(panel,{childList:true,subtree:true});
    properties=byId('propertiesPanel');if(properties){propertiesObserver=new MutationObserver(scheduleSync);propertiesObserver.observe(properties,{childList:true,subtree:false});}
    htmlObserver=new MutationObserver(scheduleSync);htmlObserver.observe(document.documentElement,{attributes:true,attributeFilter:['data-design-document-type','data-active-design-mode']});
    const artboard=byId('artboard');if(artboard&&typeof ResizeObserver==='function'){resizeObserver=new ResizeObserver(renderCoverBoundaries);resizeObserver.observe(artboard);}
    ['programstudio:design-document-type','programstudio:document-type-change','programstudio:design-mode-change','programstudio:design-product-change','programstudio:cover-geometry-change','programstudio:runtime-script-result','resize'].forEach(name=>window.addEventListener(name,scheduleSync,{passive:true}));
    document.addEventListener('click',event=>{if(event.target?.closest?.('#designEmbeddedModeCard .design-product-apply,#designEmbeddedModeCard .design-mode-apply'))setTimeout(scheduleSync,0);},true);
  }

  function install(attempt=0){
    sidebar=document.querySelector('.sidebar');properties=byId('propertiesPanel');
    if(!sidebar||!properties||!byId('editorShell')||!window.DesignEditorApp){if(attempt<50)setTimeout(()=>install(attempt+1),70+Math.min(attempt,15)*30);return false;}
    installStyles();
    panel=sidebar.querySelector('.design-flat-panel');
    if(!panel){panel=document.createElement('div');panel.className='design-flat-panel';panel.setAttribute('aria-label','제품 제작 도구');moveSidebarChildren();sidebar.appendChild(panel);}
    moveSidebarChildren();ensureContextChrome();observe();sync();
    window.ProgramStudioEditorToolRail={surface:'design-editor',select:step=>select(step,true),showAll:()=>true,get activeStep(){return'all';},stage:'design-context-workspace-v3'};
    window.DesignEditorEssentialWorkspace={sync,schedule:scheduleSync,select,revealTarget,setContextPane,currentType,stage:'context-pane-product-aware-workspace-v3'};
    [120,350,800,1600,3000].forEach(delay=>setTimeout(scheduleSync,delay));return true;
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>install(),{once:true});else install();
})();
