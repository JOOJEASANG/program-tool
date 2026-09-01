(function(){
  'use strict';
  if(window.__designEditorAppV1)return;
  window.__designEditorAppV1=true;

  const Presets=window.DesignEditorPresets;
  if(!Presets)return;

  const DRAFT_KEY='programTool.designEditor.draft.v1';
  const CSS_PX_PER_MM=96/25.4;
  const MIN_ZOOM_PERCENT=10;
  const MAX_ZOOM_PERCENT=400;
  const ZOOM_STEPS=[10,25,33,50,67,75,100,125,150,200,300,400];
  const ICONS={
    none:'',
    calendar:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 2v3M18 2v3M3.5 8h17M5 4h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"/></svg>',
    pin:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22s7-6.2 7-13a7 7 0 1 0-14 0c0 6.8 7 13 7 13Z"/><circle cx="12" cy="9" r="2.5"/></svg>',
    clock:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    people:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2"/><path d="M3.5 20c.5-4 2.3-6 5.5-6s5 2 5.5 6M14 15c3.3-.5 5.4 1.2 6 4"/></svg>',
    phone:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.8 3.5 4.6 5.7c-.7.7-.5 2.5.5 4.5 1.8 3.6 5.1 6.9 8.7 8.7 2 1 3.8 1.2 4.5.5l2.2-2.2-4.7-3-1.5 1.5c-2.5-1.2-4.8-3.5-6-6l1.5-1.5-3-4.7Z"/></svg>',
    check:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16.5 9"/></svg>'
  };
  const ICON_LABELS={none:'없음',calendar:'날짜',pin:'장소',clock:'시간',people:'대상',phone:'전화',check:'체크'};

  let project=null;
  let selectedId='';
  let editingId='';
  let drag=null;
  let ppm=1;
  let viewportMode='fit';
  let manualPpm=CSS_PX_PER_MM;
  let lastViewportSignal='';
  let saveTimer=0;

  const $=id=>document.getElementById(id);
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const esc=value=>String(value==null?'':value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const uid=()=>`design_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,7)}`;
  const activeSurface=()=>project?.surfaces?.find(surface=>surface.id===project.activeSurface)||project?.surfaces?.[0]||null;
  const selectedElement=()=>activeSurface()?.elements.find(item=>item.id===selectedId)||null;

  function setStatus(message,type='info'){
    const node=$('editorStatus');
    if(!node)return;
    node.className=`editor-status ${type}`;
    node.textContent=message;
  }

  function scheduleSave(){
    clearTimeout(saveTimer);
    const state=$('saveState');
    if(state)state.textContent='저장 중…';
    saveTimer=setTimeout(()=>{
      try{
        if(project)localStorage.setItem(DRAFT_KEY,JSON.stringify(project));
        if(state)state.textContent='자동 저장됨';
      }catch(_){
        if(state)state.textContent='현재 작업';
      }
    },180);
  }

  function loadDraft(){
    try{
      const raw=JSON.parse(localStorage.getItem(DRAFT_KEY)||'null');
      if(!raw?.presetId||!Array.isArray(raw.surfaces))return null;
      return raw;
    }catch(_){return null;}
  }

  function createProject(preset){
    return {
      version:1,
      presetId:preset.id,
      name:preset.name,
      width:Number(preset.width),
      height:Number(preset.height),
      bleed:Number(preset.bleed),
      safe:Number(preset.safe),
      showGuides:true,
      showFolds:true,
      activeSurface:preset.surfaces[0].id,
      surfaces:preset.surfaces.map(surface=>({
        id:surface.id,
        label:surface.label,
        folds:[...(surface.folds||[])],
        panels:[...(surface.panels||[])],
        background:'#ffffff',
        elements:[]
      }))
    };
  }

  function rolePreset(role){return Presets.ROLE_PRESETS[role]||Presets.ROLE_PRESETS.body;}

  function makeText(role='body',x=null,y=null,text=''){
    const preset=rolePreset(role);
    const width=role==='title'?Math.max(60,project.width-project.safe*2):Math.min(Math.max(70,project.width*.62),project.width-project.safe*2);
    const left=x==null?(project.width-width)/2:clamp(x,0,project.width-width);
    const top=y==null?project.height*.18:clamp(y,0,project.height-12);
    return {
      id:uid(),type:'text',role,text:text||preset.label,fontFamily:'Pretendard',size:preset.size,weight:preset.weight,align:preset.align,color:preset.color,
      icon:'none',x:left,y:top,w:width,locked:false,visible:true
    };
  }

  function addText(role='body',point=null,text=''){
    if(!project)return;
    const surface=activeSurface();
    const entry=makeText(role,point?.x,point?.y,text);
    surface.elements.push(entry);
    selectedId=entry.id;
    editingId='';
    renderArtboard();renderInspector();renderLayers();scheduleSave();
  }

  function duplicateSelected(){
    const entry=selectedElement();
    if(!entry)return;
    const copy={...entry,id:uid(),x:clamp(entry.x+4,0,project.width-entry.w),y:clamp(entry.y+4,0,project.height-8),locked:false};
    activeSurface().elements.push(copy);
    selectedId=copy.id;editingId='';renderAll();scheduleSave();
  }

  function deleteSelected(){
    const surface=activeSurface();
    if(!surface||!selectedId)return;
    const index=surface.elements.findIndex(item=>item.id===selectedId);
    if(index<0)return;
    surface.elements.splice(index,1);selectedId='';editingId='';renderAll();scheduleSave();
  }

  function moveLayer(direction){
    const surface=activeSurface();
    const index=surface?.elements.findIndex(item=>item.id===selectedId)??-1;
    if(index<0)return;
    const to=direction==='front'?Math.min(surface.elements.length-1,index+1):Math.max(0,index-1);
    if(to===index)return;
    const [entry]=surface.elements.splice(index,1);surface.elements.splice(to,0,entry);renderArtboard();renderLayers();scheduleSave();
  }

  function updateProjectMeta(){
    if(!project)return;
    const title=$('documentTitle');
    const meta=$('documentMeta');
    if(title)title.textContent=project.name;
    if(meta)meta.textContent=`${project.width} × ${project.height}mm · 재단 ${project.bleed}mm`;
  }

  function renderSurfaceTabs(){
    const root=$('surfaceTabs');
    if(!root||!project)return;
    root.replaceChildren();
    project.surfaces.forEach(surface=>{
      const button=document.createElement('button');
      button.type='button';button.className=`surface-tab${surface.id===project.activeSurface?' on':''}`;button.textContent=surface.label;
      button.addEventListener('click',()=>{project.activeSurface=surface.id;selectedId='';editingId='';renderAll();scheduleSave();});
      root.appendChild(button);
    });
  }

  function fitScale(){
    if(!project)return 1;
    const viewport=$('artboardViewport');
    if(!viewport)return 1;
    const totalW=project.width+project.bleed*2;
    const totalH=project.height+project.bleed*2;
    const availableW=Math.max(180,viewport.clientWidth-72);
    const availableH=Math.max(220,viewport.clientHeight-72);
    return clamp(Math.min(availableW/totalW,availableH/totalH),.35,4.2);
  }

  function viewportState(){
    const percent=Math.max(1,Math.round((ppm/CSS_PX_PER_MM)*100));
    return {mode:viewportMode,percent,ppm,min:MIN_ZOOM_PERCENT,max:MAX_ZOOM_PERCENT,cssPxPerMm:CSS_PX_PER_MM};
  }

  function emitViewportState(){
    const state=viewportState();
    const signature=`${state.mode}:${state.percent}:${state.ppm.toFixed(4)}`;
    if(signature===lastViewportSignal)return state;
    lastViewportSignal=signature;
    document.documentElement.dataset.designCanvasZoomMode=state.mode;
    document.documentElement.dataset.designCanvasZoomPercent=String(state.percent);
    window.dispatchEvent(new CustomEvent('designeditor:viewport-change',{detail:state}));
    return state;
  }

  function fitArtboard(){
    if(!project)return;
    const artboard=$('artboard');
    if(!artboard)return;
    const totalW=project.width+project.bleed*2;
    const totalH=project.height+project.bleed*2;
    const minPpm=CSS_PX_PER_MM*(MIN_ZOOM_PERCENT/100);
    const maxPpm=CSS_PX_PER_MM*(MAX_ZOOM_PERCENT/100);
    ppm=viewportMode==='manual'?clamp(manualPpm,minPpm,maxPpm):fitScale();
    artboard.style.width=`${totalW*ppm}px`;
    artboard.style.height=`${totalH*ppm}px`;
    emitViewportState();
  }

  function centerViewport(){
    const viewport=$('artboardViewport');
    if(!viewport)return false;
    requestAnimationFrame(()=>{
      viewport.scrollLeft=Math.max(0,(viewport.scrollWidth-viewport.clientWidth)/2);
      viewport.scrollTop=Math.max(0,(viewport.scrollHeight-viewport.clientHeight)/2);
    });
    return true;
  }

  function setZoomPercent(value,options={}){
    const numeric=Number(value);
    const percent=clamp(Number.isFinite(numeric)?numeric:100,MIN_ZOOM_PERCENT,MAX_ZOOM_PERCENT);
    viewportMode='manual';
    manualPpm=CSS_PX_PER_MM*(percent/100);
    lastViewportSignal='';
    if(project)renderArtboard();else emitViewportState();
    if(options.center!==false)centerViewport();
    return viewportState();
  }

  function stepZoom(direction){
    const current=viewportState().percent;
    const dir=direction>=0?1:-1;
    let next=dir>0?ZOOM_STEPS.find(step=>step>current):[...ZOOM_STEPS].reverse().find(step=>step<current);
    if(next==null)next=dir>0?MAX_ZOOM_PERCENT:MIN_ZOOM_PERCENT;
    return setZoomPercent(next);
  }

  function fitViewport(options={}){
    viewportMode='fit';
    lastViewportSignal='';
    if(project)renderArtboard();else emitViewportState();
    if(options.center!==false)centerViewport();
    return viewportState();
  }

  function actualViewport(options={}){return setZoomPercent(100,options);}

  function resetViewport(){
    viewportMode='fit';
    manualPpm=CSS_PX_PER_MM;
    lastViewportSignal='';
  }

  function positionObject(node,entry){
    if(!node||!entry||!project)return;
    node.style.left=`${(project.bleed+entry.x)*ppm}px`;
    node.style.top=`${(project.bleed+entry.y)*ppm}px`;
    node.style.width=`${entry.w*ppm}px`;
    node.style.fontSize=`${entry.size*(25.4/72)*ppm}px`;
  }

  function iconMarkup(name){return ICONS[name]||'';}

  function renderGuides(artboard,surface){
    if(!project.showGuides)return;
    const trim=document.createElement('div');trim.className='trim-guide';
    trim.style.left=`${project.bleed*ppm}px`;trim.style.top=`${project.bleed*ppm}px`;trim.style.width=`${project.width*ppm}px`;trim.style.height=`${project.height*ppm}px`;
    artboard.appendChild(trim);
    const safe=document.createElement('div');safe.className='safe-guide';
    safe.style.left=`${(project.bleed+project.safe)*ppm}px`;safe.style.top=`${(project.bleed+project.safe)*ppm}px`;safe.style.width=`${Math.max(1,project.width-project.safe*2)*ppm}px`;safe.style.height=`${Math.max(1,project.height-project.safe*2)*ppm}px`;
    artboard.appendChild(safe);
    if(project.showFolds){
      (surface.folds||[]).forEach(mm=>{
        const line=document.createElement('div');line.className='fold-guide';line.style.left=`${(project.bleed+mm)*ppm}px`;line.style.top=`${project.bleed*ppm}px`;line.style.height=`${project.height*ppm}px`;artboard.appendChild(line);
      });
      if(surface.panels?.length>1){
        const boundaries=[0,...(surface.folds||[]),project.width];
        surface.panels.forEach((label,index)=>{
          const start=boundaries[index]??0,end=boundaries[index+1]??project.width;
          const badge=document.createElement('span');badge.className='panel-guide-label';badge.textContent=label;
          badge.style.left=`${(project.bleed+(start+end)/2)*ppm}px`;badge.style.top=`${(project.bleed+3)*ppm}px`;artboard.appendChild(badge);
        });
      }
    }
  }

  function renderTextObject(artboard,entry){
    if(entry.visible===false)return;
    const node=document.createElement('div');
    node.className=`design-object design-text${entry.id===selectedId?' selected':''}${entry.locked?' locked':''}`;
    node.dataset.id=entry.id;node.style.fontFamily=`${entry.fontFamily}, "Malgun Gothic", sans-serif`;node.style.fontWeight=String(entry.weight);node.style.color=entry.color;node.style.textAlign=entry.align;
    positionObject(node,entry);
    const inner=document.createElement('div');inner.className='design-text-inner';
    if(entry.icon&&entry.icon!=='none'){
      const icon=document.createElement('span');icon.className='design-prefix-icon';icon.innerHTML=iconMarkup(entry.icon);inner.appendChild(icon);
    }
    const text=document.createElement('span');text.className='editable-text';text.textContent=entry.text||'';
    if(editingId===entry.id){text.contentEditable='true';text.spellcheck=false;text.classList.add('editing');}
    inner.appendChild(text);node.appendChild(inner);
    if(entry.locked){const lock=document.createElement('span');lock.className='object-lock';lock.textContent='잠금';node.appendChild(lock);}

    node.addEventListener('pointerdown',event=>startDrag(event,entry,node));
    node.addEventListener('click',event=>{event.stopPropagation();selectEntry(entry.id,false);});
    node.addEventListener('dblclick',event=>{event.stopPropagation();if(entry.locked)return;editingId=entry.id;selectedId=entry.id;renderArtboard();renderInspector();setTimeout(()=>{const target=$('artboard')?.querySelector(`[data-id="${entry.id}"] .editable-text`);target?.focus();if(target){const range=document.createRange();range.selectNodeContents(target);const selection=getSelection();selection.removeAllRanges();selection.addRange(range);}},0);});
    text.addEventListener('input',()=>{entry.text=text.textContent||'';const input=$('textContentInput');if(input&&selectedId===entry.id)input.value=entry.text;scheduleSave();});
    text.addEventListener('blur',()=>{if(editingId===entry.id){editingId='';renderArtboard();renderLayers();scheduleSave();}});
    artboard.appendChild(node);
  }

  function renderArtboard(){
    if(!project)return;
    fitArtboard();
    const artboard=$('artboard');const surface=activeSurface();
    if(!artboard||!surface)return;
    artboard.replaceChildren();artboard.style.background=surface.background||'#ffffff';
    renderGuides(artboard,surface);
    surface.elements.forEach(entry=>{if(entry.type==='text')renderTextObject(artboard,entry);});
  }

  function renderInspector(){
    const root=$('inspector');
    if(!root||!project)return;
    const entry=selectedElement();
    if(!entry){
      root.innerHTML=`
        <div class="inspector-title">문서 설정</div><div class="inspector-note">빈 작업영역을 더블클릭하면 그 위치에 글씨를 추가할 수 있습니다.</div>
        <div class="field"><label>완성 규격</label><div class="readonly-value">${project.width} × ${project.height}mm</div></div>
        <div class="field-grid"><div class="field"><label>재단 여백</label><input id="bleedInput" type="number" min="0" max="10" step="0.5" value="${project.bleed}"></div><div class="field"><label>안전 여백</label><input id="safeInput" type="number" min="3" max="30" step="1" value="${project.safe}"></div></div>
        <div class="field"><label>현재 면 배경</label><input id="surfaceBgInput" type="color" value="${esc(activeSurface().background||'#ffffff')}"></div>
        <label class="check-row"><input id="guideToggle" type="checkbox"${project.showGuides?' checked':''}> 재단·안전 여백 표시</label>
        <label class="check-row"><input id="foldToggle" type="checkbox"${project.showFolds?' checked':''}> 접지선·면 표시</label>
        <button class="wide-btn primary" id="inspectorAddTitle" type="button">메인 제목 추가</button>
        <button class="wide-btn" id="inspectorAddText" type="button">본문 글씨 추가</button>`;
      $('bleedInput').oninput=event=>{project.bleed=clamp(Number(event.target.value)||0,0,10);updateProjectMeta();renderArtboard();scheduleSave();};
      $('safeInput').oninput=event=>{project.safe=clamp(Number(event.target.value)||3,3,30);renderArtboard();scheduleSave();};
      $('surfaceBgInput').oninput=event=>{activeSurface().background=event.target.value;renderArtboard();scheduleSave();};
      $('guideToggle').onchange=event=>{project.showGuides=event.target.checked;renderArtboard();scheduleSave();};
      $('foldToggle').onchange=event=>{project.showFolds=event.target.checked;renderArtboard();scheduleSave();};
      $('inspectorAddTitle').onclick=()=>addText('title');$('inspectorAddText').onclick=()=>addText('body');
      return;
    }

    const roles=Object.entries(Presets.ROLE_PRESETS).map(([key,value])=>`<option value="${key}"${entry.role===key?' selected':''}>${esc(value.label)}</option>`).join('');
    const icons=Object.keys(ICONS).map(key=>`<option value="${key}"${entry.icon===key?' selected':''}>${esc(ICON_LABELS[key])}</option>`).join('');
    root.innerHTML=`
      <div class="inspector-title">글씨 설정</div><div class="inspector-note">선택한 글씨 하나만 변경합니다. 잠그면 위치와 내용이 보호됩니다.</div>
      <div class="field"><label>내용</label><textarea id="textContentInput" rows="4">${esc(entry.text)}</textarea></div>
      <div class="field"><label>타이틀 서식</label><select id="roleInput">${roles}</select></div>
      <div class="field"><label>앞 아이콘</label><select id="iconInput">${icons}</select></div>
      <div class="field"><label>글꼴</label><select id="fontInput"><option value="Pretendard"${entry.fontFamily==='Pretendard'?' selected':''}>Pretendard</option><option value="Malgun Gothic"${entry.fontFamily==='Malgun Gothic'?' selected':''}>맑은 고딕</option><option value="Arial"${entry.fontFamily==='Arial'?' selected':''}>Arial</option></select></div>
      <div class="field-grid"><div class="field"><label>글자 크기 pt</label><input id="sizeInput" type="number" min="6" max="120" step="1" value="${entry.size}"></div><div class="field"><label>굵기</label><select id="weightInput"><option value="400"${entry.weight===400?' selected':''}>보통</option><option value="500"${entry.weight===500?' selected':''}>중간</option><option value="700"${entry.weight===700?' selected':''}>굵게</option><option value="800"${entry.weight===800?' selected':''}>더 굵게</option><option value="900"${entry.weight===900?' selected':''}>매우 굵게</option></select></div></div>
      <div class="field"><label>정렬</label><div class="segmented"><button type="button" data-align="left"${entry.align==='left'?' class="on"':''}>왼쪽</button><button type="button" data-align="center"${entry.align==='center'?' class="on"':''}>가운데</button><button type="button" data-align="right"${entry.align==='right'?' class="on"':''}>오른쪽</button></div></div>
      <div class="field-grid"><div class="field"><label>색상</label><input id="colorInput" type="color" value="${esc(entry.color)}"></div><div class="field"><label>글상자 폭 mm</label><input id="widthInput" type="number" min="20" max="${project.width}" step="1" value="${Math.round(entry.w*10)/10}"></div></div>
      <label class="check-row"><input id="lockInput" type="checkbox"${entry.locked?' checked':''}> 이 글씨 잠금</label>
      <div class="action-grid"><button type="button" id="layerBackBtn">뒤로</button><button type="button" id="layerFrontBtn">앞으로</button><button type="button" id="duplicateBtn">복제</button><button type="button" id="deleteBtn" class="danger">삭제</button></div>`;

    $('textContentInput').oninput=event=>{entry.text=event.target.value;renderArtboard();renderLayers();scheduleSave();};
    $('roleInput').onchange=event=>{const preset=rolePreset(event.target.value);entry.role=event.target.value;entry.size=preset.size;entry.weight=preset.weight;entry.align=preset.align;entry.color=preset.color;renderAll();scheduleSave();};
    $('iconInput').onchange=event=>{entry.icon=event.target.value;renderArtboard();scheduleSave();};
    $('fontInput').onchange=event=>{entry.fontFamily=event.target.value;renderArtboard();scheduleSave();};
    $('sizeInput').oninput=event=>{entry.size=clamp(Number(event.target.value)||6,6,120);renderArtboard();scheduleSave();};
    $('weightInput').onchange=event=>{entry.weight=Number(event.target.value);renderArtboard();scheduleSave();};
    root.querySelectorAll('[data-align]').forEach(button=>button.onclick=()=>{entry.align=button.dataset.align;renderArtboard();renderInspector();scheduleSave();});
    $('colorInput').oninput=event=>{entry.color=event.target.value;renderArtboard();scheduleSave();};
    $('widthInput').oninput=event=>{entry.w=clamp(Number(event.target.value)||20,20,project.width);entry.x=clamp(entry.x,0,project.width-entry.w);renderArtboard();scheduleSave();};
    $('lockInput').onchange=event=>{entry.locked=event.target.checked;editingId='';renderArtboard();renderLayers();scheduleSave();};
    $('layerBackBtn').onclick=()=>moveLayer('back');$('layerFrontBtn').onclick=()=>moveLayer('front');$('duplicateBtn').onclick=duplicateSelected;$('deleteBtn').onclick=deleteSelected;
  }

  function renderLayers(){
    const root=$('layerList');
    const surface=activeSurface();
    if(!root||!surface)return;
    root.replaceChildren();
    [...surface.elements].reverse().forEach(entry=>{
      const row=document.createElement('button');row.type='button';row.className=`layer-row${entry.id===selectedId?' on':''}`;
      const label=entry.type==='text'?(entry.text||'빈 글씨'):'요소';
      row.innerHTML=`<span class="layer-kind">T</span><span class="layer-name">${esc(label)}</span><span class="layer-state">${entry.locked?'잠금':''}</span>`;
      row.addEventListener('click',()=>selectEntry(entry.id));root.appendChild(row);
    });
    if(!surface.elements.length){const empty=document.createElement('div');empty.className='layer-empty';empty.textContent='아직 추가한 내용이 없습니다.';root.appendChild(empty);}
  }

  function selectEntry(id,rerender=true){
    selectedId=id||'';editingId='';
    if(rerender)renderArtboard();else document.querySelectorAll('.design-object').forEach(node=>node.classList.toggle('selected',node.dataset.id===selectedId));
    renderInspector();renderLayers();
  }

  function startDrag(event,entry,node){
    if(event.button!==0||entry.locked||editingId===entry.id||event.target?.isContentEditable)return;
    selectedId=entry.id;editingId='';
    document.querySelectorAll('.design-object').forEach(item=>item.classList.toggle('selected',item===node));renderInspector();renderLayers();
    drag={id:entry.id,startX:event.clientX,startY:event.clientY,x:entry.x,y:entry.y,node};
    try{node.setPointerCapture(event.pointerId);}catch(_){}
    event.preventDefault();event.stopPropagation();
  }

  function handlePointerMove(event){
    if(!drag||!project)return;
    const entry=selectedElement();if(!entry||entry.id!==drag.id)return;
    const dx=(event.clientX-drag.startX)/Math.max(.001,ppm);const dy=(event.clientY-drag.startY)/Math.max(.001,ppm);
    entry.x=clamp(drag.x+dx,0,Math.max(0,project.width-entry.w));entry.y=clamp(drag.y+dy,0,Math.max(0,project.height-8));
    positionObject(drag.node,entry);event.preventDefault();
  }

  function handlePointerUp(){if(!drag)return;drag=null;scheduleSave();}

  function artboardPoint(event){
    const artboard=$('artboard');if(!artboard||!project)return null;
    const rect=artboard.getBoundingClientRect();
    return {x:clamp((event.clientX-rect.left)/ppm-project.bleed,0,project.width),y:clamp((event.clientY-rect.top)/ppm-project.bleed,0,project.height)};
  }

  function renderAll(){
    if(!project)return;
    updateProjectMeta();renderSurfaceTabs();renderArtboard();renderInspector();renderLayers();
  }

  function startProject(presetId,custom=null){
    const preset=Presets.get(presetId);if(!preset)return;
    if(preset.custom&&custom){preset.width=clamp(Number(custom.width)||210,80,1000);preset.height=clamp(Number(custom.height)||297,80,1000);preset.name=`사용자 지정 ${preset.width} × ${preset.height}mm`;}
    project=createProject(preset);selectedId='';editingId='';resetViewport();
    $('startScreen')?.classList.add('hidden');$('editorShell')?.classList.remove('hidden');
    renderAll();scheduleSave();setStatus('작업영역을 더블클릭하면 원하는 위치에 글씨를 바로 추가할 수 있습니다.','ok');
  }

  function resumeDraft(){
    const draft=loadDraft();if(!draft)return;
    project=draft;selectedId='';editingId='';resetViewport();$('startScreen')?.classList.add('hidden');$('editorShell')?.classList.remove('hidden');renderAll();setStatus('최근 자동 저장 작업을 불러왔습니다.','ok');
  }

  function backToStart(){
    selectedId='';editingId='';project=null;resetViewport();$('editorShell')?.classList.add('hidden');$('startScreen')?.classList.remove('hidden');renderStartCards();
  }

  function renderStartCards(){
    const root=$('presetGrid');if(!root)return;root.replaceChildren();
    Presets.all().filter(item=>!item.custom).forEach(preset=>{
      const button=document.createElement('button');button.type='button';button.className='preset-card';
      const foldCount=Math.max(0,(preset.surfaces[0]?.folds||[]).length);
      button.innerHTML=`<span class="preset-type">${esc(preset.group)}</span><strong>${esc(preset.name)}</strong><span>${esc(preset.description)}</span><small>${preset.width} × ${preset.height}mm${foldCount?` · ${foldCount+1}단`:''}</small>`;
      button.addEventListener('click',()=>startProject(preset.id));root.appendChild(button);
    });
  }

  function bindStart(){
    renderStartCards();
    const draft=loadDraft();const resume=$('resumeDraftBtn');if(resume)resume.classList.toggle('hidden',!draft);
    resume?.addEventListener('click',resumeDraft);
    $('customStartBtn')?.addEventListener('click',()=>startProject('custom',{width:$('customWidth')?.value,height:$('customHeight')?.value}));
    $('coverEditorBtn')?.addEventListener('click',()=>{location.href='../perfect-binding-cover/';});
  }

  function bindEditor(){
    $('addTitleBtn')?.addEventListener('click',()=>addText('title'));
    $('addSubtitleBtn')?.addEventListener('click',()=>addText('subtitle'));
    $('addBodyBtn')?.addEventListener('click',()=>addText('body'));
    $('addInfoBtn')?.addEventListener('click',()=>addText('info'));
    $('newDesignBtn')?.addEventListener('click',()=>{if(project&&activeSurface()?.elements.length&&!confirm('현재 작업은 자동 저장되어 있습니다. 새 디자인 선택 화면으로 이동할까요?'))return;backToStart();});
    $('artboard')?.addEventListener('click',event=>{if(event.target!==$('artboard')&&!event.target.classList.contains('trim-guide')&&!event.target.classList.contains('safe-guide'))return;selectEntry('');});
    $('artboard')?.addEventListener('dblclick',event=>{if(event.target.closest?.('.design-object'))return;const point=artboardPoint(event);if(point)addText('body',{x:Math.max(0,point.x-35),y:point.y},'내용을 입력하세요');});
    document.addEventListener('pointermove',handlePointerMove,{passive:false});document.addEventListener('pointerup',handlePointerUp);document.addEventListener('pointercancel',handlePointerUp);
    document.addEventListener('keydown',event=>{
      const tag=String(event.target?.tagName||'').toUpperCase();const typing=['INPUT','TEXTAREA','SELECT'].includes(tag)||event.target?.isContentEditable;
      if(event.key==='Escape'&&editingId){editingId='';renderArtboard();return;}
      if(typing)return;
      if((event.key==='Delete'||event.key==='Backspace')&&selectedId){event.preventDefault();deleteSelected();}
      if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='d'&&selectedId){event.preventDefault();duplicateSelected();}
    });
    window.addEventListener('resize',()=>{if(project)renderArtboard();},{passive:true});
  }

  function boot(){
    bindStart();bindEditor();
    const userName=$('navUserName');
    if(window.auth&&typeof auth.onAuthStateChanged==='function'){
      auth.onAuthStateChanged(user=>{
        if(!user){location.href='../login.html';return;}
        if(userName)userName.textContent=user.displayName||(user.email||'').split('@')[0];
        $('authLoading')?.classList.add('hidden');
      });
      $('logoutBtn')?.addEventListener('click',async()=>{await auth.signOut();location.href='../index.html';});
    }else $('authLoading')?.classList.add('hidden');
    const viewport=Object.freeze({
      fit:fitViewport,
      actual:actualViewport,
      center:centerViewport,
      zoomIn:()=>stepZoom(1),
      zoomOut:()=>stepZoom(-1),
      setZoom:setZoomPercent,
      getState:viewportState,
      min:MIN_ZOOM_PERCENT,
      max:MAX_ZOOM_PERCENT,
      stage:'design-editor-viewport-api-v1'
    });
    window.DesignEditorApp={startProject,resumeDraft,get project(){return project;},viewport,stage:'lightweight-direct-print-design-editor'};
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();