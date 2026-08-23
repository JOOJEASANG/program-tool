(function(){
  'use strict';
  if(window.__designEditorEmbeddedPolishV1)return;
  window.__designEditorEmbeddedPolishV1=true;

  const params=new URLSearchParams(location.search);
  const embedded=params.get('embed')==='1';
  const path=location.pathname.replace(/\/+$/,'')||'/';
  const isGeneral=path==='/design-editor/general.html'||path==='/design-editor/index.html'||path.endsWith('/design-editor/general.html')||path.endsWith('/design-editor/index.html');
  if(!embedded||!isGeneral)return;

  const STYLE_ID='designEditorEmbeddedPolishStyles';
  const MENU_ID='designEditorMouseContextMenu';
  const SHAPE_STROKE_MODE_ID='designShapeStrokeMode';
  const COVER_ONLY_IDS=Object.freeze(['designCoverSettingsTools','designCoverSpineTools','designCoverPreviewZoneTools']);
  const MODE_CAPABILITIES=Object.freeze({
    cover:Object.freeze(['common','cover']),
    poster:Object.freeze(['common']),
    flyer:Object.freeze(['common']),
    leaflet2:Object.freeze(['common','fold']),
    leaflet3:Object.freeze(['common','fold']),
    custom:Object.freeze(['common'])
  });
  let installed=false;
  let refreshTimer=0;
  let sidebarObserver=null;
  let pinning=false;

  const byId=id=>document.getElementById(id);
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const project=()=>window.DesignEditorApp?.project||null;
  const selectedNode=()=>document.querySelector('.phase2-extra-object.selected,.design-text.selected');
  const hasCoverMouse=()=>project()?.designMode==='cover'&&window.DesignEditorCoverPreviewZones?.stage==='preview-zones-wheel-and-context-menu';

  function installStyles(){
    if(document.getElementById(STYLE_ID))return;
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      html[data-design-embedded="1"] .start-screen{display:none!important}
      html[data-design-embedded="1"] #newDesignBtn{display:none!important}
      html[data-design-embedded="1"] .sidebar>#designEmbeddedModeCard{order:-9999!important;position:sticky!important;top:0!important;z-index:900!important;box-shadow:0 8px 18px rgba(15,23,42,.08)!important}
      [data-design-capability][hidden]{display:none!important}
      .design-mode-btn.has-saved{position:relative;padding-right:12px!important}
      .design-mode-btn.has-saved::after{content:'';position:absolute;right:5px;top:5px;width:5px;height:5px;border-radius:50%;background:currentColor;opacity:.8}
      .design-mode-save-hint{display:flex;align-items:center;gap:5px;margin-top:6px;padding:5px 6px;border-radius:6px;background:#eef8f8;color:#0f6f78;font-size:7px;font-weight:850;line-height:1.35}
      .design-mode-save-hint::before{content:'✓';font-size:8px;font-weight:950}
      .design-mouse-menu{position:fixed;z-index:12000;min-width:182px;padding:5px;border:1px solid #cbd5e1;border-radius:10px;background:#fff;box-shadow:0 16px 42px rgba(15,23,42,.24);font-size:8px;color:#334155}
      .design-mouse-menu[hidden]{display:none!important}.design-mouse-menu-title{padding:5px 7px 4px;color:#64748b;font-size:7px;font-weight:950}.design-mouse-menu-sep{height:1px;background:#e5e7eb;margin:4px 2px}
      .design-mouse-menu button{display:flex;width:100%;align-items:center;justify-content:space-between;gap:12px;border:0;border-radius:6px;background:#fff;padding:7px 8px;color:#334155;font-size:8px;font-weight:850;text-align:left;cursor:pointer}.design-mouse-menu button:hover{background:#f0f9ff;color:#0f6070}.design-mouse-menu button.danger{color:#b42318}.design-mouse-menu small{color:#94a3b8;font-size:6.5px;font-weight:700}
      .design-shape-stroke-field{margin-top:7px}.design-shape-stroke-disabled{display:none!important}
    `;
    document.head.appendChild(style);
  }

  function modeForPreset(presetId){
    const id=String(presetId||'');
    if(id==='cover-a4')return 'cover';
    if(id.startsWith('poster-'))return 'poster';
    if(id.startsWith('flyer-'))return 'flyer';
    if(id==='leaflet-2')return 'leaflet2';
    if(id.startsWith('leaflet-3-'))return 'leaflet3';
    if(id==='custom')return 'custom';
    return '';
  }

  function savedModes(){
    const list=window.DesignEditorDraftScope?.listDrafts?.();
    if(!Array.isArray(list))return new Set();
    return new Set(list.map(item=>modeForPreset(item?.presetId)).filter(Boolean));
  }

  function currentMode(){
    const p=project();
    const projectMode=String(p?.designMode||modeForPreset(p?.presetId)||'');
    if(projectMode&&MODE_CAPABILITIES[projectMode])return projectMode;
    const button=document.querySelector('#designEmbeddedModeCard .design-mode-btn.on');
    const buttonMode=button?.dataset.designMode||'';
    if(buttonMode&&MODE_CAPABILITIES[buttonMode])return buttonMode;
    const queryMode=String(params.get('mode')||'');
    return MODE_CAPABILITIES[queryMode]?queryMode:'custom';
  }

  function supportsCapability(capability,mode=currentMode()){
    return (MODE_CAPABILITIES[mode]||MODE_CAPABILITIES.custom).includes(capability);
  }

  function syncCapabilityVisibility(){
    const mode=currentMode();
    document.documentElement.dataset.activeDesignMode=mode;
    COVER_ONLY_IDS.forEach(id=>{
      const node=byId(id);if(!node)return;
      node.dataset.designCapability='cover';
    });
    document.querySelectorAll('[data-design-capability]').forEach(node=>{
      const required=String(node.dataset.designCapability||'common').split(/\s+/).filter(Boolean);
      const visible=required.some(capability=>supportsCapability(capability,mode));
      node.hidden=!visible;
      node.setAttribute('aria-hidden',visible?'false':'true');
    });
    const sidebar=document.querySelector('.sidebar');if(sidebar)sidebar.dataset.activeDesignMode=mode;
    return mode;
  }

  function keepModeCardFirst(){
    if(pinning)return false;
    const sidebar=document.querySelector('.sidebar'),card=document.getElementById('designEmbeddedModeCard');
    if(!sidebar||!card||card.parentElement!==sidebar)return false;
    if(sidebar.firstElementChild!==card){
      pinning=true;
      try{sidebar.insertBefore(card,sidebar.firstElementChild);}finally{pinning=false;}
    }
    sidebar.dataset.designModeCardPinned='top';
    return true;
  }

  function observeSidebar(){
    const sidebar=document.querySelector('.sidebar');
    if(!sidebar||typeof MutationObserver!=='function'||sidebarObserver)return;
    sidebarObserver=new MutationObserver(()=>requestAnimationFrame(()=>{keepModeCardFirst();decorateModeCard();syncCapabilityVisibility();syncShapeStrokeControls();applyShapeStrokeVisuals();}));
    sidebarObserver.observe(sidebar,{childList:true});
  }

  function decorateModeCard(){
    keepModeCardFirst();
    const card=document.getElementById('designEmbeddedModeCard');
    if(!card)return false;
    const modes=savedModes();
    card.querySelectorAll('[data-design-mode]').forEach(button=>{
      const hasSaved=modes.has(button.dataset.designMode);
      button.classList.toggle('has-saved',hasSaved);
      if(hasSaved)button.title='자동 저장된 작업 있음';else button.removeAttribute('title');
    });

    let hint=card.querySelector('.design-mode-save-hint');
    const hasCurrent=modes.has(currentMode());
    if(hasCurrent&&!hint){
      hint=document.createElement('div');hint.className='design-mode-save-hint';hint.textContent='이 작업 종류는 자동 저장되어 다시 돌아와도 이어서 작업할 수 있습니다.';
      card.appendChild(hint);
    }else if(!hasCurrent&&hint){
      hint.remove();
    }
    return true;
  }

  function activeSurface(){
    const p=project();if(!p)return null;
    return p.surfaces?.find(item=>item.id===p.activeSurface)||p.surfaces?.[0]||null;
  }

  function selectedShape(){
    const id=document.querySelector('.phase2-extra-object.selected')?.dataset?.extraId;
    if(!id)return null;
    return activeSurface()?.extras?.find(item=>item.id===id&&item.type==='shape')||null;
  }

  function persistShapeStyle(source='shape-stroke-mode'){
    const p=project();if(!p)return;
    try{localStorage.setItem('programTool.designEditor.draft.v1',JSON.stringify(p));}catch(_){}
    window.DesignEditorDraftScope?.saveCurrent?.(source);
  }

  function applyShapeStrokeVisuals(){
    const surface=activeSurface();if(!surface)return false;
    document.querySelectorAll('.phase2-extra-object[data-extra-id]').forEach(node=>{
      const item=surface.extras?.find(entry=>entry.id===node.dataset.extraId&&entry.type==='shape');
      if(!item||item.shape==='line')return;
      const inner=node.querySelector('.phase2-shape-inner');if(!inner)return;
      const enabled=item.strokeEnabled!==false;
      node.dataset.strokeEnabled=String(enabled);
      if(!enabled)inner.style.border='none';
    });
    return true;
  }

  function syncShapeStrokeControls(){
    const root=byId('inspector'),item=selectedShape();if(!root)return false;
    const oldField=byId(`${SHAPE_STROKE_MODE_ID}Field`);
    const strokeControls=[...root.querySelectorAll('[data-extra-field="stroke"]')];
    strokeControls.forEach(control=>{const field=control.closest('.field');if(field)field.hidden=false;});
    const widthControl=root.querySelector('[data-extra-field="strokeWidth"]');
    if(widthControl?.closest('.field'))widthControl.closest('.field').hidden=false;

    if(!item){oldField?.remove();return false;}
    if(item.shape==='line'){
      oldField?.remove();
      strokeControls.slice(1).forEach(control=>{const field=control.closest('.field');if(field)field.hidden=true;});
      return true;
    }

    let field=oldField;
    if(!field){
      field=document.createElement('div');field.id=`${SHAPE_STROKE_MODE_ID}Field`;field.className='field design-shape-stroke-field';
      field.innerHTML=`<label for="${SHAPE_STROKE_MODE_ID}">테두리</label><select id="${SHAPE_STROKE_MODE_ID}"><option value="on">있음</option><option value="none">없음</option></select>`;
      const strokeField=strokeControls[0]?.closest('.field');
      if(strokeField?.parentElement)strokeField.parentElement.insertBefore(field,strokeField);else root.appendChild(field);
      byId(SHAPE_STROKE_MODE_ID)?.addEventListener('change',event=>{
        const current=selectedShape();if(!current||current.shape==='line')return;
        current.strokeEnabled=event.target.value!=='none';
        persistShapeStyle();
        window.DesignEditorPhase2?.sync?.();
        setTimeout(()=>{syncShapeStrokeControls();applyShapeStrokeVisuals();},0);
      });
    }
    const enabled=item.strokeEnabled!==false;
    const control=byId(SHAPE_STROKE_MODE_ID);if(control)control.value=enabled?'on':'none';
    strokeControls.forEach(stroke=>{const target=stroke.closest('.field');if(target)target.hidden=!enabled;});
    if(widthControl?.closest('.field'))widthControl.closest('.field').hidden=!enabled;
    return true;
  }

  function installShapeOutputGuard(){
    const output=window.DesignEditorOutput;
    if(!output||typeof output.renderSurface!=='function')return false;
    if(output.renderSurface.__shapeStrokeNoneGuard)return true;
    const original=output.renderSurface.bind(output);
    const wrapped=async(p,surface,...rest)=>{
      const patched=surface&&Array.isArray(surface.extras)?{
        ...surface,
        extras:surface.extras.map(item=>item?.type==='shape'&&item.shape!=='line'&&item.strokeEnabled===false?{...item,stroke:'rgba(0,0,0,0)'}:item)
      }:surface;
      return original(p,patched,...rest);
    };
    wrapped.__shapeStrokeNoneGuard=true;wrapped.__delegate=original;
    output.renderSurface=wrapped;
    return true;
  }

  function ensureMenu(){
    let menu=byId(MENU_ID);if(menu)return menu;
    menu=document.createElement('div');menu.id=MENU_ID;menu.className='design-mouse-menu';menu.hidden=true;menu.setAttribute('role','menu');document.body.appendChild(menu);return menu;
  }
  function closeMenu(){const menu=byId(MENU_ID);if(menu){menu.hidden=true;menu.replaceChildren();}}
  function menuButton(label,action,hint='',danger=false){
    const button=document.createElement('button');button.type='button';button.innerHTML=`<span>${label}</span>${hint?`<small>${hint}</small>`:''}`;if(danger)button.classList.add('danger');button.addEventListener('click',()=>{closeMenu();action();});return button;
  }
  function menuSep(){const node=document.createElement('div');node.className='design-mouse-menu-sep';return node;}
  function clickFirst(...ids){for(const id of ids){const node=byId(id);if(node){node.click();return true;}}return false;}
  function selectTarget(target){
    const node=target?.closest?.('.phase2-extra-object,.design-text');if(!node)return null;
    node.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,view:window}));return node;
  }
  function toggleLock(){
    const control=byId('phase2ExtraLock')||byId('lockInput');if(!control)return false;
    control.checked=!control.checked;control.dispatchEvent(new Event('change',{bubbles:true}));return true;
  }
  function align(direction){window.DesignEditorPhase3Controls?.alignSelected?.(direction);}

  function showContextMenu(event){
    if(hasCoverMouse())return;
    const artboard=byId('artboard');if(!artboard||!event.target?.closest?.('#artboard'))return;
    event.preventDefault();event.stopPropagation();const target=selectTarget(event.target),menu=ensureMenu();menu.replaceChildren();
    const title=document.createElement('div');title.className='design-mouse-menu-title';title.textContent=target?'선택 요소 빠른 작업':'작업영역 빠른 메뉴';menu.appendChild(title);
    if(target){
      menu.appendChild(menuButton('복사',()=>window.DesignEditorElementClipboard?.copySelected?.(),'Ctrl+C'));
      menu.appendChild(menuButton('복제',()=>clickFirst('phase2ExtraDuplicate','duplicateBtn'),'Ctrl+D'));
      menu.appendChild(menuButton('앞으로',()=>clickFirst('phase2ExtraFront','layerFrontBtn')));menu.appendChild(menuButton('뒤로',()=>clickFirst('phase2ExtraBack','layerBackBtn')));
      menu.appendChild(menuSep());menu.appendChild(menuButton('가로 가운데 정렬',()=>align('center')));menu.appendChild(menuButton('세로 가운데 정렬',()=>align('middle')));menu.appendChild(menuButton('잠금 / 잠금 해제',toggleLock));
      menu.appendChild(menuSep());menu.appendChild(menuButton('삭제',()=>clickFirst('phase2ExtraDelete','deleteBtn'),'Delete',true));
    }else{
      menu.appendChild(menuButton('메인 제목 추가',()=>byId('addTitleBtn')?.click()));menu.appendChild(menuButton('본문 글씨 추가',()=>byId('addBodyBtn')?.click()));
      menu.appendChild(menuSep());menu.appendChild(menuButton('실행 취소',()=>byId('phase3Undo')?.click(),'Ctrl+Z'));menu.appendChild(menuButton('다시 실행',()=>byId('phase3Redo')?.click(),'Ctrl+Y'));
    }
    menu.hidden=false;const margin=8,width=Math.max(182,menu.offsetWidth),height=Math.max(40,menu.offsetHeight);menu.style.left=`${Math.round(clamp(event.clientX,margin,window.innerWidth-width-margin))}px`;menu.style.top=`${Math.round(clamp(event.clientY,margin,window.innerHeight-height-margin))}px`;
  }

  function dispatchNudge(event){
    if(!selectedNode())return false;
    const horizontal=event.shiftKey;const key=horizontal?(event.deltaY>0?'ArrowRight':'ArrowLeft'):(event.deltaY>0?'ArrowDown':'ArrowUp');
    document.dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true,cancelable:true}));return true;
  }
  function scaleSelected(event){
    const direction=event.deltaY<0?1:-1,node=selectedNode();if(!node)return false;
    if(node.classList.contains('design-text')){
      const control=byId('sizeInput');if(!control)return false;
      control.value=String(clamp((Number(control.value)||11)+direction,6,120));control.dispatchEvent(new Event('input',{bubbles:true}));return true;
    }
    const width=byId('inspector')?.querySelector('[data-extra-field="w"]'),height=byId('inspector')?.querySelector('[data-extra-field="h"]');if(!width||!height)return false;
    const w=Math.max(1,Number(width.value)||1),h=Math.max(.5,Number(height.value)||.5),ratio=h/w,nextW=Math.max(1,w+direction),nextH=Math.max(.5,nextW*ratio);
    width.value=String(Math.round(nextW*10)/10);width.dispatchEvent(new Event('input',{bubbles:true}));height.value=String(Math.round(nextH*10)/10);height.dispatchEvent(new Event('input',{bubbles:true}));return true;
  }
  function handleWheel(event){
    if(hasCoverMouse())return;
    const view=byId('artboardViewport');if(!view||!event.target?.closest?.('#artboardViewport'))return;
    if((event.ctrlKey||event.metaKey)&&selectedNode()){
      if(scaleSelected(event)){event.preventDefault();closeMenu();}return;
    }
    if(event.altKey&&selectedNode()){
      if(dispatchNudge(event)){event.preventDefault();closeMenu();}return;
    }
    if(event.shiftKey&&Math.abs(event.deltaY)>Math.abs(event.deltaX)){
      event.preventDefault();view.scrollLeft+=event.deltaY;closeMenu();
    }
  }

  function bindMouse(){
    ensureMenu();document.addEventListener('contextmenu',showContextMenu,true);
    byId('artboardViewport')?.addEventListener('wheel',handleWheel,{passive:false});byId('artboardViewport')?.addEventListener('scroll',closeMenu,{passive:true});
    document.addEventListener('pointerdown',event=>{if(event.button!==2&&!event.target?.closest?.(`#${MENU_ID}`))closeMenu();},true);document.addEventListener('keydown',event=>{if(event.key==='Escape')closeMenu();},true);
  }

  function queueRefresh(){
    clearTimeout(refreshTimer);
    refreshTimer=setTimeout(()=>{keepModeCardFirst();decorateModeCard();syncCapabilityVisibility();syncShapeStrokeControls();applyShapeStrokeVisuals();installShapeOutputGuard();},120);
  }

  function install(){
    if(installed)return true;
    installStyles();
    installed=true;
    ['input','change','pointerup','keyup','click'].forEach(name=>document.addEventListener(name,queueRefresh,false));
    window.addEventListener('pageshow',queueRefresh);
    observeSidebar();bindMouse();
    [80,220,480,900,1500,2400,3600].forEach(delay=>setTimeout(()=>{keepModeCardFirst();decorateModeCard();syncCapabilityVisibility();syncShapeStrokeControls();applyShapeStrokeVisuals();installShapeOutputGuard();observeSidebar();},delay));
    return true;
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();

  window.DesignEditorEmbeddedPolish={
    decorateModeCard,
    keepModeCardFirst,
    syncCapabilityVisibility,
    supportsCapability,
    syncShapeStrokeControls,
    applyShapeStrokeVisuals,
    installShapeOutputGuard,
    showContextMenu,
    closeMenu,
    scaleSelected,
    modeCapabilities:MODE_CAPABILITIES,
    stage:'mode-aware-sidebar-top-selector-mouse-and-optional-shape-stroke'
  };
})();
