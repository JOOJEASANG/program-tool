// Keeps blank-page/divider insertion controls available and functional across normal and lazy preview rerenders.
(function(){
  'use strict';
  if(window.__pdfPreviewInsertPersistenceV1)return;
  window.__pdfPreviewInsertPersistenceV1=true;

  const path=(location.pathname||'/').replace(/\/+$/,'')||'/';
  if(path!=='/pdf-editor'&&path!=='/pdf-editor/index.html'&&!path.endsWith('/pdf-editor/index.html'))return;

  let observer=null;
  let timer=0;
  let repairing=false;
  let actionBridgeBound=false;

  function installStyles(){
    if(document.getElementById('pdfPreviewInsertPersistenceStylesV1'))return;
    const style=document.createElement('style');
    style.id='pdfPreviewInsertPersistenceStylesV1';
    style.textContent=`
      #previewScroll .prev-ins-zone.pdf-preview-boundary-insert{opacity:.62!important;visibility:visible!important;pointer-events:auto!important}
      #previewScroll .prev-ins-zone.pdf-preview-boundary-insert:hover{opacity:1!important}
      #previewScroll .prev-ins-zone-v.pdf-preview-inline-insert{opacity:.52!important;visibility:visible!important;pointer-events:auto!important}
      #previewScroll .prev-ins-zone-v.pdf-preview-inline-insert:hover{opacity:1!important}
      #previewScroll[data-lazy-preview="true"] .prev-ins-zone.pdf-preview-boundary-insert,
      #previewScroll[data-lazy-preview="true"] .prev-ins-zone-v.pdf-preview-inline-insert{display:flex!important}
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

  function markVertical(zone,index){
    if(!zone)return null;
    zone.classList.add('pdf-preview-inline-insert');
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

  function makeVertical(index){
    try{
      if(typeof makeVerticalInsertZone!=='function')return null;
      return markVertical(makeVerticalInsertZone(index),index);
    }catch(error){
      console.warn('[pdf-preview-insert] inline boundary creation failed',error);
      return null;
    }
  }

  function outputIndex(face,fallback=-1){
    const value=Number(face?.dataset?.outputIndex);
    return Number.isFinite(value)&&value>=0?Math.floor(value):fallback;
  }

  function ensureHorizontalBefore(row,boundary){
    let zone=row?.previousElementSibling;
    if(zone?.classList?.contains('prev-ins-zone')&&zone.dataset.pdfInsertBoundary===String(boundary)){
      markHorizontal(zone,boundary);
      return zone;
    }
    if(zone?.classList?.contains('prev-ins-zone'))zone.remove();
    zone=makeHorizontal(boundary);
    if(zone&&row)row.before(zone);
    return zone;
  }

  function ensureHorizontalAfter(row,boundary){
    let zone=row?.nextElementSibling;
    if(zone?.classList?.contains('prev-ins-zone')&&zone.dataset.pdfInsertBoundary===String(boundary)){
      markHorizontal(zone,boundary);
      return zone;
    }
    if(zone?.classList?.contains('prev-ins-zone'))zone.remove();
    zone=makeHorizontal(boundary);
    if(zone&&row)row.after(zone);
    return zone;
  }

  function ensureVerticalAfter(face,boundary){
    let zone=face?.nextElementSibling;
    if(zone?.classList?.contains('prev-ins-zone-v')&&zone.dataset.pdfInsertBoundary===String(boundary)){
      return markVertical(zone,boundary);
    }
    if(zone?.classList?.contains('prev-ins-zone-v'))zone.remove();
    zone=makeVertical(boundary);
    if(zone&&face)face.after(zone);
    return zone;
  }

  function ensureLazyBoundaries(){
    const scroll=document.getElementById('previewScroll');
    if(!scroll||scroll.querySelector('.empty-state'))return false;
    const rows=[...scroll.children].filter(node=>node.classList?.contains('preview-row'));
    if(!rows.length||typeof makePreviewInsertZone!=='function'||typeof makeVerticalInsertZone!=='function')return false;
    const faces=rows.flatMap(row=>[...row.querySelectorAll(':scope>.page-preview')]);
    if(!faces.some(face=>Number.isFinite(Number(face.dataset.outputIndex))))return false;

    const firstFace=faces[0];
    const firstBoundary=outputIndex(firstFace,0);
    ensureHorizontalBefore(rows[0],firstBoundary);

    rows.forEach(row=>{
      const rowFaces=[...row.querySelectorAll(':scope>.page-preview')];
      const expectedZones=new Set();
      rowFaces.forEach((face,index)=>{
        if(index>=rowFaces.length-1)return;
        const boundary=outputIndex(face,index)+1;
        const zone=ensureVerticalAfter(face,boundary);
        if(zone)expectedZones.add(zone);
      });
      row.querySelectorAll(':scope>.prev-ins-zone-v').forEach(zone=>{
        if(!expectedZones.has(zone))zone.remove();
      });
      const lastFace=rowFaces[rowFaces.length-1];
      if(lastFace)ensureHorizontalAfter(row,outputIndex(lastFace,firstBoundary)+1);
    });

    document.documentElement.dataset.pdfPreviewInsertPersistence='1';
    document.documentElement.dataset.pdfPreviewInsertLazyBoundaries='1';
    return true;
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
      const faces=[...row.querySelectorAll(':scope>.page-preview')];
      row.querySelectorAll(':scope>.prev-ins-zone-v').forEach((zone,index)=>markVertical(zone,rendered+index+1));
      rendered+=faces.length;
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

  function currentInsertPoints(){
    try{if(Array.isArray(_previewInsertPoints)&&_previewInsertPoints.length)return _previewInsertPoints;}catch(_){}
    try{if(typeof buildPreviewInsertPoints==='function'){const points=buildPreviewInsertPoints();if(Array.isArray(points))return points;}}catch(error){console.warn('[pdf-preview-insert] insert point rebuild failed',error);}
    return [];
  }

  function boundaryFromZone(zone){
    const direct=Number(zone?.dataset?.pdfInsertBoundary);
    if(Number.isFinite(direct)&&direct>=0)return Math.floor(direct);
    const scroll=document.getElementById('previewScroll');
    if(!scroll||!zone)return -1;
    let boundary=0;
    for(const node of [...scroll.children]){
      if(node===zone)return boundary;
      if(node.classList?.contains('preview-row')){
        if(node.contains(zone)){
          for(const child of [...node.children]){
            if(child===zone)return boundary;
            if(child.classList?.contains('page-preview'))boundary+=1;
          }
          return boundary;
        }
        boundary+=node.querySelectorAll(':scope>.page-preview').length;
      }
    }
    return -1;
  }

  function spliceIndexForZone(zone){
    let length=0;
    try{length=Array.isArray(parsedPages)?parsedPages.length:0;}catch(_){return 0;}
    if(zone?.closest?.('.pdf-preview-fast-fallback'))return length;
    const boundary=boundaryFromZone(zone);
    const points=currentInsertPoints();
    const mapped=boundary>=0?Number(points[boundary]):NaN;
    if(Number.isFinite(mapped))return Math.max(0,Math.min(length,Math.floor(mapped)));
    return length;
  }

  function requestPreviewRefresh(){
    if(window.__pdfEditorFastMode){refreshFastPageCount();queue();return;}
    try{
      if(typeof triggerPreview==='function'){
        Promise.resolve(triggerPreview()).catch(error=>console.warn('[pdf-preview-insert] preview refresh failed',error)).finally(()=>setTimeout(queue,0));
        return;
      }
    }catch(error){console.warn('[pdf-preview-insert] preview refresh failed',error);}
    try{if(typeof schedulePreview==='function'){schedulePreview(0);setTimeout(queue,80);return;}}catch(_){}
    setTimeout(queue,0);
  }

  function refreshAfterInsert(message){
    try{if(typeof renderThumbs==='function')renderThumbs();}catch(error){console.warn('[pdf-preview-insert] thumbnail refresh failed',error);}
    try{window.PdfUploadOptimization?.syncAggregateMode?.();}catch(_){}
    refreshFastPageCount();
    try{if(typeof showStatus==='function')showStatus(message,'success');}catch(_){}
    requestPreviewRefresh();
  }

  function insertBlankAt(index){
    try{
      if(!Array.isArray(parsedPages)||typeof makeBlankPage!=='function')return false;
      const safe=Math.max(0,Math.min(parsedPages.length,Number(index)||0));
      parsedPages.splice(safe,0,makeBlankPage());
      refreshAfterInsert('빈 페이지를 추가했습니다.');
      document.dispatchEvent(new CustomEvent('pdf-preview-page-inserted',{detail:{type:'blank',index:safe}}));
      return true;
    }catch(error){console.warn('[pdf-preview-insert] blank insertion failed',error);return false;}
  }

  function openDividerAt(index){
    let opener=null;
    try{if(typeof openDividerInsert==='function')opener=openDividerInsert;}catch(_){}
    if(!opener&&typeof window.openDividerInsert==='function')opener=window.openDividerInsert;
    if(!opener)return false;
    try{
      let length=0;try{length=Array.isArray(parsedPages)?parsedPages.length:0;}catch(_){}
      const safe=Math.max(0,Math.min(length,Number(index)||0));
      opener(safe);
      document.dispatchEvent(new CustomEvent('pdf-preview-page-insert-requested',{detail:{type:'divider',index:safe}}));
      return true;
    }catch(error){console.warn('[pdf-preview-insert] divider insertion failed',error);return false;}
  }

  function bindActionBridge(){
    const scroll=document.getElementById('previewScroll');
    if(!scroll||actionBridgeBound)return false;
    actionBridgeBound=true;
    scroll.addEventListener('click',event=>{
      const button=event.target.closest?.('.prev-ins-btn,.prev-ins-btn-v');
      if(!button||!scroll.contains(button))return;
      const zone=button.closest('.prev-ins-zone,.prev-ins-zone-v,.pdf-preview-fast-fallback');
      const divider=button.classList.contains('divider')||String(button.textContent||'').includes('간지');
      const blank=!divider&&String(button.textContent||'').includes('빈');
      if(!divider&&!blank)return;
      const index=spliceIndexForZone(zone);
      const handled=divider?openDividerAt(index):insertBlankAt(index);
      if(!handled)return;
      event.preventDefault();
      event.stopImmediatePropagation();
    },true);
    document.documentElement.dataset.pdfPreviewInsertActionBridge='1';
    return true;
  }

  function appendFastBlank(){insertBlankAt((()=>{try{return Array.isArray(parsedPages)?parsedPages.length:0;}catch(_){return 0;}})());}

  function openFastDivider(){
    let length=0;try{length=Array.isArray(parsedPages)?parsedPages.length:0;}catch(_){}
    openDividerAt(length);
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

    const divider=document.createElement('button');
    divider.type='button';divider.className='prev-ins-btn divider';divider.textContent='+ 간지';

    const note=document.createElement('div');
    note.className='pdf-preview-fast-note';
    note.textContent='대용량 최적화 상태에서도 삽입 기능을 유지합니다. 실제 미리보기가 열리면 각 출력면 사이에서 빈 페이지와 간지를 넣을 수 있습니다.';
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
      bindActionBridge();
      if(!ensureFastFallback()&&!ensureLazyBoundaries())ensureNormalBoundaries();
    }finally{repairing=false;}
  }

  function queue(){
    if(timer)return;
    timer=setTimeout(()=>{timer=0;repair();},0);
  }

  function install(attempt=0){
    const scroll=document.getElementById('previewScroll');
    if(!scroll){
      if(attempt<20)setTimeout(()=>install(attempt+1),100+attempt*30);
      return false;
    }
    installStyles();
    bindActionBridge();
    if(!observer){
      observer=new MutationObserver(queue);
      observer.observe(scroll,{childList:true});
    }
    queue();
    [180,500,1200].forEach(delay=>setTimeout(queue,delay));
    return true;
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>install(0),{once:true});else install(0);

  window.PdfPreviewInsertPersistence={
    repair,
    ensureNormalBoundaries,
    ensureLazyBoundaries,
    ensureFastFallback,
    insertBlankAt,
    openDividerAt,
    spliceIndexForZone,
    legacyStage:'multi-file-preview-insert-persistence-v2',
    stage:'preview-insert-actions-functional-v4'
  };
})();