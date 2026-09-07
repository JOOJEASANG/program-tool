// Administrator controls for public/member PDF daily limits.
(function(){
  'use strict';
  if(window.__programAdminPdfUsageSettingsV1)return;
  window.__programAdminPdfUsageSettingsV1=true;

  const DEFAULTS=Object.freeze({guestLimit:3,memberLimit:10});
  const MIN=1;
  const MAX=1000;
  const COLLECTION='settings';
  const DOCUMENT='pdf_daily_limits';
  const PANEL_ID='pdfusage';
  const NAV_ID='adminPdfUsageNav';
  let loaded=false;

  const $=id=>document.getElementById(id);

  function validLimit(value){
    const n=Number.parseInt(String(value??''),10);
    return Number.isInteger(n)&&n>=MIN&&n<=MAX?n:null;
  }

  function note(message,error=false){
    const target=$('pdfUsageStatus');
    if(!target)return;
    target.className='status '+(error?'err':'ok');
    target.textContent=message;
  }

  function apply(data={}){
    const guest=validLimit(data.guestLimit)??DEFAULTS.guestLimit;
    const member=validLimit(data.memberLimit)??DEFAULTS.memberLimit;
    if($('pdfGuestLimit'))$('pdfGuestLimit').value=String(guest);
    if($('pdfMemberLimit'))$('pdfMemberLimit').value=String(member);
    document.documentElement.dataset.adminPdfGuestLimit=String(guest);
    document.documentElement.dataset.adminPdfMemberLimit=String(member);
    return {guestLimit:guest,memberLimit:member};
  }

  function installStyle(){
    if($('adminPdfUsageStyle'))return;
    const style=document.createElement('style');
    style.id='adminPdfUsageStyle';
    style.textContent='@media(max-width:760px){.side{grid-template-columns:auto repeat(5,minmax(0,1fr))!important}}';
    document.head.appendChild(style);
  }

  function showPanel(button){
    document.querySelectorAll('[data-tab]').forEach(node=>node.classList.toggle('on',node===button));
    document.querySelectorAll('.panel').forEach(panel=>panel.classList.toggle('on',panel.id===PANEL_ID));
    const title=$('pageTitle');
    const sub=$('pageSub');
    if(title)title.textContent='PDF 사용횟수';
    if(sub)sub.textContent='비회원과 회원의 하루 PDF 처리 횟수를 관리합니다.';
  }

  function installUi(){
    if($(PANEL_ID))return true;
    const side=document.querySelector('.side');
    const content=document.querySelector('.content');
    if(!side||!content)return false;

    installStyle();
    const nav=document.createElement('button');
    nav.id=NAV_ID;
    nav.type='button';
    nav.className='navbtn';
    nav.dataset.tab=PANEL_ID;
    nav.innerHTML='<span>⏱</span>PDF 사용횟수';
    const businessNav=side.querySelector('[data-tab="business"]');
    if(businessNav)side.insertBefore(nav,businessNav);else side.insertBefore(nav,side.querySelector('.sidefoot'));

    const panel=document.createElement('section');
    panel.className='panel';
    panel.id=PANEL_ID;
    panel.innerHTML=`
      <div class="grid">
        <div class="card wide">
          <div class="cardtitle">PDF 1일 사용횟수</div>
          <div class="cardsub">PDF 유틸리티와 인쇄물 사전 검토의 하루 무료 처리 횟수를 정합니다. 관리자 계정은 항상 제한 없이 사용합니다.</div>
          <div class="formgrid">
            <div class="field"><label for="pdfGuestLimit">비회원 1일 사용횟수</label><input id="pdfGuestLimit" type="number" min="${MIN}" max="${MAX}" step="1" inputmode="numeric" value="${DEFAULTS.guestLimit}"></div>
            <div class="field"><label for="pdfMemberLimit">회원 1일 사용횟수</label><input id="pdfMemberLimit" type="number" min="${MIN}" max="${MAX}" step="1" inputmode="numeric" value="${DEFAULTS.memberLimit}"></div>
          </div>
          <div style="margin-top:10px"><button class="btn primary" id="savePdfUsageBtn" type="button">사용횟수 저장</button></div>
          <div class="status" id="pdfUsageStatus"></div>
          <div class="hint">각 항목은 ${MIN}~${MAX}회로 설정할 수 있습니다. 설정 문서가 없거나 읽지 못하면 기본값 비회원 ${DEFAULTS.guestLimit}회, 회원 ${DEFAULTS.memberLimit}회를 사용합니다. 변경값은 이후 PDF 작업부터 적용됩니다.</div>
        </div>
      </div>`;
    const businessPanel=$('business');
    if(businessPanel)content.insertBefore(panel,businessPanel);else content.appendChild(panel);

    nav.addEventListener('click',()=>showPanel(nav));
    $('savePdfUsageBtn')?.addEventListener('click',save);
    $('refreshBtn')?.addEventListener('click',()=>load({showStatus:true}));
    document.documentElement.dataset.adminPdfUsageSettings='ready';
    return true;
  }

  async function load(options={}){
    if(!installUi())return null;
    let data=DEFAULTS;
    try{
      if(!window.db?.collection)throw new Error('Firestore를 사용할 수 없습니다.');
      const snap=await window.db.collection(COLLECTION).doc(DOCUMENT).get();
      data=snap?.exists?snap.data()||DEFAULTS:DEFAULTS;
      const normalized=apply(data);
      loaded=true;
      if(options.showStatus)note(`현재 설정: 비회원 ${normalized.guestLimit}회 · 회원 ${normalized.memberLimit}회`);
      return normalized;
    }catch(error){
      const normalized=apply(DEFAULTS);
      if(options.showStatus)note(`설정을 읽지 못해 기본값을 표시합니다. ${error?.message||error}`,true);
      return normalized;
    }
  }

  async function save(){
    const guest=validLimit($('pdfGuestLimit')?.value);
    const member=validLimit($('pdfMemberLimit')?.value);
    if(guest===null||member===null){
      note(`${MIN}~${MAX} 사이의 정수로 입력해 주세요.`,true);
      return false;
    }
    try{
      if(!window.db?.collection)throw new Error('Firestore를 사용할 수 없습니다.');
      const payload={
        guestLimit:guest,
        memberLimit:member,
        updatedAt:window.firebase?.firestore?.FieldValue?.serverTimestamp?.()||new Date()
      };
      await window.db.collection(COLLECTION).doc(DOCUMENT).set(payload,{merge:true});
      apply(payload);
      loaded=true;
      note(`저장했습니다. 비회원 하루 ${guest}회 · 회원 하루 ${member}회`);
      document.dispatchEvent(new CustomEvent('program-pdf-daily-limits-updated',{detail:{guestLimit:guest,memberLimit:member}}));
      return true;
    }catch(error){
      note(`사용횟수 저장 실패: ${error?.message||error}`,true);
      return false;
    }
  }

  async function authorizeAndLoad(user){
    if(!user)return;
    try{
      const admin=window.ProgramAccess?.isAdmin?await window.ProgramAccess.isAdmin(user):false;
      if(admin)await load({showStatus:true});
    }catch(error){console.warn('[admin-pdf-usage] admin check failed',error);}
  }

  function boot(){
    installUi();
    if(window.auth?.onAuthStateChanged)window.auth.onAuthStateChanged(authorizeAndLoad);
    else if(window.auth?.currentUser)authorizeAndLoad(window.auth.currentUser);
  }

  window.ProgramAdminPdfUsageSettings=Object.freeze({
    defaults:DEFAULTS,
    min:MIN,
    max:MAX,
    load,
    save,
    apply,
    get loaded(){return loaded;},
    stage:'admin-pdf-daily-limits-v1'
  });

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
