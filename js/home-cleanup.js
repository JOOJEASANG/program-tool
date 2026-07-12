(function(){
  if(window.__homePrintToolsV3)return;
  window.__homePrintToolsV3=true;

  function injectStyle(){
    if(document.getElementById('homePrintToolsStyle'))return;
    const style=document.createElement('style');
    style.id='homePrintToolsStyle';
    style.textContent=`
      .programs-header,.slider-wrap{max-width:1180px!important}
      .slider{grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:20px!important}
      .prog-card{min-height:282px!important;border-radius:22px!important;padding:27px!important;box-shadow:0 12px 32px rgba(15,23,42,.06)}
      .prog-card:hover{transform:translateY(-5px)!important;box-shadow:0 18px 42px rgba(18,57,109,.14)!important}
      .prog-icon{width:62px!important;height:62px!important;border-radius:17px!important;font-size:31px!important}
      .prog-name{font-size:20px!important}
      .prog-desc{font-size:13px!important;line-height:1.65!important}
      @media(max-width:980px){.slider{grid-template-columns:repeat(2,minmax(0,1fr))!important}}
      @media(max-width:680px){.slider{grid-template-columns:1fr!important}.prog-card{min-height:240px!important;padding:24px!important}}
    `;
    document.head.appendChild(style);
  }

  function addCoverMaker(){
    const slider=document.getElementById('slider');
    if(!slider||slider.querySelector('[href*="perfect-binding-cover"]'))return;
    const card=document.createElement('a');
    card.className='prog-card';
    card.href='tools/perfect-binding-cover.html';
    card.innerHTML='<div class="prog-icon" style="background:#eef2ff">📚</div>'
      +'<div class="prog-name">무선제본 표지 제작기</div>'
      +'<div class="prog-desc">완성 규격과 페이지 수, 종이 두께로 책등 폭을 계산하고 앞표지·책등·뒤표지를 연결한 300DPI 인쇄용 PDF를 만듭니다.</div>'
      +'<div class="prog-tags"><span class="prog-tag">책등 계산</span><span class="prog-tag">재단 여백</span><span class="prog-tag">전체 표지</span><span class="prog-tag">인쇄용 PDF</span></div>'
      +'<div class="prog-cta">시작하기 <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg></div>';
    slider.appendChild(card);
  }

  function renameContent(){
    document.title='Program Tool · 인쇄 문서 도구';
    const description=document.querySelector('meta[name="description"]');
    if(description)description.content='PDF 편집, 문서 검수와 무선제본 표지 제작을 제공하는 브라우저 기반 인쇄 문서 도구입니다.';

    document.querySelectorAll('.prog-card').forEach(card=>{
      const href=card.getAttribute('href')||'';
      const name=card.querySelector('.prog-name');
      const desc=card.querySelector('.prog-desc');
      if(/preflight\.html|pdf-Checker\.html/i.test(href)){
        card.setAttribute('href','tools/preflight.html');
        if(name)name.textContent='PDF 문서 도구';
        if(desc)desc.textContent='PDF 문서 검수와 암호 설정·자동 해제를 한 번의 파일 업로드로 처리합니다.';
        const tags=card.querySelector('.prog-tags');
        if(tags)tags.innerHTML='<span class="prog-tag">문서 검수</span><span class="prog-tag">암호 설정</span><span class="prog-tag">암호 해제</span>';
      }
    });

    const badge=document.querySelector('.hero-badge');
    if(badge)badge.textContent='PDF 편집 · 문서 검수 · 인쇄 표지 제작';
    const heroText=document.querySelector('.hero p');
    if(heroText)heroText.textContent='PDF 편집과 검수, 무선제본 표지 제작을 각각 필요한 프로그램에서 사용할 수 있습니다. 회원가입 후 바로 시작하세요.';
    const greeting=document.querySelector('#greetingSection p');
    if(greeting)greeting.textContent='필요한 인쇄 문서 프로그램을 선택해 시작하세요.';
    const header=document.querySelector('.programs-header h3');
    if(header)header.textContent='📦 인쇄 문서 도구';
    const count=document.getElementById('progCount');
    if(count)count.textContent='사용 가능 3개';
    document.querySelectorAll('.how-desc').forEach(el=>{
      el.textContent=el.textContent.replaceAll('PDF 문서 검수기','PDF 문서 도구').replaceAll('PDF 검수기','PDF 문서 도구');
    });
  }

  function run(){injectStyle();renameContent();addCoverMaker()}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run);
  else run();
})();
