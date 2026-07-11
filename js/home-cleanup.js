(function(){
  if(window.__homeUnifiedPrintV1)return;
  window.__homeUnifiedPrintV1=true;

  function injectStyle(){
    if(document.getElementById('homeUnifiedPrintStyle'))return;
    const style=document.createElement('style');
    style.id='homeUnifiedPrintStyle';
    style.textContent=`
      .programs-header,.slider-wrap{max-width:920px!important}
      .slider{grid-template-columns:1fr!important;gap:22px!important}
      .prog-card{min-height:285px!important;border-radius:24px!important;padding:32px!important;box-shadow:0 14px 38px rgba(15,23,42,.08);background:linear-gradient(135deg,#fff 0%,#f7fcff 100%)!important}
      .prog-card:hover{transform:translateY(-5px)!important;box-shadow:0 20px 48px rgba(18,57,109,.16)!important;border-color:#91d8e4!important}
      .prog-icon{width:70px!important;height:70px!important;border-radius:20px!important;font-size:35px!important;background:linear-gradient(135deg,#dbeafe,#cffafe)!important}
      .prog-name{font-size:24px!important}
      .prog-desc{font-size:15px!important;line-height:1.75!important;max-width:720px}
      .prog-tag{padding:5px 9px!important}
      .prog-cta{font-size:14px!important}
      @media(max-width:720px){.prog-card{min-height:260px!important;padding:25px!important}.prog-name{font-size:21px!important}}
    `;
    document.head.appendChild(style);
  }

  function buildUnifiedCard(){
    const slider=document.getElementById('slider');
    if(!slider)return;
    slider.innerHTML=`
      <a class="prog-card" href="tools/print-workspace.html">
        <div class="prog-icon">🖨️</div>
        <div class="prog-name">인쇄파일 완성기</div>
        <div class="prog-desc">PDF를 한 번 선택한 뒤 페이지 편집·N-up·소책자 배치부터 문서 품질 검수, 암호 설정과 해제까지 하나의 작업공간에서 처리합니다. 무선제본 표지와 엑셀 자동 문서 생성 기능도 이 안에 계속 추가됩니다.</div>
        <div class="prog-tags"><span class="prog-tag">PDF 편집</span><span class="prog-tag">N-up·소책자</span><span class="prog-tag">문서 검수</span><span class="prog-tag">암호 설정·해제</span><span class="prog-tag">인쇄 제작 확장</span></div>
        <div class="prog-cta">통합 작업공간 시작하기 <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg></div>
      </a>`;
  }

  function renameContent(){
    document.title='Program Tool · 인쇄파일 완성기';
    const description=document.querySelector('meta[name="description"]');
    if(description)description.content='PDF 편집, 배치, 검수와 보안 작업을 한 화면에서 처리하는 인쇄파일 통합 작업공간입니다.';

    const badge=document.querySelector('.hero-badge');
    if(badge)badge.textContent='PDF 편집 · 검수 · 인쇄 준비 통합';
    const heroTitle=document.querySelector('.hero h1');
    if(heroTitle)heroTitle.innerHTML='파일 하나로 시작해서,<br><span>인쇄하기 좋은 PDF까지</span>';
    const heroText=document.querySelector('.hero p');
    if(heroText)heroText.textContent='PDF 편집기와 문서 검수 도구를 하나의 인쇄파일 완성 작업공간으로 통합했습니다. 회원가입 후 바로 사용할 수 있습니다.';
    const greeting=document.querySelector('#greetingSection p');
    if(greeting)greeting.textContent='PDF를 올리고 편집·배치·검수 작업을 한 화면에서 시작하세요.';

    const header=document.querySelector('.programs-header h3');
    if(header)header.textContent='🖨️ 통합 인쇄 도구';
    const count=document.getElementById('progCount');
    if(count)count.textContent='통합 프로그램 1개';

    const sectionTitle=document.querySelector('.how-section .section-title');
    if(sectionTitle)sectionTitle.textContent='인쇄파일 완성 3단계';
    const howTitles=document.querySelectorAll('.how-title');
    const howDescs=document.querySelectorAll('.how-desc');
    if(howTitles[0])howTitles[0].textContent='PDF 선택';
    if(howDescs[0])howDescs[0].textContent='작업할 PDF를 통합 화면에서 한 번 선택합니다.';
    if(howTitles[1])howTitles[1].textContent='편집·검수';
    if(howDescs[1])howDescs[1].textContent='페이지 배치와 문서 상태·보안 설정을 한 작업공간에서 처리합니다.';
    if(howTitles[2])howTitles[2].textContent='저장·출력';
    if(howDescs[2])howDescs[2].textContent='완성된 PDF를 내려받아 출력하거나 인쇄소에 전달합니다.';
  }

  function run(){injectStyle();buildUnifiedCard();renameContent()}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run);
  else run();
})();
