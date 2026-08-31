(function(){
  'use strict';
  if(window.__designEditorProductBoundaryUiV1)return;
  window.__designEditorProductBoundaryUiV1=true;
  const params=new URLSearchParams(location.search);
  const raw=(params.get('app')||'').trim().toLowerCase();
  const product=raw==='notice'?'invitation':raw;
  if(!['cover','poster','flyer','invitation','leaflet'].includes(product))return;
  document.documentElement.dataset.designProductBoundary=product;

  const LABELS={cover:'표지',poster:'포스터',flyer:'전단지',invitation:params.get('surface')==='notice'?'안내장':'초대장',leaflet:'리플렛'};
  let observer=null,timer=0;
  function apply(){
    clearTimeout(timer);
    const cards=document.querySelectorAll('#designEmbeddedModeCard,.design-mode-card');
    cards.forEach(card=>{
      card.dataset.standaloneProduct=product;
      const grid=card.querySelector('.design-mode-grid');
      if(grid)grid.style.display='none';
      let badge=card.querySelector('.design-product-boundary-badge');
      if(!badge){
        badge=document.createElement('div');badge.className='design-product-boundary-badge';
        const anchor=card.querySelector('.design-mode-options')||grid||card.firstElementChild;
        anchor?.parentNode?.insertBefore(badge,anchor||null);
      }
      if(badge)badge.textContent=`${LABELS[product]} 전용 작업`; 
    });
    document.querySelectorAll('[data-print-product]').forEach(button=>{
      button.hidden=button.dataset.printProduct!==product;
      button.tabIndex=button.dataset.printProduct===product?0:-1;
    });
    return true;
  }
  function installStyles(){
    if(document.getElementById('designProductBoundaryStylesV1'))return;
    const style=document.createElement('style');style.id='designProductBoundaryStylesV1';style.textContent=`
      html[data-design-product-boundary] .design-product-boundary-badge{display:flex;align-items:center;min-height:32px;margin:0 0 8px;padding:7px 9px;border:1px solid #d9e6f2;border-radius:9px;background:#f7fbff;color:#0b4f78;font-size:9px;font-weight:950}
      html[data-design-product-boundary] #designEmbeddedModeCard .design-mode-grid{display:none!important}
    `;document.head.appendChild(style);
  }
  function boot(){
    installStyles();apply();
    if(typeof MutationObserver==='function'){
      observer=new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(apply,30);});
      observer.observe(document.documentElement,{childList:true,subtree:true});
    }
  }
  document.addEventListener('click',event=>{
    const button=event.target?.closest?.('[data-print-product]');
    if(button&&button.dataset.printProduct!==product){event.preventDefault();event.stopImmediatePropagation();}
  },true);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  window.DesignEditorProductBoundaryUi={product,sync:apply,stage:'standalone-design-product-boundary-v1'};
})();
