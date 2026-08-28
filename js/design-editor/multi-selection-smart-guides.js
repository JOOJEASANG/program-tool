// Multi-selection smart guides and exact spacing for the embedded design editor.
(function(){
  'use strict';
  if(window.__designEditorMultiSmartGuidesV1)return;
  window.__designEditorMultiSmartGuidesV1=true;
  if(new URLSearchParams(location.search).get('embed')!=='1')return;

  const STYLE_ID='designMultiSmartGuidesStyles';
  const CONTROLS_ID='designMultiSmartGuideControls';
  const DRAFT_KEY='programTool.designEditor.draft.v1';
  const PREF_KEY='programTool.designEditor.multiSmartGuides.v1';
  const SNAP_MM=2.2;
  let installed=false;
  let enabled=true;
  let dragActive=false;
  let dragPointerId=null;
  let moveFrame=0;
  let clearTimer=0;
  let observer=null;

  const byId=id=>document.getElementById(id);
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const round1=value=>Math.round((Number(value)||0)*10)/10;
  const project=()=>window.DesignEditorApp?.project||null;
  const multi=()=>window.DesignEditorMultiSelection||null;
  const surface=()=>{
    const p=project();
    return p?.surfaces?.find(item=>item.id===p.activeSurface)||p?.surfaces?.[0]||null;
  };

  try{enabled=localStorage.getItem(PREF_KEY)!=='off';}catch(_){enabled=true;}

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
    if(rect?.height>1)return Math.max(.5,rect.height/scale);
    const lines=Math.max(1,String(item?.text||'').split(/\n/).length);
    return Math.max(4,(Number(item?.size)||11)*25.4/72*lines*(Number(item?.lineHeight)||1.26));
  }

  function dimensions(record){
    const item=record.item;
    return {x:Number(item.x)||0,y:Number(item.y)||0,w:Math.max(.5,Number(item.w)||.5),h:record.kind==='extra'?Math.max(.5,Number(item.h)||.5):textHeight(item,record.node)};
  }

  function selectedRecords(){
    const api=multi();if(!api)return[];
    return (api.records||[]).filter(record=>record?.item);
  }

  function bounds(list){
    if(!list?.length)return null;
    const boxes=list.map(dimensions);
    const left=Math.min(...boxes.map(box=>box.x)),top=Math.min(...boxes.map(box=>box.y));
    const right=Math.max(...boxes.map(box=>box.x+box.w)),bottom=Math.max(...boxes.map(box=>box.y+box.h));
    return {left,top,right,bottom,width:right-left,height:bottom-top};
  }

  function nodeForText(id){return byId('artboard')?.querySelector(`.design-text[data-id="${CSS.escape(id)}"]`)||null;}
  function nodeForExtra(id){return byId('artboard')?.querySelector(`.phase2-extra-object[data-extra-id="${CSS.escape(id)}"]`)||null;}

  function otherRects(selected){
    const current=surface();if(!current)return[];
    const keys=new Set(selected.map(record=>record.key)),rows=[];
    (current.elements||[]).forEach(item=>{
      const key=`text:${item.id}`;if(keys.has(key)||item.visible===false||item.type!=='text')return;
      rows.push({key,rect:{x:Number(item.x)||0,y:Number(item.y)||0,w:Math.max(.5,Number(item.w)||.5),h:textHeight(item,nodeForText(item.id))}});
    });
    (current.extras||[]).forEach(item=>{
      const key=`extra:${item.id}`;if(keys.has(key)||item.visible===false)return;
      nodeForExtra(item.id);
      rows.push({key,rect:{x:Number(item.x)||0,y:Number(item.y)||0,w:Math.max(.5,Number(item.w)||.5),h:Math.max(.5,Number(item.h)||.5)}});
    });
    return rows;
  }

  const ownPoints=(box,axis)=>axis==='x'
    ?[{value:box.left,name:'왼쪽'},{value:box.left+box.width/2,name:'가운데'},{value:box.right,name:'오른쪽'}]
    :[{value:box.top,name:'위'},{value:box.top+box.height/2,name:'가운데'},{value:box.bottom,name:'아래'}];

  function targets(axis,others){
    const p=project();if(!p)return[];
    const span=axis==='x'?Number(p.width)||0:Number(p.height)||0;
    const safe=Math.max(0,Number(p.safe)||0);
    const rows=[
      {value:0,label:axis==='x'?'아트보드 왼쪽':'아트보드 위',priority:1},
      {value:span/2,label:'아트보드 가운데',priority:0},
      {value:span,label:axis==='x'?'아트보드 오른쪽':'아트보드 아래',priority:1}
    ];
    if(safe>0&&safe<span/2)rows.push({value:safe,label:'안전여백',priority:2},{value:span-safe,label:'안전여백',priority:2});
    others.forEach(row=>{
      const rect=row.rect;
      if(axis==='x')rows.push({value:rect.x,label:'요소 왼쪽',priority:3},{value:rect.x+rect.w/2,label:'요소 가운데',priority:3},{value:rect.x+rect.w,label:'요소 오른쪽',priority:3});
      else rows.push({value:rect.y,label:'요소 위',priority:3},{value:rect.y+rect.h/2,label:'요소 가운데',priority:3},{value:rect.y+rect.h,label:'요소 아래',priority:3});
    });
    return rows;
  }

  function bestSnap(box,others,axis){
    let best=null;
    ownPoints(box,axis).forEach(point=>targets(axis,others).forEach(target=>{
      const delta=target.value-point.value,distance=Math.abs(delta);if(distance>SNAP_MM)return;
      const candidate={delta,distance,value:target.value,label:target.label,priority:target.priority};
      if(!best||distance<best.distance-.0001||(Math.abs(distance-best.distance)<.0001&&candidate.priority<best.priority))best=candidate;
    }));
    return best;
  }

  function applyNodePosition(record){
    const p=project(),node=record.node;if(!p||!node)return;
    const scale=ppm(),bleed=Number(p.bleed)||0,item=record.item;
    node.style.left=`${(bleed+(Number(item.x)||0))*scale}px`;node.style.top=`${(bleed+(Number(item.y)||0))*scale}px`;
  }

  function clearGuides(delay=0){
    clearTimeout(clearTimer);
    const run=()=>byId('artboard')?.querySelectorAll('.phase17-multi-guide,.phase17-multi-guide-badge').forEach(node=>node.remove());
    if(delay)clearTimer=setTimeout(run,delay);else run();
  }

  function showGuides(xSnap,ySnap){
    const board=byId('artboard'),p=project(),scale=ppm();if(!board||!p)return;
    clearGuides();const bleed=Number(p.bleed)||0;
    const add=(snap,axis)=>{
      if(!snap)return;
      const line=document.createElement('span');line.className=`phase17-multi-guide ${axis==='x'?'vertical':'horizontal'}`;
      if(axis==='x')line.style.left=`${(bleed+snap.value)*scale}px`;else line.style.top=`${(bleed+snap.value)*scale}px`;
      board.appendChild(line);
      const badge=document.createElement('span');badge.className='phase17-multi-guide-badge';badge.textContent=snap.label;
      if(axis==='x'){badge.style.left=line.style.left;badge.style.top='10px';}else{badge.style.top=line.style.top;badge.style.left='10px';}
      board.appendChild(badge);
    };
    add(xSnap,'x');add(ySnap,'y');
  }

  function persist(reason){
    const p=project();if(!p)return false;
    try{localStorage.setItem(DRAFT_KEY,JSON.stringify(p));}catch(_){}
    window.DesignEditorDraftScope?.saveCurrent?.(reason);
    const state=byId('saveState');if(state)state.textContent='자동 저장됨';return true;
  }

  function applyDelta(list,dx,dy){
    const p=project(),box=bounds(list);if(!p||!box)return false;
    const safeDx=clamp(Number(dx)||0,-box.left,Number(p.width)-box.right),safeDy=clamp(Number(dy)||0,-box.top,Number(p.height)-box.bottom);
    if(Math.abs(safeDx)<.0001&&Math.abs(safeDy)<.0001)return false;
    list.forEach(record=>{record.item.x=(Number(record.item.x)||0)+safeDx;record.item.y=(Number(record.item.y)||0)+safeDy;applyNodePosition(record);});
    multi()?.sync?.();return true;
  }

  function snapSelection(force=false){
    if(!enabled||(!force&&!dragActive))return false;
    const list=selectedRecords().filter(record=>!record.item.locked);if(!list.length)return false;
    const box=bounds(list);if(!box)return false;
    const others=otherRects(list),xSnap=bestSnap(box,others,'x'),ySnap=bestSnap(box,others,'y');
    if(!xSnap&&!ySnap){clearGuides();return false;}
    const changed=applyDelta(list,xSnap?.delta||0,ySnap?.delta||0);showGuides(xSnap,ySnap);
    document.documentElement.dataset.designMultiSmartSnap=[xSnap?'x':'',ySnap?'y':''].filter(Boolean).join('-')||'guide';
    return changed||Boolean(xSnap||ySnap);
  }

  function currentGap(axis){
    const list=selectedRecords().filter(record=>!record.item.locked);if(list.length<2)return 0;
    const horizontal=axis==='horizontal';
    const sorted=[...list].sort((a,b)=>{const ad=dimensions(a),bd=dimensions(b);return horizontal?ad.x-bd.x:ad.y-bd.y;});
    let total=0,count=0;
    for(let index=1;index<sorted.length;index++){
      const prev=dimensions(sorted[index-1]),next=dimensions(sorted[index]);
      total+=(horizontal?next.x-(prev.x+prev.w):next.y-(prev.y+prev.h));count++;
    }
    return Math.max(0,round1(count?total/count:0));
  }

  function setExactGap(axis,value){
    const p=project(),list=selectedRecords().filter(record=>!record.item.locked);if(!p||list.length<2)return false;
    const horizontal=axis==='horizontal',gap=Math.max(0,Number(value)||0),span=horizontal?Number(p.width)||0:Number(p.height)||0;
    const sorted=[...list].sort((a,b)=>{const ad=dimensions(a),bd=dimensions(b);return horizontal?ad.x-bd.x:ad.y-bd.y;});
    const totalSize=sorted.reduce((sum,record)=>{const d=dimensions(record);return sum+(horizontal?d.w:d.h);},0);
    const required=totalSize+gap*(sorted.length-1),maxGap=Math.max(0,(span-totalSize)/(sorted.length-1));
    if(required>span+.001){setStatus(`${horizontal?'가로':'세로'} 간격은 현재 선택에서 최대 ${round1(maxGap)}mm까지 가능합니다.`,'err');syncControls();return false;}
    const first=dimensions(sorted[0]),preferredStart=horizontal?first.x:first.y;let cursor=clamp(preferredStart,0,Math.max(0,span-required));
    sorted.forEach(record=>{const d=dimensions(record);if(horizontal)record.item.x=cursor;else record.item.y=cursor;applyNodePosition(record);cursor+=(horizontal?d.w:d.h)+gap;});
    persist(horizontal?'multi-exact-gap-horizontal':'multi-exact-gap-vertical');multi()?.sync?.();window.DesignEditorWorkflowV2?.activateStep?.('arrange',false);
    setStatus(`${sorted.length}개 요소의 ${horizontal?'가로':'세로'} 간격을 ${round1(gap)}mm로 맞췄습니다.`,'ok');syncControls();return true;
  }

  function toggleEnabled(force){
    enabled=typeof force==='boolean'?force:!enabled;
    try{localStorage.setItem(PREF_KEY,enabled?'on':'off');}catch(_){}
    if(!enabled)clearGuides();syncControls();
    setStatus(enabled?'스마트 가이드를 켰습니다. Alt를 누르면 잠시 해제됩니다.':'스마트 가이드를 껐습니다.','info');return enabled;
  }

  function ensureStyles(){
    if(byId(STYLE_ID))return;
    const style=document.createElement('style');style.id=STYLE_ID;style.textContent=`
      .phase17-multi-guide{position:absolute;z-index:149;pointer-events:none;background:#d11a78;opacity:.88}.phase17-multi-guide.vertical{top:0;bottom:0;width:1px}.phase17-multi-guide.horizontal{left:0;right:0;height:1px}
      .phase17-multi-guide-badge{position:absolute;z-index:150;pointer-events:none;transform:translate(-50%,-50%);border-radius:999px;background:#b31869;color:#fff;padding:3px 6px;font-size:6.5px;font-weight:900;white-space:nowrap;box-shadow:0 2px 8px rgba(15,23,42,.18)}
      #${CONTROLS_ID}{display:flex;align-items:center;gap:3px;flex:0 0 auto}.design-multi-smart-toggle{height:29px;border:1px solid #cbb9db;border-radius:7px;background:#fff;color:#6b3b89;padding:0 7px;font-size:7.5px;font-weight:900;cursor:pointer}.design-multi-smart-toggle.on{border-color:#b68bd2;background:#f6edff;color:#6c2f91}
      .design-multi-gap-field{height:29px;display:flex;align-items:center;gap:3px;border:1px solid #d2deea;border-radius:7px;background:#fff;padding:0 5px;color:#526174}.design-multi-gap-field>span{font-size:8px;font-weight:950}.design-multi-gap-field input{width:43px;height:23px;border:0;outline:0;background:transparent;color:#334155;text-align:right;font-size:8px;font-weight:900}.design-multi-gap-field em{font-size:6.5px;font-style:normal;color:#94a3b8}.design-multi-gap-apply{height:29px;border:1px solid #d2deea;border-radius:7px;background:#fff;color:#526174;padding:0 6px;font-size:7.5px;font-weight:900;cursor:pointer}
      .design-multi-gap-apply:hover,.design-multi-smart-toggle:hover{border-color:#9fafd0;background:#f6f8ff}@media(max-width:700px){#${CONTROLS_ID} .design-multi-gap-apply{display:none}.design-multi-gap-field input{width:38px}.design-multi-smart-toggle{padding:0 6px}}
    `;document.head.appendChild(style);
  }

  function syncControls(){
    const controls=byId(CONTROLS_ID);if(!controls)return false;
    const toggle=controls.querySelector('[data-multi-smart-toggle]');
    if(toggle){
      toggle.classList.toggle('on',enabled);
      const pressed=String(enabled),label=enabled?'자석 ON':'자석 OFF';
      if(toggle.getAttribute('aria-pressed')!==pressed)toggle.setAttribute('aria-pressed',pressed);
      if(toggle.textContent!==label)toggle.textContent=label;
    }
    controls.querySelectorAll('[data-multi-exact-gap]').forEach(input=>{
      if(document.activeElement===input)return;
      const value=String(currentGap(input.dataset.multiExactGap));
      if(input.value!==value)input.value=value;
    });
    return true;
  }

  function decorateBar(){
    const bar=byId('designMultiSelectionContextbar');if(!bar)return false;
    if(byId(CONTROLS_ID)){syncControls();return true;}
    const distribute=bar.querySelector('[data-multi-section="distribute"]');if(!distribute)return false;
    const sep=document.createElement('span');sep.className='design-multi-sep';sep.dataset.multiSmartSep='phase17';sep.setAttribute('aria-hidden','true');
    const controls=document.createElement('div');controls.id=CONTROLS_ID;controls.setAttribute('aria-label','스마트 가이드와 정확한 간격');
    controls.innerHTML=`<button type="button" class="design-multi-smart-toggle" data-multi-smart-toggle title="스마트 가이드 켜기/끄기 · 드래그 중 Alt로 잠시 해제">자석 ON</button><label class="design-multi-gap-field" title="선택 요소 가로 간격"><span>↔</span><input data-multi-exact-gap="horizontal" type="number" min="0" step="0.5" aria-label="가로 간격 mm"><em>mm</em></label><button type="button" class="design-multi-gap-apply" data-multi-gap-apply="horizontal">적용</button><label class="design-multi-gap-field" title="선택 요소 세로 간격"><span>↕</span><input data-multi-exact-gap="vertical" type="number" min="0" step="0.5" aria-label="세로 간격 mm"><em>mm</em></label><button type="button" class="design-multi-gap-apply" data-multi-gap-apply="vertical">적용</button>`;
    distribute.insertAdjacentElement('afterend',sep);sep.insertAdjacentElement('afterend',controls);
    controls.addEventListener('pointerdown',event=>event.stopPropagation());
    controls.addEventListener('click',event=>{event.stopPropagation();if(event.target.closest('[data-multi-smart-toggle]')){toggleEnabled();return;}const button=event.target.closest('[data-multi-gap-apply]');if(!button)return;const axis=button.dataset.multiGapApply,input=controls.querySelector(`[data-multi-exact-gap="${axis}"]`);setExactGap(axis,input?.value);});
    controls.addEventListener('keydown',event=>{const input=event.target.closest('[data-multi-exact-gap]');if(!input)return;if(event.key==='Enter'){event.preventDefault();event.stopPropagation();setExactGap(input.dataset.multiExactGap,input.value);}else if(event.key==='Escape')input.blur();});
    syncControls();return true;
  }

  function trackPointerDown(event){
    if(event.button!==0||event.altKey)return;
    const api=multi();if(!api||(api.records||[]).length<2)return;
    const node=event.target?.closest?.('.ps-multi-selected');
    if(!node||event.target?.closest?.('.phase3-resize-handle,.phase12-rotation-handle,#designMultiSelectionContextbar'))return;
    dragActive=true;dragPointerId=event.pointerId;clearGuides();
  }

  function trackPointerMove(event){
    if(!dragActive||event.pointerId!==dragPointerId)return;
    if(event.altKey){clearGuides();return;}
    if(moveFrame)return;
    moveFrame=requestAnimationFrame(()=>{moveFrame=0;snapSelection(false);});
  }

  function finishPointer(event){
    if(!dragActive||event.pointerId!==dragPointerId)return;
    dragActive=false;dragPointerId=null;
    if(moveFrame){cancelAnimationFrame(moveFrame);moveFrame=0;}
    requestAnimationFrame(()=>{if(enabled&&!event.altKey&&snapSelection(true))persist('multi-smart-snap');clearGuides(520);syncControls();});
  }

  function bindEvents(){
    window.addEventListener('pointerdown',trackPointerDown,true);window.addEventListener('pointermove',trackPointerMove,true);window.addEventListener('pointerup',finishPointer,true);window.addEventListener('pointercancel',finishPointer,true);
    ['click','change','keyup'].forEach(name=>document.addEventListener(name,()=>requestAnimationFrame(()=>{decorateBar();syncControls();}),false));
    window.addEventListener('resize',()=>{clearGuides();syncControls();},{passive:true});
    if(typeof MutationObserver==='function'&&!observer){observer=new MutationObserver(()=>decorateBar());observer.observe(document.body,{childList:true,subtree:true});}
  }

  function sync(){decorateBar();syncControls();return true;}

  function install(){
    if(installed)return true;
    if(!byId('artboard')||!multi())return false;
    installed=true;ensureStyles();decorateBar();bindEvents();
    window.DesignEditorMultiSmartGuides={sync,snapNow:()=>snapSelection(true),setExactGap,toggleEnabled,get enabled(){return enabled;},stage:'multi-smart-guides-exact-gap-v1'};
    return true;
  }

  function boot(){if(install())return;[120,320,700,1300,2300,3600].forEach(delay=>setTimeout(install,delay));}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
