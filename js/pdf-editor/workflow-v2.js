// PDF editor workflow UX v2.
// Adds a clear file → layout → optional finishing → output flow without replacing editor render functions.
(function(){
  'use strict';
  if(window.__pdfEditorWorkflowV2)return;
  window.__pdfEditorWorkflowV2=true;

  const path=(location.pathname||'/').replace(/\/+$/,'')||'/';
  if(!(path==='/pdf-editor'||path==='/pdf-editor/index.html'||path.endsWith('/pdf-editor/index.html')||path.endsWith('/tools/pdf-editor.html')))return;

  const STYLE_ID='pdfEditorWorkflowV2Styles';
  const PANEL_ID='pdfEditorWorkflowV2';
  const ERROR_ID='pdfEditorWorkflowErrorV2';
  const SUMMARY_ID='pdfOutputSummaryV2';
  const ADVANCED_KEY='program-studio:pdf-editor:advanced';
  const $=id=>document.getElementById(id);
  let attempts=0;
  let activeStep='file';
  let syncQueued=false;
  let stateObserver=null;
  let lastRuntimeFailure='';

  function safeStorageGet(key){
    try{return localStorage.getItem(key);}catch(_){return null;}
  }
  function safeStorageSet(key,value){
    try{localStorage.setItem(key,value);}catch(_){}
  }

  function sectionFor(bodyId){return $(bodyId)?.closest('.sec')||null;}
  function outputSection(){return $('downloadBtn')?.closest('.sec')||null;}
  function isVisible(node){return !!node&&getComputedStyle(node).display!=='none';}
  function hasDocument(){return isVisible($('thumbSection'))||!$('downloadBtn')?.disabled;}
  function pageCount(){
    const text=String($('slideCount')?.textContent||'');
    const match=text.match(/\d+/);
    if(match)return Number(match[0])||0;
    try{return Array.isArray(window.parsedPages)?window.parsedPages.length:0;}catch(_){return 0;}
  }
  function currentNup(){
    const active=document.querySelector('.nup-btn.active[data-nup]');
    const value=Number(active?.dataset?.nup||0);
    return value>0?value:2;
  }
  function paperLabel(){
    const select=$('paperSize');
    const option=select?.options?.[select.selectedIndex];
    return String(option?.textContent||select?.value||'용지 미지정').trim();
  }
  function orientationLabel(){
    return $('orientLand')?.classList.contains('active')?'가로':'세로';
  }
  function advancedFeaturesEnabled(){
    return ['wmEnabled','hfEnabled','pnEnabled'].some(id=>$(id)?.checked);
  }

  function installStyles(){
    if($(STYLE_ID))return;
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      html[data-program-surface="pdf-editor"] .pdf-workflow-v2{margin:10px 0 12px;padding:12px;border:1px solid #d9e4ef;border-radius:14px;background:linear-gradient(180deg,#fbfdff,#f4f8fc);box-shadow:0 5px 16px rgba(15,39,72,.045)}
      html[data-program-surface="pdf-editor"] .pdf-workflow-v2-head{display:flex;align-items:flex-start;gap:9px;margin-bottom:10px}
      html[data-program-surface="pdf-editor"] .pdf-workflow-v2-head>div:first-child{flex:1;min-width:0}
      html[data-program-surface="pdf-editor"] .pdf-workflow-v2-kicker{font-size:9px;font-weight:950;letter-spacing:1px;color:#1769e0}
      html[data-program-surface="pdf-editor"] .pdf-workflow-v2-title{margin-top:3px;font-size:13px;font-weight:950;color:#17324f;letter-spacing:-.2px}
      html[data-program-surface="pdf-editor"] .pdf-workflow-v2-note{margin-top:3px;font-size:9.5px;line-height:1.5;color:#728096}
      html[data-program-surface="pdf-editor"] .pdf-advanced-toggle{flex:0 0 auto;min-height:32px;border:1px solid #d5e0eb;border-radius:9px;background:#fff;color:#506176;padding:0 9px;font-size:9px;font-weight:900;cursor:pointer}
      html[data-program-surface="pdf-editor"] .pdf-advanced-toggle[aria-pressed="true"]{border-color:#7ca8d4;background:#edf5ff;color:#155b99}
      html[data-program-surface="pdf-editor"] .pdf-workflow-steps{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:5px}
      html[data-program-surface="pdf-editor"] .pdf-workflow-step{position:relative;min-width:0;min-height:55px;border:1px solid #dbe4ed;border-radius:10px;background:#fff;color:#596a7f;padding:7px 5px;text-align:left;cursor:pointer}
      html[data-program-surface="pdf-editor"] .pdf-workflow-step:hover{border-color:#9ab8d6;background:#f8fbff}
      html[data-program-surface="pdf-editor"] .pdf-workflow-step.active{border-color:#4e8bc8;background:#eef6ff;color:#154f85;box-shadow:0 0 0 2px rgba(23,105,224,.07)}
      html[data-program-surface="pdf-editor"] .pdf-workflow-step.done{border-color:#aad9ca;background:#f3fbf8;color:#246b57}
      html[data-program-surface="pdf-editor"] .pdf-workflow-step-num{display:block;font-size:8px;font-weight:950;opacity:.65}
      html[data-program-surface="pdf-editor"] .pdf-workflow-step strong{display:block;margin-top:2px;font-size:9.5px;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      html[data-program-surface="pdf-editor"] .pdf-workflow-step small{display:block;margin-top:2px;font-size:7.5px;line-height:1.2;opacity:.74;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      html[data-program-surface="pdf-editor"] .pdf-workflow-step.done:after{content:'✓';position:absolute;right:5px;top:4px;font-size:9px;font-weight:950}
      html[data-program-surface="pdf-editor"] .pdf-workflow-error{display:none;margin:0 0 10px;border:1px solid #fecaca;border-radius:11px;background:#fff7f7;padding:10px;color:#991b1b}
      html[data-program-surface="pdf-editor"] .pdf-workflow-error.show{display:block}
      html[data-program-surface="pdf-editor"] .pdf-workflow-error-head{display:flex;gap:8px;align-items:flex-start}
      html[data-program-surface="pdf-editor"] .pdf-workflow-error-copy{flex:1;min-width:0}
      html[data-program-surface="pdf-editor"] .pdf-workflow-error strong{display:block;font-size:10px;font-weight:950}
      html[data-program-surface="pdf-editor"] .pdf-workflow-error span{display:block;margin-top:3px;font-size:8.5px;line-height:1.45;color:#b42318}
      html[data-program-surface="pdf-editor"] .pdf-workflow-error-actions{display:flex;gap:5px;margin-top:8px}
      html[data-program-surface="pdf-editor"] .pdf-workflow-error button{min-height:30px;border:1px solid #f3b7b7;border-radius:8px;background:#fff;color:#a01d1d;padding:0 9px;font-size:8.5px;font-weight:900;cursor:pointer}
      html[data-program-surface="pdf-editor"] .sec.pdf-step-section{border-top:0;margin-top:7px;padding:0 10px 2px;border:1px solid #e3e9f0;border-radius:12px;background:#fff}
      html[data-program-surface="pdf-editor"] .sec.pdf-step-section>.sec-head{padding-block:9px}
      html[data-program-surface="pdf-editor"] .sec.pdf-step-section[data-pdf-step="file"]{border-color:#d3e4f7}
      html[data-program-surface="pdf-editor"] .sec.pdf-step-section[data-pdf-step="layout"]{border-color:#dce7e9}
      html[data-program-surface="pdf-editor"] .sec.pdf-step-section[data-pdf-step="finish"]{border-color:#e2ddf1}
      html[data-program-surface="pdf-editor"] .sec.pdf-advanced-section{display:none}
      html[data-program-surface="pdf-editor"][data-pdf-advanced="1"] .sec.pdf-advanced-section{display:block}
      html[data-program-surface="pdf-editor"] .sec.pdf-output-dock-v2{position:sticky;bottom:0;z-index:18;margin:10px -4px -8px;padding:10px 10px 12px;border:1px solid #cbd9e7;border-radius:14px 14px 0 0;background:rgba(255,255,255,.97);box-shadow:0 -10px 24px rgba(15,39,72,.10);backdrop-filter:blur(10px)}
      html[data-program-surface="pdf-editor"] .pdf-output-summary-v2{margin:0 0 8px;padding:8px 9px;border-radius:9px;background:#f3f7fb;color:#536479;font-size:8.5px;line-height:1.5}
      html[data-program-surface="pdf-editor"] .pdf-output-summary-v2 strong{display:block;color:#203c5c;font-size:9.5px;margin-bottom:2px}
      html[data-program-surface="pdf-editor"] .pdf-output-summary-v2.ready{background:#eef9f5;color:#3a6c5d}
      html[data-program-surface="pdf-editor"] .pdf-output-summary-v2.ready strong{color:#17634d}
      html[data-program-surface="pdf-editor"] #downloadBtn:not(:disabled){box-shadow:0 8px 18px rgba(15,118,110,.18)}
      html[data-program-surface="pdf-editor"] .thumb-hint{font-size:9px!important;line-height:1.45!important;color:#718096!important}
      html[data-program-surface="pdf-editor"] aside>h1,html[data-program-surface="pdf-editor"] aside>.sub{margin-left:2px;margin-right:2px}
      @media(max-width:900px){
        html[data-program-surface="pdf-editor"] .pdf-workflow-steps{grid-template-columns:repeat(2,minmax(0,1fr))}
        html[data-program-surface="pdf-editor"] .sec.pdf-output-dock-v2{position:relative;bottom:auto;border-radius:12px;margin:8px 0}
      }
    `;
    document.head.appendChild(style);
  }

  function expandSection(section){
    if(!section)return;
    const head=section.querySelector(':scope > .sec-head');
    const body=section.querySelector(':scope > .sec-body');
    if(head?.classList.contains('collapsed'))head.click();
    else if(body?.classList.contains('hidden')){
      head?.classList.remove('collapsed');
      body.classList.remove('hidden');
    }
  }

  function setAdvanced(enabled,persist=true){
    const next=!!enabled;
    document.documentElement.dataset.pdfAdvanced=next?'1':'0';
    const button=document.querySelector('#'+PANEL_ID+' .pdf-advanced-toggle');
    if(button){
      button.setAttribute('aria-pressed',String(next));
      button.textContent=next?'고급 설정 닫기':'고급 설정';
    }
    if(persist)safeStorageSet(ADVANCED_KEY,next?'1':'0');
    if(next)expandSection(sectionFor('sb-edit'));
    queueSync();
  }

  function targetForStep(step){
    if(step==='file')return sectionFor('sb-upload');
    if(step==='layout')return isVisible($('thumbSection'))?$('thumbSection'):sectionFor('sb-nup');
    if(step==='finish')return sectionFor('sb-edit');
    return outputSection();
  }

  function activateStep(step,userInitiated=false){
    activeStep=['file','layout','finish','output'].includes(step)?step:'file';
    if(activeStep==='finish')setAdvanced(true,true);
    const target=targetForStep(activeStep);
    if(userInitiated&&target){
      expandSection(target);
      target.scrollIntoView({behavior:'smooth',block:'start'});
    }
    queueSync();
  }

  function installPanel(){
    if($(PANEL_ID))return true;
    const aside=document.querySelector('.app > aside');
    const upload=sectionFor('sb-upload');
    if(!aside||!upload)return false;

    const panel=document.createElement('section');
    panel.id=PANEL_ID;
    panel.className='pdf-workflow-v2';
    panel.setAttribute('aria-label','PDF 편집 작업 순서');
    panel.innerHTML=`
      <div class="pdf-workflow-v2-head">
        <div><div class="pdf-workflow-v2-kicker">QUICK WORKFLOW</div><div class="pdf-workflow-v2-title">필요한 순서대로 작업하세요</div><div class="pdf-workflow-v2-note">파일을 넣고 배치를 정한 뒤, 필요한 경우만 꾸미기 설정을 열고 PDF로 저장합니다.</div></div>
        <button type="button" class="pdf-advanced-toggle" aria-pressed="false">고급 설정</button>
      </div>
      <div class="pdf-workflow-steps" role="navigation" aria-label="PDF 편집 단계">
        <button type="button" class="pdf-workflow-step active" data-step="file"><span class="pdf-workflow-step-num">STEP 1</span><strong>파일</strong><small>PDF 불러오기</small></button>
        <button type="button" class="pdf-workflow-step" data-step="layout"><span class="pdf-workflow-step-num">STEP 2</span><strong>페이지·배치</strong><small>순서·N-up·용지</small></button>
        <button type="button" class="pdf-workflow-step" data-step="finish"><span class="pdf-workflow-step-num">STEP 3</span><strong>꾸미기</strong><small>선택 사항</small></button>
        <button type="button" class="pdf-workflow-step" data-step="output"><span class="pdf-workflow-step-num">STEP 4</span><strong>출력</strong><small>확인·PDF 저장</small></button>
      </div>`;

    const sub=aside.querySelector(':scope > .sub');
    if(sub?.nextSibling)aside.insertBefore(panel,sub.nextSibling);
    else aside.insertBefore(panel,upload);

    panel.querySelectorAll('[data-step]').forEach(button=>button.addEventListener('click',()=>activateStep(button.dataset.step,true)));
    panel.querySelector('.pdf-advanced-toggle')?.addEventListener('click',()=>{
      setAdvanced(document.documentElement.dataset.pdfAdvanced!=='1',true);
    });
    return true;
  }

  function installErrorBox(){
    if($(ERROR_ID))return true;
    const panel=$(PANEL_ID);
    if(!panel)return false;
    const box=document.createElement('div');
    box.id=ERROR_ID;
    box.className='pdf-workflow-error';
    box.setAttribute('role','alert');
    box.innerHTML=`<div class="pdf-workflow-error-head"><div class="pdf-workflow-error-copy"><strong>일부 기능에서 오류가 발생했습니다.</strong><span class="pdf-workflow-error-detail">작업 내용은 그대로 두고 다시 시도할 수 있습니다.</span></div></div><div class="pdf-workflow-error-actions"><button type="button" data-error-action="preview">미리보기 다시 생성</button><button type="button" data-error-action="reload">페이지 새로고침</button><button type="button" data-error-action="dismiss">닫기</button></div>`;
    panel.insertAdjacentElement('afterend',box);
    box.querySelector('[data-error-action="preview"]')?.addEventListener('click',()=>{
      box.classList.remove('show');
      try{
        if(window.PdfPreviewController?.request)window.PdfPreviewController.request(0,true);
        else $('previewBtn')?.click();
      }catch(error){console.error('[pdf-workflow] preview recovery failed',error);}
    });
    box.querySelector('[data-error-action="reload"]')?.addEventListener('click',()=>location.reload());
    box.querySelector('[data-error-action="dismiss"]')?.addEventListener('click',()=>box.classList.remove('show'));
    return true;
  }

  function showError(detail){
    const box=$(ERROR_ID);
    if(!box)return;
    const safe=String(detail||'작업 중 문제가 발생했습니다. 미리보기를 다시 생성하거나 페이지를 새로고침해 주세요.').slice(0,180);
    const node=box.querySelector('.pdf-workflow-error-detail');
    if(node)node.textContent=safe;
    box.classList.add('show');
  }

  function decorateSections(){
    const mapping=[
      ['sb-upload','file'],
      ['sb-pages','layout'],
      ['sb-nup','layout'],
      ['sb-paper','layout'],
      ['sb-edit','finish']
    ];
    mapping.forEach(([id,step])=>{
      const section=sectionFor(id);
      if(!section)return;
      section.classList.add('pdf-step-section');
      section.dataset.pdfStep=step;
      if(step==='finish')section.classList.add('pdf-advanced-section');
    });
    const output=outputSection();
    if(output){
      output.classList.add('pdf-output-dock-v2');
      output.dataset.pdfStep='output';
    }
    const hint=document.querySelector('#thumbSection .thumb-hint');
    if(hint)hint.textContent='클릭=미리보기 이동 · 우클릭=페이지 메뉴 · 드래그=순서 변경';
  }

  function installOutputSummary(){
    if($(SUMMARY_ID))return true;
    const body=$('downloadBtn')?.closest('.sec')?.querySelector('.sec-body');
    if(!body)return false;
    const summary=document.createElement('div');
    summary.id=SUMMARY_ID;
    summary.className='pdf-output-summary-v2';
    summary.setAttribute('aria-live','polite');
    body.insertBefore(summary,body.firstChild);
    return true;
  }

  function syncSummary(){
    const summary=$(SUMMARY_ID);
    if(!summary)return;
    const ready=hasDocument()&&!$('downloadBtn')?.disabled;
    const pages=pageCount();
    const countText=pages?`${pages}페이지`:(hasDocument()?'페이지 확인 중':'파일 없음');
    const layout=`${paperLabel()} · ${orientationLabel()} · ${currentNup()}장 배치`;
    summary.classList.toggle('ready',ready);
    summary.replaceChildren();
    const strong=document.createElement('strong');
    strong.textContent=ready?'저장 준비 완료':'작업 상태';
    const text=document.createElement('span');
    text.textContent=hasDocument()?`${countText} · ${layout}`:'PDF를 업로드하면 현재 출력 설정을 여기서 확인할 수 있습니다.';
    summary.append(strong,text);
  }

  function syncSteps(){
    const doc=hasDocument();
    const outputReady=doc&&!$('downloadBtn')?.disabled;
    const advanced=advancedFeaturesEnabled();
    if(advanced&&document.documentElement.dataset.pdfAdvanced!=='1')setAdvanced(true,false);

    document.querySelectorAll('#'+PANEL_ID+' .pdf-workflow-step').forEach(button=>{
      const step=button.dataset.step;
      let done=false;
      if(step==='file')done=doc;
      if(step==='layout')done=outputReady;
      if(step==='finish')done=advanced;
      if(step==='output')done=false;
      button.classList.toggle('done',done);
      button.classList.toggle('active',step===activeStep);
      button.setAttribute('aria-current',step===activeStep?'step':'false');
    });
    syncSummary();
  }

  function queueSync(){
    if(syncQueued)return;
    syncQueued=true;
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      syncQueued=false;
      syncSteps();
    }));
  }

  function bindStateEvents(){
    if(document.documentElement.dataset.pdfWorkflowEvents==='1')return;
    document.documentElement.dataset.pdfWorkflowEvents='1';
    const aside=document.querySelector('.app > aside');
    aside?.addEventListener('click',event=>{
      const section=event.target.closest('.sec[data-pdf-step]');
      if(section?.dataset?.pdfStep)activeStep=section.dataset.pdfStep;
      queueSync();
    });
    aside?.addEventListener('input',queueSync);
    aside?.addEventListener('change',queueSync);

    const observed=[$('downloadBtn'),$('thumbSection'),$('slideCount')].filter(Boolean);
    if(observed.length&&!stateObserver){
      stateObserver=new MutationObserver(queueSync);
      observed.forEach(node=>stateObserver.observe(node,{attributes:true,attributeFilter:['disabled','style','class'],childList:true,subtree:false,characterData:false}));
    }
  }

  function bindRuntimeErrors(){
    if(document.documentElement.dataset.pdfWorkflowErrorEvents==='1')return;
    document.documentElement.dataset.pdfWorkflowErrorEvents='1';

    window.addEventListener('programstudio:runtime-script-result',event=>{
      const detail=event.detail||{};
      const src=String(detail.src||'');
      const id=String(detail.id||'');
      if(detail.status==='loaded')return;
      if(!src.includes('/js/pdf')&&!id.toLowerCase().includes('pdf'))return;
      const key=`${id}:${detail.status}`;
      if(key===lastRuntimeFailure)return;
      lastRuntimeFailure=key;
      showError('PDF 기능 모듈을 불러오지 못했습니다. 네트워크 연결을 확인한 뒤 페이지를 새로고침해 주세요.');
    });

    window.addEventListener('error',event=>{
      const filename=String(event.filename||'');
      if(filename&&!filename.includes(location.host)&&!filename.includes('/js/pdf'))return;
      const message=String(event.message||'');
      if(!message)return;
      showError('PDF 편집 중 오류가 감지되었습니다. 현재 작업을 유지한 채 미리보기를 다시 생성해 보세요.');
    });

    window.addEventListener('unhandledrejection',event=>{
      const reason=event.reason;
      const name=String(reason?.name||'');
      const message=String(reason?.message||reason||'');
      if(name==='AbortError'||/abort|cancel|취소/i.test(message))return;
      if(!message)return;
      showError('처리가 완료되지 않은 작업이 있습니다. 미리보기를 다시 생성한 뒤 계속 진행해 주세요.');
    });
  }

  function install(){
    attempts+=1;
    installStyles();
    const panel=installPanel();
    if(!panel){
      if(attempts<20)setTimeout(install,80+attempts*35);
      return false;
    }
    installErrorBox();
    decorateSections();
    installOutputSummary();
    const savedAdvanced=safeStorageGet(ADVANCED_KEY)==='1'||advancedFeaturesEnabled();
    setAdvanced(savedAdvanced,false);
    bindStateEvents();
    bindRuntimeErrors();
    queueSync();

    window.PdfEditorWorkflowV2={
      activateStep,
      setAdvanced,
      showError,
      refresh:queueSync,
      stage:'pdf-editor-guided-workflow-v2'
    };
    return true;
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();
})();
