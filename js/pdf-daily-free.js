// Program Studio access policy compatibility layer.
// Historical filename is retained so existing result-generation guards keep working,
// but usage counters/guest quotas are intentionally retired.
(function(){
  'use strict';
  if(window.__programUsageAccessPolicyV4)return;
  window.__programUsageAccessPolicyV4=true;
  window.__programUsagePolicyV3=true;
  window.__programPdfDailyFreeV1=true;

  const FALLBACK_PROGRAMS={
    'print-checker':'인쇄물 사전 검토',
    'smart-print-layout':'스마트 인쇄배치',
    'pdf-editor':'PDF배치',
    'pdf-editor-advanced':'PDF편집',
    'pdf-preflight':'PDF 도구 모음'
  };
  let currentUser=window.auth?.currentUser||null;
  let authReady=!window.auth;

  function resolveProgramId(explicit){
    const value=String(explicit||'').trim();
    if(value)return value;
    return window.ProgramUsageCatalog?.resolve?.(location.pathname)
      || window.ProgramAccess?.programForPath?.(location.pathname)
      || document.documentElement?.dataset?.usageProgramId
      || '';
  }

  function nameFor(id){return window.ProgramUsageCatalog?.get?.(id)?.name||FALLBACK_PROGRAMS[id]||id||'프로그램';}

  async function accessStatus(programId){
    const id=resolveProgramId(programId);
    const user=window.auth?.currentUser||currentUser;
    if(!user){
      return Object.freeze({programId:id,programName:nameFor(id),mode:'signed-out',allowed:false,approved:false,admin:false,assigned:false,remaining:null,limit:null});
    }
    if(window.ProgramAccess?.canUseProgram){
      const access=await window.ProgramAccess.canUseProgram(user,id);
      return Object.freeze({
        programId:id,
        programName:nameFor(id),
        mode:access.admin?'admin':'member',
        allowed:Boolean(access.allowed),
        approved:Boolean(access.approved),
        admin:Boolean(access.admin),
        assigned:Boolean(access.assigned),
        status:access.status||'',
        profile:access.profile||null,
        remaining:null,
        limit:null
      });
    }
    return Object.freeze({programId:id,programName:nameFor(id),mode:'member',allowed:true,approved:true,admin:false,assigned:true,remaining:null,limit:null});
  }

  async function canStart(action='program-action',options={}){
    const programId=resolveProgramId(typeof options==='string'?options:options.programId);
    const status=await accessStatus(programId);
    if(status.allowed)return {ok:true,status,action,programId};
    let message='관리자 승인 후 이 프로그램을 사용할 수 있습니다.';
    if(status.mode==='signed-out')message='로그인 후 관리자 승인을 받아야 프로그램을 사용할 수 있습니다.';
    else if(status.approved&&!status.assigned)message=`${status.programName} 사용 권한이 없습니다. 관리자에게 프로그램 권한 승인을 요청해 주세요.`;
    else if(status.status==='suspended')message='현재 이용이 중지된 계정입니다. 관리자에게 문의해 주세요.';
    return {ok:false,status,action,programId,message};
  }

  async function commitSuccess(action='program-action',options={}){
    const programId=resolveProgramId(typeof options==='string'?options:options.programId);
    return accessStatus(programId);
  }

  function forProgram(programId){
    const id=resolveProgramId(programId);
    return Object.freeze({
      programId:id,
      status:()=>accessStatus(id),
      limits:async()=>({programId:id,enabled:false,guest:null,member:null,source:'approval-only'}),
      canStart:(action='program-action')=>canStart(action,{programId:id}),
      commitSuccess:(action='program-action')=>commitSuccess(action,{programId:id}),
      refresh:()=>accessStatus(id)
    });
  }

  async function refresh(options={}){return accessStatus(resolveProgramId(options.programId));}
  async function limits(programId){return {programId:resolveProgramId(programId),enabled:false,guest:null,member:null,source:'approval-only'};}

  if(window.auth?.onAuthStateChanged){
    window.auth.onAuthStateChanged(user=>{currentUser=user||null;authReady=true;});
  }

  const policy={
    resolveProgramId,
    forProgram,
    canStart,
    commitSuccess,
    refresh,
    status:refresh,
    limits,
    get authReady(){return authReady;},
    get currentUser(){return currentUser;},
    stage:'program-access-policy-v4-admin-approval'
  };
  window.ProgramUsagePolicy=Object.freeze(policy);
  window.ProgramPdfDailyFree=window.ProgramUsagePolicy;
  document.documentElement.dataset.programUsagePolicy='approval-only';
  document.documentElement.dataset.pdfDailyFree='retired';
})();
