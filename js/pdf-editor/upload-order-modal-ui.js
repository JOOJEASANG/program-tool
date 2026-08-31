// PDF editor multi-file upload order modal.
// It stages only multi-file selections, then reuses the existing handleFile pipeline.
(function(){
  'use strict';
  if(window.__pdfEditorUploadOrderModalUiV2)return;
  window.__pdfEditorUploadOrderModalUiV2=true;

  const STYLE_ID='pdfUploadOrderModalStylesV2';
  const MODAL_ID='pdfUploadOrderModalV2';
  let pending=null;
  let dragIndex=-1;
  let observer=null;
  let lastFocus=null;

  function readUploadMode(){
    try{if(typeof _uploadMode==='string')return _uploadMode;}catch(_){}
    return typeof window._uploadMode==='string'?window._uploadMode:'new';
  }

  function writeUploadMode(mode){
    const normalized=['new','cont','break'].includes(mode)?mode:'cont';
    try{_uploadMode=normalized;}catch(_){window._uploadMode=normalized;}
    try{window._uploadMode=normalized;}catch(_){}
    document.querySelectorAll('.mode-btn').forEach(button=>button.classList.remove('active','break-active'));
    const active=document.querySelector(`.mode-btn[data-mode="${normalized}"]`);
    if(active)active.classList.add(normalized==='break'?'break-active':'active');
    return normalized;
  }

  function hasExistingPages(){
    try{return Array.isArray(parsedPages)&&parsedPages.length>0;}catch(_){return false;}
  }

  function pdfFiles(files){
    return Array.from(files||[]).filter(file=>file&&(((file.type||'').includes('pdf'))||/\.pdf$/i.test(file.name||'')));
  }

  function formatBytes(bytes){
    const value=Number(bytes||0);
    if(value>=1024*1024)return `${Math.max(.1,value/1024/1024).toFixed(value>=10*1024*1024?0:1)}MB`;
    if(value>=1024)return `${Math.max(1,Math.round(value/1024))}KB`;
    return `${value}B`;
  }

  function modeLabel(mode){
    if(mode==='break')return '비연속 · 파일마다 새 묶음';
    if(mode==='new')return '새 작업 · 선택 순서대로 시작';
    return '연속 · 앞 파일에 이어 배치';
  }

  function installStyles(){
    if(document.getElementById(STYLE_ID))return;
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      #${MODAL_ID}{position:fixed;inset:0;z-index:5600;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(15,23,42,.46);backdrop-filter:blur(2px)}
      #${MODAL_ID}[hidden]{display:none!important}
      #${MODAL_ID} .pdf-upload-order-dialog{width:min(620px,calc(100vw - 32px));max-height:min(78vh,720px);display:flex;flex-direction:column;overflow:hidden;border:1px solid #d8e2ec;border-radius:16px;background:#fff;box-shadow:0 24px 70px rgba(15,23,42,.28)}
      #${MODAL_ID} .pdf-upload-order-head{display:flex;align-items:flex-start;gap:10px;padding:16px 18px 13px;border-bottom:1px solid #e6edf4;background:#fbfdff}
      #${MODAL_ID} .pdf-upload-order-title-wrap{min-width:0;flex:1}
      #${MODAL_ID} .pdf-upload-order-title{font-size:15px;font-weight:900;letter-spacing:-.25px;color:#172b41}
      #${MODAL_ID} .pdf-upload-order-sub{margin-top:3px;font-size:10.5px;line-height:1.45;color:#718096}
      #${MODAL_ID} .pdf-upload-order-mode{display:inline-flex;align-items:center;min-height:25px;margin-top:1px;padding:4px 8px;border-radius:999px;background:#e9f4ff;color:#17639a;font-size:9.5px;font-weight:850;white-space:nowrap}
      #${MODAL_ID}[data-mode="break"] .pdf-upload-order-mode{background:#f1ecff;color:#6d28d9}
      #${MODAL_ID} .pdf-upload-order-close{flex:0 0 32px;width:32px;height:32px;border:1px solid #d8e0e8;border-radius:8px;background:#fff;color:#64748b;font:800 15px/1 inherit;cursor:pointer}
      #${MODAL_ID} .pdf-upload-order-close:hover{background:#f8fafc;color:#1f2937}
      #${MODAL_ID} .pdf-upload-order-body{min-height:0;overflow:auto;padding:12px 16px 8px}
      #${MODAL_ID} .pdf-upload-order-list{display:grid;gap:7px}
      #${MODAL_ID} .pdf-upload-order-row{display:grid;grid-template-columns:32px minmax(0,1fr) auto;align-items:center;gap:9px;min-height:54px;padding:7px 8px;border:1px solid #dfe7ef;border-radius:10px;background:#fff;cursor:grab;transition:border-color .12s,background .12s,box-shadow .12s}
      #${MODAL_ID} .pdf-upload-order-row:hover{border-color:#b7cbe0;background:#fbfdff}
      #${MODAL_ID} .pdf-upload-order-row:active{cursor:grabbing}
      #${MODAL_ID} .pdf-upload-order-row.drag-over{border-color:#60a5fa;background:#eff6ff;box-shadow:0 0 0 2px rgba(37,99,235,.08)}
      #${MODAL_ID} .pdf-upload-order-index{width:30px;height:30px;display:grid;place-items:center;border-radius:8px;background:#eef3f7;color:#405269;font-size:10px;font-weight:900}
      #${MODAL_ID} .pdf-upload-order-copy{min-width:0}
      #${MODAL_ID} .pdf-upload-order-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#1f2937;font-size:11px;font-weight:850}
      #${MODAL_ID} .pdf-upload-order-meta{margin-top:2px;color:#8a98a8;font-size:9px}
      #${MODAL_ID} .pdf-upload-order-actions{display:flex;gap:4px}
      #${MODAL_ID} .pdf-upload-order-actions button{width:32px;height:32px;border:1px solid #d7e0e9;border-radius:8px;background:#fff;color:#475569;font-family:inherit;font-size:11px;font-weight:900;cursor:pointer}
      #${MODAL_ID} .pdf-upload-order-actions button:hover:not(:disabled){border-color:#93c5fd;background:#eff6ff;color:#1d4ed8}
      #${MODAL_ID} .pdf-upload-order-actions button:disabled{opacity:.28;cursor:default}
      #${MODAL_ID} .pdf-upload-order-actions button[data-remove]{color:#b42318}
      #${MODAL_ID} .pdf-upload-order-actions button[data-remove]:hover{border-color:#fca5a5;background:#fef2f2;color:#991b1b}
      #${MODAL_ID} .pdf-upload-order-footer{display:flex;align-items:center;justify-content:flex-end;gap:8px;padding:12px 16px 15px;border-top:1px solid #e6edf4;background:#fbfdff}
      #${MODAL_ID} .pdf-upload-order-footer button{min-width:112px;height:38px;border-radius:9px;font-family:inherit;font-size:11px;font-weight:850;cursor:pointer}
      #${MODAL_ID} .pdf-upload-order-cancel{border:1px solid #cfd8e2;background:#fff;color:#475569}
      #${MODAL_ID} .pdf-upload-order-confirm{border:1px solid #1f6fb2;background:#1f6fb2;color:#fff}
      #${MODAL_ID}[data-busy="1"] .pdf-upload-order-row{cursor:default}
      #${MODAL_ID}[data-busy="1"] .pdf-upload-order-body{opacity:.62}
      #${MODAL_ID}[data-busy="1"] button{pointer-events:none}
      @media(max-width:640px){#${MODAL_ID}{padding:10px}#${MODAL_ID} .pdf-upload-order-dialog{width:100%;max-height:88vh}#${MODAL_ID} .pdf-upload-order-head{padding:13px}#${MODAL_ID} .pdf-upload-order-body{padding:9px}#${MODAL_ID} .pdf-upload-order-row{grid-template-columns:28px minmax(0,1fr)}#${MODAL_ID} .pdf-upload-order-actions{grid-column:2;justify-content:flex-end}#${MODAL_ID} .pdf-upload-order-footer{display:grid;grid-template-columns:1fr 1.4fr}#${MODAL_ID} .pdf-upload-order-footer button{min-width:0;width:100%}}
    `;
    document.head.appendChild(style);
  }

  function removeLegacyExtras(){
    document.getElementById('pdfPageListQuickAddV1')?.remove();
    document.getElementById('pdfUploadOrderPanelV1')?.remove();
    document.getElementById('pdfPrintUtilityRedirectCard')?.remove();
  }

  function ensureModal(){
    installStyles();
    let modal=document.getElementById(MODAL_ID);
    if(modal)return modal;
    modal=document.createElement('div');
    modal.id=MODAL_ID;
    modal.hidden=true;
    modal.setAttribute('role','dialog');
    modal.setAttribute('aria-modal','true');
    modal.setAttribute('aria-labelledby','pdfUploadOrderTitleV2');
    modal.innerHTML=`<div class="pdf-upload-order-dialog"><div class="pdf-upload-order-head"><div class="pdf-upload-order-title-wrap"><div class="pdf-upload-order-title" id="pdfUploadOrderTitleV2">PDF 업로드 순서 편집</div><div class="pdf-upload-order-sub">파일을 드래그하거나 ↑ ↓ 버튼으로 순서를 정한 뒤 업로드하세요.</div></div><span class="pdf-upload-order-mode"></span><button type="button" class="pdf-upload-order-close" aria-label="닫기">×</button></div><div class="pdf-upload-order-body"><div class="pdf-upload-order-list"></div></div><div class="pdf-upload-order-footer"><button type="button" class="pdf-upload-order-cancel">취소</button><button type="button" class="pdf-upload-order-confirm">이 순서로 업로드</button></div></div>`;
    modal.addEventListener('click',event=>{
      if(event.target===modal)clearPending();
    });
    modal.querySelector('.pdf-upload-order-close')?.addEventListener('click',clearPending);
    modal.querySelector('.pdf-upload-order-cancel')?.addEventListener('click',clearPending);
    modal.querySelector('.pdf-upload-order-confirm')?.addEventListener('click',()=>processPending());
    document.body.appendChild(modal);
    return modal;
  }

  function renderPending(){
    const modal=ensureModal();
    if(!pending||!pending.files.length){
      modal.hidden=true;
      modal.dataset.busy='0';
      return null;
    }
    modal.hidden=false;
    modal.dataset.mode=pending.mode;
    modal.dataset.busy=pending.busy?'1':'0';
    const badge=modal.querySelector('.pdf-upload-order-mode');
    if(badge)badge.textContent=modeLabel(pending.mode);
    const list=modal.querySelector('.pdf-upload-order-list');
    if(!list)return modal;
    list.replaceChildren();

    pending.files.forEach((file,index)=>{
      const row=document.createElement('div');
      row.className='pdf-upload-order-row';
      row.draggable=!pending.busy;
      row.dataset.index=String(index);
      const order=document.createElement('span');order.className='pdf-upload-order-index';order.textContent=String(index+1);
      const copy=document.createElement('div');copy.className='pdf-upload-order-copy';
      const name=document.createElement('div');name.className='pdf-upload-order-name';name.textContent=file.name||`PDF ${index+1}`;
      const meta=document.createElement('div');meta.className='pdf-upload-order-meta';meta.textContent=formatBytes(file.size);
      copy.append(name,meta);
      const actions=document.createElement('div');actions.className='pdf-upload-order-actions';
      const up=document.createElement('button');up.type='button';up.textContent='↑';up.title='위로';up.setAttribute('aria-label',`${index+1}번 파일 위로`);up.disabled=pending.busy||index===0;up.addEventListener('click',()=>movePending(index,index-1));
      const down=document.createElement('button');down.type='button';down.textContent='↓';down.title='아래로';down.setAttribute('aria-label',`${index+1}번 파일 아래로`);down.disabled=pending.busy||index===pending.files.length-1;down.addEventListener('click',()=>movePending(index,index+1));
      const remove=document.createElement('button');remove.type='button';remove.textContent='×';remove.title='목록에서 제거';remove.setAttribute('aria-label',`${file.name||index+1} 목록에서 제거`);remove.dataset.remove='1';remove.disabled=pending.busy;remove.addEventListener('click',()=>removePending(index));
      actions.append(up,down,remove);
      row.append(order,copy,actions);
      row.addEventListener('dragstart',event=>{if(pending?.busy)return;dragIndex=index;try{event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',String(index));}catch(_){};});
      row.addEventListener('dragover',event=>{if(pending?.busy)return;event.preventDefault();row.classList.add('drag-over');});
      row.addEventListener('dragleave',()=>row.classList.remove('drag-over'));
      row.addEventListener('drop',event=>{if(pending?.busy)return;event.preventDefault();row.classList.remove('drag-over');const from=dragIndex>=0?dragIndex:Number(event.dataTransfer?.getData('text/plain'));dragIndex=-1;movePending(from,index);});
      row.addEventListener('dragend',()=>{dragIndex=-1;document.querySelectorAll(`#${MODAL_ID} .drag-over`).forEach(node=>node.classList.remove('drag-over'));});
      list.appendChild(row);
    });

    const confirm=modal.querySelector('.pdf-upload-order-confirm');
    if(confirm){confirm.textContent=pending.busy?'업로드 중...':'이 순서로 업로드';confirm.disabled=!!pending.busy;}
    modal.querySelector('.pdf-upload-order-cancel')?.toggleAttribute('disabled',!!pending.busy);
    modal.querySelector('.pdf-upload-order-close')?.toggleAttribute('disabled',!!pending.busy);
    return modal;
  }

  function openPending(files,mode){
    const selected=pdfFiles(files);
    if(selected.length<2)return false;
    lastFocus=document.activeElement instanceof HTMLElement?document.activeElement:null;
    pending={files:[...selected],mode:['new','cont','break'].includes(mode)?mode:readUploadMode(),busy:false};
    renderPending();
    setTimeout(()=>document.querySelector(`#${MODAL_ID} .pdf-upload-order-confirm`)?.focus(),0);
    return true;
  }

  function movePending(from,to){
    if(!pending||pending.busy)return false;
    const a=Number(from),b=Number(to);
    if(!Number.isInteger(a)||!Number.isInteger(b)||a<0||b<0||a>=pending.files.length||b>=pending.files.length||a===b)return false;
    const [file]=pending.files.splice(a,1);pending.files.splice(b,0,file);renderPending();return true;
  }

  function removePending(index){
    if(!pending||pending.busy)return false;
    const value=Number(index);
    if(!Number.isInteger(value)||value<0||value>=pending.files.length)return false;
    pending.files.splice(value,1);
    if(!pending.files.length){clearPending();return true;}
    renderPending();return true;
  }

  function clearPending(){
    if(pending?.busy)return false;
    pending=null;dragIndex=-1;
    const modal=document.getElementById(MODAL_ID);
    if(modal)modal.hidden=true;
    const focus=lastFocus;lastFocus=null;
    if(focus?.isConnected)setTimeout(()=>focus.focus(),0);
    return true;
  }

  async function callExistingHandleFile(file){
    let fn=null;
    try{if(typeof handleFile==='function')fn=handleFile;}catch(_){}
    if(typeof fn!=='function')fn=window.handleFile;
    if(typeof fn!=='function')throw new Error('PDF 업로드 기능을 준비하지 못했습니다.');
    return fn(file);
  }

  function effectiveMode(batchMode,index,hadPages){
    if(index===0&&!hadPages)return 'new';
    if(batchMode==='new')return index===0?'new':'cont';
    return batchMode==='break'?'break':'cont';
  }

  async function processFiles(files,mode){
    const ordered=pdfFiles(files);if(!ordered.length)return false;
    const hadPages=hasExistingPages();
    for(let index=0;index<ordered.length;index+=1){
      writeUploadMode(effectiveMode(mode,index,hadPages));
      await callExistingHandleFile(ordered[index]);
    }
    writeUploadMode(mode==='new'?'cont':mode);
    return true;
  }

  async function processPending(){
    if(!pending||pending.busy||!pending.files.length)return false;
    pending.busy=true;renderPending();
    const files=[...pending.files],mode=pending.mode;
    try{
      await processFiles(files,mode);
      pending=null;
      const modal=document.getElementById(MODAL_ID);if(modal)modal.hidden=true;
      const focus=lastFocus;lastFocus=null;if(focus?.isConnected)setTimeout(()=>focus.focus(),0);
      return true;
    }catch(error){
      console.error('[pdf-upload-order] ordered upload failed',error);
      if(typeof showStatus==='function')showStatus(`파일 추가 실패: ${error.message||error}`,'error');
      if(pending){pending.busy=false;renderPending();}
      return false;
    }
  }

  function onFileInputChange(event){
    const selected=pdfFiles(event.target?.files);
    if(selected.length<2)return;
    event.preventDefault();event.stopImmediatePropagation();
    try{event.target.value='';}catch(_){}
    openPending(selected,readUploadMode());
  }

  function onDocumentDrop(event){
    const selected=pdfFiles(event.dataTransfer?.files);
    if(selected.length<2)return;
    event.preventDefault();event.stopImmediatePropagation();
    document.getElementById('uploadZone')?.classList.remove('drag-over');
    openPending(selected,readUploadMode());
  }

  function bindUploadCapture(){
    const input=document.getElementById('fileInput');
    if(input&&input.dataset.uploadOrderModalCapture!=='1'){
      input.dataset.uploadOrderModalCapture='1';
      input.addEventListener('change',onFileInputChange,true);
    }
    if(document.documentElement.dataset.uploadOrderModalDropCapture!=='1'){
      document.documentElement.dataset.uploadOrderModalDropCapture='1';
      document.addEventListener('drop',onDocumentDrop,true);
    }
  }

  function onKeyDown(event){
    if(event.key!=='Escape'||!pending||pending.busy)return;
    event.preventDefault();clearPending();
  }

  function sync(){
    removeLegacyExtras();
    bindUploadCapture();
    if(pending)renderPending();
  }

  function boot(){
    installStyles();ensureModal();sync();
    document.addEventListener('keydown',onKeyDown,true);
    if(typeof MutationObserver==='function'){
      observer=new MutationObserver(()=>sync());
      observer.observe(document.body,{childList:true,subtree:true});
    }
  }

  window.PdfUploadOrderUi={
    stage:'modal-order-editor-v2',
    openPending,
    stageFiles:openPending,
    movePending,
    removePending,
    processPending,
    processFiles,
    clearPending,
    get pending(){return pending;}
  };

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();