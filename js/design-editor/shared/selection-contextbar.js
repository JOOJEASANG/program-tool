// Context-sensitive property bar for the embedded design editor.
// Reuses the existing inspector controls and layout API so there is only one editing implementation.
(function(){
  'use strict';
  if(window.__designEditorSelectionContextbarV1)return;
  window.__designEditorSelectionContextbarV1=true;
  if(new URLSearchParams(location.search).get('embed')!=='1')return;

  const BAR_ID='designSelectionContextbar';
  const STYLE_ID='designSelectionContextbarStyles';
  const FIELD_MAP={
    'text-font':{selector:'#fontInput',event:'change'},
    'text-size':{selector:'#sizeInput',event:'input'},
    'text-weight':{selector:'#weightInput',event:'change'},
    'text-color':{selector:'#colorInput',event:'input'},
    'extra-w':{selector:'[data-extra-field="w"]',event:'input'},
    'extra-h':{selector:'[data-extra-field="h"]',event:'input'},
    'extra-opacity':{selector:'[data-extra-field="opacity"]',event:'input'},
    'image-fit':{selector:'[data-extra-field="fit"]',event:'change'},
    'image-focus-x':{selector:'[data-extra-field="focusX"]',event:'input'},
    'image-focus-y':{selector:'[data-extra-field="focusY"]',event:'input'},
    'shape-fill':{selector:'[data-extra-field="fill"]',event:'input'},
    'shape-stroke':{selector:'[data-extra-field="stroke"]',event:'input'},
    'shape-stroke-width':{selector:'[data-extra-field="strokeWidth"]',event:'input'},
    'shape-radius':{selector:'#quickCornerRadius',event:'input'}
  };
  let installed=false;
  let timer=0;
  let renderedSignature='';
  let artboardObserver=null;
  let inspectorObserver=null;
  let toolbarResizeObserver=null;

  const byId=id=>document.getElementById(id);
  const project=()=>window.DesignEditorApp?.project||null;
  const surface=()=>{
    const p=project();
    return p?.surfaces?.find(item=>item.id===p.activeSurface)||p?.surfaces?.[0]||null;
  };
  const safeColor=(value,fallback='#172033')=>/^#[0-9a-f]{6}$/i.test(String(value||''))?String(value):fallback;
  const rounded=value=>Number.isFinite(Number(value))?Math.round(Number(value)*10)/10:0;
  const percentValue=(value,fallback=50)=>Number.isFinite(Number(value))?Math.round(Number(value)):fallback;

  function selectedRecord(){
    const current=surface();if(!current)return null;
    const extraNode=document.querySelector('.phase2-extra-object.selected');
    if(extraNode){
      const item=current.extras?.find(entry=>entry.id===extraNode.dataset.extraId);
      if(item)return{kind:item.type==='image'?'image':'shape',item,node:extraNode,key:`extra:${item.id}`};
    }
    const textNode=document.querySelector('.design-text.selected');
    if(textNode){
      const item=current.elements?.find(entry=>entry.id===textNode.dataset.id&&entry.type==='text');
      if(item)return{kind:'text',item,node:textNode,key:`text:${item.id}`};
    }
    return null;
  }

  function sourceControl(selector){
    return byId('inspector')?.querySelector(selector)||document.querySelector(selector);
  }

  function fire(control,eventName){
    if(!control)return false;
    control.dispatchEvent(new Event(eventName,{bubbles:true}));
    return true;
  }

  function proxyField(key,value){
    const config=FIELD_MAP[key];if(!config)return false;
    const control=sourceControl(config.selector);if(!control)return false;
    control.value=String(value);
    fire(control,config.event);
    return true;
  }

  function proxyTextAlign(value){
    const button=byId('inspector')?.querySelector(`[data-align="${value}"]`);
    if(!button)return false;
    button.click();return true;
  }

  function proxyArrange(value){
    if(!value)return false;
    if(window.DesignEditorPhase3Controls?.alignSelected){window.DesignEditorPhase3Controls.alignSelected(value);return true;}
    const button=document.querySelector(`[data-phase3-align="${value}"]`);
    if(button){button.click();return true;}
    return false;
  }

  function actionSource(record,action){
    if(!record)return null;
    if(record.kind==='text'){
      return {back:'#layerBackBtn',front:'#layerFrontBtn',duplicate:'#duplicateBtn',delete:'#deleteBtn',lock:'#lockInput'}[action]||'';
    }
    return {back:'#phase2ExtraBack',front:'#phase2ExtraFront',duplicate:'#phase2ExtraDuplicate',delete:'#phase2ExtraDelete',lock:'#phase2ExtraLock',replace:'#phase2ReplaceImage'}[action]||'';
  }

  function proxyAction(action){
    const record=selectedRecord();if(!record)return false;
    const selector=actionSource(record,action);if(!selector)return false;
    const control=sourceControl(selector);if(!control)return false;
    if(action==='lock'&&control.matches('input[type="checkbox"]')){
      control.checked=!control.checked;fire(control,'change');
    }else control.click();
    return true;
  }

  function fontOptions(){
    const source=sourceControl('#fontInput');
    return source?.innerHTML||'<option value="Pretendard">Pretendard</option><option value="Malgun Gothic">맑은 고딕</option><option value="Arial">Arial</option>';
  }

  function commonMarkup(record){
    const locked=record.item.locked?'on':'';
    return `<span class="design-context-sep" aria-hidden="true"></span><label class="design-context-field compact"><span>배치</span><select data-context-arrange aria-label="선택 요소 배치"><option value="">선택</option><option value="left">왼쪽</option><option value="center">가로 중앙</option><option value="right">오른쪽</option><option value="top">위</option><option value="middle">세로 중앙</option><option value="bottom">아래</option></select></label><span class="design-context-sep" aria-hidden="true"></span><div class="design-context-actions" aria-label="선택 요소 작업"><button type="button" data-context-action="back" title="한 단계 뒤로">뒤</button><button type="button" data-context-action="front" title="한 단계 앞으로">앞</button><button type="button" data-context-action="lock" class="${locked}" aria-pressed="${String(Boolean(record.item.locked))}" title="선택 요소 잠금/해제">잠금</button><button type="button" data-context-action="duplicate" title="선택 요소 복제">복제</button><button type="button" data-context-action="delete" class="danger" title="선택 요소 삭제">삭제</button></div>`;
  }

  function textMarkup(record){
    return `<span class="design-context-kind"><strong>T</strong><span>글씨</span></span><label class="design-context-field font"><span>글꼴</span><select data-context-field="text-font" aria-label="글꼴">${fontOptions()}</select></label><label class="design-context-field number"><span>크기</span><input data-context-field="text-size" type="number" min="6" max="120" step="1" aria-label="글자 크기 pt"><em>pt</em></label><label class="design-context-field weight"><span>굵기</span><select data-context-field="text-weight" aria-label="글자 굵기"><option value="400">보통</option><option value="500">중간</option><option value="700">굵게</option><option value="800">더 굵게</option><option value="900">매우 굵게</option></select></label><label class="design-context-color" title="글자 색상"><span>색상</span><input data-context-field="text-color" type="color" aria-label="글자 색상"></label><div class="design-context-segment" aria-label="문단 정렬"><span>문단</span><button type="button" data-context-text-align="left" title="왼쪽 정렬">좌</button><button type="button" data-context-text-align="center" title="가운데 정렬">중</button><button type="button" data-context-text-align="right" title="오른쪽 정렬">우</button></div>${commonMarkup(record)}`;
  }

  function imageMarkup(record){
    return `<span class="design-context-kind"><strong>IMG</strong><span>이미지</span></span><label class="design-context-field number"><span>가로</span><input data-context-field="extra-w" type="number" min="1" step="0.5" aria-label="이미지 가로 mm"><em>mm</em></label><label class="design-context-field number"><span>세로</span><input data-context-field="extra-h" type="number" min="0.5" step="0.5" aria-label="이미지 세로 mm"><em>mm</em></label><label class="design-context-field compact"><span>맞춤</span><select data-context-field="image-fit" aria-label="이미지 맞춤"><option value="cover">영역 채우기</option><option value="contain">전체 보이기</option></select></label><label class="design-context-field number small"><span>초점 X</span><input data-context-field="image-focus-x" type="number" min="0" max="100" step="1" aria-label="이미지 가로 초점"><em>%</em></label><label class="design-context-field number small"><span>초점 Y</span><input data-context-field="image-focus-y" type="number" min="0" max="100" step="1" aria-label="이미지 세로 초점"><em>%</em></label><label class="design-context-field number small"><span>투명도</span><input data-context-field="extra-opacity" type="number" min="1" max="100" step="1" aria-label="이미지 불투명도"><em>%</em></label><button type="button" class="design-context-standalone" data-context-action="replace">교체</button>${commonMarkup(record)}`;
  }

  function shapeMarkup(record){
    const item=record.item,isLine=item.shape==='line',isRect=item.shape==='rect';
    const label=isLine?'선':item.shape==='ellipse'?'원·타원':'도형';
    return `<span class="design-context-kind"><strong>${isLine?'—':item.shape==='ellipse'?'○':'□'}</strong><span>${label}</span></span><label class="design-context-field number"><span>가로</span><input data-context-field="extra-w" type="number" min="1" step="0.5" aria-label="도형 가로 mm"><em>mm</em></label><label class="design-context-field number"><span>세로</span><input data-context-field="extra-h" type="number" min="0.5" step="0.5" aria-label="도형 세로 mm"><em>mm</em></label>${isLine?'':`<label class="design-context-color" title="채우기 색상"><span>채우기</span><input data-context-field="shape-fill" type="color" aria-label="도형 채우기 색상"></label>`}<label class="design-context-color" title="테두리 색상"><span>${isLine?'선 색상':'테두리'}</span><input data-context-field="shape-stroke" type="color" aria-label="도형 테두리 색상"></label><label class="design-context-field number small"><span>선</span><input data-context-field="shape-stroke-width" type="number" min="0.2" max="12" step="0.2" aria-label="선 두께"><em>pt</em></label>${isRect?`<label class="design-context-field number small"><span>모서리</span><input data-context-field="shape-radius" type="number" min="0" step="0.5" aria-label="모서리 둥글기"><em>mm</em></label>`:''}<label class="design-context-field number small"><span>투명도</span><input data-context-field="extra-opacity" type="number" min="1" max="100" step="1" aria-label="도형 불투명도"><em>%</em></label>${commonMarkup(record)}`;
  }

  function installStyles(){
    if(byId(STYLE_ID))return;
    const style=document.createElement('style');style.id=STYLE_ID;style.textContent=`
      #${BAR_ID}{position:sticky;top:54px;z-index:73;display:flex;align-items:center;gap:6px;min-height:42px;flex:0 0 42px;padding:5px 10px;border-bottom:1px solid #dce5ee;background:#f8fafc;box-shadow:0 3px 10px rgba(15,39,72,.035);overflow-x:auto;overflow-y:hidden;scrollbar-width:thin;white-space:nowrap}
      #${BAR_ID}[hidden]{display:none!important}
      html[data-design-selection-context] #designCanvasQuickbar{display:none!important}
      .design-context-kind{display:inline-flex;align-items:center;gap:6px;flex:0 0 auto;padding-right:4px;color:#334155;font-size:8px;font-weight:950}.design-context-kind strong{min-width:26px;height:27px;display:grid;place-items:center;border:1px solid #cbd8e6;border-radius:7px;background:#fff;color:#1769e0;font-size:8px}.design-context-kind span{font-size:9px;color:#31445c}
      .design-context-field{position:relative;display:grid;grid-template-columns:auto auto auto;align-items:center;gap:4px;flex:0 0 auto}.design-context-field>span,.design-context-color>span,.design-context-segment>span{font-size:7px;font-weight:900;color:#7a8797}.design-context-field select,.design-context-field input{height:29px;border:1px solid #d5dfe9;border-radius:7px;background:#fff;color:#334155;padding:0 7px;font-size:8px;font-weight:850;outline:0}.design-context-field select:focus,.design-context-field input:focus{border-color:#66a6df;box-shadow:0 0 0 2px rgba(23,105,224,.11)}.design-context-field.font select{width:118px}.design-context-field.weight select{width:72px}.design-context-field.compact select{width:86px}.design-context-field.number input{width:58px;padding-right:18px}.design-context-field.number.small input{width:54px}.design-context-field em{margin-left:-23px;pointer-events:none;color:#94a3b8;font-size:6.5px;font-style:normal}.design-context-color{display:grid;grid-template-columns:auto 31px;align-items:center;gap:4px;flex:0 0 auto}.design-context-color input{width:31px;height:29px;border:1px solid #d5dfe9;border-radius:7px;background:#fff;padding:3px;cursor:pointer}
      .design-context-segment{display:flex;align-items:center;gap:3px;flex:0 0 auto}.design-context-segment button,.design-context-actions button,.design-context-standalone{height:29px;min-width:29px;border:1px solid #d5dfe9;border-radius:7px;background:#fff;color:#526174;padding:0 7px;font-size:7.5px;font-weight:900;cursor:pointer}.design-context-segment button:hover,.design-context-actions button:hover,.design-context-standalone:hover{border-color:#9cb8d4;background:#f1f7ff;color:#17466f}.design-context-segment button.on,.design-context-actions button.on{border-color:#8bb4df;background:#eaf4ff;color:#1769e0}.design-context-actions{display:flex;align-items:center;gap:3px;flex:0 0 auto}.design-context-actions .danger{color:#b42318;background:#fff8f7}.design-context-sep{width:1px;height:22px;flex:0 0 1px;background:#dce4ec;margin:0 2px}
      @media(max-width:920px){#${BAR_ID}{top:var(--design-commandbar-height,96px);padding-inline:8px;min-height:41px;flex-basis:41px}.design-context-kind span{display:none}.design-context-field>span,.design-context-color>span,.design-context-segment>span{display:none}.design-context-field.font select{width:105px}.design-context-field.weight select{width:66px}}
      @media(max-width:620px){#${BAR_ID}{gap:4px}.design-context-field.font select{width:92px}.design-context-field.number input{width:54px}.design-context-actions button{padding:0 6px}.design-context-actions button[data-context-action="back"],.design-context-actions button[data-context-action="front"]{display:none}}
    `;document.head.appendChild(style);
  }

  function ensureBar(){
    let bar=byId(BAR_ID);if(bar)return bar;
    const toolbar=document.querySelector('.editor-toolbar');if(!toolbar)return null;
    bar=document.createElement('div');bar.id=BAR_ID;bar.hidden=true;bar.setAttribute('role','toolbar');bar.setAttribute('aria-label','선택 요소 속성');
    toolbar.insertAdjacentElement('afterend',bar);
    toolbar.dataset.designSelectionContextbar='v1';
    document.documentElement.classList.add('design-selection-contextbar-ready');
    bindBar(bar);syncOffset();
    if(typeof ResizeObserver==='function'&&!toolbarResizeObserver){toolbarResizeObserver=new ResizeObserver(syncOffset);toolbarResizeObserver.observe(toolbar);}
    return bar;
  }

  function syncOffset(){
    const toolbar=document.querySelector('.editor-toolbar'),bar=byId(BAR_ID);if(!toolbar||!bar)return;
    const height=Math.max(42,Math.round(toolbar.getBoundingClientRect().height||toolbar.offsetHeight||54));
    bar.style.top=`${height}px`;
    document.documentElement.style.setProperty('--design-commandbar-height',`${height}px`);
  }

  function renderSignature(record){
    if(!record)return'';
    const fonts=record.kind==='text'?fontOptions():'';
    return `${record.key}:${record.kind}:${record.item.shape||''}:${fonts}`;
  }

  function syncControlValues(record,bar){
    const item=record.item;
    const set=(selector,value)=>{const node=bar.querySelector(selector);if(node&&document.activeElement!==node)node.value=String(value??'');};
    if(record.kind==='text'){
      set('[data-context-field="text-font"]',item.fontFamily||'Pretendard');
      set('[data-context-field="text-size"]',rounded(item.size||11));
      set('[data-context-field="text-weight"]',Number(item.weight)||400);
      set('[data-context-field="text-color"]',safeColor(item.color));
      bar.querySelectorAll('[data-context-text-align]').forEach(button=>button.classList.toggle('on',button.dataset.contextTextAlign===(item.align||'left')));
    }else{
      set('[data-context-field="extra-w"]',rounded(item.w));set('[data-context-field="extra-h"]',rounded(item.h));set('[data-context-field="extra-opacity"]',percentValue(item.opacity,100));
      if(record.kind==='image'){
        set('[data-context-field="image-fit"]',item.fit==='contain'?'contain':'cover');set('[data-context-field="image-focus-x"]',percentValue(item.focusX,50));set('[data-context-field="image-focus-y"]',percentValue(item.focusY,50));
      }else{
        set('[data-context-field="shape-fill"]',safeColor(item.fill,'#dceeff'));set('[data-context-field="shape-stroke"]',safeColor(item.stroke,'#12396d'));set('[data-context-field="shape-stroke-width"]',rounded(item.strokeWidth||1));set('[data-context-field="shape-radius"]',rounded(item.cornerRadius||0));
      }
    }
    const lock=bar.querySelector('[data-context-action="lock"]');if(lock){lock.classList.toggle('on',Boolean(item.locked));lock.setAttribute('aria-pressed',String(Boolean(item.locked)));lock.textContent=item.locked?'잠금됨':'잠금';}
  }

  function render(record){
    const bar=ensureBar();if(!bar)return false;
    if(!record||!document.documentElement.contains(record.node)){
      bar.hidden=true;bar.replaceChildren();renderedSignature='';delete document.documentElement.dataset.designSelectionContext;return true;
    }
    document.documentElement.dataset.designSelectionContext=record.kind;
    const signature=renderSignature(record);
    if(signature!==renderedSignature&&!bar.contains(document.activeElement)){
      bar.innerHTML=record.kind==='text'?textMarkup(record):record.kind==='image'?imageMarkup(record):shapeMarkup(record);
      renderedSignature=signature;
    }
    bar.hidden=false;bar.dataset.contextKind=record.kind;bar.dataset.contextId=record.item.id||'';syncControlValues(record,bar);syncOffset();return true;
  }

  function bindBar(bar){
    bar.addEventListener('pointerdown',event=>event.stopPropagation());
    bar.addEventListener('click',event=>{
      event.stopPropagation();
      const align=event.target.closest('[data-context-text-align]');
      if(align){proxyTextAlign(align.dataset.contextTextAlign);queue(25);return;}
      const action=event.target.closest('[data-context-action]');
      if(action){proxyAction(action.dataset.contextAction);queue(35);}
    });
    const proxyEvent=event=>{
      event.stopPropagation();
      const field=event.target.closest('[data-context-field]');if(!field)return;
      const key=field.dataset.contextField,config=FIELD_MAP[key];if(!config)return;
      if((event.type==='input'&&config.event!=='input')||(event.type==='change'&&config.event!=='change'))return;
      proxyField(key,field.value);queue(30);
    };
    bar.addEventListener('input',proxyEvent);bar.addEventListener('change',event=>{
      const arrange=event.target.closest('[data-context-arrange]');
      if(arrange){event.stopPropagation();const value=arrange.value;arrange.value='';proxyArrange(value);queue(35);return;}
      proxyEvent(event);
    });
  }

  function observeTargets(){
    const artboard=byId('artboard'),inspector=byId('inspector');
    if(artboard&&!artboardObserver&&typeof MutationObserver==='function'){
      artboardObserver=new MutationObserver(()=>queue(18));artboardObserver.observe(artboard,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
    }
    if(inspector&&!inspectorObserver&&typeof MutationObserver==='function'){
      inspectorObserver=new MutationObserver(()=>queue(24));inspectorObserver.observe(inspector,{subtree:true,childList:true});
    }
  }

  function bindGlobal(){
    ['click','dblclick','change','keyup','pointerup'].forEach(name=>document.addEventListener(name,event=>{if(event.target?.closest?.(`#${BAR_ID}`))return;queue(26);},false));
    document.addEventListener('input',event=>{if(event.target?.closest?.(`#${BAR_ID}`))return;queue(26);},false);
    window.addEventListener('resize',()=>{syncOffset();queue(20);},{passive:true});
  }

  function sync(){
    clearTimeout(timer);observeTargets();return render(selectedRecord());
  }
  function queue(delay=32){clearTimeout(timer);timer=setTimeout(()=>requestAnimationFrame(sync),delay);}

  function install(){
    if(installed)return true;
    if(!document.querySelector('.editor-toolbar')||!byId('artboard')||!byId('inspector'))return false;
    installed=true;installStyles();ensureBar();observeTargets();bindGlobal();sync();
    [100,280,620,1200,2200].forEach(delay=>setTimeout(queue,delay));
    window.DesignEditorSelectionContextbar={sync,selectedRecord,stage:'selection-context-properties-v1'};
    return true;
  }

  function boot(){if(install())return;[120,320,700,1300,2300,3600].forEach(delay=>setTimeout(install,delay));}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();