(function(){
  'use strict';
  if(window.__designEditorMouseInteractionsV1)return;
  window.__designEditorMouseInteractionsV1=true;
  const params=new URLSearchParams(location.search);
  if(params.get('embed')!=='1')return;

  const MENU_ID='designEditorMouseContextMenu';
  const STYLE_ID='designEditorMouseContextStyles';
  let installed=false;

  const byId=id=>document.getElementById(id);
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const project=()=>window.DesignEditorApp?.project||null;
  const viewport=()=>byId('artboardViewport');
  const hasCoverMouse=()=>project()?.designMode==='cover'&&window.DesignEditorCoverPreviewZones?.stage==='preview-zones-wheel-and-context-menu';
  const selectedNode=()=>document.querySelector('.phase2-extra-object.selected,.design-text.selected');

  function installStyles(){
    if(byId(STYLE_ID))return;
    const style=document.createElement('style');style.id=STYLE_ID;style.textContent=`
      .design-mouse-menu{position:fixed;z-index:12000;min-width:182px;padding:5px;border:1px solid #cbd5e1;border-radius:10px;background:#fff;box-shadow:0 16px 42px rgba(15,23,42,.24);font-size:8px;color:#334155}
      .design-mouse-menu[hidden]{display:none!important}.design-mouse-menu-title{padding:5px 7px 4px;color:#64748b;font-size:7px;font-weight:950}.design-mouse-menu-sep{height:1px;background:#e5e7eb;margin:4px 2px}
      .design-mouse-menu button{display:flex;width:100%;align-items:center;justify-content:space-between;gap:12px;border:0;border-radius:6px;background:#fff;padding:7px 8px;color:#334155;font-size:8px;font-weight:850;text-align:left;cursor:pointer}.design-mouse-menu button:hover{background:#f0f9ff;color:#0f6070}.design-mouse-menu button.danger{color:#b42318}.design-mouse-menu small{color:#94a3b8;font-size:6.5px;font-weight:700}
    `;document.head.appendChild(style);
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
    const view=viewport();if(!view||!event.target?.closest?.('#artboardViewport'))return;
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

  function install(){
    if(installed)return true;
    if(!byId('artboard')||!viewport()||!window.DesignEditorApp)return false;
    installed=true;installStyles();ensureMenu();document.addEventListener('contextmenu',showContextMenu,true);viewport().addEventListener('wheel',handleWheel,{passive:false});viewport().addEventListener('scroll',closeMenu,{passive:true});
    document.addEventListener('pointerdown',event=>{if(event.button!==2&&!event.target?.closest?.(`#${MENU_ID}`))closeMenu();},true);document.addEventListener('keydown',event=>{if(event.key==='Escape')closeMenu();},true);
    window.DesignEditorMouseInteractions={showContextMenu,closeMenu,scaleSelected,stage:'wheel-and-context-menu-across-general-editor'};return true;
  }
  function boot(){if(install())return;[160,360,720,1200,2000].forEach(delay=>setTimeout(install,delay));}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
