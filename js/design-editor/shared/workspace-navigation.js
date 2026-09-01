// Shared workspace navigation for standalone design production apps.
// Setup/output stay in the product sidebar; edit/arrange own the right context pane.
(function(){
  'use strict';
  if(window.__designEditorWorkspaceNavigationV1)return;
  window.__designEditorWorkspaceNavigationV1=true;

  const params=new URLSearchParams(location.search);
  const path=(location.pathname||'/').replace(/\/+$/,'')||'/';
  if(!path.includes('/design-editor'))return;

  const NAV_ID='designWorkspaceNavigation';
  const STYLE_ID='designWorkspaceNavigationStyles';
  const STEPS=[
    {key:'start',label:'설정'},
    {key:'edit',label:'편집'},
    {key:'arrange',label:'배치'},
    {key:'output',label:'출력'}
  ];
  const PRODUCT_LABELS={cover:'표지',poster:'포스터',flyer:'전단지',invitation:'초대장',leaflet2:'리플렛',leaflet3:'리플렛',custom:'디자인'};

  let panel=null;
  let nav=null;
  let scrollFrame=0;
  let htmlObserver=null;
  let installed=false;

  const byId=id=>document.getElementById(id);

  function currentType(){
    const type=window.DesignEditorEssentialWorkspace?.currentType?.()||document.documentElement.dataset.designDocumentType||'custom';
    return String(type||'custom');
  }

  function productLabel(){
    if(params.get('surface')==='notice')return'안내장';
    return PRODUCT_LABELS[currentType()]||'디자인';
  }

  function target(step){
    if(!panel)return null;
    if(step==='edit')return byId('inspector');
    if(step==='arrange')return byId('designLayerTools')||byId('layerList')?.closest('.side-card');
    if(step==='output')return byId('designFinalPrintCheckTools')||byId('designOutputTools');
    return byId('designEmbeddedModeCard')||byId('designCoverSettingsTools')||byId('designSimpleResultTools')||panel.querySelector('.side-card,.design-mode-card');
  }

  function contextStep(){
    if(document.documentElement.dataset.designContextPaneOpen!=='true')return null;
    return document.documentElement.dataset.designContextTab==='layers'?'arrange':'edit';
  }

  function installStyles(){
    if(byId(STYLE_ID))return;
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      #${NAV_ID}{position:sticky;top:0;z-index:86;margin:-11px -12px 11px;padding:10px 12px 9px;background:rgba(255,255,255,.97);border-bottom:1px solid #e4eaf1;box-shadow:0 5px 14px rgba(15,39,72,.045);backdrop-filter:blur(8px)}
      #${NAV_ID} .design-workspace-nav-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:7px}
      #${NAV_ID} .design-workspace-nav-head strong{font-size:10px;font-weight:950;color:#0b2a55;letter-spacing:-.15px}
      #${NAV_ID} .design-workspace-nav-head span{font-size:7px;font-weight:850;color:#98a2b3;letter-spacing:.35px}
      #${NAV_ID} .design-workspace-nav-steps{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:4px}
      #${NAV_ID} button{height:30px;border:1px solid #d9e3ee;border-radius:8px;background:#fff;color:#526174;font-family:inherit;font-size:8px;font-weight:900;cursor:pointer;transition:background .14s,border-color .14s,color .14s,box-shadow .14s}
      #${NAV_ID} button:hover{border-color:#9bb5d0;background:#f6faff;color:#17466f}
      #${NAV_ID} button.active{border-color:#8bb4df;background:#eaf4ff;color:#1769e0;box-shadow:0 0 0 1px rgba(23,105,224,.04) inset}
      #${NAV_ID} button:focus-visible{outline:2px solid rgba(23,105,224,.28);outline-offset:1px}
      @media(max-width:980px){#${NAV_ID}{margin:-10px -10px 10px;padding:8px 10px;top:0}}
    `;
    document.head.appendChild(style);
  }

  function setActive(step){
    if(!nav)return;
    nav.querySelectorAll('[data-workspace-step]').forEach(button=>{
      const active=button.dataset.workspaceStep===step;
      button.classList.toggle('active',active);
      if(active)button.setAttribute('aria-current','step');else button.removeAttribute('aria-current');
    });
    nav.dataset.activeStep=step;
  }

  function syncProduct(){
    const node=nav?.querySelector('[data-workspace-product]');
    if(node)node.textContent=productLabel();
    if(nav)nav.dataset.product=currentType();
  }

  function prepareSidebar(step){
    if(step==='edit'||step==='arrange')return null;
    try{return window.DesignEditorSidebarMenuOrder?.openForStep?.(step)||null;}catch(_){return null;}
  }

  function select(step='start',scroll=true){
    const normalized=STEPS.some(item=>item.key===step)?step:'start';
    const sidebarSection=prepareSidebar(normalized);
    const api=window.DesignEditorEssentialWorkspace||window.ProgramStudioEditorToolRail;
    if(scroll&&api?.select){
      try{api.select(normalized,true);}catch(_){}
    }else if(scroll){
      const node=target(normalized);
      try{node?.scrollIntoView({behavior:'smooth',block:'start'});}catch(_){node?.scrollIntoView();}
    }
    setActive(normalized);
    try{window.dispatchEvent(new CustomEvent('programstudio:workspace-navigation-select',{detail:{step:normalized,sidebarSection,contextPane:normalized==='edit'||normalized==='arrange'}}));}catch(_){}
    return true;
  }

  function syncActiveFromScroll(){
    scrollFrame=0;
    if(!panel||!nav)return;
    const contextual=contextStep();
    if(contextual){setActive(contextual);return;}
    const threshold=panel.scrollTop+nav.offsetHeight+24;
    let chosen='start';
    for(const item of STEPS.filter(item=>item.key==='start'||item.key==='output')){
      const node=target(item.key);
      if(node&&Number(node.offsetTop)<=threshold)chosen=item.key;
    }
    setActive(chosen);
  }

  function scheduleScrollSync(){
    if(scrollFrame)return;
    scrollFrame=requestAnimationFrame(syncActiveFromScroll);
  }

  function ensureNav(){
    panel=document.querySelector('.design-flat-panel');
    if(!panel)return false;
    installStyles();
    nav=byId(NAV_ID);
    if(!nav){
      nav=document.createElement('nav');
      nav.id=NAV_ID;
      nav.className='design-workspace-nav';
      nav.setAttribute('aria-label','디자인 작업 흐름 빠른 이동');
      nav.innerHTML=`<div class="design-workspace-nav-head"><strong data-workspace-product>${productLabel()}</strong><span>WORKSPACE</span></div><div class="design-workspace-nav-steps">${STEPS.map(item=>`<button type="button" data-workspace-step="${item.key}">${item.label}</button>`).join('')}</div>`;
      panel.prepend(nav);
      nav.addEventListener('click',event=>{
        const button=event.target.closest('[data-workspace-step]');
        if(!button)return;
        select(button.dataset.workspaceStep,true);
      });
    }else if(nav.parentElement!==panel){panel.prepend(nav);}
    syncProduct();syncActiveFromScroll();return true;
  }

  function sync(){
    if(!ensureNav())return false;
    syncProduct();scheduleScrollSync();return true;
  }

  function observe(){
    if(installed)return;
    installed=true;
    panel?.addEventListener('scroll',scheduleScrollSync,{passive:true});
    htmlObserver=new MutationObserver(()=>{syncProduct();scheduleScrollSync();});
    htmlObserver.observe(document.documentElement,{attributes:true,attributeFilter:['data-design-document-type','data-active-design-mode','data-design-context-pane-open','data-design-context-tab']});
    ['programstudio:design-document-type','programstudio:document-type-change','programstudio:design-mode-change','programstudio:design-product-change','programstudio:runtime-script-result','resize'].forEach(name=>window.addEventListener(name,()=>{syncProduct();scheduleScrollSync();},{passive:true}));
  }

  function boot(attempt=0){
    if(!window.DesignEditorEssentialWorkspace||!ensureNav()){
      if(attempt<60)setTimeout(()=>boot(attempt+1),80+Math.min(attempt,15)*25);
      return false;
    }
    observe();[120,400,900,1800].forEach(delay=>setTimeout(sync,delay));return true;
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>boot(),{once:true});else boot();

  window.DesignEditorWorkspaceNavigation={sync,select,currentType,stage:'shared-workspace-navigation-v3'};
})();
