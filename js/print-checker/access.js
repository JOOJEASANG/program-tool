// Print Checker is public with a daily-free usage policy.
(function(){
  'use strict';
  if(window.__printCheckerDailyFreeAccessV1)return;
  window.__printCheckerDailyFreeAccessV1=true;

  function reveal(){
    document.documentElement.style.visibility='visible';
    document.documentElement.dataset.printCheckerAccess='daily-free';
  }

  function syncGuestLabel(name){
    if(!name)return;
    const quota=window.ProgramPdfDailyFree;
    name.textContent='비회원 · 무료 사용';
    if(!quota?.status)return;
    quota.status().then(status=>{
      if(window.auth?.currentUser)return;
      if(status?.mode==='guest'&&Number.isFinite(status.limit))name.textContent=`비회원 · 하루 ${status.limit}회 무료`;
    }).catch(()=>{});
  }

  function syncUser(user){
    const name=document.getElementById('userName');
    const logout=document.getElementById('logoutBtn');
    if(name){
      if(user)name.textContent=user.displayName||user.email||'로그인 사용자';
      else syncGuestLabel(name);
    }
    if(logout)logout.hidden=!user;
  }

  function boot(){
    reveal();
    if(window.auth?.onAuthStateChanged){
      window.auth.onAuthStateChanged(user=>{
        syncUser(user||null);
        reveal();
      });
    }else syncUser(null);
  }

  window.PrintCheckerAccess=Object.freeze({
    mode:'daily-free',
    get guestLimit(){return window.ProgramPdfDailyFree?.guestLimit??3;},
    get memberLimit(){return window.ProgramPdfDailyFree?.memberLimit??10;},
    stage:'print-checker-daily-free-v2-configurable'
  });

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
