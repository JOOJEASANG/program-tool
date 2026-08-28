// Fixed top product switcher for the embedded design editor.
// Reuses the existing print-product menu buttons so mode switching stays in one implementation.
(function(){
  'use strict';
  if(window.__designEditorPrintProductTopbarV1)return;
  window.__designEditorPrintProductTopbarV1=true;

  const params=new URLSearchParams(location.search);
  if(params.get('embed')!=='1')return;

  const TOPBAR_ID='designPrintProductTopbar';
  const STYLE_ID='designPrintProductTopbarStyles';
  const PRODUCTS=[
    ['cover','표지'],['poster','포스터'],['flyer','전단'],['invitation','초대장·안내장'],['leaflet','리플렛']
  ];
  const PRODUCT_KEYS=new Set(PRODUCTS.map(([key])=>key));
  let timer=0;
  let observer=null;
  let stateObserver=null;

  const byId=id=>document.getElementById(id);
  const sourceCard=()=>byId('designEmbeddedModeCard');

  function installStyles(){
    if(byId(STYLE_ID))return;
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      .editor-toolbar{position:sticky!important;top:0!important;z-index:74!important;box-shadow:0 3px 12px rgba(15,39,72,.06)}
      #${TOPBAR_ID}{display:flex;align-items:center;gap:7px;min-width:0;flex:0 1 auto}
      #${TOPBAR_ID} .design-product-topbar-label{flex:0 0 auto;font-size:8px;font-weight:950;color:#64748b;white-space:nowrap}
      #${TOPBAR_ID} .design-product-topbar-tabs{display:flex;align-items:center;gap:4px;min-width:0;overflow-x:auto;overflow-y:hidden;scrollbar-width:none;padding:2px}
      #${TOPBAR_ID} .design-product-topbar-tabs::-webkit-scrollbar{display:none}
      #${TOPBAR_ID} .design-product-topbar-btn{flex:0 0 auto;height:30px;border:1px solid #d6e0e9;border-radius:8px;background:#fff;color:#526174;padding:0 10px;font-size:8px;font-weight:900;cursor:pointer;white-space:nowrap;transition:.14s ease}
      #${TOPBAR_ID} .design-product-topbar-btn:hover{border-color:#9ebbd6;background:#f6faff;color:#173b66}
      #${TOPBAR_ID} .design-product-topbar-btn.on{border-color:#12396d;background:#12396d;color:#fff;box-shadow:0 2px 7px rgba(18,57,109,.16)}
      #${TOPBAR_ID} .design-product-topbar-btn:focus-visible{outline:2px solid #1d9bb2;outline-offset:2px}
      #designEmbeddedModeCard[data-product-selection-top="1"] .design-mode-grid{display:none!important}
      #designEmbeddedModeCard[data-product-selection-top="1"] .design-mode-head{margin-bottom:7px}
      #designEmbeddedModeCard[data-product-selection-top="1"] .design-mode-title{font-size:10px}
      #designEmbeddedModeCard[data-product-selection-top="1"] .design-mode-sub{font-size:6.8px;line-height:1.35}
      @media(max-width:1100px){
        #${TOPBAR_ID} .design-product-topbar-label{display:none}
        #${TOPBAR_ID} .design-product-topbar-btn{padding:0 8px}
      }
      @media(max-width:760px){
        .editor-toolbar{height:auto!important;min-height:50px!important;flex:0 0 auto!important;flex-wrap:wrap!important;padding:7px 8px!important}
        #${TOPBAR_ID}{order:-20;width:100%;max-width:100%}
        #${TOPBAR_ID} .design-product-topbar-tabs{width:100%;padding-bottom:3px}
        #${TOPBAR_ID} .design-product-topbar-btn{height:31px;padding:0 9px;font-size:8px}
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
      root.innerHTML=`<span class="design-product-topbar-label">작업 종류</span><div class="design-product-topbar-tabs">${PRODUCTS.map(([key,label])=>`<button type="button" class="design-product-topbar-btn" data-print-product-top="${key}" aria-pressed="false">${label}</button>`).join('')}</div>`;
      root.querySelectorAll('[data-print-product-top]').forEach(button=>button.addEventListener('click',()=>activateProduct(button.dataset.printProductTop)));
      const surfaceTabs=byId('surfaceTabs')||toolbar.querySelector('.surface-tabs');
      toolbar.insertBefore(root,surfaceTabs||toolbar.firstChild);
    }
    syncButtons();
    return true;
  }

  function sync(){
    clearTimeout(timer);
    window.DesignEditorPrintProductMenu?.render?.();
    const mounted=mount();
    keepSettingsVisible();
    syncButtons();
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
          node?.id==='designEmbeddedModeCard'||node?.id==='surfaceTabs'||node?.classList?.contains?.('editor-toolbar')||node?.querySelector?.('#designEmbeddedModeCard,.editor-toolbar')
        ));
        if(relevant)queue(40);
      });
      observer.observe(document.documentElement,{childList:true,subtree:true});
    }
    if(!stateObserver&&typeof MutationObserver==='function'){
      stateObserver=new MutationObserver(()=>{syncButtons();keepSettingsVisible();});
      stateObserver.observe(document.documentElement,{attributes:true,attributeFilter:['data-print-product-menu']});
    }
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',connect,{once:true});
  else connect();
  [120,300,700,1400,2600].forEach(delay=>setTimeout(sync,delay));

  window.DesignEditorPrintProductTopbar={sync,mount,activateProduct,stage:'fixed-print-product-topbar-v1'};
})();
