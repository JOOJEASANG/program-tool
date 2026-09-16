// Compatibility shim for retired per-program usage-limit settings.
(function(){
  'use strict';
  if(window.__programAdminUsageSettingsRetiredV1)return;
  window.__programAdminUsageSettingsRetiredV1=true;

  function cleanup(){
    document.getElementById('adminProgramUsageNav')?.remove();
    document.getElementById('programusage')?.remove();
    const memberPanel=document.getElementById('members');
    const title=memberPanel?.querySelector('.cardtitle');
    const sub=memberPanel?.querySelector('.cardsub');
    if(title)title.textContent='회원 관리';
    if(sub)sub.textContent='승인 완료 회원만 프로그램을 사용할 수 있습니다. 횟수 제한은 적용하지 않습니다.';
    const hero=document.querySelector('#dashboard .hero p');
    if(hero)hero.textContent='회원 승인·이용 상태, 사업자 정보와 약관을 관리합니다.';
    document.documentElement.dataset.adminProgramUsageSettings='retired';
  }

  window.ProgramAdminUsageSettings=Object.freeze({
    load:async()=>[],
    saveAll:async()=>true,
    saveProgram:async()=>true,
    get loaded(){return true;},
    stage:'admin-program-usage-limits-retired'
  });

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',cleanup,{once:true});
  else cleanup();
})();
