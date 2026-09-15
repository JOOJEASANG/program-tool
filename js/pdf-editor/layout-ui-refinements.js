// PDF layout/editor production UI refinements: compact preview toolbar, file-block ordering and clean defaults.
(function(){
  'use strict';
  if(window.__pdfLayoutUiRefinementsV1)return;
  window.__pdfLayoutUiRefinementsV1=true;
  if(!String(location.pathname||'').includes('pdf-editor'))return;

  const INSTALL_DELAYS=[0,100,240,480,900,1500,2400,3800,6000];
  let observer=null;
  let frame=0;
  let draggedFileIndex=null;

  const byId=id=>document.getElementById(id);
  const fileIndexOf=page=>{
    const value=Number(page?.file_index);
    return Number.isInteger(value)&&value>=0?value:null;
  };

  function editorPages(){
    try{return Array.isArray(parsedPages)?parsedPages:[];}catch(_){return [];}
  }
  function editorFiles(){
    try{return Array.isArray(uploadedFiles)?uploadedFiles:[];}catch(_){return [];}
  }

  function installStyles(){
    if(byId('pdfLayoutUiRefinementsStylesV1'))return;
    const style=document.createElement('style');
    style.id='pdfLayoutUiRefinementsStylesV1';
    style.textContent=`
      #pdfPageListQuickAddV1{display:none!important}
      #pdfLazyPreviewNav{margin:0!important;padding:0!important;border:0!important;border-radius:0!important;background:transparent!important;box-shadow:none!important;flex:0 0 auto!important;gap:4px!important;flex-wrap:nowrap!important;min-width:0!important}
      #pdfLazyPreviewNav[data-active="true"]{display:flex!important}
      #pdfLazyPreviewNav .lazy-preview-range,#pdfLazyPreviewRange{display:none!important}
      #pdfLazyPreviewNav button{height:27px!important;padding:3px 7px!important;border:1px solid #d6dee8!important;border-radius:6px!important;background:#fff!important;font-size:9.5px!important;white-space:nowrap!important}
      #pdfLazyPreviewNav input{height:27px!important;width:54px!important;padding:3px 5px!important;font-size:9.5px!important}
      #pdfLazyPreviewNav .lazy-preview-count{font-size:9.5px!important;white-space:nowrap!important}
      #zoomResetBtn{min-width:66px!important;padding:3px 7px!important;font-size:9.5px!important;white-space:nowrap!important}
      .thumb-file-sep[data-file-nav-header="true"]{position:relative}
      .pdf-file-order-handle{flex:0 0 22px;width:22px;height:25px;display:grid;place-items:center;border:1px solid #cbd5e1;border-radius:6px;background:#fff;color:#64748b;font:900 13px/1 Arial,sans-serif;cursor:grab;user-select:none}
      .pdf-file-order-handle:active{cursor:grabbing}
      .thumb-file-sep[data-file-order-drag-over="before"]{box-shadow:inset 0 3px 0 #2563eb}
      .thumb-file-sep[data-file-order-drag-over="after"]{box-shadow:inset 0 -3px 0 #2563eb}
      @media(max-width:760px){#pdfLazyPreviewNav input{width:46px!important}#pdfLazyPreviewNav .lazy-preview-count{display:none!important}#zoomResetBtn{min-width:58px!important}}
    `;
    document.head.appendChild(style);
  }

  function removePageListQuickAdd(){
    const bar=byId('pdfPageListQuickAddV1');
    if(bar)bar.remove();
    byId('pdfPageListQuickAddStylesV1')?.remove();
    document.documentElement.dataset.pdfPageListQuickAdd='removed';
  }

  function applyBorderDefault(){
    const checkbox=byId('showBorder');
    if(!checkbox||checkbox.dataset.defaultOffApplied==='1')return false;
    checkbox.dataset.defaultOffApplied='1';
    checkbox.checked=false;
    try{showBorder=false;}catch(_){try{window.showBorder=false;}catch(__){}}
    document.documentElement.dataset.pdfSlideBorderDefault='off';
    return true;
  }

  function compactLazyNavigation(){
    const info=document.querySelector('.preview-info');
    const zoom=document.querySelector('.preview-info .preview-zoom');
    const nav=byId('pdfLazyPreviewNav');
    const message=byId('previewInfo');
    if(!info)return false;

    byId('pdfLazyPreviewRange')?.remove();
    if(nav){
      if(nav.parentElement!==info||nav.nextElementSibling!==zoom){
        info.insertBefore(nav,zoom||null);
      }
      const active=nav.dataset.active==='true';
      if(message){
        if(active){
          message.hidden=true;
          message.dataset.hiddenByCompactLazyNav='1';
        }else if(message.dataset.hiddenByCompactLazyNav==='1'){
          message.hidden=false;
          delete message.dataset.hiddenByCompactLazyNav;
        }
      }
      document.documentElement.dataset.pdfLazyNavigationPlacement='preview-toolbar';
    }else if(message?.dataset.hiddenByCompactLazyNav==='1'){
      message.hidden=false;
      delete message.dataset.hiddenByCompactLazyNav;
    }
    return Boolean(nav);
  }

  function currentFileOrder(){
    const order=[];
    const seen=new Set();
    for(const page of editorPages()){
      const index=fileIndexOf(page);
      if(index===null||seen.has(index))continue;
      seen.add(index);order.push(index);
    }
    for(let index=0;index<editorFiles().length;index+=1){
      if(!seen.has(index)){seen.add(index);order.push(index);}
    }
    return order;
  }

  function remapFileNup(indexMap){
    let current={};
    try{current=(fileNupMap&&typeof fileNupMap==='object')?fileNupMap:{};}catch(_){}
    const next={};
    Object.entries(current).forEach(([key,value])=>{
      const oldIndex=Number(key);
      if(indexMap.has(oldIndex))next[indexMap.get(oldIndex)]=value;
    });
    try{
      Object.keys(fileNupMap).forEach(key=>delete fileNupMap[key]);
      Object.assign(fileNupMap,next);
    }catch(_){try{fileNupMap=next;}catch(__){window.fileNupMap=next;}}
  }

  function reorderFiles(sourceIndex,targetIndex,placeAfter=false){
    const source=Number(sourceIndex),target=Number(targetIndex);
    if(!Number.isInteger(source)||!Number.isInteger(target)||source===target)return false;
    const order=currentFileOrder();
    const sourcePos=order.indexOf(source),targetPos=order.indexOf(target);
    if(sourcePos<0||targetPos<0)return false;

    const nextOrder=order.slice();
    nextOrder.splice(sourcePos,1);
    let insertion=nextOrder.indexOf(target)+(placeAfter?1:0);
    insertion=Math.max(0,Math.min(nextOrder.length,insertion));
    nextOrder.splice(insertion,0,source);
    if(nextOrder.every((value,index)=>value===order[index]))return false;

    const pages=editorPages();
    const files=editorFiles();
    const buckets=new Map(order.map(index=>[index,[]]));
    const prefix=[];
    let owner=null;
    for(const page of pages){
      const index=fileIndexOf(page);
      if(index!==null){
        owner=index;
        if(!buckets.has(index))buckets.set(index,[]);
        buckets.get(index).push(page);
      }else if(owner!==null&&buckets.has(owner)){
        buckets.get(owner).push(page);
      }else{
        prefix.push(page);
      }
    }

    const oldFiles=files.slice();
    const indexMap=new Map();
    nextOrder.forEach((oldIndex,newIndex)=>indexMap.set(oldIndex,newIndex));
    const nextFiles=nextOrder.map(oldIndex=>oldFiles[oldIndex]).filter(Boolean);

    for(const oldIndex of nextOrder){
      for(const page of buckets.get(oldIndex)||[]){
        if(fileIndexOf(page)!==null)page.file_index=indexMap.get(oldIndex);
      }
    }
    const nextPages=[...prefix,...nextOrder.flatMap(oldIndex=>buckets.get(oldIndex)||[])];
    const firstPdf=nextPages.find(page=>fileIndexOf(page)!==null);
    if(firstPdf)firstPdf.groupBreak=false;

    try{uploadedFiles.splice(0,uploadedFiles.length,...nextFiles);}catch(_){try{uploadedFiles=nextFiles;}catch(__){window.uploadedFiles=nextFiles;}}
    remapFileNup(indexMap);
    try{parsedPages.splice(0,parsedPages.length,...nextPages);}catch(_){try{parsedPages=nextPages;}catch(__){window.parsedPages=nextPages;}}

    try{if(typeof renderThumbs==='function')renderThumbs();}catch(error){console.warn('[pdf-file-order] thumbnail refresh failed',error);}
    try{if(typeof schedulePreview==='function')schedulePreview(80);}catch(_){}
    try{
      if(typeof showStatus==='function'){
        showStatus('파일 순서를 변경했습니다. 최종 PDF도 이 순서로 저장됩니다.','success');
        if(typeof hideStatus==='function')setTimeout(hideStatus,1400);
      }
    }catch(_){}
    document.documentElement.dataset.pdfFileOrderDrag='applied';
    requestAnimationFrame(decorateFileHeaders);
    return true;
  }

  function clearDropMarks(){
    document.querySelectorAll('.thumb-file-sep[data-file-order-drag-over]').forEach(header=>delete header.dataset.fileOrderDragOver);
  }

  function decorateFileHeader(header){
    if(!header||header.dataset.fileOrderDragReady==='1')return;
    const fileIndex=Number(header.dataset.fileIndex);
    if(!Number.isInteger(fileIndex))return;
    header.dataset.fileOrderDragReady='1';

    const handle=document.createElement('span');
    handle.className='pdf-file-order-handle';
    handle.draggable=true;
    handle.tabIndex=0;
    handle.textContent='⠿';
    handle.title='마우스로 드래그하여 파일 순서 변경';
    handle.setAttribute('aria-label',handle.title);
    header.insertBefore(handle,header.firstChild);

    handle.addEventListener('dragstart',event=>{
      draggedFileIndex=fileIndex;
      try{event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',String(fileIndex));}catch(_){}
      document.documentElement.dataset.pdfFileOrderDragging=String(fileIndex);
    });
    handle.addEventListener('dragend',()=>{
      draggedFileIndex=null;clearDropMarks();delete document.documentElement.dataset.pdfFileOrderDragging;
    });
    header.addEventListener('dragover',event=>{
      if(draggedFileIndex===null||draggedFileIndex===fileIndex)return;
      event.preventDefault();
      const rect=header.getBoundingClientRect();
      header.dataset.fileOrderDragOver=event.clientY>=rect.top+rect.height/2?'after':'before';
      try{event.dataTransfer.dropEffect='move';}catch(_){}
    });
    header.addEventListener('dragleave',event=>{
      if(!header.contains(event.relatedTarget))delete header.dataset.fileOrderDragOver;
    });
    header.addEventListener('drop',event=>{
      if(draggedFileIndex===null||draggedFileIndex===fileIndex)return;
      event.preventDefault();event.stopPropagation();
      const after=header.dataset.fileOrderDragOver==='after';
      const source=draggedFileIndex;
      draggedFileIndex=null;clearDropMarks();
      reorderFiles(source,fileIndex,after);
    });
  }

  function decorateFileHeaders(){
    document.querySelectorAll('.thumb-file-sep[data-file-nav-header="true"]').forEach(decorateFileHeader);
  }

  function sync(){
    frame=0;
    installStyles();
    removePageListQuickAdd();
    applyBorderDefault();
    compactLazyNavigation();
    decorateFileHeaders();
    const reset=byId('zoomResetBtn');
    if(reset){reset.textContent='화면 맞춤';reset.title='미리보기를 현재 화면에 맞춤';reset.setAttribute('aria-label','미리보기 화면 맞춤');}
  }

  function queueSync(){
    if(frame)return;
    frame=requestAnimationFrame(sync);
  }

  function installObserver(){
    if(observer||typeof MutationObserver!=='function')return;
    observer=new MutationObserver(queueSync);
    observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['data-active','data-file-index','data-file-nav-header']});
  }

  function boot(){
    sync();installObserver();
    document.addEventListener('pdf-import-committed',queueSync);
    document.addEventListener('pdf-import-failed',queueSync);
    INSTALL_DELAYS.forEach(delay=>setTimeout(queueSync,delay));
  }

  window.PdfLayoutUiRefinements={
    currentFileOrder,
    reorderFiles,
    removePageListQuickAdd,
    compactLazyNavigation,
    decorateFileHeaders,
    sync,
    stage:'pdf-layout-preview-file-order-cleanup-v1'
  };

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
