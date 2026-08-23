(function(){
  'use strict';
  if(window.__designEditorProjectFileV1)return;
  window.__designEditorProjectFileV1=true;
  if(new URLSearchParams(location.search).get('embed')!=='1')return;

  const DRAFT_KEY='programTool.designEditor.draft.v1';
  const CARD_ID='designProjectFileTools';
  const STYLE_ID='designProjectFileStyles';
  const INPUT_ID='designProjectFileInput';
  const FORMAT='program-studio-design-project';
  const FORMAT_VERSION=1;
  const MAX_FILE_BYTES=30*1024*1024;
  const MAX_SURFACES=12;
  const MAX_ITEMS_PER_SURFACE=500;
  const SPINE_DIRECTIONS=new Set(['bottomToTop','vertical','topToBottom']);
  const SPINE_ZONES=new Set(['top','center','bottom']);
  let installed=false;
  let busy=false;

  const byId=id=>document.getElementById(id);
  const project=()=>window.DesignEditorApp?.project||null;

  function setStatus(message,type='info'){
    const node=byId('editorStatus');if(!node)return;
    node.className=`editor-status ${type}`;node.textContent=message;
  }

  function safeName(value){
    return String(value||'design-project').trim().replace(/[\\/:*?"<>|]+/g,'_').replace(/\s+/g,'_').slice(0,80)||'design-project';
  }

  function clone(value){
    try{return JSON.parse(JSON.stringify(value));}catch(_){return null;}
  }

  function validNumber(value,min,max){
    const number=Number(value);return Number.isFinite(number)&&number>=min&&number<=max;
  }

  function isCoverProject(value){
    return value?.designMode==='cover'||value?.presetId==='cover-a4';
  }

  function validateCoverProject(value){
    if(!isCoverProject(value))return value;
    const cover=value.cover;
    if(!cover||typeof cover!=='object')throw new Error('표지 프로젝트의 책등·제본 정보가 없습니다.');
    if(!validNumber(cover.trimWidth,80,300)||!validNumber(cover.trimHeight,100,450))throw new Error('표지 완성 규격 정보가 올바르지 않습니다.');
    if(!validNumber(cover.bleed,0,10)||!validNumber(cover.safe,3,30))throw new Error('표지 도련·안전여백 정보가 올바르지 않습니다.');
    if(!validNumber(cover.pageCount,2,10000)||!validNumber(cover.paperCaliper,.01,1)||!validNumber(cover.bindingAdjust,0,20))throw new Error('표지 제본 계산 정보가 올바르지 않습니다.');
    if(cover.manualSpine&&!validNumber(cover.spineManual,0,100))throw new Error('표지 수동 책등 정보가 올바르지 않습니다.');
    if(!SPINE_DIRECTIONS.has(String(cover.spineDirection||'')))throw new Error('표지 책등 글자 방향 정보가 올바르지 않습니다.');
    if(value.surfaces.length!==1||value.surfaces[0]?.id!=='cover')throw new Error('표지는 뒤표지·책등·앞표지 단일 펼침면이어야 합니다.');
    const surface=value.surfaces[0];
    for(const item of surface.elements||[]){
      if(item?.coverRole!=='spine-title')continue;
      if(!SPINE_DIRECTIONS.has(String(item.spineDirection||'')))throw new Error('책등 글자 방향 정보가 손상되었습니다.');
      if(item.spineZone&&!SPINE_ZONES.has(String(item.spineZone)))throw new Error('책등 글자 위치 정보가 손상되었습니다.');
      if(item.spineYPercent!=null&&!validNumber(item.spineYPercent,0,100))throw new Error('책등 글자 세로 위치 정보가 손상되었습니다.');
    }
    return value;
  }

  function canonicalizeCoverProject(value){
    if(!isCoverProject(value))return value;
    validateCoverProject(value);
    const model=window.DesignEditorCoverModel;
    if(!model?.applyToProject)throw new Error('표지 프로젝트 모델을 준비하지 못했습니다.');
    const cloudProjectId=value.cloudProjectId;
    model.applyToProject(value,value.cover);
    if(cloudProjectId)value.cloudProjectId=cloudProjectId;
    validateCoverProject(value);
    return value;
  }

  function validateProject(raw){
    const value=raw&&typeof raw==='object'?raw:null;
    if(!value)throw new Error('프로젝트 파일 형식이 올바르지 않습니다.');
    if(!String(value.presetId||'').trim())throw new Error('프로젝트 종류 정보가 없습니다.');
    if(!validNumber(value.width,20,2000)||!validNumber(value.height,20,2000))throw new Error('프로젝트 규격 정보가 올바르지 않습니다.');
    if(!Array.isArray(value.surfaces)||!value.surfaces.length||value.surfaces.length>MAX_SURFACES)throw new Error('프로젝트 면 구성이 올바르지 않습니다.');
    for(const surface of value.surfaces){
      if(!surface||typeof surface!=='object'||!String(surface.id||'').trim())throw new Error('프로젝트 면 정보가 손상되었습니다.');
      const elements=Array.isArray(surface.elements)?surface.elements:[];
      const extras=Array.isArray(surface.extras)?surface.extras:[];
      if(elements.length+extras.length>MAX_ITEMS_PER_SURFACE)throw new Error('한 면에 포함된 요소가 너무 많습니다.');
      for(const item of extras){
        if(item?.type==='image'&&item.src&&!/^data:image\/(?:png|jpeg|webp);base64,/i.test(String(item.src)))throw new Error('지원하지 않는 이미지 데이터가 포함되어 있습니다.');
      }
    }
    validateCoverProject(value);
    return value;
  }

  function unwrapProject(parsed){
    const raw=parsed?.format===FORMAT?(()=>{
      if(Number(parsed.version)!==FORMAT_VERSION)throw new Error('현재 버전에서 지원하지 않는 프로젝트 파일입니다.');
      return parsed.project;
    })():parsed;
    return canonicalizeCoverProject(validateProject(raw));
  }

  async function buildPortablePayload(current=project()){
    if(!current)throw new Error('저장할 디자인 작업이 없습니다.');
    const assetStore=window.DesignEditorAssetStore;
    const snapshot=assetStore?.toPortableProject?await assetStore.toPortableProject(current):clone(current);
    if(!snapshot)throw new Error('현재 디자인 작업을 읽지 못했습니다.');
    validateProject(snapshot);canonicalizeCoverProject(snapshot);
    return{format:FORMAT,version:FORMAT_VERSION,savedAt:new Date().toISOString(),project:snapshot};
  }

  async function restorePortablePayload(parsed,reason='project-file-import'){
    const portable=clone(unwrapProject(parsed));
    if(!portable)throw new Error('프로젝트 내용을 복원하지 못했습니다.');
    const assetStore=window.DesignEditorAssetStore;
    const incoming=assetStore?.importPortableProject?await assetStore.importPortableProject(portable):portable;
    canonicalizeCoverProject(incoming);
    if(!incoming.activeSurface||!incoming.surfaces.some(surface=>surface.id===incoming.activeSurface))incoming.activeSurface=incoming.surfaces[0].id;
    localStorage.setItem(DRAFT_KEY,JSON.stringify(incoming));
    const resumed=window.DesignEditorApp?.resumeDraft?.();
    if(resumed===false)throw new Error('프로젝트 화면을 복원하지 못했습니다.');
    setTimeout(()=>{
      window.DesignEditorPhase2?.sync?.();
      window.DesignEditorCoverSpineTools?.sync?.();
      window.DesignEditorCoverPreviewZones?.render?.();
      window.DesignEditorDraftScope?.saveCurrent?.(reason);
      window.dispatchEvent(new Event('resize'));
    },90);
    return incoming;
  }

  function setBusy(value){
    busy=Boolean(value);
    ['designProjectSave','designProjectLoad'].forEach(id=>{const node=byId(id);if(node)node.disabled=busy;});
  }

  function downloadText(text,name){
    const blob=new Blob([text],{type:'application/json;charset=utf-8'});
    const url=URL.createObjectURL(blob);
    try{
      const link=document.createElement('a');link.href=url;link.download=name;document.body.appendChild(link);link.click();link.remove();
    }finally{setTimeout(()=>URL.revokeObjectURL(url),1000);}
  }

  async function exportProject(){
    if(busy)return;
    const current=project();if(!current)return setStatus('저장할 디자인 작업이 없습니다.','info');
    setBusy(true);setStatus('프로젝트 파일을 준비하는 중입니다.','info');
    try{
      const payload=await buildPortablePayload(current);
      downloadText(JSON.stringify(payload),`${safeName(current.name)}.design.json`);
      setStatus('디자인 프로젝트 파일을 저장했습니다.','ok');
    }catch(error){setStatus(error.message||'프로젝트 파일 저장에 실패했습니다.','err');}
    finally{setBusy(false);}
  }

  function triggerImport(){
    if(busy)return;
    const input=byId(INPUT_ID);if(input){input.value='';input.click();}
  }

  async function importProject(event){
    const input=event.currentTarget,file=input.files?.[0];input.value='';
    if(!file)return;
    if(file.size>MAX_FILE_BYTES)return setStatus('프로젝트 파일은 30MB 이하만 불러올 수 있습니다.','err');
    setBusy(true);setStatus('프로젝트 파일을 확인하는 중입니다.','info');
    try{
      const parsed=JSON.parse(await file.text());
      const incoming=await restorePortablePayload(parsed,'project-file-import');
      setStatus(`${incoming.name||'디자인'} 프로젝트를 불러왔습니다.`,'ok');
    }catch(error){
      setStatus(error instanceof SyntaxError?'JSON 프로젝트 파일을 읽을 수 없습니다.':error.message||'프로젝트 파일을 불러오지 못했습니다.','err');
    }finally{setBusy(false);}
  }

  function installStyles(){
    if(byId(STYLE_ID))return;
    const style=document.createElement('style');style.id=STYLE_ID;style.textContent=`
      .design-project-file-grid{display:grid;grid-template-columns:1fr 1fr;gap:5px}.design-project-file-grid button{border:1px solid #d7e0e9;border-radius:8px;background:#fff;color:#475569;padding:7px 4px;font-size:8px;font-weight:900;cursor:pointer}.design-project-file-grid button:hover:not(:disabled){border-color:#79b9c8;background:#f0fdff}.design-project-file-grid button:disabled{opacity:.45;cursor:not-allowed}.design-project-file-note{margin-top:6px;color:#7c8797;font-size:7px;line-height:1.5}
    `;document.head.appendChild(style);
  }

  function installCard(){
    if(byId(CARD_ID))return true;
    const sidebar=document.querySelector('.sidebar'),clipboard=byId('designElementClipboardTools');if(!sidebar)return false;
    const card=document.createElement('section');card.id=CARD_ID;card.className='side-card';
    const coverNote=project()?.designMode==='cover'?' 표지는 완성 규격·책등·제본 설정과 책등 글자 방향까지 함께 저장합니다.':'';
    card.innerHTML=`<div class="side-label">작업 파일</div><div class="design-project-file-grid"><button id="designProjectSave" type="button">프로젝트 저장</button><button id="designProjectLoad" type="button">프로젝트 불러오기</button></div><div class="design-project-file-note">글씨·이미지·도형과 모든 면 구성을 통째로 저장합니다.${coverNote} 다른 PC에서도 이어서 편집할 수 있습니다.</div><input id="${INPUT_ID}" type="file" accept=".json,.design.json,application/json" hidden>`;
    if(clipboard?.nextSibling)sidebar.insertBefore(card,clipboard.nextSibling);else sidebar.appendChild(card);
    byId('designProjectSave')?.addEventListener('click',exportProject);
    byId('designProjectLoad')?.addEventListener('click',triggerImport);
    byId(INPUT_ID)?.addEventListener('change',importProject);
    return true;
  }

  function install(){
    if(installed)return true;
    if(!document.querySelector('.sidebar')||!byId('artboard')||!window.DesignEditorApp)return false;
    installed=true;installStyles();installCard();
    window.DesignEditorProjectFile={exportProject,triggerImport,buildPortablePayload,restorePortablePayload,validateProject,validateCoverProject,canonicalizeCoverProject,unwrapProject,format:FORMAT,version:FORMAT_VERSION,maxFileBytes:MAX_FILE_BYTES,stage:'portable-design-project-save-load-cover-aware'};
    return true;
  }

  function boot(){if(install())return;[180,420,800,1300,2200,3200].forEach(delay=>setTimeout(install,delay));}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
