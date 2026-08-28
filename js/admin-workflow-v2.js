// Safer member-management UX for Program Studio admin.
(function(){
  'use strict';
  if(window.__adminWorkflowV2)return;
  window.__adminWorkflowV2=true;

  const path=(location.pathname||'/').replace(/\/+$/,'')||'/';
  if(!(path==='/admin'||path==='/admin.html'))return;

  const $=id=>document.getElementById(id);
  const selected=new Set();
  let observer=null;
  let busy=false;

  function installStyles(){
    if($('adminWorkflowV2Styles'))return;
    const style=document.createElement('style');style.id='adminWorkflowV2Styles';style.textContent=`
      #recentMembers .item{padding-right:12px}#recentMembers .item>.btn{display:none!important}#recentMembers .item:after{content:'상세 관리는 회원·구독에서';font-size:10px;font-weight:800;color:#98a2b3;white-space:nowrap}
      .admin-bulkbar{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin:0 0 12px;padding:10px;border:1px solid #dce5ef;border-radius:12px;background:#f8fbff}.admin-bulk-count{font-size:11px;font-weight:900;color:#344054;margin-right:auto}.admin-bulkbar button{min-height:34px;border:1px solid #d6e0ea;border-radius:8px;background:#fff;color:#475467;padding:0 9px;font-size:10px;font-weight:900;cursor:pointer}.admin-bulkbar button:hover:not(:disabled){border-color:#9db5cc;background:#f7fafc}.admin-bulkbar button[data-bulk-status="approved"]{background:#ecfdf3;color:#067647;border-color:#b7e5cf}.admin-bulkbar button[data-bulk-status="suspended"]{background:#fff1f2;color:#b42318;border-color:#fecdd3}.admin-bulkbar button:disabled{opacity:.45;cursor:not-allowed}.admin-bulk-status{width:100%;font-size:10px;line-height:1.45;color:#667085}.admin-bulk-status.ok{color:#067647}.admin-bulk-status.err{color:#b42318}
      #memberList .item{position:relative;padding-left:42px}#memberList .admin-member-select{position:absolute;left:13px;top:50%;width:17px;height:17px;transform:translateY(-50%);accent-color:#1769e0;cursor:pointer}#memberList .item.admin-selected{border-color:#9cc5eb;background:#f4f9ff;box-shadow:0 0 0 2px rgba(23,105,224,.06)}
      @media(max-width:760px){.admin-bulkbar{position:sticky;top:0;z-index:8}.admin-bulk-count{width:100%;margin-right:0}#recentMembers .item:after{display:none}}
    `;document.head.appendChild(style);
  }

  function memberIdFor(row){return row?.querySelector('[data-member]')?.dataset.member||row?.querySelector('[data-plan]')?.dataset.plan||'';}
  function visibleMemberRows(){return [...document.querySelectorAll('#memberList .item')].filter(row=>row.offsetParent!==null||getComputedStyle(row).display!=='none');}

  function syncRows(){
    document.querySelectorAll('#memberList .item').forEach(row=>{
      const id=memberIdFor(row);if(!id)return;
      let input=row.querySelector('.admin-member-select');
      if(!input){input=document.createElement('input');input.type='checkbox';input.className='admin-member-select';input.setAttribute('aria-label','회원 선택');input.addEventListener('change',()=>{if(input.checked)selected.add(id);else selected.delete(id);syncSelection()});row.insertBefore(input,row.firstChild);}
      input.checked=selected.has(id);row.classList.toggle('admin-selected',selected.has(id));
    });
    document.querySelectorAll('#recentMembers .item>.btn').forEach(button=>{button.disabled=true;button.setAttribute('aria-hidden','true');button.tabIndex=-1;});
    syncSelection();
  }

  function syncSelection(){
    const liveIds=new Set([...document.querySelectorAll('#memberList .item')].map(memberIdFor).filter(Boolean));
    [...selected].forEach(id=>{if(!liveIds.has(id))selected.delete(id)});
    document.querySelectorAll('#memberList .item').forEach(row=>{const id=memberIdFor(row),checked=selected.has(id);row.classList.toggle('admin-selected',checked);const input=row.querySelector('.admin-member-select');if(input)input.checked=checked;});
    const count=$('adminBulkCount');if(count)count.textContent=`${selected.size}명 선택`;
    document.querySelectorAll('#adminBulkBar button[data-needs-selection]').forEach(button=>button.disabled=busy||selected.size===0);
    const all=$('adminSelectVisible');if(all){const rows=visibleMemberRows();all.textContent=rows.length&&rows.every(row=>selected.has(memberIdFor(row)))?'선택 해제':'화면 전체 선택';all.disabled=busy||!rows.length;}
  }

  function setBulkStatus(message,tone=''){
    const node=$('adminBulkStatus');if(!node)return;node.textContent=message;node.className='admin-bulk-status '+tone;
  }

  async function applyBulk(field,value,label){
    if(busy||!selected.size)return false;
    const ids=[...selected];
    if(!confirm(`${ids.length}명의 ${label}을(를) 변경할까요?`))return false;
    busy=true;syncSelection();setBulkStatus(`${ids.length}명 변경 중…`);
    const failures=[];
    for(const id of ids){
      try{
        const payload={[field]:value};
        if(window.firebase?.firestore?.FieldValue?.serverTimestamp)payload.updatedAt=window.firebase.firestore.FieldValue.serverTimestamp();
        await window.db.collection('user_permissions').doc(id).set(payload,{merge:true});
      }catch(error){failures.push({id,error});}
    }
    busy=false;
    if(failures.length){setBulkStatus(`${ids.length-failures.length}명 변경 · ${failures.length}명 실패`,'err');}
    else{selected.clear();setBulkStatus(`${ids.length}명 ${label} 변경 완료`,'ok');}
    syncSelection();
    $('refreshBtn')?.click();
    return failures.length===0;
  }

  function installBulkBar(){
    if($('adminBulkBar'))return true;
    const toolbar=document.querySelector('#members .toolbar');if(!toolbar)return false;
    const bar=document.createElement('div');bar.id='adminBulkBar';bar.className='admin-bulkbar';bar.innerHTML='<span id="adminBulkCount" class="admin-bulk-count">0명 선택</span><button id="adminSelectVisible" type="button">화면 전체 선택</button><button type="button" data-needs-selection data-bulk-status="approved">승인</button><button type="button" data-needs-selection data-bulk-plan="pro">PRO</button><button type="button" data-needs-selection data-bulk-plan="free">FREE</button><button type="button" data-needs-selection data-bulk-status="suspended">이용 중지</button><div id="adminBulkStatus" class="admin-bulk-status">여러 회원을 선택해 한 번에 변경할 수 있습니다.</div>';
    toolbar.insertAdjacentElement('afterend',bar);
    $('adminSelectVisible')?.addEventListener('click',()=>{const rows=visibleMemberRows(),ids=rows.map(memberIdFor).filter(Boolean),all=ids.length&&ids.every(id=>selected.has(id));ids.forEach(id=>all?selected.delete(id):selected.add(id));syncSelection();});
    bar.querySelectorAll('[data-bulk-status]').forEach(button=>button.addEventListener('click',()=>applyBulk('status',button.dataset.bulkStatus,button.dataset.bulkStatus==='approved'?'승인 상태':'이용 상태')));
    bar.querySelectorAll('[data-bulk-plan]').forEach(button=>button.addEventListener('click',()=>applyBulk('plan',button.dataset.bulkPlan,'구독 등급')));
    return true;
  }

  function guardDangerousActions(){
    if(document.documentElement.dataset.adminWorkflowGuard==='1')return;
    document.documentElement.dataset.adminWorkflowGuard='1';
    document.addEventListener('click',event=>{
      const button=event.target.closest?.('#memberList [data-member][data-status="suspended"]');
      if(!button)return;
      const row=button.closest('.item'),name=String(row?.querySelector('.name')?.textContent||'이 회원').trim();
      if(confirm(`${name} 계정을 이용 중지할까요?`))return;
      event.preventDefault();event.stopImmediatePropagation();
    },true);
  }

  function bindObserver(){
    if(observer)return;
    const members=$('memberList'),recent=$('recentMembers');if(!members&&!recent)return;
    observer=new MutationObserver(syncRows);if(members)observer.observe(members,{childList:true});if(recent)observer.observe(recent,{childList:true});
  }

  function install(attempt=0){
    installStyles();
    if(!installBulkBar()){if(attempt<18)setTimeout(()=>install(attempt+1),100+attempt*45);return;}
    guardDangerousActions();bindObserver();syncRows();
    window.AdminWorkflowV2={syncRows,applyBulk,getSelected:()=>[...selected],stage:'admin-member-safety-v2'};
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>install(),{once:true});else install();
})();