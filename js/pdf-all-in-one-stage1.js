// PDF utility quick actions + PDF editor print/output positioning.
(function(){
  'use strict';
  if(window.__pdfAllInOneStage2)return;
  window.__pdfAllInOneStage2=true;

  const path=location.pathname.replace(/\/+$/,'')||'/';
  const isUtility=path==='/pdf-preflight'||path==='/pdf-preflight/index.html'||path.endsWith('/pdf-preflight/index.html');
  const isPrint=path==='/pdf-editor'||path==='/pdf-editor/index.html'||path.endsWith('/pdf-editor/index.html')||path.endsWith('/tools/pdf-editor.html');
  if(!isUtility&&!isPrint)return;

  const $=id=>document.getElementById(id);
  const MAX_TOOL_BYTES=20*1024*1024;
  let observer=null;
  let installed=false;
  let localBusy=false;

  function setText(node,value){if(node&&node.textContent!==value)node.textContent=value;}

  function activeFile(){
    const utility=window.PdfUtility;
    if(utility?.state?.files?.length){
      const index=Math.max(0,Math.min(utility.state.files.length-1,Number(utility.state.activeIndex)||0));
      return utility.state.files[index]||null;
    }
    return window.selectedFile||null;
  }

  function showError(message){if(typeof window.showError==='function')window.showError(message);else alert(message);}
  function showStatus(message,type='info'){if(typeof window.showCheckStatus==='function')window.showCheckStatus(message,type);}
  function safeBaseName(file){return String(file?.name||'document.pdf').replace(/\.pdf$/i,'').replace(/[\\/:*?"<>|]+/g,'_').slice(0,80)||'document';}
  function downloadBlob(blob,name){
    const url=URL.createObjectURL(blob);
    const link=document.createElement('a');
    link.href=url;
    link.download=name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1500);
  }

  // Only the PDF editor still uses this module for persistent route branding.
  // PDF inspection/utility presentation is owned by pdf-preflight-panel-balance.js.
  function applyPrintBranding(){
    if(!isPrint)return false;
    if(document.title!=='인쇄·출력 도구 · Program Studio')document.title='인쇄·출력 도구 · Program Studio';
    const title=document.querySelector('.app > aside > h1');
    setText(title,'인쇄·출력 도구');
    const sub=document.querySelector('.app > aside > .sub');
    setText(sub,'N-up · 소책자 · 페이지 편집 · 간지 · 머리말/꼬리말 · 워터마크 · 인쇄용 PDF 저장');
    document.documentElement.dataset.printOutputStage='subscription-alternative-stage1';
    return Boolean(title);
  }

  function installStyles(){
    if($('pdfAllInOneStage1Styles'))return;
    const style=document.createElement('style');
    style.id='pdfAllInOneStage1Styles';
    style.textContent=`
      .pdfaio-overlay{display:none;position:fixed;inset:0;z-index:1600;background:rgba(15,23,42,.62);backdrop-filter:blur(4px);align-items:center;justify-content:center;padding:18px}.pdfaio-overlay.open{display:flex}
      .pdfaio-box{width:min(520px,100%);background:#fff;border-radius:20px;padding:23px;box-shadow:0 30px 90px rgba(0,0,0,.3)}
      .pdfaio-head{display:flex;align-items:center;gap:10px;margin-bottom:8px}.pdfaio-title{flex:1;font-size:19px;font-weight:950}.pdfaio-close{width:34px;height:34px;border:0;border-radius:9px;background:#f1f5f9;font-size:20px;cursor:pointer}
      .pdfaio-desc{font-size:12px;color:#64748b;line-height:1.6;margin-bottom:14px}.pdfaio-file{padding:9px 11px;border:1px solid #bae6fd;background:#f0fdff;border-radius:10px;color:#0e7490;font-size:11px;font-weight:850;word-break:break-all;margin-bottom:12px}
      .pdfaio-label{display:block;font-size:11px;font-weight:900;color:#374151;margin-bottom:6px}.pdfaio-input{width:100%;border:1.5px solid #d9e2ec;border-radius:10px;padding:11px 12px;font:inherit;font-size:13px;outline:none}.pdfaio-input:focus{border-color:#1d9bb2;box-shadow:0 0 0 3px rgba(29,155,178,.1)}
      .pdfaio-help{margin-top:8px;padding:9px 10px;border:1px solid #e2e8f0;background:#f8fafc;border-radius:9px;color:#64748b;font-size:10px;line-height:1.55}.pdfaio-status{min-height:18px;margin-top:10px;font-size:11px;font-weight:850;color:#2563eb}
      .pdfaio-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:16px}.pdfaio-btn{border-radius:10px;padding:10px 16px;font-size:11px;font-weight:900;cursor:pointer}.pdfaio-cancel{border:1px solid #dbe4ee;background:#f8fafc;color:#475569}.pdfaio-run{border:0;background:linear-gradient(135deg,#12396d,#1d9bb2);color:#fff}.pdfaio-btn:disabled,.pdfaio-close:disabled{opacity:.45;cursor:not-allowed}
      .pdfaio-stage-card .action-chip{white-space:nowrap}
    `;
    document.head.appendChild(style);
  }

  function makeAction(id,icon,name,desc,chip,chipClass,handler){
    if($(id))return $(id);
    const grid=document.querySelector('.action-grid');
    if(!grid)return null;
    const button=document.createElement('button');
    button.type='button';
    button.id=id;
    button.className='action-btn pdfaio-stage-card';
    button.innerHTML=`<span class="action-chip ${chipClass}">${chip}</span><div class="action-icon" style="background:#eef7ff">${icon}</div><div class="action-name">${name}</div><div class="action-desc">${desc}</div>`;
    button.addEventListener('click',handler);
    grid.appendChild(button);
    return button;
  }

  function makeModal(){
    if($('pdfAllInOneOverlay'))return;
    const overlay=document.createElement('div');
    overlay.id='pdfAllInOneOverlay';
    overlay.className='pdfaio-overlay';
    overlay.innerHTML=`<div class="pdfaio-box"><div class="pdfaio-head"><h2 class="pdfaio-title">페이지 추출·나누기</h2><button type="button" class="pdfaio-close" id="pdfaioClose">×</button></div><div class="pdfaio-desc">필요한 페이지만 골라 새 PDF로 저장합니다. 연속 범위와 낱장 페이지를 함께 입력할 수 있습니다.</div><div class="pdfaio-file" id="pdfaioFile"></div><label class="pdfaio-label" for="pdfaioRanges">페이지 범위</label><input class="pdfaio-input" id="pdfaioRanges" type="text" maxlength="4096" placeholder="예: 1-3,5,8-10"><div class="pdfaio-help">예: 1-3,5 → 1·2·3·5페이지만 새 PDF로 저장합니다. 원본 파일은 변경하지 않습니다. 현재 빠른 처리 도구는 20MB 이하 PDF를 지원합니다.</div><div class="pdfaio-status" id="pdfaioStatus"></div><div class="pdfaio-actions"><button type="button" class="pdfaio-btn pdfaio-cancel" id="pdfaioCancel">취소</button><button type="button" class="pdfaio-btn pdfaio-run" id="pdfaioRun">페이지 저장</button></div></div>`;
    document.body.appendChild(overlay);
    const close=()=>{if(!localBusy)overlay.classList.remove('open');};
    $('pdfaioClose').addEventListener('click',close);
    $('pdfaioCancel').addEventListener('click',close);
    overlay.addEventListener('click',event=>{if(event.target===overlay)close();});
    $('pdfaioRun').addEventListener('click',runExtract);
  }

  function syncButtons(){
    if(!isUtility)return;
    const file=activeFile();
    const unavailable=localBusy||Boolean(window.PdfUtility?.state?.busy)||!file;
    const extract=$('pdfAllInOneExtractBtn');
    const blank=$('pdfAllInOneBlankBtn');
    if(extract){extract.disabled=unavailable;extract.title=file&&file.size>MAX_TOOL_BYTES?'페이지 추출은 20MB 이하 PDF를 지원합니다.':'';}
    if(blank){blank.disabled=unavailable;blank.title=file&&file.size>MAX_TOOL_BYTES?'빈 페이지 제거는 20MB 이하 PDF를 지원합니다.':'';}
  }

  function setBusy(busy,label){
    localBusy=busy;
    const utility=window.PdfUtility;
    if(utility?.state){
      utility.state.busy=busy;
      if(typeof utility.selectActive==='function'&&utility.state.files?.length){
        try{utility.selectActive(utility.state.activeIndex||0);}catch(_){}
      }
    }
    if(typeof window.setPageBusy==='function'){
      try{window.setPageBusy(busy,label||'PDF 작업');}catch(_){}
    }
    ['pdfaioRun','pdfaioCancel','pdfaioClose'].forEach(id=>{const el=$(id);if(el)el.disabled=busy;});
    syncButtons();
  }

  function validateFastToolFile(file){
    if(!file)throw new Error('먼저 PDF 파일을 선택하세요.');
    if(Number(file.size||0)>MAX_TOOL_BYTES)throw new Error('페이지 추출·빈 페이지 제거는 현재 20MB 이하 PDF를 지원합니다.');
  }

  function openExtract(){
    const file=activeFile();
    try{validateFastToolFile(file);}catch(error){showError(error.message);return;}
    makeModal();
    setText($('pdfaioFile'),`선택 파일: ${file.name}`);
    setText($('pdfaioStatus'),'');
    $('pdfaioStatus').style.color='#2563eb';
    $('pdfaioRanges').value='';
    $('pdfAllInOneOverlay').classList.add('open');
    setTimeout(()=>$('pdfaioRanges')?.focus(),60);
  }

  async function runExtract(){
    if(localBusy)return;
    const file=activeFile();
    const ranges=String($('pdfaioRanges')?.value||'').trim();
    try{
      validateFastToolFile(file);
      if(!ranges)throw new Error('페이지 범위를 입력하세요. 예: 1-3,5');
      if(!/^[0-9,\-\s]+$/.test(ranges))throw new Error('페이지 범위는 숫자, 쉼표, 하이픈만 사용할 수 있습니다.');
      setBusy(true,'페이지 추출');
      setText($('pdfaioStatus'),'선택한 페이지를 새 PDF로 만드는 중...');
      const {blob}=await window.apiPdfTool('extract',file,{ranges});
      downloadBlob(blob,`${safeBaseName(file)}_페이지_${ranges.replace(/\s+/g,'').replace(/,/g,'_')}.pdf`);
      $('pdfaioStatus').style.color='#15803d';
      setText($('pdfaioStatus'),'페이지 추출이 완료되었습니다.');
      showStatus('필요한 페이지만 새 PDF로 저장했습니다.','ok');
      setTimeout(()=>$('pdfAllInOneOverlay')?.classList.remove('open'),500);
    }catch(error){
      const message=error?.message||'페이지 추출에 실패했습니다.';
      if($('pdfaioStatus')){$('pdfaioStatus').style.color='#dc2626';setText($('pdfaioStatus'),message);}
      showError(message);
    }finally{setBusy(false);}
  }

  async function runRemoveBlank(){
    if(localBusy)return;
    const file=activeFile();
    try{
      validateFastToolFile(file);
      setBusy(true,'빈 페이지 제거');
      showStatus('빈 페이지를 검사하고 제거하는 중입니다.');
      const {blob,meta}=await window.apiPdfTool('remove-blank',file,{});
      downloadBlob(blob,`${safeBaseName(file)}_빈페이지제거.pdf`);
      const removed=Number(meta?.removed||0);
      showStatus(removed?`빈 페이지 ${removed}개를 제거한 PDF를 저장했습니다.`:'빈 페이지가 없어 원본 내용 그대로 정상화해 저장했습니다.','ok');
    }catch(error){
      const message=error?.message||'빈 페이지 제거에 실패했습니다.';
      showError(message);
      showStatus(message,'err');
    }finally{setBusy(false);}
  }

  function observeUtilityState(){
    const list=$('pdfUtilityFileItems');
    if(!list||list.dataset.pdfAllInOneObserved==='1')return;
    list.dataset.pdfAllInOneObserved='1';
    const fileObserver=new MutationObserver(syncButtons);
    fileObserver.observe(list,{childList:true,subtree:true,characterData:true});
  }

  function installUtility(){
    if(!isUtility)return false;
    if(!window.PdfUtility||typeof window.apiPdfTool!=='function'||!document.querySelector('.action-grid'))return false;
    installStyles();
    makeModal();
    makeAction('pdfAllInOneExtractBtn','✂️','페이지 추출·나누기','1-3,5처럼 필요한 페이지만 골라 별도 PDF로 저장합니다.','선택 파일','chip-blue',openExtract);
    makeAction('pdfAllInOneBlankBtn','🧹','빈 페이지 자동 제거','스캔 문서 등에 섞인 빈 페이지를 찾아 제거한 새 PDF를 만듭니다.','선택 파일','chip-green',runRemoveBlank);
    observeUtilityState();
    syncButtons();
    installed=true;
    window.PdfAllInOneStage1={activeFile,openExtract,runExtract,runRemoveBlank,syncButtons,stage:'pdf-utility-quick-actions-v2'};
    return true;
  }

  function startObserver(){
    if(observer||!document.body)return;
    observer=new MutationObserver(()=>{
      if(isPrint)applyPrintBranding();
      if(isUtility&&!installed)installUtility();
      if(isUtility)syncButtons();
    });
    observer.observe(document.body,{subtree:true,childList:true,characterData:true});
  }

  function boot(){
    if(isPrint)applyPrintBranding();
    if(isUtility)installUtility();
    startObserver();
    [80,220,500,900,1500,2400].forEach(delay=>setTimeout(()=>{
      if(isPrint)applyPrintBranding();
      if(isUtility)installUtility();
      if(isUtility)syncButtons();
    },delay));
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();