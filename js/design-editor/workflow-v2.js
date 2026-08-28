// Design editor guided workflow v2.
// Adds navigation and readiness summaries without replacing canvas/render/export functions.
(function(){
  'use strict';
  if(window.__designEditorWorkflowV2)return;
  window.__designEditorWorkflowV2=true;

  const path=(location.pathname||'/').replace(/\/+$/,'')||'/';
  const isGeneral=path==='/design-editor/general'||path==='/design-editor/general.html'||path.endsWith('/design-editor/general.html');
  if(!isGeneral)return;

  const PANEL_ID='designEditorWorkflowV2';
  const STATUS_ID='designWorkflowStatusV2';
  const STYLE_ID='designEditorWorkflowV2Styles';
  let attempts=0;
  let activeStep='compose';
  let syncFrame=0;
  let sidebarObserver=null;
  let statusObserver=null;

  const byId=id=>document.getElementById(id);
  const project=()=>window.DesignEditorApp?.project||null;

  function installStyles(){
    if(byId(STYLE_ID))return;
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      .design-workflow-v2{order:-20!important;border:1px solid #d6e3ef!important;background:linear-gradient(180deg,#fbfdff,#f4f8fc)!important;padding:12px!important;box-shadow:0 6px 18px rgba(15,39,72,.05)}
      .design-workflow-kicker{font-size:8px;font-weight:950;letter-spacing:1px;color:#1769e0}.design-workflow-title{margin-top:3px;font-size:13px;font-weight:950;color:#17324f}.design-workflow-note{margin-top:4px;font-size:9px;line-height:1.5;color:#718096}
      .design-workflow-steps{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:5px;margin-top:10px}.design-workflow-step{position:relative;min-width:0;min-height:55px;border:1px solid #dbe4ed;border-radius:10px;background:#fff;color:#5c6d80;padding:7px 5px;text-align:left;cursor:pointer}.design-workflow-step:hover{border-color:#9ab8d6;background:#f8fbff}.design-workflow-step.active{border-color:#4e8bc8;background:#eef6ff;color:#155184;box-shadow:0 0 0 2px rgba(23,105,224,.07)}.design-workflow-step.done{border-color:#a9d7c8;background:#f2fbf7;color:#236b56}.design-workflow-step.warn{border-color:#f1c58f;background:#fff9f0;color:#9a5b10}.design-workflow-step-num{display:block;font-size:7px;font-weight:950;opacity:.65}.design-workflow-step strong{display:block;margin-top:2px;font-size:9px;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.design-workflow-step small{display:block;margin-top:2px;font-size:7px;line-height:1.2;opacity:.75;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.design-workflow-step.done:after{content:'✓';position:absolute;right:5px;top:4px;font-size:8px;font-weight:950}.design-workflow-step.warn:after{content:'!';position:absolute;right:6px;top:4px;font-size:9px;font-weight:950}
      .design-workflow-status{order:-19!important;border:1px solid #e1e8f0!important;padding:9px 10px!important;background:#fff!important}.design-workflow-status-row{display:flex;align-items:flex-start;gap:8px}.design-workflow-status-copy{flex:1;min-width:0}.design-workflow-status-title{font-size:9px;font-weight:950;color:#334155}.design-workflow-status-note{margin-top:3px;font-size:8px;line-height:1.45;color:#718096}.design-workflow-badge{flex:0 0 auto;border-radius:999px;padding:4px 7px;font-size:7px;font-weight:950;background:#eef4f8;color:#506176}.design-workflow-badge.ok{background:#ecfdf3;color:#067647}.design-workflow-badge.warn{background:#fff7ed;color:#b54708}.design-workflow-badge.bad{background:#fef3f2;color:#b42318}.design-workflow-status-actions{display:flex;gap:5px;margin-top:7px}.design-workflow-status-actions button{min-height:30px;border:1px solid #d5e0eb;border-radius:8px;background:#fff;color:#506176;padding:0 8px;font-size:8px;font-weight:900;cursor:pointer}.design-workflow-status-actions button.primary{border-color:#b8d7df;background:#f0fdff;color:#0f6070}
      .sidebar>#designOutputTools.design-output-dock-v2{position:sticky;bottom:0;z-index:16;margin-top:2px!important;border-color:#cbd9e7!important;background:rgba(255,255,255,.97)!important;box-shadow:0 -10px 24px rgba(15,39,72,.10)!important;backdrop-filter:blur(10px)}
      .sidebar>#designFinalPrintCheckTools{border-color:#d7e6e2!important}.sidebar>#designPrintQualityTools,.sidebar>#designPrintSafetyTools{background:#fcfdfd}
      @media(max-width:980px){.design-workflow-steps{grid-template-columns:repeat(2,minmax(0,1fr))}.sidebar>#designOutputTools.design-output-dock-v2{position:relative;bottom:auto}}
    `;
    document.head.appendChild(style);
  }

  function projectStats(){
    const p=project();
    if(!p)return{ready:false,surfaces:0,objects:0};
    const surfaces=Array.isArray(p.surfaces)?p.surfaces:[];
    let objects=0;
    surfaces.forEach(surface=>{
      objects+=(Array.isArray(surface?.elements)?surface.elements.length:0);
      objects+=(Array.isArray(surface?.extras)?surface.extras.length:0);
    });
    return{ready:true,surfaces:surfaces.length,objects};
  }

  function diagnostics(){
    try{
      const health=window.DesignEditorRuntimeDiagnostics?.audit?.();
      const issues=Array.isArray(health?.issues)?health.issues:[];
      return{count:issues.length,issues};
    }catch(_){return{count:0,issues:[]};}
  }

  function printSafety(){
    const summary=window.DesignEditorPrintSafety?.lastSummary;
    return{count:Number(summary?.count)||0,fixable:Number(summary?.fixableCount)||0};
  }

  function printQuality(){
    const summary=window.DesignEditorPrintQuality?.lastSummary;
    return{count:Number(summary?.count)||0,low:Number(summary?.lowCount)||0,caution:Number(summary?.cautionCount)||0};
  }

  function finalCheckState(){
    const badge=byId('designFinalCheckBadge');
    const text=String(badge?.textContent||'').trim();
    const className=String(badge?.className||'');
    return{
      fatal:className.includes('fatal')||/^오류/.test(text),
      warning:className.includes('warn')||/^경고/.test(text),
      ok:className.includes('ok')||text==='인쇄 적합',
      text
    };
  }

  function anchorForStep(step){
    const candidates={
      compose:['designQuickDesignTools','designPhase2Tools','inspector'],
      edit:['inspector','designPhase2Tools'],
      arrange:['designPhase4SmartLayout','designAdvancedTools','inspector'],
      output:['designFinalPrintCheckTools','designPrintQualityTools','designPrintSafetyTools','designOutputTools']
    }[step]||[];
    return candidates.map(byId).find(Boolean)||null;
  }

  function syncActiveStep(){
    document.querySelectorAll('#'+PANEL_ID+' [data-design-step]').forEach(button=>{
      const selected=button.dataset.designStep===activeStep;
      button.classList.toggle('active',selected);
      button.setAttribute('aria-current',selected?'step':'false');
    });
  }

  function activateStep(step,userInitiated=false){
    activeStep=['compose','edit','arrange','output'].includes(step)?step:'compose';
    syncActiveStep();
    if(userInitiated){
      const target=anchorForStep(activeStep);
      if(target){
        if(target.tagName==='DETAILS')target.open=true;
        target.scrollIntoView({behavior:'smooth',block:'nearest'});
      }
    }
    queueSync();
  }

  function installPanel(){
    if(byId(PANEL_ID))return true;
    const sidebar=document.querySelector('.sidebar');
    const shell=byId('editorShell');
    if(!sidebar||!shell||shell.classList.contains('hidden')||!project())return false;
    const panel=document.createElement('section');
    panel.id=PANEL_ID;
    panel.className='side-card design-workflow-v2';
    panel.setAttribute('aria-label','디자인 편집 작업 순서');
    panel.innerHTML=`<div class="design-workflow-kicker">QUICK WORKFLOW</div><div class="design-workflow-title">순서대로 만들면 더 빠릅니다</div><div class="design-workflow-note">내용을 구성하고 요소를 편집한 뒤 정렬을 다듬고, 마지막에 인쇄 검사를 거쳐 파일을 만듭니다.</div><div class="design-workflow-steps" role="navigation" aria-label="디자인 작업 단계"><button type="button" class="design-workflow-step active" data-design-step="compose"><span class="design-workflow-step-num">STEP 1</span><strong>구성</strong><small>글씨·사진·도형</small></button><button type="button" class="design-workflow-step" data-design-step="edit"><span class="design-workflow-step-num">STEP 2</span><strong>편집</strong><small>선택 요소 설정</small></button><button type="button" class="design-workflow-step" data-design-step="arrange"><span class="design-workflow-step-num">STEP 3</span><strong>정리</strong><small>정렬·간격·회전</small></button><button type="button" class="design-workflow-step" data-design-step="output"><span class="design-workflow-step-num">STEP 4</span><strong>출력</strong><small>검사·PNG·PDF</small></button></div>`;
    sidebar.prepend(panel);
    panel.querySelectorAll('[data-design-step]').forEach(button=>button.addEventListener('click',()=>activateStep(button.dataset.designStep,true)));
    syncActiveStep();
    return true;
  }

  function installStatus(){
    if(byId(STATUS_ID))return true;
    const panel=byId(PANEL_ID);
    if(!panel)return false;
    const card=document.createElement('section');
    card.id=STATUS_ID;
    card.className='side-card design-workflow-status';
    card.setAttribute('aria-live','polite');
    card.innerHTML='<div class="design-workflow-status-row"><div class="design-workflow-status-copy"><div class="design-workflow-status-title">작업 상태 확인 중</div><div class="design-workflow-status-note">자동 저장과 인쇄 상태를 확인합니다.</div></div><span class="design-workflow-badge">확인 중</span></div><div class="design-workflow-status-actions"><button type="button" data-design-workflow-action="diagnostics">진단 열기</button><button type="button" class="primary" data-design-workflow-action="print-check">전체 인쇄 검사</button></div>';
    panel.insertAdjacentElement('afterend',card);
    card.querySelector('[data-design-workflow-action="diagnostics"]')?.addEventListener('click',()=>byId('designDiagnosticsButton')?.click());
    card.querySelector('[data-design-workflow-action="print-check"]')?.addEventListener('click',()=>{
      const button=byId('designFinalCheckBtn');
      if(button)button.click();
      else anchorForStep('output')?.scrollIntoView({behavior:'smooth',block:'nearest'});
    });
    return true;
  }

  function decorateOutput(){
    const output=byId('designOutputTools');
    if(output)output.classList.add('design-output-dock-v2');
  }

  function syncStatus(){
    const card=byId(STATUS_ID);
    if(!card)return;
    const title=card.querySelector('.design-workflow-status-title');
    const note=card.querySelector('.design-workflow-status-note');
    const badge=card.querySelector('.design-workflow-badge');
    const diag=diagnostics();
    const safety=printSafety();
    const quality=printQuality();
    const final=finalCheckState();
    const saveText=String(byId('saveState')?.textContent||'').trim();
    const notes=[];
    let state='ok',badgeText='정상',titleText='편집 상태 정상';

    if(diag.count>0){
      state='bad';badgeText=`진단 ${diag.count}`;titleText='편집기 확인이 필요합니다.';notes.push('런타임 또는 저장 상태를 진단에서 확인하세요.');
    }else if(final.fatal){
      state='bad';badgeText=final.text||'출력 오류';titleText='출력 전 수정이 필요합니다.';notes.push('최종 인쇄 검사에서 출력 불가 항목을 확인했습니다.');
    }else if(safety.count>0||quality.low>0||quality.caution>0||final.warning){
      state='warn';
      const issueCount=safety.count+quality.low+quality.caution;
      badgeText=issueCount?`확인 ${issueCount}`:(final.text||'확인 필요');
      titleText='인쇄 전에 확인할 항목이 있습니다.';
      if(safety.count)notes.push(`안전여백·접지·글씨 ${safety.count}건`);
      if(quality.low)notes.push(`저해상도 이미지 ${quality.low}개`);
      if(quality.caution)notes.push(`해상도 주의 이미지 ${quality.caution}개`);
    }else{
      const stats=projectStats();
      titleText=stats.objects?`요소 ${stats.objects}개 · ${stats.surfaces}개 면 작업 중`:'빈 작업면에서 시작했습니다.';
      notes.push(final.ok?'최종 인쇄 검사 통과':'출력 전에 전체 인쇄 검사를 실행하세요.');
    }
    if(saveText)notes.push(saveText);
    badge.className=`design-workflow-badge ${state}`;
    badge.textContent=badgeText;
    title.textContent=titleText;
    note.textContent=notes.join(' · ');
    const diagButton=card.querySelector('[data-design-workflow-action="diagnostics"]');
    if(diagButton)diagButton.hidden=!byId('designDiagnosticsButton')&&diag.count===0;
  }

  function syncSteps(){
    const stats=projectStats();
    const diag=diagnostics();
    const safety=printSafety();
    const quality=printQuality();
    const final=finalCheckState();
    document.querySelectorAll('#'+PANEL_ID+' [data-design-step]').forEach(button=>{
      const step=button.dataset.designStep;
      let done=false,warn=false;
      if(step==='compose')done=stats.ready&&stats.objects>0;
      if(step==='edit')done=Boolean(document.querySelector('.design-object.selected,.phase2-extra-object.selected'));
      if(step==='arrange')done=stats.ready&&stats.objects>0;
      if(step==='output'){
        done=final.ok&&diag.count===0;
        warn=diag.count>0||final.fatal||final.warning||safety.count>0||quality.low>0||quality.caution>0;
      }
      button.classList.toggle('done',done);
      button.classList.toggle('warn',warn&&!done);
    });
    syncActiveStep();
    syncStatus();
    decorateOutput();
  }

  function queueSync(){
    if(syncFrame)return;
    syncFrame=requestAnimationFrame(()=>{
      syncFrame=requestAnimationFrame(()=>{
        syncFrame=0;
        syncSteps();
      });
    });
  }

  function refresh(){
    syncSteps();
  }

  function bindEvents(){
    if(document.documentElement.dataset.designWorkflowV2Events==='1')return;
    document.documentElement.dataset.designWorkflowV2Events='1';
    ['click','change','pointerup'].forEach(name=>document.addEventListener(name,queueSync,false));
    document.addEventListener('input',queueSync,false);
    window.addEventListener('programstudio:runtime-script-result',queueSync);
    window.addEventListener('resize',queueSync,{passive:true});

    const sidebar=document.querySelector('.sidebar');
    if(sidebar&&!sidebarObserver){
      sidebarObserver=new MutationObserver(queueSync);
      sidebarObserver.observe(sidebar,{childList:true});
    }
    const statusNodes=[byId('saveState'),byId('editorStatus')].filter(Boolean);
    if(statusNodes.length&&!statusObserver){
      statusObserver=new MutationObserver(queueSync);
      statusNodes.forEach(node=>statusObserver.observe(node,{childList:true,characterData:true,subtree:true,attributes:true,attributeFilter:['class']}));
    }
  }

  function install(){
    attempts+=1;
    installStyles();
    if(!installPanel()){
      if(attempts<24)setTimeout(install,100+attempts*45);
      return false;
    }
    installStatus();
    decorateOutput();
    bindEvents();
    syncActiveStep();
    queueSync();
    window.DesignEditorWorkflowV2={activateStep,refresh,stage:'guided-compose-edit-arrange-output-v2'};
    return true;
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();
})();
