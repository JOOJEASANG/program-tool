(function(){
  if(window.__pdfPreflightPanelBalanceV2)return;
  window.__pdfPreflightPanelBalanceV2=true;

  function setText(node,value){
    if(node&&node.textContent!==value)node.textContent=value;
  }

  function normalizeCheckButtonName(){
    const name=document.querySelector('#checkBtn .action-name');
    if(name&&name.textContent.trim()==='문서 검수')name.textContent='인쇄 전 검사';
  }

  function keepCheckButtonName(){
    const name=document.querySelector('#checkBtn .action-name');
    if(!name||name.__pdfPreflightNameGuard)return;
    name.__pdfPreflightNameGuard=true;
    new MutationObserver(()=>normalizeCheckButtonName()).observe(name,{childList:true,subtree:true,characterData:true});
  }

  function makeOutputHead(){
    const head=document.createElement('div');
    head.className='panel-head pdf-preflight-output-head';
    head.innerHTML='<div><div class="panel-kicker">3 · 진행 · 결과</div><h2 class="panel-title">작업 진행 · 결과</h2><p class="panel-desc">검사·합치기·정리 작업의 진행 상태와 결과를 이 영역에서 확인합니다.</p></div>';
    return head;
  }

  function makeOutputEmpty(){
    const empty=document.createElement('div');
    empty.id='pdfPreflightOutputEmpty';
    empty.className='pdf-preflight-output-empty';
    empty.innerHTML='<div class="pdf-preflight-output-empty-icon">📋</div><strong>작업 결과가 여기에 표시됩니다.</strong><span>왼쪽에서 PDF를 등록하고 검사·합치기·유틸리티를 실행하세요.<br>진행률, 상태 메시지, 검사 결과를 한 화면에서 확인할 수 있습니다.</span>';
    return empty;
  }

  function normalizeQuickActions(){
    const singleGrid=document.querySelector('#pdfUtilityWideSingleSection .pdfuw-action-grid');
    if(!singleGrid)return;
    ['pdfAllInOneExtractBtn','pdfAllInOneBlankBtn'].forEach(id=>{
      const button=document.getElementById(id);
      if(button&&button.parentElement!==singleGrid)singleGrid.appendChild(button);
    });
  }

  function arrangeWorkspace(){
    const workspace=document.querySelector('.workspace');
    if(!workspace)return false;
    const panels=[...workspace.children].filter(node=>node.classList?.contains('panel'));
    const inputPanel=panels[0];
    const outputPanel=panels[1];
    if(!inputPanel||!outputPanel)return false;

    inputPanel.classList.add('pdf-preflight-input-panel');
    outputPanel.classList.add('pdf-preflight-output-panel');

    let tools=document.getElementById('pdfPreflightLeftTools');
    if(!tools){
      tools=document.createElement('section');
      tools.id='pdfPreflightLeftTools';
      tools.className='pdf-preflight-left-tools';

      const actionHead=outputPanel.querySelector('.panel-head');
      const actionGrid=outputPanel.querySelector('.action-grid');
      const wideGroups=document.getElementById('pdfUtilityWideToolGroups');
      const reset=document.getElementById('inlineResetBtn');
      if(actionHead)tools.appendChild(actionHead);
      if(actionGrid)tools.appendChild(actionGrid);
      if(wideGroups)tools.appendChild(wideGroups);
      if(reset)tools.appendChild(reset);
      inputPanel.appendChild(tools);
    }else{
      const wideGroups=document.getElementById('pdfUtilityWideToolGroups');
      if(wideGroups&&wideGroups.parentElement!==tools)tools.appendChild(wideGroups);
      const reset=document.getElementById('inlineResetBtn');
      if(reset&&reset.parentElement!==tools)tools.appendChild(reset);
    }

    let outputHead=outputPanel.querySelector('.pdf-preflight-output-head');
    if(!outputHead){
      outputHead=makeOutputHead();
      outputPanel.prepend(outputHead);
    }

    let empty=document.getElementById('pdfPreflightOutputEmpty');
    if(!empty){
      empty=makeOutputEmpty();
      outputHead.insertAdjacentElement('afterend',empty);
    }

    const statusStack=document.querySelector('.status-stack');
    if(statusStack&&statusStack.parentElement!==outputPanel)outputPanel.appendChild(statusStack);

    const batchResults=document.getElementById('pdfUtilityBatchResults');
    if(batchResults&&batchResults.parentElement!==outputPanel)outputPanel.appendChild(batchResults);

    const results=document.getElementById('results');
    if(results&&results.parentElement!==outputPanel)outputPanel.appendChild(results);

    normalizeQuickActions();
    return true;
  }

  function applyCopy(){
    const navTitle=document.querySelector('.nav-title');
    setText(navTitle,'PDF 검사 · 유틸리티');

    const hero=document.querySelector('.hero');
    if(hero){
      setText(hero.querySelector('.hero-badge'),'PDF · PRINT CHECK');
      setText(hero.querySelector('h1'),'PDF 검사 · 유틸리티');
      setText(hero.querySelector('p'),'PDF를 등록한 뒤 왼쪽에서 검사·합치기·보안·정리 도구를 실행하고, 오른쪽에서 진행 상태와 결과를 확인합니다.');
      const steps=[...hero.querySelectorAll('.hero-step')];
      const labels=['PDF 등록','검사 · 유틸리티','진행 · 결과 확인'];
      steps.forEach((node,index)=>{if(labels[index])setText(node,labels[index]);});
    }

    const inputPanel=document.querySelector('.pdf-preflight-input-panel');
    if(inputPanel){
      const head=inputPanel.querySelector(':scope > .panel-head');
      if(head){
        setText(head.querySelector('.panel-kicker'),'1 · 파일 준비');
        setText(head.querySelector('.panel-title'),'PDF 파일 업로드');
        setText(head.querySelector('.panel-desc'),'PDF를 등록하고 파일 목록에서 검사·개별 작업에 사용할 파일을 선택합니다.');
      }
    }

    const tools=document.getElementById('pdfPreflightLeftTools');
    if(tools){
      const head=tools.querySelector(':scope > .panel-head');
      if(head){
        setText(head.querySelector('.panel-kicker'),'2 · 검사 · 유틸리티');
        setText(head.querySelector('.panel-title'),'검사 · PDF 유틸리티');
        setText(head.querySelector('.panel-desc'),'등록 파일 전체 검사·합치기와 선택 파일 보안·정리 도구를 실행합니다.');
      }
    }

    const checkBtn=document.getElementById('checkBtn');
    if(checkBtn){
      checkBtn.classList.add('action-btn--primary');
      const chip=checkBtn.querySelector('.action-chip');
      const desc=checkBtn.querySelector('.action-desc');
      if(chip)setText(chip,'인쇄 검사');
      normalizeCheckButtonName();
      keepCheckButtonName();
      if(desc)setText(desc,'해상도·폰트·색상·페이지 규격과 출력 위험 요소를 점검합니다.');
    }

    const encryptBtn=document.getElementById('encryptBtn');
    if(encryptBtn){const chip=encryptBtn.querySelector('.action-chip');if(chip)setText(chip,'암호 설정');}
    const decryptBtn=document.getElementById('decryptBtn');
    if(decryptBtn){const chip=decryptBtn.querySelector('.action-chip');if(chip)setText(chip,'암호 해제');}

    const results=document.getElementById('results');
    if(results&&!results.querySelector('.results-section-heading')){
      const heading=document.createElement('div');
      heading.className='results-section-heading';
      heading.innerHTML='<div><span>상세 검사 결과</span><strong>인쇄 전 확인 항목</strong><small>점수와 경고 항목을 확인하고 필요한 경우 PDF 편집기에서 수정하세요.</small></div><a href="/pdf-editor/">PDF 편집기 열기 →</a>';
      results.insertBefore(heading,results.firstChild);
    }
  }

  function installStyles(){
    if(document.getElementById('pdfPreflightPanelBalanceStyles'))return;
    const style=document.createElement('style');
    style.id='pdfPreflightPanelBalanceStyles';
    style.textContent=`
      :root{--nav-h:54px!important}
      body{background:#eef3f7!important;padding-top:54px!important}
      .top-nav{height:54px!important;padding:0 15px!important;gap:12px!important;background:#12396d!important;box-shadow:0 2px 12px rgba(15,23,42,.18)!important}
      .nav-back,.nav-logout{border-radius:8px!important;padding:7px 11px!important;font-size:11px!important;box-shadow:none!important}
      .nav-title{font-size:14px!important;font-weight:950!important}.nav-user-name{font-size:11px!important}
      .container,body.pdfu-wide-layout .container{width:min(100%,1440px)!important;max-width:1440px!important;padding:22px 18px 56px!important}
      .hero,body.pdfu-wide-layout .hero{overflow:visible!important;background:transparent!important;color:#172033!important;border-radius:0!important;padding:4px 2px 16px!important;box-shadow:none!important;margin-bottom:12px!important;border-bottom:1px solid #dbe5ee!important}
      .hero::after{display:none!important}.hero-badge{background:#e6f5f7!important;border:1px solid #c6e7ec!important;color:#0e7490!important;border-radius:999px!important;padding:5px 9px!important;font-size:9px!important;letter-spacing:.7px!important;margin-bottom:8px!important}
      .hero h1,body.pdfu-wide-layout .hero h1{color:#12396d!important;font-size:clamp(25px,3vw,31px)!important;letter-spacing:-.9px!important;margin-bottom:5px!important}
      .hero p{color:#64748b!important;max-width:900px!important;font-size:11px!important;line-height:1.6!important}.hero-steps{gap:6px!important;margin-top:10px!important}.hero-step{background:#fff!important;border:1px solid #dbe5ee!important;color:#475569!important;border-radius:999px!important;padding:5px 9px!important;font-size:9px!important;font-weight:850!important}

      .workspace,body.pdfu-wide-layout .workspace{display:grid!important;grid-template-columns:minmax(350px,420px) minmax(0,1fr)!important;gap:16px!important;align-items:start!important}
      .workspace>.panel,body.pdfu-wide-layout .workspace>.panel{height:auto!important;min-width:0!important;background:#fff!important;border:1px solid #dfe7ef!important;border-radius:14px!important;padding:17px!important;box-shadow:0 5px 18px rgba(15,23,42,.055)!important}
      body.pdfu-wide-layout .workspace>.panel:first-child{position:static!important;top:auto!important;max-height:none!important;overflow:visible!important;scrollbar-gutter:auto!important}
      .panel-head{margin-bottom:11px!important}.panel-kicker{color:#1d9bb2!important;font-size:9px!important;letter-spacing:.4px!important;margin-bottom:4px!important}.panel-title{font-size:16px!important;letter-spacing:-.3px!important;color:#172033!important}.panel-desc{font-size:10px!important;line-height:1.55!important;margin-top:4px!important}

      .pdf-preflight-input-panel{align-self:start!important}.pdf-preflight-left-tools{margin-top:15px;padding-top:15px;border-top:1px solid #e2e8f0}.pdf-preflight-left-tools>.panel-head{margin-bottom:10px!important}
      .upload-zone{min-height:112px!important;display:grid!important;grid-template-columns:48px minmax(0,1fr)!important;grid-template-rows:auto auto auto!important;column-gap:13px!important;align-content:center!important;text-align:left!important;padding:17px 18px!important;border:1.5px dashed #b8c9d8!important;border-radius:11px!important;background:#f8fbfd!important;transform:none!important;box-shadow:none!important}
      .upload-zone:hover,.upload-zone.dragover{border-color:#1d9bb2!important;background:#f2fbfd!important;transform:none!important;box-shadow:0 0 0 3px rgba(29,155,178,.08)!important}.upload-zone.has-file{border-style:solid!important;border-color:#8dcbd6!important;background:#f3fcfd!important}
      .upload-icon{grid-column:1!important;grid-row:1 / 4!important;width:48px!important;height:48px!important;margin:0!important;border-radius:11px!important;background:#e7f3f7!important;font-size:22px!important}.upload-title{grid-column:2!important;font-size:13px!important;align-self:end!important}.upload-sub{grid-column:2!important;font-size:9px!important;line-height:1.45!important;margin-top:3px!important}.upload-filename{grid-column:2!important;margin-top:7px!important;border-radius:8px!important;padding:6px 8px!important;font-size:9px!important}
      .pdfu-file-list{margin-top:10px!important;border-radius:10px!important}.pdfu-file-head{padding:8px 9px!important;font-size:9px!important}.pdfu-file-items{max-height:250px!important}.pdfu-file-row{padding:8px 9px!important;gap:7px!important}.pdfu-file-name{font-size:10px!important}.pdfu-file-meta{font-size:8px!important}.pdfu-limit-note{font-size:8px!important;margin-top:7px!important;padding:7px 8px!important}

      .pdf-preflight-left-tools .action-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:8px!important}.pdf-preflight-left-tools .action-btn{min-height:102px!important;border:1px solid #dfe7ef!important;border-radius:10px!important;padding:11px!important;background:#fff!important;transform:none!important;box-shadow:none!important}.pdf-preflight-left-tools .action-btn:hover:not(:disabled){border-color:#91bdca!important;background:#f8fcfd!important;transform:none!important;box-shadow:0 5px 14px rgba(18,57,109,.07)!important}.pdf-preflight-left-tools .action-btn--primary{border-color:#a9c8e4!important;background:#f7fbff!important}.pdf-preflight-left-tools .action-icon{width:32px!important;height:32px!important;border-radius:8px!important;font-size:16px!important;margin-bottom:7px!important}.pdf-preflight-left-tools .action-name{font-size:11px!important}.pdf-preflight-left-tools .action-desc{font-size:8px!important;line-height:1.4!important;margin-top:3px!important;padding-right:2px!important}.pdf-preflight-left-tools .action-chip{right:8px!important;top:8px!important;padding:3px 5px!important;font-size:7px!important}
      body.pdfu-wide-layout .pdf-preflight-left-tools .pdfuw-tool-groups{display:grid!important;gap:10px!important}.pdf-preflight-left-tools .pdfuw-tool-section{padding:11px!important;border-radius:11px!important}.pdf-preflight-left-tools .pdfuw-section-head{margin-bottom:8px!important}.pdf-preflight-left-tools .pdfuw-section-title{font-size:12px!important}.pdf-preflight-left-tools .pdfuw-section-desc{font-size:8px!important}.pdf-preflight-left-tools .pdfuw-section-kicker,.pdf-preflight-left-tools .pdfuw-section-badge{font-size:7px!important}.pdf-preflight-left-tools .pdfuw-action-grid.batch,.pdf-preflight-left-tools .pdfuw-action-grid.single{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:7px!important}.pdf-preflight-left-tools .pdfuw-action-grid .action-btn{min-height:96px!important;padding:10px!important}.pdf-preflight-left-tools .pdfuw-active-file{padding:7px 8px!important;margin-bottom:8px!important}.pdf-preflight-left-tools .pdfuw-active-file-label,.pdf-preflight-left-tools .pdfuw-active-file-name{font-size:8px!important}
      #inlineResetBtn{width:100%!important;margin-top:10px!important;padding:8px 10px!important;border-radius:8px!important}.reset-bar-icon{width:25px!important;height:25px!important;border-radius:7px!important;font-size:15px!important}.reset-bar-btn strong{font-size:9px!important}.reset-bar-btn small{display:none!important}

      .pdf-preflight-output-panel{min-height:620px!important;align-self:stretch!important}.pdf-preflight-output-head{padding-bottom:10px;border-bottom:1px solid #e7edf3;margin-bottom:12px!important}.pdf-preflight-output-empty{min-height:360px;border:1px dashed #cfdae5;border-radius:12px;background:linear-gradient(180deg,#fbfdff,#f7fafc);display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:30px 20px;color:#64748b}.pdf-preflight-output-empty-icon{width:54px;height:54px;border-radius:14px;background:#edf4f8;display:grid;place-items:center;font-size:25px;margin-bottom:12px}.pdf-preflight-output-empty strong{font-size:14px;color:#334155;margin-bottom:6px}.pdf-preflight-output-empty span{font-size:9px;line-height:1.6}
      .pdf-preflight-output-panel:has(#progressBox[style*="display: block"],.check-status.show,.error-box.show,#pdfUtilityBatchResults.show,#results[style*="display: block"]) .pdf-preflight-output-empty{display:none!important}
      .pdf-preflight-output-panel .status-stack{margin:0 0 10px!important}.pdf-preflight-output-panel .progress-box{border-radius:10px!important;padding:12px 13px!important;margin-bottom:8px!important}.pdf-preflight-output-panel .check-status,.pdf-preflight-output-panel .error-box{border-radius:9px!important;padding:9px 11px!important;font-size:10px!important;margin-bottom:8px!important}
      body.pdfu-wide-layout .pdf-preflight-output-panel #pdfUtilityBatchResults,.pdf-preflight-output-panel #pdfUtilityBatchResults{width:100%!important;margin-top:10px!important;padding:0!important;border:0!important;border-radius:0!important;background:transparent!important;box-shadow:none!important}.pdf-preflight-output-panel .pdfu-summary{border-radius:11px!important;padding:12px 13px!important;margin-bottom:8px!important}.pdf-preflight-output-panel .pdfu-summary strong{font-size:12px!important}.pdf-preflight-output-panel .pdfu-summary span{font-size:9px!important}.pdf-preflight-output-panel .pdfu-result-list,body.pdfu-wide-layout .pdf-preflight-output-panel #pdfUtilityBatchResults .pdfu-result-list{grid-template-columns:1fr!important;gap:7px!important}.pdf-preflight-output-panel .pdfu-result-row{border-radius:10px!important;padding:10px 11px!important}.pdf-preflight-output-panel .pdfu-result-name{font-size:10px!important}.pdf-preflight-output-panel .pdfu-result-meta{font-size:8px!important}
      #results,body.pdfu-wide-layout .pdf-preflight-output-panel #results{width:100%!important;margin-top:12px!important;padding:0!important;border:0!important;border-radius:0!important;background:transparent!important;box-shadow:none!important;scroll-margin-top:68px}.results-section-heading{display:flex;align-items:flex-end;justify-content:space-between;gap:14px;margin:0 1px 9px}.results-section-heading div{min-width:0}.results-section-heading span{display:block;font-size:8px;font-weight:950;color:#1d9bb2;margin-bottom:3px}.results-section-heading strong{display:block;font-size:15px;font-weight:950;color:#172033;letter-spacing:-.3px}.results-section-heading small{display:block;margin-top:3px;color:#64748b;font-size:8px;line-height:1.5}.results-section-heading a{flex:0 0 auto;text-decoration:none;border:1px solid #d7e0e9;background:#fff;color:#12396d;border-radius:8px;padding:6px 8px;font-size:8px;font-weight:900}.results-header{border-radius:11px!important;padding:13px 14px!important;margin-bottom:8px!important;box-shadow:none!important}.score-ring{width:54px!important;height:54px!important;font-size:17px!important}.results-filename{font-size:12px!important}.results-pages,.results-summary{font-size:9px!important;margin-top:3px!important}.checks-grid,body.pdfu-wide-layout .pdf-preflight-output-panel #results .checks-grid{grid-template-columns:repeat(auto-fit,minmax(220px,1fr))!important;gap:7px!important}.check-card{border-radius:10px!important;padding:10px!important;gap:8px!important}.check-badge{width:24px!important;height:24px!important;border-radius:7px!important;font-size:11px!important}.check-label{font-size:10px!important}.check-detail{font-size:8px!important;line-height:1.45!important;margin-top:3px!important}.page-tag{font-size:7px!important;padding:2px 4px!important}
      .tool-modal-box{border-radius:14px!important;padding:20px!important}.tool-modal-title{font-size:16px!important}

      @media(max-width:1050px){.workspace,body.pdfu-wide-layout .workspace{grid-template-columns:minmax(320px,380px) minmax(0,1fr)!important}.pdf-preflight-output-panel{min-height:560px!important}.checks-grid,body.pdfu-wide-layout .pdf-preflight-output-panel #results .checks-grid{grid-template-columns:repeat(2,minmax(180px,1fr))!important}}
      @media(max-width:820px){.container,body.pdfu-wide-layout .container{padding:18px 12px 42px!important}.workspace,body.pdfu-wide-layout .workspace{grid-template-columns:1fr!important}.pdf-preflight-output-panel{min-height:420px!important}.pdf-preflight-output-empty{min-height:250px}.pdf-preflight-left-tools .pdfuw-action-grid.single{grid-template-columns:repeat(2,minmax(0,1fr))!important}}
      @media(max-width:560px){.nav-title{font-size:12px!important}.hero h1{font-size:24px!important}.hero-step{font-size:8px!important;padding:4px 7px!important}.pdf-preflight-left-tools .action-grid,.pdf-preflight-left-tools .pdfuw-action-grid.batch,.pdf-preflight-left-tools .pdfuw-action-grid.single{grid-template-columns:1fr!important}.checks-grid,body.pdfu-wide-layout .pdf-preflight-output-panel #results .checks-grid{grid-template-columns:1fr!important}.results-section-heading{align-items:flex-start;flex-direction:column!important;gap:8px!important}.upload-zone{display:block!important;text-align:center!important;padding:16px 13px!important}.upload-icon{margin:0 auto 8px!important;width:46px!important;height:46px!important}.upload-filename{margin-top:8px!important}}
    `;
    document.head.appendChild(style);
  }

  function boot(){
    installStyles();
    const arranged=arrangeWorkspace();
    applyCopy();
    normalizeQuickActions();
    if(arranged&&document.body)document.body.dataset.pdfPreflightUi='clean-workspace-v2';
    document.documentElement.dataset.pdfPreflightLayout='left-tools-right-results-v1';
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();