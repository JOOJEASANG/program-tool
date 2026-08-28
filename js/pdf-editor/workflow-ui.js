// Result-first workflow UI for the PDF editor.
(function(){
  'use strict';
  if(window.__pdfEditorWorkflowUiV1)return;
  window.__pdfEditorWorkflowUiV1=true;
  const path=(location.pathname||'/').replace(/\/+$/,'')||'/';
  if(path!=='/pdf-editor'&&path!=='/pdf-editor/index.html'&&!path.endsWith('/pdf-editor/index.html'))return;

  const byId=id=>document.getElementById(id);
  let frame=0;
  let observer=null;
  let initialStateApplied=false;

  function pages(){try{return Array.isArray(parsedPages)?parsedPages:[]}catch(_){return []}}
  function files(){try{return Array.isArray(uploadedFiles)?uploadedFiles:[]}catch(_){return []}}
  function activePages(){return pages().filter(page=>!page.excluded)}
  function currentNup(){
    try{if(Number.isFinite(Number(nup)))return Number(nup)}catch(_){}
    const active=document.querySelector('.nup-btn.active,[data-nup].active');
    const match=String(active?.dataset?.nup||active?.textContent||'').match(/\d+/);
    return match?Number(match[0]):1;
  }

  function installStyles(){
    if(byId('pdfWorkflowUiStyles'))return;
    const style=document.createElement('style');style.id='pdfWorkflowUiStyles';style.textContent=`
      body[data-pdf-workflow="guided"]{--workflow-navy:#173f70;--workflow-line:#dbe4ec;--workflow-muted:#6b7889;--workflow-bg:#eef2f5}
      body[data-pdf-workflow="guided"] .app{grid-template-columns:342px minmax(0,1fr)!important;background:var(--workflow-bg)!important}
      body[data-pdf-workflow="guided"] aside{padding:12px!important;background:#f7f9fb!important;border-right:1px solid var(--workflow-line)!important;scrollbar-gutter:stable}
      body[data-pdf-workflow="guided"] aside>h1{font-size:15px!important;color:#17324f!important;margin:2px 2px 3px!important}
      body[data-pdf-workflow="guided"] aside>.sub{font-size:10px!important;line-height:1.5!important;margin:0 2px 12px!important;color:#748194!important}
      body[data-pdf-workflow="guided"] .sec{margin:0 0 8px;border:1px solid #dde5ed!important;border-radius:11px;background:#fff;overflow:hidden;box-shadow:0 1px 2px rgba(15,23,42,.025)}
      body[data-pdf-workflow="guided"] .sec-head{padding:10px 11px!important;background:#fff}.sec-head .sec-title{font-size:10.5px!important;color:#35475b!important;letter-spacing:0!important;text-transform:none!important}.sec-head .sec-arrow{font-size:9px!important}
      body[data-pdf-workflow="guided"] .sec-body{padding:0 11px 11px!important}.sec-head.collapsed+.sec-body{padding-bottom:0!important}
      body[data-pdf-workflow="guided"] label{font-size:10px!important}.upload-zone{border-width:1.5px!important;border-color:#9fc0dc!important;background:#f5faff!important}.upload-zone .upload-text{font-size:11.5px!important}.upload-zone .upload-sub{font-size:9px!important}
      body[data-pdf-workflow="guided"] .btn{min-height:38px;font-size:11px!important}.btn-green{background:#147a61!important}.btn-primary{background:#173f70!important}
      body[data-pdf-workflow="guided"] main{padding:12px!important;gap:8px!important;background:#e9eef2!important}
      body[data-pdf-workflow="guided"] .preview-shell{border:1px solid #d7e0e8;border-radius:12px;overflow:hidden;background:#fff;box-shadow:0 8px 28px rgba(15,23,42,.065)}
      body[data-pdf-workflow="guided"] .preview-info{min-height:42px;padding:7px 10px!important;border-bottom:1px solid #e3e9ef;background:#fbfcfd}
      .pdf-workflow-head{margin:0 0 10px;padding:11px;border:1px solid #d9e3ec;border-radius:12px;background:linear-gradient(180deg,#fff,#f7fafc);box-shadow:0 4px 14px rgba(15,23,42,.035)}
      .pdf-workflow-head-title{display:flex;align-items:center;gap:7px;color:#17324f;font-size:11px;font-weight:950}.pdf-workflow-head-title span{width:23px;height:23px;border-radius:7px;background:#eaf4fb;color:#17628a;display:grid;place-items:center;font-size:11px}.pdf-workflow-head-sub{margin:4px 0 8px;color:#718094;font-size:8.5px;line-height:1.45}
      .pdf-workflow-steps{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:4px}.pdf-workflow-step{min-width:0;height:30px;border:1px solid #dce5ed;border-radius:7px;background:#fff;color:#647488;font:850 8px Pretendard,"Noto Sans KR",sans-serif;cursor:pointer;padding:0 3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.pdf-workflow-step:hover{border-color:#94b6cf;background:#f5faff;color:#24567b}.pdf-workflow-step.on{border-color:#8fcdbd;background:#eefaf6;color:#116a56}.pdf-workflow-step b{margin-right:2px;color:#284e6d}
      .pdf-workflow-summary{display:flex;gap:5px;flex-wrap:wrap;margin-top:8px}.pdf-workflow-chip{display:inline-flex;align-items:center;min-height:22px;border-radius:999px;background:#eef3f7;color:#56687b;padding:3px 7px;font-size:8px;font-weight:850}.pdf-workflow-chip strong{color:#173f70;margin-right:3px}
      .pdf-result-bar{display:flex;align-items:center;gap:7px;padding:8px 9px;border:1px solid #d5dee7;border-radius:11px;background:rgba(255,255,255,.97);box-shadow:0 6px 20px rgba(15,23,42,.07);z-index:20}.pdf-result-title{min-width:0;margin-right:auto}.pdf-result-title strong{display:block;color:#213b56;font-size:10px}.pdf-result-title small{display:block;margin-top:2px;color:#748296;font-size:8px}.pdf-result-action{height:34px;border:1px solid #cbd7e2;border-radius:8px;background:#fff;color:#40566d;padding:0 10px;font:900 9.5px Pretendard,"Noto Sans KR",sans-serif;cursor:pointer;white-space:nowrap}.pdf-result-action:hover{border-color:#8eabc3;background:#f5f8fb}.pdf-result-action.primary{border-color:#173f70;background:#173f70;color:#fff}.pdf-result-action.save{border-color:#147a61;background:#147a61;color:#fff}.pdf-result-action:disabled{opacity:.42;cursor:not-allowed}
      .pdf-workflow-output-sec{border-color:#b8d8ce!important;box-shadow:0 4px 14px rgba(20,122,97,.055)!important}.pdf-workflow-output-sec>.sec-head{background:#f5fbf8!important}.pdf-workflow-output-sec .sec-title{color:#12624f!important}
      @media(max-width:1050px){body[data-pdf-workflow="guided"] .app{grid-template-columns:316px minmax(0,1fr)!important}.pdf-result-title{display:none}}
      @media(max-width:900px){body[data-pdf-workflow="guided"] .app{grid-template-columns:1fr!important}.pdf-workflow-head{position:relative}.pdf-result-bar{position:sticky;top:0}.pdf-workflow-steps{grid-template-columns:repeat(5,minmax(54px,1fr))}}
      @media(max-width:560px){.pdf-workflow-steps{overflow-x:auto;grid-template-columns:repeat(5,82px)}.pdf-result-bar{gap:4px;padding:6px}.pdf-result-action{flex:1;padding:0 5px;font-size:9px}.pdf-result-action[data-action="add"]{display:none}}
    `;document.head.appendChild(style);
  }

  function sectionByKey(key){return document.querySelector(`.sec-head[data-sec="${key}"]`)?.closest('.sec')||null}
  function outputSection(){return byId('downloadBtn')?.closest('.sec')||null}
  function renameSections(){
    const labels={upload:'1 · PDF 파일',pages:'2 · 페이지 정리',nup:'3 · 인쇄 배치',paper:'4 · 용지 · 여백',edit:'선택 · 문서 꾸미기'};
    Object.entries(labels).forEach(([key,label])=>{const title=sectionByKey(key)?.querySelector('.sec-title');if(title)title.textContent=label;});
    const output=outputSection();if(output){output.classList.add('pdf-workflow-output-sec');output.dataset.workflowSection='output';const title=output.querySelector('.sec-title');if(title)title.textContent='5 · 결과 저장';}
  }

  function ensureHeader(){
    if(byId('pdfWorkflowHead'))return byId('pdfWorkflowHead');
    const aside=document.querySelector('.app>aside');const firstSec=aside?.querySelector('.sec');if(!aside||!firstSec)return null;
    const head=document.createElement('section');head.id='pdfWorkflowHead';head.className='pdf-workflow-head';head.innerHTML=`<div class="pdf-workflow-head-title"><span>↗</span>PDF 작업 순서</div><div class="pdf-workflow-head-sub">파일을 추가한 뒤 페이지와 배치만 확인하고 저장하면 됩니다. 고급 문서 꾸미기는 필요할 때만 펼치세요.</div><div class="pdf-workflow-steps"><button type="button" class="pdf-workflow-step" data-step="upload"><b>1</b>파일</button><button type="button" class="pdf-workflow-step" data-step="pages"><b>2</b>페이지</button><button type="button" class="pdf-workflow-step" data-step="nup"><b>3</b>배치</button><button type="button" class="pdf-workflow-step" data-step="paper"><b>4</b>용지</button><button type="button" class="pdf-workflow-step" data-step="output"><b>5</b>저장</button></div><div class="pdf-workflow-summary"><span class="pdf-workflow-chip" data-summary="files"><strong>파일</strong>0</span><span class="pdf-workflow-chip" data-summary="pages"><strong>페이지</strong>0</span><span class="pdf-workflow-chip" data-summary="nup"><strong>배치</strong>1-up</span></div>`;
    head.addEventListener('click',event=>{const key=event.target.closest('[data-step]')?.dataset.step;if(!key)return;const sec=key==='output'?outputSection():sectionByKey(key);if(sec){openSection(sec);sec.scrollIntoView({behavior:'smooth',block:'nearest'});}});
    firstSec.insertAdjacentElement('beforebegin',head);return head;
  }

  function ensureResultBar(){
    if(byId('pdfResultBar'))return byId('pdfResultBar');
    const main=document.querySelector('.app>main');const preview=main?.querySelector('.preview-shell');if(!main||!preview)return null;
    const bar=document.createElement('div');bar.id='pdfResultBar';bar.className='pdf-result-bar';bar.innerHTML='<div class="pdf-result-title"><strong>출력 결과</strong><small id="pdfResultSummary">PDF를 추가하면 결과가 자동 미리보기됩니다.</small></div><button type="button" class="pdf-result-action" data-action="add">PDF 더 추가</button><button type="button" class="pdf-result-action primary" data-action="preview">미리보기 갱신</button><button type="button" class="pdf-result-action save" data-action="save">PDF 저장</button>';
    bar.addEventListener('click',event=>{const action=event.target.closest('[data-action]')?.dataset.action;if(action==='add')byId('uploadZone')?.click();else if(action==='preview')byId('previewBtn')?.click();else if(action==='save')byId('downloadBtn')?.click();});
    preview.insertAdjacentElement('beforebegin',bar);return bar;
  }

  function openSection(sec){
    const head=sec?.querySelector('.sec-head');const body=sec?.querySelector('.sec-body');if(!head||!body)return false;
    head.classList.remove('collapsed');body.classList.remove('hidden');return true;
  }
  function closeSection(sec){
    const head=sec?.querySelector('.sec-head');const body=sec?.querySelector('.sec-body');if(!head||!body)return false;
    head.classList.add('collapsed');body.classList.add('hidden');return true;
  }

  function applyInitialState(){
    if(initialStateApplied)return;
    const ready=pages().length>0;
    openSection(sectionByKey('upload'));
    if(ready){openSection(sectionByKey('pages'));openSection(sectionByKey('nup'));openSection(sectionByKey('paper'));closeSection(sectionByKey('edit'));}
    else{closeSection(sectionByKey('edit'));}
    initialStateApplied=true;
  }

  function markTouchedSections(){
    document.querySelectorAll('.sec-head').forEach(head=>{
      if(head.dataset.workflowTouchBound==='1')return;head.dataset.workflowTouchBound='1';
      head.addEventListener('click',()=>{head.closest('.sec')?.setAttribute('data-user-touched','1');});
    });
  }

  function syncSummary(){
    const fileCount=files().length,pageCount=pages().length,visible=activePages().length,nupValue=currentNup();
    const head=ensureHeader();
    const set=(key,value)=>{const node=head?.querySelector(`[data-summary="${key}"]`);if(node){const strong=node.querySelector('strong')?.outerHTML||'';node.innerHTML=strong+value;}};
    set('files',String(fileCount));set('pages',pageCount?`${visible}/${pageCount}`:'0');set('nup',`${nupValue}-up`);
    head?.querySelectorAll('[data-step]').forEach(button=>button.classList.toggle('on',fileCount?button.dataset.step!=='upload':button.dataset.step==='upload'));
    const summary=byId('pdfResultSummary');if(summary)summary.textContent=fileCount?`파일 ${fileCount}개 · 사용 ${visible}쪽 · ${nupValue}-up 배치`:'PDF를 추가하면 결과가 자동 미리보기됩니다.';
    const bar=ensureResultBar();const originalPreview=byId('previewBtn'),originalSave=byId('downloadBtn');
    const quickPreview=bar?.querySelector('[data-action="preview"]'),quickSave=bar?.querySelector('[data-action="save"]');
    if(quickPreview)quickPreview.disabled=!originalPreview||originalPreview.disabled;if(quickSave)quickSave.disabled=!originalSave||originalSave.disabled;
  }

  function sync(){
    installStyles();document.body.dataset.pdfWorkflow='guided';renameSections();ensureHeader();ensureResultBar();markTouchedSections();applyInitialState();syncSummary();
    document.documentElement.dataset.pdfWorkflowUi='1';
  }
  function queueSync(){if(frame)return;frame=requestAnimationFrame(()=>{frame=0;sync();});}
  function boot(){
    sync();
    const root=document.querySelector('.app')||document.body;
    if(typeof MutationObserver==='function'){observer=new MutationObserver(queueSync);observer.observe(root,{childList:true,subtree:true,attributes:true,attributeFilter:['disabled','class','style']});}
    document.addEventListener('change',queueSync,true);document.addEventListener('click',()=>setTimeout(queueSync,0),true);
    [120,320,700,1400].forEach(delay=>setTimeout(queueSync,delay));
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  window.PdfEditorWorkflowUi={sync,stage:'guided-file-page-layout-paper-output-v1'};
})();
