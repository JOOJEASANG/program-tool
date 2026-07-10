(function(){
  if(window.__homeCleanupPdfOnlyV1)return;
  window.__homeCleanupPdfOnlyV1=true;

  function injectStyle(){
    if(document.getElementById('homePdfOnlyStyle'))return;
    const style=document.createElement('style');
    style.id='homePdfOnlyStyle';
    style.textContent=`
      .programs-header,.slider-wrap{max-width:1060px!important}
      .slider{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:22px!important}
      .prog-card{min-height:270px!important;border-radius:22px!important;padding:30px!important;box-shadow:0 12px 32px rgba(15,23,42,.06)}
      .prog-card:hover{transform:translateY(-5px)!important;box-shadow:0 18px 42px rgba(18,57,109,.14)!important}
      .prog-icon{width:66px!important;height:66px!important;border-radius:18px!important;font-size:33px!important}
      .prog-name{font-size:21px!important}
      .prog-desc{font-size:14px!important;line-height:1.65!important}
      @media(max-width:720px){.slider{grid-template-columns:1fr!important}.prog-card{min-height:240px!important;padding:24px!important}}
    `;
    document.head.appendChild(style);
  }

  function renameContent(){
    document.title='Program Tool · PDF 편집 도구';
    const description=document.querySelector('meta[name="description"]');
    if(description)description.content='PDF 문서 편집기와 PDF 문서 도구를 제공하는 브라우저 기반 PDF 업무 서비스입니다.';

    document.querySelectorAll('.prog-card').forEach(card=>{
      const href=card.getAttribute('href')||'';
      const name=card.querySelector('.prog-name');
      const desc=card.querySelector('.prog-desc');
      if(/preflight\.html|pdf-Checker\.html/i.test(href)){
        card.setAttribute('href','tools/preflight.html');
        if(name)name.textContent='PDF 문서 도구';
        if(desc)desc.textContent='PDF 문서 검수, 암호 설정·자동 해제, OCR 변환을 한 번의 파일 업로드로 처리합니다.';
        const tags=card.querySelector('.prog-tags');
        if(tags)tags.innerHTML='<span class="prog-tag">문서 검수</span><span class="prog-tag">암호</span><span class="prog-tag">OCR</span>';
      }
    });

    document.querySelectorAll('.hero p,.how-desc').forEach(el=>{
      el.textContent=el.textContent.replaceAll('PDF 문서 검수기','PDF 문서 도구').replaceAll('PDF 검수기','PDF 문서 도구');
    });
    const badge=document.querySelector('.hero-badge');
    if(badge)badge.textContent='PDF 편집 · PDF 문서 도구 전용';
  }

  function run(){injectStyle();renameContent()}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run);
  else run();
})();
