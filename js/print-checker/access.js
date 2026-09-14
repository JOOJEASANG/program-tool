// Print Checker uses the shared administrator-approved program access policy.
(function(){
  'use strict';
  if(window.__printCheckerDailyFreeAccessV1)return;
  window.__printCheckerDailyFreeAccessV1=true;

  function revealIfApproved(){
    if(document.documentElement.dataset.accessReady!=='true')return false;
    document.documentElement.style.visibility='visible';
    document.documentElement.dataset.printCheckerAccess='admin-approved';
    return true;
  }

  function syncUser(user){
    const name=document.getElementById('userName');
    const logout=document.getElementById('logoutBtn');
    if(name)name.textContent=user?(user.displayName||user.email||'승인 회원'):'로그인 필요';
    if(logout)logout.hidden=!user;
  }

  function boot(){
    if(window.auth?.onAuthStateChanged){
      window.auth.onAuthStateChanged(user=>{syncUser(user||null);revealIfApproved();});
    }
    Promise.resolve(window.ProgramAccessReady).then(access=>{
      if(access?.allowed||access?.admin)revealIfApproved();
    }).catch(()=>{});
  }

  window.PrintCheckerAccess=Object.freeze({
    mode:'admin-approved',
    programId:'print-checker',
    stage:'print-checker-admin-approved-v3'
  });

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
