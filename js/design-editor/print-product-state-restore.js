// Restore saved invitation/leaflet production settings before product geometry refreshes.
(function(){
  'use strict';
  if(window.__designEditorPrintProductStateRestoreV1)return;
  window.__designEditorPrintProductStateRestoreV1=true;

  let patched=false;
  let timer=0;
  const validPages=new Set([4,6,8,10,12]);
  const project=()=>window.DesignEditorApp?.project||null;

  function hydrate(p=project()){
    const menu=window.DesignEditorPrintProductMenu;
    if(!menu?.state||!p)return false;
    if(p.printProductMode==='invitation'){
      const data=menu.state.invitation;
      data.paper=p.paper||data.paper;
      data.orientation=p.orientation||data.orientation;
      data.width=Number(p.width)||data.width;
      data.height=Number(p.height)||data.height;
      data.axis=p.printProductAxis==='y'?'y':'x';
      data.position=Number(p.printProductFoldPosition)||data.position;
      data.flip=String(p.printFoldFlipPanel||data.flip||'none');
      return true;
    }
    if(p.printProductMode==='leaflet'){
      const data=menu.state.leaflet;
      data.paper=p.paper||data.paper;
      data.orientation=p.orientation||data.orientation;
      data.width=Number(p.width)||data.width;
      data.height=Number(p.height)||data.height;
      const pages=Number(p.printProductPages);
      if(validPages.has(pages))data.pages=pages;
      if(p.printProductFold)data.fold=String(p.printProductFold);
      return true;
    }
    return false;
  }

  function patch(){
    clearTimeout(timer);
    const menu=window.DesignEditorPrintProductMenu;
    if(!menu){timer=setTimeout(patch,100);return false;}
    if(!patched){
      patched=true;
      const originalApply=menu.applyGeometry?.bind(menu);
      const originalRender=menu.render?.bind(menu);
      if(originalApply)menu.applyGeometry=(p=project(),options={})=>{hydrate(p);return originalApply(p,options);};
      if(originalRender)menu.render=()=>{hydrate(project());return originalRender();};
    }
    hydrate(project());
    menu.render?.();
    document.documentElement.dataset.printProductStateRestore='1';
    return true;
  }

  window.addEventListener('resize',()=>{hydrate(project());},{passive:true});
  document.addEventListener('click',event=>{
    if(event.target?.closest?.('.surface-tab,[data-print-product],.design-product-apply'))setTimeout(()=>{hydrate(project());window.DesignEditorPrintProductMenu?.render?.();},100);
  },true);

  patch();
  [240,600,1200,2400,4200].forEach(delay=>setTimeout(patch,delay));
  window.DesignEditorPrintProductStateRestore={hydrate,patch,stage:'saved-print-product-fold-state-restore'};
})();
