// Progressive PDF Utility modal flow: upload first, then reveal progress/result beside it.
(function(){
  'use strict';
  if(window.__programStudioPdfUtilityToolModalFlowV1)return;
  window.__programStudioPdfUtilityToolModalFlowV1=true;

  const DROP_SELECTOR='.pdfud-file,.pdfuc-tool-upload,.pdfocr-file,.pdfadv-file,#localDrop,.drop,[data-pdfu-drop-zone]';
  const DIRECT_CARD='.pdfud-card';
  const SERVER_CARD='.pdfuc-server-card';
  const progressStates=new WeakMap();

  function installStyle(){
    if(document.getElementById('pdfUtilityToolModalFlowStyle'))return;
    const style=document.createElement('style');
    style.id='pdfUtilityToolModalFlowStyle';
    style.textContent=`
      .pdfud-card[data-pdfud-modal-flow]{overflow:hidden}
      .pdfud-card[data-pdfud-modal-flow] .pdfud-grid{width:100%;grid-template-columns:minmax(0,720px)!important;justify-content:center!important;transition:grid-template-columns .24s ease,transform .24s ease}
      .pdfud-card[data-pdfud-modal-flow="idle"] .pdfud-result{display:none!important}
      .pdfud-card[data-pdfud-modal-flow="idle"] .pdfud-panel:first-child{width:100%;margin-inline:auto}
      .pdfud-card[data-pdfud-modal-flow="active"] .pdfud-grid{grid-template-columns:minmax(320px,420px) minmax(0,1fr)!important;justify-content:stretch!important}
      .pdfud-card[data-pdfud-modal-flow="active"] .pdfud-result{display:block!important;animation:pdfuResultReveal .22s ease both}
      .pdfud-card[data-pdfud-modal-flow="idle"] .pdfud-panel h3,.pdfud-card[data-pdfud-modal-flow="idle"] .pdfud-copy{display:none!important}
      .pdfud-card[data-pdfud-modal-flow="idle"] .pdfud-file{margin-top:0!important}
      .pdfud-card[data-pdfud-modal-flow="idle"] .pdfud-inline-note{margin-top:11px!important}
      .pdfud-flow-progress{padding:18px;border:1px solid #bfdbfe;border-radius:14px;background:linear-gradient(180deg,#f8fbff,#eff6ff)}
      .pdfud-flow-progress.error{border-color:#fecaca;background:#fef2f2}
      .pdfud-flow-progress strong{display:block;font-size:14px;color:#0f2f59}
      .pdfud-flow-progress p{margin:5px 0 12px;font-size:10px;line-height:1.55;color:#64748b}
      .pdfud-flow-track{height:10px;border-radius:999px;background:#dbeafe;overflow:hidden}
      .pdfud-flow-progress.error .pdfud-flow-track{background:#fee2e2}
      .pdfud-flow-bar{height:100%;width:0;border-radius:inherit;background:linear-gradient(90deg,#2563eb,#0891b2);transition:width .28s ease}
      .pdfud-flow-progress.error .pdfud-flow-bar{background:#dc2626}
      .pdfud-flow-percent{text-align:right;margin-top:6px;font-size:10px;font-weight:900;color:#2563eb}
      .pdfud-flow-progress.error .pdfud-flow-percent{color:#b91c1c}
      .pdfuc-server-card[data-pdfuc-modal-flow]{width:min(1040px,100%)!important;display:grid!important;grid-template-columns:minmax(0,760px)!important;justify-content:center!important;gap:18px!important;transition:grid-template-columns .24s ease}
      .pdfuc-server-card[data-pdfuc-modal-flow="active"]{grid-template-columns:minmax(360px,520px) minmax(0,1fr)!important;justify-content:stretch!important}
      .pdfuc-flow-primary,.pdfuc-flow-feedback{min-width:0}
      .pdfuc-server-card[data-pdfuc-modal-flow="idle"] .pdfuc-flow-feedback{display:none!important}
      .pdfuc-server-card[data-pdfuc-modal-flow="active"] .pdfuc-flow-feedback{display:block!important;animation:pdfuResultReveal .22s ease both}
      .pdfuc-flow-feedback{border:1px solid #e2e8f0;border-radius:14px;background:#fbfdff;padding:16px}
      .pdfuc-flow-feedback .pdfuc-server-progress{margin-top:0!important}
      .pdfuc-flow-feedback .pdfuc-server-result,.pdfuc-flow-feedback .pdfuc-server-error{margin-top:12px!important}
      .pdfud-file.pdfu-drag-active,.pdfuc-tool-upload.pdfu-drag-active,.pdfocr-file.pdfu-drag-active,.pdfadv-file.pdfu-drag-active,#localDrop.pdfu-drag-active,.drop.pdfu-drag-active,[data-pdfu-drop-zone].pdfu-drag-active{border-color:#2563eb!important;background:#eff6ff!important;box-shadow:0 0 0 4px rgba(37,99,235,.10)!important}
      @keyframes pdfuResultReveal{from{opacity:0;transform:translateX(18px)}to{opacity:1;transform:none}}
      @media(max-width:900px){
        .pdfud-card[data-pdfud-modal-flow="active"] .pdfud-grid{grid-template-columns:1fr!important}
        .pdfuc-server-card[data-pdfuc-modal-flow="active"]{grid-template-columns:1fr!important}
      }
    `;
    document.head.appendChild(style);
  }

  function inputForZone(zone){
    if(!zone)return null;
    if(zone.matches?.('input[type="file"]'))return zone;
    const nested=zone.querySelector?.('input[type="file"]');
    if(nested)return nested;
    const linkedId=zone.getAttribute?.('for');
    const linked=linkedId?document.getElementById(linkedId):null;
    if(linked?.matches?.('input[type="file"]'))return linked;
    const scope=zone.closest?.('.pdfud-card,.pdfuc-server-card,#pdfSuiteOcrModal,.pdfadv-overlay,.local-panel,.pdfu-local-controls');
    return scope?.querySelector?.('input[type="file"]')||null;
  }

  function transferFiles(dataTransfer){
    const files=[];
    if(dataTransfer?.items?.length){
      for(const item of dataTransfer.items){
        if(item.kind!=='file')continue;
        const file=item.getAsFile?.();
        if(file)files.push(file);
      }
    }
    if(!files.length&&dataTransfer?.files?.length)files.push(...Array.from(dataTransfer.files));
    return files;
  }

  function assignFiles(input,files){
    if(!input||!files.length)return false;
    const chosen=input.multiple?files:files.slice(0,1);
    try{
      const dt=new DataTransfer();
      chosen.forEach(file=>dt.items.add(file));
      input.files=dt.files;
    }catch(_){
      return false;
    }
    input.dispatchEvent(new Event('change',{bubbles:true}));
    return true;
  }

  function clearDragState(){document.querySelectorAll('.pdfu-drag-active').forEach(node=>node.classList.remove('pdfu-drag-active'));}

  function installDragUpload(){
    const over=event=>{
      const zone=event.target?.closest?.(DROP_SELECTOR);
      if(!zone||!inputForZone(zone))return;
      event.preventDefault();
      try{event.dataTransfer.dropEffect='copy';}catch(_){}
      clearDragState();zone.classList.add('pdfu-drag-active');
    };
    document.addEventListener('dragenter',over,true);
    document.addEventListener('dragover',over,true);
    document.addEventListener('dragleave',event=>{
      const zone=event.target?.closest?.(DROP_SELECTOR);if(!zone)return;
      const next=event.relatedTarget;
      if(next instanceof Node&&zone.contains(next))return;
      zone.classList.remove('pdfu-drag-active');
    },true);
    document.addEventListener('drop',event=>{
      const zone=event.target?.closest?.(DROP_SELECTOR);
      if(!zone)return;
      const input=inputForZone(zone),files=transferFiles(event.dataTransfer);
      if(!input||!files.length)return;
      event.preventDefault();event.stopPropagation();
      clearDragState();
      assignFiles(input,files);
    },true);
    window.addEventListener('dragend',clearDragState,true);
  }

  function toolLabel(root){
    return root?.dataset?.pdfudTool||document.getElementById('pdfUtilityCenteredModalTitle')?.textContent?.trim()||'PDF 작업';
  }

  function stopProgress(root){
    const state=progressStates.get(root);if(!state)return;
    clearInterval(state.timer);state.observer?.disconnect?.();progressStates.delete(root);
  }

  function hasFinalResult(root){
    const panel=root?.querySelector('.pdfud-result');
    if(!panel||panel.querySelector('.pdfud-flow-progress'))return false;
    if(panel.querySelector('.pdfud-score,.pdfud-checks,.pdfud-visual-grid,.pdfud-page'))return true;
    const text=String(panel.textContent||'').trim();
    return Boolean(text&&!/처리 결과와 미리보기가 이곳에 표시됩니다/.test(text));
  }

  function setProgress(root,value,text,error=false){
    const panel=root.querySelector('.pdfud-result');if(!panel||hasFinalResult(root))return;
    let box=panel.querySelector('.pdfud-flow-progress');
    if(!box){
      panel.innerHTML='<div class="pdfud-flow-progress"><strong>작업을 준비하는 중입니다.</strong><p>파일을 확인하고 처리 엔진을 준비합니다.</p><div class="pdfud-flow-track"><div class="pdfud-flow-bar"></div></div><div class="pdfud-flow-percent">0%</div></div>';
      box=panel.querySelector('.pdfud-flow-progress');
    }
    const pct=Math.max(0,Math.min(100,Math.round(Number(value)||0)));
    box.classList.toggle('error',Boolean(error));
    const title=box.querySelector('strong'),copy=box.querySelector('p'),bar=box.querySelector('.pdfud-flow-bar'),percent=box.querySelector('.pdfud-flow-percent');
    if(title)title.textContent=error?'처리 중 문제가 발생했습니다.':pct>=100?'작업이 완료되었습니다.':'처리 중입니다.';
    if(copy&&text)copy.textContent=text;
    if(bar)bar.style.width=`${pct}%`;
    if(percent)percent.textContent=`${pct}%`;
  }

  function startProgress(root){
    stopProgress(root);
    let value=6;
    setProgress(root,value,`${toolLabel(root)} 작업을 시작합니다.`);
    const status=root.querySelector('.pdfud-status');
    const observer=new MutationObserver(()=>{
      if(hasFinalResult(root)){stopProgress(root);return;}
      const text=String(status?.textContent||'').trim();
      const match=text.match(/(\d{1,3})\s*%/);
      if(match){value=Math.max(value,Math.min(96,Number(match[1])));setProgress(root,value,text);}
      else if(/완료|완성/.test(text)){value=100;setProgress(root,100,text);stopProgress(root);}
      else if(status?.classList.contains('error')){setProgress(root,Math.max(value,12),text||'처리 중 오류가 발생했습니다.',true);stopProgress(root);}
      else if(text)setProgress(root,value,text);
    });
    if(status)observer.observe(status,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['class']});
    const timer=setInterval(()=>{
      if(!root.isConnected||hasFinalResult(root)){stopProgress(root);return;}
      value=Math.min(88,value+(value<35?5:value<65?3:1));
      setProgress(root,value,String(status?.textContent||'').trim()||'파일을 처리하고 있습니다.');
    },520);
    progressStates.set(root,{timer,observer});
  }

  function decorateDirect(root){
    if(!root||root.dataset.pdfudModalFlow)return;
    const grid=root.querySelector('.pdfud-grid'),result=root.querySelector('.pdfud-result');
    if(!grid||!result)return;
    root.dataset.pdfudModalFlow='idle';
    result.dataset.pdfudFeedback='1';
  }

  function decorateServer(root){
    if(!root||root.dataset.pdfucModalFlow)return;
    const primary=document.createElement('div'),feedback=document.createElement('div');
    primary.className='pdfuc-flow-primary';feedback.className='pdfuc-flow-feedback';
    [...root.children].forEach(child=>{
      if(child.matches('.pdfuc-server-progress,.pdfuc-server-result,.pdfuc-server-error'))feedback.appendChild(child);else primary.appendChild(child);
    });
    root.replaceChildren(primary,feedback);
    root.dataset.pdfucModalFlow='idle';
  }

  function decorateAll(scope=document){
    scope.querySelectorAll?.(DIRECT_CARD).forEach(decorateDirect);
    scope.querySelectorAll?.(SERVER_CARD).forEach(decorateServer);
    if(scope.matches?.(DIRECT_CARD))decorateDirect(scope);
    if(scope.matches?.(SERVER_CARD))decorateServer(scope);
  }

  function installRevealFlow(){
    document.addEventListener('click',event=>{
      const run=event.target?.closest?.('.pdfud-run');
      if(run&&!run.disabled){
        const root=run.closest(DIRECT_CARD),input=root?.querySelector('input[type="file"]');
        if(root&&(!input||input.files?.length)){
          root.dataset.pdfudModalFlow='active';
          startProgress(root);
        }
      }
      const serverRun=event.target?.closest?.('.pdfuc-server-run');
      if(serverRun&&!serverRun.disabled){
        const root=serverRun.closest(SERVER_CARD);if(root)root.dataset.pdfucModalFlow='active';
      }
    },true);
    const observer=new MutationObserver(records=>records.forEach(record=>record.addedNodes.forEach(node=>{if(node instanceof Element)decorateAll(node);}))); 
    observer.observe(document.documentElement,{childList:true,subtree:true});
    decorateAll(document);
  }

  function install(){
    installStyle();installDragUpload();installRevealFlow();
    document.documentElement.dataset.pdfUtilityToolModalFlow='upload-first-reveal-v1';
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
  window.ProgramStudioPdfUtilityToolModalFlow=Object.freeze({stage:'pdf-utility-tool-modal-flow-v1'});
})();