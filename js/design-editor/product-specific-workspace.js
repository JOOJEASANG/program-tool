// Standalone product workspace: expose only the document controls that belong to the current print product.
(function(){
  'use strict';
  if(window.__designEditorProductSpecificWorkspaceV1)return;
  window.__designEditorProductSpecificWorkspaceV1=true;

  const params=new URLSearchParams(location.search);
  const raw=(params.get('app')||'').trim().toLowerCase();
  const app=raw==='notice'?'invitation':raw;
  if(!['cover','poster','flyer','invitation','leaflet'].includes(app))return;

  const STYLE_ID='designProductSpecificWorkspaceStylesV1';
  const COPY=Object.freeze({
    cover:Object.freeze({title:'표지 디자인',sub:'완성 규격·도련·책등을 설정합니다.',section:'표지 규격 · 책등',hideModeOptions:true}),
    poster:Object.freeze({title:'포스터 디자인',sub:'단면 용지 규격과 방향만 설정합니다.',section:'포스터 규격',hideModeOptions:false}),
    flyer:Object.freeze({title:'전단지 디자인',sub:'단면 용지 규격과 방향만 설정합니다.',section:'전단지 규격',hideModeOptions:false}),
    invitation:Object.freeze({title:params.get('surface')==='notice'?'안내장 디자인':'초대장 · 안내장',sub:'용지 규격과 접지 방향·위치를 설정합니다.',section:'초대장 · 안내장 규격 · 접지',hideModeOptions:false}),
    leaflet:Object.freeze({title:'리플렛 디자인',sub:'페이지 수·접지 방식·용지 규격을 설정합니다.',section:'리플렛 규격 · 접지',hideModeOptions:false})
  });
  const config=COPY[app];
  let observer=null;
  let frame=0;

  const byId=id=>document.getElementById(id);
  const setText=(node,value)=>{if(node&&node.textContent!==value)node.textContent=value;};

  function installStyles(){
    if(byId(STYLE_ID))return;
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      html[data-design-product-workspace] #designEmbeddedModeCard .design-mode-grid{display:none!important}
      html[data-design-product-workspace] #designEmbeddedModeCard .design-product-boundary-badge{display:none!important}
      html[data-design-product-workspace] #designEmbeddedModeCard{padding:11px!important}
      html[data-design-product-workspace] #designEmbeddedModeCard .design-mode-head{margin-bottom:0!important}
      html[data-design-product-workspace] #designEmbeddedModeCard .design-mode-home{width:28px;height:28px;flex:0 0 28px}
      html[data-design-product-workspace] #designEmbeddedModeCard .design-mode-title{font-size:11px!important;line-height:1.25}
      html[data-design-product-workspace] #designEmbeddedModeCard .design-mode-sub{font-size:7px!important;line-height:1.45;margin-top:3px}
      html[data-design-product-workspace] #designEmbeddedModeCard .design-mode-options{margin-top:9px!important;padding-top:9px!important}
      html[data-design-product-workspace="cover"] #designEmbeddedModeCard .design-mode-options{display:none!important}
      html[data-design-product-workspace] #designEmbeddedModeCard .design-product-note,
      html[data-design-product-workspace] #designEmbeddedModeCard .design-mode-note{margin-top:0!important}
      html[data-design-product-workspace] #designEmbeddedModeCard [data-product-workspace-label]{display:block;margin:0 0 7px;color:#334155;font-size:9px;font-weight:950}
      html[data-design-product-workspace] #designEmbeddedModeCard [data-print-product]{display:none!important}
    `;
    document.head.appendChild(style);
  }

  function syncIdentity(){
    document.documentElement.dataset.designProductWorkspace=app;
    const card=byId('designEmbeddedModeCard');
    if(!card)return false;
    card.dataset.productWorkspace=app;
    const title=card.querySelector('.design-mode-title');
    const sub=card.querySelector('.design-mode-sub');
    const grid=card.querySelector('.design-mode-grid');
    const options=card.querySelector('.design-mode-options');
    setText(title,config.title);
    setText(sub,config.sub);
    if(grid){grid.hidden=true;grid.setAttribute('aria-hidden','true');}
    if(options){
      options.hidden=Boolean(config.hideModeOptions);
      options.setAttribute('aria-label',config.section);
      if(!config.hideModeOptions){
        let label=options.querySelector('[data-product-workspace-label]');
        if(!label){label=document.createElement('div');label.dataset.productWorkspaceLabel='1';options.prepend(label);}
        setText(label,config.section);
      }
    }
    return true;
  }

  function syncCover(){
    if(app!=='cover')return true;
    const card=byId('designCoverSettingsTools');
    if(!card)return false;
    setText(card.querySelector('.side-label'),'표지 규격 · 책등');
    return true;
  }

  function syncDocumentCard(){
    const title=byId('documentTitle');
    const button=byId('newDesignBtn');
    if(title&&!String(title.textContent||'').trim())setText(title,config.title);
    if(button){
      setText(button,'규격 변경');
      button.title='현재 프로그램의 문서 규격을 변경합니다.';
    }
  }

  function sync(){
    installStyles();
    syncIdentity();
    syncCover();
    syncDocumentCard();
    return true;
  }

  function queue(){
    if(frame)return;
    frame=requestAnimationFrame(()=>{frame=0;sync();});
  }

  function boot(){
    document.documentElement.dataset.designProductWorkspace=app;
    installStyles();sync();
    if(!observer&&typeof MutationObserver==='function'){
      observer=new MutationObserver(queue);
      observer.observe(document.body,{childList:true,subtree:true});
    }
    ['programstudio:design-mode-change','programstudio:design-product-change','programstudio:document-type-change','click','change'].forEach(name=>document.addEventListener(name,queue,false));
    [100,240,520,1000,1800,3000].forEach(delay=>setTimeout(queue,delay));
  }

  window.DesignEditorProductSpecificWorkspace={sync,product:app,stage:'standalone-product-specific-workspace-v1'};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
