// Professional fixed command bar for the embedded design editor.
// Keeps product switching in the existing print-product menu and proxies existing editor actions.
(function(){
  'use strict';
  if(window.__designEditorPrintProductTopbarV2)return;
  window.__designEditorPrintProductTopbarV2=true;

  const params=new URLSearchParams(location.search);
  if(params.get('embed')!=='1')return;

  const TOPBAR_ID='designPrintProductTopbar';
  const SURFACE_GROUP_ID='designSurfaceTopbarGroup';
  const COMMAND_BAR_ID='designTopCommandbar';
  const STYLE_ID='designPrintProductTopbarStyles';
  const INSERT_POPOVER_ID='designTopInsertPopover';
  const HELP_POPOVER_ID='designTopHelpPopover';
  const PRODUCTS=[
    ['cover','표지'],['poster','포스터'],['flyer','전단'],['invitation','초대장·안내장'],['leaflet','리플렛']
  ];
  const PRODUCT_KEYS=new Set(PRODUCTS.map(([key])=>key));
  const INSERT_ACTIONS={
    title:{label:'메인 제목',target:'addTitleBtn'},
    subtitle:{label:'부제목',target:'addSubtitleBtn'},
    body:{label:'본문',target:'addBodyBtn'},
    info:{label:'날짜·장소',target:'addInfoBtn'},
    image:{label:'이미지',target:'phase2AddImage'},
    rect:{label:'사각형',target:'phase2AddRect'},
    ellipse:{label:'원·타원',target:'phase2AddEllipse'},
    line:{label:'선',target:'phase2AddLine'}
  };
  const ICONS={
    undo:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 7 4 12l5 5"/><path d="M5 12h8a6 6 0 0 1 6 6"/></svg>',
    redo:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 7 5 5-5 5"/><path d="M19 12h-8a6 6 0 0 0-6 6"/></svg>',
    plus:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    panel:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="4" width="17" height="16" rx="2"/><path d="M9 4v16"/></svg>',
    fit:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4H4v4M16 4h4v4M8 20H4v-4M16 20h4v-4"/><rect x="8" y="8" width="8" height="8" rx="1"/></svg>',
    help:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9.8 9a2.4 2.4 0 1 1 3.8 2c-1 .7-1.6 1.1-1.6 2.5M12 17h.01"/></svg>',
    output:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 9V4h10v5M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2"/><path d="M7 14h10v6H7z"/></svg>'
  };
  let timer=0;
  let observer=null;
  let stateObserver=null;
  let selectionObserver=null;
  let lastSelectionKey='';
  let outsideBound=false;

  const byId=id=>document.getElementById(id);
  const sourceCard=()=>byId('designEmbeddedModeCard');
  const isEditableTarget=target=>Boolean(target?.closest?.('input,textarea,select,[contenteditable="true"],[contenteditable=""]'));

  function installStyles(){
    if(byId(STYLE_ID))return;
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      .editor-toolbar{position:sticky!important;top:0!important;z-index:74!important;height:54px!important;flex:0 0 54px!important;gap:8px!important;padding:0 10px!important;box-shadow:0 3px 12px rgba(15,39,72,.06);overflow:visible!important}
      .editor-toolbar>.toolbar-hint{display:none!important}
      #${TOPBAR_ID}{display:flex;align-items:center;gap:7px;min-width:0;flex:0 1 auto}
      #${TOPBAR_ID} .design-product-topbar-label,.design-surface-topbar-label{flex:0 0 auto;font-size:8px;font-weight:950;color:#738195;white-space:nowrap}
      #${TOPBAR_ID} .design-product-topbar-tabs{display:flex;align-items:center;gap:4px;min-width:0;overflow-x:auto;overflow-y:hidden;scrollbar-width:none;padding:2px}
      #${TOPBAR_ID} .design-product-topbar-tabs::-webkit-scrollbar{display:none}
      #${TOPBAR_ID} .design-product-topbar-btn{flex:0 0 auto;height:32px;border:1px solid #d6e0e9;border-radius:8px;background:#fff;color:#526174;padding:0 10px;font-size:8px;font-weight:900;cursor:pointer;white-space:nowrap;transition:.14s ease}
      #${TOPBAR_ID} .design-product-topbar-btn:hover{border-color:#9ebbd6;background:#f6faff;color:#173b66}
      #${TOPBAR_ID} .design-product-topbar-btn.on{border-color:#12396d;background:#12396d;color:#fff;box-shadow:0 2px 7px rgba(18,57,109,.16)}
      #${TOPBAR_ID} .design-product-topbar-btn:focus-visible,.design-top-command:focus-visible{outline:2px solid #1d9bb2;outline-offset:2px}
      #${SURFACE_GROUP_ID}{display:flex;align-items:center;gap:6px;flex:0 0 auto;padding-left:9px;border-left:1px solid #e0e7ef}
      #${SURFACE_GROUP_ID} .surface-tabs{display:flex!important;align-items:center;gap:3px;min-width:0}
      #${SURFACE_GROUP_ID} .surface-tab{height:30px!important;border:1px solid #d8e1eb!important;border-radius:8px!important;background:#f8fafc!important;color:#66758a!important;padding:0 9px!important;font-size:8px!important;font-weight:900!important}
      #${SURFACE_GROUP_ID} .surface-tab:hover{border-color:#a9bfd8!important;background:#f2f7fd!important;color:#244b75!important}
      #${SURFACE_GROUP_ID} .surface-tab.on{border-color:#8eb6e7!important;background:#edf5ff!important;color:#1769e0!important;box-shadow:inset 0 0 0 1px rgba(23,105,224,.08)!important}
      #${COMMAND_BAR_ID}{display:flex;align-items:center;gap:4px;margin-left:auto;position:relative;flex:0 0 auto}
      .design-top-command{height:32px;min-width:32px;border:1px solid #d7e0e9;border-radius:8px;background:#fff;color:#536377;padding:0 8px;display:inline-flex;align-items:center;justify-content:center;gap:5px;font-size:8px;font-weight:900;cursor:pointer;white-space:nowrap}
      .design-top-command:hover:not(:disabled){border-color:#9fb9d4;background:#f5f9ff;color:#173b66}
      .design-top-command:disabled{opacity:.38;cursor:not-allowed}
      .design-top-command svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
      .design-top-command.primary{border-color:#1769e0;background:#1769e0;color:#fff;padding-inline:10px;box-shadow:0 3px 8px rgba(23,105,224,.18)}
      .design-top-command.primary:hover{border-color:#145fc8;background:#145fc8;color:#fff}
      .design-top-command[aria-pressed="true"]{border-color:#9bbce0;background:#edf5ff;color:#155b99}
      .design-top-popover-host{position:relative;display:flex}
      .design-top-popover{position:absolute;right:0;top:calc(100% + 8px);z-index:600;min-width:220px;border:1px solid #d8e1eb;border-radius:12px;background:#fff;padding:8px;box-shadow:0 16px 38px rgba(15,39,72,.20)}
      .design-top-popover[hidden]{display:none!important}
      .design-insert-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px}
      .design-insert-grid button{min-height:34px;border:1px solid #e0e7ef;border-radius:8px;background:#fff;color:#475569;padding:6px 8px;text-align:left;font-size:8px;font-weight:900;cursor:pointer}
      .design-insert-grid button:hover{border-color:#9ebbd6;background:#f3f8ff;color:#173b66}
      .design-popover-title{margin:1px 2px 7px;color:#2e4056;font-size:9px;font-weight:950}
      .design-help-list{display:grid;gap:5px;margin:0;padding:0;list-style:none}
      .design-help-list li{display:flex;align-items:center;justify-content:space-between;gap:12px;color:#64748b;font-size:8px;line-height:1.35}
      .design-help-list kbd{border:1px solid #d9e1ea;border-bottom-width:2px;border-radius:5px;background:#f7f9fb;color:#44546a;padding:2px 5px;font:800 7px/1.3 inherit;white-space:nowrap}
      #designEmbeddedModeCard[data-product-selection-top="1"] .design-mode-grid{display:none!important}
      #designEmbeddedModeCard[data-product-selection-top="1"] .design-mode-head{margin-bottom:7px}
      #designEmbeddedModeCard[data-product-selection-top="1"] .design-mode-title{font-size:10px}
      #designEmbeddedModeCard[data-product-selection-top="1"] .design-mode-sub{font-size:6.8px;line-height:1.35}
      .editor-toolbar>.save-state{flex:0 0 auto;margin-left:2px}
      @media(max-width:1280px){
        #${TOPBAR_ID} .design-product-topbar-label,.design-surface-topbar-label{display:none}
        #${TOPBAR_ID} .design-product-topbar-btn{padding:0 8px}
        .design-top-command .design-command-text{display:none}
        .design-top-command.primary .design-command-text{display:inline}
      }
      @media(max-width:920px){
        .editor-toolbar{height:auto!important;min-height:54px!important;flex:0 0 auto!important;flex-wrap:wrap!important;padding:7px 8px!important}
        #${TOPBAR_ID}{order:-30;width:100%;max-width:100%}
        #${TOPBAR_ID} .design-product-topbar-tabs{width:100%;padding-bottom:2px}
        #${SURFACE_GROUP_ID}{order:-20;padding-left:0;border-left:0}
        #${COMMAND_BAR_ID}{order:-10;margin-left:auto}
        .editor-toolbar>.save-state{order:-5}
      }
      @media(max-width:620px){
        #${TOPBAR_ID} .design-product-topbar-btn{height:31px;padding:0 9px;font-size:8px}
        #${SURFACE_GROUP_ID}{max-width:42%;overflow-x:auto}
        #${COMMAND_BAR_ID}{max-width:58%;overflow-x:auto;padding-bottom:2px;scrollbar-width:none}
        #${COMMAND_BAR_ID}::-webkit-scrollbar{display:none}
        .design-top-command{flex:0 0 32px;padding:0}
        .design-top-command.primary{flex-basis:auto;padding:0 8px}
      }
    `;
    document.head.appendChild(style);
  }

  function activeProduct(){
    const dataset=String(document.documentElement.dataset.printProductMenu||'');
    if(PRODUCT_KEYS.has(dataset))return dataset;
    const project=window.DesignEditorApp?.project||null;
    if(project?.printProductMode==='invitation'||project?.printProductMode==='leaflet')return project.printProductMode;
    if(project?.designMode==='leaflet2'||project?.designMode==='leaflet3')return'leaflet';
    if(project?.designMode==='poster')return'poster';
    if(project?.designMode==='flyer')return'flyer';
    if(params.get('mode')==='cover'||project?.designMode==='cover')return'cover';
    return'poster';
  }

  function keepSettingsVisible(){
    const card=sourceCard();
    if(!card)return false;
    card.dataset.productSelectionTop='1';
    card.dataset.psToolAlways='1';
    delete card.dataset.psToolStep;
    card.classList.remove('ps-tool-context-hidden');
    card.hidden=false;
    const grid=card.querySelector('.design-mode-grid');
    if(grid){grid.hidden=true;grid.setAttribute('aria-hidden','true');}
    const title=card.querySelector('.design-mode-title');
    const sub=card.querySelector('.design-mode-sub');
    if(title)title.textContent='문서 설정';
    if(sub)sub.textContent='선택한 작업의 규격·방향·접지 옵션을 조정합니다.';
    return true;
  }

  function syncButtons(){
    const root=byId(TOPBAR_ID);
    if(!root)return;
    const active=activeProduct();
    root.querySelectorAll('[data-print-product-top]').forEach(button=>{
      const selected=button.dataset.printProductTop===active;
      button.classList.toggle('on',selected);
      button.setAttribute('aria-pressed',String(selected));
      if(selected)button.setAttribute('aria-current','page');
      else button.removeAttribute('aria-current');
    });
    root.dataset.activeProduct=active;
  }

  function activateProduct(product){
    if(!PRODUCT_KEYS.has(product))return false;
    closePopovers();
    const trySource=()=>{
      window.DesignEditorPrintProductMenu?.render?.();
      const button=sourceCard()?.querySelector(`[data-print-product="${product}"]`);
      if(!button)return false;
      button.click();
      queue(30);
      return true;
    };
    if(trySource())return true;
    let attempts=0;
    const retry=()=>{
      attempts+=1;
      if(trySource()||attempts>=12)return;
      setTimeout(retry,60);
    };
    setTimeout(retry,30);
    return false;
  }

  function routeStep(step){
    try{
      if(window.ProgramStudioEditorToolRail?.select){window.ProgramStudioEditorToolRail.select(step);return true;}
      if(window.DesignEditorWorkflowV2?.activateStep){window.DesignEditorWorkflowV2.activateStep(step,false);return true;}
    }catch(error){console.warn('[design-commandbar] step route failed',error);}
    return false;
  }

  function clickWhenReady(id,after,attempt=0){
    const target=byId(id);
    if(target){target.click();after?.();return true;}
    if(attempt>=10)return false;
    setTimeout(()=>clickWhenReady(id,after,attempt+1),70);
    return false;
  }

  function runInsert(action){
    const item=INSERT_ACTIONS[action];if(!item)return false;
    closePopovers();
    routeStep('compose');
    return clickWhenReady(item.target,()=>{
      if(action!=='image')setTimeout(()=>routeStep('edit'),80);
      queue(30);
    });
  }

  function runHistory(direction){
    closePopovers();
    const api=window.DesignEditorPhase3Controls;
    if(direction==='undo'&&api?.undo)api.undo();
    else if(direction==='redo'&&api?.redo)api.redo();
    else byId(direction==='undo'?'phase3Undo':'phase3Redo')?.click();
    setTimeout(syncCommands,40);
  }

  function togglePanel(){
    closePopovers();
    const source=document.querySelector('.ps-sidebar-toggle');
    if(source){source.click();setTimeout(syncCommands,30);return;}
    const root=document.documentElement;
    const collapsed=root.classList.toggle('ps-sidebar-collapsed');
    try{localStorage.setItem('program-studio:sidebar:design-editor',collapsed?'collapsed':'expanded');}catch(_){}
    document.querySelector('.sidebar')?.setAttribute('aria-hidden',String(collapsed));
    window.dispatchEvent(new Event('resize'));
    syncCommands();
  }

  function fitView(){
    closePopovers();
    window.dispatchEvent(new Event('resize'));
    requestAnimationFrame(()=>{
      const viewport=byId('artboardViewport');
      if(viewport)viewport.scrollTo?.({top:0,left:0,behavior:'smooth'});
    });
    const status=byId('editorStatus');
    if(status){status.className='editor-status ok';status.textContent='작업영역을 화면에 맞췄습니다.';}
  }

  function openOutput(){
    closePopovers();
    routeStep('output');
    setTimeout(()=>byId('designOutputTools')?.scrollIntoView?.({block:'nearest',behavior:'smooth'}),60);
  }

  function togglePopover(id,button){
    const target=byId(id);if(!target)return;
    const open=target.hidden;
    closePopovers();
    if(open){target.hidden=false;button?.setAttribute('aria-expanded','true');}
  }

  function closePopovers(){
    [INSERT_POPOVER_ID,HELP_POPOVER_ID].forEach(id=>{const node=byId(id);if(node)node.hidden=true;});
    byId(COMMAND_BAR_ID)?.querySelectorAll('[aria-expanded="true"]').forEach(button=>button.setAttribute('aria-expanded','false'));
  }

  function commandMarkup(){
    return `<button type="button" class="design-top-command" data-design-command="undo" aria-label="실행 취소" title="실행 취소 · Ctrl+Z">${ICONS.undo}</button><button type="button" class="design-top-command" data-design-command="redo" aria-label="다시 실행" title="다시 실행 · Ctrl+Y">${ICONS.redo}</button><div class="design-top-popover-host"><button type="button" class="design-top-command" data-design-command="insert" aria-haspopup="menu" aria-expanded="false" aria-controls="${INSERT_POPOVER_ID}" title="요소 추가">${ICONS.plus}<span class="design-command-text">추가</span></button><div id="${INSERT_POPOVER_ID}" class="design-top-popover" role="menu" hidden><div class="design-popover-title">빠르게 추가</div><div class="design-insert-grid">${Object.entries(INSERT_ACTIONS).map(([key,item])=>`<button type="button" role="menuitem" data-design-insert="${key}">${item.label}</button>`).join('')}</div></div></div><button type="button" class="design-top-command" data-design-command="panel" aria-pressed="false" title="작업 패널 접기/펼치기">${ICONS.panel}<span class="design-command-text">패널</span></button><button type="button" class="design-top-command" data-design-command="fit" title="작업영역 화면 맞춤">${ICONS.fit}<span class="design-command-text">맞춤</span></button><div class="design-top-popover-host"><button type="button" class="design-top-command" data-design-command="help" aria-haspopup="dialog" aria-expanded="false" aria-controls="${HELP_POPOVER_ID}" title="사용법·단축키">${ICONS.help}</button><div id="${HELP_POPOVER_ID}" class="design-top-popover" role="dialog" aria-label="디자인 편집 단축키" hidden><div class="design-popover-title">빠른 사용법</div><ul class="design-help-list"><li><span>실행 취소</span><kbd>Ctrl Z</kbd></li><li><span>다시 실행</span><kbd>Ctrl Y / Shift Z</kbd></li><li><span>선택 요소 복제</span><kbd>Ctrl D</kbd></li><li><span>선택 요소 삭제</span><kbd>Delete</kbd></li><li><span>0.5mm 이동</span><kbd>방향키</kbd></li><li><span>5mm 이동</span><kbd>Shift + 방향키</kbd></li><li><span>글씨 바로 편집</span><kbd>더블클릭</kbd></li></ul></div></div><button type="button" class="design-top-command primary" data-design-command="output" title="출력·인쇄 검사 열기">${ICONS.output}<span class="design-command-text">출력</span></button>`;
  }

  function bindCommands(root){
    root.querySelector('[data-design-command="undo"]')?.addEventListener('click',()=>runHistory('undo'));
    root.querySelector('[data-design-command="redo"]')?.addEventListener('click',()=>runHistory('redo'));
    root.querySelector('[data-design-command="insert"]')?.addEventListener('click',event=>togglePopover(INSERT_POPOVER_ID,event.currentTarget));
    root.querySelector('[data-design-command="panel"]')?.addEventListener('click',togglePanel);
    root.querySelector('[data-design-command="fit"]')?.addEventListener('click',fitView);
    root.querySelector('[data-design-command="help"]')?.addEventListener('click',event=>togglePopover(HELP_POPOVER_ID,event.currentTarget));
    root.querySelector('[data-design-command="output"]')?.addEventListener('click',openOutput);
    root.querySelectorAll('[data-design-insert]').forEach(button=>button.addEventListener('click',()=>runInsert(button.dataset.designInsert)));
  }

  function ensureSurfaceGroup(toolbar,productRoot){
    const tabs=byId('surfaceTabs')||toolbar.querySelector('.surface-tabs');if(!tabs)return null;
    let group=byId(SURFACE_GROUP_ID);
    if(!group){
      group=document.createElement('div');group.id=SURFACE_GROUP_ID;group.setAttribute('aria-label','현재 작업 면');
      group.innerHTML='<span class="design-surface-topbar-label">면</span>';
      productRoot.insertAdjacentElement('afterend',group);
    }
    if(tabs.parentElement!==group)group.appendChild(tabs);
    return group;
  }

  function ensureCommandBar(toolbar,surfaceGroup){
    let root=byId(COMMAND_BAR_ID);
    if(!root){
      root=document.createElement('div');root.id=COMMAND_BAR_ID;root.setAttribute('role','toolbar');root.setAttribute('aria-label','디자인 빠른 작업');root.innerHTML=commandMarkup();bindCommands(root);
    }
    if(root.parentElement!==toolbar){
      if(surfaceGroup)surfaceGroup.insertAdjacentElement('afterend',root);else toolbar.appendChild(root);
    }
    return root;
  }

  function syncCommands(){
    const root=byId(COMMAND_BAR_ID);if(!root)return;
    const undoSource=byId('phase3Undo'),redoSource=byId('phase3Redo');
    const undo=root.querySelector('[data-design-command="undo"]'),redo=root.querySelector('[data-design-command="redo"]');
    if(undo)undo.disabled=undoSource?undoSource.disabled:!window.DesignEditorPhase3Controls?.undo;
    if(redo)redo.disabled=redoSource?redoSource.disabled:!window.DesignEditorPhase3Controls?.redo;
    const panel=root.querySelector('[data-design-command="panel"]');
    if(panel){
      const collapsed=document.documentElement.classList.contains('ps-sidebar-collapsed');
      panel.setAttribute('aria-pressed',String(collapsed));
      panel.setAttribute('aria-label',collapsed?'작업 패널 펼치기':'작업 패널 접기');
      panel.title=collapsed?'작업 패널 펼치기':'작업 패널 접기';
    }
  }

  function selectionKey(){
    const text=document.querySelector('.design-text.selected');if(text)return`text:${text.dataset.id||''}`;
    const extra=document.querySelector('.phase2-extra-object.selected');if(extra)return`extra:${extra.dataset.extraId||''}`;
    return'';
  }

  function syncSelectionContext(){
    const next=selectionKey();
    if(next&&next!==lastSelectionKey){
      const step=window.ProgramStudioEditorToolRail?.activeStep||'';
      if(step!=='edit'&&step!=='arrange')routeStep('edit');
    }
    lastSelectionKey=next;
  }

  function mountSelectionObserver(){
    const artboard=byId('artboard');if(!artboard||selectionObserver)return;
    selectionObserver=new MutationObserver(()=>setTimeout(syncSelectionContext,20));
    selectionObserver.observe(artboard,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
  }

  function bindOutside(){
    if(outsideBound)return;outsideBound=true;
    document.addEventListener('pointerdown',event=>{
      if(event.target?.closest?.(`#${COMMAND_BAR_ID}`))return;
      closePopovers();
    },true);
    document.addEventListener('click',()=>setTimeout(syncSelectionContext,25),false);
    document.addEventListener('keydown',event=>{
      if(event.key==='Escape')closePopovers();
      if(isEditableTarget(event.target))return;
      if((event.ctrlKey||event.metaKey)&&event.key==='0'){
        event.preventDefault();fitView();
      }
    },true);
  }

  function mount(){
    installStyles();
    const toolbar=document.querySelector('.editor-toolbar');
    if(!toolbar)return false;
    let root=byId(TOPBAR_ID);
    if(root&&root.parentElement!==toolbar){root.remove();root=null;}
    if(!root){
      root=document.createElement('nav');
      root.id=TOPBAR_ID;
      root.setAttribute('aria-label','디자인 작업 종류');
      root.innerHTML=`<span class="design-product-topbar-label">종류</span><div class="design-product-topbar-tabs">${PRODUCTS.map(([key,label])=>`<button type="button" class="design-product-topbar-btn" data-print-product-top="${key}" aria-pressed="false">${label}</button>`).join('')}</div>`;
      root.querySelectorAll('[data-print-product-top]').forEach(button=>button.addEventListener('click',()=>activateProduct(button.dataset.printProductTop)));
      const tabs=byId('surfaceTabs')||toolbar.querySelector('.surface-tabs');
      toolbar.insertBefore(root,tabs||toolbar.firstChild);
    }
    const surfaceGroup=ensureSurfaceGroup(toolbar,root);
    ensureCommandBar(toolbar,surfaceGroup);
    toolbar.dataset.designCommandbar='v2';
    syncButtons();syncCommands();mountSelectionObserver();bindOutside();
    return true;
  }

  function sync(){
    clearTimeout(timer);
    window.DesignEditorPrintProductMenu?.render?.();
    const mounted=mount();
    keepSettingsVisible();
    syncButtons();syncCommands();syncSelectionContext();
    if(!mounted)queue(100);
    return mounted;
  }

  function queue(delay=50){
    clearTimeout(timer);
    timer=setTimeout(sync,delay);
  }

  function connect(){
    sync();
    if(!observer&&typeof MutationObserver==='function'){
      observer=new MutationObserver(records=>{
        const relevant=records.some(record=>[...record.addedNodes].some(node=>
          node?.id==='designEmbeddedModeCard'||node?.id==='surfaceTabs'||node?.classList?.contains?.('editor-toolbar')||node?.querySelector?.('#designEmbeddedModeCard,.editor-toolbar,#surfaceTabs')
        ));
        if(relevant)queue(40);
      });
      observer.observe(document.documentElement,{childList:true,subtree:true});
    }
    if(!stateObserver&&typeof MutationObserver==='function'){
      stateObserver=new MutationObserver(()=>{syncButtons();keepSettingsVisible();syncCommands();});
      stateObserver.observe(document.documentElement,{attributes:true,attributeFilter:['data-print-product-menu','class']});
    }
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',connect,{once:true});
  else connect();
  [120,300,700,1400,2600].forEach(delay=>setTimeout(sync,delay));

  window.DesignEditorPrintProductTopbar={
    sync,mount,activateProduct,runInsert,fitView,openOutput,togglePanel,
    stage:'professional-design-commandbar-v2',legacyStage:'fixed-print-product-topbar-v1'
  };
})();
