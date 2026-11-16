// PDF배치: uploaded page thumbnails in one independent right sidebar.
// IDs and existing thumbnail model remain untouched (select/reorder/file actions).
(function(){
  'use strict';
  if(window.__pdfEditorRightPageSidebarV1)return;
  window.__pdfEditorRightPageSidebarV1=true;
  const STORAGE_WIDTH='program-studio:pdf-editor:right-pages-width-v2';
  const LEGACY_STORAGE_WIDTH='program-studio:pdf-editor:right-pages-width-v1';
  const DEFAULT_WIDTH=360,MIN_WIDTH=280,MAX_WIDTH=480;
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
    // Keep one high-contrast disclosure style for the PDF page list.
    if(!document.getElementById('pdfRightSidebarUxStylesV2')){
      const style=document.createElement('style');
      style.id='pdfRightSidebarUxStylesV2';
      style.textContent="\n#pdfEditorApp #pageSidebarToggle{\n  display:inline-flex!important;align-items:center!important;justify-content:center!important;\n  flex:0 0 auto!important;min-width:133px!important;min-height:40px!important;\n  padding:8px 12px!important;border:1px solid #12487f!important;border-radius:10px!important;\n  background:#174b85!important;color:#fff!important;\n  font:900 12px/1.2 Pretendard,\"Noto Sans KR\",sans-serif!important;\n  letter-spacing:0!important;box-shadow:0 3px 9px rgba(15,57,103,.18)!important;\n  white-space:nowrap!important;cursor:pointer!important}\n#pdfEditorApp #pageSidebarToggle[aria-expanded=\"true\"]{\n  background:#e8f2ff!important;color:#15477f!important;border-color:#6ea1dd!important;\n  box-shadow:inset 0 0 0 1px rgba(39,111,203,.12)!important}\n#pdfEditorApp #pageSidebarToggle:hover{filter:brightness(1.08)!important}\n#pdfEditorApp #pageSidebarToggle:focus-visible,#pageSidebar #pageSidebarClose:focus-visible,\n#pageSidebar #pageSidebarResize:focus-visible{outline:3px solid #2563eb!important;outline-offset:2px!important}\n#pageSidebar #pageSidebarClose{\n  flex:0 0 40px!important;width:40px!important;min-width:40px!important;\n  height:40px!important;min-height:40px!important;border-radius:10px!important;\n  border:1px solid #bed0e4!important;background:#fff!important;\n  color:#213c5e!important;font-size:24px!important;line-height:1!important;cursor:pointer!important}\n#pageSidebar #pageSidebarClose:hover{background:#e8f2ff!important;border-color:#7ea9dd!important}\n#pageSidebar .page-sidebar-heading{font-size:15px!important;font-weight:900!important;color:#173252!important}\n#pageSidebar #pageSidebarResize{width:14px!important;background:rgba(220,232,245,.48);border-left:1px solid #cbd9e8!important}\n#pageSidebar #pageSidebarResize::after{\n  content:'';position:absolute;top:50%;left:4px;width:5px;height:40px;\n  border-radius:5px;background:repeating-linear-gradient(to bottom,#7594b5 0 3px,transparent 3px 7px);\n  transform:translateY(-50%);pointer-events:none}\n#pageSidebar #pageSidebarResize:hover{background:#dbeafe!important}\n@media(max-width:1450px){\n  #pdfEditorApp .preview-info{flex-wrap:wrap!important;gap:7px!important}\n  #pdfEditorApp .preview-info>.preview-zoom{\n    flex:1 1 100%!important;width:100%!important;min-width:0!important;max-width:100%!important;\n    overflow-x:auto!important;overflow-y:visible!important;justify-content:flex-start!important;\n    scrollbar-width:thin!important;padding-bottom:3px!important}\n}\n@media(max-width:1180px){\n  body[data-program-shell=\"compact\"] #pageSidebar{top:0!important}\n  body[data-program-shell=\"compact\"] #pageSidebarBackdrop:not([hidden]){inset:0!important}\n}\n@media(prefers-reduced-motion:reduce){#pdfEditorApp #pageSidebarToggle{transition:none!important}}\n";
      document.head.appendChild(style);
    }
    let open=false,hadPages=false,manuallyClosed=false;
    let drag=null;
    const wide=()=>window.innerWidth>breakpoint;
    const maxWidth=()=>Math.min(MAX_WIDTH,Math.max(MIN_WIDTH,window.innerWidth-360-480));
    const clampWidth=v=>Math.max(MIN_WIDTH,Math.min(maxWidth(),Number(v)||DEFAULT_WIDTH));
    let width=DEFAULT_WIDTH;
    try{
      const saved=Number(localStorage.getItem(STORAGE_WIDTH));
      const legacy=Number(localStorage.getItem(LEGACY_STORAGE_WIDTH));
      // Upgrade 300px defaults to 360px while preserving deliberately wider
      // per-user settings (including a custom width stored before this release).
      width=clampWidth(saved>0?saved:Math.max(DEFAULT_WIDTH,legacy||0));
    }catch(_){width=clampWidth(width);}
    function applyWidth(next,save=false){
      width=clampWidth(next);
      app.style.setProperty('--page-sidebar-width',width+'px');
      grip.setAttribute('aria-valuenow',String(Math.round(width)));
      if(save){try{localStorage.setItem(STORAGE_WIDTH,String(Math.round(width)));}catch(_){ }}
    }
    function syncBackdrop(){
      backdrop.hidden=!open||wide();
    }
    function updateToggleLabel(){
      const action=open?'접기':'펼치기';
      const label='페이지 목록 '+action;
      toggle.textContent='☷ '+label;
      toggle.setAttribute('aria-label',label);
      toggle.setAttribute('title',label);
    }
    function setOpen(next,userAction=false){
      const restoreFocus=!next&&sidebar.contains(document.activeElement);
      open=!!next;
      if(userAction)manuallyClosed=!open;
      app.classList.toggle('page-sidebar-open',open);
      sidebar.setAttribute('aria-hidden',open?'false':'true');
      // Closed thumbnail widgets must not remain keyboard-focusable.
      sidebar.inert=!open;
      toggle.setAttribute('aria-expanded',open?'true':'false');
      updateToggleLabel();
      syncBackdrop();
      if(restoreFocus)toggle.focus();
      else if(open&&userAction&&!wide())close.focus();
    }
    function hasPages(){
      return !section.hidden&&section.style.display!=='none';
    }
    function syncPageState(){
      const pages=hasPages();
      empty.hidden=pages;
      updateToggleLabel();
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
      sync:syncPageState,version:'2026-11-16'
    };
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();