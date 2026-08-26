(function(){
  'use strict';
  if(window.__designEditorTypographyProV1)return;
  window.__designEditorTypographyProV1=true;

  const STYLE_ID='designEditorTypographyProStyles';
  const FONT_STYLE_ID='designEditorOpenFontStylesheet';
  const PANEL_ID='designTypographyProPanel';
  const LICENSE_ID='designTypographyLicenseNote';
  const PREVIEW_ID='designTypographyFontPreview';
  const DRAFT_KEY='programTool.designEditor.draft.v1';
  const TITLE_STYLES=[
    ['none','기본'],['bar','세로 바'],['line','짧은 선'],['dot','점'],['pill','라벨'],['highlight','형광 강조'],['underline','밑줄']
  ];
  const FONT_CATALOG=[
    {family:'Pretendard',label:'Pretendard',source:'SIL OFL 1.1',group:'open'},
    {family:'Noto Sans KR',label:'Noto Sans KR',source:'Google Fonts',group:'open'},
    {family:'Noto Serif KR',label:'Noto Serif KR',source:'Google Fonts',group:'open'},
    {family:'Nanum Gothic',label:'나눔고딕',source:'Google Fonts',group:'open'},
    {family:'Nanum Myeongjo',label:'나눔명조',source:'Google Fonts',group:'open'},
    {family:'Gowun Dodum',label:'고운돋움',source:'Google Fonts',group:'open'},
    {family:'Gowun Batang',label:'고운바탕',source:'Google Fonts',group:'open'},
    {family:'Black Han Sans',label:'Black Han Sans',source:'Google Fonts',group:'open'},
    {family:'Jua',label:'주아',source:'Google Fonts',group:'open'},
    {family:'Do Hyeon',label:'도현',source:'Google Fonts',group:'open'},
    {family:'Malgun Gothic',label:'맑은 고딕 · PC 설치 글꼴',source:'system',group:'system'},
    {family:'Arial',label:'Arial · PC 설치 글꼴',source:'system',group:'system'}
  ];
  const GOOGLE_FONT_FAMILIES=[
    'Noto+Sans+KR:wght@300;400;500;600;700;800;900',
    'Noto+Serif+KR:wght@300;400;500;600;700;800;900',
    'Nanum+Gothic:wght@400;700;800',
    'Nanum+Myeongjo:wght@400;700;800',
    'Gowun+Dodum',
    'Gowun+Batang:wght@400;700',
    'Black+Han+Sans',
    'Jua',
    'Do+Hyeon'
  ];

  let installed=false;
  let syncing=false;
  let syncTimer=0;
  let saveTimer=0;

  const byId=id=>document.getElementById(id);
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const project=()=>window.DesignEditorApp?.project||null;

  function surface(){
    const p=project();
    return p?.surfaces?.find(item=>item.id===p.activeSurface)||p?.surfaces?.[0]||null;
  }

  function selectedRecord(){
    const current=surface();if(!current)return null;
    const node=document.querySelector('.design-text.selected[data-id]');if(!node)return null;
    const item=current.elements?.find(entry=>entry.id===node.dataset.id&&entry.type==='text');
    return item?{item,node}:null;
  }

  function scale(){
    const p=project(),board=byId('artboard');if(!p||!board)return 1;
    const width=board.getBoundingClientRect().width||board.offsetWidth||0;
    return Math.max(.001,width/Math.max(1,Number(p.width)+(Number(p.bleed)||0)*2));
  }

  function persist(source='typography-pro'){
    clearTimeout(saveTimer);
    saveTimer=setTimeout(()=>{
      const p=project();if(!p)return;
      try{
        if(window.DesignEditorDraftScope?.saveCurrent){window.DesignEditorDraftScope.saveCurrent(source);return;}
        localStorage.setItem(DRAFT_KEY,JSON.stringify(p));
      }catch(_){}
      const state=byId('saveState');if(state)state.textContent='자동 저장됨';
    },70);
  }

  function setStatus(message,type='ok'){
    const node=byId('editorStatus');if(!node)return;
    node.className=`editor-status ${type}`;node.textContent=message;
  }

  function installOpenFonts(){
    if(byId(FONT_STYLE_ID))return;
    const link=document.createElement('link');
    link.id=FONT_STYLE_ID;link.rel='stylesheet';
    link.href=`https://fonts.googleapis.com/css2?${GOOGLE_FONT_FAMILIES.map(family=>`family=${family}`).join('&')}&display=swap`;
    document.head.appendChild(link);
  }

  function installStyles(){
    if(byId(STYLE_ID))return;
    const style=document.createElement('style');style.id=STYLE_ID;style.textContent=`
      .typography-license-note{margin:-1px 0 8px;padding:7px 8px;border:1px solid #dce8ef;border-radius:8px;background:#f7fbfd;color:#64748b;font-size:6.8px;line-height:1.5}.typography-license-note strong{color:#0f766e}.typography-license-note a{color:#1769aa;font-weight:850;text-decoration:none}.typography-license-note a:hover{text-decoration:underline}.typography-font-preview{margin:-2px 0 8px;padding:8px;border:1px dashed #cad8e2;border-radius:8px;background:#fff;color:#334155;font-size:14px;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.typography-pro-panel{margin:8px 0 10px;padding:9px;border:1px solid #d9e5ed;border-radius:10px;background:#f8fbfd}.typography-pro-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:7px}.typography-pro-title{color:#475569;font-size:8px;font-weight:950}.typography-pro-badge{padding:2px 5px;border-radius:999px;background:#e6f7f5;color:#0f766e;font-size:6.3px;font-weight:900}.typography-pro-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}.typography-pro-field label{display:block;margin-bottom:3px;color:#64748b;font-size:6.8px;font-weight:900}.typography-pro-field input,.typography-pro-field select{width:100%;height:29px;border:1px solid #cfd9e3;border-radius:7px;background:#fff;color:#334155;padding:0 6px;font-size:8px;font-weight:800;outline:none}.typography-pro-field input:focus,.typography-pro-field select:focus{border-color:#5daec0;box-shadow:0 0 0 2px #1d9bb218}.typography-pro-full{grid-column:1/-1}.typography-pro-actions{display:flex;justify-content:flex-end;margin-top:7px}.typography-pro-reset{border:1px solid #d4dee7;border-radius:7px;background:#fff;color:#64748b;padding:6px 8px;font-size:7px;font-weight:900;cursor:pointer}.typography-pro-reset:hover{border-color:#85b9c5;background:#f0fdff}.typography-pro-help{grid-column:1/-1;color:#84909d;font-size:6.5px;line-height:1.45}.design-text{--title-accent:#1d9bb2}.design-text.typography-title-bar .design-text-inner::before{content:"";width:.14em;min-height:1.15em;border-radius:999px;background:var(--title-accent);flex:0 0 .14em;margin-right:.14em}.design-text.typography-title-line .design-text-inner::before{content:"";width:.9em;height:.09em;border-radius:999px;background:var(--title-accent);flex:0 0 .9em;margin-top:.55em;margin-right:.08em}.design-text.typography-title-dot .design-text-inner::before{content:"";width:.28em;height:.28em;border-radius:50%;background:var(--title-accent);flex:0 0 .28em;margin-top:.43em;margin-right:.06em}.design-text.typography-title-pill .design-text-inner{padding:.2em .42em;border:1px solid color-mix(in srgb,var(--title-accent) 42%,white);border-radius:999px;background:color-mix(in srgb,var(--title-accent) 10%,white)}.design-text.typography-title-highlight .editable-text{background:linear-gradient(transparent 58%,color-mix(in srgb,var(--title-accent) 24%,transparent) 58%);padding:0 .05em}.design-text.typography-title-underline .design-text-inner{padding-bottom:.13em;border-bottom:.1em solid var(--title-accent)}
    `;document.head.appendChild(style);
  }

  function ensureFontOptions(item){
    const select=byId('fontInput');if(!select)return;
    const current=String(item.fontFamily||select.value||'Pretendard');
    if(select.dataset.typographyFonts!=='1'){
      const open=FONT_CATALOG.filter(font=>font.group==='open').map(font=>`<option value="${esc(font.family)}">${esc(font.label)} · ${esc(font.source)}</option>`).join('');
      const system=FONT_CATALOG.filter(font=>font.group==='system').map(font=>`<option value="${esc(font.family)}">${esc(font.label)}</option>`).join('');
      select.innerHTML=`<optgroup label="무료 · 상업적 사용 허용 오픈소스">${open}</optgroup><optgroup label="PC 설치 글꼴">${system}</optgroup>`;
      select.dataset.typographyFonts='1';
      select.addEventListener('change',()=>{
        const record=selectedRecord();if(!record)return;
        record.item.fontFamily=select.value;persist('typography-font');applyPreview();
        queueAutoFit();updateFontPreview(record.item);
      });
    }
    if(![...select.options].some(option=>option.value===current)){
      const option=document.createElement('option');option.value=current;option.textContent=`${current} · 기존 프로젝트 글꼴`;select.appendChild(option);
    }
    select.value=current;

    const field=select.closest('.field');if(field&&!byId(LICENSE_ID)){
      const note=document.createElement('div');note.id=LICENSE_ID;note.className='typography-license-note';
      note.innerHTML='<strong>무료·상업용 허용 폰트</strong>는 오픈소스 라이선스가 확인된 목록입니다. 폰트 자체의 사용 조건이며, 사진·로고·외부 이미지의 권리는 별도입니다. <a href="https://fonts.google.com/knowledge/glossary/licensing" target="_blank" rel="noopener noreferrer">라이선스 안내</a>';
      field.insertAdjacentElement('afterend',note);
      const preview=document.createElement('div');preview.id=PREVIEW_ID;preview.className='typography-font-preview';preview.textContent='가나다라마바사 ABC abc 123';note.insertAdjacentElement('afterend',preview);
    }
    updateFontPreview(item);
  }

  function enhanceBaseControls(item){
    const size=byId('sizeInput');if(size){size.step='0.5';size.title='0.5pt 단위로 세밀하게 조절할 수 있습니다.';}
    const weight=byId('weightInput');
    if(weight&&!weight.querySelector('option[value="300"]')){
      const option=document.createElement('option');option.value='300';option.textContent='가늘게';weight.insertBefore(option,weight.firstChild);
      weight.addEventListener('change',()=>{const record=selectedRecord();if(!record)return;record.item.weight=Number(weight.value)||400;persist('typography-weight');applyPreview();queueAutoFit();});
    }
  }

  function updateFontPreview(item){
    const node=byId(PREVIEW_ID);if(!node)return;
    node.style.fontFamily=`"${String(item.fontFamily||'Pretendard').replace(/"/g,'')}",Pretendard,Arial,sans-serif`;
    node.style.fontWeight=String(item.weight||400);
  }

  function titleOptions(value){
    return TITLE_STYLES.map(([key,label])=>`<option value="${key}"${key===value?' selected':''}>${label}</option>`).join('');
  }

  function installPanel(record){
    const root=byId('inspector');if(!root)return;
    let panel=byId(PANEL_ID);
    if(panel&&panel.dataset.itemId!==record.item.id){panel.remove();panel=null;}
    if(panel)return syncPanel(record.item,panel);

    const item=record.item,p=project();
    panel=document.createElement('div');panel.id=PANEL_ID;panel.dataset.itemId=item.id;panel.className='typography-pro-panel';
    panel.innerHTML=`
      <div class="typography-pro-head"><span class="typography-pro-title">정밀 타이포그래피</span><span class="typography-pro-badge">출력 반영</span></div>
      <div class="typography-pro-grid">
        <div class="typography-pro-field"><label>자간 mm</label><input id="typographyLetterSpacing" type="number" min="-3" max="10" step="0.1" value="${Number(item.letterSpacing)||0}"></div>
        <div class="typography-pro-field"><label>행간 배수</label><input id="typographyLineHeight" type="number" min="0.8" max="3" step="0.05" value="${Number(item.lineHeight)||1.26}"></div>
        <div class="typography-pro-field"><label>X 위치 mm</label><input id="typographyX" type="number" min="0" max="${Number(p?.width)||210}" step="0.1" value="${Number(item.x)||0}"></div>
        <div class="typography-pro-field"><label>Y 위치 mm</label><input id="typographyY" type="number" min="0" max="${Number(p?.height)||297}" step="0.1" value="${Number(item.y)||0}"></div>
        <div class="typography-pro-field"><label>제목 포인트</label><select id="typographyTitleStyle">${titleOptions(item.titleStyle||'none')}</select></div>
        <div class="typography-pro-field"><label>포인트 색상</label><input id="typographyTitleAccent" type="color" value="${esc(item.titleAccent||'#1d9bb2')}"></div>
        <div class="typography-pro-help">자간·행간·위치·제목 포인트는 화면 미리보기뿐 아니라 고해상도 출력에도 같은 값으로 반영됩니다. 글상자 폭은 위의 자동 맞춤 또는 직접 폭 설정과 함께 사용할 수 있습니다.</div>
      </div>
      <div class="typography-pro-actions"><button id="typographyReset" class="typography-pro-reset" type="button">세부 글자값 초기화</button></div>`;
    const widthField=byId('widthInput')?.closest('.field-grid')||byId('widthInput')?.closest('.field');
    if(widthField)widthField.insertAdjacentElement('afterend',panel);else root.appendChild(panel);

    byId('typographyLetterSpacing')?.addEventListener('input',event=>{
      const active=selectedRecord();if(!active)return;active.item.letterSpacing=clamp(Number(event.target.value)||0,-3,10);persist('typography-letter-spacing');applyPreview();queueAutoFit();
    });
    byId('typographyLineHeight')?.addEventListener('input',event=>{
      const active=selectedRecord();if(!active)return;active.item.lineHeight=clamp(Number(event.target.value)||1.26,.8,3);persist('typography-line-height');applyPreview();
    });
    byId('typographyX')?.addEventListener('input',event=>{
      const active=selectedRecord(),activeProject=project();if(!active||!activeProject)return;
      active.item.x=clamp(Number(event.target.value)||0,0,Math.max(0,Number(activeProject.width)-Number(active.item.w||0)));persist('typography-position-x');applyPreview();
    });
    byId('typographyY')?.addEventListener('input',event=>{
      const active=selectedRecord(),activeProject=project();if(!active||!activeProject)return;
      active.item.y=clamp(Number(event.target.value)||0,0,Math.max(0,Number(activeProject.height)-8));persist('typography-position-y');applyPreview();
    });
    byId('typographyTitleStyle')?.addEventListener('change',event=>{
      const active=selectedRecord();if(!active)return;active.item.titleStyle=event.target.value;active.item.titleAccent=active.item.titleAccent||'#1d9bb2';persist('typography-title-style');applyPreview();window.DesignEditorQuickDesign?.sync?.();
    });
    byId('typographyTitleAccent')?.addEventListener('input',event=>{
      const active=selectedRecord();if(!active)return;active.item.titleAccent=event.target.value;persist('typography-title-accent');applyPreview();window.DesignEditorQuickDesign?.sync?.();
    });
    byId('typographyReset')?.addEventListener('click',()=>{
      const active=selectedRecord();if(!active)return;
      active.item.letterSpacing=0;active.item.lineHeight=1.26;active.item.titleStyle='none';active.item.titleAccent='#1d9bb2';
      persist('typography-reset');applyPreview();syncPanel(active.item,panel);queueAutoFit();window.DesignEditorQuickDesign?.sync?.();setStatus('자간·행간·제목 포인트를 기본값으로 되돌렸습니다.');
    });
  }

  function syncPanel(item,panel){
    if(!panel)return;
    const values={typographyLetterSpacing:Number(item.letterSpacing)||0,typographyLineHeight:Number(item.lineHeight)||1.26,typographyX:Number(item.x)||0,typographyY:Number(item.y)||0,typographyTitleStyle:item.titleStyle||'none',typographyTitleAccent:item.titleAccent||'#1d9bb2'};
    Object.entries(values).forEach(([id,value])=>{const control=byId(id);if(control&&document.activeElement!==control)control.value=String(value);});
  }

  function clearTitleClasses(node){
    TITLE_STYLES.forEach(([key])=>{if(key!=='none')node.classList.remove(`typography-title-${key}`);});
  }

  function applyPreview(){
    const current=surface(),p=project();if(!current||!p)return;
    const px=scale();
    document.querySelectorAll('.design-text[data-id]').forEach(node=>{
      const item=current.elements?.find(entry=>entry.id===node.dataset.id&&entry.type==='text');if(!item)return;
      const editable=node.querySelector('.editable-text');
      node.style.lineHeight=String(clamp(Number(item.lineHeight)||1.26,.8,3));
      if(editable)editable.style.letterSpacing=`${(Number(item.letterSpacing)||0)*px}px`;
      node.style.left=`${(Number(item.x)||0)*px}px`;
      node.style.top=`${(Number(item.y)||0)*px}px`;
      clearTitleClasses(node);
      const style=TITLE_STYLES.some(([key])=>key===item.titleStyle)?item.titleStyle:'none';
      if(style!=='none')node.classList.add(`typography-title-${style}`);
      node.style.setProperty('--title-accent',item.titleAccent||'#1d9bb2');
    });
    const selected=selectedRecord();if(selected)updateFontPreview(selected.item);
  }

  function queueAutoFit(){
    const run=()=>{try{window.DesignEditorTextAutoFit?.sync?.();}catch(_){}queueSync();};
    requestAnimationFrame(run);setTimeout(run,90);
    if(document.fonts?.ready)Promise.resolve(document.fonts.ready).then(()=>setTimeout(run,20)).catch(()=>{});
  }

  function sync(){
    if(syncing)return;
    const root=byId('inspector'),p=project();if(!root||!p)return;
    syncing=true;
    try{
      installOpenFonts();installStyles();
      const record=selectedRecord();
      if(!record){byId(PANEL_ID)?.remove();byId(LICENSE_ID)?.remove();byId(PREVIEW_ID)?.remove();applyPreview();return;}
      ensureFontOptions(record.item);enhanceBaseControls(record.item);installPanel(record);applyPreview();
    }finally{syncing=false;}
  }

  function queueSync(){clearTimeout(syncTimer);syncTimer=setTimeout(()=>requestAnimationFrame(sync),28);}

  function bindEvents(){
    ['click','dblclick','change','input','keyup','pointerup'].forEach(name=>document.addEventListener(name,event=>{
      if(event.target?.closest?.(`#${PANEL_ID}`))return;queueSync();
    },false));
    window.addEventListener('resize',queueSync,{passive:true});
    const inspector=byId('inspector');if(inspector)new MutationObserver(queueSync).observe(inspector,{childList:true,subtree:true});
    const artboard=byId('artboard');if(artboard)new MutationObserver(queueSync).observe(artboard,{childList:true,subtree:true});
  }

  function install(){
    if(installed)return true;
    if(!byId('inspector')||!byId('artboard')||!window.DesignEditorApp)return false;
    installed=true;installOpenFonts();installStyles();bindEvents();
    window.DesignEditorTypographyPro={
      sync,fonts:FONT_CATALOG.filter(font=>font.group==='open').map(font=>({family:font.family,label:font.label,license:font.source})),
      stage:'open-source-korean-fonts-and-print-safe-detailed-typography'
    };
    [0,120,350,700,1300,2200].forEach(delay=>setTimeout(queueSync,delay));return true;
  }

  function boot(){if(install())return;[120,280,600,1000,1700,2800].forEach(delay=>setTimeout(install,delay));}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();