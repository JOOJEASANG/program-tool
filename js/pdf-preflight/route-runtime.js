// Canonical runtime owner for the PDF inspection + utility route.
(function(){
  'use strict';
  if(window.__pdfPreflightRouteRuntimeV1)return;
  window.__pdfPreflightRouteRuntimeV1=true;

  const context=window.ProgramStudioPreflightRuntimeContext||{};
  const load=typeof context.load==='function'?context.load:null;
  if(!load)throw new Error('PDF preflight runtime loader context is unavailable');

  const MODULES=Object.freeze([
    {id:'programShellUnifyScriptV1',src:'/js/program-shell-unify.js?v=20260824-1'},
    {id:'pdfCheckerFinalGuardScript',src:'/js/pdf-checker-final-guard.js?v=20260831-1'},
    {id:'pdfUtilityScriptV1',src:'/js/pdf-utility.js?v=20260831-1'},
    {id:'pdfUtilityLocalProcessingScriptV1',src:'/js/pdf-utility/local-processing.js?v=20260904-1'},
    {id:'pdfUtilityPageExtractScriptV1',src:'/js/pdf-utility/page-extract.js?v=20260904-1'},
    {id:'pdfUtilityPageOrganizeScriptV1',src:'/js/pdf-utility/page-organize.js?v=20260904-1'},
    {id:'pdfUtilityVisualPageOrganizerScriptV1',src:'/js/pdf-utility/page-visual-organizer.js?v=20260904-1'},
    {id:'pdfUtilityBackgroundMarginScriptV2',src:'/js/pdf-utility-margin-crop.js?v=20260904-2'},
    {id:'pdfUtilityImageConverterScriptV1',src:'/js/pdf-utility-image-converter.js?v=20260819-1'},
    {id:'pdfUtilityImageConverterFinalizeScriptV1',src:'/js/pdf-utility-image-converter-finalize.js?v=20260827-2'},
    {id:'pdfSecurityLargeFileScriptV1',src:'/js/pdf-utility/security-large-file.js?v=20260831-2'},
    {id:'pdfUtilityWideLayoutScriptV1',src:'/js/pdf-utility-wide-layout.js?v=20260821-1'},
    {id:'pdfUtilityPanelResizerScriptV1',src:'/js/pdf-utility-panel-resizer.js?v=20260823-1'},
    {id:'pdfUtilityCostGuardScriptV2',src:'/js/pdf-utility-cost-guard-v2.js?v=20260831-2'},
    {id:'pdfUtilityFinalizeScriptV1',src:'/js/pdf-utility-finalize.js?v=20260831-2'},
    {id:'pdfAllInOneStage1ScriptV1',src:'/js/pdf-all-in-one-stage1.js?v=20260831-2'},
    {id:'pdfPrintReadinessScriptV1',src:'/js/pdf-print-readiness.js?v=20260831-1'},
    {id:'pdfPrintAutoFixScriptV1',src:'/js/pdf-print-auto-fix.js?v=20260831-1'},
    {id:'pdfLargeOutputTilingScriptV1',src:'/js/pdf-large-output-tiling.js?v=20260831-1'},
    {id:'pdfPreflightWorkflowV2Script',src:'/js/pdf-preflight/workflow-v2.js?v=20260831-1'},
    {id:'pdfPreflightOutputToolDockScriptV1',src:'/js/pdf-preflight/output-panel-tool-dock.js?v=20260903-3'},
    {id:'pdfPreflightPanelBalanceScriptV1',src:'/js/pdf-preflight-panel-balance.js?v=20260831-2'}
  ]);

  const MENU_LABELS=Object.freeze({
    checkBtn:'PDF 검사',
    pdfUtilityMergeBtn:'PDF 합치기',
    pdfUtilityBackgroundBtn:'배경 지우기',
    pdfUtilityCompressBtn:'용량 줄이기',
    pdfUtilityRepairBtn:'PDF 복구',
    encryptBtn:'암호 설정',
    decryptBtn:'암호 해제',
    pdfAllInOneExtractBtn:'페이지 골라 저장',
    pdfAllInOneBlankBtn:'빈 페이지 삭제',
    pdfUtilityExtractBtn:'페이지 골라 저장',
    pdfUtilityOrganizeBtn:'페이지 삭제·정렬',
    pdfUtilityVisualOrganizeBtn:'페이지 보기·정리',
    pdfUtilityImageConverterCard:'PDF·이미지 변환',
    pdfLargeOutputTilingCard:'대형 분할 인쇄'
  });

  function installMenuStyles(){
    if(document.getElementById('pdfUtilityPlainMenuLabelStyles'))return;
    const style=document.createElement('style');
    style.id='pdfUtilityPlainMenuLabelStyles';
    style.textContent=`
      .action-btn .action-name[data-pdf-plain-menu-label]{display:block!important;font-size:0!important;line-height:1.32!important;min-height:17px;word-break:keep-all}
      .action-btn .action-name[data-pdf-plain-menu-label]::after{content:attr(data-pdf-plain-menu-label);font-size:13px!important;line-height:1.32!important;font-weight:950!important;letter-spacing:-.18px;color:#0f172a;word-break:keep-all}
      .pdf-preflight-left-tools .pdfuw-section-title{font-size:13px!important;line-height:1.35!important}
      .pdf-preflight-left-tools>.panel-head .panel-title{font-size:17px!important}
    `;
    document.head.appendChild(style);
  }

  function setText(selector,value){
    const node=document.querySelector(selector);
    if(node&&node.textContent!==value)node.textContent=value;
  }

  function applyMenuLabels(){
    installMenuStyles();
    document.querySelectorAll('.action-btn').forEach(button=>{
      const label=MENU_LABELS[button.id];
      const name=button.querySelector('.action-name');
      if(!label||!name)return;
      name.dataset.pdfPlainMenuLabel=label;
      const desc=(button.querySelector('.action-desc')?.textContent||'').trim();
      button.setAttribute('aria-label',desc?`${label}. ${desc}`:label);
    });
    setText('#pdfPreflightLeftTools > .panel-head .panel-title','PDF 작업 메뉴');
    setText('#pdfPreflightLeftTools > .panel-head .panel-desc','원하는 PDF 작업을 선택하세요.');
    setText('#pdfUtilityWideBatchSection .pdfuw-section-kicker','여러 파일');
    setText('#pdfUtilityWideBatchSection .pdfuw-section-title','여러 PDF 작업');
    setText('#pdfUtilityWideBatchSection .pdfuw-section-desc','등록한 PDF 전체에 적용됩니다.');
    setText('#pdfUtilityWideSingleSection .pdfuw-section-kicker','한 파일');
    setText('#pdfUtilityWideSingleSection .pdfuw-section-title','선택 PDF 작업');
    setText('#pdfUtilityWideSingleSection .pdfuw-section-desc','선택한 PDF 한 개에만 적용됩니다.');
    document.documentElement.dataset.pdfUtilityPlainMenuLabels='2';
  }

  let menuObserver=null;
  function startMenuLabels(){
    applyMenuLabels();
    if(!menuObserver&&document.body){
      let queued=false;
      menuObserver=new MutationObserver(()=>{
        if(queued)return;
        queued=true;
        queueMicrotask(()=>{queued=false;applyMenuLabels();});
      });
      menuObserver.observe(document.body,{childList:true,subtree:true,characterData:true});
    }
    [80,220,500,1000,1800,3000].forEach(delay=>setTimeout(applyMenuLabels,delay));
  }

  let readyPromise=null;
  async function loadAll(){
    if(readyPromise)return readyPromise;
    readyPromise=(async()=>{
      const loaded=[];
      for(const entry of MODULES){
        await load(entry.id,entry.src);
        loaded.push(entry.id);
      }
      startMenuLabels();
      document.documentElement.dataset.pdfPreflightRuntime='canonical-v1';
      return loaded;
    })();
    return readyPromise;
  }

  window.ProgramStudioPreflightRuntime={
    modules:MODULES,
    loadAll,
    menuLabels:MENU_LABELS,
    stage:'canonical-preflight-runtime-v1'
  };
})();
