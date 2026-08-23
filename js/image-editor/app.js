(function(root){
  'use strict';
  if(root.ImageEditorApp)return;

  const MAX_PIXELS=60_000_000;
  const PREVIEW_MAX_W=1280;
  const PREVIEW_MAX_H=900;
  const state={
    base:null,
    originalBlob:null,
    originalName:'image',
    crop:null,
    adjustments:{brightness:100,contrast:100,saturation:100},
    history:[],
    loaded:false
  };
  let drag=null;
  let ratioSync=false;

  const $=id=>document.getElementById(id);
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const round=value=>Math.round(Number(value)||0);

  function makeCanvas(width,height){
    const canvas=document.createElement('canvas');
    canvas.width=Math.max(1,round(width));canvas.height=Math.max(1,round(height));
    return canvas;
  }
  function copyCanvas(source){
    const canvas=makeCanvas(source.width,source.height);
    canvas.getContext('2d').drawImage(source,0,0);
    return canvas;
  }
  function imagePixels(width,height){return Math.max(0,Number(width)||0)*Math.max(0,Number(height)||0);}
  function ensureSafeSize(width,height){
    if(width<1||height<1||width>20000||height>20000||imagePixels(width,height)>MAX_PIXELS){
      throw new Error('이미지 크기가 너무 큽니다. 가로·세로와 전체 픽셀 수를 줄여주세요.');
    }
  }
  function filterString(){
    const a=state.adjustments;
    return `brightness(${a.brightness}%) contrast(${a.contrast}%) saturate(${a.saturation}%)`;
  }
  function currentRect(){
    if(!state.base)return null;
    const raw=state.crop||{x:0,y:0,w:state.base.width,h:state.base.height};
    const x=clamp(round(raw.x),0,state.base.width-1);
    const y=clamp(round(raw.y),0,state.base.height-1);
    const w=clamp(round(raw.w),1,state.base.width-x);
    const h=clamp(round(raw.h),1,state.base.height-y);
    return{x,y,w,h};
  }
  function setStatus(message,type='ok'){
    const node=$('statusText');if(!node)return;
    node.textContent=message;node.dataset.type=type;
  }
  function setEnabled(enabled){
    document.querySelectorAll('[data-requires-image]').forEach(node=>node.setAttribute('aria-disabled',enabled?'false':'true'));
    ['undoBtn','resetBtn','exportBtn'].forEach(id=>{const node=$(id);if(node)node.disabled=!enabled||(id==='undoBtn'&&!state.history.length)});
  }
  function updateMeta(){
    const base=state.base;
    const dims=$('dimensionText');
    if(dims)dims.textContent=base?`${base.width.toLocaleString()} × ${base.height.toLocaleString()} px`:'—';
    const meta=$('fileMeta');
    if(meta&&base)meta.textContent=`${state.originalName} · ${base.width.toLocaleString()} × ${base.height.toLocaleString()} px`;
    if(base){
      if($('resizeW'))$('resizeW').value=String(base.width);
      if($('resizeH'))$('resizeH').value=String(base.height);
    }
    setEnabled(Boolean(base));
  }
  function updateAdjustOutputs(){
    [['brightness','brightnessOut'],['contrast','contrastOut'],['saturation','saturationOut']].forEach(([inputId,outId])=>{
      const input=$(inputId),out=$(outId);if(input&&out)out.value=`${input.value}%`;
    });
  }
  function syncCropFields(){
    const rect=currentRect();if(!rect)return;
    $('cropX').value=String(rect.x);$('cropY').value=String(rect.y);$('cropW').value=String(rect.w);$('cropH').value=String(rect.h);
  }
  function readCropFields(){
    if(!state.base)return null;
    return setCrop({x:Number($('cropX').value),y:Number($('cropY').value),w:Number($('cropW').value),h:Number($('cropH').value)},false);
  }
  function previewSize(){
    if(!state.base)return{width:1,height:1,scale:1};
    const scale=Math.min(1,PREVIEW_MAX_W/state.base.width,PREVIEW_MAX_H/state.base.height);
    return{width:Math.max(1,round(state.base.width*scale)),height:Math.max(1,round(state.base.height*scale)),scale};
  }
  function renderPreview(){
    if(!state.base)return false;
    const preview=$('previewCanvas');if(!preview)return false;
    const size=previewSize();preview.width=size.width;preview.height=size.height;
    const ctx=preview.getContext('2d');ctx.clearRect(0,0,preview.width,preview.height);ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.filter=filterString();ctx.drawImage(state.base,0,0,preview.width,preview.height);ctx.filter='none';
    renderCropOverlay();return true;
  }
  function renderCropOverlay(){
    const overlay=$('cropOverlay'),preview=$('previewCanvas'),rect=currentRect();
    if(!overlay||!preview||!rect||!state.base)return;
    const sx=preview.clientWidth/state.base.width,sy=preview.clientHeight/state.base.height;
    const full=rect.x===0&&rect.y===0&&rect.w===state.base.width&&rect.h===state.base.height;
    overlay.hidden=full;
    overlay.style.left=`${rect.x*sx}px`;overlay.style.top=`${rect.y*sy}px`;overlay.style.width=`${rect.w*sx}px`;overlay.style.height=`${rect.h*sy}px`;
  }
  function resetCrop(){
    if(!state.base)return;
    state.crop={x:0,y:0,w:state.base.width,h:state.base.height};syncCropFields();renderCropOverlay();
  }
  function setCrop(rect,render=true){
    if(!state.base)return null;
    const x=clamp(round(rect?.x),0,state.base.width-1),y=clamp(round(rect?.y),0,state.base.height-1);
    const w=clamp(round(rect?.w)||1,1,state.base.width-x),h=clamp(round(rect?.h)||1,1,state.base.height-y);
    state.crop={x,y,w,h};syncCropFields();if(render)renderCropOverlay();return{...state.crop};
  }
  function historyLimit(){return imagePixels(state.base?.width,state.base?.height)>12_000_000?2:8;}
  function pushHistory(label){
    if(!state.base)return;
    state.history.push({canvas:copyCanvas(state.base),crop:{...currentRect()},adjustments:{...state.adjustments},label});
    while(state.history.length>historyLimit())state.history.shift();
    setEnabled(true);
  }
  function undo(){
    const previous=state.history.pop();if(!previous)return false;
    state.base=previous.canvas;state.crop={...previous.crop};state.adjustments={...previous.adjustments};
    syncAdjustInputs();syncCropFields();updateMeta();renderPreview();setStatus(`${previous.label||'이전 작업'} 전 상태로 되돌렸습니다.`);return true;
  }
  function syncAdjustInputs(){
    Object.entries(state.adjustments).forEach(([key,value])=>{const node=$(key);if(node)node.value=String(value)});updateAdjustOutputs();
  }
  async function decodeBlob(blob){
    if(!blob||!String(blob.type||'').startsWith('image/'))throw new Error('지원되는 이미지 파일을 선택해주세요.');
    if(typeof createImageBitmap==='function'){
      try{return await createImageBitmap(blob,{imageOrientation:'from-image'});}catch(_){}
    }
    return await new Promise((resolve,reject)=>{
      const url=URL.createObjectURL(blob),img=new Image();
      img.onload=()=>{URL.revokeObjectURL(url);resolve(img)};
      img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('이미지를 읽을 수 없습니다.'))};img.src=url;
    });
  }
  async function loadBlob(blob,name='image',options={}){
    try{
      setStatus('이미지를 불러오는 중입니다…');
      const bitmap=await decodeBlob(blob),width=bitmap.naturalWidth||bitmap.width,height=bitmap.naturalHeight||bitmap.height;
      ensureSafeSize(width,height);
      const canvas=makeCanvas(width,height),ctx=canvas.getContext('2d');ctx.drawImage(bitmap,0,0,width,height);if(typeof bitmap.close==='function')bitmap.close();
      state.base=canvas;state.loaded=true;state.history=[];state.adjustments={brightness:100,contrast:100,saturation:100};
      if(!options.preserveOriginal){state.originalBlob=blob;state.originalName=String(name||'image').replace(/[\\/:*?"<>|]+/g,'_')||'image';}
      resetCrop();syncAdjustInputs();
      $('emptyState').hidden=true;$('canvasViewport').hidden=false;updateMeta();renderPreview();
      setStatus('이미지를 불러왔습니다. 미리보기에서 드래그하면 자를 영역을 지정할 수 있습니다.');
      return{width,height,name:state.originalName};
    }catch(error){setStatus(error.message||String(error),'error');throw error;}
  }
  async function loadFile(file){return loadBlob(file,file?.name||'image');}
  function transform(kind){
    if(!state.base)return false;
    pushHistory(kind==='rotate-left'?'왼쪽 회전':kind==='rotate-right'?'오른쪽 회전':kind==='flip-h'?'좌우 반전':'상하 반전');
    const src=state.base,w=src.width,h=src.height;
    let out,ctx;
    if(kind==='rotate-left'||kind==='rotate-right'){
      out=makeCanvas(h,w);ctx=out.getContext('2d');
      if(kind==='rotate-right'){ctx.translate(h,0);ctx.rotate(Math.PI/2)}else{ctx.translate(0,w);ctx.rotate(-Math.PI/2)}
      ctx.drawImage(src,0,0);
    }else{
      out=makeCanvas(w,h);ctx=out.getContext('2d');
      if(kind==='flip-h'){ctx.translate(w,0);ctx.scale(-1,1)}else{ctx.translate(0,h);ctx.scale(1,-1)}
      ctx.drawImage(src,0,0);
    }
    state.base=out;resetCrop();updateMeta();renderPreview();setStatus('이미지 방향을 변경했습니다.');return true;
  }
  const rotateLeft=()=>transform('rotate-left');
  const rotateRight=()=>transform('rotate-right');
  const flipHorizontal=()=>transform('flip-h');
  const flipVertical=()=>transform('flip-v');
  function applyCrop(){
    if(!state.base)return false;
    const rect=readCropFields()||currentRect();
    if(rect.x===0&&rect.y===0&&rect.w===state.base.width&&rect.h===state.base.height){setStatus('현재 전체 이미지가 선택되어 있습니다.');return false;}
    pushHistory('자르기');
    const out=makeCanvas(rect.w,rect.h);out.getContext('2d').drawImage(state.base,rect.x,rect.y,rect.w,rect.h,0,0,rect.w,rect.h);state.base=out;resetCrop();updateMeta();renderPreview();setStatus(`이미지를 ${rect.w} × ${rect.h}px로 잘랐습니다.`);return true;
  }
  function resize(width,height){
    if(!state.base)return false;
    width=round(width);height=round(height);ensureSafeSize(width,height);
    if(width===state.base.width&&height===state.base.height)return false;
    pushHistory('크기 조절');
    const out=makeCanvas(width,height),ctx=out.getContext('2d');ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(state.base,0,0,width,height);state.base=out;resetCrop();updateMeta();renderPreview();setStatus(`이미지 크기를 ${width} × ${height}px로 변경했습니다.`);return true;
  }
  function setAdjustments(next={}){
    ['brightness','contrast','saturation'].forEach(key=>{
      if(next[key]!=null)state.adjustments[key]=clamp(round(next[key]),key==='saturation'?0:20,key==='saturation'?200:180);
    });
    syncAdjustInputs();renderPreview();return{...state.adjustments};
  }
  function resetAdjustments(){setAdjustments({brightness:100,contrast:100,saturation:100});setStatus('보정값을 기본으로 되돌렸습니다.');}
  function renderOutput(mime='image/png'){
    if(!state.base)return null;
    const out=makeCanvas(state.base.width,state.base.height),ctx=out.getContext('2d');
    if(mime==='image/jpeg'){ctx.fillStyle='#fff';ctx.fillRect(0,0,out.width,out.height)}
    ctx.filter=filterString();ctx.drawImage(state.base,0,0);ctx.filter='none';return out;
  }
  function canvasToBlob(canvas,mime,quality){
    return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('이미지 저장 데이터를 만들지 못했습니다.')),mime,quality));
  }
  async function exportBlob(mime=$('exportFormat')?.value||'image/png',quality=(Number($('exportQuality')?.value)||92)/100){
    if(!state.base)throw new Error('먼저 이미지를 불러와주세요.');
    return canvasToBlob(renderOutput(mime),mime,clamp(Number(quality)||.92,.1,1));
  }
  function exportExtension(mime){return mime==='image/jpeg'?'jpg':mime==='image/webp'?'webp':'png';}
  async function downloadExport(){
    try{
      const mime=$('exportFormat')?.value||'image/png',quality=(Number($('exportQuality')?.value)||92)/100,blob=await exportBlob(mime,quality);
      const url=URL.createObjectURL(blob),a=document.createElement('a'),stem=state.originalName.replace(/\.[^.]+$/,'')||'image';
      a.href=url;a.download=`${stem}-edited.${exportExtension(mime)}`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1200);setStatus(`${a.download} 저장을 시작했습니다.`);return blob;
    }catch(error){setStatus(error.message||String(error),'error');throw error;}
  }
  async function resetOriginal(){
    if(!state.originalBlob)return false;
    await loadBlob(state.originalBlob,state.originalName,{preserveOriginal:true});setStatus('처음 불러온 원본으로 복원했습니다.');return true;
  }
  function centerSquare(){
    if(!state.base)return;
    const size=Math.min(state.base.width,state.base.height);setCrop({x:(state.base.width-size)/2,y:(state.base.height-size)/2,w:size,h:size});setStatus('가운데 정사각형 영역을 선택했습니다.');
  }
  function pointerPosition(event){
    const preview=$('previewCanvas'),box=preview.getBoundingClientRect();
    return{x:clamp((event.clientX-box.left)*state.base.width/box.width,0,state.base.width),y:clamp((event.clientY-box.top)*state.base.height/box.height,0,state.base.height)};
  }
  function bindCropDrag(){
    const preview=$('previewCanvas');if(!preview)return;
    preview.addEventListener('pointerdown',event=>{if(!state.base)return;preview.setPointerCapture?.(event.pointerId);const p=pointerPosition(event);drag={x:p.x,y:p.y};setCrop({x:p.x,y:p.y,w:1,h:1});event.preventDefault()});
    preview.addEventListener('pointermove',event=>{if(!drag||!state.base)return;const p=pointerPosition(event),x=Math.min(drag.x,p.x),y=Math.min(drag.y,p.y),w=Math.max(1,Math.abs(p.x-drag.x)),h=Math.max(1,Math.abs(p.y-drag.y));setCrop({x,y,w,h});});
    const stop=()=>{if(drag){drag=null;setStatus('자를 영역을 선택했습니다. 자르기 적용을 누르면 반영됩니다.')}};
    preview.addEventListener('pointerup',stop);preview.addEventListener('pointercancel',stop);
  }
  function bindFileInput(){
    const input=$('fileInput'),open=()=>input?.click();$('openBtn')?.addEventListener('click',open);$('dropZone')?.addEventListener('click',event=>{if(event.target?.closest?.('canvas'))return;if(!state.loaded)open()});$('dropZone')?.addEventListener('keydown',event=>{if(!state.loaded&&(event.key==='Enter'||event.key===' ')){event.preventDefault();open()}});
    input?.addEventListener('change',()=>{const file=input.files?.[0];if(file)loadFile(file);input.value=''});
    const zone=$('dropZone');['dragenter','dragover'].forEach(name=>zone?.addEventListener(name,event=>{event.preventDefault();zone.classList.add('dragging')}));['dragleave','drop'].forEach(name=>zone?.addEventListener(name,event=>{event.preventDefault();zone.classList.remove('dragging')}));zone?.addEventListener('drop',event=>{const file=[...(event.dataTransfer?.files||[])].find(item=>item.type.startsWith('image/'));if(file)loadFile(file)});
  }
  function bindControls(){
    $('undoBtn')?.addEventListener('click',undo);$('resetBtn')?.addEventListener('click',resetOriginal);$('exportBtn')?.addEventListener('click',downloadExport);$('exportSideBtn')?.addEventListener('click',downloadExport);
    $('rotateLeftBtn')?.addEventListener('click',rotateLeft);$('rotateRightBtn')?.addEventListener('click',rotateRight);$('flipHBtn')?.addEventListener('click',flipHorizontal);$('flipVBtn')?.addEventListener('click',flipVertical);
    ['cropX','cropY','cropW','cropH'].forEach(id=>$(id)?.addEventListener('input',()=>readCropFields()));$('squareCropBtn')?.addEventListener('click',centerSquare);$('fullCropBtn')?.addEventListener('click',()=>{resetCrop();setStatus('전체 이미지 영역을 선택했습니다.')});$('applyCropBtn')?.addEventListener('click',applyCrop);
    $('resizeW')?.addEventListener('input',()=>{if(ratioSync||!state.base||!$('lockRatio').checked)return;ratioSync=true;$('resizeH').value=String(Math.max(1,round(Number($('resizeW').value)*state.base.height/state.base.width)));ratioSync=false});
    $('resizeH')?.addEventListener('input',()=>{if(ratioSync||!state.base||!$('lockRatio').checked)return;ratioSync=true;$('resizeW').value=String(Math.max(1,round(Number($('resizeH').value)*state.base.width/state.base.height)));ratioSync=false});
    $('applyResizeBtn')?.addEventListener('click',()=>{try{resize(Number($('resizeW').value),Number($('resizeH').value))}catch(error){setStatus(error.message||String(error),'error')}});
    ['brightness','contrast','saturation'].forEach(id=>$(id)?.addEventListener('input',()=>{state.adjustments[id]=Number($(id).value);updateAdjustOutputs();renderPreview()}));$('resetAdjustBtn')?.addEventListener('click',resetAdjustments);
    $('exportFormat')?.addEventListener('change',()=>{$('exportQuality').disabled=$('exportFormat').value==='image/png'});
    root.addEventListener('resize',()=>requestAnimationFrame(renderCropOverlay),{passive:true});
    document.addEventListener('keydown',event=>{
      const mod=event.ctrlKey||event.metaKey;if(!mod)return;
      const key=event.key.toLowerCase();if(key==='z'){event.preventDefault();undo()}else if(key==='o'){event.preventDefault();$('fileInput')?.click()}else if(key==='s'){event.preventDefault();if(state.base)downloadExport()}
    });
  }
  function boot(){
    setEnabled(false);document.querySelectorAll('[data-requires-image]').forEach(node=>node.setAttribute('aria-disabled','true'));bindFileInput();bindControls();bindCropDrag();updateAdjustOutputs();if($('exportQuality'))$('exportQuality').disabled=true;document.documentElement.dataset.imageEditorReady='1';
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();

  root.ImageEditorApp={
    loadBlob,loadFile,rotateLeft,rotateRight,flipHorizontal,flipVertical,setCrop,applyCrop,resize,setAdjustments,resetAdjustments,renderOutput,exportBlob,resetOriginal,undo,
    getState:()=>({loaded:state.loaded,width:state.base?.width||0,height:state.base?.height||0,crop:currentRect(),adjustments:{...state.adjustments},historyLength:state.history.length,name:state.originalName}),
    limits:{maxPixels:MAX_PIXELS},
    stage:'image-editor-core-stage1'
  };
})(window);
