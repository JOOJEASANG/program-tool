// Administrator approval + per-program access control.
(function(){
  'use strict';
  if(window.__programAdminAccessControlV1)return;
  window.__programAdminAccessControlV1=true;
  const path=(location.pathname||'/').replace(/\/+$/,'')||'/';
  if(path!=='/admin'&&path!=='/admin.html')return;

  const PROGRAMS=(window.ProgramAccessCatalog||[
    {id:'print-checker',name:'인쇄물 사전 검토'},
    {id:'smart-print-layout',name:'스마트 인쇄배치'},
    {id:'pdf-editor',name:'PDF배치'},
    {id:'pdf-editor-advanced',name:'PDF편집'},
    {id:'pdf-preflight',name:'PDF 도구 모음'}
  ]).map(item=>({id:String(item.id),name:String(item.name||item.id)}));
  const cache=new Map();
  let observer=null;

  const $=id=>document.getElementById(id);
  const serverTimestamp=()=>window.firebase?.firestore?.FieldValue?.serverTimestamp?.();
  function memberId(row){return row?.querySelector('[data-member]')?.dataset.member||'';}

  function installStyles(){
    if($('adminProgramAccessStyles'))return;
    const style=document.createElement('style');
    style.id='adminProgramAccessStyles';
    style.textContent=`
      #memberList .item{align-items:flex-start;flex-wrap:wrap}#memberList .item>[data-plan],#recentMembers .item>[data-plan]{display:none!important}
      #memberList .item>.badge.free,#memberList .item>.badge.pro,#recentMembers .item>.badge.free,#recentMembers .item>.badge.pro{display:none!important}
      #memberList .item>button[data-status="approved"]{display:none!important}
      .program-access-actions{display:flex;gap:5px;flex-wrap:wrap;align-items:center}
      .program-access-actions button{border:1px solid #d7e0ea;border-radius:8px;background:#fff;color:#475467;padding:7px 9px;font-size:9px;font-weight:900;cursor:pointer}
      .program-access-actions button.all{background:#eaf8f0;color:#087443;border-color:#b9e7cd}.program-access-actions button.member{background:#eff6ff;color:#1d4ed8;border-color:#bfdbfe}
      .program-access-actions button:hover{filter:brightness(.98)}
      .program-access-panel{flex:0 0 100%;display:none;margin-top:4px;padding:10px;border:1px solid #dce5ef;border-radius:10px;background:#fff}.program-access-panel.open{display:block}
      .program-access-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px}.program-access-head strong{font-size:10px}.program-access-head span{font-size:8px;color:#667085;font-weight:800}
      .program-access-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}.program-access-toggle{display:flex;align-items:center;gap:7px;border:1px solid #e5eaf0;border-radius:8px;padding:7px 8px;background:#f8fafc;font-size:9px;font-weight:850;color:#344054;cursor:pointer}.program-access-toggle input{accent-color:#1769e0}
      .program-access-legacy{font-size:8px;line-height:1.45;color:#8a5b00;background:#fff8e5;border:1px solid #fde6a7;border-radius:8px;padding:7px;margin-bottom:8px}
      .program-access-status{font-size:8px;color:#667085;margin-top:7px;min-height:13px}.program-access-status.ok{color:#087443}.program-access-status.err{color:#b42318}
      @media(max-width:760px){.program-access-grid{grid-template-columns:1fr}.program-access-actions{width:100%}}
    `;
    document.head.appendChild(style);
  }

  async function loadProfile(uid,force=false){
    if(!force&&cache.has(uid))return cache.get(uid);
    const snap=await window.db.collection('user_permissions').doc(uid).get();
    const data=snap.exists?{id:snap.id,...snap.data()}:null;
    cache.set(uid,data);
    return data;
  }

  function policyFrom(profile){
    const legacy=profile&&!Object.prototype.hasOwnProperty.call(profile,'programsAll');
    const all=legacy||profile?.programsAll===true;
    const programs={};
    for(const p of PROGRAMS)programs[p.id]=all||profile?.programs?.[p.id]===true;
    return {legacy,all,programs,status:String(profile?.status||'pending')};
  }

  function setPanelStatus(panel,message,tone=''){
    const node=panel?.querySelector('.program-access-status');if(!node)return;
    node.textContent=message;node.className='program-access-status '+tone;
  }

  async function saveMemberStatus(uid,status){
    const payload={status};const stamp=serverTimestamp();if(stamp)payload.updatedAt=stamp;
    await window.db.collection('user_permissions').doc(uid).set(payload,{merge:true});
    window.ProgramAccess?.clearCache?.(uid);cache.delete(uid);
  }

  async function approveAll(uid){
    const payload={status:'approved',programsAll:true};const stamp=serverTimestamp();if(stamp)payload.updatedAt=stamp;
    await window.db.collection('user_permissions').doc(uid).set(payload,{merge:true});
    window.ProgramAccess?.clearCache?.(uid);cache.delete(uid);
  }

  async function setProgram(uid,programId,enabled,profile){
    const policy=policyFrom(profile);
    const payload={status:'approved',programsAll:false};
    for(const p of PROGRAMS){
      const current=policy.legacy?true:Boolean(policy.programs[p.id]);
      payload[`programs.${p.id}`]=p.id===programId?Boolean(enabled):current;
    }
    const stamp=serverTimestamp();if(stamp)payload.updatedAt=stamp;
    await window.db.collection('user_permissions').doc(uid).update(payload);
    window.ProgramAccess?.clearCache?.(uid);cache.delete(uid);
  }

  async function revokeAll(uid){
    const payload={programsAll:false};
    for(const p of PROGRAMS)payload[`programs.${p.id}`]=false;
    const stamp=serverTimestamp();if(stamp)payload.updatedAt=stamp;
    await window.db.collection('user_permissions').doc(uid).update(payload);
    window.ProgramAccess?.clearCache?.(uid);cache.delete(uid);
  }

  async function renderPanel(row,force=false){
    const uid=memberId(row);if(!uid)return;
    const panel=row.querySelector('.program-access-panel');if(!panel)return;
    setPanelStatus(panel,'권한 정보를 불러오는 중...');
    try{
      const profile=await loadProfile(uid,force);if(!profile)throw new Error('회원 문서를 찾을 수 없습니다.');
      const policy=policyFrom(profile);
      panel.querySelector('.program-access-legacy')?.remove();
      if(policy.legacy){
        const legacy=document.createElement('div');legacy.className='program-access-legacy';legacy.textContent='기존 승인 회원은 현재 전체 프로그램 승인으로 호환됩니다. 프로그램별 권한을 한 번 저장하면 새 권한 방식으로 전환됩니다.';panel.querySelector('.program-access-grid')?.before(legacy);
      }
      panel.querySelectorAll('[data-program-access]').forEach(input=>{input.checked=Boolean(policy.programs[input.dataset.programAccess]);input.disabled=policy.status!=='approved'&&false;});
      const label=policy.status==='approved'?(policy.all?'회원 승인 · 전체 프로그램 사용 가능':'회원 승인 · 프로그램별 권한 적용'):`회원 상태: ${policy.status}`;
      setPanelStatus(panel,label,'ok');
    }catch(error){setPanelStatus(panel,'권한 조회 실패: '+(error?.message||error),'err');}
  }

  function buildPanel(row){
    if(row.querySelector('.program-access-panel'))return;
    const uid=memberId(row);if(!uid)return;
    const actions=document.createElement('div');actions.className='program-access-actions';actions.innerHTML=`<button type="button" class="member">회원 승인</button><button type="button" class="all">전체 프로그램 승인</button><button type="button" class="detail">프로그램별 권한</button><button type="button" class="revoke">프로그램 전체 해제</button>`;
    const existingStop=row.querySelector('button[data-status="suspended"]');
    (existingStop?.parentElement||row).insertBefore(actions,existingStop||null);

    const panel=document.createElement('div');panel.className='program-access-panel';
    panel.innerHTML=`<div class="program-access-head"><strong>프로그램별 사용 권한</strong><span>회원 승인 + 프로그램 승인 모두 필요</span></div><div class="program-access-grid">${PROGRAMS.map(p=>`<label class="program-access-toggle"><input type="checkbox" data-program-access="${p.id}"><span>${p.name}</span></label>`).join('')}</div><div class="program-access-status"></div>`;
    row.appendChild(panel);

    actions.querySelector('.member').addEventListener('click',async()=>{try{await saveMemberStatus(uid,'approved');setPanelStatus(panel,'회원 승인 완료. 사용할 프로그램 권한도 승인해 주세요.','ok');document.getElementById('refreshBtn')?.click();}catch(error){setPanelStatus(panel,'회원 승인 실패: '+error.message,'err');}});
    actions.querySelector('.all').addEventListener('click',async()=>{try{await approveAll(uid);panel.classList.add('open');await renderPanel(row,true);document.getElementById('refreshBtn')?.click();}catch(error){setPanelStatus(panel,'전체 승인 실패: '+error.message,'err');}});
    actions.querySelector('.detail').addEventListener('click',async()=>{panel.classList.toggle('open');if(panel.classList.contains('open'))await renderPanel(row);});
    actions.querySelector('.revoke').addEventListener('click',async()=>{if(!confirm('이 회원의 모든 프로그램 사용 권한을 해제할까요? 회원 승인 상태는 유지됩니다.'))return;try{await revokeAll(uid);panel.classList.add('open');await renderPanel(row,true);}catch(error){setPanelStatus(panel,'권한 해제 실패: '+error.message,'err');}});
    panel.querySelectorAll('[data-program-access]').forEach(input=>input.addEventListener('change',async()=>{
      const previous=!input.checked;input.disabled=true;
      try{const profile=await loadProfile(uid);await setProgram(uid,input.dataset.programAccess,input.checked,profile);await renderPanel(row,true);}
      catch(error){input.checked=previous;setPanelStatus(panel,'프로그램 권한 저장 실패: '+error.message,'err');}
      finally{input.disabled=false;}
    }));
  }

  function enhanceRows(){
    document.querySelectorAll('#memberList .item').forEach(buildPanel);
    document.querySelectorAll('#recentMembers .item').forEach(row=>{
      row.querySelectorAll('button').forEach(button=>{button.style.display='none';});
    });
    const sub=document.querySelector('#members .cardsub');if(sub)sub.textContent='회원 가입 후 관리자가 회원을 승인하고, 전체 프로그램 또는 프로그램별 사용 권한을 부여해야 이용할 수 있습니다.';
    const title=document.querySelector('#members .cardtitle');if(title)title.textContent='회원·프로그램 권한 관리';
  }

  function boot(){
    installStyles();enhanceRows();
    const list=$('memberList');if(list&&!observer){observer=new MutationObserver(enhanceRows);observer.observe(list,{childList:true,subtree:false});}
    document.documentElement.dataset.adminProgramAccess='approval-v1';
    window.ProgramAdminAccessControl={programs:PROGRAMS,refresh:enhanceRows,stage:'admin-program-access-v1'};
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,0),{once:true});else setTimeout(boot,0);
})();
