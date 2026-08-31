// Product-specific sidebar ordering for standalone design apps.
// Reorders existing canonical editor cards and adds lightweight section controls.
(function(){
  'use strict';
  if(window.__designEditorSidebarMenuOrderV2)return;
  window.__designEditorSidebarMenuOrderV2=true;
  window.__designEditorSidebarMenuOrderV1=true;

  const profile=window.DesignEditorStandaloneProducts?.fromLocation?.(location.search)||null;
  if(!profile?.sidebarOrder?.length)return;

  const STYLE_ID='designSidebarMenuOrderStyles';
  const LABEL_CLASS='design-sidebar-group-label';
  const COLLAPSED_CARD_CLASS='design-sidebar-section-collapsed-card';
  const STORAGE_KEY=`programTool.designEditor.sidebarSections.v1.${profile.key}`;
  const SECTION_META=Object.freeze({
    structure:{label:'규격 · 구조',rank:0},
    create:{label:'내용 · 디자인',rank:1},
    edit:{label:'편집 · 배치',rank:2},
    output:{label:'인쇄 · 출력',rank:3},
    advanced:{label:'고급 도구',rank:4}
  });
  const STRUCTURE_IDS=new Set(['designEmbeddedModeCard','designCoverSettingsTools','designCoverSpineTools']);
  const CREATE_IDS=new Set(['designSimpleResultTools','designRecipeTools','designComponentBlocksTools','designContentAddTools','designPhase2Tools','designQuickDesignTools']);
  const EDIT_IDS=new Set(['inspector','designLayerTools']);
  const OUTPUT_IDS=new Set(['designPrintQualityTools','designPrintSafetyTools','designFinalPrintCheckTools','designOutputTools']);
  const ADVANCED_IDS=new Set(['designAdvancedTools','designPhase3LayoutTools','designElementClipboardTools','designProjectFileTools','designRotationTools','designDiagnosticsTools']);
  const SMART_LAYOUT_CREATE_PRODUCTS=new Set(['poster','flyer','leaflet']);

  let panel=null;
  let observer=null;
  let syncFrame=0;
  let activeFrame=0;
  let mutating=false;
  let observedPanel=null;
  const originalOrder=new WeakMap();
  let originalSequence=0;
  let collapsedSections=loadCollapsedSections();

  const byId=id=>document.getElementById(id);
  const isElement=node=>node&&node.nodeType===1;

  function loadCollapsedSections(){
    const fallback={advanced:true};
    try{
      const saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}');
      return{...fallback,...saved};
    }catch(_){return fallback;}
  }

  function saveCollapsedSections(){
    try{localStorage.setItem(STORAGE_KEY,JSON.stringify(collapsedSections));}catch(_){}
  }

  function installStyles(){
    if(byId(STYLE_ID))return;
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      .design-sidebar-group-label{width:100%;display:flex;align-items:center;gap:6px;margin:12px 1px 6px;padding:4px 2px;border:0;background:transparent;color:#66758a;font-family:inherit;font-size:7px;font-weight:950;letter-spacing:.25px;text-align:left;cursor:pointer}
      .design-sidebar-group-label:first-of-type{margin-top:2px}
      .design-sidebar-group-label[hidden]{display:none!important}
      .design-sidebar-group-label::after{content:"";height:1px;flex:1;background:#e6edf3;transition:background .14s}
      .design-sidebar-group-label:hover{color:#355a80}
      .design-sidebar-group-label.active{color:#1769e0}
      .design-sidebar-group-label.active::after{background:#bad5f5}
      .design-sidebar-group-label:focus-visible{outline:2px solid rgba(23,105,224,.24);outline-offset:2px;border-radius:5px}
      .design-sidebar-group-chevron{width:10px;color:#98a2b3;font-size:8px;line-height:1;transform:rotate(0deg);transition:transform .14s,color .14s}
      .design-sidebar-group-label[aria-expanded="false"] .design-sidebar-group-chevron{transform:rotate(-90deg)}
      .design-sidebar-group-label.active .design-sidebar-group-chevron{color:#1769e0}
      .design-sidebar-group-count{flex:0 0 auto;min-width:15px;padding:2px 4px;border-radius:999px;background:#f1f4f8;color:#8591a2;font-size:6px;font-weight:900;text-align:center;letter-spacing:0}
      .design-sidebar-group-label.active .design-sidebar-group-count{background:#eaf4ff;color:#1769e0}
      .${COLLAPSED_CARD_CLASS}{display:none!important}
      html[data-design-sidebar-order] .design-flat-panel>.side-card,
      html[data-design-sidebar-order] .design-flat-panel>.design-mode-card{margin-bottom:8px!important}
      @media(max-width:980px){.design-sidebar-group-label{margin-top:10px;padding-block:5px}}
    `;
    document.head.appendChild(style);
  }

  function ensureNativeIds(){
    const contentCard=byId('addTitleBtn')?.closest('.side-card');
    if(contentCard&&!contentCard.id)contentCard.id='designContentAddTools';
    const layerCard=byId('layerList')?.closest('.side-card');
    if(layerCard&&!layerCard.id)layerCard.id='designLayerTools';
  }

  function rememberOriginal(node){
    if(!originalOrder.has(node))originalOrder.set(node,originalSequence++);
    return originalOrder.get(node)||0;
  }

  function sectionFor(node){
    const id=String(node?.id||'');
    if(STRUCTURE_IDS.has(id)||/CoverSettings|CoverSpine|PrintFold|Leaflet|FoldTools/i.test(id))return'structure';
    if(id==='designPhase4SmartLayout')return SMART_LAYOUT_CREATE_PRODUCTS.has(profile.key)?'create':'edit';
    if(CREATE_IDS.has(id))return'create';
    if(EDIT_IDS.has(id))return'edit';
    if(OUTPUT_IDS.has(id)||/PrintQuality|PrintSafety|FinalPrint|Output/i.test(id))return'output';
    if(ADVANCED_IDS.has(id)||/Advanced|Clipboard|ProjectFile|Rotation|Diagnostics|Runtime/i.test(id))return'advanced';
    const text=String(node?.querySelector?.('.side-label,summary,.inspector-title')?.textContent||'');
    if(/규격|책등|접지|용지/.test(text))return'structure';
    if(/출력|인쇄|PDF|PNG/.test(text))return'output';
    if(/레이어|정렬|배치|선택 속성/.test(text))return'edit';
    if(/고급|프로젝트|회전|복사|진단/.test(text))return'advanced';
    return'create';
  }

  function visible(node){
    if(!isElement(node)||node.hidden)return false;
    if(node.dataset.designFlatHidden==='1')return false;
    if(node.classList.contains('design-simple-basic-hidden'))return false;
    return true;
  }

  function rank(node){
    const section=SECTION_META[sectionFor(node)]||SECTION_META.advanced;
    const exact=profile.sidebarOrder.indexOf(String(node.id||''));
    const within=exact>=0?exact:profile.sidebarOrder.length+rememberOriginal(node);
    return section.rank*100000+within;
  }

  function directCards(){
    if(!panel)return[];
    return [...panel.children].filter(node=>
      isElement(node)&&
      !node.classList.contains(LABEL_CLASS)&&
      node.matches('.side-card,.design-mode-card')
    );
  }

  function sectionCards(section,cards=directCards()){
    return cards.filter(card=>sectionFor(card)===section);
  }

  function sectionHasVisibleCards(section,cards=directCards()){
    return sectionCards(section,cards).some(visible);
  }

  function isCollapsed(section){return Boolean(collapsedSections[section]);}

  function removeLabels(){
    panel?.querySelectorAll(`:scope > .${LABEL_CLASS}`).forEach(node=>node.remove());
  }

  function insertSectionLabels(cards){
    const sectionMap=new Map();
    cards.forEach(card=>{
      const section=sectionFor(card);
      if(!sectionMap.has(section))sectionMap.set(section,[]);
      sectionMap.get(section).push(card);
    });
    let lastSection='';
    cards.forEach(card=>{
      const section=sectionFor(card);
      if(section===lastSection)return;
      lastSection=section;
      const sectionItems=sectionMap.get(section)||[];
      const meta=SECTION_META[section]||SECTION_META.advanced;
      const label=document.createElement('button');
      label.type='button';
      label.className=LABEL_CLASS;
      label.dataset.sidebarSection=section;
      label.setAttribute('aria-expanded',String(!isCollapsed(section)));
      label.setAttribute('aria-label',`${meta.label} ${isCollapsed(section)?'펼치기':'접기'}`);
      label.innerHTML=`<span class="design-sidebar-group-chevron" aria-hidden="true">▾</span><span>${meta.label}</span><span class="design-sidebar-group-count">${sectionItems.filter(visible).length}</span>`;
      label.hidden=!sectionItems.some(visible);
      label.addEventListener('click',()=>toggleSection(section));
      panel.insertBefore(label,card);
    });
  }

  function updateSectionLabels(cards=directCards()){
    panel?.querySelectorAll(`:scope > .${LABEL_CLASS}`).forEach(label=>{
      const section=label.dataset.sidebarSection||'';
      const items=sectionCards(section,cards);
      const expanded=!isCollapsed(section);
      label.hidden=!items.some(visible);
      label.setAttribute('aria-expanded',String(expanded));
      label.setAttribute('aria-label',`${SECTION_META[section]?.label||section} ${expanded?'접기':'펼치기'}`);
      const count=label.querySelector('.design-sidebar-group-count');
      if(count)count.textContent=String(items.filter(visible).length);
    });
  }

  function applyCollapsedState(cards=directCards()){
    cards.forEach(card=>card.classList.toggle(COLLAPSED_CARD_CLASS,isCollapsed(sectionFor(card))));
    updateSectionLabels(cards);
    if(panel){
      panel.dataset.designSidebarAdvanced=isCollapsed('advanced')?'collapsed':'expanded';
      panel.dataset.designSidebarSections='interactive';
    }
    document.documentElement.dataset.designSidebarSections='interactive';
  }

  function startObserving(){
    if(!observer||!panel)return;
    observedPanel=panel;
    observer.observe(panel,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden','class','data-design-flat-hidden']});
  }

  function guardedMutation(callback){
    if(mutating)return callback();
    mutating=true;
    const reconnect=Boolean(observer);
    if(reconnect)observer.disconnect();
    try{return callback();}
    finally{
      mutating=false;
      if(reconnect)startObserving();
    }
  }

  function setCollapsed(section,collapsed,persist=true){
    if(!SECTION_META[section])return false;
    collapsedSections={...collapsedSections,[section]:Boolean(collapsed)};
    guardedMutation(()=>applyCollapsedState());
    if(persist)saveCollapsedSections();
    scheduleActiveSync();
    return !isCollapsed(section);
  }

  function toggleSection(section){
    const expanded=setCollapsed(section,!isCollapsed(section),true);
    const label=panel?.querySelector(`:scope > .${LABEL_CLASS}[data-sidebar-section="${section}"]`);
    label?.focus?.({preventScroll:true});
    return expanded;
  }

  function openSection(section,persist=true){
    if(!SECTION_META[section]||!sectionHasVisibleCards(section))return false;
    setCollapsed(section,false,persist);
    activateSection(section);
    return true;
  }

  function openForStep(step){
    const normalized=String(step||'start');
    let section='create';
    if(normalized==='output')section='output';
    else if(normalized==='edit'||normalized==='arrange')section='edit';
    else if(sectionHasVisibleCards('structure'))section='structure';
    openSection(section,true);
    return section;
  }

  function activateSection(section){
    if(!panel)return;
    panel.querySelectorAll(`:scope > .${LABEL_CLASS}`).forEach(label=>{
      const active=label.dataset.sidebarSection===section&&!label.hidden;
      label.classList.toggle('active',active);
      if(active)label.setAttribute('aria-current','location');else label.removeAttribute('aria-current');
    });
    panel.dataset.designSidebarActiveSection=section||'';
  }

  function syncActiveFromScroll(){
    activeFrame=0;
    if(!panel)return;
    const labels=[...panel.querySelectorAll(`:scope > .${LABEL_CLASS}`)].filter(label=>!label.hidden);
    if(!labels.length)return;
    const navHeight=byId('designWorkspaceNavigation')?.offsetHeight||0;
    const threshold=panel.scrollTop+navHeight+26;
    let active=labels[0].dataset.sidebarSection||'';
    labels.forEach(label=>{if(label.offsetTop<=threshold)active=label.dataset.sidebarSection||active;});
    activateSection(active);
  }

  function scheduleActiveSync(){
    if(activeFrame)return;
    activeFrame=requestAnimationFrame(syncActiveFromScroll);
  }

  function reorder(){
    syncFrame=0;
    if(mutating)return false;
    panel=document.querySelector('.design-flat-panel');
    if(!panel)return false;
    const changedPanel=observedPanel&&observedPanel!==panel;
    if(changedPanel){observer?.disconnect();observer=null;observedPanel=null;}
    guardedMutation(()=>{
      installStyles();
      ensureNativeIds();
      removeLabels();
      const cards=directCards();
      cards.forEach(rememberOriginal);
      cards.sort((a,b)=>rank(a)-rank(b));
      cards.forEach(card=>panel.appendChild(card));
      insertSectionLabels(cards);
      applyCollapsedState(cards);
      document.documentElement.dataset.designSidebarOrder=profile.key;
      panel.dataset.designSidebarOrder=profile.key;
    });
    scheduleActiveSync();
    return true;
  }

  function schedule(){
    if(syncFrame)return;
    syncFrame=requestAnimationFrame(()=>reorder());
  }

  function observe(){
    if(observer||!panel)return;
    observer=new MutationObserver(mutations=>{
      if(mutating)return;
      if(mutations.some(item=>item.type==='childList'||item.type==='attributes'))schedule();
    });
    startObserving();
    panel.addEventListener('scroll',scheduleActiveSync,{passive:true});
    ['programstudio:design-document-type','programstudio:design-product-change','programstudio:runtime-script-result','resize'].forEach(name=>window.addEventListener(name,()=>{schedule();scheduleActiveSync();},{passive:true}));
    document.addEventListener('click',()=>setTimeout(schedule,0),true);
  }

  function sync(){
    if(!reorder())return false;
    observe();
    return true;
  }

  function boot(attempt=0){
    panel=document.querySelector('.design-flat-panel');
    if(!panel){
      if(attempt<60)setTimeout(()=>boot(attempt+1),80+Math.min(attempt,15)*25);
      return false;
    }
    sync();
    [160,420,900,1800,3000].forEach(delay=>setTimeout(schedule,delay));
    return true;
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>boot(),{once:true});else boot();

  window.DesignEditorSidebarMenuOrder={
    sync,
    openSection,
    toggleSection,
    openForStep,
    isCollapsed,
    sectionFor,
    product:profile.key,
    order:[...profile.sidebarOrder],
    stage:'product-specific-sidebar-sections-v2'
  };
})();