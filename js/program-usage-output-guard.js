// Lazy result-generation quota guard for Program Studio tools.
// Future programs can opt in by registering outputActionSelector in ProgramUsageCatalog
// or adding data-program-usage-action/data-program-usage-program to their result button.
(function(){
  'use strict';
  if(window.__programUsageOutputGuardV1)return;
  window.__programUsageOutputGuardV1=true;

  const CATALOG_ID='programUsageCatalogScriptV2';
  const POLICY_ID='programUsagePolicyScriptV3';
  const CATALOG_SRC='/js/program-usage-catalog.js?v=20260914-2';
  const POLICY_SRC='/js/pdf-daily-free.js?v=20260914-2';
  const EXPLICIT_SELECTOR='[data-program-usage-action]';
  const PENDING_MAX_AGE_MS=10*60*1000;
  let pending=null;
  let serial=0;
  let dependencyPromise=null;

  function loadScript(id,src){
    const existing=document.getElementById(id);
    if(existing?.dataset.loaded==='true')return Promise.resolve(existing);
    return new Promise((resolve,reject)=>{
      const script=existing||document.createElement('script');
      if(!existing){script.id=id;script.src=src;script.async=false;document.head.appendChild(script);}
      const done=()=>{script.dataset.loaded='true';resolve(script);};
      if(existing&&window.ProgramUsageCatalog&&id===CATALOG_ID)return done();
      if(existing&&window.ProgramUsagePolicy&&id===POLICY_ID)return done();
      script.addEventListener('load',done,{once:true});
      script.addEventListener('error',()=>reject(new Error(`사용횟수 모듈을 불러오지 못했습니다: ${src}`)),{once:true});
    });
  }

  async function ensureDependencies(){
    if(window.ProgramUsageCatalog&&window.ProgramUsagePolicy)return window.ProgramUsagePolicy;
    if(dependencyPromise)return dependencyPromise;
    dependencyPromise=(async()=>{
      if(!window.ProgramUsageCatalog)await loadScript(CATALOG_ID,CATALOG_SRC);
      if(!window.ProgramUsagePolicy)await loadScript(POLICY_ID,POLICY_SRC);
      const policy=window.ProgramUsagePolicy;
      if(!policy)throw new Error('사용횟수 정책을 초기화하지 못했습니다.');
      const started=Date.now();
      while(!policy.authReady&&Date.now()-started<2500)await new Promise(resolve=>setTimeout(resolve,25));
      return policy;
    })().finally(()=>{dependencyPromise=null;});
    return dependencyPromise;
  }

  function resolvedProgramId(node){
    return String(node?.dataset?.programUsageProgram||window.ProgramUsageCatalog?.resolve?.(location.pathname)||'').trim();
  }
  function resolvedAction(node){
    return String(node?.dataset?.programUsageAction||node?.textContent||'결과 생성').replace(/\s+/g,' ').trim().slice(0,80)||'결과 생성';
  }
  function registeredSelector(){
    const id=window.ProgramUsageCatalog?.resolve?.(location.pathname);
    return id?String(window.ProgramUsageCatalog?.get?.(id)?.outputActionSelector||'').trim():'';
  }
  function actionNode(target){
    const explicit=target?.closest?.(EXPLICIT_SELECTOR);
    if(explicit)return explicit;
    const selector=registeredSelector();
    if(!selector)return null;
    const matched=target?.closest?.(selector);
    return matched&&document.contains(matched)?matched:null;
  }
  function actionable(node){return Boolean(node)&&!node.matches?.(':disabled,[aria-disabled="true"]');}

  async function gate(node){
    const policy=await ensureDependencies();
    const programId=resolvedProgramId(node)||policy.resolveProgramId?.();
    if(!programId)throw new Error('프로그램 사용횟수 ID를 확인할 수 없습니다.');
    const action=resolvedAction(node);
    const api=policy.forProgram(programId);
    const result=await api.canStart(action);
    if(!result.ok){alert(result.message||'사용 가능한 횟수를 모두 사용했습니다.');return false;}
    pending={id:++serial,programId,action,startedAt:Date.now(),committed:false};
    node.dataset.programUsagePass='1';
    node.click();
    return true;
  }

  function clearExpired(){
    if(pending&&Date.now()-pending.startedAt>PENDING_MAX_AGE_MS)pending=null;
  }
  async function commitPending(){
    clearExpired();
    const item=pending;
    if(!item||item.committed)return false;
    item.committed=true;
    try{
      const policy=await ensureDependencies();
      await policy.forProgram(item.programId).commitSuccess(item.action);
      document.dispatchEvent(new CustomEvent('program-usage-output-committed',{detail:{programId:item.programId,action:item.action}}));
      return true;
    }catch(error){
      console.warn('[program-usage-output] success commit failed',error);
      return false;
    }finally{
      setTimeout(()=>{if(pending?.id===item.id)pending=null;},1800);
    }
  }

  document.addEventListener('click',event=>{
    const node=actionNode(event.target);
    if(!actionable(node))return;
    if(node.dataset.programUsagePass==='1'){
      delete node.dataset.programUsagePass;
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    gate(node).catch(error=>{
      console.error('[program-usage-output] gate failed',error);
      alert(error?.message||'사용 가능 횟수를 확인하지 못했습니다.');
    });
  },true);

  document.addEventListener('click',event=>{
    const link=event.target?.closest?.('a[download]');
    if(!link)return;
    clearExpired();
    if(!pending||pending.committed)return;
    commitPending();
  },true);

  window.ProgramUsageOutputGuard=Object.freeze({
    ensureDependencies,
    commitPending,
    get pending(){return pending?{...pending}:null;},
    stage:'program-usage-output-guard-v1-lazy'
  });
})();
