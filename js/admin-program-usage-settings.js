// Administrator controls for per-program guest/member usage limits.
(function(){
  'use strict';
  if(window.__programAdminUsageSettingsV2)return;
  window.__programAdminUsageSettingsV2=true;

  const COLLECTION='program_usage_limits';
  const LEGACY_COLLECTION='settings';
  const LEGACY_DOCUMENT='pdf_daily_limits';
  const PANEL_ID='programusage';
  const NAV_ID='adminProgramUsageNav';
  const DEFAULT_GUEST_LIMIT=3;
  const DEFAULT_MEMBER_LIMIT=10;
  const MIN_LIMIT=1;
  const MAX_LIMIT=1000;
  const ID_RE=/^[a-z0-9][a-z0-9-]{1,63}$/;
  const rows=new Map();
  let loaded=false;
  let memberObserver=null;

  const $=id=>document.getElementById(id);
  const escapeHtml=value=>String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));

  function defaultCatalog(){
    return [
      {id:'print-checker',name:'인쇄물 사전 검토'},
      {id:'smart-print-layout',name:'스마트 인쇄배치'},
      {id:'pdf-editor',name:'PDF배치'},
      {id:'pdf-editor-advanced',name:'PDF편집'},
      {id:'pdf-preflight',name:'PDF 도구 모음'}
    ].map(item=>({...item,defaultGuestLimit:DEFAULT_GUEST_LIMIT,defaultMemberLimit:DEFAULT_MEMBER_LIMIT,defaultPeriod:'daily',quotaEnabledByDefault:true}));
  }
  function catalog(){return window.ProgramUsageCatalog?.list?.()||defaultCatalog();}
  function normalizeLimit(value,fallback){
    const n=Number.parseInt(String(value??''),10);
    return Number.isInteger(n)&&n>=-1&&n<=MAX_LIMIT?n:fallback;
  }
  function normalizePeriod(value){return value==='monthly'?'monthly':'daily';}
  function modeFromLimit(limit){return limit<0?'unlimited':limit===0?'blocked':'limited';}
  function limitFromControls(mode,input){
    if(mode==='unlimited')return -1;
    if(mode==='blocked')return 0;
    const value=Number.parseInt(String(input),10);
    return Number.isInteger(value)&&value>=MIN_LIMIT&&value<=MAX_LIMIT?value:null;
  }
  function normalizeRecord(data={},fallback={}){
    return {
      programId:String(data.programId||fallback.id||''),
      label:String(data.label||fallback.name||data.programId||fallback.id||'프로그램'),
      enabled:data.enabled!==false,
      period:normalizePeriod(data.period||fallback.defaultPeriod),
      guestLimit:normalizeLimit(data.guestLimit,normalizeLimit(fallback.defaultGuestLimit,DEFAULT_GUEST_LIMIT)),
      memberLimit:normalizeLimit(data.memberLimit,normalizeLimit(fallback.defaultMemberLimit,DEFAULT_MEMBER_LIMIT)),
      source:data.source||'catalog'
    };
  }

  function note(message,error=false){
    const target=$('programUsageStatus');
    if(!target)return;
    target.className='status '+(error?'err':'ok');
    target.textContent=message;
  }

  function retireLegacySubscriptionUi(){
    if(!$('adminSubscriptionRetiredStyle')){
      const style=document.createElement('style');
      style.id='adminSubscriptionRetiredStyle';
      style.textContent=`
        #planFilter,#mPro,[data-plan],.badge.free,.badge.pro{display:none!important}
        #dashboard .metrics{grid-template-columns:repeat(3,minmax(0,1fr))}
        @media(max-width:1050px){#dashboard .metrics{grid-template-columns:repeat(2,minmax(0,1fr))}}
        @media(max-width:760px){#dashboard .metrics{grid-template-columns:1fr}}
      `;
      document.head.appendChild(style);
    }
    const memberNav=document.querySelector('[data-tab="members"]');
    if(memberNav){const icon=memberNav.querySelector('span')?.outerHTML||'<span>👥</span>';memberNav.innerHTML=`${icon}회원 관리`;}
    const memberPanel=$('members');
    if(memberPanel){
      const title=memberPanel.querySelector('.cardtitle');
      const sub=memberPanel.querySelector('.cardsub');
      if(title)title.textContent='회원 관리';
      if(sub)sub.textContent='회원 승인과 이용 중지 상태를 관리합니다. 프로그램별 사용횟수는 프로그램 사용횟수 메뉴에서 설정합니다.';
    }
    const hero=document.querySelector('#dashboard .hero p');
    if(hero)hero.textContent='회원 승인·이용 상태, 프로그램별 사용횟수, 사업자 정보와 약관을 관리합니다.';
    document.querySelectorAll('#memberList .sub,#recentMembers .sub').forEach(node=>{
      const parts=String(node.textContent||'').split(' · ');
      if(parts.length>=3&&/^(free|pro)$/i.test(parts[parts.length-1]))node.textContent=parts.slice(0,-1).join(' · ');
    });
    document.documentElement.dataset.adminSubscriptionManagement='retired';
  }
  function observeMemberUi(){
    if(memberObserver)return;
    const targets=[$('memberList'),$('recentMembers')].filter(Boolean);
    if(!targets.length)return;
    memberObserver=new MutationObserver(retireLegacySubscriptionUi);
    targets.forEach(target=>memberObserver.observe(target,{childList:true,subtree:true}));
  }

  function installStyle(){
    if($('adminProgramUsageStyle'))return;
    const style=document.createElement('style');
    style.id='adminProgramUsageStyle';
    style.textContent=`
      .program-usage-list{display:flex;flex-direction:column;gap:10px}
      .program-usage-row{border:1px solid #dfe7ef;border-radius:13px;padding:13px;background:#fbfdff}
      .program-usage-head{display:flex;align-items:center;gap:10px;margin-bottom:10px}
      .program-usage-name{font-size:12px;font-weight:950;color:#0f172a}.program-usage-id{font-size:9px;color:#94a3b8;margin-top:2px}
      .program-usage-enabled{margin-left:auto;display:flex;align-items:center;gap:5px;font-size:10px;font-weight:850;color:#475569}
      .program-usage-grid{display:grid;grid-template-columns:140px 1fr 1fr auto;gap:9px;align-items:end}
      .program-usage-audience{display:grid;grid-template-columns:110px minmax(90px,1fr);gap:6px}
      .program-usage-row select,.program-usage-row input{width:100%;border:1px solid #cfd8e3;border-radius:8px;padding:8px;background:#fff;font-size:10px}
      .program-usage-row label,.program-usage-period-label{display:block;font-size:9px;font-weight:900;color:#667085;margin-bottom:5px}
      .program-usage-custom{display:grid;grid-template-columns:1fr 1.4fr auto;gap:8px;align-items:end;margin-top:13px;padding-top:13px;border-top:1px solid #e8edf3}
      .program-usage-custom label{display:block;font-size:9px;font-weight:900;color:#667085;margin-bottom:5px}
      @media(max-width:1000px){.program-usage-grid{grid-template-columns:1fr 1fr}.program-usage-save{grid-column:1/-1}.program-usage-custom{grid-template-columns:1fr}}
      @media(max-width:760px){.side{grid-template-columns:auto repeat(5,minmax(0,1fr))!important}.program-usage-grid,.program-usage-audience{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function showPanel(button){
    document.querySelectorAll('[data-tab]').forEach(node=>node.classList.toggle('on',node===button));
    document.querySelectorAll('.panel').forEach(panel=>panel.classList.toggle('on',panel.id===PANEL_ID));
    if($('pageTitle'))$('pageTitle').textContent='프로그램 사용횟수';
    if($('pageSub'))$('pageSub').textContent='프로그램별로 비회원·회원 사용횟수와 초기화 주기를 관리합니다.';
  }

  function installUi(){
    retireLegacySubscriptionUi();observeMemberUi();
    if($(PANEL_ID))return true;
    const side=document.querySelector('.side');
    const content=document.querySelector('.content');
    if(!side||!content)return false;
    installStyle();
    const nav=document.createElement('button');
    nav.id=NAV_ID;nav.type='button';nav.className='navbtn';nav.dataset.tab=PANEL_ID;nav.innerHTML='<span>⏱</span>프로그램 사용횟수';
    const businessNav=side.querySelector('[data-tab="business"]');
    if(businessNav)side.insertBefore(nav,businessNav);else side.insertBefore(nav,side.querySelector('.sidefoot'));

    const panel=document.createElement('section');
    panel.className='panel';panel.id=PANEL_ID;
    panel.innerHTML=`
      <div class="grid"><div class="card wide">
        <div class="cardtitle">프로그램별 사용횟수</div>
        <div class="cardsub">비회원과 회원의 사용 가능 횟수를 프로그램마다 따로 설정합니다. 관리자 계정은 항상 제한 없이 사용합니다.</div>
        <div class="program-usage-list" id="programUsageList"></div>
        <div class="program-usage-custom">
          <div><label for="newUsageProgramId">새 프로그램 ID</label><input id="newUsageProgramId" placeholder="예: image-converter" maxlength="64"></div>
          <div><label for="newUsageProgramName">표시 이름</label><input id="newUsageProgramName" placeholder="예: 이미지 변환"></div>
          <button class="btn soft" id="addUsageProgramBtn" type="button">설정 행 추가</button>
        </div>
        <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap"><button class="btn primary" id="saveAllProgramUsageBtn" type="button">전체 설정 저장</button><button class="btn soft" id="reloadProgramUsageBtn" type="button">다시 불러오기</button></div>
        <div class="status" id="programUsageStatus"></div>
        <div class="hint">횟수 제한은 1~${MAX_LIMIT}회입니다. “무제한” 또는 “사용 불가”도 별도로 지정할 수 있습니다. 주기는 1일 또는 월간으로 설정할 수 있습니다. 새 프로그램은 공용 카탈로그에 등록하면 자동으로 이 목록에 나타나며, 필요하면 여기서 ID를 직접 추가해 미리 설정할 수도 있습니다.</div>
      </div></div>`;
    const businessPanel=$('business');
    if(businessPanel)content.insertBefore(panel,businessPanel);else content.appendChild(panel);
    nav.addEventListener('click',()=>showPanel(nav));
    $('saveAllProgramUsageBtn')?.addEventListener('click',saveAll);
    $('reloadProgramUsageBtn')?.addEventListener('click',()=>load({showStatus:true,force:true}));
    $('addUsageProgramBtn')?.addEventListener('click',addCustomProgram);
    $('refreshBtn')?.addEventListener('click',()=>load({showStatus:true,force:true}));
    document.documentElement.dataset.adminProgramUsageSettings='ready';
    return true;
  }

  function modeOptions(selected){return ['limited','unlimited','blocked'].map(value=>`<option value="${value}"${value===selected?' selected':''}>${value==='limited'?'횟수 제한':value==='unlimited'?'무제한':'사용 불가'}</option>`).join('');}
  function rowHtml(record){
    const guestMode=modeFromLimit(record.guestLimit);const memberMode=modeFromLimit(record.memberLimit);
    const guestValue=record.guestLimit>0?record.guestLimit:DEFAULT_GUEST_LIMIT;
    const memberValue=record.memberLimit>0?record.memberLimit:DEFAULT_MEMBER_LIMIT;
    return `<div class="program-usage-row" data-program-id="${escapeHtml(record.programId)}">
      <div class="program-usage-head"><div><div class="program-usage-name">${escapeHtml(record.label)}</div><div class="program-usage-id">${escapeHtml(record.programId)}</div></div><label class="program-usage-enabled"><input type="checkbox" data-field="enabled"${record.enabled?' checked':''}> 제한 적용</label></div>
      <div class="program-usage-grid">
        <div><span class="program-usage-period-label">초기화 주기</span><select data-field="period"><option value="daily"${record.period==='daily'?' selected':''}>1일</option><option value="monthly"${record.period==='monthly'?' selected':''}>월간</option></select></div>
        <div><label>비회원</label><div class="program-usage-audience"><select data-field="guestMode">${modeOptions(guestMode)}</select><input data-field="guestLimit" type="number" min="${MIN_LIMIT}" max="${MAX_LIMIT}" step="1" value="${guestValue}"></div></div>
        <div><label>회원</label><div class="program-usage-audience"><select data-field="memberMode">${modeOptions(memberMode)}</select><input data-field="memberLimit" type="number" min="${MIN_LIMIT}" max="${MAX_LIMIT}" step="1" value="${memberValue}"></div></div>
        <button class="btn soft program-usage-save" type="button" data-save-program="${escapeHtml(record.programId)}">이 프로그램 저장</button>
      </div></div>`;
  }

  function bindRowControls(container){
    container.querySelectorAll('[data-save-program]').forEach(button=>button.addEventListener('click',()=>saveProgram(button.dataset.saveProgram)));
    container.querySelectorAll('select[data-field$="Mode"]').forEach(select=>select.addEventListener('change',()=>{
      const field=select.dataset.field==='guestMode'?'guestLimit':'memberLimit';
      const input=select.closest('.program-usage-audience')?.querySelector(`[data-field="${field}"]`);
      if(input)input.disabled=select.value!=='limited';
    }));
    container.querySelectorAll('select[data-field$="Mode"]').forEach(select=>select.dispatchEvent(new Event('change')));
  }
  function render(records){
    const list=$('programUsageList');if(!list)return;
    rows.clear();records.forEach(record=>rows.set(record.programId,record));
    list.innerHTML=records.map(rowHtml).join('');
    bindRowControls(list);
    document.documentElement.dataset.adminProgramUsageCount=String(records.length);
  }

  async function readLegacyDefaults(){
    try{
      if(!window.db?.collection)return null;
      const snap=await window.db.collection(LEGACY_COLLECTION).doc(LEGACY_DOCUMENT).get();
      if(!snap?.exists)return null;
      const data=snap.data?.()||{};
      return {guestLimit:normalizeLimit(data.guestLimit,DEFAULT_GUEST_LIMIT),memberLimit:normalizeLimit(data.memberLimit,DEFAULT_MEMBER_LIMIT)};
    }catch(_){return null;}
  }

  async function readSettingsCollection(){
    const result=new Map();
    if(!window.db?.collection)return result;
    const snapshot=await window.db.collection(COLLECTION).get();
    if(snapshot?.forEach)snapshot.forEach(doc=>{const data=doc.data?.()||{};result.set(doc.id,normalizeRecord({...data,programId:doc.id},{id:doc.id,name:data.label||doc.id}));});
    else if(Array.isArray(snapshot?.docs))snapshot.docs.forEach(doc=>{const data=doc.data?.()||{};result.set(doc.id,normalizeRecord({...data,programId:doc.id},{id:doc.id,name:data.label||doc.id}));});
    return result;
  }

  async function load(options={}){
    if(!installUi())return [];
    try{
      const stored=await readSettingsCollection();
      const legacy=stored.size?null:await readLegacyDefaults();
      const merged=[];
      const seen=new Set();
      for(const item of catalog()){
        const storedRecord=stored.get(item.id);
        const base=normalizeRecord(storedRecord||{},item);
        if(!storedRecord&&legacy){base.guestLimit=legacy.guestLimit;base.memberLimit=legacy.memberLimit;base.source='legacy';}
        merged.push(base);seen.add(item.id);
      }
      for(const [id,record] of stored){if(!seen.has(id))merged.push(record);}
      merged.sort((a,b)=>a.label.localeCompare(b.label,'ko'));
      render(merged);loaded=true;
      if(options.showStatus)note(`현재 ${merged.length}개 프로그램의 사용 정책을 표시합니다.`);
      return merged;
    }catch(error){
      const fallback=catalog().map(item=>normalizeRecord({},item));render(fallback);
      if(options.showStatus)note(`설정을 읽지 못해 기본값을 표시합니다. ${error?.message||error}`,true);
      return fallback;
    }
  }

  function recordFromRow(programId){
    const row=document.querySelector(`.program-usage-row[data-program-id="${CSS.escape(programId)}"]`);if(!row)return null;
    const original=rows.get(programId)||{programId,label:programId};
    const guestLimit=limitFromControls(row.querySelector('[data-field="guestMode"]')?.value,row.querySelector('[data-field="guestLimit"]')?.value);
    const memberLimit=limitFromControls(row.querySelector('[data-field="memberMode"]')?.value,row.querySelector('[data-field="memberLimit"]')?.value);
    if(guestLimit===null||memberLimit===null)return null;
    return {programId,label:original.label,enabled:Boolean(row.querySelector('[data-field="enabled"]')?.checked),period:normalizePeriod(row.querySelector('[data-field="period"]')?.value),guestLimit,memberLimit};
  }
  async function saveRecord(record){
    if(!ID_RE.test(record.programId))throw new Error(`잘못된 프로그램 ID: ${record.programId}`);
    if(!window.db?.collection)throw new Error('Firestore를 사용할 수 없습니다.');
    const payload={...record,updatedAt:window.firebase?.firestore?.FieldValue?.serverTimestamp?.()||new Date()};
    await window.db.collection(COLLECTION).doc(record.programId).set(payload,{merge:true});
    rows.set(record.programId,{...record,source:'firestore'});
    return payload;
  }
  async function saveProgram(programId){
    const record=recordFromRow(programId);
    if(!record){note('횟수 제한은 1~1000 사이의 정수로 입력해 주세요.',true);return false;}
    try{await saveRecord(record);note(`${record.label} 설정을 저장했습니다.`);document.dispatchEvent(new CustomEvent('program-usage-settings-updated',{detail:record}));return true;}
    catch(error){note(`설정 저장 실패: ${error?.message||error}`,true);return false;}
  }
  async function saveAll(){
    const ids=[...document.querySelectorAll('.program-usage-row')].map(row=>row.dataset.programId).filter(Boolean);
    const records=ids.map(recordFromRow);
    if(records.some(record=>!record)){note('모든 횟수 제한 값을 확인해 주세요. 제한값은 1~1000 사이의 정수여야 합니다.',true);return false;}
    try{for(const record of records)await saveRecord(record);note(`${records.length}개 프로그램 설정을 모두 저장했습니다.`);document.dispatchEvent(new CustomEvent('program-usage-settings-updated',{detail:{all:true,count:records.length}}));return true;}
    catch(error){note(`전체 설정 저장 실패: ${error?.message||error}`,true);return false;}
  }

  function addCustomProgram(){
    const id=String($('newUsageProgramId')?.value||'').trim().toLowerCase();
    const label=String($('newUsageProgramName')?.value||'').trim()||id;
    if(!ID_RE.test(id)){note('프로그램 ID는 영문 소문자·숫자·하이픈으로 2~64자 입력해 주세요.',true);return false;}
    if(rows.has(id)){note('이미 목록에 있는 프로그램 ID입니다.',true);return false;}
    const record=normalizeRecord({programId:id,label},{id,name:label});
    const records=[...rows.values(),record].sort((a,b)=>a.label.localeCompare(b.label,'ko'));
    render(records);
    if($('newUsageProgramId'))$('newUsageProgramId').value='';if($('newUsageProgramName'))$('newUsageProgramName').value='';
    note(`${label} 설정 행을 추가했습니다. 저장해야 실제 설정으로 반영됩니다.`);
    return true;
  }

  async function authorizeAndLoad(user){
    if(!user)return;
    try{const admin=window.ProgramAccess?.isAdmin?await window.ProgramAccess.isAdmin(user):false;if(admin)await load({showStatus:true});}
    catch(error){console.warn('[admin-program-usage] admin check failed',error);}
  }
  function boot(){
    retireLegacySubscriptionUi();observeMemberUi();installUi();
    if(window.auth?.onAuthStateChanged)window.auth.onAuthStateChanged(authorizeAndLoad);else if(window.auth?.currentUser)authorizeAndLoad(window.auth.currentUser);
  }

  window.ProgramAdminUsageSettings=Object.freeze({
    collection:COLLECTION,
    min:MIN_LIMIT,max:MAX_LIMIT,load,saveProgram,saveAll,addCustomProgram,normalizeRecord,retireLegacySubscriptionUi,
    get loaded(){return loaded;},
    stage:'admin-program-usage-settings-v2-extensible'
  });

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
