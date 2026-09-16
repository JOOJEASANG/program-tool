// Approval-only member management and admin-only business stamp protection.
(function(){
  'use strict';
  if(window.__adminWorkflowApprovedOnlyV1)return;
  window.__adminWorkflowApprovedOnlyV1=true;

  const path=(location.pathname||'/').replace(/\/+$/,'')||'/';
  if(!(path==='/admin'||path==='/admin.html'))return;

  const $=id=>document.getElementById(id);
  const selected=new Set();
  const MAX_STAMP_BYTES=300*1024;
  const MAX_STAMP_EDGE=4096;
  const MAX_STAMP_PIXELS=16*1024*1024;
  const STAMP_TYPES=new Set(['image/png','image/jpeg','image/webp']);
  let busy=false;
  let observer=null;
  let stampBusy=false;
  let stampMigrationAttempted=false;

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

  function setBusinessStatus(message,isError=false){
    const status=$('businessStatus');
    if(!status)return;
    status.className='status '+(isError?'err':'ok');
    status.textContent=message;
  }
  function validStampDataUrl(value){return /^data:image\/(?:png|jpeg|webp);base64,/i.test(String(value||''));}
  function setStampPreview(dataUrl=''){
    const preview=$('stampPreview');
    if(!preview)return;
    preview.replaceChildren();
    if(!validStampDataUrl(dataUrl)){preview.textContent='직인 미등록';return;}
    const image=document.createElement('img');
    image.alt='사업자 직인';
    image.src=dataUrl;
    preview.appendChild(image);
  }
  function scrubLegacyStampCache(){
    try{
      const key='programStudioBusiness';
      const cached=JSON.parse(localStorage.getItem(key)||'{}');
      if(cached&&Object.prototype.hasOwnProperty.call(cached,'stampData')){
        delete cached.stampData;
        localStorage.setItem(key,JSON.stringify(cached));
      }
    }catch(_){}
  }
  async function stampDimensions(file){
    if(typeof createImageBitmap==='function'){
      const bitmap=await createImageBitmap(file);
      try{return {width:bitmap.width,height:bitmap.height};}
      finally{bitmap.close?.();}
    }
    return new Promise((resolve,reject)=>{
      const url=URL.createObjectURL(file);
      const image=new Image();
      const done=()=>URL.revokeObjectURL(url);
      image.onload=()=>{const size={width:image.naturalWidth,height:image.naturalHeight};done();resolve(size);};
      image.onerror=()=>{done();reject(new Error('이미지를 확인할 수 없습니다.'));};
      image.src=url;
    });
  }
  async function validateStamp(file){
    if(!STAMP_TYPES.has(String(file?.type||'').toLowerCase()))throw new Error('PNG, JPG, WebP 이미지만 사용할 수 있습니다.');
    if(!file.size||file.size>MAX_STAMP_BYTES)throw new Error('직인 이미지는 300KB 이하로 사용해 주세요.');
    const {width,height}=await stampDimensions(file);
    if(!width||!height||width>MAX_STAMP_EDGE||height>MAX_STAMP_EDGE||width*height>MAX_STAMP_PIXELS){
      throw new Error('직인 이미지는 한 변 4096px, 총 1,600만 화소 이하로 사용해 주세요.');
    }
  }
  function fileAsDataUrl(file){
    return new Promise((resolve,reject)=>{
      const reader=new FileReader();
      reader.onload=()=>resolve(String(reader.result||''));
      reader.onerror=()=>reject(new Error('직인 파일을 읽지 못했습니다.'));
      reader.readAsDataURL(file);
    });
  }
  async function savePrivateStamp(dataUrl){
    if(!validStampDataUrl(dataUrl))throw new Error('직인 이미지 데이터 형식이 올바르지 않습니다.');
    await window.db.collection('settings').doc('business_private').set({
      stampData:dataUrl,
      updatedAt:window.firebase.firestore.FieldValue.serverTimestamp()
    },{merge:true});
  }
  async function removeLegacyPublicStamp(){
    await window.db.collection('settings').doc('business').set({
      stampData:window.firebase.firestore.FieldValue.delete(),
      updatedAt:window.firebase.firestore.FieldValue.serverTimestamp()
    },{merge:true});
  }
  async function migrateLegacyPublicStamp(){
    if(stampMigrationAttempted||!window.db||!window.firebase)return;
    stampMigrationAttempted=true;
    scrubLegacyStampCache();
    try{
      const privateRef=window.db.collection('settings').doc('business_private');
      const publicRef=window.db.collection('settings').doc('business');
      const [privateSnapshot,publicSnapshot]=await Promise.all([privateRef.get(),publicRef.get()]);
      const privateStamp=privateSnapshot.exists?String(privateSnapshot.data()?.stampData||''):'';
      const legacyStamp=publicSnapshot.exists?String(publicSnapshot.data()?.stampData||''):'';
      if(validStampDataUrl(privateStamp)){
        setStampPreview(privateStamp);
        if(legacyStamp)await removeLegacyPublicStamp();
        return;
      }
      if(validStampDataUrl(legacyStamp)){
        await savePrivateStamp(legacyStamp);
        setStampPreview(legacyStamp);
        await removeLegacyPublicStamp();
        setBusinessStatus('기존 공개 직인을 관리자 전용 저장소로 안전하게 이전했습니다.');
        return;
      }
      setStampPreview('');
      if(legacyStamp)await removeLegacyPublicStamp();
    }catch(error){
      stampMigrationAttempted=false;
      console.warn('[admin-stamp] private migration failed',error);
    }
  }
  async function onStampChange(event){
    const input=event.currentTarget;
    const file=input?.files?.[0];
    if(!file||stampBusy)return;
    stampBusy=true;input.disabled=true;
    try{
      await validateStamp(file);
      const dataUrl=await fileAsDataUrl(file);
      await savePrivateStamp(dataUrl);
      await removeLegacyPublicStamp().catch(()=>{});
      scrubLegacyStampCache();
      setStampPreview(dataUrl);
      setBusinessStatus('직인을 관리자 전용 저장소에 저장했습니다.');
    }catch(error){
      setBusinessStatus(error.message||'직인 저장에 실패했습니다.',true);
    }finally{
      stampBusy=false;input.disabled=false;input.value='';
    }
  }
  async function onRemoveStamp(){
    if(stampBusy)return;
    stampBusy=true;
    const button=$('removeStampBtn');if(button)button.disabled=true;
    try{
      await window.db.collection('settings').doc('business_private').set({
        stampData:window.firebase.firestore.FieldValue.delete(),
        updatedAt:window.firebase.firestore.FieldValue.serverTimestamp()
      },{merge:true});
      await removeLegacyPublicStamp().catch(()=>{});
      scrubLegacyStampCache();
      setStampPreview('');
      setBusinessStatus('직인을 삭제했습니다.');
    }catch(error){
      setBusinessStatus('직인 삭제 실패: '+(error.message||error),true);
    }finally{
      stampBusy=false;if(button)button.disabled=false;
    }
  }
  function installPrivateStampProtection(){
    const input=$('stampFile'),remove=$('removeStampBtn');
    if(!input||!remove)return false;
    input.onchange=onStampChange;
    remove.onclick=onRemoveStamp;
    const subtitle=input.closest('.card')?.querySelector('.cardsub');
    if(subtitle)subtitle.textContent='PNG/JPG/WebP, 최대 300KB · 관리자 전용 저장';
    scrubLegacyStampCache();
    if(window.auth?.onAuthStateChanged){
      window.auth.onAuthStateChanged(user=>{if(user)migrateLegacyPublicStamp();});
    }else{
      setTimeout(migrateLegacyPublicStamp,250);
    }
    return true;
  }

  function install(attempt=0){
    installStyles();
    if(!installBulkBar()){if(attempt<20)setTimeout(()=>install(attempt+1),100);return;}
    if(!observer&&$('memberList')){observer=new MutationObserver(syncRows);observer.observe($('memberList'),{childList:true,subtree:true});}
    installPrivateStampProtection();
    syncRows();
    window.AdminWorkflowV2={
      syncRows,
      applyBulk,
      getSelected:()=>[...selected],
      migrateLegacyPublicStamp,
      stage:'admin-approved-members-only-private-stamp'
    };
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>install(),{once:true});else install();
})();
