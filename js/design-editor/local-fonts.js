(function(){
  'use strict';
  if(window.__designEditorLocalFontsV1)return;
  window.__designEditorLocalFontsV1=true;
  const path=location.pathname.replace(/\/+$/,'')||'/';
  if(path!=='/design-editor/general'&&path!=='/design-editor/general.html'&&!path.endsWith('/design-editor/general.html'))return;

  const STYLE_ID='designEditorLocalFontStyles';
  const PANEL_ID='designLocalFontPanel';
  const DRAFT_KEY='programTool.designEditor.draft.v1';
  const OUTPUT_IDS=new Set(['designPngBtn','designPdfBtn','designPressPdfBtn']);
  const loadedAliases=new Set();
  let installed=false;
  let syncTimer=0;
  let saveTimer=0;
  let fontRecords=[];
  let selectedPostscript='';
  let loading=false;
  let suppressFreeChange=false;

  const byId=id=>document.getElementById(id);
  const project=()=>window.DesignEditorApp?.project||null;
  const surface=()=>{const p=project();return p?.surfaces?.find(item=>item.id===p.activeSurface)||p?.surfaces?.[0]||null;};
  const selectedText=()=>{const node=document.querySelector('.design-text.selected[data-id]');if(!node)return null;return surface()?.elements?.find(item=>item.id===node.dataset.id&&item.type==='text')||null;};
  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

  function setStatus(message,type='info'){
    const node=byId('editorStatus');if(!node)return;
    node.className=`editor-status ${type}`;node.textContent=message;
  }

  function persist(source='local-font'){
    clearTimeout(saveTimer);
    saveTimer=setTimeout(()=>{
      const p=project();if(!p)return;
      try{
        if(window.DesignEditorDraftScope?.saveCurrent){window.DesignEditorDraftScope.saveCurrent(source);return;}
        localStorage.setItem(DRAFT_KEY,JSON.stringify(p));
      }catch(_){}
      const state=byId('saveState');if(state)state.textContent='자동 저장됨';
    },60);
  }

  function hash(value){
    let h=2166136261;
    for(const ch of String(value||'')){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}
    return (h>>>0).toString(36);
  }

  function recordKey(record){return String(record?.postscriptName||record?.fullName||record?.family||'').trim();}
  function aliasFor(record){return `PSLocal_${hash(recordKey(record))}`;}
  function itemLabel(item){return String(item?.localFontFullName||item?.localFontFamily||item?.fontFamily||'PC 글꼴');}

  function isLoaded(item){
    if(!item||item.localFontSource!=='local')return true;
    const alias=String(item.localFontRuntimeFamily||item.fontFamily||'');
    return Boolean(alias&&loadedAliases.has(alias));
  }

  function localFontItems(){
    const p=project();if(!p)return[];
    const items=[];
    for(const s of p.surfaces||[]){
      for(const item of s.elements||[]){
        if(item?.type==='text'&&item.localFontSource==='local')items.push(item);
      }
    }
    return items;
  }

  function missingLocalFonts(){return localFontItems().filter(item=>!isLoaded(item));}

  function installStyles(){
    if(byId(STYLE_ID))return;
    const style=document.createElement('style');style.id=STYLE_ID;style.textContent=`
      .local-font-panel{margin-top:6px;border:1px solid #dce6ee;border-radius:9px;background:#f8fbfd;padding:7px}.local-font-tabs{display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-bottom:6px}.local-font-tab{border:1px solid #d4dee7;border-radius:7px;background:#fff;color:#64748b;padding:6px 4px;font-size:7px;font-weight:950;cursor:pointer}.local-font-tab.on{border-color:#1d9bb2;background:#ecfeff;color:#0e7490}.local-font-tools{display:grid;gap:5px}.local-font-tools.hidden{display:none!important}.local-font-load{border:1px solid #a8cbd4;border-radius:7px;background:#f0fdff;color:#0e7490;padding:7px;font-size:7.5px;font-weight:950;cursor:pointer}.local-font-load:disabled{opacity:.55;cursor:not-allowed}.local-font-search,.local-font-select{width:100%;height:29px;border:1px solid #cfd9e3;border-radius:7px;background:#fff;color:#334155;padding:0 7px;font-size:8px}.local-font-note{font-size:6.4px;line-height:1.45;color:#7d8997}.local-font-note.warn{color:#b54708;font-weight:850}.local-font-note.ok{color:#067647;font-weight:850}.local-font-project-warning{margin-top:5px;border-radius:7px;background:#fff7ed;color:#9a3412;padding:6px;font-size:6.5px;line-height:1.45;font-weight:850}
    `;document.head.appendChild(style);
  }

  function switchTab(panel,tab){
    const free=tab==='free';
    panel.dataset.tab=free?'free':'local';
    panel.querySelectorAll('[data-local-font-tab]').forEach(button=>button.classList.toggle('on',button.dataset.localFontTab===panel.dataset.tab));
    const select=byId('fontInput');if(select)select.style.display=free?'':'none';
    panel.querySelector('.local-font-tools')?.classList.toggle('hidden',free);
  }

  function renderLocalOptions(){
    const panel=byId(PANEL_ID),select=panel?.querySelector('#designLocalFontSelect'),search=panel?.querySelector('#designLocalFontSearch');if(!select)return;
    const q=String(search?.value||'').trim().toLocaleLowerCase();
    const filtered=fontRecords.filter(record=>{
      const hay=[record.family,record.fullName,record.postscriptName,record.style].join(' ').toLocaleLowerCase();
      return !q||hay.includes(q);
    }).slice(0,1200);
    select.innerHTML='<option value="">PC 글꼴을 선택하세요</option>'+filtered.map(record=>{
      const key=recordKey(record),label=record.fullName||record.family||key,sub=record.family&&record.family!==label?` · ${record.family}`:'';
      return `<option value="${esc(key)}"${key===selectedPostscript?' selected':''}>${esc(label+sub)}</option>`;
    }).join('');
    select.disabled=!fontRecords.length;
    const count=panel.querySelector('#designLocalFontCount');
    if(count)count.textContent=fontRecords.length?`${filtered.length.toLocaleString()} / ${fontRecords.length.toLocaleString()}개 표시`:'아직 PC 글꼴을 불러오지 않았습니다.';
  }

  function runtimeOption(select,item){
    if(!select||!item)return;
    const alias=String(item.fontFamily||'');if(!alias)return;
    let option=[...select.options].find(entry=>entry.value===alias);
    if(!option){option=document.createElement('option');option.value=alias;select.appendChild(option);}
    option.textContent=`${itemLabel(item)} · 내 PC 글꼴`;
    select.value=alias;
  }

  function updatePanelState(item){
    const panel=byId(PANEL_ID);if(!panel)return;
    const local=Boolean(item?.localFontSource==='local');
    if(local){
      selectedPostscript=String(item.localFontPostscriptName||'');
      switchTab(panel,'local');runtimeOption(byId('fontInput'),item);
    }else switchTab(panel,panel.dataset.tab==='local'?'local':'free');
    const state=panel.querySelector('#designLocalFontState');
    if(state){
      if(!local){state.className='local-font-note';state.textContent='PC 글꼴은 사용자가 직접 권한을 허용한 경우에만 이 브라우저에서 읽습니다.';}
      else if(isLoaded(item)){state.className='local-font-note ok';state.textContent=`연결됨 · ${itemLabel(item)}`;}
      else{state.className='local-font-note warn';state.textContent=`${itemLabel(item)}이 현재 연결되지 않았습니다. “내 PC 글꼴 불러오기”를 눌러 다시 연결하세요.`;}
    }
    let warning=panel.querySelector('.local-font-project-warning');
    const missing=missingLocalFonts();
    if(missing.length){
      if(!warning){warning=document.createElement('div');warning.className='local-font-project-warning';panel.appendChild(warning);}
      const names=[...new Set(missing.map(itemLabel))].slice(0,3);
      warning.textContent=`출력 전 PC 글꼴 연결 필요: ${names.join(', ')}${missing.length>3?' 외':''}`;
    }else warning?.remove();
  }

  async function loadFontFace(record,alias){
    if(loadedAliases.has(alias))return alias;
    const blob=await record.blob();
    if(!(blob instanceof Blob))throw new Error('PC 글꼴 데이터를 읽지 못했습니다.');
    const buffer=await blob.arrayBuffer();
    const face=new FontFace(alias,buffer);
    const loaded=await face.load();
    if(!loaded)throw new Error('PC 글꼴을 브라우저에 로드하지 못했습니다.');
    document.fonts?.add?.(loaded);
    loadedAliases.add(alias);
    return alias;
  }

  async function applyRecord(record,item=selectedText()){
    if(!record||!item)return false;
    const alias=aliasFor(record);
    await loadFontFace(record,alias);
    item.fontFamily=alias;
    item.localFontSource='local';
    item.localFontPostscriptName=recordKey(record);
    item.localFontFullName=String(record.fullName||record.family||recordKey(record));
    item.localFontFamily=String(record.family||record.fullName||recordKey(record));
    item.localFontStyle=String(record.style||'');
    item.localFontRuntimeFamily=alias;
    selectedPostscript=item.localFontPostscriptName;
    const select=byId('fontInput');runtimeOption(select,item);
    suppressFreeChange=true;
    try{select?.dispatchEvent(new Event('change',{bubbles:true}));}finally{suppressFreeChange=false;}
    persist('local-font-apply');
    window.DesignEditorTypographyPro?.sync?.();window.DesignEditorTextAutoFit?.sync?.();
    setTimeout(()=>{window.DesignEditorTypographyPro?.sync?.();updatePanelState(item);},40);
    setStatus(`${item.localFontFullName} PC 글꼴을 적용했습니다. 이 글꼴의 인쇄·상업적 이용 권한은 사용자 라이선스를 확인하세요.`,'ok');
    return true;
  }

  async function reconnectProjectFonts(){
    const items=localFontItems();if(!items.length)return{loaded:0,missing:[]};
    const byKey=new Map(fontRecords.map(record=>[recordKey(record),record]));
    let loaded=0;const missing=[];
    for(const item of items){
      const record=byKey.get(String(item.localFontPostscriptName||''));
      if(!record){missing.push(item);continue;}
      try{
        const alias=aliasFor(record);await loadFontFace(record,alias);
        item.fontFamily=alias;item.localFontRuntimeFamily=alias;loaded+=1;
      }catch(_){missing.push(item);}
    }
    if(loaded){persist('local-font-reconnect');window.DesignEditorTypographyPro?.sync?.();window.DesignEditorTextAutoFit?.sync?.();}
    return{loaded,missing};
  }

  async function queryFonts(){
    const panel=byId(PANEL_ID),button=panel?.querySelector('#designLocalFontLoad');if(loading)return;
    if(typeof window.queryLocalFonts!=='function'){
      setStatus('이 브라우저는 PC 글꼴 목록 접근을 지원하지 않습니다. 데스크톱 Chrome/Edge에서 무료 폰트를 사용하거나 PC 글꼴 기능을 이용하세요.','err');return;
    }
    loading=true;if(button){button.disabled=true;button.textContent='PC 글꼴 읽는 중…';}
    try{
      const records=await window.queryLocalFonts();
      const seen=new Set();
      fontRecords=[...records].filter(record=>{const key=recordKey(record);if(!key||seen.has(key))return false;seen.add(key);return true;}).sort((a,b)=>String(a.family||a.fullName||'').localeCompare(String(b.family||b.fullName||''),'ko'));
      renderLocalOptions();
      const reconnected=await reconnectProjectFonts();
      updatePanelState(selectedText());
      setStatus(`PC 글꼴 ${fontRecords.length.toLocaleString()}개를 불러왔습니다.${reconnected.loaded?` 기존 작업 글꼴 ${reconnected.loaded}개를 다시 연결했습니다.`:''}`,'ok');
    }catch(error){
      const denied=error?.name==='NotAllowedError'||error?.name==='SecurityError';
      setStatus(denied?'PC 글꼴 접근 권한이 허용되지 않았습니다. 브라우저 권한을 허용하면 다시 사용할 수 있습니다.':(error?.message||'PC 글꼴을 불러오지 못했습니다.'),'err');
    }finally{loading=false;if(button){button.disabled=false;button.textContent='내 PC 글꼴 불러오기';}}
  }

  function installPanel(item){
    const select=byId('fontInput'),field=select?.closest('.field');if(!select||!field)return false;
    let panel=byId(PANEL_ID);
    if(!panel){
      panel=document.createElement('div');panel.id=PANEL_ID;panel.className='local-font-panel';panel.dataset.tab='free';
      panel.innerHTML=`<div class="local-font-tabs"><button type="button" class="local-font-tab on" data-local-font-tab="free">무료 폰트</button><button type="button" class="local-font-tab" data-local-font-tab="local">내 PC 폰트</button></div><div class="local-font-tools hidden"><button id="designLocalFontLoad" class="local-font-load" type="button">내 PC 글꼴 불러오기</button><input id="designLocalFontSearch" class="local-font-search" type="search" placeholder="폰트 이름 검색" autocomplete="off"><select id="designLocalFontSelect" class="local-font-select" disabled><option value="">PC 글꼴을 선택하세요</option></select><div id="designLocalFontCount" class="local-font-note">아직 PC 글꼴을 불러오지 않았습니다.</div><div id="designLocalFontState" class="local-font-note">PC 글꼴은 사용자가 직접 권한을 허용한 경우에만 이 브라우저에서 읽습니다.</div><div class="local-font-note">PC에 설치된 글꼴이라는 사실만으로 상업적 이용이 허용되는 것은 아닙니다. 인쇄·상업용 사용 전 해당 글꼴 라이선스를 확인하세요. 글꼴 파일은 서버나 Firebase로 업로드하지 않습니다.</div></div>`;
      select.insertAdjacentElement('afterend',panel);
      panel.querySelectorAll('[data-local-font-tab]').forEach(button=>button.addEventListener('click',()=>switchTab(panel,button.dataset.localFontTab)));
      panel.querySelector('#designLocalFontLoad')?.addEventListener('click',queryFonts);
      panel.querySelector('#designLocalFontSearch')?.addEventListener('input',renderLocalOptions);
      panel.querySelector('#designLocalFontSelect')?.addEventListener('change',async event=>{
        const key=String(event.target.value||'');if(!key)return;
        const record=fontRecords.find(entry=>recordKey(entry)===key);if(!record)return;
        try{await applyRecord(record);}catch(error){setStatus(error?.message||'PC 글꼴을 적용하지 못했습니다.','err');}
      });
      select.addEventListener('change',()=>{
        if(suppressFreeChange)return;
        const current=selectedText();if(!current)return;
        const alias=String(current.localFontRuntimeFamily||'');
        if(current.localFontSource==='local'&&select.value!==alias){
          delete current.localFontSource;delete current.localFontPostscriptName;delete current.localFontFullName;delete current.localFontFamily;delete current.localFontStyle;delete current.localFontRuntimeFamily;
          selectedPostscript='';persist('local-font-clear');setTimeout(()=>updatePanelState(current),20);
        }
      });
    }
    updatePanelState(item);return true;
  }

  function guardOutput(event){
    const target=event.target?.closest?.('button');if(!target||!OUTPUT_IDS.has(target.id))return;
    const missing=missingLocalFonts();if(!missing.length)return;
    event.preventDefault();event.stopImmediatePropagation();
    const names=[...new Set(missing.map(itemLabel))].slice(0,3);
    setStatus(`출력을 중단했습니다. PC 글꼴을 먼저 다시 연결하세요: ${names.join(', ')}${missing.length>3?' 외':''}`,'err');
    const panel=byId(PANEL_ID);if(panel)switchTab(panel,'local');
  }

  function sync(){const item=selectedText();if(!item){byId(PANEL_ID)?.remove();return;}installPanel(item);}
  function queueSync(){clearTimeout(syncTimer);syncTimer=setTimeout(()=>requestAnimationFrame(sync),35);}
  function bindEvents(){
    ['click','dblclick','change','input','keyup','pointerup'].forEach(name=>document.addEventListener(name,event=>{if(event.target?.closest?.(`#${PANEL_ID}`))return;queueSync();},false));
    document.addEventListener('click',guardOutput,true);
    const inspector=byId('inspector');if(inspector)new MutationObserver(queueSync).observe(inspector,{childList:true,subtree:true});
  }

  function install(){
    if(installed)return true;if(!byId('inspector')||!byId('artboard')||!window.DesignEditorApp)return false;
    installed=true;installStyles();bindEvents();
    window.DesignEditorLocalFonts={
      supported:typeof window.queryLocalFonts==='function',queryFonts,applyRecord,reconnectProjectFonts,missingLocalFonts,isLoaded,aliasFor,
      stage:'permission-gated-local-font-access-with-print-fallback-guard'
    };
    [80,180,420,800,1400,2400].forEach(delay=>setTimeout(queueSync,delay));return true;
  }
  function boot(){if(install())return;[120,300,650,1100,1800,3000].forEach(delay=>setTimeout(install,delay));}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();