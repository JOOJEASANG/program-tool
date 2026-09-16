// Approval-only bulk member management for Program Studio admin.
(function(){
  'use strict';
  if(window.__adminWorkflowApprovedOnlyV1)return;
  window.__adminWorkflowApprovedOnlyV1=true;

  const path=(location.pathname||'/').replace(/\/+$/,'')||'/';
  if(!(path==='/admin'||path==='/admin.html'))return;

  const $=id=>document.getElementById(id);
  const selected=new Set();
  let busy=false;
  let observer=null;

  function installStyles(){
    if($('adminWorkflowApprovedOnlyStyles'))return;
    const style=document.createElement('style');
    style.id='adminWorkflowApprovedOnlyStyles';
    style.textContent=`
      .admin-bulkbar{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin:0 0 12px;padding:10px;border:1px solid #dce5ef;border-radius:12px;background:#f8fbff}
      .admin-bulk-count{font-size:11px;font-weight:900;color:#344054;margin-right:auto}
      .admin-bulkbar button{min-height:34px;border:1px solid #d6e0ea;border-radius:8px;background:#fff;color:#475467;padding:0 9px;font-size:10px;font-weight:900;cursor:pointer}
      .admin-bulkbar button[data-bulk-status="approved"]{background:#ecfdf3;color:#067647;border-color:#b7e5cf}
      .admin-bulkbar button[data-bulk-status="suspended"]{background:#fff1f2;color:#b42318;border-color:#fecdd3}
      .admin-bulkbar button:disabled{opacity:.45;cursor:not-allowed}
      .admin-bulk-status{width:100%;font-size:10px;color:#667085}
      #memberList .item{position:relative;padding-left:42px}
      #memberList .admin-member-select{position:absolute;left:13px;top:50%;width:17px;height:17px;transform:translateY(-50%);accent-color:#1769e0;cursor:pointer}
      #memberList .item.admin-selected{border-color:#9cc5eb;background:#f4f9ff}
    `;
    document.head.appendChild(style);
  }

  function memberIdFor(row){return row?.querySelector('[data-member]')?.dataset.member||'';}
  function visibleRows(){return [...document.querySelectorAll('#memberList .item')].filter(row=>row.querySelector('[data-member]'));}
  function syncSelection(){
    const liveIds=new Set(visibleRows().map(memberIdFor).filter(Boolean));
    [...selected].forEach(id=>{if(!liveIds.has(id))selected.delete(id)});
    visibleRows().forEach(row=>{
      const id=memberIdFor(row),checked=selected.has(id);
      row.classList.toggle('admin-selected',checked);
      const input=row.querySelector('.admin-member-select');
      if(input)input.checked=checked;
    });
    if($('adminBulkCount'))$('adminBulkCount').textContent=`${selected.size}명 선택`;
    document.querySelectorAll('#adminBulkBar [data-needs-selection]').forEach(button=>button.disabled=busy||selected.size===0);
  }
  function syncRows(){
    visibleRows().forEach(row=>{
      const id=memberIdFor(row);if(!id||row.querySelector('.admin-member-select'))return;
      const input=document.createElement('input');input.type='checkbox';input.className='admin-member-select';input.setAttribute('aria-label','회원 선택');
      input.addEventListener('change',()=>{input.checked?selected.add(id):selected.delete(id);syncSelection();});
      row.insertBefore(input,row.firstChild);
    });
    syncSelection();
  }
  async function applyBulk(status){
    if(busy||!selected.size)return false;
    const ids=[...selected];
    if(status==='suspended'&&!confirm(`${ids.length}명의 계정을 이용 중지할까요?`))return false;
    busy=true;syncSelection();
    const failures=[];
    for(const id of ids){
      try{
        await window.db.collection('user_permissions').doc(id).set({status,updatedAt:window.firebase.firestore.FieldValue.serverTimestamp()},{merge:true});
        window.ProgramAccess?.clearCache?.(id);
      }catch(error){failures.push(id);}
    }
    busy=false;
    if(!failures.length)selected.clear();
    syncSelection();
    $('refreshBtn')?.click();
    return failures.length===0;
  }
  function installBulkBar(){
    if($('adminBulkBar'))return true;
    const toolbar=document.querySelector('#members .toolbar');if(!toolbar)return false;
    const bar=document.createElement('div');bar.id='adminBulkBar';bar.className='admin-bulkbar';bar.innerHTML='<span id="adminBulkCount" class="admin-bulk-count">0명 선택</span><button type="button" data-needs-selection data-bulk-status="approved">선택 승인</button><button type="button" data-needs-selection data-bulk-status="suspended">선택 중지</button><div class="admin-bulk-status">승인된 회원은 횟수 제한 없이 프로그램을 사용할 수 있습니다.</div>';
    toolbar.insertAdjacentElement('afterend',bar);
    bar.querySelectorAll('[data-bulk-status]').forEach(button=>button.addEventListener('click',()=>applyBulk(button.dataset.bulkStatus)));
    return true;
  }
  function install(attempt=0){
    installStyles();
    if(!installBulkBar()){if(attempt<20)setTimeout(()=>install(attempt+1),100);return;}
    if(!observer&&$('memberList')){observer=new MutationObserver(syncRows);observer.observe($('memberList'),{childList:true,subtree:true});}
    syncRows();
    window.AdminWorkflowV2={syncRows,applyBulk,getSelected:()=>[...selected],stage:'admin-approved-members-only'};
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>install(),{once:true});else install();
})();
