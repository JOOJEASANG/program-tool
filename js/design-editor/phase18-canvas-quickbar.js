(function(){
  'use strict';
  if(window.__designEditorCanvasQuickbarV1)return;
  window.__designEditorCanvasQuickbarV1=true;
  if(new URLSearchParams(location.search).get('embed')!=='1')return;

  const BAR_ID='designCanvasQuickbar';
  const STYLE_ID='designCanvasQuickbarStyles';
  const DRAFT_KEY='programTool.designEditor.draft.v1';
  let installed=false;
  let syncTimer=0;

  const byId=id=>document.getElementById(id);
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const project=()=>window.DesignEditorApp?.project||null;
  function surface(){
    const p=project();
    return p?.surfaces?.find(item=>item.id===p.activeSurface)||p?.surfaces?.[0]||null;
  }

  function selectedRecord(){
    const current=surface();if(!current)return null;
    const extraNode=document.querySelector('.phase2-extra-object.selected');
    if(extraNode){
      const item=current.extras?.find(entry=>entry.id===extraNode.dataset.extraId);
      if(item)return{kind:item.type==='image'?'image':'shape',item,node:extraNode};
    }
    const textNode=document.querySelector('.design-text.selected');
    if(textNode){
      const item=current.elements?.find(entry=>entry.id===textNode.dataset.id&&entry.type==='text');
      if(item)return{kind:'text',item,node:textNode};
    }
    return null;
  }

  function persist(source='canvas-quickbar'){
    const p=project();if(!p)return;
    try{localStorage.setItem(DRAFT_KEY,JSON.stringify(p));}catch(_){}
    window.DesignEditorDraftScope?.saveCurrent?.(source);
    const state=byId('saveState');if(state)state.textContent='자동 저장됨';
  }

  function fire(control,eventName){
    if(!control)return false;
    control.dispatchEvent(new Event(eventName,{bubbles:true}));
    return true;
  }

  function installStyles(){
    if(byId(STYLE_ID))return;
    const style=document.createElement('style');style.id=STYLE_ID;style.textContent=`
      .canvas-quickbar{position:fixed;z-index:500;display:flex;align-items:center;gap:4px;max-width:calc(100vw - 16px);padding:5px;border:1px solid #d6e1ea;border-radius:10px;background:#fff;box-shadow:0 10px 28px #0f172a2b;transform:translateZ(0);white-space:nowrap}.canvas-quickbar.hidden{display:none!important}.canvas-quickbar-label{padding:0 5px;color:#64748b;font-size:8px;font-weight:950}.canvas-quickbar button,.canvas-quickbar select{height:28px;border:1px solid #d7e0e9;border-radius:7px;background:#fff;color:#475569;font-size:8px;font-weight:900;cursor:pointer}.canvas-quickbar button{min-width:28px;padding:0 7px}.canvas-quickbar button:hover,.canvas-quickbar select:hover{border-color:#79b9c8;background:#f0fdff}.canvas-quickbar button.on{border-color:#1d9bb2;background:#ecfeff;color:#0e7490}.canvas-quickbar select{max-width:80px;padding:0 5px}.canvas-quickbar input[type=color]{width:29px;height:28px;border:1px solid #d7e0e9;border-radius:7px;background:#fff;padding:3px;cursor:pointer}.canvas-quickbar-sep{width:1px;height:18px;background:#e4eaf0;margin:0 1px}.canvas-quickbar .canvas-quickbar-danger{color:#b42318}.canvas-quickbar-tip{position:absolute;left:50%;top:100%;width:8px;height:8px;background:#fff;border-right:1px solid #d6e1ea;border-bottom:1px solid #d6e1ea;transform:translate(-50%,-4px) rotate(45deg)}
      @media(max-width:620px){.canvas-quickbar{gap:3px;padding:4px}.canvas-quickbar-label{display:none}.canvas-quickbar button{padding:0 6px}.canvas-quickbar select{max-width:70px}}
    `;document.head.appendChild(style);
  }

  function ensureBar(){
    let bar=byId(BAR_ID);if(bar)return bar;
    bar=document.createElement('div');bar.id=BAR_ID;bar.className='canvas-quickbar hidden';bar.setAttribute('role','toolbar');bar.setAttribute('aria-label','선택 요소 빠른 편집');
    bar.addEventListener('pointerdown',event=>event.stopPropagation());
    bar.addEventListener('click',event=>event.stopPropagation());
    document.body.appendChild(bar);return bar;
  }

  function textMarkup(item){
    const style=item.titleStyle||'none';
    return `<span class="canvas-quickbar-label">글씨</span><button type="button" data-qb-action="bold" class="${Number(item.weight)>=700?'on':''}" title="굵게">B</button><button type="button" data-qb-align="left" class="${item.align==='left'?'on':''}" title="왼쪽 정렬">좌</button><button type="button" data-qb-align="center" class="${item.align==='center'?'on':''}" title="가운데 정렬">중</button><button type="button" data-qb-align="right" class="${item.align==='right'?'on':''}" title="오른쪽 정렬">우</button><span class="canvas-quickbar-sep"></span><input data-qb-color="text" type="color" value="${item.color||'#172033'}" title="글자 색상"><select data-qb-title-style title="타이틀 서식"><option value="none"${style==='none'?' selected':''}>기본</option><option value="bar"${style==='bar'?' selected':''}>세로 바</option><option value="pill"${style==='pill'?' selected':''}>라벨</option><option value="underline"${style==='underline'?' selected':''}>밑줄</option><option value="highlight"${style==='highlight'?' selected':''}>강조</option></select><span class="canvas-quickbar-sep"></span><button type="button" data-qb-layer="back" title="뒤로">뒤</button><button type="button" data-qb-layer="front" title="앞으로">앞</button>`;
  }

  function imageMarkup(item){
    return `<span class="canvas-quickbar-label">이미지</span><button type="button" data-qb-action="replace-image">교체</button><button type="button" data-qb-action="fit-image">${item.fit==='contain'?'전체':'채우기'}</button><span class="canvas-quickbar-sep"></span><button type="button" data-qb-layer="back">뒤로</button><button type="button" data-qb-layer="front">앞으로</button>`;
  }

  function shapeMarkup(item){
    const radius=Number(item.cornerRadius)||0;
    return `<span class="canvas-quickbar-label">도형</span>${item.shape!=='line'?`<input data-qb-color="fill" type="color" value="${item.fill||'#dceeff'}" title="채우기 색상">`:''}<input data-qb-color="stroke" type="color" value="${item.stroke||'#12396d'}" title="테두리 색상">${item.shape==='rect'?`<button type="button" data-qb-action="round-shape" class="${radius>0?'on':''}" title="모서리 둥글기">둥글기</button>`:''}<span class="canvas-quickbar-sep"></span><button type="button" data-qb-layer="back">뒤로</button><button type="button" data-qb-layer="front">앞으로</button>`;
  }

  function renderBar(record){
    const bar=ensureBar();
    if(!record||record.item.locked||!document.documentElement.contains(record.node)){bar.classList.add('hidden');bar.replaceChildren();return;}
    bar.innerHTML=(record.kind==='text'?textMarkup(record.item):record.kind==='image'?imageMarkup(record.item):shapeMarkup(record.item))+'<span class="canvas-quickbar-tip" aria-hidden="true"></span>';
    bindBarControls(bar);bar.classList.remove('hidden');positionBar(record.node,bar);
  }

  function positionBar(node,bar){
    const rect=node.getBoundingClientRect();if(!rect.width&&!rect.height){bar.classList.add('hidden');return;}
    const width=Math.max(120,bar.offsetWidth),height=Math.max(38,bar.offsetHeight),margin=8;
    let left=rect.left+rect.width/2-width/2;
    left=clamp(left,margin,Math.max(margin,window.innerWidth-width-margin));
    let top=rect.top-height-10;
    if(top<margin)top=Math.min(window.innerHeight-height-margin,rect.bottom+10);
    bar.style.left=`${Math.round(left)}px`;bar.style.top=`${Math.round(top)}px`;
  }

  function setTextWeight(record){
    const control=byId('weightInput');
    if(control){control.value=Number(record.item.weight)>=700?'500':'700';fire(control,'change');return;}
    record.item.weight=Number(record.item.weight)>=700?500:700;persist('quickbar-bold');
  }

  function setTextAlign(value,record){
    const button=byId('inspector')?.querySelector(`[data-align="${value}"]`);
    if(button){button.click();return;}
    record.item.align=value;persist('quickbar-align');
  }

  function setTextColor(value,record){
    const control=byId('colorInput');
    if(control){control.value=value;fire(control,'input');return;}
    record.item.color=value;persist('quickbar-text-color');
  }

  function setTitleStyle(value,record){
    const button=byId('inspector')?.querySelector(`[data-quick-title-style="${value}"]`);
    if(button){button.click();return;}
    record.item.titleStyle=value;record.item.titleAccent=record.item.titleAccent||'#1d9bb2';persist('quickbar-title-style');window.DesignEditorQuickDesign?.sync?.();
  }

  function setExtraField(field,value,eventName='input'){
    const control=byId('inspector')?.querySelector(`[data-extra-field="${field}"]`);
    if(!control)return false;
    control.value=value;fire(control,eventName);return true;
  }

  function setImageFit(record){
    const next=record.item.fit==='contain'?'cover':'contain';
    if(setExtraField('fit',next,'change'))return;
    record.item.fit=next;persist('quickbar-image-fit');window.DesignEditorPhase2?.sync?.();
  }

  function replaceImage(){byId('phase2ReplaceImage')?.click();}

  function setShapeColor(field,value,record){
    if(setExtraField(field,value,'input'))return;
    record.item[field]=value;persist('quickbar-shape-color');window.DesignEditorPhase2?.sync?.();
  }

  function roundShape(record){
    const item=record.item,max=Math.max(0,Math.min(Number(item.w)||0,Number(item.h)||0)/2),current=Number(item.cornerRadius)||0;
    const next=current<.2?Math.min(4,max):current<Math.min(9,max)?Math.min(10,max):current<max-.3?max:0;
    const control=byId('quickCornerRadius');
    if(control){control.value=String(next);fire(control,'input');fire(control,'change');return;}
    item.cornerRadius=next;persist('quickbar-corner-radius');window.DesignEditorPhase2?.sync?.();requestAnimationFrame(()=>window.DesignEditorQuickDesign?.sync?.());
  }

  function moveLayer(direction,record){
    const id=record.kind==='text'?(direction==='front'?'layerFrontBtn':'layerBackBtn'):(direction==='front'?'phase2ExtraFront':'phase2ExtraBack');
    byId(id)?.click();
  }

  function bindBarControls(bar){
    bar.querySelector('[data-qb-action="bold"]')?.addEventListener('click',()=>{const record=selectedRecord();if(record)setTextWeight(record);queueSync();});
    bar.querySelectorAll('[data-qb-align]').forEach(button=>button.addEventListener('click',()=>{const record=selectedRecord();if(record)setTextAlign(button.dataset.qbAlign,record);queueSync();}));
    bar.querySelector('[data-qb-color="text"]')?.addEventListener('input',event=>{const record=selectedRecord();if(record)setTextColor(event.target.value,record);});
    bar.querySelector('[data-qb-title-style]')?.addEventListener('change',event=>{const record=selectedRecord();if(record)setTitleStyle(event.target.value,record);queueSync();});
    bar.querySelector('[data-qb-action="replace-image"]')?.addEventListener('click',()=>replaceImage());
    bar.querySelector('[data-qb-action="fit-image"]')?.addEventListener('click',()=>{const record=selectedRecord();if(record)setImageFit(record);queueSync();});
    bar.querySelector('[data-qb-action="round-shape"]')?.addEventListener('click',()=>{const record=selectedRecord();if(record)roundShape(record);queueSync();});
    bar.querySelectorAll('[data-qb-color="fill"],[data-qb-color="stroke"]').forEach(input=>input.addEventListener('input',event=>{const record=selectedRecord();if(record)setShapeColor(input.dataset.qbColor,event.target.value,record);}));
    bar.querySelectorAll('[data-qb-layer]').forEach(button=>button.addEventListener('click',()=>{const record=selectedRecord();if(record)moveLayer(button.dataset.qbLayer,record);queueSync();}));
  }

  function sync(){
    if(!project()||byId('editorShell')?.classList.contains('hidden'))return ensureBar().classList.add('hidden');
    renderBar(selectedRecord());
  }
  function queueSync(){clearTimeout(syncTimer);syncTimer=setTimeout(()=>requestAnimationFrame(sync),24);}

  function bindEvents(){
    ['click','dblclick','change','keyup','pointerup'].forEach(name=>document.addEventListener(name,event=>{if(event.target?.closest?.(`#${BAR_ID}`))return;queueSync();},false));
    document.addEventListener('input',event=>{if(event.target?.closest?.(`#${BAR_ID}`))return;queueSync();},false);
    window.addEventListener('resize',queueSync,{passive:true});
    byId('artboardViewport')?.addEventListener('scroll',queueSync,{passive:true});
  }

  function install(){
    if(installed)return true;
    if(!byId('artboard')||!byId('inspector')||!window.DesignEditorApp)return false;
    installed=true;installStyles();ensureBar();bindEvents();
    window.DesignEditorCanvasQuickbar={sync,stage:'contextual-canvas-quick-toolbar'};
    [120,350,750,1300,2200].forEach(delay=>setTimeout(queueSync,delay));
    return true;
  }
  function boot(){if(install())return;[180,420,850,1500,2600].forEach(delay=>setTimeout(install,delay));}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
