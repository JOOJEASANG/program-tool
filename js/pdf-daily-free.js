// Compatibility API for the retired usage-count policy.
// Program access is controlled only by Firebase login + administrator approval.
(function(){
  'use strict';
  if(window.__programUsagePolicyApprovedOnlyV1)return;
  window.__programUsagePolicyApprovedOnlyV1=true;
  window.__programPdfDailyFreeV1=true;

  function resolveProgramId(explicit){
    if(explicit)return String(explicit);
    try{
      const path=String(location.pathname||'').replace(/\/+$/,'');
      if(path.includes('/print-checker'))return 'print-checker';
      if(path.includes('/smart-print-layout'))return 'smart-print-layout';
      if(path.includes('/pdf-editor-advanced'))return 'pdf-editor-advanced';
      if(path.includes('/pdf-editor'))return 'pdf-editor';
      if(path.includes('/pdf-preflight')||path.includes('/pdf-suite'))return 'pdf-preflight';
    }catch(_){}
    return 'program';
  }

  function status(programId=resolveProgramId()){
    return Object.freeze({
      mode:'approved-member',
      used:0,
      limit:null,
      remaining:null,
      allowed:true,
      blocked:false,
      programId:resolveProgramId(programId),
      period:'none',
      persistence:'none'
    });
  }

  async function canStart(action='program-action',options={}){
    const programId=resolveProgramId(typeof options==='string'?options:options.programId);
    return {ok:true,status:status(programId),action,programId};
  }
  async function commitSuccess(action='program-action',options={}){
    const programId=resolveProgramId(typeof options==='string'?options:options.programId);
    return status(programId);
  }
  function forProgram(programId){
    const id=resolveProgramId(programId);
    return Object.freeze({
      programId:id,
      limits:async()=>({programId:id,enabled:false,guest:-1,member:-1,period:'none',source:'retired'}),
      status:async()=>status(id),
      peek:()=>status(id),
      canStart:(action='program-action')=>canStart(action,{programId:id}),
      commitSuccess:(action='program-action')=>commitSuccess(action,{programId:id}),
      refresh:async()=>status(id)
    });
  }

  const api=Object.freeze({
    defaultGuestLimit:-1,
    defaultMemberLimit:-1,
    minLimit:-1,
    maxLimit:-1,
    settingsCollection:null,
    resolveProgramId,
    limits:(programId)=>forProgram(programId).limits(),
    status:(programId)=>forProgram(programId).status(),
    canStart:(programId,action='program-action')=>canStart(action,{programId}),
    commitSuccess:(programId,action='program-action')=>commitSuccess(action,{programId}),
    forProgram,
    get authReady(){return true;},
    stage:'approved-members-only-no-usage-quota'
  });

  window.ProgramUsagePolicy=api;
  window.ProgramPdfDailyFree=Object.freeze({
    defaultGuestLimit:-1,
    defaultMemberLimit:-1,
    guestLimit:-1,
    memberLimit:-1,
    maxLimit:-1,
    limits:()=>forProgram(resolveProgramId()).limits(),
    status:()=>forProgram(resolveProgramId()).status(),
    peek:()=>status(resolveProgramId()),
    canStart:(action='pdf-action')=>canStart(action,{programId:resolveProgramId()}),
    commitSuccess:(action='pdf-action')=>commitSuccess(action,{programId:resolveProgramId()}),
    refresh:async()=>status(resolveProgramId()),
    render:()=>{},
    exhaustedMessage:async()=>'',
    forProgram,
    get authReady(){return true;},
    stage:'pdf-usage-quota-retired'
  });

  document.getElementById('programPdfDailyFreeBadge')?.remove();
  document.documentElement.dataset.programUsagePolicy='approved-only';
})();
