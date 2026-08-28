// Guided UX layer for the image editor. Reuses existing crop/adjust/export APIs and controls.
(function(){
  'use strict';
  if(window.__imageEditorWorkflowV2)return;
  window.__imageEditorWorkflowV2=true;

  const path=(location.pathname||'/').replace(/\/+$/,'')||'/';
  if(!(path==='/image-editor'||path==='/image-editor/index.html'||path.endsWith('/image-editor/index.html')))return;

  const $=id=>document.getElementById(id);
  const PANEL_ID='imageEditorWorkflowV2';
  const STATUS_ID='imageWorkflowStatusV2';
  const SUMMARY_ID='imageOutputSummaryV2';
  let activeStep='open';
  let syncQueued=false;
  let observer=null;

  function installStyles(){
    if($('imageEditorWorkflowV2Styles'))return;
    const style=document.createElement('style');
    style.id='imageEditorWorkflowV2Styles';
    style.textContent=`
      .image-workflow-v2{order:-30;border:1px solid #d6e3ef!important;background:linear-gradient(180deg,#fbfdff,#f4f8fc)!important;padding:14px!important}.image-workflow-kicker{font-size:11px;font-weight:900;letter-spacing:.08em;color:#1769e0}.image-workflow-title{margin-top:3px;font-size:15px;font-weight:900;color:#17324f}.image-workflow-note{margin-top:4px;font-size:12px;line-height:1.5;color:#68788c}
      .image-workflow-steps{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;margin-top:11px}.image-workflow-step{position:relative;min-height:60px;border:1px solid #dbe4ed;border-radius:10px;background:#fff;color:#596a7f;padding:8px 7px;text-align:left;cursor:pointer}.image-workflow-step:hover{border-color:#9ab8d6;background:#f8fbff}.image-workflow-step.active{border-color:#4e8bc8;background:#eef6ff;color:#154f85;box-shadow:0 0 0 2px rgba(23,105,224,.07)}.image-workflow-step.done{border-color:#aad9ca;background:#f3fbf8;color:#246b57}.image-workflow-step-num{display:block;font-size:10px;font-weight:900;opacity:.65}.image-workflow-step strong{display:block;margin-top:2px;font-size:12px}.image-workflow-step small{display:block;margin-top:2px;font-size:10px;line-height:1.25;opacity:.78}.image-workflow-step.done:after{content:'✓';position:absolute;right:7px;top:6px;font-size:11px;font-weight:900}
      .image-workflow-status{order:-29;border:1px solid #e1e8f0!important;background:#fff!important;padding:11px 12px!important}.image-workflow-status-row{display:flex;align-items:flex-start;gap:8px}.image-workflow-status-copy{flex:1;min-width:0}.image-workflow-status-title{font-size:12px;font-weight:900;color:#334155}.image-workflow-status-note{margin-top:3px;font-size:11px;line-height:1.45;color:#718096}.image-workflow-badge{flex:0 0 auto;border-radius:999px;padding:5px 8px;font-size:10px;font-weight:900;background:#eef4f8;color:#506176}.image-workflow-badge.ok{background:#ecfdf3;color:#067647}.image-workflow-badge.warn{background:#fff7ed;color:#b54708}.image-workflow-actions{display:flex;gap:6px;margin-top:8px}.image-workflow-actions button{min-height:34px;border:1px solid #d5e0eb;border-radius:8px;background:#fff;color:#506176;padding:0 9px;font-size:11px;font-weight:850;cursor:pointer}
      .sidebar>.export-card.image-output-dock-v2{position:sticky;bottom:0;z-index:18;margin-top:4px!important;border-color:#cbd9e7!important;background:rgba(255,255,255,.97)!important;box-shadow:0 -10px 24px rgba(15,39,72,.10)!important;backdrop-filter:blur(10px)}.image-output-summary-v2{margin:0 0 9px;padding:9px 10px;border-radius:9px;background:#f3f7fb;color:#536479;font-size:11px;line-height:1.45}.image-output-summary-v2 strong{display:block;color:#203c5c;font-size:12px;margin-bottom:2px}.image-output-summary-v2.ready{background:#eef9f5;color:#3a6c5d}.image-output-summary-v2.ready strong{color:#17634d}
      @media(max-width:980px){.image-workflow-steps{grid-template-columns:repeat(2,minmax(0,1fr))}.sidebar>.export-card.image-output-dock-v2{position:relative;bottom:auto}}
    `;
    document.head.appendChild(style);
  }

  function state(){try{return window.ImageEditorApp?.getState?.()||null;}catch(_){return null;}}
  function cardByTitle(text){return [...document.querySelectorAll('.sidebar .tool-card')].find(card=>String(card.querySelector('.tool-title')?.textContent||'').includes(text))||null;}
  function hasImage(){return Boolean(state()?.loaded);}
  function statusError(){return $('statusText')?.dataset?.type==='error';}

  function installPanel(){
    if($(PANEL_ID))return true;
    const sidebar=document.querySelector('.workspace > .sidebar,.sidebar');if(!sidebar)return false;
    const panel=document.createElement('section');panel.id=PANEL_ID;panel.className='tool-card image-workflow-v2';panel.setAttribute('aria-label','이미지 편집 작업 순서');
    panel.innerHTML=`<div class="image-workflow-kicker">QUICK WORKFLOW</div><div class="image-workflow-title">이미지를 순서대로 편집하세요</div><div class="image-workflow-note">불러오기 → 자르기·크기 → 보정·배경 → 저장 순서로 필요한 도구만 찾아갈 수 있습니다.</div><div class="image-workflow-steps" role="navigation" aria-label="이미지 작업 단계"><button type="button" class="image-workflow-step active" data-image-step="open"><span class="image-workflow-step-num">STEP 1</span><strong>불러오기</strong><small>파일·붙여넣기</small></button><button type="button" class="image-workflow-step" data-image-step="layout"><span class="image-workflow-step-num">STEP 2</span><strong>자르기·크기</strong><small>비율·회전·크기</small></button><button type="button" class="image-workflow-step" data-image-step="finish"><span class="image-workflow-step-num">STEP 3</span><strong>보정·배경</strong><small>색감·배경 제거</small></button><button type="button" class="image-workflow-step" data-image-step="output"><span class="image-workflow-step-num">STEP 4</span><strong>저장</strong><small>형식·품질</small></button></div>`;
    sidebar.insertBefore(panel,sidebar.firstChild);
    panel.querySelectorAll('[data-image-step]').forEach(button=>button.addEventListener('click',()=>activateStep(button.dataset.imageStep,true)));
    return true;
  }

  function installStatus(){
    if($(STATUS_ID))return true;
    const panel=$(PANEL_ID);if(!panel)return false;
    const card=document.createElement('section');card.id=STATUS_ID;card.className='tool-card image-workflow-status';card.setAttribute('aria-live','polite');
    card.innerHTML='<div class="image-workflow-status-row"><div class="image-workflow-status-copy"><div class="image-workflow-status-title"></div><div class="image-workflow-status-note"></div></div><span class="image-workflow-badge"></span></div><div class="image-workflow-actions"><button type="button" data-image-recovery="open">다른 이미지 열기</button><button type="button" data-image-recovery="reset">원본 복원</button></div>';
    card.querySelector('[data-image-recovery="open"]')?.addEventListener('click',()=>$('openBtn')?.click());
    card.querySelector('[data-image-recovery="reset"]')?.addEventListener('click',()=>$('resetBtn')?.click());
    panel.insertAdjacentElement('afterend',card);return true;
  }

  function decorateCards(){
    const mapping=[['이미지','open'],['자르기','layout'],['회전','layout'],['크기 조절','layout'],['기본 보정','finish'],['배경 제거','finish'],['저장 설정','output']];
    mapping.forEach(([title,step])=>{const card=cardByTitle(title);if(card)card.dataset.imageStep=step;});
    const output=cardByTitle('저장 설정');
    if(output){output.classList.add('image-output-dock-v2');if(!$(SUMMARY_ID)){const summary=document.createElement('div');summary.id=SUMMARY_ID;summary.className='image-output-summary-v2';summary.setAttribute('aria-live','polite');output.insertBefore(summary,output.children[1]||null);}}
  }

  function targetFor(step){
    if(step==='open')return cardByTitle('이미지');
    if(step==='layout')return cardByTitle('자르기');
    if(step==='finish')return cardByTitle('기본 보정');
    return cardByTitle('저장 설정');
  }
  function activateStep(step,userInitiated=false){
    activeStep=['open','layout','finish','output'].includes(step)?step:'open';
    const target=targetFor(activeStep);
    if(userInitiated&&target)target.scrollIntoView?.({behavior:'smooth',block:'start'});
    refresh();
  }

  function protectEditableUndo(){
    document.querySelectorAll('input,textarea,select').forEach(node=>{
      if(node.dataset.imageUndoGuard==='1')return;node.dataset.imageUndoGuard='1';
      node.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&String(event.key).toLowerCase()==='z')event.stopPropagation();});
    });
  }

  function sync(){
    const current=state();const loaded=Boolean(current?.loaded);const error=statusError();
    const status=$(STATUS_ID),summary=$(SUMMARY_ID);
    const dimensions=loaded?`${Number(current.width||0).toLocaleString()} × ${Number(current.height||0).toLocaleString()}px`:'이미지 없음';
    const history=Number(current?.historyLength||0);
    if(status){
      const title=status.querySelector('.image-workflow-status-title'),note=status.querySelector('.image-workflow-status-note'),badge=status.querySelector('.image-workflow-badge');
      if(title)title.textContent=error?'편집 상태를 확인하세요.':loaded?'이미지를 편집할 수 있습니다.':'이미지를 불러오면 시작됩니다.';
      if(note)note.textContent=error?String($('statusText')?.textContent||'작업 중 오류가 발생했습니다.').slice(0,160):loaded?`${dimensions} · 작업 ${history}회 · Ctrl+Z 실행취소`:'파일 선택, 드래그 또는 Ctrl+V 붙여넣기를 사용할 수 있습니다.';
      if(badge){badge.textContent=error?'확인 필요':loaded?'편집 중':'준비';badge.className='image-workflow-badge '+(error?'warn':loaded?'ok':'');}
      const reset=status.querySelector('[data-image-recovery="reset"]');if(reset)reset.disabled=!loaded;
    }
    if(summary){
      const format=$('exportFormat')?.selectedOptions?.[0]?.textContent||'PNG';const quality=$('exportQuality')?.value||'';
      summary.classList.toggle('ready',loaded);summary.replaceChildren();
      const strong=document.createElement('strong');strong.textContent=loaded?'저장 준비':'저장 상태';
      const text=document.createElement('span');text.textContent=loaded?`${dimensions} · ${format}${format==='PNG'?'':` · 품질 ${quality}`}`:'이미지를 불러오면 저장 설정을 확인할 수 있습니다.';
      summary.append(strong,text);
    }
    document.querySelectorAll('#'+PANEL_ID+' [data-image-step]').forEach(button=>{
      const step=button.dataset.imageStep;const done=step==='open'?loaded:step==='layout'?loaded&&history>0:step==='finish'?loaded&&!error:false;
      button.classList.toggle('done',done);button.classList.toggle('active',step===activeStep);button.setAttribute('aria-current',step===activeStep?'step':'false');
    });
  }

  function refresh(){syncQueued=false;protectEditableUndo();sync();}
  function queueSync(){if(syncQueued)return;syncQueued=true;requestAnimationFrame(()=>{syncQueued=false;sync();});}
  function bind(){
    if(document.documentElement.dataset.imageWorkflowV2Events==='1')return;document.documentElement.dataset.imageWorkflowV2Events='1';
    document.querySelector('.sidebar')?.addEventListener('click',queueSync);document.querySelector('.sidebar')?.addEventListener('input',queueSync);document.querySelector('.sidebar')?.addEventListener('change',queueSync);
    const nodes=[$('statusText'),$('dimensionText'),$('fileMeta'),$('historyInfoBadge')].filter(Boolean);if(nodes.length){observer=new MutationObserver(queueSync);nodes.forEach(node=>observer.observe(node,{attributes:true,childList:true,subtree:false}));}
  }

  function install(attempt=0){
    installStyles();
    if(!installPanel()){if(attempt<16)setTimeout(()=>install(attempt+1),90+attempt*40);return;}
    installStatus();decorateCards();protectEditableUndo();bind();refresh();
    window.ImageEditorWorkflowV2={activateStep,refresh,stage:'image-editor-guided-workflow-v2'};
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>install(),{once:true});else install();
})();