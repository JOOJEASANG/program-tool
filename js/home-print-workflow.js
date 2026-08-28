// Home quick-start workflow for print-production users.
(function(){
  'use strict';
  if(window.__homePrintWorkflowV2)return;
  window.__homePrintWorkflowV2=true;
  const path=location.pathname.replace(/\/+$/,'')||'/';
  if(path!=='/'&&path!=='/index.html')return;

  function installStyles(){
    if(document.getElementById('homePrintWorkflowStyles'))return;
    const style=document.createElement('style');
    style.id='homePrintWorkflowStyles';
    style.textContent=`
      .hpw{max-width:1180px;margin:-12px auto 34px;padding:0 22px;position:relative;z-index:3}
      .hpw-box{background:#fff;border:1px solid #dbe5ee;border-radius:20px;padding:18px;box-shadow:0 14px 36px rgba(15,23,42,.075)}
      .hpw-head{display:flex;align-items:flex-start;gap:11px;margin-bottom:14px}.hpw-mark{width:38px;height:38px;border-radius:11px;background:#eafaf7;color:#0f766e;display:grid;place-items:center;font-size:18px;flex:0 0 auto}.hpw-title{font-size:15px;font-weight:950;color:#16324f;letter-spacing:-.2px}.hpw-sub{font-size:10px;color:#64748b;margin-top:3px;line-height:1.5}
      .hpw-steps{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px}.hpw-step{position:relative;display:flex;gap:10px;align-items:center;padding:13px 12px;border:1px solid #e0e7ef;border-radius:13px;background:#f8fafc;text-decoration:none;color:#334155;min-width:0;transition:.16s}.hpw-step:hover{border-color:#79b9c8;background:#f1fbfc;transform:translateY(-1px);box-shadow:0 8px 20px rgba(15,23,42,.055)}.hpw-num{width:30px;height:30px;border-radius:9px;background:#12396d;color:#fff;display:grid;place-items:center;font-size:13px;font-weight:950;flex:0 0 auto}.hpw-step strong{display:block;font-size:11px;font-weight:950;letter-spacing:-.1px}.hpw-step small{display:block;font-size:8.5px;color:#64748b;line-height:1.45;margin-top:3px}.hpw-step[data-kind="design"] .hpw-num{background:#5969dc}.hpw-step[data-kind="pdf"] .hpw-num{background:#15836b}.hpw-step[data-kind="check"] .hpw-num{background:#d97706}.hpw-step[data-kind="image"] .hpw-num{background:#a64f7c}
      .hpw-flow{display:flex;align-items:center;gap:7px;margin-top:12px;padding:10px 11px;border-top:1px dashed #dfe7ef;color:#667085;font-size:9.5px;line-height:1.45}.hpw-flow-label{font-weight:950;color:#334155;margin-right:3px}.hpw-flow-step{display:inline-flex;align-items:center;gap:5px;white-space:nowrap}.hpw-flow-step b{width:20px;height:20px;border-radius:7px;background:#eef3f8;color:#36546f;display:grid;place-items:center;font-size:8px}.hpw-flow-arrow{color:#9aa8b7}.hpw-flow a{margin-left:auto;color:#1769e0;text-decoration:none;font-weight:900;white-space:nowrap}
      @media(max-width:980px){.hpw-steps{grid-template-columns:repeat(2,minmax(0,1fr))}.hpw-flow{flex-wrap:wrap}.hpw-flow a{width:100%;margin-left:0}}
      @media(max-width:760px){.hpw{padding:0 13px;margin:-2px auto 24px}.hpw-box{padding:14px}.hpw-steps{grid-template-columns:1fr}.hpw-flow{align-items:flex-start}.hpw-flow-step{white-space:normal}.hpw-flow-arrow{display:none}}
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
      <div class="hpw-head"><div class="hpw-mark">↗</div><div><div class="hpw-title">무엇을 하려는지 선택하세요</div><div class="hpw-sub">프로그램 이름을 외울 필요 없이, 지금 필요한 작업에서 바로 시작합니다.</div></div></div>
      <div class="hpw-steps">
        <a class="hpw-step" data-kind="design" href="/design-editor/"><span class="hpw-num">✦</span><span><strong>디자인 만들기</strong><small>포스터 · 전단 · 초대장 · 리플렛 · 책표지</small></span></a>
        <a class="hpw-step" data-kind="pdf" href="/pdf-editor/"><span class="hpw-num">P</span><span><strong>PDF 편집 · 인쇄배치</strong><small>파일 추가 · 페이지 정리 · N-up · 소책자 · 간지</small></span></a>
        <a class="hpw-step" data-kind="check" href="/pdf-preflight/"><span class="hpw-num">✓</span><span><strong>인쇄 전 검사</strong><small>PDF 규격 · DPI · 폰트 · 도련 · 색상 상태 확인</small></span></a>
        <a class="hpw-step" data-kind="image" href="/image-editor/"><span class="hpw-num">◐</span><span><strong>이미지 작업</strong><small>자르기 · 리사이즈 · 배경 제거 · 기본 보정</small></span></a>
      </div>
      <div class="hpw-flow"><span class="hpw-flow-label">추천 출력 흐름</span><span class="hpw-flow-step"><b>1</b> 디자인 또는 PDF 준비</span><span class="hpw-flow-arrow">→</span><span class="hpw-flow-step"><b>2</b> 편집 · 배치 · 인쇄 전 검사</span><span class="hpw-flow-arrow">→</span><span class="hpw-flow-step"><b>3</b> 검사 후 PDF 저장</span><a href="/pdf-editor/">PDF 편집기 바로가기 →</a></div>
    </div>`;
    hero.insertAdjacentElement('afterend',section);
    document.documentElement.dataset.homePrintWorkflow='2';
    window.HomePrintWorkflow={stage:'task-first-print-workflow-home-v2'};
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
