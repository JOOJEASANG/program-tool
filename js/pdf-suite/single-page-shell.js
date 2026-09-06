// Present PDF utility as a fixed left function menu with one persistent right work/result surface.
(function(){
  'use strict';
  if(window.__programStudioPdfUtilitySplitV3)return;
  window.__programStudioPdfUtilitySplitV3=true;

  const GROUPS={
    basic:{label:'페이지 · 문서',desc:'합치기 · 분할 · 정리 · 회전',categories:['pages']},
    convert:{label:'변환 · OCR',desc:'PDF ↔ 이미지 · OCR · 텍스트',categories:['convert','scan']},
    edit:{label:'편집 · 보안',desc:'일반 편집 · 암호 · 개인정보',categories:['edit','security']},
    optimize:{label:'최적화 · 검사',desc:'압축 · 호환성 · 문서 진단',categories:['optimize','print','analyze']}
  };
  const SEPARATE_TOOL_NAMES=new Set([
    'N-up 다면 배치','소책자·중철 배치','책자 출력 배치','인쇄물 사전 검토'
  ]);
  const BASIC_MODES=new Map([
    ['PDF 합치기','merge'],
    ['페이지 추출·나누기','extract'],
    ['선택 페이지 → PDF','extract']
  ]);
  const LOCAL_ACTION_NAMES=new Map([
    ['전체 페이지 회전','rotate'],
    ['페이지 순서 역순','reverse'],
    ['메타데이터 확인','metadata'],
    ['문서 메타데이터 분석','metadata'],
    ['메타데이터 정리','sanitize'],
    ['폼 평면화','flatten']
  ]);
  const LOCAL_RUNS={
    rotate:['rotate90','rotate180'],reverse:['reverse'],metadata:['metadata'],sanitize:['sanitize'],flatten:['flatten']
  };
  const ADVANCED_SHARED_FILE=new Set(['text','attachments','accessibility','outline']);
  const CATEGORY_GROUP={};
  Object.entries(GROUPS).forEach(([group,config])=>config.categories.forEach(category=>CATEGORY_GROUP[category]=group));

  let tools=[];
  let currentTool=null;
  let activeGroup='basic';
  let embeddedKind=null;
  let sourceStore=null;
  let stageBody=null;
  let stageTitle=null;
  let stageDesc=null;
  let stageBadge=null;
  let stageAction=null;
  let preflightFrame=null;
  let editorFrame=null;
  const $=id=>document.getElementById(id);

  function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}

  function installStyle(){
    if($('pdfUtilitySplitStyle'))return;
    const style=document.createElement('style');
    style.id='pdfUtilitySplitStyle';
    style.textContent=`
      html[data-pdf-utility-layout="split"] body{overflow:hidden;background:#eef3f7}
      html[data-pdf-utility-layout="split"] .wrap{max-width:none!important;margin:0!important;padding:0!important}
      html[data-pdf-utility-layout="split"] .hero,html[data-pdf-utility-layout="split"] .quick,html[data-pdf-utility-layout="split"] .footer{display:none!important}
      .pdfu-source-store{display:none!important}
      .pdfu-split{height:calc(100vh - 62px);display:grid;grid-template-columns:318px minmax(0,1fr);background:#eef3f7}
      .pdfu-sidebar{min-width:0;background:#fff;border-right:1px solid #dbe4ee;display:flex;flex-direction:column;overflow:hidden}
      .pdfu-side-head{padding:17px 16px 13px;border-bottom:1px solid #e6edf4}.pdfu-side-kicker{font-size:9px;font-weight:950;letter-spacing:1.1px;color:#2563eb}.pdfu-side-title{font-size:18px;font-weight:950;color:#0f2f59;margin-top:2px;letter-spacing:-.45px}.pdfu-side-copy{font-size:10px;line-height:1.5;color:#64748b;margin-top:4px}
      .pdfu-search-wrap{padding:11px 12px;border-bottom:1px solid #edf2f7}.pdfu-search{width:100%;height:39px;border:1.5px solid #dbe4ee;border-radius:10px;padding:0 11px;font:750 11px Pretendard,"Noto Sans KR",sans-serif;outline:none;background:#f8fafc;color:#1e293b}.pdfu-search:focus{border-color:#60a5fa;background:#fff;box-shadow:0 0 0 3px rgba(37,99,235,.08)}
      .pdfu-menu-scroll{flex:1;overflow:auto;padding:8px 9px 18px;scrollbar-width:thin}.pdfu-menu-group{margin-top:7px}.pdfu-menu-group:first-child{margin-top:0}.pdfu-menu-group-head{padding:8px 8px 6px}.pdfu-menu-group-head strong{display:block;font-size:10px;font-weight:950;color:#334155}.pdfu-menu-group-head span{display:block;font-size:8px;color:#94a3b8;margin-top:2px}
      .pdfu-menu-item{width:100%;border:0;background:transparent;border-radius:9px;padding:8px 9px;display:grid;grid-template-columns:25px minmax(0,1fr) auto;gap:8px;align-items:center;text-align:left;cursor:pointer;color:#475569;margin:1px 0;font:inherit}.pdfu-menu-item:hover{background:#f1f5f9}.pdfu-menu-item.active{background:#e8f1ff;color:#174f80;box-shadow:inset 3px 0 0 #2563eb}.pdfu-menu-icon{font-size:14px;text-align:center}.pdfu-menu-name{font-size:10px;font-weight:880;line-height:1.35;overflow:hidden;text-overflow:ellipsis}.pdfu-menu-badge{font-size:7px;font-weight:950;border-radius:999px;padding:3px 5px;background:#ecfdf5;color:#047857;white-space:nowrap}.pdfu-menu-badge.local{background:#eff6ff;color:#1d4ed8}.pdfu-menu-badge.plan{background:#f1f5f9;color:#64748b}.pdfu-menu-item[hidden],.pdfu-menu-group[hidden]{display:none!important}
      .pdfu-side-foot{border-top:1px solid #e6edf4;padding:10px 12px;font-size:8px;line-height:1.5;color:#94a3b8;background:#fbfdff}.pdfu-side-foot b{color:#475569}
      .pdfu-stage{min-width:0;display:flex;flex-direction:column;overflow:hidden}.pdfu-stage-head{height:68px;flex:0 0 68px;background:#fff;border-bottom:1px solid #dbe4ee;display:flex;align-items:center;gap:12px;padding:0 18px}.pdfu-stage-copy{min-width:0;flex:1}.pdfu-stage-label{font-size:8px;font-weight:950;color:#2563eb;letter-spacing:.9px}.pdfu-stage-title{font-size:15px;font-weight:950;color:#0f172a;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.pdfu-stage-desc{font-size:9px;color:#64748b;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.pdfu-stage-badge{font-size:8px;font-weight:950;border-radius:999px;padding:5px 8px;background:#ecfdf5;color:#047857;white-space:nowrap}.pdfu-stage-action{display:none;border:1px solid #bfdbfe;background:#eff6ff;color:#1d4ed8;border-radius:9px;padding:8px 10px;font:900 9px Pretendard,"Noto Sans KR",sans-serif;cursor:pointer}.pdfu-stage-action.show{display:inline-flex}.pdfu-stage-action:hover{background:#dbeafe}
      .pdfu-stage-body{flex:1;min-height:0;overflow:auto;padding:16px;background:#eef3f7}.pdfu-stage-card{min-height:100%;background:#fff;border:1px solid #dce5ef;border-radius:16px;padding:22px;box-shadow:0 8px 24px rgba(15,23,42,.05)}.pdfu-stage-empty{min-height:420px;display:grid;place-items:center;text-align:center;color:#64748b}.pdfu-stage-empty .icon{font-size:38px}.pdfu-stage-empty strong{display:block;color:#0f2f59;font-size:16px;margin-top:10px}.pdfu-stage-empty p{max-width:520px;font-size:11px;line-height:1.65;margin-top:6px}.pdfu-plan-note{border:1px solid #fde68a;background:#fffbeb;color:#92400e;border-radius:12px;padding:12px 14px;font-size:10px;line-height:1.65;margin-top:14px}
      .pdfu-frame{width:100%;height:100%;min-height:calc(100vh - 162px);border:0;border-radius:13px;background:#fff;display:block}.pdfu-frame-shell{height:100%;min-height:calc(100vh - 162px);background:#fff;border:1px solid #dce5ef;border-radius:16px;overflow:hidden}
      .pdfu-stage-body #pdf-primary-workspace,.pdfu-stage-body #local-tools{margin:0!important;max-width:none!important;box-shadow:none!important;border-radius:14px!important}.pdfu-stage-body #local-tools{background:#fff}.pdfu-stage-body .pdfu-expert{display:none!important}
      .pdfu-local-focus .local-btn{display:none}.pdfu-local-focus[data-local-focus="rotate"] .local-btn[data-local-run="rotate90"],.pdfu-local-focus[data-local-focus="rotate"] .local-btn[data-local-run="rotate180"],.pdfu-local-focus[data-local-focus="reverse"] .local-btn[data-local-run="reverse"],.pdfu-local-focus[data-local-focus="metadata"] .local-btn[data-local-run="metadata"],.pdfu-local-focus[data-local-focus="sanitize"] .local-btn[data-local-run="sanitize"],.pdfu-local-focus[data-local-focus="flatten"] .local-btn[data-local-run="flatten"]{display:block}.pdfu-local-focus[data-local-focus="upload-only"] .local-actions{display:none}.pdfu-local-focus .local-actions{grid-template-columns:repeat(3,minmax(0,150px))!important;justify-content:start}
      .pdfadv-overlay.pdfu-inline-overlay,.pdfocr-overlay.pdfu-inline-overlay{position:relative!important;inset:auto!important;z-index:auto!important;display:block!important;align-items:stretch!important;justify-content:stretch!important;padding:0!important;background:transparent!important;backdrop-filter:none!important;width:100%!important}.pdfadv-overlay.pdfu-inline-overlay .pdfadv-dialog,.pdfocr-overlay.pdfu-inline-overlay .pdfocr-dialog{width:100%!important;max-width:none!important;max-height:none!important;box-shadow:none!important;border:1px solid #dce5ef!important;border-radius:14px!important}.pdfadv-overlay.pdfu-inline-overlay:not(.open),.pdfocr-overlay.pdfu-inline-overlay:not(.open){display:none!important}
      @media(max-width:900px){html[data-pdf-utility-layout="split"] body{overflow:auto}.pdfu-split{height:auto;min-height:calc(100vh - 62px);grid-template-columns:1fr;grid-template-rows:minmax(260px,38vh) minmax(620px,1fr)}.pdfu-sidebar{border-right:0;border-bottom:1px solid #dbe4ee}.pdfu-stage{min-height:620px}.pdfu-stage-body{padding:10px}.pdfu-frame,.pdfu-frame-shell{min-height:620px}.pdfu-side-head{padding:12px}.pdfu-side-copy{display:none}.pdfu-menu-scroll{padding-bottom:10px}}
      @media(max-width:520px){.pdfu-stage-head{height:auto;min-height:76px;padding:10px 12px;flex-wrap:wrap}.pdfu-stage-action{margin-left:auto}.pdfu-stage-desc{white-space:normal}.pdfu-stage-body{padding:7px}.pdfu-stage-card{padding:15px}.pdfu-menu-item{padding:8px 7px}.pdfu-split{grid-template-rows:minmax(250px,40vh) minmax(650px,1fr)}}
    `;
    document.head.appendChild(style);
  }

  function removeSeparatedTools(){
    document.querySelectorAll('.tool').forEach(tool=>{
      const name=tool.querySelector('.tool-name')?.textContent?.trim()||'';
      if(SEPARATE_TOOL_NAMES.has(name))tool.remove();
    });
  }

  function normalizeHeader(){
    document.title='PDF 유틸리티 · Program Studio';
    const title=document.querySelector('.top-title');
    if(title)title.innerHTML='PDF 유틸리티 <span class="top-sub">PDF UTILITY</span>';
    document.querySelectorAll('.top-link').forEach(link=>link.style.display='none');
  }

  function toolStatus(tool){
    if(tool.classList.contains('planned')||tool.dataset.status==='planned')return 'planned';
    if(tool.dataset.status==='local'||tool.classList.contains('pdfadv-tool-ready')||tool.classList.contains('pdfocr-ready'))return 'local';
    return 'available';
  }

  function canonicalKey(name){
    if(name==='페이지 추출·나누기'||name==='선택 페이지 → PDF')return 'extract';
    return name;
  }

  function collectTools(){
    const result=[];
    const seen=new Set();
    document.querySelectorAll('.section[data-category]').forEach(section=>{
      const category=section.dataset.category||'';
      const group=CATEGORY_GROUP[category]||'basic';
      section.querySelectorAll('.tool').forEach(source=>{
        const name=source.querySelector('.tool-name')?.textContent?.trim()||'';
        if(!name||SEPARATE_TOOL_NAMES.has(name))return;
        const key=canonicalKey(name);
        if(seen.has(key))return;
        seen.add(key);
        const icon=source.querySelector('.tool-icon')?.textContent?.trim()||'📄';
        const desc=source.querySelector('.tool-desc')?.textContent?.trim()||'';
        const href=source.getAttribute('href')||'';
        const status=toolStatus(source);
        result.push({id:`pdfu-tool-${result.length+1}`,key,name,icon,desc,href,status,group,category,source,advancedAction:source.dataset.advancedAction||'',localAction:source.dataset.localAction||LOCAL_ACTION_NAMES.get(name)||'',ocr:source.classList.contains('pdfocr-ready')});
      });
    });
    tools=result;
    return result;
  }

  function menuMarkup(){
    return Object.entries(GROUPS).map(([group,config])=>{
      const rows=tools.filter(tool=>tool.group===group).map(tool=>{
        const label=tool.status==='planned'?'예정':tool.status==='local'?'로컬':'사용';
        const badgeClass=tool.status==='planned'?'plan':tool.status==='local'?'local':'';
        return `<button type="button" class="pdfu-menu-item" data-pdfu-tool="${tool.id}" data-pdfu-search="${escapeHtml((tool.name+' '+tool.desc).toLowerCase())}"><span class="pdfu-menu-icon">${escapeHtml(tool.icon)}</span><span class="pdfu-menu-name">${escapeHtml(tool.name)}</span><span class="pdfu-menu-badge ${badgeClass}">${label}</span></button>`;
      }).join('');
      return `<section class="pdfu-menu-group" data-pdfu-group="${group}"><div class="pdfu-menu-group-head"><strong>${config.label}</strong><span>${config.desc}</span></div>${rows}</section>`;
    }).join('');
  }

  function installShell(){
    if($('pdfUtilitySplit'))return;
    const wrap=document.querySelector('.wrap');
    if(!wrap)return;
    const split=document.createElement('section');
    split.id='pdfUtilitySplit';
    split.className='pdfu-split';
    split.innerHTML=`<aside class="pdfu-sidebar" aria-label="PDF 유틸리티 기능 메뉴"><div class="pdfu-side-head"><div class="pdfu-side-kicker">PDF UTILITY</div><div class="pdfu-side-title">기능 메뉴</div><div class="pdfu-side-copy">왼쪽에서 기능을 고르면 오른쪽 작업·미리보기·결과 화면만 바뀝니다.</div></div><div class="pdfu-search-wrap"><input id="pdfUtilityMenuSearch" class="pdfu-search" type="search" placeholder="기능 검색 · 예: 압축, OCR, 암호" autocomplete="off"></div><div class="pdfu-menu-scroll" id="pdfUtilityMenu">${menuMarkup()}</div><div class="pdfu-side-foot"><b>N-UP·소책자</b>는 PDF 편집 프로그램, <b>인쇄물 검토</b>는 사전검토 프로그램에서 사용합니다.</div></aside><main class="pdfu-stage"><header class="pdfu-stage-head"><div class="pdfu-stage-copy"><div class="pdfu-stage-label">작업 · 실시간 결과 화면</div><div class="pdfu-stage-title" id="pdfUtilityStageTitle">기능을 선택하세요</div><div class="pdfu-stage-desc" id="pdfUtilityStageDesc">왼쪽 메뉴에서 필요한 PDF 기능을 선택하면 이 화면에서 작업합니다.</div></div><span class="pdfu-stage-badge" id="pdfUtilityStageBadge">PDF 유틸리티</span><button class="pdfu-stage-action" id="pdfUtilityStageAction" type="button">실행</button></header><div class="pdfu-stage-body" id="pdfUtilityStageBody"></div></main>`;
    wrap.appendChild(split);
    stageBody=$('pdfUtilityStageBody');stageTitle=$('pdfUtilityStageTitle');stageDesc=$('pdfUtilityStageDesc');stageBadge=$('pdfUtilityStageBadge');stageAction=$('pdfUtilityStageAction');
    sourceStore=document.createElement('div');sourceStore.id='pdfUtilitySourceStore';sourceStore.className='pdfu-source-store';document.body.appendChild(sourceStore);
    const movable=[...document.querySelectorAll('.toolbar,.section[data-category],#pdf-primary-workspace,#local-tools,.roadmap')];
    movable.forEach(node=>sourceStore.appendChild(node));
    $('pdfUtilityMenuSearch')?.addEventListener('input',event=>filterMenu(event.target.value));
    split.querySelectorAll('[data-pdfu-tool]').forEach(button=>button.addEventListener('click',()=>activateTool(button.dataset.pdfuTool)));
    stageAction?.addEventListener('click',()=>runStageAction());
  }

  function filterMenu(query){
    const q=String(query||'').trim().toLowerCase();
    document.querySelectorAll('[data-pdfu-tool]').forEach(button=>{button.hidden=Boolean(q)&&!String(button.dataset.pdfuSearch||'').includes(q);});
    document.querySelectorAll('[data-pdfu-group]').forEach(group=>{group.hidden=![...group.querySelectorAll('[data-pdfu-tool]')].some(button=>!button.hidden);});
  }

  function resetStage(){
    if(!stageBody)return;
    const primary=$('pdf-primary-workspace');if(primary&&primary.parentElement!==sourceStore)sourceStore.appendChild(primary);
    const local=$('local-tools');if(local&&local.parentElement!==sourceStore){restoreLocalPanel(local);sourceStore.appendChild(local);}
    [preflightFrame,editorFrame].forEach(frame=>{if(frame&&frame.parentElement!==sourceStore)sourceStore.appendChild(frame);});
    document.querySelectorAll('.pdfadv-overlay.pdfu-inline-overlay,.pdfocr-overlay.pdfu-inline-overlay').forEach(overlay=>{
      overlay.classList.remove('open','pdfu-inline-overlay');
      if(overlay.parentElement!==document.body)document.body.appendChild(overlay);
    });
    document.body.style.overflow='';
    stageBody.replaceChildren();
    stageAction.classList.remove('show');stageAction.textContent='실행';
    embeddedKind=null;
  }

  function restoreLocalPanel(panel){
    panel.classList.remove('pdfu-local-focus');delete panel.dataset.localFocus;
    panel.querySelectorAll('.local-btn').forEach(btn=>btn.style.display='');
    const actions=panel.querySelector('.local-actions');if(actions)actions.style.display='';
    const title=panel.querySelector('#localTitle');if(title?.dataset.originalText)title.textContent=title.dataset.originalText;
    const copy=panel.querySelector('.local-head p');if(copy?.dataset.originalText)copy.textContent=copy.dataset.originalText;
  }

  function configureLocalPanel(tool,focus='upload-only'){
    const panel=$('local-tools');if(!panel)return null;
    const title=panel.querySelector('#localTitle');const copy=panel.querySelector('.local-head p');
    if(title&&!title.dataset.originalText)title.dataset.originalText=title.textContent||'';
    if(copy&&!copy.dataset.originalText)copy.dataset.originalText=copy.textContent||'';
    if(title)title.textContent=tool.name;
    if(copy)copy.textContent=tool.desc||'PDF를 선택한 뒤 현재 기능을 실행합니다.';
    panel.classList.add('pdfu-local-focus');panel.dataset.localFocus=focus;
    panel.querySelectorAll('.local-btn').forEach(btn=>btn.style.display='none');
    const runs=LOCAL_RUNS[focus]||[];
    runs.forEach(run=>{const button=panel.querySelector(`[data-local-run="${run}"]`);if(button)button.style.display='block';});
    const actions=panel.querySelector('.local-actions');if(actions)actions.style.display=focus==='upload-only'?'none':'grid';
    return panel;
  }

  function setHeader(tool,badge){
    if(stageTitle)stageTitle.textContent=tool.name;
    if(stageDesc)stageDesc.textContent=tool.desc||'현재 기능을 오른쪽 화면에서 사용합니다.';
    if(stageBadge){stageBadge.textContent=badge||'바로 사용';stageBadge.style.background=tool.status==='planned'?'#f1f5f9':tool.status==='local'?'#eff6ff':'#ecfdf5';stageBadge.style.color=tool.status==='planned'?'#64748b':tool.status==='local'?'#1d4ed8':'#047857';}
  }

  function showEmpty(tool,planned=false){
    const card=document.createElement('section');card.className='pdfu-stage-card';
    card.innerHTML=`<div class="pdfu-stage-empty"><div><div class="icon">${escapeHtml(tool.icon||'📄')}</div><strong>${escapeHtml(tool.name)}</strong><p>${escapeHtml(tool.desc||'')}</p>${planned?'<div class="pdfu-plan-note">이 기능은 현재 확장 예정입니다. 구현이 완료되면 같은 오른쪽 작업·결과 화면에서 바로 사용할 수 있게 연결됩니다.</div>':''}</div></div>`;
    stageBody.appendChild(card);
  }

  function mountPrimary(tool,mode){
    const panel=$('pdf-primary-workspace');if(!panel){showEmpty(tool);return;}
    stageBody.appendChild(panel);
    const tab=panel.querySelector(`[data-pdf-unified-mode="${mode}"]`);if(tab&&!tab.classList.contains('active'))tab.click();
    panel.scrollIntoView({block:'start'});
  }

  function mountLocal(tool,focus){
    const panel=configureLocalPanel(tool,focus);if(!panel){showEmpty(tool);return;}
    stageBody.appendChild(panel);
  }

  function ensureFrame(kind,tool){
    let frame=kind==='editor'?editorFrame:preflightFrame;
    if(!frame){
      frame=document.createElement('iframe');frame.className='pdfu-frame';frame.title=kind==='editor'?'PDF 일반 편집 작업':'PDF 검사·변환 작업';frame.dataset.pdfuFrame=kind;
      const path=kind==='editor'?'/pdf-editor/':'/pdf-preflight/';frame.src=`${path}?embed=1&from=pdf-utility-split&tool=${encodeURIComponent(tool.name)}`;
      if(kind==='editor')editorFrame=frame;else preflightFrame=frame;
    }else{
      try{frame.contentWindow?.postMessage({type:'program-pdf-workspace-focus',tool:tool.name},location.origin);}catch(_){ }
    }
    embeddedKind=kind;
    return frame;
  }

  function mountFrame(tool,kind){
    const shell=document.createElement('div');shell.className='pdfu-frame-shell';
    const frame=ensureFrame(kind,tool);shell.appendChild(frame);stageBody.appendChild(shell);
  }

  function showStageAction(label){
    stageAction.textContent=label;stageAction.classList.add('show');
  }

  function launchAdvanced(tool){
    const action=tool.advancedAction;
    if(!action)return;
    if(action==='text'){
      mountLocal(tool,'upload-only');
      showStageAction('텍스트 추출 실행');
      return;
    }
    if(ADVANCED_SHARED_FILE.has(action))mountLocal(tool,'upload-only');
    showStageAction('기능 열기');
    window.ProgramStudioPdfSuiteAdvanced?.launch?.(action);
  }

  function launchOcr(tool){
    showEmpty(tool);
    showStageAction('OCR 화면 열기');
    tool.source?.click?.();
  }

  function activateTool(idOrName){
    const tool=tools.find(item=>item.id===idOrName||item.name===idOrName||item.key===idOrName);
    if(!tool)return false;
    currentTool=tool;activeGroup=tool.group;
    document.querySelectorAll('[data-pdfu-tool]').forEach(button=>button.classList.toggle('active',button.dataset.pdfuTool===tool.id));
    resetStage();setHeader(tool,tool.status==='planned'?'확장 예정':tool.status==='local'?'브라우저 로컬':'바로 사용');
    const basicMode=BASIC_MODES.get(tool.name);
    if(basicMode){mountPrimary(tool,basicMode);return true;}
    if(tool.advancedAction){launchAdvanced(tool);return true;}
    if(tool.ocr){launchOcr(tool);return true;}
    const localAction=tool.localAction||LOCAL_ACTION_NAMES.get(tool.name)||'';
    if(localAction){mountLocal(tool,localAction);return true;}
    if(tool.status==='planned'){showEmpty(tool,true);return true;}
    if(tool.href.includes('pdf-preflight')){mountFrame(tool,'preflight');return true;}
    if(tool.href.includes('pdf-editor')){mountFrame(tool,'editor');return true;}
    if(tool.href.includes('#local-tools')){mountLocal(tool,'upload-only');return true;}
    if(tool.source?.matches?.('[role="button"],.available')){
      showEmpty(tool);showStageAction('기능 열기');return true;
    }
    showEmpty(tool);return true;
  }

  function runStageAction(){
    if(!currentTool)return;
    if(currentTool.advancedAction==='text')window.ProgramStudioPdfSuiteAdvanced?.launch?.('text');
    else if(currentTool.advancedAction)window.ProgramStudioPdfSuiteAdvanced?.launch?.(currentTool.advancedAction);
    else if(currentTool.ocr)currentTool.source?.click?.();
    else currentTool.source?.click?.();
  }

  function inlineOpenOverlay(overlay){
    if(!stageBody||!currentTool)return;
    overlay.classList.add('pdfu-inline-overlay');
    if(ADVANCED_SHARED_FILE.has(currentTool.advancedAction)){
      if(overlay.parentElement!==stageBody)stageBody.appendChild(overlay);
    }else{
      stageBody.replaceChildren(overlay);
    }
    document.body.style.overflow='hidden';
  }

  function observeInlineDialogs(){
    const observer=new MutationObserver(()=>{
      document.querySelectorAll('.pdfadv-overlay.open,.pdfocr-overlay.open').forEach(inlineOpenOverlay);
    });
    observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
  }

  function selectDefault(){
    const preferred=tools.find(tool=>tool.name==='PDF 합치기')||tools.find(tool=>tool.status!=='planned')||tools[0];
    if(preferred)activateTool(preferred.id);
  }

  function install(){
    installStyle();removeSeparatedTools();normalizeHeader();collectTools();installShell();observeInlineDialogs();selectDefault();
    document.documentElement.dataset.pdfWorkspaceSinglePage='ready';
    document.documentElement.dataset.pdfUtility='ready';
    document.documentElement.dataset.pdfUtilityLayout='split';
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();

  window.ProgramStudioPdfSinglePageWorkspace=Object.freeze({
    groups:GROUPS,
    selectTool:activateTool,
    setGroup(group){const first=tools.find(tool=>tool.group===group);return first?activateTool(first.id):false;},
    get activeGroup(){return activeGroup;},
    get embeddedKind(){return embeddedKind;},
    get currentTool(){return currentTool?.name||null;},
    get tools(){return tools.map(tool=>({name:tool.name,group:tool.group,status:tool.status}));},
    stage:'pdf-utility-split-workspace-v3'
  });
})();