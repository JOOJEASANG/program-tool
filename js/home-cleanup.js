(function(){
  if(window.__homeCleanupV3)return;
  window.__homeCleanupV3=true;

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
    try{ fixCardLinks(); }catch(e){}
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',run);
  else run();
})();
