// PDF배치: uploaded page thumbnails in one independent right sidebar.
// IDs and existing thumbnail model remain untouched (select/reorder/file actions).
(function(){
  'use strict';
  if(window.__pdfEditorRightPageSidebarV1)return;
  window.__pdfEditorRightPageSidebarV1=true;
  const STORAGE_WIDTH='program-studio:pdf-editor:right-pages-width-v1';
  const MIN_WIDTH=240,MAX_WIDTH=420;
  const breakpoint=1180;
  function init(){
    const app=document.getElementById('pdfEditorApp');
    const sidebar=document.getElementById('pageSidebar');
    const section=document.getElementById('thumbSection');
    const toggle=document.getElementById('pageSidebarToggle');
    const close=document.getElementById('pageSidebarClose');
    const grip=document.getElementById('pageSidebarResize');
    const backdrop=document.getElementById('pageSidebarBackdrop');
    const empty=document.getElementById('pageSidebarEmpty');
    if(!app||!sidebar||!section||!toggle||!close||!grip||!backdrop||!empty)return;
    let open=false,hadPages=false,manuallyClosed=false;
    let drag=null;
    const wide=()=>window.innerWidth>breakpoint;
    const maxWidth=()=>Math.min(MAX_WIDTH,Math.max(MIN_WIDTH,window.innerWidth-360-480));
    const clampWidth=v=>Math.max(MIN_WIDTH,Math.min(maxWidth(),Number(v)||300));
    let width=300;
    try{width=clampWidth(Number(localStorage.getItem(STORAGE_WIDTH))||300);}catch(_){width=clampWidth(width);}
    function applyWidth(next,save=false){
      width=clampWidth(next);
      app.style.setProperty('--page-sidebar-width',width+'px');
      grip.setAttribute('aria-valuenow',String(Math.round(width)));
      if(save){try{localStorage.setItem(STORAGE_WIDTH,String(Math.round(width)));}catch(_){ }}
    }
    function syncBackdrop(){
      backdrop.hidden=!open||wide();
    }
    function setOpen(next,userAction=false){
      open=!!next;
      if(userAction)manuallyClosed=!open;
      app.classList.toggle('page-sidebar-open',open);
      sidebar.setAttribute('aria-hidden',open?'false':'true');
      // Closed thumbnail widgets must not remain keyboard-focusable.
      sidebar.inert=!open;
      toggle.setAttribute('aria-expanded',open?'true':'false');
      toggle.setAttribute('title',open?'오른쪽 페이지 목록 닫기':'오른쪽 페이지 목록 열기');
      syncBackdrop();
      if(!open&&sidebar.contains(document.activeElement))toggle.focus();
    }
    function hasPages(){
      return !section.hidden&&section.style.display!=='none';
    }
    function syncPageState(){
      const pages=hasPages();
      empty.hidden=pages;
      toggle.textContent=pages?'☷ 페이지 목록':'☷ 페이지';
      // Auto-open only when the first uploaded file appears on a wide screen.
      // For phones and compact desktops, never cover the preview unexpectedly.
      if(pages&&!hadPages&&!manuallyClosed&&wide())setOpen(true);
      if(!pages&&hadPages){manuallyClosed=false;setOpen(false);}
      hadPages=pages;
    }
    toggle.addEventListener('click',()=>setOpen(!open,true));
    close.addEventListener('click',()=>setOpen(false,true));
    backdrop.addEventListener('click',()=>setOpen(false,true));
    document.addEventListener('keydown',event=>{
      if(event.key==='Escape'&&open){
        setOpen(false,true);
      }
    });
    grip.addEventListener('pointerdown',event=>{
      if(!wide()||event.button!==0)return;
      event.preventDefault();
      drag={x:event.clientX,width};
      grip.setPointerCapture?.(event.pointerId);
      document.body.style.cursor='col-resize';
      document.body.style.userSelect='none';
    });
    grip.addEventListener('pointermove',event=>{
      if(!drag)return;
      applyWidth(drag.width+drag.x-event.clientX);
    });
    function endDrag(){
      if(!drag)return;
      drag=null;document.body.style.cursor='';document.body.style.userSelect='';
      applyWidth(width,true);
    }
    grip.addEventListener('pointerup',endDrag);
    grip.addEventListener('pointercancel',endDrag);
    grip.addEventListener('lostpointercapture',endDrag);
    grip.addEventListener('keydown',event=>{
      if(!wide()||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
      event.preventDefault();
      const next=event.key==='Home'?MIN_WIDTH:event.key==='End'?maxWidth():
        width+(event.key==='ArrowLeft'?12:-12);
      applyWidth(next,true);
    });
    window.addEventListener('resize',()=>{
      applyWidth(width);
      syncBackdrop();
    });
    // Existing upload, import, reset and saved-session restore flows update
    // thumbSection's inline display. Observe that single source of truth.
    new MutationObserver(syncPageState).observe(section,{attributes:true,attributeFilter:['style','hidden']});
    applyWidth(width);
    setOpen(false);
    syncPageState();
    window.PdfEditorRightPageSidebar={
      get open(){return open;},get width(){return width;},
      show(){setOpen(true,true);},hide(){setOpen(false,true);},
      sync:syncPageState,version:'2026-11-06'
    };
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();