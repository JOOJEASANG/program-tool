(function(){
  if(window.__homeCleanupV4)return;
  window.__homeCleanupV4=true;

  function injectDashboardLayout(){
    if(document.getElementById('homeProgramOneRowStyle'))return;
    var style=document.createElement('style');
    style.id='homeProgramOneRowStyle';
    style.textContent=`
      @media (min-width: 1180px) {
        .programs-section {
          padding: 34px 0 78px !important;
        }
        .programs-header,
        .slider-wrap {
          max-width: min(96vw, 1760px) !important;
          padding-left: 32px !important;
          padding-right: 32px !important;
        }
        .programs-header {
          margin-bottom: 24px !important;
        }
        .programs-header h3 {
          font-size: 26px !important;
        }
        .programs-header .count {
          font-size: 14px !important;
        }
        .slider {
          display: grid !important;
          grid-template-columns: repeat(6, minmax(0, 1fr)) !important;
          gap: 18px !important;
          align-items: stretch !important;
          padding: 8px 0 28px !important;
          width: 100% !important;
        }
        .prog-card {
          min-height: 258px !important;
          padding: 26px 20px 24px !important;
          border-radius: 20px !important;
          gap: 13px !important;
        }
        .prog-icon {
          width: 66px !important;
          height: 66px !important;
          border-radius: 17px !important;
          font-size: 33px !important;
        }
        .prog-name {
          font-size: 18px !important;
          line-height: 1.25 !important;
        }
        .prog-desc {
          font-size: 13px !important;
          line-height: 1.5 !important;
          -webkit-line-clamp: 4 !important;
        }
        .prog-tag {
          font-size: 11px !important;
          padding: 4px 7px !important;
        }
        .prog-cta {
          font-size: 13px !important;
        }
      }
      @media (min-width: 900px) and (max-width: 1179px) {
        .slider-wrap { max-width: 1120px !important; }
        .slider { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
      }
    `;
    document.head.appendChild(style);
  }

  // 현재 사용 중인 프로그램명으로 정규화 (1회만 실행)
  function fixCardLinks(){
    document.querySelectorAll('.prog-card').forEach(function(card){
      var href=card.getAttribute('href')||'';
      // preflight 링크를 현재 파일명으로 통일
      if(/preflight\.html/i.test(href)){
        card.setAttribute('href','tools/preflight.html');
      }
    });
  }

  function run(){
    try{ injectDashboardLayout(); }catch(e){}
    try{ fixCardLinks(); }catch(e){}
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',run);
  else run();
})();
