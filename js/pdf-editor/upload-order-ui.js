// PDF editor upload-order UI.
// Stages multi-file selections before the existing upload pipeline so users can
// reorder files without changing N-up, continuous, or group-break semantics.
(function(){
  'use strict';
  if(window.__pdfEditorUploadOrderUiV1)return;
  window.__pdfEditorUploadOrderUiV1=true;

  const STYLE_ID='pdfUploadOrderUiStylesV1';
  const PANEL_ID='pdfUploadOrderPanelV1';
  const QUICK_BAR_ID='pdfPageListQuickAddV1';
  let pending=null;
  let dragIndex=-1;
  let observer=null;

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
    if(mode==='break')return '비연속 추가 · 파일마다 새 묶음';
    if(mode==='new')return '새 작업 · 첫 파일부터 시작';
    return '연속 추가 · 앞 파일에 이어 배치';
  }

  function installStyles(){
    if(document.getElementById(STYLE_ID))return;
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      #pdfPrintUtilityRedirectCard{display:none!important}
      #${QUICK_BAR_ID}[data-upload-order-upgraded="1"]{display:grid!important;grid-template-columns:minmax(0,1fr) minmax(0,1fr)!important;gap:6px!important}
      #${QUICK_BAR_ID}[data-upload-order-upgraded="1"] button{width:auto!important;min-width:0!important;padding:6px 5px!important;white-space:nowrap!important}
      #${QUICK_BAR_ID} [data-quick-upload-mode="break"]{border-color:#c4b5fd!important;background:#f5f3ff!important;color:#6d28d9!important}
      #${QUICK_BAR_ID} [data-quick-upload-mode="break"]:hover{border-color:#a78bfa!important;background:#ede9fe!important}
      #${PANEL_ID}{margin-top:8px;padding:9px;border:1px solid #cbd5e1;border-radius:10px;background:#f8fafc;box-shadow:0 3px 10px rgba(15,23,42,.05)}
      #${PANEL_ID} .pdf-upload-order-head{display:flex;align-items:center;gap:6px;margin-bottom:7px}
      #${PANEL_ID} .pdf-upload-order-head strong{font-size:10px;color:#334155}
      #${PANEL_ID} .pdf-upload-order-mode{margin-left:auto;border-radius:999px;padding:3px 6px;background:#e0f2fe;color:#075985;font-size:8px;font-weight:900;white-space:nowrap}
      #${PANEL_ID}[data-mode="break"] .pdf-upload-order-mode{background:#ede9fe;color:#6d28d9}
      #${PANEL_ID} .pdf-upload-order-note{margin:0 0 7px;color:#64748b;font-size:8.5px;line-height:1.45}
      #${PANEL_ID} .pdf-upload-order-list{display:grid;gap:5px;max-height:230px;overflow:auto;padding-right:2px}
      #${PANEL_ID} .pdf-upload-order-row{display:grid;grid-template-columns:22px minmax(0,1fr) auto;align-items:center;gap:6px;padding:6px;border:1px solid #dbe4ee;border-radius:8px;background:#fff;cursor:grab}
      #${PANEL_ID} .pdf-upload-order-row:active{cursor:grabbing}
      #${PANEL_ID} .pdf-upload-order-row.drag-over{border-color:#60a5fa;background:#eff6ff}
      #${PANEL_ID} .pdf-upload-order-index{width:22px;height:22px;display:grid;place-items:center;border-radius:6px;background:#eef2f7;color:#475569;font-size:8px;font-weight:900}
      #${PANEL_ID} .pdf-upload-order-copy{min-width:0}
      #${PANEL_ID} .pdf-upload-order-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#1f2937;font-size:9px;font-weight:900}
      #${PANEL_ID} .pdf-upload-order-meta{margin-top:1px;color:#94a3b8;font-size:7.5px}
      #${PANEL_ID} .pdf-upload-order-actions{display:flex;gap:3px}
      #${PANEL_ID} .pdf-upload-order-actions button{width:24px;height:24px;border:1px solid #d5dee8;border-radius:6px;background:#fff;color:#475569;font-size:9px;font-weight:900;cursor:pointer;padding:0}
      #${PANEL_ID} .pdf-upload-order-actions button:hover{border-color:#93c5fd;background:#eff6ff;color:#1d4ed8}
      #${PANEL_ID} .pdf-upload-order-actions button[data-remove]{color:#b42318}
      #${PANEL_ID} .pdf-upload-order-footer{display:grid;grid-template-columns:1fr 1.4fr;gap:6px;margin-top:8px}
      #${PANEL_ID} .pdf-upload-order-footer button{min-height:32px;border-radius:8px;font-family:inherit;font-size:9px;font-weight:900;cursor:pointer}
      #${PANEL_ID} .pdf-upload-order-cancel{border:1px solid #d1d5db;background:#fff;color:#475569}
      #${PANEL_ID} .pdf-upload-order-confirm{border:1px solid #2563eb;background:#2563eb;color:#fff}
      #${PANEL_ID}[data-busy="1"]{opacity:.62;pointer-events:none}
    `;
    document.head.appendChild(style);
  }

  function quickButton(label,mode){
    const button=document.createElement('button');
    button.type='button';
    button.dataset.quickUploadMode=mode;
    button.textContent=label;
    button.addEventListener('click',event=>{
      event.preventDefault();
      event.stopPropagation();
      writeUploadMode(hasExistingPages()?mode:'new');
      window.__pdfUploadOrderRequestedMode=mode;
      const input=document.getElementById('fileInput');
      if(input){try{input.value='';}catch(_){}input.click();return;}
      document.getElementById('uploadZone')?.click();
    });
    return button;
  }

  function upgradeQuickAddBar(){
    const bar=document.getElementById(QUICK_BAR_ID);
    if(!bar||bar.dataset.uploadOrderUpgraded==='1')return false;
    bar.replaceChildren(
      quickButton('＋ 연속 추가','cont'),
      quickButton('＋ 새 묶음 추가','break')
    );
    bar.dataset.uploadOrderUpgraded='1';
    bar.setAttribute('aria-label','PDF 빠른 추가 · 연속 또는 새 묶음');
    return true;
  }

  function renderPending(){
    installStyles();
    let panel=document.getElementById(PANEL_ID);
    if(!pending||!pending.files.length){panel?.remove();return null;}
    if(!panel){
      panel=document.createElement('div');
      panel.id=PANEL_ID;
      const uploadBody=document.getElementById('sb-upload');
      if(!uploadBody)return null;
      uploadBody.appendChild(panel);
    }
    panel.dataset.mode=pending.mode;
    panel.dataset.busy=pending.busy?'1':'0';
    panel.innerHTML='';

    const head=document.createElement('div');
    head.className='pdf-upload-order-head';
    const title=document.createElement('strong');
    title.textContent=`선택한 PDF ${pending.files.length}개 · 처리 순서`;
    const badge=document.createElement('span');
    badge.className='pdf-upload-order-mode';
    badge.textContent=modeLabel(pending.mode);
    head.append(title,badge);

    const note=document.createElement('div');
    note.className='pdf-upload-order-note';
    note.textContent='마우스로 파일을 끌어 순서를 바꾸거나 ↑ ↓ 버튼을 사용할 수 있습니다. 확정한 순서대로 PDF를 처리합니다.';

    const list=document.createElement('div');
    list.className='pdf-upload-order-list';
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
      const up=document.createElement('button');up.type='button';up.textContent='↑';up.title='위로';up.disabled=index===0;up.addEventListener('click',()=>movePending(index,index-1));
      const down=document.createElement('button');down.type='button';down.textContent='↓';down.title='아래로';down.disabled=index===pending.files.length-1;down.addEventListener('click',()=>movePending(index,index+1));
      const remove=document.createElement('button');remove.type='button';remove.textContent='×';remove.title='목록에서 제거';remove.dataset.remove='1';remove.addEventListener('click',()=>removePending(index));
      actions.append(up,down,remove);
      row.append(order,copy,actions);
      row.addEventListener('dragstart',event=>{dragIndex=index;try{event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',String(index));}catch(_){};});
      row.addEventListener('dragover',event=>{event.preventDefault();row.classList.add('drag-over');});
      row.addEventListener('dragleave',()=>row.classList.remove('drag-over'));
      row.addEventListener('drop',event=>{event.preventDefault();row.classList.remove('drag-over');const from=dragIndex>=0?dragIndex:Number(event.dataTransfer?.getData('text/plain'));dragIndex=-1;movePending(from,index);});
      row.addEventListener('dragend',()=>{dragIndex=-1;document.querySelectorAll(`#${PANEL_ID} .drag-over`).forEach(node=>node.classList.remove('drag-over'));});
      list.appendChild(row);
    });

    const footer=document.createElement('div');footer.className='pdf-upload-order-footer';
    const cancel=document.createElement('button');cancel.type='button';cancel.className='pdf-upload-order-cancel';cancel.textContent='취소';cancel.addEventListener('click',clearPending);
    const confirm=document.createElement('button');confirm.type='button';confirm.className='pdf-upload-order-confirm';confirm.textContent='이 순서로 추가';confirm.addEventListener('click',()=>processPending());
    footer.append(cancel,confirm);
    panel.append(head,note,list,footer);
    return panel;
  }

  function movePending(from,to){
    if(!pending||pending.busy)return false;
    const a=Number(from),b=Number(to);
    if(!Number.isInteger(a)||!Number.isInteger(b)||a<0||b<0||a>=pending.files.length||b>=pending.files.length||a===b)return false;
    const [file]=pending.files.splice(a,1);pending.files.splice(b,0,file);renderPending();return true;
  }

  function removePending(index){
    if(!pending||pending.busy)return false;
    const value=Number(index);if(!Number.isInteger(value)||value<0||value>=pending.files.length)return false;
    pending.files.splice(value,1);if(!pending.files.length){clearPending();return true;}renderPending();return true;
  }

  function clearPending(){
    if(pending?.busy)return false;
    pending=null;document.getElementById(PANEL_ID)?.remove();return true;
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
    window.__pdfUploadOrderRequestedMode='';
    return true;
  }

  async function processPending(){
    if(!pending||pending.busy||!pending.files.length)return false;
    pending.busy=true;renderPending();
    const files=[...pending.files],mode=pending.mode;
    try{
      await processFiles(files,mode);
      pending=null;document.getElementById(PANEL_ID)?.remove();
      return true;
    }catch(error){
      console.error('[pdf-upload-order] ordered upload failed',error);
      if(typeof showStatus==='function')showStatus(`파일 추가 실패: ${error.message||error}`,'error');
      if(pending){pending.busy=false;renderPending();}
      return false;
    }
  }

  function stageFiles(files,mode){
    const selected=pdfFiles(files);if(!selected.length)return false;
    const normalized=['new','cont','break'].includes(mode)?mode:readUploadMode();
    if(selected.length===1){processFiles(selected,normalized);return true;}
    pending={files:[...selected],mode:normalized,busy:false};renderPending();return true;
  }

  function requestedMode(){
    const requested=window.__pdfUploadOrderRequestedMode;
    if(requested==='cont'||requested==='break')return requested;
    return readUploadMode();
  }

  function onFileInputChange(event){
    const selected=pdfFiles(event.target?.files);
    if(selected.length<2){window.__pdfUploadOrderRequestedMode='';return;}
    event.preventDefault();event.stopImmediatePropagation();
    try{event.target.value='';}catch(_){}
    stageFiles(selected,requestedMode());
    window.__pdfUploadOrderRequestedMode='';
  }

  function onUploadDrop(event){
    const selected=pdfFiles(event.dataTransfer?.files);
    if(selected.length<2)return;
    event.preventDefault();event.stopImmediatePropagation();
    document.getElementById('uploadZone')?.classList.remove('drag-over');
    stageFiles(selected,requestedMode());
    window.__pdfUploadOrderRequestedMode='';
  }

  function bindUploadCapture(){
    const input=document.getElementById('fileInput');
    if(input&&input.dataset.uploadOrderCapture!=='1'){
      input.dataset.uploadOrderCapture='1';
      input.addEventListener('change',onFileInputChange,true);
    }
    const zone=document.getElementById('uploadZone');
    if(zone&&zone.dataset.uploadOrderCapture!=='1'){
      zone.dataset.uploadOrderCapture='1';
      zone.addEventListener('drop',onUploadDrop,true);
    }
  }

  function sync(){
    installStyles();
    bindUploadCapture();
    upgradeQuickAddBar();
  }

  function boot(){
    sync();
    if(typeof MutationObserver==='function'){
      observer=new MutationObserver(()=>sync());
      observer.observe(document.body,{childList:true,subtree:true});
    }
    [80,220,600,1200].forEach(delay=>setTimeout(sync,delay));
  }

  window.PdfUploadOrderUi={
    stageFiles,
    processPending,
    processFiles,
    movePending,
    removePending,
    clearPending,
    upgradeQuickAddBar,
    sync,
    get pending(){return pending?{mode:pending.mode,busy:pending.busy,files:[...pending.files]}:null;},
    stage:'pdf-upload-order-ui-v1'
  };

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
