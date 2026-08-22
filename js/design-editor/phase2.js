(function(){
  'use strict';
  if(window.__designEditorPhase2V1)return;
  window.__designEditorPhase2V1=true;
  const path=location.pathname.replace(/\/+$/,'')||'/';
  if(path!=='/design-editor'&&path!=='/design-editor/index.html'&&!path.endsWith('/design-editor/index.html'))return;

  const DRAFT_KEY='programTool.designEditor.draft.v1';
  const STYLE_ID='designEditorPhase2Styles';
  const CARD_ID='designPhase2Tools';
  let installed=false;
  let selectedExtraId='';
  let drag=null;
  let saveTimer=0;
  let replaceTargetId='';
  let snapClearTimer=0;
  let suppressBoardClear=false;

  const byId=id=>document.getElementById(id);
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const uid=()=>`design_extra_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,7)}`;
  const project=()=>window.DesignEditorApp?.project||null;
  function surface(){
    const p=project();
    if(!p)return null;
    const current=p.surfaces?.find(item=>item.id===p.activeSurface)||p.surfaces?.[0]||null;
    if(current&&!Array.isArray(current.extras))current.extras=[];
    return current;
  }
  const extra=()=>surface()?.extras?.find(item=>item.id===selectedExtraId)||null;

  function setStatus(message,type='info'){
    const node=byId('editorStatus');
    if(!node)return;
    node.className=`editor-status ${type}`;
    node.textContent=message;
  }

  function persist(){
    clearTimeout(saveTimer);
    const state=byId('saveState');
    if(state)state.textContent='저장 중…';
    saveTimer=setTimeout(()=>{
      try{
        const p=project();
        if(p)localStorage.setItem(DRAFT_KEY,JSON.stringify(p));
        window.DesignEditorDraftScope?.saveCurrent?.('phase2');
        if(state)state.textContent='자동 저장됨';
      }catch(error){
        if(state)state.textContent='현재 작업';
        setStatus('현재 작업을 자동 저장하지 못했습니다.','err');
      }
    },160);
  }

  function getPpm(){
    const p=project(),board=byId('artboard');
    if(!p||!board)return 1;
    const width=Math.max(1,p.width+(Number(p.bleed)||0)*2);
    return Math.max(.001,board.getBoundingClientRect().width/width);
  }

  function installStyles(){
    if(byId(STYLE_ID))return;
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      .phase2-add-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:6px}.phase2-add-grid button{border:1px solid #d7e0e9;border-radius:8px;background:#fff;color:#334155;padding:8px;font-size:9px;font-weight:900;cursor:pointer}.phase2-add-grid button:hover{border-color:#79b9c8;background:#f0fdff}.phase2-tip{margin-top:7px;font-size:8px;line-height:1.5;color:#64748b}.phase2-extra-object{position:absolute;z-index:16;box-sizing:border-box;cursor:move;touch-action:none;user-select:none}.phase2-extra-object.selected{outline:1.5px solid #0284c7;box-shadow:0 0 0 2px #ffffffb8,0 0 0 4px #0284c71f}.phase2-extra-object.locked{cursor:default}.phase2-image{overflow:hidden;background:#f8fafc}.phase2-image img{display:block;width:100%;height:100%;pointer-events:none}.phase2-shape-inner{width:100%;height:100%;pointer-events:none}.phase2-snap-guide{position:absolute;z-index:60;pointer-events:none;background:#0ea5e9;opacity:.75}.phase2-snap-guide.vertical{width:1px;top:0;bottom:0}.phase2-snap-guide.horizontal{height:1px;left:0;right:0}.phase2-inspector-actions{display:grid;grid-template-columns:repeat(3,1fr);gap:5px;margin-top:9px}.phase2-inspector-actions button{border:1px solid #d7e0e9;border-radius:8px;background:#fff;padding:7px 4px;font-size:8px;font-weight:900;cursor:pointer}.phase2-inspector-actions .danger{color:#b42318;background:#fff5f5}.phase2-text-controls{margin-top:10px;padding-top:10px;border-top:1px solid #e5eaf0}.phase2-text-controls .phase2-title{font-size:8px;font-weight:950;color:#475569;margin-bottom:7px}.phase2-layer-icon{font-size:7px!important}
    `;
    document.head.appendChild(style);
  }

  function installTools(){
    if(byId(CARD_ID))return true;
    const sidebar=document.querySelector('.sidebar');
    const inspector=byId('inspector');
    if(!sidebar||!inspector)return false;
    const card=document.createElement('section');
    card.id=CARD_ID;
    card.className='side-card';
    card.innerHTML=`<div class="side-label">이미지·도형 추가</div><div class="phase2-add-grid"><button id="phase2AddImage" type="button">이미지</button><button id="phase2AddRect" type="button">사각형</button><button id="phase2AddEllipse" type="button">원·타원</button><button id="phase2AddLine" type="button">선</button></div><div class="phase2-tip">이동할 때 중앙·안전여백·접지선에 자동으로 맞춰집니다.</div><input id="phase2ImageInput" type="file" accept="image/jpeg,image/png,image/webp" hidden>`;
    sidebar.insertBefore(card,inspector);
    byId('phase2AddImage')?.addEventListener('click',()=>{replaceTargetId='';byId('phase2ImageInput')?.click();});
    byId('phase2AddRect')?.addEventListener('click',()=>addShape('rect'));
    byId('phase2AddEllipse')?.addEventListener('click',()=>addShape('ellipse'));
    byId('phase2AddLine')?.addEventListener('click',()=>addShape('line'));
    byId('phase2ImageInput')?.addEventListener('change',handleImageInput);
    return true;
  }

  function addShape(kind){
    const p=project(),s=surface();
    if(!p||!s)return setStatus('먼저 작업 규격을 선택하세요.','err');
    const w=kind==='line'?Math.min(90,p.width*.55):Math.min(70,p.width*.38);
    const h=kind==='line'?1.2:Math.min(42,p.height*.2);
    const item={id:uid(),type:'shape',shape:kind,name:kind==='rect'?'사각형':kind==='ellipse'?'원·타원':'선',x:(p.width-w)/2,y:(p.height-h)/2,w,h,fill:kind==='line'?'#12396d':'#dceeff',stroke:'#12396d',strokeWidth:1,opacity:100,locked:false,visible:true};
    s.extras.push(item);selectedExtraId=item.id;clearBaseSelection();persist();sync();setStatus(`${item.name}을 추가했습니다.`,'ok');
  }

  function loadImageElement(src){
    return new Promise((resolve,reject)=>{
      const image=new Image();
      image.onload=()=>resolve(image);
      image.onerror=()=>reject(new Error('이미지를 읽지 못했습니다.'));
      image.src=src;
    });
  }

  function blobToDataUrl(blob){
    return new Promise((resolve,reject)=>{
      const reader=new FileReader();
      reader.onload=()=>resolve(String(reader.result||''));
      reader.onerror=()=>reject(reader.error||new Error('이미지를 변환하지 못했습니다.'));
      reader.readAsDataURL(blob);
    });
  }

  async function prepareImage(file){
    if(!file||!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('JPG·PNG·WEBP 이미지만 사용할 수 있습니다.');
    if(file.size>12*1024*1024)throw new Error('이미지는 12MB 이하만 사용할 수 있습니다.');
    const source=URL.createObjectURL(file);
    try{
      const image=await loadImageElement(source);
      if(image.naturalWidth*image.naturalHeight>50000000)throw new Error('이미지 해상도는 5천만 픽셀 이하여야 합니다.');
      const maxSide=1800;
      const scale=Math.min(1,maxSide/Math.max(image.naturalWidth,image.naturalHeight));
      const width=Math.max(1,Math.round(image.naturalWidth*scale));
      const height=Math.max(1,Math.round(image.naturalHeight*scale));
      const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
      const ctx=canvas.getContext('2d',{alpha:true});ctx.drawImage(image,0,0,width,height);
      const blob=await new Promise((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('이미지 최적화에 실패했습니다.')),'image/webp',.9));
      return {blob,aspect:image.naturalWidth/Math.max(1,image.naturalHeight)};
    }finally{URL.revokeObjectURL(source);}
  }

  async function storePreparedImage(data,name){
    const assetStore=window.DesignEditorAssetStore;
    if(assetStore?.storeBlob){
      try{return await assetStore.storeBlob(data.blob,{name});}catch(error){console.warn('IndexedDB image storage fallback',error);}
    }
    return {assetId:'',src:await blobToDataUrl(data.blob)};
  }

  async function handleImageInput(event){
    const input=event.currentTarget;
    const file=input.files?.[0];input.value='';
    if(!file)return;
    try{
      const data=await prepareImage(file);
      const stored=await storePreparedImage(data,file.name);
      const p=project(),s=surface();if(!p||!s)return;
      const target=replaceTargetId?s.extras.find(item=>item.id===replaceTargetId&&item.type==='image'):null;
      if(target){
        target.src=stored.src;
        if(stored.assetId)target.assetId=stored.assetId;else delete target.assetId;
        target.name=file.name;target.aspect=data.aspect;replaceTargetId='';selectedExtraId=target.id;
      }else{
        const w=Math.min(90,p.width*.5),h=Math.min(w/data.aspect,p.height*.45);
        const item={id:uid(),type:'image',name:file.name,src:stored.src,aspect:data.aspect,x:(p.width-w)/2,y:(p.height-h)/2,w,h,fit:'cover',focusX:50,focusY:50,opacity:100,locked:false,visible:true};
        if(stored.assetId)item.assetId=stored.assetId;
        s.extras.push(item);selectedExtraId=item.id;
      }
      clearBaseSelection();persist();sync();setStatus('이미지를 작업영역에 추가했습니다.','ok');
    }catch(error){replaceTargetId='';setStatus(error.message||'이미지를 추가하지 못했습니다.','err');}
  }

  function clearBaseSelection(){
    const board=byId('artboard');if(!board)return;
    suppressBoardClear=true;
    try{board.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,clientX:0,clientY:0}));}
    finally{suppressBoardClear=false;}
  }

  function selectExtra(id){selectedExtraId=id||'';if(id)clearBaseSelection();sync();}

  function snapPosition(item,x,y){
    const p=project(),s=surface();if(!p)return{x,y,guides:[]};
    const threshold=2.5;
    const xTargets=[0,p.safe,Math.max(0,p.width-item.w),Math.max(0,p.width-p.safe-item.w),Math.max(0,(p.width-item.w)/2)];
    (s?.folds||[]).forEach(value=>{xTargets.push(value,Math.max(0,value-item.w/2));});
    const yTargets=[0,p.safe,Math.max(0,p.height-item.h),Math.max(0,p.height-p.safe-item.h),Math.max(0,(p.height-item.h)/2)];
    let sx=clamp(x,0,Math.max(0,p.width-item.w)),sy=clamp(y,0,Math.max(0,p.height-item.h));
    let gx=null,gy=null,bestX=threshold+1,bestY=threshold+1;
    xTargets.forEach(target=>{const d=Math.abs(sx-target);if(d<bestX&&d<=threshold){bestX=d;sx=target;gx=target;}});
    yTargets.forEach(target=>{const d=Math.abs(sy-target);if(d<bestY&&d<=threshold){bestY=d;sy=target;gy=target;}});
    return{x:sx,y:sy,guides:[gx==null?null:{axis:'x',value:gx},gy==null?null:{axis:'y',value:gy}].filter(Boolean)};
  }

  function showSnapGuides(guides=[]){
    const board=byId('artboard'),p=project();if(!board||!p)return;
    board.querySelectorAll('.phase2-snap-guide').forEach(node=>node.remove());
    const scale=getPpm();
    guides.forEach(guide=>{const line=document.createElement('span');line.className=`phase2-snap-guide ${guide.axis==='x'?'vertical':'horizontal'}`;if(guide.axis==='x')line.style.left=`${(p.bleed+guide.value)*scale}px`;else line.style.top=`${(p.bleed+guide.value)*scale}px`;board.appendChild(line);});
    clearTimeout(snapClearTimer);snapClearTimer=setTimeout(()=>board.querySelectorAll('.phase2-snap-guide').forEach(node=>node.remove()),500);
  }

  function applyPosition(node,item){
    const p=project(),scale=getPpm();if(!p||!node)return;
    node.style.left=`${(p.bleed+item.x)*scale}px`;node.style.top=`${(p.bleed+item.y)*scale}px`;node.style.width=`${Math.max(.5,item.w)*scale}px`;node.style.height=`${Math.max(.5,item.h)*scale}px`;
  }

  function renderExtras(){
    const board=byId('artboard'),s=surface();if(!board||!s)return;
    board.querySelectorAll('.phase2-extra-object').forEach(node=>node.remove());
    const scale=getPpm();
    s.extras.forEach((item,index)=>{
      if(item.visible===false)return;
      const node=document.createElement('div');node.dataset.extraId=item.id;node.className=`phase2-extra-object${item.type==='image'?' phase2-image':''}${item.id===selectedExtraId?' selected':''}${item.locked?' locked':''}`;node.style.zIndex=String(16+index);node.style.opacity=String(clamp(Number(item.opacity)||100,1,100)/100);applyPosition(node,item);
      if(item.type==='image'){
        const image=document.createElement('img');if(item.src)image.src=item.src;image.alt='';image.draggable=false;image.style.objectFit=item.fit==='contain'?'contain':'cover';image.style.objectPosition=`${clamp(Number(item.focusX)||50,0,100)}% ${clamp(Number(item.focusY)||50,0,100)}%`;node.appendChild(image);
      }else{
        const inner=document.createElement('div');inner.className='phase2-shape-inner';
        if(item.shape==='line'){inner.style.background=item.stroke||'#12396d';inner.style.height=`${Math.max(1,(Number(item.strokeWidth)||1)*scale)}px`;inner.style.marginTop=`${Math.max(0,(item.h*scale-Math.max(1,(Number(item.strokeWidth)||1)*scale))/2)}px`;}
        else{inner.style.background=item.fill||'#dceeff';inner.style.border=`${Math.max(1,(Number(item.strokeWidth)||1)*scale)}px solid ${item.stroke||'#12396d'}`;inner.style.borderRadius=item.shape==='ellipse'?'50%':'0';}
        node.appendChild(inner);
      }
      node.addEventListener('pointerdown',event=>startExtraDrag(event,item,node));
      node.addEventListener('click',event=>{event.stopPropagation();selectExtra(item.id);});
      board.appendChild(node);
    });
  }

  function startExtraDrag(event,item,node){
    if(event.button!==0||item.locked)return;
    selectedExtraId=item.id;clearBaseSelection();
    drag={id:item.id,startX:event.clientX,startY:event.clientY,x:item.x,y:item.y,node};
    try{node.setPointerCapture(event.pointerId);}catch(_){}
    event.preventDefault();event.stopPropagation();syncExtraInspector();renderExtraLayers();
  }

  function handlePointerMove(event){
    if(drag){
      const item=extra();if(!item||item.id!==drag.id)return;
      const scale=getPpm();const next=snapPosition(item,drag.x+(event.clientX-drag.startX)/scale,drag.y+(event.clientY-drag.startY)/scale);
      item.x=next.x;item.y=next.y;applyPosition(drag.node,item);showSnapGuides(next.guides);event.preventDefault();return;
    }
    if(!event.buttons)return;
    const p=project(),s=surface(),node=document.querySelector('.design-text.selected');
    if(!p||!s||!node||event.target?.isContentEditable)return;
    const id=node.dataset.id,item=s.elements?.find(entry=>entry.id===id&&entry.type==='text');if(!item||item.locked)return;
    const height=Math.max(7,(Number(item.size)||11)*0.3528*(Number(item.lineHeight)||1.26));
    const proxy={w:Number(item.w)||40,h:height};const next=snapPosition(proxy,Number(item.x)||0,Number(item.y)||0);item.x=next.x;item.y=next.y;applyTextPosition(node,item);if(next.guides.length)showSnapGuides(next.guides);
  }

  function handlePointerUp(){if(!drag)return;drag=null;persist();sync();}

  function applyTextPosition(node,item){
    const p=project(),scale=getPpm();if(!p||!node)return;
    node.style.left=`${(p.bleed+item.x)*scale}px`;node.style.top=`${(p.bleed+item.y)*scale}px`;
  }

  function updateExtra(field,value){
    const item=extra(),p=project();if(!item||!p)return;
    if(['x','y','w','h','opacity','strokeWidth','focusX','focusY'].includes(field))value=Number(value);
    item[field]=value;
    item.w=clamp(Number(item.w)||1,1,p.width);item.h=clamp(Number(item.h)||1,.5,p.height);item.x=clamp(Number(item.x)||0,0,Math.max(0,p.width-item.w));item.y=clamp(Number(item.y)||0,0,Math.max(0,p.height-item.h));item.opacity=clamp(Number(item.opacity)||100,1,100);item.strokeWidth=clamp(Number(item.strokeWidth)||1,.2,12);persist();renderExtras();renderExtraLayers();
  }

  function removeExtra(){
    const s=surface();if(!s||!selectedExtraId)return;
    s.extras=s.extras.filter(item=>item.id!==selectedExtraId);selectedExtraId='';persist();clearBaseSelection();sync();
  }

  function duplicateExtra(){
    const s=surface(),item=extra(),p=project();if(!s||!item||!p)return;
    const copy={...item,id:uid(),name:`${item.name||'요소'} 복사본`,x:clamp(item.x+4,0,Math.max(0,p.width-item.w)),y:clamp(item.y+4,0,Math.max(0,p.height-item.h)),locked:false};
    s.extras.push(copy);selectedExtraId=copy.id;persist();sync();
  }

  function moveExtra(direction){
    const s=surface();if(!s)return;const index=s.extras.findIndex(item=>item.id===selectedExtraId);if(index<0)return;
    const to=direction==='front'?Math.min(s.extras.length-1,index+1):Math.max(0,index-1);if(to===index)return;
    const [item]=s.extras.splice(index,1);s.extras.splice(to,0,item);persist();sync();
  }

  function syncExtraInspector(){
    const root=byId('inspector'),item=extra(),p=project();if(!root||!item||!p)return;
    const typeLabel=item.type==='image'?'이미지':item.shape==='rect'?'사각형':item.shape==='ellipse'?'원·타원':'선';
    root.innerHTML=`<div class="inspector-title">${typeLabel} 설정</div><div class="inspector-note">선택한 요소 하나만 조절합니다. 이동할 때 정렬 기준에 자동으로 붙습니다.</div><div class="field-grid"><div class="field"><label>X mm</label><input data-extra-field="x" type="number" step="0.5" value="${item.x.toFixed(1)}"></div><div class="field"><label>Y mm</label><input data-extra-field="y" type="number" step="0.5" value="${item.y.toFixed(1)}"></div></div><div class="field-grid"><div class="field"><label>가로 mm</label><input data-extra-field="w" type="number" min="1" step="0.5" value="${item.w.toFixed(1)}"></div><div class="field"><label>세로 mm</label><input data-extra-field="h" type="number" min="0.5" step="0.5" value="${item.h.toFixed(1)}"></div></div>${item.type==='image'?`<div class="field"><label>이미지 맞춤</label><select data-extra-field="fit"><option value="cover"${item.fit!=='contain'?' selected':''}>영역 채우기</option><option value="contain"${item.fit==='contain'?' selected':''}>전체 보이기</option></select></div><div class="field-grid"><div class="field"><label>가로 초점 %</label><input data-extra-field="focusX" type="number" min="0" max="100" value="${item.focusX??50}"></div><div class="field"><label>세로 초점 %</label><input data-extra-field="focusY" type="number" min="0" max="100" value="${item.focusY??50}"></div></div><button class="wide-btn" id="phase2ReplaceImage" type="button">이미지 교체</button>`:`<div class="field-grid"><div class="field"><label>${item.shape==='line'?'선 색상':'채우기'}</label><input data-extra-field="${item.shape==='line'?'stroke':'fill'}" type="color" value="${item.shape==='line'?(item.stroke||'#12396d'):(item.fill||'#dceeff')}"></div><div class="field"><label>테두리 색상</label><input data-extra-field="stroke" type="color" value="${item.stroke||'#12396d'}"></div></div><div class="field"><label>선 두께</label><input data-extra-field="strokeWidth" type="number" min="0.2" max="12" step="0.2" value="${item.strokeWidth||1}"></div>`}<div class="field"><label>불투명도 %</label><input data-extra-field="opacity" type="number" min="1" max="100" value="${item.opacity||100}"></div><label class="check-row"><input id="phase2ExtraLock" type="checkbox"${item.locked?' checked':''}> 이 요소 잠금</label><div class="phase2-inspector-actions"><button id="phase2ExtraBack" type="button">뒤로</button><button id="phase2ExtraFront" type="button">앞으로</button><button id="phase2ExtraDuplicate" type="button">복제</button><button id="phase2ExtraDelete" type="button" class="danger">삭제</button></div>`;
    root.querySelectorAll('[data-extra-field]').forEach(control=>{const eventName=control.tagName==='SELECT'?'change':'input';control.addEventListener(eventName,()=>updateExtra(control.dataset.extraField,control.value));});
    byId('phase2ExtraLock').onchange=event=>{item.locked=event.target.checked;persist();renderExtras();renderExtraLayers();};
    byId('phase2ExtraBack').onclick=()=>moveExtra('back');byId('phase2ExtraFront').onclick=()=>moveExtra('front');byId('phase2ExtraDuplicate').onclick=duplicateExtra;byId('phase2ExtraDelete').onclick=removeExtra;
    const replace=byId('phase2ReplaceImage');if(replace)replace.onclick=()=>{replaceTargetId=item.id;byId('phase2ImageInput')?.click();};
  }

  function applyTextEnhancements(){
    const s=surface(),node=document.querySelector('.design-text.selected');if(!s||!node)return;
    const item=s.elements?.find(entry=>entry.id===node.dataset.id&&entry.type==='text');if(!item)return;
    node.style.letterSpacing=`${(Number(item.letterSpacing)||0)*getPpm()}px`;node.style.lineHeight=String(Number(item.lineHeight)||1.26);
    if(selectedExtraId)return;
    const root=byId('inspector');if(!root||byId('phase2TextControls'))return;
    const box=document.createElement('div');box.id='phase2TextControls';box.className='phase2-text-controls';
    box.innerHTML=`<div class="phase2-title">글자 간격·줄 간격</div><div class="field-grid"><div class="field"><label>글자 간격 mm</label><input id="phase2LetterSpacing" type="number" min="-2" max="10" step="0.1" value="${Number(item.letterSpacing)||0}"></div><div class="field"><label>줄 간격</label><input id="phase2LineHeight" type="number" min="0.8" max="3" step="0.05" value="${Number(item.lineHeight)||1.26}"></div></div>`;
    root.appendChild(box);
    byId('phase2LetterSpacing').oninput=event=>{item.letterSpacing=clamp(Number(event.target.value)||0,-2,10);persist();applyTextEnhancements();};
    byId('phase2LineHeight').oninput=event=>{item.lineHeight=clamp(Number(event.target.value)||1.26,.8,3);persist();applyTextEnhancements();};
  }

  function renderExtraLayers(){
    const root=byId('layerList'),s=surface();if(!root||!s)return;
    root.querySelectorAll('[data-phase2-layer]').forEach(node=>node.remove());
    [...s.extras].reverse().forEach(item=>{
      const row=document.createElement('button');row.type='button';row.className=`layer-row${item.id===selectedExtraId?' on':''}`;row.dataset.phase2Layer=item.id;
      const icon=item.type==='image'?'IMG':item.shape==='rect'?'□':item.shape==='ellipse'?'○':'—';
      row.innerHTML=`<span class="layer-kind phase2-layer-icon">${icon}</span><span class="layer-name">${String(item.name||'요소').replace(/[&<>"']/g,'')}</span><span class="layer-state">${item.locked?'잠금':''}</span>`;
      row.addEventListener('click',()=>selectExtra(item.id));root.appendChild(row);
    });
  }

  function sync(){
    if(!project()||byId('editorShell')?.classList.contains('hidden'))return;
    surface();renderExtras();renderExtraLayers();
    if(selectedExtraId&&extra())syncExtraInspector();else if(selectedExtraId)selectedExtraId='';
    applyTextEnhancements();
  }

  function queueSync(){requestAnimationFrame(()=>requestAnimationFrame(sync));}

  async function hydrateAssets(){
    const p=project(),assetStore=window.DesignEditorAssetStore;
    if(!p||!assetStore?.ensureProject)return false;
    try{
      const result=await assetStore.ensureProject(p);
      if(result.changed){
        try{localStorage.setItem(DRAFT_KEY,JSON.stringify(p));}catch(_){}
        window.DesignEditorDraftScope?.saveCurrent?.('asset-migration');
        queueSync();
      }
      if(result.missing)setStatus(`${result.missing}개 이미지의 저장본을 찾지 못했습니다.`,'err');
      return true;
    }catch(error){console.warn('Design asset hydration failed',error);return false;}
  }

  function bindGlobal(){
    document.addEventListener('pointermove',handlePointerMove,{passive:false});document.addEventListener('pointerup',handlePointerUp);document.addEventListener('pointercancel',handlePointerUp);
    ['click','dblclick','input','change','keyup'].forEach(name=>document.addEventListener(name,event=>{
      if(name==='click'){
        if(event.target?.closest?.('.design-text'))selectedExtraId='';
        else if(event.target===byId('artboard')&&!suppressBoardClear)selectedExtraId='';
      }
      queueSync();
    },false));
    window.addEventListener('resize',queueSync,{passive:true});
    document.addEventListener('keydown',event=>{
      const tag=String(event.target?.tagName||'').toUpperCase();if(['INPUT','TEXTAREA','SELECT'].includes(tag)||event.target?.isContentEditable)return;
      if((event.key==='Delete'||event.key==='Backspace')&&selectedExtraId){event.preventDefault();removeExtra();}
      if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='d'&&selectedExtraId){event.preventDefault();duplicateExtra();}
    });
  }

  function install(){
    if(installed)return true;
    if(!document.querySelector('.sidebar')||!byId('artboard')||!byId('inspector'))return false;
    installed=true;installStyles();installTools();bindGlobal();
    window.DesignEditorPhase2={sync,addShape,hydrateAssets,stage:'indexeddb-images-shapes-snapping-text-spacing'};
    hydrateAssets();
    [250,700,1300,2200].forEach(delay=>setTimeout(queueSync,delay));
    return true;
  }

  function boot(){if(install())return;[200,500,1000,1800,3000].forEach(delay=>setTimeout(install,delay));}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
