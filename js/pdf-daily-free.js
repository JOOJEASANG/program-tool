// Program Studio PDF daily-free usage policy.
(function(){
  'use strict';
  if(window.__programPdfDailyFreeV1)return;
  window.__programPdfDailyFreeV1=true;

  const GUEST_LIMIT=3;
  const MEMBER_LIMIT=10;
  const GUEST_ID_KEY='programStudioPdfGuestId';
  const GUEST_USAGE_PREFIX='programStudioPdfUsage:guest:';
  const MEMBER_FALLBACK_PREFIX='programStudioPdfUsage:member:';
  const BADGE_ID='programPdfDailyFreeBadge';
  const SUITE_ACTION_SELECTOR='[data-local-run],[data-ocr-run],.pdfadv-primary,[data-compare-download],.pdfadv-mini,.pdfadv-tool-ready,.pdfocr-ready';
  let cachedStatus=null;
  let currentUser=null;
  let authReady=false;
  let refreshPromise=null;
  let pendingSuiteAction=null;
  let suiteGateSerial=0;

  function localDateKey(date=new Date()){
    const year=date.getFullYear();
    const month=String(date.getMonth()+1).padStart(2,'0');
    const day=String(date.getDate()).padStart(2,'0');
    return `${year}-${month}-${day}`;
  }

  function safeStorageGet(key){
    try{return localStorage.getItem(key);}catch(_){return null;}
  }
  function safeStorageSet(key,value){
    try{localStorage.setItem(key,value);return true;}catch(_){return false;}
  }
  function readCount(key){
    const value=Number.parseInt(safeStorageGet(key)||'0',10);
    return Number.isFinite(value)&&value>0?value:0;
  }
  function writeCount(key,count){return safeStorageSet(key,String(Math.max(0,Number(count)||0)));}

  function guestId(){
    let value=safeStorageGet(GUEST_ID_KEY);
    if(value)return value;
    try{value=crypto.randomUUID();}catch(_){value=`g_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,10)}`;}
    safeStorageSet(GUEST_ID_KEY,value);
    return value;
  }

  function guestUsageKey(dateKey=localDateKey()){
    return `${GUEST_USAGE_PREFIX}${dateKey}:${guestId()}`;
  }
  function memberFallbackKey(uid,dateKey=localDateKey()){
    return `${MEMBER_FALLBACK_PREFIX}${uid}:${dateKey}`;
  }

  async function isAdmin(user){
    if(!user)return false;
    try{
      const result=await user.getIdTokenResult?.();
      if(result?.claims?.admin===true)return true;
    }catch(_){}
    try{
      if(window.ProgramAccess?.isAdmin)return Boolean(await window.ProgramAccess.isAdmin(user));
    }catch(_){}
    return false;
  }

  function makeStatus(mode,used,limit,dateKey,extra={}){
    const safeUsed=Math.max(0,Number(used)||0);
    const finite=Number.isFinite(limit);
    return Object.freeze({
      mode,
      used:safeUsed,
      limit:finite?limit:null,
      remaining:finite?Math.max(0,limit-safeUsed):null,
      allowed:!finite||safeUsed<limit,
      dateKey,
      ...extra,
    });
  }

  async function memberStatus(user,dateKey){
    if(await isAdmin(user))return makeStatus('admin',0,Infinity,dateKey,{uid:user.uid});
    const fallbackKey=memberFallbackKey(user.uid,dateKey);
    const fallback=()=>makeStatus('member',readCount(fallbackKey),MEMBER_LIMIT,dateKey,{uid:user.uid,persistence:'local-fallback'});
    try{
      if(!window.db?.collection)return fallback();
      const ref=window.db.collection('users').doc(user.uid).collection('daily_pdf_usage').doc(dateKey);
      const snap=await ref.get();
      const count=snap.exists?Number(snap.data()?.count||0):0;
      return makeStatus('member',count,MEMBER_LIMIT,dateKey,{uid:user.uid,persistence:'firestore'});
    }catch(error){
      console.warn('[pdf-daily-free] member usage read fallback',error);
      return fallback();
    }
  }

  async function readStatus(options={}){
    const dateKey=localDateKey();
    const user=options.user===undefined?currentUser:options.user;
    if(user)return memberStatus(user,dateKey);
    return makeStatus('guest',readCount(guestUsageKey(dateKey)),GUEST_LIMIT,dateKey,{persistence:'local'});
  }

  function statusText(status){
    if(status.mode==='admin')return '관리자 · PDF 무료 사용 제한 없음';
    const label=status.mode==='member'?'로그인 무료':'비회원 무료';
    return `${label} · 오늘 ${status.limit}회 중 ${status.remaining}회 남음`;
  }

  function ensureBadge(){
    let badge=document.getElementById(BADGE_ID);
    if(badge)return badge;
    badge=document.createElement('div');
    badge.id=BADGE_ID;
    badge.setAttribute('data-pdf-daily-usage','');
    badge.style.cssText='position:fixed;right:14px;bottom:14px;z-index:1800;max-width:min(340px,calc(100vw - 28px));padding:10px 13px;border:1px solid #cbd5e1;border-radius:12px;background:rgba(255,255,255,.96);box-shadow:0 10px 30px rgba(15,23,42,.14);font:800 11px/1.45 Pretendard,"Noto Sans KR",sans-serif;color:#334155;backdrop-filter:blur(8px)';
    document.body?.appendChild(badge);
    return badge;
  }

  function render(status=cachedStatus){
    if(!status||!document.body)return;
    const badge=ensureBadge();
    badge.textContent=statusText(status);
    badge.dataset.mode=status.mode;
    badge.dataset.remaining=status.remaining===null?'unlimited':String(status.remaining);
    document.documentElement.dataset.pdfDailyFree=status.mode;
    document.documentElement.dataset.pdfDailyFreeRemaining=status.remaining===null?'unlimited':String(status.remaining);
  }

  async function refresh(options={}){
    if(refreshPromise&&!options.force)return refreshPromise;
    refreshPromise=readStatus(options).then(status=>{
      cachedStatus=status;
      render(status);
      return status;
    }).finally(()=>{refreshPromise=null;});
    return refreshPromise;
  }

  function exhaustedMessage(status){
    if(status.mode==='guest')return '오늘 비회원 무료 사용 3회를 모두 사용했습니다. 내일 다시 무료로 이용하거나 로그인하면 하루 10회 사용할 수 있습니다.';
    return '오늘 무료 사용량을 모두 사용했습니다. 내일 다시 이용해 주세요.';
  }

  async function canStart(action='pdf-action'){
    const status=await refresh({force:true});
    if(status.allowed)return {ok:true,status,action};
    return {ok:false,status,action,message:exhaustedMessage(status)};
  }

  async function commitMember(user,dateKey){
    const fallbackKey=memberFallbackKey(user.uid,dateKey);
    if(!window.db?.runTransaction){
      const used=readCount(fallbackKey);
      if(used>=MEMBER_LIMIT)throw new Error(exhaustedMessage(makeStatus('member',used,MEMBER_LIMIT,dateKey)));
      writeCount(fallbackKey,used+1);
      return makeStatus('member',used+1,MEMBER_LIMIT,dateKey,{uid:user.uid,persistence:'local-fallback'});
    }
    try{
      const ref=window.db.collection('users').doc(user.uid).collection('daily_pdf_usage').doc(dateKey);
      const count=await window.db.runTransaction(async transaction=>{
        const snap=await transaction.get(ref);
        const used=snap.exists?Number(snap.data()?.count||0):0;
        if(used>=MEMBER_LIMIT)throw new Error('DAILY_LIMIT_REACHED');
        const next=used+1;
        const payload={dateKey,count:next,updatedAt:firebase.firestore.FieldValue.serverTimestamp()};
        if(snap.exists)transaction.update(ref,payload);else transaction.set(ref,payload);
        return next;
      });
      writeCount(fallbackKey,count);
      return makeStatus('member',count,MEMBER_LIMIT,dateKey,{uid:user.uid,persistence:'firestore'});
    }catch(error){
      if(String(error?.message||'').includes('DAILY_LIMIT_REACHED'))throw new Error(exhaustedMessage(makeStatus('member',MEMBER_LIMIT,MEMBER_LIMIT,dateKey)));
      console.warn('[pdf-daily-free] member usage write fallback',error);
      const used=readCount(fallbackKey);
      if(used>=MEMBER_LIMIT)throw new Error(exhaustedMessage(makeStatus('member',used,MEMBER_LIMIT,dateKey)));
      writeCount(fallbackKey,used+1);
      return makeStatus('member',used+1,MEMBER_LIMIT,dateKey,{uid:user.uid,persistence:'local-fallback'});
    }
  }

  async function commitSuccess(action='pdf-action'){
    const dateKey=localDateKey();
    const user=currentUser;
    let next;
    if(user&&await isAdmin(user))next=makeStatus('admin',0,Infinity,dateKey,{uid:user.uid});
    else if(user)next=await commitMember(user,dateKey);
    else{
      const key=guestUsageKey(dateKey);
      const used=readCount(key);
      if(used>=GUEST_LIMIT)throw new Error(exhaustedMessage(makeStatus('guest',used,GUEST_LIMIT,dateKey)));
      writeCount(key,used+1);
      next=makeStatus('guest',used+1,GUEST_LIMIT,dateKey,{persistence:'local'});
    }
    cachedStatus=next;
    render(next);
    document.dispatchEvent(new CustomEvent('program-pdf-daily-free-commit',{detail:{action,status:next}}));
    return next;
  }

  function isPdfSuitePage(){
    return Boolean(document.documentElement.dataset.pdfSuite)||/(^|\/)pdf-suite(\/|$)/.test(location.pathname);
  }

  function actionName(node){
    return node?.dataset?.localRun||node?.dataset?.ocrRun||node?.dataset?.compareRun||node?.dataset?.advancedAction||node?.textContent?.trim().slice(0,60)||'pdf-suite-action';
  }

  function beginPendingSuiteAction(node){
    pendingSuiteAction={
      id:++suiteGateSerial,
      action:actionName(node),
      startedAt:Date.now(),
      committed:false
    };
    return pendingSuiteAction;
  }

  async function gateSuiteAction(node){
    const gate=await canStart(actionName(node));
    if(!gate.ok){alert(gate.message);return;}
    beginPendingSuiteAction(node);
    node.dataset.pdfQuotaPass='1';
    node.click();
  }

  function bindSuiteGuards(){
    if(!isPdfSuitePage())return;
    document.addEventListener('click',event=>{
      const node=event.target.closest?.(SUITE_ACTION_SELECTOR);
      if(!node)return;
      if(node.matches('button:disabled,[aria-disabled="true"]'))return;
      if(node.dataset.pdfQuotaPass==='1'){
        delete node.dataset.pdfQuotaPass;
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      gateSuiteAction(node).catch(error=>alert(error?.message||'무료 사용량을 확인하지 못했습니다.'));
    },true);

    document.addEventListener('click',event=>{
      const link=event.target.closest?.('a[download]');
      if(!link||!String(link.href||'').startsWith('blob:'))return;
      const pending=pendingSuiteAction;
      if(!pending||pending.committed||Date.now()-pending.startedAt>10*60*1000)return;
      pending.committed=true;
      commitSuccess(pending.action).catch(error=>console.warn('[pdf-daily-free] output commit failed',error));
      setTimeout(()=>{if(pendingSuiteAction?.id===pending.id)pendingSuiteAction=null;},1800);
    },true);
  }

  function bindAuth(){
    if(window.auth?.onAuthStateChanged){
      window.auth.onAuthStateChanged(user=>{
        currentUser=user||null;
        authReady=true;
        cachedStatus=null;
        refresh({force:true}).catch(error=>console.warn('[pdf-daily-free] refresh failed',error));
      });
    }else{
      authReady=true;
      currentUser=null;
      refresh({force:true}).catch(()=>{});
    }
  }

  function boot(){
    bindAuth();
    bindSuiteGuards();
    refresh().catch(()=>{});
  }

  window.ProgramPdfDailyFree=Object.freeze({
    guestLimit:GUEST_LIMIT,
    memberLimit:MEMBER_LIMIT,
    suiteActionSelector:SUITE_ACTION_SELECTOR,
    localDateKey,
    guestUsageKey,
    memberFallbackKey,
    status:()=>refresh({force:true}),
    peek:()=>cachedStatus,
    canStart,
    commitSuccess,
    refresh:()=>refresh({force:true}),
    render:()=>render(cachedStatus),
    exhaustedMessage,
    get authReady(){return authReady;},
    stage:'pdf-daily-free-v1'
  });

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
