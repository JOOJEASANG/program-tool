(function(){
  if(window.__pdfPreflightPanelBalanceV2)return;
  window.__pdfPreflightPanelBalanceV2=true;

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

  function applyCopy(){
    const navTitle=document.querySelector('.nav-title');
    if(navTitle)navTitle.textContent='PDF 검사 · 유틸리티';

    const hero=document.querySelector('.hero');
    if(hero){
      const badge=hero.querySelector('.hero-badge');
      const title=hero.querySelector('h1');
      const desc=hero.querySelector('p');
      if(badge)badge.textContent='PDF · PRINT CHECK';
      if(title)title.textContent='PDF 검사 · 유틸리티';
      if(desc)desc.textContent='인쇄 전 품질 점검과 PDF 암호 설정·해제를 한 화면에서 처리합니다.';
      const steps=[...hero.querySelectorAll('.hero-step')];
      const labels=['PDF 선택','인쇄 전 검사','PDF 보안 도구'];
      steps.forEach((node,index)=>{if(labels[index])node.textContent=labels[index]});
    }

    const panels=[...document.querySelectorAll('.workspace > .panel')];
    if(panels[0]){
      const kicker=panels[0].querySelector('.panel-kicker');
      const title=panels[0].querySelector('.panel-title');
      const desc=panels[0].querySelector('.panel-desc');
      if(kicker)kicker.textContent='1 · 파일 준비';
      if(title)title.textContent='PDF 파일 선택';
      if(desc)desc.textContent='한 번 선택한 PDF를 검사와 보안 도구에서 그대로 사용합니다.';
    }
    if(panels[1]){
      const kicker=panels[1].querySelector('.panel-kicker');
      const title=panels[1].querySelector('.panel-title');
      const desc=panels[1].querySelector('.panel-desc');
      if(kicker)kicker.textContent='2 · 작업 실행';
      if(title)title.textContent='검사 · 유틸리티';
      if(desc)desc.textContent='인쇄 전 검사 또는 필요한 PDF 보안 작업을 선택하세요.';
    }

    const checkBtn=document.getElementById('checkBtn');
    if(checkBtn){
      checkBtn.classList.add('action-btn--primary');
      const chip=checkBtn.querySelector('.action-chip');
      const desc=checkBtn.querySelector('.action-desc');
      if(chip)chip.textContent='인쇄 검사';
      normalizeCheckButtonName();
      keepCheckButtonName();
      if(desc)desc.textContent='해상도·폰트·색상·페이지 규격과 출력 위험 요소를 점검합니다.';
    }

    const encryptBtn=document.getElementById('encryptBtn');
    if(encryptBtn){
      const chip=encryptBtn.querySelector('.action-chip');
      if(chip)chip.textContent='암호 설정';
    }
    const decryptBtn=document.getElementById('decryptBtn');
    if(decryptBtn){
      const chip=decryptBtn.querySelector('.action-chip');
      if(chip)chip.textContent='암호 해제';
    }

    const results=document.getElementById('results');
    if(results&&!results.querySelector('.results-section-heading')){
      const heading=document.createElement('div');
      heading.className='results-section-heading';
      heading.innerHTML='<div><span>3 · 검사 결과</span><strong>인쇄 전 확인 항목</strong><small>점수와 경고 항목을 확인한 뒤 필요한 경우 PDF 편집기에서 수정하세요.</small></div><a href="/pdf-editor/">PDF 편집기 열기 →</a>';
      results.insertBefore(heading,results.firstChild);
    }

    document.body.dataset.pdfPreflightUi='clean-workspace-v2';
  }

  function installStyles(){
    if(document.getElementById('pdfPreflightPanelBalanceStyles'))return;
    const style=document.createElement('style');
    style.id='pdfPreflightPanelBalanceStyles';
    style.textContent=`
      :root{--nav-h:54px!important}
      body{
        background:#eef3f7!important;
        padding-top:54px!important;
      }
      .top-nav{
        height:54px!important;
        padding:0 15px!important;
        gap:12px!important;
        background:#12396d!important;
        box-shadow:0 2px 12px rgba(15,23,42,.18)!important;
      }
      .nav-back,.nav-logout{
        border-radius:8px!important;
        padding:7px 11px!important;
        font-size:11px!important;
        box-shadow:none!important;
      }
      .nav-title{font-size:14px!important;font-weight:950!important}
      .nav-user-name{font-size:11px!important}
      .container{
        max-width:1180px!important;
        padding:24px 18px 56px!important;
      }
      .hero{
        overflow:visible!important;
        background:transparent!important;
        color:#172033!important;
        border-radius:0!important;
        padding:4px 2px 18px!important;
        box-shadow:none!important;
        margin-bottom:12px!important;
        border-bottom:1px solid #dbe5ee!important;
      }
      .hero::after{display:none!important}
      .hero-badge{
        background:#e6f5f7!important;
        border:1px solid #c6e7ec!important;
        color:#0e7490!important;
        border-radius:999px!important;
        padding:5px 9px!important;
        font-size:9px!important;
        letter-spacing:.7px!important;
        margin-bottom:9px!important;
      }
      .hero h1{
        color:#12396d!important;
        font-size:clamp(25px,3vw,32px)!important;
        letter-spacing:-.9px!important;
        margin-bottom:6px!important;
      }
      .hero p{
        color:#64748b!important;
        max-width:760px!important;
        font-size:12px!important;
        line-height:1.65!important;
      }
      .hero-steps{gap:6px!important;margin-top:12px!important}
      .hero-step{
        background:#fff!important;
        border:1px solid #dbe5ee!important;
        color:#475569!important;
        border-radius:999px!important;
        padding:5px 9px!important;
        font-size:9px!important;
        font-weight:850!important;
      }
      .workspace{
        display:grid!important;
        grid-template-columns:1fr!important;
        gap:12px!important;
        align-items:start!important;
      }
      .workspace>.panel{
        height:auto!important;
        display:block!important;
      }
      .panel{
        background:#fff!important;
        border:1px solid #dfe7ef!important;
        border-radius:14px!important;
        padding:18px!important;
        box-shadow:0 5px 18px rgba(15,23,42,.055)!important;
      }
      .panel-head{margin-bottom:12px!important}
      .panel-kicker{
        color:#1d9bb2!important;
        font-size:9px!important;
        letter-spacing:.4px!important;
        margin-bottom:4px!important;
      }
      .panel-title{font-size:16px!important;letter-spacing:-.3px!important;color:#172033!important}
      .panel-desc{font-size:10px!important;line-height:1.55!important;margin-top:4px!important}
      .upload-zone{
        min-height:126px!important;
        display:grid!important;
        grid-template-columns:54px minmax(0,1fr)!important;
        grid-template-rows:auto auto auto!important;
        column-gap:15px!important;
        align-content:center!important;
        text-align:left!important;
        padding:20px 22px!important;
        border:1.5px dashed #b8c9d8!important;
        border-radius:12px!important;
        background:#f8fbfd!important;
        transform:none!important;
        box-shadow:none!important;
      }
      .upload-zone:hover,.upload-zone.dragover{
        border-color:#1d9bb2!important;
        background:#f2fbfd!important;
        transform:none!important;
        box-shadow:0 0 0 3px rgba(29,155,178,.08)!important;
      }
      .upload-zone.has-file{
        border-style:solid!important;
        border-color:#8dcbd6!important;
        background:#f3fcfd!important;
      }
      .upload-icon{
        grid-column:1!important;
        grid-row:1 / 4!important;
        width:54px!important;
        height:54px!important;
        margin:0!important;
        border-radius:12px!important;
        background:#e7f3f7!important;
        font-size:25px!important;
      }
      .upload-title{grid-column:2!important;font-size:14px!important;align-self:end!important}
      .upload-sub{grid-column:2!important;font-size:10px!important;line-height:1.5!important;margin-top:3px!important}
      .upload-filename{
        grid-column:2!important;
        margin-top:8px!important;
        border-radius:8px!important;
        padding:7px 9px!important;
        font-size:10px!important;
      }
      .workspace>.panel:first-child .status-stack{
        margin-top:12px!important;
        padding-top:0!important;
      }
      .action-grid{
        display:grid!important;
        grid-template-columns:repeat(3,minmax(0,1fr))!important;
        gap:9px!important;
      }
      .action-btn{
        min-height:112px!important;
        border:1px solid #dfe7ef!important;
        border-radius:11px!important;
        padding:13px!important;
        background:#fff!important;
        transform:none!important;
        box-shadow:none!important;
      }
      .action-btn:hover:not(:disabled){
        border-color:#91bdca!important;
        background:#f8fcfd!important;
        transform:none!important;
        box-shadow:0 6px 16px rgba(18,57,109,.07)!important;
      }
      .action-btn--primary{
        border-color:#a9c8e4!important;
        background:#f7fbff!important;
      }
      .action-btn--primary:hover:not(:disabled){background:#f1f8ff!important;border-color:#78a9d3!important}
      .action-icon{
        width:36px!important;
        height:36px!important;
        border-radius:9px!important;
        font-size:18px!important;
        margin-bottom:9px!important;
      }
      .action-name{font-size:12px!important}
      .action-desc{font-size:9px!important;line-height:1.45!important;margin-top:3px!important;padding-right:4px!important}
      .action-chip{right:9px!important;top:9px!important;padding:3px 6px!important;font-size:8px!important}
      .workspace>.panel:nth-child(2) .reset-bar-btn{
        width:auto!important;
        min-width:0!important;
        margin:11px 0 0 auto!important;
        padding:7px 10px!important;
        border-radius:8px!important;
        display:flex!important;
      }
      .reset-bar-icon{width:24px!important;height:24px!important;border-radius:7px!important;font-size:15px!important}
      .reset-bar-btn strong{font-size:10px!important}
      .reset-bar-btn small{display:none!important}
      .progress-box{border-radius:11px!important;padding:13px 14px!important;margin-bottom:8px!important}
      .check-status,.error-box{border-radius:9px!important;padding:9px 11px!important;font-size:10px!important;margin-bottom:8px!important}
      #results{margin-top:14px!important;scroll-margin-top:68px}
      .results-section-heading{
        display:flex;
        align-items:flex-end;
        justify-content:space-between;
        gap:18px;
        margin:0 2px 10px;
      }
      .results-section-heading div{min-width:0}
      .results-section-heading span{display:block;font-size:9px;font-weight:950;color:#1d9bb2;margin-bottom:4px}
      .results-section-heading strong{display:block;font-size:17px;font-weight:950;color:#172033;letter-spacing:-.3px}
      .results-section-heading small{display:block;margin-top:4px;color:#64748b;font-size:9px;line-height:1.5}
      .results-section-heading a{
        flex:0 0 auto;
        text-decoration:none;
        border:1px solid #d7e0e9;
        background:#fff;
        color:#12396d;
        border-radius:8px;
        padding:7px 10px;
        font-size:9px;
        font-weight:900;
      }
      .results-header{
        border-radius:13px!important;
        padding:15px 17px!important;
        margin-bottom:9px!important;
        box-shadow:0 4px 15px rgba(15,23,42,.045)!important;
      }
      .score-ring{width:58px!important;height:58px!important;font-size:18px!important}
      .results-filename{font-size:13px!important}
      .results-pages,.results-summary{font-size:10px!important;margin-top:3px!important}
      .checks-grid{grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:8px!important}
      .check-card{border-radius:11px!important;padding:12px!important;gap:9px!important}
      .check-badge{width:25px!important;height:25px!important;border-radius:7px!important;font-size:12px!important}
      .check-label{font-size:11px!important}
      .check-detail{font-size:9px!important;line-height:1.45!important;margin-top:3px!important}
      .page-tag{font-size:8px!important;padding:2px 5px!important}
      .tool-modal-box{border-radius:14px!important;padding:20px!important}
      .tool-modal-title{font-size:16px!important}
      @media(max-width:900px){
        .checks-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}
      }
      @media(max-width:700px){
        .container{padding:18px 12px 42px!important}
        .hero{padding-top:2px!important}
        .hero-steps{display:flex!important}
        .action-grid{grid-template-columns:1fr!important}
        .action-btn{min-height:94px!important}
        .checks-grid{grid-template-columns:1fr!important}
        .results-section-heading{align-items:flex-start;flex-direction:column!important;gap:9px!important}
        .upload-zone{
          display:block!important;
          text-align:center!important;
          padding:18px 14px!important;
        }
        .upload-icon{margin:0 auto 9px!important;width:48px!important;height:48px!important}
        .upload-filename{margin-top:9px!important}
      }
      @media(max-width:520px){
        .nav-title{font-size:12px!important}
        .hero h1{font-size:24px!important}
        .hero-step{font-size:8px!important;padding:4px 7px!important}
      }
    `;
    document.head.appendChild(style);
  }

  function boot(){
    if(document.body)document.body.dataset.pdfPreflightUi='clean-workspace-v2';
    installStyles();
    applyCopy();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();