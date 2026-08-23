(function(){
  'use strict';
  if(window.__designEditorCoverPreviewZonesV1)return;
  window.__designEditorCoverPreviewZonesV1=true;

  const params=new URLSearchParams(location.search);
  if(params.get('embed')!=='1'||params.get('mode')!=='cover')return;

  const OVERLAY_ID='designCoverPreviewZones';
  const CARD_ID='designCoverPreviewZoneTools';
  const MENU_ID='designCoverContextMenu';
  const STYLE_ID='designCoverPreviewZoneStyles';
  const PREF_KEY='programTool.designEditor.coverPreviewZones.v1';
  const DEFAULTS={visible:true,labels:true,safe:true,opacity:12,zoom:1};
  let prefs=readPrefs();
  let frame=0;
  let installed=false;

  const byId=id=>document.getElementById(id);
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const project=()=>window.DesignEditorApp?.project||null;
  const isCover=()=>project()?.designMode==='cover'&&project()?.cover;

  function readPrefs(){
    try{return {...DEFAULTS,...JSON.parse(localStorage.getItem(PREF_KEY)||'{}')};}catch(_){return {...DEFAULTS};}
  }
  function normalizePrefs(){
    prefs.visible=prefs.visible!==false;prefs.labels=prefs.labels!==false;prefs.safe=prefs.safe!==false;
    prefs.opacity=clamp(Number(prefs.opacity)||0,0,35);prefs.zoom=clamp(Number(prefs.zoom)||1,.5,2.5);
  }
  function savePrefs(){try{localStorage.setItem(PREF_KEY,JSON.stringify(prefs));}catch(_){} }
  function setPrefs(next={}){
    prefs={...prefs,...next};normalizePrefs();savePrefs();applyZoom();render();syncControls();return {...prefs};
  }

  function installStyles(){
    if(byId(STYLE_ID))return;
    const style=document.createElement('style');style.id=STYLE_ID;style.textContent=`
      #${OVERLAY_ID}{position:absolute;inset:0;z-index:22;pointer-events:none;overflow:hidden}
      #${OVERLAY_ID}[hidden]{display:none!important}
      .cover-preview-zone{position:absolute;box-sizing:border-box;border:1px solid rgba(15,118,110,.38);background:rgba(14,165,233,var(--zone-opacity,.12));overflow:hidden}
      .cover-preview-zone[data-zone="spine"]{background:rgba(16,185,129,var(--zone-opacity,.12));border-color:rgba(5,150,105,.55)}
      .cover-preview-zone[data-zone="front"]{background:rgba(99,102,241,var(--zone-opacity,.12));border-color:rgba(79,70,229,.42)}
      .cover-preview-zone-label{position:absolute;top:5px;left:50%;transform:translateX(-50%);max-width:90%;padding:2px 5px;border-radius:999px;background:rgba(255,255,255,.88);border:1px solid rgba(148,163,184,.55);font-size:7px;font-weight:950;line-height:1.2;color:#334155;white-space:nowrap}
      .cover-preview-zone-safe{position:absolute;box-sizing:border-box;border:1px dashed rgba(220,38,38,.72);background:transparent}
      .cover-preview-zone-safe[data-zone="spine"]{border-color:rgba(217,119,6,.9)}
      .cover-preview-zone-tools{border-color:#c7d2fe!important;background:#fbfcff!important}
      .cover-preview-zone-row{display:flex;align-items:center;gap:6px;margin:5px 0;font-size:7.5px;font-weight:850;color:#475569}
      .cover-preview-zone-row input[type="checkbox"]{margin:0}
      .cover-preview-zone-opacity{display:grid;grid-template-columns:auto 1fr 36px;align-items:center;gap:6px;margin-top:6px;font-size:7.5px;font-weight:850;color:#475569}
      .cover-preview-zone-opacity input{width:100%}.cover-preview-zone-opacity output{text-align:right;color:#0f766e;font-weight:950}
      .cover-preview-zone-note{font-size:7px;line-height:1.55;color:#64748b;margin-top:7px}
      .cover-preview-zone-note kbd{display:inline-block;padding:1px 4px;border:1px solid #cbd5e1;border-bottom-width:2px;border-radius:4px;background:#fff;color:#475569;font:700 6.5px/1.4 Arial,sans-serif}
      .cover-context-menu{position:fixed;z-index:12000;min-width:178px;padding:5px;border:1px solid #cbd5e1;border-radius:10px;background:#fff;box-shadow:0 16px 42px rgba(15,23,42,.24);font-size:8px;color:#334155}
      .cover-context-menu[hidden]{display:none!important}.cover-context-menu-title{padding:5px 7px 4px;color:#64748b;font-size:7px;font-weight:950}.cover-context-menu-sep{height:1px;background:#e5e7eb;margin:4px 2px}
      .cover-context-menu button{display:flex;width:100%;align-items:center;justify-content:space-between;gap:12px;border:0;border-radius:6px;background:#fff;padding:7px 8px;color:#334155;font-size:8px;font-weight:850;text-align:left;cursor:pointer}.cover-context-menu button:hover{background:#f0f9ff;color:#0f6070}.cover-context-menu button.danger{color:#b42318}.cover-context-menu small{color:#94a3b8;font-size:6.5px;font-weight:700}
    `;document.head.appendChild(style);
  }

  function ensureOverlay(){
    const artboard=byId('artboard');if(!artboard)return null;
    let overlay=byId(OVERLAY_ID);
    if(!overlay){overlay=document.createElement('div');overlay.id=OVERLAY_ID;overlay.setAttribute('aria-hidden','true');artboard.appendChild(overlay);}
    return overlay;
  }
  function mmScale(artboard,p){
    const totalW=Number(p.width)+(Number(p.bleed)||0)*2;
    const totalH=Number(p.height)+(Number(p.bleed)||0)*2;
    return{x:artboard.clientWidth/Math.max(.001,totalW),y:artboard.clientHeight/Math.max(.001,totalH)};
  }
  function zoneBox(name,start,width,p,scale){
    const bleed=Number(p.bleed)||0,trimH=Number(p.cover.trimHeight)||Number(p.height)||297;
    return{name,left:(bleed+start)*scale.x,top:bleed*scale.y,width:width*scale.x,height:trimH*scale.y};
  }
  function safeBox(zone,p,scale){
    const safe=Math.max(0,Number(p.safe)||0),spine=Number(p.cover.spine)||0;
    if(zone.name==='spine'){
      const safeWidth=Math.max(.2,spine*.72),inset=Math.max(0,(spine-safeWidth)/2);
      return{left:zone.left+inset*scale.x,top:zone.top+safe*scale.y,width:safeWidth*scale.x,height:Math.max(1,zone.height-safe*2*scale.y)};
    }
    return{left:zone.left+safe*scale.x,top:zone.top+safe*scale.y,width:Math.max(1,zone.width-safe*2*scale.x),height:Math.max(1,zone.height-safe*2*scale.y)};
  }
  function appendZone(overlay,zone,p,scale,label){
    const node=document.createElement('div');node.className='cover-preview-zone';node.dataset.zone=zone.name;
    node.style.left=`${zone.left}px`;node.style.top=`${zone.top}px`;node.style.width=`${zone.width}px`;node.style.height=`${zone.height}px`;node.style.setProperty('--zone-opacity',String(prefs.opacity/100));
    if(prefs.labels){const badge=document.createElement('span');badge.className='cover-preview-zone-label';badge.textContent=label;node.appendChild(badge);}
    overlay.appendChild(node);
    if(prefs.safe){const box=safeBox(zone,p,scale),safe=document.createElement('div');safe.className='cover-preview-zone-safe';safe.dataset.zone=zone.name;safe.style.left=`${box.left}px`;safe.style.top=`${box.top}px`;safe.style.width=`${box.width}px`;safe.style.height=`${box.height}px`;overlay.appendChild(safe);}
  }
  function render(){
    if(!isCover())return false;
    const p=project(),artboard=byId('artboard'),overlay=ensureOverlay();if(!p||!artboard||!overlay)return false;
    overlay.hidden=!prefs.visible;overlay.replaceChildren();if(!prefs.visible)return true;
    const scale=mmScale(artboard,p),trimW=Number(p.cover.trimWidth)||210,spine=Number(p.cover.spine)||0;
    const zones=[zoneBox('back',0,trimW,p,scale),zoneBox('spine',trimW,spine,p,scale),zoneBox('front',trimW+spine,trimW,p,scale)];
    appendZone(overlay,zones[0],p,scale,'뒤표지');appendZone(overlay,zones[1],p,scale,`책등 ${spine.toFixed(1)}mm`);appendZone(overlay,zones[2],p,scale,'앞표지');
    overlay.dataset.zoneCount='3';overlay.dataset.spine=String(spine);overlay.dataset.opacity=String(prefs.opacity);return true;
  }

  function applyZoom(){
    const artboard=byId('artboard');if(!artboard)return false;
    const zoom=clamp(Number(prefs.zoom)||1,.5,2.5);artboard.style.transformOrigin='0 0';artboard.style.transform=zoom===1?'':`scale(${zoom})`;
    const extraW=Math.max(0,artboard.offsetWidth*(zoom-1)),extraH=Math.max(0,artboard.offsetHeight*(zoom-1));
    artboard.style.marginRight=extraW?`${extraW}px`:'';artboard.style.marginBottom=extraH?`${extraH}px`:'';artboard.dataset.mouseZoom=String(zoom);return true;
  }
  function changeZoom(delta){return setPrefs({zoom:clamp(Math.round((prefs.zoom+delta)*10)/10,.5,2.5)});}

  function selectedNode(){return document.querySelector('.phase2-extra-object.selected,.design-text.selected');}
  function selectTarget(target){
    const node=target?.closest?.('.phase2-extra-object,.design-text');if(!node)return null;
    node.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,view:window}));return node;
  }
  function clickFirst(...ids){for(const id of ids){const node=byId(id);if(node){node.click();return true;}}return false;}
  function toggleLock(){
    const control=byId('phase2ExtraLock')||byId('lockInput');if(!control)return false;
    control.checked=!control.checked;control.dispatchEvent(new Event('change',{bubbles:true}));return true;
  }
  function align(direction){return Boolean(window.DesignEditorPhase3Controls?.alignSelected?.(direction));}
  function nudgeWithWheel(event){
    const node=selectedNode();if(!node)return false;
    const horizontal=event.shiftKey;const key=horizontal?(event.deltaY>0?'ArrowRight':'ArrowLeft'):(event.deltaY>0?'ArrowDown':'ArrowUp');
    document.dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true,cancelable:true}));return true;
  }
  function zoneAtClientX(clientX){
    const p=project(),artboard=byId('artboard');if(!p||!artboard)return'';
    const rect=artboard.getBoundingClientRect(),bleed=Number(p.bleed)||0,totalW=Number(p.width)+bleed*2;
    if(rect.width<=0)return'';const mm=(clientX-rect.left)/rect.width*totalW-bleed,trimW=Number(p.cover.trimWidth)||210,spine=Number(p.cover.spine)||0;
    if(mm<0||mm>Number(p.width))return'';if(mm<trimW)return'back';if(mm<trimW+spine)return'spine';return'front';
  }

  function ensureMenu(){
    let menu=byId(MENU_ID);if(menu)return menu;
    menu=document.createElement('div');menu.id=MENU_ID;menu.className='cover-context-menu';menu.hidden=true;menu.setAttribute('role','menu');document.body.appendChild(menu);return menu;
  }
  function closeMenu(){const menu=byId(MENU_ID);if(menu){menu.hidden=true;menu.replaceChildren();}}
  function menuButton(label,action,hint='',danger=false){
    const button=document.createElement('button');button.type='button';button.innerHTML=`<span>${label}</span>${hint?`<small>${hint}</small>`:''}`;if(danger)button.classList.add('danger');
    button.addEventListener('click',()=>{closeMenu();action();});return button;
  }
  function menuSep(){const sep=document.createElement('div');sep.className='cover-context-menu-sep';return sep;}
  function showContextMenu(event){
    if(!isCover())return;
    const artboard=byId('artboard');if(!artboard||!event.target?.closest?.('#artboard'))return;
    event.preventDefault();event.stopPropagation();const target=selectTarget(event.target),menu=ensureMenu();menu.replaceChildren();
    const title=document.createElement('div');title.className='cover-context-menu-title';title.textContent=target?'선택 요소 빠른 작업':`${zoneAtClientX(event.clientX)==='spine'?'책등':'표지'} 빠른 작업`;menu.appendChild(title);
    if(target){
      menu.appendChild(menuButton('복제',()=>clickFirst('phase2ExtraDuplicate','duplicateBtn'),'Ctrl+D'));
      menu.appendChild(menuButton('앞으로',()=>clickFirst('phase2ExtraFront','layerFrontBtn')));
      menu.appendChild(menuButton('뒤로',()=>clickFirst('phase2ExtraBack','layerBackBtn')));
      menu.appendChild(menuSep());
      menu.appendChild(menuButton('가로 가운데 정렬',()=>align('center')));menu.appendChild(menuButton('세로 가운데 정렬',()=>align('middle')));
      menu.appendChild(menuButton('잠금 / 잠금 해제',toggleLock));
      menu.appendChild(menuSep());menu.appendChild(menuButton('삭제',()=>clickFirst('phase2ExtraDelete','deleteBtn'),'Delete',true));
    }else{
      const zone=zoneAtClientX(event.clientX);
      if(zone==='spine'&&window.DesignEditorCoverSpineTools?.addSpineTitle)menu.appendChild(menuButton('책등 제목 추가',()=>window.DesignEditorCoverSpineTools.addSpineTitle('center')));
      menu.appendChild(menuButton('메인 제목 추가',()=>byId('addTitleBtn')?.click()));menu.appendChild(menuButton('본문 글씨 추가',()=>byId('addBodyBtn')?.click()));
      menu.appendChild(menuSep());menu.appendChild(menuButton(prefs.visible?'표지 가이드 숨기기':'표지 가이드 표시',()=>setPrefs({visible:!prefs.visible})));
      menu.appendChild(menuButton(prefs.safe?'안전영역 숨기기':'안전영역 표시',()=>setPrefs({safe:!prefs.safe})));
      menu.appendChild(menuButton('화면 배율 100%',()=>setPrefs({zoom:1}),'Ctrl+휠'));
    }
    menu.hidden=false;const margin=8,width=Math.max(178,menu.offsetWidth),height=Math.max(40,menu.offsetHeight);menu.style.left=`${Math.round(clamp(event.clientX,margin,window.innerWidth-width-margin))}px`;menu.style.top=`${Math.round(clamp(event.clientY,margin,window.innerHeight-height-margin))}px`;
  }

  function handleWheel(event){
    const viewport=byId('artboardViewport');if(!viewport||!event.target?.closest?.('#artboardViewport'))return;
    if(event.ctrlKey||event.metaKey){event.preventDefault();closeMenu();changeZoom(event.deltaY<0?.1:-.1);return;}
    if(event.altKey&&selectedNode()){event.preventDefault();closeMenu();nudgeWithWheel(event);return;}
    if(event.shiftKey&&Math.abs(event.deltaY)>Math.abs(event.deltaX)){event.preventDefault();viewport.scrollLeft+=event.deltaY;closeMenu();}
  }

  function installCard(){
    if(byId(CARD_ID))return true;
    const sidebar=document.querySelector('.sidebar'),anchor=byId('designCoverSpineTools')||byId('designCoverSettings'),inspector=byId('inspector');if(!sidebar||!inspector)return false;
    const card=document.createElement('section');card.id=CARD_ID;card.className='side-card cover-preview-zone-tools';
    card.innerHTML=`<div class="side-label">표지 미리보기 가이드</div><label class="cover-preview-zone-row"><input id="coverPreviewZonesVisible" type="checkbox"> 뒤표지·책등·앞표지 영역 표시</label><label class="cover-preview-zone-row"><input id="coverPreviewZoneLabels" type="checkbox"> 영역 이름 표시</label><label class="cover-preview-zone-row"><input id="coverPreviewZoneSafe" type="checkbox"> 인쇄 안전영역 표시</label><label class="cover-preview-zone-opacity"><span>영역 음영</span><input id="coverPreviewZoneOpacity" type="range" min="0" max="35" step="1"><output id="coverPreviewZoneOpacityValue"></output></label><label class="cover-preview-zone-opacity"><span>화면 배율</span><input id="coverPreviewMouseZoom" type="range" min="50" max="250" step="10"><output id="coverPreviewMouseZoomValue"></output></label><div class="cover-preview-zone-note"><kbd>Ctrl</kbd>+휠 확대/축소 · <kbd>Shift</kbd>+휠 가로 이동 · <kbd>Alt</kbd>+휠 선택 요소 미세 이동 · 캔버스 우클릭 빠른 메뉴. 가이드와 화면 배율은 PNG/PDF 출력에 포함되지 않습니다.</div>`;
    if(anchor?.nextSibling)sidebar.insertBefore(card,anchor.nextSibling);else sidebar.insertBefore(card,inspector);
    byId('coverPreviewZonesVisible')?.addEventListener('change',event=>setPrefs({visible:event.target.checked}));
    byId('coverPreviewZoneLabels')?.addEventListener('change',event=>setPrefs({labels:event.target.checked}));
    byId('coverPreviewZoneSafe')?.addEventListener('change',event=>setPrefs({safe:event.target.checked}));
    byId('coverPreviewZoneOpacity')?.addEventListener('input',event=>setPrefs({opacity:Number(event.target.value)}));
    byId('coverPreviewMouseZoom')?.addEventListener('input',event=>setPrefs({zoom:Number(event.target.value)/100}));
    return true;
  }
  function syncControls(){
    const visible=byId('coverPreviewZonesVisible'),labels=byId('coverPreviewZoneLabels'),safe=byId('coverPreviewZoneSafe'),opacity=byId('coverPreviewZoneOpacity'),value=byId('coverPreviewZoneOpacityValue'),zoom=byId('coverPreviewMouseZoom'),zoomValue=byId('coverPreviewMouseZoomValue');
    if(visible)visible.checked=prefs.visible;if(labels)labels.checked=prefs.labels;if(safe)safe.checked=prefs.safe;if(opacity)opacity.value=String(prefs.opacity);if(value)value.value=`${prefs.opacity}%`;if(zoom)zoom.value=String(Math.round(prefs.zoom*100));if(zoomValue)zoomValue.value=`${Math.round(prefs.zoom*100)}%`;
  }
  function queueRender(){if(frame)return;frame=requestAnimationFrame(()=>requestAnimationFrame(()=>{frame=0;installCard();syncControls();applyZoom();render();}));}
  function install(){
    if(installed){queueRender();return true;}
    if(!isCover()||!document.querySelector('.sidebar')||!byId('artboard'))return false;
    installed=true;normalizePrefs();installStyles();installCard();syncControls();applyZoom();render();ensureMenu();
    window.addEventListener('resize',queueRender,{passive:true});window.addEventListener('programstudio:cover-geometry-change',queueRender);
    document.addEventListener('click',event=>{if(!event.target?.closest?.(`#${MENU_ID}`))closeMenu();queueRender();},false);
    document.addEventListener('contextmenu',showContextMenu,true);byId('artboardViewport')?.addEventListener('wheel',handleWheel,{passive:false});byId('artboardViewport')?.addEventListener('scroll',closeMenu,{passive:true});
    document.addEventListener('keydown',event=>{if(event.key==='Escape')closeMenu();},true);
    return true;
  }
  function boot(){if(install())return;[180,420,800,1300,2200,3200].forEach(delay=>setTimeout(install,delay));}

  window.DesignEditorCoverPreviewZones={render,setPrefs,changeZoom,showContextMenu,get prefs(){return {...prefs};},stage:'preview-zones-wheel-and-context-menu'};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
