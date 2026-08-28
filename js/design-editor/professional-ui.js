// Professional visual and workflow system for the unified print design workspace.
(function(){
  'use strict';
  if(window.__designEditorProfessionalUiV2)return;
  window.__designEditorProfessionalUiV2=true;

  const params=new URLSearchParams(location.search);
  if(params.get('embed')!=='1')return;

  function installStyles(){
    if(document.getElementById('designProfessionalUiStyles'))return;
    const style=document.createElement('style');
    style.id='designProfessionalUiStyles';
    style.textContent=`
      :root{
        --ps-workspace:#e7ecf1;--ps-panel:#ffffff;--ps-line:#d8e1e9;--ps-text:#223247;--ps-muted:#6a788a;
        --ps-primary:#173f70;--ps-accent:#157f98;--ps-focus:rgba(31,116,180,.18);--ps-success:#147a61;
      }
      .editor-shell{grid-template-columns:300px minmax(0,1fr) 306px!important;background:var(--ps-workspace)!important}
      .sidebar{padding:12px!important;gap:10px!important;background:#f7f9fb!important;border-right:1px solid var(--ps-line)!important;scrollbar-gutter:stable}
      .properties-panel{min-width:0;padding:12px!important;gap:10px!important;background:#f7f9fb!important;border-left:1px solid var(--ps-line)!important;overflow-y:auto!important;scrollbar-gutter:stable;display:flex!important;flex-direction:column!important}
      .properties-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;padding:2px 2px 1px}.properties-heading strong{color:#263b52;font-size:11.5px;font-weight:950}.properties-heading span{color:#8290a1;font-size:8.5px;font-weight:800;line-height:1.4;text-align:right}
      .side-card,.design-mode-card{position:relative;border-color:var(--ps-line)!important;border-radius:12px!important;background:var(--ps-panel)!important;box-shadow:0 1px 2px rgba(15,23,42,.025)!important}
      .side-card{padding:13px!important}.side-card[data-ps-section]::before{content:attr(data-ps-section);display:block;margin:0 0 8px;color:#7b8999;font-size:8.5px;font-weight:950;letter-spacing:.04em;text-transform:uppercase}
      #designSimpleResultTools[data-ps-section]::before{margin-bottom:5px}

      .document-title{font-size:14px!important;letter-spacing:-.15px}.document-meta{font-size:10px!important;line-height:1.45!important;margin-top:4px!important}
      .side-label{font-size:10.5px!important;letter-spacing:.01em!important;margin-bottom:8px!important}.inspector-title{font-size:13px!important;letter-spacing:-.1px}
      .inspector-note{font-size:10px!important;line-height:1.55!important;margin:5px 0 12px!important}.field label{font-size:10px!important;line-height:1.35!important;margin-bottom:5px!important}
      .check-row{font-size:10px!important;line-height:1.4!important}.readonly-value{font-size:10.5px!important;line-height:1.45!important}.layer-name{font-size:10px!important}.layer-state{font-size:8.5px!important}.layer-empty{font-size:9.5px!important;line-height:1.45!important}

      .field{margin-bottom:10px!important}.field input,.field select,.field textarea{min-height:35px!important;border-radius:8px!important;padding:7px 9px!important;font-size:11px!important;border-color:#cfd9e3!important;color:var(--ps-text)!important}
      .field textarea{min-height:72px!important}.field input:focus,.field select:focus,.field textarea:focus{border-color:#6ca6c5!important;box-shadow:0 0 0 3px var(--ps-focus)!important}
      .mini-action{min-height:31px!important;padding:6px 9px!important;font-size:9.5px!important}.add-grid button,.wide-btn,.action-grid button{min-height:35px!important;padding:8px!important;font-size:10px!important;border-radius:8px!important}
      .segmented button{min-height:32px!important;font-size:9.5px!important;padding:6px 4px!important}.layer-row{min-height:39px!important;padding:7px 8px!important}

      #designEmbeddedModeCard{padding:13px!important}#designEmbeddedModeCard .design-mode-head{gap:9px!important;margin-bottom:10px!important}#designEmbeddedModeCard .design-mode-home{width:31px!important;height:31px!important;border-radius:8px!important;font-size:12px!important}
      #designEmbeddedModeCard .design-mode-title{font-size:12.5px!important;color:var(--ps-primary)!important}#designEmbeddedModeCard .design-mode-sub{font-size:9.5px!important;line-height:1.45!important;color:var(--ps-muted)!important;margin-top:2px!important}
      #designEmbeddedModeCard .design-mode-options{margin-top:10px!important;padding-top:10px!important;border-color:#e1e7ed!important}#designEmbeddedModeCard .design-mode-note{font-size:9.5px!important;line-height:1.5!important}
      #designEmbeddedModeCard .design-mode-field{margin-bottom:7px!important}#designEmbeddedModeCard .design-mode-field label{font-size:9.5px!important;margin-bottom:4px!important}#designEmbeddedModeCard .design-mode-field select,#designEmbeddedModeCard .design-mode-field input{min-height:35px!important;padding:7px 8px!important;font-size:10.5px!important;border-radius:8px!important}
      #designEmbeddedModeCard .design-mode-apply{min-height:35px!important;font-size:10px!important;border-radius:8px!important}#designEmbeddedModeCard .design-mode-size-note{font-size:8.7px!important;line-height:1.45!important;margin-top:5px!important}

      .editor-toolbar{height:58px!important;flex-basis:58px!important;padding:0 12px!important;border-bottom-color:var(--ps-line)!important;box-shadow:0 2px 8px rgba(15,39,72,.045)!important}
      #designPrintProductTopbar .design-product-topbar-label,.design-surface-topbar-label{font-size:9.5px!important}#designPrintProductTopbar .design-product-topbar-btn{height:34px!important;border-radius:8px!important;padding:0 11px!important;font-size:10px!important;font-weight:850!important}
      #designSurfaceTopbarGroup .surface-tab{height:32px!important;padding:0 10px!important;font-size:9.5px!important}.design-top-command{height:34px!important;min-width:34px!important;padding:0 9px!important;font-size:9.5px!important;border-radius:8px!important}.design-top-command svg{width:16px!important;height:16px!important}
      .design-top-popover{border-radius:11px!important;padding:10px!important}.design-popover-title{font-size:10.5px!important}.design-insert-grid button{min-height:36px!important;font-size:9.5px!important}.design-help-list li{font-size:9.5px!important}.design-help-list kbd{font-size:8px!important}.editor-toolbar>.save-state,.save-state{font-size:9.5px!important;padding:5px 9px!important}
      .ps-pro-cta{height:35px;border:0;border-radius:9px;padding:0 13px;background:#173f70;color:#fff;font:900 10px Pretendard,"Noto Sans KR",sans-serif;cursor:pointer;white-space:nowrap;box-shadow:0 4px 12px rgba(23,63,112,.16)}.ps-pro-cta:hover{background:#12355f}.ps-pro-cta.secondary{border:1px solid #b9c9d8;background:#fff;color:#35516d;box-shadow:none}.ps-pro-cta.secondary:hover{background:#f3f7fa}

      .ps-workflowbar{height:43px;flex:0 0 43px;display:flex;align-items:center;gap:5px;padding:0 12px;background:#fbfcfd;border-bottom:1px solid #dbe3eb;overflow-x:auto;scrollbar-width:none}.ps-workflowbar::-webkit-scrollbar{display:none}.ps-workflow-title{margin-right:4px;color:#6a788a;font-size:8.5px;font-weight:950;white-space:nowrap}.ps-workflow-step{height:28px;display:inline-flex;align-items:center;gap:6px;border:1px solid #dde5ec;border-radius:8px;background:#fff;color:#526276;padding:0 9px;font:850 9px Pretendard,"Noto Sans KR",sans-serif;cursor:pointer;white-space:nowrap}.ps-workflow-step:hover{border-color:#8fb0ca;background:#f4f9fc;color:#234a6d}.ps-workflow-step b{width:17px;height:17px;border-radius:6px;display:grid;place-items:center;background:#edf2f6;color:#31536f;font-size:7.5px}.ps-workflow-step.primary{border-color:#a9d8ce;background:#eefaf7;color:#116b58}.ps-workflow-step.primary b{background:#147a61;color:#fff}.ps-workflow-spacer{flex:1;min-width:6px}.ps-workflow-note{color:#7b8898;font-size:8.5px;font-weight:750;white-space:nowrap}

      .editor-main{background:var(--ps-workspace)!important}.artboard-viewport{padding:44px!important;background-color:var(--ps-workspace)!important;background-image:linear-gradient(rgba(255,255,255,.28) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.28) 1px,transparent 1px)!important;background-size:24px 24px!important}
      .artboard{box-shadow:0 20px 52px rgba(26,39,56,.20),0 0 0 1px rgba(85,101,119,.12)!important}.panel-guide-label{font-size:8.5px!important;padding:4px 7px!important}.object-lock{font-size:8px!important;padding:2px 5px!important}.editor-footer{height:38px!important;flex-basis:38px!important;padding:0 13px!important;border-top-color:var(--ps-line)!important}.editor-status{font-size:9.5px!important;line-height:1.4!important}
      .simple-result-title{font-size:12px!important}.simple-result-sub{font-size:9px!important}.simple-result-step-label{font-size:8.5px!important}.simple-result-btn{min-height:36px!important;font-size:9.5px!important}.simple-result-output-note{font-size:8px!important}.simple-result-advanced{font-size:9px!important}

      button:focus-visible,a:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible{outline:2px solid #3d8fb4!important;outline-offset:2px!important}button{transition:border-color .12s ease,background-color .12s ease,color .12s ease,box-shadow .12s ease}
      @media(max-width:1280px){.editor-shell{grid-template-columns:282px minmax(0,1fr) 286px!important}#designPrintProductTopbar .design-product-topbar-btn{padding:0 9px!important;font-size:9.5px!important}.ps-workflow-note{display:none}}
      @media(max-width:980px){.editor-shell{grid-template-columns:1fr!important}.sidebar,.properties-panel{padding:10px!important}.properties-panel{border-left:0!important;border-top:1px solid var(--ps-line)!important}.artboard-viewport{padding:32px 16px!important}.ps-workflowbar{position:sticky;top:0;z-index:14}}
      @media(max-width:620px){.editor-toolbar{padding:7px 8px!important}#designPrintProductTopbar .design-product-topbar-btn{height:32px!important;font-size:9px!important}.artboard-viewport{padding:26px 10px!important}.ps-pro-cta.secondary{display:none}.ps-workflow-title,.ps-workflow-note{display:none}.ps-workflowbar{padding:0 8px}.ps-workflow-step{padding:0 7px}}
    `;
    document.head.appendChild(style);
  }

  function byId(id){return document.getElementById(id)}
  function project(){return window.DesignEditorApp?.project||null}

  function cardOf(id){return byId(id)?.closest?.('.side-card')||null}
  function tagSidebarSections(){
    const documentCard=cardOf('documentTitle');if(documentCard)documentCard.dataset.psSection='문서';
    const addCard=cardOf('addTitleBtn');if(addCard)addCard.dataset.psSection='내용 추가';
    const quick=byId('designSimpleResultTools');if(quick)quick.dataset.psSection='빠른 제작';
    const inspector=byId('inspector');if(inspector)inspector.dataset.psSection='선택 항목';
    const layers=cardOf('layerList');if(layers)layers.dataset.psSection='레이어';
  }

  function scrollToNode(node){
    if(!node)return false;
    try{node.scrollIntoView({behavior:'smooth',block:'nearest'});}catch(_){node.scrollIntoView();}
    return true;
  }

  function openCompose(){
    window.ProgramStudioEditorToolRail?.select?.('compose');
    return scrollToNode(byId('designSimpleResultTools')||cardOf('addTitleBtn'));
  }

  function openProduct(){
    const node=byId('designEmbeddedModeCard');
    if(node)return scrollToNode(node);
    const first=document.querySelector('#designPrintProductTopbar .design-product-topbar-btn');
    first?.focus?.();
    return Boolean(first);
  }

  function openCheck(){
    window.ProgramStudioEditorToolRail?.select?.('all');
    const node=byId('designFinalPrintCheckTools')||byId('designPrintSafetyTools')||byId('designPrintQualityTools');
    if(node)return scrollToNode(node);
    const button=[...document.querySelectorAll('button')].find(item=>/인쇄.*검사|최종.*검사|출력.*검사/.test(item.textContent||''));
    button?.focus?.();
    return Boolean(button);
  }

  function makePdf(){
    const button=document.querySelector('#designSimpleResultTools [data-simple-action="pdf"]')||document.querySelector('#designOutputTools button[data-output="pdf"]');
    if(button&&!button.disabled){button.click();return true;}
    openCompose();
    const status=byId('editorStatus');if(status){status.className='editor-status info';status.textContent='PDF 만들기 기능을 준비하는 중입니다. 잠시 후 다시 눌러 주세요.';}
    return false;
  }

  function ensureWorkflowBar(){
    if(byId('designProfessionalWorkflow'))return true;
    const toolbar=document.querySelector('.editor-main .editor-toolbar');
    if(!toolbar?.parentElement)return false;
    const bar=document.createElement('div');
    bar.id='designProfessionalWorkflow';bar.className='ps-workflowbar';bar.setAttribute('aria-label','디자인 작업 순서');
    bar.innerHTML='<span class="ps-workflow-title">작업 순서</span><button class="ps-workflow-step" type="button" data-ps-flow="product"><b>1</b>종류·규격</button><button class="ps-workflow-step" type="button" data-ps-flow="compose"><b>2</b>내용 제작</button><button class="ps-workflow-step" type="button" data-ps-flow="check"><b>3</b>인쇄 점검</button><button class="ps-workflow-step primary" type="button" data-ps-flow="output"><b>4</b>PDF 만들기</button><span class="ps-workflow-spacer"></span><span class="ps-workflow-note">자동 저장 · 300DPI 출력</span>';
    bar.addEventListener('click',event=>{
      const action=event.target.closest('[data-ps-flow]')?.dataset.psFlow;if(!action)return;
      if(action==='product')openProduct();else if(action==='compose')openCompose();else if(action==='check')openCheck();else if(action==='output')makePdf();
    });
    toolbar.insertAdjacentElement('afterend',bar);
    return true;
  }

  function ensureToolbarCtas(){
    const toolbar=document.querySelector('.editor-main .editor-toolbar');if(!toolbar)return false;
    let check=byId('designProfessionalCheckCta');
    if(!check){check=document.createElement('button');check.id='designProfessionalCheckCta';check.className='ps-pro-cta secondary';check.type='button';check.textContent='인쇄 점검';check.addEventListener('click',openCheck);toolbar.appendChild(check);}
    let pdf=byId('designProfessionalPdfCta');
    if(!pdf){pdf=document.createElement('button');pdf.id='designProfessionalPdfCta';pdf.className='ps-pro-cta';pdf.type='button';pdf.textContent='PDF 만들기';pdf.addEventListener('click',makePdf);toolbar.appendChild(pdf);}
    return true;
  }

  function syncProductLabel(){
    const p=project();if(!p)return;
    const map={cover:'책표지',poster:'포스터',flyer:'전단',invitation:'초대장·안내장',leaflet2:'2단 리플렛',leaflet3:'3단 리플렛',custom:'사용자 규격'};
    const type=window.DesignEditorDocumentTypeState?.current?.(p)||p.documentType||p.designMode;
    const title=byId('documentTitle');
    if(title&&map[type]&&(!title.textContent||title.textContent==='디자인'))title.textContent=map[type];
  }

  function sync(){
    installStyles();tagSidebarSections();ensureWorkflowBar();ensureToolbarCtas();syncProductLabel();
    document.documentElement.dataset.professionalUi='2';
    document.documentElement.dataset.designWorkspace='three-pane';
  }

  let frame=0;
  function queueSync(){if(frame)return;frame=requestAnimationFrame(()=>{frame=0;sync();});}
  function boot(){
    sync();
    const root=byId('editorShell')||document.body;
    if(typeof MutationObserver==='function')new MutationObserver(queueSync).observe(root,{childList:true,subtree:true});
    ['programstudio:design-mode-change','programstudio:document-type-change','programstudio:runtime-script-result','resize'].forEach(name=>window.addEventListener(name,queueSync));
    [120,360,900,1800].forEach(delay=>setTimeout(queueSync,delay));
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  window.DesignEditorProfessionalUi={sync,makePdf,openCheck,openCompose,stage:'professional-workspace-result-first-v2',workspaceStage:'three-pane-context-properties-v1'};
})();