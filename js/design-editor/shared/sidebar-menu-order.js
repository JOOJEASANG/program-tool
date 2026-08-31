// Product-specific sidebar ordering for standalone design apps.
// Reorders existing canonical editor cards; it never duplicates editing logic.
(function(){
  'use strict';
  if(window.__designEditorSidebarMenuOrderV1)return;
  window.__designEditorSidebarMenuOrderV1=true;

  const params=new URLSearchParams(location.search);
  const profile=window.DesignEditorStandaloneProducts?.fromLocation?.(location.search)||null;
  if(!profile?.sidebarOrder?.length)return;

  const STYLE_ID='designSidebarMenuOrderStyles';
  const LABEL_CLASS='design-sidebar-group-label';
  const SECTION_META=Object.freeze({
    structure:{label:'규격 · 구조',rank:0},
    create:{label:'내용 · 디자인',rank:1},
    edit:{label:'편집 · 배치',rank:2},
    output:{label:'인쇄 · 출력',rank:3},
    advanced:{label:'고급 도구',rank:4}
  });
  const STRUCTURE_IDS=new Set(['designEmbeddedModeCard','designCoverSettingsTools','designCoverSpineTools']);
  const CREATE_IDS=new Set(['designSimpleResultTools','designRecipeTools','designComponentBlocksTools','designContentAddTools','designPhase2Tools','designQuickDesignTools']);
  const EDIT_IDS=new Set(['inspector','designPhase4SmartLayout','designLayerTools']);
  const OUTPUT_IDS=new Set(['designPrintQualityTools','designPrintSafetyTools','designFinalPrintCheckTools','designOutputTools']);
  const ADVANCED_IDS=new Set(['designAdvancedTools','designPhase3LayoutTools','designElementClipboardTools','designProjectFileTools','designRotationTools','designDiagnosticsTools']);

  let panel=null;
  let observer=null;
  let syncFrame=0;
  let mutating=false;
  const originalOrder=new WeakMap();
  let originalSequence=0;

  const byId=id=>document.getElementById(id);
  const isElement=node=>node&&node.nodeType===1;

  function installStyles(){
    if(byId(STYLE_ID))return;
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      .design-sidebar-group-label{display:flex;align-items:center;gap:7px;margin:12px 1px 6px;color:#66758a;font-size:7px;font-weight:950;letter-spacing:.35px;text-transform:uppercase}
      .design-sidebar-group-label::after{content:"";height:1px;flex:1;background:#e6edf3}
      .design-sidebar-group-label:first-of-type{margin-top:2px}
      .design-sidebar-group-label[hidden]{display:none!important}
      html[data-design-sidebar-order] .design-flat-panel>.side-card,
      html[data-design-sidebar-order] .design-flat-panel>.design-mode-card{margin-bottom:8px!important}
      @media(max-width:980px){.design-sidebar-group-label{margin-top:10px}}
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
    const id=String(node.id||'');
    const exact=profile.sidebarOrder.indexOf(id);
    if(exact>=0)return exact*100;
    const section=SECTION_META[sectionFor(node)]||SECTION_META.advanced;
    return profile.sidebarOrder.length*100+section.rank*1000+rememberOriginal(node);
  }

  function directCards(){
    if(!panel)return[];
    return [...panel.children].filter(node=>
      isElement(node)&&
      node.id!=='designWorkspaceNavigation'&&
      !node.classList.contains(LABEL_CLASS)
    );
  }

  function removeLabels(){
    panel?.querySelectorAll(`:scope > .${LABEL_CLASS}`).forEach(node=>node.remove());
  }

  function insertSectionLabels(cards){
    const sectionCards=new Map();
    cards.forEach(card=>{
      const section=sectionFor(card);
      if(!sectionCards.has(section))sectionCards.set(section,[]);
      sectionCards.get(section).push(card);
    });
    let lastSection='';
    cards.forEach(card=>{
      const section=sectionFor(card);
      if(section===lastSection)return;
      lastSection=section;
      const meta=SECTION_META[section]||SECTION_META.advanced;
      const label=document.createElement('div');
      label.className=LABEL_CLASS;
      label.dataset.sidebarSection=section;
      label.textContent=meta.label;
      label.hidden=!sectionCards.get(section)?.some(visible);
      panel.insertBefore(label,card);
    });
  }

  function reorder(){
    syncFrame=0;
    if(mutating)return false;
    panel=document.querySelector('.design-flat-panel');
    if(!panel)return false;
    mutating=true;
    try{
      installStyles();
      ensureNativeIds();
      removeLabels();
      const cards=directCards();
      cards.forEach(rememberOriginal);
      cards.sort((a,b)=>rank(a)-rank(b));
      cards.forEach(card=>panel.appendChild(card));
      insertSectionLabels(cards);
      document.documentElement.dataset.designSidebarOrder=profile.key;
      panel.dataset.designSidebarOrder=profile.key;
      return true;
    }finally{
      mutating=false;
    }
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
    observer.observe(panel,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden','class','data-design-flat-hidden']});
    ['programstudio:design-document-type','programstudio:design-product-change','programstudio:runtime-script-result','resize'].forEach(name=>window.addEventListener(name,schedule,{passive:true}));
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
    product:profile.key,
    order:[...profile.sidebarOrder],
    stage:'product-specific-sidebar-order-v1'
  };
})();