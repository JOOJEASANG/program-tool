(function(){
  'use strict';
  if(window.__designEditorQuickDesignV1)return;
  window.__designEditorQuickDesignV1=true;

  const path=location.pathname.replace(/\/+$/,'')||'/';
  if(path!=='/design-editor'&&path!=='/design-editor/index.html'&&!path.endsWith('/design-editor/index.html'))return;

  const STYLE_ID='designEditorQuickDesignStyles';
  const CARD_ID='designQuickDesignTools';
  const TITLE_PANEL_ID='quickTitleStylePanel';
  const SHAPE_PANEL_ID='quickShapeStylePanel';
  const DRAFT_KEY='programTool.designEditor.draft.v1';
  const TITLE_STYLES=[
    ['none','기본'],['bar','세로 바'],['line','짧은 선'],['pill','라벨'],['highlight','하이라이트'],['underline','밑줄'],['dot','도트']
  ];
  let installed=false;
  let saveTimer=0;

  const byId=id=>document.getElementById(id);
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const project=()=>window.DesignEditorApp?.project||null;
  function surface(){
    const p=project();
    return p?.surfaces?.find(item=>item.id===p.activeSurface)||p?.surfaces?.[0]||null;
  }
  function selectedText(){
    const node=document.querySelector('.design-text.selected');
    if(!node)return null;
    return surface()?.elements?.find(item=>item.id===node.dataset.id&&item.type==='text')||null;
  }
  function selectedShape(){
    const node=document.querySelector('.phase2-extra-object.selected');
    if(!node)return null;
    return surface()?.extras?.find(item=>item.id===node.dataset.extraId&&item.type==='shape')||null;
  }
  function ppm(){
    const p=project(),board=byId('artboard');
    if(!p||!board)return 1;
    return Math.max(.001,board.getBoundingClientRect().width/Math.max(1,Number(p.width)+(Number(p.bleed)||0)*2));
  }

  function setStatus(message,type='ok'){
    const node=byId('editorStatus');if(!node)return;
    node.className=`editor-status ${type}`;node.textContent=message;
  }

  function persist(source='quick-design'){
    clearTimeout(saveTimer);
    saveTimer=setTimeout(()=>{
      const p=project();if(!p)return;
      try{
        if(window.DesignEditorDraftScope?.saveCurrent){window.DesignEditorDraftScope.saveCurrent(source);return;}
        localStorage.setItem(DRAFT_KEY,JSON.stringify(p));
      }catch(_){}
    },80);
  }

  function installStyles(){
    if(byId(STYLE_ID))return;
    const style=document.createElement('style');style.id=STYLE_ID;
    style.textContent=`
      .quick-design-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}.quick-design-btn{border:1px solid #d7e0e9;border-radius:9px;background:#fff;color:#334155;padding:8px 5px;font-size:8px;font-weight:900;cursor:pointer}.quick-design-btn:hover{border-color:#72bcc9;background:#f0fdff}.quick-design-note{margin-top:6px;color:#7c8797;font-size:7px;line-height:1.45}
      .quick-style-panel{margin:8px 0 10px;padding:9px;border:1px solid #dfe8ef;border-radius:10px;background:#f8fbfd}.quick-style-title{font-size:8px;font-weight:950;color:#475569;margin-bottom:7px}.quick-title-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px}.quick-title-style{border:1px solid #d7e0e9;border-radius:7px;background:#fff;padding:7px 3px;color:#64748b;font-size:7px;font-weight:900;cursor:pointer}.quick-title-style.on{border-color:#1d9bb2;background:#ecfeff;color:#0e7490}.quick-accent-row{display:grid;grid-template-columns:1fr 42px;gap:6px;align-items:end;margin-top:7px}.quick-accent-row label{display:block;font-size:7px;font-weight:900;color:#64748b}.quick-accent-row input{width:100%;height:31px;border:1px solid #cfd8e3;border-radius:7px;background:#fff;padding:3px}.quick-radius-buttons{display:grid;grid-template-columns:repeat(4,1fr);gap:4px;margin-bottom:7px}.quick-radius-buttons button{border:1px solid #d7e0e9;border-radius:7px;background:#fff;padding:6px 2px;font-size:7px;font-weight:900;color:#64748b;cursor:pointer}.quick-radius-buttons button.on{border-color:#1d9bb2;background:#ecfeff;color:#0e7490}.quick-range-row{display:grid;grid-template-columns:1fr 42px;gap:7px;align-items:center}.quick-range-row input[type=range]{width:100%;accent-color:#1d9bb2}.quick-range-value{font-size:8px;font-weight:900;color:#475569;text-align:right}.quick-shadow-row{display:flex;align-items:center;gap:6px;margin-top:8px;font-size:8px;font-weight:850;color:#475569}.quick-shadow-row input{accent-color:#12396d}
      .design-text{--title-accent:#1d9bb2}.design-text.title-style-bar .design-text-inner::before{content:"";width:.14em;min-height:1.15em;border-radius:999px;background:var(--title-accent);flex:0 0 .14em;margin-right:.14em}.design-text.title-style-line .design-text-inner::before{content:"";width:.9em;height:.09em;border-radius:999px;background:var(--title-accent);flex:0 0 .9em;margin-top:.55em;margin-right:.08em}.design-text.title-style-dot .design-text-inner::before{content:"";width:.28em;height:.28em;border-radius:50%;background:var(--title-accent);flex:0 0 .28em;margin-top:.43em;margin-right:.06em}.design-text.title-style-pill .design-text-inner{padding:.2em .42em;border:1px solid color-mix(in srgb,var(--title-accent) 42%,white);border-radius:999px;background:color-mix(in srgb,var(--title-accent) 10%,white)}.design-text.title-style-highlight .editable-text{background:linear-gradient(transparent 58%,color-mix(in srgb,var(--title-accent) 24%,transparent) 58%);padding:0 .05em}.design-text.title-style-underline .design-text-inner{padding-bottom:.13em;border-bottom:.1em solid var(--title-accent)}
    `;
    document.head.appendChild(style);
  }

  function applyTitleStyles(){
    const s=surface();if(!s)return;
    document.querySelectorAll('.design-text[data-id]').forEach(node=>{
      const item=s.elements?.find(entry=>entry.id===node.dataset.id&&entry.type==='text');if(!item)return;
      TITLE_STYLES.forEach(([key])=>node.classList.remove(`title-style-${key}`));
      const key=TITLE_STYLES.some(([value])=>value===item.titleStyle)?item.titleStyle:'none';
      if(key!=='none')node.classList.add(`title-style-${key}`);
      node.style.setProperty('--title-accent',item.titleAccent||'#1d9bb2');
      node.dataset.titleStyle=key;
    });
  }

  function applyShapeStyles(){
    const s=surface(),scale=ppm();if(!s)return;
    document.querySelectorAll('.phase2-extra-object[data-extra-id]').forEach(node=>{
      const item=s.extras?.find(entry=>entry.id===node.dataset.extraId&&entry.type==='shape');if(!item)return;
      const inner=node.querySelector('.phase2-shape-inner');if(!inner)return;
      if(item.shape==='rect'){
        const maxRadius=Math.max(0,Math.min(Number(item.w)||0,Number(item.h)||0)/2);
        const radius=clamp(Number(item.cornerRadius)||0,0,maxRadius);
        inner.style.borderRadius=`${radius*scale}px`;
        inner.style.boxShadow=item.shapeShadow?'0 4px 12px rgba(15,23,42,.18)':'none';
      }
    });
  }

  function currentTitleStyle(){return selectedText()?.titleStyle||'none';}
  function refreshTitleButtons(root){
    const current=currentTitleStyle();
    root?.querySelectorAll('[data-quick-title-style]').forEach(button=>button.classList.toggle('on',button.dataset.quickTitleStyle===current));
  }

  function enhanceTextInspector(){
    const item=selectedText(),root=byId('inspector');if(!item||!root||byId(TITLE_PANEL_ID))return;
    const panel=document.createElement('div');panel.id=TITLE_PANEL_ID;panel.className='quick-style-panel';
    panel.innerHTML=`<div class="quick-style-title">큰 제목 꾸미기 · 클릭 한 번</div><div class="quick-title-grid">${TITLE_STYLES.map(([key,label])=>`<button type="button" class="quick-title-style${(item.titleStyle||'none')===key?' on':''}" data-quick-title-style="${key}">${label}</button>`).join('')}</div><div class="quick-accent-row"><label>포인트 색상</label><input id="quickTitleAccent" type="color" value="${item.titleAccent||'#1d9bb2'}"></div>`;
    const roleField=byId('roleInput')?.closest('.field');
    if(roleField)roleField.insertAdjacentElement('afterend',panel);else root.prepend(panel);
    panel.querySelectorAll('[data-quick-title-style]').forEach(button=>button.addEventListener('click',()=>{
      item.titleStyle=button.dataset.quickTitleStyle;item.titleAccent=item.titleAccent||'#1d9bb2';persist('title-style');applyTitleStyles();refreshTitleButtons(panel);setStatus('타이틀 서식을 적용했습니다.');
    }));
    byId('quickTitleAccent').addEventListener('input',event=>{item.titleAccent=event.target.value;persist('title-accent');applyTitleStyles();});
  }

  function radiusPreset(item,key){
    if(key==='square')return 0;
    if(key==='soft')return Math.min(4,Math.min(item.w,item.h)/2);
    if(key==='round')return Math.min(10,Math.min(item.w,item.h)/2);
    return Math.min(item.w,item.h)/2;
  }
  function radiusKey(item){
    const r=Number(item.cornerRadius)||0,max=Math.min(item.w,item.h)/2;
    if(r<.2)return'square';if(Math.abs(r-Math.min(4,max))<.3)return'soft';if(Math.abs(r-Math.min(10,max))<.3)return'round';if(Math.abs(r-max)<.3)return'pill';return'';
  }
  function enhanceShapeInspector(){
    const item=selectedShape(),root=byId('inspector');if(!item||item.shape!=='rect'||!root||byId(SHAPE_PANEL_ID))return;
    const max=Math.max(0,Math.min(30,Math.min(Number(item.w)||0,Number(item.h)||0)/2));
    item.cornerRadius=clamp(Number(item.cornerRadius)||0,0,Math.min(item.w,item.h)/2);
    const currentKey=radiusKey(item);
    const panel=document.createElement('div');panel.id=SHAPE_PANEL_ID;panel.className='quick-style-panel';
    panel.innerHTML=`<div class="quick-style-title">모서리·그림자</div><div class="quick-radius-buttons"><button type="button" data-radius-preset="square"${currentKey==='square'?' class="on"':''}>각진</button><button type="button" data-radius-preset="soft"${currentKey==='soft'?' class="on"':''}>살짝</button><button type="button" data-radius-preset="round"${currentKey==='round'?' class="on"':''}>둥글게</button><button type="button" data-radius-preset="pill"${currentKey==='pill'?' class="on"':''}>캡슐</button></div><div class="quick-range-row"><input id="quickCornerRadius" type="range" min="0" max="${max}" step="0.5" value="${Math.min(max,item.cornerRadius)}"><span id="quickCornerRadiusValue" class="quick-range-value">${item.cornerRadius.toFixed(1)}mm</span></div><label class="quick-shadow-row"><input id="quickShapeShadow" type="checkbox"${item.shapeShadow?' checked':''}> 은은한 그림자</label>`;
    const title=root.querySelector('.inspector-note');
    if(title)title.insertAdjacentElement('afterend',panel);else root.prepend(panel);
    panel.querySelectorAll('[data-radius-preset]').forEach(button=>button.addEventListener('click',()=>{
      item.cornerRadius=radiusPreset(item,button.dataset.radiusPreset);persist('shape-radius-preset');window.DesignEditorPhase2?.sync?.();queueSync();setStatus('모서리 모양을 적용했습니다.');
    }));
    byId('quickCornerRadius').addEventListener('input',event=>{
      item.cornerRadius=clamp(Number(event.target.value)||0,0,Math.min(item.w,item.h)/2);byId('quickCornerRadiusValue').textContent=`${item.cornerRadius.toFixed(1)}mm`;panel.querySelectorAll('[data-radius-preset]').forEach(button=>button.classList.remove('on'));persist('shape-radius');applyShapeStyles();
    });
    byId('quickShapeShadow').addEventListener('change',event=>{item.shapeShadow=event.target.checked;persist('shape-shadow');applyShapeStyles();setStatus(item.shapeShadow?'그림자를 적용했습니다.':'그림자를 해제했습니다.');});
  }

  function styleNewTitle(style){
    byId('addTitleBtn')?.click();
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      const item=selectedText();if(!item)return;
      item.titleStyle=style;item.titleAccent='#1d9bb2';persist('quick-title-create');applyTitleStyles();queueSync();
    }));
  }
  function addRoundedBox(){
    window.DesignEditorPhase2?.addShape?.('rect');
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      const item=selectedShape();if(!item)return;
      item.cornerRadius=Math.min(6,Math.min(item.w,item.h)/2);item.shapeShadow=true;persist('quick-rounded-box');window.DesignEditorPhase2?.sync?.();queueSync();
    }));
  }

  function installQuickCard(){
    if(byId(CARD_ID))return true;
    const sidebar=document.querySelector('.sidebar'),inspector=byId('inspector');if(!sidebar||!inspector)return false;
    const card=document.createElement('section');card.id=CARD_ID;card.className='side-card';
    card.innerHTML=`<div class="side-label">빠른 꾸미기</div><div class="quick-design-grid"><button class="quick-design-btn" data-quick-create="bar" type="button">포인트 제목</button><button class="quick-design-btn" data-quick-create="pill" type="button">라벨 제목</button><button class="quick-design-btn" data-quick-create="underline" type="button">밑줄 제목</button><button class="quick-design-btn" id="quickRoundedBox" type="button">둥근 박스</button></div><div class="quick-design-note">복잡한 설정 없이 자주 쓰는 디자인을 바로 넣고, 선택한 요소에서 필요한 옵션만 조절합니다.</div>`;
    sidebar.insertBefore(card,inspector);
    card.querySelectorAll('[data-quick-create]').forEach(button=>button.addEventListener('click',()=>styleNewTitle(button.dataset.quickCreate)));
    byId('quickRoundedBox').addEventListener('click',addRoundedBox);
    return true;
  }

  function sync(){
    if(!project()||byId('editorShell')?.classList.contains('hidden'))return;
    installQuickCard();applyTitleStyles();applyShapeStyles();enhanceTextInspector();enhanceShapeInspector();
  }
  function queueSync(){requestAnimationFrame(()=>requestAnimationFrame(sync));}
  function bindEvents(){
    ['click','dblclick','input','change','keyup','pointerup'].forEach(name=>document.addEventListener(name,queueSync,false));
    window.addEventListener('resize',queueSync,{passive:true});
  }
  function install(){
    if(installed)return true;
    if(!document.querySelector('.sidebar')||!byId('artboard')||!byId('inspector')||!window.DesignEditorApp)return false;
    installed=true;installStyles();installQuickCard();bindEvents();
    window.DesignEditorQuickDesign={sync,stage:'simple-shape-title-style-controls'};
    [180,420,850,1500,2400].forEach(delay=>setTimeout(queueSync,delay));
    return true;
  }
  function boot(){if(install())return;[180,420,850,1500,2600].forEach(delay=>setTimeout(install,delay));}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
