// Advanced editor interaction polish: persistent erase mode, session actions,
// compact top navigation and slightly roomier crop/action spacing.
(function(){
  'use strict';
  if(window.__pdfAdvancedEditPersistencePolishV1)return;

  const root=document.documentElement;
  let advanced=false;
  try{advanced=root.dataset.pdfEditorProfile==='advanced'||new URLSearchParams(String(location.search||'')).get('profile')==='advanced';}catch(_){advanced=root.dataset.pdfEditorProfile==='advanced';}
  advanced=advanced||String(location.pathname||'').replace(/\/+$/,'').endsWith('/pdf-editor-advanced');
  if(!advanced)return;
  window.__pdfAdvancedEditPersistencePolishV1=true;

  const INSTALL_DELAYS=[0,80,180,360,700,1200,2200,4000];
  const byId=id=>document.getElementById(id);
  let stickyErase=false;
  let stickyPageId='';
  let pendingPageId='';
  let activationToken=0;
  let previewObserver=null;
  let sidebarObserver=null;
  let syncFrame=0;

  function pages(){
    if(Array.isArray(window.parsedPages))return window.parsedPages;
    try{return typeof parsedPages!=='undefined'&&Array.isArray(parsedPages)?parsedPages:[];}catch(_){return[];}
  }

  function pageById(id){return pages().find(page=>String(page?.id)===String(id))||null;}

  function selectedPage(){
    const hit=document.querySelector('.pdf-nup-adjust-hit[data-selected="true"]');
    const id=String(hit?.dataset?.pageId||'');
    return id?pageById(id):null;
  }

  function eraseApi(){return window.PdfDragCropAutoFit||null;}
  function eraseActive(){try{return!!eraseApi()?.isActive?.();}catch(_){return false;}}

  function installStyles(){
    if(byId('pdfAdvancedEditPersistencePolishStylesV1'))return;
    const style=document.createElement('style');
    style.id='pdfAdvancedEditPersistencePolishStylesV1';
    style.textContent=`
      html[data-pdf-editor-profile="advanced"] #pdfDragCropAutoFitControlsV1{margin-top:10px!important}
      html[data-pdf-editor-profile="advanced"] #pdfAdvancedSidebarNavV1 .nav-back,
      html[data-pdf-editor-profile="advanced"] #pdfAdvancedSidebarNavV1 .nav-logout{
        width:30px!important;min-width:30px!important;height:30px!important;min-height:30px!important;
        padding:0!important;gap:0!important;font-size:0!important;line-height:0!important;
      }
      html[data-pdf-editor-profile="advanced"] #pdfAdvancedSidebarNavV1 .nav-back svg,
      html[data-pdf-editor-profile="advanced"] #pdfAdvancedSidebarNavV1 .nav-logout svg{
        width:14px!important;height:14px!important;display:block!important;margin:0!important;flex:0 0 auto!important;
      }
      html[data-pdf-editor-profile="advanced"] #pdfAdvancedSidebarNavV1 #navSessionBtn,
      html[data-pdf-editor-profile="advanced"] #pdfAdvancedSidebarNavV1 #navSessionLoadBtn{
        min-height:30px!important;padding:5px 8px!important;font-size:9px!important;white-space:nowrap!important;
      }
      html[data-pdf-editor-profile="advanced"][data-pdf-advanced-erase-sticky="true"] #pdfDragCropAutoFitV1[data-active="true"]{
        box-shadow:0 0 0 2px rgba(37,99,235,.16)!important;
      }
    `;
    document.head.appendChild(style);
  }

  function setTextNode(button,label){
    if(!button)return;
    const textNodes=[...button.childNodes].filter(node=>node.nodeType===3);
    if(textNodes.length){
      textNodes[0].nodeValue=` ${label}`;
      textNodes.slice(1).forEach(node=>node.remove());
    }else{
      button.appendChild(document.createTextNode(` ${label}`));
    }
    button.setAttribute('aria-label',label);
    button.title=label;
  }

  function currentUser(){
    try{return window.auth?.currentUser||null;}catch(_){return null;}
  }

  function syncSidebarActions(){
    const bar=byId('pdfAdvancedSidebarNavV1');
    if(!bar)return false;

    const back=bar.querySelector('.nav-back');
    if(back){back.setAttribute('aria-label','목록');back.title='목록';}
    const logout=byId('navLogout');
    if(logout){logout.setAttribute('aria-label','로그아웃');logout.title='로그아웃';}

    const save=byId('navSessionBtn');
    const load=byId('navSessionLoadBtn');
    setTextNode(save,'편집저장');
    setTextNode(load,'편집파일 불러오기');

    const user=currentUser();
    if(user){
      [save,load].filter(Boolean).forEach(button=>button.style.setProperty('display','inline-flex','important'));
      root.dataset.pdfAdvancedSessionActions='ready';
    }else{
      root.dataset.pdfAdvancedSessionActions='waiting-auth';
    }
    return true;
  }

  function setStickyErase(value,reason=''){
    stickyErase=!!value;
    if(!stickyErase){
      stickyPageId='';
      pendingPageId='';
      activationToken+=1;
    }
    root.dataset.pdfAdvancedEraseSticky=String(stickyErase);
    if(reason)root.dataset.pdfAdvancedEraseStickyReason=reason;
  }

  function syncStickyErase(){
    if(!stickyErase)return false;
    const api=eraseApi();
    const page=selectedPage();
    if(!api||typeof api.activate!=='function'||!page)return false;
    const pageId=String(page.id);

    if(pageId===stickyPageId&&eraseActive())return true;
    if(pageId===pendingPageId)return true;

    const token=++activationToken;
    pendingPageId=pageId;
    Promise.resolve(api.activate(page)).then(ok=>{
      if(token!==activationToken)return;
      pendingPageId='';
      if(ok!==false&&stickyErase){
        stickyPageId=pageId;
        root.dataset.pdfAdvancedEraseStickyPage=pageId;
        try{window.PdfDirectPageEdit?.refresh?.();}catch(_){}
      }
    }).catch(error=>{
      if(token!==activationToken)return;
      pendingPageId='';
      console.warn('[pdf-advanced-polish] persistent erase activation failed',error);
    });
    return true;
  }

  function queueSync(){
    if(syncFrame)return;
    syncFrame=requestAnimationFrame(()=>{
      syncFrame=0;
      installStyles();
      syncSidebarActions();
      syncStickyErase();
    });
  }

  function installObservers(){
    const preview=byId('previewScroll');
    if(preview&&previewObserver?.__target!==preview){
      previewObserver?.disconnect?.();
      previewObserver=new MutationObserver(()=>queueSync());
      previewObserver.__target=preview;
      previewObserver.observe(preview,{childList:true,subtree:true,attributes:true,attributeFilter:['data-selected','data-page-id','data-output-index']});
    }

    const aside=document.querySelector('.app>aside');
    if(aside&&sidebarObserver?.__target!==aside){
      sidebarObserver?.disconnect?.();
      sidebarObserver=new MutationObserver(()=>requestAnimationFrame(syncSidebarActions));
      sidebarObserver.__target=aside;
      sidebarObserver.observe(aside,{childList:true,subtree:true});
    }
  }

  function installEvents(){
    if(root.dataset.pdfAdvancedEditPersistenceEvents==='1')return;
    root.dataset.pdfAdvancedEditPersistenceEvents='1';

    document.addEventListener('click',event=>{
      const eraseButton=event.target?.closest?.('#pdfDragCropAutoFitV1');
      if(eraseButton){
        setStickyErase(!stickyErase,stickyErase?'user-off':'user-on');
        if(stickyErase)setTimeout(syncStickyErase,0);
        return;
      }

      if(stickyErase&&event.target?.closest?.('.pdf-nup-adjust-hit,#thumbArea .thumb-wrap,#pdfAdvancedPrevPageV1,#pdfAdvancedNextPageV1')){
        setTimeout(syncStickyErase,0);
        setTimeout(syncStickyErase,80);
      }
    },true);

    document.addEventListener('keydown',event=>{
      if(event.key==='Escape'&&stickyErase)setStickyErase(false,'escape');
    },true);

    document.addEventListener('pdf-import-committed',()=>{
      setStickyErase(false,'new-import');
      setTimeout(queueSync,0);
    });

    document.addEventListener('pdf-drag-erase-applied',()=>{
      if(stickyErase)setTimeout(syncStickyErase,0);
    });

    window.addEventListener('resize',queueSync,{passive:true});
  }

  function install(){
    installStyles();
    syncSidebarActions();
    installObservers();
    installEvents();
    if(stickyErase)syncStickyErase();
    root.dataset.pdfAdvancedEditPersistencePolish='1';
  }

  window.PdfAdvancedEditPersistencePolish={
    sync:install,
    isEraseSticky:()=>stickyErase,
    setEraseSticky:value=>{setStickyErase(value,'api');if(stickyErase)syncStickyErase();},
    stage:'advanced-edit-persistence-polish-v1',
  };

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();
  for(const delay of INSTALL_DELAYS)setTimeout(install,delay);
  setInterval(()=>{syncSidebarActions();if(stickyErase)syncStickyErase();},1400);
})();
