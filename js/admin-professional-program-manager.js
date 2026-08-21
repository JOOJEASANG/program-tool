// Simplified administrator UI for the five core Program Studio tools.
(function(){
  'use strict';
  if(window.__adminProfessionalProgramManagerV1)return;
  window.__adminProfessionalProgramManagerV1=true;
  const path=location.pathname.replace(/\/+$/,'')||'/';
  if(path!=='/admin'&&path!=='/admin.html'&&!path.endsWith('/admin.html'))return;

  const DOC_ID='professional_program_suite';
  const NAV_ID='adminProfessionalProgramsNav';
  const PANEL_ID='adminProfessionalProgramsPanel';
  const STYLE_ID='adminProfessionalProgramsStyles';
  const DEFAULTS=[
    {id:'design-editor',name:'디자인 편집기',icon:'✦',desc:'책표지, 포스터, 전단, 2단·3단 리플렛을 하나의 가벼운 편집기로 제작합니다.',url:'design-editor/',status:'active',visible:true},
    {id:'image-editor',name:'이미지 편집기',icon:'◐',desc:'자르기, 크기 조절, 배경 제거와 기본 이미지 보정을 빠르게 처리합니다.',url:'',status:'coming',visible:true},
    {id:'document-editor',name:'문서 편집기',icon:'▤',desc:'글, 표, 이미지를 편집해 기관·학교·업무 문서를 정돈된 형식으로 완성합니다.',url:'',status:'coming',visible:true},
    {id:'pdf-editor',name:'PDF 편집기',icon:'PDF',desc:'페이지 편집, N-up, 소책자, 간지, 워터마크와 페이지 번호를 처리합니다.',url:'pdf-editor/',status:'active',visible:true},
    {id:'pdf-utility',name:'PDF 유틸리티',icon:'✓',desc:'PDF 검사, 병합, 배경 제거, 용량 줄이기, 복구와 인쇄 전 점검을 처리합니다.',url:'pdf-preflight/',status:'active',visible:true}
  ];

  let programs=DEFAULTS.map(item=>({...item}));
  let selectedId=programs[0].id;
  let dirty=false;
  let busy=false;
  let dragId='';
  let installed=false;

  const byId=id=>document.getElementById(id);
  const esc=value=>String(value==null?'':value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const selected=()=>programs.find(item=>item.id===selectedId)||programs[0]||null;

  function normalizedUrl(item,base){
    const raw=String(item?.url==null?base.url:item.url).trim().slice(0,300);
    if(base.id==='design-editor'&&(!raw||raw==='perfect-binding-cover/'||raw==='/perfect-binding-cover/'))return base.url;
    return raw;
  }

  function normalize(raw){
    const source=Array.isArray(raw?.programs)?raw.programs:[];
    if(!source.length)return DEFAULTS.map(item=>({...item}));
    const defaultsById=new Map(DEFAULTS.map(item=>[item.id,item]));
    const used=new Set();
    const out=[];
    for(const item of source){
      const id=String(item?.id||'');
      const base=defaultsById.get(id);
      if(!base||used.has(id))continue;
      used.add(id);
      out.push({
        ...base,
        name:String(item.name||base.name).trim().slice(0,80)||base.name,
        desc:String(item.desc||base.desc).trim().slice(0,500)||base.desc,
        url:normalizedUrl(item,base),
        status:item.status==='active'?'active':'coming',
        visible:item.visible!==false
      });
    }
    for(const base of DEFAULTS)if(!used.has(base.id))out.push({...base});
    return out;
  }

  function installStyles(){
    if(byId(STYLE_ID))return;
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      .progm-wrap{display:grid;grid-template-columns:minmax(290px,380px) minmax(0,1fr);gap:14px}.progm-card{background:#fff;border:1px solid var(--line);border-radius:16px;padding:16px;box-shadow:0 8px 26px #0f172a0b}.progm-head{display:flex;align-items:center;gap:8px;margin-bottom:13px}.progm-head strong{font-size:14px}.progm-note{font-size:10px;color:var(--muted);line-height:1.55;margin-top:3px}.progm-actions{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-bottom:14px}.progm-save-state{font-size:9px;font-weight:900;border-radius:999px;padding:5px 8px;background:#dcfce7;color:#166534}.progm-save-state.dirty{background:#fff7ed;color:#9a3412}.progm-list{display:flex;flex-direction:column;gap:7px}.progm-item{display:grid;grid-template-columns:22px 38px minmax(0,1fr) auto;align-items:center;gap:8px;padding:10px;border:1px solid #e2e8f0;border-radius:11px;background:#f8fafc;cursor:pointer}.progm-item.on{border-color:#79a9e5;background:#f2f7ff;box-shadow:0 0 0 2px #1769e012}.progm-item.dragover{border-color:#18a7bd;background:#ecfeff}.progm-drag{cursor:grab;color:#98a2b3;font-size:15px;text-align:center;user-select:none}.progm-icon{width:36px;height:36px;border-radius:10px;background:#fff;border:1px solid #e3e9ef;display:grid;place-items:center;font-size:12px;font-weight:950;color:#1769e0}.progm-name{font-size:11px;font-weight:950}.progm-meta{font-size:8px;color:#667085;margin-top:3px}.progm-badge{font-size:8px;font-weight:900;border-radius:999px;padding:4px 7px;background:#dcfce7;color:#166534}.progm-badge.coming{background:#fff7ed;color:#9a3412}.progm-badge.is-hidden{background:#e5e7eb;color:#64748b}.progm-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.progm-field.wide{grid-column:1/-1}.progm-field label{display:block;font-size:9px;font-weight:900;color:#475467;margin-bottom:5px}.progm-field input,.progm-field select,.progm-field textarea{width:100%;border:1px solid #cfd8e3;border-radius:9px;padding:9px;background:#fff;font-size:10px}.progm-field textarea{min-height:118px;resize:vertical;line-height:1.55}.progm-fixed{padding:9px;border:1px solid #e6ebf1;border-radius:9px;background:#f8fafc;font-size:10px;color:#667085}.progm-status{min-height:18px;margin-top:10px;font-size:10px;font-weight:850}.progm-status.ok{color:#166534}.progm-status.err{color:#dc2626}.progm-status.info{color:#1769e0}
      @media(max-width:900px){.progm-wrap{grid-template-columns:1fr}.progm-form{grid-template-columns:1fr}.progm-field.wide{grid-column:auto}}
    `;
    document.head.appendChild(style);
  }

  function hideLegacyManager(){
    byId('adminProgramCatalogNav')?.classList.add('hidden');
    byId('adminProgramCatalogLabel')?.classList.add('hidden');
    byId('adminProgramCatalogPanel')?.classList.remove('on');
    byId('adminProgramCatalogPanel')?.classList.add('hidden');
  }

  function makeNav(){
    if(byId(NAV_ID))return byId(NAV_ID);
    const side=document.querySelector('.side');
    if(!side)return null;
    const foot=side.querySelector('.sidefoot');
    const label=document.createElement('div');
    label.className='navlabel';
    label.id='adminProfessionalProgramsLabel';
    label.textContent='프로그램';
    const button=document.createElement('button');
    button.id=NAV_ID;
    button.className='navbtn';
    button.type='button';
    button.innerHTML='<span>▦</span>프로그램 관리';
    side.insertBefore(label,foot||null);
    side.insertBefore(button,foot||null);
    button.addEventListener('click',openPanel);
    return button;
  }

  function makePanel(){
    if(byId(PANEL_ID))return byId(PANEL_ID);
    const content=document.querySelector('.main .content');
    if(!content)return null;
    const panel=document.createElement('section');
    panel.id=PANEL_ID;
    panel.className='panel';
    panel.innerHTML=`
      <div class="hero"><h2>핵심 프로그램 관리</h2><p>카테고리 없이 Program Studio의 핵심 편집 도구만 간단하게 관리합니다.</p></div>
      <div class="progm-actions">
        <button class="btn primary" id="progmSave" type="button">저장하고 홈에 반영</button>
        <button class="btn soft" id="progmReload" type="button">다시 불러오기</button>
        <button class="btn soft" id="progmOpenHome" type="button">홈 확인 ↗</button>
        <span class="progm-save-state" id="progmDirty">저장됨</span>
      </div>
      <div class="progm-wrap">
        <div class="progm-card"><div class="progm-head"><div><strong>프로그램</strong><div class="progm-note">드래그해서 홈 표시 순서를 변경합니다. 프로그램 추가·삭제는 하지 않고 핵심 도구만 운영합니다.</div></div></div><div id="progmList" class="progm-list"></div></div>
        <div class="progm-card"><div class="progm-head"><div><strong>선택 프로그램 설정</strong><div class="progm-note">사용자가 실제로 보는 정보와 공개 상태만 관리합니다.</div></div></div><div id="progmEditor"></div><div id="progmStatus" class="progm-status"></div></div>
      </div>`;
    content.appendChild(panel);
    return panel;
  }

  function setDirty(value=true){
    dirty=Boolean(value);
    const badge=byId('progmDirty');
    if(!badge)return;
    badge.textContent=dirty?'저장되지 않은 변경 있음':'저장됨';
    badge.classList.toggle('dirty',dirty);
  }

  function note(message,type='info'){
    const node=byId('progmStatus');
    if(!node)return;
    node.className=`progm-status ${type}`;
    node.textContent=message;
  }

  function setBusy(value){
    busy=Boolean(value);
    ['progmSave','progmReload'].forEach(id=>{const node=byId(id);if(node)node.disabled=busy;});
  }

  function renderList(){
    const list=byId('progmList');
    if(!list)return;
    list.replaceChildren();
    programs.forEach(program=>{
      const item=document.createElement('div');
      item.className=`progm-item${program.id===selectedId?' on':''}`;
      item.draggable=true;
      item.dataset.programId=program.id;
      const stateClass=!program.visible?'is-hidden':program.status==='active'?'':'coming';
      const stateText=!program.visible?'숨김':program.status==='active'?'사용 가능':'준비 중';
      item.innerHTML=`<span class="progm-drag" title="드래그해서 순서 변경">⋮⋮</span><span class="progm-icon">${esc(program.icon)}</span><span><span class="progm-name">${esc(program.name)}</span><span class="progm-meta">${esc(program.id)}</span></span><span class="progm-badge ${stateClass}">${stateText}</span>`;
      item.addEventListener('click',()=>{selectedId=program.id;renderAll();});
      item.addEventListener('dragstart',event=>{dragId=program.id;event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',program.id);});
      item.addEventListener('dragover',event=>{event.preventDefault();item.classList.add('dragover');});
      item.addEventListener('dragleave',()=>item.classList.remove('dragover'));
      item.addEventListener('drop',event=>{
        event.preventDefault();item.classList.remove('dragover');
        const fromId=event.dataTransfer.getData('text/plain')||dragId;
        if(!fromId||fromId===program.id)return;
        const from=programs.findIndex(entry=>entry.id===fromId);
        const to=programs.findIndex(entry=>entry.id===program.id);
        if(from<0||to<0)return;
        const [moved]=programs.splice(from,1);
        programs.splice(to,0,moved);
        setDirty(true);renderAll();
      });
      list.appendChild(item);
    });
  }

  function renderEditor(){
    const box=byId('progmEditor');
    const program=selected();
    if(!box||!program)return;
    box.innerHTML=`<div class="progm-form">
      <div class="progm-field"><label>프로그램명</label><input data-progm-field="name" maxlength="80" value="${esc(program.name)}"></div>
      <div class="progm-field"><label>프로그램 ID</label><div class="progm-fixed">${esc(program.id)}</div></div>
      <div class="progm-field"><label>상태</label><select data-progm-field="status"><option value="active"${program.status==='active'?' selected':''}>사용 가능</option><option value="coming"${program.status!=='active'?' selected':''}>준비 중</option></select></div>
      <div class="progm-field"><label>홈 공개</label><select data-progm-field="visible"><option value="true"${program.visible?' selected':''}>공개</option><option value="false"${!program.visible?' selected':''}>숨김</option></select></div>
      <div class="progm-field wide"><label>프로그램 주소</label><input data-progm-field="url" maxlength="300" value="${esc(program.url)}" placeholder="예: design-editor/"></div>
      <div class="progm-field wide"><label>홈 설명</label><textarea data-progm-field="desc" maxlength="500">${esc(program.desc)}</textarea></div>
    </div>`;
    box.querySelectorAll('[data-progm-field]').forEach(control=>{
      control.addEventListener('input',()=>{
        const current=selected();if(!current)return;
        const field=control.dataset.progmField;
        current[field]=field==='visible'?control.value==='true':control.value;
        setDirty(true);
        if(field==='status'||field==='visible'||field==='name')renderList();
      });
      control.addEventListener('change',()=>{
        const current=selected();if(!current)return;
        const field=control.dataset.progmField;
        current[field]=field==='visible'?control.value==='true':control.value;
        setDirty(true);renderList();
      });
    });
  }

  function renderAll(){renderList();renderEditor();}

  function openPanel(){
    hideLegacyManager();
    document.querySelectorAll('.panel').forEach(panel=>panel.classList.remove('on'));
    document.querySelectorAll('.navbtn').forEach(button=>button.classList.remove('on'));
    byId(PANEL_ID)?.classList.remove('hidden');
    byId(PANEL_ID)?.classList.add('on');
    byId(NAV_ID)?.classList.add('on');
    if(byId('pageTitle'))byId('pageTitle').textContent='프로그램 관리';
    if(byId('pageSub'))byId('pageSub').textContent='핵심 편집 도구의 공개 상태와 정보를 관리합니다.';
    renderAll();
  }

  async function load(){
    if(!window.db)return note('데이터베이스 연결을 기다리고 있습니다.','info');
    setBusy(true);note('저장된 프로그램 정보를 불러오는 중입니다.','info');
    try{
      const snapshot=await db.collection('settings').doc(DOC_ID).get();
      programs=snapshot.exists?normalize(snapshot.data()||{}):DEFAULTS.map(item=>({...item}));
      if(!programs.some(item=>item.id===selectedId))selectedId=programs[0]?.id||'';
      setDirty(false);renderAll();note(snapshot.exists?'저장된 프로그램 정보를 불러왔습니다.':'기본 프로그램 구성을 사용합니다.','ok');
    }catch(error){
      programs=DEFAULTS.map(item=>({...item}));renderAll();note('프로그램 정보를 불러오지 못해 기본 구성을 표시합니다.','err');
      console.warn('Professional program manager load failed',error);
    }finally{setBusy(false);}
  }

  async function save(){
    if(!window.db||busy)return;
    setBusy(true);note('홈에 반영할 프로그램 정보를 저장하는 중입니다.','info');
    try{
      await db.collection('settings').doc(DOC_ID).set({
        version:1,
        programs:programs.map(({id,name,desc,url,status,visible})=>({id,name,desc,url,status,visible})),
        updatedAt:new Date().toISOString()
      },{merge:true});
      setDirty(false);note('저장되었습니다. 홈페이지 새로고침 시 반영됩니다.','ok');
    }catch(error){
      note('저장하지 못했습니다. 관리자 권한과 연결 상태를 확인하세요.','err');
      console.error('Professional program manager save failed',error);
    }finally{setBusy(false);}
  }

  function bind(){
    byId('progmSave')?.addEventListener('click',save);
    byId('progmReload')?.addEventListener('click',()=>{if(dirty&&!confirm('저장하지 않은 변경을 버리고 다시 불러올까요?'))return;load();});
    byId('progmOpenHome')?.addEventListener('click',()=>window.open('index.html','_blank','noopener'));
    document.addEventListener('click',event=>{
      const button=event.target?.closest?.('.navbtn[data-tab]');
      if(!button)return;
      byId(NAV_ID)?.classList.remove('on');
      byId(PANEL_ID)?.classList.remove('on');
    },true);
  }

  function install(){
    if(installed)return true;
    if(!document.querySelector('.side')||!document.querySelector('.main .content'))return false;
    installed=true;
    installStyles();hideLegacyManager();makeNav();makePanel();bind();load();
    window.AdminProfessionalProgramManager={open:openPanel,reload:load,stage:'simplified-five-program-admin'};
    [300,900,1800].forEach(delay=>setTimeout(hideLegacyManager,delay));
    return true;
  }

  function boot(){
    if(install())return;
    [250,600,1200,2200].forEach(delay=>setTimeout(install,delay));
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
