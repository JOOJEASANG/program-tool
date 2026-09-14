// Program Studio configurable per-program usage policy.
// Historical filename retained for compatibility with existing PDF/print entry points.
(function(){
  'use strict';
  if(window.__programUsagePolicyV3)return;
  window.__programUsagePolicyV3=true;
  window.__programPdfDailyFreeV1=true;

  const DEFAULT_GUEST_LIMIT=3;
  const DEFAULT_MEMBER_LIMIT=10;
  const LIMIT_MIN=-1;
  const LIMIT_MAX=1000;
  const SETTINGS_COLLECTION='program_usage_limits';
  const LEGACY_LIMITS_COLLECTION='settings';
  const LEGACY_LIMITS_DOCUMENT='pdf_daily_limits';
  const GUEST_ID_KEY='programStudioUsageGuestId';
  const LEGACY_GUEST_ID_KEY='programStudioPdfGuestId';
  const GUEST_USAGE_PREFIX='programStudioUsage:guest:';
  const MEMBER_FALLBACK_PREFIX='programStudioUsage:member:';
  const BADGE_ID='programPdfDailyFreeBadge';
  const SUITE_ACTION_SELECTOR='[data-local-run],[data-ocr-run],[data-compare-run],[data-redact-export],[data-attach-open],[data-access-run],[data-outline-run],[data-advanced-action="text"]';
  const FALLBACK_PROGRAMS=Object.freeze({
    'print-checker':{name:'인쇄물 사전 검토',paths:['/print-checker']},
    'smart-print-layout':{name:'스마트 인쇄배치',paths:['/smart-print-layout']},
    'pdf-editor':{name:'PDF배치',paths:['/pdf-editor']},
    'pdf-editor-advanced':{name:'PDF편집',paths:['/pdf-editor-advanced']},
    'pdf-preflight':{name:'PDF 도구 모음',paths:['/pdf-preflight','/pdf-suite','/tools/preflight','/tools/pdf-Checker']}
  });

  let currentUser=null;
  let authReady=false;
  let pendingSuiteAction=null;
  let suiteGateSerial=0;
  const settingsCache=new Map();
  const settingsPromises=new Map();
  const statusCache=new Map();
  const refreshPromises=new Map();

  function localDateKey(date=new Date()){
    const year=date.getFullYear();
    const month=String(date.getMonth()+1).padStart(2,'0');
    const day=String(date.getDate()).padStart(2,'0');
    return `${year}-${month}-${day}`;
  }
  function localMonthKey(date=new Date()){
    const year=date.getFullYear();
    const month=String(date.getMonth()+1).padStart(2,'0');
    return `${year}-${month}`;
  }
  function periodKey(period,date=new Date()){return period==='monthly'?localMonthKey(date):localDateKey(date);}
  function periodLabel(period){return period==='monthly'?'이번 달':'오늘';}

  function safeStorageGet(key){try{return localStorage.getItem(key);}catch(_){return null;}}
  function safeStorageSet(key,value){try{localStorage.setItem(key,value);return true;}catch(_){return false;}}
  function readCount(key){const value=Number.parseInt(safeStorageGet(key)||'0',10);return Number.isFinite(value)&&value>0?value:0;}
  function writeCount(key,count){return safeStorageSet(key,String(Math.max(0,Number(count)||0)));}

  function normalizeLimit(value,fallback){
    const parsed=Number.parseInt(String(value??''),10);
    return Number.isInteger(parsed)&&parsed>=LIMIT_MIN&&parsed<=LIMIT_MAX?parsed:fallback;
  }
  function normalizePeriod(value,fallback='daily'){return value==='monthly'?'monthly':fallback==='monthly'?'monthly':'daily';}

  function fallbackEntry(id){
    const item=FALLBACK_PROGRAMS[id];
    return item?{id,name:item.name,defaultGuestLimit:DEFAULT_GUEST_LIMIT,defaultMemberLimit:DEFAULT_MEMBER_LIMIT,defaultPeriod:'daily',quotaEnabledByDefault:true}:null;
  }
  function catalogEntry(id){return window.ProgramUsageCatalog?.get?.(id)||fallbackEntry(id);}
  function resolveProgramId(explicit){
    if(explicit&&catalogEntry(String(explicit)))return String(explicit);
    const fromCatalog=window.ProgramUsageCatalog?.resolve?.(location.pathname);
    if(fromCatalog)return fromCatalog;
    const path=String(location.pathname||'').replace(/\/+$/,'')||'/';
    let best=null;
    for(const [id,entry] of Object.entries(FALLBACK_PROGRAMS)){
      for(const raw of entry.paths){
        const candidate=String(raw).replace(/\/+$/,'');
        if(path===candidate||path.startsWith(candidate+'/')){
          if(!best||candidate.length>best.path.length)best={id,path:candidate};
        }
      }
    }
    return best?.id||document.documentElement?.dataset?.usageProgramId||'print-checker';
  }
  function defaultSettings(programId){
    const entry=catalogEntry(programId)||{};
    return {
      programId,
      name:String(entry.name||programId),
      enabled:entry.quotaEnabledByDefault!==false,
      period:normalizePeriod(entry.defaultPeriod,'daily'),
      guest:normalizeLimit(entry.defaultGuestLimit,DEFAULT_GUEST_LIMIT),
      member:normalizeLimit(entry.defaultMemberLimit,DEFAULT_MEMBER_LIMIT),
      source:'default'
    };
  }

  function guestId(){
    let value=safeStorageGet(GUEST_ID_KEY)||safeStorageGet(LEGACY_GUEST_ID_KEY);
    if(value){safeStorageSet(GUEST_ID_KEY,value);return value;}
    try{value=crypto.randomUUID();}catch(_){value=`g_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,10)}`;}
    safeStorageSet(GUEST_ID_KEY,value);
    safeStorageSet(LEGACY_GUEST_ID_KEY,value);
    return value;
  }
  function guestUsageKey(key=periodKey('daily'),programId=resolveProgramId(),period='daily'){
    return `${GUEST_USAGE_PREFIX}${programId}:${period}:${key}:${guestId()}`;
  }
  function memberFallbackKey(uid,key=periodKey('daily'),programId=resolveProgramId(),period='daily'){
    return `${MEMBER_FALLBACK_PREFIX}${uid}:${programId}:${period}:${key}`;
  }
  function memberUsageDocId(programId,period,key){return `${programId}__${period}__${key}`;}

  async function isAdmin(user){
    if(!user)return false;
    try{const result=await user.getIdTokenResult?.();if(result?.claims?.admin===true)return true;}catch(_){}
    try{if(window.ProgramAccess?.isAdmin)return Boolean(await window.ProgramAccess.isAdmin(user));}catch(_){}
    return false;
  }

  async function legacyLimits(){
    try{
      if(!window.db?.collection)return null;
      const snap=await window.db.collection(LEGACY_LIMITS_COLLECTION).doc(LEGACY_LIMITS_DOCUMENT).get();
      if(!snap?.exists)return null;
      const data=snap.data?.()||{};
      return {guest:normalizeLimit(data.guestLimit,DEFAULT_GUEST_LIMIT),member:normalizeLimit(data.memberLimit,DEFAULT_MEMBER_LIMIT)};
    }catch(_){return null;}
  }

  async function loadLimits(programId=resolveProgramId(),options={}){
    const id=resolveProgramId(programId);
    if(settingsCache.has(id)&&!options.force)return settingsCache.get(id);
    if(settingsPromises.has(id))return settingsPromises.get(id);
    const promise=(async()=>{
      let next=defaultSettings(id);
      try{
        if(window.db?.collection){
          const snap=await window.db.collection(SETTINGS_COLLECTION).doc(id).get();
          if(snap?.exists){
            const data=snap.data?.()||{};
            next={
              programId:id,
              name:String(data.label||next.name),
              enabled:data.enabled!==false,
              period:normalizePeriod(data.period,next.period),
              guest:normalizeLimit(data.guestLimit,next.guest),
              member:normalizeLimit(data.memberLimit,next.member),
              source:'firestore'
            };
          }else{
            const legacy=await legacyLimits();
            if(legacy)next={...next,guest:legacy.guest,member:legacy.member,source:'legacy'};
          }
        }
      }catch(error){console.warn('[program-usage] settings read fallback',id,error);}
      const frozen=Object.freeze(next);
      settingsCache.set(id,frozen);
      if(id===resolveProgramId()){
        document.documentElement.dataset.programUsageLimitSource=frozen.source;
        document.documentElement.dataset.programUsageProgramId=id;
        document.documentElement.dataset.pdfDailyLimitSource=frozen.source;
        document.documentElement.dataset.pdfDailyGuestLimit=String(frozen.guest);
        document.documentElement.dataset.pdfDailyMemberLimit=String(frozen.member);
      }
      return frozen;
    })().finally(()=>settingsPromises.delete(id));
    settingsPromises.set(id,promise);
    return promise;
  }

  function effectiveLimit(settings,mode){
    if(!settings.enabled)return Infinity;
    const raw=mode==='member'?settings.member:settings.guest;
    return raw<0?Infinity:raw;
  }
  function makeStatus(mode,used,limit,key,extra={}){
    const safeUsed=Math.max(0,Number(used)||0);
    const finite=Number.isFinite(limit);
    return Object.freeze({
      mode,
      used:safeUsed,
      limit:finite?limit:null,
      remaining:finite?Math.max(0,limit-safeUsed):null,
      allowed:!finite||(limit>0&&safeUsed<limit),
      blocked:finite&&limit===0,
      periodKey:key,
      dateKey:key,
      ...extra
    });
  }

  async function memberStatus(user,settings,key){
    const limit=effectiveLimit(settings,'member');
    if(!Number.isFinite(limit))return makeStatus('member',0,Infinity,key,{uid:user.uid,programId:settings.programId,programName:settings.name,period:settings.period,persistence:'unlimited'});
    if(limit===0)return makeStatus('member',0,0,key,{uid:user.uid,programId:settings.programId,programName:settings.name,period:settings.period,persistence:'blocked'});
    const fallbackKey=memberFallbackKey(user.uid,key,settings.programId,settings.period);
    const fallback=()=>makeStatus('member',readCount(fallbackKey),limit,key,{uid:user.uid,programId:settings.programId,programName:settings.name,period:settings.period,persistence:'local-fallback'});
    try{
      if(!window.db?.collection)return fallback();
      const ref=window.db.collection('users').doc(user.uid).collection('program_usage').doc(memberUsageDocId(settings.programId,settings.period,key));
      const snap=await ref.get();
      const count=snap.exists?Number(snap.data()?.count||0):0;
      return makeStatus('member',count,limit,key,{uid:user.uid,programId:settings.programId,programName:settings.name,period:settings.period,persistence:'firestore'});
    }catch(error){console.warn('[program-usage] member read fallback',error);return fallback();}
  }

  async function readStatus(options={}){
    const programId=resolveProgramId(options.programId);
    const user=options.user===undefined?currentUser:options.user;
    const adminKey=localDateKey();
    if(user&&await isAdmin(user))return makeStatus('admin',0,Infinity,adminKey,{uid:user.uid,programId,programName:catalogEntry(programId)?.name||programId,period:'daily'});
    const settings=await loadLimits(programId,{force:Boolean(options.forceLimits)});
    const key=periodKey(settings.period);
    if(user)return memberStatus(user,settings,key);
    const limit=effectiveLimit(settings,'guest');
    if(!Number.isFinite(limit))return makeStatus('guest',0,Infinity,key,{programId,programName:settings.name,period:settings.period,persistence:'unlimited'});
    if(limit===0)return makeStatus('guest',0,0,key,{programId,programName:settings.name,period:settings.period,persistence:'blocked'});
    return makeStatus('guest',readCount(guestUsageKey(key,programId,settings.period)),limit,key,{programId,programName:settings.name,period:settings.period,persistence:'local'});
  }

  function statusText(status){
    const name=status.programName||status.programId||'프로그램';
    if(status.mode==='admin')return `${name} · 관리자 · 사용 제한 없음`;
    if(status.limit===null)return `${name} · ${status.mode==='member'?'회원':'비회원'} · 사용 제한 없음`;
    if(status.blocked)return `${name} · ${status.mode==='member'?'회원':'비회원'} · 현재 사용 불가`;
    return `${name} · ${status.mode==='member'?'회원':'비회원'} · ${periodLabel(status.period)} ${status.limit}회 중 ${status.remaining}회 남음`;
  }
  function ensureBadge(){
    let badge=document.getElementById(BADGE_ID);
    if(badge)return badge;
    badge=document.createElement('div');
    badge.id=BADGE_ID;
    badge.setAttribute('data-program-usage','');
    badge.setAttribute('data-pdf-daily-usage','');
    badge.style.cssText='position:fixed;right:14px;bottom:14px;z-index:1800;max-width:min(380px,calc(100vw - 28px));padding:10px 13px;border:1px solid #cbd5e1;border-radius:12px;background:rgba(255,255,255,.96);box-shadow:0 10px 30px rgba(15,23,42,.14);font:800 11px/1.45 Pretendard,"Noto Sans KR",sans-serif;color:#334155;backdrop-filter:blur(8px)';
    document.body?.appendChild(badge);
    return badge;
  }
  function render(status){
    if(!status||!document.body)return;
    statusCache.set(status.programId,status);
    if(status.programId!==resolveProgramId())return;
    const badge=ensureBadge();
    badge.textContent=statusText(status);
    badge.dataset.mode=status.mode;
    badge.dataset.programId=status.programId;
    badge.dataset.remaining=status.remaining===null?'unlimited':String(status.remaining);
    document.documentElement.dataset.programUsageMode=status.mode;
    document.documentElement.dataset.programUsageRemaining=status.remaining===null?'unlimited':String(status.remaining);
    document.documentElement.dataset.pdfDailyFree=status.mode;
    document.documentElement.dataset.pdfDailyFreeRemaining=status.remaining===null?'unlimited':String(status.remaining);
  }

  async function refresh(options={}){
    const programId=resolveProgramId(options.programId);
    if(refreshPromises.has(programId)&&!options.force)return refreshPromises.get(programId);
    const promise=readStatus({programId,user:options.user,forceLimits:Boolean(options.force)}).then(status=>{render(status);return status;}).finally(()=>refreshPromises.delete(programId));
    refreshPromises.set(programId,promise);
    return promise;
  }

  async function exhaustedMessage(status){
    const period=status.period==='monthly'?'이번 달':'오늘';
    if(status.blocked)return `${status.programName||'이 프로그램'}은 현재 ${status.mode==='member'?'회원':'비회원'} 사용이 허용되지 않습니다.`;
    if(status.mode==='guest'){
      const settings=await loadLimits(status.programId);
      const member=settings.member;
      const loginHint=member<0?' 로그인하면 제한 없이 사용할 수 있습니다.':member>0?` 로그인하면 ${settings.period==='monthly'?'월':'하루'} ${member}회 사용할 수 있습니다.`:'';
      return `${period} 비회원 무료 사용 ${status.limit}회를 모두 사용했습니다.${loginHint}`;
    }
    if(status.mode==='member')return `${period} 회원 무료 사용 ${status.limit}회를 모두 사용했습니다. 다음 이용 주기에 다시 이용해 주세요.`;
    return '사용 가능한 횟수를 모두 사용했습니다.';
  }

  async function canStart(action='program-action',options={}){
    const programId=resolveProgramId(typeof options==='string'?options:options.programId);
    const status=await refresh({programId,force:true});
    if(status.allowed)return {ok:true,status,action,programId};
    return {ok:false,status,action,programId,message:await exhaustedMessage(status)};
  }

  async function commitMember(user,settings,key){
    const limit=effectiveLimit(settings,'member');
    if(!Number.isFinite(limit))return makeStatus('member',0,Infinity,key,{uid:user.uid,programId:settings.programId,programName:settings.name,period:settings.period,persistence:'unlimited'});
    if(limit===0)throw new Error(await exhaustedMessage(makeStatus('member',0,0,key,{programId:settings.programId,programName:settings.name,period:settings.period})));
    const fallbackKey=memberFallbackKey(user.uid,key,settings.programId,settings.period);
    if(!window.db?.runTransaction){
      const used=readCount(fallbackKey);
      if(used>=limit)throw new Error(await exhaustedMessage(makeStatus('member',used,limit,key,{programId:settings.programId,programName:settings.name,period:settings.period})));
      writeCount(fallbackKey,used+1);
      return makeStatus('member',used+1,limit,key,{uid:user.uid,programId:settings.programId,programName:settings.name,period:settings.period,persistence:'local-fallback'});
    }
    try{
      const ref=window.db.collection('users').doc(user.uid).collection('program_usage').doc(memberUsageDocId(settings.programId,settings.period,key));
      const count=await window.db.runTransaction(async transaction=>{
        const snap=await transaction.get(ref);
        const used=snap.exists?Number(snap.data()?.count||0):0;
        if(used>=limit)throw new Error('PROGRAM_USAGE_LIMIT_REACHED');
        const next=used+1;
        const payload={programId:settings.programId,period:settings.period,periodKey:key,count:next,updatedAt:firebase.firestore.FieldValue.serverTimestamp()};
        if(snap.exists)transaction.update(ref,payload);else transaction.set(ref,payload);
        return next;
      });
      writeCount(fallbackKey,count);
      return makeStatus('member',count,limit,key,{uid:user.uid,programId:settings.programId,programName:settings.name,period:settings.period,persistence:'firestore'});
    }catch(error){
      if(String(error?.message||'').includes('PROGRAM_USAGE_LIMIT_REACHED'))throw new Error(await exhaustedMessage(makeStatus('member',limit,limit,key,{programId:settings.programId,programName:settings.name,period:settings.period})));
      console.warn('[program-usage] member write fallback',error);
      const used=readCount(fallbackKey);
      if(used>=limit)throw new Error(await exhaustedMessage(makeStatus('member',used,limit,key,{programId:settings.programId,programName:settings.name,period:settings.period})));
      writeCount(fallbackKey,used+1);
      return makeStatus('member',used+1,limit,key,{uid:user.uid,programId:settings.programId,programName:settings.name,period:settings.period,persistence:'local-fallback'});
    }
  }

  async function commitSuccess(action='program-action',options={}){
    const programId=resolveProgramId(typeof options==='string'?options:options.programId);
    const user=currentUser;
    let next;
    if(user&&await isAdmin(user))next=makeStatus('admin',0,Infinity,localDateKey(),{uid:user.uid,programId,programName:catalogEntry(programId)?.name||programId,period:'daily'});
    else{
      const settings=await loadLimits(programId);
      const key=periodKey(settings.period);
      if(user)next=await commitMember(user,settings,key);
      else{
        const limit=effectiveLimit(settings,'guest');
        if(!Number.isFinite(limit))next=makeStatus('guest',0,Infinity,key,{programId,programName:settings.name,period:settings.period,persistence:'unlimited'});
        else if(limit===0)throw new Error(await exhaustedMessage(makeStatus('guest',0,0,key,{programId,programName:settings.name,period:settings.period})));
        else{
          const storageKey=guestUsageKey(key,programId,settings.period);
          const used=readCount(storageKey);
          if(used>=limit)throw new Error(await exhaustedMessage(makeStatus('guest',used,limit,key,{programId,programName:settings.name,period:settings.period})));
          writeCount(storageKey,used+1);
          next=makeStatus('guest',used+1,limit,key,{programId,programName:settings.name,period:settings.period,persistence:'local'});
        }
      }
    }
    render(next);
    const detail={action,programId,status:next};
    document.dispatchEvent(new CustomEvent('program-usage-commit',{detail}));
    document.dispatchEvent(new CustomEvent('program-pdf-daily-free-commit',{detail}));
    return next;
  }

  function isPdfSuitePage(){return Boolean(document.documentElement.dataset.pdfSuite)||/(^|\/)pdf-suite(\/|$)/.test(location.pathname);}
  function actionName(node){return node?.dataset?.localRun||node?.dataset?.ocrRun||node?.dataset?.compareRun||node?.dataset?.advancedAction||node?.textContent?.trim().slice(0,60)||'pdf-suite-action';}
  function beginPendingSuiteAction(node){pendingSuiteAction={id:++suiteGateSerial,action:actionName(node),startedAt:Date.now(),committed:false};return pendingSuiteAction;}
  async function gateSuiteAction(node){
    const gate=await canStart(actionName(node),{programId:'pdf-preflight'});
    if(!gate.ok){alert(gate.message);return;}
    beginPendingSuiteAction(node);
    node.dataset.pdfQuotaPass='1';
    node.click();
  }
  function bindSuiteGuards(){
    if(!isPdfSuitePage())return;
    document.addEventListener('click',event=>{
      const node=event.target.closest?.(SUITE_ACTION_SELECTOR);
      if(!node||node.matches('button:disabled,[aria-disabled="true"]'))return;
      if(node.dataset.pdfQuotaPass==='1'){delete node.dataset.pdfQuotaPass;return;}
      event.preventDefault();event.stopImmediatePropagation();
      gateSuiteAction(node).catch(error=>alert(error?.message||'무료 사용량을 확인하지 못했습니다.'));
    },true);
    document.addEventListener('click',event=>{
      const link=event.target.closest?.('a[download]');
      if(!link||!String(link.href||'').startsWith('blob:'))return;
      const pending=pendingSuiteAction;
      if(!pending||pending.committed||Date.now()-pending.startedAt>10*60*1000)return;
      pending.committed=true;
      commitSuccess(pending.action,{programId:'pdf-preflight'}).catch(error=>console.warn('[program-usage] output commit failed',error));
      setTimeout(()=>{if(pendingSuiteAction?.id===pending.id)pendingSuiteAction=null;},1800);
    },true);
  }

  function bindAuth(){
    if(window.auth?.onAuthStateChanged){
      window.auth.onAuthStateChanged(user=>{
        currentUser=user||null;authReady=true;statusCache.clear();settingsCache.clear();
        refresh({programId:resolveProgramId(),force:true}).catch(error=>console.warn('[program-usage] refresh failed',error));
      });
    }else{authReady=true;currentUser=null;refresh({programId:resolveProgramId(),force:true}).catch(()=>{});}
  }
  function boot(){bindAuth();bindSuiteGuards();refresh({programId:resolveProgramId()}).catch(()=>{});}

  function forProgram(programId){
    const id=resolveProgramId(programId);
    return Object.freeze({
      programId:id,
      limits:()=>loadLimits(id,{force:true}),
      status:()=>refresh({programId:id,force:true}),
      peek:()=>statusCache.get(id)||null,
      canStart:(action='program-action')=>canStart(action,{programId:id}),
      commitSuccess:(action='program-action')=>commitSuccess(action,{programId:id}),
      refresh:()=>refresh({programId:id,force:true})
    });
  }

  const genericApi=Object.freeze({
    defaultGuestLimit:DEFAULT_GUEST_LIMIT,
    defaultMemberLimit:DEFAULT_MEMBER_LIMIT,
    minLimit:LIMIT_MIN,
    maxLimit:LIMIT_MAX,
    settingsCollection:SETTINGS_COLLECTION,
    resolveProgramId,
    localDateKey,
    localMonthKey,
    periodKey,
    guestUsageKey,
    memberFallbackKey,
    memberUsageDocId,
    limits:(programId)=>loadLimits(resolveProgramId(programId),{force:true}),
    status:(programId)=>refresh({programId:resolveProgramId(programId),force:true}),
    canStart:(programId,action='program-action')=>canStart(action,{programId}),
    commitSuccess:(programId,action='program-action')=>commitSuccess(action,{programId}),
    forProgram,
    get authReady(){return authReady;},
    stage:'program-usage-policy-v3-per-program'
  });
  window.ProgramUsagePolicy=genericApi;

  window.ProgramPdfDailyFree=Object.freeze({
    defaultGuestLimit:DEFAULT_GUEST_LIMIT,
    defaultMemberLimit:DEFAULT_MEMBER_LIMIT,
    get guestLimit(){return settingsCache.get(resolveProgramId())?.guest??DEFAULT_GUEST_LIMIT;},
    get memberLimit(){return settingsCache.get(resolveProgramId())?.member??DEFAULT_MEMBER_LIMIT;},
    maxLimit:LIMIT_MAX,
    suiteActionSelector:SUITE_ACTION_SELECTOR,
    localDateKey,
    guestUsageKey:(key=localDateKey())=>guestUsageKey(key,resolveProgramId(),'daily'),
    memberFallbackKey:(uid,key=localDateKey())=>memberFallbackKey(uid,key,resolveProgramId(),'daily'),
    limits:()=>loadLimits(resolveProgramId(),{force:true}),
    status:()=>refresh({programId:resolveProgramId(),force:true}),
    peek:()=>statusCache.get(resolveProgramId())||null,
    canStart:(action='pdf-action')=>canStart(action,{programId:resolveProgramId()}),
    commitSuccess:(action='pdf-action')=>commitSuccess(action,{programId:resolveProgramId()}),
    refresh:()=>refresh({programId:resolveProgramId(),force:true}),
    render:()=>render(statusCache.get(resolveProgramId())),
    exhaustedMessage,
    forProgram,
    get authReady(){return authReady;},
    stage:'pdf-daily-free-v3-per-program-compatibility'
  });

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
