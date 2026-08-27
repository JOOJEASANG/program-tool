(function(){
  'use strict';
  if(window.__designEditorSimpleInterfaceV1)return;
  window.__designEditorSimpleInterfaceV1=true;

  const path=location.pathname.replace(/\/+$/,'')||'/';
  const embedded=new URLSearchParams(location.search).get('embed')==='1';
  const generalPath=path==='/design-editor/general'||path==='/design-editor/general.html'||path.endsWith('/design-editor/general.html');
  const embeddedGeneralPath=embedded&&(path==='/design-editor/index.html'||path.endsWith('/design-editor/index.html'));
  if(!generalPath&&!embeddedGeneralPath)return;

  const STYLE_ID='designEditorSimpleInterfaceStyles';
  const ADVANCED_CARD_ID='designAdvancedTools';
  const INSPECTOR_DETAILS_ID='designInspectorAdvanced';
  const LEGACY_PREF_KEY='programTool.designEditor.advancedOpen.v1';
  const TOOLS_PREF_KEY='programTool.designEditor.toolsAdvancedOpen.v2';
  const INSPECTOR_PREF_KEY='programTool.designEditor.inspectorAdvancedOpen.v2';
  const ADVANCED_CARD_IDS=['designPhase3LayoutTools','designElementClipboardTools','designProjectFileTools','designRotationTools'];
  let installed=false;
  let syncFrame=0;

  const byId=id=>document.getElementById(id);
  const project=()=>window.DesignEditorApp?.project||null;
  function preference(key){
    try{
      const exact=localStorage.getItem(key);
      if(exact!==null)return exact==='1';
      return localStorage.getItem(LEGACY_PREF_KEY)==='1';
    }catch(_){return false;}
  }
  function remember(key,value){try{localStorage.setItem(key,value?'1':'0');}catch(_){} }

  function installStyles(){
    if(byId(STYLE_ID))return;
    const style=document.createElement('style');style.id=STYLE_ID;
    style.textContent=`
      .simple-advanced-card{padding:0!important;overflow:hidden}.simple-advanced-card>summary{list-style:none;cursor:pointer;padding:11px;display:flex;align-items:center;gap:8px;color:#475569;font-size:9px;font-weight:950}.simple-advanced-card>summary::-webkit-details-marker{display:none}.simple-advanced-card>summary::before{content:'+';width:18px;height:18px;border-radius:6px;background:#eef4f8;display:grid;place-items:center;color:#12396d;font-size:11px}.simple-advanced-card[open]>summary::before{content:'–'}.simple-advanced-card[open]>summary{border-bottom:1px solid #e4eaf0}.simple-advanced-sub{margin-left:auto;font-size:7px;font-weight:800;color:#94a3b8}.simple-advanced-stack{padding:0 10px 10px}.simple-advanced-stack>.side-card{margin:0!important;padding:10px 0!important;border:0!important;border-bottom:1px solid #e7edf2!important;border-radius:0!important;background:transparent!important}.simple-advanced-stack>.side-card:last-child{border-bottom:0!important}
      .simple-inspector-advanced{margin-top:9px;border-top:1px solid #e5eaf0;padding-top:7px}.simple-inspector-advanced>summary{cursor:pointer;list-style:none;border:1px solid #d7e0e9;border-radius:8px;background:#f8fafc;color:#64748b;padding:7px 8px;font-size:8px;font-weight:900}.simple-inspector-advanced>summary::-webkit-details-marker{display:none}.simple-inspector-advanced>summary::after{content:' 보기';font-weight:800;color:#94a3b8}.simple-inspector-advanced[open]>summary::after{content:' 닫기'}.simple-inspector-body{padding-top:8px}.simple-interface-hint{margin:-2px 0 8px;padding:7px 8px;border-radius:8px;background:#f0fdff;color:#0e7490;font-size:7px;line-height:1.45;font-weight:800}
      .sidebar>.side-card#designQuickDesignTools{order:-8}.sidebar>.side-card#designPhase2Tools{order:-7}.sidebar>.side-card#inspector{order:-6}.sidebar>.side-card#designPhase4SmartLayout{order:-5}.sidebar>.side-card#designOutputTools{order:-4}.sidebar>.side-card#designPrintQualityTools{order:-3}.sidebar>.side-card#designPrintSafetyTools{order:-2}.sidebar>.simple-advanced-card{order:-1}
    `;
    document.head.appendChild(style);
  }

  function selectedKind(){
    if(document.querySelector('.design-text.selected'))return'text';
    const extra=document.querySelector('.phase2-extra-object.selected');
    if(!extra)return'none';
    const p=project(),s=p?.surfaces?.find(item=>item.id===p.activeSurface)||p?.surfaces?.[0];
    const item=s?.extras?.find(entry=>entry.id===extra.dataset.extraId);
    if(item?.type==='image')return'image';
    if(item?.type==='shape')return'shape';
    return'none';
  }

  function moveNode(body,node){if(node&&node.parentElement&&!body.contains(node))body.appendChild(node);}
  function textOf(node){return String(node?.textContent||'').replace(/\s+/g,' ').trim();}

  function advancedInspectorNodes(root,kind){
    const nodes=[];
    [...root.children].forEach(node=>{
      if(node.id===INSPECTOR_DETAILS_ID||node.classList.contains('inspector-title')||node.classList.contains('inspector-note')||node.classList.contains('quick-style-panel'))return;
      const text=textOf(node);
      if(kind==='text'){
        if(text.includes('앞 아이콘')||node.classList.contains('check-row')||node.classList.contains('action-grid')||node.id==='phase2TextControls')nodes.push(node);
        return;
      }
      if(kind==='shape'||kind==='image'){
        if(node.classList.contains('check-row')||node.classList.contains('phase2-inspector-actions')){nodes.push(node);return;}
        if(node.classList.contains('field-grid')&&(text.includes('X mm')||text.includes('Y mm')||text.includes('가로 mm')||text.includes('세로 mm')||text.includes('가로 초점')||text.includes('세로 초점')))nodes.push(node);
      }
    });
    return nodes;
  }

  function simplifyInspector(){
    const root=byId('inspector');if(!root||!project())return;
    const kind=selectedKind();
    const existing=byId(INSPECTOR_DETAILS_ID);
    if(kind==='none'){
      existing?.remove();
      if(!root.querySelector('.simple-interface-hint')){
        const note=document.createElement('div');note.className='simple-interface-hint';note.textContent='기본 설정만 먼저 보여줍니다. 글씨·이미지·도형을 선택하면 필요한 옵션이 바로 나타납니다.';
        const inspectorNote=root.querySelector('.inspector-note');if(inspectorNote)inspectorNote.insertAdjacentElement('afterend',note);
      }
      return;
    }
    root.querySelector('.simple-interface-hint')?.remove();
    if(existing)return;
    const advanced=advancedInspectorNodes(root,kind);if(!advanced.length)return;
    const details=document.createElement('details');details.id=INSPECTOR_DETAILS_ID;details.className='simple-inspector-advanced';details.open=preference(INSPECTOR_PREF_KEY);
    const label=kind==='text'?'아이콘·잠금·세부 간격':kind==='image'?'위치·크기·초점·잠금':'위치·크기·잠금';
    details.innerHTML=`<summary>세부 설정 <span class="simple-advanced-sub">${label}</span></summary><div class="simple-inspector-body"></div>`;
    const body=details.querySelector('.simple-inspector-body');advanced.forEach(node=>moveNode(body,node));
    details.addEventListener('toggle',()=>remember(INSPECTOR_PREF_KEY,details.open));root.appendChild(details);
  }

  function ensureAdvancedCard(){
    const sidebar=document.querySelector('.sidebar');if(!sidebar)return false;
    let details=byId(ADVANCED_CARD_ID);
    if(!details){
      details=document.createElement('details');details.id=ADVANCED_CARD_ID;details.className='side-card simple-advanced-card';details.open=preference(TOOLS_PREF_KEY);
      details.innerHTML='<summary>고급 도구 <span class="simple-advanced-sub">정밀정렬 · 복사 · 프로젝트 · 회전</span></summary><div class="simple-advanced-stack"></div>';
      details.addEventListener('toggle',()=>remember(TOOLS_PREF_KEY,details.open));sidebar.appendChild(details);
    }
    const stack=details.querySelector('.simple-advanced-stack');
    ADVANCED_CARD_IDS.forEach(id=>{const card=byId(id);if(card&&card.parentElement!==stack)stack.appendChild(card);});
    return true;
  }

  function sync(){
    if(!project()||byId('editorShell')?.classList.contains('hidden'))return;
    ensureAdvancedCard();simplifyInspector();
  }
  function queueSync(){
    if(syncFrame)return;
    syncFrame=requestAnimationFrame(()=>{
      syncFrame=requestAnimationFrame(()=>{
        syncFrame=0;
        sync();
      });
    });
  }
  function bindEvents(){
    ['click','dblclick','input','change','keyup','pointerup'].forEach(name=>document.addEventListener(name,queueSync,false));
    window.addEventListener('resize',queueSync,{passive:true});
  }
  function install(){
    if(installed)return true;
    if(!document.querySelector('.sidebar')||!byId('inspector')||!window.DesignEditorApp)return false;
    installed=true;installStyles();bindEvents();window.DesignEditorSimpleInterface={sync,stage:'basic-first-contextual-sidebar-decoupled-preferences'};
    [180,420,850,1500,2400,3400].forEach(delay=>setTimeout(queueSync,delay));
    return true;
  }
  function boot(){if(install())return;[180,420,850,1500,2600,3600].forEach(delay=>setTimeout(install,delay));}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();