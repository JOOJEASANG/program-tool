// Print Checker is public with a daily-free usage policy.
(function(){
  'use strict';
  if(window.__printCheckerDailyFreeAccessV1)return;
  window.__printCheckerDailyFreeAccessV1=true;

  function reveal(){
    document.documentElement.style.visibility='visible';
    document.documentElement.dataset.printCheckerAccess='daily-free';
  }

  function syncUser(user){
    const name=document.getElementById('userName');
    const logout=document.getElementById('logoutBtn');
    if(name)name.textContent=user?(user.displayName||user.email||'로그인 사용자'):'비회원 · 하루 3회 무료';
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
    guestLimit:3,
    memberLimit:10,
    stage:'print-checker-daily-free-v1'
  });

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
