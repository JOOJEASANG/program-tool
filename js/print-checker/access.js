// Print Checker uses the shared approved-member access policy.
(function(){
  'use strict';
  if(window.__printCheckerApprovedAccessV1)return;
  window.__printCheckerApprovedAccessV1=true;

  function loadSidebarActions(){
    if(document.getElementById('programSidebarActionsScriptV1')||window.__programSidebarActionsV1)return;
    const script=document.createElement('script');
    script.id='programSidebarActionsScriptV1';
    script.src='/js/program-sidebar-actions.js?v=20260916-1';
    script.async=false;
    document.head.appendChild(script);
  }

  function syncUser(user){
    const name=document.getElementById('userName');
    const logout=document.getElementById('logoutBtn');
    if(name)name.textContent=user?.displayName||user?.email||'승인 회원';
    if(logout)logout.hidden=!user;
  }

  async function boot(){
    try{
      const access=await Promise.resolve(window.ProgramAccessReady);
      if(!access?.approved)return;
      syncUser(window.auth?.currentUser||null);
      document.documentElement.dataset.printCheckerAccess='approved';
    }catch(error){
      console.warn('[print-checker-access] approval state unavailable',error);
    }
  }

  loadSidebarActions();

  if(window.auth?.onAuthStateChanged){
    window.auth.onAuthStateChanged(user=>{if(user)syncUser(user);});
  }

  window.PrintCheckerAccess=Object.freeze({
    mode:'approved-only',
    stage:'print-checker-approved-member-access-v1'
  });

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
