// Home quick-start workflow for print-production users.
(function(){
  'use strict';
  if(window.__homePrintWorkflowV1)return;
  window.__homePrintWorkflowV1=true;
  const path=location.pathname.replace(/\/+$/,'')||'/';
  if(path!=='/'&&path!=='/index.html')return;

  function installStyles(){
    if(document.getElementById('homePrintWorkflowStyles'))return;
    const style=document.createElement('style');
    style.id='homePrintWorkflowStyles';
    style.textContent=`
      .hpw{max-width:1180px;margin:-10px auto 30px;padding:0 22px;position:relative;z-index:3}.hpw-box{background:#fff;border:1px solid #dde6ef;border-radius:18px;padding:15px 16px;box-shadow:0 12px 32px rgba(15,23,42,.07)}.hpw-head{display:flex;align-items:center;gap:10px;margin-bottom:11px}.hpw-mark{width:34px;height:34px;border-radius:10px;background:#eafaf7;color:#0f766e;display:grid;place-items:center;font-size:17px}.hpw-title{font-size:13px;font-weight:950;color:#16324f}.hpw-sub{font-size:9px;color:#64748b;margin-top:2px}.hpw-steps{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.hpw-step{position:relative;display:flex;gap:9px;align-items:center;padding:10px 11px;border:1px solid #e2e8f0;border-radius:12px;background:#f8fafc;text-decoration:none;color:#334155;min-width:0;transition:.16s}.hpw-step:hover{border-color:#8ccad1;background:#f2fcfd;transform:translateY(-1px)}.hpw-num{width:25px;height:25px;border-radius:8px;background:#12396d;color:#fff;display:grid;place-items:center;font-size:10px;font-weight:950;flex:0 0 auto}.hpw-step strong{display:block;font-size:10px;font-weight:950}.hpw-step small{display:block;font-size:8px;color:#64748b;line-height:1.4;margin-top:2px}.hpw-arrow{position:absolute;right:-8px;z-index:2;width:16px;height:16px;border-radius:50%;background:#fff;border:1px solid #dbe4ec;display:grid;place-items:center;color:#78909c;font-size:9px}.hpw-step:last-child .hpw-arrow{display:none}.hpw-note{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-top:10px;padding-top:9px;border-top:1px dashed #e2e8f0;font-size:9px;color:#64748b}.hpw-note strong{color:#0f766e}.hpw-note a{color:#1769e0;text-decoration:none;font-weight:900;white-space:nowrap}
      @media(max-width:760px){.hpw{padding:0 13px;margin:-2px auto 22px}.hpw-steps{grid-template-columns:1fr}.hpw-arrow{display:none}.hpw-note{align-items:flex-start;flex-direction:column}}
    `;
    document.head.appendChild(style);
  }

  function make(){
    if(document.getElementById('homePrintWorkflow'))return true;
    const hero=document.getElementById('hero');
    if(!hero)return false;
    installStyles();
    const section=document.createElement('section');
    section.id='homePrintWorkflow';
    section.className='hpw';
    section.setAttribute('aria-label','인쇄 작업 빠른 시작');
    section.innerHTML=`<div class="hpw-box">
      <div class="hpw-head"><div class="hpw-mark">🖨️</div><div><div class="hpw-title">인쇄 작업 빠른 시작</div><div class="hpw-sub">어디서 시작해야 할지 고민하지 않도록 실제 작업 순서대로 연결했습니다.</div></div></div>
      <div class="hpw-steps">
        <a class="hpw-step" href="/pdf-editor/"><span class="hpw-num">1</span><span><strong>PDF 편집 · 인쇄배치</strong><small>페이지 정리, N-up, 소책자, 용지 설정</small></span><span class="hpw-arrow">›</span></a>
        <a class="hpw-step" href="/pdf-preflight/"><span class="hpw-num">2</span><span><strong>인쇄 전 검사</strong><small>DPI, 폰트, 규격, 도련, RGB, 투명도 확인</small></span><span class="hpw-arrow">›</span></a>
        <a class="hpw-step" href="/pdf-editor/"><span class="hpw-num">3</span><span><strong>검사 후 PDF 저장</strong><small>편집기에서 완성본 검사 후 같은 파일 저장</small></span></a>
      </div>
      <div class="hpw-note"><span><strong>추천:</strong> 출력용 파일은 PDF 편집기의 ‘인쇄 전 검사 후 저장’을 사용하면 파일을 다시 올릴 필요가 없습니다.</span><a href="/pdf-editor/">PDF 편집기 열기 →</a></div>
    </div>`;
    hero.insertAdjacentElement('afterend',section);
    document.documentElement.dataset.homePrintWorkflow='1';
    window.HomePrintWorkflow={stage:'print-workflow-home-v1'};
    return true;
  }

  let attempts=0;
  function boot(){
    attempts+=1;
    if(make())return;
    if(attempts<80)setTimeout(boot,100);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
