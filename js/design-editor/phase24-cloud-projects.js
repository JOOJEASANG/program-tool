(function(){
  'use strict';
  if(window.__designEditorCloudProjectsV1)return;
  window.__designEditorCloudProjectsV1=true;
  if(new URLSearchParams(location.search).get('embed')!=='1')return;

  const CARD_ID='designCloudProjectTools';
  const STYLE_ID='designCloudProjectStyles';
  const STORAGE_SCRIPT_ID='designCloudStorageSdk';
  const MAX_PROJECTS=8;
  const MAX_FILE_BYTES=30*1024*1024;
  const STORAGE_ROOT='design_projects';
  let installed=false;
  let busy=false;

  const byId=id=>document.getElementById(id);
  const project=()=>window.DesignEditorApp?.project||null;
  const uid=()=>window.auth?.currentUser?.uid||'';
  const safeId=value=>String(value||'').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,80);
  const newId=()=>`design_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,10)}`;

  function setStatus(message,type='info'){
    const node=byId('editorStatus');if(!node)return;
    node.className=`editor-status ${type}`;node.textContent=message;
  }

  function setBusy(value){
    busy=Boolean(value);
    ['designCloudSave','designCloudRefresh'].forEach(id=>{const node=byId(id);if(node)node.disabled=busy;});
    document.querySelectorAll('[data-cloud-load],[data-cloud-delete]').forEach(node=>node.disabled=busy);
  }

  function ensureStorageSdk(){
    if(typeof window.firebase?.storage==='function')return Promise.resolve(window.firebase.storage());
    return new Promise((resolve,reject)=>{
      let script=byId(STORAGE_SCRIPT_ID);
      const done=()=>typeof window.firebase?.storage==='function'?resolve(window.firebase.storage()):reject(new Error('클라우드 저장 모듈을 불러오지 못했습니다.'));
      if(script){script.addEventListener('load',done,{once:true});script.addEventListener('error',()=>reject(new Error('클라우드 저장 모듈을 불러오지 못했습니다.')),{once:true});return;}
      script=document.createElement('script');script.id=STORAGE_SCRIPT_ID;script.src='https://www.gstatic.com/firebasejs/9.23.0/firebase-storage-compat.js';script.onload=done;script.onerror=()=>reject(new Error('클라우드 저장 모듈을 불러오지 못했습니다.'));document.head.appendChild(script);
    });
  }

  function metadataCollection(userId){return window.db.collection('users').doc(userId).collection('design_projects');}
  function storagePath(userId,projectId){return `${STORAGE_ROOT}/${userId}/${projectId}.design.json`;}

  function installStyles(){
    if(byId(STYLE_ID))return;
    const style=document.createElement('style');style.id=STYLE_ID;style.textContent=`
      .cloud-project-actions{display:grid;grid-template-columns:1fr auto;gap:6px}.cloud-project-actions button{border:1px solid #cfdbe5;border-radius:8px;background:#fff;padding:8px 7px;font-size:8px;font-weight:900;color:#334155;cursor:pointer}.cloud-project-actions .primary{border-color:#12396d;background:#12396d;color:#fff}.cloud-project-list{display:grid;gap:5px;margin-top:8px}.cloud-project-row{border:1px solid #e1e8ef;border-radius:9px;background:#f8fafc;padding:7px}.cloud-project-head{display:flex;align-items:center;gap:6px}.cloud-project-name{min-width:0;flex:1;font-size:8px;font-weight:900;color:#334155;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.cloud-project-meta{margin-top:3px;font-size:6.8px;color:#7c8797}.cloud-project-buttons{display:flex;gap:4px;margin-top:6px}.cloud-project-buttons button{border:1px solid #d7e0e9;border-radius:7px;background:#fff;padding:5px 7px;font-size:7px;font-weight:900;cursor:pointer}.cloud-project-buttons .danger{color:#b42318;background:#fff7f7}.cloud-project-empty{border:1px dashed #cbd5e1;border-radius:8px;padding:9px;text-align:center;font-size:7px;color:#94a3b8}.cloud-project-note{margin-top:6px;font-size:6.8px;line-height:1.45;color:#8793a1}
    `;document.head.appendChild(style);
  }

  function formatDate(value){
    const date=value?.toDate?.()||new Date(value||0);
    if(Number.isNaN(date.getTime()))return '';
    return date.toLocaleString('ko-KR',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
  }

  function renderProjects(items=[]){
    const root=byId('designCloudList');if(!root)return;
    if(!items.length){root.innerHTML='<div class="cloud-project-empty">클라우드에 저장된 작업이 없습니다.</div>';return;}
    root.innerHTML=items.map(item=>`<div class="cloud-project-row"><div class="cloud-project-head"><div class="cloud-project-name">${escapeHtml(item.name||'디자인 작업')}</div></div><div class="cloud-project-meta">${escapeHtml(item.presetId||'')} · ${Number(item.width)||0}×${Number(item.height)||0}mm · ${escapeHtml(formatDate(item.updatedAt))}</div><div class="cloud-project-buttons"><button type="button" data-cloud-load="${escapeHtml(item.id)}">불러오기</button><button type="button" data-cloud-delete="${escapeHtml(item.id)}" class="danger">삭제</button></div></div>`).join('');
    root.querySelectorAll('[data-cloud-load]').forEach(button=>button.addEventListener('click',()=>loadCloudProject(button.dataset.cloudLoad)));
    root.querySelectorAll('[data-cloud-delete]').forEach(button=>button.addEventListener('click',()=>deleteCloudProject(button.dataset.cloudDelete)));
  }

  function escapeHtml(value){return String(value||'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));}

  async function listCloudProjects(){
    const userId=uid();
    if(!userId){renderProjects([]);return[];}
    const snapshot=await metadataCollection(userId).orderBy('updatedAt','desc').limit(MAX_PROJECTS).get();
    const items=snapshot.docs.map(doc=>({id:doc.id,...doc.data()}));renderProjects(items);return items;
  }

  async function saveCloudProject(){
    if(busy)return;
    const current=project(),userId=uid(),projectFile=window.DesignEditorProjectFile;
    if(!current)return setStatus('저장할 디자인 작업이 없습니다.','info');
    if(!userId)return setStatus('클라우드 저장은 로그인 후 사용할 수 있습니다.','err');
    if(!projectFile?.buildPortablePayload)return setStatus('프로젝트 저장 모듈을 준비하지 못했습니다.','err');
    setBusy(true);setStatus('클라우드 저장 파일을 준비하는 중입니다.','info');
    let uploadedRef=null;
    try{
      const existingId=safeId(current.cloudProjectId);
      const projectId=existingId||newId();
      const payload=await projectFile.buildPortablePayload(current);
      const text=JSON.stringify(payload);
      const blob=new Blob([text],{type:'application/json'});
      if(blob.size>MAX_FILE_BYTES)throw new Error('클라우드 프로젝트는 30MB 이하만 저장할 수 있습니다.');
      const storage=await ensureStorageSdk();
      const path=storagePath(userId,projectId);
      uploadedRef=storage.ref(path);
      await uploadedRef.put(blob,{contentType:'application/json',customMetadata:{ownerUid:userId,format:projectFile.format||'program-studio-design-project'}});
      const docRef=metadataCollection(userId).doc(projectId);
      const existing=await docRef.get();
      const now=window.firebase.firestore.FieldValue.serverTimestamp();
      const metadata={
        id:projectId,
        name:String(current.name||'디자인 작업').slice(0,120),
        presetId:String(current.presetId||'').slice(0,80),
        width:Number(current.width)||0,
        height:Number(current.height)||0,
        storagePath:path,
        size:blob.size,
        updatedAt:now,
        createdAt:existing.exists?(existing.data().createdAt||now):now
      };
      await docRef.set(metadata);
      current.cloudProjectId=projectId;
      window.DesignEditorDraftScope?.saveCurrent?.('cloud-project-save');
      await listCloudProjects();
      setStatus(existing.exists?'클라우드 작업을 업데이트했습니다.':'클라우드에 새 작업을 저장했습니다.','ok');
      return projectId;
    }catch(error){
      if(uploadedRef){try{await uploadedRef.delete();}catch(_){} }
      setStatus(error.message||'클라우드 저장에 실패했습니다.','err');
      return null;
    }finally{setBusy(false);}
  }

  async function loadCloudProject(projectId){
    if(busy)return;
    const userId=uid(),id=safeId(projectId),projectFile=window.DesignEditorProjectFile;
    if(!userId||!id||!projectFile?.restorePortablePayload)return;
    setBusy(true);setStatus('클라우드 작업을 불러오는 중입니다.','info');
    try{
      const docRef=metadataCollection(userId).doc(id),snapshot=await docRef.get();
      if(!snapshot.exists)throw new Error('저장된 작업 정보를 찾을 수 없습니다.');
      const data=snapshot.data(),path=String(data.storagePath||'');
      if(path!==storagePath(userId,id))throw new Error('클라우드 작업 경로가 올바르지 않습니다.');
      const storage=await ensureStorageSdk(),url=await storage.ref(path).getDownloadURL();
      const response=await fetch(url,{cache:'no-store'});if(!response.ok)throw new Error('클라우드 작업 파일을 내려받지 못했습니다.');
      const blob=await response.blob();if(blob.size>MAX_FILE_BYTES)throw new Error('클라우드 프로젝트 크기가 허용 범위를 넘었습니다.');
      const parsed=JSON.parse(await blob.text());
      const incoming=await projectFile.restorePortablePayload(parsed,'cloud-project-load');
      incoming.cloudProjectId=id;
      try{localStorage.setItem('programTool.designEditor.draft.v1',JSON.stringify(incoming));}catch(_){}
      window.DesignEditorDraftScope?.saveCurrent?.('cloud-project-id');
      setStatus(`${incoming.name||'디자인'} 클라우드 작업을 불러왔습니다.`,'ok');
      return incoming;
    }catch(error){
      setStatus(error instanceof SyntaxError?'클라우드 프로젝트 파일을 읽을 수 없습니다.':error.message||'클라우드 작업을 불러오지 못했습니다.','err');
      return null;
    }finally{setBusy(false);}
  }

  async function deleteCloudProject(projectId){
    if(busy)return;
    const userId=uid(),id=safeId(projectId);if(!userId||!id)return;
    if(!window.confirm('이 클라우드 작업을 삭제하시겠습니까? 로컬 자동저장본은 삭제하지 않습니다.'))return;
    setBusy(true);setStatus('클라우드 작업을 삭제하는 중입니다.','info');
    try{
      const docRef=metadataCollection(userId).doc(id),snapshot=await docRef.get();
      const path=snapshot.exists?String(snapshot.data().storagePath||''):storagePath(userId,id);
      await docRef.delete();
      try{const storage=await ensureStorageSdk();await storage.ref(path).delete();}catch(error){if(error?.code!=='storage/object-not-found')console.warn('Cloud project orphan cleanup failed',error);}
      if(project()?.cloudProjectId===id){delete project().cloudProjectId;window.DesignEditorDraftScope?.saveCurrent?.('cloud-project-delete');}
      await listCloudProjects();setStatus('클라우드 작업을 삭제했습니다.','ok');
    }catch(error){setStatus(error.message||'클라우드 작업 삭제에 실패했습니다.','err');}
    finally{setBusy(false);}
  }

  async function refresh(){
    if(busy)return;
    setBusy(true);
    try{await listCloudProjects();}catch(error){renderProjects([]);setStatus(error.message||'클라우드 작업 목록을 불러오지 못했습니다.','err');}
    finally{setBusy(false);}
  }

  function installCard(){
    if(byId(CARD_ID))return true;
    const sidebar=document.querySelector('.sidebar'),projectFile=byId('designProjectFileTools'),inspector=byId('inspector');if(!sidebar)return false;
    const card=document.createElement('section');card.id=CARD_ID;card.className='side-card';
    card.innerHTML='<div class="side-label">내 클라우드 작업</div><div class="cloud-project-actions"><button id="designCloudSave" class="primary" type="button">클라우드 저장</button><button id="designCloudRefresh" type="button">새로고침</button></div><div id="designCloudList" class="cloud-project-list"><div class="cloud-project-empty">저장된 작업을 확인하는 중입니다.</div></div><div class="cloud-project-note">프로젝트 본문은 내 Firebase Storage에, 목록 정보는 내 Firestore 영역에 저장됩니다. 다른 사용자는 접근할 수 없습니다.</div>';
    if(projectFile?.nextSibling)sidebar.insertBefore(card,projectFile.nextSibling);else if(inspector)sidebar.insertBefore(card,inspector);else sidebar.appendChild(card);
    byId('designCloudSave')?.addEventListener('click',saveCloudProject);byId('designCloudRefresh')?.addEventListener('click',refresh);
    return true;
  }

  function install(){
    if(installed)return true;
    if(!window.auth||!window.db||!window.DesignEditorApp||!window.DesignEditorProjectFile)return false;
    installed=true;installStyles();installCard();
    window.DesignEditorCloudProjects={saveCloudProject,loadCloudProject,deleteCloudProject,listCloudProjects,storagePath,maxFileBytes:MAX_FILE_BYTES,stage:'owner-scoped-firestore-storage-cloud-projects'};
    const unsubscribe=window.auth.onAuthStateChanged(user=>{if(user)refresh();else renderProjects([]);});
    window.addEventListener('pagehide',()=>{try{unsubscribe();}catch(_){}},{once:true});
    return true;
  }

  function boot(){if(install())return;[300,700,1200,2000,3200,4800].forEach(delay=>setTimeout(install,delay));}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
