(function(){
  'use strict';
  if(window.__designEditorProductBoundaryUiV1)return;
  window.__designEditorProductBoundaryUiV1=true;
  const params=new URLSearchParams(location.search);
  const raw=(params.get('app')||'').trim().toLowerCase();
  const registry=window.DesignEditorStandaloneProducts||null;
  const profile=registry?.fromLocation?.(location.search)||null;
  const product=profile?.runtimeProduct||(raw==='notice'?'invitation':raw);
  if(!['cover','poster','flyer','invitation','leaflet'].includes(product))return;
  document.documentElement.dataset.designProductBoundary=product;
  if(profile?.key)document.documentElement.dataset.designStandaloneProfile=profile.key;

  const fallbackLabel=raw==='notice'?'안내장':({cover:'표지',poster:'포스터',flyer:'전단지',invitation:'초대장',leaflet:'리플렛'}[product]||'디자인');
  const label=profile?.label||fallbackLabel;
  const badgeText=profile?.badge||`${label} 전용 작업`;
  let observer=null,timer=0,applying=false;
  const setText=(node,value)=>{if(node&&node.textContent!==value)node.textContent=value;};
  const setHidden=(node,value)=>{if(node&&node.hidden!==value)node.hidden=value;};
  const observe=()=>{
    if(!observer)return;
    observer.observe(document.documentElement,{childList:true,subtree:true});
  };
  function apply(){
    clearTimeout(timer);
    if(applying)return true;
    applying=true;
    observer?.disconnect();
    try{
      const cards=document.querySelectorAll('#designEmbeddedModeCard,.design-mode-card');
      cards.forEach(card=>{
        if(card.dataset.standaloneProduct!==product)card.dataset.standaloneProduct=product;
        if(profile?.key&&card.dataset.standaloneProfile!==profile.key)card.dataset.standaloneProfile=profile.key;
        const grid=card.querySelector('.design-mode-grid');
        if(grid&&grid.style.display!=='none')grid.style.display='none';
        let badge=card.querySelector('.design-product-boundary-badge');
        if(!badge){
          badge=document.createElement('div');badge.className='design-product-boundary-badge';
          const anchor=card.querySelector('.design-mode-options')||grid||card.firstElementChild;
          anchor?.parentNode?.insertBefore(badge,anchor||null);
        }
        setText(badge,badgeText);
      });
      document.querySelectorAll('[data-print-product]').forEach(button=>{
        const active=button.dataset.printProduct===product;
        setHidden(button,!active);
        if(button.tabIndex!==(active?0:-1))button.tabIndex=active?0:-1;
      });
      return true;
    }finally{
      applying=false;
      observe();
    }
  }
  function installStyles(){
    if(document.getElementById('designProductBoundaryStylesV1'))return;
    const style=document.createElement('style');style.id='designProductBoundaryStylesV1';style.textContent=`
      html[data-design-product-boundary] .design-product-boundary-badge{display:flex;align-items:center;min-height:32px;margin:0 0 8px;padding:7px 9px;border:1px solid #d9e6f2;border-radius:9px;background:#f7fbff;color:#0b4f78;font-size:9px;font-weight:950}
      html[data-design-product-boundary] #designEmbeddedModeCard .design-mode-grid{display:none!important}
    `;document.head.appendChild(style);
  }
  function boot(){
    installStyles();
    if(typeof MutationObserver==='function'){
      observer=new MutationObserver(()=>{if(applying)return;clearTimeout(timer);timer=setTimeout(apply,30);});
    }
    apply();
    observe();
  }
  document.addEventListener('click',event=>{
    const button=event.target?.closest?.('[data-print-product]');
    if(button&&button.dataset.printProduct!==product){event.preventDefault();event.stopImmediatePropagation();}
  },true);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  window.DesignEditorProductBoundaryUi={product,profile:profile?.key||raw,label,sync:apply,stage:'standalone-design-product-boundary-v3-stable'};
})();