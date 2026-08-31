// Flat, product-aware workspace for the unified design editor.
// Keeps every user-facing tool expanded in one sidebar and leaves selection
// context controls in the preview toolbar to selection-contextbar.js.
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
      html[data-design-essential-workspace="flat-v2"] #editorShell{grid-template-columns:320px minmax(0,1fr)!important}
      html[data-design-essential-workspace="flat-v2"] #propertiesPanel{display:none!important}
      html[data-design-essential-workspace="flat-v2"] .sidebar{padding:0!important;overflow:hidden!important;background:#fff!important}
      .design-flat-panel{height:100%;min-height:0;overflow-y:auto;padding:11px 12px 16px;background:#fff;scrollbar-gutter:stable}
      .design-flat-panel>.side-card,.design-flat-panel>.design-mode-card{display:block;margin:0 0 9px!important}
      .design-flat-panel>.side-card:last-child,.design-flat-panel>.design-mode-card:last-child{margin-bottom:0!important}
      [data-design-flat-hidden="1"]{display:none!important}
      #designProfessionalWorkflow{display:none!important}
      .design-flat-cover-boundaries{position:absolute;inset:0;z-index:44;pointer-events:none;overflow:visible}
      .design-flat-cover-boundary{position:absolute;width:0;border-left:2px dashed #f59e0b;box-sizing:border-box;filter:drop-shadow(0 0 1px rgba(255,255,255,.9))}
      @media(max-width:980px){html[data-design-essential-workspace="flat-v2"] #editorShell{grid-template-columns:1fr!important}.design-flat-panel{height:auto;overflow:visible;padding:10px}}
    `;
    document.head.appendChild(style);
  }

  function removeWorkflowBar(){
    byId('designProfessionalWorkflow')?.remove();
  }

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

  function movePropertyCards(){
    properties=byId('propertiesPanel');
    if(!properties||!panel)return;
    const inspector=byId('inspector'),layer=ensureLayerId();
    [inspector,layer].forEach(node=>{if(node&&node.parentElement!==panel)panel.appendChild(node);});
    properties.hidden=true;
    properties.setAttribute('aria-hidden','true');
  }

  function moveSidebarChildren(){
    if(!sidebar||!panel)return;
    [...sidebar.children].forEach(node=>{
      if(node===panel||node.classList?.contains('program-local-actions'))return;
      if(node.classList?.contains('design-essential-shell')){
        [...node.querySelectorAll(':scope > .design-essential-panel > *')].forEach(child=>{
          if(!child.classList.contains('design-essential-panel-head')&&child.id!=='designEssentialEmpty')panel.appendChild(child);
        });
        node.remove();
        return;
      }
      panel.appendChild(node);
    });
  }

  function applyVisibility(){
    const type=currentType();
    [...panel.children].forEach(node=>{
      if(!(node instanceof HTMLElement))return;
      const hide=isInternal(node)||!modeAllowed(node,type);
      node.dataset.designFlatHidden=hide?'1':'0';
      // The flat workspace owns top-level tool-card visibility. Explicitly
      // restore the hidden property as product modes change so a previous
      // runtime cannot leave an allowed card hidden after switching modes.
      node.hidden=hide;
      node.setAttribute('aria-hidden',hide?'true':'false');
      node.classList.remove('design-essential-step-hidden','design-essential-internal');
    });
    const foldToggle=byId('foldToggle')?.closest('.check-row');
    if(foldToggle)foldToggle.hidden=!(type==='leaflet2'||type==='leaflet3');
  }

  function clearInvitationGeometry(){
    const p=project();
    if(!p||currentType()!=='invitation')return false;
    let changed=false;
    INVITATION_FOLD_KEYS.forEach(key=>{if(Object.prototype.hasOwnProperty.call(p,key)){delete p[key];changed=true;}});
    (p.surfaces||[]).forEach(surface=>{
      if(Array.isArray(surface.folds)&&surface.folds.length){surface.folds=[];changed=true;}
      if(Array.isArray(surface.foldsY)&&surface.foldsY.length){delete surface.foldsY;changed=true;}
      if(surface.foldAxis){delete surface.foldAxis;changed=true;}
      if(Array.isArray(surface.panels)&&surface.panels.length){surface.panels=[];changed=true;}
    });
    byId('designEssentialInvitationFold')?.remove();
    byId('designEssentialInvitationFoldLabel')?.remove();
    if(changed){
      try{localStorage.setItem('programTool.designEditor.draft.v1',JSON.stringify(p));}catch(_){}
      requestAnimationFrame(()=>window.dispatchEvent(new Event('resize')));
    }
    return changed;
  }

  function removeFieldContaining(id){
    const node=byId(id);if(!node)return;
    const wrapper=node.closest('.design-product-field,.design-print-fold-field');
    const pair=wrapper?.closest('.design-product-two');
    (pair&&pair.querySelector(`#${id}`)?pair:wrapper||node).remove();
  }

  function stripInvitationFoldControls(){
    if(currentType()!=='invitation')return;
    ['designProductAxis','designProductFoldPosition','designProductFlip'].forEach(removeFieldContaining);
    byId('designProductCenterFold')?.remove();
    byId('designPrintFoldDirectionField')?.remove();
    const options=byId('designEmbeddedModeCard')?.querySelector('.design-mode-options');
    const note=options?.querySelector('.design-product-note,.design-mode-note');
    if(note)note.textContent='초대장·안내장은 접지선 없이 한 장 규격으로 작업합니다. 용지 규격과 방향만 설정하세요.';
  }

  function removeCoverBoundaries(){byId(BOUNDARY_ID)?.remove();}

  function renderCoverBoundaries(){
    const p=project(),artboard=byId('artboard');
    if(!p||!artboard||currentType()!=='cover'||!p.cover){removeCoverBoundaries();return false;}
    const bleed=Math.max(0,Number(p.bleed??p.cover.bleed)||0);
    const trimW=Math.max(.1,Number(p.cover.trimWidth)||210);
    const trimH=Math.max(.1,Number(p.cover.trimHeight)||Number(p.height)||297);
    const spine=Math.max(0,Number(p.cover.spine)||0);
    const width=Math.max(.1,Number(p.width)||trimW*2+spine);
    const height=Math.max(.1,Number(p.height)||trimH);
    const sx=artboard.clientWidth/(width+bleed*2),sy=artboard.clientHeight/(height+bleed*2);
    let overlay=byId(BOUNDARY_ID);
    if(!overlay){overlay=document.createElement('div');overlay.id=BOUNDARY_ID;overlay.className='design-flat-cover-boundaries';overlay.setAttribute('aria-hidden','true');artboard.appendChild(overlay);}
    const points=[trimW,trimW+spine];
    overlay.replaceChildren(...points.map(mm=>{
      const line=document.createElement('div');line.className='design-flat-cover-boundary';
      line.style.left=`${(bleed+mm)*sx}px`;line.style.top=`${bleed*sy}px`;line.style.height=`${trimH*sy}px`;return line;
    }));
    overlay.dataset.spine=String(spine);
    return true;
  }

  function targetFor(step){
    if(step==='edit')return byId('inspector');
    if(step==='arrange')return byId('designLayerTools')||byId('layerList')?.closest('.side-card');
    if(step==='output'||step==='all')return byId('designFinalPrintCheckTools')||byId('designOutputTools');
    return byId('designEmbeddedModeCard')||byId('designCoverSettingsTools')||byId('designSimpleResultTools')||byId('addTitleBtn')?.closest('.side-card');
  }

  function select(step='all',scroll=true){
    const target=targetFor(step);
    if(scroll&&target){try{target.scrollIntoView({behavior:'smooth',block:'nearest'});}catch(_){target.scrollIntoView();}}
    return true;
  }

  function runSync(){
    if(mutating||!panel)return false;
    mutating=true;
    try{
      removeWorkflowBar();moveSidebarChildren();movePropertyCards();applyVisibility();clearInvitationGeometry();stripInvitationFoldControls();renderCoverBoundaries();
      document.documentElement.dataset.designEssentialWorkspace='flat-v2';
      document.documentElement.dataset.editorToolStep='all';
      return true;
    }finally{mutating=false;}
  }

  function scheduleSync(){
    if(syncFrame)return;
    syncFrame=requestAnimationFrame(()=>{syncFrame=0;runSync();});
  }

  function sync(){
    if(syncFrame){
      try{cancelAnimationFrame(syncFrame);}catch(_){}
      syncFrame=0;
    }
    return runSync();
  }

  function observe(){
    sidebarObserver=new MutationObserver(scheduleSync);sidebarObserver.observe(sidebar,{childList:true});
    panelObserver=new MutationObserver(scheduleSync);panelObserver.observe(panel,{childList:true,subtree:true});
    properties=byId('propertiesPanel');if(properties){propertiesObserver=new MutationObserver(scheduleSync);propertiesObserver.observe(properties,{childList:true,subtree:false});}
    htmlObserver=new MutationObserver(scheduleSync);htmlObserver.observe(document.documentElement,{attributes:true,attributeFilter:['data-design-document-type','data-active-design-mode']});
    const artboard=byId('artboard');if(artboard&&typeof ResizeObserver==='function'){resizeObserver=new ResizeObserver(renderCoverBoundaries);resizeObserver.observe(artboard);}
    ['programstudio:design-document-type','programstudio:document-type-change','programstudio:design-mode-change','programstudio:design-product-change','programstudio:cover-geometry-change','programstudio:runtime-script-result','resize'].forEach(name=>window.addEventListener(name,scheduleSync,{passive:true}));
    document.addEventListener('click',event=>{
      if(event.target?.closest?.('#designEmbeddedModeCard .design-product-apply,#designEmbeddedModeCard .design-mode-apply'))setTimeout(scheduleSync,0);
    },true);
  }

  function install(attempt=0){
    sidebar=document.querySelector('.sidebar');
    if(!sidebar||!byId('editorShell')||!window.DesignEditorApp){if(attempt<50)setTimeout(()=>install(attempt+1),70+Math.min(attempt,15)*30);return false;}
    installStyles();
    panel=sidebar.querySelector('.design-flat-panel');
    if(!panel){panel=document.createElement('div');panel.className='design-flat-panel';panel.setAttribute('aria-label','디자인 도구 전체 메뉴');moveSidebarChildren();sidebar.appendChild(panel);}
    moveSidebarChildren();movePropertyCards();observe();sync();
    window.ProgramStudioEditorToolRail={surface:'design-editor',select:step=>select(step,true),showAll:()=>true,get activeStep(){return'all';},stage:'design-flat-expanded-sidebar-v2'};
    window.DesignEditorEssentialWorkspace={sync,schedule: scheduleSync,select,currentType,stage:'flat-expanded-product-aware-workspace-v2'};
    [120,350,800,1600,3000].forEach(delay=>setTimeout(scheduleSync,delay));
    return true;
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>install(),{once:true});else install();
})();
