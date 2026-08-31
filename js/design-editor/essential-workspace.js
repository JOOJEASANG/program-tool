// Canonical essential workspace for the design editor.
// Owns the visible left tool menu, product capability filtering and invitation fold guide.
(function(){
  'use strict';
  if(window.__designEditorEssentialWorkspaceV1)return;
  window.__designEditorEssentialWorkspaceV1=true;

  const path=(location.pathname||'/').replace(/\/+$/,'')||'/';
  const params=new URLSearchParams(location.search);
  const embedded=params.get('embed')==='1';
  const isGeneral=path==='/design-editor/general'||path==='/design-editor/general.html'||path.endsWith('/design-editor/general.html')||(embedded&&(path==='/design-editor/index.html'||path.endsWith('/design-editor/index.html')));
  if(!isGeneral)return;

  const STEPS=Object.freeze([
    {id:'compose',label:'구성',hint:'규격 · 글씨 · 사진 · 도형',icon:'<path d="M5 5h14v14H5z"/><path d="M9 9h6M12 6v6"/>'},
    {id:'edit',label:'편집',hint:'선택한 요소의 속성',icon:'<path d="M4 18.5 5 14l9.5-9.5a2 2 0 0 1 2.8 0l2.2 2.2a2 2 0 0 1 0 2.8L10 19z"/><path d="m13 6 5 5"/>'},
    {id:'arrange',label:'정리',hint:'레이어 · 정렬 · 회전',icon:'<path d="M5 5v14M9 8h10M9 12h7M9 16h10"/>'},
    {id:'output',label:'출력',hint:'최종 검사 · PDF · PNG',icon:'<path d="M12 4v10"/><path d="m8 10 4 4 4-4"/><path d="M5 19h14"/>'}
  ]);
  const HOME_ICON='<path d="m4 10 8-6 8 6"/><path d="M6.5 9.5V20h11V9.5"/><path d="M10 20v-6h4v6"/>';
  const COVER_ONLY_IDS=new Set(['designCoverSettingsTools','designCoverSpineTools','designCoverPreviewZoneTools']);
  const INTERNAL_IDS=new Set(['designEditorWorkflowV2','designWorkflowStatusV2','designPrintQualityTools','designPrintSafetyTools']);
  const SECONDARY_ID_RE=/designQuickDesignTools|StyleTheme|DesignRecipe|RuntimeDiagnostic/i;
  const FOLD_ID_RE=/PrintFold|Leaflet|FoldTools/i;

  let sidebar=null,panel=null,rail=null,properties=null,activeStep='compose';
  let sidebarObserver=null,panelObserver=null,propertiesObserver=null,htmlObserver=null,artboardObserver=null,artboardResizeObserver=null;
  let syncFrame=0,guideFrame=0,mutating=false;

  const byId=id=>document.getElementById(id);
  const project=()=>window.DesignEditorApp?.project||null;
  const text=node=>String(node?.textContent||'').replace(/\s+/g,' ').trim();
  const titleOf=node=>text(node?.querySelector?.('.side-label,.design-tool-title,.panel-title,.sec-title,.document-title,summary,h3,h2')||node);

  function currentType(){
    const htmlType=String(document.documentElement.dataset.designDocumentType||'');
    if(['cover','poster','flyer','invitation','leaflet2','leaflet3','custom'].includes(htmlType))return htmlType;
    const p=project();
    if(p?.printProductMode==='invitation')return'invitation';
    if(p?.printProductMode==='leaflet')return Number(p?.printProductPages)>=6?'leaflet3':'leaflet2';
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
    if(byId('designEssentialWorkspaceStyles'))return;
    const style=document.createElement('style');style.id='designEssentialWorkspaceStyles';style.textContent=`
      html[data-design-essential-workspace="1"] #editorShell{grid-template-columns:300px minmax(0,1fr)!important}
      html[data-design-essential-workspace="1"] #propertiesPanel{display:none!important}
      html[data-design-essential-workspace="1"] .sidebar{padding:0!important;overflow:hidden!important;background:#fff!important}
      .design-essential-shell{height:100%;min-height:0;display:grid;grid-template-columns:58px minmax(0,1fr);background:#fff}
      .design-essential-rail{min-width:0;background:linear-gradient(180deg,#f7f9fc,#eef2f6);border-right:1px solid #dce4ed;padding:8px 6px;display:flex;flex-direction:column;align-items:center;gap:5px;z-index:30}
      .design-essential-rail-separator{width:32px;height:1px;background:#dce4ed;margin:2px 0 3px}
      .design-essential-rail-btn{position:relative;width:44px;height:44px;flex:0 0 44px;border:1px solid transparent;border-radius:10px;background:transparent;color:#526174;display:grid;place-items:center;cursor:pointer;text-decoration:none}
      .design-essential-rail-btn:hover{background:#fff;border-color:#d8e1eb;color:#173b66;box-shadow:0 3px 10px rgba(15,39,72,.07)}
      .design-essential-rail-btn.active{background:#eaf2ff;border-color:#bfd2eb;color:#1769e0;box-shadow:inset 3px 0 0 #1769e0}
      .design-essential-rail-btn svg{width:21px;height:21px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
      .design-essential-rail-label{position:absolute;left:50px;top:50%;z-index:90;transform:translate(5px,-50%);opacity:0;pointer-events:none;white-space:nowrap;border:1px solid #d8e1eb;border-radius:8px;background:#102a46;color:#fff;padding:6px 8px;font-size:10px;font-weight:850;box-shadow:0 8px 20px rgba(15,39,72,.18);transition:.14s ease}
      .design-essential-rail-btn:hover .design-essential-rail-label,.design-essential-rail-btn:focus-visible .design-essential-rail-label{opacity:1;transform:translate(0,-50%)}
      .design-essential-panel{min-width:0;min-height:0;overflow-y:auto;padding:11px 12px 14px;background:#fff}
      .design-essential-panel-head{position:sticky;top:-11px;z-index:20;margin:-1px -2px 10px;padding:10px 4px 9px;background:rgba(255,255,255,.97);border-bottom:1px solid #edf1f5;backdrop-filter:blur(8px)}
      .design-essential-panel-title{font-size:12px;font-weight:950;color:#203a59}.design-essential-panel-hint{margin-top:2px;font-size:9px;line-height:1.35;color:#7a8798}
      .design-essential-panel>.side-card{margin:0 0 9px!important}.design-essential-panel>.side-card:last-child{margin-bottom:0!important}
      .design-essential-step-hidden,.design-essential-internal{display:none!important}
      [data-design-essential-product-hidden="1"]{display:none!important}
      .design-essential-empty{padding:18px 10px;border:1px dashed #d6e0ea;border-radius:10px;color:#7a8798;font-size:9px;line-height:1.55;text-align:center}
      .design-essential-invitation-fold{position:absolute;z-index:45;pointer-events:none;box-sizing:border-box}
      .design-essential-invitation-fold.x{width:0;border-left:2px dashed #f59e0b}
      .design-essential-invitation-fold.y{height:0;border-top:2px dashed #f59e0b}
      .design-essential-invitation-fold-label{position:absolute;z-index:46;pointer-events:none;transform:translate(-50%,-50%);padding:3px 6px;border:1px dashed #f59e0b;border-radius:999px;background:rgba(255,255,255,.98);color:#a95e08;font-size:7px;font-weight:950;white-space:nowrap}
      @media(max-width:980px){html[data-design-essential-workspace="1"] #editorShell{grid-template-columns:1fr!important}.design-essential-shell{display:block;height:auto}.design-essential-rail{position:sticky;top:0;z-index:60;height:56px;display:flex;flex-direction:row;overflow-x:auto;overflow-y:hidden;padding:6px 8px;border-right:0;border-bottom:1px solid #dce4ed}.design-essential-rail-separator{width:1px;height:30px;margin:6px 3px}.design-essential-rail-label{display:none}.design-essential-panel{overflow:visible;padding:10px}}
    `;document.head.appendChild(style);
  }

  function modeAllowed(node,type=currentType()){
    if(COVER_ONLY_IDS.has(node.id))return type==='cover';
    const capability=String(node.dataset.designCapability||'').trim();
    if(!capability)return true;
    const required=capability.split(/\s+/).filter(Boolean);
    const allowed=new Set(['common']);
    if(type==='cover')allowed.add('cover');
    if(type==='invitation'||type==='leaflet2'||type==='leaflet3')allowed.add('fold');
    return required.some(item=>allowed.has(item));
  }

  function isInternal(node){
    if(INTERNAL_IDS.has(node.id)||SECONDARY_ID_RE.test(node.id||''))return true;
    const title=titleOf(node);
    return /빠른 꾸미기|스타일 테마|디자인 레시피|런타임 진단/.test(title);
  }

  function classify(node){
    if(node.classList.contains('design-essential-panel-head'))return'always';
    if(isInternal(node))return'internal';
    if(node.id==='inspector')return'edit';
    if(node.id==='designLayerTools'||node.querySelector?.('#layerList'))return'arrange';
    if(node.id==='designFinalPrintCheckTools'||node.id==='designOutputTools')return'output';
    if(/Output|FinalPrint/i.test(node.id||''))return'output';
    if(/SmartLayout|Advanced|Align|Snap|Layer|Rotation|Phase3Layout|ElementClipboard/i.test(node.id||''))return'arrange';
    if(COVER_ONLY_IDS.has(node.id)||FOLD_ID_RE.test(node.id||''))return'compose';
    if(/Component|Phase2Tools|Asset|Image|Shape|Text/i.test(node.id||''))return'compose';
    if(node.querySelector?.('.document-head'))return'compose';
    const title=titleOf(node);
    if(/레이어|정렬|간격|회전|배치|스냅/.test(title))return'arrange';
    if(/최종 인쇄|출력|PNG|PDF|내보내기/.test(title))return'output';
    if(/글씨 설정|선택 속성|속성/.test(title))return'edit';
    return'compose';
  }

  function tagNode(node){
    if(!(node instanceof HTMLElement)||node.classList.contains('design-essential-panel-head'))return;
    if(!node.dataset.designEssentialStep)node.dataset.designEssentialStep=classify(node);
    if(COVER_ONLY_IDS.has(node.id))node.dataset.designEssentialProduct='cover';
    const allowed=modeAllowed(node);
    node.dataset.designEssentialProductHidden=allowed?'0':'1';
    node.classList.toggle('design-essential-internal',node.dataset.designEssentialStep==='internal');
  }

  function ensureLayerId(){
    const list=byId('layerList');const card=list?.closest('.side-card');
    if(card&&!card.id)card.id='designLayerTools';
    return card||null;
  }

  function movePropertyCards(){
    properties=byId('propertiesPanel');if(!properties||!panel)return;
    const inspector=byId('inspector'),layer=ensureLayerId();
    [inspector,layer].forEach(node=>{if(node&&node.parentElement!==panel)panel.appendChild(node);});
    properties.hidden=true;properties.setAttribute('aria-hidden','true');
  }

  function moveSidebarChildren(){
    [...sidebar.children].forEach(node=>{if(node===rail?.parentElement||node.classList.contains('program-local-actions'))return;if(node.parentElement===sidebar)panel.appendChild(node);});
  }

  function updateHeader(){
    const meta=STEPS.find(item=>item.id===activeStep)||STEPS[0];
    const title=panel.querySelector('.design-essential-panel-title'),hint=panel.querySelector('.design-essential-panel-hint');
    if(title)title.textContent=meta.label;if(hint)hint.textContent=meta.hint;
  }

  function ensureEmpty(visible){
    let empty=byId('designEssentialEmpty');
    if(visible>0){empty?.remove();return;}
    if(empty)return;
    empty=document.createElement('div');empty.id='designEssentialEmpty';empty.className='design-essential-empty';
    empty.textContent=activeStep==='edit'?'작업영역에서 글씨·사진·도형을 선택하면 편집 옵션이 표시됩니다.':'현재 작업 종류에서 사용할 수 있는 도구가 없습니다.';
    panel.appendChild(empty);
  }

  function applyStep(step=activeStep,{scroll=false}={}){
    activeStep=STEPS.some(item=>item.id===step)?step:'compose';
    let visible=0;
    [...panel.children].forEach(node=>{
      if(!(node instanceof HTMLElement)||node.classList.contains('design-essential-panel-head')||node.id==='designEssentialEmpty')return;
      tagNode(node);
      const owner=node.dataset.designEssentialStep||'compose';
      const show=owner===activeStep&&owner!=='internal'&&modeAllowed(node);
      node.classList.toggle('design-essential-step-hidden',!show);
      if(show&&!node.hidden)visible+=1;
    });
    rail.querySelectorAll('[data-design-essential-step]').forEach(button=>{
      const selected=button.dataset.designEssentialStep===activeStep;button.classList.toggle('active',selected);button.setAttribute('aria-pressed',String(selected));
    });
    updateHeader();ensureEmpty(visible);document.documentElement.dataset.editorToolStep=activeStep;
    if(scroll)panel.scrollTo?.({top:0,behavior:'smooth'});
  }

  function selectStep(step,user=true){
    const next=step==='all'?'output':step;
    if(!STEPS.some(item=>item.id===next))return false;
    try{window.DesignEditorWorkflowV2?.activateStep?.(next,false);}catch(_){}
    applyStep(next,{scroll:user});return true;
  }

  function button(meta){
    const node=document.createElement('button');node.type='button';node.className='design-essential-rail-btn';node.dataset.designEssentialStep=meta.id;node.setAttribute('aria-label',`${meta.label} 도구`);node.setAttribute('aria-pressed','false');node.title=`${meta.label} · ${meta.hint}`;
    node.innerHTML=`<svg viewBox="0 0 24 24" aria-hidden="true">${meta.icon}</svg><span class="design-essential-rail-label">${meta.label}</span>`;node.addEventListener('click',()=>selectStep(meta.id,true));return node;
  }

  function homeButton(){
    const node=document.createElement('a');node.className='design-essential-rail-btn';node.href='/';node.setAttribute('aria-label','Program Studio 메인 홈');node.title='메인 홈';node.innerHTML=`<svg viewBox="0 0 24 24" aria-hidden="true">${HOME_ICON}</svg><span class="design-essential-rail-label">메인 홈</span>`;return node;
  }

  function build(){
    const shell=document.createElement('div');shell.className='design-essential-shell';
    rail=document.createElement('nav');rail.className='design-essential-rail';rail.setAttribute('aria-label','디자인 제작 필수 메뉴');
    panel=document.createElement('div');panel.className='design-essential-panel';
    const head=document.createElement('div');head.className='design-essential-panel-head';head.innerHTML='<div class="design-essential-panel-title">구성</div><div class="design-essential-panel-hint">규격 · 글씨 · 사진 · 도형</div>';panel.appendChild(head);
    rail.appendChild(homeButton());const sep=document.createElement('div');sep.className='design-essential-rail-separator';sep.setAttribute('aria-hidden','true');rail.appendChild(sep);STEPS.forEach(meta=>rail.appendChild(button(meta)));
    moveSidebarChildren();movePropertyCards();shell.append(rail,panel);sidebar.appendChild(shell);
    document.documentElement.dataset.designEssentialWorkspace='1';byId('editorShell')?.classList.add('design-essential-two-pane');
    [...panel.children].forEach(tagNode);applyStep('compose');
  }

  function numeric(value){return Array.isArray(value)?value.map(Number).filter(Number.isFinite):[];}
  function removeInvitationGuide(){byId('designEssentialInvitationFold')?.remove();byId('designEssentialInvitationFoldLabel')?.remove();const art=byId('artboard');if(art)delete art.dataset.invitationFoldGuide;}
  function syncInvitationGuide(){
    guideFrame=0;const p=project(),art=byId('artboard');if(!p||!art||currentType()!=='invitation'||p.showGuides===false||p.showFolds===false){removeInvitationGuide();return false;}
    const surface=p.surfaces?.find(item=>item.id===p.activeSurface)||p.surfaces?.[0];if(!surface)return false;
    const yFolds=numeric(surface.foldsY),xFolds=numeric(surface.folds);const axis=(surface.foldAxis==='y'||yFolds.length)?'y':'x';const fold=(axis==='y'?yFolds[0]:xFolds[0])??((axis==='y'?Number(p.height):Number(p.width))||0)/2;
    const bleed=Math.max(0,Number(p.bleed)||0),width=Math.max(.1,Number(p.width)||0),height=Math.max(.1,Number(p.height)||0),sx=art.clientWidth/(width+bleed*2),sy=art.clientHeight/(height+bleed*2);
    let line=byId('designEssentialInvitationFold');if(!line){line=document.createElement('div');line.id='designEssentialInvitationFold';art.appendChild(line);}line.className=`design-essential-invitation-fold ${axis}`;
    let label=byId('designEssentialInvitationFoldLabel');if(!label){label=document.createElement('span');label.id='designEssentialInvitationFoldLabel';label.className='design-essential-invitation-fold-label';art.appendChild(label);}label.textContent=`접지선 · ${Math.round(fold*10)/10}mm`;
    if(axis==='x'){const x=(bleed+fold)*sx;line.style.left=`${x}px`;line.style.top=`${bleed*sy}px`;line.style.height=`${height*sy}px`;line.style.width='0';label.style.left=`${x}px`;label.style.top=`${Math.max(14,bleed*sy+14)}px`;}
    else{const y=(bleed+fold)*sy;line.style.left=`${bleed*sx}px`;line.style.top=`${y}px`;line.style.width=`${width*sx}px`;line.style.height='0';label.style.left=`${(bleed+width/2)*sx}px`;label.style.top=`${y}px`;}
    art.dataset.invitationFoldGuide=axis;return true;
  }
  function queueGuide(){
    if(currentType()!=='invitation'){
      if(guideFrame){cancelAnimationFrame(guideFrame);guideFrame=0;}
      removeInvitationGuide();return;
    }
    if(guideFrame)cancelAnimationFrame(guideFrame);
    guideFrame=requestAnimationFrame(()=>{guideFrame=0;syncInvitationGuide();});
  }

  function syncAll(){
    if(syncFrame)return;syncFrame=requestAnimationFrame(()=>{syncFrame=0;if(mutating)return;mutating=true;try{movePropertyCards();[...panel.children].forEach(tagNode);applyStep(activeStep);queueGuide();}finally{mutating=false;}});
  }

  function observe(){
    sidebarObserver=new MutationObserver(records=>{let moved=false;records.forEach(record=>record.addedNodes.forEach(node=>{if(node instanceof HTMLElement&&node.parentElement===sidebar&&!node.classList.contains('design-essential-shell')&&!node.classList.contains('program-local-actions')){panel.appendChild(node);moved=true;}}));if(moved)syncAll();});sidebarObserver.observe(sidebar,{childList:true});
    panelObserver=new MutationObserver(()=>syncAll());panelObserver.observe(panel,{childList:true});
    properties=byId('propertiesPanel');if(properties){propertiesObserver=new MutationObserver(()=>syncAll());propertiesObserver.observe(properties,{childList:true,subtree:false});}
    htmlObserver=new MutationObserver(()=>syncAll());htmlObserver.observe(document.documentElement,{attributes:true,attributeFilter:['data-design-document-type','data-active-design-mode']});
    const art=byId('artboard');if(art){artboardObserver=new MutationObserver(queueGuide);artboardObserver.observe(art,{childList:true});if(typeof ResizeObserver==='function'){artboardResizeObserver=new ResizeObserver(queueGuide);artboardResizeObserver.observe(art);}}
    ['programstudio:design-document-type','programstudio:design-mode-change','programstudio:design-product-change','resize'].forEach(name=>window.addEventListener(name,syncAll,{passive:true}));
    document.addEventListener('change',syncAll,true);document.addEventListener('click',()=>setTimeout(syncAll,0),true);
  }

  function install(attempt=0){
    sidebar=document.querySelector('.sidebar');
    if(!sidebar||!byId('inspector')||!byId('editorShell')||!window.DesignEditorApp||!window.DesignEditorWorkflowV2){if(attempt<40)setTimeout(()=>install(attempt+1),80+Math.min(attempt,14)*35);return false;}
    if(sidebar.querySelector('.design-essential-shell'))return true;
    installStyles();build();observe();queueGuide();
    window.ProgramStudioEditorToolRail={surface:'design-editor',select:step=>selectStep(step,true),showAll:()=>selectStep('output',true),get activeStep(){return activeStep;},stage:'design-essential-workspace-v1'};
    window.DesignEditorEssentialWorkspace={sync:syncAll,select:selectStep,currentType,stage:'essential-four-step-product-aware-workspace-v1'};
    return true;
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>install(),{once:true});else install();
})();