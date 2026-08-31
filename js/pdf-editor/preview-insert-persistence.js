// Keeps blank-page/divider insertion controls available across multi-file preview rerenders.
(function(){
  'use strict';
  if(window.__pdfPreviewInsertPersistenceV1)return;
  window.__pdfPreviewInsertPersistenceV1=true;

  const path=(location.pathname||'/').replace(/\/+$/,'')||'/';
  if(path!=='/pdf-editor'&&path!=='/pdf-editor/index.html'&&!path.endsWith('/pdf-editor/index.html'))return;

  let observer=null;
  let frame=0;
  let repairing=false;

  function installStyles(){
    if(document.getElementById('pdfPreviewInsertPersistenceStylesV1'))return;
    const style=document.createElement('style');
    style.id='pdfPreviewInsertPersistenceStylesV1';
    style.textContent=`
      #previewScroll .prev-ins-zone.pdf-preview-boundary-insert{opacity:.48!important}
      #previewScroll .prev-ins-zone.pdf-preview-boundary-insert:hover{opacity:1!important}
      #previewScroll .prev-ins-zone-v.pdf-preview-inline-insert{opacity:.36!important}
      #previewScroll .prev-ins-zone-v.pdf-preview-inline-insert:hover{opacity:1!important}
      #previewScroll .pdf-fast-insert-actions.pdf-preview-fast-fallback{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:6px;margin:12px auto 0;padding:10px 12px;max-width:470px;border:1px solid #dbe4ee;border-radius:10px;background:#fff;box-shadow:0 3px 12px rgba(15,23,42,.05)}
      #previewScroll .pdf-fast-insert-actions.pdf-preview-fast-fallback .prev-ins-btn{position:static!important;opacity:1!important;visibility:visible!important;pointer-events:auto!important;transform:none!important;min-height:32px;padding:6px 11px;border:1px solid #bfdbfe;border-radius:8px;background:#eff6ff;color:#1d4ed8;font-family:inherit;font-size:10px;font-weight:900;cursor:pointer}
      #previewScroll .pdf-fast-insert-actions.pdf-preview-fast-fallback .prev-ins-btn.divider{border-color:#ddd6fe;background:#f5f3ff;color:#6d28d9}
      #previewScroll .pdf-preview-fast-note{flex:1 0 100%;margin-top:1px;color:#64748b;font-size:9px;font-weight:700;line-height:1.45;text-align:center}
    `;
    document.head.appendChild(style);
  }

  function markHorizontal(zone,index){
    if(!zone)return null;
    zone.classList.add('pdf-preview-boundary-insert');
    zone.dataset.pdfInsertBoundary=String(index);
    return zone;
  }

  function makeHorizontal(index){
    try{
      if(typeof makePreviewInsertZone!=='function')return null;
      return markHorizontal(makePreviewInsertZone(index),index);
    }catch(error){
      console.warn('[pdf-preview-insert] boundary creation failed',error);
      return null;
    }
  }

  function ensureNormalBoundaries(){
    const scroll=document.getElementById('previewScroll');
    if(!scroll||scroll.querySelector('.empty-state'))return false;
    const rows=[...scroll.children].filter(node=>node.classList?.contains('preview-row'));
    if(!rows.length||typeof makePreviewInsertZone!=='function')return false;

    let rendered=0;
    const first=rows[0];
    let top=first.previousElementSibling;
    if(!top?.classList?.contains('prev-ins-zone')){
      top=makeHorizontal(0);
      if(top)first.before(top);
    }else markHorizontal(top,0);

    rows.forEach(row=>{
      row.querySelectorAll(':scope>.prev-ins-zone-v').forEach(zone=>zone.classList.add('pdf-preview-inline-insert'));
      rendered+=row.querySelectorAll(':scope>.page-preview').length;
      let next=row.nextElementSibling;
      if(!next?.classList?.contains('prev-ins-zone')){
        next=makeHorizontal(rendered);
        if(next)row.after(next);
      }else markHorizontal(next,rendered);
    });

    document.documentElement.dataset.pdfPreviewInsertPersistence='1';
    return true;
  }

  function refreshFastPageCount(){
    let count=0;
    try{count=Array.isArray(parsedPages)?parsedPages.length:0;}catch(_){}
    const pages=document.getElementById('previewPages');
    if(pages)pages.textContent=count?`총 ${count}페이지`:'';
  }

  function appendFastBlank(){
    try{
      if(!Array.isArray(parsedPages)||typeof makeBlankPage!=='function')return;
      parsedPages.splice(parsedPages.length,0,makeBlankPage());
      if(typeof renderThumbs==='function')renderThumbs();
      window.PdfUploadOptimization?.syncAggregateMode?.();
      refreshFastPageCount();
      if(typeof showStatus==='function')showStatus('문서 끝에 빈 페이지를 추가했습니다.','success');
    }catch(error){console.warn('[pdf-preview-insert] fast blank insertion failed',error);}
  }

  function openFastDivider(){
    try{
      if(!Array.isArray(parsedPages)||typeof window.openDividerInsert!=='function')return;
      window.openDividerInsert(parsedPages.length);
    }catch(error){console.warn('[pdf-preview-insert] fast divider insertion failed',error);}
  }

  function ensureFastFallback(){
    const scroll=document.getElementById('previewScroll');
    const empty=scroll?.querySelector('.empty-state');
    if(!scroll||!empty||!window.__pdfEditorFastMode)return false;
    if(scroll.querySelector('#pdfFastInsertActionsV1'))return true;

    const actions=document.createElement('div');
    actions.id='pdfFastInsertActionsV1';
    actions.className='prev-ins-btns pdf-fast-insert-actions pdf-preview-fast-fallback';
    actions.setAttribute('aria-label','대용량 문서 페이지 삽입');

    const blank=document.createElement('button');
    blank.type='button';blank.className='prev-ins-btn';blank.textContent='+ 빈 페이지';
    blank.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();appendFastBlank();});

    const divider=document.createElement('button');
    divider.type='button';divider.className='prev-ins-btn divider';divider.textContent='+ 간지';
    divider.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();openFastDivider();});

    const note=document.createElement('div');
    note.className='pdf-preview-fast-note';
    note.textContent='대용량 최적화 상태에서도 삽입 기능을 유지합니다. 새 항목은 문서 끝에 추가됩니다.';
    actions.append(blank,divider,note);
    empty.appendChild(actions);
    document.documentElement.dataset.pdfPreviewInsertPersistence='1';
    return true;
  }

  function repair(){
    if(repairing)return;
    repairing=true;
    try{
      installStyles();
      if(!ensureFastFallback())ensureNormalBoundaries();
    }finally{repairing=false;}
  }

  function queue(){
    if(frame)return;
    frame=requestAnimationFrame(()=>{frame=0;repair();});
  }

  function install(attempt=0){
    const scroll=document.getElementById('previewScroll');
    if(!scroll){
      if(attempt<20)setTimeout(()=>install(attempt+1),100+attempt*30);
      return false;
    }
    installStyles();
    if(!observer){
      observer=new MutationObserver(queue);
      // Only top-level preview replacement is observed. Repairs do not observe
      // their own nested button construction, preventing mutation feedback loops.
      observer.observe(scroll,{childList:true});
    }
    queue();
    [180,500,1200].forEach(delay=>setTimeout(queue,delay));
    return true;
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>install(0),{once:true});else install(0);

  window.PdfPreviewInsertPersistence={repair,ensureNormalBoundaries,ensureFastFallback,stage:'multi-file-preview-insert-persistence-v1'};
})();
