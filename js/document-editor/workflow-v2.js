// Guided UX layer for the document editor. Reuses the existing editor/save/print APIs.
(function(){
  'use strict';
  if(window.__documentEditorWorkflowV2)return;
  window.__documentEditorWorkflowV2=true;

  const path=(location.pathname||'/').replace(/\/+$/,'')||'/';
  if(!(path==='/document-editor'||path==='/document-editor/index.html'||path.endsWith('/document-editor/index.html')))return;

  const $=id=>document.getElementById(id);
  const PANEL_ID='documentEditorWorkflowV2';
  const STATUS_ID='documentWorkflowStatusV2';
  const DOCK_ID='documentWorkflowOutputV2';
  let activeStep='start';
  let syncQueued=false;
  let observer=null;

  function installStyles(){
    if($('documentEditorWorkflowV2Styles'))return;
    const style=document.createElement('style');
    style.id='documentEditorWorkflowV2Styles';
    style.textContent=`
      .document-workflow-v2{order:-30;border:1px solid #d6e3ef!important;background:linear-gradient(180deg,#fbfdff,#f4f8fc)!important;padding:14px!important}
      .document-workflow-kicker{font-size:11px;font-weight:900;letter-spacing:.08em;color:#1769e0}.document-workflow-title{margin-top:3px;font-size:15px;font-weight:900;color:#17324f}.document-workflow-note{margin-top:4px;font-size:12px;line-height:1.5;color:#68788c}
      .document-workflow-steps{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;margin-top:11px}.document-workflow-step{position:relative;min-height:60px;border:1px solid #dbe4ed;border-radius:10px;background:#fff;color:#596a7f;padding:8px 7px;text-align:left;cursor:pointer}.document-workflow-step:hover{border-color:#9ab8d6;background:#f8fbff}.document-workflow-step.active{border-color:#4e8bc8;background:#eef6ff;color:#154f85;box-shadow:0 0 0 2px rgba(23,105,224,.07)}.document-workflow-step.done{border-color:#aad9ca;background:#f3fbf8;color:#246b57}.document-workflow-step-num{display:block;font-size:10px;font-weight:900;opacity:.65}.document-workflow-step strong{display:block;margin-top:2px;font-size:12px}.document-workflow-step small{display:block;margin-top:2px;font-size:10px;line-height:1.25;opacity:.78}.document-workflow-step.done:after{content:'✓';position:absolute;right:7px;top:6px;font-size:11px;font-weight:900}
      .document-workflow-status{order:-29;border:1px solid #e1e8f0!important;background:#fff!important;padding:11px 12px!important}.document-workflow-status-row{display:flex;align-items:flex-start;gap:8px}.document-workflow-status-copy{flex:1;min-width:0}.document-workflow-status-title{font-size:12px;font-weight:900;color:#334155}.document-workflow-status-note{margin-top:3px;font-size:11px;line-height:1.45;color:#718096}.document-workflow-badge{flex:0 0 auto;border-radius:999px;padding:5px 8px;font-size:10px;font-weight:900;background:#eef4f8;color:#506176}.document-workflow-badge.ok{background:#ecfdf3;color:#067647}.document-workflow-badge.warn{background:#fff7ed;color:#b54708}
      .document-workflow-output{position:sticky;bottom:0;z-index:18;margin-top:4px;border:1px solid #cbd9e7;border-radius:12px;background:rgba(255,255,255,.97);padding:11px;box-shadow:0 -10px 24px rgba(15,39,72,.10);backdrop-filter:blur(10px)}.document-workflow-output strong{display:block;font-size:13px;color:#203c5c}.document-workflow-output span{display:block;margin-top:3px;font-size:11px;line-height:1.4;color:#68788c}.document-workflow-output-actions{display:grid;grid-template-columns:1fr 1.3fr;gap:7px;margin-top:9px}.document-workflow-output button{min-height:38px;border:1px solid #d5e0eb;border-radius:9px;background:#fff;color:#506176;font-weight:850;cursor:pointer}.document-workflow-output button.primary{border-color:#1769e0;background:#1769e0;color:#fff}
      @media(max-width:980px){.document-workflow-steps{grid-template-columns:repeat(2,minmax(0,1fr))}.document-workflow-output{position:relative;bottom:auto}}
    `;
    document.head.appendChild(style);
  }

  function state(){
    try{return window.DocumentEditorApp?.getState?.()||null;}catch(_){return null;}
  }
  function hasContent(current){
    if(!current)return false;
    return Boolean(String(current.text||'').trim()||document.querySelector('#documentPage img,#documentPage table'));
  }
  function draftWarning(){return Boolean($('draftState')?.classList.contains('warn'));}
  function pageLabel(){return String($('pageMeta')?.textContent||'A4 문서').trim();}

  function installPanel(){
    if($(PANEL_ID))return true;
    const sidebar=document.querySelector('.workspace > .sidebar,.sidebar');
    if(!sidebar)return false;
    const panel=document.createElement('section');
    panel.id=PANEL_ID;
    panel.className='panel-card document-workflow-v2';
    panel.setAttribute('aria-label','문서 편집 작업 순서');
    panel.innerHTML=`<div class="document-workflow-kicker">QUICK WORKFLOW</div><div class="document-workflow-title">문서를 순서대로 완성하세요</div><div class="document-workflow-note">양식을 정하고 내용을 작성한 뒤 검토하고, 마지막에 저장·인쇄하면 됩니다.</div><div class="document-workflow-steps" role="navigation" aria-label="문서 작업 단계"><button type="button" class="document-workflow-step active" data-document-step="start"><span class="document-workflow-step-num">STEP 1</span><strong>시작</strong><small>양식·페이지</small></button><button type="button" class="document-workflow-step" data-document-step="write"><span class="document-workflow-step-num">STEP 2</span><strong>작성</strong><small>본문·표·이미지</small></button><button type="button" class="document-workflow-step" data-document-step="review"><span class="document-workflow-step-num">STEP 3</span><strong>검토</strong><small>개요·찾기·메모</small></button><button type="button" class="document-workflow-step" data-document-step="output"><span class="document-workflow-step-num">STEP 4</span><strong>출력</strong><small>저장·PDF</small></button></div>`;
    sidebar.insertBefore(panel,sidebar.firstChild);
    panel.querySelectorAll('[data-document-step]').forEach(button=>button.addEventListener('click',()=>activateStep(button.dataset.documentStep,true)));
    return true;
  }

  function installStatus(){
    if($(STATUS_ID))return true;
    const panel=$(PANEL_ID);if(!panel)return false;
    const card=document.createElement('section');
    card.id=STATUS_ID;card.className='panel-card document-workflow-status';card.setAttribute('aria-live','polite');
    card.innerHTML='<div class="document-workflow-status-row"><div class="document-workflow-status-copy"><div class="document-workflow-status-title"></div><div class="document-workflow-status-note"></div></div><span class="document-workflow-badge"></span></div>';
    panel.insertAdjacentElement('afterend',card);return true;
  }

  function installOutputDock(){
    if($(DOCK_ID))return true;
    const sidebar=document.querySelector('.workspace > .sidebar,.sidebar');if(!sidebar)return false;
    const dock=document.createElement('section');dock.id=DOCK_ID;dock.className='document-workflow-output';dock.dataset.documentStep='output';
    dock.innerHTML='<strong>저장 · PDF 출력</strong><span class="document-workflow-output-summary">현재 문서 상태를 확인하는 중입니다.</span><div class="document-workflow-output-actions"><button type="button" data-document-output="save">지금 저장</button><button type="button" class="primary" data-document-output="print">인쇄 · PDF 저장</button></div>';
    dock.querySelector('[data-document-output="save"]')?.addEventListener('click',()=>{if($('saveNowBtn'))$('saveNowBtn').click();else window.DocumentEditorApp?.saveDraft?.();refresh();});
    dock.querySelector('[data-document-output="print"]')?.addEventListener('click',()=>{if($('printBtn'))$('printBtn').click();else window.DocumentEditorApp?.printDocument?.();});
    sidebar.appendChild(dock);return true;
  }

  function targetFor(step){
    if(step==='start')return document.querySelector('.usability-card')||document.querySelector('.workflow-card');
    if(step==='review')return document.querySelector('.outline-card')||document.querySelector('.comment-card');
    if(step==='output')return $(DOCK_ID);
    return $('documentPage');
  }
  function activateStep(step,userInitiated=false){
    activeStep=['start','write','review','output'].includes(step)?step:'start';
    const target=targetFor(activeStep);
    if(userInitiated&&target){
      if(activeStep==='write')target.focus?.();
      target.scrollIntoView?.({behavior:'smooth',block:'nearest'});
    }
    refresh();
  }

  function sync(){
    const current=state();
    const content=hasContent(current);
    const counts=current?.counts||{words:0,characters:0};
    const warning=draftWarning();
    const saved=String($('draftState')?.textContent||'자동 저장 준비됨').trim();
    const status=$(STATUS_ID),dock=$(DOCK_ID);
    if(status){
      const title=status.querySelector('.document-workflow-status-title');
      const note=status.querySelector('.document-workflow-status-note');
      const badge=status.querySelector('.document-workflow-badge');
      if(title)title.textContent=warning?'저장 상태를 확인하세요.':content?'문서가 자동 저장되고 있습니다.':'새 문서를 작성할 수 있습니다.';
      if(note)note.textContent=`${counts.words||0}단어 · ${counts.characters||0}자 · ${pageLabel()} · ${saved}`;
      if(badge){badge.textContent=warning?'저장 확인':content?'작성 중':'준비';badge.className='document-workflow-badge '+(warning?'warn':content?'ok':'');}
    }
    if(dock){
      const summary=dock.querySelector('.document-workflow-output-summary');
      if(summary)summary.textContent=content?`${counts.characters||0}자 · ${pageLabel()} · ${warning?'저장 확인 필요':'출력 준비 가능'}`:'내용을 작성하면 저장·PDF 출력할 수 있습니다.';
    }
    document.querySelectorAll('#'+PANEL_ID+' [data-document-step]').forEach(button=>{
      const step=button.dataset.documentStep;
      const done=step==='start'?true:step==='write'?content:step==='review'?content&&!warning:false;
      button.classList.toggle('done',done);button.classList.toggle('active',step===activeStep);button.setAttribute('aria-current',step===activeStep?'step':'false');
    });
  }

  function refresh(){syncQueued=false;sync();}
  function queueSync(){
    if(syncQueued)return;syncQueued=true;
    requestAnimationFrame(()=>{syncQueued=false;sync();});
  }
  function bind(){
    if(document.documentElement.dataset.documentWorkflowV2Events==='1')return;
    document.documentElement.dataset.documentWorkflowV2Events='1';
    $('documentPage')?.addEventListener('input',queueSync);$('documentTitle')?.addEventListener('input',queueSync);
    document.querySelector('.sidebar')?.addEventListener('click',queueSync);document.querySelector('.sidebar')?.addEventListener('change',queueSync);
    const nodes=[$('draftState'),$('statusText'),$('pageMeta')].filter(Boolean);
    if(nodes.length){observer=new MutationObserver(queueSync);nodes.forEach(node=>observer.observe(node,{attributes:true,childList:true,subtree:false}));}
  }

  function install(attempt=0){
    installStyles();
    if(!installPanel()){if(attempt<16)setTimeout(()=>install(attempt+1),90+attempt*40);return;}
    installStatus();installOutputDock();bind();refresh();
    window.DocumentEditorWorkflowV2={activateStep,refresh,stage:'document-editor-guided-workflow-v2'};
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>install(),{once:true});else install();
})();