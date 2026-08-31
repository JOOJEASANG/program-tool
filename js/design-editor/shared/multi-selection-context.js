// Multi-selection layer for the embedded design editor.
// Keeps the existing flat project model and single-selection inspectors intact.
(function(){
  'use strict';
  if(window.__designEditorMultiSelectionV1)return;
  window.__designEditorMultiSelectionV1=true;
  if(new URLSearchParams(location.search).get('embed')!=='1')return;

  const BAR_ID='designMultiSelectionContextbar';
  const BOUNDS_ID='designMultiSelectionBounds';
  const STYLE_ID='designMultiSelectionStyles';
  const DRAFT_KEY='programTool.designEditor.draft.v1';
  const selectedKeys=new Set();
  let installed=false;
  let syncTimer=0;
  let observer=null;
  let drag=null;
  let suppressClickUntil=0;

  const byId=id=>document.getElementById(id);
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const project=()=>window.DesignEditorApp?.project||null;
  const surface=()=>{
    const p=project();
    return p?.surfaces?.find(item=>item.id===p.activeSurface)||p?.surfaces?.[0]||null;
  };
  const uid=prefix=>`${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`;
  const itemKey=(kind,id)=>`${kind}:${id}`;

  function setStatus(message,type='info'){
    const node=byId('editorStatus');if(!node)return;
    node.className=`editor-status ${type}`;node.textContent=message;
  }

  function ppm(){
    const p=project(),board=byId('artboard');
    if(!p||!board)return 1;
    return Math.max(.001,board.getBoundingClientRect().width/Math.max(1,Number(p.width)+(Number(p.bleed)||0)*2));
  }

  function textHeight(item,node=null){
    const scale=ppm(),rect=node?.getBoundingClientRect?.();
    if(rect?.height>1)return rect.height/scale;
    return Math.max(4,(Number(item.size)||11)*0.3528*(Number(item.lineHeight)||1.26));
  }

  function dimensions(record){
    const item=record.item;
    return {
      x:Number(item.x)||0,
      y:Number(item.y)||0,
      w:Math.max(.5,Number(item.w)||.5),
      h:record.kind==='extra'?Math.max(.5,Number(item.h)||.5):textHeight(item,record.node)
    };
  }

  function recordForKey(key){
    const current=surface();if(!current)return null;
    const split=String(key||'').indexOf(':');if(split<1)return null;
    const kind=key.slice(0,split),id=key.slice(split+1);
    if(kind==='text'){
      const item=current.elements?.find(entry=>entry.id===id&&entry.type==='text');
      if(!item)return null;
      const node=byId('artboard')?.querySelector(`.design-text[data-id="${CSS.escape(id)}"]`)||null;
      return {key,kind:'text',item,node};
    }
    if(kind==='extra'){
      const item=current.extras?.find(entry=>entry.id===id);
      if(!item)return null;
      const node=byId('artboard')?.querySelector(`.phase2-extra-object[data-extra-id="${CSS.escape(id)}"]`)||null;
      return {key,kind:'extra',item,node};
    }
    return null;
  }

  function recordForNode(target){
    const node=target?.closest?.('.design-text,.phase2-extra-object');if(!node)return null;
    const current=surface();if(!current)return null;
    if(node.classList.contains('phase2-extra-object')){
      const id=node.dataset.extraId||'';
      const item=current.extras?.find(entry=>entry.id===id);
      return item?{key:itemKey('extra',id),kind:'extra',item,node}:null;
    }
    const id=node.dataset.id||'';
    const item=current.elements?.find(entry=>entry.id===id&&entry.type==='text');
    return item?{key:itemKey('text',id),kind:'text',item,node}:null;
  }

  function records(){
    const result=[];
    [...selectedKeys].forEach(key=>{
      const record=recordForKey(key);
      if(record)result.push(record);else selectedKeys.delete(key);
    });
    return result;
  }

  function singleSelectionKeys(){
    const found=[];
    document.querySelectorAll('#artboard .design-text.selected').forEach(node=>{
      if(node.dataset.id)found.push(itemKey('text',node.dataset.id));
    });
    document.querySelectorAll('#artboard .phase2-extra-object.selected').forEach(node=>{
      if(node.dataset.extraId)found.push(itemKey('extra',node.dataset.extraId));
    });
    return found;
  }

  function groupKeys(groupId){
    if(!groupId)return[];
    const current=surface();if(!current)return[];
    const keys=[];
    (current.elements||[]).forEach(item=>{if(item.groupId===groupId)keys.push(itemKey('text',item.id));});
    (current.extras||[]).forEach(item=>{if(item.groupId===groupId)keys.push(itemKey('extra',item.id));});
    return keys;
  }

  function bounds(list=records(),unlockedOnly=false){
    const chosen=(unlockedOnly?list.filter(record=>!record.item.locked):list);
    if(!chosen.length)return null;
    const boxes=chosen.map(record=>dimensions(record));
    const left=Math.min(...boxes.map(box=>box.x));
    const top=Math.min(...boxes.map(box=>box.y));
    const right=Math.max(...boxes.map(box=>box.x+box.w));
    const bottom=Math.max(...boxes.map(box=>box.y+box.h));
    return {left,top,right,bottom,width:right-left,height:bottom-top};
  }

  function persist(reason='multi-selection'){
    try{
      const p=project();if(!p)return false;
      localStorage.setItem(DRAFT_KEY,JSON.stringify(p));
      window.DesignEditorDraftScope?.saveCurrent?.(reason);
      const state=byId('saveState');if(state)state.textContent='자동 저장됨';
      return true;
    }catch(_){
      setStatus('다중 선택 변경사항을 저장하지 못했습니다.','err');return false;
    }
  }

  function applyNodePosition(record){
    const p=project(),node=record.node;if(!p||!node)return;
    const scale=ppm(),bleed=Number(p.bleed)||0,item=record.item;
    node.style.left=`${(bleed+(Number(item.x)||0))*scale}px`;
    node.style.top=`${(bleed+(Number(item.y)||0))*scale}px`;
  }

  function ensureStyles(){
    if(byId(STYLE_ID))return;
    const style=document.createElement('style');style.id=STYLE_ID;style.textContent=`
      #${BAR_ID}{position:sticky;top:54px;z-index:74;display:flex;align-items:center;gap:5px;min-height:42px;flex:0 0 42px;padding:5px 10px;border-bottom:1px solid #cfdce9;background:#f5f9fd;box-shadow:0 3px 10px rgba(15,39,72,.04);overflow-x:auto;overflow-y:hidden;white-space:nowrap;scrollbar-width:thin}
      #${BAR_ID}[hidden]{display:none!important}
      html[data-design-multi-selection] #designSelectionContextbar{display:none!important}
      html[data-design-multi-selection] #designCanvasQuickbar{display:none!important}
      html[data-design-multi-selection] #artboard .selected{outline-color:transparent!important;box-shadow:none!important;border-color:transparent!important}
      #artboard .ps-multi-selected{outline:1.5px solid #1769e0!important;box-shadow:0 0 0 2px rgba(255,255,255,.82),0 0 0 4px rgba(23,105,224,.12)!important}
      #${BOUNDS_ID}{position:absolute;z-index:118;pointer-events:none;border:1px dashed #1769e0;background:rgba(23,105,224,.025);box-shadow:0 0 0 1px rgba(255,255,255,.8) inset}
      .design-multi-kind{display:inline-flex;align-items:center;gap:6px;flex:0 0 auto;padding-right:4px}.design-multi-kind strong{height:28px;min-width:34px;display:grid;place-items:center;border:1px solid #a9c5e3;border-radius:7px;background:#fff;color:#1769e0;font-size:8px;font-weight:950}.design-multi-kind span{font-size:8px;font-weight:900;color:#41556d}
      .design-multi-group{display:flex;align-items:center;gap:3px;flex:0 0 auto}.design-multi-label{font-size:7px;font-weight:900;color:#7a8797;margin-right:2px}.design-multi-group button{height:29px;min-width:30px;border:1px solid #d2deea;border-radius:7px;background:#fff;color:#526174;padding:0 7px;font-size:7.5px;font-weight:900;cursor:pointer}.design-multi-group button:hover:not(:disabled){border-color:#8fb1d3;background:#edf6ff;color:#17466f}.design-multi-group button:disabled{opacity:.4;cursor:not-allowed}.design-multi-group button.on{border-color:#7ba9d7;background:#e8f3ff;color:#1769e0}.design-multi-group button.danger{color:#b42318;background:#fff8f7}.design-multi-sep{width:1px;height:22px;background:#d7e2ec;margin:0 2px;flex:0 0 1px}
      @media(max-width:920px){#${BAR_ID}{top:var(--design-commandbar-height,96px);padding-inline:8px}.design-multi-label{display:none}.design-multi-kind span{display:none}}
      @media(max-width:620px){#${BAR_ID}{gap:4px}.design-multi-group button{padding:0 6px}.design-multi-group[data-multi-section="bulk"] button[data-multi-action="lock"]{display:none}}
    `;document.head.appendChild(style);
  }

  function ensureBar(){
    let bar=byId(BAR_ID);if(bar)return bar;
    const single=byId('designSelectionContextbar');
    const toolbar=document.querySelector('.editor-toolbar');if(!toolbar)return null;
    bar=document.createElement('div');bar.id=BAR_ID;bar.hidden=true;
    bar.setAttribute('role','toolbar');bar.setAttribute('aria-label','여러 요소 편집');
    (single||toolbar).insertAdjacentElement('afterend',bar);
    bar.innerHTML=`<span class="design-multi-kind"><strong data-multi-count>0개</strong><span>여러 요소</span></span>
      <span class="design-multi-sep" aria-hidden="true"></span>
      <div class="design-multi-group" data-multi-section="align"><span class="design-multi-label">정렬</span>
        <button type="button" data-multi-action="left" title="선택 범위 왼쪽 정렬">좌</button>
        <button type="button" data-multi-action="center" title="선택 범위 가로 중앙 정렬">가운데</button>
        <button type="button" data-multi-action="right" title="선택 범위 오른쪽 정렬">우</button>
        <button type="button" data-multi-action="top" title="선택 범위 위쪽 정렬">위</button>
        <button type="button" data-multi-action="middle" title="선택 범위 세로 중앙 정렬">중앙</button>
        <button type="button" data-multi-action="bottom" title="선택 범위 아래쪽 정렬">아래</button>
      </div>
      <span class="design-multi-sep" aria-hidden="true"></span>
      <div class="design-multi-group" data-multi-section="distribute"><span class="design-multi-label">간격</span>
        <button type="button" data-multi-action="distribute-h" title="가로 간격 동일하게">가로 동일</button>
        <button type="button" data-multi-action="distribute-v" title="세로 간격 동일하게">세로 동일</button>
      </div>
      <span class="design-multi-sep" aria-hidden="true"></span>
      <div class="design-multi-group" data-multi-section="group"><span class="design-multi-label">그룹</span>
        <button type="button" data-multi-action="group">그룹</button>
        <button type="button" data-multi-action="ungroup">해제</button>
      </div>
      <span class="design-multi-sep" aria-hidden="true"></span>
      <div class="design-multi-group" data-multi-section="bulk"><span class="design-multi-label">일괄</span>
        <button type="button" data-multi-action="lock">잠금</button>
        <button type="button" data-multi-action="duplicate">복제</button>
        <button type="button" data-multi-action="delete" class="danger">삭제</button>
      </div>`;
    bar.addEventListener('pointerdown',event=>event.stopPropagation());
    bar.addEventListener('click',event=>{
      event.stopPropagation();
      const button=event.target.closest('[data-multi-action]');if(!button||button.disabled)return;
      const action=button.dataset.multiAction;
      if(['left','center','right','top','middle','bottom'].includes(action))align(action);
      else if(action==='distribute-h')distribute('horizontal');
      else if(action==='distribute-v')distribute('vertical');
      else if(action==='group')group();
      else if(action==='ungroup')ungroup();
      else if(action==='lock')toggleLock();
      else if(action==='duplicate')duplicate();
      else if(action==='delete')remove();
    });
    document.documentElement.classList.add('design-multi-selection-ready');
    return bar;
  }

  function renderBounds(list){
    const board=byId('artboard'),p=project();if(!board||!p)return;
    byId(BOUNDS_ID)?.remove();
    const box=bounds(list);if(!box)return;
    const scale=ppm(),bleed=Number(p.bleed)||0;
    const node=document.createElement('div');node.id=BOUNDS_ID;
    node.style.left=`${(bleed+box.left)*scale}px`;node.style.top=`${(bleed+box.top)*scale}px`;
    node.style.width=`${Math.max(1,box.width*scale)}px`;node.style.height=`${Math.max(1,box.height*scale)}px`;
    board.appendChild(node);
  }

  function clearVisuals(){
    document.querySelectorAll('#artboard .ps-multi-selected').forEach(node=>node.classList.remove('ps-multi-selected'));
    byId(BOUNDS_ID)?.remove();
  }

  function applyVisuals(){
    clearVisuals();
    const list=records();
    if(list.length<2){
      const bar=byId(BAR_ID);if(bar)bar.hidden=true;
      delete document.documentElement.dataset.designMultiSelection;
      return list;
    }
    document.querySelectorAll('#artboard .selected').forEach(node=>node.classList.remove('selected'));
    list.forEach(record=>record.node?.classList.add('ps-multi-selected'));
    document.documentElement.dataset.designMultiSelection=String(list.length);
    const bar=ensureBar();
    if(bar){
      bar.hidden=false;
      bar.querySelector('[data-multi-count]').textContent=`${list.length}개`;
      const distributeDisabled=list.filter(record=>!record.item.locked).length<3;
      bar.querySelector('[data-multi-action="distribute-h"]').disabled=distributeDisabled;
      bar.querySelector('[data-multi-action="distribute-v"]').disabled=distributeDisabled;
      const grouped=list.every(record=>Boolean(record.item.groupId))&&new Set(list.map(record=>record.item.groupId)).size===1;
      bar.querySelector('[data-multi-action="group"]').disabled=grouped;
      bar.querySelector('[data-multi-action="ungroup"]').disabled=!list.some(record=>record.item.groupId);
      const allLocked=list.every(record=>record.item.locked);
      const lock=bar.querySelector('[data-multi-action="lock"]');
      lock.textContent=allLocked?'잠금 해제':'잠금';lock.classList.toggle('on',allLocked);
    }
    renderBounds(list);
    window.DesignEditorSelectionContextbar?.sync?.();
    return list;
  }

  function clear(options={}){
    selectedKeys.clear();clearVisuals();
    const bar=byId(BAR_ID);if(bar)bar.hidden=true;
    delete document.documentElement.dataset.designMultiSelection;
    if(options.restoreSingle&&options.key){
      requestAnimationFrame(()=>{
        const record=recordForKey(options.key);
        record?.node?.click?.();
      });
    }
    window.DesignEditorSelectionContextbar?.sync?.();
    return true;
  }

  function selectKeys(keys){
    selectedKeys.clear();
    (keys||[]).forEach(key=>{if(recordForKey(key))selectedKeys.add(key);});
    if(selectedKeys.size<2){
      const only=[...selectedKeys][0]||'';
      return clear({restoreSingle:Boolean(only),key:only});
    }
    applyVisuals();return true;
  }

  function reconcile(){
    records();
    if(selectedKeys.size<2){clear();return[];}
    return applyVisuals();
  }

  function positionSync(){
    const list=records();
    list.forEach(applyNodePosition);
    persist();
    window.DesignEditorPhase2?.sync?.();
    requestAnimationFrame(()=>{applyVisuals();window.DesignEditorWorkflowV2?.activateStep?.('arrange',false);});
    return true;
  }

  function align(direction){
    const list=records(),movable=list.filter(record=>!record.item.locked);if(movable.length<2)return false;
    const box=bounds(list);if(!box)return false;
    movable.forEach(record=>{
      const d=dimensions(record),item=record.item;
      if(direction==='left')item.x=box.left;
      if(direction==='center')item.x=box.left+(box.width-d.w)/2;
      if(direction==='right')item.x=box.right-d.w;
      if(direction==='top')item.y=box.top;
      if(direction==='middle')item.y=box.top+(box.height-d.h)/2;
      if(direction==='bottom')item.y=box.bottom-d.h;
    });
    setStatus(`${list.length}개 요소를 선택 범위 기준으로 정렬했습니다.`,'ok');
    return positionSync();
  }

  function distribute(axis){
    const list=records().filter(record=>!record.item.locked);if(list.length<3)return false;
    const horizontal=axis==='horizontal';
    const sorted=[...list].sort((a,b)=>{
      const ad=dimensions(a),bd=dimensions(b);
      return horizontal?ad.x-bd.x:ad.y-bd.y;
    });
    const first=dimensions(sorted[0]),last=dimensions(sorted[sorted.length-1]);
    const start=horizontal?first.x:first.y;
    const end=horizontal?last.x+last.w:last.y+last.h;
    const total=sorted.reduce((sum,record)=>{const d=dimensions(record);return sum+(horizontal?d.w:d.h);},0);
    const gap=(end-start-total)/(sorted.length-1);
    let cursor=start;
    sorted.forEach((record,index)=>{
      const d=dimensions(record);
      if(index>0&&index<sorted.length-1){
        if(horizontal)record.item.x=cursor;else record.item.y=cursor;
      }
      cursor+=(horizontal?d.w:d.h)+gap;
    });
    setStatus(`${list.length}개 요소의 ${horizontal?'가로':'세로'} 간격을 동일하게 맞췄습니다.`,'ok');
    return positionSync();
  }

  function group(){
    const list=records();if(list.length<2)return false;
    const id=uid('design_group');
    list.forEach(record=>record.item.groupId=id);
    persist('multi-group');applyVisuals();setStatus(`${list.length}개 요소를 그룹으로 묶었습니다.`,'ok');return id;
  }

  function ungroup(){
    const list=records();if(!list.some(record=>record.item.groupId))return false;
    list.forEach(record=>{delete record.item.groupId;});
    persist('multi-ungroup');applyVisuals();setStatus('선택한 요소의 그룹을 해제했습니다.','ok');return true;
  }

  function reloadAndRestore(keys,reason){
    const wanted=[...(keys||[])];
    persist(reason);
    try{window.DesignEditorApp?.resumeDraft?.();}catch(_){}
    const restore=()=>{
      try{window.DesignEditorPhase2?.sync?.();}catch(_){}
      selectedKeys.clear();wanted.forEach(key=>{if(recordForKey(key))selectedKeys.add(key);});
      applyVisuals();
    };
    requestAnimationFrame(restore);
    setTimeout(restore,60);
    setTimeout(restore,180);
  }

  function toggleLock(){
    const list=records();if(!list.length)return false;
    const next=!list.every(record=>Boolean(record.item.locked));
    list.forEach(record=>record.item.locked=next);
    reloadAndRestore(list.map(record=>record.key),next?'multi-lock':'multi-unlock');
    setStatus(next?'선택 요소를 모두 잠갔습니다.':'선택 요소의 잠금을 해제했습니다.','ok');return next;
  }

  function duplicate(){
    const p=project(),current=surface(),list=records();if(!p||!current||list.length<2)return false;
    const box=bounds(list);
    const dx=Math.max(0,Math.min(4,Number(p.width)-box.right));
    const dy=Math.max(0,Math.min(4,Number(p.height)-box.bottom));
    const newGroup=uid('design_group'),newKeys=[];
    list.forEach(record=>{
      const copy={...record.item,id:uid(record.kind==='text'?'design':'design_extra'),x:(Number(record.item.x)||0)+dx,y:(Number(record.item.y)||0)+dy,locked:false,groupId:newGroup};
      if(record.kind==='text'){
        current.elements=current.elements||[];current.elements.push(copy);newKeys.push(itemKey('text',copy.id));
      }else{
        current.extras=current.extras||[];current.extras.push(copy);newKeys.push(itemKey('extra',copy.id));
      }
    });
    selectedKeys.clear();newKeys.forEach(key=>selectedKeys.add(key));
    reloadAndRestore(newKeys,'multi-duplicate');
    setStatus(`${list.length}개 요소를 한 번에 복제했습니다.`,'ok');return newKeys;
  }

  function remove(){
    const current=surface(),list=records();if(!current||list.length<2)return false;
    const textIds=new Set(list.filter(record=>record.kind==='text').map(record=>record.item.id));
    const extraIds=new Set(list.filter(record=>record.kind==='extra').map(record=>record.item.id));
    current.elements=(current.elements||[]).filter(item=>!textIds.has(item.id));
    current.extras=(current.extras||[]).filter(item=>!extraIds.has(item.id));
    selectedKeys.clear();persist('multi-delete');
    try{window.DesignEditorApp?.resumeDraft?.();}catch(_){}
    try{window.DesignEditorPhase2?.sync?.();}catch(_){}
    clear();setStatus(`${list.length}개 요소를 삭제했습니다.`,'ok');return true;
  }

  function moveBy(dx,dy){
    const p=project(),list=records(),movable=list.filter(record=>!record.item.locked);if(!p||!movable.length)return false;
    const box=bounds(movable);if(!box)return false;
    const safeDx=clamp(Number(dx)||0,-box.left,Number(p.width)-box.right);
    const safeDy=clamp(Number(dy)||0,-box.top,Number(p.height)-box.bottom);
    movable.forEach(record=>{record.item.x=(Number(record.item.x)||0)+safeDx;record.item.y=(Number(record.item.y)||0)+safeDy;});
    return positionSync();
  }

  function beginDrag(event,record){
    const movable=records().filter(item=>!item.item.locked);if(movable.length<1)return false;
    drag={
      pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,
      scale:ppm(),
      start:movable.map(item=>({key:item.key,x:Number(item.item.x)||0,y:Number(item.item.y)||0})),
      box:bounds(movable)
    };
    suppressClickUntil=Date.now()+450;
    event.preventDefault();event.stopImmediatePropagation();
    try{record.node?.setPointerCapture?.(event.pointerId);}catch(_){}
    return true;
  }

  function handleDragMove(event){
    if(!drag)return;
    const p=project();if(!p)return;
    const rawDx=(event.clientX-drag.startX)/drag.scale,rawDy=(event.clientY-drag.startY)/drag.scale;
    const dx=clamp(rawDx,-drag.box.left,Number(p.width)-drag.box.right);
    const dy=clamp(rawDy,-drag.box.top,Number(p.height)-drag.box.bottom);
    drag.start.forEach(start=>{
      const record=recordForKey(start.key);if(!record||record.item.locked)return;
      record.item.x=start.x+dx;record.item.y=start.y+dy;applyNodePosition(record);
    });
    renderBounds(records());event.preventDefault();event.stopImmediatePropagation();
  }

  function finishDrag(event){
    if(!drag)return;
    drag=null;persist('multi-drag');
    window.DesignEditorPhase2?.sync?.();
    requestAnimationFrame(applyVisuals);
    if(event){event.preventDefault();event.stopImmediatePropagation();}
  }

  function modifierSelect(event,record){
    const seed=selectedKeys.size?[...selectedKeys]:singleSelectionKeys();
    selectedKeys.clear();seed.forEach(key=>selectedKeys.add(key));
    const grouped=record.item.groupId?groupKeys(record.item.groupId):[record.key];
    const remove=grouped.every(key=>selectedKeys.has(key));
    grouped.forEach(key=>remove?selectedKeys.delete(key):selectedKeys.add(key));
    suppressClickUntil=Date.now()+450;
    event.preventDefault();event.stopImmediatePropagation();
    if(selectedKeys.size===1){
      const only=[...selectedKeys][0];clear({restoreSingle:true,key:only});
    }else if(selectedKeys.size<2)clear();
    else applyVisuals();
  }

  function handlePointerDown(event){
    const record=recordForNode(event.target);
    const modified=event.shiftKey||event.ctrlKey||event.metaKey;
    if(!record){
      if(!event.target?.closest?.(`#${BAR_ID}`)&&event.target===byId('artboard'))clear();
      return;
    }
    if(modified){modifierSelect(event,record);return;}
    if(record.item.groupId){
      const keys=groupKeys(record.item.groupId);
      if(keys.length>1){
        if(!keys.every(key=>selectedKeys.has(key)))selectKeys(keys);
        beginDrag(event,record);return;
      }
    }
    if(selectedKeys.size>=2&&selectedKeys.has(record.key)){beginDrag(event,record);return;}
    if(selectedKeys.size>=2)clear();
  }

  function handleClickCapture(event){
    if(Date.now()<suppressClickUntil&&recordForNode(event.target)){
      event.preventDefault();event.stopImmediatePropagation();
    }
  }

  function handleKeydown(event){
    if(selectedKeys.size<2)return;
    const tag=String(event.target?.tagName||'').toUpperCase();
    if(['INPUT','TEXTAREA','SELECT'].includes(tag)||event.target?.isContentEditable)return;
    if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();clear();return;}
    if(event.key==='Delete'||event.key==='Backspace'){event.preventDefault();event.stopImmediatePropagation();remove();return;}
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='d'){event.preventDefault();event.stopImmediatePropagation();duplicate();return;}
    if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)){
      const step=event.shiftKey?5:.5;
      const dx=event.key==='ArrowLeft'?-step:event.key==='ArrowRight'?step:0;
      const dy=event.key==='ArrowUp'?-step:event.key==='ArrowDown'?step:0;
      event.preventDefault();event.stopImmediatePropagation();moveBy(dx,dy);
    }
  }

  function bindGlobal(){
    document.addEventListener('pointerdown',handlePointerDown,true);
    document.addEventListener('pointermove',handleDragMove,true);
    document.addEventListener('pointerup',finishDrag,true);
    document.addEventListener('pointercancel',finishDrag,true);
    document.addEventListener('click',handleClickCapture,true);
    document.addEventListener('keydown',handleKeydown,true);
    window.addEventListener('resize',()=>queueSync(20),{passive:true});
    const board=byId('artboard');
    if(board&&typeof MutationObserver==='function'){
      observer=new MutationObserver(mutations=>{
        const relevant=mutations.some(mutation=>[...mutation.addedNodes,...mutation.removedNodes].some(node=>
          node?.nodeType===1&&(node.matches?.('.design-text,.phase2-extra-object')||node.querySelector?.('.design-text,.phase2-extra-object'))
        ));
        if(relevant)queueSync(18);
      });
      observer.observe(board,{childList:true,subtree:true});
    }
  }

  function sync(){
    clearTimeout(syncTimer);
    if(selectedKeys.size>=2)reconcile();
    return true;
  }

  function queueSync(delay=28){
    clearTimeout(syncTimer);syncTimer=setTimeout(()=>requestAnimationFrame(sync),delay);
  }

  function install(){
    if(installed)return true;
    if(!byId('artboard')||!document.querySelector('.editor-toolbar'))return false;
    installed=true;ensureStyles();ensureBar();bindGlobal();
    window.DesignEditorMultiSelection={
      selectKeys,clear,sync,align,distribute,group,ungroup,toggleLock,duplicate,remove,moveBy,
      get records(){return records();},
      get selectedKeys(){return [...selectedKeys];},
      stage:'multi-select-align-distribute-group-v1'
    };
    return true;
  }

  function boot(){if(install())return;[120,320,700,1300,2300,3600].forEach(delay=>setTimeout(install,delay));}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();